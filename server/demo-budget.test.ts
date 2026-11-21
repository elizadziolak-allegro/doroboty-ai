import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { demoBudget, MAX_ATTEMPTS, DemoLimitError, DemoConfigurationError } from "./demo-budget";
import { classifyError } from "./diagnostics";

const folders: string[] = [];
it("freezes local spending before handoff, keeps usage and cannot transfer twice to different sites", () => {
  const file = ledger();
  for (let i = 0; i < 13; i++) demoBudget(file).reserve();
  expect(demoBudget(file).handoff("test-site")).toBe(13);
  expect(() => demoBudget(file).reserve()).toThrow(DemoConfigurationError);
  expect(demoBudget(file).handoff("test-site")).toBe(13);
  expect(() => demoBudget(file).handoff("different-site")).toThrow(DemoConfigurationError);
  expect(JSON.parse(fs.readFileSync(file, "utf8")).attempts).toBe(13);
});
afterEach(() => {
  for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true });
});
function ledger() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "doroboty-budget-"));
  folders.push(folder);
  return path.join(folder, "budget.json");
}
it("reserves before sending and preserves all attempts across restarts, including failures", () => {
  const file = ledger();
  for (let i = 0; i < MAX_ATTEMPTS; i++) demoBudget(file).reserve();
  expect(demoBudget(file).status()).toMatchObject({ attemptsRemaining: 0, reservedUsd: 5 });
  expect(() => demoBudget(file).reserve()).toThrow(DemoLimitError);
});
it("fails closed for corrupt, locked and out-of-range ledgers without resetting them", () => {
  const file = ledger();
  for (const raw of ["broken", '{"version":1,"attempts":-1,"inputTokens":0,"outputTokens":0}']) {
    fs.writeFileSync(file, raw);
    expect(() => demoBudget(file).reserve()).toThrow(DemoConfigurationError);
    expect(fs.readFileSync(file, "utf8")).toBe(raw);
  }
  fs.writeFileSync(file + ".lock", "");
  expect(() => demoBudget(file).reserve()).toThrow(DemoConfigurationError);
  expect(fs.existsSync(file + ".lock")).toBe(true);
});
it("stores only counters and preserves reservations when usage arrives", () => {
  const file = ledger();
  const budget = demoBudget(file);
  budget.reserve();
  budget.usage(100, 200);
  expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual({
    version: 1,
    attempts: 1,
    inputTokens: 100,
    outputTokens: 200,
  });
});
it("allowlists diagnostics without raw provider text, credentials or unknown codes", () => {
  const error = Object.assign(new Error("SECRET CV and api key"), {
    status: 429,
    code: "credit_balance_exhausted",
    body: "PRIVATE",
  });
  expect(classifyError(error)).toEqual({ category: "quota", upstreamStatus: 429 });
  expect(JSON.stringify(classifyError(error))).not.toMatch(/SECRET|PRIVATE|exhausted/);
  expect(classifyError(Object.assign(new Error("private"), { status: 401 }))).toEqual({
    category: "authentication",
    upstreamStatus: 401,
  });
});
