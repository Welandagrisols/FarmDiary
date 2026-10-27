import React, { useEffect, useState } from "react";
import { linkedCostsForActivity } from "@/lib/activity-costs";
import { confirmRemoveActivity } from "@/lib/confirm-remove-activity";
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput, Alert, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useFarm } from "@/context/FarmContext";
import COLORS, { CARD_SHADOW } from "@/constants/colors";
import { formatDate, formatKES, ActivityLog, getSeasonBlockName, getSeasonBlocks } from "@/lib/storage";
import ActivityLogDetailModal from "@/components/ActivityLogDetailModal";

function ActivityRow({
  log,
  blockLabel,
  onTap,
}: {
  log: ActivityLog;
  blockLabel: string;
  onTap: (log: ActivityLog) => void;
}) {
  const sectionLabel = log.section_id ? "Blk" : "All";
  const sectionColor = log.section_id ? COLORS.primary : COLORS.amber;

  const hasDeviations = (log.products_used ?? []).some((p) => p.is_deviation);

  return (
    <Pressable
      onPress={() => onTap(log)}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.rowMain}>
        <View style={[styles.sectionDot, { backgroundColor: sectionColor }]}>
          <Text style={styles.sectionDotText}>{sectionLabel}</Text>
        </View>
        <View style={styles.rowInfo}>
          <View style={styles.rowNameRow}>
            <Text style={styles.rowName} numberOfLines={1}>{log.activity_name}</Text>
            {hasDeviations && (
              <View style={styles.deviationDot}>
                <Ionicons name="swap-horizontal" size={10} color={COLORS.amber} />
              </View>
            )}
          </View>
          <Text style={styles.rowDate}>{formatDate(log.actual_date)} · {blockLabel}</Text>
        </View>
        <View style={styles.rowRight}>
          {log.total_cost_kes > 0 && (
            <Text style={styles.rowCost}>{formatKES(log.total_cost_kes)}</Text>
          )}
          <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} />
        </View>
      </View>
    </Pressable>
  );
}

export default function AllLogsScreen() {
  const insets = useSafeAreaInsets();
  const { activityLogs, removeActivityLog, activeSeason, seasons, costs, removeCost, editCostEntry } = useFarm();
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const blockFilters = [
    { id: "all", label: "All" },
    { id: "all-blocks", label: "All blocks" },
    ...getSeasonBlocks(activeSeason).map((block) => ({ id: block.id, label: block.name })),
  ];

  useEffect(() => {
    setSectionFilter("all");
  }, [activeSeason?.id]);

  const filtered = [...activityLogs]
    .filter((l) => {
      const matchSection = sectionFilter === "all" ||
        (sectionFilter === "all-blocks"
          ? l.season_id === activeSeason?.id && l.section_id === null
          : l.season_id === activeSeason?.id && l.section_id === sectionFilter);
      const matchSearch = !search || l.activity_name.toLowerCase().includes(search.toLowerCase());
      return matchSection && matchSearch;
    })
    .sort((a, b) => new Date(b.actual_date).getTime() - new Date(a.actual_date).getTime());

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </Pressable>
        <View style={styles.headerTitle}>
          <Text style={styles.titleText}>Activity Log</Text>
          <Text style={styles.subtitleText}>{activityLogs.length} total entries</Text>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search activities..."
          placeholderTextColor={COLORS.textMuted}
          returnKeyType="search"
        />
        {!!search && (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
          </Pressable>
        )}
      </View>

      <View style={styles.filterRow}>
        {blockFilters.map((filter) => (
          <Pressable
            key={filter.id}
            style={[styles.filterChip, sectionFilter === filter.id && styles.filterChipActive]}
            onPress={() => setSectionFilter(filter.id)}
          >
            <Text style={[styles.filterChipText, sectionFilter === filter.id && styles.filterChipTextActive]}>{filter.label}</Text>
          </Pressable>
        ))}
        <Text style={styles.filterCount}>{filtered.length} shown</Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ActivityRow
            log={item}
            blockLabel={getSeasonBlockName(seasons.find((season) => season.id === item.season_id) ?? activeSeason, item.section_id)}
            onTap={setSelectedLog}
          />
        )}
        contentContainerStyle={[styles.list, { paddingBottom: (Platform.OS === "web" ? 34 : 0) + 40 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="clipboard-outline" size={40} color={COLORS.border} />
            <Text style={styles.emptyText}>{search ? "No matching activities" : "No activities logged yet"}</Text>
          </View>
        }
      />

      {selectedLog && (
        <ActivityLogDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
          onDelete={() => confirmRemoveActivity({
            log: selectedLog,
            linkedCosts: linkedCostsForActivity(selectedLog.id, costs),
            removeActivityLog, removeCost, editCostEntry,
            onRemoved: () => setSelectedLog(null),
          })}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { flex: 1 },
  titleText: { fontFamily: "Manrope_700Bold", fontSize: 20, color: COLORS.text },
  subtitleText: {
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, marginTop: 12, marginBottom: 8,
    backgroundColor: COLORS.cardBg, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Manrope_400Regular",
    fontSize: 15,
    color: COLORS.text,
  },
  filterRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingBottom: 10, flexWrap: "wrap",
  },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: COLORS.borderLight, borderWidth: 1.5, borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.ink,
    borderColor: COLORS.ink,
  },
  filterChipText: {
    fontFamily: "Manrope_500Medium",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  filterChipTextActive: { color: COLORS.white },
  filterCount: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: COLORS.textMuted,
    marginLeft: "auto",
  },
  list: { paddingHorizontal: 16, paddingTop: 4, gap: 8 },
  row: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 12,
    ...CARD_SHADOW,
  },
  rowMain: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionDot: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  sectionDotText: {
    fontFamily: "Manrope_700Bold",
    fontSize: 12,
    color: COLORS.white,
  },
  rowInfo: { flex: 1, gap: 2 },
  rowNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowName: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
  },
  deviationDot: {
    backgroundColor: COLORS.amberLight, borderRadius: 10, padding: 3,
  },
  rowDate: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: COLORS.textMuted,
  },
  rowRight: { alignItems: "flex-end", gap: 4 },
  rowCost: {
    fontFamily: "Manrope_700Bold",
    fontSize: 13,
    color: COLORS.primary,
  },
  empty: { alignItems: "center", gap: 10, paddingVertical: 60 },
  emptyText: {
    fontFamily: "Manrope_500Medium",
    fontSize: 15,
    color: COLORS.textMuted,
  }});
