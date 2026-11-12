import { describe, expect, it } from "vitest";
import { compilar } from "../src/compiler/pipeline";
import { MANUAL } from "../src/manual/contenido";

// Los ejemplos del manual son lo primero que va a probar alguien nuevo:
// todos deben compilar y ejecutarse sin errores.
describe("Ejemplos del manual", () => {
  it.each(MANUAL.filter((s) => s.ejemplo).map((s) => [s.titulo, s.ejemplo!]))("%s", (_titulo, codigo) => {
    const r = compilar(codigo);
    expect(r.errores).toEqual([]);
  });
});
