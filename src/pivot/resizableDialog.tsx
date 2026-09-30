import { useLayoutEffect, useRef, useState } from "react";
import { ArrowsPointingInIcon, ArrowsPointingOutIcon } from "@heroicons/react/24/outline";

/** Buyutulmus pencere boyutu. */
export const MAXIMIZED_DIALOG_CLASS = "h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)]";

/** Normal pencerenin sinirlari; sag alt koseden elle boyutlandirilabilir. */
export const RESIZABLE_DIALOG_LIMITS_CLASS =
  "max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] min-h-[24rem] min-w-[min(20rem,calc(100vw-2rem))] resize";

/**
 * Buyut/kucult ve elle boyutlandirma durumu. Elle boyutlandirma satir ici width/height yazar;
 * buyut/kucult bunlari temizler ki pencere her zaman tam ekrana ya da varsayilan boyutuna donsun.
 */
export function useResizableDialog(open: boolean) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [maximized, setMaximized] = useState(false);

  // Her acilista varsayilan boyutla basla (cizimden once, titreme olmadan)
  useLayoutEffect(() => {
    if (open) setMaximized(false);
  }, [open]);

  const clearManualSize = () => {
    const panel = panelRef.current;
    if (panel) {
      panel.style.width = "";
      panel.style.height = "";
    }
  };

  return {
    panelRef,
    maximized,
    toggleMaximized: () => {
      clearManualSize();
      setMaximized((value) => !value);
    },
  };
}

export function MaximizeButton({ maximized, onClick }: { maximized: boolean; onClick: () => void }) {
  const label = maximized ? "Küçült" : "Büyüt";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="dark:hover:bg-dark-500 grid size-8 place-items-center rounded-full text-gray-500 hover:bg-gray-100"
    >
      {maximized ? <ArrowsPointingInIcon className="size-4.5" /> : <ArrowsPointingOutIcon className="size-4.5" />}
    </button>
  );
}
