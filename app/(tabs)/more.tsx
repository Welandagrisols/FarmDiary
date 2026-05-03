import React from "react";
import { View, Text, StyleSheet, Pressable, Platform, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "@/constants/colors";
import { useFarm } from "@/context/FarmContext";

function MenuRow({ icon, label, subtitle, color, onPress, badge }: { icon: React.ReactNode; label: string; subtitle: string; color: string; onPress: () => void; badge?: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.85 }]}>
      <View style={[styles.menuIcon, { backgroundColor: color + "20" }]}>{icon}</View>
      <View style={styles.menuContent}>
        <Text style={styles.menuLabel}>{label}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      {badge ? <View style={styles.menuBadge}><Text style={styles.menuBadgeText}>{badge}</Text></View> : null}
      <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
    </Pressable>
  );
}

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const { inventory, observations, activityLogs, harvestRecords, seasons, activeSeason, activeFarm, farms } = useFarm();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;
  const lowStockCount = inventory.filter((item) => {
    const remaining = item.quantity_purchased - (item.quantity_used || 0);
    const threshold = item.low_stock_threshold || item.quantity_purchased * 0.2;
    return remaining < threshold && remaining >= 0;
  }).length;
  const criticalObservations = observations.filter((o) => o.severity === "Critical" || o.severity === "High").length;
  const activeSeasonName = activeSeason?.season_name || "No season";
  const seasonStatusLabel = activeSeason?.status === "active" ? "Active" : activeSeason?.status === "closed" ? "Closed" : "Planning";

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: topPadding + 8, paddingBottom: bottomPadding + 100 }}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>More</Text>
        <Text style={styles.screenSubtitle}>Tools & Records</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Farms</Text>
        <Pressable style={styles.farmSwitchCard} onPress={() => router.push("/farm-switcher")}>
          <View style={styles.farmIconWrap}>
            <Ionicons name="leaf" size={22} color={COLORS.primary} />
          </View>
          <View style={styles.farmCardContent}>
            <Text style={styles.farmName} numberOfLines={1}>{activeFarm?.name || "Rift Valley Potato Farm"}</Text>
            <Text style={styles.farmMeta} numberOfLines={1}>{activeFarm?.location || "—"}{activeFarm?.total_acres ? ` · ${activeFarm.total_acres} acres` : ""}</Text>
          </View>
          <View style={styles.farmRight}>
            <View style={styles.farmCountBadge}>
              <Text style={styles.farmCountText}>{farms.length} farm{farms.length !== 1 ? "s" : ""}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </View>
        </Pressable>
        <Pressable style={styles.backToPicker} onPress={() => router.replace("/farm-picker")}>
          <Ionicons name="swap-horizontal-outline" size={16} color={COLORS.primary} />
          <Text style={styles.backToPickerText}>Go back to farm picker</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Season Control</Text>
        <View style={styles.menuCard}>
          <MenuRow icon={<Ionicons name="leaf-outline" size={22} color={COLORS.primary} />} label="Season Control" subtitle={`${activeSeasonName} · ${seasonStatusLabel} · ${seasons.length} season${seasons.length !== 1 ? "s" : ""}`} color={COLORS.primary} onPress={() => router.push("/season-control")} />
          <View style={styles.separator} />
          <MenuRow icon={<Ionicons name="add-circle-outline" size={22} color={COLORS.teal} />} label="Start New Season" subtitle="Choose variety, planting date — schedule is auto-generated" color={COLORS.teal} onPress={() => router.push("/season-setup")} />
          <View style={styles.separator} />
          <MenuRow icon={<Ionicons name="time-outline" size={22} color={COLORS.primaryLight} />} label="Season History" subtitle="Review closed seasons and compare results" color={COLORS.primaryLight} onPress={() => router.push("/season-history")} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Field Management</Text>
        <View style={styles.menuCard}>
          <MenuRow icon={<Ionicons name="flask-outline" size={22} color={COLORS.teal} />} label="Inventory" subtitle="Track stock levels and usage" color={COLORS.teal} onPress={() => router.push("/inventory")} badge={lowStockCount > 0 ? `${lowStockCount} low` : undefined} />
          <View style={styles.separator} />
          <MenuRow icon={<Ionicons name="eye-outline" size={22} color={COLORS.amber} />} label="Observations" subtitle="Daily scouting notes" color={COLORS.amber} onPress={() => router.push("/observations")} badge={criticalObservations > 0 ? `${criticalObservations} alert` : undefined} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Harvest</Text>
        <View style={styles.menuCard}>
          <MenuRow icon={<Ionicons name="basket-outline" size={22} color={COLORS.primaryLight} />} label="Harvest Records" subtitle="Log bags, weight, price and revenue" color={COLORS.primaryLight} onPress={() => router.push("/harvest")} badge={harvestRecords.length > 0 ? `${harvestRecords.length} loads` : undefined} />
          <View style={styles.separator} />
          <MenuRow icon={<Ionicons name="bar-chart-outline" size={22} color={COLORS.primary} />} label="Full P&L Report" subtitle="Revenue, cost, and profit for the active season" color={COLORS.primary} onPress={() => router.push("/season-report")} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data</Text>
        <View style={styles.menuCard}>
          <MenuRow icon={<Ionicons name="cloud-upload-outline" size={22} color={COLORS.primary} />} label="Import / Export" subtitle="Upload Excel or CSV, export backups" color={COLORS.primary} onPress={() => router.push("/export")} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Season Overview</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}><Ionicons name="clipboard-outline" size={22} color={COLORS.primary} /><Text style={styles.statValue}>{activityLogs.length}</Text><Text style={styles.statLabel}>Activities Logged</Text></View>
          <View style={styles.statCard}><Ionicons name="flask-outline" size={22} color={COLORS.teal} /><Text style={styles.statValue}>{inventory.length}</Text><Text style={styles.statLabel}>Products</Text></View>
          <View style={styles.statCard}><Ionicons name="eye-outline" size={22} color={COLORS.amber} /><Text style={styles.statValue}>{observations.length}</Text><Text style={styles.statLabel}>Observations</Text></View>
          <View style={[styles.statCard, { backgroundColor: lowStockCount > 0 ? COLORS.amberLight : COLORS.primarySurface }]}><Ionicons name="warning-outline" size={22} color={lowStockCount > 0 ? COLORS.amber : COLORS.primary} /><Text style={[styles.statValue, { color: lowStockCount > 0 ? COLORS.amber : COLORS.primary }]}>{lowStockCount}</Text><Text style={styles.statLabel}>Low Stock</Text></View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Farm Details</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}><Ionicons name="location-outline" size={16} color={COLORS.textMuted} /><Text style={styles.infoLabel}>Location</Text><Text style={styles.infoValue} numberOfLines={1}>{activeFarm?.location || "—"}</Text></View>
          <View style={styles.separator} />
          <View style={styles.infoRow}><Ionicons name="resize-outline" size={16} color={COLORS.textMuted} /><Text style={styles.infoLabel}>Total Area</Text><Text style={styles.infoValue}>{activeFarm?.total_acres ? `${activeFarm.total_acres} acres` : "—"}</Text></View>
          <View style={styles.separator} />
          <View style={styles.infoRow}><Ionicons name="key-outline" size={16} color={COLORS.textMuted} /><Text style={styles.infoLabel}>Ownership</Text><Text style={styles.infoValue}>{activeFarm?.lease_status || "—"}</Text></View>
          <View style={styles.separator} />
          <View style={styles.infoRow}><Ionicons name="flower-outline" size={16} color={COLORS.textMuted} /><Text style={styles.infoLabel}>Primary Crop</Text><Text style={styles.infoValue}>{activeFarm?.crop_type || "—"}</Text></View>
          <View style={styles.separator} />
          <View style={styles.infoRow}><Ionicons name="leaf-outline" size={16} color={COLORS.textMuted} /><Text style={styles.infoLabel}>Active Season</Text><Text style={styles.infoValue}>{activeSeasonName}</Text></View>
          <View style={styles.separator} />
          <Pressable style={styles.editFarmRow} onPress={() => router.push({ pathname: "/farm-setup", params: { mode: "edit" } })}>
            <Ionicons name="create-outline" size={16} color={COLORS.primary} />
            <Text style={styles.editFarmText}>Edit farm details</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 16, paddingBottom: 16, gap: 2 },
  screenTitle: { fontFamily: "DMSans_700Bold", fontSize: 28, color: COLORS.text, letterSpacing: -0.5 },
  screenSubtitle: { fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.textSecondary },
  section: { paddingHorizontal: 16, marginBottom: 20, gap: 10 },
  sectionTitle: { fontFamily: "DMSans_700Bold", fontSize: 13, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  farmSwitchCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, backgroundColor: COLORS.cardBg, borderRadius: 16, borderWidth: 1.5, borderColor: COLORS.primary + "40", shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  farmIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.primarySurface, alignItems: "center", justifyContent: "center" },
  farmCardContent: { flex: 1, gap: 3 },
  farmName: { fontFamily: "DMSans_700Bold", fontSize: 15, color: COLORS.text },
  farmMeta: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary },
  farmRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  farmCountBadge: { backgroundColor: COLORS.primarySurface, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  farmCountText: { fontFamily: "DMSans_600SemiBold", fontSize: 11, color: COLORS.primary },
  backToPicker: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cardBg },
  backToPickerText: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.primary },
  menuCard: { backgroundColor: COLORS.cardBg, borderRadius: 16, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, overflow: "hidden" },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 },
  menuIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  menuContent: { flex: 1, gap: 2 },
  menuLabel: { fontFamily: "DMSans_600SemiBold", fontSize: 15, color: COLORS.text },
  menuSubtitle: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary },
  menuBadge: { backgroundColor: COLORS.amberLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  menuBadgeText: { fontFamily: "DMSans_600SemiBold", fontSize: 11, color: COLORS.amber },
  separator: { height: 1, backgroundColor: COLORS.borderLight, marginLeft: 74 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { flex: 1, minWidth: "45%", backgroundColor: COLORS.primarySurface, borderRadius: 14, padding: 14, gap: 6, alignItems: "flex-start" },
  statValue: { fontFamily: "DMSans_700Bold", fontSize: 24, color: COLORS.primary },
  statLabel: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textSecondary },
  infoCard: { backgroundColor: COLORS.cardBg, borderRadius: 16, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, overflow: "hidden" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  infoLabel: { fontFamily: "DMSans_500Medium", fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  infoValue: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.text, maxWidth: "55%" },
  editFarmRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  editFarmText: { flex: 1, fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.primary },
});