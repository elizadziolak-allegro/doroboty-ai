import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { MAX_AUDIO_BYTES } from "../src/features/screening/schema.ts";
import { executeScreening, InputError } from "./operations.ts";
import type { ScreeningService } from "./service.ts";
import { classifyError, logDiagnostic, type Diagnostic } from "./diagnostics.ts";

const audioSchema = z.object({
  mime: z.enum(["audio/webm", "audio/mp4"]),
  base64: z
    .string()
    .min(4)
    .max(Math.ceil(MAX_AUDIO_BYTES / 3) * 4)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/),
});
export function createScreeningServer(
  service: ScreeningService | null,
  log: (event: Diagnostic) => void = logDiagnostic,
) {
  let active = 0;
  return createServer(async (req, res) => {
    const requestId = randomUUID();
    const send = (code: number, data: unknown) => {
      res.writeHead(code, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
      });
      res.end(JSON.stringify(data));
    };
    // Loopback only, plus an Origin check: other websites cannot spend the local API key.
    const origin = req.headers.origin;
    if (origin && !/^http:\/\/127\.0\.0\.1:(3001|3002|3106)$/.test(origin))
      return send(403, { error: "Niedozwolone źródło żądania." });
    if (req.method === "GET" && req.url === "/api/health") {
      try {
        return send(200, { configured: !!service, ...(await service?.demoStatus?.()) });
      } catch (error) {
        log({ ...classifyError(error), requestId, operation: "health" });
        return send(503, {
          configured: false,
          error: "Nie można odczytać limitu pokazu. AI jest wstrzymane.",
        });
      }
    }
    if (
      req.method !== "POST" ||
      ![
        "/api/screening/questions",
        "/api/screening/transcribe",
        "/api/screening/summary",
        "/api/screening/next",
      ].includes(req.url || "")
    )
      return send(404, { error: "Nie znaleziono operacji." });
    if (!service)
      return send(503, {
        error:
          "Brak klucza OpenAI. Uzupełnij lokalny plik .env i uruchom serwer ponownie. Możesz aplikować bez pytań AI.",
      });
    if (!req.headers["content-type"]?.startsWith("application/json"))
      return send(415, { error: "Wymagany format JSON." });
    if (active >= 3)
      return send(429, { error: "Trwa przetwarzanie innych odpowiedzi. Spróbuj za chwilę." });
    active++;
    try {
      if (req.url === "/api/screening/transcribe" && (await service.demoStatus?.())?.textOnly)
        return send(403, {
          error: "Ten pokaz używa odpowiedzi tekstowych. Wpisz odpowiedź zamiast nagrywania.",
        });
      let bytes = 0;
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > (req.url === "/api/screening/transcribe" ? 14 * 1024 * 1024 : 256 * 1024)) {
          send(413, { error: "Przekroczono dopuszczalny rozmiar żądania." });
          return;
        }
        chunks.push(Buffer.from(chunk));
      }
      let body: unknown;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString());
      } catch {
        return send(400, { error: "Nieprawidłowy JSON." });
      }
      if (req.url !== "/api/screening/transcribe") {
        send(200, await executeScreening((req.url || "").split("/").at(-1)!, body, service));
      } else {
        const input = audioSchema.parse(body);
        const audio = Buffer.from(input.base64, "base64");
        if (audio.length > MAX_AUDIO_BYTES)
          return send(413, { error: "Nagranie jest za duże (maksymalnie 10 MB)." });
        const text = z
          .string()
          .trim()
          .min(1)
          .max(12000)
          .parse(await service.transcribe(audio, input.mime));
        send(200, { text });
      }
    } catch (error) {
      const diagnostic = classifyError(error);
      log({
        ...diagnostic,
        requestId,
        operation: (req.url || "").split("/").at(-1) || "unknown",
      });
      if (diagnostic.category === "budget" || diagnostic.category === "configuration")
        return send(429, {
          error:
            "Osiągnięto limit prób AI lub licznik pokazu jest niedostępny. Wybierz aplikowanie bez AI; restart nie odnawia limitu.",
          requestId,
        });
      if (error instanceof z.ZodError || error instanceof InputError)
        send(400, {
          error: "Nieprawidłowe dane lub odpowiedź AI. Sprawdź treść i spróbuj ponownie.",
        });
      else
        send(502, {
          error:
            "Nie udało się przetworzyć odpowiedzi w OpenAI. Sprawdź klucz, dostęp do modelu i połączenie. Twoje odpowiedzi pozostają zapisane; możesz ponowić lub pominąć etap.",
        });
    } finally {
      active--;
    }
  });
}
