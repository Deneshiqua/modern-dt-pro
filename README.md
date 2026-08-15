# Modern DataTable Pro

A feature-rich, type-safe React data table built on TanStack Table. It includes grouping, filtering, sorting, row selection, virtualization, column resizing, and Excel/JSON exports out of the box.

## Features

- Automatic columns inferred from your data
- Column sorting, text filters, and faceted value filters
- Drag-and-drop grouping with configurable aggregations
- Row selection with bulk action hooks
- Excel and JSON exports
- Global search and column visibility controls
- Resizable columns, sticky headers, and compact row mode
- Virtualized rendering for large data sets
- Controlled server-side filtering and pagination
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

Set `type="server"` and control pagination and column filters from your application. Pass `totalRowCount` so the table can calculate the available pages.

```tsx
import { useState } from "react";
import type { ColumnFiltersState } from "@tanstack/react-table";

const [pagination, setPagination] = useState({
  pageIndex: 0,
  pageSize: 10,
});
const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

<DataTable
  type="server"
  data={rows}
  pagination={pagination}
  onPaginationChange={setPagination}
  totalRowCount={totalRowCount}
  columnFilters={columnFilters}
  onColumnFiltersChange={setColumnFilters}
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

- `data`: array of row objects
- `title`: optional table title
- `visibleColumns`: allowlist of columns to display
- `excludeColumns`: columns to hide
- `columnLabels`: display labels keyed by column name
- `defaultSorting`: initial TanStack sorting state
- `defaultGrouping`: initial grouped column keys
- `enableRowSelection`: enables row selection
- `enableVirtualization`: enables virtualized rows
- `enableExcelExport` / `enableJsonExport`: controls export menus
- `enableSearch`: controls global search
- `enableColumnResizing`: controls drag-to-resize
- `fitColumns`: fits columns to the available width
- `maxHeight`: limits the table viewport height
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
pnpm typecheck
pnpm build
```

The package build is written to `dist`.

## License

MIT
