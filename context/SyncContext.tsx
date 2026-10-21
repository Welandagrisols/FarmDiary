import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Alert, AppState } from "react-native";
import { supabase } from "@/lib/supabase";
import {
  getQueue,
  removeFromQueue,
  incrementRetry,
  addToDeadLetter,
  restoreDeadLetterItems,
  QueueItem,
} from "@/lib/offline-storage";
import { processOfflineQueue } from "@/lib/offline-sync";
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
    const { error } = await supabase
      .from(item.table)
      .upsert(item.data, { onConflict: "id", ignoreDuplicates: true });
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
    try {
      const queue = await getQueue();
      setPendingCount(queue.length);
    } catch (error) {
      console.warn("[sync] Could not read the offline queue:", error);
      setStatus("error");
    }
  }, []);

  const forceSync = useCallback(async () => {
    if (!user) return;
    if (isSyncing.current) return;
    isSyncing.current = true;
    setStatus("syncing");
    try {
      const queue = await getQueue();
      setPendingCount(queue.length);
      if (!queue.length) {
        setStatus("idle");
        return;
      }

      const result = await processOfflineQueue(queue, {
        syncItem,
        removeFromQueue,
        incrementRetry,
        addToDeadLetter,
      });
      const remaining = await getQueue();
      setPendingCount(remaining.length);
      setStatus(result.failed ? "error" : "idle");
      if (!result.failed && result.synced > 0) setLastSynced(new Date());

      if (result.droppedTables.length > 0) {
        const unique = [...new Set(result.droppedTables)];
        Alert.alert(
          "Sync Needs Attention",
          `${result.droppedTables.length} offline action(s) in ${unique.join(", ")} could not sync after 5 server rejections. They remain saved locally.`,
          [
            { text: "Later", style: "cancel" },
            {
              text: "Retry saved actions",
              onPress: async () => {
                try {
                  await restoreDeadLetterItems();
                  await refreshCount();
                  await forceSync();
                } catch (error) {
                  console.warn("[sync] Could not restore saved actions:", error);
                  Alert.alert("Retry failed", "The saved offline actions are still on this device.");
                }
              },
            },
          ]
        );
      }
    } catch (error) {
      console.warn("[sync] Queue processing failed:", error);
      setStatus("error");
      try {
        setPendingCount((await getQueue()).length);
      } catch (queueError) {
        console.warn("[sync] Could not count saved offline actions:", queueError);
      }
    } finally {
      isSyncing.current = false;
    }
  }, [user]);

  useEffect(() => {
    void refreshCount();
    void forceSync();
    const interval = setInterval(() => {
      void refreshCount();
      void forceSync();
    }, 15000);
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refreshCount();
        void forceSync();
      }
    });
    const handleOnline = () => {
      void refreshCount();
      void forceSync();
    };
    if (typeof window !== "undefined") window.addEventListener("online", handleOnline);
    return () => {
      clearInterval(interval);
      appStateSubscription.remove();
      if (typeof window !== "undefined") window.removeEventListener("online", handleOnline);
    };
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
