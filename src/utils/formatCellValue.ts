const isStrictDateTimeString = (value: string): boolean => {
  const normalizedValue = value.trim();

  const isoLikePattern = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)?$/;
  const turkishDateTimePattern = /^\d{2}\.\d{2}\.\d{4}(?: \d{2}:\d{2}(?::\d{2})?)?$/;

  if (!isoLikePattern.test(normalizedValue) && !turkishDateTimePattern.test(normalizedValue)) {
    return false;
  }

  return !Number.isNaN(new Date(normalizedValue).getTime());
};

export const formatCellValue = (value: any): string => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "Evet" : "Hayır";
  if (typeof value === "number") return value.toLocaleString("tr-TR");
  if (value instanceof Date) return value.toLocaleDateString("tr-TR");
  if (typeof value === "string" && isStrictDateTimeString(value)) {
    return new Date(value).toLocaleString("tr-TR");
  }
  return String(value);
};

// Türkçe kolon başlığı - camelCase'i boşluklara ayır ve başharfleri büyüt
export const formatColumnHeader = (key: string): string => {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
};

export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
