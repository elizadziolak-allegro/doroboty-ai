import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BlobsServer } from "@netlify/blobs/server";
import { afterEach, expect, it, vi } from "vitest";
import { boundedStore, claimStore } from "./netlify-store";
import { cloudBudget } from "./cloud-budget";
import { tokenBudget, COST_LEDGER_KEY } from "./token-budget";
import { tokenStore } from "./token-store";

afterEach(() => {
  vi.unstubAllGlobals();
});
it("fails closed when the SDK emulator omits read ETags needed for cost accounting", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "doroboty-cost-"));
  const server = new BlobsServer({ directory, token: "local-test-token" });
  try {
    const info = await server.start();
    const options = { apiURL: info.address, siteID: "test-site", token: "local-test-token" };
    await boundedStore(options).setJSON(
      COST_LEDGER_KEY,
      {
        version: 2,
        siteId: "test-site",
        enabled: true,
        spentMicroUsd: 125000,
        pending: {},
        settledCalls: 0,
        baseline: {
          reportedUsd: 0.12,
          roundingBufferMicroUsd: 5000,
          legacyAttempts: 21,
          source: "owner-report-2026-11-15",
        },
      },
      { onlyIfNew: true },
    );
    const first = tokenBudget(() => tokenStore(options), "test-site");
    // BlobsServer 11.1.9 GET does not emit ETag; never weaken production CAS for it.
    await expect(first.reserve()).rejects.toThrow("Cost reservation unavailable");
    const actual = await boundedStore(options).get(COST_LEDGER_KEY, { type: "json" });
    expect(actual.pending).toEqual({});
    expect(actual.spentMicroUsd).toBe(125000);
  } finally {
    await server.stop();
    fs.rmSync(directory, { recursive: true });
  }
});
it("rehearses SDK persistence, exhausted tickets and stop/re-enable against isolated local storage", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "doroboty-blobs-"));
  const server = new BlobsServer({ directory, token: "local-test-token" });
  try {
    const info = await server.start();
    const options = { apiURL: info.address, siteID: "test-site", token: "local-test-token" };
    const store = boundedStore(options);
    const manifest = { version: 1, siteId: "test-site", transferredAttempts: 24, enabled: true };
    await store.setJSON("manifest", manifest, { onlyIfNew: true });
    await cloudBudget(claimStore(store), "test-site").reserve();
    const reopened = boundedStore(options);
    expect(await cloudBudget(claimStore(reopened), "test-site").status()).toMatchObject({
      attemptsRemaining: 0,
    });
    expect(
      await reopened.setJSON("attempt-25", { claimId: "different" }, { onlyIfNew: true }),
    ).toMatchObject({ modified: false });
    await reopened.setJSON("manifest", { ...manifest, enabled: false });
    await expect(cloudBudget(claimStore(reopened), "test-site").status()).rejects.toThrow();
    await reopened.setJSON("manifest", manifest);
    await expect(cloudBudget(claimStore(reopened), "test-site").reserve()).rejects.toThrow(
      "exhausted",
    );
  } finally {
    await server.stop();
    // Only the freshly-created temporary test directory, never a user budget.
    fs.rmSync(directory, { recursive: true });
  }
});
it("rejects storage HTTP failures instead of treating them as conditional-write success", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 500 })),
  );
  const store = boundedStore({ apiURL: "http://127.0.0.1:1", siteID: "test-site", token: "test" });
  await expect(store.setJSON("attempt-14", {}, { onlyIfNew: true })).rejects.toThrow(
    "transport unavailable",
  );
});
