"use client";

// Pestaña Código intermedio: el programa traducido a código de tres direcciones.
// Se puede ver antes y después de optimizar para comparar cuántas instrucciones
// se ahorran. Al pasar el mouse por una instrucción se resalta en el editor la
// línea de Trazo que la produjo.

import { useState } from "react";
import type { Rango } from "../Editor";
import type { ClaseInstruccion, ResultadoIntermedio } from "@/compiler/intermedio";

const COLOR: Record<ClaseInstruccion, string> = {
  asignacion: "text-slate-200",
  etiqueta: "text-yellow-300 font-bold",
  salto: "text-pink-300",
  llamada: "text-sky-300",
  funcion: "text-purple-300 font-bold",
  musica: "text-teal-300",
};

const LEYENDA: [ClaseInstruccion, string][] = [
  ["asignacion", "t = a op b"],
  ["salto", "saltos"],
  ["etiqueta", "etiquetas"],
  ["llamada", "param / llamar"],
  ["musica", "música"],
];

interface Props {
  original: ResultadoIntermedio | null;
  optimizado: ResultadoIntermedio | null;
  onResaltar: (r: Rango | null) => void;
}

export default function IntermedioTab({ original, optimizado, onResaltar }: Props) {
  const [verOptimizado, setVerOptimizado] = useState(false);
  if (!original) {
    return <p className="p-4 text-sm text-slate-400">El código intermedio se genera cuando el programa no tiene errores léxicos, sintácticos ni semánticos.</p>;
  }
  const r = verOptimizado && optimizado ? optimizado : original;
  const boton = (activo: boolean) =>
    `rounded-md px-3 py-1 text-xs transition ${activo ? "bg-slate-700 text-slate-100" : "text-slate-400 hover:text-slate-200"}`;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 px-4 py-2 text-xs">
        <div className="flex rounded-lg border border-slate-700 p-0.5">
          <button className={boton(!verOptimizado)} onClick={() => setVerOptimizado(false)}>
            Sin optimizar ({original.instrucciones.length})
          </button>
          <button className={boton(verOptimizado)} onClick={() => setVerOptimizado(true)}>
            Optimizado ({optimizado?.instrucciones.length ?? "–"})
          </button>
        </div>
        <span className="text-slate-400">
          {r.instrucciones.length} instrucciones · {r.temporales} temporales · {r.etiquetas} etiquetas
        </span>
        <span className="flex gap-3">
          {LEYENDA.map(([c, texto]) => (
            <span key={c} className={COLOR[c]}>■ {texto}</span>
          ))}
        </span>
      </div>
      <p className="px-4 pt-2 text-xs text-slate-500">
        Código de tres direcciones: cada instrucción tiene un solo operador. Los temporales t1, t2… guardan resultados
        parciales y los si / mientras / repetir se vuelven etiquetas y saltos.
      </p>
      <div className="mono flex-1 overflow-auto px-4 py-2 text-sm">
        {r.instrucciones.map((ins, i) => {
          const sinSangria = ins.clase === "etiqueta" || ins.clase === "funcion";
          return (
            <div
              key={i}
              className="flex cursor-default rounded hover:bg-yellow-400/10"
              onMouseEnter={() => onResaltar({ linea: ins.linea, columna: ins.columna, longitud: 200 })}
              onMouseLeave={() => onResaltar(null)}
            >
              <span className="w-10 shrink-0 select-none pr-3 text-right text-slate-600">{i + 1}</span>
              <span className={`${COLOR[ins.clase]} ${sinSangria ? "" : "pl-6"} whitespace-pre`}>{ins.codigo}</span>
              <span className="ml-auto select-none pl-4 text-xs text-slate-600">línea {ins.linea}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
