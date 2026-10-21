import { useCallback, useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Eye, Plus, RefreshCw, Shuffle } from "lucide-react";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Field, Input, Select } from "@/components/ui";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { liveApi, type QuizQuestionInput, type QuizSummary } from "../lib/api";
import { clampMixQuestionCount, maxMixQuestionCount } from "../lib/mix-limit";
import { QuizDetailDrawer } from "./QuizDetailDrawer";

interface CompanyQuizLibraryProps {
  onCreateNew: () => void;
  hasDraft: boolean;
  onPrepared: (questions: QuizQuestionInput[], sourceTitles: string[]) => void;
}

export function CompanyQuizLibrary({ onCreateNew, hasDraft, onPrepared }: CompanyQuizLibraryProps) {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [count, setCount] = useState(8);
  const [timeMode, setTimeMode] = useState<"preserve" | "fixed">("preserve");
  const [fixedTimeSec, setFixedTimeSec] = useState(20);
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<"STANDARD" | "MIXED">("STANDARD");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [mixerOpen, setMixerOpen] = useState(false);
  const pageSize = 6;

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await liveApi.listCompanyQuizzes();
      setQuizzes(result.quizzes);
      setLastUpdated(new Date());
      setSelectedIds((current) => current.filter((id) => result.quizzes.some((quiz) => quiz.id === id)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar los cuestionarios de tu empresa");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const selected = quizzes.filter((quiz) => selectedIds.includes(quiz.id));
  const standardQuizzes = quizzes.filter((quiz) => quiz.origin !== "MIXED");
  const mixedQuizzes = quizzes.filter((quiz) => quiz.origin === "MIXED");
  const currentGroup = activeTab === "STANDARD" ? standardQuizzes : mixedQuizzes;
  const filtered = currentGroup.filter((quiz) => `${quiz.title} ${quiz.description ?? ""} ${quiz.creatorName ?? ""}`.toLocaleLowerCase("es").includes(query.trim().toLocaleLowerCase("es")));
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleQuizzes = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const available = selected.reduce((total, quiz) => total + quiz.questionCount, 0);
  const maxCount = maxMixQuestionCount(available);
  const boundedCount = selected.length >= 2 && maxCount >= selected.length
    ? clampMixQuestionCount(count, selected.length, available) : count;
  const canPrepare = selected.length >= 2 && selected.length <= 10 && available >= selected.length &&
    Number.isInteger(boundedCount) && (timeMode === "preserve" || (Number.isInteger(fixedTimeSec) && fixedTimeSec >= 5 && fixedTimeSec <= 120));

  function quizCards(items: QuizSummary[]) {
    return <div className="grid gap-3 sm:grid-cols-2">{items.map((quiz) => {
      const checked = selectedIds.includes(quiz.id);
      const own = quiz.createdById === user?.id;
      return <article key={quiz.id} className={`rounded-xl border p-3 transition-colors ${checked ? "border-accent bg-accent/10" : quiz.origin === "MIXED" ? "border-sky-500/30 bg-sky-500/5" : "border-border bg-surface"}`}>
        <div className="flex items-start gap-3">
          <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
            <input type="checkbox" checked={checked} disabled={!checked && selectedIds.length >= 10}
              onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, quiz.id] : current.filter((id) => id !== quiz.id))}
              className="mt-1 accent-accent" />
            <span className="min-w-0"><strong className="line-clamp-2 block text-sm text-ink">{quiz.title}</strong><span className="mt-1 block text-xs text-ink-muted">{quiz.questionCount} preguntas · {quiz.origin === "MIXED" ? "Mezcla" : "Original"}</span></span>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className={`max-w-[70%] truncate rounded-full px-2.5 py-1 text-xs font-medium ${own ? "bg-accent/15 text-accent" : "bg-surface-raised text-ink-muted"}`} title={quiz.creatorName ?? "Autor no registrado"}>
            {own ? "Creado por ti" : quiz.creatorName ? `Por ${quiz.creatorName}` : "Autor no registrado"}
          </span>
          <button type="button" onClick={() => setDetailId(quiz.id)} aria-label={`Ver detalle de ${quiz.title}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent/50 bg-accent/10 px-2.5 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/20">
            <Eye className="h-4 w-4" /> Detalle
          </button>
        </div>
      </article>;
    })}</div>;
  }

  useEffect(() => {
    if (selected.length < 2) return;
    if (available >= selected.length) setCount((current) => clampMixQuestionCount(current, selected.length, available));
  }, [selected.length, available]);

  useEffect(() => { setPage(1); }, [activeTab, query]);

  async function prepare() {
    if (!canPrepare) return;
    setPreparing(true);
    setError(null);
    try {
      const result = await liveApi.mixCompanyQuizzes({
        quizIds: selectedIds,
        questionCount: boundedCount,
        timeSec: timeMode === "fixed" ? fixedTimeSec : null,
      });
      onPrepared(result.questions, result.sourceTitles);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo preparar la mezcla");
    } finally {
      setPreparing(false);
    }
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="text-xl font-extrabold text-ink">Cuestionarios de mi empresa</h2>
        <p className="mt-1 text-sm text-ink-muted">Encuentra cuestionarios y combina sus preguntas sin modificar las fuentes.</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => void reload()} loading={loading} leftIcon={<RefreshCw className="h-4 w-4" />}>Actualizar</Button>
        <Button variant="accent" onClick={onCreateNew} leftIcon={<Plus className="h-4 w-4" />}>{hasDraft ? "Volver al editor" : "Crear uno nuevo"}</Button>
      </div>
    </div>
    {error && <Alert tone="danger">{error}</Alert>}
    {lastUpdated && <p className="text-xs text-ink-muted" role="status" aria-live="polite">Lista actualizada a las {lastUpdated.toLocaleTimeString("es-PE")} · {quizzes.length} cuestionarios</p>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Tipo de cuestionario">
        <button type="button" role="tab" aria-selected={activeTab === "STANDARD"} onClick={() => setActiveTab("STANDARD")}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${activeTab === "STANDARD" ? "bg-accent text-[#04211f]" : "border border-border text-ink-muted hover:text-ink"}`}>Originales ({standardQuizzes.length})</button>
        <button type="button" role="tab" aria-selected={activeTab === "MIXED"} onClick={() => setActiveTab("MIXED")}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${activeTab === "MIXED" ? "bg-accent text-[#04211f]" : "border border-border text-ink-muted hover:text-ink"}`}>Mezclas ({mixedQuizzes.length})</button>
      </div>
      <Button variant={mixerOpen ? "accent" : "outline"} onClick={() => setMixerOpen((open) => !open)} leftIcon={<Shuffle className="h-4 w-4" />}>
        {mixerOpen ? "Ocultar mezcla" : `Preparar mezcla${selected.length ? ` (${selected.length})` : ""}`}
      </Button>
    </div>

    {mixerOpen && <Card>
      <CardHeader><CardTitle>Preparar una mezcla nueva</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-ink-muted">Elige entre 2 y 10 cuestionarios de la biblioteca. Se tomará al menos una pregunta de cada uno; el resto se elegirá al azar. El resultado llegará al editor como un cuestionario nuevo, sin alterar las fuentes.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Preguntas de la mezcla">
            <Input type="number" min={Math.max(2, selected.length)} max={Math.max(2, maxCount)} value={boundedCount}
              disabled={selected.length < 2}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) setCount(clampMixQuestionCount(value, selected.length, available));
              }} />
          </Field>
          <Field label="Tiempo de respuesta">
            <Select value={timeMode} onChange={(event) => setTimeMode(event.target.value as "preserve" | "fixed")}>
              <option value="preserve">Conservar tiempo de cada pregunta</option>
              <option value="fixed">Usar un tiempo nuevo para toda la mezcla</option>
            </Select>
          </Field>
        </div>
        {timeMode === "fixed" && <Field label="Segundos por pregunta en el cuestionario nuevo">
          <Input type="number" min={5} max={120} value={fixedTimeSec} onChange={(event) => setFixedTimeSec(Number(event.target.value))} />
        </Field>}
        <div className="rounded-xl border border-border bg-surface p-3 text-sm text-ink-muted">
          <strong className="text-ink">{selected.length} fuentes seleccionadas</strong> · {available} preguntas disponibles · máximo permitido: {maxCount}.
          {selected.length < 2 && <span className="block pt-1">Selecciona al menos dos para habilitar la mezcla.</span>}
        </div>
        <Button variant="accent" onClick={() => void prepare()} loading={preparing} disabled={!canPrepare || preparing}
          leftIcon={<Shuffle className="h-4 w-4" />}>
          Preparar {boundedCount} preguntas en el editor <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
        <p className="text-xs text-ink-muted">Preparar no guarda. Revisa o cambia el título y las preguntas en el editor antes de crear el cuestionario.</p>
      </CardContent>
    </Card>}

    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h3 className="text-lg font-bold text-ink">{activeTab === "STANDARD" ? "Cuestionarios originales" : "Mezclas guardadas"}</h3>
          <p className="text-sm text-ink-muted">{activeTab === "STANDARD" ? "Creados desde cero o importados." : "Creados al combinar preguntas de varias fuentes."}</p></div>
        <div className="w-full sm:w-64"><Field label="Buscar por título o autor"><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cuestionario..." /></Field></div>
      </div>
      {quizzes.length === 0 && !loading ? <Card><CardContent className="p-6 text-sm text-ink-muted">Todavía no hay cuestionarios de tu organización. Crea el primero en el editor.</CardContent></Card> :
        filtered.length ? quizCards(visibleQuizzes) : <p className="rounded-xl border border-border p-4 text-sm text-ink-muted">{query.trim() ? "No hay cuestionarios que coincidan con esta búsqueda." : activeTab === "MIXED" ? "Aún no hay mezclas guardadas." : "Aún no hay cuestionarios originales."}</p>}
      {filtered.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-sm text-ink-muted">
        <span>Mostrando {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} de {filtered.length}</span>
        {pageCount > 1 && <div className="flex items-center gap-2">
          <Button variant="outline" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} leftIcon={<ChevronLeft className="h-4 w-4" />}>Anterior</Button>
          <span>Página {currentPage} de {pageCount}</span>
          <Button variant="outline" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Siguiente <ChevronRight className="ml-1 h-4 w-4" /></Button>
        </div>}
      </div>}
      {selected.length > 0 && <p className="text-xs text-ink-muted">{selected.length} fuente{selected.length === 1 ? "" : "s"} seleccionada{selected.length === 1 ? "" : "s"} para la mezcla, incluso entre pestañas y páginas.</p>}
    </div>
    <QuizDetailDrawer quizId={detailId} onClose={() => setDetailId(null)} />
  </div>;
}
