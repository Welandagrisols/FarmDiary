import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PlotRecord } from "./soil";
import { isNetworkError } from "./network-errors";
import { M2_PER_ACRE, type LngLat, type Measurement } from "./geo";
import { supabase } from "./supabase";

export type BoundaryMethod = "corners" | "walk";
export type QueueReason = "offline" | "database_setup";

export interface BoundaryHistoryRow {
  id: number;
  plot_id: string;
  boundary: LngLat[];
  area_m2: number | null;
  perimeter_m: number | null;
  accuracy_m: number | null;
  method: BoundaryMethod | null;
  captured_at: string | null;
  replaced_at: string;
}

export interface PendingBoundary {
  plotId: string;
  ring: LngLat[];
  areaM2: number;
  perimeterM: number;
  center: LngLat;
  accuracyM: number;
  method: BoundaryMethod;
  useMeasuredArea: boolean;
  savedOnPhoneAt: string;
}

type PendingStore = Record<string, PendingBoundary[]>;
const PENDING_KEY = "pending_plot_boundaries_v2";

async function readPending(): Promise<PendingStore> {
  const raw = await AsyncStorage.getItem(PENDING_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const normalized: PendingStore = {};
    for (const [plotId, value] of Object.entries(parsed)) {
      if (Array.isArray(value)) {
        normalized[plotId] = value.filter((row): row is PendingBoundary =>
          !!row && typeof row === "object" && Array.isArray((row as PendingBoundary).ring),
        );
      } else if (value && typeof value === "object" && Array.isArray((value as PendingBoundary).ring)) {
        // Accept the single-record format used by the supplied patch.
        normalized[plotId] = [value as PendingBoundary];
      }
    }
    return normalized;
  } catch {
    throw new Error("Saved plot-boundary measurements could not be read from this phone. Keep this app installed and contact the farm manager before clearing its storage.");
  }
}

async function writePending(all: PendingStore): Promise<void> {
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(all));
}

function isBoundarySchemaError(error: { message?: string; code?: string }): boolean {
  return ["42703", "42P01", "PGRST204", "PGRST205"].includes(error.code ?? "")
    || (/boundary/i.test(error.message ?? "") && /(column|schema cache|relation|table)/i.test(error.message ?? ""));
}

function errorMessage(error: { message: string; code?: string }): never {
  if (isBoundarySchemaError(error)) {
    throw new Error("Boundary mapping is not set up in the farm database yet. The measurement stays on this phone until the setup script is applied.");
  }
  throw new Error(error.message || "Something went wrong.");
}

function toRow(pending: PendingBoundary) {
  return {
    boundary: pending.ring,
    boundary_area_m2: Math.round(pending.areaM2 * 100) / 100,
    boundary_perimeter_m: Math.round(pending.perimeterM * 100) / 100,
    boundary_center_lat: Number(pending.center[1].toFixed(7)),
    boundary_center_lng: Number(pending.center[0].toFixed(7)),
    boundary_accuracy_m: Math.max(0.1, Math.round(pending.accuracyM * 10) / 10),
    boundary_method: pending.method,
    ...(pending.useMeasuredArea
      ? { area_acres: Math.round((pending.areaM2 / M2_PER_ACRE) * 100) / 100 }
      : {}),
  };
}

export async function saveBoundary(input: {
  plotId: string;
  measurement: Measurement;
  method: BoundaryMethod;
  useMeasuredArea: boolean;
}): Promise<{ queued: boolean; reason?: QueueReason }> {
  await flushPendingBoundaries();
  const pending: PendingBoundary = {
    plotId: input.plotId,
    ring: input.measurement.ring,
    areaM2: input.measurement.areaM2,
    perimeterM: input.measurement.perimeterM,
    center: input.measurement.center,
    accuracyM: input.measurement.accuracyM,
    method: input.method,
    useMeasuredArea: input.useMeasuredArea,
    savedOnPhoneAt: new Date().toISOString(),
  };
  const { error } = await supabase.from("plots").update(toRow(pending)).eq("id", input.plotId).select().single();
  if (!error) {
    const all = await readPending();
    delete all[input.plotId];
    await writePending(all);
    return { queued: false };
  }
  if (!isNetworkError(error) && !isBoundarySchemaError(error)) errorMessage(error);

  const all = await readPending();
  const queue = all[input.plotId] ?? [];
  queue.push(pending);
  all[input.plotId] = queue;
  await writePending(all);
  return { queued: true, reason: isBoundarySchemaError(error) ? "database_setup" : "offline" };
}

export async function getPendingBoundary(plotId: string): Promise<PendingBoundary | null> {
  const queue = (await readPending())[plotId] ?? [];
  return queue[queue.length - 1] ?? null;
}

export async function getPendingPlotIds(): Promise<string[]> {
  return Object.keys(await readPending());
}

export async function applyPendingBoundaries(plots: PlotRecord[]): Promise<PlotRecord[]> {
  const pending = await readPending();
  return plots.map((plot) => {
    const latest = pending[plot.id]?.at(-1);
    if (!latest) return plot;
    return {
      ...plot,
      boundary: latest.ring,
      boundary_area_m2: latest.areaM2,
      boundary_perimeter_m: latest.perimeterM,
      boundary_center_lat: latest.center[1],
      boundary_center_lng: latest.center[0],
      boundary_accuracy_m: latest.accuracyM,
      boundary_method: latest.method,
      boundary_captured_at: latest.savedOnPhoneAt,
      ...(latest.useMeasuredArea ? { area_acres: latest.areaM2 / M2_PER_ACRE } : {}),
    };
  });
}

// Upload queued measurements in order so the database history trigger retains replacements.
export async function flushPendingBoundaries(): Promise<number> {
  const all = await readPending();
  let sent = 0;
  for (const plotId of Object.keys(all)) {
    const queue = all[plotId] ?? [];
    while (queue.length > 0) {
      const { error } = await supabase.from("plots").update(toRow(queue[0])).eq("id", plotId).select().single();
      if (!error) {
        queue.shift();
        sent++;
        continue;
      }
      if (error.code === "PGRST116") {
        delete all[plotId];
        break;
      }
      // Keep measurements safely on-device if offline, unconfigured, or blocked by access rules.
      break;
    }
    if (queue.length > 0 && all[plotId]) all[plotId] = queue;
    else delete all[plotId];
  }
  await writePending(all);
  return sent;
}

export async function clearBoundary(plotId: string): Promise<void> {
  const all = await readPending();
  const { error } = await supabase.from("plots").update({ boundary: null }).eq("id", plotId).select().single();
  if (!error) {
    delete all[plotId];
    await writePending(all);
    return;
  }
  if (isBoundarySchemaError(error) && all[plotId]?.length) {
    delete all[plotId];
    await writePending(all);
    return;
  }
  // Keep queued measurements intact if an existing cloud boundary cannot be cleared.
  errorMessage(error);
}

export async function listBoundaryHistory(plotId: string): Promise<BoundaryHistoryRow[]> {
  const { data, error } = await supabase
    .from("plot_boundary_history")
    .select("id, plot_id, boundary, area_m2, perimeter_m, accuracy_m, method, captured_at, replaced_at")
    .eq("plot_id", plotId)
    .order("replaced_at", { ascending: false });
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    errorMessage(error);
  }
  return (data ?? []) as BoundaryHistoryRow[];
}
