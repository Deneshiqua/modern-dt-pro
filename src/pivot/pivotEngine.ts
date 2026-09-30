import type {
  DataTablePivotAggregate,
  DataTablePivotConfig,
  DataTablePivotDateInterval,
  DataTablePivotFilterValue,
  DataTablePivotValue,
} from "../types";

// ----------------------------------------------------------------------
// Alanlar

/** Tarih alanlarinin sanal alt alanlari `createdAt::year` bicimindedir. */
export const PIVOT_INTERVAL_SEPARATOR = "::";
export const PIVOT_BLANK_KEY = "__blank__";
export const PIVOT_BLANK_LABEL = "(Boş)";
const PATH_SEPARATOR = "␟";

export const PIVOT_DATE_INTERVALS: DataTablePivotDateInterval[] = [
  "year",
  "quarter",
  "month",
  "day",
  "hour",
];

export const PIVOT_INTERVAL_LABELS: Record<DataTablePivotDateInterval, string> = {
  year: "Yıl",
  quarter: "Çeyrek",
  month: "Ay",
  day: "Gün",
  hour: "Saat",
};

/** Tarih alani bir boyut alanina birakildiginda eklenen varsayilan kirilim. */
export const DEFAULT_DATE_HIERARCHY: DataTablePivotDateInterval[] = ["year", "month", "day"];

const MONTH_LABELS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

export type PivotField = {
  id: string;
  /** Gorunen ad (fieldLabels ile degistirilmis olabilir). */
  label: string;
  /** Veriden uretilen varsayilan ad; ad degistirilmisse `label`dan farklidir. */
  defaultLabel?: string;
  isNumeric: boolean;
  isDate: boolean;
  /** Kaynak kayittaki alan adi. */
  source: string;
  /** Tarih alt alani ise kirilim. */
  interval?: DataTablePivotDateInterval;
  /** Tarih alt alanlarinin ust (ham tarih) alani. */
  parentId?: string;
};

export const parsePivotFieldId = (id: string) => {
  const [source, interval] = id.split(PIVOT_INTERVAL_SEPARATOR);
  return {
    source,
    interval: PIVOT_DATE_INTERVALS.includes(interval as DataTablePivotDateInterval)
      ? (interval as DataTablePivotDateInterval)
      : undefined,
  };
};

export const pivotIntervalFieldId = (source: string, interval: DataTablePivotDateInterval) =>
  `${source}${PIVOT_INTERVAL_SEPARATOR}${interval}`;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;
const TR_DATE_PATTERN = /^(\d{2})\.(\d{2})\.(\d{4})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?$/;

/** Tarih degerini yerel saatle cozer; saat dilimi yoksa "2026-01-01" UTC sayilmaz. */
export function toPivotDate(value: unknown): Date | undefined {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  const iso = DATE_PATTERN.exec(text);
  if (iso) {
    if (iso[7]) {
      const date = new Date(text);
      return Number.isNaN(date.getTime()) ? undefined : date;
    }
    return new Date(+iso[1], +iso[2] - 1, +iso[3], +(iso[4] ?? 0), +(iso[5] ?? 0), +(iso[6] ?? 0));
  }
  const tr = TR_DATE_PATTERN.exec(text);
  if (tr) {
    return new Date(+tr[3], +tr[2] - 1, +tr[1], +(tr[4] ?? 0), +(tr[5] ?? 0), +(tr[6] ?? 0));
  }
  return undefined;
}

const hasTime = (date: Date) => date.getHours() !== 0 || date.getMinutes() !== 0;

