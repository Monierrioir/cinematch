import type { MediaType, TmdbMovie } from "@/lib/types";

function getTmdbConfig() {
  const apiKey = process.env.TMDB_API_KEY;
  const baseUrl = process.env.TMDB_BASE_URL || "https://api.themoviedb.org/3";

  if (!apiKey) {
    throw new Error("TMDB_API_KEY is missing. Add it to .env.local.");
  }

  return {
    apiKey,
    baseUrl
  };
}

async function tmdbFetch<T>(path: string, query: Record<string, string> = {}): Promise<T> {
  const { apiKey, baseUrl } = getTmdbConfig();

  const params = new URLSearchParams({
    api_key: apiKey,
    language: "en-US",
    ...query
  });

  const requestUrl = `${baseUrl}${path}?${params.toString()}`;
  console.log(`[TMDB] Request: ${requestUrl}`);

  const response = await fetch(requestUrl, {
    next: { revalidate: 60 * 60 }
  });

  if (!response.ok) {
    let rawErrorBody = "";
    try {
      rawErrorBody = await response.text();
    } catch {
      rawErrorBody = "";
    }
    console.error(
      `[TMDB] Error status=${response.status} path=${path} raw=${rawErrorBody.slice(0, 220)}`
    );
    throw new Error(`TMDb request failed (${response.status}) for path: ${path}`);
  }

  return response.json() as Promise<T>;
}

type TmdbListResponse = {
  results: Record<string, unknown>[];
};

type TmdbGenreResponse = {
  genres: { id: number; name: string }[];
};

type TmdbMovieDetailsResponse = TmdbMovie & {
  name?: string;
  first_air_date?: string;
  origin_country?: string[];
  keywords?: {
    keywords?: { id: number; name: string }[];
    results?: { id: number; name: string }[];
  };
};

function normalizeMediaListItem(item: Record<string, unknown>, mediaType: MediaType): TmdbMovie {
  const title =
    typeof item.title === "string"
      ? item.title
      : typeof item.name === "string"
        ? item.name
        : "Untitled";
  const releaseDate =
    typeof item.release_date === "string"
      ? item.release_date
      : typeof item.first_air_date === "string"
        ? item.first_air_date
        : undefined;

  const originCountries = Array.isArray(item.origin_country)
    ? item.origin_country.filter((value): value is string => typeof value === "string")
    : [];
  const productionCountries = Array.isArray(item.production_countries)
    ? (item.production_countries as { iso_3166_1: string; name: string }[])
    : originCountries.map((code) => ({ iso_3166_1: code, name: code }));

  return {
    id: typeof item.id === "number" ? item.id : 0,
    title,
    overview: typeof item.overview === "string" ? item.overview : "",
    poster_path: typeof item.poster_path === "string" ? item.poster_path : null,
    backdrop_path: typeof item.backdrop_path === "string" ? item.backdrop_path : null,
    adult: typeof item.adult === "boolean" ? item.adult : false,
    genre_ids: Array.isArray(item.genre_ids)
      ? item.genre_ids.filter((value): value is number => typeof value === "number")
      : [],
    release_date: releaseDate,
    popularity: typeof item.popularity === "number" ? item.popularity : 0,
    vote_average: typeof item.vote_average === "number" ? item.vote_average : 0,
    vote_count: typeof item.vote_count === "number" ? item.vote_count : 0,
    media_type: mediaType,
    original_language: typeof item.original_language === "string" ? item.original_language : undefined,
    production_countries: productionCountries
  };
}

export async function searchMedia(query: string, mediaType: MediaType): Promise<TmdbMovie[]> {
  if (!query.trim()) return [];
  const data = await tmdbFetch<TmdbListResponse>(`/search/${mediaType}`, {
    query,
    include_adult: "false"
  });
  return data.results.map((item) => normalizeMediaListItem(item, mediaType));
}

export async function searchMovies(query: string): Promise<TmdbMovie[]> {
  return searchMedia(query, "movie");
}

export async function searchTvShows(query: string): Promise<TmdbMovie[]> {
  return searchMedia(query, "tv");
}

// Explicit naming kept for service consumers that prefer TV acronym casing.
export async function searchTVShows(query: string): Promise<TmdbMovie[]> {
  return searchTvShows(query);
}

export async function getMovieDetails(movieId: number): Promise<TmdbMovie> {
  return tmdbFetch<TmdbMovie>(`/movie/${movieId}`);
}

