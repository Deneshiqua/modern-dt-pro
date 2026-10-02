import { Fragment, type ReactNode } from "react";
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

import type { DataTablePivotToolbarButton } from "../types";
import {
  MAXIMIZED_DIALOG_CLASS,
  MaximizeButton,
  RESIZABLE_DIALOG_LIMITS_CLASS,
  useResizableDialog,
} from "./resizableDialog";

/** Pivot ayarlari penceresindeki sekmeler (Tablo Gorunumu'ndeki anahtarlarla ayni kimlikler). */
export type PivotSettingsTab = DataTablePivotToolbarButton;

/** Sekmelerin goruntulenme sirasi (pencere ve Tablo Gorunumu anahtarlari bu sirayi kullanir). */
export const PIVOT_SETTINGS_TABS: { id: PivotSettingsTab; label: string }[] = [
  { id: "fieldChooser", label: "Alan Seçici" },
  { id: "conditions", label: "Koşullu Biçimlendirme" },
  { id: "numberFormat", label: "Sayı Biçimi" },
  { id: "cellStyles", label: "Hücre Renkleri" },
  { id: "configuration", label: "Yapılandırma" },
  { id: "data", label: "Veri" },
];

const tabOrder = (id: PivotSettingsTab) => PIVOT_SETTINGS_TABS.findIndex((item) => item.id === id);

export type PivotSettingsSection = {
  id: PivotSettingsTab;
  /** Sekme basligindaki kucuk gosterge (hata, kural sayisi, ayar var noktasi). */
  badge?: ReactNode;
  content: ReactNode;
};

/**
 * Tum pivot ayarlarini sekmelerle tek pencerede toplar. Paneller sekme degisince kaybolmaz
 * (yalnizca gizlenir); boylece "Uygula" bekleyen taslaklar korunur.
 */
export function PivotSettingsDialog({
  open,
  onClose,
  tab,
  onTabChange,
  sections,
}: {
  open: boolean;
  onClose: () => void;
  tab: PivotSettingsTab;
  onTabChange: (tab: PivotSettingsTab) => void;
  sections: PivotSettingsSection[];
}) {
  const resizable = useResizableDialog(open);
  const ordered = [...sections].sort((a, b) => tabOrder(a.id) - tabOrder(b.id));
  const active = ordered.some((section) => section.id === tab) ? tab : ordered[0]?.id;

  return (
    <Transition show={open} as={Fragment}>
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
                "dtp dark:bg-dark-750 dark:border-dark-500 dark:text-dark-100 flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white text-gray-700 shadow-2xl",
                resizable.maximized
                  ? MAXIMIZED_DIALOG_CLASS
                  : clsx("h-[min(44rem,calc(100dvh-2rem))] w-[min(64rem,calc(100vw-2rem))]", RESIZABLE_DIALOG_LIMITS_CLASS),
              )}
            >
              <div className="dark:border-dark-500 flex flex-col border-b border-gray-200">
                <div className="flex items-center gap-3 px-5 pt-3.5 pb-2">
                  <DialogTitle className="dark:text-dark-50 min-w-0 flex-1 text-lg font-semibold text-gray-900">
                    Pivot Ayarları
                  </DialogTitle>
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
                <div role="tablist" aria-label="Pivot ayarları" className="flex gap-1 overflow-x-auto px-3">
                  {ordered.map((section) => {
                    const label = PIVOT_SETTINGS_TABS.find((item) => item.id === section.id)?.label ?? section.id;
                    const selected = section.id === active;
                    return (
                      <button
                        key={section.id}
                        type="button"
                        role="tab"
                        id={`pivot-tab-${section.id}`}
                        aria-selected={selected}
                        aria-controls={`pivot-panel-${section.id}`}
                        onClick={() => onTabChange(section.id)}
                        className={clsx(
                          "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors",
                          selected
                            ? "border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400 font-medium"
                            : "dark:text-dark-200 dark:hover:text-dark-50 border-transparent text-gray-600 hover:text-gray-900",
                        )}
                      >
                        {label}
                        {section.badge}
                      </button>
                    );
                  })}
                </div>
              </div>

              {sections.map((section) => (
                <div
                  key={section.id}
                  role="tabpanel"
                  id={`pivot-panel-${section.id}`}
                  aria-labelledby={`pivot-tab-${section.id}`}
                  hidden={section.id !== active}
                  className={clsx("min-h-0 flex-1 flex-col", section.id === active ? "flex" : "hidden")}
                >
                  {section.content}
                </div>
              ))}
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}

/** Sekme basliginda sayi rozeti. */
export function TabCount({ count, tone = "primary" }: { count: number; tone?: "primary" | "danger" }) {
  if (count <= 0) return null;
  return (
    <span
      className={clsx(
        "grid min-w-4 place-items-center rounded-full px-1 text-[10px] leading-4 font-semibold text-white",
        tone === "danger" ? "bg-red-600" : "bg-primary-600",
      )}
    >
      {count}
    </span>
  );
}

/** Sekme basliginda "ayar var" noktasi. */
export function TabDot() {
  return <span className="bg-primary-600 size-1.5 rounded-full" aria-hidden="true" />;
}
