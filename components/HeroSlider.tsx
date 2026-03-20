"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buildDynamicTheme } from "@/lib/color-theme";
import { getBackdropUrl, getHeroBackdropUrl } from "@/lib/image";
import type { DynamicTheme } from "@/lib/color-theme";
import type { HeroMovie } from "@/lib/types";

type HeroSliderProps = {
  movies: HeroMovie[];
  isLoading: boolean;
  onThemeChange?: (theme: DynamicTheme) => void;
  rotationMs?: number;
};

function useAutoRotation(length: number, rotationMs: number) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [length]);

  useEffect(() => {
    if (length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % length);
    }, rotationMs);
    return () => window.clearInterval(timer);
  }, [length, rotationMs]);

  return [activeIndex, setActiveIndex] as const;
}

function truncateOverview(text: string, maxLength = 170): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}...`;
}

export default function HeroSlider({
  movies,
  isLoading,
  onThemeChange,
  rotationMs = 6000
}: HeroSliderProps) {
  const [activeIndex, setActiveIndex] = useAutoRotation(movies.length, rotationMs);
  const [parallaxOffset, setParallaxOffset] = useState(0);
  const [fallbackBackdropIds, setFallbackBackdropIds] = useState<Set<number>>(new Set());
  const activeMovie = movies[activeIndex];
  const accentStyle = useMemo(
    () => ({
      background:
        "linear-gradient(125deg, color-mix(in srgb, var(--featured-accent-c) 12%, rgba(6,8,18,0.92)) 0%, rgba(6,8,18,0.72) 45%, rgba(6,8,18,0.86) 100%)",
      boxShadow: "0 16px 52px color-mix(in srgb, var(--featured-glow) 12%, transparent)"
    }),
    []
  );

  useEffect(() => {
    if (!activeMovie?.backdropPath || !onThemeChange) return;

    let cancelled = false;
    const backdropUrl = getBackdropUrl(activeMovie.backdropPath);
    buildDynamicTheme([backdropUrl]).then((theme) => {
      if (!cancelled) onThemeChange(theme);
    });

    return () => {
      cancelled = true;
    };
  }, [activeMovie?.backdropPath, onThemeChange]);

  useEffect(() => {
    const onScroll = () => {
      const offset = Math.min(28, window.scrollY * 0.075);
      setParallaxOffset(offset);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (isLoading) {
    return (
      <section className="relative h-[100svh] min-h-[640px] overflow-hidden bg-slate-950">
        <div className="mx-auto flex h-[100svh] min-h-[640px] max-w-6xl items-end px-6 py-10 md:px-10 md:py-14">
          <div className="w-full max-w-2xl space-y-3">
            <div className="h-4 w-28 animate-pulse rounded bg-slate-800" />
            <div className="h-14 w-full animate-pulse rounded bg-slate-900/80" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-slate-800/80" />
            <div className="h-4 w-3/5 animate-pulse rounded bg-slate-900/80" />
          </div>
        </div>
      </section>
    );
  }

  if (!movies.length || !activeMovie) {
    return (
      <section className="relative h-[100svh] min-h-[640px] overflow-hidden bg-slate-950">
        <div className="mx-auto flex h-[100svh] min-h-[640px] max-w-6xl items-end px-6 py-10 md:px-10 md:py-14">
          <p className="text-sm text-slate-400">No hero movies available right now.</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="relative h-[100svh] min-h-[640px] overflow-hidden transition-all duration-[1200ms]"
      style={accentStyle}
    >
      <div className="absolute inset-0">
        {movies.map((movie, index) => (
          <div
            key={movie.id}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              index === activeIndex ? "opacity-100" : "opacity-0"
            }`}
            style={{
              transform: `translate3d(0, ${index === activeIndex ? parallaxOffset : parallaxOffset * 0.65}px, 0)`
            }}
          >
            <Image
              src={getHeroBackdropUrl(movie.backdropPath, fallbackBackdropIds.has(movie.id))}
              alt={movie.title}
              fill
              priority={index === 0}
              sizes="100vw"
              quality={90}
              className={`hero-backdrop-image object-cover object-center ${
                index === activeIndex ? "hero-backdrop-active" : ""
              }`}
              onError={() => {
                setFallbackBackdropIds((current) => {
                  if (current.has(movie.id)) return current;
                  const next = new Set(current);
                  next.add(movie.id);
                  return next;
                });
              }}
            />
          </div>
        ))}
      </div>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950/84 via-slate-950/44 to-slate-950/68" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/74 via-transparent to-slate-950/22" />
      <div className="hero-grain-overlay pointer-events-none absolute inset-0" />

      <div className="relative mx-auto flex h-[100svh] min-h-[640px] max-w-6xl items-end px-6 py-10 md:px-10 md:py-14">
        <div className="max-w-2xl space-y-4 md:space-y-5">
          <p className="featured-accent-text text-xs uppercase tracking-[0.2em]">Now Showing</p>
          <h1 className="hero-title !text-5xl md:!text-7xl">{activeMovie.title}</h1>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-300">
            {activeMovie.releaseYear}
            {activeMovie.genres.length > 0 ? ` • ${activeMovie.genres.join(" • ")}` : ""}
          </p>
          <p className="max-w-xl text-sm text-slate-200/90 md:text-base">
            {truncateOverview(activeMovie.overview)}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/details/movie/${activeMovie.id}`} className="btn-primary px-6 py-3 text-sm">
              View Details
            </Link>
            <Link href="/recommend" className="btn-secondary px-5 py-3 text-sm">
              Get Recommendations
            </Link>
          </div>

          <div className="flex items-center gap-2 pt-1">
            {movies.map((movie, index) => (
              <button
                key={movie.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Show ${movie.title}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === activeIndex
                    ? "w-8 bg-white/85"
                    : "w-4 bg-slate-400/45 hover:bg-slate-300/70"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-[#04060f]" />
    </section>
  );
}
