import type { MediaType } from "@/lib/types";

export const CINEMATCH_TRACKING_KEY = "cinematch_tracking_v1";

export type TrackableTitleInput = {
  id: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  genres: string[];
  genreIds?: number[];
  releaseDate: string;
  popularity?: number;
  voteAverage?: number;
  originalLanguage?: string | null;
};

export type TrackedTitle = TrackableTitleInput & {
  key: string;
  createdAt: string;
  updatedAt: string;
};

export type WatchedRecord = TrackedTitle & {
  watchedDate: string;
  watchHistory: string[];
  rewatchCount: number;
  userRating?: number;
};

export type CustomList = {
  id: string;
  name: string;
  items: TrackedTitle[];
  createdAt: string;
  updatedAt: string;
};

export type TrackingActivity = {
  type:
    | "watched_add"
    | "watched_remove"
    | "watchlist_add"
    | "watchlist_remove"
    | "rating_update"
    | "list_create"
    | "list_delete"
    | "list_update";
  key?: string;
  mediaType?: MediaType;
  at: string;
};

export type TrackingStore = {
  version: 1;
  userId?: string | null;
  watched: Record<string, WatchedRecord>;
  watchlist: Record<string, TrackedTitle>;
  ratings: Record<string, number>;
  customLists: CustomList[];
  activity: TrackingActivity[];
  createdAt: string;
  updatedAt: string;
};

export type UserStats = {
  totalWatchedCount: number;
  watchedMoviesCount: number;
  watchedSeriesCount: number;
  totalRatingsSubmitted: number;
  topGenres: Array<{ genre: string; count: number }>;
  topReleaseDecades: Array<{ decade: string; count: number }>;
  mostActiveMonth: string | null;
  averageUserRating: number | null;
  averageReleaseYear: number | null;
  averageContentAge: number | null;
  oldestWatchedTitle: WatchedRecord | null;
  newestWatchedTitle: WatchedRecord | null;
  rewatchCount: number;
  mostWatchedGenre: string | null;
  highestRatedGenre: string | null;
  classicsPercentage: number;
  modernPercentage: number;
  favoriteEra: string | null;
};

