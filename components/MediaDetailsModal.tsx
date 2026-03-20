"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getBackdropUrl, getPosterUrl } from "@/lib/image";
import type { MediaType } from "@/lib/types";

type ActiveDetail = {
  id: number;
  mediaType: MediaType;
  whyRecommended?: string;
};

type Provider = {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
};

type CastMember = {
  id: number;
  name: string;
  character: string | null;
  profilePath: string | null;
};

type ModalDetails = {
  id: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string;
  year: string;
  genres: string[];
  rating: number;
  originalLanguage: string;
  runtimeText: string | null;
  episodeCount: string | null;
  director: string | null;
  creators: string[];
  showrunner: string | null;
  trailerKey: string | null;
  watch: {
    region: string | null;
    streaming: Provider[];
    rent: Provider[];
    buy: Provider[];
  };
  cast: CastMember[];
};

type MediaDetailsModalProps = {
  detail: ActiveDetail | null;
  onClose: () => void;
};

function getProviderLogoUrl(path: string | null): string {
  if (!path) return "https://placehold.co/92x92?text=%20";
  return `https://image.tmdb.org/t/p/w92${path}`;
}

function getProfileUrl(path: string | null): string {
  if (!path) return "https://placehold.co/185x278?text=No+Image";
  return `https://image.tmdb.org/t/p/w185${path}`;
}

