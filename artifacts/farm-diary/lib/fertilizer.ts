// Fertilizer plan arithmetic. Pure TypeScript (no React Native / Supabase) so the app and `npm test` share it.
//
// What this does and does NOT do:
//  * It does NOT decide how much fertilizer a soil needs. The rates come from the lab's written advice or from an
//    advisor who typed them in. Nothing here invents an agronomic recommendation or a soil threshold.
//  * It only does arithmetic on those rates: reading "100kg/acre", scaling to a plot's area, working out how many
//    kg of N, P2O5 and K2O a plan supplies, and finding product swaps that deliver the same nutrients.
//  * If a rate cannot be read or scaled with certainty, it says so instead of guessing.

import type { RecommendationItem, SoilResult } from "./soil";

export const ACRES_PER_HECTARE = 2.47105;
/** Elemental P and K from the oxide forms fertilizers are labelled in. */
export const P_PER_P2O5 = 0.4364;
export const K_PER_K2O = 0.8301;

export interface Grade { n: number; p2o5: number; k2o: number }
export type NutrientKey = keyof Grade;
export const NUTRIENTS: NutrientKey[] = ["n", "p2o5", "k2o"];
export const NUTRIENT_LABELS: Record<NutrientKey, string> = { n: "N", p2o5: "P₂O₅", k2o: "K₂O" };

export type ProductKind = "npk" | "lime" | "organic" | "other";
export interface DetectedProduct {
  label: string;
  kind: ProductKind;
  grade: Grade | null;
  /** "report": the grade was written in the advice itself. "standard": a typical declared grade; check the bag. */
  gradeSource: "report" | "standard" | null;
}

interface StandardProduct { label: string; grade: Grade; pattern: RegExp }
// Typical declared grades (% N, % P2O5, % K2O). The bag's label always wins; the plan says when a grade is assumed.
export const STANDARD_PRODUCTS: StandardProduct[] = [
  { label: "Urea", grade: { n: 46, p2o5: 0, k2o: 0 }, pattern: /\burea\b/i },
  { label: "CAN", grade: { n: 26, p2o5: 0, k2o: 0 }, pattern: /\bCAN\b|calcium ammonium nitrate/ },
  { label: "DAP", grade: { n: 18, p2o5: 46, k2o: 0 }, pattern: /\bDAP\b|di-?ammonium phosphate/i },
  { label: "TSP", grade: { n: 0, p2o5: 46, k2o: 0 }, pattern: /\bTSP\b|triple super ?phosphate/i },
  { label: "MOP", grade: { n: 0, p2o5: 0, k2o: 60 }, pattern: /\bMOP\b|muriate of potash|potassium chloride/i },
  { label: "Sulphate of ammonia", grade: { n: 21, p2o5: 0, k2o: 0 }, pattern: /sulphate of ammonia|ammonium sulphate/i },
];
export const SWAP_CANDIDATES = STANDARD_PRODUCTS.map((p) => ({ label: p.label, grade: p.grade }));

/** Finds what product a piece of advice is about. Looks for a written NPK grade first, then well-known product names. */
export function detectProduct(text: string): DetectedProduct | null {
  const colon = /(\d{1,2}(?:\.\d)?)\s*:\s*(\d{1,2}(?:\.\d)?)\s*:\s*(\d{1,2}(?:\.\d)?)/.exec(text);
  const hyphen = /\bN\.?P\.?K\.?\b[^0-9]{0,12}(\d{1,2}(?:\.\d)?)\s*-\s*(\d{1,2}(?:\.\d)?)\s*-\s*(\d{1,2}(?:\.\d)?)/i.exec(text);
  const m = colon ?? hyphen;
  if (m) {
    const grade = { n: Number(m[1]), p2o5: Number(m[2]), k2o: Number(m[3]) };
    if (grade.n + grade.p2o5 + grade.k2o > 0 && grade.n + grade.p2o5 + grade.k2o <= 100) {
      return { label: `NPK ${m[1]}:${m[2]}:${m[3]}`, kind: "npk", grade, gradeSource: "report" };
    }
  }
  for (const p of STANDARD_PRODUCTS) {
    if (p.pattern.test(text)) return { label: p.label, kind: "npk", grade: p.grade, gradeSource: "standard" };
  }
  if (/\b(agricultural )?lime(stone)?\b|\bdolomite\b/i.test(text)) return { label: "Lime", kind: "lime", grade: null, gradeSource: null };
  if (/\bmanure\b|\bcompost\b|\bfarm ?yard\b|\bFYM\b/i.test(text)) return { label: "Manure / compost", kind: "organic", grade: null, gradeSource: null };
  return null;
}

