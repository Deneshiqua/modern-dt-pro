import {
    AggregationFn,
    ColumnDef,
    ColumnFiltersState,
    ColumnSizingState,
    ExpandedState,
    FilterFn,
    GroupingState,
    Header,
    OnChangeFn,
    PaginationState,
    Row,
    RowSelectionState,
    SortingState,
    Table as TanstackTable,
    VisibilityState,
    flexRender,
    getCoreRowModel,
    getExpandedRowModel,
    getFacetedRowModel,
    getFacetedUniqueValues,
    getFilteredRowModel,
    getGroupedRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowPathIcon, ArrowUpTrayIcon, Bars3Icon, BarsArrowDownIcon, BarsArrowUpIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon, ChevronLeftIcon, ClipboardDocumentIcon, CodeBracketSquareIcon, CommandLineIcon, FunnelIcon, MapPinIcon, TableCellsIcon, TrashIcon, XMarkIcon as XMarkOutlineIcon } from "@heroicons/react/24/outline";
import { Button, Card, PopoverButton, TBody, THead, Table, Td, Th, Tr } from "./ui";
import { ChevronDownIcon, ChevronRightIcon, XMarkIcon } from "@heroicons/react/20/solid";
import { CSSProperties, DragEvent, Fragment, ReactNode, UIEvent, forwardRef, useCallback, useDeferredValue, useEffect, useImperativeHandle, useMemo, useRef, useState, type ForwardedRef, type HTMLProps, type ReactElement, type RefAttributes } from "react";
import { Menu, MenuButton, MenuItem, MenuItems, Transition } from "@headlessui/react";
import { createPortal } from "react-dom";

import { CollapsibleSearch } from "./components/CollapsibleSearch";
import { TableColumnVisibility } from "./components/TableColumnVisibility";
import { TableViewMenu, type TableViewSettings } from "./components/TableViewMenu";
import { ColumnResizeHandle } from "./components/ColumnResizeHandle";
import { TableSortIcon } from "./components/TableSortIcon";
import {
    FacetColumnFilter,
    TextColumnFilter,
    columnFilter,
} from "./filters/ColumnHeaderFilters";
import type {
    DataTableAggregate,
    DataTableGroupItem,
    DataTableHandle,
    DataTableLoadOptions,
    DataTableProps,
    ExportMode,
    ExportOptions,
    ExportScope,
} from "./types";
import { buildDataTableLoadOptions } from "./data-source/buildLoadOptions";
import { createDataSourceRowId } from "./data-source/createDataSourceRowId";
import { resolveRemoteOperations } from "./data-source/remoteOperations";
import {
    flattenRemoteGroups,
    getRemoteGroupPlaceholderPath,
    isDataTableGroupItem,
    isRemoteGroupPlaceholder,
    isRemoteGroupSentinel,
    remoteGroupPathKey,
    replaceRemoteGroupItems,
    type RemoteGroupMetadata,
} from "./data-source/remoteGroups";
import { notify } from "./utils/notify";
import { measureColumnAutoFitWidth, COLUMN_FILTER_MIN_WIDTH } from "./utils/measureColumnWidth";
import clsx from "clsx";
import { rankItem } from "@tanstack/match-sorter-utils";
import * as XLSX from "xlsx";

// ----------------------------------------------------------------------

const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
    const itemRank = rankItem(row.getValue(columnId), value);
    addMeta({ itemRank });
    return itemRank.passed;
};

// Aggregate fonksiyonları
const sumAggregationFn: AggregationFn<any> = (columnId, leafRows) => {
    return leafRows
        .filter((row) => !isRemoteGroupPlaceholder(row.original))
        .reduce((sum, row) => {
        const value = row.getValue(columnId);
        const numValue = typeof value === 'number' ? value : parseFloat(String(value));
        return sum + (isNaN(numValue) ? 0 : numValue);
    }, 0);
};

const avgAggregationFn: AggregationFn<any> = (columnId, leafRows) => {
    const dataRows = leafRows.filter(
        (row) => !isRemoteGroupPlaceholder(row.original),
    );
    const sum = dataRows.reduce((sum, row) => {
        const value = row.getValue(columnId);
        const numValue = typeof value === 'number' ? value : parseFloat(String(value));
        return sum + (isNaN(numValue) ? 0 : numValue);
    }, 0);
    return dataRows.length > 0 ? sum / dataRows.length : 0;
};

const countAggregationFn: AggregationFn<any> = (_columnId, leafRows) => {
    return leafRows.filter(
        (row) => !isRemoteGroupPlaceholder(row.original),
    ).length;
};

const emptyAggregationFn: AggregationFn<any> = () => undefined;

const resolveAggregationFn = <T,>(
    aggregation?: DataTableAggregate<T>,
): AggregationFn<T> | undefined => {
    if (typeof aggregation === "function") return aggregation;
    if (aggregation === "sum") return sumAggregationFn;
    if (aggregation === "avg") return avgAggregationFn;
    if (aggregation === "count") return countAggregationFn;
    return undefined;
};

// Otomatik column formatter - türüne göre uygun display
const isStrictDateTimeString = (value: string): boolean => {
    const normalizedValue = value.trim();

    const isoLikePattern = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)?$/;
    const turkishDateTimePattern = /^\d{2}\.\d{2}\.\d{4}(?: \d{2}:\d{2}(?::\d{2})?)?$/;

    if (!isoLikePattern.test(normalizedValue) && !turkishDateTimePattern.test(normalizedValue)) {
        return false;
    }

    return !Number.isNaN(new Date(normalizedValue).getTime());
};

const formatCellValue = (value: any): string => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "boolean") return value ? "Evet" : "Hayır";
    if (typeof value === "number") return value.toLocaleString("tr-TR");
    if (value instanceof Date) return value.toLocaleDateString("tr-TR");
    if (typeof value === "string" && isStrictDateTimeString(value)) {
        return new Date(value).toLocaleString("tr-TR");
    }
    return String(value);
};

// Türkçe kolon başlığı - camelCase'i boşluklara ayır ve başharfleri büyüt
const formatColumnHeader = (key: string): string => {
    return key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase())
        .trim();
};

const SELECT_COLUMN_CELL_CLASS =
    "w-12 min-w-12 max-w-14 overflow-hidden";

const SELECT_COLUMN_WIDTH = 48;
const MIN_COL_SIZE = 48;
const MAX_COL_SIZE = 640;
const AUTOFIT_SAMPLE_LIMIT = 300;

const EMPTY_GROUPING: GroupingState = [];
const EMPTY_EXPANDED: ExpandedState = {};
const EMPTY_DATA: never[] = [];
const DEFAULT_ROW_HEIGHT = 48;
const DENSE_ROW_HEIGHT = 40;
const VIRTUAL_OVERSCAN = 10;

const isAbortError = (error: unknown): boolean =>
    error instanceof Error && error.name === "AbortError";

const getColumnSelector = <T,>(
    column: ColumnDef<T, any>,
): string | undefined => {
    if ("accessorKey" in column && typeof column.accessorKey === "string") {
        return column.accessorKey;
    }

    return typeof column.id === "string" ? column.id : undefined;
};

const SELECT_COLUMN_STYLE: CSSProperties = {
    width: SELECT_COLUMN_WIDTH,
    minWidth: SELECT_COLUMN_WIDTH,
    maxWidth: 48,
};

const isSelectColumnId = (columnId: string) => columnId === "select";

const isFiniteNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);

type StickyCellKind = "none" | "select" | "group";

const resolveStickyKind = (
    columnIndex: number,
    columnId: string,
    enableRowSelection: boolean,
    stickyEnabled: boolean,
): StickyCellKind => {
    if (isSelectColumnId(columnId)) {
        return stickyEnabled ? "select" : "none";
    }
    const firstContentIndex = enableRowSelection ? 1 : 0;
    if (stickyEnabled && columnIndex === firstContentIndex) {
        return "group";
    }
    return "none";
};

const getStickyCellClassName = (
    kind: StickyCellKind,
    variant: "header" | "body" | "group" | "total",
): string => {
    if (kind === "none") return "";
    return clsx(
        "sticky",
        kind === "group" && "min-w-[14rem]",
        kind === "group" && "shadow-[2px_0_5px_-2px_rgba(0,0,0,0.25)]",
        variant === "header" && "z-20 bg-gray-200 dark:bg-dark-800",
        variant === "body" && "z-[5] bg-white dark:bg-dark-700",
        variant === "group" && "z-[5] bg-gray-50 dark:bg-dark-800",
        variant === "total" && "z-[5] bg-primary-50 dark:bg-primary-900/20",
    );
};

const getStickyCellStyle = (
    kind: StickyCellKind,
    enableRowSelection: boolean,
    base?: CSSProperties,
): CSSProperties | undefined => {
    if (kind === "none") return base;
    return {
        ...base,
        position: "sticky",
        left: kind === "select" ? 0 : (enableRowSelection ? SELECT_COLUMN_WIDTH : 0),
    };
};
const countDataRowsInGroup = <T extends Record<string, any>>(row: Row<T>): number => {
    if (!row.getIsGrouped()) {
        return isRemoteGroupPlaceholder(row.original) ? 0 : 1;
    }

    return row.subRows.reduce((total, subRow) => total + countDataRowsInGroup(subRow), 0);
};

// Grup altindaki secilebilir (veri) satirlari
const getSelectableLeafRows = <T extends Record<string, any>>(row: Row<T>): Row<T>[] => {
    return row.getLeafRows().filter(
        (leaf) => !leaf.getIsGrouped()
            && !isRemoteGroupPlaceholder(leaf.original),
    );
};

const buildExportFilename = (title: string | undefined, extension: string): string => {
    const base = (title || "tablo")
        .trim()
        .replace(/[^\w\u00C0-\u024F.-]+/g, "_")
        .replace(/^_+|_+$/g, "") || "tablo";
    const date = new Date().toISOString().split("T")[0];
    return `${base}-${date}.${extension}`;
};

const getExportableColumns = <T,>(table: TanstackTable<T>, mode: ExportMode) => {
    // Ham data: gizlenmis kolonlar dahil tum kolonlar
    // Tablo gorunumu: sadece gorunen kolonlar
    const columns =
        mode === "raw" ? table.getAllLeafColumns() : table.getVisibleLeafColumns();
    return columns.filter((col) => col.id !== "select");
};

const getExportableRows = <T,>(table: TanstackTable<T>, scope: ExportScope) => {
    const sourceRows =
        scope === "selected"
            ? table.getSelectedRowModel().flatRows
            : table.getFilteredRowModel().rows;

    return sourceRows.filter(
        (row) => !row.getIsGrouped()
            && !isRemoteGroupPlaceholder(row.original),
    );
};

const getColumnHeader = <T,>(table: TanstackTable<T>, columnId: string): string => {
    const column = table.getAllLeafColumns().find((col) => col.id === columnId);
    const header = column?.columnDef.header;
    return typeof header === "string" ? header : columnId;
};

const getExportPropertyKey = <T,>(
    table: TanstackTable<T>,
    columnId: string,
    mode: ExportMode,
): string => (mode === "table" ? getColumnHeader(table, columnId) : columnId);

const resolveExportCellValue = <T,>(
    row: Row<T>,
    columnId: string,
    mode: ExportMode,
    valueMappers?: Record<string, Record<string | number, string>>,
): unknown => {
    const rawValue = row.getValue(columnId);
    if (mode !== "table" || rawValue === null || rawValue === undefined) {
        return rawValue ?? null;
    }

    const mapped = valueMappers?.[columnId]?.[rawValue as string | number];
    return mapped ?? rawValue;
};

const normalizeExportCellValue = (value: unknown): string | number | boolean => {
    if (value === null || value === undefined) return "";
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "boolean") return value ? "Evet" : "Hayır";
    return value as string | number | boolean;
};

