export function canManageLabourCosts(role: unknown): boolean {
  return role === "admin" || role === "owner" || role === "manager";
}

export function isLabourCostCategory(category: unknown): boolean {
  if (typeof category !== "string") return false;
  const normalized = category.trim().toLocaleLowerCase();
  return normalized === "labor" || normalized === "labour";
}

export function hasLabourCostAmount(value: unknown): boolean {
  const amount = Number(value);
  return Number.isFinite(amount) && amount !== 0;
}

export function hasLabourCostFields(value: {
  cost_category?: unknown;
  num_workers?: unknown;
  days_worked?: unknown;
  rate_per_worker_per_day?: unknown;
}): boolean {
  return isLabourCostCategory(value.cost_category)
    || value.num_workers != null
    || value.days_worked != null
    || value.rate_per_worker_per_day != null;
}

export function assertCanManageLabourCosts(role: unknown): void {
  if (!canManageLabourCosts(role)) {
    throw new Error("Only a farm manager can record or change labour costs.");
  }
}
