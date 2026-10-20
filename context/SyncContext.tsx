import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { supabase } from "@/lib/supabase";
import { getQueue, removeFromQueue, incrementRetry, addToDeadLetter, QueueItem } from "@/lib/offline-storage";
import { useAuth } from "@/context/AuthContext";

type SyncStatus = "idle" | "syncing" | "error";

type SyncContextValue = {
  pendingCount: number;
  status: SyncStatus;
  lastSynced: Date | null;
  forceSync: () => Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

async function syncItem(item: QueueItem): Promise<void> {
  if (item.operation === "insert") {
    const { error } = await supabase.from(item.table).insert(item.data);
    if (error) throw new Error(error.message);
  } else if (item.operation === "update") {
    const { error } = await supabase.from(item.table).update(item.data).eq("id", item.data.id);
    if (error) throw new Error(error.message);
  } else if (item.operation === "delete") {
    const { error } = await supabase.from(item.table).delete().eq("id", item.data.id);
    if (error) throw new Error(error.message);
  }
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const isSyncing = useRef(false);

  const refreshCount = useCallback(async () => {
    const queue = await getQueue();
    setPendingCount(queue.length);
  }, []);

  const forceSync = useCallback(async () => {
    if (!user) return;
    if (isSyncing.current) return;
    const queue = await getQueue();
    if (!queue.length) return;

    isSyncing.current = true;
    setStatus("syncing");

    // Group items by table so independent tables sync in parallel,
    // while preserving order within each table
    const grouped = queue.reduce<Record<string, QueueItem[]>>((acc, item) => {
      if (!acc[item.table]) acc[item.table] = [];
      acc[item.table].push(item);
      return acc;
    }, {});

    let hadError = false;
    const droppedTables: string[] = [];

    await Promise.allSettled(
      Object.entries(grouped).map(async ([, items]) => {
        for (const item of items) {
          // Move permanently failing items to dead letter queue and alert user
          if (item.retries >= 5) {
            await addToDeadLetter(item);
            await removeFromQueue(item.id);
            droppedTables.push(item.table);
            continue;
          }
          try {
            await syncItem(item);
            await removeFromQueue(item.id);
          } catch {
            await incrementRetry(item.id);
            hadError = true;
          }
        }
      })
    );

    // Alert user if any records were permanently dropped
    if (droppedTables.length > 0) {
      const unique = [...new Set(droppedTables)];
      Alert.alert(
        "Sync Warning",
        `${droppedTables.length} offline action(s) in ${unique.join(", ")} failed to sync after 5 attempts and were removed. Please re-enter the data when online.`,
        [{ text: "OK" }]
      );
    }

    const remaining = await getQueue();
    setPendingCount(remaining.length);
    setStatus(hadError ? "error" : "idle");
    if (!hadError) setLastSynced(new Date());
    isSyncing.current = false;
  }, [user]);

  useEffect(() => {
    refreshCount();
    const interval = setInterval(() => {
      refreshCount();
      forceSync();
    }, 30000);
    return () => clearInterval(interval);
  }, [refreshCount, forceSync]);

  return (
    <SyncContext.Provider value={{ pendingCount, status, lastSynced, forceSync }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be used within SyncProvider");
  return ctx;
}
