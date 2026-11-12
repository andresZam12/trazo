"use client";

// Pestaña Árbol: el AST como árbol plegable. Al hacer clic en un nodo se
// resalta su código en el editor. Muestra el tipo que anotó el chequeador.

import { useState } from "react";
import type { Rango } from "../Editor";
import { etiquetaDe, hijosDe, type Expresion, type Nodo, type Programa, type Sentencia } from "@/compiler/ast";
import { imprimirExpresion, imprimirSentencia } from "@/compiler/printer";

const COLOR_NODO: Record<string, string> = {
  Programa: "text-sky-300",
  Bloque: "text-slate-400",
  DeclFuncion: "text-purple-300",
  DeclVar: "text-sky-300",
  Literal: "text-orange-300",
  Identificador: "text-slate-200",
  Binaria: "text-pink-300",
  Unaria: "text-pink-300",
  Llamada: "text-yellow-300",
};

const EXPRESIONES = ["Literal", "Identificador", "Binaria", "Unaria", "Llamada"];

/** Longitud aproximada del código del nodo, para subrayarlo en el editor. */
function longitudDe(n: Nodo): number {
  if (n.tipo === "Programa") return 1;
  const texto = EXPRESIONES.includes(n.tipo) ? imprimirExpresion(n as Expresion) : imprimirSentencia(n as Sentencia);
  return Math.max(1, texto.split("\n")[0].trim().length);
}

function NodoArbol({ nodo, nivel, onResaltar }: { nodo: Nodo; nivel: number; onResaltar: (r: Rango | null) => void }) {
  const hijos = hijosDe(nodo);
  const [abierto, setAbierto] = useState(nivel < 5);
  const tipoDato = "tipoDato" in nodo && nodo.tipoDato ? nodo.tipoDato : null;
  return (
    <div className="mono text-sm">
      <div
        className="flex cursor-pointer items-center gap-1 rounded px-1 hover:bg-yellow-400/10"
        style={{ paddingLeft: nivel * 18 }}
        onClick={() => onResaltar({ linea: nodo.linea, columna: nodo.columna, longitud: longitudDe(nodo) })}
      >
        <button
          className="w-4 text-slate-500"
          onClick={(e) => {
            e.stopPropagation();
            setAbierto(!abierto);
          }}
        >
          {hijos.length ? (abierto ? "▾" : "▸") : "·"}
        </button>
        <span className={COLOR_NODO[nodo.tipo] ?? "text-emerald-300"}>{etiquetaDe(nodo)}</span>
        {tipoDato && <span className="rounded bg-sky-500/10 px-1 text-xs text-sky-400">: {tipoDato}</span>}
        <span className="text-xs text-slate-600">L{nodo.linea}:{nodo.columna}</span>
      </div>
      {abierto && hijos.map((h, i) => <NodoArbol key={i} nodo={h} nivel={nivel + 1} onResaltar={onResaltar} />)}
    </div>
  );
}

export default function ArbolTab({ ast, astOptimizado, onResaltar }: { ast: Programa | null; astOptimizado: Programa | null; onResaltar: (r: Rango | null) => void }) {
  const [verOptimizado, setVerOptimizado] = useState(false);
  const arbol = verOptimizado && astOptimizado ? astOptimizado : ast;
  if (!arbol) return <p className="p-4 text-slate-400">No hay árbol: el programa tiene errores léxicos o sintácticos.</p>;
  return (
    <div className="h-full overflow-auto p-3">
      <div className="mb-2 flex items-center gap-3 text-xs text-slate-400">
        <span>Clic en un nodo para resaltar su código. ▸ / ▾ pliega.</span>
        {astOptimizado && (
          <label className="ml-auto flex items-center gap-1">
            <input type="checkbox" checked={verOptimizado} onChange={(e) => setVerOptimizado(e.target.checked)} /> ver árbol optimizado
          </label>
        )}
      </div>
      <NodoArbol key={verOptimizado ? "opt" : "orig"} nodo={arbol} nivel={0} onResaltar={onResaltar} />
    </div>
  );
}
