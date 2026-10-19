-- Farm Diary: multi-crop harvest upgrade.
-- Run once in the Supabase SQL editor before recording non-bag harvests.
-- Additive and safe to re-run; existing harvest rows remain bags.

ALTER TABLE public.harvest_records
  ALTER COLUMN bags TYPE NUMERIC USING bags::numeric;

ALTER TABLE public.harvest_records
  ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'bag',
  ADD COLUMN IF NOT EXISTS grade TEXT;

-- Verify legacy rows retain the bag unit:
-- SELECT unit, COUNT(*) FROM public.harvest_records GROUP BY unit ORDER BY unit;
