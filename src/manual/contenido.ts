// Contenido del mini manual de Trazo que se abre desde el botón "Manual".
// Está separado de la interfaz para que las pruebas verifiquen que cada
// ejemplo del manual compila y se ejecuta sin errores.

export interface SeccionManual {
  titulo: string;
  /** Párrafos de explicación (texto simple). */
  texto: string[];
  /** Ejemplo para copiar o probar con el botón "Probar". */
  ejemplo?: string;
  /** Tabla opcional: [columna1, columna2]. */
  tabla?: { columnas: [string, string]; filas: [string, string][] };
}

export const MANUAL: SeccionManual[] = [
  {
    titulo: "¿A qué se parece Trazo?",
    texto: [
      "Trazo mezcla dos ideas conocidas. Su forma de escribir se parece a C, Java o JavaScript: llaves { } para agrupar, punto y coma ; al final de cada orden y paréntesis en las condiciones.",
      "Lo de dibujar viene de Logo, el lenguaje de la \"tortuga\": hay un lápiz en el centro del lienzo que avanza y gira, y deja una línea por donde pasa.",
      "La diferencia es que todas las palabras están en español, como en PSeInt: si, sino, mientras, repetir, funcion, retornar.",
    ],
  },
  {
    titulo: "1. Tu primer programa",
    texto: [
      "Cada orden termina con punto y coma. avanzar mueve el lápiz hacia adelante y girar_derecha lo rota. El lápiz empieza en el centro mirando hacia arriba.",
      "mostrar escribe un mensaje en la pestaña Consola.",
    ],
    ejemplo: `avanzar(100);
girar_derecha(90);
avanzar(100);
mostrar("¡Hola, Trazo!");`,
  },
  {
    titulo: "2. Variables y tipos",
    texto: [
      "Antes de usar una variable hay que crearla diciendo su tipo. Hay 6 tipos: 4 generales y 2 musicales (nota y duracion, se explican en la sección 8). Después de crearla, se le cambia el valor sin repetir el tipo.",
      "Un entero se puede guardar en un decimal, pero no al revés (se perderían los decimales).",
    ],
    tabla: {
      columnas: ["Tipo", "Guarda"],
      filas: [
        ["entero", "números sin decimales: 5, -3, 100"],
        ["decimal", "números con decimales: 2.5, 0.75"],
        ["texto", "palabras entre comillas: \"hola\""],
        ["logico", "verdadero o falso"],
        ["nota", "una nota musical: do4, fa#3, sib5"],
        ["duracion", "cuánto dura un sonido: negra, corchea, negra + corchea"],
      ],
    },
    ejemplo: `entero edad = 20;
decimal altura = 1.75;
texto nombre = "Ana";
logico estudia = verdadero;

edad = edad + 1;
mostrar(nombre + " tiene " + edad + " años");
mostrar(altura);
mostrar(estudia);`,
  },
  {
    titulo: "3. Operaciones",
    texto: [
      "Aritmética: + - * / y % (el residuo de una división). La multiplicación y la división se hacen antes que la suma y la resta; usa paréntesis para cambiar el orden.",
      "Ojo: entero / entero da entero (7 / 2 es 3). Para tener decimales, usa un decimal: 7.0 / 2 es 3.5.",
      "Con + y un texto se unen: \"Hola \" + 5 da \"Hola 5\".",
      "Comparaciones: == (igual), != (distinto), < > <= >=. Lógicos: y, o, no.",
    ],
    ejemplo: `mostrar(2 + 3 * 4);
mostrar((2 + 3) * 4);
mostrar(7 / 2);
mostrar(7.0 / 2);
mostrar(10 % 3);
mostrar(5 > 3 y 2 == 2);
mostrar(no verdadero);`,
  },
  {
    titulo: "4. Decisiones: si / sino",
    texto: [
      "si ejecuta un bloque solo cuando la condición es verdadera. La condición va entre paréntesis y debe ser logico (algo verdadero o falso, no un número).",
      "Puedes encadenar varias opciones con sino si.",
    ],
    ejemplo: `entero calificacion = 4;
si (calificacion >= 4) {
  mostrar("Excelente");
} sino si (calificacion >= 3) {
  mostrar("Aprobado");
} sino {
  mostrar("Reprobado");
}`,
  },
  {
    titulo: "5. Ciclos: repetir y mientras",
    texto: [
      "repetir N veces { ... } repite un bloque un número fijo de veces. Es el más fácil para dibujar figuras.",
      "mientras (condición) { ... } repite mientras la condición sea verdadera. No olvides cambiar la variable dentro, o el ciclo nunca termina (Trazo lo detiene a los 100.000 pasos).",
    ],
    ejemplo: `// Un cuadrado con repetir
repetir 4 veces {
  avanzar(100);
  girar_derecha(90);
}

// Contar con mientras
entero i = 1;
mientras (i <= 3) {
  mostrar("vuelta " + i);
  i = i + 1;
}`,
  },
  {
    titulo: "6. Funciones",
    texto: [
      "Una función es un bloque de código con nombre que puedes usar varias veces. Se crea con funcion, su nombre y sus parámetros (cada uno con su tipo).",
      "Si la función devuelve un resultado, se escribe el tipo después de funcion y se usa retornar. Las funciones se declaran en el nivel principal y se pueden llamar antes de declararlas.",
    ],
    ejemplo: `funcion poligono(entero lados, decimal tam) {
  repetir lados veces {
    avanzar(tam);
    girar_derecha(360 / lados);
  }
}

funcion entero doble(entero n) {
  retornar n * 2;
}

poligono(5, 80);
mostrar(doble(21));`,
  },
  {
    titulo: "7. Funciones para dibujar",
    texto: [
      "Estas funciones vienen incluidas en el lenguaje. El origen (0, 0) está en el centro del lienzo; y crece hacia arriba.",
    ],
    tabla: {
      columnas: ["Función", "Qué hace"],
      filas: [
        ["avanzar(pasos)", "mueve el lápiz hacia adelante"],
        ["retroceder(pasos)", "mueve el lápiz hacia atrás"],
        ["girar_derecha(grados)", "gira en sentido del reloj"],
        ["girar_izquierda(grados)", "gira en sentido contrario"],
        ["subir_lapiz()", "se mueve sin dibujar"],
        ["bajar_lapiz()", "vuelve a dibujar"],
        ["ir_a(x, y)", "va directo a una posición"],
        ["color(\"rojo\")", "rojo, azul, verde, naranja, morado, negro, blanco, amarillo, rosado, gris o \"#ff8800\""],
        ["grosor(g)", "ancho de la línea"],
        ["limpiar()", "borra el lienzo"],
        ["mostrar(valor)", "escribe en la consola"],
        ["aleatorio(min, max)", "número entero al azar entre min y max"],
      ],
    },
    ejemplo: `grosor(3);
entero i = 0;
mientras (i < 12) {
  si (i % 2 == 0) { color("morado"); } sino { color("naranja"); }
  repetir 4 veces {
    avanzar(90);
    girar_derecha(90);
  }
  girar_derecha(30);
  i = i + 1;
}`,
  },
  {
    titulo: "8. Música",
    texto: [
      "Las notas se escriben con su nombre y su octava: do4 es el do central, fa#3 es fa sostenido y sib4 es si bemol. Por dentro cada nota es un número (do4 = 60), así que sumarle un entero la sube esa cantidad de semitonos: do4 + 7 es sol4.",
      "tocar nota duración; hace sonar una nota. Las duraciones son figuras: redonda (4 tiempos), blanca (2), negra (1), corchea (½) y semicorchea (¼). Se pueden combinar: negra + corchea, negra * 2.",
      "Hay dos tipos musicales. nota guarda una nota (nota base = do4;) y duracion guarda una figura (duracion d = negra + corchea;). Sus operaciones: nota + entero → nota (sube semitonos), nota - nota → entero (distancia en semitonos), duracion + duracion → duracion, duracion * entero → duracion. nota + nota es error: para que suenen juntas se usa acorde.",
      "tempo y compas no son tipos ni funciones: son instrucciones (como si o mientras) que llevan números enteros escritos directamente. tempo va de 1 a 400 y en compas 3/4 el número de abajo debe ser 1, 2, 4, 8 o 16. No aceptan variables: tempo velocidad; es error sintáctico.",
      "Dentro de un compas { } la duración debe escribirse fija (negra, negra + corchea, blanca * 2) y no con una variable, porque Trazo suma los tiempos al compilar, antes de ejecutar. La nota sí puede ser una variable.",
      "compas 4/4; fija la métrica. Cada compas { ... } debe sumar exactamente esos tiempos; si no, Trazo dice qué figura falta o sobra. Presiona ▶ Ejecutar para escucharla y abre la pestaña Partitura.",
    ],
    tabla: {
      columnas: ["Escribes", "Qué recibe y qué hace"],
      filas: [
        ["tempo 120;", "instrucción · entero literal (1–400): negras por minuto (por defecto 100)"],
        ["compas 3/4;", "instrucción · entero / entero literales: métrica de los compases siguientes"],
        ["compas { ... }", "bloque: debe sumar los tiempos de la métrica"],
        ["tocar do4 negra;", "instrucción · nota y duracion: toca una nota"],
        ["silencio corchea;", "instrucción · duracion: un silencio"],
        ["acorde [do4, mi4, sol4] blanca;", "instrucción · lista de nota y una duracion: varias notas a la vez"],
        ["instrumento(\"flauta\");", "nativa · texto: piano, organo, flauta u 8bit"],
        ["volumen(0.5);", "nativa · decimal (0 a 1): volumen"],
        ["dibujar_melodia(verdadero);", "nativa · logico: cada nota mueve el lápiz y la melodía dibuja su forma"],
      ],
    },
    ejemplo: `tempo 120;
compas 4/4;
instrumento("piano");

funcion frase(nota base) {
  compas { tocar base negra; tocar base + 2 negra; tocar base + 4 blanca; }
}

frase(do4);
frase(fa4);
compas { acorde [do4, mi4, sol4] redonda; }`,
  },
  {
    titulo: "9. Errores comunes",
    texto: [
      "Olvidar el ; al final de una línea → error sintáctico.",
      "Usar una variable sin crearla (escribir suma = 5; sin entero antes) → error semántico.",
      "Usar y, o, no, si, texto... como nombre de variable: son palabras reservadas.",
      "Poner un número como condición: si (x) {...} → la condición debe ser una comparación, por ejemplo si (x > 0).",
      "Guardar un decimal en un entero: entero n = 2.5; → error de tipos.",
      "Escribir print o printf: en Trazo se usa mostrar(...).",
      "Usar nota, tocar, negra, compas... como nombres de variables: también son palabras reservadas.",
      "Un compás que no suma lo que exige la métrica (por ejemplo 3.5 tiempos en 4/4) → error semántico que dice qué figura falta o sobra.",
      "Sumar dos notas (do4 + mi4): para que suenen juntas se usa acorde [do4, mi4] negra;",
    ],
  },
];
