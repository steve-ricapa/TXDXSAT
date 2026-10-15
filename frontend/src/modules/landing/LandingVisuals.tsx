import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowRight, BookOpen, Check, ClipboardCheck, FlaskConical, GraduationCap, MailWarning, Radio, Route, ScanSearch, ShieldCheck } from "lucide-react";
import { cycles, departments, topics } from "./demoMetrics";
import { useLandingMotion } from "./useLandingMotion";

const label = <span className="landing-demo-label">Visualización ilustrativa · datos simulados</span>;

export function SecurityChainAnimation() {
  const { ref, active, reduced } = useLandingMotion<HTMLDivElement>();
  return (
    <div ref={ref} className="landing-visual landing-chain" data-active={active}>
      <div className="flex items-center justify-between gap-3 border-b border-border pb-4 text-xs uppercase tracking-widest text-ink-muted">
        <span>01 / El factor humano</span>{label}
      </div>
      <div className="landing-chain-stage">
        <svg viewBox="0 0 800 300" className="w-full" role="img" aria-label="Cinco personas conectadas: una decisión ante un correo sospechoso afecta la red; la capacitación ayuda a restaurarla">
          <path className="landing-chain-link" d="M90 160H230H370H510H650" />
          <path className="landing-chain-signal" d="M90 160H650" />
          <path className="landing-chain-break" d="M345 160H395" stroke="#080f1e" strokeWidth="8" />
          <path className="landing-chain-alert" d="M370 160H650" />
          {[90, 230, 370, 510, 650].map((x, i) => (
            <g key={x} className={`landing-chain-node landing-chain-node-${i}`}>
              <circle cx={x} cy="160" r="32" fill="#101c30" stroke="currentColor" strokeWidth="2" />
              <circle cx={x} cy="148" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d={`M${x - 13} 176q0-14 13-14t13 14`} fill="none" stroke="currentColor" strokeWidth="2" />
            </g>
          ))}
          <g className="landing-chain-mail" transform="translate(338 32)">
            <rect x="0" y="0" width="64" height="45" rx="2" fill="#101c30" stroke="#ef6666" strokeWidth="2" />
            <path d="m4 5 28 21L60 5" fill="none" stroke="#ef6666" strokeWidth="2" />
            <text x="75" y="28" fill="#f3f7fc" fontSize="17">Enlace sospechoso</text>
          </g>
          <g className="landing-chain-training" transform="translate(274 213)">
            <rect width="250" height="42" fill="#101c30" stroke="#00c7be" />
            <text x="15" y="27" fill="#f3f7fc" fontSize="15">Identificar · evaluar · aprender ✓</text>
          </g>
          <g className="landing-chain-shield" transform="translate(348 30)">
            <path d="M52 0 96 18v40c0 26-16 45-44 57C24 103 8 84 8 58V18Z" fill="#101c30" stroke="#00c7be" strokeWidth="3" />
            <path d="m32 56 15 15 27-30" fill="none" stroke="#00c7be" strokeWidth="4" />
          </g>
          <text x="400" y="246" fill="#94a3b8" textAnchor="middle" fontSize="15">Equipo conectado · señales de seguridad compartidas</text>
        </svg>
      </div>
      <div className="landing-chain-caption border-t border-border pt-4 text-sm text-ink-muted">
        <span>Una decisión puede afectar a todos.</span><span>Practicar ayuda a reconocer la señal.</span><span>El conocimiento fortalece cada eslabón.</span>
      </div>
      {reduced && <p className="mt-3 text-sm text-ink-muted">Un correo sospechoso puede afectar al equipo; practicar su identificación refuerza la seguridad colectiva.</p>}
    </div>
  );
}

const phases = [
  { title: "Capacitación", icon: BookOpen, detail: "Conocer la señal" },
  { title: "Evaluación", icon: ClipboardCheck, detail: "Comprobar lo aprendido" },
  { title: "Laboratorio", icon: ScanSearch, detail: "Practicar decisiones" },
  { title: "Reforzamiento", icon: ShieldCheck, detail: "Volver a aprender" },
];