/** Veriden pivot alanlarini cikarir; tarih alanlari icin Yil/Ceyrek/Ay/Gun/Saat alt alanlari ekler. */
export function detectPivotFields(
  data: readonly Record<string, any>[],
  options: { labels?: Record<string, string>; exclude?: string[]; formatLabel: (key: string) => string },
): PivotField[] {
  const sample = data.slice(0, 50);
  const first = data[0];
  const keys = first ? Object.keys(first) : Object.keys(options.labels ?? {});
  const fields: PivotField[] = [];
  keys
    .filter((key) => !options.exclude?.includes(key))
    .forEach((key) => {
      const label = options.labels?.[key] || options.formatLabel(key);
      const present = sample.map((record) => record[key]).filter((value) => value !== null && value !== undefined && value !== "");
      const isNumeric = present.length > 0 && present.every((value) => typeof value === "number" && Number.isFinite(value));
      const isDate = !isNumeric && present.length > 0 && present.every((value) => toPivotDate(value) !== undefined);
      fields.push({ id: key, label, isNumeric, isDate, source: key });
      if (isDate) {
        PIVOT_DATE_INTERVALS.forEach((interval) => {
          fields.push({
            id: pivotIntervalFieldId(key, interval),
            label: `${label} (${PIVOT_INTERVAL_LABELS[interval]})`,
            isNumeric: false,
            isDate: false,
            source: key,
            interval,
            parentId: key,
          });
        });
      }
    });
  return fields;
}

// ----------------------------------------------------------------------
// Boyut degerleri

export type PivotDimensionValue = { key: string; sort: number | string; label: string };

const BLANK_VALUE: PivotDimensionValue = {
  key: PIVOT_BLANK_KEY,
  sort: Number.POSITIVE_INFINITY,
  label: PIVOT_BLANK_LABEL,
};

const isBlank = (value: unknown) => value === null || value === undefined || value === "";

export type PivotValueMappers = Record<string, Record<string | number, string>>;

export function resolvePivotDimension(
  record: Record<string, any>,
  fieldId: string,
  valueMappers?: PivotValueMappers,
  dateFields?: ReadonlySet<string>,
): PivotDimensionValue {
  const { source, interval } = parsePivotFieldId(fieldId);
  const raw = record[source];
  if (isBlank(raw)) return BLANK_VALUE;

  if (interval || dateFields?.has(source)) {
    const date = toPivotDate(raw);
    if (!date) return { key: String(raw), sort: String(raw), label: String(raw) };
    switch (interval) {
      case "year":
        return { key: String(date.getFullYear()), sort: date.getFullYear(), label: String(date.getFullYear()) };
      case "quarter": {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        return { key: `Q${quarter}`, sort: quarter, label: `${quarter}. Çeyrek` };
      }
      case "month":
        return { key: `M${date.getMonth() + 1}`, sort: date.getMonth() + 1, label: MONTH_LABELS[date.getMonth()] };
      case "day":
        return { key: `D${date.getDate()}`, sort: date.getDate(), label: String(date.getDate()) };
      case "hour":
        return {
          key: `H${date.getHours()}`,
          sort: date.getHours(),
          label: `${String(date.getHours()).padStart(2, "0")}:00`,
        };
      default:
        return {
          key: String(date.getTime()),
          sort: date.getTime(),
          label: hasTime(date) ? date.toLocaleString("tr-TR") : date.toLocaleDateString("tr-TR"),
        };
    }
  }

  const mapped = valueMappers?.[source]?.[raw as string | number];
  if (typeof raw === "number") {
    return { key: String(raw), sort: raw, label: mapped ?? raw.toLocaleString("tr-TR") };
  }
  if (typeof raw === "boolean") {
    return { key: String(raw), sort: raw ? 1 : 0, label: mapped ?? (raw ? "Evet" : "Hayır") };
  }
  const text = String(raw);
  return { key: text, sort: text, label: mapped ?? text };
}

const compareSort = (a: number | string, b: number | string) => {
  // Bos deger (sort = Infinity) her zaman en sonda
  if (a === Number.POSITIVE_INFINITY) return b === a ? 0 : 1;
  if (b === Number.POSITIVE_INFINITY) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "number") return -1;
  if (typeof b === "number") return 1;
  return a.localeCompare(b, "tr-TR", { numeric: true, sensitivity: "base" });
};

