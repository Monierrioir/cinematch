import type { SelectedMovie } from "@/lib/types";
import {
  createEmptyTasteProfile,
  type SessionTasteProfile,
  type TasteProfileEvent,
  updateTasteProfile
} from "@/lib/taste-profile";

export const CINEMATCH_SELECTED_MOVIES_KEY = "cinematch_selected_movies";
export const CINEMATCH_TASTE_PROFILE_KEY = "cinematch_taste_profile";

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

export function parseTasteProfile(raw: string | null): SessionTasteProfile | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SessionTasteProfile;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.eventCount !== "number") return null;
    if (!parsed.mediaTypeWeights || !parsed.genreWeights || !parsed.decadeWeights) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getSessionTasteProfile(): SessionTasteProfile {
  if (typeof window === "undefined") return createEmptyTasteProfile();
  const raw = window.localStorage.getItem(CINEMATCH_TASTE_PROFILE_KEY);
  return parseTasteProfile(raw) ?? createEmptyTasteProfile();
}

export function saveSessionTasteProfile(profile: SessionTasteProfile): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CINEMATCH_TASTE_PROFILE_KEY, JSON.stringify(profile));
}

export function trackTasteProfileEvent(event: TasteProfileEvent): SessionTasteProfile {
  const current = getSessionTasteProfile();
  const next = updateTasteProfile(current, event);
  saveSessionTasteProfile(next);
  return next;
}
