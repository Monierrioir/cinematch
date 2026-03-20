"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import RevealSection from "@/components/RevealSection";
import { getPosterUrl } from "@/lib/image";
import { CINEMATCH_SELECTED_MOVIES_KEY } from "@/lib/storage";
import type { MediaType, SelectedMovie } from "@/lib/types";

type DiscoverMovie = {
  id: number;
  title: string;
  mediaType: MediaType;
  posterPath: string | null;
  releaseYear: string;
  voteAverage: number;
  voteCount: number;
  genreIds: number[];
};

type PosterPickCardProps = {
  movie: DiscoverMovie;
  selected: boolean;
  animateSelect?: boolean;
  onToggle: (movie: DiscoverMovie) => void;
};

function toSafeMediaType(value: unknown): MediaType {
  return value === "tv" ? "tv" : "movie";
}

function PosterPickCard({ movie, selected, animateSelect = false, onToggle }: PosterPickCardProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(movie)}
      className="group text-left"
      aria-pressed={selected}
      aria-label={`${selected ? "Deselect" : "Select"} ${movie.title}`}
    >
      <div
        className={`relative aspect-[2/3] overflow-hidden rounded-xl border bg-slate-900 shadow-[0_14px_30px_rgba(2,6,23,0.46)] transition-all duration-300 ease-out ${
          selected
            ? "border-emerald-400/85 shadow-[0_18px_36px_rgba(16,185,129,0.2)] selected-glow"
            : "border-slate-700/75 hover:-translate-y-1 hover:border-slate-500/80 hover:shadow-[0_24px_44px_rgba(2,6,23,0.64)]"
        } ${animateSelect ? "selected-pop" : ""}`}
      >
        <Image
          src={getPosterUrl(movie.posterPath)}
          alt={movie.title}
          fill
          sizes="(max-width: 640px) 46vw, (max-width: 1024px) 30vw, (max-width: 1536px) 22vw, 18vw"
          className={`object-cover transition-transform duration-500 ${
            selected ? "scale-[1.02]" : "group-hover:scale-[1.04]"
          }`}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/28 to-transparent" />
        {animateSelect && (
          <div className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-emerald-300/70" />
        )}
      </div>
      <div className="mt-3">
        <p className="line-clamp-1 text-base text-slate-100">{movie.title}</p>
        <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-400">
          {movie.releaseYear} • {movie.voteAverage.toFixed(1)}
        </p>
      </div>
    </button>
  );
}

