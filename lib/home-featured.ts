import type { FeaturedMovie, TmdbMovie } from "@/lib/types";

const MIN_RELIABLE_VOTE_COUNT = 90;

function mapFeaturedMovie(movie: TmdbMovie): FeaturedMovie {
  return {
    id: movie.id,
    title: movie.title || "Untitled",
    overview: movie.overview || "No overview available.",
    posterPath: movie.poster_path,
    backdropPath: movie.backdrop_path ?? null,
    releaseYear: movie.release_date?.slice(0, 4) ?? "Unknown",
    voteAverage: Number.isFinite(movie.vote_average) ? movie.vote_average : 0,
    voteCount: Number.isFinite(movie.vote_count) ? movie.vote_count : 0,
    popularity: Number.isFinite(movie.popularity) ? movie.popularity : 0
  };
}

function dedupeByMovieId(movies: TmdbMovie[]): TmdbMovie[] {
  const map = new Map<number, TmdbMovie>();
  movies.forEach((movie) => {
    if (!map.has(movie.id)) map.set(movie.id, movie);
  });
  return Array.from(map.values());
}

export function selectTopFeaturedNowPlaying(movies: TmdbMovie[], take = 3): FeaturedMovie[] {
  const unique = dedupeByMovieId(movies).filter(
    (movie) => Boolean(movie?.id) && Boolean(movie?.title) && Number.isFinite(movie?.vote_average)
  );
  const sortByRatingDesc = (a: TmdbMovie, b: TmdbMovie) => b.vote_average - a.vote_average;

  // First pass: keep only reliable vote counts so ratings are meaningful.
  const reliable = unique.filter((movie) => movie.vote_count >= MIN_RELIABLE_VOTE_COUNT);
  const selected = reliable.sort(sortByRatingDesc).slice(0, take);

  // Fallback: if TMDb returns too few reliable titles, fill remaining slots from all items.
  if (selected.length < take) {
    const selectedIds = new Set(selected.map((movie) => movie.id));
    const fallbackPool = unique
      .filter((movie) => !selectedIds.has(movie.id))
      .sort(sortByRatingDesc)
      .slice(0, take - selected.length);
    selected.push(...fallbackPool);
  }

  return selected.slice(0, take).map(mapFeaturedMovie);
}
