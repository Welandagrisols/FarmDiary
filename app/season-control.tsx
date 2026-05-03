import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFarm } from "@/context/FarmContext";
import COLORS from "@/constants/colors";
import { formatDate, formatKES, SeasonRecord } from "@/lib/storage";
import * as Haptics from "expo-haptics";

function statusColor(status: SeasonRecord["status"]) {
  switch (status) {
    case "active": return { bg: COLORS.primarySurface, text: COLORS.primary };
    case "planning": return { bg: COLORS.amberLight, text: COLORS.amber };
    case "closed": return { bg: COLORS.borderLight, text: COLORS.textSecondary };
  }
}

function statusLabel(status: SeasonRecord["status"]) {
  switch (status) {
    case "active": return "Active";
    case "planning": return "Planning";
    case "closed": return "Closed";
  }
}

function SeasonCard({
  season,
  isActive,
  onSwitch,
}: {
  season: SeasonRecord;
  isActive: boolean;
  onSwitch: () => void;
}) {
  const sc = statusColor(season.status);
  const totalAcres = season.section_a.acres + (season.section_b.acres || 0);

  return (
    <View style={[styles.seasonCard, isActive && styles.seasonCardActive]}>
      <View style={styles.seasonCardHeader}>
        <View style={styles.seasonCardLeft}>
          <Text style={[styles.seasonCardName, isActive && { color: COLORS.primary }]}>
            {season.season_name}
          </Text>
          <View style={styles.seasonCardMeta}>
            <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
              <Text style={[styles.statusBadgeText, { color: sc.text }]}>
                {statusLabel(season.status)}
              </Text>
            </View>
            <Text style={styles.seasonCardType}>{season.season_type}</Text>
          </View>
        </View>
        {isActive && (
          <View style={styles.activePill}>
            <Ionicons name="radio-button-on" size={12} color={COLORS.primary} />
            <Text style={styles.activePillText}>Current</Text>
          </View>
        )}
      </View>

      <View style={styles.sectionRow}>
        <View style={styles.sectionItem}>
          <View style={[styles.sectionDot, { backgroundColor: COLORS.primary }]} />
          <View>
            <Text style={styles.sectionItemLabel}>Section A</Text>
            <Text style={styles.sectionItemValue}>{season.section_a.variety}</Text>
            <Text style={styles.sectionItemSub}>Planted {formatDate(season.section_a.planting_date)}</Text>
          </View>
        </View>
        {season.section_b.acres > 0 && (
          <View style={styles.sectionItem}>
            <View style={[styles.sectionDot, { backgroundColor: COLORS.teal }]} />
            <View>
              <Text style={styles.sectionItemLabel}>Section B</Text>
              <Text style={styles.sectionItemValue}>{season.section_b.variety}</Text>
              <Text style={styles.sectionItemSub}>Planted {formatDate(season.section_b.planting_date)}</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.seasonCardStats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalAcres}</Text>
          <Text style={styles.statLabel}>Acres</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>S{season.season_number}</Text>
          <Text style={styles.statLabel}>Season</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatDate(season.created_at).split(" ")[2]}</Text>
          <Text style={styles.statLabel}>Year</Text>
        </View>
      </View>

      {!isActive && season.status !== "closed" && (
        <Pressable
          style={styles.switchBtn}
          onPress={onSwitch}
        >
          <Ionicons name="swap-horizontal-outline" size={15} color={COLORS.primary} />
          <Text style={styles.switchBtnText}>Switch to this season</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function SeasonControlScreen() {
  const insets = useSafeAreaInsets();
  const { seasons, activeSeason, switchSeason, closeActiveSeason, costs, harvestRecords } = useFarm();
  const [closing, setClosing] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const activeSeasonCosts = activeSeason
    ? costs.filter((c) => c.season_id === activeSeason.id).reduce((s, c) => s + c.amount_kes, 0)
    : 0;
  const activeSeasonRevenue = activeSeason
    ? harvestRecords.filter((r) => r.season_id === activeSeason.id).reduce((s, r) => s + r.total_revenue_kes, 0)
    : 0;
  const activeSeasonPrePlantingCosts = activeSeason
    ? costs.filter((c) => c.season_id === activeSeason.id && c.is_pre_planting)
    : [];
  const activeSeasonPrePlantingTotal = activeSeasonPrePlantingCosts.reduce((s, c) => s + c.amount_kes, 0);
  const activeSeasonCostRate = activeSeasonRevenue > 0 ? (activeSeasonCosts / activeSeasonRevenue) * 100 : null;

  const handleSwitch = (seasonId: string) => {
    Alert.alert(
      "Switch Season",
      "All data views will switch to this season. Your current season data is preserved.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Switch",
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await switchSeason(seasonId);
          },
        },
      ]
    );
  };

  const handleClose = () => {
    if (!activeSeason) return;
    Alert.alert(
      "Close Season",
      `Close "${activeSeason.season_name}"?\n\nThis marks the season as completed. All recorded data is preserved. You can still view it any time.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Close Season",
          style: "destructive",
          onPress: async () => {
            setClosing(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await closeActiveSeason();
            setClosing(false);
            Alert.alert(
              "Season Closed",
              `${activeSeason.season_name} has been closed. Start a new season when you are ready to plant again.`,
              [{ text: "OK" }]
            );
          },
        },
      ]
    );
  };

  const sortedSeasons = [...seasons].sort((a, b) => b.season_number - a.season_number);

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Season Control</Text>
        <Pressable
          style={styles.newSeasonBtn}
          onPress={() => router.push("/season-setup")}
        >
          <Ionicons name="add" size={18} color={COLORS.white} />
          <Text style={styles.newSeasonBtnText}>New</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {activeSeason && activeSeason.status === "active" && (
          <View style={styles.activePanel}>
            <View style={styles.activePanelHeader}>
              <View>
                <Text style={styles.activePanelLabel}>Active Season</Text>
                <Text style={styles.activePanelName}>{activeSeason.season_name}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: COLORS.primarySurface }]}>
                <Text style={[styles.statusBadgeText, { color: COLORS.primary }]}>Active</Text>
              </View>
            </View>

            <View style={styles.activePanelStats}>
              <View style={styles.panelStat}>
                <Text style={styles.panelStatValue}>{formatKES(activeSeasonCosts)}</Text>
                <Text style={styles.panelStatLabel}>Total Spent</Text>
              </View>
              <View style={styles.panelStatDivider} />
              <View style={styles.panelStat}>
                <Text style={[styles.panelStatValue, { color: activeSeasonRevenue > 0 ? COLORS.primary : COLORS.textMuted }]}>
                  {activeSeasonRevenue > 0 ? formatKES(activeSeasonRevenue) : "—"}
                </Text>
                <Text style={styles.panelStatLabel}>Revenue</Text>
              </View>
              <View style={styles.panelStatDivider} />
              <View style={styles.panelStat}>
                <Text style={[
                  styles.panelStatValue,
                  { color: activeSeasonRevenue - activeSeasonCosts >= 0 ? COLORS.primary : COLORS.red }
                ]}>
                  {activeSeasonRevenue > 0
                    ? formatKES(activeSeasonRevenue - activeSeasonCosts)
                    : "—"}
                </Text>
                <Text style={styles.panelStatLabel}>Net P&L</Text>
              </View>
            </View>

            <View style={styles.costSnapshot}>
              <View style={styles.costSnapshotHeader}>
                <View>
                  <Text style={styles.costSnapshotLabel}>Pre-planting costs</Text>
                  <Text style={styles.costSnapshotValue}>{formatKES(activeSeasonPrePlantingTotal)}</Text>
                </View>
                <View style={styles.costSnapshotBadge}>
                  <Text style={styles.costSnapshotBadgeText}>{activeSeasonPrePlantingCosts.length} items</Text>
                </View>
              </View>
              {activeSeasonPrePlantingCosts.length > 0 ? (
                <View style={styles.costSnapshotList}>
                  {activeSeasonPrePlantingCosts.slice(0, 3).map((cost) => (
                    <View key={cost.id} style={styles.costSnapshotRow}>
                      <Text style={styles.costSnapshotRowText} numberOfLines={1}>
                        {cost.description}
                      </Text>
                      <Text style={styles.costSnapshotRowValue}>{formatKES(cost.amount_kes)}</Text>
                    </View>
                  ))}
                  {activeSeasonPrePlantingCosts.length > 3 && (
                    <Text style={styles.costSnapshotMore}>
                      +{activeSeasonPrePlantingCosts.length - 3} more
                    </Text>
                  )}
                </View>
              ) : (
                <Text style={styles.costSnapshotEmpty}>No pre-planting costs recorded yet.</Text>
              )}
            </View>

            <View style={styles.closeoutCard}>
              <View style={styles.closeoutHeader}>
                <View>
                  <Text style={styles.closeoutLabel}>Season closeout</Text>
                  <Text style={styles.closeoutTitle}>
                    {activeSeasonRevenue > 0 ? (activeSeasonRevenue - activeSeasonCosts >= 0 ? "Profit" : "Loss") : "In progress"}
                  </Text>
                </View>
                <View style={styles.closeoutBadge}>
                  <Text style={styles.closeoutBadgeText}>
                    {activeSeasonRevenue > 0 ? `${activeSeasonCostRate?.toFixed(0)}% cost ratio` : "No sales yet"}
                  </Text>
                </View>
              </View>
              <View style={styles.closeoutGrid}>
                <View style={styles.closeoutStat}>
                  <Text style={styles.closeoutStatValue}>{formatKES(activeSeasonCosts)}</Text>
                  <Text style={styles.closeoutStatLabel}>Spent</Text>
                </View>
                <View style={styles.closeoutStat}>
                  <Text style={styles.closeoutStatValue}>{activeSeasonRevenue > 0 ? formatKES(activeSeasonRevenue) : "—"}</Text>
                  <Text style={styles.closeoutStatLabel}>Revenue</Text>
                </View>
                <View style={styles.closeoutStat}>
                  <Text style={[styles.closeoutStatValue, { color: activeSeasonRevenue - activeSeasonCosts >= 0 ? COLORS.primary : COLORS.red }]}>
                    {activeSeasonRevenue > 0 ? formatKES(activeSeasonRevenue - activeSeasonCosts) : "—"}
                  </Text>
                  <Text style={styles.closeoutStatLabel}>Net</Text>
                </View>
              </View>
              <Text style={styles.closeoutNote}>
                This season can be closed once harvesting is complete. Closing preserves the full record for future review.
              </Text>
            </View>

            <View style={styles.sectionSummary}>
              <View style={styles.sectionSummaryItem}>
                <View style={[styles.sectionDot, { backgroundColor: COLORS.primary }]} />
                <Text style={styles.sectionSummaryText}>
                  <Text style={{ fontFamily: "DMSans_700Bold" }}>Sec A</Text>
                  {" "}— {activeSeason.section_a.variety}, planted {formatDate(activeSeason.section_a.planting_date)}, {activeSeason.section_a.acres} ac
                </Text>
              </View>
              {activeSeason.section_b.acres > 0 && (
                <View style={styles.sectionSummaryItem}>
                  <View style={[styles.sectionDot, { backgroundColor: COLORS.teal }]} />
                  <Text style={styles.sectionSummaryText}>
                    <Text style={{ fontFamily: "DMSans_700Bold" }}>Sec B</Text>
                    {" "}— {activeSeason.section_b.variety}, planted {formatDate(activeSeason.section_b.planting_date)}, {activeSeason.section_b.acres} ac
                  </Text>
                </View>
              )}
            </View>

            <Pressable
              style={[styles.closeSeasonBtn, closing && { opacity: 0.6 }]}
              onPress={handleClose}
              disabled={closing}
            >
              <Ionicons name="lock-closed-outline" size={16} color={COLORS.red} />
              <Text style={styles.closeSeasonBtnText}>{closing ? "Closing..." : "Close This Season"}</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.newSeasonSection}>
          <Pressable
            style={styles.startNewSeasonCard}
            onPress={() => router.push("/season-setup")}
          >
            <View style={styles.startNewSeasonIcon}>
              <Ionicons name="add-circle-outline" size={28} color={COLORS.primary} />
            </View>
            <View style={styles.startNewSeasonText}>
              <Text style={styles.startNewSeasonTitle}>Start New Season</Text>
              <Text style={styles.startNewSeasonSub}>
                Choose variety, planting date — the schedule is auto-generated
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </Pressable>
        </View>

        {sortedSeasons.length > 0 && (
          <View style={styles.allSeasonsSection}>
            <Text style={styles.sectionTitle}>All Seasons</Text>
            {sortedSeasons.map((s) => (
              <SeasonCard
                key={s.id}
                season={s}
                isActive={s.id === activeSeason?.id}
                onSwitch={() => handleSwitch(s.id)}
              />
            ))}
          </View>
        )}

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} />
            <Text style={styles.infoText}>
              Each season has its own schedule, costs, and harvest records. Closing a season preserves all data permanently. You can switch between seasons to review history.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.cardBg,
  },
  headerTitle: { fontFamily: "DMSans_700Bold", fontSize: 18, color: COLORS.text },
  newSeasonBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  newSeasonBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.white },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },
  activePanel: {
    backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 16, gap: 14,
    borderWidth: 2, borderColor: COLORS.primaryLight + "40",
    shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  activePanelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  activePanelLabel: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  activePanelName: { fontFamily: "DMSans_700Bold", fontSize: 20, color: COLORS.text, marginTop: 2 },
  activePanelStats: {
    flexDirection: "row", backgroundColor: COLORS.borderLight, borderRadius: 12, padding: 12,
  },
  panelStat: { flex: 1, alignItems: "center", gap: 2 },
  panelStatValue: { fontFamily: "DMSans_700Bold", fontSize: 15, color: COLORS.text },
  panelStatLabel: { fontFamily: "DMSans_400Regular", fontSize: 10, color: COLORS.textMuted },
  panelStatDivider: { width: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  costSnapshot: { backgroundColor: COLORS.primarySurface, borderRadius: 14, padding: 14, gap: 10 },
  costSnapshotHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  costSnapshotLabel: { fontFamily: "DMSans_700Bold", fontSize: 12, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  costSnapshotValue: { fontFamily: "DMSans_700Bold", fontSize: 20, color: COLORS.primary, marginTop: 2 },
  costSnapshotBadge: { backgroundColor: COLORS.white, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  costSnapshotBadgeText: { fontFamily: "DMSans_600SemiBold", fontSize: 11, color: COLORS.primary },
  costSnapshotList: { gap: 8 },
  costSnapshotRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  costSnapshotRowText: { flex: 1, fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary },
  costSnapshotRowValue: { fontFamily: "DMSans_700Bold", fontSize: 12, color: COLORS.text },
  costSnapshotMore: { fontFamily: "DMSans_600SemiBold", fontSize: 11, color: COLORS.primary },
  costSnapshotEmpty: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary },
  closeoutCard: { backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 14, gap: 10, borderWidth: 1, borderColor: COLORS.border },
  closeoutHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  closeoutLabel: { fontFamily: "DMSans_700Bold", fontSize: 12, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  closeoutTitle: { fontFamily: "DMSans_700Bold", fontSize: 18, color: COLORS.text, marginTop: 2 },
  closeoutBadge: { backgroundColor: COLORS.primarySurface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  closeoutBadgeText: { fontFamily: "DMSans_600SemiBold", fontSize: 11, color: COLORS.primary },
  closeoutGrid: { flexDirection: "row", gap: 8 },
  closeoutStat: { flex: 1, backgroundColor: COLORS.background, borderRadius: 12, padding: 10, gap: 3 },
  closeoutStatValue: { fontFamily: "DMSans_700Bold", fontSize: 14, color: COLORS.text },
  closeoutStatLabel: { fontFamily: "DMSans_400Regular", fontSize: 10, color: COLORS.textSecondary },
  closeoutNote: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary, lineHeight: 18 },
  sectionSummary: { gap: 8 },
  sectionSummaryItem: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  sectionSummaryText: { fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.textSecondary, flex: 1, lineHeight: 19 },
  closeSeasonBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.red + "60",
    backgroundColor: COLORS.redLight,
  },
  closeSeasonBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 14, color: COLORS.red },
  newSeasonSection: {},
  startNewSeasonCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 16,
    borderWidth: 2, borderColor: COLORS.primaryLight + "40", borderStyle: "dashed",
    shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  startNewSeasonIcon: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: COLORS.primarySurface, alignItems: "center", justifyContent: "center",
  },
  startNewSeasonText: { flex: 1, gap: 3 },
  startNewSeasonTitle: { fontFamily: "DMSans_700Bold", fontSize: 16, color: COLORS.text },
  startNewSeasonSub: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary },
  allSeasonsSection: { gap: 12 },
  sectionTitle: {
    fontFamily: "DMSans_700Bold", fontSize: 13, color: COLORS.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  seasonCard: {
    backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 14, gap: 12,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  seasonCardActive: { borderColor: COLORS.primary, borderWidth: 2 },
  seasonCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  seasonCardLeft: { gap: 5 },
  seasonCardName: { fontFamily: "DMSans_700Bold", fontSize: 16, color: COLORS.text },
  seasonCardMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  seasonCardType: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontFamily: "DMSans_600SemiBold", fontSize: 11 },
  activePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: COLORS.primarySurface, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  activePillText: { fontFamily: "DMSans_600SemiBold", fontSize: 11, color: COLORS.primary },
  sectionRow: { flexDirection: "row", gap: 16 },
  sectionItem: { flexDirection: "row", alignItems: "flex-start", gap: 8, flex: 1 },
  sectionDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  sectionItemLabel: { fontFamily: "DMSans_600SemiBold", fontSize: 11, color: COLORS.textSecondary },
  sectionItemValue: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.text },
  sectionItemSub: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textMuted },
  seasonCardStats: {
    flexDirection: "row", backgroundColor: COLORS.borderLight, borderRadius: 10, padding: 10,
  },
  statItem: { flex: 1, alignItems: "center", gap: 1 },
  statValue: { fontFamily: "DMSans_700Bold", fontSize: 15, color: COLORS.text },
  statLabel: { fontFamily: "DMSans_400Regular", fontSize: 10, color: COLORS.textMuted },
  statDivider: { width: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  switchBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: COLORS.primaryLight + "60",
    backgroundColor: COLORS.primarySurface,
  },
  switchBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.primary },
  infoCard: {
    backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: COLORS.border,
  },
  infoRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  infoText: { fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.textSecondary, flex: 1, lineHeight: 19 },
});
