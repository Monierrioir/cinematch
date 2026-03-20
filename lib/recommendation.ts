import type { RecommendedMovie, SelectedMovie, TmdbMovie } from "@/lib/types";

const toReleaseYear = (releaseDate?: string): string => {
  if (!releaseDate) return "Unknown";
  return releaseDate.split("-")[0] || "Unknown";
};

const EAST_ASIAN_LANGUAGES = new Set(["ja", "ko", "zh", "cn"]);
const EAST_ASIAN_COUNTRIES = new Set(["JP", "KR", "CN", "TW", "HK"]);
const BROAD_GENRE_IDS = new Set([14, 18, 35, 10751]);
const ANIMATION_GENRE_ID = 16;
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
const MOOD_TERMS = [
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
  "tender"
];

const WEIGHTS = {
  genreSimilarity: 0.3,
  keywordThemeSimilarity: 0.24,
  overviewTextSimilarity: 0.18,
  languageStyleMatch: 0.14,
  yearProximity: 0.1,
  hiddenGemBonus: 0.04,
  singleReferenceBoost: 0.12
} as const;

type SingleReferenceProfile = {
  genreIds: Set<number>;
  keywordSet: Set<string>;
  moodSet: Set<string>;
  overviewTokenSet: Set<string>;
  language: string | null;
  isAnimation: boolean;
  isEastAsian: boolean;
  year: number | null;
};

type TasteProfile = {
  genreWeights: Map<number, number>;
  dominantLanguage: string | null;
  preferredCountries: Set<string>;
  animationRatio: number;
  prefersEastAsianAnimation: boolean;
  avgYear: number | null;
  avgPopularity: number;
  keywordSet: Set<string>;
  moodSet: Set<string>;
  overviewTokenSet: Set<string>;
  selectedCount: number;
  singleReference: SingleReferenceProfile | null;
};

type FeatureBreakdown = {
  genreSimilarity: number;
  keywordThemeSimilarity: number;
  overviewTextSimilarity: number;
  languageStyleMatch: number;
  formatMatch: number;
  yearProximity: number;
  hiddenGemBonus: number;
  moodSimilarity: number;
  singleReferenceMatch: number;
  penalties: number;
};

type ScoredCandidate = {
  movie: TmdbMovie;
  finalScore: number;
  breakdown: FeatureBreakdown;
};