/** filterValues degerini karsilastirma anahtarina cevirir. */
export const pivotFilterKey = (value: DataTablePivotFilterValue) =>
  isBlank(value) ? PIVOT_BLANK_KEY : String(value);

/** Bir alanin benzersiz degerleri (sirali, bos en sonda); filtre listesi icin. */
export function getPivotFieldValues(
  data: readonly Record<string, any>[],
  fieldId: string,
  valueMappers?: PivotValueMappers,
  dateFields?: ReadonlySet<string>,
): (PivotDimensionValue & { value: DataTablePivotFilterValue })[] {
  const { interval } = parsePivotFieldId(fieldId);
  const seen = new Map<string, PivotDimensionValue & { value: DataTablePivotFilterValue }>();
  data.forEach((record) => {
    const dimension = resolvePivotDimension(record, fieldId, valueMappers, dateFields);
    if (seen.has(dimension.key)) return;
    const raw = record[parsePivotFieldId(fieldId).source];
    const value: DataTablePivotFilterValue =
      dimension.key === PIVOT_BLANK_KEY
        ? null
        : interval || dateFields?.has(fieldId)
          ? dimension.key
          : (raw as DataTablePivotFilterValue);
    seen.set(dimension.key, { ...dimension, value });
  });
  return Array.from(seen.values()).sort((a, b) => compareSort(a.sort, b.sort));
}

export function applyPivotFilters<T extends Record<string, any>>(
  data: readonly T[],
  filterValues: DataTablePivotConfig<T>["filterValues"],
  valueMappers?: PivotValueMappers,
  dateFields?: ReadonlySet<string>,
): readonly T[] {
  const entries = Object.entries(filterValues ?? {})
    .filter((entry): entry is [string, DataTablePivotFilterValue[]] => Array.isArray(entry[1]))
    .map(([field, values]) => [field, new Set(values.map(pivotFilterKey))] as const);
  if (entries.length === 0) return data;
  return data.filter((record) =>
    entries.every(([field, allowed]) =>
      allowed.has(resolvePivotDimension(record, field, valueMappers, dateFields).key)));
}

// ----------------------------------------------------------------------
// Toplama

export type PivotAccumulator = { sum: number; count: number; min: number; max: number };

const emptyAccumulator = (): PivotAccumulator => ({
  sum: 0,
  count: 0,
  min: Number.POSITIVE_INFINITY,
  max: Number.NEGATIVE_INFINITY,
});

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const accumulate = (acc: PivotAccumulator, raw: unknown, aggregate: DataTablePivotAggregate) => {
  if (aggregate === "count") {
    if (!isBlank(raw)) acc.count += 1;
    return;
  }
  const value = toNumber(raw);
  if (value === undefined) return;
  acc.sum += value;
  acc.count += 1;
  if (value < acc.min) acc.min = value;
  if (value > acc.max) acc.max = value;
};

export const resolveAccumulator = (
  acc: PivotAccumulator | undefined,
  aggregate: DataTablePivotAggregate,
): number | null => {
  if (!acc || acc.count === 0) return null;
  switch (aggregate) {
    case "count":
      return acc.count;
    case "avg":
      return acc.sum / acc.count;
    case "min":
      return acc.min;
    case "max":
      return acc.max;
    default:
      return acc.sum;
  }
};

// ----------------------------------------------------------------------
// Model

export type PivotNode = {
  key: string;
  /** Kokten bu dugume kadar anahtarlar; kokte bos. */
  path: string;
  label: string;
  sort: number | string;
  depth: number;
  children: PivotNode[];
  childMap: Map<string, PivotNode>;
};

export type PivotModel = {
  rowFields: string[];
  columnFields: string[];
  values: DataTablePivotValue[];
  rowRoot: PivotNode;
  columnRoot: PivotNode;
  recordCount: number;
  getValue: (rowPath: string, columnPath: string, valueIndex: number) => number | null;
};

