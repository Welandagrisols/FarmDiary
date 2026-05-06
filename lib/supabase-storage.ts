import { supabase } from "./supabase";
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

const ACTIVE_FARM_KEY = "farm_active_farm_id";
const ACTIVE_SEASON_KEY = "farm_active_season_id";

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

export async function getFarms(): Promise<FarmRecord[]> {
  const { data, error } = await supabase.from("farms").select("*").order("created_at", { ascending: true });
  if (error) throw new Error("getFarms: " + error.message);
  return data as FarmRecord[];
}

export async function getActiveFarmRecord(): Promise<FarmRecord | null> {
  const farms = await getFarms();
  const id = await AsyncStorage.getItem(ACTIVE_FARM_KEY);
  return farms.find((f) => f.id === id) || farms[0] || null;
}

export async function addFarmRecord(farm: Omit<FarmRecord, "id" | "created_at">): Promise<FarmRecord> {
  const record: FarmRecord = { ...farm, id: genId(), created_at: new Date().toISOString() };
  const { error } = await supabase.from("farms").insert(record);
  if (error) throw new Error("addFarmRecord: " + error.message);
  return record;
}

export async function updateFarmRecord(id: string, updates: Partial<FarmRecord>): Promise<FarmRecord> {
  const { data, error } = await supabase.from("farms").update(updates).eq("id", id).select().single();
  if (error) throw new Error("updateFarmRecord: " + error.message);
  return data as FarmRecord;
}

export async function setActiveFarmId(id: string): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_FARM_KEY, id);
}

export async function getSeasons(): Promise<SeasonRecord[]> {
  const { data, error } = await supabase.from("seasons").select("*").order("created_at", { ascending: true });
  if (error) throw new Error("getSeasons: " + error.message);
  return data as SeasonRecord[];
}

export async function getActiveSeason(): Promise<SeasonRecord | null> {
  const seasons = await getSeasons();
  const id = await AsyncStorage.getItem(ACTIVE_SEASON_KEY);
  return seasons.find((s) => s.id === id) || seasons[0] || null;
}

export async function addSeason(season: Omit<SeasonRecord, "id" | "created_at">): Promise<SeasonRecord> {
  const record: SeasonRecord = { ...season, id: genId(), created_at: new Date().toISOString() };
  const { error } = await supabase.from("seasons").insert(record);
  if (error) throw new Error("addSeason: " + error.message);
  return record;
}

export async function updateSeason(id: string, updates: Partial<SeasonRecord>): Promise<SeasonRecord> {
  const { data, error } = await supabase.from("seasons").update(updates).eq("id", id).select().single();
  if (error) throw new Error("updateSeason: " + error.message);
  return data as SeasonRecord;
}

export async function setActiveSeasonId(id: string): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_SEASON_KEY, id);
}

export async function closeSeason(id: string): Promise<SeasonRecord> {
  return updateSeason(id, { status: "closed", closed_at: new Date().toISOString() });
}

export async function reopenSeason(id: string): Promise<SeasonRecord> {
  return updateSeason(id, { status: "active", closed_at: null });
}

export async function getCosts(): Promise<CostEntry[]> {
  const { data, error } = await supabase.from("costs").select("*").order("created_at", { ascending: true });
  if (error) throw new Error("getCosts: " + error.message);
  return data as CostEntry[];
}

export async function addCost(cost: Omit<CostEntry, "id" | "created_at">): Promise<CostEntry> {
  const record: CostEntry = { ...cost, id: genId(), created_at: new Date().toISOString() };
  const { error } = await supabase.from("costs").insert(record);
  if (error) throw new Error("addCost: " + error.message);
  return record;
}

export async function deleteCost(id: string): Promise<void> {
  const { error } = await supabase.from("costs").delete().eq("id", id);
  if (error) throw new Error("deleteCost: " + error.message);
}

export async function getInventory(): Promise<InventoryItem[]> {
  const { data, error } = await supabase.from("inventory").select("*").order("created_at", { ascending: true });
  if (error) throw new Error("getInventory: " + error.message);
  return data as InventoryItem[];
}

export async function addInventoryItem(item: Omit<InventoryItem, "id" | "created_at">): Promise<InventoryItem> {
  const record: InventoryItem = { ...item, id: genId(), created_at: new Date().toISOString() };
  const { error } = await supabase.from("inventory").insert(record);
  if (error) throw new Error("addInventoryItem: " + error.message);
  return record;
}

export async function deleteInventoryItem(id: string): Promise<void> {
  const { error } = await supabase.from("inventory").delete().eq("id", id);
  if (error) throw new Error("deleteInventoryItem: " + error.message);
}

export async function getActivityLogs(): Promise<ActivityLog[]> {
  const { data, error } = await supabase.from("activity_logs").select("*").order("created_at", { ascending: true });
  if (error) throw new Error("getActivityLogs: " + error.message);
  return data as ActivityLog[];
}

export async function addActivityLog(entry: Omit<ActivityLog, "id" | "created_at">): Promise<ActivityLog> {
  const record: ActivityLog = { ...entry, id: genId(), created_at: new Date().toISOString() };
  const { error } = await supabase.from("activity_logs").insert(record);
  if (error) throw new Error("addActivityLog: " + error.message);
  return record;
}

