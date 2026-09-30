import { describe, expect, it } from "vitest";

import { buildPivotModel, detectPivotFields } from "./pivotEngine";
import {
  findJsonErrorOffset,
  parsePivotConfigJson,
  parsePivotJson,
  toShareablePivotConfig,
  validatePivotConfig,
} from "./pivotValidation";

describe("parsePivotJson", () => {
  it("nesne listesini kabul eder", () => {
    const result = parsePivotJson('[{"a":1},{"a":2}]');
    expect(result).toEqual({ ok: true, rows: [{ a: 1 }, { a: 2 }], note: undefined });
  });

  it("icinde liste olan nesneyi acar", () => {
    const result = parsePivotJson('{"meta":{},"data":[{"a":1}]}');
    expect(result.ok && result.rows).toEqual([{ a: 1 }]);
    expect(result.ok && result.note).toContain('"data"');
  });

  it("hatali JSON icin satir ve sutun bilgisi verir", () => {
    const result = parsePivotJson('[\n  {"a": 1},\n  {"a": }\n]');
    expect(!result.ok && result.error).toBe('Geçersiz JSON (satır 3, sütun 9): beklenmeyen "}".');
    expect(findJsonErrorOffset('[{"a":1},]')).toBe(9);
    expect(findJsonErrorOffset('[{"a":1}')).toBe(8);
    expect(findJsonErrorOffset('[{"a":"x\\"y"}, true, null, -1.5e3]')).toBeUndefined();
  });

  it("bos liste ve nesne olmayan ogeleri reddeder", () => {
    expect(parsePivotJson("[]")).toMatchObject({ ok: false });
    const result = parsePivotJson('[{"a":1}, 5]');
    expect(!result.ok && result.error).toContain("2. öğe");
    expect(parsePivotJson("")).toMatchObject({ ok: false });
  });
});

describe("validatePivotConfig", () => {
  const data = [
    { region: "Ege", city: "İzmir", amount: 10 },
    { region: "Marmara", city: "Bursa", amount: 5 },
  ];
  const fields = detectPivotFields(data, { formatLabel: (key) => key });

  it("sayisal olmayan alanin toplanmasini hata sayar", () => {
    const issues = validatePivotConfig({ rows: ["region"], columns: [], values: [{ field: "city", aggregate: "sum" }] }, fields);
    expect(issues).toEqual([expect.objectContaining({ level: "error", message: expect.stringContaining("Adet") })]);
    expect(validatePivotConfig({ rows: [], columns: [], values: [{ field: "city", aggregate: "count" }] }, fields)).toEqual([]);
  });

  it("veride olmayan alanlari ve bos veri alanini bildirir", () => {
    const issues = validatePivotConfig({ rows: ["country"], columns: [], values: [] }, fields);
    expect(issues.map((issue) => issue.level)).toEqual(["error", "warning"]);
    expect(issues[0].message).toContain('"country"');
  });

  it("cok fazla sutun olusacaksa uyarir", () => {
    const wide = Array.from({ length: 600 }, (_, index) => ({ code: `K${index}`, amount: 1 }));
    const config = { rows: [], columns: ["code"], values: [{ field: "amount", aggregate: "sum" as const }] };
    const issues = validatePivotConfig(
      config,
      detectPivotFields(wide, { formatLabel: (key) => key }),
      buildPivotModel(wide, config),
    );
    expect(issues).toEqual([expect.objectContaining({ level: "warning", message: expect.stringContaining("600 sütun") })]);
  });
});

describe("yapilandirma disa/ice aktarma", () => {
  const config = {
    rows: ["region", "createdAt::year"],
    columns: ["city"],
    filters: ["status"],
    filterValues: { status: [1, null] },
    values: [{ field: "amount", aggregate: "sum" as const }],
    showColumnGrandTotals: false,
    expandedRows: ["Ege"],
    conditions: [{
      id: "c1",
      operator: "gt" as const,
      value: 100,
      applyTo: "cells" as const,
      measure: { field: "amount", aggregate: "sum" as const },
      format: { backgroundColor: "#dcfce7" },
    }],
  };

  it("acik dugumleri ve kural kimliklerini disarida birakir, geri okunabilir", () => {
    const shareable = toShareablePivotConfig(config);
    expect(shareable).not.toHaveProperty("expandedRows");
    expect(shareable.conditions?.[0]).not.toHaveProperty("id");
    expect(shareable.showColumnGrandTotals).toBe(false);
    expect(shareable).not.toHaveProperty("showRowTotals");

    const parsed = parsePivotConfigJson(JSON.stringify(shareable));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.config.rows).toEqual(["region", "createdAt::year"]);
      expect(parsed.config.filterValues).toEqual({ status: [1, null] });
      expect(parsed.config.conditions?.[0]).toMatchObject({ operator: "gt", value: 100, applyTo: "cells" });
      expect(parsed.config.conditions?.[0].id).toBeTruthy();
    }
  });

  it("yapisal hatalari yol bilgisiyle bildirir", () => {
    const parsed = parsePivotConfigJson(JSON.stringify({
      rows: ["region"],
      columns: ["region"],
      values: [{ field: "amount", aggregate: "toplam" }],
      conditions: [{ operator: "buyuk", format: {} }],
      showRowTotals: "evet",
    }));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors).toEqual([
        'values[0].aggregate geçersiz: "toplam". Geçerli: sum, avg, count, min, max.',
        'conditions[0].operator geçersiz: "buyuk". Geçerli: lt, lte, gt, gte, eq, neq, between, notBetween, empty, notEmpty.',
        '"showRowTotals" true ya da false olmalı.',
        '"region" hem "rows" hem "columns" içinde; bir alan tek bir boyutta olabilir.',
      ]);
    }
  });

  it("gorunen adlari disa aktarir ve dogrular", () => {
    const shareable = toShareablePivotConfig({ ...config, fieldLabels: { region: "Bölge" } });
    expect(shareable.fieldLabels).toEqual({ region: "Bölge" });
    const parsed = parsePivotConfigJson(JSON.stringify(shareable));
    expect(parsed.ok && parsed.config.fieldLabels).toEqual({ region: "Bölge" });
    expect(parsePivotConfigJson('{"fieldLabels": {"region": 5}}')).toMatchObject({ ok: false });
    expect(toShareablePivotConfig({ ...config, fieldLabels: {} })).not.toHaveProperty("fieldLabels");
  });

  it("nesne olmayan ya da bozuk JSON'u reddeder", () => {
    expect(parsePivotConfigJson("[1]")).toMatchObject({ ok: false });
    const broken = parsePivotConfigJson('{"rows": [}');
    expect(!broken.ok && broken.errors[0]).toMatch(/satır 1, sütun 11/);
  });
});
