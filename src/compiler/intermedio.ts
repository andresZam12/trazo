// Generación de código intermedio: código de tres direcciones (TAC).
//
// El AST es cómodo para analizar, pero tiene expresiones anidadas y estructuras
// (si, mientras, repetir) que una máquina no entiende. El código intermedio
// "aplana" el árbol en una lista de instrucciones simples:
//   - cada instrucción tiene como máximo un operador y tres direcciones
//     (dos operandos y un destino):  t2 = t1 * 3
//   - los resultados parciales van a temporales t1, t2, t3...
//   - las estructuras de control se vuelven etiquetas (L1:) y saltos
//     (ir_a L1, si_falso t3 ir_a L2).
// Es el paso que en un compilador completo viene antes de generar código de
// máquina. Aquí solo se genera y se muestra: la ejecución sigue en el intérprete.

import type * as A from "./ast";
import { imprimirLiteral } from "./printer";

export type ClaseInstruccion = "asignacion" | "etiqueta" | "salto" | "llamada" | "funcion" | "musica";

export interface InstruccionIntermedia {
  /** Texto de la instrucción, por ejemplo "t2 = t1 * 3" o "si_falso t3 ir_a L2". */
  codigo: string;
  clase: ClaseInstruccion;
  /** Línea y columna del código fuente que la produjo (para resaltarla en el editor). */
  linea: number;
  columna: number;
}

export interface ResultadoIntermedio {
  instrucciones: InstruccionIntermedia[];
  temporales: number;
  etiquetas: number;
}

class GeneradorIntermedio {
  private salida: InstruccionIntermedia[] = [];
  private nTemporales = 0;
  private nEtiquetas = 0;

  generar(p: A.Programa): ResultadoIntermedio {
    // Primero el programa principal y después cada función, como en un archivo
    // objeto: el código "suelto" termina en `fin` para no caer dentro de una función.
    const funciones = p.sentencias.filter((s): s is A.DeclFuncion => s.tipo === "DeclFuncion");
    for (const s of p.sentencias) if (s.tipo !== "DeclFuncion") this.sentencia(s);
    this.emitir("fin", "salto", p);
    for (const f of funciones) this.funcion(f);
    return { instrucciones: this.salida, temporales: this.nTemporales, etiquetas: this.nEtiquetas };
  }

  private emitir(codigo: string, clase: ClaseInstruccion, nodo: { linea: number; columna: number }) {
    this.salida.push({ codigo, clase, linea: nodo.linea, columna: nodo.columna });
  }

  private nuevoTemporal(): string {
    return `t${++this.nTemporales}`;
  }

  private nuevaEtiqueta(): string {
    return `L${++this.nEtiquetas}`;
  }

  private etiqueta(nombre: string, nodo: A.Nodo) {
    this.emitir(`${nombre}:`, "etiqueta", nodo);
  }

  private funcion(f: A.DeclFuncion) {
    this.emitir(`funcion ${f.nombre}(${f.parametros.map((p) => p.nombre).join(", ")}):`, "funcion", f);
    this.bloque(f.cuerpo);
    // Si la función no termina con retornar, se agrega uno implícito
    const ultima = f.cuerpo.sentencias[f.cuerpo.sentencias.length - 1];
    if (ultima?.tipo !== "Retornar") this.emitir("retornar", "salto", f);
    this.emitir(`fin_funcion ${f.nombre}`, "funcion", f);
  }

  private bloque(b: A.Bloque) {
    for (const s of b.sentencias) this.sentencia(s);
  }

