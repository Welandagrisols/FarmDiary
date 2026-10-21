import { isNetworkError } from "./network-errors";
import type { QueueItem } from "./offline-storage";

export type PendingSyncItem = QueueItem;

export interface OfflineSyncAdapter {
  syncItem: (item: PendingSyncItem) => Promise<void>;
  removeFromQueue: (id: string) => Promise<void>;
  incrementRetry: (id: string) => Promise<void>;
  addToDeadLetter: (item: PendingSyncItem) => Promise<void>;
}

export interface OfflineSyncResult {
  synced: number;
  failed: boolean;
  droppedTables: string[];
}

export async function processOfflineQueue(
  queue: PendingSyncItem[],
  adapter: OfflineSyncAdapter,
  maxRetries = 5,
): Promise<OfflineSyncResult> {
  let synced = 0;
  const droppedTables: string[] = [];

  // Preserve global FIFO order: later records can depend on an earlier farm,
  // season, or inventory record being persisted first.
  for (const item of queue) {
    if (item.retries >= maxRetries) {
      try {
        await adapter.addToDeadLetter(item);
        await adapter.removeFromQueue(item.id);
        droppedTables.push(item.table);
      } catch {
        return { synced, failed: true, droppedTables };
      }
      continue;
    }

    try {
      await adapter.syncItem(item);
      await adapter.removeFromQueue(item.id);
      synced += 1;
    } catch (error) {
      if (isNetworkError(error)) {
        return { synced, failed: true, droppedTables };
      }
      try {
        await adapter.incrementRetry(item.id);
      } catch {
        // The item remains queued; a later sync can retry it.
      }
      return { synced, failed: true, droppedTables };
    }
  }

  return { synced, failed: false, droppedTables };
}
