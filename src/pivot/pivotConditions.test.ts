import { describe, expect, it } from "vitest";

import type { DataTablePivotCondition } from "../types";
import { contrastTextColor, matchesPivotCondition, resolvePivotCellStyle } from "./pivotConditions";

const rule = (patch: Partial<DataTablePivotCondition>): DataTablePivotCondition => ({
  id: "r",
  operator: "gt",
  value: 100,
  format: { backgroundColor: "#dcfce7" },
  ...patch,
});

const sum = { field: "amount", aggregate: "sum" as const };
const count = { field: "amount", aggregate: "count" as const };

describe("matchesPivotCondition", () => {
  it("karsilastirma operatorlerini uygular", () => {
    expect(matchesPivotCondition(rule({ operator: "gt" }), 101)).toBe(true);
    expect(matchesPivotCondition(rule({ operator: "gt" }), 100)).toBe(false);
    expect(matchesPivotCondition(rule({ operator: "gte" }), 100)).toBe(true);
    expect(matchesPivotCondition(rule({ operator: "lt" }), 99)).toBe(true);
    expect(matchesPivotCondition(rule({ operator: "eq" }), 100)).toBe(true);
    expect(matchesPivotCondition(rule({ operator: "neq" }), 100)).toBe(false);
  });

  it("arasinda / arasinda degil sinirlari kapsar, sira farketmez", () => {
    expect(matchesPivotCondition(rule({ operator: "between", value: 50, value2: 10 }), 10)).toBe(true);
    expect(matchesPivotCondition(rule({ operator: "between", value: 10, value2: 50 }), 51)).toBe(false);
    expect(matchesPivotCondition(rule({ operator: "notBetween", value: 10, value2: 50 }), 51)).toBe(true);
  });

  it("bos degerleri ve eksik esigi yonetir", () => {
    expect(matchesPivotCondition(rule({ operator: "empty" }), null)).toBe(true);
    expect(matchesPivotCondition(rule({ operator: "notEmpty" }), null)).toBe(false);
    expect(matchesPivotCondition(rule({ operator: "gt" }), null)).toBe(false);
    expect(matchesPivotCondition(rule({ operator: "gt", value: undefined }), 5)).toBe(false);
  });
});

describe("resolvePivotCellStyle", () => {
  it("veri alanina ve toplam kapsamina gore filtreler", () => {
    const conditions = [rule({ measure: sum, applyTo: "cells" })];
    expect(resolvePivotCellStyle(conditions, sum, 200, false)?.backgroundColor).toBe("#dcfce7");
    expect(resolvePivotCellStyle(conditions, count, 200, false)).toBeUndefined();
    expect(resolvePivotCellStyle(conditions, sum, 200, true)).toBeUndefined();
    expect(resolvePivotCellStyle([rule({ applyTo: "totals" })], sum, 200, true)).toBeDefined();
  });

  it("sonraki kural oncekini ezer, pasif kural atlanir", () => {
    const style = resolvePivotCellStyle([
      rule({ format: { backgroundColor: "#fee2e2", fontWeight: "bold" } }),
      rule({ format: { backgroundColor: "#3b82f6" } }),
      rule({ format: { backgroundColor: "#000000" }, enabled: false }),
    ], sum, 500, false);
    expect(style).toMatchObject({ backgroundColor: "#3b82f6", fontWeight: 700, color: "#f9fafb" });
  });

  it("arka plana gore okunur yazi rengi secer", () => {
    expect(contrastTextColor("#fde68a")).toBe("#111827");
    expect(contrastTextColor("#1d4ed8")).toBe("#f9fafb");
  });
});
