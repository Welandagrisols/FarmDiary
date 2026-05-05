import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Alert, Platform, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFarm } from "@/context/FarmContext";
import COLORS from "@/constants/colors";
import { formatKES, formatDate } from "@/lib/storage";
import * as Haptics from "expo-haptics";

function SectionBadge({ sectionId }: { sectionId: string }) {
  const isA = sectionId === "section-a";
  return (
    <View style={[styles.badge, { backgroundColor: isA ? COLORS.primarySurface : COLORS.amberLight }]}>
      <Text style={[styles.badgeText, { color: isA ? COLORS.primary : COLORS.amberDark }]}>        {isA ? "Section A" : "Section B"}
      </Text>
    </View>
  );
}

export default function HarvestScreen() {
  const insets = useSafeAreaInsets();
  const { harvestRecords, removeHarvestRecord, refresh, activeSeason } = useFarm();
  const [refreshing, setRefreshing] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

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

  const sorted = [...harvestRecords].sort((a, b) => new Date(b.harvest_date).getTime() - new Date(a.harvest_date).getTime());
  const totalBags = harvestRecords.reduce((s, r) => s + r.bags, 0);
  const totalKg = harvestRecords.reduce((s, r) => s + r.total_kg, 0);
  const totalRevenue = harvestRecords.reduce((s, r) => s + r.total_revenue_kes, 0);
  const totalAcres = activeSeason ? activeSeason.section_a.acres + activeSeason.section_b.acres : 0;
  const bagsPerAcre = totalAcres > 0 && totalBags > 0 ? (totalBags / totalAcres).toFixed(1) : null;
  const kesPerKg = totalKg > 0 ? Math.round(totalRevenue / totalKg) : null;
  const sectionA = harvestRecords.filter((r) => r.section_id === "section-a");
  const sectionB = harvestRecords.filter((r) => r.section_id === "section-b");
  const revenueA = sectionA.reduce((s, r) => s + r.total_revenue_kes, 0);
  const revenueB = sectionB.reduce((s, r) => s + r.total_revenue_kes, 0);
  const bagsA = sectionA.reduce((s, r) => s + r.bags, 0);
  const bagsB = sectionB.reduce((s, r) => s + r.bags, 0);

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
              <Text style={styles.summaryLabel}>Total Revenue</Text>
              <Text style={styles.summaryRevenue}>{formatKES(totalRevenue)}</Text>
              <Text style={styles.summaryMeta}>{totalBags} bags · {totalKg.toFixed(0)} kg</Text>
            </View>
            <Ionicons name="leaf-outline" size={32} color={COLORS.white} style={{ opacity: 0.5 }} />
          </View>

          {totalBags > 0 && (
            <View style={styles.yieldMetrics}>
              <View style={styles.yieldMetric}>
                <Text style={styles.yieldValue}>{bagsPerAcre ?? "—"}</Text>
                <Text style={styles.yieldLabel}>Bags/Acre</Text>
              </View>
              <View style={styles.yieldDivider} />
              <View style={styles.yieldMetric}>
                <Text style={styles.yieldValue}>{kesPerKg != null ? `${kesPerKg.toLocaleString()}` : "—"}</Text>
                <Text style={styles.yieldLabel}>KES/kg</Text>
              </View>
              <View style={styles.yieldDivider} />
              <View style={styles.yieldMetric}>
                <Text style={styles.yieldValue}>{totalKg > 0 && totalBags > 0 ? (totalKg / totalBags).toFixed(1) : "—"}</Text>
                <Text style={styles.yieldLabel}>kg/Bag</Text>
              </View>
            </View>
          )}

          {(sectionA.length > 0 || sectionB.length > 0) && (
            <View style={styles.sectionSplit}>
              <View style={styles.sectionSplitItem}>
                <Text style={styles.sectionSplitLabel}>Section A{activeSeason?.section_a.variety ? ` (${activeSeason.section_a.variety})` : ""}</Text>
                <Text style={styles.sectionSplitValue}>{bagsA} bags</Text>
                <Text style={styles.sectionSplitRevenue}>{formatKES(revenueA)}</Text>
              </View>
              <View style={styles.splitDivider} />
              <View style={styles.sectionSplitItem}>
                <Text style={styles.sectionSplitLabel}>Section B{activeSeason?.section_b.variety ? ` (${activeSeason.section_b.variety})` : ""}</Text>
                <Text style={styles.sectionSplitValue}>{bagsB} bags</Text>
                <Text style={styles.sectionSplitRevenue}>{formatKES(revenueB)}</Text>
              </View>
            </View>
          )}
        </View>

        {sorted.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="basket-outline" size={48} color={COLORS.border} />
            <Text style={styles.emptyTitle}>No harvest recorded yet</Text>
            <Text style={styles.emptySubtitle}>Record each harvest load — bags collected, weight, price and buyer.</Text>
            <Pressable style={styles.emptyBtn} onPress={() => router.push("/add-harvest")}>
              <Ionicons name="add" size={18} color={COLORS.white} />
              <Text style={styles.emptyBtnText}>Record First Harvest</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.listLabel}>{sorted.length} {sorted.length === 1 ? "record" : "records"}</Text>
            {sorted.map((record) => (
              <Pressable
                key={record.id}
                style={({ pressed }) => [styles.recordCard, pressed && { opacity: 0.88 }]}
                onLongPress={() => handleDelete(record.id, `${record.bags} bags on ${formatDate(record.harvest_date)}`)}
              >
                <View style={styles.recordTop}>
                  <View style={styles.recordLeft}>
                    <Text style={styles.recordDate}>{formatDate(record.harvest_date)}</Text>
                    <SectionBadge sectionId={record.section_id} />
                  </View>
                  <View style={styles.recordRight}>
                    <Text style={styles.recordRevenue}>{formatKES(record.total_revenue_kes)}</Text>
                  </View>
                </View>

                <View style={styles.recordStats}>
                  <View style={styles.recordStat}>
                    <Ionicons name="cube-outline" size={13} color={COLORS.textMuted} />
                    <Text style={styles.recordStatText}>{record.bags} bags</Text>
                  </View>
                  <View style={styles.recordStat}>
                    <Ionicons name="scale-outline" size={13} color={COLORS.textMuted} />
                    <Text style={styles.recordStatText}>{record.kg_per_bag} kg/bag · {record.total_kg} kg total</Text>
                  </View>
                  <View style={styles.recordStat}>
                    <Ionicons name="pricetag-outline" size={13} color={COLORS.textMuted} />
                    <Text style={styles.recordStatText}>{formatKES(record.price_per_bag_kes)}/bag</Text>
                  </View>
                  {record.buyer && (
                    <View style={styles.recordStat}>
                      <Ionicons name="person-outline" size={13} color={COLORS.textMuted} />
                      <Text style={styles.recordStatText}>{record.buyer}</Text>
                    </View>
                  )}
                  {record.notes && (<Text style={styles.recordNotes}>{record.notes}</Text>)}
                </View>

                <Text style={styles.longPressHint}>Hold to delete</Text>
              </Pressable>
            ))}
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
  sectionSplit: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 10, overflow: "hidden" },
  sectionSplitItem: { flex: 1, padding: 12, gap: 2 },
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