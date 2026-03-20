import type { SelectedMovie } from "@/lib/types";

export const CINEMATCH_SELECTED_MOVIES_KEY = "cinematch_selected_movies";

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

export function parseSelectedMovies(raw: string | null): SelectedMovie[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidSelectedMovie);
  } catch {
    return [];
  }
}