const createNode = (key: string, path: string, label: string, sort: number | string, depth: number): PivotNode => ({
  key,
  path,
  label,
  sort,
  depth,
  children: [],
  childMap: new Map(),
});

const sortTree = (node: PivotNode) => {
  node.children = Array.from(node.childMap.values()).sort((a, b) => compareSort(a.sort, b.sort));
  node.children.forEach(sortTree);
};

/** Dugumu ve tum ata yollarini (kok dahil) doner. */
const insertPath = (root: PivotNode, dimensions: PivotDimensionValue[]): string[] => {
  const paths = [root.path];
  let node = root;
  dimensions.forEach((dimension, index) => {
    let child = node.childMap.get(dimension.key);
    if (!child) {
      const path = node.path ? `${node.path}${PATH_SEPARATOR}${dimension.key}` : dimension.key;
      child = createNode(dimension.key, path, dimension.label, dimension.sort, index);
      node.childMap.set(dimension.key, child);
    }
    paths.push(child.path);
    node = child;
  });
  return paths;
};

export function buildPivotModel<T extends Record<string, any>>(
  data: readonly T[],
  config: DataTablePivotConfig<T>,
  options: { valueMappers?: PivotValueMappers; dateFields?: ReadonlySet<string> } = {},
): PivotModel {
  const { valueMappers, dateFields } = options;
  const rowFields = config.rows.map(String);
  const columnFields = config.columns.map(String);
  const values = config.values;
  const rowRoot = createNode("", "", "Genel Toplam", "", -1);
  const columnRoot = createNode("", "", "Genel Toplam", "", -1);
  const cells = new Map<string, PivotAccumulator[]>();
  const records = applyPivotFilters(data, config.filterValues, valueMappers, dateFields);

  records.forEach((record) => {
    const rowPaths = insertPath(
      rowRoot,
      rowFields.map((field) => resolvePivotDimension(record, field, valueMappers, dateFields)),
    );
    const columnPaths = insertPath(
      columnRoot,
      columnFields.map((field) => resolvePivotDimension(record, field, valueMappers, dateFields)),
    );
    rowPaths.forEach((rowPath) => {
      columnPaths.forEach((columnPath) => {
        const cellKey = `${rowPath}\u0001${columnPath}`;
        let accs = cells.get(cellKey);
        if (!accs) {
          accs = values.map(emptyAccumulator);
          cells.set(cellKey, accs);
        }
        values.forEach((value, index) => {
          accumulate(accs![index], record[parsePivotFieldId(value.field).source], value.aggregate);
        });
      });
    });
  });

  sortTree(rowRoot);
  sortTree(columnRoot);

  return {
    rowFields,
    columnFields,
    values,
    rowRoot,
    columnRoot,
    recordCount: records.length,
    getValue: (rowPath, columnPath, valueIndex) =>
      resolveAccumulator(cells.get(`${rowPath}\u0001${columnPath}`)?.[valueIndex], values[valueIndex]?.aggregate ?? "sum"),
  };
}

/** Alt dugumu olan tum yollar (Tumunu genislet icin). */
export function collectExpandablePaths(root: PivotNode): string[] {
  const paths: string[] = [];
  const walk = (node: PivotNode) => {
    node.children.forEach((child) => {
      if (child.children.length > 0) {
        paths.push(child.path);
        walk(child);
      }
    });
  };
  walk(root);
  return paths;
}

// ----------------------------------------------------------------------
// Yerlesim (DevExtreme "standard" duzeni)

export type PivotHeaderKind = "value" | "total" | "grand" | "data";

export type PivotHeaderCell = {
  id: string;
  label: string;
  kind: PivotHeaderKind;
  rowSpan: number;
  colSpan: number;
  /** Satir basliklarinda baslangic sutunu (sabitleme icin). */
  level: number;
  path?: string;
  expandable: boolean;
  expanded: boolean;
};

