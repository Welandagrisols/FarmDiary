import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

// Linking cost entries to activities needs the costs.activity_log_id column (scripts/activity-cost-links.sql).
// Until that has been applied, the app must keep working exactly as before and must not send the field
// (a missing column would make every cost save fail). So the column is probed once and remembered.

const KEY = "activity_cost_links_available";
let cached: boolean | null = null;

export async function activityLinksAvailable(): Promise<boolean> {
  if (cached !== null) return cached;
  try {
    if ((await AsyncStorage.getItem(KEY)) === "true") { cached = true; return true; }
  } catch { /* storage unreadable: fall through to the probe */ }
  try {
    const { error } = await supabase.from("costs").select("activity_log_id").limit(1);
    if (!error) {
      cached = true;
      await AsyncStorage.setItem(KEY, "true").catch(() => undefined);
      return true;
    }
    if (error.code === "42703" || error.code === "PGRST204" || /activity_log_id/i.test(error.message)) {
      cached = false; // column genuinely missing: remembered until the app restarts
      return false;
    }
  } catch { /* offline: unknown */ }
  return false; // unknown (offline, first run): not cached, so it is checked again next time
}
