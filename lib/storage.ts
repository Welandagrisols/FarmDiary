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

  const defaultSeason: SeasonRecord = {
    id: SEASON_SEED.id,
    farm_id: FARM_SEED.id,
    season_number: 1,
    season_name: SEASON_SEED.name,
    season_type: SEASON_SEED.type,
    status: "active",
    template_id: SEASON_SEED.templateId,
    section_a: {
      variety: SEASON_SEED.section_a.variety,
      planting_date: SEASON_SEED.section_a.planting_date,
      acres: SEASON_SEED.section_a.acres,
      blight_risk: SEASON_SEED.section_a.blight_risk,
      notes: null,
    },
    section_b: {
      variety: SEASON_SEED.section_b.variety,
      planting_date: SEASON_SEED.section_b.planting_date,
      acres: SEASON_SEED.section_b.acres,
      blight_risk: SEASON_SEED.section_b.blight_risk,
      notes: null,
    },
    pre_planting_start_date: null,
    total_revenue_kes: null,
    total_cost_kes: null,
    notes: null,
    created_at: new Date().toISOString(),
    closed_at: null,
  };

  await AsyncStorage.setItem(KEYS.SEASONS, JSON.stringify([defaultSeason]));
  await AsyncStorage.setItem(KEYS.ACTIVE_SEASON_ID, SEASON_SEED.id);
}

export async function getSeasons(): Promise<SeasonRecord[]> {
  const data = await AsyncStorage.getItem(KEYS.SEASONS);
  return data ? JSON.parse(data) : [];
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

export async function reopenSeason(id: string): Promise<SeasonRecord> {
  return updateSeason(id, {
    status: "active",
    closed_at: null,
  });
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
