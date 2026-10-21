import { supabase } from "@/lib/supabase";

export type FarmRole = "admin" | "owner" | "manager" | "seller" | "storekeeper" | "none";
export type SaleStatus = "pending_check" | "discount_pending" | "recorded" | "void_requested" | "voided";

export interface SaleRecord {
  id: string;
  receipt_number: string;
  farm_id: string;
  season_id: string;
  block_id: string | null;
  seller_id: string;
  seller_email: string;
  product_name: string;
  buyer_name: string;
  quantity_kg: number;
  unit_price_kes: number;
  discount_kes: number;
  total_kes: number;
  payment_method: "mpesa" | "cash" | "bank";
  payment_reference: string | null;
  status: SaleStatus;
  check_note: string | null;
  checked_by: string | null;
  checked_by_email: string | null;
  checked_at: string | null;
  discount_approved_by: string | null;
  discount_approved_by_email: string | null;
  discount_approved_at: string | null;
  discount_approval_reason: string | null;
  void_requested_by_email: string | null;
  void_request_reason: string | null;
  voided_by_email: string | null;
  void_reason: string | null;
  created_at: string;
}

export interface StockLossRecord {
  id: string;
  farm_id: string;
  season_id: string;
  product_name: string;
  loss_date: string;
  quantity_kg: number;
  reason: string;
  recorded_by: string;
  created_at: string;
}

export interface SeasonStockTotals {
  harvested_kg: number;
  sold_kg: number;
  lost_kg: number;
  issued_kg: number;
  today_harvested_kg: number;
  today_sold_kg: number;
  today_lost_kg: number;
  today_sales_count: number;
  today_sales_kes: number;
}

export interface StockCountRecord {
  id: string;
  farm_id: string;
  season_id: string;
  product_name: string;
  count_date: string;
  quantity_kg: number;
  counted_by: string;
  confirmed_by: string | null;
  status: "pending_confirmation" | "confirmed";
  created_at: string;
}

export interface StockIssueRecord {
  id: string;
  farm_id: string;
  season_id: string;
  product_name: string;
  quantity_kg: number;
  purpose: string;
  requested_by: string;
  approved_by: string | null;
  issued_by: string | null;
  received_by: string | null;
  status: "pending_approval" | "approved" | "issued" | "confirmed";
  created_at: string;
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function getSignedInUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("Sign in before recording farm transactions.");
  return user;
}

export async function getFarmRole(farmId: string): Promise<FarmRole> {
  const { data, error } = await supabase.rpc("get_farm_role", { p_farm_id: farmId });
  if (error) throw error;
  return (data || "none") as FarmRole;
}

