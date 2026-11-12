"use client";

// Pestaña Optimización: código regenerado desde el AST original y desde el
// optimizado, lado a lado, con la lista de reglas aplicadas y las métricas.

import type { Programa } from "@/compiler/ast";
import type { ResultadoCompilacion } from "@/compiler/pipeline";
import { imprimirPrograma } from "@/compiler/printer";

const COLOR_REGLA: Record<string, string> = {
  "Plegado de constantes": "bg-orange-500/15 text-orange-300",
  "Propagación de constantes": "bg-sky-500/15 text-sky-300",
  "Eliminación de código muerto": "bg-red-500/15 text-red-300",
  "Simplificación algebraica": "bg-purple-500/15 text-purple-300",
};

function Metrica({ titulo, antes, despues }: { titulo: string; antes: number | null; despues: number | null }) {
  const ahorro = antes && despues !== null ? Math.round((1 - despues / antes) * 100) : 0;
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-2">
      <div className="text-xs text-slate-400">{titulo}</div>
      <div className="mono text-lg">
        {antes ?? "—"} <span className="text-slate-500">→</span> <span className="text-emerald-300">{despues ?? "—"}</span>
        {ahorro > 0 && <span className="ml-2 text-xs text-emerald-400">−{ahorro}%</span>}
      </div>
    </div>
  );
}

function Codigo({ titulo, ast }: { titulo: string; ast: Programa }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-slate-800">
      <div className="border-b border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-400">{titulo}</div>
      <pre className="mono flex-1 overflow-auto p-3 text-xs leading-5 text-slate-200">{imprimirPrograma(ast)}</pre>
    </div>
  );
}

export default function OptimizacionTab({ r }: { r: ResultadoCompilacion }) {
  if (!r.ast || !r.astOptimizado)
    return <p className="p-4 text-slate-400">El optimizador solo corre cuando el programa no tiene errores léxicos, sintácticos ni semánticos.</p>;
  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-4">
      <div className="flex flex-wrap gap-3">
        <Metrica titulo="Nodos del AST" antes={r.metricas.nodosAntes} despues={r.metricas.nodosDespues} />
        <Metrica titulo="Pasos de ejecución" antes={r.metricas.pasosAntes} despues={r.metricas.pasosDespues} />
        <Metrica titulo="Reglas aplicadas" antes={null} despues={r.optimizaciones.length} />
      </div>
      <div className="grid min-h-[240px] grid-cols-2 gap-3">
        <Codigo titulo="Antes (AST original)" ast={r.ast} />
        <Codigo titulo="Después (AST optimizado)" ast={r.astOptimizado} />
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-300">Reglas aplicadas</h3>
        {r.optimizaciones.length === 0 && <p className="text-sm text-slate-500">No hubo nada que optimizar. Prueba el ejemplo 07 (optimizable).</p>}
        <ul className="mono space-y-1 text-xs">
          {r.optimizaciones.map((c, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="w-10 shrink-0 text-slate-500">L{c.linea}</span>
              <span className={`shrink-0 rounded px-2 ${COLOR_REGLA[c.regla]}`}>{c.regla}</span>
              <span className="text-slate-300">{c.antes}</span>
              <span className="text-slate-500">⟶</span>
              <span className="text-emerald-300">{c.despues}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
