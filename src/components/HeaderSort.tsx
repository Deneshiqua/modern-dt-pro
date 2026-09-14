import type { Header, Table as TanstackTable } from "@tanstack/react-table";
import clsx from "clsx";
import { flexRender } from "@tanstack/react-table";
import { type DragEvent, useState } from "react";

import { FacetColumnFilter } from "../filters/ColumnHeaderFilters";
import { TableSortIcon } from "./TableSortIcon";

export function HeaderSort<T>({
  header,
  table,
  valueMappers,
  enableSorting,
  enableGrouping,
  enableColumnHeaderFilter,
}: {
  header: Header<T, unknown>;
  table: TanstackTable<T>;
  valueMappers?: Record<string, Record<string | number, string>>;
  enableSorting: boolean;
  enableGrouping: boolean;
  enableColumnHeaderFilter: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const usesCustomHeader = typeof header.column.columnDef.header === "function";

  if (usesCustomHeader) {
    return (
      <div className="flex h-7 min-w-0 items-center gap-0.5">
        <span className="min-w-0 flex-1 truncate text-sm">
          {header.isPlaceholder
            ? null
            : flexRender(header.column.columnDef.header, header.getContext())}
        </span>
        {enableColumnHeaderFilter ? (
          <FacetColumnFilter
            column={header.column}
            table={table}
            valueMappers={valueMappers}
          />
        ) : null}
      </div>
    );
  }

  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", header.column.id);
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const headerTitle = enableSorting && enableGrouping
    ? "Sırala veya gruplamak için sürükle"
    : enableGrouping
      ? "Gruplamak için sürükle"
      : "Sırala";

  return (
    <div
      className={clsx(
        "flex h-7 items-center gap-0.5 select-none transition-opacity",
        isDragging && "opacity-50"
      )}
    >
      <div
        draggable={enableGrouping}
        onDragStart={enableGrouping ? handleDragStart : undefined}
        onDragEnd={enableGrouping ? handleDragEnd : undefined}
        className={clsx(
          "flex min-w-0 flex-1 items-center gap-1",
          enableGrouping ? "cursor-move" : enableSorting ? "cursor-pointer" : "cursor-default",
        )}
        onClick={enableSorting ? header.column.getToggleSortingHandler() : undefined}
        title={headerTitle}
      >
        <span className="min-w-0 flex-1 truncate text-sm">
          {header.isPlaceholder
            ? null
            : flexRender(header.column.columnDef.header, header.getContext())}
        </span>
        {enableSorting ? (
          <span className="inline-flex size-5 shrink-0 items-center justify-center text-gray-400 dark:text-dark-300">
            <TableSortIcon sorted={header.column.getIsSorted()} />
          </span>
        ) : null}
      </div>
      {enableColumnHeaderFilter ? (
        <FacetColumnFilter
          column={header.column}
          table={table}
          valueMappers={valueMappers}
        />
      ) : null}
    </div>
  );
}
