"use client";

// Pestaña Tokens: la salida del analizador léxico como tabla.
// Al pasar el mouse por una fila se resalta el lexema en el editor.

import type { Rango } from "../Editor";
import { categoriaDe, type CategoriaToken, type Token } from "@/compiler/tokens";

const COLOR: Record<CategoriaToken, string> = {
  palabra: "text-purple-300",
  identificador: "text-slate-200",
  literal: "text-orange-300",
  operador: "text-pink-300",
  delimitador: "text-slate-400",
  fin: "text-slate-500",
};

export default function TokensTab({ tokens, onResaltar }: { tokens: Token[]; onResaltar: (r: Rango | null) => void }) {
  return (
    <div className="h-full overflow-auto">
      <div className="flex flex-wrap gap-4 px-4 py-2 text-xs text-slate-400">
        <span>{tokens.length} tokens</span>
        {(Object.keys(COLOR) as CategoriaToken[]).map((c) => (
          <span key={c} className={COLOR[c]}>■ {c}</span>
        ))}
      </div>
      <table className="mono w-full text-sm">
        <thead className="sticky top-0 bg-[#111827] text-left text-xs uppercase text-slate-400">
          <tr>
            <th className="px-4 py-2">#</th>
            <th className="px-4 py-2">Tipo</th>
            <th className="px-4 py-2">Lexema</th>
            <th className="px-4 py-2">Línea</th>
            <th className="px-4 py-2">Columna</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((t, i) => {
            const cat = categoriaDe(t.tipo);
            return (
              <tr
                key={i}
                className="cursor-default border-t border-slate-800/60 hover:bg-yellow-400/10"
                onMouseEnter={() => onResaltar({ linea: t.linea, columna: t.columna, longitud: Math.max(1, t.lexema.length) })}
                onMouseLeave={() => onResaltar(null)}
              >
                <td className="px-4 py-1 text-slate-500">{i}</td>
                <td className={`px-4 py-1 ${COLOR[cat]}`}>{t.tipo}</td>
                <td className={`px-4 py-1 ${COLOR[cat]}`}>{t.tipo === "EOF" ? "⟂" : t.lexema}</td>
                <td className="px-4 py-1 text-slate-400">{t.linea}</td>
                <td className="px-4 py-1 text-slate-400">{t.columna}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
