import assert from "node:assert/strict";
import test from "node:test";
import {
  legacyCacheToFarmData,
  mergeLegacyFarmData,
} from "../lib/legacy-migration-data.ts";

test("recovers a farm, its crop seasons, and records from the old offline cache", () => {
  const result = legacyCacheToFarmData({
    allFarms: [
      { id: "farm-a", user_id: "user-a" },
      { id: "farm-b", user_id: "user-b" },
    ],
    allSeasons: [
      { id: "season-a", farm_id: "farm-a", status: "active" },
      { id: "season-b", farm_id: "farm-b", status: "active" },
    ],
    harvest: [
      { id: "potato-harvest", farm_id: "farm-a", total_kg: 120 },
      { id: "other-harvest", farm_id: "farm-b", total_kg: 80 },
    ],
    farm: { id: "farm-a" },
    active: { id: "season-a", farm_id: "farm-a" },
  }, "user-a");

  assert.deepEqual(result.farms.map((farm) => farm.id), ["farm-a"]);
  assert.deepEqual(result.seasons.map((season) => season.id), ["season-a"]);
  assert.deepEqual(result.harvestRecords.map((record) => record.id), ["potato-harvest"]);
  assert.equal(result.activeFarmId, "farm-a");
  assert.equal(result.activeSeasonId, "season-a");
});

test("merges keyed and cached legacy rows without duplicating matching IDs", () => {
  const base = legacyCacheToFarmData({
    allFarms: [{ id: "farm-a", user_id: "user-a" }],
    allSeasons: [{ id: "season-a", farm_id: "farm-a", status: "active" }],
  }, "user-a");
  const additional = legacyCacheToFarmData({
    allFarms: [{ id: "farm-a", user_id: "user-a", name: "Recovered name" }],
    allSeasons: [{ id: "season-a", farm_id: "farm-a", status: "closed" }],
  }, "user-a");

  const merged = mergeLegacyFarmData(base, additional);
  assert.equal(merged.farms.length, 1);
  assert.equal(merged.farms[0].name, "Recovered name");
  assert.equal(merged.seasons.length, 1);
  assert.equal(merged.seasons[0].status, "closed");
});
