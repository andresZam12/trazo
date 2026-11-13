# TRAZO + MÚSICA — Ampliación: un lenguaje que dibuja y suena

> Ampliación de `CLAUDE.md`. Léelo después de ese archivo. **La entrega es el 13 de noviembre**: se construye sobre el código de Trazo que ya existe y no se reescribe nada que ya funcione.
> Regla de oro: **cada paso deja el proyecto funcionando**. Si el tiempo no alcanza, se presenta hasta el último paso completo.

---

## 1. La idea en una frase
Trazo aprende a **escribir música**. Las notas son parte del lenguaje (`do4`, `sol#3`, `sib4`), cada compás se valida como en una partitura real, y al ejecutar el programa **suena** en el navegador mientras se **dibuja** su partitura en el lienzo.

### Por qué es innovador y fácil de explicar
- Todo el mundo entiende la entrada (notas) y la salida (sonido).
- **El análisis semántico se vuelve intuitivo**: "el compás 3 suma 3½ tiempos y debería sumar 4" es un error de tipos/semántica que cualquiera entiende.
- **El análisis léxico se luce**: `do4`, `re#5` y `sib3` son tokens nuevos con su propia expresión regular.
- **La optimización se escucha y se ve**: los silencios consecutivos se fusionan y las transposiciones constantes se pliegan.

---

## 2. Cambios al lenguaje

### 2.1 Léxico (en `lexer.ts` y `tokens.ts`)
- **Token NOTA**: `(do|re|mi|fa|sol|la|si)(#|b)?[0-8]`. Ejemplos: `do4`, `fa#3`, `sib5`.
  - Ojo: `si` ya es palabra reservada (condicional). La regla es que **`si` seguido inmediatamente de dígito, `#` o `b`+dígito es NOTA**; si no, es la palabra reservada `si`. Este es un **excelente ejemplo de lookahead léxico** para la exposición: documentarlo con un comentario.
- **Palabras reservadas nuevas**: `nota duracion tocar silencio acorde compas tempo redonda blanca negra corchea semicorchea`
- **Errores léxicos nuevos**: octava fuera de rango (`do9`) y alteración inválida (`do##4`).

### 2.2 Tipos nuevos (en `types.ts`)
- `nota`: valor interno = número MIDI (`do4` = 60).
- `duracion`: valor interno = tiempos (`redonda`=4, `blanca`=2, `negra`=1, `corchea`=0.5, `semicorchea`=0.25).
- Reglas:
  - `nota + entero` → `nota` (transponer semitonos).
  - `nota - entero` → `nota`.
  - `nota - nota` → `entero` (intervalo).
  - `nota + nota` es **error semántico** ("no se pueden sumar dos notas; ¿querías un acorde?").
  - `duracion * entero` → `duracion`.
  - Comparar notas con `<` y `>` es válido (más grave o más aguda).
  - Una nota fuera del rango MIDI 0–127 después de transponer es error en compilación (si es constante) o en ejecución.

### 2.3 Sentencias nuevas (gramática)
```
tempo          → "tempo" ENTERO ";"                      // pulsos por minuto
compasDecl     → "compas" ENTERO "/" ENTERO ";"          // métrica: 4/4, 3/4, 6/8
tocar          → "tocar" expresion expresion ";"         // nota, duración
silencio       → "silencio" expresion ";"                // duración
acorde         → "acorde" "[" expresion ("," expresion)* "]" expresion ";"
bloqueCompas   → "compas" bloque                         // un compás que se valida
```
`sentencia` agrega: `tempo | compasDecl | tocar | silencio | acorde | bloqueCompas`. El parser distingue `compas 4/4;` de `compas { ... }` mirando el siguiente token (ENTERO o `{`).

### 2.4 Validación de compases (en `checker.ts`) — **lo más importante para la exposición**
- Dentro de un `compas { ... }` solo se permiten `tocar`, `silencio`, `acorde` y `repetir` con un número **literal**.
- El chequeador **suma las duraciones** (multiplicando por las repeticiones) y la compara con la métrica vigente (`4/4` = 4 tiempos, `3/4` = 3 y `6/8` = 3, en negras).
- Errores:
  - `Línea 12: el compás 3 suma 3.5 tiempos pero la métrica 4/4 exige 4 (falta una corchea)`.
  - `el compás suma 5 tiempos, sobra 1 negra`.
- **Bonus**: el mensaje sugiere qué figura falta o sobra (por ejemplo, si la diferencia es 0.5, sugiere "corchea").
- Los compases se **numeran** en orden de aparición, y la pestaña Símbolos muestra una sección "Compases" con su número, línea, suma y si es válido o no.
- Un `tocar` fuera de un `compas {}` es válido (modo libre) pero genera una **advertencia**: "nota fuera de compás, no se valida la métrica".

### 2.5 Optimizaciones nuevas (en `optimizer.ts`)
1. **Plegado de transposiciones**: `do4 + 7` → `sol4`; `do4 + 12` → `do5`.
2. **Fusión de silencios**: `silencio negra; silencio negra;` → `silencio blanca;`.
3. **Plegado de duraciones**: `negra * 2` → `blanca`.
4. **Eliminación de código muerto**: un `repetir 0 veces` se elimina.

