// Analizador sintáctico descendente recursivo (top-down) de Trazo.
// Cada regla de la gramática es un método; encima de cada método está la regla
// que implementa. Es LL(1): decide qué regla aplicar mirando el token actual,
// con un token extra de lookahead para distinguir asignación de llamada.
//
// Precedencia: cada nivel de operadores es un método que llama al nivel de
// mayor precedencia (o → y → igualdad → comparacion → suma → producto → unario).
// Así, en 2 + 3 * 4 la multiplicación queda más abajo en el árbol y se evalúa primero.
// Asociatividad izquierda: los bucles `while` van construyendo ((a - b) - c).
//
// Recuperación de errores en modo pánico: al encontrar un error se lanza una
// excepción interna, se registra el error y se descartan tokens hasta un punto
// seguro (';', '}' o el inicio de una sentencia). Así se reportan varios errores
// sintácticos en una sola pasada.

import type * as A from "./ast";
import { crearError, ErrorCompilacion } from "./errors";
import { TIPOS_DE_DATO, TipoToken, Token } from "./tokens";

/** Excepción interna para salir de la regla actual y sincronizar. */
class ErrorSintactico extends Error {}

export interface ResultadoSintactico {
  ast: A.Programa;
  errores: ErrorCompilacion[];
}

/** Tokens con los que puede empezar una sentencia: puntos seguros para sincronizar. */
const INICIO_SENTENCIA = new Set<TipoToken>([
  ...TIPOS_DE_DATO,
  TipoToken.FUNCION,
  TipoToken.SI,
  TipoToken.MIENTRAS,
  TipoToken.REPETIR,
  TipoToken.RETORNAR,
  TipoToken.LLAVE_IZQ,
]);

export class Parser {
  private pos = 0;
  private errores: ErrorCompilacion[] = [];

  constructor(private readonly tokens: Token[]) {}

  // programa → sentencia* EOF
  analizar(): ResultadoSintactico {
    const primero = this.actual();
    const sentencias: A.Sentencia[] = [];
    while (!this.es(TipoToken.EOF)) {
      if (this.es(TipoToken.LLAVE_DER)) {
        // Una '}' sin su '{': se reporta y se descarta
        const t = this.avanzar();
        this.registrarError("se encontró '}' sin una '{' que la abra", t);
        continue;
      }
      const s = this.sentenciaConRecuperacion();
      if (s) sentencias.push(s);
    }
    return {
      ast: { tipo: "Programa", sentencias, linea: primero.linea, columna: primero.columna },
      errores: this.errores,
    };
  }

  // ---------------- utilidades ----------------

  private actual(): Token {
    return this.tokens[this.pos];
  }

  private mirar(desplazamiento: number): Token {
    return this.tokens[Math.min(this.pos + desplazamiento, this.tokens.length - 1)];
  }

  private anterior(): Token {
    return this.tokens[Math.max(0, this.pos - 1)];
  }

  private es(tipo: TipoToken): boolean {
    return this.actual().tipo === tipo;
  }

  private avanzar(): Token {
    const t = this.actual();
    if (t.tipo !== TipoToken.EOF) this.pos++;
    return t;
  }

  /** Si el token actual es de alguno de los tipos dados, lo consume. */
  private coincide(...tipos: TipoToken[]): Token | null {
    if (tipos.includes(this.actual().tipo)) return this.avanzar();
    return null;
  }

  /** Exige un token; si no está, lanza un error con un mensaje en español. */
  private consumir(tipo: TipoToken, contexto: string): Token {
    if (this.es(tipo)) return this.avanzar();
    // "IDENT" es un nombre interno; al usuario se le dice "un nombre"
    const esperado = tipo === TipoToken.IDENT ? "un nombre" : `'${tipo}'`;
    throw this.errorEn(this.actual(), `se esperaba ${esperado} ${contexto} pero se encontró ${describir(this.actual())}`);
  }

  private registrarError(mensaje: string, token: Token) {
    this.errores.push(crearError("Sintáctico", mensaje, token.linea, token.columna, Math.max(1, token.lexema.length)));
  }

  private errorEn(token: Token, mensaje: string): ErrorSintactico {
    this.registrarError(mensaje, token);
    return new ErrorSintactico(mensaje);
  }

