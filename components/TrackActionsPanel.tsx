"use client";

import { useState } from "react";
import { usePersonalTracker } from "@/hooks/usePersonalTracker";
import { trackTasteProfileEvent } from "@/lib/storage";
import { inferToneFromGenres } from "@/lib/taste-profile";
import type { TrackableTitleInput } from "@/lib/personal-tracker";

type TrackActionsPanelProps = {
  title: TrackableTitleInput;
};

export default function TrackActionsPanel({ title }: TrackActionsPanelProps) {
  const [watchedDate, setWatchedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [listId, setListId] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const { store, markWatched, setRating, toggleInWatchlist, addItemToList } = usePersonalTracker();
  const key = `${title.mediaType}:${title.id}`;
  const watchedRecord = store?.watched[key];
  const watchlistRecord = store?.watchlist[key];
  const rating = store?.ratings[key];

  return (
    <article className="surface-card space-y-3 p-5">
      <p className="text-xs uppercase tracking-[0.14em] text-brand-500">Track Actions</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={watchedDate}
          onChange={(event) => setWatchedDate(event.target.value)}
          className="rounded-lg border border-slate-700/70 bg-slate-900/70 px-2 py-1.5 text-xs text-slate-200 outline-none"
        />
        <button
          type="button"
          onClick={() => {
            markWatched(title, { watchedDate, rewatch: Boolean(watchedRecord) });
            trackTasteProfileEvent({
              type: watchedRecord ? "love" : "like",
              mediaType: title.mediaType,
              genreIds: title.genreIds ?? [],
              releaseYear: title.releaseDate,
              voteAverage: title.voteAverage,
              popularity: title.popularity,
              originalLanguage: title.originalLanguage ?? null,
              toneHint: inferToneFromGenres(title.genreIds ?? [])
            });
            setMessage(watchedRecord ? "Rewatch recorded." : "Added to watched history.");
          }}
          className="btn-primary px-3 py-2 text-xs"
        >
          {watchedRecord ? "Mark Rewatch" : "Mark Watched"}
        </button>
        <button
          type="button"
          onClick={() => {
            const inWatchlist = toggleInWatchlist(title);
            setMessage(inWatchlist ? "Added to watchlist." : "Removed from watchlist.");
          }}
          className="btn-secondary px-3 py-2 text-xs"
        >
          {watchlistRecord ? "Remove Watchlist" : "Add to Watchlist"}
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((value) => (
          <button
            key={`detail-rate-${value}`}
            type="button"
            onClick={() => {
              setRating(title.mediaType, title.id, value);
              setMessage(`Rated ${value.toFixed(1)} stars.`);
            }}
            className={`rounded-full px-2 py-0.5 text-[11px] ${
              rating === value ? "bg-brand-500 text-white" : "bg-slate-900/70 text-slate-300 hover:bg-slate-800"
            }`}
          >
            {value.toFixed(1)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={listId}
          onChange={(event) => setListId(event.target.value)}
          className="rounded-lg border border-slate-700/70 bg-slate-900/70 px-2 py-1.5 text-xs text-slate-200 outline-none"
        >
          <option value="">Add to list...</option>
          {(store?.customLists ?? []).map((list) => (
            <option key={list.id} value={list.id}>
              {list.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!listId}
          onClick={() => {
            if (!listId) return;
            addItemToList(listId, title);
            setMessage("Added to list.");
          }}
          className="btn-secondary px-3 py-2 text-xs disabled:opacity-45"
        >
          Add
        </button>
      </div>
      {watchedRecord && (
        <p className="text-xs text-slate-400">
          Watches: {watchedRecord.watchHistory.length} • Rewatches: {watchedRecord.rewatchCount}
        </p>
      )}
      {message && <p className="text-xs text-brand-500">{message}</p>}
    </article>
  );
}
