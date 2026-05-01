import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useFarm } from "@/context/FarmContext";
import COLORS from "@/constants/colors";
import { formatKES, formatDate } from "@/lib/storage";
import * as Haptics from "expo-haptics";

function escapeCsv(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function rowsToCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const headerLine = headers.map(escapeCsv).join(",");
  const dataLines = rows.map((r) => r.map(escapeCsv).join(","));
  return [headerLine, ...dataLines].join("\n");
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
  const { costs, activityLogs, inventory, observations, harvestRecords } = useFarm();
  const [exporting, setExporting] = useState<string | null>(null);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const today = new Date().toISOString().split("T")[0];

  const exportCostsCsv = async () => {
    setExporting("costs");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const headers = ["Date", "Description", "Category", "Subcategory", "Section", "Amount (KES)",
        "Qty", "Unit", "Unit Price", "Product", "Supplier", "Workers", "Days", "Rate/Day", "Historical", "Notes"];
      const rows = costs.map((c) => [
        c.cost_date, c.description, c.cost_category, c.cost_subcategory,
        c.section_id === "section-a" ? "Section A" : c.section_id === "section-b" ? "Section B" : "Both",
        c.amount_kes, c.quantity, c.unit, c.unit_price_kes,
        c.product_name, c.supplier, c.num_workers, c.days_worked, c.rate_per_worker_per_day,
        c.is_historical ? "Yes" : "No", c.notes,
      ]);
      const csv = rowsToCsv(headers, rows);
      await shareFile(`farm-costs-${today}.csv`, csv, "text/csv");
    } catch (e) {
      Alert.alert("Error", "Could not export costs.");
    } finally {
      setExporting(null);
    }
  };

  const exportActivitiesCsv = async () => {
    setExporting("activities");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const headers = ["Date", "Activity", "Section", "Workers", "Labor Cost (KES)",
        "Products Cost (KES)", "Total Cost (KES)", "Weather", "Deviation", "Notes"];
      const rows = activityLogs.map((l) => {
        const productsCost = l.total_cost_kes - l.labor_cost_kes;
        return [
          l.actual_date, l.activity_name,
          l.section_id === "section-a" ? "Section A" : l.section_id === "section-b" ? "Section B" : "Both",
          l.num_workers, l.labor_cost_kes, productsCost, l.total_cost_kes,
          l.weather_conditions, l.is_deviation ? "Yes" : "No", l.notes,
        ];
      });
      const csv = rowsToCsv(headers, rows);
      await shareFile(`farm-activities-${today}.csv`, csv, "text/csv");
    } catch {
      Alert.alert("Error", "Could not export activities.");
    } finally {
      setExporting(null);
    }
  };

  const exportInventoryCsv = async () => {
    setExporting("inventory");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const headers = ["Product", "Category", "Qty Purchased", "Unit", "Unit Price (KES)",
        "Total Value (KES)", "Qty Used", "Remaining", "Purchase Date", "Supplier", "Notes"];
      const rows = inventory.map((i) => {
        const remaining = i.quantity_purchased - (i.quantity_used || 0);
        return [
          i.product_name, i.category, i.quantity_purchased, i.unit, i.unit_price_kes,
          i.quantity_purchased * i.unit_price_kes, i.quantity_used, remaining,
          i.purchase_date, i.supplier, i.notes,
        ];
      });
      const csv = rowsToCsv(headers, rows);
      await shareFile(`farm-inventory-${today}.csv`, csv, "text/csv");
    } catch {
      Alert.alert("Error", "Could not export inventory.");
    } finally {
      setExporting(null);
    }
  };

  const exportFullJson = async () => {
    setExporting("json");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const payload = {
        exported_at: new Date().toISOString(),
        farm: "Rift Valley Potato Farm",
        season: "Long Rains 2026",
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
      const json = JSON.stringify(payload, null, 2);
      await shareFile(`farm-diary-backup-${today}.json`, json, "application/json");
    } catch {
      Alert.alert("Error", "Could not export backup.");
    } finally {
      setExporting(null);
    }
  };

  const totalSpent = costs.reduce((s, c) => s + c.amount_kes, 0);

  const EXPORTS: {
    key: string;
    icon: string;
    title: string;
    subtitle: string;
    count: string;
    color: string;
    onPress: () => void;
  }[] = [
    {
      key: "costs",
      icon: "wallet-outline",
      title: "Cost Ledger",
      subtitle: "All spending entries as a spreadsheet",
      count: `${costs.length} entries · ${formatKES(totalSpent)}`,
      color: COLORS.primary,
      onPress: exportCostsCsv,
    },
    {
      key: "activities",
      icon: "clipboard-outline",
      title: "Activity Log",
      subtitle: "All logged field activities",
      count: `${activityLogs.length} activities`,
      color: COLORS.teal,
      onPress: exportActivitiesCsv,
    },
    {
      key: "inventory",
      icon: "flask-outline",
      title: "Inventory",
      subtitle: "Products, stock levels and usage",
      count: `${inventory.length} products`,
      color: COLORS.amber,
      onPress: exportInventoryCsv,
    },
    {
      key: "json",
      icon: "server-outline",
      title: "Full Backup (JSON)",
      subtitle: "Complete data backup — all tables",
      count: `${costs.length + activityLogs.length + inventory.length + observations.length} records`,
      color: COLORS.red,
      onPress: exportFullJson,
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Export Data</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
          <Text style={styles.infoText}>
            {Platform.OS === "web"
              ? "Files download directly to your device."
              : "Files open your phone's share sheet — send via WhatsApp, email, Google Drive, or save to Files."}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Choose what to export</Text>

        {EXPORTS.map((item) => {
          const isLoading = exporting === item.key;
          return (
            <Pressable
              key={item.key}
              style={({ pressed }) => [styles.exportCard, pressed && { opacity: 0.85 }, !!exporting && exporting !== item.key && styles.cardDimmed]}
              onPress={item.onPress}
              disabled={!!exporting}
            >
              <View style={[styles.exportIcon, { backgroundColor: item.color + "18" }]}>
                <Ionicons name={isLoading ? "hourglass-outline" : item.icon as any} size={24} color={item.color} />
              </View>
              <View style={styles.exportInfo}>
                <Text style={styles.exportTitle}>{item.title}</Text>
                <Text style={styles.exportSubtitle}>{item.subtitle}</Text>
                <Text style={styles.exportCount}>{item.count}</Text>
              </View>
              <View style={styles.exportArrow}>
                {isLoading ? (
                  <Text style={[styles.exportingText, { color: item.color }]}>Preparing...</Text>
                ) : (
                  <Ionicons name="share-outline" size={20} color={item.color} />
                )}
              </View>
            </Pressable>
          );
        })}

        <View style={styles.note}>
          <Text style={styles.noteTitle}>CSV files</Text>
          <Text style={styles.noteText}>Open in Microsoft Excel, Google Sheets, or Apple Numbers.</Text>
          <Text style={[styles.noteTitle, { marginTop: 10 }]}>JSON backup</Text>
          <Text style={styles.noteText}>Used to restore data if you reinstall the app or move to a new phone.</Text>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontFamily: "DMSans_700Bold", fontSize: 18, color: COLORS.text },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 60 },
  infoCard: {
    flexDirection: "row", gap: 10, alignItems: "flex-start",
    backgroundColor: COLORS.primarySurface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: COLORS.primary + "30",
  },
  infoText: { flex: 1, fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.primary, lineHeight: 19 },
  sectionLabel: {
    fontFamily: "DMSans_600SemiBold", fontSize: 12, color: COLORS.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4,
  },
  exportCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 16,
    shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  cardDimmed: { opacity: 0.45 },
  exportIcon: {
    width: 52, height: 52, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  exportInfo: { flex: 1, gap: 2 },
  exportTitle: { fontFamily: "DMSans_700Bold", fontSize: 15, color: COLORS.text },
  exportSubtitle: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary },
  exportCount: { fontFamily: "DMSans_500Medium", fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  exportArrow: { alignItems: "center", justifyContent: "center", minWidth: 70 },
  exportingText: { fontFamily: "DMSans_600SemiBold", fontSize: 12 },
  note: {
    backgroundColor: COLORS.cardBg, borderRadius: 12, padding: 14, marginTop: 8,
  },
  noteTitle: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.text, marginBottom: 2 },
  noteText: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary },
});
