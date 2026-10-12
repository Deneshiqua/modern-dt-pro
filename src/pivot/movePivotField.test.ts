import { describe, expect, it } from "vitest";

import { movePivotField, type PivotField } from "./PivotFieldChooser";

const field = (id: string, label: string, isNumeric = false, isDate = false): PivotField =>
  ({ id, label, isNumeric, isDate, source: id });

const fields: PivotField[] = [
  field("region", "Bölge"),
  field("city", "Şehir"),
  field("year", "Yıl"),
  field("amount", "Tutar", true),
  field("date", "Tarih", false, true),
];

const base = {
  rows: ["region", "city"],
  columns: ["year"],
  filters: [],
  values: [{ field: "amount", aggregate: "sum" as const }],
};

describe("movePivotField", () => {
  it("boyutu bir alandan digerine tasir", () => {
    const next = movePivotField(base, { field: "year", from: "columns", index: 0 }, "rows", 0, fields);
    expect(next.rows).toEqual(["year", "region", "city"]);
    expect(next.columns).toEqual([]);
  });

  it("ayni alan icinde siralamayi degistirir", () => {
    const next = movePivotField(base, { field: "region", from: "rows", index: 0 }, "rows", undefined, fields);
    expect(next.rows).toEqual(["city", "region"]);
  });

  it("filtre alanina tasininca filtre degerleri korunur, kaldirilinca silinir", () => {
    const withFilter = { ...base, filterValues: { year: [2026] } };
    const moved = movePivotField(withFilter, { field: "year", from: "columns", index: 0 }, "filters", undefined, fields);
    expect(moved.filters).toEqual(["year"]);
    expect(moved.filterValues).toEqual({ year: [2026] });
    const removed = movePivotField(moved, { field: "year", from: "filters", index: 0 }, "all", undefined, fields);
    expect(removed.filters).toEqual([]);
    expect(removed.filterValues).toEqual({});
  });

  it("veri alanina eklenen metin alani adet olarak ozetlenir", () => {
    const next = movePivotField(base, { field: "city", from: "all", index: -1 }, "values", undefined, fields);
    expect(next.values).toEqual([
      { field: "amount", aggregate: "sum" },
      { field: "city", aggregate: "count" },
    ]);
    expect(next.rows).toEqual(["region", "city"]);
  });

  it("ham tarih alani boyuta birakilinca Yil > Ay > Gun kirilimina acilir", () => {
    const next = movePivotField(base, { field: "date", from: "all", index: -1 }, "columns", 0, fields);
    expect(next.columns).toEqual(["date::year", "date::month", "date::day", "year"]);
  });

  it("veri alaninda verilen ad alan baska alana tasininca korunur", () => {
    const renamed = { ...base, values: [{ field: "amount", aggregate: "sum" as const, label: "Ciro" }] };
    const moved = movePivotField(renamed, { field: "amount", from: "values", index: 0 }, "filters", undefined, fields);
    expect(moved.fieldLabels).toEqual({ amount: "Ciro" });
    const back = movePivotField(moved, { field: "amount", from: "filters", index: 0 }, "values", undefined, fields);
    expect(back.values).toEqual([{ field: "amount", aggregate: "sum", label: "Ciro" }]);
  });

  it("veri adi tasininca mevcut alan adinin yerine gecer", () => {
    const renamed = {
      ...base,
      fieldLabels: { amount: "amount" },
      values: [{ field: "amount", aggregate: "sum" as const, label: "Ciro" }],
    };
    const moved = movePivotField(renamed, { field: "amount", from: "values", index: 0 }, "rows", undefined, fields);
    expect(moved.fieldLabels).toEqual({ amount: "Ciro" });
  });

  it("veri alani kaldirilinca alan adi degismez", () => {
    const renamed = {
      ...base,
      fieldLabels: { amount: "Tutar TL" },
      values: [{ field: "amount", aggregate: "sum" as const, label: "Ciro" }],
    };
    const removed = movePivotField(renamed, { field: "amount", from: "values", index: 0 }, "all", undefined, fields);
    expect(removed.fieldLabels).toEqual({ amount: "Tutar TL" });
  });
});
