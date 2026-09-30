import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Popover,
  PopoverButton,
  PopoverPanel,
  Portal,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import {
  ArrowUturnLeftIcon,
  Bars3BottomLeftIcon,
  CalendarDaysIcon,
  ExclamationTriangleIcon,
  CheckIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
  PencilSquareIcon,
  TableCellsIcon,
  TrashIcon,
  ViewColumnsIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

import { Button, Checkbox, Input } from "../ui";
import type {
  DataTablePivotAggregate,
  DataTablePivotConfig,
  DataTablePivotFilterValue,
  DataTablePivotValue,
} from "../types";
import {
  DEFAULT_DATE_HIERARCHY,
  PIVOT_INTERVAL_LABELS,
  getPivotFieldValues,
  pivotFilterKey,
  pivotIntervalFieldId,
  type PivotField,
  type PivotValueMappers,
} from "./pivotEngine";
import {
  MAXIMIZED_DIALOG_CLASS,
  MaximizeButton,
  RESIZABLE_DIALOG_LIMITS_CLASS,
  useResizableDialog,
} from "./resizableDialog";

import type { PivotIssue } from "./pivotValidation";

export type { PivotField };

export const PIVOT_AGGREGATE_LABELS: Record<DataTablePivotAggregate, string> = {
  sum: "Toplam",
  avg: "Ortalama",
  count: "Adet",
  min: "En küçük",
  max: "En büyük",
};

const AGGREGATES = Object.keys(PIVOT_AGGREGATE_LABELS) as DataTablePivotAggregate[];
const FILTER_VALUE_LIMIT = 500;

type Config = DataTablePivotConfig<any>;
type DimensionArea = "rows" | "columns" | "filters";
type Area = DimensionArea | "values" | "all";
export type PivotArea = Area;
type DragItem = { field: string; from: Area; index: number };

const DIMENSION_AREAS: DimensionArea[] = ["rows", "columns", "filters"];

const dimensionList = (config: Config, area: DimensionArea): string[] =>
  (area === "filters" ? config.filters ?? [] : config[area]).map(String);

/** Alani kaynak alandan cikarir, hedef alana ekler. Boyut alanlari birbirini dislar. */
export function movePivotField(
  config: Config,
  item: DragItem,
  target: Area,
  targetIndex: number | undefined,
  fields: PivotField[],
): Config {
  let values = [...config.values];
  let moved: DataTablePivotValue | undefined;
  if (item.from === "values") {
    moved = values[item.index];
    values = values.filter((_, index) => index !== item.index);
  }

  const lists: Record<DimensionArea, string[]> = {
    rows: dimensionList(config, "rows"),
    columns: dimensionList(config, "columns"),
    filters: dimensionList(config, "filters"),
  };

  let insertAt = targetIndex;
  if (target !== "values" && target !== "all") {
    // Ham tarih alani listeden birakilinca Yil > Ay > Gun kirilimina acilir.
    const source = fields.find((field) => field.id === item.field);
    const ids = item.from === "all" && source?.isDate
      ? DEFAULT_DATE_HIERARCHY.map((interval) => pivotIntervalFieldId(source.id, interval))
      : [item.field];
    ids.forEach((id) => {
      DIMENSION_AREAS.forEach((area) => {
        const index = lists[area].indexOf(id);
        if (index < 0) return;
        if (area === target && insertAt !== undefined && index < insertAt) insertAt -= 1;
        lists[area] = lists[area].filter((field) => field !== id);
      });
    });
    const list = [...lists[target]];
    list.splice(insertAt ?? list.length, 0, ...ids);
    lists[target] = list;
  } else if (item.from !== "values" && item.from !== "all") {
    lists[item.from] = lists[item.from].filter((field) => field !== item.field);
  }

  if (target === "values") {
    const isNumeric = fields.find((field) => field.id === item.field)?.isNumeric ?? false;
    const entry: DataTablePivotValue = moved ?? {
      field: item.field,
      aggregate: isNumeric ? "sum" : "count",
    };
    if (item.from === "values" && insertAt !== undefined && item.index < insertAt) insertAt -= 1;
    values.splice(insertAt ?? values.length, 0, entry);
  }

  const inDimension = new Set([...lists.rows, ...lists.columns, ...lists.filters]);
  const filterValues = Object.fromEntries(
    Object.entries(config.filterValues ?? {}).filter(([field]) => inDimension.has(field)),
  );

  return {
    ...config,
    rows: lists.rows,
    columns: lists.columns,
    filters: lists.filters,
    values,
    filterValues,
  };
}

type PivotFieldChooserProps = {
  config: Config;
  fields: PivotField[];
  data: readonly Record<string, any>[];
  valueMappers?: PivotValueMappers;
  dateFields?: ReadonlySet<string>;
  onChange: (config: Config) => void;
  /** Ayarlardaki hata/uyarilar; pencerede listelenir. */
  issues?: PivotIssue[];
  /** Verilirse pencere disaridan acilip kapanir (ornegin veri yuklendikten sonra). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Dugmeyi gizler; pencere disaridan (`open`) acilabilir. */
  hideButton?: boolean;
};

export function PivotFieldChooser({ open: openProp, onOpenChange, hideButton = false, ...props }: PivotFieldChooserProps) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setOpenState(next);
    onOpenChange?.(next);
  };
  const errorCount = props.issues?.filter((issue) => issue.level === "error").length ?? 0;
  return (
    <>
      {hideButton ? null : <Button
        variant="flat"
        className="relative h-8 gap-1.5 rounded-full px-3 text-sm"
        title={errorCount > 0 ? `Alan seçici — ${errorCount} hata` : "Alan seçici"}
        onClick={() => setOpen(true)}
      >
        <TableCellsIcon className="size-5" />
        <span>Pivot</span>
        {errorCount > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-red-600 text-[10px] font-semibold text-white">
            !
          </span>
        ) : null}
      </Button>}
      <PivotFieldChooserDialog {...props} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function PivotFieldChooserDialog({
  open,
  onClose,
  config,
  fields,
  data,
  valueMappers,
  dateFields,
  onChange,
  issues = [],
}: Omit<PivotFieldChooserProps, "open" | "onOpenChange"> & { open: boolean; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const resizable = useResizableDialog(open);
  const areas = usePivotAreas({ config, fields, data, valueMappers, dateFields, onChange });
  const { lists, move, dragProps, dropProps, dropTarget } = areas;
  const usedFields = new Set([
    ...lists.rows,
    ...lists.columns,
    ...lists.filters,
    ...config.values.map((value) => value.field),
  ]);
  // Tarih alani: kendisi ya da kirilimlarindan biri kullaniliyorsa isaretli
  const isUsed = (field: PivotField) =>
    usedFields.has(field.id)
    || (field.isDate && fields.some((child) => child.parentId === field.id && usedFields.has(child.id)));

  // Ust alanlar ada gore; tarih kirilimlari ust alaninin hemen altinda, Yil > Saat sirasiyla
  const filteredFields = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("tr-TR");
    const matches = (field: PivotField) => !query || field.label.toLocaleLowerCase("tr-TR").includes(query);
    const topLevel = fields
      .filter((field) => !field.parentId)
      .sort((a, b) => a.label.localeCompare(b.label, "tr-TR"));
    return topLevel.flatMap((field) => {
      const children = fields.filter((child) => child.parentId === field.id);
      const visibleChildren = matches(field) ? children : children.filter(matches);
      return matches(field) || visibleChildren.length > 0 ? [field, ...visibleChildren] : [];
    });
  }, [fields, search]);

  const toggleField = (field: PivotField, checked: boolean) => {
    if (checked) {
      move({ field: field.id, from: "all", index: -1 }, field.isNumeric ? "values" : "rows");
      return;
    }
    const removed = new Set([
      field.id,
      ...fields.filter((child) => child.parentId === field.id).map((child) => child.id),
    ]);
    const keep = (id: string) => !removed.has(id);
    onChange({
      ...config,
      rows: lists.rows.filter(keep),
      columns: lists.columns.filter(keep),
      filters: lists.filters.filter(keep),
      values: config.values.filter((value) => keep(value.field)),
      filterValues: Object.fromEntries(
        Object.entries(config.filterValues ?? {}).filter(([id]) => keep(id)),
      ),
    });
  };

  return (
    <Transition
      show={open}
      as={Fragment}
      afterLeave={() => setSearch("")}
    >
      <Dialog onClose={onClose} className="relative z-[200]">
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-900/40 dark:bg-black/60" aria-hidden="true" />
        </TransitionChild>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel
              ref={resizable.panelRef}
              className={clsx(
                "dark:bg-dark-750 dark:border-dark-500 dark:text-dark-100 flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white text-gray-700 shadow-2xl",
                resizable.maximized
                  ? MAXIMIZED_DIALOG_CLASS
                  : clsx("h-[min(40rem,calc(100dvh-2rem))] w-[min(48rem,calc(100vw-2rem))]", RESIZABLE_DIALOG_LIMITS_CLASS),
              )}
            >
              <div className="dark:border-dark-500 flex items-center justify-between border-b border-gray-200 px-5 py-3.5">
                <DialogTitle className="dark:text-dark-50 text-lg font-semibold text-gray-900">
                  Alan Seçici
                </DialogTitle>
                <div className="flex items-center gap-1">
                  <MaximizeButton maximized={resizable.maximized} onClick={resizable.toggleMaximized} />
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Kapat"
                    title="Kapat"
                    className="dark:hover:bg-dark-500 grid size-8 place-items-center rounded-full text-gray-500 hover:bg-gray-100"
                  >
                    <XMarkIcon className="size-5" />
                  </button>
                </div>
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-1 gap-x-4 gap-y-3 overflow-y-auto p-5 md:grid-cols-2 md:grid-rows-[minmax(16rem,3fr)_minmax(8rem,2fr)]">
                <section className="flex min-h-0 flex-col">
                  <AreaTitle icon={<Squares2X2Icon className="size-4" />}>Tüm alanlar</AreaTitle>
                  <div
                    className={clsx(
                      "dark:border-dark-500 flex h-64 flex-col rounded-md border border-gray-300 md:h-auto md:min-h-0 md:flex-1",
                      dropTarget?.area === "all" && "ring-primary-500 ring-2",
                    )}
                    {...dropProps("all")}
                  >
                    <div className="dark:border-dark-500 border-b border-gray-200 p-2">
                      <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Alan ara..."
                        prefix={<MagnifyingGlassIcon className="size-4" />}
                        classNames={{ root: "w-full", input: "text-sm" }}
                      />
                    </div>
                    <ul className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
                      {filteredFields.map((field) => (
                        <li
                          key={field.id}
                          {...dragProps({ field: field.id, from: "all", index: -1 })}
                          className={clsx(
                            "dark:hover:bg-dark-600 flex cursor-grab items-center gap-2 rounded px-1 py-1.5 hover:bg-gray-50",
                            field.parentId && "ml-6",
                          )}
                        >
                          <Checkbox
                            label={field.interval ? PIVOT_INTERVAL_LABELS[field.interval] : field.label}
                            checked={isUsed(field)}
                            onChange={(event) => toggleField(field, event.currentTarget.checked)}
                          />
                          {field.isNumeric ? (
                            <span className="ml-auto text-[10px] font-semibold text-gray-400">123</span>
                          ) : field.isDate ? (
                            <CalendarDaysIcon className="ml-auto size-3.5 text-gray-400" />
                          ) : null}
                        </li>
                      ))}
                      {filteredFields.length === 0 ? (
                        <li className="py-2 text-xs opacity-60">Eşleşen alan yok</li>
                      ) : null}
                    </ul>
                  </div>
                </section>

                <section className="flex min-h-0 flex-col gap-3">
                  <div className="flex min-h-0 flex-1 flex-col">
                    <AreaTitle icon={<Bars3BottomLeftIcon className="size-4" />}>Satır alanları</AreaTitle>
                    {areas.renderArea("rows")}
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col">
                    <AreaTitle icon={<ViewColumnsIcon className="size-4" />}>Sütun alanları</AreaTitle>
                    {areas.renderArea("columns")}
                  </div>
                </section>

                <section className="flex min-h-0 flex-col">
                  <AreaTitle icon={<FunnelIcon className="size-4" />}>Filtre alanları</AreaTitle>
                  {areas.renderArea("filters")}
                </section>

                <section className="flex min-h-0 flex-col">
                  <AreaTitle icon={<span className="text-sm leading-none font-semibold">Σ</span>}>
                    Veri alanları
                  </AreaTitle>
                  {areas.renderArea("values")}
                </section>
              </div>

              {issues.length > 0 ? (
                <ul
                  role="alert"
                  className="dark:border-dark-500 flex max-h-32 flex-col gap-1 overflow-y-auto border-t border-gray-200 px-5 py-2.5"
                >
                  {issues.map((issue) => (
                    <li
                      key={issue.message}
                      className={clsx(
                        "flex items-start gap-2 text-sm",
                        issue.level === "error" ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-400",
                      )}
                    >
                      <ExclamationTriangleIcon className="mt-0.5 size-4 shrink-0" />
                      {issue.message}
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="dark:border-dark-500 flex flex-wrap items-center gap-2 border-t border-gray-200 px-5 py-3">
                <p className="mr-auto text-xs opacity-70">
                  Alanları kutular arasında sürükleyin. Filtre simgesiyle değer seçin.
                </p>
                <Button
                  variant="flat"
                  className="h-8 px-3 text-sm"
                  onClick={() =>
                    onChange({ ...config, rows: [], columns: [], filters: [], values: [], filterValues: {} })}
                >
                  Temizle
                </Button>
                <Button color="primary" className="h-8 px-4 text-sm" onClick={onClose}>
                  Tamam
                </Button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}

type PivotAreasOptions = {
  config: Config;
  fields: PivotField[];
  data: readonly Record<string, any>[];
  valueMappers?: PivotValueMappers;
  dateFields?: ReadonlySet<string>;
  onChange: (config: Config) => void;
};

/** Alan kutulari icin ortak surukle-birak durumu ve cip cizimi (pencere ve panel paylasir). */
export function usePivotAreas({ config, fields, data, valueMappers, dateFields, onChange }: PivotAreasOptions) {
  const [drag, setDrag] = useState<DragItem | null>(null);
  const [dropTarget, setDropTarget] = useState<{ area: Area; index?: number } | null>(null);

  const labelOf = (id: string) => fields.find((field) => field.id === id)?.label ?? id;
  const lists: Record<DimensionArea, string[]> = {
    rows: dimensionList(config, "rows"),
    columns: dimensionList(config, "columns"),
    filters: dimensionList(config, "filters"),
  };

  const move = (item: DragItem, target: Area, index?: number) =>
    onChange(movePivotField(config, item, target, index, fields));

  const setFieldLabel = (field: string, name: string | undefined) => {
    const { [field]: _previous, ...rest } = config.fieldLabels ?? {};
    onChange({ ...config, fieldLabels: name ? { ...rest, [field]: name } : rest });
  };

  const setFilterValues = (field: string, values: DataTablePivotFilterValue[] | undefined) => {
    const next = { ...(config.filterValues ?? {}) };
    if (values === undefined) delete next[field];
    else next[field] = values;
    onChange({ ...config, filterValues: next });
  };

  const dragProps = (item: DragItem) => ({
    draggable: true,
    onDragStart: (event: DragEvent) => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", item.field);
      setDrag(item);
    },
    onDragEnd: () => {
      setDrag(null);
      setDropTarget(null);
    },
  });

  const dropProps = (area: Area, index?: number) => ({
    onDragOver: (event: DragEvent) => {
      if (!drag) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      if (dropTarget?.area !== area || dropTarget.index !== index) setDropTarget({ area, index });
    },
    onDrop: (event: DragEvent) => {
      if (!drag) return;
      event.preventDefault();
      event.stopPropagation();
      move(drag, area, index);
      setDrag(null);
      setDropTarget(null);
    },
  });

  const renderChips = (area: Exclude<Area, "all">) => {
    if (area === "values") {
      return config.values.map((value, index) => (
        <FieldChip
          key={`${value.field}-${index}`}
          label={value.label ?? `${labelOf(value.field)} (${PIVOT_AGGREGATE_LABELS[value.aggregate]})`}
          renamed={Boolean(value.label)}
          onRename={(name) =>
            onChange({
              ...config,
              values: config.values.map((item, i) => (i === index ? { ...item, label: name } : item)),
            })}
          dragging={drag?.from === "values" && drag.index === index}
          insertBefore={dropTarget?.area === "values" && dropTarget.index === index}
          dragProps={dragProps({ field: value.field, from: "values", index })}
          dropProps={dropProps("values", index)}
          onRemove={() => move({ field: value.field, from: "values", index }, "all")}
        >
          <AggregateMenuButton
            label={labelOf(value.field)}
            aggregate={value.aggregate}
            onChange={(aggregate) =>
              onChange({
                ...config,
                values: config.values.map((item, i) =>
                  i === index ? { ...item, aggregate } : item),
              })}
          />
        </FieldChip>
      ));
    }
    return lists[area].map((field, index) => (
      <FieldChip
        key={field}
        label={labelOf(field)}
        renamed={Boolean(config.fieldLabels?.[field])}
        onRename={(name) => setFieldLabel(field, name)}
        dragging={drag?.from === area && drag.field === field}
        insertBefore={dropTarget?.area === area && dropTarget.index === index}
        dragProps={dragProps({ field, from: area, index })}
        dropProps={dropProps(area, index)}
        onRemove={() => move({ field, from: area, index }, "all")}
      >
        <ValueFilterButton
          field={field}
          label={labelOf(field)}
          data={data}
          valueMappers={valueMappers}
          dateFields={dateFields}
          selected={config.filterValues?.[field]}
          onChange={(values) => setFilterValues(field, values)}
        />
      </FieldChip>
    ));
  };

  const isEmpty = (area: Exclude<Area, "all">) =>
    area === "values" ? config.values.length === 0 : lists[area].length === 0;

  const renderArea = (area: Exclude<Area, "all">) => (
    <AreaBox
      area={area}
      active={dropTarget?.area === area && dropTarget.index === undefined}
      dropProps={dropProps(area)}
      empty={isEmpty(area)}
    >
      {renderChips(area)}
    </AreaBox>
  );

  return { lists, labelOf, move, drag, dropTarget, dragProps, dropProps, renderChips, renderArea, isEmpty };
}

function AreaTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <h3 className="dark:text-dark-100 mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
      <span className="grid size-4 place-items-center text-gray-500">{icon}</span>
      {children}
    </h3>
  );
}

const AREA_EMPTY_TEXT: Record<Exclude<Area, "all">, string> = {
  rows: "Satır alanlarını buraya sürükleyin",
  columns: "Sütun alanlarını buraya sürükleyin",
  filters: "Filtre alanlarını buraya sürükleyin",
  values: "Veri alanlarını buraya sürükleyin",
};

function AreaBox({
  area,
  active,
  empty,
  dropProps,
  children,
}: {
  area: Exclude<Area, "all">;
  active: boolean;
  empty: boolean;
  dropProps: Record<string, unknown>;
  children: ReactNode;
}) {
  return (
    <div
      {...dropProps}
      className={clsx(
        "dark:border-dark-500 flex min-h-[5.5rem] flex-1 flex-col gap-1.5 overflow-y-auto rounded-md border border-gray-300 p-1.5 transition-colors",
        active && "border-primary-500 bg-primary-500/5 dark:border-primary-500",
      )}
    >
      {empty ? (
        <p className="m-auto px-2 text-center text-xs opacity-50">{AREA_EMPTY_TEXT[area]}</p>
      ) : (
        children
      )}
    </div>
  );
}

export function FieldChip({
  label,
  dragging,
  insertBefore,
  dragProps,
  dropProps,
  onRemove,
  onRename,
  renamed = false,
  children,
}: {
  label: string;
  dragging: boolean;
  insertBefore: boolean;
  dragProps: Record<string, unknown>;
  dropProps: Record<string, unknown>;
  onRemove: () => void;
  /** Yeni gorunen ad; undefined varsayilan ada dondurur. */
  onRename?: (name: string | undefined) => void;
  /** Ad kullanici tarafindan degistirilmis mi (menude "Varsayilan ada don" gosterilir). */
  renamed?: boolean;
  children?: ReactNode;
}) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const chipRef = useRef<HTMLDivElement>(null);
  // Enter ile bitirince kutu kapanirken blur da tetiklenebilir; ikinci kaydi engelle
  const finishedRef = useRef(false);

  const startRename = () => {
    finishedRef.current = false;
    setEditing(true);
  };

  const finishRename = (value: string | null) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setEditing(false);
    chipRef.current?.focus();
    if (value === null || !onRename) return;
    const name = value.trim();
    if (name === label) return;
    onRename(name === "" ? undefined : name);
  };

  const menuItems: ContextMenuItem[] = [
    ...(onRename
      ? [{ label: "Yeniden adlandır", icon: <PencilSquareIcon className="size-4" />, onSelect: startRename }]
      : []),
    ...(onRename && renamed
      ? [{ label: "Varsayılan ada dön", icon: <ArrowUturnLeftIcon className="size-4" />, onSelect: () => onRename(undefined) }]
      : []),
    { label: "Kaldır", icon: <TrashIcon className="size-4" />, onSelect: onRemove },
  ];

  return (
    <div
      ref={chipRef}
      {...(editing ? {} : dragProps)}
      {...dropProps}
      draggable={!editing}
      tabIndex={0}
      aria-label={`${label}. Menü için sağ tıklayın; F2 yeniden adlandırır, Delete kaldırır`}
      onContextMenu={(event: ReactMouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        if (!editing) setMenu({ x: event.clientX, y: event.clientY });
      }}
      onKeyDown={(event: KeyboardEvent) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          onRemove();
        } else if (event.key === "F2" && onRename) {
          event.preventDefault();
          startRename();
        }
      }}
      className={clsx(
        "dark:bg-dark-600 dark:border-dark-500 focus-visible:ring-primary-500 relative flex shrink-0 items-center gap-1 rounded-none border border-gray-200 bg-gray-100 py-1 pr-1 pl-2.5 text-sm outline-hidden focus-visible:ring-2",
        editing ? "cursor-default" : "cursor-grab active:cursor-grabbing",
        dragging && "opacity-40",
        insertBefore && "before:bg-primary-500 before:absolute before:-top-1 before:right-0 before:left-0 before:h-0.5 before:rounded",
      )}
    >
      {editing ? (
        <input
          autoFocus
          defaultValue={label}
          aria-label={`${label} için yeni ad`}
          placeholder="Boş bırakırsanız varsayılan ad"
          onFocus={(event) => event.currentTarget.select()}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") finishRename(event.currentTarget.value);
            else if (event.key === "Escape") finishRename(null);
          }}
          onBlur={(event) => finishRename(event.currentTarget.value)}
          className="dark:bg-dark-800 dark:border-dark-450 dark:text-dark-50 focus:border-primary-500 h-6 min-w-0 flex-1 border border-gray-300 bg-white px-1.5 text-sm text-gray-900 outline-hidden"
        />
      ) : (
        <span className="min-w-0 flex-1 truncate py-0.5" title={renamed ? `${label} (yeniden adlandırıldı)` : undefined}>
          {label}
        </span>
      )}
      {children}
      {menu ? (
        <ChipContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)} items={menuItems} />
      ) : null}
    </div>
  );
}

