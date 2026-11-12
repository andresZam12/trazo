"use client";

// Ventana del mini manual. Cada ejemplo tiene un botón "Probar" que lo
// carga en el editor y cierra el manual.

import { MANUAL } from "@/manual/contenido";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  onProbar: (codigo: string) => void;
}

export default function Manual({ abierto, onCerrar, onProbar }: Props) {
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onCerrar}>
      <div
        className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-[#0f1420] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="degradado-trazo h-1 shrink-0" />
        <header className="flex items-center gap-3 border-b border-slate-800 px-5 py-3">
          <h2 className="bg-gradient-to-r from-sky-400 via-purple-400 to-orange-400 bg-clip-text text-lg font-black tracking-wide text-transparent">
            Mini manual de Trazo
          </h2>
          <button className="boton-trazo ml-auto" onClick={onCerrar}>
            ✕ Cerrar
          </button>
        </header>

        <div className="space-y-6 overflow-auto px-5 py-4">
          {MANUAL.map((s) => (
            <section key={s.titulo}>
              <h3 className="mb-2 text-base font-bold text-slate-100">{s.titulo}</h3>
              {s.texto.map((p, i) => (
                <p key={i} className="mb-2 text-sm leading-relaxed text-slate-300">
                  {p}
                </p>
              ))}
              {s.tabla && (
                <table className="mono my-2 w-full text-xs">
                  <thead className="text-left text-slate-400">
                    <tr>
                      <th className="border-b border-slate-800 py-1 pr-4">{s.tabla.columnas[0]}</th>
                      <th className="border-b border-slate-800 py-1">{s.tabla.columnas[1]}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.tabla.filas.map(([a, b]) => (
                      <tr key={a} className="border-b border-slate-800/50">
                        <td className="py-1 pr-4 text-yellow-300">{a}</td>
                        <td className="py-1 text-slate-300">{b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {s.ejemplo && (
                <div className="mt-2 overflow-hidden rounded-lg border border-slate-800">
                  <pre className="mono overflow-auto bg-black/40 p-3 text-xs leading-5 text-slate-200">{s.ejemplo}</pre>
                  <div className="flex justify-end border-t border-slate-800 bg-slate-900/60 px-3 py-2">
                    <button className="boton-trazo" onClick={() => onProbar(s.ejemplo!)}>
                      ▶ Probar
                    </button>
                  </div>
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
