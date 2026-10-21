import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Clipboard, Plus, Save, Sparkles, Trash2, X } from "lucide-react";
import { CompanyQuizLibrary } from "../components/CompanyQuizLibrary";
import { MediaPicker } from "../components/MediaPicker";
import { MediaUploader } from "../components/MediaUploader";
import { liveApi } from "../lib/api";
import type { QuizDetail, QuizQuestionInput } from "../lib/api";
import { listMedia, deleteMedia, type MediaAsset } from "../lib/media";
import { useAuth } from "@/modules/auth/context/AuthContext";
import {
  Alert,
  Button,
  buttonClass,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
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

const AI_PROMPT = `Ayúdame a crear un cuestionario para importarlo en TXDXSAT. Trabaja en dos fases:

FASE 1 — DATOS Y CONFIRMACIÓN. Antes de generar preguntas, asegúrate de tener estos tres datos obligatorios: (1) título o tema del cuestionario, (2) cantidad exacta de preguntas, entre 1 y 100, y (3) tiempo de respuesta por pregunta en segundos, entre 5 y 120. También puedes preguntar qué puntos específicos debe cubrir, pero eso es opcional. Si ya te proporcioné alguno de los datos, consérvalo y pregunta únicamente por los que faltan o estén fuera de rango. No supongas el tema, la cantidad ni el tiempo y no uses valores por defecto. Cuando tengas todo, resume título, cantidad y tiempo, y pídeme una confirmación explícita. Si cambio algún dato, vuelve a resumir y confirmar. No generes JSON hasta recibir esa confirmación.

FASE 2 — GENERACIÓN. Después de mi confirmación, responde ÚNICAMENTE con un objeto JSON válido: sin Markdown, comentarios ni texto adicional. Usa solo comillas rectas ASCII (") para las claves y los textos; nunca comillas tipográficas (“ ”). La raíz debe tener exactamente schemaVersion (número 1), title (el título confirmado), questionCount (la cantidad confirmada), timeSec (el tiempo confirmado) y questions (arreglo con esa cantidad exacta). Cada pregunta debe tener type, text, options, baseScore (500), timeSec (el tiempo confirmado) y una explanation breve. Usa preferentemente type "multiple_choice" con 4 opciones distintas y correctIndex entre 0 y 3. Para "true_false" usa options ["Verdadero","Falso"] y correctIndex 0 o 1. Si usas "multi_select", incluye correctIndices; "open_text" requiere correctText y options []; "closest_to" requiere rangeMin, rangeMax, correctNumber y options []. No agregues campos fuera de estos en cada pregunta: type, text, options, correctIndex, correctIndices, correctText, rangeMin, rangeMax, correctNumber, explanation, baseScore, timeSec.

Las preguntas deben ser originales, estar en español, cubrir el tema confirmado y no ser ambiguas ni duplicadas. En "multiple_choice" debe haber una sola respuesta correcta. Verifica antes de responder que title no esté vacío, que questions tenga exactamente la cantidad acordada, que todos los timeSec coincidan con el tiempo confirmado y que el JSON sea sintácticamente válido.`;

function normalizeImportedQuestion(question: QuizQuestionInput): QuizQuestionInput {
  return {
    ...question,
    options: Array.isArray(question.options) ? question.options : [],
    correctIndex: question.correctIndex ?? null,
    correctIndices: question.correctIndices ?? null,
    correctText: question.correctText ?? null,
    rangeMin: question.rangeMin ?? null,
    rangeMax: question.rangeMax ?? null,
    correctNumber: question.correctNumber ?? null,
    explanation: question.explanation ?? null,
    imageUrl: question.imageUrl ?? null,
    optionImages: question.optionImages ?? (question.options ?? []).map(() => null),
    baseScore: question.baseScore ?? 500,
    timeSec: question.timeSec ?? 20,
  };
}

function validateImportedQuestion(value: unknown): QuizQuestionInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Cada pregunta debe ser un objeto JSON");
  const q = value as Record<string, unknown>;
  const allowed = new Set(["type", "text", "options", "correctIndex", "correctIndices", "correctText", "rangeMin", "rangeMax", "correctNumber", "explanation", "baseScore", "timeSec"]);
  const extra = Object.keys(q).find((key) => !allowed.has(key));
  if (extra) throw new Error(`Campo no permitido: ${extra}`);
  const types = ["multiple_choice", "true_false", "multi_select", "open_text", "closest_to"];
  if (!types.includes(String(q.type))) throw new Error("Tipo de pregunta inválido");
  if (typeof q.text !== "string" || !q.text.trim() || q.text.length > 1000) throw new Error("text es obligatorio y admite hasta 1000 caracteres");
  const options = q.options === undefined ? [] : q.options;
  if (!Array.isArray(options) || options.length > 10 || options.some((option) => typeof option !== "string" || !option.trim() || option.length > 300)) throw new Error("options debe contener hasta 10 textos no vacíos de máximo 300 caracteres");
  if (!["open_text", "closest_to"].includes(String(q.type)) && options.length < 2) throw new Error("Preguntas de opción requieren al menos 2 opciones");
  if (["multiple_choice", "true_false"].includes(String(q.type)) && (!Number.isInteger(q.correctIndex) || Number(q.correctIndex) < 0 || Number(q.correctIndex) >= options.length)) throw new Error("correctIndex inválido");
  if (q.type === "true_false" && (options.length !== 2 || options[0] !== "Verdadero" || options[1] !== "Falso")) throw new Error("true_false requiere exactamente Verdadero y Falso");
  if (q.type === "multi_select" && (!Array.isArray(q.correctIndices) || !q.correctIndices.length || new Set(q.correctIndices).size !== q.correctIndices.length || q.correctIndices.some((index) => !Number.isInteger(index) || Number(index) < 0 || Number(index) >= options.length))) throw new Error("multi_select requiere correctIndices únicos y válidos");
  if (q.type === "open_text" && (typeof q.correctText !== "string" || !q.correctText.trim())) throw new Error("open_text requiere correctText no vacío");
  if (q.type === "closest_to" && (![q.rangeMin, q.rangeMax, q.correctNumber].every(Number.isInteger) || Number(q.rangeMin) > Number(q.correctNumber) || Number(q.correctNumber) > Number(q.rangeMax))) throw new Error("closest_to requiere un número correcto dentro del rango");
  if (q.correctIndices !== undefined && q.correctIndices !== null && (!Array.isArray(q.correctIndices) || q.correctIndices.length > 10 || q.correctIndices.some((index) => !Number.isInteger(index) || Number(index) < 0 || Number(index) > 9))) throw new Error("correctIndices debe contener índices enteros válidos");
  if (q.explanation != null && (typeof q.explanation !== "string" || q.explanation.length > 1000)) throw new Error("explanation admite hasta 1000 caracteres");
  if (q.baseScore !== undefined && (!Number.isInteger(q.baseScore) || Number(q.baseScore) < 0 || Number(q.baseScore) > 5000)) throw new Error("baseScore debe estar entre 0 y 5000");
  if (q.timeSec !== undefined && (!Number.isInteger(q.timeSec) || Number(q.timeSec) < 5 || Number(q.timeSec) > 120)) throw new Error("timeSec debe estar entre 5 y 120");
  return normalizeImportedQuestion({
    type: q.type as QuizQuestionInput["type"],
    text: q.text,
    options: options as string[],
    correctIndex: q.correctIndex as number | null | undefined,
    correctIndices: q.correctIndices as number[] | null | undefined,
    correctText: q.correctText as string | null | undefined,
    rangeMin: q.rangeMin as number | null | undefined,
    rangeMax: q.rangeMax as number | null | undefined,
    correctNumber: q.correctNumber as number | null | undefined,
    explanation: q.explanation as string | null | undefined,
    imageUrl: null,
    optionImages: (options as string[]).map(() => null),
    baseScore: Number.isInteger(q.baseScore) ? Number(q.baseScore) : 500,
    timeSec: Number.isInteger(q.timeSec) ? Number(q.timeSec) : 20,
  });
}

