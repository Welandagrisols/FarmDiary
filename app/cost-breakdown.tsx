import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFarm } from "@/context/FarmContext";
import COLORS, { CATEGORY_COLORS } from "@/constants/colors";
import { CostEntry, ActivityLog, formatDate, formatKES } from "@/lib/storage";
import * as Haptics from "expo-haptics";

const SECTION_TABS = ["All", "Sec A", "Sec B"];
const VIEW_MODES = ["By Category", "By Activity"];

function pct(part: number, total: number) {
  if (total === 0) return 0;
  return Math.min(100, Math.round((part / total) * 100));
}

function getCatColor(category: string) {
  return CATEGORY_COLORS[category] ?? { bg: COLORS.borderLight, text: COLORS.textSecondary };
}

function getCatBarColor(category: string) {
  const map: Record<string, string> = {
    "Inputs": COLORS.primary,
    "Labor": COLORS.blue,
    "Facilitation": COLORS.purple,
    "Pre-Planting": COLORS.amber,
    "Logistics": COLORS.teal,
    "Equipment": COLORS.orange,
    "Community & Goodwill": "#880E4F",
    "Overhead": COLORS.textSecondary,
  };
  return map[category] ?? COLORS.primary;
}

function ProportionBar({ value, total, color }: { value: number; total: number; color: string }) {
  const width = pct(value, total);
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${width}%` as any, backgroundColor: color }]} />
    </View>
  );
}

function ItemRow({ cost }: { cost: CostEntry }) {
  const sectionLabel =
    cost.section_id === "section-a" ? "A" :
    cost.section_id === "section-b" ? "B" : "";
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemLeft}>
        <Text style={styles.itemDate}>{formatDate(cost.cost_date)}</Text>
        <Text style={styles.itemDesc} numberOfLines={2}>{cost.description}</Text>
        {cost.notes ? <Text style={styles.itemNotes} numberOfLines={1}>{cost.notes}</Text> : null}
      </View>
      <View style={styles.itemRight}>
        <Text style={styles.itemAmount}>{formatKES(cost.amount_kes)}</Text>
        {sectionLabel ? (
          <View style={[styles.sectionBadge, { backgroundColor: sectionLabel === "A" ? COLORS.primarySurface : COLORS.amberLight }]}>
            <Text style={[styles.sectionBadgeText, { color: sectionLabel === "A" ? COLORS.primary : COLORS.amberDark }]}>
              {sectionLabel}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function SubcategoryBlock({
  subcategory, items, categoryTotal,
}: {
  subcategory: string; items: CostEntry[]; categoryTotal: number;
}) {
  const [open, setOpen] = useState(false);
  const total = items.reduce((s, c) => s + c.amount_kes, 0);

  return (
    <View style={styles.subBlock}>
      <Pressable
        style={({ pressed }) => [styles.subHeader, pressed && { opacity: 0.8 }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setOpen(!open); }}
      >
        <View style={styles.subHeaderLeft}>
          <Ionicons name={open ? "chevron-down" : "chevron-forward"} size={14} color={COLORS.textSecondary} />
          <View style={{ flex: 1, gap: 4 }}>
            <View style={styles.subHeaderTitle}>
              <Text style={styles.subName} numberOfLines={1}>{subcategory}</Text>
              <Text style={styles.subCount}>{items.length} {items.length === 1 ? "entry" : "entries"}</Text>
            </View>
            <ProportionBar value={total} total={categoryTotal} color={COLORS.textSecondary} />
          </View>
        </View>
        <View style={styles.subHeaderRight}>
          <Text style={styles.subTotal}>{formatKES(total)}</Text>
          <Text style={styles.subPct}>{pct(total, categoryTotal)}%</Text>
        </View>
      </Pressable>
      {open && (
        <View style={styles.itemsContainer}>
          {items
            .slice()
            .sort((a, b) => new Date(b.cost_date).getTime() - new Date(a.cost_date).getTime())
            .map((item) => <ItemRow key={item.id} cost={item} />)}
        </View>
      )}
    </View>
  );
}

function CategoryCard({ category, items, grandTotal }: { category: string; items: CostEntry[]; grandTotal: number; }) {
  const [open, setOpen] = useState(false);
  const total = items.reduce((s, c) => s + c.amount_kes, 0);
  const catColor = getCatColor(category);
  const barColor = getCatBarColor(category);

  const subcategoryMap = useMemo(() => {
    const map: Record<string, CostEntry[]> = {};
    for (const c of items) {
      const sub = c.cost_subcategory || "Other";
      if (!map[sub]) map[sub] = [];
      map[sub].push(c);
    }
    return Object.entries(map).sort((a, b) =>
      b[1].reduce((s, c) => s + c.amount_kes, 0) - a[1].reduce((s, c) => s + c.amount_kes, 0)
    );
  }, [items]);

  return (
    <View style={[styles.catCard, open && styles.catCardOpen]}>
      <Pressable
        style={({ pressed }) => [styles.catHeader, pressed && { opacity: 0.85 }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setOpen(!open); }}
      >
        <View style={[styles.catIconBox, { backgroundColor: catColor.bg }]}>
          <Text style={[styles.catIconText, { color: catColor.text }]}>{category.charAt(0)}</Text>
        </View>
        <View style={styles.catInfo}>
          <View style={styles.catInfoRow}>
            <Text style={styles.catName}>{category}</Text>
            <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={COLORS.textSecondary} />
          </View>
          <ProportionBar value={total} total={grandTotal} color={barColor} />
          <View style={styles.catInfoRow}>
            <Text style={styles.catEntries}>
              {items.length} {items.length === 1 ? "entry" : "entries"}
              {subcategoryMap.length > 1 ? ` · ${subcategoryMap.length} subcategories` : ""}
            </Text>
            <Text style={styles.catPct}>{pct(total, grandTotal)}% of total</Text>
          </View>
        </View>
        <Text style={styles.catTotal}>{formatKES(total)}</Text>
      </Pressable>
      {open && (
        <View style={styles.catBody}>
          <View style={styles.catBodyDivider} />
          {subcategoryMap.map(([sub, subItems]) => (
            <SubcategoryBlock key={sub} subcategory={sub} items={subItems} categoryTotal={total} />
          ))}
        </View>
      )}
    </View>
  );
}

function ActivityCostCard({
  log,
  relatedCosts,
  grandTotal,
}: {
  log: ActivityLog;
  relatedCosts: CostEntry[];
  grandTotal: number;
}) {
  const [open, setOpen] = useState(false);

  const laborTotal = log.labor_cost_kes ?? 0;
  const inputsTotal = (log.products_used ?? []).reduce((s, p) => s + (p.total ?? 0), 0);
  const relatedTotal = relatedCosts.reduce((s, c) => s + c.amount_kes, 0);
  const activityTotal = log.total_cost_kes ?? 0;

  const sectionLabel =
    log.section_id === "section-a" ? "A" :
    log.section_id === "section-b" ? "B" : "A+B";

  const sectionColor =
    log.section_id === "section-a" ? COLORS.primary :
    log.section_id === "section-b" ? COLORS.teal : COLORS.amber;

  const hasDetail = laborTotal > 0 || (log.products_used ?? []).length > 0 || relatedCosts.length > 0;

  return (
    <View style={[styles.catCard, open && styles.catCardOpen]}>
      <Pressable
        style={({ pressed }) => [styles.catHeader, pressed && { opacity: 0.85 }]}
        onPress={() => {
          if (!hasDetail) return;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setOpen(!open);
        }}
      >
        <View style={[styles.actIconBox, { backgroundColor: sectionColor + "20" }]}>
          <Text style={[styles.actIconText, { color: sectionColor }]}>{sectionLabel}</Text>
        </View>
        <View style={styles.catInfo}>
          <View style={styles.catInfoRow}>
            <Text style={styles.catName} numberOfLines={1}>{log.activity_name}</Text>
            {hasDetail && (
              <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={COLORS.textSecondary} />
            )}
          </View>
          <ProportionBar value={activityTotal} total={grandTotal} color={COLORS.primary} />
          <View style={styles.catInfoRow}>
            <Text style={styles.catEntries}>{formatDate(log.actual_date)}</Text>
            <Text style={styles.catPct}>{pct(activityTotal, grandTotal)}% of total</Text>
          </View>
        </View>
        <Text style={styles.catTotal}>{activityTotal > 0 ? formatKES(activityTotal) : "—"}</Text>
      </Pressable>

      {open && (
        <View style={styles.catBody}>
          <View style={styles.catBodyDivider} />

          {laborTotal > 0 && (
            <View style={styles.actDetailRow}>
              <View style={[styles.actDetailDot, { backgroundColor: COLORS.blue }]} />
              <View style={styles.actDetailInfo}>
                <Text style={styles.actDetailLabel}>Labour</Text>
                {(log.num_workers ?? 0) > 0 && (
                  <Text style={styles.actDetailMeta}>{log.num_workers} workers</Text>
                )}
              </View>
              <Text style={styles.actDetailAmount}>{formatKES(laborTotal)}</Text>
            </View>
          )}

          {(log.products_used ?? []).map((p, i) => (
            <View key={i} style={styles.actDetailRow}>
              <View style={[styles.actDetailDot, { backgroundColor: COLORS.primary }]} />
              <View style={styles.actDetailInfo}>
                <Text style={styles.actDetailLabel}>{p.name}</Text>
                <Text style={styles.actDetailMeta}>{p.qty} {p.unit}</Text>
              </View>
              <Text style={styles.actDetailAmount}>{formatKES(p.total ?? 0)}</Text>
            </View>
          ))}

          {relatedCosts.length > 0 && (
            <View style={styles.relatedSection}>
              <Text style={styles.relatedHeader}>Other costs on this date</Text>
              {relatedCosts.map((c) => (
                <View key={c.id} style={styles.actDetailRow}>
                  <View style={[styles.actDetailDot, { backgroundColor: getCatBarColor(c.cost_category) }]} />
                  <View style={styles.actDetailInfo}>
                    <Text style={styles.actDetailLabel}>{c.description}</Text>
                    <Text style={styles.actDetailMeta}>{c.cost_category}{c.cost_subcategory ? ` · ${c.cost_subcategory}` : ""}</Text>
                  </View>
                  <Text style={styles.actDetailAmount}>{formatKES(c.amount_kes)}</Text>
                </View>
              ))}
            </View>
          )}

          {log.notes ? (
            <Text style={styles.actNotes}>{log.notes}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

export default function CostBreakdownScreen() {
  const insets = useSafeAreaInsets();
  const { costs, activityLogs } = useFarm();
  const [sectionTab, setSectionTab] = useState(0);
  const [viewMode, setViewMode] = useState(0);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const filteredCosts = useMemo(() => {
    if (sectionTab === 0) return costs;
    const id = sectionTab === 1 ? "section-a" : "section-b";
    return costs.filter((c) => c.section_id === id || c.section_id === null);
  }, [costs, sectionTab]);

  const filteredLogs = useMemo(() => {
    if (sectionTab === 0) return activityLogs;
    const id = sectionTab === 1 ? "section-a" : "section-b";
    return activityLogs.filter((l) => l.section_id === id || l.section_id === null);
  }, [activityLogs, sectionTab]);

  const grandTotal = useMemo(() => filteredCosts.reduce((s, c) => s + c.amount_kes, 0), [filteredCosts]);

  const activityGrandTotal = useMemo(
    () => filteredLogs.reduce((s, l) => s + (l.total_cost_kes ?? 0), 0),
    [filteredLogs]
  );

  const categoryMap = useMemo(() => {
    const map: Record<string, CostEntry[]> = {};
    for (const c of filteredCosts) {
      const cat = c.cost_category || "Other";
      if (!map[cat]) map[cat] = [];
      map[cat].push(c);
    }
    return Object.entries(map).sort((a, b) =>
      b[1].reduce((s, c) => s + c.amount_kes, 0) - a[1].reduce((s, c) => s + c.amount_kes, 0)
    );
  }, [filteredCosts]);

  const sortedActivities = useMemo(
    () => [...filteredLogs]
      .filter((l) => (l.total_cost_kes ?? 0) > 0 || (l.products_used ?? []).length > 0)
      .sort((a, b) => new Date(b.actual_date).getTime() - new Date(a.actual_date).getTime()),
    [filteredLogs]
  );

  const costsByDate = useMemo(() => {
    const map: Record<string, CostEntry[]> = {};
    for (const c of filteredCosts) {
      if (!map[c.cost_date]) map[c.cost_date] = [];
      map[c.cost_date].push(c);
    }
    return map;
  }, [filteredCosts]);

  const topCategory = categoryMap[0]?.[0] ?? "—";
  const topCategoryTotal = categoryMap[0]?.[1].reduce((s, c) => s + c.amount_kes, 0) ?? 0;

  const isByActivity = viewMode === 1;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Cost Breakdown</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.viewToggle}>
          {VIEW_MODES.map((m, i) => (
            <Pressable
              key={m}
              style={[styles.viewToggleBtn, viewMode === i && styles.viewToggleBtnActive]}
              onPress={() => { Haptics.selectionAsync(); setViewMode(i); }}
            >
              <Ionicons
                name={i === 0 ? "layers-outline" : "list-outline"}
                size={14}
                color={viewMode === i ? COLORS.white : COLORS.textSecondary}
              />
              <Text style={[styles.viewToggleText, viewMode === i && styles.viewToggleTextActive]}>{m}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionTabs}>
          {SECTION_TABS.map((tab, i) => (
            <Pressable
              key={tab}
              style={[styles.sectionTab, sectionTab === i && styles.sectionTabActive]}
              onPress={() => { Haptics.selectionAsync(); setSectionTab(i); }}
            >
              <Text style={[styles.sectionTabText, sectionTab === i && styles.sectionTabTextActive]}>{tab}</Text>
            </Pressable>
          ))}
        </View>

        {!isByActivity && (
          <>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Total Spend</Text>
                <Text style={styles.summaryValue}>{formatKES(grandTotal)}</Text>
                <Text style={styles.summaryMeta}>{filteredCosts.length} entries</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Largest Category</Text>
                <Text style={[styles.summaryValue, { fontSize: 16 }]} numberOfLines={1}>{topCategory}</Text>
                <Text style={styles.summaryMeta}>{formatKES(topCategoryTotal)} · {pct(topCategoryTotal, grandTotal)}%</Text>
              </View>
            </View>

            <View style={styles.allBarsCard}>
              <Text style={styles.allBarsTitle}>Spending Overview</Text>
              {categoryMap.map(([cat, items]) => {
                const catTotal = items.reduce((s, c) => s + c.amount_kes, 0);
                const barColor = getCatBarColor(cat);
                const catColor = getCatColor(cat);
                return (
                  <View key={cat} style={styles.overviewRow}>
                    <View style={[styles.overviewDot, { backgroundColor: barColor }]} />
                    <Text style={styles.overviewName} numberOfLines={1}>{cat}</Text>
                    <View style={styles.overviewBarWrap}>
                      <View style={[styles.overviewBarFill, { width: `${pct(catTotal, grandTotal)}%` as any, backgroundColor: barColor + "CC" }]} />
                    </View>
                    <Text style={[styles.overviewPct, { color: catColor.text }]}>{pct(catTotal, grandTotal)}%</Text>
                    <Text style={styles.overviewAmt}>{formatKES(catTotal)}</Text>
                  </View>
                );
              })}
            </View>

            <Text style={styles.drilldownLabel}>Tap any category to drill down into subcategories</Text>

            {categoryMap.map(([cat, items]) => (
              <CategoryCard key={cat} category={cat} items={items} grandTotal={grandTotal} />
            ))}

            {categoryMap.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="pie-chart-outline" size={40} color={COLORS.border} />
                <Text style={styles.emptyTitle}>No cost entries</Text>
                <Text style={styles.emptySubtitle}>Add costs to see your spending breakdown</Text>
              </View>
            )}
          </>
        )}

        {isByActivity && (
          <>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Activity Costs</Text>
                <Text style={styles.summaryValue}>{formatKES(activityGrandTotal)}</Text>
                <Text style={styles.summaryMeta}>{sortedActivities.length} activities</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Activities Logged</Text>
                <Text style={styles.summaryValue}>{filteredLogs.length}</Text>
                <Text style={styles.summaryMeta}>this season</Text>
              </View>
            </View>

            <Text style={styles.drilldownLabel}>Tap any activity to see its cost breakdown</Text>

            {sortedActivities.map((log) => {
              const related = (costsByDate[log.actual_date] ?? []).filter(
                (c) => c.section_id === log.section_id || c.section_id === null || log.section_id === null
              );
              return (
                <ActivityCostCard
                  key={log.id}
                  log={log}
                  relatedCosts={related}
                  grandTotal={activityGrandTotal}
                />
              );
            })}

            {sortedActivities.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={40} color={COLORS.border} />
                <Text style={styles.emptyTitle}>No activity costs</Text>
                <Text style={styles.emptySubtitle}>Log activities with costs to see them here</Text>
              </View>
            )}
          </>
        )}
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
  },
  headerTitle: { fontFamily: "DMSans_700Bold", fontSize: 18, color: COLORS.text },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 14 },

  viewToggle: {
    flexDirection: "row", gap: 8,
    backgroundColor: COLORS.borderLight, borderRadius: 12, padding: 4,
  },
  viewToggleBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 9, borderRadius: 9,
  },
  viewToggleBtnActive: { backgroundColor: COLORS.primary },
  viewToggleText: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.textSecondary },
  viewToggleTextActive: { color: COLORS.white },

  sectionTabs: { flexDirection: "row", gap: 8 },
  sectionTab: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.border,
    alignItems: "center",
  },
  sectionTabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  sectionTabText: { fontFamily: "DMSans_600SemiBold", fontSize: 12, color: COLORS.textSecondary },
  sectionTabTextActive: { color: COLORS.white },

  summaryRow: { flexDirection: "row", gap: 12 },
  summaryCard: {
    flex: 1, backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: COLORS.border, gap: 2,
  },
  summaryLabel: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.4 },
  summaryValue: { fontFamily: "DMSans_700Bold", fontSize: 20, color: COLORS.text },
  summaryMeta: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textMuted },

  allBarsCard: {
    backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLORS.border, gap: 10,
  },
  allBarsTitle: { fontFamily: "DMSans_700Bold", fontSize: 14, color: COLORS.text, marginBottom: 2 },
  overviewRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  overviewDot: { width: 8, height: 8, borderRadius: 4 },
  overviewName: { fontFamily: "DMSans_500Medium", fontSize: 12, color: COLORS.text, width: 90 },
  overviewBarWrap: { flex: 1, height: 8, backgroundColor: COLORS.borderLight, borderRadius: 4, overflow: "hidden" },
  overviewBarFill: { height: 8, borderRadius: 4 },
  overviewPct: { fontFamily: "DMSans_600SemiBold", fontSize: 11, width: 32, textAlign: "right" },
  overviewAmt: { fontFamily: "DMSans_500Medium", fontSize: 11, color: COLORS.textSecondary, width: 72, textAlign: "right" },

  drilldownLabel: {
    fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textMuted, textAlign: "center",
  },

  catCard: {
    backgroundColor: COLORS.cardBg, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border, overflow: "hidden",
  },
  catCardOpen: { borderColor: COLORS.primaryMid + "60" },
  catHeader: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  catIconBox: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  catIconText: { fontFamily: "DMSans_700Bold", fontSize: 16 },
  actIconBox: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  actIconText: { fontFamily: "DMSans_700Bold", fontSize: 14 },
  catInfo: { flex: 1, gap: 6 },
  catInfoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  catName: { fontFamily: "DMSans_700Bold", fontSize: 15, color: COLORS.text, flex: 1, marginRight: 4 },
  catEntries: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textMuted },
  catPct: { fontFamily: "DMSans_500Medium", fontSize: 11, color: COLORS.textSecondary },
  catTotal: { fontFamily: "DMSans_700Bold", fontSize: 15, color: COLORS.text },

  catBody: { paddingHorizontal: 14, paddingBottom: 8 },
  catBodyDivider: { height: 1, backgroundColor: COLORS.border, marginBottom: 8 },

  subBlock: { marginBottom: 4 },
  subHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 10, paddingHorizontal: 4, gap: 8,
  },
  subHeaderLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  subHeaderTitle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  subName: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.text, flex: 1 },
  subCount: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textMuted, marginLeft: 6 },
  subHeaderRight: { alignItems: "flex-end", gap: 2, minWidth: 72 },
  subTotal: { fontFamily: "DMSans_700Bold", fontSize: 13, color: COLORS.text },
  subPct: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textMuted },

  itemsContainer: {
    marginLeft: 22, borderLeftWidth: 2, borderLeftColor: COLORS.border,
    paddingLeft: 12, paddingBottom: 4, gap: 1,
  },
  itemRow: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight, gap: 8,
  },
  itemLeft: { flex: 1, gap: 2 },
  itemDate: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textMuted },
  itemDesc: { fontFamily: "DMSans_500Medium", fontSize: 13, color: COLORS.text, lineHeight: 18 },
  itemNotes: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textSecondary, fontStyle: "italic" },
  itemRight: { alignItems: "flex-end", gap: 4 },
  itemAmount: { fontFamily: "DMSans_700Bold", fontSize: 13, color: COLORS.text },
  sectionBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  sectionBadgeText: { fontFamily: "DMSans_700Bold", fontSize: 10 },

  actDetailRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  actDetailDot: { width: 10, height: 10, borderRadius: 5 },
  actDetailInfo: { flex: 1, gap: 1 },
  actDetailLabel: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.text },
  actDetailMeta: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textMuted },
  actDetailAmount: { fontFamily: "DMSans_700Bold", fontSize: 13, color: COLORS.text },
  actNotes: {
    fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary,
    fontStyle: "italic", paddingTop: 8,
  },

  relatedSection: { marginTop: 4 },
  relatedHeader: {
    fontFamily: "DMSans_600SemiBold", fontSize: 11, color: COLORS.textMuted,
    textTransform: "uppercase", letterSpacing: 0.4, paddingVertical: 6,
  },

  barTrack: { height: 5, backgroundColor: COLORS.borderLight, borderRadius: 3, overflow: "hidden" },
  barFill: { height: 5, borderRadius: 3 },

  emptyState: { alignItems: "center", gap: 8, paddingVertical: 40 },
  emptyTitle: { fontFamily: "DMSans_700Bold", fontSize: 17, color: COLORS.textSecondary },
  emptySubtitle: { fontFamily: "DMSans_400Regular", fontSize: 14, color: COLORS.textMuted, textAlign: "center" },
});
