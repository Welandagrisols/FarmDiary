import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFarm } from "@/context/FarmContext";
import COLORS from "@/constants/colors";
import { formatKES, ProductUsed } from "@/lib/storage";
import * as Haptics from "expo-haptics";

const WEATHER_OPTIONS = ["Sunny", "Cloudy", "Light Rain", "Heavy Rain"];
const UNIT_OPTIONS = ["L", "mL", "kg", "g", "pkt", "bottles", "bags"];

interface EditProductRow {
  name: string;
  qty: string;
  unit: string;
  unitPrice: string;
  isDeviation: boolean;
  actualProduct: string;
  deviationReason: string;
}

function weatherIcon(w: string): any {
  if (w === "Sunny") return "sunny-outline";
  if (w === "Cloudy") return "cloud-outline";
  if (w === "Light Rain") return "rainy-outline";
  return "thunderstorm-outline";
}

function formatDateFriendly(dateStr: string): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return `${days[d.getDay()]}, ${Number(parts[2])} ${months[d.getMonth()]} ${parts[0]}`;
}

function getQuickDates(): { label: string; value: string }[] {
  const result: { label: string; value: string }[] = [];
  const today = new Date();
  for (let i = 0; i <= 6; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const val = d.toISOString().split("T")[0];
    const label = i === 0 ? "Today" : i === 1 ? "Yesterday" : `${i}d ago`;
    result.push({ label, value: val });
  }
  return result;
}