function validateEditor(title: string, description: string, questions: QuizQuestionInput[]) {
  if (!title.trim() || title.length > 200) throw new Error("Escribe un título de hasta 200 caracteres");
  if (description.length > 2000) throw new Error("La descripción no puede superar 2000 caracteres");
  if (questions.length < 1 || questions.length > 100) throw new Error("El cuestionario debe tener entre 1 y 100 preguntas");
  questions.forEach((question, index) => {
    const label = `Pregunta ${index + 1}`;
    if (!question.text.trim() || question.text.length > 1000) throw new Error(`${label}: escribe un enunciado de hasta 1000 caracteres`);
    if (!Number.isInteger(question.timeSec) || question.timeSec < 5 || question.timeSec > 120) throw new Error(`${label}: el tiempo debe estar entre 5 y 120 segundos`);
    if (!Number.isInteger(question.baseScore) || question.baseScore < 0 || question.baseScore > 5000) throw new Error(`${label}: los puntos deben estar entre 0 y 5000`);
    if ((question.explanation?.length ?? 0) > 1000) throw new Error(`${label}: la explicación es demasiado larga`);
    if (question.type === "open_text") {
      if (!question.correctText?.trim()) throw new Error(`${label}: indica la respuesta de texto correcta`);
    } else if (question.type === "closest_to") {
      if (![question.rangeMin, question.rangeMax, question.correctNumber].every(Number.isInteger) ||
        Number(question.rangeMin) > Number(question.correctNumber) || Number(question.correctNumber) > Number(question.rangeMax)) {
        throw new Error(`${label}: indica un número correcto dentro del rango`);
      }
    } else {
      if (question.options.length < 2 || question.options.length > 10 || question.options.some((option) => !option.trim() || option.length > 300)) {
        throw new Error(`${label}: completa entre 2 y 10 opciones de respuesta`);
      }
      if (question.type === "true_false" && (question.options.length !== 2 || question.options[0] !== "Verdadero" || question.options[1] !== "Falso")) {
        throw new Error(`${label}: Verdadero/Falso debe tener exactamente esas dos opciones`);
      }
      if (question.type === "multi_select") {
        if (!question.correctIndices?.length || question.correctIndices.some((choice) => choice < 0 || choice >= question.options.length)) {
          throw new Error(`${label}: marca al menos una opción correcta`);
        }
      } else if (question.correctIndex == null || question.correctIndex < 0 || question.correctIndex >= question.options.length) {
        throw new Error(`${label}: marca la opción correcta`);
      }
    }
  });
}