const exportTableToExcel = <T,>(
    table: TanstackTable<T>,
    filename: string,
    options: ExportOptions,
) => {
    const rows = getExportableRows(table, options.scope);
    const columns = getExportableColumns(table, options.mode);
    const headers = columns.map((col) => getExportPropertyKey(table, col.id, options.mode));
    const data = rows.map((row) =>
        columns.map((col) =>
            normalizeExportCellValue(
                resolveExportCellValue(row, col.id, options.mode, options.valueMappers),
            ),
        ),
    );

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
    worksheet["!cols"] = headers.map((header, index) => ({
        wch: Math.min(
            Math.max(
                String(header).length,
                ...data.map((row) => String(row[index] ?? "").length)
            ) + 2,
            50
        ),
    }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Veri");
    XLSX.writeFile(workbook, filename);
};

const exportTableToJson = <T,>(
    table: TanstackTable<T>,
    filename: string,
    options: ExportOptions,
) => {
    const rows = getExportableRows(table, options.scope);
    const columns = getExportableColumns(table, options.mode);
    const payload = rows.map((row) => {
        const item: Record<string, unknown> = {};
        columns.forEach((col) => {
            item[getExportPropertyKey(table, col.id, options.mode)] = resolveExportCellValue(
                row,
                col.id,
                options.mode,
                options.valueMappers,
            );
        });
        return item;
    });

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json;charset=utf-8;",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
};

const EXPORT_MENU_SECTIONS: Array<{
    scope: ExportScope;
    title: string;
    items: Array<{ mode: ExportMode }>;
}> = [
    {
        scope: "selected",
        title: "Seçileni İndir",
        items: [{ mode: "table" }, { mode: "raw" }],
    },
    {
        scope: "all",
        title: "Tümü İndir",
        items: [{ mode: "table" }, { mode: "raw" }],
    },
];

function DataTableInner<T extends Record<string, any>>({
    data,
    dataSource,
    remoteOperations,
    loadDebounceMs = 300,
    columns: providedColumns,
    title,
    type = null,
    excludeColumns = [],
    visibleColumns,
    columnLabels,
    valueMappers,
    cellTemplate,
    grupCellTemplate,
    headerTemplate,
    aggregate,
    defaultGrouping = [],
    defaultSorting = [],
    sorting: controlledSorting,
    onSortingChange,
    manualSorting = false,
    hideInGroupRow = [],
    emptyMessage = "Gösterilecek veri bulunamadı",
    enableRowSelection = false,
    rowSelection: controlledRowSelection,
    onRowSelectionChange,
    getRowId,
    onSelectionChange,
    maxHeight = "auto",
    className,
    isLoading = false,
    loadingText = "Yükleniyor...",
    onRefresh,
    isRefreshing = false,
    pageSizeOptions = [10, 20, 50, 100],
    itemLabel = "kayıt",
    enableSorting = true,
    enableColumnFilter = true,
    enableColumnHeaderFilter = true,
    enableColumnPicker = true,
    enableColumnResizing = true,
    fitColumns = true,
    enableGrouping = true,
    enableExcelExport = true,
    enableJsonExport = true,
    enableSearch = true,
    enableTableViewMenu = true,
    enableVirtualization = false,
    defaultViewSettings,
    columnFilters: controlledColumnFilters,
    onColumnFiltersChange,
    pagination: controlledPagination,
    onPaginationChange,
    initialPageSize = 10,
    totalRowCount,
    sqlQuery,
    onDeleteSelected,
    deleteSelectedPopoverDescription,
    isDeleteSelectedDisabled = false,
    onTransferSelected,
    transferSelectedPopoverDescription,
    isTransferSelectedDisabled = false,
    onNotify,
    toolbarExtra,
}: DataTableProps<T>, ref: ForwardedRef<DataTableHandle>) {
    const [internalSorting, setInternalSorting] = useState<SortingState>(defaultSorting);
    const [globalFilter, setGlobalFilter] = useState("");
    const [internalColumnFilters, setInternalColumnFilters] = useState<ColumnFiltersState>([]);
    const [grouping, setGrouping] = useState<GroupingState>(
        enableGrouping ? defaultGrouping : EMPTY_GROUPING,
    );
    const [viewSettings, setViewSettings] = useState<TableViewSettings>({
        fullScreen: defaultViewSettings?.fullScreen ?? false,
        rowDense: defaultViewSettings?.rowDense ?? false,
        columnBorders: defaultViewSettings?.columnBorders ?? true,
        stickyHeader: defaultViewSettings?.stickyHeader ?? true,
        rowSelection: enableRowSelection,
        sorting: enableSorting,
        columnFilter: enableColumnFilter,
        columnHeaderFilter: enableColumnHeaderFilter,
        columnPicker: enableColumnPicker,
        grouping: enableGrouping,
        expandGroups: defaultViewSettings?.expandGroups ?? true,
        excelExport: enableExcelExport,
        jsonExport: enableJsonExport,
        search: enableSearch,
        showTitle: defaultViewSettings?.showTitle ?? true,
        virtualization: defaultViewSettings?.virtualization ?? enableVirtualization,
        columnResizing: defaultViewSettings?.columnResizing ?? enableColumnResizing,
        fitColumns: defaultViewSettings?.fitColumns ?? fitColumns,
    });
    const rowSelectionEnabled = viewSettings.rowSelection;
    const sortingEnabled = viewSettings.sorting;
    const columnFilterEnabled = viewSettings.columnFilter;
    const columnHeaderFilterEnabled = viewSettings.columnHeaderFilter;
    const columnPickerEnabled = viewSettings.columnPicker;
    const columnResizingEnabled = viewSettings.columnResizing;
    const fitColumnsEnabled = viewSettings.fitColumns;
    const groupingEnabled = viewSettings.grouping;
    const excelExportEnabled = viewSettings.excelExport;
    const jsonExportEnabled = viewSettings.jsonExport;
    const searchEnabled = viewSettings.search;
    const [isGroupColumnSticky, setIsGroupColumnSticky] = useState(true);
    const [expanded, setExpanded] = useState<ExpandedState>(
        (defaultViewSettings?.expandGroups ?? true) ? true : {},
    );
    const [internalRowSelection, setInternalRowSelection] = useState<RowSelectionState>({});
    const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
    const [columnSizingCustomized, setColumnSizingCustomized] = useState(false);
    const [draggedGroupIndex, setDraggedGroupIndex] = useState<number | null>(null);
    const [queryTooltip, setQueryTooltip] = useState<{ x: number; y: number } | null>(null);
    const queryButtonRef = useRef<HTMLButtonElement>(null);
    const queryTooltipRef = useRef<HTMLDivElement>(null);
    const tableHeadRef = useRef<HTMLTableSectionElement>(null);
    const tableBodyRef = useRef<HTMLTableSectionElement>(null);
    const tableGridRef = useRef<HTMLDivElement>(null);
    const [internalPagination, setInternalPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: initialPageSize,
    });
    const [remoteRows, setRemoteRows] = useState<T[]>([]);
    const [remoteGroups, setRemoteGroups] = useState<DataTableGroupItem<T>[]>([]);
    const [remoteTotalCount, setRemoteTotalCount] = useState<number>();
    const [remoteGroupCount, setRemoteGroupCount] = useState<number>();
    const [, setRemoteSummary] = useState<unknown[]>();
    const [, setRemoteGroupLoadMetadata] = useState<Record<string, {
        totalCount?: number;
        groupCount?: number;
        summary?: unknown[];
        userData?: unknown;
    }>>({});
    const [remoteGroupLoadingKeys, setRemoteGroupLoadingKeys] = useState<Set<string>>(
        () => new Set(),
    );
    const [isRemoteLoading, setIsRemoteLoading] = useState(false);
    const [isRemoteRefreshing, setIsRemoteRefreshing] = useState(false);
    const remoteRequestIdRef = useRef(0);
    const remoteAbortControllerRef = useRef<AbortController | undefined>(undefined);
    const remoteDebounceKeyRef = useRef<string | undefined>(undefined);
    const remoteGroupGenerationRef = useRef(0);
    const remoteGroupControllersRef = useRef<Map<string, AbortController>>(
        new Map(),
    );
    const expandRemoteGroupsRef = useRef(viewSettings.expandGroups);
    expandRemoteGroupsRef.current = viewSettings.expandGroups;

    const columnFilters = controlledColumnFilters ?? internalColumnFilters;
    const pagination = controlledPagination ?? internalPagination;
    const sorting = controlledSorting ?? internalSorting;
    const rowSelection = controlledRowSelection ?? internalRowSelection;
    const resolvedRemoteOperations = useMemo(
        () => resolveRemoteOperations(remoteOperations),
        [remoteOperations],
    );
    const hasDataSource = Boolean(dataSource);
    const isRemoteFiltering = hasDataSource
        && (resolvedRemoteOperations.filtering || resolvedRemoteOperations.searching);
    const isRemoteSorting = hasDataSource && resolvedRemoteOperations.sorting;
    const isRemotePaging = hasDataSource && resolvedRemoteOperations.paging;
    const isRemoteGrouping = hasDataSource && resolvedRemoteOperations.grouping;
    const remoteGroupView = useMemo(
        () => flattenRemoteGroups(
            remoteGroups,
            grouping,
        ),
        [remoteGroups, grouping],
    );
    const effectiveData = hasDataSource
        ? (isRemoteGrouping && remoteGroups.length > 0
            ? remoteGroupView.rows
            : remoteRows)
        : (data ?? EMPTY_DATA);
    const effectiveTotalRowCount = hasDataSource ? remoteTotalCount : totalRowCount;
    const effectivePageRowCount = isRemoteGrouping
        && grouping.length > 0
        && resolvedRemoteOperations.groupPaging
        ? remoteGroupCount
        : effectiveTotalRowCount;
    const isManualPagination = isRemotePaging
        || (type === "server"
            && controlledPagination !== undefined
            && typeof totalRowCount === "number");
    const isManualFiltering = isRemoteFiltering
        || (type === "server" && controlledColumnFilters !== undefined);
    const isManualSorting = manualSorting || isRemoteSorting;
    const effectiveIsLoading = isLoading || isRemoteLoading;
    const effectiveIsRefreshing = isRefreshing || isRemoteRefreshing;
    const dataSourceRowId = useMemo(
        () => createDataSourceRowId(dataSource?.key),
        [dataSource?.key],
    );
    const effectiveGetRowId = useCallback((
        originalRow: T,
        index: number,
        parent?: Row<T>,
    ): string => {
        const placeholderPath = getRemoteGroupPlaceholderPath(originalRow);
        if (placeholderPath) {
            return `remote-group-placeholder:${remoteGroupPathKey(placeholderPath)}`;
        }

        if (getRowId) {
            return getRowId(originalRow, index, parent);
        }

        return dataSourceRowId?.(originalRow) ?? String(index);
    }, [dataSourceRowId, getRowId]);

    const handleSortingChange: OnChangeFn<SortingState> = (updaterOrValue) => {
        const nextSorting = typeof updaterOrValue === "function"
            ? updaterOrValue(sorting)
            : updaterOrValue;

        setInternalSorting(nextSorting);
        onSortingChange?.(nextSorting);
    };

    const handleRowSelectionChange: OnChangeFn<RowSelectionState> = (updaterOrValue) => {
        const nextSelection = typeof updaterOrValue === "function"
            ? updaterOrValue(rowSelection)
            : updaterOrValue;

        setInternalRowSelection(nextSelection);
        onRowSelectionChange?.(nextSelection);
    };

    const handleColumnFiltersChange: OnChangeFn<ColumnFiltersState> = (updaterOrValue) => {
        const nextColumnFilters = typeof updaterOrValue === 'function'
            ? updaterOrValue(columnFilters)
            : updaterOrValue;

        setInternalColumnFilters(nextColumnFilters);
        onColumnFiltersChange?.(nextColumnFilters);
    };

    const handlePaginationChange: OnChangeFn<PaginationState> = (updaterOrValue) => {
        const nextPagination = typeof updaterOrValue === 'function'
            ? updaterOrValue(pagination)
            : updaterOrValue;

        setInternalPagination(nextPagination);
        onPaginationChange?.(nextPagination);
    };

    const handleColumnSizingChange: OnChangeFn<ColumnSizingState> = (updaterOrValue) => {
        setColumnSizingCustomized(true);
        setColumnSizing((prev) => (
            typeof updaterOrValue === "function"
                ? updaterOrValue(prev)
                : updaterOrValue
        ));
    };

    const deferredGlobalFilter = useDeferredValue(globalFilter);
    const onSelectionChangeRef = useRef(onSelectionChange);
    const pageResetKey = JSON.stringify({
        columnFilters,
        globalFilter,
        grouping,
        sorting,
    });
    const pageResetKeyRef = useRef(pageResetKey);
    onSelectionChangeRef.current = onSelectionChange;

    useEffect(() => {
        if (pageResetKeyRef.current === pageResetKey) {
            return;
        }

        pageResetKeyRef.current = pageResetKey;
        if (pagination.pageIndex !== 0) {
            handlePaginationChange({
                ...pagination,
                pageIndex: 0,
            });
        }
    }, [pageResetKey, pagination]);

    // Veri degistiginde secimi sifirla
    useEffect(() => {
        if (controlledRowSelection === undefined) {
            setInternalRowSelection({});
        }
    }, [controlledRowSelection, effectiveData]);

    useEffect(() => {
        setViewSettings((current) => ({
            ...current,
            rowSelection: enableRowSelection,
            sorting: enableSorting,
            columnFilter: enableColumnFilter,
            columnHeaderFilter: enableColumnHeaderFilter,
            columnPicker: enableColumnPicker,
            grouping: enableGrouping,
            excelExport: enableExcelExport,
            jsonExport: enableJsonExport,
            search: enableSearch,
            fitColumns,
        }));
        if (!enableGrouping) {
            setGrouping(EMPTY_GROUPING);
        }
        if (!enableRowSelection) {
            handleRowSelectionChange({});
        }
    }, [
        enableRowSelection,
        enableSorting,
        enableColumnFilter,
        enableColumnHeaderFilter,
        enableColumnPicker,
        enableGrouping,
        enableExcelExport,
        enableJsonExport,
        enableSearch,
        fitColumns,
    ]);

    useEffect(() => {
        if (!viewSettings.fullScreen) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [viewSettings.fullScreen]);

    const handleViewSettingsChange = (patch: Partial<TableViewSettings>) => {
        const next = { ...viewSettings, ...patch };
        setViewSettings(next);

        if (patch.grouping === false) {
            setGrouping(EMPTY_GROUPING);
            setExpanded(EMPTY_EXPANDED);
            return;
        }

        if (patch.sorting === false) {
            handleSortingChange(defaultSorting);
        }

        if (patch.columnFilter === false && !next.columnHeaderFilter) {
            setInternalColumnFilters([]);
            onColumnFiltersChange?.([]);
        }

        if (patch.columnHeaderFilter === false && !next.columnFilter) {
            setInternalColumnFilters([]);
            onColumnFiltersChange?.([]);
        }

        if (patch.search === false) {
            setGlobalFilter("");
        }

        if (patch.rowSelection === false) {
            handleRowSelectionChange({});
        }

        if (patch.columnResizing === false) {
            setColumnSizing({});
            setColumnSizingCustomized(false);
        }

        if (patch.fitColumns !== undefined) {
            setColumnSizing({});
            setColumnSizingCustomized(false);
        }

        if (patch.expandGroups === false) {
            setExpanded(EMPTY_EXPANDED);
            return;
        }

        if (next.grouping && next.expandGroups && (patch.grouping === true || patch.expandGroups === true)) {
            setExpanded(true);
        }
    };

    // Drag & Drop handlers for columns to grouping area
    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const columnId = e.dataTransfer.getData('text/plain');
        if (columnId && !grouping.includes(columnId)) {
            setGrouping([...grouping, columnId]);
        }
    };

    const removeGrouping = (columnId: string) => {
        setGrouping(grouping.filter(g => g !== columnId));
    };

    // Grup chipinden siralama: yok -> artan -> azalan -> yok
    const toggleGroupingSort = (columnId: string) => {
        handleSortingChange((current) => {
            const otherSorting = current.filter((item) => item.id !== columnId);
            const columnSorting = current.find((item) => item.id === columnId);

            if (!columnSorting) {
                return [...otherSorting, { id: columnId, desc: false }];
            }
            if (!columnSorting.desc) {
                return [...otherSorting, { id: columnId, desc: true }];
            }
            return otherSorting;
        });
    };

    // Drag & Drop handlers for reordering groups
    const handleGroupDragStart = (e: DragEvent<HTMLDivElement>, index: number) => {
        setDraggedGroupIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('groupIndex', index.toString());
    };

    const handleGroupDragOver = (e: DragEvent<HTMLDivElement>, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (draggedGroupIndex !== null && draggedGroupIndex !== index) {
            const newGrouping = [...grouping];
            const draggedItem = newGrouping[draggedGroupIndex];
            newGrouping.splice(draggedGroupIndex, 1);
            newGrouping.splice(index, 0, draggedItem);
            setGrouping(newGrouping);
            setDraggedGroupIndex(index);
        }
    };

    const handleGroupDragEnd = () => {
        setDraggedGroupIndex(null);
    };

    // Otomatik column generation - TÜM kolonları oluştur
    const generatedColumns = useMemo<ColumnDef<T>[]>(() => {
        const firstRow = effectiveData[0];

        // visibleColumns varsa, önce onları sırayla ekle, sonra geri kalanları
        // Bu sayede kolon sıralaması visibleColumns'a göre olur
        let keys: string[];
        if (visibleColumns && visibleColumns.length > 0) {
            // Önce visibleColumns'daki kolonlar (sırasıyla)
            const visibleKeys = visibleColumns
                .map(col => String(col))
                .filter(key => !excludeColumns.includes(key as keyof T));

            // Sonra diğer kolonlar (visibleColumns'da olmayanlar)
            const otherKeys = firstRow
                ? Object.keys(firstRow).filter(
                    (key) => !excludeColumns.includes(key as keyof T) && !visibleColumns.includes(key as keyof T)
                )
                : [];

            keys = [...visibleKeys, ...otherKeys];
        } else if (firstRow) {
            // visibleColumns yoksa, tüm kolonları al (excludeColumns hariç)
            keys = Object.keys(firstRow).filter(
                (key) => !excludeColumns.includes(key as keyof T)
            );
        } else if (columnLabels) {
            keys = Object.keys(columnLabels).filter(
                (key) => !excludeColumns.includes(key as keyof T)
            );
        } else {
            keys = [];
        }

        const dataColumns: ColumnDef<T>[] = keys.map((key) => {
            const sampleValue = firstRow?.[key];
            const isNumeric = isFiniteNumber(sampleValue);
            const columnValueMapper = valueMappers?.[key]; // Bu kolon için value mapper var mı?
            const templateKey = key as Extract<keyof T, string>;
            const customCellTemplate = cellTemplate?.[templateKey];
            const customGroupCellTemplate = grupCellTemplate?.[templateKey];
            const customHeaderTemplate = headerTemplate?.[templateKey];
            const columnAggregate = aggregate?.[templateKey];
            const resolvedAggregationFn = resolveAggregationFn(columnAggregate);

            return {
                accessorKey: key,
                id: key,
                header: customHeaderTemplate
                    ? (context) => customHeaderTemplate(context)
                    : columnLabels?.[key] || formatColumnHeader(key),
                filterFn: columnFilter as FilterFn<T>,
                cell: customCellTemplate ?? (({ getValue }) => {
                    const value = getValue();
                    // Önce valueMapper'a bak, yoksa normal formatCellValue kullan
                    let displayValue: string;
                    if (columnValueMapper && (value !== null && value !== undefined)) {
                        displayValue = columnValueMapper[value as string | number] ?? formatCellValue(value);
                    } else {
                        displayValue = formatCellValue(value);
                    }

                    return (
                        <div className={isNumeric ? 'text-right text-sm' : 'text-left text-sm'}>
                            {displayValue}
                        </div>
                    );
                }),
                ...(resolvedAggregationFn
                    ? {
                        aggregationFn: resolvedAggregationFn,
                        aggregatedCell: customGroupCellTemplate ?? (({ getValue }) => {
                            const value = getValue();
                            if (typeof value === 'number') {
                                return <div className="text-right"><span className="font-semibold text-primary-600">{value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span></div>;
                            }
                            return <div className="text-right"><span className="font-semibold text-primary-600">{String(value)}</span></div>;
                        }),
                    }
                    : {
                        aggregationFn: emptyAggregationFn,
                        aggregatedCell: () => null,
                    }),
                enableGrouping: groupingEnabled,
                enableSorting: sortingEnabled,
                enableColumnFilter: columnFilterEnabled || columnHeaderFilterEnabled,
                enableResizing: columnResizingEnabled,
                meta: {
                    align: isNumeric ? 'right' : 'left'
                }
            };
        });

        // Eger row selection aktifse, basa checkbox kolonu ekle
        if (rowSelectionEnabled) {
            const selectionColumn: ColumnDef<T> = {
                id: 'select',
                size: SELECT_COLUMN_WIDTH,
                minSize: SELECT_COLUMN_WIDTH,
                maxSize: SELECT_COLUMN_WIDTH,
                header: ({ table }) => {
                    const isAllSelected = table.getIsAllRowsSelected();
                    const isSomeSelected = table.getIsSomeRowsSelected();

                    return (
                        <IndeterminateCheckbox
                            checked={isAllSelected}
                            indeterminate={isSomeSelected}
                            onChange={table.getToggleAllRowsSelectedHandler()}
                        />
                    );
                },
                cell: ({ row }) => {
                    // Grup satirlari icin checkbox gosterme; alt satirlardan secim yapilir
                    if (row.getIsGrouped()) {
                        return null;
                    }

                    return (
                        <input
                            type="checkbox"
                            checked={row.getIsSelected()}
                            disabled={!row.getCanSelect()}
                            onChange={row.getToggleSelectedHandler()}
                            className="dtp-checkbox size-4 cursor-pointer"
                        />
                    );
                },
                enableSorting: false,
                enableGrouping: false,
                enableColumnFilter: false,
                enableResizing: false,
                meta: {
                    align: 'center',
                    isSelectColumn: true,
                },
            };
            return [selectionColumn, ...dataColumns];
        }

        return dataColumns;
    }, [effectiveData, excludeColumns, columnLabels, rowSelectionEnabled, visibleColumns, valueMappers, cellTemplate, grupCellTemplate, headerTemplate, aggregate, groupingEnabled, sortingEnabled, columnFilterEnabled, columnHeaderFilterEnabled, columnResizingEnabled]);

    const columns = providedColumns ?? generatedColumns;

    // Initial column visibility state - visibleColumns varsa sadece onları göster
    const initialColumnVisibility = useMemo<VisibilityState>(() => {
        if (!visibleColumns || visibleColumns.length === 0) return {};

        // Tüm kolonları gizli yap
        const visibility: VisibilityState = {};
        if (effectiveData.length > 0) {
            const firstRow = effectiveData[0];
            Object.keys(firstRow).forEach(key => {
                if (!excludeColumns.includes(key as keyof T)) {
                    visibility[key] = false;
                }
            });
        }

        // Sadece visibleColumns'dakileri göster
        visibleColumns.forEach(col => {
            visibility[String(col)] = true;
        });

        return visibility;
    }, [effectiveData, visibleColumns, excludeColumns]);

    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(initialColumnVisibility);

    // ref ile initialColumnVisibility'nin ilk değerini saklayalım
    const lastInitialVisibilityRef = useRef<string>('');

    // Veri/visibleColumns/grouping değiştiğinde kolon görünürlüğünü senkronize et
    // ANCAK kullanıcı manuel değişiklik yaptıysa korumalıyız
    useEffect(() => {
        // initialColumnVisibility'nin serialize edilmiş halini kontrol et
        const currentInitialSerialized = JSON.stringify(initialColumnVisibility);

        // Eğer initialColumnVisibility gerçekten değiştiyse (yeni data geldi, visibleColumns değişti)
        // o zaman senkronize et, aksi halde kullanıcı değişikliklerini koru
        const shouldReset = lastInitialVisibilityRef.current !== currentInitialSerialized;

        if (shouldReset) {
            lastInitialVisibilityRef.current = currentInitialSerialized;

            setColumnVisibility(prev => {
                const newVisibility: VisibilityState = {};

                if (Object.keys(initialColumnVisibility).length > 0) {
                    Object.assign(newVisibility, initialColumnVisibility);
                } else if (effectiveData.length > 0) {
                    const firstRow = effectiveData[0];
                    Object.keys(firstRow).forEach((key) => {
                        if (!excludeColumns.includes(key as keyof T)) {
                            newVisibility[key] = true;
                        }
                    });
                }

                // Gruplanan kolonları gizle
                grouping.forEach(groupedColumn => {
                    newVisibility[groupedColumn] = false;
                });

                // Sadece gerçekten değişiklik varsa güncelle
                const allKeys = new Set([...Object.keys(prev), ...Object.keys(newVisibility)]);
                const hasChanged = Array.from(allKeys).some((key) => newVisibility[key] !== prev[key]);
                return hasChanged ? newVisibility : prev;
            });
        } else {
            // Sadece grouping değişikliklerini uygula, diğer visibility ayarlarını koru
            const hasGroupingChange = grouping.some(col => columnVisibility[col] !== false);
            if (hasGroupingChange) {
                setColumnVisibility(prev => {
                    const newVisibility = { ...prev };

                    // Gruplanan kolonları gizle
                    grouping.forEach(groupedColumn => {
                        newVisibility[groupedColumn] = false;
                    });

                    return newVisibility;
                });
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialColumnVisibility, grouping]);

    const discoveredSearchExpr = useMemo(
        () => columns
            .map(getColumnSelector)
            .filter((selector): selector is string => Boolean(selector) && selector !== "select"),
        [columns],
    );
    const searchExprRef = useRef<string[]>(discoveredSearchExpr);
    if (discoveredSearchExpr.length > 0) {
        searchExprRef.current = discoveredSearchExpr;
    }
    const searchExpr = discoveredSearchExpr.length > 0
        ? discoveredSearchExpr
        : searchExprRef.current;
    const loadOptions = useMemo<DataTableLoadOptions>(
        () => buildDataTableLoadOptions({
            columnFilters,
            sorting,
            pagination,
            globalFilter: deferredGlobalFilter,
            grouping,
            searchExpr,
            remoteOperations: resolvedRemoteOperations,
        }),
        [
            columnFilters,
            sorting,
            pagination,
            deferredGlobalFilter,
            grouping,
            searchExpr,
            resolvedRemoteOperations,
        ],
    );
    const loadOptionsKey = JSON.stringify(loadOptions);
    const remoteDebounceKey = JSON.stringify({
        filter: loadOptions.filter,
        searchExpr: loadOptions.searchExpr,
        searchOperation: loadOptions.searchOperation,
        searchValue: loadOptions.searchValue,
    });
    const remoteGroupCacheKey = isRemoteGrouping
        ? JSON.stringify({
            columnFilters,
            globalFilter: deferredGlobalFilter,
            grouping,
            sorting,
        })
        : "";

    const clearRemoteGroupCache = useCallback(() => {
        if (!isRemoteGrouping) {
            return;
        }

        remoteGroupGenerationRef.current += 1;
        remoteGroupControllersRef.current.forEach((controller) => controller.abort());
        remoteGroupControllersRef.current.clear();
        setRemoteGroups([]);
        setRemoteGroupLoadingKeys(new Set());
        setRemoteGroupLoadMetadata({});
        setExpanded(expandRemoteGroupsRef.current ? true : {});
    }, [isRemoteGrouping]);

    const executeRemoteLoad = useCallback(async (
        options: DataTableLoadOptions,
        refreshing = false,
    ): Promise<void> => {
        if (!dataSource) {
            return;
        }

        remoteAbortControllerRef.current?.abort();
        const controller = new AbortController();
        remoteAbortControllerRef.current = controller;
        const requestId = ++remoteRequestIdRef.current;
        clearRemoteGroupCache();
        setIsRemoteLoading(!refreshing);
        setIsRemoteRefreshing(refreshing);

        try {
            const result = await dataSource.load(options, {
                signal: controller.signal,
            });

            if (requestId !== remoteRequestIdRef.current || controller.signal.aborted) {
                return;
            }

            const containsGroupItems = result.data.some(isDataTableGroupItem);
            const expectsGroups = options.group !== undefined;
            if (containsGroupItems || (expectsGroups && result.data.length === 0)) {
                setRemoteGroups(result.data as DataTableGroupItem<T>[]);
                setRemoteRows([]);
            } else {
                setRemoteGroups([]);
                setRemoteRows(result.data as T[]);
            }
            setRemoteTotalCount(
                result.totalCount
                ?? (containsGroupItems ? undefined : result.data.length),
            );
            setRemoteGroupCount(
                result.groupCount
                ?? (containsGroupItems ? result.data.length : undefined),
            );
            setRemoteSummary(result.summary);
        } catch (error) {
            if (!isAbortError(error) && requestId === remoteRequestIdRef.current) {
                notify("error", "Veriler yüklenirken bir hata oluştu.", onNotify);
            }
        } finally {
            if (requestId === remoteRequestIdRef.current) {
                setIsRemoteLoading(false);
                setIsRemoteRefreshing(false);
            }
        }
    }, [clearRemoteGroupCache, dataSource, onNotify]);

    useEffect(() => {
        if (!dataSource) {
            remoteAbortControllerRef.current?.abort();
            remoteGroupGenerationRef.current += 1;
            remoteGroupControllersRef.current.forEach(
                (controller) => controller.abort(),
            );
            remoteGroupControllersRef.current.clear();
            setRemoteGroupLoadingKeys(new Set());
            setIsRemoteLoading(false);
            setIsRemoteRefreshing(false);
            return;
        }

        remoteAbortControllerRef.current?.abort();
        const previousDebounceKey = remoteDebounceKeyRef.current;
        remoteDebounceKeyRef.current = remoteDebounceKey;
        const shouldDebounce = previousDebounceKey !== undefined
            && previousDebounceKey !== remoteDebounceKey;
        const timeoutId = globalThis.setTimeout(
            () => void executeRemoteLoad(loadOptions),
            shouldDebounce ? Math.max(0, loadDebounceMs) : 0,
        );

        return () => {
            globalThis.clearTimeout(timeoutId);
            remoteAbortControllerRef.current?.abort();
        };
        // loadOptionsKey, yukleme seceneklerindeki yapisal degisiklikleri izler.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        dataSource,
        executeRemoteLoad,
        loadDebounceMs,
        loadOptionsKey,
        remoteDebounceKey,
        remoteGroupCacheKey,
    ]);

    const reloadRemoteData = useCallback(
        () => executeRemoteLoad(loadOptions, true),
        [executeRemoteLoad, loadOptions],
    );

    useImperativeHandle(ref, () => ({
        reload: reloadRemoteData,
    }), [reloadRemoteData]);

    const handleRefresh = useCallback(async () => {
        if (dataSource) {
            await reloadRemoteData();
        }
        onRefresh?.();
    }, [dataSource, onRefresh, reloadRemoteData]);

    const loadRemoteGroup = useCallback(async (path: unknown[]): Promise<void> => {
        if (!dataSource || !isRemoteGrouping) {
            return;
        }

        const pathKey = remoteGroupPathKey(path);
        const metadata = remoteGroupView.metadata.get(pathKey);
        if (metadata?.loaded || remoteGroupControllersRef.current.has(pathKey)) {
            return;
        }

        const controller = new AbortController();
        const generation = remoteGroupGenerationRef.current;
        remoteGroupControllersRef.current.set(pathKey, controller);
        setRemoteGroupLoadingKeys((current) => {
            const next = new Set(current);
            next.add(pathKey);
            return next;
        });

        try {
            let result = await dataSource.load({
                ...loadOptions,
                groupPath: path,
                skip: 0,
                take: pagination.pageSize,
                requireGroupCount: true,
            }, {
                signal: controller.signal,
            });

            if (
                controller.signal.aborted
                || generation !== remoteGroupGenerationRef.current
                || remoteGroupControllersRef.current.get(pathKey) !== controller
            ) {
                return;
            }

            const collectedItems = [...result.data];
            const containsNestedGroups = collectedItems.some(isDataTableGroupItem);
            const expectedItemCount = containsNestedGroups
                ? result.groupCount
                : result.totalCount;

            while (
                typeof expectedItemCount === "number"
                && collectedItems.length < expectedItemCount
            ) {
                const nextResult = await dataSource.load({
                    ...loadOptions,
                    groupPath: path,
                    skip: collectedItems.length,
                    take: pagination.pageSize,
                    requireGroupCount: true,
                }, {
                    signal: controller.signal,
                });

                if (
                    controller.signal.aborted
                    || generation !== remoteGroupGenerationRef.current
                    || remoteGroupControllersRef.current.get(pathKey) !== controller
                ) {
                    return;
                }
                if (nextResult.data.length === 0) {
                    break;
                }

                collectedItems.push(...nextResult.data);
                result = {
                    ...result,
                    ...nextResult,
                    data: containsNestedGroups
                        ? collectedItems as DataTableGroupItem<T>[]
                        : collectedItems as T[],
                };
            }

            setRemoteGroups((current) => replaceRemoteGroupItems(
                current,
                path,
                containsNestedGroups
                    ? collectedItems as DataTableGroupItem<T>[]
                    : collectedItems as T[],
                result.summary,
            ));
            setRemoteGroupLoadMetadata((current) => ({
                ...current,
                [pathKey]: {
                    totalCount: result.totalCount,
                    groupCount: result.groupCount,
                    summary: result.summary,
                    userData: result.userData,
                },
            }));
        } catch (error) {
            if (!isAbortError(error) && generation === remoteGroupGenerationRef.current) {
                notify("error", "Grup verileri yüklenirken bir hata oluştu.", onNotify);
            }
        } finally {
            if (remoteGroupControllersRef.current.get(pathKey) === controller) {
                remoteGroupControllersRef.current.delete(pathKey);
                setRemoteGroupLoadingKeys((current) => {
                    const next = new Set(current);
                    next.delete(pathKey);
                    return next;
                });
            }
        }
    }, [
        dataSource,
        isRemoteGrouping,
        loadOptions,
        onNotify,
        pagination.pageSize,
        remoteGroupView.metadata,
    ]);

    const memoizedData = effectiveData;
    const hasData = memoizedData.length > 0;

    const table = useReactTable({
        data: memoizedData,
        columns,
        state: {
            sorting,
            columnFilters,
            globalFilter: searchEnabled ? deferredGlobalFilter : "",
            columnVisibility,
            grouping: groupingEnabled ? grouping : EMPTY_GROUPING,
            expanded,
            pagination,
            rowSelection,
            columnSizing,
        },
        filterFns: {
            fuzzy: fuzzyFilter,
        },
        aggregationFns: {
            sum: sumAggregationFn,
            avg: avgAggregationFn,
            count: countAggregationFn,
        },
        onSortingChange: handleSortingChange,
        getSortedRowModel: isManualSorting ? undefined : getSortedRowModel(),
        onColumnFiltersChange: handleColumnFiltersChange,
        getFacetedRowModel: getFacetedRowModel(),
        getFacetedUniqueValues: getFacetedUniqueValues(),
        onGlobalFilterChange: setGlobalFilter,
        getFilteredRowModel: isManualFiltering ? undefined : getFilteredRowModel(),
        globalFilterFn: fuzzyFilter,
        onColumnVisibilityChange: setColumnVisibility,
        onGroupingChange: groupingEnabled ? setGrouping : undefined,
        getGroupedRowModel: getGroupedRowModel(),
        onExpandedChange: setExpanded,
        getExpandedRowModel: getExpandedRowModel(),
        onPaginationChange: handlePaginationChange,
        getPaginationRowModel: isManualPagination ? undefined : getPaginationRowModel(),
        onRowSelectionChange: handleRowSelectionChange,
        enableRowSelection: rowSelectionEnabled
            ? (row) => !isRemoteGroupPlaceholder(row.original)
            : false,
        enableSorting: sortingEnabled,
        enableGrouping: groupingEnabled,
        enableGlobalFilter: searchEnabled,
        enableFilters: columnFilterEnabled || columnHeaderFilterEnabled,
        enableColumnResizing: columnResizingEnabled,
        columnResizeMode: "onChange",
        onColumnSizingChange: handleColumnSizingChange,
        defaultColumn: {
            minSize: MIN_COL_SIZE,
            maxSize: MAX_COL_SIZE,
        },
        manualFiltering: isManualFiltering,
        manualPagination: isManualPagination,
        manualSorting: isManualSorting,
        manualGrouping: false,
        rowCount: isManualPagination ? effectivePageRowCount : undefined,
        getRowId: effectiveGetRowId,
        getCoreRowModel: getCoreRowModel(),
        meta: {
            valueMappers,
        },
    });

    const getRemoteGroupPath = useCallback((row: Row<T>): unknown[] => {
        const path: unknown[] = [];
        let currentRow: Row<T> | undefined = row;

        while (currentRow) {
            if (
                currentRow.getIsGrouped()
                && !isRemoteGroupSentinel(currentRow.groupingValue)
            ) {
                path.unshift(currentRow.groupingValue);
            }
            currentRow = currentRow.parentId
                ? table.getRow(currentRow.parentId)
                : undefined;
        }

        return path;
    }, [table]);

    const handleGroupExpandedToggle = useCallback((row: Row<T>) => {
        const shouldExpand = !row.getIsExpanded();
        row.toggleExpanded(shouldExpand);

        if (!shouldExpand || !isRemoteGrouping || remoteGroups.length === 0) {
            return;
        }

        const path = getRemoteGroupPath(row);
        if (path.length > 0) {
            void loadRemoteGroup(path);
        }
    }, [
        getRemoteGroupPath,
        isRemoteGrouping,
        loadRemoteGroup,
        remoteGroups.length,
    ]);

    useEffect(() => {
        if (!isRemoteGrouping || remoteGroups.length === 0) {
            return;
        }

        const loadExpandedGroups = (rows: Row<T>[]) => {
            rows.forEach((row) => {
                if (!row.getIsGrouped() || !row.getIsExpanded()) {
                    return;
                }

                const path = getRemoteGroupPath(row);
                const pathKey = remoteGroupPathKey(path);
                const metadata = remoteGroupView.metadata.get(pathKey);
                if (path.length > 0 && metadata && !metadata.loaded) {
                    void loadRemoteGroup(path);
                }

                loadExpandedGroups(row.subRows);
            });
        };

        loadExpandedGroups(table.getRowModel().rows);
    }, [
        expanded,
        getRemoteGroupPath,
        isRemoteGrouping,
        loadRemoteGroup,
        remoteGroupView.metadata,
        remoteGroups,
        table,
    ]);

    const selectedRecordCount = useMemo(
        () => Object.values(rowSelection).filter(Boolean).length,
        [rowSelection]
    );
    const totalRecordCount = isManualPagination
        ? effectiveTotalRowCount ?? 0
        : table.getFilteredRowModel().flatRows.filter(
            (row) => !row.getIsGrouped()
                && !isRemoteGroupPlaceholder(row.original),
        ).length;

    // Grup kolonu pin: sadece gruplama varken yatay scrollda solda sabit kalsin
    const stickyEnabled = isGroupColumnSticky && grouping.length > 0;
    const visibleLeafColumns = table.getVisibleLeafColumns();
    const visibleLeafCount = visibleLeafColumns.length;
    const visibleLeafColumnKey = visibleLeafColumns.map((column) => column.id).join("|");
    const hasAggregateColumns = visibleLeafColumns.some(
        (column) => Boolean(
            aggregate?.[column.id as Extract<keyof T, string>],
        ),
    );
    const useSizedColumns = columnResizingEnabled || !fitColumnsEnabled;
    const getCellStickyKind = (columnIndex: number, columnId: string): StickyCellKind =>
        resolveStickyKind(
            columnIndex,
            columnId,
            rowSelectionEnabled,
            stickyEnabled,
        );
    const columnTemplate = (() => {
        if (useSizedColumns) {
            return visibleLeafColumns.map((column) => {
                if (isSelectColumnId(column.id)) {
                    return `${SELECT_COLUMN_WIDTH}px`;
                }
                if (fitColumnsEnabled && !columnSizingCustomized) {
                    // Olculer oran olarak kullanilir; grid tum genisligi bosluksuz doldurur
                    return `minmax(${MIN_COL_SIZE}px, ${column.getSize()}fr)`;
                }
                // Icerik olculeri piksel olarak korunur; tasan kisim yatay kaydirilir
                return `${column.getSize()}px`;
            }).join(" ");
        }
        const dataCount = rowSelectionEnabled
            ? Math.max(visibleLeafCount - 1, 1)
            : Math.max(visibleLeafCount, 1);
        const dataTracks = stickyEnabled
            ? `minmax(14rem, 1fr)${dataCount > 1 ? ` repeat(${dataCount - 1}, minmax(0, 1fr))` : ""}`
            : `repeat(${dataCount}, minmax(0, 1fr))`;
        return rowSelectionEnabled ? `48px ${dataTracks}` : dataTracks;
    })();
    const minimumRowWidth = visibleLeafColumns.reduce(
        (total, column) => total + (isSelectColumnId(column.id) ? SELECT_COLUMN_WIDTH : MIN_COL_SIZE),
        0,
    );
    const rowWidth = useSizedColumns
        ? fitColumnsEnabled && !columnSizingCustomized
            ? `max(100%, ${minimumRowWidth}px)`
            : `max(100%, ${table.getTotalSize()}px)`
        : "100%";
    const unifiedHorizontalScroll =
        useSizedColumns && !fitColumnsEnabled && viewSettings.stickyHeader;

    const handleTableBodyScroll = (event: UIEvent<HTMLTableSectionElement>) => {
        const head = tableHeadRef.current;
        if (head) {
            head.scrollLeft = event.currentTarget.scrollLeft;
        }
    };

    const getDisplayCellText = useCallback((columnId: string, value: unknown) => {
        const mapper = valueMappers?.[columnId];
        if (mapper && value !== null && value !== undefined) {
            const mapped = mapper[value as string | number];
            if (mapped != null) {
                return String(mapped);
            }
        }
        return formatCellValue(value);
    }, [valueMappers]);

    const buildAutoFitSizing = useCallback((): ColumnSizingState => {
        const leafRows = table
            .getFilteredRowModel()
            .flatRows
            .filter((row) => !row.getIsGrouped()
                && !isRemoteGroupPlaceholder(row.original))
            .slice(0, AUTOFIT_SAMPLE_LIMIT);
        const headerIconWidth =
            (sortingEnabled ? 24 : 0) +
            (columnHeaderFilterEnabled ? 28 : 0) +
            8;
        const filterMinWidth = columnFilterEnabled ? COLUMN_FILTER_MIN_WIDTH : 0;
        const next: ColumnSizingState = {};

        visibleLeafColumns.forEach((column) => {
            if (isSelectColumnId(column.id)) {
                next[column.id] = SELECT_COLUMN_WIDTH;
                return;
            }

            const headerLabel = typeof column.columnDef.header === "string"
                ? column.columnDef.header
                : column.id;
            const cellTexts = leafRows.map((row) =>
                getDisplayCellText(column.id, row.getValue(column.id)),
            );

            next[column.id] = measureColumnAutoFitWidth({
                headerLabel,
                cellTexts,
                minSize: MIN_COL_SIZE,
                maxSize: MAX_COL_SIZE,
                headerIconWidth,
                filterMinWidth,
            });
        });

        return next;
    }, [
        table,
        visibleLeafColumns,
        sortingEnabled,
        columnHeaderFilterEnabled,
        columnFilterEnabled,
        getDisplayCellText,
    ]);

    const handleAutoFitColumn = useCallback((columnId: string) => {
        if (isSelectColumnId(columnId)) {
            return;
        }
        const next = buildAutoFitSizing();
        setColumnSizingCustomized(true);
        setColumnSizing((current) => ({
            ...current,
            [columnId]: next[columnId] ?? MIN_COL_SIZE,
        }));
    }, [buildAutoFitSizing]);

    useEffect(() => {
        const needsMeasuredColumns = columnResizingEnabled || !fitColumnsEnabled;
        if (!needsMeasuredColumns) {
            setColumnSizing({});
            setColumnSizingCustomized(false);
            return;
        }
        if (columnSizingCustomized || !visibleLeafColumnKey) {
            return;
        }

        const applyAutoFit = () => {
            const next = buildAutoFitSizing();
            setColumnSizing((prev) => {
                const keys = Object.keys(next);
                if (
                    keys.length === Object.keys(prev).length &&
                    keys.every((key) => prev[key] === next[key])
                ) {
                    return prev;
                }
                return next;
            });
        };

        applyAutoFit();
        const frame = window.requestAnimationFrame(applyAutoFit);
        return () => window.cancelAnimationFrame(frame);
        // visibleLeafColumnKey kolon seti degisince yeniden olc
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        columnResizingEnabled,
        fitColumnsEnabled,
        columnSizingCustomized,
        visibleLeafColumnKey,
        effectiveData,
        deferredGlobalFilter,
        columnFilters,
        sortingEnabled,
        columnHeaderFilterEnabled,
        columnFilterEnabled,
    ]);

    const tableRows = table.getRowModel().rows.filter(
        (row) => !isRemoteGroupPlaceholder(row.original)
            && !(row.getIsGrouped() && isRemoteGroupSentinel(row.groupingValue)),
    );
    const virtualizationEnabled = viewSettings.virtualization && hasData;
    const estimatedRowHeight = viewSettings.rowDense ? DENSE_ROW_HEIGHT : DEFAULT_ROW_HEIGHT;
    const rowVirtualizer = useVirtualizer({
        count: virtualizationEnabled ? tableRows.length : 0,
        getScrollElement: () =>
            viewSettings.stickyHeader ? tableBodyRef.current : tableGridRef.current,
        estimateSize: () => estimatedRowHeight,
        overscan: VIRTUAL_OVERSCAN,
        getItemKey: (index) => tableRows[index]?.id ?? index,
    });
    const virtualItems = rowVirtualizer.getVirtualItems();
    const rowsToRender = virtualizationEnabled
        ? virtualItems
            .map((item) => tableRows[item.index])
            .filter((row): row is (typeof tableRows)[number] => Boolean(row))
        : tableRows;
    const virtualPadTop = virtualItems[0]?.start ?? 0;
    const lastVirtualItem = virtualItems[virtualItems.length - 1];
    const virtualPadBottom = lastVirtualItem
        ? Math.max(0, rowVirtualizer.getTotalSize() - lastVirtualItem.end)
        : 0;

    // Secilen satirlar degistiginde callback cagir (sadece veri satirlari)
    useEffect(() => {
        if (!rowSelectionEnabled || !onSelectionChangeRef.current) {
            return;
        }

        const selectedRows = table
            .getSelectedRowModel()
            .flatRows
            .filter((row) => !row.getIsGrouped()
                && !isRemoteGroupPlaceholder(row.original))
            .map((row) => row.original);

        onSelectionChangeRef.current(selectedRows);
    }, [rowSelection, rowSelectionEnabled, table]);

    const handleExport = useCallback(
        (format: "xlsx" | "json", scope: ExportScope, mode: ExportMode) => {
            if (scope === "selected" && selectedRecordCount === 0) {
                notify("error", "İndirmek için önce kayıt seçiniz", onNotify);
                return;
            }

            const exportRows = getExportableRows(table, scope);
            if (exportRows.length === 0) {
                notify("error", "İndirilecek veri bulunamadı", onNotify);
                return;
            }

            const options: ExportOptions = {
                scope,
                mode,
                valueMappers,
            };
            const modeSuffix = mode === "table" ? "tablo" : "ham";
            const filename = buildExportFilename(
                `${title ?? "tablo"}-${modeSuffix}`,
                format,
            );

            if (format === "xlsx") {
                exportTableToExcel(table, filename, options);
            } else {
                exportTableToJson(table, filename, options);
            }
        },
        [table, title, valueMappers, selectedRecordCount, onNotify],
    );

    const renderExportMenu = (format: "xlsx" | "json", titleText: string, icon: ReactNode) => {
        const formatLabel = format === "json" ? "Json" : "Excel";

        return (
        <Menu as="div" className="relative inline-flex">
            <MenuButton
                as={Button}
                variant="flat"
                isIcon
                className="size-8 rounded-full"
                title={titleText}
                disabled={!hasData}
            >
                {icon}
            </MenuButton>
            <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="opacity-0 translate-y-1"
                enterTo="opacity-100 translate-y-0"
                leave="transition ease-in duration-75"
                leaveFrom="opacity-100 translate-y-0"
                leaveTo="opacity-0 translate-y-1"
            >
                <MenuItems className="absolute right-0 z-[12000] mt-1.5 w-72 origin-top-right rounded-lg border border-gray-200 bg-white py-1 shadow-lg outline-hidden focus:outline-hidden dark:border-dark-500 dark:bg-dark-750">
                    {EXPORT_MENU_SECTIONS.map((section, sectionIndex) => {
                        const sectionDisabled =
                            section.scope === "selected" && selectedRecordCount === 0;

                        return (
                            <div key={section.scope}>
                                {sectionIndex > 0 ? (
                                    <div className="my-1 border-t border-gray-200 dark:border-dark-500" />
                                ) : null}
                                <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wide text-gray-400 dark:text-dark-300">
                                    {section.title}
                                </div>
                                {section.items.map((item) => (
                                    <MenuItem key={`${section.scope}-${item.mode}`} disabled={sectionDisabled}>
                                        {({ focus, disabled }) => (
                                            <button
                                                type="button"
                                                disabled={disabled}
                                                onClick={() => handleExport(format, section.scope, item.mode)}
                                                className={clsx(
                                                    "flex w-full px-3 py-2 text-left text-sm outline-hidden transition-colors",
                                                    disabled
                                                        ? "cursor-not-allowed text-gray-300 dark:text-dark-500"
                                                        : focus
                                                            ? "bg-gray-100 text-gray-900 dark:bg-dark-600 dark:text-dark-50"
                                                            : "text-gray-700 dark:text-dark-100",
                                                )}
                                            >
                                                {item.mode === "table"
                                                    ? `Tablo Görünümüyle ${formatLabel} İndir`
                                                    : `Ham Data ${formatLabel} İndir`}
                                            </button>
                                        )}
                                    </MenuItem>
                                ))}
                            </div>
                        );
                    })}
                </MenuItems>
            </Transition>
        </Menu>
        );
    };

    const canShowQueryButton = type === "server" || Boolean(sqlQuery);

    const closeQueryTooltip = useCallback(() => {
        setQueryTooltip(null);
    }, []);

    useEffect(() => {
        if (!queryTooltip) {
            return;
        }

        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (queryTooltipRef.current?.contains(target)) {
                return;
            }
            if (queryButtonRef.current?.contains(target)) {
                return;
            }
            closeQueryTooltip();
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                closeQueryTooltip();
            }
        };

        const handleScroll = () => {
            closeQueryTooltip();
        };

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleEscape);
        window.addEventListener("scroll", handleScroll, true);

        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleEscape);
            window.removeEventListener("scroll", handleScroll, true);
        };
    }, [closeQueryTooltip, queryTooltip]);

    const handleShowQuery = () => {
        if (queryTooltip) {
            closeQueryTooltip();
            return;
        }

        const rect = queryButtonRef.current?.getBoundingClientRect();
        const x = rect ? rect.right - 520 : window.innerWidth - 540;
        const y = rect ? rect.bottom + 8 : 100;
        setQueryTooltip({ x, y });
    };

    const handleCopyQuery = async () => {
        if (!sqlQuery?.trim()) {
            notify("warning", "Kopyalanacak sorgu bulunamadı", onNotify);
            return;
        }

        try {
            await navigator.clipboard.writeText(sqlQuery);
            notify("success", "Sorgu panoya kopyalandı", onNotify);
        } catch {
            notify("error", "Sorgu kopyalanamadı", onNotify);
        }
    };

    return (
        <div
            className={clsx(
                "dtp flex min-h-0 flex-1 flex-col",
                viewSettings.fullScreen
                    ? "fixed inset-0 z-[80] bg-white p-4 dark:bg-dark-900"
                    : "h-full",
                table.getState().columnSizingInfo.isResizingColumn && "dtp-resizing",
                className,
            )}
        >
            <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="flex flex-shrink-0 items-center gap-3 border-b border-gray-200 px-3 py-2 dark:border-dark-500">
                {title && viewSettings.showTitle ? (
                    <h3 className="dark:text-dark-100 truncate text-sm font-medium tracking-wide text-gray-700">
                        {title}
                    </h3>
                ) : null}

                {groupingEnabled ? (
                <div
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className={clsx(
                        "flex-1 min-h-[40px] border-2 border-dashed rounded-lg p-2 transition-colors",
                        grouping.length > 0
                            ? "border-gray-300 dark:border-dark-500 bg-gray-50 dark:bg-dark-800"
                            : "border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-800"
                    )}
                >
                    {grouping.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-xs text-gray-500 dark:text-gray-400">
                            Gruplamak için kolon başlıklarını buraya sürükleyin
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {grouping.map((columnId, index) => {
                                const column = table.getAllLeafColumns().find(c => c.id === columnId);
                                const headerText = column ? (typeof column.columnDef.header === 'string' ? column.columnDef.header : columnId) : columnId;
                                const isDragging = draggedGroupIndex === index;
                                const columnSorting = sorting.find((item) => item.id === columnId);
                                const sortDirection = columnSorting
                                    ? (columnSorting.desc ? "desc" : "asc")
                                    : null;
                                const SortIcon = sortDirection === "desc"
                                    ? BarsArrowDownIcon
                                    : sortDirection === "asc"
                                        ? BarsArrowUpIcon
                                        : Bars3Icon;
                                return (
                                    <div
                                        key={columnId}
                                        draggable
                                        onDragStart={(e) => handleGroupDragStart(e, index)}
                                        onDragOver={(e) => handleGroupDragOver(e, index)}
                                        onDragEnd={handleGroupDragEnd}
                                        className={clsx(
                                            "flex items-center gap-1.5 px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-md text-sm font-medium cursor-move transition-all",
                                            isDragging && "opacity-50 scale-95"
                                        )}
                                        title="Grup sırasını değiştirmek için sürükle"
                                    >
                                        <span className="max-w-[12rem] truncate pl-1">{headerText}</span>
                                        {column && columnHeaderFilterEnabled ? (
                                            <span
                                                className="inline-flex"
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onClick={(e) => e.stopPropagation()}
                                                draggable={false}
                                            >
                                                <FacetColumnFilter
                                                    column={column}
                                                    table={table}
                                                    valueMappers={valueMappers}
                                                />
                                            </span>
                                        ) : null}
                                        {sortingEnabled ? (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleGroupingSort(columnId);
                                            }}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            className={clsx(
                                                "rounded p-0.5 transition-colors",
                                                sortDirection
                                                    ? "text-primary-700 dark:text-primary-200"
                                                    : "text-primary-500/70 hover:text-primary-900 dark:text-primary-400/70 dark:hover:text-primary-100"
                                            )}
                                            title={
                                                sortDirection === "desc"
                                                    ? "Azalan siralama"
                                                    : sortDirection === "asc"
                                                        ? "Artan siralama"
                                                        : "Sirala"
                                            }
                                            aria-label={`${headerText} sirala`}
                                        >
                                            <SortIcon className="size-4" />
                                        </button>
                                        ) : null}
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeGrouping(columnId);
                                            }}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            className="hover:text-primary-900 dark:hover:text-primary-100 transition-colors p-0.5"
                                            title="Kaldır"
                                        >
                                            <XMarkIcon className="size-4" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                ) : (
                    <div className="flex-1" />
                )}

                <div className="flex gap-2">
                    {searchEnabled ? (
                    <CollapsibleSearch
                        placeholder="Ara..."
                        value={globalFilter ?? ""}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                    />
                    ) : null}
                    {columnPickerEnabled ? (
                    <TableColumnVisibility
                        table={table}
                        header="Kolonları Seç"
                        description="Tabloda görünecek kolonları seçin"
                    />
                    ) : null}
                    {groupingEnabled ? (
                    <Button
                        onClick={() => setIsGroupColumnSticky((prev) => !prev)}
                        variant="flat"
                        isIcon
                        className={clsx(
                            "size-8 rounded-full",
                            stickyEnabled && "bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300",
                        )}
                        title={
                            grouping.length === 0
                                ? "Grup kolonu sabitlemek için önce gruplama yapın"
                                : stickyEnabled
                                    ? "Grup kolonunu serbest bırak"
                                    : "Grup kolonunu sabitle"
                        }
                        disabled={grouping.length === 0}
                        aria-pressed={stickyEnabled}
                    >
                        <MapPinIcon className="size-4.5" />
                    </Button>
                    ) : null}
                    <Button
                        onClick={() => {
                            table.resetColumnFilters();
                            table.resetGlobalFilter();
                            handleSortingChange(defaultSorting);
                            setGrouping(defaultGrouping);
                            setExpanded({});
                            setIsGroupColumnSticky(true);
                        }}
                        variant="flat"
                        isIcon
                        className="size-8 rounded-full"
                        title="Filtreleri temizle"
                    >
                        <span className="relative block size-4.5" aria-hidden="true">
                            <FunnelIcon className="size-4.5" />
                            <XMarkIcon className="absolute -right-1 -top-1 size-2.5 rounded-full bg-white text-gray-700 ring-1 ring-white dark:bg-dark-700 dark:text-dark-100 dark:ring-dark-700" />
                        </span>
                    </Button>
                    {excelExportEnabled
                        ? renderExportMenu(
                            "xlsx",
                            "Excel indir",
                            <TableCellsIcon className="size-4.5" />,
                        )
                        : null}
                    {jsonExportEnabled
                        ? renderExportMenu(
                            "json",
                            "JSON indir",
                            <CodeBracketSquareIcon className="size-4.5" />,
                        )
                        : null}
                    {canShowQueryButton ? (
                        <Button
                            ref={queryButtonRef}
                            onClick={handleShowQuery}
                            variant="flat"
                            isIcon
                            className="size-8 rounded-full"
                            title="Sorguyu göster"
                        >
                            <CommandLineIcon className="size-4.5" />
                        </Button>
                    ) : null}
                    {dataSource || onRefresh ? (
                        <Button
                            onClick={() => void handleRefresh()}
                            disabled={effectiveIsRefreshing || effectiveIsLoading}
                            variant="flat"
                            isIcon
                            className="size-8 rounded-full"
                            title="Yenile"
                            aria-label="Tabloyu yenile"
                        >
                            <ArrowPathIcon className={clsx("size-4.5", (effectiveIsRefreshing || effectiveIsLoading) && "animate-spin")} />
                        </Button>
                    ) : null}
                    {toolbarExtra}
                    {enableTableViewMenu ? (
                    <TableViewMenu
                        settings={viewSettings}
                        onChange={handleViewSettingsChange}
                    />
                    ) : null}
                </div>
            </div>

                <div
                    ref={tableGridRef}
                    className={clsx(
                        "dtp-grid min-h-0 flex-1",
                        !viewSettings.stickyHeader && "dtp-grid-unfixed",
                        unifiedHorizontalScroll && "dtp-grid-horizontal",
                    )}
                    style={maxHeight && maxHeight !== "auto" ? { maxHeight } : undefined}
                >
                    <Table
                        hoverable
                        dense={viewSettings.rowDense}
                        bordered={viewSettings.columnBorders}
                        className={clsx(
                            "dtp-table-scroll w-full text-left rtl:text-right",
                            !viewSettings.stickyHeader && "dtp-table-unfixed",
                            useSizedColumns && "dtp-table-sized",
                        )}
                        style={{
                            "--dtp-col-template": columnTemplate,
                            "--dtp-row-width": rowWidth,
                        } as CSSProperties}
                    >
                        <THead ref={tableHeadRef}>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <Tr key={headerGroup.id}>
                                    {headerGroup.headers.map((header, headerIndex) => {
                                        const align = (header.column.columnDef.meta as any)?.align || 'left';
                                        const isSelectColumn = isSelectColumnId(header.column.id);
                                        const stickyKind = getCellStickyKind(
                                            headerIndex,
                                            header.column.id,
                                        );
                                        return (
                                            <Th
                                                key={header.id}
                                                className={clsx(
                                                    "dark:bg-dark-800 dark:text-dark-100 bg-gray-200 font-normal text-gray-800 border-r border-gray-300 dark:border-dark-600 last:border-r-0",
                                                    isSelectColumn
                                                        ? "px-3 py-2.5 align-middle"
                                                        : "px-4 py-2.5 align-top",
                                                    align === 'right' ? 'text-right' : isSelectColumn ? 'text-center' : 'text-left',
                                                    isSelectColumn && SELECT_COLUMN_CELL_CLASS,
                                                    getStickyCellClassName(stickyKind, "header"),
                                                    columnResizingEnabled && "relative",
                                                )}
                                                style={getStickyCellStyle(
                                                    stickyKind,
                                                    rowSelectionEnabled,
                                                    {
                                                        ...(isSelectColumn ? SELECT_COLUMN_STYLE : {}),
                                                        ...(useSizedColumns && !viewSettings.stickyHeader
                                                            ? {
                                                                width: header.getSize(),
                                                                minWidth: header.getSize(),
                                                            }
                                                            : {}),
                                                    },
                                                )}
                                            >
                                                {isSelectColumn ? (
                                                    <div className="flex h-full min-h-7 items-center justify-center">
                                                        {header.isPlaceholder
                                                            ? null
                                                            : flexRender(
                                                                header.column.columnDef.header,
                                                                header.getContext(),
                                                            )}
                                                    </div>
                                                ) : (
                                                    <div className="flex min-w-0 w-full flex-col gap-0">
                                                        {sortingEnabled || groupingEnabled ? (
                                                            <HeaderSort
                                                                header={header}
                                                                table={table}
                                                                valueMappers={valueMappers}
                                                                enableSorting={sortingEnabled}
                                                                enableGrouping={groupingEnabled}
                                                                enableColumnHeaderFilter={columnHeaderFilterEnabled}
                                                            />
                                                        ) : header.isPlaceholder ? null : (
                                                            <div className="flex h-7 items-center gap-0.5">
                                                                <span className="min-w-0 flex-1 truncate text-sm">
                                                                    {flexRender(
                                                                        header.column.columnDef.header,
                                                                        header.getContext(),
                                                                    )}
                                                                </span>
                                                                {columnHeaderFilterEnabled ? (
                                                                    <FacetColumnFilter
                                                                        column={header.column}
                                                                        table={table}
                                                                        valueMappers={valueMappers}
                                                                    />
                                                                ) : null}
                                                            </div>
                                                        )}

                                                        {columnFilterEnabled ? (
                                                            <TextColumnFilter column={header.column} />
                                                        ) : null}
                                                    </div>
                                                )}
                                                {columnResizingEnabled ? (
                                                    <ColumnResizeHandle
                                                        header={header}
                                                        onAutoFit={handleAutoFitColumn}
                                                        onResizeStart={() => setColumnSizingCustomized(true)}
                                                    />
                                                ) : null}
                                            </Th>
                                        );
                                    })}
                                </Tr>
                            ))}
                        </THead>
                        <TBody
                            ref={tableBodyRef}
                            onScroll={
                                viewSettings.stickyHeader && !unifiedHorizontalScroll
                                    ? handleTableBodyScroll
                                    : undefined
                            }
                        >
                            {hasData ? (
                                <>
                                    {virtualizationEnabled ? <VirtualPad height={virtualPadTop} /> : null}
                                    {rowsToRender.map((row) => {
                                        const isGroupRow = row.getIsGrouped();
                                        if (
                                            isRemoteGroupPlaceholder(row.original)
                                            || (isGroupRow && isRemoteGroupSentinel(row.groupingValue))
                                        ) {
                                            return null;
                                        }
                                        const virtualRowStyle = virtualizationEnabled
                                            ? { height: estimatedRowHeight }
                                            : undefined;

                                        if (isGroupRow) {
                                            const groupingColumnId = row.groupingColumnId;
                                            const groupingValue = row.groupingValue;
                                            const remoteGroupPath = isRemoteGrouping
                                                ? getRemoteGroupPath(row)
                                                : [];
                                            const remoteGroupKey = remoteGroupPathKey(remoteGroupPath);
                                            const remoteMetadata: RemoteGroupMetadata | undefined =
                                                remoteGroupView.metadata.get(remoteGroupKey);
                                            const groupedLeafRowCount =
                                                remoteMetadata?.count ?? countDataRowsInGroup(row);
                                            const isRemoteGroupLoading =
                                                remoteGroupLoadingKeys.has(remoteGroupKey);
                                            const groupColumn = table.getAllLeafColumns().find(col => col.id === groupingColumnId);
                                            const groupColumnHeader = groupColumn ? (typeof groupColumn.columnDef.header === 'string' ? groupColumn.columnDef.header : groupingColumnId) : groupingColumnId;
                                            const groupDepth = row.depth;
                                            const paddingLeft = 15 + (groupDepth * 15);

                                            return (
                                                <Tr
                                                    key={row.id}
                                                    className="dark:border-b-dark-500 border-y border-transparent border-b-gray-200 last:border-none bg-gray-50 dark:bg-dark-800"
                                                    style={virtualRowStyle}
                                                >
                                                    {row.getVisibleCells().map((cell, index) => {
                                                        const isSelectColumn = cell.column.id === 'select';
                                                        const isGroupHeaderCell = rowSelectionEnabled ? index === 1 : index === 0;
                                                        const stickyKind = getCellStickyKind(
                                                            index,
                                                            cell.column.id,
                                                        );
                                                        const stickyClassName = getStickyCellClassName(stickyKind, "group");
                                                        const stickyStyle = getStickyCellStyle(
                                                            stickyKind,
                                                            rowSelectionEnabled,
                                                            isSelectColumn ? SELECT_COLUMN_STYLE : undefined,
                                                        );

                                                        if (isSelectColumn) {
                                                            const leafRows = getSelectableLeafRows(row);
                                                            const selectedLeafCount = leafRows.filter((leaf) => leaf.getIsSelected()).length;
                                                            const isAllLeafSelected = leafRows.length > 0 && selectedLeafCount === leafRows.length;
                                                            const isSomeLeafSelected = selectedLeafCount > 0 && !isAllLeafSelected;

                                                            return (
                                                                <Td
                                                                    key={cell.id}
                                                                    className={clsx(
                                                                        "border-r border-gray-200 dark:border-dark-600 last:border-r-0 text-center",
                                                                        SELECT_COLUMN_CELL_CLASS,
                                                                        stickyClassName,
                                                                    )}
                                                                    style={stickyStyle}
                                                                >
                                                                    <IndeterminateCheckbox
                                                                        checked={isAllLeafSelected}
                                                                        indeterminate={isSomeLeafSelected}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        onChange={() => {
                                                                            const shouldSelect = !isAllLeafSelected;
                                                                            handleRowSelectionChange((prev) => {
                                                                                const next = { ...prev };
                                                                                leafRows.forEach((leaf) => {
                                                                                    if (shouldSelect) {
                                                                                        next[leaf.id] = true;
                                                                                    } else {
                                                                                        delete next[leaf.id];
                                                                                    }
                                                                                });
                                                                                return next;
                                                                            });
                                                                        }}
                                                                    />
                                                                </Td>
                                                            );
                                                        }

                                                        if (isGroupHeaderCell) {
                                                            const customGroupHeaderTemplate =
                                                                grupCellTemplate?.[
                                                                    cell.column.id as Extract<keyof T, string>
                                                                ];
                                                            return (
                                                                <Td
                                                                    key={cell.id}
                                                                    className={clsx(
                                                                        "border-r border-gray-200 dark:border-dark-600 last:border-r-0",
                                                                        stickyClassName,
                                                                    )}
                                                                    style={getStickyCellStyle(
                                                                        stickyKind,
                                                                        rowSelectionEnabled,
                                                                        { paddingLeft: `${paddingLeft}px` },
                                                                    )}
                                                                >
                                                                    {customGroupHeaderTemplate ? (
                                                                        <div className="flex items-center gap-2">
                                                                            {isRemoteGrouping ? (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleGroupExpandedToggle(row)}
                                                                                    className="hover:text-primary-600 transition-colors"
                                                                                    disabled={isRemoteGroupLoading}
                                                                                >
                                                                                    {isRemoteGroupLoading ? (
                                                                                        <ArrowPathIcon className="size-4 animate-spin" />
                                                                                    ) : row.getIsExpanded() ? (
                                                                                        <ChevronDownIcon className="size-4" />
                                                                                    ) : (
                                                                                        <ChevronRightIcon className="size-4" />
                                                                                    )}
                                                                                </button>
                                                                            ) : null}
                                                                            {customGroupHeaderTemplate(cell.getContext())}
                                                                            {isRemoteGroupLoading ? (
                                                                                <span className="text-sm text-gray-500">
                                                                                    Yükleniyor...
                                                                                </span>
                                                                            ) : null}
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-center gap-2">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleGroupExpandedToggle(row)}
                                                                                className="hover:text-primary-600 transition-colors"
                                                                                disabled={isRemoteGroupLoading}
                                                                            >
                                                                                {isRemoteGroupLoading ? (
                                                                                    <ArrowPathIcon className="size-4 animate-spin" />
                                                                                ) : row.getIsExpanded() ? (
                                                                                    <ChevronDownIcon className="size-4" />
                                                                                ) : (
                                                                                    <ChevronRightIcon className="size-4" />
                                                                                )}
                                                                            </button>
                                                                            <span className="font-semibold text-primary-600">
                                                                                <span className="text-gray-600 dark:text-gray-400 font-normal">{groupColumnHeader}:</span>{' '}
                                                                                {String(groupingValue)}{' '}
                                                                                <span className="text-gray-500 dark:text-gray-500">({groupedLeafRowCount})</span>
                                                                                {isRemoteGroupLoading ? (
                                                                                    <span className="ml-2 font-normal text-gray-500">
                                                                                        Yükleniyor...
                                                                                    </span>
                                                                                ) : null}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </Td>
                                                            );
                                                        }

                                                        if (cell.getIsAggregated()) {
                                                            if (hideInGroupRow.includes(cell.column.id)) {
                                                                return (
                                                                    <Td
                                                                        key={cell.id}
                                                                        className={clsx(
                                                                            "border-r border-gray-200 dark:border-dark-600 last:border-r-0",
                                                                            stickyClassName,
                                                                        )}
                                                                        style={stickyStyle}
                                                                    />
                                                                );
                                                            }

                                                            return (
                                                                <Td
                                                                    key={cell.id}
                                                                    className={clsx(
                                                                        "border-r border-gray-200 dark:border-dark-600 last:border-r-0",
                                                                        stickyClassName,
                                                                    )}
                                                                    style={stickyStyle}
                                                                >
                                                                    {flexRender(
                                                                        cell.column.columnDef.aggregatedCell ?? cell.column.columnDef.cell,
                                                                        cell.getContext(),
                                                                    )}
                                                                </Td>
                                                            );
                                                        }

                                                        return (
                                                            <Td
                                                                key={cell.id}
                                                                className={clsx(
                                                                    "border-r border-gray-200 dark:border-dark-600 last:border-r-0",
                                                                    stickyClassName,
                                                                )}
                                                                style={stickyStyle}
                                                            />
                                                        );
                                                    })}
                                                </Tr>
                                            );
                                        }

                                        return (
                                            <Tr
                                                key={row.id}
                                                className="dark:border-b-dark-500 border-y border-transparent border-b-gray-200 last:border-none"
                                                style={virtualRowStyle}
                                            >
                                                {row.getVisibleCells().map((cell, cellIndex) => {
                                                    const isSelectColumn = isSelectColumnId(cell.column.id);
                                                    const stickyKind = getCellStickyKind(
                                                        cellIndex,
                                                        cell.column.id,
                                                    );
                                                    return (
                                                        <Td
                                                            key={cell.id}
                                                            className={clsx(
                                                                "border-r border-gray-200 px-4 py-3 dark:border-dark-600 last:border-r-0",
                                                                isSelectColumn && SELECT_COLUMN_CELL_CLASS,
                                                                isSelectColumn && "px-3 text-center",
                                                                getStickyCellClassName(stickyKind, "body"),
                                                            )}
                                                            style={getStickyCellStyle(
                                                                stickyKind,
                                                                rowSelectionEnabled,
                                                                isSelectColumn ? SELECT_COLUMN_STYLE : undefined,
                                                            )}
                                                        >
                                                            {cell.getIsGrouped() ? null : cell.getIsAggregated() ? (
                                                                flexRender(
                                                                    cell.column.columnDef.aggregatedCell ?? cell.column.columnDef.cell,
                                                                    cell.getContext(),
                                                                )
                                                            ) : cell.getIsPlaceholder() ? null : (
                                                                flexRender(
                                                                    cell.column.columnDef.cell,
                                                                    cell.getContext(),
                                                                )
                                                            )}
                                                        </Td>
                                                    );
                                                })}
                                            </Tr>
                                        );
                                    })}
                                    {virtualizationEnabled ? <VirtualPad height={virtualPadBottom} /> : null}
                                    {grouping.length > 0 && hasAggregateColumns && (
                                        <Tr className="dark:border-t-dark-400 border-t-2 border-gray-400 bg-primary-50 dark:bg-primary-900/20">
                                            {table.getVisibleLeafColumns().map((column, index) => {
                                                const align = (column.columnDef.meta as any)?.align || 'left';
                                                const isSelectColumn = isSelectColumnId(column.id);
                                                const stickyKind = getCellStickyKind(
                                                    index,
                                                    column.id,
                                                );
                                                const stickyClassName = getStickyCellClassName(stickyKind, "total");
                                                const stickyStyle = getStickyCellStyle(
                                                    stickyKind,
                                                    rowSelectionEnabled,
                                                    isSelectColumn ? SELECT_COLUMN_STYLE : undefined,
                                                );

                                                if (isSelectColumn) {
                                                    return (
                                                        <Td
                                                            key={column.id}
                                                            className={clsx(
                                                                "border-r border-gray-300 dark:border-dark-500 last:border-r-0",
                                                                SELECT_COLUMN_CELL_CLASS,
                                                                stickyClassName,
                                                            )}
                                                            style={stickyStyle}
                                                        />
                                                    );
                                                }

                                                if (index === 0 || (rowSelectionEnabled && index === 1)) {
                                                    const isFirstContentColumn = rowSelectionEnabled ? index === 1 : index === 0;
                                                    if (isFirstContentColumn) {
                                                        return (
                                                            <Td
                                                                key={column.id}
                                                                className={clsx(
                                                                    "border-r border-gray-300 dark:border-dark-500 last:border-r-0",
                                                                    stickyClassName,
                                                                )}
                                                                style={stickyStyle}
                                                            >
                                                                <span className="font-bold text-primary-700 dark:text-primary-300">
                                                                    Genel Toplam
                                                                </span>
                                                            </Td>
                                                        );
                                                    }
                                                }

                                                if (hideInGroupRow.includes(column.id)) {
                                                    return (
                                                        <Td
                                                            key={column.id}
                                                            className={clsx(
                                                                "border-r border-gray-300 dark:border-dark-500 last:border-r-0",
                                                                stickyClassName,
                                                            )}
                                                            style={stickyStyle}
                                                        />
                                                    );
                                                }

                                                const configuredAggregate =
                                                    aggregate?.[
                                                        column.id as Extract<keyof T, string>
                                                    ];
                                                const aggregationFn = column.getAggregationFn();
                                                if (configuredAggregate && aggregationFn) {
                                                    const leafRows = table
                                                        .getFilteredRowModel()
                                                        .flatRows
                                                        .filter((row) => !row.getIsGrouped()
                                                            && !isRemoteGroupPlaceholder(row.original));
                                                    const total = aggregationFn(
                                                        column.id,
                                                        leafRows,
                                                        [],
                                                    );

                                                    return (
                                                        <Td
                                                            key={column.id}
                                                            className={clsx(
                                                                `border-r border-gray-300 dark:border-dark-500 last:border-r-0 ${align === 'right' ? 'text-right' : 'text-left'}`,
                                                                stickyClassName,
                                                            )}
                                                            style={stickyStyle}
                                                        >
                                                            <span className="font-bold text-primary-700 dark:text-primary-300">
                                                                {typeof total === "number"
                                                                    ? total.toLocaleString("tr-TR", { maximumFractionDigits: 2 })
                                                                    : String(total)}
                                                            </span>
                                                        </Td>
                                                    );
                                                }

                                                return (
                                                    <Td
                                                        key={column.id}
                                                        className={clsx(
                                                            "border-r border-gray-300 dark:border-dark-500 last:border-r-0",
                                                            stickyClassName,
                                                        )}
                                                        style={stickyStyle}
                                                    />
                                                );
                                            })}
                                        </Tr>
                                    )}
                                </>
                            ) : (
                                <Tr>
                                    <Td
                                        colSpan={Math.max(table.getVisibleLeafColumns().length, 1)}
                                        className="dtp-empty-cell h-full px-4 py-10 text-center text-gray-500 dark:text-gray-400"
                                    >
                                        {effectiveIsLoading ? loadingText : emptyMessage}
                                    </Td>
                                </Tr>
                            )}
                        </TBody>
                    </Table>
                </div>

                {((hasData && !isManualPagination) || isManualPagination) && (
                    <div className="relative flex-shrink-0">
                        {rowSelectionEnabled && selectedRecordCount > 0 && (
                            <div className="absolute inset-0 z-10 flex items-center justify-between gap-3 px-4 bg-primary-600/95 text-white backdrop-blur-[1px]">
                                <span className="text-sm font-medium">
                                    {totalRecordCount} {itemLabel} içinden {selectedRecordCount} kayıt seçildi
                                </span>
                                <div className="flex items-center gap-2">
                                    {onTransferSelected && (
                                        <PopoverButton
                                            title={title ?? "Seçileni aktar"}
                                            description={transferSelectedPopoverDescription ?? `${selectedRecordCount} seçili kayıt aktarılacak. Onaylıyor musunuz?`}
                                            disabled={isTransferSelectedDisabled}
                                            buttons={({ close }) => (
                                                <>
                                                    <Button
                                                        onClick={async () => {
                                                            await onTransferSelected();
                                                            close();
                                                        }}
                                                        color="primary"
                                                        className="px-3 py-1.5 text-sm"
                                                    >
                                                        Tamam
                                                    </Button>
                                                    <Button
                                                        onClick={() => close()}
                                                        variant="outlined"
                                                        color="error"
                                                        className="px-3 py-1.5 text-sm"
                                                    >
                                                        Vazgeç
                                                    </Button>
                                                </>
                                            )}
                                            className="px-3 py-1 text-xs font-semibold !text-white !bg-indigo-600 hover:!bg-indigo-700 disabled:!bg-white/20 rounded transition-colors flex items-center gap-1"
                                        >
                                            <ArrowUpTrayIcon className="size-4" />
                                            Seçileni aktar
                                        </PopoverButton>
                                    )}
                                    {onDeleteSelected && (
                                        <PopoverButton
                                            title={title ?? "Seçileni sil"}
                                            description={deleteSelectedPopoverDescription ?? `${selectedRecordCount} seçili kayıt silinecek. Onaylıyor musunuz?`}
                                            disabled={isDeleteSelectedDisabled}
                                            buttons={({ close }) => (
                                                <>
                                                    <Button
                                                        onClick={async () => {
                                                            await onDeleteSelected();
                                                            close();
                                                        }}
                                                        color="error"
                                                        className="px-3 py-1.5 text-sm"
                                                    >
                                                        Tamam
                                                    </Button>
                                                    <Button
                                                        onClick={() => close()}
                                                        variant="outlined"
                                                        className="px-3 py-1.5 text-sm"
                                                    >
                                                        Vazgeç
                                                    </Button>
                                                </>
                                            )}
                                            className="px-3 py-1 text-xs font-semibold !text-white !bg-rose-600 hover:!bg-rose-700 disabled:!bg-white/20 rounded transition-colors flex items-center gap-1"
                                        >
                                            <TrashIcon className="size-4" />
                                            Seçileni sil
                                        </PopoverButton>
                                    )}
                                    <Button
                                        onClick={() => handleRowSelectionChange({})}
                                        variant="outlined"
                                        className="px-3 py-1 text-xs font-semibold !border-white !text-white hover:!bg-white/10"
                                    >
                                        İptal
                                    </Button>
                                </div>
                            </div>
                        )}
                        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-dark-500">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                Sayfa başına:
                            </span>
                            <select
                                value={table.getState().pagination.pageSize}
                                onChange={(e) => {
                                    table.setPageSize(Number(e.target.value));
                                }}
                                className="rounded-md border border-gray-300 dark:border-dark-500 bg-white dark:bg-dark-700 px-2 py-1 text-sm text-gray-700 dark:text-gray-300"
                            >
                                {pageSizeOptions.map((pageSize) => (
                                    <option key={pageSize} value={pageSize}>
                                        {pageSize}
                                    </option>
                                ))}
                            </select>
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                {(isManualPagination ? effectivePageRowCount ?? 0 : table.getFilteredRowModel().rows.length)} {itemLabel} içinden{' '}
                                {((isManualPagination ? effectivePageRowCount ?? 0 : table.getFilteredRowModel().rows.length) === 0)
                                    ? 0
                                    : table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}-
                                {Math.min(
                                    (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                                    isManualPagination ? effectivePageRowCount ?? 0 : table.getFilteredRowModel().rows.length
                                )}{' '}
                                arası gösteriliyor
                            </span>
                        </div>

                        <div className="flex items-center gap-1">
                            <Button
                                onClick={() => table.setPageIndex(0)}
                                disabled={!table.getCanPreviousPage()}
                                variant="flat"
                                isIcon
                                className="size-8 rounded-full"
                                title="İlk sayfa"
                            >
                                <ChevronDoubleLeftIcon className="size-4" />
                            </Button>
                            <Button
                                onClick={() => table.previousPage()}
                                disabled={!table.getCanPreviousPage()}
                                variant="flat"
                                isIcon
                                className="size-8 rounded-full"
                                title="Önceki sayfa"
                            >
                                <ChevronLeftIcon className="size-4" />
                            </Button>

                            <span className="flex items-center gap-1 px-3 text-sm text-gray-700 dark:text-gray-300">
                                <span>Sayfa</span>
                                <strong>
                                    {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
                                </strong>
                            </span>

                            <Button
                                onClick={() => table.nextPage()}
                                disabled={!table.getCanNextPage()}
                                variant="flat"
                                isIcon
                                className="size-8 rounded-full"
                                title="Sonraki sayfa"
                            >
                                <ChevronRightIcon className="size-4" />
                            </Button>
                            <Button
                                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                                disabled={!table.getCanNextPage()}
                                variant="flat"
                                isIcon
                                className="size-8 rounded-full"
                                title="Son sayfa"
                            >
                                <ChevronDoubleRightIcon className="size-4" />
                            </Button>
                        </div>
                        </div>
                    </div>
                )}
            </Card>

            {queryTooltip && createPortal(
                <div
                    ref={queryTooltipRef}
                    className="fixed z-[9999] w-[min(520px,calc(100vw-24px))] rounded-lg border border-gray-200 dark:border-dark-500 bg-white dark:bg-dark-800 shadow-xl"
                    style={{
                        left: Math.min(Math.max(8, queryTooltip.x), window.innerWidth - 540),
                        top: Math.min(queryTooltip.y, window.innerHeight - 220),
                    }}
                >
                    <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-200 dark:border-dark-500">
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                            SQL Sorgusu
                        </span>
                        <div className="flex items-center gap-1">
                            <Button
                                onClick={() => void handleCopyQuery()}
                                disabled={!sqlQuery?.trim()}
                                isIcon
                                variant="flat"
                                className="size-8 rounded-full"
                                title="Kopyala"
                            >
                                <ClipboardDocumentIcon className="size-4" />
                            </Button>
                            <Button
                                onClick={closeQueryTooltip}
                                isIcon
                                variant="flat"
                                className="size-8 rounded-full"
                                title="Kapat"
                            >
                                <XMarkOutlineIcon className="size-4" />
                            </Button>
                        </div>
                    </div>
                    <div className="p-3">
                        <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-gray-50 dark:bg-dark-900 px-3 py-2 text-xs font-mono text-gray-800 dark:text-gray-100">
                            {sqlQuery?.trim() || "Henuz calistirilmis bir sorgu yok. Once Getir ile veriyi cekin."}
                        </pre>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

export const DataTable = forwardRef(DataTableInner) as <
    T extends Record<string, any>,
>(
    props: DataTableProps<T> & RefAttributes<DataTableHandle>,
) => ReactElement;

function VirtualPad({ height }: { height: number }) {
    if (height <= 0) {
        return null;
    }

    return (
        <Tr className="dtp-virtual-pad" aria-hidden="true" style={{ height }}>
            <Td className="dtp-virtual-pad-cell" />
        </Tr>
    );
}

function HeaderSort<T>({
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
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', header.column.id);
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

// IndeterminateCheckbox component for "select all" functionality
function IndeterminateCheckbox({
    indeterminate,
    className = '',
    ...rest
}: { indeterminate?: boolean } & HTMLProps<HTMLInputElement>) {
    const ref = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (ref.current) {
            ref.current.indeterminate = indeterminate ?? false;
        }
    }, [indeterminate]);

    return (
        <input
            type="checkbox"
            ref={ref}
            className={clsx("dtp-checkbox size-4 cursor-pointer", className)}
            {...rest}
        />
    );
}


