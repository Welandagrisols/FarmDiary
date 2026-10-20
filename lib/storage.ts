import { supabase } from "@/lib/supabase";
import {
  INVENTORY_MASTER,
  FARM_SEED,
  SEASON_SEED,
  SECTIONS_SEED,
  CROP_TEMPLATES,
} from "@/constants/farmData";

export interface FarmRecord {
  id: string;
  name: string;
  location: string;
  total_acres: number;
  lease_status: string;
  crop_type: string;
  notes: string | null;
  created_at: string;
}

export interface CostEntry {
  id: string;
  farm_id: string;
  season_id: string;
  section_id: string | null;
  cost_category: string;
  cost_subcategory: string;
  description: string;
  cost_date: string;
  is_pre_planting: boolean;
  is_historical: boolean;
  amount_kes: number;
  quantity: number | null;
  unit: string | null;
  unit_price_kes: number | null;
  product_name: string | null;
  supplier: string | null;
  receipt_reference: string | null;
  num_workers: number | null;
  days_worked: number | null;
  rate_per_worker_per_day: number | null;
  facilitator_name: string | null;
  trip_from: string | null;
  trip_to: string | null;
  is_deviation: boolean;
  planned_product: string | null;
  deviation_reason: string | null;
  notes: string | null;
  weather_conditions: string | null;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  farm_id: string;
  season_id: string;
  product_name: string;
  category: string;
  quantity_purchased: number;
  unit: string;
  unit_price_kes: number;
  quantity_used: number;
  purchase_date: string;
  supplier: string | null;
  low_stock_threshold: number | null;
  is_historical: boolean;
  notes: string | null;
  created_at: string;
}

export interface ProductUsed {
  name: string;
  qty: number;
  unit: string;
  unit_price: number;
  total: number;
  is_deviation: boolean;
  actual_product: string | null;
  deviation_reason: string | null;
}

export interface ActivityLog {
  id: string;
  farm_id: string;
  season_id: string;
  section_id: string | null;
  schedule_activity_id: string | null;
  activity_name: string;
  planned_date: string | null;
  actual_date: string;
  products_used: ProductUsed[];
  is_deviation: boolean;
  deviation_reason: string | null;
  num_workers: number;
  labor_cost_kes: number;
  total_cost_kes: number;
  weather_conditions: string | null;
  is_historical: boolean;
  notes: string | null;
  created_at: string;
}

export interface ObservationRecord {
  id: string;
  farm_id: string;
  season_id: string;
  section_id: string | null;
  observation_date: string;
  observation_type: string;
  description: string;
  severity: string;
  action_taken: string | null;
  is_historical: boolean;
  created_at: string;
}

export interface HarvestRecord {
  id: string;
  farm_id: string;
  season_id: string;
  section_id: string;
  harvest_date: string;
  bags: number;
  kg_per_bag: number;
  total_kg: number;
  price_per_bag_kes: number;
  total_revenue_kes: number;
  buyer: string | null;
  notes: string | null;
  created_at: string;
}

export interface SeasonRecord {
  id: string;
  farm_id: string;
  season_number: number;
  season_name: string;
  season_type: string;
  status: "planning" | "active" | "closed";
  template_id: string;
  section_a: {
    variety: string;
    planting_date: string;
    acres: number;
    blight_risk: "LOW" | "MEDIUM" | "HIGH";
    notes: string | null;
  };
  section_b: {
    variety: string;
    planting_date: string;
    acres: number;
    blight_risk: "LOW" | "MEDIUM" | "HIGH";
    notes: string | null;
  };
  pre_planting_start_date: string | null;
  total_revenue_kes: number | null;
  total_cost_kes: number | null;
  notes: string | null;
  created_at: string;
  closed_at: string | null;
}

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

