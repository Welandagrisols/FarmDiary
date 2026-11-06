import { supabase } from "./supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { withCache, withWrite } from "./offline-storage";
import {
  FarmRecord,
  CostEntry,
  InventoryItem,
  ActivityLog,
  FarmWorker,
  ObservationRecord,
  HarvestRecord,
  SeasonRecord,
  PersonalExpense,
  UserProfile,
} from "./storage";

const ACTIVE_FARM_KEY = "farm_active_farm_id";
const ACTIVE_SEASON_KEY = "farm_active_season_id";

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

async function getAuthUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

// ─── User Profiles ──────────────────────────────────────────

export async function upsertUserProfile(userId: string, email: string): Promise<void> {
  await supabase.from("user_profiles").upsert(
    { id: userId, email },
    { onConflict: "id", ignoreDuplicates: false }
  );
}

// Upsert and return the profile in one round-trip
export async function upsertAndGetProfile(userId: string, email: string): Promise<UserProfile | null> {
  const { data } = await supabase
    .from("user_profiles")
    .upsert({ id: userId, email }, { onConflict: "id", ignoreDuplicates: false })
    .select("*")
    .single();
  return data as UserProfile | null;
}

export async function getMyProfile(): Promise<UserProfile | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  const { data } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();
  return data as UserProfile | null;
}

export async function getAllUserProfiles(): Promise<UserProfile[]> {
  const { data, error } = await supabase.from("user_profiles").select("*").order("created_at");
  if (error) throw new Error(error.message);
  return data as UserProfile[];
}

// ─── Farms ───────────────────────────────────────────────────

export async function getFarms(onOfflineFallback?: () => void): Promise<FarmRecord[]> {
  const userId = await getAuthUserId();
  if (!userId) return [];
  let isAdmin = false;
  try {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    isAdmin = profile?.role === "admin";
  } catch {
    // Cached farms remain available when profile lookup is offline.
  }

  return withCache(`farms_${userId}`, async () => {
    if (isAdmin) {
      const { data, error } = await supabase
        .from("farms")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return data as FarmRecord[];
    }

    const [{ data: ownedFarms, error: ownedError }, { data: memberships, error: membershipError }] =
      await Promise.all([
        supabase.from("farms").select("*").eq("user_id", userId),
        supabase.from("farm_memberships").select("farm_id").eq("user_id", userId),
      ]);
    if (ownedError) throw new Error(ownedError.message);
    if (membershipError) throw new Error(membershipError.message);

    const memberFarmIds = [...new Set((memberships ?? []).map((membership) => membership.farm_id))];
    const { data: sharedFarms, error: sharedError } = memberFarmIds.length
      ? await supabase.from("farms").select("*").in("id", memberFarmIds)
      : { data: [], error: null };
    if (sharedError) throw new Error(sharedError.message);

    const farmsById = new Map<string, FarmRecord>();
    for (const farm of [...(ownedFarms ?? []), ...(sharedFarms ?? [])]) {
      farmsById.set(farm.id, farm as FarmRecord);
    }
    return [...farmsById.values()].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }, "farms", isAdmin ? undefined : { field: "user_id", id: userId }, onOfflineFallback);
}

export async function getAllFarmsAdmin(): Promise<FarmRecord[]> {
  const { data, error } = await supabase
    .from("farms")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data as FarmRecord[];
}

export async function getActiveFarmRecord(onOfflineFallback?: () => void): Promise<FarmRecord | null> {
  const farms = await getFarms(onOfflineFallback);
  const id = await AsyncStorage.getItem(ACTIVE_FARM_KEY);
  return farms.find((f) => f.id === id) || farms[0] || null;
}

export async function addFarmRecord(farm: Omit<FarmRecord, "id" | "created_at">): Promise<FarmRecord> {
  const userId = await getAuthUserId();
  const record: FarmRecord = {
    ...farm,
    user_id: userId,
    id: genId(),
    created_at: new Date().toISOString(),
  };
  return withWrite("farms", "insert", record, async () => {
    const { error } = await supabase.from("farms").insert(record);
    if (error) throw new Error(error.message);
    return record;
  });
}

