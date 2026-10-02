import { useDeferredValue, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  CheckCircleIcon,
  DocumentArrowUpIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";

import { Button } from "../ui";
import { formatColumnHeader } from "../utils/formatCellValue";
import { detectPivotFields } from "./pivotEngine";
import { PIVOT_DATA_SCHEMA, parsePivotJson } from "./pivotValidation";
import { JsonEditor } from "./JsonEditor";

const EXAMPLE = `[
  { "bolge": "Ege", "sehir": "İzmir", "tarih": "2025-03-14", "tutar": 1250 },
  { "bolge": "Marmara", "sehir": "Bursa", "tarih": "2025-04-02", "tutar": 980 }
]`;



export function PivotDataPanel({
  open,
  currentData,
  onClose,
  onApply,
}: {
  open: boolean;
  currentData: readonly Record<string, unknown>[];
  onClose: () => void;
  onApply: (rows: Record<string, unknown>[]) => void;
}) {
  const [text, setText] = useState("");
  /** Pencere acildiginda editore konan mevcut veri metni (degisiklik kontrolu icin). */
  const [initialText, setInitialText] = useState("");
  const [fileName, setFileName] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);

  // Her acilista tablodaki guncel veri editore konur
  useEffect(() => {
    if (!open) return;
    const current = currentData.length > 0 ? JSON.stringify(currentData, null, 2) : "";
    setInitialText(current);
    setText(current);
    setFileName(undefined);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const isCurrent = text === initialText && initialText !== "";

  // Buyuk metinlerde yazarken takilmamasi icin dogrulama ertelenir
  const deferredText = useDeferredValue(text);
  const result = useMemo(() => (deferredText.trim() ? parsePivotJson(deferredText) : undefined), [deferredText]);
  const summary = useMemo(() => {
    if (!result?.ok) return undefined;
    const fields = detectPivotFields(result.rows, { formatLabel: formatColumnHeader }).filter((field) => !field.parentId);
    return {
      count: result.rows.length,
      fields: fields.length,
      numeric: fields.filter((field) => field.isNumeric).length,
      dates: fields.filter((field) => field.isDate).length,
      names: fields.map((field) => field.id),
    };
  }, [result]);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setFileName(file.name);
    setText(await file.text());
  };

  // Mevcut veri degistirilmeden uygulanirsa pivot ayarlari bosuna sifirlanir
  const canApply = result?.ok === true && deferredText === text && !isCurrent;

  return (
    <>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outlined" className="h-8 gap-1.5 px-3 text-sm" onClick={() => fileRef.current?.click()}>
            <DocumentArrowUpIcon className="size-4" />
            Dosyadan yükle
          </Button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFile} />
          <Button
            variant="flat"
            className="h-8 px-3 text-sm"
            disabled={text === ""}
            onClick={() => {
              setFileName(undefined);
              setText("");
            }}
          >
            Temizle
          </Button>
          {fileName ? <span className="dark:text-dark-300 truncate text-xs text-gray-500">{fileName}</span> : null}
          <div className="ml-auto flex items-center gap-3">
            {text !== initialText && initialText !== "" ? (
              <button
                type="button"
                className="text-primary-600 dark:text-primary-400 text-xs hover:underline"
                onClick={() => {
                  setFileName(undefined);
                  setText(initialText);
                }}
              >
                Mevcut veriye dön
              </button>
            ) : null}
            <button
              type="button"
              className="text-primary-600 dark:text-primary-400 text-xs hover:underline"
              onClick={() => {
                setFileName(undefined);
                setText(EXAMPLE);
              }}
            >
              Örnek biçimi göster
            </button>
          </div>
        </div>

        <JsonEditor
          value={text}
          onChange={(next) => {
            setFileName(undefined);
            setText(next);
          }}
          ariaLabel="JSON verisi"
          invalid={result?.ok === false}
          placeholder={EXAMPLE}
          schema={PIVOT_DATA_SCHEMA}
        />

        <div role="status" aria-live="polite" className="min-h-10 text-sm">
          {result?.ok === false ? (
            <p className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-red-700 dark:bg-red-500/10 dark:text-red-300">
              <ExclamationCircleIcon className="mt-0.5 size-4 shrink-0" />
              {result.error}
            </p>
          ) : summary ? (
            <div className="flex items-start gap-2 rounded-md bg-green-50 px-3 py-2 text-green-800 dark:bg-green-500/10 dark:text-green-300">
              <CheckCircleIcon className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0">
                <p>
                  {isCurrent ? "Mevcut veri: " : ""}
                  {summary.count.toLocaleString("tr-TR")} kayıt · {summary.fields} alan
                  {" "}({summary.numeric} sayısal{summary.dates ? `, ${summary.dates} tarih` : ""})
                </p>
                <p className="truncate text-xs opacity-80" title={summary.names.join(", ")}>
                  {summary.names.join(", ")}
                </p>
                {result?.ok && result.note ? <p className="text-xs opacity-80">{result.note}</p> : null}
              </div>
            </div>
          ) : (
            <p className="dark:text-dark-300 text-xs text-gray-500">
              Her öğe aynı alanlara sahip bir nesne olmalı. Tarih alanları (ör. "2025-03-14") otomatik tanınır.
            </p>
          )}
        </div>
      </div>

      <div className="dark:border-dark-500 flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 px-5 py-3">
        <p className="dark:text-dark-300 mr-auto text-xs text-gray-500">
          {isCurrent
            ? "Tablodaki mevcut veri gösteriliyor; değiştirince uygulayabilirsiniz."
            : "Uygulayınca mevcut pivot ayarları sıfırlanır."}
        </p>
        <Button variant="flat" className="h-9 px-3 text-sm" onClick={onClose}>
          Vazgeç
        </Button>
        <Button
          color="primary"
          className="h-9 px-5 text-sm"
          disabled={!canApply}
          onClick={() => {
            if (result?.ok) onApply(result.rows);
          }}
        >
          Uygula ve alanları seç
        </Button>
      </div>
    </>
  );
}
