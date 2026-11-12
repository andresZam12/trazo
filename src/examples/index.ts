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
  }
];
