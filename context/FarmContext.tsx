import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  getSeasonBlocks,
  getSeasons,
  HarvestRecord,
  InventoryItem,
  ObservationRecord,
  PersonalExpense,
  reopenSeason,
  SeasonRecord,
  setActiveFarmId,
  setActiveSeasonId,
  updateActivityLog,
  updateFarmRecord,
  updateInventoryItem,
  updateSeason,
} from "@/lib/storage";
import {
  addPersonalExpense,
  deletePersonalExpense,
  getPersonalExpenses,
} from "@/lib/supabase-storage";
import { generatePlannedSchedule, getTemplate } from "@/constants/farmData";
import { useAuth } from "@/context/AuthContext";

const CACHE_KEY = "farm_offline_cache_v1";

type InventoryUse = { name: string; qty: number };

type FarmContextValue = {
  costs: Awaited<ReturnType<typeof getCosts>>;
  inventory: InventoryItem[];
  activityLogs: ActivityLog[];
  observations: ObservationRecord[];
  harvestRecords: HarvestRecord[];
  seasons: SeasonRecord[];
  activeSeason: SeasonRecord | null;
  currentSchedule: ReturnType<typeof generatePlannedSchedule>;
  plannedBudget: number;
  seasonId: string;
  farms: Awaited<ReturnType<typeof getFarms>>;
  activeFarm: Awaited<ReturnType<typeof getActiveFarmRecord>>;
  farmId: string;
  isLoading: boolean;
  isOffline: boolean;
  loadError: string | null;
  retryLoad: () => Promise<void>;
  refresh: () => Promise<void>;
  addCostEntry: typeof addCost;
  removeCost: typeof deleteCost;
  addInventory: typeof addInventoryItem;
  removeInventory: typeof deleteInventoryItem;
  logActivity: (entry: Parameters<typeof addActivityLog>[0], inventoryUpdates?: InventoryUse[]) => Promise<ActivityLog>;
  editActivityLog: (id: string, updates: Partial<ActivityLog>) => Promise<void>;
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
  personalExpenses: PersonalExpense[];
  addPersonalExpenseEntry: typeof addPersonalExpense;
  removePersonalExpense: (id: string) => Promise<void>;
  totalPersonalExpenses: number;
};

const FarmContext = createContext<FarmContextValue | null>(null);

