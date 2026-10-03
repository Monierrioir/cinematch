"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import RevealSection from "@/components/RevealSection";
import { getPosterUrl } from "@/lib/image";
import { CINEMATCH_SELECTED_MOVIES_KEY, trackTasteProfileEvent } from "@/lib/storage";
import { inferToneFromGenres } from "@/lib/taste-profile";
import type { MediaType, SelectedMovie } from "@/lib/types";

const MIN_SELECTIONS = 1;
const MAX_SELECTIONS = 5;

type SelectableMovie = {
  id: number;
  title: string;
  mediaType: MediaType;
  posterPath: string | null;
  releaseYear: string;
  voteAverage: number;
  popularity?: number;
  originalLanguage?: string | null;
  genreIds: number[];
};

type SearchMovie = {
  id: number;
  title: string;
  mediaType?: MediaType;
  posterPath: string | null;
  releaseDate?: string;
  voteAverage?: number;
  popularity?: number;
  originalLanguage?: string | null;
  genreIds: number[];
};

type Reaction = SelectedMovie["reaction"];
type SwipeDecision = "left" | "right";

function toSelectableMovie(movie: SearchMovie, fallbackMediaType: MediaType): SelectableMovie {
  return {
    id: movie.id,
    title: movie.title,
    mediaType: movie.mediaType === "tv" ? "tv" : fallbackMediaType,
    posterPath: movie.posterPath ?? null,
    releaseYear: movie.releaseDate?.slice(0, 4) ?? "Unknown",
    voteAverage: typeof movie.voteAverage === "number" ? movie.voteAverage : 0,
    popularity: typeof movie.popularity === "number" ? movie.popularity : undefined,
    originalLanguage: movie.originalLanguage ?? null,
    genreIds: movie.genreIds ?? []
  };
}

function PosterSelectionCard({
  movie,
  selected,
  onToggle
}: {
  movie: SelectableMovie;
  selected: boolean;
  onToggle: (movie: SelectableMovie) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(movie)}
      aria-pressed={selected}
      className="group relative text-left"
    >
      <div
        className={`relative aspect-[2/3] overflow-hidden rounded-xl bg-slate-900 shadow-[0_12px_34px_rgba(2,6,23,0.52)] transition-all duration-300 ${
          selected
            ? "ring-2 ring-emerald-400/75 shadow-[0_16px_36px_rgba(16,185,129,0.24)]"
            : "hover:-translate-y-1 hover:scale-[1.015] hover:shadow-[0_18px_40px_color-mix(in_srgb,var(--featured-glow)_20%,rgba(15,23,42,0.68))]"
        }`}
      >
        <Image
          src={getPosterUrl(movie.posterPath)}
          alt={movie.title}
          fill
          sizes="(max-width: 640px) 46vw, (max-width: 1024px) 30vw, (max-width: 1536px) 22vw, 18vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/36 to-transparent" />
      </div>

      <div className="mt-2 space-y-1">
        <p className="line-clamp-1 text-sm text-slate-100 md:text-base">{movie.title}</p>
        <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">
          {movie.mediaType === "movie" ? "Movie" : "TV Show"} • {movie.releaseYear} •{" "}
          {movie.voteAverage.toFixed(1)}
        </p>
      </div>
    </button>
  );
}

