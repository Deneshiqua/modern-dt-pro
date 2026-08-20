import type { DataTableLoadOptions } from "../types";

export type DataTableLoadOptionName = keyof DataTableLoadOptions;

export type SerializeLoadOptionsConfig = {
  parameterNames?: Partial<Record<DataTableLoadOptionName, string>>;
  transformValue?: (
    value: unknown,
    name: DataTableLoadOptionName,
    loadOptions: Readonly<DataTableLoadOptions>,
  ) => unknown;
  omitEmpty?: boolean;
};

function isEmptyValue(value: unknown): boolean {
  if (value == null || value === "") {
    return true;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (typeof value === "object") {
    return Object.keys(value).length === 0;
  }

  return false;
}

function serializeValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new TypeError("Load option value cannot be serialized.");
  }

  return serialized;
}

export function serializeLoadOptions(
  loadOptions: DataTableLoadOptions,
  config: SerializeLoadOptionsConfig = {},
): URLSearchParams {
  const params = new URLSearchParams();

  for (const [rawName, rawValue] of Object.entries(loadOptions)) {
    const name = rawName as DataTableLoadOptionName;
    const value = config.transformValue
      ? config.transformValue(rawValue, name, loadOptions)
      : rawValue;

    if (value == null || (config.omitEmpty && isEmptyValue(value))) {
      continue;
    }

    params.set(config.parameterNames?.[name] ?? name, serializeValue(value));
  }

  return params;
}
