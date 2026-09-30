import { describe, expect, it } from "vitest";

import {
  applyPivotFieldLabels,
  buildPivotModel,
  collectExpandablePaths,
  detectPivotFields,
  getPivotFieldValues,
  layoutPivot,
  resolvePivotDimension,
  toPivotDate,
} from "./pivotEngine";

const data = [
  { region: "Ege", city: "İzmir", date: "2025-03-10T09:15:00", amount: 10 },
  { region: "Ege", city: "Aydın", date: "2025-07-02", amount: 20 },
  { region: "Ege", city: "İzmir", date: "2026-01-05T14:00:00", amount: 30 },
  { region: "Marmara", city: "Bursa", date: "2026-01-20", amount: 5 },
  { region: null, city: "Van", date: null, amount: 7 },
];

const dateFields = new Set(["date"]);
const label = (value: { field: string }) => value.field;

const allOptions = (expandedRows: string[] = [], expandedColumns: string[] = []) => ({
  expandedRows: new Set(expandedRows),
  expandedColumns: new Set(expandedColumns),
  showRowTotals: true,
  showColumnTotals: true,
  showRowGrandTotals: true,
  showColumnGrandTotals: true,
});

describe("tarih cozumleme", () => {
  it("saat dilimsiz tarihleri yerel saatle okur", () => {
    const date = toPivotDate("2026-01-01")!;
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 0, 1, 0]);
  });

  it("kirilimlara gore anahtar ve etiket uretir", () => {
    const record = { date: "2025-03-10T09:15:00" };
    expect(resolvePivotDimension(record, "date::year").label).toBe("2025");
    expect(resolvePivotDimension(record, "date::quarter").label).toBe("1. Çeyrek");
    expect(resolvePivotDimension(record, "date::month").label).toBe("Mart");
    expect(resolvePivotDimension(record, "date::day").label).toBe("10");
    expect(resolvePivotDimension(record, "date::hour").label).toBe("09:00");
  });

  it("tarih alanlarini ve alt kirilimlarini tespit eder", () => {
    const fields = detectPivotFields(data, { formatLabel: (key) => key });
    expect(fields.find((field) => field.id === "date")?.isDate).toBe(true);
    expect(fields.filter((field) => field.parentId === "date").map((field) => field.id)).toEqual([
      "date::year", "date::quarter", "date::month", "date::day", "date::hour",
    ]);
    expect(fields.find((field) => field.id === "amount")?.isNumeric).toBe(true);
  });
});

describe("buildPivotModel", () => {
  it("hiyerarsik ara toplamlari ve genel toplami hesaplar", () => {
    const model = buildPivotModel(data, {
      rows: ["region", "city"],
      columns: ["date::year"],
      values: [{ field: "amount", aggregate: "sum" }],
    }, { dateFields });

    expect(model.rowRoot.children.map((node) => node.label)).toEqual(["Ege", "Marmara", "(Boş)"]);
    const ege = model.rowRoot.children[0];
    expect(ege.children.map((node) => node.label)).toEqual(["Aydın", "İzmir"]);
    expect(model.getValue(ege.path, "", 0)).toBe(60);
    expect(model.getValue(ege.path, "2025", 0)).toBe(30);
    expect(model.getValue(ege.children[1].path, "2026", 0)).toBe(30);
    expect(model.getValue("", "", 0)).toBe(72);
  });

  it("filterValues kirilimli alanlarda da calisir", () => {
    const model = buildPivotModel(data, {
      rows: ["region"],
      columns: [],
      values: [{ field: "amount", aggregate: "sum" }],
      filterValues: { "date::year": ["2026"] },
    }, { dateFields });
    expect(model.recordCount).toBe(2);
    expect(model.getValue("", "", 0)).toBe(35);
  });
});

