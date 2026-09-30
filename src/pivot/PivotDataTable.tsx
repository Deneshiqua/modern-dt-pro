import { useCallback, useEffect, useMemo, useState } from "react";

import type { DataTablePivotConfig, DataTableProps } from "../types";
import { formatColumnHeader } from "../utils/formatCellValue";
import { applyPivotFieldLabels, detectPivotFields } from "./pivotEngine";
import { PivotGrid } from "./PivotGrid";

type PivotDataTableProps<T> = DataTableProps<T> & {
  pivot: DataTablePivotConfig<T>;
};

const EMPTY_DATA: never[] = [];

/** `pivot` verildiginde DataTable'in yerine cizilen pivot izgarasi. */
export function PivotDataTable<T extends Record<string, any>>({
  pivot: pivotProp,
  onPivotChange,
  enablePivotPanel = true,
  defaultPivotFieldPanel = false,
  enablePivotDataImport = false,
  onPivotDataImport,
  defaultPivotToolbar,
  data,
  title,
  className,
  maxHeight,
  emptyMessage,
  columnLabels,
  valueMappers,
  excludeColumns,
  toolbarExtra,
  enableExcelExport = true,
  defaultViewSettings,
  onNotify,
}: PivotDataTableProps<T>) {
  const [pivot, setPivot] = useState(pivotProp);
  // Satir ici nesne literal'leri her render'da yeni referans uretir; yalnizca icerik degisince sifirla.
  const pivotPropKey = JSON.stringify(pivotProp);
  useEffect(() => setPivot(pivotProp), [pivotPropKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePivotChange = useCallback(
    (next: DataTablePivotConfig<any>) => {
      setPivot(next as DataTablePivotConfig<T>);
      onPivotChange?.(next as DataTablePivotConfig<T>);
    },
    [onPivotChange],
  );

  // "Veri" dugmesiyle yuklenen liste; data prop'u degisirse ona geri donulur
  const [importedData, setImportedData] = useState<Record<string, unknown>[] | null>(null);
  useEffect(() => setImportedData(null), [data]);

  const handleDataImport = useCallback(
    (rows: Record<string, unknown>[]) => {
      setImportedData(rows);
      // Eski alanlar yeni veride olmayabilir: ayarlari sifirla, gorunum tercihlerini koru
      handlePivotChange({
        rows: [],
        columns: [],
        values: [],
        filters: [],
        filterValues: {},
        expandedRows: [],
        expandedColumns: [],
        conditions: [],
        fieldLabels: {},
        showRowTotals: pivot.showRowTotals,
        showColumnTotals: pivot.showColumnTotals,
        showRowGrandTotals: pivot.showRowGrandTotals,
        showColumnGrandTotals: pivot.showColumnGrandTotals,
      });
      onPivotDataImport?.(rows);
    },
    [handlePivotChange, onPivotDataImport, pivot],
  );

  const sourceData: readonly Record<string, any>[] = importedData ?? data ?? EMPTY_DATA;
  const detectedFields = useMemo(
    () => detectPivotFields(sourceData, {
      labels: columnLabels,
      exclude: excludeColumns?.map(String),
      formatLabel: formatColumnHeader,
    }),
    [sourceData, columnLabels, excludeColumns],
  );
  // Kullanicinin verdigi gorunen adlar (fieldLabels) tum pivot arayuzune yansir
  const fields = useMemo(
    () => applyPivotFieldLabels(detectedFields, pivot.fieldLabels),
    [detectedFields, pivot.fieldLabels],
  );
  const dateFields = useMemo(
    () => new Set(detectedFields.filter((field) => field.isDate).map((field) => field.id)),
    [detectedFields],
  );

  return (
    <PivotGrid
      data={sourceData}
      config={pivot}
      onConfigChange={handlePivotChange}
      fields={fields}
      dateFields={dateFields}
      valueMappers={valueMappers}
      title={title}
      className={className}
      maxHeight={maxHeight}
      emptyMessage={emptyMessage}
      toolbarExtra={toolbarExtra}
      enableFieldChooser={enablePivotPanel}
      enableExport={enableExcelExport}
      onDataImport={enablePivotDataImport ? handleDataImport : undefined}
      defaultViewSettings={{
        fullScreen: defaultViewSettings?.fullScreen ?? false,
        rowDense: defaultViewSettings?.rowDense ?? false,
        showTitle: defaultViewSettings?.showTitle ?? false,
        fieldPanel: defaultPivotFieldPanel,
        toolbar: {
          data: defaultPivotToolbar?.data ?? true,
          configuration: defaultPivotToolbar?.configuration ?? true,
          fieldChooser: defaultPivotToolbar?.fieldChooser ?? true,
          cellStyles: defaultPivotToolbar?.cellStyles ?? true,
          numberFormat: defaultPivotToolbar?.numberFormat ?? true,
          conditions: defaultPivotToolbar?.conditions ?? true,
        },
      }}
      onNotify={onNotify}
    />
  );
}
