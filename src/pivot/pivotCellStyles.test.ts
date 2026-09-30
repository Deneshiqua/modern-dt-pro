import { describe, expect, it } from "vitest";

import { cleanPivotCellStyles, pivotCellKind, pivotColorStyle, resolvePivotCellStyles } from "./pivotCellStyles";

describe("hucre renkleri", () => {
  it("hucre turunu satir ve sutun turunden cikarir", () => {
    expect(pivotCellKind("value", "value")).toBe("cells");
    expect(pivotCellKind("total", "value")).toBe("totals");
    expect(pivotCellKind("value", "total")).toBe("totals");
    expect(pivotCellKind("total", "grand")).toBe("grandTotals");
    expect(pivotCellKind("grand", "value")).toBe("grandTotals");
  });

  it("veri alani renkleri varsayilanin ustune tur bazinda yazilir", () => {
    const defaults = { cells: { backgroundColor: "#ffffff", color: "#111827" }, totals: { backgroundColor: "#f3f4f6" } };
    const value = { field: "amount", aggregate: "sum" as const, cellStyles: { cells: { backgroundColor: "#dcfce7" } } };
    expect(resolvePivotCellStyles(defaults, value)).toEqual({
      cells: { backgroundColor: "#dcfce7", color: "#111827" },
      totals: { backgroundColor: "#f3f4f6" },
    });
    expect(resolvePivotCellStyles(undefined, undefined)).toEqual({});
  });

  it("yazi rengi yoksa okunur renk secer, bos renkleri atar", () => {
    expect(pivotColorStyle({ backgroundColor: "#1d4ed8" })).toEqual({ backgroundColor: "#1d4ed8", color: "#f9fafb" });
    expect(pivotColorStyle({ color: "#dc2626" })).toEqual({ color: "#dc2626" });
    expect(pivotColorStyle({})).toBeUndefined();
    expect(cleanPivotCellStyles({ cells: {}, totals: { color: "#000000", backgroundColor: undefined } })).toEqual({ totals: { color: "#000000" } });
    expect(cleanPivotCellStyles({ cells: {} })).toBeUndefined();
  });
});

describe("yapilandirmada hucre renkleri", () => {
  it("disa aktarilir, geri okunur ve renk kodlari dogrulanir", async () => {
    const { parsePivotConfigJson, toShareablePivotConfig } = await import("./pivotValidation");
    const config = {
      rows: [],
      columns: [],
      cellStyles: { totals: { backgroundColor: "#f3f4f6" } },
      values: [{ field: "amount", aggregate: "sum" as const, cellStyles: { cells: { color: "#dc2626" } } }],
    };
    const shareable = toShareablePivotConfig(config);
    expect(shareable.cellStyles).toEqual({ totals: { backgroundColor: "#f3f4f6" } });
    const parsed = parsePivotConfigJson(JSON.stringify(shareable));
    expect(parsed.ok && parsed.config.values[0].cellStyles).toEqual({ cells: { color: "#dc2626" } });

    const bad = parsePivotConfigJson(JSON.stringify({ cellStyles: { totals: { backgroundColor: "red" }, headers: {} } }));
    expect(!bad.ok && bad.errors).toEqual([
      'cellStyles.totals.backgroundColor onaltılık renk olmalı, ör. "#dcfce7".',
      "cellStyles.headers tanınmayan hücre türü. Geçerli: cells, alternateCells, totals, grandTotals.",
    ]);
  });
});

describe("veri hucrelerinde 2. renk", () => {
  it("veri sutunlarini sirayla sayar, toplam sutunlarini atlar", async () => {
    const { pivotAlternateColumns } = await import("./pivotCellStyles");
    expect(pivotAlternateColumns(["value", "value", "total", "value", "value", "grand"])).toEqual([
      false, true, false, false, true, false,
    ]);
  });

  it("2. renk yalnizca veri hucrelerinde ve 1. rengin ustune uygulanir", async () => {
    const { pivotCellColor } = await import("./pivotCellStyles");
    const styles = {
      cells: { backgroundColor: "#ffffff", color: "#dc2626" },
      alternateCells: { backgroundColor: "#f3f4f6" },
      totals: { backgroundColor: "#fef9c3" },
    };
    expect(pivotCellColor(styles, "cells", false)).toEqual({ backgroundColor: "#ffffff", color: "#dc2626" });
    expect(pivotCellColor(styles, "cells", true)).toEqual({ backgroundColor: "#f3f4f6", color: "#dc2626" });
    expect(pivotCellColor(styles, "totals", true)).toEqual({ backgroundColor: "#fef9c3" });
    expect(pivotCellColor({ cells: { color: "#000000" } }, "cells", true)).toEqual({ color: "#000000" });
  });
});

describe("yapilandirmada 2. renk", () => {
  it("alternateCells disa aktarilir ve geri okunur", async () => {
    const { parsePivotConfigJson, toShareablePivotConfig } = await import("./pivotValidation");
    const shareable = toShareablePivotConfig({
      rows: [],
      columns: [],
      values: [],
      cellStyles: { cells: { backgroundColor: "#ffffff" }, alternateCells: { backgroundColor: "#f3f4f6" } },
    });
    const parsed = parsePivotConfigJson(JSON.stringify(shareable));
    expect(parsed.ok && parsed.config.cellStyles).toEqual({
      cells: { backgroundColor: "#ffffff" },
      alternateCells: { backgroundColor: "#f3f4f6" },
    });
  });
});
