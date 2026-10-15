import { useEffect, useState } from "react";
import type { PublicQuestion } from "../lib/protocol";
import { paletteFor } from "../lib/answer-style";
import { AnswerCard } from "./AnswerCard";
import { AnswerShape } from "./AnswerShape";

export interface AnswerSubmission {
  chosenIndex?: number;
  chosenIndices?: number[];
  chosenText?: string;
}

/** Option text at a display slot (server shuffles via `optionOrder`). */
export function optionText(question: PublicQuestion, slot: number): string {
  return question.options[question.optionOrder[slot] ?? slot] ?? "";
}

/** Option image at a display slot. */
function optionImage(question: PublicQuestion, slot: number): string | null {
  const original = question.optionOrder[slot] ?? slot;
  return question.optionImages?.[original] ?? null;
}

/**
 * Participant answer pad. Large, thumb-friendly, no scrolling. Single-choice
 * submits on tap; multi-select and typed answers need an explicit submit. After
 * answering the pad visually locks. The server remains authoritative.
 */
export function QuestionPanel({
  question,
  answered,
  onSubmit,
  submitted,
}: {
  question: PublicQuestion;
  answered: boolean;
  onSubmit: (answer: AnswerSubmission) => void;
  submitted?: { slot?: number; text?: string } | null;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [text, setText] = useState("");

  useEffect(() => {
    setSelected([]);
    setText("");
  }, [question.questionId]);

  const slots = question.options.map((_, index) => index);
  const isMulti = question.type === "multi_select";

  if (answered) {
    return (
      <div className="pop-in flex h-full flex-col items-center justify-center gap-5 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/20 text-5xl pulse-ring">
          ✅
        </div>
        <div>
          <p className="text-2xl font-black text-white">¡Respuesta enviada!</p>
          <p className="mt-1 text-sm text-white/60">Espera a que el anfitrión muestre los resultados.</p>
        </div>

        {(submitted?.slot !== undefined || submitted?.text) && (
          <div className="w-full max-w-sm">
            {submitted?.slot !== undefined && submitted.slot >= 0 ? (
              <AnswerCard slot={submitted.slot} text={optionText(question, submitted.slot)} variant="player" state="idle" />
            ) : (
              <p className="rounded-2xl bg-white/15 px-4 py-4 font-semibold text-white">
                “{submitted?.text}”
              </p>
            )}
          </div>
        )}

        <p className="text-xs uppercase tracking-widest text-white/40">🔒 Respuesta bloqueada</p>
      </div>
    );
  }

  if (question.type === "open_text") {
    return (
      <div className="flex h-full flex-col justify-center gap-4">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Escribe tu respuesta…"
          autoFocus
          maxLength={300}
          className="w-full rounded-2xl border-4 border-white/20 bg-white/10 px-5 py-5 text-xl font-bold text-white placeholder:text-white/40 focus:border-white/60 focus:outline-none"
        />
        <button
          type="button"
          disabled={!text.trim()}
          onClick={() => onSubmit({ chosenText: text.trim() })}
          className="rounded-2xl bg-emerald-500 px-6 py-5 text-xl font-black uppercase tracking-wide text-white shadow-[0_6px_0_0_#166534] transition enabled:hover:brightness-110 enabled:active:translate-y-1 enabled:active:shadow-none disabled:opacity-40"
        >
          Enviar
        </button>
      </div>
    );
  }

  if (question.type === "closest_to") {
    return (
      <div className="flex h-full flex-col justify-center gap-4">
        <input
          value={text}
          onChange={(event) => setText(event.target.value.replace(/[^\d-]/g, ""))}
          placeholder="Escribe un número…"
          inputMode="numeric"
          autoFocus
          className="w-full rounded-2xl border-4 border-white/20 bg-white/10 px-5 py-6 text-center text-4xl font-black text-white placeholder:text-2xl placeholder:text-white/40 focus:border-white/60 focus:outline-none"
        />
        <button
          type="button"
          disabled={text.trim() === ""}
          onClick={() => onSubmit({ chosenText: text.trim() })}
          className="rounded-2xl bg-emerald-500 px-6 py-5 text-xl font-black uppercase tracking-wide text-white shadow-[0_6px_0_0_#166534] transition enabled:hover:brightness-110 enabled:active:translate-y-1 enabled:active:shadow-none disabled:opacity-40"
        >
          Enviar
        </button>
      </div>
    );
  }

  // multiple_choice / true_false / multi_select
  const twoOptions = question.options.length === 2 && question.type === "true_false";

  return (
    <div className="flex h-full flex-col gap-3">
      <div className={`grid flex-1 content-stretch gap-3 ${twoOptions ? "grid-cols-1" : "grid-cols-1"}`}>
        {slots.map((slot) => {
          const isSelected = selected.includes(slot);
          return (
            <AnswerCard
              key={slot}
              slot={slot}
              text={optionText(question, slot)}
              imageUrl={optionImage(question, slot)}
              variant="player"
              state={isSelected ? "selected" : "idle"}
              index={slot}
              className="flex-1"
              onClick={() =>
                isMulti
                  ? setSelected((current) =>
                      current.includes(slot)
                        ? current.filter((value) => value !== slot)
                        : [...current, slot].sort((a, b) => a - b),
                    )
                  : onSubmit({ chosenIndex: slot })
              }
            />
          );
        })}
      </div>

      {isMulti && (
        <button
          type="button"
          disabled={selected.length === 0}
          onClick={() => onSubmit({ chosenIndices: selected })}
          className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-4 text-lg font-black uppercase tracking-wide text-white shadow-[0_6px_0_0_#166534] transition enabled:hover:brightness-110 enabled:active:translate-y-1 enabled:active:shadow-none disabled:opacity-40"
        >
          Enviar {selected.length > 0 && `(${selected.length})`}
        </button>
      )}

      {isMulti && selected.length > 0 && (
        <p className="flex items-center justify-center gap-2 text-center text-xs text-white/60">
          {selected.map((slot) => (
            <AnswerShape key={slot} shape={paletteFor(slot).shape} className="h-3 w-3" />
          ))}
        </p>
      )}
    </div>
  );
}
