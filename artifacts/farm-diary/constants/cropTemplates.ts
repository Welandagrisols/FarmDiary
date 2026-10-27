import type { CropTemplate, CropTemplateStage, PlannedProduct } from "./farmData";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface VarietyOption {
  label: string;
  blightRisk: RiskLevel;
  maturityDays: number;
  note: string;
}

export interface PlanRow {
  category: string;
  subcategory: string;
  description: string;
  defaultAmount: string;
}

export interface HarvestUnit {
  key: string;
  label: string;
  plural: string;
  /** Typical weight for a unit, or 0 when it is not known. */
  defaultKg: number;
}

export interface CropMeta {
  riskLabel: string;
  plantingVerb: string;
  varieties: VarietyOption[];
  prePlanting: PlanRow[];
  harvestUnits: HarvestUnit[];
}

const product = (name: string, rate: string): PlannedProduct => ({
  name,
  rate,
  qty: "As needed",
  unitPrice: 0,
  unit: "unit",
});

const stage = (
  id: string,
  title: string,
  offsetDays: number,
  activityType: string,
  purpose: string,
  alert: string | null,
  products: PlannedProduct[] = []
): CropTemplateStage => ({
  id,
  title,
  offsetDays,
  activityType,
  purpose,
  alert,
  products,
  estimatedLaborCost: 0,
  estimatedTotalCost: 0,
});

const commonPrePlanting = (seedLabel: string): PlanRow[] => [
  { category: "Pre-Planting", subcategory: "Land Lease / Rent", description: "Land lease / rent", defaultAmount: "" },
  { category: "Pre-Planting", subcategory: "Ploughing — 1st Pass", description: "Land preparation / ploughing", defaultAmount: "" },
  { category: "Pre-Planting", subcategory: "Soil Testing", description: "Soil test", defaultAmount: "" },
  { category: "Pre-Planting", subcategory: seedLabel, description: seedLabel, defaultAmount: "" },
  { category: "Pre-Planting", subcategory: "Basal Fertilizer (DAP / NPSb)", description: "Basal fertilizer / manure", defaultAmount: "" },
  { category: "Pre-Planting", subcategory: "Lime Application", description: "Lime (if soil is acidic)", defaultAmount: "" },
  { category: "Labor", subcategory: "Planting Labor", description: "Planting / transplanting labor", defaultAmount: "" },
];

export const POTATO_META: CropMeta = {
  riskLabel: "Blight risk",
  plantingVerb: "Planting",
  varieties: [
    { label: "Stephen's", blightRisk: "HIGH", maturityDays: 72, note: "72 days, HIGH blight risk" },
    { label: "Shangi", blightRisk: "MEDIUM", maturityDays: 82, note: "72–90 days, MEDIUM blight risk" },
    { label: "Kenya Mpya", blightRisk: "LOW", maturityDays: 95, note: "90–100 days, LOW blight risk" },
    { label: "Markies", blightRisk: "LOW", maturityDays: 110, note: "100–120 days, LOW blight risk" },
    { label: "Dutch Robjin", blightRisk: "MEDIUM", maturityDays: 95, note: "90–100 days, MEDIUM blight risk" },
    { label: "Unica", blightRisk: "MEDIUM", maturityDays: 95, note: "90–100 days, MEDIUM blight risk" },
    { label: "Custom", blightRisk: "MEDIUM", maturityDays: 90, note: "Enter your own variety" },
  ],
  prePlanting: [
    { category: "Pre-Planting", subcategory: "Land Lease / Rent", description: "Land lease / rent", defaultAmount: "8000" },
    { category: "Pre-Planting", subcategory: "Ploughing — 1st Pass", description: "Ploughing — 1st pass", defaultAmount: "3500" },
    { category: "Pre-Planting", subcategory: "Ploughing — 2nd Pass", description: "Ploughing — 2nd pass", defaultAmount: "3500" },
    { category: "Pre-Planting", subcategory: "Harrowing / Levelling", description: "Harrowing / levelling", defaultAmount: "2000" },
    { category: "Pre-Planting", subcategory: "Seed Tubers Purchase", description: "Seed tubers purchase", defaultAmount: "12000" },
    { category: "Pre-Planting", subcategory: "Basal Fertilizer (DAP / NPSb)", description: "Basal fertilizer (DAP / NPSb)", defaultAmount: "6400" },
    { category: "Labor", subcategory: "Planting Labor", description: "Planting labor", defaultAmount: "3000" },
    { category: "Pre-Planting", subcategory: "Lime Application", description: "Lime application", defaultAmount: "1500" },
  ],
  harvestUnits: [
    { key: "bag", label: "Bag", plural: "Bags", defaultKg: 110 },
    { key: "crate", label: "Crate", plural: "Crates", defaultKg: 25 },
    { key: "kg", label: "Kg", plural: "Kg", defaultKg: 1 },
  ],
};

