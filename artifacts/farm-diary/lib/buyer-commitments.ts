export interface BuyerCommitment {
  id: string;
  farm_id: string;
  season_id: string | null;
  buyer_name: string;
  product_name: string;
  weekly_kg: number;
  agreed_price_kes: number | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface SaleForCommitment {
  block_id?: string | null;
  buyer_name: string;
  product_name: string;
  quantity_kg: number;
  status: string;
  created_at: string;
}

const COUNTED = ["recorded", "void_requested"];
const norm = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const singular = (word: string): string => {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && /(oes|ses|xes|zes|ches|shes)$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
};
const stem = (text: string): string => norm(text).split(" ").map(singular).join(" ");

export const sameBuyer = (a: string, b: string): boolean => norm(a) !== "" && norm(a) === norm(b);
export const sameProduct = (a: string, b: string): boolean => stem(a) !== "" && stem(a) === stem(b);

const pad = (value: number): string => String(value).padStart(2, "0");

export function dateKey(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function weekStart(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return addDays(key, -((weekday + 6) % 7));
}

export type CommitmentStatus = "met" | "open" | "not_started" | "ended";

export interface CommitmentProgress {
  weekStart: string;
  weekEnd: string;
  expectedKg: number;
  soldKg: number;
  remainingKg: number;
  extraKg: number;
  pct: number;
  lastWeekSoldKg: number;
  status: CommitmentStatus;
}

export function commitmentProgress(
  commitment: BuyerCommitment,
  sales: readonly SaleForCommitment[],
  today: string,
  cropOfBlock?: (blockId: string) => string | null,
): CommitmentProgress {
  const start = weekStart(today);
  const end = addDays(start, 6);
  const previousStart = addDays(start, -7);
  const previousEnd = addDays(start, -1);
  let sold = 0;
  let previous = 0;
  for (const sale of sales) {
    if (!COUNTED.includes(sale.status) || !sameBuyer(commitment.buyer_name, sale.buyer_name)) continue;
    const blockCrop = cropOfBlock && sale.block_id ? cropOfBlock(sale.block_id) : null;
    if (!sameProduct(commitment.product_name, sale.product_name)
      && !(blockCrop && sameProduct(commitment.product_name, blockCrop))) continue;
    const day = dateKey(sale.created_at);
    const quantity = Number(sale.quantity_kg);
    if (!day || !Number.isFinite(quantity) || quantity <= 0) continue;
    if (day >= start && day <= end) sold += quantity;
    else if (day >= previousStart && day <= previousEnd) previous += quantity;
  }
  const expected = Number(commitment.weekly_kg) > 0 ? Number(commitment.weekly_kg) : 0;
  let status: CommitmentStatus = sold >= expected && expected > 0 ? "met" : "open";
  if (commitment.start_date && today < commitment.start_date) status = "not_started";
  else if (commitment.end_date && today > commitment.end_date) status = "ended";
  return {
    weekStart: start,
    weekEnd: end,
    expectedKg: expected,
    soldKg: sold,
    remainingKg: Math.max(0, expected - sold),
    extraKg: Math.max(0, sold - expected),
    pct: expected > 0 ? Math.min(100, Math.round((sold / expected) * 100)) : 0,
    lastWeekSoldKg: previous,
    status,
  };
}

export interface CommitmentInput {
  buyer_name: string;
  product_name: string;
  weekly_kg: string;
  agreed_price_kes: string;
  start_date: string;
  end_date: string;
}

const validDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

export function validateCommitment(input: CommitmentInput): string | null {
  if (!input.buyer_name.trim()) return "Enter the buyer's name.";
  if (!input.product_name.trim()) return "Enter the crop or product.";
  const kg = Number(input.weekly_kg.replace(",", "."));
  if (!input.weekly_kg.trim() || !Number.isFinite(kg) || kg <= 0) {
    return "Enter the agreed weekly kg as a number above 0.";
  }
  if (input.agreed_price_kes.trim()) {
    const price = Number(input.agreed_price_kes.replace(",", "."));
    if (!Number.isFinite(price) || price < 0) return "The agreed price must be a number, or leave it empty.";
  }
  if (input.start_date.trim() && !validDate(input.start_date.trim())) return "Start date must look like 2026-11-30.";
  if (input.end_date.trim() && !validDate(input.end_date.trim())) return "End date must look like 2026-12-31.";
  if (input.start_date.trim() && input.end_date.trim() && input.end_date.trim() < input.start_date.trim()) {
    return "End date is before the start date.";
  }
  return null;
}
