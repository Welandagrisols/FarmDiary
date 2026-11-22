-- Buyer commitments by farm and crop season.
-- Apply after the existing sales-control and soil-module SQL setup, which provide
-- public.get_farm_role(farm_id) and public.my_farm_ids(). This file is additive.
CREATE TABLE IF NOT EXISTS public.buyer_commitments (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  season_id TEXT,
  buyer_name TEXT NOT NULL CHECK (length(trim(buyer_name)) > 0),
  product_name TEXT NOT NULL CHECK (length(trim(product_name)) > 0),
  weekly_kg NUMERIC NOT NULL CHECK (weekly_kg > 0),
  agreed_price_kes NUMERIC CHECK (agreed_price_kes IS NULL OR agreed_price_kes >= 0),
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS buyer_commitments_farm_idx ON public.buyer_commitments (farm_id, season_id);
ALTER TABLE public.buyer_commitments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS buyer_commitments_select ON public.buyer_commitments;
CREATE POLICY buyer_commitments_select ON public.buyer_commitments FOR SELECT
  USING (farm_id IN (SELECT public.my_farm_ids()));

DROP POLICY IF EXISTS buyer_commitments_insert ON public.buyer_commitments;
CREATE POLICY buyer_commitments_insert ON public.buyer_commitments FOR INSERT
  WITH CHECK (public.get_farm_role(farm_id) IN ('admin', 'owner', 'manager'));

DROP POLICY IF EXISTS buyer_commitments_update ON public.buyer_commitments;
CREATE POLICY buyer_commitments_update ON public.buyer_commitments FOR UPDATE
  USING (public.get_farm_role(farm_id) IN ('admin', 'owner', 'manager'))
  WITH CHECK (public.get_farm_role(farm_id) IN ('admin', 'owner', 'manager'));

DROP POLICY IF EXISTS buyer_commitments_delete ON public.buyer_commitments;
CREATE POLICY buyer_commitments_delete ON public.buyer_commitments FOR DELETE
  USING (public.get_farm_role(farm_id) IN ('admin', 'owner', 'manager'));
