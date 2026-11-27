import type { FarmRole } from "./sales-storage";

export type CheckedSaleStatus = "recorded" | "discount_pending";

export function getSalesCapabilities(role: FarmRole) {
  const canApproveDiscounts = ["admin", "owner", "manager"].includes(role);
  const canConfirmSales = canApproveDiscounts || role === "cashier";

  return {
    canConfirmSales,
    canApproveDiscounts,
    canApproveVoids: role === "admin" || role === "owner",
    canViewSalesManagement: canConfirmSales || role === "storekeeper",
    canViewStock: ["admin", "owner", "manager", "storekeeper"].includes(role),
  };
}

export function statusAfterCashierCheck(sale: {
  discount_kes: number;
  discount_approved_at?: string | null;
}): CheckedSaleStatus {
  return sale.discount_kes <= 0 || Boolean(sale.discount_approved_at)
    ? "recorded"
    : "discount_pending";
}