export function FarmProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [costs, setCosts] = useState<Awaited<ReturnType<typeof getCosts>>>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [observations, setObservations] = useState<ObservationRecord[]>([]);
  const [harvestRecords, setHarvestRecords] = useState<HarvestRecord[]>([]);
  const [seasons, setSeasons] = useState<SeasonRecord[]>([]);
  const [personalExpenses, setPersonalExpenses] = useState<PersonalExpense[]>([]);
  const [activeSeason, setActiveSeason] = useState<SeasonRecord | null>(null);
  const [farms, setFarms] = useState<Awaited<ReturnType<typeof getFarms>>>([]);
  const [activeFarm, setActiveFarm] = useState<Awaited<ReturnType<typeof getActiveFarmRecord>>>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const applyData = useCallback((allFarms: any[], farm: any, allSeasons: SeasonRecord[], active: SeasonRecord | null, c: any[], inv: InventoryItem[], logs: ActivityLog[], obs: ObservationRecord[], harvest: HarvestRecord[], expenses: PersonalExpense[]) => {
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
    setPersonalExpenses(expenses.filter((item) => item.farm_id === farmId));
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [allFarms, farm, allSeasons, active, c, inv, logs, obs, harvest, expenses] = await Promise.all([
        getFarms(),
        getActiveFarmRecord(),
        getSeasons(),
        getActiveSeason(),
        getCosts(),
        getInventory(),
        getActivityLogs(),
        getObservations(),
        getHarvestRecords(),
        getPersonalExpenses(),
      ]);

      applyData(allFarms, farm, allSeasons, active, c, inv, logs, obs, harvest, expenses);
      setIsOffline(false);
      if (allFarms.length === 0) {
        setLoadError("No farm is assigned to this account. Contact your farm manager.");
      }

      try {
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ allFarms, farm, allSeasons, active, c, inv, logs, obs, harvest, expenses }));
      } catch { /* ignore cache write errors */ }

    } catch (err) {
      console.warn("[FarmContext] Supabase unavailable, loading offline cache:", err);
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        if (raw) {
          const { allFarms, farm, allSeasons, active, c, inv, logs, obs, harvest, expenses = [] } = JSON.parse(raw);
          applyData(allFarms, farm, allSeasons, active, c, inv, logs, obs, harvest, expenses);
          setIsOffline(true);
          setLoadError("Showing saved farm data offline. Reconnect and retry to sync.");
        } else {
          setLoadError("Unable to load farm data. Check your connection and try again.");
        }
      } catch (cacheErr) {
        console.error("[FarmContext] cache load failed:", cacheErr);
      }
    } finally {
      setIsLoading(false);
    }
  }, [applyData]);

  const clearFarmData = useCallback(() => {
    setCosts([]);
    setInventory([]);
    setActivityLogs([]);
    setObservations([]);
    setHarvestRecords([]);
    setPersonalExpenses([]);
    setSeasons([]);
    setActiveSeason(null);
    setFarms([]);
    setActiveFarm(null);
    setIsOffline(false);
    setLoadError(null);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      clearFarmData();
      setIsLoading(false);
      return;
    }
    void refresh();
  }, [authLoading, user?.id, refresh, clearFarmData]);

  const currentSchedule = useMemo(() => {
    if (!activeSeason) return [];
    const template = getTemplate(activeSeason.template_id);
    return generatePlannedSchedule(template, getSeasonBlocks(activeSeason));
  }, [activeSeason]);
  const plannedBudget = useMemo(
    () => currentSchedule.reduce((sum, activity) => sum + activity.estimatedTotalCost, 0),
    [currentSchedule],
  );
  const seasonId = activeSeason?.id || "";
  const farmId = activeFarm?.id || "";
  const totalSpent = useMemo(() => costs.reduce((sum, cost) => sum + cost.amount_kes, 0), [costs]);
  const totalRevenue = useMemo(() => harvestRecords.reduce((sum, record) => sum + record.total_revenue_kes, 0), [harvestRecords]);

  const getCompletedActivityIds = useCallback(() => {
    const ids = new Set<string>();
    activityLogs.filter((l) => l.season_id === seasonId).forEach((log) => {
      if (!log.schedule_activity_id) return;
      ids.add(log.schedule_activity_id);
      if (!log.schedule_activity_id.includes(":") && log.section_id) {
        ids.add(`${log.schedule_activity_id}:${log.section_id}`);
      }
    });
    return Array.from(ids);
  }, [activityLogs, seasonId]);

  const getNextActivity = useCallback((sectionId: string) => {
    const completedIds = getCompletedActivityIds();
    return currentSchedule.find((activity) =>
      activity.blockId === sectionId && !completedIds.includes(activity.id)
    ) || null;
  }, [currentSchedule, getCompletedActivityIds]);

  const quickCompleteActivity = useCallback(async (activity: any, sectionId: string | null) => {
    const today = new Date().toISOString().split("T")[0];
    const blockId = activity.blockId || sectionId;
    const newLog = await addActivityLog({ farm_id: farmId, season_id: seasonId, section_id: blockId, schedule_activity_id: activity.id, activity_name: activity.name, planned_date: activity.plannedDate || activity.plannedDateA, actual_date: today, products_used: [], is_deviation: false, deviation_reason: null, num_workers: 0, labor_cost_kes: 0, total_cost_kes: 0, weather_conditions: null, is_historical: false, notes: "Quick-completed (no costs logged)" });
    setActivityLogs((prev) => [...prev, newLog]);
  }, [farmId, seasonId]);

  const addCostEntry = useCallback(async (cost: Omit<Parameters<typeof addCost>[0], never>) => {
    const newRecord = await addCost(cost);
    setCosts((prev) => [...prev, newRecord]);
    return newRecord;
  }, []);
  const removeCost = useCallback(async (id: string) => {
    await deleteCost(id);
    setCosts((prev) => prev.filter((c) => c.id !== id));
  }, []);
  const addInventory = useCallback(async (item: Omit<Parameters<typeof addInventoryItem>[0], never>) => {
    const newRecord = await addInventoryItem(item);
    setInventory((prev) => [...prev, newRecord]);
    return newRecord;
  }, []);
  const removeInventory = useCallback(async (id: string) => {
    await deleteInventoryItem(id);
    setInventory((prev) => prev.filter((i) => i.id !== id));
  }, []);
  const logActivity = useCallback(async (
    entry: Parameters<typeof addActivityLog>[0],
    inventoryUpdates: InventoryUse[] = [],
  ) => {
    const newRecord = await addActivityLog(entry);
    setActivityLogs((prev) => [...prev, newRecord]);
    const totalsByProduct = new Map<string, number>();
    for (const use of inventoryUpdates) {
      const name = use.name.trim().toLocaleLowerCase();
      const quantity = Number(use.qty);
      if (!name || !Number.isFinite(quantity) || quantity <= 0) continue;
      totalsByProduct.set(name, (totalsByProduct.get(name) || 0) + quantity);
    }

    try {
      for (const [name, quantity] of totalsByProduct) {
        const item = inventory.find((candidate) =>
          candidate.farm_id === entry.farm_id &&
          candidate.season_id === entry.season_id &&
          candidate.product_name.trim().toLocaleLowerCase() === name
        );
        if (!item) continue;

        const updated = await updateInventoryItem(item.id, {
          quantity_used: item.quantity_used + quantity,
        });
        setInventory((prev) => prev.map((current) => current.id === updated.id ? updated : current));
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Inventory could not be updated.";
      throw new Error(`Activity was saved, but inventory usage could not be updated. ${detail}`);
    }

    return newRecord;
  }, [inventory]);
  const removeActivityLog = useCallback(async (id: string) => {
    await deleteActivityLog(id);
    setActivityLogs((prev) => prev.filter((l) => l.id !== id));
  }, []);
  const addObservation = useCallback(async (obs: Omit<Parameters<typeof addFieldObservation>[0], never>) => {
    const newRecord = await addFieldObservation(obs);
    setObservations((prev) => [...prev, newRecord]);
    return newRecord;
  }, []);
  const removeObservation = useCallback(async (id: string) => {
    await deleteObservation(id);
    setObservations((prev) => prev.filter((o) => o.id !== id));
  }, []);
  const addHarvestEntry = useCallback(async (record: Omit<HarvestRecord, "id" | "created_at">) => { const newRecord = await addHarvestRecord(record); setHarvestRecords((prev) => [...prev, newRecord]); return newRecord; }, []);
  const removeHarvestRecord = useCallback(async (id: string) => { await deleteHarvestRecord(id); setHarvestRecords((prev) => prev.filter((r) => r.id !== id)); }, []);
  const createSeason = useCallback(async (season: Omit<SeasonRecord, "id" | "created_at">) => { const newSeason = await addSeason(season); setSeasons((prev) => [...prev, newSeason]); await setActiveSeasonId(newSeason.id); setActiveSeason(newSeason); return newSeason; }, []);
  const switchSeason = useCallback(async (targetSeasonId: string) => { await setActiveSeasonId(targetSeasonId); await refresh(); }, [refresh]);
  const closeActiveSeason = useCallback(async () => { if (!activeSeason) return; const updated = await closeSeason(activeSeason.id); setSeasons((prev) => prev.map((s) => s.id === updated.id ? updated : s)); setActiveSeason(updated); }, [activeSeason]);
  const reopenActiveSeason = useCallback(async () => { if (!activeSeason) return; const updated = await reopenSeason(activeSeason.id); setSeasons((prev) => prev.map((s) => s.id === updated.id ? updated : s)); setActiveSeason(updated); }, [activeSeason]);
  const updateActiveSeason = useCallback(async (updates: Partial<SeasonRecord>) => { if (!activeSeason) return; const updated = await updateSeason(activeSeason.id, updates); setSeasons((prev) => prev.map((s) => s.id === updated.id ? updated : s)); setActiveSeason(updated); }, [activeSeason]);
  const editActivityLog = useCallback(async (id: string, updates: Partial<ActivityLog>) => {
    const updated = await updateActivityLog(id, updates);
    setActivityLogs((prev) => prev.map((l) => l.id === updated.id ? updated : l));
  }, []);
  const createFarm = useCallback(async (farm: Omit<any, "id" | "created_at">) => { const newFarm = await addFarmRecord(farm); setFarms((prev) => [...prev, newFarm]); return newFarm; }, []);
  const switchFarm = useCallback(async (targetFarmId: string) => { await setActiveFarmId(targetFarmId); await refresh(); }, [refresh]);
  const updateActiveFarm = useCallback(async (updates: Partial<any>) => { if (!activeFarm) return; const updated = await updateFarmRecord(activeFarm.id, updates); setFarms((prev) => prev.map((f) => f.id === updated.id ? updated : f)); setActiveFarm(updated); }, [activeFarm]);
  const addPersonalExpenseEntry = useCallback(async (expense: Omit<PersonalExpense, "id" | "created_at">) => {
    const newExpense = await addPersonalExpense(expense);
    setPersonalExpenses((prev) => [...prev, newExpense]);
    return newExpense;
  }, []);
  const removePersonalExpense = useCallback(async (id: string) => {
    await deletePersonalExpense(id);
    setPersonalExpenses((prev) => prev.filter((expense) => expense.id !== id));
  }, []);
  const totalPersonalExpenses = useMemo(
    () => personalExpenses.reduce((sum, expense) => sum + expense.amount_kes, 0),
    [personalExpenses],
  );

  const value = useMemo(() => ({
    costs, inventory, activityLogs, observations, harvestRecords, seasons, activeSeason,
    currentSchedule, plannedBudget, seasonId, farms, activeFarm, farmId, isLoading, isOffline,
    loadError, retryLoad: refresh, refresh,
    addCostEntry, removeCost, addInventory, removeInventory, logActivity, editActivityLog,
    removeActivityLog, addFieldObservation: addObservation, removeObservation, totalSpent, totalRevenue,
    getCompletedActivityIds, getNextActivity, quickCompleteActivity, getLastSprayDate: () => null,
    addHarvestEntry, removeHarvestRecord, createSeason, switchSeason, closeActiveSeason,
    reopenActiveSeason, updateActiveSeason, createFarm, switchFarm, updateActiveFarm,
    personalExpenses, addPersonalExpenseEntry, removePersonalExpense, totalPersonalExpenses,
  }), [
    costs, inventory, activityLogs, observations, harvestRecords, seasons, activeSeason,
    currentSchedule, plannedBudget, seasonId, farms, activeFarm, farmId, isLoading, isOffline,
    loadError, refresh,
    addCostEntry, removeCost, addInventory, removeInventory, logActivity, editActivityLog,
    removeActivityLog, addObservation, removeObservation, totalSpent, totalRevenue,
    getCompletedActivityIds, getNextActivity, quickCompleteActivity,
    addHarvestEntry, removeHarvestRecord, createSeason, switchSeason, closeActiveSeason,
    reopenActiveSeason, updateActiveSeason, createFarm, switchFarm, updateActiveFarm,
    personalExpenses, addPersonalExpenseEntry, removePersonalExpense, totalPersonalExpenses,
  ]);

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
}

export function useFarm() {
  const ctx = useContext(FarmContext);
  if (!ctx) throw new Error("useFarm must be used within FarmProvider");
  return ctx;
}
