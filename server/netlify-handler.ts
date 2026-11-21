import { randomUUID } from "node:crypto";
import { z } from "zod";
import { classifyError, logDiagnostic } from "./diagnostics.ts";
import { executeScreening, InputError, TEXT_OPERATIONS } from "./operations.ts";
import type { ScreeningService } from "./service.ts";

export function publicHandler(createService: () => ScreeningService | null) {
  return async (request: Request) => {
    const requestId = randomUUID();
    const send = (status: number, data: unknown) =>
      Response.json(data, {
        status,
        headers: {
          "Cache-Control": "no-store",
          "X-Request-Id": requestId,
          "X-Content-Type-Options": "nosniff",
        },
      });
    const url = new URL(request.url);
    const operation = url.pathname.split("/").at(-1) || "unknown";
    const origin = request.headers.get("origin");
    if ((origin && origin !== url.origin) || request.headers.get("sec-fetch-site") === "cross-site")
      return send(403, { error: "Niedozwolone źródło żądania." });
    const health = request.method === "GET" && url.pathname === "/api/health";
    if (
      !health &&
      (request.method !== "POST" ||
        !TEXT_OPERATIONS.some((name) => url.pathname === `/api/screening/${name}`))
    )
      return send(404, { error: "Nie znaleziono operacji." });
    try {
      const service = createService();
      if (!service)
        return send(health ? 200 : 503, {
          configured: false,
          textOnly: true,
          error: "AI jest chwilowo niedostępne. Możesz wysłać aplikację bez pytań AI.",
        });
      if (health) return send(200, { configured: true, ...(await service.demoStatus?.()) });
      if (!/^application\/json(?:;|$)/i.test(request.headers.get("content-type") || ""))
        return send(415, { error: "Wymagany format JSON." });
      if (Number(request.headers.get("content-length")) > 256 * 1024)
        return send(413, { error: "Żądanie jest za duże." });
      const reader = request.body?.getReader();
      if (!reader) return send(400, { error: "Brak danych." });
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          bytes += part.value.byteLength;
          if (bytes > 256 * 1024) {
            await reader.cancel();
            return send(413, { error: "Żądanie jest za duże." });
          }
          chunks.push(part.value);
        }
      } finally {
        reader.releaseLock();
      }
      let body: unknown;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        return send(400, { error: "Nieprawidłowy JSON." });
      }
      return send(200, await executeScreening(operation, body, service));
    } catch (error) {
      const diagnostic = classifyError(error);
      logDiagnostic({ ...diagnostic, requestId, operation });
      const invalid = error instanceof z.ZodError || error instanceof InputError;
      const limited = diagnostic.category === "budget";
      return send(invalid ? 400 : limited ? 429 : 503, {
        error: invalid
          ? "Sprawdź dane i postęp rozmowy."
          : limited
            ? "Wspólny limit prób AI został wykorzystany. Możesz aplikować bez AI."
            : diagnostic.category === "timeout"
              ? operation === "summary"
                ? "Przygotowanie podsumowania AI przekroczyło czas oczekiwania. Twoje odpowiedzi pozostają zapisane. Kliknij ponownie „Przygotuj podsumowanie AI” lub wybierz „Pomiń ten etap”, aby wysłać aplikację bez AI."
                : "AI nie odpowiedziało w wymaganym czasie. Twoje odpowiedzi pozostają zapisane. Spróbuj ponownie lub pomiń etap AI."
              : "AI jest chwilowo niedostępne. Twoje odpowiedzi pozostają zapisane. Możesz pominąć etap lub zgłosić problem: eliza.dziolak@gmail.com.",
        requestId,
      });
    }
  };
}
