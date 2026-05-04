import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ActivityLog,
  addActivityLog,
  addCost,
  addFieldObservation,
  addFarmRecord,
  addHarvestRecord,
  addInventoryItem,
  addSeason,
  closeSeason,
  deleteActivityLog,
  deleteCost,
  deleteHarvestRecord,
  deleteInventoryItem,
  deleteObservation,
  getActiveFarmRecord,
  getActiveSeason,
  getActivityLogs,
  getCosts,
  getFarms,
  getHarvestRecords,
  getInventory,
  getObservations,
  getSeasons,
  HarvestRecord,
  InventoryItem,
  ObservationRecord,
  reopenSeason,
  SeasonRecord,
  setActiveFarmId,
  setActiveSeasonId,
  updateFarmRecord,
  updateSeason,
} from "@/lib/storage";
import { generatePlannedSchedule, getCurrentStage, CROP_TEMPLATES } from "@/constants/farmData";

type FarmContextValue = {
  costs: Awaited<ReturnType<typeof getCosts>>;
  inventory: InventoryItem[];
  activityLogs: ActivityLog[];
  observations: ObservationRecord[];
  harvestRecords: HarvestRecord[];
  seasons: SeasonRecord[];
  activeSeason: SeasonRecord | null;
  currentSchedule: ReturnType<typeof generatePlannedSchedule>;
  seasonId: string;
  farms: Awaited<ReturnType<typeof getFarms>>;
  activeFarm: Awaited<ReturnType<typeof getActiveFarmRecord>>;
  farmId: string;
  isLoading: boolean;
  refresh: () => Promise<void>;
  addCostEntry: typeof addCost;
  removeCost: typeof deleteCost;
  addInventory: typeof addInventoryItem;
  removeInventory: typeof deleteInventoryItem;
  logActivity: typeof addActivityLog;
  editActivityLog: typeof updateSeason;
  removeActivityLog: typeof deleteActivityLog;
  addFieldObservation: typeof addFieldObservation;
  removeObservation: typeof deleteObservation;
  totalSpent: number;
  totalRevenue: number;
  getCompletedActivityIds: () => string[];
  getNextActivity: (sectionId: string) => any;
  quickCompleteActivity: any;
  getLastSprayDate: (sectionId: string) => string | null;
  addHarvestEntry: typeof addHarvestRecord;
  removeHarvestRecord: typeof deleteHarvestRecord;
  createSeason: typeof addSeason;
  switchSeason: (targetSeasonId: string) => Promise<void>;
  closeActiveSeason: () => Promise<void>;
  reopenActiveSeason: () => Promise<void>;
  updateActiveSeason: (updates: Partial<SeasonRecord>) => Promise<void>;
  createFarm: typeof addFarmRecord;
  switchFarm: (targetFarmId: string) => Promise<void>;
  updateActiveFarm: (updates: Partial<any>) => Promise<void>;
};

const FarmContext = createContext<FarmContextValue | null>(null);

