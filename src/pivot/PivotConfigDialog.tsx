import { useCallback, useMemo, type ReactNode } from "react";
import clsx from "clsx";

import type { DataTablePivotConfig, DataTablePivotValue } from "../types";
import { describeCondition, formatStyle } from "./PivotConditionsDialog";
import { describePivotNumberFormat, hasPivotNumberFormat } from "./pivotNumberFormat";
import { PIVOT_CELL_KINDS, hasPivotCellStyles, pivotColorStyle } from "./pivotCellStyles";
import { PIVOT_AGGREGATE_LABELS } from "./PivotFieldChooser";
import type { PivotField } from "./pivotEngine";
import { ConfigJsonPanel, type ConfigJsonParseResult } from "./ConfigJsonPanel";
import {
  buildPivotConfigSchema,
  parsePivotConfigJson,
  toShareablePivotConfig,
  validatePivotConfig,
  type PivotShareableConfig,
} from "./pivotValidation";

type Config = DataTablePivotConfig<any>;

const TOTAL_LABELS: { key: "showRowTotals" | "showColumnTotals" | "showRowGrandTotals" | "showColumnGrandTotals"; label: string }[] = [
  { key: "showRowTotals", label: "Satır ara toplamları" },
  { key: "showColumnTotals", label: "Sütun ara toplamları" },
  { key: "showRowGrandTotals", label: "Genel toplam satırı" },
  { key: "showColumnGrandTotals", label: "Genel toplam sütunu" },
];

const APPLY_LABELS = { all: "Tüm hücreler", cells: "Veri hücreleri", totals: "Toplamlar" } as const;

const toJson = (config: Config) => JSON.stringify(toShareablePivotConfig(config), null, 2);

type PivotConfigButtonProps = {
  config: Config;
  fields: PivotField[];
  onApply: (config: PivotShareableConfig) => void;
  onNotify: (type: "success" | "error", message: string) => void;
};


export function PivotConfigPanel({
  open,
  onClose,
  config,
  fields,
  onApply,
  onNotify,
}: PivotConfigButtonProps & { open: boolean; onClose: () => void }) {
  const currentJson = useMemo(() => toJson(config), [config]);
  const schema = useMemo(() => buildPivotConfigSchema(fields.map((field) => field.id)), [fields]);
  const parse = useCallback((text: string): ConfigJsonParseResult<PivotShareableConfig> => {
    const parsed = parsePivotConfigJson(text);
    if (!parsed.ok) return parsed;
    const warnings = validatePivotConfig({ ...parsed.config }, fields)
      .filter((issue) => issue.level === "error")
      .map((issue) => issue.message);
    return { ok: true, value: parsed.config, warnings };
  }, [fields]);

  return (
    <ConfigJsonPanel
      open={open}
      onClose={onClose}
      currentJson={currentJson}
      parse={parse}
      schema={schema}
      description="Tüm pivot ayarlarının özeti ve paylaşılabilir JSON hali."
      summary={<ConfigSummary config={config} fields={fields} />}
      downloadName="pivot-yapilandirma"
      onApply={onApply}
      onNotify={onNotify}
    />
  );
}

