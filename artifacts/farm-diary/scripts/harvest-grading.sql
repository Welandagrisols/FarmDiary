-- Add optional harvest quality weights. Existing records remain unchanged.
-- Apply this file in the Supabase SQL editor before saving grade splits from the app.
ALTER TABLE public.harvest_records
  ADD COLUMN IF NOT EXISTS grade_a_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS grade_b_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS reject_kg NUMERIC;

DO $$
BEGIN
  ALTER TABLE public.harvest_records
    ADD CONSTRAINT harvest_records_grade_kg_nonneg
    CHECK (
      (grade_a_kg IS NULL OR grade_a_kg >= 0) AND
      (grade_b_kg IS NULL OR grade_b_kg >= 0) AND
      (reject_kg IS NULL OR reject_kg >= 0)
    );
EXCEPTION WHEN duplicate_object THEN
  NULL;
END
$$;
