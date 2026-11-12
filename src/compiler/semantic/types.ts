// Sistema de tipos de Trazo: reglas de compatibilidad y promoción.
// Está separado del chequeador para que las reglas se lean como una tabla
// y se puedan probar por separado.

export type TipoTrazo = "entero" | "decimal" | "texto" | "logico" | "vacio" | "error";

/** "error" es un tipo comodín: evita avalanchas de errores en cascada. */
export function esError(t: TipoTrazo): boolean {
  return t === "error";
}

export function esNumerico(t: TipoTrazo): boolean {
  return t === "entero" || t === "decimal";
}

/**
 * ¿Se puede asignar un valor de tipo `origen` a algo de tipo `destino`?
 * entero → decimal se permite (promoción); decimal → entero no (se perdería información).
 */
export function esAsignable(destino: TipoTrazo, origen: TipoTrazo): boolean {
  if (esError(destino) || esError(origen)) return true;
  if (destino === origen) return true;
  return destino === "decimal" && origen === "entero";
}

/** Tipo resultante de una operación aritmética entre dos numéricos. */
export function promover(a: TipoTrazo, b: TipoTrazo): TipoTrazo {
  return a === "decimal" || b === "decimal" ? "decimal" : "entero";
}

/** ¿Se pueden comparar con == / != ? Dos numéricos siempre; si no, el mismo tipo. */
export function sonComparables(a: TipoTrazo, b: TipoTrazo): boolean {
  if (esError(a) || esError(b)) return true;
  if (esNumerico(a) && esNumerico(b)) return true;
  return a === b && a !== "vacio";
}
