import { NextResponse } from "next/server";
import {
  getNowPlayingMovies,
  getOnTheAirTvShows,
  getPopularMovies,
  getPopularTvShows,
  getTopRatedMovies,
  getTopRatedTvShows
} from "@/lib/tmdb";
import type { MediaType } from "@/lib/types";

type SourceMovie = {
  id: number;
  title: string;
  poster_path: string | null;
  release_date?: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids?: number[];
  media_type?: MediaType;
};

function mapMovie(movie: SourceMovie) {
  return {
    id: movie.id,
    title: movie.title,
    mediaType: movie.media_type ?? "movie",
    posterPath: movie.poster_path,
    releaseYear: movie.release_date?.slice(0, 4) ?? "Unknown",
    voteAverage: movie.vote_average,
    voteCount: movie.vote_count,
    genreIds: movie.genre_ids ?? []
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mediaType: MediaType = searchParams.get("mediaType") === "tv" ? "tv" : "movie";
    const [nowPlaying, topRated, popular] = await Promise.all(
      mediaType === "tv"
        ? [getOnTheAirTvShows(1), getTopRatedTvShows(1), getPopularTvShows(1)]
        : [getNowPlayingMovies(1), getTopRatedMovies(1), getPopularMovies(1)]
    );

    const hiddenGems = popular
      .filter((movie) => movie.vote_count >= 80)
      .sort((a, b) => a.popularity - b.popularity)
      .slice(0, 18);

    return NextResponse.json({
      mediaType,
      nowPlaying: nowPlaying.slice(0, 18).map(mapMovie),
      topRated: topRated.slice(0, 18).map(mapMovie),
      hiddenGems: hiddenGems.map(mapMovie)
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load discover movie collections",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
