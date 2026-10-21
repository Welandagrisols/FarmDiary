import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  ActivityLog,
  HarvestRecord,
  InventoryItem,
  ObservationRecord,
  PersonalExpense,
  SeasonRecord,
} from "@/lib/storage";
import {
  addActivityLog,
  addCost,
  addFieldObservation,
  addFarmRecord,
  addHarvestRecord,
  addInventoryItem,
  addPersonalExpense,
  addSeason,
  closeSeason,
  deleteActivityLog,
  deleteCost,
  deleteHarvestRecord,
  deleteInventoryItem,
  deleteObservation,
  deletePersonalExpense,
  getActiveFarmRecord,
  getActivityLogs,
  getCosts,
  getFarms,
  getHarvestRecords,
  getInventory,
  getObservations,
  getPersonalExpenses,
  getSeasons,
  reopenSeason,
  setActiveFarmId,
  setActiveSeasonId,
  updateActivityLog,
  updateFarmRecord,
  updateInventoryItem,
  updateSeason,
} from "@/lib/supabase-storage";
import { getSeasonBlocks } from "@/lib/storage";
import { generatePlannedSchedule, getTemplate } from "@/constants/farmData";
import { useAuth } from "@/context/AuthContext";
import { recordsForFarm } from "@/lib/farm-scope";
import { applyPendingMutations } from "@/lib/offline-mutations";
import { getQueue, writeCache } from "@/lib/offline-storage";

const ACTIVE_FARM_KEY = "farm_active_farm_id";
const ACTIVE_SEASON_KEY = "farm_active_season_id";
const LEGACY_CACHE_KEY = "farm_offline_cache_v1";

type InventoryUse = { name: string; qty: number };
type FarmDataSnapshot = {
  allFarms: Awaited<ReturnType<typeof getFarms>>;
  farm: Awaited<ReturnType<typeof getActiveFarmRecord>>;
  allSeasons: SeasonRecord[];
  active: SeasonRecord | null;
  costs: Awaited<ReturnType<typeof getCosts>>;
  inventory: InventoryItem[];
  activityLogs: ActivityLog[];
  observations: ObservationRecord[];
  harvestRecords: HarvestRecord[];
  personalExpenses: PersonalExpense[];
};

function arrayValue<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

