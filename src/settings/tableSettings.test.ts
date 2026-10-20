import { describe, expect, it } from "vitest";

import type { DataTableCondition, DataTableSettings } from "../types";
import {
  findUnknownSettingColumns,
  fromPanelCondition,
  parseTableSettingsJson,
  resolveColumnNumberFormat,
  resolveColumnOrder,
  resolveTableCellColor,
  resolveTableConditionStyle,
  resolveTableRowConditionStyle,
  toPanelCondition,
  toShareableTableSettings,
} from "./tableSettings";

const green = { backgroundColor: "#dcfce7", color: "#166534" };

describe("resolveColumnOrder", () => {
  it("kayitli sirayi uygular, bilinmeyenleri atar, yenileri sona ekler", () => {
    expect(resolveColumnOrder(["c", "x", "a"], ["a", "b", "c"])).toEqual(["c", "a", "b"]);
  });

  it("sira yoksa dogal sira", () => {
    expect(resolveColumnOrder(undefined, ["a", "b"])).toEqual(["a", "b"]);
  });
});

describe("resolveColumnNumberFormat", () => {
  it("kolona ozel ayar varsayilanin ustune yazilir", () => {
    const settings: DataTableSettings = {
      numberFormat: { decimalPlaces: 2, currencySymbol: "₺" },
      columnNumberFormats: { total: { decimalPlaces: 0 } },
    };
    expect(resolveColumnNumberFormat(settings, "total")).toEqual({ decimalPlaces: 0, currencySymbol: "₺" });
    expect(resolveColumnNumberFormat(settings, "price")).toEqual({ decimalPlaces: 2, currencySymbol: "₺" });
  });

  it("ayar yoksa undefined (tablo kendi bicimini kullanir)", () => {
    expect(resolveColumnNumberFormat({}, "total")).toBeUndefined();
  });
});

describe("resolveTableCellColor", () => {
  const settings: DataTableSettings = {
    cellStyles: { cells: { backgroundColor: "#ffffff" }, alternateCells: { backgroundColor: "#f3f4f6" } },
    columnCellStyles: { total: { totals: { backgroundColor: "#fef9c3" } } },
  };

  it("cift siradaki veri satiri 2. rengi kullanir", () => {
    expect(resolveTableCellColor(settings, "name", "cells", false)?.backgroundColor).toBe("#ffffff");
    expect(resolveTableCellColor(settings, "name", "cells", true)?.backgroundColor).toBe("#f3f4f6");
  });

  it("kolona ozel grup satiri rengi", () => {
    expect(resolveTableCellColor(settings, "total", "totals")?.backgroundColor).toBe("#fef9c3");
    expect(resolveTableCellColor(settings, "name", "totals")).toBeUndefined();
  });
});

describe("kosullu bicimlendirme", () => {
  const cellRule: DataTableCondition = { id: "1", column: "total", operator: "gt", value: 100, format: green };
  const anyNumeric: DataTableCondition = { id: "2", operator: "lt", value: 0, format: { color: "#dc2626" } };
  const rowRule: DataTableCondition = {
    id: "3",
    column: "status",
    operator: "eq",
    value: 0,
    target: "row",
    format: { backgroundColor: "#fee2e2" },
  };

  it("hucre kurali yalnizca kendi kolonunda calisir", () => {
    expect(resolveTableConditionStyle([cellRule], "total", true, 150, "cells")?.backgroundColor).toBe("#dcfce7");
    expect(resolveTableConditionStyle([cellRule], "price", true, 150, "cells")).toBeUndefined();
    expect(resolveTableConditionStyle([cellRule], "total", true, 50, "cells")).toBeUndefined();
  });

  it("kolonsuz kural yalnizca sayisal kolonlara uygulanir", () => {
    expect(resolveTableConditionStyle([anyNumeric], "total", true, -5, "cells")?.color).toBe("#dc2626");
    expect(resolveTableConditionStyle([anyNumeric], "name", false, null, "cells")).toBeUndefined();
  });

  it("applyTo satir turunu sinirlar", () => {
    const totalsOnly = { ...cellRule, applyTo: "totals" as const };
    expect(resolveTableConditionStyle([totalsOnly], "total", true, 150, "cells")).toBeUndefined();
    expect(resolveTableConditionStyle([totalsOnly], "total", true, 150, "totals")).toBeDefined();
    expect(resolveTableConditionStyle([totalsOnly], "total", true, 150, "grandTotals")).toBeDefined();
  });

  it("satir kurali hucre kurallarina karismaz, satir degerine bakar", () => {
    expect(resolveTableConditionStyle([rowRule], "status", true, 0, "cells")).toBeUndefined();
    const values: Record<string, unknown> = { status: 0, total: 10 };
    expect(resolveTableRowConditionStyle([rowRule], (column) => values[column], "cells")?.backgroundColor).toBe("#fee2e2");
    expect(resolveTableRowConditionStyle([rowRule], () => 1, "cells")).toBeUndefined();
  });

  it("kapali kural uygulanmaz", () => {
    expect(resolveTableConditionStyle([{ ...cellRule, enabled: false }], "total", true, 150, "cells")).toBeUndefined();
  });

  it("panel donusumu kolonu ve hedefi korur", () => {
    expect(fromPanelCondition(toPanelCondition(rowRule))).toEqual(rowRule);
    expect(fromPanelCondition(toPanelCondition(anyNumeric))).toEqual(anyNumeric);
  });
});

describe("yapilandirma JSON", () => {
  const settings: DataTableSettings = {
    columnOrder: ["total", "name"],
    hiddenColumns: ["id"],
    columnLabels: { total: "Tutar" },
    numberFormat: { decimalPlaces: 2 },
    columnNumberFormats: { total: { currencySymbol: "₺" } },
    cellStyles: { totals: { backgroundColor: "#f3f4f6" } },
    conditions: [{ id: "c1", column: "total", operator: "gt", value: 100, target: "row", format: green }],
  };

  it("paylasilabilir JSON geri okunabilir", () => {
    const shareable = toShareableTableSettings(settings);
    expect(shareable.conditions?.[0]).not.toHaveProperty("id");
    const parsed = parseTableSettingsJson(JSON.stringify(shareable));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const { conditions, ...rest } = parsed.settings;
    const { conditions: _expected, ...expectedRest } = settings;
    expect(rest).toEqual(expectedRest);
    expect(conditions?.[0]).toMatchObject({ column: "total", operator: "gt", value: 100, target: "row" });
  });

  it("hatali alanlari bildirir", () => {
    const parsed = parseTableSettingsJson(JSON.stringify({
      columnOrder: "total",
      foo: 1,
      conditions: [{ operator: "gt", target: "row", format: {} }],
    }));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors.some((error) => error.includes("columnOrder"))).toBe(true);
    expect(parsed.errors.some((error) => error.includes('"foo"'))).toBe(true);
    expect(parsed.errors.some((error) => error.includes('"column" verilmeli'))).toBe(true);
  });

  it("tabloda olmayan kolonlari bulur", () => {
    expect(findUnknownSettingColumns(settings, ["total", "name"])).toEqual(["id"]);
  });
});
