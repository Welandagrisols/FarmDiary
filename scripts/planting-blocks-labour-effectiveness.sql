-- Adds repeatable planting blocks and measurable, attributable farm activity logs.
-- Existing A/B season data remains readable through the application's legacy fallback.

ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS blocks JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS activity_category TEXT NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS worker_names TEXT,
  ADD COLUMN IF NOT EXISTS days_worked NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS work_quantity NUMERIC,
  ADD COLUMN IF NOT EXISTS work_unit TEXT,
  ADD COLUMN IF NOT EXISTS recorded_by UUID,
  ADD COLUMN IF NOT EXISTS recorded_by_email TEXT;

CREATE INDEX IF NOT EXISTS activity_logs_recorded_by_idx
  ON public.activity_logs (recorded_by);
