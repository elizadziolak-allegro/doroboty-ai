import { test, expect } from "@playwright/test";
import { initialState } from "../../src/features/prototype/model";
import { STORAGE_KEY } from "../../src/features/prototype/storage";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

test("second tab cannot edit; closing the writer allows takeover with the latest save", async ({
  page,
  context,
}) => {
  await page.goto("/#/auth/sign-in");
  await page.getByRole("button", { name: "Wejdź jako Anna Kowalska", exact: true }).click();
  const original = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  const other = await context.newPage();
  await other.goto("/#/app/settings");
  await expect(
    other.getByRole("heading", { name: "Prototyp jest otwarty w innej karcie" }),
  ).toBeVisible();
  await expect(other.getByRole("button", { name: "Resetuj scenariusz", exact: true })).toHaveCount(
    0,
  );
  expect(await other.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(original);
  await other.setViewportSize({ width: 375, height: 812 });
  expect(await other.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.close();
  await other.getByRole("button", { name: "Spróbuj ponownie" }).click();
  await expect(other.getByRole("heading", { name: "Ustawienia prototypu" })).toBeVisible();
  expect(await other.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(original);
});

test("exports a synthetic demo ZIP and restores the same scenario in a separate browser context", async ({
  page,
  browser,
}) => {
  const state = initialState();
  state.activePersonId = "candidate-anna";
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: STORAGE_KEY,
    value: JSON.stringify(state),
  });
  await page.goto("/#/app/settings");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Eksportuj dane", exact: true }).click();
  const output = path.resolve("artifacts/demo");
  await mkdir(output, { recursive: true });
  const zip = path.join(output, "demo-scenario.zip");
  await (await download).saveAs(zip);
  const isolated = await browser.newContext();
  try {
    const restored = await isolated.newPage();
    await restored.goto("http://127.0.0.1:3106/#/app/settings");
    await restored.getByLabel("Importuj plik scenariusza").setInputFiles(zip);
    await restored.getByRole("button", { name: "Importuj", exact: true }).click();
    await expect
      .poll(async () =>
        JSON.parse((await restored.evaluate((key) => localStorage.getItem(key), STORAGE_KEY))!),
      )
      .toEqual(state);
    await restored.reload();
    expect(
      JSON.parse((await restored.evaluate((key) => localStorage.getItem(key), STORAGE_KEY))!),
    ).toEqual(state);
    expect((await readFile(zip)).byteLength).toBeGreaterThan(100);
    await restored.goto("http://127.0.0.1:3106/#/auth/sign-in");
    await restored.getByRole("button", { name: "Wejdź jako Marek Nowak", exact: true }).click();
    expect(
      JSON.parse((await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY))!),
    ).toEqual(state);
    await restored.goto("http://127.0.0.1:3106/#/oferty");
    const support = restored.getByRole("link", { name: "Zgłoś problem", exact: true });
    await expect(support).toHaveAttribute("href", "mailto:eliza.dziolak@gmail.com");
    await support.focus();
    await expect(support).toBeFocused();
    await restored
      .locator("footer")
      .screenshot({ path: path.join(output, "public-footer-desktop.png") });
    await restored.setViewportSize({ width: 375, height: 812 });
    expect(await restored.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await restored
      .locator("footer")
      .screenshot({ path: path.join(output, "public-footer-mobile.png") });
  } finally {
    await isolated.close();
  }
});
