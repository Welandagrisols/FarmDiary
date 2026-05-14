import AsyncStorage from "@react-native-async-storage/async-storage";

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

export async function readCache<T>(table: string): Promise<T[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + table);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function writeCache(table: string, data: any[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_PREFIX + table, JSON.stringify(data));
  } catch {}
}

export async function getQueue(): Promise<QueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function getDeadLetterQueue(): Promise<DeadLetterItem[]> {
  try {
    const raw = await AsyncStorage.getItem(DEAD_LETTER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addToDeadLetter(item: QueueItem): Promise<void> {
  try {
    const existing = await getDeadLetterQueue();
    existing.push({ ...item, failedAt: Date.now() });
    await AsyncStorage.setItem(DEAD_LETTER_KEY, JSON.stringify(existing));
  } catch {}
}

export async function enqueue(item: Omit<QueueItem, "id" | "timestamp" | "retries">): Promise<void> {
  const queue = await getQueue();
  queue.push({
    ...item,
    id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
    timestamp: Date.now(),
    retries: 0,
  });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function removeFromQueue(id: string): Promise<void> {
  const queue = await getQueue();
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.filter((q) => q.id !== id)));
}

export async function incrementRetry(id: string): Promise<void> {
  const queue = await getQueue();
  const updated = queue.map((q) => q.id === id ? { ...q, retries: q.retries + 1 } : q);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
}

// Update cache entries after a successful write — keeps UI in sync without a full refresh
async function updateCacheAfterWrite(table: string, operation: "insert" | "update" | "delete", data: any): Promise<void> {
  // Update both the generic cache key and any farm-scoped cache key
  const keysToUpdate = [table];
  if (data?.farm_id) keysToUpdate.push(`${table}_${data.farm_id}`);

  for (const key of keysToUpdate) {
    const cached = await readCache<any>(key);
    if (cached === null) continue;
    let updated: any[] | undefined;
    if (operation === "insert") {
      updated = [...cached, data];
    } else if (operation === "update") {
      updated = cached.map((item) => item.id === data.id ? { ...item, ...data } : item);
    } else if (operation === "delete") {
      updated = cached.filter((item) => item.id !== data.id);
    }
    if (updated !== undefined) await writeCache(key, updated);
  }
}

export async function withCache<T>(
  table: string,
  fetchFn: () => Promise<T[]>
): Promise<T[]> {
  try {
    const data = await fetchFn();
    await writeCache(table, data);
    return data;
  } catch (err: any) {
    const isNetworkError =
      err?.message?.includes("fetch") ||
      err?.message?.includes("network") ||
      err?.message?.includes("Failed to fetch") ||
      err?.message?.includes("Network request failed");

    if (!isNetworkError) {
      throw err;
    }

    const cached = await readCache<T>(table);
    return cached ?? [];
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
  operation: "insert" | "update" | "delete",
  data: any,
  writeFn: () => Promise<T>
): Promise<T> {
  try {
    const result = await writeFn();
    // Optimistically update local cache so UI reflects changes immediately
    updateCacheAfterWrite(table, operation, data).catch(() => {});
    return result;
  } catch (err: any) {
    const isNetworkError =
      err?.message?.includes("fetch") ||
      err?.message?.includes("network") ||
      err?.message?.includes("Failed to fetch") ||
      err?.message?.includes("Network request failed");

    if (isNetworkError) {
      await enqueue({ table, operation, data });
    }
    throw err;
  }
}
