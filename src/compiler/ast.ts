// Nodos del árbol sintáctico abstracto (AST).
// Es una unión discriminada por el campo `tipo`: con un `switch (nodo.tipo)`
// TypeScript sabe exactamente qué campos tiene cada nodo.
// Todos los nodos guardan línea y columna para poder resaltar su código en el editor.

import type { TipoTrazo } from "./semantic/types";

export type TipoDeclarado = "entero" | "decimal" | "texto" | "logico";

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

export type Sentencia = DeclVar | DeclFuncion | Asignacion | Si | Mientras | Repetir | Retornar | LlamadaSent | Bloque;

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
      return [];
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
    case "Literal":
      return `Literal ${typeof nodo.valor === "string" ? JSON.stringify(nodo.valor) : String(nodo.valor)}`;
  }
}
