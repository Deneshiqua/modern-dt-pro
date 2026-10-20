import { useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUturnLeftIcon,
  Bars2Icon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

import { Button } from "../ui";

export type TableColumnsPanelColumn = {
  id: string;
  /** Gorunen baslik (yeniden adlandirilmis olabilir). */
  label: string;
  /** Yeniden adlandirilmamis baslik. */
  defaultLabel: string;
  isNumeric: boolean;
  /** Gruplanan kolonlar tabloda gizlenir; burada gosterilir ama gorunurlugu degistirilemez. */
  grouped: boolean;
};

export type TableColumnsChange = {
  columnOrder: string[];
  hiddenColumns: string[];
  columnLabels: Record<string, string>;
};

/**
 * Tablo Ayarlari > Alan Secici: kolonlari goster/gizle, surukleyerek ya da oklarla sirala,
 * cift tiklayarak yeniden adlandir. Degisiklikler aninda tabloya yansir.
 */
export function TableColumnsPanel({
  columns,
  hidden,
  labels,
  onChange,
  onClose,
}: {
  /** Guncel sirayla tum veri kolonlari. */
  columns: TableColumnsPanelColumn[];
  hidden: ReadonlySet<string>;
  labels: Record<string, string>;
  onChange: (change: TableColumnsChange) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const order = columns.map((column) => column.id);
  const emit = (patch: Partial<TableColumnsChange>) =>
    onChange({ columnOrder: order, hiddenColumns: [...hidden], columnLabels: labels, ...patch });

  const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
  const visibleList = normalizedQuery
    ? columns.filter((column) =>
      column.label.toLocaleLowerCase("tr-TR").includes(normalizedQuery)
      || column.id.toLocaleLowerCase("tr-TR").includes(normalizedQuery))
    : columns;
  const shownCount = columns.filter((column) => !hidden.has(column.id)).length;

  const setHidden = (ids: string[], hide: boolean) => {
    const next = new Set(hidden);
    ids.forEach((id) => (hide ? next.add(id) : next.delete(id)));
    emit({ hiddenColumns: [...next] });
  };

  const moveTo = (id: string, index: number) => {
    const without = order.filter((item) => item !== id);
    const from = order.indexOf(id);
    const target = from < index ? index - 1 : index;
    without.splice(Math.max(0, Math.min(target, without.length)), 0, id);
    emit({ columnOrder: without });
  };

  const rename = (id: string, name: string | null) => {
    setEditing(null);
    if (name === null) return;
    const column = columns.find((item) => item.id === id);
    const trimmed = name.trim();
    const { [id]: _previous, ...rest } = labels;
    emit({ columnLabels: trimmed && trimmed !== column?.defaultLabel ? { ...rest, [id]: trimmed } : rest });
  };

  const dropProps = (index: number) => ({
    onDragOver: (event: DragEvent) => {
      if (!dragId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const next = event.clientY > rect.top + rect.height / 2 ? index + 1 : index;
      if (next !== dropIndex) setDropIndex(next);
    },
    onDrop: (event: DragEvent) => {
      if (!dragId || dropIndex === null) return;
      event.preventDefault();
      moveTo(dragId, dropIndex);
      setDragId(null);
      setDropIndex(null);
    },
  });

  return (
    <>
      <div className="dark:border-dark-500 flex flex-wrap items-center gap-2 border-b border-gray-200 px-5 py-3">
        <label className="dark:border-dark-450 dark:bg-dark-800 flex h-9 min-w-48 flex-1 items-center gap-2 rounded-md border border-gray-300 bg-white px-2.5">
          <MagnifyingGlassIcon className="size-4 shrink-0 text-gray-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Kolon ara..."
            aria-label="Kolon ara"
            className="dark:text-dark-100 min-w-0 flex-1 bg-transparent text-sm text-gray-800 outline-hidden"
          />
        </label>
        <span className="dark:text-dark-300 text-xs text-gray-500">
          {shownCount} / {columns.length} görünür
        </span>
        <Button variant="flat" className="h-8 px-3 text-sm" onClick={() => setHidden(order, false)}>
          Tümünü göster
        </Button>
        <Button
          variant="flat"
          className="h-8 px-3 text-sm"
          onClick={() => setHidden(columns.filter((column) => !column.grouped).map((column) => column.id), true)}
        >
          Tümünü gizle
        </Button>
      </div>

      <ul
        className="min-h-0 flex-1 overflow-y-auto px-3 py-2"
        aria-label="Kolonlar"
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropIndex(null);
        }}
      >
        {visibleList.map((column) => {
          const index = order.indexOf(column.id);
          const isHidden = hidden.has(column.id);
          const renamed = Boolean(labels[column.id]);
          return (
            <li
              key={column.id}
              draggable={editing !== column.id && !normalizedQuery}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", column.id);
                setDragId(column.id);
              }}
              onDragEnd={() => {
                setDragId(null);
                setDropIndex(null);
              }}
              {...dropProps(index)}
              className={clsx(
                "dark:hover:bg-dark-700 group relative flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-50",
                dragId === column.id && "opacity-40",
                dropIndex === index && "before:bg-primary-500 before:absolute before:-top-px before:right-2 before:left-2 before:h-0.5 before:rounded",
                dropIndex === index + 1 && index === order.length - 1
                  && "after:bg-primary-500 after:absolute after:right-2 after:-bottom-px after:left-2 after:h-0.5 after:rounded",
              )}
            >
              <Bars2Icon
                className={clsx("size-4 shrink-0 text-gray-400", normalizedQuery ? "opacity-30" : "cursor-grab")}
                aria-hidden="true"
              />
              <input
                type="checkbox"
                checked={!isHidden}
                disabled={column.grouped}
                onChange={() => setHidden([column.id], !isHidden)}
                aria-label={`${column.label} görünür`}
                className="dtp-checkbox size-4 shrink-0 cursor-pointer disabled:cursor-not-allowed"
              />
              {editing === column.id ? (
                <input
                  autoFocus
                  defaultValue={column.label}
                  aria-label={`${column.label} için yeni başlık`}
                  placeholder={column.defaultLabel}
                  onFocus={(event) => event.currentTarget.select()}
                  onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                    if (event.key === "Enter") rename(column.id, event.currentTarget.value);
                    else if (event.key === "Escape") {
                      event.stopPropagation();
                      rename(column.id, null);
                    }
                  }}
                  onBlur={(event) => rename(column.id, event.currentTarget.value)}
                  className="dark:bg-dark-800 dark:border-dark-450 dark:text-dark-50 focus:border-primary-500 h-7 min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 text-sm text-gray-900 outline-hidden"
                />
              ) : (
                <span
                  onDoubleClick={() => setEditing(column.id)}
                  title={renamed ? `${column.label} (asıl adı: ${column.defaultLabel})` : "Çift tıklayarak yeniden adlandırın"}
                  className={clsx(
                    "min-w-0 flex-1 truncate text-sm select-none",
                    isHidden ? "dark:text-dark-400 text-gray-400" : "dark:text-dark-100 text-gray-800",
                  )}
                >
                  {column.label}
                  {renamed ? <span className="dark:text-dark-400 ml-1.5 text-xs text-gray-400">({column.defaultLabel})</span> : null}
                  {column.grouped ? <span className="text-primary-600 ml-1.5 text-xs">gruplandı</span> : null}
                </span>
              )}
              <span className="dark:text-dark-300 w-8 shrink-0 text-right text-[11px] text-gray-400">
                {column.isNumeric ? "123" : "Abc"}
              </span>
              <div className="flex shrink-0 items-center opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                <IconButton label="Yeniden adlandır" onClick={() => setEditing(column.id)}>
                  <PencilSquareIcon className="size-4" />
                </IconButton>
                {renamed ? (
                  <IconButton label="Asıl ada dön" onClick={() => rename(column.id, "")}>
                    <ArrowUturnLeftIcon className="size-4" />
                  </IconButton>
                ) : null}
                <IconButton label="Yukarı taşı" disabled={index === 0} onClick={() => moveTo(column.id, index - 1)}>
                  <ArrowUpIcon className="size-4" />
                </IconButton>
                <IconButton
                  label="Aşağı taşı"
                  disabled={index === order.length - 1}
                  onClick={() => moveTo(column.id, index + 2)}
                >
                  <ArrowDownIcon className="size-4" />
                </IconButton>
              </div>
            </li>
          );
        })}
        {visibleList.length === 0 ? (
          <li className="dark:text-dark-300 px-2 py-6 text-center text-sm text-gray-500">Eşleşen kolon yok</li>
        ) : null}
      </ul>

      <div className="dark:border-dark-500 flex flex-wrap items-center gap-2 border-t border-gray-200 px-5 py-3">
        <p className="dark:text-dark-300 mr-auto text-xs text-gray-500">
          Sürükleyerek sıralayın, çift tıklayarak yeniden adlandırın. Değişiklikler hemen uygulanır.
        </p>
        <Button
          variant="flat"
          className="h-9 px-3 text-sm"
          onClick={() => onChange({ columnOrder: [], hiddenColumns: [], columnLabels: {} })}
        >
          Varsayılana dön
        </Button>
        <Button color="primary" className="h-9 px-5 text-sm" onClick={onClose}>
          Tamam
        </Button>
      </div>
    </>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="dark:hover:bg-dark-600 grid size-7 place-items-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}
