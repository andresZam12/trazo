"use client";

// Página principal de Trazo: editor a la izquierda, pestañas a la derecha y la
// barra del pipeline arriba. Recompila en vivo 400 ms después de dejar de escribir.

import { useEffect, useMemo, useRef, useState } from "react";
import { reproducir, type Reproduccion } from "@/components/audio";
import PartituraTab from "@/components/tabs/PartituraTab";
import Editor, { type Rango } from "@/components/Editor";
import Lienzo from "@/components/Lienzo";
import Manual from "@/components/Manual";
import PipelineBar from "@/components/PipelineBar";
import ArbolTab from "@/components/tabs/ArbolTab";
import ConsolaTab from "@/components/tabs/ConsolaTab";
import ErroresTab from "@/components/tabs/ErroresTab";
import OptimizacionTab from "@/components/tabs/OptimizacionTab";
import SimbolosTab from "@/components/tabs/SimbolosTab";
import TokensTab from "@/components/tabs/TokensTab";
import { compilar } from "@/compiler/pipeline";
import type { ErrorCompilacion } from "@/compiler/errors";
import { EJEMPLOS } from "@/examples";

type Pestana = "Lienzo" | "Partitura" | "Tokens" | "Árbol" | "Símbolos" | "Optimización" | "Errores" | "Consola";
const PESTANAS: Pestana[] = ["Lienzo", "Partitura", "Tokens", "Árbol", "Símbolos", "Optimización", "Errores", "Consola"];
const EJEMPLO_INICIAL = EJEMPLOS.find((e) => e.archivo.startsWith("04"))?.codigo ?? "";

