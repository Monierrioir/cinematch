import { NextRequest, NextResponse } from "next/server";
import { getRecommendationCandidatesByMediaType } from "@/lib/tmdb";
import type { MediaType } from "@/lib/types";

type MoodKey = "relaxed" | "excited" | "emotional" | "dark";

const MOOD_GENRE_MAP: Record<MoodKey, Record<MediaType, number[]>> = {
  relaxed: {
    movie: [35, 10751, 14, 16, 10402],
    tv: [35, 10751, 16]
  },
  excited: {
    movie: [28, 12, 53, 878],
    tv: [10759, 10765, 80]
  },
  emotional: {
    movie: [18, 10749, 36],
    tv: [18, 10766, 35]
  },
  dark: {
    movie: [53, 80, 27, 9648],
    tv: [80, 9648, 18]
  }
};

function toMood(value: string | null): MoodKey | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (
    normalized === "relaxed" ||
    normalized === "excited" ||
    normalized === "emotional" ||
    normalized === "dark"
  ) {
    return normalized;
  }
  return null;
}

function toMediaType(value: string | null): MediaType {
  return value === "tv" ? "tv" : "movie";
}

export async function GET(request: NextRequest) {
  const mood = toMood(request.nextUrl.searchParams.get("mood"));
  const mediaType = toMediaType(request.nextUrl.searchParams.get("mediaType"));
  if (!mood) {
    return NextResponse.json({ error: "Invalid mood. Use relaxed, excited, emotional, or dark." }, { status: 400 });
  }

  try {
    const genreIds = MOOD_GENRE_MAP[mood][mediaType];
    const candidates = await getRecommendationCandidatesByMediaType(mediaType, genreIds, undefined, 2);
    const recommendations = candidates
      .filter((movie) => Boolean(movie.poster_path))
      .slice(0, 16)
      .map((movie) => ({
        id: movie.id,
        title: movie.title,
        posterPath: movie.poster_path,
        rating: movie.vote_average ?? 0,
        mediaType: (movie.media_type ?? mediaType) as MediaType
      }));

    return NextResponse.json({
      mood,
      mediaType,
      recommendations
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to generate mood recommendations.",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
