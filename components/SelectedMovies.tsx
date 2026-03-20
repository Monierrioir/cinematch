"use client";

import MovieCard from "@/components/MovieCard";
import type { SelectedMovie } from "@/lib/types";

type SelectedMoviesProps = {
  items: SelectedMovie[];
  onRemoveMovie: (movieId: number) => void;
  maxSelections?: number;
  limitMessage?: string | null;
};

export default function SelectedMovies({
  items,
  onRemoveMovie,
  maxSelections = 5,
  limitMessage
}: SelectedMoviesProps) {
  return (
    <section className="surface-card p-4 shadow-sm">
      <h2 className="section-title">2) Your selected movies</h2>
      <p className="mt-1 text-sm text-slate-400">
        Selected: {items.length}/{maxSelections}
      </p>
      {limitMessage && <p className="mt-2 text-sm text-amber-400">{limitMessage}</p>}

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {items.length === 0 ? (
          <p className="col-span-full text-sm text-slate-500">No movies selected yet.</p>
        ) : (
          items.map((movie) => (
            <MovieCard
              key={movie.id}
              title={movie.title}
              year={movie.releaseYear}
              posterPath={movie.posterPath}
            >
              <button
                type="button"
                onClick={() => onRemoveMovie(movie.id)}
                className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300 transition-colors hover:border-red-400 hover:text-red-300"
                aria-label={`Remove ${movie.title}`}
              >
                X
              </button>
            </MovieCard>
          ))
        )}
      </div>
    </section>
  );
}
