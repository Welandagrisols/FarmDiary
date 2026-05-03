import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Alert, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFarm } from "@/context/FarmContext";
import COLORS from "@/constants/colors";
import { formatDate } from "@/lib/storage";
import * as Haptics from "expo-haptics";

export default function FarmSwitcherScreen() {
  const insets = useSafeAreaInsets();
  const { farms, activeFarm, seasons, costs, harvestRecords, switchFarm } = useFarm();
  const [switching, setSwitching] = useState<string | null>(null);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const handleSwitch = (farmId: string, farmName: string) => {
    if (farmId === activeFarm?.id) return;
    Alert.alert(
      "Switch Farm",
      `Switch to "${farmName}"? All data views will update to show that farm's records.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Switch",
          onPress: async () => {
            setSwitching(farmId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await switchFarm(farmId);
            setSwitching(null);
            router.replace("/(tabs)");
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.title}>My Farms</Text>
        <Pressable
          style={styles.addBtn}
          onPress={() => router.push("/farm-setup")}
        >
          <Ionicons name="add" size={18} color={COLORS.white} />
          <Text style={styles.addBtnText}>New</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: bottomPadding + 80, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {farms.map((farm) => {
          const isActive = farm.id === activeFarm?.id;
          const farmSeasons = seasons.filter((s) => s.farm_id === farm.id);
          const farmCosts = costs.filter((c) => c.farm_id === farm.id);
          const farmRevenue = harvestRecords.filter((r) => r.farm_id === farm.id).reduce((sum, r) => sum + r.total_revenue_kes, 0);
          const farmSpent = farmCosts.reduce((sum, c) => sum + c.amount_kes, 0);
          const activeFarmSeason = farmSeasons.find((s) => s.status === "active");

          return (
            <View key={farm.id} style={[styles.farmCard, isActive && styles.farmCardActive]}>
              <View style={styles.farmCardHeader}>
                <View style={styles.farmCardLeft}>
                  <View style={styles.farmIconWrap}>
                    <Ionicons name="leaf" size={20} color={isActive ? COLORS.white : COLORS.primary} />
                  </View>
                  <View style={styles.farmCardInfo}>
                    <Text style={[styles.farmName, isActive && { color: COLORS.primary }]}>{farm.name}</Text>
                    <View style={styles.farmMeta}>
                      <Ionicons name="location-outline" size={12} color={COLORS.textMuted} />
                      <Text style={styles.farmLocation} numberOfLines={1}>{farm.location}</Text>
                    </View>
                  </View>
                </View>
                {isActive && (
                  <View style={styles.activeBadge}>
                    <Ionicons name="radio-button-on" size={11} color={COLORS.primary} />
                    <Text style={styles.activeBadgeText}>Active</Text>
                  </View>
                )}
              </View>

              <View style={styles.farmStats}>
                <View style={styles.farmStat}>
                  <Text style={styles.farmStatValue}>{farm.total_acres || "—"}</Text>
                  <Text style={styles.farmStatLabel}>Acres</Text>
                </View>
                <View style={styles.farmStatDivider} />
                <View style={styles.farmStat}>
                  <Text style={styles.farmStatValue}>{farmSeasons.length}</Text>
                  <Text style={styles.farmStatLabel}>Seasons</Text>
                </View>
                <View style={styles.farmStatDivider} />
                <View style={styles.farmStat}>
                  <Text style={styles.farmStatValue}>{farm.crop_type}</Text>
                  <Text style={styles.farmStatLabel}>Crop</Text>
                </View>
                <View style={styles.farmStatDivider} />
                <View style={styles.farmStat}>
                  <Text style={styles.farmStatValue}>{farm.lease_status}</Text>
                  <Text style={styles.farmStatLabel}>Status</Text>
                </View>
              </View>

              {activeFarmSeason && (
                <View style={styles.seasonChip}>
                  <Ionicons name="leaf-outline" size={13} color={COLORS.primary} />
                  <Text style={styles.seasonChipText} numberOfLines={1}>
                    {activeFarmSeason.season_name} · {activeFarmSeason.season_type}
                  </Text>
                </View>
              )}

              {farm.notes ? (
                <Text style={styles.farmNotes} numberOfLines={2}>{farm.notes}</Text>
              ) : null}

              <Text style={styles.farmCreated}>Added {formatDate(farm.created_at)}</Text>

              <View style={styles.farmActions}>
                {isActive ? (
                  <Pressable style={styles.editBtn} onPress={() => router.push({ pathname: "/farm-setup", params: { mode: "edit" } })}>
                    <Ionicons name="create-outline" size={15} color={COLORS.primary} />
                    <Text style={styles.editBtnText}>Edit farm details</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={[styles.switchBtn, switching === farm.id && { opacity: 0.6 }]}
                    onPress={() => handleSwitch(farm.id, farm.name)}
                    disabled={switching === farm.id}
                  >
                    <Ionicons name="swap-horizontal-outline" size={15} color={COLORS.white} />
                    <Text style={styles.switchBtnText}>
                      {switching === farm.id ? "Switching..." : "Switch to this farm"}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}

        <Pressable style={styles.newFarmCard} onPress={() => router.push("/farm-setup")}>
          <View style={styles.newFarmIcon}>
            <Ionicons name="add-circle-outline" size={28} color={COLORS.primary} />
          </View>
          <View style={styles.newFarmText}>
            <Text style={styles.newFarmTitle}>Add Another Farm</Text>
            <Text style={styles.newFarmSub}>Track multiple farms independently with separate seasons and records</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </Pressable>

        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} />
          <Text style={styles.infoText}>
            Each farm has its own seasons, costs, harvest records, and activity logs. Switching farms instantly updates all screens to show that farm's data.
          </Text>
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
    borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.cardBg,
  },
  title: { fontFamily: "DMSans_700Bold", fontSize: 18, color: COLORS.text },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.white },
  farmCard: {
    backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 14, gap: 12,
    borderWidth: 1.5, borderColor: COLORS.border,
    shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  farmCardActive: { borderColor: COLORS.primary },
  farmCardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  farmCardLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  farmIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primarySurface, alignItems: "center", justifyContent: "center" },
  farmCardInfo: { flex: 1, gap: 4 },
  farmName: { fontFamily: "DMSans_700Bold", fontSize: 16, color: COLORS.text },
  farmMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  farmLocation: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textMuted, flex: 1 },
  activeBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.primarySurface, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  activeBadgeText: { fontFamily: "DMSans_600SemiBold", fontSize: 11, color: COLORS.primary },
  farmStats: { flexDirection: "row", backgroundColor: COLORS.borderLight, borderRadius: 12, padding: 12 },
  farmStat: { flex: 1, alignItems: "center", gap: 2 },
  farmStatValue: { fontFamily: "DMSans_700Bold", fontSize: 13, color: COLORS.text },
  farmStatLabel: { fontFamily: "DMSans_400Regular", fontSize: 10, color: COLORS.textMuted },
  farmStatDivider: { width: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  seasonChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.primarySurface, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  seasonChipText: { fontFamily: "DMSans_600SemiBold", fontSize: 12, color: COLORS.primary, flex: 1 },
  farmNotes: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary, lineHeight: 18 },
  farmCreated: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textMuted },
  farmActions: {},
  editBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.primaryLight + "60", backgroundColor: COLORS.primarySurface },
  editBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.primary },
  switchBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.primary },
  switchBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.white },
  newFarmCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 16, borderWidth: 2, borderColor: COLORS.primaryLight + "40", borderStyle: "dashed" },
  newFarmIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.primarySurface, alignItems: "center", justifyContent: "center" },
  newFarmText: { flex: 1, gap: 3 },
  newFarmTitle: { fontFamily: "DMSans_700Bold", fontSize: 16, color: COLORS.text },
  newFarmSub: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary },
  infoCard: { flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  infoText: { flex: 1, fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary, lineHeight: 18 },
});
