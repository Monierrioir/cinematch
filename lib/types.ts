export type MediaType = "movie" | "tv";

export type TmdbMovie = {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path?: string | null;
  adult?: boolean;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  release_date?: string;
  popularity: number;
  vote_average: number;
  vote_count: number;
  media_type?: MediaType;
  original_language?: string;
  production_countries?: { iso_3166_1: string; name: string }[];
  keywordNames?: string[];
};

export type SelectedMovie = {
  id: number;
  title: string;
  mediaType: MediaType;
  genreIds: number[];
  posterPath?: string | null;
  releaseYear?: string;
  reaction?: "like" | "love" | "dislike";
};

export type RecommendedMovie = {
  id: number;
  mediaType: MediaType;
  title: string;
  overview: string;
  posterPath: string | null;
  releaseYear: string;
  genres: string[];
  popularity: number;
  voteAverage: number;
  recommendationScore: number;
  whyRecommended: string;
  recommendationBadges?: string[];
  becauseYouLikedTitle?: string;
};

export type FeaturedMovie = {
  id: number;
  title: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseYear: string;
  voteAverage: number;
  voteCount: number;
  popularity: number;
};

export type HeroMovie = {
  id: number;
  title: string;
  overview: string;
  backdropPath: string | null;
  releaseYear: string;
  popularity: number;
  genres: string[];
};

export type TrendingMovie = {
  id: number;
  title: string;
  posterPath: string | null;
  releaseYear: string;
  voteAverage: number;
  popularity: number;
};

export type BookInfo = {
  title: string;
  author: string;
  note: string;
};