type ContextMenuItem = { label: string; icon?: ReactNode; onSelect: () => void };

/** Imlec konumunda acilan basit baglam menusu; disari tiklama, Escape veya kaydirma ile kapanir. */
function ChipContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const { width, height } = menu.getBoundingClientRect();
    setPosition({
      left: Math.min(x, window.innerWidth - width - 8),
      top: Math.min(y, window.innerHeight - height - 8),
    });
    menu.querySelector<HTMLButtonElement>("button")?.focus();
  }, [x, y]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  return (
    <Portal>
      <div
        ref={menuRef}
        role="menu"
        className="dtp dark:border-dark-500 dark:bg-dark-750 fixed z-[300] min-w-36 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        style={position}
        onContextMenu={(event) => event.preventDefault()}
      >
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            onClick={() => {
              onClose();
              item.onSelect();
            }}
            className="dark:text-dark-100 dark:hover:bg-dark-600 dark:focus:bg-dark-600 flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 outline-hidden hover:bg-gray-100 focus:bg-gray-100"
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>
    </Portal>
  );
}

/** Veri alani cipinde ozet turunu (Toplam, Ortalama...) secen menu. */
function AggregateMenuButton({
  label,
  aggregate,
  onChange,
}: {
  label: string;
  aggregate: DataTablePivotAggregate;
  onChange: (aggregate: DataTablePivotAggregate) => void;
}) {
  return (
    <Popover className="relative">
      <PopoverButton
        title={`${label} özet türü`}
        aria-label={`${label} özet türü: ${PIVOT_AGGREGATE_LABELS[aggregate]}`}
        className="dark:hover:bg-dark-500 grid size-6 place-items-center rounded-none text-gray-400 outline-hidden hover:bg-gray-200 hover:text-gray-700"
      >
        <span className="text-sm leading-none font-semibold">Σ</span>
      </PopoverButton>
      <PopoverPanel
        anchor={{ to: "bottom end", gap: 6 }}
        className="dark:bg-dark-750 dark:border-dark-500 z-[210] w-44 rounded-md border border-gray-300 bg-white py-1 shadow-lg outline-hidden"
      >
        {({ close }) => (
          <div role="menu" aria-label="Özet türü">
            <p className="dark:text-dark-300 px-3 pt-1 pb-1.5 text-[11px] font-semibold text-gray-400">
              Özet türü
            </p>
            {AGGREGATES.map((item) => {
              const selected = item === aggregate;
              return (
                <button
                  key={item}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  onClick={() => {
                    onChange(item);
                    close();
                  }}
                  className={clsx(
                    "dark:hover:bg-dark-600 flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm outline-hidden hover:bg-gray-100",
                    selected ? "text-primary-600 dark:text-primary-400 font-medium" : "dark:text-dark-100 text-gray-700",
                  )}
                >
                  <CheckIcon className={clsx("size-4", !selected && "invisible")} />
                  {PIVOT_AGGREGATE_LABELS[item]}
                </button>
              );
            })}
          </div>
        )}
      </PopoverPanel>
    </Popover>
  );
}

