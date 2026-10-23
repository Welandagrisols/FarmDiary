import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import COLORS from "@/constants/colors";
import { useFarm } from "@/context/FarmContext";
import {
  createPlot,
  listPlots,
  listSoilTests,
  updatePlot,
} from "@/lib/supabase-storage";
import { formatSoilValue, soilTestDate, type PlotRecord, type SoilTestRecord } from "@/lib/soil";
import { formatDate } from "@/lib/storage";

type TestFilter = "all" | "farm" | string;

function setupHint(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unable to load soil tests.";
  if (/soil_tests|plots|relation|schema cache/i.test(message)) {
    return "Soil-test tables are not installed yet. Run scripts/soil-module.sql in Supabase after scripts/sales-control.sql.";
  }
  return message;
}

export default function SoilScreen() {
  const insets = useSafeAreaInsets();
  const { activeFarm } = useFarm();
  const farmId = activeFarm?.id || "";
  const requestId = useRef(0);
  const [tests, setTests] = useState<SoilTestRecord[]>([]);
  const [plots, setPlots] = useState<PlotRecord[]>([]);
  const [filter, setFilter] = useState<TestFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState("");
  const [plotFormOpen, setPlotFormOpen] = useState(false);
  const [plotName, setPlotName] = useState("");
  const [plotArea, setPlotArea] = useState("");
  const [plotDescription, setPlotDescription] = useState("");
  const [savingPlot, setSavingPlot] = useState(false);

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    if (!farmId) {
      setTests([]);
      setPlots([]);
      setError("Select a farm to view its soil tests.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    let usedOffline = false;
    try {
      const [nextTests, nextPlots] = await Promise.all([
        listSoilTests(farmId, () => { usedOffline = true; }),
        listPlots(farmId, () => { usedOffline = true; }),
      ]);
      if (currentRequest !== requestId.current) return;
      setTests(nextTests);
      setPlots(nextPlots);
      setOffline(usedOffline);
      setFilter((selected) =>
        selected !== "all" && selected !== "farm" && !nextPlots.some((plot) => plot.id === selected)
          ? "all"
          : selected,
      );
    } catch (loadError) {
      if (currentRequest === requestId.current) {
        setError(setupHint(loadError));
        setOffline(usedOffline);
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [farmId]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => { requestId.current += 1; };
  }, [load]));

  const savePlot = async () => {
    const name = plotName.trim();
    const acres = plotArea.trim() ? Number(plotArea) : null;
    if (!name) {
      setError("Enter a name for the plot.");
      return;
    }
    if (acres !== null && (!Number.isFinite(acres) || acres <= 0)) {
      setError("Plot area must be greater than zero.");
      return;
    }
    setSavingPlot(true);
    setError("");
    try {
      await createPlot({
        farm_id: farmId,
        name,
        area_acres: acres,
        description: plotDescription.trim() || null,
        is_archived: false,
      });
      setPlotName("");
      setPlotArea("");
      setPlotDescription("");
      setPlotFormOpen(false);
      await load();
    } catch (saveError) {
      setError(setupHint(saveError));
    } finally {
      setSavingPlot(false);
    }
  };

  const archivePlot = async (plot: PlotRecord) => {
    try {
      await updatePlot(farmId, plot.id, { is_archived: true });
      setPlots((current) => current.map((item) => item.id === plot.id ? { ...item, is_archived: true } : item));
      if (filter === plot.id) setFilter("all");
    } catch (archiveError) {
      setError(setupHint(archiveError));
    }
  };

  const filteredTests = tests.filter((test) => {
    if (filter === "farm") return test.plot_id === null;
    if (filter !== "all") return test.plot_id === filter;
    return true;
  });
  const plotNames = new Map(plots.map((plot) => [plot.id, plot.name]));
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;
  const canManage = !!farmId;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={23} color={COLORS.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>Soil tests</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{activeFarm?.name || "Choose a farm"}</Text>
        </View>
        {canManage ? (
          <Pressable
            style={styles.addButton}
            onPress={() => router.push("/soil-edit")}
            accessibilityLabel="Add soil test"
            testID="soil-add-test"
          >
            <Ionicons name="add" size={22} color={COLORS.white} />
          </Pressable>
        ) : <View style={styles.addButtonSpacer} />}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + 28 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => {
          setRefreshing(true);
          await load();
          setRefreshing(false);
        }} tintColor={COLORS.primary} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <View style={styles.introIcon}><Ionicons name="analytics-outline" size={21} color={COLORS.primary} /></View>
          <Text style={styles.introText}>Keep lab results with the farm or plot, across seasons. Values stay in the units printed by the lab.</Text>
        </View>

        {offline ? (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={17} color={COLORS.amberDark} />
            <Text style={styles.offlineText}>Showing saved soil records. New changes will sync when the connection returns.</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={COLORS.red} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => { setError(""); void load(); }} hitSlop={8} accessibilityLabel="Retry">
              <Ionicons name="refresh" size={18} color={COLORS.red} />
            </Pressable>
          </View>
        ) : null}

        {canManage ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Plots</Text>
                <Text style={styles.sectionHint}>Optional locations for plot-level results</Text>
              </View>
              <Pressable onPress={() => setPlotFormOpen((open) => !open)} hitSlop={8} accessibilityLabel="Add plot">
                <Ionicons name={plotFormOpen ? "close-circle-outline" : "add-circle-outline"} size={25} color={COLORS.primary} />
              </Pressable>
            </View>
            {plotFormOpen ? (
              <View style={styles.plotForm}>
                <TextInput style={styles.input} value={plotName} onChangeText={setPlotName} placeholder="Plot name" placeholderTextColor={COLORS.textMuted} maxLength={80} />
                <View style={styles.plotFormRow}>
                  <TextInput style={[styles.input, styles.areaInput]} value={plotArea} onChangeText={setPlotArea} placeholder="Area (acres)" placeholderTextColor={COLORS.textMuted} keyboardType="decimal-pad" />
                  <Pressable style={[styles.smallButton, savingPlot && styles.disabled]} onPress={savePlot} disabled={savingPlot} testID="soil-save-plot">
                    {savingPlot ? <ActivityIndicator size="small" color={COLORS.white} /> : <Text style={styles.smallButtonText}>Save plot</Text>}
                  </Pressable>
                </View>
                <TextInput style={[styles.input, styles.multiline]} value={plotDescription} onChangeText={setPlotDescription} placeholder="Notes (optional)" placeholderTextColor={COLORS.textMuted} multiline />
              </View>
            ) : null}
            {plots.filter((plot) => !plot.is_archived).length === 0 && !plotFormOpen ? (
              <Text style={styles.emptyInline}>No plots yet. You can record a test for the whole farm or add plots here.</Text>
            ) : null}
            {plots.filter((plot) => !plot.is_archived).map((plot) => (
              <View key={plot.id} style={styles.plotRow}>
                <View style={styles.plotIcon}><Ionicons name="grid-outline" size={17} color={COLORS.teal} /></View>
                <View style={styles.plotInfo}>
                  <Text style={styles.plotName}>{plot.name}</Text>
                  <Text style={styles.plotMeta}>{plot.area_acres ? `${plot.area_acres} acres` : "Area not set"} · {tests.filter((test) => test.plot_id === plot.id).length} test(s)</Text>
                </View>
                <Pressable onPress={() => archivePlot(plot)} hitSlop={8} accessibilityLabel={`Archive ${plot.name}`}>
                  <Ionicons name="archive-outline" size={19} color={COLORS.textMuted} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Test history</Text>
              <Text style={styles.sectionHint}>{filteredTests.length} record{filteredTests.length === 1 ? "" : "s"}</Text>
            </View>
            {canManage ? (
              <Pressable style={styles.newButton} onPress={() => router.push("/soil-edit")} testID="soil-add-test-secondary">
                <Ionicons name="add" size={17} color={COLORS.white} />
                <Text style={styles.newButtonText}>New test</Text>
              </Pressable>
            ) : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {[
              { id: "all", label: "All tests" },
              { id: "farm", label: "Whole farm" },
              ...plots.filter((plot) => !plot.is_archived).map((plot) => ({ id: plot.id, label: plot.name })),
            ].map((item) => (
              <Pressable key={item.id} onPress={() => setFilter(item.id)} style={[styles.filterChip, filter === item.id && styles.filterChipActive]}>
                <Text style={[styles.filterText, filter === item.id && styles.filterTextActive]} numberOfLines={1}>{item.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {loading ? <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 26 }} /> : null}
          {!loading && filteredTests.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="flask-outline" size={29} color={COLORS.teal} />
              <Text style={styles.emptyTitle}>No soil tests yet</Text>
              <Text style={styles.emptyText}>Add the values from a lab report. Tests are kept with this farm and are not tied to a season.</Text>
              {canManage ? (
                <Pressable style={styles.emptyButton} onPress={() => router.push("/soil-edit")}>
                  <Text style={styles.emptyButtonText}>Add first test</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {filteredTests.map((test) => (
            <Pressable
              key={test.id}
              style={styles.testCard}
              onPress={() => router.push({ pathname: "/soil-edit", params: { id: test.id } })}
              testID={`soil-test-${test.id}`}
            >
              <View style={styles.testTop}>
                <View style={styles.testIcon}><Ionicons name="document-text-outline" size={18} color={COLORS.primary} /></View>
                <View style={styles.testInfo}>
                  <Text style={styles.testName}>{test.sample_label || test.lab_name || "Soil test"}</Text>
                  <Text style={styles.testMeta}>{test.plot_id ? plotNames.get(test.plot_id) || "Archived plot" : "Whole farm"} · {formatDate(soilTestDate(test))}</Text>
                </View>
                <View style={[styles.statusBadge, test.status === "confirmed" && styles.statusConfirmed]}>
                  <Text style={[styles.statusText, test.status === "confirmed" && styles.statusConfirmedText]}>
                    {test.status === "confirmed" ? "Confirmed" : test.status === "manual" ? "Manual" : "Review"}
                  </Text>
                </View>
              </View>
              {test.results.length > 0 ? (
                <View style={styles.resultPreview}>
                  {test.results.slice(0, 3).map((result, index) => (
                    <Text key={`${result.key}-${index}`} style={styles.resultPreviewText} numberOfLines={1}>
                      {result.label}: {formatSoilValue(result)}
                    </Text>
                  ))}
                  {test.results.length > 3 ? <Text style={styles.resultMore}>+{test.results.length - 3} more</Text> : null}
                </View>
              ) : <Text style={styles.noResults}>No measurements entered</Text>}
              <View style={styles.cardFooter}>
                <Text style={styles.cardFooterText}>{test.lab_name || "Lab not recorded"}{test.lab_reference ? ` · ${test.lab_reference}` : ""}</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 18, paddingVertical: 12, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  headerText: { flex: 1 },
  title: { fontFamily: "DMSans_700Bold", fontSize: 20, color: COLORS.text },
  subtitle: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  addButton: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primary },
  addButtonSpacer: { width: 40 },
  content: { padding: 16, gap: 14 },
  intro: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, backgroundColor: COLORS.primarySurface },
  introIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.cardBg, alignItems: "center", justifyContent: "center" },
  introText: { flex: 1, fontFamily: "DMSans_500Medium", fontSize: 13, color: COLORS.primary, lineHeight: 19 },
  offlineBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, backgroundColor: COLORS.amberLight, borderRadius: 12 },
  offlineText: { flex: 1, color: COLORS.amberDark, fontFamily: "DMSans_400Regular", fontSize: 12, lineHeight: 17 },
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, backgroundColor: COLORS.redLight, borderRadius: 12 },
  errorText: { flex: 1, color: COLORS.red, fontFamily: "DMSans_500Medium", fontSize: 12, lineHeight: 17 },
  section: { backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 15, borderWidth: 1, borderColor: COLORS.border, gap: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sectionTitle: { fontFamily: "DMSans_700Bold", fontSize: 16, color: COLORS.text },
  sectionHint: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  plotForm: { gap: 9, padding: 12, backgroundColor: COLORS.background, borderRadius: 12 },
  plotFormRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  input: { minHeight: 44, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cardBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.text, fontFamily: "DMSans_400Regular", fontSize: 14 },
  areaInput: { flex: 1 },
  multiline: { minHeight: 72, textAlignVertical: "top" },
  smallButton: { minHeight: 42, paddingHorizontal: 14, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  smallButtonText: { color: COLORS.white, fontFamily: "DMSans_600SemiBold", fontSize: 13 },
  disabled: { opacity: 0.6 },
  emptyInline: { color: COLORS.textSecondary, fontFamily: "DMSans_400Regular", fontSize: 12, lineHeight: 18 },
  plotRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5 },
  plotIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: COLORS.tealLight, alignItems: "center", justifyContent: "center" },
  plotInfo: { flex: 1 },
  plotName: { color: COLORS.text, fontFamily: "DMSans_600SemiBold", fontSize: 13 },
  plotMeta: { color: COLORS.textMuted, fontFamily: "DMSans_400Regular", fontSize: 11, marginTop: 2 },
  newButton: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  newButtonText: { color: COLORS.white, fontFamily: "DMSans_600SemiBold", fontSize: 12 },
  filters: { gap: 8, paddingBottom: 2 },
  filterChip: { maxWidth: 170, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontFamily: "DMSans_500Medium", fontSize: 12, color: COLORS.textSecondary },
  filterTextActive: { color: COLORS.white },
  emptyCard: { alignItems: "center", paddingHorizontal: 20, paddingVertical: 27, gap: 9, borderRadius: 14, backgroundColor: COLORS.background },
  emptyTitle: { fontFamily: "DMSans_700Bold", fontSize: 15, color: COLORS.text },
  emptyText: { fontFamily: "DMSans_400Regular", fontSize: 12, lineHeight: 18, color: COLORS.textSecondary, textAlign: "center" },
  emptyButton: { marginTop: 5, paddingHorizontal: 17, paddingVertical: 10, backgroundColor: COLORS.primary, borderRadius: 10 },
  emptyButtonText: { color: COLORS.white, fontFamily: "DMSans_600SemiBold", fontSize: 13 },
  testCard: { padding: 13, backgroundColor: COLORS.cardBg, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, gap: 10 },
  testTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  testIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primarySurface },
  testInfo: { flex: 1 },
  testName: { fontFamily: "DMSans_700Bold", color: COLORS.text, fontSize: 14 },
  testMeta: { fontFamily: "DMSans_400Regular", color: COLORS.textSecondary, fontSize: 11, marginTop: 3 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: COLORS.amberLight },
  statusConfirmed: { backgroundColor: COLORS.greenLight },
  statusText: { color: COLORS.amberDark, fontFamily: "DMSans_600SemiBold", fontSize: 10 },
  statusConfirmedText: { color: COLORS.green },
  resultPreview: { gap: 4, paddingLeft: 46 },
  resultPreviewText: { color: COLORS.textSecondary, fontFamily: "DMSans_400Regular", fontSize: 12 },
  resultMore: { color: COLORS.primary, fontFamily: "DMSans_600SemiBold", fontSize: 11 },
  noResults: { paddingLeft: 46, color: COLORS.textMuted, fontFamily: "DMSans_400Regular", fontSize: 12 },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: COLORS.borderLight, paddingTop: 8 },
  cardFooterText: { flex: 1, color: COLORS.textMuted, fontFamily: "DMSans_400Regular", fontSize: 11 },
});
