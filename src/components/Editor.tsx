"use client";

// Editor Monaco con el lenguaje "trazo" registrado: resaltado de sintaxis,
// errores subrayados (markers) y resaltado del fragmento seleccionado en otra pestaña.

import MonacoEditor, { type Monaco, type OnMount } from "@monaco-editor/react";
import { useEffect, useRef } from "react";
import type { ErrorCompilacion } from "@/compiler/errors";
import { FIRMAS_NATIVAS } from "@/compiler/natives";
import { PALABRAS_RESERVADAS } from "@/compiler/tokens";

export interface Rango {
  linea: number;
  columna: number;
  longitud: number;
}

interface Props {
  valor: string;
  onCambio: (v: string) => void;
  problemas: ErrorCompilacion[];
  resaltado: Rango | null;
  /** Cambia cada vez que se pide ir a una línea (clic en un error). */
  irA: Rango & { n: number } | null;
}

type EditorMonaco = Parameters<OnMount>[0];

/** Registra el lenguaje una sola vez: tokens (Monarch) y tema oscuro. */
function registrarTrazo(monaco: Monaco) {
  if (monaco.languages.getLanguages().some((l: { id: string }) => l.id === "trazo")) return;
  monaco.languages.register({ id: "trazo" });
  const tipos = ["entero", "decimal", "texto", "logico", "nota", "duracion"];
  monaco.languages.setMonarchTokensProvider("trazo", {
    tipos,
    palabras: Object.keys(PALABRAS_RESERVADAS).filter((p) => !tipos.includes(p)),
    nativas: FIRMAS_NATIVAS.map((f) => f.nombre),
    tokenizer: {
      root: [
        [/\/\/.*$/, "comment"],
        [/\/\*/, "comment", "@comentario"],
        [/"([^"\\]|\\.)*$/, "string.invalid"],
        [/"/, "string", "@texto"],
        // Notas musicales (do4, fa#3, sib5) antes que los identificadores
        [/(sol|do|re|mi|fa|la|si)[#b]?[0-8](?![\wáéíóúÁÉÍÓÚñÑüÜ])/, "nota"],
        [/\d+\.\d+/, "number.float"],
        [/\d+/, "number"],
        [/[a-zA-Z_áéíóúÁÉÍÓÚñÑüÜ][\wáéíóúÁÉÍÓÚñÑüÜ]*/, { cases: { "@tipos": "type", "@palabras": "keyword", "@nativas": "predefined", "@default": "identifier" } }],
        [/[=!<>]=|[+\-*/%<>=]/, "operator"],
        [/[{}()\[\]]/, "@brackets"],
        [/[;,]/, "delimiter"],
      ],
      comentario: [[/\*\//, "comment", "@pop"], [/./, "comment"]],
      texto: [[/\\./, "string.escape"], [/"/, "string", "@pop"], [/[^"\\]+/, "string"]],
    },
  });
  monaco.languages.setLanguageConfiguration("trazo", {
    comments: { lineComment: "//", blockComment: ["/*", "*/"] },
    brackets: [["{", "}"], ["(", ")"], ["[", "]"]],
    autoClosingPairs: [{ open: "{", close: "}" }, { open: "(", close: ")" }, { open: "[", close: "]" }, { open: '"', close: '"' }],
  });
  monaco.editor.defineTheme("trazo-oscuro", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "c084fc", fontStyle: "bold" },
      { token: "type", foreground: "38bdf8" },
      { token: "predefined", foreground: "facc15" },
      { token: "number", foreground: "fb923c" },
      { token: "number.float", foreground: "fb923c" },
      { token: "nota", foreground: "2dd4bf", fontStyle: "bold" },
      { token: "string", foreground: "4ade80" },
      { token: "string.escape", foreground: "86efac", fontStyle: "bold" },
      { token: "comment", foreground: "64748b", fontStyle: "italic" },
      { token: "operator", foreground: "f472b6" },
    ],
    colors: { "editor.background": "#0f1420" },
  });
}

export default function Editor({ valor, onCambio, problemas, resaltado, irA }: Props) {
  const editorRef = useRef<EditorMonaco | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decoraciones = useRef<string[]>([]);

  // Errores y advertencias como subrayados (markers)
  useEffect(() => {
    const monaco = monacoRef.current;
    const modelo = editorRef.current?.getModel();
    if (!monaco || !modelo) return;
    monaco.editor.setModelMarkers(
      modelo,
      "trazo",
      problemas.map((p) => ({
        startLineNumber: p.linea,
        startColumn: p.columna,
        endLineNumber: p.linea,
        endColumn: p.columna + p.longitud,
        message: `[${p.fase}] ${p.mensaje}`,
        severity: p.severidad === "error" ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
      })),
    );
  }, [problemas]);

  // Resaltado del fragmento señalado desde otra pestaña
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    decoraciones.current = editor.deltaDecorations(
      decoraciones.current,
      resaltado
        ? [
            {
              range: { startLineNumber: resaltado.linea, startColumn: resaltado.columna, endLineNumber: resaltado.linea, endColumn: resaltado.columna + resaltado.longitud },
              options: { inlineClassName: "trazo-resaltado", className: "trazo-linea-resaltada", isWholeLine: false },
            },
          ]
        : [],
    );
    if (resaltado) editor.revealLineInCenterIfOutsideViewport(resaltado.linea);
  }, [resaltado]);

  // Ir a una línea (clic en un error)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !irA) return;
    editor.revealLineInCenter(irA.linea);
    editor.setPosition({ lineNumber: irA.linea, column: irA.columna });
    editor.focus();
  }, [irA]);

  return (
    <MonacoEditor
      language="trazo"
      theme="trazo-oscuro"
      value={valor}
      onChange={(v) => onCambio(v ?? "")}
      beforeMount={registrarTrazo}
      onMount={(editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;
      }}
      options={{
        fontSize: 15,
        fontFamily: "Cascadia Code, Consolas, monospace",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        tabSize: 2,
        automaticLayout: true,
        renderLineHighlight: "line",
        padding: { top: 12 },
      }}
      loading={<div className="p-4 text-slate-500">Cargando editor…</div>}
    />
  );
}
