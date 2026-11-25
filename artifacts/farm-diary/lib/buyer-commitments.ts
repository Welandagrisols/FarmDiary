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
  id?: string;
  receipt_number?: string;
  block_id?: string | null;
  buyer_name: string;
  product_name: string;
  quantity_kg: number;
  status: string;
  created_at: string;
}

const SOLD_STATUSES = ["recorded", "void_requested"];
const BOOKED_STATUSES = ["pending_check", "discount_pending"];
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

export type CommitmentStatus = "met" | "booked" | "open" | "not_started" | "ended";

export interface CommitmentProgress {
  weekStart: string;
  weekEnd: string;
  expectedKg: number;
  soldKg: number;
  bookedKg: number;
  remainingKg: number;
  extraKg: number;
  pct: number;
  lastWeekSoldKg: number;
  lastWeekBookedKg: number;
  currentWeekSales: CommitmentSaleContribution[];
  status: CommitmentStatus;
}

export interface CommitmentSaleContribution {
  sale: SaleForCommitment;
  date: string;
  bucket: "sold" | "booked";
  quantityKg: number;
  matchedViaBlockCrop: string | null;
}

function saleBucket(status: string): CommitmentSaleContribution["bucket"] | null {
  if (SOLD_STATUSES.includes(status)) return "sold";
  if (BOOKED_STATUSES.includes(status)) return "booked";
  return null;
}

function salesForPeriod(
  commitment: BuyerCommitment,
  sales: readonly SaleForCommitment[],
  from: string,
  through: string,
  cropOfBlock?: (blockId: string) => string | null,
): CommitmentSaleContribution[] {
  const matches: CommitmentSaleContribution[] = [];
  for (const sale of sales) {
    const bucket = saleBucket(sale.status);
    if (!bucket || !sameBuyer(commitment.buyer_name, sale.buyer_name)) continue;
    const blockCrop = cropOfBlock && sale.block_id ? cropOfBlock(sale.block_id) : null;
    const matchesProductName = sameProduct(commitment.product_name, sale.product_name);
    if (!matchesProductName && !(blockCrop && sameProduct(commitment.product_name, blockCrop))) continue;
    const date = dateKey(sale.created_at);
    const quantityKg = Number(sale.quantity_kg);
    if (!date || date < from || date > through || !Number.isFinite(quantityKg) || quantityKg <= 0) continue;
    matches.push({
      sale,
      date,
      bucket,
      quantityKg,
      matchedViaBlockCrop: matchesProductName ? null : blockCrop,
    });
  }
  return matches;
}

export function ambiguousCommitmentSales(
  commitments: readonly BuyerCommitment[],
  sales: readonly SaleForCommitment[],
  today: string,
  cropOfBlock?: (blockId: string) => string | null,
): Map<SaleForCommitment, BuyerCommitment[]> {
  const from = weekStart(today);
  const through = addDays(from, 6);
  const matchesBySale = new Map<SaleForCommitment, BuyerCommitment[]>();

  for (const commitment of commitments) {
    for (const { sale } of salesForPeriod(commitment, sales, from, through, cropOfBlock)) {
      const matches = matchesBySale.get(sale) ?? [];
      matches.push(commitment);
      matchesBySale.set(sale, matches);
    }
  }

  return new Map(
    [...matchesBySale.entries()].filter(([, matches]) => matches.length > 1),
  );
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
  const currentWeekSales = salesForPeriod(commitment, sales, start, end, cropOfBlock);
  const previousWeekSales = salesForPeriod(commitment, sales, previousStart, previousEnd, cropOfBlock);
  const sold = currentWeekSales
    .filter((match) => match.bucket === "sold")
    .reduce((total, match) => total + match.quantityKg, 0);
  const booked = currentWeekSales
    .filter((match) => match.bucket === "booked")
    .reduce((total, match) => total + match.quantityKg, 0);
  const previous = previousWeekSales
    .filter((match) => match.bucket === "sold")
    .reduce((total, match) => total + match.quantityKg, 0);
  const previousBooked = previousWeekSales
    .filter((match) => match.bucket === "booked")
    .reduce((total, match) => total + match.quantityKg, 0);
  const expected = Number(commitment.weekly_kg) > 0 ? Number(commitment.weekly_kg) : 0;
  let status: CommitmentStatus = sold >= expected && expected > 0 ? "met" : "open";
  if (expected > 0 && sold < expected && sold + booked >= expected) status = "booked";
  if (commitment.start_date && today < commitment.start_date) status = "not_started";
  else if (commitment.end_date && today > commitment.end_date) status = "ended";
  const committed = sold + booked;
  return {
    weekStart: start,
    weekEnd: end,
    expectedKg: expected,
    soldKg: sold,
    bookedKg: booked,
    remainingKg: Math.max(0, expected - committed),
    extraKg: Math.max(0, committed - expected),
    pct: expected > 0 ? Math.min(100, Math.round((committed / expected) * 100)) : 0,
    lastWeekSoldKg: previous,
    lastWeekBookedKg: previousBooked,
    currentWeekSales,
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
