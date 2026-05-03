import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import {
  seedIfNeeded,
  seedSeasonIfNeeded,
  getCosts,
  getInventory,
  getActivityLogs,
  getObservations,
  getHarvestRecords,
  getSeasons,
  getActiveSeason,
  addSeason,
  updateSeason,
  setActiveSeasonId,
  closeSeason,
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
  SeasonRecord,
} from "@/lib/storage";
import {
  PLANNED_SCHEDULE,
  PlannedActivity,
  FARM_SEED,
  SEASON_SEED,
  CROP_TEMPLATES,
  generatePlannedSchedule,
} from "@/constants/farmData";

interface FarmContextValue {
  costs: CostEntry[];
  inventory: InventoryItem[];
  activityLogs: ActivityLog[];
  observations: FieldObservation[];
  harvestRecords: HarvestRecord[];
  seasons: SeasonRecord[];
  activeSeason: SeasonRecord | null;
  currentSchedule: PlannedActivity[];
  seasonId: string;
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
  createSeason: (season: Omit<SeasonRecord, "id" | "created_at">) => Promise<SeasonRecord>;
  switchSeason: (seasonId: string) => Promise<void>;
  closeActiveSeason: () => Promise<void>;
  updateActiveSeason: (updates: Partial<SeasonRecord>) => Promise<void>;
}

const FarmContext = createContext<FarmContextValue | null>(null);

function buildScheduleFromSeason(season: SeasonRecord): PlannedActivity[] {
  const template = CROP_TEMPLATES.find((t) => t.id === season.template_id) || CROP_TEMPLATES[0];
  return generatePlannedSchedule(template, season.section_a.planting_date);
}

