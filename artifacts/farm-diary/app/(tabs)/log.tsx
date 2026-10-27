import React, { useState } from "react";
import { BrandRow } from "@/components/BrandRow";
import { linkedCostsForActivity } from "@/lib/activity-costs";
import { confirmRemoveActivity } from "@/lib/confirm-remove-activity";
import { View, Text, StyleSheet, Pressable, Platform, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import COLORS, { CARD_SHADOW } from "@/constants/colors";
import { useFarm } from "@/context/FarmContext";
import { getDaysUntil, formatDate, formatKES, ActivityLog } from "@/lib/storage";
import ActivityLogDetailModal from "@/components/ActivityLogDetailModal";

export default function LogScreen() {
  const insets = useSafeAreaInsets();
  const { getCompletedActivityIds, activityLogs, removeActivityLog, currentSchedule, costs, removeCost, editCostEntry } = useFarm();
  const completedIds = getCompletedActivityIds();
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const upcoming = currentSchedule.filter((a) => !completedIds.includes(a.id)).slice(0, 5);

  return (
    <ScrollView
      style={[styles.container, { paddingTop: topPadding }]}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + 120 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <BrandRow />
        <Text style={styles.screenTitle}>Log Activity</Text>
        <Text style={styles.screenSubtitle}>Record field activities quickly</Text>
      </View>

      <View style={styles.mainAction}>
        <Pressable
          style={styles.logButton}
          onPress={() => router.push("/log-activity")}
        >
          <Ionicons name="leaf" size={170} color="rgba(255,255,255,0.05)" style={styles.heroWatermark} pointerEvents="none" />
          <View style={styles.logButtonIcon}>
            <Ionicons name="add" size={34} color={COLORS.white} />
          </View>
          <Text style={styles.logButtonTitle}>Log New Activity</Text>
          <Text style={styles.logButtonSub}>Spray · Earthing Up · Harvest · Other</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Upcoming Activities</Text>
        {upcoming.map((activity) => {
          const daysUntil = getDaysUntil(activity.plannedDate);
          const isOverdue = daysUntil < 0;
          const isDueSoon = daysUntil <= 3 && daysUntil >= 0;

          return (
            <Pressable
              key={activity.id}
              style={styles.upcomingCard}
              onPress={() =>
                router.push({ pathname: "/log-activity", params: { activityId: activity.id } })
              }
            >
              <View style={styles.upcomingLeft}>
                <Text style={styles.upcomingName} numberOfLines={1}>{activity.name}</Text>
                <Text style={styles.upcomingDate}>
                  {activity.blockName} · {formatDate(activity.plannedDate)}
                </Text>
              </View>
              <View style={styles.upcomingRight}>
                <View
                  style={[
                    styles.daysBadge,
                    {
                      backgroundColor: isOverdue
                        ? COLORS.redLight
                        : isDueSoon
                        ? COLORS.amberLight
                        : COLORS.primarySurface,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.daysBadgeText,
                      {
                        color: isOverdue
                          ? COLORS.red
                          : isDueSoon
                          ? COLORS.amber
                          : COLORS.primary,
                      },
                    ]}
                  >
                    {isOverdue
                      ? `${Math.abs(daysUntil)}d overdue`
                      : daysUntil === 0
                      ? "Today"
                      : `${daysUntil}d`}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Recent Logs</Text>
          <Pressable onPress={() => router.push("/all-logs")} hitSlop={8}>
            <Text style={styles.viewAllLink}>View All</Text>
          </Pressable>
        </View>
        {activityLogs.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="clipboard-outline" size={32} color={COLORS.border} />
            <Text style={styles.emptyText}>No activities logged yet</Text>
          </View>
        ) : (
          [...activityLogs]
            .sort((a, b) => new Date(b.actual_date).getTime() - new Date(a.actual_date).getTime())
            .slice(0, 10)
            .map((log) => (
              <Pressable
                key={log.id}
                style={({ pressed }) => [styles.recentCard, pressed && { opacity: 0.85 }]}
                onPress={() => setSelectedLog(log)}
              >
                <View style={styles.recentDot} />
                <View style={styles.recentInfo}>
                  <Text style={styles.recentName} numberOfLines={1}>{log.activity_name}</Text>
                  <Text style={styles.recentDate}>{formatDate(log.actual_date)}</Text>
                </View>
                {log.total_cost_kes > 0 && (
                  <Text style={styles.recentCost}>{formatKES(log.total_cost_kes)}</Text>
                )}
                <Pressable
                  style={styles.editBtn}
                  onPress={() => router.push({ pathname: "/edit-activity", params: { logId: log.id } })}
                  hitSlop={8}
                >
                  <Ionicons name="pencil-outline" size={16} color={COLORS.primary} />
                </Pressable>
                <Pressable
                  style={styles.deleteBtn}
                  hitSlop={8}
                  onPress={() => confirmRemoveActivity({
                    log,
                    linkedCosts: linkedCostsForActivity(log.id, costs),
                    removeActivityLog, removeCost, editCostEntry,
                  })}
                >
                  <Ionicons name="trash-outline" size={16} color={COLORS.red} />
                </Pressable>
              </Pressable>
            ))
        )}
      </View>

      {selectedLog && (
        <ActivityLogDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
          onDelete={() => confirmRemoveActivity({
            log: selectedLog,
            linkedCosts: linkedCostsForActivity(selectedLog.id, costs),
            removeActivityLog, removeCost, editCostEntry,
            onRemoved: () => setSelectedLog(null),
          })}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 4,
  },
  header: {
    paddingTop: 8,
    paddingBottom: 16,
    gap: 2,
  },
  screenTitle: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 32,
    letterSpacing: -0.5,
    color: COLORS.text,
  },
  screenSubtitle: {
    fontFamily: "Manrope_400Regular",
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  mainAction: {
    marginBottom: 20,
  },
  logButton: {
    backgroundColor: COLORS.ink,
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 8,
    overflow: "hidden",
    ...CARD_SHADOW,
  },
  logButtonIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  logButtonTitle: {
    fontFamily: "Manrope_700Bold",
    fontSize: 22,
    color: COLORS.inkText,
  },
  logButtonSub: {
    fontFamily: "Manrope_500Medium",
    fontSize: 14,
    color: COLORS.inkMuted,
  },
  section: {
    marginBottom: 20,
    gap: 8,
  },
  sectionTitle: {
    fontFamily: "Manrope_700Bold",
    fontSize: 15,
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  upcomingCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...CARD_SHADOW,
  },
  upcomingLeft: {
    flex: 1,
    gap: 2,
  },
  upcomingName: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 15,
    color: COLORS.text,
  },
  upcomingDate: {
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  upcomingRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  daysBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  daysBadgeText: {
    fontFamily: "Manrope_700Bold",
    fontSize: 13,
  },
  recentCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    ...CARD_SHADOW,
  },
  recentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  recentInfo: {
    flex: 1,
    gap: 2,
  },
  recentName: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 14,
    color: COLORS.text,
  },
  recentDate: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  recentCost: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 13,
    color: COLORS.primary,
  },
  editBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.primarySurface,
    alignItems: "center", justifyContent: "center",
  },
  deleteBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.redLight,
    alignItems: "center", justifyContent: "center",
  },
  sectionTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  viewAllLink: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 14,
    color: COLORS.primary,
  },
  emptyState: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 24,
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    ...CARD_SHADOW,
  },
  emptyText: {
    fontFamily: "Manrope_400Regular",
    fontSize: 15,
    color: COLORS.textMuted,
  },
  heroWatermark: {
    position: "absolute",
    right: -30,
    bottom: -44,
  },
});
