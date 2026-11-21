import { z } from "zod";
import OpenAI from "openai";
import { DemoConfigurationError, DemoLimitError } from "./demo-budget.ts";

export function classifyError(error: unknown) {
  const status =
    error && typeof error === "object" && "status" in error && typeof error.status === "number"
      ? error.status
      : undefined;
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  const name = error instanceof Error ? error.name : "";
  const category =
    error instanceof DemoLimitError
      ? "budget"
      : error instanceof DemoConfigurationError
        ? "configuration"
        : error instanceof z.ZodError
          ? "validation"
          : status === 401 || status === 403
            ? "authentication"
            : code === "insufficient_quota" || code === "credit_balance_exhausted"
              ? "quota"
              : status === 429
                ? "rate_limit"
                : error instanceof OpenAI.APIConnectionTimeoutError ||
                    name === "APIConnectionTimeoutError" ||
                    name === "AbortError"
                  ? "timeout"
                  : name === "APIConnectionError"
                    ? "connection"
                    : "upstream";
  return {
    category,
    ...(status && status >= 400 && status <= 599 ? { upstreamStatus: status } : {}),
  };
}
export type Diagnostic = ReturnType<typeof classifyError> & {
  requestId: string;
  operation: string;
};
export function logDiagnostic(event: Diagnostic) {
  // Never include the error object, message, body, headers, CV, answers or credentials.
  console.error(JSON.stringify({ event: "screening_error", ...event }));
}