// ───────────── reading a rate as printed ─────────────

export type RateUnit = "kg" | "g" | "t" | "l" | "ml" | "handful" | "bag";
export type RateBasis = "acre" | "ha" | "plant" | "tree" | "hole";
export interface ParsedRate {
  amount: number;
  unit: RateUnit;
  basis: RateBasis | null;
  /** True when the basis was taken from the wording of the advice ("per hole") rather than from the rate itself. */
  basisFromAdvice: boolean;
}

const UNIT_WORDS: Record<string, RateUnit> = {
  kg: "kg", kgs: "kg", kilogram: "kg", kilograms: "kg", g: "g", gm: "g", gms: "g", gram: "g", grams: "g",
  t: "t", tonne: "t", tonnes: "t", ton: "t", tons: "t", l: "l", litre: "l", litres: "l", liter: "l", liters: "l",
  ml: "ml", handful: "handful", handfuls: "handful", bag: "bag", bags: "bag",
};
const BASIS_WORDS: Record<string, RateBasis> = {
  acre: "acre", acres: "acre", ac: "acre", ha: "ha", hectare: "ha", hectares: "ha",
  plant: "plant", plants: "plant", stool: "plant", mound: "plant", tree: "tree", trees: "tree", vine: "tree", hole: "hole", holes: "hole",
};

export function parseRate(rate: string | null | undefined, action = ""): ParsedRate | null {
  if (!rate) return null;
  const m = /(\d+(?:[.,]\d+)?)\s*(kgs?|kilograms?|gms?|grams?|g|tonnes?|tons?|t|litres?|liters?|l|ml|handfuls?|bags?)\b(?:\s*(?:\/|per|a)\s*(acres?|ac|ha|hectares?|plants?|stools?|mounds?|trees?|vines?|holes?)\b)?/i.exec(rate);
  if (!m) return null;
  const amount = Number(m[1].replace(",", "."));
  const unit = UNIT_WORDS[m[2].toLowerCase()];
  if (!Number.isFinite(amount) || amount <= 0 || !unit) return null;
  if (m[3]) return { amount, unit, basis: BASIS_WORDS[m[3].toLowerCase()] ?? null, basisFromAdvice: false };
  const fromAdvice = /\bper\s+(plant|tree|hole|acre|hectare|ha|stool|mound|vine)\b/i.exec(`${rate} ${action}`);
  return { amount, unit, basis: fromAdvice ? BASIS_WORDS[fromAdvice[1].toLowerCase()] : null, basisFromAdvice: !!fromAdvice };
}

/** Weight in kg when the unit is a weight; null for litres, handfuls and bags (a bag's size is not assumed). */
export function toKg(amount: number, unit: RateUnit): number | null {
  if (unit === "kg") return amount;
  if (unit === "g") return amount / 1000;
  if (unit === "t") return amount * 1000;
  return null;
}

// ───────────── scaling to a plot ─────────────

export interface PlanContext {
  areaAcres: number | null;
  /** Number of plants, trees or planting holes, for rates given per plant/tree/hole. */
  count: number | null;
}
export type Scaled =
  | { ok: true; amount: number; unit: RateUnit; kg: number | null; basis: "area" | "count" }
  | { ok: false; reason: string };

