import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFarm } from "@/context/FarmContext";
import COLORS from "@/constants/colors";
import { TOTAL_ESTIMATED_COST } from "@/constants/farmData";
import {
  getGrowthStage,
  getDaysSincePlanting,
  getDaysUntil,
  formatKES,
  formatDate,
} from "@/lib/storage";

function getUrgencyColor(daysUntil: number) {
  if (daysUntil <= 0) return COLORS.red;
  if (daysUntil <= 3) return COLORS.red;
  if (daysUntil <= 7) return COLORS.amber;
  return COLORS.primary;
}

function getUrgencyBg(daysUntil: number) {
  if (daysUntil <= 3) return COLORS.redLight;
  if (daysUntil <= 7) return COLORS.amberLight;
  return COLORS.primarySurface;
}

function getActivityTypeIcon(type: string) {
  switch (type) {
    case "Spray": return "water-outline";
    case "Herbicide": return "leaf-outline";
    case "Earthing Up + Fertilizer":
    case "Earthing Up": return "layers-outline";
    case "Harvest": return "bag-handle-outline";
    case "Observation": return "eye-outline";
    default: return "checkmark-circle-outline";
  }
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const {
    costs,
    activityLogs,
    refresh,
    totalSpent,
    getCompletedActivityIds,
    getNextActivity,
    getLastSprayDate,
    activeSeason,
    currentSchedule,
    harvestRecords,
    activeFarm,
  } = useFarm();
  const [dismissedAlert, setDismissedAlert] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const completedIds = getCompletedActivityIds();
  const estimatedTotal = TOTAL_ESTIMATED_COST;
  const budgetPercent = Math.min((totalSpent / estimatedTotal) * 100, 100);
  const totalAcres = activeSeason ? activeSeason.section_a.acres + (activeSeason.section_b.acres || 0) : 0;
  const totalRevenue = harvestRecords.filter((r) => r.season_id === activeSeason?.id).reduce((sum, r) => sum + r.total_revenue_kes, 0);
  const totalYield = harvestRecords.filter((r) => r.season_id === activeSeason?.id).reduce((sum, r) => sum + r.total_kg, 0);
  const netProfit = totalRevenue - totalSpent;

  const hasOverdue = currentSchedule.some((activity) => {
    if (completedIds.includes(activity.id)) return false;
    const daysUntilA = getDaysUntil(activity.plannedDateA);
    return daysUntilA < -3;
  });

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  const sections = activeSeason
    ? [
        {
          id: "section-a",
          label: "Section A",
          variety: activeSeason.section_a.variety,
          acres: activeSeason.section_a.acres,
          planting_date: activeSeason.section_a.planting_date,
          blight_risk: activeSeason.section_a.blight_risk,
        },
        ...(activeSeason.section_b.acres > 0
          ? [
              {
                id: "section-b",
                label: "Section B",
                variety: activeSeason.section_b.variety,
                acres: activeSeason.section_b.acres,
                planting_date: activeSeason.section_b.planting_date,
                blight_risk: activeSeason.section_b.blight_risk,
              },
            ]
          : []),
      ]
    : [];

  const seasonStatusLabel = activeSeason?.status === "closed"
    ? "Closed"
    : activeSeason?.status === "planning"
    ? "Planning"
    : "Active";

  return (
    <ScrollView
      style={[styles.container]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPadding + 16, paddingBottom: bottomPadding + 100 },
      ]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.farmName}>{activeFarm?.name || "My Farm"}</Text>
          <Text style={styles.farmSub}>
            {activeFarm?.crop_type || "Farm"} — {activeSeason?.season_name || "No active season"}
          </Text>
        </View>
        <Pressable
          style={styles.headerBadge}
          onPress={() => router.push("/season-control")}
        >
          <Ionicons
            name={activeSeason?.status === "active" ? "leaf" : "leaf-outline"}
            size={14}
            color={COLORS.primary}
          />
          <Text style={styles.headerBadgeText}>{seasonStatusLabel}</Text>
        </Pressable>
      </View>

      {activeSeason && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryTitleWrap}>
              <View style={styles.summaryKicker}>
                <Ionicons name="leaf-outline" size={14} color={COLORS.primary} />
                <Text style={styles.summaryKickerText}>Season Summary</Text>
              </View>
              <Text style={styles.summaryTitle}>{activeSeason.season_name}</Text>
              <Text style={styles.summarySubtitle}>
                {seasonStatusLabel} · {activeSeason.season_type} · {totalAcres} acres
              </Text>
            </View>
            <Pressable style={styles.summaryAction} onPress={() => router.push("/season-control")}>
              <Ionicons name="options-outline" size={16} color={COLORS.primary} />
            </Pressable>
          </View>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, netProfit >= 0 ? styles.summaryPositive : styles.summaryNegative]}>
                {formatKES(netProfit)}
              </Text>
              <Text style={styles.summaryText}>Net profit</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{totalAcres}</Text>
              <Text style={styles.summaryText}>Planted acres</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{currentSchedule.length - completedIds.length}</Text>
              <Text style={styles.summaryText}>Pending tasks</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{budgetPercent.toFixed(0)}%</Text>
              <Text style={styles.summaryText}>Budget used</Text>
            </View>
          </View>

          <View style={styles.summaryFooter}>
            <View style={styles.summaryPill}>
              <Ionicons name="calendar-outline" size={12} color={COLORS.textSecondary} />
              <Text style={styles.summaryPillText}>{currentSchedule.length} planned</Text>
            </View>
            <View style={styles.summaryPill}>
              <Ionicons name="checkmark-circle-outline" size={12} color={COLORS.textSecondary} />
              <Text style={styles.summaryPillText}>{completedIds.length} done</Text>
            </View>
            <View style={styles.summaryPill}>
              <Ionicons name="wallet-outline" size={12} color={COLORS.textSecondary} />
              <Text style={styles.summaryPillText}>{formatKES(totalSpent)} spent</Text>
            </View>
          </View>
        </View>
      )}

      {activeSeason && (
        <Pressable style={styles.harvestCard} onPress={() => router.push("/season-report")}>
          <View style={styles.harvestHeader}>
            <View>
              <Text style={styles.harvestLabel}>Harvest Report</Text>
              <Text style={styles.harvestTitle}>
                {harvestRecords.some((r) => r.season_id === activeSeason.id) ? "Season complete" : "Harvest pending"}
              </Text>
            </View>
            <View style={styles.harvestBadge}>
              <Ionicons name="receipt-outline" size={14} color={COLORS.primary} />
            </View>
          </View>
          <View style={styles.harvestGrid}>
            <View style={styles.harvestItem}>
              <Text style={styles.harvestValue}>{totalYield.toLocaleString()}</Text>
              <Text style={styles.harvestText}>Yield kg</Text>
            </View>
            <View style={styles.harvestItem}>
              <Text style={styles.harvestValue}>{formatKES(totalRevenue)}</Text>
              <Text style={styles.harvestText}>Revenue</Text>
            </View>
            <View style={styles.harvestItem}>
              <Text style={[styles.harvestValue, netProfit >= 0 ? styles.summaryPositive : styles.summaryNegative]}>
                {formatKES(netProfit)}
              </Text>
              <Text style={styles.harvestText}>Net</Text>
            </View>
          </View>
        </Pressable>
      )}

      {hasOverdue && !dismissedAlert && (
        <View style={styles.alertBanner}>
          <Ionicons name="warning" size={18} color={COLORS.white} />
          <Text style={styles.alertText}>Activity overdue — check schedule</Text>
          <Pressable onPress={() => setDismissedAlert(true)} hitSlop={12}>
            <Ionicons name="close" size={18} color={COLORS.white} />
          </Pressable>
        </View>
      )}

      {!activeSeason && (
        <Pressable style={styles.noSeasonCard} onPress={() => router.push("/season-setup") }>
          <Ionicons name="add-circle-outline" size={28} color={COLORS.primary} />
          <View style={styles.noSeasonText}>
            <Text style={styles.noSeasonTitle}>Start your season</Text>
            <Text style={styles.noSeasonSub}>Set your planting date to generate a full schedule</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </Pressable>
      )}

      {sections.map((section) => {
        const isA = section.id === "section-a";
        const daysSincePlanting = getDaysSincePlanting(section.planting_date);
        const growthStage = getGrowthStage(section.planting_date);
        const nextActivity = getNextActivity(section.id);
        const nextDate = nextActivity ? (isA ? nextActivity.plannedDateA : nextActivity.plannedDateB) : null;
        const daysUntilNext = nextDate ? getDaysUntil(nextDate) : 999;
        const urgencyColor = getUrgencyColor(daysUntilNext);
        const urgencyBg = getUrgencyBg(daysUntilNext);

        const lastSpray = getLastSprayDate(section.id);
        const daysSinceSpray = lastSpray
          ? Math.floor((new Date().getTime() - new Date(lastSpray).getTime()) / (1000 * 60 * 60 * 24))
          : null;
        const sprayWarning = section.blight_risk === "HIGH" && daysSinceSpray !== null && daysSinceSpray >= 10;
        const sprayAlert = section.blight_risk === "HIGH" && daysSinceSpray !== null && daysSinceSpray >= 12;

        return (
          <View key={section.id} style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionLabelRow}>
                <View style={[styles.sectionBadge, { backgroundColor: isA ? COLORS.primary : COLORS.teal }]}>
                  <Text style={styles.sectionBadgeText}>{section.label}</Text>
                </View>
                <Text style={styles.sectionVariety}>{section.variety}</Text>
              </View>
              <View style={[styles.blightBadge, { backgroundColor: section.blight_risk === "HIGH" ? COLORS.redLight : COLORS.amberLight }]}>
                <Text style={[styles.blightText, { color: section.blight_risk === "HIGH" ? COLORS.red : COLORS.amber }]}>
                  {section.blight_risk} RISK
                </Text>
              </View>
            </View>

            <View style={styles.sectionStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{Math.max(0, daysSincePlanting)}</Text>
                <Text style={styles.statLabel}>Days Old</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{section.acres}</Text>
                <Text style={styles.statLabel}>Acres</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{growthStage.split("—")[0].trim()}</Text>
                <Text style={styles.statLabel}>Stage</Text>
              </View>
            </View>

            {nextActivity && (
              <View style={[styles.nextActivity, { backgroundColor: urgencyBg }]}>
                <View style={styles.nextActivityLeft}>
                  <Ionicons name={getActivityTypeIcon(nextActivity.activityType) as any} size={18} color={urgencyColor} />
                  <View style={styles.nextActivityText}>
                    <Text style={[styles.nextActivityName, { color: urgencyColor }]} numberOfLines={1}>
                      {nextActivity.name}
                    </Text>
                    <Text style={styles.nextActivityDate}>
                      {nextDate ? formatDate(nextDate) : "—"}
                    </Text>
                  </View>
                </View>
                <View style={styles.daysUntilBadge}>
                  <Text style={[styles.daysUntilText, { color: urgencyColor }]}>
                    {daysUntilNext === 0 ? "Today" : daysUntilNext < 0 ? `${Math.abs(daysUntilNext)}d late` : `${daysUntilNext}d`}
                  </Text>
                </View>
              </View>
            )}

            <View style={[styles.sprayBar, sprayAlert ? styles.sprayBarAlert : sprayWarning ? styles.sprayBarWarn : styles.sprayBarOk]}>
              <Ionicons
                name={sprayAlert ? "warning" : "water-outline"}
                size={14}
                color={sprayAlert ? COLORS.red : sprayWarning ? COLORS.amber : COLORS.primary}
              />
              {daysSinceSpray !== null ? (
                <Text style={[styles.sprayBarText, { color: sprayAlert ? COLORS.red : sprayWarning ? COLORS.amber : COLORS.primary }]}>
                  {sprayAlert
                    ? `OVERDUE — Last spray ${daysSinceSpray}d ago (max 12d!)`
                    : sprayWarning
                    ? `Last spray ${daysSinceSpray}d ago — spray soon`
                    : `Last spray ${daysSinceSpray}d ago`}
                </Text>
              ) : (
                <Text style={[styles.sprayBarText, { color: COLORS.textMuted }]}>No spray recorded yet</Text>
              )}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 16, gap: 14 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  farmName: { fontFamily: "DMSans_700Bold", fontSize: 28, color: COLORS.text },
  farmSub: { marginTop: 4, fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.textSecondary },
  headerBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: COLORS.primarySurface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  headerBadgeText: { fontFamily: "DMSans_600SemiBold", fontSize: 12, color: COLORS.primary },
  summaryCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 18,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: COLORS.primaryLight + "25",
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  summaryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  summaryTitleWrap: { flex: 1, gap: 4 },
  summaryKicker: { flexDirection: "row", alignItems: "center", gap: 6 },
  summaryKickerText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 11,
    color: COLORS.primary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  summarySubtitle: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary, lineHeight: 17 },
  summaryTitle: { fontFamily: "DMSans_700Bold", fontSize: 18, color: COLORS.text },
  summaryAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primarySurface,
  },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryItem: { flexGrow: 1, flexBasis: "48%", backgroundColor: COLORS.background, borderRadius: 14, padding: 12, gap: 4 },
  summaryValue: { fontFamily: "DMSans_700Bold", fontSize: 18, color: COLORS.primary },
  summaryPositive: { color: COLORS.primary },
  summaryNegative: { color: COLORS.red },
  summaryText: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary },
  summaryFooter: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  summaryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.borderLight,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  summaryPillText: { fontFamily: "DMSans_600SemiBold", fontSize: 11, color: COLORS.textSecondary },
  harvestCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  harvestHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  harvestLabel: {
    fontFamily: "DMSans_700Bold",
    fontSize: 11,
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  harvestTitle: { fontFamily: "DMSans_700Bold", fontSize: 18, color: COLORS.text, marginTop: 2 },
  harvestBadge: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primarySurface },
  harvestGrid: { flexDirection: "row", gap: 8 },
  harvestItem: { flex: 1, backgroundColor: COLORS.background, borderRadius: 14, padding: 10, gap: 3 },
  harvestValue: { fontFamily: "DMSans_700Bold", fontSize: 14, color: COLORS.text },
  harvestText: { fontFamily: "DMSans_400Regular", fontSize: 10, color: COLORS.textSecondary },
  alertBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.red, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  alertText: { flex: 1, color: COLORS.white, fontFamily: "DMSans_600SemiBold", fontSize: 12 },
  noSeasonCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 16, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  noSeasonText: { flex: 1 },
  noSeasonTitle: { fontFamily: "DMSans_700Bold", fontSize: 16, color: COLORS.text },
  noSeasonSub: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  sectionCard: { backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 14, gap: 12, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 7, elevation: 2 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionLabelRow: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  sectionBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  sectionBadgeText: { fontFamily: "DMSans_700Bold", fontSize: 12, color: COLORS.white },
  sectionVariety: { flex: 1, fontFamily: "DMSans_700Bold", fontSize: 15, color: COLORS.text },
  blightBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  blightText: { fontFamily: "DMSans_700Bold", fontSize: 11 },
  sectionStats: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.background, borderRadius: 14, padding: 12 },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontFamily: "DMSans_700Bold", fontSize: 18, color: COLORS.text },
  statLabel: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: COLORS.borderLight },
  nextActivity: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 14, padding: 12 },
  nextActivityLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  nextActivityText: { flex: 1 },
  nextActivityName: { fontFamily: "DMSans_700Bold", fontSize: 14 },
  nextActivityDate: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  daysUntilBadge: { backgroundColor: COLORS.white, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  daysUntilText: { fontFamily: "DMSans_700Bold", fontSize: 11 },
  sprayBar: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  sprayBarOk: { backgroundColor: COLORS.primarySurface },
  sprayBarWarn: { backgroundColor: COLORS.amberLight },
  sprayBarAlert: { backgroundColor: COLORS.redLight },
  sprayBarText: { fontFamily: "DMSans_600SemiBold", fontSize: 12, flex: 1 },
});