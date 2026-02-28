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
    estimated_harvest: "2026-06-17",
    blight_risk: "HIGH",
    notes:
      "Stephen's variety is highly prone to Late Blight fungal disease. Never skip sprays. If daily rain, reduce spray interval to 7 days.",
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
    estimated_harvest: "2026-06-20",
    blight_risk: "MEDIUM",
    notes:
      "Shangi is a fast, heavy grower. Calcium at flowering is critical to prevent hollow heart. Ensure deep earthing up.",
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

export const PLANNED_SCHEDULE: PlannedActivity[] = [
  {
    id: "pre-planting",
    stage: "Pre-Planting",
    activityType: "Cost Capture",
    name: "Pre-Planting Costs",
    plannedDateA: "2026-02-01",
    plannedDateB: "2026-02-01",
    daysAfterGermA: null,
    plannedProducts: [],
    estimatedTotalCost: 0,
    purpose:
      "All costs before planting: land lease, soil testing, ploughing, harrowing, lime, NPSb, seed tubers, compost/manure, DAP at planting, all labor. Enter these retrospectively via Add Cost form with any past date.",
    alert: "Use 'Add Historical Cost' to capture pre-planting costs already spent.",
  },
  {
    id: "weed-control",
    stage: "Pre-Emergence",
    activityType: "Herbicide",
    name: "Weed Control — Weedal",
    plannedDateA: "2026-03-01",
    plannedDateB: "2026-03-04",
    daysAfterGermA: -7,
    plannedProducts: [
      { name: "Weedal 480SL", rate: "200ml per 20L", qty: "2L total", unitPrice: 1000, unit: "L" },
    ],
    estimatedLaborCost: 1000,
    estimatedTotalCost: 2000,
    purpose:
      "Kill weeds before potato sprouts emerge. Apply 12-14 days after planting, BEFORE any sprout is visible.",
    alert: "If cracking soil or a hook (bent sprout) is visible — DO NOT spray Weedal. Skip it entirely.",
  },
  {
    id: "stage1-spray1",
    stage: "Stage 1 — Emergence",
    activityType: "Spray",
    name: "Stage 1 — 1st Spray",
    plannedDateA: "2026-03-15",
    plannedDateB: "2026-03-18",
    daysAfterGermA: 7,
    plannedProducts: [
      { name: "Kenthane 800WP", rate: "50g per 20L", qty: "2.5kg", unitPrice: 2200, unit: "2.5kg bag" },
      { name: "Metameta", rate: "70g per 20L", qty: "2.5kg", unitPrice: 4100, unit: "2.5kg bag" },
      { name: "Flexigold Starter", rate: "20ml per 20L", qty: "2L", unitPrice: 1200, unit: "L" },
      { name: "Rabbit Urine", rate: "600ml per 20L", qty: "from 20L stock", unitPrice: 250, unit: "L" },
      { name: "YaraVita", rate: "200ml per 20L", qty: "1L", unitPrice: 1000, unit: "L" },
      { name: "Agrozyne", rate: "20ml per 20L", qty: "500ml", unitPrice: 1000, unit: "L" },
      { name: "Halothrin + Vendex Blend", rate: "10ml each per 20L", qty: "300ml each", unitPrice: 2250, unit: "combined" },
      { name: "Sands (Sticker/Spreader)", rate: "5-10ml per 20L", qty: "from 1L stock", unitPrice: 1200, unit: "L" },
    ],
    estimatedLaborCost: 1500,
    estimatedTotalCost: 7500,
    purpose:
      "First fungal barrier. Kenthane (contact) + Metameta (systemic). Rabbit Urine = organic nitrogen + aphid repellent. Halothrin + Vendex blend kills cutworms and aphids. NEVER spray without Sands sticker — rain washes products off within hours.",
    alert: "Stephen's = HIGH RISK. Use full 70g Metameta. Do not reduce.",
  },
  {
    id: "stage1-spray2",
    stage: "Stage 1 — Emergence",
    activityType: "Spray",
    name: "Stage 1 — 2nd Spray",
    plannedDateA: "2026-03-27",
    plannedDateB: "2026-03-30",
    daysAfterGermA: 19,
    plannedProducts: [
      { name: "Kenthane 800WP", rate: "50g per 20L", qty: "2.5kg", unitPrice: 2200, unit: "2.5kg bag" },
      { name: "Metameta", rate: "70g per 20L", qty: "2.5kg", unitPrice: 4100, unit: "2.5kg bag" },
      { name: "Flexigold Starter", rate: "20ml per 20L", qty: "1L", unitPrice: 1200, unit: "L" },
      { name: "Rabbit Urine", rate: "600ml per 20L", qty: "from stock", unitPrice: 250, unit: "L" },
      { name: "YaraVita", rate: "200ml per 20L", qty: "1L", unitPrice: 1000, unit: "L" },
      { name: "Agrozyne", rate: "20ml per 20L", qty: "from stock", unitPrice: 1000, unit: "L" },
      { name: "Halothrin + Vendex Blend", rate: "10ml each per 20L", qty: "from stock", unitPrice: 2250, unit: "combined" },
      { name: "Sands (Sticker/Spreader)", rate: "5-10ml per 20L", qty: "from stock", unitPrice: 1200, unit: "L" },
    ],
    estimatedLaborCost: 1500,
    estimatedTotalCost: 7500,
    purpose: "Repeat Stage 1. If heavy daily rain, reduce interval from 12 to 7 days.",
    alert: "In heavy daily rain: spray at 7 days, not 12.",
  },
  {
    id: "earthing-up-1",
    stage: "Stage 2 — Vegetative",
    activityType: "Earthing Up + Fertilizer",
    name: "1st Earthing Up + OCP/Konkali",
    plannedDateA: "2026-04-01",
    plannedDateB: "2026-04-04",
    daysAfterGermA: 23,
    plannedProducts: [
      { name: "OCP Fertilizer", rate: "50kg per acre (soil)", qty: "4 bags / 200kg", unitPrice: 3200, unit: "50kg bag" },
      { name: "Konkali", rate: "50kg per acre (soil)", qty: "4 bags / 200kg", unitPrice: 3800, unit: "50kg bag" },
    ],
    estimatedLaborCost: 3000,
    estimatedTotalCost: 31000,
    purpose:
      "BENCHMARK STRATEGY: OCP + Konkali at 44 days from planting. A local farmer achieved 4x yield using this approach. Mound soil 20-25cm. Prevents tuber greening and Potato Tuber Moth access.",
    alert: "Most critical soil nutrition event of the season. Do not delay.",
  },
  {
    id: "stage2-spray1",
    stage: "Stage 2 — Vegetative",
    activityType: "Spray",
    name: "Stage 2 — 1st Spray",
    plannedDateA: "2026-04-10",
    plannedDateB: "2026-04-13",
    daysAfterGermA: 32,
    plannedProducts: [
      { name: "Mastergold + Metameta Blend", rate: "~35g+35g per 20L", qty: "1.5kg blend total", unitPrice: 1950, unit: "kg" },
      { name: "Flexigold Vegetative", rate: "20ml per 20L", qty: "2L", unitPrice: 1200, unit: "L" },
      { name: "Rabbit Urine", rate: "600ml per 20L", qty: "from stock", unitPrice: 250, unit: "L" },
      { name: "Surds (Sticker)", rate: "5-10ml per 20L", qty: "from stock", unitPrice: 1200, unit: "L" },
      { name: "Carbosink (Biostimulant)", rate: "20ml per 20L", qty: "500ml", unitPrice: 1200, unit: "L" },
    ],
    estimatedLaborCost: 1500,
    estimatedTotalCost: 8800,
    purpose:
      "STAGE 2 TRANSITION: Drop Kenthane — never use again. Switch to Mastergold + Metameta blend. Drop Flexigold Starter — switch to Flexigold Vegetative. Introduce Carbosink (biostimulant / nutrient transporter — NOT a calcium product).",
    alert: "Kenthane is Stage 1 ONLY. Use Mastergold + Metameta blend from here onward.",
  },
  {
    id: "earthing-up-2",
    stage: "Stage 2 — Vegetative",
    activityType: "Earthing Up",
    name: "2nd Earthing Up (No Fertilizer)",
    plannedDateA: "2026-04-15",
    plannedDateB: "2026-04-18",
    daysAfterGermA: 37,
    plannedProducts: [],
    estimatedLaborCost: 4000,
    estimatedTotalCost: 4000,
    purpose:
      "Build ridge to 25-30cm. No fertilizer this time. Prevents greening, blocks Potato Tuber Moth, channels rain away from tubers.",
    alert: null,
  },
  {
    id: "stage2-spray2",
    stage: "Stage 2 — Vegetative",
    activityType: "Spray",
    name: "Stage 2 — 2nd Spray",
    plannedDateA: "2026-04-22",
    plannedDateB: "2026-04-25",
    daysAfterGermA: 44,
    plannedProducts: [
      { name: "Mastergold + Metameta Blend", rate: "~35g+35g per 20L", qty: "1.5kg blend", unitPrice: 1950, unit: "kg" },
      { name: "Flexigold Vegetative", rate: "20ml per 20L", qty: "1L", unitPrice: 1200, unit: "L" },
      { name: "Rabbit Urine", rate: "600ml per 20L", qty: "from stock", unitPrice: 250, unit: "L" },
      { name: "Surds (Sticker)", rate: "5-10ml per 20L", qty: "from stock", unitPrice: 1200, unit: "L" },
      { name: "Carbosink (Biostimulant)", rate: "20ml per 20L", qty: "from stock", unitPrice: 1200, unit: "L" },
    ],
    estimatedLaborCost: 1500,
    estimatedTotalCost: 8800,
    purpose: "Maintain systemic blight protection during peak April rains.",
    alert: "Peak rain period. Reduce to 7-day interval if daily rain.",
  },
  {
    id: "stage3-spray1",
    stage: "Stage 3 — Flowering & Bulking",
    activityType: "Spray",
    name: "Stage 3 — 1st Spray (Flower Buds)",
    plannedDateA: "2026-05-03",
    plannedDateB: "2026-05-06",
    daysAfterGermA: 55,
    plannedProducts: [
      { name: "Mastergold + Metameta Blend", rate: "~35g+35g per 20L", qty: "1.5kg blend", unitPrice: 1950, unit: "kg" },
      { name: "Multi-K", rate: "150g per 20L", qty: "2L for this spray", unitPrice: 400, unit: "L" },
      { name: "K-Flex", rate: "2L total for 4 acres", qty: "2L", unitPrice: 800, unit: "L" },
      { name: "Carbosink Calcium", rate: "20ml per 20L", qty: "1L", unitPrice: 800, unit: "L" },
      { name: "Surds (Sticker)", rate: "5-10ml per 20L", qty: "from stock", unitPrice: 1200, unit: "L" },
    ],
    estimatedLaborCost: 1500,
    estimatedTotalCost: 9500,
    purpose:
      "THE MONEY STAGE. Apply when first flower buds appear. Introduce K-Flex + Multi-K (potassium drives tuber size). Introduce Carbosink Calcium — DIFFERENT from Carbosink — it supplies calcium for cell walls, prevents hollow heart and rot, toughens skin for transport.",
    alert: "Critical for Shangi — do NOT miss Calcium. Apply when flower buds are forming.",
  },
  {
    id: "stage3-spray2",
    stage: "Stage 3 — Flowering & Bulking",
    activityType: "Spray",
    name: "Stage 3 — 2nd Spray (Tuber Bulking)",
    plannedDateA: "2026-05-17",
    plannedDateB: "2026-05-20",
    daysAfterGermA: 69,
    plannedProducts: [
      { name: "Mastergold + Metameta Blend", rate: "~35g+35g per 20L", qty: "1.5kg blend", unitPrice: 1950, unit: "kg" },
      { name: "Multi-K", rate: "150g per 20L", qty: "from stock", unitPrice: 400, unit: "L" },
      { name: "K-Flex", rate: "2L total for 4 acres", qty: "2L", unitPrice: 800, unit: "L" },
      { name: "Carbosink Calcium", rate: "20ml per 20L", qty: "from stock", unitPrice: 800, unit: "L" },
      { name: "Surds (Sticker)", rate: "5-10ml per 20L", qty: "from stock", unitPrice: 1200, unit: "L" },
    ],
    estimatedLaborCost: 1500,
    estimatedTotalCost: 9500,
    purpose:
      "Final bulking push. Maximize tuber weight. Keep canopy alive as long as possible — every extra green day means more starch into tubers.",
    alert: null,
  },
  {
    id: "maturation",
    stage: "Maturation",
    activityType: "Observation",
    name: "Stop All Spraying — Maturation",
    plannedDateA: "2026-05-23",
    plannedDateB: "2026-05-26",
    daysAfterGermA: 75,
    plannedProducts: [],
    estimatedTotalCost: 0,
    purpose: "All spraying stops. Allow natural vine die-back and skin hardening. Monitor foliage yellowing.",
    alert: "STOP all chemical applications from this date.",
  },
  {
    id: "harvest",
    stage: "Harvest",
    activityType: "Harvest",
    name: "HARVEST",
    plannedDateA: "2026-06-17",
    plannedDateB: "2026-06-20",
    daysAfterGermA: 100,
    plannedProducts: [],
    estimatedLaborCost: 5000,
    estimatedTotalCost: 5000,
    purpose:
      "Harvest when foliage is yellowed, stolons separate easily, and skin does not slip on the thumb rub test. Harvest in dry conditions only.",
    alert:
      "SKIN SET TEST: Rub thumb firmly on tuber. Skin slips = not ready. Skin holds = harvest time. Never harvest in rain.",
  },
];

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
