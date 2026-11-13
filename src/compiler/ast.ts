// Nodos del árbol sintáctico abstracto (AST).
// Es una unión discriminada por el campo `tipo`: con un `switch (nodo.tipo)`
// TypeScript sabe exactamente qué campos tiene cada nodo.
// Todos los nodos guardan línea y columna para poder resaltar su código en el editor.

import type { TipoTrazo } from "./semantic/types";
import { nombreNota } from "./tokens";

export type TipoDeclarado = "entero" | "decimal" | "texto" | "logico" | "nota" | "duracion";

interface NodoBase {
  linea: number;
  columna: number;
}

// ---------------- Expresiones ----------------

export interface Literal extends NodoBase {
  tipo: "Literal";
  valor: number | string | boolean;
  tipoLiteral: TipoDeclarado;
  tipoDato?: TipoTrazo;
}

export interface Identificador extends NodoBase {
  tipo: "Identificador";
  nombre: string;
  tipoDato?: TipoTrazo;
}

export type OperadorBinario = "+" | "-" | "*" | "/" | "%" | "==" | "!=" | "<" | ">" | "<=" | ">=" | "y" | "o";

export interface Binaria extends NodoBase {
  tipo: "Binaria";
  operador: OperadorBinario;
  izquierda: Expresion;
  derecha: Expresion;
  tipoDato?: TipoTrazo;
}

export interface Unaria extends NodoBase {
  tipo: "Unaria";
  operador: "-" | "no";
  operando: Expresion;
  tipoDato?: TipoTrazo;
}

export interface Llamada extends NodoBase {
  tipo: "Llamada";
  nombre: string;
  argumentos: Expresion[];
  tipoDato?: TipoTrazo;
}

export type Expresion = Literal | Identificador | Binaria | Unaria | Llamada;

// ---------------- Sentencias ----------------

export interface DeclVar extends NodoBase {
  tipo: "DeclVar";
  tipoVar: TipoDeclarado;
  nombre: string;
  inicial: Expresion | null;
}

export interface Parametro extends NodoBase {
  tipoParam: TipoDeclarado;
  nombre: string;
}

export interface DeclFuncion extends NodoBase {
  tipo: "DeclFuncion";
  tipoRetorno: TipoDeclarado | null;
  nombre: string;
  parametros: Parametro[];
  cuerpo: Bloque;
}

export interface Asignacion extends NodoBase {
  tipo: "Asignacion";
  nombre: string;
  valor: Expresion;
}

export interface Si extends NodoBase {
  tipo: "Si";
  condicion: Expresion;
  entonces: Bloque;
  sino: Bloque | Si | null;
}

export interface Mientras extends NodoBase {
  tipo: "Mientras";
  condicion: Expresion;
  cuerpo: Bloque;
}

export interface Repetir extends NodoBase {
  tipo: "Repetir";
  veces: Expresion;
  cuerpo: Bloque;
}

export interface Retornar extends NodoBase {
  tipo: "Retornar";
  valor: Expresion | null;
}

export interface LlamadaSent extends NodoBase {
  tipo: "LlamadaSent";
  llamada: Llamada;
}

export interface Bloque extends NodoBase {
  tipo: "Bloque";
  sentencias: Sentencia[];
}

// ---------------- Sentencias musicales ----------------

/** tempo 110;  → pulsos (negras) por minuto */
export interface Tempo extends NodoBase {
  tipo: "Tempo";
  bpm: number;
}

/** compas 3/4;  → cambia la métrica con la que se validan los compases siguientes */
export interface CompasDecl extends NodoBase {
  tipo: "CompasDecl";
  numerador: number;
  denominador: number;
}

/** tocar do4 negra; */
export interface Tocar extends NodoBase {
  tipo: "Tocar";
  nota: Expresion;
  duracion: Expresion;
}

/** silencio corchea; */
export interface Silencio extends NodoBase {
  tipo: "Silencio";
  duracion: Expresion;
}

/** acorde [do4, mi4, sol4] blanca; */
export interface Acorde extends NodoBase {
  tipo: "Acorde";
  notas: Expresion[];
  duracion: Expresion;
}

/** compas { ... }  → un compás cuya duración total valida el chequeador */
export interface BloqueCompas extends NodoBase {
  tipo: "BloqueCompas";
  cuerpo: Bloque;
  /** Número del compás en orden de aparición (lo asigna el chequeador). */
  numero?: number;
}

