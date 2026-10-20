import type { CSSProperties } from "react";

import type {
  DataTableCondition,
  DataTablePivotCellStyles,
  DataTablePivotColorStyle,
  DataTablePivotCondition,
  DataTablePivotConditionFormat,
  DataTablePivotConditionOperator,
  DataTablePivotNumberFormat,
  DataTableSettings,
} from "../types";
import { cleanPivotCellStyles, hasPivotCellStyles, pivotColorStyle } from "../pivot/pivotCellStyles";
import { contrastTextColor, matchesPivotCondition } from "../pivot/pivotConditions";
import type { ConditionsPanelCondition } from "../pivot/PivotConditionsDialog";
import { hasPivotNumberFormat } from "../pivot/pivotNumberFormat";
import {
  APPLY_TO_IDS,
  CONDITION_FORMAT_SCHEMA,
  NUMBER_FORMAT_SCHEMA,
  OPERATOR_IDS,
  cellStylesSchema,
  describeJsonError,
  isFiniteOrUndefined,
  isPlainObject,
  isStringArray,
  readCellStyles,
  readNumberFormat,
} from "../pivot/pivotValidation";

/** Tablodaki hucre turu: veri satiri, grup satiri, genel toplam satiri. */
export type TableCellKind = "cells" | "totals" | "grandTotals";

/** Kosullu bicimlendirme paneli pivot kurallariyla calisir; tablo kurallari bu bicime cevrilir. */
type PanelCondition = ConditionsPanelCondition;

/** Panelin kolonu "veri alani" gibi gormesi icin kullanilan sabit ozet turu. */
const PANEL_AGGREGATE = "sum" as const;

export const toNumberOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

// ----------------------------------------------------------------------
// Kolon sirasi ve gorunurluk

/** Kayitli siradaki bilinen kolonlar once, kalanlar dogal sirasiyla sona. */
export function resolveColumnOrder(order: string[] | undefined, columnIds: string[]): string[] {
  if (!order?.length) return columnIds;
  const known = new Set(columnIds);
  const ordered = order.filter((id) => known.has(id));
  const placed = new Set(ordered);
  return [...ordered, ...columnIds.filter((id) => !placed.has(id))];
}

// ----------------------------------------------------------------------
// Sayi bicimi ve hucre renkleri

/** Varsayilan + kolona ozel sayi bicimi; hic ayar yoksa undefined (tablo kendi bicimini kullanir). */
export function resolveColumnNumberFormat(
  settings: DataTableSettings,
  column: string,
): DataTablePivotNumberFormat | undefined {
  const merged = { ...settings.numberFormat, ...settings.columnNumberFormats?.[column] };
  return hasPivotNumberFormat(merged) ? merged : undefined;
}

/** Hucre rengi; veri satirlarinda `alternate` (cift sira) 2. rengi kullanir. */
export function resolveTableCellColor(
  settings: DataTableSettings,
  column: string,
  kind: TableCellKind,
  alternate = false,
): CSSProperties | undefined {
  const own = settings.columnCellStyles?.[column];
  const pick = (key: keyof DataTablePivotCellStyles): DataTablePivotColorStyle =>
    ({ ...settings.cellStyles?.[key], ...own?.[key] });
  const style = kind === "cells" && alternate ? { ...pick("cells"), ...pick("alternateCells") } : pick(kind);
  return pivotColorStyle(style);
}

// ----------------------------------------------------------------------
// Kosullu bicimlendirme

const appliesToKind = (condition: DataTableCondition, kind: TableCellKind) => {
  if (condition.enabled === false) return false;
  if (condition.applyTo === "cells") return kind === "cells";
  if (condition.applyTo === "totals") return kind !== "cells";
  return true;
};

function mergeFormat(style: CSSProperties | undefined, format: DataTablePivotConditionFormat): CSSProperties {
  const next: CSSProperties = { ...style };
  const { backgroundColor, color, fontWeight, fontStyle } = format;
  if (backgroundColor) {
    next.backgroundColor = backgroundColor;
    // Yazi rengi acikca verilmediyse arka plana gore okunur renk sec
    if (!color) next.color = contrastTextColor(backgroundColor) ?? next.color;
  }
  if (color) next.color = color;
  if (fontWeight) next.fontWeight = fontWeight === "bold" ? 700 : 400;
  if (fontStyle) next.fontStyle = fontStyle;
  return next;
}

const asPivotCondition = (condition: DataTableCondition): DataTablePivotCondition => ({
  id: condition.id,
  operator: condition.operator,
  value: condition.value,
  value2: condition.value2,
  format: condition.format,
});

