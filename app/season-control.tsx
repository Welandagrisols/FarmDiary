import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Platform } from "react-native";
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

export default function SeasonControlScreen() {
  const insets = useSafeAreaInsets();
  const { seasons, activeSeason, switchSeason, closeActiveSeason, reopenActiveSeason, costs, harvestRecords } = useFarm();
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;
  const activeSeasonCosts = activeSeason ? costs.filter((c) => c.season_id === activeSeason.id).reduce((s, c) => s + c.amount_kes, 0) : 0;
  const activeSeasonRevenue = activeSeason ? harvestRecords.filter((r) => r.season_id === activeSeason.id).reduce((s, r) => s + r.total_revenue_kes, 0) : 0;
  const activeSeasonPrePlantingCosts = activeSeason ? costs.filter((c) => c.season_id === activeSeason.id && c.is_pre_planting) : [];
  const activeSeasonPrePlantingTotal = activeSeasonPrePlantingCosts.reduce((s, c) => s + c.amount_kes, 0);
  const activeSeasonCostRate = activeSeasonRevenue > 0 ? (activeSeasonCosts / activeSeasonRevenue) * 100 : null;
  const sortedSeasons = [...seasons].sort((a, b) => b.season_number - a.season_number);

  const handleSwitch = (seasonId: string) => {
    Alert.alert("Switch Season", "All data views will switch to this season. Your current season data is preserved.", [
      { text: "Cancel", style: "cancel" },
      { text: "Switch", onPress: async () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); await switchSeason(seasonId); } },
    ]);
  };

  const handleClose = () => {
    if (!activeSeason) return;
    Alert.alert("Close Season", `Close "${activeSeason.season_name}"?\n\nThis marks the season as completed. All recorded data is preserved. You can still view it any time.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Close Season", style: "destructive", onPress: async () => { setClosing(true); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); await closeActiveSeason(); setClosing(false); Alert.alert("Season Closed", `${activeSeason.season_name} has been closed.`, [{ text: "OK" }]); } },
    ]);
  };

  const handleReopen = () => {
    if (!activeSeason) return;
    Alert.alert("Reopen Season", `Reopen "${activeSeason.season_name}" as the active season?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Reopen", onPress: async () => { setReopening(true); await reopenActiveSeason(); setReopening(false); } },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}> 
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="arrow-back" size={24} color={COLORS.text} /></Pressable>
        <Text style={styles.headerTitle}>Season Control</Text>
        <Pressable style={styles.newSeasonBtn} onPress={() => router.push("/season-setup") }><Ionicons name="add" size={18} color={COLORS.white} /><Text style={styles.newSeasonBtnText}>New</Text></Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + 80 }]} showsVerticalScrollIndicator={false}>
        {activeSeason && (
          <View style={styles.activePanel}>
            <View style={styles.activePanelHeader}>
              <View>
                <Text style={styles.activePanelLabel}>Active Season</Text>
                <Text style={styles.activePanelName}>{activeSeason.season_name}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: COLORS.primarySurface }]}><Text style={[styles.statusBadgeText, { color: COLORS.primary }]}>{statusLabel(activeSeason.status)}</Text></View>
            </View>
            <View style={styles.activePanelStats}>
              <View style={styles.panelStat}><Text style={styles.panelStatValue}>{formatKES(activeSeasonCosts)}</Text><Text style={styles.panelStatLabel}>Total Spent</Text></View>
              <View style={styles.panelStatDivider} />
              <View style={styles.panelStat}><Text style={[styles.panelStatValue, { color: activeSeasonRevenue > 0 ? COLORS.primary : COLORS.textMuted }]}>{activeSeasonRevenue > 0 ? formatKES(activeSeasonRevenue) : "—"}</Text><Text style={styles.panelStatLabel}>Revenue</Text></View>
              <View style={styles.panelStatDivider} />
              <View style={styles.panelStat}><Text style={[styles.panelStatValue, { color: activeSeasonRevenue - activeSeasonCosts >= 0 ? COLORS.primary : COLORS.red }]}>{activeSeasonRevenue > 0 ? formatKES(activeSeasonRevenue - activeSeasonCosts) : "—"}</Text><Text style={styles.panelStatLabel}>Net P&L</Text></View>
            </View>
            <View style={styles.costSnapshot}>
              <View style={styles.costSnapshotHeader}><View><Text style={styles.costSnapshotLabel}>Pre-planting costs</Text><Text style={styles.costSnapshotValue}>{formatKES(activeSeasonPrePlantingTotal)}</Text></View><View style={styles.costSnapshotBadge}><Text style={styles.costSnapshotBadgeText}>{activeSeasonPrePlantingCosts.length} items</Text></View></View>
              {activeSeasonPrePlantingCosts.length > 0 ? <View style={styles.costSnapshotList}>{activeSeasonPrePlantingCosts.slice(0, 3).map((cost) => <View key={cost.id} style={styles.costSnapshotRow}><Text style={styles.costSnapshotRowText} numberOfLines={1}>{cost.description}</Text><Text style={styles.costSnapshotRowValue}>{formatKES(cost.amount_kes)}</Text></View>)}{activeSeasonPrePlantingCosts.length > 3 ? <Text style={styles.costSnapshotMore}>+{activeSeasonPrePlantingCosts.length - 3} more</Text> : null}</View> : <Text style={styles.costSnapshotEmpty}>No pre-planting costs recorded yet.</Text>}
            </View>
            <Pressable style={styles.reportBtn} onPress={() => router.push("/season-report") }><Ionicons name="receipt-outline" size={14} color={COLORS.primary} /><Text style={styles.reportBtnText}>Final report</Text></Pressable>
            {activeSeason.status === "closed" ? <Pressable style={[styles.switchBtn, reopening && { opacity: 0.6 }]} onPress={handleReopen} disabled={reopening}><Ionicons name="unlock-outline" size={16} color={COLORS.primary} /><Text style={styles.switchBtnText}>{reopening ? "Reopening…" : "Reopen Season"}</Text></Pressable> : <Pressable style={[styles.closeSeasonBtn, closing && { opacity: 0.6 }]} onPress={handleClose} disabled={closing}><Ionicons name="lock-closed-outline" size={16} color={COLORS.red} /><Text style={styles.closeSeasonBtnText}>{closing ? "Closing..." : "Close This Season"}</Text></Pressable>}
          </View>
        )}
        <View style={styles.allSeasonsSection}>{sortedSeasons.map((s) => <View key={s.id} style={styles.seasonCard}><Text style={styles.seasonCardName}>{s.season_name}</Text><Text style={styles.seasonCardType}>{s.season_type} · {statusLabel(s.status)}</Text>{s.id !== activeSeason?.id && s.status !== "closed" ? <Pressable style={styles.switchBtn} onPress={() => handleSwitch(s.id)}><Text style={styles.switchBtnText}>Switch to this season</Text></Pressable> : null}</View>)}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.cardBg },
  headerTitle: { fontFamily: "DMSans_700Bold", fontSize: 18, color: COLORS.text },
  newSeasonBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  newSeasonBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.white },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },
  activePanel: { backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 16, gap: 14, borderWidth: 2, borderColor: COLORS.primaryLight + "40" },
  activePanelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  activePanelLabel: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  activePanelName: { fontFamily: "DMSans_700Bold", fontSize: 20, color: COLORS.text, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontFamily: "DMSans_600SemiBold", fontSize: 11 },
  activePanelStats: { flexDirection: "row", backgroundColor: COLORS.borderLight, borderRadius: 12, padding: 12 },
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
  reportBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.primarySurface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, alignSelf: "flex-start" },
  reportBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 11, color: COLORS.primary },
  closeSeasonBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.red + "60", backgroundColor: COLORS.redLight },
  closeSeasonBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 14, color: COLORS.red },
  switchBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.primaryLight + "60", backgroundColor: COLORS.primarySurface },
  switchBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.primary },
  allSeasonsSection: { gap: 10 },
  seasonCard: { backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 14, gap: 8, borderWidth: 1, borderColor: COLORS.border },
  seasonCardName: { fontFamily: "DMSans_700Bold", fontSize: 16, color: COLORS.text },
  seasonCardType: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary },
});
