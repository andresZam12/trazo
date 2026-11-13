// Intérprete de Trazo: recorre el AST (tree-walking) y lo ejecuta.
// No dibuja directamente: produce una lista de ComandoDibujo que el lienzo de la
// UI anima después. Así el compilador no depende de la interfaz y la animación
// se puede repetir o acelerar sin volver a ejecutar el programa.
//
// Usa los tipos que anotó el chequeador (`tipoDato`) para decidir, por ejemplo,
// si "/" es división entera (entero / entero) o decimal.

import type * as A from "./ast";
import { crearError, ErrorCompilacion } from "./errors";
import {
  aTexto,
  ComandoDibujo,
  crearAleatorio,
  ejecutarNativa,
  EstadoLapiz,
  EventoSonido,
  FIRMAS_NATIVAS,
  frecuenciaDe,
  Instrumento,
  INSTRUMENTOS,
  lapizInicial,
  MarcaCompas,
} from "./natives";
import type { TipoTrazo } from "./semantic/types";
import { nombreNota } from "./tokens";
import { imprimirDuracion } from "./printer";

type Valor = number | string | boolean;

export const LIMITE_PASOS = 100_000;
export const LIMITE_RECURSION = 200;

/** Píxeles que avanza el lápiz por cada tiempo y por cada semitono con dibujar_melodia. */
const PX_POR_TIEMPO = 32;
const PX_POR_SEMITONO = 7;

const redondear = (n: number) => Math.round(n * 1000) / 1000;

