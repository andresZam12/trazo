# TRAZO — Mini-lenguaje en español que dibuja

Proyecto final de Compiladores (Ingeniería de Software, UCC Pasto). Equipo de 3 personas. Entrega en 7 días.
Este archivo da a Claude Code todo el contexto del proyecto. Léelo completo antes de escribir código.

> **Ampliación musical:** después de este archivo, lee `AMPLIACION_MUSICA.md` (notas, compases, sonido y pestaña Partitura).

## 1. Qué es

Trazo es un lenguaje de programación pequeño, en español y con tipos estáticos. Su compilador e intérprete están
escritos a mano en TypeScript y corren en el navegador. Los programas en Trazo dibujan sobre un lienzo moviendo un
lápiz, al estilo de la tortuga de Logo. Además pueden hacer cálculos y mostrar texto en una consola.

La interfaz es una caja transparente: en cada ejecución se ve el resultado de cada fase del compilador (tokens, AST,
tabla de símbolos, errores, optimización y ejecución).

Por qué sobresale:
- La demo es visual: el código dibuja espirales, estrellas y flores en vivo. Si se cambia un número, el dibujo cambia.
- Cada tema de la materia tiene su pantalla.
- Los errores también son visuales: se subrayan en el editor, aparecen con su fase y su mensaje en español, y la barra
  del pipeline se pone en rojo justo en la fase que falló.
- Sin librerías de parseo (nada de ANTLR, PEG.js, Chevrotain ni similares). Todo hecho a mano.

| Tema | Dónde se ve |
|---|---|
| Arquitectura por fases | `src/compiler/pipeline.ts` + barra del pipeline |
| Análisis léxico / error léxico | `lexer.ts` + pestaña Tokens |
| Análisis sintáctico / parser top-down (descendente recursivo) / error sintáctico | `parser.ts` + pestaña Árbol |
| Árbol sintáctico (AST) | `ast.ts` + visualización del árbol |
| Precedencia y asociatividad | `parser.ts` (un nivel por precedencia) + `interpreter.ts` |
| Análisis semántico / chequeador de tipos | `semantic/checker.ts` + pestaña Errores |
| Ámbitos anidados / tabla de símbolos | `semantic/symbolTable.ts` + pestaña Símbolos |
| Optimización | `optimizer.ts` + pestaña Optimización (antes y después) |
| Compilador vs intérprete | Híbrido: front-end de compilador + intérprete tree-walking |
| Tipos de lenguaje | Imperativo, tipado estático y fuerte, ámbito léxico |
| Parseo bottom-up | (Opcional) Shunting-Yard, sección 9 |

## 2. Stack

- Next.js 15 (App Router) + TypeScript strict. Todo en el cliente (`"use client"`), despliegue en Vercel.
- Editor: `@monaco-editor/react`, lenguaje `trazo` registrado + markers de error.
- Lienzo: Canvas 2D nativo animado con `requestAnimationFrame`.
- Árbol AST: componente propio en SVG/HTML.
- Estilos: Tailwind CSS. Pruebas: Vitest en `tests/`.
- `src/compiler/` es TypeScript puro, sin React ni dependencias.

## 3. El lenguaje

### 3.1 Ejemplo

```
// Espiral de colores
funcion poligono(entero lados, decimal tam) {
  repetir lados veces {
    avanzar(tam);
    girar_derecha(360 / lados);
  }
}

entero i = 0;
mientras (i < 36) {
  si (i % 2 == 0) { color("azul"); } sino { color("naranja"); }
  poligono(6, 20 + i * 2);
  girar_derecha(10);
  i = i + 1;
}
mostrar("Listo: " + i + " hexágonos");
```

### 3.2 Elementos léxicos

- Palabras reservadas: `entero decimal texto logico si sino mientras repetir veces funcion retornar verdadero falso y o no`
- Identificadores: `[a-zA-Z_áéíóúÁÉÍÓÚñÑüÜ][a-zA-Z0-9_áéíóúÁÉÍÓÚñÑüÜ]*`
- Literales: entero `123`, decimal `3.14`, texto `"hola"` (escapes `\"` y `\n`)
- Operadores: `+ - * / % == != < > <= >= =` — Delimitadores: `( ) { } , ;`
- Comentarios: `//` hasta fin de línea y `/* bloque */`
- Errores léxicos: carácter inválido (`@`, `#`, `$`...), texto sin cerrar, comentario de bloque sin cerrar, número mal formado (`3.`, `1.2.3`)

Cada token lleva `{ tipo, lexema, linea, columna }`.

