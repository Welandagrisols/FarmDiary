import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { useFarm } from "@/context/FarmContext";
import COLORS, { CARD_SHADOW } from "@/constants/colors";
import { addCost, addInventoryItem, addHarvestRecord, addActivityLog, addFieldObservation } from "@/lib/supabase-storage";
import * as Haptics from "expo-haptics";
import { getSeasonBlocks } from "@/lib/storage";
import { backupBlocker, looksLikeBackup, prepareBackupImport, sumSkipped } from "@/lib/backup-import";
import { isLegacyHarvestRecord, seasonCostTotal } from "@/lib/season-finance";

async function shareFile(filename: string, content: string, mimeType: string) {
  if (Platform.OS === "web") {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }
  const path = (FileSystem.cacheDirectory ?? "") + filename;
  await FileSystem.writeAsStringAsync(path, content, { encoding: FileSystem.EncodingType.UTF8 });
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    Alert.alert("Sharing unavailable", "Your device does not support file sharing.");
    return;
  }
  await Sharing.shareAsync(path, { mimeType, dialogTitle: `Share ${filename}` });
}

async function readPickedFile(uri: string): Promise<string> {
  if (Platform.OS === "web") {
    const response = await fetch(uri);
    return response.text();
  }
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
}

export default function ExportScreen() {
  const insets = useSafeAreaInsets();
  const { costs, activityLogs, inventory, observations, harvestRecords, seasonId, refresh, activeSeason, activeFarm, farmId } = useFarm();
  const [exporting, setExporting] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;
  const today = new Date().toISOString().split("T")[0];

  const exportFullJson = async () => {
    setExporting("json");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      // Only the open crop cycle, so the file matches its label and can be imported as one cycle.
      const inCycle = <T extends { season_id?: string | null }>(rows: T[]) => rows.filter((row) => row.season_id === seasonId);
      const cycleCosts = inCycle(costs);
      const cycleLogs = inCycle(activityLogs);
      const cycleHarvest = inCycle(harvestRecords);
      const payload = {
        format_version: 2,
        exported_at: new Date().toISOString(),
        farm: activeFarm?.name || "Unknown farm",
        farm_id: farmId,
        season: activeSeason?.season_name || "Unknown season",
        season_id: seasonId,
        note: "This backup holds one crop cycle's costs, activities, inventory, observations and harvest records. Sales, plots, soil tests and personal expenses are not included.",
        summary: {
          total_costs: seasonCostTotal(cycleCosts.map((c) => ({ ...c, season_id: seasonId })), seasonId),
          total_activities: cycleLogs.length,
          total_harvest_bags: cycleHarvest.filter((record) => !record.unit || record.unit === "bag").reduce((s, r) => s + r.bags, 0),
          total_harvest_quantity_by_unit: cycleHarvest.reduce((totals: Record<string, number>, record) => {
            const unit = record.unit || "bag";
            totals[unit] = (totals[unit] || 0) + record.bags;
            return totals;
          }, {}),
          // Revenue from the sales ledger is not in this file, so only old harvest-entered revenue is shown here.
          old_harvest_revenue: cycleHarvest.filter(isLegacyHarvestRecord).reduce((s, r) => s + (Number(r.total_revenue_kes) || 0), 0),
        },
        costs: cycleCosts,
        activity_logs: cycleLogs,
        inventory: inCycle(inventory),
        observations: inCycle(observations),
        harvest_records: cycleHarvest,
      };
      await shareFile(`farm-diary-${farmId || "backup"}-${today}.json`, JSON.stringify(payload, null, 2), "application/json");
    } catch {
      Alert.alert("Error", "Could not export backup.");
    } finally {
      setExporting(null);
    }
  };

  const importFromJson = async () => {
    if (importing) return;
    if (!farmId || !seasonId || !activeSeason) {
      Alert.alert("No active season", "Select a farm and create or open a crop cycle before importing a backup.");
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/plain", "*/*"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      setImporting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const rawText = await readPickedFile(result.assets[0].uri);
      let data: unknown;
      try {
        data = JSON.parse(rawText);
      } catch {
        Alert.alert("Invalid File", "The file could not be read as JSON. Please use a backup file exported from Agrisols Farm Diary.");
        setImporting(false);
        return;
      }

      if (!looksLikeBackup(data)) {
        Alert.alert("Invalid Backup", "This file does not look like an Agrisols Farm Diary backup. Expected fields: costs, activity_logs, inventory, harvest_records, observations.");
        setImporting(false);
        return;
      }

      const blocked = backupBlocker(data);
      if (blocked) {
        Alert.alert("Cannot import this file", blocked);
        setImporting(false);
        return;
      }

      // Only compare against what is already in this farm AND season.
      const inSeason = <T extends { season_id?: string | null }>(rows: T[]) => rows.filter((r) => r.season_id === seasonId);
      const prepared = prepareBackupImport(data, {
        farmId,
        seasonId,
        blockIds: getSeasonBlocks(activeSeason).map((b) => b.id),
        existing: {
          costs: inSeason(costs) as unknown as Record<string, unknown>[],
          activityLogs: inSeason(activityLogs) as unknown as Record<string, unknown>[],
          inventory: inSeason(inventory) as unknown as Record<string, unknown>[],
          harvest: inSeason(harvestRecords) as unknown as Record<string, unknown>[],
          observations: inSeason(observations) as unknown as Record<string, unknown>[],
        },
      });
      const skipped = sumSkipped(prepared);
      const cleared = prepared.costs.blockCleared + prepared.activityLogs.blockCleared + prepared.inventory.blockCleared + prepared.harvest.blockCleared + prepared.observations.blockCleared;

      const backupFarm = typeof data.farm === "string" ? data.farm : null;
      const farmWarning = backupFarm && activeFarm?.name && backupFarm !== activeFarm.name
        ? `\n\nThis backup is from "${backupFarm}", but you are importing into "${activeFarm.name}".`
        : "";

      if (prepared.total === 0) {
        Alert.alert(
          "Nothing to import",
          `No new records found.${skipped.duplicate ? `\n• ${skipped.duplicate} already in this season` : ""}${skipped.invalid ? `\n• ${skipped.invalid} unreadable or incomplete` : ""}${skipped.unknownBlock ? `\n• ${skipped.unknownBlock} harvest records belong to a block that is not in this season` : ""}`
        );
        setImporting(false);
        return;
      }

      const lines = [
        `• ${prepared.costs.records.length} cost entries`,
        `• ${prepared.activityLogs.records.length} activity logs`,
        `• ${prepared.inventory.records.length} inventory items`,
        `• ${prepared.harvest.records.length} harvest records`,
        `• ${prepared.observations.records.length} observations`,
      ].join("\n");
      const notes = [
        skipped.duplicate ? `${skipped.duplicate} already in this season will be skipped.` : "",
        skipped.invalid ? `${skipped.invalid} unreadable or incomplete records will be skipped.` : "",
        skipped.unknownBlock ? `${skipped.unknownBlock} harvest records for blocks not in this season will be skipped.` : "",
        cleared ? `${cleared} records refer to a block that is not in this season and will be saved without a block.` : "",
      ].filter(Boolean).join("\n");

      Alert.alert(
        "Import Backup",
        `Into ${activeFarm?.name || "this farm"} · ${activeSeason.season_name}:\n${lines}${notes ? `\n\n${notes}` : ""}${farmWarning}`,
        [
          { text: "Cancel", style: "cancel", onPress: () => setImporting(false) },
          {
            text: `Import ${prepared.total} records`,
            onPress: async () => {
              const failures: Record<string, number> = {};
              let firstError = "";
              let imported = 0;
              const run = async (label: string, records: Record<string, unknown>[], save: (record: any) => Promise<unknown>) => {
                for (const record of records) {
                  try {
                    await save(record);
                    imported++;
                  } catch (err: any) {
                    failures[label] = (failures[label] || 0) + 1;
                    if (!firstError) firstError = err?.message || "Unknown error";
                  }
                }
              };
              try {
                await run("costs", prepared.costs.records, addCost);
                await run("activity logs", prepared.activityLogs.records, addActivityLog);
                await run("inventory", prepared.inventory.records, addInventoryItem);
                await run("harvest records", prepared.harvest.records, addHarvestRecord);
                await run("observations", prepared.observations.records, addFieldObservation);
                await refresh();
              } finally {
                setImporting(false);
              }
              const failedTotal = Object.values(failures).reduce((a, b) => a + b, 0);
              if (failedTotal === 0) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert("Import Complete", `${imported} records imported.`);
              } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                const detail = Object.entries(failures).map(([k, n]) => `• ${n} ${k}`).join("\n");
                Alert.alert(
                  "Import Partly Complete",
                  `${imported} imported, ${failedTotal} failed:\n${detail}\n\nFirst error: ${firstError}\n\nThe imported records were saved. Import the same file again to retry only the missing ones; records already saved are skipped.`
                );
              }
            },
          },
        ]
      );
    } catch {
      Alert.alert("Error", "Could not open the file picker.");
      setImporting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="arrow-back" size={24} color={COLORS.text} /></Pressable>
        <Text style={styles.headerTitle}>Import & Export</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + 40 }]} showsVerticalScrollIndicator={false}>

        {/* Farm context banner */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
          <Text style={styles.infoText}>{activeFarm?.name || "This farm"} · {activeSeason?.season_name || "Current season"}</Text>
        </View>

        {/* Export section */}
        <Text style={styles.sectionLabel}>Export Data</Text>
        <Pressable
          style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.85 }, !!exporting && styles.cardDimmed]}
          onPress={exportFullJson}
          disabled={!!exporting || importing}
        >
          <View style={[styles.actionIcon, { backgroundColor: COLORS.primary + "18" }]}>
            <Ionicons name={exporting === "json" ? "hourglass-outline" : "server-outline"} size={24} color={COLORS.primary} />
          </View>
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>Full Backup (JSON)</Text>
            <Text style={styles.actionSubtitle}>All costs, logs, inventory, observations, harvest</Text>
            <Text style={styles.actionCount}>{costs.length + activityLogs.length + inventory.length + observations.length + harvestRecords.length} records</Text>
          </View>
          <View style={styles.actionRight}>
            {exporting === "json"
              ? <Text style={[styles.actionStatus, { color: COLORS.primary }]}>Preparing…</Text>
              : <Ionicons name="share-outline" size={20} color={COLORS.primary} />
            }
          </View>
        </Pressable>

        {/* Import section */}
        <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Import Data</Text>

        <View style={styles.importNote}>
          <Ionicons name="alert-circle-outline" size={16} color={COLORS.amber} />
          <Text style={styles.importNoteText}>
            Import adds records to the current farm and season. It does not delete existing data. Importing the same file twice will create duplicates.
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.85 }, importing && styles.cardDimmed]}
          onPress={importFromJson}
          disabled={!!exporting || importing}
        >
          <View style={[styles.actionIcon, { backgroundColor: COLORS.blue + "18" }]}>
            <Ionicons name={importing ? "hourglass-outline" : "cloud-download-outline"} size={24} color={COLORS.blue} />
          </View>
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>Restore from Backup</Text>
            <Text style={styles.actionSubtitle}>Pick a JSON backup file to import records</Text>
            <Text style={styles.actionCount}>Costs · logs · inventory · harvest · observations</Text>
          </View>
          <View style={styles.actionRight}>
            {importing
              ? <Text style={[styles.actionStatus, { color: COLORS.blue }]}>Working…</Text>
              : <Ionicons name="folder-open-outline" size={20} color={COLORS.blue} />
            }
          </View>
        </Pressable>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.cardBg },
  headerTitle: { fontFamily: "Manrope_700Bold", fontSize: 18, color: COLORS.text },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  sectionLabel: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 13,
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoCard: { flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: COLORS.primarySurface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.primary + "30" },
  infoText: {
    flex: 1,
    fontFamily: "Manrope_400Regular",
    fontSize: 14,
    color: COLORS.primary,
    lineHeight: 19,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 16,
    ...CARD_SHADOW,
  },
  cardDimmed: { opacity: 0.45 },
  actionIcon: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  actionInfo: { flex: 1, gap: 2 },
  actionTitle: {
    fontFamily: "Manrope_700Bold",
    fontSize: 16,
    color: COLORS.text,
  },
  actionSubtitle: {
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  actionCount: {
    fontFamily: "Manrope_500Medium",
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  actionRight: { alignItems: "center", justifyContent: "center", minWidth: 60 },
  actionStatus: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 13,
  },
  importNote: { flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: COLORS.amberLight, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: COLORS.amber + "40" },
  importNoteText: {
    flex: 1,
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
    color: COLORS.amberDark,
    lineHeight: 18,
  }});