const CORIANDER: CropTemplate = {
  id: "coriander-template",
  cropType: "Coriander",
  variety: "Local (Dhania)",
  maturityDays: 40,
  germinationDays: 10,
  stopSprayingDaysBeforeHarvest: 7,
  prePlantingLeadDays: 7,
  blightRisk: "LOW",
  notes: "Short-season leafy crop. Plan staggered sowings for a steady supply. Draft schedule: confirm locally before use.",
  stages: [
    stage("cor-pre-planting", "Pre-Planting", -7, "Cost Capture", "Land preparation, soil test, manure or basal fertilizer, seed purchase and bed preparation.", "Use a fine, well-drained seedbed and clean seed."),
    stage("cor-planting", "Sowing", 0, "Planting", "Sow seed in rows on the prepared bed, cover lightly and water.", "Keep the seedbed moist until germination (about 7–14 days)."),
    stage("cor-weeding", "Thinning & Weeding", 14, "Weeding", "Thin to the recommended spacing and weed by hand.", null),
    stage("cor-topdress", "Top-Dressing", 20, "Fertilizer", "Light nitrogen top-dressing for leaf growth, based on soil test or agronomist advice.", "Avoid over-applying nitrogen: soft leaves are more prone to disease.", [product("Nitrogen top-dressing (e.g. CAN)", "Per soil test / agronomist advice")]),
    stage("cor-scouting", "Pest & Disease Scouting", 25, "Observation", "Check for aphids, leaf spots and powdery mildew. Spray only if needed and follow the label.", "Check the pre-harvest interval on the label before any spray."),
    stage("cor-harvest", "Harvest", 40, "Harvest", "Cut leaves at marketable size (about 35–45 days). Harvest in the morning and bunch quickly.", "Cool and sell quickly: coriander wilts within hours."),
  ],
};