export function QuizEditorPage() {
  const { user } = useAuth();
  const location = useLocation();
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
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerIndex] = useState<{ q: number; opt?: number } | null>(null);
  const [view, setView] = useState<"editor" | "library">("editor");
  const [draftOrigin, setDraftOrigin] = useState<"manual" | "mix" | "ai">("manual");
  const [pendingMix, setPendingMix] = useState<{ questions: QuizQuestionInput[]; sourceTitles: string[] } | null>(null);
  const [jsonImport, setJsonImport] = useState("");
  const [importPreview, setImportPreview] = useState<{ title: string; questions: QuizQuestionInput[] } | null>(null);
  const [quickError, setQuickError] = useState<string | null>(null);
  const [quickSuccess, setQuickSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const aiCloseRef = useRef<HTMLButtonElement>(null);
  const isCompanyAdmin = user?.role === "ADMIN";
  const hasEditorContent = Boolean(title.trim() || description.trim() || questions.some((question) =>
    question.text.trim() || question.options.some((option) => option.trim()) || question.imageUrl || question.timeSec !== 20));

  useEffect(() => {
    if (!aiOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setAiOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    aiCloseRef.current?.focus();
    return () => { window.removeEventListener("keydown", onKeyDown); document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, [aiOpen]);

  useEffect(() => {
    if (!(location.state as { quizCreated?: boolean } | null)?.quizCreated) return;
    setSaveSuccess("El cuestionario fue creado con éxito");
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location, navigate]);

  function applyMix(questionsFromMix: QuizQuestionInput[], sourceTitles: string[]) {
    setQuestions(questionsFromMix.map(normalizeImportedQuestion));
    setTitle(`Mezcla: ${sourceTitles.join(" + ")}`.slice(0, 200));
    setDescription("");
    setDraftOrigin("mix");
    setView("editor");
    setPendingMix(null);
    setError(null);
  }

  function handlePreparedMix(questionsFromMix: QuizQuestionInput[], sourceTitles: string[]) {
    if (hasEditorContent) {
      setPendingMix({ questions: questionsFromMix, sourceTitles });
    } else {
      applyMix(questionsFromMix, sourceTitles);
    }
  }

  function validateJsonImport() {
    setQuickError(null);
    setQuickSuccess(null);
    setImportPreview(null);
    try {
      if (jsonImport.length > 250_000) throw new Error("JSON supera límite de 250 KB");
      const parsed = JSON.parse(jsonImport);
      if (parsed?.schemaVersion !== 1 || typeof parsed.title !== "string" || !parsed.title.trim() || parsed.title.length > 200 || !Number.isInteger(parsed.questionCount) || parsed.questionCount < 1 || parsed.questionCount > 100 || !Number.isInteger(parsed.timeSec) || parsed.timeSec < 5 || parsed.timeSec > 120 || !Array.isArray(parsed.questions)) {
        throw new Error("Formato inválido: incluye título, cantidad (1–100), tiempo (5–120 s) y preguntas");
      }
      const unexpectedRootKey = Object.keys(parsed).find((key) => !["schemaVersion", "title", "questionCount", "timeSec", "questions"].includes(key));
      if (unexpectedRootKey) throw new Error(`Campo raíz no permitido: ${unexpectedRootKey}`);
      if (parsed.questions.length !== parsed.questionCount) throw new Error("La cantidad de preguntas no coincide con questionCount");
      const imported = parsed.questions.map((question: unknown) => validateImportedQuestion(question));
      if (imported.some((question: QuizQuestionInput) => question.timeSec !== parsed.timeSec)) throw new Error("Todas las preguntas deben usar el tiempo confirmado");
      setImportPreview({ title: parsed.title.trim(), questions: imported });
    } catch (err) {
      setQuickError(err instanceof SyntaxError && /[“”]/.test(jsonImport)
        ? 'El texto contiene comillas tipográficas (“ ”). El JSON necesita comillas rectas ("). Corrige esas comillas y vuelve a validar.'
        : err instanceof Error ? err.message : "JSON inválido");
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(AI_PROMPT);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setQuickError("No se pudo copiar automáticamente. Selecciona el texto del prompt y cópialo manualmente.");
    }
  }

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

  function updateQuestionType(index: number, type: QuizQuestionInput["type"]) {
    setQuestions((current) => current.map((question, i) => {
      if (i !== index) return question;
      if (type === "true_false") return { ...question, type, options: ["Verdadero", "Falso"], optionImages: [null, null], correctIndex: 0, correctIndices: null };
      if (type === "open_text") return { ...question, type, options: [], optionImages: [], correctIndex: null, correctIndices: null, correctText: question.correctText ?? "" };
      if (type === "closest_to") return { ...question, type, options: [], optionImages: [], correctIndex: null, correctIndices: null, rangeMin: 0, rangeMax: 100, correctNumber: 50 };
      const options = question.options.length >= 2 ? question.options : ["", "", "", ""];
      return { ...question, type, options, optionImages: options.map(() => null), correctIndex: type === "multi_select" ? null : 0, correctIndices: type === "multi_select" ? [0] : null };
    }));
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
              optionImages: q.options.map((_, j) => j === oIdx ? url : (q.optionImages ?? [])[j] ?? null),
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
    try {
      validateEditor(title, description, questions);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Revisa los datos del cuestionario");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setSaving(true);
    setError(null);
    setSaveSuccess(null);
    try {
      const payload = {
        title,
        description: description || null,
        tenantId: tenant || null,
        ...(!quizId ? { origin: draftOrigin === "mix" ? "MIXED" : "STANDARD" } : {}),
        questions: questions.map((q, i) => ({
          ...q,
          orderIndex: i,
          optionImages: q.optionImages ?? q.options.map(() => null),
        })),
      } as any;
      if (quizId) {
        await liveApi.updateQuiz(quizId, payload as any);
        setSaveSuccess("Los cambios se guardaron con éxito");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        const res = await liveApi.createQuiz(payload);
        navigate(`/live/editor?id=${res.id}${tenant ? `&tenant=${tenant}` : ""}`, { state: { quizCreated: true } });
      }
    } catch (err) {
      setError(`No se pudo ${quizId ? "guardar los cambios" : "crear el cuestionario"}. ${err instanceof Error ? err.message : "Inténtalo de nuevo."}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">{isCompanyAdmin && !quizId && view === "library" ? "Biblioteca de cuestionarios" : "Editor de cuestionarios"}</h1>
          <p className="text-sm text-ink-muted">{isCompanyAdmin && !quizId && view === "library" ? "Consulta originales y prepara una combinación nueva." : "Un solo editor para crear o actualizar el cuestionario completo."}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/live/host" className={buttonClass({ variant: "outline" })}>
            <ArrowLeft className="h-4 w-4" />
            Volver al anfitrión
          </Link>
          {(!isCompanyAdmin || !!quizId || view === "editor") && <Button
            variant="accent"
            onClick={handleSave}
            loading={saving}
            disabled={saving || !title.trim() || questions.length === 0}
            leftIcon={<Save className="h-4 w-4" />}
          >
            {quizId ? "Guardar cambios" : "Crear cuestionario"}
          </Button>}
        </div>
      </header>

      {error && <Alert tone="danger">{error}</Alert>}
      {saveSuccess && <Alert tone="success" className="border-success/50 bg-success/15 p-4 shadow-sm"><div>
        <strong className="block text-base">{saveSuccess}</strong>
        <span className="mt-1 block text-sm">{saveSuccess.startsWith("El cuestionario fue creado") ? "Ya puedes usarlo desde la biblioteca o crear una sesión en vivo." : "El cuestionario ya está actualizado."}</span>
      </div></Alert>}
      {loading && <p className="text-sm text-ink-muted">Cargando…</p>}

      {isCompanyAdmin && !quizId && <div className="flex flex-wrap gap-2 border-b border-border pb-3" role="tablist" aria-label="Vista de cuestionarios">
        <button type="button" role="tab" aria-selected={view === "editor"} onClick={() => setView("editor")}
          className={`rounded-xl px-4 py-2 text-sm font-bold transition ${view === "editor" ? "bg-accent text-[#04211f]" : "border border-border text-ink-muted hover:text-ink"}`}>Editor</button>
        <button type="button" role="tab" aria-selected={view === "library"} onClick={() => setView("library")}
          className={`rounded-xl px-4 py-2 text-sm font-bold transition ${view === "library" ? "bg-accent text-[#04211f]" : "border border-border text-ink-muted hover:text-ink"}`}>Biblioteca y mezclas</button>
      </div>}

      {isCompanyAdmin && !quizId && <div className={view === "library" ? "" : "hidden"}>
        <CompanyQuizLibrary onCreateNew={() => setView("editor")} hasDraft={hasEditorContent} onPrepared={handlePreparedMix} />
      </div>}

      {(!isCompanyAdmin || !!quizId || view === "editor") && <>
        {isCompanyAdmin && !quizId && <div className="rounded-xl border border-accent/40 bg-accent/5 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-accent">
            {draftOrigin === "mix" ? "Nuevo cuestionario a partir de una mezcla" : draftOrigin === "ai" ? "Nuevo cuestionario con preguntas importadas" : "Nuevo cuestionario"}
          </p>
          <p className="mt-1 text-sm text-ink-muted">{questions.length} preguntas en el editor · Aún no guardado. El título y las respuestas se editan aquí; «Crear cuestionario» es la única acción que guarda.</p>
        </div>}

      <Card id="quiz-details">
        <CardHeader>
          <CardTitle>Datos del cuestionario</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Título" htmlFor="quiz-title" required>
            <Input id="quiz-title" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Descripción" htmlFor="quiz-description">
            <Textarea id="quiz-description" maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </Field>
        </CardContent>
      </Card>

      {isCompanyAdmin && !quizId && <div className="flex items-center justify-between gap-3">
        <div><h2 className="text-lg font-bold text-ink">Preguntas y respuestas</h2><p className="text-sm text-ink-muted">Escribe el enunciado, las opciones, marca la correcta y ajusta el tiempo.</p></div>
        <Button variant="outline" onClick={() => setShowAdvanced((value) => !value)}>{showAdvanced ? "Ocultar opciones avanzadas" : "Opciones avanzadas"}</Button>
      </div>}

      {questions.map((q, qi) => (
        <Card key={qi} id={`quiz-question-${qi}`}>
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
                maxLength={1000}
                value={q.text}
                onChange={(e) => updateQuestion(qi, { text: e.target.value })}
                rows={3}
              />
            </Field>

            {(!isCompanyAdmin || !!quizId || showAdvanced) && <div>
              <span className="text-sm font-medium text-ink">Imagen principal (opcional)</span>
              <div className="mt-2">
                <MediaUploader
                  value={q.imageUrl}
                  onChange={(url) => updateQuestion(qi, { imageUrl: url ?? null })}
                  tenantId={(tenant ?? null) as any}
                />
              </div>
            </div>}

            {q.type !== "open_text" && q.type !== "closest_to" && <div className="grid gap-4 sm:grid-cols-2">
              {q.options.map((opt, oi) => (
                <div key={oi} className="game-inset space-y-2 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-ink">Opción {oi + 1}</span>
                    <label className="flex items-center gap-1 text-xs text-ink-muted">
                      <input
                        type={q.type === "multi_select" ? "checkbox" : "radio"}
                        name={`correct-${qi}`}
                        checked={q.type === "multi_select" ? (q.correctIndices ?? []).includes(oi) : q.correctIndex === oi}
                        onChange={() => q.type === "multi_select"
                          ? updateQuestion(qi, { correctIndices: (q.correctIndices ?? []).includes(oi) ? (q.correctIndices ?? []).filter((value) => value !== oi) : [...(q.correctIndices ?? []), oi] })
                          : updateQuestion(qi, { correctIndex: oi, correctIndices: null })}
                        className="accent-accent"
                      />
                      Correcta
                    </label>
                  </div>
                  <Input value={opt} maxLength={300} disabled={q.type === "true_false"} onChange={(e) => updateOption(qi, oi, e.target.value)} />
                  {(!isCompanyAdmin || !!quizId || showAdvanced) && <MediaUploader
                    value={(q.optionImages ?? [])[oi] ?? null}
                    onChange={(url) => updateOptionImage(qi, oi, url ?? null)}
                    tenantId={tenant}
                  />}
                </div>
              ))}
            </div>}

            {q.type === "open_text" && <Field label="Respuesta correcta de texto">
              <Input value={q.correctText ?? ""} maxLength={500} onChange={(event) => updateQuestion(qi, { correctText: event.target.value })} />
            </Field>}
            {q.type === "closest_to" && <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Valor mínimo"><Input type="number" value={q.rangeMin ?? ""} onChange={(event) => updateQuestion(qi, { rangeMin: Number(event.target.value) })} /></Field>
              <Field label="Respuesta correcta"><Input type="number" value={q.correctNumber ?? ""} onChange={(event) => updateQuestion(qi, { correctNumber: Number(event.target.value) })} /></Field>
              <Field label="Valor máximo"><Input type="number" value={q.rangeMax ?? ""} onChange={(event) => updateQuestion(qi, { rangeMax: Number(event.target.value) })} /></Field>
            </div>}

            <div className="grid gap-3 sm:grid-cols-3">
              {(!isCompanyAdmin || !!quizId || showAdvanced) && <Field label="Tipo">
                <Select value={q.type} onChange={(e) => updateQuestionType(qi, e.target.value as QuizQuestionInput["type"])}>
                  <option value="multiple_choice">Opción única</option>
                  <option value="true_false">Verdadero o falso</option>
                  <option value="multi_select">Varias respuestas</option>
                  <option value="open_text">Texto libre</option>
                  <option value="closest_to">Número aproximado</option>
                </Select>
              </Field>}
              <Field label="Tiempo (s)">
                <Input
                  type="number"
                  min={5}
                  max={120}
                  value={q.timeSec}
                  onChange={(e) => updateQuestion(qi, { timeSec: Number(e.target.value) })}
                />
              </Field>
              {(!isCompanyAdmin || !!quizId || showAdvanced) && <Field label="Puntos base">
                <Input
                  type="number"
                  min={0}
                  max={5000}
                  value={q.baseScore}
                  onChange={(e) => updateQuestion(qi, { baseScore: Number(e.target.value) })}
                />
              </Field>}
            </div>

            <Field label="Explicación" htmlFor={`q-${qi}-explanation`}>
              <Textarea
                id={`q-${qi}-explanation`}
                maxLength={1000}
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

      {isCompanyAdmin && !quizId && <button type="button" onClick={() => setAiOpen(true)}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full border border-accent/60 bg-accent px-5 py-3 text-sm font-bold text-[#04211f] shadow-xl transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        aria-label="Abrir ayuda IA para importar preguntas">
        <Sparkles className="h-5 w-5" /> Ayuda IA
      </button>}
      </>}

      {aiOpen && isCompanyAdmin && !quizId && createPortal(<div className="fixed inset-0 z-50 flex justify-end" role="presentation">
        <button type="button" className="absolute inset-0 bg-black/65" onClick={() => setAiOpen(false)} aria-label="Cerrar ayuda IA" />
        <aside role="dialog" aria-modal="true" aria-labelledby="ai-help-title" className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-border bg-surface shadow-2xl">
          <header className="flex items-start justify-between gap-3 border-b border-border p-5">
            <div><h2 id="ai-help-title" className="flex items-center gap-2 text-lg font-bold text-ink"><Sparkles className="h-5 w-5 text-accent" /> Ayuda IA para preguntas</h2>
              <p className="mt-1 text-sm text-ink-muted">Genera preguntas con una IA externa e impórtalas al editor.</p></div>
            <button ref={aiCloseRef} type="button" onClick={() => setAiOpen(false)} className="rounded-lg p-2 text-ink-muted hover:bg-accent/10 hover:text-ink" aria-label="Cerrar"><X className="h-5 w-5" /></button>
          </header>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <p className="text-sm text-ink-muted">Esta ayuda forma parte del editor. Copia el prompt, confirma el tema, la cantidad y el tiempo con tu IA, y pega aquí el JSON. No se guarda ni sustituye el cuestionario hasta que lo confirmes.</p>
          {quickError && <Alert tone="danger">{quickError}</Alert>}
          {quickSuccess && <Alert tone="success">{quickSuccess}</Alert>}
          <Field label="Prompt para tu IA"><Textarea readOnly value={AI_PROMPT} rows={8} /></Field>
          <Button variant="outline" onClick={copyPrompt} leftIcon={<Clipboard className="h-4 w-4" />}>{copied ? "Prompt copiado" : "Copiar prompt"}</Button>
          <Field label="Respuesta JSON de la IA">
            <Textarea value={jsonImport} onChange={(event) => { setJsonImport(event.target.value); setImportPreview(null); }} rows={7} placeholder='{"schemaVersion":1,"title":"Mi tema","questionCount":10,"timeSec":20,"questions":[...]}' />
          </Field>
          <Button variant="outline" onClick={validateJsonImport} disabled={!jsonImport.trim()}>Validar preguntas importadas</Button>
          {importPreview && <div className="space-y-3 rounded-xl border border-accent/40 bg-accent/5 p-4">
            <p className="text-sm font-semibold text-ink">{importPreview.title} · {importPreview.questions.length} preguntas válidas</p>
            <ol className="max-h-48 list-inside list-decimal space-y-1 overflow-y-auto text-sm text-ink-muted">
              {importPreview.questions.map((question, index) => <li key={index}>{question.text} · {question.timeSec} s</li>)}
            </ol>
            <p className="text-xs text-ink-muted">Al aplicar, el título y todas las preguntas que ves arriba serán reemplazados. Esto no guarda el cuestionario.</p>
            <Button variant="accent" onClick={() => {
              setQuestions(importPreview.questions);
              setTitle(importPreview.title);
              setDraftOrigin("ai");
              setImportPreview(null);
              setQuickSuccess("Preguntas aplicadas al editor. Revísalas y luego crea el cuestionario.");
              setAiOpen(false);
              window.setTimeout(() => document.getElementById("quiz-details")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
            }}>Aplicar al editor</Button>
          </div>}
          </div>
        </aside>
      </div>, document.body)}

      <Dialog open={pendingMix !== null} onClose={() => setPendingMix(null)} title="¿Reemplazar el cuestionario sin guardar?"
        description="La mezcla nueva sustituirá el título y las preguntas que tienes en el editor. Los cuestionarios originales de la biblioteca no cambiarán."
        footer={<><Button variant="ghost" onClick={() => setPendingMix(null)}>Cancelar</Button><Button variant="accent" onClick={() => { if (pendingMix) applyMix(pendingMix.questions, pendingMix.sourceTitles); }}>Reemplazar en el editor</Button></>}>
        <p className="text-sm text-ink-muted">Esta acción solo prepara la nueva combinación; no la guarda.</p>
      </Dialog>

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
