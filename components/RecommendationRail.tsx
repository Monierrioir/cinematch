"use client";

import RecommendationCard from "@/components/RecommendationCard";
import type { RecommendedMovie } from "@/lib/types";

type RecommendationRailProps = {
  title: string;
  subtitle?: string;
  movies: RecommendedMovie[];
  layout?: "grid" | "scroll";
  onViewDetails?: (movie: RecommendedMovie) => void;
};

export default function RecommendationRail({
  title,
  subtitle,
  movies,
  layout = "grid",
  onViewDetails
}: RecommendationRailProps) {
  if (movies.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <h3 className="section-title text-3xl">{title}</h3>
        {subtitle && <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{subtitle}</p>}
      </div>

      {layout === "grid" ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {movies.map((movie) => (
            <RecommendationCard key={movie.id} movie={movie} onViewDetails={onViewDetails} />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-1 [scrollbar-width:thin] [scrollbar-color:#334155_transparent]">
          {movies.map((movie) => (
            <div key={movie.id} className="w-[220px] shrink-0 md:w-[240px]">
              <RecommendationCard movie={movie} onViewDetails={onViewDetails} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
