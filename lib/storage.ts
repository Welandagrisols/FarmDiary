import AsyncStorage from "@react-native-async-storage/async-storage";
import { INVENTORY_MASTER, SECTIONS_SEED, FARM_SEED, SEASON_SEED, generatePlannedSchedule, CROP_TEMPLATES } from "@/constants/farmData";

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

export interface FieldObservation {
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

export interface SeasonSection {
  variety: string;
  planting_date: string;
  acres: number;
  blight_risk: "LOW" | "MEDIUM" | "HIGH";
  notes: string | null;
}

export interface SeasonRecord {
  id: string;
  farm_id: string;
  season_number: number;
  season_name: string;
  season_type: string;
  status: "planning" | "active" | "closed";
  template_id: string;
  section_a: SeasonSection;
  section_b: SeasonSection;
  pre_planting_start_date: string | null;
  total_revenue_kes: number | null;
  total_cost_kes: number | null;
  notes: string | null;
  created_at: string;
  closed_at: string | null;
}

const KEYS = {
  COSTS: "farm_costs",
  INVENTORY: "farm_inventory",
  ACTIVITY_LOGS: "farm_activity_logs",
  OBSERVATIONS: "farm_observations",
  HARVEST: "farm_harvest",
  SEEDED: "farm_seeded",
  SEASONS: "farm_seasons",
  ACTIVE_SEASON_ID: "farm_active_season_id",
  FARMS: "farm_farms",
  ACTIVE_FARM_ID: "farm_active_farm_id",
};

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

export async function seedIfNeeded(): Promise<void> {
  const seeded = await AsyncStorage.getItem(KEYS.SEEDED);
  if (seeded) return;

  const today = new Date().toISOString().split("T")[0];

  const defaultFarm: FarmRecord = {
    id: FARM_SEED.id,
    name: FARM_SEED.name,
    location: FARM_SEED.location,
    total_acres: FARM_SEED.total_acres,
    lease_status: FARM_SEED.lease_status,
    crop_type: "Potato",
    notes: null,
    created_at: new Date().toISOString(),
  };

  const existingFarms = await AsyncStorage.getItem(KEYS.FARMS);
  if (!existingFarms || JSON.parse(existingFarms).length === 0) {
    await AsyncStorage.setItem(KEYS.FARMS, JSON.stringify([defaultFarm]));
    await AsyncStorage.setItem(KEYS.ACTIVE_FARM_ID, FARM_SEED.id);
  }

  const inventory: InventoryItem[] = INVENTORY_MASTER.map((item) => ({
    id: genId(),
    farm_id: FARM_SEED.id,
    season_id: SEASON_SEED.id,
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
    created_at: new Date().toISOString(),
  }));

  await AsyncStorage.setItem(KEYS.INVENTORY, JSON.stringify(inventory));
  await AsyncStorage.setItem(KEYS.COSTS, JSON.stringify([]));
  await AsyncStorage.setItem(KEYS.ACTIVITY_LOGS, JSON.stringify([]));
  await AsyncStorage.setItem(KEYS.OBSERVATIONS, JSON.stringify([]));
  await AsyncStorage.setItem(KEYS.SEEDED, "true");
}

export async function seedSeasonIfNeeded(): Promise<void> {
  const existing = await AsyncStorage.getItem(KEYS.SEASONS);
  if (existing && JSON.parse(existing).length > 0) return;

  const season1: SeasonRecord = {
    id: "season-001",
    farm_id: FARM_SEED.id,
    season_number: 1,
    season_name: "Long Rains 2026",
    season_type: "Long Rains",
    status: "active",
    template_id: CROP_TEMPLATES[0].id,
    section_a: {
      variety: "Stephen's",
      planting_date: SECTIONS_SEED[0].planting_date,
      acres: SECTIONS_SEED[0].acres,
      blight_risk: "HIGH",
      notes: SECTIONS_SEED[0].notes,
    },
    section_b: {
      variety: "Shangi",
      planting_date: SECTIONS_SEED[1].planting_date,
      acres: SECTIONS_SEED[1].acres,
      blight_risk: "MEDIUM",
      notes: SECTIONS_SEED[1].notes,
    },
    pre_planting_start_date: "2026-02-01",
    total_revenue_kes: null,
    total_cost_kes: null,
    notes: "Original Season 1 — Long Rains 2026",
    created_at: new Date().toISOString(),
    closed_at: null,
  };

  await AsyncStorage.setItem(KEYS.SEASONS, JSON.stringify([season1]));
  await AsyncStorage.setItem(KEYS.ACTIVE_SEASON_ID, "season-001");
}

// ── Farm CRUD ──────────────────────────────────────────────────────────────────

export async function getFarms(): Promise<FarmRecord[]> {
  const data = await AsyncStorage.getItem(KEYS.FARMS);
  return data ? JSON.parse(data) : [];
}

export async function getActiveFarmId(): Promise<string> {
  const id = await AsyncStorage.getItem(KEYS.ACTIVE_FARM_ID);
  return id || FARM_SEED.id;
}

export async function getActiveFarmRecord(): Promise<FarmRecord | null> {
  const farms = await getFarms();
  const activeId = await getActiveFarmId();
  return farms.find((f) => f.id === activeId) || farms[0] || null;
}

export async function addFarmRecord(farm: Omit<FarmRecord, "id" | "created_at">): Promise<FarmRecord> {
  const farms = await getFarms();
  const newFarm: FarmRecord = {
    ...farm,
    id: genId(),
    created_at: new Date().toISOString(),
  };
  farms.push(newFarm);
  await AsyncStorage.setItem(KEYS.FARMS, JSON.stringify(farms));
  return newFarm;
}

export async function updateFarmRecord(id: string, updates: Partial<FarmRecord>): Promise<FarmRecord> {
  const farms = await getFarms();
  const idx = farms.findIndex((f) => f.id === id);
  if (idx < 0) throw new Error("Farm not found");
  farms[idx] = { ...farms[idx], ...updates };
  await AsyncStorage.setItem(KEYS.FARMS, JSON.stringify(farms));
  return farms[idx];
}

export async function setActiveFarmId(id: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.ACTIVE_FARM_ID, id);
}

