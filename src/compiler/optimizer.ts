// Optimizador de Trazo: transforma el AST en otro equivalente pero más simple.
// Trabaja sobre una copia (el AST original se conserva para compararlo en la UI)
// y aplica las reglas hasta que ninguna cambie nada (punto fijo).
//
// Reglas:
//  1. Plegado de constantes: 2 * 3 + 1 → 7 ; "a" + "b" → "ab"
//  2. Propagación de constantes: variables asignadas una sola vez con un literal
//  3. Eliminación de código muerto: si (falso), si (verdadero), mientras (falso),
//     código después de retornar
//  4. Simplificación algebraica: x * 1 → x, x + 0 → x, x * 0 → 0, no no x → x
//
// Seguridad: solo se pliega lo que se puede calcular sin ejecutar el programa
// (literales), nunca se elimina una expresión que contiene una llamada (podría
// dibujar o escribir en consola) y nunca se cambia el tipo de una expresión.

import type * as A from "./ast";
import { aplicarBinaria, ErrorEjecucion } from "./interpreter";
import { imprimirExpresion, imprimirSentencia } from "./printer";
import { siempreRetorna } from "./semantic/checker";
import type { TipoTrazo } from "./semantic/types";

export type ReglaOptimizacion =
  | "Plegado de constantes"
  | "Propagación de constantes"
  | "Eliminación de código muerto"
  | "Simplificación algebraica";

export interface CambioOptimizacion {
  regla: ReglaOptimizacion;
  linea: number;
  antes: string;
  despues: string;
}

export interface ResultadoOptimizacion {
  ast: A.Programa;
  cambios: CambioOptimizacion[];
}

const MAX_ITERACIONES = 20;

export class Optimizador {
  private cambios: CambioOptimizacion[] = [];
  private huboCambio = false;
  /** Variables constantes encontradas: nombre → literal con que se inicializan. */
  private constantes = new Map<string, A.Literal>();

  optimizar(original: A.Programa): ResultadoOptimizacion {
    const ast = structuredClone(original);
    for (let i = 0; i < MAX_ITERACIONES; i++) {
      this.huboCambio = false;
      this.constantes = buscarConstantes(ast);
      ast.sentencias = this.sentencias(ast.sentencias, true);
      if (!this.huboCambio) break;
    }
    return { ast, cambios: this.cambios };
  }

  private registrar(regla: ReglaOptimizacion, linea: number, antes: string, despues: string) {
    this.huboCambio = true;
    if (antes !== despues) this.cambios.push({ regla, linea, antes, despues });
  }

  // ---------------- sentencias ----------------

  /** Optimiza una lista de sentencias; quita el código inalcanzable tras un retorno. */
  private sentencias(lista: A.Sentencia[], nivelPrincipal = false): A.Sentencia[] {
    const resultado: A.Sentencia[] = [];
    for (let i = 0; i < lista.length; i++) {
      const nueva = this.sentencia(lista[i]);
      if (nueva) resultado.push(nueva);
      if (nueva && !nivelPrincipal && siempreRetorna(nueva) && i < lista.length - 1) {
        const muertas = lista.slice(i + 1);
        this.registrar(
          "Eliminación de código muerto",
          muertas[0].linea,
          muertas.map((s) => imprimirSentencia(s).trim()).join(" "),
          "(eliminado: está después de retornar)",
        );
        break;
      }
    }
    return resultado;
  }

  private bloque(b: A.Bloque): A.Bloque {
    return { ...b, sentencias: this.sentencias(b.sentencias) };
  }

