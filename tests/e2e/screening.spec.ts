import { test, expect, type Page } from "@playwright/test";
import { screeningFixture } from "../screening-fixture";
const fixture = screeningFixture();
async function choose(page: Page, name: string) {
  await page.goto("/#/auth/sign-in");
  await page.getByRole("button", { name: "Wejdź jako " + name, exact: true }).click();
}
async function mocks(page: Page) {
  await page.route("**/api/health", (r) =>
    r.fulfill({ json: { configured: true, textOnly: false } }),
  );
  await page.route("**/api/screening/questions", (r) =>
    r.fulfill({ json: { questions: fixture.questions } }),
  );
  await page.route("**/api/screening/next", (r) => r.fulfill({ json: { followUp: null } }));
  await page.route("**/api/screening/transcribe", (r) =>
    r.fulfill({ json: { text: fixture.answers[0].text } }),
  );
  await page.route("**/api/screening/summary", (r) => {
    const body = r.request().postDataJSON();
    const ordered = body.questions
      .slice(0, 3)
      .flatMap((q: { id: string }) => [
        q,
        ...body.questions.filter((f: { parentId?: string }) => f.parentId === q.id),
      ]);
    const answers = ordered
      .map((q: { id: string }) =>
        body.answers.find((a: { questionId: string }) => a.questionId === q.id),
      )
      .filter((a: { skipped?: boolean }) => !a.skipped);
    const source = answers.find((a: { questionId: string }) => a.questionId === "f1") || answers[0];
    return r.fulfill({
      json: {
        overview: "Kandydatka opisuje wkład, decyzję i ograniczenia.",
        answers: answers.map((a: { questionId: string; text: string }) => ({
          questionId: a.questionId,
          interpretation: "Relacja opisuje działanie.",
          quote: a.text,
          requirement: "Praca nad produktem",
          gaps: "Brak niezależnej weryfikacji.",
        })),
        evidence: [
          {
            area: "ownContribution",
            status: "declared",
            statement: "Kandydatka opisuje własne działanie.",
            sourceQuestionId: source.questionId,
            quote: source.text,
            limitation: "Relacja niezweryfikowana.",
          },
          {
            area: "decision",
            status: "declared",
            statement: "Kandydatka opisuje decyzję.",
            sourceQuestionId: "q2",
            quote: body.answers[1].text,
            limitation: "Nie znamy wszystkich alternatyw.",
          },
          {
            area: "result",
            status: "unknown",
            statement: "Brak danych o potwierdzonym wyniku.",
            sourceQuestionId: null,
            quote: "",
            limitation: "Do wyjaśnienia sposób oceny efektu.",
          },
        ],
      },
    });
  });
}
async function setup(page: Page) {
  await mocks(page);
  await choose(page, "Anna Kowalska");
  await page.goto("/#/aplikuj/ai-product-manager");
  await page.getByRole("button", { name: "Rozpocznij", exact: true }).click();
  await page.getByLabel("Chcę skorzystać z OpenAI", { exact: false }).check();
  await page.getByRole("button", { name: "Wygeneruj 3 pytania" }).click();
  await expect(page.getByRole("textbox", { name: "Odpowiedź 1", exact: true })).toBeVisible();
}
async function main(page: Page, n: number, text = fixture.answers[n - 1].text) {
  await page.getByRole("textbox", { name: "Odpowiedź " + n, exact: true }).fill(text);
  await page.getByRole("button", { name: "Dalej", exact: true }).click();
}
async function submit(page: Page) {
  await page
    .getByLabel("Dlaczego pasujesz do tej roli?")
    .fill("Mam doświadczenie w badaniach i wdrożeniach produktu AI.");
  await page
    .getByRole("checkbox", { name: "Zatwierdzam treść i przesłanie aplikacji", exact: false })
    .check();
  await page.getByRole("button", { name: "Wyślij aplikację", exact: true }).click();
  await expect(page).toHaveURL(/app\/aplikacje/);
}
async function fakeRecorder(page: Page, deny = false) {
  await page.addInitScript((deny: boolean) => {
    class FakeRecorder {
      static isTypeSupported() {
        return true;
      }
      state = "inactive";
      ondataavailable?: (event: { data: Blob }) => void;
      onstop?: () => void;
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["recorded voice"], { type: "audio/webm" }) });
        this.onstop?.();
      }
    }
    Object.defineProperty(window, "MediaRecorder", { value: FakeRecorder });
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        if (deny) throw new DOMException("Denied", "NotAllowedError");
        return { getTracks: () => [{ stop() {} }] };
      },
    });
  }, deny);
}
test("concrete answers stay sequential, edit/reload invalidates summary, company boundaries remain", async ({
  page,
}) => {
  await setup(page);
  await expect(page.locator(".screening textarea")).toHaveCount(1);
  for (let n = 1; n <= 3; n++) await main(page, n);
  await page.getByRole("button", { name: "Przygotuj podsumowanie AI" }).click();
  await page.getByLabel("Zatwierdzam odpowiedzi, nagrania").check();
  await page.getByRole("button", { name: "Edytuj odpowiedź 2", exact: true }).click();
  await expect(page.getByLabel("Zatwierdzam odpowiedzi, nagrania")).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Odpowiedź 2", exact: true })
    .fill("Wybrałam tańszy proces automatyzacji.");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Odpowiedź 2", exact: true })).toHaveValue(
    "Wybrałam tańszy proces automatyzacji.",
  );
  await page.getByRole("button", { name: "Dalej", exact: true }).click();
  await page.getByRole("button", { name: "Dalej", exact: true }).click();
  await page.getByRole("button", { name: "Przygotuj podsumowanie AI" }).click();
  await page.getByLabel("Zatwierdzam odpowiedzi, nagrania").check();
  await submit(page);
  const id = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("doroboty.prototype.v1")!).applications.find(
        (a: { candidateId: string }) => a.candidateId === "candidate-anna",
      ).id,
  );
  await choose(page, "Karolina Wiśniewska");
  await page.goto("/#/app/kandydaci/" + id);
  await page.getByRole("tab", { name: "Pytania AI", exact: true }).click();
  const panel = page.getByRole("tabpanel", { name: "Pytania AI" });
  await expect(panel).toContainText("Wybrałam tańszy proces");
  await expect(panel.getByRole("heading", { name: "Karta dowodów AI" })).toBeVisible();
  await expect(panel.locator("audio")).toHaveCount(0);
  await choose(page, "Tomasz Zieliński");
  await page.goto("/#/app/kandydaci/" + id);
  await expect(page.getByRole("tab", { name: "Pytania AI" })).toHaveCount(0);
});
test("mixed voice/text retains corrected transcript and approval on mobile", async ({ page }) => {
  await fakeRecorder(page);
  await setup(page);
  await page
    .getByRole("group", { name: "Forma odpowiedzi 1", exact: true })
    .getByRole("button", { name: "Głos", exact: true })
    .click();
  await page.getByRole("button", { name: "Nagraj odpowiedź", exact: true }).click();
  await page.getByRole("button", { name: "Zatrzymaj nagranie", exact: true }).click();
  const transcript = page.getByRole("textbox", {
    name: "Transkrypcja: Odpowiedź 1 — możesz poprawić",
    exact: true,
  });
  await expect(transcript).toHaveValue(fixture.answers[0].text);
  await transcript.fill("Prowadziłam badania użytkowników i analizę wyników.");
  await page.getByRole("button", { name: "Dalej", exact: true }).click();
  await main(page, 2);
  await main(page, 3);
  await page.getByRole("button", { name: "Przygotuj podsumowanie AI" }).click();
  await page.getByLabel("Zatwierdzam odpowiedzi, nagrania").check();
  await page.reload();
  await expect(page.getByLabel("Nagranie odpowiedzi", { exact: true })).toHaveAttribute(
    "src",
    /^blob:/,
  );
  await expect(page.getByLabel("Zatwierdzam odpowiedzi, nagrania")).toBeChecked();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "artifacts/adaptive-screening-mobile.png", fullPage: true });
});
test("vague answers receive at most two follow-ups, skipping and source links survive", async ({
  page,
}) => {
  await setup(page);
  const assessments: string[] = [];
  await page.route("**/api/screening/next", (r) => {
    const q = r.request().postDataJSON().questionId;
    assessments.push(q);
    return r.fulfill({
      json: {
        followUp: {
          question: q === "q1" ? "Co zrobiłaś osobiście?" : "Dlaczego wybrałaś ten proces?",
          reason: "Doprecyzujmy jeden ważny szczegół.",
        },
      },
    });
  });
  await main(page, 1, "Wdrożyliśmy automatyzację i poprawiliśmy efektywność.");
  await expect(page.getByRole("textbox", { name: "Doprecyzowanie 1", exact: true })).toBeVisible();
  await page.reload();
  await page
    .getByRole("textbox", { name: "Doprecyzowanie 1", exact: true })
    .fill("Samodzielnie przeanalizowałam zgłoszenia i przygotowałam wymagania.");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page
    .locator(".screening")
    .screenshot({ path: "artifacts/adaptive-screening-question.png" });
  await page.getByRole("button", { name: "Dalej", exact: true }).click();
  await main(page, 2, "Wybraliśmy dobry proces.");
  await expect(page.getByRole("textbox", { name: "Doprecyzowanie 2", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pomiń dopytanie", exact: true }).click();
  await main(page, 3, "Nie wiem, nie mam danych o wyniku.");
  expect(assessments).toEqual(["q1", "q2"]);
  await page.getByRole("button", { name: "Przygotuj podsumowanie AI" }).click();
  await expect(page.locator(".screening-summary")).toContainText(
    "Brak danych o potwierdzonym wyniku.",
  );
  await page.getByRole("button", { name: "Zobacz odpowiedź źródłową" }).first().click();
  await expect(page.locator("[data-source=f1]")).toBeFocused();
  await page.getByLabel("Zatwierdzam odpowiedzi, nagrania").check();
  await submit(page);
});
test("denied microphone and missing key allow a standard application", async ({ page }) => {
  await fakeRecorder(page, true);
  await setup(page);
  await page
    .getByRole("group", { name: "Forma odpowiedzi 1", exact: true })
    .getByRole("button", { name: "Głos", exact: true })
    .click();
  await page.getByRole("button", { name: "Nagraj odpowiedź", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Brak zgody na mikrofon");
  await page.getByRole("button", { name: "Pomiń ten etap" }).click();
  await page.route("**/api/screening/questions", (r) =>
    r.fulfill({ status: 503, json: { error: "Brak klucza OpenAI." } }),
  );
  await page.getByRole("button", { name: "Rozpocznij", exact: true }).click();
  await page.getByLabel("Chcę skorzystać z OpenAI", { exact: false }).check();
  await page.getByRole("button", { name: "Wygeneruj 3 pytania" }).click();
  await expect(page.getByRole("alert")).toContainText("Brak klucza");
  await page.getByRole("button", { name: "Pomiń ten etap" }).click();
  await submit(page);
});
test("tooltip works with keyboard/touch and failed assessment preserves answers", async ({
  page,
}) => {
  await mocks(page);
  await choose(page, "Anna Kowalska");
  await page.goto("/#/aplikuj/ai-product-manager");
  const info = page.getByRole("button", { name: "Informacje o przyspieszeniu rekrutacji" });
  await info.focus();
  await expect(page.getByRole("tooltip")).toContainText("rekruter może pominąć");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 700 });
  await info.click();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await setup(page);
  await page.route("**/api/screening/next", (r) =>
    r.fulfill({ status: 502, json: { error: "OpenAI chwilowo niedostępne." } }),
  );
  await main(page, 1);
  await expect(page.getByRole("alert")).toContainText("chwilowo niedostępne");
  await expect(page.getByRole("textbox", { name: "Odpowiedź 1", exact: true })).toHaveValue(
    fixture.answers[0].text,
  );
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Odpowiedź 1", exact: true })).toHaveValue(
    fixture.answers[0].text,
  );
  await page.getByRole("button", { name: "Dalej", exact: true }).click();
  await page.getByRole("button", { name: "Dalej bez dopytania", exact: true }).click();
  await page.route("**/api/screening/next", (r) => r.fulfill({ json: { followUp: null } }));
  await main(page, 2);
  await main(page, 3);
  await page.route("**/api/screening/summary", (r) =>
    r.fulfill({ status: 502, json: { error: "Nie udało się połączyć z OpenAI." } }),
  );
  await page.getByRole("button", { name: "Przygotuj podsumowanie AI" }).click();
  await expect(page.getByRole("alert")).toContainText("Nie udało się połączyć");
  await expect(page.locator(".screening-record")).toContainText(fixture.answers[0].text);
});
