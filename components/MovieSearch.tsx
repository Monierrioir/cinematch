"use client";

import { useEffect, useState } from "react";
import MovieCard from "@/components/MovieCard";
import SelectedMovies from "@/components/SelectedMovies";
import type { SelectedMovie } from "@/lib/types";

type SearchMovie = {
  id: number;
  title: string;
  releaseDate?: string;
  voteAverage: number;
  posterPath: string | null;
  genreIds: number[];
};

type MovieSearchProps = {
  onSelectionChange?: (movies: SelectedMovie[]) => void;
  maxSelections?: number;
};

export default function MovieSearch({
  onSelectionChange,
  maxSelections = 5
}: MovieSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchMovie[]>([]);
  const [selectedMovies, setSelectedMovies] = useState<SelectedMovie[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const limitReached = selectedMovies.length >= maxSelections;

  const fetchMovies = async (searchText: string, signal: AbortSignal): Promise<SearchMovie[]> => {
    // Client calls our API route, which uses the server-side TMDb service in lib/tmdb.ts.
    const response = await fetch(`/api/movies/search?q=${encodeURIComponent(searchText)}`, {
      method: "GET",
      signal
    });

    const data = (await response.json()) as { results?: SearchMovie[]; error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? "Search request failed");
    }
    return data.results ?? [];
  };

  useEffect(() => {
    onSelectionChange?.(selectedMovies);
  }, [onSelectionChange, selectedMovies]);

  useEffect(() => {
    // Keep a persistent, user-friendly warning whenever selection is full.
    if (limitReached) {
      setLimitMessage(`You can only select up to ${maxSelections} movies.`);
    }
  }, [limitReached, maxSelections]);

  const handleSelectMovie = (movie: SearchMovie) => {
    const duplicate = selectedMovies.some((item) => item.id === movie.id);
    if (duplicate) return;

    if (limitReached) {
      setLimitMessage(`You can only select up to ${maxSelections} movies.`);
      return;
    }

    setLimitMessage(null);
    setSelectedMovies((previous) => [
      ...previous,
      {
        id: movie.id,
        title: movie.title,
        genreIds: movie.genreIds,
        posterPath: movie.posterPath,
        releaseYear: movie.releaseDate?.slice(0, 4) ?? "Unknown year"
      }
    ]);
  };

  const handleRemoveSelectedMovie = (movieId: number) => {
    setSelectedMovies((previous) => previous.filter((movie) => movie.id !== movieId));
    setLimitMessage(null);
  };

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        setIsLoading(true);
        setError(null);
        const movies = await fetchMovies(trimmed, controller.signal);
        setResults(movies);
      } catch (fetchError) {
        if (controller.signal.aborted) return;
        setError(fetchError instanceof Error ? fetchError.message : "Failed to search movies");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 350);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  return (
    <section className="surface-card p-5 shadow-sm md:p-7">
      <h2 className="section-title text-center">1) Search movies you like</h2>
      <p className="mt-1 text-center text-sm text-slate-400">
        Pick at least 1 title to help CineMatch understand your taste.
      </p>

      <input
        className="mx-auto mt-4 block w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-950/90 px-3 py-2 text-sm text-slate-100 outline-none ring-brand-500/40 placeholder:text-slate-500 transition-colors focus:border-brand-500 focus:ring-2"
        placeholder="Try: Arrival, Whiplash, Her, Blade Runner..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <p className="mt-2 text-center text-xs text-slate-500">
        {selectedMovies.length}/{maxSelections} selected
      </p>
      {isLoading && <p className="mt-3 text-sm text-slate-400">Searching movies...</p>}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-7 grid gap-7 lg:grid-cols-[1.45fr_1fr]">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">
            Search Results
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {isLoading &&
              Array.from({ length: 4 }).map((_, index) => (
                <div
                  // Skeleton cards for smoother perceived loading.
                  key={`search-skeleton-${index}`}
                  className="animate-pulse overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70 shadow-lg"
                >
                  <div className="aspect-[2/3] w-full bg-slate-800" />
                  <div className="space-y-2 p-3">
                    <div className="h-4 w-3/4 rounded bg-slate-700" />
                    <div className="h-3 w-1/2 rounded bg-slate-800" />
                  </div>
                </div>
              ))}

            {!isLoading && !error && query.trim() && results.length === 0 && (
              <p className="col-span-full text-sm text-slate-500">No matching movies found.</p>
            )}

            {results.map((movie) => {
              const isSelected = selectedMovies.some((item) => item.id === movie.id);
              const disableAdd = !isSelected && limitReached;
              return (
                <MovieCard
                  key={movie.id}
                  title={movie.title}
                  year={movie.releaseDate?.slice(0, 4)}
                  rating={movie.voteAverage}
                  posterPath={movie.posterPath}
                  isSelected={isSelected}
                  onClick={() => handleSelectMovie(movie)}
                  disabled={isSelected || disableAdd}
                >
                  <span
                    className={`inline-flex h-fit rounded-md px-3 py-1 text-xs font-medium text-white ${
                      isSelected
                        ? "bg-emerald-600/90"
                        : disableAdd
                          ? "bg-amber-600/90"
                          : "bg-brand-500/90"
                    }`}
                  >
                    {isSelected ? "Added" : disableAdd ? "Limit Reached" : "Select"}
                  </span>
                </MovieCard>
              );
            })}
          </div>
        </div>

        <div>
          <SelectedMovies
            items={selectedMovies}
            onRemoveMovie={handleRemoveSelectedMovie}
            maxSelections={maxSelections}
            limitMessage={limitMessage}
          />
        </div>
      </div>
    </section>
  );
}
