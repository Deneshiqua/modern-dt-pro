import { Fragment, useEffect, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import {
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
  PaintBrushIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

import { Button } from "../ui";
import type {
  DataTablePivotAggregate,
  DataTablePivotCondition,
  DataTablePivotConditionFormat,
  DataTablePivotConditionOperator,
  DataTablePivotValue,
} from "../types";
import {
  PIVOT_CONDITION_OPERATORS,
  createPivotConditionId,
  pivotOperatorArity,
  resolvePivotCellStyle,
} from "./pivotConditions";
import {
  MAXIMIZED_DIALOG_CLASS,
  MaximizeButton,
  RESIZABLE_DIALOG_LIMITS_CLASS,
  useResizableDialog,
} from "./resizableDialog";

/** Excel'deki hazir "Hucre stili" secenekleri. */
const FORMAT_PRESETS: { label: string; format: DataTablePivotConditionFormat }[] = [
  { label: "Açık kırmızı", format: { backgroundColor: "#fee2e2", color: "#991b1b" } },
  { label: "Açık sarı", format: { backgroundColor: "#fef9c3", color: "#854d0e" } },
  { label: "Açık yeşil", format: { backgroundColor: "#dcfce7", color: "#166534" } },
  { label: "Açık mavi", format: { backgroundColor: "#dbeafe", color: "#1e40af" } },
  { label: "Koyu kırmızı", format: { backgroundColor: "#dc2626", color: "#ffffff" } },
  { label: "Koyu yeşil", format: { backgroundColor: "#16a34a", color: "#ffffff" } },
  { label: "Kırmızı yazı", format: { color: "#dc2626", fontWeight: "bold" } },
  { label: "Yeşil yazı", format: { color: "#16a34a", fontWeight: "bold" } },
];

export const BACKGROUND_PRESETS = [
  "#fee2e2", "#fecaca", "#ef4444", "#ffedd5", "#fed7aa", "#f97316",
  "#fef9c3", "#fde68a", "#eab308", "#dcfce7", "#bbf7d0", "#22c55e",
  "#dbeafe", "#bfdbfe", "#3b82f6", "#ede9fe", "#ddd6fe", "#8b5cf6",
];
export const TEXT_PRESETS = [
  "#111827", "#374151", "#6b7280", "#ffffff", "#991b1b", "#dc2626",
  "#c2410c", "#854d0e", "#166534", "#16a34a", "#1e40af", "#6d28d9",
];

const OPERATOR_SYMBOLS: Partial<Record<DataTablePivotConditionOperator, string>> = {
  lt: "<",
  lte: "≤",
  gt: ">",
  gte: "≥",
  eq: "=",
  neq: "≠",
};

const APPLY_OPTIONS: { id: NonNullable<DataTablePivotCondition["applyTo"]>; label: string; hint: string }[] = [
  { id: "all", label: "Tüm hücreler", hint: "Veri hücreleri ile ara ve genel toplamlar" },
  { id: "cells", label: "Veri hücreleri", hint: "Toplam satır ve sütunları hariç" },
  { id: "totals", label: "Toplamlar", hint: "Yalnızca ara toplam ve genel toplam hücreleri" },
];

const FIELD_CLASS =
  "dark:bg-dark-800 dark:border-dark-450 dark:text-dark-100 h-9 w-full rounded-md border border-gray-300 bg-white px-2.5 text-sm text-gray-800 outline-hidden focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20";

const formatNumber = (value: number) => value.toLocaleString("tr-TR", { maximumFractionDigits: 2 });

const measureKey = (measure?: { field: string; aggregate: DataTablePivotAggregate }) =>
  measure ? `${measure.field}\u0001${measure.aggregate}` : "";

const sameFormat = (a: DataTablePivotConditionFormat, b: DataTablePivotConditionFormat) =>
  (a.backgroundColor ?? "") === (b.backgroundColor ?? "")
  && (a.color ?? "") === (b.color ?? "")
  && (a.fontWeight ?? "normal") === (b.fontWeight ?? "normal")
  && (a.fontStyle ?? "normal") === (b.fontStyle ?? "normal");

/** Bicim onizlemesi icin kurali kosulsuz hale getirir. */
export const formatStyle = (format: DataTablePivotConditionFormat) =>
  resolvePivotCellStyle([{ id: "preview", operator: "notEmpty", format }], undefined, 1, false);

const isIncomplete = (condition: DataTablePivotCondition) => {
  const arity = pivotOperatorArity(condition.operator);
  return (arity >= 1 && condition.value === undefined) || (arity === 2 && condition.value2 === undefined);
};

/** "Toplam (Toplam) > 30.000" gibi okunur ozet. */
export function describeCondition(condition: DataTablePivotCondition, measureLabel: string): string {
  const { operator, value, value2 } = condition;
  const a = value === undefined ? "…" : formatNumber(value);
  const b = value2 === undefined ? "…" : formatNumber(value2);
  const symbol = OPERATOR_SYMBOLS[operator];
  if (symbol) return `${measureLabel} ${symbol} ${a}`;
  switch (operator) {
    case "between":
      return `${measureLabel}: ${a} ile ${b} arasında`;
    case "notBetween":
      return `${measureLabel}: ${a} ile ${b} dışında`;
    case "empty":
      return `${measureLabel} boş`;
    default:
      return `${measureLabel} boş değil`;
  }
}

type PivotConditionsButtonProps = {
  conditions: DataTablePivotCondition[];
  values: DataTablePivotValue[];
  valueLabel: (value: DataTablePivotValue) => string;
  onChange: (conditions: DataTablePivotCondition[]) => void;
};

export function PivotConditionsButton(props: PivotConditionsButtonProps) {
  const [open, setOpen] = useState(false);
  const activeCount = props.conditions.filter((condition) => condition.enabled !== false).length;
  return (
    <>
      <Button
        variant="flat"
        isIcon
        className="relative size-8 rounded-full"
        title="Koşullu biçimlendirme"
        aria-label="Koşullu biçimlendirme"
        onClick={() => setOpen(true)}
      >
        <PaintBrushIcon className="size-4.5" />
        {activeCount > 0 ? (
          <span className="bg-primary-600 absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full px-1 text-[10px] leading-4 font-semibold text-white">
            {activeCount}
          </span>
        ) : null}
      </Button>
      <PivotConditionsDialog {...props} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function PivotConditionsDialog({
  open,
  onClose,
  conditions,
  values,
  valueLabel,
  onChange,
}: PivotConditionsButtonProps & { open: boolean; onClose: () => void }) {
  const [selectedId, setSelectedId] = useState<string | undefined>(conditions[0]?.id);
  const resizable = useResizableDialog(open);
  const selected = conditions.find((condition) => condition.id === selectedId) ?? conditions[0];

  useEffect(() => {
    if (open && !conditions.some((condition) => condition.id === selectedId)) setSelectedId(conditions[0]?.id);
  }, [open, conditions, selectedId]);

  const measureOptions = values.filter(
    (value, index) => values.findIndex((other) => measureKey(other) === measureKey(value)) === index,
  );
  const measureLabel = (condition: DataTablePivotCondition) => {
    if (!condition.measure) return "Değer";
    const match = measureOptions.find((value) => measureKey(value) === measureKey(condition.measure));
    return match ? valueLabel(match) : `${condition.measure.field} (tabloda yok)`;
  };

  const update = (id: string, patch: Partial<DataTablePivotCondition>) =>
    onChange(conditions.map((condition) => (condition.id === id ? { ...condition, ...patch } : condition)));

  const addCondition = () => {
    const id = createPivotConditionId();
    onChange([
      ...conditions,
      {
        id,
        measure: measureOptions.length === 1
          ? { field: measureOptions[0].field, aggregate: measureOptions[0].aggregate }
          : undefined,
        operator: "gt",
        applyTo: "cells",
        format: FORMAT_PRESETS[2].format,
      },
    ]);
    setSelectedId(id);
  };

  const removeCondition = (id: string) => {
    const index = conditions.findIndex((condition) => condition.id === id);
    const rest = conditions.filter((condition) => condition.id !== id);
    onChange(rest);
    setSelectedId(rest[Math.min(index, rest.length - 1)]?.id);
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
                  // Yukseklik icerige gore; tum adimlar kaydirmadan gorunur, ekrani asarsa icerik kayar
                  : clsx("h-auto w-[min(60rem,calc(100vw-2rem))]", RESIZABLE_DIALOG_LIMITS_CLASS),
              )}
            >
              <div className="dark:border-dark-500 flex items-center gap-3 border-b border-gray-200 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <DialogTitle className="dark:text-dark-50 text-lg font-semibold text-gray-900">
                    Koşullu Biçimlendirme
                  </DialogTitle>
                  <p className="dark:text-dark-300 text-xs text-gray-500">
                    Belirlediğiniz koşulu sağlayan hücreleri renklendirin.
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

              <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[20rem_minmax(0,1fr)]">
                {/* Kural listesi */}
                <aside className="dark:border-dark-500 dark:bg-dark-800/40 flex min-h-0 flex-col border-b border-gray-200 bg-gray-50 md:border-r md:border-b-0">
                  <div className="flex items-center justify-between px-4 pt-3 pb-2">
                    <span className="dark:text-dark-300 text-xs font-semibold text-gray-500">
                      Kurallar ({conditions.length})
                    </span>
                  </div>
                  <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 max-md:max-h-40">
                    {conditions.map((condition, index) => {
                      const active = condition.id === selected?.id;
                      const enabled = condition.enabled !== false;
                      return (
                        <li
                          key={condition.id}
                          className={clsx(
                            "flex items-stretch rounded-md border transition-colors",
                            active
                              ? "border-primary-500 dark:bg-dark-700 bg-white shadow-sm"
                              : "dark:hover:bg-dark-700 border-transparent hover:bg-white",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedId(condition.id)}
                            aria-current={active}
                            className={clsx(
                              "flex min-w-0 flex-1 items-center gap-3 py-2 pl-2.5 text-left",
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
                                Kural {index + 1}
                              </span>
                              <span className="dark:text-dark-100 line-clamp-2 text-sm break-words text-gray-800">
                                {describeCondition(condition, measureLabel(condition))}
                              </span>
                            </span>
                            {isIncomplete(condition) ? (
                              <ExclamationTriangleIcon className="size-4 shrink-0 text-amber-500" title="Değer girilmedi" />
                            ) : null}
                          </button>
                          <div className="flex shrink-0 items-center gap-0.5 py-2 pr-2 pl-1">
                            <button
                              type="button"
                              onClick={() => update(condition.id, { enabled: !enabled })}
                              aria-pressed={enabled}
                              aria-label={`Kural ${index + 1} ${enabled ? "etkin, kapatmak için tıklayın" : "kapalı, açmak için tıklayın"}`}
                              title={enabled ? "Etkin — kapatmak için tıklayın" : "Kapalı — açmak için tıklayın"}
                              className={clsx(
                                "grid size-7 place-items-center rounded",
                                enabled
                                  ? "text-primary-600 dark:text-primary-400 hover:bg-primary-500/10"
                                  : "dark:hover:bg-dark-600 text-gray-400 hover:bg-gray-100",
                              )}
                            >
                              {enabled ? <EyeIcon className="size-4.5" /> : <EyeSlashIcon className="size-4.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeCondition(condition.id)}
                              aria-label={`Kural ${index + 1} sil`}
                              title="Sil"
                              className="grid size-7 place-items-center rounded text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                            >
                              <TrashIcon className="size-4.5" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="p-3">
                    <Button variant="outlined" className="h-9 w-full gap-1.5 text-sm" onClick={addCondition}>
                      <PlusIcon className="size-4" />
                      Yeni kural
                    </Button>
                  </div>
                </aside>

                {/* Duzenleyici */}
                <section className="min-h-0 overflow-y-auto">
                  {selected ? (
                    <ConditionEditor
                      key={selected.id}
                      condition={selected}
                      measureOptions={measureOptions}
                      valueLabel={valueLabel}
                      onChange={(patch) => update(selected.id, patch)}
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                      <PaintBrushIcon className="size-10 text-gray-300" />
                      <div>
                        <p className="dark:text-dark-100 font-medium text-gray-800">Henüz kural yok</p>
                        <p className="dark:text-dark-300 mt-1 text-sm text-gray-500">
                          Örneğin 30.000'den büyük toplamları yeşile boyayan bir kural ekleyin.
                        </p>
                      </div>
                      <Button color="primary" className="h-9 gap-1.5 px-4 text-sm" onClick={addCondition}>
                        <PlusIcon className="size-4" />
                        İlk kuralı ekle
                      </Button>
                    </div>
                  )}
                </section>
              </div>

              <div className="dark:border-dark-500 flex flex-wrap items-center gap-2 border-t border-gray-200 px-5 py-3">
                <p className="dark:text-dark-300 mr-auto text-xs text-gray-500">
                  Kurallar listedeki sırayla uygulanır; aynı hücreye uyan alttaki kural üsttekini ezer.
                </p>
                <Button
                  variant="flat"
                  className="h-9 px-3 text-sm"
                  disabled={conditions.length === 0}
                  onClick={() => onChange([])}
                >
                  Tümünü temizle
                </Button>
                <Button color="primary" className="h-9 px-5 text-sm" onClick={onClose}>
                  Tamam
                </Button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}

function ConditionEditor({
  condition,
  measureOptions,
  valueLabel,
  onChange,
}: {
  condition: DataTablePivotCondition;
  measureOptions: DataTablePivotValue[];
  valueLabel: (value: DataTablePivotValue) => string;
  onChange: (patch: Partial<DataTablePivotCondition>) => void;
}) {
  const arity = pivotOperatorArity(condition.operator);
  const applyTo = condition.applyTo ?? "all";
  const missingMeasure =
    condition.measure && !measureOptions.some((value) => measureKey(value) === measureKey(condition.measure));
  const setFormat = (patch: Partial<DataTablePivotConditionFormat>) =>
    onChange({ format: { ...condition.format, ...patch } });

  return (
    <div className="flex flex-col gap-6 p-5">
      <EditorSection step={1} title="Koşul" description="Hangi hücrelerin biçimlendirileceğini belirler.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Hangi değer?">
            <select
              className={FIELD_CLASS}
              value={measureKey(condition.measure)}
              onChange={(event) => {
                const option = measureOptions.find((value) => measureKey(value) === event.target.value);
                onChange({ measure: option ? { field: option.field, aggregate: option.aggregate } : undefined });
              }}
            >
              <option value="">Tüm veri alanları</option>
              {measureOptions.map((value) => (
                <option key={measureKey(value)} value={measureKey(value)}>{valueLabel(value)}</option>
              ))}
              {missingMeasure && condition.measure ? (
                <option value={measureKey(condition.measure)}>{condition.measure.field} (tabloda yok)</option>
              ) : null}
            </select>
          </Field>
          <Field label="Koşul">
            <select
              className={FIELD_CLASS}
              value={condition.operator}
              onChange={(event) => onChange({ operator: event.target.value as DataTablePivotConditionOperator })}
            >
              {PIVOT_CONDITION_OPERATORS.map((operator) => (
                <option key={operator.id} value={operator.id}>{operator.label}</option>
              ))}
            </select>
          </Field>
          {arity >= 1 ? (
            <Field
              label={arity === 2 ? "Alt sınır" : "Değer"}
              error={condition.value === undefined ? "Bir sayı girin" : undefined}
            >
              <NumberInput value={condition.value} onChange={(value) => onChange({ value })} />
            </Field>
          ) : null}
          {arity === 2 ? (
            <Field label="Üst sınır" error={condition.value2 === undefined ? "Bir sayı girin" : undefined}>
              <NumberInput value={condition.value2} onChange={(value2) => onChange({ value2 })} />
            </Field>
          ) : null}
        </div>
      </EditorSection>

      <EditorSection step={2} title="Nerede uygulansın?">
        <div role="radiogroup" className="dark:border-dark-450 inline-flex rounded-md border border-gray-300 p-0.5">
          {APPLY_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={applyTo === option.id}
              onClick={() => onChange({ applyTo: option.id })}
              className={clsx(
                "rounded px-3 py-1.5 text-sm transition-colors",
                applyTo === option.id
                  ? "bg-primary-600 font-medium text-white"
                  : "dark:text-dark-100 dark:hover:bg-dark-600 text-gray-700 hover:bg-gray-100",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="dark:text-dark-300 mt-1.5 text-xs text-gray-500">
          {APPLY_OPTIONS.find((option) => option.id === applyTo)?.hint}
        </p>
      </EditorSection>

      <EditorSection step={3} title="Biçim" description="Hazır bir stil seçin ya da renkleri kendiniz belirleyin.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {FORMAT_PRESETS.map((preset) => {
            const active = sameFormat(condition.format, preset.format);
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => onChange({ format: preset.format })}
                aria-pressed={active}
                aria-label={preset.label}
                title={preset.label}
                className={clsx(
                  "relative rounded-md border p-1 transition-colors",
                  active
                    ? "border-primary-500 ring-primary-500/20 ring-2"
                    : "dark:border-dark-450 dark:hover:border-dark-300 border-gray-200 hover:border-gray-400",
                )}
              >
                <span
                  className="dark:border-dark-450 flex h-8 w-full items-center justify-end rounded border border-gray-200 px-2 text-sm tabular-nums"
                  style={formatStyle(preset.format)}
                >
                  1.234
                </span>
              </button>
            );
          })}
        </div>

        <div className="dark:border-dark-500 mt-4 flex flex-wrap items-end gap-3 border-t border-gray-200 pt-4">
          <Field label="Dolgu rengi">
            <ColorPicker
              value={condition.format.backgroundColor}
              presets={BACKGROUND_PRESETS}
              onChange={(backgroundColor) => setFormat({ backgroundColor })}
            />
          </Field>
          <Field label="Yazı rengi">
            <ColorPicker
              value={condition.format.color}
              presets={TEXT_PRESETS}
              emptyLabel="Otomatik"
              onChange={(color) => setFormat({ color })}
            />
          </Field>
          <Field label="Yazı stili">
            <div className="flex gap-1">
              <ToggleButton
                label="Kalın"
                active={condition.format.fontWeight === "bold"}
                onClick={() => setFormat({ fontWeight: condition.format.fontWeight === "bold" ? undefined : "bold" })}
              >
                <span className="font-bold">K</span>
              </ToggleButton>
              <ToggleButton
                label="İtalik"
                active={condition.format.fontStyle === "italic"}
                onClick={() => setFormat({ fontStyle: condition.format.fontStyle === "italic" ? undefined : "italic" })}
              >
                <span className="font-serif italic">T</span>
              </ToggleButton>
            </div>
          </Field>
          <div className="ml-auto flex flex-col gap-1">
            <span className="dark:text-dark-300 text-xs font-medium text-gray-600">Önizleme</span>
            <div
              className="dark:border-dark-450 dark:bg-dark-800 flex h-9 w-36 items-center justify-end rounded-md border border-gray-300 bg-white px-3 text-sm tabular-nums"
              style={formatStyle(condition.format)}
            >
              {formatNumber(condition.value ?? 1234.5)}
            </div>
          </div>
        </div>
      </EditorSection>
    </div>
  );
}

function EditorSection({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={clsx(
        "flex gap-3",
        // Adimlar arasinda ayirici cizgi
        step > 1 && "dark:border-dark-500 border-t border-gray-200 pt-6",
      )}
    >
      <span className="bg-primary-600/10 text-primary-600 dark:text-primary-400 grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold">
        {step}
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex min-w-0 items-baseline gap-2">
          <h3 className="dark:text-dark-50 shrink-0 text-sm font-semibold text-gray-900">{title}</h3>
          {description ? (
            <p className="dark:text-dark-300 min-w-0 truncate text-xs text-gray-500" title={description}>
              {description}
            </p>
          ) : null}
        </div>
        {children}
      </div>
    </section>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="dark:text-dark-300 text-xs font-medium text-gray-600">{label}</span>
      {children}
      {error ? (
        <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
          <ExclamationTriangleIcon className="size-3.5" />
          {error}
        </span>
      ) : null}
    </label>
  );
}

/** Turkce ondalik (virgul) ve binlik (nokta) kabul eden sayi girisi; bos birakilirsa undefined. */
function NumberInput({ value, onChange }: { value?: number; onChange: (value: number | undefined) => void }) {
  const [text, setText] = useState(value === undefined ? "" : formatNumber(value));
  return (
    <input
      type="text"
      inputMode="decimal"
      className={clsx(FIELD_CLASS, "text-right tabular-nums")}
      value={text}
      placeholder="Örn. 30.000"
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        const normalized = next.trim().replace(/\./g, "").replace(",", ".");
        const parsed = normalized === "" || normalized === "-" ? undefined : Number(normalized);
        onChange(parsed === undefined || Number.isNaN(parsed) ? undefined : parsed);
      }}
    />
  );
}

function ToggleButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={clsx(
        "grid size-9 place-items-center rounded-md border text-sm",
        active
          ? "border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400"
          : "dark:border-dark-450 dark:bg-dark-800 dark:text-dark-100 border-gray-300 bg-white text-gray-700",
      )}
    >
      {children}
    </button>
  );
}

export function ColorPicker({
  value,
  presets,
  emptyLabel = "Yok",
  onChange,
}: {
  value?: string;
  presets: string[];
  emptyLabel?: string;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <Popover className="relative">
      <PopoverButton className={clsx(FIELD_CLASS, "flex w-36 items-center gap-2")}>
        <span
          className="dark:border-dark-450 size-4 shrink-0 rounded-sm border border-gray-300"
          style={value ? { backgroundColor: value } : { backgroundImage: "linear-gradient(135deg, transparent 45%, #ef4444 45%, #ef4444 55%, transparent 55%)" }}
        />
        <span className="truncate">{value ?? emptyLabel}</span>
      </PopoverButton>
      <PopoverPanel
        anchor={{ to: "bottom start", gap: 6 }}
        className="dark:bg-dark-750 dark:border-dark-500 z-[210] w-52 rounded-md border border-gray-300 bg-white p-2 shadow-lg outline-hidden"
      >
        {({ close }) => (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-6 gap-1.5">
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  title={preset}
                  aria-label={preset}
                  onClick={() => {
                    onChange(preset);
                    close();
                  }}
                  className={clsx(
                    "size-7 rounded-sm border border-black/10",
                    value?.toLowerCase() === preset && "ring-primary-500 ring-2 ring-offset-1",
                  )}
                  style={{ backgroundColor: preset }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <label className="dark:text-dark-100 flex flex-1 items-center gap-2 text-xs text-gray-600">
                <input
                  type="color"
                  value={value ?? "#ffffff"}
                  onChange={(event) => onChange(event.target.value)}
                  className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                Özel renk
              </label>
              <button
                type="button"
                onClick={() => {
                  onChange(undefined);
                  close();
                }}
                className="dark:hover:bg-dark-600 dark:text-dark-100 rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
              >
                {emptyLabel}
              </button>
            </div>
          </div>
        )}
      </PopoverPanel>
    </Popover>
  );
}
