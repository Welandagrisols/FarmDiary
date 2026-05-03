export const FARM_SEED = {
  id: "farm-001",
  name: "Rift Valley Potato Farm",
  location: "Nakuru / Bomet / Kericho, Kenya",
  total_acres: 4,
  lease_status: "Leased",
};

export const SEASON_SEED = {
  id: "season-001",
  farm_id: "farm-001",
  season_name: "Long Rains 2026",
  season_type: "Long Rains",
  status: "Active",
};

export interface CropTemplateStage {
  id: string;
  title: string;
  offsetDays: number;
  activityType: string;
  purpose: string;
  alert: string | null;
  products: PlannedProduct[];
  estimatedLaborCost: number;
  estimatedTotalCost: number;
}

export interface CropTemplate {
  id: string;
  cropType: string;
  variety: string;
  maturityDays: number;
  germinationDays: number;
  stopSprayingDaysBeforeHarvest: number;
  prePlantingLeadDays: number;
  blightRisk: "LOW" | "MEDIUM" | "HIGH";
  notes: string;
  stages: CropTemplateStage[];
}

export const SECTIONS_SEED = [
  {
    id: "section-a",
    season_id: "season-001",
    farm_id: "farm-001",
    label: "Section A",
    variety: "Stephen's",
    acres: 2,
    planting_date: "2026-02-17",
    estimated_germination: "2026-03-08",
    estimated_harvest: "2026-04-30",
    blight_risk: "HIGH",
    notes:
      "Stephen's variety matures in 72 days from planting — harvest April 30. Highly prone to Late Blight. Never skip sprays. Last spray April 22. If daily rain, reduce spray interval to 7 days.",
  },
  {
    id: "section-b",
    season_id: "season-001",
    farm_id: "farm-001",
    label: "Section B",
    variety: "Shangi",
    acres: 2,
    planting_date: "2026-02-20",
    estimated_germination: "2026-03-11",
    estimated_harvest: "2026-05-21",
    blight_risk: "MEDIUM",
    notes:
      "Shangi matures in 72–90 days from planting. Earliest harvest May 3, latest May 21. Calcium at flowering is critical to prevent hollow heart. Ensure deep earthing up.",
  },
];

export interface PlannedProduct {
  name: string;
  rate: string;
  qty: string;
  unitPrice: number;
  unit: string;
}

export interface PlannedActivity {
  id: string;
  templateId?: string;
  stage: string;
  activityType: string;
  name: string;
  plannedDateA: string;
  plannedDateB: string;
  daysAfterGermA: number | null;
  plannedProducts: PlannedProduct[];
  estimatedLaborCost?: number;
  estimatedTotalCost: number;
  purpose: string;
  alert: string | null;
}

