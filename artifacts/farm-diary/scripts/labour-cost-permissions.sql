-- Keep crew and work details open to farm staff while restricting financial
-- labour records to admins, owners, and managers. Requires the existing
-- public.get_farm_role(p_farm_id) function used by Farm Diary.
--
-- Additive and idempotent. Apply to Supabase after confirming the role function
-- and the public.activity_logs / public.costs tables are present.

CREATE OR REPLACE FUNCTION public.guard_manager_labour_cost_writes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target_farm_id TEXT;
  needs_manager BOOLEAN := FALSE;
  old_is_labour BOOLEAN := FALSE;
  new_is_labour BOOLEAN := FALSE;
BEGIN
  IF TG_TABLE_NAME = 'activity_logs' THEN
    IF TG_OP = 'INSERT' THEN
      target_farm_id := NEW.farm_id;
      needs_manager := COALESCE(NEW.labor_cost_kes, 0) <> 0;
    ELSIF TG_OP = 'UPDATE' THEN
      target_farm_id := NEW.farm_id;
      needs_manager :=
        NEW.labor_cost_kes IS DISTINCT FROM OLD.labor_cost_kes
        OR (
          (COALESCE(OLD.labor_cost_kes, 0) <> 0 OR COALESCE(NEW.labor_cost_kes, 0) <> 0)
          AND (
            NEW.total_cost_kes IS DISTINCT FROM OLD.total_cost_kes
            OR NEW.farm_id IS DISTINCT FROM OLD.farm_id
          )
        );
    ELSE
      target_farm_id := OLD.farm_id;
      needs_manager := COALESCE(OLD.labor_cost_kes, 0) <> 0;
    END IF;
  ELSIF TG_TABLE_NAME = 'costs' THEN
    IF TG_OP = 'INSERT' THEN
      target_farm_id := NEW.farm_id;
      new_is_labour :=
        LOWER(TRIM(COALESCE(NEW.cost_category, ''))) IN ('labor', 'labour')
        OR NEW.num_workers IS NOT NULL
        OR NEW.days_worked IS NOT NULL
        OR NEW.rate_per_worker_per_day IS NOT NULL;
      needs_manager := new_is_labour;
    ELSIF TG_OP = 'UPDATE' THEN
      target_farm_id := NEW.farm_id;
      old_is_labour :=
        LOWER(TRIM(COALESCE(OLD.cost_category, ''))) IN ('labor', 'labour')
        OR OLD.num_workers IS NOT NULL
        OR OLD.days_worked IS NOT NULL
        OR OLD.rate_per_worker_per_day IS NOT NULL;
      new_is_labour :=
        LOWER(TRIM(COALESCE(NEW.cost_category, ''))) IN ('labor', 'labour')
        OR NEW.num_workers IS NOT NULL
        OR NEW.days_worked IS NOT NULL
        OR NEW.rate_per_worker_per_day IS NOT NULL;
      needs_manager := old_is_labour OR new_is_labour;
    ELSE
      target_farm_id := OLD.farm_id;
      needs_manager :=
        LOWER(TRIM(COALESCE(OLD.cost_category, ''))) IN ('labor', 'labour')
        OR OLD.num_workers IS NOT NULL
        OR OLD.days_worked IS NOT NULL
        OR OLD.rate_per_worker_per_day IS NOT NULL;
    END IF;
  ELSE
    RAISE EXCEPTION 'Labour-cost guard attached to unsupported table %', TG_TABLE_NAME;
  END IF;

  IF needs_manager THEN
    IF COALESCE(public.get_farm_role(target_farm_id), 'none') NOT IN ('admin', 'owner', 'manager') THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'Only a farm manager can record or change labour costs.';
    END IF;

    IF TG_OP = 'UPDATE' THEN
      IF OLD.farm_id IS DISTINCT FROM NEW.farm_id AND (
        COALESCE(public.get_farm_role(OLD.farm_id), 'none') NOT IN ('admin', 'owner', 'manager')
        OR COALESCE(public.get_farm_role(NEW.farm_id), 'none') NOT IN ('admin', 'owner', 'manager')
      ) THEN
        RAISE EXCEPTION USING
          ERRCODE = '42501',
          MESSAGE = 'Only a farm manager can move labour costs between farms.';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS activity_logs_manager_labour_costs ON public.activity_logs;
CREATE TRIGGER activity_logs_manager_labour_costs
  BEFORE INSERT OR UPDATE OR DELETE ON public.activity_logs
  FOR EACH ROW EXECUTE FUNCTION public.guard_manager_labour_cost_writes();

DROP TRIGGER IF EXISTS costs_manager_labour_costs ON public.costs;
CREATE TRIGGER costs_manager_labour_costs
  BEFORE INSERT OR UPDATE OR DELETE ON public.costs
  FOR EACH ROW EXECUTE FUNCTION public.guard_manager_labour_cost_writes();
