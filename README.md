# TRAZO — mini-lenguaje en español que dibuja

Proyecto final de Compiladores (Ingeniería de Software, UCC Pasto).

Trazo es un lenguaje pequeño, **en español**, **imperativo**, con **tipado estático y fuerte** y **ámbito léxico**.
Sus programas mueven un lápiz sobre un lienzo (como la tortuga de Logo), hacen cálculos y escriben en una consola.
El compilador y el intérprete están escritos **a mano** en TypeScript (sin ANTLR, PEG.js ni similares, sin `eval`)
y corren en el navegador. La interfaz es una *caja transparente*: muestra el resultado de cada fase.

```
funcion poligono(entero lados, decimal tam) {
  repetir lados veces { avanzar(tam); girar_derecha(360 / lados); }
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

## Trazo también suena

Las notas son parte del lenguaje (`do4`, `fa#3`, `sib5`) y cada compás se valida como en una partitura:

```
tempo 120;
compas 4/4;
instrumento("piano");
compas { tocar mi4 negra; tocar mi4 negra; tocar fa4 negra; tocar sol4 negra; }
compas { tocar mi4 negra + corchea; tocar re4 corchea; tocar re4 blanca; }
```

- **Léxico:** token NOTA con su valor MIDI (`do4` = 60). Lookahead para distinguir el condicional `si` de la nota `si4`.
- **Semántico:** tipos `nota` y `duracion` (`do4 + 7` es `sol4`, `do4 + mi4` es error) y validación de compases:
  `el compás 2 suma 3.5 tiempos pero la métrica 4/4 exige 4 (falta una corchea)`.
- **Optimización:** plegado de transposiciones y duraciones, fusión de silencios.
- **Ejecución:** eventos de sonido (frecuencia = 440·2^((midi−69)/12)) que suenan con la Web Audio API al presionar
  **Ejecutar**; la pestaña **Partitura** los muestra como piano roll y la línea que suena se resalta en el editor.
- Ejemplos 11 a 17. Detalle completo en [`AMPLIACION_MUSICA.md`](AMPLIACION_MUSICA.md).
- Atajo para la exposición: `http://localhost:3000/?ejemplo=12&pestana=Partitura` abre un ejemplo en una pestaña.

## Cómo correrlo

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # pruebas de todas las fases (Vitest)
npm run build   # build de producción (Vercel)
```

Los ejemplos están en `src/examples/*.trz`; `scripts/generar-ejemplos.mjs` los empaqueta en `src/examples/index.ts`
automáticamente antes de `dev`, `build` y `test`.

## Pipeline

```
          ┌────────┐ tokens ┌────────────┐ AST ┌───────────┐ AST+tipos ┌───────────────────┐     ┌──────────────┐ AST' ┌───────────┐
 fuente ─►│ Léxico │───────►│ Sintáctico │────►│ Semántico │──────────►│ Código intermedio │────►│ Optimización │─────►│ Ejecución │─► dibujo,
          └────────┘        └────────────┘     └───────────┘           └───────────────────┘     └──────────────┘      └───────────┘   sonido
          lexer.ts          parser.ts          checker.ts              intermedio.ts             optimizer.ts          interpreter.ts  y consola
                            (descendente       symbolTable.ts          (tres direcciones)                              (tree-walking)
                             recursivo, LL(1)) (tabla de símbolos)
```

- Cada fase corre solo si la anterior no tuvo errores, pero reporta **todos** sus errores.
- La **tabla de símbolos** no es una fase: es la estructura que construye y consulta el análisis semántico.
- **Código intermedio:** el AST se traduce a código de tres direcciones (`t2 = t1 * 3`, `si_falso t3 ir_a L2`,
  `param x` / `llamar f, 1`). Se genera antes y después de optimizar para comparar cuántas instrucciones se ahorran.
  Se muestra en su pestaña; la ejecución la hace el intérprete sobre el AST.
- Recuperación: el lexer salta el carácter inválido; el parser usa **modo pánico** (sincroniza en `;`, `}` o el inicio de una sentencia).
- Trazo es **híbrido**: front-end de compilador (análisis + optimización) y un intérprete que recorre el AST.
- El intérprete no dibuja: genera `ComandoDibujo[]` que el lienzo anima (se puede repetir o cambiar de velocidad).
- Límites de ejecución: 100.000 pasos (bucle infinito) y 200 llamadas anidadas (recursión).

## Gramática (EBNF)

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

Un método del parser por regla; cada nivel de precedencia llama al siguiente, por eso `2 + 3 * 4` da `14`.
Todos los operadores binarios asocian a la izquierda. `IDENT "="` vs `IDENT "("` se decide con un token extra de lookahead.

> Ojo: `y`, `o` y `no` son palabras reservadas (operadores lógicos), no se pueden usar como nombres de variables.

## Optimizaciones

1. **Plegado de constantes**: `2 * 3 + 1 → 7`, `"a" + "b" → "ab"`.
2. **Propagación de constantes**: variables declaradas una vez con un literal y nunca reasignadas.
3. **Eliminación de código muerto**: `si (falso)`, `si (verdadero) … sino …`, `mientras (falso)`, `repetir 0 veces`, código tras `retornar`.
4. **Simplificación algebraica**: `x * 1 → x`, `x + 0 → x`, `x * 0 → 0` (si `x` no tiene llamadas), `no no x → x`.

Son seguras porque solo pliegan literales (usando la misma función que la ejecución), nunca borran expresiones con llamadas
y nunca cambian el tipo de una expresión (por ejemplo `x * 1.0` con `x` entero no se simplifica). La pestaña Optimización
muestra el código antes/después, las reglas aplicadas y los nodos y pasos ahorrados.

## Estructura

```
src/compiler/   tokens, lexer, ast, parser, semantic/{types,symbolTable,checker}, intermedio, optimizer, printer,
                interpreter, natives, errors, pipeline   (TypeScript puro, sin React)
src/components/ Editor (Monaco + lenguaje trazo), PipelineBar, Lienzo, tabs/*
src/app/        page.tsx
src/examples/   01_cuadrado … 10_error_semantico (.trz)
tests/          lexer, parser, checker, intermedio, optimizer, interpreter, musica (+ todos los ejemplos)
```

## Extras incluidos

- Mini manual dentro de la página (botón **📖 Manual**) con ejemplos que se cargan con **▶ Probar**.
  El contenido está en `src/manual/contenido.ts` y `tests/manual.test.ts` verifica que todos sus ejemplos compilan.
- Exportar el dibujo como PNG (botón en el lienzo).