export default function EditActivityScreen() {
  const insets = useSafeAreaInsets();
  const { logId } = useLocalSearchParams<{ logId: string }>();
  const { activityLogs, editActivityLog, removeActivityLog } = useFarm();

  const log = activityLogs.find((l) => l.id === logId);

  const [date, setDate] = useState(log?.actual_date ?? "");
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [weather, setWeather] = useState(log?.weather_conditions ?? "Sunny");
  const [numWorkers, setNumWorkers] = useState(String(log?.num_workers ?? 0));
  const [laborCost, setLaborCost] = useState(String(log?.labor_cost_kes ?? 0));
  const [products, setProducts] = useState<EditProductRow[]>(
    (log?.products_used ?? []).map((p) => ({
      name: p.name,
      qty: String(p.qty),
      unit: p.unit,
      unitPrice: String(p.unit_price),
      isDeviation: p.is_deviation,
      actualProduct: p.actual_product ?? "",
      deviationReason: p.deviation_reason ?? "",
    }))
  );
  const [notes, setNotes] = useState(log?.notes && log.notes !== "Quick-completed (no costs logged)" ? log.notes : "");
  const [saving, setSaving] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  if (!log) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Edit Activity</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={40} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>Activity not found.</Text>
        </View>
      </View>
    );
  }

  const addProduct = () => {
    setProducts((prev) => [
      ...prev,
      { name: "", qty: "", unit: "L", unitPrice: "", isDeviation: false, actualProduct: "", deviationReason: "" },
    ]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const removeProduct = (idx: number) => {
    setProducts((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateProduct = (idx: number, field: keyof EditProductRow, value: string | boolean) => {
    setProducts((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  const productTotal = products.reduce((sum, p) => {
    return sum + (parseFloat(p.qty) || 0) * (parseFloat(p.unitPrice) || 0);
  }, 0);

  const laborNum = parseFloat(laborCost) || 0;
  const computedTotal = laborNum + productTotal;

  const sectionLabel =
    log.section_id === "section-a" ? "Section A" :
    log.section_id === "section-b" ? "Section B" : "Both Sections";

  const handleSave = async () => {
    if (!date) {
      Alert.alert("Error", "Activity date is required.");
      return;
    }
    setSaving(true);
    try {
      const productsUsed: ProductUsed[] = products
        .filter((p) => p.name.trim())
        .map((p) => ({
          name: p.isDeviation ? (p.actualProduct || p.name) : p.name,
          qty: parseFloat(p.qty) || 0,
          unit: p.unit,
          unit_price: parseFloat(p.unitPrice) || 0,
          total: (parseFloat(p.qty) || 0) * (parseFloat(p.unitPrice) || 0),
          is_deviation: p.isDeviation,
          actual_product: p.isDeviation ? p.actualProduct : null,
          deviation_reason: p.isDeviation ? p.deviationReason : null,
        }));

      await editActivityLog(log.id, {
        actual_date: date,
        weather_conditions: weather,
        num_workers: parseInt(numWorkers) || 0,
        labor_cost_kes: laborNum,
        products_used: productsUsed,
        is_deviation: productsUsed.some((p) => p.is_deviation),
        total_cost_kes: computedTotal,
        notes: notes.trim() || null,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved", "Activity updated.", [{ text: "OK", onPress: () => router.back() }]);
    } catch {
      Alert.alert("Error", "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Remove Activity",
      `Remove "${log.activity_name}"? This will mark it as not done. Any separate cost entries remain in the ledger.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await removeActivityLog(log.id);
            router.back();
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Activity</Text>
        <Pressable onPress={handleDelete} hitSlop={12}>
          <Ionicons name="trash-outline" size={22} color={COLORS.red} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Activity summary banner */}
        <View style={styles.summaryCard}>
          <Text style={styles.activityName}>{log.activity_name}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaBadge}>
              <Ionicons name="grid-outline" size={12} color={COLORS.primary} />
              <Text style={styles.metaBadgeText}>{sectionLabel}</Text>
            </View>
            {computedTotal > 0 && (
              <View style={[styles.metaBadge, { backgroundColor: COLORS.amberLight }]}>
                <Ionicons name="cash-outline" size={12} color={COLORS.amberDark} />
                <Text style={[styles.metaBadgeText, { color: COLORS.amberDark }]}>
                  {formatKES(Math.round(computedTotal))}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── DATE ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Date</Text>
          <View style={styles.dateDisplayBox}>
            <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
            <Text style={styles.dateDisplayText}>{date ? formatDateFriendly(date) : "No date set"}</Text>
          </View>
          <View style={styles.quickDateRow}>
            {getQuickDates().map(({ label, value }) => (
              <Pressable
                key={value}
                style={[styles.chip, date === value && styles.chipActive]}
                onPress={() => { setDate(value); setShowCustomDate(false); Haptics.selectionAsync(); }}
              >
                <Text style={[styles.chipText, date === value && styles.chipTextActive]}>{label}</Text>
              </Pressable>
            ))}
            <Pressable
              style={[styles.chip, showCustomDate && styles.chipActive]}
              onPress={() => setShowCustomDate(true)}
            >
              <Text style={[styles.chipText, showCustomDate && styles.chipTextActive]}>Earlier...</Text>
            </Pressable>
          </View>
          {showCustomDate && (
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numbers-and-punctuation"
              autoFocus
            />
          )}
        </View>

        {/* ── WEATHER ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Weather</Text>
          <View style={styles.weatherRow}>
            {WEATHER_OPTIONS.map((w) => (
              <Pressable
                key={w}
                style={[styles.weatherChip, weather === w && styles.weatherChipActive]}
                onPress={() => setWeather(w)}
              >
                <Ionicons
                  name={weatherIcon(w)}
                  size={16}
                  color={weather === w ? COLORS.white : COLORS.textSecondary}
                />
                <Text style={[styles.weatherChipText, weather === w && styles.weatherChipTextActive]}>{w}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── LABOUR ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Labour</Text>
          <View style={styles.rowInputs}>
            <View style={styles.rowInputField}>
              <Text style={styles.fieldHint}>Workers</Text>
              <TextInput
                style={styles.input}
                value={numWorkers}
                onChangeText={setNumWorkers}
                placeholder="0"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.rowInputField}>
              <Text style={styles.fieldHint}>Labour cost (KES)</Text>
              <TextInput
                style={styles.input}
                value={laborCost}
                onChangeText={setLaborCost}
                placeholder="0"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
              />
            </View>
          </View>
          {laborNum > 0 && (
            <View style={styles.subtotalRow}>
              <Text style={styles.subtotalLabel}>Labour total</Text>
              <Text style={styles.subtotalValue}>{formatKES(laborNum)}</Text>
            </View>
          )}
        </View>

        {/* ── PRODUCTS USED ── */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionLabel}>Products Used</Text>
            <Pressable style={styles.addBtn} onPress={addProduct}>
              <Ionicons name="add" size={16} color={COLORS.primary} />
              <Text style={styles.addBtnText}>Add</Text>
            </Pressable>
          </View>

          {products.length === 0 && (
            <Pressable style={styles.emptyProductRow} onPress={addProduct}>
              <Ionicons name="flask-outline" size={20} color={COLORS.textMuted} />
              <Text style={styles.emptyProductText}>Tap Add to record products used</Text>
            </Pressable>
          )}

          {products.map((p, idx) => (
            <View key={idx} style={[styles.productCard, p.isDeviation && styles.productCardDeviation]}>
              <View style={styles.productCardHeader}>
                <Text style={styles.productCardNum}>Product {idx + 1}</Text>
                <View style={styles.productCardHeaderRight}>
                  <Pressable
                    style={[styles.deviationToggle, p.isDeviation && styles.deviationToggleActive]}
                    onPress={() => updateProduct(idx, "isDeviation", !p.isDeviation)}
                    hitSlop={8}
                  >
                    <Ionicons name="swap-horizontal" size={12} color={p.isDeviation ? COLORS.amber : COLORS.textMuted} />
                    <Text style={[styles.deviationToggleText, p.isDeviation && styles.deviationToggleTextActive]}>
                      Substituted
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => removeProduct(idx)} hitSlop={8}>
                    <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
                  </Pressable>
                </View>
              </View>

              <Text style={styles.fieldHint}>{p.isDeviation ? "Planned product name" : "Product name"}</Text>
              <TextInput
                style={styles.input}
                value={p.name}
                onChangeText={(v) => updateProduct(idx, "name", v)}
                placeholder="e.g. Ridomil Gold"
                placeholderTextColor={COLORS.textMuted}
              />

              {p.isDeviation && (
                <>
                  <Text style={styles.fieldHint}>Actual product used</Text>
                  <TextInput
                    style={[styles.input, styles.inputAmber]}
                    value={p.actualProduct}
                    onChangeText={(v) => updateProduct(idx, "actualProduct", v)}
                    placeholder="What was actually used"
                    placeholderTextColor={COLORS.textMuted}
                  />
                  <Text style={styles.fieldHint}>Reason for substitution</Text>
                  <TextInput
                    style={[styles.input, styles.inputAmber]}
                    value={p.deviationReason}
                    onChangeText={(v) => updateProduct(idx, "deviationReason", v)}
                    placeholder="e.g. Out of stock"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </>
              )}

              <View style={styles.rowInputs}>
                <View style={styles.rowInputField}>
                  <Text style={styles.fieldHint}>Qty</Text>
                  <TextInput
                    style={styles.input}
                    value={p.qty}
                    onChangeText={(v) => updateProduct(idx, "qty", v)}
                    placeholder="0"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={[styles.rowInputField, { flex: 0.8 }]}>
                  <Text style={styles.fieldHint}>Unit</Text>
                  <View style={styles.unitSelector}>
                    {UNIT_OPTIONS.map((u) => (
                      <Pressable
                        key={u}
                        style={[styles.unitChip, p.unit === u && styles.unitChipActive]}
                        onPress={() => updateProduct(idx, "unit", u)}
                      >
                        <Text style={[styles.unitChipText, p.unit === u && styles.unitChipTextActive]}>{u}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              <Text style={styles.fieldHint}>Unit price (KES)</Text>
              <TextInput
                style={styles.input}
                value={p.unitPrice}
                onChangeText={(v) => updateProduct(idx, "unitPrice", v)}
                placeholder="0"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
              />

              {(parseFloat(p.qty) || 0) > 0 && (parseFloat(p.unitPrice) || 0) > 0 && (
                <View style={styles.subtotalRow}>
                  <Text style={styles.subtotalLabel}>
                    {p.qty} {p.unit} × {formatKES(parseFloat(p.unitPrice))}
                  </Text>
                  <Text style={styles.subtotalValue}>
                    {formatKES(Math.round((parseFloat(p.qty) || 0) * (parseFloat(p.unitPrice) || 0)))}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* ── NOTES ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Notes / Observations</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any corrections or observations..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* ── TOTAL ── */}
        {computedTotal > 0 && (
          <View style={styles.totalCard}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Labour</Text>
              <Text style={styles.totalValue}>{formatKES(laborNum)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Products</Text>
              <Text style={styles.totalValue}>{formatKES(Math.round(productTotal))}</Text>
            </View>
            <View style={styles.totalDivider} />
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { fontFamily: "DMSans_700Bold", fontSize: 15, color: COLORS.text }]}>Total</Text>
              <Text style={[styles.totalValue, { fontFamily: "DMSans_700Bold", fontSize: 18, color: COLORS.primary }]}>
                {formatKES(Math.round(computedTotal))}
              </Text>
            </View>
          </View>
        )}

        <Pressable
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
          <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save Changes"}</Text>
        </Pressable>
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
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, gap: 20 },

  summaryCard: {
    backgroundColor: COLORS.primarySurface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: COLORS.primary + "30", gap: 8,
  },
  activityName: { fontFamily: "DMSans_700Bold", fontSize: 17, color: COLORS.primary },
  metaRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  metaBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    backgroundColor: COLORS.white,
  },
  metaBadgeText: { fontFamily: "DMSans_500Medium", fontSize: 12, color: COLORS.primary },

  section: { gap: 8 },
  sectionLabel: { fontFamily: "DMSans_700Bold", fontSize: 13, color: COLORS.text },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fieldHint: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textMuted, marginBottom: 2 },

  dateDisplayBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: COLORS.primarySurface, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1.5, borderColor: COLORS.primary,
  },
  dateDisplayText: { fontFamily: "DMSans_600SemiBold", fontSize: 14, color: COLORS.primary, flex: 1 },
  quickDateRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: COLORS.borderLight, borderWidth: 1.5, borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontFamily: "DMSans_500Medium", fontSize: 12, color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.white },

  weatherRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  weatherChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: COLORS.borderLight, borderWidth: 1.5, borderColor: COLORS.border,
  },
  weatherChipActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primaryLight },
  weatherChipText: { fontFamily: "DMSans_500Medium", fontSize: 12, color: COLORS.textSecondary },
  weatherChipTextActive: { color: COLORS.white },

  rowInputs: { flexDirection: "row", gap: 10 },
  rowInputField: { flex: 1 },
  input: {
    backgroundColor: COLORS.white, borderRadius: 10, borderWidth: 1.5,
    borderColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 11,
    fontFamily: "DMSans_400Regular", fontSize: 14, color: COLORS.text,
  },
  inputAmber: { borderColor: COLORS.amber },
  notesInput: { height: 90, textAlignVertical: "top" },

  subtotalRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: COLORS.primarySurface, borderRadius: 8, padding: 10,
    borderWidth: 1, borderColor: COLORS.primary + "30",
  },
  subtotalLabel: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary, flex: 1 },
  subtotalValue: { fontFamily: "DMSans_700Bold", fontSize: 13, color: COLORS.primary },

  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: COLORS.primarySurface, borderWidth: 1, borderColor: COLORS.primary + "40",
  },
  addBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.primary },

  emptyProductRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: COLORS.cardBg, borderRadius: 12, padding: 16,
    borderWidth: 1.5, borderColor: COLORS.border, borderStyle: "dashed",
  },
  emptyProductText: { fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.textMuted },

  productCard: {
    backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 14, gap: 6,
    borderWidth: 1, borderColor: COLORS.border,
  },
  productCardDeviation: { borderColor: COLORS.amber, backgroundColor: "#FFFDE7" },
  productCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  productCardNum: { fontFamily: "DMSans_600SemiBold", fontSize: 12, color: COLORS.textSecondary },
  productCardHeaderRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  deviationToggle: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    backgroundColor: COLORS.borderLight, borderWidth: 1, borderColor: COLORS.border,
  },
  deviationToggleActive: { backgroundColor: "#FFF3E0", borderColor: COLORS.amber },
  deviationToggleText: { fontFamily: "DMSans_500Medium", fontSize: 11, color: COLORS.textMuted },
  deviationToggleTextActive: { color: COLORS.amber },

  unitSelector: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  unitChip: {
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6,
    backgroundColor: COLORS.borderLight, borderWidth: 1, borderColor: COLORS.border,
  },
  unitChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  unitChipText: { fontFamily: "DMSans_500Medium", fontSize: 11, color: COLORS.textSecondary },
  unitChipTextActive: { color: COLORS.white },

  totalCard: {
    backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 14, gap: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.textSecondary },
  totalValue: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.text },
  totalDivider: { height: 1, backgroundColor: COLORS.border },

  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 14,
    paddingVertical: 16, marginTop: 4,
  },
  saveBtnText: { fontFamily: "DMSans_700Bold", fontSize: 16, color: COLORS.white },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  emptyText: { fontFamily: "DMSans_500Medium", fontSize: 15, color: COLORS.textMuted },
});