describe("layoutPivot", () => {
  const model = buildPivotModel(data, {
    rows: ["region", "city"],
    columns: ["date::year", "date::month"],
    values: [{ field: "amount", aggregate: "sum" }],
  }, { dateFields });

  it("kapali dugumler tek satir/sutun olarak gorunur", () => {
    const layout = layoutPivot(model, allOptions(), label);
    expect(layout.rowLines.map((line) => line.headers[0].label)).toEqual(["Ege", "Marmara", "(Boş)", "Genel Toplam"]);
    expect(layout.rowLines[0].headers[0]).toMatchObject({ colSpan: 2, expandable: true, expanded: false });
    expect(layout.leafColumns.map((column) => column.kind)).toEqual(["value", "value", "value", "grand"]);
  });

  it("acilan satir cocuklari ve ara toplam satirini ekler", () => {
    const layout = layoutPivot(model, allOptions(["Ege"]), label);
    const lines = layout.rowLines.map((line) => `${line.kind}:${line.headers.map((cell) => cell.label).join("/")}`);
    expect(lines.slice(0, 3)).toEqual(["value:Ege/Aydın", "value:İzmir", "total:Ege Toplam"]);
    expect(layout.rowLines[0].headers[0]).toMatchObject({ rowSpan: 2, colSpan: 1, expanded: true });
  });

  it("acilan sutun ic ice basliklar ve ara toplam sutunu uretir", () => {
    const layout = layoutPivot(model, allOptions([], ["2025"]), label);
    expect(layout.columnHeaderRows[0].map((cell) => [cell.label, cell.colSpan, cell.rowSpan])).toEqual([
      ["2025", 3, 1],
      ["2026", 1, 2],
      ["(Boş)", 1, 2],
      ["Genel Toplam", 1, 2],
    ]);
    expect(layout.columnHeaderRows[1].map((cell) => cell.label)).toEqual(["Mart", "Temmuz", "2025 Toplam"]);
  });

  it("birden fazla deger alani icin deger basligi satiri ekler", () => {
    const multi = buildPivotModel(data, {
      rows: ["region"],
      columns: ["date::year"],
      values: [{ field: "amount", aggregate: "sum" }, { field: "amount", aggregate: "count" }],
    }, { dateFields });
    const layout = layoutPivot(multi, allOptions(), (value) => value.aggregate);
    expect(layout.columnHeaderRows).toHaveLength(2);
    expect(layout.columnHeaderRows[0][0].colSpan).toBe(2);
    expect(layout.leafColumns).toHaveLength(8);
  });

  it("kompakt modda yalnizca acik seviyelerin sutunlarini cizer", () => {
    const collapsed = layoutPivot(model, { ...allOptions(), compactRowHeaders: true }, label);
    expect(collapsed.rowHeaderDepth).toBe(1);
    expect(collapsed.rowLines[0].headers[0]).toMatchObject({ label: "Ege", colSpan: 1 });

    const expanded = layoutPivot(model, { ...allOptions(["Ege"]), compactRowHeaders: true }, label);
    expect(expanded.rowHeaderDepth).toBe(2);
    // Kapali kardes dugum iki sutunu kaplar
    expect(expanded.rowLines.find((line) => line.headers[0]?.label === "Marmara")?.headers[0].colSpan).toBe(2);

    expect(layoutPivot(model, allOptions(), label).rowHeaderDepth).toBe(2);
  });

  it("tum acilabilir yollari toplar", () => {
    expect(collectExpandablePaths(model.rowRoot)).toEqual(["Ege", "Marmara", "__blank__"]);
  });
});

describe("getPivotFieldValues", () => {
  it("ay kirilimini takvim sirasiyla dondurur", () => {
    expect(getPivotFieldValues(data, "date::month", undefined, dateFields).map((item) => item.label)).toEqual([
      "Ocak", "Mart", "Temmuz", "(Boş)",
    ]);
  });
});

describe("applyPivotFieldLabels", () => {
  it("gorunen adi degistirir, varsayilani saklar, bos adi yok sayar", () => {
    const fields = detectPivotFields(data, { formatLabel: (key) => key });
    const renamed = applyPivotFieldLabels(fields, { region: "Bölge", city: "  ", "date::year": "Yıl" });
    expect(renamed.find((field) => field.id === "region")).toMatchObject({ label: "Bölge", defaultLabel: "region" });
    expect(renamed.find((field) => field.id === "city")).toMatchObject({ label: "city" });
    expect(renamed.find((field) => field.id === "date::year")?.label).toBe("Yıl");
    expect(applyPivotFieldLabels(fields, undefined)).toBe(fields);
  });
});
