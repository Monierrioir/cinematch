"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { getPosterUrl } from "@/lib/image";
import type { MediaType } from "@/lib/types";

export type TopPickItem = {
  id: number;
  title: string;
  posterPath: string | null;
  rating: number;
  mediaType: MediaType;
};

type TopPicksForYouProps = {
  items: TopPickItem[];
  isLoading: boolean;
  title?: string;
  eyebrow?: string;
};

const trailerCache = new Map<string, string | null>();
const trailerInFlight = new Map<string, Promise<string | null>>();

function getItemKey(item: Pick<TopPickItem, "id" | "mediaType">): string {
  return `${item.mediaType}:${item.id}`;
}

async function fetchTrailerKey(item: Pick<TopPickItem, "id" | "mediaType">): Promise<string | null> {
  const key = getItemKey(item);
  if (trailerCache.has(key)) return trailerCache.get(key) ?? null;
  if (trailerInFlight.has(key)) return trailerInFlight.get(key) ?? null;

  const request = (async () => {
    try {
      const response = await fetch(`/api/media/details?id=${item.id}&mediaType=${item.mediaType}`);
      const raw = await response.text();
      if (!response.ok) {
        trailerCache.set(key, null);
        return null;
      }
      const data = JSON.parse(raw) as { trailerKey?: string | null };
      const trailerKey = data.trailerKey ?? null;
      trailerCache.set(key, trailerKey);
      return trailerKey;
    } catch {
      trailerCache.set(key, null);
      return null;
    } finally {
      trailerInFlight.delete(key);
    }
  })();

  trailerInFlight.set(key, request);
  return request;
}

function TopPickTile({ item }: { item: TopPickItem }) {
  const hoverTimerRef = useRef<number | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [trailerKey, setTrailerKey] = useState<string | null>(() => trailerCache.get(getItemKey(item)) ?? null);

  const clearHoverTimer = () => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
    clearHoverTimer();
    hoverTimerRef.current = window.setTimeout(async () => {
      if (trailerKey !== null || trailerCache.has(getItemKey(item))) return;
      setIsLoadingPreview(true);
      const key = await fetchTrailerKey(item);
      setTrailerKey(key);
      setIsLoadingPreview(false);
    }, 220);
  };

  const handleMouseLeave = () => {
    clearHoverTimer();
    setIsHovering(false);
  };

  return (
    <article
      className="group w-[185px] shrink-0 md:w-[200px]"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Link
        href={`/details/${item.mediaType}/${item.id}`}
        className="relative block overflow-hidden rounded-lg bg-slate-900 shadow-[0_16px_34px_rgba(2,6,23,0.56)] transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.015] hover:shadow-[0_22px_44px_color-mix(in_srgb,var(--featured-glow)_20%,rgba(15,23,42,0.7))]"
      >
        <div className="relative aspect-[2/3] w-full">
          <Image
            src={getPosterUrl(item.posterPath)}
            alt={item.title}
            fill
            sizes="(max-width: 768px) 185px, 200px"
            className={`object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] ${
              isHovering && trailerKey ? "opacity-0" : "opacity-100"
            }`}
          />
          {isHovering && trailerKey && (
            <iframe
              src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&rel=0&modestbranding=1&playsinline=1`}
              title={`${item.title} hover preview`}
              className="absolute inset-0 h-full w-full"
              allow="autoplay; encrypted-media; picture-in-picture"
            />
          )}
          {isHovering && isLoadingPreview && (
            <div className="absolute inset-0 animate-pulse bg-slate-900/50" />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/36 to-transparent" />
        </div>
      </Link>

      <div className="mt-3 space-y-1.5">
        <p className="line-clamp-1 text-base text-slate-100">{item.title}</p>
        <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
          Rating {item.rating.toFixed(1)}
        </p>
      </div>
    </article>
  );
}

export default function TopPicksForYou({
  items,
  isLoading,
  title = "Top Picks For You",
  eyebrow = "Personalized"
}: TopPicksForYouProps) {
  if (isLoading) {
    return (
      <section className="card-entrance w-full px-5 py-12 md:px-10 md:py-16">
        <div className="relative z-10">
          <p className="featured-accent-text text-xs uppercase tracking-[0.2em]">{eyebrow}</p>
          <h2 className="section-title mt-2">{title}</h2>
        </div>
        <div className="mt-8 flex gap-5 overflow-hidden">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`top-picks-skeleton-${index}`} className="w-[185px] shrink-0 space-y-3 md:w-[200px]">
              <div className="aspect-[2/3] animate-pulse rounded-lg bg-slate-900" />
              <div className="h-4 w-4/5 animate-pulse rounded bg-slate-800" />
              <div className="h-3 w-2/5 animate-pulse rounded bg-slate-900" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!items.length) return null;

  return (
    <section className="card-entrance w-full px-5 py-12 md:px-10 md:py-16">
      <div className="relative z-10">
        <p className="featured-accent-text text-xs uppercase tracking-[0.2em]">{eyebrow}</p>
        <h2 className="section-title mt-2">{title}</h2>
      </div>

      <div className="relative z-10 mt-8 overflow-x-auto pb-3 [scrollbar-width:thin] [scrollbar-color:#334155_transparent]">
        <div className="flex min-w-max gap-5 pr-6 md:gap-6">
          {items.map((item) => (
            <TopPickTile key={`${item.mediaType}-${item.id}`} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}
