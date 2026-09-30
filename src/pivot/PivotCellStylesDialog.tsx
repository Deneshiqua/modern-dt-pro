import { Fragment, useEffect, useState, type CSSProperties } from "react";
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from "@headlessui/react";
import { SwatchIcon, XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

import { Button } from "../ui";
import type { DataTablePivotCellStyles, DataTablePivotColorStyle, DataTablePivotValue } from "../types";
import { BACKGROUND_PRESETS, ColorPicker, TEXT_PRESETS } from "./PivotConditionsDialog";
import {
  PIVOT_CELL_KINDS,
  cleanPivotCellStyles,
  hasPivotCellStyles,
  pivotColorStyle,
} from "./pivotCellStyles";
import {
  MAXIMIZED_DIALOG_CLASS,
  MaximizeButton,
  RESIZABLE_DIALOG_LIMITS_CLASS,
  useResizableDialog,
} from "./resizableDialog";

type Styles = DataTablePivotCellStyles;
/** Duzenlenebilen renk anahtari: uc hucre turu + veri hucrelerinin 2. rengi */
type StyleKey = keyof Styles;
type Draft = { defaults: Styles; perValue: Styles[] };

const FIELD_CLASS =
  "dark:bg-dark-800 dark:border-dark-450 dark:text-dark-100 h-9 w-full rounded-md border border-gray-300 bg-white px-2.5 text-sm text-gray-800 outline-hidden focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20";

/** Onizlemede tabloya benzeyen ornek hucre; renk verilmemisse tablonun kendi rengi. */
const PREVIEW_BASE: Record<StyleKey, string> = {
  alternateCells: "bg-white dark:bg-dark-700",
  cells: "bg-white dark:bg-dark-700",
  totals: "bg-gray-50 font-semibold dark:bg-dark-750",
  grandTotals: "bg-indigo-50 font-bold dark:bg-indigo-500/15",
};

type PivotCellStylesButtonProps = {
  cellStyles?: Styles;
  values: DataTablePivotValue[];
  valueLabel: (value: DataTablePivotValue) => string;
  onApply: (cellStyles: Styles | undefined, perValue: (Styles | undefined)[]) => void;
};

export function PivotCellStylesButton(props: PivotCellStylesButtonProps) {
  const [open, setOpen] = useState(false);
  const active = hasPivotCellStyles(props.cellStyles) || props.values.some((value) => hasPivotCellStyles(value.cellStyles));
  return (
    <>
      <Button
        variant="flat"
        isIcon
        className="relative size-8 rounded-full"
        title="Hücre renkleri"
        aria-label="Hücre renkleri"
        onClick={() => setOpen(true)}
      >
        <SwatchIcon className="size-4.5" />
        {active ? <span className="bg-primary-600 absolute top-0.5 right-0.5 size-2 rounded-full" aria-hidden="true" /> : null}
      </Button>
      <PivotCellStylesDialog {...props} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function PivotCellStylesDialog({
  open,
  onClose,
  cellStyles,
  values,
  valueLabel,
  onApply,
}: PivotCellStylesButtonProps & { open: boolean; onClose: () => void }) {
  const resizable = useResizableDialog(open);
  const [draft, setDraft] = useState<Draft>({ defaults: {}, perValue: [] });
  /** "" = tum degerler, "0", "1"... = veri alani sirasi */
  const [target, setTarget] = useState("");

  // Her acilista guncel ayarlardan taslak; Uygula'ya kadar tabloya dokunulmaz
  useEffect(() => {
    if (!open) return;
    setDraft({
      defaults: structuredClone(cellStyles ?? {}),
      perValue: values.map((value) => structuredClone(value.cellStyles ?? {})),
    });
    setTarget("");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const isValue = target !== "";
  const index = isValue ? Number(target) : -1;
  const own: Styles = isValue ? draft.perValue[index] ?? {} : draft.defaults;

  const setColor = (kind: StyleKey, key: keyof DataTablePivotColorStyle, color: string | undefined) => {
    const apply = (styles: Styles): Styles => {
      const entry = { ...styles[kind], [key]: color };
      if (color === undefined) delete entry[key];
      return { ...styles, [kind]: entry };
    };
    setDraft((current) =>
      isValue
        ? { ...current, perValue: current.perValue.map((styles, i) => (i === index ? apply(styles ?? {}) : styles)) }
        : { ...current, defaults: apply(current.defaults) });
  };

  const resetTarget = () =>
    setDraft((current) =>
      isValue
        ? { ...current, perValue: current.perValue.map((styles, i) => (i === index ? {} : styles)) }
        : { ...current, defaults: {} });

  /** Onizleme: varsayilan + (secili alan) ozel renk; 2. renk 1. rengin ustune yazilir */
  const resolved = (kind: StyleKey) => ({ ...draft.defaults[kind], ...(isValue ? own[kind] : undefined) });
  const effective = (kind: StyleKey): CSSProperties | undefined =>
    kind === "alternateCells"
      ? pivotColorStyle({ ...resolved("cells"), ...resolved("alternateCells") })
      : pivotColorStyle(resolved(kind));
  const hasAlternate = Boolean(resolved("alternateCells").backgroundColor || resolved("alternateCells").color);

  const inheritedLabel = (kind: StyleKey, key: keyof DataTablePivotColorStyle, fallback: string) => {
    if (!isValue) return fallback;
    const inherited = draft.defaults[kind]?.[key];
    return inherited ? `Varsayılan (${inherited})` : "Varsayılan";
  };

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
                  : clsx("h-auto w-[min(44rem,calc(100vw-2rem))]", RESIZABLE_DIALOG_LIMITS_CLASS),
              )}
            >
              <div className="dark:border-dark-500 flex items-center gap-3 border-b border-gray-200 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <DialogTitle className="dark:text-dark-50 text-lg font-semibold text-gray-900">Hücre Renkleri</DialogTitle>
                  <p className="dark:text-dark-300 text-xs text-gray-500">
                    Veri ve toplam hücrelerinin arka plan ve yazı renklerini belirleyin.
                  </p>
                </div>
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

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <label className="flex flex-col gap-1">
                  <span className="dark:text-dark-300 text-xs font-medium text-gray-600">Hangi değer?</span>
                  <select className={FIELD_CLASS} value={target} onChange={(event) => setTarget(event.target.value)}>
                    <option value="">Tüm değerler (varsayılan renkler)</option>
                    {values.map((value, i) => (
                      <option key={`${value.field}-${i}`} value={String(i)}>
                        {valueLabel(value)}{hasPivotCellStyles(draft.perValue[i]) ? " • özel renk" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="dark:text-dark-300 mt-1.5 text-xs text-gray-500">
                  {isValue
                    ? "Bu veri alanında seçmediğiniz renkler varsayılandan gelir."
                    : "Tüm veri alanlarına uygulanır. Koşullu biçimlendirme bu renklerin üstüne uygulanır."}
                </p>

                <div className="dark:border-dark-500 mt-5 border-t border-gray-200 pt-3">
                  {PIVOT_CELL_KINDS.map((kind) => (
                    <div
                      key={kind.id}
                      className="dark:border-dark-500 flex flex-col gap-2 border-b border-gray-200 py-3 last:border-b-0"
                    >
                      <ColorRow
                        title={kind.label}
                        hint={kind.id === "cells" ? "1. renk — verdiğiniz sırayla ilk sütun" : kind.hint}
                        styleKey={kind.id}
                        own={own}
                        preview={effective(kind.id)}
                        inheritedLabel={inheritedLabel}
                        onChange={setColor}
                      />
                      {kind.id === "cells" ? (
                        <ColorRow
                          title=""
                          hint="2. renk — sütunlar sırayla 1. ve 2. renkle boyanır; boş bırakılırsa hep 1. renk"
                          styleKey="alternateCells"
                          own={own}
                          preview={hasAlternate ? effective("alternateCells") : effective("cells")}
                          inheritedLabel={inheritedLabel}
                          onChange={setColor}
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="dark:border-dark-500 flex flex-wrap items-center gap-2 border-t border-gray-200 px-5 py-3">
                <Button
                  variant="flat"
                  className="mr-auto h-9 px-3 text-sm"
                  disabled={!hasPivotCellStyles(own)}
                  onClick={resetTarget}
                >
                  {isValue ? "Bu alanın renklerini sıfırla" : "Varsayılan renkleri sıfırla"}
                </Button>
                <Button variant="flat" className="h-9 px-3 text-sm" onClick={onClose}>
                  Vazgeç
                </Button>
                <Button
                  color="primary"
                  className="h-9 px-5 text-sm"
                  onClick={() => {
                    onApply(cleanPivotCellStyles(draft.defaults), draft.perValue.map(cleanPivotCellStyles));
                    onClose();
                  }}
                >
                  Uygula
                </Button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}

function ColorRow({
  title,
  hint,
  styleKey,
  own,
  preview,
  inheritedLabel,
  onChange,
}: {
  title: string;
  hint: string;
  styleKey: StyleKey;
  own: Styles;
  preview: CSSProperties | undefined;
  inheritedLabel: (kind: StyleKey, key: keyof DataTablePivotColorStyle, fallback: string) => string;
  onChange: (kind: StyleKey, key: keyof DataTablePivotColorStyle, color: string | undefined) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-40 flex-1">
        {title ? <p className="dark:text-dark-50 text-sm font-semibold text-gray-900">{title}</p> : null}
        <p className="dark:text-dark-300 text-xs text-gray-500">{hint}</p>
      </div>
      <label className="flex flex-col gap-1">
        <span className="dark:text-dark-300 text-xs font-medium text-gray-600">Arka plan</span>
        <ColorPicker
          value={own[styleKey]?.backgroundColor}
          presets={BACKGROUND_PRESETS}
          emptyLabel={inheritedLabel(styleKey, "backgroundColor", "Yok")}
          onChange={(color) => onChange(styleKey, "backgroundColor", color)}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="dark:text-dark-300 text-xs font-medium text-gray-600">Yazı rengi</span>
        <ColorPicker
          value={own[styleKey]?.color}
          presets={TEXT_PRESETS}
          emptyLabel={inheritedLabel(styleKey, "color", styleKey === "alternateCells" ? "1. renkten" : "Otomatik")}
          onChange={(color) => onChange(styleKey, "color", color)}
        />
      </label>
      <div className="flex flex-col gap-1">
        <span className="dark:text-dark-300 text-xs font-medium text-gray-600">Önizleme</span>
        <div
          className={clsx(
            "dark:border-dark-450 flex h-9 w-28 items-center justify-end rounded-md border border-gray-300 px-3 text-sm tabular-nums",
            PREVIEW_BASE[styleKey],
          )}
          style={preview}
        >
          1.234,5
        </div>
      </div>
    </div>
  );
}