/** Hucre hedefli kurallar: kolonu secilmemis kural yalnizca sayisal kolonlara uygulanir. */
export function resolveTableConditionStyle(
  conditions: DataTableCondition[] | undefined,
  column: string,
  isNumericColumn: boolean,
  value: number | null,
  kind: TableCellKind,
): CSSProperties | undefined {
  if (!conditions?.length) return undefined;
  let style: CSSProperties | undefined;
  conditions.forEach((condition) => {
    if ((condition.target ?? "cell") !== "cell" || !appliesToKind(condition, kind)) return;
    if (condition.column ? condition.column !== column : !isNumericColumn) return;
    if (matchesPivotCondition(asPivotCondition(condition), value)) style = mergeFormat(style, condition.format);
  });
  return style;
}

/** Satir hedefli kurallar: kural kolonundaki deger kosulu saglarsa satirin tum hucreleri boyanir. */
export function resolveTableRowConditionStyle(
  conditions: DataTableCondition[] | undefined,
  getValue: (column: string) => unknown,
  kind: TableCellKind,
): CSSProperties | undefined {
  if (!conditions?.length) return undefined;
  let style: CSSProperties | undefined;
  conditions.forEach((condition) => {
    if (condition.target !== "row" || !condition.column || !appliesToKind(condition, kind)) return;
    if (matchesPivotCondition(asPivotCondition(condition), toNumberOrNull(getValue(condition.column)))) {
      style = mergeFormat(style, condition.format);
    }
  });
  return style;
}

export const hasActiveTableConditions = (settings: DataTableSettings) =>
  (settings.conditions ?? []).some((condition) => condition.enabled !== false);

/** Tablo kuralini panelin anladigi pivot kuralina cevirir (kolon = veri alani). */
export const toPanelCondition = ({ column, ...rest }: DataTableCondition): PanelCondition => ({
  ...rest,
  ...(column ? { measure: { field: column, aggregate: PANEL_AGGREGATE } } : {}),
});

export const fromPanelCondition = ({ measure, ...rest }: PanelCondition): DataTableCondition => ({
  ...rest,
  ...(measure ? { column: measure.field } : {}),
});

/** Panellerin kolonlari "veri alani" gibi listelemesi icin. */
export const toPanelValues = (columns: { id: string }[], settings: DataTableSettings) =>
  columns.map((column) => ({
    field: column.id,
    aggregate: PANEL_AGGREGATE,
    numberFormat: settings.columnNumberFormats?.[column.id],
    cellStyles: settings.columnCellStyles?.[column.id],
  }));