export async function deleteActivityLog(id: string): Promise<void> {
  const { error } = await supabase.from("activity_logs").delete().eq("id", id);
  if (error) throw new Error("deleteActivityLog: " + error.message);
}

export async function getObservations(): Promise<ObservationRecord[]> {
  const { data, error } = await supabase.from("observations").select("*").order("created_at", { ascending: true });
  if (error) throw new Error("getObservations: " + error.message);
  return data as ObservationRecord[];
}

export async function addFieldObservation(entry: Omit<ObservationRecord, "id" | "created_at">): Promise<ObservationRecord> {
  const record: ObservationRecord = { ...entry, id: genId(), created_at: new Date().toISOString() };
  const { error } = await supabase.from("observations").insert(record);
  if (error) throw new Error("addFieldObservation: " + error.message);
  return record;
}

export async function deleteObservation(id: string): Promise<void> {
  const { error } = await supabase.from("observations").delete().eq("id", id);
  if (error) throw new Error("deleteObservation: " + error.message);
}

export async function getHarvestRecords(): Promise<HarvestRecord[]> {
  const { data, error } = await supabase.from("harvest_records").select("*").order("created_at", { ascending: true });
  if (error) throw new Error("getHarvestRecords: " + error.message);
  return data as HarvestRecord[];
}

export async function addHarvestRecord(entry: Omit<HarvestRecord, "id" | "created_at">): Promise<HarvestRecord> {
  const record: HarvestRecord = { ...entry, id: genId(), created_at: new Date().toISOString() };
  const { error } = await supabase.from("harvest_records").insert(record);
  if (error) throw new Error("addHarvestRecord: " + error.message);
  return record;
}

export async function deleteHarvestRecord(id: string): Promise<void> {
  const { error } = await supabase.from("harvest_records").delete().eq("id", id);
  if (error) throw new Error("deleteHarvestRecord: " + error.message);
}

export async function getPersonalExpenses(): Promise<PersonalExpense[]> {
  const { data, error } = await supabase.from("personal_expenses").select("*").order("created_at", { ascending: true });
  if (error) throw new Error("getPersonalExpenses: " + error.message);
  return data as PersonalExpense[];
}

export async function addPersonalExpense(expense: Omit<PersonalExpense, "id" | "created_at">): Promise<PersonalExpense> {
  const record: PersonalExpense = { ...expense, id: genId(), created_at: new Date().toISOString() };
  const { error } = await supabase.from("personal_expenses").insert(record);
  if (error) throw new Error("addPersonalExpense: " + error.message);
  return record;
}

export async function deletePersonalExpense(id: string): Promise<void> {
  const { error } = await supabase.from("personal_expenses").delete().eq("id", id);
  if (error) throw new Error("deletePersonalExpense: " + error.message);
}

export async function hasMigrated(): Promise<boolean> {
  const val = await AsyncStorage.getItem("supabase_migration_done");
  return val === "true";
}

export async function markMigrated(): Promise<void> {
  await AsyncStorage.setItem("supabase_migration_done", "true");
}

export async function upsertFarms(records: FarmRecord[]): Promise<void> {
  if (!records.length) return;
  const { error } = await supabase.from("farms").upsert(records, { onConflict: "id" });
  if (error) throw new Error("upsertFarms: " + error.message);
}

export async function upsertSeasons(records: SeasonRecord[]): Promise<void> {
  if (!records.length) return;
  const { error } = await supabase.from("seasons").upsert(records, { onConflict: "id" });
  if (error) throw new Error("upsertSeasons: " + error.message);
}

export async function upsertCosts(records: CostEntry[]): Promise<void> {
  if (!records.length) return;
  const { error } = await supabase.from("costs").upsert(records, { onConflict: "id" });
  if (error) throw new Error("upsertCosts: " + error.message);
}

export async function upsertInventory(records: InventoryItem[]): Promise<void> {
  if (!records.length) return;
  const { error } = await supabase.from("inventory").upsert(records, { onConflict: "id" });
  if (error) throw new Error("upsertInventory: " + error.message);
}

export async function upsertActivityLogs(records: ActivityLog[]): Promise<void> {
  if (!records.length) return;
  const { error } = await supabase.from("activity_logs").upsert(records, { onConflict: "id" });
  if (error) throw new Error("upsertActivityLogs: " + error.message);
}

export async function upsertObservations(records: ObservationRecord[]): Promise<void> {
  if (!records.length) return;
  const { error } = await supabase.from("observations").upsert(records, { onConflict: "id" });
  if (error) throw new Error("upsertObservations: " + error.message);
}

export async function upsertHarvestRecords(records: HarvestRecord[]): Promise<void> {
  if (!records.length) return;
  const { error } = await supabase.from("harvest_records").upsert(records, { onConflict: "id" });
  if (error) throw new Error("upsertHarvestRecords: " + error.message);
}

export async function upsertPersonalExpenses(records: PersonalExpense[]): Promise<void> {
  if (!records.length) return;
  const { error } = await supabase.from("personal_expenses").upsert(records, { onConflict: "id" });
  if (error) throw new Error("upsertPersonalExpenses: " + error.message);
}
