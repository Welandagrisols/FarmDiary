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

export function matchCommitmentBuyerCrop(
  commitment: Pick<BuyerCommitment, "buyer_name" | "product_name">,
  sale: Pick<SaleForCommitment, "buyer_name" | "product_name" | "block_id">,
  cropOfBlock?: (blockId: string) => string | null,
): { matches: boolean; matchedViaBlockCrop: string | null } {
  if (!sameBuyer(commitment.buyer_name, sale.buyer_name)) {
    return { matches: false, matchedViaBlockCrop: null };
  }
  if (sameProduct(commitment.product_name, sale.product_name)) {
    return { matches: true, matchedViaBlockCrop: null };
  }
  const blockCrop = cropOfBlock && sale.block_id ? cropOfBlock(sale.block_id) : null;
  if (blockCrop && sameProduct(commitment.product_name, blockCrop)) {
    return { matches: true, matchedViaBlockCrop: blockCrop };
  }
  return { matches: false, matchedViaBlockCrop: null };
}

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
    if (!bucket) continue;
    const identityMatch = matchCommitmentBuyerCrop(commitment, sale, cropOfBlock);
    if (!identityMatch.matches) continue;
    const date = dateKey(sale.created_at);
    const quantityKg = Number(sale.quantity_kg);
    if (!date || date < from || date > through || !Number.isFinite(quantityKg) || quantityKg <= 0) continue;
    matches.push({
      sale,
      date,
      bucket,
      quantityKg,
      matchedViaBlockCrop: identityMatch.matchedViaBlockCrop,
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

export interface WeeklyCommitmentSummaryRow {
  commitment: BuyerCommitment;
  progress: CommitmentProgress;
}

export interface WeeklyBuyerDeliverySummary {
  weekStart: string;
  weekEnd: string;
  rows: WeeklyCommitmentSummaryRow[];
  expectedKg: number;
  soldKg: number;
  bookedKg: number;
  remainingKg: number;
  ambiguousSalesCount: number;
}

function saleSummaryKey(sale: SaleForCommitment): string | SaleForCommitment {
  if (sale.id) return `id:${sale.id}`;
  if (sale.receipt_number) return `receipt:${sale.receipt_number}`;
  return sale;
}

export function weeklyBuyerDeliverySummary(
  commitments: readonly BuyerCommitment[],
  sales: readonly SaleForCommitment[],
  today: string,
  seasonId: string | null | undefined,
  cropOfBlock?: (blockId: string) => string | null,
): WeeklyBuyerDeliverySummary {
  const start = weekStart(today);
  const end = addDays(start, 6);
  const rows = commitments
    .filter((commitment) =>
      (!commitment.season_id || commitment.season_id === seasonId)
      && (!commitment.start_date || commitment.start_date <= today)
      && (!commitment.end_date || commitment.end_date >= today)
    )
    .map((commitment) => ({
      commitment,
      progress: commitmentProgress(commitment, sales, today, cropOfBlock),
    }));

  const salesByKey = new Map<string | SaleForCommitment, CommitmentSaleContribution>();
  const matchesByKey = new Map<string | SaleForCommitment, number>();
  for (const { progress } of rows) {
    for (const contribution of progress.currentWeekSales) {
      const key = saleSummaryKey(contribution.sale);
      matchesByKey.set(key, (matchesByKey.get(key) ?? 0) + 1);
      if (!salesByKey.has(key)) salesByKey.set(key, contribution);
    }
  }

  const uniqueSales = [...salesByKey.values()];
  const expectedKg = rows.reduce((total, row) => total + row.progress.expectedKg, 0);
  const soldKg = uniqueSales
    .filter((contribution) => contribution.bucket === "sold")
    .reduce((total, contribution) => total + contribution.quantityKg, 0);
  const bookedKg = uniqueSales
    .filter((contribution) => contribution.bucket === "booked")
    .reduce((total, contribution) => total + contribution.quantityKg, 0);

  return {
    weekStart: start,
    weekEnd: end,
    rows,
    expectedKg,
    soldKg,
    bookedKg,
    remainingKg: Math.max(0, expectedKg - soldKg - bookedKg),
    ambiguousSalesCount: [...matchesByKey.values()].filter((count) => count > 1).length,
  };
}

const formatSummaryKg = (value: number): string =>
  `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`;

export function weeklyBuyerDeliveryShareText(
  summary: WeeklyBuyerDeliverySummary,
  context: { farmName?: string | null; seasonName?: string | null } = {},
): string {
  const lines = [
    `${context.farmName?.trim() || "Farm"} · Weekly buyer delivery summary`,
    context.seasonName?.trim() ? `Season: ${context.seasonName.trim()}` : null,
    `Week: ${summary.weekStart} to ${summary.weekEnd}`,
    "",
    "Farm totals",
    `Expected: ${formatSummaryKg(summary.expectedKg)}`,
    `Sold: ${formatSummaryKg(summary.soldKg)}`,
    `Booked: ${formatSummaryKg(summary.bookedKg)}`,
    `Remaining: ${formatSummaryKg(summary.remainingKg)}`,
    "",
    "By commitment",
    ...(summary.rows.length > 0
      ? summary.rows.map(({ commitment, progress }) =>
        `${commitment.buyer_name} · ${commitment.product_name}\n`
          + `  Expected ${formatSummaryKg(progress.expectedKg)} · Sold ${formatSummaryKg(progress.soldKg)}`
          + ` · Booked ${formatSummaryKg(progress.bookedKg)} · Remaining ${formatSummaryKg(progress.remainingKg)}`
      )
      : ["No active commitments this week."]),
    summary.ambiguousSalesCount > 0
      ? `Note: ${summary.ambiguousSalesCount} sale${summary.ambiguousSalesCount === 1 ? "" : "s"} matched more than one commitment and are counted once in farm totals.`
      : null,
  ];
  return lines.filter((line): line is string => line !== null).join("\n");
}

export function activeCommitmentsMatchingSale(
  commitments: readonly BuyerCommitment[],
  sale: Pick<SaleForCommitment, "buyer_name" | "product_name" | "block_id">,
  today: string,
  seasonId: string | null | undefined,
  cropOfBlock?: (blockId: string) => string | null,
): BuyerCommitment[] {
  return commitments.filter((commitment) =>
    (!commitment.season_id || commitment.season_id === seasonId)
    && (!commitment.start_date || today >= commitment.start_date)
    && (!commitment.end_date || today <= commitment.end_date)
    && matchCommitmentBuyerCrop(commitment, sale, cropOfBlock).matches
  );
}

export interface CommitmentSaleSuggestion {
  kind: "none" | "ambiguous" | "single";
  matches: BuyerCommitment[];
  progress: CommitmentProgress | null;
}

export function commitmentSuggestionForSale(
  commitments: readonly BuyerCommitment[],
  sales: readonly SaleForCommitment[],
  sale: Pick<SaleForCommitment, "buyer_name" | "product_name" | "block_id">,
  today: string,
  seasonId: string | null | undefined,
  cropOfBlock?: (blockId: string) => string | null,
): CommitmentSaleSuggestion {
  const matches = activeCommitmentsMatchingSale(
    commitments,
    sale,
    today,
    seasonId,
    cropOfBlock,
  );
  if (matches.length === 0) return { kind: "none", matches, progress: null };
  if (matches.length > 1) return { kind: "ambiguous", matches, progress: null };
  return {
    kind: "single",
    matches,
    progress: commitmentProgress(matches[0], sales, today, cropOfBlock),
  };
}

export function suggestedPriceInputValue(currentPrice: string, agreedPrice: number | null): string | null {
  if (currentPrice.trim() || agreedPrice == null) return null;
  const price = Number(agreedPrice);
  return Number.isFinite(price) && price >= 0 ? String(price) : null;
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
