import assert from "node:assert/strict";
import test from "node:test";
import {
  distinctTemplateIds,
  groupRecordsByTemplate,
  isMixedSeason,
  unionByKey,
} from "../lib/block-crops.ts";
import {
  targetProgress,
  targetFieldsForSave,
  validateTargets,
} from "../lib/block-targets.ts";
import {
  gradeTotals,
  validateGradeSplit,
  formatGradeSplit,
} from "../lib/harvest-grading.ts";
import {
  composeNotes,
  irrigationLine,
  irrigationSummary,
  parseIrrigation,
  validateIrrigation,
} from "../lib/irrigation.ts";
import { buildSoilGuard, applySoilGuardToRows, soilNoticesForProducts } from "../lib/soil-guard.ts";
import {
  commitmentProgress,
  sameProduct,
  validateCommitment,
} from "../lib/buyer-commitments.ts";

test("per-block crop assignment preserves defaults and groups mixed crops", () => {
  const blocks = [
    { id: "a" },
    { id: "b", template_id: "tomato-template" },
    { id: "c", template_id: "potato-template-stephen-shangi" },
  ];
  assert.deepEqual(distinctTemplateIds("potato-template-stephen-shangi", blocks), [
    "potato-template-stephen-shangi",
    "tomato-template",
  ]);
  assert.equal(isMixedSeason("potato-template-stephen-shangi", blocks), true);
  assert.deepEqual(
    [...groupRecordsByTemplate(
      [{ section_id: "a", kg: 10 }, { section_id: "b", kg: 5 }, { section_id: "unknown", kg: 3 }],
      "potato-template-stephen-shangi",
      blocks,
    )].map(([crop, records]) => [crop, records.reduce((sum, record) => sum + record.kg, 0)]),
    [["potato-template-stephen-shangi", 13], ["tomato-template", 5]],
  );
  assert.deepEqual(unionByKey([[{ key: "kg" }, { key: "bag" }], [{ key: "kg" }, { key: "crate" }]]).map((unit) => unit.key), [
    "kg", "bag", "crate",
  ]);
});

test("block targets validate and report actual progress without hiding missing weights", () => {
  assert.deepEqual(targetFieldsForSave("1200", "45.5"), {
    target_yield_kg: 1200,
    expected_price_kes_per_kg: 45.5,
  });
  assert.match(validateTargets("not a number", ""), /target yield/i);
  const progress = targetProgress(
    { target_yield_kg: 100, expected_price_kes_per_kg: 50 },
    [{ total_kg: 35 }, { bags: 2, total_kg: 0 }],
    1200,
  );
  assert.equal(progress.actualKg, 35);
  assert.equal(progress.pct, 35);
  assert.equal(progress.expectedRevenueKes, 5000);
  assert.equal(progress.weightsMissing, true);
});

test("harvest grade totals and split validation stay within recorded kg", () => {
  assert.equal(validateGradeSplit({ a: 20, b: 15, reject: 5 }, 40), null);
  assert.match(validateGradeSplit({ a: 25, b: 15, reject: 2 }, 40), /more than the 40 kg/i);
  const totals = gradeTotals([
    { grade_a_kg: 20, grade_b_kg: 15, reject_kg: 5 },
    { grade_a_kg: 0, grade_b_kg: 0, reject_kg: 0 },
  ]);
  assert.deepEqual([totals.a, totals.b, totals.reject, totals.graded, totals.records], [20, 15, 5, 40, 1]);
  assert.equal(formatGradeSplit({ grade_a_kg: 20, grade_b_kg: 15, reject_kg: 5 }), "A 20 kg · B 15 kg · Reject 5 kg");
});

test("irrigation details round-trip in notes and summarize logs", () => {
  const detail = {
    method: "Drip",
    durationMinutes: "45",
    waterSource: "Borehole",
    ecText: "1.8",
    leachingFlush: true,
  };
  assert.equal(validateIrrigation(detail), null);
  const line = irrigationLine(detail);
  const notes = composeNotes(line, "Fertilizer fertigated");
  assert.deepEqual(parseIrrigation(notes), {
    method: "Drip",
    durationMinutes: 45,
    waterSource: "Borehole",
    ec: 1.8,
    leachingFlush: true,
  });
  const summary = irrigationSummary([
    { activity_category: "irrigation", actual_date: "2026-11-23", notes },
    { activity_name: "Watering", actual_date: "2026-11-24", notes: "No details" },
  ]);
  assert.deepEqual(
    [summary.waterings, summary.withDetails, summary.totalMinutes, summary.leachingFlushes, summary.lastEc],
    [2, 1, 45, 1, 1.8],
  );
});

