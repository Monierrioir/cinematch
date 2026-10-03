"use client";

import { useMemo, useState } from "react";
import RevealSection from "@/components/RevealSection";
import { usePersonalTracker } from "@/hooks/usePersonalTracker";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <article className="surface-card p-4">
      <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-2 text-xl text-white">{value}</p>
    </article>
  );
}

export default function RecapPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const { getRecap } = usePersonalTracker();
  const recap = useMemo(() => getRecap(year), [getRecap, year]);
  const monthMax = Math.max(1, ...recap.timelineByMonth.map((entry) => entry.count));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <RevealSection delayMs={40} durationMs={700}>
        <header className="surface-card p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-brand-500">Yearly Recap</p>
          <h1 className="mt-1 text-4xl text-white md:text-5xl">Your Year In Cinema</h1>
          <div className="mt-4 flex items-center gap-2">
            <label htmlFor="recap-year" className="text-xs uppercase tracking-[0.12em] text-slate-400">
              Year
            </label>
            <input
              id="recap-year"
              type="number"
              value={year}
              onChange={(event) => setYear(Number(event.target.value) || currentYear)}
              className="w-28 rounded-lg border border-slate-700/70 bg-slate-900/70 px-2 py-1.5 text-sm text-slate-200 outline-none"
            />
          </div>
          <p className="mt-3 text-sm text-brand-500/95">{recap.summary}</p>
        </header>
      </RevealSection>

      <RevealSection delayMs={80} durationMs={720}>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Stat label="Total Watched" value={String(recap.totalTitlesWatched)} />
          <Stat label="Movies vs Series" value={`${recap.moviesCount} / ${recap.seriesCount}`} />
          <Stat label="Average Rating" value={recap.averageRating !== null ? recap.averageRating.toFixed(2) : "N/A"} />
          <Stat label="Average Content Age" value={recap.averageContentAge !== null ? `${recap.averageContentAge}y` : "N/A"} />
          <Stat label="Average Release Year" value={recap.averageReleaseYear?.toString() ?? "N/A"} />
          <Stat label="Most Watched Month" value={recap.mostWatchedMonth ?? "N/A"} />
          <Stat label="Rewatches" value={String(recap.rewatches)} />
          <Stat label="Hidden Gems" value={String(recap.hiddenGemCount)} />
        </section>
      </RevealSection>

      <RevealSection delayMs={120} durationMs={740}>
        <section className="grid gap-4 md:grid-cols-2">
          <article className="surface-card p-5">
            <p className="text-xs uppercase tracking-[0.13em] text-brand-500">Top Genres</p>
            <div className="mt-3 space-y-2">
              {recap.topGenres.length === 0 ? (
                <p className="text-sm text-slate-500">No genre data yet.</p>
              ) : (
                recap.topGenres.map((genre) => (
                  <div key={genre.genre} className="flex items-center justify-between text-sm text-slate-300">
                    <span>{genre.genre}</span>
                    <span>{genre.count}</span>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="surface-card p-5">
            <p className="text-xs uppercase tracking-[0.13em] text-brand-500">Monthly Timeline</p>
            <div className="mt-3 space-y-2">
              {recap.timelineByMonth.length === 0 ? (
                <p className="text-sm text-slate-500">No monthly activity yet.</p>
              ) : (
                recap.timelineByMonth.map((entry) => (
                  <div key={entry.month} className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{entry.month}</span>
                      <span>{entry.count}</span>
                    </div>
                    <div className="h-2 rounded bg-slate-800">
                      <div
                        className="h-2 rounded bg-brand-500"
                        style={{ width: `${Math.max(6, (entry.count / monthMax) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>
        </section>
      </RevealSection>

      <RevealSection delayMs={160} durationMs={760}>
        <section className="surface-card p-5">
          <p className="text-xs uppercase tracking-[0.13em] text-brand-500">Top Rated This Year</p>
          {recap.topRatedTitles.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Rate watched titles to unlock this section.</p>
          ) : (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {recap.topRatedTitles.map((item) => (
                <div key={item.key} className="rounded-lg border border-slate-800/75 bg-slate-900/65 p-3">
                  <p className="line-clamp-1 text-sm text-slate-100">{item.title}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-400">
                    {item.userRating?.toFixed(1)} / 5 • {item.watchedDate}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </RevealSection>
    </div>
  );
}
