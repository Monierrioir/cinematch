"use client";

import Image from "next/image";
import Link from "next/link";
import { getPosterUrl } from "@/lib/image";
import type { FeaturedMovie } from "@/lib/types";

type FeaturedNowPlayingProps = {
  movies: FeaturedMovie[];
  isLoading: boolean;
};

function FeatureCard({
  movie
}: {
  movie: FeaturedMovie;
}) {
  const imageUrl = getPosterUrl(movie.posterPath);
  const detailsUrl = `/details/movie/${movie.id}`;

  return (
    <article className="group">
      <Link
        href={detailsUrl}
        className="relative block aspect-[2/3] overflow-hidden rounded-xl border border-slate-700/75 bg-slate-900 shadow-[0_12px_30px_rgba(2,6,23,0.45)] transition-all duration-400 ease-out hover:-translate-y-1 hover:border-slate-500/80 hover:shadow-[0_18px_40px_color-mix(in_srgb,var(--featured-glow)_18%,rgba(2,6,23,0.55))]"
      >
        <Image
          src={imageUrl}
          alt={movie.title}
          fill
          sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, (max-width: 1536px) 30vw, 26vw"
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/18 to-transparent opacity-80 transition-opacity duration-400 group-hover:opacity-100" />
      </Link>

      <div className="mt-4 space-y-1.5">
        <h3 className="line-clamp-2 text-xl text-slate-100 md:text-2xl">{movie.title}</h3>
        <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
          {movie.releaseYear} • {movie.voteAverage.toFixed(1)} rating
        </p>
      </div>
    </article>
  );
}

export default function FeaturedNowPlaying({ movies, isLoading }: FeaturedNowPlayingProps) {
  if (isLoading) {
    return (
      <section className="surface-card space-y-6 p-6 md:p-10">
        <div className="mx-auto h-5 w-48 animate-pulse rounded bg-slate-800" />
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={`featured-loading-${index}`} className="space-y-3">
              <div className="aspect-[2/3] animate-pulse rounded-xl bg-slate-900" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-slate-800" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-slate-900" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!movies.length) {
    return (
      <section className="surface-card p-6">
        <p className="text-slate-300">No featured now-playing movies available right now.</p>
      </section>
    );
  }

  return (
    <section className="surface-card space-y-8 p-6 md:p-10">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-brand-500">Featured Selection</p>
        <h2 className="section-title mt-2">Now in Theaters</h2>
      </div>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {movies.slice(0, 3).map((movie) => (
          <FeatureCard key={movie.id} movie={movie} />
        ))}
      </div>
    </section>
  );
}
