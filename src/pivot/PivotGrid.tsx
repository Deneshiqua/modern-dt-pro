import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from "@headlessui/react";
import {
  AdjustmentsHorizontalIcon,
  ArrowDownTrayIcon,
  ChevronDoubleDownIcon,
  ChevronDoubleUpIcon,
  ExclamationTriangleIcon,
  MinusIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

import { Button, Card } from "../ui";
import { Switch } from "../ui/Switch";
import type {
  DataTablePivotToolbarButton,
  DataTablePivotCellStyles,
  DataTablePivotCondition,
  DataTablePivotConfig,
  DataTablePivotValue,
} from "../types";
import type { NotifyFn } from "../utils/notify";
import { notify } from "../utils/notify";
import { buildExportFilename } from "../utils/exportTable";
import {
  applyPivotFilters,
  buildPivotModel,
  collectExpandablePaths,
  layoutPivot,
  type PivotField,
  type PivotHeaderCell,
  type PivotLeafColumn,
  type PivotRowLine,
  type PivotValueMappers,
} from "./pivotEngine";
import { exportPivotToExcel, exportRecordsToExcel } from "./exportPivot";
import { PIVOT_AGGREGATE_LABELS, PivotFieldChooser, usePivotAreas } from "./PivotFieldChooser";
import { PivotFieldPanel, PivotZoneContent, pivotZoneProps } from "./PivotFieldPanel";
import { PivotConditionsButton } from "./PivotConditionsDialog";
import { PivotDataButton } from "./PivotDataDialog";
import { PivotConfigButton } from "./PivotConfigDialog";
import { validatePivotConfig } from "./pivotValidation";
import { resolvePivotCellStyle } from "./pivotConditions";
import { PivotNumberFormatButton } from "./PivotNumberFormatDialog";
import { PivotCellStylesButton } from "./PivotCellStylesDialog";
import {
  pivotAlternateColumns,
  pivotCellColor,
  pivotCellKind,
  pivotColorStyle,
  resolvePivotCellStyles,
} from "./pivotCellStyles";
import {
  createPivotValueFormatter,
  pivotNumberAlignStyle,
  resolvePivotNumberFormat,
} from "./pivotNumberFormat";

type Config = DataTablePivotConfig<any>;

export type PivotViewSettings = {
  fullScreen: boolean;
  rowDense: boolean;
  showTitle: boolean;
  fieldPanel: boolean;
  /** Arac cubugu dugmelerinin gorunurlugu. */
  toolbar: Record<DataTablePivotToolbarButton, boolean>;
};

const TOOLBAR_SWITCHES: { key: DataTablePivotToolbarButton; label: string }[] = [
  { key: "data", label: "Veri" },
  { key: "configuration", label: "Yapılandırma" },
  { key: "fieldChooser", label: "Pivot (Alan Seçici)" },
  { key: "cellStyles", label: "Hücre Renkleri" },
  { key: "numberFormat", label: "Sayı Biçimi" },
  { key: "conditions", label: "Koşullu Biçimlendirme" },
];

export type PivotGridProps = {
  data: readonly Record<string, any>[];
  config: Config;
  onConfigChange: (config: Config) => void;
  fields: PivotField[];
  dateFields: ReadonlySet<string>;
  valueMappers?: PivotValueMappers;
  title?: string;
  className?: string;
  maxHeight?: string;
  emptyMessage?: string;
  toolbarExtra?: ReactNode;
  enableFieldChooser: boolean;
  enableExport: boolean;
  /** Verilirse arac cubugunda "Veri" dugmesi cikar; yapistirilan JSON listesiyle cagrilir. */
  onDataImport?: (rows: Record<string, unknown>[]) => void;
  defaultViewSettings: PivotViewSettings;
  onNotify?: NotifyFn;
};

const ROW_HEADER_WIDTH = 176;
const DENSE_ROW_HEADER_WIDTH = 148;
const HEADER_ROW_HEIGHT = 36;
const DENSE_HEADER_ROW_HEIGHT = 30;
/** Alan paneli izgaraya yerlestiginde basliklarda cip sigacak yukseklik. */
const PANEL_ROW_HEIGHT = 44;
const DENSE_PANEL_ROW_HEIGHT = 40;

export function PivotGrid({
  data,
  config,
  onConfigChange,
  fields,
  dateFields,
  valueMappers,
  title,
  className,
  maxHeight,
  emptyMessage = "Gösterilecek veri yok",
  toolbarExtra,
  enableFieldChooser,
  enableExport,
  onDataImport,
  defaultViewSettings,
  onNotify,
}: PivotGridProps) {
  const [view, setView] = useState<PivotViewSettings>(defaultViewSettings);
  const updateView = (patch: Partial<PivotViewSettings>) => setView((current) => ({ ...current, ...patch }));

  useEffect(() => {
    if (!view.fullScreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") updateView({ fullScreen: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view.fullScreen]);

  const labelOf = useCallback(
    (id: string) => fields.find((field) => field.id === id)?.label ?? id,
    [fields],
  );
  const valueLabel = useCallback(
    (value: DataTablePivotValue) =>
      value.label ?? `${labelOf(value.field)} (${PIVOT_AGGREGATE_LABELS[value.aggregate]})`,
    [labelOf],
  );

  // Beklenmedik veri tablonun cokmesine yol acmasin: hata mesaji gosterilir, izgara bos cizilir
  const { model, modelError } = useMemo(() => {
    try {
      return { model: buildPivotModel(data, config, { valueMappers, dateFields }), modelError: undefined };
    } catch (error) {
      return {
        model: buildPivotModel([], { rows: [], columns: [], values: [] }),
        modelError: error instanceof Error ? error.message : String(error),
      };
    }
  }, [data, config.rows, config.columns, config.values, config.filterValues, valueMappers, dateFields]); // eslint-disable-line react-hooks/exhaustive-deps

  const issues = useMemo(() => {
    const found = validatePivotConfig(config, fields, model);
    return modelError
      ? [{ level: "error" as const, message: `Pivot hesaplanamadı: ${modelError}` }, ...found]
      : found;
  }, [config, fields, model, modelError]);
  const errors = issues.filter((issue) => issue.level === "error");

  const [chooserOpen, setChooserOpen] = useState(false);

  // Sayi bicimi: varsayilan bicim + veri alanina ozel bicim
  const valueFormatters = useMemo(
    () => config.values.map((value) => createPivotValueFormatter(config.numberFormat, value)),
    [config.values, config.numberFormat],
  );
  const valueCellStyles = useMemo(
    () => config.values.map((value) => resolvePivotCellStyles(config.cellStyles, value)),
    [config.values, config.cellStyles],
  );
  const valueAlignStyles = useMemo(
    () => config.values.map((value) => pivotNumberAlignStyle(resolvePivotNumberFormat(config.numberFormat, value))),
    [config.values, config.numberFormat],
  );

  const expandedRows = useMemo(() => new Set(config.expandedRows ?? []), [config.expandedRows]);
  const expandedColumns = useMemo(() => new Set(config.expandedColumns ?? []), [config.expandedColumns]);

  const layout = useMemo(
    () => layoutPivot(
      model,
      {
        expandedRows,
        expandedColumns,
        showRowTotals: config.showRowTotals ?? true,
        showColumnTotals: config.showColumnTotals ?? true,
        showRowGrandTotals: config.showRowGrandTotals ?? true,
        showColumnGrandTotals: config.showColumnGrandTotals ?? true,
        // Alan paneli kapaliyken acilmamis seviyelerin bos sutunlari gosterilmez
        compactRowHeaders: !view.fieldPanel,
      },
      valueLabel,
    ),
    [model, expandedRows, expandedColumns, config.showRowTotals, config.showColumnTotals, config.showRowGrandTotals, config.showColumnGrandTotals, valueLabel, view.fieldPanel],
  );

  // Veri sutunlari sirayla 1. ve 2. renkle boyanir (toplam sutunlari sayilmaz)
  const alternateColumns = useMemo(
    () => pivotAlternateColumns(layout.leafColumns.map((column) => column.kind)),
    [layout.leafColumns],
  );

  const toggleRow = (path: string) => {
    const next = new Set(expandedRows);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    onConfigChange({ ...config, expandedRows: Array.from(next) });
  };
  const toggleColumn = (path: string) => {
    const next = new Set(expandedColumns);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    onConfigChange({ ...config, expandedColumns: Array.from(next) });
  };
  const expandAll = () =>
    onConfigChange({
      ...config,
      expandedRows: collectExpandablePaths(model.rowRoot),
      expandedColumns: collectExpandablePaths(model.columnRoot),
    });
  const collapseAll = () => onConfigChange({ ...config, expandedRows: [], expandedColumns: [] });

  const rowFieldLabels = model.rowFields.map(labelOf);
  const cornerLabel = config.values.length === 1 ? valueLabel(config.values[0]) : "";

  const handleExport = (kind: "pivot" | "raw") => {
    try {
      if (kind === "pivot") {
        exportPivotToExcel(model, layout, { rowFieldLabels, cornerLabel }, buildExportFilename(title ?? "pivot", "xlsx"));
      } else {
        const records = applyPivotFilters(data, config.filterValues, valueMappers, dateFields);
        const columns = fields.filter((field) => !field.parentId).map((field) => ({ id: field.id, label: field.label }));
        exportRecordsToExcel(records, columns, buildExportFilename(title ?? "veri", "xlsx"));
      }
      notify("success", "Excel dosyası indirildi", onNotify);
    } catch {
      notify("error", "Excel dosyası oluşturulamadı", onNotify);
    }
  };

  const areas = usePivotAreas({ config, fields, data, valueMappers, dateFields, onChange: onConfigChange });
  const panelInGrid = view.fieldPanel;
  const rowHeaderWidth = view.rowDense ? DENSE_ROW_HEADER_WIDTH : ROW_HEADER_WIDTH;
  const tableRef = useRef<HTMLTableElement>(null);
  const rowHeaderOffsets = useRowHeaderOffsets(tableRef, [layout, view.rowDense, view.fieldPanel]);
  // Satir basligi sutunlari icerige gore genisleyebilir; yapisik sol konumlar olculen genisliklerden gelir.
  const leftOf = (level: number) => rowHeaderOffsets?.[level] ?? level * rowHeaderWidth;
  const headerRowHeight = panelInGrid
    ? (view.rowDense ? DENSE_PANEL_ROW_HEIGHT : PANEL_ROW_HEIGHT)
    : (view.rowDense ? DENSE_HEADER_ROW_HEIGHT : HEADER_ROW_HEIGHT);
  const zoneRowHeight = panelInGrid ? headerRowHeight : 0;
  const hasValues = config.values.length > 0;
  const hasData = model.recordCount > 0;
  const canRenderGrid = hasValues && hasData;
  const rowChips = panelInGrid ? areas.renderChips("rows") : [];
  const expandableCount = collectExpandablePaths(model.rowRoot).length + collectExpandablePaths(model.columnRoot).length;

  return (
    <div
      className={clsx(
        "dtp flex min-h-0 flex-1 flex-col",
        view.fullScreen ? "fixed inset-0 z-[80] bg-white p-4 dark:bg-dark-900" : "h-full",
        className,
      )}
    >
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="dark:border-dark-500 flex flex-shrink-0 items-center gap-2 border-b border-gray-200 px-3 py-2">
          {title && view.showTitle ? (
            <h3 className="dark:text-dark-100 truncate text-sm font-medium tracking-wide text-gray-700">{title}</h3>
          ) : null}
          <span className="dark:text-dark-300 text-xs text-gray-500">
            {model.recordCount.toLocaleString("tr-TR")} kayıt
          </span>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="flat"
              isIcon
              className="size-8 rounded-full"
              title="Tümünü genişlet"
              aria-label="Tümünü genişlet"
              disabled={expandableCount === 0}
              onClick={expandAll}
            >
              <ChevronDoubleDownIcon className="size-4.5" />
            </Button>
            <Button
              variant="flat"
              isIcon
              className="size-8 rounded-full"
              title="Tümünü daralt"
              aria-label="Tümünü daralt"
              disabled={expandedRows.size === 0 && expandedColumns.size === 0}
              onClick={collapseAll}
            >
              <ChevronDoubleUpIcon className="size-4.5" />
            </Button>
            {enableExport ? (
              <PivotExportMenu disabled={!hasData || !hasValues} onExport={handleExport} />
            ) : null}
            {view.toolbar.cellStyles ? <PivotCellStylesButton
              cellStyles={config.cellStyles}
              values={config.values}
              valueLabel={valueLabel}
              onApply={(cellStyles, perValue) =>
                onConfigChange({
                  ...config,
                  cellStyles,
                  values: config.values.map((value, index) => ({ ...value, cellStyles: perValue[index] })),
                })}
            /> : null}
            {view.toolbar.numberFormat ? <PivotNumberFormatButton
              numberFormat={config.numberFormat}
              values={config.values}
              valueLabel={valueLabel}
              onApply={(numberFormat, perValue) =>
                onConfigChange({
                  ...config,
                  numberFormat,
                  values: config.values.map((value, index) => ({ ...value, numberFormat: perValue[index] })),
                })}
            /> : null}
            {view.toolbar.conditions ? <PivotConditionsButton
              conditions={config.conditions ?? []}
              values={config.values}
              valueLabel={valueLabel}
              onChange={(conditions) => onConfigChange({ ...config, conditions })}
            /> : null}
            {onDataImport && view.toolbar.data ? (
              <PivotDataButton
                onApply={(rows) => {
                  onDataImport(rows);
                  notify("success", `${rows.length.toLocaleString("tr-TR")} kayıt yüklendi; alanları seçin`, onNotify);
                  setChooserOpen(true);
                }}
              />
            ) : null}
            {view.toolbar.configuration ? <PivotConfigButton
              config={config}
              fields={fields}
              onNotify={(type, message) => notify(type, message, onNotify)}
              onApply={(shareable) =>
                onConfigChange({
                  ...config,
                  ...shareable,
                  // JSON'da olmayan toplam secenekleri varsayilana (acik) doner
                  showRowTotals: shareable.showRowTotals,
                  showColumnTotals: shareable.showColumnTotals,
                  showRowGrandTotals: shareable.showRowGrandTotals,
                  showColumnGrandTotals: shareable.showColumnGrandTotals,
                  expandedRows: [],
                  expandedColumns: [],
                })}
            /> : null}
            {enableFieldChooser ? (
              <PivotFieldChooser
                config={config}
                fields={fields}
                data={data}
                valueMappers={valueMappers}
                dateFields={dateFields}
                onChange={onConfigChange}
                issues={issues}
                open={chooserOpen}
                onOpenChange={setChooserOpen}
                hideButton={!view.toolbar.fieldChooser}
              />
            ) : null}
            {toolbarExtra}
            <PivotViewMenu
              view={view}
              onViewChange={updateView}
              config={config}
              onConfigChange={onConfigChange}
              availableButtons={TOOLBAR_SWITCHES.filter((item) =>
                (item.key !== "data" || Boolean(onDataImport)) && (item.key !== "fieldChooser" || enableFieldChooser))}
            />
          </div>
        </div>

        {errors.length > 0 ? (
          <div
            role="alert"
            className="flex flex-shrink-0 items-start gap-2 border-b border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
          >
            <ExclamationTriangleIcon className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              {errors.map((issue) => (
                <p key={issue.message}>{issue.message}</p>
              ))}
            </div>
            {enableFieldChooser ? (
              <button
                type="button"
                onClick={() => setChooserOpen(true)}
                className="shrink-0 rounded px-2 py-0.5 text-xs font-medium underline-offset-2 hover:underline"
              >
                Alan seçiciyi aç
              </button>
            ) : null}
          </div>
        ) : null}

        {view.fieldPanel ? (
          // Izgara cizilebiliyorsa satir/sutun/veri alanlari tablonun baslik bolgesinde durur
          <PivotFieldPanel areas={areas} only={canRenderGrid ? ["filters"] : undefined} />
        ) : null}

        <div
          className="dtp-pivot min-h-0 flex-1 overflow-auto"
          style={maxHeight && maxHeight !== "auto" ? { maxHeight } : undefined}
        >
          {!hasValues && !view.fieldPanel ? (
            <EmptyState>Pivot için Veri alanlarına en az bir alan ekleyin.</EmptyState>
          ) : !hasValues ? (
            <EmptyState>Veri alanlarına en az bir alan sürükleyin.</EmptyState>
          ) : !hasData ? (
            <EmptyState>{emptyMessage}</EmptyState>
          ) : (
            <table
              ref={tableRef}
              className={clsx("dtp-pivot-table", view.rowDense && "dtp-pivot-dense")}
              style={{ "--dtp-pivot-header-h": `${headerRowHeight}px` } as CSSProperties}
            >
              <colgroup>
                {Array.from({ length: layout.rowHeaderDepth }, (_, index) => (
                  <col key={`rh-${index}`} style={{ width: rowHeaderWidth, minWidth: rowHeaderWidth }} />
                ))}
                {layout.leafColumns.map((column) => (
                  <col key={column.id} />
                ))}
              </colgroup>
              <thead>
                {panelInGrid ? (
                  <tr>
                    <th
                      {...pivotZoneProps(areas, "values")}
                      className="dtp-pivot-corner dtp-pivot-zone-cell"
                      colSpan={layout.rowHeaderDepth}
                      style={{ top: 0, left: 0, height: zoneRowHeight }}
                    >
                      <PivotZoneContent areas={areas} area="values" fill />
                    </th>
                    <th
                      {...pivotZoneProps(areas, "columns")}
                      className="dtp-pivot-zone-cell dtp-pivot-zone-cell-columns"
                      colSpan={Math.max(layout.leafColumns.length, 1)}
                      style={{ top: 0, height: zoneRowHeight }}
                    >
                      {/* Yatay kaydirmada ciplerin gorunur kalmasi icin satir basliklarinin hemen sagina yapisir */}
                      <div className="dtp-pivot-zone-sticky" style={{ left: leftOf(layout.rowHeaderDepth) }}>
                        <PivotZoneContent areas={areas} area="columns" />
                      </div>
                    </th>
                  </tr>
                ) : null}
                {layout.columnHeaderRows.map((headerRow, rowIndex) => {
                  const isLast = rowIndex === layout.columnHeaderRows.length - 1;
                  const top = zoneRowHeight + rowIndex * headerRowHeight;
                  return (
                    <tr key={rowIndex}>
                      {rowIndex === 0 && layout.columnHeaderRows.length > 1 ? (
                        <th
                          className="dtp-pivot-corner"
                          colSpan={layout.rowHeaderDepth}
                          rowSpan={layout.columnHeaderRows.length - 1}
                          style={{ top, left: 0 }}
                        >
                          <span className="dtp-pivot-corner-label">{panelInGrid ? "" : cornerLabel}</span>
                        </th>
                      ) : null}
                      {isLast && panelInGrid
                        ? Array.from({ length: layout.rowHeaderDepth }, (_, level) => (
                          <th
                            key={`field-${level}`}
                            {...pivotZoneProps(areas, "rows")}
                            data-level={level}
                            className="dtp-pivot-corner dtp-pivot-zone-cell"
                            style={{ top, left: leftOf(level), height: headerRowHeight }}
                          >
                            {rowChips.length === 0 ? (
                              <PivotZoneContent areas={areas} area="rows" />
                            ) : (
                              <div className="flex w-full min-w-0 gap-1.5 [&>*]:min-w-0 [&>*]:flex-1">
                                {rowChips[level]}
                                {/* Satir alani sayisi derinlikten fazla olamaz; fazlasi sona eklenir */}
                                {level === layout.rowHeaderDepth - 1 ? rowChips.slice(layout.rowHeaderDepth) : null}
                              </div>
                            )}
                          </th>
                        ))
                        : null}
                      {isLast && !panelInGrid
                        ? Array.from({ length: layout.rowHeaderDepth }, (_, level) => (
                          <th
                            key={`field-${level}`}
                            data-level={level}
                            className="dtp-pivot-corner dtp-pivot-field"
                            style={{ top, left: leftOf(level) }}
                          >
                            {layout.columnHeaderRows.length === 1 && level === 0 && rowFieldLabels.length === 0
                              ? cornerLabel
                              : rowFieldLabels[level] ?? ""}
                          </th>
                        ))
                        : null}
                      {headerRow.map((cell) => (
                        <ColumnHeaderCell
                          key={cell.id}
                          cell={cell}
                          top={top}
                          headerRowHeight={headerRowHeight}
                          onToggle={toggleColumn}
                        />
                      ))}
                    </tr>
                  );
                })}
              </thead>
              <tbody>
                {layout.rowLines.map((line) => (
                  <PivotBodyRow
                    key={line.id}
                    line={line}
                    leafColumns={layout.leafColumns}
                    values={config.values}
                    formatters={valueFormatters}
                    alignStyles={valueAlignStyles}
                    cellStyles={valueCellStyles}
                    alternateColumns={alternateColumns}
                    getValue={model.getValue}
                    conditions={config.conditions}
                    leftOf={leftOf}
                    onToggle={toggleRow}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}

/**
 * Son baslik satirindaki seviye hucrelerini (data-level) olcerek her satir basligi sutununun
 * yapisik sol konumunu doner; son eleman toplam genisliktir. Olculemezse null.
 */
function useRowHeaderOffsets(
  tableRef: RefObject<HTMLTableElement | null>,
  deps: unknown[],
): number[] | null {
  const [offsets, setOffsets] = useState<number[] | null>(null);

  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) {
      setOffsets(null);
      return;
    }
    const measure = () => {
      const cells = Array.from(
        table.querySelectorAll<HTMLElement>("thead > tr:last-child > th[data-level]"),
      );
      if (cells.length === 0) return;
      const next = [0];
      cells.forEach((cell) => next.push(next[next.length - 1] + cell.getBoundingClientRect().width));
      setOffsets((previous) =>
        previous
        && previous.length === next.length
        && previous.every((value, index) => Math.abs(value - next[index]) < 0.5)
          ? previous
          : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(table);
    table.querySelectorAll("thead > tr:last-child > th[data-level]").forEach((cell) => observer.observe(cell));
    return () => observer.disconnect();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return offsets;
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="dark:text-dark-300 flex h-full min-h-40 items-center justify-center p-6 text-center text-sm text-gray-500">
      {children}
    </div>
  );
}

function ExpandToggle({ expanded, onClick, label }: { expanded: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-label={`${label} ${expanded ? "daralt" : "genişlet"}`}
      title={expanded ? "Daralt" : "Genişlet"}
      className="dtp-pivot-toggle"
    >
      {expanded ? <MinusIcon className="size-3" /> : <PlusIcon className="size-3" />}
    </button>
  );
}

function ColumnHeaderCell({
  cell,
  top,
  headerRowHeight,
  onToggle,
}: {
  cell: PivotHeaderCell;
  top: number;
  headerRowHeight: number;
  onToggle: (path: string) => void;
}) {
  return (
    <th
      colSpan={cell.colSpan}
      rowSpan={cell.rowSpan}
      className={clsx("dtp-pivot-col", `dtp-pivot-${cell.kind}`)}
      style={{ top, height: headerRowHeight * cell.rowSpan }}
    >
      <span className="dtp-pivot-head">
        {cell.expandable && cell.path !== undefined ? (
          <ExpandToggle expanded={cell.expanded} label={cell.label} onClick={() => onToggle(cell.path!)} />
        ) : null}
        <span className="truncate">{cell.label}</span>
      </span>
    </th>
  );
}

function PivotBodyRow({
  line,
  leafColumns,
  values,
  formatters,
  alignStyles,
  cellStyles,
  alternateColumns,
  getValue,
  conditions,
  leftOf,
  onToggle,
}: {
  line: PivotRowLine;
  leafColumns: PivotLeafColumn[];
  values: DataTablePivotValue[];
  /** Veri alani sirasina gore hucre metni bicimlendiricileri. */
  formatters: ((value: number | null) => string)[];
  alignStyles: (CSSProperties | undefined)[];
  /** Veri alani sirasina gore hucre turu renkleri. */
  cellStyles: DataTablePivotCellStyles[];
  /** Sutun sirasina gore: veri sutunlarinin donusumlu sirasinda 2. renge denk geliyor mu. */
  alternateColumns: boolean[];
  getValue: (rowPath: string, columnPath: string, valueIndex: number) => number | null;
  conditions?: DataTablePivotCondition[];
  leftOf: (level: number) => number;
  onToggle: (path: string) => void;
}) {
  return (
    <tr className={clsx("dtp-pivot-row", `dtp-pivot-row-${line.kind}`)}>
      {line.headers.map((cell) => (
        <th
          key={cell.id}
          scope="row"
          colSpan={cell.colSpan}
          rowSpan={cell.rowSpan}
          className={clsx("dtp-pivot-rowhead", `dtp-pivot-${cell.kind}`)}
          style={{ left: leftOf(cell.level) }}
        >
          <span className="dtp-pivot-head">
            {cell.expandable && cell.path !== undefined ? (
              <ExpandToggle expanded={cell.expanded} label={cell.label} onClick={() => onToggle(cell.path!)} />
            ) : null}
            <span className="truncate" title={cell.label}>{cell.label}</span>
          </span>
        </th>
      ))}
      {leafColumns.map((column, columnIndex) => {
        const value = getValue(line.path, column.path, column.valueIndex);
        const pivotValue = values[column.valueIndex];
        const isTotal = line.kind !== "value" || column.kind !== "value";
        return (
          <td
            key={column.id}
            className={clsx("dtp-pivot-cell", column.kind !== "value" && `dtp-pivot-cell-${column.kind}`)}
            style={{
              ...alignStyles[column.valueIndex],
              ...pivotColorStyle(pivotCellColor(cellStyles[column.valueIndex], pivotCellKind(line.kind, column.kind), alternateColumns[columnIndex])),
              ...resolvePivotCellStyle(conditions, pivotValue, value, isTotal),
            }}
          >
            {formatters[column.valueIndex]?.(value) ?? ""}
          </td>
        );
      })}
    </tr>
  );
}

function PivotExportMenu({ disabled, onExport }: { disabled: boolean; onExport: (kind: "pivot" | "raw") => void }) {
  const items: { kind: "pivot" | "raw"; label: string }[] = [
    { kind: "pivot", label: "Pivot Tablosunu Excel İndir" },
    { kind: "raw", label: "Ham Veriyi Excel İndir" },
  ];
  return (
    <Menu as="div" className="relative inline-flex">
      <MenuButton as={Button} variant="flat" isIcon className="size-8 rounded-full" title="İndir" disabled={disabled}>
        <ArrowDownTrayIcon className="size-4.5" />
      </MenuButton>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-75"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-1"
      >
        <MenuItems
          anchor={{ to: "bottom end", gap: 6 }}
          className="z-[12000] w-64 rounded-lg border border-gray-200 bg-white py-1 shadow-lg outline-hidden dark:border-dark-500 dark:bg-dark-750"
        >
          {items.map((item) => (
            <MenuItem key={item.kind}>
              {({ focus }) => (
                <button
                  type="button"
                  onClick={() => onExport(item.kind)}
                  className={clsx(
                    "flex w-full px-3 py-2 text-left text-sm outline-hidden",
                    focus
                      ? "bg-gray-100 text-gray-900 dark:bg-dark-600 dark:text-dark-50"
                      : "text-gray-700 dark:text-dark-100",
                  )}
                >
                  {item.label}
                </button>
              )}
            </MenuItem>
          ))}
        </MenuItems>
      </Transition>
    </Menu>
  );
}

function PivotViewMenu({
  view,
  onViewChange,
  config,
  onConfigChange,
  availableButtons,
}: {
  view: PivotViewSettings;
  onViewChange: (patch: Partial<PivotViewSettings>) => void;
  config: Config;
  onConfigChange: (config: Config) => void;
  /** Bu tabloda bulunan ve gizlenip gosterilebilen arac cubugu dugmeleri. */
  availableButtons: { key: DataTablePivotToolbarButton; label: string }[];
}) {
  const viewSwitches: { key: Exclude<keyof PivotViewSettings, "toolbar">; label: string }[] = [
    { key: "fullScreen", label: "Tam Ekran" },
    { key: "rowDense", label: "Satırları Sıkıştır" },
    { key: "showTitle", label: "Tablo başlığı" },
    { key: "fieldPanel", label: "Alan paneli" },
  ];
  const totalSwitches: { key: keyof Config & `show${string}`; label: string }[] = [
    { key: "showRowTotals", label: "Satır ara toplamları" },
    { key: "showColumnTotals", label: "Sütun ara toplamları" },
    { key: "showRowGrandTotals", label: "Genel toplam satırı" },
    { key: "showColumnGrandTotals", label: "Genel toplam sütunu" },
  ];
  return (
    <Popover className="relative inline-flex">
      <PopoverButton as={Button} isIcon variant="flat" className="size-8 rounded-full" title="Tablo görünümü">
        <AdjustmentsHorizontalIcon className="size-4.5" />
      </PopoverButton>
      <PopoverPanel
        anchor={{ to: "bottom end", gap: 8 }}
        className="dark:border-dark-500 dark:bg-dark-750 z-100 w-64 rounded-md border border-gray-300 bg-white shadow-lg outline-hidden"
      >
        <h3 className="dark:text-dark-100 px-3 pt-2.5 text-sm font-medium tracking-wide text-gray-800">Tablo Görünümü</h3>
        <div className="dark:text-dark-100 mt-3 mb-3 flex max-h-[min(32rem,70vh)] flex-col items-start space-y-2 overflow-y-auto px-3 text-gray-600">
          {viewSwitches.map((item) => (
            <Switch
              key={item.key}
              label={item.label}
              checked={view[item.key]}
              onChange={(event) => onViewChange({ [item.key]: event.currentTarget.checked })}
            />
          ))}
          <div className="flex w-full items-center gap-2 pt-1">
            <p className="shrink-0 text-xs">Toplamlar</p>
            <hr className="dark:border-dark-500 flex-1 border-gray-300" />
          </div>
          {totalSwitches.map((item) => (
            <Switch
              key={item.key}
              label={item.label}
              checked={(config[item.key] as boolean | undefined) ?? true}
              onChange={(event) => onConfigChange({ ...config, [item.key]: event.currentTarget.checked })}
            />
          ))}
          <div className="flex w-full items-center gap-2 pt-1">
            <p className="shrink-0 text-xs">Araç çubuğu</p>
            <hr className="dark:border-dark-500 flex-1 border-gray-300" />
          </div>
          {availableButtons.map((item) => (
            <Switch
              key={item.key}
              label={item.label}
              checked={view.toolbar[item.key]}
              onChange={(event) =>
                onViewChange({ toolbar: { ...view.toolbar, [item.key]: event.currentTarget.checked } })}
            />
          ))}
        </div>
      </PopoverPanel>
    </Popover>
  );
}
