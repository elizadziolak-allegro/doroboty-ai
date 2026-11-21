import { afterEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { screeningRequest } from "./api";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("reports provider errors without turning them into simulated success", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "Limit OpenAI. Ponów próbę." }), { status: 429 }),
    ),
  );
  await expect(screeningRequest("questions", {}, z.object({}))).rejects.toThrow("Limit OpenAI");
});
it("aborts a timed-out call and offers retry/skip", async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_url: string, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    ),
  );
  const result = expect(screeningRequest("summary", {}, z.object({}))).rejects.toThrow(
    "Przekroczono czas",
  );
  await vi.advanceTimersByTimeAsync(75000);
  await result;
});
