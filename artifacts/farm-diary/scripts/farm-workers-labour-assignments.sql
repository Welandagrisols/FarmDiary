-- Named farm workers for labour records.
-- Safe to re-run: only adds a roster table and an activity-log JSON column.

BEGIN;

CREATE TABLE IF NOT EXISTS public.farm_workers (
  id          TEXT PRIMARY KEY,
  farm_id     TEXT NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS farm_workers_active_name_idx
  ON public.farm_workers (farm_id, lower(btrim(name)))
  WHERE is_active;

ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS worker_assignments JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.activity_logs
  ALTER COLUMN worker_assignments SET DEFAULT '[]'::jsonb;
UPDATE public.activity_logs
  SET worker_assignments = '[]'::jsonb
  WHERE worker_assignments IS NULL;
ALTER TABLE public.activity_logs
  ALTER COLUMN worker_assignments SET NOT NULL;

ALTER TABLE public.farm_workers ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.farm_workers TO authenticated;

DROP POLICY IF EXISTS farm_workers_select ON public.farm_workers;
CREATE POLICY farm_workers_select ON public.farm_workers FOR SELECT
  USING (farm_id IN (SELECT public.my_farm_ids()));

DROP POLICY IF EXISTS farm_workers_insert ON public.farm_workers;
CREATE POLICY farm_workers_insert ON public.farm_workers FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND public.get_farm_role(farm_id) IN ('admin', 'owner', 'manager')
  );

DROP POLICY IF EXISTS farm_workers_update ON public.farm_workers;
CREATE POLICY farm_workers_update ON public.farm_workers FOR UPDATE
  USING (public.get_farm_role(farm_id) IN ('admin', 'owner', 'manager'))
  WITH CHECK (public.get_farm_role(farm_id) IN ('admin', 'owner', 'manager'));

COMMIT;
