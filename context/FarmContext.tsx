import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import {
  seedIfNeeded,
  getCosts,
  getInventory,
  getActivityLogs,
  getObservations,
  getHarvestRecords,
  addCost,
  addInventoryItem,
  addActivityLog,
  updateActivityLog,
  addObservation,
  addHarvestRecord,
  deleteCost,
  deleteInventoryItem,
  deleteActivityLog,
  deleteObservation,
  deleteHarvestRecord,
  updateInventoryUsage,
  CostEntry,
  InventoryItem,
  ActivityLog,
  FieldObservation,
  HarvestRecord,
} from "@/lib/storage";
import { PLANNED_SCHEDULE, PlannedActivity, FARM_SEED, SEASON_SEED } from "@/constants/farmData";

interface FarmContextValue {
  costs: CostEntry[];
  inventory: InventoryItem[];
  activityLogs: ActivityLog[];
  observations: FieldObservation[];
  harvestRecords: HarvestRecord[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  addCostEntry: (cost: Omit<CostEntry, "id" | "created_at">) => Promise<void>;
  removeCost: (id: string) => Promise<void>;
  addInventory: (item: Omit<InventoryItem, "id" | "created_at">) => Promise<void>;
  removeInventory: (id: string) => Promise<void>;
  logActivity: (log: Omit<ActivityLog, "id" | "created_at">, inventoryUpdates: { name: string; qty: number }[]) => Promise<void>;
  editActivityLog: (id: string, updates: Partial<Omit<ActivityLog, "id" | "created_at">>) => Promise<void>;
  removeActivityLog: (id: string) => Promise<void>;
  addFieldObservation: (obs: Omit<FieldObservation, "id" | "created_at">) => Promise<void>;
  removeObservation: (id: string) => Promise<void>;
  totalSpent: number;
  getCompletedActivityIds: () => string[];
  getNextActivity: (sectionId: string) => PlannedActivity | null;
  quickCompleteActivity: (activity: PlannedActivity, sectionId: string | null) => Promise<void>;
  getLastSprayDate: (sectionId: string) => string | null;
  addHarvestEntry: (record: Omit<HarvestRecord, "id" | "created_at">) => Promise<void>;
  removeHarvestRecord: (id: string) => Promise<void>;
  totalRevenue: number;
}

const FarmContext = createContext<FarmContextValue | null>(null);

export function FarmProvider({ children }: { children: ReactNode }) {
  const [costs, setCosts] = useState<CostEntry[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [observations, setObservations] = useState<FieldObservation[]>([]);
  const [harvestRecords, setHarvestRecords] = useState<HarvestRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      await seedIfNeeded();
      const [c, inv, logs, obs, harvest] = await Promise.all([
        getCosts(),
        getInventory(),
        getActivityLogs(),
        getObservations(),
        getHarvestRecords(),
      ]);
      setCosts(c);
      setInventory(inv);
      setActivityLogs(logs);
      setObservations(obs);
      setHarvestRecords(harvest);
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

  const editActivityLog = useCallback(async (id: string, updates: Partial<Omit<ActivityLog, "id" | "created_at">>) => {
    const updated = await updateActivityLog(id, updates);
    setActivityLogs((prev) => prev.map((l) => (l.id === id ? updated : l)));
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
  const totalRevenue = useMemo(() => harvestRecords.reduce((sum, r) => sum + r.total_revenue_kes, 0), [harvestRecords]);

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
      const isA = sectionId === "section-a";
      for (const activity of PLANNED_SCHEDULE) {
        if (completedIds.includes(activity.id)) continue;
        return activity;
      }
      return null;
    },
    [getCompletedActivityIds]
  );

  const quickCompleteActivity = useCallback(
    async (activity: PlannedActivity, sectionId: string | null) => {
      const today = new Date().toISOString().split("T")[0];
      const isA = sectionId === "section-b" ? false : true;
      const newLog = await addActivityLog({
        farm_id: FARM_SEED.id,
        season_id: SEASON_SEED.id,
        section_id: sectionId,
        schedule_activity_id: activity.id,
        activity_name: activity.name,
        planned_date: isA ? activity.plannedDateA : activity.plannedDateB,
        actual_date: today,
        products_used: [],
        is_deviation: false,
        deviation_reason: null,
        num_workers: 0,
        labor_cost_kes: 0,
        total_cost_kes: 0,
        weather_conditions: null,
        is_historical: false,
        notes: "Quick-completed (no costs logged)",
      });
      setActivityLogs((prev) => [...prev, newLog]);
    },
    []
  );

  const addHarvestEntry = useCallback(async (record: Omit<HarvestRecord, "id" | "created_at">) => {
    const newRecord = await addHarvestRecord(record);
    setHarvestRecords((prev) => [...prev, newRecord]);
  }, []);

  const removeHarvestRecord = useCallback(async (id: string) => {
    await deleteHarvestRecord(id);
    setHarvestRecords((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const getLastSprayDate = useCallback(
    (sectionId: string): string | null => {
      const sprayLogs = activityLogs
        .filter((l) => {
          const isForSection = l.section_id === sectionId || l.section_id === null;
          const isSpray = l.activity_name.toLowerCase().includes("spray") ||
            l.activity_name.toLowerCase().includes("fungicide") ||
            l.activity_name.toLowerCase().includes("blight");
          return isForSection && isSpray;
        })
        .sort((a, b) => new Date(b.actual_date).getTime() - new Date(a.actual_date).getTime());
      return sprayLogs.length > 0 ? sprayLogs[0].actual_date : null;
    },
    [activityLogs]
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
      editActivityLog,
      removeActivityLog,
      addFieldObservation,
      removeObservation,
      totalSpent,
      getCompletedActivityIds,
      getNextActivity,
      quickCompleteActivity,
      getLastSprayDate,
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
      editActivityLog,
      removeActivityLog,
      addFieldObservation,
      removeObservation,
      totalSpent,
      getCompletedActivityIds,
      getNextActivity,
      quickCompleteActivity,
      getLastSprayDate,
    ]
  );

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
}

export function useFarm() {
  const ctx = useContext(FarmContext);
  if (!ctx) throw new Error("useFarm must be used within FarmProvider");
  return ctx;
}
