import AsyncStorage from "@react-native-async-storage/async-storage";
import { migrateViaServer } from "@/lib/api";
import {
  hasMigrated,
  markMigrated,
  setActiveFarmId,
  setActiveSeasonId,
} from "@/lib/supabase-storage";
import { supabase } from "@/lib/supabase";

const STORAGE_KEYS = {
  farms: "farm_farms",
  seasons: "farm_seasons",
  costs: "farm_costs",
  inventory: "farm_inventory",
  activityLogs: "farm_activity_logs",
  observations: "farm_observations",
  harvestRecords: "farm_harvest",
  personalExpenses: "farm_personal_expenses",
  activeFarmId: "farm_active_farm_id",
  activeSeasonId: "farm_active_season_id",
} as const;

export interface MigrationCounts {
  farms: number;
  seasons: number;
  costs: number;
  inventory: number;
  activityLogs: number;
  observations: number;
  harvestRecords: number;
  personalExpenses: number;
}

export interface MigrationResult {
  success: boolean;
  counts: MigrationCounts;
  error?: string;
}

type LegacyData = {
  farms: Record<string, unknown>[];
  seasons: Record<string, unknown>[];
  costs: Record<string, unknown>[];
  inventory: Record<string, unknown>[];
  activityLogs: Record<string, unknown>[];
  observations: Record<string, unknown>[];
  harvestRecords: Record<string, unknown>[];
  personalExpenses: Record<string, unknown>[];
  activeFarmId: string | null;
  activeSeasonId: string | null;
};

const emptyCounts: MigrationCounts = {
  farms: 0,
  seasons: 0,
  costs: 0,
  inventory: 0,
  activityLogs: 0,
  observations: 0,
  harvestRecords: 0,
  personalExpenses: 0,
};

function parseArray(raw: string | null, label: string): Record<string, unknown>[] {
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) {
    throw new Error(`Saved ${label} data is not a list. Your local data has not been changed.`);
  }
  return value as Record<string, unknown>[];
}

async function readLegacyData(): Promise<LegacyData> {
  const values = await AsyncStorage.multiGet(Object.values(STORAGE_KEYS));
  const stored = new Map(values);
  const get = (key: keyof typeof STORAGE_KEYS) => stored.get(STORAGE_KEYS[key]) ?? null;

  return {
    farms: parseArray(get("farms"), "farm"),
    seasons: parseArray(get("seasons"), "season"),
    costs: parseArray(get("costs"), "cost"),
    inventory: parseArray(get("inventory"), "inventory"),
    activityLogs: parseArray(get("activityLogs"), "activity log"),
    observations: parseArray(get("observations"), "observation"),
    harvestRecords: parseArray(get("harvestRecords"), "harvest"),
    personalExpenses: parseArray(get("personalExpenses"), "personal expense"),
    activeFarmId: get("activeFarmId"),
    activeSeasonId: get("activeSeasonId"),
  };
}

function countLegacyData(data: LegacyData): MigrationCounts {
  return {
    farms: data.farms.length,
    seasons: data.seasons.length,
    costs: data.costs.length,
    inventory: data.inventory.length,
    activityLogs: data.activityLogs.length,
    observations: data.observations.length,
    harvestRecords: data.harvestRecords.length,
    personalExpenses: data.personalExpenses.length,
  };
}

export async function hasLegacyFarmData(): Promise<boolean> {
  const data = await readLegacyData();
  return Object.values(countLegacyData(data)).some((count) => count > 0);
}

export async function runMigrationIfNeeded(): Promise<MigrationResult> {
  let counts = { ...emptyCounts };
  try {
    if (await hasMigrated()) {
      return { success: true, counts };
    }

    const legacy = await readLegacyData();
    counts = countLegacyData(legacy);
    const hasRecords = Object.values(counts).some((count) => count > 0);

    if (hasRecords) {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (!data.session?.access_token) {
        throw new Error("Please sign in again before migrating your farm data.");
      }

      await migrateViaServer(data.session.access_token, {
        farms: legacy.farms,
        seasons: legacy.seasons,
        costs: legacy.costs,
        inventory: legacy.inventory,
        activityLogs: legacy.activityLogs,
        observations: legacy.observations,
        harvestRecords: legacy.harvestRecords,
        personalExpenses: legacy.personalExpenses,
      });

      if (legacy.activeFarmId) await setActiveFarmId(legacy.activeFarmId);
      if (legacy.activeSeasonId) await setActiveSeasonId(legacy.activeSeasonId);
    }

    await markMigrated();
    return { success: true, counts };
  } catch (error) {
    return {
      success: false,
      counts,
      error: error instanceof Error ? error.message : "The migration could not be completed.",
    };
  }
}