function ValueFilterButton({
  field,
  label,
  data,
  valueMappers,
  dateFields,
  selected,
  onChange,
}: {
  field: string;
  label: string;
  data: readonly Record<string, any>[];
  valueMappers?: PivotValueMappers;
  dateFields?: ReadonlySet<string>;
  selected?: DataTablePivotFilterValue[];
  onChange: (values: DataTablePivotFilterValue[] | undefined) => void;
}) {
  const isFiltered = Array.isArray(selected);
  return (
    <Popover className="relative">
      <PopoverButton
        title={`${label} filtresi`}
        aria-label={`${label} filtresi`}
        className={clsx(
          "grid size-6 place-items-center rounded-none outline-hidden",
          isFiltered
            ? "text-primary-600 dark:text-primary-400"
            : "dark:hover:bg-dark-500 text-gray-400 hover:bg-gray-200 hover:text-gray-700",
        )}
      >
        <FunnelIcon className={clsx("size-3.5", isFiltered && "fill-current")} />
      </PopoverButton>
      <PopoverPanel
        anchor={{ to: "bottom end", gap: 6 }}
        className="dark:bg-dark-750 dark:border-dark-500 z-[210] w-64 rounded-md border border-gray-300 bg-white shadow-lg outline-hidden"
      >
        <ValueFilterList
          field={field}
          data={data}
          valueMappers={valueMappers}
          dateFields={dateFields}
          selected={selected}
          onChange={onChange}
        />
      </PopoverPanel>
    </Popover>
  );
}

