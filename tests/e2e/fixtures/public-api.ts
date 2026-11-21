import { createServer } from "node:http";
import OpenAI from "openai";
import type { AddressInfo } from "node:net";
import { test as base, expect, type BrowserContext } from "@playwright/test";
import { publicHandler } from "../../../server/netlify-handler";
import { tokenBudget, REQUEST_MICRO_USD, type CostLedger } from "../../../server/token-budget";
import type { ScreeningService } from "../../../server/service";
import { screeningFixture } from "../../screening-fixture";

export type PublicBackend = {
  mode: "healthy" | "disabled" | "storage-down" | "invalid-summary" | "summary-timeout";
  providerCalls: number;
  remaining: () => Promise<number>;
  leaveOneAttempt: () => void;
  connect: (context: BrowserContext) => Promise<void>;
};

export const test = base.extend<{ backend: PublicBackend }>({
  backend: [
    async ({ context, baseURL }, runTest) => {
      const origin = new URL(baseURL!).origin;
      let ledger: CostLedger = {
        version: 2,
        siteId: "isolated-e2e",
        enabled: true,
        spentMicroUsd: 5_000_000 - 12 * REQUEST_MICRO_USD,
        pending: {},
        settledCalls: 0,
        baseline: {
          reportedUsd: 0.12,
          roundingBufferMicroUsd: 5000,
          legacyAttempts: 21,
          source: "owner-report-2026-11-15",
        },
      };
      let revision = 1;
      const budget = tokenBudget(
        () => ({
          async read() {
            if (backend.mode === "storage-down") throw new Error("Synthetic storage outage");
            return { data: structuredClone(ledger), etag: String(revision) };
          },
          async replace(state, etag) {
            if (etag !== String(revision)) return { modified: false };
            ledger = structuredClone(state);
            return { modified: true, etag: String(++revision) };
          },
        }),
        "isolated-e2e",
      );
      const backend: PublicBackend = {
        mode: "healthy",
        providerCalls: 0,
        connect: async () => {
          throw new Error("Server not started");
        },
        remaining: async () =>
          Math.floor(Math.round((await budget.status()).remainingUsd! * 1e6) / REQUEST_MICRO_USD),
        leaveOneAttempt() {
          ledger = { ...ledger, spentMicroUsd: 5_000_000 - REQUEST_MICRO_USD };
          revision++;
        },
      };
      async function reserve() {
        await budget.reserve();
        backend.providerCalls++;
      }
      const provider: ScreeningService = {
        demoStatus: () => budget.status(),
        async questions() {
          await reserve();
          return { questions: screeningFixture().questions };
        },
        async next() {
          await reserve();
          return { followUp: null };
        },
        async summarize(input) {
          await reserve();
          if (backend.mode === "summary-timeout") throw new OpenAI.APIConnectionTimeoutError();
          return {
            overview: "Kandydatka opisuje własny wkład i ograniczenia.",
            answers: input.answers
              .filter((a) => !a.skipped)
              .map((answer) => ({
                questionId: answer.questionId,
                interpretation: "Deklaracja kandydatki.",
                quote:
                  backend.mode === "invalid-summary"
                    ? "Wymyślony cytat spoza odpowiedzi"
                    : answer.text,
                requirement: "Praca nad produktem",
                gaps: "Brak niezależnej weryfikacji.",
              })),
            evidence: ["ownContribution", "decision", "result"].map((area) => ({
              area,
              status: "unknown",
              statement: "Materiał wymaga weryfikacji.",
              sourceQuestionId: null,
              quote: "",
              limitation: "To przykład szkoleniowy.",
            })),
          };
        },
        async transcribe() {
          throw new Error("Voice must never be called in these journeys");
        },
      };
      const handler = publicHandler(() => (backend.mode === "disabled" ? null : provider));
      const server = createServer(async (req, res) => {
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(Buffer.from(chunk));
          const headers = new Headers();
          for (const [name, value] of Object.entries(req.headers)) {
            if (value && name !== "host")
              headers.set(name, Array.isArray(value) ? value.join(",") : value);
          }
          // Preserve the browser's same-origin URL through this local test proxy.
          const response = await handler(
            new Request(origin + req.url, {
              method: req.method,
              headers,
              ...(req.method === "POST" ? { body: Buffer.concat(chunks) } : {}),
            }),
          );
          res.writeHead(response.status, Object.fromEntries(response.headers));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch {
          res.writeHead(500);
          res.end("Test bridge failed");
        }
      });
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const target = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      backend.connect = async (browserContext) => {
        await browserContext.route("**/api/**", async (route) => {
          const url = new URL(route.request().url());
          const response = await route.fetch({
            url: target + url.pathname + url.search,
            maxRetries: 0,
          });
          await route.fulfill({ response });
        });
      };
      await backend.connect(context);
      try {
        await runTest(backend);
      } finally {
        await context.unrouteAll({ behavior: "wait" });
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    },
    { auto: true },
  ],
});
export { expect };
