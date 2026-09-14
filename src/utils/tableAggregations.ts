import type { AggregationFn, FilterFn } from "@tanstack/react-table";
import { rankItem } from "@tanstack/match-sorter-utils";

import type { DataTableAggregate } from "../types";
import { isRemoteGroupPlaceholder } from "../data-source/remoteGroups";

export const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
  const itemRank = rankItem(row.getValue(columnId), value);
  addMeta({ itemRank });
  return itemRank.passed;
};

// Aggregate fonksiyonları
export const sumAggregationFn: AggregationFn<any> = (columnId, leafRows) => {
  return leafRows
    .filter((row) => !isRemoteGroupPlaceholder(row.original))
    .reduce((sum, row) => {
      const value = row.getValue(columnId);
      const numValue = typeof value === "number" ? value : parseFloat(String(value));
      return sum + (isNaN(numValue) ? 0 : numValue);
    }, 0);
};

export const avgAggregationFn: AggregationFn<any> = (columnId, leafRows) => {
  const dataRows = leafRows.filter(
    (row) => !isRemoteGroupPlaceholder(row.original),
  );
  const sum = dataRows.reduce((sum, row) => {
    const value = row.getValue(columnId);
    const numValue = typeof value === "number" ? value : parseFloat(String(value));
    return sum + (isNaN(numValue) ? 0 : numValue);
  }, 0);
  return dataRows.length > 0 ? sum / dataRows.length : 0;
};

export const countAggregationFn: AggregationFn<any> = (_columnId, leafRows) => {
  return leafRows.filter(
    (row) => !isRemoteGroupPlaceholder(row.original),
  ).length;
};

export const emptyAggregationFn: AggregationFn<any> = () => undefined;

export const resolveAggregationFn = <T,>(
  aggregation?: DataTableAggregate<T>,
): AggregationFn<T> | undefined => {
  if (typeof aggregation === "function") return aggregation;
  if (aggregation === "sum") return sumAggregationFn;
  if (aggregation === "avg") return avgAggregationFn;
  if (aggregation === "count") return countAggregationFn;
  return undefined;
};