export interface ResultadoEjecucion {
  comandos: ComandoDibujo[];
  consola: string[];
  pasos: number;
  error: ErrorCompilacion | null;
  sonidos: EventoSonido[];
  marcasCompas: MarcaCompas[];
  /** Duración total de la música en segundos. */
  segundos: number;
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
  // Estado musical
  private sonidos: EventoSonido[] = [];
  private marcasCompas: MarcaCompas[] = [];
  private segundos = 0;
  private bpm = 100;
  private instrumento: Instrumento = "piano";
  private volumen = 0.8;
  private dibujarMelodia = false;

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
    return {
      comandos: this.comandos,
      consola: this.consola,
      pasos: this.pasos,
      error,
      sonidos: this.sonidos,
      marcasCompas: this.marcasCompas,
      segundos: redondear(this.segundos),
    };
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
      case "Tempo":
        this.bpm = s.bpm;
        return;
      case "CompasDecl":
        return; // la métrica solo se usa al validar, en el chequeador
      case "BloqueCompas":
        this.marcasCompas.push({ numero: s.numero ?? 0, inicio: redondear(this.segundos), linea: s.linea });
        this.bloque(s.cuerpo, entorno);
        return;
      case "Tocar": {
        const midi = this.expresion(s.nota, entorno) as number;
        const tiempos = this.expresion(s.duracion, entorno) as number;
        this.sonar([midi], tiempos, s);
        return;
      }
      case "Acorde": {
        const notas = s.notas.map((n) => this.expresion(n, entorno) as number);
        const tiempos = this.expresion(s.duracion, entorno) as number;
        this.sonar(notas, tiempos, s);
        return;
      }
      case "Silencio": {
        const tiempos = this.expresion(s.duracion, entorno) as number;
        if (this.dibujarMelodia) this.moverLapizMelodia(null, tiempos, s.linea);
        this.segundos += this.aSegundos(tiempos);
        return;
      }
    }
  }

  // ---------------- música ----------------

  /** Una negra dura 60 / tempo segundos. */
  private aSegundos(tiempos: number): number {
    return (tiempos * 60) / this.bpm;
  }

  /** Programa una o varias notas al mismo tiempo (un acorde) y avanza el reloj. */
  private sonar(notas: number[], tiempos: number, nodo: { linea: number; columna: number }) {
    if (tiempos <= 0) throw new ErrorEjecucion(`la duración debe ser mayor que cero`, nodo.linea, nodo.columna);
    const duracion = this.aSegundos(tiempos);
    for (const midi of notas) {
      if (midi < 0 || midi > 127) throw new ErrorEjecucion(`nota fuera del rango MIDI 0 a 127 (da ${midi})`, nodo.linea, nodo.columna);
      this.sonidos.push({
        midi,
        frecuencia: redondear(frecuenciaDe(midi)),
        inicio: redondear(this.segundos),
        duracion: redondear(duracion),
        linea: nodo.linea,
        instrumento: this.instrumento,
        volumen: this.volumen,
      });
    }
    if (this.dibujarMelodia) this.moverLapizMelodia(notas[0], tiempos, nodo.linea);
    this.segundos += duracion;
  }

  /**
   * "La melodía dibuja su forma": cada nota avanza el lápiz hacia la derecha según su
   * duración y lo pone a una altura según la nota (do4 en la altura 0). Un silencio
   * avanza sin dibujar.
   */
  private moverLapizMelodia(midi: number | null, tiempos: number, linea: number) {
    const x = redondear(this.lapiz.x + tiempos * PX_POR_TIEMPO);
    const y = midi === null ? this.lapiz.y : redondear((midi - 60) * PX_POR_SEMITONO);
    if (midi !== null && this.lapiz.abajo) {
      this.comandos.push({ tipo: "linea", x1: this.lapiz.x, y1: this.lapiz.y, x2: x, y2: y, color: this.lapiz.color, grosor: this.lapiz.grosor, angulo: this.lapiz.angulo, linea });
    } else {
      this.comandos.push({ tipo: "mover", x, y, angulo: this.lapiz.angulo, linea });
    }
    this.lapiz.x = x;
    this.lapiz.y = y;
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
      // Nativas musicales: cambian el estado del intérprete, no el lápiz
      if (e.nombre === "instrumento") {
        const nombre = String(args[0]).trim().toLowerCase();
        if (!(INSTRUMENTOS as readonly string[]).includes(nombre)) {
          throw new ErrorEjecucion(`instrumento desconocido '${args[0]}'. Usa "piano", "organo", "flauta" u "8bit"`, e.linea, e.columna);
        }
        this.instrumento = nombre as Instrumento;
        return undefined;
      }
      if (e.nombre === "volumen") {
        const v = args[0] as number;
        if (v < 0 || v > 1) throw new ErrorEjecucion(`el volumen va de 0 a 1 (se recibió ${v})`, e.linea, e.columna);
        this.volumen = v;
        return undefined;
      }
      if (e.nombre === "dibujar_melodia") {
        this.dibujarMelodia = args[0] === true;
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
  // Una transposición (nota ± entero) debe quedar dentro del rango MIDI
  const enRango = (v: number) => {
    if (v < 0 || v > 127) throw new ErrorEjecucion(`la nota queda fuera del rango MIDI 0 a 127 (da ${v})`, nodo.linea, nodo.columna);
    return v;
  };
  switch (op) {
    case "+": {
      if (typeof a === "string" || typeof b === "string") return textoTipado(a, tipoA) + textoTipado(b, tipoB);
      const r = (a as number) + (b as number);
      return tipoA === "nota" || tipoB === "nota" ? enRango(r) : r;
    }
    case "-": {
      const r = (a as number) - (b as number);
      return tipoA === "nota" && tipoB !== "nota" ? enRango(r) : r;
    }
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
  // Las notas y duraciones son números por dentro, pero se muestran con su nombre
  if (t === "nota" && typeof v === "number") return nombreNota(v);
  if (t === "duracion" && typeof v === "number") return imprimirDuracion(v);
  return aTexto(v);
}

function valorPorDefecto(t: A.TipoDeclarado): Valor {
  switch (t) {
    case "entero":
    case "decimal": return 0;
    case "texto": return "";
    case "logico": return false;
    case "nota": return 60; // do4
    case "duracion": return 1; // negra
  }
}

export { ErrorEjecucion };

export function interpretar(programa: A.Programa): ResultadoEjecucion {
  return new Interprete().ejecutar(programa);
}
