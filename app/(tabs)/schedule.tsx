import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Modal,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFarm } from "@/context/FarmContext";
import COLORS from "@/constants/colors";
import { PLANNED_SCHEDULE, PlannedActivity } from "@/constants/farmData";
import { getDaysUntil, formatDate, formatKES } from "@/lib/storage";

type ActivityStatus = "completed" | "overdue" | "due-soon" | "upcoming";

function getStatus(activity: PlannedActivity, completedIds: string[]): ActivityStatus {
  if (completedIds.includes(activity.id)) return "completed";
  const daysUntil = getDaysUntil(activity.plannedDateA);
  if (daysUntil < -3) return "overdue";
  if (daysUntil <= 3) return "due-soon";
  return "upcoming";
}

function StatusChip({ status }: { status: ActivityStatus }) {
  const config = {
    completed: { label: "Completed", bg: COLORS.primarySurface, color: COLORS.primary, icon: "checkmark-circle" as const },
    overdue: { label: "Overdue", bg: COLORS.redLight, color: COLORS.red, icon: "alert-circle" as const },
    "due-soon": { label: "Due Soon", bg: COLORS.amberLight, color: COLORS.amber, icon: "time-outline" as const },
    upcoming: { label: "Upcoming", bg: COLORS.borderLight, color: COLORS.textSecondary, icon: "calendar-outline" as const },
  }[status];

  return (
    <View style={[styles.statusChip, { backgroundColor: config.bg }]}>
      <Ionicons name={config.icon} size={11} color={config.color} />
      <Text style={[styles.statusChipText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

function getTypeColor(type: string) {
  switch (type) {
    case "Spray": return { bg: "#E3F2FD", color: "#1565C0" };
    case "Herbicide": return { bg: "#F3E5F5", color: "#6A1B9A" };
    case "Earthing Up + Fertilizer":
    case "Earthing Up": return { bg: "#FFF8E1", color: "#E65100" };
    case "Harvest": return { bg: "#E8F5E9", color: "#1B5E20" };
    case "Observation": return { bg: "#F5F5F5", color: "#616161" };
    default: return { bg: COLORS.borderLight, color: COLORS.textSecondary };
  }
}

function ActivityCard({ activity, status, onPress }: { activity: PlannedActivity; status: ActivityStatus; onPress: () => void }) {
  const typeColor = getTypeColor(activity.activityType);

  return (
    <Pressable
      style={({ pressed }) => [styles.activityCard, pressed && { opacity: 0.85 }]}
      onPress={onPress}
    >
      <View style={styles.cardLeft}>
        <View style={[styles.stageBadge, { backgroundColor: typeColor.bg }]}>
          <Text style={[styles.stageBadgeText, { color: typeColor.color }]}>{activity.activityType}</Text>
        </View>
        <Text style={styles.activityName} numberOfLines={2}>{activity.name}</Text>
        <View style={styles.datesRow}>
          <View style={styles.dateItem}>
            <Text style={styles.dateSectionLabel}>Sec A</Text>
            <Text style={styles.dateValue}>{formatDate(activity.plannedDateA)}</Text>
          </View>
          <View style={styles.dateDot} />
          <View style={styles.dateItem}>
            <Text style={styles.dateSectionLabel}>Sec B</Text>
            <Text style={styles.dateValue}>{formatDate(activity.plannedDateB)}</Text>
          </View>
        </View>
      </View>
      <View style={styles.cardRight}>
        <StatusChip status={status} />
        <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
      </View>
    </Pressable>
  );
}

function ActivityModal({ activity, status, onClose }: { activity: PlannedActivity; status: ActivityStatus; onClose: () => void }) {
  const { quickCompleteActivity } = useFarm();
  const typeColor = getTypeColor(activity.activityType);
  const daysUntilA = getDaysUntil(activity.plannedDateA);
  const [completing, setCompleting] = React.useState(false);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <View style={[styles.stageBadge, { backgroundColor: typeColor.bg }]}>
            <Text style={[styles.stageBadgeText, { color: typeColor.color }]}>{activity.activityType}</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
            <Ionicons name="close" size={22} color={COLORS.textSecondary} />
          </Pressable>
        </View>

        <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.modalTitle}>{activity.name}</Text>
          <Text style={styles.modalStage}>{activity.stage}</Text>

          <View style={styles.modalDates}>
            <View style={styles.modalDateCard}>
              <Text style={styles.modalDateLabel}>Section A</Text>
              <Text style={styles.modalDateValue}>{formatDate(activity.plannedDateA)}</Text>
              <StatusChip status={status} />
            </View>
            <View style={styles.modalDateCard}>
              <Text style={styles.modalDateLabel}>Section B</Text>
              <Text style={styles.modalDateValue}>{formatDate(activity.plannedDateB)}</Text>
            </View>
          </View>

          {activity.alert && (
            <View style={styles.alertBox}>
              <Ionicons name="warning" size={16} color={COLORS.amber} />
              <Text style={styles.alertBoxText}>{activity.alert}</Text>
            </View>
          )}

          <View style={styles.modalSection}>
            <Text style={styles.modalSectionTitle}>Purpose</Text>
            <Text style={styles.purposeText}>{activity.purpose}</Text>
          </View>

          {activity.plannedProducts.length > 0 && (
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Products ({activity.plannedProducts.length})</Text>
              {activity.plannedProducts.map((product, idx) => (
                <View key={idx} style={styles.productRow}>
                  <View style={styles.productDot} />
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text style={styles.productRate}>{product.rate} · {product.qty}</Text>
                  </View>
                  <Text style={styles.productPrice}>KES {product.unitPrice.toLocaleString()}</Text>
                </View>
              ))}
            </View>
          )}

          {activity.estimatedTotalCost > 0 && (
            <View style={styles.costSummary}>
              <Text style={styles.costSummaryLabel}>Estimated Total</Text>
              <Text style={styles.costSummaryValue}>{formatKES(activity.estimatedTotalCost)}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.modalFooter}>
          {status !== "completed" && (
            <Pressable
              style={[styles.quickBtn, completing && { opacity: 0.6 }]}
              disabled={completing}
              onPress={async () => {
                setCompleting(true);
                await quickCompleteActivity(activity, null);
                setCompleting(false);
                onClose();
              }}
            >
              <Ionicons name="checkmark-done-outline" size={18} color={COLORS.primary} />
              <Text style={styles.quickBtnText}>{completing ? "Saving..." : "Mark Done — No Costs"}</Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.logBtn, status === "completed" && { opacity: 0.6 }]}
            onPress={() => {
              onClose();
              router.push({ pathname: "/log-activity", params: { activityId: activity.id } });
            }}
          >
            <Ionicons name="clipboard-outline" size={18} color={COLORS.white} />
            <Text style={styles.logBtnText}>{status === "completed" ? "Log Again / Amend" : "Log With Costs"}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const { getCompletedActivityIds } = useFarm();
  const [selectedActivity, setSelectedActivity] = useState<PlannedActivity | null>(null);

  const completedIds = getCompletedActivityIds();

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  const data = PLANNED_SCHEDULE.map((activity) => ({
    ...activity,
    status: getStatus(activity, completedIds),
  }));

  const renderItem = useCallback(
    ({ item }: { item: typeof data[0] }) => (
      <ActivityCard
        activity={item}
        status={item.status}
        onPress={() => setSelectedActivity(item)}
      />
    ),
    []
  );

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.headerContainer}>
        <Text style={styles.screenTitle}>Schedule</Text>
        <Text style={styles.screenSubtitle}>Long Rains 2026 — {PLANNED_SCHEDULE.length} activities</Text>
      </View>

      <View style={styles.legend}>
        {[
          { label: "Completed", color: COLORS.primary },
          { label: "Overdue", color: COLORS.red },
          { label: "Due Soon", color: COLORS.amber },
          { label: "Upcoming", color: COLORS.textMuted },
        ].map(({ label, color }) => (
          <View key={label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={styles.legendLabel}>{label}</Text>
          </View>
        ))}
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPadding + 100, gap: 10 }}
        showsVerticalScrollIndicator={false}
      />

      {selectedActivity && (
        <ActivityModal
          activity={selectedActivity}
          status={getStatus(selectedActivity, completedIds)}
          onClose={() => setSelectedActivity(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
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
  legend: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 16,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  legendLabel: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  activityCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardLeft: {
    flex: 1,
    gap: 6,
  },
  cardRight: {
    alignItems: "flex-end",
    gap: 10,
    paddingLeft: 8,
  },
  stageBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stageBadgeText: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 10,
    letterSpacing: 0.3,
  },
  activityName: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  datesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateItem: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
  },
  dateSectionLabel: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 11,
    color: COLORS.textMuted,
  },
  dateValue: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  dateDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.border,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusChipText: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 10,
    letterSpacing: 0.3,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  modalScroll: {
    flex: 1,
    padding: 16,
  },
  modalTitle: {
    fontFamily: "DMSans_700Bold",
    fontSize: 22,
    color: COLORS.text,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  modalStage: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  modalDates: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  modalDateCard: {
    flex: 1,
    backgroundColor: COLORS.borderLight,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  modalDateLabel: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 11,
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  modalDateValue: {
    fontFamily: "DMSans_700Bold",
    fontSize: 14,
    color: COLORS.text,
  },
  alertBox: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: COLORS.amberLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  alertBoxText: {
    flex: 1,
    fontFamily: "DMSans_500Medium",
    fontSize: 13,
    color: COLORS.amberDark,
    lineHeight: 19,
  },
  modalSection: {
    marginBottom: 20,
    gap: 10,
  },
  modalSectionTitle: {
    fontFamily: "DMSans_700Bold",
    fontSize: 13,
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  purposeText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 21,
  },
  productRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  productDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
    marginTop: 5,
  },
  productInfo: {
    flex: 1,
    gap: 2,
  },
  productName: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 13,
    color: COLORS.text,
  },
  productRate: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  productPrice: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 12,
    color: COLORS.text,
  },
  costSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.primarySurface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  costSummaryLabel: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 14,
    color: COLORS.primary,
  },
  costSummaryValue: {
    fontFamily: "DMSans_700Bold",
    fontSize: 16,
    color: COLORS.primary,
  },
  modalFooter: {
    padding: 16,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    gap: 10,
  },
  quickBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: COLORS.primarySurface,
    borderWidth: 1.5, borderColor: COLORS.primaryLight,
    borderRadius: 14, paddingVertical: 14,
  },
  quickBtnText: {
    fontFamily: "DMSans_600SemiBold", fontSize: 15, color: COLORS.primary,
  },
  logBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
  },
  logBtnText: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 16,
    color: COLORS.white,
  },
});