export async function updateFarmRecord(id: string, updates: Partial<FarmRecord>): Promise<FarmRecord> {
  return withWrite("farms", "update", { id, ...updates }, async () => {
    const { data, error } = await supabase.from("farms").update(updates).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return data as FarmRecord;
  });
}

export async function setActiveFarmId(id: string): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_FARM_KEY, id);
}

// ─── Seasons ─────────────────────────────────────────────────

export async function getSeasons(
  farmId?: string,
  onOfflineFallback?: () => void,
): Promise<SeasonRecord[]> {
  const cacheKey = farmId ? `seasons_${farmId}` : "seasons";
  return withCache(cacheKey, async () => {
    let query = supabase.from("seasons").select("*").order("created_at", { ascending: true });
    if (farmId) query = query.eq("farm_id", farmId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data as SeasonRecord[];
  }, "seasons", farmId ? { field: "farm_id", id: farmId } : undefined, onOfflineFallback);
}

export async function getActiveSeason(farmId?: string): Promise<SeasonRecord | null> {
  const seasons = await getSeasons(farmId);
  const id = await AsyncStorage.getItem(ACTIVE_SEASON_KEY);
  return seasons.find((s) => s.id === id) || seasons[0] || null;
}

export async function addSeason(season: Omit<SeasonRecord, "id" | "created_at">): Promise<SeasonRecord> {
  const record: SeasonRecord = { ...season, id: genId(), created_at: new Date().toISOString() };
  return withWrite("seasons", "insert", record, async () => {
    const { error } = await supabase.from("seasons").insert(record);
    if (error) throw new Error(error.message);
    return record;
  });
}

export async function updateSeason(id: string, updates: Partial<SeasonRecord>): Promise<SeasonRecord> {
  return withWrite("seasons", "update", { id, ...updates }, async () => {
    const { data, error } = await supabase.from("seasons").update(updates).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return data as SeasonRecord;
  });
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

// ─── Costs ───────────────────────────────────────────────────

export async function getCosts(farmId?: string, onOfflineFallback?: () => void): Promise<CostEntry[]> {
  const cacheKey = farmId ? `costs_${farmId}` : "costs";
  return withCache(cacheKey, async () => {
    let query = supabase.from("costs").select("*").order("created_at", { ascending: true });
    if (farmId) query = query.eq("farm_id", farmId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data as CostEntry[];
  }, "costs", farmId ? { field: "farm_id", id: farmId } : undefined, onOfflineFallback);
}

export async function addCost(cost: Omit<CostEntry, "id" | "created_at">): Promise<CostEntry> {
  const record: CostEntry = { ...cost, id: genId(), created_at: new Date().toISOString() };
  return withWrite("costs", "insert", record, async () => {
    const { error } = await supabase.from("costs").insert(record);
    if (error) throw new Error(error.message);
    return record;
  });
}

export async function updateCost(id: string, updates: Partial<CostEntry>): Promise<CostEntry> {
  return withWrite("costs", "update", { id, ...updates }, async () => {
    const { data, error } = await supabase.from("costs").update(updates).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return data as CostEntry;
  });
}

export async function deleteCost(id: string): Promise<void> {
  await withWrite("costs", "delete", { id }, async () => {
    const { error } = await supabase.from("costs").delete().eq("id", id);
    if (error) throw new Error(error.message);
  });
}

// ─── Inventory ───────────────────────────────────────────────

export async function getInventory(farmId?: string, onOfflineFallback?: () => void): Promise<InventoryItem[]> {
  const cacheKey = farmId ? `inventory_${farmId}` : "inventory";
  return withCache(cacheKey, async () => {
    let query = supabase.from("inventory").select("*").order("created_at", { ascending: true });
    if (farmId) query = query.eq("farm_id", farmId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data as InventoryItem[];
  }, "inventory", farmId ? { field: "farm_id", id: farmId } : undefined, onOfflineFallback);
}

export async function addInventoryItem(item: Omit<InventoryItem, "id" | "created_at">): Promise<InventoryItem> {
  const record: InventoryItem = { ...item, id: genId(), created_at: new Date().toISOString() };
  return withWrite("inventory", "insert", record, async () => {
    const { error } = await supabase.from("inventory").insert(record);
    if (error) throw new Error(error.message);
    return record;
  });
}

export async function deleteInventoryItem(id: string): Promise<void> {
  await withWrite("inventory", "delete", { id }, async () => {
    const { error } = await supabase.from("inventory").delete().eq("id", id);
    if (error) throw new Error(error.message);
  });
}

export async function updateInventoryItem(
  id: string,
  updates: Partial<InventoryItem>,
): Promise<InventoryItem> {
  return withWrite("inventory", "update", { id, ...updates }, async () => {
    const { data, error } = await supabase
      .from("inventory")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as InventoryItem;
  });
}

// ─── Activity Logs ───────────────────────────────────────────

export async function getActivityLogs(farmId?: string, onOfflineFallback?: () => void): Promise<ActivityLog[]> {
  const cacheKey = farmId ? `activity_logs_${farmId}` : "activity_logs";
  return withCache(cacheKey, async () => {
    let query = supabase.from("activity_logs").select("*").order("created_at", { ascending: true });
    if (farmId) query = query.eq("farm_id", farmId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data as ActivityLog[];
  }, "activity_logs", farmId ? { field: "farm_id", id: farmId } : undefined, onOfflineFallback);
}

export async function addActivityLog(entry: Omit<ActivityLog, "id" | "created_at">): Promise<ActivityLog> {
  const record: ActivityLog = { ...entry, id: genId(), created_at: new Date().toISOString() };
  return withWrite("activity_logs", "insert", record, async () => {
    const { error } = await supabase.from("activity_logs").insert(record);
    if (error) throw new Error(error.message);
    return record;
  });
}

export async function updateActivityLog(id: string, updates: Partial<ActivityLog>): Promise<ActivityLog> {
  return withWrite("activity_logs", "update", { id, ...updates }, async () => {
    const { data, error } = await supabase.from("activity_logs").update(updates).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return data as ActivityLog;
  });
}

export async function deleteActivityLog(id: string): Promise<void> {
  await withWrite("activity_logs", "delete", { id }, async () => {
    const { error } = await supabase.from("activity_logs").delete().eq("id", id);
    if (error) throw new Error(error.message);
  });
}

// ─── Farm Worker Roster ───────────────────────────────────────

export async function getFarmWorkers(farmId: string, includeInactive = false): Promise<FarmWorker[]> {
  const workers = await withCache(`farm_workers_${farmId}`, async () => {
    const { data, error } = await supabase
      .from("farm_workers")
      .select("*")
      .eq("farm_id", farmId)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as FarmWorker[];
  }, "farm_workers", { field: "farm_id", id: farmId });

  return includeInactive ? workers : workers.filter((worker) => worker.is_active);
}

export async function addFarmWorker(farmId: string, name: string): Promise<FarmWorker> {
  const record: FarmWorker = {
    id: genId(),
    farm_id: farmId,
    name: name.trim(),
    is_active: true,
    created_by: await getAuthUserId(),
    created_at: new Date().toISOString(),
  };
  return withWrite("farm_workers", "insert", record, async () => {
    const { error } = await supabase.from("farm_workers").insert(record);
    if (error) throw new Error(error.message);
    return record;
  });
}

export async function setFarmWorkerActive(worker: FarmWorker, isActive: boolean): Promise<FarmWorker> {
  const record = { ...worker, is_active: isActive };
  return withWrite("farm_workers", "update", record, async () => {
    const { data, error } = await supabase
      .from("farm_workers")
      .update({ is_active: isActive })
      .eq("id", worker.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as FarmWorker;
  });
}

// ─── Observations ────────────────────────────────────────────

export async function getObservations(farmId?: string, onOfflineFallback?: () => void): Promise<ObservationRecord[]> {
  const cacheKey = farmId ? `observations_${farmId}` : "observations";
  return withCache(cacheKey, async () => {
    let query = supabase.from("observations").select("*").order("created_at", { ascending: true });
    if (farmId) query = query.eq("farm_id", farmId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data as ObservationRecord[];
  }, "observations", farmId ? { field: "farm_id", id: farmId } : undefined, onOfflineFallback);
}

export async function addFieldObservation(entry: Omit<ObservationRecord, "id" | "created_at">): Promise<ObservationRecord> {
  const record: ObservationRecord = { ...entry, id: genId(), created_at: new Date().toISOString() };
  return withWrite("observations", "insert", record, async () => {
    const { error } = await supabase.from("observations").insert(record);
    if (error) throw new Error(error.message);
    return record;
  });
}

export async function deleteObservation(id: string): Promise<void> {
  await withWrite("observations", "delete", { id }, async () => {
    const { error } = await supabase.from("observations").delete().eq("id", id);
    if (error) throw new Error(error.message);
  });
}

// ─── Harvest ─────────────────────────────────────────────────

export async function getHarvestRecords(farmId?: string, onOfflineFallback?: () => void): Promise<HarvestRecord[]> {
  const cacheKey = farmId ? `harvest_records_${farmId}` : "harvest_records";
  return withCache(cacheKey, async () => {
    let query = supabase.from("harvest_records").select("*").order("created_at", { ascending: true });
    if (farmId) query = query.eq("farm_id", farmId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data as HarvestRecord[];
  }, "harvest_records", farmId ? { field: "farm_id", id: farmId } : undefined, onOfflineFallback);
}

export async function addHarvestRecord(entry: Omit<HarvestRecord, "id" | "created_at">): Promise<HarvestRecord> {
  const record: HarvestRecord = { ...entry, id: genId(), created_at: new Date().toISOString() };
  return withWrite("harvest_records", "insert", record, async () => {
    const { error } = await supabase.from("harvest_records").insert(record);
    if (error) throw new Error(error.message);
    return record;
  });
}

export async function deleteHarvestRecord(id: string): Promise<void> {
  await withWrite("harvest_records", "delete", { id }, async () => {
    const { error } = await supabase.from("harvest_records").delete().eq("id", id);
    if (error) throw new Error(error.message);
  });
}

// ─── Personal Expenses ───────────────────────────────────────

export async function getPersonalExpenses(farmId?: string, onOfflineFallback?: () => void): Promise<PersonalExpense[]> {
  const cacheKey = farmId ? `personal_expenses_${farmId}` : "personal_expenses";
  return withCache(cacheKey, async () => {
    let query = supabase.from("personal_expenses").select("*").order("created_at", { ascending: true });
    if (farmId) query = query.eq("farm_id", farmId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data as PersonalExpense[];
  }, "personal_expenses", farmId ? { field: "farm_id", id: farmId } : undefined, onOfflineFallback);
}

export async function addPersonalExpense(expense: Omit<PersonalExpense, "id" | "created_at">): Promise<PersonalExpense> {
  const record: PersonalExpense = { ...expense, id: genId(), created_at: new Date().toISOString() };
  return withWrite("personal_expenses", "insert", record, async () => {
    const { error } = await supabase.from("personal_expenses").insert(record);
    if (error) throw new Error(error.message);
    return record;
  });
}

export async function deletePersonalExpense(id: string): Promise<void> {
  await withWrite("personal_expenses", "delete", { id }, async () => {
    const { error } = await supabase.from("personal_expenses").delete().eq("id", id);
    if (error) throw new Error(error.message);
  });
}

// ─── Migration helpers ───────────────────────────────────────

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
