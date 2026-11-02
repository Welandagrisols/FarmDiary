-- Farm Diary: GPS boundaries for plots.
-- Apply only after the soil module has created public.plots.
-- The soil module expects the farm-role functions used by RLS; this GitHub
-- artifact does not include sales-control.sql, so confirm get_farm_role(farm_id)
-- and the plots policies already exist before applying this script.
--
-- Additive migration: adds boundary fields and a history table; it does not
-- delete or rewrite existing plot data. Replacing or clearing a saved boundary
-- stores the previous version in plot_boundary_history.
--
-- A boundary is an ordered list of [longitude, latitude] points. Phone GPS
-- measurements are estimates, not legal survey measurements.

ALTER TABLE public.plots
  ADD COLUMN IF NOT EXISTS boundary              JSONB,
  ADD COLUMN IF NOT EXISTS boundary_area_m2      NUMERIC,
  ADD COLUMN IF NOT EXISTS boundary_perimeter_m  NUMERIC,
  ADD COLUMN IF NOT EXISTS boundary_center_lat   NUMERIC,
  ADD COLUMN IF NOT EXISTS boundary_center_lng   NUMERIC,
  ADD COLUMN IF NOT EXISTS boundary_accuracy_m   NUMERIC,
  ADD COLUMN IF NOT EXISTS boundary_method       TEXT,
  ADD COLUMN IF NOT EXISTS boundary_captured_by  UUID,
  ADD COLUMN IF NOT EXISTS boundary_captured_at  TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.is_valid_boundary(b JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  point JSONB;
  longitude NUMERIC;
  latitude NUMERIC;
BEGIN
  IF b IS NULL THEN RETURN TRUE; END IF;
  IF jsonb_typeof(b) <> 'array' THEN RETURN FALSE; END IF;
  IF jsonb_array_length(b) < 3 OR jsonb_array_length(b) > 500 THEN RETURN FALSE; END IF;
  FOR point IN SELECT * FROM jsonb_array_elements(b) LOOP
    IF jsonb_typeof(point) <> 'array' OR jsonb_array_length(point) <> 2 THEN RETURN FALSE; END IF;
    IF jsonb_typeof(point->0) <> 'number' OR jsonb_typeof(point->1) <> 'number' THEN RETURN FALSE; END IF;
    longitude := (point->>0)::NUMERIC;
    latitude := (point->>1)::NUMERIC;
    IF longitude < -180 OR longitude > 180 OR latitude < -90 OR latitude > 90 THEN RETURN FALSE; END IF;
  END LOOP;
  RETURN TRUE;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plots_boundary_valid') THEN
    ALTER TABLE public.plots
      ADD CONSTRAINT plots_boundary_valid CHECK (public.is_valid_boundary(boundary));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plots_boundary_method_valid') THEN
    ALTER TABLE public.plots
      ADD CONSTRAINT plots_boundary_method_valid
      CHECK (boundary_method IS NULL OR boundary_method IN ('corners', 'walk'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plots_boundary_numbers_valid') THEN
    ALTER TABLE public.plots
      ADD CONSTRAINT plots_boundary_numbers_valid
      CHECK (boundary IS NULL OR (boundary_area_m2 > 0 AND boundary_perimeter_m > 0 AND boundary_accuracy_m > 0));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.plot_boundary_history (
  id            BIGSERIAL PRIMARY KEY,
  plot_id       TEXT NOT NULL,
  farm_id       TEXT NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  boundary      JSONB NOT NULL,
  area_m2       NUMERIC,
  perimeter_m   NUMERIC,
  accuracy_m    NUMERIC,
  method        TEXT,
  captured_by   UUID,
  captured_at   TIMESTAMPTZ,
  replaced_by   UUID,
  replaced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS plot_boundary_history_plot_idx
  ON public.plot_boundary_history (plot_id, replaced_at DESC);

ALTER TABLE public.plot_boundary_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plot_boundary_history_select ON public.plot_boundary_history;
CREATE POLICY plot_boundary_history_select ON public.plot_boundary_history FOR SELECT
  USING (public.get_farm_role(farm_id) IN ('admin', 'owner', 'manager'));
-- No direct insert/update/delete policies: the trigger below writes history.

CREATE OR REPLACE FUNCTION public.plots_boundary_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.boundary IS NOT NULL THEN
      NEW.boundary_captured_by := auth.uid();
      NEW.boundary_captured_at := NOW();
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.boundary IS DISTINCT FROM OLD.boundary THEN
    IF OLD.boundary IS NOT NULL THEN
      INSERT INTO public.plot_boundary_history
        (plot_id, farm_id, boundary, area_m2, perimeter_m, accuracy_m, method, captured_by, captured_at, replaced_by)
      VALUES
        (OLD.id, OLD.farm_id, OLD.boundary, OLD.boundary_area_m2, OLD.boundary_perimeter_m,
         OLD.boundary_accuracy_m, OLD.boundary_method, OLD.boundary_captured_by, OLD.boundary_captured_at, auth.uid());
    END IF;
    IF NEW.boundary IS NULL THEN
      NEW.boundary_area_m2 := NULL;
      NEW.boundary_perimeter_m := NULL;
      NEW.boundary_center_lat := NULL;
      NEW.boundary_center_lng := NULL;
      NEW.boundary_accuracy_m := NULL;
      NEW.boundary_method := NULL;
      NEW.boundary_captured_by := NULL;
      NEW.boundary_captured_at := NULL;
    ELSE
      NEW.boundary_captured_by := auth.uid();
      NEW.boundary_captured_at := NOW();
    END IF;
  ELSE
    -- The capture stamp cannot be edited independently of the boundary.
    NEW.boundary_captured_by := OLD.boundary_captured_by;
    NEW.boundary_captured_at := OLD.boundary_captured_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS plots_boundary_guard_trg ON public.plots;
CREATE TRIGGER plots_boundary_guard_trg
  BEFORE INSERT OR UPDATE ON public.plots
  FOR EACH ROW EXECUTE FUNCTION public.plots_boundary_guard();
