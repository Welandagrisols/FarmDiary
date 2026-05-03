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
  const { seasons, costs, harvestRecords, activeSeason } = useFarm();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const closedSeasons = [...seasons].filter((season) => season.status === "closed").sort((a, b) => b.season_number - a.season_number);
  const seasonRows = [...seasons].sort((a, b) => b.season_number - a.season_number).map((season) => {
    const seasonCosts = costs.filter((c) => c.season_id === season.id);
    const seasonHarvests = harvestRecords.filter((r) => r.season_id === season.id);
    const revenue = seasonHarvests.reduce((sum, record) => sum + record.total_revenue_kes, 0);
    const spent = seasonCosts.reduce((sum, cost) => sum + cost.amount_kes, 0);
    const net = revenue - spent;
    const yieldKg = seasonHarvests.reduce((sum, record) => sum + record.total_kg, 0);
    const margin = revenue > 0 ? (net / revenue) * 100 : null;
    return { season, revenue, spent, net, yieldKg, margin, harvestCount: seasonHarvests.length };
  });

  const totalRevenue = seasonRows.reduce((sum, row) => sum + row.revenue, 0);
  const totalSpent = seasonRows.reduce((sum, row) => sum + row.spent, 0);
  const totalNet = totalRevenue - totalSpent;
  const totalYield = seasonRows.reduce((sum, row) => sum + row.yieldKg, 0);
  const averageMargin = totalRevenue > 0 ? (totalNet / totalRevenue) * 100 : null;
  const activeRow = seasonRows.find((row) => row.season.id === activeSeason?.id) || seasonRows[0] || null;
  const bestNet = seasonRows.reduce((best, row) => (row.net > best.net ? row : best), seasonRows[0] || null);
  const worstNet = seasonRows.reduce((worst, row) => (row.net < worst.net ? row : worst), seasonRows[0] || null);

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}> 
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.title}>Full P&L</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPadding + 90, gap: 14 }} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Active season</Text>
          <Text style={styles.heroTitle}>{activeRow?.season.season_name || "No season"}</Text>
          <Text style={styles.heroSub}>{activeRow ? `${activeRow.season.season_type} · ${activeRow.season.status}` : "Start or select a season to see the report"}</Text>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}><Text style={styles.metricValue}>{formatKES(totalRevenue)}</Text><Text style={styles.metricLabel}>Total Revenue</Text></View>
          <View style={styles.metricCard}><Text style={styles.metricValue}>{formatKES(totalSpent)}</Text><Text style={styles.metricLabel}>Total Costs</Text></View>
          <View style={styles.metricCard}><Text style={[styles.metricValue, { color: totalNet >= 0 ? COLORS.primary : COLORS.red }]}>{formatKES(totalNet)}</Text><Text style={styles.metricLabel}>Net Profit</Text></View>
          <View style={styles.metricCard}><Text style={styles.metricValue}>{totalYield.toLocaleString()}</Text><Text style={styles.metricLabel}>Yield kg</Text></View>
        </View>

        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>Season comparison</Text>
          <View style={styles.compareRow}>
            <Text style={styles.compareKey}>Best season</Text>
            <Text style={styles.compareValue}>{bestNet ? `${bestNet.season.season_name} · ${formatKES(bestNet.net)}` : "—"}</Text>
          </View>
          <View style={styles.compareRow}>
            <Text style={styles.compareKey}>Lowest season</Text>
            <Text style={styles.compareValue}>{worstNet ? `${worstNet.season.season_name} · ${formatKES(worstNet.net)}` : "—"}</Text>
          </View>
          <View style={styles.compareRow}>
            <Text style={styles.compareKey}>Average margin</Text>
            <Text style={styles.compareValue}>{averageMargin ? `${averageMargin.toFixed(0)}%` : "—"}</Text>
          </View>
        </View>

        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>Season P&L</Text>
          {seasonRows.length > 0 ? (
            seasonRows.map((row) => (
              <View key={row.season.id} style={styles.seasonCard}>
                <View style={styles.seasonTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.seasonName}>{row.season.season_name}</Text>
                    <Text style={styles.seasonSub}>{row.season.season_type} · {row.season.status} · {row.harvestCount} harvests</Text>
                  </View>
                  <View style={[styles.badge, row.season.status === "active" ? styles.badgeActive : row.season.status === "closed" ? styles.badgeClosed : styles.badgePlanning]}>
                    <Text style={styles.badgeText}>{row.season.status}</Text>
                  </View>
                </View>
                <View style={styles.grid}>
                  <View style={styles.stat}><Text style={styles.value}>{formatKES(row.revenue)}</Text><Text style={styles.label}>Revenue</Text></View>
                  <View style={styles.stat}><Text style={styles.value}>{formatKES(row.spent)}</Text><Text style={styles.label}>Costs</Text></View>
                  <View style={styles.stat}><Text style={[styles.value, row.net >= 0 ? styles.good : styles.bad]}>{formatKES(row.net)}</Text><Text style={styles.label}>Net</Text></View>
                  <View style={styles.stat}><Text style={styles.value}>{row.yieldKg.toLocaleString()}</Text><Text style={styles.label}>Yield kg</Text></View>
                </View>
                <View style={styles.footerRow}>
                  <Text style={styles.footerKey}>Margin</Text>
                  <Text style={styles.footerValue}>{row.margin ? `${row.margin.toFixed(0)}%` : "—"}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No seasons available yet.</Text>
          )}
        </View>

        <Pressable style={styles.primaryBtn} onPress={() => router.push("/season-history") }>
          <Ionicons name="time-outline" size={18} color={COLORS.white} />
          <Text style={styles.primaryBtnText}>Back to Season History</Text>
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
  compareRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  compareKey: { fontFamily: "DMSans_600SemiBold", fontSize: 12, color: COLORS.textSecondary },
  compareValue: { fontFamily: "DMSans_700Bold", fontSize: 12, color: COLORS.text },
  seasonCard: { gap: 12, paddingTop: 4, paddingBottom: 8 },
  seasonTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  seasonName: { fontFamily: "DMSans_700Bold", fontSize: 16, color: COLORS.text },
  seasonSub: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeActive: { backgroundColor: COLORS.primarySurface },
  badgeClosed: { backgroundColor: COLORS.borderLight },
  badgePlanning: { backgroundColor: COLORS.amberLight },
  badgeText: { fontFamily: "DMSans_600SemiBold", fontSize: 11, color: COLORS.textSecondary, textTransform: "capitalize" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stat: { flexBasis: "48%", flexGrow: 1, backgroundColor: COLORS.background, borderRadius: 12, padding: 10, gap: 3 },
  value: { fontFamily: "DMSans_700Bold", fontSize: 14, color: COLORS.text },
  label: { fontFamily: "DMSans_400Regular", fontSize: 10, color: COLORS.textSecondary },
  good: { color: COLORS.primary },
  bad: { color: COLORS.red },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerKey: { fontFamily: "DMSans_600SemiBold", fontSize: 12, color: COLORS.textSecondary },
  footerValue: { fontFamily: "DMSans_700Bold", fontSize: 12, color: COLORS.text },
  emptyText: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textMuted },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 13 },
  primaryBtnText: { fontFamily: "DMSans_700Bold", fontSize: 14, color: COLORS.white },
});