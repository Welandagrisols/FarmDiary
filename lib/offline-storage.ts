import AsyncStorage from "@react-native-async-storage/async-storage";

export interface QueueItem {
  id: string;
  table: string;
  operation: "insert" | "update" | "delete";
  data: any;
  timestamp: number;
  retries: number;
}

const QUEUE_KEY = "offline_sync_queue";
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

export async function withCache<T>(
  table: string,
  fetchFn: () => Promise<T[]>
): Promise<T[]> {
  try {
    const data = await fetchFn();
    await writeCache(table, data);
    return data;
  } catch {
    const cached = await readCache<T>(table);
    return cached ?? [];
  }
}

export async function withWrite<T>(
  table: string,
  operation: "insert" | "update" | "delete",
  data: any,
  writeFn: () => Promise<T>
): Promise<T> {
  try {
    return await writeFn();
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
