import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

export const DEMO_MODEL = "gpt-5-mini-2025-08-07";
export const MAX_OUTPUT_TOKENS = 8192;
export const MAX_ATTEMPTS = 25;
// USD 0.20 reserved permanently per attempt, including errors/timeouts.
// 400k input * $0.25/M + 8192 output * $2/M = $0.116384 maximum at
// the recorded standard price. No tools, audio or priority tier are enabled.
const ledgerSchema = z.object({
  version: z.literal(1),
  attempts: z.number().int().min(0).max(MAX_ATTEMPTS),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  transferredTo: z.string().min(1).optional(),
});
export class DemoLimitError extends Error {}
export class DemoConfigurationError extends Error {}
export function demoBudget(
  file = fileURLToPath(new URL("../.local/demo-budget.json", import.meta.url)),
) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  function read() {
    if (!fs.existsSync(file)) {
      return { version: 1 as const, attempts: 0, inputTokens: 0, outputTokens: 0 };
    }
    return ledgerSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
  }
  function change(update: (state: z.infer<typeof ledgerSchema>) => void) {
    let lock: number | undefined;
    const temporary = file + ".next";
    try {
      lock = fs.openSync(file + ".lock", "wx");
      const state = read();
      update(state);
      fs.writeFileSync(temporary, JSON.stringify(ledgerSchema.parse(state)) + "\n", {
        flag: "w",
        mode: 0o600,
      });
      fs.renameSync(temporary, file);
    } catch (error) {
      if (error instanceof DemoLimitError) throw error;
      throw new DemoConfigurationError("Demo budget is unavailable; no request may be sent.");
    } finally {
      if (lock !== undefined) {
        fs.closeSync(lock);
        fs.unlinkSync(file + ".lock");
      }
    }
  }
  return {
    reserve() {
      change((state) => {
        if (state.transferredTo)
          throw new DemoConfigurationError("Budget transferred; local AI is disabled.");
        if (state.attempts >= MAX_ATTEMPTS) throw new DemoLimitError("Demo limit reached.");
        state.attempts++;
      });
    },
    usage(inputTokens: number, outputTokens: number) {
      change((state) => {
        state.inputTokens += inputTokens;
        state.outputTokens += outputTokens;
      });
    },
    handoff(siteId: string) {
      if (!siteId.trim()) throw new DemoConfigurationError("A target site is required.");
      change((state) => {
        if (state.transferredTo && state.transferredTo !== siteId)
          throw new DemoConfigurationError("Budget already belongs to another site.");
        state.transferredTo = siteId;
      });
      return read().attempts;
    },
    status() {
      try {
        const state = read();
        if (state.transferredTo)
          throw new DemoConfigurationError("Budget transferred; local AI is disabled.");
        return {
          textOnly: true,
          attemptsRemaining: MAX_ATTEMPTS - state.attempts,
          reservedUsd: state.attempts * 0.2,
          maximumUsd: 5,
        };
      } catch {
        throw new DemoConfigurationError("Demo budget is unavailable.");
      }
    },
  };
}
