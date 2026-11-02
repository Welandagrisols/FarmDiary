import assert from "node:assert/strict";
import test from "node:test";
import {
  M2_PER_ACRE,
  areaM2,
  averageFixes,
  centroid,
  formatAcres,
  hasSelfIntersection,
  measure,
  perimeterM,
  simplifyRing,
  toGeoJSON,
  toKML,
  validateRing,
} from "../lib/geo.ts";

const degreeFor100m = (100 / 6371008.8) * (180 / Math.PI);
const square = [
  [0, 0],
  [degreeFor100m, 0],
  [degreeFor100m, degreeFor100m],
  [0, degreeFor100m],
];

test("area and perimeter are calculated from GPS coordinates", () => {
  assert.ok(Math.abs(areaM2(square) - 10000) < 5);
  assert.ok(Math.abs(perimeterM(square) - 400) < 1);
  const result = measure(square, 5);
  assert.ok(Math.abs(result.acres - 10000 / M2_PER_ACRE) < 0.002);
  assert.ok(Math.abs(result.center[0] - degreeFor100m / 2) < 1e-8);
  assert.ok(Math.abs(result.center[1] - degreeFor100m / 2) < 1e-8);
});

test("validates a non-crossing plot and rejects a bow-tie outline", () => {
  assert.equal(validateRing(square).ok, true);
  const bowTie = [
    [0, 0],
    [degreeFor100m, degreeFor100m],
    [0, degreeFor100m],
    [degreeFor100m, 0],
  ];
  assert.equal(hasSelfIntersection(bowTie), true);
  assert.equal(validateRing(bowTie).ok, false);
});

test("rejects too few and invalid coordinate points", () => {
  assert.match(validateRing([[0, 0], [0.001, 0]]).problems[0], /at least 3/i);
  assert.match(validateRing([[0, 0], [0.001, 0], [NaN, 0]]).problems[0], /valid coordinates/i);
});

test("simplifies a walked track without losing its broad shape", () => {
  const track = [
    [0, 0],
    [degreeFor100m * 0.25, 0],
    [degreeFor100m * 0.5, 0],
    [degreeFor100m * 0.75, 0],
    [degreeFor100m, 0],
    [degreeFor100m, degreeFor100m * 0.5],
    [degreeFor100m, degreeFor100m],
    [degreeFor100m * 0.5, degreeFor100m],
    [0, degreeFor100m],
  ];
  const simplified = simplifyRing(track, 2);
  assert.ok(simplified.length >= 4);
  assert.ok(Math.abs(areaM2(simplified) - areaM2(track)) < 5);
});

test("corner averaging weights stronger GPS fixes more heavily", () => {
  const averaged = averageFixes([
    { lng: 0, lat: 0, accuracy: 5, t: 1 },
    { lng: 0.001, lat: 0.001, accuracy: 30, t: 2 },
  ]);
  assert.ok(averaged);
  assert.ok(averaged.lng < 0.0002);
  assert.equal(averaged.accuracy, 30);
  assert.equal(averageFixes([{ lng: 0, lat: 0, accuracy: 50, t: 3 }]), null);
});

test("exports a closed GeoJSON and escaped KML polygon", () => {
  const geojson = toGeoJSON("North & South", square);
  assert.equal(geojson.geometry.type, "Polygon");
  assert.deepEqual(geojson.geometry.coordinates[0][0], geojson.geometry.coordinates[0].at(-1));
  assert.match(toKML("North & South", square), /North &amp; South/);
});

test("formats acres at a practical precision", () => {
  assert.equal(formatAcres(1.256), "1.26");
  assert.equal(formatAcres(12.56), "12.6");
});
