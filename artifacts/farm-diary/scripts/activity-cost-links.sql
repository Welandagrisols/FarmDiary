-- Link costs generated while logging an activity to the activity record.
-- Nullable and additive: existing costs remain unchanged.

ALTER TABLE public.costs
  ADD COLUMN IF NOT EXISTS activity_log_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'costs_activity_log_id_fkey'
      AND conrelid = 'public.costs'::regclass
  ) THEN
    ALTER TABLE public.costs
      ADD CONSTRAINT costs_activity_log_id_fkey
      FOREIGN KEY (activity_log_id)
      REFERENCES public.activity_logs(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

ALTER TABLE public.costs
  VALIDATE CONSTRAINT costs_activity_log_id_fkey;

CREATE INDEX IF NOT EXISTS costs_activity_log_id_idx
  ON public.costs (activity_log_id)
  WHERE activity_log_id IS NOT NULL;