function ValueFilterList({
  field,
  data,
  valueMappers,
  dateFields,
  selected,
  onChange,
}: {
  field: string;
  data: readonly Record<string, any>[];
  valueMappers?: PivotValueMappers;
  dateFields?: ReadonlySet<string>;
  selected?: DataTablePivotFilterValue[];
  onChange: (values: DataTablePivotFilterValue[] | undefined) => void;
}) {
  const [search, setSearch] = useState("");
  const options = useMemo(
    () => getPivotFieldValues(data, field, valueMappers, dateFields),
    [data, field, valueMappers, dateFields],
  );
  const selectedKeys = useMemo(
    () => (selected ? new Set(selected.map(pivotFilterKey)) : undefined),
    [selected],
  );
  const display = (option: { label: string }) => option.label;

  const query = search.trim().toLocaleLowerCase("tr-TR");
  const visible = (query
    ? options.filter((option) => display(option).toLocaleLowerCase("tr-TR").includes(query))
    : options
  ).slice(0, FILTER_VALUE_LIMIT);

  const isChecked = (key: string) => !selectedKeys || selectedKeys.has(key);
  const checkedCount = selectedKeys ? options.filter((option) => selectedKeys.has(option.key)).length : options.length;

  const toggle = (option: { key: string }, checked: boolean) => {
    const current = selectedKeys ?? new Set(options.map((item) => item.key));
    const next = new Set(current);
    if (checked) next.add(option.key);
    else next.delete(option.key);
    if (next.size === options.length) {
      onChange(undefined);
      return;
    }
    onChange(
      options
        .filter((item) => next.has(item.key))
        .map((item) => item.value as DataTablePivotFilterValue),
    );
  };

  return (
    <div className="flex flex-col">
      <div className="dark:border-dark-500 border-b border-gray-200 p-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Değer ara..."
          prefix={<MagnifyingGlassIcon className="size-4" />}
          classNames={{ root: "w-full", input: "text-sm" }}
        />
      </div>
      <div className="dark:border-dark-500 border-b border-gray-200 px-3 py-2">
        <Checkbox
          label={`Tümü (${checkedCount}/${options.length})`}
          checked={checkedCount === options.length}
          indeterminate={checkedCount > 0 && checkedCount < options.length}
          onChange={(event) => onChange(event.currentTarget.checked ? undefined : [])}
        />
      </div>
      <ul className="max-h-60 overflow-y-auto px-3 py-2">
        {visible.map((option) => (
          <li key={option.key} className="py-1">
            <Checkbox
              label={display(option)}
              checked={isChecked(option.key)}
              onChange={(event) => toggle(option, event.currentTarget.checked)}
            />
          </li>
        ))}
        {visible.length === 0 ? <li className="py-1 text-xs opacity-60">Eşleşen değer yok</li> : null}
      </ul>
    </div>
  );
}
