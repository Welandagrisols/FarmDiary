import test from "node:test";
import assert from "node:assert/strict";
import {
  assertCanManageLabourCosts,
  canManageLabourCosts,
  hasLabourCostAmount,
  hasLabourCostFields,
  isLabourCostCategory,
} from "../lib/labour-access.ts";

test("only farm managers can manage labour costs", () => {
  for (const role of ["admin", "owner", "manager"]) {
    assert.equal(canManageLabourCosts(role), true);
    assert.doesNotThrow(() => assertCanManageLabourCosts(role));
  }

  for (const role of ["seller", "storekeeper", "none", null, undefined]) {
    assert.equal(canManageLabourCosts(role), false);
    assert.throws(() => assertCanManageLabourCosts(role), /Only a farm manager/);
  }
});

test("labour category and pay details are identified for every write path", () => {
  assert.equal(isLabourCostCategory(" Labor "), true);
  assert.equal(isLabourCostCategory("LABOUR"), true);
  assert.equal(isLabourCostCategory("Inputs"), false);
  assert.equal(hasLabourCostFields({ cost_category: "Transport" }), false);
  assert.equal(hasLabourCostFields({ cost_category: "Transport", rate_per_worker_per_day: 0 }), true);
  assert.equal(hasLabourCostFields({ num_workers: 3, days_worked: 2 }), true);
});

test("zero labour amount is permitted while any non-zero amount is protected", () => {
  assert.equal(hasLabourCostAmount(0), false);
  assert.equal(hasLabourCostAmount("0"), false);
  assert.equal(hasLabourCostAmount(125), true);
  assert.equal(hasLabourCostAmount(-1), true);
});