export default function Pagina() {
  const [codigo, setCodigo] = useState(EJEMPLO_INICIAL);
  const [codigoCompilado, setCodigoCompilado] = useState(EJEMPLO_INICIAL);
  const [usarOptimizado, setUsarOptimizado] = useState(true);
  const [pestana, setPestana] = useState<Pestana>("Lienzo");
  const [resaltado, setResaltado] = useState<Rango | null>(null);
  const [irA, setIrA] = useState<(Rango & { n: number }) | null>(null);
  const [ejecucionId, setEjecucionId] = useState(0);
  const [manualAbierto, setManualAbierto] = useState(false);
  const reproduccion = useRef<Reproduccion | null>(null);
  const [inicioMusica, setInicioMusica] = useState<number | null>(null);

  // Atajo para la exposición: ?ejemplo=12&pestana=Partitura abre ese ejemplo en esa pestaña
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const ej = EJEMPLOS.find((e) => e.archivo.startsWith((p.get("ejemplo") ?? "").padStart(2, "0")));
    const pest = PESTANAS.find((x) => x === p.get("pestana"));
    if (ej && p.get("ejemplo")) {
      setCodigo(ej.codigo);
      setCodigoCompilado(ej.codigo);
    }
    if (pest) setPestana(pest);
  }, []);

  // Recompilación en vivo con debounce de 400 ms
  useEffect(() => {
    const t = setTimeout(() => setCodigoCompilado(codigo), 400);
    return () => clearTimeout(t);
  }, [codigo]);

  const r = useMemo(() => compilar(codigoCompilado, { usarOptimizado }), [codigoCompilado, usarOptimizado]);
  const problemas = useMemo(() => [...r.errores, ...r.advertencias], [r]);

  const detenerMusica = () => {
    reproduccion.current?.detener();
    reproduccion.current = null;
  };

  /** Carga un código en el editor y lo compila de inmediato (sin esperar el debounce). */
  const cargar = (c: string, destino: Pestana) => {
    detenerMusica();
    setCodigo(c);
    setCodigoCompilado(c);
    setResaltado(null);
    setPestana(destino);
  };

  /**
   * Ejecutar: vuelve a dibujar y, si el programa toca música, la hace sonar.
   * El sonido solo puede empezar con un clic (los navegadores bloquean el audio automático).
   */
  const ejecutar = () => {
    detenerMusica();
    const res = compilar(codigo, { usarOptimizado });
    setCodigoCompilado(codigo);
    setEjecucionId((n) => n + 1);
    const sonidos = res.ejecucion?.sonidos ?? [];
    const dibuja = res.ejecucion?.comandos.some((c) => c.tipo === "linea") ?? false;
    setPestana(res.errores.length ? "Errores" : sonidos.length && !dibuja ? "Partitura" : "Lienzo");
    if (res.errores.length || !sonidos.length) return;

    const lineas = codigo.split("\n");
    reproduccion.current = reproducir(
      sonidos,
      (linea) => setResaltado({ linea, columna: 1, longitud: Math.max(1, (lineas[linea - 1] ?? "").length) }),
      () => {
        setInicioMusica(null);
        setResaltado(null);
      },
    );
    setInicioMusica(reproduccion.current.inicioMs);
  };

  const irAError = (e: ErrorCompilacion) => {
    setIrA({ linea: e.linea, columna: e.columna, longitud: e.longitud, n: Date.now() });
    setResaltado({ linea: e.linea, columna: e.columna, longitud: e.longitud });
  };

  const nErrores = r.errores.length;
  const nAdvertencias = r.advertencias.length;
  const etiqueta = (p: Pestana) => {
    if (p === "Errores" && (nErrores || nAdvertencias)) return `Errores (${nErrores}${nAdvertencias ? ` · ⚠${nAdvertencias}` : ""})`;
    if (p === "Optimización" && r.optimizaciones.length) return `Optimización (${r.optimizaciones.length})`;
    if (p === "Consola" && r.ejecucion?.consola.length) return `Consola (${r.ejecucion.consola.length})`;
    return p;
  };

  return (
    <main className="flex h-screen flex-col">
      {/* Barra superior */}
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-800 bg-[#0d121c] px-4 py-2">
        <h1 className="bg-gradient-to-r from-sky-400 via-purple-400 to-orange-400 bg-clip-text text-xl font-black tracking-widest text-transparent">
          TRAZO
        </h1>
        <span className="hidden text-xs text-slate-500 lg:inline">mini-lenguaje en español que dibuja</span>

        <select
          className="boton-trazo cursor-pointer"
          value=""
          onChange={(e) => {
            const ej = EJEMPLOS.find((x) => x.archivo === e.target.value);
            if (!ej) return;
            const n = Number(ej.archivo.slice(0, 2));
            const destino: Pestana = ej.archivo.includes("error")
              ? "Errores"
              : n === 7
                ? "Optimización"
                : n === 6
                  ? "Consola"
                  : n >= 11 && n <= 14
                    ? "Partitura"
                    : "Lienzo";
            cargar(ej.codigo, destino);
          }}
        >
          <option value="" className="bg-slate-800 text-slate-100">
            Ejemplos ▾
          </option>
          {EJEMPLOS.map((e) => (
            <option key={e.archivo} value={e.archivo} className="bg-slate-800 text-slate-100">
              {e.archivo.slice(0, 2)} · {e.nombre}
            </option>
          ))}
        </select>

        <button onClick={ejecutar} className="boton-trazo">
          ▶ Ejecutar
        </button>
        {inicioMusica !== null && (
          <button onClick={detenerMusica} className="boton-trazo">
            ■ Detener música
          </button>
        )}

        {/* Interruptor: con degradado cuando está activo, con borde cuando no */}
        <button
          onClick={() => setUsarOptimizado(!usarOptimizado)}
          title="Ejecuta el AST optimizado en lugar del original"
          className={usarOptimizado ? "boton-trazo" : "rounded-md border border-slate-600 px-3 py-1 text-sm text-slate-400 hover:text-slate-200"}
        >
          {usarOptimizado ? "✓ Optimizar" : "Optimizar"}
        </button>

        <button onClick={() => setManualAbierto(true)} className="boton-trazo ml-auto">
          📖 Manual
        </button>
      </header>

      <PipelineBar fases={r.fases} />

      {/* Cuerpo: editor + pestañas */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <section className="min-h-[300px] border-r border-slate-800">
          <Editor valor={codigo} onCambio={setCodigo} problemas={problemas} resaltado={resaltado} irA={irA} />
        </section>

        <section className="flex min-h-0 flex-col">
          <nav className="flex flex-wrap border-b border-slate-800 bg-[#0d121c]">
            {PESTANAS.map((p) => (
              <button
                key={p}
                onClick={() => setPestana(p)}
                className={`relative px-4 py-2 text-sm transition ${pestana === p ? "font-semibold text-slate-100" : "text-slate-400 hover:text-slate-200"} ${
                  p === "Errores" && nErrores ? "text-red-300" : ""
                }`}
              >
                {etiqueta(p)}
                {pestana === p && <span className="degradado-trazo absolute inset-x-2 bottom-0 h-0.5 rounded-full" />}
              </button>
            ))}
          </nav>
          <div className="min-h-0 flex-1">
            {/* El lienzo se mantiene montado para no perder la animación al cambiar de pestaña */}
            <div className={pestana === "Lienzo" ? "h-full" : "hidden"}>
              <Lienzo comandos={r.ejecucion?.comandos ?? []} ejecucionId={ejecucionId} />
            </div>
            {pestana === "Tokens" && <TokensTab tokens={r.tokens} onResaltar={setResaltado} />}
            {pestana === "Árbol" && <ArbolTab ast={r.ast} astOptimizado={r.astOptimizado} onResaltar={setResaltado} />}
            {pestana === "Partitura" && (
              <PartituraTab
                sonidos={r.ejecucion?.sonidos ?? []}
                marcas={r.ejecucion?.marcasCompas ?? []}
                compases={r.compases}
                segundos={r.ejecucion?.segundos ?? 0}
                inicioMs={inicioMusica}
              />
            )}
            {pestana === "Símbolos" && <SimbolosTab tabla={r.tablaSimbolos} compases={r.compases} />}
            {pestana === "Optimización" && <OptimizacionTab r={r} />}
            {pestana === "Errores" && <ErroresTab errores={r.errores} advertencias={r.advertencias} onIr={irAError} />}
            {pestana === "Consola" && <ConsolaTab r={r} />}
          </div>
        </section>
      </div>

      <Manual
        abierto={manualAbierto}
        onCerrar={() => setManualAbierto(false)}
        onProbar={(c) => {
          setManualAbierto(false);
          const musica = /\b(tocar|acorde)\b/.test(c);
          cargar(c, musica ? "Partitura" : c.includes("mostrar") && !c.includes("avanzar") ? "Consola" : "Lienzo");
        }}
      />
    </main>
  );
}
