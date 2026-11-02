// Soil test model: parameter catalogue, cleaning/validation of values read from a lab
// report, and comparison across tests. Pure TypeScript (no React Native / Supabase imports)
// so the server, the app and `npm test` can all use it.
//
// Rule that runs through everything here: never convert units and never invent values.
// A value is stored with the unit/method/rating exactly as the lab printed them, and
// anything suspicious is flagged for a person to check rather than silently "fixed".

export type SoilGroup = "acidity" | "organic" | "macro" | "cations" | "micro" | "texture" | "salinity" | "other";

export interface SoilParameterDef {
  key: string;
  label: string;
  group: SoilGroup;
  /** Units labs commonly use. Used only to flag surprises, never to convert. */
  units: string[];
  /** Flag a reading above this when it is expressed in %. */
  maxPercent?: number;
  /** Other names printed on lab reports. */
  aliases: string[];
}

const MGKG = ["mg/kg", "ppm", "kg/ha", "mg/l"];
const CATION = ["cmol(+)/kg", "cmolc/kg", "cmol/kg", "meq/100g", "me/100g", "meq%", "me%", "mmol(+)/kg", "mg/kg", "ppm", "kg/ha", "%"];

export const SOIL_PARAMETERS: SoilParameterDef[] = [
  { key: "ph_water", label: "pH (water)", group: "acidity", units: ["", "ph"], aliases: ["ph", "soil ph", "ph h2o", "ph (h2o)", "ph water", "ph in water", "ph 1:2.5", "ph (1:2.5)", "ph 1:1"] },
  { key: "ph_cacl2", label: "pH (CaCl₂)", group: "acidity", units: ["", "ph"], aliases: ["ph cacl2", "ph (cacl2)", "ph in cacl2", "ph kcl", "ph (kcl)"] },
  { key: "exchangeable_acidity", label: "Exchangeable acidity", group: "acidity", units: ["cmol(+)/kg", "cmolc/kg", "cmol/kg", "meq/100g", "me/100g", "meq%", "me%"], aliases: ["exch. acidity", "exch. acidity meq%", "exchangeable acidity", "ea", "h+al", "acidity"] },
  { key: "aluminium", label: "Aluminium", group: "acidity", units: [...CATION], aliases: ["aluminium", "aluminum", "al", "exch. al", "exchangeable al"] },
  { key: "organic_carbon", label: "Organic carbon", group: "organic", units: ["%", "g/kg"], maxPercent: 25, aliases: ["organic carbon", "org. carbon", "org c", "oc", "% c", "carbon", "total organic carbon", "total org. carbon", "toc"] },
  { key: "organic_matter", label: "Organic matter", group: "organic", units: ["%", "g/kg"], maxPercent: 50, aliases: ["organic matter", "org. matter", "om", "% om", "soil organic matter", "som"] },
  { key: "total_nitrogen", label: "Total nitrogen", group: "organic", units: ["%", "g/kg", "mg/kg", "ppm"], maxPercent: 3, aliases: ["total nitrogen", "total n", "nitrogen", "n", "% n", "n total", "kjeldahl n"] },
  { key: "phosphorus", label: "Phosphorus (available)", group: "macro", units: [...MGKG], aliases: ["phosphorus", "available phosphorus", "available p", "p", "olsen p", "p olsen", "p (olsen)", "mehlich p", "p (mehlich 3)", "p mehlich-3", "bray p", "p bray"] },
  { key: "potassium", label: "Potassium", group: "macro", units: [...CATION], maxPercent: 100, aliases: ["potassium", "k", "exch. k", "exchangeable k", "exchangeable potassium", "k (exch)"] },
  { key: "sulfur", label: "Sulphur", group: "macro", units: [...MGKG], aliases: ["sulphur", "sulfur", "s", "available s"] },
  { key: "calcium", label: "Calcium", group: "cations", units: [...CATION], maxPercent: 100, aliases: ["calcium", "ca", "exch. ca", "exchangeable ca", "exchangeable calcium"] },
  { key: "magnesium", label: "Magnesium", group: "cations", units: [...CATION], maxPercent: 100, aliases: ["magnesium", "mg", "exch. mg", "exchangeable mg", "exchangeable magnesium"] },
  { key: "sodium", label: "Sodium", group: "cations", units: [...CATION], maxPercent: 100, aliases: ["sodium", "na", "exch. na", "exchangeable na", "exchangeable sodium"] },
  { key: "cec", label: "CEC", group: "cations", units: ["cmol(+)/kg", "cmolc/kg", "cmol/kg", "meq/100g", "me/100g", "meq%", "me%", "mmol(+)/kg"], aliases: ["cec", "cation exchange capacity", "c.e.c", "ecec"] },
  { key: "base_saturation", label: "Base saturation", group: "cations", units: ["%"], maxPercent: 100, aliases: ["base saturation", "bs", "% base saturation"] },
  { key: "zinc", label: "Zinc", group: "micro", units: [...MGKG], aliases: ["zinc", "zn"] },
  { key: "boron", label: "Boron", group: "micro", units: [...MGKG], aliases: ["boron", "b"] },
  { key: "copper", label: "Copper", group: "micro", units: [...MGKG], aliases: ["copper", "cu"] },
  { key: "manganese", label: "Manganese", group: "micro", units: [...MGKG], aliases: ["manganese", "mn"] },
  { key: "iron", label: "Iron", group: "micro", units: [...MGKG], aliases: ["iron", "fe"] },
  { key: "sand", label: "Sand", group: "texture", units: ["%", "g/kg"], maxPercent: 100, aliases: ["sand", "% sand"] },
  { key: "silt", label: "Silt", group: "texture", units: ["%", "g/kg"], maxPercent: 100, aliases: ["silt", "% silt"] },
  { key: "clay", label: "Clay", group: "texture", units: ["%", "g/kg"], maxPercent: 100, aliases: ["clay", "% clay"] },
  { key: "texture_class", label: "Texture class", group: "texture", units: [], aliases: ["texture", "textural class", "texture class", "soil texture"] },
  { key: "ec", label: "Electrical conductivity", group: "salinity", units: ["ds/m", "ms/cm", "µs/cm", "us/cm", "ms/m"], aliases: ["ec", "electrical conductivity", "conductivity", "salinity", "ec 1:2.5", "ec (1:2.5)"] },
];

