import React, { useState, useMemo } from "react";
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
import { CROP_TEMPLATES, generatePlannedSchedule } from "@/constants/farmData";
import { formatDate, formatKES } from "@/lib/storage";
import * as Haptics from "expo-haptics";

const VARIETIES = [
  { label: "Stephen's", blightRisk: "HIGH" as const, maturityDays: 72, note: "72 days, HIGH blight risk" },
  { label: "Shangi", blightRisk: "MEDIUM" as const, maturityDays: 82, note: "72–90 days, MEDIUM blight risk" },
  { label: "Kenya Mpya", blightRisk: "LOW" as const, maturityDays: 95, note: "90–100 days, LOW blight risk" },
  { label: "Markies", blightRisk: "LOW" as const, maturityDays: 110, note: "100–120 days, LOW blight risk" },
  { label: "Dutch Robjin", blightRisk: "MEDIUM" as const, maturityDays: 95, note: "90–100 days, MEDIUM blight risk" },
  { label: "Unica", blightRisk: "MEDIUM" as const, maturityDays: 95, note: "90–100 days, MEDIUM blight risk" },
  { label: "Custom", blightRisk: "MEDIUM" as const, maturityDays: 90, note: "Enter your own variety" },
];

const SEASON_TYPES = ["Long Rains", "Short Rains", "Irrigation Season"];

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export default function SeasonSetupScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { createSeason, seasons, activeSeason } = useFarm();

  const nextSeasonNumber = (seasons.length || 0) + 1;

  const [step, setStep] = useState(1);
  const [seasonName, setSeasonName] = useState(`Season ${nextSeasonNumber}`);
  const [seasonType, setSeasonType] = useState(SEASON_TYPES[0]);

  const [varietyA, setVarietyA] = useState(VARIETIES[0].label);
  const [customVarietyA, setCustomVarietyA] = useState("");
  const [plantingDateA, setPlantingDateA] = useState(new Date().toISOString().split("T")[0]);
  const [acresA, setAcresA] = useState("2");

  const [varietyB, setVarietyB] = useState(VARIETIES[1].label);
  const [customVarietyB, setCustomVarietyB] = useState("");
  const [plantingDateB, setPlantingDateB] = useState(new Date().toISOString().split("T")[0]);
  const [acresB, setAcresB] = useState("2");
  const [useSectionB, setUseSectionB] = useState(true);

  const [prePlantingDate, setPrePlantingDate] = useState(addDays(plantingDateA, -14));
  const [seasonNotes, setSeasonNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedVarA = VARIETIES.find((v) => v.label === varietyA) || VARIETIES[0];
  const selectedVarB = VARIETIES.find((v) => v.label === varietyB) || VARIETIES[1];

  const actualVarietyA = varietyA === "Custom" ? customVarietyA : varietyA;
  const actualVarietyB = varietyB === "Custom" ? customVarietyB : varietyB;

  const template = CROP_TEMPLATES[0];
  const previewSchedule = useMemo(
    () => generatePlannedSchedule(template, plantingDateA),
    [plantingDateA, template]
  );

  const estimatedHarvestA = addDays(plantingDateA, selectedVarA.maturityDays);
  const estimatedHarvestB = useSectionB ? addDays(plantingDateB, selectedVarB.maturityDays) : null;

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const canProceedStep1 = seasonName.trim().length > 0;
  const canProceedStep2 = plantingDateA.length === 10 && (!useSectionB || plantingDateB.length === 10);
  const canProceedStep3 = !useSectionB || actualVarietyB.length > 0;

  const handleSubmit = async () => {
    if (!actualVarietyA) {
      Alert.alert("Missing", "Please enter Section A variety name.");
      return;
    }
    setSubmitting(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await createSeason({
        farm_id: "farm-001",
        season_number: nextSeasonNumber,
        season_name: seasonName.trim(),
        season_type: seasonType,
        status: "active",
        template_id: template.id,
        section_a: {
          variety: actualVarietyA,
          planting_date: plantingDateA,
          acres: parseFloat(acresA) || 2,
          blight_risk: selectedVarA.blightRisk,
          notes: null,
        },
        section_b: {
          variety: actualVarietyB || "Not planted",
          planting_date: useSectionB ? plantingDateB : plantingDateA,
          acres: useSectionB ? (parseFloat(acresB) || 2) : 0,
          blight_risk: selectedVarB.blightRisk,
          notes: null,
        },
        pre_planting_start_date: prePlantingDate || null,
        total_revenue_kes: null,
        total_cost_kes: null,
        notes: seasonNotes || null,
        closed_at: null,
      });
      router.replace("/(tabs)");
    } catch (e) {
      Alert.alert("Error", "Failed to create season. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn} hitSlop={12}>
          <Ionicons name="close" size={22} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>New Season Setup</Text>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>{step}/4</Text>
        </View>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(step / 4) * 100}%` }]} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 && (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <Ionicons name="leaf-outline" size={28} color={COLORS.primary} />
              <Text style={styles.stepTitle}>Season Details</Text>
              <Text style={styles.stepSubtitle}>Name your season and select the type</Text>
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
              <Text style={styles.fieldHint}>Date when land preparation, seed buying starts</Text>
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

        {step === 2 && (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <Ionicons name="grid-outline" size={28} color={COLORS.primary} />
              <Text style={styles.stepTitle}>Section A — Variety</Text>
              <Text style={styles.stepSubtitle}>Choose the crop variety for Section A</Text>
            </View>

            <View style={styles.varietyGrid}>
              {VARIETIES.map((v) => (
                <Pressable
                  key={v.label}
                  style={[styles.varietyCard, varietyA === v.label && styles.varietyCardActive]}
                  onPress={() => { Haptics.selectionAsync(); setVarietyA(v.label); }}
                >
                  <View style={styles.varietyCardHeader}>
                    <Text style={[styles.varietyName, varietyA === v.label && { color: COLORS.primary }]}>{v.label}</Text>
                    <View style={[
                      styles.riskBadge,
                      { backgroundColor: v.blightRisk === "HIGH" ? COLORS.redLight : v.blightRisk === "MEDIUM" ? COLORS.amberLight : COLORS.primarySurface }
                    ]}>
                      <Text style={[
                        styles.riskText,
                        { color: v.blightRisk === "HIGH" ? COLORS.red : v.blightRisk === "MEDIUM" ? COLORS.amber : COLORS.primary }
                      ]}>{v.blightRisk}</Text>
                    </View>
                  </View>
                  <Text style={styles.varietyNote}>{v.note}</Text>
                </Pressable>
              ))}
            </View>

            {varietyA === "Custom" && (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Enter Variety Name</Text>
                <TextInput
                  style={styles.input}
                  value={customVarietyA}
                  onChangeText={setCustomVarietyA}
                  placeholder="e.g. Solara"
                  placeholderTextColor={COLORS.textMuted}
                  autoFocus
                />
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Section A Planting Date</Text>
              <TextInput
                style={styles.input}
                value={plantingDateA}
                onChangeText={setPlantingDateA}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numbers-and-punctuation"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Section A Area (acres)</Text>
              <TextInput
                style={styles.input}
                value={acresA}
                onChangeText={setAcresA}
                placeholder="2"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
              />
            </View>

            {plantingDateA.length === 10 && (
              <View style={styles.harvestPreview}>
                <Ionicons name="sunny-outline" size={16} color={COLORS.amber} />
                <Text style={styles.harvestPreviewText}>
                  Estimated harvest: <Text style={{ fontFamily: "DMSans_700Bold" }}>{formatDate(estimatedHarvestA)}</Text>
                  {" "}({selectedVarA.maturityDays} days)
                </Text>
              </View>
            )}
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <Ionicons name="grid-outline" size={28} color={COLORS.teal} />
              <Text style={styles.stepTitle}>Section B — Variety</Text>
              <Text style={styles.stepSubtitle}>Does Section B have a different variety or planting date?</Text>
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.fieldLabel}>Plant Section B this season</Text>
              <Pressable
                style={[styles.toggleSwitch, useSectionB && styles.toggleSwitchOn]}
                onPress={() => { Haptics.selectionAsync(); setUseSectionB(!useSectionB); }}
              >
                <View style={[styles.toggleKnob, useSectionB && styles.toggleKnobOn]} />
              </Pressable>
            </View>

            {useSectionB && (
              <>
                <View style={styles.varietyGrid}>
                  {VARIETIES.map((v) => (
                    <Pressable
                      key={v.label}
                      style={[styles.varietyCard, varietyB === v.label && styles.varietyCardActive]}
                      onPress={() => { Haptics.selectionAsync(); setVarietyB(v.label); }}
                    >
                      <View style={styles.varietyCardHeader}>
                        <Text style={[styles.varietyName, varietyB === v.label && { color: COLORS.primary }]}>{v.label}</Text>
                        <View style={[
                          styles.riskBadge,
                          { backgroundColor: v.blightRisk === "HIGH" ? COLORS.redLight : v.blightRisk === "MEDIUM" ? COLORS.amberLight : COLORS.primarySurface }
                        ]}>
                          <Text style={[
                            styles.riskText,
                            { color: v.blightRisk === "HIGH" ? COLORS.red : v.blightRisk === "MEDIUM" ? COLORS.amber : COLORS.primary }
                          ]}>{v.blightRisk}</Text>
                        </View>
                      </View>
                      <Text style={styles.varietyNote}>{v.note}</Text>
                    </Pressable>
                  ))}
                </View>

                {varietyB === "Custom" && (
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Enter Variety Name</Text>
                    <TextInput
                      style={styles.input}
                      value={customVarietyB}
                      onChangeText={setCustomVarietyB}
                      placeholder="e.g. Solara"
                      placeholderTextColor={COLORS.textMuted}
                    />
                  </View>
                )}

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Section B Planting Date</Text>
                  <TextInput
                    style={styles.input}
                    value={plantingDateB}
                    onChangeText={setPlantingDateB}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Section B Area (acres)</Text>
                  <TextInput
                    style={styles.input}
                    value={acresB}
                    onChangeText={setAcresB}
                    placeholder="2"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="numeric"
                  />
                </View>

                {plantingDateB.length === 10 && estimatedHarvestB && (
                  <View style={styles.harvestPreview}>
                    <Ionicons name="sunny-outline" size={16} color={COLORS.amber} />
                    <Text style={styles.harvestPreviewText}>
                      Estimated harvest: <Text style={{ fontFamily: "DMSans_700Bold" }}>{formatDate(estimatedHarvestB)}</Text>
                      {" "}({selectedVarB.maturityDays} days)
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {step === 4 && (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <Ionicons name="calendar-outline" size={28} color={COLORS.primary} />
              <Text style={styles.stepTitle}>Generated Schedule</Text>
              <Text style={styles.stepSubtitle}>
                Review your auto-generated activity schedule for {seasonName}
              </Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>{seasonName}</Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Type</Text>
                  <Text style={styles.summaryValue}>{seasonType}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Sections</Text>
                  <Text style={styles.summaryValue}>{useSectionB ? "A + B" : "A only"}</Text>
                </View>
              </View>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Sec A — {actualVarietyA}</Text>
                  <Text style={styles.summaryValue}>Planted {formatDate(plantingDateA)}</Text>
                </View>
                {useSectionB && (
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Sec B — {actualVarietyB}</Text>
                    <Text style={styles.summaryValue}>Planted {formatDate(plantingDateB)}</Text>
                  </View>
                )}
              </View>
            </View>

            <Text style={styles.scheduleLabel}>
              {previewSchedule.length} activities generated from planting date
            </Text>

            {previewSchedule.map((activity, idx) => (
              <View key={activity.id} style={styles.scheduleRow}>
                <View style={styles.scheduleRowLeft}>
                  <View style={[styles.scheduleNum, { backgroundColor: COLORS.primarySurface }]}>
                    <Text style={styles.scheduleNumText}>{idx + 1}</Text>
                  </View>
                  <View style={styles.scheduleInfo}>
                    <Text style={styles.scheduleName}>{activity.name}</Text>
                    <Text style={styles.scheduleDate}>
                      Sec A: {formatDate(activity.plannedDateA)}
                      {useSectionB ? `  ·  Sec B: ${formatDate(activity.plannedDateB)}` : ""}
                    </Text>
                  </View>
                </View>
                <View style={[styles.scheduleTypeBadge, { backgroundColor: getTypeColor(activity.activityType).bg }]}>
                  <Text style={[styles.scheduleTypeText, { color: getTypeColor(activity.activityType).color }]}>
                    {activity.activityType.split(" ")[0]}
                  </Text>
                </View>
              </View>
            ))}

            <View style={styles.confirmNote}>
              <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} />
              <Text style={styles.confirmNoteText}>
                Dates are calculated from your planting date. You can log activities as they happen — the schedule adjusts to your actual timing.
              </Text>
            </View>
          </View>
        )}

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
          {step < 4 ? (
            <Pressable
              style={[
                styles.nextBtn,
                !(step === 1 ? canProceedStep1 : step === 2 ? canProceedStep2 : canProceedStep3) && { opacity: 0.4 }
              ]}
              disabled={!(step === 1 ? canProceedStep1 : step === 2 ? canProceedStep2 : canProceedStep3)}
              onPress={() => { Haptics.selectionAsync(); setStep(step + 1); }}
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
    case "Spray": return { bg: "#E3F2FD", color: "#1565C0" };
    case "Herbicide": return { bg: "#F3E5F5", color: "#6A1B9A" };
    case "Earthing Up + Fertilizer":
    case "Earthing Up": return { bg: "#FFF8E1", color: "#E65100" };
    case "Harvest": return { bg: "#E8F5E9", color: "#1B5E20" };
    case "Observation": return { bg: "#F5F5F5", color: "#616161" };
    case "Cost Capture": return { bg: "#FFF3E0", color: "#E65100" };
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
  stepSubtitle: { fontFamily: "DMSans_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" },
  field: { gap: 6 },
  fieldLabel: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.text },
  fieldHint: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textMuted },
  input: {
    backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontFamily: "DMSans_400Regular", fontSize: 15, color: COLORS.text,
  },
  notesInput: { minHeight: 90, textAlignVertical: "top", paddingTop: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    backgroundColor: COLORS.borderLight, borderWidth: 1.5, borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontFamily: "DMSans_500Medium", fontSize: 13, color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.white },
  varietyGrid: { gap: 10 },
  varietyCard: {
    backgroundColor: COLORS.background, borderRadius: 14, padding: 14, gap: 4,
    borderWidth: 2, borderColor: COLORS.border,
  },
  varietyCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySurface },
  varietyCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  varietyName: { fontFamily: "DMSans_700Bold", fontSize: 15, color: COLORS.text },
  varietyNote: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary },
  riskBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  riskText: { fontFamily: "DMSans_700Bold", fontSize: 10, letterSpacing: 0.4 },
  harvestPreview: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: COLORS.amberLight, borderRadius: 10, padding: 12,
  },
  harvestPreviewText: { fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.amberDark, flex: 1 },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  toggleSwitch: {
    width: 50, height: 28, borderRadius: 14,
    backgroundColor: COLORS.border, justifyContent: "center", padding: 3,
  },
  toggleSwitchOn: { backgroundColor: COLORS.primary },
  toggleKnob: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.white,
    alignSelf: "flex-start",
  },
  toggleKnobOn: { alignSelf: "flex-end" },
  summaryCard: {
    backgroundColor: COLORS.primarySurface, borderRadius: 14, padding: 16, gap: 12,
    borderWidth: 1, borderColor: COLORS.primaryLight + "40",
  },
  summaryTitle: { fontFamily: "DMSans_700Bold", fontSize: 18, color: COLORS.primary },
  summaryRow: { flexDirection: "row", gap: 16 },
  summaryItem: { flex: 1, gap: 2 },
  summaryLabel: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textSecondary },
  summaryValue: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.text },
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
  navRow: {
    flexDirection: "row", alignItems: "center", marginTop: 24, gap: 12,
  },
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
