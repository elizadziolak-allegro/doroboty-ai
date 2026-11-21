import { afterEach, expect, it, vi } from "vitest";
import { openAIService } from "./service";
import type { Budget } from "./budget";
import { screeningFixture } from "../tests/screening-fixture";
import { DemoConfigurationError } from "./demo-budget";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
function budget(): Budget {
  return {
    reserve: vi.fn(async () => {}),
    usage: vi.fn(),
    status: () => ({ textOnly: true, attemptsRemaining: 12, reservedUsd: 2.6, maximumUsd: 5 }),
  };
}
it("waits for a successful asynchronous reservation before contacting OpenAI", async () => {
  vi.stubEnv("OPENAI_API_KEY", "not-a-real-key");
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const limit = budget();
  limit.reserve = async () => {
    await Promise.resolve();
    throw new DemoConfigurationError();
  };
  await expect(openAIService(limit).questions(screeningFixture().context)).rejects.toBeInstanceOf(
    DemoConfigurationError,
  );
  expect(fetcher).not.toHaveBeenCalled();
});
it("allows a slow summary window and aborts an unresponsive provider at 45 seconds without retrying or refunding", async () => {
  vi.useFakeTimers();
  vi.stubEnv("OPENAI_API_KEY", "not-a-real-key");
  const fetcher = vi.fn(
    (_input: unknown, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      }),
  );
  vi.stubGlobal("fetch", fetcher);
  const limit = budget();
  const result = expect(
    openAIService(limit).questions(screeningFixture().context),
  ).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(20001);
  expect(limit.usage).not.toHaveBeenCalled();
  expect(fetcher.mock.calls[0][1].signal?.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(25000);
  await result;
  expect(fetcher).toHaveBeenCalledTimes(1);
  const request = JSON.parse(String(fetcher.mock.calls[0][1].body));
  expect(request.reasoning.effort).toBe("low");
  expect(request.text.verbosity).toBe("low");
  expect(limit.reserve).toHaveBeenCalledTimes(1);
  expect(limit.usage).not.toHaveBeenCalled();
});

it("settles provider usage before rejecting invalid generated JSON", async () => {
  vi.stubEnv("OPENAI_API_KEY", "not-a-real-key");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        id: "resp-test",
        object: "response",
        status: "completed",
        output: [
          {
            type: "message",
            id: "msg-test",
            role: "assistant",
            status: "completed",
            content: [{ type: "output_text", text: "invalid-json", annotations: [] }],
          },
        ],
        usage: {
          input_tokens: 1000,
          input_tokens_details: { cached_tokens: 400 },
          output_tokens: 100,
          output_tokens_details: { reasoning_tokens: 50 },
          total_tokens: 1100,
        },
      }),
    ),
  );
  const limit = budget();
  limit.reserve = vi.fn(async () => "reservation-receipt");
  await expect(openAIService(limit).questions(screeningFixture().context)).rejects.toThrow();
  expect(limit.usage).toHaveBeenCalledWith(1000, 100, 400, "reservation-receipt");
});

it("returns valid provider questions after settling the matching reservation", async () => {
  vi.stubEnv("OPENAI_API_KEY", "not-a-real-key");
  const questions = screeningFixture().questions;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        id: "resp-valid",
        object: "response",
        status: "completed",
        output: [
          {
            type: "message",
            id: "msg-valid",
            role: "assistant",
            status: "completed",
            content: [
              { type: "output_text", text: JSON.stringify({ questions }), annotations: [] },
            ],
          },
        ],
        usage: {
          input_tokens: 1000,
          input_tokens_details: { cached_tokens: 400 },
          output_tokens: 100,
          total_tokens: 1100,
        },
      }),
    ),
  );
  const limit = budget();
  limit.reserve = vi.fn(async () => "matching-receipt");
  expect(await openAIService(limit).questions(screeningFixture().context)).toEqual({ questions });
  expect(limit.usage).toHaveBeenCalledWith(1000, 100, 400, "matching-receipt");
});
