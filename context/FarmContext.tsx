import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ActivityLog,
  HarvestRecord,
  InventoryItem,
  ObservationRecord,
  PersonalExpense,
  SeasonRecord,
  FarmRecord,
  CostEntry,
  formatKES,
  formatDate,
  isPrePlanting,
  getDaysUntil,
  getDaysSincePlanting,
  getGrowthStage,
  PERSONAL_EXPENSE_CATEGORIES,
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
  getActivityLogs,
  getCosts,
  getFarms,
  getAllFarmsAdmin,
  getHarvestRecords,
  getInventory,
  getObservations,
  getPersonalExpenses,
  getSeasons,
  reopenSeason,
  setActiveFarmId,
  setActiveSeasonId,
  updateFarmRecord,
  updateSeason,
} from "@/lib/supabase-storage";
import { generatePlannedSchedule, CROP_TEMPLATES } from "@/constants/farmData";
import { useAuth } from "@/context/AuthContext";
import { useSync } from "@/context/SyncContext";

type FarmContextValue = {
  costs: CostEntry[];
  inventory: InventoryItem[];
  activityLogs: ActivityLog[];
  observations: ObservationRecord[];
  harvestRecords: HarvestRecord[];
  seasons: SeasonRecord[];
  activeSeason: SeasonRecord | null;
  currentSchedule: ReturnType<typeof generatePlannedSchedule>;
  plannedBudget: number;
  seasonId: string;
  farms: FarmRecord[];
  activeFarm: FarmRecord | null;
  farmId: string;
  isLoading: boolean;
  loadError: string | null;
  retryLoad: () => Promise<void>;
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
  updateActiveFarm: (updates: Partial<FarmRecord>) => Promise<void>;
  personalExpenses: PersonalExpense[];
  addPersonalExpenseEntry: typeof addPersonalExpense;
  removePersonalExpense: (id: string) => Promise<void>;
  totalPersonalExpenses: number;
};

const FarmContext = createContext<FarmContextValue | null>(null);

