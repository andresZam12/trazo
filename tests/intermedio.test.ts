import { describe, expect, it } from "vitest";
import { generarIntermedio, imprimirIntermedio } from "../src/compiler/intermedio";
import { compilar } from "../src/compiler/pipeline";
import { EJEMPLOS } from "../src/examples";

/** Compila y devuelve el código intermedio (sin optimizar) como lista de líneas sin sangría. */
function tac(codigo: string): string[] {
  const r = compilar(codigo);
  expect(r.errores).toEqual([]);
  return r.intermedio!.instrucciones.map((i) => i.codigo);
}

describe("Código intermedio (tres direcciones)", () => {
  it("respeta la precedencia: primero la multiplicación", () => {
    expect(tac("entero x = 2; entero z = x + 3 * x; mostrar(z);").slice(1, 4)).toEqual(["t1 = 3 * x", "t2 = x + t1", "z = t2"]);
  });

  it("respeta la asociatividad izquierda: (10 - 4) - 3", () => {
    expect(tac("entero a = 10; entero b = a - 4 - 3; mostrar(b);").slice(1, 3)).toEqual(["t1 = a - 4", "t2 = t1 - 3"]);
  });

  it("los literales y variables no gastan temporales", () => {
    expect(tac("entero a = 5; entero b = a; mostrar(b);")).toEqual(["a = 5", "b = a", "param b", "llamar mostrar, 1", "fin"]);
  });

  it("si / sino se vuelve un salto condicional, un salto y dos etiquetas", () => {
    expect(tac('entero x = 1; si (x > 0) { mostrar("a"); } sino { mostrar("b"); }')).toEqual([
      "x = 1",
      "t1 = x > 0",
      "si_falso t1 ir_a L1",
      'param "a"',
      "llamar mostrar, 1",
      "ir_a L2",
      "L1:",
      'param "b"',
      "llamar mostrar, 1",
      "L2:",
      "fin",
    ]);
  });

  it("mientras salta de vuelta al inicio", () => {
    expect(tac("entero i = 0; mientras (i < 3) { i = i + 1; }")).toEqual([
      "i = 0",
      "L1:",
      "t1 = i < 3",
      "si_falso t1 ir_a L2",
      "t2 = i + 1",
      "i = t2",
      "ir_a L1",
      "L2:",
      "fin",
    ]);
  });

  it("repetir usa un contador oculto", () => {
    const c = tac("repetir 4 veces { avanzar(10); }");
    expect(c.slice(0, 5)).toEqual(["t1 = 4", "t2 = 0", "L1:", "t3 = t2 < t1", "si_falso t3 ir_a L2"]);
    expect(c).toContain("t2 = t2 + 1");
  });

  it("las funciones van después del programa principal, con param / llamar / retornar", () => {
    const c = tac("funcion entero doble(entero n) { retornar n * 2; } mostrar(doble(3));");
    expect(c).toEqual([
      "param 3",
      "t1 = llamar doble, 1",
      "param t1",
      "llamar mostrar, 1",
      "fin",
      "funcion doble(n):",
      "t2 = n * 2",
      "retornar t2",
      "fin_funcion doble",
    ]);
  });

  it("una función sin retornar recibe un retornar implícito", () => {
    const c = tac("funcion saludo() { mostrar(1); } saludo();");
    expect(c.slice(-2)).toEqual(["retornar", "fin_funcion saludo"]);
  });

  it("traduce las sentencias musicales", () => {
    const c = tac("tempo 90; compas 4/4; compas { tocar do4 + 7 blanca; acorde [do4, mi4] negra; silencio negra; }");
    expect(c).toEqual([
      "tempo 90",
      "metrica 4/4",
      "inicio_compas 1",
      "t1 = do4 + 7",
      "tocar t1, blanca",
      "acorde [do4, mi4], negra",
      "silencio negra",
      "fin_compas 1",
      "fin",
    ]);
  });

  it("guarda la línea del código fuente de cada instrucción", () => {
    const r = compilar("entero a = 1;\na = a + 2;");
    const suma = r.intermedio!.instrucciones.find((i) => i.codigo === "t1 = a + 2")!;
    expect(suma.linea).toBe(2);
  });

  it("después de optimizar hay menos instrucciones (plegado de constantes)", () => {
    const r = compilar("entero x = 2 * 3 + 1; mostrar(x);");
    expect(r.intermedio!.instrucciones.length).toBeGreaterThan(r.intermedioOptimizado!.instrucciones.length);
  });

  it("es una fase del pipeline entre el semántico y la optimización", () => {
    expect(compilar("mostrar(1);").fases.map((f) => f.nombre)).toEqual([
      "Léxico",
      "Sintáctico",
      "Semántico",
      "Código intermedio",
      "Optimización",
      "Ejecución",
    ]);
  });

  it("no se genera si hay errores semánticos", () => {
    const r = compilar("x = 5;");
    expect(r.intermedio).toBeNull();
    expect(r.fases.find((f) => f.nombre === "Código intermedio")!.estado).toBe("omitida");
  });

  it.each(EJEMPLOS.filter((e) => !e.archivo.includes("error")).map((e) => [e.archivo, e.codigo]))(
    "genera código intermedio para el ejemplo %s",
    (_, codigo) => {
      const r = compilar(codigo);
      const texto = imprimirIntermedio(r.intermedio!);
      expect(texto.trim().length).toBeGreaterThan(0);
      expect(texto).not.toMatch(/undefined|\[object/);
      // Toda etiqueta a la que se salta existe
      const etiquetas = new Set(r.intermedio!.instrucciones.filter((i) => i.clase === "etiqueta").map((i) => i.codigo.slice(0, -1)));
      for (const i of r.intermedio!.instrucciones) {
        const m = i.codigo.match(/ir_a (L\d+)/);
        if (m) expect(etiquetas.has(m[1])).toBe(true);
      }
      expect(generarIntermedio(r.astOptimizado!).instrucciones.length).toBe(r.intermedioOptimizado!.instrucciones.length);
    },
  );
});
