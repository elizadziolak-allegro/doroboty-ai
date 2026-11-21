import { expect, it } from "vitest";
import { screeningFixture } from "../../../tests/screening-fixture";
import { advanceConversation, needsAssessment, revisitQuestion } from "./conversation";
import {
  orderedQuestions,
  validateApproved,
  validateComplete,
  validateStructure,
  validateSummary,
  type Screening,
} from "./schema";
import { initialState } from "../prototype/model";
import { parseState, serializeState } from "../prototype/storage";
function start(): Screening {
  return {
    ...screeningFixture(),
    approved: false,
    summary: undefined,
    conversation: { activeId: "q1", resolvedIds: [] },
  };
}
const probe = {
  followUp: { question: "Co zrobiłaś osobiście?", reason: "Doprecyzujmy własny wkład." },
};
it("keeps three main questions sequential when no follow-up is needed", () => {
  let s = start();
  for (const id of ["q1", "q2", "q3"]) {
    expect(s.conversation!.activeId).toBe(id);
    s = advanceConversation(s);
  }
  expect(s.conversation!.activeId).toBeNull();
  expect(s.questions).toHaveLength(3);
  expect(() => validateComplete(s)).not.toThrow();
});
it("bounds clarification to one per main question and two overall", () => {
  let s = advanceConversation(start(), probe);
  expect(s.conversation!.activeId).toBe("f1");
  expect(needsAssessment({ ...s, conversation: { activeId: "q1", resolvedIds: [] } })).toBe(false);
  s.answers[3].text = "Prowadziłam analizę zgłoszeń osobiście.";
  s = advanceConversation(s, probe); // A follow-up cannot create another follow-up.
  expect(s.questions).toHaveLength(4);
  expect(s.conversation!.activeId).toBe("q2");
  s = advanceConversation(s, probe);
  s.answers[4].text = "Wybrałam mały pilotaż.";
  s = advanceConversation(s, probe);
  expect(needsAssessment(s)).toBe(false);
  s = advanceConversation(s, probe);
  expect(s.questions).toHaveLength(5);
  expect(s.conversation!.activeId).toBeNull();
  expect(orderedQuestions(s).map((q) => q.id)).toEqual(["q1", "f1", "q2", "f2", "q3"]);
});
it("allows skipping a clarification without fabricating an answer", () => {
  const s = advanceConversation(start(), probe);
  s.answers[3] = { questionId: "f1", mode: "text", text: "", skipped: true };
  const next = advanceConversation(s);
  expect(next.conversation!.activeId).toBe("q2");
  const bad = start();
  bad.answers[0].skipped = true;
  expect(() => advanceConversation(bad)).toThrow();
});
it("rejects malformed progress and preserves active follow-up on reload", () => {
  const state = initialState();
  const s = advanceConversation(start(), probe);
  state.drafts.push({
    candidateId: "candidate-anna",
    jobId: state.jobs[0].id,
    notes: "",
    generated: "",
    answer: "",
    screening: s,
  });
  expect(parseState(serializeState(state)).drafts[0].screening?.conversation?.activeId).toBe("f1");
  s.conversation!.resolvedIds.push("q3");
  expect(() => validateStructure(s)).toThrow();
});
it("restarting an edited main answer removes dependent clarifications and approval", () => {
  let s = advanceConversation(start(), probe);
  s.answers[3].text = "Analizowałam zgłoszenia.";
  s = advanceConversation(s);
  s = advanceConversation(s, probe);
  s.answers[4].text = "Mały pilotaż.";
  s = advanceConversation(s);
  s = advanceConversation(s);
  const edited = revisitQuestion(s, "q2");
  expect(edited.questions.map((q) => q.id)).toEqual(["q1", "q2", "q3", "f1"]);
  expect(edited.conversation).toEqual({ activeId: "q2", resolvedIds: ["q1", "f1"] });
  expect(edited.answers[2].text).toBe(s.answers[2].text);
  expect(edited.approved).toBe(false);
  expect(edited.summary).toBeUndefined();
});
it("validates exact evidence sources and accepts old approved snapshots", () => {
  const old = screeningFixture();
  expect(() => validateApproved(old)).not.toThrow();
  const summary = {
    ...old.summary!,
    evidence: ["ownContribution", "decision", "result"].map((area, i) => ({
      area: area as "ownContribution" | "decision" | "result",
      status: "declared" as const,
      statement: "Deklaracja.",
      sourceQuestionId: old.questions[i].id,
      quote: old.answers[i].text,
      limitation: "Niezweryfikowane.",
    })),
  };
  expect(() => validateSummary(old, summary)).not.toThrow();
  summary.evidence[0].quote = "Zmyślony cytat";
  expect(() => validateSummary(old, summary)).toThrow();
});
