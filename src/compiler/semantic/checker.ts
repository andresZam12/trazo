// Analizador semántico (chequeador de tipos) de Trazo.
// Recorre el AST ya construido y verifica lo que la gramática no puede expresar:
// que las variables existan, que los tipos sean compatibles, que las funciones
// se llamen bien y que retornen en todos los caminos.
// Anota cada expresión con su tipo (campo `tipoDato`) para las fases siguientes.

import type * as A from "../ast";
import { crearError, ErrorCompilacion } from "../errors";
import { FIRMAS_NATIVAS } from "../natives";
import { SnapshotAmbito, Simbolo, TablaSimbolos } from "./symbolTable";
import { esAsignable, esError, esNumerico, promover, sonComparables, TipoTrazo } from "./types";

export interface ResultadoSemantico {
  errores: ErrorCompilacion[];
  advertencias: ErrorCompilacion[];
  tablaSimbolos: SnapshotAmbito;
}

export class Chequeador {
  private tabla = new TablaSimbolos();
  private errores: ErrorCompilacion[] = [];
  private advertencias: ErrorCompilacion[] = [];
  /** Función que se está revisando (null en el nivel principal). */
  private funcionActual: { nombre: string; tipoRetorno: TipoTrazo } | null = null;

  constructor() {
    // Las nativas viven en el ámbito global, como cualquier otra función
    for (const f of FIRMAS_NATIVAS) {
      this.tabla.declararGlobal({
        nombre: f.nombre,
        tipo: f.retorno,
        categoria: "nativa",
        linea: 0,
        columna: 0,
        usado: true,
        inicializado: true,
        parametros: f.parametros,
        aceptaCualquiera: f.aceptaCualquiera,
      });
    }
  }

  analizar(programa: A.Programa): ResultadoSemantico {
    this.registrarFunciones(programa);
    this.revisarSentencias(programa.sentencias);
    this.advertirNoUsadas(this.tabla.global);
    return { errores: this.errores, advertencias: this.advertencias, tablaSimbolos: this.tabla.snapshot() };
  }

  // ---------------- utilidades de reporte ----------------

  private error(mensaje: string, nodo: { linea: number; columna: number }, longitud = 1) {
    this.errores.push(crearError("Semántico", mensaje, nodo.linea, nodo.columna, longitud));
  }

  private advertencia(mensaje: string, nodo: { linea: number; columna: number }, longitud = 1) {
    this.advertencias.push(crearError("Semántico", mensaje, nodo.linea, nodo.columna, longitud, "advertencia"));
  }

  /** Al cerrar un ámbito, las variables que nunca se leyeron generan advertencia. */
  private advertirNoUsadas(ambito: { simbolos: Map<string, Simbolo> }) {
    for (const s of ambito.simbolos.values()) {
      if (s.categoria === "variable" && !s.usado) {
        this.advertencia(`la variable '${s.nombre}' se declaró pero nunca se usa`, s, s.nombre.length);
      }
    }
  }

  // ---------------- primera pasada ----------------

  /**
   * Primera pasada: registra todas las funciones del usuario en el ámbito global
   * antes de revisar el código, para poder llamarlas antes de su declaración.
   */
  private registrarFunciones(programa: A.Programa) {
    for (const s of programa.sentencias) {
      if (s.tipo !== "DeclFuncion") continue;
      const previo = this.tabla.global.simbolos.get(s.nombre);
      if (previo) {
        const motivo = previo.categoria === "nativa" ? "es una función nativa" : `ya fue declarada en la línea ${previo.linea}`;
        this.error(`la función '${s.nombre}' ${motivo}`, s, 7);
        continue;
      }
      this.tabla.declararGlobal({
        nombre: s.nombre,
        tipo: s.tipoRetorno ?? "vacio",
        categoria: "funcion",
        linea: s.linea,
        columna: s.columna,
        usado: false,
        inicializado: true,
        parametros: s.parametros.map((p) => ({ nombre: p.nombre, tipo: p.tipoParam })),
      });
    }
  }

