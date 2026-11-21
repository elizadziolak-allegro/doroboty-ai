import { afterEach, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";
import { createScreeningServer } from "./http";
import { screeningFixture } from "../tests/screening-fixture";
import type { ScreeningService } from "./service";
import { advanceConversation } from "../src/features/screening/conversation";
import type { Screening } from "../src/features/screening/schema";
import type { Diagnostic } from "./diagnostics";
const servers: ReturnType<typeof createScreeningServer>[] = [];
afterEach(async () => {
  await Promise.all(
    servers.map(
      (s) =>
        new Promise<void>((resolve) => {
          s.closeAllConnections();
          s.close(() => resolve());
        }),
    ),
  );
  servers.length = 0;
});
async function start(service: ScreeningService | null, log?: (event: Diagnostic) => void) {
  const server = createScreeningServer(service, log);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
const fixture = screeningFixture();
function fake(): ScreeningService {
  return {
    next: vi.fn(async () => ({ followUp: null })),
    questions: vi.fn(async () => ({ questions: fixture.questions })),
    summarize: vi.fn(async () => fixture.summary!),
    transcribe: vi.fn(async () => "Przykładowa transkrypcja."),
  };
}
const post = (base: string, route: string, data: unknown, origin?: string) =>
  fetch(`${base}/api/screening/${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
    body: JSON.stringify(data),
  });
it("supports all three API operations without leaking a key", async () => {
  const base = await start(fake());
  expect((await (await post(base, "questions", fixture.context)).json()).questions).toHaveLength(3);
  expect((await (await post(base, "summary", fixture)).json()).overview).toBe(
    fixture.summary!.overview,
  );
  expect(
    (await (await post(base, "transcribe", { mime: "audio/webm", base64: "YXVkaW8=" })).json())
      .text,
  ).toContain("transkrypcja");
});

it("logs only allowlisted diagnostics and exposes the approved text-only mode", async () => {
  const service = fake();
  service.demoStatus = () => ({
    textOnly: true,
    attemptsRemaining: 20,
    reservedUsd: 1,
    maximumUsd: 5,
  });
  service.questions = async () => {
    throw Object.assign(new Error("SECRET CV"), {
      status: 401,
      headers: { authorization: "PRIVATE" },
    });
  };
  const log = vi.fn();
  const base = await start(service, log);
  expect(await (await fetch(base + "/api/health")).json()).toMatchObject({
    textOnly: true,
    maximumUsd: 5,
  });
  expect((await post(base, "transcribe", { mime: "audio/webm", base64: "YQ==" })).status).toBe(403);
  expect(service.transcribe).not.toHaveBeenCalled();
  const response = await post(base, "questions", fixture.context);
  expect(response.status).toBe(502);
  expect(log.mock.calls[0][0]).toMatchObject({
    category: "authentication",
    upstreamStatus: 401,
    operation: "questions",
    requestId: response.headers.get("x-request-id"),
  });
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/SECRET|PRIVATE|authorization/);
});

it("rejects oversized text before making a provider call", async () => {
  const service = fake();
  const base = await start(service);
  expect((await post(base, "questions", { cv: "x".repeat(270000) })).status).toBe(413);
  expect(service.questions).not.toHaveBeenCalled();
});
it("keeps standard use possible with missing key and blocks foreign web origins", async () => {
  const base = await start(null);
  expect(await (await fetch(`${base}/api/health`)).json()).toEqual({ configured: false });
  expect((await post(base, "questions", fixture.context)).status).toBe(503);
  expect((await post(base, "questions", fixture.context, "https://attacker.example")).status).toBe(
    403,
  );
});
it("rejects invalid inputs, preserves useful errors, and sanitizes upstream failures", async () => {
  const service = fake();
  const base = await start(service);
  expect((await post(base, "questions", {})).status).toBe(400);
  expect(
    (await post(base, "transcribe", { mime: "audio/unsupported", base64: "YQ==" })).status,
  ).toBe(400);
  service.questions = async () => {
    throw new Error("SECRET upstream details");
  };
  const response = await post(base, "questions", fixture.context);
  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain("SECRET");
});

it("assesses only the active main answer and enforces the follow-up budget before calling OpenAI", async () => {
  const service = fake();
  const base = await start(service);
  let screening: Screening = {
    ...screeningFixture(),
    approved: false,
    summary: undefined,
    conversation: { activeId: "q1", resolvedIds: [] },
  };
  expect((await post(base, "next", { ...screening, questionId: "q2" })).status).toBe(400);
  expect(service.next).not.toHaveBeenCalled();
  expect(await (await post(base, "next", { ...screening, questionId: "q1" })).json()).toEqual({
    followUp: null,
  });
  expect(service.next).toHaveBeenCalledTimes(1);
  for (let i = 0; i < 2; i++) {
    screening = advanceConversation(screening, {
      followUp: { question: "Co zrobiłaś osobiście?", reason: "Doprecyzujmy wkład." },
    });
    screening.answers.at(-1)!.text = "Przeprowadziłam badania osobiście.";
    screening = advanceConversation(screening);
  }
  expect(screening.conversation!.activeId).toBe("q3");
  expect(await (await post(base, "next", { ...screening, questionId: "q3" })).json()).toEqual({
    followUp: null,
  });
  expect(service.next).toHaveBeenCalledTimes(1);
});
