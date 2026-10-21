import assert from "node:assert/strict";
import test from "node:test";
import { recordsForFarm } from "../lib/farm-scope";
import { applyPendingMutations } from "../lib/offline-mutations";

test("farm records remain isolated when switching the active farm", () => {
  const costs = [
    { id: "a-cost", farm_id: "farm-a", amount_kes: 100 },
    { id: "b-cost", farm_id: "farm-b", amount_kes: 200 },
  ];

  assert.deepEqual(recordsForFarm(costs, "farm-a"), [costs[0]]);
  assert.deepEqual(recordsForFarm(costs, "farm-b"), [costs[1]]);
  assert.deepEqual(recordsForFarm(costs, null), []);
});

test("farm scoping excludes records without a matching farm id", () => {
  const records = [
    { id: "valid", farm_id: "farm-a" },
    { id: "unassigned", farm_id: null },
    { id: "missing" },
  ];

  assert.deepEqual(recordsForFarm(records, "farm-a"), [records[0]]);
  assert.deepEqual(recordsForFarm(records, "farm-b"), []);
});

test("pending changes from one farm do not appear after switching to another", () => {
  const farmARecords = [
    { id: "a-cost", farm_id: "farm-a", amount_kes: 100 },
  ];
  const farmBRecords = [
    { id: "b-cost", farm_id: "farm-b", amount_kes: 200 },
  ];
  const queue = [
    { table: "costs", operation: "insert" as const, data: { id: "offline-a", farm_id: "farm-a", amount_kes: 25 } },
    { table: "costs", operation: "update" as const, data: { id: "a-cost", amount_kes: 125 } },
  ];
  const farmAWithPending = applyPendingMutations(
    farmARecords,
    queue,
    "costs",
    { field: "farm_id", id: "farm-a" },
  );
  const farmBWithPending = applyPendingMutations(
    farmBRecords,
    queue,
    "costs",
    { field: "farm_id", id: "farm-b" },
  );

  assert.deepEqual(recordsForFarm(farmAWithPending, "farm-a").map((record) => record.amount_kes), [125, 25]);
  assert.deepEqual(recordsForFarm(farmBWithPending, "farm-b"), farmBRecords);
});