export type YearlyRecap = {
  year: number;
  totalTitlesWatched: number;
  moviesCount: number;
  seriesCount: number;
  topGenres: Array<{ genre: string; count: number }>;
  averageRating: number | null;
  averageReleaseYear: number | null;
  averageContentAge: number | null;
  oldestTitle: WatchedRecord | null;
  newestTitle: WatchedRecord | null;
  mostWatchedMonth: string | null;
  rewatches: number;
  favoriteContentType: "movie" | "tv" | "balanced";
  hiddenGemCount: number;
  timelineByMonth: Array<{ month: string; count: number }>;
  topRatedTitles: WatchedRecord[];
  summary: string;
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function nowIso(): string {
  return new Date().toISOString();
}

function toKey(mediaType: MediaType, id: number): string {
  return `${mediaType}:${id}`;
}

function parseYear(value?: string): number | null {
  if (!value) return null;
  const year = Number(value.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

function toMonthKey(dateIso: string): string {
  const date = new Date(dateIso);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function createEmptyStore(): TrackingStore {
  const now = nowIso();
  return {
    version: 1,
    watched: {},
    watchlist: {},
    ratings: {},
    customLists: [
      {
        id: "favorites",
        name: "Favorites",
        items: [],
        createdAt: now,
        updatedAt: now
      }
    ],
    activity: [],
    createdAt: now,
    updatedAt: now
  };
}

function safeParseStore(raw: string | null): TrackingStore | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TrackingStore;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.version !== 1) return null;
    return {
      ...createEmptyStore(),
      ...parsed
    };
  } catch {
    return null;
  }
}

export function loadTrackingStore(): TrackingStore {
  if (typeof window === "undefined") return createEmptyStore();
  const raw = window.localStorage.getItem(CINEMATCH_TRACKING_KEY);
  return safeParseStore(raw) ?? createEmptyStore();
}

export function saveTrackingStore(store: TrackingStore): TrackingStore {
  const next = {
    ...store,
    updatedAt: nowIso()
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(CINEMATCH_TRACKING_KEY, JSON.stringify(next));
  }
  return next;
}

function toTrackedTitle(input: TrackableTitleInput, existing?: TrackedTitle): TrackedTitle {
  const now = nowIso();
  return {
    ...input,
    key: toKey(input.mediaType, input.id),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
}

function pushActivity(store: TrackingStore, activity: TrackingActivity): TrackingStore {
  return {
    ...store,
    activity: [...store.activity.slice(-699), activity]
  };
}

export function saveWatchedItem(
  input: TrackableTitleInput,
  options?: { watchedDate?: string; rewatch?: boolean }
): TrackingStore {
  const store = loadTrackingStore();
  const key = toKey(input.mediaType, input.id);
  const watchedDate = options?.watchedDate || nowIso().slice(0, 10);
  const existing = store.watched[key];
  const base = toTrackedTitle(input, existing);
  const existingHistory = existing?.watchHistory ?? [];
  const isRepeat = Boolean(existing) || Boolean(options?.rewatch);
  const watchHistory = [...existingHistory, watchedDate];
  const nextRecord: WatchedRecord = {
    ...base,
    watchedDate,
    watchHistory,
    rewatchCount: Math.max(0, watchHistory.length - 1),
    userRating: existing?.userRating ?? store.ratings[key]
  };

  let next: TrackingStore = {
    ...store,
    watched: {
      ...store.watched,
      [key]: nextRecord
    },
    watchlist: Object.fromEntries(Object.entries(store.watchlist).filter(([entryKey]) => entryKey !== key))
  };
  next = pushActivity(next, {
    type: "watched_add",
    key,
    mediaType: input.mediaType,
    at: nowIso()
  });
  if (isRepeat) {
    next = pushActivity(next, {
      type: "watched_add",
      key,
      mediaType: input.mediaType,
      at: nowIso()
    });
  }
  return saveTrackingStore(next);
}

export function removeWatchedStatus(mediaType: MediaType, id: number): TrackingStore {
  const store = loadTrackingStore();
  const key = toKey(mediaType, id);
  const next: TrackingStore = {
    ...store,
    watched: Object.fromEntries(Object.entries(store.watched).filter(([entryKey]) => entryKey !== key))
  };
  return saveTrackingStore(
    pushActivity(next, {
      type: "watched_remove",
      key,
      mediaType,
      at: nowIso()
    })
  );
}

export function updateRating(
  mediaType: MediaType,
  id: number,
  rating: number | null
): TrackingStore {
  const store = loadTrackingStore();
  const key = toKey(mediaType, id);
  const normalized = rating === null ? null : clamp(rating / 5, 0.1, 1) * 5;
  const ratings = { ...store.ratings };
  if (normalized === null) {
    delete ratings[key];
  } else {
    ratings[key] = Number(normalized.toFixed(1));
  }
  const watchedItem = store.watched[key];
  const watched =
    watchedItem && normalized !== null
      ? {
          ...store.watched,
          [key]: {
            ...watchedItem,
            userRating: Number(normalized.toFixed(1)),
            updatedAt: nowIso()
          }
        }
      : store.watched;

  const next: TrackingStore = {
    ...store,
    ratings,
    watched
  };
  return saveTrackingStore(
    pushActivity(next, {
      type: "rating_update",
      key,
      mediaType,
      at: nowIso()
    })
  );
}

export function toggleWatchlist(input: TrackableTitleInput): { store: TrackingStore; inWatchlist: boolean } {
  const store = loadTrackingStore();
  const key = toKey(input.mediaType, input.id);
  const exists = Boolean(store.watchlist[key]);
  const nextWatchlist = { ...store.watchlist };
  let next: TrackingStore = store;
  if (exists) {
    delete nextWatchlist[key];
    next = {
      ...store,
      watchlist: nextWatchlist
    };
    next = pushActivity(next, { type: "watchlist_remove", key, mediaType: input.mediaType, at: nowIso() });
  } else {
    next = {
      ...store,
      watchlist: {
        ...store.watchlist,
        [key]: toTrackedTitle(input, store.watchlist[key])
      }
    };
    next = pushActivity(next, { type: "watchlist_add", key, mediaType: input.mediaType, at: nowIso() });
  }
  return {
    store: saveTrackingStore(next),
    inWatchlist: !exists
  };
}

export function createCustomList(name: string): TrackingStore {
  const cleanName = name.trim();
  if (!cleanName) return loadTrackingStore();
  const store = loadTrackingStore();
  const now = nowIso();
  const next: TrackingStore = {
    ...store,
    customLists: [
      ...store.customLists,
      {
        id: `list_${Date.now()}`,
        name: cleanName,
        items: [],
        createdAt: now,
        updatedAt: now
      }
    ]
  };
  return saveTrackingStore(
    pushActivity(next, {
      type: "list_create",
      at: now
    })
  );
}

export function renameCustomList(listId: string, name: string): TrackingStore {
  const cleanName = name.trim();
  if (!cleanName) return loadTrackingStore();
  const store = loadTrackingStore();
  const next: TrackingStore = {
    ...store,
    customLists: store.customLists.map((list) =>
      list.id === listId ? { ...list, name: cleanName, updatedAt: nowIso() } : list
    )
  };
  return saveTrackingStore(next);
}

export function deleteCustomList(listId: string): TrackingStore {
  const store = loadTrackingStore();
  const next: TrackingStore = {
    ...store,
    customLists: store.customLists.filter((list) => list.id !== listId)
  };
  return saveTrackingStore(
    pushActivity(next, {
      type: "list_delete",
      at: nowIso()
    })
  );
}

export function addToCustomList(listId: string, input: TrackableTitleInput): TrackingStore {
  const store = loadTrackingStore();
  const tracked = toTrackedTitle(input);
  const next: TrackingStore = {
    ...store,
    customLists: store.customLists.map((list) => {
      if (list.id !== listId) return list;
      if (list.items.some((item) => item.key === tracked.key)) return list;
      return {
        ...list,
        items: [...list.items, tracked],
        updatedAt: nowIso()
      };
    })
  };
  return saveTrackingStore(
    pushActivity(next, {
      type: "list_update",
      key: tracked.key,
      mediaType: tracked.mediaType,
      at: nowIso()
    })
  );
}

export function removeFromCustomList(listId: string, mediaType: MediaType, id: number): TrackingStore {
  const store = loadTrackingStore();
  const key = toKey(mediaType, id);
  const next: TrackingStore = {
    ...store,
    customLists: store.customLists.map((list) =>
      list.id === listId
        ? { ...list, items: list.items.filter((item) => item.key !== key), updatedAt: nowIso() }
        : list
    )
  };
  return saveTrackingStore(next);
}

export function moveWatchlistToWatched(
  mediaType: MediaType,
  id: number,
  watchedDate?: string
): TrackingStore {
  const store = loadTrackingStore();
  const key = toKey(mediaType, id);
  const item = store.watchlist[key];
  if (!item) return store;
  saveWatchedItem(item, { watchedDate });
  return loadTrackingStore();
}

export function calculateContentAge(releaseDate: string, watchedDate: string): number | null {
  const releaseYear = parseYear(releaseDate);
  const watchedYear = parseYear(watchedDate);
  if (!releaseYear || !watchedYear) return null;
  return Math.max(0, watchedYear - releaseYear);
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function computeGenreStats(watched: WatchedRecord[]) {
  const genreCounts = new Map<string, number>();
  const genreRatings = new Map<string, number[]>();
  watched.forEach((item) => {
    item.genres.forEach((genre) => {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
      if (item.userRating !== undefined) {
        const list = genreRatings.get(genre) ?? [];
        list.push(item.userRating);
        genreRatings.set(genre, list);
      }
    });
  });
  const topGenres = Array.from(genreCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([genre, count]) => ({ genre, count }));
  const mostWatchedGenre = topGenres[0]?.genre ?? null;
  const highestRatedGenre =
    Array.from(genreRatings.entries())
      .map(([genre, ratings]) => ({ genre, avg: average(ratings) ?? 0 }))
      .sort((a, b) => b.avg - a.avg)[0]?.genre ?? null;
  return { topGenres, mostWatchedGenre, highestRatedGenre };
}

export function getUserStats(storeInput?: TrackingStore): UserStats {
  const store = storeInput ?? loadTrackingStore();
  const watched = Object.values(store.watched);
  const watchedMovies = watched.filter((item) => item.mediaType === "movie");
  const watchedSeries = watched.filter((item) => item.mediaType === "tv");
  const ratingValues = Object.values(store.ratings);

  const decades = new Map<string, number>();
  watched.forEach((item) => {
    const year = parseYear(item.releaseDate);
    if (!year) return;
    const decadeKey = `${Math.floor(year / 10) * 10}s`;
    decades.set(decadeKey, (decades.get(decadeKey) ?? 0) + 1);
  });
  const topReleaseDecades = Array.from(decades.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([decade, count]) => ({ decade, count }));
  const favoriteEra = topReleaseDecades[0]?.decade ?? null;

  const monthCounts = new Map<string, number>();
  watched.forEach((item) => {
    const month = toMonthKey(item.watchedDate);
    monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
  });
  const mostActiveMonth =
    Array.from(monthCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const releaseYears = watched.map((item) => parseYear(item.releaseDate)).filter((value): value is number => Boolean(value));
  const avgReleaseYear = average(releaseYears);
  const contentAges = watched
    .map((item) => calculateContentAge(item.releaseDate, item.watchedDate))
    .filter((value): value is number => value !== null);
  const averageContentAge = average(contentAges);
  const classicsCount = watched.filter((item) => {
    const year = parseYear(item.releaseDate);
    return year !== null && year <= 1999;
  }).length;
  const modernCount = watched.filter((item) => {
    const year = parseYear(item.releaseDate);
    return year !== null && year >= 2010;
  }).length;

  const oldestWatchedTitle =
    watched
      .slice()
      .sort((a, b) => (parseYear(a.releaseDate) ?? 9999) - (parseYear(b.releaseDate) ?? 9999))[0] ?? null;
  const newestWatchedTitle =
    watched
      .slice()
      .sort((a, b) => (parseYear(b.releaseDate) ?? 0) - (parseYear(a.releaseDate) ?? 0))[0] ?? null;

  const rewatchCount = watched.reduce((sum, item) => sum + item.rewatchCount, 0);
  const { topGenres, mostWatchedGenre, highestRatedGenre } = computeGenreStats(watched);

  return {
    totalWatchedCount: watched.length,
    watchedMoviesCount: watchedMovies.length,
    watchedSeriesCount: watchedSeries.length,
    totalRatingsSubmitted: ratingValues.length,
    topGenres,
    topReleaseDecades,
    mostActiveMonth,
    averageUserRating: average(ratingValues),
    averageReleaseYear: avgReleaseYear,
    averageContentAge,
    oldestWatchedTitle,
    newestWatchedTitle,
    rewatchCount,
    mostWatchedGenre,
    highestRatedGenre,
    classicsPercentage: watched.length ? Number(((classicsCount / watched.length) * 100).toFixed(1)) : 0,
    modernPercentage: watched.length ? Number(((modernCount / watched.length) * 100).toFixed(1)) : 0,
    favoriteEra
  };
}

function buildYearSummary(recap: Omit<YearlyRecap, "summary">): string {
  if (recap.totalTitlesWatched === 0) return "No tracked viewing data for this year yet.";
  const parts: string[] = [];
  if (recap.topGenres[0]) parts.push(`you leaned into ${recap.topGenres[0].genre.toLowerCase()} stories`);
  if (recap.averageContentAge !== null && recap.averageContentAge >= 15) {
    parts.push("you watched older films more than recent releases");
  } else if (recap.averageContentAge !== null && recap.averageContentAge <= 5) {
    parts.push("you stayed close to newer releases");
  }
  if (recap.rewatches >= 3) parts.push("you revisited your favorites multiple times");
  if (recap.hiddenGemCount >= 4) parts.push("you uncovered several hidden gems");
  return `Your year in cinema: ${parts.slice(0, 3).join(", ")}.`;
}

export function getYearlyRecap(year: number, storeInput?: TrackingStore): YearlyRecap {
  const store = storeInput ?? loadTrackingStore();
  const watched = Object.values(store.watched).filter((item) => {
    const watchedYear = parseYear(item.watchedDate);
    return watchedYear === year;
  });
  const moviesCount = watched.filter((item) => item.mediaType === "movie").length;
  const seriesCount = watched.filter((item) => item.mediaType === "tv").length;
  const { topGenres } = computeGenreStats(watched);
  const averageRating = average(watched.map((item) => item.userRating).filter((v): v is number => v !== undefined));
  const averageReleaseYear = average(
    watched.map((item) => parseYear(item.releaseDate)).filter((v): v is number => v !== null)
  );
  const averageContentAge = average(
    watched
      .map((item) => calculateContentAge(item.releaseDate, item.watchedDate))
      .filter((v): v is number => v !== null)
  );
  const oldestTitle =
    watched
      .slice()
      .sort((a, b) => (parseYear(a.releaseDate) ?? 9999) - (parseYear(b.releaseDate) ?? 9999))[0] ?? null;
  const newestTitle =
    watched
      .slice()
      .sort((a, b) => (parseYear(b.releaseDate) ?? 0) - (parseYear(a.releaseDate) ?? 0))[0] ?? null;
  const monthMap = new Map<string, number>();
  watched.forEach((item) => {
    const month = toMonthKey(item.watchedDate);
    monthMap.set(month, (monthMap.get(month) ?? 0) + 1);
  });
  const timelineByMonth = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, count]) => ({ month, count }));
  const mostWatchedMonth =
    Array.from(monthMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const rewatches = watched.reduce((sum, item) => sum + item.rewatchCount, 0);
  const favoriteContentType: "movie" | "tv" | "balanced" =
    moviesCount === seriesCount ? "balanced" : moviesCount > seriesCount ? "movie" : "tv";
  const hiddenGemCount = watched.filter(
    (item) => (item.userRating ?? 0) >= 4 && (item.popularity ?? 999) <= 35
  ).length;
  const topRatedTitles = watched
    .filter((item) => item.userRating !== undefined)
    .sort((a, b) => (b.userRating ?? 0) - (a.userRating ?? 0))
    .slice(0, 6);

  const recapWithoutSummary: Omit<YearlyRecap, "summary"> = {
    year,
    totalTitlesWatched: watched.length,
    moviesCount,
    seriesCount,
    topGenres,
    averageRating,
    averageReleaseYear,
    averageContentAge,
    oldestTitle,
    newestTitle,
    mostWatchedMonth,
    rewatches,
    favoriteContentType,
    hiddenGemCount,
    timelineByMonth,
    topRatedTitles
  };

  return {
    ...recapWithoutSummary,
    summary: buildYearSummary(recapWithoutSummary)
  };
}
