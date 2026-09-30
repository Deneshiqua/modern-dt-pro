import type {
  DataTablePivotAggregate,
  DataTablePivotCellStyles,
  DataTablePivotColorStyle,
  DataTablePivotCondition,
  DataTablePivotConditionOperator,
  DataTablePivotConfig,
  DataTablePivotFilterValue,
  DataTablePivotNumberFormat,
  DataTablePivotValue,
} from "../types";
import type { PivotField, PivotModel, PivotNode } from "./pivotEngine";

// ----------------------------------------------------------------------
// JSON veri ice aktarma

export type PivotJsonParseResult =
  | { ok: true; rows: Record<string, unknown>[]; note?: string }
  | { ok: false; error: string };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * JSON sozdizimi hatasinin konumunu bulur. Tarayicilarin JSON.parse mesajlari konum
 * icermeyebildigi icin kucuk bir tarayici ile ilk hatali karakter aranir.
 */
export function findJsonErrorOffset(text: string): number | undefined {
  const length = text.length;
  const number = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
  let index = 0;
  const fail = (): never => {
    throw index;
  };
  const skipSpace = () => {
    while (index < length && /\s/.test(text[index])) index += 1;
  };
  const readString = () => {
    index += 1;
    while (index < length) {
      const char = text[index];
      if (char === "\\") index += 2;
      else if (char === '"') {
        index += 1;
        return;
      } else if (char === "\n") fail();
      else index += 1;
    }
    fail();
  };
  const readValue = (): void => {
    skipSpace();
    const char = text[index];
    if (char === "{" || char === "[") {
      const close = char === "{" ? "}" : "]";
      index += 1;
      skipSpace();
      if (text[index] === close) {
        index += 1;
        return;
      }
      for (;;) {
        if (char === "{") {
          skipSpace();
          if (text[index] !== '"') fail();
          readString();
          skipSpace();
          if (text[index] !== ":") fail();
          index += 1;
        }
        readValue();
        skipSpace();
        if (text[index] === ",") {
          index += 1;
          continue;
        }
        if (text[index] === close) {
          index += 1;
          return;
        }
        fail();
      }
    }
    if (char === '"') return readString();
    number.lastIndex = index;
    const match = number.exec(text);
    if (match) {
      index += match[0].length;
      return;
    }
    for (const literal of ["true", "false", "null"]) {
      if (text.startsWith(literal, index)) {
        index += literal.length;
        return;
      }
    }
    fail();
  };
  try {
    readValue();
    skipSpace();
    if (index < length) fail();
    return undefined;
  } catch (error) {
    return typeof error === "number" ? error : undefined;
  }
}

/** Hata konumunu "satir 3, sutun 11: beklenmeyen '}'" bicimine cevirir. */
function describeJsonError(text: string): string {
  const offset = findJsonErrorOffset(text);
  if (offset === undefined) return "Geçersiz JSON: metin eksik ya da hatalı görünüyor.";
  const before = text.slice(0, offset);
  const line = before.split("\n").length;
  const column = offset - before.lastIndexOf("\n");
  const found = offset >= text.length ? "metnin sonu" : `"${text[offset]}"`;
  return `Geçersiz JSON (satır ${line}, sütun ${column}): beklenmeyen ${found}.`;
}

/**
 * Yapistirilan metni kayit listesine cevirir. Dogrudan dizi ya da icinde tek bir
 * nesne dizisi bulunan nesne ({ "data": [...] } gibi) kabul edilir.
 */
export function parsePivotJson(text: string): PivotJsonParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "JSON listesi yapıştırın ya da bir dosya seçin." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: describeJsonError(trimmed) };
  }

  let rows: unknown = parsed;
  let note: string | undefined;
  if (isPlainObject(parsed)) {
    const arrays = Object.entries(parsed).filter(([, value]) => Array.isArray(value));
    if (arrays.length === 0) {
      return { ok: false, error: "JSON bir liste olmalı: [ { ... }, { ... } ]" };
    }
    const [key, value] = arrays[0];
    rows = value;
    note = `"${key}" alanındaki liste kullanıldı.`;
  }

  if (!Array.isArray(rows)) return { ok: false, error: "JSON bir liste olmalı: [ { ... }, { ... } ]" };
  if (rows.length === 0) return { ok: false, error: "Liste boş; en az bir kayıt olmalı." };
  const invalidIndex = rows.findIndex((row) => !isPlainObject(row));
  if (invalidIndex >= 0) {
    return {
      ok: false,
      error: `${invalidIndex + 1}. öğe bir nesne değil. Her öğe { "alan": değer } biçiminde olmalı.`,
    };
  }
  return { ok: true, rows: rows as Record<string, unknown>[], note };
}