/** Panelden donen kolon sirali listeyi kolon kimligine gore nesneye cevirir; bos olanlar atilir. */
export function byColumn<V>(
  columns: { id: string }[],
  list: (V | undefined)[],
  isSet: (value: V | undefined) => boolean,
): Record<string, V> | undefined {
  const entries = columns.flatMap((column, index) => (isSet(list[index]) ? [[column.id, list[index] as V] as const] : []));
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export const isCellStylesSet = (styles: DataTablePivotCellStyles | undefined) =>
  hasPivotCellStyles(cleanPivotCellStyles(styles));
export const isNumberFormatSet = (format: DataTablePivotNumberFormat | undefined) => hasPivotNumberFormat(format);

// ----------------------------------------------------------------------
// Paylasilabilir JSON

/** Bos alanlari ve kural kimliklerini atar; Yapilandirma sekmesindeki JSON budur. */
export function toShareableTableSettings(settings: DataTableSettings): DataTableSettings {
  const shareable: DataTableSettings = {};
  if (settings.columnOrder?.length) shareable.columnOrder = settings.columnOrder;
  if (settings.hiddenColumns?.length) shareable.hiddenColumns = settings.hiddenColumns;
  if (settings.columnLabels && Object.keys(settings.columnLabels).length > 0) shareable.columnLabels = settings.columnLabels;
  if (hasPivotNumberFormat(settings.numberFormat)) shareable.numberFormat = settings.numberFormat;
  if (settings.columnNumberFormats && Object.keys(settings.columnNumberFormats).length > 0) {
    shareable.columnNumberFormats = settings.columnNumberFormats;
  }
  if (hasPivotCellStyles(settings.cellStyles)) shareable.cellStyles = settings.cellStyles;
  if (settings.columnCellStyles && Object.keys(settings.columnCellStyles).length > 0) {
    shareable.columnCellStyles = settings.columnCellStyles;
  }
  if (settings.conditions?.length) {
    shareable.conditions = settings.conditions.map(({ id: _id, ...rule }) => rule as DataTableCondition);
  }
  return shareable;
}

export type TableSettingsParseResult =
  | { ok: true; settings: DataTableSettings }
  | { ok: false; errors: string[] };

const TARGET_IDS = ["cell", "row"] as const;
const SETTINGS_KEYS = [
  "columnOrder",
  "hiddenColumns",
  "columnLabels",
  "numberFormat",
  "columnNumberFormats",
  "cellStyles",
  "columnCellStyles",
  "conditions",
] as const;

function readStringMap(value: unknown, path: string, errors: string[]): Record<string, string> | undefined {
  if (value === undefined) return undefined;
  if (!isPlainObject(value) || !Object.values(value).every((item) => typeof item === "string")) {
    errors.push(`"${path}" kolon adı → metin eşlemesi olmalı, ör. { "total": "Tutar" }.`);
    return undefined;
  }
  return value as Record<string, string>;
}

function readPerColumn<V>(
  value: unknown,
  path: string,
  errors: string[],
  read: (item: unknown, itemPath: string, errors: string[]) => V | undefined,
): Record<string, V> | undefined {
  if (value === undefined) return undefined;
  if (!isPlainObject(value)) {
    errors.push(`"${path}" kolon adı → ayar eşlemesi olmalı.`);
    return undefined;
  }
  const result: Record<string, V> = {};
  Object.entries(value).forEach(([column, item]) => {
    const parsed = read(item, `${path}.${column}`, errors);
    if (parsed) result[column] = parsed;
  });
  return result;
}

function readConditions(value: unknown, errors: string[]): DataTableCondition[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    errors.push('"conditions" bir liste olmalı.');
    return undefined;
  }
  const conditions: DataTableCondition[] = [];
  value.forEach((item, index) => {
    const path = `conditions[${index}]`;
    if (!isPlainObject(item)) {
      errors.push(`${path}: nesne olmalı.`);
      return;
    }
    if (!OPERATOR_IDS.includes(item.operator as DataTablePivotConditionOperator)) {
      errors.push(`${path}.operator geçersiz: ${JSON.stringify(item.operator)}. Geçerli: ${OPERATOR_IDS.join(", ")}.`);
      return;
    }
    if (!isFiniteOrUndefined(item.value) || !isFiniteOrUndefined(item.value2)) {
      errors.push(`${path}: "value" ve "value2" sayı olmalı.`);
      return;
    }
    if (item.applyTo !== undefined && !APPLY_TO_IDS.includes(item.applyTo as (typeof APPLY_TO_IDS)[number])) {
      errors.push(`${path}.applyTo geçersiz: ${JSON.stringify(item.applyTo)}. Geçerli: ${APPLY_TO_IDS.join(", ")}.`);
      return;
    }
    if (item.target !== undefined && !TARGET_IDS.includes(item.target as (typeof TARGET_IDS)[number])) {
      errors.push(`${path}.target geçersiz: ${JSON.stringify(item.target)}. Geçerli: ${TARGET_IDS.join(", ")}.`);
      return;
    }
    if (item.column !== undefined && typeof item.column !== "string") {
      errors.push(`${path}.column metin olmalı.`);
      return;
    }
    if (item.target === "row" && !item.column) {
      errors.push(`${path}: "target": "row" için "column" verilmeli.`);
      return;
    }
    if (!isPlainObject(item.format)) {
      errors.push(`${path}.format nesne olmalı, ör. { "backgroundColor": "#dcfce7" }.`);
      return;
    }
    conditions.push({
      id: typeof item.id === "string" ? item.id : `c${index}${Date.now().toString(36)}`,
      operator: item.operator as DataTablePivotConditionOperator,
      ...(item.column ? { column: item.column as string } : {}),
      ...(item.value !== undefined ? { value: item.value as number } : {}),
      ...(item.value2 !== undefined ? { value2: item.value2 as number } : {}),
      ...(item.applyTo ? { applyTo: item.applyTo as DataTableCondition["applyTo"] } : {}),
      ...(item.target ? { target: item.target as DataTableCondition["target"] } : {}),
      format: item.format as DataTablePivotConditionFormat,
      ...(item.enabled === false ? { enabled: false } : {}),
    });
  });
  return conditions;
}

