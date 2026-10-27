// Links between an activity and the cost entries it created, and the rules that keep them in step.
//
// Why: an activity's labour and inputs are saved as separate cost entries in the ledger (the ledger is what
// every total uses). Editing the activity used to change only the activity, so the two silently drifted apart,
// and the "By activity" view guessed which costs belonged to which activity by date.
//
// Rules:
//  * Every cost entry an activity creates carries activity_log_id.
//  * Editing an activity updates its linked labour/input entries, creates entries for newly added labour or
//    products, and removes entries whose labour/product was taken away.
//  * Nothing is ever resurrected: if the old activity had labour or a product but its entry is missing (recorded
//    before linking, or deleted from the ledger on purpose), the ledger is left alone and the person is told.
//  * Other linked costs (transport, facilitation…) are not edited here; they only follow a change of date.

import type { CostEntry, ProductUsed } from "./storage";

export type NewCost = Omit<CostEntry, "id" | "created_at"> & { activity_log_id?: string | null };

export interface CostContext {
  activityLogId: string | null;
  farmId: string;
  seasonId: string;
  sectionId: string | null;
  activityName: string;
  date: string;
  isPrePlanting: boolean;
  isHistorical: boolean;
  notes: string | null;
  weather: string | null;
}

const norm = (s: string) => s.trim().toLocaleLowerCase();
const kes = (n: number) => `KES ${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
const round2 = (n: number) => Math.round(n * 100) / 100;
const differs = (a: number | null | undefined, b: number | null | undefined) =>
  (a ?? null) === null || (b ?? null) === null ? (a ?? null) !== (b ?? null) : Math.abs((a as number) - (b as number)) > 1e-9;
const oldestFirst = (rows: CostEntry[]) => [...rows].sort((x, y) => x.created_at.localeCompare(y.created_at));

export function laborSubcategory(activityId: string): string {
  if (!activityId) return "Casual Labor — Other";
  if (activityId.includes("harvest")) return "Harvest Labor";
  if (activityId.includes("earthing")) return "Earthing Up Labor";
  if (activityId.includes("weed")) return "Weeding Labor";
  if (activityId.includes("planting")) return "Planting Labor";
  if (activityId.includes("spray") || activityId.includes("stage")) return "Spraying Labor";
  return "Casual Labor — Other";
}

export function linkedCostsForActivity<T extends { activity_log_id?: string | null }>(activityLogId: string, costs: readonly T[]): T[] {
  return costs.filter((c) => c.activity_log_id === activityLogId);
}

/** Costs to show under an activity: its linked entries, or (for old unlinked data only) same-day costs in the same block. */
export function relatedCostsForLog<T extends { activity_log_id?: string | null; section_id: string | null; cost_date: string; season_id: string }>(
  log: { id: string; actual_date: string; section_id: string | null; season_id: string },
  costs: readonly T[],
): T[] {
  const linked = linkedCostsForActivity(log.id, costs);
  if (linked.length > 0) return linked;
  return costs.filter(
    (c) => !c.activity_log_id && c.season_id === log.season_id && c.cost_date === log.actual_date &&
      (c.section_id === log.section_id || c.section_id === null || log.section_id === null),
  );
}

// ───────────── building entries (same shape the Log Activity screen has always saved) ─────────────

const withLink = (ctx: CostContext) => (ctx.activityLogId ? { activity_log_id: ctx.activityLogId } : {});

export function buildLabourCost(ctx: CostContext, o: { amount: number; numWorkers: number; daysWorked: number; dailyRate: number | null; subcategory: string }): NewCost {
  return {
    farm_id: ctx.farmId, season_id: ctx.seasonId, section_id: ctx.sectionId,
    cost_category: "Labor", cost_subcategory: o.subcategory, description: `Labor — ${ctx.activityName}`,
    cost_date: ctx.date, is_pre_planting: ctx.isPrePlanting, is_historical: ctx.isHistorical,
    amount_kes: o.amount, quantity: o.numWorkers || null, unit: "workers", unit_price_kes: o.dailyRate,
    product_name: null, supplier: null, receipt_reference: null,
    num_workers: o.numWorkers || null, days_worked: o.daysWorked || null, rate_per_worker_per_day: o.dailyRate,
    facilitator_name: null, trip_from: null, trip_to: null,
    is_deviation: false, planned_product: null, deviation_reason: null,
    notes: ctx.notes, weather_conditions: ctx.weather, ...withLink(ctx),
  };
}

export function buildInputCost(ctx: CostContext, p: ProductUsed, subcategory: string): NewCost {
  return {
    farm_id: ctx.farmId, season_id: ctx.seasonId, section_id: ctx.sectionId,
    cost_category: "Inputs", cost_subcategory: subcategory, description: p.name,
    cost_date: ctx.date, is_pre_planting: ctx.isPrePlanting, is_historical: ctx.isHistorical,
    amount_kes: p.total, quantity: p.qty, unit: null, unit_price_kes: null,
    product_name: null, supplier: null, receipt_reference: null,
    num_workers: null, days_worked: null, rate_per_worker_per_day: null,
    facilitator_name: null, trip_from: null, trip_to: null,
    is_deviation: p.is_deviation, planned_product: p.is_deviation ? p.name : null, deviation_reason: p.deviation_reason,
    notes: ctx.notes, weather_conditions: ctx.weather, ...withLink(ctx),
  };
}

// ───────────── keeping them in step when an activity is edited ─────────────

export interface PlannedCreate { cost: NewCost; label: string; amount: number }
export interface PlannedUpdate { id: string; updates: Partial<CostEntry>; label: string; before: number; after: number }
export interface PlannedDelete { id: string; label: string; amount: number }
export interface ActivityCostPlan {
  creates: PlannedCreate[];
  updates: PlannedUpdate[];
  deletes: PlannedDelete[];
  /** Things the ledger could not follow, in plain words. */
  notes: string[];
  isEmpty: boolean;
}

export interface PlanInput {
  /** The activity as it will be after the edit (date, block, notes, ids). */
  context: CostContext;
  before: { labourCost: number; products: ProductUsed[] };
  after: { labourCost: number; numWorkers: number; daysWorked: number; labourSubcategory: string; products: ProductUsed[] };
  /** Cost entries whose activity_log_id is this activity. */
  linked: readonly CostEntry[];
  /** Subcategory for a newly created input entry. */
  inputSubcategory: (productName: string) => string;
}

const hasMoney = (p: ProductUsed) => (Number(p.total) || 0) > 0;

export function planActivityCostSync(input: PlanInput): ActivityCostPlan {
  const { context: ctx, before, after, linked, inputSubcategory } = input;
  const creates: PlannedCreate[] = [];
  const deletes: PlannedDelete[] = [];
  const notes: string[] = [];
  const removed = new Set<string>();
  const patches = new Map<string, PlannedUpdate>();

  const patch = (entry: CostEntry, label: string) => {
    let p = patches.get(entry.id);
    if (!p) { p = { id: entry.id, updates: {}, label, before: entry.amount_kes, after: entry.amount_kes }; patches.set(entry.id, p); }
    return p;
  };
  const remove = (entry: CostEntry, label: string) => { removed.add(entry.id); deletes.push({ id: entry.id, label, amount: entry.amount_kes }); };

  // Labour
  const labourLinked = oldestFirst(linked.filter((c) => c.cost_category === "Labor"));
  if (labourLinked.length > 0) {
    const entry = labourLinked[0];
    if (after.labourCost > 0) {
      const workers = after.numWorkers > 0 ? after.numWorkers : null;
      const days = after.daysWorked > 0 ? after.daysWorked : null;
      const wanted: Partial<CostEntry> = { amount_kes: after.labourCost, num_workers: workers, days_worked: days, quantity: workers };
      const changed = (Object.keys(wanted) as (keyof CostEntry)[]).some((k) => differs(entry[k] as number | null, wanted[k] as number | null));
      if (changed) {
        const p = patch(entry, "Labour");
        Object.assign(p.updates, wanted);
        if (workers && days) p.updates.rate_per_worker_per_day = round2(after.labourCost / (workers * days));
        p.after = after.labourCost;
      }
    } else {
      remove(entry, "Labour");
    }
  } else if (before.labourCost <= 0 && after.labourCost > 0) {
    const rate = after.numWorkers > 0 && after.daysWorked > 0 ? round2(after.labourCost / (after.numWorkers * after.daysWorked)) : null;
    creates.push({
      label: "Labour", amount: after.labourCost,
      cost: buildLabourCost(ctx, { amount: after.labourCost, numWorkers: after.numWorkers, daysWorked: after.daysWorked, dailyRate: rate, subcategory: after.labourSubcategory }),
    });
  } else if (differs(before.labourCost, after.labourCost)) {
    notes.push(`Labour changed from ${kes(before.labourCost)} to ${kes(after.labourCost)}, but this activity has no linked labour cost entry, so the ledger was not changed for labour.`);
  }

  // Inputs, matched product by product (by name; repeated names are matched in order)
  const inputLinked = oldestFirst(linked.filter((c) => c.cost_category === "Inputs"));
  const keys = new Set<string>([...after.products.filter(hasMoney), ...before.products.filter(hasMoney)].map((p) => norm(p.name)));
  for (const c of inputLinked) keys.add(norm(c.description));
  for (const key of keys) {
    const wanted = after.products.filter((p) => hasMoney(p) && norm(p.name) === key);
    const was = before.products.filter((p) => hasMoney(p) && norm(p.name) === key);
    const entries = inputLinked.filter((c) => norm(c.description) === key);
    const total = Math.max(wanted.length, entries.length);
    for (let i = 0; i < total; i++) {
      const w = wanted[i], e = entries[i];
      if (w && e) {
        if (differs(e.amount_kes, w.total) || differs(e.quantity, w.qty)) {
          const p = patch(e, `Input: ${w.name}`);
          p.updates.amount_kes = w.total;
          p.updates.quantity = w.qty;
          p.after = w.total;
        }
      } else if (w && !e) {
        if (i >= was.length) {
          creates.push({ label: `Input: ${w.name}`, amount: w.total, cost: buildInputCost(ctx, w, inputSubcategory(w.name)) });
        } else if (differs(was[i].total, w.total) || differs(was[i].qty, w.qty)) {
          notes.push(`${w.name} changed, but it has no linked cost entry, so the ledger was not changed for it.`);
        }
      } else if (e) {
        remove(e, `Input: ${e.description}`);
      }
    }
  }

  // Everything linked follows the activity's date (and the pre-planting flag that depends on it).
  for (const c of linked) {
    if (removed.has(c.id)) continue;
    if (c.cost_date !== ctx.date || c.is_pre_planting !== ctx.isPrePlanting) {
      const p = patch(c, c.cost_category === "Labor" ? "Labour" : c.description);
      p.updates.cost_date = ctx.date;
      p.updates.is_pre_planting = ctx.isPrePlanting;
    }
  }

  const updates = [...patches.values()].filter((p) => Object.keys(p.updates).length > 0);
  return { creates, updates, deletes, notes, isEmpty: creates.length + updates.length + deletes.length === 0 };
}

/** Plain-language lines for a confirmation dialog. */
export function describePlan(plan: ActivityCostPlan): string[] {
  const lines: string[] = [];
  for (const u of plan.updates) {
    if (differs(u.before, u.after)) lines.push(`${u.label}: ${kes(u.before)} → ${kes(u.after)}`);
    else if (u.updates.cost_date) lines.push(`${u.label}: moved to ${u.updates.cost_date}`);
    else lines.push(`${u.label}: details updated`);
  }
  for (const c of plan.creates) lines.push(`Add ${c.label}: ${kes(c.amount)}`);
  for (const d of plan.deletes) lines.push(`Remove ${d.label}: ${kes(d.amount)}`);
  return lines;
}

/** How much stock each product's usage changed by (positive = more used). Keys are lower-case product names. */
export function inventoryDeltas(before: readonly ProductUsed[], after: readonly ProductUsed[]): Record<string, number> {
  const delta: Record<string, number> = {};
  const add = (list: readonly ProductUsed[], sign: 1 | -1) => {
    for (const p of list) {
      const key = norm(p.name);
      const qty = Number(p.qty);
      if (!key || !Number.isFinite(qty) || qty <= 0) continue;
      delta[key] = (delta[key] ?? 0) + sign * qty;
    }
  };
  add(after, 1);
  add(before, -1);
  for (const key of Object.keys(delta)) if (Math.abs(delta[key]) < 1e-9) delete delta[key];
  return delta;
}
