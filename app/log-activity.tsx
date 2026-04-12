import React, { useState, useCallback } from "react";
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
import { PLANNED_SCHEDULE, SECTIONS_SEED, FARM_SEED, SEASON_SEED } from "@/constants/farmData";
import { formatKES, isPrePlanting } from "@/lib/storage";
import * as Haptics from "expo-haptics";

const WEATHER_OPTIONS = ["Sunny", "Cloudy", "Light Rain", "Heavy Rain"];

type Section = "section-a" | "section-b" | "both";

interface ProductRow {
  name: string;
  isDeviation: boolean;
  actualProduct: string;
  deviationReason: string;
  qty: string;
  unit: string;
  unitPrice: string;
}

interface OtherCostRow {
  typeKey: string;
  category: string;
  subcategory: string;
  description: string;
  amount: string;
  waterContainers?: string;
  waterPricePerContainer?: string;
}

const OTHER_COST_TYPES: { key: string; label: string; category: string; subcategory: string }[] = [
  { key: "boda", label: "Motorcycle / Boda", category: "Facilitation", subcategory: "Motorcycle / Boda Hire" },
  { key: "matatu", label: "Matatu / Bus / Taxi", category: "Facilitation", subcategory: "Matatu / Bus / Taxi Fare" },
  { key: "car", label: "Vehicle / Car Hire", category: "Facilitation", subcategory: "Vehicle / Car Hire" },
  { key: "fuel", label: "Fuel", category: "Facilitation", subcategory: "Fuel — Manager / Supervisor Trip" },
  { key: "accommodation", label: "Accommodation", category: "Facilitation", subcategory: "Accommodation — Overnight Stay" },
  { key: "meals", label: "Meals / Food", category: "Facilitation", subcategory: "Meals / Food / Per Diem" },
  { key: "airtime", label: "Airtime / Data", category: "Facilitation", subcategory: "Mobile / Communication / Airtime" },
  { key: "agronomist", label: "Agronomist Fee", category: "Facilitation", subcategory: "Agronomist / Consultant Fee" },
  { key: "professional", label: "Professional Fee", category: "Facilitation", subcategory: "Professional Service Fee (Accountant / Legal)" },
  { key: "token_neighbour", label: "Token — Neighbour", category: "Community & Goodwill", subcategory: "Token of Appreciation — Neighbour" },
  { key: "token_leader", label: "Token — Leader", category: "Community & Goodwill", subcategory: "Token of Appreciation — Community Leader" },
  { key: "community", label: "Community Gift", category: "Community & Goodwill", subcategory: "Community / Harambee Contribution" },
  { key: "security", label: "Local Security", category: "Community & Goodwill", subcategory: "Local Security Contribution" },
  { key: "equipment", label: "Equipment Hire", category: "Equipment", subcategory: "Tractor Hire — Other" },
  { key: "packaging", label: "Packaging / Bags", category: "Logistics", subcategory: "Packaging / Bags" },
  { key: "water", label: "Water (Spraying)", category: "Inputs", subcategory: "Other Agrochemical" },
  { key: "other", label: "Other", category: "Overhead", subcategory: "Other Overhead" },
];

function getLaborSubcategory(activityId: string): string {
  if (!activityId) return "Casual Labor — Other";
  if (activityId.includes("harvest")) return "Harvest Labor";
  if (activityId.includes("earthing")) return "Earthing Up Labor";
  if (activityId.includes("weed")) return "Weeding Labor";
  if (activityId.includes("planting")) return "Planting Labor";
  if (activityId.includes("spray") || activityId.includes("stage")) return "Spraying Labor";
  return "Casual Labor — Other";
}

