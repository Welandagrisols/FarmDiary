import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform, Alert, TextInput,
} from "react-native";
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

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function normalizeKey(k: string): string {
  return k.trim().toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

async function importRows(
  rows: Record<string, string>[],
  seasonId: string
): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;
  const today = new Date().toISOString().split("T")[0];

  for (const row of rows) {
    const kind = (row.type || row.record_type || row.table || "").toLowerCase();

    const isCostRow = kind === "cost" || (!kind && row.date && row.description && row.amount);
    const isInventoryRow = kind === "inventory" || (!kind && row.product && row.qty && row.unit_price);
    const isHarvestRow = kind === "harvest" || (!kind && row.bags && row.price_per_bag);
    const isActivityRow = kind === "activity" || (!kind && row.activity && row.date);
    const isObsRow = kind === "observation" || (!kind && row.description && row.severity);

    try {
      if (isCostRow) {
        await addCost({
          farm_id: FARM_SEED.id,
          season_id: seasonId,
          section_id: row.section === "a" ? "section-a" : row.section === "b" ? "section-b" : null,
          cost_category: row.category || "Inputs",
          cost_subcategory: row.subcategory || "General",
          description: row.description || "Imported cost",
          cost_date: row.date || today,
          is_pre_planting: (row.pre_planting || "").toLowerCase() === "yes",
          is_historical: true,
          amount_kes: parseFloat(row.amount || row.amount_kes || "0") || 0,
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
        imported++;
      } else if (isInventoryRow) {
        await addInventoryItem({
          farm_id: FARM_SEED.id,
          season_id: seasonId,
          product_name: row.product || row.product_name || "Imported item",
          category: row.category || "Inputs",
          quantity_purchased: parseFloat(row.qty || row.quantity_purchased || "0") || 0,
          unit: row.unit || "kg",
          unit_price_kes: parseFloat(row.unit_price || row.unit_price_kes || "0") || 0,
          quantity_used: parseFloat(row.used || row.quantity_used || "0") || 0,
          purchase_date: row.date || row.purchase_date || today,
          supplier: row.supplier || null,
          low_stock_threshold: null,
          is_historical: true,
          notes: row.notes || null,
        });
        imported++;
      } else if (isHarvestRow) {
        const bags = parseFloat(row.bags || "0") || 0;
        const kgPerBag = parseFloat(row.kg_per_bag || "0") || 0;
        const pricePerBag = parseFloat(row.price_per_bag || "0") || 0;
        await addHarvestRecord({
          farm_id: FARM_SEED.id,
          season_id: seasonId,
          section_id: row.section === "b" ? "section-b" : "section-a",
          harvest_date: row.date || row.harvest_date || today,
          bags,
          kg_per_bag: kgPerBag,
          total_kg: parseFloat(row.total_kg || "0") || bags * kgPerBag,
          price_per_bag_kes: pricePerBag,
          total_revenue_kes: parseFloat(row.revenue || row.total_revenue_kes || "0") || bags * pricePerBag,
          buyer: row.buyer || null,
          notes: row.notes || null,
        });
        imported++;
      } else if (isActivityRow) {
        await addActivityLog({
          farm_id: FARM_SEED.id,
          season_id: seasonId,
          section_id: row.section === "b" ? "section-b" : row.section === "a" ? "section-a" : null,
          schedule_activity_id: null,
          activity_name: row.activity || row.activity_name || "Imported activity",
          planned_date: row.planned_date || null,
          actual_date: row.date || row.actual_date || today,
          products_used: [],
          is_deviation: false,
          deviation_reason: null,
          num_workers: parseInt(row.workers || row.num_workers || "0") || 0,
          labor_cost_kes: parseFloat(row.labor_cost || "0") || 0,
          total_cost_kes: parseFloat(row.total_cost || "0") || 0,
          weather_conditions: null,
          is_historical: true,
          notes: row.notes || null,
        });
        imported++;
      } else if (isObsRow) {
        await addObservation({
          farm_id: FARM_SEED.id,
          season_id: seasonId,
          section_id: row.section === "b" ? "section-b" : row.section === "a" ? "section-a" : null,
          observation_date: row.date || row.observation_date || today,
          observation_type: row.observation_type || "General",
          description: row.description || "Imported observation",
          severity: row.severity || "Medium",
          action_taken: row.action_taken || null,
          is_historical: true,
        });
        imported++;
      } else {
        skipped++;
      }
    } catch {
      skipped++;
    }
  }
  return { imported, skipped };
}

export default function ExportScreen() {
  const insets = useSafeAreaInsets();
  const { costs, activityLogs, inventory, observations, harvestRecords, seasonId, refresh, activeSeason } = useFarm();
  const [exporting, setExporting] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [showImportHelp, setShowImportHelp] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pickingFile, setPickingFile] = useState(false);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[] | null>(null);
  const [previewFilename, setPreviewFilename] = useState("");

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
      await shareFile(`farm-costs-${today}.csv`, rowsToCsv(headers, rows), "text/csv");
    } catch {
      Alert.alert("Error", "Could not export costs.");
    } finally {
      setExporting(null);
    }
  };

  const exportActivitiesCsv = async () => {
    setExporting("activities");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const headers = ["Date", "Activity", "Section", "Workers", "Labor Cost (KES)", "Products Cost (KES)", "Total Cost (KES)", "Weather", "Deviation", "Notes"];
      const rows = activityLogs.map((l) => [
        l.actual_date, l.activity_name,
        l.section_id === "section-a" ? "Section A" : l.section_id === "section-b" ? "Section B" : "Both",
        l.num_workers, l.labor_cost_kes, l.total_cost_kes - l.labor_cost_kes, l.total_cost_kes,
        l.weather_conditions, l.is_deviation ? "Yes" : "No", l.notes,
      ]);
      await shareFile(`farm-activities-${today}.csv`, rowsToCsv(headers, rows), "text/csv");
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
      const headers = ["Product", "Category", "Qty Purchased", "Unit", "Unit Price (KES)", "Total Value (KES)", "Qty Used", "Remaining", "Purchase Date", "Supplier", "Notes"];
      const rows = inventory.map((i) => {
        const remaining = i.quantity_purchased - (i.quantity_used || 0);
        return [i.product_name, i.category, i.quantity_purchased, i.unit, i.unit_price_kes,
          i.quantity_purchased * i.unit_price_kes, i.quantity_used, remaining, i.purchase_date, i.supplier, i.notes];
      });
      await shareFile(`farm-inventory-${today}.csv`, rowsToCsv(headers, rows), "text/csv");
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
      await shareFile(`farm-diary-backup-${today}.json`, JSON.stringify(payload, null, 2), "application/json");
    } catch {
      Alert.alert("Error", "Could not export backup.");
    } finally {
      setExporting(null);
    }
  };

  const parseCsvText = (text: string): Record<string, string>[] => {
    const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
    const headers = parseCsvLine(headerLine).map(normalizeKey);
    return lines.map((line) => {
      const values = parseCsvLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = (values[i] ?? "").trim(); });
      return row;
    }).filter((row) => Object.values(row).some((v) => v !== ""));
  };

  const parseXlsxToRows = (base64Data: string): Record<string, string>[] => {
    const workbook = XLSX.read(base64Data, { type: "base64" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    return raw.map((r) => {
      const row: Record<string, string> = {};
      for (const k of Object.keys(r)) {
        row[normalizeKey(k)] = String(r[k] ?? "").trim();
      }
      return row;
    }).filter((row) => Object.values(row).some((v) => v !== ""));
  };

  const handlePickFile = async () => {
    setPickingFile(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "text/csv",
          "text/comma-separated-values",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const filename = asset.name || "upload";
      const uri = asset.uri;

      let rows: Record<string, string>[] = [];

      if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        rows = parseXlsxToRows(base64);
      } else {
        const text = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
        rows = parseCsvText(text);
      }

      if (rows.length === 0) {
        Alert.alert("Nothing found", "The file appears to be empty or has no recognisable columns.");
        return;
      }

      setPreviewRows(rows);
      setPreviewFilename(filename);
    } catch {
      Alert.alert("Error", "Could not read the file. Make sure it is a valid Excel or CSV file.");
    } finally {
      setPickingFile(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewRows) return;
    setImporting(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const { imported, skipped } = await importRows(previewRows, seasonId);
      await refresh();
      setPreviewRows(null);
      setPreviewFilename("");
      Alert.alert(
        "Import complete",
        `${imported} record${imported === 1 ? "" : "s"} imported into ${activeSeason?.season_name || "the active season"}.${skipped > 0 ? `\n${skipped} row${skipped === 1 ? "" : "s"} skipped (unrecognised).` : ""}`
      );
    } catch {
      Alert.alert("Import failed", "Something went wrong. Check the data and try again.");
    } finally {
      setImporting(false);
    }
  };

  const handleImportCsvText = async () => {
    const text = importText.trim();
    if (!text) { Alert.alert("Paste data", "Paste CSV data first."); return; }
    setImporting(true);
    try {
      const rows = parseCsvText(text);
      const { imported, skipped } = await importRows(rows, seasonId);
      await refresh();
      setImportText("");
      Alert.alert(
        "Imported",
        `${imported} record${imported === 1 ? "" : "s"} added.${skipped > 0 ? ` ${skipped} row${skipped === 1 ? "" : "s"} skipped.` : ""}`
      );
    } catch {
      Alert.alert("Import failed", "Make sure the CSV is valid.");
    } finally {
      setImporting(false);
    }
  };

  const totalSpent = costs.reduce((s, c) => s + c.amount_kes, 0);

  const EXPORTS = [
    { key: "costs", icon: "wallet-outline", title: "Cost Ledger", subtitle: "All spending entries as a spreadsheet", count: `${costs.length} entries · ${formatKES(totalSpent)}`, color: COLORS.primary, onPress: exportCostsCsv },
    { key: "activities", icon: "clipboard-outline", title: "Activity Log", subtitle: "All logged field activities", count: `${activityLogs.length} activities`, color: COLORS.teal, onPress: exportActivitiesCsv },
    { key: "inventory", icon: "flask-outline", title: "Inventory", subtitle: "Products, stock levels and usage", count: `${inventory.length} products`, color: COLORS.amber, onPress: exportInventoryCsv },
    { key: "json", icon: "server-outline", title: "Full Backup (JSON)", subtitle: "Complete data backup — all tables", count: `${costs.length + activityLogs.length + inventory.length + observations.length} records`, color: COLORS.red, onPress: exportFullJson },
  ];

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Import & Export</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── IMPORT SECTION ── */}
        <Text style={styles.sectionLabel}>Import Data</Text>

        {previewRows ? (
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
              <Text style={styles.previewTitle}>{previewFilename}</Text>
            </View>
            <Text style={styles.previewSub}>{previewRows.length} rows found — columns detected:</Text>
            <Text style={styles.previewCols} numberOfLines={3}>
              {Object.keys(previewRows[0] || {}).join(", ")}
            </Text>
            <View style={styles.previewRows}>
              {previewRows.slice(0, 3).map((row, i) => (
                <View key={i} style={styles.previewRow}>
                  {Object.entries(row).slice(0, 4).map(([k, v]) => (
                    <Text key={k} style={styles.previewCell} numberOfLines={1}><Text style={styles.previewKey}>{k}:</Text> {v}</Text>
                  ))}
                </View>
              ))}
              {previewRows.length > 3 && <Text style={styles.previewMore}>+{previewRows.length - 3} more rows…</Text>}
            </View>
            <View style={styles.previewActions}>
              <Pressable style={styles.cancelBtn} onPress={() => { setPreviewRows(null); setPreviewFilename(""); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.confirmBtn, importing && { opacity: 0.6 }]} onPress={handleConfirmImport} disabled={importing}>
                <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.white} />
                <Text style={styles.confirmBtnText}>{importing ? "Importing…" : `Import ${previewRows.length} rows`}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.importCard}>
            <Pressable
              style={({ pressed }) => [styles.pickBtn, (pickingFile || importing) && { opacity: 0.6 }, pressed && { opacity: 0.8 }]}
              onPress={handlePickFile}
              disabled={pickingFile || importing}
            >
              <Ionicons name="document-attach-outline" size={22} color={COLORS.white} />
              <View style={styles.pickBtnText}>
                <Text style={styles.pickBtnTitle}>{pickingFile ? "Opening…" : "Pick Excel or CSV file"}</Text>
                <Text style={styles.pickBtnSub}>.xlsx · .xls · .csv — straight from Files, WhatsApp, email</Text>
              </View>
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or paste CSV</Text>
              <View style={styles.dividerLine} />
            </View>

            <TextInput
              value={importText}
              onChangeText={setImportText}
              placeholder={"type,date,description,amount\ncost,2026-02-01,Seed purchase,12000"}
              placeholderTextColor={COLORS.textMuted}
              multiline
              style={styles.importInput}
            />

            <Pressable style={styles.helpBtn} onPress={() => setShowImportHelp((v) => !v)}>
              <Ionicons name="information-circle-outline" size={14} color={COLORS.primary} />
              <Text style={styles.helpBtnText}>{showImportHelp ? "Hide column guide" : "Show column guide"}</Text>
            </Pressable>

            {showImportHelp ? (
              <View style={styles.helpCard}>
                <Text style={styles.helpTitle}>Column names the app recognises</Text>
                {[
                  ["Costs", "type=cost · date · description · amount · category · subcategory · section (a/b) · qty · unit · unit_price · product · supplier · workers · days · rate · notes"],
                  ["Inventory", "type=inventory · product · category · qty · unit · unit_price · used · date · supplier · notes"],
                  ["Harvest", "type=harvest · date · bags · kg_per_bag · price_per_bag · revenue · section (a/b) · buyer · notes"],
                  ["Activities", "type=activity · date · activity · section (a/b) · workers · labor_cost · total_cost · notes"],
                  ["Observations", "type=observation · date · description · severity · observation_type · section (a/b) · action_taken"],
                ].map(([label, cols]) => (
                  <View key={label} style={styles.helpRow}>
                    <Text style={styles.helpRowLabel}>{label}</Text>
                    <Text style={styles.helpRowCols}>{cols}</Text>
                  </View>
                ))}
                <Text style={styles.helpNote}>If no type column — rows with date+description+amount are imported as costs automatically.</Text>
              </View>
            ) : null}

            {importText.trim() ? (
              <Pressable style={[styles.importTextBtn, importing && { opacity: 0.6 }]} onPress={handleImportCsvText} disabled={importing}>
                <Text style={styles.importTextBtnLabel}>{importing ? "Importing…" : "Import pasted CSV"}</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        {/* ── EXPORT SECTION ── */}
        <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Export Data</Text>

        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
          <Text style={styles.infoText}>
            {Platform.OS === "web"
              ? "Files download directly to your device."
              : "Files open your phone's share sheet — send via WhatsApp, email, Google Drive, or save to Files."}
          </Text>
        </View>

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
                <Ionicons name={(isLoading ? "hourglass-outline" : item.icon) as any} size={24} color={item.color} />
              </View>
              <View style={styles.exportInfo}>
                <Text style={styles.exportTitle}>{item.title}</Text>
                <Text style={styles.exportSubtitle}>{item.subtitle}</Text>
                <Text style={styles.exportCount}>{item.count}</Text>
              </View>
              <View style={styles.exportArrow}>
                {isLoading
                  ? <Text style={[styles.exportingText, { color: item.color }]}>Preparing…</Text>
                  : <Ionicons name="share-outline" size={20} color={item.color} />}
              </View>
            </Pressable>
          );
        })}

        <View style={styles.note}>
          <Text style={styles.noteTitle}>CSV files</Text>
          <Text style={styles.noteText}>Open in Microsoft Excel, Google Sheets, or Apple Numbers.</Text>
          <Text style={[styles.noteTitle, { marginTop: 10 }]}>JSON backup</Text>
          <Text style={styles.noteText}>Used to restore data if you reinstall or move to a new phone.</Text>
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
  scrollContent: { padding: 16, gap: 12, paddingBottom: 80 },
  sectionLabel: { fontFamily: "DMSans_600SemiBold", fontSize: 12, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  importCard: { backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 16, gap: 12, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  pickBtn: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.primary, borderRadius: 14, padding: 16 },
  pickBtnText: { flex: 1, gap: 3 },
  pickBtnTitle: { fontFamily: "DMSans_700Bold", fontSize: 15, color: COLORS.white },
  pickBtnSub: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.white + "CC" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.borderLight },
  dividerText: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textMuted },
  importInput: { minHeight: 100, borderRadius: 12, borderWidth: 1, borderColor: COLORS.borderLight, padding: 12, textAlignVertical: "top", fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.text, backgroundColor: COLORS.background },
  helpBtn: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start" },
  helpBtnText: { fontFamily: "DMSans_500Medium", fontSize: 12, color: COLORS.primary },
  helpCard: { backgroundColor: COLORS.primarySurface, borderRadius: 12, padding: 12, gap: 8, borderWidth: 1, borderColor: COLORS.primary + "20" },
  helpTitle: { fontFamily: "DMSans_600SemiBold", fontSize: 12, color: COLORS.primary, marginBottom: 4 },
  helpRow: { gap: 2 },
  helpRowLabel: { fontFamily: "DMSans_600SemiBold", fontSize: 12, color: COLORS.text },
  helpRowCols: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textSecondary, lineHeight: 16 },
  helpNote: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textMuted, marginTop: 4, fontStyle: "italic" },
  importTextBtn: { backgroundColor: COLORS.primary, borderRadius: 12, alignItems: "center", paddingVertical: 13 },
  importTextBtnLabel: { fontFamily: "DMSans_700Bold", fontSize: 14, color: COLORS.white },
  previewCard: { backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 16, gap: 10, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: COLORS.primary + "30" },
  previewHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  previewTitle: { fontFamily: "DMSans_700Bold", fontSize: 15, color: COLORS.text, flex: 1 },
  previewSub: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary },
  previewCols: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textMuted, lineHeight: 16 },
  previewRows: { gap: 6, backgroundColor: COLORS.background, borderRadius: 10, padding: 10 },
  previewRow: { gap: 2, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  previewCell: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.text },
  previewKey: { fontFamily: "DMSans_600SemiBold", color: COLORS.primary },
  previewMore: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  previewActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, alignItems: "center", paddingVertical: 12 },
  cancelBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 14, color: COLORS.textSecondary },
  confirmBtn: { flex: 2, flexDirection: "row", gap: 8, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  confirmBtnText: { fontFamily: "DMSans_700Bold", fontSize: 14, color: COLORS.white },
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
  note: { backgroundColor: COLORS.cardBg, borderRadius: 12, padding: 14, marginTop: 4 },
  noteTitle: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.text, marginBottom: 2 },
  noteText: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary },
});
