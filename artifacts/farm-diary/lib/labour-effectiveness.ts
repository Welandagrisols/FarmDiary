import type { ActivityLog } from "./storage";

export interface LabourEffectivenessGroup {
  category: string;
  unit: string;
  quantity: number;
  workerDays: number;
  quantityPerWorkerDay: number;
  records: number;
}

export interface NamedWorkerDays {
  name: string;
  workerDays: number;
  records: number;
}

export function summarizeLabourEffectiveness(logs: ActivityLog[]) {
  const groups = new Map<string, LabourEffectivenessGroup>();
  const namedWorkers = new Map<string, NamedWorkerDays>();
  let workerDays = 0;
  let labourCost = 0;

  for (const log of logs) {
    const workers = Math.max(0, Number(log.num_workers) || 0);
    const days = Math.max(0, Number(log.days_worked) || 0);
    const activityWorkerDays = workers * days;
    workerDays += activityWorkerDays;
    labourCost += Math.max(0, Number(log.labor_cost_kes) || 0);

    const assignments = log.worker_assignments ?? [];
    const namedPeople = assignments.length
      ? assignments.map((assignment) => ({
        name: assignment.worker_name.trim(),
        days: Math.max(0, Number(assignment.days_worked) || 0),
      }))
      : [...new Set((log.worker_names ?? "")
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean))]
        .map((name) => ({ name, days: Math.max(0, Number(log.days_worked) || 0) }));
    for (const person of namedPeople) {
      if (!person.name) continue;
      const key = person.name.toLocaleLowerCase();
      const worker = namedWorkers.get(key) ?? { name: person.name, workerDays: 0, records: 0 };
      worker.workerDays += person.days;
      worker.records += 1;
      namedWorkers.set(key, worker);
    }

    const quantity = Number(log.work_quantity);
    const unit = log.work_unit?.trim();
    if (!Number.isFinite(quantity) || quantity <= 0 || !unit || activityWorkerDays <= 0) continue;

    const category = log.activity_category?.trim() || "Other";
    const label = category.toLowerCase() === "other" ? log.activity_name : category;
    const key = `${label.toLocaleLowerCase()}::${unit.toLocaleLowerCase()}`;
    const group = groups.get(key) ?? {
      category: label,
      unit,
      quantity: 0,
      workerDays: 0,
      quantityPerWorkerDay: 0,
      records: 0,
    };

    group.quantity += quantity;
    group.workerDays += activityWorkerDays;
    group.quantityPerWorkerDay = group.quantity / group.workerDays;
    group.records += 1;
    groups.set(key, group);
  }

  return {
    records: logs.length,
    workerDays,
    labourCost,
    groups: Array.from(groups.values()).sort((a, b) => b.workerDays - a.workerDays),
    namedWorkers: Array.from(namedWorkers.values()).sort((a, b) => b.workerDays - a.workerDays),
  };
}
