import { NextResponse } from "next/server";
import { selectTopFeaturedNowPlaying } from "@/lib/home-featured";
import { getNowPlayingMovies } from "@/lib/tmdb";

export async function GET() {
  try {
    const [pageOne, pageTwo] = await Promise.all([getNowPlayingMovies(1), getNowPlayingMovies(2)]);
    const featuredNowPlaying = selectTopFeaturedNowPlaying([...pageOne, ...pageTwo], 3);

    return NextResponse.json({
      featuredNowPlaying
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load home movie sections",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
