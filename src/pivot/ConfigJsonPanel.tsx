import { useDeferredValue, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ClipboardDocumentIcon,
  DocumentArrowUpIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

import { Button } from "../ui";
import { buildExportFilename } from "../utils/exportTable";
import { JsonEditor } from "./JsonEditor";

type Tab = "summary" | "json";

/** JSON metninin dogrulama sonucu; uyarilar uygulamayi engellemez. */
export type ConfigJsonParseResult<V> =
  | { ok: true; value: V; warnings: string[] }
  | { ok: false; errors: string[] };

/**
 * Yapilandirma sekmesi: ayarlarin ozeti ve paylasilabilir JSON hali (kopyala, indir, dosyadan yukle,
 * duzenleyip uygula). Pivot ve normal tablo ayni paneli kullanir.
 */
export function ConfigJsonPanel<V>({
  open,
  onClose,
  currentJson,
  parse,
  schema,
  description,
  summary,
  downloadName,
  onApply,
  onNotify,
}: {
  open: boolean;
  onClose: () => void;
  /** Guncel ayarlarin JSON hali. */
  currentJson: string;
  parse: (text: string) => ConfigJsonParseResult<V>;
  schema: object;
  description: string;
  summary: ReactNode;
  /** Indirilen dosyanin adi (uzantisiz). */
  downloadName: string;
  onApply: (value: V) => void;
  onNotify: (type: "success" | "error", message: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("summary");
  const [text, setText] = useState(currentJson);
  const fileRef = useRef<HTMLInputElement>(null);

  // Her acilista guncel ayarlarla basla
  useEffect(() => {
    if (open) {
      setText(currentJson);
      setTab("summary");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const deferredText = useDeferredValue(text);
  const parsed = useMemo(() => parse(deferredText), [parse, deferredText]);
  const changed = text.trim() !== currentJson.trim();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      onNotify("success", "Yapılandırma panoya kopyalandı");
    } catch {
      onNotify("error", "Panoya kopyalanamadı");
    }
  };

  const download = () => {
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = buildExportFilename(downloadName, "json");
    link.click();
    URL.revokeObjectURL(url);
  };

  const loadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setText(await file.text());
    setTab("json");
  };

  return (
    <>
      <div className="dark:border-dark-500 flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-2.5">
        <p className="dark:text-dark-300 text-xs text-gray-500">{description}</p>
        <div role="tablist" className="dark:border-dark-450 inline-flex rounded-md border border-gray-300 p-0.5">
          {(["summary", "json"] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={clsx(
                "rounded px-3 py-1 text-sm",
                tab === id
                  ? "bg-primary-600 font-medium text-white"
                  : "dark:text-dark-100 dark:hover:bg-dark-600 text-gray-700 hover:bg-gray-100",
              )}
            >
              {id === "summary" ? "Özet" : "JSON"}
            </button>
          ))}
        </div>
      </div>

      {tab === "summary" ? (
        summary
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outlined" className="h-8 gap-1.5 px-3 text-sm" onClick={() => void copy()}>
              <ClipboardDocumentIcon className="size-4" />
              Kopyala
            </Button>
            <Button variant="outlined" className="h-8 gap-1.5 px-3 text-sm" onClick={download}>
              <ArrowDownTrayIcon className="size-4" />
              İndir
            </Button>
            <Button variant="outlined" className="h-8 gap-1.5 px-3 text-sm" onClick={() => fileRef.current?.click()}>
              <DocumentArrowUpIcon className="size-4" />
              Dosyadan yükle
            </Button>
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={loadFile} />
            {changed ? (
              <button
                type="button"
                className="text-primary-600 dark:text-primary-400 ml-auto text-xs hover:underline"
                onClick={() => setText(currentJson)}
              >
                Değişiklikleri geri al
              </button>
            ) : null}
          </div>
          <JsonEditor
            value={text}
            onChange={setText}
            ariaLabel="Yapılandırma JSON"
            invalid={!parsed.ok}
            schema={schema}
          />
          <div role="status" aria-live="polite" className="max-h-28 overflow-y-auto text-sm">
            {!parsed.ok ? (
              <ul className="flex flex-col gap-1 rounded-md bg-red-50 px-3 py-2 text-red-700 dark:bg-red-500/10 dark:text-red-300">
                {parsed.errors.map((error) => (
                  <li key={error} className="flex items-start gap-2">
                    <ExclamationCircleIcon className="mt-0.5 size-4 shrink-0" />
                    {error}
                  </li>
                ))}
              </ul>
            ) : parsed.warnings.length > 0 ? (
              <ul className="flex flex-col gap-1 rounded-md bg-amber-50 px-3 py-2 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                {parsed.warnings.map((warning) => (
                  <li key={warning} className="flex items-start gap-2">
                    <ExclamationTriangleIcon className="mt-0.5 size-4 shrink-0" />
                    {warning}
                  </li>
                ))}
              </ul>
            ) : changed ? (
              <p className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <CheckCircleIcon className="size-4" />
                Yapılandırma geçerli; uygulamaya hazır.
              </p>
            ) : (
              <p className="dark:text-dark-300 text-xs text-gray-500">
                Düzenleyip "Uygula" ile tabloya aktarabilir ya da dosya olarak saklayıp başka bir veride yükleyebilirsiniz.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="dark:border-dark-500 flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 px-5 py-3">
        <Button variant="flat" className="h-9 px-3 text-sm" onClick={onClose}>
          Kapat
        </Button>
        {tab === "json" ? (
          <Button
            color="primary"
            className="h-9 px-5 text-sm"
            disabled={!parsed.ok || !changed || deferredText !== text}
            onClick={() => {
              if (!parsed.ok) return;
              onApply(parsed.value);
              onNotify("success", "Yapılandırma uygulandı");
              onClose();
            }}
          >
            Uygula
          </Button>
        ) : null}
      </div>
    </>
  );
}
