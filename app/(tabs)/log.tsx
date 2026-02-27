import React from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "@/constants/colors";
import { PLANNED_SCHEDULE } from "@/constants/farmData";
import { useFarm } from "@/context/FarmContext";
import { getDaysUntil, formatDate, formatKES } from "@/lib/storage";

export default function LogScreen() {
  const insets = useSafeAreaInsets();
  const { getCompletedActivityIds, activityLogs } = useFarm();
  const completedIds = getCompletedActivityIds();

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  const upcoming = PLANNED_SCHEDULE.filter((a) => !completedIds.includes(a.id)).slice(0, 5);

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Log Activity</Text>
        <Text style={styles.screenSubtitle}>Record field activities quickly</Text>
      </View>

      <View style={styles.mainAction}>
        <Pressable
          style={styles.logButton}
          onPress={() => router.push("/log-activity")}
        >
          <View style={styles.logButtonIcon}>
            <Ionicons name="add" size={36} color={COLORS.white} />
          </View>
          <Text style={styles.logButtonTitle}>Log New Activity</Text>
          <Text style={styles.logButtonSub}>Spray · Earthing Up · Harvest · Other</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Upcoming Activities</Text>
        {upcoming.map((activity) => {
          const daysUntil = getDaysUntil(activity.plannedDateA);
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
                <Text style={styles.upcomingDate}>{formatDate(activity.plannedDateA)}</Text>
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
        <Text style={styles.sectionTitle}>Recent Logs</Text>
        {activityLogs.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="clipboard-outline" size={32} color={COLORS.border} />
            <Text style={styles.emptyText}>No activities logged yet</Text>
          </View>
        ) : (
          [...activityLogs]
            .sort((a, b) => new Date(b.actual_date).getTime() - new Date(a.actual_date).getTime())
            .slice(0, 5)
            .map((log) => (
              <View key={log.id} style={styles.recentCard}>
                <View style={styles.recentDot} />
                <View style={styles.recentInfo}>
                  <Text style={styles.recentName} numberOfLines={1}>{log.activity_name}</Text>
                  <Text style={styles.recentDate}>{formatDate(log.actual_date)}</Text>
                </View>
                {log.total_cost_kes > 0 && (
                  <Text style={styles.recentCost}>{formatKES(log.total_cost_kes)}</Text>
                )}
              </View>
            ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
  },
  header: {
    paddingTop: 8,
    paddingBottom: 16,
    gap: 2,
  },
  screenTitle: {
    fontFamily: "DMSans_700Bold",
    fontSize: 28,
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  mainAction: {
    marginBottom: 20,
  },
  logButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  logButtonIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  logButtonTitle: {
    fontFamily: "DMSans_700Bold",
    fontSize: 20,
    color: COLORS.white,
  },
  logButtonSub: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
  },
  section: {
    marginBottom: 20,
    gap: 8,
  },
  sectionTitle: {
    fontFamily: "DMSans_700Bold",
    fontSize: 14,
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  upcomingCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  upcomingLeft: {
    flex: 1,
    gap: 2,
  },
  upcomingName: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 14,
    color: COLORS.text,
  },
  upcomingDate: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
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
    fontFamily: "DMSans_700Bold",
    fontSize: 12,
  },
  recentCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
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
    fontFamily: "DMSans_600SemiBold",
    fontSize: 13,
    color: COLORS.text,
  },
  recentDate: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  recentCost: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 12,
    color: COLORS.primary,
  },
  emptyState: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 24,
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
  },
  emptyText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: COLORS.textMuted,
  },
});
