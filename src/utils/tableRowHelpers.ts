import type { ColumnDef, Row } from "@tanstack/react-table";

import { isRemoteGroupPlaceholder } from "../data-source/remoteGroups";

export const getColumnSelector = <T,>(
  column: ColumnDef<T, any>,
): string | undefined => {
  if ("accessorKey" in column && typeof column.accessorKey === "string") {
    return column.accessorKey;
  }

  return typeof column.id === "string" ? column.id : undefined;
};

export const countDataRowsInGroup = <T extends Record<string, any>>(row: Row<T>): number => {
  if (!row.getIsGrouped()) {
    return isRemoteGroupPlaceholder(row.original) ? 0 : 1;
  }

  return row.subRows.reduce((total, subRow) => total + countDataRowsInGroup(subRow), 0);
};

// Grup altindaki secilebilir (veri) satirlari
export const getSelectableLeafRows = <T extends Record<string, any>>(row: Row<T>): Row<T>[] => {
  return row.getLeafRows().filter(
    (leaf) => !leaf.getIsGrouped()
      && !isRemoteGroupPlaceholder(leaf.original),
  );
};
