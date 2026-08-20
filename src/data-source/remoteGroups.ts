import type { DataTableGroupItem } from "../types";

const REMOTE_GROUP_PLACEHOLDER = Symbol("modern-dt-pro.remote-group-placeholder");
const REMOTE_GROUP_PATH = Symbol("modern-dt-pro.remote-group-path");
const REMOTE_GROUP_SENTINEL_PREFIX = "__modern_dt_remote_group_pending__";

export type RemoteGroupMetadata = {
  path: unknown[];
  count?: number;
  summary?: unknown[];
  loaded: boolean;
};

export type FlattenRemoteGroupsResult<T> = {
  rows: T[];
  metadata: Map<string, RemoteGroupMetadata>;
};

type RemoteGroupPlaceholder = Record<string, unknown> & {
  [REMOTE_GROUP_PLACEHOLDER]: true;
  [REMOTE_GROUP_PATH]: unknown[];
};

function normalizePathValue(value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

export function remoteGroupPathKey(path: readonly unknown[]): string {
  return JSON.stringify(path.map(normalizePathValue));
}

export function isDataTableGroupItem<T>(
  item: T | DataTableGroupItem<T>,
): item is DataTableGroupItem<T> {
  return typeof item === "object"
    && item !== null
    && "key" in item
    && ("items" in item || "count" in item || "summary" in item);
}

export function isRemoteGroupPlaceholder(value: unknown): boolean {
  return typeof value === "object"
    && value !== null
    && REMOTE_GROUP_PLACEHOLDER in value;
}

export function getRemoteGroupPlaceholderPath(
  value: unknown,
): unknown[] | undefined {
  if (!isRemoteGroupPlaceholder(value)) {
    return undefined;
  }

  return (value as RemoteGroupPlaceholder)[REMOTE_GROUP_PATH];
}

export function createRemoteGroupSentinel(
  path: readonly unknown[],
  depth: number,
): string {
  return `${REMOTE_GROUP_SENTINEL_PREFIX}${remoteGroupPathKey(path)}:${depth}`;
}

export function isRemoteGroupSentinel(value: unknown): boolean {
  return typeof value === "string"
    && value.startsWith(REMOTE_GROUP_SENTINEL_PREFIX);
}

function createPlaceholder(
  path: unknown[],
  selectors: string[],
): RemoteGroupPlaceholder {
  const placeholder = {
    [REMOTE_GROUP_PLACEHOLDER]: true,
    [REMOTE_GROUP_PATH]: path,
  } as RemoteGroupPlaceholder;

  selectors.forEach((selector, index) => {
    placeholder[selector] = index < path.length
      ? path[index]
      : createRemoteGroupSentinel(path, index);
  });

  return placeholder;
}

function normalizeLeaf<T extends Record<string, unknown>>(
  leaf: T,
  path: unknown[],
  selectors: string[],
): T {
  const normalized = { ...leaf };
  path.forEach((value, index) => {
    const selector = selectors[index];
    if (selector) {
      normalized[selector as keyof T] = value as T[keyof T];
    }
  });
  return normalized;
}

export function flattenRemoteGroups<T extends Record<string, unknown>>(
  groups: DataTableGroupItem<T>[],
  selectors: string[],
): FlattenRemoteGroupsResult<T> {
  const rows: T[] = [];
  const metadata = new Map<string, RemoteGroupMetadata>();

  const visit = (items: DataTableGroupItem<T>[], ancestorPath: unknown[]) => {
    items.forEach((item) => {
      const path = [...ancestorPath, item.key];
      const loaded = item.items !== undefined && item.items !== null;
      metadata.set(remoteGroupPathKey(path), {
        path,
        count: item.count,
        summary: item.summary,
        loaded,
      });

      const children = item.items;
      if (!children || children.length === 0) {
        rows.push(createPlaceholder(path, selectors) as T);
        return;
      }

      const nestedGroups: DataTableGroupItem<T>[] = [];
      const leaves: T[] = [];
      children.forEach((child) => {
        if (isDataTableGroupItem(child)) {
          nestedGroups.push(child);
        } else {
          leaves.push(child);
        }
      });

      if (nestedGroups.length > 0) {
        visit(nestedGroups, path);
      }
      rows.push(...leaves.map((leaf) => normalizeLeaf(leaf, path, selectors)));
    });
  };

  visit(groups, []);
  return { rows, metadata };
}

export function replaceRemoteGroupItems<T>(
  groups: DataTableGroupItem<T>[],
  path: readonly unknown[],
  items: T[] | DataTableGroupItem<T>[],
  summary?: unknown[],
): DataTableGroupItem<T>[] {
  if (path.length === 0) {
    return groups;
  }

  return groups.map((group) => {
    if (!Object.is(group.key, path[0])) {
      return group;
    }

    if (path.length === 1) {
      return {
        ...group,
        items,
        summary: summary ?? group.summary,
      };
    }

    const nestedGroups = Array.isArray(group.items)
      ? group.items.filter(isDataTableGroupItem)
      : [];
    return {
      ...group,
      items: replaceRemoteGroupItems(
        nestedGroups,
        path.slice(1),
        items,
        summary,
      ),
    };
  });
}
