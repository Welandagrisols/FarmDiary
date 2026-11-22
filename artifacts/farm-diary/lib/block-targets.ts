export interface BlockTargets {
  target_yield_kg?: number | null;
  expected_price_kes_per_kg?: number | null;
}

export function parseTarget(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (t === "") return null;
  if (!/^\d*\.?\d+$|^\d+\.$/.test(t)) return Number.NaN;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : Number.NaN;
}

export function validateTargets(yieldText: string, priceText: string): string | null {
  if (Number.isNaN(parseTarget(yieldText))) return "Target yield must be a number of kg above 0, or leave it empty.";
  if (Number.isNaN(parseTarget(priceText))) return "Expected price must be a number in KES per kg above 0, or leave it empty.";
  return null;
}

export function targetFieldsForSave(yieldText: string, priceText: string): BlockTargets {
  const out: BlockTargets = {};
  const yieldKg = parseTarget(yieldText);
  const price = parseTarget(priceText);
  if (yieldKg !== null && !Number.isNaN(yieldKg)) out.target_yield_kg = yieldKg;
  if (price !== null && !Number.isNaN(price)) out.expected_price_kes_per_kg = price;
  return out;
}

export interface TargetProgress {
  hasTarget: boolean;
  targetKg: number | null;
  actualKg: number;
  pct: number | null;
  gapKg: number | null;
  expectedRevenueKes: number | null;
  actualSalesKes: number;
  revenueGapKes: number | null;
  weightsMissing: boolean;
}

const positive = (value: unknown): number => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

export function targetProgress(
  block: BlockTargets,
  harvest: readonly { bags?: number | null; total_kg?: number | null }[],
  salesKes: number,
): TargetProgress {
  const targetKg = positive(block.target_yield_kg) || null;
  const price = positive(block.expected_price_kes_per_kg) || null;
  const actualKg = harvest.reduce((sum, record) => sum + positive(record.total_kg), 0);
  const weightsMissing = harvest.some((record) => positive(record.bags) > 0 && positive(record.total_kg) === 0);
  const expectedRevenueKes = targetKg && price ? targetKg * price : null;
  const actualSalesKes = positive(salesKes);
  return {
    hasTarget: targetKg !== null || price !== null,
    targetKg,
    actualKg,
    pct: targetKg ? (actualKg / targetKg) * 100 : null,
    gapKg: targetKg ? actualKg - targetKg : null,
    expectedRevenueKes,
    actualSalesKes,
    revenueGapKes: expectedRevenueKes !== null ? actualSalesKes - expectedRevenueKes : null,
    weightsMissing,
  };
}
