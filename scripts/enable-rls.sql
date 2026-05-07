-- ============================================================
--  Farm Diary — Full RLS + Multi-user Setup
--  Run this in: https://supabase.com/dashboard/project/ckluambcgnmjxcmpcfvg/sql/new
-- ============================================================

-- 1. Add user_id column to farms (links each farm to its owner)
ALTER TABLE farms ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. Create user_profiles table (email + role per user)
CREATE TABLE IF NOT EXISTS user_profiles (
  id         UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email      TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'farmer',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Security-definer helper — avoids RLS recursion when checking admin
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 4. RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own profile" ON user_profiles;
CREATE POLICY "Users manage own profile" ON user_profiles
  FOR ALL TO authenticated
  USING  (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Admins read all profiles" ON user_profiles;
CREATE POLICY "Admins read all profiles" ON user_profiles
  FOR SELECT TO authenticated
  USING (is_admin_user());

-- 5. RLS on farms
ALTER TABLE farms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own farms" ON farms;
CREATE POLICY "Users access own farms" ON farms
  FOR ALL TO authenticated
  USING  (user_id = auth.uid() OR user_id IS NULL OR is_admin_user())
  WITH CHECK (user_id = auth.uid() OR is_admin_user());

-- 6. RLS on seasons
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Access via farm" ON seasons;
CREATE POLICY "Access via farm" ON seasons
  FOR ALL TO authenticated
  USING (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid() OR user_id IS NULL)
    OR is_admin_user()
  )
  WITH CHECK (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid() OR user_id IS NULL)
    OR is_admin_user()
  );

-- 7. RLS on costs
ALTER TABLE costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Access via farm" ON costs;
CREATE POLICY "Access via farm" ON costs
  FOR ALL TO authenticated
  USING (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid() OR user_id IS NULL)
    OR is_admin_user()
  )
  WITH CHECK (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid() OR user_id IS NULL)
    OR is_admin_user()
  );

-- 8. RLS on inventory
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Access via farm" ON inventory;
CREATE POLICY "Access via farm" ON inventory
  FOR ALL TO authenticated
  USING (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid() OR user_id IS NULL)
    OR is_admin_user()
  )
  WITH CHECK (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid() OR user_id IS NULL)
    OR is_admin_user()
  );

-- 9. RLS on activity_logs
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Access via farm" ON activity_logs;
CREATE POLICY "Access via farm" ON activity_logs
  FOR ALL TO authenticated
  USING (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid() OR user_id IS NULL)
    OR is_admin_user()
  )
  WITH CHECK (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid() OR user_id IS NULL)
    OR is_admin_user()
  );

-- 10. RLS on observations
ALTER TABLE observations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Access via farm" ON observations;
CREATE POLICY "Access via farm" ON observations
  FOR ALL TO authenticated
  USING (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid() OR user_id IS NULL)
    OR is_admin_user()
  )
  WITH CHECK (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid() OR user_id IS NULL)
    OR is_admin_user()
  );

-- 11. RLS on harvest_records
ALTER TABLE harvest_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Access via farm" ON harvest_records;
CREATE POLICY "Access via farm" ON harvest_records
  FOR ALL TO authenticated
  USING (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid() OR user_id IS NULL)
    OR is_admin_user()
  )
  WITH CHECK (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid() OR user_id IS NULL)
    OR is_admin_user()
  );

-- 12. RLS on personal_expenses
ALTER TABLE personal_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Access via farm" ON personal_expenses;
CREATE POLICY "Access via farm" ON personal_expenses
  FOR ALL TO authenticated
  USING (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid() OR user_id IS NULL)
    OR is_admin_user()
  )
  WITH CHECK (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid() OR user_id IS NULL)
    OR is_admin_user()
  );

-- ============================================================
--  LAST STEP: Grant yourself admin access
--  Replace 'your@email.com' with your actual login email
-- ============================================================
INSERT INTO user_profiles (id, email, role)
SELECT id, email, 'admin'
FROM auth.users
WHERE email = 'your@email.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin';
