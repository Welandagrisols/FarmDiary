import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ScrollView,
  Alert,
  Platform,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFarm } from "@/context/FarmContext";
import COLORS from "@/constants/colors";
import { PersonalExpense, formatDate, formatKES } from "@/lib/storage";
import * as Haptics from "expo-haptics";

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "Meals & Food":       { bg: "#FFF3E0", text: "#E65100" },
  "Accommodation":      { bg: "#E3F2FD", text: "#1565C0" },
  "Household Setup":    { bg: "#F3E5F5", text: "#6A1B9A" },
  "Personal Care":      { bg: "#FCE4EC", text: "#880E4F" },
  "Health & Medication":{ bg: "#FFEBEE", text: "#C62828" },
  "Protective Gear":    { bg: "#E0F2F1", text: "#00695C" },
  "Farm Transport":     { bg: "#E8F5E9", text: "#1B5E20" },
  "Stakeholder Visits": { bg: "#FBE9E7", text: "#BF360C" },
  "Other":              { bg: "#F5F5F5", text: "#424242" },
};

const CATEGORY_ICONS: Record<string, string> = {
  "Meals & Food":       "restaurant-outline",
  "Accommodation":      "home-outline",
  "Household Setup":    "bed-outline",
  "Personal Care":      "person-outline",
  "Health & Medication":"medical-outline",
  "Protective Gear":    "shield-outline",
  "Farm Transport":     "car-outline",
  "Stakeholder Visits": "people-outline",
  "Other":              "ellipsis-horizontal-outline",
};

const FILTER_TABS = ["All", "Meals & Food", "Accommodation", "Household Setup", "Personal Care", "Health & Medication", "Protective Gear", "Farm Transport", "Stakeholder Visits", "Other"];

function CategoryChip({ category }: { category: string }) {
  const colors = CATEGORY_COLORS[category] || { bg: COLORS.borderLight, text: COLORS.textSecondary };
  return (
    <View style={[styles.chip, { backgroundColor: colors.bg }]}>
      <Text style={[styles.chipText, { color: colors.text }]}>{category}</Text>
    </View>
  );
}

