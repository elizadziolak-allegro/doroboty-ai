import { z } from "zod";

export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
export const MAX_AUDIO_SECONDS = 180;
export const MAX_FOLLOW_UPS = 2;
const prose = z.string().trim().min(1).max(12000);
export const mainIdSchema = z.enum(["q1", "q2", "q3"]);
export const questionIdSchema = z.enum(["q1", "q2", "q3", "f1", "f2"]);
export const questionSchema = z.object({
  id: questionIdSchema,
  question: prose,
  requirement: prose,
  parentId: mainIdSchema.optional(),
  reason: prose.optional(),
});
export const questionsSchema = z.object({
  questions: z
    .array(questionSchema.omit({ parentId: true, reason: true }).extend({ id: mainIdSchema }))
    .length(3),
});
export const contextSchema = z.object({
  cv: prose,
  job: z.object({ title: prose, description: prose, summary: prose }),
});
export const answerSchema = z.object({
  questionId: questionIdSchema,
  mode: z.enum(["text", "voice"]),
  text: z.string().max(12000),
  originalTranscript: z.string().max(12000).optional(),
  audioId: z.string().uuid().optional(),
  skipped: z.boolean().optional(),
});
export const evidenceSchema = z
  .array(
    z.object({
      area: z.enum(["ownContribution", "decision", "result"]),
      status: z.enum(["declared", "unknown"]),
      statement: prose,
      sourceQuestionId: questionIdSchema.nullable(),
      quote: z.string().max(12000),
      limitation: prose,
    }),
  )
  .length(3);
export const summarySchema = z.object({
  overview: prose,
  answers: z
    .array(
      z.object({
        questionId: questionIdSchema,
        interpretation: prose,
        quote: prose,
        requirement: prose,
        gaps: prose,
      }),
    )
    .min(3)
    .max(5),
  evidence: evidenceSchema.optional(),
});
export const evidenceSummarySchema = summarySchema.extend({ evidence: evidenceSchema });
export const screeningSchema = z.object({
  context: contextSchema,
  questions: z.array(questionSchema).min(3).max(5),
  answers: z.array(answerSchema).min(3).max(5),
  summary: summarySchema.optional(),
  approved: z.boolean(),
  conversation: z
    .object({
      activeId: questionIdSchema.nullable(),
      resolvedIds: z.array(questionIdSchema).max(5),
    })
    .optional(),
});
export type Screening = z.infer<typeof screeningSchema>;
export type ScreeningContext = z.infer<typeof contextSchema>;
export type ScreeningSummary = z.infer<typeof summarySchema>;
export const summaryRequestSchema = screeningSchema.omit({ summary: true, approved: true });
export type ScreeningInput = z.infer<typeof summaryRequestSchema>;
export const nextRequestSchema = summaryRequestSchema.extend({ questionId: mainIdSchema });
export const nextDecisionSchema = z.object({
  followUp: z.object({ question: prose, reason: prose }).nullable(),
});
export type NextDecision = z.infer<typeof nextDecisionSchema>;
export function orderedQuestions(screening: Pick<Screening, "questions">) {
  return screening.questions
    .filter((q) => !q.parentId)
    .flatMap((q) => [q, ...screening.questions.filter((f) => f.parentId === q.id)]);
}
export function validateQuestions(questions: Screening["questions"]) {
  if (questions.length !== 3 || questions.some((q, i) => q.id !== "q" + (i + 1) || q.parentId))
    throw new Error("Nieprawidłowa kolejność pytań AI. Spróbuj ponownie.");
}
export function validateStructure(screening: ScreeningInput) {
  validateQuestions(screening.questions.slice(0, 3));
  if (screening.questions.length > 5 || screening.questions.length !== screening.answers.length)
    throw new Error("Nieprawidłowa rozmowa.");
  const parents = new Set<string>();
  screening.questions.forEach((q, i) => {
    if (screening.answers[i].questionId !== q.id)
      throw new Error("Odpowiedź nie pasuje do pytania.");
    if (i >= 3) {
      if (q.id !== "f" + (i - 2) || !q.parentId || !q.reason || parents.has(q.parentId))
        throw new Error("Nieprawidłowe dopytanie lub przekroczony limit.");
      parents.add(q.parentId);
    }
  });
  if (screening.conversation) {
    const ordered = orderedQuestions(screening).map((q) => q.id);
    const { resolvedIds, activeId } = screening.conversation;
    if (
      resolvedIds.some((id, i) => id !== ordered[i]) ||
      activeId !== (ordered[resolvedIds.length] ?? null)
    )
      throw new Error("Nieprawidłowy postęp rozmowy.");
    for (const id of resolvedIds) validateAnswer(screening, id);
  }
}
export function validateAnswer(screening: ScreeningInput, id: string) {
  const answer = screening.answers.find((a) => a.questionId === id);
  const question = screening.questions.find((q) => q.id === id);
  if (!answer || !question) throw new Error("Brak odpowiedzi.");
  if (answer.skipped) {
    if (!question.parentId || answer.text || answer.audioId || answer.originalTranscript)
      throw new Error("Można pominąć wyłącznie dopytanie.");
    return;
  }
  if (!answer.text.trim()) throw new Error("Odpowiedz na pytanie, aby przejść dalej.");
  if (answer.mode === "voice" && (!answer.audioId || !answer.originalTranscript?.trim()))
    throw new Error("Zapisz nagranie i transkrypcję albo wybierz tekst.");
  if (answer.mode === "text" && (answer.audioId || answer.originalTranscript))
    throw new Error("Odpowiedź tekstowa nie może zawierać nagrania.");
}
export function validateComplete(screening: ScreeningInput) {
  validateStructure(screening);
  if (screening.conversation?.activeId) throw new Error("Dokończ rozmowę lub pomiń cały etap.");
  for (const q of screening.questions) validateAnswer(screening, q.id);
}
export function validateSummary(screening: ScreeningInput, summary: ScreeningSummary) {
  validateComplete(screening);
  const answered = orderedQuestions(screening).filter(
    (q) => !screening.answers.find((a) => a.questionId === q.id)?.skipped,
  );
  if (summary.answers.length !== answered.length)
    throw new Error("Podsumowanie nie obejmuje odpowiedzi.");
  for (const [i, explanation] of summary.answers.entries()) {
    const answer = screening.answers.find((a) => a.questionId === answered[i]?.id);
    if (explanation.questionId !== answered[i]?.id || !answer?.text.includes(explanation.quote))
      throw new Error("Podsumowanie AI nie wskazuje poprawnych cytatów. Spróbuj ponownie.");
  }
  if (summary.evidence) {
    const areas = ["ownContribution", "decision", "result"];
    summary.evidence.forEach((item, i) => {
      if (item.area !== areas[i]) throw new Error("Nieprawidłowa karta dowodów.");
      const answer = screening.answers.find((a) => a.questionId === item.sourceQuestionId);
      if (
        item.status === "declared" &&
        (!item.quote.trim() || !answer || answer.skipped || !answer.text.includes(item.quote))
      )
        throw new Error("Brak cytatu źródłowego w karcie dowodów.");
      if (item.status === "unknown" && (item.sourceQuestionId !== null || item.quote !== ""))
        throw new Error("Brak danych nie może udawać dowodu.");
    });
  }
}
export function validateApproved(screening: Screening) {
  if (!screening.approved || !screening.summary)
    throw new Error("Zatwierdź podsumowanie lub pomiń pytania AI.");
  validateSummary(screening, screening.summary);
}
