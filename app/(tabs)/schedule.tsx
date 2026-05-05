import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Modal,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFarm } from "@/context/FarmContext";
import COLORS from "@/constants/colors";
import { PlannedActivity } from "@/constants/farmData";
import { getDaysUntil, formatDate, formatKES, ActivityLog } from "@/lib/storage";
import ActivityLogDetailModal from "@/components/ActivityLogDetailModal";

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
    case "Spray": return { bg: COLORS.primarySurface, color: COLORS.primary };
    case "Herbicide": return { bg: COLORS.amberLight, color: COLORS.amber };
    case "Earthing Up + Fertilizer":
    case "Earthing Up": return { bg: COLORS.primarySurface, color: COLORS.teal };
    case "Harvest": return { bg: COLORS.primarySurface, color: COLORS.primaryLight };
    case "Observation": return { bg: COLORS.borderLight, color: COLORS.textSecondary };
    default: return { bg: COLORS.borderLight, color: COLORS.textSecondary };
  }
}

function ActivityCard({
  activity,
  status,
  onPress,
  onQuickDone,
  completing,
}: {
  activity: PlannedActivity;
  status: ActivityStatus;
  onPress: () => void;
  onQuickDone?: () => void;
  completing?: boolean;
}) {
  const typeColor = getTypeColor(activity.activityType);
  const daysUntil = getDaysUntil(activity.plannedDateA);

  return (
    <Pressable style={({ pressed }) => [styles.activityCard, pressed && { opacity: 0.85 }]} onPress={onPress}>
      <View style={styles.timelineCol}>
        <View style={[styles.timelineDot, status === "completed" ? styles.dotCompleted : status === "overdue" ? styles.dotOverdue : status === "due-soon" ? styles.dotSoon : styles.dotUpcoming]} />
        <View style={styles.timelineLine} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <View style={[styles.stageBadge, { backgroundColor: typeColor.bg }]}>
            <Text style={[styles.stageBadgeText, { color: typeColor.color }]}>{activity.activityType}</Text>
          </View>
          <StatusChip status={status} />
        </View>
        <Text style={styles.activityName} numberOfLines={2}>{activity.name}</Text>
        <Text style={styles.activityStage}>{activity.stage}</Text>
        <View style={styles.datesRow}>
          <Text style={styles.dateValue}>Sec A · {formatDate(activity.plannedDateA)}</Text>
          <Text style={styles.dateValue}>Sec B · {formatDate(activity.plannedDateB)}</Text>
        </View>
        <View style={styles.cardFooter}>
          <Text style={[styles.dueText, { color: status === "overdue" ? COLORS.red : status === "due-soon" ? COLORS.amber : COLORS.textSecondary }]}>
            {daysUntil === 0 ? "Due today" : daysUntil < 0 ? `${Math.abs(daysUntil)} days late` : `${daysUntil} days left`}
          </Text>
          {status !== "completed" && onQuickDone ? (
            <Pressable
              style={[styles.quickDoneBtn, completing && { opacity: 0.5 }]}
              onPress={(e) => { e.stopPropagation?.(); onQuickDone(); }}
              disabled={completing}
              hitSlop={6}
            >
              <Ionicons name="checkmark" size={12} color={COLORS.primary} />
              <Text style={styles.quickDoneBtnText}>{completing ? "Saving…" : "Done"}</Text>
            </Pressable>
          ) : (
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          )}
        </View>
      </View>
    </Pressable>
  );
}

