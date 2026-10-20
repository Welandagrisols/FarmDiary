import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

const MIGRATION_KEY = "asyncstorage_migrated_v1";

export async function migrateFromAsyncStorage(): Promise<void> {
  try {
    const { data } = await supabase
      .from("app_meta")
      .select("value")
      .eq("key", MIGRATION_KEY)
      .maybeSingle();

    if (data?.value === "true") return;

    const [
      farmsJson,
      seasonsJson,
      costsJson,
      inventoryJson,
      logsJson,
      obsJson,
      harvestJson,
      activeFarmId,
      activeSeasonId,
    ] = await Promise.all([
      AsyncStorage.getItem("farm_farms"),
      AsyncStorage.getItem("farm_seasons"),
      AsyncStorage.getItem("farm_costs"),
      AsyncStorage.getItem("farm_inventory"),
      AsyncStorage.getItem("farm_activity_logs"),
      AsyncStorage.getItem("farm_observations"),
      AsyncStorage.getItem("farm_harvest"),
      AsyncStorage.getItem("farm_active_farm_id"),
      AsyncStorage.getItem("farm_active_season_id"),
    ]);

    const farms = farmsJson ? JSON.parse(farmsJson) : [];

    if (farms.length > 0) {
      const seasons = seasonsJson ? JSON.parse(seasonsJson) : [];
      const costs = costsJson ? JSON.parse(costsJson) : [];
      const inventory = inventoryJson ? JSON.parse(inventoryJson) : [];
      const logs = logsJson ? JSON.parse(logsJson) : [];
      const observations = obsJson ? JSON.parse(obsJson) : [];
      const harvests = harvestJson ? JSON.parse(harvestJson) : [];

      await supabase.from("farms").upsert(farms, { onConflict: "id" });
      if (seasons.length)
        await supabase.from("seasons").upsert(seasons, { onConflict: "id" });
      if (costs.length)
        await supabase.from("costs").upsert(costs, { onConflict: "id" });
      if (inventory.length)
        await supabase.from("inventory").upsert(inventory, { onConflict: "id" });
      if (logs.length)
        await supabase.from("activity_logs").upsert(logs, { onConflict: "id" });
      if (observations.length)
        await supabase
          .from("observations")
          .upsert(observations, { onConflict: "id" });
      if (harvests.length)
        await supabase
          .from("harvest_records")
          .upsert(harvests, { onConflict: "id" });
    }

    const metaRows: { key: string; value: string }[] = [
      { key: MIGRATION_KEY, value: "true" },
    ];
    if (activeFarmId) metaRows.push({ key: "active_farm_id", value: activeFarmId });
    if (activeSeasonId)
      metaRows.push({ key: "active_season_id", value: activeSeasonId });

    await supabase.from("app_meta").upsert(metaRows);
  } catch (err) {
    console.warn("[migration] AsyncStorage → Supabase migration failed:", err);
  }
}
