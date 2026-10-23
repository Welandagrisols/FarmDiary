import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import COLORS from "@/constants/colors";
import { useFarm } from "@/context/FarmContext";
import {
  confirmSoilTest,
  createSoilTest,
  deleteSoilTest,
  getSoilTest,
  listPlots,
  listSoilTests,
  updateSoilTest,
} from "@/lib/supabase-storage";
import {
  compareSoilResult,
  makeManualSoilResult,
  normalizeSoilDate,
  SAMPLING_METHOD_LABELS,
  SOIL_PARAMETERS,
  SOIL_RATING_LABELS,
  type PlotRecord,
  type SamplingMethod,
  type SoilRating,
  type SoilResult,
  type SoilTestRecord,
} from "@/lib/soil";
import { formatDate } from "@/lib/storage";

interface ResultDraft {
  id: string;
  label: string;
  value: string;
  unit: string;
  method: string;
  rating: SoilRating | null;
}

function newResultDraft(): ResultDraft {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, label: "", value: "", unit: "", method: "", rating: null };
}

function resultDraft(result: SoilResult): ResultDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: result.reported_label || result.label,
    value: result.value !== null ? String(result.value) : result.text || "",
    unit: result.unit || "",
    method: result.method || "",
    rating: result.rating,
  };
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "decimal-pad";
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        keyboardType={keyboardType || "default"}
        multiline={multiline}
        autoCapitalize="sentences"
        testID={`soil-field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
      />
    </View>
  );
}

export default function SoilEditScreen() {
  const insets = useSafeAreaInsets();
  const { activeFarm } = useFarm();
  const farmId = activeFarm?.id || "";
  const params = useLocalSearchParams<{ id?: string }>();
  const testId = typeof params.id === "string" ? params.id : "";
  const requestId = useRef(0);
  const [test, setTest] = useState<SoilTestRecord | null>(null);
  const [history, setHistory] = useState<SoilTestRecord[]>([]);
  const [plots, setPlots] = useState<PlotRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sampleLabel, setSampleLabel] = useState("");
  const [sampleDate, setSampleDate] = useState(new Date().toISOString().slice(0, 10));
  const [labName, setLabName] = useState("");
  const [labReference, setLabReference] = useState("");
  const [sampleDepth, setSampleDepth] = useState("");
  const [plotId, setPlotId] = useState<string | null>(null);
  const [samplingMethod, setSamplingMethod] = useState<SamplingMethod>("unknown");
  const [recommendations, setRecommendations] = useState("");
  const [results, setResults] = useState<ResultDraft[]>([newResultDraft()]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fillForm = useCallback((saved: SoilTestRecord) => {
    setTest(saved);
    setSampleLabel(saved.sample_label || "");
    setSampleDate(saved.sample_date || "");
    setLabName(saved.lab_name || "");
    setLabReference(saved.lab_reference || "");
    setSampleDepth(saved.sample_depth || "");
    setPlotId(saved.plot_id);
    setSamplingMethod(saved.sampling_method);
    setRecommendations(saved.recommendations || "");
    setResults(saved.results.length ? saved.results.map(resultDraft) : [newResultDraft()]);
  }, []);

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    if (!farmId) {
      setError("Select a farm before recording a soil test.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [nextPlots, nextTests, current] = await Promise.all([
        listPlots(farmId),
        listSoilTests(farmId),
        testId ? getSoilTest(farmId, testId) : Promise.resolve(null),
      ]);
      if (currentRequest !== requestId.current) return;
      setPlots(nextPlots);
      setHistory(nextTests);
      if (testId && !current) throw new Error("This soil test could not be found for the selected farm.");
      if (current) fillForm(current);
    } catch (loadError) {
      if (currentRequest === requestId.current) {
        const message = loadError instanceof Error ? loadError.message : "Unable to load this soil test.";
        setError(/soil_tests|plots|relation|schema cache/i.test(message)
          ? "Soil-test tables are not installed yet. Run scripts/soil-module.sql in Supabase after scripts/sales-control.sql."
          : message);
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [farmId, fillForm, testId]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => { requestId.current += 1; };
  }, [load]));

  const updateResult = (id: string, updates: Partial<ResultDraft>) => {
    setResults((current) => current.map((row) => row.id === id ? { ...row, ...updates } : row));
  };

  const save = async () => {
    setError("");
    const normalizedDate = sampleDate.trim() ? normalizeSoilDate(sampleDate) : null;
    if (sampleDate.trim() && !normalizedDate) {
      setError("Use a valid sample date in YYYY-MM-DD format. It cannot be in the future.");
      return;
    }
    const enteredResults = results.filter((item) => item.label.trim() || item.value.trim());
    if (!enteredResults.length) {
      setError("Add at least one measurement from the lab report before saving.");
      return;
    }
    if (plotId && !plots.some((plot) => plot.id === plotId && !plot.is_archived)) {
      setError("Choose an active plot or select Whole farm.");
      return;
    }

    let normalizedResults: SoilResult[];
    try {
      normalizedResults = enteredResults.map((item) => makeManualSoilResult({
        label: item.label,
        value: item.value,
        unit: item.unit,
        method: item.method,
        rating: item.rating,
      }));
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : "Check the soil measurements.");
      return;
    }

    setSaving(true);
    try {
      const common = {
        plot_id: plotId,
        sample_label: sampleLabel.trim() || null,
        sample_date: normalizedDate,
        lab_name: labName.trim() || null,
        lab_reference: labReference.trim() || null,
        sample_depth: sampleDepth.trim() || null,
        sampling_method: samplingMethod,
        results: normalizedResults,
        recommendations: recommendations.trim() || null,
        recommendation_items: [],
      };
      if (test) {
        await updateSoilTest(farmId, test.id, {
          ...common,
          status: test.source === "manual" ? "manual" : "needs_review",
        });
      } else {
        await createSoilTest({
          farm_id: farmId,
          ...common,
          received_date: null,
          report_date: null,
          location_on_report: null,
          intended_crops: [],
          report_files: [],
          source: "manual",
          status: "manual",
          extraction_notes: null,
        });
      }
      router.replace("/soil");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the soil test. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const confirm = async () => {
    if (!test) return;
    setSaving(true);
    setError("");
    try {
      const confirmed = await confirmSoilTest(farmId, test.id);
      setTest(confirmed);
      router.replace("/soil");
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Could not confirm this soil test.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!test) return;
    setSaving(true);
    setError("");
    try {
      await deleteSoilTest(farmId, test.id);
      router.replace("/soil");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete this soil test.");
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const ScrollArea = Platform.OS === "web" ? ScrollView : KeyboardAwareScrollView;

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: topPadding }]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
        <Text style={styles.loadingText}>Loading soil records…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={23} color={COLORS.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{test ? "Edit soil test" : "New soil test"}</Text>
          <Text style={styles.subtitle}>{activeFarm?.name || "Farm"}</Text>
        </View>
        {test ? (
          <Pressable onPress={() => setConfirmDelete((show) => !show)} hitSlop={9} accessibilityLabel="Delete soil test">
            <Ionicons name="trash-outline" size={21} color={COLORS.red} />
          </Pressable>
        ) : null}
      </View>

      <ScrollArea
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 36 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.noteCard}>
          <Ionicons name="information-circle-outline" size={19} color={COLORS.primary} />
          <Text style={styles.noteText}>Record lab values as printed. Units and lab ratings are not converted. Tests stay with the farm or plot, not a season.</Text>
        </View>
        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={COLORS.red} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {confirmDelete && test ? (
          <View style={styles.deletePanel}>
            <Text style={styles.deleteText}>Delete this soil test and its saved measurements?</Text>
            <View style={styles.actionRow}>
              <Pressable style={styles.secondaryButton} onPress={() => setConfirmDelete(false)}>
                <Text style={styles.secondaryButtonText}>Keep test</Text>
              </Pressable>
              <Pressable style={[styles.primaryButton, styles.deleteButton]} onPress={remove} disabled={saving}>
                <Text style={styles.primaryButtonText}>{saving ? "Deleting…" : "Delete test"}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sample details</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Applies to</Text>
            <View style={styles.chipWrap}>
              <Pressable onPress={() => setPlotId(null)} style={[styles.chip, plotId === null && styles.chipActive]}>
                <Text style={[styles.chipText, plotId === null && styles.chipTextActive]}>Whole farm</Text>
              </Pressable>
              {plots.filter((plot) => !plot.is_archived || plot.id === plotId).map((plot) => (
                <Pressable key={plot.id} onPress={() => setPlotId(plot.id)} style={[styles.chip, plotId === plot.id && styles.chipActive]}>
                  <Text style={[styles.chipText, plotId === plot.id && styles.chipTextActive]} numberOfLines={1}>{plot.name}</Text>
                </Pressable>
              ))}
              {plots.filter((plot) => !plot.is_archived).length === 0 ? (
                <Text style={styles.helperText}>Add plots from the Soil Tests page, or keep this test at whole-farm level.</Text>
              ) : null}
            </View>
          </View>
          <Field label="Sample name" value={sampleLabel} onChangeText={setSampleLabel} placeholder="For example, North field composite" />
          <Field label="Sample date" value={sampleDate} onChangeText={setSampleDate} placeholder="YYYY-MM-DD" />
          <View style={styles.twoColumns}>
            <View style={{ flex: 1 }}><Field label="Laboratory" value={labName} onChangeText={setLabName} placeholder="Lab name" /></View>
            <View style={{ flex: 1 }}><Field label="Lab reference" value={labReference} onChangeText={setLabReference} placeholder="Reference no." /></View>
          </View>
          <View style={styles.twoColumns}>
            <View style={{ flex: 1 }}><Field label="Sample depth" value={sampleDepth} onChangeText={setSampleDepth} placeholder="For example, 0–20 cm" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Sampling method</Text>
              <View style={styles.chipWrap}>
                {(Object.keys(SAMPLING_METHOD_LABELS) as SamplingMethod[]).map((method) => (
                  <Pressable key={method} onPress={() => setSamplingMethod(method)} style={[styles.chip, samplingMethod === method && styles.chipActive]}>
                    <Text style={[styles.chipText, samplingMethod === method && styles.chipTextActive]}>{SAMPLING_METHOD_LABELS[method]}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Measurements</Text>
              <Text style={styles.helperText}>Use the label, value, and unit shown on the report.</Text>
            </View>
            <Pressable onPress={() => setResults((current) => [...current, newResultDraft()])} hitSlop={8} accessibilityLabel="Add measurement">
              <Ionicons name="add-circle-outline" size={25} color={COLORS.primary} />
            </Pressable>
          </View>
          {results.map((row, index) => {
            const previous = test && row.label.trim()
              ? compareSoilResult(history, test, test.results[index] || makeDraftComparison(row))
              : null;
            return (
              <View key={row.id} style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultHeading}>Measurement {index + 1}</Text>
                  {results.length > 1 ? (
                    <Pressable onPress={() => setResults((current) => current.filter((item) => item.id !== row.id))} hitSlop={8} accessibilityLabel={`Remove measurement ${index + 1}`}>
                      <Ionicons name="close-circle-outline" size={21} color={COLORS.textMuted} />
                    </Pressable>
                  ) : null}
                </View>
                <Field label="Measurement name" value={row.label} onChangeText={(value) => updateResult(row.id, { label: value })} placeholder="Choose a value below or type a lab label" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestions}>
                  {SOIL_PARAMETERS.slice(0, 12).map((parameter) => (
                    <Pressable key={parameter.key} onPress={() => updateResult(row.id, { label: parameter.label })} style={styles.suggestionChip}>
                      <Text style={styles.suggestionText}>{parameter.label}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={styles.twoColumns}>
                  <View style={{ flex: 1 }}><Field label="Value" value={row.value} onChangeText={(value) => updateResult(row.id, { value })} placeholder="For example, 5.8 or <0.5" keyboardType="decimal-pad" /></View>
                  <View style={{ flex: 1 }}><Field label="Unit" value={row.unit} onChangeText={(value) => updateResult(row.id, { unit: value })} placeholder="pH, %, mg/kg…" /></View>
                </View>
                <Field label="Lab method (optional)" value={row.method} onChangeText={(value) => updateResult(row.id, { method: value })} placeholder="For example, Olsen" />
                <Text style={styles.label}>Lab rating (optional)</Text>
                <View style={styles.chipWrap}>
                  <Pressable onPress={() => updateResult(row.id, { rating: null })} style={[styles.chip, row.rating === null && styles.chipActive]}>
                    <Text style={[styles.chipText, row.rating === null && styles.chipTextActive]}>None</Text>
                  </Pressable>
                  {(Object.keys(SOIL_RATING_LABELS) as SoilRating[]).map((rating) => (
                    <Pressable key={rating} onPress={() => updateResult(row.id, { rating })} style={[styles.chip, row.rating === rating && styles.chipActive]}>
                      <Text style={[styles.chipText, row.rating === rating && styles.chipTextActive]}>{SOIL_RATING_LABELS[rating]}</Text>
                    </Pressable>
                  ))}
                </View>
                {previous?.previous && test ? (
                  <Text style={styles.comparisonText}>
                    Previous: {previous.previous.value ?? previous.previous.text} {previous.previous.unit || ""} · {formatDate(previous.previousTest ? previous.previousTest.sample_date || previous.previousTest.created_at.slice(0, 10) : "")}
                    {previous.change !== null ? ` · change ${previous.change > 0 ? "+" : ""}${previous.change}` : previous.unitDiffers ? " · unit differs" : ""}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lab recommendations</Text>
          <Text style={styles.helperText}>Copy advice as written. Check the original report before applying any rate.</Text>
          <Field label="Recommendations" value={recommendations} onChangeText={setRecommendations} placeholder="Advice from the lab, including crop, rate, and timing" multiline />
        </View>

        {test && test.status !== "confirmed" ? (
          <Pressable style={styles.confirmButton} onPress={confirm} disabled={saving} testID="soil-confirm-test">
            <Ionicons name="checkmark-circle-outline" size={19} color={COLORS.white} />
            <Text style={styles.primaryButtonText}>{saving ? "Saving…" : "Confirm checked values"}</Text>
          </Pressable>
        ) : null}
        <Pressable style={[styles.primaryButton, saving && styles.disabled]} onPress={save} disabled={saving} testID="soil-save-test">
          {saving ? <ActivityIndicator color={COLORS.white} /> : <Ionicons name="save-outline" size={18} color={COLORS.white} />}
          <Text style={styles.primaryButtonText}>{saving ? "Saving…" : test ? "Save changes" : "Save soil test"}</Text>
        </Pressable>
      </ScrollArea>
    </View>
  );
}

function makeDraftComparison(row: ResultDraft): SoilResult {
  return makeManualSoilResult({ label: row.label, value: row.value || "0", unit: row.unit, method: row.method, rating: row.rating });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: COLORS.background },
  loadingText: { color: COLORS.textSecondary, fontFamily: "DMSans_400Regular", fontSize: 13 },
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 18, paddingVertical: 12, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  title: { fontFamily: "DMSans_700Bold", color: COLORS.text, fontSize: 19 },
  subtitle: { fontFamily: "DMSans_400Regular", color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  scroll: { flex: 1 },
  content: { padding: 15, gap: 13 },
  noteCard: { flexDirection: "row", alignItems: "flex-start", gap: 9, padding: 12, borderRadius: 12, backgroundColor: COLORS.primarySurface },
  noteText: { flex: 1, color: COLORS.primary, fontFamily: "DMSans_400Regular", fontSize: 12, lineHeight: 18 },
  errorBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 12, backgroundColor: COLORS.redLight },
  errorText: { flex: 1, color: COLORS.red, fontFamily: "DMSans_500Medium", fontSize: 12, lineHeight: 18 },
  section: { padding: 14, borderRadius: 14, backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.border, gap: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  sectionTitle: { color: COLORS.text, fontFamily: "DMSans_700Bold", fontSize: 16 },
  helperText: { color: COLORS.textSecondary, fontFamily: "DMSans_400Regular", fontSize: 11, lineHeight: 16 },
  field: { gap: 5 },
  label: { color: COLORS.text, fontFamily: "DMSans_600SemiBold", fontSize: 12 },
  input: { minHeight: 43, paddingHorizontal: 11, paddingVertical: 9, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, backgroundColor: COLORS.background, color: COLORS.text, fontFamily: "DMSans_400Regular", fontSize: 14 },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  twoColumns: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { paddingHorizontal: 10, paddingVertical: 7, maxWidth: 180, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background },
  chipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  chipText: { color: COLORS.textSecondary, fontFamily: "DMSans_500Medium", fontSize: 11 },
  chipTextActive: { color: COLORS.white },
  resultCard: { padding: 12, borderRadius: 12, backgroundColor: COLORS.background, gap: 10, borderWidth: 1, borderColor: COLORS.borderLight },
  resultHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  resultHeading: { color: COLORS.primary, fontFamily: "DMSans_700Bold", fontSize: 13 },
  suggestions: { gap: 6, paddingBottom: 2 },
  suggestionChip: { paddingHorizontal: 9, paddingVertical: 6, backgroundColor: COLORS.tealLight, borderRadius: 16 },
  suggestionText: { color: COLORS.teal, fontFamily: "DMSans_500Medium", fontSize: 10 },
  comparisonText: { color: COLORS.textSecondary, fontFamily: "DMSans_400Regular", fontSize: 11, lineHeight: 16 },
  actionRow: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 10 },
  deletePanel: { padding: 12, borderWidth: 1, borderColor: COLORS.red, borderRadius: 12, backgroundColor: COLORS.redLight },
  deleteText: { color: COLORS.red, fontFamily: "DMSans_600SemiBold", fontSize: 13 },
  primaryButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 16, borderRadius: 13, backgroundColor: COLORS.primary },
  primaryButtonText: { color: COLORS.white, fontFamily: "DMSans_700Bold", fontSize: 14 },
  confirmButton: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, backgroundColor: COLORS.teal },
  deleteButton: { backgroundColor: COLORS.red },
  secondaryButton: { minHeight: 42, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.border },
  secondaryButtonText: { color: COLORS.textSecondary, fontFamily: "DMSans_600SemiBold", fontSize: 12 },
  disabled: { opacity: 0.6 },
});
