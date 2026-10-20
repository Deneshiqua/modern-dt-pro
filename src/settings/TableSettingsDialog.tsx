import { useCallback, useMemo } from "react";
import clsx from "clsx";

import type { DataTablePivotValue, DataTableSettings, DataTableSettingsTab } from "../types";
import { ConfigJsonPanel, type ConfigJsonParseResult } from "../pivot/ConfigJsonPanel";
import { PivotCellStylesPanel } from "../pivot/PivotCellStylesDialog";
import { PivotConditionsPanel, describeCondition, formatStyle } from "../pivot/PivotConditionsDialog";
import { SummaryRow } from "../pivot/PivotConfigDialog";
import { PivotDataPanel } from "../pivot/PivotDataDialog";
import { PivotNumberFormatPanel } from "../pivot/PivotNumberFormatDialog";
import { PivotSettingsDialog, TabCount, TabDot, type PivotSettingsSection } from "../pivot/PivotSettingsDialog";
import { hasPivotCellStyles, pivotColorStyle } from "../pivot/pivotCellStyles";
import { describePivotNumberFormat, hasPivotNumberFormat } from "../pivot/pivotNumberFormat";
import { SETTINGS_TERMS } from "../pivot/settingsTerms";
import { TableColumnsPanel, type TableColumnsPanelColumn } from "./TableColumnsPanel";
import {
  buildTableSettingsSchema,
  byColumn,
  findUnknownSettingColumns,
  fromPanelCondition,
  isCellStylesSet,
  isNumberFormatSet,
  parseTableSettingsJson,
  toPanelCondition,
  toPanelValues,
  toShareableTableSettings,
} from "./tableSettings";

const TERMS = SETTINGS_TERMS.table;

