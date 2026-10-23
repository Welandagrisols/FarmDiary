export type SoilRating = "very_low" | "low" | "medium" | "adequate" | "high" | "very_high";
export type SamplingMethod = "composite" | "grid" | "single_point" | "unknown";
export type SoilStatus = "parsed" | "needs_review" | "confirmed" | "manual";
export type SoilSource = "photo" | "pdf" | "manual";

export interface SoilResult {
  key: string;
  label: string;
  reported_label: string;
  value: number | null;
  text: string | null;
  unit: string | null;
  method: string | null;
  rating: SoilRating | null;
  rating_text: string | null;
  confidence: "high" | "medium" | "low";
  flags: string[];
  edited?: boolean;
}

export interface SoilReportFile {
  path: string;
  media_type: string;
  name: string;
}

export interface RecommendationItem {
  crop: string | null;
  action: string;
  rate: string | null;
  timing: string | null;
}

export interface SoilTestRecord {
  id: string;
  farm_id: string;
  plot_id: string | null;
  sample_label: string | null;
  sample_date: string | null;
  received_date: string | null;
  report_date: string | null;
  lab_name: string | null;
  lab_reference: string | null;
  location_on_report: string | null;
  intended_crops: string[];
  sample_depth: string | null;
  sampling_method: SamplingMethod;
  results: SoilResult[];
  recommendations: string | null;
  recommendation_items: RecommendationItem[];
  report_files: SoilReportFile[];
  source: SoilSource;
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
}

export type SoilTestEditable = Partial<Pick<
  SoilTestRecord,
  | "plot_id" | "sample_label" | "sample_date" | "received_date" | "report_date"
  | "lab_name" | "lab_reference" | "location_on_report" | "intended_crops"
  | "sample_depth" | "sampling_method" | "results" | "recommendations"
  | "recommendation_items" | "status" | "confirmed_by" | "confirmed_at"
>>;

export const SOIL_PARAMETERS = [
  { key: "ph_water", label: "pH (water)" },
  { key: "ph_cacl2", label: "pH (CaCl₂)" },
  { key: "organic_carbon", label: "Organic carbon" },
  { key: "organic_matter", label: "Organic matter" },
  { key: "total_nitrogen", label: "Total nitrogen" },
  { key: "phosphorus", label: "Available phosphorus" },
  { key: "potassium", label: "Potassium" },
  { key: "sulfur", label: "Sulphur" },
  { key: "calcium", label: "Calcium" },
  { key: "magnesium", label: "Magnesium" },
  { key: "sodium", label: "Sodium" },
  { key: "cec", label: "CEC" },
  { key: "base_saturation", label: "Base saturation" },
  { key: "zinc", label: "Zinc" },
  { key: "boron", label: "Boron" },
  { key: "copper", label: "Copper" },
  { key: "manganese", label: "Manganese" },
  { key: "iron", label: "Iron" },
  { key: "sand", label: "Sand" },
  { key: "silt", label: "Silt" },
  { key: "clay", label: "Clay" },
  { key: "texture_class", label: "Texture class" },
  { key: "ec", label: "Electrical conductivity" },
  { key: "other", label: "Other" },
] as const;

export const SOIL_RATING_LABELS: Record<SoilRating, string> = {
  very_low: "Very low",
  low: "Low",
  medium: "Medium",
  adequate: "Adequate",
  high: "High",
  very_high: "Very high",
};

export const SAMPLING_METHOD_LABELS: Record<SamplingMethod, string> = {
  composite: "Composite",
  grid: "Grid",
  single_point: "Single point",
  unknown: "Not sure",
};

export function normalizeSoilDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  if (value > new Date().toISOString().slice(0, 10)) return null;
  return value;
}

export function makeManualSoilResult(input: {
  label: string;
  value: string;
  unit?: string;
  method?: string;
  rating?: SoilRating | null;
}): SoilResult {
  const label = input.label.trim();
  const valueText = input.value.trim();
  if (!label) throw new Error("Enter the name of the soil measurement.");
  if (!valueText) throw new Error(`Enter a value for ${label}.`);

  const number = Number(valueText);
  const isNumber = valueText !== "" && Number.isFinite(number);
  const knownParameter = SOIL_PARAMETERS.find((item) => item.label.toLowerCase() === label.toLowerCase());
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
  const key = knownParameter?.key ?? (slug || "other");

  return {
    key,
    label: knownParameter?.label ?? label,
    reported_label: label,
    value: isNumber ? number : null,
    text: isNumber ? null : valueText,
    unit: input.unit?.trim() || null,
    method: input.method?.trim() || null,
    rating: input.rating ?? null,
    rating_text: input.rating ? SOIL_RATING_LABELS[input.rating] : null,
    confidence: "high",
    flags: [],
    edited: true,
  };
}

export function soilTestDate(test: Pick<SoilTestRecord, "sample_date" | "report_date" | "created_at"> & { received_date?: string | null }): string {
  return test.sample_date || test.received_date || test.report_date || test.created_at.slice(0, 10);
}

export function compareSoilResult(
  history: readonly SoilTestRecord[],
  current: SoilTestRecord,
  result: SoilResult,
): { previous: SoilResult | null; previousTest: SoilTestRecord | null; change: number | null; unitDiffers: boolean } {
  const currentDate = soilTestDate(current);
  const candidates = history
    .filter((item) => item.id !== current.id && item.farm_id === current.farm_id &&
      item.plot_id === current.plot_id && soilTestDate(item) < currentDate)
    .sort((a, b) => soilTestDate(b).localeCompare(soilTestDate(a)));
  for (const item of candidates) {
    const previous = item.results.find((reading) => reading.key === result.key &&
      (reading.method || null) === (result.method || null) && (reading.value !== null || reading.text !== null));
    if (!previous) continue;
    const sameUnit = (previous.unit || "").trim().toLowerCase() === (result.unit || "").trim().toLowerCase();
    return {
      previous,
      previousTest: item,
      change: previous.value !== null && result.value !== null && sameUnit ? result.value - previous.value : null,
      unitDiffers: !sameUnit,
    };
  }
  return { previous: null, previousTest: null, change: null, unitDiffers: false };
}

export function formatSoilValue(result: Pick<SoilResult, "value" | "text" | "unit">): string {
  const value = result.value !== null ? String(result.value) : result.text || "—";
  return result.unit ? `${value} ${result.unit}` : value;
}
