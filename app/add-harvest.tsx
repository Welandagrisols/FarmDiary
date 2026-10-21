import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Alert, Platform, KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFarm } from "@/context/FarmContext";
import COLORS from "@/constants/colors";
import { getSeasonBlocks } from "@/lib/storage";
import { SEASON_SEED, getTemplate } from "@/constants/farmData";
import { getCropMeta } from "@/constants/cropTemplates";

import * as Haptics from "expo-haptics";

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Text style={styles.fieldLabel}>
      {label}{required ? <Text style={{ color: COLORS.red }}> *</Text> : null}
    </Text>
  );
}

function NumericInput({
  value,
  onChangeText,
  placeholder,
  suffix,
  inputRef,
  onSubmitEditing,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  suffix?: string;
  inputRef?: React.RefObject<TextInput | null>;
  onSubmitEditing?: () => void;
}) {
  return (
    <View style={styles.numericRow}>
      <TextInput
        ref={inputRef}
        style={[styles.input, styles.numericInput]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        keyboardType="decimal-pad"
        returnKeyType="next"
        onSubmitEditing={onSubmitEditing}
      />
      {suffix ? <Text style={styles.inputSuffix}>{suffix}</Text> : null}
    </View>
  );
}

export default function AddHarvestScreen() {
  const insets = useSafeAreaInsets();
  const { addHarvestEntry, activeSeason, farmId } = useFarm();
  const seasonId = activeSeason?.id || SEASON_SEED.id;
  const cropMeta = getCropMeta(activeSeason?.template_id);
  const sections = getSeasonBlocks(activeSeason).map((block) => ({
    id: block.id,
    label: block.name,
    sublabel: block.variety || "Crop planting",
  }));
  const [saving, setSaving] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const [sectionId, setSectionId] = useState(sections[0]?.id || "section-a");
  const [harvestDate, setHarvestDate] = useState(new Date().toISOString().split("T")[0]);
  const [quantity, setQuantity] = useState("");
  const [unitKey, setUnitKey] = useState(cropMeta.harvestUnits[0]?.key || "bag");
  const initialUnit = cropMeta.harvestUnits[0];
  const [kgPerUnit, setKgPerUnit] = useState(initialUnit?.defaultKg ? String(initialUnit.defaultKg) : "");
  const [grade, setGrade] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (sections.length > 0 && !sections.some((section) => section.id === sectionId)) {
      setSectionId(sections[0].id);
    }
  }, [sections, sectionId]);

  const quantityRef = useRef<TextInput>(null);
  const kgRef = useRef<TextInput>(null);
  const gradeRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);

  const selectedUnit = cropMeta.harvestUnits.find((unit) => unit.key === unitKey) || cropMeta.harvestUnits[0];
  const numQuantity = parseFloat(quantity) || 0;
  const numKgPerUnit = selectedUnit?.key === "kg" ? 1 : parseFloat(kgPerUnit) || 0;
  const weightRequired = Boolean(selectedUnit && selectedUnit.key !== "kg" && selectedUnit.defaultKg > 0);
  const totalKg = numKgPerUnit > 0 ? numQuantity * numKgPerUnit : 0;

  const isValid = numQuantity > 0 && (!weightRequired || numKgPerUnit > 0) && harvestDate.length === 10;

  const handleUnitChange = (key: string) => {
    const nextUnit = cropMeta.harvestUnits.find((unit) => unit.key === key);
    setUnitKey(key);
    setKgPerUnit(nextUnit?.defaultKg ? String(nextUnit.defaultKg) : "");
  };

  const handleSave = async () => {
    if (!isValid) {
      Alert.alert("Missing fields", `Please enter a harvest quantity and valid date${weightRequired ? " and weight per unit" : ""}.`);
      return;
    }
    setSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await addHarvestEntry({
        farm_id: farmId,
        season_id: seasonId,
        section_id: sectionId,
        harvest_date: harvestDate,
        bags: numQuantity,
        kg_per_bag: numKgPerUnit,
        total_kg: totalKg,
        price_per_bag_kes: 0,
        total_revenue_kes: 0,
        ...(selectedUnit?.key && selectedUnit.key !== "bag" ? { unit: selectedUnit.key } : {}),
        ...(grade.trim() ? { grade: grade.trim() } : {}),
        buyer: null,
        notes: notes.trim() || null,
      });
      router.back();
    } catch {
      Alert.alert("Error", "Could not save harvest record. If this uses a new unit or grade, verify the multi-crop database upgrade has been applied.");
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.container, { paddingTop: topPadding }]}> 
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Record Harvest</Text>
          <Pressable
            style={[styles.saveBtn, !isValid && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving || !isValid}
          >
            <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save"}</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {totalKg > 0 && (
            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>Harvest weight</Text>
              <Text style={styles.previewRevenue}>{totalKg.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg</Text>
              <Text style={styles.previewMeta}>
                {numQuantity} {selectedUnit?.plural.toLowerCase() || "units"} recorded for this planting block
              </Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Section</Text>
            <View style={styles.sectionRow}>
              {sections.map((s) => (
                <Pressable
                  key={s.id}
                  style={[styles.sectionBtn, sectionId === s.id && styles.sectionBtnActive]}
                  onPress={() => { Haptics.selectionAsync(); setSectionId(s.id); }}
                >
                  <Text style={[styles.sectionBtnLabel, sectionId === s.id && styles.sectionBtnLabelActive]}>
                    {s.label}
                  </Text>
                  <Text style={[styles.sectionBtnSub, sectionId === s.id && { color: COLORS.white + "CC" }]}>
                    {s.sublabel}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{getTemplate(activeSeason?.template_id).cropType} Harvest Details</Text>

            <View style={styles.field}>
              <FieldLabel label="Harvest Date" required />
              <TextInput
                style={styles.input}
                value={harvestDate}
                onChangeText={setHarvestDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numbers-and-punctuation"
                returnKeyType="next"
                onSubmitEditing={() => quantityRef.current?.focus()}
              />
            </View>

            <View style={styles.field}>
              <FieldLabel label="Harvest Unit" required />
              <View style={styles.unitRow}>
                {cropMeta.harvestUnits.map((unit) => (
                  <Pressable
                    key={unit.key}
                    style={[styles.unitBtn, unitKey === unit.key && styles.unitBtnActive]}
                    onPress={() => { Haptics.selectionAsync(); handleUnitChange(unit.key); }}
                  >
                    <Text style={[styles.unitBtnText, unitKey === unit.key && styles.unitBtnTextActive]}>{unit.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <FieldLabel label={`Quantity (${selectedUnit?.plural.toLowerCase() || "units"})`} required />
              <NumericInput
                value={quantity}
                onChangeText={setQuantity}
                placeholder="e.g. 12"
                suffix={selectedUnit?.plural.toLowerCase() || "units"}
                inputRef={quantityRef}
                onSubmitEditing={() => (selectedUnit?.key === "kg" ? gradeRef.current?.focus() : kgRef.current?.focus())}
              />
            </View>

            {selectedUnit?.key !== "kg" && (
              <View style={styles.field}>
                <FieldLabel label={`Weight per ${selectedUnit?.label.toLowerCase()}`} required={weightRequired} />
                <NumericInput
                  value={kgPerUnit}
                  onChangeText={setKgPerUnit}
                  placeholder={selectedUnit?.defaultKg ? String(selectedUnit.defaultKg) : "Optional"}
                  suffix="kg / unit"
                  inputRef={kgRef}
                  onSubmitEditing={() => gradeRef.current?.focus()}
                />
                {!weightRequired && <Text style={styles.fieldHint}>Leave blank if the weight is unknown.</Text>}
              </View>
            )}

            {totalKg > 0 && (
              <View style={styles.calcRow}>
                <Ionicons name="calculator-outline" size={14} color={COLORS.primary} />
                <Text style={styles.calcText}>Total weight: {totalKg.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg</Text>
              </View>
            )}

          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Grade & Notes (optional)</Text>

            <View style={styles.field}>
              <FieldLabel label="Grade / Quality" />
              <TextInput
                ref={gradeRef}
                style={styles.input}
                value={grade}
                onChangeText={setGrade}
                placeholder="e.g. Grade 1"
                placeholderTextColor={COLORS.textMuted}
                returnKeyType="next"
                onSubmitEditing={() => notesRef.current?.focus()}
              />
            </View>

            <View style={styles.field}>
              <FieldLabel label="Notes" />
              <TextInput
                ref={notesRef}
                style={[styles.input, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Any notes about quality, grading, payment terms…"
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={3}
                returnKeyType="done"
              />
            </View>
          </View>

          <Pressable
            style={[styles.saveFullBtn, !isValid && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving || !isValid}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.white} />
            <Text style={styles.saveFullBtnText}>{saving ? "Saving..." : "Save Harvest Record"}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
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
  saveBtn: {
    backgroundColor: COLORS.primary, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 14, color: COLORS.white },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },

  previewCard: {
    backgroundColor: COLORS.primary, borderRadius: 14, padding: 16, alignItems: "center", gap: 4,
  },
  previewLabel: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.white, opacity: 0.75 },
  previewRevenue: { fontFamily: "DMSans_700Bold", fontSize: 26, color: COLORS.white },
  previewMeta: { fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.white, opacity: 0.8 },

  section: {
    backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLORS.border, gap: 14,
  },
  sectionTitle: { fontFamily: "DMSans_700Bold", fontSize: 14, color: COLORS.text },
  sectionRow: { flexDirection: "row", gap: 10 },
  unitRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  unitBtn: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: COLORS.borderLight, borderWidth: 1, borderColor: COLORS.border },
  unitBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  unitBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 12, color: COLORS.textSecondary },
  unitBtnTextActive: { color: COLORS.white },
  sectionBtn: {
    flex: 1, borderRadius: 10, padding: 12,
    backgroundColor: COLORS.borderLight, borderWidth: 1, borderColor: COLORS.border, gap: 2,
  },
  sectionBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  sectionBtnLabel: { fontFamily: "DMSans_700Bold", fontSize: 14, color: COLORS.text },
  sectionBtnLabelActive: { color: COLORS.white },
  sectionBtnSub: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textMuted },

  field: { gap: 6 },
  fieldLabel: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.textSecondary },
  fieldHint: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textMuted },
  input: {
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, padding: 12, fontFamily: "DMSans_400Regular",
    fontSize: 15, color: COLORS.text,
  },
  numericRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  numericInput: { flex: 1 },
  inputSuffix: { fontFamily: "DMSans_500Medium", fontSize: 13, color: COLORS.textSecondary, minWidth: 56 },
  textArea: { minHeight: 80, textAlignVertical: "top" },

  calcRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: COLORS.primarySurface, borderRadius: 8, padding: 10,
    marginTop: -6,
  },
  calcText: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.primary },

  saveFullBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 14, padding: 16,
  },
  saveFullBtnText: { fontFamily: "DMSans_700Bold", fontSize: 16, color: COLORS.white },
});