  // ---------------- sentencias ----------------

  /** Revisa una lista de sentencias y avisa del código inalcanzable tras un retorno. */
  private revisarSentencias(sentencias: A.Sentencia[]) {
    let yaRetorno = false;
    for (const s of sentencias) {
      if (yaRetorno) {
        this.advertencia("código inalcanzable: está después de 'retornar'", s, 1);
        yaRetorno = false; // se avisa una sola vez por bloque
      }
      this.sentencia(s);
      if (siempreRetorna(s)) yaRetorno = true;
    }
  }

  private sentencia(s: A.Sentencia) {
    switch (s.tipo) {
      case "DeclVar": return this.declVar(s);
      case "DeclFuncion": return this.declFuncion(s);
      case "Asignacion": return this.asignacion(s);
      case "Si": {
        this.exigirLogico(s.condicion, "la condición de 'si'");
        this.bloque(s.entonces);
        if (s.sino) {
          if (s.sino.tipo === "Si") this.sentencia(s.sino);
          else this.bloque(s.sino);
        }
        return;
      }
      case "Mientras":
        this.exigirLogico(s.condicion, "la condición de 'mientras'");
        this.bloque(s.cuerpo);
        return;
      case "Repetir": {
        const t = this.expresion(s.veces);
        if (!esError(t) && t !== "entero") {
          this.error(`el número de repeticiones de 'repetir' debe ser entero, pero es ${t}`, s.veces);
        }
        this.bloque(s.cuerpo);
        return;
      }
      case "Retornar": return this.retornar(s);
      case "LlamadaSent":
        this.llamada(s.llamada, false);
        return;
      case "Bloque":
        this.bloque(s);
        return;
    }
  }

  /** Cada bloque { } abre un ámbito nuevo que se cierra al terminar. */
  private bloque(b: A.Bloque) {
    this.tabla.abrir("bloque", "bloque");
    this.revisarSentencias(b.sentencias);
    this.advertirNoUsadas(this.tabla.cerrar());
  }

  private declVar(s: A.DeclVar) {
    // La expresión se revisa ANTES de declarar: así "entero x = x;" es un error
    if (s.inicial) {
      const t = this.expresion(s.inicial);
      if (!esAsignable(s.tipoVar, t)) {
        this.error(`tipos incompatibles: no se puede asignar un valor ${t} a la variable '${s.nombre}' de tipo ${s.tipoVar}`, s.inicial);
      }
    }
    const exterior = this.tabla.buscarEnExteriores(s.nombre);
    const ok = this.tabla.declarar({
      nombre: s.nombre,
      tipo: s.tipoVar,
      categoria: "variable",
      linea: s.linea,
      columna: s.columna,
      usado: false,
      inicializado: s.inicial !== null,
    });
    if (!ok) {
      this.error(`la variable '${s.nombre}' ya fue declarada en este ámbito`, s, s.tipoVar.length);
    } else if (exterior && (exterior.categoria === "variable" || exterior.categoria === "parametro")) {
      this.advertencia(`la variable '${s.nombre}' oculta a otra del mismo nombre declarada en la línea ${exterior.linea}`, s, s.tipoVar.length);
    }
  }

  private declFuncion(s: A.DeclFuncion) {
    if (this.funcionActual || this.tabla.ambitoActual !== this.tabla.global) {
      this.error(`la función '${s.nombre}' debe declararse en el nivel principal, no dentro de otro bloque`, s, 7);
      return;
    }
    const anterior = this.funcionActual;
    this.funcionActual = { nombre: s.nombre, tipoRetorno: s.tipoRetorno ?? "vacio" };

    // Ámbito de la función con sus parámetros; el cuerpo abre un bloque anidado
    this.tabla.abrir(s.nombre, "funcion");
    for (const p of s.parametros) {
      const ok = this.tabla.declarar({
        nombre: p.nombre,
        tipo: p.tipoParam,
        categoria: "parametro",
        linea: p.linea,
        columna: p.columna,
        usado: false,
        inicializado: true,
      });
      if (!ok) this.error(`el parámetro '${p.nombre}' está repetido`, p, p.tipoParam.length);
    }
    this.bloque(s.cuerpo);
    this.tabla.cerrar();

    if (s.tipoRetorno && !siempreRetorna(s.cuerpo)) {
      this.error(`falta retorno: la función '${s.nombre}' debe retornar un ${s.tipoRetorno} en todos los caminos`, s, 7);
    }
    this.funcionActual = anterior;
  }

