import type {
  DataTableRemoteOperationSettings,
  DataTableRemoteOperations,
} from "../types";

export type ResolvedDataTableRemoteOperations = Required<DataTableRemoteOperationSettings>;

const DISABLED_REMOTE_OPERATIONS: ResolvedDataTableRemoteOperations = {
  filtering: false,
  sorting: false,
  paging: false,
  grouping: false,
  groupPaging: false,
  summary: false,
  searching: false,
};

const ENABLED_REMOTE_OPERATIONS: ResolvedDataTableRemoteOperations = {
  filtering: true,
  sorting: true,
  paging: true,
  grouping: true,
  groupPaging: true,
  summary: true,
  searching: true,
};

export function resolveRemoteOperations(
  remoteOperations: DataTableRemoteOperations | undefined,
): ResolvedDataTableRemoteOperations {
  if (remoteOperations === true) {
    return { ...ENABLED_REMOTE_OPERATIONS };
  }

  if (!remoteOperations) {
    return { ...DISABLED_REMOTE_OPERATIONS };
  }

  return {
    ...DISABLED_REMOTE_OPERATIONS,
    ...remoteOperations,
  };
}