  /** Envuelve `sentencia()` con la recuperación en modo pánico. */
  private sentenciaConRecuperacion(): A.Sentencia | null {
    const inicio = this.pos;
    try {
      return this.sentencia();
    } catch (e) {
      if (!(e instanceof ErrorSintactico)) throw e;
      this.sincronizar(inicio);
      return null;
    }
  }

  /**
   * Modo pánico: descarta tokens hasta justo después de un ';', o hasta una '}'
   * o el inicio de otra sentencia. Siempre avanza al menos un token para no
   * quedar en un ciclo infinito.
   */
  private sincronizar(inicio: number) {
    if (this.pos === inicio) this.avanzar();
    while (!this.es(TipoToken.EOF)) {
      if (this.anterior().tipo === TipoToken.PUNTO_COMA) return;
      if (this.es(TipoToken.LLAVE_DER) || INICIO_SENTENCIA.has(this.actual().tipo)) return;
      this.avanzar();
    }
  }

  // ---------------- sentencias ----------------

  // sentencia → declVar | declFuncion | asignacion | si | mientras
  //           | repetir | retornar | llamadaSent | bloque
  private sentencia(): A.Sentencia {
    const t = this.actual();
    if (TIPOS_DE_DATO.includes(t.tipo)) return this.declVar();
    switch (t.tipo) {
      case TipoToken.FUNCION: return this.declFuncion();
      case TipoToken.SI: return this.si();
      case TipoToken.MIENTRAS: return this.mientras();
      case TipoToken.REPETIR: return this.repetir();
      case TipoToken.RETORNAR: return this.retornar();
      case TipoToken.LLAVE_IZQ: return this.bloque();
      case TipoToken.IDENT: {
        // Lookahead extra: IDENT "=" es asignación, IDENT "(" es llamada
        const sig = this.mirar(1);
        if (sig.tipo === TipoToken.ASIGNAR) return this.asignacion();
        if (sig.tipo === TipoToken.PAR_IZQ) return this.llamadaSent();
        this.avanzar();
        throw this.errorEn(sig, `se esperaba '=' o '(' después de '${t.lexema}' pero se encontró ${describir(sig)}`);
      }
    }
    throw this.errorEn(t, `se esperaba el inicio de una sentencia pero se encontró ${describir(t)}`);
  }

  // tipo → "entero" | "decimal" | "texto" | "logico"
  private tipo(contexto: string): A.TipoDeclarado {
    const t = this.coincide(...TIPOS_DE_DATO);
    if (!t) throw this.errorEn(this.actual(), `se esperaba un tipo (entero, decimal, texto o logico) ${contexto} pero se encontró ${describir(this.actual())}`);
    return t.lexema as A.TipoDeclarado;
  }

  // declVar → tipo IDENT ( "=" expresion )? ";"
  private declVar(): A.DeclVar {
    const inicio = this.actual();
    const tipoVar = this.tipo("");
    const nombre = this.consumir(TipoToken.IDENT, `después del tipo '${tipoVar}'`);
    let inicial: A.Expresion | null = null;
    if (this.coincide(TipoToken.ASIGNAR)) inicial = this.expresion();
    this.consumir(TipoToken.PUNTO_COMA, inicial ? "después de la expresión" : `después de '${nombre.lexema}'`);
    return { tipo: "DeclVar", tipoVar, nombre: nombre.lexema, inicial, linea: inicio.linea, columna: inicio.columna };
  }

  // declFuncion → "funcion" tipo? IDENT "(" parametros? ")" bloque
  // parametros  → tipo IDENT ( "," tipo IDENT )*
  private declFuncion(): A.DeclFuncion {
    const inicio = this.avanzar(); // 'funcion'
    let tipoRetorno: A.TipoDeclarado | null = null;
    if (TIPOS_DE_DATO.includes(this.actual().tipo)) tipoRetorno = this.tipo("");
    const nombre = this.consumir(TipoToken.IDENT, "como nombre de la función");
    this.consumir(TipoToken.PAR_IZQ, `después del nombre '${nombre.lexema}'`);
    const parametros: A.Parametro[] = [];
    if (!this.es(TipoToken.PAR_DER)) {
      do {
        const tp = this.actual();
        const tipoParam = this.tipo("en el parámetro");
        const np = this.consumir(TipoToken.IDENT, `después del tipo '${tipoParam}' del parámetro`);
        parametros.push({ tipoParam, nombre: np.lexema, linea: tp.linea, columna: tp.columna });
      } while (this.coincide(TipoToken.COMA));
    }
    this.consumir(TipoToken.PAR_DER, "al final de los parámetros");
    const cuerpo = this.bloque();
    return { tipo: "DeclFuncion", tipoRetorno, nombre: nombre.lexema, parametros, cuerpo, linea: inicio.linea, columna: inicio.columna };
  }

