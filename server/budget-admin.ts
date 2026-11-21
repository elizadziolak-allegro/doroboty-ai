import { demoBudget, DemoConfigurationError } from "./demo-budget.ts";
import { manifestSchema } from "./cloud-budget.ts";
import { boundedStore } from "./netlify-store.ts";
import { COST_LEDGER_KEY, costLedgerSchema } from "./token-budget.ts";

// Manual operator command only. Never invoked by build, tests, startup or a public URL.
const action = process.argv[2];
const siteID = process.env.AI_SITE_ID;
const token = process.env.NETLIFY_AUTH_TOKEN;
try {
  if (!["init", "stop", "enable", "status"].includes(action) || !siteID || !token)
    throw new DemoConfigurationError(
      "Set AI_SITE_ID and NETLIFY_AUTH_TOKEN; choose init, stop, enable or status.",
    );
  const store = boundedStore({ siteID, token });
  const currentCost = await store.getWithMetadata(COST_LEDGER_KEY, {
    type: "json",
    consistency: "strong",
  });
  if (currentCost) {
    const state = costLedgerSchema.parse(currentCost.data);
    if (state.siteId !== siteID || !currentCost.etag || action === "init")
      throw new DemoConfigurationError("Existing cost ledger");
    if (action === "status") console.log(JSON.stringify(state));
    else {
      const result = await store.setJSON(
        COST_LEDGER_KEY,
        { ...state, enabled: action === "enable" },
        { onlyIfMatch: currentCost.etag },
      );
      if (!result.modified || !result.etag)
        throw new DemoConfigurationError("Unconfirmed cost switch");
      const actual = costLedgerSchema.parse(await store.get(COST_LEDGER_KEY, { type: "json" }));
      if (actual.enabled !== (action === "enable"))
        throw new DemoConfigurationError("Conflicting cost switch");
      console.log(
        action === "enable"
          ? "Token budget enabled."
          : "Token budget stopped; pending charges retained.",
      );
    }
  } else if (action === "init") {
    // Freeze first: a failed remote initialization must never restore local spending.
    const attempts = demoBudget().handoff(siteID);
    const manifest = manifestSchema.parse({
      version: 1,
      siteId: siteID,
      transferredAttempts: attempts,
      enabled: false,
    });
    const result = await store.setJSON("manifest", manifest, { onlyIfNew: true });
    const actual = manifestSchema.parse(await store.get("manifest", { type: "json" }));
    if (
      (result.modified && !result.etag) ||
      actual.siteId !== siteID ||
      actual.transferredAttempts !== attempts
    )
      throw new DemoConfigurationError("Conflicting or unconfirmed handoff. Keep AI disabled.");
    console.log(
      "Local budget frozen. Cloud manifest verified. Enable is a separate operator action.",
    );
  } else {
    const entry = await store.getWithMetadata("manifest", { type: "json", consistency: "strong" });
    const state = manifestSchema.parse(entry?.data);
    if (!entry?.etag || state.siteId !== siteID)
      throw new DemoConfigurationError("Budget identity mismatch");
    if (action === "status") console.log(JSON.stringify(state));
    else {
      const result = await store.setJSON(
        "manifest",
        { ...state, enabled: action === "enable" },
        { onlyIfMatch: entry.etag },
      );
      if (!result.modified || !result.etag)
        throw new DemoConfigurationError("Unconfirmed stop/enable; inspect safely.");
      const actual = manifestSchema.parse(await store.get("manifest", { type: "json" }));
      if (actual.enabled !== (action === "enable"))
        throw new DemoConfigurationError("Conflicting update");
      console.log(
        action === "stop"
          ? "New paid calls stopped. Already running calls may finish."
          : "Budget enabled; deployment switch must also be enabled.",
      );
    }
  }
} catch {
  // SDK errors may contain authenticated URLs; do not print raw exceptions.
  console.error(
    "Budget operation failed. Keep AI disabled; verify site, credentials and existing manifest. Do not delete any tickets or restore an older budget.",
  );
  process.exitCode = 1;
}