/** Yapistirilan tablo ayarlari JSON'unu yapisal olarak dogrular; kolon adlari burada kontrol edilmez. */
export function parseTableSettingsJson(text: string): TableSettingsParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, errors: ["Yapılandırma JSON'u boş."] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, errors: [describeJsonError(trimmed)] };
  }
  if (!isPlainObject(parsed)) return { ok: false, errors: ["Yapılandırma bir nesne olmalı: { \"columnOrder\": [...], ... }"] };

  const errors: string[] = [];
  Object.keys(parsed).forEach((key) => {
    if (!SETTINGS_KEYS.includes(key as (typeof SETTINGS_KEYS)[number])) {
      errors.push(`"${key}" tanınmayan ayar. Geçerli: ${SETTINGS_KEYS.join(", ")}.`);
    }
  });
  const list = (key: "columnOrder" | "hiddenColumns") => {
    const value = parsed[key];
    if (value === undefined) return undefined;
    if (!isStringArray(value)) {
      errors.push(`"${key}" metin listesi olmalı, ör. ["code", "name"].`);
      return undefined;
    }
    return value;
  };

  const settings: DataTableSettings = {
    columnOrder: list("columnOrder"),
    hiddenColumns: list("hiddenColumns"),
    columnLabels: readStringMap(parsed.columnLabels, "columnLabels", errors),
    numberFormat: readNumberFormat(parsed.numberFormat, "numberFormat", errors),
    columnNumberFormats: readPerColumn(parsed.columnNumberFormats, "columnNumberFormats", errors, readNumberFormat),
    cellStyles: readCellStyles(parsed.cellStyles, "cellStyles", errors),
    columnCellStyles: readPerColumn(parsed.columnCellStyles, "columnCellStyles", errors, readCellStyles),
    conditions: readConditions(parsed.conditions, errors),
  };
  (Object.keys(settings) as (keyof DataTableSettings)[]).forEach((key) => {
    if (settings[key] === undefined) delete settings[key];
  });
  return errors.length > 0 ? { ok: false, errors } : { ok: true, settings };
}

/** Tabloda olmayan kolonlara verilen ayarlar (uyari; uygulamayi engellemez). */
export function findUnknownSettingColumns(settings: DataTableSettings, columnIds: string[]): string[] {
  const known = new Set(columnIds);
  const referenced = new Set<string>([
    ...(settings.columnOrder ?? []),
    ...(settings.hiddenColumns ?? []),
    ...Object.keys(settings.columnLabels ?? {}),
    ...Object.keys(settings.columnNumberFormats ?? {}),
    ...Object.keys(settings.columnCellStyles ?? {}),
    ...(settings.conditions ?? []).flatMap((condition) => (condition.column ? [condition.column] : [])),
  ]);
  return [...referenced].filter((column) => !known.has(column));
}

/** Yapilandirma semasi; kolon adlari tablodaki kolonlarla sinirlanir. */
export function buildTableSettingsSchema(columnIds: string[]) {
  const column = columnIds.length > 0
    ? { type: "string", enum: columnIds, description: "Tablodaki kolon adı" }
    : { type: "string" };
  const columnList = (description: string) => ({ type: "array", description, uniqueItems: true, items: column });
  const perColumn = (description: string, schema: object) => ({
    type: "object",
    description,
    propertyNames: column,
    additionalProperties: schema,
  });
  const cellStyles = cellStylesSchema(
    "Hücre renkleri: veri satırları (1. ve 2. renk), grup satırları, genel toplam satırı",
    "Veri satırları 2. renk: satırlar sırayla 1. ve 2. renkle boyanır",
  );
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      columnOrder: columnList("Kolonların gösterim sırası"),
      hiddenColumns: columnList("Gizlenen kolonlar"),
      columnLabels: perColumn("Kolon başlıkları", { type: "string" }),
      numberFormat: NUMBER_FORMAT_SCHEMA,
      columnNumberFormats: perColumn("Kolona özel sayı biçimi", NUMBER_FORMAT_SCHEMA),
      cellStyles,
      columnCellStyles: perColumn("Kolona özel hücre renkleri", cellStyles),
      conditions: {
        type: "array",
        description: "Koşullu biçimlendirme kuralları",
        items: {
          type: "object",
          required: ["operator", "format"],
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            column,
            operator: { enum: OPERATOR_IDS },
            value: { type: "number" },
            value2: { type: "number" },
            applyTo: { enum: APPLY_TO_IDS, description: "all: Tüm satırlar, cells: Veri satırları, totals: Grup ve toplam satırları" },
            target: { enum: TARGET_IDS, description: "cell: Yalnızca hücre, row: Satırın tamamı" },
            enabled: { type: "boolean" },
            format: CONDITION_FORMAT_SCHEMA,
          },
        },
      },
    },
  };
}

// ----------------------------------------------------------------------
// Kalicilik (stateStorageKey)

const STORAGE_PREFIX = "modern-dt-pro:settings:";

export function loadPersistedTableSettings(storageKey: string | undefined): DataTableSettings | undefined {
  if (!storageKey || typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + storageKey);
    if (!raw) return undefined;
    const result = parseTableSettingsJson(raw);
    return result.ok ? result.settings : undefined;
  } catch {
    return undefined;
  }
}

export function savePersistedTableSettings(storageKey: string | undefined, settings: DataTableSettings): void {
  if (!storageKey || typeof window === "undefined") return;
  try {
    // Kural kimlikleri saklanir ki yeniden yuklemede secili kural korunabilsin
    window.localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(settings));
  } catch {
    // localStorage kullanilamiyor (gizli mod, kota dolu, vb.) - sessizce yok say
  }
}
