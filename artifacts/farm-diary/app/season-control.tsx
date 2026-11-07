import React, { useState, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Platform, Modal, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFarm } from "@/context/FarmContext";
import COLORS, { CARD_SHADOW } from "@/constants/colors";
import { getTemplate } from "@/constants/farmData";
import { CropBlock, formatDate, formatKES, getSeasonBlocks, SeasonRecord } from "@/lib/storage";
import * as Haptics from "expo-haptics";
import { PENDING_SALE_STATUSES, seasonFinance } from "@/lib/season-finance";
import { useSeasonSales } from "@/lib/use-season-sales";

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

function EditSeasonModal({ season, onClose, onSave }: {
  season: SeasonRecord;
  onClose: () => void;
  onSave: (updates: Partial<SeasonRecord>) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);

  const [seasonName, setSeasonName] = useState(season.season_name);

  const [blocks, setBlocks] = useState<Array<Omit<CropBlock, "acres"> & { acres: string }>>(
    () => getSeasonBlocks(season).map((block) => ({ ...block, acres: String(block.acres) }))
  );

  const [notes, setNotes] = useState(season.notes || "");

  const handleSave = async () => {
    if (!seasonName.trim()) {
      Alert.alert("Missing", "Season name is required.");
      return;
    }
    if (
      blocks.length === 0 ||
      blocks.some((block) => block.planting_date.length !== 10 || (Number.parseFloat(block.acres) || 0) <= 0)
    ) {
      Alert.alert("Check planting details", "Each block needs a planting date and area greater than zero.");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        season_name: seasonName.trim(),
        blocks: blocks.map((block, index) => ({
          ...block,
          name: `Block ${index + 1}`,
          variety: block.variety.trim() || "Not specified",
          acres: Number.parseFloat(block.acres),
        })),
        notes: notes.trim() || null,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (error) {
      const message = error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message || "")
        : "";
      const needsBlockUpgrade = /blocks/i.test(message) && /(column|schema cache|does not exist)/i.test(message);
      Alert.alert(
        "Could not save changes",
        needsBlockUpgrade
          ? "The farm database needs the planting-block update. Ask your farm manager to apply the crop-blocks SQL update."
          : message || "Check your connection and try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[editStyles.container, { paddingTop: 20 }]}>
        <View style={editStyles.header}>
          <Pressable onPress={onClose} style={editStyles.closeBtn} hitSlop={12}>
            <Ionicons name="close" size={22} color={COLORS.textSecondary} />
          </Pressable>
          <Text style={editStyles.title}>Edit Season</Text>
          <Pressable
            style={[editStyles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={editStyles.saveBtnText}>{saving ? "Saving…" : "Save"}</Text>
          </Pressable>
        </View>

        <ScrollView style={editStyles.scroll} contentContainerStyle={[editStyles.scrollContent, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          <Text style={editStyles.sectionLabel}>General</Text>
          <View style={editStyles.card}>
            <Text style={editStyles.fieldLabel}>Season Name</Text>
            <TextInput style={editStyles.input} value={seasonName} onChangeText={setSeasonName} placeholder="e.g. Long Rains 2027" placeholderTextColor={COLORS.textMuted} />

            <View style={editStyles.divider} />

            <Text style={editStyles.fieldLabel}>Notes</Text>
            <TextInput style={[editStyles.input, editStyles.notesInput]} value={notes} onChangeText={setNotes} placeholder="Any notes about this season" placeholderTextColor={COLORS.textMuted} multiline numberOfLines={3} />
          </View>

          <Text style={editStyles.sectionLabel}>Planting blocks</Text>
          {blocks.map((block, index) => (
            <View key={block.id} style={editStyles.card}>
              <Text style={editStyles.fieldLabel}>{block.name || `Block ${index + 1}`}</Text>
              <TextInput
                testID={`edit-block-${index + 1}-variety`}
                style={editStyles.input}
                value={block.variety}
                onChangeText={(value) => setBlocks((prev) => prev.map((item) => item.id === block.id ? { ...item, variety: value } : item))}
                placeholder="Variety (optional)"
                placeholderTextColor={COLORS.textMuted}
              />

              <View style={editStyles.divider} />

              <Text style={editStyles.fieldLabel}>Planting date</Text>
              <TextInput
                testID={`edit-block-${index + 1}-date`}
                style={editStyles.input}
                value={block.planting_date}
                onChangeText={(value) => setBlocks((prev) => prev.map((item) => item.id === block.id ? { ...item, planting_date: value } : item))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numbers-and-punctuation"
              />

              <View style={editStyles.divider} />

              <Text style={editStyles.fieldLabel}>Area (acres)</Text>
              <TextInput
                testID={`edit-block-${index + 1}-area`}
                style={editStyles.input}
                value={block.acres}
                onChangeText={(value) => setBlocks((prev) => prev.map((item) => item.id === block.id ? { ...item, acres: value } : item))}
                placeholder="e.g. 0.5"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function SeasonControlScreen() {
  const insets = useSafeAreaInsets();
  const { seasons, activeSeason, activeFarm, switchSeason, closeActiveSeason, reopenActiveSeason, updateActiveSeason, costs, harvestRecords, plannedBudget } = useFarm();
  const { sales: seasonSales } = useSeasonSales(activeFarm?.id, activeSeason?.id);
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;
  const activeSeasonCosts = activeSeason ? costs.filter((c) => c.season_id === activeSeason.id).reduce((s, c) => s + c.amount_kes, 0) : 0;
  const activeSeasonRevenue = activeSeason ? harvestRecords.filter((r) => r.season_id === activeSeason.id).reduce((s, r) => s + r.total_revenue_kes, 0) : 0;
  const activeSeasonPrePlantingCosts = activeSeason ? costs.filter((c) => c.season_id === activeSeason.id && c.is_pre_planting) : [];
  const activeSeasonPrePlantingTotal = activeSeasonPrePlantingCosts.reduce((s, c) => s + c.amount_kes, 0);
  const sortedSeasons = [...seasons].sort((a, b) => b.season_number - a.season_number);

  const handleSwitch = (seasonId: string) => {
    Alert.alert("Switch Season", "All data views will switch to this season. Your current season data is preserved.", [
      { text: "Cancel", style: "cancel" },
      { text: "Switch", onPress: async () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); await switchSeason(seasonId); } },
    ]);
  };

  const handleClose = () => {
    if (!activeSeason) return;
    const pending = seasonSales.filter((sale) => PENDING_SALE_STATUSES.includes(sale.status));
    const pendingValue = seasonFinance({ seasonId: activeSeason.id, costs: [], harvest: [], sales: pending, includeHarvestRevenue: false }).pendingSalesValue;
    const pendingWarning = pending.length > 0
      ? `\n\n${pending.length} sale${pending.length === 1 ? " is" : "s are"} still waiting to be checked (${formatKES(pendingValue)}). They are not in this cycle's revenue yet. Check them first if you want them included.`
      : "";
    Alert.alert("Close Season", `Close "${activeSeason.season_name}"?\n\nThis marks the season as completed. Its costs, activities, observations and harvests become read-only until you reopen it. All recorded data is preserved.${pendingWarning}`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Close Season",
        style: "destructive",
        onPress: async () => {
          setClosing(true);
          try {
            await closeActiveSeason();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert("Season Closed", `${activeSeason.season_name} has been closed.`, [{ text: "OK" }]);
          } catch {
            Alert.alert("Could not close the season", "Nothing was changed. Check your connection and try again.");
          } finally {
            setClosing(false);
          }
        },
      },
    ]);
  };

  const handleReopen = () => {
    if (!activeSeason) return;
    Alert.alert("Reopen Season", `Reopen "${activeSeason.season_name}" as the active season?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Reopen", onPress: async () => {
        setReopening(true);
        try { await reopenActiveSeason(); }
        catch { Alert.alert("Could not reopen the season", "Nothing was changed. Check your connection and try again."); }
        finally { setReopening(false); }
      } },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="arrow-back" size={24} color={COLORS.text} /></Pressable>
        <Text style={styles.headerTitle}>Season Control</Text>
        <Pressable style={styles.newSeasonBtn} onPress={() => router.push("/season-setup")}><Ionicons name="add" size={18} color={COLORS.white} /><Text style={styles.newSeasonBtnText}>New</Text></Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + 80 }]} showsVerticalScrollIndicator={false}>
        {activeSeason && (
          <View style={styles.activePanel}>
            <View style={styles.activePanelHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.activePanelLabel}>Active Season · {getTemplate(activeSeason.template_id).cropType}</Text>
                <Text style={styles.activePanelName}>{activeSeason.season_name}</Text>
              </View>
              <View style={styles.activePanelActions}>
                <View style={[styles.statusBadge, { backgroundColor: COLORS.primarySurface }]}>
                  <Text style={[styles.statusBadgeText, { color: COLORS.primary }]}>{statusLabel(activeSeason.status)}</Text>
                </View>
                <Pressable style={styles.editBtn} onPress={() => setShowEdit(true)} hitSlop={8}>
                  <Ionicons name="create-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.editBtnText}>Edit</Text>
                </Pressable>
              </View>
            </View>

            {plannedBudget > 0 && (
              <View style={styles.budgetBar}>
                <View style={styles.budgetBarHeader}>
                  <Text style={styles.budgetBarLabel}>Planned Budget</Text>
                  <Text style={styles.budgetBarValue}>
                    {formatKES(activeSeasonCosts)} / {formatKES(plannedBudget)}
                  </Text>
                </View>
                <View style={styles.budgetTrack}>
                  <View style={[styles.budgetFill, {
                    width: `${Math.min((activeSeasonCosts / plannedBudget) * 100, 100)}%`,
                    backgroundColor: activeSeasonCosts > plannedBudget ? COLORS.red : COLORS.primary,
                  }]} />
                </View>
                <Text style={styles.budgetRemaining}>
                  {activeSeasonCosts > plannedBudget
                    ? `${formatKES(activeSeasonCosts - plannedBudget)} over planned budget`
                    : `${formatKES(plannedBudget - activeSeasonCosts)} of planned budget remaining`}
                </Text>
              </View>
            )}

            <View style={styles.activePanelStats}>
              <View style={styles.panelStat}><Text style={styles.panelStatValue}>{formatKES(activeSeasonCosts)}</Text><Text style={styles.panelStatLabel}>Total Spent</Text></View>
              <View style={styles.panelStatDivider} />
              <View style={styles.panelStat}><Text style={[styles.panelStatValue, { color: activeSeasonRevenue > 0 ? COLORS.primary : COLORS.textMuted }]}>{activeSeasonRevenue > 0 ? formatKES(activeSeasonRevenue) : "—"}</Text><Text style={styles.panelStatLabel}>Revenue</Text></View>
              <View style={styles.panelStatDivider} />
              <View style={styles.panelStat}><Text style={[styles.panelStatValue, { color: activeSeasonRevenue - activeSeasonCosts >= 0 ? COLORS.primary : COLORS.red }]}>{activeSeasonRevenue > 0 ? formatKES(activeSeasonRevenue - activeSeasonCosts) : "—"}</Text><Text style={styles.panelStatLabel}>Net P&L</Text></View>
            </View>

            <View style={styles.costSnapshot}>
              <View style={styles.costSnapshotHeader}>
                <View>
                  <Text style={styles.costSnapshotLabel}>Pre-planting costs</Text>
                  <Text style={styles.costSnapshotValue}>{formatKES(activeSeasonPrePlantingTotal)}</Text>
                </View>
                <View style={styles.costSnapshotBadge}><Text style={styles.costSnapshotBadgeText}>{activeSeasonPrePlantingCosts.length} items</Text></View>
              </View>
              {activeSeasonPrePlantingCosts.length > 0
                ? <View style={styles.costSnapshotList}>{activeSeasonPrePlantingCosts.slice(0, 3).map((cost) => <View key={cost.id} style={styles.costSnapshotRow}><Text style={styles.costSnapshotRowText} numberOfLines={1}>{cost.description}</Text><Text style={styles.costSnapshotRowValue}>{formatKES(cost.amount_kes)}</Text></View>)}{activeSeasonPrePlantingCosts.length > 3 ? <Text style={styles.costSnapshotMore}>+{activeSeasonPrePlantingCosts.length - 3} more</Text> : null}</View>
                : <Text style={styles.costSnapshotEmpty}>No pre-planting costs recorded yet.</Text>}
            </View>

            <Pressable style={styles.reportBtn} onPress={() => router.push("/season-report")}>
              <Ionicons name="receipt-outline" size={14} color={COLORS.primary} />
              <Text style={styles.reportBtnText}>Final report</Text>
            </Pressable>

            {activeSeason.status === "closed"
              ? <Pressable style={[styles.switchBtn, reopening && { opacity: 0.6 }]} onPress={handleReopen} disabled={reopening}><Ionicons name="lock-open-outline" size={16} color={COLORS.primary} /><Text style={styles.switchBtnText}>{reopening ? "Reopening…" : "Reopen Season"}</Text></Pressable>
              : <Pressable style={[styles.closeSeasonBtn, closing && { opacity: 0.6 }]} onPress={handleClose} disabled={closing}><Ionicons name="lock-closed-outline" size={16} color={COLORS.red} /><Text style={styles.closeSeasonBtnText}>{closing ? "Closing..." : "Close This Season"}</Text></Pressable>}
          </View>
        )}

        <View style={styles.allSeasonsSection}>
          {sortedSeasons.map((s) => (
            <View key={s.id} style={styles.seasonCard}>
              <Text style={styles.seasonCardName}>{s.season_name}</Text>
              <Text style={styles.seasonCardType}>{getTemplate(s.template_id).cropType} · {s.season_type} · {statusLabel(s.status)}</Text>
              {s.id !== activeSeason?.id && s.status !== "closed"
                ? <Pressable style={styles.switchBtn} onPress={() => handleSwitch(s.id)}><Text style={styles.switchBtnText}>Switch to this season</Text></Pressable>
                : null}
            </View>
          ))}
        </View>
      </ScrollView>

      {showEdit && activeSeason && (
        <EditSeasonModal
          season={activeSeason}
          onClose={() => setShowEdit(false)}
          onSave={updateActiveSeason}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.cardBg },
  headerTitle: { fontFamily: "Manrope_700Bold", fontSize: 18, color: COLORS.text },
  newSeasonBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  newSeasonBtnText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 14,
    color: COLORS.white,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },
  activePanel: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 16,
    gap: 14,
    ...CARD_SHADOW,
  },
  activePanelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  activePanelLabel: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  activePanelName: { fontFamily: "Manrope_700Bold", fontSize: 20, color: COLORS.text, marginTop: 2 },
  activePanelActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 12,
  },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.primarySurface, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  editBtnText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 13,
    color: COLORS.primary,
  },
  budgetBar: { backgroundColor: COLORS.primarySurface, borderRadius: 12, padding: 12, gap: 6 },
  budgetBarHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  budgetBarLabel: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  budgetBarValue: {
    fontFamily: "Manrope_700Bold",
    fontSize: 13,
    color: COLORS.text,
  },
  budgetTrack: { height: 6, backgroundColor: COLORS.borderLight, borderRadius: 3, overflow: "hidden" },
  budgetFill: { height: "100%", borderRadius: 3 },
  budgetRemaining: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  activePanelStats: { flexDirection: "row", backgroundColor: COLORS.borderLight, borderRadius: 12, padding: 12 },
  panelStat: { flex: 1, alignItems: "center", gap: 2 },
  panelStatValue: {
    fontFamily: "Manrope_700Bold",
    fontSize: 16,
    color: COLORS.text,
  },
  panelStatLabel: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: COLORS.textMuted,
  },
  panelStatDivider: { width: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  costSnapshot: { backgroundColor: COLORS.primarySurface, borderRadius: 14, padding: 14, gap: 10 },
  costSnapshotHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  costSnapshotLabel: {
    fontFamily: "Manrope_700Bold",
    fontSize: 13,
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  costSnapshotValue: {
    fontFamily: "Manrope_700Bold",
    fontSize: 20,
    color: COLORS.primary,
    marginTop: 2,
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  costSnapshotBadge: { backgroundColor: COLORS.white, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  costSnapshotBadgeText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 12,
    color: COLORS.primary,
  },
  costSnapshotList: { gap: 8 },
  costSnapshotRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  costSnapshotRowText: {
    flex: 1,
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  costSnapshotRowValue: {
    fontFamily: "Manrope_700Bold",
    fontSize: 13,
    color: COLORS.text,
  },
  costSnapshotMore: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 12,
    color: COLORS.primary,
  },
  costSnapshotEmpty: {
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  reportBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.primarySurface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, alignSelf: "flex-start" },
  reportBtnText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 12,
    color: COLORS.primary,
  },
  closeSeasonBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.red + "60", backgroundColor: COLORS.redLight },
  closeSeasonBtnText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 15,
    color: COLORS.red,
  },
  switchBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.primaryLight + "60", backgroundColor: COLORS.primarySurface },
  switchBtnText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 14,
    color: COLORS.primary,
  },
  allSeasonsSection: { gap: 10 },
  seasonCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 14,
    gap: 8,
    ...CARD_SHADOW,
  },
  seasonCardName: {
    fontFamily: "Manrope_700Bold",
    fontSize: 17,
    color: COLORS.text,
  },
  seasonCardType: {
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
  }});

const editStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight, backgroundColor: COLORS.cardBg },
  title: { fontFamily: "Manrope_700Bold", fontSize: 17, color: COLORS.text },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.borderLight, alignItems: "center", justifyContent: "center" },
  saveBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  saveBtnText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 15,
    color: COLORS.white,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 6 },
  sectionLabel: {
    fontFamily: "Manrope_700Bold",
    fontSize: 13,
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 14,
    gap: 10,
    ...CARD_SHADOW,
  },
  fieldLabel: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: "Manrope_400Regular",
    fontSize: 15,
    color: COLORS.text,
  },
  notesInput: { height: 80, textAlignVertical: "top" },
  divider: { height: 1, backgroundColor: COLORS.borderLight },
  chipRow: { flexDirection: "row", gap: 8 },
  chip: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.background },
  chipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySurface },
  chipText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  chipTextActive: { color: COLORS.primary },
  fieldHint: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: -4,
  }});
