import type { CSSProperties } from "react";

import type {
  DataTablePivotCondition,
  DataTablePivotConditionOperator,
  DataTablePivotValue,
} from "../types";

export const PIVOT_CONDITION_OPERATORS: {
  id: DataTablePivotConditionOperator;
  label: string;
  /** Kac karsilastirma degeri ister. */
  arity: 0 | 1 | 2;
}[] = [
  { id: "lt", label: "Küçüktür", arity: 1 },
  { id: "lte", label: "Küçük veya eşittir", arity: 1 },
  { id: "gt", label: "Büyüktür", arity: 1 },
  { id: "gte", label: "Büyük veya eşittir", arity: 1 },
  { id: "eq", label: "Eşittir", arity: 1 },
  { id: "neq", label: "Eşit değildir", arity: 1 },
  { id: "between", label: "Arasında", arity: 2 },
  { id: "notBetween", label: "Arasında değil", arity: 2 },
  { id: "empty", label: "Boş", arity: 0 },
  { id: "notEmpty", label: "Boş değil", arity: 0 },
];

export const pivotOperatorArity = (operator: DataTablePivotConditionOperator) =>
  PIVOT_CONDITION_OPERATORS.find((item) => item.id === operator)?.arity ?? 1;

/** Kuralin karsilastirma kismi; eksik esik degeri olan kural hicbir hucreyi eslemez. */
export function matchesPivotCondition(condition: DataTablePivotCondition, value: number | null): boolean {
  if (condition.operator === "empty") return value === null;
  if (condition.operator === "notEmpty") return value !== null;
  if (value === null) return false;
  const a = condition.value;
  const b = condition.value2;
  if (a === undefined || Number.isNaN(a)) return false;
  switch (condition.operator) {
    case "lt":
      return value < a;
    case "lte":
      return value <= a;
    case "gt":
      return value > a;
    case "gte":
      return value >= a;
    case "eq":
      return value === a;
    case "neq":
      return value !== a;
    case "between":
    case "notBetween": {
      if (b === undefined || Number.isNaN(b)) return false;
      const inside = value >= Math.min(a, b) && value <= Math.max(a, b);
      return condition.operator === "between" ? inside : !inside;
    }
    default:
      return false;
  }
}

const appliesToCell = (
  condition: DataTablePivotCondition,
  measure: DataTablePivotValue | undefined,
  isTotal: boolean,
) => {
  if (condition.enabled === false) return false;
  if (condition.applyTo === "cells" && isTotal) return false;
  if (condition.applyTo === "totals" && !isTotal) return false;
  if (!condition.measure) return true;
  return (
    measure !== undefined
    && condition.measure.field === measure.field
    && condition.measure.aggregate === measure.aggregate
  );
};

/** Arka plan rengine gore okunur yazi rengi (yazi rengi verilmediyse). */
export function contrastTextColor(hex: string): string | undefined {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return undefined;
  const int = parseInt(match[1], 16);
  const channel = (shift: number) => {
    const c = ((int >> shift) & 255) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
  return luminance > 0.4 ? "#111827" : "#f9fafb";
}

/** Hucreye uyan tum kurallarin bicimini sirayla birlestirir. */
export function resolvePivotCellStyle(
  conditions: DataTablePivotCondition[] | undefined,
  measure: DataTablePivotValue | undefined,
  value: number | null,
  isTotal: boolean,
): CSSProperties | undefined {
  if (!conditions?.length) return undefined;
  let style: CSSProperties | undefined;
  conditions.forEach((condition) => {
    if (!appliesToCell(condition, measure, isTotal) || !matchesPivotCondition(condition, value)) return;
    const { backgroundColor, color, fontWeight, fontStyle } = condition.format;
    style = { ...style };
    if (backgroundColor) {
      style.backgroundColor = backgroundColor;
      // Yazi rengi acikca verilmediyse arka plana gore okunur renk sec
      if (!color) style.color = contrastTextColor(backgroundColor) ?? style.color;
    }
    if (color) style.color = color;
    if (fontWeight) style.fontWeight = fontWeight === "bold" ? 700 : 400;
    if (fontStyle) style.fontStyle = fontStyle;
  });
  return style;
}

export const createPivotConditionId = () =>
  `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
