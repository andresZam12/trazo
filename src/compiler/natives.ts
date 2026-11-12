// Funciones nativas de Trazo: su firma (para el chequeador de tipos) y su
// comportamiento (para el intérprete). Al estar juntas, la firma que se
// verifica es exactamente la que se ejecuta.

import type { TipoTrazo } from "./semantic/types";

/** Comandos que genera el intérprete; el lienzo de la UI los anima después. */
export type ComandoDibujo =
  | { tipo: "linea"; x1: number; y1: number; x2: number; y2: number; color: string; grosor: number; angulo: number; linea: number }
  | { tipo: "mover"; x: number; y: number; angulo: number; linea: number }
  | { tipo: "color"; color: string; linea: number }
  | { tipo: "grosor"; grosor: number; linea: number }
  | { tipo: "limpiar"; linea: number };

export interface FirmaNativa {
  nombre: string;
  parametros: { nombre: string; tipo: TipoTrazo }[];
  retorno: TipoTrazo; // "vacio" si no retorna nada
  /** mostrar() acepta un valor de cualquier tipo y lo convierte a texto. */
  aceptaCualquiera?: boolean;
  descripcion: string;
}

export const FIRMAS_NATIVAS: FirmaNativa[] = [
  { nombre: "avanzar", parametros: [{ nombre: "pasos", tipo: "decimal" }], retorno: "vacio", descripcion: "Mueve el lápiz hacia adelante y dibuja si está abajo" },
  { nombre: "retroceder", parametros: [{ nombre: "pasos", tipo: "decimal" }], retorno: "vacio", descripcion: "Mueve el lápiz hacia atrás" },
  { nombre: "girar_derecha", parametros: [{ nombre: "grados", tipo: "decimal" }], retorno: "vacio", descripcion: "Rota el lápiz en sentido horario" },
  { nombre: "girar_izquierda", parametros: [{ nombre: "grados", tipo: "decimal" }], retorno: "vacio", descripcion: "Rota el lápiz en sentido antihorario" },
  { nombre: "subir_lapiz", parametros: [], retorno: "vacio", descripcion: "Deja de dibujar" },
  { nombre: "bajar_lapiz", parametros: [], retorno: "vacio", descripcion: "Vuelve a dibujar" },
  { nombre: "ir_a", parametros: [{ nombre: "x", tipo: "decimal" }, { nombre: "y", tipo: "decimal" }], retorno: "vacio", descripcion: "Mueve el lápiz a una posición (origen en el centro)" },
  { nombre: "color", parametros: [{ nombre: "c", tipo: "texto" }], retorno: "vacio", descripcion: "Cambia el color (nombre en español o #hex)" },
  { nombre: "grosor", parametros: [{ nombre: "g", tipo: "decimal" }], retorno: "vacio", descripcion: "Ancho del trazo" },
  { nombre: "limpiar", parametros: [], retorno: "vacio", descripcion: "Borra el lienzo" },
  { nombre: "mostrar", parametros: [{ nombre: "mensaje", tipo: "texto" }], retorno: "vacio", aceptaCualquiera: true, descripcion: "Escribe en la consola" },
  { nombre: "aleatorio", parametros: [{ nombre: "min", tipo: "entero" }, { nombre: "max", tipo: "entero" }], retorno: "entero", descripcion: "Entero aleatorio entre min y max (semilla fija)" },
];

export const COLORES: Record<string, string> = {
  rojo: "#ef4444",
  azul: "#3b82f6",
  verde: "#22c55e",
  naranja: "#f97316",
  morado: "#a855f7",
  negro: "#111827",
  blanco: "#f9fafb",
  amarillo: "#eab308",
  rosado: "#ec4899",
  gris: "#9ca3af",
};

/** Convierte el texto de color() en un color CSS, o null si no es válido. */
export function resolverColor(c: string): string | null {
  const nombre = c.trim().toLowerCase();
  if (COLORES[nombre]) return COLORES[nombre];
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(nombre)) return nombre;
  return null;
}

/**
 * Generador pseudoaleatorio con semilla fija (mulberry32).
 * Con la misma semilla, la ejecución siempre dibuja lo mismo: es reproducible.
 */