function ConfigSummary({ config, fields }: { config: Config; fields: PivotField[] }) {
  const labelOf = (id: string) => fields.find((field) => field.id === id)?.label ?? id;
  const valueLabel = (value: DataTablePivotValue) =>
    value.label ?? `${labelOf(value.field)} (${PIVOT_AGGREGATE_LABELS[value.aggregate]})`;
  const missing = (id: string) => !fields.some((field) => field.id === id);
  const conditions = config.conditions ?? [];
  const filterEntries = Object.entries(config.filterValues ?? {}).filter(([, values]) => Array.isArray(values));

  const chips = (ids: string[]) =>
    ids.length === 0 ? (
      <span className="dark:text-dark-300 text-sm text-gray-400">—</span>
    ) : (
      <div className="flex flex-wrap gap-1.5">
        {ids.map((id) => (
          <span
            key={id}
            title={missing(id) ? "Veride bu alan yok" : undefined}
            className={clsx(
              "border px-2 py-0.5 text-sm",
              missing(id)
                ? "border-red-300 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
                : "dark:bg-dark-600 dark:border-dark-500 border-gray-200 bg-gray-100",
            )}
          >
            {labelOf(id)}
          </span>
        ))}
      </div>
    );

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-2">
      <section className="dark:border-dark-500 flex flex-col gap-4 border-b border-gray-200 p-5 md:border-r md:border-b-0">
        <h3 className="dark:text-dark-50 text-sm font-semibold text-gray-900">Alan Seçici</h3>
        <SummaryRow label="Satır alanları">{chips(config.rows.map(String))}</SummaryRow>
        <SummaryRow label="Sütun alanları">{chips(config.columns.map(String))}</SummaryRow>
        <SummaryRow label="Filtre alanları">{chips((config.filters ?? []).map(String))}</SummaryRow>
        <SummaryRow label="Veri alanları">
          {config.values.length === 0 ? (
            <span className="dark:text-dark-300 text-sm text-gray-400">—</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {config.values.map((value, index) => (
                <span key={`${value.field}-${index}`} className="dark:bg-dark-600 dark:border-dark-500 border border-gray-200 bg-gray-100 px-2 py-0.5 text-sm">
                  {valueLabel(value)}
                </span>
              ))}
            </div>
          )}
        </SummaryRow>
        <SummaryRow label="Seçili filtre değerleri">
          {filterEntries.length === 0 ? (
            <span className="dark:text-dark-300 text-sm text-gray-400">Filtre yok</span>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {filterEntries.map(([field, values]) => (
                <li key={field} className="min-w-0">
                  <span className="font-medium">{labelOf(field)}:</span>{" "}
                  <span className="dark:text-dark-200 text-gray-600">
                    {values!.length === 0 ? "hiçbiri" : values!.map((value) => (value === null ? "(Boş)" : String(value))).join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SummaryRow>
        <SummaryRow label="Sayı biçimi">
          <ul className="flex flex-col gap-1 text-sm">
            <li>
              <span className="font-medium">Tüm değerler:</span>{" "}
              <span className="dark:text-dark-200 text-gray-600">{describePivotNumberFormat(config.numberFormat)}</span>
            </li>
            {config.values
              .filter((value) => hasPivotNumberFormat(value.numberFormat))
              .map((value, index) => (
                <li key={`${value.field}-${index}`}>
                  <span className="font-medium">{valueLabel(value)}:</span>{" "}
                  <span className="dark:text-dark-200 text-gray-600">{describePivotNumberFormat(value.numberFormat)}</span>
                </li>
              ))}
          </ul>
        </SummaryRow>
        <SummaryRow label="Hücre renkleri">
          {!hasPivotCellStyles(config.cellStyles) && !config.values.some((value) => hasPivotCellStyles(value.cellStyles)) ? (
            <span className="dark:text-dark-300 text-sm text-gray-400">Varsayılan</span>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {[
                { name: "Tüm değerler", styles: config.cellStyles },
                ...config.values.map((value) => ({ name: valueLabel(value), styles: value.cellStyles })),
              ]
                .filter((entry) => hasPivotCellStyles(entry.styles))
                .map((entry) => (
                  <li key={entry.name} className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{entry.name}:</span>
                    {[
                      ...PIVOT_CELL_KINDS.map((kind) => ({ id: kind.id, label: kind.label, style: entry.styles?.[kind.id] })),
                      {
                        id: "alternateCells",
                        label: "Veri hücreleri 2. renk",
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
        <SummaryRow label="Toplamlar">
          <ul className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
            {TOTAL_LABELS.map(({ key, label }) => {
              const on = config[key] ?? true;
              return (
                <li key={key} className={clsx("flex items-center gap-1.5", !on && "opacity-50")}>
                  <span className={clsx("size-2 rounded-full", on ? "bg-green-500" : "bg-gray-400")} />
                  {label}: {on ? "Açık" : "Kapalı"}
                </li>
              );
            })}
          </ul>
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
              const measure = condition.measure
                ? valueLabel({ field: condition.measure.field, aggregate: condition.measure.aggregate })
                : "Değer";
              const enabled = condition.enabled !== false;
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
                      Kural {index + 1} · {APPLY_LABELS[condition.applyTo ?? "all"]}{enabled ? "" : " · kapalı"}
                    </span>
                    <span className="dark:text-dark-100 block text-sm break-words text-gray-800">
                      {describeCondition(condition, measure)}
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

export function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="dark:text-dark-300 text-xs font-medium text-gray-500">{label}</span>
      {children}
    </div>
  );
}
