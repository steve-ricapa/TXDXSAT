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
 * Participant answer pad. Large, thumb-friendly, no scrolling. Every answer
 * Single-choice answers submit on selection. Multi-select and text answers keep
 * an explicit send action because the player must finish composing the answer.
 * After submission the pad visually locks; the server remains authoritative.
 */
export function QuestionPanel({
  question,
  answered,
  submitting = false,
  onSubmit,
  submitted,
}: {
  question: PublicQuestion;
  answered: boolean;
  submitting?: boolean;
  onSubmit: (answer: AnswerSubmission) => void;
  submitted?: { slot?: number; slots?: number[]; text?: string } | null;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [text, setText] = useState("");

  useEffect(() => {
    setSelected([]);
    setText("");
  }, [question.questionId]);

  const slots = question.options.map((_, index) => index);
  const isMulti = question.type === "multi_select";
  const selectedSlots = submitted?.slots ?? (submitted?.slot === undefined ? [] : [submitted.slot]);

  const selectedAnswer = (
    <div className="w-full max-w-sm space-y-2">
      {selectedSlots.map((slot) => (
        <AnswerCard key={slot} slot={slot} text={optionText(question, slot)} variant="player" state="selected" />
      ))}
      {submitted?.text && <p className="game-chip rounded-2xl px-4 py-4 font-semibold text-ink">“{submitted.text}”</p>}
    </div>
  );

  if (answered) {
    return (
      <div className="pop-in flex h-full flex-col items-center justify-center gap-5 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-accent-soft text-5xl pulse-ring">
          ✅
        </div>
        <div>
          <p className="text-2xl font-black text-ink">¡Respuesta enviada!</p>
          <p className="mt-1 text-sm text-ink-muted">Espera a que el anfitrión muestre los resultados.</p>
        </div>
        {selectedSlots.length > 0 || submitted?.text ? selectedAnswer : null}

        <p className="text-xs uppercase tracking-widest text-ink-soft">🔒 Respuesta bloqueada</p>
      </div>
    );
  }

  if (submitting) {
    return (
      <div className="pop-in flex h-full flex-col items-center justify-center gap-4 text-center">
        {(selectedSlots.length > 0 || submitted?.text) && <>
          <p className="text-xs font-bold uppercase tracking-widest text-ink-muted">Tu selección</p>
          {selectedAnswer}
        </>}
        <span className="text-4xl animate-pulse">⏳</span>
        <p className="text-xl font-black text-ink">Enviando respuesta…</p>
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
          className="w-full rounded-2xl border-2 border-border bg-[var(--color-field)] px-5 py-5 text-xl font-bold text-ink placeholder:text-ink-soft focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          disabled={!text.trim()}
          onClick={() => onSubmit({ chosenText: text.trim() })}
          className="rounded-2xl bg-accent px-6 py-5 text-xl font-black uppercase tracking-wide text-[#04211f] shadow-[0_6px_0_0_#00a79f] transition enabled:hover:brightness-110 enabled:active:translate-y-1 enabled:active:shadow-none disabled:opacity-40"
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
          className="w-full rounded-2xl border-2 border-border bg-[var(--color-field)] px-5 py-6 text-center text-4xl font-black text-ink placeholder:text-2xl placeholder:text-ink-soft focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          disabled={text.trim() === ""}
          onClick={() => onSubmit({ chosenText: text.trim() })}
          className="rounded-2xl bg-accent px-6 py-5 text-xl font-black uppercase tracking-wide text-[#04211f] shadow-[0_6px_0_0_#00a79f] transition enabled:hover:brightness-110 enabled:active:translate-y-1 enabled:active:shadow-none disabled:opacity-40"
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
      <div className={`grid flex-1 content-stretch gap-2.5 sm:gap-3.5 ${twoOptions ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
        {slots.map((slot) => {
          const isSelected = selected.includes(slot);
          return (
            <AnswerCard
              key={slot}
              slot={slot}
              text={optionText(question, slot)}
              imageUrl={optionImage(question, slot)}
              variant="player"
              state={isSelected ? "selected" : selected.length > 0 ? "dimmed" : "idle"}
              index={slot}
              className="flex-1"
              onClick={() => {
                if (isMulti) {
                  setSelected((current) =>
                    current.includes(slot)
                      ? current.filter((value) => value !== slot)
                      : [...current, slot].sort((a, b) => a - b),
                  );
                  return;
                }

                setSelected([slot]);
                onSubmit({ chosenIndex: slot });
              }}
            />
          );
        })}
      </div>

      {isMulti && (
        <button
          type="button"
          disabled={selected.length === 0}
          onClick={() => onSubmit({ chosenIndices: selected })}
          className="flex items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-4 text-lg font-black uppercase tracking-wide text-[#04211f] shadow-[0_6px_0_0_#00a79f] transition enabled:hover:brightness-110 enabled:active:translate-y-1 enabled:active:shadow-none disabled:opacity-40"
        >
          Enviar selección {selected.length > 0 && `(${selected.length})`}
        </button>
      )}

      {selected.length > 0 && (
        <p className="text-center text-xs text-ink-muted">
          {isMulti
            ? "Puedes marcar varias opciones y cambiar tu selección antes de enviarla."
            : "Tu respuesta se envió al seleccionarla."}
        </p>
      )}

      {isMulti && selected.length > 0 && (
        <p className="flex items-center justify-center gap-2 text-center text-xs text-ink-muted">
          {selected.map((slot) => (
            <AnswerShape key={slot} shape={paletteFor(slot).shape} className="h-3 w-3" />
          ))}
        </p>
      )}
    </div>
  );
}
