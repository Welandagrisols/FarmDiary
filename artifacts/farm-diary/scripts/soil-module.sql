-- Farm Diary — soil module: plots, soil tests, private report storage.
-- Run AFTER scripts/sales-control.sql (needs public.get_farm_role and public.my_farm_ids).
-- Safe to re-run. Back up first. Nothing here drops or rewrites existing data.
--
-- Design:
--  * A soil test belongs to a FARM (plot_id NULL = whole-farm / composite sample)
--    or to a PLOT (plot_id set). It is NOT tied to a season, so it stays usable
--    across every season and crop cycle on that farm or plot.
--  * results is a JSON array, one entry per measured parameter, each with its own
--    unit/method/rating exactly as the lab reported them (no silent unit conversion).
--  * Original photo/PDF files live in the private "soil-reports" bucket; only the
--    server (service role) reads/writes that bucket.

CREATE TABLE IF NOT EXISTS public.plots (
  id           TEXT PRIMARY KEY,
  farm_id      TEXT NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  name         TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  area_acres   NUMERIC CHECK (area_acres IS NULL OR area_acres > 0),
  description  TEXT,
  is_archived  BOOLEAN NOT NULL DEFAULT false,
  created_by   UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, farm_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS plots_farm_name_active_idx
  ON public.plots (farm_id, lower(btrim(name))) WHERE NOT is_archived;

CREATE TABLE IF NOT EXISTS public.soil_tests (
  id                TEXT PRIMARY KEY,
  farm_id           TEXT NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  plot_id           TEXT,
  sample_label      TEXT,
  sample_date       TEXT,
  received_date     TEXT,
  report_date       TEXT,
  lab_name          TEXT,
  lab_reference     TEXT,
  location_on_report TEXT,
  intended_crops    JSONB NOT NULL DEFAULT '[]'::jsonb,
  sample_depth      TEXT,
  sampling_method   TEXT NOT NULL DEFAULT 'unknown'
                    CHECK (sampling_method IN ('composite', 'grid', 'single_point', 'unknown')),
  results           JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations   TEXT,
  recommendation_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  report_files      JSONB NOT NULL DEFAULT '[]'::jsonb,
  source            TEXT NOT NULL CHECK (source IN ('photo', 'pdf', 'manual')),
  status            TEXT NOT NULL DEFAULT 'needs_review'
                    CHECK (status IN ('parsed', 'needs_review', 'confirmed', 'manual')),
  extraction_notes  TEXT,
  created_by        UUID,
  confirmed_by      UUID,
  confirmed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (plot_id, farm_id) REFERENCES public.plots (id, farm_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS soil_tests_farm_date_idx ON public.soil_tests (farm_id, sample_date DESC);
CREATE INDEX IF NOT EXISTS soil_tests_plot_idx ON public.soil_tests (plot_id);

CREATE OR REPLACE FUNCTION public.soil_tests_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS soil_tests_touch ON public.soil_tests;
CREATE TRIGGER soil_tests_touch BEFORE UPDATE ON public.soil_tests
  FOR EACH ROW EXECUTE FUNCTION public.soil_tests_touch_updated_at();

ALTER TABLE public.plots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soil_tests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plots_select ON public.plots;
CREATE POLICY plots_select ON public.plots FOR SELECT
  USING (farm_id IN (SELECT public.my_farm_ids()));
DROP POLICY IF EXISTS plots_insert ON public.plots;
CREATE POLICY plots_insert ON public.plots FOR INSERT
  WITH CHECK (public.get_farm_role(farm_id) IN ('admin', 'owner', 'manager'));
DROP POLICY IF EXISTS plots_update ON public.plots;
CREATE POLICY plots_update ON public.plots FOR UPDATE
  USING (public.get_farm_role(farm_id) IN ('admin', 'owner', 'manager'))
  WITH CHECK (public.get_farm_role(farm_id) IN ('admin', 'owner', 'manager'));
DROP POLICY IF EXISTS plots_delete ON public.plots;
CREATE POLICY plots_delete ON public.plots FOR DELETE
  USING (public.get_farm_role(farm_id) IN ('admin', 'owner', 'manager'));

DROP POLICY IF EXISTS soil_tests_select ON public.soil_tests;
CREATE POLICY soil_tests_select ON public.soil_tests FOR SELECT
  USING (public.get_farm_role(farm_id) IN ('admin', 'owner', 'manager'));
DROP POLICY IF EXISTS soil_tests_insert ON public.soil_tests;
CREATE POLICY soil_tests_insert ON public.soil_tests FOR INSERT
  WITH CHECK (created_by = auth.uid()
    AND public.get_farm_role(farm_id) IN ('admin', 'owner', 'manager'));
DROP POLICY IF EXISTS soil_tests_update ON public.soil_tests;
CREATE POLICY soil_tests_update ON public.soil_tests FOR UPDATE
  USING (public.get_farm_role(farm_id) IN ('admin', 'owner', 'manager'))
  WITH CHECK (public.get_farm_role(farm_id) IN ('admin', 'owner', 'manager'));
DROP POLICY IF EXISTS soil_tests_delete ON public.soil_tests;
CREATE POLICY soil_tests_delete ON public.soil_tests FOR DELETE
  USING (public.get_farm_role(farm_id) IN ('admin', 'owner', 'manager'));

-- Private bucket: clients cannot access report originals directly.
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('soil-reports', 'soil-reports', false)
  ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN undefined_table OR invalid_schema_name THEN
  RAISE NOTICE 'Create a private bucket named soil-reports in the Supabase dashboard.';
END;
$$;
