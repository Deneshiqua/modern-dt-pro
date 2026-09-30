import type {
  AggregationFn,
  CellContext,
  ColumnDef,
  ColumnFiltersState,
  HeaderContext,
  OnChangeFn,
  PaginationState,
  Row,
  RowSelectionState,
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

export type DataTableFilterOperator =
  | "="
  | "<>"
  | ">"
  | ">="
  | "<"
  | "<="
  | "contains"
  | "notcontains"
  | "startswith"
  | "endswith"
  | "isblank"
  | "isnotblank";

export type DataTableLogicalOperator = "and" | "or";

export type DataTableBinaryFilterExpression = readonly [
  field: string,
  operator: DataTableFilterOperator,
  value?: unknown,
];

export type DataTableUnaryFilterExpression = readonly [
  operator: "!",
  expression: DataTableFilterExpression,
];

export interface DataTableComplexFilterExpression
  extends ReadonlyArray<DataTableLogicalOperator | DataTableFilterExpression> {
  readonly 0: DataTableFilterExpression;
  readonly 1: DataTableLogicalOperator;
  readonly 2: DataTableFilterExpression;
}

export type DataTableFilterExpression =
  | DataTableBinaryFilterExpression
  | DataTableUnaryFilterExpression
  | DataTableComplexFilterExpression;

export type DataTableSortDescriptor = {
  selector: string;
  desc?: boolean;
};

export type DataTableGroupDescriptor = DataTableSortDescriptor & {
  isExpanded?: boolean;
  groupInterval?: string | number;
};

export type DataTableSummaryType = "sum" | "min" | "max" | "avg" | "count" | "custom";

export type DataTableSummaryDescriptor = {
  selector?: string;
  summaryType: DataTableSummaryType;
};

export type DataTableLoadOptions = {
  skip?: number;
  take?: number;
  sort?: DataTableSortDescriptor | DataTableSortDescriptor[];
  filter?: DataTableFilterExpression;
  searchExpr?: string | string[];
  searchOperation?: DataTableFilterOperator;
  searchValue?: unknown;
  group?: DataTableGroupDescriptor | DataTableGroupDescriptor[];
  groupPath?: unknown[];
  requireTotalCount?: boolean;
  requireGroupCount?: boolean;
  totalSummary?: DataTableSummaryDescriptor | DataTableSummaryDescriptor[];
  groupSummary?: DataTableSummaryDescriptor | DataTableSummaryDescriptor[];
  select?: string | string[];
  userData?: unknown;
};

export type DataTableGroupItem<T> = {
  key: unknown;
  items?: T[] | DataTableGroupItem<T>[] | null;
  count?: number;
  summary?: unknown[];
};

export type DataTableLoadResult<T> = {
  data: T[] | DataTableGroupItem<T>[];
  totalCount?: number;
  groupCount?: number;
  summary?: unknown[];
  userData?: unknown;
};

export type DataTableDataSourceKey<T> =
  | Extract<keyof T, string>
  | readonly Extract<keyof T, string>[];

export type DataTableLoadContext = {
  signal: AbortSignal;
};

export type DataTableDataSource<T> = {
  key?: DataTableDataSourceKey<T>;
  load(
    options: DataTableLoadOptions,
    context: DataTableLoadContext,
  ): DataTableLoadResult<T> | Promise<DataTableLoadResult<T>>;
};

export type DataTableRemoteOperationSettings = {
  filtering?: boolean;
  sorting?: boolean;
  paging?: boolean;
  grouping?: boolean;
  groupPaging?: boolean;
  summary?: boolean;
  searching?: boolean;
};

export type DataTableRemoteOperations = boolean | DataTableRemoteOperationSettings;

export type DataTableHandle = {
  reload(): Promise<void>;
};

export type DataTableCellTemplate<T> = (context: CellContext<T, unknown>) => ReactNode;
export type DataTableGroupCellTemplate<T> = (context: CellContext<T, unknown>) => ReactNode;
export type DataTableHeaderTemplate<T> = (context: HeaderContext<T, unknown>) => ReactNode;
export type DataTableAggregate<T> = "sum" | "avg" | "count" | AggregationFn<T>;
export type DataTableTemplateMap<T, TTemplate> = Partial<
  Record<Extract<keyof T, string>, TTemplate>
>;

export type DataTablePivotAggregate = "sum" | "avg" | "count" | "min" | "max";

/** Pivot arac cubugundaki, Tablo Gorunumu'nden gizlenip gosterilebilen dugmeler. */
export type DataTablePivotToolbarButton =
  | "data"
  | "configuration"
  | "fieldChooser"
  | "cellStyles"
  | "numberFormat"
  | "conditions";

/** Dugme -> baslangicta gorunur mu. Verilmeyenler gorunur. */
export type DataTablePivotToolbar = Partial<Record<DataTablePivotToolbarButton, boolean>>;

/** Pivot veri hucreleri icin sayi bicimi (WebDataRocks "Format cells" benzeri). */
export type DataTablePivotNumberFormat = {
  /** Hucre hizalamasi. Varsayilan: "right". */
  textAlign?: "left" | "center" | "right";
  /** Binlik ayirici. Varsayilan: "." ("" ayirici yok). */
  thousandsSeparator?: "." | "," | " " | "'" | "";
  /** Ondalik ayirici. Varsayilan: ",". */
  decimalSeparator?: "," | ".";
  /** Sabit ondalik basamak (0-10). Verilmezse en fazla 2 basamak, sondaki sifirlar atilir. */
  decimalPlaces?: number;
  /** Para birimi simgesi, ornegin "₺", "$", "TL". */
  currencySymbol?: string;
  /** Simgenin konumu. Varsayilan: "right" ("1.234,50 ₺"). */
  currencyAlign?: "left" | "right";
  /** Bos (degeri olmayan) hucrede gosterilecek metin. Varsayilan: bos. */
  nullValue?: string;
  /** Degeri 100 ile carpip "%" ekler (0,256 -> %25,6). */
  isPercent?: boolean;
};

/** Arka plan ve yazi rengi (onaltilik, ornegin "#dcfce7"). */
export type DataTablePivotColorStyle = {
  backgroundColor?: string;
  /** Verilmezse arka plana gore okunur renk secilir. */
  color?: string;
};

/** Pivot veri hucresi renkleri; hucre turune gore ayri ayri. */
export type DataTablePivotCellStyles = {
  /** Normal veri hucreleri (1. renk). */
  cells?: DataTablePivotColorStyle;
  /**
   * Veri hucreleri 2. renk: verilirse gorunen veri sutunlari sirayla 1. ve 2. renkle boyanir
   * (toplam sutunlari sirayi etkilemez). Burada verilmeyen ayar 1. renkten gelir.
   */
  alternateCells?: DataTablePivotColorStyle;
  /** Ara toplam hucreleri (acilan gruplarin toplam satir/sutunlari). */
  totals?: DataTablePivotColorStyle;
  /** Genel toplam satir/sutunundaki hucreler. */
  grandTotals?: DataTablePivotColorStyle;
};

export type DataTablePivotValue = {
  field: string;
  aggregate: DataTablePivotAggregate;
  /** Sutun basliginda gorunecek ad. Varsayilan: "Miktar (Toplam)" gibi. */
  label?: string;
  /** Bu veri alanina ozel hucre renkleri; `DataTablePivotConfig.cellStyles` uzerine yazilir. */
  cellStyles?: DataTablePivotCellStyles;
  /** Bu veri alanina ozel sayi bicimi; `DataTablePivotConfig.numberFormat` uzerine yazilir. */
  numberFormat?: DataTablePivotNumberFormat;
  /** Ozel bicimlendirici fonksiyon; verilirse numberFormat yerine kullanilir (yapilandirmaya yazilmaz). */
  format?: (value: number) => string;
};

export type DataTablePivotFilterValue = string | number | boolean | null;

export type DataTablePivotConditionOperator =
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "eq"
  | "neq"
  | "between"
  | "notBetween"
  | "empty"
  | "notEmpty";

export type DataTablePivotConditionFormat = {
  backgroundColor?: string;
  color?: string;
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
};

/** Pivot hucreleri icin kosullu bicimlendirme kurali (WebDataRocks "conditions" benzeri). */
export type DataTablePivotCondition = {
  id: string;
  /** Kuralin uygulandigi veri alani; verilmezse tum veri alanlari. */
  measure?: { field: string; aggregate: DataTablePivotAggregate };
  operator: DataTablePivotConditionOperator;
  /** Karsilastirma degeri (between/notBetween icin alt sinir). */
  value?: number;
  /** between/notBetween icin ust sinir. */
  value2?: number;
  /** "all": tum hucreler, "cells": yalnizca normal hucreler, "totals": yalnizca ara/genel toplamlar. */
  applyTo?: "all" | "cells" | "totals";
  format: DataTablePivotConditionFormat;
  /** false ise kural saklanir ama uygulanmaz. */
  enabled?: boolean;
};

/** Tarih alanlari icin kirilim; alan kimligi `createdAt::year` bicimindedir. */
export type DataTablePivotDateInterval = "year" | "quarter" | "month" | "day" | "hour";

export type DataTablePivotConfig<T = Record<string, unknown>> = {
  /**
   * Satir boyutlari (hiyerarsi sirasiyla). Tarih alanlari kirilimla verilebilir:
   * `"createdAt::year"`, `"createdAt::month"`, `"createdAt::day"`, `"createdAt::hour"`.
   */
  rows: (Extract<keyof T, string> | string)[];
  /** Sutun boyutlari (hiyerarsi sirasiyla); satirlarla ayni kurallar. */
  columns: (Extract<keyof T, string> | string)[];
  /** Hesaplanacak deger alanlari. */
  values: DataTablePivotValue[];
  /** Filtre alani: yalnizca filtrelemek icin kullanilan (satir/sutun olmayan) boyutlar. */
  filters?: (Extract<keyof T, string> | string)[];
  /**
   * Alan bazli dahil edilecek degerler. Anahtar yoksa alan filtrelenmez.
   * Bos degerler icin `null` kullanin.
   */
  filterValues?: Partial<Record<Extract<keyof T, string> | string, DataTablePivotFilterValue[]>>;
  /** Acilan satir gruplarinin altinda ara toplam satiri. Varsayilan: true. */
  showRowTotals?: boolean;
  /** Acilan sutun gruplarinin sagindaki ara toplam sutunu. Varsayilan: true. */
  showColumnTotals?: boolean;
  /** En altta genel toplam satiri. Varsayilan: true. */
  showRowGrandTotals?: boolean;
  /** En sagda genel toplam sutunu. Varsayilan: true. */
  showColumnGrandTotals?: boolean;
  /** Acik satir dugumleri (yol anahtarlari). Verilmezse tumu kapali baslar. */
  expandedRows?: string[];
  /** Acik sutun dugumleri (yol anahtarlari). */
  expandedColumns?: string[];
  /** Tum veri alanlari icin varsayilan hucre renkleri (kosullu bicimlendirme bunlarin ustune uygulanir). */
  cellStyles?: DataTablePivotCellStyles;
  /** Tum veri alanlari icin varsayilan sayi bicimi. */
  numberFormat?: DataTablePivotNumberFormat;
  /** Kosullu bicimlendirme kurallari; sirayla uygulanir, sonraki kural oncekini ezer. */
  conditions?: DataTablePivotCondition[];
  /**
   * Satir/sutun/filtre alanlarinin gorunen adlari (alan kimligi -> ad), ornegin
   * `{ "department": "Departman" }`. Veri alanlari icin `values[].label` kullanilir.
   */
  fieldLabels?: Partial<Record<Extract<keyof T, string> | string, string>>;
};

export type DataTableProps<T> = {
  /**
   * Verilirse tablo pivot modunda calisir: `data` satir/sutun boyutlarina gore ozetlenir.
   * Yalnizca istemci tarafi `data` ile calisir (`dataSource` ile desteklenmez).
   */
  pivot?: DataTablePivotConfig<T>;
  /** Pivot ayarlari arac cubugundaki "Pivot" panelinden degistirildiginde cagrilir. */
  onPivotChange?: (pivot: DataTablePivotConfig<T>) => void;
  /** Toolbar'da "Pivot" alan secici penceresi. Varsayilan: pivot verildiyse true. */
  enablePivotPanel?: boolean;
  /** Tablonun ustundeki pivot alan paneli baslangicta acik mi. Tablo Gorunumu'nden degistirilebilir. Varsayilan: false. */
  defaultPivotFieldPanel?: boolean;
  /**
   * Pivot arac cubugunda "Veri" dugmesi: kullanici JSON listesi yapistirir, pivot bu veriyle
   * yeniden olusturulur ve Alan Secici acilir. Varsayilan: false.
   */
  enablePivotDataImport?: boolean;
  /**
   * Pivot arac cubugu dugmelerinin baslangic gorunurlugu, ornegin `{ configuration: false }`.
   * Kullanici Tablo Gorunumu menusunden degistirebilir. Verilmeyen dugmeler gorunur.
   */
  defaultPivotToolbar?: DataTablePivotToolbar;
  /** "Veri" dugmesiyle yeni veri yuklendiginde cagrilir. */
  onPivotDataImport?: (rows: Record<string, unknown>[]) => void;
  data?: T[];
  dataSource?: DataTableDataSource<T>;
  remoteOperations?: DataTableRemoteOperations;
  loadDebounceMs?: number;
  /** Otomatik kolon uretimi yerine kullanilacak TanStack kolon tanimlari. */
  columns?: ColumnDef<T, any>[];
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
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  manualSorting?: boolean;
  hideInGroupRow?: string[];
  emptyMessage?: string;
  enableRowSelection?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  getRowId?: (originalRow: T, index: number, parent?: Row<T>) => string;
  onSelectionChange?: (selectedRows: T[]) => void;
  maxHeight?: string;
  className?: string;
  isLoading?: boolean;
  loadingText?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  pageSizeOptions?: number[];
  itemLabel?: string;
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
  /** Verilirse Tablo Gorunumu ayarlari (yogunluk, sabit baslik, kolon sigdirma vb.) localStorage'da bu anahtar altinda saklanir ve sayfa yenilenince geri yuklenir. */
  stateStorageKey?: string;
  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: (filters: ColumnFiltersState) => void;
  pagination?: PaginationState;
  onPaginationChange?: (pagination: PaginationState) => void;
  initialPageSize?: number;
  totalRowCount?: number;
  sqlQuery?: string;
  onDeleteSelected?: () => void | Promise<void>;
  deleteSelectedPopoverDescription?: ReactNode;
  isDeleteSelectedDisabled?: boolean;
  onTransferSelected?: () => void | Promise<void>;
  transferSelectedPopoverDescription?: ReactNode;
  isTransferSelectedDisabled?: boolean;
  /** Secim barinda sil/aktar disinda ozel aksiyonlar. Serbest icerik icin ReactNode da verilebilir. */
  selectionActions?: ReactNode | SelectionAction[];
  onNotify?: NotifyFn;
  toolbarExtra?: ReactNode;
};

export type SelectionActionVariant = "primary" | "danger" | "neutral";

export type SelectionActionConfirm = {
  title?: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
};

export type SelectionAction = {
  label: string;
  onClick: () => void | Promise<void>;
  /** @default "primary" */
  variant?: SelectionActionVariant;
  icon?: ReactNode;
  disabled?: boolean;
  /** true ise varsayilan metinlerle, obje ise ozellestirilmis baslik/aciklama ile onay istenir. */
  confirm?: boolean | SelectionActionConfirm;
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

