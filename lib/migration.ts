import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  FarmRecord,
  CostEntry,
  InventoryItem,
  ActivityLog,
  ObservationRecord,
  HarvestRecord,
  SeasonRecord,
  PersonalExpense,
} from "./storage";
import {
  upsertFarms,
  upsertSeasons,
  upsertCosts,
  upsertInventory,
  upsertActivityLogs,
  upsertObservations,
  upsertHarvestRecords,
  upsertPersonalExpenses,
  hasMigrated,
  markMigrated,
} from "./supabase-storage";

const KEYS = {
  COSTS: "farm_costs",
  INVENTORY: "farm_inventory",
  ACTIVITY_LOGS: "farm_activity_logs",
  OBSERVATIONS: "farm_observations",
  HARVEST: "farm_harvest",
  SEASONS: "farm_seasons",
  FARMS: "farm_farms",
  PERSONAL_EXPENSES: "farm_personal_expenses",
};

async function readLocal<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export interface MigrationResult {
  alreadyDone: boolean;
  success: boolean;
  counts: {
    farms: number;
    seasons: number;
    costs: number;
    inventory: number;
    activityLogs: number;
    observations: number;
    harvestRecords: number;
    personalExpenses: number;
  };
  error?: string;
}

export async function runMigrationIfNeeded(): Promise<MigrationResult> {
  const done = await hasMigrated();
  if (done) {
    return { alreadyDone: true, success: true, counts: { farms: 0, seasons: 0, costs: 0, inventory: 0, activityLogs: 0, observations: 0, harvestRecords: 0, personalExpenses: 0 } };
  }

  try {
    const [farms, seasons, costs, inventory, activityLogs, observations, harvestRecords, personalExpenses] = await Promise.all([
      readLocal<FarmRecord>(KEYS.FARMS),
      readLocal<SeasonRecord>(KEYS.SEASONS),
      readLocal<CostEntry>(KEYS.COSTS),
      readLocal<InventoryItem>(KEYS.INVENTORY),
      readLocal<ActivityLog>(KEYS.ACTIVITY_LOGS),
      readLocal<ObservationRecord>(KEYS.OBSERVATIONS),
      readLocal<HarvestRecord>(KEYS.HARVEST),
      readLocal<PersonalExpense>(KEYS.PERSONAL_EXPENSES),
    ]);

    await upsertFarms(farms);
    await upsertSeasons(seasons);
    await upsertCosts(costs);
    await upsertInventory(inventory);
    await upsertActivityLogs(activityLogs);
    await upsertObservations(observations);
    await upsertHarvestRecords(harvestRecords);
    await upsertPersonalExpenses(personalExpenses);

    await markMigrated();

    return {
      alreadyDone: false,
      success: true,
      counts: {
        farms: farms.length,
        seasons: seasons.length,
        costs: costs.length,
        inventory: inventory.length,
        activityLogs: activityLogs.length,
        observations: observations.length,
        harvestRecords: harvestRecords.length,
        personalExpenses: personalExpenses.length,
      },
    };
  } catch (err: any) {
    return {
      alreadyDone: false,
      success: false,
      counts: { farms: 0, seasons: 0, costs: 0, inventory: 0, activityLogs: 0, observations: 0, harvestRecords: 0, personalExpenses: 0 },
      error: err?.message || "Unknown error",
    };
  }
}
