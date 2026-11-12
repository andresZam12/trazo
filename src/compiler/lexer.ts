// Analizador léxico (scanner) de Trazo.
// Recorre el texto carácter por carácter y agrupa los caracteres en tokens.
// Ante un error léxico no se detiene: lo reporta y sigue, para mostrar todos
// los errores de la fase en una sola pasada.

import { crearError, ErrorCompilacion } from "./errors";
import { PALABRAS_RESERVADAS, TipoToken, Token } from "./tokens";

const LETRAS_ESPECIALES = "áéíóúÁÉÍÓÚñÑüÜ";

function esLetra(c: string): boolean {
  return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_" || LETRAS_ESPECIALES.includes(c);
}

function esDigito(c: string): boolean {
  return c >= "0" && c <= "9";
}

export interface ResultadoLexico {
  tokens: Token[];
  errores: ErrorCompilacion[];
}

export class Lexer {
  private pos = 0;
  private linea = 1;
  private columna = 1;
  private tokens: Token[] = [];
  private errores: ErrorCompilacion[] = [];

  constructor(private readonly fuente: string) {}

  /** Punto de entrada: devuelve todos los tokens (terminando en EOF) y los errores léxicos. */
  analizar(): ResultadoLexico {
    while (!this.alFinal()) {
      this.escanearToken();
    }
    this.tokens.push({ tipo: TipoToken.EOF, lexema: "", linea: this.linea, columna: this.columna });
    return { tokens: this.tokens, errores: this.errores };
  }

  // ---------- utilidades de lectura ----------

  private alFinal(): boolean {
    return this.pos >= this.fuente.length;
  }

  private actual(): string {
    return this.fuente[this.pos] ?? "\0";
  }

  private siguiente(): string {
    return this.fuente[this.pos + 1] ?? "\0";
  }

  /** Consume un carácter y actualiza línea/columna (las columnas empiezan en 1). */
  private avanzar(): string {
    const c = this.fuente[this.pos++];
    if (c === "\n") {
      this.linea++;
      this.columna = 1;
    } else {
      this.columna++;
    }
    return c;
  }

  private agregar(tipo: TipoToken, lexema: string, linea: number, columna: number, valor?: number | string) {
    this.tokens.push({ tipo, lexema, linea, columna, valor });
  }

  private error(mensaje: string, linea: number, columna: number, longitud = 1) {
    this.errores.push(crearError("Léxico", mensaje, linea, columna, longitud));
  }

  // ---------- reconocimiento ----------

  /** Decide qué tipo de token empieza en la posición actual mirando el primer carácter. */
  private escanearToken() {
    const c = this.actual();
    const linea = this.linea;
    const columna = this.columna;

    // Espacios en blanco: se ignoran
    if (c === " " || c === "\t" || c === "\r" || c === "\n") {
      this.avanzar();
      return;
    }

    // Comentarios
    if (c === "/" && this.siguiente() === "/") {
      while (!this.alFinal() && this.actual() !== "\n") this.avanzar();
      return;
    }
    if (c === "/" && this.siguiente() === "*") {
      this.comentarioBloque(linea, columna);
      return;
    }

    if (esDigito(c)) return this.numero(linea, columna);
    if (esLetra(c)) return this.identificador(linea, columna);
    if (c === '"') return this.texto(linea, columna);

    // Operadores de dos caracteres: se revisan antes que los de uno (máxima coincidencia)
    const dos = c + this.siguiente();
    const operadoresDobles: Record<string, TipoToken> = {
      "==": TipoToken.IGUAL_IGUAL,
      "!=": TipoToken.DISTINTO,
      "<=": TipoToken.MENOR_IGUAL,
      ">=": TipoToken.MAYOR_IGUAL,
    };
    if (operadoresDobles[dos]) {
      this.avanzar();
      this.avanzar();
      this.agregar(operadoresDobles[dos], dos, linea, columna);
      return;
    }

    const simples: Record<string, TipoToken> = {
      "+": TipoToken.MAS,
      "-": TipoToken.MENOS,
      "*": TipoToken.POR,
      "/": TipoToken.DIV,
      "%": TipoToken.MOD,
      "<": TipoToken.MENOR,
      ">": TipoToken.MAYOR,
      "=": TipoToken.ASIGNAR,
      "(": TipoToken.PAR_IZQ,
      ")": TipoToken.PAR_DER,
      "{": TipoToken.LLAVE_IZQ,
      "}": TipoToken.LLAVE_DER,
      ",": TipoToken.COMA,
      ";": TipoToken.PUNTO_COMA,
    };
    if (simples[c]) {
      this.avanzar();
      this.agregar(simples[c], c, linea, columna);
      return;
    }

    // Cualquier otro carácter es inválido: se reporta y se salta (recuperación)
    this.avanzar();
    if (c === "!") {
      this.error(`carácter inválido '!'. ¿Quisiste escribir '!=' o la palabra 'no'?`, linea, columna);
    } else {
      this.error(`carácter inválido '${c}'`, linea, columna);
    }
  }

