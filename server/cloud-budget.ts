import { randomUUID } from "node:crypto";
import { z } from "zod";
import { DemoConfigurationError, DemoLimitError, MAX_ATTEMPTS } from "./demo-budget.ts";

export const BUDGET_STORE = "doroboty-training-budget-v1";
export const manifestSchema = z.object({
  version: z.literal(1),
  siteId: z.string().min(1),
  // Never automatically recreate this manifest or decrement its starting usage.
  transferredAttempts: z.number().int().min(13).max(MAX_ATTEMPTS),
  enabled: z.boolean(),
});
export interface ClaimStore {
  read(key: string): Promise<unknown>;
  claim(key: string, value: unknown): Promise<{ modified: boolean; etag?: string }>;
}

// Immutable, individually claimed tickets: no read/modify/write balance or CAS counter.
// A claimed ticket is never refunded, overwritten or deleted, even after a timeout.
export function cloudBudget(store: ClaimStore, siteId: string) {
  async function manifest() {
    const parsed = manifestSchema.safeParse(await store.read("manifest"));
    if (!parsed.success || parsed.data.siteId !== siteId || !parsed.data.enabled)
      throw new DemoConfigurationError("Cloud AI is disabled or its budget is unavailable.");
    return parsed.data;
  }
  async function tickets() {
    const state = await manifest();
    const slots = await Promise.all(
      Array.from({ length: MAX_ATTEMPTS - state.transferredAttempts }, async (_, index) => {
        const key = `attempt-${state.transferredAttempts + index + 1}`;
        return { key, used: (await store.read(key)) !== null };
      }),
    );
    return slots;
  }
  return {
    async reserve() {
      try {
        for (const slot of await tickets()) {
          if (slot.used) continue;
          const claimId = randomUUID();
          const result = await store.claim(slot.key, { claimId });
          if (!result.modified) continue;
          // Reject ambiguous SDK/transport outcomes before allowing a paid call.
          if (!result.etag) throw new DemoConfigurationError("Missing claim receipt");
          const receipt = await store.read(slot.key);
          if (
            !receipt ||
            typeof receipt !== "object" ||
            !("claimId" in receipt) ||
            receipt.claimId !== claimId
          )
            throw new DemoConfigurationError("Unconfirmed reservation");
          await manifest(); // A stop requested while reserving burns the ticket, not money.
          return;
        }
        throw new DemoLimitError("Shared allowance exhausted");
      } catch (error) {
        if (error instanceof DemoLimitError) throw error;
        throw new DemoConfigurationError("Reservation unavailable; do not call AI.");
      }
    },
    usage() {
      /* Reservations, including failed calls, are the cost boundary. */
    },
    async status() {
      try {
        const remaining = (await tickets()).filter((slot) => !slot.used).length;
        return {
          textOnly: true,
          attemptsRemaining: remaining,
          reservedUsd: (MAX_ATTEMPTS - remaining) * 0.2,
          maximumUsd: 5,
        };
      } catch {
        throw new DemoConfigurationError("Shared budget unavailable.");
      }
    },
  };
}