export function LearningCycleFlow() {
  const { ref, active } = useLandingMotion<HTMLDivElement>();
  return (
    <div ref={ref} className="landing-visual" data-active={active}>
      <div className="flex justify-between gap-3 border-b border-border pb-4 text-xs uppercase tracking-widest text-ink-muted"><span>02 / Ciclo conceptual</span>{label}</div>
      <div className="landing-cycle mt-9 grid grid-cols-2 gap-y-8 md:grid-cols-4">
        {phases.map((phase, index) => (
          <div key={phase.title} className="landing-cycle-step relative min-w-0 pr-3" style={{ "--step": index } as CSSProperties}>
            <div className="landing-cycle-icon mb-5 flex h-14 w-14 items-center justify-center border border-border text-accent"><phase.icon size={26} aria-hidden /></div>
            <span className="text-xs text-accent">0{index + 1} / 04</span>
            <h3 className="mt-2 text-lg font-semibold">{phase.title}</h3>
            <p className="mt-1 text-sm text-ink-muted">{phase.detail}</p>
            {index < 3 && <span className="landing-cycle-connector" aria-hidden><ArrowRight size={18} /></span>}
          </div>
        ))}
      </div>
      <p className="mt-9 border-t border-border pt-4 text-sm text-ink-muted">Un recorrido de aprendizaje ilustrativo. Los laboratorios son una modalidad prevista, no una función disponible hoy.</p>
    </div>
  );
}

const modes = [
  { title: "Sesiones en vivo", status: "Disponible", icon: Radio, steps: ["Instructor", "Preguntas", "Participantes", "Ranking"], note: "Cuenta y PIN para responder; resultados asociados al participante." },
  { title: "Trainings asincrónicos", status: "Concepto · previsto", icon: Route, steps: ["Curso", "Lección", "Evaluación", "Certificado"], note: "Recorrido ilustrativo; aún no es una función productiva." },
  { title: "Laboratorios", status: "Concepto · previsto", icon: FlaskConical, steps: ["Escenario", "Decisión", "Retroalimentación", "Aprendizaje"], note: "Práctica ilustrativa; aún no es una función productiva." },
];

export function TrainingExperiences() {
  const { ref, active } = useLandingMotion<HTMLDivElement>();
  return (
    <div ref={ref} className="landing-visual landing-modes grid gap-0 lg:grid-cols-3" data-active={active}>
      {modes.map((mode, i) => <div key={mode.title} className="border-t border-border py-7 lg:border-r lg:px-7 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0">
        <div className="landing-mode-icon flex items-center justify-between gap-3 text-accent"><mode.icon size={24} aria-hidden /><span className="text-xs text-ink-muted">0{i + 1} / 03</span></div>
        <h3 className="mt-7 text-xl font-semibold">{mode.title}</h3>
        <p className="mt-2 text-xs uppercase tracking-widest text-accent">{mode.status}</p>
        <div className="landing-mode-track mt-7 flex flex-wrap gap-2 border-y border-border py-5">
          {mode.steps.map((step, j) => <span key={step} className="landing-mode-step text-xs text-ink-muted" style={{ "--step": j } as CSSProperties}>{step}{j < 3 && <span className="mx-2 text-accent" aria-hidden>→</span>}</span>)}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-ink-muted">{mode.note}</p>
      </div>)}
    </div>
  );
}

