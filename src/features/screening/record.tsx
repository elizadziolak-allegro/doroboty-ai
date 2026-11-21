import { Button } from "@/components/ui/button";
import { AudioPlayer } from "./audio-player";
import { orderedQuestions, type Screening, type ScreeningSummary } from "./schema";
export function SummaryView({ summary }: { summary: ScreeningSummary }) {
  return (
    <div className="screening-summary">
      <h4>{summary.evidence ? "Karta dowodów AI" : "Podsumowanie AI"}</h4>
      <p>{summary.overview}</p>
      <p className="application-help">
        Interpretacja relacji kandydata, nie niezależne potwierdzenie kompetencji. Decyzja o
        rozmowie należy do rekrutera.
      </p>
      {summary.evidence && (
        <div className="screening-evidence">
          {summary.evidence.map((item) => (
            <section key={item.area} className="screening-explanation">
              <h4>
                {
                  {
                    ownContribution: "Własny wkład",
                    decision: "Decyzja i uzasadnienie",
                    result: "Rezultat i podstawa oceny",
                  }[item.area]
                }
              </h4>
              <p className="application-help">
                {item.status === "declared" ? "Deklaracja kandydata" : "Brak danych"}
              </p>
              <p>{item.statement}</p>
              {item.quote && (
                <blockquote>
                  „{item.quote}”{" "}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={(event) => {
                      event.preventDefault();
                      const source = event.currentTarget
                        .closest(".screening, .screening-record")
                        ?.querySelector<HTMLElement>(
                          "[data-source='" + item.sourceQuestionId + "']",
                        );
                      source?.scrollIntoView({ block: "center" });
                      source?.focus();
                    }}
                  >
                    Zobacz odpowiedź źródłową
                  </Button>
                </blockquote>
              )}
              <p>
                <strong>Do wyjaśnienia:</strong> {item.limitation}
              </p>
            </section>
          ))}
        </div>
      )}
      <details className="screening-interpretations">
        <summary>Interpretacja poszczególnych odpowiedzi</summary>
        {summary.answers.map((item) => (
          <div key={item.questionId} className="screening-explanation">
            <h4>
              {item.questionId.startsWith("f") ? "Doprecyzowanie " : "Odpowiedź "}
              {item.questionId.slice(1)}
            </h4>
            <p>{item.interpretation}</p>
            <blockquote>„{item.quote}”</blockquote>
            <p>
              <strong>Związek z ofertą:</strong> {item.requirement}
            </p>
            <p>
              <strong>Do wyjaśnienia:</strong> {item.gaps}
            </p>
          </div>
        ))}
      </details>
    </div>
  );
}
export function ScreeningRecord({ screening }: { screening: Screening }) {
  return (
    <section className="screening-record">
      <h3>Pytania AI</h3>
      {orderedQuestions(screening).map((question) => {
        const answer = screening.answers.find((a) => a.questionId === question.id)!;
        return (
          <section
            key={question.id}
            className="screening-question"
            tabIndex={-1}
            data-source={question.id}
          >
            <h4>
              {question.parentId
                ? "Dopytanie do pytania " + question.parentId.slice(1) + ": "
                : question.id.slice(1) + ". "}
              {question.question}
            </h4>
            {answer.skipped && <p>Dopytanie pominięte — brak dodatkowej informacji.</p>}
            {answer.audioId && <AudioPlayer key={answer.audioId} id={answer.audioId} />}
            <p>
              <strong>
                {answer.mode === "voice" ? "Zatwierdzona transkrypcja" : "Odpowiedź tekstowa"}
              </strong>
            </p>
            <p>{answer.text}</p>
            {answer.originalTranscript !== undefined &&
              answer.originalTranscript !== answer.text && (
                <details>
                  <summary>Oryginalna transkrypcja (przed korektą kandydata)</summary>
                  <p>{answer.originalTranscript}</p>
                </details>
              )}
          </section>
        );
      })}
      {screening.summary && <SummaryView summary={screening.summary} />}
    </section>
  );
}
