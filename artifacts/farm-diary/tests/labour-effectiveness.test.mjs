import assert from "node:assert/strict";
import test from "node:test";
import { summarizeLabourEffectiveness } from "../lib/labour-effectiveness.ts";

test("summarizes named worker days without assigning shared output to individuals", () => {
  const result = summarizeLabourEffectiveness([{
    activity_name: "Weeding",
    activity_category: "weeding",
    num_workers: 3,
    days_worked: 2,
    labor_cost_kes: 900,
    work_quantity: 6,
    work_unit: "acres",
    worker_assignments: [
      { worker_id: "a", worker_name: "Amina", days_worked: 2 },
      { worker_id: "b", worker_name: "Kibet", days_worked: 1.5 },
    ],
  }]);

  assert.equal(result.workerDays, 6);
  assert.deepEqual(result.namedWorkers, [
    { name: "Amina", workerDays: 2, records: 1 },
    { name: "Kibet", workerDays: 1.5, records: 1 },
  ]);
  assert.equal(result.groups[0].quantityPerWorkerDay, 1);
});

test("uses existing comma-separated crew names for older activity records", () => {
  const result = summarizeLabourEffectiveness([{
    activity_name: "Harvest",
    num_workers: 3,
    days_worked: 1,
    labor_cost_kes: 0,
    worker_names: "Amina, Kibet, Amina",
  }]);

  assert.deepEqual(result.namedWorkers, [
    { name: "Amina", workerDays: 1, records: 1 },
    { name: "Kibet", workerDays: 1, records: 1 },
  ]);
});
