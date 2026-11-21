import {
  MAX_FOLLOW_UPS,
  orderedQuestions,
  validateAnswer,
  validateStructure,
  type Screening,
  type NextDecision,
} from "./schema.ts";

export function needsAssessment(screening: Pick<Screening, "questions" | "conversation">) {
  const active = screening.questions.find((q) => q.id === screening.conversation?.activeId);
  return (
    !!active &&
    !active.parentId &&
    screening.questions.length - 3 < MAX_FOLLOW_UPS &&
    !screening.questions.some((q) => q.parentId === active.id)
  );
}
export function advanceConversation(
  screening: Screening,
  decision: NextDecision = { followUp: null },
): Screening {
  validateStructure(screening);
  const id = screening.conversation?.activeId;
  if (!id) throw new Error("Brak aktywnego pytania.");
  validateAnswer(screening, id);
  const next = structuredClone(screening);
  const resolvedIds = [...next.conversation!.resolvedIds, id];
  if (decision.followUp && needsAssessment(screening)) {
    const parent = next.questions.find((q) => q.id === id)!;
    const followId = next.questions.length === 3 ? "f1" : "f2";
    next.questions.push({
      id: followId,
      parentId: id as "q1" | "q2" | "q3",
      question: decision.followUp.question,
      reason: decision.followUp.reason,
      requirement: parent.requirement,
    });
    next.answers.push({ questionId: followId, mode: "text", text: "" });
  }
  next.conversation = {
    activeId: orderedQuestions(next)[resolvedIds.length]?.id ?? null,
    resolvedIds,
  };
  next.approved = false;
  next.summary = undefined;
  validateStructure(next);
  return next;
}
export function revisitQuestion(screening: Screening, id: string): Screening {
  const main = screening.questions.slice(0, 3).findIndex((q) => q.id === id);
  if (main < 0) throw new Error("Wybierz pytanie główne.");
  const next = structuredClone(screening);
  next.questions = next.questions.filter((q) => !q.parentId || Number(q.parentId.slice(1)) <= main);
  next.answers = next.answers.filter((a) => next.questions.some((q) => q.id === a.questionId));
  const ordered = orderedQuestions(next);
  next.conversation = {
    activeId: next.questions[main].id,
    resolvedIds: ordered
      .slice(
        0,
        ordered.findIndex((q) => q.id === id),
      )
      .map((q) => q.id),
  };
  next.approved = false;
  next.summary = undefined;
  validateStructure(next);
  return next;
}
