const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
const TMDB_BACKDROP_BASE_URL = "https://image.tmdb.org/t/p/w780";
const TMDB_BACKDROP_HIGHRES_BASE_URL = "https://image.tmdb.org/t/p/original";
const TMDB_BACKDROP_FALLBACK_BASE_URL = "https://image.tmdb.org/t/p/w1280";

export function getPosterUrl(posterPath: string | null | undefined): string {
  if (!posterPath) return "https://placehold.co/500x750?text=No+Poster";
  return `${TMDB_IMAGE_BASE_URL}${posterPath}`;
}

export function getBackdropUrl(backdropPath: string | null | undefined): string {
  if (!backdropPath) return "https://placehold.co/1280x720?text=No+Backdrop";
  return `${TMDB_BACKDROP_BASE_URL}${backdropPath}`;
}

export function getHeroBackdropUrl(
  backdropPath: string | null | undefined,
  useFallbackSize = false
): string {
  if (!backdropPath) return "https://placehold.co/1920x1080?text=No+Backdrop";
  const base = useFallbackSize ? TMDB_BACKDROP_FALLBACK_BASE_URL : TMDB_BACKDROP_HIGHRES_BASE_URL;
  return `${base}${backdropPath}`;
}
