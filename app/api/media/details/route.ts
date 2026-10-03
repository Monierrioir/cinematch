import { NextRequest, NextResponse } from "next/server";
import { selectBestYouTubeVideoKey } from "@/lib/media-video";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getMediaDetailsForView, type TmdbProvider } from "@/lib/tmdb";
import type { MediaType } from "@/lib/types";
import { z } from "zod";

const detailsQuerySchema = z.object({
  id: z.coerce.number().int().positive(),
  mediaType: z.enum(["movie", "tv"])
});

function toMediaType(value: string | null): MediaType | null {
  if (value === "movie" || value === "tv") return value;
  return null;
}

function pickRegion(resultMap: Record<string, unknown> | undefined): string | null {
  if (!resultMap) return null;
  const available = Object.keys(resultMap);
  if (!available.length) return null;
  const preferred = ["US", "TR", "GB", "DE", "FR", "ES"];
  return preferred.find((region) => available.includes(region)) ?? available[0] ?? null;
}

function dedupeProviders(providers: TmdbProvider[] = []): TmdbProvider[] {
  const seen = new Set<number>();
  return providers.filter((provider) => {
    if (seen.has(provider.provider_id)) return false;
    seen.add(provider.provider_id);
    return true;
  });
}

function formatRuntime(minutes?: number): string | null {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${minutes} min`;
  return `${hours}h ${remainder}m`;
}

export async function GET(request: NextRequest) {
  const clientKey = request.headers.get("x-forwarded-for") ?? request.ip ?? "anonymous";
  const rate = consumeRateLimit(`details:${clientKey}`, 60, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many detail requests. Please try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfterSeconds)
        }
      }
    );
  }
  const parsedQuery = detailsQuerySchema.safeParse({
    id: request.nextUrl.searchParams.get("id"),
    mediaType: request.nextUrl.searchParams.get("mediaType")
  });
  if (!parsedQuery.success) {
    return NextResponse.json({ error: "Invalid mediaType or id." }, { status: 400 });
  }
  const mediaType = toMediaType(parsedQuery.data.mediaType);
  const id = parsedQuery.data.id;

  if (!mediaType || Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid mediaType or id." }, { status: 400 });
  }

  try {
    const item = await getMediaDetailsForView(id, mediaType);
    const watchProviderResults = item["watch/providers"]?.results;
    const region = pickRegion(watchProviderResults);
    const regionWatchData =
      region && watchProviderResults
        ? (watchProviderResults[region] as
            | { flatrate?: TmdbProvider[]; rent?: TmdbProvider[]; buy?: TmdbProvider[] }
            | undefined)
        : undefined;

    const streaming = dedupeProviders(regionWatchData?.flatrate);
    const rent = dedupeProviders(regionWatchData?.rent);
    const buy = dedupeProviders(regionWatchData?.buy);
    const cast = (item.credits?.cast ?? [])
      .slice()
      .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
      .slice(0, 8)
      .map((member) => ({
        id: member.id,
        name: member.name,
        character: member.character ?? null,
        profilePath: member.profile_path ?? null
      }));
    const crew = item.credits?.crew ?? [];
    const director = mediaType === "movie" ? crew.find((member) => member.job === "Director")?.name ?? null : null;
    const creators = mediaType === "tv" ? (item.created_by ?? []).map((person) => person.name) : [];
    const showrunner =
      mediaType === "tv"
        ? crew.find((member) => member.job === "Showrunner" || member.job === "Creator")?.name ?? null
        : null;

    return NextResponse.json({
      id: item.id,
      mediaType,
      title: item.title,
      posterPath: item.poster_path,
      backdropPath: item.backdrop_path,
      overview: item.overview,
      releaseDate: item.release_date ?? "Unknown",
      year: (item.release_date ?? "Unknown").slice(0, 4),
      genres: (item.genres ?? []).map((genre) => genre.name),
      genreIds: (item.genres ?? []).map((genre) => genre.id),
      rating: item.vote_average ?? 0,
      popularity: item.popularity ?? 0,
      originalLanguage: (item.original_language ?? "unknown").toUpperCase(),
      runtimeText:
        mediaType === "movie"
          ? formatRuntime(item.runtime)
          : item.episode_run_time?.[0]
            ? `${item.episode_run_time[0]} min / episode`
            : null,
      episodeCount:
        mediaType === "tv"
          ? `${item.number_of_episodes ?? "?"} episodes • ${item.number_of_seasons ?? "?"} seasons`
          : null,
      director,
      creators,
      showrunner,
      trailerKey: selectBestYouTubeVideoKey(item.videos?.results ?? []),
      watch: {
        region,
        streaming,
        rent,
        buy
      },
      cast
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to load media details.", details: message }, { status: 500 });
  }
}
