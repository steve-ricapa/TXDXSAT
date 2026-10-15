import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { MediaPicker } from "../components/MediaPicker";
import { MediaUploader } from "../components/MediaUploader";
import { liveApi } from "../lib/api";
import type { QuizDetail, QuizQuestionInput } from "../lib/api";
import { listMedia, deleteMedia, type MediaAsset } from "../lib/media";
import {
  Alert,
  Button,
  buttonClass,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";

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
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Editor de cuestionarios</h1>
          <p className="text-sm text-ink-muted">Crea o edita preguntas con imágenes opcionales.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/live/host" className={buttonClass({ variant: "outline" })}>
            <ArrowLeft className="h-4 w-4" />
            Volver al anfitrión
          </Link>
          <Button
            variant="accent"
            onClick={handleSave}
            loading={saving}
            disabled={saving || !title.trim() || questions.length === 0}
            leftIcon={<Save className="h-4 w-4" />}
          >
            Guardar
          </Button>
        </div>
      </header>

      {error && <Alert tone="danger">{error}</Alert>}
      {loading && <p className="text-sm text-ink-muted">Cargando…</p>}

      <Card>
        <CardHeader>
          <CardTitle>Datos del cuestionario</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Título" htmlFor="quiz-title" required>
            <Input id="quiz-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Descripción" htmlFor="quiz-description">
            <Textarea id="quiz-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </Field>
        </CardContent>
      </Card>

      {questions.map((q, qi) => (
        <Card key={qi}>
          <CardHeader className="items-center">
            <CardTitle>Pregunta {qi + 1}</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeQuestion(qi)}
              className="text-danger-readable hover:bg-danger/10 hover:text-danger-readable"
              leftIcon={<Trash2 className="h-4 w-4" />}
            >
              Eliminar
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Enunciado" htmlFor={`q-${qi}-text`}>
              <Textarea
                id={`q-${qi}-text`}
                value={q.text}
                onChange={(e) => updateQuestion(qi, { text: e.target.value })}
                rows={3}
              />
            </Field>

            <div>
              <span className="text-sm font-medium text-ink">Imagen principal (opcional)</span>
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
                <div key={oi} className="game-inset space-y-2 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-ink">Opción {oi + 1}</span>
                    <label className="flex items-center gap-1 text-xs text-ink-muted">
                      <input
                        type="radio"
                        checked={q.correctIndex === oi}
                        onChange={() => updateQuestion(qi, { correctIndex: oi, correctIndices: null })}
                        className="accent-accent"
                      />
                      Correcta
                    </label>
                  </div>
                  <Input value={opt} onChange={(e) => updateOption(qi, oi, e.target.value)} />
                  <MediaUploader
                    value={(q.optionImages ?? [])[oi] ?? null}
                    onChange={(url) => updateOptionImage(qi, oi, url ?? null)}
                    tenantId={tenant}
                  />
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Tipo">
                <Select value={q.type} onChange={(e) => updateQuestion(qi, { type: e.target.value as any })}>
                  <option value="multiple_choice">multiple_choice</option>
                  <option value="true_false">true_false</option>
                  <option value="multi_select">multi_select</option>
                  <option value="open_text">open_text</option>
                  <option value="closest_to">closest_to</option>
                </Select>
              </Field>
              <Field label="Tiempo (s)">
                <Input
                  type="number"
                  value={q.timeSec}
                  onChange={(e) => updateQuestion(qi, { timeSec: Number(e.target.value) })}
                />
              </Field>
              <Field label="Puntos base">
                <Input
                  type="number"
                  value={q.baseScore}
                  onChange={(e) => updateQuestion(qi, { baseScore: Number(e.target.value) })}
                />
              </Field>
            </div>

            <Field label="Explicación" htmlFor={`q-${qi}-explanation`}>
              <Textarea
                id={`q-${qi}-explanation`}
                value={q.explanation ?? ""}
                onChange={(e) => updateQuestion(qi, { explanation: e.target.value || null })}
                rows={2}
              />
            </Field>
          </CardContent>
        </Card>
      ))}

      <button
        onClick={addQuestion}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-4 text-sm font-bold text-ink-muted transition-colors hover:border-accent hover:bg-accent/5 hover:text-ink"
      >
        <Plus className="h-4 w-4" />
        Añadir pregunta
      </button>

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
