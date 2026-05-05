import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFarm } from "@/context/FarmContext";
import COLORS, { CATEGORY_COLORS } from "@/constants/colors";
import { formatDate, formatKES } from "@/lib/storage";

function SectionHeader({ title }: { title: string }) {
  return <Text style={rpt.sectionHeader}>{title}</Text>;
}

function StatRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={rpt.statRow}>
      <Text style={rpt.statLabel}>{label}</Text>
      <Text style={[rpt.statValue, valueColor ? { color: valueColor } : {}]}>{value}</Text>
    </View>
  );
}

export default function SeasonReportScreen() {
  const insets = useSafeAreaInsets();
  const {
    activeSeason,
    activeFarm,
    costs,
    harvestRecords,
    activityLogs,
    currentSchedule,
    plannedBudget,
    getCompletedActivityIds,
  } = useFarm();

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  if (!activeSeason) {
    return (
      <View style={[rpt.container, { paddingTop: topPadding }]}>
        <View style={rpt.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="arrow-back" size={24} color={COLORS.text} /></Pressable>
          <Text style={rpt.headerTitle}>Season Report</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: "DMSans_400Regular", color: COLORS.textSecondary }}>No active season</Text>
        </View>
      </View>
    );
  }

  const seasonCosts = costs.filter((c) => c.season_id === activeSeason.id);
  const seasonHarvest = harvestRecords.filter((r) => r.season_id === activeSeason.id);
  const seasonLogs = activityLogs.filter((l) => l.season_id === activeSeason.id);

  const totalRevenue = seasonHarvest.reduce((s, r) => s + r.total_revenue_kes, 0);
  const totalCosts = seasonCosts.reduce((s, c) => s + c.amount_kes, 0);
  const netPL = totalRevenue - totalCosts;
  const marginPct = totalRevenue > 0 ? (netPL / totalRevenue) * 100 : null;

  const totalBags = seasonHarvest.reduce((s, r) => s + r.bags, 0);
  const totalKg = seasonHarvest.reduce((s, r) => s + r.total_kg, 0);
  const totalAcres = activeSeason.section_a.acres + activeSeason.section_b.acres;
  const bagsPerAcre = totalAcres > 0 && totalBags > 0 ? (totalBags / totalAcres).toFixed(1) : "—";
  const kesPerKg = totalKg > 0 ? formatKES(Math.round(totalRevenue / totalKg)) : "—";

  const harvestA = seasonHarvest.filter((r) => r.section_id === "section-a");
  const harvestB = seasonHarvest.filter((r) => r.section_id === "section-b");
  const bagsA = harvestA.reduce((s, r) => s + r.bags, 0);
  const bagsB = harvestB.reduce((s, r) => s + r.bags, 0);
  const revenueA = harvestA.reduce((s, r) => s + r.total_revenue_kes, 0);
  const revenueB = harvestB.reduce((s, r) => s + r.total_revenue_kes, 0);

  const completedIds = getCompletedActivityIds();
  const completedCount = completedIds.length;
  const totalActivities = currentSchedule.length;
  const completionPct = totalActivities > 0 ? Math.round((completedCount / totalActivities) * 100) : 0;

  const budgetUsedPct = plannedBudget > 0 ? Math.min((totalCosts / plannedBudget) * 100, 100) : null;

  const categorySums: Record<string, number> = {};
  for (const c of seasonCosts) {
    categorySums[c.cost_category] = (categorySums[c.cost_category] || 0) + c.amount_kes;
  }
  const sortedCategories = Object.entries(categorySums).sort((a, b) => b[1] - a[1]);
  const maxCategoryAmount = sortedCategories[0]?.[1] || 1;

  return (
    <View style={[rpt.container, { paddingTop: topPadding }]}>
      <View style={rpt.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={rpt.headerTitle}>Season Report</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[rpt.scroll, { paddingBottom: bottomPadding + 60 }]} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={rpt.hero}>
          <Text style={rpt.heroSeason}>{activeSeason.season_name}</Text>
          <Text style={rpt.heroFarm}>{activeFarm?.name} · {activeSeason.season_type}</Text>
          <View style={rpt.heroMeta}>
            <View style={rpt.heroPill}><Ionicons name="calendar-outline" size={12} color={COLORS.white} /><Text style={rpt.heroPillText}>Planted {formatDate(activeSeason.section_a.planting_date)}</Text></View>
            <View style={rpt.heroPill}><Ionicons name="grid-outline" size={12} color={COLORS.white} /><Text style={rpt.heroPillText}>{totalAcres} acres</Text></View>
            <View style={rpt.heroPill}><Ionicons name="leaf-outline" size={12} color={COLORS.white} /><Text style={rpt.heroPillText}>{activeSeason.status}</Text></View>
          </View>
        </View>

        {/* P&L Summary */}
        <SectionHeader title="Financial Summary" />
        <View style={rpt.card}>
          <View style={rpt.plBanner}>
            <View>
              <Text style={rpt.plLabel}>Net {netPL >= 0 ? "Profit" : "Loss"}</Text>
              <Text style={[rpt.plValue, { color: netPL >= 0 ? COLORS.primary : COLORS.red }]}>{formatKES(Math.abs(netPL))}</Text>
            </View>
            {marginPct !== null && (
              <View style={[rpt.marginBadge, { backgroundColor: netPL >= 0 ? COLORS.primarySurface : COLORS.redLight }]}>
                <Text style={[rpt.marginText, { color: netPL >= 0 ? COLORS.primary : COLORS.red }]}>{marginPct.toFixed(1)}% margin</Text>
              </View>
            )}
          </View>
          <View style={rpt.divider} />
          <StatRow label="Revenue" value={formatKES(totalRevenue)} />
          <StatRow label="Total Costs" value={formatKES(totalCosts)} />
          <StatRow label="Net P&L" value={formatKES(netPL)} valueColor={netPL >= 0 ? COLORS.primary : COLORS.red} />
        </View>

        {/* Budget vs Actual */}
        {plannedBudget > 0 && (
          <>
            <SectionHeader title="Budget vs Actual" />
            <View style={rpt.card}>
              <StatRow label="Planned Budget" value={formatKES(plannedBudget)} />
              <StatRow label="Actual Spend" value={formatKES(totalCosts)} />
              {budgetUsedPct !== null && (
                <>
                  <View style={rpt.track}>
                    <View style={[rpt.fill, { width: `${budgetUsedPct}%`, backgroundColor: totalCosts > plannedBudget ? COLORS.red : COLORS.primary }]} />
                  </View>
                  <Text style={rpt.budgetNote}>
                    {totalCosts > plannedBudget
                      ? `${formatKES(totalCosts - plannedBudget)} over planned budget`
                      : `${formatKES(plannedBudget - totalCosts)} under budget · ${budgetUsedPct.toFixed(0)}% used`}
                  </Text>
                </>
              )}
            </View>
          </>
        )}

        {/* Costs by Category */}
        {sortedCategories.length > 0 && (
          <>
            <SectionHeader title="Costs by Category" />
            <View style={rpt.card}>
              {sortedCategories.map(([cat, amount]) => {
                const colors = CATEGORY_COLORS[cat] || { bg: COLORS.borderLight, text: COLORS.textSecondary };
                const pct = (amount / maxCategoryAmount) * 100;
                const pctOfTotal = totalCosts > 0 ? ((amount / totalCosts) * 100).toFixed(0) : "0";
                return (
                  <View key={cat} style={rpt.catRow}>
                    <View style={rpt.catLabelRow}>
                      <View style={[rpt.catDot, { backgroundColor: colors.text }]} />
                      <Text style={rpt.catLabel}>{cat}</Text>
                      <Text style={rpt.catPct}>{pctOfTotal}%</Text>
                    </View>
                    <View style={rpt.catBarBg}>
                      <View style={[rpt.catBarFill, { width: `${pct}%`, backgroundColor: colors.text }]} />
                    </View>
                    <Text style={rpt.catAmount}>{formatKES(amount)}</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Harvest Results */}
        <SectionHeader title="Harvest Results" />
        {seasonHarvest.length === 0 ? (
          <View style={rpt.emptyCard}><Ionicons name="basket-outline" size={28} color={COLORS.border} /><Text style={rpt.emptyText}>No harvest recorded yet</Text></View>
        ) : (
          <View style={rpt.card}>
            <View style={rpt.harvestHero}>
              <Text style={rpt.harvestRevLabel}>Total Revenue</Text>
              <Text style={rpt.harvestRevValue}>{formatKES(totalRevenue)}</Text>
              <Text style={rpt.harvestMeta}>{totalBags} bags · {totalKg.toLocaleString()} kg</Text>
            </View>
            <View style={rpt.divider} />
            <StatRow label="Bags per Acre" value={String(bagsPerAcre)} />
            <StatRow label="Revenue per kg" value={kesPerKg} />
            <View style={rpt.divider} />
            <View style={rpt.sectionSplit}>
              <View style={rpt.splitItem}>
                <Text style={rpt.splitLabel}>Sec A — {activeSeason.section_a.variety}</Text>
                <Text style={rpt.splitBags}>{bagsA} bags</Text>
                <Text style={rpt.splitRevenue}>{formatKES(revenueA)}</Text>
              </View>
              <View style={rpt.splitDivider} />
              <View style={rpt.splitItem}>
                <Text style={rpt.splitLabel}>Sec B — {activeSeason.section_b.variety}</Text>
                <Text style={rpt.splitBags}>{bagsB} bags</Text>
                <Text style={rpt.splitRevenue}>{formatKES(revenueB)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Activity Completion */}
        <SectionHeader title="Activity Completion" />
        <View style={rpt.card}>
          <View style={rpt.completionRow}>
            <Text style={rpt.completionPct}>{completionPct}%</Text>
            <View style={{ flex: 1, gap: 6 }}>
              <View style={rpt.track}>
                <View style={[rpt.fill, { width: `${completionPct}%`, backgroundColor: COLORS.primary }]} />
              </View>
              <Text style={rpt.completionNote}>{completedCount} of {totalActivities} activities completed</Text>
            </View>
          </View>
          <View style={rpt.divider} />
          <StatRow label="Scheduled Activities" value={String(totalActivities)} />
          <StatRow label="Completed" value={String(completedCount)} />
          <StatRow label="Logs Recorded" value={String(seasonLogs.length)} />
        </View>

        {/* Sections */}
        <SectionHeader title="Section Details" />
        <View style={rpt.card}>
          {[
            { label: "Section A", data: activeSeason.section_a },
            { label: "Section B", data: activeSeason.section_b },
          ].map(({ label, data }, i) => (
            <View key={label}>
              {i > 0 && activeSeason.section_b.acres > 0 && <View style={rpt.divider} />}
              <Text style={rpt.sectionLabel}>{label} — {data.variety}</Text>
              <StatRow label="Planting Date" value={formatDate(data.planting_date)} />
              <StatRow label="Area" value={`${data.acres} acres`} />
              <StatRow
                label="Blight Risk"
                value={data.blight_risk}
                valueColor={data.blight_risk === "HIGH" ? COLORS.red : data.blight_risk === "MEDIUM" ? COLORS.amber : COLORS.primary}
              />
            </View>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

const rpt = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.cardBg },
  headerTitle: { fontFamily: "DMSans_700Bold", fontSize: 18, color: COLORS.text },
  scroll: { padding: 16, gap: 6 },
  hero: { backgroundColor: COLORS.primary, borderRadius: 16, padding: 20, gap: 8, marginBottom: 8 },
  heroSeason: { fontFamily: "DMSans_700Bold", fontSize: 22, color: COLORS.white },
  heroFarm: { fontFamily: "DMSans_400Regular", fontSize: 13, color: "rgba(255,255,255,0.75)" },
  heroMeta: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  heroPill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  heroPillText: { fontFamily: "DMSans_600SemiBold", fontSize: 12, color: COLORS.white },
  sectionHeader: { fontFamily: "DMSans_700Bold", fontSize: 12, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 14, marginBottom: 6, paddingHorizontal: 2 },
  card: { backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 16, gap: 12, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  divider: { height: 1, backgroundColor: COLORS.borderLight },
  statRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statLabel: { fontFamily: "DMSans_400Regular", fontSize: 14, color: COLORS.textSecondary, flex: 1 },
  statValue: { fontFamily: "DMSans_700Bold", fontSize: 14, color: COLORS.text },
  plBanner: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  plLabel: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary, marginBottom: 2 },
  plValue: { fontFamily: "DMSans_700Bold", fontSize: 28, letterSpacing: -0.5 },
  marginBadge: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  marginText: { fontFamily: "DMSans_700Bold", fontSize: 13 },
  track: { height: 8, backgroundColor: COLORS.borderLight, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  budgetNote: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary },
  catRow: { gap: 4 },
  catLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catLabel: { flex: 1, fontFamily: "DMSans_500Medium", fontSize: 13, color: COLORS.text },
  catPct: { fontFamily: "DMSans_600SemiBold", fontSize: 12, color: COLORS.textSecondary },
  catBarBg: { height: 6, backgroundColor: COLORS.borderLight, borderRadius: 3, overflow: "hidden" },
  catBarFill: { height: "100%", borderRadius: 3 },
  catAmount: { fontFamily: "DMSans_600SemiBold", fontSize: 12, color: COLORS.textSecondary },
  harvestHero: { alignItems: "center", gap: 2 },
  harvestRevLabel: { fontFamily: "DMSans_700Bold", fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  harvestRevValue: { fontFamily: "DMSans_700Bold", fontSize: 28, color: COLORS.text },
  harvestMeta: { fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.textSecondary },
  sectionSplit: { flexDirection: "row" },
  splitItem: { flex: 1, gap: 3 },
  splitDivider: { width: 1, backgroundColor: COLORS.borderLight, marginHorizontal: 12 },
  splitLabel: { fontFamily: "DMSans_600SemiBold", fontSize: 12, color: COLORS.textSecondary },
  splitBags: { fontFamily: "DMSans_700Bold", fontSize: 16, color: COLORS.text },
  splitRevenue: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.primary },
  completionRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  completionPct: { fontFamily: "DMSans_700Bold", fontSize: 32, color: COLORS.primary, minWidth: 68 },
  completionNote: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary },
  sectionLabel: { fontFamily: "DMSans_700Bold", fontSize: 14, color: COLORS.text, marginBottom: 2 },
  emptyCard: { backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 24, alignItems: "center", gap: 8 },
  emptyText: { fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.textMuted },
});
