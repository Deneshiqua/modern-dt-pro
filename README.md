# Modern DataTable Pro

A feature-rich, type-safe React data table built on TanStack Table. It includes grouping, filtering, sorting, row selection, virtualization, column resizing, and Excel/JSON exports out of the box.

## Features

- Automatic columns inferred from your data
- Optional TanStack `ColumnDef` definitions for fully custom columns
- Column sorting, text filters, and faceted value filters
- Drag-and-drop grouping with configurable aggregations
- Row selection with bulk action hooks
- Excel and JSON exports
- Global search and column visibility controls
- Resizable columns, sticky headers, and compact row mode
- Virtualized rendering for large data sets
- Controlled sorting, filtering, pagination, and row selection
- Server-side sorting, filtering, and pagination
- Abortable remote `DataSource` loading with lazy multi-level groups
- Loading, refresh, stable row IDs, and configurable page sizes
- Custom cell, group cell, and header renderers
- Light and dark theme support
- Full TypeScript declarations

## Requirements

- React 18 or later
- React DOM 18 or later

## Installation

```bash
npm install modern-dt-pro
```

You can also install it with pnpm or Yarn:

```bash
pnpm add modern-dt-pro
```

```bash
yarn add modern-dt-pro
```

## Quick start

```tsx
import { DataTable } from "modern-dt-pro";
import "modern-dt-pro/styles.css";

type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  active: boolean;
};

const products: Product[] = [
  {
    id: 1,
    name: "Mechanical Keyboard",
    category: "Accessories",
    price: 129,
    active: true,
  },
  {
    id: 2,
    name: "Ultrawide Monitor",
    category: "Displays",
    price: 699,
    active: true,
  },
];

export function ProductTable() {
  return (
    <DataTable
      data={products}
      title="Products"
      columnLabels={{
        name: "Product",
        category: "Category",
        price: "Price",
        active: "Status",
      }}
      enableRowSelection
      onSelectionChange={(rows) => console.log(rows)}
    />
  );
}
```

## Styling

Import the package stylesheet once in your application entry point:

```tsx
import "modern-dt-pro/styles.css";
```

When using Tailwind CSS v4, add the package build to your source scanning configuration:

```css
@source "../node_modules/modern-dt-pro/dist";
@import "modern-dt-pro/styles.css";
```

The component responds to a `dark` class on an ancestor element:

```tsx
<div className="dark">
  <DataTable data={products} />
</div>
```

## Custom renderers

Renderers are configured by data key. Cell renderers receive TanStack Table's `CellContext`, while header renderers receive `HeaderContext`.

```tsx
<DataTable
  data={products}
  headerTemplate={{
    name: () => <strong>Product</strong>,
  }}
  cellTemplate={{
    price: ({ getValue }) => `$${Number(getValue()).toFixed(2)}`,
    active: ({ getValue }) => (getValue() ? "Available" : "Unavailable"),
  }}
/>
```

## Custom TanStack columns

Pass `columns` when automatic column inference is not enough. Custom TanStack headers and cells are rendered as-is.

```tsx
import type { ColumnDef } from "@tanstack/react-table";

const columns: ColumnDef<Product>[] = [
  {
    accessorKey: "name",
    header: "Product",
    cell: ({ row }) => <strong>{row.original.name}</strong>,
  },
  {
    accessorKey: "price",
    header: "Price",
    cell: ({ getValue }) => `$${Number(getValue()).toFixed(2)}`,
  },
];

<DataTable
  data={products}
  columns={columns}
  getRowId={(row) => String(row.id)}
/>
```

## Grouping and aggregation

Only columns explicitly listed in `aggregate` are aggregated. Built-in options are `sum`, `avg`, and `count`; custom TanStack `AggregationFn` functions are also supported.

```tsx
<DataTable
  data={products}
  defaultGrouping={["category"]}
  aggregate={{
    price: "avg",
    id: "count",
  }}
  grupCellTemplate={{
    price: ({ getValue }) => `$${Number(getValue()).toFixed(2)}`,
  }}
/>
```

> The group renderer prop is named `grupCellTemplate`.

## Value mapping

Use `valueMappers` to display readable labels while keeping raw values in your data:

```tsx
<DataTable
  data={products}
  valueMappers={{
    active: {
      true: "Available",
      false: "Unavailable",
    },
  }}
/>
```

## Server-side mode

Set `type="server"` and control pagination, sorting, and column filters from your application. Pass `totalRowCount` so the table can calculate the available pages. Set `manualSorting` when rows arrive in the requested order from your API.

```tsx
import { useState } from "react";
import type {
  ColumnFiltersState,
  PaginationState,
  SortingState,
} from "@tanstack/react-table";

const [pagination, setPagination] = useState({
  pageIndex: 0,
  pageSize: 10,
});
const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
const [sorting, setSorting] = useState<SortingState>([]);

<DataTable
  type="server"
  data={rows}
  pagination={pagination}
  onPaginationChange={setPagination}
  totalRowCount={totalRowCount}
  columnFilters={columnFilters}
  onColumnFiltersChange={setColumnFilters}
  sorting={sorting}
  onSortingChange={setSorting}
  manualSorting
/>
```

This controlled mode remains supported for applications that already own request state. For new integrations, the `dataSource` API can build and execute load requests directly.

## Remote DataSource

