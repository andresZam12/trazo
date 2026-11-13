import { describe, expect, it } from "vitest";
import type * as A from "../src/compiler/ast";
import { analizarLexico } from "../src/compiler/lexer";
import { analizarSintaxis } from "../src/compiler/parser";
import { compilar } from "../src/compiler/pipeline";
import { imprimirPrograma } from "../src/compiler/printer";
import { analizarSemantica, figurasPara } from "../src/compiler/semantic/checker";
import { EJEMPLOS } from "../src/examples";

const parsear = (src: string) => analizarSintaxis(analizarLexico(src).tokens);

function semantica(src: string) {
  const { ast, errores } = parsear(src);
  expect(errores).toEqual([]);
  return analizarSemantica(ast);
}
const mensajes = (src: string) => semantica(src).errores.map((e) => e.mensaje);
const porArchivo = Object.fromEntries(EJEMPLOS.map((e) => [e.archivo, e.codigo]));

describe("Música: parser", () => {
  it("reconoce tempo, métrica, compás, tocar, silencio y acorde", () => {
    const { ast, errores } = parsear("tempo 110;\ncompas 3/4;\ncompas { tocar do4 negra; silencio corchea; acorde [do4, mi4] corchea; }");
    expect(errores).toEqual([]);
    expect(ast.sentencias.map((s) => s.tipo)).toEqual(["Tempo", "CompasDecl", "BloqueCompas"]);
    const c = ast.sentencias[2] as A.BloqueCompas;
    expect(c.cuerpo.sentencias.map((s) => s.tipo)).toEqual(["Tocar", "Silencio", "Acorde"]);
  });

  it("separa la nota y la duración de tocar aunque la nota sea una expresión", () => {
    const { ast } = parsear("tocar base + 7 negra;");
    const t = ast.sentencias[0] as A.Tocar;
    expect(t.nota.tipo).toBe("Binaria");
    expect(t.duracion).toMatchObject({ tipo: "Literal", valor: 1, tipoLiteral: "duracion" });
  });

  it("reporta errores sintácticos de las sentencias musicales", () => {
    const { errores } = parsear("compas 4;\nacorde do4, mi4 negra;");
    expect(errores.map((e) => e.linea)).toEqual([1, 2]);
    expect(errores[1].mensaje).toContain("se esperaba '['");
  });
});

describe("Música: tipos", () => {
  it("transpone, calcula intervalos y compara notas", () => {
    const r = semantica("nota a = do4 + 7;\nentero i = mi4 - do4;\nlogico grave = do4 < sol4;\nduracion d = negra * 2;\nmostrar(\"a=\" + a + \" i=\" + i + \" d=\" + d);\nmostrar(grave);");
    expect(r.errores).toEqual([]);
  });

  it("no permite sumar dos notas", () => {
    expect(mensajes("nota x = do4 + mi4;")[0]).toBe("no se pueden sumar dos notas; ¿querías un acorde? (acorde [do4, mi4] negra;)");
  });

  it("revisa el tipo de lo que se toca y de su duración", () => {
    expect(mensajes("tocar 60 negra;")[0]).toContain("lo que se toca debe ser de tipo nota, pero es entero");
    expect(mensajes("tocar do4 2;")[0]).toContain("la duración de 'tocar' debe ser de tipo duracion");
  });

  it("detecta una transposición constante fuera del rango MIDI", () => {
    expect(mensajes("tocar si8 + 12 negra;")[0]).toContain("fuera del rango MIDI");
  });
});

describe("Música: validación de compases", () => {
  it("acepta compases que suman lo que exige la métrica (con repetir)", () => {
    const r = semantica("compas 3/4;\ncompas { tocar do4 blanca; tocar re4 negra; }\ncompas { repetir 6 veces { tocar mi4 corchea; } }");
    expect(r.errores).toEqual([]);
    expect(r.compases.map((c) => [c.numero, c.suma, c.esperado, c.valido])).toEqual([
      [1, 3, 3, true],
      [2, 3, 3, true],
    ]);
  });

  it("dice qué figura falta o sobra", () => {
    const m = mensajes("compas { tocar do4 negra; tocar re4 negra; tocar mi4 blanca; tocar fa4 corchea; }\ncompas { tocar do4 blanca; tocar re4 negra; tocar mi4 corchea; }");
    expect(m).toEqual([
      "el compás 1 suma 4.5 tiempos pero la métrica 4/4 exige 4 (sobra una corchea)",
      "el compás 2 suma 3.5 tiempos pero la métrica 4/4 exige 4 (falta una corchea)",
    ]);
    expect(figurasPara(1.5)).toEqual({ texto: "una negra y una corchea", plural: true });
  });

  it("6/8 equivale a 3 tiempos de negra", () => {
    expect(mensajes("compas 6/8;\ncompas { repetir 6 veces { tocar do4 corchea; } }")).toEqual([]);
  });

  it("solo permite tocar, silencio, acorde y repetir con número fijo dentro de un compás", () => {
    expect(mensajes("compas { avanzar(10); tocar do4 redonda; }")[0]).toContain("solo se permiten tocar, silencio, acorde y repetir");
    expect(mensajes("entero n = 4;\ncompas { repetir n veces { tocar do4 negra; } }")[0]).toContain("número fijo de veces");
  });

  it("advierte cuando se toca fuera de un compás", () => {
    const r = semantica("tocar do4 negra;");
    expect(r.errores).toEqual([]);
    expect(r.advertencias[0].mensaje).toBe("nota fuera de compás: no se valida la métrica");
  });
});

