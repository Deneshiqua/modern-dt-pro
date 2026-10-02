import { useEffect, useState, type ReactNode } from "react";
import clsx from "clsx";

import { Button } from "../ui";
import type { DataTablePivotNumberFormat, DataTablePivotValue } from "../types";
import {
  PIVOT_DECIMAL_PLACES_MAX,
  formatPivotNumber,
  hasPivotNumberFormat,
  pivotNumberAlignStyle,
} from "./pivotNumberFormat";

type Format = DataTablePivotNumberFormat;
type Draft = { defaults: Format; perValue: Format[] };
/** "" = tum degerler (varsayilan bicim), "0", "1"... = veri alani sirasi */
type Target = string;

const INHERIT = "__inherit__";
const SAMPLES: (number | null)[] = [1234567.891, -1234.5, 0.256, null];

const FIELD_CLASS =
  "dark:bg-dark-800 dark:border-dark-450 dark:text-dark-100 h-9 w-full rounded-md border border-gray-300 bg-white px-2.5 text-sm text-gray-800 outline-hidden focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50";

const THOUSANDS_OPTIONS: { value: NonNullable<Format["thousandsSeparator"]>; label: string }[] = [
  { value: ".", label: "Nokta (1.234)" },
  { value: ",", label: "Virgül (1,234)" },
  { value: " ", label: "Boşluk (1 234)" },
  { value: "'", label: "Kesme (1'234)" },
  { value: "", label: "Yok (1234)" },
];
const DECIMAL_OPTIONS: { value: NonNullable<Format["decimalSeparator"]>; label: string }[] = [
  { value: ",", label: "Virgül (0,5)" },
  { value: ".", label: "Nokta (0.5)" },
];
const CURRENCY_PRESETS = ["₺", "$", "€", "£"];

type PivotNumberFormatButtonProps = {
  numberFormat?: Format;
  values: DataTablePivotValue[];
  valueLabel: (value: DataTablePivotValue) => string;
  onApply: (numberFormat: Format | undefined, perValue: (Format | undefined)[]) => void;
};


/** Tanimsiz alanlari atar; hic ayar kalmadiysa undefined (binlik ayirici "" = "yok" gecerli bir ayardir). */
const clean = (format: Format | undefined): Format | undefined => {
  const entries = Object.entries(format ?? {}).filter(([, value]) => value !== undefined);
  return entries.length > 0 ? (Object.fromEntries(entries) as Format) : undefined;
};

