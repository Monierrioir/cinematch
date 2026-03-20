import { describe, expect, it } from "vitest";
import { selectBestYouTubeVideoKey } from "@/lib/media-video";

describe("selectBestYouTubeVideoKey", () => {
  it("prefers official trailer over teaser/trailer", () => {
    const result = selectBestYouTubeVideoKey([
      { site: "YouTube", type: "Teaser", key: "teaser-key", official: false },
      { site: "YouTube", type: "Trailer", key: "trailer-key", official: false },
      { site: "YouTube", type: "Trailer", key: "official-key", official: true }
    ]);
    expect(result).toBe("official-key");
  });

  it("returns null when youtube videos are missing", () => {
    const result = selectBestYouTubeVideoKey([
      { site: "Vimeo", type: "Trailer", key: "vimeo-trailer", official: true }
    ]);
    expect(result).toBeNull();
  });
});
