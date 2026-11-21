import {
  contextSchema,
  nextRequestSchema,
  summaryRequestSchema,
  questionsSchema,
  nextDecisionSchema,
  summarySchema,
  validateQuestions,
  validateSummary,
  validateComplete,
  validateStructure,
  validateAnswer,
} from "../src/features/screening/schema.ts";
import { needsAssessment } from "../src/features/screening/conversation.ts";
import type { ScreeningService } from "./service.ts";

export class InputError extends Error {}
export const TEXT_OPERATIONS = ["questions", "next", "summary"] as const;
export async function executeScreening(
  operation: string,
  body: unknown,
  service: ScreeningService,
) {
  if (operation === "questions") {
    const input = contextSchema.parse(body);
    const result = questionsSchema.parse(await service.questions(input));
    validateQuestions(result.questions);
    return result;
  }
  if (operation === "next") {
    const input = nextRequestSchema.parse(body);
    try {
      validateStructure(input);
      validateAnswer(input, input.questionId);
      if (input.conversation?.activeId !== input.questionId) throw new Error();
    } catch {
      throw new InputError("Invalid conversation progress");
    }
    if (!needsAssessment(input)) return { followUp: null };
    return nextDecisionSchema.parse(await service.next(input));
  }
  if (operation === "summary") {
    const input = summaryRequestSchema.parse(body);
    try {
      validateComplete(input);
    } catch {
      throw new InputError("Incomplete answers");
    }
    const result = summarySchema.parse(await service.summarize(input));
    validateSummary(input, result);
    return result;
  }
  throw new InputError("Unknown operation");
}