export function scaleRate(rate: ParsedRate, ctx: PlanContext): Scaled {
  const { basis } = rate;
  if (!basis) return { ok: false, reason: "The advice does not say what this rate applies to (per acre, per plant…). Check the original report." };
  let factor: number;
  let kind: "area" | "count";
  if (basis === "acre" || basis === "ha") {
    if (!ctx.areaAcres || ctx.areaAcres <= 0) return { ok: false, reason: "Enter the area to scale this rate." };
    factor = basis === "acre" ? ctx.areaAcres : ctx.areaAcres / ACRES_PER_HECTARE;
    kind = "area";
  } else {
    if (!ctx.count || ctx.count <= 0) return { ok: false, reason: `Enter the number of plants or trees to scale this rate (it is per ${basis}).` };
    factor = ctx.count;
    kind = "count";
  }
  const amount = rate.amount * factor;
  return { ok: true, amount, unit: rate.unit, kg: toKg(amount, rate.unit), basis: kind };
}

export function formatQuantity(amount: number, unit: RateUnit): string {
  const r = (n: number) => (Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 10) / 10).toString();
  if (unit === "g" && amount >= 1000) return `${r(amount / 1000)} kg`;
  if (unit === "kg" && amount < 1) return `${r(amount * 1000)} g`;
  if (unit === "ml" && amount >= 1000) return `${r(amount / 1000)} l`;
  const names: Record<RateUnit, string> = { kg: "kg", g: "g", t: "t", l: "l", ml: "ml", handful: amount === 1 ? "handful" : "handfuls", bag: amount === 1 ? "bag" : "bags" };
  return `${r(amount)} ${names[unit]}`;
}

// ───────────── nutrients supplied ─────────────

export function supplyOf(grade: Grade, productKg: number): Grade {
  return { n: (productKg * grade.n) / 100, p2o5: (productKg * grade.p2o5) / 100, k2o: (productKg * grade.k2o) / 100 };
}
export const addGrades = (a: Grade, b: Grade): Grade => ({ n: a.n + b.n, p2o5: a.p2o5 + b.p2o5, k2o: a.k2o + b.k2o });
export const zeroGrade = (): Grade => ({ n: 0, p2o5: 0, k2o: 0 });
export const elementalP = (p2o5: number) => p2o5 * P_PER_P2O5;
export const elementalK = (k2o: number) => k2o * K_PER_K2O;

// ───────────── the plan ─────────────

export function itemAppliesToCrop(item: Pick<RecommendationItem, "crop">, crop: string): boolean {
  const own = (item.crop ?? "").trim();
  if (!own || /^all crops?$/i.test(own)) return true;
  const wanted = crop.trim().toLowerCase();
  return own.split(/[,;/&]|\band\b/i).map((c) => c.trim().toLowerCase()).filter(Boolean).includes(wanted);
}

/** Crops a test's advice can be planned for: those named in the advice, then those named on the report. */
export function cropsForPlan(items: readonly Pick<RecommendationItem, "crop">[], intendedCrops: readonly string[]): string[] {
  const out: string[] = [];
  const add = (c: string) => {
    const t = c.trim();
    if (!t || /^all crops?$/i.test(t)) return;
    const titled = t.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_m, a, b) => a + b.toUpperCase());
    if (!out.some((x) => x.toLowerCase() === titled.toLowerCase())) out.push(titled);
  };
  for (const item of items) for (const part of (item.crop ?? "").split(/[,;/&]|\band\b/i)) add(part);
  for (const c of intendedCrops) add(c);
  return out;
}

export interface PlanLine {
  item: RecommendationItem;
  product: DetectedProduct | null;
  rate: ParsedRate | null;
  scaled: Scaled | null;
  /** Nutrients (kg) this line supplies over the whole plot; null when it cannot be worked out. */
  supply: Grade | null;
}

