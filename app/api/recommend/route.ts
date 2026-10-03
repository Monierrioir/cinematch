import { NextRequest, NextResponse } from "next/server";
import { buildRecommendations } from "@/lib/recommendation";
import { getAuthenticatedUserId } from "@/lib/auth-user";
import { consumeRateLimit } from "@/lib/rate-limit";
import { generateTasteExplanation, type SessionTasteProfile } from "@/lib/taste-profile";
import {
  fetchDirectRecommendations as fetchDirectRecommendationsFromTmdb,
  fetchSimilarTitles as fetchSimilarTitlesFromTmdb,
  getGenreMap,
  getMediaItemsDetailsWithKeywords,
  getRecommendationCandidatesByMediaType,
  getPopularMovies,
  getPopularTvShows,
  getTopRatedMovies,
  getTopRatedTvShows
} from "@/lib/tmdb";
import type { MediaType, SelectedMovie, TmdbMovie } from "@/lib/types";
import { z } from "zod";

type RecommendationRequestBody =
  | SelectedMovie[]
  | { selectedMovies?: SelectedMovie[]; sessionTasteProfile?: SessionTasteProfile | null; debug?: boolean };

type JsonResponse = {
  recommendations: unknown[];
  error?: string;
  details?: string;
  fallbackUsed?: boolean;
  fallbackMessage?: string;
  tasteExplanation?: string | null;
  recommendationContext?: string;
  debug?: {
    seed?: { id: number; title: string; mediaType: MediaType };
    directCount?: number;
    similarCount?: number;
    discoverCount?: number;
    fallbackReason?: string | null;
    sourceBreakdown?: { direct: number; similar: number; discover: number; fallback: number };
    topTitleSources?: Array<{ title: string; source: "direct" | "similar" | "discover" | "fallback" }>;
  };
};

type SeedFetchResult = {
  directCount: number;
  similarCount: number;
  directIds: Set<number>;
  similarIds: Set<number>;
  candidateDiscoverResults: TmdbMovie[];
};

const selectedMovieSchema = z.object({
  id: z.number(),
  title: z.string(),
  mediaType: z.enum(["movie", "tv"]),
  genreIds: z.array(z.number()).min(1),
  posterPath: z.string().nullable().optional(),
  releaseYear: z.string().optional(),
  reaction: z.enum(["like", "love", "dislike"]).optional()
});

const recommendPayloadSchema = z.union([
  z.array(selectedMovieSchema),
  z.object({
    selectedMovies: z.array(selectedMovieSchema),
    sessionTasteProfile: z.unknown().optional().nullable(),
    debug: z.boolean().optional()
  })
]);

function jsonResponse(payload: JsonResponse, status = 200) {
  return NextResponse.json(payload, { status });
}

function extractSelectedMovies(body: RecommendationRequestBody): SelectedMovie[] {
  if (Array.isArray(body)) return body;
  return body.selectedMovies ?? [];
}

function extractSessionTasteProfile(body: RecommendationRequestBody): SessionTasteProfile | null {
  if (Array.isArray(body)) return null;
  const profile = body.sessionTasteProfile;
  if (!profile || typeof profile !== "object") return null;
  return profile as SessionTasteProfile;
}

function extractDebugMode(body: RecommendationRequestBody): boolean {
  if (Array.isArray(body)) return false;
  return body.debug === true;
}

function getSelectedSeedItem(selectedMovies: SelectedMovie[]): SelectedMovie | null {
  if (!selectedMovies.length) return null;
  const preferred = selectedMovies.find((movie) => movie.reaction === "love")
    ?? selectedMovies.find((movie) => movie.reaction === "like")
    ?? selectedMovies.find((movie) => movie.reaction !== "dislike")
    ?? selectedMovies[0];
  return preferred ?? null;
}

function buildRecommendationContext(seedItem: SelectedMovie | null, seedDetail?: TmdbMovie): string {
  if (!seedItem) return "Matched from your selected titles";
  const seedGenres = (seedDetail?.genres ?? [])
    .map((genre) => genre.name)
    .slice(0, 2)
    .join(" and ");
  if (seedGenres) {
    return `Because you liked ${seedItem.title} — we prioritized ${seedGenres} tone and close release-era matches with strong audience reception.`;
  }
  return `Because you liked ${seedItem.title} — we prioritized similar tone, genre profile, and release-era quality.`;
}

