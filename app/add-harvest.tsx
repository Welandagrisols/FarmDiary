import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Alert, Platform, KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFarm } from "@/context/FarmContext";
import COLORS from "@/constants/colors";
import { formatKES } from "@/lib/storage";
import { FARM_SEED, SEASON_SEED } from "@/constants/farmData";
import * as Haptics from "expo-haptics";

const SECTIONS = [
  { id: "section-a", label: "Section A", sublabel: "Stephen (72 days)" },
  { id: "section-b", label: "Section B", sublabel: "Shangi (72–90 days)" },
];

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
  const { addHarvestEntry } = useFarm();
  const [saving, setSaving] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const [sectionId, setSectionId] = useState("section-a");
  const [harvestDate, setHarvestDate] = useState(new Date().toISOString().split("T")[0]);
  const [bags, setBags] = useState("");
  const [kgPerBag, setKgPerBag] = useState("110");
  const [pricePerBag, setPricePerBag] = useState("");
  const [buyer, setBuyer] = useState("");
  const [notes, setNotes] = useState("");

  const bagsRef = useRef<TextInput>(null);
  const kgRef = useRef<TextInput>(null);
  const priceRef = useRef<TextInput>(null);
  const buyerRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);

  const numBags = parseFloat(bags) || 0;
  const numKgPerBag = parseFloat(kgPerBag) || 0;
  const numPrice = parseFloat(pricePerBag) || 0;
  const totalKg = numBags * numKgPerBag;
  const totalRevenue = numBags * numPrice;

  const isValid = numBags > 0 && numKgPerBag > 0 && numPrice > 0 && harvestDate.length === 10;

  const handleSave = async () => {
    if (!isValid) {
      Alert.alert("Missing fields", "Please fill in bags, kg per bag, price per bag and date.");
      return;
    }
    setSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await addHarvestEntry({
        farm_id: FARM_SEED.id,
        season_id: SEASON_SEED.id,
        section_id: sectionId,
        harvest_date: harvestDate,
        bags: numBags,
        kg_per_bag: numKgPerBag,
        total_kg: totalKg,
        price_per_bag_kes: numPrice,
        total_revenue_kes: totalRevenue,
        buyer: buyer.trim() || null,
        notes: notes.trim() || null,
      });
      router.back();
    } catch {
      Alert.alert("Error", "Could not save harvest record.");
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
          {totalRevenue > 0 && (
            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>Revenue Preview</Text>
              <Text style={styles.previewRevenue}>{formatKES(totalRevenue)}</Text>
              <Text style={styles.previewMeta}>
                {numBags} bags × {numKgPerBag} kg = {totalKg.toFixed(0)} kg total
              </Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Section</Text>
            <View style={styles.sectionRow}>
              {SECTIONS.map((s) => (
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
            <Text style={styles.sectionTitle}>Harvest Details</Text>

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
                onSubmitEditing={() => bagsRef.current?.focus()}
              />
            </View>

            <View style={styles.field}>
              <FieldLabel label="Number of Bags" required />
              <NumericInput
                value={bags}
                onChangeText={setBags}
                placeholder="e.g. 120"
                suffix="bags"
                inputRef={bagsRef}
                onSubmitEditing={() => kgRef.current?.focus()}
              />
            </View>

            <View style={styles.field}>
              <FieldLabel label="Weight per Bag" required />
              <NumericInput
                value={kgPerBag}
                onChangeText={setKgPerBag}
                placeholder="e.g. 110"
                suffix="kg / bag"
                inputRef={kgRef}
                onSubmitEditing={() => priceRef.current?.focus()}
              />
            </View>

            {totalKg > 0 && (
              <View style={styles.calcRow}>
                <Ionicons name="calculator-outline" size={14} color={COLORS.primary} />
                <Text style={styles.calcText}>Total weight: {totalKg.toFixed(0)} kg</Text>
              </View>
            )}

            <View style={styles.field}>
              <FieldLabel label="Price per Bag (KES)" required />
              <NumericInput
                value={pricePerBag}
                onChangeText={setPricePerBag}
                placeholder="e.g. 3500"
                suffix="KES"
                inputRef={priceRef}
                onSubmitEditing={() => buyerRef.current?.focus()}
              />
            </View>

            {totalRevenue > 0 && (
              <View style={styles.calcRow}>
                <Ionicons name="cash-outline" size={14} color={COLORS.primary} />
                <Text style={styles.calcText}>Revenue: {formatKES(totalRevenue)}</Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Buyer & Notes (optional)</Text>

            <View style={styles.field}>
              <FieldLabel label="Buyer Name" />
              <TextInput
                ref={buyerRef}
                style={styles.input}
                value={buyer}
                onChangeText={setBuyer}
                placeholder="e.g. Nakuru Traders Ltd"
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
