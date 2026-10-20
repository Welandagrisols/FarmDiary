-- ============================================================
-- Farm Diary: RLS hardening (step 1)
-- Run AFTER scripts/supabase-patch-fixed.sql. Safe to re-run.
-- Run manually in the Supabase SQL editor; this file is not run by the app.
-- ============================================================

-- New users can only create a farmer profile, never an admin profile.
DROP POLICY IF EXISTS "profiles_insert" ON public.user_profiles;
CREATE POLICY "profiles_insert" ON public.user_profiles
  FOR INSERT TO authenticated
  WITH CHECK ((id = auth.uid()::text AND role = 'farmer') OR public.is_admin());

-- Backstop: only an admin can assign or change roles.
-- Auth-less SQL editor/service-role operations may bootstrap the first admin.
CREATE OR REPLACE FUNCTION public.guard_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' AND NEW.role <> 'farmer' THEN
      RAISE EXCEPTION 'Only an admin can assign roles';
    ELSIF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Only an admin can change roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_role_trg ON public.user_profiles;
CREATE TRIGGER guard_profile_role_trg
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_role();

-- Farm owners may edit their own farm, but only admins may transfer ownership.
DROP POLICY IF EXISTS "farms_update" ON public.farms;
CREATE POLICY "farms_update" ON public.farms
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()::text OR public.is_admin())
  WITH CHECK (user_id = auth.uid()::text OR public.is_admin());

-- app_meta has shared app-level state; restrict it to signed-in users.
DO $$
BEGIN
  IF to_regclass('public.app_meta') IS NOT NULL THEN
    ALTER TABLE public.app_meta ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "app_meta_authenticated" ON public.app_meta;
    CREATE POLICY "app_meta_authenticated" ON public.app_meta
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Verify after applying:
-- 1. No public tables have RLS disabled:
-- SELECT c.relname
-- FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;
--
-- 2. Review all active policies:
-- SELECT tablename, policyname, cmd, qual, with_check
-- FROM pg_policies WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
--
-- 3. Review farms still needing an owner:
-- SELECT id, name FROM public.farms WHERE user_id IS NULL;
--
-- 4. Review admin accounts:
-- SELECT email, role FROM public.user_profiles WHERE role = 'admin';
