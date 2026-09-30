import { describe, expect, it } from "vitest";

import { createPivotValueFormatter, formatPivotNumber, resolvePivotNumberFormat } from "./pivotNumberFormat";

describe("formatPivotNumber", () => {
  it("varsayilan olarak Turkce bicim kullanir, en fazla 2 ondalik", () => {
    expect(formatPivotNumber(1234567.891)).toBe("1.234.567,89");
    expect(formatPivotNumber(1234.5)).toBe("1.234,5");
    expect(formatPivotNumber(-1234)).toBe("-1.234");
    expect(formatPivotNumber(null)).toBe("");
  });

  it("ayiricilari, sabit ondaligi ve bos degeri uygular", () => {
    const format = { thousandsSeparator: "," as const, decimalSeparator: "." as const, decimalPlaces: 3, nullValue: "-" };
    expect(formatPivotNumber(1234.5, format)).toBe("1,234.500");
    expect(formatPivotNumber(0, { decimalPlaces: 0 })).toBe("0");
    expect(formatPivotNumber(999.5, { decimalPlaces: 0, thousandsSeparator: "" })).toBe("1000");
    expect(formatPivotNumber(null, format)).toBe("-");
  });

  it("para birimi ve yuzde bicimleri", () => {
    expect(formatPivotNumber(1250, { currencySymbol: "₺", decimalPlaces: 2 })).toBe("1.250,00 ₺");
    expect(formatPivotNumber(-1250, { currencySymbol: "$", currencyAlign: "left" })).toBe("-$1.250");
    expect(formatPivotNumber(0.256, { isPercent: true })).toBe("%25,6");
    expect(formatPivotNumber(-0.001, { decimalPlaces: 1 })).toBe("0,0");
  });
});

describe("veri alani bicimi", () => {
  it("alan bicimi varsayilanin ustune yazilir, ozel fonksiyon onceliklidir", () => {
    const defaults = { decimalPlaces: 2, currencySymbol: "₺" };
    const value = { field: "amount", aggregate: "sum" as const, numberFormat: { currencySymbol: "$" , currencyAlign: "left" as const } };
    expect(resolvePivotNumberFormat(defaults, value)).toEqual({ decimalPlaces: 2, currencySymbol: "$", currencyAlign: "left" });
    expect(createPivotValueFormatter(defaults, value)(10)).toBe("$10,00");
    expect(createPivotValueFormatter(defaults, { ...value, format: (n) => `#${n}` })(10)).toBe("#10");
    expect(createPivotValueFormatter({ nullValue: "yok" }, value)(null)).toBe("yok");
  });
});

describe("yapilandirmada sayi bicimi", () => {
  it("disa aktarilir, geri okunur ve hatalar yoluyla bildirilir", async () => {
    const { parsePivotConfigJson, toShareablePivotConfig } = await import("./pivotValidation");
    const config = {
      rows: ["region"],
      columns: [],
      numberFormat: { decimalPlaces: 2, thousandsSeparator: "" as const },
      values: [{ field: "amount", aggregate: "sum" as const, numberFormat: { currencySymbol: "₺" } }],
    };
    const shareable = toShareablePivotConfig(config);
    expect(shareable.numberFormat).toEqual({ decimalPlaces: 2, thousandsSeparator: "" });
    expect(shareable.values[0].numberFormat).toEqual({ currencySymbol: "₺" });
    const parsed = parsePivotConfigJson(JSON.stringify(shareable));
    expect(parsed.ok && parsed.config.values[0].numberFormat).toEqual({ currencySymbol: "₺" });

    const bad = parsePivotConfigJson(JSON.stringify({
      numberFormat: { decimalPlaces: 20, textAlign: "middle", foo: 1 },
      values: [{ field: "amount", aggregate: "sum", numberFormat: { isPercent: "evet" } }],
    }));
    expect(!bad.ok && bad.errors).toEqual([
      "values[0].numberFormat.isPercent true ya da false olmalı.",
      "numberFormat.decimalPlaces 0 ile 10 arasında tam sayı olmalı.",
      'numberFormat.textAlign geçersiz: "middle". Geçerli: "left", "center", "right".',
      "numberFormat.foo tanınmayan ayar.",
    ]);
  });

  it("kisa aciklama uretir", async () => {
    const { describePivotNumberFormat } = await import("./pivotNumberFormat");
    expect(describePivotNumberFormat(undefined)).toBe("Varsayılan");
    expect(describePivotNumberFormat({ decimalPlaces: 2, currencySymbol: "₺", nullValue: "-" })).toBe("2 ondalık · ₺ sağda · boş: -");
  });
});
