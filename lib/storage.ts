import AsyncStorage from "@react-native-async-storage/async-storage";
import { INVENTORY_MASTER, FARM_SEED, SEASON_SEED, generatePlannedSchedule } from "@/constants/farmData";

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
  section_a: { variety: string; planting_date: string; acres: number; blight_risk: "LOW" | "MEDIUM" | "HIGH"; notes: string | null };
  section_b: { variety: string; planting_date: string; acres: number; blight_risk: "LOW" | "MEDIUM" | "HIGH"; notes: string | null };
  pre_planting_start_date: string | null;
  budget_kes: number | null;
  total_revenue_kes: number | null;
  total_cost_kes: number | null;
  notes: string | null;
  created_at: string;
  closed_at: string | null;
}

export interface PersonalExpense {
  id: string;
  farm_id: string;
  season_id: string;
  category: string;
  subcategory: string;
  description: string;
  expense_date: string;
  amount_kes: number;
  visitor_name: string | null;
  visitor_role: string | null;
  trip_from: string | null;
  trip_to: string | null;
  receipt_reference: string | null;
  notes: string | null;
  created_at: string;
}

export const PERSONAL_EXPENSE_CATEGORIES: Record<string, string[]> = {
  "Meals & Food": ["Breakfast", "Lunch", "Dinner", "Snacks", "Groceries", "Water & Drinks"],
  "Accommodation": ["Rent", "Utilities", "House Deposit"],
  "Household Setup": ["Bedding & Furniture", "Kitchen Equipment", "Gas Cylinder", "Cleaning Supplies"],
  "Personal Care": ["Hygiene Products", "Laundry", "Clothing", "Personal Items"],
  "Health & Medication": ["Prescription Medicine", "OTC Medicine", "First Aid", "Medical Consultation"],
  "Protective Gear": ["Masks / Respirators", "Gumboots", "Raincoat", "Gloves", "Overalls / Aprons", "Safety Glasses"],
  "Farm Transport": ["Home → Farm", "Farm → Home", "Within Farm Area", "Fuel", "Motorbike / Boda-boda", "Public Transport"],
  "Stakeholder Visits": ["Investor / Partner Visit", "Agronomist / Extension Visit", "Supplier Visit", "Guest / Friend Visit"],
  "Other": ["Phone & Airtime", "Banking Fees", "Miscellaneous"],
};

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
  PERSONAL_EXPENSES: "farm_personal_expenses",
};

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const data = await AsyncStorage.getItem(key);
  return data ? JSON.parse(data) : fallback;
}

async function writeJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function seedIfNeeded(): Promise<void> {
  const seeded = await AsyncStorage.getItem(KEYS.SEEDED);
  if (seeded) return;
  const today = new Date().toISOString().split("T")[0];
  const farm: FarmRecord = { ...FARM_SEED, crop_type: "Potato", notes: null, created_at: new Date().toISOString() };
  const season: SeasonRecord = { id: SEASON_SEED.id, farm_id: FARM_SEED.id, season_number: 1, season_name: SEASON_SEED.name, season_type: SEASON_SEED.type, status: "active", template_id: SEASON_SEED.templateId, section_a: { variety: SEASON_SEED.section_a.variety, planting_date: SEASON_SEED.section_a.planting_date, acres: SEASON_SEED.section_a.acres, blight_risk: SEASON_SEED.section_a.blight_risk, notes: null }, section_b: { variety: SEASON_SEED.section_b.variety, planting_date: SEASON_SEED.section_b.planting_date, acres: SEASON_SEED.section_b.acres, blight_risk: SEASON_SEED.section_b.blight_risk, notes: null }, pre_planting_start_date: null, budget_kes: null, total_revenue_kes: null, total_cost_kes: null, notes: null, created_at: new Date().toISOString(), closed_at: null };
  const inventory: InventoryItem[] = INVENTORY_MASTER.map((item) => ({ id: genId(), farm_id: farm.id, season_id: season.id, product_name: item.product, category: item.category, quantity_purchased: item.qty, unit: item.unit, unit_price_kes: item.unitPrice, quantity_used: 0, purchase_date: today, supplier: null, low_stock_threshold: null, is_historical: false, notes: null, created_at: new Date().toISOString() }));
  await writeJson(KEYS.FARMS, [farm]);
  await writeJson(KEYS.SEASONS, [season]);
  await writeJson(KEYS.INVENTORY, inventory);
  await writeJson(KEYS.COSTS, []);
  await writeJson(KEYS.ACTIVITY_LOGS, []);
  await writeJson(KEYS.OBSERVATIONS, []);
  await writeJson(KEYS.HARVEST, []);
  await AsyncStorage.setItem(KEYS.ACTIVE_FARM_ID, farm.id);
  await AsyncStorage.setItem(KEYS.ACTIVE_SEASON_ID, season.id);
  await AsyncStorage.setItem(KEYS.SEEDED, "true");
}