const TOMATO: CropTemplate = {
  id: "tomato-template",
  cropType: "Tomato",
  variety: "Hybrid / open-pollinated",
  maturityDays: 75,
  germinationDays: 7,
  stopSprayingDaysBeforeHarvest: 7,
  prePlantingLeadDays: 14,
  blightRisk: "HIGH",
  notes: "Offsets are in days after transplanting. Draft schedule: confirm timings and all treatments locally before use.",
  stages: [
    stage("tom-pre-planting", "Pre-Transplant", -14, "Cost Capture", "Land preparation, soil test, lime if acidic, manure, seedlings or nursery, stakes and irrigation set-up.", "Avoid fields where tomato, potato, capsicum or other solanaceous crops grew recently."),
    stage("tom-planting", "Transplanting", 0, "Planting", "Transplant healthy seedlings with basal fertilizer and water in.", null),
    stage("tom-gap-filling", "Establishment & Gap Filling", 7, "Observation", "Replace dead seedlings and check establishment.", null),
    stage("tom-topdress-1", "First Top-Dressing & Weeding", 21, "Fertilizer", "Nitrogen top-dressing and weeding; mulch where possible.", null, [product("Nitrogen top-dressing (e.g. CAN)", "Per soil test / agronomist advice")]),
    stage("tom-staking", "Staking & Pruning", 21, "Crop Management", "Stake and train plants and prune as required for the variety.", "Remove infected leaves and clean tools between plants."),
    stage("tom-spray-1", "Preventive Spray Round 1", 21, "Spray", "Preventive fungicide and pest scouting (blights, whitefly, Tuta absoluta).", "Rotate modes of action and follow the label pre-harvest interval.", [product("Fungicide (agronomist to specify)", "Per label")]),
    stage("tom-spray-2", "Preventive Spray Round 2", 35, "Spray", "Repeat preventive protection and scouting.", "Increase vigilance in wet weather.", [product("Fungicide / insecticide (agronomist to specify)", "Per label")]),
    stage("tom-flowering", "Flowering: Second Top-Dressing & Calcium", 42, "Fertilizer", "Potassium and calcium support at flowering and fruit set; keep irrigation even.", "Uneven watering and low calcium can cause blossom-end rot.", [product("Potassium / calcium source (agronomist to specify)", "Per soil test / label")]),
    stage("tom-spray-3", "Preventive Spray Round 3", 49, "Spray", "Continue protection until fruit set; stop on schedule before picking.", "Check the pre-harvest interval on the label.", [product("Fungicide / insecticide (agronomist to specify)", "Per label")]),
    stage("tom-harvest", "Harvest (repeated picking)", 70, "Harvest", "Start picking at the colour stage the market wants; pick every few days for several weeks.", "Grade and pack carefully to reduce losses."),
  ],
};

const CABBAGE: CropTemplate = {
  id: "cabbage-template",
  cropType: "Cabbage",
  variety: "Hybrid / open-pollinated",
  maturityDays: 80,
  germinationDays: 7,
  stopSprayingDaysBeforeHarvest: 14,
  prePlantingLeadDays: 14,
  blightRisk: "MEDIUM",
  notes: "Offsets are in days after transplanting. Draft schedule: confirm timings and all treatments locally before use.",
  stages: [
    stage("cab-pre-planting", "Pre-Transplant", -14, "Cost Capture", "Land preparation, soil test, lime if acidic, manure, seedlings or nursery and irrigation set-up.", "Avoid fields where brassicas grew recently (clubroot and black rot risk)."),
    stage("cab-planting", "Transplanting", 0, "Planting", "Transplant healthy seedlings with basal fertilizer and water in.", null),
    stage("cab-weeding", "Gap Filling & First Weeding", 10, "Weeding", "Replace dead seedlings and weed carefully.", null),
    stage("cab-topdress-1", "First Top-Dressing", 21, "Fertilizer", "Nitrogen top-dressing for leaf growth.", null, [product("Nitrogen top-dressing (e.g. CAN)", "Per soil test / agronomist advice")]),
    stage("cab-spray-1", "Pest Scouting & Spray 1", 21, "Spray", "Scout for diamondback moth, aphids and cutworms; spray only when thresholds are reached.", "Rotate products and follow the label pre-harvest interval.", [product("Insecticide (agronomist to specify)", "Per label")]),
    stage("cab-topdress-2", "Second Top-Dressing", 35, "Fertilizer", "Second nitrogen dose before head formation, based on crop condition and soil test.", null, [product("Nitrogen top-dressing (e.g. CAN)", "Per soil test / agronomist advice")]),
    stage("cab-spray-2", "Pest Scouting & Spray 2", 42, "Spray", "Continue scouting through head formation.", "Stop all sprays in time for the label pre-harvest interval.", [product("Insecticide / fungicide (agronomist to specify)", "Per label")]),
    stage("cab-heading", "Head Formation", 55, "Observation", "Monitor head development, water stress and pests.", null),
    stage("cab-harvest", "Harvest", 80, "Harvest", "Cut firm, well-formed heads; harvest in batches as they mature.", "Heads split if left too long or after heavy rain."),
  ],
};

