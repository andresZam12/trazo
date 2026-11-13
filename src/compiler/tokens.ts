// Definición de los tokens de Trazo.
// El lexer convierte el texto fuente en una lista de estos tokens; el parser solo
// trabaja con tokens, nunca con caracteres sueltos.

export enum TipoToken {
  // Literales e identificadores
  ENTERO = "ENTERO",
  DECIMAL = "DECIMAL",
  TEXTO = "TEXTO",
  NOTA = "NOTA", // do4, fa#3, sib5 (su valor es el número MIDI)
  IDENT = "IDENT",

  // Palabras reservadas
  TIPO_ENTERO = "entero",
  TIPO_DECIMAL = "decimal",
  TIPO_TEXTO = "texto",
  TIPO_LOGICO = "logico",
  SI = "si",
  SINO = "sino",
  MIENTRAS = "mientras",
  REPETIR = "repetir",
  VECES = "veces",
  FUNCION = "funcion",
  RETORNAR = "retornar",
  VERDADERO = "verdadero",
  FALSO = "falso",
  Y = "y",
  O = "o",
  NO = "no",

  // Música
  TIPO_NOTA = "nota",
  TIPO_DURACION = "duracion",
  TOCAR = "tocar",
  SILENCIO = "silencio",
  ACORDE = "acorde",
  COMPAS = "compas",
  TEMPO = "tempo",
  REDONDA = "redonda",
  BLANCA = "blanca",
  NEGRA = "negra",
  CORCHEA = "corchea",
  SEMICORCHEA = "semicorchea",

  // Operadores
  MAS = "+",
  MENOS = "-",
  POR = "*",
  DIV = "/",
  MOD = "%",
  IGUAL_IGUAL = "==",
  DISTINTO = "!=",
  MENOR = "<",
  MAYOR = ">",
  MENOR_IGUAL = "<=",
  MAYOR_IGUAL = ">=",
  ASIGNAR = "=",

  // Delimitadores
  PAR_IZQ = "(",
  PAR_DER = ")",
  LLAVE_IZQ = "{",
  LLAVE_DER = "}",
  CORCHETE_IZQ = "[",
  CORCHETE_DER = "]",
  COMA = ",",
  PUNTO_COMA = ";",

  EOF = "EOF",
}

export interface Token {
  tipo: TipoToken;
  lexema: string;
  linea: number;
  columna: number;
  /** Valor ya interpretado para literales (número o texto sin comillas). */
  valor?: number | string;
}

/** Tabla de palabras reservadas: si un identificador está aquí, es palabra clave. */
export const PALABRAS_RESERVADAS: Record<string, TipoToken> = {
  entero: TipoToken.TIPO_ENTERO,
  decimal: TipoToken.TIPO_DECIMAL,
  texto: TipoToken.TIPO_TEXTO,
  logico: TipoToken.TIPO_LOGICO,
  si: TipoToken.SI,
  sino: TipoToken.SINO,
  mientras: TipoToken.MIENTRAS,
  repetir: TipoToken.REPETIR,
  veces: TipoToken.VECES,
  funcion: TipoToken.FUNCION,
  retornar: TipoToken.RETORNAR,
  verdadero: TipoToken.VERDADERO,
  falso: TipoToken.FALSO,
  y: TipoToken.Y,
  o: TipoToken.O,
  no: TipoToken.NO,
  nota: TipoToken.TIPO_NOTA,
  duracion: TipoToken.TIPO_DURACION,
  tocar: TipoToken.TOCAR,
  silencio: TipoToken.SILENCIO,
  acorde: TipoToken.ACORDE,
  compas: TipoToken.COMPAS,
  tempo: TipoToken.TEMPO,
  redonda: TipoToken.REDONDA,
  blanca: TipoToken.BLANCA,
  negra: TipoToken.NEGRA,
  corchea: TipoToken.CORCHEA,
  semicorchea: TipoToken.SEMICORCHEA,
};

/** Figuras musicales y su duración en tiempos (una negra = 1 tiempo). */
export const FIGURAS: Record<string, number> = {
  redonda: 4,
  blanca: 2,
  negra: 1,
  corchea: 0.5,
  semicorchea: 0.25,
};

/** Semitono de cada nombre de nota dentro de una octava (do = 0). */
export const SEMITONOS: Record<string, number> = { do: 0, re: 2, mi: 4, fa: 5, sol: 7, la: 9, si: 11 };

const NOMBRES_MIDI = ["do", "do#", "re", "re#", "mi", "fa", "fa#", "sol", "sol#", "la", "la#", "si"];

/** Número MIDI → nombre de nota (60 → "do4"). Usa sostenidos. */
export function nombreNota(midi: number): string {
  return `${NOMBRES_MIDI[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

/** Categoría de un token, usada por la UI para colorear la tabla de tokens. */
export type CategoriaToken = "palabra" | "identificador" | "literal" | "operador" | "delimitador" | "fin";

export function categoriaDe(tipo: TipoToken): CategoriaToken {
  if (tipo === TipoToken.EOF) return "fin";
  if (tipo === TipoToken.IDENT) return "identificador";
  if ([TipoToken.ENTERO, TipoToken.DECIMAL, TipoToken.TEXTO, TipoToken.NOTA].includes(tipo)) return "literal";
  if (Object.values(PALABRAS_RESERVADAS).includes(tipo)) return "palabra";
  if (
    [TipoToken.PAR_IZQ, TipoToken.PAR_DER, TipoToken.LLAVE_IZQ, TipoToken.LLAVE_DER, TipoToken.CORCHETE_IZQ, TipoToken.CORCHETE_DER, TipoToken.COMA, TipoToken.PUNTO_COMA].includes(tipo)
  )
    return "delimitador";
  return "operador";
}

export const TIPOS_DE_DATO = [
  TipoToken.TIPO_ENTERO,
  TipoToken.TIPO_DECIMAL,
  TipoToken.TIPO_TEXTO,
  TipoToken.TIPO_LOGICO,
  TipoToken.TIPO_NOTA,
  TipoToken.TIPO_DURACION,
];

/** Palabras que son literales de duración (redonda, blanca, ...). */
export const FIGURAS_TOKEN = [TipoToken.REDONDA, TipoToken.BLANCA, TipoToken.NEGRA, TipoToken.CORCHEA, TipoToken.SEMICORCHEA];