function ActivityModal({ activity, status, onClose }: { activity: PlannedActivity; status: ActivityStatus; onClose: () => void }) {
  const { quickCompleteActivity } = useFarm();
  const typeColor = getTypeColor(activity.activityType);
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
              onPress={() => {
                Alert.alert(
                  "Confirm Activity Done",
                  `Mark "${activity.name}" as completed with no costs recorded?`,
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Yes, Mark Done",
                      onPress: async () => {
                        setCompleting(true);
                        await quickCompleteActivity(activity, null);
                        setCompleting(false);
                        onClose();
                      },
                    },
                  ]
                );
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
  const { getCompletedActivityIds, activityLogs, removeActivityLog, currentSchedule, activeSeason, costs, quickCompleteActivity } = useFarm();
  const [selectedActivity, setSelectedActivity] = useState<PlannedActivity | null>(null);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const completedIds = getCompletedActivityIds();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  const data = useMemo(
    () => currentSchedule.map((activity) => ({ ...activity, status: getStatus(activity, completedIds) })),
    [currentSchedule, completedIds]
  );

  const upcoming = data.filter((item) => item.status !== "completed").slice(0, 3);
  const prePlantingCosts = costs.filter((cost) => cost.season_id === activeSeason?.id && cost.is_pre_planting);
  const prePlantingTotal = prePlantingCosts.reduce((sum, cost) => sum + cost.amount_kes, 0);

  const handleQuickDone = useCallback(async (item: typeof data[0]) => {
    setCompletingId(item.id);
    try {
      await quickCompleteActivity(item, "section-a");
    } finally {
      setCompletingId(null);
    }
  }, [quickCompleteActivity]);

  const renderItem = useCallback(
    ({ item }: { item: typeof data[0] }) => (
      <ActivityCard
        activity={item}
        status={item.status}
        completing={completingId === item.id}
        onQuickDone={item.status !== "completed" ? () => handleQuickDone(item) : undefined}
        onPress={() => {
          if (item.status === "completed") {
            const log = [...activityLogs]
              .filter((l) => l.schedule_activity_id === item.id)
              .sort((a, b) => new Date(b.actual_date).getTime() - new Date(a.actual_date).getTime())[0];
            if (log) {
              setSelectedLog(log);
              return;
            }
          }
          setSelectedActivity(item);
        }}
      />
    ),
    [activityLogs, completingId, handleQuickDone]
  );

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.headerContainer}>
        <Text style={styles.screenTitle}>Schedule</Text>
        <Text style={styles.screenSubtitle}>{activeSeason?.season_name || "Season"} — {currentSchedule.length} activities</Text>
      </View>

      <View style={styles.upcomingStrip}>
        <View style={styles.upcomingHeader}>
          <Text style={styles.upcomingTitle}>Upcoming</Text>
          <Text style={styles.upcomingCount}>{upcoming.length}</Text>
        </View>
        {upcoming.map((item) => (
          <Pressable key={item.id} style={styles.upcomingCard} onPress={() => setSelectedActivity(item)}>
            <View style={styles.upcomingTop}>
              <Text style={styles.upcomingName} numberOfLines={1}>{item.name}</Text>
              <StatusChip status={item.status} />
            </View>
            <Text style={styles.upcomingDate}>{formatDate(item.plannedDateA)} · {item.activityType}</Text>
          </Pressable>
        ))}
      </View>

      {activeSeason && (
        <View style={styles.costSummaryCard}>
          <View style={styles.costSummaryHeader}>
            <View>
              <Text style={styles.costSummaryLabel}>Pre-Planting Costs</Text>
              <Text style={styles.costSummaryTitle}>{formatKES(prePlantingTotal)}</Text>
            </View>
            <View style={styles.costSummaryBadge}>
              <Text style={styles.costSummaryBadgeText}>{prePlantingCosts.length} items</Text>
            </View>
          </View>
          {prePlantingCosts.length > 0 ? (
            <View style={styles.costSummaryList}>
              {prePlantingCosts.slice(0, 3).map((cost) => (
                <View key={cost.id} style={styles.costSummaryRow}>
                  <Text style={styles.costSummaryRowText} numberOfLines={1}>{cost.description}</Text>
                  <Text style={styles.costSummaryRowValue}>{formatKES(cost.amount_kes)}</Text>
                </View>
              ))}
              {prePlantingCosts.length > 3 && (
                <Text style={styles.costSummaryMore}>+{prePlantingCosts.length - 3} more items</Text>
              )}
            </View>
          ) : (
            <Text style={styles.costSummaryEmpty}>No pre-planting costs saved yet.</Text>
          )}
        </View>
      )}

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

      {selectedLog && (
        <ActivityLogDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
          onDelete={() => {
            Alert.alert(
              "Remove Activity",
              `Remove "${selectedLog.activity_name}" logged on ${formatDate(selectedLog.actual_date)}?`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Remove",
                  style: "destructive",
                  onPress: () => {
                    removeActivityLog(selectedLog.id);
                    setSelectedLog(null);
                  },
                },
              ]
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerContainer: { paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8, gap: 2 },
  screenTitle: { fontFamily: "DMSans_700Bold", fontSize: 28, color: COLORS.text, letterSpacing: -0.5 },
  screenSubtitle: { fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.textSecondary },
  upcomingStrip: { marginHorizontal: 16, marginBottom: 10, backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 14, gap: 10, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  upcomingHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  upcomingTitle: { fontFamily: "DMSans_700Bold", fontSize: 13, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  upcomingCount: { fontFamily: "DMSans_700Bold", fontSize: 13, color: COLORS.primary },
  upcomingCard: { backgroundColor: COLORS.primarySurface, borderRadius: 12, padding: 12, gap: 4 },
  upcomingTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  upcomingName: { flex: 1, fontFamily: "DMSans_700Bold", fontSize: 14, color: COLORS.text },
  upcomingDate: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary },
  costSummaryCard: { marginHorizontal: 16, marginBottom: 10, backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 14, gap: 10, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  costSummaryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  costSummaryLabel: { fontFamily: "DMSans_700Bold", fontSize: 12, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  costSummaryTitle: { fontFamily: "DMSans_700Bold", fontSize: 22, color: COLORS.text, marginTop: 2 },
  costSummaryBadge: { backgroundColor: COLORS.primarySurface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  costSummaryBadgeText: { fontFamily: "DMSans_600SemiBold", fontSize: 11, color: COLORS.primary },
  costSummaryList: { gap: 8 },
  costSummaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  costSummaryRowText: { flex: 1, fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary },
  costSummaryRowValue: { fontFamily: "DMSans_700Bold", fontSize: 12, color: COLORS.text },
  costSummaryMore: { fontFamily: "DMSans_600SemiBold", fontSize: 11, color: COLORS.primary },
  costSummaryEmpty: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textMuted },
  legend: { flexDirection: "row", paddingHorizontal: 16, paddingBottom: 12, gap: 16, flexWrap: "wrap" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendLabel: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textSecondary },
  activityCard: { flexDirection: "row", gap: 12, marginHorizontal: 16, backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 14, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  timelineCol: { width: 12, alignItems: "center" },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3 },
  dotCompleted: { backgroundColor: COLORS.primary },
  dotOverdue: { backgroundColor: COLORS.red },
  dotSoon: { backgroundColor: COLORS.amber },
  dotUpcoming: { backgroundColor: COLORS.textMuted },
  timelineLine: { flex: 1, width: 2, backgroundColor: COLORS.borderLight, marginTop: 6, borderRadius: 1 },
  cardBody: { flex: 1, gap: 6 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  stageBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  stageBadgeText: { fontFamily: "DMSans_600SemiBold", fontSize: 10, letterSpacing: 0.3 },
  activityName: { fontFamily: "DMSans_600SemiBold", fontSize: 14, color: COLORS.text, lineHeight: 20 },
  quickDoneBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.primarySurface, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  quickDoneBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 11, color: COLORS.primary },
  activityStage: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textSecondary },
  datesRow: { gap: 2 },
  dateValue: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textSecondary },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dueText: { fontFamily: "DMSans_600SemiBold", fontSize: 12 },
  statusChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusChipText: { fontFamily: "DMSans_600SemiBold", fontSize: 10, letterSpacing: 0.3 },
  modalContainer: { flex: 1, backgroundColor: COLORS.cardBg },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.borderLight, alignItems: "center", justifyContent: "center" },
  modalScroll: { flex: 1, padding: 16 },
  modalTitle: { fontFamily: "DMSans_700Bold", fontSize: 22, color: COLORS.text, letterSpacing: -0.3, marginBottom: 4 },
  modalStage: { fontFamily: "DMSans_400Regular", fontSize: 14, color: COLORS.textSecondary, marginBottom: 16 },
  modalDates: { flexDirection: "row", gap: 10, marginBottom: 16 },
  modalDateCard: { flex: 1, backgroundColor: COLORS.borderLight, borderRadius: 12, padding: 12, gap: 6 },
  modalDateLabel: { fontFamily: "DMSans_600SemiBold", fontSize: 11, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  modalDateValue: { fontFamily: "DMSans_700Bold", fontSize: 14, color: COLORS.text },
  alertBox: { flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: COLORS.amberLight, borderRadius: 10, padding: 12, marginBottom: 16 },
  alertBoxText: { flex: 1, fontFamily: "DMSans_500Medium", fontSize: 13, color: COLORS.amberDark, lineHeight: 19 },
  modalSection: { marginBottom: 20, gap: 10 },
  modalSectionTitle: { fontFamily: "DMSans_700Bold", fontSize: 13, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  purposeText: { fontFamily: "DMSans_400Regular", fontSize: 14, color: COLORS.text, lineHeight: 21 },
  productRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  productDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary, marginTop: 5 },
  productInfo: { flex: 1, gap: 2 },
  productName: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.text },
  productRate: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textSecondary },
  productPrice: { fontFamily: "DMSans_600SemiBold", fontSize: 12, color: COLORS.text },
  costSummary: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: COLORS.primarySurface, borderRadius: 10, padding: 14, marginBottom: 20 },
  costSummaryLabel: { fontFamily: "DMSans_600SemiBold", fontSize: 14, color: COLORS.primary },
  costSummaryValue: { fontFamily: "DMSans_700Bold", fontSize: 16, color: COLORS.primary },
  modalFooter: { padding: 16, paddingBottom: 34, borderTopWidth: 1, borderTopColor: COLORS.borderLight, gap: 10 },
  quickBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.primarySurface, borderWidth: 1.5, borderColor: COLORS.primaryLight, borderRadius: 14, paddingVertical: 14 },
  quickBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 15, color: COLORS.primary },
  logBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16 },
  logBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 16, color: COLORS.white },
});