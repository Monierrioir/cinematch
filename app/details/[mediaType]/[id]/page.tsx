import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import TrackActionsPanel from "@/components/TrackActionsPanel";
import { getBackdropUrl, getPosterUrl } from "@/lib/image";
import { selectBestYouTubeVideoKey } from "@/lib/media-video";
import type { TrackableTitleInput } from "@/lib/personal-tracker";
import { getMediaDetailsForView, type TmdbProvider } from "@/lib/tmdb";
import { getBookInfoForMovie } from "@/services/books";
import type { MediaType } from "@/lib/types";

type DetailsPageProps = {
  params: { mediaType: string; id: string };
  searchParams: { why?: string };
};

function toMediaType(value: string): MediaType | null {
  if (value === "movie" || value === "tv") return value;
  return null;
}

function getProviderLogoUrl(path?: string | null): string {
  if (!path) return "https://placehold.co/92x92?text=%20";
  return `https://image.tmdb.org/t/p/w92${path}`;
}

function dedupeProviders(providers: TmdbProvider[] = []): TmdbProvider[] {
  const seen = new Set<number>();
  const unique: TmdbProvider[] = [];
  providers.forEach((provider) => {
    if (seen.has(provider.provider_id)) return;
    seen.add(provider.provider_id);
    unique.push(provider);
  });
  return unique;
}

function pickRegion(resultMap: Record<string, unknown> | undefined): string | null {
  if (!resultMap) return null;
  const available = Object.keys(resultMap);
  if (!available.length) return null;
  const preferred = ["US", "TR", "GB", "DE", "FR", "ES"];
  const matchedPreferred = preferred.find((code) => available.includes(code));
  return matchedPreferred ?? available[0] ?? null;
}