export default function MediaDetailsModal({ detail, onClose }: MediaDetailsModalProps) {
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ModalDetails | null>(null);

  useEffect(() => {
    if (!detail) {
      setIsVisible(false);
      const timeout = window.setTimeout(() => setShouldRender(false), 260);
      return () => window.clearTimeout(timeout);
    }
    setShouldRender(true);
    const frame = window.requestAnimationFrame(() => setIsVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, [detail]);

  useEffect(() => {
    if (!detail) return;
    const controller = new AbortController();

    const run = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(
          `/api/media/details?id=${detail.id}&mediaType=${detail.mediaType}`,
          { signal: controller.signal }
        );
        const raw = await response.text();
        if (!response.ok) {
          throw new Error(raw || "Failed to load media details.");
        }
        setData(JSON.parse(raw) as ModalDetails);
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setError(requestError instanceof Error ? requestError.message : "Failed to load media details.");
        setData(null);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    run().catch(() => setIsLoading(false));
    return () => controller.abort();
  }, [detail]);

  useEffect(() => {
    if (!shouldRender) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [shouldRender]);

  useEffect(() => {
    if (!shouldRender) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [onClose, shouldRender]);

  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 md:items-center md:p-6">
      <button
        type="button"
        aria-label="Close details modal"
        onClick={onClose}
        className={`absolute inset-0 bg-slate-950/78 backdrop-blur-[2px] transition-opacity duration-300 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
      />

      <section
        className={`relative flex h-[92svh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl border border-slate-700/80 bg-slate-950 md:rounded-2xl transition-all duration-300 ${
          isVisible ? "translate-y-0 opacity-100 md:scale-100" : "translate-y-6 opacity-0 md:scale-[0.98]"
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-20 rounded-full bg-slate-950/85 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-200 transition-colors hover:bg-slate-800"
        >
          Close
        </button>

        <div className="relative h-[34svh] min-h-[230px] w-full shrink-0 overflow-hidden">
          <Image
            src={getBackdropUrl(data?.backdropPath)}
            alt={data?.title ?? "Backdrop"}
            fill
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/60 to-slate-950/80" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-transparent" />
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-6 md:p-8">
              <div className="h-7 w-64 animate-pulse rounded bg-slate-800" />
              <div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-slate-900" />
              <div className="mt-8 grid gap-3 md:grid-cols-2">
                <div className="h-36 animate-pulse rounded-xl bg-slate-900" />
                <div className="h-36 animate-pulse rounded-xl bg-slate-900" />
              </div>
            </div>
          ) : error || !data ? (
            <div className="p-6 md:p-8">
              <p className="text-red-300">Could not load this title.</p>
              <p className="mt-2 text-sm text-slate-400">{error ?? "Unknown error."}</p>
            </div>
          ) : (
            <div className="space-y-6 p-5 md:space-y-7 md:p-8">
              <div className="grid gap-5 md:grid-cols-[220px_1fr]">
                <div className="mx-auto w-full max-w-[220px] overflow-hidden rounded-xl border border-slate-700/70 shadow-[0_16px_38px_rgba(2,6,23,0.6)]">
                  <Image
                    src={getPosterUrl(data.posterPath)}
                    alt={data.title}
                    width={440}
                    height={660}
                    sizes="220px"
                    className="h-auto w-full object-cover"
                  />
                </div>
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-500">
                    {data.mediaType === "movie" ? "Movie" : "TV Show"}
                  </p>
                  <h2 className="text-3xl text-white md:text-5xl">{data.title}</h2>
                  <p className="text-sm text-slate-300">
                    {data.year} • {data.genres.join(" • ") || "Unknown genres"} • {data.rating.toFixed(1)} rating
                  </p>
                  <p className="text-sm text-slate-200">{data.overview || "No overview available."}</p>
                  {detail?.whyRecommended && (
                    <div className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-400">Recommendation reason</p>
                      <p className="mt-1 text-sm text-brand-500">{detail.whyRecommended}</p>
                    </div>
                  )}
                </div>
              </div>

              <section className="grid gap-4 md:grid-cols-2">
                <article className="surface-card space-y-2 p-4">
                  <p className="text-xs uppercase tracking-[0.13em] text-brand-500">Where to Watch</p>
                  {!data.watch.region ? (
                    <p className="text-sm text-slate-400">Provider data is not available for this title right now.</p>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Region: {data.watch.region}</p>
                      {[
                        { label: "Streaming", list: data.watch.streaming },
                        { label: "Rent", list: data.watch.rent },
                        { label: "Buy", list: data.watch.buy }
                      ].map((group) => (
                        <div key={group.label} className="space-y-1.5">
                          <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{group.label}</p>
                          {group.list.length === 0 ? (
                            <p className="text-sm text-slate-500">Not available</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {group.list.map((provider) => (
                                <span
                                  key={`${group.label}-${provider.provider_id}`}
                                  className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/65 px-2.5 py-1.5"
                                >
                                  <Image
                                    src={getProviderLogoUrl(provider.logo_path)}
                                    alt={provider.provider_name}
                                    width={22}
                                    height={22}
                                    className="rounded-full"
                                  />
                                  <span className="text-xs text-slate-200">{provider.provider_name}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </article>

                <article className="surface-card space-y-2 p-4">
                  <p className="text-xs uppercase tracking-[0.13em] text-brand-500">Extra Details</p>
                  <div className="space-y-1.5 text-sm text-slate-300">
                    <p>
                      <span className="text-slate-400">Original language:</span> {data.originalLanguage}
                    </p>
                    {data.runtimeText && (
                      <p>
                        <span className="text-slate-400">
                          {data.mediaType === "movie" ? "Runtime:" : "Episode runtime:"}
                        </span>{" "}
                        {data.runtimeText}
                      </p>
                    )}
                    {data.episodeCount && (
                      <p>
                        <span className="text-slate-400">Series length:</span> {data.episodeCount}
                      </p>
                    )}
                    {data.director && (
                      <p>
                        <span className="text-slate-400">Director:</span> {data.director}
                      </p>
                    )}
                    {data.creators.length > 0 && (
                      <p>
                        <span className="text-slate-400">Creator(s):</span> {data.creators.join(", ")}
                      </p>
                    )}
                    {!data.creators.length && data.showrunner && (
                      <p>
                        <span className="text-slate-400">Showrunner:</span> {data.showrunner}
                      </p>
                    )}
                  </div>
                </article>
              </section>

              <section className="surface-card space-y-3 p-4">
                <p className="text-xs uppercase tracking-[0.13em] text-brand-500">Trailer</p>
                {data.trailerKey ? (
                  <div className="overflow-hidden rounded-xl border border-slate-800/80">
                    <iframe
                      src={`https://www.youtube.com/embed/${data.trailerKey}`}
                      title={`${data.title} trailer`}
                      className="aspect-video w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No trailer is currently available for this title.</p>
                )}
              </section>

              <section className="surface-card space-y-3 p-4">
                <p className="text-xs uppercase tracking-[0.13em] text-brand-500">Cast</p>
                {!data.cast.length ? (
                  <p className="text-sm text-slate-400">Cast information is currently unavailable.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {data.cast.map((member) => (
                      <article
                        key={member.id}
                        className="rounded-xl border border-slate-800/75 bg-slate-900/65 p-3 shadow-[0_8px_20px_rgba(2,6,23,0.38)]"
                      >
                        <div className="mb-2 overflow-hidden rounded-lg bg-slate-800">
                          <Image
                            src={getProfileUrl(member.profilePath)}
                            alt={member.name}
                            width={185}
                            height={278}
                            sizes="(max-width: 768px) 42vw, 185px"
                            className="h-auto w-full object-cover"
                          />
                        </div>
                        <p className="line-clamp-1 text-sm text-slate-100">{member.name}</p>
                        <p className="line-clamp-1 text-xs text-slate-400">{member.character ?? "Role unavailable"}</p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
