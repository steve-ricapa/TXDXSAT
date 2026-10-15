import type { PublicQuestion, ResultsPayload } from "../lib/protocol";
import { TimerRing } from "./TimerRing";
import { optionText } from "./QuestionPanel";

/**
 * Big-screen presentation of the current question (host control + presenter).
 * Before reveal it shows the answer count climbing; after reveal it overlays the
 * correct option(s) and the vote distribution.
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-white/50">
            Pregunta {question.index + 1} / {question.total}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-white sm:text-3xl">{question.text}</h2>
        </div>
        {!revealed && <TimerRing remaining={remaining} total={question.timeSec} />}
      </div>

      {question.imageUrl && (
        <img src={question.imageUrl} alt="" className="max-h-64 rounded-xl object-contain" />
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {question.options.map((_, slot) => {
          const text = optionText(question, slot);
          const votes = distribution[slot] ?? 0;
          const isCorrect = correct.has(slot);
          return (
            <div
              key={slot}
              className={`relative overflow-hidden rounded-2xl px-4 py-5 text-left font-semibold transition ${
                revealed
                  ? isCorrect
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-700/70 text-white/80"
                  : "bg-white/15 text-white"
              }`}
            >
              {revealed && (
                <span
                  className="absolute inset-y-0 left-0 bg-white/20"
                  style={{ width: `${(votes / maxVotes) * 100}%` }}
                  aria-hidden
                />
              )}
              <span className="relative flex items-center justify-between gap-3">
                <span>
                  <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/25 text-sm">
                    {String.fromCharCode(65 + slot)}
                  </span>
                  {text}
                </span>
                {revealed && <span className="tabular-nums text-sm">{votes}</span>}
              </span>
            </div>
          );
        })}
      </div>

      {question.type === "open_text" && revealed && results?.correctText && (
        <p className="rounded-xl bg-emerald-500/20 px-4 py-3 text-emerald-100">
          Respuesta correcta: <strong>{results.correctText}</strong>
        </p>
      )}
      {question.type === "closest_to" && revealed && results?.correctNumber != null && (
        <p className="rounded-xl bg-emerald-500/20 px-4 py-3 text-emerald-100">
          Número correcto: <strong>{results.correctNumber}</strong>
        </p>
      )}
      {revealed && results?.explanation && (
        <p className="text-sm text-white/70">{results.explanation}</p>
      )}

      {!revealed && (
        <p className="text-center text-sm text-white/60">
          {answeredCount} / {playerCount} han respondido
        </p>
      )}
    </div>
  );
}
