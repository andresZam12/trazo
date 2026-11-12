// Genera src/examples/index.ts a partir de los archivos .trz.
// Así los ejemplos se editan como archivos normales y la UI los importa como texto.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "examples");
const archivos = readdirSync(dir).filter((f) => f.endsWith(".trz")).sort();
const ejemplos = archivos.map((f) => ({
  archivo: f,
  nombre: f.replace(/^\d+_/, "").replace(".trz", "").replace(/_/g, " "),
  codigo: readFileSync(join(dir, f), "utf8").replace(/\r\n/g, "\n"),
}));
const salida =
  "// ARCHIVO GENERADO por scripts/generar-ejemplos.mjs a partir de los .trz. No editar a mano.\n\n" +
  "export interface Ejemplo { archivo: string; nombre: string; codigo: string }\n\n" +
  `export const EJEMPLOS: Ejemplo[] = ${JSON.stringify(ejemplos, null, 2)};\n`;
writeFileSync(join(dir, "index.ts"), salida);
console.log(`Ejemplos generados: ${ejemplos.length}`);
