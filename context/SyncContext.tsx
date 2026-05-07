import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getQueue, removeFromQueue, incrementRetry } from "@/lib/offline-storage";

type SyncStatus = "idle" | "syncing" | "error";

type SyncContextValue = {
  pendingCount: number;
  status: SyncStatus;
  lastSynced: Date | null;
  forceSync: () => Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [pendingCount, setPendingCount] = useState(0);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const isSyncing = useRef(false);

  const refreshCount = useCallback(async () => {
    const queue = await getQueue();
    setPendingCount(queue.length);
  }, []);

  const forceSync = useCallback(async () => {
    if (isSyncing.current) return;
    const queue = await getQueue();
    if (!queue.length) return;

    isSyncing.current = true;
    setStatus("syncing");

    let hadError = false;
    for (const item of queue) {
      if (item.retries >= 5) {
        await removeFromQueue(item.id);
        continue;
      }
      try {
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
        await removeFromQueue(item.id);
      } catch {
        await incrementRetry(item.id);
        hadError = true;
      }
    }

    const remaining = await getQueue();
    setPendingCount(remaining.length);
    setStatus(hadError ? "error" : "idle");
    if (!hadError) setLastSynced(new Date());
    isSyncing.current = false;
  }, []);

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
