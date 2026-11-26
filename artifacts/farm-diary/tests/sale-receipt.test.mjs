import assert from "node:assert/strict";
import test from "node:test";
import { buildSaleReceiptHtml } from "../lib/sale-receipt.ts";

const sale = {
  id: "sale-123",
  receipt_number: "FD-ABC-1234",
  farm_id: "farm-1",
  season_id: "season-1",
  block_id: null,
  seller_id: "user-1",
  seller_email: "seller@example.test",
  product_name: "Tomato",
  buyer_name: "Market buyer",
  quantity_kg: 12.5,
  unit_price_kes: 80,
  discount_kes: 100,
  total_kes: 900,
  payment_method: "mpesa",
  payment_reference: "ABC123",
  status: "recorded",
  check_note: null,
  checked_by: "manager-1",
  checked_by_email: "manager@example.test",
  checked_at: "2026-11-25T09:00:00.000Z",
  discount_approved_by: null,
  discount_approved_by_email: null,
  discount_approved_at: null,
  discount_approval_reason: null,
  void_requested_by_email: null,
  void_request_reason: null,
  voided_by_email: null,
  void_reason: null,
  created_at: "2026-11-25T08:00:00.000Z",
};

test("sale receipt includes the complete sale and POS payment details", () => {
  const html = buildSaleReceiptHtml(sale, "Kijiji Farm");
  for (const value of [
    "Kijiji Farm",
    "FD-ABC-1234",
    "Market buyer",
    "Tomato",
    "seller@example.test",
    "12.5 kg",
    "KES 1,000.00",
    "KES 100.00",
    "KES 900.00",
    "M-Pesa / Till",
    "ABC123",
    "Payment confirmed at POS",
  ]) {
    assert.ok(html.includes(value), `receipt should include ${value}`);
  }
});

test("sale receipt escapes buyer and farm text rather than treating it as markup", () => {
  const html = buildSaleReceiptHtml(
    { ...sale, buyer_name: "<script>alert('x')</script> & Market" },
    "Farm <One>",
  );
  assert.ok(html.includes("Farm &lt;One&gt;"));
  assert.ok(html.includes("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt; &amp; Market"));
  assert.ok(!html.includes("<script>alert"));
});