// ----------------------------------------------------------------------
// Pivot ayari kontrolleri

export type PivotIssue = { level: "error" | "warning"; message: string };

/** Tum dugumler acildiginda olusacak yaprak sayisi. */
const countLeaves = (node: PivotNode): number =>
  node.children.length === 0 ? 1 : node.children.reduce((sum, child) => sum + countLeaves(child), 0);

export const PIVOT_COLUMN_LIMIT = 500;
export const PIVOT_ROW_LIMIT = 20000;

export function validatePivotConfig(
  config: DataTablePivotConfig<any>,
  fields: PivotField[],
  model?: PivotModel,
): PivotIssue[] {
  const issues: PivotIssue[] = [];
  const byId = new Map(fields.map((field) => [field.id, field]));
  const labelOf = (id: string) => byId.get(id)?.label ?? id;

  const used = [
    ...config.rows,
    ...config.columns,
    ...(config.filters ?? []),
    ...config.values.map((value) => value.field),
  ].map(String);
  const missing = Array.from(new Set(used.filter((id) => !byId.has(id))));
  if (missing.length > 0) {
    issues.push({
      level: "error",
      message: `Veride bulunmayan alan: ${missing.map((id) => `"${id}"`).join(", ")}. Bu alanları kaldırın.`,
    });
  }

  config.values.forEach((value) => {
    const field = byId.get(value.field);
    if (field && !field.isNumeric && value.aggregate !== "count") {
      issues.push({
        level: "error",
        message: `"${field.label}" sayısal değil; ${value.aggregate === "sum" ? "toplanamaz" : "hesaplanamaz"}. Özet türünü "Adet" yapın.`,
      });
    }
  });

  if (config.values.length === 0) {
    issues.push({ level: "warning", message: "Veri alanı seçilmedi; tablo boş görünür. Veri alanlarına en az bir alan ekleyin." });
  }

  if (model && missing.length === 0) {
    const columnCount = countLeaves(model.columnRoot) * Math.max(config.values.length, 1);
    if (config.columns.length > 0 && columnCount > PIVOT_COLUMN_LIMIT) {
      issues.push({
        level: "warning",
        message: `Tüm sütunlar açıldığında ${columnCount.toLocaleString("tr-TR")} sütun oluşur; tablo yavaşlayabilir. ${labelOf(String(config.columns[config.columns.length - 1]))} alanını satırlara ya da filtreye taşımayı düşünün.`,
      });
    }
    const rowCount = countLeaves(model.rowRoot);
    if (config.rows.length > 0 && rowCount > PIVOT_ROW_LIMIT) {
      issues.push({
        level: "warning",
        message: `Tüm satırlar açıldığında ${rowCount.toLocaleString("tr-TR")} satır oluşur; "Tümünü genişlet" yavaş çalışabilir.`,
      });
    }
  }

  return issues;
}

// ----------------------------------------------------------------------
// Yapilandirma (alan secici + kosullu bicimlendirme) disa/ice aktarma

const AGGREGATE_IDS: DataTablePivotAggregate[] = ["sum", "avg", "count", "min", "max"];
const OPERATOR_IDS: DataTablePivotConditionOperator[] = [
  "lt", "lte", "gt", "gte", "eq", "neq", "between", "notBetween", "empty", "notEmpty",
];
const APPLY_TO_IDS = ["all", "cells", "totals"] as const;
const TOTAL_KEYS = ["showRowTotals", "showColumnTotals", "showRowGrandTotals", "showColumnGrandTotals"] as const;