### 2.6 Ejecución (en `interpreter.ts`)
- El intérprete genera, además de `ComandoDibujo[]`, una lista `EventoSonido[]`: `{ midi, frecuencia, inicio, duracion, linea }`. El tiempo avanza con cada `tocar` y cada `silencio` según el `tempo` (por defecto 100).
- Frecuencia: `440 * 2 ** ((midi - 69) / 12)`.
- Funciones nativas nuevas:
  - `instrumento(texto)`: `"piano" | "organo" | "flauta" | "8bit"`, que se mapean a tipos de oscilador o envolventes.
  - `volumen(decimal)`.

### 2.7 Audio y visual (UI)
- **Reproductor con Web Audio API**, sin librerías: un `OscillatorNode` con un `GainNode` y envolvente ADSR simple para que no suene a "clic". Lee `EventoSonido[]` y programa cada nota con `ctx.currentTime + inicio`.
- **Pestaña nueva "Partitura"**: un *piano roll* en canvas donde el eje X es el tiempo y el eje Y la altura. Las barras de compás se dibujan como líneas verticales y los compases inválidos se pintan en rojo. Un cursor recorre la partitura mientras suena.
- **Sincronía con el editor**: mientras suena, se resalta la línea del `tocar` actual (por eso `EventoSonido` lleva `linea`).
- **Integración con el lienzo** (lo que une las dos ideas): si el programa usa el lápiz y la música a la vez, cada nota puede mover el lápiz con una altura proporcional a la nota, y así **la melodía dibuja su propia forma**. Agregar la nativa `dibujar_melodia(logico)` para activarlo.
- La barra del pipeline no cambia; la fase de ejecución ahora también reporta "N notas, X segundos".

---

## 3. Ejemplos nuevos (`src/examples/`)
Usar solo melodías de **dominio público**.
1. `11_escala.trz`: escala de do mayor con `mientras` y transposición (`n = n + 2`).
2. `12_himno_alegria.trz`: Himno de la Alegría (Beethoven) con compases 4/4 y validación.
3. `13_estrellita.trz`: "Estrellita, ¿dónde estás?" (melodía tradicional) usando una `funcion frase(nota inicio)`, que demuestra funciones y ámbitos con música.
4. `14_acordes.trz`: progresión do–la menor–fa–sol con `acorde [...]`.
5. `15_melodia_que_dibuja.trz`: la melodía mueve el lápiz.
6. `16_error_compas.trz`: compás con 3½ tiempos (error semántico estrella de la demo).
7. `17_error_nota.trz`: `do9` (léxico) y `do4 + mi4` (semántico).

Ejemplo de referencia:
```
tempo 110;
compas 4/4;
instrumento("piano");

funcion frase(nota base) {
  compas { tocar base negra; tocar base negra; tocar base + 7 negra; tocar base + 7 negra; }
  compas { tocar base + 9 negra; tocar base + 9 negra; tocar base + 7 blanca; }
}

frase(do4);
compas { tocar fa4 negra; tocar fa4 negra; tocar mi4 negra; tocar mi4 negra; }
compas { tocar re4 negra; tocar re4 negra; tocar do4 blanca; }
```

---

## 4. Orden de trabajo (12 nov noche → 13 nov)
Cada paso termina con pruebas en Vitest y la app funcionando.

| # | Paso | Quién | Tiempo aprox. |
|---|---|---|---|
| 1 | Tokens NOTA y duraciones + lookahead `si` vs nota + pruebas del lexer | Persona B | 1 h |
| 2 | Gramática: `tocar`, `silencio`, `tempo`, `compas X/Y`, `compas {}`, `acorde` + pruebas | Persona B | 1.5 h |
| 3 | Tipos `nota` y `duracion` + validación de compases con mensajes + pruebas | Persona C | 2 h |
| 4 | `EventoSonido[]` en el intérprete + reproductor Web Audio | Persona C + A | 1.5 h |
| 5 | Pestaña Partitura (piano roll + cursor + compases en rojo) + resaltado de la línea que suena | Persona A | 2 h |
| 6 | Optimizaciones musicales + ejemplos 11–17 | Persona B | 1 h |
| 7 | *(Si sobra tiempo)* `dibujar_melodia`, instrumentos, ensayo | Todos | — |

**Corte mínimo presentable**: pasos 1 a 4. Con eso el código ya suena y valida compases.

---

## 5. Guion de demo (3 minutos)
1. Abrir `12_himno_alegria.trz` → **Ejecutar**: suena y se dibuja el piano roll.
2. Pestaña **Tokens**: mostrar que `sol4` es un token NOTA y explicar por qué `si` a veces es nota y a veces condicional.
3. Borrar una corchea → la barra del pipeline se pone roja en **Semántico**, el compás aparece en rojo y sale el mensaje "falta una corchea".
4. Escribir `do4 + mi4` → error de tipos: no se pueden sumar dos notas.
5. Pestaña **Optimización**: `do4 + 7` se pliega a `sol4` y los silencios se fusionan.
6. Ejemplo 15: la melodía dibuja su forma.

## 6. Preguntas probables nuevas
- *¿Cómo sabe el lexer si `si` es una nota o un condicional?* → Lookahead de un carácter en `lexer.ts`.
- *¿Por qué validar compases es análisis semántico y no sintáctico?* → La gramática solo dice que un compás contiene notas; que sumen 4 tiempos es una regla de **significado**, igual que un chequeo de tipos.
- *¿Cómo se convierte una nota en sonido?* → MIDI a frecuencia con `440·2^((n−69)/12)` y Web Audio con un oscilador.
- *¿Qué representa internamente el tipo `nota`?* → Un entero MIDI, lo que permite transponer sumando semitonos.
