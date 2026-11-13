"use client";

// Pestaña Partitura: un "piano roll" en canvas. El eje X es el tiempo y el eje Y la
// altura de la nota. Las barras de compás son líneas verticales y un cursor recorre
// la partitura mientras suena. Arriba, cada compás validado por el chequeador aparece
// en verde (suma lo que exige la métrica) o en rojo (no lo suma).

import { useEffect, useRef } from "react";
import type { EventoSonido, Instrumento, MarcaCompas } from "@/compiler/natives";
import type { InfoCompas } from "@/compiler/semantic/checker";
import { nombreNota } from "@/compiler/tokens";

interface Props {
  sonidos: EventoSonido[];
  marcas: MarcaCompas[];
  compases: InfoCompas[];
  segundos: number;
  /** performance.now() del segundo 0 mientras suena; null si no está sonando. */
  inicioMs: number | null;
}

const PX_POR_SEGUNDO = 110;
const MARGEN_IZQ = 56;
const REGLA = 38; // franja superior: segundos arriba, número de compás debajo
const COLOR_INSTRUMENTO: Record<Instrumento, string> = {
  piano: "#38bdf8",
  organo: "#c084fc",
  flauta: "#4ade80",
  "8bit": "#fb923c",
};
const NEGRAS = new Set([1, 3, 6, 8, 10]); // semitonos que son teclas negras

export default function PartituraTab({ sonidos, marcas, compases, segundos, inicioMs }: Props) {
  const base = useRef<HTMLCanvasElement>(null);
  const capaCursor = useRef<HTMLCanvasElement>(null);
  const contenedor = useRef<HTMLDivElement>(null);

  const hay = sonidos.length > 0;
  const lo = hay ? Math.min(...sonidos.map((s) => s.midi)) - 2 : 58;
  const hi = hay ? Math.max(...sonidos.map((s) => s.midi)) + 2 : 74;
  const filas = hi - lo + 1;
  const alto = Math.max(8, Math.min(18, Math.floor(380 / filas)));
  const W = Math.max(640, MARGEN_IZQ + Math.ceil(segundos * PX_POR_SEGUNDO) + 40);
  const H = REGLA + filas * alto + 8;
  const X = (t: number) => MARGEN_IZQ + t * PX_POR_SEGUNDO;
  const Y = (midi: number) => REGLA + (hi - midi) * alto;

  // Dibujo estático: filas, nombres, compases y notas
  useEffect(() => {
    const ctx = base.current?.getContext("2d");
    if (!ctx || !hay) return;
    ctx.fillStyle = "#0b1020";
    ctx.fillRect(0, 0, W, H);
    for (let m = lo; m <= hi; m++) {
      ctx.fillStyle = NEGRAS.has(((m % 12) + 12) % 12) ? "#0d1426" : "#111a2e";
      ctx.fillRect(MARGEN_IZQ, Y(m), W - MARGEN_IZQ, alto - 1);
      if (!NEGRAS.has(((m % 12) + 12) % 12) && alto >= 11) {
        ctx.fillStyle = m % 12 === 0 ? "#e5e7eb" : "#64748b";
        ctx.font = `${Math.min(12, alto - 1)}px Consolas, monospace`;
        ctx.fillText(nombreNota(m), 6, Y(m) + alto - 3);
      }
    }
    // Regla de segundos
    ctx.fillStyle = "#64748b";
    ctx.font = "11px Consolas, monospace";
    for (let s = 0; s <= Math.ceil(segundos); s++) ctx.fillText(`${s}s`, X(s) + 2, 12);
    // Barras de compás (rojas si el chequeador marcó ese compás como inválido)
    for (const mc of marcas) {
      const info = compases.find((c) => c.numero === mc.numero);
      ctx.strokeStyle = info && !info.valido ? "#ef4444" : "rgba(148,163,184,0.45)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(X(mc.inicio), 18);
      ctx.lineTo(X(mc.inicio), H);
      ctx.stroke();
      ctx.fillStyle = "#facc15";
      ctx.fillText(`c${mc.numero}`, X(mc.inicio) + 4, REGLA - 6);
    }
    // Notas
    for (const s of sonidos) {
      const x = X(s.inicio);
      const w = Math.max(3, s.duracion * PX_POR_SEGUNDO - 2);
      ctx.fillStyle = COLOR_INSTRUMENTO[s.instrumento] ?? "#38bdf8";
      ctx.globalAlpha = 0.35 + 0.65 * s.volumen;
      ctx.beginPath();
      ctx.roundRect(x, Y(s.midi) + 1, w, alto - 2, 3);
      ctx.fill();
      ctx.globalAlpha = 1;
      if (w > 34 && alto >= 12) {
        ctx.fillStyle = "#0b0f17";
        ctx.font = `bold ${Math.min(11, alto - 3)}px Consolas, monospace`;
        ctx.fillText(nombreNota(s.midi), x + 4, Y(s.midi) + alto - 4);
      }
    }
  }, [sonidos, marcas, compases, segundos, hay, lo, hi, alto, W, H]);

  // Cursor animado mientras suena
  useEffect(() => {
    const ctx = capaCursor.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    if (inicioMs === null) return;
    let raf = 0;
    const cuadro = () => {
      const t = (performance.now() - inicioMs) / 1000;
      ctx.clearRect(0, 0, W, H);
      if (t >= 0) {
        const x = X(t);
        ctx.strokeStyle = "#facc15";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        // Desplaza la vista para que el cursor no se salga
        const c = contenedor.current;
        if (c && (x > c.scrollLeft + c.clientWidth - 80 || x < c.scrollLeft)) c.scrollLeft = x - 120;
      }
      if (t <= segundos + 0.3) raf = requestAnimationFrame(cuadro);
      else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(cuadro);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicioMs, W, H, segundos]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {compases.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-4 py-2 text-xs">
          <span className="text-slate-400">Tiempos por compás:</span>
          {compases.map((c) => (
            <span
              key={c.numero}
              title={`Línea ${c.linea} · métrica ${c.metrica}`}
              className={`mono rounded px-2 py-0.5 ${c.valido ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/20 text-red-300"}`}
            >
              {c.numero}: {c.suma ?? "?"} de {c.esperado} {c.valido ? "✓" : "✗"}
            </span>
          ))}
        </div>
      )}
      {!hay ? (
        <p className="p-4 text-sm text-slate-400">
          {compases.some((c) => !c.valido)
            ? "La música no se ejecutó porque hay errores. Los compases en rojo no suman los tiempos que exige la métrica."
            : "Este programa no toca música. Prueba los ejemplos 11 a 15, o el Manual (sección Música)."}
        </p>
      ) : (
        <>
          <div className="flex items-center gap-4 px-4 py-2 text-xs text-slate-400">
            <span>{sonidos.length} notas · {segundos.toFixed(1)} s</span>
            {(Object.keys(COLOR_INSTRUMENTO) as Instrumento[])
              .filter((i) => sonidos.some((s) => s.instrumento === i))
              .map((i) => (
                <span key={i} style={{ color: COLOR_INSTRUMENTO[i] }}>■ {i}</span>
              ))}
            <span className="ml-auto">Presiona ▶ Ejecutar para escucharla</span>
          </div>
          <div ref={contenedor} className="relative flex-1 overflow-auto px-4 pb-4">
            <div className="relative" style={{ width: W, height: H }}>
              <canvas ref={base} width={W} height={H} className="absolute inset-0 rounded-lg" />
              <canvas ref={capaCursor} width={W} height={H} className="pointer-events-none absolute inset-0" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