export type Sentencia =
  | DeclVar
  | DeclFuncion
  | Asignacion
  | Si
  | Mientras
  | Repetir
  | Retornar
  | LlamadaSent
  | Bloque
  | Tempo
  | CompasDecl
  | Tocar
  | Silencio
  | Acorde
  | BloqueCompas;

export interface Programa extends NodoBase {
  tipo: "Programa";
  sentencias: Sentencia[];
}

export type Nodo = Programa | Sentencia | Expresion;

/** Cuenta los nodos de un árbol (se usa para comparar antes/después de optimizar). */
export function contarNodos(nodo: Nodo | null): number {
  if (!nodo) return 0;
  return 1 + hijosDe(nodo).reduce((acc, h) => acc + contarNodos(h), 0);
}

/** Hijos directos de un nodo, en orden. Lo usa la UI para dibujar el árbol. */
export function hijosDe(nodo: Nodo): Nodo[] {
  switch (nodo.tipo) {
    case "Programa":
    case "Bloque":
      return nodo.sentencias;
    case "DeclVar":
      return nodo.inicial ? [nodo.inicial] : [];
    case "DeclFuncion":
      return [nodo.cuerpo];
    case "Asignacion":
      return [nodo.valor];
    case "Si":
      return nodo.sino ? [nodo.condicion, nodo.entonces, nodo.sino] : [nodo.condicion, nodo.entonces];
    case "Mientras":
      return [nodo.condicion, nodo.cuerpo];
    case "Repetir":
      return [nodo.veces, nodo.cuerpo];
    case "Retornar":
      return nodo.valor ? [nodo.valor] : [];
    case "LlamadaSent":
      return [nodo.llamada];
    case "Binaria":
      return [nodo.izquierda, nodo.derecha];
    case "Unaria":
      return [nodo.operando];
    case "Llamada":
      return nodo.argumentos;
    case "Literal":
    case "Identificador":
    case "Tempo":
    case "CompasDecl":
      return [];
    case "Tocar":
      return [nodo.nota, nodo.duracion];
    case "Silencio":
      return [nodo.duracion];
    case "Acorde":
      return [...nodo.notas, nodo.duracion];
    case "BloqueCompas":
      return [nodo.cuerpo];
  }
}

/** Etiqueta corta de un nodo para la visualización del árbol. */
export function etiquetaDe(nodo: Nodo): string {
  switch (nodo.tipo) {
    case "Programa": return "Programa";
    case "Bloque": return "Bloque";
    case "DeclVar": return `DeclVar ${nodo.tipoVar} ${nodo.nombre}`;
    case "DeclFuncion": {
      const params = nodo.parametros.map((p) => `${p.tipoParam} ${p.nombre}`).join(", ");
      return `Función ${nodo.tipoRetorno ?? ""} ${nodo.nombre}(${params})`.replace("  ", " ");
    }
    case "Asignacion": return `Asignación ${nodo.nombre} =`;
    case "Si": return "Si";
    case "Mientras": return "Mientras";
    case "Repetir": return "Repetir … veces";
    case "Retornar": return "Retornar";
    case "LlamadaSent": return "Sentencia llamada";
    case "Binaria": return `Binaria ${nodo.operador}`;
    case "Unaria": return `Unaria ${nodo.operador}`;
    case "Llamada": return `Llamada ${nodo.nombre}()`;
    case "Identificador": return `Ident ${nodo.nombre}`;
    case "Tempo": return `Tempo ${nodo.bpm}`;
    case "CompasDecl": return `Métrica ${nodo.numerador}/${nodo.denominador}`;
    case "Tocar": return "Tocar";
    case "Silencio": return "Silencio";
    case "Acorde": return `Acorde (${nodo.notas.length} notas)`;
    case "BloqueCompas": return `Compás${nodo.numero ? " " + nodo.numero : ""}`;
    case "Literal":
      if (nodo.tipoLiteral === "nota") return `Nota ${nombreNota(nodo.valor as number)} (midi ${nodo.valor})`;
      if (nodo.tipoLiteral === "duracion") return `Duración ${nodo.valor} tiempo(s)`;
      return `Literal ${typeof nodo.valor === "string" ? JSON.stringify(nodo.valor) : String(nodo.valor)}`;
  }
}
