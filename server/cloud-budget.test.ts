import { expect, it, vi } from "vitest";
import { cloudBudget, type ClaimStore } from "./cloud-budget";
import { DemoConfigurationError, DemoLimitError } from "./demo-budget";

function fixture(transferredAttempts = 13) {
  const data = new Map<string, unknown>([
    ["manifest", { version: 1, siteId: "test-site", transferredAttempts, enabled: true }],
  ]);
  const store: ClaimStore = {
    read: vi.fn(async (key) => data.get(key) ?? null),
    claim: vi.fn(async (key, value) => {
      // Models the documented atomic onlyIfNew contract, not a cloud verification.
      if (data.has(key)) return { modified: false };
      data.set(key, value);
      return { modified: true, etag: `"${key}"` };
    }),
  };
  return { store, data };
}
it("allows exactly the remaining 12 of 40 concurrent requests across instances", async () => {
  const { store } = fixture();
  const results = await Promise.allSettled(
    Array.from({ length: 40 }, () => cloudBudget(store, "test-site").reserve()),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(12);
  expect(await cloudBudget(store, "test-site").status()).toMatchObject({
    attemptsRemaining: 0,
    reservedUsd: 5,
  });
  await expect(cloudBudget(store, "test-site").reserve()).rejects.toBeInstanceOf(DemoLimitError);
});
it("does not refund failed calls, restart the budget or share it with another site", async () => {
  const { store } = fixture(24);
  await cloudBudget(store, "test-site").reserve();
  await expect(cloudBudget(store, "test-site").reserve()).rejects.toBeInstanceOf(DemoLimitError);
  await expect(cloudBudget(store, "other-site").status()).rejects.toBeInstanceOf(
    DemoConfigurationError,
  );
});
it.each([
  null,
  {},
  { version: 1, siteId: "test-site", transferredAttempts: 12, enabled: true },
  { version: 1, siteId: "test-site", transferredAttempts: 13, enabled: false },
])("fails closed for an absent, corrupt, reset or stopped manifest: %j", async (manifest) => {
  const { store, data } = fixture();
  data.set("manifest", manifest);
  await expect(cloudBudget(store, "test-site").reserve()).rejects.toBeInstanceOf(
    DemoConfigurationError,
  );
  expect(store.claim).not.toHaveBeenCalled();
});
it("rejects ambiguous success receipts and never tries another ticket after an uncertain write", async () => {
  const { store } = fixture();
  store.claim = vi.fn(async () => ({ modified: true }));
  await expect(cloudBudget(store, "test-site").reserve()).rejects.toBeInstanceOf(
    DemoConfigurationError,
  );
  expect(store.claim).toHaveBeenCalledTimes(1);
});
it("rejects a write that claimed success but was not persisted", async () => {
  const { store } = fixture();
  store.claim = vi.fn(async () => ({ modified: true, etag: "receipt" }));
  await expect(cloudBudget(store, "test-site").reserve()).rejects.toBeInstanceOf(
    DemoConfigurationError,
  );
});
it("never restores allowance after a storage failure", async () => {
  const { store } = fixture();
  store.read = vi.fn(async () => {
    throw new Error("private transport details");
  });
  await expect(cloudBudget(store, "test-site").reserve()).rejects.toThrow(
    "Reservation unavailable",
  );
  expect(store.claim).not.toHaveBeenCalled();
});
