import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures/public-api";
import { screeningFixture } from "../screening-fixture";
import type { State } from "../../src/features/prototype/model";
import { STORAGE_KEY } from "../../src/features/prototype/storage";

const answers = screeningFixture().answers;
test("summary timeout preserves answers and manual recovery allows approval and submission without another AI call", async ({
  page,
  backend,
}) => {
  await questions(page);
  await answerAll(page);
  backend.mode = "summary-timeout";
  await page.getByRole("button", { name: "Przygotuj podsumowanie AI" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Przygotowanie podsumowania AI przekroczyło czas",
  );
  const attempts = backend.providerCalls;
  await page.reload();
  await expect(page.locator(".screening-record")).toContainText(answers[2].text);
  expect(backend.providerCalls).toBe(attempts);
  backend.mode = "healthy";
  await page.getByRole("button", { name: "Przygotuj podsumowanie AI" }).click();
  await page.getByLabel("Zatwierdzam odpowiedzi, nagrania").check();
  const callsBeforeSubmit = backend.providerCalls;
  await submit(page);
  await expect(page).toHaveURL(/app\/aplikacje/);
  expect(backend.providerCalls).toBe(callsBeforeSubmit);
  await page.reload();
  const submitted = (await state(page)).applications.find(
    (a) => a.candidateId === "candidate-anna",
  );
  expect(submitted?.screening?.approved).toBe(true);
  expect(submitted?.screening?.answers.map((a) => a.text)).toEqual(answers.map((a) => a.text));
});
async function state(page: Page): Promise<State> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
}
async function openApplication(page: Page) {
  await page.goto("http://127.0.0.1:3106/#/auth/sign-in");
  await page.getByRole("button", { name: "Wejdź jako Anna Kowalska", exact: true }).click();
  await page.goto("http://127.0.0.1:3106/#/aplikuj/ai-product-manager");
  await page.getByRole("button", { name: "Rozpocznij", exact: true }).click();
  await page.getByLabel("Chcę skorzystać z OpenAI", { exact: false }).check();
}
async function questions(page: Page) {
  await openApplication(page);
  await page.getByRole("button", { name: "Wygeneruj 3 pytania" }).click();
  await expect(page.getByRole("textbox", { name: "Odpowiedź 1", exact: true })).toBeVisible();
}
async function answerAll(page: Page) {
  for (let n = 1; n <= 3; n++) {
    await page
      .getByRole("textbox", { name: `Odpowiedź ${n}`, exact: true })
      .fill(answers[n - 1].text);
    await page.getByRole("button", { name: "Dalej", exact: true }).click();
  }
  await expect(page.getByRole("heading", { name: "Sprawdź odpowiedzi" })).toBeVisible();
}
async function submit(page: Page) {
  await page
    .getByLabel("Dlaczego pasujesz do tej roli?")
    .fill("Mam doświadczenie w badaniach i wdrażaniu produktów AI.");
  await page
    .getByRole("checkbox", { name: "Zatwierdzam treść i przesłanie aplikacji", exact: false })
    .check();
  await page.getByRole("button", { name: "Wyślij aplikację", exact: true }).click();
}

test("public text-only journey requires approval and persists the approved card for the employer", async ({
  page,
  backend,
}) => {
  await questions(page);
  await expect(page.getByRole("button", { name: "Głos", exact: true })).toBeDisabled();
  await answerAll(page);
  await page.getByRole("button", { name: "Przygotuj podsumowanie AI" }).click();
  const approval = page.getByLabel("Zatwierdzam odpowiedzi, nagrania");
  await expect(approval).toBeVisible();
  await submit(page);
  await expect(page).toHaveURL(/aplikuj\/ai-product-manager/);
  expect(
    (await state(page)).applications.filter((a) => a.candidateId === "candidate-anna"),
  ).toHaveLength(0);
  await approval.check();
  await submit(page);
  await expect(page).toHaveURL(/app\/aplikacje/);
  await page.reload();
  const application = (await state(page)).applications.find(
    (a) => a.candidateId === "candidate-anna",
  )!;
  expect(application.screening?.approved).toBe(true);
  expect(application.screening?.answers.map((a) => a.text)).toEqual(answers.map((a) => a.text));
  await page.goto("/#/auth/sign-in");
  await page.getByRole("button", { name: "Wejdź jako Karolina Wiśniewska", exact: true }).click();
  await page.goto(`/#/app/kandydaci/${application.id}`);
  await page.getByRole("tab", { name: "Pytania AI", exact: true }).click();
  await expect(page.getByRole("tabpanel", { name: "Pytania AI" })).toContainText(answers[0].text);
  expect(backend.providerCalls).toBe(5);
  expect(await backend.remaining()).toBe(7);
});

