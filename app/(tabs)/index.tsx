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
import { SECTIONS_SEED, PLANNED_SCHEDULE, TOTAL_ESTIMATED_COST } from "@/constants/farmData";
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
  const { costs, activityLogs, isLoading, refresh, totalSpent, getCompletedActivityIds, getNextActivity } = useFarm();
  const [dismissedAlert, setDismissedAlert] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const completedIds = getCompletedActivityIds();

  const budgetPercent = Math.min((totalSpent / TOTAL_ESTIMATED_COST) * 100, 100);

  const hasOverdue = PLANNED_SCHEDULE.some((activity) => {
    if (completedIds.includes(activity.id)) return false;
    const daysUntilA = getDaysUntil(activity.plannedDateA);
    return daysUntilA < -3;
  });

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

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
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.farmName}>Rift Valley</Text>
          <Text style={styles.farmSub}>Potato Farm — Long Rains 2026</Text>
        </View>
        <View style={styles.headerBadge}>
          <Ionicons name="leaf" size={14} color={COLORS.primary} />
          <Text style={styles.headerBadgeText}>Active</Text>
        </View>
      </View>

      {/* Alert Banner */}
      {hasOverdue && !dismissedAlert && (
        <View style={styles.alertBanner}>
          <Ionicons name="warning" size={18} color={COLORS.white} />
          <Text style={styles.alertText}>Activity overdue — check schedule</Text>
          <Pressable onPress={() => setDismissedAlert(true)} hitSlop={12}>
            <Ionicons name="close" size={18} color={COLORS.white} />
          </Pressable>
        </View>
      )}

      {/* Section Cards */}
      {SECTIONS_SEED.map((section) => {
        const isA = section.id === "section-a";
        const daysSincePlanting = getDaysSincePlanting(section.planting_date);
        const growthStage = getGrowthStage(section.planting_date);
        const nextActivity = getNextActivity(section.id);
        const nextDate = nextActivity ? (isA ? nextActivity.plannedDateA : nextActivity.plannedDateB) : null;
        const daysUntilNext = nextDate ? getDaysUntil(nextDate) : 999;
        const urgencyColor = getUrgencyColor(daysUntilNext);
        const urgencyBg = getUrgencyBg(daysUntilNext);

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

            {section.blight_risk === "HIGH" && (
              <View style={styles.blightNote}>
                <Ionicons name="information-circle-outline" size={13} color={COLORS.red} />
                <Text style={styles.blightNoteText}>Never skip sprays. Max 12-day interval.</Text>
              </View>
            )}
          </View>
        );
      })}

      {/* Budget Bar */}
      <View style={styles.budgetCard}>
        <View style={styles.budgetHeader}>
          <Text style={styles.budgetTitle}>Season Budget</Text>
          <Text style={styles.budgetPercent}>{Math.round(budgetPercent)}%</Text>
        </View>
        <View style={styles.budgetBar}>
          <View style={[styles.budgetFill, { width: `${budgetPercent}%` }]} />
        </View>
        <View style={styles.budgetFooter}>
          <Text style={styles.budgetSpent}>{formatKES(totalSpent)} spent</Text>
          <Text style={styles.budgetTotal}>of {formatKES(TOTAL_ESTIMATED_COST)} estimated</Text>
        </View>
        <View style={styles.costBreakdown}>
          <View style={styles.costBreakdownItem}>
            <Text style={styles.breakdownLabel}>Entries</Text>
            <Text style={styles.breakdownValue}>{costs.length}</Text>
          </View>
          <View style={styles.costBreakdownItem}>
            <Text style={styles.breakdownLabel}>Remaining</Text>
            <Text style={[styles.breakdownValue, { color: COLORS.primary }]}>
              {formatKES(Math.max(0, TOTAL_ESTIMATED_COST - totalSpent))}
            </Text>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Pressable
          style={[styles.actionBtn, styles.actionBtnPrimary]}
          onPress={() => router.push("/log-activity")}
        >
          <Ionicons name="clipboard-outline" size={20} color={COLORS.white} />
          <Text style={styles.actionBtnTextPrimary}>Log Activity</Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, styles.actionBtnSecondary]}
          onPress={() => router.push("/add-cost")}
        >
          <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
          <Text style={styles.actionBtnTextSecondary}>Add Cost</Text>
        </Pressable>
      </View>

      {/* Season Info */}
      <View style={styles.seasonInfo}>
        <Text style={styles.seasonInfoTitle}>Season Timeline</Text>
        <View style={styles.seasonDates}>
          <View style={styles.seasonDate}>
            <Ionicons name="calendar-outline" size={14} color={COLORS.textMuted} />
            <Text style={styles.seasonDateLabel}>Sec A Planted</Text>
            <Text style={styles.seasonDateValue}>{formatDate(SECTIONS_SEED[0].planting_date)}</Text>
          </View>
          <View style={styles.seasonDate}>
            <Ionicons name="calendar-outline" size={14} color={COLORS.textMuted} />
            <Text style={styles.seasonDateLabel}>Sec B Planted</Text>
            <Text style={styles.seasonDateValue}>{formatDate(SECTIONS_SEED[1].planting_date)}</Text>
          </View>
          <View style={styles.seasonDate}>
            <Ionicons name="sunny-outline" size={14} color={COLORS.amber} />
            <Text style={styles.seasonDateLabel}>Est. Harvest A</Text>
            <Text style={styles.seasonDateValue}>{formatDate(SECTIONS_SEED[0].estimated_harvest)}</Text>
          </View>
          <View style={styles.seasonDate}>
            <Ionicons name="sunny-outline" size={14} color={COLORS.amber} />
            <Text style={styles.seasonDateLabel}>Est. Harvest B</Text>
            <Text style={styles.seasonDateValue}>{formatDate(SECTIONS_SEED[1].estimated_harvest)}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 16,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  farmName: {
    fontFamily: "DMSans_700Bold",
    fontSize: 28,
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  farmSub: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.primarySurface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  headerBadgeText: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 12,
    color: COLORS.primary,
  },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.red,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  alertText: {
    flex: 1,
    fontFamily: "DMSans_500Medium",
    fontSize: 13,
    color: COLORS.white,
  },
  sectionCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sectionBadgeText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 12,
    color: COLORS.white,
  },
  sectionVariety: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 16,
    color: COLORS.text,
  },
  blightBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  blightText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 10,
    letterSpacing: 0.5,
  },
  sectionStats: {
    flexDirection: "row",
    backgroundColor: COLORS.borderLight,
    borderRadius: 12,
    padding: 12,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statValue: {
    fontFamily: "DMSans_700Bold",
    fontSize: 20,
    color: COLORS.text,
  },
  statLabel: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: COLORS.textMuted,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginVertical: 2,
  },
  nextActivity: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 10,
  },
  nextActivityLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  nextActivityText: {
    flex: 1,
    gap: 2,
  },
  nextActivityName: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 13,
  },
  nextActivityDate: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  daysUntilBadge: {
    marginLeft: 8,
  },
  daysUntilText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 13,
  },
  blightNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingTop: 4,
  },
  blightNoteText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: COLORS.red,
    flex: 1,
  },
  budgetCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    gap: 10,
  },
  budgetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  budgetTitle: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 15,
    color: COLORS.text,
  },
  budgetPercent: {
    fontFamily: "DMSans_700Bold",
    fontSize: 15,
    color: COLORS.primary,
  },
  budgetBar: {
    height: 8,
    backgroundColor: COLORS.borderLight,
    borderRadius: 4,
    overflow: "hidden",
  },
  budgetFill: {
    height: "100%",
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  budgetFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  budgetSpent: {
    fontFamily: "DMSans_700Bold",
    fontSize: 14,
    color: COLORS.text,
  },
  budgetTotal: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  costBreakdown: {
    flexDirection: "row",
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: 10,
  },
  costBreakdownItem: {
    gap: 2,
  },
  breakdownLabel: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: COLORS.textMuted,
  },
  breakdownValue: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 14,
    color: COLORS.text,
  },
  quickActions: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    minHeight: 52,
  },
  actionBtnPrimary: {
    backgroundColor: COLORS.primary,
  },
  actionBtnSecondary: {
    backgroundColor: COLORS.primarySurface,
    borderWidth: 1.5,
    borderColor: COLORS.primaryLight,
  },
  actionBtnTextPrimary: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 14,
    color: COLORS.white,
  },
  actionBtnTextSecondary: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 14,
    color: COLORS.primary,
  },
  seasonInfo: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    gap: 12,
  },
  seasonInfoTitle: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 14,
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  seasonDates: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  seasonDate: {
    width: "47%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.borderLight,
    borderRadius: 8,
    padding: 8,
  },
  seasonDateLabel: {
    fontFamily: "DMSans_400Regular",
    fontSize: 10,
    color: COLORS.textMuted,
    flex: 1,
  },
  seasonDateValue: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 11,
    color: COLORS.text,
  },
});
