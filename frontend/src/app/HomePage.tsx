import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Activity,
  Fingerprint,
  Network,
  ScanSearch,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { AwarenessDashboard, LearningCycleFlow, PhishingSimulation, SecurityChainAnimation, TrainingExperiences } from "@/modules/landing/LandingVisuals";
import { LandingHero } from "@/modules/landing/LandingHero";
import { useLandingMotion } from "@/modules/landing/useLandingMotion";
import SecurityProgressChart from "@/modules/landing/SecurityProgressChart";

function DeferredProgressChart() {
  const { ref, visible } = useLandingMotion<HTMLDivElement>();
  return (
    <div ref={ref} className="min-h-80">
      {visible ? <SecurityProgressChart /> : <div className="h-80" />}
    </div>
  );
}

/** Public marketing page; intentionally separate from the authenticated shell. */
export function HomePage() {
  const { user } = useAuth();
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const page = pageRef.current;
    if (!page || !window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return;
    if (!("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -24px 0px" },
    );
    page.querySelectorAll(".landing-reveal").forEach((element) => observer.observe(element));
    page.classList.add("landing-animated");
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={pageRef} className="landing-page min-h-screen bg-background text-ink">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-accent focus:px-4 focus:py-2 focus:text-[#04211f]"
      >
        Saltar al contenido
      </a>

      <header className="relative z-10 border-b border-border/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-12">
          <Link to="/" aria-label="TXDXSAT — inicio" className="inline-flex">
            <BrandLogo size={42} />
          </Link>
          <nav aria-label="Navegación principal" className="flex items-center gap-5 text-sm sm:gap-8">
            <a href="#plataforma" className="hidden text-ink-muted transition-colors hover:text-ink sm:inline">La plataforma</a>
            <a href="#como-funciona" className="hidden text-ink-muted transition-colors hover:text-ink md:inline">Cómo funciona</a>
            <Link
              to={user ? "/dashboard" : "/login"}
              className="inline-flex items-center gap-2 border-b border-accent pb-1 font-semibold text-accent transition-colors hover:text-ink"
            >
              {user ? "Ir a mi panel" : "Iniciar sesión"}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </nav>
        </div>
      </header>

      <main id="contenido">
        <LandingHero />

        <section id="plataforma" aria-labelledby="plataforma-title" className="scroll-mt-20 border-b border-border/70">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24 lg:px-12">
            <div className="landing-reveal landing-section-heading">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">La plataforma</p>
              <h2 id="plataforma-title" className="mt-5 max-w-md text-4xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">
                Menos diapositivas. Más participación.
              </h2>
            </div>
            <div className="landing-reveal flex flex-col justify-center gap-8">
              <p className="max-w-2xl text-lg leading-relaxed text-ink-muted">
                TXDXSAT reúne la creación de cuestionarios y las sesiones interactivas en un entorno de capacitación para organizaciones. Una dinámica sencilla de iniciar, fácil de seguir en pantalla y diseñada para aprender en equipo.
              </p>
              <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-border pt-6 text-sm font-medium text-ink">
                <span className="inline-flex items-center gap-2"><Fingerprint className="h-4 w-4 text-accent" aria-hidden />Participación con cuenta</span>
                <span className="inline-flex items-center gap-2"><ScanSearch className="h-4 w-4 text-[var(--landing-sky)]" aria-hidden />Preguntas con imágenes</span>
                <span className="inline-flex items-center gap-2"><Activity className="h-4 w-4 text-[var(--landing-violet)]" aria-hidden />Resultados al instante</span>
              </div>
            </div>
          </div>
        </section>

        <section id="como-funciona" aria-labelledby="factor-title" className="scroll-mt-20 border-b border-border/70">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
            <div className="landing-reveal landing-section-heading max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">El factor humano</p>
              <h2 id="factor-title" className="mt-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">La seguridad de una empresa también depende de las decisiones de su equipo.</h2>
              <p className="mt-6 text-lg leading-relaxed text-ink-muted">Una señal ignorada puede afectar a la cadena. Reconocerla y practicar una respuesta informada protege al conjunto.</p>
            </div>
            <div className="mt-12"><SecurityChainAnimation /></div>
          </div>
        </section>

        <section aria-labelledby="cycle-title" className="border-b border-border/70 bg-surface/50">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
            <div className="landing-reveal landing-section-heading"><p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Cómo reforzamos la cultura</p><h2 id="cycle-title" className="mt-5 text-4xl font-bold sm:text-5xl">Aprender es un proceso continuo.</h2></div>
            <p className="landing-reveal mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted">Capacitar, evaluar, practicar y reforzar: un modelo de aprendizaje que va más allá de una charla.</p>
            <div className="mt-12"><LearningCycleFlow /></div>
          </div>
        </section>

        <section id="experiencias" aria-labelledby="modes-title" className="scroll-mt-20 border-b border-border/70">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
            <div className="landing-reveal landing-section-heading"><p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Experiencias TXDXSAT</p><h2 id="modes-title" className="mt-5 text-4xl font-bold sm:text-5xl">Tres maneras de aprender.</h2></div>
            <p className="mt-6 max-w-2xl text-ink-muted">Las sesiones en vivo ya están disponibles. Los trainings asincrónicos y laboratorios se muestran como conceptos previstos.</p>
            <div className="mt-12"><TrainingExperiences /></div>
            <p className="mt-8 inline-flex items-center gap-2 text-sm text-ink-muted"><Fingerprint size={17} className="text-[var(--landing-sky)]" aria-hidden />La participación en vivo requiere una cuenta para asociar tus resultados.</p>
          </div>
        </section>

        <section aria-labelledby="phishing-title" className="border-b border-border/70 bg-surface/50">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:px-12">
            <div className="landing-reveal landing-section-heading"><p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Decisiones informadas</p><h2 id="phishing-title" className="mt-5 text-4xl font-bold leading-tight sm:text-5xl">Practica frente a situaciones reales, en un entorno seguro.</h2><p className="mt-6 text-ink-muted">Identifica las señales en este ejemplo ficticio. Esta interacción vive solo en la landing; no es una campaña ni un laboratorio productivo.</p></div>
            <PhishingSimulation />
          </div>
        </section>

        <section aria-labelledby="dashboard-title" className="border-b border-border/70">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
            <div className="landing-reveal landing-section-heading max-w-3xl"><p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Visibilidad para administradores</p><h2 id="dashboard-title" className="mt-5 text-4xl font-bold sm:text-5xl">Comprende el progreso de tu organización.</h2><p className="mt-6 text-lg leading-relaxed text-ink-muted">Un ejemplo de cómo visualizar el avance de las capacitaciones, identificar temas por reforzar y orientar futuras acciones. Panel conceptual, no datos del producto.</p></div>
            <div className="mt-12"><AwarenessDashboard /></div>
          </div>
        </section>

        <section aria-labelledby="progress-title" className="border-b border-border/70 bg-surface/50">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:px-12">
            <div className="landing-reveal landing-section-heading"><p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Mejora continua</p><h2 id="progress-title" className="mt-5 text-4xl font-bold leading-tight sm:text-5xl">Cada capacitación impulsa una mejor preparación.</h2><p className="mt-6 text-ink-muted">Visualiza la evolución del aprendizaje entre ciclos y decide qué contenidos conviene reforzar después.</p></div>
            <DeferredProgressChart />
          </div>
        </section>

      </main>

      <footer className="landing-footer relative overflow-hidden border-t border-border">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 pb-12 pt-16 sm:px-8 lg:grid-cols-[1.4fr_1fr_1fr] lg:gap-20 lg:px-12">
          <div>
            <Link to="/" aria-label="TXDXSAT — inicio" className="inline-flex"><BrandLogo size={48} /></Link>
            <p className="mt-6 max-w-sm text-2xl font-semibold leading-snug text-ink">La seguridad se construye con cada decisión.</p>
            <p className="mt-3 max-w-sm text-sm leading-7 text-ink-muted">TXDXSecure · experiencias de aprendizaje para una cultura de seguridad más consciente.</p>
          </div>
          <nav aria-label="Explorar la landing" className="text-sm">
            <p className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--landing-sky)]"><Network size={17} aria-hidden /> Explorar</p>
            <div className="flex flex-col items-start gap-4 text-ink-muted">
              <a href="#plataforma" className="transition-colors hover:text-ink">La plataforma</a>
              <a href="#como-funciona" className="transition-colors hover:text-ink">El factor humano</a>
              <a href="#experiencias" className="transition-colors hover:text-ink">Experiencias</a>
            </div>
          </nav>
          <div className="text-sm">
            <p className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--landing-violet)]"><Fingerprint size={17} aria-hidden /> Tu acceso</p>
            <p className="max-w-xs leading-7 text-ink-muted">Entra con la cuenta de tu organización para que tu participación quede asociada a ti.</p>
            <Link to={user ? "/dashboard" : "/login"} className="mt-5 inline-flex items-center gap-2 border-b border-accent pb-1 font-semibold text-accent hover:text-ink">{user ? "Ir a mi panel" : "Iniciar sesión"}<ArrowUpRight size={16} aria-hidden /></Link>
          </div>
        </div>
        <div className="mx-auto flex max-w-7xl flex-col gap-4 border-t border-border/70 px-5 py-6 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <span>© {new Date().getFullYear()} TXDXSecure · TXDXSAT</span>
          <a href="#contenido" className="inline-flex items-center gap-2 text-[var(--landing-sky)] hover:text-ink">Volver arriba <ArrowUpRight size={14} aria-hidden /></a>
        </div>
      </footer>
    </div>
  );
}