/** Paylasilabilir yapilandirma: acik/kapali dugumler gibi anlik gorunum durumu disarida birakilir. */
export type PivotShareableConfig = Pick<
  DataTablePivotConfig<any>,
  | "rows"
  | "columns"
  | "filters"
  | "filterValues"
  | "values"
  | "conditions"
  | "fieldLabels"
  | "numberFormat"
  | "cellStyles"
  | (typeof TOTAL_KEYS)[number]
>;

export function toShareablePivotConfig(config: DataTablePivotConfig<any>): PivotShareableConfig {
  const shareable: PivotShareableConfig = {
    rows: config.rows.map(String),
    columns: config.columns.map(String),
    filters: (config.filters ?? []).map(String),
    filterValues: config.filterValues ?? {},
    values: config.values.map(({ field, aggregate, label, numberFormat, cellStyles }) => ({
      field,
      aggregate,
      ...(label ? { label } : {}),
      ...(numberFormat && Object.keys(numberFormat).length > 0 ? { numberFormat } : {}),
      ...(cellStyles && Object.keys(cellStyles).length > 0 ? { cellStyles } : {}),
    })),
    conditions: (config.conditions ?? []).map(({ id: _id, ...rule }) => rule as DataTablePivotCondition),
  };
  if (config.fieldLabels && Object.keys(config.fieldLabels).length > 0) shareable.fieldLabels = config.fieldLabels;
  if (config.numberFormat && Object.keys(config.numberFormat).length > 0) shareable.numberFormat = config.numberFormat;
  if (config.cellStyles && Object.keys(config.cellStyles).length > 0) shareable.cellStyles = config.cellStyles;
  TOTAL_KEYS.forEach((key) => {
    if (config[key] === false) shareable[key] = false;
  });
  return shareable;
}

export type PivotConfigParseResult =
  | { ok: true; config: PivotShareableConfig }
  | { ok: false; errors: string[] };

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isFiniteOrUndefined = (value: unknown) =>
  value === undefined || (typeof value === "number" && Number.isFinite(value));

const NUMBER_FORMAT_ENUMS = {
  textAlign: ["left", "center", "right"],
  thousandsSeparator: [".", ",", " ", "'", ""],
  decimalSeparator: [",", "."],
  currencyAlign: ["left", "right"],
} as const;

