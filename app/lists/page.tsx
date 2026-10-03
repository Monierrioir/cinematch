"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import RevealSection from "@/components/RevealSection";
import { usePersonalTracker } from "@/hooks/usePersonalTracker";
import { getPosterUrl } from "@/lib/image";

export default function ListsPage() {
  const { store, createList, renameList, deleteList, removeItemFromList, moveToWatched } = usePersonalTracker();
  const [newName, setNewName] = useState("");
  const [renameDraft, setRenameDraft] = useState<Record<string, string>>({});
  const lists = useMemo(() => store?.customLists ?? [], [store]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <RevealSection delayMs={40} durationMs={700}>
        <header className="surface-card p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-brand-500">Collections</p>
          <h1 className="mt-1 text-4xl text-white md:text-5xl">Custom Lists</h1>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Create a new list"
              className="rounded-lg border border-slate-700/70 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 outline-none"
            />
            <button
              type="button"
              onClick={() => {
                if (!newName.trim()) return;
                createList(newName);
                setNewName("");
              }}
              className="btn-primary px-4 py-2 text-xs"
            >
              Create List
            </button>
          </div>
        </header>
      </RevealSection>

      {lists.length === 0 ? (
        <section className="surface-card p-6">
          <p className="text-slate-300">No lists yet. Create your first custom list.</p>
        </section>
      ) : (
        <section className="space-y-4">
          {lists.map((list) => (
            <article key={list.id} className="surface-card space-y-3 p-4 md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-lg text-white">{list.name}</p>
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                    {list.items.length} titles
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={renameDraft[list.id] ?? ""}
                    onChange={(event) =>
                      setRenameDraft((current) => ({ ...current, [list.id]: event.target.value }))
                    }
                    placeholder="Rename"
                    className="rounded-lg border border-slate-700/70 bg-slate-900/70 px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const value = (renameDraft[list.id] ?? "").trim();
                      if (!value) return;
                      renameList(list.id, value);
                      setRenameDraft((current) => ({ ...current, [list.id]: "" }));
                    }}
                    className="btn-secondary px-3 py-2 text-xs"
                  >
                    Rename
                  </button>
                  {list.id !== "favorites" && (
                    <button
                      type="button"
                      onClick={() => deleteList(list.id)}
                      className="btn-secondary px-3 py-2 text-xs"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {list.items.length === 0 ? (
                <p className="text-sm text-slate-500">No items yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {list.items.map((item) => (
                    <div key={item.key} className="space-y-2">
                      <div className="relative aspect-[2/3] overflow-hidden rounded-lg">
                        <Image
                          src={getPosterUrl(item.posterPath)}
                          alt={item.title}
                          fill
                          sizes="(max-width: 768px) 40vw, 170px"
                          className="object-cover"
                        />
                      </div>
                      <p className="line-clamp-1 text-sm text-slate-200">{item.title}</p>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => moveToWatched(item.mediaType, item.id)}
                          className="rounded-full bg-brand-500 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-white"
                        >
                          Watched
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItemFromList(list.id, item.mediaType, item.id)}
                          className="rounded-full bg-slate-900/70 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-slate-300"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
