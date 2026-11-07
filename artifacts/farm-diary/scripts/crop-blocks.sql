-- Run once against the Farm Diary Supabase database.
-- Existing fixed sections are preserved as the first two planting blocks.

ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS blocks jsonb;

ALTER TABLE public.seasons
  ALTER COLUMN blocks SET DEFAULT '[]'::jsonb;

UPDATE public.seasons
SET blocks =
  jsonb_build_array(
    jsonb_build_object(
      'id', 'section-a',
      'name', 'Block 1',
      'variety', COALESCE(section_a->>'variety', ''),
      'planting_date', COALESCE(section_a->>'planting_date', CURRENT_DATE::text),
      'acres', COALESCE(NULLIF(section_a->>'acres', '')::numeric, 0),
      'blight_risk', COALESCE(section_a->>'blight_risk', 'LOW'),
      'notes', section_a->'notes'
    )
  ) ||
  CASE
    WHEN COALESCE(NULLIF(section_b->>'acres', '')::numeric, 0) > 0 THEN
      jsonb_build_array(
        jsonb_build_object(
          'id', 'section-b',
          'name', 'Block 2',
          'variety', COALESCE(section_b->>'variety', ''),
          'planting_date', COALESCE(section_b->>'planting_date', CURRENT_DATE::text),
          'acres', COALESCE(NULLIF(section_b->>'acres', '')::numeric, 0),
          'blight_risk', COALESCE(section_b->>'blight_risk', 'LOW'),
          'notes', section_b->'notes'
        )
      )
    ELSE '[]'::jsonb
  END
WHERE blocks IS NULL OR blocks = '[]'::jsonb;

ALTER TABLE public.seasons
  ALTER COLUMN blocks SET NOT NULL;
