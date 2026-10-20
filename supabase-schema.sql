-- Farm Diary — Supabase Schema
-- Run this in your Supabase project's SQL Editor (https://supabase.com/dashboard)

CREATE TABLE IF NOT EXISTS farms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  total_acres NUMERIC NOT NULL,
  lease_status TEXT NOT NULL,
  crop_type TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seasons (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  season_number INTEGER NOT NULL DEFAULT 1,
  season_name TEXT NOT NULL,
  season_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planning',
  template_id TEXT NOT NULL DEFAULT '',
  section_a JSONB NOT NULL DEFAULT '{}',
  section_b JSONB NOT NULL DEFAULT '{}',
  pre_planting_start_date TEXT,
  total_revenue_kes NUMERIC,
  total_cost_kes NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS costs (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  season_id TEXT NOT NULL,
  section_id TEXT,
  cost_category TEXT NOT NULL,
  cost_subcategory TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL,
  cost_date TEXT NOT NULL,
  is_pre_planting BOOLEAN NOT NULL DEFAULT false,
  is_historical BOOLEAN NOT NULL DEFAULT false,
  amount_kes NUMERIC NOT NULL,
  quantity NUMERIC,
  unit TEXT,
  unit_price_kes NUMERIC,
  product_name TEXT,
  supplier TEXT,
  receipt_reference TEXT,
  num_workers INTEGER,
  days_worked INTEGER,
  rate_per_worker_per_day NUMERIC,
  facilitator_name TEXT,
  trip_from TEXT,
  trip_to TEXT,
  is_deviation BOOLEAN NOT NULL DEFAULT false,
  planned_product TEXT,
  deviation_reason TEXT,
  notes TEXT,
  weather_conditions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  season_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity_purchased NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  unit_price_kes NUMERIC NOT NULL,
  quantity_used NUMERIC NOT NULL DEFAULT 0,
  purchase_date TEXT NOT NULL,
  supplier TEXT,
  low_stock_threshold NUMERIC,
  is_historical BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  season_id TEXT NOT NULL,
  section_id TEXT,
  schedule_activity_id TEXT,
  activity_name TEXT NOT NULL,
  planned_date TEXT,
  actual_date TEXT NOT NULL,
  products_used JSONB NOT NULL DEFAULT '[]',
  is_deviation BOOLEAN NOT NULL DEFAULT false,
  deviation_reason TEXT,
  num_workers INTEGER NOT NULL DEFAULT 0,
  labor_cost_kes NUMERIC NOT NULL DEFAULT 0,
  total_cost_kes NUMERIC NOT NULL DEFAULT 0,
  weather_conditions TEXT,
  is_historical BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  season_id TEXT NOT NULL,
  section_id TEXT,
  observation_date TEXT NOT NULL,
  observation_type TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL,
  action_taken TEXT,
  is_historical BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS harvest_records (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  season_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  harvest_date TEXT NOT NULL,
  bags INTEGER NOT NULL,
  kg_per_bag NUMERIC NOT NULL,
  total_kg NUMERIC NOT NULL,
  price_per_bag_kes NUMERIC NOT NULL,
  total_revenue_kes NUMERIC NOT NULL,
  buyer TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tracks one-time migration status (AsyncStorage → Supabase)
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