export async function seedIfNeeded(): Promise<void> {
  const { data: existing } = await supabase
    .from("farms")
    .select("id")
    .limit(1);
  if (existing && existing.length > 0) return;

  const today = new Date().toISOString().split("T")[0];
  const now = new Date().toISOString();
  const sA = SECTIONS_SEED[0];
  const sB = SECTIONS_SEED[1];

  const farm: FarmRecord = {
    ...FARM_SEED,
    crop_type: "Potato",
    notes: null,
    created_at: now,
  };

  const season: SeasonRecord = {
    id: SEASON_SEED.id,
    farm_id: FARM_SEED.id,
    season_number: 1,
    season_name: SEASON_SEED.season_name,
    season_type: SEASON_SEED.season_type,
    status: "active",
    template_id: CROP_TEMPLATES[0]?.id || "",
    section_a: {
      variety: sA.variety,
      planting_date: sA.planting_date,
      acres: sA.acres,
      blight_risk: sA.blight_risk as "LOW" | "MEDIUM" | "HIGH",
      notes: sA.notes ?? null,
    },
    section_b: {
      variety: sB.variety,
      planting_date: sB.planting_date,
      acres: sB.acres,
      blight_risk: sB.blight_risk as "LOW" | "MEDIUM" | "HIGH",
      notes: sB.notes ?? null,
    },
    pre_planting_start_date: null,
    total_revenue_kes: null,
    total_cost_kes: null,
    notes: null,
    created_at: now,
    closed_at: null,
  };

  const inventory: InventoryItem[] = INVENTORY_MASTER.map((item) => ({
    id: genId(),
    farm_id: farm.id,
    season_id: season.id,
    product_name: item.product,
    category: item.category,
    quantity_purchased: item.qty,
    unit: item.unit,
    unit_price_kes: item.unitPrice,
    quantity_used: 0,
    purchase_date: today,
    supplier: null,
    low_stock_threshold: null,
    is_historical: false,
    notes: null,
    created_at: now,
  }));

  await supabase.from("farms").insert(farm);
  await supabase.from("seasons").insert(season);
  if (inventory.length > 0) {
    await supabase.from("inventory").insert(inventory);
  }
  await supabase.from("app_meta").upsert([
    { key: "active_farm_id", value: farm.id },
    { key: "active_season_id", value: season.id },
  ]);
}

export async function seedSeasonIfNeeded(): Promise<void> {
  const seasons = await getSeasons();
  if (seasons.length > 0) return;
  const farms = await getFarms();
  const farmId = farms[0]?.id || FARM_SEED.id;
  const now = new Date().toISOString();
  const sA = SECTIONS_SEED[0];
  const sB = SECTIONS_SEED[1];

  const season: SeasonRecord = {
    id: SEASON_SEED.id,
    farm_id: farmId,
    season_number: 1,
    season_name: SEASON_SEED.season_name,
    season_type: SEASON_SEED.season_type,
    status: "active",
    template_id: CROP_TEMPLATES[0]?.id || "",
    section_a: {
      variety: sA.variety,
      planting_date: sA.planting_date,
      acres: sA.acres,
      blight_risk: sA.blight_risk as "LOW" | "MEDIUM" | "HIGH",
      notes: sA.notes ?? null,
    },
    section_b: {
      variety: sB.variety,
      planting_date: sB.planting_date,
      acres: sB.acres,
      blight_risk: sB.blight_risk as "LOW" | "MEDIUM" | "HIGH",
      notes: sB.notes ?? null,
    },
    pre_planting_start_date: null,
    total_revenue_kes: null,
    total_cost_kes: null,
    notes: null,
    created_at: now,
    closed_at: null,
  };

  await supabase.from("seasons").insert(season);
  await supabase.from("app_meta").upsert([
    { key: "active_season_id", value: season.id },
  ]);
}

export async function getFarms(): Promise<FarmRecord[]> {
  const { data, error } = await supabase
    .from("farms")
    .select("*")
    .order("created_at");
  if (error) throw error;
  return data || [];
}

export async function getActiveFarmRecord(): Promise<FarmRecord | null> {
  const [{ data: meta }, farms] = await Promise.all([
    supabase.from("app_meta").select("value").eq("key", "active_farm_id").maybeSingle(),
    getFarms(),
  ]);
  const id = meta?.value;
  return farms.find((f) => f.id === id) || farms[0] || null;
}

export async function getSeasons(): Promise<SeasonRecord[]> {
  const { data, error } = await supabase
    .from("seasons")
    .select("*")
    .order("created_at");
  if (error) throw error;
  return (data || []) as SeasonRecord[];
}

export async function getActiveSeason(): Promise<SeasonRecord | null> {
  const [{ data: meta }, seasons] = await Promise.all([
    supabase.from("app_meta").select("value").eq("key", "active_season_id").maybeSingle(),
    getSeasons(),
  ]);
  const id = meta?.value;
  return (seasons.find((s) => s.id === id) || seasons[0] || null) as SeasonRecord | null;
}

export async function getCosts(): Promise<CostEntry[]> {
  const { data, error } = await supabase
    .from("costs")
    .select("*")
    .order("created_at");
  if (error) throw error;
  return data || [];
}

export async function getInventory(): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from("inventory")
    .select("*")
    .order("created_at");
  if (error) throw error;
  return data || [];
}

export async function getActivityLogs(): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from("activity_logs")
    .select("*")
    .order("created_at");
  if (error) throw error;
  return (data || []) as ActivityLog[];
}

