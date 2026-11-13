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

  it("reconoce notas con su valor MIDI", () => {
    const { tokens, errores } = analizarLexico("do4 la4 fa#3 sib5 dob4");
    expect(errores).toEqual([]);
    expect(tokens.slice(0, 5).map((t) => [t.tipo, t.valor])).toEqual([
      [TipoToken.NOTA, 60],
      [TipoToken.NOTA, 69],
      [TipoToken.NOTA, 54],
      [TipoToken.NOTA, 82],
      [TipoToken.NOTA, 59],
    ]);
  });

  it("usa lookahead para distinguir 'si' condicional de la nota si4", () => {
    expect(tipos("si (x) si4 sib3 sino")).toEqual([
      TipoToken.SI, TipoToken.PAR_IZQ, TipoToken.IDENT, TipoToken.PAR_DER,
      TipoToken.NOTA, TipoToken.NOTA, TipoToken.SINO, TipoToken.EOF,
    ]);
  });

  it("no confunde identificadores que empiezan como una nota", () => {
    const { tokens } = analizarLexico("doble lados sol mi re2x");
    expect(tokens.slice(0, 5).every((t) => t.tipo === TipoToken.IDENT)).toBe(true);
  });

  it("reconoce las palabras musicales", () => {
    expect(tipos("tocar negra compas tempo acorde [ ]")).toEqual([
      TipoToken.TOCAR, TipoToken.NEGRA, TipoToken.COMPAS, TipoToken.TEMPO, TipoToken.ACORDE,
      TipoToken.CORCHETE_IZQ, TipoToken.CORCHETE_DER, TipoToken.EOF,
    ]);
  });

  it("reporta octava fuera de rango y alteración inválida", () => {
    const { errores } = analizarLexico("tocar do9 negra;\ntocar do##4 negra;");
    expect(errores).toHaveLength(2);
    expect(errores[0]).toMatchObject({ linea: 1, columna: 7 });
    expect(errores[0].mensaje).toContain("octava fuera de rango en 'do9'");
    expect(errores[1].mensaje).toContain("alteración inválida '##'");
  });

  it("reporta números mal formados", () => {
    const { errores } = analizarLexico("3. 1.2.3 4.5");
    expect(errores.map((e) => e.mensaje)).toEqual([
      expect.stringContaining("'3.'"),
      expect.stringContaining("'1.2.3'"),
    ]);
  });
});
