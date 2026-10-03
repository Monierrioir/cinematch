"use client";

import Image from "next/image";
import { useMemo } from "react";
import RevealSection from "@/components/RevealSection";
import { usePersonalTracker } from "@/hooks/usePersonalTracker";
import { getPosterUrl } from "@/lib/image";

export default function HistoryPage() {
  const { store, removeWatched, setRating } = usePersonalTracker();
  const watched = useMemo(
    () =>
      Object.values(store?.watched ?? {}).sort(
        (a, b) => new Date(b.watchedDate).getTime() - new Date(a.watchedDate).getTime()
      ),
    [store]
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <RevealSection delayMs={40} durationMs={700}>
        <header className="surface-card p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-brand-500">Journal</p>
          <h1 className="mt-1 text-4xl text-white md:text-5xl">Watched History</h1>
          <p className="mt-2 text-slate-300">Everything you watched, rated, and revisited in one timeline.</p>
        </header>
      </RevealSection>

      {watched.length === 0 ? (
        <section className="surface-card p-6">
          <p className="text-slate-300">No watched titles yet. Mark titles as watched from detail modals.</p>
        </section>
      ) : (
        <section className="grid gap-4">
          {watched.map((item) => (
            <article key={item.key} className="surface-card flex gap-4 p-4">
              <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-lg">
                <Image src={getPosterUrl(item.posterPath)} alt={item.title} fill sizes="80px" className="object-cover" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="line-clamp-1 text-lg text-white">{item.title}</p>
                <p className="text-xs uppercase tracking-[0.12em] text-slate-400">
                  {item.mediaType === "movie" ? "Movie" : "TV"} • Watched {item.watchedDate}
                </p>
                <p className="line-clamp-1 text-sm text-slate-400">{item.genres.join(" • ") || "Unknown genres"}</p>
                <p className="text-xs text-slate-500">
                  Rewatches: {item.rewatchCount} • Total watches: {item.watchHistory.length}
                </p>
                <div className="flex flex-wrap gap-1">
                  {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((value) => (
                    <button
                      key={`${item.key}-rate-${value}`}
                      type="button"
                      onClick={() => setRating(item.mediaType, item.id, value)}
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        item.userRating === value
                          ? "bg-brand-500 text-white"
                          : "bg-slate-900/70 text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      {value.toFixed(1)}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeWatched(item.mediaType, item.id)}
                className="btn-secondary h-fit px-3 py-2 text-xs"
              >
                Remove
              </button>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
