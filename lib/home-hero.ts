import type { HeroMovie, TmdbMovie } from "@/lib/types";

function dedupeByMovieId(movies: TmdbMovie[]): TmdbMovie[] {
  const map = new Map<number, TmdbMovie>();
  movies.forEach((movie) => {
    if (!map.has(movie.id)) map.set(movie.id, movie);
  });
  return Array.from(map.values());
}

function mapHeroMovie(movie: TmdbMovie, genreMap: Map<number, string>): HeroMovie {
  const genres = (movie.genre_ids ?? [])
    .map((genreId) => genreMap.get(genreId))
    .filter((genre): genre is string => Boolean(genre))
    .slice(0, 3);

  return {
    id: movie.id,
    title: movie.title || "Untitled",
    overview: movie.overview || "No overview available.",
    backdropPath: movie.backdrop_path ?? null,
    releaseYear: movie.release_date?.slice(0, 4) ?? "Unknown",
    popularity: Number.isFinite(movie.popularity) ? movie.popularity : 0,
    genres
  };
}

export function selectTopHeroMovies(
  movies: TmdbMovie[],
  genreMap: Map<number, string>,
  take = 5
): HeroMovie[] {
  const candidates = dedupeByMovieId(movies)
    .filter((movie) => Boolean(movie?.id) && Boolean(movie?.title) && Boolean(movie?.backdrop_path))
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, take);

  return candidates.map((movie) => mapHeroMovie(movie, genreMap));
}
