"use client";

// Pestaña Errores: errores y advertencias agrupados por fase. Clic → ir a la línea.

import type { ErrorCompilacion, Fase } from "@/compiler/errors";

const FASES: Fase[] = ["Léxico", "Sintáctico", "Semántico", "Código intermedio", "Optimización", "Ejecución"];

interface Props {
  errores: ErrorCompilacion[];
  advertencias: ErrorCompilacion[];
  onIr: (e: ErrorCompilacion) => void;
}

export default function ErroresTab({ errores, advertencias, onIr }: Props) {
  const todos = [...errores, ...advertencias];
  if (todos.length === 0) return <p className="p-4 text-emerald-300">✓ Sin errores ni advertencias.</p>;
  return (
    <div className="h-full space-y-4 overflow-auto p-4">
      {FASES.map((fase) => {
        const lista = todos.filter((e) => e.fase === fase).sort((a, b) => a.linea - b.linea || a.columna - b.columna);
        if (!lista.length) return null;
        return (
          <section key={fase}>
            <h3 className="mb-1 text-sm font-semibold text-slate-300">
              Fase {fase} <span className="text-slate-500">({lista.length})</span>
            </h3>
            <ul className="space-y-1">
              {lista.map((e, i) => (
                <li
                  key={i}
                  onClick={() => onIr(e)}
                  className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm hover:brightness-125 ${
                    e.severidad === "error" ? "border-red-500/30 bg-red-500/10" : "border-amber-500/30 bg-amber-500/10"
                  }`}
                >
                  <span>{e.severidad === "error" ? "⛔" : "⚠️"}</span>
                  <span className="mono shrink-0 pt-0.5 text-xs text-slate-400">
                    L{e.linea}:{e.columna}
                  </span>
                  <span className={e.severidad === "error" ? "text-red-200" : "text-amber-200"}>{e.mensaje}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
