"use client";

import { useEffect, useState } from "react";
import TopPicksForYou, { type TopPickItem } from "@/components/TopPicksForYou";

type MoodKey = "relaxed" | "excited" | "emotional" | "dark";

const MOOD_OPTIONS: Array<{ key: MoodKey; label: string }> = [
  { key: "relaxed", label: "Relaxed" },
  { key: "excited", label: "Excited" },
  { key: "emotional", label: "Emotional" },
  { key: "dark", label: "Dark" }
];

export default function MoodRecommender() {
  const [activeMood, setActiveMood] = useState<MoodKey>("relaxed");
  const [items, setItems] = useState<TopPickItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const loadMoodRecommendations = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(`/api/mood/recommendations?mood=${activeMood}&mediaType=movie`, {
          signal: controller.signal
        });
        const rawBody = await response.text();
        if (!response.ok) throw new Error(rawBody || "Failed to fetch mood recommendations.");
        const data = JSON.parse(rawBody) as { recommendations?: TopPickItem[] };
        setItems(Array.isArray(data.recommendations) ? data.recommendations : []);
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setError(requestError instanceof Error ? requestError.message : "Failed to fetch mood recommendations.");
        setItems([]);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    loadMoodRecommendations().catch(() => setIsLoading(false));
    return () => controller.abort();
  }, [activeMood]);

  return (
    <section className="card-entrance space-y-6">
      <div className="px-5 md:px-10">
        <p className="featured-accent-text text-xs uppercase tracking-[0.2em]">Mood Discovery</p>
        <h2 className="section-title mt-2">What do you feel like?</h2>
        <div className="mt-4 flex flex-wrap gap-2.5">
          {MOOD_OPTIONS.map((mood) => (
            <button
              key={mood.key}
              type="button"
              onClick={() => setActiveMood(mood.key)}
              className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.12em] transition-all ${
                activeMood === mood.key
                  ? "featured-accent-border featured-accent-surface featured-accent-text featured-accent-glow scale-[1.015]"
                  : "border-slate-700 bg-slate-900/55 text-slate-300 hover:-translate-y-0.5 hover:border-slate-500 hover:text-slate-100"
              }`}
            >
              {mood.label}
            </button>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
      </div>

      <TopPicksForYou
        items={items}
        isLoading={isLoading}
        title={`Because you're feeling ${MOOD_OPTIONS.find((mood) => mood.key === activeMood)?.label ?? "Something"}`}
        eyebrow="Mood-Based Picks"
      />
    </section>
  );
}
