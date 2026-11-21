import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function SingleWriter({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"waiting" | "ready" | "occupied" | "unsupported">("waiting");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    let release: (() => void) | undefined;
    const controller = new AbortController();
    const leave = () => {
      alive = false;
      controller.abort();
      release?.();
    };
    const resume = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", resume);
    if (!navigator.locks) {
      queueMicrotask(() => {
        if (alive) setStatus("unsupported");
      });
      return () => {
        alive = false;
        window.removeEventListener("pagehide", leave);
        window.removeEventListener("pageshow", resume);
      };
    }
    queueMicrotask(() => {
      if (!alive) return;
      void navigator.locks
        .request(
          "doroboty-scenario-writer",
          attempt === 0 ? { ifAvailable: true } : { signal: controller.signal },
          async (lock) => {
            if (!alive) return;
            if (!lock) {
              setStatus("occupied");
              return;
            }
            setStatus("ready");
            await new Promise<void>((resolve) => {
              release = resolve;
            });
          },
        )
        .catch(() => {
          if (alive) setStatus("unsupported");
        });
    });
    return () => {
      leave();
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("pageshow", resume);
    };
  }, [attempt]);
  if (status === "ready") return children;
  return (
    <main className="prototype-section">
      <section className="prototype-panel space-y-4">
        <h1>
          {status === "occupied" ? "Prototyp jest otwarty w innej karcie" : "Otwieranie prototypu"}
        </h1>
        <p role="status">
          {status === "waiting"
            ? "Sprawdzamy dostęp do zapisu scenariusza…"
            : status === "occupied"
              ? "Kontynuuj w pierwszej karcie. Aby pracować tutaj, zamknij tamtą kartę i spróbuj ponownie. Twoje dane pozostają zapisane."
              : "Ta przeglądarka nie pozwala bezpiecznie zablokować wspólnego zapisu. Otwórz prototyp w aktualnym Edge lub Chrome pod lokalnym adresem."}
        </p>
        {status !== "waiting" && (
          <Button
            onClick={() => {
              setStatus("waiting");
              setAttempt((value) => value + 1);
            }}
          >
            Spróbuj ponownie
          </Button>
        )}
      </section>
    </main>
  );
}
