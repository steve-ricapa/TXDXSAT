import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  Building2,
  Check,
  Clock3,
  GraduationCap,
  Radio,
  ShieldCheck,
  Users,
} from "lucide-react";
import { BrandLogo, BrandMark } from "@/components/BrandLogo";
import { useAuth } from "@/modules/auth/context/AuthContext";

const capabilities = [
  {
    number: "01",
    icon: Radio,
    title: "Sesiones que involucran a todos.",
    description:
      "Un anfitrión dirige el cuestionario; los participantes se conectan desde su móvil con un PIN o un código QR. Preguntas, tiempo y resultados se sincronizan en vivo.",
  },
  {
    number: "02",
    icon: ShieldCheck,
    title: "Aprendizaje que se pone a prueba.",
    description:
      "Combina opciones, selección múltiple, respuestas abiertas y preguntas numéricas. Añade imágenes y explicaciones para convertir cada respuesta en una oportunidad de aprendizaje.",
  },
  {
    number: "03",
    icon: Users,
    title: "Una experiencia para cada rol.",
    description:
      "Participantes, anfitriones y administradores cuentan con vistas distintas. La clasificación y el podio dan ritmo al juego sin perder el foco en la concientización.",
  },
];

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
        <section className="landing-grid relative overflow-hidden border-b border-border/70">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-20 pt-20 sm:px-8 sm:pb-28 sm:pt-28 lg:min-h-[680px] lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-20 lg:px-12">
            <div className="relative z-10">
              <p className="landing-enter mb-8 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-accent">
                <span className="h-px w-9 bg-accent" aria-hidden />
                TXDXSecure / Security Awareness
              </p>
              <h1 className="landing-enter landing-delay-1 max-w-4xl text-[clamp(3.25rem,7vw,6.5rem)] font-bold leading-[1.03] tracking-[-0.055em] text-ink">
                La seguridad
                <br />
                se entrena<span className="text-accent">.</span>
              </h1>
              <p className="landing-enter landing-delay-2 mt-8 max-w-xl text-lg leading-relaxed text-ink-muted sm:text-xl">
                Capacitación en ciberseguridad que transforma preguntas en conversaciones, participación en aprendizaje y equipos en una primera línea de defensa.
              </p>
              <div className="landing-enter landing-delay-3 mt-10 flex flex-wrap items-center gap-4">
                <Link
                  to={user ? "/dashboard" : "/login"}
                  className="inline-flex min-h-12 items-center gap-3 bg-accent px-6 font-semibold text-[#04211f] transition-colors hover:bg-[var(--color-accent-hover)]"
                >
                  {user ? "Entrar al panel" : "Acceder a la plataforma"}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  to="/live/join"
                  className="inline-flex min-h-12 items-center gap-2 border-b border-border px-2 font-medium text-ink transition-colors hover:border-accent hover:text-accent"
                >
                  ¿Tienes un PIN? Únete
                </Link>
              </div>
              <a href="#plataforma" className="mt-16 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-ink-muted transition-colors hover:text-accent">
                Explorar la plataforma <ArrowDown className="h-4 w-4" aria-hidden />
              </a>
            </div>
            <div className="landing-enter landing-delay-2 relative mx-auto flex w-full max-w-[320px] items-center justify-center lg:max-w-none">
              <BrandMark size={300} className="relative h-auto max-w-full" />
            </div>
          </div>
        </section>

        <section id="plataforma" aria-labelledby="plataforma-title" className="scroll-mt-20 border-b border-border/70">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24 lg:px-12">
            <div className="landing-reveal">
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
                <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-accent" aria-hidden />PIN y QR para participar</span>
                <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-accent" aria-hidden />Preguntas con imágenes</span>
                <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-accent" aria-hidden />Resultados al instante</span>
              </div>
            </div>
          </div>
        </section>

        <section id="como-funciona" aria-labelledby="funciona-title" className="scroll-mt-20 border-b border-border/70">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
            <div className="landing-reveal mb-12 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Cómo funciona</p>
                <h2 id="funciona-title" className="mt-5 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">De la pregunta a la acción.</h2>
              </div>
              <p className="max-w-xs text-sm leading-relaxed text-ink-muted">Una experiencia clara para quien organiza y para quien participa.</p>
            </div>
            <div className="grid gap-0 lg:grid-cols-3">
              {capabilities.map((item) => (
                <article key={item.number} className="landing-reveal border-t border-border py-8 lg:border-r lg:px-8 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0">
                  <div className="flex items-center justify-between text-accent">
                    <span className="text-xs font-semibold tracking-widest">{item.number} / 03</span>
                    <item.icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="mt-10 max-w-xs text-2xl font-semibold leading-snug tracking-tight text-ink">{item.title}</h3>
                  <p className="mt-4 max-w-sm text-sm leading-7 text-ink-muted">{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="experiencia-title" className="border-b border-border/70 bg-surface/50">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-2 lg:items-center lg:gap-24 lg:px-12">
            <div className="landing-reveal">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">En vivo, de principio a fin</p>
              <h2 id="experiencia-title" className="mt-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
                Cada segundo cuenta. Cada respuesta enseña.
              </h2>
              <p className="mt-6 max-w-lg text-base leading-8 text-ink-muted">
                El anfitrión marca el ritmo; los participantes responden desde su dispositivo y ven su progreso al finalizar cada pregunta. La presentación muestra las respuestas y la clasificación en tiempo real.
              </p>
              <Link to="/live/join" className="mt-8 inline-flex items-center gap-2 border-b border-accent pb-1 font-semibold text-accent transition-colors hover:text-ink">
                Unirme a una sesión <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            <div className="landing-reveal border-y border-border py-3">
              {[
                { icon: Building2, label: "Organiza", detail: "Prepara las preguntas y abre la sesión." },
                { icon: GraduationCap, label: "Participa", detail: "Entra con un PIN y responde desde tu móvil." },
                { icon: Clock3, label: "Aprende", detail: "Revisa resultados y refuerza cada concepto." },
              ].map((step, index) => (
                <div key={step.label} className="flex items-start gap-5 border-b border-border py-7 last:border-0">
                  <span className="pt-1 text-xs font-semibold text-accent">0{index + 1}</span>
                  <step.icon className="h-6 w-6 shrink-0 text-accent" aria-hidden />
                  <div>
                    <h3 className="text-lg font-semibold text-ink">{step.label}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink-muted">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="cta-title" className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32 lg:px-12">
          <div className="landing-reveal flex flex-col items-start justify-between gap-8 border-l-2 border-accent pl-6 sm:pl-10 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">TXDXSAT / TXDXSecure</p>
              <h2 id="cta-title" className="mt-5 max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
                Una cultura de seguridad empieza con un equipo preparado.
              </h2>
            </div>
            <Link to={user ? "/dashboard" : "/login"} className="inline-flex min-h-12 shrink-0 items-center gap-3 bg-accent px-6 font-semibold text-[#04211f] transition-colors hover:bg-[var(--color-accent-hover)]">
              {user ? "Ir a mi panel" : "Iniciar sesión"} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface/40">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <span>© {new Date().getFullYear()} TXDXSecure · TXDXSAT</span>
          <div className="flex flex-wrap gap-x-7 gap-y-2">
            <Link to="/login" className="hover:text-ink">Acceso</Link>
            <Link to="/live/join" className="hover:text-ink">Unirse con PIN</Link>
            <a href="#contenido" className="hover:text-ink">Volver arriba ↑</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
