import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import COLORS from "@/constants/colors";
import { getCropMeta } from "@/constants/cropTemplates";
import { getTemplate } from "@/constants/farmData";
import { useFarm } from "@/context/FarmContext";
import { CropBlock, getSeasonBlocks } from "@/lib/storage";

const today = () => new Date().toISOString().split("T")[0];

export default function AddPlantingScreen() {
  const insets = useSafeAreaInsets();
  const { activeSeason, updateActiveSeason } = useFarm();
  const existingBlocks = getSeasonBlocks(activeSeason);
  const cropMeta = getCropMeta(activeSeason?.template_id);
  const defaultVariety = existingBlocks.at(-1)?.variety || cropMeta.varieties[0]?.label || "";
  const [variety, setVariety] = useState(defaultVariety);
  const [plantingDate, setPlantingDate] = useState(today());
  const [acres, setAcres] = useState("");
  const [saving, setSaving] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;
  const area = Number.parseFloat(acres);
  const canSave = Boolean(activeSeason) &&
    activeSeason?.status !== "closed" &&
    plantingDate.length === 10 &&
    Number.isFinite(area) &&
    area > 0;

  const handleSave = async () => {
    if (!activeSeason || !canSave) return;

    const lastBlock = existingBlocks.at(-1);
    const selectedVariety = variety.trim() || defaultVariety || "Not specified";
    const risk = cropMeta.varieties.find((item) => item.label === selectedVariety)?.blightRisk
      || lastBlock?.blight_risk
      || "LOW";
    const block: CropBlock = {
      id: `block-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name: `Block ${existingBlocks.length + 1}`,
      variety: selectedVariety,
      planting_date: plantingDate,
      acres: area,
      blight_risk: risk,
      notes: null,
    };

    setSaving(true);
    try {
      await updateActiveSeason({ blocks: [...existingBlocks, block] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      const message = error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message || "")
        : error instanceof Error ? error.message : "";
      const missingBlockColumn = /blocks/i.test(message) && /(column|schema cache|does not exist)/i.test(message);
      Alert.alert(
        "Could not add planting",
        missingBlockColumn
          ? "The farm database needs the planting-block update before it can save this. Ask your farm manager to apply the crop-blocks SQL update."
          : "Check your connection and try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: topPadding }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Add planting</Text>
        <View style={{ width: 24 }} />
      </View>

      {!activeSeason ? (
        <View style={styles.emptyState}>
          <Ionicons name="leaf-outline" size={36} color={COLORS.primary} />
          <Text style={styles.emptyTitle}>Start a crop cycle first</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.replace("/season-setup")}>
            <Text style={styles.primaryButtonText}>Start crop cycle</Text>
          </Pressable>
        </View>
      ) : activeSeason.status === "closed" ? (
        <View style={styles.emptyState}>
          <Ionicons name="lock-closed-outline" size={32} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>This crop cycle is closed</Text>
          <Text style={styles.emptyHint}>Reopen the cycle before adding another planting.</Text>
          <Pressable style={styles.secondaryButton} onPress={() => router.push("/season-control")}>
            <Text style={styles.secondaryButtonText}>Open crop cycle</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + 28 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.cropName}>{getTemplate(activeSeason.template_id).cropType} · {activeSeason.season_name}</Text>
          <Text style={styles.instructions}>
            Add only when you plant another area. Its growth stage and schedule use its own planting date.
          </Text>

          <View style={styles.blockCard}>
            <View style={styles.blockHeader}>
              <View style={styles.blockIcon}>
                <Ionicons name="grid-outline" size={18} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.blockTitle}>Block {existingBlocks.length + 1}</Text>
                <Text style={styles.blockHint}>The name is assigned automatically.</Text>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Planting date</Text>
              <TextInput
                testID="planting-date"
                style={styles.input}
                value={plantingDate}
                onChangeText={setPlantingDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numbers-and-punctuation"
                accessibilityLabel="Planting date"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Area (acres)</Text>
              <TextInput
                testID="planting-area"
                style={styles.input}
                value={acres}
                onChangeText={setAcres}
                placeholder="e.g. 0.5"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="decimal-pad"
                accessibilityLabel="Area in acres"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Variety (optional)</Text>
              <TextInput
                testID="planting-variety"
                style={styles.input}
                value={variety}
                onChangeText={setVariety}
                placeholder="Same as last planting"
                placeholderTextColor={COLORS.textMuted}
                maxLength={80}
                accessibilityLabel="Variety"
              />
              <Text style={styles.helperText}>Pre-filled from the last planting. Change it only if needed.</Text>
            </View>
          </View>

          <View style={styles.rollupNote}>
            <Ionicons name="information-circle-outline" size={17} color={COLORS.primary} />
            <Text style={styles.rollupText}>This planting will appear alongside the others in this crop cycle.</Text>
          </View>

          <Pressable
            testID="save-planting"
            style={[styles.primaryButton, (!canSave || saving) && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={!canSave || saving}
            accessibilityRole="button"
          >
            {saving ? <ActivityIndicator color={COLORS.white} /> : (
              <>
                <Ionicons name="add" size={19} color={COLORS.white} />
                <Text style={styles.primaryButtonText}>Add planting</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  headerTitle: { fontFamily: "Manrope_700Bold", fontSize: 18, color: COLORS.text },
  content: { paddingHorizontal: 18, gap: 14 },
  cropName: { fontFamily: "Manrope_700Bold", fontSize: 20, color: COLORS.text, marginTop: 8 },
  instructions: { fontFamily: "Manrope_400Regular", fontSize: 14, lineHeight: 21, color: COLORS.textSecondary },
  blockCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 14,
  },
  blockHeader: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 2 },
  blockIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.primarySurface, alignItems: "center", justifyContent: "center" },
  blockTitle: { fontFamily: "Manrope_700Bold", fontSize: 16, color: COLORS.text },
  blockHint: { fontFamily: "Manrope_400Regular", fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  field: { gap: 6 },
  label: { fontFamily: "Manrope_600SemiBold", fontSize: 13, color: COLORS.text },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "Manrope_400Regular",
    fontSize: 16,
    color: COLORS.text,
  },
  helperText: { fontFamily: "Manrope_400Regular", fontSize: 12, lineHeight: 17, color: COLORS.textMuted },
  rollupNote: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 4 },
  rollupText: { flex: 1, fontFamily: "Manrope_400Regular", fontSize: 13, lineHeight: 18, color: COLORS.primary },
  primaryButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 16,
  },
  primaryButtonText: { fontFamily: "Manrope_700Bold", fontSize: 15, color: COLORS.white },
  buttonDisabled: { opacity: 0.5 },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySurface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  secondaryButtonText: { fontFamily: "Manrope_700Bold", fontSize: 14, color: COLORS.primary },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 14 },
  emptyTitle: { fontFamily: "Manrope_700Bold", fontSize: 18, color: COLORS.text, textAlign: "center" },
  emptyHint: { fontFamily: "Manrope_400Regular", fontSize: 14, lineHeight: 20, color: COLORS.textSecondary, textAlign: "center" },
});