  private asignacion(s: A.Asignacion) {
    const t = this.expresion(s.valor);
    const sim = this.tabla.buscar(s.nombre);
    if (!sim) {
      this.error(`la variable '${s.nombre}' no está declarada`, s, s.nombre.length);
      return;
    }
    if (sim.categoria === "funcion" || sim.categoria === "nativa") {
      this.error(`'${s.nombre}' es una función, no se le puede asignar un valor`, s, s.nombre.length);
      return;
    }
    if (!esAsignable(sim.tipo, t)) {
      this.error(`tipos incompatibles: no se puede asignar un valor ${t} a la variable '${s.nombre}' de tipo ${sim.tipo}`, s.valor);
    }
    sim.inicializado = true;
  }

  private retornar(s: A.Retornar) {
    if (!this.funcionActual) {
      this.error("'retornar' solo se puede usar dentro de una función", s, 8);
      if (s.valor) this.expresion(s.valor);
      return;
    }
    const esperado = this.funcionActual.tipoRetorno;
    if (!s.valor) {
      if (esperado !== "vacio") this.error(`la función '${this.funcionActual.nombre}' debe retornar un valor ${esperado}`, s, 8);
      return;
    }
    const t = this.expresion(s.valor);
    if (esperado === "vacio") {
      this.error(`la función '${this.funcionActual.nombre}' no tiene tipo de retorno, así que no puede retornar un valor`, s, 8);
    } else if (!esAsignable(esperado, t)) {
      this.error(`tipos incompatibles: la función '${this.funcionActual.nombre}' debe retornar ${esperado} pero retorna ${t}`, s.valor);
    }
  }

  private exigirLogico(e: A.Expresion, que: string) {
    const t = this.expresion(e);
    if (!esError(t) && t !== "logico") this.error(`${que} debe ser logico, pero es ${t}`, e);
  }

  // ---------------- expresiones ----------------

  /** Calcula y anota el tipo de una expresión. */
  private expresion(e: A.Expresion): TipoTrazo {
    const t = this.tipoDe(e);
    e.tipoDato = t;
    return t;
  }

  private tipoDe(e: A.Expresion): TipoTrazo {
    switch (e.tipo) {
      case "Literal":
        return e.tipoLiteral;
      case "Identificador": {
        const sim = this.tabla.buscar(e.nombre);
        if (!sim) {
          this.error(`la variable '${e.nombre}' no está declarada`, e, e.nombre.length);
          return "error";
        }
        if (sim.categoria === "funcion" || sim.categoria === "nativa") {
          this.error(`'${e.nombre}' es una función; para llamarla escribe '${e.nombre}(...)'`, e, e.nombre.length);
          return "error";
        }
        sim.usado = true;
        if (!sim.inicializado) {
          this.error(`la variable '${e.nombre}' se usa sin haberle asignado un valor`, e, e.nombre.length);
        }
        return sim.tipo;
      }
      case "Llamada":
        return this.llamada(e, true);
      case "Unaria": {
        const t = this.expresion(e.operando);
        if (esError(t)) return "error";
        if (e.operador === "-") {
          if (esNumerico(t)) return t;
          this.error(`el operador '-' necesita un número, pero recibió ${t}`, e);
          return "error";
        }
        if (t === "logico") return "logico";
        this.error(`el operador 'no' necesita un valor logico, pero recibió ${t}`, e, 2);
        return "error";
      }
      case "Binaria":
        return this.binaria(e);
    }
  }

