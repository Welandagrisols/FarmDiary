import { supabase } from "./supabase";
import type { BuyerCommitment } from "./buyer-commitments";

const newId = () => `bc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function fail(error: { message: string; code?: string }): never {
  if (error.code === "42P01" || /buyer_commitments/i.test(error.message) && /(does not exist|schema cache)/i.test(error.message)) {
    throw new Error("Buyer commitments are not set up yet. Apply scripts/buyer-commitments.sql in Supabase after its listed prerequisites.");
  }
  if (error.code === "42501") throw new Error("Only a farm manager can change buyer commitments.");
  throw new Error(error.message || "Something went wrong.");
}

export async function listCommitments(farmId: string): Promise<BuyerCommitment[]> {
  const { data, error } = await supabase.from("buyer_commitments").select("*")
    .eq("farm_id", farmId).order("created_at", { ascending: true });
  if (error) fail(error);
  return (data ?? []) as BuyerCommitment[];
}

export async function createCommitment(input: {
  farm_id: string;
  season_id: string | null;
  buyer_name: string;
  product_name: string;
  weekly_kg: number;
  agreed_price_kes: number | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
}): Promise<BuyerCommitment> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Please sign in again.");
  const row = {
    id: newId(),
    ...input,
    buyer_name: input.buyer_name.trim(),
    product_name: input.product_name.trim(),
    created_by: session.user.id,
  };
  const { data, error } = await supabase.from("buyer_commitments").insert(row).select().single();
  if (error) fail(error);
  return data as BuyerCommitment;
}

export async function deleteCommitment(id: string): Promise<void> {
  const { error } = await supabase.from("buyer_commitments").delete().eq("id", id);
  if (error) fail(error);
}