### 3.3 Gramática (EBNF)

```
programa     → sentencia* EOF
sentencia    → declVar | declFuncion | asignacion | si | mientras
             | repetir | retornar | llamadaSent | bloque
declVar      → tipo IDENT ( "=" expresion )? ";"
declFuncion  → "funcion" tipo? IDENT "(" parametros? ")" bloque
parametros   → tipo IDENT ( "," tipo IDENT )*
asignacion   → IDENT "=" expresion ";"
si           → "si" "(" expresion ")" bloque ( "sino" ( si | bloque ) )?
mientras     → "mientras" "(" expresion ")" bloque
repetir      → "repetir" expresion "veces" bloque
retornar     → "retornar" expresion? ";"
llamadaSent  → llamada ";"
bloque       → "{" sentencia* "}"
tipo         → "entero" | "decimal" | "texto" | "logico"

expresion    → o
o            → y ( "o" y )*
y            → igualdad ( "y" igualdad )*
igualdad     → comparacion ( ( "==" | "!=" ) comparacion )*
comparacion  → suma ( ( "<" | ">" | "<=" | ">=" ) suma )*
suma         → producto ( ( "+" | "-" ) producto )*
producto     → unario ( ( "*" | "/" | "%" ) unario )*
unario       → ( "-" | "no" ) unario | primario
primario     → ENTERO | DECIMAL | TEXTO | "verdadero" | "falso"
             | llamada | IDENT | "(" expresion ")"
llamada      → IDENT "(" argumentos? ")"
argumentos   → expresion ( "," expresion )*
```

Para distinguir `IDENT "="` (asignación) de `IDENT "("` (llamada), el parser mira un token adelante. Todos los
operadores binarios asocian a la izquierda.

### 3.4 Reglas de tipos

- `entero` se promueve a `decimal` en operaciones mixtas y al asignarlo a una variable `decimal`. Al revés es error.
- `+` con al menos un `texto` concatena y da `texto`. Cualquier otro uso de texto en aritmética es error.
- `y`, `o`, `no` solo aceptan `logico`. Condiciones de `si` y `mientras` deben ser `logico`.
- La expresión de `repetir n veces` debe ser `entero`.
- `==`, `!=` exigen tipos compatibles. `< > <= >=` exigen numéricos.
- `/` entre dos enteros da entero (división entera). `%` solo acepta enteros.
- Las funciones con tipo de retorno deben retornar en todos los caminos y con el tipo declarado. Una función sin tipo no puede retornar un valor.
- En cada llamada se verifica existencia, aridad y tipo de cada argumento.

Errores semánticos: variable no declarada, variable redeclarada en el mismo ámbito, función no declarada, tipos
incompatibles, aridad incorrecta, retorno fuera de función, falta de retorno, uso de variable sin inicializar y
llamada a función sin retorno dentro de una expresión.
Advertencias (amarillo, no detienen): variable declarada y no usada, shadowing y código inalcanzable después de `retornar`.

### 3.5 Ámbitos

- Ámbito global con las nativas; cada función abre un ámbito con sus parámetros; cada bloque `{ }` abre uno anidado.
- La tabla de símbolos es una pila de ámbitos; búsqueda de interno a externo.
- Las funciones se registran en una primera pasada (se pueden llamar antes de su declaración).
- La UI muestra los ámbitos como árbol (`global → poligono → bloque#3 ...`) con nombre, tipo, categoría, línea y si se usa.

### 3.6 Funciones nativas

| Firma | Efecto |
|---|---|
| `avanzar(decimal pasos)` | Mueve el lápiz hacia adelante y dibuja si está abajo |
| `retroceder(decimal pasos)` | Mueve el lápiz hacia atrás |
| `girar_derecha(decimal grados)` / `girar_izquierda(decimal grados)` | Rota el lápiz |
| `subir_lapiz()` / `bajar_lapiz()` | Deja de dibujar / vuelve a dibujar |
| `ir_a(decimal x, decimal y)` | Mueve el lápiz (origen en el centro) |
| `color(texto c)` | Nombres en español (rojo, azul, verde, naranja, morado, negro, blanco, amarillo, rosado, gris) o hex `"#ff8800"` |
| `grosor(decimal g)` | Ancho del trazo |
| `limpiar()` | Borra el lienzo |
| `mostrar(texto mensaje)` | Escribe en consola (acepta cualquier tipo) |
| `aleatorio(entero min, entero max) : entero` | Aleatorio con semilla fija (reproducible) |

Las nativas pasan por el mismo chequeador: `avanzar("hola")` es error semántico.

## 4. Arquitectura

