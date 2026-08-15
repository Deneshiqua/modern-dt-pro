// Import Dependencies

import { Button, Checkbox, Input } from "../ui";
import { Fragment, ReactNode, useMemo, useState, type MouseEvent, type KeyboardEvent } from "react";
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from "@headlessui/react";

import { Table } from "@tanstack/react-table";
import { MagnifyingGlassIcon, ViewColumnsIcon } from "@heroicons/react/24/outline";

// ----------------------------------------------------------------------

function getColumnCaption(column: { id: string; columnDef: { header?: unknown } }): string {
  const header = column.columnDef?.header;
  if (typeof header === "string") {
    return header;
  }
  return column.id;
}

export function TableColumnVisibility({
  table,
  description,
  header,
}: {
  table: Table<any>;
  description: string;
  header: string;
}) {
  const [columnSearch, setColumnSearch] = useState("");
  const { columnVisibility } = table.getState();

  const filteredColumns = useMemo(() => {
    const columns = table.getAllLeafColumns();
    const query = columnSearch.trim().toLocaleLowerCase("tr-TR");
    if (!query) {
      return columns;
    }

    return columns.filter((column) => {
      const columnId = column.id.toLocaleLowerCase("tr-TR");
      const caption = getColumnCaption(column).toLocaleLowerCase("tr-TR");
      return columnId.includes(query) || caption.includes(query);
    });
  }, [table, columnSearch, columnVisibility]);

  return (
    <Popover className="relative w-full">
      <PopoverButton
        isIcon
        variant="flat"
        className="size-8 rounded-full"
        as={Button}
      >
        <ViewColumnsIcon className="size-5" />
      </PopoverButton>
      <Transition
        as={Fragment}
        enter="transition ease-out"
        enterFrom="opacity-0 translate-y-2"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-2"
        afterLeave={() => setColumnSearch("")}
      >
        <PopoverPanel
          static={false}
          anchor={{ to: "bottom end", gap: 8 }}
          className="ring-primary-500/50 dark:border-dark-500 dark:bg-dark-750 absolute z-100 w-72 rounded-md border border-gray-300 bg-white shadow-lg shadow-gray-200/50 outline-hidden focus-visible:ring-3 focus-visible:outline-hidden dark:shadow-none"
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
          }}
        >
          <div
            className="p-4"
            onClick={(e: MouseEvent) => {
              e.stopPropagation();
            }}
          >
            <div className="mb-3">
              <Input
                value={columnSearch}
                onChange={(e) => setColumnSearch(e.target.value)}
                placeholder="Kolon ara (isim / caption)..."
                prefix={<MagnifyingGlassIcon className="size-4" />}
                classNames={{
                  root: "w-full",
                  input: "text-sm",
                }}
                onClick={(e: MouseEvent) => e.stopPropagation()}
                onKeyDown={(e: KeyboardEvent) => e.stopPropagation()}
              />
            </div>

            <h3 className="dark:text-dark-100 text-base font-medium tracking-wide text-gray-800">
              {header}
            </h3>
            <p className="text-xs-plus mt-1 opacity-80">{description}</p>
            <div className="dark:text-dark-100 mt-4 flex max-h-72 flex-col space-y-4 overflow-y-auto text-gray-600">
              {filteredColumns.length === 0 ? (
                <p className="text-xs opacity-70">Eşleşen kolon bulunamadı</p>
              ) : (
                filteredColumns.map((column) => {
                  const label = getColumnCaption(column);

                  return (
                    <Checkbox
                      key={column.id}
                      label={label as ReactNode}
                      checked={column.getIsVisible()}
                      onMouseDown={(e: MouseEvent) => {
                        e.stopPropagation();
                      }}
                      onClick={(e: MouseEvent) => {
                        e.stopPropagation();
                      }}
                      onChange={(e) => {
                        e.stopPropagation();
                        column.toggleVisibility(e.currentTarget.checked);
                      }}
                    />
                  );
                })
              )}
            </div>
          </div>
          <div className="dark:border-dark-500 flex border-t border-gray-300">
            <Button
              variant="flat"
              className="text-xs-plus h-9 flex-1 shrink-0 rounded-none leading-none"
              onClick={(e) => {
                e.stopPropagation();
                table.resetColumnVisibility();
              }}
            >
              Show All
            </Button>
            <div className="dark:bg-dark-500 w-px bg-gray-300" />
            <Button
              variant="flat"
              className="text-xs-plus h-9 flex-1 shrink-0 rounded-none leading-none"
              onClick={(e) => {
                e.stopPropagation();
                table.setColumnVisibility(() => {
                  const next: Record<string, boolean> = {};
                  table.getAllLeafColumns().forEach((column) => {
                    // Secim kolonu her zaman gorunur kalsin
                    next[column.id] = column.id === "select";
                  });
                  return next;
                });
              }}
            >
              Hide All
            </Button>
          </div>
        </PopoverPanel>
      </Transition>
    </Popover>
  );
}