function posterRank(a: TmdbMovie, b: TmdbMovie): number {
  const aHasPoster = a.poster_path ? 1 : 0;
  const bHasPoster = b.poster_path ? 1 : 0;
  return bHasPoster - aHasPoster;
}

function fetchFallbackCandidates(
  selectedMovies: SelectedMovie[],
  selectedMovieDetails: TmdbMovie[],
  candidateDiscoverResults: TmdbMovie[],
  backupPools: TmdbMovie[],
  genreMap: Map<number, string>,
  mediaType: MediaType,
  limit = 12
) {
  const selectedIds = new Set(selectedMovies.map((movie) => movie.id));
  const selectedGenreIds = new Set(selectedMovies.flatMap((movie) => movie.genreIds));
  const releaseYears = selectedMovieDetails
    .map((movie) => Number((movie.release_date ?? "").slice(0, 4)))
    .filter((year) => Number.isFinite(year));
  const avgYear = releaseYears.length
    ? releaseYears.reduce((sum, year) => sum + year, 0) / releaseYears.length
    : null;

  const combined = [...candidateDiscoverResults, ...backupPools]
    .filter((movie) => !selectedIds.has(movie.id))
    .filter((movie) => (movie.media_type ?? mediaType) === mediaType);

  const deduped = new Map<number, TmdbMovie>();
  combined.forEach((movie) => {
    if (!deduped.has(movie.id)) deduped.set(movie.id, movie);
  });

  const scored = Array.from(deduped.values())
    .filter((movie) => (movie.vote_average ?? 0) >= 6.2 || (movie.vote_count ?? 0) >= 220)
    .filter((movie) => Boolean(movie.poster_path))
    .map((movie) => {
    const genreIds = movie.genre_ids ?? movie.genres?.map((genre) => genre.id) ?? [];
    const overlapCount = genreIds.filter((genreId) => selectedGenreIds.has(genreId)).length;
    const genreScore = selectedGenreIds.size ? overlapCount / selectedGenreIds.size : 0;
    const year = Number((movie.release_date ?? "").slice(0, 4));
    const yearScore =
      avgYear && Number.isFinite(year) ? Math.max(0, 1 - Math.min(Math.abs(year - avgYear), 25) / 25) : 0.45;
    const voteScore = Math.max(0, Math.min(1, (movie.vote_average ?? 0) / 10));
    const confidenceScore = Math.max(0, Math.min(1, Math.log10(Math.max(1, movie.vote_count ?? 1)) / 4));
    const rawPopularity = movie.popularity ?? 0;
    const mediumPopularityPreference = Math.max(0, 1 - Math.min(Math.abs(rawPopularity - 45), 70) / 70);
    const mainstreamPenalty = rawPopularity > 110 ? Math.min(0.12, (rawPopularity - 110) / 300) : 0;
    const finalScore =
      genreScore * 0.42 +
      yearScore * 0.2 +
      voteScore * 0.2 +
      confidenceScore * 0.1 +
      mediumPopularityPreference * 0.08 -
      mainstreamPenalty;
    return { movie, finalScore, genreScore, mediumPopularityPreference };
    })
    .filter((item) => item.genreScore >= 0.2 || item.mediumPopularityPreference >= 0.45);

  scored.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if ((b.movie.vote_average ?? 0) !== (a.movie.vote_average ?? 0)) {
      return (b.movie.vote_average ?? 0) - (a.movie.vote_average ?? 0);
    }
    if ((b.movie.popularity ?? 0) !== (a.movie.popularity ?? 0)) {
      return (b.movie.popularity ?? 0) - (a.movie.popularity ?? 0);
    }
    return posterRank(a.movie, b.movie);
  });

  return scored.slice(0, limit).map(({ movie, finalScore }) => {
    const genreIds = movie.genre_ids ?? movie.genres?.map((genre) => genre.id) ?? [];
    const genres = genreIds.map((id) => genreMap.get(id)).filter(Boolean) as string[];
    const badges: string[] = [];
    if ((movie.popularity ?? 0) < 35 && (movie.vote_average ?? 0) >= 7) badges.push("Hidden Gem");
    if ((movie.vote_average ?? 0) >= 7.6 && (movie.vote_count ?? 0) >= 450) badges.push("Critically Strong");
    if ((movie.popularity ?? 0) >= 85) badges.push("Popular Pick");
    return {
      id: movie.id,
      mediaType: (movie.media_type ?? mediaType) as MediaType,
      title: movie.title,
      overview: movie.overview || "Similar titles curated from related themes and release period.",
      posterPath: movie.poster_path,
      releaseYear: (movie.release_date ?? "Unknown").slice(0, 4) || "Unknown",
      genres,
      popularity: movie.popularity ?? 0,
      voteAverage: movie.vote_average ?? 0,
      recommendationScore: Number((finalScore * 100).toFixed(2)),
      whyRecommended: "Same genre profile and era, with solid audience reception.",
      recommendationBadges: badges.slice(0, 2)
    };
  });
}

