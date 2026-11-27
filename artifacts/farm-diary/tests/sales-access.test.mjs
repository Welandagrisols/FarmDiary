import assert from "node:assert/strict";
import test from "node:test";
import { getSalesCapabilities, statusAfterCashierCheck } from "../lib/sales-access.ts";

test("cashiers can confirm and view sales without getting manager controls", () => {
  assert.deepEqual(getSalesCapabilities("cashier"), {
    canConfirmSales: true,
    canApproveDiscounts: false,
    canApproveVoids: false,
    canViewSalesManagement: true,
    canViewStock: false,
  });
});

test("sellers can record sales but cannot confirm another sale", () => {
  const capabilities = getSalesCapabilities("seller");
  assert.equal(capabilities.canConfirmSales, false);
  assert.equal(capabilities.canApproveDiscounts, false);
  assert.equal(capabilities.canViewSalesManagement, false);
});

test("manager and owner sale permissions remain limited to their existing controls", () => {
  for (const role of ["owner", "manager", "admin"]) {
    const capabilities = getSalesCapabilities(role);
    assert.equal(capabilities.canConfirmSales, true);
    assert.equal(capabilities.canApproveDiscounts, true);
  }
  assert.equal(getSalesCapabilities("manager").canApproveVoids, false);
  assert.equal(getSalesCapabilities("owner").canApproveVoids, true);
});

test("cashier confirmation does not complete a sale with an unapproved discount", () => {
  assert.equal(statusAfterCashierCheck({ discount_kes: 0 }), "recorded");
  assert.equal(statusAfterCashierCheck({ discount_kes: 100 }), "discount_pending");
  assert.equal(statusAfterCashierCheck({ discount_kes: 100, discount_approved_at: "2026-11-28T00:00:00Z" }), "recorded");
});
