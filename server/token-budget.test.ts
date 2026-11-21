import { expect, it } from "vitest";
import {
  tokenBudget,
  usageMicroUsd,
  REQUEST_MICRO_USD,
  type CostLedger,
  type CostStore,
} from "./token-budget";
function fixture() {
  let data: CostLedger = {
    version: 2,
    siteId: "test",
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
  };
  let version = 1;
  const store: CostStore = {
    read: async () => ({ data: structuredClone(data), etag: String(version) }),
    replace: async (state, etag) => {
      if (etag !== String(version)) return { modified: false };
      data = structuredClone(state);
      return { modified: true, etag: String(++version) };
    },
  };
  return {
    store,
    budget: () => tokenBudget(() => store, "test"),
    get: () => data,
    set: (s: CostLedger) => {
      data = s;
    },
  };
}
it("prices ordinary, cached and reasoning-inclusive output tokens with upward microdollar rounding", () => {
  expect(usageMicroUsd(1000, 100, 400)).toBe(360);
  expect(usageMicroUsd(1, 0)).toBe(1);
  expect(usageMicroUsd(400000, 8192)).toBe(REQUEST_MICRO_USD);
  expect(() => usageMicroUsd(1, 1, 2)).toThrow();
  expect(() => usageMicroUsd(-1, 0)).toThrow();
});
it("settles once across independent instances and releases unused reservation", async () => {
  const f = fixture();
  const id = await f.budget().reserve();
  expect((await f.budget().status()).reservedUsd).toBe(0.116384);
  await Promise.all([f.budget().usage(1000, 100, 400, id), f.budget().usage(1000, 100, 400, id)]);
  expect(f.get().settledCalls).toBe(1);
  expect(await f.budget().status()).toMatchObject({
    spentUsd: 0.12536,
    reservedUsd: 0,
    remainingUsd: 4.87464,
    accounting: "tokens",
  });
});
it("permits more than 25 settled calls while retaining unknown reservations across restarts", async () => {
  const f = fixture();
  await f.budget().reserve();
  for (let i = 0; i < 40; i++) {
    const id = await f.budget().reserve();
    await f.budget().usage(100, 100, 0, id);
  }
  expect(f.get().settledCalls).toBe(40);
  expect(Object.keys(f.get().pending)).toHaveLength(1);
});
it("cannot overspend the final affordable reservation under concurrent instances", async () => {
  const f = fixture();
  f.set({ ...f.get(), spentMicroUsd: 5000000 - REQUEST_MICRO_USD });
  const results = await Promise.allSettled(Array.from({ length: 20 }, () => f.budget().reserve()));
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect((await f.budget().status()).remainingUsd).toBe(0);
});
it("stopped budgets reject new work but can settle already paid work", async () => {
  const f = fixture();
  const id = await f.budget().reserve();
  f.set({ ...f.get(), enabled: false });
  await expect(f.budget().reserve()).rejects.toThrow();
  await f.budget().usage(1000, 100, 0, id);
  expect(f.get().settledCalls).toBe(1);
});
it("fails closed for missing/corrupt/wrong-site state and uncertain writes", async () => {
  const f = fixture();
  await expect(tokenBudget(() => f.store, "wrong").reserve()).rejects.toThrow();
  for (const data of [null, {}, { ...f.get(), spentMicroUsd: 5000001 }]) {
    await expect(
      tokenBudget(
        () => ({ ...f.store, read: async () => ({ data, etag: "1" }) }),
        "test",
      ).reserve(),
    ).rejects.toThrow();
  }
  const uncertain = { ...f.store, replace: async () => ({ modified: true }) };
  await expect(tokenBudget(() => uncertain, "test").reserve()).rejects.toThrow();
});
it("retains a reservation when usage is invalid or settlement storage fails", async () => {
  const f = fixture();
  const id = await f.budget().reserve();
  await expect(f.budget().usage(1, 9000, 0, id)).rejects.toThrow();
  await expect(
    tokenBudget(
      () => ({
        ...f.store,
        replace: async () => {
          throw new Error("offline");
        },
      }),
      "test",
    ).usage(1, 1, 0, id),
  ).rejects.toThrow();
  expect(Object.keys(f.get().pending)).toEqual([id]);
});