/** Sayi bicimi nesnesini dogrular; hatalari `path` ile errors'a ekler. */
function readNumberFormat(value: unknown, path: string, errors: string[]): DataTablePivotNumberFormat | undefined {
  if (value === undefined) return undefined;
  if (!isPlainObject(value)) {
    errors.push(`${path} nesne olmalı, ör. { "decimalPlaces": 2, "currencySymbol": "₺" }.`);
    return undefined;
  }
  const format: DataTablePivotNumberFormat = {};
  for (const [key, raw] of Object.entries(value)) {
    if (key in NUMBER_FORMAT_ENUMS) {
      const allowed = NUMBER_FORMAT_ENUMS[key as keyof typeof NUMBER_FORMAT_ENUMS] as readonly string[];
      if (!allowed.includes(raw as string)) {
        errors.push(`${path}.${key} geçersiz: ${JSON.stringify(raw)}. Geçerli: ${allowed.map((item) => JSON.stringify(item)).join(", ")}.`);
        continue;
      }
      (format as Record<string, unknown>)[key] = raw;
    } else if (key === "decimalPlaces") {
      if (!Number.isInteger(raw) || (raw as number) < 0 || (raw as number) > 10) {
        errors.push(`${path}.decimalPlaces 0 ile 10 arasında tam sayı olmalı.`);
        continue;
      }
      format.decimalPlaces = raw as number;
    } else if (key === "currencySymbol" || key === "nullValue") {
      if (typeof raw !== "string") {
        errors.push(`${path}.${key} metin olmalı.`);
        continue;
      }
      format[key] = raw;
    } else if (key === "isPercent") {
      if (typeof raw !== "boolean") {
        errors.push(`${path}.isPercent true ya da false olmalı.`);
        continue;
      }
      format.isPercent = raw;
    } else {
      errors.push(`${path}.${key} tanınmayan ayar.`);
    }
  }
  return format;
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const CELL_STYLE_KINDS = ["cells", "alternateCells", "totals", "grandTotals"] as const;

/** Hucre renklerini dogrular: { cells|totals|grandTotals: { backgroundColor, color } }. */
function readCellStyles(value: unknown, path: string, errors: string[]): DataTablePivotCellStyles | undefined {
  if (value === undefined) return undefined;
  if (!isPlainObject(value)) {
    errors.push(`${path} nesne olmalı, ör. { "totals": { "backgroundColor": "#f3f4f6" } }.`);
    return undefined;
  }
  const styles: DataTablePivotCellStyles = {};
  for (const [kind, style] of Object.entries(value)) {
    if (!CELL_STYLE_KINDS.includes(kind as (typeof CELL_STYLE_KINDS)[number])) {
      errors.push(`${path}.${kind} tanınmayan hücre türü. Geçerli: ${CELL_STYLE_KINDS.join(", ")}.`);
      continue;
    }
    if (!isPlainObject(style)) {
      errors.push(`${path}.${kind} nesne olmalı, ör. { "backgroundColor": "#dcfce7", "color": "#166534" }.`);
      continue;
    }
    const entry: DataTablePivotColorStyle = {};
    for (const [key, color] of Object.entries(style)) {
      if (key !== "backgroundColor" && key !== "color") {
        errors.push(`${path}.${kind}.${key} tanınmayan ayar; backgroundColor ya da color olmalı.`);
      } else if (typeof color !== "string" || !HEX_COLOR.test(color)) {
        errors.push(`${path}.${kind}.${key} onaltılık renk olmalı, ör. "#dcfce7".`);
      } else {
        entry[key] = color;
      }
    }
    styles[kind as (typeof CELL_STYLE_KINDS)[number]] = entry;
  }
  return styles;
}

/** Yapistirilan yapilandirma JSON'unu yapisal olarak dogrular; alan adlari burada kontrol edilmez. */
export function parsePivotConfigJson(text: string): PivotConfigParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, errors: ["Yapılandırma JSON'u boş."] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, errors: [describeJsonError(trimmed)] };
  }
  if (!isPlainObject(parsed)) return { ok: false, errors: ["Yapılandırma bir nesne olmalı: { \"rows\": [...], ... }"] };

  const errors: string[] = [];
  const read = (key: "rows" | "columns" | "filters") => {
    const value = parsed[key];
    if (value === undefined) return [];
    if (!isStringArray(value)) {
      errors.push(`"${key}" metin listesi olmalı, ör. ["bolge", "sehir"].`);
      return [];
    }
    return value;
  };
  const rows = read("rows");
  const columns = read("columns");
  const filters = read("filters");

  const values: DataTablePivotValue[] = [];
  if (parsed.values !== undefined && !Array.isArray(parsed.values)) {
    errors.push('"values" bir liste olmalı, ör. [{ "field": "tutar", "aggregate": "sum" }].');
  } else {
    (parsed.values as unknown[] | undefined ?? []).forEach((item, index) => {
      if (!isPlainObject(item) || typeof item.field !== "string") {
        errors.push(`values[${index}]: "field" metin olmalı.`);
        return;
      }
      if (!AGGREGATE_IDS.includes(item.aggregate as DataTablePivotAggregate)) {
        errors.push(`values[${index}].aggregate geçersiz: ${JSON.stringify(item.aggregate)}. Geçerli: ${AGGREGATE_IDS.join(", ")}.`);
        return;
      }
      const numberFormat = readNumberFormat(item.numberFormat, `values[${index}].numberFormat`, errors);
      const cellStyles = readCellStyles(item.cellStyles, `values[${index}].cellStyles`, errors);
      values.push({
        field: item.field,
        aggregate: item.aggregate as DataTablePivotAggregate,
        ...(typeof item.label === "string" ? { label: item.label } : {}),
        ...(numberFormat ? { numberFormat } : {}),
        ...(cellStyles ? { cellStyles } : {}),
      });
    });
  }

  let filterValues: PivotShareableConfig["filterValues"] = {};
  if (parsed.filterValues !== undefined) {
    if (!isPlainObject(parsed.filterValues)) {
      errors.push('"filterValues" nesne olmalı, ör. { "bolge": ["Ege"] }.');
    } else {
      filterValues = {};
      Object.entries(parsed.filterValues).forEach(([field, list]) => {
        const valid = Array.isArray(list) && list.every((item) =>
          item === null || ["string", "number", "boolean"].includes(typeof item));
        if (!valid) errors.push(`filterValues.${field}: değer listesi olmalı (metin, sayı, true/false ya da null).`);
        else filterValues![field] = list as DataTablePivotFilterValue[];
      });
    }
  }

  const conditions: DataTablePivotCondition[] = [];
  if (parsed.conditions !== undefined && !Array.isArray(parsed.conditions)) {
    errors.push('"conditions" bir liste olmalı.');
  } else {
    (parsed.conditions as unknown[] | undefined ?? []).forEach((item, index) => {
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
      const measure = item.measure;
      if (measure !== undefined && (!isPlainObject(measure) || typeof measure.field !== "string"
        || !AGGREGATE_IDS.includes(measure.aggregate as DataTablePivotAggregate))) {
        errors.push(`${path}.measure { "field": metin, "aggregate": ${AGGREGATE_IDS.join("|")} } olmalı.`);
        return;
      }
      if (!isPlainObject(item.format)) {
        errors.push(`${path}.format nesne olmalı, ör. { "backgroundColor": "#dcfce7" }.`);
        return;
      }
      conditions.push({
        id: typeof item.id === "string" ? item.id : `c${index}${Date.now().toString(36)}`,
        operator: item.operator as DataTablePivotConditionOperator,
        value: item.value as number | undefined,
        value2: item.value2 as number | undefined,
        applyTo: item.applyTo as DataTablePivotCondition["applyTo"],
        measure: measure as DataTablePivotCondition["measure"],
        format: item.format as DataTablePivotCondition["format"],
        ...(item.enabled === false ? { enabled: false } : {}),
      });
    });
  }

  let fieldLabels: PivotShareableConfig["fieldLabels"];
  if (parsed.fieldLabels !== undefined) {
    if (!isPlainObject(parsed.fieldLabels) || !Object.values(parsed.fieldLabels).every((name) => typeof name === "string")) {
      errors.push('"fieldLabels" alan adı → görünen ad eşlemesi olmalı, ör. { "department": "Departman" }.');
    } else {
      fieldLabels = parsed.fieldLabels as Record<string, string>;
    }
  }

  const numberFormat = readNumberFormat(parsed.numberFormat, "numberFormat", errors);
  const cellStyles = readCellStyles(parsed.cellStyles, "cellStyles", errors);

  const config: PivotShareableConfig = {
    rows, columns, filters, filterValues, values, conditions, fieldLabels, numberFormat, cellStyles,
  };
  TOTAL_KEYS.forEach((key) => {
    const value = parsed[key];
    if (value === undefined) return;
    if (typeof value !== "boolean") errors.push(`"${key}" true ya da false olmalı.`);
    else config[key] = value;
  });

  // Ayni alan birden fazla boyut alaninda olamaz
  const seen = new Map<string, string>();
  ([["rows", rows], ["columns", columns], ["filters", filters]] as const).forEach(([area, list]) => {
    list.forEach((field) => {
      const previous = seen.get(field);
      if (previous) errors.push(`"${field}" hem "${previous}" hem "${area}" içinde; bir alan tek bir boyutta olabilir.`);
      else seen.set(field, area);
    });
  });

  return errors.length > 0 ? { ok: false, errors } : { ok: true, config };
}

