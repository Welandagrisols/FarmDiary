import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFarm } from "@/context/FarmContext";
import COLORS from "@/constants/colors";
import { formatKES, formatDate } from "@/lib/storage";

export default function SeasonReportScreen() {
  const insets = useSafeAreaInsets();
  const { activeSeason, costs, harvestRecords } = useFarm();

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const seasonCosts = activeSeason ? costs.filter((c) => c.season_id === activeSeason.id) : [];
  const seasonHarvests = activeSeason ? harvestRecords.filter((r) => r.season_id === activeSeason.id) : [];

  const totalSpent = seasonCosts.reduce((sum, cost) => sum + cost.amount_kes, 0);
  const prePlantingSpent = seasonCosts.filter((cost) => cost.is_pre_planting).reduce((sum, cost) => sum + cost.amount_kes, 0);
  const totalRevenue = seasonHarvests.reduce((sum, record) => sum + record.total_revenue_kes, 0);
  const netProfit = totalRevenue - totalSpent;
  const costRatio = totalRevenue > 0 ? (totalSpent / totalRevenue) * 100 : null;
  const totalYield = seasonHarvests.reduce((sum, record) => sum + record.total_kg, 0);

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}> 
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.title}>Final Report</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPadding + 90, gap: 14 }} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Season</Text>
          <Text style={styles.heroTitle}>{activeSeason?.season_name || "No active season"}</Text>
          <Text style={styles.heroSub}>{activeSeason ? `${activeSeason.season_type} · Closed report` : "Open a season to see the report"}</Text>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{formatKES(totalRevenue)}</Text>
            <Text style={styles.metricLabel}>Revenue</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{formatKES(totalSpent)}</Text>
            <Text style={styles.metricLabel}>Costs</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: netProfit >= 0 ? COLORS.primary : COLORS.red }]}>{formatKES(netProfit)}</Text>
            <Text style={styles.metricLabel}>Net</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{totalYield.toLocaleString()}</Text>
            <Text style={styles.metricLabel}>Yield kg</Text>
          </View>
        </View>

        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>Cost breakdown</Text>
          <View style={styles.detailRow}><Text style={styles.detailKey}>Pre-planting</Text><Text style={styles.detailValue}>{formatKES(prePlantingSpent)}</Text></View>
          <View style={styles.detailRow}><Text style={styles.detailKey}>Other costs</Text><Text style={styles.detailValue}>{formatKES(totalSpent - prePlantingSpent)}</Text></View>
          <View style={styles.detailRow}><Text style={styles.detailKey}>Cost ratio</Text><Text style={styles.detailValue}>{costRatio ? `${costRatio.toFixed(0)}%` : "—"}</Text></View>
        </View>

        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>Harvest records</Text>
          {seasonHarvests.length > 0 ? (
            seasonHarvests.map((record) => (
              <View key={record.id} style={styles.harvestRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailKey}>{record.section_id?.replace("section-", "Section ").toUpperCase() || "Harvest"}</Text>
                  <Text style={styles.harvestSub}>{formatDate(record.harvest_date)}</Text>
                </View>
                <Text style={styles.detailValue}>{formatKES(record.total_revenue_kes)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No harvest recorded yet.</Text>
          )}
        </View>

        <Pressable style={styles.primaryBtn} onPress={() => router.push("/season-control") }>
          <Ionicons name="options-outline" size={18} color={COLORS.white} />
          <Text style={styles.primaryBtnText}>Back to Season Control</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.cardBg },
  title: { fontFamily: "DMSans_700Bold", fontSize: 18, color: COLORS.text },
  heroCard: { backgroundColor: COLORS.cardBg, borderRadius: 18, padding: 16, gap: 4, borderWidth: 1, borderColor: COLORS.border },
  heroLabel: { fontFamily: "DMSans_700Bold", fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  heroTitle: { fontFamily: "DMSans_700Bold", fontSize: 22, color: COLORS.text },
  heroSub: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary },
  metricsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: { flexBasis: "48%", flexGrow: 1, backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.border, gap: 4 },
  metricValue: { fontFamily: "DMSans_700Bold", fontSize: 18, color: COLORS.text },
  metricLabel: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textSecondary },
  detailCard: { backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 14, gap: 10, borderWidth: 1, borderColor: COLORS.border },
  detailTitle: { fontFamily: "DMSans_700Bold", fontSize: 14, color: COLORS.text },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  detailKey: { fontFamily: "DMSans_600SemiBold", fontSize: 12, color: COLORS.textSecondary },
  detailValue: { fontFamily: "DMSans_700Bold", fontSize: 12, color: COLORS.text },
  harvestRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, paddingVertical: 4 },
  harvestSub: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  emptyText: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textMuted },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 13 },
  primaryBtnText: { fontFamily: "DMSans_700Bold", fontSize: 14, color: COLORS.white },
});