async function migrateLegacyOfflineCache(
  userId: string,
  targetFarmId?: string,
): Promise<FarmDataSnapshot | null> {
  const raw = await AsyncStorage.getItem(LEGACY_CACHE_KEY);
  if (!raw) return null;

  const legacy = JSON.parse(raw);
  const queue = await getQueue();
  const savedFarms = arrayValue<any>(legacy.allFarms ?? (legacy.farm ? [legacy.farm] : []))
    .filter((farm) => farm?.user_id === userId);
  const allFarms = applyPendingMutations(
    savedFarms,
    queue,
    "farms",
    { field: "user_id", id: userId },
  );
  const savedActiveFarmId = await AsyncStorage.getItem(ACTIVE_FARM_KEY);
  const requestedId = targetFarmId ?? savedActiveFarmId ?? legacy.farm?.id;
  const farm = allFarms.find((candidate) => candidate.id === requestedId)
    || (targetFarmId ? null : allFarms[0])
    || null;
  if (!farm) return null;

  const scopedRecords = <T extends { farm_id?: string | null }>(key: string, table: string): T[] =>
    applyPendingMutations(
      recordsForFarm(arrayValue<T>(legacy[key]), farm.id),
      queue,
      table,
      { field: "farm_id", id: farm.id },
    );

  const allSeasons = scopedRecords<SeasonRecord>("allSeasons", "seasons");
  const costs = scopedRecords<Awaited<ReturnType<typeof getCosts>>[number]>("c", "costs");
  const inventory = scopedRecords<InventoryItem>("inv", "inventory");
  const activityLogs = scopedRecords<ActivityLog>("logs", "activity_logs");
  const observations = scopedRecords<ObservationRecord>("obs", "observations");
  const harvestRecords = scopedRecords<HarvestRecord>("harvest", "harvest_records");
  const personalExpenses = scopedRecords<PersonalExpense>("expenses", "personal_expenses");
  const savedSeasonId = await AsyncStorage.getItem(ACTIVE_SEASON_KEY);
  const active = allSeasons.find((season) => season.id === savedSeasonId)
    || (legacy.active?.farm_id === farm.id ? legacy.active as SeasonRecord : null)
    || allSeasons.find((season) => season.status !== "closed")
    || null;

  try {
    const writes: Promise<void>[] = [
      writeCache(`farms_${userId}`, allFarms),
    ];
    for (const accessibleFarm of allFarms) {
      const farmRows = <T extends { farm_id?: string | null }>(key: string, table: string): T[] =>
        applyPendingMutations(
          recordsForFarm(arrayValue<T>(legacy[key]), accessibleFarm.id),
          queue,
          table,
          { field: "farm_id", id: accessibleFarm.id },
        );
      writes.push(
        writeCache(`seasons_${accessibleFarm.id}`, farmRows<SeasonRecord>("allSeasons", "seasons")),
        writeCache(`costs_${accessibleFarm.id}`, farmRows<Awaited<ReturnType<typeof getCosts>>[number]>("c", "costs")),
        writeCache(`inventory_${accessibleFarm.id}`, farmRows<InventoryItem>("inv", "inventory")),
        writeCache(`activity_logs_${accessibleFarm.id}`, farmRows<ActivityLog>("logs", "activity_logs")),
        writeCache(`observations_${accessibleFarm.id}`, farmRows<ObservationRecord>("obs", "observations")),
        writeCache(`harvest_records_${accessibleFarm.id}`, farmRows<HarvestRecord>("harvest", "harvest_records")),
        writeCache(`personal_expenses_${accessibleFarm.id}`, farmRows<PersonalExpense>("expenses", "personal_expenses")),
      );
    }
    await Promise.all(writes);
    await AsyncStorage.removeItem(LEGACY_CACHE_KEY);
  } catch (error) {
    console.warn("[FarmContext] Could not migrate the previous offline cache:", error);
  }

  return {
    allFarms,
    farm,
    allSeasons,
    active,
    costs,
    inventory,
    activityLogs,
    observations,
    harvestRecords,
    personalExpenses,
  };
}

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
  refresh: (targetFarmId?: string) => Promise<void>;
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
  const refreshGeneration = useRef(0);

  const applyData = useCallback((allFarms: Awaited<ReturnType<typeof getFarms>>, farm: Awaited<ReturnType<typeof getActiveFarmRecord>>, allSeasons: SeasonRecord[], active: SeasonRecord | null, c: Awaited<ReturnType<typeof getCosts>>, inv: InventoryItem[], logs: ActivityLog[], obs: ObservationRecord[], harvest: HarvestRecord[], expenses: PersonalExpense[]) => {
    const farmId = farm?.id || "";
    setFarms(allFarms);
    setActiveFarm(farm);
    const farmSeasons = recordsForFarm(allSeasons, farmId);
    setSeasons(farmSeasons);
    setActiveSeason(active && active.farm_id === farmId ? active : farmSeasons.find((item) => item.status !== "closed") || null);
    setCosts(recordsForFarm(c, farmId));
    setInventory(recordsForFarm(inv, farmId));
    setActivityLogs(recordsForFarm(logs, farmId));
    setObservations(recordsForFarm(obs, farmId));
    setHarvestRecords(recordsForFarm(harvest, farmId));
    setPersonalExpenses(recordsForFarm(expenses, farmId));
  }, []);

  const refresh = useCallback(async (targetFarmId?: string) => {
    const requestId = ++refreshGeneration.current;
    let usedOfflineCache = false;
    const onOfflineFallback = () => { usedOfflineCache = true; };
    setIsLoading(true);
    setLoadError(null);
    try {
      const [allFarms, storedFarm] = await Promise.all([
        getFarms(onOfflineFallback),
        getActiveFarmRecord(onOfflineFallback),
      ]);
      const farm = targetFarmId
        ? allFarms.find((candidate) => candidate.id === targetFarmId) || null
        : storedFarm || allFarms[0] || null;

      if (!farm) {
        if (usedOfflineCache && user?.id) {
          const legacySnapshot = await migrateLegacyOfflineCache(user.id, targetFarmId);
          if (legacySnapshot) {
            if (requestId !== refreshGeneration.current) return;
            applyData(
              legacySnapshot.allFarms,
              legacySnapshot.farm,
              legacySnapshot.allSeasons,
              legacySnapshot.active,
              legacySnapshot.costs,
              legacySnapshot.inventory,
              legacySnapshot.activityLogs,
              legacySnapshot.observations,
              legacySnapshot.harvestRecords,
              legacySnapshot.personalExpenses,
            );
            setIsOffline(true);
            setLoadError("Showing saved farm data offline. Reconnect and retry to sync.");
            return;
          }
        }
        if (targetFarmId) throw new Error("This farm is not available on this account.");
        if (requestId !== refreshGeneration.current) return;
        applyData(allFarms, null, [], null, [], [], [], [], [], []);
        setIsOffline(usedOfflineCache);
        setLoadError(
          usedOfflineCache
            ? "No saved farm is available offline. Reconnect and retry."
            : "No farm is assigned to this account. Contact your farm manager."
        );
        return;
      }

      const storedFarmId = await AsyncStorage.getItem(ACTIVE_FARM_KEY);
      if (storedFarmId !== farm.id) await setActiveFarmId(farm.id);
      const storedSeasonId = await AsyncStorage.getItem(ACTIVE_SEASON_KEY);
      const [allSeasons, c, inv, logs, obs, harvest, expenses] = await Promise.all([
        getSeasons(farm.id, onOfflineFallback),
        getCosts(farm.id, onOfflineFallback),
        getInventory(farm.id, onOfflineFallback),
        getActivityLogs(farm.id, onOfflineFallback),
        getObservations(farm.id, onOfflineFallback),
        getHarvestRecords(farm.id, onOfflineFallback),
        getPersonalExpenses(farm.id, onOfflineFallback),
      ]);
      const active = allSeasons.find((season) => season.id === storedSeasonId)
        || allSeasons.find((season) => season.status !== "closed")
        || null;

      if (requestId !== refreshGeneration.current) return;
      applyData(allFarms, farm, allSeasons, active, c, inv, logs, obs, harvest, expenses);
      setIsOffline(usedOfflineCache);
      setLoadError(usedOfflineCache ? "Showing saved farm data offline. Reconnect and retry to sync." : null);
    } catch (err) {
      if (requestId !== refreshGeneration.current) return;
      console.warn("[FarmContext] Farm data refresh failed:", err);
      setIsOffline(usedOfflineCache);
      setLoadError(err instanceof Error ? err.message : "Unable to load farm data. Check your connection and retry.");
    } finally {
      if (requestId === refreshGeneration.current) setIsLoading(false);
    }
  }, [applyData, user?.id]);

  const clearFarmData = useCallback(() => {
    refreshGeneration.current += 1;
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
        setInventory((prev) => prev.map((current) =>
          current.id === updated.id ? { ...current, ...updated } : current
        ));
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
  const switchFarm = useCallback(async (targetFarmId: string) => {
    const targetFarm = farms.find((farm) => farm.id === targetFarmId);
    if (!targetFarm) throw new Error("This farm is not available on this account.");
    if (targetFarm.id === activeFarm?.id) return;
    const previousFarmId = activeFarm?.id;

    refreshGeneration.current += 1;
    setActiveFarm(targetFarm);
    setCosts([]);
    setInventory([]);
    setActivityLogs([]);
    setObservations([]);
    setHarvestRecords([]);
    setPersonalExpenses([]);
    setSeasons([]);
    setActiveSeason(null);
    setIsLoading(true);
    try {
      await setActiveFarmId(targetFarmId);
      await refresh(targetFarmId);
    } catch (error) {
      if (previousFarmId) await refresh(previousFarmId);
      else {
        setIsLoading(false);
        setLoadError(error instanceof Error ? error.message : "Could not switch farms.");
      }
      throw error;
    }
  }, [activeFarm?.id, farms, refresh]);
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
