// ARCHIVO GENERADO por scripts/generar-ejemplos.mjs a partir de los .trz. No editar a mano.

export interface Ejemplo { archivo: string; nombre: string; codigo: string }

export const EJEMPLOS: Ejemplo[] = [
  {
    "archivo": "01_cuadrado.trz",
    "nombre": "cuadrado",
    "codigo": "// Lo mínimo: un cuadrado con repetir\ncolor(\"azul\");\ngrosor(3);\nrepetir 4 veces {\n  avanzar(150);\n  girar_derecha(90);\n}\n"
  },
  {
    "archivo": "02_estrella.trz",
    "nombre": "estrella",
    "codigo": "// Estrella de cinco puntas: girar 144 grados en cada punta\ncolor(\"amarillo\");\ngrosor(3);\nsubir_lapiz();\nir_a(-120, 40);\nbajar_lapiz();\ngirar_derecha(90);\nrepetir 5 veces {\n  avanzar(240);\n  girar_derecha(144);\n}\n"
  },
  {
    "archivo": "03_espiral.trz",
    "nombre": "espiral",
    "codigo": "// Espiral cuadrada: mientras y variables\nentero i = 0;\ndecimal paso = 4;\ngrosor(2);\nmientras (i < 80) {\n  si (i % 3 == 0) { color(\"rosado\"); }\n  sino si (i % 3 == 1) { color(\"morado\"); }\n  sino { color(\"azul\"); }\n  avanzar(paso);\n  girar_derecha(91);\n  paso = paso + 4;\n  i = i + 1;\n}\nmostrar(\"Segmentos dibujados: \" + i);\n"
  },
  {
    "archivo": "04_flor_funciones.trz",
    "nombre": "flor funciones",
    "codigo": "// Flor: funciones con parámetros y ámbitos anidados\nfuncion poligono(entero lados, decimal tam) {\n  repetir lados veces {\n    avanzar(tam);\n    girar_derecha(360 / lados);\n  }\n}\n\nfuncion petalo(decimal tam) {\n  repetir 2 veces {\n    entero k = 0;\n    mientras (k < 18) {\n      avanzar(tam);\n      girar_derecha(5);\n      k = k + 1;\n    }\n    girar_derecha(90);\n  }\n}\n\nentero i = 0;\nmientras (i < 36) {\n  si (i % 2 == 0) { color(\"azul\"); } sino { color(\"naranja\"); }\n  poligono(6, 20 + i * 2);\n  girar_derecha(10);\n  i = i + 1;\n}\n\ncolor(\"verde\");\ngrosor(2);\nrepetir 12 veces {\n  petalo(6);\n  girar_derecha(30);\n}\nmostrar(\"Listo: \" + i + \" hexágonos\");\n"
  },
  {
    "archivo": "05_arbol_recursivo.trz",
    "nombre": "arbol recursivo",
    "codigo": "// Árbol fractal: una función recursiva que retorna cuántas ramas dibujó\nfuncion entero rama(decimal largo, entero nivel) {\n  si (nivel == 0) {\n    retornar 0;\n  }\n  grosor(nivel);\n  si (nivel > 3) { color(\"naranja\"); } sino { color(\"verde\"); }\n  avanzar(largo);\n  girar_izquierda(25);\n  entero izq = rama(largo * 0.72, nivel - 1);\n  girar_derecha(50);\n  entero der = rama(largo * 0.72, nivel - 1);\n  girar_izquierda(25);\n  subir_lapiz();\n  retroceder(largo);\n  bajar_lapiz();\n  retornar 1 + izq + der;\n}\n\nsubir_lapiz();\nir_a(0, -220);\nbajar_lapiz();\nentero total = rama(110, 8);\nmostrar(\"Ramas dibujadas: \" + total);\n"
  },
  {
    "archivo": "06_calculos.trz",
    "nombre": "calculos",
    "codigo": "// Cálculos sin dibujo: factorial, fibonacci y división entera\nfuncion entero factorial(entero n) {\n  si (n <= 1) { retornar 1; }\n  retornar n * factorial(n - 1);\n}\n\nfuncion entero fibonacci(entero n) {\n  entero a = 0;\n  entero b = 1;\n  repetir n veces {\n    entero t = a + b;\n    a = b;\n    b = t;\n  }\n  retornar a;\n}\n\nfuncion logico esPrimo(entero n) {\n  si (n < 2) { retornar falso; }\n  entero d = 2;\n  mientras (d * d <= n) {\n    si (n % d == 0) { retornar falso; }\n    d = d + 1;\n  }\n  retornar verdadero;\n}\n\nentero i = 1;\nmientras (i <= 10) {\n  mostrar(i + \"! = \" + factorial(i) + \"   fib(\" + i + \") = \" + fibonacci(i));\n  i = i + 1;\n}\n\ntexto primos = \"Primos menores que 50:\";\nentero n = 2;\nmientras (n < 50) {\n  si (esPrimo(n)) { primos = primos + \" \" + n; }\n  n = n + 1;\n}\nmostrar(primos);\n\nmostrar(\"7 / 2 = \" + 7 / 2 + \" (división entera)\");\nmostrar(\"7.0 / 2 = \" + 7.0 / 2 + \" (división decimal)\");\nmostrar(\"Dado: \" + aleatorio(1, 6));\n"
  },
  {
    "archivo": "07_optimizable.trz",
    "nombre": "optimizable",
    "codigo": "// Lleno de constantes y código muerto para lucir el optimizador.\n// Activa \"Optimizar\" y abre la pestaña Optimización.\nentero lados = 4 + 2;\nentero tam = 10 * 6 + 0;\ndecimal factor = 1.5 * 2;\ntexto saludo = \"Hola, \" + \"Trazo\";\nlogico depurar = falso;\n\nfuncion entero doble(entero x) {\n  retornar x * 2;\n  mostrar(\"esto nunca se ejecuta\");\n}\n\nsi (depurar) {\n  mostrar(\"modo depuración\");\n}\n\nsi (verdadero) {\n  color(\"morado\");\n} sino {\n  color(\"gris\");\n}\n\nmientras (falso) {\n  avanzar(1000);\n}\n\ngrosor(factor * 1);\nrepetir lados veces {\n  avanzar(tam * 1 + doble(0) * 0);\n  girar_derecha(360 / lados);\n}\n\nmostrar(saludo);\nmostrar(no no verdadero);\nmostrar(\"Área aproximada: \" + (tam * tam * 2 + 0));\n"
  },
  {
    "archivo": "08_error_lexico.trz",
    "nombre": "error lexico",
    "codigo": "// Errores léxicos a propósito\nentero precio = 3.;\nentero total = 1.2.3;\ntexto nombre = \"Trazo sin cerrar;\ndecimal x = 10 @ 2;\nmostrar(precio # total);\n/* este comentario no se cierra\n"
  },
  {
    "archivo": "09_error_sintactico.trz",
    "nombre": "error sintactico",
    "codigo": "// Errores sintácticos a propósito: el parser se recupera y los reporta todos\nentero x = ;\nentero n = 5\nmientras (n > 0) {\n  n = n - 1;\n}\nrepetir 3 {\n  avanzar(10);\n}\nsi n > 2 {\n  mostrar(\"mayor\");\n}\navanzar(10;\n"
  },
  {
    "archivo": "10_error_semantico.trz",
    "nombre": "error semantico",
    "codigo": "// Errores semánticos a propósito: la sintaxis es correcta pero el significado no\nentero x = \"hola\";\ndecimal d = 2.5;\nentero e = d;\navanzar(\"hola\");\ngirar_derecha(1, 2);\nmostrar(z);\nsaltar(10);\n\nfuncion entero doble(entero n) {\n  si (n > 0) { retornar n * 2; }\n}\n\nfuncion saludar() {\n  retornar 5;\n}\n\nsi (x + 1) { mostrar(\"raro\"); }\nentero r = saludar();\nentero x = 3;\nretornar;\n"
  },
  {
    "archivo": "11_escala.trz",
    "nombre": "escala",
    "codigo": "// Escala de do mayor: mientras + transposición.\n// Entre mi-fa y si-do hay medio tono (1 semitono); entre las demás notas, un tono (2).\ntempo 120;\ninstrumento(\"piano\");\n\nnota n = do4;\nentero paso = 0;\nmientras (paso < 8) {\n  tocar n negra;\n  si (paso == 2 o paso == 6) {\n    n = n + 1;\n  } sino {\n    n = n + 2;\n  }\n  paso = paso + 1;\n}\nmostrar(\"La escala terminó en \" + (n - 2));\n"
  },
  {
    "archivo": "12_himno_alegria.trz",
    "nombre": "himno alegria",
    "codigo": "// Himno de la Alegría (Ludwig van Beethoven, Novena Sinfonía, 1824). Dominio público.\n// Cada compás de 4/4 debe sumar 4 tiempos: prueba a borrar una corchea.\ntempo 120;\ncompas 4/4;\ninstrumento(\"piano\");\n\ncompas { tocar mi4 negra; tocar mi4 negra; tocar fa4 negra; tocar sol4 negra; }\ncompas { tocar sol4 negra; tocar fa4 negra; tocar mi4 negra; tocar re4 negra; }\ncompas { tocar do4 negra; tocar do4 negra; tocar re4 negra; tocar mi4 negra; }\ncompas { tocar mi4 negra + corchea; tocar re4 corchea; tocar re4 blanca; }\n\ncompas { tocar mi4 negra; tocar mi4 negra; tocar fa4 negra; tocar sol4 negra; }\ncompas { tocar sol4 negra; tocar fa4 negra; tocar mi4 negra; tocar re4 negra; }\ncompas { tocar do4 negra; tocar do4 negra; tocar re4 negra; tocar mi4 negra; }\ncompas { tocar re4 negra + corchea; tocar do4 corchea; tocar do4 blanca; }\n"
  },
  {
    "archivo": "13_estrellita.trz",
    "nombre": "estrellita",
    "codigo": "// Estrellita, ¿dónde estás? (melodía tradicional). Dominio público.\n// Una función con un parámetro de tipo nota: la misma frase desde cualquier nota.\ntempo 110;\ncompas 4/4;\ninstrumento(\"flauta\");\n\nfuncion frase(nota base) {\n  compas { tocar base negra; tocar base negra; tocar base + 7 negra; tocar base + 7 negra; }\n  compas { tocar base + 9 negra; tocar base + 9 negra; tocar base + 7 blanca; }\n}\n\nfuncion bajada(nota base) {\n  compas { tocar base negra; tocar base negra; tocar base - 2 negra; tocar base - 2 negra; }\n  compas { tocar base - 3 negra; tocar base - 3 negra; tocar base - 5 blanca; }\n}\n\nfuncion cierre() {\n  compas { tocar fa4 negra; tocar fa4 negra; tocar mi4 negra; tocar mi4 negra; }\n  compas { tocar re4 negra; tocar re4 negra; tocar do4 blanca; }\n}\n\nfrase(do4);\ncierre();\nbajada(sol4);\nbajada(sol4);\nfrase(do4);\ncierre();\n"
  },
  {
    "archivo": "14_acordes.trz",
    "nombre": "acordes",
    "codigo": "// Progresión de acordes do mayor – la menor – fa mayor – sol mayor.\n// Un acorde suena con todas sus notas a la vez.\ntempo 80;\ncompas 4/4;\ninstrumento(\"organo\");\nvolumen(0.6);\n\ncompas { acorde [do4, mi4, sol4] redonda; }\ncompas { acorde [la3, do4, mi4] redonda; }\ncompas { acorde [fa3, la3, do4] redonda; }\ncompas { acorde [sol3, si3, re4] blanca; acorde [sol3, si3, re4, fa4] blanca; }\ncompas { acorde [do4, mi4, sol4, do5] redonda; }\n"
  },
  {
    "archivo": "15_melodia_que_dibuja.trz",
    "nombre": "melodia que dibuja",
    "codigo": "// La melodía dibuja su propia forma: cada nota mueve el lápiz\n// hacia la derecha según su duración y hacia arriba según su altura.\ntempo 140;\ncompas 4/4;\ninstrumento(\"8bit\");\ncolor(\"rosado\");\ngrosor(4);\n\nsubir_lapiz();\nir_a(-330, -40);\nbajar_lapiz();\ndibujar_melodia(verdadero);\n\nnota base = do4;\nrepetir 4 veces {\n  compas {\n    tocar base corchea; tocar base + 4 corchea; tocar base + 7 corchea; tocar base + 12 corchea;\n    tocar base + 7 corchea; tocar base + 4 corchea; tocar base negra;\n  }\n  base = base + 5;\n}\n"
  },
  {
    "archivo": "16_error_compas.trz",
    "nombre": "error compas",
    "codigo": "// Error semántico a propósito: los compases no suman lo que exige la métrica 4/4.\n// La sintaxis es correcta; el problema es de significado (la duración del compás).\ntempo 100;\ncompas 4/4;\n\ncompas { tocar do4 negra; tocar re4 negra; tocar mi4 negra; tocar fa4 negra; }\ncompas { tocar sol4 negra; tocar la4 negra; tocar sol4 negra; tocar fa4 corchea; }\ncompas { tocar mi4 blanca; tocar re4 blanca; tocar do4 negra; }\n"
  },
  {
    "archivo": "17_error_nota.trz",
    "nombre": "error nota",
    "codigo": "// Error léxico a propósito: la octava va de 0 a 8, así que do9 no es una nota.\n// Corrígelo a do5 para ver el siguiente error: no se pueden sumar dos notas (semántico).\ntempo 100;\ntocar do9 negra;\nnota acorde_mal = do4 + mi4;\ntocar acorde_mal negra;\n"
  }
];