const ONION: CropTemplate = {
  id: "onion-template",
  cropType: "Onion",
  variety: "Red bulb onion",
  maturityDays: 110,
  germinationDays: 7,
  stopSprayingDaysBeforeHarvest: 14,
  prePlantingLeadDays: 14,
  blightRisk: "MEDIUM",
  notes: "Offsets are in days after transplanting. Draft schedule: confirm timings and all treatments locally before use.",
  stages: [
    stage("oni-pre-planting", "Pre-Transplant", -14, "Cost Capture", "Land preparation, soil test, manure, seedlings or nursery and irrigation set-up.", "Use well-drained soil; waterlogging causes rot."),
    stage("oni-planting", "Transplanting", 0, "Planting", "Transplant seedlings at the recommended spacing and water in.", null),
    stage("oni-weeding", "First Weeding", 14, "Weeding", "Weed early: onions compete poorly with weeds.", null),
    stage("oni-topdress-1", "First Top-Dressing", 21, "Fertilizer", "Nitrogen top-dressing during leaf growth.", null, [product("Nitrogen top-dressing (e.g. CAN)", "Per soil test / agronomist advice")]),
    stage("oni-spray-1", "Thrips & Disease Scouting", 28, "Spray", "Scout for thrips, downy mildew and purple blotch; spray only when needed.", "Follow the label pre-harvest interval.", [product("Insecticide / fungicide (agronomist to specify)", "Per label")]),
    stage("oni-topdress-2", "Second Top-Dressing", 42, "Fertilizer", "Final nitrogen dose before bulbing; avoid late nitrogen.", "Late nitrogen delays bulbing and reduces storage life.", [product("Nitrogen top-dressing (e.g. CAN)", "Per soil test / agronomist advice")]),
    stage("oni-spray-2", "Disease Protection Round", 56, "Spray", "Continue scouting during bulbing.", null, [product("Fungicide (agronomist to specify)", "Per label")]),
    stage("oni-bulbing", "Bulbing & Irrigation Taper", 85, "Observation", "Reduce irrigation as bulbs mature and tops begin to fall.", null),
    stage("oni-harvest", "Harvest & Curing", 110, "Harvest", "Lift when most tops have fallen, then cure and dry well before storage or sale.", "Poor curing causes high storage losses."),
  ],
};

const CAPSICUM: CropTemplate = {
  id: "capsicum-template",
  cropType: "Capsicum",
  variety: "Sweet pepper",
  maturityDays: 80,
  germinationDays: 7,
  stopSprayingDaysBeforeHarvest: 7,
  prePlantingLeadDays: 14,
  blightRisk: "MEDIUM",
  notes: "Offsets are in days after transplanting. Draft schedule: confirm timings and all treatments locally before use.",
  stages: [
    stage("cap-pre-planting", "Pre-Transplant", -14, "Cost Capture", "Land preparation, soil test, lime if acidic, manure, seedlings or nursery, stakes and irrigation set-up.", "Avoid fields where solanaceous crops grew recently."),
    stage("cap-planting", "Transplanting", 0, "Planting", "Transplant healthy seedlings with basal fertilizer and water in.", null),
    stage("cap-gap-filling", "Establishment & Gap Filling", 7, "Observation", "Replace dead seedlings and check establishment.", null),
    stage("cap-topdress-1", "First Top-Dressing & Weeding", 21, "Fertilizer", "Nitrogen top-dressing and weeding.", null, [product("Nitrogen top-dressing (e.g. CAN)", "Per soil test / agronomist advice")]),
    stage("cap-staking", "Staking", 28, "Crop Management", "Stake plants to support fruit load.", null),
    stage("cap-spray-1", "Pest & Disease Scouting", 28, "Spray", "Scout for thrips, mites, aphids and fungal or bacterial disease; spray only when needed.", "Follow the label pre-harvest interval.", [product("Insecticide / fungicide (agronomist to specify)", "Per label")]),
    stage("cap-flowering", "Flowering: Top-Dressing & Calcium", 42, "Fertilizer", "Potassium and calcium support at flowering and fruit set; keep irrigation even.", "Uneven watering can cause blossom-end rot.", [product("Potassium / calcium source (agronomist to specify)", "Per soil test / label")]),
    stage("cap-spray-2", "Protection Round 2", 56, "Spray", "Continue scouting and protection through fruiting.", "Check the pre-harvest interval before each spray.", [product("Insecticide / fungicide (agronomist to specify)", "Per label")]),
    stage("cap-harvest", "Harvest (repeated picking)", 75, "Harvest", "Pick fruit at the size and colour the market wants; pick regularly.", "Handle gently and grade to reduce losses."),
  ],
};

