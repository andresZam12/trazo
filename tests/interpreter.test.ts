import { describe, expect, it } from "vitest";
import { compilar } from "../src/compiler/pipeline";
import { EJEMPLOS } from "../src/examples";

const consola = (src: string) => {
  const r = compilar(src, { usarOptimizado: false });
  expect(r.errores).toEqual([]);
  return r.ejecucion!.consola;
};

describe("Intérprete", () => {
  it("v1: evalúa expresiones con precedencia (2 + 3 * 4 = 14)", () => {
    expect(consola("mostrar(2 + 3 * 4);")).toEqual(["14"]);
    expect(consola("mostrar(10 - 3 - 2);")).toEqual(["5"]);
    expect(consola("mostrar(7 / 2); mostrar(7.0 / 2); mostrar(-7 % 3);")).toEqual(["3", "3.5", "-1"]);
  });

  it("v2: variables, concatenación y mostrar de cualquier tipo", () => {
    expect(consola('entero i = 3; decimal d = i; mostrar("i=" + i + " d=" + d); mostrar(i > 2);')).toEqual([
      "i=3 d=3.0",
      "verdadero",
    ]);
  });

  it("v3: si, mientras y repetir con dibujo", () => {
    const r = compilar("repetir 4 veces { avanzar(100); girar_derecha(90); }");
    const lineas = r.ejecucion!.comandos.filter((c) => c.tipo === "linea");
    expect(lineas).toHaveLength(4);
    expect(lineas[0]).toMatchObject({ x1: 0, y1: 0, x2: 0, y2: 100 });
    expect(lineas[1]).toMatchObject({ x2: 100, y2: 100 });
    expect(lineas[3]).toMatchObject({ x2: 0, y2: 0 }); // el cuadrado se cierra
  });

  it("subir_lapiz mueve sin dibujar", () => {
    const r = compilar("subir_lapiz(); avanzar(50); bajar_lapiz(); avanzar(10);");
    const tipos = r.ejecucion!.comandos.map((c) => c.tipo);
    expect(tipos).toEqual(["mover", "linea"]);
  });

  it("v4: funciones, recursión y ámbito léxico", () => {
    const src = `
      funcion entero fact(entero n) { si (n <= 1) { retornar 1; } retornar n * fact(n - 1); }
      entero x = 10;
      funcion entero leeX() { retornar x; }
      funcion prueba() { entero x = 99; mostrar(leeX()); }
      prueba();
      mostrar(fact(5));`;
    expect(consola(src)).toEqual(["10", "120"]);
  });

  it("y / o hacen cortocircuito", () => {
    expect(consola("entero d = 0; mostrar(d != 0 y 10 / d > 1);")).toEqual(["falso"]);
  });

  it("aleatorio es reproducible (semilla fija)", () => {
    const a = consola("mostrar(aleatorio(1, 100)); mostrar(aleatorio(1, 100));");
    const b = consola("mostrar(aleatorio(1, 100)); mostrar(aleatorio(1, 100));");
    expect(a).toEqual(b);
  });

  it("error de ejecución: división entre cero", () => {
    const r = compilar("entero c = 0;\nmostrar(5 / c);");
    expect(r.errores).toHaveLength(1);
    expect(r.errores[0]).toMatchObject({ fase: "Ejecución", linea: 2, mensaje: "división entre cero" });
    expect(r.fases.find((f) => f.nombre === "Ejecución")?.estado).toBe("error");
  });

  it("error de ejecución: bucle infinito", () => {
    const r = compilar("entero i = 0;\nmientras (i < 10) { avanzar(1); }");
    expect(r.errores[0].fase).toBe("Ejecución");
    expect(r.errores[0].mensaje).toContain("bucle infinito");
  });

  it("error de ejecución: recursión demasiado profunda", () => {
    const r = compilar("funcion f(entero n) { f(n + 1); }\nf(0);");
    expect(r.errores[0].mensaje).toContain("recursión demasiado profunda");
  });

  it("error de ejecución: color desconocido", () => {
    const r = compilar('color("fucsia");');
    expect(r.errores[0].mensaje).toContain("color desconocido");
  });
});

describe("Pipeline con los ejemplos incluidos", () => {
  const porArchivo = Object.fromEntries(EJEMPLOS.map((e) => [e.archivo, e.codigo]));

  it.each(EJEMPLOS.filter((e) => !e.archivo.includes("error")).map((e) => e.archivo))("%s compila y se ejecuta sin errores", (archivo) => {
    for (const usarOptimizado of [true, false]) {
      const r = compilar(porArchivo[archivo], { usarOptimizado });
      expect(r.errores).toEqual([]);
      expect(r.fases.every((f) => f.estado === "ok")).toBe(true);
    }
  });

  it("los ejemplos que dibujan generan comandos de línea", () => {
    for (const a of ["01_cuadrado.trz", "02_estrella.trz", "03_espiral.trz", "04_flor_funciones.trz", "05_arbol_recursivo.trz"]) {
      const r = compilar(porArchivo[a]);
      expect(r.ejecucion!.comandos.some((c) => c.tipo === "linea")).toBe(true);
    }
  });

  it("06_calculos muestra factorial y fibonacci", () => {
    const r = compilar(porArchivo["06_calculos.trz"]);
    expect(r.ejecucion!.consola[4]).toBe("5! = 120   fib(5) = 5");
    expect(r.ejecucion!.consola).toContain("7 / 2 = 3 (división entera)");
  });

  it("07_optimizable aplica las cuatro reglas", () => {
    const r = compilar(porArchivo["07_optimizable.trz"]);
    const reglas = new Set(r.optimizaciones.map((c) => c.regla));
    expect(reglas.size).toBe(4);
  });

  it("08 falla en la fase léxica con varios errores", () => {
    const r = compilar(porArchivo["08_error_lexico.trz"]);
    expect(r.fases.map((f) => f.estado)).toEqual(["error", "omitida", "omitida", "omitida", "omitida", "omitida"]);
    expect(r.errores.length).toBeGreaterThanOrEqual(5);
  });

  it("09 falla en la fase sintáctica con varios errores", () => {
    const r = compilar(porArchivo["09_error_sintactico.trz"]);
    expect(r.fases[1].estado).toBe("error");
    expect(r.errores.every((e) => e.fase === "Sintáctico")).toBe(true);
    expect(r.errores.length).toBeGreaterThanOrEqual(4);
  });

  it("10 falla en la fase semántica con varios errores", () => {
    const r = compilar(porArchivo["10_error_semantico.trz"]);
    expect(r.fases[2].estado).toBe("error");
    expect(r.errores.every((e) => e.fase === "Semántico")).toBe(true);
    expect(r.errores.length).toBeGreaterThanOrEqual(10);
  });
});
