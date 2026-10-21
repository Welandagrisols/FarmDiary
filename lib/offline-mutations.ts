export type OfflineOperation = "insert" | "update" | "delete";

export interface QueuedMutation<T = any> {
  table: string;
  operation: OfflineOperation;
  data: T;
}

export interface OfflineScope {
  field: "farm_id" | "user_id";
  id: string;
}

export interface OfflineMutationResult<T> {
  rows: T[];
  record: T | null;
}

export function applyOfflineMutation<T extends { id?: string }>(
  rows: T[],
  operation: OfflineOperation,
  data: T,
): OfflineMutationResult<T> {
  const id = data?.id;

  if (operation === "insert") {
    const existingIndex = id ? rows.findIndex((row) => row.id === id) : -1;
    if (existingIndex >= 0) {
      const record = { ...rows[existingIndex], ...data };
      return {
        rows: rows.map((row, index) => index === existingIndex ? record : row),
        record,
      };
    }
    return { rows: [...rows, data], record: data };
  }

  if (!id) return { rows, record: null };

  if (operation === "delete") {
    return { rows: rows.filter((row) => row.id !== id), record: null };
  }

  const existingIndex = rows.findIndex((row) => row.id === id);
  if (existingIndex < 0) return { rows, record: null };

  const record = { ...rows[existingIndex], ...data };
  return {
    rows: rows.map((row, index) => index === existingIndex ? record : row),
    record,
  };
}

export function applyPendingMutations<
  T extends { id?: string; farm_id?: string | null; user_id?: string | null },
>(
  rows: T[],
  queue: readonly QueuedMutation[],
  table: string,
  scope?: OfflineScope,
): T[] {
  let result = rows;
  for (const item of queue) {
    if (item.table !== table) continue;
    const queuedData = item.data as T;
    const scopedValue = scope && queuedData?.[scope.field];
    if (scope && scopedValue && scopedValue !== scope.id) continue;
    result = applyOfflineMutation(result, item.operation, queuedData).rows;
  }
  return result;
}
