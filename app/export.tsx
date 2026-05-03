import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform, Alert, TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useFarm } from "@/context/FarmContext";
import COLORS from "@/constants/colors";
import { formatKES, formatDate, addCost, addInventoryItem, addHarvestRecord, addActivityLog, addObservation } from "@/lib/storage";
import * as Haptics from "expo-haptics";
import { FARM_SEED } from "@/constants/farmData";

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
  const { costs, activityLogs, inventory, observations, harvestRecords, seasonId, refresh, activeSeason } = useFarm();
  const [exporting, setExporting] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState("");
  const [showImportHelp, setShowImportHelp] = useState(false);

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

  const importCsv = async () => {
    const text = importText.trim();
    if (!text) {
      Alert.alert("Paste data", "Paste CSV data first.");
      return;
    }
    setImporting(true);
    try {
      const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
      const headers = headerLine.split(",").map((h) => h.trim().toLowerCase());
      let imported = 0;
      for (const line of lines) {
        const values = line.split(",");
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h] = (values[i] ?? "").trim(); });
        const kind = (row.type || row.record_type || row.table || "").toLowerCase();
        if (kind === "cost") {
          await addCost({
            farm_id: FARM_SEED.id,
            season_id: seasonId,
            section_id: null,
            cost_category: row.category || "Inputs",
            cost_subcategory: row.subcategory || "General",
            description: row.description || "Imported cost",
            cost_date: row.date || new Date().toISOString().split("T")[0],
            is_pre_planting: (row.pre_planting || "").toLowerCase() === "yes",
            is_historical: true,
            amount_kes: parseFloat(row.amount || "0") || 0,
            quantity: row.qty ? parseFloat(row.qty) : null,
            unit: row.unit || null,
            unit_price_kes: row.unit_price ? parseFloat(row.unit_price) : null,
            product_name: row.product || null,
            supplier: row.supplier || null,
            receipt_reference: row.receipt || null,
            num_workers: row.workers ? parseInt(row.workers) : null,
            days_worked: row.days ? parseFloat(row.days) : null,
            rate_per_worker_per_day: row.rate ? parseFloat(row.rate) : null,
            facilitator_name: row.facilitator || null,
            trip_from: row.from || null,
            trip_to: row.to || null,
            is_deviation: false,
            planned_product: null,
            deviation_reason: null,
            notes: row.notes || null,
            weather_conditions: null,
          });
          imported += 1;
        } else if (kind === "inventory") {
          await addInventoryItem({
            farm_id: FARM_SEED.id,
            season_id: seasonId,
            product_name: row.product || "Imported item",
            category: row.category || "Inputs",
            quantity_purchased: parseFloat(row.qty || "0") || 0,
            unit: row.unit || "kg",
            unit_price_kes: parseFloat(row.unit_price || "0") || 0,
            quantity_used: parseFloat(row.used || "0") || 0,
            purchase_date: row.date || new Date().toISOString().split("T")[0],
            supplier: row.supplier || null,
            low_stock_threshold: null,
            is_historical: true,
            notes: row.notes || null,
          });
          imported += 1;
        } else if (kind === "harvest") {
          await addHarvestRecord({
            farm_id: FARM_SEED.id,
            season_id: seasonId,
            section_id: row.section === "b" ? "section-b" : "section-a",
            harvest_date: row.date || new Date().toISOString().split("T")[0],
            bags: parseFloat(row.bags || "0") || 0,
            kg_per_bag: parseFloat(row.kg_per_bag || "0") || 0,
            total_kg: parseFloat(row.total_kg || "0") || 0,
            price_per_bag_kes: parseFloat(row.price_per_bag || "0") || 0,
            total_revenue_kes: parseFloat(row.revenue || "0") || 0,
            buyer: row.buyer || null,
            notes: row.notes || null,
          });
          imported += 1;
        } else if (kind === "activity") {
          await addActivityLog({
            farm_id: FARM_SEED.id,
            season_id: seasonId,
            section_id: row.section === "b" ? "section-b" : row.section === "a" ? "section-a" : null,
            schedule_activity_id: null,
            activity_name: row.activity || "Imported activity",
            planned_date: row.planned_date || null,
            actual_date: row.date || new Date().toISOString().split("T")[0],
            products_used: [],
            is_deviation: false,
            deviation_reason: null,
            num_workers: parseInt(row.workers || "0") || 0,
            labor_cost_kes: parseFloat(row.labor_cost || "0") || 0,
            total_cost_kes: parseFloat(row.total_cost || "0") || 0,
            weather_conditions: null,
            is_historical: true,
            notes: row.notes || null,
          });
          imported += 1;
        } else if (kind === "observation") {
          await addObservation({
            farm_id: FARM_SEED.id,
            season_id: seasonId,
            section_id: row.section === "b" ? "section-b" : row.section === "a" ? "section-a" : null,
            observation_date: row.date || new Date().toISOString().split("T")[0],
            observation_type: row.observation_type || "General",
            description: row.description || "Imported observation",
            severity: row.severity || "Medium",
            action_taken: row.action_taken || null,
            is_historical: true,
          });
          imported += 1;
        }
      }
      setImportText("");
      await refresh();
      Alert.alert("Imported", `${imported} record${imported === 1 ? "" : "s"} added to ${activeSeason?.season_name || "the active season"}.`);
    } catch {
      Alert.alert("Import failed", "Make sure the CSV has a type column and valid values.");
    } finally {
      setImporting(false);
    }
  };

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

      <View style={styles.importCard}>
        <View style={styles.importHeader}>
          <Ionicons name="cloud-upload-outline" size={18} color={COLORS.primary} />
          <Text style={styles.importTitle}>Upload Data</Text>
        </View>
        <Text style={styles.importText}>Paste CSV rows exported from Excel. Include a type column with cost, inventory, harvest, activity, or observation.</Text>
        <Pressable style={styles.helpBtn} onPress={() => setShowImportHelp((v) => !v)}>
          <Text style={styles.helpBtnText}>{showImportHelp ? "Hide example" : "Show example"}</Text>
        </Pressable>
        {showImportHelp ? <Text style={styles.exampleText}>type,date,description,amount{`\n`}cost,2026-02-01,Seed purchase,12000</Text> : null}
        <TextInput
          value={importText}
          onChangeText={setImportText}
          placeholder="Paste CSV here"
          placeholderTextColor={COLORS.textMuted}
          multiline
          style={styles.importInput}
        />
        <Pressable style={styles.importBtn} onPress={importCsv} disabled={importing}>
          <Text style={styles.importBtnText}>{importing ? "Importing..." : "Import CSV"}</Text>
        </Pressable>
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
  importCard: { backgroundColor: COLORS.cardBg, borderRadius: 12, padding: 14, gap: 10, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  importHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  importTitle: { fontFamily: "DMSans_700Bold", fontSize: 15, color: COLORS.text },
  importText: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary, lineHeight: 18 },
  helpBtn: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: COLORS.primarySurface },
  helpBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 12, color: COLORS.primary },
  exampleText: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textMuted },
  importInput: { minHeight: 120, borderRadius: 12, borderWidth: 1, borderColor: COLORS.borderLight, padding: 12, textAlignVertical: "top", fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.text, backgroundColor: COLORS.background },
  importBtn: { backgroundColor: COLORS.primary, borderRadius: 12, alignItems: "center", paddingVertical: 12 },
  importBtnText: { fontFamily: "DMSans_700Bold", fontSize: 14, color: COLORS.white },
});
