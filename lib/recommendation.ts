import type { RecommendedMovie, SelectedMovie, TmdbMovie } from "@/lib/types";
import { inferToneFromGenres, rankByTasteAndSimilarity, type SessionTasteProfile } from "@/lib/taste-profile";

const ANIMATION_GENRE_ID = 16;
const BROAD_GENRE_IDS = new Set([14, 18, 35, 10751]);
const STOP_WORDS = new Set([
  "the",
  "and",
  "with",
  "from",
  "into",
  "that",
  "this",
  "they",
  "their",
  "about",
  "while",
  "when",
  "where",
  "after",
  "before",
  "have",
  "has",
  "been",
  "were",
  "will",
  "your",
  "just",
  "than",
  "over",
  "under"
]);
const MOOD_TERMS = new Set([
  "nostalgic",
  "quiet",
  "gentle",
  "melancholy",
  "bittersweet",
  "emotional",
  "lonely",
  "memory",
  "coming",
  "age",
  "slow",
  "dream",
  "atmospheric",
  "friendship",
  "intimate",
  "tender",
  "tense",
  "dark",
  "hopeful"
]);

const WEIGHTS = {
  genreSimilarity: 0.26,
  keywordThemeSimilarity: 0.19,
  overviewTextSimilarity: 0.13,
  yearProximity: 0.1,
  languageMatch: 0.08,
  countrySimilarity: 0.05,
  audienceFit: 0.1,
  voteConfidence: 0.05,
  popularityLight: 0.04
} as const;

export type UserProfileSignals = {
  preferredMediaType?: "movie" | "tv" | null;
  favoriteGenreIds?: number[];
  preferredLanguage?: string | null;
};

type NormalizedSelectedItem = {
  id: number;
  title: string;
  mediaType: "movie" | "tv";
  genreIds: Set<number>;
  year: number | null;
  language: string | null;
  countries: Set<string>;
  tokens: Set<string>;
  moodTokens: Set<string>;
  isAdult: boolean;
  isAnimation: boolean;
};

type RecommendationContext = {
  mediaType: "movie" | "tv";
  selected: NormalizedSelectedItem[];
  selectedIds: Set<number>;
  selectedGenreWeights: Map<number, number>;
  selectedTokenSet: Set<string>;
  selectedMoodSet: Set<string>;
  avgYear: number | null;
  avgPopularity: number;
  dominantLanguage: string | null;
  preferredCountries: Set<string>;
  adultRatio: number;
  animationRatio: number;
  userProfileSignals?: UserProfileSignals;
};

type ScoreBreakdown = {
  genreSimilarity: number;
  yearProximity: number;
  audienceFit: number;
  voteConfidence: number;
  popularityLight: number;
  popularityPenalty: number;
  languageMatch: number;
  adultCompatibility: number;
  keywordThemeSimilarity: number;
  overviewTextSimilarity: number;
  countrySimilarity: number;
  totalBeforePenalty: number;
  total: number;
};

