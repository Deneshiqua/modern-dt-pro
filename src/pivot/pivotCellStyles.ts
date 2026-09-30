import type { CSSProperties } from "react";

import type { DataTablePivotCellStyles, DataTablePivotColorStyle, DataTablePivotValue } from "../types";
import { contrastTextColor } from "./pivotConditions";

/** Hucre turu (2. renk ayri bir tur degil, veri hucrelerinin dönüşümlü rengidir). */
export type PivotCellKind = "cells" | "totals" | "grandTotals";
const STYLE_KEYS = ["cells", "alternateCells", "totals", "grandTotals"] as const;

export const PIVOT_CELL_KINDS: { id: PivotCellKind; label: string; hint: string }[] = [
  { id: "cells", label: "Veri hücreleri", hint: "Toplam olmayan tüm değer hücreleri" },
  { id: "totals", label: "Ara toplamlar", hint: "Açılan grupların toplam satır ve sütunları" },
  { id: "grandTotals", label: "Genel toplamlar", hint: "Genel toplam satırı ve sütunu" },
];

/** Satir ve sutun turune gore hucre turu; genel toplam ara toplamdan onceliklidir. */
export const pivotCellKind = (
  rowKind: "value" | "total" | "grand",
  columnKind: "value" | "total" | "grand",
): PivotCellKind => {
  if (rowKind === "grand" || columnKind === "grand") return "grandTotals";
  if (rowKind === "total" || columnKind === "total") return "totals";
  return "cells";
};

/** Varsayilan renkler ile veri alanina ozel renkleri hucre turu bazinda birlestirir. */
export function resolvePivotCellStyles(
  defaults: DataTablePivotCellStyles | undefined,
  value: DataTablePivotValue | undefined,
): DataTablePivotCellStyles {
  const own = value?.cellStyles;
  const merged: DataTablePivotCellStyles = {};
  STYLE_KEYS.forEach((kind) => {
    const style = { ...defaults?.[kind], ...own?.[kind] };
    if (style.backgroundColor || style.color) merged[kind] = style;
  });
  return merged;
}

/** Renk tanimini hucre stiline cevirir; yazi rengi yoksa arka plana gore secilir. */
export function pivotColorStyle(style: DataTablePivotColorStyle | undefined): CSSProperties | undefined {
  if (!style || (!style.backgroundColor && !style.color)) return undefined;
  const css: CSSProperties = {};
  if (style.backgroundColor) css.backgroundColor = style.backgroundColor;
  const color = style.color ?? (style.backgroundColor ? contrastTextColor(style.backgroundColor) : undefined);
  if (color) css.color = color;
  return css;
}

/** Hucre renkleri tanimli mi (dugmedeki gosterge ve ozet icin). */
export const hasPivotCellStyles = (styles: DataTablePivotCellStyles | undefined) =>
  Boolean(styles && Object.values(styles).some((style) => style && (style.backgroundColor || style.color)));

/** Tanimsiz alanlari ve bos turleri atar; hic renk kalmadiysa undefined. */
export function cleanPivotCellStyles(styles: DataTablePivotCellStyles | undefined): DataTablePivotCellStyles | undefined {
  if (!styles) return undefined;
  const result: DataTablePivotCellStyles = {};
  STYLE_KEYS.forEach((kind) => {
    const style = styles[kind];
    if (!style) return;
    const entry: DataTablePivotColorStyle = {};
    if (style.backgroundColor) entry.backgroundColor = style.backgroundColor;
    if (style.color) entry.color = style.color;
    if (entry.backgroundColor || entry.color) result[kind] = entry;
  });
  return hasPivotCellStyles(result) ? result : undefined;
}

/**
 * Hucrenin renk tanimi. Veri hucrelerinde `alternate` (sira numarasi tek olan sutun) ve 2. renk
 * tanimliysa 2. renk 1. rengin ustune yazilir.
 */
export function pivotCellColor(
  styles: DataTablePivotCellStyles | undefined,
  kind: PivotCellKind,
  alternate: boolean,
): DataTablePivotColorStyle | undefined {
  if (!styles) return undefined;
  if (kind === "cells" && alternate && styles.alternateCells) {
    return { ...styles.cells, ...styles.alternateCells };
  }
  return styles[kind];
}

/** Gorunen sutunlar icin donusumlu renk sirasi: yalnizca veri sutunlari sayilir, toplam sutunlari atlanir. */
export function pivotAlternateColumns(kinds: ("value" | "total" | "grand")[]): boolean[] {
  let index = 0;
  return kinds.map((kind) => {
    if (kind !== "value") return false;
    const alternate = index % 2 === 1;
    index += 1;
    return alternate;
  });
}
