"use client";

import Link from "next/link";
import { useMemo } from "react";
import RevealSection from "@/components/RevealSection";
import { usePersonalTracker } from "@/hooks/usePersonalTracker";

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="surface-card p-4">
      <p className="text-xs uppercase tracking-[0.13em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl text-white">{value}</p>
    </article>
  );
}

export default function ProfilePage() {
  const { stats, store, moveToWatched, toggleInWatchlist } = usePersonalTracker();
  const watchlistCount = useMemo(() => Object.keys(store?.watchlist ?? {}).length, [store]);
  const watchlistItems = useMemo(() => Object.values(store?.watchlist ?? {}).slice(0, 8), [store]);

  if (!stats) {
    return (
      <section className="surface-card p-6">
        <p className="text-slate-300">Loading your dashboard...</p>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <RevealSection delayMs={40} durationMs={700}>
        <header className="surface-card p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-brand-500">Profile Dashboard</p>
          <h1 className="mt-1 text-4xl text-white md:text-5xl">Your Movie Journal</h1>
          <p className="mt-2 max-w-2xl text-slate-300">
            Track everything you watch, rate, revisit, and discover your yearly cinema patterns.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/history" className="btn-secondary px-4 py-2 text-xs">
              Watched History
            </Link>
            <Link href="/lists" className="btn-secondary px-4 py-2 text-xs">
              Custom Lists
            </Link>
            <Link href="/recap" className="btn-primary px-4 py-2 text-xs">
              Yearly Recap
            </Link>
          </div>
        </header>
      </RevealSection>

      <RevealSection delayMs={80} durationMs={720}>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Watched Titles" value={String(stats.totalWatchedCount)} />
          <MetricCard label="Watchlist" value={String(watchlistCount)} />
          <MetricCard
            label="Average Rating"
            value={stats.averageUserRating !== null ? stats.averageUserRating.toFixed(2) : "N/A"}
          />
          <MetricCard label="Rewatches" value={String(stats.rewatchCount)} />
        </section>
      </RevealSection>

      <RevealSection delayMs={120} durationMs={740}>
        <section className="grid gap-4 md:grid-cols-2">
          <article className="surface-card p-5">
            <p className="text-xs uppercase tracking-[0.14em] text-brand-500">Taste Snapshot</p>
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              <p>
                Movies vs Series: {stats.watchedMoviesCount} / {stats.watchedSeriesCount}
              </p>
              <p>Most watched genre: {stats.mostWatchedGenre ?? "N/A"}</p>
              <p>Highest rated genre: {stats.highestRatedGenre ?? "N/A"}</p>
              <p>Favorite era: {stats.favoriteEra ?? "N/A"}</p>
              <p>Most active month: {stats.mostActiveMonth ?? "N/A"}</p>
            </div>
          </article>
          <article className="surface-card p-5">
            <p className="text-xs uppercase tracking-[0.14em] text-brand-500">Film Age Analytics</p>
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              <p>Average content age: {stats.averageContentAge !== null ? `${stats.averageContentAge} years` : "N/A"}</p>
              <p>Average release year: {stats.averageReleaseYear ?? "N/A"}</p>
              <p>Classics share: {stats.classicsPercentage}%</p>
              <p>Modern share: {stats.modernPercentage}%</p>
            </div>
          </article>
        </section>
      </RevealSection>

      <RevealSection delayMs={160} durationMs={760}>
        <section className="surface-card p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-brand-500">Watchlist</p>
              <p className="mt-1 text-sm text-slate-400">Queue titles and move them to watched in one click.</p>
            </div>
            <Link href="/lists" className="btn-secondary px-3 py-2 text-xs">
              Manage Lists
            </Link>
          </div>
          {watchlistItems.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Your watchlist is currently empty.</p>
          ) : (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {watchlistItems.map((item) => (
                <div key={item.key} className="rounded-lg border border-slate-800/75 bg-slate-900/65 p-3">
                  <p className="line-clamp-1 text-sm text-slate-100">{item.title}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-slate-400">
                    {item.mediaType === "movie" ? "Movie" : "TV"} • {item.releaseDate.slice(0, 4)}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => moveToWatched(item.mediaType, item.id)}
                      className="rounded-full bg-brand-500 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-white"
                    >
                      Mark Watched
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleInWatchlist(item)}
                      className="rounded-full bg-slate-900/70 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-slate-300"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </RevealSection>
    </div>
  );
}