export default function RecommendPage() {
  const router = useRouter();
  const [mediaMode, setMediaMode] = useState<MediaType>("movie");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SelectableMovie[]>([]);
  const [curatedMovies, setCuratedMovies] = useState<SelectableMovie[]>([]);
  const [selectedMovies, setSelectedMovies] = useState<SelectedMovie[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());
  const [isSwipeMode, setIsSwipeMode] = useState(false);
  const [swipeCursor, setSwipeCursor] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<SwipeDecision | null>(null);
  const [isSwipeAnimating, setIsSwipeAnimating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isCuratedLoading, setIsCuratedLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedIds = useMemo(() => new Set(selectedMovies.map((movie) => movie.id)), [selectedMovies]);
  const moviesToDisplay = query.trim().length > 0 ? searchResults : curatedMovies;
  const swipeQueue = useMemo(
    () => moviesToDisplay.filter((movie) => !dismissedIds.has(movie.id) && !selectedIds.has(movie.id)),
    [dismissedIds, moviesToDisplay, selectedIds]
  );
  const currentSwipeMovie = swipeQueue[swipeCursor];
  const nextSwipeMovie = swipeQueue[swipeCursor + 1];

  useEffect(() => {
    const controller = new AbortController();
    const loadCuratedMovies = async () => {
      try {
        setIsCuratedLoading(true);
        const response = await fetch(`/api/movies/discover?mediaType=${mediaMode}`, {
          method: "GET",
          signal: controller.signal
        });
        const rawBody = await response.text();
        if (!response.ok) throw new Error(rawBody || "Failed to load curated movies");
        const parsed = JSON.parse(rawBody) as {
          nowPlaying?: SelectableMovie[];
          topRated?: SelectableMovie[];
          hiddenGems?: SelectableMovie[];
        };

        const all = [
          ...(parsed.nowPlaying ?? []),
          ...(parsed.topRated ?? []),
          ...(parsed.hiddenGems ?? [])
        ];
        const deduped = new Map<number, SelectableMovie>();
        all.forEach((movie) => {
          if (!deduped.has(movie.id)) deduped.set(movie.id, { ...movie, mediaType: mediaMode });
        });
        setCuratedMovies(Array.from(deduped.values()).slice(0, 24));
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load curated movies");
      } finally {
        if (!controller.signal.aborted) setIsCuratedLoading(false);
      }
    };

    loadCuratedMovies().catch(() => setIsCuratedLoading(false));
    return () => controller.abort();
  }, [mediaMode]);

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
          `/api/movies/search?q=${encodeURIComponent(trimmedQuery)}&mediaType=${mediaMode}`,
          {
          method: "GET",
          signal: controller.signal
          }
        );
        const rawBody = await response.text();
        if (!response.ok) throw new Error(rawBody || "Failed to search movies");

        const parsed = JSON.parse(rawBody) as { results?: SearchMovie[] };
        const mapped = (parsed.results ?? []).map((movie) => toSelectableMovie(movie, mediaMode));
        setSearchResults(mapped);
      } catch (searchError) {
        if (controller.signal.aborted) return;
        setError(searchError instanceof Error ? searchError.message : "Failed to search movies");
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 260);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [mediaMode, query]);

  useEffect(() => {
    // Keep flow safe: one media type per recommendation session.
    setSelectedMovies([]);
    setDismissedIds(new Set());
    setSwipeCursor(0);
    setQuery("");
    setSearchResults([]);
    setError(null);
  }, [mediaMode]);

  useEffect(() => {
    if (swipeCursor >= swipeQueue.length) {
      setSwipeCursor(0);
    }
  }, [swipeCursor, swipeQueue.length]);

  useEffect(() => {
    if (!isSwipeMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isTypingContext =
        tagName === "input" || tagName === "textarea" || Boolean(target?.isContentEditable);
      if (isTypingContext || isSwipeAnimating || !currentSwipeMovie) return;

      if (event.key === "ArrowRight") {
        event.preventDefault();
        triggerSwipe("right");
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        triggerSwipe("left");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentSwipeMovie, isSwipeAnimating, isSwipeMode]);

  const addMovieToSelection = (movie: SelectableMovie, reaction?: Reaction) => {
    setSelectedMovies((current) => {
      const existing = current.find((item) => item.id === movie.id);
      if (existing) {
        if (!reaction) return current;
        return current.map((item) => (item.id === movie.id ? { ...item, reaction } : item));
      }
      if (current.length >= MAX_SELECTIONS) return current;
      trackTasteProfileEvent({
        type: reaction === "love" ? "love" : reaction === "like" ? "like" : "select",
        mediaType: movie.mediaType,
        genreIds: movie.genreIds,
        releaseYear: movie.releaseYear,
        voteAverage: movie.voteAverage,
        popularity: movie.popularity,
        originalLanguage: movie.originalLanguage ?? null,
        toneHint: inferToneFromGenres(movie.genreIds)
      });
      return [
        ...current,
        {
          id: movie.id,
          title: movie.title,
          mediaType: movie.mediaType,
          genreIds: movie.genreIds,
          posterPath: movie.posterPath,
          releaseYear: movie.releaseYear,
          ...(reaction ? { reaction } : {})
        }
      ];
    });
  };

  const toggleSelection = (movie: SelectableMovie) => {
    setSelectedMovies((current) => {
      const exists = current.some((item) => item.id === movie.id);
      if (exists) return current.filter((item) => item.id !== movie.id);
      if (current.length >= MAX_SELECTIONS) return current;
      trackTasteProfileEvent({
        type: "select",
        mediaType: movie.mediaType,
        genreIds: movie.genreIds,
        releaseYear: movie.releaseYear,
        voteAverage: movie.voteAverage,
        popularity: movie.popularity,
        originalLanguage: movie.originalLanguage ?? null,
        toneHint: inferToneFromGenres(movie.genreIds)
      });
      return [
        ...current,
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
    setError(null);
  };

  const setReaction = (movieId: number, reaction: Reaction) => {
    setSelectedMovies((current) =>
      current.map((movie) => {
        if (movie.id !== movieId) return movie;
        trackTasteProfileEvent({
          type: reaction === "love" ? "love" : reaction === "dislike" ? "dislike" : "like",
          mediaType: movie.mediaType,
          genreIds: movie.genreIds,
          releaseYear: movie.releaseYear,
          toneHint: inferToneFromGenres(movie.genreIds)
        });
        return { ...movie, reaction };
      })
    );
  };

  const triggerSwipe = (decision: SwipeDecision) => {
    if (!currentSwipeMovie || isSwipeAnimating) return;
    setIsSwipeAnimating(true);
    setSwipeDirection(decision);

    window.setTimeout(() => {
      if (decision === "right") {
        addMovieToSelection(currentSwipeMovie, "like");
      } else {
        setDismissedIds((current) => {
          const next = new Set(current);
          next.add(currentSwipeMovie.id);
          return next;
        });
      }
      setSwipeCursor((current) => current + 1);
      setSwipeDirection(null);
      setIsSwipeAnimating(false);
    }, 280);
  };

  const handleSubmit = async () => {
    if (selectedMovies.length < MIN_SELECTIONS) {
      setError(`Select at least ${MIN_SELECTIONS} movies to continue.`);
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      if (selectedMovies[0]) {
        trackTasteProfileEvent({
          type: "request",
          mediaType: selectedMovies[0].mediaType,
          genreIds: selectedMovies.flatMap((movie) => movie.genreIds).slice(0, 8),
          releaseYear: selectedMovies[0].releaseYear,
          toneHint: inferToneFromGenres(selectedMovies[0].genreIds)
        });
      }
      localStorage.setItem(CINEMATCH_SELECTED_MOVIES_KEY, JSON.stringify(selectedMovies));
      router.push("/recommendations");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to continue");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 px-5 pb-16 pt-10 md:px-10 md:pt-12">
      <div className="mx-auto w-full max-w-[1500px] space-y-8 md:space-y-10">
        <RevealSection delayMs={30} durationMs={700}>
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.2em] text-brand-500/90">Taste Onboarding</p>
            <h1 className="hero-title !text-5xl md:!text-7xl">Choose Films You Love</h1>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMediaMode("movie")}
                className={`rounded-full px-3 py-1.5 text-xs uppercase tracking-[0.12em] transition-all ${
                  mediaMode === "movie"
                    ? "bg-brand-500 text-white shadow-[0_0_16px_rgba(79,70,229,0.45)]"
                    : "bg-slate-900/75 text-slate-300 hover:bg-slate-800"
                }`}
              >
                Movies
              </button>
              <button
                type="button"
                onClick={() => setMediaMode("tv")}
                className={`rounded-full px-3 py-1.5 text-xs uppercase tracking-[0.12em] transition-all ${
                  mediaMode === "tv"
                    ? "bg-brand-500 text-white shadow-[0_0_16px_rgba(79,70,229,0.45)]"
                    : "bg-slate-900/75 text-slate-300 hover:bg-slate-800"
                }`}
              >
                TV Shows
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
              <span className="inline-flex rounded-full bg-slate-900/70 px-3 py-1">
                {selectedMovies.length}/{MAX_SELECTIONS} selected
              </span>
              <span className="text-slate-400">Minimum {MIN_SELECTIONS} to continue</span>
            </div>
          </div>
        </RevealSection>

        <RevealSection delayMs={70} durationMs={720}>
          <div className="space-y-3">
            <div className="relative">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${mediaMode === "movie" ? "movies" : "TV shows"} by title...`}
                className="w-full rounded-full border border-slate-700/70 bg-slate-950/72 px-5 py-3.5 text-base text-slate-100 placeholder:text-slate-500 outline-none transition-all duration-300 focus:border-brand-500/60 focus:shadow-[0_0_0_4px_rgba(79,70,229,0.18)]"
              />
              {isSearching && (
                <p className="mt-2 text-xs uppercase tracking-[0.12em] text-slate-400">Searching...</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSwipeMode(false)}
                className={`rounded-full px-3 py-1.5 text-xs uppercase tracking-[0.12em] transition-all ${
                  !isSwipeMode
                    ? "bg-brand-500 text-white shadow-[0_0_16px_rgba(79,70,229,0.45)]"
                    : "bg-slate-900/75 text-slate-300 hover:bg-slate-800"
                }`}
              >
                Grid Mode
              </button>
              <button
                type="button"
                onClick={() => setIsSwipeMode(true)}
                className={`rounded-full px-3 py-1.5 text-xs uppercase tracking-[0.12em] transition-all ${
                  isSwipeMode
                    ? "bg-brand-500 text-white shadow-[0_0_16px_rgba(79,70,229,0.45)]"
                    : "bg-slate-900/75 text-slate-300 hover:bg-slate-800"
                }`}
              >
                Swipe Mode
              </button>
            </div>
          </div>
        </RevealSection>

        <RevealSection delayMs={110} durationMs={740}>
          {isSwipeMode ? (
            <div className="space-y-5">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Swipe Deck • Use Arrow Left / Arrow Right
              </p>
              <div className="relative mx-auto w-full max-w-md py-2">
                {nextSwipeMovie && (
                  <div className="pointer-events-none absolute inset-x-5 top-5 z-0">
                    <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-slate-900 opacity-45">
                      <Image
                        src={getPosterUrl(nextSwipeMovie.posterPath)}
                        alt={nextSwipeMovie.title}
                        fill
                        sizes="(max-width: 768px) 82vw, 360px"
                        className="object-cover"
                      />
                    </div>
                  </div>
                )}

                {currentSwipeMovie ? (
                  <div
                    className={`relative z-10 mx-auto w-[min(86vw,360px)] transition-all duration-300 ${
                      isSwipeAnimating
                        ? swipeDirection === "right"
                          ? "translate-x-[42%] rotate-6 opacity-0"
                          : "-translate-x-[42%] -rotate-6 opacity-0"
                        : "translate-x-0 rotate-0 opacity-100"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSelection(currentSwipeMovie)}
                      className="group block w-full text-left"
                    >
                      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-slate-900 shadow-[0_20px_44px_rgba(2,6,23,0.58)]">
                        <Image
                          src={getPosterUrl(currentSwipeMovie.posterPath)}
                          alt={currentSwipeMovie.title}
                          fill
                          sizes="(max-width: 768px) 82vw, 360px"
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.025]"
                        />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/40 to-transparent" />
                      </div>
                    </button>
                    <p className="mt-3 line-clamp-1 text-lg text-slate-100">{currentSwipeMovie.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-400">
                      {currentSwipeMovie.mediaType === "movie" ? "Movie" : "TV Show"} •{" "}
                      {currentSwipeMovie.releaseYear} • {currentSwipeMovie.voteAverage.toFixed(1)}
                    </p>
                  </div>
                ) : (
                  <div className="mx-auto max-w-md text-center text-sm text-slate-500">
                    No more movies in this batch. Search for more titles to keep swiping.
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={!currentSwipeMovie || isSwipeAnimating}
                  onClick={() => triggerSwipe("left")}
                  className="rounded-full bg-slate-900/75 px-4 py-2 text-xs uppercase tracking-[0.12em] text-slate-300 transition-all hover:bg-slate-800 disabled:opacity-45"
                >
                  Dislike
                </button>
                <button
                  type="button"
                  disabled={!currentSwipeMovie || isSwipeAnimating}
                  onClick={() => triggerSwipe("right")}
                  className="rounded-full bg-brand-500 px-4 py-2 text-xs uppercase tracking-[0.12em] text-white shadow-[0_0_16px_rgba(79,70,229,0.45)] transition-all hover:scale-[1.02] disabled:opacity-45"
                >
                  Like
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  {query.trim() ? "Search Results" : "Curated Picks"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                {isCuratedLoading && !query.trim()
                  ? Array.from({ length: 12 }).map((_, index) => (
                      <div key={`selection-skeleton-${index}`} className="space-y-2">
                        <div className="aspect-[2/3] animate-pulse rounded-xl bg-slate-900/70" />
                        <div className="h-3 w-3/4 animate-pulse rounded bg-slate-800" />
                      </div>
                    ))
                  : moviesToDisplay.map((movie) => (
                      <PosterSelectionCard
                        key={movie.id}
                        movie={movie}
                        selected={selectedIds.has(movie.id)}
                        onToggle={toggleSelection}
                      />
                    ))}
              </div>
            </div>
          )}
        </RevealSection>

        <RevealSection delayMs={150} durationMs={760}>
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.18em] text-brand-500/90">Selected Movies</p>
            {selectedMovies.length === 0 ? (
              <p className="text-sm text-slate-500">Tap posters to build your taste set.</p>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {selectedMovies.map((movie) => (
                  <div key={movie.id} className="w-[150px] shrink-0 space-y-2">
                    <button
                      type="button"
                      onClick={() =>
                        toggleSelection({
                          id: movie.id,
                          title: movie.title,
                          mediaType: movie.mediaType,
                          posterPath: movie.posterPath ?? null,
                          releaseYear: movie.releaseYear ?? "Unknown",
                          voteAverage: 0,
                          genreIds: movie.genreIds
                        })
                      }
                      className="relative block aspect-[2/3] overflow-hidden rounded-lg ring-2 ring-emerald-400/70 shadow-[0_14px_28px_rgba(16,185,129,0.22)] transition-transform duration-300 hover:-translate-y-1"
                    >
                      <Image
                        src={getPosterUrl(movie.posterPath)}
                        alt={movie.title}
                        fill
                        sizes="150px"
                        className="object-cover"
                      />
                    </button>
                    <p className="line-clamp-1 text-xs text-slate-300">{movie.title}</p>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                      {movie.mediaType === "movie" ? "Movie" : "TV Show"}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {[
                        { id: "like", symbol: "+", label: "like" },
                        { id: "love", symbol: "++", label: "love" },
                        { id: "dislike", symbol: "-", label: "dislike" }
                      ].map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setReaction(movie.id, option.id as Reaction)}
                          title={option.label}
                          className={`h-7 min-w-7 rounded-full px-2 text-xs font-semibold transition-all duration-200 ${
                            movie.reaction === option.id
                              ? "bg-brand-500 text-white shadow-[0_0_14px_rgba(79,70,229,0.5)]"
                              : "bg-slate-900/70 text-slate-300 hover:bg-slate-800"
                          }`}
                        >
                          {option.symbol}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </RevealSection>

        <RevealSection delayMs={190} durationMs={760}>
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-sm text-slate-300">Ready for personalized recommendations?</p>
              {error && <p className="mt-1 text-sm text-amber-400">{error}</p>}
            </div>
            <button
              type="button"
              disabled={isSubmitting || selectedMovies.length < MIN_SELECTIONS}
              onClick={handleSubmit}
              className="btn-primary px-6 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isSubmitting ? "Preparing..." : "Get Recommendations"}
            </button>
          </div>
        </RevealSection>
      </div>
    </div>
  );
}