  /** Reglas de tipos de los operadores binarios (sección 3.4 de la especificación). */
  private binaria(e: A.Binaria): TipoTrazo {
    const a = this.expresion(e.izquierda);
    const b = this.expresion(e.derecha);
    if (esError(a) || esError(b)) return "error";
    const op = e.operador;
    const incompatibles = () => {
      this.error(`tipos incompatibles: no se puede aplicar '${op}' entre ${a} y ${b}`, e, op.length);
      return "error" as const;
    };

    switch (op) {
      case "+":
        if (a === "texto" || b === "texto") return a === "vacio" || b === "vacio" ? incompatibles() : "texto";
        return esNumerico(a) && esNumerico(b) ? promover(a, b) : incompatibles();
      case "-":
      case "*":
      case "/":
        return esNumerico(a) && esNumerico(b) ? promover(a, b) : incompatibles();
      case "%":
        if (a === "entero" && b === "entero") return "entero";
        this.error(`el operador '%' solo acepta enteros, pero recibió ${a} y ${b}`, e);
        return "error";
      case "<":
      case ">":
      case "<=":
      case ">=":
        return esNumerico(a) && esNumerico(b) ? "logico" : incompatibles();
      case "==":
      case "!=":
        return sonComparables(a, b) ? "logico" : incompatibles();
      case "y":
      case "o":
        if (a === "logico" && b === "logico") return "logico";
        this.error(`el operador '${op}' solo acepta valores logico, pero recibió ${a} y ${b}`, e, op.length);
        return "error";
    }
  }

  /**
   * Revisa una llamada: que la función exista, la aridad y el tipo de cada argumento.
   * `enExpresion` indica si el resultado se usa como valor (entonces debe retornar algo).
   */
  private llamada(e: A.Llamada, enExpresion: boolean): TipoTrazo {
    const tiposArgs = e.argumentos.map((a) => this.expresion(a));
    const sim = this.tabla.buscar(e.nombre);
    if (!sim) {
      this.error(`la función '${e.nombre}' no está declarada`, e, e.nombre.length);
      return "error";
    }
    if (sim.categoria !== "funcion" && sim.categoria !== "nativa") {
      this.error(`'${e.nombre}' es una ${sim.categoria}, no una función`, e, e.nombre.length);
      return "error";
    }
    sim.usado = true;
    const params = sim.parametros ?? [];
    if (params.length !== tiposArgs.length) {
      this.error(`la función '${e.nombre}' espera ${params.length} argumento(s) pero recibió ${tiposArgs.length}`, e, e.nombre.length);
    } else {
      params.forEach((p, i) => {
        const t = tiposArgs[i];
        if (t === "vacio") {
          this.error(`el argumento ${i + 1} de '${e.nombre}' no tiene valor`, e.argumentos[i]);
        } else if (!sim.aceptaCualquiera && !esAsignable(p.tipo, t)) {
          this.error(`tipos incompatibles: el argumento ${i + 1} de '${e.nombre}' ('${p.nombre}') debe ser ${p.tipo}, pero es ${t}`, e.argumentos[i]);
        }
      });
    }
    if (enExpresion && sim.tipo === "vacio") {
      this.error(`la función '${e.nombre}' no retorna ningún valor, así que no se puede usar dentro de una expresión`, e, e.nombre.length);
      return "error";
    }
    e.tipoDato = sim.tipo;
    return sim.tipo;
  }
}

/** ¿La sentencia termina con un retorno en todos sus caminos? */
export function siempreRetorna(s: A.Sentencia): boolean {
  switch (s.tipo) {
    case "Retornar":
      return true;
    case "Bloque":
      return s.sentencias.some(siempreRetorna);
    case "Si":
      return s.sino !== null && siempreRetorna(s.entonces) && siempreRetorna(s.sino);
    default:
      return false;
  }
}

export function analizarSemantica(programa: A.Programa): ResultadoSemantico {
  return new Chequeador().analizar(programa);
}
