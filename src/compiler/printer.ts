// Impresor: convierte un AST de vuelta a código Trazo.
// Se usa en la pestaña Optimización para mostrar, lado a lado, el código antes
// y después de optimizar. Solo pone paréntesis donde la precedencia lo exige.

import type * as A from "./ast";
import { FIGURAS, nombreNota } from "./tokens";

const PRECEDENCIA: Record<A.OperadorBinario, number> = {
  o: 1,
  y: 2,
  "==": 3,
  "!=": 3,
  "<": 4,
  ">": 4,
  "<=": 4,
  ">=": 4,
  "+": 5,
  "-": 5,
  "*": 6,
  "/": 6,
  "%": 6,
};
const PREC_UNARIA = 7;

export function imprimirPrograma(p: A.Programa): string {
  return p.sentencias.map((s) => imprimirSentencia(s, 0)).join("\n");
}

function sangria(n: number) {
  return "  ".repeat(n);
}

function imprimirBloque(b: A.Bloque, nivel: number): string {
  if (b.sentencias.length === 0) return "{ }";
  const cuerpo = b.sentencias.map((s) => imprimirSentencia(s, nivel + 1)).join("\n");
  return `{\n${cuerpo}\n${sangria(nivel)}}`;
}

export function imprimirSentencia(s: A.Sentencia, nivel = 0): string {
  const i = sangria(nivel);
  switch (s.tipo) {
    case "DeclVar":
      return `${i}${s.tipoVar} ${s.nombre}${s.inicial ? " = " + imprimirExpresion(s.inicial) : ""};`;
    case "DeclFuncion": {
      const params = s.parametros.map((p) => `${p.tipoParam} ${p.nombre}`).join(", ");
      const tipo = s.tipoRetorno ? s.tipoRetorno + " " : "";
      return `${i}funcion ${tipo}${s.nombre}(${params}) ${imprimirBloque(s.cuerpo, nivel)}`;
    }
    case "Asignacion":
      return `${i}${s.nombre} = ${imprimirExpresion(s.valor)};`;
    case "Si":
      return i + imprimirSi(s, nivel);
    case "Mientras":
      return `${i}mientras (${imprimirExpresion(s.condicion)}) ${imprimirBloque(s.cuerpo, nivel)}`;
    case "Repetir":
      return `${i}repetir ${imprimirExpresion(s.veces)} veces ${imprimirBloque(s.cuerpo, nivel)}`;
    case "Retornar":
      return `${i}retornar${s.valor ? " " + imprimirExpresion(s.valor) : ""};`;
    case "LlamadaSent":
      return `${i}${imprimirExpresion(s.llamada)};`;
    case "Bloque":
      return i + imprimirBloque(s, nivel);
    case "Tempo":
      return `${i}tempo ${s.bpm};`;
    case "CompasDecl":
      return `${i}compas ${s.numerador}/${s.denominador};`;
    case "Tocar":
      return `${i}tocar ${imprimirExpresion(s.nota)} ${imprimirExpresion(s.duracion)};`;
    case "Silencio":
      return `${i}silencio ${imprimirExpresion(s.duracion)};`;
    case "Acorde":
      return `${i}acorde [${s.notas.map((n) => imprimirExpresion(n)).join(", ")}] ${imprimirExpresion(s.duracion)};`;
    case "BloqueCompas":
      return `${i}compas ${imprimirBloque(s.cuerpo, nivel)}`;
  }
}

/**
 * Una duración en tiempos → código, como suma de figuras de mayor a menor:
 * 2 → "blanca"; 1.5 → "negra + corchea"; 3 → "blanca + negra"; 8 → "redonda * 2".
 * Así cualquier duración plegada por el optimizador se puede volver a escribir.
 */
export function imprimirDuracion(tiempos: number): string {
  const redondas = Math.floor(tiempos / 4);
  let resto = tiempos - redondas * 4;
  const partes: string[] = [];
  if (redondas > 1) partes.push(`redonda * ${redondas}`);
  else if (redondas === 1) partes.push("redonda");
  for (const [nombre, valor] of Object.entries(FIGURAS)) {
    if (nombre === "redonda") continue;
    if (resto >= valor - 1e-9) {
      partes.push(nombre);
      resto -= valor;
    }
  }
  return partes.length ? partes.join(" + ") : "negra * 0";
}

function imprimirSi(s: A.Si, nivel: number): string {
  let r = `si (${imprimirExpresion(s.condicion)}) ${imprimirBloque(s.entonces, nivel)}`;
  if (s.sino) r += " sino " + (s.sino.tipo === "Si" ? imprimirSi(s.sino, nivel) : imprimirBloque(s.sino, nivel));
  return r;
}

export function imprimirLiteral(l: A.Literal): string {
  switch (l.tipoLiteral) {
    case "texto":
      return '"' + String(l.valor).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n") + '"';
    case "logico":
      return l.valor ? "verdadero" : "falso";
    case "decimal": {
      const n = l.valor as number;
      return Number.isInteger(n) ? n.toFixed(1) : String(n);
    }
    case "entero":
      return String(l.valor);
    case "nota":
      return nombreNota(l.valor as number);
    case "duracion":
      return imprimirDuracion(l.valor as number);
  }
}

/** `padre` es la precedencia del contexto; si la del nodo es menor, va entre paréntesis. */
export function imprimirExpresion(e: A.Expresion, padre = 0): string {
  switch (e.tipo) {
    case "Literal": {
      const r = imprimirLiteral(e);
      // Una duración compuesta ("negra + corchea") necesita paréntesis dentro de un producto
      return e.tipoLiteral === "duracion" && r.includes(" + ") && padre > PRECEDENCIA["+"] ? `(${r})` : r;
    }
    case "Identificador":
      return e.nombre;
    case "Llamada":
      return `${e.nombre}(${e.argumentos.map((a) => imprimirExpresion(a)).join(", ")})`;
    case "Unaria": {
      const sep = e.operador === "no" ? " " : "";
      const r = `${e.operador}${sep}${imprimirExpresion(e.operando, PREC_UNARIA)}`;
      return PREC_UNARIA < padre ? `(${r})` : r;
    }
    case "Binaria": {
      const p = PRECEDENCIA[e.operador];
      // Asociatividad izquierda: el hijo derecho con la misma precedencia necesita paréntesis
      const r = `${imprimirExpresion(e.izquierda, p)} ${e.operador} ${imprimirExpresion(e.derecha, p + 1)}`;
      return p < padre ? `(${r})` : r;
    }
  }
}