  private sentencia(s: A.Sentencia): void {
    switch (s.tipo) {
      case "DeclVar":
        // Una declaración sin valor no genera instrucciones: solo reserva el nombre
        if (s.inicial) this.emitir(`${s.nombre} = ${this.expresion(s.inicial)}`, "asignacion", s);
        return;
      case "Asignacion":
        this.emitir(`${s.nombre} = ${this.expresion(s.valor)}`, "asignacion", s);
        return;
      case "LlamadaSent":
        this.llamada(s.llamada, false);
        return;
      case "Bloque":
        return this.bloque(s);
      case "DeclFuncion":
        // Las funciones anidadas no existen en la gramática; las de nivel superior se generan aparte
        return;
      case "Retornar":
        this.emitir(s.valor ? `retornar ${this.expresion(s.valor)}` : "retornar", "salto", s);
        return;
      case "Si":
        return this.si(s);
      case "Mientras": {
        //  Linicio:  t = condición ; si_falso t ir_a Lfin ; cuerpo ; ir_a Linicio ; Lfin:
        const inicio = this.nuevaEtiqueta();
        const fin = this.nuevaEtiqueta();
        this.etiqueta(inicio, s);
        this.emitir(`si_falso ${this.expresion(s.condicion)} ir_a ${fin}`, "salto", s);
        this.bloque(s.cuerpo);
        this.emitir(`ir_a ${inicio}`, "salto", s);
        this.etiqueta(fin, s);
        return;
      }
      case "Repetir": {
        // repetir n veces se traduce como un mientras con un contador oculto
        const limite = this.nuevoTemporal();
        const contador = this.nuevoTemporal();
        const inicio = this.nuevaEtiqueta();
        const fin = this.nuevaEtiqueta();
        this.emitir(`${limite} = ${this.expresion(s.veces)}`, "asignacion", s);
        this.emitir(`${contador} = 0`, "asignacion", s);
        this.etiqueta(inicio, s);
        const cond = this.nuevoTemporal();
        this.emitir(`${cond} = ${contador} < ${limite}`, "asignacion", s);
        this.emitir(`si_falso ${cond} ir_a ${fin}`, "salto", s);
        this.bloque(s.cuerpo);
        this.emitir(`${contador} = ${contador} + 1`, "asignacion", s);
        this.emitir(`ir_a ${inicio}`, "salto", s);
        this.etiqueta(fin, s);
        return;
      }
      case "Tempo":
        this.emitir(`tempo ${s.bpm}`, "musica", s);
        return;
      case "CompasDecl":
        this.emitir(`metrica ${s.numerador}/${s.denominador}`, "musica", s);
        return;
      case "Tocar": {
        const n = this.expresion(s.nota);
        const d = this.expresion(s.duracion);
        this.emitir(`tocar ${n}, ${d}`, "musica", s);
        return;
      }
      case "Silencio":
        this.emitir(`silencio ${this.expresion(s.duracion)}`, "musica", s);
        return;
      case "Acorde": {
        const notas = s.notas.map((n) => this.expresion(n));
        const d = this.expresion(s.duracion);
        this.emitir(`acorde [${notas.join(", ")}], ${d}`, "musica", s);
        return;
      }
      case "BloqueCompas":
        this.emitir(`inicio_compas ${s.numero ?? ""}`.trim(), "musica", s);
        this.bloque(s.cuerpo);
        this.emitir(`fin_compas ${s.numero ?? ""}`.trim(), "musica", s);
        return;
    }
  }

  //  t = condición ; si_falso t ir_a Lsino ; entonces ; ir_a Lfin ; Lsino: ; sino ; Lfin:
  private si(s: A.Si) {
    const cond = this.expresion(s.condicion);
    const sino = this.nuevaEtiqueta();
    this.emitir(`si_falso ${cond} ir_a ${sino}`, "salto", s);
    this.bloque(s.entonces);
    if (!s.sino) {
      this.etiqueta(sino, s);
      return;
    }
    const fin = this.nuevaEtiqueta();
    this.emitir(`ir_a ${fin}`, "salto", s);
    this.etiqueta(sino, s);
    if (s.sino.tipo === "Si") this.si(s.sino);
    else this.bloque(s.sino);
    this.etiqueta(fin, s);
  }

  /**
   * Genera las instrucciones de una expresión y devuelve la "dirección" donde
   * queda su valor: un literal, una variable o un temporal. Los literales y las
   * variables no necesitan temporal; cada operador sí.
   */
  private expresion(e: A.Expresion): string {
    switch (e.tipo) {
      case "Literal": {
        const texto = imprimirLiteral(e);
        // Una duración compuesta (negra + corchea) es una sola constante
        return e.tipoLiteral === "duracion" && texto.includes(" ") ? `(${texto})` : texto;
      }
      case "Identificador":
        return e.nombre;
      case "Unaria": {
        const op = this.expresion(e.operando);
        const t = this.nuevoTemporal();
        this.emitir(`${t} = ${e.operador === "no" ? "no " : "-"}${op}`, "asignacion", e);
        return t;
      }
      case "Binaria": {
        // Primero el operando izquierdo y luego el derecho: así se respeta el
        // orden de evaluación y la asociatividad que ya decidió el parser.
        const izq = this.expresion(e.izquierda);
        const der = this.expresion(e.derecha);
        const t = this.nuevoTemporal();
        this.emitir(`${t} = ${izq} ${e.operador} ${der}`, "asignacion", e);
        return t;
      }
      case "Llamada":
        return this.llamada(e, true);
    }
  }

  /** param a ; param b ; [t =] llamar f, 2 */
  private llamada(l: A.Llamada, conValor: boolean): string {
    const args = l.argumentos.map((a) => this.expresion(a));
    for (const a of args) this.emitir(`param ${a}`, "llamada", l);
    if (!conValor) {
      this.emitir(`llamar ${l.nombre}, ${args.length}`, "llamada", l);
      return "";
    }
    const t = this.nuevoTemporal();
    this.emitir(`${t} = llamar ${l.nombre}, ${args.length}`, "llamada", l);
    return t;
  }
}

export function generarIntermedio(p: A.Programa): ResultadoIntermedio {
  return new GeneradorIntermedio().generar(p);
}

/** Texto completo, una instrucción por línea (las etiquetas sin sangría). */
export function imprimirIntermedio(r: ResultadoIntermedio): string {
  return r.instrucciones
    .map((i) => (i.clase === "etiqueta" || i.clase === "funcion" ? i.codigo : "  " + i.codigo))
    .join("\n");
}