test("two independent browsers share the final AI attempt but retain separate scenarios", async ({
  page,
  browser,
  backend,
}) => {
  backend.leaveOneAttempt();
  const other = await browser.newContext();
  await backend.connect(other);
  try {
    const second = await other.newPage();
    await questions(page);
    await page.getByRole("textbox", { name: "Odpowiedź 1", exact: true }).fill(answers[0].text);
    await openApplication(second);
    await second.getByRole("button", { name: "Wygeneruj 3 pytania" }).click();
    await expect(second.getByRole("alert")).toContainText(
      "Wspólny limit prób AI został wykorzystany",
    );
    expect(backend.providerCalls).toBe(1);
    expect(await backend.remaining()).toBe(0);
    await second.getByRole("button", { name: "Pomiń ten etap" }).click();
    await submit(second);
    await expect(second).toHaveURL(/app\/aplikacje/);
    const submitted = (await state(second)).applications.find(
      (a) => a.candidateId === "candidate-anna",
    )!;
    expect(submitted.screening).toBeUndefined();
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Odpowiedź 1", exact: true })).toHaveValue(
      answers[0].text,
    );
    expect(
      (await state(page)).applications.filter((a) => a.candidateId === "candidate-anna"),
    ).toHaveLength(0);
  } finally {
    await other.close();
  }
});

test("storage outage preserves an answer across reload and resumes only after a manual retry", async ({
  page,
  backend,
}) => {
  await questions(page);
  backend.mode = "storage-down";
  await page.getByRole("textbox", { name: "Odpowiedź 1", exact: true }).fill(answers[0].text);
  await page.getByRole("button", { name: "Dalej", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("AI jest chwilowo niedostępne");
  expect(backend.providerCalls).toBe(1);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Odpowiedź 1", exact: true })).toHaveValue(
    answers[0].text,
  );
  await expect(page.locator(".screening")).toContainText("AI jest chwilowo niedostępne");
  await expect(page.getByRole("button", { name: "Głos", exact: true })).toBeDisabled();
  backend.mode = "healthy";
  expect(backend.providerCalls).toBe(1);
  await page.getByRole("button", { name: "Dalej", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Odpowiedź 2", exact: true })).toBeVisible();
  expect(backend.providerCalls).toBe(2);
});

test("a fabricated quote is rejected by the backend and a corrected summary can be retried", async ({
  page,
  backend,
}) => {
  await questions(page);
  await answerAll(page);
  backend.mode = "invalid-summary";
  await page.getByRole("button", { name: "Przygotuj podsumowanie AI" }).click();
  await expect(page.getByRole("alert")).toContainText("AI jest chwilowo niedostępne");
  await expect(page.getByLabel("Zatwierdzam odpowiedzi, nagrania")).toHaveCount(0);
  await expect(page.getByText("Wymyślony cytat spoza odpowiedzi", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".screening-record")).toContainText(answers[2].text);
  backend.mode = "healthy";
  await page.getByRole("button", { name: "Przygotuj podsumowanie AI" }).click();
  await page.getByLabel("Zatwierdzam odpowiedzi, nagrania").check();
  await submit(page);
  await expect(page).toHaveURL(/app\/aplikacje/);
  expect(backend.providerCalls).toBe(6); // The rejected answer still consumes its attempt.
  expect(await backend.remaining()).toBe(6);
});

test("disabled public AI explains the problem and permits ordinary submission on mobile", async ({
  page,
  backend,
}) => {
  backend.mode = "disabled";
  await page.setViewportSize({ width: 375, height: 812 });
  await openApplication(page);
  await expect(page.locator(".screening")).toContainText("AI jest chwilowo niedostępne");
  await page.getByRole("button", { name: "Wygeneruj 3 pytania" }).click();
  await expect(page.getByRole("alert")).toContainText("bez pytań AI");
  await page.getByRole("button", { name: "Pomiń ten etap" }).click();
  await submit(page);
  await expect(page).toHaveURL(/app\/aplikacje/);
  await page.reload();
  const submitted = (await state(page)).applications.find(
    (a) => a.candidateId === "candidate-anna",
  );
  expect(submitted).toBeDefined();
  expect(submitted?.screening).toBeUndefined();
  expect(backend.providerCalls).toBe(0);
  expect(await backend.remaining()).toBe(12);
});