export function buildPlanLines(items: readonly RecommendationItem[], crop: string, ctx: PlanContext): PlanLine[] {
  return items.filter((i) => itemAppliesToCrop(i, crop)).map((item) => {
    const product = detectProduct(`${item.action} ${item.rate ?? ""}`);
    const rate = parseRate(item.rate, item.action);
    const scaled = rate ? scaleRate(rate, ctx) : null;
    const supply = product?.grade && scaled && scaled.ok && scaled.kg !== null ? supplyOf(product.grade, scaled.kg) : null;
    return { item, product, rate, scaled, supply };
  });
}

export interface PlanTotals {
  /** kg of each nutrient over the whole plot, from the lines that could be worked out. */
  plot: Grade;
  /** The same per acre, when the area is known. */
  perAcre: Grade | null;
  counted: number;
  /** Lines with a recognised fertilizer whose quantity could not be worked out. */
  skipped: number;
}

export function planTotals(lines: readonly PlanLine[], areaAcres: number | null): PlanTotals {
  let plot = zeroGrade();
  let counted = 0, skipped = 0;
  for (const l of lines) {
    if (l.supply) { plot = addGrades(plot, l.supply); counted++; }
    else if (l.product?.grade) skipped++;
  }
  const perAcre = areaAcres && areaAcres > 0 ? { n: plot.n / areaAcres, p2o5: plot.p2o5 / areaAcres, k2o: plot.k2o / areaAcres } : null;
  return { plot, perAcre, counted, skipped };
}

export function totalKgByProduct(lines: readonly PlanLine[]): { label: string; kg: number }[] {
  const map = new Map<string, number>();
  for (const l of lines) {
    if (!l.product || !l.scaled || !l.scaled.ok || l.scaled.kg === null) continue;
    map.set(l.product.label, (map.get(l.product.label) ?? 0) + l.scaled.kg);
  }
  return [...map.entries()].map(([label, kg]) => ({ label, kg }));
}

/** What the lab itself marked as a problem on the report (its own class words; no thresholds of ours). */
export function flaggedByLab(results: readonly SoilResult[]): { label: string; value: SoilResult; word: string }[] {
  const out: { label: string; value: SoilResult; word: string }[] = [];
  for (const r of results) {
    const word = r.rating_text ?? "";
    const rated = r.rating === "very_low" || r.rating === "low" || r.rating === "high" || r.rating === "very_high";
    const wording = /acid|alkal|saline|sodic|deficien|excess|toxic|\blow\b|\bhigh\b/i.test(word);
    if (r.rating === "adequate" && !wording) continue;
    if (rated || wording) out.push({ label: r.label, value: r, word: word || (r.rating ?? "") });
  }
  return out;
}

// ───────────── swapping a product the farmer cannot get ─────────────

export interface Candidate { label: string; grade: Grade }
export interface SwapResult {
  amounts: { label: string; kg: number }[];
  delivered: Grade;
  /** Delivered as a fraction of the target for each nutrient that has a target (1 = exact). */
  coverage: Partial<Record<NutrientKey, number>>;
  exact: boolean;
}

const gap = (delivered: Grade, target: Grade) =>
  NUTRIENTS.filter((k) => target[k] > 0).reduce((s, k) => s + Math.abs(delivered[k] - target[k]) / target[k], 0);

/**
 * Finds the quantities of the products on hand (one or two) that come closest to a nutrient target, such as what
 * the recommended fertilizer would have supplied. Two products are solved exactly for the two biggest targets when
 * that is possible; otherwise the best single product is scaled to the biggest target and the shortfall is reported.
 */
