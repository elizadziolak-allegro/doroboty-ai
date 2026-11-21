import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  questionsSchema,
  summarySchema,
  validateQuestions,
  validateComplete,
  validateSummary,
  validateAnswer,
  nextDecisionSchema,
  type Screening,
  type ScreeningContext,
} from "./schema";
import { screeningRequest } from "./api";
import { requireAudio } from "./media";
import { AudioPlayer } from "./audio-player";
import { Recorder } from "./recorder";
import { SummaryView, ScreeningRecord } from "./record";
import { advanceConversation, needsAssessment, revisitQuestion } from "./conversation";

export function ScreeningForm({
  context,
  value: storedValue,
  onChange,
  onBusy,
  disabled,
}: {
  context: ScreeningContext;
  value?: Screening;
  onChange: (value: Screening | undefined) => void;
  onBusy: (busy: boolean) => void;
  disabled: boolean;
}) {
  const value: Screening | undefined =
    storedValue && !storedValue.conversation && !storedValue.summary
      ? { ...storedValue, conversation: { activeId: "q1", resolvedIds: [] } }
      : storedValue;
  const [open, setOpen] = useState(!!value);
  const [canBypassAssessment, setCanBypassAssessment] = useState(false);
  const questionRef = useRef<HTMLHeadingElement>(null);
  const [infoVisible, setInfoVisible] = useState(false);
  const [infoPinned, setInfoPinned] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recordingQuestion, setRecordingQuestion] = useState<string | null>(null);
  const [error, setError] = useState("");
  const alive = useRef(true);
  const locked = useRef(false);
  const [health, setHealth] = useState("");
  const [textOnly, setTextOnly] = useState(true);
  useEffect(() => {
    alive.current = true;
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => {
        if (alive.current) setTextOnly(data.configured !== true || data.textOnly !== false);
        if (alive.current && !data.configured)
          setHealth(
            "AI jest chwilowo niedostępne. Możesz aplikować bez pytań AI. Zgłoś problem: eliza.dziolak@gmail.com.",
          );
      })
      .catch(() => {
        if (alive.current)
          setHealth(
            "Nie można połączyć się z AI. Możesz aplikować bez pytań AI. Zgłoś problem: eliza.dziolak@gmail.com.",
          );
      });
    return () => {
      alive.current = false;
    };
  }, []);
  const activeId = value?.conversation?.activeId;
  useEffect(() => {
    questionRef.current?.focus();
    setCanBypassAssessment(false);
    setError("");
  }, [activeId]);
  const working = busy || recordingQuestion !== null;
  function markBusy(next: boolean) {
    setBusy(next);
    onBusy(next);
  }
  async function perform(task: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    markBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      locked.current = false;
      if (alive.current) markBusy(false);
    }
  }
  function changeAnswer(index: number, changes: Partial<Screening["answers"][number]>) {
    if (!value) return;
    onChange({
      ...value,
      approved: false,
      summary: undefined,
      answers: value.answers.map((a, i) => (i === index ? { ...a, ...changes } : a)),
    });
  }
  return (
    <section className="application-form-section screening" aria-labelledby="screening-title">
      <div className="screening-heading">
        <h3 id="screening-title">Przyspiesz rekrutację</h3>
        <div
          className="screening-info"
          onMouseEnter={() => setInfoVisible(true)}
          onMouseLeave={() => setInfoVisible(false)}
        >
          <button
            type="button"
            aria-label="Informacje o przyspieszeniu rekrutacji"
            aria-describedby={infoVisible || infoPinned ? "screening-tooltip" : undefined}
            aria-expanded={infoPinned}
            onFocus={() => setInfoVisible(true)}
            onBlur={() => {
              setInfoVisible(false);
              setInfoPinned(false);
            }}
            onClick={() => {
              setInfoVisible(false);
              setInfoPinned((v) => !v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setInfoVisible(false);
                setInfoPinned(false);
                e.stopPropagation();
              }
            }}
          >
            ⓘ
          </button>
          {(infoVisible || infoPinned) && (
            <span role="tooltip" id="screening-tooltip">
              Odpowiedz na 3 pytania AI i ewentualnie 2 krótkie dopytania — rekruter może pominąć
              rozmowę wstępną
            </span>
          )}
        </div>
      </div>
      <p className="application-help">
        Opcjonalnie. Trzy pytania główne, jedno na ekranie. AI może zadać maksymalnie dwa krótkie
        dopytania w całej rozmowie. Wybierz tekst lub głos. Możesz pominąć ten etap bez blokowania
        aplikacji.
      </p>
      {health && <p className="application-help">{health}</p>}
      {!open ? (
        <Button type="button" variant="outline" disabled={disabled} onClick={() => setOpen(true)}>
          Rozpocznij
        </Button>
      ) : (
        <>
          {!value && (
            <>
              <p>
                Po rozpoczęciu przekażemy do OpenAI treść oferty i CV z Twojego profilu. Przy
                odpowiedziach głosowych wyślemy nagranie do transkrypcji; odpowiedzi wykorzystamy do
                podsumowania. Materiały trafią do rekrutera dopiero po wysłaniu aplikacji. Używaj
                przykładowych danych.
              </p>
              <label className="screening-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  disabled={working || disabled}
                  onChange={(e) => setConsent(e.target.checked)}
                />{" "}
                Chcę skorzystać z OpenAI i przekazać te materiały do przetworzenia.
              </label>
              <Button
                type="button"
                disabled={!consent || working || disabled}
                onClick={() =>
                  void perform(async () => {
                    const result = await screeningRequest("questions", context, questionsSchema);
                    validateQuestions(result.questions);
                    if (alive.current)
                      onChange({
                        context,
                        questions: result.questions,
                        answers: result.questions.map((q) => ({
                          questionId: q.id,
                          mode: "text",
                          text: "",
                        })),
                        approved: false,
                        conversation: { activeId: "q1", resolvedIds: [] },
                      });
                  })
                }
              >
                Wygeneruj 3 pytania
              </Button>
            </>
          )}
          {value?.conversation?.activeId && (
            <p className="screening-progress" role="status">
              Pytanie{" "}
              {value.questions.find((q) => q.id === activeId)?.parentId?.slice(1) ||
                activeId?.slice(1)}{" "}
              z 3 · Dopytania: {value.questions.length - 3} / 2
            </p>
          )}
          {value?.questions
            .filter((q) => q.id === activeId)
            .map((q) => {
              const index = value.questions.findIndex((item) => item.id === q.id);
              const answer = value.answers[index];
              const answerLabel = q.parentId
                ? "Doprecyzowanie " + q.id.slice(1)
                : "Odpowiedź " + q.id.slice(1);
              return (
                <section
                  className="screening-question"
                  key={q.id}
                  aria-labelledby={`screening-${q.id}`}
                >
                  <h4 id={`screening-${q.id}`} tabIndex={-1} ref={questionRef}>
                    {q.parentId ? "Dopytanie: " : q.id.slice(1) + ". "}
                    {q.question}
                  </h4>
                  {q.reason && <p className="application-help">{q.reason}</p>}
                  <p className="application-help">Dotyczy: {q.requirement}</p>
                  <div
                    className="screening-actions"
                    role="group"
                    aria-label={`Forma odpowiedzi ${index + 1}`}
                  >
                    {(["text", "voice"] as const).map((mode) => (
                      <Button
                        type="button"
                        key={mode}
                        aria-pressed={answer.mode === mode}
                        variant={answer.mode === mode ? "default" : "outline"}
                        disabled={working || disabled || (mode === "voice" && textOnly)}
                        onClick={() =>
                          answer.mode !== mode &&
                          changeAnswer(index, {
                            mode,
                            audioId: undefined,
                            originalTranscript: undefined,
                          })
                        }
                      >
                        {mode === "text" ? "Tekst" : "Głos"}
                      </Button>
                    ))}
                  </div>
                  {textOnly && (
                    <p className="application-help">W tym pokazie odpowiadamy tekstem.</p>
                  )}
                  {answer.mode === "voice" && (
                    <>
                      {answer.audioId && <AudioPlayer key={answer.audioId} id={answer.audioId} />}
                      {!disabled && !textOnly && (
                        <Recorder
                          disabled={
                            busy || (recordingQuestion !== null && recordingQuestion !== q.id)
                          }
                          onSaved={(audioId, text) =>
                            changeAnswer(index, { audioId, text, originalTranscript: text })
                          }
                          onBusy={(next) => {
                            setRecordingQuestion(next ? q.id : null);
                            onBusy(next);
                          }}
                        />
                      )}
                    </>
                  )}
                  <label className="field">
                    <span>
                      {answer.mode === "voice"
                        ? `Transkrypcja: ${answerLabel} — możesz poprawić`
                        : answerLabel}
                    </span>
                    <Textarea
                      aria-label={
                        answer.mode === "voice"
                          ? `Transkrypcja: ${answerLabel} — możesz poprawić`
                          : answerLabel
                      }
                      rows={4}
                      maxLength={12000}
                      value={answer.text}
                      disabled={working || disabled}
                      onChange={(e) => changeAnswer(index, { text: e.target.value })}
                    />
                  </label>
                  {answer.originalTranscript !== undefined &&
                    answer.originalTranscript !== answer.text && (
                      <details>
                        <summary>Oryginalna transkrypcja</summary>
                        <p>{answer.originalTranscript}</p>
                      </details>
                    )}
                  <div className="screening-actions">
                    <Button
                      type="button"
                      disabled={working || disabled}
                      onClick={() =>
                        void perform(async () => {
                          validateAnswer(value, q.id);
                          if (answer.audioId) await requireAudio([answer.audioId]);
                          let decision = { followUp: null } as ReturnType<
                            typeof nextDecisionSchema.parse
                          >;
                          if (needsAssessment(value)) {
                            try {
                              decision = await screeningRequest(
                                "next",
                                {
                                  context: value.context,
                                  questions: value.questions,
                                  answers: value.answers,
                                  conversation: value.conversation,
                                  questionId: q.id,
                                },
                                nextDecisionSchema,
                              );
                            } catch (error) {
                              setCanBypassAssessment(true);
                              throw error;
                            }
                          }
                          if (alive.current) {
                            onChange(advanceConversation(value, decision));
                            setCanBypassAssessment(false);
                          }
                        })
                      }
                    >
                      Dalej
                    </Button>
                    {q.parentId && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={working || disabled}
                        onClick={() => {
                          const skipped = {
                            ...value,
                            answers: value.answers.map((a) =>
                              a.questionId === q.id
                                ? {
                                    questionId: a.questionId,
                                    mode: "text" as const,
                                    text: "",
                                    skipped: true,
                                  }
                                : a,
                            ),
                          };
                          onChange(advanceConversation(skipped));
                        }}
                      >
                        Pomiń dopytanie
                      </Button>
                    )}
                    {canBypassAssessment && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={working || disabled}
                        onClick={() => {
                          onChange(advanceConversation(value));
                          setCanBypassAssessment(false);
                        }}
                      >
                        Dalej bez dopytania
                      </Button>
                    )}
                  </div>
                  <p className="application-help">
                    Nie musisz znać liczb ani ujawniać poufnych informacji. Możesz wskazać konkretną
                    obserwację lub powiedzieć, czego nie wiesz.
                  </p>
                </section>
              );
            })}
          {value && !activeId && (
            <>
              <h4 tabIndex={-1} ref={questionRef}>
                Sprawdź odpowiedzi
              </h4>
              <ScreeningRecord screening={{ ...value, summary: undefined }} />
              <p className="application-help">
                Edycja rozpocznie tę część rozmowy ponownie i odświeży kartę dowodów. Dotychczasowe
                odpowiedzi główne pozostaną zapisane.
              </p>
              <div className="screening-actions">
                {value.questions.slice(0, 3).map((q) => (
                  <Button
                    key={q.id}
                    type="button"
                    variant="outline"
                    disabled={working || disabled}
                    onClick={() => onChange(revisitQuestion(value, q.id))}
                  >
                    Edytuj odpowiedź {q.id.slice(1)}
                  </Button>
                ))}
              </div>
              <Button
                type="button"
                disabled={working || disabled}
                onClick={() =>
                  void perform(async () => {
                    validateComplete(value);
                    await requireAudio(
                      value.answers.flatMap((a) => (a.audioId ? [a.audioId] : [])),
                    );
                    const result = await screeningRequest(
                      "summary",
                      {
                        context: value.context,
                        questions: value.questions,
                        answers: value.answers,
                        conversation: value.conversation,
                      },
                      summarySchema,
                    );
                    validateSummary(value, result);
                    if (alive.current) onChange({ ...value, summary: result, approved: false });
                  })
                }
              >
                {value.summary ? "Odśwież podsumowanie AI" : "Przygotuj podsumowanie AI"}
              </Button>
              {value.summary && (
                <>
                  <SummaryView summary={value.summary} />
                  <label className="screening-consent">
                    <input
                      type="checkbox"
                      checked={value.approved}
                      disabled={working || disabled}
                      onChange={(e) => onChange({ ...value, approved: e.target.checked })}
                    />{" "}
                    Zatwierdzam odpowiedzi, nagrania i podsumowanie do dołączenia do aplikacji.
                  </label>
                </>
              )}
              {value.approved && (
                <p role="status">Komplet odpowiedzi AI zostanie dołączony do aplikacji.</p>
              )}
            </>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={working || disabled}
            onClick={() => {
              onChange(undefined);
              setOpen(false);
              setConsent(false);
              setError("");
            }}
          >
            Pomiń ten etap
          </Button>
        </>
      )}
      {busy && <p role="status">OpenAI przetwarza materiały…</p>}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
    </section>
  );
}
