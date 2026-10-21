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
import { CROP_TEMPLATES, generatePlannedSchedule, getTemplate } from "@/constants/farmData";
import { getCropMeta } from "@/constants/cropTemplates";
import { CropBlock, formatDate, formatKES } from "@/lib/storage";
import { addCost } from "@/lib/supabase-storage";
import * as Haptics from "expo-haptics";

const SEASON_TYPES = ["Long Rains", "Short Rains", "Irrigation Season"];

interface PlannerRow {
  id: string;
  category: string;
  subcategory: string;
  description: string;
  amount: string;
  enabled: boolean;
}

interface PlantingDraft {
  id: string;
  name: string;
  variety: string;
  customVariety: string;
  planting_date: string;
  acres: string;
}

function makePlannerRows(rows: ReturnType<typeof getCropMeta>["prePlanting"]): PlannerRow[] {
  return rows.map((row) => ({
    id: genId(),
    category: row.category,
    subcategory: row.subcategory,
    description: row.description,
    amount: row.defaultAmount,
    enabled: true,
  }));
}

function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().split("T")[0];
}

function isValidIsoDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function isPositiveNumber(value: string): boolean {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

function createPlantingDraft(variety: string): PlantingDraft {
  return {
    id: genId(),
    name: "",
    variety,
    customVariety: "",
    planting_date: new Date().toISOString().split("T")[0],
    acres: "2",
  };
}

export default function SeasonSetupScreen() {
  const insets = useSafeAreaInsets();
  const { createSeason, seasons, farmId } = useFarm();

  const nextSeasonNumber = (seasons.length || 0) + 1;
  const TOTAL_STEPS = 4;

  const [step, setStep] = useState(1);
  const [seasonName, setSeasonName] = useState(`Season ${nextSeasonNumber}`);
  const [seasonType, setSeasonType] = useState(SEASON_TYPES[0]);

  const [cropId, setCropId] = useState(CROP_TEMPLATES[0].id);
  const template = getTemplate(cropId);
  const meta = getCropMeta(template.id);
  const VARIETIES = meta.varieties;

  const [plantingDrafts, setPlantingDrafts] = useState<PlantingDraft[]>(() => [
    createPlantingDraft(getCropMeta(CROP_TEMPLATES[0].id).varieties[0].label),
  ]);
  const [prePlantingDate, setPrePlantingDate] = useState(
    addDays(new Date().toISOString().split("T")[0], -template.prePlantingLeadDays),
  );
  const [seasonNotes, setSeasonNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Pre-planting cost planner state
  const [plannerRows, setPlannerRows] = useState<PlannerRow[]>(() => makePlannerRows(meta.prePlanting));

  const plantingBlocks: CropBlock[] = plantingDrafts.map((draft, index) => {
    const variety = VARIETIES.find((item) => item.label === draft.variety) || VARIETIES[0];
    return {
      id: draft.id,
      name: draft.name.trim() || `Block ${index + 1}`,
      variety: draft.variety === "Custom" ? draft.customVariety.trim() : draft.variety,
      planting_date: draft.planting_date,
      acres: parseFloat(draft.acres) || 0,
      blight_risk: variety.blightRisk,
      notes: null,
    };
  });
  const previewSchedule = generatePlannedSchedule(template, plantingBlocks);
  const totalPlantedAcres = plantingBlocks.reduce((total, block) => total + block.acres, 0);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const canProceedStep1 = seasonName.trim().length > 0;
  const canProceedStep2 = plantingDrafts.length > 0 && plantingDrafts.every((draft) => {
    const varietyName = draft.variety === "Custom" ? draft.customVariety : draft.variety;
    return varietyName.trim().length > 0 &&
      isValidIsoDate(draft.planting_date) &&
      isPositiveNumber(draft.acres);
  });

  const enabledPlannerRows = plannerRows.filter((r) => r.enabled && r.amount.trim() !== "");
  const plannerTotal = enabledPlannerRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  const updatePlantingDraft = (
    id: string,
    field: keyof Omit<PlantingDraft, "id">,
    value: string,
  ) => {
    setPlantingDrafts((previous) =>
      previous.map((draft) => draft.id === id ? { ...draft, [field]: value } : draft),
    );
  };

  const handleAddPlanting = () => {
    Haptics.selectionAsync();
    setPlantingDrafts((previous) => [
      ...previous,
      createPlantingDraft(VARIETIES[0].label),
    ]);
  };

  const handleRemovePlanting = (id: string) => {
    setPlantingDrafts((previous) =>
      previous.length > 1 ? previous.filter((draft) => draft.id !== id) : previous,
    );
  };

  const handleAddCustomRow = () => {
    setPlannerRows((prev) => [
      ...prev,
      { id: genId(), category: "Pre-Planting", subcategory: "Other Pre-Planting", description: "", amount: "", enabled: true },
    ]);
  };

  const handleToggleRow = (id: string) => {
    Haptics.selectionAsync();
    setPlannerRows((prev) => prev.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const handleUpdateRow = (id: string, field: "description" | "amount", value: string) => {
    setPlannerRows((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleRemoveRow = (id: string) => {
    setPlannerRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSelectCrop = (id: string) => {
    if (id === cropId) return;
    Haptics.selectionAsync();
    const nextTemplate = getTemplate(id);
    const nextMeta = getCropMeta(nextTemplate.id);
    setCropId(nextTemplate.id);
    setPlantingDrafts((previous) =>
      previous.map((draft) => ({
        ...draft,
        variety: nextMeta.varieties[0].label,
        customVariety: "",
      })),
    );
    setPrePlantingDate(addDays(
      plantingDrafts[0]?.planting_date || new Date().toISOString().split("T")[0],
      -nextTemplate.prePlantingLeadDays,
    ));
    setPlannerRows(makePlannerRows(nextMeta.prePlanting));
  };

  const handleSubmit = async () => {
    if (!farmId) {
      Alert.alert("Select a farm", "Choose a farm before creating a season.");
      return;
    }
    if (!canProceedStep1 || !canProceedStep2) {
      Alert.alert("Incomplete season", "Review the season name, varieties, planting dates, and block sizes.");
      return;
    }
    setSubmitting(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const newSeason = await createSeason({
        farm_id: farmId,
        season_number: nextSeasonNumber,
        season_name: seasonName.trim(),
        season_type: seasonType,
        status: "active",
        template_id: template.id,
        blocks: plantingBlocks,
        section_a: { ...plantingBlocks[0] },
        section_b: plantingBlocks[1]
          ? { ...plantingBlocks[1] }
          : {
              variety: "Not planted",
              planting_date: plantingBlocks[0].planting_date,
              acres: 0,
              blight_risk: VARIETIES[1]?.blightRisk || VARIETIES[0].blightRisk,
              notes: null,
            },
        pre_planting_start_date: prePlantingDate || null,
        budget_kes: null,
        total_revenue_kes: null,
        total_cost_kes: null,
        notes: seasonNotes || null,
        closed_at: null,
      });

      // Save enabled planner cost rows
      const today = prePlantingDate || new Date().toISOString().split("T")[0];
      for (const row of enabledPlannerRows) {
        if (!row.description.trim()) continue;
        const amount = parseFloat(row.amount) || 0;
        if (amount <= 0) continue;
        await addCost({
          farm_id: farmId,
          season_id: newSeason.id,
          section_id: null,
          cost_category: row.category,
          cost_subcategory: row.subcategory,
          description: row.description.trim(),
          cost_date: today,
          is_pre_planting: true,
          is_historical: true,
          amount_kes: amount,
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
          notes: "Auto-entered from season setup planner",
          weather_conditions: null,
        });
      }

      router.replace("/(tabs)");
    } catch {
      Alert.alert("Error", "Failed to create season. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const canProceedCurrent = () => {
    if (step === 1) return canProceedStep1;
    if (step === 2) return canProceedStep2;
    return true;
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn} hitSlop={12}>
          <Ionicons name="close" size={22} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>New Season Setup</Text>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>{step}/{TOTAL_STEPS}</Text>
        </View>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── STEP 1: Season Details ── */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <Ionicons name="leaf-outline" size={28} color={COLORS.primary} />
              <Text style={styles.stepTitle}>Season Details</Text>
              <Text style={styles.stepSubtitle}>Choose a crop, name your season and select the type</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Crop</Text>
              <View style={styles.chipRow}>
                {CROP_TEMPLATES.map((crop) => (
                  <Pressable
                    key={crop.id}
                    style={[styles.chip, cropId === crop.id && styles.chipActive]}
                    onPress={() => handleSelectCrop(crop.id)}
                  >
                    <Text style={[styles.chipText, cropId === crop.id && styles.chipTextActive]}>{crop.cropType}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.fieldHint}>Each season tracks one crop. Varieties, schedule and harvest units follow this choice; start another season for a different crop.</Text>
              {cropId !== CROP_TEMPLATES[0].id && (
                <Text style={styles.fieldHint}>This crop schedule is draft guidance. Confirm locally with an agronomist before use.</Text>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Season Name</Text>
              <TextInput
                style={styles.input}
                value={seasonName}
                onChangeText={setSeasonName}
                placeholder="e.g. Long Rains 2027"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Season Type</Text>
              <View style={styles.chipRow}>
                {SEASON_TYPES.map((type) => (
                  <Pressable
                    key={type}
                    style={[styles.chip, seasonType === type && styles.chipActive]}
                    onPress={() => { Haptics.selectionAsync(); setSeasonType(type); }}
                  >
                    <Text style={[styles.chipText, seasonType === type && styles.chipTextActive]}>{type}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Pre-Planting Start Date (optional)</Text>
              <TextInput
                style={styles.input}
                value={prePlantingDate}
                onChangeText={setPrePlantingDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numbers-and-punctuation"
              />
              <Text style={styles.fieldHint}>Date when land preparation and seed buying started</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={seasonNotes}
                onChangeText={setSeasonNotes}
                placeholder="Any notes about this season plan"
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>
        )}

        {/* ── STEP 2: Planting blocks ── */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <Ionicons name="grid-outline" size={28} color={COLORS.primary} />
              <Text style={styles.stepTitle}>Planting blocks</Text>
              <Text style={styles.stepSubtitle}>
                Add each planting separately. Use another block when its date, area, or variety is different.
              </Text>
            </View>

            {plantingDrafts.map((draft, index) => {
              const selectedVariety = VARIETIES.find((item) => item.label === draft.variety) || VARIETIES[0];
              const estimatedHarvest = isValidIsoDate(draft.planting_date)
                ? addDays(draft.planting_date, selectedVariety.maturityDays)
                : null;
              const riskColor = selectedVariety.blightRisk === "HIGH"
                ? COLORS.red
                : selectedVariety.blightRisk === "MEDIUM"
                ? COLORS.amber
                : COLORS.primary;
              const riskBackground = selectedVariety.blightRisk === "HIGH"
                ? COLORS.redLight
                : selectedVariety.blightRisk === "MEDIUM"
                ? COLORS.amberLight
                : COLORS.primarySurface;

              return (
                <View key={draft.id} style={styles.plantingCard}>
                  <View style={styles.plantingHeader}>
                    <View style={styles.plantingTitleGroup}>
                      <Text style={styles.plantingTitle}>{draft.name.trim() || `Block ${index + 1}`}</Text>
                      <Text style={styles.plantingSubtitle}>Planting {index + 1}</Text>
                    </View>
                    <View style={styles.plantingHeaderActions}>
                      <View style={[styles.riskBadge, { backgroundColor: riskBackground }]}>
                        <Text style={[styles.riskText, { color: riskColor }]}>{selectedVariety.blightRisk} RISK</Text>
                      </View>
                      {plantingDrafts.length > 1 && (
                        <Pressable
                          testID={`remove-planting-${index + 1}`}
                          style={styles.removePlantingButton}
                          onPress={() => handleRemovePlanting(draft.id)}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove Block ${index + 1}`}
                        >
                          <Ionicons name="trash-outline" size={18} color={COLORS.red} />
                        </Pressable>
                      )}
                    </View>
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Block name (optional)</Text>
                    <TextInput
                      style={styles.input}
                      value={draft.name}
                      onChangeText={(value) => updatePlantingDraft(draft.id, "name", value)}
                      placeholder={`Block ${index + 1} — e.g. Upper Field`}
                      placeholderTextColor={COLORS.textMuted}
                      testID={`planting-${index + 1}-name`}
                    />
                  </View>

                  <Text style={styles.fieldLabel}>Variety</Text>
                  <View style={styles.chipRow}>
                    {VARIETIES.map((variety) => (
                      <Pressable
                        key={variety.label}
                        testID={`planting-${index + 1}-variety-${variety.label}`}
                        style={[styles.chip, draft.variety === variety.label && styles.chipActive]}
                        onPress={() => {
                          Haptics.selectionAsync();
                          updatePlantingDraft(draft.id, "variety", variety.label);
                          if (variety.label !== "Custom") updatePlantingDraft(draft.id, "customVariety", "");
                        }}
                      >
                        <Text style={[styles.chipText, draft.variety === variety.label && styles.chipTextActive]}>
                          {variety.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {draft.variety === "Custom" && (
                    <View style={styles.field}>
                      <Text style={styles.fieldLabel}>Custom variety</Text>
                      <TextInput
                        style={styles.input}
                        value={draft.customVariety}
                        onChangeText={(value) => updatePlantingDraft(draft.id, "customVariety", value)}
                        placeholder="Enter variety name"
                        placeholderTextColor={COLORS.textMuted}
                        testID={`planting-${index + 1}-custom-variety`}
                      />
                    </View>
                  )}

                  <View style={styles.plantingFieldsRow}>
                    <View style={[styles.field, styles.plantingField]}>
                      <Text style={styles.fieldLabel}>{meta.plantingVerb} date</Text>
                      <TextInput
                        style={styles.input}
                        value={draft.planting_date}
                        onChangeText={(value) => updatePlantingDraft(draft.id, "planting_date", value)}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={COLORS.textMuted}
                        keyboardType="numbers-and-punctuation"
                        testID={`planting-${index + 1}-date`}
                      />
                    </View>
                    <View style={[styles.field, styles.plantingField]}>
                      <Text style={styles.fieldLabel}>Area (acres)</Text>
                      <TextInput
                        style={styles.input}
                        value={draft.acres}
                        onChangeText={(value) => updatePlantingDraft(draft.id, "acres", value)}
                        placeholder="2"
                        placeholderTextColor={COLORS.textMuted}
                        keyboardType="numeric"
                        testID={`planting-${index + 1}-area`}
                      />
                    </View>
                  </View>

                  {estimatedHarvest && (
                    <View style={styles.harvestPreview}>
                      <Ionicons name="sunny-outline" size={16} color={COLORS.amber} />
                      <Text style={styles.harvestPreviewText}>
                        Estimated harvest: <Text style={{ fontFamily: "DMSans_700Bold" }}>{formatDate(estimatedHarvest)}</Text>
                        {" "}({selectedVariety.maturityDays} days)
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}

            <Pressable
              testID="add-planting-block"
              style={styles.addPlantingButton}
              onPress={handleAddPlanting}
              accessibilityRole="button"
            >
              <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
              <Text style={styles.addPlantingButtonText}>Add planting</Text>
            </Pressable>

            <View style={styles.plantingTotalCard}>
              <Text style={styles.plantingTotalLabel}>Season planting total</Text>
              <Text style={styles.plantingTotalValue}>
                {plantingBlocks.length} {plantingBlocks.length === 1 ? "planting" : "plantings"} · {totalPlantedAcres.toFixed(2)} acres
              </Text>
            </View>
          </View>
        )}

        {/* ── STEP 3: Pre-Planting Cost Planner ── */}
        {step === 3 && (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <Ionicons name="wallet-outline" size={28} color={COLORS.amber} />
              <Text style={styles.stepTitle}>Pre-Planting Budget</Text>
              <Text style={styles.stepSubtitle}>
                Tick the costs you&apos;ve incurred and enter the amounts. These will be saved to your cost ledger automatically.
              </Text>
            </View>

            <View style={styles.plannerTotalCard}>
              <View>
                <Text style={styles.plannerTotalLabel}>Budget total</Text>
                <Text style={styles.plannerTotalValue}>{formatKES(plannerTotal)}</Text>
              </View>
              <View style={styles.plannerTotalRight}>
                <Text style={styles.plannerTotalSub}>{enabledPlannerRows.length} items</Text>
                <Pressable style={styles.skipHintBtn} onPress={() => setStep(4)}>
                  <Text style={styles.skipHintText}>Skip for now</Text>
                </Pressable>
              </View>
            </View>

            {plannerRows.map((row) => (
              <View key={row.id} style={[styles.plannerRow, !row.enabled && styles.plannerRowDisabled]}>
                <Pressable style={styles.plannerCheckbox} onPress={() => handleToggleRow(row.id)} hitSlop={8}>
                  <Ionicons
                    name={row.enabled ? "checkmark-circle" : "ellipse-outline"}
                    size={22}
                    color={row.enabled ? COLORS.primary : COLORS.borderLight}
                  />
                </Pressable>
                <View style={styles.plannerRowBody}>
                  <TextInput
                    style={[styles.plannerDescInput, !row.enabled && { color: COLORS.textMuted }]}
                    value={row.description}
                    onChangeText={(v) => handleUpdateRow(row.id, "description", v)}
                    placeholder="Description"
                    placeholderTextColor={COLORS.textMuted}
                    editable={row.enabled}
                  />
                  <View style={styles.plannerAmountRow}>
                    <Text style={styles.plannerCurrency}>KES</Text>
                    <TextInput
                      style={[styles.plannerAmountInput, !row.enabled && { color: COLORS.textMuted }]}
                      value={row.amount}
                      onChangeText={(v) => handleUpdateRow(row.id, "amount", v)}
                      placeholder="0"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="numeric"
                      editable={row.enabled}
                    />
                  </View>
                </View>
                <Pressable onPress={() => handleRemoveRow(row.id)} hitSlop={8} style={styles.plannerRemoveBtn}>
                  <Ionicons name="close-circle-outline" size={18} color={COLORS.textMuted} />
                </Pressable>
              </View>
            ))}

            <Pressable style={styles.addRowBtn} onPress={handleAddCustomRow}>
              <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
              <Text style={styles.addRowBtnText}>Add custom cost item</Text>
            </Pressable>

            <View style={styles.plannerNote}>
              <Ionicons name="information-circle-outline" size={14} color={COLORS.primary} />
              <Text style={styles.plannerNoteText}>
                Unticked items are skipped. You can always add more costs from the Cost Ledger after setup.
              </Text>
            </View>
          </View>
        )}

        {/* ── STEP 4: Generated Schedule ── */}
        {step === 4 && (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <Ionicons name="calendar-outline" size={28} color={COLORS.primary} />
              <Text style={styles.stepTitle}>Generated Schedule</Text>
              <Text style={styles.stepSubtitle}>
                Review the {template.cropType} schedule for {seasonName}
              </Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>{seasonName} · {template.cropType}</Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Type</Text>
                  <Text style={styles.summaryValue}>{seasonType}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Season planting total</Text>
                  <Text style={styles.summaryValue}>
                    {plantingBlocks.length} {plantingBlocks.length === 1 ? "planting" : "plantings"} · {totalPlantedAcres.toFixed(2)} acres
                  </Text>
                </View>
              </View>
              {plantingBlocks.map((block) => (
                <View key={block.id} style={styles.summaryPlantingRow}>
                  <Text style={styles.summaryLabel}>{block.name} · {block.variety}</Text>
                  <Text style={styles.summaryValue}>
                    {formatDate(block.planting_date)} · {block.acres} acres
                  </Text>
                </View>
              ))}
              {plannerTotal > 0 && (
                <View style={styles.summaryBudgetRow}>
                  <Ionicons name="wallet-outline" size={14} color={COLORS.amber} />
                  <Text style={styles.summaryBudgetText}>
                    {enabledPlannerRows.length} pre-planting costs · {formatKES(plannerTotal)} will be saved
                  </Text>
                </View>
              )}
            </View>

            {template.notes ? (
              <View style={styles.plannerNote}>
                <Ionicons name="information-circle-outline" size={14} color={COLORS.primary} />
                <Text style={styles.plannerNoteText}>{template.notes}</Text>
              </View>
            ) : null}

            <Text style={styles.scheduleLabel}>
              {previewSchedule.length} activities across {plantingBlocks.length} {plantingBlocks.length === 1 ? "block" : "blocks"} generated from {meta.plantingVerb.toLowerCase()} dates
            </Text>

            {previewSchedule.map((activity, idx) => {
              const stageNumber = template.stages.findIndex((stage) => stage.title === activity.stage) + 1;
              return (
                <View key={activity.id} style={styles.scheduleRow}>
                  <View style={styles.scheduleRowLeft}>
                    <View style={[styles.scheduleNum, { backgroundColor: COLORS.primarySurface }]}>
                      <Text style={styles.scheduleNumText}>{stageNumber || idx + 1}</Text>
                    </View>
                    <View style={styles.scheduleInfo}>
                      <Text style={styles.scheduleName}>{activity.name}</Text>
                      <Text style={styles.scheduleDate}>
                        {activity.blockName}: {formatDate(activity.plannedDate)}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.scheduleTypeBadge, { backgroundColor: getTypeColor(activity.activityType).bg }]}>
                    <Text style={[styles.scheduleTypeText, { color: getTypeColor(activity.activityType).color }]}>
                      {activity.activityType.split(" ")[0]}
                    </Text>
                  </View>
                </View>
              );
            })}

            <View style={styles.confirmNote}>
              <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} />
              <Text style={styles.confirmNoteText}>
                Dates are calculated from your planting date. You can log activities as they happen — the schedule adjusts to your actual timing.
              </Text>
            </View>
          </View>
        )}

        {/* ── Navigation ── */}
        <View style={styles.navRow}>
          {step > 1 && (
            <Pressable
              style={styles.backBtn}
              onPress={() => { Haptics.selectionAsync(); setStep(step - 1); }}
            >
              <Ionicons name="arrow-back" size={18} color={COLORS.textSecondary} />
              <Text style={styles.backBtnText}>Back</Text>
            </Pressable>
          )}
          <View style={{ flex: 1 }} />
          {step < TOTAL_STEPS ? (
            <Pressable
              style={[styles.nextBtn, !canProceedCurrent() && { opacity: 0.4 }]}
              disabled={!canProceedCurrent()}
              onPress={() => {
                Haptics.selectionAsync();
                setStep(step + 1);
              }}
            >
              <Text style={styles.nextBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
            </Pressable>
          ) : (
            <Pressable
              style={[styles.nextBtn, { backgroundColor: COLORS.primaryLight }, submitting && { opacity: 0.6 }]}
              disabled={submitting}
              onPress={handleSubmit}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.white} />
              <Text style={styles.nextBtnText}>{submitting ? "Starting..." : "Start Season"}</Text>
            </Pressable>
          )}
        </View>

        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>
    </View>
  );
}

function getTypeColor(type: string) {
  switch (type) {
    case "Spray": return { bg: COLORS.primarySurface, color: COLORS.primary };
    case "Herbicide": return { bg: COLORS.amberLight, color: COLORS.amber };
    case "Earthing Up + Fertilizer":
    case "Earthing Up": return { bg: COLORS.primarySurface, color: COLORS.teal };
    case "Harvest": return { bg: COLORS.primarySurface, color: COLORS.primaryLight };
    case "Observation": return { bg: COLORS.borderLight, color: COLORS.textSecondary };
    case "Cost Capture": return { bg: COLORS.amberLight, color: COLORS.amber };
    default: return { bg: COLORS.borderLight, color: COLORS.textSecondary };
  }
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
  stepBadge: {
    backgroundColor: COLORS.primarySurface, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  stepBadgeText: { fontFamily: "DMSans_700Bold", fontSize: 12, color: COLORS.primary },
  progressBar: { height: 3, backgroundColor: COLORS.borderLight },
  progressFill: { height: 3, backgroundColor: COLORS.primary },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 20 },
  stepContent: { gap: 20 },
  stepHeader: { alignItems: "center", gap: 6, paddingVertical: 8 },
  stepTitle: { fontFamily: "DMSans_700Bold", fontSize: 22, color: COLORS.text, textAlign: "center" },
  stepSubtitle: { fontFamily: "DMSans_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center", lineHeight: 20 },
  field: { gap: 6 },
  fieldLabel: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.text },
  fieldHint: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textMuted },
  input: {
    backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontFamily: "DMSans_400Regular", fontSize: 15, color: COLORS.text,
  },
  notesInput: { height: 90, textAlignVertical: "top", paddingTop: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10,
    backgroundColor: COLORS.borderLight, borderWidth: 1.5, borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primarySurface, borderColor: COLORS.primary },
  chipText: { fontFamily: "DMSans_500Medium", fontSize: 13, color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.primary, fontFamily: "DMSans_700Bold" },
  harvestPreview: {
    flexDirection: "row", gap: 8, alignItems: "center",
    backgroundColor: COLORS.amberLight, borderRadius: 10, padding: 12,
  },
  harvestPreviewText: { fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.amberDark, flex: 1 },
  varietyGrid: { gap: 10 },
  varietyCard: {
    backgroundColor: COLORS.background, borderRadius: 12, padding: 14,
    borderWidth: 1.5, borderColor: COLORS.border, gap: 4,
  },
  varietyCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySurface },
  varietyCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  varietyName: { fontFamily: "DMSans_700Bold", fontSize: 15, color: COLORS.text },
  riskBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  riskText: { fontFamily: "DMSans_700Bold", fontSize: 11 },
  varietyNote: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary },
  plantingCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  plantingHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  plantingTitleGroup: { flex: 1, gap: 2 },
  plantingTitle: { fontFamily: "DMSans_700Bold", fontSize: 16, color: COLORS.text },
  plantingSubtitle: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary },
  plantingHeaderActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  removePlantingButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  plantingFieldsRow: { flexDirection: "row", gap: 10 },
  plantingField: { flex: 1, minWidth: 0 },
  addPlantingButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderStyle: "dashed",
    backgroundColor: COLORS.primarySurface,
  },
  addPlantingButtonText: { fontFamily: "DMSans_700Bold", fontSize: 14, color: COLORS.primary },
  plantingTotalCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: COLORS.primarySurface,
  },
  plantingTotalLabel: { fontFamily: "DMSans_500Medium", fontSize: 12, color: COLORS.textSecondary },
  plantingTotalValue: { fontFamily: "DMSans_700Bold", fontSize: 13, color: COLORS.primary, textAlign: "right" },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  toggleSwitch: {
    width: 48, height: 28, borderRadius: 14, backgroundColor: COLORS.borderLight,
    justifyContent: "center", padding: 2,
  },
  toggleSwitchOn: { backgroundColor: COLORS.primary },
  toggleKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.white },
  toggleKnobOn: { alignSelf: "flex-end" },
  // Planner
  plannerTotalCard: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: COLORS.amberLight, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLORS.amber + "40",
  },
  plannerTotalLabel: { fontFamily: "DMSans_600SemiBold", fontSize: 12, color: COLORS.amberDark },
  plannerTotalValue: { fontFamily: "DMSans_700Bold", fontSize: 22, color: COLORS.amberDark, marginTop: 2 },
  plannerTotalRight: { alignItems: "flex-end", gap: 6 },
  plannerTotalSub: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.amberDark },
  skipHintBtn: { backgroundColor: COLORS.white + "80", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  skipHintText: { fontFamily: "DMSans_600SemiBold", fontSize: 11, color: COLORS.amberDark },
  plannerRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: COLORS.background, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: COLORS.borderLight,
  },
  plannerRowDisabled: { opacity: 0.45 },
  plannerCheckbox: { marginTop: 2 },
  plannerRowBody: { flex: 1, gap: 8 },
  plannerDescInput: {
    fontFamily: "DMSans_500Medium", fontSize: 14, color: COLORS.text,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight, paddingBottom: 4,
  },
  plannerAmountRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  plannerCurrency: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.textSecondary },
  plannerAmountInput: {
    flex: 1, fontFamily: "DMSans_700Bold", fontSize: 16, color: COLORS.text,
  },
  plannerRemoveBtn: { marginTop: 2 },
  addRowBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: COLORS.primarySurface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: COLORS.primary + "30",
  },
  addRowBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 14, color: COLORS.primary },
  plannerNote: {
    flexDirection: "row", gap: 8, alignItems: "flex-start",
    backgroundColor: COLORS.primarySurface, borderRadius: 10, padding: 12,
  },
  plannerNoteText: { flex: 1, fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.primary, lineHeight: 18 },
  // Summary / schedule
  summaryCard: {
    backgroundColor: COLORS.primarySurface, borderRadius: 14, padding: 16, gap: 12,
    borderWidth: 1, borderColor: COLORS.primaryLight + "40",
  },
  summaryTitle: { fontFamily: "DMSans_700Bold", fontSize: 18, color: COLORS.primary },
  summaryRow: { flexDirection: "row", gap: 16 },
  summaryItem: { flex: 1, gap: 2 },
  summaryLabel: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textSecondary },
  summaryValue: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.text },
  summaryPlantingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: 8,
  },
  summaryBudgetRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 4, borderTopWidth: 1, borderTopColor: COLORS.primaryLight + "30" },
  summaryBudgetText: { fontFamily: "DMSans_500Medium", fontSize: 12, color: COLORS.amber },
  scheduleLabel: {
    fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textMuted, textAlign: "center",
  },
  scheduleRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: COLORS.background, borderRadius: 10, padding: 12, gap: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  scheduleRowLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  scheduleNum: {
    width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center",
  },
  scheduleNumText: { fontFamily: "DMSans_700Bold", fontSize: 12, color: COLORS.primary },
  scheduleInfo: { flex: 1, gap: 2 },
  scheduleName: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.text },
  scheduleDate: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textSecondary },
  scheduleTypeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  scheduleTypeText: { fontFamily: "DMSans_600SemiBold", fontSize: 10 },
  confirmNote: {
    flexDirection: "row", gap: 10, alignItems: "flex-start",
    backgroundColor: COLORS.primarySurface, borderRadius: 10, padding: 14,
  },
  confirmNoteText: {
    flex: 1, fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.primaryLight, lineHeight: 19,
  },
  navRow: { flexDirection: "row", alignItems: "center", marginTop: 24, gap: 12 },
  backBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12,
    backgroundColor: COLORS.borderLight, borderWidth: 1, borderColor: COLORS.border,
  },
  backBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 14, color: COLORS.textSecondary },
  nextBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 6,
  },
  nextBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 15, color: COLORS.white },
});