export function solveSubstitute(target: Grade, available: readonly Candidate[]): SwapResult | null {
  const wanted = NUTRIENTS.filter((k) => target[k] > 0).sort((a, b) => target[b] - target[a]);
  if (wanted.length === 0 || available.length === 0) return null;
  const options: SwapResult[] = [];
  const make = (parts: { c: Candidate; kg: number }[]): SwapResult => {
    const delivered = parts.reduce((acc, p) => addGrades(acc, supplyOf(p.c.grade, p.kg)), zeroGrade());
    const coverage: Partial<Record<NutrientKey, number>> = {};
    for (const k of wanted) coverage[k] = delivered[k] / target[k];
    const exact = wanted.every((k) => Math.abs(delivered[k] - target[k]) <= target[k] * 0.005);
    return { amounts: parts.map((p) => ({ label: p.c.label, kg: p.kg })), delivered, coverage, exact };
  };

  for (const c of available) {
    const lead = wanted.find((k) => c.grade[k] > 0);
    if (!lead) continue;
    options.push(make([{ c, kg: (target[lead] * 100) / c.grade[lead] }]));
  }
  if (wanted.length >= 2) {
    const [a, b] = wanted;
    for (let i = 0; i < available.length; i++) {
      for (let j = i + 1; j < available.length; j++) {
        const p = available[i], q = available[j];
        const det = p.grade[a] * q.grade[b] - q.grade[a] * p.grade[b];
        if (Math.abs(det) < 1e-9) continue;
        const x = ((target[a] * 100) * q.grade[b] - q.grade[a] * (target[b] * 100)) / det;
        const y = (p.grade[a] * (target[b] * 100) - (target[a] * 100) * p.grade[b]) / det;
        if (x >= 0 && y >= 0 && x + y > 0) options.push(make([{ c: p, kg: x }, { c: q, kg: y }].filter((part) => part.kg > 1e-9)));
      }
    }
  }
  if (options.length === 0) return null;
  options.sort((p, q) => gap(p.delivered, target) - gap(q.delivered, target) || p.amounts.length - q.amounts.length);
  return options[0];
}

// ───────────── sharing ─────────────

export interface PlanTextInput {
  farmName: string;
  plotName: string;
  crop: string;
  areaAcres: number | null;
  count: number | null;
  lab: string | null;
  labNumber: string | null;
  sampleDate: string | null;
  lines: readonly PlanLine[];
  totals: PlanTotals;
  flagged: readonly { label: string; word: string }[];
}

export function buildPlanText(p: PlanTextInput): string {
  const out: string[] = [];
  out.push(`Fertilizer plan: ${p.crop}`);
  out.push(`${p.farmName} · ${p.plotName}${p.areaAcres ? ` · ${Math.round(p.areaAcres * 100) / 100} acres` : ""}`);
  out.push(`Based on the soil test${p.lab ? ` by ${p.lab}` : ""}${p.labNumber ? ` (lab no. ${p.labNumber})` : ""}${p.sampleDate ? `, ${p.sampleDate}` : ""}.`);
  if (p.flagged.length > 0) out.push("", `Marked by the lab: ${p.flagged.map((f) => `${f.label} – ${f.word}`).join("; ")}.`);
  out.push("", "What to apply:");
  for (const l of p.lines) {
    const rate = l.item.rate ? ` ${l.item.rate}` : "";
    const timing = l.item.timing ? ` (${l.item.timing})` : "";
    const total = l.scaled && l.scaled.ok ? ` → about ${formatQuantity(l.scaled.amount, l.scaled.unit)} in total` : "";
    out.push(`• ${l.item.action}${rate}${timing}${total}`);
  }
  if (p.totals.counted > 0 && p.totals.perAcre) {
    const t = p.totals.perAcre;
    out.push("", `Fertilizer nutrients per acre in this plan: N ${Math.round(t.n * 10) / 10} kg, P₂O₅ ${Math.round(t.p2o5 * 10) / 10} kg, K₂O ${Math.round(t.k2o * 10) / 10} kg.`);
  }
  out.push("", "These quantities are the lab's or the advisor's advice scaled to your area. Check rates and products with a local agronomist before applying.");
  return out.join("\n");
}