type ScoredCandidate = {
  movie: TmdbMovie;
  finalScore: number;
  breakdown: ScoreBreakdown;
  badges: string[];
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const toReleaseYear = (releaseDate?: string): string => {
  if (!releaseDate) return "Unknown";
  return releaseDate.split("-")[0] || "Unknown";
};

const toNumberYear = (releaseDate?: string): number | null => {
  const year = Number(toReleaseYear(releaseDate));
  return Number.isNaN(year) ? null : year;
};

function tokenize(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

function normalizeGenreIds(movie: TmdbMovie): number[] {
  return movie.genre_ids ?? movie.genres?.map((genre) => genre.id) ?? [];
}

function isAnimation(movie: TmdbMovie): boolean {
  return normalizeGenreIds(movie).includes(ANIMATION_GENRE_ID);
}

function overlapRatio(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  a.forEach((token) => {
    if (b.has(token)) overlap += 1;
  });
  return clamp(overlap / Math.max(1, Math.min(a.size, b.size)));
}

export function normalizeSelectedItem(
  selectedMovie: SelectedMovie,
  detailedMovie?: TmdbMovie
): NormalizedSelectedItem {
  const source = detailedMovie;
  const genreIds = new Set<number>(source ? normalizeGenreIds(source) : selectedMovie.genreIds);
  const language = source?.original_language?.toLowerCase() ?? null;
  const countries = new Set(
    source?.production_countries?.map((country) => country.iso_3166_1) ?? []
  );
  const tokens = new Set([
    ...tokenize(source?.overview),
    ...(source?.keywordNames ?? []).flatMap((keyword) => tokenize(keyword))
  ]);
  const moodTokens = new Set(Array.from(tokens).filter((token) => MOOD_TERMS.has(token)));

  return {
    id: selectedMovie.id,
    title: selectedMovie.title,
    mediaType: selectedMovie.mediaType,
    genreIds,
    year: toNumberYear(source?.release_date ?? selectedMovie.releaseYear),
    language,
    countries,
    tokens,
    moodTokens,
    isAdult: Boolean(source?.adult),
    isAnimation: source ? isAnimation(source) : selectedMovie.genreIds.includes(ANIMATION_GENRE_ID)
  };
}

function buildRecommendationContext(
  selectedMovies: SelectedMovie[],
  selectedMoviesDetailed: TmdbMovie[],
  userProfileSignals?: UserProfileSignals
): RecommendationContext {
  const selectedById = new Map(selectedMoviesDetailed.map((movie) => [movie.id, movie]));
  const selected = selectedMovies.map((movie) => normalizeSelectedItem(movie, selectedById.get(movie.id)));
  const genreCounts = new Map<number, number>();
  const languageCounts = new Map<string, number>();
  const countryCounts = new Map<string, number>();
  const selectedTokenSet = new Set<string>();
  const selectedMoodSet = new Set<string>();
  const selectedIds = new Set<number>();
  let yearTotal = 0;
  let yearCount = 0;
  let popularityTotal = 0;
  let adultCount = 0;
  let animationCount = 0;

  selected.forEach((movie) => {
    selectedIds.add(movie.id);
    movie.genreIds.forEach((genreId) => {
      const broadMultiplier = BROAD_GENRE_IDS.has(genreId) ? 0.5 : 1;
      genreCounts.set(genreId, (genreCounts.get(genreId) ?? 0) + broadMultiplier);
    });
    if (movie.language) languageCounts.set(movie.language, (languageCounts.get(movie.language) ?? 0) + 1);
    movie.countries.forEach((country) =>
      countryCounts.set(country, (countryCounts.get(country) ?? 0) + 1)
    );
    movie.tokens.forEach((token) => selectedTokenSet.add(token));
    movie.moodTokens.forEach((token) => selectedMoodSet.add(token));
    if (movie.year) {
      yearTotal += movie.year;
      yearCount += 1;
    }
    const detail = selectedById.get(movie.id);
    popularityTotal += detail?.popularity ?? 0;
    if (movie.isAdult) adultCount += 1;
    if (movie.isAnimation) animationCount += 1;
  });

  const totalGenreWeight = Array.from(genreCounts.values()).reduce((sum, value) => sum + value, 0) || 1;
  const selectedGenreWeights = new Map(
    Array.from(genreCounts.entries()).map(([genreId, count]) => [genreId, count / totalGenreWeight])
  );

  const dominantLanguage =
    Array.from(languageCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    userProfileSignals?.preferredLanguage?.toLowerCase() ??
    null;
  const preferredCountries = new Set(
    Array.from(countryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([country]) => country)
  );

  return {
    mediaType: selectedMovies[0]?.mediaType ?? "movie",
    selected,
    selectedIds,
    selectedGenreWeights,
    selectedTokenSet,
    selectedMoodSet,
    avgYear: yearCount ? yearTotal / yearCount : null,
    avgPopularity: selected.length ? popularityTotal / selected.length : 0,
    dominantLanguage,
    preferredCountries,
    adultRatio: selected.length ? adultCount / selected.length : 0,
    animationRatio: selected.length ? animationCount / selected.length : 0,
    userProfileSignals
  };
}

function getPopularityPenalty(popularity: number): number {
  if (popularity <= 90) return 0;
  return clamp(((popularity - 90) / 220) * 0.18, 0, 0.18);
}

function getVoteConfidence(voteCount: number): number {
  return clamp(Math.log10(Math.max(1, voteCount)) / 4);
}

function getAudienceFit(voteAverage: number, voteCount: number): number {
  const normalizedVote = clamp(voteAverage / 10);
  const confidence = getVoteConfidence(voteCount);
  return clamp(normalizedVote * (0.68 + confidence * 0.32));
}

function getFranchiseKey(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[:\-|].*$/, "")
    .replace(/\b(part|chapter|episode|vol|volume|season)\b.*$/, "")
    .replace(/\b(i|ii|iii|iv|v|vi|vii|viii|ix|x)\b/g, "")
    .replace(/\d+/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
  const tokens = base.split(/\s+/).filter(Boolean);
  return tokens.slice(0, 2).join(" ");
}

function getSubPatternKey(movie: TmdbMovie): string {
  const genres = normalizeGenreIds(movie).slice(0, 2).sort((a, b) => a - b).join("-");
  const language = movie.original_language?.toLowerCase() ?? "xx";
  const format = isAnimation(movie) ? "anim" : "live";
  return `${genres}:${language}:${format}`;
}

export function computeSimilarityScore(
  candidate: TmdbMovie,
  context: RecommendationContext
): ScoreBreakdown {
  const candidateGenreIds = normalizeGenreIds(candidate);
  const candidateGenreSet = new Set(candidateGenreIds);
  const candidateYear = toNumberYear(candidate.release_date);
  const candidateLanguage = candidate.original_language?.toLowerCase() ?? null;
  const candidateCountries = new Set(
    candidate.production_countries?.map((country) => country.iso_3166_1) ?? []
  );
  const candidateTokens = new Set([
    ...tokenize(candidate.overview),
    ...(candidate.keywordNames ?? []).flatMap((keyword) => tokenize(keyword))
  ]);
  const candidateMoodTokens = new Set(Array.from(candidateTokens).filter((token) => MOOD_TERMS.has(token)));

  const genreSimilarity = clamp(
    Array.from(context.selectedGenreWeights.entries()).reduce((score, [genreId, weight]) => {
      if (candidateGenreSet.has(genreId)) return score + weight;
      return score;
    }, 0)
  );
  const yearProximity =
    candidateYear && context.avgYear
      ? clamp(1 - Math.min(Math.abs(candidateYear - context.avgYear), 28) / 28)
      : 0.45;
  const keywordThemeSimilarity = overlapRatio(candidateTokens, context.selectedTokenSet);
  const moodSimilarity = overlapRatio(candidateMoodTokens, context.selectedMoodSet);
  const overviewTextSimilarity = clamp(keywordThemeSimilarity * 0.72 + moodSimilarity * 0.28);
  const languageMatch = context.dominantLanguage
    ? candidateLanguage === context.dominantLanguage
      ? 1
      : 0.25
    : 0.5;
  const countrySimilarity =
    context.preferredCountries.size > 0 &&
    Array.from(candidateCountries).some((country) => context.preferredCountries.has(country))
      ? 1
      : 0.3;
  const adultCompatibility =
    context.adultRatio >= 0.5 ? (candidate.adult ? 1 : 0.35) : candidate.adult ? 0.25 : 1;

  const voteConfidence = getVoteConfidence(candidate.vote_count ?? 0);
  const audienceFit = getAudienceFit(candidate.vote_average ?? 0, candidate.vote_count ?? 0);
  const popularityLight = clamp((candidate.popularity ?? 0) / 120);
  const popularityPenalty = getPopularityPenalty(candidate.popularity ?? 0);
  const hiddenGemLift = clamp(
    ((1 - popularityLight) * 0.65 + audienceFit * 0.35) * (genreSimilarity * 0.7 + keywordThemeSimilarity * 0.3)
  ) * 0.06;

  const totalBeforePenalty =
    genreSimilarity * WEIGHTS.genreSimilarity +
    keywordThemeSimilarity * WEIGHTS.keywordThemeSimilarity +
    overviewTextSimilarity * WEIGHTS.overviewTextSimilarity +
    yearProximity * WEIGHTS.yearProximity +
    languageMatch * WEIGHTS.languageMatch +
    countrySimilarity * WEIGHTS.countrySimilarity +
    audienceFit * WEIGHTS.audienceFit +
    voteConfidence * WEIGHTS.voteConfidence +
    popularityLight * WEIGHTS.popularityLight +
    hiddenGemLift;

  const total = clamp(totalBeforePenalty * adultCompatibility - popularityPenalty);
  return {
    genreSimilarity,
    yearProximity,
    audienceFit,
    voteConfidence,
    popularityLight,
    popularityPenalty,
    languageMatch,
    adultCompatibility,
    keywordThemeSimilarity,
    overviewTextSimilarity,
    countrySimilarity,
    totalBeforePenalty,
    total
  };
}

function isIrrelevantCandidate(candidate: TmdbMovie, breakdown: ScoreBreakdown): boolean {
  if (breakdown.genreSimilarity < 0.14) return true;
  if (breakdown.genreSimilarity < 0.2 && breakdown.keywordThemeSimilarity < 0.18) return true;
  if (breakdown.yearProximity < 0.15 && breakdown.keywordThemeSimilarity < 0.26) return true;
  if ((candidate.vote_average ?? 0) < 6 && (candidate.vote_count ?? 0) < 120) return true;
  if (!candidate.poster_path && (candidate.vote_count ?? 0) < 90) return true;
  if (!candidate.overview && (candidate.keywordNames?.length ?? 0) === 0) return true;
  return false;
}

function getRecommendationBadges(candidate: TmdbMovie, breakdown: ScoreBreakdown): string[] {
  const badges: string[] = [];
  if (breakdown.total >= 0.72) badges.push("Close Match");
  if (
    (candidate.popularity ?? 0) < 36 &&
    breakdown.total >= 0.58 &&
    breakdown.audienceFit >= 0.62
  ) {
    badges.push("Hidden Gem");
  }
  if ((candidate.popularity ?? 0) >= 85 && breakdown.total >= 0.55) badges.push("Popular Pick");
  if ((candidate.vote_average ?? 0) >= 7.6 && (candidate.vote_count ?? 0) >= 450) {
    badges.push("Critically Strong");
  }
  return badges.slice(0, 2);
}

export function buildRecommendationExplanation(
  candidate: TmdbMovie,
  breakdown: ScoreBreakdown
): string {
  const reasons: string[] = [];
  if (breakdown.genreSimilarity >= 0.42) reasons.push("Same core genre profile");
  if (breakdown.keywordThemeSimilarity >= 0.42) reasons.push("Similar themes and narrative focus");
  if (breakdown.overviewTextSimilarity >= 0.4) reasons.push("Comparable mood and tone");
  if (breakdown.yearProximity >= 0.55) reasons.push("Close release era");
  if (breakdown.languageMatch >= 0.8 || breakdown.countrySimilarity >= 0.8) {
    reasons.push("Aligned language and audience style");
  }
  if ((candidate.popularity ?? 0) < 36 && breakdown.total >= 0.58) {
    reasons.push("Less mainstream but highly aligned");
  }
  if (reasons.length === 0) reasons.push("Strong audience fit in a similar style");
  return reasons.slice(0, 2).join(" • ");
}

function pickBecauseYouLikedTitle(
  candidate: TmdbMovie,
  selectedMoviesDetailed: TmdbMovie[]
): string | undefined {
  if (!selectedMoviesDetailed.length) return undefined;
  const candidateTokens = new Set([
    ...tokenize(candidate.overview),
    ...(candidate.keywordNames ?? []).flatMap((keyword) => tokenize(keyword))
  ]);
  const candidateGenres = new Set(normalizeGenreIds(candidate));
  let bestTitle = selectedMoviesDetailed[0]?.title;
  let bestScore = -1;

  selectedMoviesDetailed.forEach((selected) => {
    const selectedTokens = new Set([
      ...tokenize(selected.overview),
      ...(selected.keywordNames ?? []).flatMap((keyword) => tokenize(keyword))
    ]);
    const selectedGenres = new Set(normalizeGenreIds(selected));
    const genreOverlap = Array.from(selectedGenres).filter((genreId) =>
      candidateGenres.has(genreId)
    ).length;
    const genreScore = selectedGenres.size ? genreOverlap / selectedGenres.size : 0;
    const tokenScore = overlapRatio(candidateTokens, selectedTokens);
    const score = genreScore * 0.65 + tokenScore * 0.35;
    if (score > bestScore) {
      bestScore = score;
      bestTitle = selected.title;
    }
  });

  return bestTitle;
}

function sortScoredCandidates(candidates: ScoredCandidate[]): ScoredCandidate[] {
  return candidates.slice().sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    const bHasPoster = b.movie.poster_path ? 1 : 0;
    const aHasPoster = a.movie.poster_path ? 1 : 0;
    if (bHasPoster !== aHasPoster) return bHasPoster - aHasPoster;
    if ((b.movie.vote_average ?? 0) !== (a.movie.vote_average ?? 0)) {
      return (b.movie.vote_average ?? 0) - (a.movie.vote_average ?? 0);
    }
    return (b.movie.vote_count ?? 0) - (a.movie.vote_count ?? 0);
  });
}

export function diversifyResults(candidates: ScoredCandidate[], limit: number): ScoredCandidate[] {
  const selected: ScoredCandidate[] = [];
  const franchiseCount = new Map<string, number>();
  const patternCount = new Map<string, number>();

  for (const candidate of candidates) {
    if (selected.length >= limit) break;
    const franchiseKey = getFranchiseKey(candidate.movie.title);
    const patternKey = getSubPatternKey(candidate.movie);
    const currentFranchise = franchiseCount.get(franchiseKey) ?? 0;
    const currentPattern = patternCount.get(patternKey) ?? 0;
    if (franchiseKey && currentFranchise >= 1) continue;
    if (currentPattern >= 2) continue;
    selected.push(candidate);
    franchiseCount.set(franchiseKey, currentFranchise + 1);
    patternCount.set(patternKey, currentPattern + 1);
  }

  return selected;
}

function logRecommendationRanking(candidates: ScoredCandidate[]): void {
  candidates.forEach((candidate, index) => {
    console.log(
      `[recommendation-ranking] rank=${index + 1} | title="${candidate.movie.title}" | finalScore=${candidate.finalScore.toFixed(4)}`
    );
  });
}

export function buildRecommendations(
  selectedMovies: SelectedMovie[],
  candidateMovies: TmdbMovie[],
  genreMap: Map<number, string>,
  selectedMoviesDetailed: TmdbMovie[],
  userProfileSignals?: UserProfileSignals,
  limit = 12,
  sessionTasteProfile?: SessionTasteProfile | null
): RecommendedMovie[] {
  const context = buildRecommendationContext(selectedMovies, selectedMoviesDetailed, userProfileSignals);

  const scored = candidateMovies
    .filter((movie) => !context.selectedIds.has(movie.id))
    .map((movie) => {
      const breakdown = computeSimilarityScore(movie, context);
      const candidateGenreIds = normalizeGenreIds(movie);
      const favoriteGenreIds = userProfileSignals?.favoriteGenreIds ?? [];
      const favoriteGenreBoost =
        favoriteGenreIds.length > 0
          ? clamp(
              favoriteGenreIds.filter((genreId) => candidateGenreIds.includes(genreId)).length /
                favoriteGenreIds.length
            ) * 0.04
          : 0;
      const languageBoost =
        userProfileSignals?.preferredLanguage &&
        movie.original_language?.toLowerCase() === userProfileSignals.preferredLanguage.toLowerCase()
          ? 0.02
          : 0;
      const finalScore = clamp(breakdown.total + favoriteGenreBoost + languageBoost);

      return {
        movie,
        finalScore,
        breakdown,
        badges: getRecommendationBadges(movie, breakdown)
      };
    })
    .filter((item) => !isIrrelevantCandidate(item.movie, item.breakdown))
    .filter((item) => item.finalScore >= 0.28);

  const tasteBlended = rankByTasteAndSimilarity(
    scored.map((item) => ({
      candidateId: item.movie.id,
      similarityScore: item.finalScore,
      movie: {
        mediaType: item.movie.media_type,
        genreIds: normalizeGenreIds(item.movie),
        releaseYear: toReleaseYear(item.movie.release_date),
        voteAverage: item.movie.vote_average,
        popularity: item.movie.popularity,
        originalLanguage: item.movie.original_language ?? null,
        toneHint: inferToneFromGenres(normalizeGenreIds(item.movie))
      }
    })),
    sessionTasteProfile
  );

  const blendedById = new Map<number, number>();
  tasteBlended.forEach((item) => {
    blendedById.set(item.candidateId, item.similarityScore);
  });
  const rescored = scored.map((item) => ({
    ...item,
    finalScore: blendedById.get(item.movie.id) ?? item.finalScore
  }));

  const ranked = sortScoredCandidates(rescored);
  const diversified = diversifyResults(ranked, limit);
  logRecommendationRanking(diversified);

  return diversified.map(({ movie, finalScore, breakdown, badges }) => {
    const genreIds = normalizeGenreIds(movie);
    const genres = genreIds.map((id) => genreMap.get(id)).filter(Boolean) as string[];
    const whyRecommended = buildRecommendationExplanation(movie, breakdown);
    const becauseYouLikedTitle = pickBecauseYouLikedTitle(movie, selectedMoviesDetailed);

    return {
      id: movie.id,
      mediaType: movie.media_type ?? selectedMovies[0]?.mediaType ?? "movie",
      title: movie.title,
      overview: movie.overview,
      posterPath: movie.poster_path,
      releaseYear: toReleaseYear(movie.release_date),
      genres,
      popularity: movie.popularity,
      voteAverage: movie.vote_average,
      recommendationScore: Number((finalScore * 100).toFixed(2)),
      whyRecommended,
      recommendationBadges: badges,
      becauseYouLikedTitle
    };
  });
}
