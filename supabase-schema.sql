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
  user_id TEXT,
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
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
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
  activity_category TEXT NOT NULL DEFAULT 'other',
  planned_date TEXT,
  actual_date TEXT NOT NULL,
  products_used JSONB NOT NULL DEFAULT '[]',
  is_deviation BOOLEAN NOT NULL DEFAULT false,
  deviation_reason TEXT,
  num_workers INTEGER NOT NULL DEFAULT 0,
  worker_names TEXT,
  days_worked NUMERIC NOT NULL DEFAULT 0,
  work_quantity NUMERIC,
  work_unit TEXT,
  labor_cost_kes NUMERIC NOT NULL DEFAULT 0,
  total_cost_kes NUMERIC NOT NULL DEFAULT 0,
  weather_conditions TEXT,
  is_historical BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  recorded_by UUID,
  recorded_by_email TEXT,
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
  recorded_by UUID,
  recorded_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS harvest_records (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  season_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  harvest_date TEXT NOT NULL,
  bags NUMERIC NOT NULL,
  kg_per_bag NUMERIC NOT NULL,
  total_kg NUMERIC NOT NULL,
  price_per_bag_kes NUMERIC NOT NULL,
  total_revenue_kes NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT 'bag',
  grade TEXT,
  buyer TEXT,
  notes TEXT,
  recorded_by UUID,
  recorded_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS farm_memberships (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('manager', 'seller', 'storekeeper')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (farm_id, user_id)
);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  receipt_number TEXT NOT NULL UNIQUE,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  season_id TEXT NOT NULL REFERENCES seasons(id),
  block_id TEXT,
  seller_id UUID NOT NULL REFERENCES auth.users(id),
  seller_email TEXT NOT NULL,
  product_name TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  quantity_kg NUMERIC NOT NULL CHECK (quantity_kg > 0),
  unit_price_kes NUMERIC NOT NULL CHECK (unit_price_kes >= 0),
  discount_kes NUMERIC NOT NULL DEFAULT 0 CHECK (discount_kes >= 0),
  total_kes NUMERIC NOT NULL CHECK (total_kes >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('mpesa', 'cash', 'bank')),
  payment_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending_check'
    CHECK (status IN ('pending_check', 'discount_pending', 'recorded', 'void_requested', 'voided')),
  check_note TEXT,
  checked_by UUID REFERENCES auth.users(id),
  checked_by_email TEXT,
  checked_at TIMESTAMPTZ,
  discount_approved_by UUID REFERENCES auth.users(id),
  discount_approved_by_email TEXT,
  discount_approved_at TIMESTAMPTZ,
  discount_approval_reason TEXT,
  void_requested_by UUID REFERENCES auth.users(id),
  void_requested_by_email TEXT,
  void_requested_at TIMESTAMPTZ,
  void_request_reason TEXT,
  voided_by UUID REFERENCES auth.users(id),
  voided_by_email TEXT,
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_audit (
  id BIGSERIAL PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id),
  farm_id TEXT NOT NULL REFERENCES farms(id),
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  reason TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_losses (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  season_id TEXT NOT NULL REFERENCES seasons(id),
  product_name TEXT NOT NULL,
  loss_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity_kg NUMERIC NOT NULL CHECK (quantity_kg > 0),
  reason TEXT NOT NULL,
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_counts (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  season_id TEXT NOT NULL REFERENCES seasons(id),
  product_name TEXT NOT NULL,
  count_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity_kg NUMERIC NOT NULL CHECK (quantity_kg >= 0),
  counted_by UUID NOT NULL REFERENCES auth.users(id),
  confirmed_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending_confirmation'
    CHECK (status IN ('pending_confirmation', 'confirmed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_issues (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  season_id TEXT NOT NULL REFERENCES seasons(id),
  product_name TEXT NOT NULL,
  quantity_kg NUMERIC NOT NULL CHECK (quantity_kg > 0),
  purpose TEXT NOT NULL,
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  issued_by UUID REFERENCES auth.users(id),
  received_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval', 'approved', 'issued', 'confirmed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tracks one-time migration status (AsyncStorage → Supabase)
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