function rankRecommendationResults(
  candidates: TmdbMovie[],
  selectedMovies: SelectedMovie[],
  mediaType: MediaType
): TmdbMovie[] {
  const beforeCount = candidates.length;
  const selectedGenreIds = new Set(selectedMovies.flatMap((movie) => movie.genreIds));
  const selectedIds = new Set(selectedMovies.map((movie) => movie.id));
  const scored = candidates
    .filter((movie) => !selectedIds.has(movie.id))
    .filter((movie) => (movie.media_type ?? mediaType) === mediaType)
    .filter((movie) => (movie.vote_average ?? 0) >= 5.8 || (movie.vote_count ?? 0) >= 120)
    .map((movie) => {
      const genreIds = movie.genre_ids ?? movie.genres?.map((genre) => genre.id) ?? [];
      const overlap = genreIds.filter((genreId) => selectedGenreIds.has(genreId)).length;
      const genreScore = selectedGenreIds.size ? overlap / selectedGenreIds.size : 0;
      const voteScore = Math.max(0, Math.min(1, (movie.vote_average ?? 0) / 10));
      const confidence = Math.max(0, Math.min(1, Math.log10(Math.max(1, movie.vote_count ?? 1)) / 4));
      const popularityLowWeight = Math.max(0, Math.min(1, (movie.popularity ?? 0) / 120));
      const popularityPenalty = (movie.popularity ?? 0) > 90 ? Math.min(0.12, ((movie.popularity ?? 0) - 90) / 280) : 0;
      const finalScore =
        genreScore * 0.52 +
        voteScore * 0.24 +
        confidence * 0.2 +
        popularityLowWeight * 0.04 -
        popularityPenalty;
      return { movie, finalScore };
    });

  scored.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if ((b.movie.vote_average ?? 0) !== (a.movie.vote_average ?? 0)) {
      return (b.movie.vote_average ?? 0) - (a.movie.vote_average ?? 0);
    }
    return (b.movie.vote_count ?? 0) - (a.movie.vote_count ?? 0);
  });

  const deduped = new Map<number, TmdbMovie>();
  scored.forEach(({ movie }) => {
    if (!deduped.has(movie.id)) deduped.set(movie.id, movie);
  });
  const ranked = Array.from(deduped.values());
  console.log(
    `[recommend API] rankRecommendationResults before=${beforeCount} after_filters=${scored.length} after_dedupe=${ranked.length}`
  );
  return ranked;
}

async function fetchSimilarTitles(
  normalizedMediaType: MediaType,
  seedId: number
): Promise<TmdbMovie[]> {
  console.log(`[recommend API] endpoint=/${normalizedMediaType}/${seedId}/similar`);
  return fetchSimilarTitlesFromTmdb(normalizedMediaType, seedId, 2).catch((error) => {
    console.error("[recommend API] similar fetch failed:", error instanceof Error ? error.message : error);
    return [];
  });
}

