import clsx from "clsx";

import type { PivotArea, usePivotAreas } from "./PivotFieldChooser";

export type PivotAreasApi = ReturnType<typeof usePivotAreas>;
type PanelArea = Exclude<PivotArea, "all">;

export const PIVOT_AREA_META: Record<PanelArea, { label: string; placeholder: string }> = {
  filters: { label: "Filtre alanları", placeholder: "Filtre alanlarını buraya sürükleyin" },
  rows: { label: "Satır alanları", placeholder: "Satır alanlarını buraya sürükleyin" },
  columns: { label: "Sütun alanları", placeholder: "Sütun alanlarını buraya sürükleyin" },
  values: { label: "Veri alanları", placeholder: "Veri alanlarını buraya sürükleyin" },
};

/** Bir alan kutusunun icerigi: cipler ya da bos yer tutucu. */
export function PivotZoneContent({
  areas,
  area,
  singleLine = false,
}: {
  areas: PivotAreasApi;
  area: PanelArea;
  /** Cipler tek satirda kalir; sigmayanlar yatay kaydirmayla gorunur. */
  singleLine?: boolean;
}) {
  return areas.isEmpty(area) ? (
    <span className="dtp-pivot-zone-empty">{PIVOT_AREA_META[area].placeholder}</span>
  ) : (
    <div
      className={clsx(
        "flex min-w-0 gap-1.5",
        singleLine ? "w-full overflow-x-auto [&>*]:shrink-0" : "flex-wrap [&>*]:max-w-full",
      )}
    >
      {areas.renderChips(area)}
    </div>
  );
}

/** Surukle-birak hedefi olan bir alan kutusunun ortak ozellikleri. */
export const pivotZoneProps = (areas: PivotAreasApi, area: PanelArea) => ({
  ...areas.dropProps(area),
  role: "group",
  "aria-label": PIVOT_AREA_META[area].label,
  title: PIVOT_AREA_META[area].label,
  "data-active": areas.dropTarget?.area === area && areas.dropTarget.index === undefined ? "" : undefined,
});

/** Tablonun ustunde duran alan kutulari (izgara cizilemediginde dordu birden). */
export function PivotFieldPanel({
  areas,
  only = ["filters", "rows", "columns", "values"],
  stacked = false,
}: {
  areas: PivotAreasApi;
  only?: PanelArea[];
  /** Kutular alt alta dizilir ve cipleri tek satirda tutulur. */
  stacked?: boolean;
}) {
  return (
    <div
      className={clsx(
        "dark:border-dark-500 dark:bg-dark-800/60 grid flex-shrink-0 grid-cols-1 gap-2 border-b border-gray-200 bg-gray-50/70 px-3 py-2",
        !stacked && only.length > 1 && "sm:grid-cols-2 xl:grid-cols-4",
      )}
    >
      {only.map((area) => (
        <div
          key={area}
          {...pivotZoneProps(areas, area)}
          className="dtp-pivot-zone flex min-h-10 min-w-0 flex-wrap items-center gap-1.5 rounded-md px-2 py-1.5"
        >
          <PivotZoneContent areas={areas} area={area} singleLine={stacked} />
        </div>
      ))}
    </div>
  );
}