export function crearAleatorio(semilla = 2026): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Estado del lápiz (la "tortuga"). Ángulo 0 = hacia arriba; girar a la derecha suma grados. */
export interface EstadoLapiz {
  x: number;
  y: number;
  angulo: number;
  abajo: boolean;
  color: string;
  grosor: number;
}

export function lapizInicial(): EstadoLapiz {
  return { x: 0, y: 0, angulo: 0, abajo: true, color: COLORES.blanco, grosor: 2 };
}

// "|| 0" convierte -0 en 0, para que las coordenadas se vean limpias
const redondear = (n: number) => Math.round(n * 1000) / 1000 || 0;

/**
 * Ejecuta una nativa de dibujo. Devuelve el valor de retorno (si tiene) o
 * un mensaje de error de ejecución en `error`.
 */
export function ejecutarNativa(
  nombre: string,
  args: (number | string | boolean)[],
  lapiz: EstadoLapiz,
  comandos: ComandoDibujo[],
  consola: string[],
  aleatorio: () => number,
  linea: number,
): { valor?: number; error?: string } {
  const mover = (dist: number) => {
    const rad = (lapiz.angulo * Math.PI) / 180;
    const nx = redondear(lapiz.x + Math.sin(rad) * dist);
    const ny = redondear(lapiz.y + Math.cos(rad) * dist);
    if (lapiz.abajo) {
      comandos.push({ tipo: "linea", x1: lapiz.x, y1: lapiz.y, x2: nx, y2: ny, color: lapiz.color, grosor: lapiz.grosor, angulo: lapiz.angulo, linea });
    } else {
      comandos.push({ tipo: "mover", x: nx, y: ny, angulo: lapiz.angulo, linea });
    }
    lapiz.x = nx;
    lapiz.y = ny;
  };
  const girar = (grados: number) => {
    lapiz.angulo = (((lapiz.angulo + grados) % 360) + 360) % 360;
    comandos.push({ tipo: "mover", x: lapiz.x, y: lapiz.y, angulo: lapiz.angulo, linea });
  };

  switch (nombre) {
    case "avanzar": mover(args[0] as number); return {};
    case "retroceder": mover(-(args[0] as number)); return {};
    case "girar_derecha": girar(args[0] as number); return {};
    case "girar_izquierda": girar(-(args[0] as number)); return {};
    case "subir_lapiz": lapiz.abajo = false; return {};
    case "bajar_lapiz": lapiz.abajo = true; return {};
    case "ir_a": {
      const x = args[0] as number;
      const y = args[1] as number;
      if (lapiz.abajo) comandos.push({ tipo: "linea", x1: lapiz.x, y1: lapiz.y, x2: x, y2: y, color: lapiz.color, grosor: lapiz.grosor, angulo: lapiz.angulo, linea });
      else comandos.push({ tipo: "mover", x, y, angulo: lapiz.angulo, linea });
      lapiz.x = x;
      lapiz.y = y;
      return {};
    }
    case "color": {
      const c = resolverColor(args[0] as string);
      if (!c) return { error: `color desconocido '${args[0]}'. Usa un nombre (rojo, azul, verde, ...) o un hexadecimal como "#ff8800"` };
      lapiz.color = c;
      comandos.push({ tipo: "color", color: c, linea });
      return {};
    }
    case "grosor": {
      const g = args[0] as number;
      if (g <= 0) return { error: `el grosor debe ser mayor que cero (se recibió ${g})` };
      lapiz.grosor = g;
      comandos.push({ tipo: "grosor", grosor: g, linea });
      return {};
    }
    case "limpiar":
      comandos.push({ tipo: "limpiar", linea });
      return {};
    case "mostrar":
      consola.push(aTexto(args[0]));
      return {};
    case "aleatorio": {
      const min = args[0] as number;
      const max = args[1] as number;
      if (min > max) return { error: `aleatorio(${min}, ${max}): el mínimo no puede ser mayor que el máximo` };
      return { valor: min + Math.floor(aleatorio() * (max - min + 1)) };
    }
  }
  return { error: `función nativa desconocida '${nombre}'` };
}

/** Conversión de cualquier valor de Trazo a texto (usada por + con texto y por mostrar). */
export function aTexto(v: number | string | boolean | undefined): string {
  if (typeof v === "boolean") return v ? "verdadero" : "falso";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(redondear(v));
  return v ?? "";
}