```
src/compiler/   tokens.ts, lexer.ts, ast.ts, parser.ts, semantic/{symbolTable,types,checker}.ts,
                optimizer.ts, interpreter.ts, errors.ts, pipeline.ts, natives.ts, printer.ts
src/app/        page.tsx
src/components/ Editor.tsx, PipelineBar.tsx, Lienzo.tsx, tabs/*
src/examples/   programas .trz
tests/          lexer, parser, checker, optimizer, interpreter
```

### 4.1 Contrato del pipeline

```ts
interface ResultadoCompilacion {
  tokens: Token[];
  ast: Programa | null;
  astOptimizado: Programa | null;
  tablaSimbolos: SnapshotAmbito | null;
  optimizaciones: CambioOptimizacion[]; // { regla, linea, antes, despues }
  errores: ErrorCompilacion[];          // todas las fases, ordenados por línea
  advertencias: ErrorCompilacion[];
  ejecucion: { comandos: ComandoDibujo[]; consola: string[]; pasos: number } | null;
  fases: { nombre: Fase; estado: 'ok' | 'error' | 'omitida'; ms: number }[];
}
```

- Cada fase corre solo si la anterior no tuvo errores, pero reporta todos sus errores.
- El intérprete no dibuja: genera `ComandoDibujo[]` (linea, mover, color, grosor, limpiar) que el lienzo anima.

### 4.2 Detalles

- Recuperación: el lexer reporta el carácter inválido y sigue; el parser usa modo pánico (sincroniza en `;`, `}` o inicio de sentencia).
- Mensajes en español con ubicación: `[Sintáctico] Línea 4, col 12: se esperaba ';' después de la expresión pero se encontró 'mientras'`.
- Errores de ejecución: división entre cero, bucle infinito (100.000 pasos), recursión demasiado profunda (200 llamadas).
- El AST guarda línea y columna en cada nodo.
- Recompilación en vivo con debounce de 400 ms + botón Ejecutar.

### 4.3 Optimizaciones

1. Plegado de constantes: `2 * 3 + 1 → 7`; `"a" + "b" → "ab"`.
2. Propagación de constantes (variables asignadas una sola vez con un literal y no modificadas).
3. Eliminación de código muerto: `si (falso)`, `si (verdadero) {A} sino {B} → A`, `mientras (falso)`, código después de `retornar`.
4. Simplificación algebraica: `x * 1 → x`, `x + 0 → x`, `x * 0 → 0` (sin efectos secundarios), `no no x → x`.

La pestaña Optimización muestra código regenerado antes/después, reglas aplicadas y número de nodos y pasos antes/después.

## 5. Interfaz (una sola página)

Barra superior (Ejemplos, Ejecutar, Optimizar, Manual), barra del pipeline (sin tiempos en pantalla), editor Monaco a la
izquierda y pestañas a la derecha: Lienzo, Tokens, Árbol, Símbolos, Optimización, Errores (n), Consola. Diseño oscuro.
Decisión del equipo: se quitaron de la interfaz los ms por fase, el control de velocidad y el enlace de compartir para
reducir la complejidad visual (el pipeline sigue midiendo `ms` internamente). Todos los botones usan el degradado del
título (clase `.boton-trazo` en `globals.css`).

## 6. Ejemplos (`src/examples/`)

01_cuadrado, 02_estrella, 03_espiral, 04_flor_funciones, 05_arbol_recursivo, 06_calculos, 07_optimizable,
08_error_lexico, 09_error_sintactico, 10_error_semantico.

## 7. Versiones

v1 expresiones · v2 variables y mostrar · v3 si/mientras/repetir con dibujo · v4 funciones y ámbitos ·
v5 chequeo de tipos completo · v6 optimizador · v7 pulido.

## 8. Convenciones

- Comentarios en español que expliquen el porqué. Cada método del parser lleva encima la regla de la gramática que implementa.
- Nombres de dominio en español (Lexer, Parser, TablaSimbolos, Chequeador, Optimizador, Interprete, ErrorCompilacion).
- No usar librerías de parseo/lexing/evaluación. Nunca `eval` ni `new Function`.
- `src/compiler/` no importa nada de React ni de Next.
- Cada fase tiene pruebas en Vitest con casos válidos y de error.
- Construir por versiones. Mantener README.md (qué es, gramática, cómo correrlo, diagrama del pipeline).

## 9. Extras opcionales

1. Modo paso a paso. 2. Comparador descenso recursivo vs Shunting-Yard. 3. Exportar PNG (hecho). 4. Compartir por URL (descartado).
