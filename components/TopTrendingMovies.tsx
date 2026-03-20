"use client";

import Image from "next/image";
import Link from "next/link";
import { getPosterUrl } from "@/lib/image";
import type { TrendingMovie } from "@/lib/types";

type TopTrendingMoviesProps = {
  movies: TrendingMovie[];
  isLoading: boolean;
};

export default function TopTrendingMovies({ movies, isLoading }: TopTrendingMoviesProps) {
  if (isLoading) {
    return (
      <section className="relative w-full px-5 py-14 md:px-10 md:py-20">
        <div className="mx-auto h-5 w-56 animate-pulse rounded bg-slate-800" />
        <div className="mt-10 flex gap-8 overflow-hidden">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={`trending-skeleton-${index}`} className="w-[220px] shrink-0 space-y-3">
              <div className="aspect-[2/3] animate-pulse rounded-lg bg-slate-900" />
              <div className="h-4 w-4/5 animate-pulse rounded bg-slate-800" />
              <div className="h-3 w-2/5 animate-pulse rounded bg-slate-900" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!movies.length) {
    return null;
  }

  return (
    <section className="card-entrance relative w-full overflow-hidden px-5 py-14 md:px-10 md:py-20">
      <div
        className="pointer-events-none absolute inset-x-0 top-4 text-center font-heading text-[5.2rem] leading-none md:text-[9rem]"
        style={{
          color: "color-mix(in srgb, #d6b37a 65%, #7f1d1d)",
          opacity: 0.32,
          textShadow: "0 0 34px rgba(214, 179, 122, 0.2), 0 0 1px rgba(255, 255, 255, 0.1)",
          WebkitTextStroke: "1px rgba(214, 179, 122, 0.38)"
        }}
      >
        TOP 5
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-24"
        style={{
          background:
            "linear-gradient(180deg, rgba(4, 6, 15, 0) 0%, rgba(4, 6, 15, 0.72) 58%, rgba(4, 6, 15, 0.96) 100%)"
        }}
      />

      <div className="relative z-10">
        <p className="featured-accent-text text-xs uppercase tracking-[0.2em]">Now Trending</p>
        <h2 className="section-title mt-2">Top 5 Movies</h2>
      </div>

      <div className="relative z-10 mt-9 overflow-x-auto pb-3 [scrollbar-width:thin] [scrollbar-color:#334155_transparent]">
        <div className="flex min-w-max gap-12 pr-6 md:gap-14">
          {movies.slice(0, 5).map((movie, index) => (
            <article key={movie.id} className="group relative w-[230px] shrink-0 md:w-[255px]">
              <span className="pointer-events-none absolute -left-7 -top-12 select-none font-heading text-[8.2rem] leading-none text-rose-400/18 transition-colors duration-300 group-hover:text-rose-400/28 md:-left-9 md:text-[9.4rem]">
                {index + 1}
              </span>
              <Link
                href={`/details/movie/${movie.id}`}
                className="relative block overflow-hidden rounded-lg bg-slate-900 shadow-[0_16px_34px_rgba(2,6,23,0.56)] transition-all duration-300 ease-out hover:-translate-y-1.5 hover:scale-[1.015] hover:shadow-[0_22px_44px_color-mix(in_srgb,var(--featured-glow)_20%,rgba(15,23,42,0.7))]"
              >
                <div className="relative aspect-[2/3] w-full">
                  <Image
                    src={getPosterUrl(movie.posterPath)}
                    alt={movie.title}
                    fill
                    sizes="(max-width: 768px) 230px, 255px"
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/36 to-transparent" />
                </div>
              </Link>

              <div className="mt-3 space-y-1.5">
                <p className="line-clamp-1 text-lg text-slate-100">{movie.title}</p>
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
                  {movie.releaseYear} • {movie.voteAverage.toFixed(1)}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
