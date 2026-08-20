import type {
  DataTableDataSource,
  DataTableFilterExpression,
  DataTableFilterOperator,
  DataTableGroupDescriptor,
  DataTableGroupItem,
  DataTableLoadOptions,
  DataTableSortDescriptor,
} from "modern-dt-pro";

import type { DemoRow } from "./data";

function toText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (
    typeof value === "number"
    || typeof value === "boolean"
    || typeof value === "bigint"
  ) {
    return String(value);
  }
  return JSON.stringify(value) ?? "";
}

function waitForDelay(signal: AbortSignal, delay = 450): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("İstek iptal edildi.", "AbortError"));
      return;
    }

    const timeoutId = window.setTimeout(resolve, delay);
    signal.addEventListener("abort", () => {
      window.clearTimeout(timeoutId);
      reject(new DOMException("İstek iptal edildi.", "AbortError"));
    }, { once: true });
  });
}

function compareValue(
  actual: unknown,
  operator: DataTableFilterOperator,
  expected?: unknown,
): boolean {
  const actualText = toText(actual).toLocaleLowerCase("tr-TR");
  const expectedText = toText(expected).toLocaleLowerCase("tr-TR");

  switch (operator) {
    case "=":
      return actualText === expectedText;
    case "<>":
      return actualText !== expectedText;
    case ">":
      return Number(actual) > Number(expected);
    case ">=":
      return Number(actual) >= Number(expected);
    case "<":
      return Number(actual) < Number(expected);
    case "<=":
      return Number(actual) <= Number(expected);
    case "contains":
      return actualText.includes(expectedText);
    case "notcontains":
      return !actualText.includes(expectedText);
    case "startswith":
      return actualText.startsWith(expectedText);
    case "endswith":
      return actualText.endsWith(expectedText);
    case "isblank":
      return actual === null || actual === undefined || actual === "";
    case "isnotblank":
      return actual !== null && actual !== undefined && actual !== "";
  }
}

function matchesFilter(
  row: DemoRow,
  expression: DataTableFilterExpression,
): boolean {
  if (expression[0] === "!") {
    return !matchesFilter(row, expression[1]);
  }

  if (
    typeof expression[0] === "string"
    && typeof expression[1] === "string"
    && expression[1] !== "and"
    && expression[1] !== "or"
  ) {
    return compareValue(
      row[expression[0] as keyof DemoRow],
      expression[1] as DataTableFilterOperator,
      expression[2],
    );
  }

  let result = matchesFilter(row, expression[0] as DataTableFilterExpression);
  for (let index = 1; index < expression.length; index += 2) {
    const operator = expression[index];
    const next = expression[index + 1] as DataTableFilterExpression;
    result = operator === "or"
      ? result || matchesFilter(row, next)
      : result && matchesFilter(row, next);
  }
  return result;
}

function normalizeArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function applySearch(
  rows: DemoRow[],
  options: DataTableLoadOptions,
): DemoRow[] {
  const searchValue = toText(options.searchValue)
    .trim()
    .toLocaleLowerCase("tr-TR");
  if (!searchValue) {
    return rows;
  }

  const fields = normalizeArray(options.searchExpr);
  return rows.filter((row) =>
    fields.some((field) =>
      String(row[field as keyof DemoRow] ?? "")
        .toLocaleLowerCase("tr-TR")
        .includes(searchValue),
    ),
  );
}

function applySorting(
  rows: DemoRow[],
  sorting: DataTableSortDescriptor[],
): DemoRow[] {
  return [...rows].sort((left, right) => {
    for (const descriptor of sorting) {
      const leftValue = left[descriptor.selector as keyof DemoRow];
      const rightValue = right[descriptor.selector as keyof DemoRow];
      const result = String(leftValue).localeCompare(String(rightValue), "tr", {
        numeric: true,
      });
      if (result !== 0) {
        return descriptor.desc ? -result : result;
      }
    }
    return 0;
  });
}

function paginate<T>(items: T[], options: DataTableLoadOptions): T[] {
  const skip = options.skip ?? 0;
  const take = options.take ?? items.length;
  return items.slice(skip, skip + take);
}

function groupRows(
  rows: DemoRow[],
  descriptor: DataTableGroupDescriptor,
): DataTableGroupItem<DemoRow>[] {
  const groups = new Map<unknown, DemoRow[]>();
  rows.forEach((row) => {
    const key = row[descriptor.selector as keyof DemoRow];
    const current = groups.get(key) ?? [];
    current.push(row);
    groups.set(key, current);
  });

  return Array.from(groups, ([key, groupItems]) => ({
    key,
    count: groupItems.length,
    summary: [
      groupItems.reduce((total, row) => total + row.total, 0),
    ],
    items: undefined,
  })).sort((left, right) => {
    const result = toText(left.key).localeCompare(toText(right.key), "tr", {
      numeric: true,
    });
    return descriptor.desc ? -result : result;
  });
}

export function createRemoteDemoDataSource(
  sourceRows: DemoRow[],
): DataTableDataSource<DemoRow> {
  return {
    key: "id",
    async load(options, { signal }) {
      await waitForDelay(signal);

      let rows = options.filter
        ? sourceRows.filter((row) => matchesFilter(row, options.filter!))
        : [...sourceRows];
      rows = applySearch(rows, options);

      const groupDescriptors = normalizeArray(options.group);
      const groupPath = options.groupPath ?? [];
      groupPath.forEach((key, index) => {
        const selector = groupDescriptors[index]?.selector;
        if (selector) {
          rows = rows.filter(
            (row) => Object.is(row[selector as keyof DemoRow], key),
          );
        }
      });

      rows = applySorting(rows, normalizeArray(options.sort));
      const totalCount = rows.length;
      const activeGroup = groupDescriptors[groupPath.length];

      if (activeGroup) {
        const groups = groupRows(rows, activeGroup);
        return {
          data: paginate(groups, options),
          totalCount,
          groupCount: groups.length,
          summary: [rows.reduce((total, row) => total + row.total, 0)],
        };
      }

      return {
        data: paginate(rows, options),
        totalCount,
        summary: [rows.reduce((total, row) => total + row.total, 0)],
      };
    },
  };
}