describe("Música: optimizador", () => {
  const optimizado = (src: string) => {
    const r = compilar(src);
    expect(r.errores).toEqual([]);
    return { codigo: imprimirPrograma(r.astOptimizado!), reglas: r.optimizaciones.map((c) => c.regla) };
  };

  it("pliega transposiciones y duraciones", () => {
    const { codigo, reglas } = optimizado("compas { tocar do4 + 7 negra * 2; tocar do4 + 12 blanca; }");
    expect(codigo).toContain("tocar sol4 blanca;");
    expect(codigo).toContain("tocar do5 blanca;");
    expect(reglas).toContain("Plegado de transposiciones");
    expect(reglas).toContain("Plegado de duraciones");
  });

  it("fusiona silencios seguidos", () => {
    const { codigo, reglas } = optimizado("compas { silencio negra; silencio negra; tocar do4 blanca; }");
    expect(codigo).toContain("silencio blanca;");
    expect(codigo.match(/silencio/g)).toHaveLength(1);
    expect(reglas).toContain("Fusión de silencios");
  });

  it("escribe una duración compuesta como suma de figuras", () => {
    expect(optimizado("compas { tocar do4 negra + corchea; tocar do4 corchea; tocar do4 blanca; }").codigo).toContain("tocar do4 negra + corchea;");
  });
});

describe("Música: ejecución", () => {
  it("genera eventos de sonido con su frecuencia y tiempo", () => {
    const r = compilar("tempo 120;\ncompas { tocar la4 negra; silencio negra; acorde [do4, mi4] blanca; }");
    const s = r.ejecucion!.sonidos;
    expect(s[0]).toMatchObject({ midi: 69, frecuencia: 440, inicio: 0, duracion: 0.5, linea: 2, instrumento: "piano" });
    // el acorde empieza después de la negra y el silencio (2 tiempos a 120 = 1 segundo)
    expect(s.slice(1).map((e) => [e.midi, e.inicio, e.duracion])).toEqual([
      [60, 1, 1],
      [64, 1, 1],
    ]);
    expect(r.ejecucion!.segundos).toBe(2);
    expect(r.ejecucion!.marcasCompas).toEqual([{ numero: 1, inicio: 0, linea: 2 }]);
    expect(r.fases.at(-1)!.detalle).toBe("3 notas, 2.0 s");
  });

  it("muestra las notas por su nombre", () => {
    const r = compilar('nota n = do4;\nn = n + 2;\nmostrar("nota: " + n);\nmostrar(negra * 3);');
    expect(r.ejecucion!.consola).toEqual(["nota: re4", "blanca + negra"]);
  });

  it("detecta en ejecución una nota fuera de rango", () => {
    const r = compilar("nota n = sol8;\nrepetir 3 veces { n = n + 12; }");
    expect(r.errores[0]).toMatchObject({ fase: "Ejecución" });
    expect(r.errores[0].mensaje).toContain("fuera del rango MIDI");
  });

  it("instrumento y volumen cambian las notas siguientes", () => {
    const r = compilar('instrumento("flauta");\nvolumen(0.5);\ntocar do4 negra;');
    expect(r.ejecucion!.sonidos[0]).toMatchObject({ instrumento: "flauta", volumen: 0.5 });
    expect(compilar('instrumento("violin");').errores[0].mensaje).toContain("instrumento desconocido");
  });

  it("dibujar_melodia hace que cada nota mueva el lápiz", () => {
    const r = compilar("dibujar_melodia(verdadero);\ntocar do4 negra;\ntocar re4 negra;");
    const lineas = r.ejecucion!.comandos.filter((c) => c.tipo === "linea");
    expect(lineas).toHaveLength(2);
    expect(lineas[1]).toMatchObject({ x2: 64, y2: 14 }); // 2 tiempos a la derecha, 2 semitonos arriba
  });
});

describe("Música: ejemplos 11 a 17", () => {
  it("los ejemplos musicales suenan", () => {
    for (const a of ["11_escala.trz", "12_himno_alegria.trz", "13_estrellita.trz", "14_acordes.trz", "15_melodia_que_dibuja.trz"]) {
      const r = compilar(porArchivo[a]);
      expect(r.errores).toEqual([]);
      expect(r.ejecucion!.sonidos.length).toBeGreaterThan(0);
    }
  });

  it("15 dibuja mientras suena", () => {
    const r = compilar(porArchivo["15_melodia_que_dibuja.trz"]);
    expect(r.ejecucion!.comandos.filter((c) => c.tipo === "linea").length).toBe(28);
  });

  it("16 falla en Semántico por la duración de los compases", () => {
    const r = compilar(porArchivo["16_error_compas.trz"]);
    expect(r.fases[2].estado).toBe("error");
    expect(r.errores.map((e) => e.mensaje)).toEqual([
      "el compás 2 suma 3.5 tiempos pero la métrica 4/4 exige 4 (falta una corchea)",
      "el compás 3 suma 5 tiempos pero la métrica 4/4 exige 4 (sobra una negra)",
    ]);
    expect(r.compases.map((c) => c.valido)).toEqual([true, false, false]);
  });

  it("17 falla en Léxico por do9, y corregido falla en Semántico por do4 + mi4", () => {
    const r = compilar(porArchivo["17_error_nota.trz"]);
    expect(r.fases[0].estado).toBe("error");
    const corregido = compilar(porArchivo["17_error_nota.trz"].replace("tocar do9", "tocar do5"));
    expect(corregido.fases[2].estado).toBe("error");
    expect(corregido.errores[0].mensaje).toContain("no se pueden sumar dos notas");
  });
});