export type UserProfileSignals = {
  preferredMediaType?: "movie" | "tv" | null;
  favoriteGenreIds?: number[];
  preferredLanguage?: string | null;
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

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

function isAnimation(movie: TmdbMovie): boolean {
  const genreIds = movie.genre_ids ?? movie.genres?.map((genre) => genre.id) ?? [];
  return genreIds.includes(ANIMATION_GENRE_ID);
}

function isEastAsianMovie(movie: TmdbMovie): boolean {
  const language = movie.original_language?.toLowerCase() ?? "";
  if (EAST_ASIAN_LANGUAGES.has(language)) return true;
  const countries = movie.production_countries?.map((country) => country.iso_3166_1) ?? [];
  return countries.some((country) => EAST_ASIAN_COUNTRIES.has(country));
}

function normalizeGenreIds(movie: TmdbMovie): number[] {
  return movie.genre_ids ?? movie.genres?.map((genre) => genre.id) ?? [];
}

function pickBecauseYouLikedTitle(candidate: TmdbMovie, selectedMoviesDetailed: TmdbMovie[]): string | undefined {
  if (!selectedMoviesDetailed.length) return undefined;
  const candidateGenres = new Set(normalizeGenreIds(candidate));
  let bestTitle = selectedMoviesDetailed[0]?.title;
  let bestScore = -1;

  selectedMoviesDetailed.forEach((selected) => {
    const selectedGenres = normalizeGenreIds(selected);
    const overlap = selectedGenres.reduce(
      (count, genreId) => (candidateGenres.has(genreId) ? count + 1 : count),
      0
    );
    if (overlap > bestScore) {
      bestScore = overlap;
      bestTitle = selected.title;
    }
  });

  return bestTitle;
}

function buildTasteProfile(selectedMovies: TmdbMovie[]): TasteProfile {
  const genreCounts = new Map<number, number>();
  const languageCounts = new Map<string, number>();
  const countryCounts = new Map<string, number>();
  const keywordSet = new Set<string>();
  const moodSet = new Set<string>();
  const overviewTokenSet = new Set<string>();

  let animationCount = 0;
  let eastAsianAnimationCount = 0;
  let yearTotal = 0;
  let yearCount = 0;
  let popularityTotal = 0;

  selectedMovies.forEach((movie) => {
    const genreIds = normalizeGenreIds(movie);
    genreIds.forEach((genreId) => {
      const broadMultiplier = BROAD_GENRE_IDS.has(genreId) ? 0.45 : 1;
      genreCounts.set(genreId, (genreCounts.get(genreId) ?? 0) + broadMultiplier);
    });

    const language = movie.original_language?.toLowerCase();
    if (language) languageCounts.set(language, (languageCounts.get(language) ?? 0) + 1);

    movie.production_countries?.forEach((country) => {
      countryCounts.set(country.iso_3166_1, (countryCounts.get(country.iso_3166_1) ?? 0) + 1);
    });

    const tokens = new Set([
      ...tokenize(movie.overview),
      ...(movie.keywordNames ?? []).flatMap((keyword) => tokenize(keyword))
    ]);
    tokens.forEach((token) => {
      keywordSet.add(token);
      overviewTokenSet.add(token);
      if (MOOD_TERMS.includes(token)) moodSet.add(token);
    });

    if (isAnimation(movie)) {
      animationCount += 1;
      if (isEastAsianMovie(movie)) eastAsianAnimationCount += 1;
    }

    const year = toNumberYear(movie.release_date);
    if (year) {
      yearTotal += year;
      yearCount += 1;
    }

    popularityTotal += movie.popularity || 0;
  });

  const totalGenreWeight = Array.from(genreCounts.values()).reduce((sum, count) => sum + count, 0) || 1;
  const genreWeights = new Map(
    Array.from(genreCounts.entries()).map(([genreId, count]) => [genreId, count / totalGenreWeight])
  );

  const dominantLanguage =
    Array.from(languageCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const preferredCountries = new Set(
    Array.from(countryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([country]) => country)
  );

  const animationRatio = selectedMovies.length ? animationCount / selectedMovies.length : 0;
  const eastAsianAnimationRatio = selectedMovies.length ? eastAsianAnimationCount / selectedMovies.length : 0;
  const singleMovie = selectedMovies.length === 1 ? selectedMovies[0] : null;
  const singleReference: SingleReferenceProfile | null = singleMovie
    ? {
        genreIds: new Set(normalizeGenreIds(singleMovie)),
        keywordSet: new Set((singleMovie.keywordNames ?? []).flatMap((keyword) => tokenize(keyword))),
        moodSet: new Set(tokenize(singleMovie.overview).filter((token) => MOOD_TERMS.includes(token))),
        overviewTokenSet: new Set(tokenize(singleMovie.overview)),
        language: singleMovie.original_language?.toLowerCase() ?? null,
        isAnimation: isAnimation(singleMovie),
        isEastAsian: isEastAsianMovie(singleMovie),
        year: toNumberYear(singleMovie.release_date)
      }
    : null;

  return {
    genreWeights,
    dominantLanguage,
    preferredCountries,
    animationRatio,
    prefersEastAsianAnimation: eastAsianAnimationRatio >= 0.5,
    avgYear: yearCount ? yearTotal / yearCount : null,
    avgPopularity: selectedMovies.length ? popularityTotal / selectedMovies.length : 0,
    keywordSet,
    moodSet,
    overviewTokenSet,
    selectedCount: selectedMovies.length,
    singleReference
  };
}

function overlapRatio(candidate: Set<string>, profile: Set<string>): number {
  if (!candidate.size || !profile.size) return 0;
  let overlap = 0;
  candidate.forEach((token) => {
    if (profile.has(token)) overlap += 1;
  });
  return clamp(overlap / Math.max(1, Math.min(candidate.size, profile.size)));
}

function scoreCandidate(
  candidate: TmdbMovie,
  profile: TasteProfile
): { total: number; breakdown: FeatureBreakdown } {
  const candidateTokens = new Set([
    ...tokenize(candidate.overview),
    ...(candidate.keywordNames ?? []).flatMap((keyword) => tokenize(keyword))
  ]);
  const candidateMoodTokens = new Set(Array.from(candidateTokens).filter((token) => MOOD_TERMS.includes(token)));

  const keywordSimilarity = overlapRatio(candidateTokens, profile.keywordSet);
  const moodSimilarity = overlapRatio(candidateMoodTokens, profile.moodSet);
  const overviewSimilarity = overlapRatio(candidateTokens, profile.overviewTokenSet);

  const candidateAnimation = isAnimation(candidate);
  const candidateEastAsian = isEastAsianMovie(candidate);
  let formatMatch =
    profile.animationRatio >= 0.65
      ? candidateAnimation
        ? 1
        : 0.05
      : profile.animationRatio <= 0.35
        ? candidateAnimation
          ? 0.45
          : 1
        : candidateAnimation
          ? 0.85
          : 0.75;

  if (profile.prefersEastAsianAnimation && candidateAnimation && candidateEastAsian) {
    formatMatch = clamp(formatMatch + 0.25);
  }

  const language = candidate.original_language?.toLowerCase() ?? "";
  const languageScore = profile.dominantLanguage
    ? language === profile.dominantLanguage
      ? 1
      : EAST_ASIAN_LANGUAGES.has(language) && EAST_ASIAN_LANGUAGES.has(profile.dominantLanguage)
        ? 0.65
        : 0.2
    : 0.5;
  const countryCodes = candidate.production_countries?.map((country) => country.iso_3166_1) ?? [];
  const countryScore =
    countryCodes.some((country) => profile.preferredCountries.has(country))
      ? 1
      : countryCodes.some((country) => EAST_ASIAN_COUNTRIES.has(country)) &&
          Array.from(profile.preferredCountries).some((country) => EAST_ASIAN_COUNTRIES.has(country))
        ? 0.7
        : 0.25;
  const languageStyleMatch = clamp(languageScore * 0.6 + countryScore * 0.4);

  const genreIds = normalizeGenreIds(candidate);
  const genreSimilarityRaw = Array.from(profile.genreWeights.entries()).reduce((score, [genreId, weight]) => {
    if (genreIds.includes(genreId)) return score + weight;
    return score;
  }, 0);
  const genreSimilarity = clamp(genreSimilarityRaw);

  const candidateYear = toNumberYear(candidate.release_date);
  const yearProximity =
    candidateYear && profile.avgYear
      ? clamp(1 - Math.min(Math.abs(candidateYear - profile.avgYear), 30) / 30)
      : 0.5;

  const hiddenGemBase = clamp(1 - Math.min(candidate.popularity, 120) / 120);
  const hiddenGemDistance = profile.avgPopularity
    ? clamp(1 - Math.abs(candidate.popularity - profile.avgPopularity) / 100)
    : 0.5;
  // Build a core relevance score first; hidden-gem is a small bonus gated by this relevance.
  const styleMatch = clamp(languageStyleMatch * 0.82 + formatMatch * 0.18);
  const coreRelevance =
    genreSimilarity * WEIGHTS.genreSimilarity +
    keywordSimilarity * WEIGHTS.keywordThemeSimilarity +
    overviewSimilarity * WEIGHTS.overviewTextSimilarity +
    styleMatch * WEIGHTS.languageStyleMatch +
    yearProximity * WEIGHTS.yearProximity;
  const hiddenGemRaw = clamp(hiddenGemBase * 0.65 + hiddenGemDistance * 0.35);
  const relevanceGate = clamp((coreRelevance - 0.2) / 0.8);
  const hiddenGemBonus = clamp(hiddenGemRaw * relevanceGate);
  let singleReferenceMatch = 0;

  if (profile.singleReference) {
    const candidateGenres = new Set(genreIds);
    const refGenreOverlapCount = Array.from(profile.singleReference.genreIds).filter((id) =>
      candidateGenres.has(id)
    ).length;
    const refGenreSimilarity = profile.singleReference.genreIds.size
      ? clamp(refGenreOverlapCount / profile.singleReference.genreIds.size)
      : 0;
    const refKeywordSimilarity = overlapRatio(candidateTokens, profile.singleReference.keywordSet);
    const refOverviewSimilarity = overlapRatio(candidateTokens, profile.singleReference.overviewTokenSet);
    const refMoodSimilarity = overlapRatio(candidateMoodTokens, profile.singleReference.moodSet);
    const refLanguageStyle =
      profile.singleReference.language && language === profile.singleReference.language
        ? 1
        : profile.singleReference.language &&
            EAST_ASIAN_LANGUAGES.has(profile.singleReference.language) &&
            EAST_ASIAN_LANGUAGES.has(language)
          ? 0.68
          : 0.22;
    const refFormat =
      profile.singleReference.isAnimation === candidateAnimation
        ? 1
        : profile.singleReference.isAnimation
          ? 0.05
          : 0.4;
    const refYearProximity =
      profile.singleReference.year && candidateYear
        ? clamp(1 - Math.min(Math.abs(candidateYear - profile.singleReference.year), 26) / 26)
        : 0.5;
    const eastAsianStyleBonus =
      profile.singleReference.isAnimation && profile.singleReference.isEastAsian && candidateAnimation && candidateEastAsian
        ? 0.08
        : 0;

    singleReferenceMatch = clamp(
      refGenreSimilarity * 0.24 +
        refKeywordSimilarity * 0.18 +
        refOverviewSimilarity * 0.18 +
        refMoodSimilarity * 0.12 +
        refLanguageStyle * 0.14 +
        refFormat * 0.1 +
        refYearProximity * 0.04 +
        eastAsianStyleBonus
    );
  }

  let penalties = 0;
  if (profile.animationRatio >= 0.7 && !candidateAnimation) penalties += 0.25;
  if (profile.animationRatio <= 0.25 && candidateAnimation) penalties += 0.08;
  if (keywordSimilarity < 0.16 && overviewSimilarity < 0.16 && genreSimilarity > 0.35) penalties += 0.14;
  if (profile.prefersEastAsianAnimation && !(candidateAnimation && candidateEastAsian)) penalties += 0.12;
  if (profile.dominantLanguage && languageScore <= 0.2 && genreSimilarity <= 0.28) penalties += 0.1;
  if (moodSimilarity < 0.14 && overviewSimilarity < 0.2) penalties += 0.08;
  if (profile.singleReference) {
    if (singleReferenceMatch < 0.3) penalties += 0.16;
    if (profile.singleReference.isAnimation && !candidateAnimation) penalties += 0.2;
    if (
      profile.singleReference.language &&
      language !== profile.singleReference.language &&
      profile.singleReference.isAnimation === candidateAnimation
    ) {
      penalties += 0.1;
    }
  }

  const weightedScore =
    coreRelevance +
    hiddenGemBonus * WEIGHTS.hiddenGemBonus +
    singleReferenceMatch * (profile.selectedCount === 1 ? WEIGHTS.singleReferenceBoost : 0);

  return {
    total: clamp(weightedScore - penalties),
    breakdown: {
      genreSimilarity,
      keywordThemeSimilarity: keywordSimilarity,
      overviewTextSimilarity: overviewSimilarity,
      languageStyleMatch: styleMatch,
      formatMatch,
      yearProximity,
      hiddenGemBonus,
      moodSimilarity,
      singleReferenceMatch,
      penalties
    }
  };
}

function buildWhyRecommendedText(candidate: TmdbMovie, breakdown: FeatureBreakdown): string {
  const reasons: string[] = [];

  if (breakdown.keywordThemeSimilarity >= 0.45 || breakdown.overviewTextSimilarity >= 0.45) {
    reasons.push("it closely matches your themes and narrative style");
  }
  if (breakdown.moodSimilarity >= 0.4) reasons.push("it reflects a similar emotional tone");
  if (breakdown.formatMatch >= 0.75) {
    reasons.push(
      isAnimation(candidate)
        ? "it aligns with your animation style preference"
        : "its format matches the style you usually select"
    );
  }
  if (breakdown.languageStyleMatch >= 0.65) {
    reasons.push("its language and regional style are close to your taste");
  }
  if (breakdown.genreSimilarity >= 0.35) {
    reasons.push("it shares your core genres without relying on broad overlap only");
  }
  if (breakdown.hiddenGemBonus >= 0.45) {
    reasons.push("it has hidden-gem potential while staying relevant to your taste");
  }
  if (breakdown.singleReferenceMatch >= 0.52) {
    reasons.push("it closely matches the tone and style of your selected film");
  }

  if (reasons.length === 0) {
    reasons.push("it balances style similarity with hidden-gem potential better than generic genre-only matches");
  }

  return `This movie is recommended because ${reasons.slice(0, 3).join(", ")}.`;
}

function sortScoredCandidatesByFinalScore(candidates: ScoredCandidate[]): ScoredCandidate[] {
  // Always sort descending by finalScore so best recommendation is first.
  return candidates.slice().sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    const aHasPoster = a.movie.poster_path ? 1 : 0;
    const bHasPoster = b.movie.poster_path ? 1 : 0;
    if (bHasPoster !== aHasPoster) return bHasPoster - aHasPoster;
    if ((b.movie.vote_average ?? 0) !== (a.movie.vote_average ?? 0)) {
      return (b.movie.vote_average ?? 0) - (a.movie.vote_average ?? 0);
    }
    return (b.movie.popularity ?? 0) - (a.movie.popularity ?? 0);
  });
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
  limit = 12
): RecommendedMovie[] {
  const profile = buildTasteProfile(selectedMoviesDetailed);
  const selectedIdSet = new Set(selectedMovies.map((movie) => movie.id));

  // Weighted recommendation model:
  // - genre similarity: 24%
  // - keyword/theme similarity: 20%
  // - overview text similarity: 14%
  // - language/style match (includes format): 14%
  // - release-year proximity: 10%
  // - hidden-gem bonus (relevance-gated): 4%
  // Plus penalties for style mismatches.
  const scored = candidateMovies
    .filter((movie) => !selectedIdSet.has(movie.id))
    .map((movie) => {
      const { total, breakdown } = scoreCandidate(movie, profile);
      const candidateGenreIds = normalizeGenreIds(movie);
      const favoriteGenreIds = userProfileSignals?.favoriteGenreIds ?? [];
      const favoriteGenreOverlap =
        favoriteGenreIds.length > 0
          ? favoriteGenreIds.filter((genreId) => candidateGenreIds.includes(genreId)).length /
            favoriteGenreIds.length
          : 0;
      const languageProfileBoost =
        userProfileSignals?.preferredLanguage &&
        movie.original_language?.toLowerCase() === userProfileSignals.preferredLanguage.toLowerCase()
          ? 0.03
          : 0;
      const profileBoost = clamp(favoriteGenreOverlap * 0.04 + languageProfileBoost, 0, 0.08);

      return {
        movie,
        finalScore: clamp(total + profileBoost),
        breakdown
      };
    })
    .filter((item) => item.finalScore > 0.22);

  const sortedScored = sortScoredCandidatesByFinalScore(scored)
    .slice(0, limit);

  logRecommendationRanking(sortedScored);

  return sortedScored.map(({ movie, finalScore, breakdown }) => {
    const genreIds = movie.genre_ids ?? movie.genres?.map((g) => g.id) ?? [];
    const genres = genreIds.map((id) => genreMap.get(id)).filter(Boolean) as string[];
    const whyRecommended = buildWhyRecommendedText(movie, breakdown);
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
      becauseYouLikedTitle
    };
  });
}