export const SOIL_PARAMETER_KEYS = SOIL_PARAMETERS.map((p) => p.key);
const PARAM_BY_KEY = new Map(SOIL_PARAMETERS.map((p) => [p.key, p]));

export const SOIL_GROUP_LABELS: Record<SoilGroup, string> = {
  acidity: "Acidity",
  organic: "Organic matter & nitrogen",
  macro: "Phosphorus, potassium & sulphur",
  cations: "Bases & CEC",
  micro: "Micronutrients",
  texture: "Texture",
  salinity: "Salinity",
  other: "Other results",
};
export const SOIL_GROUP_ORDER: SoilGroup[] = ["acidity", "organic", "macro", "cations", "micro", "texture", "salinity", "other"];

export type SoilRating = "very_low" | "low" | "medium" | "adequate" | "high" | "very_high";
export const SOIL_RATING_LABELS: Record<SoilRating, string> = {
  very_low: "Very low", low: "Low", medium: "Medium", adequate: "Adequate", high: "High", very_high: "Very high",
};
export const SOIL_RATINGS = Object.keys(SOIL_RATING_LABELS) as SoilRating[];

export type SoilStatus = "parsed" | "needs_review" | "confirmed" | "manual";
export type SamplingMethod = "composite" | "grid" | "single_point" | "unknown";
export const SAMPLING_METHOD_LABELS: Record<SamplingMethod, string> = {
  composite: "Composite (mixed from several spots)",
  grid: "Grid sampling",
  single_point: "Single point",
  unknown: "Not sure",
};
export type Confidence = "high" | "medium" | "low";

