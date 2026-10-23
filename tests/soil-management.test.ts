import assert from "node:assert/strict";
import test from "node:test";
import {
  compareSoilResult,
  makeManualSoilResult,
  normalizeSoilDate,
  type SoilResult,
  type SoilTestRecord,
} from "../lib/soil";

function makeResult(value: number, unit = "%"): SoilResult {
  return {
    key: "organic_carbon",
    label: "Organic carbon",
    reported_label: "Organic carbon",
    value,
    text: null,
    unit,
    method: "Walkley-Black",
    rating: null,
    rating_text: null,
    confidence: "high",
    flags: [],
  };
}

function makeTest(input: Partial<SoilTestRecord> & Pick<SoilTestRecord, "id" | "farm_id" | "plot_id" | "sample_date" | "results">): SoilTestRecord {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    ...input,
    sample_label: input.sample_label ?? null,
    received_date: input.received_date ?? null,
    report_date: input.report_date ?? null,
    lab_name: input.lab_name ?? null,
    lab_reference: input.lab_reference ?? null,
    location_on_report: input.location_on_report ?? null,
    intended_crops: input.intended_crops ?? [],
    sample_depth: input.sample_depth ?? null,
    sampling_method: input.sampling_method ?? "unknown",
    recommendations: input.recommendations ?? null,
    recommendation_items: input.recommendation_items ?? [],
    report_files: input.report_files ?? [],
    source: input.source ?? "manual",
    status: input.status ?? "manual",
    extraction_notes: input.extraction_notes ?? null,
    created_by: input.created_by ?? null,
    confirmed_by: input.confirmed_by ?? null,
    confirmed_at: input.confirmed_at ?? null,
    created_at: input.created_at ?? now,
    updated_at: input.updated_at ?? now,
  };
}

test("manual measurements preserve numeric and text values without unit conversion", () => {
  const numeric = makeManualSoilResult({
    label: "Organic carbon",
    value: "1.8",
    unit: "g/kg",
  });
  assert.equal(numeric.key, "organic_carbon");
  assert.equal(numeric.value, 1.8);
  assert.equal(numeric.text, null);
  assert.equal(numeric.unit, "g/kg");

  const textValue = makeManualSoilResult({
    label: "Available phosphorus",
    value: "<0.5",
    unit: "mg/kg",
  });
  assert.equal(textValue.value, null);
  assert.equal(textValue.text, "<0.5");
  assert.equal(textValue.unit, "mg/kg");
});

test("soil sample dates reject impossible and future dates", () => {
  assert.equal(normalizeSoilDate("2024-02-29"), "2024-02-29");
  assert.equal(normalizeSoilDate("2025-02-29"), null);
  assert.equal(normalizeSoilDate("2040-01-01"), null);
  assert.equal(normalizeSoilDate("04/03/2025"), null);
});

test("soil trends compare only earlier readings for the same farm, plot, analyte, method and unit", () => {
  const earlier = makeTest({
    id: "earlier",
    farm_id: "farm-a",
    plot_id: "plot-a",
    sample_date: "2025-01-10",
    results: [makeResult(1.2)],
  });
  const otherFarm = makeTest({
    id: "other-farm",
    farm_id: "farm-b",
    plot_id: "plot-a",
    sample_date: "2025-01-01",
    results: [makeResult(9.5)],
  });
  const current = makeTest({
    id: "current",
    farm_id: "farm-a",
    plot_id: "plot-a",
    sample_date: "2026-01-10",
    results: [makeResult(1.8)],
  });

  const comparison = compareSoilResult([otherFarm, earlier], current, current.results[0]);
  assert.equal(comparison.previousTest?.id, "earlier");
  assert.equal(comparison.change, 0.6);
  assert.equal(comparison.unitDiffers, false);
});

test("soil trends do not subtract values with different units", () => {
  const earlier = makeTest({
    id: "earlier",
    farm_id: "farm-a",
    plot_id: null,
    sample_date: "2025-01-10",
    results: [makeResult(1.2, "g/kg")],
  });
  const current = makeTest({
    id: "current",
    farm_id: "farm-a",
    plot_id: null,
    sample_date: "2026-01-10",
    results: [makeResult(1.8, "%")],
  });

  const comparison = compareSoilResult([earlier], current, current.results[0]);
  assert.equal(comparison.change, null);
  assert.equal(comparison.unitDiffers, true);
});
