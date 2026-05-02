import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput, Alert, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useFarm } from "@/context/FarmContext";
import COLORS from "@/constants/colors";
import { formatDate, formatKES, ActivityLog } from "@/lib/storage";
import ActivityLogDetailModal from "@/components/ActivityLogDetailModal";

const SECTION_FILTERS = ["All", "Sec A", "Sec B"];

function ActivityRow({
  log,
  onTap,
}: {
  log: ActivityLog;
  onTap: (log: ActivityLog) => void;
}) {
  const sectionLabel =
    log.section_id === "section-a" ? "A" :
    log.section_id === "section-b" ? "B" : "A+B";

  const sectionColor =
    log.section_id === "section-a" ? COLORS.primary :
    log.section_id === "section-b" ? COLORS.teal : COLORS.amber;

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
          <Text style={styles.rowDate}>{formatDate(log.actual_date)}</Text>
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
  const { activityLogs, removeActivityLog } = useFarm();
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("All");
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const filtered = [...activityLogs]
    .filter((l) => {
      const matchSection =
        sectionFilter === "All" ||
        (sectionFilter === "Sec A" && (l.section_id === "section-a" || l.section_id === null)) ||
        (sectionFilter === "Sec B" && (l.section_id === "section-b" || l.section_id === null));
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
        {SECTION_FILTERS.map((f) => (
          <Pressable
            key={f}
            style={[styles.filterChip, sectionFilter === f && styles.filterChipActive]}
            onPress={() => setSectionFilter(f)}
          >
            <Text style={[styles.filterChipText, sectionFilter === f && styles.filterChipTextActive]}>{f}</Text>
          </Pressable>
        ))}
        <Text style={styles.filterCount}>{filtered.length} shown</Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ActivityRow log={item} onTap={setSelectedLog} />}
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
          onDelete={() => {
            Alert.alert(
              "Undo Activity",
              `Remove "${selectedLog.activity_name}" logged on ${formatDate(selectedLog.actual_date)}?\n\nThis will mark the activity as not done.`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Remove",
                  style: "destructive",
                  onPress: () => {
                    removeActivityLog(selectedLog.id);
                    setSelectedLog(null);
                  },
                },
              ]
            );
          }}
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
  titleText: { fontFamily: "DMSans_700Bold", fontSize: 20, color: COLORS.text },
  subtitleText: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, marginTop: 12, marginBottom: 8,
    backgroundColor: COLORS.cardBg, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1, fontFamily: "DMSans_400Regular", fontSize: 14, color: COLORS.text,
  },
  filterRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingBottom: 10, flexWrap: "wrap",
  },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: COLORS.borderLight, borderWidth: 1.5, borderColor: COLORS.border,
  },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontFamily: "DMSans_500Medium", fontSize: 12, color: COLORS.textSecondary },
  filterChipTextActive: { color: COLORS.white },
  filterCount: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textMuted, marginLeft: "auto" },
  list: { paddingHorizontal: 16, paddingTop: 4, gap: 8 },
  row: {
    backgroundColor: COLORS.cardBg, borderRadius: 12, padding: 12,
    shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  rowMain: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionDot: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  sectionDotText: { fontFamily: "DMSans_700Bold", fontSize: 11, color: COLORS.white },
  rowInfo: { flex: 1, gap: 2 },
  rowNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowName: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.text, flex: 1 },
  deviationDot: {
    backgroundColor: COLORS.amberLight, borderRadius: 10, padding: 3,
  },
  rowDate: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textMuted },
  rowRight: { alignItems: "flex-end", gap: 4 },
  rowCost: { fontFamily: "DMSans_700Bold", fontSize: 12, color: COLORS.primary },
  empty: { alignItems: "center", gap: 10, paddingVertical: 60 },
  emptyText: { fontFamily: "DMSans_500Medium", fontSize: 14, color: COLORS.textMuted },
});
