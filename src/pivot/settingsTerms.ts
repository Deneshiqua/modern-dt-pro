import type { DataTablePivotCondition } from "../types";
import { PIVOT_CELL_KINDS, type PivotCellKind } from "./pivotCellStyles";

/** Ayar panelleri hem pivotta (veri alanlari) hem normal tabloda (kolonlar) kullanilir. */
export type SettingsPanelMode = "pivot" | "table";

type ApplyOption = { id: NonNullable<DataTablePivotCondition["applyTo"]>; label: string; hint: string };

export const SETTINGS_TERMS: Record<SettingsPanelMode, {
  which: string;
  allFormats: string;
  allColors: string;
  allConditions: string;
  ownFormatHint: string;
  defaultFormatHint: string;
  ownColorHint: string;
  defaultColorHint: string;
  resetOwnColors: string;
  cellsHint: string;
  alternateHint: string;
  cellKinds: { id: PivotCellKind; label: string; hint: string }[];
  applyOptions: ApplyOption[];
}> = {
  pivot: {
    which: "Hangi değer?",
    allFormats: "Tüm değerler (varsayılan biçim)",
    allColors: "Tüm değerler (varsayılan renkler)",
    allConditions: "Tüm veri alanları",
    ownFormatHint: "Bu veri alanında değiştirmediğiniz ayarlar varsayılan biçimden gelir.",
    defaultFormatHint: "Tüm veri alanlarına uygulanır; bir veri alanını seçerek ona özel biçim verebilirsiniz.",
    ownColorHint: "Bu veri alanında seçmediğiniz renkler varsayılandan gelir.",
    defaultColorHint: "Tüm veri alanlarına uygulanır. Koşullu biçimlendirme bu renklerin üstüne uygulanır.",
    resetOwnColors: "Bu alanın renklerini sıfırla",
    cellsHint: "1. renk — verdiğiniz sırayla ilk sütun",
    alternateHint: "2. renk — sütunlar sırayla 1. ve 2. renkle boyanır; boş bırakılırsa hep 1. renk",
    cellKinds: PIVOT_CELL_KINDS,
    applyOptions: [
      { id: "all", label: "Tüm hücreler", hint: "Veri hücreleri ile ara ve genel toplamlar" },
      { id: "cells", label: "Veri hücreleri", hint: "Toplam satır ve sütunları hariç" },
      { id: "totals", label: "Toplamlar", hint: "Yalnızca ara toplam ve genel toplam hücreleri" },
    ],
  },
  table: {
    which: "Hangi kolon?",
    allFormats: "Tüm sayısal kolonlar (varsayılan biçim)",
    allColors: "Tüm kolonlar (varsayılan renkler)",
    allConditions: "Tüm sayısal kolonlar",
    ownFormatHint: "Bu kolonda değiştirmediğiniz ayarlar varsayılan biçimden gelir.",
    defaultFormatHint: "Tüm sayısal kolonlara uygulanır; bir kolonu seçerek ona özel biçim verebilirsiniz.",
    ownColorHint: "Bu kolonda seçmediğiniz renkler varsayılandan gelir.",
    defaultColorHint: "Tüm kolonlara uygulanır. Koşullu biçimlendirme bu renklerin üstüne uygulanır.",
    resetOwnColors: "Bu kolonun renklerini sıfırla",
    cellsHint: "1. renk — satırlar sırayla, ilk satır",
    alternateHint: "2. renk — satırlar sırayla 1. ve 2. renkle boyanır; boş bırakılırsa hep 1. renk",
    cellKinds: [
      { id: "cells", label: "Veri satırları", hint: "Grup ve toplam olmayan tüm satırlar" },
      { id: "totals", label: "Grup satırları", hint: "Gruplamada grup başlığı ve ara toplam satırları" },
      { id: "grandTotals", label: "Genel toplam", hint: "Gruplamada en alttaki genel toplam satırı" },
    ],
    applyOptions: [
      { id: "all", label: "Tüm satırlar", hint: "Veri, grup ve genel toplam satırları" },
      { id: "cells", label: "Veri satırları", hint: "Grup ve genel toplam satırları hariç" },
      { id: "totals", label: "Toplamlar", hint: "Yalnızca grup ve genel toplam satırları" },
    ],
  },
};
