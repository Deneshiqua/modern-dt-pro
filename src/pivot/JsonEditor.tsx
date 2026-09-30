import { Component, lazy, Suspense, type ReactNode } from "react";
import clsx from "clsx";

export type JsonEditorProps = {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  /** JSON Schema: otomatik tamamlama ve dogrulama icin. */
  schema?: object;
  invalid?: boolean;
  placeholder?: string;
};

// Monaco yalnizca bir JSON penceresi acildiginda ayri parca olarak yuklenir.
const MonacoJsonEditor = lazy(() => import("./MonacoJsonEditor"));

/** Monaco yuklenirken ya da yuklenemezse kullanilan duz metin alani. */
function PlainJsonEditor({ value, onChange, ariaLabel, invalid, placeholder }: JsonEditorProps) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      spellCheck={false}
      aria-label={ariaLabel}
      aria-invalid={invalid}
      placeholder={placeholder}
      className={clsx(
        "dark:bg-dark-800 dark:text-dark-100 min-h-0 flex-1 resize-none rounded-md border bg-white p-3 font-mono text-xs leading-relaxed text-gray-800 outline-hidden focus:ring-2",
        invalid
          ? "border-red-400 focus:ring-red-500/20"
          : "dark:border-dark-450 focus:border-primary-500 focus:ring-primary-500/20 border-gray-300",
      )}
    />
  );
}

class EditorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("modern-dt-pro: Monaco editör yüklenemedi, düz metin alanı kullanılıyor.", error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** JSON duzenleyici: Monaco (sozdizimi renklendirme, sema ile tamamlama); olmazsa metin alani. */
export function JsonEditor(props: JsonEditorProps) {
  const fallback = <PlainJsonEditor {...props} />;
  return (
    <EditorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <MonacoJsonEditor {...props} />
      </Suspense>
    </EditorBoundary>
  );
}
