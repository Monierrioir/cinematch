type MediaVideo = {
  site?: string;
  type?: string;
  official?: boolean;
  key?: string;
  name?: string;
  published_at?: string;
};

function getVideoPriority(video: Pick<MediaVideo, "type" | "official" | "name">): number {
  const type = (video.type ?? "").toLowerCase();
  const name = (video.name ?? "").toLowerCase();
  const isOfficialTrailer = type === "trailer" && (video.official || name.includes("official trailer"));
  if (isOfficialTrailer) return 3;
  if (type === "trailer") return 2;
  if (type === "teaser") return 1;
  return 0;
}

export function selectBestYouTubeVideoKey(videos: MediaVideo[]): string | null {
  if (!videos.length) return null;
  const youtube = videos.filter((video) => video.site === "YouTube" && video.key);
  if (!youtube.length) return null;

  youtube.sort((a, b) => {
    const aPriority = getVideoPriority(a);
    const bPriority = getVideoPriority(b);
    if (bPriority !== aPriority) return bPriority - aPriority;
    const aOfficial = a.official ? 1 : 0;
    const bOfficial = b.official ? 1 : 0;
    if (bOfficial !== aOfficial) return bOfficial - aOfficial;
    const aDate = a.published_at ? Date.parse(a.published_at) : 0;
    const bDate = b.published_at ? Date.parse(b.published_at) : 0;
    return bDate - aDate;
  });

  return youtube[0]?.key ?? null;
}