// ── Seasons ────────────────────────────────────────────────────────────────────

export async function getSeasons(): Promise<SeasonRecord[]> {
  const data = await AsyncStorage.getItem(KEYS.SEASONS);
  return data ? JSON.parse(data) : [];
}

export async function getActiveSeasonId(): Promise<string> {
  const id = await AsyncStorage.getItem(KEYS.ACTIVE_SEASON_ID);
  return id || "season-001";
}

export async function getActiveSeason(): Promise<SeasonRecord | null> {
  const seasons = await getSeasons();
  const activeId = await getActiveSeasonId();
  return seasons.find((s) => s.id === activeId) || null;
}

export async function addSeason(season: Omit<SeasonRecord, "id" | "created_at">): Promise<SeasonRecord> {
  const seasons = await getSeasons();
  const newSeason: SeasonRecord = {
    ...season,
    id: genId(),
    created_at: new Date().toISOString(),
  };
  seasons.push(newSeason);
  await AsyncStorage.setItem(KEYS.SEASONS, JSON.stringify(seasons));
  return newSeason;
}

export async function updateSeason(id: string, updates: Partial<SeasonRecord>): Promise<SeasonRecord> {
  const seasons = await getSeasons();
  const idx = seasons.findIndex((s) => s.id === id);
  if (idx < 0) throw new Error("Season not found");
  seasons[idx] = { ...seasons[idx], ...updates };
  await AsyncStorage.setItem(KEYS.SEASONS, JSON.stringify(seasons));
  return seasons[idx];
}

export async function setActiveSeasonId(id: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.ACTIVE_SEASON_ID, id);
}

export async function closeSeason(id: string): Promise<SeasonRecord> {
  return updateSeason(id, {
    status: "closed",
    closed_at: new Date().toISOString(),
  });
}

// ── Costs ──────────────────────────────────────────────────────────────────────

export async function getCosts(): Promise<CostEntry[]> {
  const data = await AsyncStorage.getItem(KEYS.COSTS);
  return data ? JSON.parse(data) : [];
}

export async function addCost(cost: Omit<CostEntry, "id" | "created_at">): Promise<CostEntry> {
  const costs = await getCosts();
  const newCost: CostEntry = {
    ...cost,
    id: genId(),
    created_at: new Date().toISOString(),
  };
  costs.push(newCost);
  await AsyncStorage.setItem(KEYS.COSTS, JSON.stringify(costs));
  return newCost;
}

export async function updateCost(id: string, updates: Partial<CostEntry>): Promise<void> {
  const costs = await getCosts();
  const idx = costs.findIndex((c) => c.id === id);
  if (idx >= 0) {
    costs[idx] = { ...costs[idx], ...updates };
    await AsyncStorage.setItem(KEYS.COSTS, JSON.stringify(costs));
  }
}

export async function deleteCost(id: string): Promise<void> {
  const costs = await getCosts();
  await AsyncStorage.setItem(KEYS.COSTS, JSON.stringify(costs.filter((c) => c.id !== id)));
}

// ── Inventory ──────────────────────────────────────────────────────────────────

export async function getInventory(): Promise<InventoryItem[]> {
  const data = await AsyncStorage.getItem(KEYS.INVENTORY);
  return data ? JSON.parse(data) : [];
}

export async function addInventoryItem(item: Omit<InventoryItem, "id" | "created_at">): Promise<InventoryItem> {
  const inventory = await getInventory();
  const newItem: InventoryItem = {
    ...item,
    id: genId(),
    created_at: new Date().toISOString(),
  };
  inventory.push(newItem);
  await AsyncStorage.setItem(KEYS.INVENTORY, JSON.stringify(inventory));
  return newItem;
}

