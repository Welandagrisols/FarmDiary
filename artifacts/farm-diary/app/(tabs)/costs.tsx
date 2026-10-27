import React, { useState, useCallback } from "react";
import { BrandRow } from "@/components/BrandRow";
import { reportWriteError } from "@/lib/write-errors";
import { seasonFinance } from "@/lib/season-finance";
import { useSeasonSales } from "@/lib/use-season-sales";
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
import COLORS, { CATEGORY_COLORS, CARD_SHADOW } from "@/constants/colors";
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
  const { costs, harvestRecords, removeCost, refresh, activeSeason, activeFarm } = useFarm();
  const { sales, canViewFinancials, loading: salesLoading, error: salesError, reload: reloadSales } = useSeasonSales(activeFarm?.id, activeSeason?.id);
  const [activeFilter, setActiveFilter] = useState("All");
  const [refreshing, setRefreshing] = useState(false);

  const seasonCosts = activeSeason ? costs.filter((cost) => cost.season_id === activeSeason.id) : [];
  const seasonHarvest = activeSeason ? harvestRecords.filter((record) => record.season_id === activeSeason.id) : [];
  const finance = seasonFinance({
    seasonId: activeSeason?.id ?? "",
    costs,
    harvest: seasonHarvest,
    sales,
    includeHarvestRevenue: canViewFinancials,
  });
  const totalSpent = finance.costs;
  const totalRevenue = finance.revenue;
  const salesPending = salesLoading;
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    reloadSales();
    setRefreshing(false);
  }, [refresh, reloadSales]);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  const filtered = activeFilter === "All"
    ? seasonCosts
    : seasonCosts.filter((c) => c.cost_category === activeFilter);

  const sortedCosts = [...filtered].sort(
    (a, b) => new Date(b.cost_date).getTime() - new Date(a.cost_date).getTime()
  );

  const filteredTotal = filtered.reduce((sum, c) => sum + c.amount_kes, 0);

  const categorySums: Record<string, number> = {};
  for (const c of seasonCosts) {
    categorySums[c.cost_category] = (categorySums[c.cost_category] || 0) + c.amount_kes;
  }
  const sortedCategories = Object.entries(categorySums).sort((a, b) => b[1] - a[1]);
  const maxCategoryAmt = sortedCategories[0]?.[1] || 1;

  const prePlantingTotal = seasonCosts
    .filter((c) => c.cost_category === "Pre-Planting")
    .reduce((sum, c) => sum + c.amount_kes, 0);
  const otherTotal = totalSpent - prePlantingTotal;
  const netTotal = totalRevenue - totalSpent;
  const marginPct = finance.marginPct === null ? 0 : Math.round(finance.marginPct);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await removeCost(id);
      } catch (e) {
        reportWriteError(e, "Could not remove this cost. Please try again.", "Error");
      }
    },
    [removeCost]
  );

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.headerArea}>
        <BrandRow />
        <View style={styles.headerRow}>
          <View style={{ flex: 1, flexShrink: 1 }}>
            <Text style={styles.screenTitle}>Costs</Text>
            <Text style={styles.screenSubtitle} numberOfLines={1}>{activeSeason?.season_name || "No active season"} · Season Ledger</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexShrink: 0, marginLeft: 12 }}>
            <Pressable style={styles.breakdownBtn} onPress={() => router.push("/cost-breakdown")}>
              <Ionicons name="pie-chart-outline" size={18} color={COLORS.primary} />
            </Pressable>
            <Pressable style={styles.addBtn} onPress={() => router.push("/add-cost")}>
              <Ionicons name="add" size={20} color={COLORS.white} />
            </Pressable>
          </View>
        </View>

        <View style={styles.totalCard}>
          <Ionicons name="wallet" size={120} color="rgba(255,255,255,0.05)" style={styles.heroWatermark} pointerEvents="none" />
          <View>
            <Text style={styles.totalLabel}>Total Spent</Text>
            <Text style={styles.totalValue}>{formatKES(totalSpent)}</Text>
          </View>
          <View style={styles.totalRight}>
            <Text style={styles.entryCount}>{seasonCosts.length} entries</Text>
          </View>
        </View>

        <View style={styles.reportCard}>
          <View style={styles.reportHero}>
            <Text style={styles.reportLabel}>Net</Text>
            <Text style={[styles.reportHeroValue, netTotal >= 0 ? styles.profitValue : styles.lossValue]}>
              {salesPending ? "…" : formatKES(netTotal)}
            </Text>
            <Text style={styles.reportFooter}>
              {salesError ? "Sales could not be loaded, so revenue may be incomplete." : salesPending ? "Loading sales…" : `Margin ${marginPct}%`}
            </Text>
          </View>
          <View style={styles.reportGrid}>
            <View style={styles.reportMetric}>
              <Text style={styles.reportLabel}>Revenue</Text>
              <Text style={styles.reportValue}>{salesPending ? "…" : formatKES(totalRevenue)}</Text>
            </View>
            <View style={styles.reportMetric}>
              <Text style={styles.reportLabel}>Spent</Text>
              <Text style={styles.reportValue}>{formatKES(filteredTotal)}</Text>
            </View>
            <View style={styles.reportMetric}>
              <Text style={styles.reportLabel}>Pre-Planting</Text>
              <Text style={styles.reportValue}>{formatKES(prePlantingTotal)}</Text>
            </View>
            <View style={styles.reportMetric}>
              <Text style={styles.reportLabel}>Other Costs</Text>
              <Text style={styles.reportValue}>{formatKES(otherTotal)}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Category Breakdown */}
      {sortedCategories.length > 0 && (
        <View style={styles.catBreakdown}>
          {sortedCategories.map(([cat, amount]) => {
            const colors = CATEGORY_COLORS[cat] || { bg: COLORS.borderLight, text: COLORS.textSecondary };
            const pct = (amount / maxCategoryAmt) * 100;
            const pctOfTotal = totalSpent > 0 ? ((amount / totalSpent) * 100).toFixed(0) : "0";
            return (
              <Pressable key={cat} onPress={() => setActiveFilter(cat)} style={styles.catItem}>
                <View style={styles.catItemHeader}>
                  <View style={[styles.catDot, { backgroundColor: colors.text }]} />
                  <Text style={styles.catItemName} numberOfLines={1}>{cat}</Text>
                  <Text style={styles.catItemPct}>{pctOfTotal}%</Text>
                  <Text style={styles.catItemAmt}>{formatKES(amount)}</Text>
                </View>
                <View style={styles.catBarBg}>
                  <View style={[styles.catBarFill, { width: `${pct}%`, backgroundColor: colors.text }]} />
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

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
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 8,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
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
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  breakdownBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cardBg,
    alignItems: "center",
    justifyContent: "center",
    ...CARD_SHADOW,
  },
  totalCard: {
    backgroundColor: COLORS.ink,
    borderRadius: 24,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    overflow: "hidden",
    ...CARD_SHADOW,
  },
  totalLabel: {
    fontFamily: "Manrope_500Medium",
    fontSize: 14,
    color: COLORS.inkMuted,
    marginBottom: 4,
  },
  totalValue: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 34,
    color: COLORS.inkText,
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  totalRight: {
    alignItems: "flex-end",
  },
  entryCount: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 13,
    color: COLORS.inkText,
    backgroundColor: COLORS.inkLine,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  reportCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 14,
    gap: 10,
    ...CARD_SHADOW,
  },
  reportHero: {
    backgroundColor: COLORS.primarySurface,
    borderRadius: 16,
    padding: 16,
    gap: 4,
    alignItems: "center",
  },
  reportHeroValue: {
    fontFamily: "Manrope_700Bold",
    fontSize: 28,
    letterSpacing: -0.6,
  },
  reportGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  reportMetric: {
    width: "48%",
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  reportLabel: {
    fontFamily: "Manrope_500Medium",
    fontSize: 12,
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  reportValue: {
    fontFamily: "Manrope_700Bold",
    fontSize: 17,
    color: COLORS.text,
  },
  profitValue: {
    color: COLORS.green,
  },
  lossValue: {
    color: COLORS.red,
  },
  reportFooter: {
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
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
    backgroundColor: COLORS.ink,
    borderColor: COLORS.ink,
  },
  filterTabText: {
    fontFamily: "Manrope_500Medium",
    fontSize: 13,
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
    fontFamily: "Manrope_500Medium",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  costRow: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 12,
    ...CARD_SHADOW,
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
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: COLORS.textMuted,
  },
  costDesc: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 18,
  },
  costRowRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  costAmount: {
    fontFamily: "Manrope_700Bold",
    fontSize: 15,
    color: COLORS.text,
  },
  historicalBadge: {
    backgroundColor: COLORS.blueLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  historicalText: {
    fontFamily: "Manrope_500Medium",
    fontSize: 12,
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
    fontFamily: "Manrope_600SemiBold",
    fontSize: 12,
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
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  costDetailLabel: {
    fontFamily: "Manrope_600SemiBold",
    color: COLORS.text,
  },
  catBreakdown: {
    marginHorizontal: 16,
    marginBottom: 6,
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 14,
    gap: 10,
    ...CARD_SHADOW,
  },
  catItem: { gap: 5 },
  catItemHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catItemName: {
    flex: 1,
    fontFamily: "Manrope_500Medium",
    fontSize: 13,
    color: COLORS.text,
  },
  catItemPct: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 12,
    color: COLORS.textSecondary,
    minWidth: 30,
    textAlign: "right",
  },
  catItemAmt: {
    fontFamily: "Manrope_700Bold",
    fontSize: 13,
    color: COLORS.text,
    minWidth: 70,
    textAlign: "right",
  },
  catBarBg: { height: 5, backgroundColor: COLORS.borderLight, borderRadius: 3, overflow: "hidden" },
  catBarFill: { height: "100%", borderRadius: 3 },
  deleteRowBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "flex-start", marginTop: 8,
    backgroundColor: COLORS.redLight,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
  },
  deleteRowBtnText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 13,
    color: COLORS.red,
  },
  emptyState: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 48,
  },
  emptyTitle: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 17,
    color: COLORS.textSecondary,
  },
  emptySubtitle: {
    fontFamily: "Manrope_400Regular",
    fontSize: 14,
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
    fontFamily: "Manrope_600SemiBold",
    fontSize: 15,
    color: COLORS.white,
  },
  heroWatermark: {
    position: "absolute",
    right: -16,
    bottom: -30,
  },
});