function normalizeMovieDetails(data: TmdbMovieDetailsResponse, mediaType: MediaType): TmdbMovie {
  const keywords =
    data.keywords?.keywords?.map((keyword) => keyword.name.toLowerCase()) ??
    data.keywords?.results?.map((keyword) => keyword.name.toLowerCase()) ??
    [];
  return {
    ...data,
    title: data.title ?? data.name ?? "Untitled",
    release_date: data.release_date ?? data.first_air_date,
    media_type: mediaType,
    production_countries:
      data.production_countries ??
      data.origin_country?.map((code) => ({ iso_3166_1: code, name: code })) ??
      [],
    genre_ids: data.genre_ids ?? data.genres?.map((genre) => genre.id) ?? [],
    keywordNames: keywords
  };
}

export async function getMediaDetailsWithKeywords(movieId: number, mediaType: MediaType): Promise<TmdbMovie> {
  const data = await tmdbFetch<TmdbMovieDetailsResponse>(`/${mediaType}/${movieId}`, {
    append_to_response: "keywords"
  });
  return normalizeMovieDetails(data, mediaType);
}

export async function getMovieDetailsWithKeywords(movieId: number): Promise<TmdbMovie> {
  return getMediaDetailsWithKeywords(movieId, "movie");
}

export async function getTvDetailsWithKeywords(tvId: number): Promise<TmdbMovie> {
  return getMediaDetailsWithKeywords(tvId, "tv");
}

export async function getMediaItemsDetailsWithKeywords(
  itemIds: number[],
  mediaType: MediaType
): Promise<TmdbMovie[]> {
  const uniqueIds = Array.from(new Set(itemIds));
  const results = await Promise.all(
    uniqueIds.map((itemId) =>
      getMediaDetailsWithKeywords(itemId, mediaType).catch((error) => {
        console.error(`[TMDB] Failed to fetch ${mediaType} details for ${itemId}:`, error);
        return null;
      })
    )
  );

  return results.filter(Boolean) as TmdbMovie[];
}

export async function getMoviesDetailsWithKeywords(movieIds: number[]): Promise<TmdbMovie[]> {
  return getMediaItemsDetailsWithKeywords(movieIds, "movie");
}

export async function getTvItemsDetailsWithKeywords(tvIds: number[]): Promise<TmdbMovie[]> {
  return getMediaItemsDetailsWithKeywords(tvIds, "tv");
}

export async function getMoviesDetailsWithKeywords_legacy(movieIds: number[]): Promise<TmdbMovie[]> {
  const uniqueIds = Array.from(new Set(movieIds));
  const results = await Promise.all(
    uniqueIds.map((movieId) =>
      getMovieDetailsWithKeywords(movieId).catch((error) => {
        console.error(`[TMDB] Failed to fetch movie details for ${movieId}:`, error);
        return null;
      })
    )
  );

  return results.filter(Boolean) as TmdbMovie[];
}

export async function getGenreMap(mediaType: MediaType = "movie"): Promise<Map<number, string>> {
  const data = await tmdbFetch<TmdbGenreResponse>(`/genre/${mediaType}/list`);
  return new Map(data.genres.map((genre) => [genre.id, genre.name]));
}

export async function discoverHiddenGemCandidates(
  mediaType: MediaType,
  genreIds: number[],
  preferredLanguage?: string,
  pageCount = 2
): Promise<TmdbMovie[]> {
  const uniqueIds = Array.from(new Set(genreIds));
  const withGenres = uniqueIds.join(",");
  const candidates: TmdbMovie[] = [];

  for (let page = 1; page <= pageCount; page += 1) {
    const data = await tmdbFetch<TmdbListResponse>(`/discover/${mediaType}`, {
      with_genres: withGenres,
      sort_by: "vote_average.desc",
      "vote_count.gte": "120",
      include_adult: "false",
      ...(preferredLanguage ? { with_original_language: preferredLanguage } : {}),
      page: page.toString()
    });
    candidates.push(...data.results.map((item) => normalizeMediaListItem(item, mediaType)));
  }

  return candidates;
}

async function buildRecommendationCandidates(
  mediaType: MediaType,
  genreIds: number[],
  preferredLanguage?: string,
  pageCount = 3
): Promise<TmdbMovie[]> {
  return discoverHiddenGemCandidates(mediaType, genreIds, preferredLanguage, pageCount);
}

export async function getMovieRecommendationCandidates(
  genreIds: number[],
  preferredLanguage?: string,
  pageCount = 3
): Promise<TmdbMovie[]> {
  return buildRecommendationCandidates("movie", genreIds, preferredLanguage, pageCount);
}

export async function getTvRecommendationCandidates(
  genreIds: number[],
  preferredLanguage?: string,
  pageCount = 3
): Promise<TmdbMovie[]> {
  return buildRecommendationCandidates("tv", genreIds, preferredLanguage, pageCount);
}

export async function getRecommendationCandidatesByMediaType(
  mediaType: MediaType,
  genreIds: number[],
  preferredLanguage?: string,
  pageCount = 3
): Promise<TmdbMovie[]> {
  return mediaType === "tv"
    ? getTvRecommendationCandidates(genreIds, preferredLanguage, pageCount)
    : getMovieRecommendationCandidates(genreIds, preferredLanguage, pageCount);
}

