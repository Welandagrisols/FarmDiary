import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFarm } from "@/context/FarmContext";
import COLORS, { CARD_SHADOW } from "@/constants/colors";
import { formatDate, formatKES } from "@/lib/storage";
import { getTemplate } from "@/constants/farmData";
import { formatHarvestTotals, getCropMeta } from "@/constants/cropTemplates";
import { FarmRole, getFarmRole, getFarmSales, SaleRecord } from "@/lib/sales-storage";
import { groupBySeason, seasonFinance } from "@/lib/season-finance";

export default function SeasonHistoryScreen() {
  const insets = useSafeAreaInsets();
  const { seasons, costs, harvestRecords, activeFarm } = useFarm();
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [role, setRole] = useState<FarmRole>("none");
  const [salesLoading, setSalesLoading] = useState(true);
  const [salesError, setSalesError] = useState("");
  const canViewFinancials = ["admin", "owner", "manager"].includes(role);

  useEffect(() => {
    let current = true;
    if (!activeFarm?.id) { setSalesLoading(false); return; }
    setSalesLoading(true);
    setSalesError("");
    (async () => {
      try {
        const nextRole = await getFarmRole(activeFarm.id);
        const rows = ["admin", "owner", "manager"].includes(nextRole) ? await getFarmSales(activeFarm.id) : [];
        if (!current) return;
        setRole(nextRole);
        setSales(rows);
      } catch (e: any) {
        if (current) setSalesError(e?.message || "Sales could not be loaded.");
      } finally {
        if (current) setSalesLoading(false);
      }
    })();
    return () => { current = false; };
  }, [activeFarm?.id]);

  const salesBySeason = useMemo(() => groupBySeason(sales), [sales]);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const closedSeasons = [...seasons].filter((season) => season.status === "closed").sort((a, b) => b.season_number - a.season_number);
  const comparison = closedSeasons.map((season) => {
    const seasonHarvests = harvestRecords.filter((r) => r.season_id === season.id);
    const f = seasonFinance({ seasonId: season.id, costs, harvest: harvestRecords, sales: salesBySeason.get(season.id) ?? [], includeHarvestRevenue: canViewFinancials });
    const yieldKg = seasonHarvests.reduce((sum, record) => sum + record.total_kg, 0);
    return { season, spent: f.costs, revenue: f.revenue, net: f.net, yieldKg };
  });

  const bestProfit = comparison.reduce((best, item) => (item.net > best.net ? item : best), comparison[0] || null);
  const worstProfit = comparison.reduce((worst, item) => (item.net < worst.net ? item : worst), comparison[0] || null);

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}> 
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.title}>Season History</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPadding + 90, gap: 12 }} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.compareBtn} onPress={() => router.push("/season-report") }>
          <Ionicons name="stats-chart-outline" size={18} color={COLORS.primary} />
          <Text style={styles.compareText}>Open full P&L</Text>
        </Pressable>

        {salesError ? <Text style={styles.compareLine}>Sales could not be loaded, so revenue and net may be incomplete: {salesError}</Text> : null}
        {!salesLoading && !salesError && !canViewFinancials && closedSeasons.length > 0 ? (
          <Text style={styles.compareLine}>Revenue and net are shown to the farm owner and manager.</Text>
        ) : null}

        {canViewFinancials && comparison.length > 0 ? (
          <View style={styles.compareCard}>
            <Text style={styles.compareTitle}>Comparison</Text>
            <Text style={styles.compareLine}>{bestProfit ? `Best: ${bestProfit.season.season_name} · ${formatKES(bestProfit.net)}` : ""}</Text>
            <Text style={styles.compareLine}>{worstProfit ? `Lowest: ${worstProfit.season.season_name} · ${formatKES(worstProfit.net)}` : ""}</Text>
          </View>
        ) : null}

        {closedSeasons.length > 0 ? (
          closedSeasons.map((season) => {
            const seasonHarvests = harvestRecords.filter((r) => r.season_id === season.id);
            const f = seasonFinance({ seasonId: season.id, costs, harvest: harvestRecords, sales: salesBySeason.get(season.id) ?? [], includeHarvestRevenue: canViewFinancials });
            const spent = f.costs;
            const revenue = f.revenue;
            const net = f.net;
            const crop = getTemplate(season.template_id).cropType;
            const harvestSummary = formatHarvestTotals(seasonHarvests, getCropMeta(season.template_id));

            return (
              <View key={season.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.cardTitle}>{season.season_name}</Text>
                    <Text style={styles.cardSub}>{crop} · {season.season_type} · Closed {season.closed_at ? formatDate(season.closed_at) : formatDate(season.created_at)}</Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Closed</Text>
                  </View>
                </View>
                <View style={styles.grid}>
                  {canViewFinancials ? (
                    <View style={styles.stat}><Text style={styles.value}>{salesLoading ? "…" : formatKES(revenue)}</Text><Text style={styles.label}>Revenue</Text></View>
                  ) : null}
                  <View style={styles.stat}><Text style={styles.value}>{formatKES(spent)}</Text><Text style={styles.label}>Costs</Text></View>
                  {canViewFinancials ? (
                    <View style={styles.stat}><Text style={[styles.value, net >= 0 ? styles.good : styles.bad]}>{salesLoading ? "…" : formatKES(net)}</Text><Text style={styles.label}>Net</Text></View>
                  ) : null}
                  <View style={styles.stat}><Text style={styles.value} numberOfLines={2}>{harvestSummary}</Text><Text style={styles.label}>Harvest quantity</Text></View>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="archive-outline" size={28} color={COLORS.primary} />
            <Text style={styles.emptyTitle}>No closed seasons yet</Text>
            <Text style={styles.emptySub}>Closed seasons will appear here for quick review.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.cardBg },
  title: { fontFamily: "Manrope_700Bold", fontSize: 18, color: COLORS.text },
  compareBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.primarySurface, borderRadius: 14, paddingVertical: 13 },
  compareText: {
    fontFamily: "Manrope_700Bold",
    fontSize: 14,
    color: COLORS.primary,
  },
  compareCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 14,
    gap: 4,
    ...CARD_SHADOW,
  },
  compareTitle: {
    fontFamily: "Manrope_700Bold",
    fontSize: 13,
    color: COLORS.textSecondary,
    textTransform: "uppercase",
  },
  compareLine: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 13,
    color: COLORS.text,
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 14,
    gap: 12,
    ...CARD_SHADOW,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  cardTitle: {
    fontFamily: "Manrope_700Bold",
    fontSize: 17,
    color: COLORS.text,
  },
  cardSub: {
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  badge: { backgroundColor: COLORS.borderLight, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stat: { flexBasis: "48%", flexGrow: 1, backgroundColor: COLORS.background, borderRadius: 12, padding: 10, gap: 3 },
  value: {
    fontFamily: "Manrope_700Bold",
    fontSize: 15,
    color: COLORS.text,
  },
  label: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  good: { color: COLORS.primary },
  bad: { color: COLORS.red },
  emptyCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 18,
    alignItems: "center",
    gap: 6,
    ...CARD_SHADOW,
  },
  emptyTitle: {
    fontFamily: "Manrope_700Bold",
    fontSize: 16,
    color: COLORS.text,
  },
  emptySub: {
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
  }});