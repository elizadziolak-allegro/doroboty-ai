import { z } from "zod";
export async function screeningRequest<T>(
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 75000);
  try {
    const response = await fetch(`/api/screening/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Błąd OpenAI.");
    return schema.parse(data);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError")
      throw new Error(
        "Przekroczono czas oczekiwania. Odpowiedzi pozostały w formularzu. Spróbuj ponownie lub pomiń etap.",
      );
    if (error instanceof TypeError)
      throw new Error(
        "Nie można połączyć się z AI. Możesz pominąć etap. Zgłoś problem: eliza.dziolak@gmail.com.",
      );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
