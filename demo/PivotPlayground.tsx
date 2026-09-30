import { useEffect, useMemo, useState } from "react";

import { DataTable, type DataTablePivotConfig, type NotifyType } from "modern-dt-pro";
import {
  COLUMN_LABELS,
  VALUE_MAPPERS,
  createPivotDemoRows,
  type DemoRow,
} from "./data";

type PivotPlaygroundProps = {
  onNotify: (type: NotifyType, message: string) => void;
};

const ROW_COUNTS = [60, 240, 1000, 5000] as const;

const INITIAL_PIVOT: DataTablePivotConfig<DemoRow> = {
  rows: ["department", "category"],
  columns: ["createdAt::year", "createdAt::quarter"],
  values: [{ field: "total", aggregate: "sum" }],
};

const quote = (items: readonly string[]) => items.map((item) => `"${item}"`).join(", ");

function buildPivotCode(pivot: DataTablePivotConfig<DemoRow>) {
  const values = pivot.values
    .map((value) =>
      `      { field: "${value.field}", aggregate: "${value.aggregate}"${value.label ? `, label: ${JSON.stringify(value.label)}` : ""}${value.numberFormat ? `, numberFormat: ${JSON.stringify(value.numberFormat)}` : ""}${value.cellStyles ? `, cellStyles: ${JSON.stringify(value.cellStyles)}` : ""} },`)
    .join("\n");
  const lines = [
    'import { DataTable } from "modern-dt-pro";',
    "",
    "<DataTable",
    "  data={rows}",
    '  title="Pivot Playground"',
    "  columnLabels={COLUMN_LABELS}",
    "  valueMappers={VALUE_MAPPERS}",
    "  pivot={{",
    `    rows: [${quote(pivot.rows.map(String))}],`,
    `    columns: [${quote(pivot.columns.map(String))}],`,
    "    values: [",
    ...(values ? [values] : []),
    "    ],",
    ...(pivot.filters?.length ? [`    filters: [${quote(pivot.filters.map(String))}],`] : []),
    ...(Object.keys(pivot.filterValues ?? {}).length
      ? [`    filterValues: ${JSON.stringify(pivot.filterValues)},`]
      : []),
    ...(["showRowTotals", "showColumnTotals", "showRowGrandTotals", "showColumnGrandTotals"] as const)
      .filter((key) => pivot[key] === false)
      .map((key) => `    ${key}: false,`),
    ...(pivot.numberFormat ? [`    numberFormat: ${JSON.stringify(pivot.numberFormat)},`] : []),
    ...(pivot.cellStyles ? [`    cellStyles: ${JSON.stringify(pivot.cellStyles)},`] : []),
    ...(Object.keys(pivot.fieldLabels ?? {}).length
      ? [`    fieldLabels: ${JSON.stringify(pivot.fieldLabels)},`]
      : []),
    ...(pivot.conditions?.length
      ? [
        "    conditions: [",
        ...pivot.conditions.map((condition) => {
          const { id: _id, ...rest } = condition;
          return `      ${JSON.stringify(rest)},`;
        }),
        "    ],",
      ]
      : []),
    "  }}",
    "  onPivotChange={setPivot}",
    "/>",
  ];
  return lines.join("\n");
}

export function PivotPlayground({ onNotify }: PivotPlaygroundProps) {
  const [rowCount, setRowCount] = useState<number>(240);
  const rows = useMemo(() => createPivotDemoRows(rowCount), [rowCount]);
  // Kayit sayisi degisince tablo demo verisine doner
  useEffect(() => setImportedCount(null), [rows]);
  const [pivot, setPivot] = useState<DataTablePivotConfig<DemoRow>>(INITIAL_PIVOT);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);

  const code = buildPivotCode(pivot);
  const filteredFieldCount = Object.keys(pivot.filterValues ?? {}).length;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="card playground-card pv-card">
      <div className="card-head">
        <div>
          <h2>Pivot Playground</h2>
          <p className="desc">
            Veri düğmesiyle kendi JSON listeni yükle, Pivot düğmesiyle alanları seç. +/− ile grupları aç/kapat.
          </p>
        </div>
        <div className="pv-head-actions">
          <label className="pg-chip">
            <span>Kayıt</span>
            <select
              className="pv-inline-select"
              value={rowCount}
              onChange={(event) => setRowCount(Number(event.target.value))}
            >
              {ROW_COUNTS.map((count) => (
                <option key={count} value={count}>{count.toLocaleString("tr-TR")}</option>
              ))}
            </select>
          </label>
          <button type="button" className="pg-chip" onClick={() => setPivot(INITIAL_PIVOT)}>
            Sıfırla
          </button>
          <button
            type="button"
            className={showCode ? "pg-code-btn active" : "pg-code-btn"}
            onClick={() => setShowCode((value) => !value)}
          >
            Code
          </button>
        </div>
      </div>

      {showCode ? (
        <div className="playground-preview playground-preview--code">
          <div className="demo-code-toolbar">
            <button type="button" onClick={() => void copyCode()}>
              {copied ? "Kopyalandı" : "Kopyala"}
            </button>
          </div>
          <pre className="playground-code playground-code--panel">
            <code>{code}</code>
          </pre>
        </div>
      ) : (
        <div className="playground-preview pv-preview">
          <DataTable
            data={rows}
            title="Pivot Playground"
            columnLabels={COLUMN_LABELS}
            valueMappers={VALUE_MAPPERS}
            pivot={pivot}
            onPivotChange={setPivot}
            enablePivotDataImport
            onPivotDataImport={(imported) => setImportedCount(imported.length)}
            initialPageSize={50}
            onNotify={onNotify}
          />
        </div>
      )}

      {!showCode ? (
        <div className="output">
          Kaynak kayıt: {(importedCount ?? rows.length).toLocaleString("tr-TR")}
          {importedCount !== null ? " (yüklenen veri)" : ""} · Satır boyutu: {pivot.rows.length} ·
          Sütun boyutu: {pivot.columns.length} · Değer: {pivot.values.length}
          {filteredFieldCount > 0 ? ` · Filtreli alan: ${filteredFieldCount}` : ""}
        </div>
      ) : null}
    </section>
  );
}
