"use client";

import { useEffect, useState } from "react";
import HeroSlider from "@/components/HeroSlider";
import MoodRecommender from "@/components/MoodRecommender";
import RevealSection from "@/components/RevealSection";
import TopPicksForYou, { type TopPickItem } from "@/components/TopPicksForYou";
import TopTrendingMovies from "@/components/TopTrendingMovies";
import type { DynamicTheme } from "@/lib/color-theme";
import { CINEMATCH_SELECTED_MOVIES_KEY, parseSelectedMovies } from "@/lib/storage";
import type { HeroMovie, RecommendedMovie, TrendingMovie } from "@/lib/types";

const DEFAULT_THEME: DynamicTheme = {
  accentA: "#2f3b72",
  accentB: "#4e3f78",
  accentC: "#273457",
  glow: "#3b4370"
};

export default function HomePage() {
  const [isHeroLoading, setIsHeroLoading] = useState(true);
  const [isTrendingLoading, setIsTrendingLoading] = useState(true);
  const [isTopPicksLoading, setIsTopPicksLoading] = useState(true);
  const [heroError, setHeroError] = useState<string | null>(null);
  const [trendingError, setTrendingError] = useState<string | null>(null);
  const [heroMovies, setHeroMovies] = useState<HeroMovie[]>([]);
  const [topTrendingMovies, setTopTrendingMovies] = useState<TrendingMovie[]>([]);
  const [topPicksForYou, setTopPicksForYou] = useState<TopPickItem[]>([]);
  const [becauseRows, setBecauseRows] = useState<Array<{ sourceTitle: string; items: TopPickItem[] }>>([]);
  const [isBecauseRowsLoading, setIsBecauseRowsLoading] = useState(true);
  const [dynamicTheme, setDynamicTheme] = useState<DynamicTheme>(DEFAULT_THEME);

  const mapRecommendedToTopPick = (movie: RecommendedMovie): TopPickItem => ({
    id: movie.id,
    title: movie.title,
    posterPath: movie.posterPath,
    rating: movie.voteAverage,
    mediaType: movie.mediaType
  });

  useEffect(() => {
    const loadHomeSections = async () => {
      setIsHeroLoading(true);
      setIsTrendingLoading(true);
      setIsTopPicksLoading(true);
      setIsBecauseRowsLoading(true);
      setHeroError(null);
      setTrendingError(null);

      const [heroResult, trendingResult] = await Promise.allSettled([
        fetch("/api/movies/hero", { method: "GET" }),
        fetch("/api/movies/trending", { method: "GET" })
      ]);

      if (heroResult.status === "fulfilled") {
        const heroRawBody = await heroResult.value.text();
        if (!heroResult.value.ok) {
          setHeroError(heroRawBody || `Failed to load hero movies (${heroResult.value.status})`);
        } else {
          try {
            const heroData = JSON.parse(heroRawBody) as { heroMovies?: HeroMovie[] };
            setHeroMovies(Array.isArray(heroData.heroMovies) ? heroData.heroMovies : []);
          } catch {
            setHeroError("Invalid hero movies response.");
          }
        }
      } else {
        setHeroError(heroResult.reason instanceof Error ? heroResult.reason.message : "Failed to load hero movies");
      }

      let trendingFallback: TopPickItem[] = [];
      if (trendingResult.status === "fulfilled") {
        const trendingRawBody = await trendingResult.value.text();
        if (!trendingResult.value.ok) {
          setTrendingError(
            trendingRawBody || `Failed to load trending movies (${trendingResult.value.status})`
          );
        } else {
          try {
            const trendingData = JSON.parse(trendingRawBody) as { topTrending?: TrendingMovie[] };
            const parsedTrending = Array.isArray(trendingData.topTrending) ? trendingData.topTrending : [];
            setTopTrendingMovies(parsedTrending);
            trendingFallback = parsedTrending.map((movie) => ({
              id: movie.id,
              title: movie.title,
              posterPath: movie.posterPath,
              rating: movie.voteAverage,
              mediaType: "movie"
            }));
          } catch {
            setTrendingError("Invalid trending response.");
          }
        }
      } else {
        setTrendingError(
          trendingResult.reason instanceof Error
            ? trendingResult.reason.message
            : "Failed to load trending movies"
        );
      }

      try {
        const selectedMovies = parseSelectedMovies(localStorage.getItem(CINEMATCH_SELECTED_MOVIES_KEY));
        if (!selectedMovies.length) {
          setTopPicksForYou(trendingFallback.slice(0, 10));
          setBecauseRows([]);
        } else {
          const recommendationResponse = await fetch("/api/recommend", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(selectedMovies)
          });
          const recommendationRawBody = await recommendationResponse.text();
          if (!recommendationResponse.ok) {
            setTopPicksForYou(trendingFallback.slice(0, 10));
          } else {
            const recommendationData = JSON.parse(recommendationRawBody) as {
              recommendations?: RecommendedMovie[];
            };
            const personalized = Array.isArray(recommendationData.recommendations)
              ? recommendationData.recommendations.slice(0, 10).map(mapRecommendedToTopPick)
              : [];
            setTopPicksForYou(personalized.length ? personalized : trendingFallback.slice(0, 10));
          }

          const likedSources = selectedMovies.slice(0, 3);
          const becauseRowsResult = await Promise.all(
            likedSources.map(async (sourceMovie) => {
              try {
                const rowResponse = await fetch("/api/recommend", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json"
                  },
                  body: JSON.stringify([sourceMovie])
                });
                const rowRawBody = await rowResponse.text();
                if (!rowResponse.ok) return null;
                const rowData = JSON.parse(rowRawBody) as { recommendations?: RecommendedMovie[] };
                const rowItems = Array.isArray(rowData.recommendations)
                  ? rowData.recommendations.slice(0, 10).map(mapRecommendedToTopPick)
                  : [];
                if (!rowItems.length) return null;
                return {
                  sourceTitle: sourceMovie.title,
                  items: rowItems
                };
              } catch {
                return null;
              }
            })
          );
          setBecauseRows(
            becauseRowsResult.filter((row): row is { sourceTitle: string; items: TopPickItem[] } => Boolean(row))
          );
        }
      } catch {
        setTopPicksForYou(trendingFallback.slice(0, 10));
        setBecauseRows([]);
      }

      setIsHeroLoading(false);
      setIsTrendingLoading(false);
      setIsTopPicksLoading(false);
      setIsBecauseRowsLoading(false);
    };

    loadHomeSections().catch((loadError) => {
      const message = loadError instanceof Error ? loadError.message : "Failed to load movie sections";
      setHeroError(message);
      setTrendingError(message);
      setIsHeroLoading(false);
      setIsTrendingLoading(false);
      setIsTopPicksLoading(false);
      setIsBecauseRowsLoading(false);
    });
  }, []);

  useEffect(() => {
    // Apply extracted accents globally so navbar/buttons/sections stay in sync.
    const root = document.documentElement;
    root.style.setProperty("--featured-accent-a", dynamicTheme.accentA);
    root.style.setProperty("--featured-accent-b", dynamicTheme.accentB);
    root.style.setProperty("--featured-accent-c", dynamicTheme.accentC);
    root.style.setProperty("--featured-glow", dynamicTheme.glow);
  }, [dynamicTheme]);

  return (
    <div>
      <div className="relative left-1/2 right-1/2 w-screen -translate-x-1/2">
        <HeroSlider movies={heroMovies} isLoading={isHeroLoading} onThemeChange={setDynamicTheme} />
      </div>

      <RevealSection delayMs={70} durationMs={760} className="-mt-1">
        <TopTrendingMovies movies={topTrendingMovies} isLoading={isTrendingLoading} />
      </RevealSection>

      <RevealSection delayMs={95} durationMs={760}>
        <TopPicksForYou items={topPicksForYou} isLoading={isTopPicksLoading} />
      </RevealSection>

      <RevealSection delayMs={108} durationMs={760}>
        <MoodRecommender />
      </RevealSection>

      {becauseRows.map((row, index) => (
        <RevealSection key={row.sourceTitle} delayMs={112 + index * 25} durationMs={760}>
          <TopPicksForYou
            items={row.items}
            isLoading={isBecauseRowsLoading}
            eyebrow="Why These"
            title={`Because you liked ${row.sourceTitle}`}
          />
        </RevealSection>
      ))}

      {heroError && (
        <RevealSection delayMs={110} durationMs={650} className="mx-auto max-w-6xl space-y-4">
          <section className="surface-card border-red-900/60 p-5">
            <p className="text-red-300">Could not load cinematic hero.</p>
            <p className="mt-1 text-sm text-red-400/90">{heroError}</p>
          </section>
        </RevealSection>
      )}

      {trendingError && (
        <RevealSection delayMs={130} durationMs={650} className="mx-auto max-w-6xl space-y-4 px-4 md:px-8">
          <section className="rounded-xl border border-red-900/50 bg-slate-900/60 p-5">
            <p className="text-red-300">Could not load trending section.</p>
            <p className="mt-1 text-sm text-red-400/90">{trendingError}</p>
          </section>
        </RevealSection>
      )}
    </div>
  );
}
