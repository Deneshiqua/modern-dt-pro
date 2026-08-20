import type { ColumnFiltersState } from "@tanstack/react-table";

import { BLANK_FILTER_ID } from "../filters/ColumnHeaderFilters";
import type {
  ColumnFilterValue,
  DataTableFilterExpression,
  DataTableFilterOperator,
  DataTableLogicalOperator,
  TextFilterOperator,
} from "../types";

const TEXT_OPERATOR_MAP: Record<TextFilterOperator, DataTableFilterOperator> = {
  contains: "contains",
  notContains: "notcontains",
  startsWith: "startswith",
  endsWith: "endswith",
  equals: "=",
  notEquals: "<>",
};

function combineExpressions(
  expressions: DataTableFilterExpression[],
  operator: DataTableLogicalOperator,
): DataTableFilterExpression | undefined {
  if (expressions.length === 0) {
    return undefined;
  }

  if (expressions.length === 1) {
    return expressions[0];
  }

  return expressions.flatMap((expression, index) =>
    index === 0 ? [expression] : [operator, expression],
  ) as unknown as DataTableFilterExpression;
}

function normalizeColumnFilterValue(value: unknown): ColumnFilterValue {
  if (typeof value === "string") {
    return {
      textFilter: value.trim()
        ? { operator: "contains", value }
        : null,
    };
  }

  if (Array.isArray(value)) {
    return { facetValues: value.map(String) };
  }

  if (value && typeof value === "object") {
    return value as ColumnFilterValue;
  }

  return {};
}

function buildFacetExpression(
  columnId: string,
  values: string[],
): DataTableFilterExpression | undefined {
  const expressions = values.map<DataTableFilterExpression>((value) =>
    value === BLANK_FILTER_ID
      ? [columnId, "isblank"]
      : [columnId, "=", value],
  );

  return combineExpressions(expressions, "or");
}

function buildTextExpression(
  columnId: string,
  textFilter: ColumnFilterValue["textFilter"],
): DataTableFilterExpression | undefined {
  const value = textFilter?.value.trim();
  if (!textFilter || !value) {
    return undefined;
  }

  return [columnId, TEXT_OPERATOR_MAP[textFilter.operator], value];
}

export function columnFiltersToExpression(
  columnFilters: ColumnFiltersState,
): DataTableFilterExpression | undefined {
  const columnExpressions = columnFilters.flatMap<DataTableFilterExpression>(
    ({ id, value }) => {
      const normalized = normalizeColumnFilterValue(value);
      const expressions = [
        buildFacetExpression(id, normalized.facetValues ?? []),
        buildTextExpression(id, normalized.textFilter),
      ].filter((expression): expression is DataTableFilterExpression =>
        expression !== undefined,
      );
      const combined = combineExpressions(expressions, "and");
      return combined ? [combined] : [];
    },
  );

  return combineExpressions(columnExpressions, "and");
}
