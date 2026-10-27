import { supabase } from "./supabase";
import type { PlotRecord, SamplingMethod, SoilResult, SoilStatus, SoilTestRecord } from "./soil";

// Direct database access for plots and soil tests (row-level security decides who may do what).
// Reading photos/PDFs goes through the server (lib/api.ts -> soilApi); everything here is plain data.

const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function fail(error: { message: string; code?: string }, fallback = "Something went wrong."): never {
  if (error.code === "23505") throw new Error("A plot with that name already exists on this farm.");
  if (error.code === "42P01") throw new Error("Soil tables are not set up yet. Run scripts/soil-module.sql in Supabase.");
  throw new Error(error.message || fallback);
}

async function currentUserId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Please sign in again.");
  return session.user.id;
}

// ───────── plots ─────────

export async function listPlots(farmId: string): Promise<PlotRecord[]> {
  const { data, error } = await supabase.from("plots").select("*").eq("farm_id", farmId).order("name", { ascending: true });
  if (error) fail(error);
  return (data ?? []) as PlotRecord[];
}

export async function createPlot(farmId: string, input: { name: string; area_acres: number | null; description: string | null }): Promise<PlotRecord> {
  const row = { id: newId("plot"), farm_id: farmId, name: input.name.trim(), area_acres: input.area_acres, description: input.description?.trim() || null, created_by: await currentUserId() };
  const { data, error } = await supabase.from("plots").insert(row).select().single();
  if (error) fail(error);
  return data as PlotRecord;
}

export async function updatePlot(id: string, updates: Partial<Pick<PlotRecord, "name" | "area_acres" | "description" | "is_archived">>): Promise<PlotRecord> {
  const clean = { ...updates, ...(updates.name !== undefined ? { name: updates.name.trim() } : {}) };
  const { data, error } = await supabase.from("plots").update(clean).eq("id", id).select().single();
  if (error) fail(error);
  return data as PlotRecord;
}

// ───────── soil tests ─────────

export async function listSoilTests(farmId: string): Promise<SoilTestRecord[]> {
  const { data, error } = await supabase.from("soil_tests").select("*").eq("farm_id", farmId).order("created_at", { ascending: false });
  if (error) fail(error);
  return (data ?? []) as SoilTestRecord[];
}

export async function getSoilTest(id: string): Promise<SoilTestRecord | null> {
  const { data, error } = await supabase.from("soil_tests").select("*").eq("id", id).maybeSingle();
  if (error) fail(error);
  return (data as SoilTestRecord) ?? null;
}

export type SoilTestEditable = Partial<Pick<SoilTestRecord,
  "plot_id" | "sample_label" | "sample_date" | "lab_name" | "lab_reference" | "sample_depth" | "sampling_method" |
  "results" | "recommendations" | "status" | "location_on_report" | "intended_crops" | "recommendation_items"
>>;

export async function updateSoilTest(id: string, updates: SoilTestEditable): Promise<SoilTestRecord> {
  const { data, error } = await supabase.from("soil_tests").update(updates).eq("id", id).select().single();
  if (error) fail(error);
  return data as SoilTestRecord;
}

export async function confirmSoilTest(id: string): Promise<SoilTestRecord> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("soil_tests")
    .update({ status: "confirmed" satisfies SoilStatus, confirmed_by: userId, confirmed_at: new Date().toISOString() })
    .eq("id", id).select().single();
  if (error) fail(error);
  return data as SoilTestRecord;
}

/** A test typed in by hand (no report file). plotId null = whole farm. */
export async function createManualSoilTest(farmId: string, plotId: string | null, method: SamplingMethod): Promise<SoilTestRecord> {
  const row = {
    id: newId("soil"), farm_id: farmId, plot_id: plotId, sampling_method: method, results: [] as SoilResult[],
    source: "manual", status: "manual" satisfies SoilStatus, created_by: await currentUserId(),
  };
  const { data, error } = await supabase.from("soil_tests").insert(row).select().single();
  if (error) fail(error);
  return data as SoilTestRecord;
}
