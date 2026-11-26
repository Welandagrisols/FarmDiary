import type { SaleRecord } from "@/lib/sales-storage";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(value: number): string {
  const amount = Number(value);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return `KES ${safeAmount.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function readableDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString("en-KE");
}

export function buildSaleReceiptHtml(sale: SaleRecord, farmName: string): string {
  const subtotal = Number(sale.quantity_kg) * Number(sale.unit_price_kes);
  const paymentMethod = sale.payment_method === "mpesa"
    ? "M-Pesa / Till"
    : sale.payment_method === "bank"
      ? "Bank"
      : "Cash";
  const statusLine = sale.status === "void_requested"
    ? "Original POS receipt · void requested"
    : "Payment confirmed at POS";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      @page { margin: 4mm; }
      * { box-sizing: border-box; }
      body { width: 100%; margin: 0; padding: 0; color: #17221b; font: 12px Arial, sans-serif; }
      main { width: 100%; max-width: 72mm; margin: 0 auto; }
      h1 { margin: 0 0 3px; text-align: center; font-size: 19px; }
      .farm { margin: 0 0 10px; text-align: center; font-size: 13px; font-weight: 700; overflow-wrap: anywhere; }
      .center { text-align: center; }
      .muted { color: #4b5d50; font-size: 10px; }
      .status { margin: 9px 0; padding: 6px; border: 1px solid #314f38; text-align: center; font-weight: 700; }
      .rule { margin: 8px 0; border: 0; border-top: 1px dashed #738277; }
      .row { display: flex; justify-content: space-between; gap: 8px; padding: 3px 0; }
      .row span:first-child { min-width: 0; }
      .row span:last-child { text-align: right; overflow-wrap: anywhere; }
      .total { margin-top: 4px; padding-top: 7px; border-top: 1px solid #17221b; font-size: 15px; font-weight: 700; }
      .value { margin: 3px 0; overflow-wrap: anywhere; }
      footer { margin-top: 12px; text-align: center; font-size: 10px; line-height: 1.5; }
    </style>
  </head>
  <body>
    <main>
      <h1>SALE RECEIPT</h1>
      <p class="farm">${escapeHtml(farmName || "Farm Diary")}</p>
      <p class="center muted">Receipt ${escapeHtml(sale.receipt_number)}</p>
      <p class="center muted">${escapeHtml(readableDate(sale.created_at))}</p>
      <div class="status">${escapeHtml(statusLine)}</div>
      <hr class="rule">
      <p class="value"><strong>Buyer:</strong> ${escapeHtml(sale.buyer_name)}</p>
      <p class="value"><strong>Produce:</strong> ${escapeHtml(sale.product_name)}</p>
      <p class="value"><strong>Seller:</strong> ${escapeHtml(sale.seller_email || "Farm staff")}</p>
      <hr class="rule">
      <div class="row"><span>Quantity</span><span>${escapeHtml(sale.quantity_kg)} kg</span></div>
      <div class="row"><span>Price per kg</span><span>${escapeHtml(money(sale.unit_price_kes))}</span></div>
      <div class="row"><span>Subtotal</span><span>${escapeHtml(money(subtotal))}</span></div>
      ${Number(sale.discount_kes) > 0 ? `<div class="row"><span>Discount</span><span>−${escapeHtml(money(sale.discount_kes))}</span></div>` : ""}
      <div class="row total"><span>Total paid</span><span>${escapeHtml(money(sale.total_kes))}</span></div>
      <hr class="rule">
      <p class="value"><strong>Payment:</strong> ${escapeHtml(paymentMethod)}</p>
      ${sale.payment_reference ? `<p class="value"><strong>Payment reference:</strong> ${escapeHtml(sale.payment_reference)}</p>` : ""}
      <footer>
        <div>Keep this receipt for your records.</div>
        <div>Reprint reference: ${escapeHtml(sale.receipt_number)}</div>
      </footer>
    </main>
  </body>
</html>`;
}
