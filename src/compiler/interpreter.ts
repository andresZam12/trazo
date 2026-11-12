// Intérprete de Trazo: recorre el AST (tree-walking) y lo ejecuta.
// No dibuja directamente: produce una lista de ComandoDibujo que el lienzo de la
// UI anima después. Así el compilador no depende de la interfaz y la animación
// se puede repetir o acelerar sin volver a ejecutar el programa.
//
// Usa los tipos que anotó el chequeador (`tipoDato`) para decidir, por ejemplo,
// si "/" es división entera (entero / entero) o decimal.

import type * as A from "./ast";
import { crearError, ErrorCompilacion } from "./errors";
import { aTexto, ComandoDibujo, crearAleatorio, ejecutarNativa, EstadoLapiz, FIRMAS_NATIVAS, lapizInicial } from "./natives";
import type { TipoTrazo } from "./semantic/types";

type Valor = number | string | boolean;

export const LIMITE_PASOS = 100_000;
export const LIMITE_RECURSION = 200;

export interface ResultadoEjecucion {
  comandos: ComandoDibujo[];
  consola: string[];
  pasos: number;
  error: ErrorCompilacion | null;
}

/** Error en tiempo de ejecución (división entre cero, bucle infinito...). */
class ErrorEjecucion extends Error {
  constructor(mensaje: string, readonly linea: number, readonly columna: number) {
    super(mensaje);
  }
}

/** Señal interna para salir de una función cuando se ejecuta `retornar`. */
class SenalRetorno {
  constructor(readonly valor: Valor | undefined) {}
}

/** Entorno de ejecución: variables de un ámbito, enlazado con el exterior. */
class Entorno {
  private valores = new Map<string, Valor>();
  constructor(readonly padre: Entorno | null) {}

  definir(nombre: string, valor: Valor) {
    this.valores.set(nombre, valor);
  }

  obtener(nombre: string): Valor | undefined {
    for (let e: Entorno | null = this; e; e = e.padre) {
      if (e.valores.has(nombre)) return e.valores.get(nombre);
    }
    return undefined;
  }

  asignar(nombre: string, valor: Valor): boolean {
    for (let e: Entorno | null = this; e; e = e.padre) {
      if (e.valores.has(nombre)) {
        e.valores.set(nombre, valor);
        return true;
      }
    }
    return false;
  }
}

const NATIVAS = new Set(FIRMAS_NATIVAS.map((f) => f.nombre));

export class Interprete {
  private comandos: ComandoDibujo[] = [];
  private consola: string[] = [];
  private pasos = 0;
  private profundidad = 0;
  private funciones = new Map<string, A.DeclFuncion>();
  private lapiz: EstadoLapiz = lapizInicial();
  private aleatorio = crearAleatorio();
  private global = new Entorno(null);

  ejecutar(programa: A.Programa): ResultadoEjecucion {
    // Las funciones se registran primero: se pueden llamar antes de declararse
    for (const s of programa.sentencias) if (s.tipo === "DeclFuncion") this.funciones.set(s.nombre, s);
    let error: ErrorCompilacion | null = null;
    try {
      this.sentencias(programa.sentencias, this.global);
    } catch (e) {
      if (e instanceof ErrorEjecucion) {
        error = crearError("Ejecución", e.message, e.linea, e.columna);
      } else if (e instanceof SenalRetorno) {
        // retornar fuera de función ya lo rechaza el chequeador; aquí solo termina
      } else {
        throw e;
      }
    }
    return { comandos: this.comandos, consola: this.consola, pasos: this.pasos, error };
  }

  /** Cada sentencia ejecutada cuenta un paso; así se detectan bucles infinitos. */
  private contarPaso(nodo: { linea: number; columna: number }) {
    this.pasos++;
    if (this.pasos > LIMITE_PASOS) {
      throw new ErrorEjecucion(
        `se superó el límite de ${LIMITE_PASOS.toLocaleString("es-CO")} pasos: posible bucle infinito`,
        nodo.linea,
        nodo.columna,
      );
    }
  }

  // ---------------- sentencias ----------------

  private sentencias(lista: A.Sentencia[], entorno: Entorno) {
    for (const s of lista) this.sentencia(s, entorno);
  }

  private sentencia(s: A.Sentencia, entorno: Entorno) {
    if (s.tipo === "DeclFuncion") return; // ya registrada
    this.contarPaso(s);
    switch (s.tipo) {
      case "DeclVar":
        if (s.inicial) entorno.definir(s.nombre, this.expresion(s.inicial, entorno));
        else entorno.definir(s.nombre, valorPorDefecto(s.tipoVar));
        return;
      case "Asignacion":
        entorno.asignar(s.nombre, this.expresion(s.valor, entorno));
        return;
      case "Si": {
        if (this.expresion(s.condicion, entorno) === true) this.bloque(s.entonces, entorno);
        else if (s.sino) {
          if (s.sino.tipo === "Si") this.sentencia(s.sino, entorno);
          else this.bloque(s.sino, entorno);
        }
        return;
      }
      case "Mientras":
        while (this.expresion(s.condicion, entorno) === true) {
          this.bloque(s.cuerpo, entorno);
          this.contarPaso(s);
        }
        return;
      case "Repetir": {
        const n = this.expresion(s.veces, entorno) as number;
        for (let i = 0; i < n; i++) {
          this.bloque(s.cuerpo, entorno);
          this.contarPaso(s);
        }
        return;
      }
      case "Retornar":
        throw new SenalRetorno(s.valor ? this.expresion(s.valor, entorno) : undefined);
      case "LlamadaSent":
        this.llamada(s.llamada, entorno);
        return;
      case "Bloque":
        this.bloque(s, entorno);
        return;
    }
  }