async function fetchDirectRecommendations(
  selectedMovies: SelectedMovie[],
  seedItem: SelectedMovie,
  normalizedMediaType: MediaType,
  dominantLanguage: string | undefined,
): Promise<SeedFetchResult> {
  console.log(
    `[recommend API] selected_seed id=${seedItem.id} title="${seedItem.title}" mediaType=${seedItem.mediaType}`
  );
  console.log("[recommend API] selected_seed_full", JSON.stringify(seedItem));
  console.log(`[recommend API] endpoint=/${normalizedMediaType}/${seedItem.id}/recommendations`);
  const directResults = await fetchDirectRecommendationsFromTmdb(normalizedMediaType, seedItem.id, 2).catch(
    (error) => {
      console.error("[recommend API] direct recommendations fetch failed:", error instanceof Error ? error.message : error);
      return [];
    }
  );
  const similarResults = await fetchSimilarTitles(normalizedMediaType, seedItem.id);

  const genreIds = selectedMovies.flatMap((movie) => movie.genreIds);
  const candidateDiscoverResults = await getRecommendationCandidatesByMediaType(
    normalizedMediaType,
    genreIds,
    dominantLanguage,
    3
  );

  console.log(
    `[recommend API] direct_count=${directResults.length} similar_count=${similarResults.length} discover_seed_count=${candidateDiscoverResults.length}`
  );

  const mergedRanked = rankRecommendationResults(
    [...directResults, ...similarResults, ...candidateDiscoverResults],
    selectedMovies,
    normalizedMediaType
  );
  return {
    directCount: directResults.length,
    similarCount: similarResults.length,
    directIds: new Set(directResults.map((movie) => movie.id)),
    similarIds: new Set(similarResults.map((movie) => movie.id)),
    candidateDiscoverResults: mergedRanked
  };
}

async function parseRequestBodySafe(request: NextRequest): Promise<RecommendationRequestBody> {
  const raw = await request.text();
  if (!raw.trim()) return [];

  try {
    return JSON.parse(raw) as RecommendationRequestBody;
  } catch {
    throw new Error("Invalid JSON body.");
  }
}

function isValidSelectedMovie(value: unknown): value is SelectedMovie {
  if (!value || typeof value !== "object") return false;
  const movie = value as Partial<SelectedMovie>;
  return (
    typeof movie.id === "number" &&
    typeof movie.title === "string" &&
    (movie.mediaType === "movie" || movie.mediaType === "tv") &&
    Array.isArray(movie.genreIds) &&
    movie.genreIds.every((genreId) => typeof genreId === "number")
  );
}

export async function GET() {
  return jsonResponse(
    {
      error: "Method not allowed. Use POST.",
      recommendations: []
    },
    405
  );
}

