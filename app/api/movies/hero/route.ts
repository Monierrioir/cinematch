import { NextResponse } from "next/server";
import { selectTopHeroMovies } from "@/lib/home-hero";
import { getGenreMap, getNowPlayingMovies } from "@/lib/tmdb";

export async function GET() {
  try {
    const [genreMap, pageOne, pageTwo] = await Promise.all([
      getGenreMap(),
      getNowPlayingMovies(1),
      getNowPlayingMovies(2)
    ]);

    const heroMovies = selectTopHeroMovies([...pageOne, ...pageTwo], genreMap, 5);

    return NextResponse.json({
      heroMovies
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load hero movies",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
