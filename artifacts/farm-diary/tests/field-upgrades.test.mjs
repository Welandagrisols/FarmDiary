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
  activeCommitmentsMatchingSale,
  ambiguousCommitmentSales,
  commitmentProgress,
  commitmentSuggestionForSale,
  sameBuyer,
  sameProduct,
  suggestedPriceInputValue,
  validateCommitment,
  weeklyBuyerDeliveryShareText,
  weeklyBuyerDeliverySummary,
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
  assert.equal(sameBuyer(" Kijiji-Market! ", "kijiji market"), true);
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
    { id: "s1", buyer_name: " kijiji-market ", product_name: "Tomatoes", quantity_kg: 60, status: "recorded", created_at: "2026-11-24" },
    { id: "s2", buyer_name: "Kijiji Market", product_name: "Tomato", quantity_kg: 30, status: "pending_check", created_at: "2026-11-24" },
    { id: "s3", buyer_name: "Kijiji Market", product_name: "Tomato", quantity_kg: 5, status: "discount_pending", created_at: "2026-11-24" },
    { id: "s4", buyer_name: "Kijiji Market", product_name: "Tomato", quantity_kg: 2, status: "void_requested", created_at: "2026-11-24" },
    { id: "s5", buyer_name: "Kijiji Market", product_name: "Tomato", quantity_kg: 50, status: "voided", created_at: "2026-11-24" },
    { id: "s6", buyer_name: "Other buyer", product_name: "Tomato", quantity_kg: 20, status: "recorded", created_at: "2026-11-24" },
    { id: "s7", buyer_name: "Kijiji Market", product_name: "Tomato", quantity_kg: 25, status: "recorded", created_at: "2026-11-18" },
    { id: "s8", buyer_name: "Kijiji Market", product_name: "Tomato", quantity_kg: 10, status: "pending_check", created_at: "2026-11-18" },
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
  assert.deepEqual(
    progress.currentWeekSales.map((match) => [match.sale.id, match.bucket]),
    [["s1", "sold"], ["s2", "booked"], ["s3", "booked"], ["s4", "sold"]],
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

test("commitment sales share date, block-crop, and status rules with the totals", () => {
  const commitment = {
    id: "tomato-commitment",
    farm_id: "f1",
    season_id: null,
    buyer_name: "Kijiji Market",
    product_name: "Tomatoes",
    weekly_kg: 100,
    agreed_price_kes: null,
    start_date: null,
    end_date: null,
    notes: null,
    created_at: "2026-11-20",
  };
  const sales = [
    {
      id: "block-crop-approved",
      buyer_name: " kijiji-market ",
      product_name: "Mixed Produce",
      block_id: "north",
      quantity_kg: 12,
      status: "recorded",
      created_at: "2026-11-24",
    },
    {
      id: "pending",
      buyer_name: "KIJIJI MARKET",
      product_name: "Tomato",
      quantity_kg: 8,
      status: "pending_check",
      created_at: "2026-11-24",
    },
    {
      id: "voided",
      buyer_name: "Kijiji Market",
      product_name: "Tomato",
      quantity_kg: 40,
      status: "voided",
      created_at: "2026-11-24",
    },
    {
      id: "week-end",
      buyer_name: "Kijiji Market",
      product_name: "Tomato",
      quantity_kg: 3,
      status: "recorded",
      created_at: "2026-11-29",
    },
    {
      id: "next-week",
      buyer_name: "Kijiji Market",
      product_name: "Tomato",
      quantity_kg: 25,
      status: "recorded",
      created_at: "2026-11-30",
    },
  ];
  const cropOfBlock = (blockId) => blockId === "north" ? "Tomato" : null;
  const progress = commitmentProgress(commitment, sales, "2026-11-25", cropOfBlock);

  assert.equal(progress.soldKg, 15);
  assert.equal(progress.bookedKg, 8);
  assert.deepEqual(
    progress.currentWeekSales.map((match) => [match.sale.id, match.date, match.bucket]),
    [
      ["block-crop-approved", "2026-11-24", "sold"],
      ["pending", "2026-11-24", "booked"],
      ["week-end", "2026-11-29", "sold"],
    ],
  );
  assert.equal(progress.currentWeekSales[0].matchedViaBlockCrop, "Tomato");
  assert.equal(progress.currentWeekSales[1].matchedViaBlockCrop, null);
});

test("overlapping commitments flag each shared current-week sale", () => {
  const commitment = (id, buyer, product) => ({
    id,
    farm_id: "f1",
    season_id: null,
    buyer_name: buyer,
    product_name: product,
    weekly_kg: 100,
    agreed_price_kes: null,
    start_date: null,
    end_date: null,
    notes: null,
    created_at: "2026-11-20",
  });
  const first = commitment("c1", "Kijiji Market", "Tomato");
  const second = commitment("c2", "Kijiji-Market", "Tomatoes");
  const unrelated = commitment("c3", "Other buyer", "Tomato");
  const sharedSale = {
    id: "sale-shared",
    buyer_name: "KIJIJI MARKET",
    product_name: "Tomatoes",
    quantity_kg: 22,
    status: "recorded",
    created_at: "2026-11-24",
  };
  const anotherSale = {
    id: "sale-pending",
    buyer_name: "kijiji market",
    product_name: "Tomato",
    quantity_kg: 10,
    status: "pending_check",
    created_at: "2026-11-25",
  };
  const ambiguous = ambiguousCommitmentSales(
    [first, second, unrelated],
    [sharedSale, anotherSale],
    "2026-11-25",
  );

  assert.deepEqual(ambiguous.get(sharedSale)?.map((item) => item.id), ["c1", "c2"]);
  assert.deepEqual(ambiguous.get(anotherSale)?.map((item) => item.id), ["c1", "c2"]);
  assert.equal(ambiguous.has({ ...sharedSale }), false);
});

test("sale suggestions require one active commitment for the selected season and crop", () => {
  const commitment = (id, updates = {}) => ({
    id,
    farm_id: "f1",
    season_id: "s1",
    buyer_name: "Kijiji Market",
    product_name: "Tomato",
    weekly_kg: 100,
    agreed_price_kes: 48,
    start_date: "2026-11-23",
    end_date: "2026-11-29",
    notes: null,
    created_at: "2026-11-20",
    ...updates,
  });
  const saleIdentity = {
    buyer_name: " kijiji-market ",
    product_name: "Produce",
    block_id: "north",
  };
  const cropOfBlock = (blockId) => blockId === "north" ? "Tomatoes" : null;
  const active = commitment("active");
  const commitments = [
    active,
    commitment("wrong-season", { season_id: "s2" }),
    commitment("starts-later", { start_date: "2026-11-26" }),
    commitment("already-ended", { end_date: "2026-11-24" }),
  ];
  const sales = [{
    id: "booked",
    buyer_name: "Kijiji Market",
    product_name: "Tomato",
    quantity_kg: 30,
    status: "pending_check",
    created_at: "2026-11-24",
  }];

  assert.deepEqual(
    activeCommitmentsMatchingSale(commitments, saleIdentity, "2026-11-25", "s1", cropOfBlock).map((item) => item.id),
    ["active"],
  );
  const suggestion = commitmentSuggestionForSale(
    commitments,
    sales,
    saleIdentity,
    "2026-11-25",
    "s1",
    cropOfBlock,
  );
  assert.equal(suggestion.kind, "single");
  assert.equal(suggestion.progress?.bookedKg, 30);
  assert.equal(suggestion.progress?.remainingKg, 70);
  assert.equal(suggestion.matches[0].agreed_price_kes, 48);

  const noPriceSuggestion = commitmentSuggestionForSale(
    [commitment("no-price", { agreed_price_kes: null })],
    sales,
    saleIdentity,
    "2026-11-25",
    "s1",
    cropOfBlock,
  );
  assert.equal(noPriceSuggestion.kind, "single");
  assert.equal(noPriceSuggestion.matches[0].agreed_price_kes, null);

  const ambiguous = commitmentSuggestionForSale(
    [active, commitment("second-active", { season_id: null })],
    sales,
    saleIdentity,
    "2026-11-25",
    "s1",
    cropOfBlock,
  );
  assert.equal(ambiguous.kind, "ambiguous");
  assert.equal(ambiguous.progress, null);

  const missing = commitmentSuggestionForSale(
    [],
    sales,
    saleIdentity,
    "2026-11-25",
    "s1",
    cropOfBlock,
  );
  assert.equal(missing.kind, "none");
  assert.equal(missing.progress, null);
});

test("commitment price is only applied to an empty price field", () => {
  assert.equal(suggestedPriceInputValue("", 48), "48");
  assert.equal(suggestedPriceInputValue("51.5", 48), null);
  assert.equal(suggestedPriceInputValue("", null), null);
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
  assert.equal(booked.currentWeekSales[0].bucket, "booked");
  assert.equal(booked.remainingKg, 60);

  const approved = commitmentProgress(commitment, [{ ...sale, status: "recorded" }], "2026-11-25");
  assert.equal(approved.bookedKg, 0);
  assert.equal(approved.soldKg, 40);
  assert.equal(approved.currentWeekSales[0].bucket, "sold");
  assert.equal(approved.remainingKg, 60);

  const voided = commitmentProgress(commitment, [{ ...sale, status: "voided" }], "2026-11-25");
  assert.equal(voided.bookedKg, 0);
  assert.equal(voided.soldKg, 0);
});

test("weekly buyer summaries keep season and date-window rules and count shared sales once", () => {
  const commitment = (id, updates = {}) => ({
    id,
    farm_id: "f1",
    season_id: "s1",
    buyer_name: "Kijiji Market",
    product_name: "Tomato",
    weekly_kg: 100,
    agreed_price_kes: null,
    start_date: null,
    end_date: null,
    notes: null,
    created_at: "2026-11-20",
    ...updates,
  });
  const commitments = [
    commitment("current-season", { start_date: "2026-11-24", end_date: "2026-11-28" }),
    commitment("all-seasons", { season_id: null }),
    commitment("future-this-week", { start_date: "2026-11-27", weekly_kg: 500 }),
    commitment("ended-this-week", { end_date: "2026-11-24", weekly_kg: 600 }),
    commitment("other-season", { season_id: "s2", weekly_kg: 700 }),
  ];
  const sales = [
    {
      id: "shared-sold",
      buyer_name: "Kijiji Market",
      product_name: "Tomatoes",
      quantity_kg: 25,
      status: "recorded",
      created_at: "2026-11-25",
    },
    {
      id: "shared-booked",
      buyer_name: "Kijiji Market",
      product_name: "Tomato",
      quantity_kg: 15,
      status: "pending_check",
      created_at: "2026-11-29",
    },
    {
      id: "outside-week",
      buyer_name: "Kijiji Market",
      product_name: "Tomato",
      quantity_kg: 80,
      status: "recorded",
      created_at: "2026-11-30",
    },
  ];
  const before = JSON.stringify({ commitments, sales });
  const summary = weeklyBuyerDeliverySummary(commitments, sales, "2026-11-25", "s1");

  assert.deepEqual(summary.rows.map(({ commitment: item }) => item.id), ["current-season", "all-seasons"]);
  assert.deepEqual(
    [summary.weekStart, summary.weekEnd, summary.expectedKg, summary.soldKg, summary.bookedKg, summary.remainingKg],
    ["2026-11-23", "2026-11-29", 200, 25, 15, 160],
  );
  assert.equal(summary.ambiguousSalesCount, 2);
  assert.deepEqual(
    summary.rows.map(({ progress }) => [progress.soldKg, progress.bookedKg, progress.remainingKg]),
    [[25, 15, 60], [25, 15, 60]],
  );

  const sharedText = weeklyBuyerDeliveryShareText(summary, {
    farmName: "Green Valley",
    seasonName: "Short rains",
  });
  assert.match(sharedText, /Green Valley · Weekly buyer delivery summary/);
  assert.match(sharedText, /Season: Short rains/);
  assert.match(sharedText, /Expected: 200 kg/);
  assert.match(sharedText, /Sold: 25 kg/);
  assert.match(sharedText, /Booked: 15 kg/);
  assert.match(sharedText, /Remaining: 160 kg/);
  assert.match(sharedText, /counted once in farm totals/);
  assert.equal(JSON.stringify({ commitments, sales }), before);
});
