import { getStore } from "@netlify/blobs";
import { BUDGET_STORE, type ClaimStore } from "./cloud-budget.ts";
import { DemoConfigurationError } from "./demo-budget.ts";

export function boundedStore(
  options: { siteID?: string; token?: string; apiURL?: string } = {},
  deadlineMs = 7000,
) {
  // One bounded deadline per storage transaction; token accounting uses fresh 4s transactions.
  const signal = AbortSignal.timeout(deadlineMs);
  return getStore({
    name: BUDGET_STORE,
    consistency: "strong",
    ...options,
    fetch: async (input, init) => {
      signal.throwIfAborted();
      const response = await fetch(input, { ...init, signal });
      // Conditional writes must not turn failed HTTP responses into success receipts.
      if (!response.ok && response.status !== 404 && response.status !== 412)
        throw new DemoConfigurationError("Budget transport unavailable");
      return response;
    },
  });
}
export function claimStore(store: ReturnType<typeof getStore>): ClaimStore {
  return {
    read: (key) => store.get(key, { type: "json", consistency: "strong" }),
    claim: (key, value) => store.setJSON(key, value, { onlyIfNew: true }),
  };
}
