import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import {
  seedIfNeeded,
  getCosts,
  getInventory,
  getActivityLogs,
  getObservations,
  addCost,
  addInventoryItem,
  addActivityLog,
  addObservation,
  deleteCost,
  deleteInventoryItem,
  deleteActivityLog,
  deleteObservation,
  updateInventoryUsage,
  CostEntry,
  InventoryItem,
  ActivityLog,
  FieldObservation,
} from "@/lib/storage";
import { PLANNED_SCHEDULE, PlannedActivity } from "@/constants/farmData";

interface FarmContextValue {
  costs: CostEntry[];
  inventory: InventoryItem[];
  activityLogs: ActivityLog[];
  observations: FieldObservation[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  addCostEntry: (cost: Omit<CostEntry, "id" | "created_at">) => Promise<void>;
  removeCost: (id: string) => Promise<void>;
  addInventory: (item: Omit<InventoryItem, "id" | "created_at">) => Promise<void>;
  removeInventory: (id: string) => Promise<void>;
  logActivity: (log: Omit<ActivityLog, "id" | "created_at">, inventoryUpdates: { name: string; qty: number }[]) => Promise<void>;
  removeActivityLog: (id: string) => Promise<void>;
  addFieldObservation: (obs: Omit<FieldObservation, "id" | "created_at">) => Promise<void>;
  removeObservation: (id: string) => Promise<void>;
  totalSpent: number;
  getCompletedActivityIds: () => string[];
  getNextActivity: (sectionId: string) => PlannedActivity | null;
}

const FarmContext = createContext<FarmContextValue | null>(null);

export function FarmProvider({ children }: { children: ReactNode }) {
  const [costs, setCosts] = useState<CostEntry[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [observations, setObservations] = useState<FieldObservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      await seedIfNeeded();
      const [c, inv, logs, obs] = await Promise.all([
        getCosts(),
        getInventory(),
        getActivityLogs(),
        getObservations(),
      ]);
      setCosts(c);
      setInventory(inv);
      setActivityLogs(logs);
      setObservations(obs);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addCostEntry = useCallback(async (cost: Omit<CostEntry, "id" | "created_at">) => {
    const newCost = await addCost(cost);
    setCosts((prev) => [...prev, newCost]);
  }, []);

  const removeCost = useCallback(async (id: string) => {
    await deleteCost(id);
    setCosts((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const addInventory = useCallback(async (item: Omit<InventoryItem, "id" | "created_at">) => {
    const newItem = await addInventoryItem(item);
    setInventory((prev) => [...prev, newItem]);
  }, []);

  const removeInventory = useCallback(async (id: string) => {
    await deleteInventoryItem(id);
    setInventory((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const logActivity = useCallback(
    async (log: Omit<ActivityLog, "id" | "created_at">, inventoryUpdates: { name: string; qty: number }[]) => {
      const newLog = await addActivityLog(log);
      setActivityLogs((prev) => [...prev, newLog]);
      for (const update of inventoryUpdates) {
        await updateInventoryUsage(update.name, update.qty);
      }
      const inv = await getInventory();
      setInventory(inv);
    },
    []
  );

  const removeActivityLog = useCallback(async (id: string) => {
    await deleteActivityLog(id);
    setActivityLogs((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const addFieldObservation = useCallback(async (obs: Omit<FieldObservation, "id" | "created_at">) => {
    const newObs = await addObservation(obs);
    setObservations((prev) => [...prev, newObs]);
  }, []);

  const removeObservation = useCallback(async (id: string) => {
    await deleteObservation(id);
    setObservations((prev) => prev.filter((o) => o.id !== id));
  }, []);

  const totalSpent = useMemo(() => costs.reduce((sum, c) => sum + c.amount_kes, 0), [costs]);

  const getCompletedActivityIds = useCallback((): string[] => {
    const ids = new Set<string>();
    activityLogs.forEach((log) => {
      if (log.schedule_activity_id) ids.add(log.schedule_activity_id);
    });
    return Array.from(ids);
  }, [activityLogs]);

  const getNextActivity = useCallback(
    (sectionId: string): PlannedActivity | null => {
      const completedIds = getCompletedActivityIds();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isA = sectionId === "section-a";

      for (const activity of PLANNED_SCHEDULE) {
        if (completedIds.includes(activity.id)) continue;
        const dateStr = isA ? activity.plannedDateA : activity.plannedDateB;
        return activity;
      }
      return null;
    },
    [getCompletedActivityIds]
  );

  const value = useMemo<FarmContextValue>(
    () => ({
      costs,
      inventory,
      activityLogs,
      observations,
      isLoading,
      refresh,
      addCostEntry,
      removeCost,
      addInventory,
      removeInventory,
      logActivity,
      removeActivityLog,
      addFieldObservation,
      removeObservation,
      totalSpent,
      getCompletedActivityIds,
      getNextActivity,
    }),
    [
      costs,
      inventory,
      activityLogs,
      observations,
      isLoading,
      refresh,
      addCostEntry,
      removeCost,
      addInventory,
      removeInventory,
      logActivity,
      removeActivityLog,
      addFieldObservation,
      removeObservation,
      totalSpent,
      getCompletedActivityIds,
      getNextActivity,
    ]
  );

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
}

export function useFarm() {
  const ctx = useContext(FarmContext);
  if (!ctx) throw new Error("useFarm must be used within FarmProvider");
  return ctx;
}
