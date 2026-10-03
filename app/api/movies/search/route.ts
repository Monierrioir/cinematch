import { NextRequest, NextResponse } from "next/server";
import { searchMovies, searchTVShows } from "@/lib/tmdb";
import type { MediaType } from "@/lib/types";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const mediaTypeParam = request.nextUrl.searchParams.get("mediaType");
  const mediaType: MediaType = mediaTypeParam === "tv" ? "tv" : "movie";

  if (!query.trim()) {
    return NextResponse.json({ results: [] });
  }

  try {
    const movies = mediaType === "tv" ? await searchTVShows(query) : await searchMovies(query);
    return NextResponse.json({
      results: movies.slice(0, 10).map((movie) => ({
        id: movie.id,
        title: movie.title,
        mediaType: movie.media_type ?? mediaType,
        overview: movie.overview,
        posterPath: movie.poster_path,
        releaseDate: movie.release_date,
        voteAverage: movie.vote_average,
        popularity: movie.popularity,
        originalLanguage: movie.original_language ?? null,
        genreIds: movie.genre_ids ?? []
      }))
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to search movies",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