export async function fetchDirectRecommendations(
  mediaType: MediaType,
  itemId: number,
  pageCount = 2
): Promise<TmdbMovie[]> {
  const candidates: TmdbMovie[] = [];
  for (let page = 1; page <= pageCount; page += 1) {
    const data = await tmdbFetch<TmdbListResponse>(`/${mediaType}/${itemId}/recommendations`, {
      page: page.toString(),
      include_adult: "false"
    });
    candidates.push(...data.results.map((item) => normalizeMediaListItem(item, mediaType)));
  }
  return candidates;
}

export async function fetchSimilarTitles(
  mediaType: MediaType,
  itemId: number,
  pageCount = 2
): Promise<TmdbMovie[]> {
  const candidates: TmdbMovie[] = [];
  for (let page = 1; page <= pageCount; page += 1) {
    const data = await tmdbFetch<TmdbListResponse>(`/${mediaType}/${itemId}/similar`, {
      page: page.toString(),
      include_adult: "false"
    });
    candidates.push(...data.results.map((item) => normalizeMediaListItem(item, mediaType)));
  }
  return candidates;
}

export async function getNowPlayingMovies(page = 1): Promise<TmdbMovie[]> {
  const data = await tmdbFetch<TmdbListResponse>("/movie/now_playing", {
    page: page.toString(),
    include_adult: "false"
  });
  return data.results.map((item) => normalizeMediaListItem(item, "movie"));
}

export async function getTopRatedMovies(page = 1): Promise<TmdbMovie[]> {
  const data = await tmdbFetch<TmdbListResponse>("/movie/top_rated", {
    page: page.toString(),
    include_adult: "false"
  });
  return data.results.map((item) => normalizeMediaListItem(item, "movie"));
}

export async function getPopularMovies(page = 1): Promise<TmdbMovie[]> {
  const data = await tmdbFetch<TmdbListResponse>("/movie/popular", {
    page: page.toString(),
    include_adult: "false"
  });
  return data.results.map((item) => normalizeMediaListItem(item, "movie"));
}

export async function getOnTheAirTvShows(page = 1): Promise<TmdbMovie[]> {
  const data = await tmdbFetch<TmdbListResponse>("/tv/on_the_air", {
    page: page.toString(),
    include_adult: "false"
  });
  return data.results.map((item) => normalizeMediaListItem(item, "tv"));
}

export async function getTopRatedTvShows(page = 1): Promise<TmdbMovie[]> {
  const data = await tmdbFetch<TmdbListResponse>("/tv/top_rated", {
    page: page.toString(),
    include_adult: "false"
  });
  return data.results.map((item) => normalizeMediaListItem(item, "tv"));
}

export async function getPopularTvShows(page = 1): Promise<TmdbMovie[]> {
  const data = await tmdbFetch<TmdbListResponse>("/tv/popular", {
    page: page.toString(),
    include_adult: "false"
  });
  return data.results.map((item) => normalizeMediaListItem(item, "tv"));
}

export type TmdbProvider = {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
};

export type TmdbVideo = {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official?: boolean;
  published_at?: string;
};

export type TmdbCastMember = {
  id: number;
  name: string;
  character?: string;
  profile_path?: string | null;
  order?: number;
};

export type TmdbCrewMember = {
  id: number;
  name: string;
  job?: string;
  department?: string;
};

export type TmdbWatchProvidersByRegion = {
  link?: string;
  flatrate?: TmdbProvider[];
  rent?: TmdbProvider[];
  buy?: TmdbProvider[];
};

export type TmdbRichMediaDetail = TmdbMovie & {
  name?: string;
  first_air_date?: string;
  runtime?: number;
  episode_run_time?: number[];
  number_of_episodes?: number;
  number_of_seasons?: number;
  created_by?: Array<{ id: number; name: string }>;
  credits?: {
    cast?: TmdbCastMember[];
    crew?: TmdbCrewMember[];
  };
  videos?: {
    results?: TmdbVideo[];
  };
  "watch/providers"?: {
    results?: Record<string, TmdbWatchProvidersByRegion>;
  };
};

export async function getMediaDetailsForView(
  itemId: number,
  mediaType: MediaType
): Promise<TmdbRichMediaDetail> {
  const data = await tmdbFetch<TmdbRichMediaDetail>(`/${mediaType}/${itemId}`, {
    append_to_response: "credits,videos,watch/providers"
  });

  return {
    ...data,
    title: data.title ?? data.name ?? "Untitled",
    release_date: data.release_date ?? data.first_air_date,
    media_type: mediaType
  };
}
