import { NextRequest, NextResponse } from "next/server";
import { buildRecommendations } from "@/lib/recommendation";
import { getPrismaClientSafe, getPrismaInitErrorMessage } from "@/lib/prisma";
import {
  getGenreMap,
  getMediaItemsDetailsWithKeywords,
  getRecommendationCandidatesByMediaType
} from "@/lib/tmdb";
import type { MediaType, SelectedMovie } from "@/lib/types";

type RecommendationRequestBody = {
  selectedMovies?: SelectedMovie[];
};

export async function POST(request: NextRequest) {
  try {
    const prisma = getPrismaClientSafe();
    const body = (await request.json()) as RecommendationRequestBody;
    const selectedMovies = body.selectedMovies ?? [];

    if (selectedMovies.length < 1) {
      return NextResponse.json(
        { error: "Please select at least 1 movie before requesting recommendations." },
        { status: 400 }
      );
    }

    const mediaType: MediaType = selectedMovies[0]?.mediaType === "tv" ? "tv" : "movie";

    const genreIds = selectedMovies.flatMap((movie) => movie.genreIds);
    if (!genreIds.length) {
      return NextResponse.json(
        { error: "Selected movies do not have enough genre data." },
        { status: 400 }
      );
    }

    const selectedMovieDetails = await getMediaItemsDetailsWithKeywords(
      selectedMovies.map((movie) => movie.id),
      mediaType
    );
    const languageCounts = new Map<string, number>();
    selectedMovieDetails.forEach((movie) => {
      const language = movie.original_language?.toLowerCase();
      if (language) languageCounts.set(language, (languageCounts.get(language) ?? 0) + 1);
    });
    const dominantLanguage =
      Array.from(languageCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? undefined;

    const [genreMap, candidateDiscoverResults] = await Promise.all([
      getGenreMap(mediaType),
      getRecommendationCandidatesByMediaType(mediaType, genreIds, dominantLanguage, 3)
    ]);
    const candidateIds = candidateDiscoverResults
      .filter((movie) => !selectedMovies.some((selected) => selected.id === movie.id))
      .filter((movie) => (movie.media_type ?? mediaType) === mediaType)
      .slice(0, 45)
      .map((movie) => movie.id);
    const candidateMoviesDetailed = await getMediaItemsDetailsWithKeywords(candidateIds, mediaType);
    const sameTypeCandidates = candidateMoviesDetailed.filter(
      (movie) => (movie.media_type ?? mediaType) === mediaType
    );

    const recommendations = buildRecommendations(
      selectedMovies,
      sameTypeCandidates,
      genreMap,
      selectedMovieDetails,
      undefined,
      12
    );

    // Persist a lightweight snapshot for analytics/history in production.
    if (prisma) {
      await prisma.userSession
        .create({
          data: {
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
        })
        .catch(() => null);
    } else {
      console.error("[recommendations API] prisma unavailable:", getPrismaInitErrorMessage());
    }

    return NextResponse.json({ recommendations });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to generate recommendations",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
