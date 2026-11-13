"use client";

// Barra del pipeline: una píldora por fase, verde (ok), roja (error) o gris (omitida).
// Muestra de un vistazo en qué fase falló el programa.

import type { InfoFase } from "@/compiler/pipeline";

const ESTILO: Record<InfoFase["estado"], string> = {
  ok: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  error: "bg-red-500/20 text-red-300 border-red-500/60 animate-pulse",
  omitida: "bg-slate-700/20 text-slate-500 border-slate-700",
};

const ICONO: Record<InfoFase["estado"], string> = { ok: "✓", error: "✗", omitida: "–" };

export default function PipelineBar({ fases }: { fases: InfoFase[] }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto px-4 py-2 border-b border-slate-800 bg-[#0d121c]">
      {fases.map((f, i) => (
        <div key={f.nombre} className="flex items-center gap-1 shrink-0">
          <div className={`flex items-center gap-2 rounded-md border px-3 py-1 text-sm ${ESTILO[f.estado]}`} title={`Fase ${f.nombre}: ${f.estado}`}>
            <span className="font-bold">{ICONO[f.estado]}</span>
            <span className="font-medium">{f.nombre}</span>
            {f.detalle && <span className="mono text-xs opacity-80">· {f.detalle}</span>}
          </div>
          {i < fases.length - 1 && <span className="text-slate-600 px-1">→</span>}
        </div>
      ))}
    </div>
  );
}