`DataTableDataSource<T>` is transport-independent. Its `load` method receives `DataTableLoadOptions` plus an `AbortSignal`; it may return rows immediately or through a promise. `data` is optional when `dataSource` is present.
Set `key` to one field name or an array of field names for stable single or compound row IDs.

```tsx
import { useMemo, useRef } from "react";
import {
  DataTable,
  serializeLoadOptions,
  type DataTableDataSource,
  type DataTableHandle,
} from "modern-dt-pro";

const tableRef = useRef<DataTableHandle>(null);
const dataSource = useMemo<DataTableDataSource<Product>>(() => ({
  key: "id",
  async load(options, { signal }) {
    const query = serializeLoadOptions(options, {
      parameterNames: {
        skip: "offset",
        take: "limit",
        requireTotalCount: "includeCount",
      },
      transformValue: (value, name) =>
        name === "searchValue" ? String(value).trim() : value,
      omitEmpty: true,
    });
    const response = await fetch(`/api/products?${query}`, { signal });
    return response.json();
  },
}), []);

<DataTable
  ref={tableRef}
  dataSource={dataSource}
  remoteOperations
  defaultGrouping={["category", "brand"]}
/>

await tableRef.current?.reload();
```

`DataTableLoadOptions` can contain `skip`, `take`, `sort`, `filter`, `searchExpr`, `searchOperation`, `searchValue`, `group`, `groupPath`, count requirements, summary descriptors, `select`, and `userData`. Complex values are JSON encoded by `serializeLoadOptions`; primitive values are written directly to `URLSearchParams`.

`remoteOperations` accepts `true` or an object. `true` enables every flag:

- `filtering`
- `sorting`
- `paging`
- `grouping`
- `groupPaging`
- `summary`
- `searching`

The loader returns `DataTableLoadResult<T>`:

```ts
type DataTableLoadResult<T> = {
  data: T[] | DataTableGroupItem<T>[];
  totalCount?: number;
  groupCount?: number;
  summary?: unknown[];
  userData?: unknown;
};

type DataTableGroupItem<T> = {
  key: unknown;
  items?: T[] | DataTableGroupItem<T>[] | null;
  count?: number;
  summary?: unknown[];
};
```

For lazy remote grouping, return top-level group items with `items: null` or `items: undefined`. Expanding a group invokes `load` again with `groupPath` containing all ancestor keys. Return nested group items while grouping levels remain, then return leaf rows at the final level. `groupCount` drives top-level group paging; `totalCount` remains the total leaf count.

## Controlled row selection

Use TanStack `RowSelectionState` when selection must be reset or synchronized outside the table. `getRowId` keeps selection stable across refreshes and server pages.

```tsx
import type { RowSelectionState } from "@tanstack/react-table";

const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

<DataTable
  data={rows}
  enableRowSelection
  rowSelection={rowSelection}
  onRowSelectionChange={setRowSelection}
  getRowId={(row) => String(row.id)}
/>

// Secimi sifirla:
setRowSelection({});
```

## Loading and refresh

```tsx
<DataTable
  data={rows}
  isLoading={isLoading}
  loadingText="Records are loading..."
  onRefresh={loadRows}
  isRefreshing={isRefreshing}
  initialPageSize={20}
  pageSizeOptions={[10, 20, 50, 100]}
  itemLabel="records"
/>
```

## Notifications

Connect a toast library globally with `setDataTableNotify`:

```tsx
import { toast } from "sonner";
import { setDataTableNotify } from "modern-dt-pro";

setDataTableNotify((type, message) => toast[type](message));
```

Alternatively, provide an `onNotify` callback to an individual table.

## Common props

- `data`: local row array; optional when `dataSource` is present
- `dataSource`: optional remote loader; makes `data` optional
- `remoteOperations`: `true` or per-operation remote flags
- `loadDebounceMs`: filter and search request debounce, default `300`
- `columns`: optional TanStack `ColumnDef[]`; disables automatic column inference
- `title`: optional table title
- `visibleColumns`: allowlist of columns to display
- `excludeColumns`: columns to hide
- `columnLabels`: display labels keyed by column name
- `defaultSorting`: initial TanStack sorting state
- `sorting` / `onSortingChange`: controlled sorting state
- `manualSorting`: disables client sorting for server-ordered rows
- `defaultGrouping`: initial grouped column keys
- `enableRowSelection`: enables row selection
- `rowSelection` / `onRowSelectionChange`: controlled row selection
- `getRowId`: stable row identifier
- `enableVirtualization`: enables virtualized rows
- `enableExcelExport` / `enableJsonExport`: controls export menus
- `enableSearch`: controls global search
- `enableColumnResizing`: controls drag-to-resize
- `fitColumns`: fits columns to the available width
- `maxHeight`: limits the table viewport height
- `isLoading` / `loadingText`: loading state and message
- `onRefresh` / `isRefreshing`: toolbar refresh action
- `initialPageSize` / `pageSizeOptions`: pagination defaults
- `itemLabel`: record label used in selection and pagination summaries
- `toolbarExtra`: renders custom toolbar content

See [`DataTableProps`](https://github.com/deneshiqua/modern-dt-pro/blob/main/src/types.ts) for the complete typed API.

## Development

Install dependencies and start the demo:

```bash
pnpm install
pnpm demo
```

The demo runs at `http://localhost:5174`.

Build and type-check the package:

```bash
pnpm test
pnpm typecheck
pnpm build
```

The package build is written to `dist`.

## License

MIT