// ----------------------------------------------------------------------
// JSON Schema (editorde otomatik tamamlama ve dogrulama)

/** Veri Yukle: nesnelerden olusan liste. */
export const PIVOT_DATA_SCHEMA = {
  oneOf: [
    { type: "array", minItems: 1, items: { type: "object" } },
    { type: "object", description: "İçinde nesne listesi bulunan nesne, ör. { \"data\": [...] }" },
  ],
};

/** Yapilandirma semasi; alan adlari verideki alanlarla sinirlanir. */
export function buildPivotConfigSchema(fieldIds: string[]) {
  const field = fieldIds.length > 0
    ? { type: "string", enum: fieldIds, description: "Verideki alan adı" }
    : { type: "string" };
  const fieldList = (description: string) => ({ type: "array", description, uniqueItems: true, items: field });
  const color = { type: "string", pattern: "^#[0-9a-fA-F]{6}$", description: "Onaltılık renk, ör. #dcfce7" };
  const aggregate = { enum: AGGREGATE_IDS, description: "sum: Toplam, avg: Ortalama, count: Adet, min: En küçük, max: En büyük" };
  const colorStyle = {
    type: "object",
    additionalProperties: false,
    properties: { backgroundColor: color, color },
  };
  const cellStyles = {
    type: "object",
    description: "Hücre renkleri: veri hücreleri (1. ve 2. renk), ara toplamlar, genel toplamlar",
    additionalProperties: false,
    properties: {
      cells: colorStyle,
      alternateCells: { ...colorStyle, description: "Veri hücreleri 2. renk: sütunlar sırayla 1. ve 2. renkle boyanır" },
      totals: colorStyle,
      grandTotals: colorStyle,
    },
  };
  const numberFormat = {
    type: "object",
    description: "Sayı biçimi",
    additionalProperties: false,
    properties: {
      textAlign: { enum: NUMBER_FORMAT_ENUMS.textAlign, description: "Hücre hizalaması" },
      thousandsSeparator: { enum: NUMBER_FORMAT_ENUMS.thousandsSeparator, description: "Binlik ayırıcı; \"\" = yok" },
      decimalSeparator: { enum: NUMBER_FORMAT_ENUMS.decimalSeparator, description: "Ondalık ayırıcı" },
      decimalPlaces: { type: "integer", minimum: 0, maximum: 10, description: "Sabit ondalık basamak; verilmezse en fazla 2" },
      currencySymbol: { type: "string", description: "Para birimi simgesi, ör. ₺" },
      currencyAlign: { enum: NUMBER_FORMAT_ENUMS.currencyAlign, description: "Simgenin konumu" },
      nullValue: { type: "string", description: "Boş hücrede gösterilecek metin" },
      isPercent: { type: "boolean", description: "Değeri 100 ile çarpıp % ekler" },
    },
  };
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      rows: fieldList("Satır alanları (hiyerarşi sırasıyla)"),
      columns: fieldList("Sütun alanları (hiyerarşi sırasıyla)"),
      filters: fieldList("Filtre alanları"),
      filterValues: {
        type: "object",
        description: "Alan başına dahil edilecek değerler",
        propertyNames: field,
        additionalProperties: { type: "array", items: { type: ["string", "number", "boolean", "null"] } },
      },
      values: {
        type: "array",
        description: "Veri alanları",
        items: {
          type: "object",
          required: ["field", "aggregate"],
          additionalProperties: false,
          properties: { field, aggregate, label: { type: "string" }, numberFormat, cellStyles },
        },
      },
      conditions: {
        type: "array",
        description: "Koşullu biçimlendirme kuralları",
        items: {
          type: "object",
          required: ["operator", "format"],
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            measure: {
              type: "object",
              required: ["field", "aggregate"],
              additionalProperties: false,
              properties: { field, aggregate },
            },
            operator: { enum: OPERATOR_IDS },
            value: { type: "number" },
            value2: { type: "number" },
            applyTo: { enum: APPLY_TO_IDS, description: "all: Tüm hücreler, cells: Veri hücreleri, totals: Toplamlar" },
            enabled: { type: "boolean" },
            format: {
              type: "object",
              additionalProperties: false,
              properties: {
                backgroundColor: color,
                color,
                fontWeight: { enum: ["normal", "bold"] },
                fontStyle: { enum: ["normal", "italic"] },
              },
            },
          },
        },
      },
      numberFormat,
      cellStyles,
      fieldLabels: {
        type: "object",
        description: "Satır/sütun/filtre alanlarının görünen adları",
        propertyNames: field,
        additionalProperties: { type: "string" },
      },
      showRowTotals: { type: "boolean" },
      showColumnTotals: { type: "boolean" },
      showRowGrandTotals: { type: "boolean" },
      showColumnGrandTotals: { type: "boolean" },
    },
  };
}
