import type { Screening } from "../src/features/screening/schema";
export function screeningFixture(): Screening {
  return {
    context: {
      cv: "Przykładowe CV: automatyzacja procesu obsługi klienta.",
      job: {
        title: "AI Product Manager",
        summary: "Rozwój produktów AI.",
        description: "Prowadzenie badań i wdrożeń produktów AI.",
      },
    },
    questions: [
      {
        id: "q1",
        question: "Jaki był Twój wkład w automatyzację obsługi?",
        requirement: "Samodzielne prowadzenie produktu",
      },
      {
        id: "q2",
        question: "Jaką decyzję podjąłeś przy wdrożeniu?",
        requirement: "Podejmowanie decyzji",
      },
      {
        id: "q3",
        question: "Jak sprawdzono rezultat automatyzacji?",
        requirement: "Pomiar efektów",
      },
    ],
    answers: ["q1", "q2", "q3"].map((id, i) => ({
      questionId: id as "q1" | "q2" | "q3",
      mode: "text" as const,
      text: [
        "Prowadziłam badania użytkowników.",
        "Wybrałam prostszy proces.",
        "Porównałam czas obsługi zgłoszeń.",
      ][i],
    })),
    summary: {
      overview: "Kandydatka opisuje badania, decyzję i pomiar.",
      answers: ["q1", "q2", "q3"].map((id, i) => ({
        questionId: id as "q1" | "q2" | "q3",
        interpretation: "Relacja opisuje działanie kandydatki.",
        quote: ["Prowadziłam badania", "Wybrałam prostszy proces", "Porównałam czas"][i],
        requirement: "Praca nad produktem",
        gaps: "Nie zweryfikowano wyniku niezależnie.",
      })),
    },
    approved: true,
  };
}