  /** Devuelve la sentencia optimizada, o null si se elimina. */
  private sentencia(s: A.Sentencia): A.Sentencia | null {
    switch (s.tipo) {
      case "DeclVar": {
        // Si la variable se propagó como constante, su declaración ya no hace falta
        if (this.constantes.has(s.nombre) && s.inicial?.tipo === "Literal") {
          this.registrar("Propagación de constantes", s.linea, imprimirSentencia(s), "(declaración eliminada: su valor se propagó)");
          return null;
        }
        return { ...s, inicial: s.inicial ? this.expresion(s.inicial) : null };
      }
      case "DeclFuncion":
        return { ...s, cuerpo: this.bloque(s.cuerpo) };
      case "Asignacion":
        return { ...s, valor: this.expresion(s.valor) };
      case "Retornar":
        return { ...s, valor: s.valor ? this.expresion(s.valor) : null };
      case "LlamadaSent":
        return { ...s, llamada: this.expresion(s.llamada) as A.Llamada };
      case "Bloque":
        return this.bloque(s);
      case "Si": {
        const condicion = this.expresion(s.condicion);
        if (condicion.tipo === "Literal") {
          // La condición se conoce en tiempo de compilación: una rama es código muerto
          if (condicion.valor === true) {
            this.registrar("Eliminación de código muerto", s.linea, resumenSi(s), "(se conserva solo la rama 'si')");
            return this.bloque(s.entonces);
          }
          if (!s.sino) {
            this.registrar("Eliminación de código muerto", s.linea, resumenSi(s), "(eliminado: la condición siempre es falsa)");
            return null;
          }
          this.registrar("Eliminación de código muerto", s.linea, resumenSi(s), "(se conserva solo la rama 'sino')");
          return s.sino.tipo === "Si" ? this.sentencia(s.sino) : this.bloque(s.sino);
        }
        const sino = s.sino ? (s.sino.tipo === "Si" ? this.sentencia(s.sino) : this.bloque(s.sino)) : null;
        return { ...s, condicion, entonces: this.bloque(s.entonces), sino: sino as A.Bloque | A.Si | null };
      }
      case "Mientras": {
        const condicion = this.expresion(s.condicion);
        if (condicion.tipo === "Literal" && condicion.valor === false) {
          this.registrar("Eliminación de código muerto", s.linea, `mientras (${imprimirExpresion(s.condicion)}) { ... }`, "(eliminado: nunca se ejecuta)");
          return null;
        }
        return { ...s, condicion, cuerpo: this.bloque(s.cuerpo) };
      }
      case "Repetir": {
        const veces = this.expresion(s.veces);
        if (veces.tipo === "Literal" && (veces.valor as number) <= 0) {
          this.registrar("Eliminación de código muerto", s.linea, `repetir ${imprimirExpresion(s.veces)} veces { ... }`, "(eliminado: se repite 0 veces)");
          return null;
        }
        return { ...s, veces, cuerpo: this.bloque(s.cuerpo) };
      }
    }
  }

  // ---------------- expresiones (de abajo hacia arriba) ----------------

  private expresion(e: A.Expresion): A.Expresion {
    switch (e.tipo) {
      case "Literal":
        return e;
      case "Identificador": {
        const c = this.constantes.get(e.nombre);
        if (!c) return e;
        const nuevo = literal(c.valor, c.tipoLiteral, e);
        this.registrar("Propagación de constantes", e.linea, e.nombre, imprimirExpresion(nuevo));
        return nuevo;
      }
      case "Llamada":
        return { ...e, argumentos: e.argumentos.map((a) => this.expresion(a)) };
      case "Unaria": {
        const operando = this.expresion(e.operando);
        const nodo: A.Unaria = { ...e, operando };
        if (operando.tipo === "Literal") {
          const valor = e.operador === "-" ? -(operando.valor as number) : !(operando.valor as boolean);
          const nuevo = literal(valor, operando.tipoLiteral, e);
          this.registrar("Plegado de constantes", e.linea, imprimirExpresion(nodo), imprimirExpresion(nuevo));
          return nuevo;
        }
        // no no x → x
        if (e.operador === "no" && operando.tipo === "Unaria" && operando.operador === "no") {
          this.registrar("Simplificación algebraica", e.linea, imprimirExpresion(nodo), imprimirExpresion(operando.operando));
          return operando.operando;
        }
        return nodo;
      }
      case "Binaria": {
        const izquierda = this.expresion(e.izquierda);
        const derecha = this.expresion(e.derecha);
        const nodo: A.Binaria = { ...e, izquierda, derecha };
        const plegado = this.plegar(nodo);
        if (plegado) return plegado;
        return this.simplificar(nodo);
      }
    }
  }

  /** Plegado: si ambos lados son literales, se calcula el resultado ahora. */
  private plegar(e: A.Binaria): A.Expresion | null {
    const { izquierda: a, derecha: b } = e;
    if (a.tipo !== "Literal" || b.tipo !== "Literal") return null;
    let valor;
    try {
      valor = aplicarBinaria(e.operador, a.valor, b.valor, a.tipoLiteral, b.tipoLiteral, e);
    } catch (err) {
      // 5 / 0 no se pliega: se deja para que falle en ejecución con su mensaje
      if (err instanceof ErrorEjecucion) return null;
      throw err;
    }
    let tipo: A.TipoDeclarado;
    if (typeof valor === "boolean") tipo = "logico";
    else if (typeof valor === "string") tipo = "texto";
    else tipo = a.tipoLiteral === "decimal" || b.tipoLiteral === "decimal" ? "decimal" : "entero";
    const nuevo = literal(valor, tipo, e);
    this.registrar("Plegado de constantes", e.linea, imprimirExpresion(e), imprimirExpresion(nuevo));
    return nuevo;
  }

