import type { BookInfo } from "@/lib/types";

const MOCK_BOOK_ADAPTATIONS: Record<number, BookInfo> = {
  78: {
    title: "Blade Runner (Do Androids Dream of Electric Sheep?)",
    author: "Philip K. Dick",
    note: "Blade Runner is loosely adapted from this sci-fi novel."
  },
  98: {
    title: "Gladiator: Son of Spartacus (inspiration references)",
    author: "Various historical-fiction references",
    note: "No direct single novel source, but often linked to historical epics."
  },
  105: {
    title: "Back to the Future: The Novelization",
    author: "George Gipe",
    note: "Novelization published after the film's release."
  },
  497: {
    title: "The Green Mile",
    author: "Stephen King",
    note: "The movie is based on Stephen King's serialized novel."
  },
  372058: {
    title: "Your Name.",
    author: "Makoto Shinkai",
    note: "The film and novel adaptation were released together by the same creator."
  }
};

export function getBookInfoForMovie(movieId: number): BookInfo | null {
  return MOCK_BOOK_ADAPTATIONS[movieId] ?? null;
}
