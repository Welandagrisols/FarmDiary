import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFarm } from "@/context/FarmContext";
import COLORS from "@/constants/colors";
import { formatDate, formatKES, ActivityLog } from "@/lib/storage";

const SECTION_FILTERS = ["All", "Sec A", "Sec B"];

function ActivityRow({ log }: { log: ActivityLog }) {
  const [expanded, setExpanded] = useState(false);

  const sectionLabel =
    log.section_id === "section-a" ? "A" :
    log.section_id === "section-b" ? "B" : "A+B";

  const sectionColor =
    log.section_id === "section-a" ? COLORS.primary :
    log.section_id === "section-b" ? COLORS.teal : COLORS.amber;

  return (
    <Pressable
      onPress={() => setExpanded(!expanded)}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.rowMain}>
        <View style={[styles.sectionDot, { backgroundColor: sectionColor }]}>
          <Text style={styles.sectionDotText}>{sectionLabel}</Text>
        </View>
        <View style={styles.rowInfo}>
          <Text style={styles.rowName} numberOfLines={expanded ? undefined : 1}>{log.activity_name}</Text>
          <Text style={styles.rowDate}>{formatDate(log.actual_date)}</Text>
        </View>
        <View style={styles.rowRight}>
          {log.total_cost_kes > 0 && (
            <Text style={styles.rowCost}>{formatKES(log.total_cost_kes)}</Text>
          )}
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={COLORS.textMuted} />
        </View>
      </View>

      {expanded && (
        <View style={styles.detail}>
          {log.notes && (
            <Text style={styles.detailItem}>
              <Text style={styles.detailLabel}>Notes: </Text>{log.notes}
            </Text>
          )}
          {log.weather_conditions && (
            <Text style={styles.detailItem}>
              <Text style={styles.detailLabel}>Weather: </Text>{log.weather_conditions}
            </Text>
          )}
          {log.num_workers > 0 && (
            <Text style={styles.detailItem}>
              <Text style={styles.detailLabel}>Workers: </Text>{log.num_workers}
            </Text>
          )}
          {log.products_used.length > 0 && (
            <View style={styles.productsSection}>
              <Text style={styles.detailLabel}>Products:</Text>
              {log.products_used.map((p, i) => (
                <Text key={i} style={styles.productItem}>  {p.name} — {p.qty} {p.unit}</Text>
              ))}
            </View>
          )}
          <Pressable
            style={styles.editBtn}
            onPress={() => router.push({ pathname: "/edit-activity", params: { logId: log.id } })}
          >
            <Ionicons name="pencil-outline" size={14} color={COLORS.primary} />
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

export default function AllLogsScreen() {
  const insets = useSafeAreaInsets();
  const { activityLogs } = useFarm();
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("All");

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
        renderItem={({ item }) => <ActivityRow log={item} />}
        contentContainerStyle={[styles.list, { paddingBottom: (Platform.OS === "web" ? 34 : 0) + 40 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="clipboard-outline" size={40} color={COLORS.border} />
            <Text style={styles.emptyText}>{search ? "No matching activities" : "No activities logged yet"}</Text>
          </View>
        }
      />
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
  rowName: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.text },
  rowDate: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textMuted },
  rowRight: { alignItems: "flex-end", gap: 4 },
  rowCost: { fontFamily: "DMSans_700Bold", fontSize: 12, color: COLORS.primary },
  detail: {
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: COLORS.borderLight, gap: 4,
  },
  detailItem: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary },
  detailLabel: { fontFamily: "DMSans_600SemiBold", color: COLORS.text },
  productsSection: { gap: 2, marginTop: 2 },
  productItem: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary },
  editBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    alignSelf: "flex-start", marginTop: 6,
    backgroundColor: COLORS.primarySurface, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  editBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 12, color: COLORS.primary },
  empty: { alignItems: "center", gap: 10, paddingVertical: 60 },
  emptyText: { fontFamily: "DMSans_500Medium", fontSize: 14, color: COLORS.textMuted },
});
