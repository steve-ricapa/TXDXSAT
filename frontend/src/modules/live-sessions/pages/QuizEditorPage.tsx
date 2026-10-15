import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { MediaPicker } from "../components/MediaPicker";
import { MediaUploader } from "../components/MediaUploader";
import { liveApi } from "../lib/api";
import type { QuizDetail, QuizQuestionInput } from "../lib/api";
import { listMedia, deleteMedia, type MediaAsset } from "../lib/media";

const DEFAULT_QUESTION: QuizQuestionInput = {
  type: "multiple_choice",
  text: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  correctIndices: null,
  correctText: null,
  rangeMin: null,
  rangeMax: null,
  correctNumber: null,
  explanation: null,
  imageUrl: null,
  optionImages: [null, null, null, null],
  baseScore: 500,
  timeSec: 20,
};

export function QuizEditorPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const quizId = params.get("id") ?? null;
  const tenant = params.get("tenant") ?? null;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<QuizQuestionInput[]>([{ ...DEFAULT_QUESTION }]);
  const [detail, setDetail] = useState<QuizDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerIndex] = useState<{ q: number; opt?: number } | null>(null);

  useEffect(() => {
    if (!quizId) return;
    setLoading(true);
    liveApi
      .getQuizDetail(quizId)
      .then((d) => {
        setDetail(d);
        setTitle(d.title);
        setDescription(d.description ?? "");
        setQuestions(
          d.questions.map((q) => ({
            type: q.type,
            text: q.text,
            options: q.options.slice(),
            correctIndex: q.correctIndex,
            correctIndices: q.correctIndices,
            correctText: q.correctText,
            rangeMin: q.rangeMin,
            rangeMax: q.rangeMax,
            correctNumber: q.correctNumber,
            explanation: q.explanation,
            imageUrl: q.imageUrl,
            optionImages: q.optionImages ?? [null, null, null, null],
            baseScore: q.baseScore,
            timeSec: q.timeSec,
          })),
        );
      })
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudo cargar el cuestionario"))
      .finally(() => setLoading(false));
  }, [quizId]);

  function updateQuestion(index: number, patch: Partial<QuizQuestionInput>) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  function updateOption(qIdx: number, oIdx: number, value: string) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx
          ? {
              ...q,
              options: q.options.map((o, j) => (j === oIdx ? value : o)),
            }
          : q,
      ),
    );
  }

  function updateOptionImage(qIdx: number, oIdx: number, url: string | null) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx
          ? {
              ...q,
              optionImages: (q.optionImages ?? []).map((o, j) => (j === oIdx ? url : o)),
            }
          : q,
      ),
    );
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, { ...DEFAULT_QUESTION }]);
  }

  function removeQuestion(index: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title,
        description: description || null,
        tenantId: tenant || null,
        questions: questions.map((q, i) => ({
          ...q,
          orderIndex: i,
          optionImages: q.optionImages ?? q.options.map(() => null),
        })),
      } as any;
      if (quizId) {
        await liveApi.updateQuiz(quizId, payload as any);
      } else {
        const res = await liveApi.createQuiz(payload);
        navigate(`/live/editor?id=${res.id}${tenant ? `&tenant=${tenant}` : ""}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Editor de cuestionarios</h1>
            <p className="text-sm text-white/60">Crea o edita preguntas con imágenes opcionales.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/live/host" className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/20">
              Volver al anfitrión
            </Link>
            <button
              onClick={handleSave}
              disabled={saving || !title.trim() || questions.length === 0}
              className="rounded-xl bg-emerald-500 px-6 py-2 font-bold shadow-[0_4px_0_0_#166534] enabled:hover:brightness-110 enabled:active:translate-y-1 enabled:active:shadow-none disabled:opacity-40"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </header>

        {error && <p className="rounded-xl bg-red-500/25 px-4 py-3 text-sm text-red-100">{error}</p>}
        {loading && <p className="text-white/60">Cargando…</p>}

        <section className="space-y-4 rounded-2xl bg-slate-900/80 p-6">
          <label className="block">
            <span className="text-sm font-medium text-white/80">Título</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl bg-white/95 px-4 py-2 text-slate-900"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-white/80">Descripción</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-xl bg-white/95 px-4 py-2 text-slate-900"
              rows={2}
            />
          </label>
        </section>

        {questions.map((q, qi) => (
          <section key={qi} className="space-y-4 rounded-2xl bg-slate-900/80 p-6">
            <header className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Pregunta {qi + 1}</h2>
              <button onClick={() => removeQuestion(qi)} className="text-sm text-rose-300 hover:text-rose-200">
                Eliminar
              </button>
            </header>

            <label className="block">
              <span className="text-sm font-medium text-white/80">Enunciado</span>
              <textarea
                value={q.text}
                onChange={(e) => updateQuestion(qi, { text: e.target.value })}
                className="mt-1 w-full rounded-xl bg-white/95 px-4 py-2 text-slate-900"
                rows={3}
              />
            </label>

            <div>
              <span className="text-sm font-medium text-white/80">Imagen principal (opcional)</span>
              <div className="mt-2">
                <MediaUploader
                  value={q.imageUrl}
                  onChange={(url) => updateQuestion(qi, { imageUrl: url ?? null })}
                  tenantId={(tenant ?? null) as any}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {q.options.map((opt, oi) => (
                <div key={oi} className="space-y-2 rounded-xl bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">Opción {oi + 1}</span>
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="radio"
                        checked={q.correctIndex === oi}
                        onChange={() => updateQuestion(qi, { correctIndex: oi, correctIndices: null })}
                      />
                      Correcta
                    </label>
                  </div>
                  <input
                    value={opt}
                    onChange={(e) => updateOption(qi, oi, e.target.value)}
                    className="w-full rounded-lg bg-white/95 px-3 py-2 text-slate-900"
                  />
                  <MediaUploader
                    value={(q.optionImages ?? [])[oi] ?? null}
                    onChange={(url) => updateOptionImage(qi, oi, url ?? null)}
                    tenantId={tenant}
                  />
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label>
                <span className="text-xs text-white/60">Tipo</span>
                <select
                  value={q.type}
                  onChange={(e) => updateQuestion(qi, { type: e.target.value as any })}
                  className="mt-1 w-full rounded-lg bg-white/95 px-3 py-2 text-slate-900"
                >
                  <option value="multiple_choice">multiple_choice</option>
                  <option value="true_false">true_false</option>
                  <option value="multi_select">multi_select</option>
                  <option value="open_text">open_text</option>
                  <option value="closest_to">closest_to</option>
                </select>
              </label>
              <label>
                <span className="text-xs text-white/60">Tiempo (s)</span>
                <input
                  type="number"
                  value={q.timeSec}
                  onChange={(e) => updateQuestion(qi, { timeSec: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg bg-white/95 px-3 py-2 text-slate-900"
                />
              </label>
              <label>
                <span className="text-xs text-white/60">Puntos base</span>
                <input
                  type="number"
                  value={q.baseScore}
                  onChange={(e) => updateQuestion(qi, { baseScore: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg bg-white/95 px-3 py-2 text-slate-900"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-white/80">Explicación</span>
              <textarea
                value={q.explanation ?? ""}
                onChange={(e) => updateQuestion(qi, { explanation: e.target.value || null })}
                className="mt-1 w-full rounded-xl bg-white/95 px-4 py-2 text-slate-900"
                rows={2}
              />
            </label>
          </section>
        ))}

        <button
          onClick={addQuestion}
          className="w-full rounded-2xl border-2 border-dashed border-white/30 py-4 text-sm font-bold hover:bg-white/5"
        >
          + Añadir pregunta
        </button>
      </div>

      <MediaPicker
        open={pickerOpen}
        tenantId={tenant}
        onClose={() => setPickerOpen(false)}
        onSelect={(asset: MediaAsset) => {
          if (!pickerIndex) return;
          if (pickerIndex.opt !== undefined) {
            updateOptionImage(pickerIndex.q, pickerIndex.opt, `/api/v1/media/${asset.id}`);
          } else {
            updateQuestion(pickerIndex.q, { imageUrl: `/api/v1/media/${asset.id}` });
          }
        }}
        onDelete={async (asset: MediaAsset) => {
          try {
            await deleteMedia(asset.id, tenant ?? undefined);
            if (detail?.tenantId) {
              await listMedia(detail.tenantId).catch(() => {});
            }
          } catch {}
        }}
      />
    </div>
  );
}