export async function seedSeasonIfNeeded(): Promise<void> {
  const seasons = await getSeasons();
  if (seasons.length > 0) return;
  const farms = await getFarms();
  const farmId = farms[0]?.id || FARM_SEED.id;
  const season: SeasonRecord = { id: SEASON_SEED.id, farm_id: farmId, season_number: 1, season_name: SEASON_SEED.name, season_type: SEASON_SEED.type, status: "active", template_id: SEASON_SEED.templateId, section_a: { variety: SEASON_SEED.section_a.variety, planting_date: SEASON_SEED.section_a.planting_date, acres: SEASON_SEED.section_a.acres, blight_risk: SEASON_SEED.section_a.blight_risk, notes: null }, section_b: { variety: SEASON_SEED.section_b.variety, planting_date: SEASON_SEED.section_b.planting_date, acres: SEASON_SEED.section_b.acres, blight_risk: SEASON_SEED.section_b.blight_risk, notes: null }, pre_planting_start_date: null, budget_kes: null, total_revenue_kes: null, total_cost_kes: null, notes: null, created_at: new Date().toISOString(), closed_at: null };
  await writeJson(KEYS.SEASONS, [season]);
  await AsyncStorage.setItem(KEYS.ACTIVE_SEASON_ID, season.id);
}

export async function getFarms(): Promise<FarmRecord[]> { return readJson(KEYS.FARMS, []); }
export async function getActiveFarmRecord(): Promise<FarmRecord | null> { const farms = await getFarms(); const id = await AsyncStorage.getItem(KEYS.ACTIVE_FARM_ID); return farms.find((f) => f.id === id) || farms[0] || null; }
export async function getSeasons(): Promise<SeasonRecord[]> { return readJson(KEYS.SEASONS, []); }
export async function getActiveSeason(): Promise<SeasonRecord | null> { const seasons = await getSeasons(); const id = await AsyncStorage.getItem(KEYS.ACTIVE_SEASON_ID); return seasons.find((s) => s.id === id) || seasons[0] || null; }
export async function getCosts(): Promise<CostEntry[]> { return readJson(KEYS.COSTS, []); }
export async function getInventory(): Promise<InventoryItem[]> { return readJson(KEYS.INVENTORY, []); }
export async function getActivityLogs(): Promise<ActivityLog[]> { return readJson(KEYS.ACTIVITY_LOGS, []); }
export async function getObservations(): Promise<ObservationRecord[]> { return readJson(KEYS.OBSERVATIONS, []); }
export async function getHarvestRecords(): Promise<HarvestRecord[]> { return readJson(KEYS.HARVEST, []); }

export async function addFarmRecord(farm: Omit<FarmRecord, "id" | "created_at">): Promise<FarmRecord> { const farms = await getFarms(); const record = { ...farm, id: genId(), created_at: new Date().toISOString() }; farms.push(record); await writeJson(KEYS.FARMS, farms); return record; }
export async function updateFarmRecord(id: string, updates: Partial<FarmRecord>): Promise<FarmRecord> { const farms = await getFarms(); const idx = farms.findIndex((f) => f.id === id); if (idx < 0) throw new Error("Farm not found"); farms[idx] = { ...farms[idx], ...updates }; await writeJson(KEYS.FARMS, farms); return farms[idx]; }
export async function setActiveFarmId(id: string): Promise<void> { await AsyncStorage.setItem(KEYS.ACTIVE_FARM_ID, id); }

export async function addSeason(season: Omit<SeasonRecord, "id" | "created_at">): Promise<SeasonRecord> { const seasons = await getSeasons(); const record = { ...season, id: genId(), created_at: new Date().toISOString() }; seasons.push(record); await writeJson(KEYS.SEASONS, seasons); return record; }
export async function updateSeason(id: string, updates: Partial<SeasonRecord>): Promise<SeasonRecord> { const seasons = await getSeasons(); const idx = seasons.findIndex((s) => s.id === id); if (idx < 0) throw new Error("Season not found"); seasons[idx] = { ...seasons[idx], ...updates }; await writeJson(KEYS.SEASONS, seasons); return seasons[idx]; }
export async function setActiveSeasonId(id: string): Promise<void> { await AsyncStorage.setItem(KEYS.ACTIVE_SEASON_ID, id); }
export async function closeSeason(id: string): Promise<SeasonRecord> { return updateSeason(id, { status: "closed", closed_at: new Date().toISOString() }); }
export async function reopenSeason(id: string): Promise<SeasonRecord> { return updateSeason(id, { status: "active", closed_at: null }); }

