import AsyncStorage from "@react-native-async-storage/async-storage";
import { migrateViaServer } from "@/lib/api";
import {
  hasMigrated,
  markMigrated,
  setActiveFarmId,
  setActiveSeasonId,
} from "@/lib/supabase-storage";
import { supabase } from "@/lib/supabase";
import {
  emptyLegacyFarmData,
  hasLegacyFarmRecords,
  legacyCacheToFarmData,
  mergeLegacyFarmData,
  LegacyFarmData,
} from "@/lib/legacy-migration-data";

const LEGACY_CACHE_KEY = "farm_offline_cache_v1";
const LEGACY_CACHE_MIGRATED_KEY = "farm_offline_cache_v1_migrated";

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

type LegacyData = LegacyFarmData;

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

async function readLegacyCacheData(userId: string): Promise<{ data: LegacyData; pending: boolean }> {
  const [raw, migrated] = await AsyncStorage.multiGet([LEGACY_CACHE_KEY, LEGACY_CACHE_MIGRATED_KEY]);
  if (!raw[1] || migrated[1] === "true") {
    return { data: emptyLegacyFarmData(), pending: false };
  }
  const cache = JSON.parse(raw[1]);
  const data = legacyCacheToFarmData(cache, userId);
  return { data, pending: hasLegacyFarmRecords(data) };
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

export async function hasLegacyFarmData(userId: string): Promise<boolean> {
  const migrationComplete = await hasMigrated();
  const [tableData, cachedData] = await Promise.all([
    migrationComplete ? Promise.resolve(emptyLegacyFarmData()) : readLegacyData(),
    readLegacyCacheData(userId),
  ]);
  return hasLegacyFarmRecords(tableData) || cachedData.pending;
}

export async function runMigrationIfNeeded(): Promise<MigrationResult> {
  let counts = countLegacyData(emptyLegacyFarmData());
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const userId = session?.user.id;
    if (!userId) throw new Error("Please sign in again before migrating your farm data.");

    const migrationComplete = await hasMigrated();
    const [tableData, cachedData] = await Promise.all([
      migrationComplete ? Promise.resolve(emptyLegacyFarmData()) : readLegacyData(),
      readLegacyCacheData(userId),
    ]);
    if (migrationComplete && !cachedData.pending) {
      return { success: true, counts };
    }

    const legacy = mergeLegacyFarmData(tableData, cachedData.data);
    counts = countLegacyData(legacy);
    const hasRecords = hasLegacyFarmRecords(legacy);

    if (hasRecords) {
      await migrateViaServer(session.access_token, {
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

    if (cachedData.pending && hasRecords) {
      await AsyncStorage.setItem(LEGACY_CACHE_MIGRATED_KEY, "true");
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