function ExpenseRow({ expense, onDelete }: { expense: PersonalExpense; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Delete Entry", `Delete "${expense.description}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onDelete(expense.id) },
    ]);
  }, [expense, onDelete]);

  return (
    <Pressable
      onPress={() => setExpanded(!expanded)}
      onLongPress={handleLongPress}
      style={({ pressed }) => [styles.expenseRow, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.expenseRowMain}>
        <View style={styles.expenseRowLeft}>
          <Text style={styles.expenseDate}>{formatDate(expense.expense_date)}</Text>
          <Text style={styles.expenseDesc} numberOfLines={expanded ? undefined : 1}>
            {expense.description}
          </Text>
          <CategoryChip category={expense.category} />
        </View>
        <View style={styles.expenseRowRight}>
          <Text style={styles.expenseAmount}>{formatKES(expense.amount_kes)}</Text>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={COLORS.textMuted} />
        </View>
      </View>

      {expanded && (
        <View style={styles.expenseDetails}>
          {expense.subcategory && (
            <Text style={styles.detailItem}>
              <Text style={styles.detailLabel}>Subcategory: </Text>{expense.subcategory}
            </Text>
          )}
          {expense.visitor_name && (
            <Text style={styles.detailItem}>
              <Text style={styles.detailLabel}>Visitor: </Text>{expense.visitor_name}{expense.visitor_role ? ` (${expense.visitor_role})` : ""}
            </Text>
          )}
          {expense.trip_from && (
            <Text style={styles.detailItem}>
              <Text style={styles.detailLabel}>Route: </Text>{expense.trip_from} → {expense.trip_to || "?"}
            </Text>
          )}
          {expense.receipt_reference && (
            <Text style={styles.detailItem}>
              <Text style={styles.detailLabel}>Receipt: </Text>{expense.receipt_reference}
            </Text>
          )}
          {expense.notes && (
            <Text style={styles.detailItem}>
              <Text style={styles.detailLabel}>Notes: </Text>{expense.notes}
            </Text>
          )}
          <Pressable onPress={handleLongPress} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={14} color={COLORS.red} />
            <Text style={styles.deleteBtnText}>Delete</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

export default function PersonalExpensesScreen() {
  const insets = useSafeAreaInsets();
  const { personalExpenses, removePersonalExpense, totalPersonalExpenses, isLoading, refresh } = useFarm();
  const [activeFilter, setActiveFilter] = useState("All");
  const [refreshing, setRefreshing] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const filtered = activeFilter === "All"
    ? personalExpenses
    : personalExpenses.filter((e) => e.category === activeFilter);

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime()
  );

  const filteredTotal = filtered.reduce((sum, e) => sum + e.amount_kes, 0);

  const byCategory = personalExpenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount_kes;
    return acc;
  }, {});
  const topCategories = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const handleDelete = useCallback(async (id: string) => {
    await removePersonalExpense(id);
  }, [removePersonalExpense]);

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.headerArea}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
              <Ionicons name="arrow-back" size={20} color={COLORS.text} />
            </Pressable>
            <View>
              <Text style={styles.screenTitle}>Personal Expenses</Text>
              <Text style={styles.screenSubtitle}>Perdiem & On-Duty Costs</Text>
            </View>
          </View>
          <Pressable style={styles.addBtn} onPress={() => router.push("/add-personal-expense")}>
            <Ionicons name="add" size={20} color={COLORS.white} />
          </Pressable>
        </View>

        <View style={styles.totalCard}>
          <View>
            <Text style={styles.totalLabel}>Total Personal Expenses</Text>
            <Text style={styles.totalValue}>{formatKES(totalPersonalExpenses)}</Text>
          </View>
          <Text style={styles.entryCount}>{personalExpenses.length} entries</Text>
        </View>

        {topCategories.length > 0 && (
          <View style={styles.breakdownCard}>
            <Text style={styles.breakdownTitle}>By Category</Text>
            <View style={styles.breakdownGrid}>
              {topCategories.map(([cat, amt]) => {
                const colors = CATEGORY_COLORS[cat] || { bg: COLORS.borderLight, text: COLORS.textSecondary };
                const icon = CATEGORY_ICONS[cat] || "ellipsis-horizontal-outline";
                return (
                  <View key={cat} style={[styles.breakdownItem, { backgroundColor: colors.bg }]}>
                    <Ionicons name={icon as any} size={18} color={colors.text} />
                    <Text style={[styles.breakdownCat, { color: colors.text }]} numberOfLines={2}>{cat}</Text>
                    <Text style={[styles.breakdownAmt, { color: colors.text }]}>{formatKES(amt)}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterTabs}
        style={styles.filterScrollContainer}
      >
        {FILTER_TABS.map((tab) => {
          const isActive = activeFilter === tab;
          const short = tab === "Health & Medication" ? "Health" : tab === "Stakeholder Visits" ? "Visitors" : tab === "Household Setup" ? "Household" : tab === "Protective Gear" ? "Gear" : tab === "Farm Transport" ? "Transport" : tab === "Meals & Food" ? "Meals" : tab === "Personal Care" ? "Personal" : tab;
          return (
            <Pressable
              key={tab}
              onPress={() => setActiveFilter(tab)}
              style={[styles.filterTab, isActive && styles.filterTabActive]}
            >
              <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>{short}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {activeFilter !== "All" && (
        <View style={styles.filterSummary}>
          <Text style={styles.filterSummaryText}>
            {filtered.length} entries · {formatKES(filteredTotal)}
          </Text>
        </View>
      )}

      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ExpenseRow expense={item} onDelete={handleDelete} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="person-circle-outline" size={48} color={COLORS.border} />
            <Text style={styles.emptyTitle}>No personal expenses yet</Text>
            <Text style={styles.emptySubtitle}>
              {activeFilter !== "All" ? `No ${activeFilter} entries` : "Track your perdiem and on-duty costs"}
            </Text>
            <Pressable style={styles.emptyAddBtn} onPress={() => router.push("/add-personal-expense")}>
              <Text style={styles.emptyAddBtnText}>Record First Expense</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerArea: { paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8, gap: 12 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.borderLight, alignItems: "center", justifyContent: "center" },
  screenTitle: { fontFamily: "DMSans_700Bold", fontSize: 24, color: COLORS.text, letterSpacing: -0.5 },
  screenSubtitle: { fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.textSecondary },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center", marginTop: 4 },
  totalCard: { backgroundColor: COLORS.primary, borderRadius: 14, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontFamily: "DMSans_400Regular", fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 4 },
  totalValue: { fontFamily: "DMSans_700Bold", fontSize: 24, color: COLORS.white },
  entryCount: { fontFamily: "DMSans_500Medium", fontSize: 13, color: "rgba(255,255,255,0.75)" },
  breakdownCard: { backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 14, gap: 10, borderWidth: 1, borderColor: COLORS.border },
  breakdownTitle: { fontFamily: "DMSans_700Bold", fontSize: 13, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  breakdownGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  breakdownItem: { flex: 1, minWidth: "45%", borderRadius: 10, padding: 10, gap: 4 },
  breakdownCat: { fontFamily: "DMSans_600SemiBold", fontSize: 11, lineHeight: 15 },
  breakdownAmt: { fontFamily: "DMSans_700Bold", fontSize: 14 },
  filterScrollContainer: { maxHeight: 50 },
  filterTabs: { paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
  filterTab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.cardBg, borderWidth: 1.5, borderColor: COLORS.border },
  filterTabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterTabText: { fontFamily: "DMSans_500Medium", fontSize: 12, color: COLORS.textSecondary },
  filterTabTextActive: { color: COLORS.white },
  filterSummary: { paddingHorizontal: 16, paddingVertical: 6 },
  filterSummaryText: { fontFamily: "DMSans_500Medium", fontSize: 12, color: COLORS.textSecondary },
  listContent: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  expenseRow: { backgroundColor: COLORS.cardBg, borderRadius: 12, padding: 12, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  expenseRowMain: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  expenseRowLeft: { flex: 1, gap: 4 },
  expenseDate: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textMuted },
  expenseDesc: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.text, lineHeight: 18 },
  expenseRowRight: { alignItems: "flex-end", gap: 4 },
  expenseAmount: { fontFamily: "DMSans_700Bold", fontSize: 14, color: COLORS.text },
  chip: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  chipText: { fontFamily: "DMSans_600SemiBold", fontSize: 10, letterSpacing: 0.3 },
  expenseDetails: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.borderLight, gap: 4 },
  detailItem: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary, lineHeight: 18 },
  detailLabel: { fontFamily: "DMSans_600SemiBold", color: COLORS.text },
  deleteBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: 8, backgroundColor: COLORS.redLight, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  deleteBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 12, color: COLORS.red },
  emptyState: { alignItems: "center", gap: 8, paddingVertical: 48 },
  emptyTitle: { fontFamily: "DMSans_600SemiBold", fontSize: 16, color: COLORS.textSecondary },
  emptySubtitle: { fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.textMuted, textAlign: "center" },
  emptyAddBtn: { marginTop: 8, backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  emptyAddBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 14, color: COLORS.white },
});
