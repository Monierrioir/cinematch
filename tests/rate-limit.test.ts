import { describe, expect, it } from "vitest";
import { consumeRateLimit } from "@/lib/rate-limit";

describe("consumeRateLimit", () => {
  it("blocks after limit is reached", () => {
    const now = Date.now();
    const key = `rate-limit-test-${now}`;
    const first = consumeRateLimit(key, 2, 1_000, now);
    const second = consumeRateLimit(key, 2, 1_000, now + 10);
    const third = consumeRateLimit(key, 2, 1_000, now + 20);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
  });

  it("resets after window passes", () => {
    const now = Date.now();
    const key = `rate-limit-reset-test-${now}`;
    consumeRateLimit(key, 1, 200, now);
    const blocked = consumeRateLimit(key, 1, 200, now + 10);
    const reset = consumeRateLimit(key, 1, 200, now + 250);

    expect(blocked.allowed).toBe(false);
    expect(reset.allowed).toBe(true);
  });
});
