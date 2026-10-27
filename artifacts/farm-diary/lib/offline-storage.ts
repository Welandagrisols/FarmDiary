import AsyncStorage from "@react-native-async-storage/async-storage";
import { applyOfflineMutation, applyPendingMutations, OfflineOperation, OfflineScope } from "./offline-mutations";
import { isNetworkError } from "./network-errors";

export interface QueueItem {
  id: string;
  table: string;
  operation: "insert" | "update" | "delete";
  data: any;
  timestamp: number;
  retries: number;
}

export interface DeadLetterItem extends QueueItem {
  failedAt: number;
}

const QUEUE_KEY = "offline_sync_queue";
const DEAD_LETTER_KEY = "offline_dead_letter";
const CACHE_PREFIX = "cache_";
let queueMutation = Promise.resolve();

function mutateQueue<T>(operation: () => Promise<T>): Promise<T> {
  const pending = queueMutation.then(operation, operation);
  queueMutation = pending.then(() => undefined, () => undefined);
  return pending;
}

export async function readCache<T>(table: string): Promise<T[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + table);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function writeCache(table: string, data: any[]): Promise<void> {
  await AsyncStorage.setItem(CACHE_PREFIX + table, JSON.stringify(data));
}

export async function getQueue(): Promise<QueueItem[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Saved offline queue has an invalid format.");
  return parsed;
}

export async function getDeadLetterQueue(): Promise<DeadLetterItem[]> {
  const raw = await AsyncStorage.getItem(DEAD_LETTER_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Saved sync recovery queue has an invalid format.");
  return parsed;
}

export async function addToDeadLetter(item: QueueItem): Promise<void> {
  await mutateQueue(async () => {
    const existing = await getDeadLetterQueue();
    if (!existing.some((queued) => queued.id === item.id)) {
      existing.push({ ...item, failedAt: Date.now() });
    }
    await AsyncStorage.setItem(DEAD_LETTER_KEY, JSON.stringify(existing));
  });
}

export async function restoreDeadLetterItems(): Promise<number> {
  return mutateQueue(async () => {
    const queue = await getQueue();
    const deadLetters = await getDeadLetterQueue();
    const queuedIds = new Set(queue.map((item) => item.id));
    const restored = deadLetters
      .filter((item) => !queuedIds.has(item.id))
      .map(({ failedAt: _failedAt, ...item }) => ({ ...item, retries: 0 }));
    const nextQueue = [...queue, ...restored];

    await AsyncStorage.multiSet([
      [QUEUE_KEY, JSON.stringify(nextQueue)],
      [DEAD_LETTER_KEY, JSON.stringify([])],
    ]);
    return restored.length;
  });
}

export async function enqueue(item: Omit<QueueItem, "id" | "timestamp" | "retries">): Promise<void> {
  await mutateQueue(async () => {
    const queue = await getQueue();
    const timestamp = Date.now();
    queue.push({
      ...item,
      id: timestamp.toString() + Math.random().toString(36).slice(2, 7),
      timestamp,
      retries: 0,
    });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  });
}

export async function removeFromQueue(id: string): Promise<void> {
  await mutateQueue(async () => {
    const queue = await getQueue();
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.filter((q) => q.id !== id)));
  });
}

export async function incrementRetry(id: string): Promise<void> {
  await mutateQueue(async () => {
    const queue = await getQueue();
    const updated = queue.map((q) => q.id === id ? { ...q, retries: q.retries + 1 } : q);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
  });
}

// Update cache entries after a successful write — keeps UI in sync without a full refresh
async function updateCacheAfterWrite(
  table: string,
  operation: OfflineOperation,
  data: any,
): Promise<any | null> {
  const prefix = `${CACHE_PREFIX}${table}`;
  const allKeys = await AsyncStorage.getAllKeys();
  const keys = allKeys.filter((key) => key === prefix || key.startsWith(`${prefix}_`));
  const scopeField = table === "farms" ? "user_id" : "farm_id";
  const scopeValue = data?.[scopeField];

  if (operation === "insert" && scopeValue) {
    const scopedKey = `${prefix}_${scopeValue}`;
    if (!keys.includes(scopedKey)) keys.push(scopedKey);
  } else if (operation === "insert" && keys.length === 0) {
    keys.push(prefix);
  }

  let optimisticRecord: any | null = null;
  for (const key of keys) {
    const suffix = key === prefix ? null : key.slice(prefix.length + 1);
    if (operation === "insert" && suffix && scopeValue && suffix !== String(scopeValue)) continue;
    const cached = await readCache<any>(key);
    if (cached === null && operation !== "insert") continue;

    const mutation = applyOfflineMutation(cached ?? [], operation, data);
    let updatedRows = mutation.rows;
    if (suffix && operation !== "delete") {
      updatedRows = updatedRows.filter((row) =>
        row?.[scopeField] == null || String(row[scopeField]) === suffix
      );
    }
    await writeCache(key, updatedRows);
    if (!optimisticRecord && mutation.record) optimisticRecord = mutation.record;
  }
  return optimisticRecord;
}

export async function withCache<T extends { id?: string; farm_id?: string | null; user_id?: string | null }>(
  cacheKey: string,
  fetchFn: () => Promise<T[]>,
  queueTable = cacheKey,
  scope?: OfflineScope,
  onOfflineFallback?: () => void,
): Promise<T[]> {
  try {
    const data = await fetchFn();
    const queue = await getQueue();
    const withPendingWrites = applyPendingMutations(data, queue, queueTable, scope);
    await writeCache(cacheKey, withPendingWrites);
    return withPendingWrites;
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    onOfflineFallback?.();
    const cached = await readCache<T>(cacheKey);
    const queue = await getQueue();
    return applyPendingMutations(cached ?? [], queue, queueTable, scope);
  }
}

export async function clearAllCaches(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter((k) => k.startsWith(CACHE_PREFIX) || k === QUEUE_KEY);
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  } catch {}
}

export async function clearAllStorageForSignOut(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const keysToRemove = allKeys.filter(
      (k) => k.startsWith(CACHE_PREFIX) || k === QUEUE_KEY || k.startsWith("sb-")
    );
    if (keysToRemove.length > 0) {
      await AsyncStorage.multiRemove(keysToRemove);
    }
  } catch {}
}

export async function withWrite<T>(
  table: string,
  operation: OfflineOperation,
  data: any,
  writeFn: () => Promise<T>
): Promise<T> {
  try {
    const result = await writeFn();
    // Optimistically update local cache so UI reflects changes immediately
    try {
      await updateCacheAfterWrite(table, operation, data);
    } catch (cacheError) {
      console.warn("[offline] Cache refresh failed after a successful write:", cacheError);
    }
    return result;
  } catch (error) {
    if (!isNetworkError(error)) throw error;

    await enqueue({ table, operation, data });
    const optimisticRecord = await updateCacheAfterWrite(table, operation, data);
    if (operation === "insert") return data as T;
    if (operation === "update") return (optimisticRecord ?? data) as T;
    return undefined as T;
  }
}
