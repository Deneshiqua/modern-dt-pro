const HEADER_FONT = "500 14px ui-sans-serif, system-ui, sans-serif";
const CELL_FONT = "400 14px ui-sans-serif, system-ui, sans-serif";
const CELL_PADDING = 32;
const DEFAULT_MIN_SIZE = 48;
const DEFAULT_MAX_SIZE = 640;
const FALLBACK_CHAR_WIDTH = 8;
const FILTER_MIN_WIDTH = 120;

let measureCanvas: HTMLCanvasElement | null = null;

export function measureTextWidth(text: string, font: string): number {
  if (!text) {
    return 0;
  }

  if (typeof document === "undefined") {
    return text.length * FALLBACK_CHAR_WIDTH;
  }

  measureCanvas ??= document.createElement("canvas");
  const context = measureCanvas.getContext("2d");
  if (!context) {
    return text.length * FALLBACK_CHAR_WIDTH;
  }

  context.font = font;
  return context.measureText(text).width;
}

export function measureColumnAutoFitWidth(options: {
  headerLabel: string;
  cellTexts: string[];
  minSize?: number;
  maxSize?: number;
  headerIconWidth?: number;
  filterMinWidth?: number;
}): number {
  const minSize = options.minSize ?? DEFAULT_MIN_SIZE;
  const maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
  const headerIconWidth = options.headerIconWidth ?? 0;
  const filterMinWidth = options.filterMinWidth ?? 0;

  // Once tam baslik metni + ikonlar, sonra hucre metni daha uzunsa onu kullan
  const headerWidth =
    measureTextWidth(options.headerLabel, HEADER_FONT) + headerIconWidth + CELL_PADDING;
  let contentWidth = 0;
  for (const text of options.cellTexts) {
    if (!text) {
      continue;
    }
    contentWidth = Math.max(contentWidth, measureTextWidth(text, CELL_FONT));
  }

  const fitted = Math.max(
    headerWidth,
    contentWidth + CELL_PADDING,
    filterMinWidth,
  );
  return Math.min(maxSize, Math.max(minSize, Math.ceil(fitted)));
}

export function distributeSurplusToColumns(
  sizing: Record<string, number>,
  containerWidth: number,
  lockedIds: string[] = [],
): Record<string, number> {
  if (containerWidth <= 0) {
    return sizing;
  }

  const total = Object.values(sizing).reduce((sum, size) => sum + size, 0);
  const surplus = Math.floor(containerWidth - total);
  if (surplus <= 0) {
    return sizing;
  }

  const flexibleIds = Object.keys(sizing).filter((id) => !lockedIds.includes(id));
  if (flexibleIds.length === 0) {
    return sizing;
  }

  const extra = Math.floor(surplus / flexibleIds.length);
  const remainder = surplus - extra * flexibleIds.length;
  const next = { ...sizing };
  flexibleIds.forEach((id, index) => {
    next[id] += extra + (index === flexibleIds.length - 1 ? remainder : 0);
  });
  return next;
}

export const COLUMN_FILTER_MIN_WIDTH = FILTER_MIN_WIDTH;