export type PivotRowLine = {
  id: string;
  path: string;
  kind: "value" | "total" | "grand";
  depth: number;
  headers: PivotHeaderCell[];
};

export type PivotLeafColumn = {
  id: string;
  path: string;
  kind: "value" | "total" | "grand";
  valueIndex: number;
};

export type PivotLayoutOptions = {
  expandedRows: ReadonlySet<string>;
  expandedColumns: ReadonlySet<string>;
  showRowTotals: boolean;
  showColumnTotals: boolean;
  showRowGrandTotals: boolean;
  showColumnGrandTotals: boolean;
  /**
   * true ise satir basligi sutunlari yalnizca acik olan en derin seviyeye kadar cizilir
   * (hicbir dugum acik degilse yalnizca ilk satir alani gorunur).
   */
  compactRowHeaders?: boolean;
};

/** Acik dugumlere gore gorunen satir seviyesi sayisi (en az 1). */
export function visibleRowDepth(root: PivotNode, expanded: ReadonlySet<string>): number {
  const walk = (node: PivotNode): number =>
    node.children.length > 0 && (node.depth < 0 || expanded.has(node.path))
      ? 1 + Math.max(0, ...node.children.map(walk))
      : 0;
  return Math.max(walk(root), 1);
}

export type PivotLayout = {
  rowHeaderDepth: number;
  rowLines: PivotRowLine[];
  columnHeaderRows: PivotHeaderCell[][];
  leafColumns: PivotLeafColumn[];
};

export const PIVOT_TOTAL_SUFFIX = "Toplam";

