// Plot-boundary maths. Coordinates use GeoJSON order: [longitude, latitude].
// Rings do not repeat the first point at the end.
export type LngLat = [number, number];

export interface GpsFix {
  lng: number;
  lat: number;
  accuracy: number;
  t: number;
}

const EARTH_RADIUS_M = 6371008.8;
export const M2_PER_ACRE = 4046.8564224;
const M2_PER_HECTARE = 10000;
const RAD = Math.PI / 180;

export const GPS = {
  GOOD_M: 5,
  OK_M: 10,
  MAX_ACCEPT_M: 20,
  WALK_MIN_STEP_M: 6,
  WALK_MAX_ACCURACY_M: 12,
  MAX_SPEED_MS: 8,
  MIN_CORNER_GAP_M: 3,
  SIMPLIFY_TOLERANCE_M: 1.5,
  MIN_AREA_M2: 25,
  MAX_POINTS: 500,
} as const;

export function haversineM(a: LngLat, b: LngLat): number {
  const dLat = (b[1] - a[1]) * RAD;
  const dLng = (b[0] - a[0]) * RAD;
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

export interface XY { x: number; y: number }

// Equirectangular projection is accurate enough for farm plots a few kilometres wide.
export function toLocalXY(ring: LngLat[], origin?: LngLat): XY[] {
  const o = origin ?? meanPoint(ring);
  const k = Math.cos(o[1] * RAD);
  return ring.map(([lng, lat]) => ({
    x: (lng - o[0]) * RAD * EARTH_RADIUS_M * k,
    y: (lat - o[1]) * RAD * EARTH_RADIUS_M,
  }));
}

function meanPoint(ring: LngLat[]): LngLat {
  const n = ring.length || 1;
  return [
    ring.reduce((sum, point) => sum + point[0], 0) / n,
    ring.reduce((sum, point) => sum + point[1], 0) / n,
  ];
}

function signedArea(xy: XY[]): number {
  let area = 0;
  for (let i = 0; i < xy.length; i++) {
    const p = xy[i];
    const q = xy[(i + 1) % xy.length];
    area += p.x * q.y - q.x * p.y;
  }
  return area / 2;
}

export function areaM2(ring: LngLat[]): number {
  return ring.length < 3 ? 0 : Math.abs(signedArea(toLocalXY(ring)));
}

export function perimeterM(ring: LngLat[], closed = true): number {
  let total = 0;
  const edgeCount = closed ? ring.length : Math.max(0, ring.length - 1);
  for (let i = 0; i < edgeCount; i++) {
    total += haversineM(ring[i], ring[(i + 1) % ring.length]);
  }
  return total;
}

export function centroid(ring: LngLat[]): LngLat {
  if (ring.length === 0) return [0, 0];
  if (ring.length < 3) return meanPoint(ring);
  const origin = meanPoint(ring);
  const xy = toLocalXY(ring, origin);
  const area = signedArea(xy);
  if (Math.abs(area) < 1e-9) return origin;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < xy.length; i++) {
    const p = xy[i];
    const q = xy[(i + 1) % xy.length];
    const factor = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * factor;
    cy += (p.y + q.y) * factor;
  }
  cx /= 6 * area;
  cy /= 6 * area;
  const k = Math.cos(origin[1] * RAD);
  return [
    origin[0] + cx / (RAD * EARTH_RADIUS_M * k),
    origin[1] + cy / (RAD * EARTH_RADIUS_M),
  ];
}

export interface Side { from: number; to: number; meters: number; bearingDeg: number }

