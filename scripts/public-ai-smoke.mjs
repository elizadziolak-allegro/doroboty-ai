// One explicitly approved paid request; never part of the automated gate.
import fs from "node:fs";
import { publicHandler } from "../server/netlify-handler.ts";
import { openAIService } from "../server/service.ts";
import { demoBudget } from "../server/demo-budget.ts";
import { screeningFixture } from "../tests/screening-fixture.ts";
if (process.argv[2] !== "--approved-budget-5-usd" || !process.env.OPENAI_API_KEY)
  throw new Error("Explicit budget approval and a local provider key are required.");
const budget = demoBudget();
const summaryOnly = process.argv[3] === "--summary-only";
const operation = summaryOnly ? "summary" : "questions";
const before = budget.status();
const start = Date.now();
const response = await publicHandler(() => openAIService(budget))(
  new Request(`https://local-rehearsal.invalid/api/screening/${operation}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(summaryOnly ? screeningFixture() : screeningFixture().context),
  }),
);
const data = await response.json();
const report = {
  checkedAt: new Date().toISOString(),
  realProvider: true,
  syntheticTextOnly: true,
  adapter: "public Request/Response handler with local persistent budget; not deployed",
  success:
    response.status === 200 &&
    (summaryOnly ? data.evidence?.length === 3 : data.questions?.length === 3),
  operation,
  status: response.status,
  elapsedMs: Date.now() - start,
  requestId: response.headers.get("x-request-id"),
  budgetBefore: before,
  budgetAfter: budget.status(),
};
fs.mkdirSync("artifacts/demo", { recursive: true });
fs.writeFileSync(
  summaryOnly ? "artifacts/demo/public-ai-summary.json" : "artifacts/demo/public-ai-smoke.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
if (!report.success) process.exitCode = 1;
