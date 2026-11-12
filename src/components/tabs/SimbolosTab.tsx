"use client";

// Pestaña Símbolos: el árbol de ámbitos anidados de la tabla de símbolos.

import { useState } from "react";
import type { SnapshotAmbito } from "@/compiler/semantic/symbolTable";

const COLOR_CAT: Record<string, string> = {
  variable: "text-sky-300",
  parametro: "text-emerald-300",
  funcion: "text-purple-300",
  nativa: "text-yellow-300",
};

function AmbitoVista({ ambito, nivel, verNativas }: { ambito: SnapshotAmbito; nivel: number; verNativas: boolean }) {
  const simbolos = ambito.simbolos.filter((s) => verNativas || s.categoria !== "nativa");
  return (
    <div className="mt-2" style={{ marginLeft: nivel * 20 }}>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-500">{nivel > 0 ? "└" : ""}</span>
        <span className="rounded bg-slate-800 px-2 py-0.5 font-semibold text-slate-200">{ambito.nombre}</span>
        <span className="text-xs text-slate-500">ámbito {ambito.tipo}</span>
      </div>
      {simbolos.length > 0 && (
        <table className="mono mt-1 ml-5 text-xs">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="pr-4">Nombre</th>
              <th className="pr-4">Tipo</th>
              <th className="pr-4">Categoría</th>
              <th className="pr-4">Línea</th>
              <th>Usado</th>
            </tr>
          </thead>
          <tbody>
            {simbolos.map((s) => (
              <tr key={s.nombre}>
                <td className="pr-4 text-slate-200">{s.nombre}{s.firma ?? ""}</td>
                <td className="pr-4 text-sky-400">{s.tipo}</td>
                <td className={`pr-4 ${COLOR_CAT[s.categoria]}`}>{s.categoria}</td>
                <td className="pr-4 text-slate-400">{s.linea || "—"}</td>
                <td className={s.usado ? "text-emerald-400" : "text-amber-400"}>{s.usado ? "sí" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {ambito.hijos.map((h) => (
        <AmbitoVista key={h.id} ambito={h} nivel={nivel + 1} verNativas={verNativas} />
      ))}
    </div>
  );
}

export default function SimbolosTab({ tabla }: { tabla: SnapshotAmbito | null }) {
  const [verNativas, setVerNativas] = useState(false);
  if (!tabla)
    return <p className="p-4 text-slate-400">La tabla de símbolos se construye en la fase semántica (corrige primero los errores léxicos y sintácticos).</p>;
  return (
    <div className="h-full overflow-auto p-4">
      <label className="flex items-center gap-1 text-xs text-slate-400">
        <input type="checkbox" checked={verNativas} onChange={(e) => setVerNativas(e.target.checked)} /> mostrar funciones nativas del ámbito global
      </label>
      <AmbitoVista ambito={tabla} nivel={0} verNativas={verNativas} />
    </div>
  );
}