export function layoutPivot(
  model: PivotModel,
  options: PivotLayoutOptions,
  valueLabel: (value: DataTablePivotValue) => string,
): PivotLayout {
  const rowDepth = options.compactRowHeaders
    ? Math.min(visibleRowDepth(model.rowRoot, options.expandedRows), Math.max(model.rowFields.length, 1))
    : Math.max(model.rowFields.length, 1);
  const rowLines: PivotRowLine[] = [];

  const layoutRow = (node: PivotNode): PivotRowLine[] => {
    const level = node.depth;
    const hasChildren = node.children.length > 0;
    const expanded = hasChildren && options.expandedRows.has(node.path);
    const header: PivotHeaderCell = {
      id: `r:${node.path}`,
      label: node.label,
      kind: "value",
      rowSpan: 1,
      colSpan: expanded ? 1 : rowDepth - level,
      level,
      path: node.path,
      expandable: hasChildren,
      expanded,
    };
    if (!expanded) {
      return [{ id: `r:${node.path}`, path: node.path, kind: "value", depth: level, headers: [header] }];
    }
    const lines = node.children.flatMap(layoutRow);
    if (options.showRowTotals) {
      lines.push({
        id: `rt:${node.path}`,
        path: node.path,
        kind: "total",
        depth: level,
        headers: [{
          id: `rt:${node.path}`,
          label: `${node.label} ${PIVOT_TOTAL_SUFFIX}`,
          kind: "total",
          rowSpan: 1,
          colSpan: rowDepth - level,
          level,
          path: node.path,
          expandable: false,
          expanded: false,
        }],
      });
      header.rowSpan = lines.length - 1;
    } else {
      header.rowSpan = lines.length;
    }
    lines[0] = { ...lines[0], headers: [header, ...lines[0].headers] };
    return lines;
  };

  if (model.rowFields.length > 0) {
    model.rowRoot.children.forEach((child) => rowLines.push(...layoutRow(child)));
  }
  if (model.rowFields.length === 0 || options.showRowGrandTotals) {
    rowLines.push({
      id: "r:grand",
      path: "",
      kind: "grand",
      depth: 0,
      headers: [{
        id: "r:grand",
        label: "Genel Toplam",
        kind: "grand",
        rowSpan: 1,
        colSpan: rowDepth,
        level: 0,
        path: "",
        expandable: false,
        expanded: false,
      }],
    });
  }

  // Sutunlar
  const valueCount = Math.max(model.values.length, 1);
  const columnDepth = model.columnFields.length;
  const showValueRow = model.values.length > 1 || columnDepth === 0;
  const headerRowCount = columnDepth + (showValueRow ? 1 : 0);
  const columnHeaderRows: PivotHeaderCell[][] = Array.from({ length: headerRowCount }, () => []);
  const leaves: { path: string; kind: PivotLeafColumn["kind"] }[] = [];

  const layoutColumn = (node: PivotNode) => {
    const level = node.depth;
    const hasChildren = node.children.length > 0;
    const expanded = hasChildren && options.expandedColumns.has(node.path);
    const cell: PivotHeaderCell = {
      id: `c:${node.path}`,
      label: node.label,
      kind: "value",
      rowSpan: expanded ? 1 : columnDepth - level,
      colSpan: valueCount,
      level,
      path: node.path,
      expandable: hasChildren,
      expanded,
    };
    columnHeaderRows[level].push(cell);
    if (!expanded) {
      leaves.push({ path: node.path, kind: "value" });
      return;
    }
    const start = leaves.length;
    node.children.forEach(layoutColumn);
    if (options.showColumnTotals) {
      columnHeaderRows[level + 1].push({
        id: `ct:${node.path}`,
        label: `${node.label} ${PIVOT_TOTAL_SUFFIX}`,
        kind: "total",
        rowSpan: columnDepth - level - 1,
        colSpan: valueCount,
        level: level + 1,
        path: node.path,
        expandable: false,
        expanded: false,
      });
      leaves.push({ path: node.path, kind: "total" });
    }
    cell.colSpan = (leaves.length - start) * valueCount;
  };

  if (columnDepth > 0) {
    model.columnRoot.children.forEach(layoutColumn);
    if (options.showColumnGrandTotals) {
      columnHeaderRows[0].push({
        id: "c:grand",
        label: "Genel Toplam",
        kind: "grand",
        rowSpan: columnDepth,
        colSpan: valueCount,
        level: 0,
        path: "",
        expandable: false,
        expanded: false,
      });
      leaves.push({ path: "", kind: "grand" });
    }
  } else {
    leaves.push({ path: "", kind: "grand" });
  }

  if (showValueRow) {
    const valueRow = columnHeaderRows[headerRowCount - 1];
    leaves.forEach((leaf) => {
      model.values.forEach((value, valueIndex) => {
        valueRow.push({
          id: `d:${leaf.kind}:${leaf.path}:${valueIndex}`,
          label: valueLabel(value),
          kind: "data",
          rowSpan: 1,
          colSpan: 1,
          level: columnDepth,
          path: leaf.path,
          expandable: false,
          expanded: false,
        });
      });
    });
  }

  const leafColumns = leaves.flatMap((leaf) =>
    model.values.map((_, valueIndex) => ({
      id: `${leaf.kind}:${leaf.path}:${valueIndex}`,
      path: leaf.path,
      kind: leaf.kind,
      valueIndex,
    })));

  return { rowHeaderDepth: rowDepth, rowLines, columnHeaderRows, leafColumns };
}

/** fieldLabels ile verilen gorunen adlari alanlara uygular; varsayilan ad `defaultLabel`da saklanir. */
export function applyPivotFieldLabels(
  fields: PivotField[],
  fieldLabels: Partial<Record<string, string>> | undefined,
): PivotField[] {
  if (!fieldLabels || Object.keys(fieldLabels).length === 0) return fields;
  return fields.map((field) => {
    const custom = fieldLabels[field.id]?.trim();
    return custom ? { ...field, label: custom, defaultLabel: field.label } : field;
  });
}
