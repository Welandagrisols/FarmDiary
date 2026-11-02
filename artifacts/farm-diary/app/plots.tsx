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
import { applyPendingBoundaries, flushPendingBoundaries, getPendingPlotIds } from "@/lib/boundary-storage";
import { formatAcres, M2_PER_ACRE } from "@/lib/geo";

export default function PlotsScreen() {
  const insets = useSafeAreaInsets();
  const { activeFarm } = useFarm();
  const [plots, setPlots] = useState<PlotRecord[]>([]);
  const [tests, setTests] = useState<SoilTestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [pendingPlotIds, setPendingPlotIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!activeFarm?.id) { setLoading(false); return; }
    try {
      setError(null);
      await flushPendingBoundaries();
      const [p, t] = await Promise.all([listPlots(activeFarm.id), listSoilTests(activeFarm.id)]);
      setPlots(await applyPendingBoundaries(p));
      setTests(t);
      setPendingPlotIds(await getPendingPlotIds());
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
    const mappedAcres = plot.boundary_area_m2 != null ? plot.boundary_area_m2 / M2_PER_ACRE : null;
    const hasBoundary = Array.isArray(plot.boundary) && plot.boundary.length >= 3;
    const isPending = pendingPlotIds.includes(plot.id);
    return (
      <View style={styles.card}>
        <Pressable
          style={styles.cardMain}
          onPress={() => router.push({ pathname: "/add-plot", params: { id: plot.id } })}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${plot.name}`}
        >
          <Text style={styles.cardTitle}>{plot.name}</Text>
          <Text style={styles.cardSub}>
            {plot.area_acres ? `${plot.area_acres} acres · ` : ""}
            {mine.length === 0 ? "No soil tests yet" : `${mine.length} soil test${mine.length === 1 ? "" : "s"} · latest ${formatDate(testDate(mine[0]))}`}
          </Text>
          {hasBoundary ? (
            <Text style={styles.mapStatus}>
              {mappedAcres == null ? "GPS outline saved" : `${formatAcres(mappedAcres)} acres mapped`}
              {isPending ? " · saved on this phone" : ""}
            </Text>
          ) : null}
          {plot.description ? <Text style={styles.cardNote} numberOfLines={2}>{plot.description}</Text> : null}
        </Pressable>
        <Pressable
          style={styles.mapAction}
          onPress={() => router.push({ pathname: "/plot-boundary", params: { id: plot.id } })}
          accessibilityRole="button"
          accessibilityLabel={`${hasBoundary ? "View map for" : "Map"} ${plot.name}`}
          testID={`plot-boundary-${plot.id}`}
        >
          <Ionicons name={hasBoundary ? "map" : "map-outline"} size={22} color={COLORS.primary} />
          <Text style={styles.mapActionText}>{hasBoundary ? "View map" : "Map plot"}</Text>
        </Pressable>
      </View>
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
  title: { fontFamily: "Manrope_700Bold", fontSize: 32, color: COLORS.text },
  intro: {
    fontFamily: "Manrope_400Regular",
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 19,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 14,
    ...CARD_SHADOW,
  },
  cardMain: { flex: 1, minHeight: 56, justifyContent: "center" },
  cardTitle: {
    fontFamily: "Manrope_700Bold",
    fontSize: 17,
    color: COLORS.text,
  },
  cardSub: {
    fontFamily: "Manrope_400Regular",
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  cardNote: {
    fontFamily: "Manrope_400Regular",
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  mapStatus: { fontFamily: "Manrope_600SemiBold", fontSize: 13, color: COLORS.primary, marginTop: 4 },
  mapAction: { minWidth: 76, minHeight: 56, alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 4 },
  mapActionText: { fontFamily: "Manrope_600SemiBold", fontSize: 13, color: COLORS.primary, textAlign: "center" },
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
