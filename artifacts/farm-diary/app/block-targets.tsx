import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import COLORS, { CARD_SHADOW } from "@/constants/colors";
import { useFarm } from "@/context/FarmContext";
import { getFarmRole } from "@/lib/sales-storage";
import BlockTargetFields from "@/components/BlockTargetFields";
import { parseTarget, validateTargets } from "@/lib/block-targets";
import { getSeasonBlocks } from "@/lib/storage";
import { blockCropTemplate } from "@/lib/season-crops";

type TargetValue = { yieldKg: string; price: string };
const asText = (value: number | null | undefined) => value == null ? "" : String(value);

export default function BlockTargetsScreen() {
  const insets = useSafeAreaInsets();
  const { activeFarm, activeSeason, updateActiveSeason } = useFarm();
  const blocks = getSeasonBlocks(activeSeason);
  const [values, setValues] = useState<Record<string, TargetValue>>({});
  const [canManage, setCanManage] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    setValues(Object.fromEntries(blocks.map((block) => [
      block.id,
      { yieldKg: asText(block.target_yield_kg), price: asText(block.expected_price_kes_per_kg) },
    ])));
  }, [activeSeason?.id]);

  useEffect(() => {
    let current = true;
    setRoleLoading(true);
    setCanManage(false);
    if (!activeFarm?.id) {
      setRoleLoading(false);
      return () => { current = false; };
    }
    getFarmRole(activeFarm.id)
      .then((role) => current && setCanManage(["admin", "owner", "manager"].includes(role)))
      .catch(() => current && setCanManage(false))
      .finally(() => current && setRoleLoading(false));
    return () => { current = false; };
  }, [activeFarm?.id]);

  const set = (id: string, key: keyof TargetValue, value: string) =>
    setValues((previous) => ({ ...previous, [id]: { ...(previous[id] ?? { yieldKg: "", price: "" }), [key]: value } }));

  const handleSave = async () => {
    if (!activeSeason || !canManage) return;
    for (const block of blocks) {
      const value = values[block.id] ?? { yieldKg: "", price: "" };
      const problem = validateTargets(value.yieldKg, value.price);
      if (problem) { Alert.alert(`Check ${block.name}`, problem); return; }
    }
    const source = Array.isArray(activeSeason.blocks) && activeSeason.blocks.length > 0
      ? activeSeason.blocks
      : blocks;
    const next = source.map((block) => {
      const value = values[block.id];
      if (!value) return block;
      const yieldKg = parseTarget(value.yieldKg);
      const price = parseTarget(value.price);
      return {
        ...block,
        target_yield_kg: yieldKg !== null ? yieldKg : null,
        expected_price_kes_per_kg: price !== null ? price : null,
      };
    });
    setSaving(true);
    try {
      await updateActiveSeason({ blocks: next });
      router.back();
    } catch (error) {
      Alert.alert("Could not save targets", error instanceof Error ? error.message : "Check your connection and try again.");
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
        <Text style={styles.headerTitle}>Block targets</Text>
        <View style={{ width: 24 }} />
      </View>
      {roleLoading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 32 }} />
      ) : !canManage ? (
        <Text style={styles.empty}>Only a farm owner or manager can edit block targets.</Text>
      ) : !activeSeason || blocks.length === 0 ? (
        <Text style={styles.empty}>Start a crop cycle with a planting block first.</Text>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Set what you expect from each block. The season report compares harvest and sales with these targets.
            Leave a field empty to clear it.
          </Text>
          {blocks.map((block) => {
            const value = values[block.id] ?? { yieldKg: "", price: "" };
            return (
              <View key={block.id} style={styles.card}>
                <Text style={styles.cardTitle}>{block.name}</Text>
                <Text style={styles.cardSub}>
                  {blockCropTemplate(activeSeason, block).cropType}
                  {block.variety ? ` · ${block.variety}` : ""} · {block.acres} acres
                </Text>
                <BlockTargetFields
                  yieldText={value.yieldKg}
                  priceText={value.price}
                  onChangeYield={(text) => set(block.id, "yieldKg", text)}
                  onChangePrice={(text) => set(block.id, "price", text)}
                  testIdPrefix={`block-${block.id}`}
                />
              </View>
            );
          })}
          <Pressable
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={() => void handleSave()}
            disabled={saving}
            accessibilityRole="button"
          >
            {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveText}>Save targets</Text>}
          </Pressable>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 14 },
  headerTitle: { fontFamily: "Manrope_700Bold", fontSize: 18, color: COLORS.text },
  content: { paddingHorizontal: 16, gap: 12 },
  intro: { fontFamily: "Manrope_400Regular", fontSize: 13, lineHeight: 19, color: COLORS.textSecondary },
  empty: { fontFamily: "Manrope_500Medium", fontSize: 14, lineHeight: 20, color: COLORS.textSecondary, textAlign: "center", marginTop: 40, marginHorizontal: 24 },
  card: { backgroundColor: COLORS.cardBg, borderRadius: 18, padding: 16, gap: 10, ...CARD_SHADOW },
  cardTitle: { fontFamily: "Manrope_700Bold", fontSize: 16, color: COLORS.text },
  cardSub: { fontFamily: "Manrope_400Regular", fontSize: 13, color: COLORS.textSecondary },
  saveBtn: { alignItems: "center", paddingVertical: 14, borderRadius: 14, backgroundColor: COLORS.primary, marginTop: 6 },
  saveText: { fontFamily: "Manrope_700Bold", fontSize: 15, color: COLORS.white },
});
