import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Alert, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import * as XLSX from "xlsx";
import { useFarm } from "@/context/FarmContext";
import COLORS from "@/constants/colors";
import { formatKES, addCost, addInventoryItem, addHarvestRecord, addActivityLog, addObservation } from "@/lib/storage";
import * as Haptics from "expo-haptics";

function escapeCsv(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}

function rowsToCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  return [headers.map(escapeCsv).join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n");
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

export default function ExportScreen() {
  const insets = useSafeAreaInsets();
  const { costs, activityLogs, inventory, observations, harvestRecords, seasonId, refresh, activeSeason, activeFarm, farmId } = useFarm();
  const [exporting, setExporting] = useState<string | null>(null);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
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

  const exportItems = [
    { key: "json", icon: "server-outline", title: "Full Backup (JSON)", subtitle: "Complete farm and season backup", count: `${costs.length + activityLogs.length + inventory.length + observations.length + harvestRecords.length} records`, color: COLORS.red, onPress: exportFullJson },
  ];

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="arrow-back" size={24} color={COLORS.text} /></Pressable>
        <Text style={styles.headerTitle}>Import & Export</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>Export Data</Text>
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
          <Text style={styles.infoText}>{activeFarm?.name || "This farm"} · {activeSeason?.season_name || "Current season"}</Text>
        </View>
        {exportItems.map((item) => {
          const isLoading = exporting === item.key;
          return (
            <Pressable key={item.key} style={({ pressed }) => [styles.exportCard, pressed && { opacity: 0.85 }, !!exporting && exporting !== item.key && styles.cardDimmed]} onPress={item.onPress} disabled={!!exporting}>
              <View style={[styles.exportIcon, { backgroundColor: item.color + "18" }]}><Ionicons name={(isLoading ? "hourglass-outline" : item.icon) as any} size={24} color={item.color} /></View>
              <View style={styles.exportInfo}>
                <Text style={styles.exportTitle}>{item.title}</Text>
                <Text style={styles.exportSubtitle}>{item.subtitle}</Text>
                <Text style={styles.exportCount}>{item.count}</Text>
              </View>
              <View style={styles.exportArrow}>{isLoading ? <Text style={[styles.exportingText, { color: item.color }]}>Preparing…</Text> : <Ionicons name="share-outline" size={20} color={item.color} />}</View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle: { fontFamily: "DMSans_700Bold", fontSize: 18, color: COLORS.text },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 80 },
  sectionLabel: { fontFamily: "DMSans_600SemiBold", fontSize: 12, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  infoCard: { flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: COLORS.primarySurface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.primary + "30" },
  infoText: { flex: 1, fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.primary, lineHeight: 19 },
  exportCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 16, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardDimmed: { opacity: 0.45 },
  exportIcon: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  exportInfo: { flex: 1, gap: 2 },
  exportTitle: { fontFamily: "DMSans_700Bold", fontSize: 15, color: COLORS.text },
  exportSubtitle: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary },
  exportCount: { fontFamily: "DMSans_500Medium", fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  exportArrow: { alignItems: "center", justifyContent: "center", minWidth: 70 },
  exportingText: { fontFamily: "DMSans_600SemiBold", fontSize: 12 },
});