import { useEffect, useState } from "react";
import type { PublicQuestion } from "../lib/protocol";

export interface AnswerSubmission {
  chosenIndex?: number;
  chosenIndices?: number[];
  chosenText?: string;
}

/** Option text as shown at a display slot (server shuffles via `optionOrder`). */
function optionText(question: PublicQuestion, slot: number): string {
  return question.options[question.optionOrder[slot] ?? slot] ?? "";
}

/**
 * Participant answer UI. Supports every Fase 2 question type. Single-choice
 * submits on tap; multi/typed questions require an explicit submit. The server
 * remains authoritative and rejects anything out of order.
 */
export function QuestionPanel({
  question,
  answered,
  onSubmit,
}: {
  question: PublicQuestion;
  answered: boolean;
  onSubmit: (answer: AnswerSubmission) => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [text, setText] = useState("");

  // Reset local selection whenever a new question opens.
  useEffect(() => {
    setSelected([]);
    setText("");
  }, [question.questionId]);

  const slots = question.options.map((_, index) => index);

  if (answered) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl bg-white/10 p-8 text-center">
        <span className="text-4xl">✅</span>
        <p className="text-lg font-semibold text-white">¡Respuesta enviada!</p>
        <p className="text-sm text-white/60">Espera a que el anfitrión muestre los resultados.</p>
      </div>
    );
  }

  if (question.type === "multiple_choice" || question.type === "true_false") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {slots.map((slot) => (
          <button
            key={slot}
            type="button"
            onClick={() => onSubmit({ chosenIndex: slot })}
            className="min-h-20 rounded-2xl bg-white/90 px-4 py-5 text-left text-base font-semibold text-slate-900 shadow-lg transition hover:-translate-y-0.5 hover:bg-white active:scale-[0.98]"
          >
            <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-sm text-white">
              {String.fromCharCode(65 + slot)}
            </span>
            {optionText(question, slot)}
          </button>
        ))}
      </div>
    );
  }

  if (question.type === "multi_select") {
    const toggle = (slot: number) =>
      setSelected((current) =>
        current.includes(slot) ? current.filter((s) => s !== slot) : [...current, slot],
      );
    return (
      <div className="space-y-3">
        <p className="text-sm text-white/70">Selecciona todas las que apliquen.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {slots.map((slot) => {
            const active = selected.includes(slot);
            return (
              <button
                key={slot}
                type="button"
                onClick={() => toggle(slot)}
                className={`min-h-16 rounded-xl px-4 py-4 text-left font-medium transition ${
                  active ? "bg-emerald-400 text-slate-900" : "bg-white/90 text-slate-900 hover:bg-white"
                }`}
              >
                {optionText(question, slot)}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          disabled={selected.length === 0}
          onClick={() => onSubmit({ chosenIndices: [...selected].sort((a, b) => a - b) })}
          className="w-full rounded-xl bg-[var(--color-brand-500)] py-3 font-semibold text-white disabled:opacity-40"
        >
          Enviar {selected.length > 0 ? `(${selected.length})` : ""}
        </button>
      </div>
    );
  }

  if (question.type === "closest_to") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-white/70">Escribe el número que creas más cercano.</p>
        <input
          type="number"
          inputMode="numeric"
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="w-full rounded-xl bg-white/90 px-4 py-4 text-lg font-semibold text-slate-900"
          placeholder="Tu número"
        />
        <button
          type="button"
          disabled={text.trim() === ""}
          onClick={() => onSubmit({ chosenText: text.trim() })}
          className="w-full rounded-xl bg-[var(--color-brand-500)] py-3 font-semibold text-white disabled:opacity-40"
        >
          Enviar
        </button>
      </div>
    );
  }

  // open_text
  return (
    <div className="space-y-3">
      <input
        type="text"
        value={text}
        maxLength={120}
        onChange={(event) => setText(event.target.value)}
        className="w-full rounded-xl bg-white/90 px-4 py-4 text-lg font-semibold text-slate-900"
        placeholder="Escribe tu respuesta"
      />
      <button
        type="button"
        disabled={text.trim() === ""}
        onClick={() => onSubmit({ chosenText: text.trim() })}
        className="w-full rounded-xl bg-[var(--color-brand-500)] py-3 font-semibold text-white disabled:opacity-40"
      >
        Enviar
      </button>
    </div>
  );
}

export { optionText };
