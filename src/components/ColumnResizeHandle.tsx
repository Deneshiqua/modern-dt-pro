import type { Header } from "@tanstack/react-table";
import clsx from "clsx";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

type ColumnResizeHandleProps<T> = {
  header: Header<T, unknown>;
  onAutoFit?: (columnId: string) => void;
  onResizeStart?: () => void;
};

export function ColumnResizeHandle<T>({
  header,
  onAutoFit,
  onResizeStart,
}: ColumnResizeHandleProps<T>) {
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
  } | null>(null);
  const cursorRef = useRef({ cursor: "", userSelect: "" });

  const restoreDocumentInteraction = () => {
    document.documentElement.style.cursor = cursorRef.current.cursor;
    document.documentElement.style.userSelect = cursorRef.current.userSelect;
  };

  useEffect(
    () => () => {
      if (dragRef.current) {
        dragRef.current = null;
        restoreDocumentInteraction();
      }
    },
    [],
  );

  if (!header.column.getCanResize()) {
    return null;
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    const handle = event.currentTarget;
    const headerCell = handle.closest("th");
    const headerRow = headerCell?.parentElement;
    const table = header.getContext().table;
    const measuredSizing = { ...table.getState().columnSizing };
    const headerCells = headerRow
      ? Array.from(headerRow.children).filter(
          (element): element is HTMLElement => element instanceof HTMLElement,
        )
      : [];

    table.getVisibleLeafColumns().forEach((column, index) => {
      const cell = headerCells[index];
      if (cell) {
        measuredSizing[column.id] = cell.getBoundingClientRect().width;
      }
    });

    const startWidth =
      headerCell?.getBoundingClientRect().width ?? header.column.getSize();

    table.setColumnSizing(measuredSizing);
    onResizeStart?.();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth,
    };
    handle.setPointerCapture(event.pointerId);
    cursorRef.current = {
      cursor: document.documentElement.style.cursor,
      userSelect: document.documentElement.style.userSelect,
    };
    document.documentElement.style.cursor = "col-resize";
    document.documentElement.style.userSelect = "none";
    setIsDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const minSize = header.column.columnDef.minSize ?? 0;
    const maxSize = header.column.columnDef.maxSize ?? Number.MAX_SAFE_INTEGER;
    const nextSize = Math.min(
      maxSize,
      Math.max(minSize, drag.startWidth + event.clientX - drag.startX),
    );

    header.getContext().table.setColumnSizing((current) => ({
      ...current,
      [header.column.id]: nextSize,
    }));
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    restoreDocumentInteraction();
    setIsDragging(false);
  };

  return (
    <button
      type="button"
      aria-label={`${header.column.id} kolonunu boyutlandır`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => {
        event.stopPropagation();
        event.preventDefault();
        if (onAutoFit) {
          onAutoFit(header.column.id);
          return;
        }
        header.column.resetSize();
      }}
      title="Sürükle: genişlik | Çift tık: başlık ve içeriğe sığdır"
      className={clsx(
        "dtp-resize-handle",
        isDragging && "dtp-resize-handle-active",
      )}
    />
  );
}
