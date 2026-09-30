import { Fragment, useDeferredValue, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from "@headlessui/react";
import {
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ClipboardDocumentIcon,
  Cog6ToothIcon,
  DocumentArrowUpIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

import { Button } from "../ui";
import type { DataTablePivotConfig, DataTablePivotValue } from "../types";
import { buildExportFilename } from "../utils/exportTable";
import { describeCondition, formatStyle } from "./PivotConditionsDialog";
import { describePivotNumberFormat, hasPivotNumberFormat } from "./pivotNumberFormat";
import { PIVOT_CELL_KINDS, hasPivotCellStyles, pivotColorStyle } from "./pivotCellStyles";
import { PIVOT_AGGREGATE_LABELS } from "./PivotFieldChooser";
import type { PivotField } from "./pivotEngine";
import { JsonEditor } from "./JsonEditor";
import {
  buildPivotConfigSchema,
  parsePivotConfigJson,
  toShareablePivotConfig,
  validatePivotConfig,
  type PivotShareableConfig,
} from "./pivotValidation";
import {
  MAXIMIZED_DIALOG_CLASS,
  MaximizeButton,
  RESIZABLE_DIALOG_LIMITS_CLASS,
  useResizableDialog,
} from "./resizableDialog";

type Config = DataTablePivotConfig<any>;
type Tab = "summary" | "json";

const TOTAL_LABELS: { key: "showRowTotals" | "showColumnTotals" | "showRowGrandTotals" | "showColumnGrandTotals"; label: string }[] = [
  { key: "showRowTotals", label: "Satır ara toplamları" },
  { key: "showColumnTotals", label: "Sütun ara toplamları" },
  { key: "showRowGrandTotals", label: "Genel toplam satırı" },
  { key: "showColumnGrandTotals", label: "Genel toplam sütunu" },
];

const APPLY_LABELS = { all: "Tüm hücreler", cells: "Veri hücreleri", totals: "Toplamlar" } as const;

const toJson = (config: Config) => JSON.stringify(toShareablePivotConfig(config), null, 2);

type PivotConfigButtonProps = {
  config: Config;
  fields: PivotField[];
  onApply: (config: PivotShareableConfig) => void;
  onNotify: (type: "success" | "error", message: string) => void;
};

export function PivotConfigButton(props: PivotConfigButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="flat"
        className="h-8 gap-1.5 rounded-full px-3 text-sm"
        title="Yapılandırma"
        onClick={() => setOpen(true)}
      >
        <Cog6ToothIcon className="size-5" />
        <span>Yapılandırma</span>
      </Button>
      <PivotConfigDialog {...props} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function PivotConfigDialog({
  open,
  onClose,
  config,
  fields,
  onApply,
  onNotify,
}: PivotConfigButtonProps & { open: boolean; onClose: () => void }) {
  const resizable = useResizableDialog(open);
  const [tab, setTab] = useState<Tab>("summary");
  const currentJson = useMemo(() => toJson(config), [config]);
  const [text, setText] = useState(currentJson);
  const fileRef = useRef<HTMLInputElement>(null);

  // Her acilista guncel ayarlarla basla
  useEffect(() => {
    if (open) {
      setText(toJson(config));
      setTab("summary");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const deferredText = useDeferredValue(text);
  const parsed = useMemo(() => parsePivotConfigJson(deferredText), [deferredText]);
  const fieldIssues = useMemo(
    () => (parsed.ok ? validatePivotConfig({ ...parsed.config }, fields).filter((issue) => issue.level === "error") : []),
    [parsed, fields],
  );
  const changed = text.trim() !== currentJson.trim();
  const schema = useMemo(() => buildPivotConfigSchema(fields.map((field) => field.id)), [fields]);

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
    link.download = buildExportFilename("pivot-yapilandirma", "json");
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
                  : clsx("h-[min(40rem,calc(100dvh-2rem))] w-[min(52rem,calc(100vw-2rem))]", RESIZABLE_DIALOG_LIMITS_CLASS),
              )}
            >
              <div className="dark:border-dark-500 flex items-center gap-3 border-b border-gray-200 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <DialogTitle className="dark:text-dark-50 text-lg font-semibold text-gray-900">Yapılandırma</DialogTitle>
                  <p className="dark:text-dark-300 text-xs text-gray-500">
                    Alan seçici ve koşullu biçimlendirme ayarları.
                  </p>
                </div>
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

              {tab === "summary" ? (
                <ConfigSummary config={config} fields={fields} />
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
                    ) : fieldIssues.length > 0 ? (
                      <ul className="flex flex-col gap-1 rounded-md bg-amber-50 px-3 py-2 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                        {fieldIssues.map((issue) => (
                          <li key={issue.message} className="flex items-start gap-2">
                            <ExclamationTriangleIcon className="mt-0.5 size-4 shrink-0" />
                            {issue.message}
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
                      onApply(parsed.config);
                      onNotify("success", "Yapılandırma uygulandı");
                      onClose();
                    }}
                  >
                    Uygula
                  </Button>
                ) : null}
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}

function ConfigSummary({ config, fields }: { config: Config; fields: PivotField[] }) {
  const labelOf = (id: string) => fields.find((field) => field.id === id)?.label ?? id;
  const valueLabel = (value: DataTablePivotValue) =>
    value.label ?? `${labelOf(value.field)} (${PIVOT_AGGREGATE_LABELS[value.aggregate]})`;
  const missing = (id: string) => !fields.some((field) => field.id === id);
  const conditions = config.conditions ?? [];
  const filterEntries = Object.entries(config.filterValues ?? {}).filter(([, values]) => Array.isArray(values));

  const chips = (ids: string[]) =>
    ids.length === 0 ? (
      <span className="dark:text-dark-300 text-sm text-gray-400">—</span>
    ) : (
      <div className="flex flex-wrap gap-1.5">
        {ids.map((id) => (
          <span
            key={id}
            title={missing(id) ? "Veride bu alan yok" : undefined}
            className={clsx(
              "border px-2 py-0.5 text-sm",
              missing(id)
                ? "border-red-300 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
                : "dark:bg-dark-600 dark:border-dark-500 border-gray-200 bg-gray-100",
            )}
          >
            {labelOf(id)}
          </span>
        ))}
      </div>
    );

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-2">
      <section className="dark:border-dark-500 flex flex-col gap-4 border-b border-gray-200 p-5 md:border-r md:border-b-0">
        <h3 className="dark:text-dark-50 text-sm font-semibold text-gray-900">Alan Seçici</h3>
        <SummaryRow label="Satır alanları">{chips(config.rows.map(String))}</SummaryRow>
        <SummaryRow label="Sütun alanları">{chips(config.columns.map(String))}</SummaryRow>
        <SummaryRow label="Filtre alanları">{chips((config.filters ?? []).map(String))}</SummaryRow>
        <SummaryRow label="Veri alanları">
          {config.values.length === 0 ? (
            <span className="dark:text-dark-300 text-sm text-gray-400">—</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {config.values.map((value, index) => (
                <span key={`${value.field}-${index}`} className="dark:bg-dark-600 dark:border-dark-500 border border-gray-200 bg-gray-100 px-2 py-0.5 text-sm">
                  {valueLabel(value)}
                </span>
              ))}
            </div>
          )}
        </SummaryRow>
        <SummaryRow label="Seçili filtre değerleri">
          {filterEntries.length === 0 ? (
            <span className="dark:text-dark-300 text-sm text-gray-400">Filtre yok</span>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {filterEntries.map(([field, values]) => (
                <li key={field} className="min-w-0">
                  <span className="font-medium">{labelOf(field)}:</span>{" "}
                  <span className="dark:text-dark-200 text-gray-600">
                    {values!.length === 0 ? "hiçbiri" : values!.map((value) => (value === null ? "(Boş)" : String(value))).join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SummaryRow>
        <SummaryRow label="Sayı biçimi">
          <ul className="flex flex-col gap-1 text-sm">
            <li>
              <span className="font-medium">Tüm değerler:</span>{" "}
              <span className="dark:text-dark-200 text-gray-600">{describePivotNumberFormat(config.numberFormat)}</span>
            </li>
            {config.values
              .filter((value) => hasPivotNumberFormat(value.numberFormat))
              .map((value, index) => (
                <li key={`${value.field}-${index}`}>
                  <span className="font-medium">{valueLabel(value)}:</span>{" "}
                  <span className="dark:text-dark-200 text-gray-600">{describePivotNumberFormat(value.numberFormat)}</span>
                </li>
              ))}
          </ul>
        </SummaryRow>
        <SummaryRow label="Hücre renkleri">
          {!hasPivotCellStyles(config.cellStyles) && !config.values.some((value) => hasPivotCellStyles(value.cellStyles)) ? (
            <span className="dark:text-dark-300 text-sm text-gray-400">Varsayılan</span>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {[
                { name: "Tüm değerler", styles: config.cellStyles },
                ...config.values.map((value) => ({ name: valueLabel(value), styles: value.cellStyles })),
              ]
                .filter((entry) => hasPivotCellStyles(entry.styles))
                .map((entry) => (
                  <li key={entry.name} className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{entry.name}:</span>
                    {[
                      ...PIVOT_CELL_KINDS.map((kind) => ({ id: kind.id, label: kind.label, style: entry.styles?.[kind.id] })),
                      {
                        id: "alternateCells",
                        label: "Veri hücreleri 2. renk",
                        style: entry.styles?.alternateCells && { ...entry.styles.cells, ...entry.styles.alternateCells },
                      },
                    ]
                      .filter((item) => item.style)
                      .map((item) => (
                        <span
                          key={item.id}
                          className="dark:border-dark-450 rounded border border-gray-300 px-1.5 text-xs"
                          style={pivotColorStyle(item.style)}
                        >
                          {item.label}
                        </span>
                      ))}
                  </li>
                ))}
            </ul>
          )}
        </SummaryRow>
        <SummaryRow label="Toplamlar">
          <ul className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
            {TOTAL_LABELS.map(({ key, label }) => {
              const on = config[key] ?? true;
              return (
                <li key={key} className={clsx("flex items-center gap-1.5", !on && "opacity-50")}>
                  <span className={clsx("size-2 rounded-full", on ? "bg-green-500" : "bg-gray-400")} />
                  {label}: {on ? "Açık" : "Kapalı"}
                </li>
              );
            })}
          </ul>
        </SummaryRow>
      </section>

      <section className="flex flex-col gap-3 p-5">
        <h3 className="dark:text-dark-50 text-sm font-semibold text-gray-900">
          Koşullu Biçimlendirme <span className="dark:text-dark-300 font-normal text-gray-500">({conditions.length})</span>
        </h3>
        {conditions.length === 0 ? (
          <p className="dark:text-dark-300 text-sm text-gray-500">Kural tanımlanmadı.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {conditions.map((condition, index) => {
              const measure = condition.measure
                ? valueLabel({ field: condition.measure.field, aggregate: condition.measure.aggregate })
                : "Değer";
              const enabled = condition.enabled !== false;
              return (
                <li
                  key={condition.id}
                  className={clsx(
                    "dark:border-dark-500 flex items-center gap-3 rounded-md border border-gray-200 px-3 py-2",
                    !enabled && "opacity-50",
                  )}
                >
                  <span
                    className="dark:border-dark-450 grid h-7 w-12 shrink-0 place-items-center rounded border border-gray-300 text-xs tabular-nums"
                    style={formatStyle(condition.format)}
                  >
                    123
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="dark:text-dark-300 block text-[11px] text-gray-500">
                      Kural {index + 1} · {APPLY_LABELS[condition.applyTo ?? "all"]}{enabled ? "" : " · kapalı"}
                    </span>
                    <span className="dark:text-dark-100 block text-sm break-words text-gray-800">
                      {describeCondition(condition, measure)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="dark:text-dark-300 text-xs font-medium text-gray-500">{label}</span>
      {children}
    </div>
  );
}
