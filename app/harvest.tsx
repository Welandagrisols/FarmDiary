import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Alert, Platform, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFarm } from "@/context/FarmContext";
import COLORS from "@/constants/colors";
import { formatDate, getSeasonBlockName, getSeasonBlocks, SeasonRecord } from "@/lib/storage";
import { getFarmRole } from "@/lib/sales-storage";
import { formatHarvestTotals, getCropMeta, harvestTotalsByUnit, unitFor } from "@/constants/cropTemplates";
import * as Haptics from "expo-haptics";

function SectionBadge({ sectionId, season }: { sectionId: string; season: SeasonRecord | null }) {
  const blockIndex = getSeasonBlocks(season).findIndex((block) => block.id === sectionId);
  const isPrimary = blockIndex < 0 || blockIndex % 2 === 0;
  return (
    <View style={[styles.badge, { backgroundColor: isPrimary ? COLORS.primarySurface : COLORS.amberLight }]}>
      <Text style={[styles.badgeText, { color: isPrimary ? COLORS.primary : COLORS.amberDark }]}>
        {getSeasonBlockName(season, sectionId)}
      </Text>
    </View>
  );
}

export default function HarvestScreen() {
  const insets = useSafeAreaInsets();
  const { harvestRecords, removeHarvestRecord, refresh, activeSeason, activeFarm } = useFarm();
  const [refreshing, setRefreshing] = useState(false);
  const [canManageHarvest, setCanManageHarvest] = useState(false);
  const cropMeta = getCropMeta(activeSeason?.template_id);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    let current = true;
    if (!activeFarm?.id) return () => { current = false; };
    getFarmRole(activeFarm.id)
      .then((role) => current && setCanManageHarvest(["admin", "owner", "manager"].includes(role)))
      .catch(() => current && setCanManageHarvest(false));
    return () => { current = false; };
  }, [activeFarm?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleDelete = useCallback((id: string, label: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Delete Harvest Record", `Remove "${label}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => { await removeHarvestRecord(id); },
      },
    ]);
  }, [removeHarvestRecord]);

  const sorted = (activeSeason ? harvestRecords.filter((record) => record.season_id === activeSeason.id) : [])
    .sort((a, b) => new Date(b.harvest_date).getTime() - new Date(a.harvest_date).getTime());
  const totalKg = sorted.reduce((s, r) => s + r.total_kg, 0);
  const blocks = getSeasonBlocks(activeSeason);
  const totalAcres = blocks.reduce((sum, block) => sum + (Number(block.acres) || 0), 0);
  const unitTotals = harvestTotalsByUnit(sorted, cropMeta);
  const showRecordedWeight = totalKg > 0 && !(unitTotals.length === 1 && unitTotals[0].key === "kg");
  const allWeightsKnown = sorted.length > 0 && sorted.every((record) => record.total_kg > 0);
  const blockBreakdown = blocks.map((block) => {
    const records = sorted.filter((record) => record.section_id === block.id);
    return {
      block,
      records,
    };
  }).filter((item) => item.records.length > 0);

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Harvest Records</Text>
        <Pressable style={styles.addBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/add-harvest"); }}>
          <Ionicons name="add" size={20} color={COLORS.white} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View style={styles.summaryMain}>
              <Text style={styles.summaryLabel}>{activeSeason?.season_name || "Season"} · Total Harvest</Text>
              <Text style={styles.summaryRevenue}>
                {totalKg > 0 ? `${totalKg.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg` : formatHarvestTotals(sorted, cropMeta)}
              </Text>
              <Text style={styles.summaryMeta}>
                {formatHarvestTotals(sorted, cropMeta)}{showRecordedWeight ? ` · ${totalKg.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg recorded` : ""}
              </Text>
            </View>
            <Ionicons name="leaf-outline" size={32} color={COLORS.white} style={{ opacity: 0.5 }} />
          </View>

          {sorted.length > 0 && (
            <View style={styles.yieldMetrics}>
              <View style={styles.yieldMetric}>
                <Text style={styles.yieldValue}>
                  {unitTotals.length === 1 && totalAcres > 0
                    ? (unitTotals[0].quantity / totalAcres).toLocaleString(undefined, { maximumFractionDigits: 1 })
                    : unitTotals.length > 1 ? "Mixed" : "—"}
                </Text>
                <Text style={styles.yieldLabel}>{unitTotals.length === 1 ? `${unitTotals[0].plural}/Acre` : "Units/Acre"}</Text>
              </View>
              <View style={styles.yieldDivider} />
              <View style={styles.yieldMetric}>
                <Text style={styles.yieldValue}>{totalKg > 0 ? totalKg.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "—"}</Text>
                <Text style={styles.yieldLabel}>Total kg</Text>
              </View>
              <View style={styles.yieldDivider} />
              <View style={styles.yieldMetric}>
                <Text style={styles.yieldValue}>{allWeightsKnown && unitTotals.length === 1 && unitTotals[0].quantity > 0 ? (totalKg / unitTotals[0].quantity).toFixed(1) : "—"}</Text>
                <Text style={styles.yieldLabel}>{unitTotals.length === 1 ? `kg/${unitTotals[0].label}` : "kg/Unit"}</Text>
              </View>
            </View>
          )}
          {sorted.length > 0 && !allWeightsKnown && <Text style={styles.summaryMeta}>*Requires weight for every harvest record</Text>}

          {blockBreakdown.length > 0 && (
            <View style={styles.sectionSplit}>
              {blockBreakdown.map(({ block, records }) => (
                <View key={block.id} style={styles.sectionSplitItem}>
                  <Text style={styles.sectionSplitLabel}>
                    {block.name}{block.variety ? ` (${block.variety})` : ""}
                  </Text>
                  <Text style={styles.sectionSplitValue}>{formatHarvestTotals(records, cropMeta)}</Text>
                  <Text style={styles.sectionSplitRevenue}>
                    {records.reduce((sum, record) => sum + (Number(record.total_kg) || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} kg
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {sorted.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="basket-outline" size={48} color={COLORS.border} />
            <Text style={styles.emptyTitle}>No harvest recorded yet</Text>
            <Text style={styles.emptySubtitle}>Record harvest quantities in this crop’s units, with optional weight, price and buyer details.</Text>
            <Pressable style={styles.emptyBtn} onPress={() => router.push("/add-harvest")}>
              <Ionicons name="add" size={18} color={COLORS.white} />
              <Text style={styles.emptyBtnText}>Record First Harvest</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.listLabel}>{activeSeason?.season_name || "Season"} · {sorted.length} {sorted.length === 1 ? "record" : "records"}</Text>
            {sorted.map((record) => {
              const unit = unitFor(cropMeta, record.unit);
              return (
              <Pressable
                key={record.id}
                style={({ pressed }) => [styles.recordCard, pressed && { opacity: 0.88 }]}
                onLongPress={canManageHarvest
                  ? () => handleDelete(record.id, `${record.bags} ${unit.plural.toLowerCase()} on ${formatDate(record.harvest_date)}`)
                  : undefined}
              >
                <View style={styles.recordTop}>
                  <View style={styles.recordLeft}>
                    <Text style={styles.recordDate}>{formatDate(record.harvest_date)}</Text>
                    <SectionBadge sectionId={record.section_id} season={activeSeason} />
                  </View>
                  <View style={styles.recordRight}>
                    <Text style={styles.recordRevenue}>
                      {record.total_kg > 0 ? `${record.total_kg.toLocaleString()} kg` : `${record.bags} ${unit.plural.toLowerCase()}`}
                    </Text>
                  </View>
                </View>

                <View style={styles.recordStats}>
                  <View style={styles.recordStat}>
                    <Ionicons name="cube-outline" size={13} color={COLORS.textMuted} />
                    <Text style={styles.recordStatText}>{record.bags} {unit.plural.toLowerCase()}</Text>
                  </View>
                  {record.total_kg > 0 && unit.key !== "kg" ? (
                    <View style={styles.recordStat}>
                      <Ionicons name="scale-outline" size={13} color={COLORS.textMuted} />
                      <Text style={styles.recordStatText}>{record.kg_per_bag} kg / {unit.label.toLowerCase()} · {record.total_kg} kg total</Text>
                    </View>
                  ) : null}
                  <View style={styles.recordStat}>
                    <Ionicons name="pricetag-outline" size={13} color={COLORS.textMuted} />
                  </View>
                  {record.grade ? <Text style={styles.recordStatText}>Grade: {record.grade}</Text> : null}
                  {record.buyer && (
                    <View style={styles.recordStat}>
                      <Ionicons name="person-outline" size={13} color={COLORS.textMuted} />
                      <Text style={styles.recordStatText}>Legacy buyer: {record.buyer}</Text>
                    </View>
                  )}
                  {record.recorded_by_email ? (
                    <Text style={styles.recordStatText}>Recorded by {record.recorded_by_email}</Text>
                  ) : null}
                  {record.notes && (<Text style={styles.recordNotes}>{record.notes}</Text>)}
                </View>

                <Text style={styles.longPressHint}>Hold to delete</Text>
              </Pressable>
              );
            })}
          </>
        )}
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
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center",
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  summaryCard: { backgroundColor: COLORS.primary, borderRadius: 16, padding: 18, gap: 14 },
  summaryTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  summaryMain: { gap: 4 },
  summaryLabel: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.white, opacity: 0.75 },
  summaryRevenue: { fontFamily: "DMSans_700Bold", fontSize: 28, color: COLORS.white },
  summaryMeta: { fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.white, opacity: 0.8 },
  yieldMetrics: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 10, overflow: "hidden" },
  yieldMetric: { flex: 1, padding: 10, alignItems: "center", gap: 2 },
  yieldDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.2)" },
  yieldValue: { fontFamily: "DMSans_700Bold", fontSize: 16, color: COLORS.white },
  yieldLabel: { fontFamily: "DMSans_400Regular", fontSize: 10, color: COLORS.white, opacity: 0.7 },
  sectionSplit: { flexDirection: "row", flexWrap: "wrap", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 10, overflow: "hidden" },
  sectionSplitItem: { flexGrow: 1, flexBasis: "45%", padding: 12, gap: 2 },
  splitDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.2)" },
  sectionSplitLabel: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.white, opacity: 0.75 },
  sectionSplitValue: { fontFamily: "DMSans_700Bold", fontSize: 16, color: COLORS.white },
  sectionSplitRevenue: { fontFamily: "DMSans_500Medium", fontSize: 12, color: COLORS.white, opacity: 0.85 },
  listLabel: { fontFamily: "DMSans_600SemiBold", fontSize: 12, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.4 },
  recordCard: { backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.border, gap: 10, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  recordTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  recordLeft: { gap: 6 },
  recordRight: { alignItems: "flex-end" },
  recordDate: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.textSecondary },
  recordRevenue: { fontFamily: "DMSans_700Bold", fontSize: 18, color: COLORS.primary },
  recordStats: { gap: 5 },
  recordStat: { flexDirection: "row", alignItems: "center", gap: 6 },
  recordStatText: { fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.textSecondary },
  recordNotes: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textMuted, fontStyle: "italic", marginTop: 2 },
  longPressHint: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textMuted, textAlign: "right" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontFamily: "DMSans_700Bold", fontSize: 11 },
  emptyState: { alignItems: "center", gap: 10, paddingVertical: 48 },
  emptyTitle: { fontFamily: "DMSans_700Bold", fontSize: 18, color: COLORS.textSecondary },
  emptySubtitle: { fontFamily: "DMSans_400Regular", fontSize: 14, color: COLORS.textMuted, textAlign: "center", lineHeight: 20, paddingHorizontal: 24 },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10, marginTop: 8 },
  emptyBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 14, color: COLORS.white },
});