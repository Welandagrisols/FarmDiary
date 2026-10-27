import React, { useCallback, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import COLORS, { CARD_SHADOW } from "@/constants/colors";
import { useFarm } from "@/context/FarmContext";
import { listPlots, listSoilTests } from "@/lib/soil-storage";
import { sortNewestFirst, testDate, testsForTarget, type PlotRecord, type SoilTestRecord } from "@/lib/soil";
import { formatDate } from "@/lib/storage";

export default function PlotsScreen() {
  const insets = useSafeAreaInsets();
  const { activeFarm } = useFarm();
  const [plots, setPlots] = useState<PlotRecord[]>([]);
  const [tests, setTests] = useState<SoilTestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    if (!activeFarm?.id) { setLoading(false); return; }
    try {
      setError(null);
      const [p, t] = await Promise.all([listPlots(activeFarm.id), listSoilTests(activeFarm.id)]);
      setPlots(p);
      setTests(t);
    } catch (e: any) {
      setError(e?.message || "Could not load plots.");
    } finally {
      setLoading(false);
    }
  }, [activeFarm?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const active = plots.filter((p) => !p.is_archived);
  const archived = plots.filter((p) => p.is_archived);

  const Card = ({ plot }: { plot: PlotRecord }) => {
    const mine = sortNewestFirst(testsForTarget(tests, plot.id));
    return (
      <Pressable style={styles.card} onPress={() => router.push({ pathname: "/add-plot", params: { id: plot.id } })}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{plot.name}</Text>
          <Text style={styles.cardSub}>
            {plot.area_acres ? `${plot.area_acres} acres · ` : ""}
            {mine.length === 0 ? "No soil tests yet" : `${mine.length} soil test${mine.length === 1 ? "" : "s"} · latest ${formatDate(testDate(mine[0]))}`}
          </Text>
          {plot.description ? <Text style={styles.cardNote} numberOfLines={2}>{plot.description}</Text> : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="arrow-back" size={24} color={COLORS.text} /></Pressable>
        <Text style={styles.title}>Plots</Text>
        <Pressable onPress={() => router.push("/add-plot")} hitSlop={12}><Ionicons name="add-circle-outline" size={26} color={COLORS.primary} /></Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 90, gap: 12 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          A plot is a part of the farm you sample separately. Soil tests can belong to a plot or to the whole farm, and they stay with it across every season and crop cycle.
        </Text>

        {loading ? <ActivityIndicator color={COLORS.primary} style={{ marginTop: 24 }} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!loading && !error && active.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="grid-outline" size={34} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>No plots yet</Text>
            <Text style={styles.emptyText}>If you sample the whole farm as one composite, you don’t need plots. Add plots when you test different parts separately.</Text>
            <Pressable style={styles.primaryBtn} onPress={() => router.push("/add-plot")}><Text style={styles.primaryBtnText}>Add a plot</Text></Pressable>
          </View>
        ) : null}

        {active.map((p) => <Card key={p.id} plot={p} />)}

        {archived.length > 0 ? (
          <>
            <Pressable onPress={() => setShowArchived((v) => !v)} style={styles.archivedToggle}>
              <Text style={styles.archivedText}>{showArchived ? "Hide" : "Show"} archived plots ({archived.length})</Text>
            </Pressable>
            {showArchived ? archived.map((p) => <Card key={p.id} plot={p} />) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontFamily: "Manrope_700Bold", fontSize: 20, color: COLORS.text },
  intro: {
    fontFamily: "Manrope_400Regular",
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 19,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 14,
    ...CARD_SHADOW,
  },
  cardTitle: {
    fontFamily: "Manrope_700Bold",
    fontSize: 17,
    color: COLORS.text,
  },
  cardSub: {
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  cardNote: {
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  empty: { alignItems: "center", gap: 8, paddingVertical: 28, paddingHorizontal: 12 },
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
  primaryBtn: { marginTop: 8, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 22 },
  primaryBtnText: {
    fontFamily: "Manrope_700Bold",
    fontSize: 15,
    color: COLORS.white,
  },
  error: {
    fontFamily: "Manrope_500Medium",
    fontSize: 14,
    color: COLORS.red,
  },
  archivedToggle: { alignSelf: "center", paddingVertical: 8 },
  archivedText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 14,
    color: COLORS.textSecondary,
  }});
