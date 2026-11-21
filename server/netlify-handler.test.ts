import { afterEach, expect, it, vi } from "vitest";
import { publicHandler } from "./netlify-handler";
import { screeningFixture } from "../tests/screening-fixture";
import { DemoConfigurationError, DemoLimitError } from "./demo-budget";
import type { ScreeningService } from "./service";
import screening from "../netlify/functions/screening";
import type { Context } from "@netlify/functions";
import OpenAI from "openai";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
const fixture = screeningFixture();
it("identifies an SDK summary timeout and tells the visitor how to recover without leaking errors", async () => {
  const fake = service();
  fake.summarize = vi.fn(async () => {
    throw new OpenAI.APIConnectionTimeoutError();
  });
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await publicHandler(() => fake)(request("summary", fixture));
  expect(response.status).toBe(503);
  const body = await response.json();
  expect(body.error).toContain("Przygotowanie podsumowania AI przekroczyło czas");
  expect(body.error).toContain("Przygotuj podsumowanie AI");
  expect(body.requestId).toEqual(expect.any(String));
  expect(JSON.parse(spy.mock.calls[0][0])).toMatchObject({
    operation: "summary",
    category: "timeout",
  });
});
function service(): ScreeningService {
  return {
    questions: vi.fn(async () => ({ questions: fixture.questions })),
    summarize: vi.fn(async () => fixture.summary),
    next: vi.fn(async () => ({ followUp: null })),
    transcribe: vi.fn(async () => {
      throw new Error("Forbidden");
    }),
    demoStatus: async () => ({
      textOnly: true,
      attemptsRemaining: 12,
      reservedUsd: 2.6,
      maximumUsd: 5,
    }),
  };
}
function request(operation: string, body: unknown, extra: Record<string, string> = {}) {
  return new Request(`https://training.example/api/screening/${operation}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...extra },
    body: JSON.stringify(body),
  });
}
it("serves validated questions, summary and async health through the public adapter", async () => {
  const api = publicHandler(service);
  expect((await (await api(request("questions", fixture.context))).json()).questions).toHaveLength(
    3,
  );
  expect((await (await api(request("summary", fixture))).json()).overview).toBe(
    fixture.summary!.overview,
  );
  expect(
    await (await api(new Request("https://training.example/api/health"))).json(),
  ).toMatchObject({ configured: true, textOnly: true, attemptsRemaining: 12 });
});
it("rejects foreign origins, invalid inputs, wrong methods and audio before a provider call", async () => {
  const fake = service();
  const api = publicHandler(() => fake);
  expect(
    (await api(request("questions", fixture.context, { origin: "https://evil.example" }))).status,
  ).toBe(403);
  expect((await api(request("questions", {}))).status).toBe(400);
  expect((await api(request("transcribe", {}))).status).toBe(404);
  expect((await api(new Request("https://training.example/api/screening/questions"))).status).toBe(
    404,
  );
  expect(fake.questions).not.toHaveBeenCalled();
  expect(fake.transcribe).not.toHaveBeenCalled();
});
it("rejects oversized streaming bodies even without a content-length header", async () => {
  const fake = service();
  const response = await publicHandler(() => fake)(
    request("questions", { text: "x".repeat(270000) }),
  );
  expect(response.status).toBe(413);
  expect(fake.questions).not.toHaveBeenCalled();
});
it.each([
  new DemoLimitError(),
  new DemoConfigurationError(),
  Object.assign(new Error("SECRET CV KEY"), { name: "APIConnectionTimeoutError" }),
])("handles budget/storage/provider failure without raw errors: %s", async (error) => {
  const fake = service();
  fake.questions = async () => {
    throw error;
  };
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await publicHandler(() => fake)(request("questions", fixture.context));
  expect([429, 503]).toContain(response.status);
  expect(await response.text()).not.toContain("SECRET");
  expect(JSON.stringify(log.mock.calls)).not.toContain("SECRET");
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("keeps AI off in previews even if someone sets the enable switch and key", async () => {
  vi.stubEnv("CONTEXT", "production"); // A build-only variable cannot override runtime context.
  vi.stubEnv("AI_ENABLED", "true");
  vi.stubEnv("OPENAI_API_KEY", "test-key-not-real");
  vi.stubEnv("AI_SITE_ID", "test-site");
  const response = await screening(request("questions", fixture.context), {
    site: { id: "test-site" },
    deploy: { context: "deploy-preview" },
  } as Context);
  expect(response.status).toBe(503);
});
