import { NextRequest, NextResponse } from "next/server";
import { buildRecommendations } from "@/lib/recommendation";
import { getAuthenticatedUserId } from "@/lib/auth-user";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
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

type RecommendationRequestBody = SelectedMovie[] | { selectedMovies?: SelectedMovie[] };

type JsonResponse = {
  recommendations: unknown[];
  error?: string;
  details?: string;
  fallbackUsed?: boolean;
  fallbackMessage?: string;
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
  z.object({ selectedMovies: z.array(selectedMovieSchema) })
]);

function jsonResponse(payload: JsonResponse, status = 200) {
  return NextResponse.json(payload, { status });
}

function extractSelectedMovies(body: RecommendationRequestBody): SelectedMovie[] {
  if (Array.isArray(body)) return body;
  return body.selectedMovies ?? [];
}

function posterRank(a: TmdbMovie, b: TmdbMovie): number {
  const aHasPoster = a.poster_path ? 1 : 0;
  const bHasPoster = b.poster_path ? 1 : 0;
  return bHasPoster - aHasPoster;
}

function buildFallbackRecommendations(
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

  const scored = Array.from(deduped.values()).map((movie) => {
    const genreIds = movie.genre_ids ?? movie.genres?.map((genre) => genre.id) ?? [];
    const overlapCount = genreIds.filter((genreId) => selectedGenreIds.has(genreId)).length;
    const genreScore = selectedGenreIds.size ? overlapCount / selectedGenreIds.size : 0;
    const year = Number((movie.release_date ?? "").slice(0, 4));
    const yearScore =
      avgYear && Number.isFinite(year) ? Math.max(0, 1 - Math.min(Math.abs(year - avgYear), 25) / 25) : 0.45;
    const voteScore = Math.max(0, Math.min(1, (movie.vote_average ?? 0) / 10));
    const popularityScore = Math.max(0, Math.min(1, (movie.popularity ?? 0) / 100));
    const finalScore = genreScore * 0.46 + yearScore * 0.24 + voteScore * 0.2 + popularityScore * 0.1;
    return { movie, finalScore };
  });

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
      whyRecommended:
        "Bu film için doğrudan öneri bulunamadı, benzer filmler gösteriliyor."
    };
  });
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

    const [genreMap, candidateDiscoverResults] = await Promise.all([
      getGenreMap(normalizedMediaType),
      getRecommendationCandidatesByMediaType(normalizedMediaType, genreIds, dominantLanguage, 3)
    ]);

    const candidateIds = candidateDiscoverResults
      .filter((movie) => !selectedMovies.some((selected) => selected.id === movie.id))
      .filter((movie) => (movie.media_type ?? normalizedMediaType) === normalizedMediaType)
      .slice(0, 45)
      .map((movie) => movie.id);
    const candidateMoviesDetailed = await getMediaItemsDetailsWithKeywords(
      candidateIds,
      normalizedMediaType
    );
    const sameTypeCandidates = candidateMoviesDetailed.filter(
      (movie) => (movie.media_type ?? normalizedMediaType) === normalizedMediaType
    );

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

    let recommendations = buildRecommendations(
      selectedMovies,
      sameTypeCandidates,
      genreMap,
      selectedMovieDetails,
      profileSignals,
      12
    );

    let fallbackUsed = false;
    let fallbackMessage: string | undefined;
    if (recommendations.length === 0) {
      const [topRatedPage1, topRatedPage2, popularPage1, popularPage2] =
        normalizedMediaType === "tv"
          ? await Promise.all([
              getTopRatedTvShows(1),
              getTopRatedTvShows(2),
              getPopularTvShows(1),
              getPopularTvShows(2)
            ])
          : await Promise.all([
              getTopRatedMovies(1),
              getTopRatedMovies(2),
              getPopularMovies(1),
              getPopularMovies(2)
            ]);

      recommendations = buildFallbackRecommendations(
        selectedMovies,
        selectedMovieDetails,
        candidateDiscoverResults,
        [...topRatedPage1, ...topRatedPage2, ...popularPage1, ...popularPage2],
        genreMap,
        normalizedMediaType,
        12
      );
      fallbackUsed = recommendations.length > 0;
      if (fallbackUsed) {
        fallbackMessage = "Bu film için doğrudan öneri bulunamadı, benzer filmler gösteriliyor.";
      }
    }

    const responsePayload = { recommendations, fallbackUsed, fallbackMessage };

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
