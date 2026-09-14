import {
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  EyeSlashIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export type ColumnHeaderContextMenuProps = {
  position: { x: number; y: number };
  isPinnedLeft: boolean;
  isPinnedRight: boolean;
  isHideDisabled: boolean;
  isGroupDisabled: boolean;
  onHide: () => void;
  onGroup: () => void;
  onPinLeft: () => void;
  onPinRight: () => void;
  onClose: () => void;
};

export function ColumnHeaderContextMenu({
  position,
  isPinnedLeft,
  isPinnedRight,
  isHideDisabled,
  isGroupDisabled,
  onHide,
  onGroup,
  onPinLeft,
  onPinRight,
  onClose,
}: ColumnHeaderContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) {
        return;
      }
      onClose();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const handleScroll = () => {
      onClose();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [onClose]);

  const items = [
    { label: "Gizle", icon: EyeSlashIcon, onClick: onHide, active: false, hidden: isHideDisabled },
    { label: "Grupla", icon: Squares2X2Icon, onClick: onGroup, active: false, hidden: isGroupDisabled },
    { label: "Sola Sabitle", icon: ChevronDoubleLeftIcon, onClick: onPinLeft, active: isPinnedLeft, hidden: false },
    { label: "Sağa Sabitle", icon: ChevronDoubleRightIcon, onClick: onPinRight, active: isPinnedRight, hidden: false },
  ].filter((item) => !item.hidden);

  if (items.length === 0) {
    return null;
  }

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9999] w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-dark-500 dark:bg-dark-750"
      style={{
        left: Math.min(Math.max(8, position.x), window.innerWidth - 216),
        top: Math.min(position.y, window.innerHeight - 180),
      }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={() => {
            item.onClick();
          }}
          className={clsx(
            "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm outline-hidden transition-colors hover:bg-gray-100 dark:hover:bg-dark-600",
            item.active
              ? "text-primary-600 dark:text-primary-400"
              : "text-gray-700 dark:text-dark-100",
          )}
        >
          <item.icon className="size-4.5" />
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