  // asignacion → IDENT "=" expresion ";"
  private asignacion(): A.Asignacion {
    const nombre = this.avanzar();
    this.avanzar(); // '='
    const valor = this.expresion();
    this.consumir(TipoToken.PUNTO_COMA, "después de la expresión");
    return { tipo: "Asignacion", nombre: nombre.lexema, valor, linea: nombre.linea, columna: nombre.columna };
  }

  // si → "si" "(" expresion ")" bloque ( "sino" ( si | bloque ) )?
  private si(): A.Si {
    const inicio = this.avanzar();
    this.consumir(TipoToken.PAR_IZQ, "después de 'si'");
    const condicion = this.expresion();
    this.consumir(TipoToken.PAR_DER, "después de la condición");
    const entonces = this.bloque();
    let sino: A.Bloque | A.Si | null = null;
    if (this.coincide(TipoToken.SINO)) {
      sino = this.es(TipoToken.SI) ? this.si() : this.bloque();
    }
    return { tipo: "Si", condicion, entonces, sino, linea: inicio.linea, columna: inicio.columna };
  }

  // mientras → "mientras" "(" expresion ")" bloque
  private mientras(): A.Mientras {
    const inicio = this.avanzar();
    this.consumir(TipoToken.PAR_IZQ, "después de 'mientras'");
    const condicion = this.expresion();
    this.consumir(TipoToken.PAR_DER, "después de la condición");
    const cuerpo = this.bloque();
    return { tipo: "Mientras", condicion, cuerpo, linea: inicio.linea, columna: inicio.columna };
  }

  // repetir → "repetir" expresion "veces" bloque
  private repetir(): A.Repetir {
    const inicio = this.avanzar();
    const veces = this.expresion();
    this.consumir(TipoToken.VECES, "después del número de repeticiones");
    const cuerpo = this.bloque();
    return { tipo: "Repetir", veces, cuerpo, linea: inicio.linea, columna: inicio.columna };
  }

  // retornar → "retornar" expresion? ";"
  private retornar(): A.Retornar {
    const inicio = this.avanzar();
    let valor: A.Expresion | null = null;
    if (!this.es(TipoToken.PUNTO_COMA)) valor = this.expresion();
    this.consumir(TipoToken.PUNTO_COMA, valor ? "después de la expresión" : "después de 'retornar'");
    return { tipo: "Retornar", valor, linea: inicio.linea, columna: inicio.columna };
  }

  // llamadaSent → llamada ";"
  private llamadaSent(): A.LlamadaSent {
    const llamada = this.llamada();
    this.consumir(TipoToken.PUNTO_COMA, "después de la llamada");
    return { tipo: "LlamadaSent", llamada, linea: llamada.linea, columna: llamada.columna };
  }

  // bloque → "{" sentencia* "}"
  private bloque(): A.Bloque {
    const inicio = this.consumir(TipoToken.LLAVE_IZQ, "para abrir el bloque");
    const sentencias: A.Sentencia[] = [];
    while (!this.es(TipoToken.LLAVE_DER) && !this.es(TipoToken.EOF)) {
      const s = this.sentenciaConRecuperacion();
      if (s) sentencias.push(s);
    }
    if (this.es(TipoToken.EOF)) {
      this.registrarError(`falta '}' para cerrar el bloque abierto en la línea ${inicio.linea}`, this.actual());
    } else {
      this.avanzar();
    }
    return { tipo: "Bloque", sentencias, linea: inicio.linea, columna: inicio.columna };
  }

  // ---------------- expresiones (un método por nivel de precedencia) ----------------

  // expresion → o
  private expresion(): A.Expresion {
    return this.o();
  }

  /** Plantilla común de los niveles binarios asociativos a la izquierda. */
  private binariaIzq(siguiente: () => A.Expresion, operadores: TipoToken[]): A.Expresion {
    let izquierda = siguiente();
    let op: Token | null;
    while ((op = this.coincide(...operadores))) {
      const derecha = siguiente();
      izquierda = {
        tipo: "Binaria",
        operador: op.lexema as A.OperadorBinario,
        izquierda,
        derecha,
        linea: op.linea,
        columna: op.columna,
      };
    }
    return izquierda;
  }