  /** Identidades algebraicas. Solo se aplican si no cambian el tipo del resultado. */
  private simplificar(e: A.Binaria): A.Expresion {
    const { izquierda: a, derecha: b, operador: op } = e;
    const esNum = (x: A.Expresion, n: number) => x.tipo === "Literal" && typeof x.valor === "number" && x.valor === n;
    const tipoE = tipoDeExpr(e);
    const reemplazar = (por: A.Expresion) => {
      // x * 1.0 con x entero da decimal: reemplazarlo por x cambiaría el tipo
      if (tipoDeExpr(por) !== tipoE) return e;
      this.registrar("Simplificación algebraica", e.linea, imprimirExpresion(e), imprimirExpresion(por));
      return por;
    };

    if (op === "*") {
      if (esNum(b, 1)) return reemplazar(a);
      if (esNum(a, 1)) return reemplazar(b);
      if (esNum(b, 0) && !tieneEfectos(a)) return reemplazar(literal(0, tipoE === "decimal" ? "decimal" : "entero", e));
      if (esNum(a, 0) && !tieneEfectos(b)) return reemplazar(literal(0, tipoE === "decimal" ? "decimal" : "entero", e));
    }
    if (op === "+" && tipoE !== "texto") {
      if (esNum(b, 0)) return reemplazar(a);
      if (esNum(a, 0)) return reemplazar(b);
    }
    if (op === "-" && esNum(b, 0)) return reemplazar(a);
    if (op === "/" && esNum(b, 1)) return reemplazar(a);
    return e;
  }
}

// ---------------- utilidades ----------------

function literal(valor: number | string | boolean, tipo: A.TipoDeclarado, en: { linea: number; columna: number }): A.Literal {
  return { tipo: "Literal", valor, tipoLiteral: tipo, tipoDato: tipo, linea: en.linea, columna: en.columna };
}

/** Tipo de una expresión: el anotado por el chequeador o, para literales, el suyo. */
function tipoDeExpr(e: A.Expresion): TipoTrazo | undefined {
  if (e.tipo === "Literal") return e.tipoLiteral;
  return e.tipoDato;
}

/** ¿La expresión contiene alguna llamada? (podría dibujar o escribir: no se puede borrar) */
function tieneEfectos(e: A.Expresion): boolean {
  switch (e.tipo) {
    case "Llamada": return true;
    case "Binaria": return tieneEfectos(e.izquierda) || tieneEfectos(e.derecha);
    case "Unaria": return tieneEfectos(e.operando);
    default: return false;
  }
}

function resumenSi(s: A.Si): string {
  return `si (${imprimirExpresion(s.condicion)}) { ... }${s.sino ? " sino { ... }" : ""}`;
}

/**
 * Busca variables que se pueden propagar: declaradas una sola vez en todo el
 * programa (sin parámetros ni otras declaraciones con el mismo nombre, para no
 * confundir ámbitos), inicializadas con un literal y nunca reasignadas.
 */
function buscarConstantes(p: A.Programa): Map<string, A.Literal> {
  const declaraciones = new Map<string, A.DeclVar[]>();
  const asignadas = new Set<string>();
  const parametros = new Set<string>();

  const visitar = (s: A.Sentencia) => {
    switch (s.tipo) {
      case "DeclVar":
        declaraciones.set(s.nombre, [...(declaraciones.get(s.nombre) ?? []), s]);
        break;
      case "Asignacion":
        asignadas.add(s.nombre);
        break;
      case "DeclFuncion":
        s.parametros.forEach((x) => parametros.add(x.nombre));
        s.cuerpo.sentencias.forEach(visitar);
        break;
      case "Bloque":
        s.sentencias.forEach(visitar);
        break;
      case "Si":
        s.entonces.sentencias.forEach(visitar);
        if (s.sino) visitar(s.sino);
        break;
      case "Mientras":
      case "Repetir":
        s.cuerpo.sentencias.forEach(visitar);
        break;
    }
  };
  p.sentencias.forEach(visitar);

  const constantes = new Map<string, A.Literal>();
  for (const [nombre, decls] of declaraciones) {
    if (decls.length !== 1 || asignadas.has(nombre) || parametros.has(nombre)) continue;
    const ini = decls[0].inicial;
    if (ini?.tipo !== "Literal") continue;
    // Un entero guardado en una variable decimal se propaga como decimal
    const tipo = decls[0].tipoVar;
    constantes.set(nombre, { ...ini, tipoLiteral: tipo, tipoDato: tipo });
  }
  return constantes;
}

export function optimizar(programa: A.Programa): ResultadoOptimizacion {
  return new Optimizador().optimizar(programa);
}
