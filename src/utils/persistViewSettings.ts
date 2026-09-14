import type { TableViewSettings } from "../components/TableViewMenu";

const STORAGE_PREFIX = "modern-dt-pro:viewSettings:";

export const loadPersistedViewSettings = (
  storageKey: string | undefined,
): Partial<TableViewSettings> | undefined => {
  if (!storageKey || typeof window === "undefined") {
    return undefined;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + storageKey);
    if (!raw) {
      return undefined;
    }
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : undefined;
  } catch {
    return undefined;
  }
};

export const savePersistedViewSettings = (
  storageKey: string | undefined,
  settings: TableViewSettings,
): void => {
  if (!storageKey || typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(settings));
  } catch {
    // localStorage kullanilamiyor (gizli mod, kota dolu, vb.) - sessizce yok say
  }
};
