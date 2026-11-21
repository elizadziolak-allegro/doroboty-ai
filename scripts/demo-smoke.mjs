// Explicit paid rehearsal only: never invoked by npm run check.
import fs from "node:fs";
import { createScreeningServer } from "../server/http.ts";
import { openAIService } from "../server/service.ts";
import { demoBudget, DEMO_MODEL } from "../server/demo-budget.ts";
import { advanceConversation, needsAssessment } from "../src/features/screening/conversation.ts";
import { validateSummary } from "../src/features/screening/schema.ts";
import { screeningFixture } from "../tests/screening-fixture.ts";

if (process.argv[2] !== "--approved-budget-5-usd")
  throw new Error("Explicit approval flag required for the paid rehearsal.");
if (!process.env.OPENAI_API_KEY) throw new Error("Local API key is missing.");
const before = demoBudget().status();
if (before.attemptsRemaining < 5)
  throw new Error("Keep five reserved attempts available for a complete rehearsal.");
const server = createScreeningServer(openAIService());
server.requestTimeout = 90000;
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const results = [];
async function post(operation, data) {
  const response = await fetch(base + "/api/screening/" + operation, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(80000),
  });
  results.push({
    operation,
    status: response.status,
    requestId: response.headers.get("x-request-id"),
  });
  if (!response.ok)
    throw new Error(
      `Rehearsal stopped: ${operation} returned ${response.status}. See sanitized server diagnostics.`,
    );
  return response.json();
}
let success = false;
try {
  const fixture = screeningFixture();
  const questions = (await post("questions", fixture.context)).questions;
  let input = {
    context: fixture.context,
    questions,
    answers: questions.map((q) => ({ questionId: q.id, mode: "text", text: "" })),
    approved: false,
    conversation: { activeId: "q1", resolvedIds: [] },
  };
  const answers = {
    q1: "Samodzielnie przeprowadziłam pięć wywiadów z konsultantami, opisałam problemy i przygotowałam wymagania. Programista wdrożył zmianę.",
    q2: "Porównałam automatyczne wysyłanie odpowiedzi z podpowiedziami zatwierdzanymi przez konsultanta. Wybrałam podpowiedzi, aby konsultant mógł poprawić błędy. Przygotowałam test na przykładowych zgłoszeniach.",
    q3: "Po zmianie konsultanci zgłaszali mniej ręcznych kroków. To ich relacja, nie niezależny pomiar. Nie mierzyłam oszczędności czasu i nie mam liczbowego wyniku.",
  };
  while (input.conversation.activeId) {
    const id = input.conversation.activeId;
    const answer = input.answers.find((a) => a.questionId === id);
    if (id.startsWith("f")) {
      answer.skipped = true;
      input = advanceConversation(input);
    } else {
      answer.text = answers[id];
      const decision = needsAssessment(input)
        ? await post("next", { ...input, questionId: id })
        : { followUp: null };
      input = advanceConversation(input, decision);
    }
  }
  const summary = await post("summary", input);
  validateSummary(input, summary);
  if (summary.evidence?.length !== 3) throw new Error("Missing evidence cards.");
  success = true;
} finally {
  const report = {
    checkedAt: new Date().toISOString(),
    success,
    model: DEMO_MODEL,
    realProvider: true,
    syntheticTextOnly: true,
    operations: results,
    budgetBefore: before,
    budgetAfter: demoBudget().status(),
    note: "Reserved USD is a conservative ceiling, not the actual provider invoice. No retries.",
  };
  fs.mkdirSync("artifacts/demo", { recursive: true });
  fs.writeFileSync("artifacts/demo/ai-smoke.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
