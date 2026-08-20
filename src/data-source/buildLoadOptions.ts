import type {
  ColumnFiltersState,
  GroupingState,
  PaginationState,
  SortingState,
} from "@tanstack/react-table";

import type { DataTableLoadOptions } from "../types";
import { columnFiltersToExpression } from "./columnFiltersToExpression";
import type { ResolvedDataTableRemoteOperations } from "./remoteOperations";

export type BuildDataTableLoadOptionsInput = {
  columnFilters: ColumnFiltersState;
  sorting: SortingState;
  pagination: PaginationState;
  globalFilter: string;
  grouping: GroupingState;
  searchExpr?: string[];
  remoteOperations: ResolvedDataTableRemoteOperations;
};

export function buildDataTableLoadOptions({
  columnFilters,
  sorting,
  pagination,
  globalFilter,
  grouping,
  searchExpr,
  remoteOperations,
}: BuildDataTableLoadOptionsInput): DataTableLoadOptions {
  const loadOptions: DataTableLoadOptions = {};

  if (remoteOperations.filtering) {
    const filter = columnFiltersToExpression(columnFilters);
    if (filter) {
      loadOptions.filter = filter;
    }
  }

  if (remoteOperations.sorting && sorting.length > 0) {
    loadOptions.sort = sorting.map(({ id, desc }) => ({
      selector: id,
      desc,
    }));
  }

  if (remoteOperations.paging) {
    loadOptions.skip = pagination.pageIndex * pagination.pageSize;
    loadOptions.take = pagination.pageSize;
    loadOptions.requireTotalCount = true;
  }

  const searchValue = globalFilter.trim();
  if (remoteOperations.searching && searchValue) {
    if (searchExpr?.length) {
      loadOptions.searchExpr = searchExpr;
    }
    loadOptions.searchOperation = "contains";
    loadOptions.searchValue = searchValue;
  }

  if (remoteOperations.grouping && grouping.length > 0) {
    loadOptions.group = grouping.map((selector) => ({
      selector,
      desc: sorting.find(({ id }) => id === selector)?.desc ?? false,
      isExpanded: true,
    }));
    if (remoteOperations.groupPaging) {
      loadOptions.requireGroupCount = true;
    }
  }

  return loadOptions;
}
