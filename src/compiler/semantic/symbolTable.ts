// Tabla de símbolos como pila de ámbitos.
// - El ámbito global contiene las funciones nativas y las del usuario.
// - Cada función abre un ámbito con sus parámetros; cada bloque { } abre uno anidado.
// - La búsqueda va del ámbito más interno al más externo: eso es el ámbito léxico.
// Además de la pila (lo que está "vivo" mientras se recorre el AST) se guarda el
// árbol completo de ámbitos para mostrarlo en la UI al final.

import type { TipoTrazo } from "./types";

export type CategoriaSimbolo = "variable" | "parametro" | "funcion" | "nativa";

export interface Simbolo {
  nombre: string;
  tipo: TipoTrazo; // para funciones: tipo de retorno
  categoria: CategoriaSimbolo;
  linea: number;
  columna: number;
  usado: boolean;
  inicializado: boolean;
  /** Solo funciones: tipos de los parámetros. */
  parametros?: { nombre: string; tipo: TipoTrazo }[];
  aceptaCualquiera?: boolean;
}

export interface Ambito {
  id: number;
  nombre: string;
  tipo: "global" | "funcion" | "bloque";
  simbolos: Map<string, Simbolo>;
  padre: Ambito | null;
  hijos: Ambito[];
}

/** Versión serializable del árbol de ámbitos, para la pestaña Símbolos. */
export interface SnapshotAmbito {
  id: number;
  nombre: string;
  tipo: Ambito["tipo"];
  simbolos: (Omit<Simbolo, "parametros"> & { firma?: string })[];
  hijos: SnapshotAmbito[];
}

export class TablaSimbolos {
  private contador = 0;
  readonly global: Ambito;
  private actual: Ambito;

  constructor() {
    this.global = this.nuevoAmbito("global", "global", null);
    this.actual = this.global;
  }

  private nuevoAmbito(nombre: string, tipo: Ambito["tipo"], padre: Ambito | null): Ambito {
    const a: Ambito = { id: this.contador++, nombre, tipo, simbolos: new Map(), padre, hijos: [] };
    if (padre) padre.hijos.push(a);
    return a;
  }

  get ambitoActual(): Ambito {
    return this.actual;
  }

  /** Entra a un ámbito nuevo (push en la pila). */
  abrir(nombre: string, tipo: "funcion" | "bloque"): Ambito {
    const etiqueta = tipo === "bloque" ? `bloque#${this.contador}` : nombre;
    this.actual = this.nuevoAmbito(etiqueta, tipo, this.actual);
    return this.actual;
  }

  /** Sale del ámbito actual (pop) y devuelve el que se cerró. */
  cerrar(): Ambito {
    const cerrado = this.actual;
    if (this.actual.padre) this.actual = this.actual.padre;
    return cerrado;
  }

  /** Declara en el ámbito actual. Devuelve false si ya existía en ESTE ámbito. */
  declarar(simbolo: Simbolo): boolean {
    if (this.actual.simbolos.has(simbolo.nombre)) return false;
    this.actual.simbolos.set(simbolo.nombre, simbolo);
    return true;
  }

  /** Declara directamente en el global (primera pasada de funciones). */
  declararGlobal(simbolo: Simbolo): boolean {
    if (this.global.simbolos.has(simbolo.nombre)) return false;
    this.global.simbolos.set(simbolo.nombre, simbolo);
    return true;
  }

  /** Busca del ámbito interno hacia el externo. */
  buscar(nombre: string): Simbolo | null {
    for (let a: Ambito | null = this.actual; a; a = a.padre) {
      const s = a.simbolos.get(nombre);
      if (s) return s;
    }
    return null;
  }

  /** Busca solo en ámbitos exteriores al actual (para detectar ocultamiento). */
  buscarEnExteriores(nombre: string): Simbolo | null {
    for (let a: Ambito | null = this.actual.padre; a; a = a.padre) {
      const s = a.simbolos.get(nombre);
      if (s) return s;
    }
    return null;
  }

  /** Árbol completo serializable para la UI. */
  snapshot(): SnapshotAmbito {
    const convertir = (a: Ambito): SnapshotAmbito => ({
      id: a.id,
      nombre: a.nombre,
      tipo: a.tipo,
      simbolos: [...a.simbolos.values()].map((s) => {
        const { parametros, ...resto } = s;
        const firma = parametros ? `(${parametros.map((p) => `${p.tipo} ${p.nombre}`).join(", ")})` : undefined;
        return { ...resto, firma };
      }),
      hijos: a.hijos.map(convertir),
    });
    return convertir(this.global);
  }
}