export function bearingDeg(a: LngLat, b: LngLat): number {
  const y = Math.sin((b[0] - a[0]) * RAD) * Math.cos(b[1] * RAD);
  const x = Math.cos(a[1] * RAD) * Math.sin(b[1] * RAD)
    - Math.sin(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.cos((b[0] - a[0]) * RAD);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

export function sides(ring: LngLat[]): Side[] {
  return ring.map((point, i) => {
    const next = (i + 1) % ring.length;
    return {
      from: i,
      to: next,
      meters: haversineM(point, ring[next]),
      bearingDeg: bearingDeg(point, ring[next]),
    };
  });
}

function orient(a: XY, b: XY, c: XY): number {
  const value = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return Math.abs(value) < 1e-9 ? 0 : value > 0 ? 1 : -1;
}

function segmentsCross(p1: XY, p2: XY, p3: XY, p4: XY): boolean {
  const o1 = orient(p1, p2, p3);
  const o2 = orient(p1, p2, p4);
  const o3 = orient(p3, p4, p1);
  const o4 = orient(p3, p4, p2);
  return o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0 && o1 !== o2 && o3 !== o4;
}

export function hasSelfIntersection(ring: LngLat[]): boolean {
  const xy = toLocalXY(ring);
  for (let i = 0; i < xy.length; i++) {
    for (let j = i + 1; j < xy.length; j++) {
      if (j === i + 1 || (i === 0 && j === xy.length - 1)) continue;
      if (segmentsCross(xy[i], xy[(i + 1) % xy.length], xy[j], xy[(j + 1) % xy.length])) return true;
    }
  }
  return false;
}

export function isValidLngLat(value: unknown): value is LngLat {
  return Array.isArray(value)
    && value.length === 2
    && typeof value[0] === "number"
    && typeof value[1] === "number"
    && Number.isFinite(value[0])
    && Number.isFinite(value[1])
    && value[0] >= -180 && value[0] <= 180
    && value[1] >= -90 && value[1] <= 90;
}

export function isRing(value: unknown): value is LngLat[] {
  return Array.isArray(value)
    && value.length >= 3
    && value.length <= GPS.MAX_POINTS
    && value.every(isValidLngLat);
}

export interface RingCheck { ok: boolean; problems: string[] }

export function validateRing(ring: LngLat[]): RingCheck {
  const problems: string[] = [];
  if (ring.length < 3) {
    problems.push("Mark at least 3 points.");
    return { ok: false, problems };
  }
  if (!isRing(ring)) {
    problems.push("Some points are not valid coordinates.");
    return { ok: false, problems };
  }
  if (areaM2(ring) < GPS.MIN_AREA_M2) problems.push("The outline is too small to be a farm plot.");
  for (let i = 0; i < ring.length; i++) {
    if (haversineM(ring[i], ring[(i + 1) % ring.length]) < 0.5) {
      problems.push("Two neighbouring points are almost the same spot.");
      break;
    }
  }
  if (hasSelfIntersection(ring)) problems.push("The outline crosses itself. Walk around the edge in order.");
  return { ok: problems.length === 0, problems };
}

// Douglas–Peucker simplification for the GPS track, split at the farthest point.
export function simplifyRing(ring: LngLat[], toleranceM = GPS.SIMPLIFY_TOLERANCE_M): LngLat[] {
  if (ring.length <= 4) return ring;
  const xy = toLocalXY(ring);
  const keep = new Array<boolean>(ring.length).fill(false);
  keep[0] = true;
  let far = 0;
  let farDistance = -1;
  xy.forEach((point, i) => {
    const distance = Math.hypot(point.x - xy[0].x, point.y - xy[0].y);
    if (distance > farDistance) {
      farDistance = distance;
      far = i;
    }
  });
  keep[far] = true;
  const simplifySegment = (lo: number, hi: number, indices: number[]) => {
    if (hi - lo < 2) return;
    const a = xy[indices[lo]];
    const b = xy[indices[hi]];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    let maxDistance = -1;
    let index = -1;
    for (let k = lo + 1; k < hi; k++) {
      const point = xy[indices[k]];
      const distance = length < 1e-9
        ? Math.hypot(point.x - a.x, point.y - a.y)
        : Math.abs((b.x - a.x) * (a.y - point.y) - (a.x - point.x) * (b.y - a.y)) / length;
      if (distance > maxDistance) {
        maxDistance = distance;
        index = k;
      }
    }
    if (maxDistance > toleranceM) {
      keep[indices[index]] = true;
      simplifySegment(lo, index, indices);
      simplifySegment(index, hi, indices);
    }
  };
  const first = Array.from({ length: far + 1 }, (_, i) => i);
  const second = [...Array.from({ length: ring.length - far }, (_, i) => far + i), 0];
  simplifySegment(0, first.length - 1, first);
  simplifySegment(0, second.length - 1, second);
  const result = ring.filter((_, i) => keep[i]);
  return result.length >= 3 ? result : ring;
}

export function averageFixes(fixes: GpsFix[]): { lng: number; lat: number; accuracy: number; used: number } | null {
  const usable = fixes.filter((fix) =>
    Number.isFinite(fix.accuracy) && fix.accuracy > 0 && fix.accuracy <= GPS.MAX_ACCEPT_M * 1.5,
  );
  if (usable.length === 0) return null;
  let weightSum = 0;
  let lng = 0;
  let lat = 0;
  for (const fix of usable) {
    const weight = 1 / (fix.accuracy * fix.accuracy);
    weightSum += weight;
    lng += fix.lng * weight;
    lat += fix.lat * weight;
  }
  const accuracies = usable.map((fix) => fix.accuracy).sort((a, b) => a - b);
  return {
    lng: lng / weightSum,
    lat: lat / weightSum,
    accuracy: accuracies[Math.floor(accuracies.length / 2)],
    used: usable.length,
  };
}

export type AccuracyBand = "good" | "ok" | "poor" | "unusable";

export function accuracyBand(accuracyM: number | null | undefined): AccuracyBand {
  if (accuracyM === null || accuracyM === undefined || !Number.isFinite(accuracyM)) return "unusable";
  if (accuracyM <= GPS.GOOD_M) return "good";
  if (accuracyM <= GPS.OK_M) return "ok";
  if (accuracyM <= GPS.MAX_ACCEPT_M) return "poor";
  return "unusable";
}

export function areaUncertaintyPct(ring: LngLat[], accuracyM: number): number {
  const area = areaM2(ring);
  if (ring.length < 3 || area <= 0) return 100;
  const xy = toLocalXY(ring);
  let sum = 0;
  for (let i = 0; i < xy.length; i++) {
    const previous = xy[(i + xy.length - 1) % xy.length];
    const next = xy[(i + 1) % xy.length];
    sum += (next.x - previous.x) ** 2 + (next.y - previous.y) ** 2;
  }
  const sigmaAxis = accuracyM / 1.2;
  return Math.min(100, (0.5 * sigmaAxis * Math.sqrt(sum) * 100) / area);
}

export interface Measurement {
  ring: LngLat[];
  areaM2: number;
  acres: number;
  hectares: number;
  perimeterM: number;
  center: LngLat;
  accuracyM: number;
  uncertaintyPct: number;
}

export function measure(ring: LngLat[], accuracyM: number): Measurement {
  const area = areaM2(ring);
  return {
    ring,
    areaM2: area,
    acres: area / M2_PER_ACRE,
    hectares: area / M2_PER_HECTARE,
    perimeterM: perimeterM(ring),
    center: centroid(ring),
    accuracyM,
    uncertaintyPct: areaUncertaintyPct(ring, accuracyM),
  };
}

export interface ViewPolygon { id: string; points: { x: number; y: number }[] }

export function projectToView(
  rings: { id: string; ring: LngLat[] }[],
  width: number,
  height: number,
  padding = 18,
): { polygons: ViewPolygon[]; metersPerPixel: number } {
  const all = rings.flatMap((ring) => ring.ring);
  if (all.length === 0 || width <= 2 * padding || height <= 2 * padding) {
    return { polygons: [], metersPerPixel: 1 };
  }
  const origin = meanPoint(all);
  const projected = rings.map((ring) => ({ id: ring.id, xy: toLocalXY(ring.ring, origin) }));
  const flat = projected.flatMap((ring) => ring.xy);
  const minX = Math.min(...flat.map((point) => point.x));
  const maxX = Math.max(...flat.map((point) => point.x));
  const minY = Math.min(...flat.map((point) => point.y));
  const maxY = Math.max(...flat.map((point) => point.y));
  const w = Math.max(maxX - minX, 1);
  const h = Math.max(maxY - minY, 1);
  const scale = Math.min((width - 2 * padding) / w, (height - 2 * padding) / h);
  const offX = (width - w * scale) / 2;
  const offY = (height - h * scale) / 2;
  return {
    polygons: projected.map((ring) => ({
      id: ring.id,
      points: ring.xy.map((point) => ({
        x: offX + (point.x - minX) * scale,
        y: height - (offY + (point.y - minY) * scale),
      })),
    })),
    metersPerPixel: 1 / scale,
  };
}

export function niceScaleMeters(maxMeters: number): number {
  const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
  let best = steps[0];
  for (const step of steps) if (step <= maxMeters) best = step;
  return best;
}

export function formatCoord(lat: number, lng: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(6)}° ${ns}, ${Math.abs(lng).toFixed(6)}° ${ew}`;
}

export function formatAcres(acres: number): string {
  return acres >= 10 ? acres.toFixed(1) : acres.toFixed(2);
}

export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

export function toGeoJSON(name: string, ring: LngLat[], props: Record<string, unknown> = {}) {
  const closed = [...ring, ring[0]];
  return {
    type: "Feature" as const,
    properties: { name, ...props },
    geometry: { type: "Polygon" as const, coordinates: [closed] },
  };
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function toKML(name: string, ring: LngLat[]): string {
  const coordinates = [...ring, ring[0]]
    .map(([lng, lat]) => `${lng.toFixed(7)},${lat.toFixed(7)},0`)
    .join(" ");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Placemark><name>${escapeXml(name)}</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${coordinates}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></kml>`;
}