export function PivotNumberFormatPanel({
  open,
  onClose,
  numberFormat,
  values,
  valueLabel,
  onApply,
}: PivotNumberFormatButtonProps & { open: boolean; onClose: () => void }) {
  const [draft, setDraft] = useState<Draft>({ defaults: {}, perValue: [] });
  const [target, setTarget] = useState<Target>("");

  // Her acilista guncel ayarlardan taslak olustur; Uygula'ya kadar tabloya dokunulmaz
  useEffect(() => {
    if (!open) return;
    setDraft({
      defaults: { ...numberFormat },
      perValue: values.map((value) => ({ ...value.numberFormat })),
    });
    setTarget("");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const isValue = target !== "";
  const index = isValue ? Number(target) : -1;
  const own: Format = isValue ? draft.perValue[index] ?? {} : draft.defaults;
  const effective: Format = isValue ? { ...draft.defaults, ...own } : draft.defaults;

  const setField = <K extends keyof Format>(key: K, next: Format[K] | undefined) => {
    setDraft((current) => {
      if (!isValue) {
        const defaults = { ...current.defaults, [key]: next };
        if (next === undefined) delete defaults[key];
        return { ...current, defaults };
      }
      const perValue = [...current.perValue];
      const entry = { ...perValue[index], [key]: next };
      if (next === undefined) delete entry[key];
      perValue[index] = entry;
      return { ...current, perValue };
    });
  };

  const resetTarget = () =>
    setDraft((current) =>
      isValue
        ? { ...current, perValue: current.perValue.map((item, i) => (i === index ? {} : item)) }
        : { ...current, defaults: {} });

  /** Secim kutusu degeri: alanda tanimli degilse "varsayilani kullan". */
  const selectValue = (key: keyof Format, fallback: string) => {
    const value = own[key];
    if (value === undefined) return isValue ? INHERIT : fallback;
    return String(value);
  };
  const inheritOption = (key: keyof Format, describe: (value: unknown) => string) =>
    isValue ? (
      <option value={INHERIT}>Varsayılanı kullan ({describe(draft.defaults[key])})</option>
    ) : null;

  const describeThousands = (value: unknown) =>
    THOUSANDS_OPTIONS.find((option) => option.value === (value ?? "."))?.label ?? "";
  const describeDecimal = (value: unknown) =>
    DECIMAL_OPTIONS.find((option) => option.value === (value ?? ","))?.label ?? "";
  const describePlaces = (value: unknown) => (value === undefined ? "Otomatik" : String(value));

  return (
    <>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <Field label="Hangi değer?">
          <select className={FIELD_CLASS} value={target} onChange={(event) => setTarget(event.target.value)}>
            <option value="">Tüm değerler (varsayılan biçim)</option>
            {values.map((value, i) => (
              <option key={`${value.field}-${i}`} value={String(i)}>
                {valueLabel(value)}{hasPivotNumberFormat(draft.perValue[i]) ? " • özel biçim" : ""}
              </option>
            ))}
          </select>
        </Field>
        <p className="dark:text-dark-300 mt-1.5 text-xs text-gray-500">
          {isValue
            ? "Bu veri alanında değiştirmediğiniz ayarlar varsayılan biçimden gelir."
            : "Tüm veri alanlarına uygulanır; bir veri alanını seçerek ona özel biçim verebilirsiniz."}
        </p>

        <div className="dark:border-dark-500 mt-5 grid gap-x-4 gap-y-4 border-t border-gray-200 pt-5 sm:grid-cols-2">
          <Field label="Hizalama">
            <Segmented
              value={own.textAlign ?? (isValue ? INHERIT : "right")}
              options={[
                ...(isValue ? [{ value: INHERIT, label: "Varsayılan" }] : []),
                { value: "left", label: "Sol" },
                { value: "center", label: "Orta" },
                { value: "right", label: "Sağ" },
              ]}
              onChange={(value) => setField("textAlign", value === INHERIT ? undefined : value as Format["textAlign"])}
            />
          </Field>
          <Field label="Ondalık basamak">
            <select
              className={FIELD_CLASS}
              value={selectValue("decimalPlaces", "auto")}
              onChange={(event) => {
                const value = event.target.value;
                setField("decimalPlaces", value === INHERIT || value === "auto" ? undefined : Number(value));
              }}
            >
              {inheritOption("decimalPlaces", describePlaces)}
              {!isValue ? <option value="auto">Otomatik (en fazla 2)</option> : null}
              {Array.from({ length: PIVOT_DECIMAL_PLACES_MAX + 1 }, (_, places) => (
                <option key={places} value={String(places)}>{places}</option>
              ))}
            </select>
          </Field>
          <Field label="Binlik ayırıcı">
            <select
              className={FIELD_CLASS}
              value={selectValue("thousandsSeparator", ".")}
              onChange={(event) =>
                setField("thousandsSeparator", event.target.value === INHERIT ? undefined : event.target.value as Format["thousandsSeparator"])}
            >
              {inheritOption("thousandsSeparator", describeThousands)}
              {THOUSANDS_OPTIONS.map((option) => (
                <option key={option.label} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Ondalık ayırıcı">
            <select
              className={FIELD_CLASS}
              value={selectValue("decimalSeparator", ",")}
              onChange={(event) =>
                setField("decimalSeparator", event.target.value === INHERIT ? undefined : event.target.value as Format["decimalSeparator"])}
            >
              {inheritOption("decimalSeparator", describeDecimal)}
              {DECIMAL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Para birimi simgesi" wide>
            <div className="flex gap-1.5">
              <input
                className={clsx(FIELD_CLASS.replace("w-full", ""), "w-32 shrink-0")}
                value={own.currencySymbol ?? ""}
                placeholder={isValue && draft.defaults.currencySymbol ? `Varsayılan: ${draft.defaults.currencySymbol}` : "Yok"}
                maxLength={6}
                onChange={(event) => setField("currencySymbol", event.target.value || undefined)}
              />
              {CURRENCY_PRESETS.map((symbol) => (
                <button
                  key={symbol}
                  type="button"
                  onClick={() => setField("currencySymbol", own.currencySymbol === symbol ? undefined : symbol)}
                  aria-pressed={own.currencySymbol === symbol}
                  className={clsx(
                    "grid size-9 shrink-0 place-items-center rounded-md border text-sm",
                    own.currencySymbol === symbol
                      ? "border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400"
                      : "dark:border-dark-450 dark:bg-dark-800 border-gray-300 bg-white",
                  )}
                >
                  {symbol}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Simge konumu">
            <Segmented
              value={own.currencyAlign ?? (isValue ? INHERIT : "right")}
              disabled={!effective.currencySymbol}
              options={[
                ...(isValue ? [{ value: INHERIT, label: "Varsayılan" }] : []),
                { value: "left", label: "Solda ($1.234)" },
                { value: "right", label: "Sağda (1.234 ₺)" },
              ]}
              onChange={(value) => setField("currencyAlign", value === INHERIT ? undefined : value as Format["currencyAlign"])}
            />
          </Field>
          <Field label="Boş hücre metni">
            <input
              className={FIELD_CLASS}
              value={own.nullValue ?? ""}
              placeholder={isValue && draft.defaults.nullValue ? `Varsayılan: ${draft.defaults.nullValue}` : "Boş bırak, ör. - ya da 0"}
              maxLength={20}
              onChange={(event) => setField("nullValue", event.target.value || undefined)}
            />
          </Field>
          <Field label="Yüzde olarak göster">
            <Segmented
              value={own.isPercent === undefined ? (isValue ? INHERIT : "false") : String(own.isPercent)}
              options={[
                ...(isValue ? [{ value: INHERIT, label: "Varsayılan" }] : []),
                { value: "false", label: "Hayır" },
                { value: "true", label: "Evet (0,25 → %25)" },
              ]}
              onChange={(value) => setField("isPercent", value === INHERIT ? undefined : value === "true")}
            />
          </Field>
        </div>

        <div className="dark:border-dark-500 mt-5 border-t border-gray-200 pt-5">
          <span className="dark:text-dark-300 text-xs font-medium text-gray-600">Önizleme</span>
          <div className="dark:border-dark-450 mt-1.5 grid grid-cols-2 overflow-hidden rounded-md border border-gray-300 sm:grid-cols-4">
            {SAMPLES.map((sample, i) => (
              <div
                key={i}
                className="dark:border-dark-450 flex flex-col gap-0.5 border-gray-300 px-3 py-2 not-last:border-r"
              >
                <span className="dark:text-dark-300 text-[11px] text-gray-500">
                  {sample === null ? "Boş hücre" : String(sample).replace(".", ",")}
                </span>
                <span
                  className="dark:text-dark-50 text-right text-sm font-medium text-gray-900 tabular-nums"
                  style={pivotNumberAlignStyle(effective)}
                >
                  {formatPivotNumber(sample, effective) || " "}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dark:border-dark-500 flex flex-wrap items-center gap-2 border-t border-gray-200 px-5 py-3">
        <Button
          variant="flat"
          className="mr-auto h-9 px-3 text-sm"
          disabled={!clean(own)}
          onClick={resetTarget}
        >
          {isValue ? "Bu alanın biçimini sıfırla" : "Varsayılan biçimi sıfırla"}
        </Button>
        <Button variant="flat" className="h-9 px-3 text-sm" onClick={onClose}>
          Vazgeç
        </Button>
        <Button
          color="primary"
          className="h-9 px-5 text-sm"
          onClick={() => {
            onApply(clean(draft.defaults), draft.perValue.map(clean));
            onClose();
          }}
        >
          Uygula
        </Button>
      </div>
    </>
  );
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={clsx("flex min-w-0 flex-col gap-1", wide && "sm:col-span-2")}>
      <span className="dark:text-dark-300 text-xs font-medium text-gray-600">{label}</span>
      {children}
    </div>
  );
}

function Segmented({
  value,
  options,
  disabled,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      className={clsx("dark:border-dark-450 flex h-9 rounded-md border border-gray-300 p-0.5", disabled && "opacity-50")}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={clsx(
            "min-w-0 flex-1 truncate rounded px-2 text-sm transition-colors",
            value === option.value
              ? "bg-primary-600 font-medium text-white"
              : "dark:text-dark-100 dark:hover:bg-dark-600 text-gray-700 hover:bg-gray-100",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
