"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import MovieCard from "@/components/MovieCard";
import type { RecommendedMovie } from "@/lib/types";

type RecommendationCardProps = {
  movie: RecommendedMovie;
  onViewDetails?: (movie: RecommendedMovie) => void;
};

export default function RecommendationCard({ movie, onViewDetails }: RecommendationCardProps) {
  const movieUrl = `/details/${movie.mediaType}/${movie.id}?why=${encodeURIComponent(movie.whyRecommended)}`;
  const hoverTimeoutRef = useRef<number | null>(null);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [shouldShowPreview, setShouldShowPreview] = useState(false);
  const [hasAttemptedPreview, setHasAttemptedPreview] = useState(false);

  const whyBadge =
    movie.recommendationBadges?.[0] ??
    movie.whyRecommended
      .replace(/^This movie is recommended because\s*/i, "")
      .replace(/\.$/, "")
      .split(/[•,]/)[0]
      ?.trim();

  const clearHoverTimer = () => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const loadTrailerPreview = async () => {
    if (hasAttemptedPreview) return;
    try {
      setIsPreviewLoading(true);
      setHasAttemptedPreview(true);
      const response = await fetch(`/api/media/details?id=${movie.id}&mediaType=${movie.mediaType}`);
      const rawBody = await response.text();
      if (!response.ok) throw new Error(rawBody || "Failed to fetch trailer preview");
      const data = JSON.parse(rawBody) as { trailerKey?: string | null };
      setTrailerKey(data.trailerKey ?? null);
    } catch {
      setTrailerKey(null);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleMouseEnter = () => {
    setShouldShowPreview(true);
    clearHoverTimer();
    hoverTimeoutRef.current = window.setTimeout(() => {
      loadTrailerPreview().catch(() => undefined);
    }, 240);
  };

  const handleMouseLeave = () => {
    clearHoverTimer();
    setShouldShowPreview(false);
  };

  useEffect(() => clearHoverTimer, []);

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="card-entrance transition-transform duration-300 hover:-translate-y-0.5"
    >
      <MovieCard
        title={movie.title}
        year={movie.releaseYear}
        rating={movie.voteAverage}
        posterPath={movie.posterPath}
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="line-clamp-1 text-xs uppercase tracking-wide text-slate-400">
            {movie.genres.slice(0, 3).join(" • ")}
          </p>
          {whyBadge && (
            <span className="featured-accent-border featured-accent-surface featured-accent-text inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em]">
              {whyBadge}
            </span>
          )}
        </div>
        <p className="featured-accent-text text-[11px] uppercase tracking-wide">
          Match score {movie.recommendationScore.toFixed(1)}
        </p>
        <div className="flex flex-wrap gap-1">
          {(movie.recommendationBadges ?? []).map((badge) => (
            <span
              key={`${movie.id}-${badge}`}
              className="rounded-full border border-slate-600/70 bg-slate-800/70 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-slate-200"
            >
              {badge}
            </span>
          ))}
        </div>
        <p className="line-clamp-2 text-xs text-slate-300">{movie.whyRecommended}</p>

        {shouldShowPreview && (
          <div className="mt-2 overflow-hidden rounded-lg border border-slate-700/80 bg-slate-900/85 transition-all duration-300">
            {isPreviewLoading ? (
              <div className="aspect-video w-full animate-pulse bg-slate-800" />
            ) : trailerKey ? (
              <iframe
                src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&rel=0&modestbranding=1`}
                title={`${movie.title} preview`}
                className="aspect-video w-full"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="flex aspect-video items-center justify-center px-3">
                <p className="text-center text-[11px] uppercase tracking-[0.12em] text-slate-400">
                  Trailer preview unavailable
                </p>
              </div>
            )}
          </div>
        )}

        {onViewDetails ? (
          <button
            type="button"
            onClick={() => onViewDetails(movie)}
            className="btn-primary mt-2 px-3 py-2 text-xs"
          >
            View Details
          </button>
        ) : (
          <Link
            href={movieUrl}
            className="btn-primary mt-2 px-3 py-2 text-xs"
          >
            View Details
          </Link>
        )}
      </MovieCard>
    </div>
  );
}
