import type { MediaType } from "@/lib/types";

export type TasteEventType = "select" | "like" | "love" | "dislike" | "open" | "request";

export type TasteProfileEvent = {
  type: TasteEventType;
  mediaType: MediaType;
  genreIds?: number[];
  releaseYear?: string;
  voteAverage?: number;
  popularity?: number;
  originalLanguage?: string | null;
  toneHint?: "dark" | "light" | "neutral";
};

export type SessionTasteProfile = {
  eventCount: number;
  mediaTypeWeights: Record<MediaType, number>;
  genreWeights: Record<string, number>;
  decadeWeights: Record<string, number>;
  languageWeights: Record<string, number>;
  toneWeights: Record<"dark" | "light" | "neutral", number>;
  ratingSum: number;
  ratingCount: number;
  popularitySum: number;
  popularityCount: number;
  lastUpdatedAt: number;
};

export type TastePreferenceSignals = {
  confidence: number;
  preferredMediaType: MediaType | null;
  preferredGenreIds: number[];
  preferredDecades: string[];
  preferredPopularityBand: "low" | "medium" | "high" | null;
  preferredLanguage: string | null;
  preferredRatingTarget: number | null;
  tonePreference: "dark" | "light" | "balanced";
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const EVENT_WEIGHTS: Record<TasteEventType, number> = {
  select: 1,
  like: 1.15,
  love: 1.55,
  dislike: -0.55,
  open: 0.6,
  request: 0.85
};

export function createEmptyTasteProfile(): SessionTasteProfile {
  return {
    eventCount: 0,
    mediaTypeWeights: { movie: 0, tv: 0 },
    genreWeights: {},
    decadeWeights: {},
    languageWeights: {},
    toneWeights: { dark: 0, light: 0, neutral: 0 },
    ratingSum: 0,
    ratingCount: 0,
    popularitySum: 0,
    popularityCount: 0,
    lastUpdatedAt: Date.now()
  };
}

function toDecadeBucket(releaseYear?: string): string | null {
  if (!releaseYear) return null;
  const year = Number(releaseYear.slice(0, 4));
  if (!Number.isFinite(year) || year < 1880) return null;
  const decade = Math.floor(year / 10) * 10;
  return `${decade}s`;
}

function bumpWeight(weights: Record<string, number>, key: string, delta: number): Record<string, number> {
  const next = { ...weights };
  next[key] = Math.max(0, (next[key] ?? 0) + delta);
  return next;
}

export function inferToneFromGenres(genreIds: number[]): "dark" | "light" | "neutral" {
  const darkGenres = new Set([27, 53, 80, 9648, 10752]);
  const lightGenres = new Set([35, 10751, 16, 10749, 10402]);
  const darkHits = genreIds.filter((id) => darkGenres.has(id)).length;
  const lightHits = genreIds.filter((id) => lightGenres.has(id)).length;
  if (darkHits > lightHits) return "dark";
  if (lightHits > darkHits) return "light";
  return "neutral";
}

export function updateTasteProfile(
  current: SessionTasteProfile | null | undefined,
  event: TasteProfileEvent
): SessionTasteProfile {
  const profile = current ?? createEmptyTasteProfile();
  const eventWeight = EVENT_WEIGHTS[event.type];
  const genreIds = event.genreIds ?? [];
  const tone = event.toneHint ?? inferToneFromGenres(genreIds);
  const decade = toDecadeBucket(event.releaseYear);
  const next: SessionTasteProfile = {
    ...profile,
    eventCount: profile.eventCount + 1,
    mediaTypeWeights: { ...profile.mediaTypeWeights },
    genreWeights: { ...profile.genreWeights },
    decadeWeights: { ...profile.decadeWeights },
    languageWeights: { ...profile.languageWeights },
    toneWeights: { ...profile.toneWeights },
    lastUpdatedAt: Date.now()
  };

  next.mediaTypeWeights[event.mediaType] = Math.max(0, next.mediaTypeWeights[event.mediaType] + eventWeight);
  genreIds.forEach((genreId) => {
    next.genreWeights = bumpWeight(next.genreWeights, String(genreId), eventWeight);
  });
  if (decade) next.decadeWeights = bumpWeight(next.decadeWeights, decade, eventWeight);
  if (event.originalLanguage) {
    next.languageWeights = bumpWeight(next.languageWeights, event.originalLanguage.toLowerCase(), eventWeight);
  }
  next.toneWeights[tone] = Math.max(0, next.toneWeights[tone] + eventWeight);

  if (typeof event.voteAverage === "number" && Number.isFinite(event.voteAverage) && event.voteAverage > 0) {
    next.ratingSum += event.voteAverage;
    next.ratingCount += 1;
  }
  if (typeof event.popularity === "number" && Number.isFinite(event.popularity) && event.popularity >= 0) {
    next.popularitySum += event.popularity;
    next.popularityCount += 1;
  }

  return next;
}

function pickTopKeys(
  source: Record<string, number>,
  limit: number,
  minWeight = 0.01
): string[] {
  return Object.entries(source)
    .filter(([, value]) => value > minWeight)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => key);
}