export function PhishingSimulation() {
  const { ref, active } = useLandingMotion<HTMLDivElement>();
  const [selection, setSelection] = useState<"sender" | "link" | "subject" | null>(null);

  useEffect(() => {
    if (!selection || !active) return;
    const timer = window.setTimeout(() => setSelection(null), 9000);
    return () => window.clearTimeout(timer);
  }, [selection, active]);

  return (
    <div ref={ref} className="landing-visual w-full max-w-2xl overflow-hidden rounded-xl border border-border shadow-2xl" data-active={active}>
      {/* Gmail Header / Window bar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-[#f6f8fc] px-4 py-2.5 text-xs text-gray-700">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#ff5f56]" />
            <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
            <span className="h-3 w-3 rounded-full bg-[#27c93f]" />
          </div>
          <div className="flex items-center gap-2 pl-2 border-l border-gray-300">
            <span className="font-semibold text-gray-800">Gmail</span>
            <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">Simulación</span>
          </div>
        </div>
        <span className="text-[11px] text-gray-500">Recibidos (1)</span>
      </div>

      {/* Gmail Action Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2 text-gray-600">
        <div className="flex items-center gap-4 text-xs">
          <span className="cursor-default hover:text-gray-900" title="Atrás">←</span>
          <span className="cursor-default hover:text-gray-900" title="Archivar">📥</span>
          <span className="cursor-default hover:text-gray-900" title="Marcar como spam">⚠️</span>
          <span className="cursor-default hover:text-gray-900" title="Eliminar">🗑️</span>
          <span className="cursor-default hover:text-gray-900" title="Marcar como no leído">✉️</span>
        </div>
        <div className="text-[11px] text-gray-400">Hoy, 10:42 AM</div>
      </div>

      {/* Gmail Email Container (White Background) */}
      <div className="bg-white p-5 text-gray-900 sm:p-7">
        {/* Subject Line */}
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => setSelection("subject")}
              className={`text-left text-lg font-normal sm:text-xl transition-all ${
                selection === "subject"
                  ? "bg-amber-100 ring-2 ring-amber-400 text-gray-900 px-1 rounded"
                  : "text-gray-900 hover:bg-gray-100 px-1 -mx-1 rounded"
              }`}
            >
              Urgente: verifica tu acceso hoy
            </button>
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">Recibidos</span>
              <span className="text-xs text-gray-400">x</span>
            </div>
          </div>
        </div>

        {/* Sender Info Row */}
        <div className="mt-4 flex items-start gap-3">
          {/* Avatar circle */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-600 text-sm font-bold text-white shadow-sm">
            S
          </div>

          <div className="min-w-0 flex-1 text-xs sm:text-sm">
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="font-bold text-gray-900">Soporte interno</span>
              <button
                type="button"
                onClick={() => setSelection("sender")}
                className={`transition-all ${
                  selection === "sender"
                    ? "bg-amber-100 ring-2 ring-amber-400 px-1 rounded text-red-700 font-mono"
                    : "text-gray-500 hover:text-gray-800 hover:bg-gray-100 px-1 -mx-1 rounded font-mono text-xs"
                }`}
              >
                &lt;avisos@seguridad-ejemplo.invalid&gt;
              </button>
            </div>
            <div className="text-[11px] text-gray-500">
              para mí <span className="text-[10px]">▼</span>
            </div>
          </div>
        </div>

        {/* Email Body */}
        <div className="mt-6 space-y-4 border-t border-gray-100 pt-5 text-sm leading-relaxed text-gray-800 sm:text-base">
          <p>Estimado usuario,</p>
          <p>
            Detectamos un problema de seguridad en tu cuenta corporativa. Para evitar un bloqueo definitivo de tus servicios, confirma tus datos de acceso antes de que termine el día laboral.
          </p>

          {/* Phishing CTA Button / Link */}
          <div className="py-2">
            <button
              type="button"
              onClick={() => setSelection("link")}
              className={`inline-flex items-center gap-2 rounded px-4 py-2.5 text-sm font-medium transition-all ${
                selection === "link"
                  ? "bg-amber-100 ring-2 ring-amber-400 text-red-700 font-semibold"
                  : "bg-[#1a73e8] text-white hover:bg-[#1557b0] shadow-sm"
              }`}
            >
              <span>Verificar mi cuenta ahora</span>
              <ArrowRight size={16} aria-hidden />
            </button>
            <div className="mt-2 text-xs text-gray-400 font-mono">
              Destino: <span className="underline decoration-dotted">https://verificar-acceso.ejemplo.invalid/login</span>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Atentamente,<br />
            Equipo de Soporte de Infraestructura & TI
          </p>
        </div>

        {/* Educational Feedback Box inside or attached to the email */}
        <div className="mt-6 rounded-lg border border-gray-200 bg-[#f8f9fa] p-4 text-xs text-gray-700 sm:text-sm">
          {selection ? (
            <div className="space-y-2">
              <div className="flex items-start gap-2.5 font-medium text-emerald-800">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <p>
                  {selection === "link" && (
                    <>
                      <strong>¡Bien identificado!</strong> El destino del enlace no coincide con el dominio oficial de tu empresa. Los atacantes suelen clonar botones de inicio de sesión para robar contraseñas.
                    </>
                  )}
                  {selection === "sender" && (
                    <>
                      <strong>¡Bien identificado!</strong> Aunque el remitente dice llamarse "Soporte interno", la dirección real proviene de un dominio externo o sospechoso (<code>seguridad-ejemplo.invalid</code>).
                    </>
                  )}
                  {selection === "subject" && (
                    <>
                      <strong>¡Bien identificado!</strong> Los mensajes con tono de urgencia extrema ("evitar bloqueo hoy") buscan provocar pánico para que actúes sin pensar ni verificar.
                    </>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelection(null)}
                className="inline-block text-xs font-semibold text-[#1a73e8] hover:underline"
              >
                Probar otra señal
              </button>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-gray-600">
              <MailWarning size={16} className="shrink-0 text-amber-600" aria-hidden />
              <span>Haz clic en el remitente, asunto o botón de verificación para auditar las señales de phishing.</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function AwarenessDashboard() {
  const { ref, active, reduced } = useLandingMotion<HTMLDivElement>();
  const metricRef = useRef<HTMLParagraphElement>(null);
  const displayedRef = useRef<number>(cycles[0].completed);
  const [cycleIndex, setCycleIndex] = useState(0);
  const [departmentIndex, setDepartmentIndex] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      setCycleIndex(i => (i + 1) % 6);
      setDepartmentIndex(i => (i + 1) % departments.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [active]);
  const index = reduced ? 3 : [0, 1, 2, 3, 2, 1][cycleIndex];
  const cycle = cycles[index];
  useEffect(() => {
    const node = metricRef.current;
    if (!node) return;
    const start = displayedRef.current;
    const target = cycle.completed;
    if (reduced || !active) {
      displayedRef.current = target;
      node.textContent = `${target}%`;
      return;
    }
    let frame = 0;
    let startTime: number | undefined;
    const tick = (now: number) => {
      startTime ??= now;
      const progress = Math.min((now - startTime) / 1800, 1);
      const eased = progress * progress * (3 - 2 * progress);
      const value = Math.round(start + (target - start) * eased);
      displayedRef.current = value;
      node.textContent = `${value}%`;
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [cycle.completed, active, reduced]);
  return (
    <div ref={ref} className="landing-visual border-y border-border py-5" data-active={active}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4 text-xs uppercase tracking-widest text-ink-muted"><span>Vista de progreso · {cycle.label}</span>{label}</div>
      <div className="grid gap-10 py-8 md:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="text-sm text-ink-muted">Capacitaciones completadas</p>
          <p ref={metricRef} className="landing-metric mt-3 text-6xl font-semibold tabular-nums text-accent">{cycle.completed}%</p>
          <div className="mt-5 h-2 bg-border"><div className="landing-bar h-full bg-accent" style={{ width: `${cycle.completed}%` }} /></div>
          <div className="mt-8 flex items-center gap-3 border-t border-border pt-5"><GraduationCap className="text-[var(--landing-violet)]" aria-hidden /><span className="text-sm text-ink-muted">Resultado ilustrativo de evaluación <strong className="ml-2 text-ink">{cycle.evaluation}%</strong></span></div>
        </div>
        <div>
          <p className="mb-4 text-sm text-ink-muted">Participación por departamento <span className="text-[var(--landing-sky)]">/ {departments[departmentIndex]}</span></p>
          <div className="space-y-4">{departments.map((name, i) => <div key={name}>
            <div className="mb-1 flex justify-between text-xs"><span className={departmentIndex === i && !reduced ? "text-accent" : "text-ink-muted"}>{name}</span><span className="tabular-nums text-ink">{cycle.participation[i]}%</span></div>
            <div className="h-2 bg-border"><div className="landing-bar landing-department-bar h-full" style={{ width: `${cycle.participation[i]}%`, opacity: departmentIndex === i || reduced ? 1 : 0.58 }} /></div>
          </div>)}</div>
          <p className="mb-3 mt-8 text-sm text-ink-muted">Áreas de conocimiento para reforzar</p>
          <div className="flex flex-wrap gap-2">{topics.map((topic, i) => <span key={topic} className="landing-topic border border-border px-3 py-2 text-xs text-ink-muted">{topic} · {100 - cycle.topics[i]}% por revisar</span>)}</div>
        </div>
      </div>
      <p className="border-t border-border pt-4 text-xs text-ink-muted">Panel ilustrativo. Estas cifras no proceden de organizaciones reales ni describen funcionalidades de analítica actualmente disponibles.</p>
    </div>
  );
}