export async function getSales(farmId: string, seasonId: string): Promise<SaleRecord[]> {
  const { data, error } = await supabase
    .from("sales")
    .select("*")
    .eq("farm_id", farmId)
    .eq("season_id", seasonId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as SaleRecord[];
}

export async function createSale(input: {
  farmId: string;
  seasonId: string;
  blockId: string | null;
  productName: string;
  buyerName: string;
  quantityKg: number;
  unitPriceKes: number;
  discountKes: number;
  paymentMethod: "mpesa" | "cash" | "bank";
  paymentReference: string;
}): Promise<SaleRecord> {
  const user = await getSignedInUser();
  const subtotal = input.quantityKg * input.unitPriceKes;
  const status: SaleStatus = input.discountKes > 0 ? "discount_pending" : "pending_check";
  const { data, error } = await supabase.from("sales").insert({
    id: makeId("sale"),
    receipt_number: `FD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    farm_id: input.farmId,
    season_id: input.seasonId,
    block_id: input.blockId,
    seller_id: user.id,
    seller_email: user.email || "Farm staff",
    product_name: input.productName,
    buyer_name: input.buyerName.trim(),
    quantity_kg: input.quantityKg,
    unit_price_kes: input.unitPriceKes,
    discount_kes: input.discountKes,
    total_kes: subtotal - input.discountKes,
    payment_method: input.paymentMethod,
    payment_reference: input.paymentReference.trim() || null,
    status,
  }).select("*").single();
  if (error) throw error;
  return data as SaleRecord;
}

export async function approveSaleDiscount(saleId: string, reason: string) {
  const { error } = await supabase.rpc("approve_sale_discount", {
    p_sale_id: saleId,
    p_reason: reason.trim(),
  });
  if (error) throw error;
}

export async function checkSale(saleId: string, reason: string) {
  const { error } = await supabase.rpc("check_sale", {
    p_sale_id: saleId,
    p_reason: reason.trim(),
  });
  if (error) throw error;
}

export async function requestSaleVoid(saleId: string, reason: string) {
  const { error } = await supabase.rpc("request_sale_void", {
    p_sale_id: saleId,
    p_reason: reason.trim(),
  });
  if (error) throw error;
}

export async function approveSaleVoid(saleId: string, reason: string) {
  const { error } = await supabase.rpc("approve_sale_void", {
    p_sale_id: saleId,
    p_reason: reason.trim(),
  });
  if (error) throw error;
}

export async function getStockLosses(farmId: string, seasonId: string): Promise<StockLossRecord[]> {
  const { data, error } = await supabase.from("stock_losses").select("*")
    .eq("farm_id", farmId).eq("season_id", seasonId)
    .order("loss_date", { ascending: false });
  if (error) throw error;
  return (data || []) as StockLossRecord[];
}

export async function getSeasonStockTotals(
  farmId: string,
  seasonId: string,
  today: string,
): Promise<SeasonStockTotals> {
  const { data, error } = await supabase.rpc("get_season_stock_totals", {
    p_farm_id: farmId,
    p_season_id: seasonId,
    p_today: today,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Stock totals were not returned.");
  return {
    harvested_kg: Number(row.harvested_kg) || 0,
    sold_kg: Number(row.sold_kg) || 0,
    lost_kg: Number(row.lost_kg) || 0,
    issued_kg: Number(row.issued_kg) || 0,
    today_harvested_kg: Number(row.today_harvested_kg) || 0,
    today_sold_kg: Number(row.today_sold_kg) || 0,
    today_lost_kg: Number(row.today_lost_kg) || 0,
    today_sales_count: Number(row.today_sales_count) || 0,
    today_sales_kes: Number(row.today_sales_kes) || 0,
  };
}

export async function recordStockLoss(input: {
  farmId: string;
  seasonId: string;
  productName: string;
  quantityKg: number;
  reason: string;
}): Promise<void> {
  const user = await getSignedInUser();
  const { error } = await supabase.from("stock_losses").insert({
    id: makeId("loss"),
    farm_id: input.farmId,
    season_id: input.seasonId,
    product_name: input.productName,
    loss_date: localDateKey(),
    quantity_kg: input.quantityKg,
    reason: input.reason.trim(),
    recorded_by: user.id,
  });
  if (error) throw error;
}

export async function getStockCounts(farmId: string, seasonId: string): Promise<StockCountRecord[]> {
  const { data, error } = await supabase.from("stock_counts").select("*")
    .eq("farm_id", farmId).eq("season_id", seasonId)
    .order("count_date", { ascending: false });
  if (error) throw error;
  return (data || []) as StockCountRecord[];
}

export async function recordStockCount(input: {
  farmId: string;
  seasonId: string;
  productName: string;
  quantityKg: number;
}): Promise<void> {
  const user = await getSignedInUser();
  const { error } = await supabase.from("stock_counts").insert({
    id: makeId("count"),
    farm_id: input.farmId,
    season_id: input.seasonId,
    product_name: input.productName,
    count_date: localDateKey(),
    quantity_kg: input.quantityKg,
    counted_by: user.id,
  });
  if (error) throw error;
}

export async function confirmStockCount(countId: string) {
  const { error } = await supabase.rpc("confirm_stock_count", { p_count_id: countId });
  if (error) throw error;
}

export async function getStockIssues(farmId: string, seasonId: string): Promise<StockIssueRecord[]> {
  const { data, error } = await supabase.from("stock_issues").select("*")
    .eq("farm_id", farmId).eq("season_id", seasonId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as StockIssueRecord[];
}

export async function requestStockIssue(input: {
  farmId: string;
  seasonId: string;
  productName: string;
  quantityKg: number;
  purpose: string;
}): Promise<void> {
  const user = await getSignedInUser();
  const { error } = await supabase.from("stock_issues").insert({
    id: makeId("issue"),
    farm_id: input.farmId,
    season_id: input.seasonId,
    product_name: input.productName,
    quantity_kg: input.quantityKg,
    purpose: input.purpose.trim(),
    requested_by: user.id,
  });
  if (error) throw error;
}

export async function approveStockIssue(issueId: string) {
  const { error } = await supabase.rpc("approve_stock_issue", { p_issue_id: issueId });
  if (error) throw error;
}

export async function markStockIssueIssued(issueId: string) {
  const { error } = await supabase.rpc("mark_stock_issue_issued", { p_issue_id: issueId });
  if (error) throw error;
}

export async function confirmStockIssue(issueId: string) {
  const { error } = await supabase.rpc("confirm_stock_issue", { p_issue_id: issueId });
  if (error) throw error;
}