export default function LogActivityScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ activityId?: string }>();
  const { logActivity, addCostEntry } = useFarm();

  const preSelected = params.activityId
    ? PLANNED_SCHEDULE.find((a) => a.id === params.activityId)
    : null;

  const [step, setStep] = useState(1);
  const [activityType, setActivityType] = useState<"planned" | "other" | "historical">(preSelected ? "planned" : "planned");
  const [selectedActivityId, setSelectedActivityId] = useState<string>(preSelected?.id ?? "");
  const [customActivityName, setCustomActivityName] = useState("");
  const [section, setSection] = useState<Section>("both");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [showCustomDateInput, setShowCustomDateInput] = useState(false);
  const [weather, setWeather] = useState("Sunny");
  const [products, setProducts] = useState<ProductRow[]>(() => {
    if (preSelected) {
      return preSelected.plannedProducts.map((p) => ({
        name: p.name,
        isDeviation: false,
        actualProduct: "",
        deviationReason: "",
        qty: "",
        unit: p.unit,
        unitPrice: p.unitPrice.toString(),
      }));
    }
    return [];
  });
  const [numWorkers, setNumWorkers] = useState("2");
  const [dailyRate, setDailyRate] = useState("500");
  const [daysWorked, setDaysWorked] = useState("1");
  const [laborMode, setLaborMode] = useState<"per_day" | "per_acre" | "per_pump">("per_day");
  const [acresWorked, setAcresWorked] = useState("2");
  const [ratePerAcre, setRatePerAcre] = useState("2400");
  const [numPumps, setNumPumps] = useState("20");
  const [ratePerPump, setRatePerPump] = useState("50");
  const [otherCosts, setOtherCosts] = useState<OtherCostRow[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedActivity = selectedActivityId
    ? PLANNED_SCHEDULE.find((a) => a.id === selectedActivityId)
    : null;

  const activityName =
    activityType === "planned"
      ? (selectedActivity?.name ?? "")
      : customActivityName;

  const laborCost = Math.round(
    laborMode === "per_day"
      ? (parseFloat(numWorkers) || 0) * (parseFloat(dailyRate) || 500) * (parseFloat(daysWorked) || 1)
      : laborMode === "per_acre"
      ? (parseFloat(acresWorked) || 0) * (parseFloat(ratePerAcre) || 2400)
      : (parseFloat(numPumps) || 0) * (parseFloat(ratePerPump) || 50)
  );

  const productCost = products.reduce((sum, p) => {
    const qty = parseFloat(p.qty) || 0;
    const price = parseFloat(p.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  const getOtherCostAmount = (c: OtherCostRow): number => {
    if (c.typeKey === "water") {
      return Math.round((parseFloat(c.waterContainers || "0") || 0) * (parseFloat(c.waterPricePerContainer || "20") || 20));
    }
    return parseFloat(c.amount) || 0;
  };
  const otherTotal = otherCosts.reduce((sum, c) => sum + getOtherCostAmount(c), 0);
  const totalCost = laborCost + productCost + otherTotal;

  const handleActivitySelect = useCallback(
    (id: string) => {
      setSelectedActivityId(id);
      const activity = PLANNED_SCHEDULE.find((a) => a.id === id);
      if (activity) {
        setProducts(
          activity.plannedProducts.map((p) => ({
            name: p.name,
            isDeviation: false,
            actualProduct: "",
            deviationReason: "",
            qty: "",
            unit: p.unit,
            unitPrice: p.unitPrice.toString(),
          }))
        );
      }
    },
    []
  );

  const addProduct = () => {
    setProducts((prev) => [
      ...prev,
      { name: "", isDeviation: false, actualProduct: "", deviationReason: "", qty: "", unit: "L", unitPrice: "" },
    ]);
  };

  const updateProduct = (idx: number, field: keyof ProductRow, value: string | boolean) => {
    setProducts((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  const removeProduct = (idx: number) => {
    setProducts((prev) => prev.filter((_, i) => i !== idx));
  };

  const addOtherCost = () => {
    const def = OTHER_COST_TYPES[0];
    setOtherCosts((prev) => [
      ...prev,
      { typeKey: def.key, category: def.category, subcategory: def.subcategory, description: "", amount: "" },
    ]);
  };

  const setOtherCostType = (idx: number, key: string) => {
    const found = OTHER_COST_TYPES.find((t) => t.key === key);
    if (!found) return;
    setOtherCosts((prev) =>
      prev.map((c, i) =>
        i === idx
          ? {
              ...c,
              typeKey: found.key,
              category: found.category,
              subcategory: found.subcategory,
              waterContainers: key === "water" ? (c.waterContainers ?? "") : c.waterContainers,
              waterPricePerContainer: key === "water" ? (c.waterPricePerContainer ?? "20") : c.waterPricePerContainer,
            }
          : c
      )
    );
  };

  const handleSubmit = async () => {
    if (!activityName) {
      Alert.alert("Error", "Please select or enter an activity name.");
      return;
    }

    setSubmitting(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const sectionId = section === "section-a" ? "section-a" : section === "section-b" ? "section-b" : null;
      const plantingDate = SECTIONS_SEED[0].planting_date;
      const isHist = activityType === "historical";

      const productsUsed = products
        .filter((p) => p.name)
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

      const inventoryUpdates = products
        .filter((p) => p.name && parseFloat(p.qty) > 0)
        .map((p) => ({
          name: p.isDeviation ? (p.actualProduct || p.name) : p.name,
          qty: parseFloat(p.qty) || 0,
        }));

      await logActivity(
        {
          farm_id: FARM_SEED.id,
          season_id: SEASON_SEED.id,
          section_id: sectionId,
          schedule_activity_id: activityType === "planned" ? selectedActivityId : null,
          activity_name: activityName,
          planned_date:
            activityType === "planned" && selectedActivity
              ? selectedActivity.plannedDateA
              : null,
          actual_date: date,
          products_used: productsUsed,
          is_deviation: products.some((p) => p.isDeviation),
          deviation_reason: null,
          num_workers: parseInt(numWorkers) || 0,
          labor_cost_kes: laborCost,
          total_cost_kes: totalCost,
          weather_conditions: weather,
          is_historical: isHist,
          notes,
        },
        inventoryUpdates
      );

      if (laborCost > 0) {
        await addCostEntry({
          farm_id: FARM_SEED.id,
          season_id: SEASON_SEED.id,
          section_id: sectionId,
          cost_category: "Labor",
          cost_subcategory: getLaborSubcategory(activityType === "planned" ? selectedActivityId : customActivityName.toLowerCase()),
          description: `Labor — ${activityName}`,
          cost_date: date,
          is_pre_planting: isPrePlanting(date, plantingDate),
          is_historical: isHist,
          amount_kes: laborCost,
          quantity: parseInt(numWorkers) || null,
          unit: "workers",
          unit_price_kes: parseFloat(dailyRate) || null,
          product_name: null,
          supplier: null,
          receipt_reference: null,
          num_workers: parseInt(numWorkers) || null,
          days_worked: parseFloat(daysWorked) || null,
          rate_per_worker_per_day: parseFloat(dailyRate) || null,
          facilitator_name: null,
          trip_from: null,
          trip_to: null,
          is_deviation: false,
          planned_product: null,
          deviation_reason: null,
          notes,
          weather_conditions: weather,
        });
      }

      for (const product of productsUsed) {
        if (product.total > 0) {
          await addCostEntry({
            farm_id: FARM_SEED.id,
            season_id: SEASON_SEED.id,
            section_id: sectionId,
            cost_category: "Inputs",
            cost_subcategory: "Fungicide",
            description: product.name,
            cost_date: date,
            is_pre_planting: isPrePlanting(date, plantingDate),
            is_historical: isHist,
            amount_kes: product.total,
            quantity: product.qty,
            unit: product.unit,
            unit_price_kes: product.unit_price,
            product_name: product.name,
            supplier: null,
            receipt_reference: null,
            num_workers: null,
            days_worked: null,
            rate_per_worker_per_day: null,
            facilitator_name: null,
            trip_from: null,
            trip_to: null,
            is_deviation: product.is_deviation,
            planned_product: product.is_deviation ? productsUsed.find((p) => p.name === product.name)?.name ?? null : null,
            deviation_reason: product.deviation_reason,
            notes,
            weather_conditions: weather,
          });
        }
      }

      for (const cost of otherCosts) {
        const costAmount = getOtherCostAmount(cost);
        if (costAmount > 0) {
          await addCostEntry({
            farm_id: FARM_SEED.id,
            season_id: SEASON_SEED.id,
            section_id: sectionId,
            cost_category: cost.category,
            cost_subcategory: cost.subcategory,
            description: cost.description || cost.subcategory,
            cost_date: date,
            is_pre_planting: isPrePlanting(date, plantingDate),
            is_historical: isHist,
            amount_kes: costAmount,
            quantity: null,
            unit: null,
            unit_price_kes: null,
            product_name: null,
            supplier: null,
            receipt_reference: null,
            num_workers: null,
            days_worked: null,
            rate_per_worker_per_day: null,
            facilitator_name: null,
            trip_from: null,
            trip_to: null,
            is_deviation: false,
            planned_product: null,
            deviation_reason: null,
            notes: null,
            weather_conditions: weather,
          });
        }
      }

      router.back();
    } catch (e) {
      Alert.alert("Error", "Failed to save. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateFriendly = (dateStr: string): string => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return `${days[d.getDay()]}, ${Number(parts[2])} ${months[d.getMonth()]} ${parts[0]}`;
  };

  const getQuickDates = (): { label: string; value: string }[] => {
    const result: { label: string; value: string }[] = [];
    const today = new Date();
    for (let i = 0; i <= 5; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const val = d.toISOString().split("T")[0];
      let label = "";
      if (i === 0) label = "Today";
      else if (i === 1) label = "Yesterday";
      else label = `${i} days ago`;
      result.push({ label, value: val });
    }
    return result;
  };

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const canProceed =
    step === 1 ? (activityType !== "planned" ? !!customActivityName : !!selectedActivityId) : true;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn} hitSlop={12}>
          <Ionicons name="close" size={22} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Log Activity</Text>
        <View style={styles.stepIndicator}>
          <Text style={styles.stepText}>{step}/6</Text>
        </View>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(step / 6) * 100}%` }]} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Step 1: What are you logging */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>What are you logging?</Text>

            <View style={styles.typeSelector}>
              {[
                { key: "planned", label: "Planned Activity" },
                { key: "other", label: "Unplanned" },
                { key: "historical", label: "Historical" },
              ].map((opt) => (
                <Pressable
                  key={opt.key}
                  style={[styles.typeOption, activityType === opt.key && styles.typeOptionActive]}
                  onPress={() => setActivityType(opt.key as typeof activityType)}
                >
                  <Text
                    style={[styles.typeOptionText, activityType === opt.key && styles.typeOptionTextActive]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {activityType === "planned" && (
              <View style={styles.activityList}>
                <Text style={styles.fieldLabel}>Select Activity</Text>
                {PLANNED_SCHEDULE.map((activity) => (
                  <Pressable
                    key={activity.id}
                    style={[styles.activityOption, selectedActivityId === activity.id && styles.activityOptionSelected]}
                    onPress={() => handleActivitySelect(activity.id)}
                  >
                    <View style={styles.activityOptionLeft}>
                      <Text
                        style={[styles.activityOptionName, selectedActivityId === activity.id && { color: COLORS.primary }]}
                        numberOfLines={1}
                      >
                        {activity.name}
                      </Text>
                      <Text style={styles.activityOptionDate}>Sec A: {activity.plannedDateA}</Text>
                    </View>
                    {selectedActivityId === activity.id && (
                      <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                    )}
                  </Pressable>
                ))}
              </View>
            )}

            {(activityType === "other" || activityType === "historical") && (
              <View>
                <Text style={styles.fieldLabel}>Activity Name</Text>
                <TextInput
                  style={styles.input}
                  value={customActivityName}
                  onChangeText={setCustomActivityName}
                  placeholder="e.g. Spot spray blight"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>
            )}

            <Text style={styles.fieldLabel}>Section</Text>
            <View style={styles.sectionSelector}>
              {(["section-a", "section-b", "both"] as Section[]).map((opt) => (
                <Pressable
                  key={opt}
                  style={[styles.sectionOption, section === opt && styles.sectionOptionActive]}
                  onPress={() => setSection(opt)}
                >
                  <Text style={[styles.sectionOptionText, section === opt && styles.sectionOptionTextActive]}>
                    {opt === "section-a" ? "Sec A" : opt === "section-b" ? "Sec B" : "Both"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Step 2: Date & Weather */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Date & Weather</Text>

            <Text style={styles.fieldLabel}>When did this activity happen?</Text>

            <View style={styles.dateDisplayBox}>
              <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
              <Text style={styles.dateDisplayText}>{formatDateFriendly(date)}</Text>
            </View>

            <View style={styles.quickDateRow}>
              {getQuickDates().map(({ label, value }) => (
                <Pressable
                  key={value}
                  style={[styles.quickDateChip, date === value && styles.quickDateChipActive]}
                  onPress={() => {
                    setDate(value);
                    setShowCustomDateInput(false);
                    Haptics.selectionAsync();
                  }}
                >
                  <Text style={[styles.quickDateChipText, date === value && styles.quickDateChipTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                style={[styles.quickDateChip, showCustomDateInput && styles.quickDateChipActive]}
                onPress={() => setShowCustomDateInput(true)}
              >
                <Text style={[styles.quickDateChipText, showCustomDateInput && styles.quickDateChipTextActive]}>
                  Earlier...
                </Text>
              </Pressable>
            </View>

            {showCustomDateInput && (
              <View>
                <TextInput
                  style={styles.input}
                  value={date}
                  onChangeText={setDate}
                  placeholder="YYYY-MM-DD e.g. 2026-03-15"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="numbers-and-punctuation"
                  autoFocus
                />
                <Text style={styles.fieldHint}>Type the exact date the activity took place.</Text>
              </View>
            )}

            <Text style={[styles.fieldLabel, { marginTop: 20 }]}>Weather Conditions</Text>
            <View style={styles.weatherSelector}>
              {WEATHER_OPTIONS.map((w) => (
                <Pressable
                  key={w}
                  style={[styles.weatherOption, weather === w && styles.weatherOptionActive]}
                  onPress={() => setWeather(w)}
                >
                  <Ionicons
                    name={
                      w === "Sunny" ? "sunny-outline" :
                      w === "Cloudy" ? "cloud-outline" :
                      w === "Light Rain" ? "rainy-outline" :
                      "thunderstorm-outline"
                    }
                    size={18}
                    color={weather === w ? COLORS.white : COLORS.textSecondary}
                  />
                  <Text style={[styles.weatherOptionText, weather === w && styles.weatherOptionTextActive]}>{w}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Step 3: Products */}
        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Products Used</Text>

            {products.map((product, idx) => (
              <View key={idx} style={styles.productCard}>
                <View style={styles.productCardHeader}>
                  <Text style={styles.productCardName} numberOfLines={1}>{product.name || `Product ${idx + 1}`}</Text>
                  <Pressable onPress={() => removeProduct(idx)} hitSlop={8}>
                    <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
                  </Pressable>
                </View>

                {!product.name ? (
                  <View>
                    <Text style={styles.fieldLabel}>Product Name</Text>
                    <TextInput
                      style={styles.input}
                      value={product.name}
                      onChangeText={(v) => updateProduct(idx, "name", v)}
                      placeholder="Product name"
                      placeholderTextColor={COLORS.textMuted}
                    />
                  </View>
                ) : null}

                <View style={styles.deviationRow}>
                  <Pressable
                    style={[styles.deviationBtn, !product.isDeviation && styles.deviationBtnActive]}
                    onPress={() => updateProduct(idx, "isDeviation", false)}
                  >
                    <Ionicons name="checkmark-circle" size={14} color={!product.isDeviation ? COLORS.white : COLORS.textSecondary} />
                    <Text style={[styles.deviationBtnText, !product.isDeviation && styles.deviationBtnTextActive]}>
                      Used as planned
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.deviationBtn, product.isDeviation && styles.deviationBtnDeviation]}
                    onPress={() => updateProduct(idx, "isDeviation", true)}
                  >
                    <Ionicons name="warning-outline" size={14} color={product.isDeviation ? COLORS.white : COLORS.textSecondary} />
                    <Text style={[styles.deviationBtnText, product.isDeviation && styles.deviationBtnTextActive]}>
                      Different product
                    </Text>
                  </Pressable>
                </View>

                {product.isDeviation && (
                  <View style={{ gap: 8 }}>
                    <TextInput
                      style={styles.input}
                      value={product.actualProduct}
                      onChangeText={(v) => updateProduct(idx, "actualProduct", v)}
                      placeholder="Actual product used"
                      placeholderTextColor={COLORS.textMuted}
                    />
                    <TextInput
                      style={styles.input}
                      value={product.deviationReason}
                      onChangeText={(v) => updateProduct(idx, "deviationReason", v)}
                      placeholder="Reason for change"
                      placeholderTextColor={COLORS.textMuted}
                    />
                  </View>
                )}

                <View style={styles.productInputRow}>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.fieldLabelSm}>Qty Used</Text>
                    <TextInput
                      style={styles.input}
                      value={product.qty}
                      onChangeText={(v) => updateProduct(idx, "qty", v)}
                      placeholder="0"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.fieldLabelSm}>Unit</Text>
                    <TextInput
                      style={styles.input}
                      value={product.unit}
                      onChangeText={(v) => updateProduct(idx, "unit", v)}
                      placeholder="L / kg"
                      placeholderTextColor={COLORS.textMuted}
                    />
                  </View>
                  <View style={{ flex: 3 }}>
                    <Text style={styles.fieldLabelSm}>KES/unit</Text>
                    <TextInput
                      style={styles.input}
                      value={product.unitPrice}
                      onChangeText={(v) => updateProduct(idx, "unitPrice", v)}
                      placeholder="0"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {product.qty && product.unitPrice && (
                  <Text style={styles.productTotal}>
                    Line total: {formatKES((parseFloat(product.qty) || 0) * (parseFloat(product.unitPrice) || 0))}
                  </Text>
                )}
              </View>
            ))}

            <Pressable style={styles.addProductBtn} onPress={addProduct}>
              <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
              <Text style={styles.addProductBtnText}>Add Product</Text>
            </Pressable>
          </View>
        )}

        {/* Step 4: Labor */}
        {step === 4 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Labor</Text>

            <Text style={styles.fieldLabel}>How is labor paid?</Text>
            <View style={styles.laborModeRow}>
              {([
                { key: "per_day", label: "Per Day" },
                { key: "per_acre", label: "Per Acre" },
                { key: "per_pump", label: "Per Pump" },
              ] as const).map(({ key, label }) => (
                <Pressable
                  key={key}
                  style={[styles.laborModeChip, laborMode === key && styles.laborModeChipActive]}
                  onPress={() => { setLaborMode(key); Haptics.selectionAsync(); }}
                >
                  <Text style={[styles.laborModeChipText, laborMode === key && styles.laborModeChipTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>

            {laborMode === "per_day" && (
              <>
                <Text style={styles.fieldLabel}>Number of Workers</Text>
                <TextInput style={styles.input} value={numWorkers} onChangeText={setNumWorkers}
                  keyboardType="numeric" placeholder="2" placeholderTextColor={COLORS.textMuted} />
                <Text style={styles.fieldLabel}>Daily Rate per Worker (KES)</Text>
                <TextInput style={styles.input} value={dailyRate} onChangeText={setDailyRate}
                  keyboardType="numeric" placeholder="500" placeholderTextColor={COLORS.textMuted} />
                <Text style={styles.fieldLabel}>Days Worked</Text>
                <TextInput style={styles.input} value={daysWorked} onChangeText={setDaysWorked}
                  keyboardType="numeric" placeholder="1" placeholderTextColor={COLORS.textMuted} />
                <Text style={styles.fieldHint}>{numWorkers} workers × KES {dailyRate}/day × {daysWorked} day(s)</Text>
              </>
            )}

            {laborMode === "per_acre" && (
              <>
                <Text style={styles.fieldLabel}>Acres Worked</Text>
                <TextInput style={styles.input} value={acresWorked} onChangeText={setAcresWorked}
                  keyboardType="decimal-pad" placeholder="1.4" placeholderTextColor={COLORS.textMuted} />
                <Text style={styles.fieldHint}>E.g. 1.4 acres (decimals allowed)</Text>
                <Text style={styles.fieldLabel}>Rate per Acre (KES)</Text>
                <TextInput style={styles.input} value={ratePerAcre} onChangeText={setRatePerAcre}
                  keyboardType="numeric" placeholder="2400" placeholderTextColor={COLORS.textMuted} />
                <Text style={styles.fieldHint}>{acresWorked} acres × KES {ratePerAcre}/acre</Text>
              </>
            )}

            {laborMode === "per_pump" && (
              <>
                <Text style={styles.fieldLabel}>Total Number of Pumps</Text>
                <TextInput style={styles.input} value={numPumps} onChangeText={setNumPumps}
                  keyboardType="numeric" placeholder="20" placeholderTextColor={COLORS.textMuted} />
                <Text style={styles.fieldHint}>Total pumps across the section(s) worked</Text>
                <Text style={styles.fieldLabel}>Rate per Pump (KES)</Text>
                <TextInput style={styles.input} value={ratePerPump} onChangeText={setRatePerPump}
                  keyboardType="numeric" placeholder="50" placeholderTextColor={COLORS.textMuted} />
                <Text style={styles.fieldHint}>{numPumps} pumps × KES {ratePerPump}/pump</Text>
              </>
            )}

            <View style={styles.laborTotal}>
              <Text style={styles.laborTotalLabel}>Total Labor Cost</Text>
              <Text style={styles.laborTotalValue}>{formatKES(laborCost)}</Text>
            </View>
          </View>
        )}

        {/* Step 5: Other Costs */}
        {step === 5 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Other Costs</Text>
            <Text style={styles.stepSubtitle}>Transport, meals, accommodation, tokens, fees...</Text>

            {otherCosts.map((cost, idx) => (
              <View key={idx} style={styles.otherCostCard}>
                <View style={styles.otherCostHeader}>
                  <Text style={styles.otherCostTitle}>Cost {idx + 1}</Text>
                  <Pressable onPress={() => setOtherCosts((prev) => prev.filter((_, i) => i !== idx))} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
                  </Pressable>
                </View>

                <Text style={styles.fieldLabelSm}>Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {OTHER_COST_TYPES.map((t) => (
                      <Pressable
                        key={t.key}
                        style={[styles.typeChip, cost.typeKey === t.key && styles.typeChipActive]}
                        onPress={() => setOtherCostType(idx, t.key)}
                      >
                        <Text style={[styles.typeChipText, cost.typeKey === t.key && styles.typeChipTextActive]}>
                          {t.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>

                <TextInput
                  style={[styles.input, { marginBottom: 8 }]}
                  value={cost.description}
                  onChangeText={(v) =>
                    setOtherCosts((prev) => prev.map((c, i) => (i === idx ? { ...c, description: v } : c)))
                  }
                  placeholder={cost.typeKey === "water" ? "E.g. Water from borehole" : "Details (e.g. Boda from Nakuru to farm)"}
                  placeholderTextColor={COLORS.textMuted}
                />
                {cost.typeKey === "water" ? (
                  <View>
                    <View style={styles.waterRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabelSm}>No. of 20L Containers</Text>
                        <TextInput
                          style={styles.input}
                          value={cost.waterContainers ?? ""}
                          onChangeText={(v) =>
                            setOtherCosts((prev) => prev.map((c, i) => (i === idx ? { ...c, waterContainers: v } : c)))
                          }
                          placeholder="0"
                          placeholderTextColor={COLORS.textMuted}
                          keyboardType="numeric"
                        />
                      </View>
                      <Text style={styles.waterX}>×</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabelSm}>KES per container</Text>
                        <TextInput
                          style={styles.input}
                          value={cost.waterPricePerContainer ?? "20"}
                          onChangeText={(v) =>
                            setOtherCosts((prev) => prev.map((c, i) => (i === idx ? { ...c, waterPricePerContainer: v } : c)))
                          }
                          placeholder="20"
                          placeholderTextColor={COLORS.textMuted}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                    <View style={styles.laborTotal}>
                      <Text style={styles.laborTotalLabel}>Water Cost</Text>
                      <Text style={styles.laborTotalValue}>{formatKES(getOtherCostAmount(cost))}</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.amountRow}>
                    <Text style={styles.kesPre}>KES</Text>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={cost.amount}
                      onChangeText={(v) =>
                        setOtherCosts((prev) => prev.map((c, i) => (i === idx ? { ...c, amount: v } : c)))
                      }
                      placeholder="0"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="numeric"
                    />
                  </View>
                )}
              </View>
            ))}

            <Pressable style={styles.addProductBtn} onPress={addOtherCost}>
              <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
              <Text style={styles.addProductBtnText}>Add Cost Row</Text>
            </Pressable>

            {otherTotal > 0 && (
              <View style={styles.laborTotal}>
                <Text style={styles.laborTotalLabel}>Other Costs Total</Text>
                <Text style={styles.laborTotalValue}>{formatKES(otherTotal)}</Text>
              </View>
            )}
          </View>
        )}

        {/* Step 6: Notes + Summary */}
        {step === 6 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Notes & Summary</Text>

            <TextInput
              style={[styles.input, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Additional observations, deviations, field conditions..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={4}
            />

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Activity Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Activity</Text>
                <Text style={styles.summaryValue} numberOfLines={2}>{activityName || "—"}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Activity Date</Text>
                <Text style={styles.summaryValue}>{formatDateFriendly(date)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Section</Text>
                <Text style={styles.summaryValue}>
                  {section === "section-a" ? "Section A" : section === "section-b" ? "Section B" : "Both"}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Weather</Text>
                <Text style={styles.summaryValue}>{weather}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Products</Text>
                <Text style={styles.summaryValue}>{products.filter((p) => p.name).length} items · {formatKES(productCost)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Labor</Text>
                <Text style={styles.summaryValue}>{numWorkers} workers · {formatKES(laborCost)}</Text>
              </View>
              {otherCosts.filter((c) => parseFloat(c.amount) > 0).map((c, i) => (
                <View key={i} style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{OTHER_COST_TYPES.find((t) => t.key === c.typeKey)?.label ?? c.typeKey}</Text>
                  <Text style={styles.summaryValue}>{formatKES(parseFloat(c.amount))}</Text>
                </View>
              ))}
              <View style={[styles.summaryRow, styles.summaryTotal]}>
                <Text style={styles.summaryTotalLabel}>Total Cost</Text>
                <Text style={styles.summaryTotalValue}>{formatKES(totalCost)}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {step > 1 && (
          <Pressable style={styles.backBtn} onPress={() => setStep((s) => s - 1)}>
            <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
            <Text style={styles.backBtnText}>Back</Text>
          </Pressable>
        )}
        {step < 6 ? (
          <Pressable
            style={[styles.nextBtn, !canProceed && styles.nextBtnDisabled]}
            onPress={() => canProceed && setStep((s) => s + 1)}
          >
            <Text style={styles.nextBtnText}>Continue</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.white} />
          </Pressable>
        ) : (
          <Pressable style={[styles.submitBtn, submitting && { opacity: 0.7 }]} onPress={handleSubmit} disabled={submitting}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
            <Text style={styles.submitBtnText}>{submitting ? "Saving..." : "Submit Activity"}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cardBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.borderLight,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontFamily: "DMSans_700Bold", fontSize: 17, color: COLORS.text },
  stepIndicator: { backgroundColor: COLORS.primarySurface, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  stepText: { fontFamily: "DMSans_600SemiBold", fontSize: 12, color: COLORS.primary },
  progressBar: { height: 3, backgroundColor: COLORS.borderLight, marginHorizontal: 16, borderRadius: 2, overflow: "hidden", marginBottom: 4 },
  progressFill: { height: "100%", backgroundColor: COLORS.primary, borderRadius: 2 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },
  stepContent: { gap: 14 },
  stepTitle: { fontFamily: "DMSans_700Bold", fontSize: 22, color: COLORS.text, letterSpacing: -0.3 },
  stepSubtitle: { fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.textSecondary, marginTop: -8 },
  fieldLabel: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.text },
  fieldLabelSm: { fontFamily: "DMSans_500Medium", fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 },
  fieldHint: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textMuted, marginTop: -8 },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: COLORS.text,
  },
  notesInput: { minHeight: 100, textAlignVertical: "top", paddingTop: 12 },
  typeSelector: { flexDirection: "row", gap: 8 },
  typeOption: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: COLORS.borderLight,
    alignItems: "center",
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  typeOptionActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeOptionText: { fontFamily: "DMSans_600SemiBold", fontSize: 12, color: COLORS.textSecondary },
  typeOptionTextActive: { color: COLORS.white },
  activityList: { gap: 6 },
  activityOption: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 12, borderRadius: 10,
    backgroundColor: COLORS.background,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  activityOptionSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySurface },
  activityOptionLeft: { flex: 1, gap: 2 },
  activityOptionName: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.text },
  activityOptionDate: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textMuted },
  sectionSelector: { flexDirection: "row", gap: 8 },
  sectionOption: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center",
    backgroundColor: COLORS.borderLight, borderWidth: 1.5, borderColor: COLORS.border,
  },
  sectionOptionActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  sectionOptionText: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.textSecondary },
  sectionOptionTextActive: { color: COLORS.white },
  dateDisplayBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: COLORS.primarySurface, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1.5, borderColor: COLORS.primary,
    marginBottom: 12,
  },
  dateDisplayText: {
    fontFamily: "DMSans_600SemiBold", fontSize: 15, color: COLORS.primary, flex: 1,
  },
  quickDateRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  quickDateChip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    backgroundColor: COLORS.borderLight,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  quickDateChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  quickDateChipText: { fontFamily: "DMSans_500Medium", fontSize: 13, color: COLORS.textSecondary },
  quickDateChipTextActive: { color: COLORS.white },
  laborModeRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  laborModeChip: {
    flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10,
    backgroundColor: COLORS.borderLight, borderWidth: 1.5, borderColor: COLORS.border,
  },
  laborModeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  laborModeChipText: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.textSecondary },
  laborModeChipTextActive: { color: COLORS.white },
  waterRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 8 },
  waterX: { fontFamily: "DMSans_700Bold", fontSize: 20, color: COLORS.textMuted, paddingBottom: 12 },
  weatherSelector: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  weatherOption: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
    backgroundColor: COLORS.borderLight,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  weatherOptionActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primaryLight },
  weatherOptionText: { fontFamily: "DMSans_500Medium", fontSize: 12, color: COLORS.textSecondary },
  weatherOptionTextActive: { color: COLORS.white },
  productCard: {
    backgroundColor: COLORS.background, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.border, padding: 12, gap: 10,
  },
  productCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  productCardName: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.text, flex: 1 },
  deviationRow: { flexDirection: "row", gap: 8 },
  deviationBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
    paddingVertical: 8, borderRadius: 8,
    backgroundColor: COLORS.borderLight, borderWidth: 1, borderColor: COLORS.border,
  },
  deviationBtnActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primaryLight },
  deviationBtnDeviation: { backgroundColor: COLORS.amber, borderColor: COLORS.amber },
  deviationBtnText: { fontFamily: "DMSans_500Medium", fontSize: 11, color: COLORS.textSecondary },
  deviationBtnTextActive: { color: COLORS.white },
  productInputRow: { flexDirection: "row", gap: 8 },
  productTotal: { fontFamily: "DMSans_600SemiBold", fontSize: 12, color: COLORS.primary },
  addProductBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1.5, borderColor: COLORS.primaryLight,
    borderStyle: "dashed",
  },
  addProductBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.primary },
  laborTotal: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: COLORS.primarySurface, borderRadius: 10, padding: 14,
  },
  laborTotalLabel: { fontFamily: "DMSans_600SemiBold", fontSize: 14, color: COLORS.primary },
  laborTotalValue: { fontFamily: "DMSans_700Bold", fontSize: 18, color: COLORS.primary },
  amountRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  kesPre: { fontFamily: "DMSans_700Bold", fontSize: 14, color: COLORS.primary },
  otherCostCard: {
    backgroundColor: COLORS.background, borderRadius: 10,
    borderWidth: 1.5, borderColor: COLORS.border, padding: 12, gap: 8,
  },
  otherCostHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  otherCostTitle: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.text },
  typeChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: COLORS.borderLight, borderWidth: 1.5, borderColor: COLORS.border,
  },
  typeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeChipText: { fontFamily: "DMSans_500Medium", fontSize: 12, color: COLORS.textSecondary },
  typeChipTextActive: { color: COLORS.white },
  summaryCard: {
    backgroundColor: COLORS.borderLight, borderRadius: 14, padding: 16, gap: 10,
  },
  summaryTitle: { fontFamily: "DMSans_700Bold", fontSize: 15, color: COLORS.text, marginBottom: 4 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  summaryLabel: { fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  summaryValue: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.text, textAlign: "right", flex: 2 },
  summaryTotal: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10, marginTop: 4 },
  summaryTotalLabel: { fontFamily: "DMSans_700Bold", fontSize: 15, color: COLORS.primary, flex: 1 },
  summaryTotalValue: { fontFamily: "DMSans_700Bold", fontSize: 18, color: COLORS.primary, textAlign: "right" },
  footer: {
    flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: COLORS.borderLight,
    backgroundColor: COLORS.cardBg,
  },
  backBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12,
    backgroundColor: COLORS.borderLight,
  },
  backBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 14, color: COLORS.primary },
  nextBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14,
  },
  nextBtnDisabled: { backgroundColor: COLORS.border },
  nextBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 15, color: COLORS.white },
  submitBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14,
  },
  submitBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 15, color: COLORS.white },
});