function formatRuntime(minutes?: number): string | null {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${minutes} min`;
  return `${hours}h ${remainder}m`;
}

export default async function DetailsPage({ params, searchParams }: DetailsPageProps) {
  const mediaType = toMediaType(params.mediaType);
  const itemId = Number(params.id);

  if (!mediaType || Number.isNaN(itemId)) {
    notFound();
  }

  const item = await getMediaDetailsForView(itemId, mediaType);
  const bookInfo = mediaType === "movie" ? getBookInfoForMovie(itemId) : null;
  const whyRecommended =
    searchParams.why ??
    "Matched to your taste profile based on style, theme, and relevance scoring.";
  const cast = (item.credits?.cast ?? [])
    .slice()
    .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 8);
  const crew = item.credits?.crew ?? [];
  const director = mediaType === "movie" ? crew.find((member) => member.job === "Director")?.name : null;
  const createdBy = mediaType === "tv" ? (item.created_by ?? []).map((person) => person.name) : [];
  const showrunner =
    mediaType === "tv"
      ? crew.find((member) => member.job === "Showrunner" || member.job === "Creator")?.name ?? null
      : null;
  const runtimeText =
    mediaType === "movie"
      ? formatRuntime(item.runtime)
      : item.episode_run_time?.[0]
        ? `${item.episode_run_time[0]} min / episode`
        : null;
  const episodeCount =
    mediaType === "tv"
      ? `${item.number_of_episodes ?? "?"} episodes • ${item.number_of_seasons ?? "?"} seasons`
      : null;
  const trailerKey = selectBestYouTubeVideoKey(item.videos?.results ?? []);
  const watchProviderResults = item["watch/providers"]?.results;
  const region = pickRegion(watchProviderResults);
  const regionWatchData =
    region && watchProviderResults ? (watchProviderResults[region] as { flatrate?: TmdbProvider[]; rent?: TmdbProvider[]; buy?: TmdbProvider[] } | undefined) : undefined;
  const streamingProviders = dedupeProviders(regionWatchData?.flatrate);
  const rentProviders = dedupeProviders(regionWatchData?.rent);
  const buyProviders = dedupeProviders(regionWatchData?.buy);
  const trackableTitle: TrackableTitleInput = {
    id: item.id,
    mediaType,
    title: item.title,
    posterPath: item.poster_path,
    genres: (item.genres ?? []).map((genre) => genre.name),
    genreIds: (item.genres ?? []).map((genre) => genre.id),
    releaseDate: item.release_date ?? "Unknown",
    popularity: item.popularity ?? 0,
    voteAverage: item.vote_average ?? 0,
    originalLanguage: item.original_language ?? null
  };

  return (
    <div className="space-y-8 md:space-y-10">
      <section className="relative overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-950">
        <div className="relative h-[52svh] min-h-[360px] w-full md:h-[62svh]">
          <Image
            src={getBackdropUrl(item.backdrop_path)}
            alt={item.title}
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/55 to-slate-950/75" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/35 to-transparent" />
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 p-5 md:p-8">
          <Link href="/recommendations" className="btn-secondary mb-4 inline-flex">
            Back to Recommendations
          </Link>
          <div className="grid gap-6 md:grid-cols-[220px_1fr]">
            <div className="hidden md:block">
              <div className="overflow-hidden rounded-xl border border-slate-700/70 shadow-[0_16px_40px_rgba(2,6,23,0.6)]">
                <Image
                  src={getPosterUrl(item.poster_path)}
                  alt={item.title}
                  width={440}
                  height={660}
                  sizes="220px"
                  className="h-auto w-full object-cover"
                />
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.14em] text-brand-500/95">
                {mediaType === "movie" ? "Movie" : "TV Show"}
              </p>
              <h1 className="text-4xl text-white md:text-6xl">{item.title}</h1>
              <p className="text-sm text-slate-300">
                {(item.release_date ?? "Unknown").slice(0, 4)} •{" "}
                {item.genres?.map((genre) => genre.name).join(" • ") || "Unknown genres"} •{" "}
                {(item.vote_average ?? 0).toFixed(1)} rating
              </p>
              <p className="max-w-3xl text-sm text-slate-200 md:text-base">
                {item.overview || "No overview available."}
              </p>
              <div className="rounded-xl border border-slate-700/70 bg-slate-950/65 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Recommendation reason</p>
                <p className="mt-1 text-sm text-brand-500">{whyRecommended}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <TrackActionsPanel title={trackableTitle} />
        <article className="surface-card space-y-3 p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-brand-500">Extra Details</p>
          <div className="space-y-2 text-sm text-slate-300">
            <p>
              <span className="text-slate-400">Original language:</span>{" "}
              {(item.original_language ?? "Unknown").toUpperCase()}
            </p>
            {runtimeText && (
              <p>
                <span className="text-slate-400">{mediaType === "movie" ? "Runtime:" : "Episode runtime:"}</span>{" "}
                {runtimeText}
              </p>
            )}
            {episodeCount && (
              <p>
                <span className="text-slate-400">Series length:</span> {episodeCount}
              </p>
            )}
            {director && (
              <p>
                <span className="text-slate-400">Director:</span> {director}
              </p>
            )}
            {createdBy.length > 0 && (
              <p>
                <span className="text-slate-400">Creator(s):</span> {createdBy.join(", ")}
              </p>
            )}
            {!createdBy.length && showrunner && (
              <p>
                <span className="text-slate-400">Showrunner:</span> {showrunner}
              </p>
            )}
          </div>
        </article>

        <article className="surface-card space-y-3 p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-brand-500">Where to Watch</p>
          {!regionWatchData ? (
            <p className="text-sm text-slate-400">Provider data is not available for this title right now.</p>
          ) : (
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Region: {region}</p>

              {[
                { label: "Streaming", providers: streamingProviders },
                { label: "Rent", providers: rentProviders },
                { label: "Buy", providers: buyProviders }
              ].map((group) => (
                <div key={group.label} className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{group.label}</p>
                  {group.providers.length === 0 ? (
                    <p className="text-sm text-slate-500">Not available</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {group.providers.map((provider) => (
                        <div
                          key={`${group.label}-${provider.provider_id}`}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/70 px-2.5 py-1.5"
                        >
                          <Image
                            src={getProviderLogoUrl(provider.logo_path)}
                            alt={provider.provider_name}
                            width={24}
                            height={24}
                            className="rounded-full"
                          />
                          <span className="text-xs text-slate-200">{provider.provider_name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="surface-card space-y-4 p-5">
        <p className="text-xs uppercase tracking-[0.14em] text-brand-500">Trailer</p>
        {trailerKey ? (
          <div className="overflow-hidden rounded-xl border border-slate-800/80">
            <iframe
              src={`https://www.youtube.com/embed/${trailerKey}`}
              title={`${item.title} trailer`}
              className="aspect-video w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        ) : (
          <p className="text-sm text-slate-400">No trailer is currently available for this title.</p>
        )}
      </section>

      <section className="surface-card space-y-4 p-5">
        <p className="text-xs uppercase tracking-[0.14em] text-brand-500">Main Cast</p>
        {!cast.length ? (
          <p className="text-sm text-slate-400">Cast information is currently unavailable.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {cast.map((member) => (
              <article
                key={member.id}
                className="rounded-xl border border-slate-800/75 bg-slate-900/65 p-3 shadow-[0_8px_20px_rgba(2,6,23,0.38)]"
              >
                <div className="mb-2 overflow-hidden rounded-lg bg-slate-800">
                  <Image
                    src={
                      member.profile_path
                        ? `https://image.tmdb.org/t/p/w185${member.profile_path}`
                        : "https://placehold.co/185x278?text=No+Image"
                    }
                    alt={member.name}
                    width={185}
                    height={278}
                    sizes="(max-width: 768px) 45vw, 185px"
                    className="h-auto w-full object-cover"
                  />
                </div>
                <p className="line-clamp-1 text-sm text-slate-100">{member.name}</p>
                <p className="line-clamp-1 text-xs text-slate-400">{member.character || "Role unavailable"}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="surface-card p-5">
        <p className="text-xs uppercase tracking-[0.14em] text-brand-500">Related Book</p>
        {mediaType === "tv" ? (
          <p className="mt-2 text-sm text-slate-400">
            Book adaptation matching is currently available for movie recommendations.
          </p>
        ) : bookInfo ? (
          <div className="mt-2 space-y-1">
            <p className="text-slate-100">{bookInfo.title}</p>
            <p className="text-sm text-slate-400">by {bookInfo.author}</p>
            <p className="text-sm text-slate-300">{bookInfo.note}</p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-400">
            No linked adaptation found in the current mock dataset.
          </p>
        )}
      </section>
    </div>
  );
}
