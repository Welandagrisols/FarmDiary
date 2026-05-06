import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { useFarm } from "@/context/FarmContext";
import COLORS from "@/constants/colors";
import { formatKES, addCost, addInventoryItem, addHarvestRecord, addActivityLog, addFieldObservation } from "@/lib/storage";
import * as Haptics from "expo-haptics";

function escapeCsv(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}

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
      const payload = {
        exported_at: new Date().toISOString(),
        farm: activeFarm?.name || "Unknown farm",
        season: activeSeason?.season_name || "Unknown season",
        summary: {
          total_costs: costs.reduce((s, c) => s + c.amount_kes, 0),
          total_activities: activityLogs.length,
          total_harvest_bags: harvestRecords.reduce((s, r) => s + r.bags, 0),
          total_revenue: harvestRecords.reduce((s, r) => s + r.total_revenue_kes, 0),
        },
        costs,
        activity_logs: activityLogs,
        inventory,
        observations,
        harvest_records: harvestRecords,
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
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/plain", "*/*"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      setImporting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const fileUri = result.assets[0].uri;
      const rawText = await readPickedFile(fileUri);
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        Alert.alert("Invalid File", "The file could not be read as JSON. Please use a backup file exported from Farm Diary.");
        return;
      }

      if (!data.costs && !data.activity_logs && !data.inventory && !data.harvest_records && !data.observations) {
        Alert.alert("Invalid Backup", "This file does not look like a Farm Diary backup. Expected fields: costs, activity_logs, inventory, harvest_records, observations.");
        return;
      }

      const importCosts: any[] = Array.isArray(data.costs) ? data.costs : [];
      const importLogs: any[] = Array.isArray(data.activity_logs) ? data.activity_logs : [];
      const importInventory: any[] = Array.isArray(data.inventory) ? data.inventory : [];
      const importHarvest: any[] = Array.isArray(data.harvest_records) ? data.harvest_records : [];
      const importObs: any[] = Array.isArray(data.observations) ? data.observations : [];

      const totalRecords = importCosts.length + importLogs.length + importInventory.length + importHarvest.length + importObs.length;

      Alert.alert(
        "Import Backup",
        `This backup contains:\n• ${importCosts.length} cost entries\n• ${importLogs.length} activity logs\n• ${importInventory.length} inventory items\n• ${importHarvest.length} harvest records\n• ${importObs.length} observations\n\nAll records will be imported into the current farm and season. Duplicates may appear if you import the same file twice.`,
        [
          { text: "Cancel", style: "cancel", onPress: () => setImporting(false) },
          {
            text: `Import ${totalRecords} records`,
            onPress: async () => {
              try {
                let imported = 0;

                for (const c of importCosts) {
                  try {
                    await addCost({ ...c, farm_id: farmId, season_id: seasonId, id: undefined });
                    imported++;
                  } catch {}
                }
                for (const l of importLogs) {
                  try {
                    await addActivityLog({ ...l, farm_id: farmId, season_id: seasonId, id: undefined }, []);
                    imported++;
                  } catch {}
                }
                for (const item of importInventory) {
                  try {
                    await addInventoryItem({ ...item, farm_id: farmId, season_id: seasonId, id: undefined });
                    imported++;
                  } catch {}
                }
                for (const h of importHarvest) {
                  try {
                    await addHarvestRecord({ ...h, farm_id: farmId, season_id: seasonId, id: undefined });
                    imported++;
                  } catch {}
                }
                for (const o of importObs) {
                  try {
                    await addFieldObservation({ ...o, farm_id: farmId, season_id: seasonId, id: undefined });
                    imported++;
                  } catch {}
                }

                await refresh();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert("Import Complete", `${imported} of ${totalRecords} records imported successfully.`);
              } catch (err) {
                Alert.alert("Import Failed", "An error occurred while importing. Some records may have been saved.");
              } finally {
                setImporting(false);
              }
            },
          },
        ]
      );
    } catch (err) {
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
  headerTitle: { fontFamily: "DMSans_700Bold", fontSize: 18, color: COLORS.text },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  sectionLabel: { fontFamily: "DMSans_600SemiBold", fontSize: 12, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  infoCard: { flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: COLORS.primarySurface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.primary + "30" },
  infoText: { flex: 1, fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.primary, lineHeight: 19 },
  actionCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 16, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardDimmed: { opacity: 0.45 },
  actionIcon: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  actionInfo: { flex: 1, gap: 2 },
  actionTitle: { fontFamily: "DMSans_700Bold", fontSize: 15, color: COLORS.text },
  actionSubtitle: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary },
  actionCount: { fontFamily: "DMSans_500Medium", fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  actionRight: { alignItems: "center", justifyContent: "center", minWidth: 60 },
  actionStatus: { fontFamily: "DMSans_600SemiBold", fontSize: 12 },
  importNote: { flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: COLORS.amberLight, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: COLORS.amber + "40" },
  importNoteText: { flex: 1, fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.amberDark, lineHeight: 18 },
});
