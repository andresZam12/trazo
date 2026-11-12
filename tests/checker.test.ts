import { describe, expect, it } from "vitest";
import { analizarLexico } from "../src/compiler/lexer";
import { analizarSintaxis } from "../src/compiler/parser";
import { analizarSemantica } from "../src/compiler/semantic/checker";
import { esAsignable, promover } from "../src/compiler/semantic/types";

function revisar(src: string) {
  const { ast, errores } = analizarSintaxis(analizarLexico(src).tokens);
  expect(errores).toHaveLength(0);
  return analizarSemantica(ast);
}
const mensajes = (src: string) => revisar(src).errores.map((e) => e.mensaje);

describe("Reglas de tipos", () => {
  it("promueve entero a decimal, no al revés", () => {
    expect(esAsignable("decimal", "entero")).toBe(true);
    expect(esAsignable("entero", "decimal")).toBe(false);
    expect(promover("entero", "decimal")).toBe("decimal");
  });

  it("acepta un programa correcto sin errores", () => {
    const r = revisar(`
      funcion poligono(entero lados, decimal tam) {
        repetir lados veces { avanzar(tam); girar_derecha(360 / lados); }
      }
      entero i = 0;
      decimal d = i;
      mientras (i < 3) { poligono(6, 20 + i * 2); i = i + 1; }
      mostrar("Listo: " + i + " " + d);`);
    expect(r.errores).toEqual([]);
  });

  it("rechaza asignar texto a entero y decimal a entero", () => {
    const e = revisar('entero x = "hola";\ndecimal d = 1.5;\nentero k = d;').errores;
    expect(e).toHaveLength(2);
    expect(e[0]).toMatchObject({ fase: "Semántico", linea: 1 });
    expect(e[0].mensaje).toContain("no se puede asignar un valor texto");
    expect(e[1].linea).toBe(3);
  });

  it("+ con texto concatena; otro uso de texto en aritmética es error", () => {
    expect(mensajes('texto t = "a" + 1 + verdadero;')).toEqual([]);
    expect(mensajes('entero x = "a" * 2;')[0]).toContain("no se puede aplicar '*' entre texto y entero");
  });

  it("y / o / no solo aceptan logico y las condiciones deben ser logico", () => {
    expect(mensajes("logico a = 1 y verdadero;")[0]).toContain("solo acepta valores logico");
    expect(mensajes("si (1) { }")[0]).toContain("la condición de 'si' debe ser logico");
    expect(mensajes("mientras (no 3) { }")[0]).toContain("'no' necesita un valor logico");
  });

  it("repetir exige entero y % solo acepta enteros", () => {
    expect(mensajes("repetir 2.5 veces { }")[0]).toContain("debe ser entero");
    expect(mensajes("entero x = 5 % 2.0;")[0]).toContain("'%' solo acepta enteros");
  });

  it("verifica variables no declaradas, redeclaradas y sin inicializar", () => {
    expect(mensajes("mostrar(z);")[0]).toBe("la variable 'z' no está declarada");
    expect(mensajes("entero x = 1;\nentero x = 2;")[0]).toBe("la variable 'x' ya fue declarada en este ámbito");
    expect(mensajes("entero x;\nmostrar(x);")[0]).toContain("sin haberle asignado un valor");
    expect(mensajes("entero x = x + 1;")[0]).toContain("no está declarada");
  });

  it("verifica funciones: existencia, aridad y tipos de argumentos (también las nativas)", () => {
    expect(mensajes("saltar(1);")[0]).toBe("la función 'saltar' no está declarada");
    expect(mensajes("girar_derecha(1, 2);")[0]).toContain("espera 1 argumento(s) pero recibió 2");
    expect(mensajes('avanzar("hola");')[0]).toContain("debe ser decimal, pero es texto");
    expect(mensajes("mostrar(verdadero);")).toEqual([]); // mostrar acepta cualquier tipo
  });

  it("permite llamar funciones antes de declararlas (primera pasada)", () => {
    expect(mensajes("entero x = doble(2);\nmostrar(x);\nfuncion entero doble(entero n) { retornar n * 2; }")).toEqual([]);
  });

  it("verifica retornos", () => {
    expect(mensajes("retornar;")[0]).toContain("solo se puede usar dentro de una función");
    expect(mensajes("funcion f() { retornar 1; }")[0]).toContain("no puede retornar un valor");
    expect(mensajes('funcion entero f() { retornar "a"; }')[0]).toContain("debe retornar entero pero retorna texto");
    expect(mensajes("funcion entero f(entero n) { si (n > 0) { retornar 1; } }")[0]).toContain("falta retorno");
    expect(mensajes("funcion entero f(entero n) { si (n > 0) { retornar 1; } sino { retornar 2; } }")).toEqual([]);
  });

  it("no permite usar en una expresión una función sin retorno", () => {
    expect(mensajes("funcion f() { }\nentero x = f();")[0]).toContain("no retorna ningún valor");
  });

  it("genera advertencias: no usada, ocultamiento y código inalcanzable", () => {
    const r = revisar(`
      entero a = 1;
      entero b = 2;
      mostrar(b);
      funcion entero f(entero n) {
        entero b = n;
        retornar b;
        mostrar(n);
      }
      mostrar(f(1));`);
    expect(r.errores).toEqual([]);
    const adv = r.advertencias.map((a) => a.mensaje);
    expect(adv).toContain("la variable 'a' se declaró pero nunca se usa");
    expect(adv.some((m) => m.includes("oculta a otra"))).toBe(true);
    expect(adv.some((m) => m.includes("código inalcanzable"))).toBe(true);
    expect(r.advertencias.every((a) => a.severidad === "advertencia")).toBe(true);
  });

  it("construye el árbol de ámbitos anidados", () => {
    const r = revisar("funcion poligono(entero lados) { repetir lados veces { entero k = 1; mostrar(k); } }");
    const global = r.tablaSimbolos;
    expect(global.nombre).toBe("global");
    const f = global.hijos[0];
    expect(f.nombre).toBe("poligono");
    expect(f.simbolos[0]).toMatchObject({ nombre: "lados", categoria: "parametro", usado: true });
    expect(f.hijos[0].nombre).toMatch(/^bloque#/);
    expect(global.simbolos.find((s) => s.nombre === "avanzar")?.categoria).toBe("nativa");
  });
});
