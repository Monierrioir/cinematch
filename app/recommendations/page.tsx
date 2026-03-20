"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import MediaDetailsModal from "@/components/MediaDetailsModal";
import RecommendationCard from "@/components/RecommendationCard";
import RevealSection from "@/components/RevealSection";
import { CINEMATCH_SELECTED_MOVIES_KEY, parseSelectedMovies } from "@/lib/storage";
import type { RecommendedMovie, SelectedMovie, TrendingMovie } from "@/lib/types";

function pickTasteTags(items: RecommendedMovie[]): string[] {
  const source = items
    .map((movie) => `${movie.whyRecommended} ${movie.overview}`.toLowerCase())
    .join(" ");
  const detected: string[] = [];

  const checks: Array<[RegExp, string]> = [
    [/\bemotion|emotional|heart|tender|intimate\b/, "emotional"],
    [/\batmospher|moody|dream|haunting|poetic\b/, "atmospheric"],
    [/\bslow[- ]burn|meditative|quiet|reflective\b/, "reflective"],
    [/\bthrill|tense|suspense|intense|edge\b/, "intense"],
    [/\bdark|noir|gritty|bleak\b/, "dark-toned"],
    [/\bhopeful|uplifting|warm|feel-good\b/, "hopeful"]
  ];

  checks.forEach(([regex, label]) => {
    if (regex.test(source)) detected.push(label);
  });

  return detected.slice(0, 3);
}

function buildPersonalizedLine(selectedMovies: SelectedMovie[] | null, items: RecommendedMovie[]): string {
  const tags = pickTasteTags(items);
  const topTitles = (selectedMovies ?? [])
    .slice(0, 2)
    .map((movie) => movie.title)
    .join(" and ");

  if (tags.length >= 2 && topTitles) {
    return `Because you liked ${tags.join(" and ")} films such as ${topTitles}, we leaned into that cinematic mood.`;
  }
  if (tags.length >= 2) {
    return `Because your picks suggest a taste for ${tags.join(" and ")} cinema, we curated this selection around that tone.`;
  }
  if (topTitles) {
    return `Because your recent picks included ${topTitles}, we matched mood, genre signals, and hidden-gem potential.`;
  }
  return "Because your selection hints at a distinct cinematic taste, we curated this lineup to feel personal.";
}

function buildBecauseSections(
  items: RecommendedMovie[],
  selectedMovies: SelectedMovie[] | null
): Array<{ title: string; movies: RecommendedMovie[] }> {
  const grouped = new Map<string, RecommendedMovie[]>();
  items.forEach((movie) => {
    const key = movie.becauseYouLikedTitle || selectedMovies?.[0]?.title || "Your taste profile";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(movie);
  });

  return Array.from(grouped.entries())
    .slice(0, 3)
    .map(([title, movies]) => ({
      title,
      movies: movies.slice(0, 8)
    }));
}

