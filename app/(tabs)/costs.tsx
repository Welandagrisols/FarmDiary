import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ScrollView,
  Alert,
  RefreshControl,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFarm } from "@/context/FarmContext";
import COLORS, { CATEGORY_COLORS } from "@/constants/colors";
import { CostEntry, formatDate, formatKES } from "@/lib/storage";
import * as Haptics from "expo-haptics";

const FILTER_TABS = ["All", "Pre-Planting", "Inputs", "Labor", "Facilitation", "Logistics", "Equipment", "Community & Goodwill", "Overhead"];

function CategoryChip({ category }: { category: string }) {
  const colors = CATEGORY_COLORS[category] || { bg: COLORS.borderLight, text: COLORS.textSecondary };
  return (
    <View style={[styles.categoryChip, { backgroundColor: colors.bg }]}>
      <Text style={[styles.categoryChipText, { color: colors.text }]}>{category}</Text>
    </View>
  );
}

function CostRow({
  cost,
  onDelete,
}: {
  cost: CostEntry;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Delete Entry", `Delete "${cost.description}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onDelete(cost.id) },
    ]);
  }, [cost, onDelete]);

  return (
    <Pressable
      onPress={() => setExpanded(!expanded)}
      onLongPress={handleLongPress}
      style={({ pressed }) => [styles.costRow, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.costRowMain}>
        <View style={styles.costRowLeft}>
          <Text style={styles.costDate}>{formatDate(cost.cost_date)}</Text>
          <Text style={styles.costDesc} numberOfLines={expanded ? undefined : 1}>
            {cost.description}
          </Text>
          <CategoryChip category={cost.cost_category} />
        </View>
        <View style={styles.costRowRight}>
          <Text style={styles.costAmount}>{formatKES(cost.amount_kes)}</Text>
          {cost.is_historical && (
            <View style={styles.historicalBadge}>
              <Text style={styles.historicalText}>Historical</Text>
            </View>
          )}
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={14}
            color={COLORS.textMuted}
          />
        </View>
      </View>

      {expanded && (
        <View style={styles.costDetails}>
          {cost.cost_subcategory && (
            <Text style={styles.costDetailItem}>
              <Text style={styles.costDetailLabel}>Subcategory: </Text>
              {cost.cost_subcategory}
            </Text>
          )}
          {cost.section_id && (
            <Text style={styles.costDetailItem}>
              <Text style={styles.costDetailLabel}>Section: </Text>
              {cost.section_id === "section-a" ? "Section A" : cost.section_id === "section-b" ? "Section B" : "Both"}
            </Text>
          )}
          {cost.product_name && (
            <Text style={styles.costDetailItem}>
              <Text style={styles.costDetailLabel}>Product: </Text>
              {cost.product_name}
            </Text>
          )}
          {cost.quantity && cost.unit && (
            <Text style={styles.costDetailItem}>
              <Text style={styles.costDetailLabel}>Qty: </Text>
              {cost.quantity} {cost.unit}
              {cost.unit_price_kes ? ` @ KES ${cost.unit_price_kes}/unit` : ""}
            </Text>
          )}
          {cost.num_workers && (
            <Text style={styles.costDetailItem}>
              <Text style={styles.costDetailLabel}>Labor: </Text>
              {cost.num_workers} workers × {cost.days_worked ?? 1} days @ KES {cost.rate_per_worker_per_day ?? 500}/day
            </Text>
          )}
          {cost.supplier && (
            <Text style={styles.costDetailItem}>
              <Text style={styles.costDetailLabel}>Supplier: </Text>
              {cost.supplier}
            </Text>
          )}
          {cost.receipt_reference && (
            <Text style={styles.costDetailItem}>
              <Text style={styles.costDetailLabel}>Receipt: </Text>
              {cost.receipt_reference}
            </Text>
          )}
          {cost.notes && (
            <Text style={styles.costDetailItem}>
              <Text style={styles.costDetailLabel}>Notes: </Text>
              {cost.notes}
            </Text>
          )}
          <Pressable
            onPress={handleLongPress}
            style={styles.deleteRowBtn}
          >
            <Ionicons name="trash-outline" size={14} color={COLORS.red} />
            <Text style={styles.deleteRowBtnText}>Delete</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

export default function CostsScreen() {
  const insets = useSafeAreaInsets();
  const { costs, removeCost, isLoading, refresh, totalSpent } = useFarm();
  const [activeFilter, setActiveFilter] = useState("All");
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  const filtered = activeFilter === "All"
    ? costs
    : costs.filter((c) => c.cost_category === activeFilter);

  const sortedCosts = [...filtered].sort(
    (a, b) => new Date(b.cost_date).getTime() - new Date(a.cost_date).getTime()
  );

  const filteredTotal = filtered.reduce((sum, c) => sum + c.amount_kes, 0);
  const prePlantingTotal = filtered
    .filter((c) => c.cost_category === "Pre-Planting")
    .reduce((sum, c) => sum + c.amount_kes, 0);
  const otherTotal = filteredTotal - prePlantingTotal;
  const revenueTotal = totalSpent > 0 ? totalSpent + otherTotal : 0;
  const netTotal = revenueTotal - filteredTotal;
  const marginPct = revenueTotal > 0 ? Math.round((netTotal / revenueTotal) * 100) : 0;

  const handleDelete = useCallback(
    async (id: string) => {
      await removeCost(id);
    },
    [removeCost]
  );

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.headerArea}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.screenTitle}>Costs</Text>
            <Text style={styles.screenSubtitle}>Season Ledger</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Pressable style={styles.breakdownBtn} onPress={() => router.push("/cost-breakdown")}>
              <Ionicons name="pie-chart-outline" size={18} color={COLORS.primary} />
            </Pressable>
            <Pressable style={styles.addBtn} onPress={() => router.push("/add-cost")}>
              <Ionicons name="add" size={20} color={COLORS.white} />
            </Pressable>
          </View>
        </View>

        <View style={styles.totalCard}>
          <View>
            <Text style={styles.totalLabel}>Total Spent</Text>
            <Text style={styles.totalValue}>{formatKES(totalSpent)}</Text>
          </View>
          <View style={styles.totalRight}>
            <Text style={styles.entryCount}>{costs.length} entries</Text>
          </View>
        </View>

        <View style={styles.reportCard}>
          <View style={styles.reportRow}>
            <View style={styles.reportMetric}>
              <Text style={styles.reportLabel}>Revenue</Text>
              <Text style={styles.reportValue}>{formatKES(revenueTotal)}</Text>
            </View>
            <View style={styles.reportMetric}>
              <Text style={styles.reportLabel}>Net</Text>
              <Text style={[styles.reportValue, netTotal >= 0 ? styles.profitValue : styles.lossValue]}>
                {formatKES(netTotal)}
              </Text>
            </View>
          </View>
          <View style={styles.reportRow}>
            <View style={styles.reportMetric}>
              <Text style={styles.reportLabel}>Pre-Planting</Text>
              <Text style={styles.reportValue}>{formatKES(prePlantingTotal)}</Text>
            </View>
            <View style={styles.reportMetric}>
              <Text style={styles.reportLabel}>Other Costs</Text>
              <Text style={styles.reportValue}>{formatKES(otherTotal)}</Text>
            </View>
          </View>
          <Text style={styles.reportFooter}>Margin {marginPct}% · Summary of this view</Text>
        </View>
      </View>

      {/* Category Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterTabs}
        style={styles.filterScrollContainer}
      >
        {FILTER_TABS.map((tab) => {
          const isActive = activeFilter === tab;
          const shortTab = tab === "Community & Goodwill" ? "Community" : tab;
          return (
            <Pressable
              key={tab}
              onPress={() => setActiveFilter(tab)}
              style={[styles.filterTab, isActive && styles.filterTabActive]}
            >
              <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
                {shortTab}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Filter Summary */}
      {activeFilter !== "All" && (
        <View style={styles.filterSummary}>
          <Text style={styles.filterSummaryText}>
            {filtered.length} entries · {formatKES(filteredTotal)}
          </Text>
        </View>
      )}

      <FlatList
        data={sortedCosts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <CostRow cost={item} onDelete={handleDelete} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="wallet-outline" size={40} color={COLORS.border} />
            <Text style={styles.emptyTitle}>No costs recorded</Text>
            <Text style={styles.emptySubtitle}>
              {activeFilter !== "All" ? `No ${activeFilter} entries yet` : "Start tracking your farm expenses"}
            </Text>
            <Pressable style={styles.emptyAddBtn} onPress={() => router.push("/add-cost")}>
              <Text style={styles.emptyAddBtnText}>Add First Entry</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerArea: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
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
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  breakdownBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primarySurface,
    borderWidth: 1,
    borderColor: COLORS.primary + "40",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  totalCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
    marginBottom: 4,
  },
  totalValue: {
    fontFamily: "DMSans_700Bold",
    fontSize: 24,
    color: COLORS.white,
  },
  totalRight: {
    alignItems: "flex-end",
  },
  entryCount: {
    fontFamily: "DMSans_500Medium",
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
  },
  reportCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  reportRow: {
    flexDirection: "row",
    gap: 10,
  },
  reportMetric: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  reportLabel: {
    fontFamily: "DMSans_500Medium",
    fontSize: 11,
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  reportValue: {
    fontFamily: "DMSans_700Bold",
    fontSize: 16,
    color: COLORS.text,
  },
  profitValue: {
    color: COLORS.green,
  },
  lossValue: {
    color: COLORS.red,
  },
  reportFooter: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: COLORS.textMuted,
  },
  filterScrollContainer: {
    maxHeight: 50,
  },
  filterTabs: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 4,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.cardBg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterTabText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  filterTabTextActive: {
    color: COLORS.white,
  },
  filterSummary: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  filterSummaryText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  costRow: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 12,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  costRowMain: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  costRowLeft: {
    flex: 1,
    gap: 4,
  },
  costDate: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: COLORS.textMuted,
  },
  costDesc: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
  },
  costRowRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  costAmount: {
    fontFamily: "DMSans_700Bold",
    fontSize: 14,
    color: COLORS.text,
  },
  historicalBadge: {
    backgroundColor: COLORS.blueLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  historicalText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 9,
    color: COLORS.blue,
    letterSpacing: 0.3,
  },
  categoryChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryChipText: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 10,
    letterSpacing: 0.3,
  },
  costDetails: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    gap: 4,
  },
  costDetailItem: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  costDetailLabel: {
    fontFamily: "DMSans_600SemiBold",
    color: COLORS.text,
  },
  deleteRowBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "flex-start", marginTop: 8,
    backgroundColor: COLORS.redLight,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
  },
  deleteRowBtnText: {
    fontFamily: "DMSans_600SemiBold", fontSize: 12, color: COLORS.red,
  },
  emptyState: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 48,
  },
  emptyTitle: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  emptySubtitle: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: "center",
  },
  emptyAddBtn: {
    marginTop: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  emptyAddBtnText: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 14,
    color: COLORS.white,
  },
});