export async function addCost(cost: Omit<CostEntry, "id" | "created_at">): Promise<CostEntry> { const items = await getCosts(); const record = { ...cost, id: genId(), created_at: new Date().toISOString() }; items.push(record); await writeJson(KEYS.COSTS, items); return record; }
export async function addInventoryItem(item: Omit<InventoryItem, "id" | "created_at">): Promise<InventoryItem> { const items = await getInventory(); const record = { ...item, id: genId(), created_at: new Date().toISOString() }; items.push(record); await writeJson(KEYS.INVENTORY, items); return record; }
export async function addActivityLog(entry: Omit<ActivityLog, "id" | "created_at">): Promise<ActivityLog> { const items = await getActivityLogs(); const record = { ...entry, id: genId(), created_at: new Date().toISOString() }; items.push(record); await writeJson(KEYS.ACTIVITY_LOGS, items); return record; }
export async function addFieldObservation(entry: Omit<ObservationRecord, "id" | "created_at">): Promise<ObservationRecord> { const items = await getObservations(); const record = { ...entry, id: genId(), created_at: new Date().toISOString() }; items.push(record); await writeJson(KEYS.OBSERVATIONS, items); return record; }
export async function addHarvestRecord(entry: Omit<HarvestRecord, "id" | "created_at">): Promise<HarvestRecord> { const items = await getHarvestRecords(); const record = { ...entry, id: genId(), created_at: new Date().toISOString() }; items.push(record); await writeJson(KEYS.HARVEST, items); return record; }

export async function deleteCost(id: string): Promise<void> { await writeJson(KEYS.COSTS, (await getCosts()).filter((item) => item.id !== id)); }
export async function deleteInventoryItem(id: string): Promise<void> { await writeJson(KEYS.INVENTORY, (await getInventory()).filter((item) => item.id !== id)); }
export async function deleteActivityLog(id: string): Promise<void> { await writeJson(KEYS.ACTIVITY_LOGS, (await getActivityLogs()).filter((item) => item.id !== id)); }
export async function deleteObservation(id: string): Promise<void> { await writeJson(KEYS.OBSERVATIONS, (await getObservations()).filter((item) => item.id !== id)); }
export async function deleteHarvestRecord(id: string): Promise<void> { await writeJson(KEYS.HARVEST, (await getHarvestRecords()).filter((item) => item.id !== id)); }

export function formatKES(amount: number): string { return "KES " + amount.toLocaleString("en-KE"); }
export function formatDate(dateStr: string): string { return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }
export function isPrePlanting(costDate: string, plantingDate: string): boolean { return costDate < plantingDate; }

export async function getPersonalExpenses(): Promise<PersonalExpense[]> { return readJson(KEYS.PERSONAL_EXPENSES, []); }
export async function addPersonalExpense(expense: Omit<PersonalExpense, "id" | "created_at">): Promise<PersonalExpense> { const items = await getPersonalExpenses(); const record = { ...expense, id: genId(), created_at: new Date().toISOString() }; items.push(record); await writeJson(KEYS.PERSONAL_EXPENSES, items); return record; }
export async function deletePersonalExpense(id: string): Promise<void> { await writeJson(KEYS.PERSONAL_EXPENSES, (await getPersonalExpenses()).filter((item) => item.id !== id)); }

export function getDaysUntil(dateStr: string): number {
  if (!dateStr) return 999;
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function getDaysSincePlanting(plantingDate: string): number {
  if (!plantingDate) return 0;
  const planted = new Date(plantingDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  planted.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today.getTime() - planted.getTime()) / (1000 * 60 * 60 * 24)));
}

export function getGrowthStage(plantingDate: string): string {
  const days = getDaysSincePlanting(plantingDate);
  if (days < 7)   return "Emergence — Sprouting underway";
  if (days < 21)  return "Seedling — Early leaf development";
  if (days < 42)  return "Vegetative — Canopy closing";
  if (days < 63)  return "Tuber Initiation — Stolons forming";
  if (days < 84)  return "Tuber Bulking — Rapid size gain";
  if (days < 100) return "Maturation — Skin setting";
  return "Ready — Harvest window open";
}
