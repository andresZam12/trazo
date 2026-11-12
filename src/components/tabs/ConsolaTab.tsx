"use client";

// Pestaña Consola: lo que el programa escribió con mostrar() y los errores de ejecución.

import type { ResultadoCompilacion } from "@/compiler/pipeline";

export default function ConsolaTab({ r }: { r: ResultadoCompilacion }) {
  const errorEj = r.errores.find((e) => e.fase === "Ejecución");
  if (!r.ejecucion) return <p className="p-4 text-slate-400">El programa no se ejecutó porque tiene errores de compilación.</p>;
  return (
    <div className="mono h-full overflow-auto bg-black/40 p-4 text-sm">
      {r.ejecucion.consola.length === 0 && !errorEj && <div className="text-slate-500">(el programa no escribió nada en la consola)</div>}
      {r.ejecucion.consola.map((l, i) => (
        <div key={i} className="whitespace-pre-wrap text-emerald-200">
          <span className="select-none text-slate-600">› </span>
          {l}
        </div>
      ))}
      {errorEj && (
        <div className="mt-2 text-red-300">
          ⛔ [Ejecución] Línea {errorEj.linea}: {errorEj.mensaje}
        </div>
      )}
      <div className="mt-3 text-xs text-slate-500">
        {r.ejecucion.pasos.toLocaleString("es-CO")} pasos · {r.ejecucion.comandos.length.toLocaleString("es-CO")} comandos de dibujo
      </div>
    </div>
  );
}
