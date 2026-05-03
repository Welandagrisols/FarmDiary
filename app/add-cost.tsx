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
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFarm } from "@/context/FarmContext";
import COLORS from "@/constants/colors";
import { COST_CATEGORIES, FARM_SEED, SEASON_SEED } from "@/constants/farmData";
import { isPrePlanting } from "@/lib/storage";
import * as Haptics from "expo-haptics";

type SectionChoice = "section-a" | "section-b" | "both" | "farm";

const CATEGORIES = Object.keys(COST_CATEGORIES);

export default function AddCostScreen() {
  const insets = useSafeAreaInsets();
  const { addCostEntry, activeSeason } = useFarm();

  const [category, setCategory] = useState(CATEGORIES[0]);
  const [subcategory, setSubcategory] = useState(COST_CATEGORIES[CATEGORIES[0]][0]);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [sectionChoice, setSectionChoice] = useState<SectionChoice>("farm");
  const [useQtyMode, setUseQtyMode] = useState(false);
  const [amount, setAmount] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("L");
  const [unitPrice, setUnitPrice] = useState("");
  const [productName, setProductName] = useState("");
  const [supplier, setSupplier] = useState("");
  const [receipt, setReceipt] = useState("");
  const [notes, setNotes] = useState("");
  const [numWorkers, setNumWorkers] = useState("");
  const [daysWorked, setDaysWorked] = useState("1");
  const [ratePerDay, setRatePerDay] = useState("500");
  const [facilitatorName, setFacilitatorName] = useState("");
  const [tripFrom, setTripFrom] = useState("");
  const [tripTo, setTripTo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const subcategories = COST_CATEGORIES[category] || [];

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    setSubcategory(COST_CATEGORIES[cat][0]);
  };

  const computedAmount = (() => {
    if (category === "Labor") {
      const workers = parseFloat(numWorkers) || 0;
      const days = parseFloat(daysWorked) || 1;
      const rate = parseFloat(ratePerDay) || 500;
      return workers * days * rate;
    }
    if (useQtyMode) {
      return (parseFloat(qty) || 0) * (parseFloat(unitPrice) || 0);
    }
    return parseFloat(amount) || 0;
  })();

  const sectionId =
    sectionChoice === "section-a" ? "section-a"
      : sectionChoice === "section-b" ? "section-b"
      : sectionChoice === "both" ? null
      : null;

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert("Error", "Please enter a description.");
      return;
    }
    if (computedAmount <= 0) {
      Alert.alert("Error", "Please enter a valid amount.");
      return;
    }

    setSubmitting(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const plantingDate = activeSeason?.section_a.planting_date || "2026-02-17";
      const seasonId = activeSeason?.id || SEASON_SEED.id;

      await addCostEntry({
        farm_id: FARM_SEED.id,
        season_id: seasonId,
        section_id: sectionId,
        cost_category: category,
        cost_subcategory: subcategory,
        description: description.trim(),
        cost_date: date,
        is_pre_planting: isPrePlanting(date, plantingDate),
        is_historical: new Date(date) < new Date(new Date().toDateString()),
        amount_kes: computedAmount,
        quantity: useQtyMode ? (parseFloat(qty) || null) : null,
        unit: useQtyMode ? unit || null : null,
        unit_price_kes: useQtyMode ? (parseFloat(unitPrice) || null) : null,
        product_name: category === "Inputs" ? productName || null : null,
        supplier: supplier || null,
        receipt_reference: receipt || null,
        num_workers: category === "Labor" ? (parseInt(numWorkers) || null) : null,
        days_worked: category === "Labor" ? (parseFloat(daysWorked) || null) : null,
        rate_per_worker_per_day: category === "Labor" ? (parseFloat(ratePerDay) || null) : null,
        facilitator_name: category === "Facilitation" ? facilitatorName || null : null,
        trip_from: category === "Facilitation" ? tripFrom || null : null,
        trip_to: category === "Facilitation" ? tripTo || null : null,
        is_deviation: false,
        planned_product: null,
        deviation_reason: null,
        notes: notes || null,
        weather_conditions: null,
      });

      router.back();
    } catch (e) {
      Alert.alert("Error", "Failed to save cost. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn} hitSlop={12}>
          <Ionicons name="close" size={22} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Add Cost</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Section */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Section</Text>
          <View style={styles.sectionRow}>
            {(["farm", "section-a", "section-b", "both"] as SectionChoice[]).map((opt) => (
              <Pressable
                key={opt}
                style={[styles.chip, sectionChoice === opt && styles.chipActive]}
                onPress={() => setSectionChoice(opt)}
              >
                <Text style={[styles.chipText, sectionChoice === opt && styles.chipTextActive]}>
                  {opt === "farm" ? "Farm" : opt === "section-a" ? "Sec A" : opt === "section-b" ? "Sec B" : "Both"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Date */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Date (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="2026-03-15"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="numbers-and-punctuation"
          />
          <Text style={styles.fieldHint}>Past date = automatic historical flag</Text>
        </View>

        {/* Category */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
            {CATEGORIES.map((cat) => {
              const short = cat === "Community & Goodwill" ? "Community" : cat;
              return (
                <Pressable
                  key={cat}
                  style={[styles.chip, category === cat && styles.chipActive]}
                  onPress={() => handleCategoryChange(cat)}
                >
                  <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>{short}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Subcategory */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Subcategory</Text>
          <ScrollView style={styles.subcatScroll} nestedScrollEnabled>
            {subcategories.map((sub) => (
              <Pressable
                key={sub}
                style={[styles.subcatOption, subcategory === sub && styles.subcatOptionActive]}
                onPress={() => setSubcategory(sub)}
              >
                <Text style={[styles.subcatText, subcategory === sub && styles.subcatTextActive]}>{sub}</Text>
                {subcategory === sub && <Ionicons name="checkmark" size={14} color={COLORS.primary} />}
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            style={styles.input}
            value={description}
            onChangeText={setDescription}
            placeholder="Brief description of this cost"
            placeholderTextColor={COLORS.textMuted}
          />
        </View>

        {/* Amount — Labor auto-calc */}
        {category === "Labor" ? (
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Labor Calculation</Text>
            <View style={styles.laborGrid}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabelSm}>Workers</Text>
                <TextInput
                  style={styles.input}
                  value={numWorkers}
                  onChangeText={setNumWorkers}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabelSm}>Days</Text>
                <TextInput
                  style={styles.input}
                  value={daysWorked}
                  onChangeText={setDaysWorked}
                  keyboardType="numeric"
                  placeholder="1"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabelSm}>Rate/Day</Text>
                <TextInput
                  style={styles.input}
                  value={ratePerDay}
                  onChangeText={setRatePerDay}
                  keyboardType="numeric"
                  placeholder="500"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.field}>
            <View style={styles.amountToggle}>
              <Text style={styles.fieldLabel}>Amount</Text>
              <Pressable
                onPress={() => setUseQtyMode(!useQtyMode)}
                style={styles.toggleBtn}
              >
                <Text style={styles.toggleBtnText}>
                  {useQtyMode ? "Switch to total" : "Qty × Price"}
                </Text>
              </Pressable>
            </View>

            {!useQtyMode ? (
              <View style={styles.amountRow}>
                <Text style={styles.kesPre}>KES</Text>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>
            ) : (
              <View style={styles.laborGrid}>
                <View style={{ flex: 2 }}>
                  <Text style={styles.fieldLabelSm}>Qty</Text>
                  <TextInput
                    style={styles.input}
                    value={qty}
                    onChangeText={setQty}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={styles.fieldLabelSm}>Unit</Text>
                  <TextInput
                    style={styles.input}
                    value={unit}
                    onChangeText={setUnit}
                    placeholder="L / kg"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
                <View style={{ flex: 3 }}>
                  <Text style={styles.fieldLabelSm}>KES/unit</Text>
                  <TextInput
                    style={styles.input}
                    value={unitPrice}
                    onChangeText={setUnitPrice}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
              </View>
            )}
          </View>
        )}

        {/* Computed total */}
        {computedAmount > 0 && (
          <View style={styles.computedTotal}>
            <Text style={styles.computedTotalLabel}>Amount</Text>
            <Text style={styles.computedTotalValue}>
              KES {computedAmount.toLocaleString("en-KE")}
            </Text>
          </View>
        )}

        {/* Inputs-specific: product name */}
        {category === "Inputs" && (
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Product Name</Text>
            <TextInput
              style={styles.input}
              value={productName}
              onChangeText={setProductName}
              placeholder="e.g. Metameta 2.5kg"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>
        )}

        {/* Facilitation-specific */}
        {category === "Facilitation" && (
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Facilitator Details</Text>
            <TextInput
              style={[styles.input, { marginBottom: 8 }]}
              value={facilitatorName}
              onChangeText={setFacilitatorName}
              placeholder="Facilitator name"
              placeholderTextColor={COLORS.textMuted}
            />
            <View style={styles.laborGrid}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={tripFrom}
                onChangeText={setTripFrom}
                placeholder="From"
                placeholderTextColor={COLORS.textMuted}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={tripTo}
                onChangeText={setTripTo}
                placeholder="To"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
          </View>
        )}

        {/* Supplier & Receipt */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Supplier (optional)</Text>
          <TextInput
            style={styles.input}
            value={supplier}
            onChangeText={setSupplier}
            placeholder="Supplier name"
            placeholderTextColor={COLORS.textMuted}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Receipt Reference (optional)</Text>
          <TextInput
            style={styles.input}
            value={receipt}
            onChangeText={setReceipt}
            placeholder="Receipt / invoice number"
            placeholderTextColor={COLORS.textMuted}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Additional details"
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={3}
          />
        </View>

        <Pressable
          style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
          <Text style={styles.submitBtnText}>{submitting ? "Saving..." : "Save Cost Entry"}</Text>
        </Pressable>

        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cardBg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.borderLight, alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontFamily: "DMSans_700Bold", fontSize: 17, color: COLORS.text },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 0 },
  field: { marginBottom: 16, gap: 6 },
  fieldLabel: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.text },
  fieldLabelSm: { fontFamily: "DMSans_500Medium", fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 },
  fieldHint: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textMuted },
  input: {
    backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: "DMSans_400Regular", fontSize: 14, color: COLORS.text,
  },
  notesInput: { minHeight: 80, textAlignVertical: "top", paddingTop: 12 },
  sectionRow: { flexDirection: "row", gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.borderLight, borderWidth: 1.5, borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontFamily: "DMSans_500Medium", fontSize: 12, color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.white },
  categoryScroll: { gap: 8, paddingBottom: 2 },
  subcatScroll: { maxHeight: 200, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, backgroundColor: COLORS.background },
  subcatOption: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  subcatOptionActive: { backgroundColor: COLORS.primarySurface },
  subcatText: { fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.text, flex: 1 },
  subcatTextActive: { color: COLORS.primary, fontFamily: "DMSans_600SemiBold" },
  amountToggle: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  toggleBtn: { backgroundColor: COLORS.primarySurface, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  toggleBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 11, color: COLORS.primary },
  amountRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  kesPre: { fontFamily: "DMSans_700Bold", fontSize: 14, color: COLORS.primary },
  laborGrid: { flexDirection: "row", gap: 8 },
  computedTotal: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: COLORS.primarySurface, borderRadius: 10, padding: 14, marginBottom: 16,
  },
  computedTotalLabel: { fontFamily: "DMSans_600SemiBold", fontSize: 14, color: COLORS.primary },
  computedTotalValue: { fontFamily: "DMSans_700Bold", fontSize: 20, color: COLORS.primary },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 6,
  },
  submitBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 16, color: COLORS.white },
});