  /** Un bloque crea un entorno nuevo, igual que en el chequeador crea un ámbito. */
  private bloque(b: A.Bloque, entorno: Entorno) {
    this.sentencias(b.sentencias, new Entorno(entorno));
  }

  // ---------------- expresiones ----------------

  private expresion(e: A.Expresion, entorno: Entorno): Valor {
    switch (e.tipo) {
      case "Literal":
        return e.valor;
      case "Identificador": {
        const v = entorno.obtener(e.nombre);
        if (v === undefined) throw new ErrorEjecucion(`la variable '${e.nombre}' no tiene valor`, e.linea, e.columna);
        return v;
      }
      case "Unaria": {
        const v = this.expresion(e.operando, entorno);
        return e.operador === "-" ? -(v as number) : !(v as boolean);
      }
      case "Binaria":
        return this.binaria(e, entorno);
      case "Llamada": {
        const v = this.llamada(e, entorno);
        if (v === undefined) throw new ErrorEjecucion(`la función '${e.nombre}' no retornó ningún valor`, e.linea, e.columna);
        return v;
      }
    }
  }

  private binaria(e: A.Binaria, entorno: Entorno): Valor {
    // y / o con cortocircuito: la derecha solo se evalúa si hace falta
    if (e.operador === "y") return this.expresion(e.izquierda, entorno) === true && this.expresion(e.derecha, entorno) === true;
    if (e.operador === "o") return this.expresion(e.izquierda, entorno) === true || this.expresion(e.derecha, entorno) === true;

    const a = this.expresion(e.izquierda, entorno);
    const b = this.expresion(e.derecha, entorno);
    return aplicarBinaria(e.operador, a, b, e.izquierda.tipoDato, e.derecha.tipoDato, e);
  }

  /** Llamada a una nativa o a una función del usuario. */
  private llamada(e: A.Llamada, entorno: Entorno): Valor | undefined {
    const args = e.argumentos.map((a) => this.expresion(a, entorno));

    if (NATIVAS.has(e.nombre) && !this.funciones.has(e.nombre)) {
      // mostrar() usa el tipo estático para escribir 2.0 y no 2 cuando es decimal
      if (e.nombre === "mostrar") {
        this.consola.push(textoTipado(args[0], e.argumentos[0]?.tipoDato));
        return undefined;
      }
      const r = ejecutarNativa(e.nombre, args, this.lapiz, this.comandos, this.consola, this.aleatorio, e.linea);
      if (r.error) throw new ErrorEjecucion(r.error, e.linea, e.columna);
      return r.valor;
    }

    const f = this.funciones.get(e.nombre);
    if (!f) throw new ErrorEjecucion(`la función '${e.nombre}' no existe`, e.linea, e.columna);

    this.profundidad++;
    if (this.profundidad > LIMITE_RECURSION) {
      throw new ErrorEjecucion(`recursión demasiado profunda: se superaron ${LIMITE_RECURSION} llamadas anidadas a funciones`, e.linea, e.columna);
    }
    // El entorno de la función cuelga del GLOBAL (ámbito léxico), no del que llama
    const local = new Entorno(this.global);
    f.parametros.forEach((p, i) => local.definir(p.nombre, args[i]));
    try {
      this.bloque(f.cuerpo, local);
      return undefined;
    } catch (r) {
      if (r instanceof SenalRetorno) return r.valor;
      throw r;
    } finally {
      this.profundidad--;
    }
  }
}

/**
 * Evalúa un operador binario sobre dos valores ya calculados. Está separada para
 * que el optimizador la reutilice al plegar constantes: así el resultado plegado
 * es exactamente el mismo que daría la ejecución.
 */
export function aplicarBinaria(
  op: A.OperadorBinario,
  a: Valor,
  b: Valor,
  tipoA: TipoTrazo | undefined,
  tipoB: TipoTrazo | undefined,
  nodo: { linea: number; columna: number },
): Valor {
  switch (op) {
    case "+":
      if (typeof a === "string" || typeof b === "string") return textoTipado(a, tipoA) + textoTipado(b, tipoB);
      return (a as number) + (b as number);
    case "-": return (a as number) - (b as number);
    case "*": return (a as number) * (b as number);
    case "/": {
      if (b === 0) throw new ErrorEjecucion("división entre cero", nodo.linea, nodo.columna);
      const r = (a as number) / (b as number);
      return tipoA === "entero" && tipoB === "entero" ? Math.trunc(r) : r;
    }
    case "%":
      if (b === 0) throw new ErrorEjecucion("módulo entre cero (% 0)", nodo.linea, nodo.columna);
      return (a as number) % (b as number);
    case "==": return a === b;
    case "!=": return a !== b;
    case "<": return (a as number) < (b as number);
    case ">": return (a as number) > (b as number);
    case "<=": return (a as number) <= (b as number);
    case ">=": return (a as number) >= (b as number);
    case "y": return a === true && b === true;
    case "o": return a === true || b === true;
  }
}

/** Convierte a texto respetando el tipo: un decimal entero se escribe "2.0". */
export function textoTipado(v: Valor | undefined, t: TipoTrazo | undefined): string {
  if (t === "decimal" && typeof v === "number" && Number.isInteger(v)) return v.toFixed(1);
  return aTexto(v);
}

function valorPorDefecto(t: A.TipoDeclarado): Valor {
  switch (t) {
    case "entero":
    case "decimal": return 0;
    case "texto": return "";
    case "logico": return false;
  }
}

export { ErrorEjecucion };

export function interpretar(programa: A.Programa): ResultadoEjecucion {
  return new Interprete().ejecutar(programa);
}
