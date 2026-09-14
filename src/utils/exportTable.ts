import type { Row, Table as TanstackTable } from "@tanstack/react-table";
import * as XLSX from "xlsx";

import type { ExportMode, ExportOptions, ExportScope } from "../types";
import { isRemoteGroupPlaceholder } from "../data-source/remoteGroups";

export const buildExportFilename = (title: string | undefined, extension: string): string => {
  const base = (title || "tablo")
    .trim()
    .replace(/[^\wÀ-ɏ.-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "tablo";
  const date = new Date().toISOString().split("T")[0];
  return `${base}-${date}.${extension}`;
};

export const getExportableColumns = <T,>(table: TanstackTable<T>, mode: ExportMode) => {
  // Ham data: gizlenmis kolonlar dahil tum kolonlar
  // Tablo gorunumu: sadece gorunen kolonlar
  const columns =
    mode === "raw" ? table.getAllLeafColumns() : table.getVisibleLeafColumns();
  return columns.filter((col) => col.id !== "select");
};

export const getExportableRows = <T,>(table: TanstackTable<T>, scope: ExportScope) => {
  const sourceRows =
    scope === "selected"
      ? table.getSelectedRowModel().flatRows
      : table.getFilteredRowModel().rows;

  return sourceRows.filter(
    (row) => !row.getIsGrouped()
      && !isRemoteGroupPlaceholder(row.original),
  );
};

export const getColumnHeader = <T,>(table: TanstackTable<T>, columnId: string): string => {
  const column = table.getAllLeafColumns().find((col) => col.id === columnId);
  const header = column?.columnDef.header;
  return typeof header === "string" ? header : columnId;
};

export const getExportPropertyKey = <T,>(
  table: TanstackTable<T>,
  columnId: string,
  mode: ExportMode,
): string => (mode === "table" ? getColumnHeader(table, columnId) : columnId);

export const resolveExportCellValue = <T,>(
  row: Row<T>,
  columnId: string,
  mode: ExportMode,
  valueMappers?: Record<string, Record<string | number, string>>,
): unknown => {
  const rawValue = row.getValue(columnId);
  if (mode !== "table" || rawValue === null || rawValue === undefined) {
    return rawValue ?? null;
  }

  const mapped = valueMappers?.[columnId]?.[rawValue as string | number];
  return mapped ?? rawValue;
};

export const normalizeExportCellValue = (value: unknown): string | number | boolean => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? "Evet" : "Hayır";
  return value as string | number | boolean;
};

export const exportTableToExcel = <T,>(
  table: TanstackTable<T>,
  filename: string,
  options: ExportOptions,
) => {
  const rows = getExportableRows(table, options.scope);
  const columns = getExportableColumns(table, options.mode);
  const headers = columns.map((col) => getExportPropertyKey(table, col.id, options.mode));
  const data = rows.map((row) =>
    columns.map((col) =>
      normalizeExportCellValue(
        resolveExportCellValue(row, col.id, options.mode, options.valueMappers),
      ),
    ),
  );

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
  worksheet["!cols"] = headers.map((header, index) => ({
    wch: Math.min(
      Math.max(
        String(header).length,
        ...data.map((row) => String(row[index] ?? "").length)
      ) + 2,
      50
    ),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Veri");
  XLSX.writeFile(workbook, filename);
};

export const exportTableToJson = <T,>(
  table: TanstackTable<T>,
  filename: string,
  options: ExportOptions,
) => {
  const rows = getExportableRows(table, options.scope);
  const columns = getExportableColumns(table, options.mode);
  const payload = rows.map((row) => {
    const item: Record<string, unknown> = {};
    columns.forEach((col) => {
      item[getExportPropertyKey(table, col.id, options.mode)] = resolveExportCellValue(
        row,
        col.id,
        options.mode,
        options.valueMappers,
      );
    });
    return item;
  });

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8;",
  });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const EXPORT_MENU_SECTIONS: Array<{
  scope: ExportScope;
  title: string;
  items: Array<{ mode: ExportMode }>;
}> = [
  {
    scope: "selected",
    title: "Seçileni İndir",
    items: [{ mode: "table" }, { mode: "raw" }],
  },
  {
    scope: "all",
    title: "Tümü İndir",
    items: [{ mode: "table" }, { mode: "raw" }],
  },
];