export default function RecommendationsPage() {
  const [items, setItems] = useState<RecommendedMovie[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMovies, setSelectedMovies] = useState<SelectedMovie[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [activeDetails, setActiveDetails] = useState<{
    id: number;
    mediaType: RecommendedMovie["mediaType"];
    whyRecommended?: string;
  } | null>(null);
  const personalizedLine = useMemo(
    () => buildPersonalizedLine(selectedMovies, items),
    [items, selectedMovies]
  );
  const topPicks = useMemo(() => items.slice(0, 6), [items]);
  const selectedMediaType = selectedMovies?.[0]?.mediaType ?? "movie";
  const topPicksTitle = selectedMediaType === "tv" ? "Recommended Series" : "Recommended Movies";
  const becauseSections = useMemo(
    () => (isFallbackMode ? [] : buildBecauseSections(items.slice(6), selectedMovies)),
    [isFallbackMode, items, selectedMovies]
  );

  useEffect(() => {
    const rawSelectedMovies = localStorage.getItem(CINEMATCH_SELECTED_MOVIES_KEY);
    const parsedSelectedMovies = parseSelectedMovies(rawSelectedMovies);
    setSelectedMovies(parsedSelectedMovies);
  }, []);

  useEffect(() => {
    if (selectedMovies === null) return;

    if (!selectedMovies.length) {
      setItems([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    const fetchRecommendations = async () => {
      const fetchFallbackRecommendations = async (): Promise<RecommendedMovie[]> => {
        try {
          const response = await fetch("/api/movies/trending", { method: "GET" });
          const rawBody = await response.text();
          if (!response.ok) {
            console.error("[recommendations] trending fallback request failed:", {
              status: response.status
            });
            return [];
          }

          let data: { topTrending?: TrendingMovie[] } = {};
          try {
            data = rawBody ? (JSON.parse(rawBody) as { topTrending?: TrendingMovie[] }) : {};
          } catch {
            console.error("[recommendations] trending fallback JSON parse failed");
            return [];
          }

          const fallbackItems = Array.isArray(data.topTrending) ? data.topTrending.slice(0, 12) : [];
          return fallbackItems.map((movie) => ({
            id: movie.id,
            mediaType: "movie",
            title: movie.title,
            overview: "Popular with audiences right now.",
            posterPath: movie.posterPath,
            releaseYear: movie.releaseYear,
            genres: [],
            popularity: movie.popularity,
            voteAverage: movie.voteAverage,
            recommendationScore: Number((movie.voteAverage * 10).toFixed(2)),
            whyRecommended: "Popular pick based on what audiences are watching right now."
          }));
        } catch (fallbackError) {
          console.error("[recommendations] fallback request exception:", fallbackError);
          return [];
        }
      };

      try {
        setIsLoading(true);
        setError(null);
        setIsFallbackMode(false);
        setFallbackNotice(null);

        const response = await fetch("/api/recommend", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(selectedMovies)
        });

        const rawBody = await response.text();
        if (!response.ok) {
          let errorDetails = `status=${response.status}`;
          try {
            const parsedError = JSON.parse(rawBody) as { error?: string; details?: string };
            errorDetails = `${errorDetails} error=${parsedError.error ?? "unknown"} details=${parsedError.details ?? "n/a"}`;
          } catch {
            errorDetails = `${errorDetails} nonJsonBody=true`;
          }
          throw new Error(`Recommendation request failed (${errorDetails})`);
        }

        let data: {
          recommendations?: RecommendedMovie[];
          fallbackUsed?: boolean;
          fallbackMessage?: string;
        } = {};
        try {
          data = rawBody ? (JSON.parse(rawBody) as { recommendations?: RecommendedMovie[] }) : {};
        } catch {
          throw new Error("Invalid JSON response from recommendation API.");
        }

        setItems(Array.isArray(data.recommendations) ? data.recommendations : []);
        setIsFallbackMode(Boolean(data.fallbackUsed));
        setFallbackNotice(data.fallbackUsed ? data.fallbackMessage ?? "Showing popular picks instead" : null);
      } catch (requestError) {
        console.error("[recommendations] failed to load recommendations:", requestError);
        const fallbackRecommendations = await fetchFallbackRecommendations();
        if (fallbackRecommendations.length > 0) {
          setItems(fallbackRecommendations);
          setIsFallbackMode(true);
          setFallbackNotice("Showing popular picks instead");
          setError(null);
        } else {
          setError("We couldn't load recommendations right now");
          setItems([]);
          setIsFallbackMode(false);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecommendations().catch((fetchError) => {
      console.error("[recommendations] unexpected fetch failure:", fetchError);
      setError("We couldn't load recommendations right now");
      setIsFallbackMode(false);
      setItems([]);
      setIsLoading(false);
    });
  }, [selectedMovies, retryCount]);

  return (
    <div className="space-y-6 md:space-y-8">
      <RevealSection delayMs={30} durationMs={700} className="mx-auto max-w-6xl">
        <header className="surface-card flex flex-wrap items-center justify-between gap-4 p-6 md:p-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-brand-500">Curated for your taste</p>
            <h1 className="mt-1 text-4xl text-white md:text-5xl">We picked these for you</h1>
            <p className="mt-2 max-w-2xl text-slate-300">
              A cinematic lineup tuned to your mood, visual style, and hidden-gem profile.
            </p>
            {isFallbackMode && (
              <p className="mt-2 text-sm text-slate-400">
                {fallbackNotice ?? "Showing popular picks instead"}
              </p>
            )}
            {!isLoading && !error && items.length > 0 && (
              <p className="mt-2 text-sm text-brand-500/95">{personalizedLine}</p>
            )}
          </div>
          <Link href="/recommend" className="btn-secondary">
            Refine Picks
          </Link>
        </header>
      </RevealSection>

      {isLoading ? (
        <section className="mx-auto grid max-w-6xl grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={`recommendation-skeleton-${index}`}
              className="animate-pulse overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70 shadow-lg"
            >
              <div className="aspect-[2/3] w-full bg-slate-800" />
              <div className="space-y-2 p-3">
                <div className="h-4 w-3/4 rounded bg-slate-700" />
                <div className="h-3 w-1/2 rounded bg-slate-800" />
              </div>
            </div>
          ))}
        </section>
      ) : !selectedMovies?.length ? (
        <section className="surface-card mx-auto max-w-6xl p-6">
          <p className="text-slate-300">Go back and select at least 1 movie.</p>
        </section>
      ) : error ? (
        <section className="surface-card mx-auto max-w-6xl border-red-900/60 p-6">
          <p className="text-red-300">{error}</p>
          <p className="mt-2 text-sm text-slate-400">Please try again in a moment.</p>
          <button
            type="button"
            onClick={() => setRetryCount((current) => current + 1)}
            className="btn-secondary mt-4 px-4 py-2 text-xs"
          >
            Retry
          </button>
        </section>
      ) : items.length === 0 ? (
        <section className="surface-card mx-auto max-w-6xl p-6">
          <p className="text-slate-300">No recommendations matched this selection yet.</p>
          <p className="mt-2 text-sm text-slate-500">
            Try selecting a few different movies to improve matching.
          </p>
        </section>
      ) : (
        <div className="mx-auto max-w-6xl space-y-6">
          <RevealSection delayMs={80} durationMs={760}>
            <section className="space-y-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-brand-500">For You</p>
                  <h2 className="section-title text-3xl">{topPicksTitle}</h2>
                </div>
                <p className="text-xs uppercase tracking-[0.12em] text-slate-400">
                  {isFallbackMode ? "Trending right now" : "Ranked by your taste profile"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
                {topPicks.map((movie) => (
                  <RecommendationCard
                    key={movie.id}
                    movie={movie}
                    onViewDetails={(currentMovie) =>
                      setActiveDetails({
                        id: currentMovie.id,
                        mediaType: currentMovie.mediaType,
                        whyRecommended: currentMovie.whyRecommended
                      })
                    }
                  />
                ))}
              </div>
            </section>
          </RevealSection>

          {becauseSections.map((section, sectionIndex) => (
            <RevealSection key={section.title} delayMs={130 + sectionIndex * 40} durationMs={760}>
              <section className="space-y-4">
                <div className="flex items-end justify-between gap-4">
                  <h3 className="section-title text-3xl">Because You Liked {section.title}</h3>
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                    Similar mood, style, and themes
                  </p>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-1 [scrollbar-width:thin] [scrollbar-color:#334155_transparent]">
                  {section.movies.map((movie) => (
                    <div key={movie.id} className="w-[220px] shrink-0 md:w-[240px]">
                      <RecommendationCard
                        movie={movie}
                        onViewDetails={(currentMovie) =>
                          setActiveDetails({
                            id: currentMovie.id,
                            mediaType: currentMovie.mediaType,
                            whyRecommended: currentMovie.whyRecommended
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </section>
            </RevealSection>
          ))}
        </div>
      )}
      <MediaDetailsModal detail={activeDetails} onClose={() => setActiveDetails(null)} />
    </div>
  );
}