test("soil warnings use the newest reviewed test and flag unsuitable inputs", () => {
  const guard = buildSoilGuard([
    {
      plot_id: "north",
      status: "confirmed",
      sample_date: "2026-11-20",
      report_date: null,
      created_at: "2026-11-20",
      results: [
        { key: "ph_water", value: 7.6, rating: "high", rating_text: "Alkaline" },
        { key: "phosphorus", value: 60, rating: "high", rating_text: "High" },
      ],
    },
    {
      plot_id: "north",
      status: "parsed",
      sample_date: "2026-11-25",
      report_date: null,
      created_at: "2026-11-25",
      results: [{ key: "ph_water", value: 5.5, rating: "low", rating_text: "Acidic" }],
    },
  ], { north: "North block" });
  assert.equal(guard.testedPlots, 1);
  assert.deepEqual(guard.plots.alkaline, ["North block"]);
  const rows = applySoilGuardToRows([
    { subcategory: "Lime Application", enabled: true },
    { subcategory: "DAP", enabled: true },
  ], guard);
  assert.equal(rows[0].enabled, false);
  assert.match(rows[1].warning, /phosphorus high/i);
  assert.equal(soilNoticesForProducts(guard, ["DAP"]).length, 1);
});

test("buyer commitments match plural crop names and count only recorded sales", () => {
  assert.equal(sameProduct("Tomatoes", "Tomato"), true);
  const commitment = {
    id: "c1",
    farm_id: "f1",
    season_id: null,
    buyer_name: "Kijiji Market",
    product_name: "Tomato",
    weekly_kg: 100,
    agreed_price_kes: 50,
    start_date: null,
    end_date: null,
    notes: null,
    created_at: "2026-11-20",
  };
  const sales = [
    { buyer_name: "Kijiji Market", product_name: "Tomatoes", quantity_kg: 60, status: "recorded", created_at: "2026-11-24" },
    { buyer_name: "Kijiji Market", product_name: "Tomato", quantity_kg: 30, status: "pending_check", created_at: "2026-11-24" },
    { buyer_name: "Kijiji Market", product_name: "Tomato", quantity_kg: 5, status: "discount_pending", created_at: "2026-11-24" },
    { buyer_name: "Kijiji Market", product_name: "Tomato", quantity_kg: 2, status: "void_requested", created_at: "2026-11-24" },
    { buyer_name: "Kijiji Market", product_name: "Tomato", quantity_kg: 50, status: "voided", created_at: "2026-11-24" },
    { buyer_name: "Other buyer", product_name: "Tomato", quantity_kg: 20, status: "recorded", created_at: "2026-11-24" },
    { buyer_name: "Kijiji Market", product_name: "Tomato", quantity_kg: 25, status: "recorded", created_at: "2026-11-18" },
    { buyer_name: "Kijiji Market", product_name: "Tomato", quantity_kg: 10, status: "pending_check", created_at: "2026-11-18" },
  ];
  const progress = commitmentProgress(commitment, sales, "2026-11-25");
  assert.deepEqual(
    [
      progress.expectedKg,
      progress.soldKg,
      progress.bookedKg,
      progress.remainingKg,
      progress.pct,
      progress.lastWeekSoldKg,
      progress.lastWeekBookedKg,
      progress.status,
    ],
    [100, 62, 35, 3, 97, 25, 10, "open"],
  );
  const fullyBooked = commitmentProgress(
    commitment,
    [
      { buyer_name: "Kijiji Market", product_name: "Tomato", quantity_kg: 60, status: "recorded", created_at: "2026-11-24" },
      { buyer_name: "Kijiji Market", product_name: "Tomato", quantity_kg: 40, status: "pending_check", created_at: "2026-11-24" },
    ],
    "2026-11-25",
  );
  assert.equal(fullyBooked.status, "booked");
  assert.equal(fullyBooked.remainingKg, 0);
  assert.equal(validateCommitment({
    buyer_name: "Kijiji Market",
    product_name: "Tomato",
    weekly_kg: "100",
    agreed_price_kes: "50",
    start_date: "",
    end_date: "",
  }), null);
});

test("buyer commitment progress moves a sale from booked to sold after approval", () => {
  const commitment = {
    id: "c2",
    farm_id: "f1",
    season_id: null,
    buyer_name: "Kijiji Market",
    product_name: "Tomato",
    weekly_kg: 100,
    agreed_price_kes: null,
    start_date: null,
    end_date: null,
    notes: null,
    created_at: "2026-11-20",
  };
  const sale = {
    buyer_name: "Kijiji Market",
    product_name: "Tomatoes",
    quantity_kg: 40,
    status: "pending_check",
    created_at: "2026-11-24",
  };

  const booked = commitmentProgress(commitment, [sale], "2026-11-25");
  assert.equal(booked.bookedKg, 40);
  assert.equal(booked.soldKg, 0);

  const approved = commitmentProgress(commitment, [{ ...sale, status: "recorded" }], "2026-11-25");
  assert.equal(approved.bookedKg, 0);
  assert.equal(approved.soldKg, 40);

  const voided = commitmentProgress(commitment, [{ ...sale, status: "voided" }], "2026-11-25");
  assert.equal(voided.bookedKg, 0);
  assert.equal(voided.soldKg, 0);
});
