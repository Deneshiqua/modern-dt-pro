import type {
  AggregationFn,
  CellContext,
  ColumnFiltersState,
  HeaderContext,
  PaginationState,
  SortingState,
} from "@tanstack/react-table";
import type { ReactNode } from "react";

import type { NotifyFn } from "./utils/notify";

declare module "@tanstack/react-table" {
  interface TableMeta<TData> {
    valueMappers?: Record<string, Record<string | number, string>>;
  }

  interface ColumnMeta<TData, TValue> {
    align?: "left" | "right" | "center";
    isSelectColumn?: boolean;
  }
}

export type DataTableType = "server" | "portal" | null;

export type DataTableCellTemplate<T> = (context: CellContext<T, unknown>) => ReactNode;
export type DataTableGroupCellTemplate<T> = (context: CellContext<T, unknown>) => ReactNode;
export type DataTableHeaderTemplate<T> = (context: HeaderContext<T, unknown>) => ReactNode;
export type DataTableAggregate<T> = "sum" | "avg" | "count" | AggregationFn<T>;
export type DataTableTemplateMap<T, TTemplate> = Partial<
  Record<Extract<keyof T, string>, TTemplate>
>;

export type DataTableProps<T> = {
  data: T[];
  title?: string;
  /** Sunucu sayfalamasi ve kontrollu filtre icin. */
  type?: DataTableType;
  excludeColumns?: (keyof T)[];
  /** Sadece bu kolonlari goster (excludeColumns'dan oncelikli). */
  visibleColumns?: (keyof T)[];
  columnLabels?: Record<string, string>;
  valueMappers?: Record<string, Record<string | number, string>>;
  /** Normal veri hucreleri icin kolon bazli renderer. */
  cellTemplate?: DataTableTemplateMap<T, DataTableCellTemplate<T>>;
  /** Grup ve aggregate hucreleri icin kolon bazli renderer. */
  grupCellTemplate?: DataTableTemplateMap<T, DataTableGroupCellTemplate<T>>;
  /** Kolon basliklari icin kolon bazli renderer. */
  headerTemplate?: DataTableTemplateMap<T, DataTableHeaderTemplate<T>>;
  /** Yalnizca acikca tanimlanan kolonlarda aggregate hesaplar. */
  aggregate?: DataTableTemplateMap<T, DataTableAggregate<T>>;
  defaultGrouping?: string[];
  defaultSorting?: SortingState;
  hideInGroupRow?: string[];
  emptyMessage?: string;
  enableRowSelection?: boolean;
  onSelectionChange?: (selectedRows: T[]) => void;
  maxHeight?: string;
  /** Kolon basligina tiklayarak siralama. */
  enableSorting?: boolean;
  /** Kolon basligi altindaki metin filtresi. */
  enableColumnFilter?: boolean;
  /** Kolon basligindaki deger (facet) filtresi. */
  enableColumnHeaderFilter?: boolean;
  /** Toolbar kolon gorunurluk secici. */
  enableColumnPicker?: boolean;
  /** Kolon basligindan surukleyerek genislik ayari. */
  enableColumnResizing?: boolean;
  /** true: kolonlari tablo genisligine orantili sigdirir; false: icerik genisliginde yatay kaydirir. */
  fitColumns?: boolean;
  /** Surukle-birak gruplama alani. */
  enableGrouping?: boolean;
  /** Excel indirme menusu. */
  enableExcelExport?: boolean;
  /** JSON indirme menusu. */
  enableJsonExport?: boolean;
  /** Toolbar global arama. */
  enableSearch?: boolean;
  /** Toolbar tablo gorunumu menusu. */
  enableTableViewMenu?: boolean;
  /** Gorunen satirlar icin sanal kaydirma (DOM'a yalnizca viewport). */
  enableVirtualization?: boolean;
  /** Tablo gorunumu baslangic degerleri. */
  defaultViewSettings?: {
    fullScreen?: boolean;
    rowDense?: boolean;
    columnBorders?: boolean;
    expandGroups?: boolean;
    stickyHeader?: boolean;
    showTitle?: boolean;
    virtualization?: boolean;
    columnResizing?: boolean;
    fitColumns?: boolean;
  };
  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: (filters: ColumnFiltersState) => void;
  pagination?: PaginationState;
  onPaginationChange?: (pagination: PaginationState) => void;
  totalRowCount?: number;
  sqlQuery?: string;
  onDeleteSelected?: () => void | Promise<void>;
  deleteSelectedPopoverDescription?: ReactNode;
  isDeleteSelectedDisabled?: boolean;
  onTransferSelected?: () => void | Promise<void>;
  transferSelectedPopoverDescription?: ReactNode;
  isTransferSelectedDisabled?: boolean;
  onNotify?: NotifyFn;
  toolbarExtra?: ReactNode;
};

export type TextFilterOperator =
  | "contains"
  | "notContains"
  | "startsWith"
  | "endsWith"
  | "equals"
  | "notEquals";

export type ColumnFilterValue = {
  facetValues?: string[] | null;
  textFilter?: {
    operator: TextFilterOperator;
    value: string;
  } | null;
};

export type ExportScope = "selected" | "all";
export type ExportMode = "table" | "raw";

export type ExportOptions = {
  scope: ExportScope;
  mode: ExportMode;
  valueMappers?: Record<string, Record<string | number, string>>;
};

