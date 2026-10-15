import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cycles } from "./demoMetrics";
import { useLandingMotion } from "./useLandingMotion";

export default function SecurityProgressChart() {
  const { ref, active, reduced } = useLandingMotion<HTMLDivElement>();
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setPhase(i => (i + 1) % 6), 2200);
    return () => window.clearInterval(timer);
  }, [active]);
  const shown = [1, 2, 3, 4, 3, 2][phase];
  const data = cycles.map((cycle, i) => ({ name: cycle.label, aprendizaje: cycle.evaluation, shown: reduced || i < shown ? cycle.evaluation : null }));
  return (
    <div ref={ref} className="landing-visual border-y border-border py-5" data-active={active}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4 text-xs uppercase tracking-widest text-ink-muted"><span>Evaluación · ciclos de capacitación</span><span>Visualización ilustrativa · datos simulados</span></div>
      <div className="mt-7 h-64 w-full sm:h-80" role="img" aria-label="Evolución ilustrativa entre cuatro ciclos: 59, 66, 71 y 77 por ciento en evaluaciones">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 18, bottom: 6, left: -20 }} accessibilityLayer>
            <CartesianGrid stroke="#263b55" vertical={false} />
            <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} />
            <YAxis domain={[40, 90]} stroke="#94a3b8" tickLine={false} axisLine={false} tickFormatter={n => `${n}%`} />
            <Tooltip contentStyle={{ background: "#101c30", border: "1px solid #263b55", borderRadius: 0, color: "#f3f7fc" }} formatter={value => [`${value}%`, "Evaluación ilustrativa"]} />
            <Line type="monotone" dataKey="shown" name="Evaluación ilustrativa" stroke="#74c6ff" strokeWidth={3} dot={{ fill: "#080f1e", stroke: "#b5a4ff", strokeWidth: 2, r: 5 }} activeDot={{ r: 7 }} isAnimationActive={!reduced} animationDuration={2000} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-4 text-sm text-ink-muted">La curva ilustra una posible evolución de aprendizaje; no es una predicción ni una medición real de clientes.</p>
    </div>
  );
}
