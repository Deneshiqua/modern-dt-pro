import type { CSSProperties } from "react";
import clsx from "clsx";

export const SELECT_COLUMN_CELL_CLASS =
  "w-12 min-w-12 max-w-14 overflow-hidden";

export const SELECT_COLUMN_WIDTH = 48;

export const SELECT_COLUMN_STYLE: CSSProperties = {
  width: SELECT_COLUMN_WIDTH,
  minWidth: SELECT_COLUMN_WIDTH,
  maxWidth: 48,
};

export const isSelectColumnId = (columnId: string) => columnId === "select";

export type StickyCellKind = "none" | "select" | "group" | "pinned-left" | "pinned-right";

export const resolveStickyKind = (
  columnIndex: number,
  columnId: string,
  enableRowSelection: boolean,
  stickyEnabled: boolean,
  pinnedLeftColumn?: string | null,
  pinnedRightColumn?: string | null,
): StickyCellKind => {
  if (isSelectColumnId(columnId)) {
    return stickyEnabled ? "select" : "none";
  }
  if (columnId === pinnedRightColumn) {
    return "pinned-right";
  }
  if (columnId === pinnedLeftColumn) {
    return "pinned-left";
  }
  const firstContentIndex = enableRowSelection ? 1 : 0;
  if (stickyEnabled && columnIndex === firstContentIndex) {
    return "group";
  }
  return "none";
};

export const getStickyCellClassName = (
  kind: StickyCellKind,
  variant: "header" | "body" | "group" | "total",
): string => {
  if (kind === "none") return "";
  return clsx(
    "sticky",
    kind === "group" && "min-w-[14rem]",
    (kind === "group" || kind === "pinned-left") && "shadow-[2px_0_5px_-2px_rgba(0,0,0,0.25)]",
    kind === "pinned-right" && "shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.25)]",
    variant === "header" && "z-20 bg-gray-200 dark:bg-dark-800",
    variant === "body" && "z-[5] bg-white dark:bg-dark-700",
    variant === "group" && "z-[5] bg-gray-50 dark:bg-dark-800",
    variant === "total" && "z-[5] bg-primary-50 dark:bg-primary-900/20",
  );
};

// Sabitlenen kolonu render sirasinda gercekten kenara tasir (select -> sola sabitlenen -> digerleri -> saga sabitlenen).
// position:sticky yalnizca scroll sirasinda esigi asinca devreye girer; kolon zaten dogal sirasinda kenardaysa
// (or. az sayida kolon varken tasma olmadan) hicbir sey yapmaz. Bu yuzden kenara "yapismasi" icin gercekten
// render sirasinda o konuma tasinmasi gerekir.
export const reorderPinnedColumns = <TItem,>(
  items: TItem[],
  getColumnId: (item: TItem) => string,
  pinnedLeftColumn: string | null | undefined,
  pinnedRightColumn: string | null | undefined,
): TItem[] => {
  if (!pinnedLeftColumn && !pinnedRightColumn) {
    return items;
  }

  const selectItems: TItem[] = [];
  const leftItems: TItem[] = [];
  const rightItems: TItem[] = [];
  const restItems: TItem[] = [];

  items.forEach((item) => {
    const id = getColumnId(item);
    if (isSelectColumnId(id)) {
      selectItems.push(item);
    } else if (pinnedRightColumn && id === pinnedRightColumn) {
      rightItems.push(item);
    } else if (pinnedLeftColumn && id === pinnedLeftColumn) {
      leftItems.push(item);
    } else {
      restItems.push(item);
    }
  });

  return [...selectItems, ...leftItems, ...restItems, ...rightItems];
};

export const getStickyCellStyle = (
  kind: StickyCellKind,
  enableRowSelection: boolean,
  base?: CSSProperties,
): CSSProperties | undefined => {
  if (kind === "none") return base;
  if (kind === "pinned-right") {
    return {
      ...base,
      position: "sticky",
      right: 0,
    };
  }
  return {
    ...base,
    position: "sticky",
    left: kind === "select" ? 0 : (enableRowSelection ? SELECT_COLUMN_WIDTH : 0),
  };
};
