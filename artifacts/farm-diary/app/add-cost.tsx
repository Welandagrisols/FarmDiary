import React, { useEffect, useState } from "react";
import { reportWriteError } from "@/lib/write-errors";
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
import { COST_CATEGORIES } from "@/constants/farmData";
import { isPrePlanting } from "@/lib/storage";
import { canManageLabourCosts, isLabourCostCategory } from "@/lib/labour-access";
import { getFarmRole, type FarmRole } from "@/lib/sales-storage";
import * as Haptics from "expo-haptics";

type SectionChoice = "section-a" | "section-b" | "both" | "farm";

const CATEGORIES = Object.keys(COST_CATEGORIES);
const NON_LABOUR_CATEGORIES = CATEGORIES.filter((item) => !isLabourCostCategory(item));
const INITIAL_CATEGORY = NON_LABOUR_CATEGORIES[0] ?? CATEGORIES[0] ?? "";

export default function AddCostScreen() {
  const insets = useSafeAreaInsets();
  const { addCostEntry, activeSeason, seasonId, farmId } = useFarm();

  const [farmRole, setFarmRole] = useState<FarmRole>("none");
  const [category, setCategory] = useState(INITIAL_CATEGORY);
  const [subcategory, setSubcategory] = useState(COST_CATEGORIES[INITIAL_CATEGORY]?.[0] ?? "");
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

  const canManageLabourCostEntries = canManageLabourCosts(farmRole);
  const subcategories = COST_CATEGORIES[category] || [];

  useEffect(() => {
    let active = true;
    setFarmRole("none");
    if (!farmId) return () => { active = false; };
    getFarmRole(farmId)
      .then((role) => { if (active) setFarmRole(role); })
      .catch(() => { if (active) setFarmRole("none"); });
    return () => { active = false; };
  }, [farmId]);

  useEffect(() => {
    if (canManageLabourCostEntries || !isLabourCostCategory(category)) return;
    const fallback = NON_LABOUR_CATEGORIES[0];
    if (!fallback) return;
    setCategory(fallback);
    setSubcategory(COST_CATEGORIES[fallback]?.[0] ?? "");
  }, [canManageLabourCostEntries, category]);

  const handleCategoryChange = (cat: string) => {
    if (isLabourCostCategory(cat) && !canManageLabourCostEntries) {
      Alert.alert("Manager access required", "Only a farm manager can enter labour costs.");
      return;
    }
    setCategory(cat);
    setSubcategory(COST_CATEGORIES[cat][0]);
  };

  const computedAmount = (() => {
    if (isLabourCostCategory(category)) {
      const workers = parseFloat(numWorkers) || 0;
      const days = parseFloat(daysWorked) || 1;
      const rate = parseFloat(ratePerDay) || 500;
      return workers * days * rate;
    }
    if (useQtyMode) return (parseFloat(qty) || 0) * (parseFloat(unitPrice) || 0);
    return parseFloat(amount) || 0;
  })();

  const sectionId = sectionChoice === "section-a" ? "section-a" : sectionChoice === "section-b" ? "section-b" : null;

  const handleSubmit = async () => {
    if (isLabourCostCategory(category) && !canManageLabourCostEntries) {
      Alert.alert("Manager access required", "Only a farm manager can enter labour costs.");
      return;
    }
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

      await addCostEntry({
        farm_id: farmId,
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
        num_workers: isLabourCostCategory(category) ? (parseInt(numWorkers) || null) : null,
        days_worked: isLabourCostCategory(category) ? (parseFloat(daysWorked) || null) : null,
        rate_per_worker_per_day: isLabourCostCategory(category) ? (parseFloat(ratePerDay) || null) : null,
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
      reportWriteError(e, "Failed to save cost. Please try again.", "Error");
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
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Section</Text>
          <View style={styles.sectionRow}>
            {(["farm", "section-a", "section-b", "both"] as SectionChoice[]).map((opt) => (
              <Pressable key={opt} style={[styles.chip, sectionChoice === opt && styles.chipActive]} onPress={() => setSectionChoice(opt)}>
                <Text style={[styles.chipText, sectionChoice === opt && styles.chipTextActive]}>{opt === "farm" ? "Farm" : opt === "section-a" ? "Sec A" : opt === "section-b" ? "Sec B" : "Both"}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: COLORS.cardBg }, header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight }, closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.borderLight, alignItems: "center", justifyContent: "center" }, headerTitle: { fontFamily: "Manrope_700Bold", fontSize: 17, color: COLORS.text }, scroll: { flex: 1 }, scrollContent: { padding: 16, gap: 0 }, field: { marginBottom: 16, gap: 6 }, fieldLabel: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 14,
    color: COLORS.text,
  }, sectionRow: { flexDirection: "row", gap: 8 }, chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.borderLight, borderWidth: 1.5, borderColor: COLORS.border }, chipActive: {
    backgroundColor: COLORS.ink,
    borderColor: COLORS.ink,
  }, chipText: {
    fontFamily: "Manrope_500Medium",
    fontSize: 13,
    color: COLORS.textSecondary,
  }, chipTextActive: { color: COLORS.white } });
