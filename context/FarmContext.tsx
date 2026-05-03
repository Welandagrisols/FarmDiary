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
  deleteCost,
  deleteInventoryItem,
  deleteActivityLog,
  deleteObservation,
  deleteHarvestRecord,
} from "@/lib/storage";
import { generatePlannedSchedule, getCurrentStage } from "@/constants/farmData";

export type FarmContextValue = {
  costs: ReturnType<typeof getCosts> extends Promise<infer T> ? T : never;
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
  const [costs, setCosts] = useState<any[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [observations, setObservations] = useState<ObservationRecord[]>([]);
  const [harvestRecords, setHarvestRecords] = useState<HarvestRecord[]>([]);
  const [seasons, setSeasons] = useState<SeasonRecord[]>([]);
  const [activeSeason, setActiveSeason] = useState<SeasonRecord | null>(null);
  const [farms, setFarms] = useState<any[]>([]);
  const [activeFarm, setActiveFarm] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {}, []);
  const currentSchedule = useMemo(() => generatePlannedSchedule(activeSeason?.template_id || ""), [activeSeason]);
  const seasonId = activeSeason?.id || "";
  const farmId = activeFarm?.id || "";
  const totalSpent = useMemo(() => costs.reduce((sum, cost) => sum + cost.amount_kes, 0), [costs]);
  const totalRevenue = useMemo(() => harvestRecords.reduce((sum, record) => sum + record.total_revenue_kes, 0), [harvestRecords]);

  const switchSeason = useCallback(async (targetSeasonId: string) => { await setActiveSeasonId(targetSeasonId); }, []);
  const closeActiveSeason = useCallback(async () => { if (!activeSeason) return; const updated = await closeSeason(activeSeason.id); setActiveSeason(updated); }, [activeSeason]);
  const reopenActiveSeason = useCallback(async () => { if (!activeSeason) return; const updated = await reopenSeason(activeSeason.id); setActiveSeason(updated); }, [activeSeason]);
  const updateActiveSeason = useCallback(async (updates: Partial<SeasonRecord>) => { if (!activeSeason) return; const updated = await updateSeason(activeSeason.id, updates); setActiveSeason(updated); }, [activeSeason]);

  const value = useMemo(() => ({
    costs,
    inventory,
    activityLogs,
    observations,
    harvestRecords,
    seasons,
    activeSeason,
    currentSchedule,
    seasonId,
    farms,
    activeFarm,
    farmId,
    isLoading,
    refresh,
    addCostEntry: addCost,
    removeCost: deleteCost,
    addInventory: addInventoryItem,
    removeInventory: deleteInventoryItem,
    logActivity: addActivityLog,
    editActivityLog: updateSeason,
    removeActivityLog: deleteActivityLog,
    addFieldObservation,
    removeObservation: deleteObservation,
    totalSpent,
    totalRevenue,
    getCompletedActivityIds: () => [],
    getNextActivity: () => null,
    quickCompleteActivity: async () => {},
    getLastSprayDate: () => null,
    addHarvestEntry: addHarvestRecord,
    removeHarvestRecord: deleteHarvestRecord,
    createSeason: addSeason,
    switchSeason,
    closeActiveSeason,
    reopenActiveSeason,
    updateActiveSeason,
    createFarm: addFarmRecord,
    switchFarm: async () => {},
    updateActiveFarm: async () => {},
  }), [costs, inventory, activityLogs, observations, harvestRecords, seasons, activeSeason, currentSchedule, seasonId, farms, activeFarm, farmId, isLoading, refresh, totalSpent, totalRevenue, switchSeason, closeActiveSeason, reopenActiveSeason, updateActiveSeason]);

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
}

export function useFarm() {
  const ctx = useContext(FarmContext);
  if (!ctx) throw new Error("useFarm must be used within FarmProvider");
  return ctx;
}
