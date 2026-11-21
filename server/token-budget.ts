import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Budget } from "./budget.ts";
import { DemoConfigurationError, DemoLimitError } from "./demo-budget.ts";

// Integer microdollars; round each usage settlement upward, never floating balances.
export const COST_LEDGER_KEY = "cost-ledger-v2";
export const LIMIT_MICRO_USD = 5_000_000;
export const REQUEST_MICRO_USD = 116_384;
const money = z.number().int().min(0).max(LIMIT_MICRO_USD);
export const costLedgerSchema = z
  .object({
    version: z.literal(2),
    siteId: z.string().min(1),
    enabled: z.boolean(),
    spentMicroUsd: money,
    pending: z.record(z.string().uuid(), z.literal(REQUEST_MICRO_USD)),
    settledCalls: z.number().int().nonnegative(),
    baseline: z.object({
      reportedUsd: z.literal(0.12),
      roundingBufferMicroUsd: z.literal(5000),
      legacyAttempts: z.number().int().min(21).max(25),
      source: z.literal("owner-report-2026-11-15"),
    }),
  })
  .refine(
    (s) => s.spentMicroUsd + Object.values(s.pending).reduce((a, b) => a + b, 0) <= LIMIT_MICRO_USD,
  );
export type CostLedger = z.infer<typeof costLedgerSchema>;
export interface CostStore {
  read(): Promise<{ data: unknown; etag?: string } | null>;
  replace(state: CostLedger, etag: string): Promise<{ modified: boolean; etag?: string }>;
}
export function usageMicroUsd(input: number, output: number, cached = 0) {
  if (
    ![input, output, cached].every((n) => Number.isSafeInteger(n) && n >= 0) ||
    cached > input ||
    input > 400_000 ||
    output > 8192
  )
    throw new DemoConfigurationError("Invalid provider usage; reservation retained.");
  return Math.ceil(((input - cached) * 10 + cached + output * 80) / 40);
}
export function tokenBudget(createStore: () => CostStore, siteId: string): Budget {
  async function read(store: CostStore) {
    const entry = await store.read();
    const state = costLedgerSchema.parse(entry?.data);
    if (!entry?.etag || state.siteId !== siteId)
      throw new DemoConfigurationError("Cost ledger unavailable");
    return { state, etag: entry.etag };
  }
  async function update(change: (s: CostLedger) => void, store = createStore()) {
    for (let i = 0; i < 8; i++) {
      const { state, etag } = await read(store);
      change(state);
      const result = await store.replace(costLedgerSchema.parse(state), etag);
      if (!result.modified) continue;
      if (!result.etag) throw new DemoConfigurationError("Unconfirmed cost write");
      return;
    }
    throw new DemoConfigurationError("Cost ledger contention; retry manually.");
  }
  return {
    async reserve() {
      const id = randomUUID();
      const store = createStore();
      try {
        await update((s) => {
          if (!s.enabled) throw new DemoConfigurationError("AI budget stopped");
          const committed = s.spentMicroUsd + Object.values(s.pending).reduce((a, b) => a + b, 0);
          if (committed + REQUEST_MICRO_USD > LIMIT_MICRO_USD)
            throw new DemoLimitError("Shared cost allowance exhausted");
          s.pending[id] = REQUEST_MICRO_USD;
        }, store);
        // Confirm the unique claim and stop flag before any paid request.
        const { state } = await read(store);
        if (!state.enabled || state.pending[id] !== REQUEST_MICRO_USD)
          throw new DemoConfigurationError("Unconfirmed cost reservation");
        return id;
      } catch (error) {
        if (error instanceof DemoLimitError) throw error;
        throw new DemoConfigurationError(
          "Cost reservation unavailable; no provider call permitted.",
        );
      }
    },
    async usage(input, output, cached = 0, receipt) {
      if (typeof receipt !== "string") throw new DemoConfigurationError("Cost receipt missing");
      const cost = usageMicroUsd(input, output, cached);
      await update((s) => {
        // A receipt can settle only its own pending reservation, exactly once.
        if (!Object.hasOwn(s.pending, receipt)) return;
        if (cost > s.pending[receipt])
          throw new DemoConfigurationError("Usage exceeds reservation");
        delete s.pending[receipt];
        s.spentMicroUsd += cost;
        s.settledCalls++;
      });
    },
    async status() {
      const { state } = await read(createStore());
      if (!state.enabled) throw new DemoConfigurationError("AI budget stopped");
      const reserved = Object.values(state.pending).reduce((a, b) => a + b, 0);
      return {
        textOnly: true,
        accounting: "tokens",
        spentUsd: state.spentMicroUsd / 1e6,
        reservedUsd: reserved / 1e6,
        remainingUsd: (LIMIT_MICRO_USD - state.spentMicroUsd - reserved) / 1e6,
        maximumUsd: 5,
      };
    },
  };
}
