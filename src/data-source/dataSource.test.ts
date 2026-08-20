import { describe, expect, it } from "vitest";

import type { DataTableGroupItem } from "../types";
import { buildDataTableLoadOptions } from "./buildLoadOptions";
import { columnFiltersToExpression } from "./columnFiltersToExpression";
import {
  flattenRemoteGroups,
  isRemoteGroupPlaceholder,
  remoteGroupPathKey,
  replaceRemoteGroupItems,
} from "./remoteGroups";
import { resolveRemoteOperations } from "./remoteOperations";
import { serializeLoadOptions } from "./serializeLoadOptions";

describe("serializeLoadOptions", () => {
  it("parametre adlarını ve değerleri dönüştürür", () => {
    const params = serializeLoadOptions(
      {
        skip: 10,
        take: 20,
        sort: [{ selector: "name", desc: true }],
        searchValue: "",
      },
      {
        parameterNames: {
          skip: "offset",
          take: "limit",
          sort: "orderBy",
        },
        transformValue: (value, name) =>
          name === "take" ? Number(value) * 2 : value,
        omitEmpty: true,
      },
    );

    expect(params.get("offset")).toBe("10");
    expect(params.get("limit")).toBe("40");
    expect(params.get("orderBy")).toBe(
      JSON.stringify([{ selector: "name", desc: true }]),
    );
    expect(params.has("searchValue")).toBe(false);
  });
});

describe("columnFiltersToExpression", () => {
  it("facet, boş değer ve metin filtrelerini iç içe birleştirir", () => {
    const expression = columnFiltersToExpression([
      {
        id: "category",
        value: {
          facetValues: ["A", "__blank__"],
          textFilter: {
            operator: "notContains",
            value: "kapalı",
          },
        },
      },
      {
        id: "status",
        value: {
          facetValues: ["active"],
        },
      },
    ]);

    expect(expression).toEqual([
      [
        [
          ["category", "=", "A"],
          "or",
          ["category", "isblank"],
        ],
        "and",
        ["category", "notcontains", "kapalı"],
      ],
      "and",
      ["status", "=", "active"],
    ]);
  });
});

describe("buildDataTableLoadOptions", () => {
  it("uzak işlem state'lerini load options sözleşmesine çevirir", () => {
    const loadOptions = buildDataTableLoadOptions({
      columnFilters: [
        {
          id: "active",
          value: {
            facetValues: ["true"],
          },
        },
      ],
      sorting: [{ id: "name", desc: true }],
      pagination: { pageIndex: 2, pageSize: 10 },
      globalFilter: "  deneme  ",
      grouping: ["country", "city"],
      searchExpr: ["name", "code"],
      remoteOperations: resolveRemoteOperations(true),
    });

    expect(loadOptions).toEqual({
      filter: ["active", "=", "true"],
      sort: [{ selector: "name", desc: true }],
      skip: 20,
      take: 10,
      requireTotalCount: true,
      searchExpr: ["name", "code"],
      searchOperation: "contains",
      searchValue: "deneme",
      group: [
        { selector: "country", desc: false, isExpanded: true },
        { selector: "city", desc: false, isExpanded: true },
      ],
      requireGroupCount: true,
    });
  });
});

describe("resolveRemoteOperations", () => {
  it("true değeriyle bütün uzak işlem bayraklarını açar", () => {
    expect(resolveRemoteOperations(true)).toEqual({
      filtering: true,
      sorting: true,
      paging: true,
      grouping: true,
      groupPaging: true,
      summary: true,
      searching: true,
    });
  });

  it("nesne kullanımında belirtilmeyen bayrakları kapalı bırakır", () => {
    expect(resolveRemoteOperations({ paging: true, searching: true })).toEqual({
      filtering: false,
      sorting: false,
      paging: true,
      grouping: false,
      groupPaging: false,
      summary: false,
      searching: true,
    });
  });
});

describe("remoteGroups", () => {
  type Row = {
    id: number;
    country: string;
    city: string;
    amount: number;
  };

  it("iç içe gruplar için placeholder ve metadata üretir", () => {
    const result = flattenRemoteGroups<Row>(
      [
        {
          key: "Türkiye",
          count: 4,
          summary: [400],
          items: [
            {
              key: "İstanbul",
              count: 2,
              items: undefined,
            },
            {
              key: "Ankara",
              count: 2,
              items: [
                {
                  id: 1,
                  country: "yanlış",
                  city: "yanlış",
                  amount: 100,
                },
              ],
            },
          ],
        },
      ],
      ["country", "city"],
    );

    const istanbulMetadata = result.metadata.get(
      remoteGroupPathKey(["Türkiye", "İstanbul"]),
    );
    const ankaraRow = result.rows.find(
      (row) => !isRemoteGroupPlaceholder(row),
    );

    expect(result.rows.some(isRemoteGroupPlaceholder)).toBe(true);
    expect(istanbulMetadata).toMatchObject({
      count: 2,
      loaded: false,
      path: ["Türkiye", "İstanbul"],
    });
    expect(ankaraRow).toMatchObject({
      country: "Türkiye",
      city: "Ankara",
    });
  });

  it("yüklenen grup öğelerini immutable olarak yerleştirir", () => {
    const groups: DataTableGroupItem<Row>[] = [
      {
        key: "Türkiye",
        count: 2,
        items: [
          {
            key: "İstanbul",
            count: 2,
            items: undefined,
          },
        ],
      },
    ];
    const leaf: Row = {
      id: 7,
      country: "",
      city: "",
      amount: 250,
    };

    const replaced = replaceRemoteGroupItems(
      groups,
      ["Türkiye", "İstanbul"],
      [leaf],
      [250],
    );
    const flattened = flattenRemoteGroups<Row>(
      replaced,
      ["country", "city"],
    );

    expect(replaced).not.toBe(groups);
    expect(replaced[0]).not.toBe(groups[0]);
    expect(
      (groups[0].items?.[0] as DataTableGroupItem<Row>).items,
    ).toBeUndefined();
    expect(
      flattened.metadata.get(
        remoteGroupPathKey(["Türkiye", "İstanbul"]),
      ),
    ).toMatchObject({
      loaded: true,
      summary: [250],
    });
    expect(flattened.rows).toEqual([
      {
        ...leaf,
        country: "Türkiye",
        city: "İstanbul",
      },
    ]);
  });
});