export function FarmProvider({ children }: { children: React.ReactNode }) {
  const [costs, setCosts] = useState<Awaited<ReturnType<typeof getCosts>>>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [observations, setObservations] = useState<ObservationRecord[]>([]);
  const [harvestRecords, setHarvestRecords] = useState<HarvestRecord[]>([]);
  const [seasons, setSeasons] = useState<SeasonRecord[]>([]);
  const [activeSeason, setActiveSeason] = useState<SeasonRecord | null>(null);
  const [farms, setFarms] = useState<Awaited<ReturnType<typeof getFarms>>>([]);
  const [activeFarm, setActiveFarm] = useState<Awaited<ReturnType<typeof getActiveFarmRecord>>>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [allFarms, farm, allSeasons, active, c, inv, logs, obs, harvest] = await Promise.all([
      getFarms(),
      getActiveFarmRecord(),
      getSeasons(),
      getActiveSeason(),
      getCosts(),
      getInventory(),
      getActivityLogs(),
      getObservations(),
      getHarvestRecords(),
    ]);
    const farmId = farm?.id || allFarms[0]?.id || "";
    setFarms(allFarms);
    setActiveFarm(farm);
    setSeasons(allSeasons.filter((item) => item.farm_id === farmId));
    setActiveSeason(active && active.farm_id === farmId ? active : allSeasons.find((item) => item.farm_id === farmId && item.status !== "closed") || null);
    setCosts(c.filter((item) => item.farm_id === farmId));
    setInventory(inv.filter((item) => item.farm_id === farmId));
    setActivityLogs(logs.filter((item) => item.farm_id === farmId));
    setObservations(obs.filter((item) => item.farm_id === farmId));
    setHarvestRecords(harvest.filter((item) => item.farm_id === farmId));
    setIsLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const currentSchedule = useMemo(() => {
    const template = CROP_TEMPLATES.find((t) => t.id === activeSeason?.template_id) ?? CROP_TEMPLATES[0];
    const plantingDate = activeSeason?.section_a?.planting_date ?? new Date().toISOString().split("T")[0];
    if (!template) return [];
    return generatePlannedSchedule(template, plantingDate);
  }, [activeSeason]);
  const seasonId = activeSeason?.id || "";
  const farmId = activeFarm?.id || "";
  const totalSpent = useMemo(() => costs.reduce((sum, cost) => sum + cost.amount_kes, 0), [costs]);
  const totalRevenue = useMemo(() => harvestRecords.reduce((sum, record) => sum + record.total_revenue_kes, 0), [harvestRecords]);

  const getCompletedActivityIds = useCallback(() => {
    const ids = new Set<string>();
    activityLogs.filter((l) => l.season_id === seasonId).forEach((log) => { if (log.schedule_activity_id) ids.add(log.schedule_activity_id); });
    const hasPrePlantingCosts = costs.some((c) => c.season_id === seasonId && c.is_pre_planting);
    if (hasPrePlantingCosts && activeSeason) {
      const plantingDate = activeSeason.section_a.planting_date;
      currentSchedule.forEach((activity) => {
        if (activity.plannedDateA < plantingDate) ids.add(activity.id);
      });
    }
    return Array.from(ids);
  }, [activityLogs, seasonId, costs, activeSeason, currentSchedule]);

  const getNextActivity = useCallback((_sectionId: string) => {
    const completedIds = getCompletedActivityIds();
    return currentSchedule.find((activity) => !completedIds.includes(activity.id)) || null;
  }, [currentSchedule, getCompletedActivityIds]);

  const quickCompleteActivity = useCallback(async (activity: any, sectionId: string | null) => {
    const today = new Date().toISOString().split("T")[0];
    const isB = sectionId === "section-b";
    const newLog = await addActivityLog({ farm_id: farmId, season_id: seasonId, section_id: sectionId, schedule_activity_id: activity.id, activity_name: activity.name, planned_date: isB ? activity.plannedDateB : activity.plannedDateA, actual_date: today, products_used: [], is_deviation: false, deviation_reason: null, num_workers: 0, labor_cost_kes: 0, total_cost_kes: 0, weather_conditions: null, is_historical: false, notes: "Quick-completed (no costs logged)" });
    setActivityLogs((prev) => [...prev, newLog]);
  }, [farmId, seasonId]);

  const addHarvestEntry = useCallback(async (record: Omit<HarvestRecord, "id" | "created_at">) => { const newRecord = await addHarvestRecord(record); setHarvestRecords((prev) => [...prev, newRecord]); }, []);
  const removeHarvestRecord = useCallback(async (id: string) => { await deleteHarvestRecord(id); setHarvestRecords((prev) => prev.filter((r) => r.id !== id)); }, []);
  const createSeason = useCallback(async (season: Omit<SeasonRecord, "id" | "created_at">) => { const newSeason = await addSeason(season); setSeasons((prev) => [...prev, newSeason]); await setActiveSeasonId(newSeason.id); setActiveSeason(newSeason); return newSeason; }, []);
  const switchSeason = useCallback(async (targetSeasonId: string) => { await setActiveSeasonId(targetSeasonId); await refresh(); }, [refresh]);
  const closeActiveSeason = useCallback(async () => { if (!activeSeason) return; const updated = await closeSeason(activeSeason.id); setSeasons((prev) => prev.map((s) => s.id === updated.id ? updated : s)); setActiveSeason(updated); }, [activeSeason]);
  const reopenActiveSeason = useCallback(async () => { if (!activeSeason) return; const updated = await reopenSeason(activeSeason.id); setSeasons((prev) => prev.map((s) => s.id === updated.id ? updated : s)); setActiveSeason(updated); }, [activeSeason]);
  const updateActiveSeason = useCallback(async (updates: Partial<SeasonRecord>) => { if (!activeSeason) return; const updated = await updateSeason(activeSeason.id, updates); setSeasons((prev) => prev.map((s) => s.id === updated.id ? updated : s)); setActiveSeason(updated); }, [activeSeason]);
  const createFarm = useCallback(async (farm: Omit<any, "id" | "created_at">) => { const newFarm = await addFarmRecord(farm); setFarms((prev) => [...prev, newFarm]); return newFarm; }, []);
  const switchFarm = useCallback(async (targetFarmId: string) => { await setActiveFarmId(targetFarmId); await refresh(); }, [refresh]);
  const updateActiveFarm = useCallback(async (updates: Partial<any>) => { if (!activeFarm) return; const updated = await updateFarmRecord(activeFarm.id, updates); setFarms((prev) => prev.map((f) => f.id === updated.id ? updated : f)); setActiveFarm(updated); }, [activeFarm]);

  const value = useMemo(() => ({ costs, inventory, activityLogs, observations, harvestRecords, seasons, activeSeason, currentSchedule, seasonId, farms, activeFarm, farmId, isLoading, refresh, addCostEntry: addCost, removeCost: deleteCost, addInventory: addInventoryItem, removeInventory: deleteInventoryItem, logActivity: addActivityLog, editActivityLog: updateSeason, removeActivityLog: deleteActivityLog, addFieldObservation, removeObservation: deleteObservation, totalSpent, totalRevenue, getCompletedActivityIds, getNextActivity, quickCompleteActivity, getLastSprayDate: () => null, addHarvestEntry, removeHarvestRecord, createSeason, switchSeason, closeActiveSeason, reopenActiveSeason, updateActiveSeason, createFarm, switchFarm, updateActiveFarm }), [costs, inventory, activityLogs, observations, harvestRecords, seasons, activeSeason, currentSchedule, seasonId, farms, activeFarm, farmId, isLoading, refresh, totalSpent, totalRevenue, getCompletedActivityIds, getNextActivity, quickCompleteActivity, addHarvestEntry, removeHarvestRecord, createSeason, switchSeason, closeActiveSeason, reopenActiveSeason, updateActiveSeason, createFarm, switchFarm, updateActiveFarm]);

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
}

export function useFarm() {
  const ctx = useContext(FarmContext);
  if (!ctx) throw new Error("useFarm must be used within FarmProvider");
  return ctx;
}
