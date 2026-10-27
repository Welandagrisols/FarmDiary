import { Alert } from "react-native";
import { reportWriteError } from "./write-errors";

const kes = (n: number) => `KES ${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

interface Args {
  log: { id: string; activity_name: string };
  /** Cost entries linked to this activity (empty for older, unlinked activities). */
  linkedCosts: readonly { id: string; amount_kes: number }[];
  removeActivityLog: (id: string) => Promise<void>;
  removeCost: (id: string) => Promise<void>;
  editCostEntry: (id: string, updates: { activity_log_id: null }) => Promise<void>;
  onRemoved?: () => void;
}

/**
 * Removing an activity used to leave its costs behind with no word about it. When the activity has linked
 * cost entries the person now chooses: keep them in the ledger (they become ordinary costs) or remove them too.
 */
export function confirmRemoveActivity({ log, linkedCosts, removeActivityLog, removeCost, editCostEntry, onRemoved }: Args): void {
  const run = async (alsoRemoveCosts: boolean) => {
    try {
      for (const cost of linkedCosts) {
        if (alsoRemoveCosts) await removeCost(cost.id);
        else await editCostEntry(cost.id, { activity_log_id: null });
      }
      await removeActivityLog(log.id);
      onRemoved?.();
    } catch (error) {
      reportWriteError(error, "Could not remove this activity. Please try again.", "Error");
    }
  };

  if (linkedCosts.length === 0) {
    Alert.alert(
      "Remove Activity",
      `Remove "${log.activity_name}"? This marks it as not done. Any separate cost entries stay in the ledger.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => { void run(false); } },
      ],
    );
    return;
  }

  const total = linkedCosts.reduce((sum, c) => sum + (Number(c.amount_kes) || 0), 0);
  const n = linkedCosts.length;
  Alert.alert(
    "Remove Activity",
    `Remove "${log.activity_name}"?\n\nIt has ${n} cost ${n === 1 ? "entry" : "entries"} in the ledger (${kes(total)}). What should happen to ${n === 1 ? "it" : "them"}?`,
    [
      { text: "Cancel", style: "cancel" },
      { text: "Keep the costs", onPress: () => { void run(false); } },
      { text: "Remove the costs too", style: "destructive", onPress: () => { void run(true); } },
    ],
  );
}
