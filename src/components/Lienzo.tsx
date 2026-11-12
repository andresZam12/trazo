"use client";

// Lienzo animado. Recibe la lista de ComandoDibujo que generó el intérprete y la
// reproduce poco a poco con requestAnimationFrame. Usa dos capas de canvas:
// una con el dibujo acumulado y otra encima solo para el lápiz (triángulo).

import { useCallback, useEffect, useRef, useState } from "react";
import type { ComandoDibujo } from "@/compiler/natives";

const ANCHO = 900;
const ALTO = 700;
const FONDO = "#0b1020";
/** Comandos dibujados en cada cuadro de animación (~60 por segundo). */
const POR_CUADRO = 25;

interface Props {
  comandos: ComandoDibujo[];
  /** Cambia cuando se pide reproducir de nuevo. */
  ejecucionId: number;
}

// El origen del lenguaje está en el centro y la y crece hacia arriba
const aPantalla = (x: number, y: number): [number, number] => [ANCHO / 2 + x, ALTO / 2 - y];

export default function Lienzo({ comandos, ejecucionId }: Props) {
  const base = useRef<HTMLCanvasElement>(null);
  const capaLapiz = useRef<HTMLCanvasElement>(null);
  const indice = useRef(0);
  const lapiz = useRef({ x: 0, y: 0, angulo: 0, color: "#f9fafb" });
  const raf = useRef<number | null>(null);
  const [pausado, setPausado] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const pausadoRef = useRef(false);

  const limpiarBase = () => {
    const ctx = base.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = FONDO;
    ctx.fillRect(0, 0, ANCHO, ALTO);
    // Ejes tenues para ubicar el origen
    ctx.strokeStyle = "rgba(148,163,184,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ANCHO / 2, 0);
    ctx.lineTo(ANCHO / 2, ALTO);
    ctx.moveTo(0, ALTO / 2);
    ctx.lineTo(ANCHO, ALTO / 2);
    ctx.stroke();
  };

  const dibujarLapiz = () => {
    const ctx = capaLapiz.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, ANCHO, ALTO);
    const { x, y, angulo, color } = lapiz.current;
    const [px, py] = aPantalla(x, y);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate((angulo * Math.PI) / 180);
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(8, 8);
    ctx.lineTo(-8, 8);
    ctx.closePath();
    ctx.fillStyle = color + "cc";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };

  /** Aplica un comando sobre la capa base y actualiza la posición del lápiz. */
  const aplicar = (c: ComandoDibujo) => {
    const ctx = base.current?.getContext("2d");
    if (!ctx) return;
    switch (c.tipo) {
      case "linea": {
        const [x1, y1] = aPantalla(c.x1, c.y1);
        const [x2, y2] = aPantalla(c.x2, c.y2);
        ctx.strokeStyle = c.color;
        ctx.lineWidth = c.grosor;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        lapiz.current = { ...lapiz.current, x: c.x2, y: c.y2, angulo: c.angulo, color: c.color };
        break;
      }
      case "mover":
        lapiz.current = { ...lapiz.current, x: c.x, y: c.y, angulo: c.angulo };
        break;
      case "color":
        lapiz.current = { ...lapiz.current, color: c.color };
        break;
      case "limpiar":
        limpiarBase();
        break;
      case "grosor":
        break;
    }
  };

  const cuadro = useCallback(() => {
    if (!pausadoRef.current) {
      let i = 0;
      while (i < POR_CUADRO && indice.current < comandos.length) {
        aplicar(comandos[indice.current++]);
        i++;
      }
      dibujarLapiz();
      setProgreso(indice.current);
    }
    if (indice.current < comandos.length) raf.current = requestAnimationFrame(cuadro);
    else raf.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comandos]);

  const reiniciar = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    indice.current = 0;
    lapiz.current = { x: 0, y: 0, angulo: 0, color: "#f9fafb" };
    limpiarBase();
    dibujarLapiz();
    setProgreso(0);
    raf.current = requestAnimationFrame(cuadro);
  }, [cuadro]);

  useEffect(() => {
    reiniciar();
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [reiniciar, ejecucionId]);

  const alternarPausa = () => {
    pausadoRef.current = !pausadoRef.current;
    setPausado(pausadoRef.current);
    if (!pausadoRef.current && !raf.current && indice.current < comandos.length) raf.current = requestAnimationFrame(cuadro);
  };

  const limpiarVista = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    indice.current = comandos.length;
    limpiarBase();
    dibujarLapiz();
    setProgreso(comandos.length);
  };

  /** Extra: exporta el dibujo (sin el lápiz) como PNG. */
  const exportarPNG = () => {
    const url = base.current?.toDataURL("image/png");
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = "trazo.png";
    a.click();
  };

  const boton = "boton-trazo";
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2">
        <button className={boton} onClick={alternarPausa}>{pausado ? "▶ Continuar" : "⏸ Pausa"}</button>
        <button className={boton} onClick={reiniciar}>↻ Repetir</button>
        <button className={boton} onClick={limpiarVista}>🧽 Limpiar</button>
        <button className={boton} onClick={exportarPNG}>⬇ PNG</button>
        <span className="mono ml-auto text-xs text-slate-400">
          {progreso} / {comandos.length} comandos
        </span>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-3">
        <div className="relative max-h-full max-w-full" style={{ aspectRatio: `${ANCHO} / ${ALTO}`, height: "100%" }}>
          <canvas ref={base} width={ANCHO} height={ALTO} className="absolute inset-0 h-full w-full rounded-lg border border-slate-800" />
          <canvas ref={capaLapiz} width={ANCHO} height={ALTO} className="pointer-events-none absolute inset-0 h-full w-full" />
        </div>
      </div>
    </div>
  );
}