  // o → y ( "o" y )*
  private o(): A.Expresion {
    return this.binariaIzq(() => this.y(), [TipoToken.O]);
  }

  // y → igualdad ( "y" igualdad )*
  private y(): A.Expresion {
    return this.binariaIzq(() => this.igualdad(), [TipoToken.Y]);
  }

  // igualdad → comparacion ( ( "==" | "!=" ) comparacion )*
  private igualdad(): A.Expresion {
    return this.binariaIzq(() => this.comparacion(), [TipoToken.IGUAL_IGUAL, TipoToken.DISTINTO]);
  }

  // comparacion → suma ( ( "<" | ">" | "<=" | ">=" ) suma )*
  private comparacion(): A.Expresion {
    return this.binariaIzq(() => this.suma(), [TipoToken.MENOR, TipoToken.MAYOR, TipoToken.MENOR_IGUAL, TipoToken.MAYOR_IGUAL]);
  }

  // suma → producto ( ( "+" | "-" ) producto )*
  private suma(): A.Expresion {
    return this.binariaIzq(() => this.producto(), [TipoToken.MAS, TipoToken.MENOS]);
  }

  // producto → unario ( ( "*" | "/" | "%" ) unario )*
  private producto(): A.Expresion {
    return this.binariaIzq(() => this.unario(), [TipoToken.POR, TipoToken.DIV, TipoToken.MOD]);
  }

  // unario → ( "-" | "no" ) unario | primario
  private unario(): A.Expresion {
    const op = this.coincide(TipoToken.MENOS, TipoToken.NO);
    if (op) {
      const operando = this.unario();
      return { tipo: "Unaria", operador: op.lexema as "-" | "no", operando, linea: op.linea, columna: op.columna };
    }
    return this.primario();
  }

  // primario → ENTERO | DECIMAL | TEXTO | "verdadero" | "falso"
  //          | llamada | IDENT | "(" expresion ")"
  private primario(): A.Expresion {
    const t = this.actual();
    switch (t.tipo) {
      case TipoToken.ENTERO:
        this.avanzar();
        return { tipo: "Literal", valor: t.valor as number, tipoLiteral: "entero", linea: t.linea, columna: t.columna };
      case TipoToken.DECIMAL:
        this.avanzar();
        return { tipo: "Literal", valor: t.valor as number, tipoLiteral: "decimal", linea: t.linea, columna: t.columna };
      case TipoToken.TEXTO:
        this.avanzar();
        return { tipo: "Literal", valor: t.valor as string, tipoLiteral: "texto", linea: t.linea, columna: t.columna };
      case TipoToken.VERDADERO:
      case TipoToken.FALSO:
        this.avanzar();
        return { tipo: "Literal", valor: t.tipo === TipoToken.VERDADERO, tipoLiteral: "logico", linea: t.linea, columna: t.columna };
      case TipoToken.IDENT:
        if (this.mirar(1).tipo === TipoToken.PAR_IZQ) return this.llamada();
        this.avanzar();
        return { tipo: "Identificador", nombre: t.lexema, linea: t.linea, columna: t.columna };
      case TipoToken.PAR_IZQ: {
        this.avanzar();
        const e = this.expresion();
        this.consumir(TipoToken.PAR_DER, "para cerrar el paréntesis");
        return e;
      }
    }
    throw this.errorEn(t, `se esperaba una expresión pero se encontró ${describir(t)}`);
  }

  // llamada → IDENT "(" argumentos? ")"
  // argumentos → expresion ( "," expresion )*
  private llamada(): A.Llamada {
    const nombre = this.avanzar();
    this.avanzar(); // '('
    const argumentos: A.Expresion[] = [];
    if (!this.es(TipoToken.PAR_DER)) {
      do {
        argumentos.push(this.expresion());
      } while (this.coincide(TipoToken.COMA));
    }
    this.consumir(TipoToken.PAR_DER, `para cerrar la llamada a '${nombre.lexema}'`);
    return { tipo: "Llamada", nombre: nombre.lexema, argumentos, linea: nombre.linea, columna: nombre.columna };
  }
}

/** Describe un token para los mensajes de error. */
function describir(t: Token): string {
  if (t.tipo === TipoToken.EOF) return "el final del archivo";
  return `'${t.lexema}'`;
}

export function analizarSintaxis(tokens: Token[]): ResultadoSintactico {
  return new Parser(tokens).analizar();
}
