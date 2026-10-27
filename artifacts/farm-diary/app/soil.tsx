import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import COLORS, { CARD_SHADOW } from "@/constants/colors";
import { useFarm } from "@/context/FarmContext";
import { listPlots, listSoilTests } from "@/lib/soil-storage";
import { formatResultValue, headlineResults, sortNewestFirst, testDate, type PlotRecord, type SoilStatus, type SoilTestRecord } from "@/lib/soil";
import { formatDate } from "@/lib/storage";

const STATUS: Record<SoilStatus, { label: string; bg: string; fg: string }> = {
  needs_review: { label: "Check values", bg: COLORS.amberLight, fg: COLORS.amberDark },
  parsed: { label: "Read – to confirm", bg: COLORS.blueLight, fg: COLORS.blue },
  confirmed: { label: "Confirmed", bg: COLORS.greenLight, fg: COLORS.green },
  manual: { label: "Entered by hand", bg: COLORS.borderLight, fg: COLORS.textSecondary },
};

export default function SoilListScreen() {
  const insets = useSafeAreaInsets();
  const { activeFarm } = useFarm();
  const [plots, setPlots] = useState<PlotRecord[]>([]);
  const [tests, setTests] = useState<SoilTestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "farm" | string>("all");

  const load = useCallback(async () => {
    if (!activeFarm?.id) { setLoading(false); return; }
    try {
      setError(null);
      const [p, t] = await Promise.all([listPlots(activeFarm.id), listSoilTests(activeFarm.id)]);
      setPlots(p);
      setTests(t);
    } catch (e: any) {
      setError(e?.message || "Could not load soil tests.");
    } finally {
      setLoading(false);
    }
  }, [activeFarm?.id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const plotName = useCallback((id: string | null) => (id ? plots.find((p) => p.id === id)?.name ?? "Removed plot" : "Whole farm"), [plots]);

  const visible = useMemo(() => {
    const filtered = tests.filter((t) => filter === "all" ? true : filter === "farm" ? t.plot_id === null : t.plot_id === filter);
    return sortNewestFirst(filtered);
  }, [tests, filter]);

  const reviewCount = tests.filter((t) => t.status === "needs_review").length;
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const Chip = ({ id, label }: { id: string; label: string }) => (
    <Pressable onPress={() => setFilter(id)} style={[styles.chip, filter === id && styles.chipActive]}>
      <Text style={[styles.chipText, filter === id && styles.chipTextActive]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="arrow-back" size={24} color={COLORS.text} /></Pressable>
        <Text style={styles.title}>Soil Tests</Text>
        <Pressable onPress={() => router.push("/plots")} hitSlop={12}><Ionicons name="grid-outline" size={22} color={COLORS.primary} /></Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100, gap: 12 }} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.scanBtn} onPress={() => router.push("/add-soil-test")}>
          <Ionicons name="scan-outline" size={22} color={COLORS.white} />
          <View style={{ flex: 1 }}>
            <Text style={styles.scanTitle}>Scan or upload a lab report</Text>
            <Text style={styles.scanSub}>Photo or PDF – read and saved straight away</Text>
          </View>
        </Pressable>

        {reviewCount > 0 ? (
          <View style={styles.notice}>
            <Ionicons name="alert-circle-outline" size={18} color={COLORS.amberDark} />
            <Text style={styles.noticeText}>{reviewCount} test{reviewCount === 1 ? "" : "s"} need a quick check against the original report.</Text>
          </View>
        ) : null}

        {tests.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ flexGrow: 0 }}>
            <Chip id="all" label="All" />
            <Chip id="farm" label="Whole farm" />
            {plots.filter((p) => !p.is_archived || tests.some((t) => t.plot_id === p.id)).map((p) => <Chip key={p.id} id={p.id} label={p.name} />)}
          </ScrollView>
        ) : null}

        {loading ? <ActivityIndicator color={COLORS.primary} style={{ marginTop: 24 }} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!loading && !error && tests.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="flask-outline" size={36} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>No soil tests yet</Text>
            <Text style={styles.emptyText}>Photograph or upload a lab report and its results are read and saved for you. They stay with the farm or plot for every season.</Text>
          </View>
        ) : null}

        {visible.map((t) => {
          const st = STATUS[t.status];
          const heads = headlineResults(t);
          return (
            <Pressable key={t.id} style={styles.card} onPress={() => router.push({ pathname: "/soil-result", params: { id: t.id } })}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle} numberOfLines={1}>{plotName(t.plot_id)}{t.sample_label ? ` · ${t.sample_label}` : ""}</Text>
                <View style={[styles.badge, { backgroundColor: st.bg }]}><Text style={[styles.badgeText, { color: st.fg }]}>{st.label}</Text></View>
              </View>
              <Text style={styles.cardSub}>
                {formatDate(testDate(t))}{t.sample_date ? "" : t.received_date ? " (lab received)" : ""}{t.lab_name ? ` · ${t.lab_name}` : ""}
              </Text>
              {heads.length > 0 ? (
                <View style={styles.headRow}>
                  {heads.map((r) => (
                    <View key={r.key} style={styles.headItem}>
                      <Text style={styles.headLabel}>{r.label}</Text>
                      <Text style={styles.headValue}>{formatResultValue(r)}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.cardNote}>{t.results.length === 0 ? "No values yet – open to read again or enter them." : `${t.results.length} results`}</Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontFamily: "Manrope_700Bold", fontSize: 20, color: COLORS.text },
  scanBtn: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.primary, borderRadius: 14, padding: 16 },
  scanTitle: {
    fontFamily: "Manrope_700Bold",
    fontSize: 16,
    color: COLORS.white,
  },
  scanSub: {
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
    color: "#DDEEDD",
    marginTop: 2,
  },
  notice: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.amberLight, borderRadius: 10, padding: 10 },
  noticeText: {
    flex: 1,
    fontFamily: "Manrope_500Medium",
    fontSize: 13,
    color: COLORS.amberDark,
  },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.border, maxWidth: 160 },
  chipActive: {
    backgroundColor: COLORS.ink,
    borderColor: COLORS.ink,
  },
  chipText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  chipTextActive: { color: COLORS.white },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 14,
    gap: 6,
    ...CARD_SHADOW,
  },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: {
    flex: 1,
    fontFamily: "Manrope_700Bold",
    fontSize: 16,
    color: COLORS.text,
  },
  cardSub: {
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  cardNote: {
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
    color: COLORS.textMuted,
  },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 12,
  },
  headRow: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 4 },
  headItem: { minWidth: 70 },
  headLabel: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: COLORS.textMuted,
  },
  headValue: {
    fontFamily: "Manrope_700Bold",
    fontSize: 15,
    color: COLORS.text,
  },
  empty: { alignItems: "center", gap: 8, paddingVertical: 30, paddingHorizontal: 12 },
  emptyTitle: {
    fontFamily: "Manrope_700Bold",
    fontSize: 17,
    color: COLORS.text,
  },
  emptyText: {
    fontFamily: "Manrope_400Regular",
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 19,
  },
  error: {
    fontFamily: "Manrope_500Medium",
    fontSize: 14,
    color: COLORS.red,
  }});
