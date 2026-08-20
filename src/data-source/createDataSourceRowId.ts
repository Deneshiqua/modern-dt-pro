import type { DataTableDataSourceKey } from "../types";

export function createDataSourceRowId<T extends Record<string, unknown>>(
  key: DataTableDataSourceKey<T> | undefined,
): ((row: T) => string) | undefined {
  if (!key) {
    return undefined;
  }

  if (Array.isArray(key)) {
    return (row) => JSON.stringify(key.map((field) => row[field]));
  }

  return (row) => String(row[key as Extract<keyof T, string>]);
}
