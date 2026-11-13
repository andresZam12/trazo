// Errores de compilación compartidos por todas las fases.
// Se usa una sola estructura para que la UI pueda listarlos, agruparlos por fase
// y subrayarlos en el editor sin saber qué fase los produjo.

export type Fase = "Léxico" | "Sintáctico" | "Semántico" | "Código intermedio" | "Optimización" | "Ejecución";

export type Severidad = "error" | "advertencia";

export interface ErrorCompilacion {
  fase: Fase;
  mensaje: string;
  linea: number;
  columna: number;
  /** Longitud del fragmento a subrayar en el editor (mínimo 1). */
  longitud: number;
  severidad: Severidad;
}

/** Crea un error con valores por defecto razonables. */
export function crearError(
  fase: Fase,
  mensaje: string,
  linea: number,
  columna: number,
  longitud = 1,
  severidad: Severidad = "error",
): ErrorCompilacion {
  return { fase, mensaje, linea, columna, longitud: Math.max(1, longitud), severidad };
}

/** Formato de texto usado en consola y pruebas: "[Fase] Línea 4, col 12: mensaje". */
export function formatearError(e: ErrorCompilacion): string {
  return `[${e.fase}] Línea ${e.linea}, col ${e.columna}: ${e.mensaje}`;
}

/** Ordena por línea y luego por columna, para mostrarlos en el orden del código. */
export function ordenarErrores(lista: ErrorCompilacion[]): ErrorCompilacion[] {
  return [...lista].sort((a, b) => a.linea - b.linea || a.columna - b.columna);
}