export async function updateInventoryUsage(productName: string, qtyUsed: number): Promise<void> {
  const inventory = await getInventory();
  const idx = inventory.findIndex((i) => i.product_name.toLowerCase() === productName.toLowerCase());
  if (idx >= 0) {
    inventory[idx].quantity_used = (inventory[idx].quantity_used || 0) + qtyUsed;
    await AsyncStorage.setItem(KEYS.INVENTORY, JSON.stringify(inventory));
  }
}

export async function deleteInventoryItem(id: string): Promise<void> {
  const inventory = await getInventory();
  await AsyncStorage.setItem(KEYS.INVENTORY, JSON.stringify(inventory.filter((i) => i.id !== id)));
}

// ── Activity Logs ──────────────────────────────────────────────────────────────

export async function getActivityLogs(): Promise<ActivityLog[]> {
  const data = await AsyncStorage.getItem(KEYS.ACTIVITY_LOGS);
  return data ? JSON.parse(data) : [];
}

export async function addActivityLog(log: Omit<ActivityLog, "id" | "created_at">): Promise<ActivityLog> {
  const logs = await getActivityLogs();
  const newLog: ActivityLog = {
    ...log,
    id: genId(),
    created_at: new Date().toISOString(),
  };
  logs.push(newLog);
  await AsyncStorage.setItem(KEYS.ACTIVITY_LOGS, JSON.stringify(logs));
  return newLog;
}

export async function updateActivityLog(id: string, updates: Partial<Omit<ActivityLog, "id" | "created_at">>): Promise<ActivityLog> {
  const logs = await getActivityLogs();
  const idx = logs.findIndex((l) => l.id === id);
  if (idx < 0) throw new Error("Activity log not found");
  logs[idx] = { ...logs[idx], ...updates };
  await AsyncStorage.setItem(KEYS.ACTIVITY_LOGS, JSON.stringify(logs));
  return logs[idx];
}

export async function deleteActivityLog(id: string): Promise<void> {
  const logs = await getActivityLogs();
  await AsyncStorage.setItem(KEYS.ACTIVITY_LOGS, JSON.stringify(logs.filter((l) => l.id !== id)));
}

// ── Observations ───────────────────────────────────────────────────────────────

export async function getObservations(): Promise<FieldObservation[]> {
  const data = await AsyncStorage.getItem(KEYS.OBSERVATIONS);
  return data ? JSON.parse(data) : [];
}

export async function addObservation(obs: Omit<FieldObservation, "id" | "created_at">): Promise<FieldObservation> {
  const observations = await getObservations();
  const newObs: FieldObservation = {
    ...obs,
    id: genId(),
    created_at: new Date().toISOString(),
  };
  observations.push(newObs);
  await AsyncStorage.setItem(KEYS.OBSERVATIONS, JSON.stringify(observations));
  return newObs;
}

export async function deleteObservation(id: string): Promise<void> {
  const observations = await getObservations();
  await AsyncStorage.setItem(KEYS.OBSERVATIONS, JSON.stringify(observations.filter((o) => o.id !== id)));
}

// ── Harvest ────────────────────────────────────────────────────────────────────

export async function getHarvestRecords(): Promise<HarvestRecord[]> {
  const data = await AsyncStorage.getItem(KEYS.HARVEST);
  return data ? JSON.parse(data) : [];
}

export async function addHarvestRecord(record: Omit<HarvestRecord, "id" | "created_at">): Promise<HarvestRecord> {
  const records = await getHarvestRecords();
  const newRecord: HarvestRecord = {
    ...record,
    id: genId(),
    created_at: new Date().toISOString(),
  };
  records.push(newRecord);
  await AsyncStorage.setItem(KEYS.HARVEST, JSON.stringify(records));
  return newRecord;
}

export async function deleteHarvestRecord(id: string): Promise<void> {
  const records = await getHarvestRecords();
  await AsyncStorage.setItem(KEYS.HARVEST, JSON.stringify(records.filter((r) => r.id !== id)));
}

// ── Utilities ──────────────────────────────────────────────────────────────────

export function getGrowthStage(plantingDate: string): string {
  const planted = new Date(plantingDate);
  const today = new Date();
  const daysSincePlanting = Math.floor((today.getTime() - planted.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSincePlanting < 0) return "Pre-Planting";
  if (daysSincePlanting < 18) return "Pre-Emergence";
  if (daysSincePlanting < 40) return "Stage 1 — Emergence";
  if (daysSincePlanting < 60) return "Stage 2 — Vegetative";
  if (daysSincePlanting < 80) return "Stage 3 — Flowering & Bulking";
  if (daysSincePlanting < 95) return "Maturation";
  return "Harvest";
}

export function getDaysSincePlanting(plantingDate: string): number {
  const planted = new Date(plantingDate);
  const today = new Date();
  return Math.floor((today.getTime() - planted.getTime()) / (1000 * 60 * 60 * 24));
}

export function getDaysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatKES(amount: number): string {
  return "KES " + amount.toLocaleString("en-KE");
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function isPrePlanting(dateStr: string, plantingDate: string): boolean {
  return new Date(dateStr) < new Date(plantingDate);
}
