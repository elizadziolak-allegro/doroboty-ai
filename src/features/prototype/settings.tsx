import { useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { usePrototype } from "./store";
import { MAX_IMPORT_BYTES, parseState } from "./storage";
import {
  exportArchive,
  prepareArchive,
  stageImportedMedia,
  MAX_ARCHIVE_BYTES,
  type PreparedImport,
} from "../screening/archive";
import { clearAudio } from "../screening/media";
import { PageTitle } from "./shell";

export function downloadText(name: string, text: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function SettingsPage() {
  const { state, reset, importState, original } = usePrototype();
  const [pending, setPending] = useState<"reset" | "import" | null>(null);
  const [prepared, setPrepared] = useState<PreparedImport>({ raw: "", media: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function readFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    setError("");
    if (!file) return;
    const isZip = file.name.toLowerCase().endsWith(".zip");
    if (file.size > (isZip ? MAX_ARCHIVE_BYTES : MAX_IMPORT_BYTES)) {
      setError("Plik jest za duży (JSON: 2 MB, ZIP: 64 MB).");
      return;
    }
    try {
      setBusy(true);
      if (isZip) setPrepared(await prepareArchive(await file.arrayBuffer()));
      else {
        const raw = await file.text();
        parseState(raw);
        setPrepared({ raw, media: [] });
      }
      setPending("import");
    } catch {
      setError(
        "Nie udało się odczytać pliku. Sprawdź format paczki; dotychczasowy scenariusz pozostał bez zmian.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    setBusy(true);
    setError("");
    try {
      if (pending === "reset") {
        await clearAudio();
        reset();
        setMessage("Przywrócono scenariusz początkowy.");
      } else if (importState(await stageImportedMedia(prepared))) {
        setMessage("Dane zostały zaimportowane.");
      }
      setPending(null);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle>Ustawienia prototypu</PageTitle>
      <section className="prototype-panel prototype-form">
        <h2>Dane scenariusza</h2>
        <p>
          Zmiany są zapisane tylko w tej przeglądarce. Wysłanie linku innej osobie nie przenosi
          Twoich danych. Eksport ZIP pozwala przekazać scenariusz z nagraniami lub zachować kopię
          przed resetem. Import obsługuje także stare pliki JSON.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const blob = await exportArchive(state);
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "doroboty-scenariusz.zip";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              } catch (error) {
                setError((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Eksportuj dane
          </Button>
          <Button variant="outline" render={<label />} disabled={busy}>
            Importuj dane
            <input
              className="sr-only"
              type="file"
              accept="application/json,.json,.zip,application/zip"
              disabled={busy}
              aria-label="Importuj plik scenariusza"
              onChange={readFile}
            />
          </Button>
          {original !== null && (
            <Button
              variant="outline"
              onClick={() =>
                downloadText("doroboty-zapis-do-odzyskania.txt", original, "text/plain")
              }
            >
              Pobierz poprzedni zapis
            </Button>
          )}
        </div>
        <Button disabled={busy} variant="destructive" onClick={() => setPending("reset")}>
          Resetuj scenariusz
        </Button>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
      </section>
      <section className="prototype-panel prototype-form mt-6">
        <h2>O prototypie</h2>
        <p>
          Wybór osoby zastępuje logowanie. Sekcja „Przyspiesz rekrutację” korzysta z OpenAI. Match
          Score i wcześniejsze podsumowania pozostają przykładowe. Używaj przykładowych danych i CV.
        </p>
      </section>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(v) => {
          if (!v) setPending(null);
        }}
        title={pending === "reset" ? "Zresetować scenariusz?" : "Zastąpić dane scenariusza?"}
        description="Ta operacja zastąpi lokalne zmiany. Możesz najpierw wyeksportować dane."
        label={pending === "reset" ? "Resetuj" : "Importuj"}
        pending={busy}
        error={error || undefined}
        onConfirm={confirm}
      />
    </>
  );
}
export function PrivacyPage() {
  return (
    <section className="prototype-section max-w-4xl">
      <h1>Prywatność prototypu</h1>
      <div className="mt-6 space-y-5">
        <p>
          Ta wersja służy do ćwiczeń i testów interfejsu. Nie wpisuj prawdziwych danych osobowych
          ani poufnych informacji.
        </p>
        <p>
          Profile, treść aplikacji i ustawienia pozostają w pamięci tej przeglądarki; nie trafiają
          do bazy. PostHog Cloud EU otrzymuje odsłony stron i zdarzenia użycia, takie jak wyszukanie
          lub wysłanie aplikacji. Zdarzenia mogą zawierać identyfikator wybranej fikcyjnej osoby,
          jej rolę oraz kategorię oferty lub etap rekrutacji. Nie zawierają treści profilu, CV,
          odpowiedzi ani notatek. Automatycznie rejestrujemy wyłącznie kliknięcie publicznego
          przycisku „Build” na liście ofert; formularze i ekrany z prywatnymi informacjami są z tego
          wyłączone. Nie nagrywamy sesji. Po dobrowolnym uruchomieniu pytań AI treść CV i oferty
          oraz odpowiedzi do podsumowania są przekazywane do OpenAI przez serwer aplikacji. Ten
          pokaz korzysta wyłącznie z odpowiedzi tekstowych. Eksport ZIP zawiera scenariusz, notatki
          i ewentualne nagrania zachowane ze starszych wersji.
        </p>
        <p>
          Możesz usunąć zmiany przyciskiem „Resetuj scenariusz” w ustawieniach lub wyczyścić dane
          witryny w przeglądarce. Hosting może prowadzić własne logi dostępu.
        </p>
      </div>
    </section>
  );
}