export const EXTRA_CROP_TEMPLATES: CropTemplate[] = [CORIANDER, TOMATO, CABBAGE, ONION, CAPSICUM];

const META_BY_ID: Record<string, CropMeta> = {
  "potato-template-stephen-shangi": POTATO_META,
  "coriander-template": {
    riskLabel: "Disease pressure",
    plantingVerb: "Sowing",
    varieties: [
      { label: "Local (Dhania)", blightRisk: "LOW", maturityDays: 40, note: "About 35–45 days for leaf harvest" },
      { label: "Custom", blightRisk: "LOW", maturityDays: 40, note: "Enter your own variety" },
    ],
    prePlanting: commonPrePlanting("Seed Purchase"),
    harvestUnits: [
      { key: "bunch", label: "Bunch", plural: "Bunches", defaultKg: 0 },
      { key: "sack", label: "Sack", plural: "Sacks", defaultKg: 0 },
      { key: "kg", label: "Kg", plural: "Kg", defaultKg: 1 },
    ],
  },
  "tomato-template": {
    riskLabel: "Blight / disease risk",
    plantingVerb: "Transplanting",
    varieties: [
      { label: "Anna F1", blightRisk: "MEDIUM", maturityDays: 75, note: "Indeterminate hybrid, repeated picking" },
      { label: "Kilele F1", blightRisk: "MEDIUM", maturityDays: 75, note: "Indeterminate hybrid, repeated picking" },
      { label: "Cal J", blightRisk: "HIGH", maturityDays: 70, note: "Determinate open-pollinated" },
      { label: "Money Maker", blightRisk: "HIGH", maturityDays: 80, note: "Indeterminate open-pollinated" },
      { label: "Custom", blightRisk: "MEDIUM", maturityDays: 75, note: "Enter your own variety" },
    ],
    prePlanting: commonPrePlanting("Seedlings / Seed Purchase"),
    harvestUnits: [
      { key: "crate", label: "Crate", plural: "Crates", defaultKg: 60 },
      { key: "kg", label: "Kg", plural: "Kg", defaultKg: 1 },
      { key: "sack", label: "Sack", plural: "Sacks", defaultKg: 0 },
    ],
  },
  "cabbage-template": {
    riskLabel: "Pest / disease risk",
    plantingVerb: "Transplanting",
    varieties: [
      { label: "Gloria F1", blightRisk: "MEDIUM", maturityDays: 75, note: "About 70–80 days after transplanting" },
      { label: "Copenhagen Market", blightRisk: "MEDIUM", maturityDays: 85, note: "About 80–90 days after transplanting" },
      { label: "Custom", blightRisk: "MEDIUM", maturityDays: 80, note: "Enter your own variety" },
    ],
    prePlanting: commonPrePlanting("Seedlings / Seed Purchase"),
    harvestUnits: [
      { key: "head", label: "Head", plural: "Heads", defaultKg: 2 },
      { key: "sack", label: "Sack", plural: "Sacks", defaultKg: 0 },
      { key: "kg", label: "Kg", plural: "Kg", defaultKg: 1 },
    ],
  },
  "onion-template": {
    riskLabel: "Disease risk",
    plantingVerb: "Transplanting",
    varieties: [
      { label: "Red Creole", blightRisk: "MEDIUM", maturityDays: 120, note: "Long-storing red onion" },
      { label: "Bombay Red", blightRisk: "MEDIUM", maturityDays: 110, note: "Red bulb onion" },
      { label: "Texas Grano", blightRisk: "MEDIUM", maturityDays: 110, note: "Short-day yellow onion" },
      { label: "Custom", blightRisk: "MEDIUM", maturityDays: 110, note: "Enter your own variety" },
    ],
    prePlanting: commonPrePlanting("Seedlings / Seed Purchase"),
    harvestUnits: [
      { key: "net", label: "Net bag", plural: "Net bags", defaultKg: 50 },
      { key: "sack", label: "Sack", plural: "Sacks", defaultKg: 0 },
      { key: "kg", label: "Kg", plural: "Kg", defaultKg: 1 },
    ],
  },
  "capsicum-template": {
    riskLabel: "Pest / disease risk",
    plantingVerb: "Transplanting",
    varieties: [
      { label: "California Wonder", blightRisk: "MEDIUM", maturityDays: 80, note: "Open-pollinated green pepper" },
      { label: "Yolo Wonder", blightRisk: "MEDIUM", maturityDays: 80, note: "Open-pollinated green pepper" },
      { label: "Custom", blightRisk: "MEDIUM", maturityDays: 80, note: "Enter your own variety" },
    ],
    prePlanting: commonPrePlanting("Seedlings / Seed Purchase"),
    harvestUnits: [
      { key: "crate", label: "Crate", plural: "Crates", defaultKg: 0 },
      { key: "kg", label: "Kg", plural: "Kg", defaultKg: 1 },
      { key: "sack", label: "Sack", plural: "Sacks", defaultKg: 0 },
    ],
  },
};

