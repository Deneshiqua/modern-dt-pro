import type { CSSProperties } from "react";

import type { DataTablePivotNumberFormat, DataTablePivotValue } from "../types";

export const PIVOT_DECIMAL_PLACES_MAX = 10;
/** Ondalik basamak verilmediginde kullanilan en fazla basamak. */
const AUTO_DECIMALS = 2;

/** Varsayilan bicim ile veri alanina ozel bicimi birlestirir (alan bicimi ustte). */
export function resolvePivotNumberFormat(
  defaults: DataTablePivotNumberFormat | undefined,
  value: DataTablePivotValue | undefined,
): DataTablePivotNumberFormat {
  return { ...defaults, ...value?.numberFormat };
}

const groupThousands = (digits: string, separator: string) =>
  separator ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator) : digits;

/** Sayiyi bicime gore metne cevirir; null icin nullValue (varsayilan bos) doner. */
export function formatPivotNumber(value: number | null, format: DataTablePivotNumberFormat = {}): string {
  if (value === null || !Number.isFinite(value)) return format.nullValue ?? "";

  const thousands = format.thousandsSeparator ?? ".";
  const decimalSeparator = format.decimalSeparator ?? ",";
  const scaled = format.isPercent ? value * 100 : value;
  const fixed = format.decimalPlaces !== undefined;
  const places = fixed
    ? Math.min(Math.max(Math.trunc(format.decimalPlaces!), 0), PIVOT_DECIMAL_PLACES_MAX)
    : AUTO_DECIMALS;

  let text = Math.abs(scaled).toFixed(places);
  // Otomatik modda sondaki sifirlari at (1.50 -> 1.5, 2.00 -> 2)
  if (!fixed && text.includes(".")) text = text.replace(/\.?0+$/, "");
  const [integer, fraction] = text.split(".");
  const negative = scaled < 0 && Number(text) !== 0;

  let number = groupThousands(integer, thousands) + (fraction ? `${decimalSeparator}${fraction}` : "");
  if (format.isPercent) number = `%${number}`;

  const symbol = format.currencySymbol?.trim();
  if (symbol) {
    number = (format.currencyAlign ?? "right") === "left" ? `${symbol}${number}` : `${number} ${symbol}`;
  }
  return negative ? `-${number}` : number;
}

/** Hucre hizalamasi (varsayilan saga yasli, CSS'te tanimli). */
export const pivotNumberAlignStyle = (format: DataTablePivotNumberFormat): CSSProperties | undefined =>
  format.textAlign && format.textAlign !== "right" ? { textAlign: format.textAlign } : undefined;

/** Veri alani icin tek bir bicimlendirici: ozel `format` fonksiyonu varsa o kullanilir. */
export function createPivotValueFormatter(
  defaults: DataTablePivotNumberFormat | undefined,
  value: DataTablePivotValue | undefined,
): (cell: number | null) => string {
  const format = resolvePivotNumberFormat(defaults, value);
  const custom = value?.format;
  return (cell) => (cell === null ? format.nullValue ?? "" : custom ? custom(cell) : formatPivotNumber(cell, format));
}

/** Bicimde kullanici tarafindan ayarlanmis bir alan var mi. */
export const hasPivotNumberFormat = (format: DataTablePivotNumberFormat | undefined) =>
  Boolean(format && Object.values(format).some((item) => item !== undefined));

const THOUSANDS_NAMES: Record<string, string> = { ".": "nokta", ",": "virgül", " ": "boşluk", "'": "kesme", "": "yok" };

/** "2 ondalık · ₺ sağda · binlik: nokta" gibi kisa aciklama; ayar yoksa "Varsayılan". */
export function describePivotNumberFormat(format: DataTablePivotNumberFormat | undefined): string {
  if (!hasPivotNumberFormat(format)) return "Varsayılan";
  const parts: string[] = [];
  const f = format!;
  if (f.decimalPlaces !== undefined) parts.push(`${f.decimalPlaces} ondalık`);
  if (f.currencySymbol) parts.push(`${f.currencySymbol} ${(f.currencyAlign ?? "right") === "left" ? "solda" : "sağda"}`);
  if (f.isPercent) parts.push("yüzde");
  if (f.thousandsSeparator !== undefined) parts.push(`binlik: ${THOUSANDS_NAMES[f.thousandsSeparator]}`);
  if (f.decimalSeparator !== undefined) parts.push(`ondalık: ${f.decimalSeparator === "," ? "virgül" : "nokta"}`);
  if (f.textAlign) parts.push({ left: "sola", center: "ortaya", right: "sağa" }[f.textAlign] + " hizalı");
  if (f.nullValue) parts.push(`boş: ${f.nullValue}`);
  return parts.join(" · ");
}
