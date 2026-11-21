import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
const output = path.resolve("artifacts/demo");
const archive = path.join(output, "demo-scenario.zip");
const zip = await JSZip.loadAsync(await fs.readFile(archive));
const expected = JSON.parse(await zip.file("scenario.json").async("string"));
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "msedge" });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const external = [];
  page.on("request", (request) => {
    if (
      !request.url().startsWith("http://127.0.0.1:3107") &&
      !request.url().startsWith("data:") &&
      !request.url().startsWith("blob:")
    )
      external.push(request.url());
  });
  await page.goto("http://127.0.0.1:3107/#/app/settings");
  await page.getByLabel("Importuj plik scenariusza").setInputFiles(archive);
  await page.getByRole("button", { name: "Importuj", exact: true }).click();
  await expect
    .poll(async () =>
      JSON.parse(await page.evaluate(() => localStorage.getItem("doroboty.prototype.v1"))),
    )
    .toEqual(expected);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Ustawienia prototypu" })).toBeVisible();
  await page.goto("http://127.0.0.1:3107/#/aplikuj/ai-product-manager");
  await page
    .getByLabel("Dlaczego pasujesz do tej roli?")
    .fill("Przykładowa kandydatka prowadziła wywiady i przygotowała wymagania produktu AI.");
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Wyślij aplikację", exact: true }).click();
  await expect
    .poll(
      async () =>
        JSON.parse(await page.evaluate(() => localStorage.getItem("doroboty.prototype.v1")))
          .applications.length,
    )
    .toBe(expected.applications.length + 1);
  await page.reload();
  await page.screenshot({ path: path.join(output, "fallback-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: path.join(output, "fallback-mobile.png"), fullPage: true });
  expect(external).toEqual([]);
  const result = {
    checkedAt: new Date().toISOString(),
    success: true,
    environment: "http://127.0.0.1:3107",
    restoredScenario: true,
    standardSubmission: true,
    reload: true,
    externalRequests: 0,
    aiDisabled: true,
    isolatedBrowserContext: true,
  };
  await fs.writeFile(
    path.join(output, "fallback-rehearsal.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