export interface SoilResult {
  key: string;
  label: string;
  /** Exactly as printed on the report. */
  reported_label: string;
  value: number | null;
  /** For non-numeric readings ("<0.5", "ND", "Clay loam"). */
  text: string | null;
  unit: string | null;
  method: string | null;
  rating: SoilRating | null;
  rating_text: string | null;
  confidence: Confidence;
  flags: string[];
  edited?: boolean;
}

export interface SoilReportFile { path: string; media_type: string; name: string }

/** One action from the lab's written advice, copied as printed. Never calculated or converted. */
export interface RecommendationItem {
  crop: string | null;
  action: string;
  /** Rate exactly as printed, e.g. "100kg/acre". */
  rate: string | null;
  /** Timing exactly as printed, e.g. "at least 2 months before planting". */
  timing: string | null;
  /** "advisor" when a person typed this advice in; missing means it was read from the lab report. */
  source?: "advisor";
}

export interface SoilTestRecord {
  id: string;
  farm_id: string;
  plot_id: string | null;
  sample_label: string | null;
  sample_date: string | null;
  /** Date the lab received the sample (many labs print this instead of the collection date). */
  received_date: string | null;
  report_date: string | null;
  lab_name: string | null;
  lab_reference: string | null;
  location_on_report: string | null;
  /** Crops the report says the land is intended for, as printed. */
  intended_crops: string[];
  sample_depth: string | null;
  sampling_method: SamplingMethod;
  results: SoilResult[];
  recommendations: string | null;
  recommendation_items: RecommendationItem[];
  report_files: SoilReportFile[];
  source: "photo" | "pdf" | "manual";
  status: SoilStatus;
  extraction_notes: string | null;
  created_by: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlotRecord {
  id: string;
  farm_id: string;
  name: string;
  area_acres: number | null;
  description: string | null;
  is_archived: boolean;
  created_by: string | null;
  created_at: string;
  boundary?: [number, number][] | null;
  boundary_area_m2?: number | null;
  boundary_perimeter_m?: number | null;
  boundary_center_lat?: number | null;
  boundary_center_lng?: number | null;
  boundary_accuracy_m?: number | null;
  boundary_method?: "corners" | "walk" | null;
  boundary_captured_by?: string | null;
  boundary_captured_at?: string | null;
}

export interface ParsedSample {
  label: string | null;
  sample_date: string | null;
  depth: string | null;
  sampling_method: SamplingMethod;
  recommendations: string | null;
  recommendation_items: RecommendationItem[];
  results: SoilResult[];
  status: "parsed" | "needs_review";
  notes: string[];
}

export interface ParsedReport {
  isSoilReport: boolean;
  lab_name: string | null;
  lab_reference: string | null;
  location_on_report: string | null;
  received_date: string | null;
  intended_crops: string[];
  report_date: string | null;
  notes: string | null;
  samples: ParsedSample[];
}

export const MAX_SAMPLES_PER_REPORT = 40;
export const MAX_RESULTS_PER_SAMPLE = 60;
export const MAX_RECOMMENDATION_ITEMS = 40;

// ───────────────────────── small helpers ─────────────────────────

const clip = (v: unknown, max: number): string | null => {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const s = String(v).replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
};
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "unnamed";
const normText = (s: string) => s.toLowerCase().replace(/[()\[\]]/g, " ").replace(/\s+/g, " ").trim();
const normUnit = (u: string) => u.toLowerCase().replace(/\s+/g, "").replace(/μ/g, "µ");

/**
 * Units that mean exactly the same number, so a trend can be drawn across labs that print them differently:
 * ppm = mg/kg, and meq% = me% = meq/100g = cmol(+)/kg for exchangeable cations.
 * This is NOT a conversion between different quantities (kg/ha, %, etc. are left alone).
 */
export function canonicalUnit(u: string | null | undefined): string {
  const n = normUnit(u ?? "");
  if (n === "ppm" || n === "mg/kg") return "mg/kg";
  if (["meq%", "me%", "meq/100g", "me/100g", "cmol/kg", "cmolc/kg", "cmol(+)/kg"].includes(n)) return "cmol(+)/kg";
  if (n === "ms/cm" ) return "ms/cm";
  if (n === "ph") return "";
  return n;
}

export function resolveParameterKey(label: string | null | undefined): string | null {
  if (!label) return null;
  const n = normText(label);
  for (const p of SOIL_PARAMETERS) {
    if (p.aliases.some((a) => normText(a) === n) || normText(p.label) === n) return p.key;
  }
  return null;
}

export function parameterDef(key: string): SoilParameterDef | null {
  return PARAM_BY_KEY.get(key) ?? null;
}

export function groupForKey(key: string): SoilGroup {
  return PARAM_BY_KEY.get(key)?.group ?? "other";
}

export function normalizeRating(raw: unknown): { rating: SoilRating | null; text: string | null } {
  const text = clip(raw, 40);
  if (!text) return { rating: null, text: null };
  const t = text.toLowerCase().replace(/[^a-z ]/g, "").trim();
  const map: [RegExp, SoilRating][] = [
    [/^(very low|vl|extremely low|severely deficient)$/, "very_low"],
    [/^(low|l|deficient|poor|inadequate|marginal)$/, "low"],
    [/^(medium|moderate|med|m|fair|moderately low)$/, "medium"],
    [/^(adequate|sufficient|optimum|optimal|good|normal|satisfactory|ok|a)$/, "adequate"],
    [/^(high|h|moderately high|excess|excessive|surplus)$/, "high"],
    [/^(very high|vh|extremely high|toxic)$/, "very_high"],
  ];
  for (const [re, rating] of map) if (re.test(t)) return { rating, text };
  return { rating: null, text };
}

/**
 * Accepts YYYY-MM-DD, or day-first d-m-yyyy / d-m-yy (with - / or .) as printed by Kenyan labs.
 * Anything that is not a real date, is before 1990 or is in the future becomes null.
 */
export function normalizeDate(raw: unknown, today: Date = new Date()): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  let y: number, mo: number, d: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(t);
  if (iso) { y = Number(iso[1]); mo = Number(iso[2]); d = Number(iso[3]); }
  else if (dmy) { d = Number(dmy[1]); mo = Number(dmy[2]); y = dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3]); }
  else return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  if (y < 1990) return null;
  const limit = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1);
  if (dt.getTime() > limit) return null;
  return `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function normalizeSamplingMethod(raw: unknown): SamplingMethod {
  const t = typeof raw === "string" ? raw.toLowerCase().replace(/[^a-z]/g, "") : "";
  if (t === "composite") return "composite";
  if (t === "grid") return "grid";
  if (t === "singlepoint" || t === "single") return "single_point";
  return "unknown";
}

function normalizeConfidence(raw: unknown): Confidence {
  return raw === "high" || raw === "medium" || raw === "low" ? raw : "medium";
}

// ───────────────────────── report-level helpers ─────────────────────────

export function normalizeCrops(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[,;/&]|\band\b/i) : [];
  const out: string[] = [];
  for (const item of list) {
    const c = clip(item, 40);
    if (!c) continue;
    const titled = c.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_m, a, b) => a + b.toUpperCase());
    if (!out.includes(titled)) out.push(titled);
    if (out.length >= 10) break;
  }
  return out;
}

export function normalizeRecommendationItems(raw: unknown): RecommendationItem[] {
  if (!Array.isArray(raw)) return [];
  const out: RecommendationItem[] = [];
  for (const item of raw.slice(0, MAX_RECOMMENDATION_ITEMS)) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const action = clip(r.action, 200);
    if (!action) continue;
    out.push({ crop: clip(r.crop, 40), action, rate: clip(r.rate, 80), timing: clip(r.timing, 120) });
  }
  return out;
}

// ───────────────────────── result cleaning ─────────────────────────

export function normalizeResult(raw: unknown): SoilResult | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const reported = clip(r.label_on_report ?? r.reported_label ?? r.label, 120);
  if (!reported && typeof r.key !== "string") return null;

  let key = typeof r.key === "string" ? r.key.trim() : "";
  if (!PARAM_BY_KEY.has(key)) key = resolveParameterKey(reported) ?? `other:${slug(reported ?? key)}`;
  const def = PARAM_BY_KEY.get(key) ?? null;

  const flags: string[] = [];
  let value: number | null = null;
  let text = clip(r.text, 60);

  if (typeof r.value === "number") {
    if (Number.isFinite(r.value)) value = r.value;
    else flags.push("invalid_value");
  } else if (typeof r.value === "string" && r.value.trim()) {
    const cleaned = r.value.trim().replace(",", ".");
    const n = Number(cleaned);
    if (/^-?\d+(\.\d+)?$/.test(cleaned) && Number.isFinite(n)) value = n;
    else text = text ?? clip(r.value, 60); // "<0.5", "ND", "Clay loam"
  }
  if (value !== null && value < 0) { value = null; flags.push("invalid_value"); }
  if (value === null && !text) return null; // nothing readable: drop the row instead of storing an empty one

  const unit = clip(r.unit, 30);
  if (def && unit && def.units.length > 0 && !def.units.map(normUnit).includes(normUnit(unit))) flags.push("unusual_unit");

  if (value !== null) {
    const isPh = key === "ph_water" || key === "ph_cacl2";
    if (isPh && (value < 2 || value > 11)) flags.push("out_of_range");
    const isPercent = !!unit && unit.replace(/\s/g, "") === "%";
    if (isPercent && (value > 100 || (def?.maxPercent !== undefined && value > def.maxPercent))) flags.push("out_of_range");
    if (!isPh && !isPercent && value > 1_000_000) flags.push("out_of_range");
  }

  const confidence = normalizeConfidence(r.confidence);
  if (confidence === "low") flags.push("low_confidence");

  const { rating, text: rating_text } = normalizeRating(r.rating);
  return {
    key,
    label: def?.label ?? reported ?? key,
    reported_label: reported ?? def?.label ?? key,
    value,
    text,
    unit,
    method: clip(r.method, 60),
    rating,
    rating_text,
    confidence,
    flags: Array.from(new Set(flags)),
  };
}

const REVIEW_FLAGS = new Set(["out_of_range", "low_confidence", "invalid_value"]);

export function needsReview(results: SoilResult[]): boolean {
  return results.length === 0 || results.some((r) => r.flags.some((f) => REVIEW_FLAGS.has(f)));
}

/** Cleans whatever the reader returned. Returns null when the input is not an object at all. */
export function normalizeParsedReport(raw: unknown, today: Date = new Date()): ParsedReport | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const rawSamples = Array.isArray(r.samples) ? r.samples.slice(0, MAX_SAMPLES_PER_REPORT) : [];

  const samples: ParsedSample[] = rawSamples
    .filter((s) => s && typeof s === "object")
    .map((s) => {
      const sample = s as Record<string, unknown>;
      const rows = Array.isArray(sample.results) ? sample.results.slice(0, MAX_RESULTS_PER_SAMPLE) : [];
      const results = rows.map(normalizeResult).filter((x): x is SoilResult => x !== null);
      const notes: string[] = [];
      const dropped = rows.length - results.length;
      if (dropped > 0) notes.push(`${dropped} row${dropped === 1 ? "" : "s"} on the report had no readable value and were left out.`);
      const dateRaw = sample.sample_date;
      const sample_date = normalizeDate(dateRaw, today);
      if (typeof dateRaw === "string" && dateRaw.trim() && !sample_date) notes.push("The sample date could not be read reliably; please set it.");
      return {
        label: clip(sample.label, 80),
        sample_date,
        depth: clip(sample.depth, 40),
        sampling_method: normalizeSamplingMethod(sample.sampling_method),
        recommendations: clip(sample.recommendations, 4000),
        recommendation_items: normalizeRecommendationItems(sample.recommendation_items),
        results,
        status: needsReview(results) ? "needs_review" : "parsed",
        notes,
      } as ParsedSample;
    });

  return {
    isSoilReport: r.is_soil_report === true && samples.length > 0,
    lab_name: clip(r.lab_name, 120),
    lab_reference: clip(r.lab_reference, 80),
    location_on_report: clip(r.location_on_report, 160),
    received_date: normalizeDate(r.received_date, today),
    intended_crops: normalizeCrops(r.intended_crops),
    report_date: normalizeDate(r.report_date, today),
    notes: clip(r.notes, 1000),
    samples,
  };
}

// ───────────────────────── using saved tests ─────────────────────────

export function testDate(t: Pick<SoilTestRecord, "sample_date" | "report_date" | "created_at"> & { received_date?: string | null }): string {
  return t.sample_date ?? t.received_date ?? t.report_date ?? t.created_at.slice(0, 10);
}

export function sortNewestFirst<T extends Pick<SoilTestRecord, "sample_date" | "report_date" | "created_at"> & { received_date?: string | null }>(tests: readonly T[]): T[] {
  return [...tests].sort((a, b) => testDate(b).localeCompare(testDate(a)) || b.created_at.localeCompare(a.created_at));
}

/** plotId null = whole-farm tests only. Plot and farm-wide tests are never mixed silently. */
export function testsForTarget<T extends Pick<SoilTestRecord, "plot_id">>(tests: readonly T[], plotId: string | null): T[] {
  return tests.filter((t) => (t.plot_id ?? null) === (plotId ?? null));
}

export interface PreviousReading {
  testId: string;
  date: string;
  value: number;
  unit: string | null;
}
export interface Comparison {
  previous: PreviousReading | null;
  /** current - previous; null when there is no previous reading or the units differ. */
  change: number | null;
  unitDiffers: boolean;
}

/** Compare one result with the most recent EARLIER test on the same farm/plot for the same parameter and method. */
export function compareWithPrevious(history: readonly SoilTestRecord[], current: SoilTestRecord, result: SoilResult): Comparison {
  const none: Comparison = { previous: null, change: null, unitDiffers: false };
  if (result.value === null) return none;
  const curDate = testDate(current);
  const earlier = sortNewestFirst(
    testsForTarget(history, current.plot_id).filter((t) => t.id !== current.id && t.farm_id === current.farm_id && testDate(t) < curDate),
  );
  for (const t of earlier) {
    const match = (t.results ?? []).find((x) => x.key === result.key && (x.method ?? null) === (result.method ?? null) && x.value !== null);
    if (!match || match.value === null) continue;
    const previous: PreviousReading = { testId: t.id, date: testDate(t), value: match.value, unit: match.unit };
    const sameUnit = canonicalUnit(match.unit) === canonicalUnit(result.unit);
    return { previous, change: sameUnit ? result.value - match.value : null, unitDiffers: !sameUnit };
  }
  return none;
}

export function formatResultValue(r: Pick<SoilResult, "value" | "text" | "unit">): string {
  const v = r.value !== null ? String(Math.round(r.value * 1000) / 1000) : r.text ?? "—";
  return r.unit && r.value !== null ? `${v} ${r.unit}` : v;
}

/** A few headline numbers for list cards. */
export function headlineResults(t: Pick<SoilTestRecord, "results">): SoilResult[] {
  const wanted = ["ph_water", "ph_cacl2", "organic_carbon", "phosphorus", "potassium"];
  const out: SoilResult[] = [];
  for (const key of wanted) {
    const hit = (t.results ?? []).find((r) => r.key === key && r.value !== null);
    if (hit) out.push(hit);
    if (out.length === 4) break;
  }
  return out;
}

export function describeFlag(flag: string): string {
  switch (flag) {
    case "out_of_range": return "Value looks unusual — check it against the report";
    case "low_confidence": return "The reader was not sure about this one";
    case "invalid_value": return "The value could not be read as a valid number";
    case "unusual_unit": return "Unit is not one we usually see for this test";
    default: return flag;
  }
}