  /** Comentario de bloque: consume hasta "*\/"; si el archivo se acaba antes, es error. */
  private comentarioBloque(linea: number, columna: number) {
    this.avanzar();
    this.avanzar();
    while (!this.alFinal()) {
      if (this.actual() === "*" && this.siguiente() === "/") {
        this.avanzar();
        this.avanzar();
        return;
      }
      this.avanzar();
    }
    this.error("comentario de bloque sin cerrar (falta '*/')", linea, columna, 2);
  }

  /**
   * Números: ENTERO = dígitos; DECIMAL = dígitos "." dígitos.
   * "3." y "1.2.3" son números mal formados.
   */
  private numero(linea: number, columna: number) {
    const inicio = this.pos;
    while (esDigito(this.actual())) this.avanzar();

    let esDecimal = false;
    if (this.actual() === ".") {
      esDecimal = true;
      this.avanzar();
      if (!esDigito(this.actual())) {
        const lexema = this.fuente.slice(inicio, this.pos);
        this.error(`número mal formado '${lexema}': falta la parte decimal después del punto`, linea, columna, lexema.length);
        return;
      }
      while (esDigito(this.actual())) this.avanzar();

      // Un segundo punto (1.2.3) vuelve inválido todo el número
      if (this.actual() === "." ) {
        while (esDigito(this.actual()) || this.actual() === ".") this.avanzar();
        const lexema = this.fuente.slice(inicio, this.pos);
        this.error(`número mal formado '${lexema}': tiene más de un punto decimal`, linea, columna, lexema.length);
        return;
      }
    }

    const lexema = this.fuente.slice(inicio, this.pos);
    if (esDecimal) this.agregar(TipoToken.DECIMAL, lexema, linea, columna, parseFloat(lexema));
    else this.agregar(TipoToken.ENTERO, lexema, linea, columna, parseInt(lexema, 10));
  }

  /** Identificador o palabra reservada (se distinguen con la tabla de reservadas). */
  private identificador(linea: number, columna: number) {
    const inicio = this.pos;
    while (esLetra(this.actual()) || esDigito(this.actual())) this.avanzar();
    const lexema = this.fuente.slice(inicio, this.pos);
    const reservada = PALABRAS_RESERVADAS[lexema];
    this.agregar(reservada ?? TipoToken.IDENT, lexema, linea, columna);
  }

  /** Texto entre comillas dobles, con los escapes \" y \n. No puede cruzar líneas. */
  private texto(linea: number, columna: number) {
    const inicio = this.pos;
    this.avanzar(); // comilla de apertura
    let valor = "";
    while (!this.alFinal() && this.actual() !== '"' && this.actual() !== "\n") {
      if (this.actual() === "\\") {
        const esc = this.siguiente();
        if (esc === '"') { valor += '"'; this.avanzar(); this.avanzar(); continue; }
        if (esc === "n") { valor += "\n"; this.avanzar(); this.avanzar(); continue; }
        if (esc === "\\") { valor += "\\"; this.avanzar(); this.avanzar(); continue; }
      }
      valor += this.avanzar();
    }
    if (this.actual() !== '"') {
      this.error("texto sin cerrar (falta la comilla '\"' final)", linea, columna, this.pos - inicio);
      return;
    }
    this.avanzar(); // comilla de cierre
    this.agregar(TipoToken.TEXTO, this.fuente.slice(inicio, this.pos), linea, columna, valor);
  }
}

/** Atajo funcional para las pruebas y el pipeline. */
export function analizarLexico(fuente: string): ResultadoLexico {
  return new Lexer(fuente).analizar();
}
