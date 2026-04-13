import AsyncStorage from "@react-native-async-storage/async-storage";
import { INVENTORY_MASTER, SECTIONS_SEED, FARM_SEED, SEASON_SEED } from "@/constants/farmData";

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

const KEYS = {
  COSTS: "farm_costs",
  INVENTORY: "farm_inventory",
  ACTIVITY_LOGS: "farm_activity_logs",
  OBSERVATIONS: "farm_observations",
  HARVEST: "farm_harvest",
  SEEDED: "farm_seeded",
};

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

export async function seedIfNeeded(): Promise<void> {
  const seeded = await AsyncStorage.getItem(KEYS.SEEDED);
  if (seeded) return;

  const today = new Date().toISOString().split("T")[0];
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
