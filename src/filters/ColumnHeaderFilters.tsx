import {
    Popover,
    PopoverButton,
    PopoverPanel,
    Transition,
} from '@headlessui/react';
import {
    ArrowLeftIcon,
    ArrowRightIcon,
    CheckIcon,
    FunnelIcon,
    MagnifyingGlassIcon,
    NoSymbolIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { Column, FilterFn, Table } from '@tanstack/react-table';
import { ComponentType, Fragment, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type MouseEvent } from 'react';

import { Badge, Button, Checkbox, Input } from '../ui';
import clsx from 'clsx';

import type { ColumnFilterValue, TextFilterOperator } from '../types';

// ----------------------------------------------------------------------

export const BLANK_FILTER_ID = '__blank__';


type TextOperatorIcon = ComponentType<{ className?: string }>;

const TEXT_OPERATOR_OPTIONS: {
    operator: TextFilterOperator;
    label: string;
    icon: TextOperatorIcon;
}[] = [
    { operator: 'contains', label: 'İçeren', icon: MagnifyingGlassIcon },
    { operator: 'notContains', label: 'İçermeyen', icon: NoSymbolIcon },
    { operator: 'startsWith', label: 'İle başlar', icon: ArrowRightIcon },
    { operator: 'endsWith', label: 'İle biten', icon: ArrowLeftIcon },
    { operator: 'equals', label: 'Eşittir', icon: CheckIcon },
    { operator: 'notEquals', label: 'Eşit değil', icon: XMarkIcon },
];

const getTextOperatorOption = (operator: TextFilterOperator) =>
    TEXT_OPERATOR_OPTIONS.find((item) => item.operator === operator) ?? TEXT_OPERATOR_OPTIONS[0];

const FILTER_POPOVER_Z_INDEX = 10002;

function SyncFilterDraftOnOpen({
    open,
    onOpen,
}: {
    open: boolean;
    onOpen: () => void;
}) {
    const wasOpenRef = useRef(false);

    useEffect(() => {
        if (open && !wasOpenRef.current) {
            onOpen();
        }
        wasOpenRef.current = open;
    }, [open, onOpen]);

    return null;
}

const isBlankValue = (value: unknown) =>
    value === null || value === undefined || value === '';

const formatFilterCellValue = (value: unknown): string => {
    if (isBlankValue(value)) return '-';
    if (typeof value === 'boolean') return value ? 'Evet' : 'Hayir';
    if (typeof value === 'number') return value.toLocaleString('tr-TR');
    if (value instanceof Date) return value.toLocaleDateString('tr-TR');
    return String(value);
};

export const getCellFilterMeta = (
    columnId: string,
    rawValue: unknown,
    valueMappers?: Record<string, Record<string | number, string>>
) => {
    if (isBlankValue(rawValue)) {
        return { id: BLANK_FILTER_ID, label: '(Boş)', isBlank: true };
    }

    const mapper = valueMappers?.[columnId];
    const mappedLabel =
        mapper && Object.prototype.hasOwnProperty.call(mapper, rawValue as string | number)
            ? mapper[rawValue as string | number]
            : undefined;

    return {
        id: String(rawValue),
        label: mappedLabel ?? formatFilterCellValue(rawValue),
        isBlank: false,
    };
};

const getColumnFilterValue = (column: Column<any>): ColumnFilterValue => {
    const current = column.getFilterValue();

    if (!current) {
        return {};
    }

    if (typeof current === 'object' && !Array.isArray(current)) {
        return current as ColumnFilterValue;
    }

    if (typeof current === 'string') {
        return {
            textFilter: current.trim()
                ? { operator: 'contains', value: current }
                : null,
        };
    }

    if (Array.isArray(current)) {
        return { facetValues: current.map(String) };
    }

    return {};
};

const mergeColumnFilterValue = (
    column: Column<any>,
    patch: Partial<ColumnFilterValue>
): ColumnFilterValue | undefined => {
    const current = getColumnFilterValue(column);
    const next: ColumnFilterValue = {
        ...current,
        ...patch,
    };

    const hasFacet = Array.isArray(next.facetValues) && next.facetValues.length > 0;
    // Operator secimi bos degerle de saklanabilir (ikon gosterimi icin)
    const hasText = next.textFilter != null;

    if (!hasFacet && !hasText) {
        return undefined;
    }

    if (!hasFacet) {
        delete next.facetValues;
    }

    if (!hasText) {
        delete next.textFilter;
    }

    return next;
};

export const columnFilter: FilterFn<any> = (row, columnId, filterValue) => {
    if (!filterValue) {
        return true;
    }

    const valueMappers = (row as { table?: { options?: { meta?: { valueMappers?: Record<string, Record<string | number, string>> } } } }).table?.options?.meta?.valueMappers;

    let parsed: ColumnFilterValue = {};

    if (typeof filterValue === 'string') {
        parsed = { textFilter: { operator: 'contains', value: filterValue } };
    } else if (Array.isArray(filterValue)) {
        parsed = { facetValues: filterValue.map(String) };
    } else if (typeof filterValue === 'object') {
        parsed = filterValue as ColumnFilterValue;
    }

    const rawValue = row.getValue(columnId);
    const meta = getCellFilterMeta(columnId, rawValue, valueMappers);

    if (parsed.facetValues && parsed.facetValues.length > 0) {
        if (!parsed.facetValues.includes(meta.id)) {
            return false;
        }
    }

    const textFilter = parsed.textFilter;
    if (textFilter?.value?.trim()) {
        const searchValue = textFilter.value.trim().toLocaleLowerCase('tr-TR');
        const cellText = meta.label.toLocaleLowerCase('tr-TR');

        switch (textFilter.operator) {
            case 'contains':
                return cellText.includes(searchValue);
            case 'notContains':
                return !cellText.includes(searchValue);
            case 'startsWith':
                return cellText.startsWith(searchValue);
            case 'endsWith':
                return cellText.endsWith(searchValue);
            case 'equals':
                return cellText === searchValue;
            case 'notEquals':
                return cellText !== searchValue;
            default:
                return true;
        }
    }

    return true;
};

export const buildColumnFilterSqlClause = (
    columnId: string,
    filterValue: unknown,
    escapeSqlValue: (value: string) => string,
    buildSqlColumnName: (columnId: string) => string
): string | null => {
    if (!filterValue) {
        return null;
    }

    const columnName = buildSqlColumnName(columnId);
    const castColumn = `CAST(${columnName} AS NVARCHAR(MAX))`;

    let parsed: ColumnFilterValue = {};

    if (typeof filterValue === 'string') {
        const trimmed = filterValue.trim();
        if (!trimmed) return null;
        return `${castColumn} LIKE N'%${escapeSqlValue(trimmed)}%'`;
    }

    if (Array.isArray(filterValue)) {
        parsed = { facetValues: filterValue.map(String) };
    } else if (typeof filterValue === 'object') {
        parsed = filterValue as ColumnFilterValue;
    }

    const clauses: string[] = [];

    if (parsed.facetValues && parsed.facetValues.length > 0) {
        const includesBlank = parsed.facetValues.includes(BLANK_FILTER_ID);
        const values = parsed.facetValues
            .filter((value) => value !== BLANK_FILTER_ID)
            .map((value) => `N'${escapeSqlValue(value)}'`);

        const valueClauses: string[] = [];
        if (values.length > 0) {
            valueClauses.push(`${columnName} In (${values.join(', ')})`);
        }
        if (includesBlank) {
            valueClauses.push(`(${columnName} IS NULL OR ${castColumn} = N'')`);
        }

        if (valueClauses.length === 1) {
            clauses.push(valueClauses[0]);
        } else if (valueClauses.length > 1) {
            clauses.push(`(${valueClauses.join(' Or ')})`);
        }
    }

    const textFilter = parsed.textFilter;
    if (textFilter?.value?.trim()) {
        const escaped = escapeSqlValue(textFilter.value.trim());
        switch (textFilter.operator) {
            case 'contains':
                clauses.push(`${castColumn} LIKE N'%${escaped}%'`);
                break;
            case 'notContains':
                clauses.push(`${castColumn} NOT LIKE N'%${escaped}%'`);
                break;
            case 'startsWith':
                clauses.push(`${castColumn} LIKE N'${escaped}%'`);
                break;
            case 'endsWith':
                clauses.push(`${castColumn} LIKE N'%${escaped}'`);
                break;
            case 'equals':
                clauses.push(`${castColumn} = N'${escaped}'`);
                break;
            case 'notEquals':
                clauses.push(`${castColumn} <> N'${escaped}'`);
                break;
            default:
                break;
        }
    }

    if (clauses.length === 0) {
        return null;
    }

    return clauses.length === 1 ? clauses[0] : `(${clauses.join(' And ')})`;
};

interface FacetOption {
    id: string;
    label: string;
    count: number;
}

const buildFacetOptions = <T,>(
    table: Table<T>,
    columnId: string,
    valueMappers?: Record<string, Record<string | number, string>>
): FacetOption[] => {
    const counts = new Map<string, FacetOption>();

    table.getCoreRowModel().rows.forEach((row) => {
        const meta = getCellFilterMeta(columnId, row.getValue(columnId), valueMappers);
        const existing = counts.get(meta.id);

        if (existing) {
            existing.count += 1;
            return;
        }

        counts.set(meta.id, {
            id: meta.id,
            label: meta.label,
            count: 1,
        });
    });

    return Array.from(counts.values()).sort((a, b) =>
        a.label.localeCompare(b.label, 'tr-TR')
    );
};

interface FacetColumnFilterProps<T> {
    column: Column<T, unknown>;
    table: Table<T>;
    valueMappers?: Record<string, Record<string | number, string>>;
}

export function FacetColumnFilter<T>({
    column,
    table,
    valueMappers,
}: FacetColumnFilterProps<T>) {
    const columnId = column.id;
    const currentFilter = getColumnFilterValue(column);
    const activeFacetCount = currentFilter.facetValues?.length ?? 0;

    const [draftValues, setDraftValues] = useState<string[]>(currentFilter.facetValues ?? []);
    const [query, setQuery] = useState('');

    const facetOptions = useMemo(
        () => buildFacetOptions(table, columnId, valueMappers),
        [table, columnId, valueMappers, table.options.data]
    );

    const filteredOptions = useMemo(() => {
        const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR');
        if (!normalizedQuery) {
            return facetOptions;
        }

        return facetOptions.filter((option) =>
            option.label.toLocaleLowerCase('tr-TR').includes(normalizedQuery)
        );
    }, [facetOptions, query]);

    const allOptionIds = facetOptions.map((option) => option.id);
    const isAllSelected =
        allOptionIds.length > 0 && allOptionIds.every((id) => draftValues.includes(id));
    const isSomeSelected = draftValues.length > 0 && !isAllSelected;

    const handleOpen = useCallback(() => {
        setDraftValues(currentFilter.facetValues ?? []);
        setQuery('');
    }, [currentFilter.facetValues]);

    const applyFilter = (close: () => void) => {
        column.setFilterValue(
            mergeColumnFilterValue(column, {
                facetValues: draftValues.length > 0 ? draftValues : null,
            })
        );
        close();
    };

    const toggleValue = (valueId: string) => {
        setDraftValues((prev) =>
            prev.includes(valueId)
                ? prev.filter((id) => id !== valueId)
                : [...prev, valueId]
        );
    };

    const toggleSelectAll = () => {
        setDraftValues(isAllSelected ? [] : allOptionIds);
    };

    return (
        <Popover>
            {({ open, close }) => (
                <>
                    <SyncFilterDraftOnOpen open={open} onOpen={handleOpen} />
                    <PopoverButton
                            as={Button}
                            isIcon
                            variant="flat"
                            className={clsx(
                                'size-5 shrink-0 rounded',
                                activeFacetCount > 0 &&
                                    'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-500/10'
                            )}
                            title="Değer filtresi"
                            onClick={(event: MouseEvent) => event.stopPropagation()}
                        >
                            <FunnelIcon className="size-3.5" />
                        </PopoverButton>

                        <Transition
                            as={Fragment}
                            enter="transition ease-out duration-150"
                            enterFrom="opacity-0 translate-y-1"
                            enterTo="opacity-100 translate-y-0"
                            leave="transition ease-in duration-100"
                            leaveFrom="opacity-100 translate-y-0"
                            leaveTo="opacity-0 translate-y-1"
                        >
                            <PopoverPanel
                                anchor="bottom start"
                                className="dark:border-dark-500 dark:bg-dark-750 z-[10002] w-64 rounded-md border border-gray-300 bg-white shadow-lg shadow-gray-200/50 outline-hidden dark:shadow-none"
                                style={{ zIndex: FILTER_POPOVER_Z_INDEX }}
                                onClick={(event) => event.stopPropagation()}
                            >
                                <div className="border-b border-gray-200 p-2 dark:border-dark-600">
                                    <Input
                                        value={query}
                                        onChange={(event) => setQuery(event.target.value)}
                                        placeholder="Ara"
                                        prefix={<MagnifyingGlassIcon className="size-4" />}
                                        classNames={{ input: 'text-xs' }}
                                    />
                                </div>

                                <div className="max-h-56 overflow-y-auto py-1">
                                    <button
                                        type="button"
                                        onClick={toggleSelectAll}
                                        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-dark-600"
                                    >
                                        <span className="flex items-center gap-2">
                                            <Checkbox checked={isAllSelected} indeterminate={isSomeSelected} readOnly />
                                            <span>Tümünü Seç</span>
                                        </span>
                                        <Badge variant="soft" className="text-[10px]">
                                            {facetOptions.length}
                                        </Badge>
                                    </button>

                                    {filteredOptions.map((option) => {
                                        const selected = draftValues.includes(option.id);
                                        return (
                                            <button
                                                key={option.id}
                                                type="button"
                                                onClick={() => toggleValue(option.id)}
                                                className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-dark-600"
                                            >
                                                <span className="flex min-w-0 items-center gap-2">
                                                    <Checkbox checked={selected} readOnly />
                                                    <span className="truncate">{option.label}</span>
                                                </span>
                                                <Badge variant="soft" color="secondary" className="text-[10px]">
                                                    {option.count}
                                                </Badge>
                                            </button>
                                        );
                                    })}

                                    {filteredOptions.length === 0 && (
                                        <div className="px-3 py-2 text-xs text-gray-500 dark:text-dark-300">
                                            Sonuç bulunamadı
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-between gap-2 border-t border-gray-200 p-2 dark:border-dark-600">
                                    <Button
                                        variant="flat"
                                        className="h-7 px-3 text-xs"
                                        disabled={draftValues.length === 0 && activeFacetCount === 0}
                                        onClick={() => {
                                            setDraftValues([]);
                                            column.setFilterValue(
                                                mergeColumnFilterValue(column, {
                                                    facetValues: null,
                                                })
                                            );
                                            close();
                                        }}
                                    >
                                        Temizle
                                    </Button>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="flat"
                                            className="h-7 px-3 text-xs"
                                            onClick={() => {
                                                setDraftValues(currentFilter.facetValues ?? []);
                                                close();
                                            }}
                                        >
                                            İptal
                                        </Button>
                                        <Button
                                            color="primary"
                                            className="h-7 px-3 text-xs"
                                            onClick={() => applyFilter(close)}
                                        >
                                            Tamam
                                        </Button>
                                    </div>
                                </div>
                            </PopoverPanel>
                        </Transition>
                </>
            )}
        </Popover>
    );
}

interface TextColumnFilterProps<T> {
    column: Column<T, unknown>;
}

/**
 * Kolon altindaki metin filtresi: input + yaninda buyutec (operator secimi).
 */
export function TextColumnFilter<T>({ column }: TextColumnFilterProps<T>) {
    const currentFilter = getColumnFilterValue(column);
    const activeTextFilter = currentFilter.textFilter;
    const operator = activeTextFilter?.operator ?? 'contains';
    const filterValue = activeTextFilter?.value ?? '';
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [inputValue, setInputValue] = useState(filterValue);

    useEffect(() => {
        setInputValue(filterValue);
    }, [filterValue]);

    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    const applyTextFilter = useCallback(
        (nextOperator: TextFilterOperator, nextValue: string) => {
            column.setFilterValue(
                mergeColumnFilterValue(column, {
                    // Bos degerde bile operator saklanir; ikon secimi gorunsun
                    textFilter: { operator: nextOperator, value: nextValue.trim() },
                })
            );
        },
        [column]
    );

    const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
        const nextValue = event.target.value;
        setInputValue(nextValue);

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            applyTextFilter(operator, nextValue);
        }, 300);
    };

    const handleOperatorSelect = (nextOperator: TextFilterOperator, close: () => void) => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        applyTextFilter(nextOperator, inputValue);
        close();
    };

    const clearTextFilter = (close: () => void) => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        setInputValue('');
        column.setFilterValue(
            mergeColumnFilterValue(column, {
                textFilter: null,
            })
        );
        close();
    };

    const activeOperatorOption = getTextOperatorOption(operator);
    const ActiveOperatorIcon = activeOperatorOption.icon;
    const hasActiveOperator = Boolean(activeTextFilter);
    const hasActiveValue = Boolean(filterValue);

    return (
        <div
            className="mt-1 flex items-center overflow-hidden rounded border border-gray-300 bg-white/70 dark:border-dark-500 dark:bg-dark-900/40"
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
        >
            <Popover>
                {({ close }) => (
                    <>
                        <PopoverButton
                            as={Button}
                            isIcon
                            variant="flat"
                            className={clsx(
                                'size-7 shrink-0 rounded-none border-r border-gray-300 dark:border-dark-500',
                                (hasActiveOperator || hasActiveValue) &&
                                    'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-500/10'
                            )}
                            title={`Metin filtresi (${activeOperatorOption.label})`}
                        >
                            <ActiveOperatorIcon className="size-3.5" />
                        </PopoverButton>

                        <Transition
                            as={Fragment}
                            enter="transition ease-out duration-150"
                            enterFrom="opacity-0 translate-y-1"
                            enterTo="opacity-100 translate-y-0"
                            leave="transition ease-in duration-100"
                            leaveFrom="opacity-100 translate-y-0"
                            leaveTo="opacity-0 translate-y-1"
                        >
                            <PopoverPanel
                                anchor="bottom start"
                                className="dark:border-dark-500 dark:bg-dark-750 z-[10002] w-56 rounded-md border border-gray-300 bg-white py-1 shadow-lg shadow-gray-200/50 outline-hidden dark:shadow-none"
                                style={{ zIndex: FILTER_POPOVER_Z_INDEX }}
                                onClick={(event) => event.stopPropagation()}
                            >
                                {TEXT_OPERATOR_OPTIONS.map((option) => {
                                    const Icon = option.icon;
                                    const isActive = operator === option.operator;

                                    return (
                                        <button
                                            key={option.operator}
                                            type="button"
                                            onClick={() => handleOperatorSelect(option.operator, close)}
                                            className={clsx(
                                                'flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors',
                                                isActive
                                                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300'
                                                    : 'hover:bg-gray-100 dark:hover:bg-dark-600'
                                            )}
                                        >
                                            <Icon className="size-4 shrink-0 opacity-70" />
                                            <span>{option.label}</span>
                                        </button>
                                    );
                                })}

                                <button
                                    type="button"
                                    onClick={() => clearTextFilter(close)}
                                    className="flex w-full items-center gap-2 border-t border-gray-200 px-3 py-2 text-left text-xs hover:bg-gray-100 dark:border-dark-600 dark:hover:bg-dark-600"
                                >
                                    <MagnifyingGlassIcon className="size-4 shrink-0 opacity-70" />
                                    <span>Sıfırla</span>
                                </button>
                            </PopoverPanel>
                        </Transition>
                    </>
                )}
            </Popover>

            <Input
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                placeholder="Ara..."
                classNames={{
                    root: 'min-w-0 flex-1',
                    input:
                        'h-7 rounded-none border-0 bg-transparent px-2 text-xs shadow-none focus:ring-0 dark:bg-transparent',
                }}
            />
        </div>
    );
}


