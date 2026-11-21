import { boundedStore } from "./netlify-store.ts";
import { COST_LEDGER_KEY, type CostStore } from "./token-budget.ts";

export function tokenStore(
  options: { siteID?: string; token?: string; apiURL?: string } = {},
): CostStore {
  // 4s reservation + 45s provider + 4s settlement fits the configured 60s host limit.
  const store = boundedStore(options, 4000);
  return {
    read: () => store.getWithMetadata(COST_LEDGER_KEY, { type: "json", consistency: "strong" }),
    replace: (state, etag) => store.setJSON(COST_LEDGER_KEY, state, { onlyIfMatch: etag }),
  };
}
