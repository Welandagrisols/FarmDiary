-- Add farm-scoped roles and append-only sales, inventory control, and approvals.
-- Apply in the Supabase SQL editor after the main schema. This is additive.

ALTER TABLE public.farms
  ADD COLUMN IF NOT EXISTS user_id TEXT;

CREATE TABLE IF NOT EXISTS public.farm_memberships (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('manager', 'seller', 'storekeeper')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (farm_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.sales (
  id TEXT PRIMARY KEY,
  receipt_number TEXT NOT NULL UNIQUE,
  farm_id TEXT NOT NULL REFERENCES public.farms(id),
  season_id TEXT NOT NULL REFERENCES public.seasons(id),
  seller_id UUID NOT NULL REFERENCES auth.users(id),
  seller_email TEXT NOT NULL,
  product_name TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  quantity_kg NUMERIC NOT NULL CHECK (quantity_kg > 0),
  unit_price_kes NUMERIC NOT NULL CHECK (unit_price_kes >= 0),
  discount_kes NUMERIC NOT NULL DEFAULT 0 CHECK (discount_kes >= 0),
  total_kes NUMERIC NOT NULL CHECK (total_kes >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('mpesa', 'cash', 'bank')),
  payment_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending_check'
    CHECK (status IN ('pending_check', 'discount_pending', 'recorded', 'void_requested', 'voided')),
  checked_by UUID REFERENCES auth.users(id),
  checked_by_email TEXT,
  checked_at TIMESTAMPTZ,
  discount_approved_by UUID REFERENCES auth.users(id),
  discount_approved_by_email TEXT,
  discount_approved_at TIMESTAMPTZ,
  void_requested_by UUID REFERENCES auth.users(id),
  void_requested_by_email TEXT,
  void_requested_at TIMESTAMPTZ,
  voided_by UUID REFERENCES auth.users(id),
  voided_by_email TEXT,
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sales_audit (
  id BIGSERIAL PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES public.sales(id),
  farm_id TEXT NOT NULL REFERENCES public.farms(id),
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  reason TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stock_losses (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES public.farms(id),
  season_id TEXT NOT NULL REFERENCES public.seasons(id),
  product_name TEXT NOT NULL,
  loss_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity_kg NUMERIC NOT NULL CHECK (quantity_kg > 0),
  reason TEXT NOT NULL,
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stock_counts (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES public.farms(id),
  season_id TEXT NOT NULL REFERENCES public.seasons(id),
  product_name TEXT NOT NULL,
  count_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity_kg NUMERIC NOT NULL CHECK (quantity_kg >= 0),
  counted_by UUID NOT NULL REFERENCES auth.users(id),
  confirmed_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending_confirmation'
    CHECK (status IN ('pending_confirmation', 'confirmed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stock_issues (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES public.farms(id),
  season_id TEXT NOT NULL REFERENCES public.seasons(id),
  product_name TEXT NOT NULL,
  quantity_kg NUMERIC NOT NULL CHECK (quantity_kg > 0),
  purpose TEXT NOT NULL,
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  issued_by UUID REFERENCES auth.users(id),
  received_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval', 'approved', 'issued', 'confirmed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sales_farm_season_created_idx
  ON public.sales (farm_id, season_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sales_seller_idx ON public.sales (seller_id);
CREATE INDEX IF NOT EXISTS farm_memberships_user_farm_idx
  ON public.farm_memberships (user_id, farm_id);

CREATE OR REPLACE FUNCTION public.bind_sale_to_signed_in_seller()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.seller_id := auth.uid();
    NEW.seller_email := COALESCE(auth.jwt() ->> 'email', 'Farm staff');
    NEW.created_at := NOW();
    NEW.status := CASE WHEN NEW.discount_kes > 0 THEN 'discount_pending' ELSE 'pending_check' END;
    NEW.checked_by := NULL;
    NEW.checked_by_email := NULL;
    NEW.checked_at := NULL;
    NEW.discount_approved_by := NULL;
    NEW.discount_approved_by_email := NULL;
    NEW.discount_approved_at := NULL;
    NEW.void_requested_by := NULL;
    NEW.void_requested_by_email := NULL;
    NEW.void_requested_at := NULL;
    NEW.voided_by := NULL;
    NEW.voided_by_email := NULL;
    NEW.voided_at := NULL;
    NEW.void_reason := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bind_sale_to_seller_trg ON public.sales;
CREATE TRIGGER bind_sale_to_seller_trg
  BEFORE INSERT ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.bind_sale_to_signed_in_seller();

CREATE OR REPLACE FUNCTION public.get_farm_role(p_farm_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE member_role TEXT;
BEGIN
  IF public.is_admin() THEN RETURN 'admin'; END IF;
  IF EXISTS (SELECT 1 FROM public.farms WHERE id = p_farm_id AND user_id = auth.uid()::text) THEN
    RETURN 'owner';
  END IF;
  SELECT role INTO member_role
  FROM public.farm_memberships
  WHERE farm_id = p_farm_id AND user_id = auth.uid();
  RETURN COALESCE(member_role, 'none');
END;
$$;

CREATE OR REPLACE FUNCTION public.my_farm_ids()
RETURNS SETOF TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.farms WHERE user_id = auth.uid()::text
  UNION
  SELECT farm_id FROM public.farm_memberships WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.approve_sale_discount(p_sale_id TEXT, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE sale_row public.sales%ROWTYPE;
BEGIN
  SELECT * INTO sale_row FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;
  IF public.get_farm_role(sale_row.farm_id) NOT IN ('admin', 'owner', 'manager') THEN
    RAISE EXCEPTION 'Manager approval required';
  END IF;
  IF sale_row.status NOT IN ('discount_pending', 'pending_check') OR sale_row.discount_kes <= 0
    OR sale_row.discount_approved_at IS NOT NULL THEN
    RAISE EXCEPTION 'Sale is not awaiting discount approval';
  END IF;
  IF NULLIF(BTRIM(p_reason), '') IS NULL THEN RAISE EXCEPTION 'Approval reason is required'; END IF;
  UPDATE public.sales SET status = CASE WHEN checked_by IS NULL THEN 'pending_check' ELSE 'recorded' END,
    discount_approved_by = auth.uid(),
    discount_approved_by_email = COALESCE(auth.jwt() ->> 'email', 'Farm staff'),
    discount_approved_at = NOW() WHERE id = p_sale_id;
  INSERT INTO public.sales_audit (sale_id, farm_id, actor_id, action, reason, previous_status, new_status)
    VALUES (p_sale_id, sale_row.farm_id, auth.uid(), 'discount_approved', BTRIM(p_reason), sale_row.status,
      CASE WHEN sale_row.checked_by IS NULL THEN 'pending_check' ELSE 'recorded' END);
END;
$$;

CREATE OR REPLACE FUNCTION public.check_sale(p_sale_id TEXT, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE sale_row public.sales%ROWTYPE;
DECLARE next_status TEXT;
BEGIN
  SELECT * INTO sale_row FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;
  IF public.get_farm_role(sale_row.farm_id) NOT IN ('admin', 'owner', 'manager') THEN
    RAISE EXCEPTION 'Manager check required';
  END IF;
  IF sale_row.seller_id = auth.uid() THEN RAISE EXCEPTION 'A different person must check the sale'; END IF;
  IF sale_row.status NOT IN ('pending_check', 'discount_pending') OR sale_row.checked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Sale is not awaiting a check';
  END IF;
  IF NULLIF(BTRIM(p_reason), '') IS NULL THEN RAISE EXCEPTION 'Check note is required'; END IF;
  next_status := CASE WHEN sale_row.discount_kes = 0 OR sale_row.discount_approved_at IS NOT NULL
    THEN 'recorded' ELSE 'discount_pending' END;
  UPDATE public.sales SET status = next_status, checked_by = auth.uid(),
    checked_by_email = COALESCE(auth.jwt() ->> 'email', 'Farm staff'), checked_at = NOW()
    WHERE id = p_sale_id;
  INSERT INTO public.sales_audit (sale_id, farm_id, actor_id, action, reason, previous_status, new_status)
    VALUES (p_sale_id, sale_row.farm_id, auth.uid(), 'sale_checked', BTRIM(p_reason), sale_row.status, next_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.request_sale_void(p_sale_id TEXT, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE sale_row public.sales%ROWTYPE;
BEGIN
  SELECT * INTO sale_row FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;
  IF sale_row.seller_id <> auth.uid() THEN RAISE EXCEPTION 'Only the recording seller can request a void'; END IF;
  IF sale_row.status <> 'recorded' THEN RAISE EXCEPTION 'Only checked and approved sales can be voided'; END IF;
  IF NULLIF(BTRIM(p_reason), '') IS NULL THEN RAISE EXCEPTION 'Void reason is required'; END IF;
  UPDATE public.sales SET status = 'void_requested', void_requested_by = auth.uid(),
    void_requested_by_email = COALESCE(auth.jwt() ->> 'email', 'Farm staff'),
    void_requested_at = NOW(), void_reason = BTRIM(p_reason) WHERE id = p_sale_id;
  INSERT INTO public.sales_audit (sale_id, farm_id, actor_id, action, reason, previous_status, new_status)
    VALUES (p_sale_id, sale_row.farm_id, auth.uid(), 'void_requested', BTRIM(p_reason), sale_row.status, 'void_requested');
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_sale_void(p_sale_id TEXT, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE sale_row public.sales%ROWTYPE;
BEGIN
  SELECT * INTO sale_row FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;
  IF public.get_farm_role(sale_row.farm_id) NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Owner approval required';
  END IF;
  IF sale_row.status <> 'void_requested' THEN RAISE EXCEPTION 'Sale is not awaiting void approval'; END IF;
  IF NULLIF(BTRIM(p_reason), '') IS NULL THEN RAISE EXCEPTION 'Approval reason is required'; END IF;
  UPDATE public.sales SET status = 'voided', voided_by = auth.uid(),
    voided_by_email = COALESCE(auth.jwt() ->> 'email', 'Farm staff'), voided_at = NOW(),
    void_reason = BTRIM(p_reason) WHERE id = p_sale_id;
  INSERT INTO public.sales_audit (sale_id, farm_id, actor_id, action, reason, previous_status, new_status)
    VALUES (p_sale_id, sale_row.farm_id, auth.uid(), 'void_approved', BTRIM(p_reason), sale_row.status, 'voided');
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_stock_count(p_count_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE count_row public.stock_counts%ROWTYPE;
BEGIN
  SELECT * INTO count_row FROM public.stock_counts WHERE id = p_count_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stock count not found'; END IF;
  IF public.get_farm_role(count_row.farm_id) NOT IN ('admin', 'owner', 'manager', 'storekeeper') THEN
    RAISE EXCEPTION 'Farm staff only';
  END IF;
  IF count_row.status <> 'pending_confirmation' THEN RAISE EXCEPTION 'Stock count is not pending'; END IF;
  IF count_row.counted_by = auth.uid() THEN RAISE EXCEPTION 'A different person must confirm the count'; END IF;
  UPDATE public.stock_counts SET status = 'confirmed', confirmed_by = auth.uid() WHERE id = p_count_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_stock_issue(p_issue_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE issue_row public.stock_issues%ROWTYPE;
BEGIN
  SELECT * INTO issue_row FROM public.stock_issues WHERE id = p_issue_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stock issue not found'; END IF;
  IF public.get_farm_role(issue_row.farm_id) NOT IN ('admin', 'owner', 'manager') THEN
    RAISE EXCEPTION 'Manager approval required';
  END IF;
  IF issue_row.status <> 'pending_approval' THEN RAISE EXCEPTION 'Issue is not pending approval'; END IF;
  UPDATE public.stock_issues SET status = 'approved', approved_by = auth.uid() WHERE id = p_issue_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_stock_issue_issued(p_issue_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE issue_row public.stock_issues%ROWTYPE;
BEGIN
  SELECT * INTO issue_row FROM public.stock_issues WHERE id = p_issue_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stock issue not found'; END IF;
  IF public.get_farm_role(issue_row.farm_id) NOT IN ('admin', 'owner', 'manager', 'storekeeper') THEN
    RAISE EXCEPTION 'Storekeeper or manager access required';
  END IF;
  IF issue_row.status <> 'approved' THEN RAISE EXCEPTION 'Issue must be approved first'; END IF;
  IF issue_row.approved_by = auth.uid() THEN RAISE EXCEPTION 'Approver cannot issue the stock';
  END IF;
  UPDATE public.stock_issues SET status = 'issued', issued_by = auth.uid() WHERE id = p_issue_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_stock_issue(p_issue_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE issue_row public.stock_issues%ROWTYPE;
BEGIN
  SELECT * INTO issue_row FROM public.stock_issues WHERE id = p_issue_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stock issue not found'; END IF;
  IF public.get_farm_role(issue_row.farm_id) NOT IN ('admin', 'owner', 'manager', 'seller', 'storekeeper') THEN
    RAISE EXCEPTION 'Farm staff only';
  END IF;
  IF issue_row.status <> 'issued' THEN RAISE EXCEPTION 'Stock must be issued first'; END IF;
  IF issue_row.issued_by = auth.uid() THEN RAISE EXCEPTION 'A different person must confirm receipt'; END IF;
  UPDATE public.stock_issues SET status = 'confirmed', received_by = auth.uid() WHERE id = p_issue_id;
END;
$$;

ALTER TABLE public.farm_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_losses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS farm_memberships_select ON public.farm_memberships;
CREATE POLICY farm_memberships_select ON public.farm_memberships FOR SELECT
  USING (user_id = auth.uid() OR public.get_farm_role(farm_id) IN ('admin', 'owner', 'manager'));

DROP POLICY IF EXISTS farms_select ON public.farms;
CREATE POLICY farms_select ON public.farms FOR SELECT
  USING (user_id = auth.uid()::text OR public.is_admin()
    OR EXISTS (SELECT 1 FROM public.farm_memberships m WHERE m.farm_id = farms.id AND m.user_id = auth.uid()));

DROP POLICY IF EXISTS sales_select ON public.sales;
CREATE POLICY sales_select ON public.sales FOR SELECT
  USING (public.get_farm_role(farm_id) IN ('admin', 'owner', 'manager')
    OR (public.get_farm_role(farm_id) = 'seller' AND seller_id = auth.uid()));
DROP POLICY IF EXISTS sales_insert ON public.sales;
CREATE POLICY sales_insert ON public.sales FOR INSERT
  WITH CHECK (
    seller_id = auth.uid()
    AND seller_email = COALESCE(auth.jwt() ->> 'email', '')
    AND public.get_farm_role(farm_id) IN ('admin', 'owner', 'manager', 'seller')
    AND ((discount_kes = 0 AND status = 'pending_check') OR (discount_kes > 0 AND status = 'discount_pending'))
    AND checked_by IS NULL AND checked_at IS NULL
    AND discount_kes <= quantity_kg * unit_price_kes
    AND total_kes = GREATEST(0, quantity_kg * unit_price_kes - discount_kes)
    AND discount_approved_by IS NULL AND discount_approved_at IS NULL
    AND void_requested_by IS NULL AND void_requested_at IS NULL
    AND voided_by IS NULL AND voided_at IS NULL AND void_reason IS NULL
    AND (payment_method = 'cash' OR NULLIF(BTRIM(payment_reference), '') IS NOT NULL)
  );

DROP POLICY IF EXISTS sales_audit_select ON public.sales_audit;
CREATE POLICY sales_audit_select ON public.sales_audit FOR SELECT
  USING (public.get_farm_role(farm_id) IN ('admin', 'owner', 'manager')
    OR EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND s.seller_id = auth.uid()));

DROP POLICY IF EXISTS stock_losses_select ON public.stock_losses;
CREATE POLICY stock_losses_select ON public.stock_losses FOR SELECT
  USING (public.get_farm_role(farm_id) IN ('admin', 'owner', 'manager', 'storekeeper'));
DROP POLICY IF EXISTS stock_losses_insert ON public.stock_losses;
CREATE POLICY stock_losses_insert ON public.stock_losses FOR INSERT
  WITH CHECK (recorded_by = auth.uid()
    AND public.get_farm_role(farm_id) IN ('admin', 'owner', 'manager', 'storekeeper'));

DROP POLICY IF EXISTS stock_counts_select ON public.stock_counts;
CREATE POLICY stock_counts_select ON public.stock_counts FOR SELECT
  USING (public.get_farm_role(farm_id) IN ('admin', 'owner', 'manager', 'storekeeper'));
DROP POLICY IF EXISTS stock_counts_insert ON public.stock_counts;
CREATE POLICY stock_counts_insert ON public.stock_counts FOR INSERT
  WITH CHECK (counted_by = auth.uid()
    AND status = 'pending_confirmation' AND confirmed_by IS NULL
    AND public.get_farm_role(farm_id) IN ('admin', 'owner', 'manager', 'storekeeper'));

DROP POLICY IF EXISTS stock_issues_select ON public.stock_issues;
CREATE POLICY stock_issues_select ON public.stock_issues FOR SELECT
  USING (public.get_farm_role(farm_id) IN ('admin', 'owner', 'manager', 'storekeeper'));
DROP POLICY IF EXISTS stock_issues_insert ON public.stock_issues;
CREATE POLICY stock_issues_insert ON public.stock_issues FOR INSERT
  WITH CHECK (requested_by = auth.uid()
    AND status = 'pending_approval'
    AND approved_by IS NULL AND issued_by IS NULL AND received_by IS NULL
    AND public.get_farm_role(farm_id) IN ('admin', 'owner', 'manager', 'storekeeper'));

REVOKE ALL ON FUNCTION public.approve_sale_discount(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_sale(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_sale_void(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_sale_void(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_stock_count(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_stock_issue(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_stock_issue_issued(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_stock_issue(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_sale_discount(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_sale(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_sale_void(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_sale_void(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_stock_count(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_stock_issue(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_stock_issue_issued(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_stock_issue(TEXT) TO authenticated;
