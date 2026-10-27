// The one place season money totals are worked out. Dashboard, Costs tab, Season Report,
// Season History and Export all call this, so they can never disagree.
//
// Revenue rules (these match how the app records money today):
//  * Sales ledger: sales with status "recorded" or "void_requested" count. Sales waiting to be
//    checked ("pending_check", "discount_pending") are shown separately and NOT counted.
//    Voided sales never count.
//  * Harvest records: new harvest entries are saved with revenue 0 (the money lives in the sales
//    ledger), so only OLD harvest records that carry revenue and were created before sales tracking
//    (no recorded_by) add to revenue. Counting both would double-count.
//  * Only owners/managers/admins see the old harvest revenue; other roles see the sales they can see.

export type MoneyValue = number | string | null | undefined;

const num = (v: MoneyValue): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const COUNTED_SALE_STATUSES = ["recorded", "void_requested"];
export const PENDING_SALE_STATUSES = ["pending_check", "discount_pending"];

export interface CostLike { season_id: string; amount_kes: MoneyValue }
export interface HarvestLike { season_id: string; recorded_by?: string | null; total_revenue_kes: MoneyValue }
export interface SaleLike { season_id?: string | null; status: string; total_kes: MoneyValue }

export interface SeasonFinance {
  costs: number;
  legacyHarvestRevenue: number;
  salesRevenue: number;
  pendingSalesValue: number;
  revenue: number;
  net: number;
  /** null when there is no revenue to measure against. */
  marginPct: number | null;
}

export const isLegacyHarvestRecord = (record: Pick<HarvestLike, "recorded_by">): boolean => !record.recorded_by;

export function seasonCostTotal(costs: readonly CostLike[], seasonId: string): number {
  return costs.reduce((sum, cost) => (cost.season_id === seasonId ? sum + num(cost.amount_kes) : sum), 0);
}

export function seasonFinance(input: {
  seasonId: string;
  costs: readonly CostLike[];
  harvest: readonly HarvestLike[];
  sales: readonly SaleLike[];
  /** Owners, managers and admins. Others do not get the old harvest revenue added. */
  includeHarvestRevenue: boolean;
}): SeasonFinance {
  const { seasonId } = input;
  const costs = seasonCostTotal(input.costs, seasonId);
  const inSeason = (sale: SaleLike) => !sale.season_id || sale.season_id === seasonId;

  const legacyHarvestRevenue = input.includeHarvestRevenue
    ? input.harvest
        .filter((r) => r.season_id === seasonId && isLegacyHarvestRecord(r))
        .reduce((sum, r) => sum + num(r.total_revenue_kes), 0)
    : 0;
  const salesRevenue = input.sales
    .filter((s) => inSeason(s) && COUNTED_SALE_STATUSES.includes(s.status))
    .reduce((sum, s) => sum + num(s.total_kes), 0);
  const pendingSalesValue = input.sales
    .filter((s) => inSeason(s) && PENDING_SALE_STATUSES.includes(s.status))
    .reduce((sum, s) => sum + num(s.total_kes), 0);

  const revenue = legacyHarvestRevenue + salesRevenue;
  const net = revenue - costs;
  return { costs, legacyHarvestRevenue, salesRevenue, pendingSalesValue, revenue, net, marginPct: revenue > 0 ? (net / revenue) * 100 : null };
}

export function groupBySeason<T extends { season_id?: string | null }>(rows: readonly T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    if (!row.season_id) continue;
    map.set(row.season_id, [...(map.get(row.season_id) ?? []), row]);
  }
  return map;
}
