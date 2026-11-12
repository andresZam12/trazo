import { describe, expect, it } from "vitest";
import { compilar } from "../src/compiler/pipeline";
import { imprimirPrograma } from "../src/compiler/printer";

/** Compila y devuelve el código regenerado desde el AST optimizado. */
function optimizado(src: string) {
  const r = compilar(src);
  expect(r.errores).toEqual([]);
  return { codigo: imprimirPrograma(r.astOptimizado!), r };
}

describe("Optimizador", () => {
  it("pliega constantes numéricas y de texto", () => {
    const { codigo, r } = optimizado('mostrar(2 * 3 + 1);\nmostrar("a" + "b");');
    expect(codigo).toBe('mostrar(7);\nmostrar("ab");');
    expect(r.optimizaciones.some((c) => c.regla === "Plegado de constantes" && c.despues === "7")).toBe(true);
  });

  it("respeta la división entera al plegar", () => {
    expect(optimizado("mostrar(7 / 2);").codigo).toBe("mostrar(3);");
    expect(optimizado("mostrar(7.0 / 2);").codigo).toBe("mostrar(3.5);");
  });

  it("no pliega una división entre cero (se deja para la ejecución)", () => {
    const r = compilar("mostrar(5 / 0);");
    expect(r.errores.map((e) => e.fase)).toEqual(["Ejecución"]);
  });

  it("propaga constantes que nunca se modifican", () => {
    const { codigo, r } = optimizado("entero n = 4;\nrepetir n veces { avanzar(10); }");
    expect(codigo).toBe("repetir 4 veces {\n  avanzar(10);\n}");
    expect(r.optimizaciones.some((c) => c.regla === "Propagación de constantes")).toBe(true);
  });

  it("no propaga variables que se reasignan", () => {
    const { codigo } = optimizado("entero i = 0;\nmientras (i < 3) { i = i + 1; }");
    expect(codigo).toContain("entero i = 0;");
    expect(codigo).toContain("i < 3");
  });

  it("elimina código muerto", () => {
    const src = `si (falso) { avanzar(1); }
si (verdadero) { color("rojo"); } sino { color("azul"); }
mientras (falso) { avanzar(2); }
funcion entero f() { retornar 1; mostrar("nunca"); }
mostrar(f());`;
    const { codigo } = optimizado(src);
    expect(codigo).not.toContain("avanzar");
    expect(codigo).not.toContain("azul");
    expect(codigo).not.toContain("nunca");
    expect(codigo).toContain('color("rojo")');
  });

  it("simplifica identidades algebraicas sin cambiar tipos ni borrar llamadas", () => {
    const src = `entero x = aleatorio(1, 9);
mostrar(x * 1);
mostrar(x + 0);
mostrar(x * 0);
mostrar(aleatorio(1, 2) * 0);
mostrar(no no (x > 2));
mostrar(x * 1.0 / 2);`;
    const { codigo } = optimizado(src);
    const lineas = codigo.split("\n");
    expect(lineas[1]).toBe("mostrar(x);");
    expect(lineas[2]).toBe("mostrar(x);");
    expect(lineas[3]).toBe("mostrar(0);");
    expect(lineas[4]).toBe("mostrar(aleatorio(1, 2) * 0);"); // tiene efectos: no se borra
    expect(lineas[5]).toBe("mostrar(x > 2);");
    expect(lineas[6]).toBe("mostrar(x * 1.0 / 2);"); // x * 1.0 es decimal: no se simplifica a x
  });

  it("el programa optimizado produce la misma salida con menos pasos y nodos", () => {
    const src = `entero lados = 4 + 2;
si (falso) { mostrar("x"); }
repetir lados veces { avanzar(10 * 1); girar_derecha(360 / lados); }
mostrar("fin " + lados * 2);`;
    const conOpt = compilar(src, { usarOptimizado: true });
    const sinOpt = compilar(src, { usarOptimizado: false });
    expect(conOpt.ejecucion!.consola).toEqual(sinOpt.ejecucion!.consola);
    expect(conOpt.ejecucion!.comandos).toEqual(sinOpt.ejecucion!.comandos);
    expect(conOpt.metricas.nodosDespues).toBeLessThan(conOpt.metricas.nodosAntes);
    expect(conOpt.metricas.pasosDespues!).toBeLessThan(conOpt.metricas.pasosAntes!);
  });
});