export function FarmProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const { lastSynced } = useSync();

  const [costs, setCosts] = useState<CostEntry[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [observations, setObservations] = useState<ObservationRecord[]>([]);
  const [harvestRecords, setHarvestRecords] = useState<HarvestRecord[]>([]);
  const [seasons, setSeasons] = useState<SeasonRecord[]>([]);
  const [activeSeason, setActiveSeason] = useState<SeasonRecord | null>(null);
  const [farms, setFarms] = useState<FarmRecord[]>([]);
  const [activeFarm, setActiveFarm] = useState<FarmRecord | null>(null);
  const [personalExpenses, setPersonalExpenses] = useState<PersonalExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const clearAll = useCallback(() => {
    setCosts([]);
    setInventory([]);
    setActivityLogs([]);
    setObservations([]);
    setHarvestRecords([]);
    setSeasons([]);
    setActiveSeason(null);
    setFarms([]);
    setActiveFarm(null);
    setPersonalExpenses([]);
    setLoadError(null);
    setIsLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const isAdmin = profile?.role === "admin";
      const [storedFarmId, storedSeasonId] = await Promise.all([
        AsyncStorage.getItem("farm_active_farm_id"),
        AsyncStorage.getItem("farm_active_season_id"),
      ]);

      // Step 1: fetch farms to confirm which farm is actually active
      const allFarms = await (isAdmin ? getAllFarmsAdmin() : getFarms());
      const farm = allFarms.find((f) => f.id === storedFarmId) || allFarms[0] || null;
      const farmId = farm?.id || "";

      setFarms(allFarms);
      setActiveFarm(farm);

      if (!farmId) {
        setIsLoading(false);
        return;
      }

      // Step 2: fetch all farm-scoped data in parallel, filtered server-side
      // getActiveSeason() is removed — computed locally from seasons below
      const results = await Promise.allSettled([
        getSeasons(farmId),
        getCosts(farmId),
        getInventory(farmId),
        getActivityLogs(farmId),
        getObservations(farmId),
        getHarvestRecords(farmId),
        getPersonalExpenses(farmId),
      ]);

      const settled = <T,>(r: PromiseSettledResult<T>, fallback: T): T =>
        r.status === "fulfilled" ? r.value : fallback;

      const allSeasons = settled(results[0] as PromiseSettledResult<SeasonRecord[]>,      []);
      const c          = settled(results[1] as PromiseSettledResult<CostEntry[]>,          []);
      const inv        = settled(results[2] as PromiseSettledResult<InventoryItem[]>,      []);
      const logs       = settled(results[3] as PromiseSettledResult<ActivityLog[]>,        []);
      const obs        = settled(results[4] as PromiseSettledResult<ObservationRecord[]>,  []);
      const harvest    = settled(results[5] as PromiseSettledResult<HarvestRecord[]>,      []);
      const pe         = settled(results[6] as PromiseSettledResult<PersonalExpense[]>,    []);

      const failedCollections = results
        .map((r, i) => r.status === "rejected"
          ? ["seasons","costs","inventory","activity logs","observations","harvest","expenses"][i]
          : null)
        .filter(Boolean);
      if (failedCollections.length > 0) {
        setLoadError(`Some data failed to load: ${failedCollections.join(", ")}. Pull down to retry.`);
      }

      // Compute active season locally — no extra network call needed
      const activeSeason =
        allSeasons.find((s) => s.id === storedSeasonId) ||
        allSeasons.find((s) => s.status !== "closed") ||
        allSeasons[0] ||
        null;

      setSeasons(allSeasons);
      setActiveSeason(activeSeason);
      setCosts(c);
      setInventory(inv);
      setActivityLogs(logs);
      setObservations(obs);
      setHarvestRecords(harvest);
      setPersonalExpenses(pe);
    } catch (err: any) {
      setLoadError(err?.message || "Failed to load farm data. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }, [profile]);

  const retryLoad = useCallback(async () => {
    setIsLoading(true);
    await refresh();
  }, [refresh]);

  useEffect(() => {
    if (user) {
      setIsLoading(true);
      refresh();
    } else {
      clearAll();
    }
  }, [user, refresh, clearAll]);

  // Auto-refresh after offline sync completes so UI shows synced data
  useEffect(() => {
    if (lastSynced && user) {
      refresh();
    }
  }, [lastSynced]);

  const currentSchedule = useMemo(() => {
    const template = CROP_TEMPLATES.find((t) => t.id === activeSeason?.template_id) ?? CROP_TEMPLATES[0];
    const plantingDate = activeSeason?.section_a?.planting_date ?? new Date().toISOString().split("T")[0];
    if (!template) return [];
    return generatePlannedSchedule(template, plantingDate);
  }, [activeSeason]);
  const plannedBudget = useMemo(() => currentSchedule.reduce((sum, a) => sum + a.estimatedTotalCost, 0), [currentSchedule]);
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
  const createFarm = useCallback(async (farm: Omit<FarmRecord, "id" | "created_at">) => { const newFarm = await addFarmRecord(farm); setFarms((prev) => [...prev, newFarm]); return newFarm; }, []);
  const switchFarm = useCallback(async (targetFarmId: string) => { await setActiveFarmId(targetFarmId); await refresh(); }, [refresh]);
  const updateActiveFarm = useCallback(async (updates: Partial<FarmRecord>) => { if (!activeFarm) return; const updated = await updateFarmRecord(activeFarm.id, updates); setFarms((prev) => prev.map((f) => f.id === updated.id ? updated : f)); setActiveFarm(updated); }, [activeFarm]);

  const addPersonalExpenseEntry = useCallback(async (expense: Omit<PersonalExpense, "id" | "created_at">) => { const newExpense = await addPersonalExpense(expense); setPersonalExpenses((prev) => [...prev, newExpense]); return newExpense; }, []);
  const removePersonalExpense = useCallback(async (id: string) => { await deletePersonalExpense(id); setPersonalExpenses((prev) => prev.filter((e) => e.id !== id)); }, []);
  const totalPersonalExpenses = useMemo(() => personalExpenses.reduce((sum, e) => sum + e.amount_kes, 0), [personalExpenses]);

  const value = useMemo(() => ({ costs, inventory, activityLogs, observations, harvestRecords, seasons, activeSeason, currentSchedule, plannedBudget, seasonId, farms, activeFarm, farmId, isLoading, loadError, retryLoad, refresh, addCostEntry: addCost, removeCost: deleteCost, addInventory: addInventoryItem, removeInventory: deleteInventoryItem, logActivity: addActivityLog, editActivityLog: updateSeason, removeActivityLog: deleteActivityLog, addFieldObservation, removeObservation: deleteObservation, totalSpent, totalRevenue, getCompletedActivityIds, getNextActivity, quickCompleteActivity, getLastSprayDate: () => null, addHarvestEntry, removeHarvestRecord, createSeason, switchSeason, closeActiveSeason, reopenActiveSeason, updateActiveSeason, createFarm, switchFarm, updateActiveFarm, personalExpenses, addPersonalExpenseEntry, removePersonalExpense, totalPersonalExpenses }), [costs, inventory, activityLogs, observations, harvestRecords, seasons, activeSeason, currentSchedule, plannedBudget, seasonId, farms, activeFarm, farmId, isLoading, loadError, retryLoad, refresh, totalSpent, totalRevenue, getCompletedActivityIds, getNextActivity, quickCompleteActivity, addHarvestEntry, removeHarvestRecord, createSeason, switchSeason, closeActiveSeason, reopenActiveSeason, updateActiveSeason, createFarm, switchFarm, updateActiveFarm, personalExpenses, addPersonalExpenseEntry, removePersonalExpense, totalPersonalExpenses]);

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
}

export function useFarm() {
  const ctx = useContext(FarmContext);
  if (!ctx) throw new Error("useFarm must be used within FarmProvider");
  return ctx;
}
