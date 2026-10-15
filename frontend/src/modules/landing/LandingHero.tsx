import { useState } from "react";
import { ArrowDown, ArrowRight, MessageCircle, Radio, ShieldCheck, Users } from "lucide-react";

const heroImageSrc = "/sat/brand/hero-executive.png";

function whatsappLink(message: string): string {
  return `https://wa.me/12035065162?text=${encodeURIComponent(message)}`;
}

export function LandingHero() {
  const [users, setUsers] = useState("50");
  const [years, setYears] = useState(1);
  const count = Number(users);
  const valid = Number.isInteger(count) && count >= 1 && count <= 100000;
  const duration = `${years} ${years === 1 ? "año" : "años"}`;
  const sales = whatsappLink(
    `Hola, me interesa TXDXSAT para ${count} usuarios durante ${duration}. ¿Podrían contactarme para conocer las opciones disponibles?`
  );
  const training = whatsappLink(
    `Hola, quisiera solicitar un training en vivo de TXDXSAT para ${count} usuarios durante ${duration}. ¿Podemos conversar sobre la disponibilidad y cómo organizarlo?`
  );

  return (
    <section className="landing-grid overflow-hidden border-b border-border/70" aria-labelledby="landing-title">
      <div className="mx-auto max-w-7xl px-5 pt-8 pb-12 sm:px-8 sm:pt-12 lg:px-12 lg:pb-16">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
          {/* Columna Izquierda: Textos + Recuadro funcional horizontal debajo */}
          <div className="flex flex-col justify-center lg:col-span-7">
            <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              <span className="h-px w-8 bg-accent" aria-hidden />TXDXSecure / Security Awareness
            </p>

            <h1
              id="landing-title"
              className="mt-3 text-4xl font-bold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-6xl"
            >
              Security doesn't inherit.<br />
              <span className="text-accent">It's trained.</span>
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-muted sm:text-lg">
              Prepara a tu equipo para reconocer amenazas y tomar mejores decisiones. Sesiones en vivo que convierten cada respuesta en aprendizaje compartido.
            </p>

            <ul className="mt-5 grid gap-2.5 border-t border-border pt-4 text-sm text-ink sm:grid-cols-3" aria-label="Beneficios disponibles">
              <li className="flex items-center gap-2">
                <Radio size={16} className="shrink-0 text-accent" aria-hidden />
                <span>Sesiones interactivas</span>
              </li>
              <li className="flex items-center gap-2">
                <Users size={16} className="shrink-0 text-[var(--landing-sky)]" aria-hidden />
                <span>Participación por cuenta</span>
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck size={16} className="shrink-0 text-[var(--landing-violet)]" aria-hidden />
                <span>Resultados al instante</span>
              </li>
            </ul>

            <div className="mt-4">
              <a
                href="#plataforma"
                className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-ink-muted transition-colors hover:text-accent"
              >
                Conoce la plataforma <ArrowDown size={14} aria-hidden />
              </a>
            </div>

            {/* Recuadro funcional alargado y horizontal debajo del contenido */}
            <div className="mt-8 border border-border bg-surface p-5 sm:p-6">
              <div className="border-b border-border/80 pb-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Hablemos de tu equipo</p>
                <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-base font-semibold text-ink">Una propuesta para tu organización.</p>
                  <p className="text-xs text-ink-muted">Sin precios ni compromiso en esta página.</p>
                </div>
              </div>

              {/* Controles en una sola fila horizontal bien estructurada */}
              <div className="mt-4 grid items-end gap-4 sm:grid-cols-12">
                {/* Input de usuarios */}
                <div className="sm:col-span-4">
                  <label className="block text-xs font-medium text-ink" htmlFor="landing-users">
                    ¿Cuántas personas participarán?
                  </label>
                  <div className="mt-1.5 flex items-center border border-border bg-background px-3 focus-within:border-accent">
                    <Users size={16} className="shrink-0 text-accent" aria-hidden />
                    <input
                      id="landing-users"
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="100000"
                      step="1"
                      required
                      value={users}
                      onChange={(event) => setUsers(event.target.value)}
                      aria-describedby="landing-users-error"
                      className="min-w-0 w-full bg-transparent px-2 py-2 text-sm text-ink outline-none"
                    />
                    <span className="text-xs text-ink-muted">usuarios</span>
                  </div>
                </div>

                {/* Selector de años */}
                <div className="sm:col-span-3">
                  <fieldset>
                    <legend className="text-xs font-medium text-ink">Años de interés</legend>
                    <div className="mt-1.5 flex gap-1">
                      {[1, 2, 3].map((year) => (
                        <label key={year} className="cursor-pointer">
                          <input
                            type="radio"
                            name="landing-years"
                            value={year}
                            checked={years === year}
                            onChange={() => setYears(year)}
                            className="peer sr-only"
                          />
                          <span className="flex h-9 w-9 items-center justify-center border border-border text-xs text-ink-muted transition-colors hover:border-accent peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-ink">
                            {year}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>

                {/* Botones de acción directos */}
                <div className="flex flex-col gap-2 sm:col-span-5 sm:flex-row">
                  <a
                    href={valid ? sales : undefined}
                    aria-disabled={!valid}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex h-9 flex-1 items-center justify-center gap-1.5 bg-accent px-3 text-xs font-semibold text-[#04211f] transition-colors hover:bg-[var(--color-accent-hover)] ${
                      valid ? "" : "pointer-events-none opacity-50"
                    }`}
                  >
                    <MessageCircle size={15} aria-hidden />
                    <span>Contactar ventas</span>
                    <ArrowRight size={13} aria-hidden />
                  </a>

                  <a
                    href={valid ? training : undefined}
                    aria-disabled={!valid}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex h-9 flex-1 items-center justify-center gap-1 border border-border px-3 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent ${
                      valid ? "" : "pointer-events-none opacity-50"
                    }`}
                  >
                    <span>Training en vivo</span>
                    <ArrowRight size={13} aria-hidden />
                  </a>
                </div>
              </div>

              {!valid && (
                <p id="landing-users-error" className="mt-2 text-xs text-[var(--color-danger-readable)]">
                  Ingresa entre 1 y 100,000 usuarios.
                </p>
              )}

              <p className="mt-3 text-right text-[11px] text-ink-muted">
                WhatsApp se abrirá con tu solicitud prellenada.
              </p>
            </div>
          </div>

          {/* Columna Derecha: Imagen grande del tipo con tablet */}
          <div className="flex justify-center lg:col-span-5">
            <div className="relative w-full max-w-lg lg:max-w-none">
              <img
                src={heroImageSrc}
                alt="Executive professional using tablet - TXDXSAT training"
                fetchPriority="high"
                className="w-full object-contain filter drop-shadow-[0_20px_30px_rgba(0,0,0,0.5)]"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}