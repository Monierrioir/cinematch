import { NextResponse } from "next/server";
import { getPopularMovies } from "@/lib/tmdb";
import type { TrendingMovie, TmdbMovie } from "@/lib/types";

function dedupeByMovieId(movies: TmdbMovie[]): TmdbMovie[] {
  const map = new Map<number, TmdbMovie>();
  movies.forEach((movie) => {
    if (!map.has(movie.id)) map.set(movie.id, movie);
  });
  return Array.from(map.values());
}

function mapTrendingMovie(movie: TmdbMovie): TrendingMovie {
  return {
    id: movie.id,
    title: movie.title || "Untitled",
    posterPath: movie.poster_path ?? null,
    releaseYear: movie.release_date?.slice(0, 4) ?? "Unknown",
    voteAverage: Number.isFinite(movie.vote_average) ? movie.vote_average : 0,
    popularity: Number.isFinite(movie.popularity) ? movie.popularity : 0
  };
}

export async function GET() {
  try {
    const [pageOne, pageTwo] = await Promise.all([getPopularMovies(1), getPopularMovies(2)]);
    const topTrending = dedupeByMovieId([...pageOne, ...pageTwo])
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 5)
      .map(mapTrendingMovie);

    return NextResponse.json({ topTrending });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load trending movies",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
