import { describe, expect, it } from "vitest";
import { buildRecommendations } from "@/lib/recommendation";
import type { SelectedMovie, TmdbMovie } from "@/lib/types";

function createMovie(input: Partial<TmdbMovie> & Pick<TmdbMovie, "id" | "title">): TmdbMovie {
  return {
    id: input.id,
    title: input.title,
    overview: input.overview ?? "",
    poster_path: input.poster_path ?? null,
    genre_ids: input.genre_ids ?? [],
    release_date: input.release_date ?? "2020-01-01",
    popularity: input.popularity ?? 50,
    vote_average: input.vote_average ?? 7.5,
    vote_count: input.vote_count ?? 100,
    media_type: input.media_type ?? "movie",
    original_language: input.original_language ?? "en",
    production_countries: input.production_countries ?? [{ iso_3166_1: "US", name: "United States" }],
    keywordNames: input.keywordNames ?? []
  };
}

describe("buildRecommendations", () => {
  it("adds becauseYouLikedTitle from selected references", () => {
    const selected: SelectedMovie[] = [
      {
        id: 1,
        title: "Anchor Film",
        mediaType: "movie",
        genreIds: [18, 10749]
      }
    ];
    const selectedDetailed: TmdbMovie[] = [
      createMovie({
        id: 1,
        title: "Anchor Film",
        genre_ids: [18, 10749],
        overview: "emotional romantic drama",
        keywordNames: ["emotion", "romance"]
      })
    ];
    const candidates: TmdbMovie[] = [
      createMovie({
        id: 10,
        title: "Candidate One",
        genre_ids: [18, 10749],
        overview: "emotional story with romance",
        keywordNames: ["emotion", "romance"]
      })
    ];
    const genreMap = new Map<number, string>([
      [18, "Drama"],
      [10749, "Romance"]
    ]);

    const recommendations = buildRecommendations(
      selected,
      candidates,
      genreMap,
      selectedDetailed,
      {
        preferredMediaType: "movie",
        preferredLanguage: "en",
        favoriteGenreIds: [18]
      },
      5
    );

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0]?.becauseYouLikedTitle).toBe("Anchor Film");
  });
});
