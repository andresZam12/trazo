import { describe, expect, it } from "vitest";
import type * as A from "../src/compiler/ast";
import { analizarLexico } from "../src/compiler/lexer";
import { analizarSintaxis } from "../src/compiler/parser";
import { imprimirExpresion } from "../src/compiler/printer";

const parsear = (src: string) => analizarSintaxis(analizarLexico(src).tokens);

/** Parsea una expresión y la devuelve con paréntesis explícitos, para ver la forma del árbol. */
function forma(expr: string): string {
  const { ast, errores } = parsear(`mostrar(${expr});`);
  expect(errores).toHaveLength(0);
  const e = (ast.sentencias[0] as A.LlamadaSent).llamada.argumentos[0];
  const explicita = (n: A.Expresion): string => {
    if (n.tipo === "Binaria") return `(${explicita(n.izquierda)} ${n.operador} ${explicita(n.derecha)})`;
    if (n.tipo === "Unaria") return `(${n.operador} ${explicita(n.operando)})`;
    return imprimirExpresion(n);
  };
  return explicita(e);
}

describe("Parser: precedencia y asociatividad", () => {
  it("la multiplicación tiene más precedencia que la suma", () => {
    expect(forma("2 + 3 * 4")).toBe("(2 + (3 * 4))");
  });
  it("los operadores asocian a la izquierda", () => {
    expect(forma("10 - 3 - 2")).toBe("((10 - 3) - 2)");
    expect(forma("8 / 4 / 2")).toBe("((8 / 4) / 2)");
  });
  it("respeta los paréntesis", () => {
    expect(forma("(2 + 3) * 4")).toBe("((2 + 3) * 4)");
  });
  it("y tiene más precedencia que o, y la comparación más que y", () => {
    expect(forma("a < 1 o b y c")).toBe("((a < 1) o (b y c))");
  });
  it("los unarios se aplican antes que los binarios", () => {
    expect(forma("-x * 2")).toBe("((- x) * 2)");
    expect(forma("no a y b")).toBe("((no a) y b)");
  });
});

describe("Parser: sentencias", () => {
  it("construye el AST del ejemplo de la especificación", () => {
    const src = `funcion poligono(entero lados, decimal tam) {
      repetir lados veces { avanzar(tam); girar_derecha(360 / lados); }
    }
    entero i = 0;
    mientras (i < 36) {
      si (i % 2 == 0) { color("azul"); } sino { color("naranja"); }
      i = i + 1;
    }`;
    const { ast, errores } = parsear(src);
    expect(errores).toHaveLength(0);
    expect(ast.sentencias.map((s) => s.tipo)).toEqual(["DeclFuncion", "DeclVar", "Mientras"]);
    const f = ast.sentencias[0] as A.DeclFuncion;
    expect(f.parametros.map((p) => p.nombre)).toEqual(["lados", "tam"]);
    expect(f.tipoRetorno).toBeNull();
  });

  it("distingue asignación de llamada con un token de lookahead", () => {
    const { ast } = parsear("x = 1; avanzar(1);");
    expect(ast.sentencias.map((s) => s.tipo)).toEqual(["Asignacion", "LlamadaSent"]);
  });

  it("encadena si / sino si / sino", () => {
    const { ast, errores } = parsear("si (a) { } sino si (b) { } sino { }");
    expect(errores).toHaveLength(0);
    const s = ast.sentencias[0] as A.Si;
    expect(s.sino?.tipo).toBe("Si");
    expect((s.sino as A.Si).sino?.tipo).toBe("Bloque");
  });

  it("cada nodo guarda línea y columna", () => {
    const { ast } = parsear("\n  entero x = 1;");
    expect(ast.sentencias[0]).toMatchObject({ linea: 2, columna: 3 });
  });
});

describe("Parser: errores y recuperación en modo pánico", () => {
  it("reporta el ';' faltante con mensaje en español", () => {
    const { errores } = parsear("entero n = 5\nmientras (n > 0) { n = n - 1; }");
    expect(errores).toHaveLength(1);
    expect(errores[0]).toMatchObject({ fase: "Sintáctico", linea: 2, columna: 1 });
    expect(errores[0].mensaje).toBe("se esperaba ';' después de la expresión pero se encontró 'mientras'");
  });

  it("reporta varios errores en una sola pasada", () => {
    const src = "entero x = ;\nrepetir 3 { avanzar(1); }\navanzar(10;\nentero z = 1;";
    const { errores, ast } = parsear(src);
    expect(errores.map((e) => e.linea)).toEqual([1, 2, 3]);
    // Después de recuperarse sigue construyendo el árbol
    expect(ast.sentencias.some((s) => s.tipo === "DeclVar" && s.nombre === "z")).toBe(true);
  });

  it("detecta una llave sin cerrar", () => {
    const { errores } = parsear("si (a) {\n avanzar(1);");
    expect(errores[0].mensaje).toContain("falta '}'");
  });

  it("detecta un identificador suelto", () => {
    const { errores } = parsear("x;");
    expect(errores[0].mensaje).toBe("se esperaba '=' o '(' después de 'x' pero se encontró ';'");
  });
});