function offsetDate(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

function buildCropTemplate(): CropTemplate {
  return {
    id: "potato-template-stephen-shangi",
    cropType: "Potato",
    variety: "Mixed: Stephen's / Shangi",
    maturityDays: 72,
    germinationDays: 21,
    stopSprayingDaysBeforeHarvest: 7,
    prePlantingLeadDays: 14,
    blightRisk: "HIGH",
    notes:
      "Template-based schedule generated from planting date. Pre-planting, planting, crop protection, bulking, maturation, and harvest are all calculated from rules.",
    stages: [
      {
        id: "pre-planting",
        title: "Pre-Planting",
        offsetDays: -14,
        activityType: "Cost Capture",
        purpose:
          "Land preparation, soil testing, seed purchase, fertilizer purchase, transport, labor, and other setup costs.",
        alert: "Capture historical pre-planting costs here.",
        products: [],
        estimatedLaborCost: 0,
        estimatedTotalCost: 0,
      },
      {
        id: "weed-control",
        title: "Pre-Emergence",
        offsetDays: 14,
        activityType: "Herbicide",
        purpose:
          "Kill weeds before potato sprouts emerge. Apply only before hook stage is visible.",
        alert: "Skip if cracking soil or sprouts are visible.",
        products: [
          { name: "Weedal 480SL", rate: "200ml per 20L", qty: "2L total", unitPrice: 1000, unit: "L" },
        ],
        estimatedLaborCost: 1000,
        estimatedTotalCost: 2000,
      },
      {
        id: "stage1-spray1",
        title: "Stage 1 — Emergence",
        offsetDays: 28,
        activityType: "Spray",
        purpose:
          "First fungal barrier and crop protection after emergence.",
        alert: "High-risk blight window. Never skip sprays.",
        products: [
          { name: "Kenthane 800WP", rate: "50g per 20L", qty: "2.5kg", unitPrice: 2200, unit: "2.5kg bag" },
          { name: "Metameta", rate: "70g per 20L", qty: "2.5kg", unitPrice: 4100, unit: "2.5kg bag" },
          { name: "Flexigold Starter", rate: "20ml per 20L", qty: "2L", unitPrice: 1200, unit: "L" },
        ],
        estimatedLaborCost: 1500,
        estimatedTotalCost: 7500,
      },
      {
        id: "earthing-up-1",
        title: "Stage 2 — Vegetative",
        offsetDays: 44,
        activityType: "Earthing Up + Fertilizer",
        purpose: "First earthing up and key soil nutrition event.",
        alert: "Most critical soil nutrition event of the season.",
        products: [
          { name: "OCP Fertilizer", rate: "50kg per acre", qty: "4 bags / 200kg", unitPrice: 3200, unit: "50kg bag" },
          { name: "Konkali", rate: "50kg per acre", qty: "4 bags / 200kg", unitPrice: 3800, unit: "50kg bag" },
        ],
        estimatedLaborCost: 3000,
        estimatedTotalCost: 31000,
      },
      {
        id: "stage3-spray1",
        title: "Stage 3 — Flowering & Bulking",
        offsetDays: 58,
        activityType: "Spray",
        purpose: "Money stage. Push tuber bulking and calcium support.",
        alert: "Critical calcium dose for tuber quality.",
        products: [
          { name: "Mastergold + Metameta Blend", rate: "~35g+35g per 20L", qty: "1.5kg blend", unitPrice: 1950, unit: "kg" },
          { name: "Multi-K", rate: "150g per 20L", qty: "2L for this spray", unitPrice: 400, unit: "L" },
          { name: "K-Flex", rate: "2L total for 4 acres", qty: "2L", unitPrice: 800, unit: "L" },
          { name: "Carbosink Calcium", rate: "20ml per 20L", qty: "1L", unitPrice: 800, unit: "L" },
        ],
        estimatedLaborCost: 1500,
        estimatedTotalCost: 9500,
      },
      {
        id: "maturation",
        title: "Maturation",
        offsetDays: 65,
        activityType: "Observation",
        purpose: "Stop all spraying and monitor vine die-back and skin set.",
        alert: "STOP spraying before harvest window.",
        products: [],
        estimatedLaborCost: 0,
        estimatedTotalCost: 0,
      },
      {
        id: "harvest",
        title: "Harvest",
        offsetDays: 72,
        activityType: "Harvest",
        purpose: "Harvest when foliage yellows and skin set is complete.",
        alert: "Never harvest in rain.",
        products: [],
        estimatedLaborCost: 5000,
        estimatedTotalCost: 5000,
      },
    ],
  };
}

export const CROP_TEMPLATES: CropTemplate[] = [buildCropTemplate()];

export function generatePlannedSchedule(template: CropTemplate, plantingDate: string): PlannedActivity[] {
  return template.stages.map((stage, index) => {
    const plannedDateA = offsetDate(plantingDate, stage.offsetDays);
    const plannedDateB = offsetDate(plantingDate, stage.offsetDays + 3);
    return {
      id: stage.id,
      templateId: template.id,
      stage: stage.title,
      activityType: stage.activityType,
      name: stage.title,
      plannedDateA,
      plannedDateB,
      daysAfterGermA: Math.max(0, stage.offsetDays - template.germinationDays),
      plannedProducts: stage.products,
      estimatedLaborCost: stage.estimatedLaborCost || undefined,
      estimatedTotalCost: stage.estimatedTotalCost,
      purpose: stage.purpose,
      alert: stage.alert,
    };
  });
}

export const PLANNED_SCHEDULE: PlannedActivity[] = generatePlannedSchedule(CROP_TEMPLATES[0], "2026-02-17");

export const TOTAL_ESTIMATED_COST = PLANNED_SCHEDULE.reduce((sum, a) => sum + a.estimatedTotalCost, 0);

export const COST_CATEGORIES: Record<string, string[]> = {
  "Pre-Planting": [
    "Land Lease / Rent",
    "Land Survey / Demarcation",
    "Soil Testing",
    "Land Clearing",
    "Ploughing — 1st Pass",
    "Ploughing — 2nd Pass",
    "Harrowing / Levelling",
    "Drainage Channel Digging",
    "Furrow Making",
    "Lime Application",
    "Soil Amendment — Compost / Manure",
    "Seed Tubers Purchase",
    "Seed Treatment",
    "Basal Fertilizer (DAP / NPSb)",
    "Pre-Planting Herbicide",
    "Other Pre-Planting",
  ],
  "Inputs": [
    "Fungicide",
    "Insecticide",
    "Herbicide",
    "Foliar Fertilizer",
    "Soil Fertilizer (Top Dressing)",
    "Biostimulant",
    "Organic Input (Rabbit Urine / Compost Tea)",
    "Sticker / Adjuvant",
    "Other Agrochemical",
  ],
  "Labor": [
    "Land Preparation Labor",
    "Planting Labor",
    "Weeding Labor",
    "Spraying Labor",
    "Earthing Up Labor",
    "Fertilizer Application Labor",
    "Scouting / Monitoring Labor",
    "Harvest Labor",
    "Post-Harvest Sorting Labor",
    "Loading / Transport Labor",
    "Security / Watchman",
    "Casual Labor — Other",
  ],
  "Facilitation": [
    "Farm Manager / Supervisor Fee",
    "Agronomist / Consultant Fee",
    "Professional Service Fee (Accountant / Legal)",
    "Motorcycle / Boda Hire",
    "Matatu / Bus / Taxi Fare",
    "Vehicle / Car Hire",
    "Fuel — Manager / Supervisor Trip",
    "Fuel — Input Collection Trip",
    "Accommodation — Overnight Stay",
    "Meals / Food / Per Diem",
    "Mobile / Communication / Airtime",
    "Other Facilitation",
  ],
  "Logistics": [
    "Input Delivery — Transport",
    "Agrochemical Purchase Trip",
    "Harvest Transport to Market",
    "Harvest Transport to Store",
    "Packaging / Bags",
    "Cold Storage Fees",
    "Market Fees / Levies",
    "Broker / Agent Commission",
    "Weighing / Grading Fees",
    "Other Logistics",
  ],
  "Equipment": [
    "Knapsack Sprayer Purchase",
    "Knapsack Sprayer Repair",
    "Tractor Hire — Ploughing",
    "Tractor Hire — Other",
    "Motorcycle / Boda Hire — Equipment",
    "Hand Tools Purchase",
    "Hand Tools Repair",
    "Other Equipment",
  ],
  "Community & Goodwill": [
    "Token of Appreciation — Neighbour",
    "Token of Appreciation — Community Leader",
    "Token of Appreciation — Local Authority",
    "Gift — Worker Recognition",
    "Community / Harambee Contribution",
    "Boundary / Access Agreement Cost",
    "Water Access Fee / Contribution",
    "Local Security Contribution",
    "Other Community & Goodwill",
  ],
  "Overhead": [
    "Farm Registration / Permit",
    "Insurance",
    "Loan Interest / Bank Charges",
    "Accountant / Record Keeping Fee",
    "Other Overhead",
  ],
};

export const INVENTORY_MASTER = [
  { product: "Weedal 480SL", category: "Herbicide", qty: 2, unit: "L", unitPrice: 1000 },
  { product: "Kenthane 800WP", category: "Fungicide", qty: 5, unit: "kg", unitPrice: 880 },
  { product: "Metameta", category: "Fungicide", qty: 10, unit: "kg", unitPrice: 1640 },
  { product: "Mastergold", category: "Fungicide", qty: 4, unit: "kg", unitPrice: 1950 },
  { product: "Halothrin", category: "Insecticide", qty: 0.5, unit: "L", unitPrice: 1200 },
  { product: "Vendex", category: "Insecticide", qty: 0.5, unit: "L", unitPrice: 1050 },
  { product: "Sands (Sticker)", category: "Sticker", qty: 1, unit: "L", unitPrice: 1200 },
  { product: "OCP Fertilizer", category: "Soil Fertilizer", qty: 4, unit: "50kg bag", unitPrice: 3200 },
  { product: "Konkali", category: "Soil Fertilizer", qty: 4, unit: "50kg bag", unitPrice: 3800 },
  { product: "Flexigold Starter", category: "Foliar", qty: 4, unit: "L", unitPrice: 1200 },
  { product: "Flexigold Vegetative", category: "Foliar", qty: 4, unit: "L", unitPrice: 1200 },
  { product: "YaraVita", category: "Foliar", qty: 3, unit: "L", unitPrice: 1000 },
  { product: "Agrozyne", category: "Biostimulant", qty: 2, unit: "L", unitPrice: 1000 },
  { product: "Carbosink", category: "Biostimulant", qty: 2, unit: "L", unitPrice: 1200 },
  { product: "Carbosink Calcium", category: "Foliar Calcium", qty: 1, unit: "L", unitPrice: 800 },
  { product: "K-Flex", category: "Foliar Potassium", qty: 4, unit: "L", unitPrice: 800 },
  { product: "Multi-K", category: "Foliar Potassium", qty: 10, unit: "L", unitPrice: 400 },
  { product: "Rabbit Urine", category: "Organic", qty: 20, unit: "L", unitPrice: 250 },
];