export async function POST(request: NextRequest) {
  const clientKey = request.headers.get("x-forwarded-for") ?? request.ip ?? "anonymous";
  const rate = consumeRateLimit(`recommend:${clientKey}`, 30, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: "Too many recommendation requests. Please try again shortly.",
        recommendations: []
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfterSeconds)
        }
      }
    );
  }

  try {
    console.log(
      `[recommend API] config hasApiKey=${Boolean(process.env.TMDB_API_KEY)} hasBaseUrl=${Boolean(process.env.TMDB_BASE_URL)}`
    );
    const body = await parseRequestBodySafe(request);
    const parsedPayload = recommendPayloadSchema.safeParse(body);
    if (!parsedPayload.success) {
      return jsonResponse(
        {
          error: "Invalid selectedMovies payload format.",
          recommendations: []
        },
        400
      );
    }
    const selectedMovies = extractSelectedMovies(parsedPayload.data);
    const sessionTasteProfile = extractSessionTasteProfile(parsedPayload.data);
    const debugMode = extractDebugMode(parsedPayload.data);

    if (!selectedMovies.every(isValidSelectedMovie)) {
      return jsonResponse(
        {
          error: "Invalid selectedMovies payload format.",
          recommendations: []
        },
        400
      );
    }

    if (selectedMovies.length < 1) {
      return jsonResponse(
        {
          error: "Please select at least 1 movie before requesting recommendations.",
          recommendations: []
        },
        400
      );
    }

    const mediaType = selectedMovies[0]?.mediaType;
    if (!mediaType) {
      return jsonResponse(
        {
          error: "Selected items must include mediaType (movie or tv).",
          recommendations: []
        },
        400
      );
    }
    const hasMixedMediaTypes = selectedMovies.some((movie) => movie.mediaType !== mediaType);
    if (hasMixedMediaTypes) {
      return jsonResponse(
        {
          error: "Please select only one type at a time: Movies or TV Shows.",
          recommendations: []
        },
        400
      );
    }

    const genreIds = selectedMovies.flatMap((movie) => movie.genreIds);
    if (!genreIds.length) {
      return jsonResponse(
        {
          error: "Selected movies do not have enough genre data.",
          recommendations: []
        },
        400
      );
    }

    const normalizedMediaType = mediaType as MediaType;
    const selectedMovieDetails = await getMediaItemsDetailsWithKeywords(
      selectedMovies.map((movie) => movie.id),
      normalizedMediaType
    );

    const languageCounts = new Map<string, number>();
    selectedMovieDetails.forEach((movie) => {
      const language = movie.original_language?.toLowerCase();
      if (language) languageCounts.set(language, (languageCounts.get(language) ?? 0) + 1);
    });
    const dominantLanguage =
      Array.from(languageCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? undefined;

    const genreMap = await getGenreMap(normalizedMediaType);

    let profileSignals:
      | {
          preferredMediaType: MediaType | null;
          preferredLanguage: string | null;
          favoriteGenreIds: number[];
        }
      | undefined;
    const authenticatedUserId = await getAuthenticatedUserId();
    const favoriteGenres = Array.from(
      new Set(selectedMovies.flatMap((movie) => movie.genreIds).slice(0, 8))
    );
    const profileLanguage =
      Array.from(languageCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    try {
      const { getPrismaClientSafe, getPrismaInitErrorMessage } = await import("@/lib/prisma");
      const prisma = getPrismaClientSafe();
      if (!prisma) {
        console.error("[recommend API] prisma unavailable during profile read:", getPrismaInitErrorMessage());
      }
      if (authenticatedUserId) {
        const userProfile = prisma
          ? await prisma.userProfile.findUnique({
              where: { userId: authenticatedUserId }
            })
          : null;
        if (userProfile) {
          profileSignals = {
            preferredMediaType:
              userProfile.preferredMediaType === "movie" || userProfile.preferredMediaType === "tv"
                ? userProfile.preferredMediaType
                : null,
            preferredLanguage: userProfile.preferredLanguage ?? null,
            favoriteGenreIds: userProfile.favoriteGenreIds
          };
        }
      }
    } catch {
      profileSignals = undefined;
    }

    const seedItem = getSelectedSeedItem(selectedMovies);
    if (!seedItem || !Number.isFinite(seedItem.id)) {
      console.warn("[recommend API] fallback_reason=missing_selected_seed");
      return jsonResponse(
        {
          recommendations: [],
          fallbackUsed: true,
          fallbackMessage: "Selected title could not be resolved for direct recommendations."
        },
        200
      );
    }

    const seedResult = await fetchDirectRecommendations(
      selectedMovies,
      seedItem,
      normalizedMediaType,
      dominantLanguage
    );
    const directCandidateIds = seedResult.candidateDiscoverResults
      .filter((movie) => !selectedMovies.some((selected) => selected.id === movie.id))
      .slice(0, 70)
      .map((movie) => movie.id);
    const directCandidatesDetailed = await getMediaItemsDetailsWithKeywords(
      directCandidateIds,
      normalizedMediaType
    );
    const seedDetail = selectedMovieDetails.find((movie) => movie.id === seedItem.id);
    const selectedMoviesForSeedRanking = [seedItem];
    const selectedDetailsForSeedRanking = seedDetail ? [seedDetail] : selectedMovieDetails.slice(0, 1);
    let recommendations = buildRecommendations(
      selectedMoviesForSeedRanking,
      directCandidatesDetailed,
      genreMap,
      selectedDetailsForSeedRanking,
      profileSignals,
      12,
      sessionTasteProfile
    );
    let recommendationContext = buildRecommendationContext(seedItem, seedDetail);
    let fallbackReason: string | null = null;

    let fallbackUsed = false;
    let fallbackMessage: string | undefined;
    if (recommendations.length === 0) {
      console.warn("[recommend API] fallback_reason=seed_recommendations_empty");
      fallbackReason = "seed_recommendations_empty";
      const [topRatedPage1, topRatedPage2] =
        normalizedMediaType === "tv"
          ? await Promise.all([
              getTopRatedTvShows(1),
              getTopRatedTvShows(2)
            ])
          : await Promise.all([
              getTopRatedMovies(1),
              getTopRatedMovies(2)
            ]);

      recommendations = fetchFallbackCandidates(
        selectedMoviesForSeedRanking,
        selectedMovieDetails,
        seedResult.candidateDiscoverResults,
        [...topRatedPage1, ...topRatedPage2],
        genreMap,
        normalizedMediaType,
        12
      );
      if (recommendations.length > 0) {
        fallbackUsed = true;
        fallbackMessage = "Direct recommendations were limited, so we expanded using similar genre and mood.";
        recommendationContext = `Because direct matches for ${seedItem.title} were limited, we expanded to close genre, era, and tone neighbors.`;
      } else {
        console.warn("[recommend API] fallback_reason=discover_fallback_empty_using_popular_last_resort");
        fallbackReason = "discover_fallback_empty_using_popular_last_resort";
        const [popularPage1, popularPage2] =
          normalizedMediaType === "tv"
            ? await Promise.all([getPopularTvShows(1), getPopularTvShows(2)])
            : await Promise.all([getPopularMovies(1), getPopularMovies(2)]);
        recommendations = fetchFallbackCandidates(
          selectedMoviesForSeedRanking,
          selectedMovieDetails,
          [],
          [...popularPage1, ...popularPage2],
          genreMap,
          normalizedMediaType,
          12
        );
        fallbackUsed = recommendations.length > 0;
        if (fallbackUsed) {
          fallbackMessage = "Direct and similar recommendations were limited, so broader popular titles were used.";
          recommendationContext = `Seed-specific options for ${seedItem.title} were very limited, so broader high-quality titles were added as a last resort.`;
        }
      }
    }

    const tasteExplanation = generateTasteExplanation(sessionTasteProfile);
    const sourceBreakdown = {
      direct: 0,
      similar: 0,
      discover: 0,
      fallback: 0
    };
    const topTitleSources: Array<{ title: string; source: "direct" | "similar" | "discover" | "fallback" }> = [];
    recommendations.forEach((movie) => {
      let source: "direct" | "similar" | "discover" | "fallback" = "fallback";
      if (seedResult.directIds.has(movie.id)) source = "direct";
      else if (seedResult.similarIds.has(movie.id)) source = "similar";
      else if (!fallbackUsed) source = "discover";
      sourceBreakdown[source] += 1;
      if (topTitleSources.length < 12) {
        topTitleSources.push({ title: movie.title, source });
      }
    });

    const responsePayload = {
      recommendations,
      fallbackUsed,
      fallbackMessage,
      tasteExplanation,
      recommendationContext,
      ...(debugMode
        ? {
            debug: {
              seed: { id: seedItem.id, title: seedItem.title, mediaType: seedItem.mediaType },
              directCount: seedResult.directCount,
              similarCount: seedResult.similarCount,
              discoverCount: seedResult.candidateDiscoverResults.length,
              fallbackReason,
              sourceBreakdown,
              topTitleSources
            }
          }
        : {})
    };

    // Persist snapshot best-effort; never fail the API response on DB issues.
    try {
      const { getPrismaClientSafe, getPrismaInitErrorMessage } = await import("@/lib/prisma");
      const prisma = getPrismaClientSafe();
      if (!prisma) {
        console.error("[recommend API] prisma unavailable during persistence:", getPrismaInitErrorMessage());
        return jsonResponse(responsePayload, 200);
      }

      if (authenticatedUserId) {
        await prisma.userProfile.upsert({
          where: { userId: authenticatedUserId },
          update: {
            preferredMediaType: normalizedMediaType,
            preferredLanguage: profileLanguage,
            favoriteGenreIds: favoriteGenres
          },
          create: {
            userId: authenticatedUserId,
            preferredMediaType: normalizedMediaType,
            preferredLanguage: profileLanguage,
            favoriteGenreIds: favoriteGenres
          }
        });
      }

      await prisma.userSession.create({
        data: {
          userId: authenticatedUserId,
          selectedMovies: {
            create: selectedMovies.map((movie) => ({
              movieId: movie.id,
              title: movie.title,
              genreIds: movie.genreIds
            }))
          },
          recommendations: {
            create: recommendations.map((movie) => ({
              movieId: movie.id,
              title: movie.title,
              whyRecommended: movie.whyRecommended,
              score: movie.recommendationScore
            }))
          }
        }
      });
    } catch (dbError) {
      console.error(
        "[recommend API] non-blocking persistence error:",
        dbError instanceof Error ? dbError.message : dbError
      );
    }

    return jsonResponse(responsePayload, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[recommend API] error:", message);
    return jsonResponse(
      {
        error: "Failed to generate recommendations",
        details: message,
        recommendations: []
      },
      500
    );
  }
}