export function FarmProvider({ children }: { children: ReactNode }) {
  const [costs, setCosts] = useState<CostEntry[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [observations, setObservations] = useState<FieldObservation[]>([]);
  const [harvestRecords, setHarvestRecords] = useState<HarvestRecord[]>([]);
  const [seasons, setSeasons] = useState<SeasonRecord[]>([]);
  const [activeSeason, setActiveSeason] = useState<SeasonRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const seasonId = activeSeason?.id || SEASON_SEED.id;

  const currentSchedule = useMemo<PlannedActivity[]>(() => {
    if (activeSeason) return buildScheduleFromSeason(activeSeason);
    return PLANNED_SCHEDULE;
  }, [activeSeason]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      await seedIfNeeded();
      await seedSeasonIfNeeded();
      const [c, inv, logs, obs, harvest, allSeasons, active] = await Promise.all([
        getCosts(),
        getInventory(),
        getActivityLogs(),
        getObservations(),
        getHarvestRecords(),
        getSeasons(),
        getActiveSeason(),
      ]);
      setCosts(c);
      setInventory(inv);
      setActivityLogs(logs);
      setObservations(obs);
      setHarvestRecords(harvest);
      setSeasons(allSeasons);
      setActiveSeason(active);
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

  const totalSpent = useMemo(() => {
    return costs
      .filter((c) => c.season_id === seasonId)
      .reduce((sum, c) => sum + c.amount_kes, 0);
  }, [costs, seasonId]);

  const totalRevenue = useMemo(() => {
    return harvestRecords
      .filter((r) => r.season_id === seasonId)
      .reduce((sum, r) => sum + r.total_revenue_kes, 0);
  }, [harvestRecords, seasonId]);

  const getCompletedActivityIds = useCallback((): string[] => {
    const ids = new Set<string>();
    const seasonLogs = activityLogs.filter((l) => l.season_id === seasonId);
    seasonLogs.forEach((log) => {
      if (log.schedule_activity_id) ids.add(log.schedule_activity_id);
    });
    return Array.from(ids);
  }, [activityLogs, seasonId]);

  const getNextActivity = useCallback(
    (sectionId: string): PlannedActivity | null => {
      const completedIds = getCompletedActivityIds();
      for (const activity of currentSchedule) {
        if (completedIds.includes(activity.id)) continue;
        return activity;
      }
      return null;
    },
    [getCompletedActivityIds, currentSchedule]
  );

  const quickCompleteActivity = useCallback(
    async (activity: PlannedActivity, sectionId: string | null) => {
      const today = new Date().toISOString().split("T")[0];
      const isB = sectionId === "section-b";
      const newLog = await addActivityLog({
        farm_id: FARM_SEED.id,
        season_id: seasonId,
        section_id: sectionId,
        schedule_activity_id: activity.id,
        activity_name: activity.name,
        planned_date: isB ? activity.plannedDateB : activity.plannedDateA,
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
    [seasonId]
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
      const seasonLogs = activityLogs.filter((l) => l.season_id === seasonId);
      const sprayLogs = seasonLogs
        .filter((l) => {
          const isForSection = l.section_id === sectionId || l.section_id === null;
          const isSpray =
            l.activity_name.toLowerCase().includes("spray") ||
            l.activity_name.toLowerCase().includes("fungicide") ||
            l.activity_name.toLowerCase().includes("blight");
          return isForSection && isSpray;
        })
        .sort((a, b) => new Date(b.actual_date).getTime() - new Date(a.actual_date).getTime());
      return sprayLogs.length > 0 ? sprayLogs[0].actual_date : null;
    },
    [activityLogs, seasonId]
  );

  const createSeason = useCallback(async (season: Omit<SeasonRecord, "id" | "created_at">) => {
    const newSeason = await addSeason(season);
    setSeasons((prev) => [...prev, newSeason]);
    await setActiveSeasonId(newSeason.id);
    setActiveSeason(newSeason);
    return newSeason;
  }, []);

  const switchSeason = useCallback(async (seasonId: string) => {
    await setActiveSeasonId(seasonId);
    const allSeasons = await getSeasons();
    const target = allSeasons.find((s) => s.id === seasonId) || null;
    setActiveSeason(target);
    const [c, logs, harvest] = await Promise.all([getCosts(), getActivityLogs(), getHarvestRecords()]);
    setCosts(c);
    setActivityLogs(logs);
    setHarvestRecords(harvest);
  }, []);

  const closeActiveSeason = useCallback(async () => {
    if (!activeSeason) return;
    const updated = await closeSeason(activeSeason.id);
    setSeasons((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setActiveSeason(updated);
  }, [activeSeason]);

  const updateActiveSeason = useCallback(async (updates: Partial<SeasonRecord>) => {
    if (!activeSeason) return;
    const updated = await updateSeason(activeSeason.id, updates);
    setSeasons((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setActiveSeason(updated);
  }, [activeSeason]);

  const value = useMemo<FarmContextValue>(
    () => ({
      costs,
      inventory,
      activityLogs,
      observations,
      harvestRecords,
      seasons,
      activeSeason,
      currentSchedule,
      seasonId,
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
      totalRevenue,
      getCompletedActivityIds,
      getNextActivity,
      quickCompleteActivity,
      getLastSprayDate,
      addHarvestEntry,
      removeHarvestRecord,
      createSeason,
      switchSeason,
      closeActiveSeason,
      updateActiveSeason,
    }),
    [
      costs,
      inventory,
      activityLogs,
      observations,
      harvestRecords,
      seasons,
      activeSeason,
      currentSchedule,
      seasonId,
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
      totalRevenue,
      getCompletedActivityIds,
      getNextActivity,
      quickCompleteActivity,
      getLastSprayDate,
      addHarvestEntry,
      removeHarvestRecord,
      createSeason,
      switchSeason,
      closeActiveSeason,
      updateActiveSeason,
    ]
  );

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
}

export function useFarm() {
  const context = useContext(FarmContext);
  if (!context) {
    throw new Error("useFarm must be used within FarmProvider");
  }
  return context;
}
