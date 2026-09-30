/// <reference path="../vite-worker.d.ts" />
import { useEffect, useRef } from "react";
// Tek giris noktasi: Vite gelistirme modu alt modulleri ayri on-paketlerse dil kaydi ile editor
// farkli Monaco kopyalarinda kalir. Kullanilmayan dillerin worker'lari yalnizca istenirse yuklenir.
import * as monaco from "monaco-editor";
// Worker'lar Vite `?worker` ile uygulamanin kendi paketinden yuklenir (CDN yok). Monaco'nun kendi
// `new URL(...)` yolu Vite gelistirme modunda on-paketleme nedeniyle calismadigi icin acikca verilir.
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import JsonWorker from "monaco-editor/language/json/json.worker?worker";

import type { JsonEditorProps } from "./JsonEditor";

// Uygulama kendi MonacoEnvironment'ini tanimladiysa ona dokunulmaz.
const monacoGlobal = globalThis as typeof globalThis & { MonacoEnvironment?: monaco.Environment };
if (!monacoGlobal.MonacoEnvironment) {
  monacoGlobal.MonacoEnvironment = {
    getWorker: (_workerId, label) => (label === "json" ? new JsonWorker() : new EditorWorker()),
  };
}

monaco.editor.defineTheme("dtp-light", {
  base: "vs",
  inherit: true,
  rules: [],
  colors: { "editor.background": "#ffffff" },
});
monaco.editor.defineTheme("dtp-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [],
  colors: { "editor.background": "#15161a", "editorGutter.background": "#15161a" },
});

const isDark = () => document.documentElement.classList.contains("dark");
const themeName = () => (isDark() ? "dtp-dark" : "dtp-light");

// JSON dogrulama secenekleri tum editorler icin ortaktir; her editor kendi semasini kaydeder.
const schemas = new Map<string, object>();
const applySchemas = () => {
  monaco.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    allowComments: false,
    schemaValidation: "error",
    schemas: Array.from(schemas, ([uri, schema]) => ({ uri: `${uri}#schema`, fileMatch: [uri], schema })),
  });
};

let modelCounter = 0;

export default function MonacoJsonEditor({ value, onChange, ariaLabel, schema, invalid, placeholder }: JsonEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const uriRef = useRef(`inmemory://modern-dt-pro/json-${(modelCounter += 1)}.json`);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const model = monaco.editor.createModel(value, "json", monaco.Uri.parse(uriRef.current));
    const editor = monaco.editor.create(container, {
      model,
      theme: themeName(),
      ariaLabel,
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 12,
      lineNumbersMinChars: 3,
      scrollBeyondLastLine: false,
      tabSize: 2,
      formatOnPaste: true,
      renderLineHighlight: "line",
      folding: true,
      stickyScroll: { enabled: false },
      padding: { top: 8, bottom: 8 },
    });
    editorRef.current = editor;
    const subscription = editor.onDidChangeModelContent(() => onChangeRef.current(editor.getValue()));

    // Sayfa temasi degisince editor de uyar
    const observer = new MutationObserver(() => monaco.editor.setTheme(themeName()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      observer.disconnect();
      subscription.dispose();
      editor.dispose();
      model.dispose();
      editorRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Disaridan gelen deger (ornek metin, dosya, geri al) editore aktarilir; geri alma gecmisi korunur
  useEffect(() => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model || model.getValue() === value) return;
    editor.pushUndoStop();
    model.pushEditOperations([], [{ range: model.getFullModelRange(), text: value }], () => null);
    editor.pushUndoStop();
  }, [value]);

  useEffect(() => {
    const uri = uriRef.current;
    if (schema) schemas.set(uri, schema);
    else schemas.delete(uri);
    applySchemas();
    return () => {
      schemas.delete(uri);
      applySchemas();
    };
  }, [schema]);

  return (
    <div
      className={
        "dtp-json-editor relative min-h-0 flex-1 overflow-hidden rounded-md border "
        + (invalid ? "border-red-400" : "dark:border-dark-450 border-gray-300")
      }
    >
      <div ref={containerRef} className="absolute inset-0" />
      {placeholder && value === "" ? (
        // Bos editorde ornek bicim; tiklamalar editore gecer
        <pre className="dark:text-dark-300 pointer-events-none absolute top-2 left-12 m-0 font-mono text-xs leading-[18px] whitespace-pre text-gray-400">
          {placeholder}
        </pre>
      ) : null}
    </div>
  );
}
