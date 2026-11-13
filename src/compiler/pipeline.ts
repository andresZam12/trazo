// Pipeline del compilador: encadena las fases y mide cuánto tarda cada una.
//
//   fuente → Léxico → Sintáctico → Semántico → Código intermedio → Optimización → Ejecución
//            tokens    AST          tipos       tres direcciones    AST' + TAC'    dibujo y sonido
//
// Cada fase corre solo si la anterior no tuvo errores (las advertencias no
// detienen), pero cada fase reporta TODOS sus errores, no solo el primero.

import type { Programa } from "./ast";
import { contarNodos } from "./ast";
import { ErrorCompilacion, Fase, ordenarErrores } from "./errors";
import { generarIntermedio, type ResultadoIntermedio } from "./intermedio";
import { interpretar } from "./interpreter";
import { analizarLexico } from "./lexer";
import type { ComandoDibujo, EventoSonido, MarcaCompas } from "./natives";
import type { InfoCompas } from "./semantic/checker";
import { CambioOptimizacion, optimizar } from "./optimizer";
import { analizarSintaxis } from "./parser";
import { analizarSemantica } from "./semantic/checker";
import type { SnapshotAmbito } from "./semantic/symbolTable";
import type { Token } from "./tokens";

export type EstadoFase = "ok" | "error" | "omitida";

export interface InfoFase {
  nombre: Fase;
  estado: EstadoFase;
  ms: number;
  /** Texto corto extra, por ejemplo "24 notas, 9.8 s" en la ejecución. */
  detalle?: string;
}

export interface ResultadoCompilacion {
  tokens: Token[];
  ast: Programa | null;
  astOptimizado: Programa | null;
  tablaSimbolos: SnapshotAmbito | null;
  optimizaciones: CambioOptimizacion[];
  /** Código de tres direcciones generado del AST y del AST optimizado. */
  intermedio: ResultadoIntermedio | null;
  intermedioOptimizado: ResultadoIntermedio | null;
  errores: ErrorCompilacion[];
  advertencias: ErrorCompilacion[];
  ejecucion: {
    comandos: ComandoDibujo[];
    consola: string[];
    pasos: number;
    sonidos: EventoSonido[];
    marcasCompas: MarcaCompas[];
    segundos: number;
  } | null;
  /** Compases validados por el chequeador (vacío si no hubo fase semántica). */
  compases: InfoCompas[];
  fases: InfoFase[];
  /** Métricas para la pestaña Optimización. */
  metricas: { nodosAntes: number; nodosDespues: number; pasosAntes: number | null; pasosDespues: number | null };
}

export interface OpcionesCompilacion {
  /** Si es true se ejecuta el AST optimizado; si no, el original. */
  usarOptimizado?: boolean;
}

const ahora = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** Mide el tiempo de una función en milisegundos. */
function medir<T>(fn: () => T): [T, number] {
  const t0 = ahora();
  const r = fn();
  return [r, Math.round((ahora() - t0) * 100) / 100];
}

export function compilar(fuente: string, opciones: OpcionesCompilacion = {}): ResultadoCompilacion {
  const usarOptimizado = opciones.usarOptimizado ?? true;
  const fases: InfoFase[] = [];
  const errores: ErrorCompilacion[] = [];
  const advertencias: ErrorCompilacion[] = [];
  const resultado: ResultadoCompilacion = {
    tokens: [],
    ast: null,
    astOptimizado: null,
    tablaSimbolos: null,
    optimizaciones: [],
    intermedio: null,
    intermedioOptimizado: null,
    errores,
    advertencias,
    ejecucion: null,
    compases: [],
    fases,
    metricas: { nodosAntes: 0, nodosDespues: 0, pasosAntes: null, pasosDespues: null },
  };
  const omitirDesde = (desde: Fase[]) => desde.forEach((f) => fases.push({ nombre: f, estado: "omitida", ms: 0 }));
  const terminar = () => {
    resultado.errores = ordenarErrores(errores);
    resultado.advertencias = ordenarErrores(advertencias);
    return resultado;
  };

  // 1. Léxico
  const [lex, msLex] = medir(() => analizarLexico(fuente));
  resultado.tokens = lex.tokens;
  errores.push(...lex.errores);
  fases.push({ nombre: "Léxico", estado: lex.errores.length ? "error" : "ok", ms: msLex });
  if (lex.errores.length) {
    omitirDesde(["Sintáctico", "Semántico", "Código intermedio", "Optimización", "Ejecución"]);
    return terminar();
  }

  // 2. Sintáctico
  const [sin, msSin] = medir(() => analizarSintaxis(lex.tokens));
  errores.push(...sin.errores);
  fases.push({ nombre: "Sintáctico", estado: sin.errores.length ? "error" : "ok", ms: msSin });
  if (sin.errores.length) {
    omitirDesde(["Semántico", "Código intermedio", "Optimización", "Ejecución"]);
    return terminar();
  }
  resultado.ast = sin.ast;
  resultado.metricas.nodosAntes = contarNodos(sin.ast);

  // 3. Semántico (anota tipos en el AST)
  const [sem, msSem] = medir(() => analizarSemantica(sin.ast));
  errores.push(...sem.errores);
  advertencias.push(...sem.advertencias);
  resultado.tablaSimbolos = sem.tablaSimbolos;
  resultado.compases = sem.compases;
  fases.push({ nombre: "Semántico", estado: sem.errores.length ? "error" : "ok", ms: msSem });
  if (sem.errores.length) {
    omitirDesde(["Código intermedio", "Optimización", "Ejecución"]);
    return terminar();
  }

  // 4. Código intermedio (tres direcciones) a partir del AST ya validado
  const [tac, msTac] = medir(() => generarIntermedio(sin.ast));
  resultado.intermedio = tac;
  fases.push({ nombre: "Código intermedio", estado: "ok", ms: msTac });

  // 5. Optimización (sobre el AST; se regenera el código intermedio para comparar)
  const [opt, msOpt] = medir(() => optimizar(sin.ast));
  resultado.intermedioOptimizado = generarIntermedio(opt.ast);
  resultado.astOptimizado = opt.ast;
  resultado.optimizaciones = opt.cambios;
  resultado.metricas.nodosDespues = contarNodos(opt.ast);
  fases.push({ nombre: "Optimización", estado: "ok", ms: msOpt });

  // 6. Ejecución (también se ejecuta el otro árbol solo para comparar pasos)
  const programa = usarOptimizado ? opt.ast : sin.ast;
  const [ej, msEj] = medir(() => interpretar(programa));
  const otro = interpretar(usarOptimizado ? sin.ast : opt.ast);
  resultado.metricas.pasosAntes = usarOptimizado ? otro.pasos : ej.pasos;
  resultado.metricas.pasosDespues = usarOptimizado ? ej.pasos : otro.pasos;

  resultado.ejecucion = {
    comandos: ej.comandos,
    consola: ej.consola,
    pasos: ej.pasos,
    sonidos: ej.sonidos,
    marcasCompas: ej.marcasCompas,
    segundos: ej.segundos,
  };
  if (ej.error) errores.push(ej.error);
  const detalle = ej.sonidos.length ? `${ej.sonidos.length} notas, ${ej.segundos.toFixed(1)} s` : undefined;
  fases.push({ nombre: "Ejecución", estado: ej.error ? "error" : "ok", ms: msEj, detalle });
  return terminar();
}