/** Kolona ozel ayarlarda yalnizca panelde listelenen kolonlar degisir; digerleri korunur. */
function mergePerColumn<V>(
  previous: Record<string, V> | undefined,
  listed: { id: string }[],
  next: Record<string, V> | undefined,
): Record<string, V> | undefined {
  const listedIds = new Set(listed.map((column) => column.id));
  const kept = Object.entries(previous ?? {}).filter(([id]) => !listedIds.has(id));
  const merged = { ...Object.fromEntries(kept), ...next };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

/** Bos alanlari atar: kolon secicide "varsayilana don" tum anahtarlari temizler. */
function compact(settings: DataTableSettings): DataTableSettings {
  const next = { ...settings };
  if (!next.columnOrder?.length) delete next.columnOrder;
  if (!next.hiddenColumns?.length) delete next.hiddenColumns;
  if (!next.columnLabels || Object.keys(next.columnLabels).length === 0) delete next.columnLabels;
  if (!next.conditions?.length) delete next.conditions;
  (Object.keys(next) as (keyof DataTableSettings)[]).forEach((key) => {
    if (next[key] === undefined) delete next[key];
  });
  return next;
}

/** Normal tablo icin "Tablo Ayarları" penceresi (pivot ayar panellerinin tablo uyarlamasi). */
export function TableSettingsDialog({
  open,
  onClose,
  tab,
  onTabChange,
  tabs,
  columns,
  naturalOrder,
  settings,
  onSettingsChange,
  currentData,
  onDataImport,
  onNotify,
}: {
  open: boolean;
  onClose: () => void;
  tab: DataTableSettingsTab;
  onTabChange: (tab: DataTableSettingsTab) => void;
  /** Gosterilecek sekmeler; verilmeyenler gorunur. */
  tabs?: Partial<Record<DataTableSettingsTab, boolean>>;
  /** Guncel sirayla tum veri kolonlari. */
  columns: TableColumnsPanelColumn[];
  /** Kolonlarin verideki (ayarlardan bagimsiz) sirasi. */
  naturalOrder: string[];
  settings: DataTableSettings;
  onSettingsChange: (settings: DataTableSettings) => void;
  currentData: readonly Record<string, unknown>[];
  /** Verilirse "Veri" sekmesi gosterilir. */
  onDataImport?: (rows: Record<string, unknown>[]) => void;
  onNotify: (type: "success" | "error", message: string) => void;
}) {
  const update = (patch: Partial<DataTableSettings>) => onSettingsChange(compact({ ...settings, ...patch }));

  // Bicim/renk/kosul panelleri taslaklarini kolon sirasina gore tutar; pencere acikken Alan Secici'de
  // sira degisse de eslesme bozulmasin diye bu paneller kolonlari sabit (verideki) sirayla alir.
  const stableColumns = useMemo(
    () => [...columns].sort((a, b) => naturalOrder.indexOf(a.id) - naturalOrder.indexOf(b.id)),
    [columns, naturalOrder],
  );
  const numericColumns = stableColumns.filter((column) => column.isNumeric);
  const labelOf = (id: string) => columns.find((column) => column.id === id)?.label ?? id;
  const valueLabel = (value: DataTablePivotValue) => labelOf(value.field);
  const numericValues = toPanelValues(numericColumns, settings);
  const allValues = toPanelValues(stableColumns, settings);
  const hidden = useMemo(() => new Set(settings.hiddenColumns ?? []), [settings.hiddenColumns]);
  const columnIds = useMemo(() => columns.map((column) => column.id), [columns]);

  const currentJson = useMemo(() => JSON.stringify(toShareableTableSettings(settings), null, 2), [settings]);
  const schema = useMemo(() => buildTableSettingsSchema(columnIds), [columnIds]);
  const parse = useCallback((text: string): ConfigJsonParseResult<DataTableSettings> => {
    const parsed = parseTableSettingsJson(text);
    if (!parsed.ok) return parsed;
    const unknown = findUnknownSettingColumns(parsed.settings, columnIds);
    return {
      ok: true,
      value: parsed.settings,
      warnings: unknown.length > 0 ? [`Tabloda olmayan kolonlar yok sayılacak: ${unknown.join(", ")}`] : [],
    };
  }, [columnIds]);

  const conditionCount = (settings.conditions ?? []).filter((condition) => condition.enabled !== false).length;
  const hasNumberFormat = hasPivotNumberFormat(settings.numberFormat)
    || Object.values(settings.columnNumberFormats ?? {}).some(hasPivotNumberFormat);
  const hasCellStyles = hasPivotCellStyles(settings.cellStyles)
    || Object.values(settings.columnCellStyles ?? {}).some(hasPivotCellStyles);
  const columnChanges = (settings.columnOrder?.length ? 1 : 0)
    + (settings.hiddenColumns?.length ?? 0)
    + Object.keys(settings.columnLabels ?? {}).length;

  const sections: PivotSettingsSection[] = [
    {
      id: "fieldChooser" as const,
      badge: columnChanges > 0 ? <TabDot /> : null,
      content: (
        <TableColumnsPanel
          columns={columns}
          hidden={hidden}
          labels={settings.columnLabels ?? {}}
          onClose={onClose}
          onChange={(change) => update({
            columnOrder: change.columnOrder.length > 0 ? change.columnOrder : undefined,
            hiddenColumns: change.hiddenColumns,
            columnLabels: change.columnLabels,
          })}
        />
      ),
    },
    {
      id: "conditions" as const,
      badge: <TabCount count={conditionCount} />,
      content: (
        <PivotConditionsPanel
          mode="table"
          open={open}
          onClose={onClose}
          conditions={(settings.conditions ?? []).map(toPanelCondition)}
          values={allValues}
          valueLabel={valueLabel}
          onChange={(conditions) => update({ conditions: conditions.map(fromPanelCondition) })}
        />
      ),
    },
    {
      id: "numberFormat" as const,
      badge: hasNumberFormat ? <TabDot /> : null,
      content: (
        <PivotNumberFormatPanel
          mode="table"
          open={open}
          onClose={onClose}
          numberFormat={settings.numberFormat}
          values={numericValues}
          valueLabel={valueLabel}
          onApply={(numberFormat, perValue) => update({
            numberFormat,
            columnNumberFormats: mergePerColumn(
              settings.columnNumberFormats,
              numericColumns,
              byColumn(numericColumns, perValue, isNumberFormatSet),
            ),
          })}
        />
      ),
    },
    {
      id: "cellStyles" as const,
      badge: hasCellStyles ? <TabDot /> : null,
      content: (
        <PivotCellStylesPanel
          mode="table"
          open={open}
          onClose={onClose}
          cellStyles={settings.cellStyles}
          values={allValues}
          valueLabel={valueLabel}
          onApply={(cellStyles, perValue) => update({
            cellStyles,
            columnCellStyles: mergePerColumn(
              settings.columnCellStyles,
              stableColumns,
              byColumn(stableColumns, perValue, isCellStylesSet),
            ),
          })}
        />
      ),
    },
    {
      id: "configuration" as const,
      content: (
        <ConfigJsonPanel
          open={open}
          onClose={onClose}
          currentJson={currentJson}
          parse={parse}
          schema={schema}
          description="Tüm tablo ayarlarının özeti ve paylaşılabilir JSON hali."
          summary={<TableSettingsSummary settings={settings} labelOf={labelOf} columnIds={columnIds} />}
          downloadName="tablo-yapilandirma"
          onApply={(value) => onSettingsChange(compact(value))}
          onNotify={onNotify}
        />
      ),
    },
    ...(onDataImport
      ? [{
        id: "data" as const,
        content: (
          <PivotDataPanel
            mode="table"
            open={open}
            onClose={onClose}
            currentData={currentData}
            onApply={(rows) => {
              onDataImport(rows);
              onNotify("success", `${rows.length.toLocaleString("tr-TR")} kayıt yüklendi`);
              // Pencere acik kalir; yeni kolonlar gorulsun diye Alan Secici sekmesine gecilir
              onTabChange("fieldChooser");
            }}
          />
        ),
      }]
      : []),
  ].filter((section) => tabs?.[section.id] !== false);

  return (
    <PivotSettingsDialog
      title="Tablo Ayarları"
      open={open}
      onClose={onClose}
      tab={tab}
      onTabChange={onTabChange}
      sections={sections}
    />
  );
}

function TableSettingsSummary({
  settings,
  labelOf,
  columnIds,
}: {
  settings: DataTableSettings;
  labelOf: (id: string) => string;
  columnIds: string[];
}) {
  const conditions = settings.conditions ?? [];
  const known = new Set(columnIds);
  const empty = <span className="dark:text-dark-300 text-sm text-gray-400">—</span>;
  const chips = (ids: string[]) =>
    ids.length === 0 ? empty : (
      <div className="flex flex-wrap gap-1.5">
        {ids.map((id) => (
          <span
            key={id}
            title={known.has(id) ? undefined : "Tabloda bu kolon yok"}
            className={clsx(
              "border px-2 py-0.5 text-sm",
              known.has(id)
                ? "dark:bg-dark-600 dark:border-dark-500 border-gray-200 bg-gray-100"
                : "border-red-300 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300",
            )}
          >
            {labelOf(id)}
          </span>
        ))}
      </div>
    );
  const labelEntries = Object.entries(settings.columnLabels ?? {});
  const formatEntries = Object.entries(settings.columnNumberFormats ?? {}).filter(([, format]) => hasPivotNumberFormat(format));
  const styleEntries = [
    { name: "Tüm kolonlar", styles: settings.cellStyles },
    ...Object.entries(settings.columnCellStyles ?? {}).map(([id, styles]) => ({ name: labelOf(id), styles })),
  ].filter((entry) => hasPivotCellStyles(entry.styles));

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-2">
      <section className="dark:border-dark-500 flex flex-col gap-4 border-b border-gray-200 p-5 md:border-r md:border-b-0">
        <h3 className="dark:text-dark-50 text-sm font-semibold text-gray-900">Alan Seçici</h3>
        <SummaryRow label="Kolon sırası">
          {settings.columnOrder?.length ? chips(settings.columnOrder) : (
            <span className="dark:text-dark-300 text-sm text-gray-400">Varsayılan</span>
          )}
        </SummaryRow>
        <SummaryRow label="Gizli kolonlar">{chips(settings.hiddenColumns ?? [])}</SummaryRow>
        <SummaryRow label="Yeniden adlandırılan kolonlar">
          {labelEntries.length === 0 ? empty : (
            <ul className="flex flex-col gap-1 text-sm">
              {labelEntries.map(([id, name]) => (
                <li key={id}>
                  <span className="dark:text-dark-200 text-gray-600">{id}</span> → <span className="font-medium">{name}</span>
                </li>
              ))}
            </ul>
          )}
        </SummaryRow>
        <SummaryRow label="Sayı biçimi">
          <ul className="flex flex-col gap-1 text-sm">
            <li>
              <span className="font-medium">Tüm sayısal kolonlar:</span>{" "}
              <span className="dark:text-dark-200 text-gray-600">{describePivotNumberFormat(settings.numberFormat)}</span>
            </li>
            {formatEntries.map(([id, format]) => (
              <li key={id}>
                <span className="font-medium">{labelOf(id)}:</span>{" "}
                <span className="dark:text-dark-200 text-gray-600">{describePivotNumberFormat(format)}</span>
              </li>
            ))}
          </ul>
        </SummaryRow>
        <SummaryRow label="Hücre renkleri">
          {styleEntries.length === 0 ? (
            <span className="dark:text-dark-300 text-sm text-gray-400">Varsayılan</span>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {styleEntries.map((entry) => (
                <li key={entry.name} className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{entry.name}:</span>
                  {[
                    ...TERMS.cellKinds.map((kind) => ({ id: kind.id, label: kind.label, style: entry.styles?.[kind.id] })),
                    {
                      id: "alternateCells",
                      label: "Veri satırları 2. renk",
                      style: entry.styles?.alternateCells && { ...entry.styles.cells, ...entry.styles.alternateCells },
                    },
                  ]
                    .filter((item) => item.style)
                    .map((item) => (
                      <span
                        key={item.id}
                        className="dark:border-dark-450 rounded border border-gray-300 px-1.5 text-xs"
                        style={pivotColorStyle(item.style)}
                      >
                        {item.label}
                      </span>
                    ))}
                </li>
              ))}
            </ul>
          )}
        </SummaryRow>
      </section>

      <section className="flex flex-col gap-3 p-5">
        <h3 className="dark:text-dark-50 text-sm font-semibold text-gray-900">
          Koşullu Biçimlendirme <span className="dark:text-dark-300 font-normal text-gray-500">({conditions.length})</span>
        </h3>
        {conditions.length === 0 ? (
          <p className="dark:text-dark-300 text-sm text-gray-500">Kural tanımlanmadı.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {conditions.map((condition, index) => {
              const enabled = condition.enabled !== false;
              const applyLabel = TERMS.applyOptions.find((option) => option.id === (condition.applyTo ?? "all"))?.label;
              return (
                <li
                  key={condition.id}
                  className={clsx(
                    "dark:border-dark-500 flex items-center gap-3 rounded-md border border-gray-200 px-3 py-2",
                    !enabled && "opacity-50",
                  )}
                >
                  <span
                    className="dark:border-dark-450 grid h-7 w-12 shrink-0 place-items-center rounded border border-gray-300 text-xs tabular-nums"
                    style={formatStyle(condition.format)}
                  >
                    123
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="dark:text-dark-300 block text-[11px] text-gray-500">
                      Kural {index + 1} · {applyLabel}
                      {condition.target === "row" ? " · tüm satır" : ""}
                      {enabled ? "" : " · kapalı"}
                    </span>
                    <span className="dark:text-dark-100 block text-sm break-words text-gray-800">
                      {describeCondition(toPanelCondition(condition), condition.column ? labelOf(condition.column) : "Değer")}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