export default function DiscoverPage() {
  const router = useRouter();
  const [mediaType, setMediaType] = useState<MediaType>("movie");
  const [selectionMode, setSelectionMode] = useState<"grid" | "swipe">("grid");
  const [query, setQuery] = useState("");
  const [selectedMovies, setSelectedMovies] = useState<SelectedMovie[]>([]);
  const [searchResults, setSearchResults] = useState<DiscoverMovie[]>([]);
  const [swipeIndex, setSwipeIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<DiscoverMovie[]>([]);
  const [topRated, setTopRated] = useState<DiscoverMovie[]>([]);
  const [hiddenGems, setHiddenGems] = useState<DiscoverMovie[]>([]);
  const [isCollectionsLoading, setIsCollectionsLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [justSelectedId, setJustSelectedId] = useState<number | null>(null);
  const selectedRowRef = useRef<HTMLDivElement | null>(null);
  const previousSelectedIdsRef = useRef<Set<number>>(new Set());
  const noSelectionWarning =
    selectedMovies.length === 0
      ? `Please select at least 1 ${mediaType === "movie" ? "movie" : "TV show"} to get recommendations.`
      : null;
  const activeMediaType = toSafeMediaType(mediaType);

  const selectedMovieIds = useMemo(
    () => new Set(selectedMovies.map((movie) => movie.id)),
    [selectedMovies]
  );
  const curatedMovies = useMemo(() => {
    const map = new Map<number, DiscoverMovie>();
    [...nowPlaying, ...topRated, ...hiddenGems].forEach((movie) => {
      if (!map.has(movie.id)) map.set(movie.id, movie);
    });
    return Array.from(map.values()).slice(0, 16);
  }, [hiddenGems, nowPlaying, topRated]);
  const moviesToDisplay = query.trim() ? searchResults : curatedMovies;
  const swipeQueue = useMemo(
    () => moviesToDisplay.filter((movie) => !selectedMovieIds.has(movie.id)),
    [moviesToDisplay, selectedMovieIds]
  );
  const currentSwipeMovie = swipeQueue[swipeIndex];

  useEffect(() => {
    const currentIds = new Set(selectedMovies.map((movie) => movie.id));
    const addedId = Array.from(currentIds).find((id) => !previousSelectedIdsRef.current.has(id));
    if (addedId) {
      setJustSelectedId(addedId);
      if (selectedRowRef.current) {
        selectedRowRef.current.scrollTo({
          left: selectedRowRef.current.scrollWidth,
          behavior: "smooth"
        });
      }
      const timer = window.setTimeout(() => setJustSelectedId(null), 420);
      previousSelectedIdsRef.current = currentIds;
      return () => window.clearTimeout(timer);
    }
    previousSelectedIdsRef.current = currentIds;
  }, [selectedMovies]);

  useEffect(() => {
    const loadCollections = async () => {
      try {
        setIsCollectionsLoading(true);
        const response = await fetch(`/api/movies/discover?mediaType=${activeMediaType}`, {
          method: "GET"
        });
        const rawBody = await response.text();
        if (!response.ok) throw new Error(rawBody || "Failed to load discover collections");

        const data = JSON.parse(rawBody) as {
          nowPlaying?: DiscoverMovie[];
          topRated?: DiscoverMovie[];
          hiddenGems?: DiscoverMovie[];
        };

        const normalize = (items: DiscoverMovie[] | undefined) =>
          (Array.isArray(items) ? items : []).map((item) => ({
            ...item,
            mediaType: toSafeMediaType(item.mediaType ?? activeMediaType)
          }));
        setNowPlaying(normalize(data.nowPlaying));
        setTopRated(normalize(data.topRated));
        setHiddenGems(normalize(data.hiddenGems));
      } catch (loadError) {
        console.error("[discover] failed to load collections:", loadError);
        setError("Failed to load discover collections. Please try again.");
      } finally {
        setIsCollectionsLoading(false);
      }
    };

    loadCollections().catch(() => setIsCollectionsLoading(false));
  }, [activeMediaType]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setSearchResults([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        setIsSearching(true);
        const response = await fetch(
          `/api/movies/search?q=${encodeURIComponent(trimmedQuery)}&mediaType=${activeMediaType}`,
          {
            method: "GET",
            signal: controller.signal
          }
        );
        const rawBody = await response.text();
        if (!response.ok) throw new Error(rawBody || "Failed to search");

        const parsed = JSON.parse(rawBody) as {
          results?: Array<{
            id: number;
            title: string;
            mediaType?: MediaType;
            posterPath: string | null;
            releaseDate?: string;
            voteAverage?: number;
            genreIds: number[];
          }>;
        };
        const mapped: DiscoverMovie[] = (parsed.results ?? []).map((item) => ({
          id: item.id,
          title: item.title,
          mediaType: toSafeMediaType(item.mediaType ?? activeMediaType),
          posterPath: item.posterPath,
          releaseYear: item.releaseDate?.slice(0, 4) ?? "Unknown",
          voteAverage: typeof item.voteAverage === "number" ? item.voteAverage : 0,
          voteCount: 0,
          genreIds: item.genreIds ?? []
        }));
        setSearchResults(mapped);
      } catch (searchError) {
        if (controller.signal.aborted) return;
        console.error("[discover] search failed:", searchError);
        setError("Search failed. Please try another title.");
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 260);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [activeMediaType, query]);

  useEffect(() => {
    if (swipeIndex >= swipeQueue.length) {
      setSwipeIndex(0);
    }
  }, [swipeIndex, swipeQueue.length]);

  useEffect(() => {
    if (selectedMovies.length > 0 && error?.startsWith("Please select at least 1")) {
      setError(null);
    }
  }, [error, selectedMovies.length]);

  const handleMediaTypeChange = (nextType: MediaType) => {
    if (nextType === mediaType) return;
    if (selectedMovies.length > 0) {
      setWarning("Selection reset: choose either Movies or TV Shows per recommendation session.");
    } else {
      setWarning(null);
    }
    setMediaType(nextType);
    setSelectedMovies([]);
    setQuery("");
    setSearchResults([]);
    setSelectionMode("grid");
    setSwipeIndex(0);
  };

  const toggleMovieSelection = (movie: DiscoverMovie) => {
    setSelectedMovies((previous) => {
      const exists = previous.some((item) => item.id === movie.id);
      if (exists) {
        return previous.filter((item) => item.id !== movie.id);
      }
      const hasDifferentType = previous.some((item) => item.mediaType !== movie.mediaType);
      if (hasDifferentType) {
        setWarning("Please choose only one media type at a time: Movies or TV Shows.");
        return previous;
      }
      setWarning(null);
      if (previous.length >= 10) return previous;
      return [
        ...previous,
        {
          id: movie.id,
          title: movie.title,
          mediaType: movie.mediaType,
          genreIds: movie.genreIds,
          posterPath: movie.posterPath,
          releaseYear: movie.releaseYear
        }
      ];
    });
  };

  const handleRecommend = async () => {
    if (selectedMovies.length < 1) {
      setError("Please select at least 1 movie.");
      return;
    }
    const hasMixedMediaTypes = selectedMovies.some((item) => item.mediaType !== selectedMovies[0]?.mediaType);
    if (hasMixedMediaTypes) {
      setWarning("Please choose only one media type at a time: Movies or TV Shows.");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      localStorage.setItem(CINEMATCH_SELECTED_MOVIES_KEY, JSON.stringify(selectedMovies));
      router.push("/recommendations");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to save selections before navigation"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwipeDecision = (decision: "select" | "skip") => {
    if (!currentSwipeMovie) return;
    if (decision === "select") {
      toggleMovieSelection(currentSwipeMovie);
    }
    setSwipeIndex((current) => current + 1);
  };

  return (
    <div className="space-y-10 md:space-y-12">
      <header className="relative mx-auto max-w-6xl overflow-hidden px-2 pt-2 md:px-0">
        <div
          className="absolute -top-16 right-20 h-40 w-40 rounded-full blur-3xl"
          style={{ backgroundColor: "var(--featured-accent-a)", opacity: 0.14 }}
        />
        <div
          className="absolute -bottom-20 left-10 h-36 w-36 rounded-full blur-3xl"
          style={{ backgroundColor: "var(--featured-accent-b)", opacity: 0.11 }}
        />
        <p className="text-xs uppercase tracking-[0.2em] text-brand-500">Personalized Discovery</p>
        <h1 className="hero-title !text-5xl md:!text-7xl">Build Your Taste Profile</h1>
        <p className="mt-3 text-sm text-slate-300 md:text-base">
          Pick at least 1 title to personalize your recommendations.
        </p>
        <div className="mt-6 inline-flex items-center rounded-full bg-slate-900/65 p-1 backdrop-blur-xl">
          <div className="relative grid grid-cols-2 gap-1">
            <div
              className={`absolute bottom-0 left-0 top-0 w-1/2 rounded-full bg-brand-500 shadow-[0_0_14px_rgba(79,70,229,0.45)] transition-transform duration-300 ${
                mediaType === "tv" ? "translate-x-full" : "translate-x-0"
              }`}
            />
            <button
              type="button"
              onClick={() => handleMediaTypeChange("movie")}
              className={`relative z-10 rounded-full px-4 py-2 text-xs uppercase tracking-[0.12em] transition-colors ${
                mediaType === "movie" ? "text-white" : "text-slate-300"
              }`}
            >
              Movies
            </button>
            <button
              type="button"
              onClick={() => handleMediaTypeChange("tv")}
              className={`relative z-10 rounded-full px-4 py-2 text-xs uppercase tracking-[0.12em] transition-colors ${
                mediaType === "tv" ? "text-white" : "text-slate-300"
              }`}
            >
              TV Shows
            </button>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-sm text-slate-400 md:text-base">
          Click posters that resonate with you. CineMatch reads your picks and builds a personalized{" "}
          {mediaType === "movie" ? "movie" : "TV"} profile.
        </p>
        {warning && <p className="mt-2 text-sm text-amber-400">{warning}</p>}
      </header>

      <RevealSection delayMs={50} durationMs={720} className="mx-auto max-w-6xl">
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs uppercase tracking-[0.16em] text-brand-500">Selected Titles</p>
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">
              {selectedMovies.length} selected
            </p>
          </div>
          {selectedMovies.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Select at least one film to continue.</p>
          ) : (
            <div ref={selectedRowRef} className="flex gap-4 overflow-x-auto pb-2">
              {selectedMovies.map((movie) => (
                <div
                  key={movie.id}
                  className={`group relative w-28 shrink-0 ${
                    justSelectedId === movie.id ? "selected-row-item-enter selected-pop selected-glow" : ""
                  }`}
                >
                  <div className="relative h-44 w-28 overflow-hidden rounded-lg border border-emerald-400/70 shadow-[0_12px_24px_rgba(16,185,129,0.16)] transition-all duration-300 group-hover:-translate-y-1">
                    <Image
                      src={getPosterUrl(movie.posterPath)}
                      alt={movie.title}
                      fill
                      sizes="112px"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-slate-950/15 transition-colors duration-300 group-hover:bg-slate-950/30" />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      toggleMovieSelection({
                        id: movie.id,
                        title: movie.title,
                        mediaType: movie.mediaType,
                        posterPath: movie.posterPath ?? null,
                        releaseYear: movie.releaseYear ?? "Unknown",
                        voteAverage: 0,
                        voteCount: 0,
                        genreIds: movie.genreIds
                      })
                    }
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/95 text-xs text-white shadow-[0_0_12px_rgba(239,68,68,0.3)] transition-all hover:scale-105 hover:bg-rose-500"
                    aria-label={`Remove ${movie.title}`}
                  >
                    x
                  </button>
                  <p className="mt-2 line-clamp-1 w-28 text-xs text-slate-300">{movie.title}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </RevealSection>

      <RevealSection delayMs={100} durationMs={760} className="mx-auto max-w-6xl">
        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="section-title text-3xl">Pick What Moves You</h2>
            <div className="inline-flex items-center rounded-full bg-slate-900/65 p-1 backdrop-blur-xl">
              <div className="relative grid grid-cols-2 gap-1">
                <div
                  className={`absolute bottom-0 left-0 top-0 w-1/2 rounded-full bg-brand-500 shadow-[0_0_14px_rgba(79,70,229,0.45)] transition-transform duration-300 ${
                    selectionMode === "swipe" ? "translate-x-full" : "translate-x-0"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setSelectionMode("grid")}
                  className={`relative z-10 rounded-full px-4 py-2 text-xs uppercase tracking-[0.12em] transition-colors ${
                    selectionMode === "grid" ? "text-white" : "text-slate-300"
                  }`}
                >
                  Grid
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectionMode("swipe");
                    setSwipeIndex(0);
                  }}
                  className={`relative z-10 rounded-full px-4 py-2 text-xs uppercase tracking-[0.12em] transition-colors ${
                    selectionMode === "swipe" ? "text-white" : "text-slate-300"
                  }`}
                >
                  Swipe
                </button>
              </div>
            </div>
          </div>

          <div className="relative">
            <svg
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M11 5a6 6 0 104.243 10.243l3.757 3.757 1.414-1.414-3.757-3.757A6 6 0 0011 5z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${mediaType === "movie" ? "movies" : "TV shows"}...`}
              className="w-full rounded-full border border-slate-700/65 bg-slate-900/45 px-12 py-3 text-base text-slate-100 placeholder:text-slate-500 outline-none backdrop-blur-xl transition-all duration-300 focus:border-brand-500/65 focus:shadow-[0_0_0_5px_rgba(79,70,229,0.2)]"
            />
            {isSearching && <p className="mt-2 text-xs uppercase tracking-[0.12em] text-slate-400">Searching...</p>}
          </div>

          {selectionMode === "swipe" ? (
            <div className="space-y-5">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
                Swipe mode • choose quickly
              </p>
              <div className="relative mx-auto w-full max-w-md">
                {currentSwipeMovie ? (
                  <div className="mx-auto w-[min(86vw,360px)]">
                    <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-slate-900 shadow-[0_20px_44px_rgba(2,6,23,0.58)] transition-transform duration-300 hover:-translate-y-1">
                      <Image
                        src={getPosterUrl(currentSwipeMovie.posterPath)}
                        alt={currentSwipeMovie.title}
                        fill
                        sizes="(max-width: 768px) 82vw, 360px"
                        className="object-cover"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/40 to-transparent" />
                    </div>
                    <p className="mt-3 line-clamp-1 text-lg text-slate-100">{currentSwipeMovie.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-400">
                      {currentSwipeMovie.mediaType === "movie" ? "Movie" : "TV Show"} •{" "}
                      {currentSwipeMovie.releaseYear} • {currentSwipeMovie.voteAverage.toFixed(1)}
                    </p>
                  </div>
                ) : (
                  <p className="text-center text-sm text-slate-500">
                    No more titles in this set. Try a search to continue swiping.
                  </p>
                )}
              </div>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={!currentSwipeMovie}
                  onClick={() => handleSwipeDecision("skip")}
                  className="rounded-full bg-slate-900/75 px-4 py-2 text-xs uppercase tracking-[0.12em] text-slate-300 transition-all hover:bg-slate-800 disabled:opacity-45"
                >
                  Skip
                </button>
                <button
                  type="button"
                  disabled={!currentSwipeMovie}
                  onClick={() => handleSwipeDecision("select")}
                  className="rounded-full bg-brand-500 px-4 py-2 text-xs uppercase tracking-[0.12em] text-white shadow-[0_0_16px_rgba(79,70,229,0.45)] transition-all hover:scale-[1.02] disabled:opacity-45"
                >
                  Select
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 xl:grid-cols-4">
              {isCollectionsLoading && !query.trim()
                ? Array.from({ length: 12 }).map((_, index) => (
                    <div key={`discover-skeleton-${index}`} className="space-y-3">
                      <div className="aspect-[2/3] animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" />
                      <div className="h-4 w-3/4 animate-pulse rounded bg-slate-800" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-slate-900" />
                    </div>
                  ))
                : moviesToDisplay.map((movie) => (
                    <PosterPickCard
                      key={movie.id}
                      movie={movie}
                      selected={selectedMovieIds.has(movie.id)}
                      animateSelect={justSelectedId === movie.id}
                      onToggle={toggleMovieSelection}
                    />
                  ))}
            </div>
          )}
          {!isCollectionsLoading && moviesToDisplay.length === 0 && (
            <p className="text-sm text-slate-500">
              No titles found for this mode. Try another search.
            </p>
          )}
        </section>
      </RevealSection>

      <RevealSection delayMs={150} durationMs={740} className="mx-auto max-w-6xl">
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-brand-500">Continue</p>
            <p className="mt-1 text-sm text-slate-300">Selected films: {selectedMovies.length}</p>
            {noSelectionWarning && <p className="mt-2 text-sm text-amber-400">{noSelectionWarning}</p>}
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          </div>

          <button
            type="button"
            disabled={isLoading || selectedMovies.length < 1}
            onClick={handleRecommend}
            className="btn-primary min-w-[260px] px-6 py-3 text-sm shadow-[0_0_26px_color-mix(in_srgb,var(--featured-glow)_35%,transparent)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isLoading ? "Curating your picks..." : "Get Recommendations"}
          </button>
        </div>
      </RevealSection>
    </div>
  );
}
