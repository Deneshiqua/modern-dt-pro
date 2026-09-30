import { Fragment, useDeferredValue, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from "@headlessui/react";
import {
  CheckCircleIcon,
  CircleStackIcon,
  DocumentArrowUpIcon,
  ExclamationCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

import { Button } from "../ui";
import { formatColumnHeader } from "../utils/formatCellValue";
import { detectPivotFields } from "./pivotEngine";
import { PIVOT_DATA_SCHEMA, parsePivotJson } from "./pivotValidation";
import { JsonEditor } from "./JsonEditor";
import {
  MAXIMIZED_DIALOG_CLASS,
  MaximizeButton,
  RESIZABLE_DIALOG_LIMITS_CLASS,
  useResizableDialog,
} from "./resizableDialog";

const EXAMPLE = `[
  { "bolge": "Ege", "sehir": "İzmir", "tarih": "2025-03-14", "tutar": 1250 },
  { "bolge": "Marmara", "sehir": "Bursa", "tarih": "2025-04-02", "tutar": 980 }
]`;

type PivotDataButtonProps = {
  /** Gecerli veri uygulandiginda cagrilir. */
  onApply: (rows: Record<string, unknown>[]) => void;
};

export function PivotDataButton({ onApply }: PivotDataButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="flat"
        className="h-8 gap-1.5 rounded-full px-3 text-sm"
        title="Veri yükle"
        onClick={() => setOpen(true)}
      >
        <CircleStackIcon className="size-5" />
        <span>Veri</span>
      </Button>
      <PivotDataDialog
        open={open}
        onClose={() => setOpen(false)}
        onApply={(rows) => {
          setOpen(false);
          onApply(rows);
        }}
      />
    </>
  );
}

function PivotDataDialog({
  open,
  onClose,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  onApply: (rows: Record<string, unknown>[]) => void;
}) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);
  const resizable = useResizableDialog(open);

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

  const canApply = result?.ok === true && deferredText === text;

  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-[200]">
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-900/40 dark:bg-black/60" aria-hidden="true" />
        </TransitionChild>
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel
              ref={resizable.panelRef}
              className={clsx(
                "dtp dark:bg-dark-750 dark:border-dark-500 dark:text-dark-100 flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white text-gray-700 shadow-2xl",
                resizable.maximized
                  ? MAXIMIZED_DIALOG_CLASS
                  : clsx("h-[min(36rem,calc(100dvh-2rem))] w-[min(48rem,calc(100vw-2rem))]", RESIZABLE_DIALOG_LIMITS_CLASS),
              )}
            >
              <div className="dark:border-dark-500 flex items-center gap-3 border-b border-gray-200 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <DialogTitle className="dark:text-dark-50 text-lg font-semibold text-gray-900">Veri Yükle</DialogTitle>
                  <p className="dark:text-dark-300 text-xs text-gray-500">
                    JSON listesini yapıştırın; uygulayınca Alan Seçici açılır.
                  </p>
                </div>
                <MaximizeButton maximized={resizable.maximized} onClick={resizable.toggleMaximized} />
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Kapat"
                  title="Kapat"
                  className="dark:hover:bg-dark-500 grid size-8 place-items-center rounded-full text-gray-500 hover:bg-gray-100"
                >
                  <XMarkIcon className="size-5" />
                </button>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-3 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outlined" className="h-8 gap-1.5 px-3 text-sm" onClick={() => fileRef.current?.click()}>
                    <DocumentArrowUpIcon className="size-4" />
                    Dosyadan yükle
                  </Button>
                  <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFile} />
                  {fileName ? <span className="dark:text-dark-300 truncate text-xs text-gray-500">{fileName}</span> : null}
                  <button
                    type="button"
                    className="text-primary-600 dark:text-primary-400 ml-auto text-xs hover:underline"
                    onClick={() => {
                      setFileName(undefined);
                      setText(EXAMPLE);
                    }}
                  >
                    Örnek biçimi göster
                  </button>
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
                  Uygulayınca mevcut pivot ayarları sıfırlanır.
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
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