export function getCropMeta(templateId?: string | null): CropMeta {
  return (templateId && META_BY_ID[templateId]) || POTATO_META;
}

export function unitFor(meta: CropMeta, key?: string | null): HarvestUnit {
  const normalized = key || "bag";
  return meta.harvestUnits.find((unit) => unit.key === normalized)
    || { key: normalized, label: normalized.charAt(0).toUpperCase() + normalized.slice(1), plural: `${normalized}s`, defaultKg: 0 };
}

export function harvestTotalsByUnit(
  records: { bags: number; unit?: string | null }[],
  meta: CropMeta
): { key: string; quantity: number; label: string; plural: string }[] {
  const quantities = new Map<string, number>();
  for (const record of records) {
    const key = record.unit || "bag";
    quantities.set(key, (quantities.get(key) || 0) + (Number(record.bags) || 0));
  }
  return [...quantities.entries()]
    .map(([key, quantity]) => {
      const unit = unitFor(meta, key);
      return { key, quantity, label: unit.label, plural: unit.plural };
    })
    .sort((a, b) => {
      const aIndex = meta.harvestUnits.findIndex((unit) => unit.key === a.key);
      const bIndex = meta.harvestUnits.findIndex((unit) => unit.key === b.key);
      return (aIndex < 0 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex < 0 ? Number.MAX_SAFE_INTEGER : bIndex);
    });
}

export function formatHarvestTotals(
  records: { bags: number; unit?: string | null }[],
  meta: CropMeta
): string {
  return harvestTotalsByUnit(records, meta)
    .map(({ quantity, label, plural }) => {
      const formatted = Number.isInteger(quantity) ? String(quantity) : quantity.toLocaleString(undefined, { maximumFractionDigits: 2 });
      return `${formatted} ${(quantity === 1 ? label : plural).toLowerCase()}`;
    })
    .join(" · ") || "0";
}
