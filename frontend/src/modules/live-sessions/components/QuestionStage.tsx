import type { PublicQuestion, ResultsPayload } from "../lib/protocol";
import { resolveMediaUrl } from "../lib/media";
import { AnswerCard, SlotChip } from "./AnswerCard";
import { TimerRing } from "./TimerRing";

/** Option text + image at a display slot (server shuffles via `optionOrder`). */
function optionAt(question: PublicQuestion, slot: number): { text: string; image: string | null } {
  const original = question.optionOrder[slot] ?? slot;
  return {
    text: question.options[original] ?? "",
    image: question.optionImages?.[original] ?? null,
  };
}

/**
 * Projector board for the current question.
 *
 * Layout: header (number + question), centre (image + circular timer + answers
 * received) and a footer of four big coloured answer tiles. It reflows
 * automatically when a question has no image. Optimised for 1920×1080 but
 * fluid down to tablets.
 */
export function QuestionStage({
  question,
  remaining,
  answeredCount,
  playerCount,
  results,
}: {
  question: PublicQuestion;
  remaining: number;
  answeredCount: number;
  playerCount: number;
  results: ResultsPayload | null;
}) {
  const revealed = results !== null && results.questionId === question.questionId;
  const distribution = revealed ? results.distribution : [];
  const maxVotes = Math.max(1, ...distribution);
  const correct = new Set(revealed ? results.correctDisplayIndices : []);
  const image = resolveMediaUrl(question.imageUrl);
  const isTextType = question.type === "open_text" || question.type === "closest_to";
  const slots = question.options.map((_, index) => index);
  const longQuestion = question.text.length > 70;
  const veryLongQuestion = question.text.length > 140;
  const compactAnswers = longQuestion || question.options.some((option) => option.length > 48);

  return (
    <div className="flex min-h-full flex-col gap-3 sm:gap-4">
      {/* Header — number + question */}
      <header className="shrink-0 text-center">
        <span className="game-chip inline-block rounded-full px-4 py-1 text-sm font-bold uppercase tracking-[0.25em] text-ink-muted">
          Pregunta {question.index + 1} / {question.total}
        </span>
        <h1 className={`mx-auto mt-3 max-w-6xl text-pretty font-black leading-tight text-ink drop-shadow [overflow-wrap:anywhere] ${
          veryLongQuestion
            ? "text-xl sm:text-2xl xl:text-3xl"
            : longQuestion
              ? "text-2xl sm:text-3xl xl:text-4xl"
              : "text-2xl sm:text-3xl xl:text-5xl"
        }`}>
          {question.text}
        </h1>
      </header>

      {/* Centre — image + timer + answers received */}
      <section className="flex min-h-[120px] flex-1 flex-wrap items-center justify-center gap-3 sm:gap-6 xl:gap-8">
        {image && (
          <img
            src={image}
            alt=""
            className="slide-up max-h-52 min-w-0 flex-1 rounded-2xl object-contain shadow-2xl xl:max-h-72"
          />
        )}

        <div className="flex shrink-0 flex-wrap items-center justify-center gap-3 sm:gap-5">
          {!revealed && (
            <TimerRing remaining={remaining} total={question.timeSec} size={image || longQuestion ? 112 : 132} />
          )}

          {revealed ? (
            <div className="game-chip pop-in rounded-2xl px-6 py-3 text-center">
              <p className="text-2xl font-black uppercase tracking-wide text-ink sm:text-3xl">Resultados</p>
              <p className="text-sm text-ink-muted">
                {results?.answeredCount ?? answeredCount} respuestas
              </p>
            </div>
          ) : (
            <div className="game-chip rounded-2xl px-4 py-2 text-center sm:px-6 sm:py-3">
              <p className="text-2xl font-black tabular-nums text-ink sm:text-3xl">
                {answeredCount}
                <span className="text-lg font-bold text-ink-muted sm:text-2xl"> / {playerCount}</span>
              </p>
              <p className="text-[0.65rem] uppercase tracking-widest text-ink-muted">
                respuestas recibidas
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Footer — answers */}
      <footer className="shrink-0">
        {isTextType ? (
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-3">
            {!revealed ? (
              <p className="game-inset rounded-2xl px-6 py-4 text-center text-lg font-semibold text-ink-muted">
                {question.type === "open_text"
                  ? "Los jugadores escriben su respuesta en el móvil…"
                  : "Los jugadores proponen un número en el móvil…"}
              </p>
            ) : (
              <div className="pop-in rounded-2xl bg-accent px-8 py-6 text-center shadow-[0_6px_0_0_#00a79f]">
                <p className="text-sm uppercase tracking-widest text-[#04211f]/70">Respuesta correcta</p>
                <p className="text-3xl font-black text-[#04211f]">
                  {question.type === "open_text"
                    ? results?.correctText ?? "—"
                    : results?.correctNumber ?? "—"}
                </p>
              </div>
            )}
            {revealed && results?.explanation && (
              <p className="text-center text-sm text-ink-muted">{results.explanation}</p>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              {slots.map((slot) => {
                const { text, image: optionImage } = optionAt(question, slot);
                const votes = distribution[slot] ?? 0;
                const state = !revealed
                  ? "idle"
                  : correct.has(slot)
                    ? "correct"
                    : "dimmed";
                return (
                  <AnswerCard
                    key={slot}
                    slot={slot}
                    text={text}
                    imageUrl={optionImage}
                    state={state}
                    votes={votes}
                    maxVotes={maxVotes}
                    showVotes={revealed}
                    index={slot}
                    compact={compactAnswers}
                  />
                );
              })}
            </div>

            {revealed && results?.explanation && (
              <p className="pop-in mx-auto mt-3 max-w-4xl text-center text-sm text-ink-muted sm:text-base">
                {results.explanation}
              </p>
            )}
            {!revealed && (
              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-ink-soft">
                {slots.map((slot) => (
                  <SlotChip key={slot} slot={slot} />
                ))}
              </div>
            )}
          </>
        )}
      </footer>
    </div>
  );
}
