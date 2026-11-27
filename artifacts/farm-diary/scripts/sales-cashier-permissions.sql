-- Allow a farm-assigned cashier to confirm sales at the POS without manager
-- approval. Keep the different-person check and the existing approval/audit
-- behavior. This migration was written against the connected Farm Diary
-- Supabase schema and is safe to re-run.

BEGIN;

LOCK TABLE public.farm_memberships, public.sales IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF to_regclass('public.farm_memberships') IS NULL
     OR to_regclass('public.sales') IS NULL
     OR to_regclass('public.sales_audit') IS NULL
     OR to_regprocedure('public.get_farm_role(text)') IS NULL
     OR to_regprocedure('public.check_sale(text,text)') IS NULL
  THEN
    RAISE EXCEPTION 'Expected Farm Diary sales and role objects were not found; no permissions were changed.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sales' AND policyname = 'sales_insert'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sales' AND policyname = 'sales_select'
  ) THEN
    RAISE EXCEPTION 'Expected sales_insert and sales_select policies were not found; no permissions were changed.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.farm_memberships
    WHERE role NOT IN ('admin', 'owner', 'manager', 'seller', 'storekeeper', 'cashier')
  ) THEN
    RAISE EXCEPTION 'Unexpected farm membership role found; review the role constraint before migrating.';
  END IF;
END;
$$;

ALTER TABLE public.farm_memberships
  DROP CONSTRAINT IF EXISTS farm_memberships_role_check;
ALTER TABLE public.farm_memberships
  ADD CONSTRAINT farm_memberships_role_check
  CHECK (role = ANY (ARRAY['manager'::text, 'seller'::text, 'storekeeper'::text, 'cashier'::text]));

DROP POLICY IF EXISTS sales_insert ON public.sales;
CREATE POLICY sales_insert ON public.sales
  FOR INSERT TO authenticated
  WITH CHECK (
    seller_id = auth.uid()
    AND seller_email = COALESCE(auth.jwt() ->> 'email', '')
    AND public.get_farm_role(farm_id) IN ('admin', 'owner', 'manager', 'seller', 'cashier')
    AND (
      (discount_kes = 0 AND status = 'pending_check')
      OR (discount_kes > 0 AND status = 'discount_pending')
    )
    AND checked_by IS NULL
    AND checked_at IS NULL
    AND check_note IS NULL
    AND discount_kes <= quantity_kg * unit_price_kes
    AND total_kes = GREATEST(0, quantity_kg * unit_price_kes - discount_kes)
    AND discount_approved_by IS NULL
    AND discount_approved_at IS NULL
    AND discount_approval_reason IS NULL
    AND void_requested_by IS NULL
    AND void_requested_at IS NULL
    AND void_request_reason IS NULL
    AND voided_by IS NULL
    AND voided_at IS NULL
    AND void_reason IS NULL
    AND (payment_method = 'cash' OR NULLIF(BTRIM(payment_reference), '') IS NOT NULL)
  );

DROP POLICY IF EXISTS sales_select ON public.sales;
CREATE POLICY sales_select ON public.sales
  FOR SELECT TO authenticated
  USING (
    public.get_farm_role(farm_id) IN ('admin', 'owner', 'manager', 'cashier')
    OR (
      public.get_farm_role(farm_id) = 'seller'
      AND seller_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.check_sale(p_sale_id text, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  sale_row public.sales%ROWTYPE;
  next_status TEXT;
BEGIN
  SELECT * INTO sale_row FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;
  IF public.get_farm_role(sale_row.farm_id) NOT IN ('admin', 'owner', 'manager', 'cashier') THEN
    RAISE EXCEPTION 'Cashier confirmation required';
  END IF;
  IF sale_row.seller_id = auth.uid() THEN RAISE EXCEPTION 'A different person must check the sale'; END IF;
  IF sale_row.status NOT IN ('pending_check', 'discount_pending') OR sale_row.checked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Sale is not awaiting a check';
  END IF;
  IF NULLIF(BTRIM(p_reason), '') IS NULL THEN RAISE EXCEPTION 'Check note is required'; END IF;
  next_status := CASE WHEN sale_row.discount_kes = 0 OR sale_row.discount_approved_at IS NOT NULL
    THEN 'recorded' ELSE 'discount_pending' END;
  UPDATE public.sales SET status = next_status, checked_by = auth.uid(),
    checked_by_email = COALESCE(auth.jwt() ->> 'email', 'Farm staff'), checked_at = NOW(),
    check_note = BTRIM(p_reason)
    WHERE id = p_sale_id;
  INSERT INTO public.sales_audit (sale_id, farm_id, actor_id, action, reason, previous_status, new_status)
    VALUES (p_sale_id, sale_row.farm_id, auth.uid(), 'sale_checked', BTRIM(p_reason), sale_row.status, next_status);
END;
$function$;

COMMIT;