export function extractPreferenceSignals(
  profile: SessionTasteProfile | null | undefined
): TastePreferenceSignals {
  if (!profile || profile.eventCount < 2) {
    return {
      confidence: 0,
      preferredMediaType: null,
      preferredGenreIds: [],
      preferredDecades: [],
      preferredPopularityBand: null,
      preferredLanguage: null,
      preferredRatingTarget: null,
      tonePreference: "balanced"
    };
  }

  const confidence = clamp((profile.eventCount - 1) / 14);
  const preferredMediaType: MediaType | null =
    profile.mediaTypeWeights.movie === profile.mediaTypeWeights.tv
      ? null
      : profile.mediaTypeWeights.movie > profile.mediaTypeWeights.tv
        ? "movie"
        : "tv";
  const preferredGenreIds = pickTopKeys(profile.genreWeights, 5)
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));
  const preferredDecades = pickTopKeys(profile.decadeWeights, 3);
  const preferredLanguage = pickTopKeys(profile.languageWeights, 1)[0] ?? null;
  const preferredRatingTarget =
    profile.ratingCount > 0 ? Number((profile.ratingSum / profile.ratingCount).toFixed(2)) : null;
  const avgPopularity = profile.popularityCount > 0 ? profile.popularitySum / profile.popularityCount : null;
  const preferredPopularityBand =
    avgPopularity === null ? null : avgPopularity < 35 ? "low" : avgPopularity < 85 ? "medium" : "high";
  const dark = profile.toneWeights.dark;
  const light = profile.toneWeights.light;
  const tonePreference: "dark" | "light" | "balanced" =
    Math.abs(dark - light) < 0.8 ? "balanced" : dark > light ? "dark" : "light";

  return {
    confidence,
    preferredMediaType,
    preferredGenreIds,
    preferredDecades,
    preferredPopularityBand,
    preferredLanguage,
    preferredRatingTarget,
    tonePreference
  };
}

export function rankByTasteAndSimilarity<T extends { similarityScore: number; movie: TasteRankableMovie }>(
  items: T[],
  profile: SessionTasteProfile | null | undefined
): T[] {
  const signals = extractPreferenceSignals(profile);
  if (signals.confidence < 0.16) return items;

  const blend = clamp(signals.confidence * 0.38, 0.1, 0.38);
  return items.map((item) => {
    const tasteScore = computeTasteFit(item.movie, signals);
    const blendedScore = clamp(item.similarityScore * (1 - blend) + tasteScore * blend);
    return {
      ...item,
      similarityScore: blendedScore
    };
  });
}

type TasteRankableMovie = {
  mediaType?: MediaType;
  genreIds: number[];
  releaseYear: string;
  voteAverage: number;
  popularity: number;
  originalLanguage?: string | null;
  toneHint?: "dark" | "light" | "neutral";
};

function computeTasteFit(movie: TasteRankableMovie, signals: TastePreferenceSignals): number {
  let score = 0.5;

  if (signals.preferredMediaType && movie.mediaType) {
    score += movie.mediaType === signals.preferredMediaType ? 0.1 : -0.08;
  }
  if (signals.preferredGenreIds.length > 0) {
    const overlap = movie.genreIds.filter((id) => signals.preferredGenreIds.includes(id)).length;
    score += (overlap / signals.preferredGenreIds.length) * 0.18;
  }
  if (signals.preferredDecades.length > 0 && signals.preferredDecades.includes(toDecadeBucket(movie.releaseYear) ?? "")) {
    score += 0.1;
  }
  if (signals.preferredRatingTarget !== null) {
    const diff = Math.abs(movie.voteAverage - signals.preferredRatingTarget);
    score += Math.max(-0.12, 0.12 - diff * 0.04);
  }
  if (signals.preferredPopularityBand) {
    const popularityBand =
      movie.popularity < 35 ? "low" : movie.popularity < 85 ? "medium" : "high";
    score += popularityBand === signals.preferredPopularityBand ? 0.1 : -0.04;
  }
  if (signals.preferredLanguage && movie.originalLanguage) {
    score += movie.originalLanguage.toLowerCase() === signals.preferredLanguage ? 0.07 : -0.03;
  }

  const tone = movie.toneHint ?? inferToneFromGenres(movie.genreIds);
  if (signals.tonePreference !== "balanced") {
    score += tone === signals.tonePreference ? 0.08 : -0.03;
  }

  return clamp(score);
}

export function generateTasteExplanation(profile: SessionTasteProfile | null | undefined): string | null {
  const signals = extractPreferenceSignals(profile);
  if (signals.confidence < 0.22) return null;

  const parts: string[] = [];
  if (signals.preferredGenreIds.length > 0) {
    parts.push("your recent genre pattern");
  }
  if (signals.tonePreference === "dark") {
    parts.push("a darker tone preference");
  } else if (signals.tonePreference === "light") {
    parts.push("a lighter tonal preference");
  }
  if (signals.preferredPopularityBand === "low") {
    parts.push("less mainstream picks");
  } else if (signals.preferredPopularityBand === "high") {
    parts.push("audience-favorite titles");
  }

  if (parts.length === 0) return "Closer to your recent taste";
  return `Closer to your recent taste: tuned for ${parts.slice(0, 2).join(" and ")}.`;
}