export async function getObservations(): Promise<ObservationRecord[]> {
  const { data, error } = await supabase
    .from("observations")
    .select("*")
    .order("created_at");
  if (error) throw error;
  return data || [];
}

export async function getHarvestRecords(): Promise<HarvestRecord[]> {
  const { data, error } = await supabase
    .from("harvest_records")
    .select("*")
    .order("created_at");
  if (error) throw error;
  return data || [];
}

export async function addFarmRecord(
  farm: Omit<FarmRecord, "id" | "created_at">
): Promise<FarmRecord> {
  const record = { ...farm, id: genId(), created_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from("farms")
    .insert(record)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateFarmRecord(
  id: string,
  updates: Partial<FarmRecord>
): Promise<FarmRecord> {
  const { data, error } = await supabase
    .from("farms")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setActiveFarmId(id: string): Promise<void> {
  await supabase
    .from("app_meta")
    .upsert({ key: "active_farm_id", value: id });
}

export async function addSeason(
  season: Omit<SeasonRecord, "id" | "created_at">
): Promise<SeasonRecord> {
  const record = { ...season, id: genId(), created_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from("seasons")
    .insert(record)
    .select()
    .single();
  if (error) throw error;
  return data as SeasonRecord;
}

export async function updateSeason(
  id: string,
  updates: Partial<SeasonRecord>
): Promise<SeasonRecord> {
  const { data, error } = await supabase
    .from("seasons")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as SeasonRecord;
}

export async function setActiveSeasonId(id: string): Promise<void> {
  await supabase
    .from("app_meta")
    .upsert({ key: "active_season_id", value: id });
}

export async function closeSeason(id: string): Promise<SeasonRecord> {
  return updateSeason(id, {
    status: "closed",
    closed_at: new Date().toISOString(),
  });
}

export async function reopenSeason(id: string): Promise<SeasonRecord> {
  return updateSeason(id, { status: "active", closed_at: null });
}

export async function addCost(
  cost: Omit<CostEntry, "id" | "created_at">
): Promise<CostEntry> {
  const record = { ...cost, id: genId(), created_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from("costs")
    .insert(record)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function addInventoryItem(
  item: Omit<InventoryItem, "id" | "created_at">
): Promise<InventoryItem> {
  const record = { ...item, id: genId(), created_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from("inventory")
    .insert(record)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function addActivityLog(
  entry: Omit<ActivityLog, "id" | "created_at">
): Promise<ActivityLog> {
  const record = { ...entry, id: genId(), created_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from("activity_logs")
    .insert(record)
    .select()
    .single();
  if (error) throw error;
  return data as ActivityLog;
}

export async function addFieldObservation(
  entry: Omit<ObservationRecord, "id" | "created_at">
): Promise<ObservationRecord> {
  const record = { ...entry, id: genId(), created_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from("observations")
    .insert(record)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function addHarvestRecord(
  entry: Omit<HarvestRecord, "id" | "created_at">
): Promise<HarvestRecord> {
  const record = { ...entry, id: genId(), created_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from("harvest_records")
    .insert(record)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCost(id: string): Promise<void> {
  const { error } = await supabase.from("costs").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteInventoryItem(id: string): Promise<void> {
  const { error } = await supabase.from("inventory").delete().eq("id", id);
  if (error) throw error;
}

export async function updateActivityLog(
  id: string,
  updates: Partial<ActivityLog>
): Promise<ActivityLog> {
  const { data, error } = await supabase
    .from("activity_logs")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as ActivityLog;
}

export async function deleteActivityLog(id: string): Promise<void> {
  const { error } = await supabase.from("activity_logs").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteObservation(id: string): Promise<void> {
  const { error } = await supabase.from("observations").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteHarvestRecord(id: string): Promise<void> {
  const { error } = await supabase
    .from("harvest_records")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export function getDaysSincePlanting(plantingDate: string): number {
  const planted = new Date(plantingDate);
  const today = new Date();
  return Math.floor(
    (today.getTime() - planted.getTime()) / (1000 * 60 * 60 * 24)
  );
}

export function getDaysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const today = new Date();
  return Math.floor(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}

export function getGrowthStage(plantingDate: string): string {
  const days = getDaysSincePlanting(plantingDate);
  if (days < 0) return "Pre-Planting";
  if (days < 14) return "Germination — Days 0–14";
  if (days < 28) return "Emergence — Days 14–28";
  if (days < 44) return "Vegetative — Days 28–44";
  if (days < 58) return "Flowering & Bulking — Days 44–58";
  if (days < 70) return "Maturation — Days 58–70";
  return "Ready for Harvest — Day 70+";
}

export function formatKES(amount: number): string {
  return "KES " + amount.toLocaleString("en-KE");
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
