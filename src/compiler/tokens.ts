// Definición de los tokens de Trazo.
// El lexer convierte el texto fuente en una lista de estos tokens; el parser solo
// trabaja con tokens, nunca con caracteres sueltos.

export enum TipoToken {
  // Literales e identificadores
  ENTERO = "ENTERO",
  DECIMAL = "DECIMAL",
  TEXTO = "TEXTO",
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
};

/** Categoría de un token, usada por la UI para colorear la tabla de tokens. */
export type CategoriaToken = "palabra" | "identificador" | "literal" | "operador" | "delimitador" | "fin";

export function categoriaDe(tipo: TipoToken): CategoriaToken {
  if (tipo === TipoToken.EOF) return "fin";
  if (tipo === TipoToken.IDENT) return "identificador";
  if (tipo === TipoToken.ENTERO || tipo === TipoToken.DECIMAL || tipo === TipoToken.TEXTO) return "literal";
  if (Object.values(PALABRAS_RESERVADAS).includes(tipo)) return "palabra";
  if ([TipoToken.PAR_IZQ, TipoToken.PAR_DER, TipoToken.LLAVE_IZQ, TipoToken.LLAVE_DER, TipoToken.COMA, TipoToken.PUNTO_COMA].includes(tipo))
    return "delimitador";
  return "operador";
}

export const TIPOS_DE_DATO = [TipoToken.TIPO_ENTERO, TipoToken.TIPO_DECIMAL, TipoToken.TIPO_TEXTO, TipoToken.TIPO_LOGICO];
