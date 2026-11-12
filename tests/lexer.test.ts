import { describe, expect, it } from "vitest";
import { analizarLexico } from "../src/compiler/lexer";
import { TipoToken } from "../src/compiler/tokens";

const tipos = (src: string) => analizarLexico(src).tokens.map((t) => t.tipo);

describe("Lexer", () => {
  it("reconoce palabras reservadas, identificadores y literales", () => {
    const { tokens, errores } = analizarLexico('entero año = 12; decimal pi = 3.14; texto t = "hola";');
    expect(errores).toHaveLength(0);
    expect(tokens.map((t) => t.tipo)).toEqual([
      TipoToken.TIPO_ENTERO, TipoToken.IDENT, TipoToken.ASIGNAR, TipoToken.ENTERO, TipoToken.PUNTO_COMA,
      TipoToken.TIPO_DECIMAL, TipoToken.IDENT, TipoToken.ASIGNAR, TipoToken.DECIMAL, TipoToken.PUNTO_COMA,
      TipoToken.TIPO_TEXTO, TipoToken.IDENT, TipoToken.ASIGNAR, TipoToken.TEXTO, TipoToken.PUNTO_COMA,
      TipoToken.EOF,
    ]);
    expect(tokens[1].lexema).toBe("año");
    expect(tokens[8].valor).toBe(3.14);
    expect(tokens[13].valor).toBe("hola");
  });

  it("usa máxima coincidencia en operadores de dos caracteres", () => {
    expect(tipos("<= >= == != < > =")).toEqual([
      TipoToken.MENOR_IGUAL, TipoToken.MAYOR_IGUAL, TipoToken.IGUAL_IGUAL, TipoToken.DISTINTO,
      TipoToken.MENOR, TipoToken.MAYOR, TipoToken.ASIGNAR, TipoToken.EOF,
    ]);
  });

  it("lleva línea y columna de cada token", () => {
    const { tokens } = analizarLexico("entero x;\n  x = 1;");
    const x2 = tokens[3];
    expect(x2).toMatchObject({ lexema: "x", linea: 2, columna: 3 });
  });

  it("ignora comentarios de línea y de bloque", () => {
    expect(tipos("// hola\n/* varias\nlíneas */ y")).toEqual([TipoToken.Y, TipoToken.EOF]);
  });

  it("procesa los escapes de texto", () => {
    const { tokens } = analizarLexico('"di \\"hola\\"\\n"');
    expect(tokens[0].valor).toBe('di "hola"\n');
  });

  it("reporta caracteres inválidos y sigue analizando", () => {
    const { tokens, errores } = analizarLexico("entero x = 1 @ 2 # 3;");
    expect(errores).toHaveLength(2);
    expect(errores[0]).toMatchObject({ fase: "Léxico", linea: 1, columna: 14 });
    expect(errores[0].mensaje).toContain("'@'");
    expect(tokens.some((t) => t.tipo === TipoToken.PUNTO_COMA)).toBe(true);
  });

  it("reporta texto sin cerrar", () => {
    const { errores } = analizarLexico('texto t = "hola;\nentero x;');
    expect(errores).toHaveLength(1);
    expect(errores[0].mensaje).toContain("texto sin cerrar");
    expect(errores[0].linea).toBe(1);
  });

  it("reporta comentario de bloque sin cerrar", () => {
    const { errores } = analizarLexico("entero x;\n/* nunca termina");
    expect(errores[0]).toMatchObject({ linea: 2, columna: 1 });
    expect(errores[0].mensaje).toContain("sin cerrar");
  });

  it("reporta números mal formados", () => {
    const { errores } = analizarLexico("3. 1.2.3 4.5");
    expect(errores.map((e) => e.mensaje)).toEqual([
      expect.stringContaining("'3.'"),
      expect.stringContaining("'1.2.3'"),
    ]);
  });
});
