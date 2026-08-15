import type { Header } from "@tanstack/react-table";
import clsx from "clsx";

type ColumnResizeHandleProps<T> = {
  header: Header<T, unknown>;
  onAutoFit?: (columnId: string) => void;
};

export function ColumnResizeHandle<T>({
  header,
  onAutoFit,
}: ColumnResizeHandleProps<T>) {
  if (!header.column.getCanResize()) {
    return null;
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={header.getResizeHandler()}
      onTouchStart={header.getResizeHandler()}
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
      title="Surukle: genislik | Cift tik: baslik ve icerige sigdir"

      className={clsx(
        "dtp-resize-handle",
        header.column.getIsResizing() && "dtp-resize-handle-active",
      )}
    />
  );
}
