import * as XLSX from "xlsx";

import type { PivotHeaderCell, PivotLayout, PivotModel } from "./pivotEngine";

type MatrixCell = { value: string | number; rowSpan: number; colSpan: number };

/**
 * Pivot yerlesimini HTML tablo mantigiyla (rowSpan/colSpan) iki boyutlu diziye cevirir.
 * Birlesik hucreler Excel'de de birlestirilir.
 */
export function buildPivotMatrix(
  model: PivotModel,
  layout: PivotLayout,
  labels: { rowFieldLabels: string[]; cornerLabel: string },
) {
  const headerRowCount = layout.columnHeaderRows.length;
  const rows: MatrixCell[][] = [];

  layout.columnHeaderRows.forEach((headerRow, index) => {
    const cells: MatrixCell[] = [];
    const isLast = index === headerRowCount - 1;
    if (index === 0 && headerRowCount > 1) {
      cells.push({ value: labels.cornerLabel, rowSpan: headerRowCount - 1, colSpan: layout.rowHeaderDepth });
    }
    if (isLast) {
      for (let level = 0; level < layout.rowHeaderDepth; level += 1) {
        cells.push({ value: labels.rowFieldLabels[level] ?? "", rowSpan: 1, colSpan: 1 });
      }
    }
    headerRow.forEach((cell: PivotHeaderCell) =>
      cells.push({ value: cell.label, rowSpan: cell.rowSpan, colSpan: cell.colSpan }));
    rows.push(cells);
  });

  layout.rowLines.forEach((line) => {
    const cells: MatrixCell[] = line.headers.map((cell) => ({
      value: cell.label,
      rowSpan: cell.rowSpan,
      colSpan: cell.colSpan,
    }));
    layout.leafColumns.forEach((column) => {
      const value = model.getValue(line.path, column.path, column.valueIndex);
      cells.push({ value: value ?? "", rowSpan: 1, colSpan: 1 });
    });
    rows.push(cells);
  });

  // Dolu hucreleri takip ederek her hucrenin gercek sutununu bul
  const width = layout.rowHeaderDepth + layout.leafColumns.length;
  const occupied = rows.map(() => new Array<boolean>(width).fill(false));
  const aoa: (string | number)[][] = rows.map(() => new Array<string | number>(width).fill(""));
  const merges: XLSX.Range[] = [];

  rows.forEach((cells, rowIndex) => {
    let column = 0;
    cells.forEach((cell) => {
      while (column < width && occupied[rowIndex][column]) column += 1;
      aoa[rowIndex][column] = cell.value;
      for (let r = rowIndex; r < rowIndex + cell.rowSpan && r < rows.length; r += 1) {
        for (let c = column; c < column + cell.colSpan && c < width; c += 1) occupied[r][c] = true;
      }
      if (cell.rowSpan > 1 || cell.colSpan > 1) {
        merges.push({
          s: { r: rowIndex, c: column },
          e: { r: rowIndex + cell.rowSpan - 1, c: column + cell.colSpan - 1 },
        });
      }
      column += cell.colSpan;
    });
  });

  return { aoa, merges, width };
}

export function exportPivotToExcel(
  model: PivotModel,
  layout: PivotLayout,
  labels: { rowFieldLabels: string[]; cornerLabel: string },
  filename: string,
) {
  const { aoa, merges, width } = buildPivotMatrix(model, layout, labels);
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet["!merges"] = merges;
  worksheet["!cols"] = Array.from({ length: width }, (_, index) => ({
    wch: Math.min(Math.max(...aoa.map((row) => String(row[index] ?? "").length), 8) + 2, 40),
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Pivot");
  XLSX.writeFile(workbook, filename);
}

export function exportRecordsToExcel(
  records: readonly Record<string, any>[],
  columns: { id: string; label: string }[],
  filename: string,
) {
  const aoa = [
    columns.map((column) => column.label),
    ...records.map((record) =>
      columns.map((column) => {
        const value = record[column.id];
        if (value === null || value === undefined) return "";
        if (typeof value === "boolean") return value ? "Evet" : "Hayır";
        return value instanceof Date ? value.toISOString() : value;
      })),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Veri");
  XLSX.writeFile(workbook, filename);
}
