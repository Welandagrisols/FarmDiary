import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import COLORS, { CARD_SHADOW } from "@/constants/colors";
import { useFarm } from "@/context/FarmContext";
import { soilApi } from "@/lib/api";
import { confirmSoilTest, getSoilTest, listPlots, listSoilTests, updateSoilTest, type SoilTestEditable } from "@/lib/soil-storage";
import {
  SAMPLING_METHOD_LABELS, SOIL_GROUP_LABELS, SOIL_GROUP_ORDER, SOIL_PARAMETERS, SOIL_RATINGS, SOIL_RATING_LABELS,
  compareWithPrevious, describeFlag, formatResultValue, groupForKey, normalizeDate, normalizeResult, testDate,
  type PlotRecord, type RecommendationItem, type SamplingMethod, type SoilRating, type SoilResult, type SoilTestRecord,
} from "@/lib/soil";
import { cropsForPlan } from "@/lib/fertilizer";
import { formatDate } from "@/lib/storage";

const ratingColors = (r: SoilResult): { bg: string; fg: string } => {
  switch (r.rating) {
    case "very_low": case "low": return { bg: COLORS.redLight, fg: COLORS.red };
    case "adequate": return { bg: COLORS.greenLight, fg: COLORS.green };
    case "high": case "very_high": return { bg: COLORS.amberLight, fg: COLORS.amberDark };
    case "medium": return { bg: COLORS.blueLight, fg: COLORS.blue };
    default: return { bg: COLORS.borderLight, fg: COLORS.textSecondary };
  }
};

export default function SoilResultScreen() {
  const insets = useSafeAreaInsets();
  const { activeFarm } = useFarm();
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();

  const [test, setTest] = useState<SoilTestRecord | null>(null);
  const [plots, setPlots] = useState<PlotRecord[]>([]);
  const [allTests, setAllTests] = useState<SoilTestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // details form
  const [form, setForm] = useState({ sample_label: "", sample_date: "", lab_name: "", lab_reference: "", sample_depth: "" });
  const [plotId, setPlotId] = useState<string | null>(null);
  const [method, setMethod] = useState<SamplingMethod>("unknown");

  // result editing
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editRating, setEditRating] = useState<SoilRating | null>(null);
  const [adding, setAdding] = useState(edit === "1");
  const [addKey, setAddKey] = useState<string>("ph_water");
  const [addLabel, setAddLabel] = useState("");
  const [addValue, setAddValue] = useState("");
  const [addUnit, setAddUnit] = useState("");
  const [showAdvice, setShowAdvice] = useState(false);
  const [addingAdvice, setAddingAdvice] = useState(false);
  const [advCrop, setAdvCrop] = useState("");
  const [advAction, setAdvAction] = useState("");
  const [advRate, setAdvRate] = useState("");
  const [advTiming, setAdvTiming] = useState("");

  const hydrate = useCallback((t: SoilTestRecord) => {
    setTest(t);
    setForm({ sample_label: t.sample_label ?? "", sample_date: t.sample_date ?? "", lab_name: t.lab_name ?? "", lab_reference: t.lab_reference ?? "", sample_depth: t.sample_depth ?? "" });
    setPlotId(t.plot_id);
    setMethod(t.sampling_method);
  }, []);

  const load = useCallback(async () => {
    if (!id || !activeFarm?.id) return;
    try {
      setError(null);
      const [t, p, all] = await Promise.all([getSoilTest(id), listPlots(activeFarm.id), listSoilTests(activeFarm.id)]);
      if (!t) { setError("This soil test could not be found. It may have been deleted."); return; }
      hydrate(t);
      setPlots(p);
      setAllTests(all);
    } catch (e: any) {
      setError(e?.message || "Could not load this soil test.");
    } finally {
      setLoading(false);
    }
  }, [id, activeFarm?.id, hydrate]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const persist = async (updates: SoilTestEditable, okMessage?: string) => {
    if (!test) return false;
    try {
      const saved = await updateSoilTest(test.id, updates);
      hydrate(saved);
      setAllTests((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
      if (okMessage) Alert.alert("Saved", okMessage);
      return true;
    } catch (e: any) {
      Alert.alert("Could not save", e?.message || "Try again.");
      return false;
    }
  };

  const detailsDirty = !!test && (
    (form.sample_label.trim() || null) !== test.sample_label || (form.sample_date.trim() || null) !== test.sample_date ||
    (form.lab_name.trim() || null) !== test.lab_name || (form.lab_reference.trim() || null) !== test.lab_reference ||
    (form.sample_depth.trim() || null) !== test.sample_depth || plotId !== test.plot_id || method !== test.sampling_method
  );

  const saveDetails = async () => {
    let date: string | null = null;
    if (form.sample_date.trim()) {
      date = normalizeDate(form.sample_date);
      if (!date) { Alert.alert("Check the date", "Use year-month-day, for example 2025-12-04. It cannot be in the future."); return; }
    }
    await persist({
      sample_label: form.sample_label.trim() || null, sample_date: date, lab_name: form.lab_name.trim() || null,
      lab_reference: form.lab_reference.trim() || null, sample_depth: form.sample_depth.trim() || null, plot_id: plotId, sampling_method: method,
    });
  };

  const comparisons = useMemo(
    () => (test ? test.results.map((r) => compareWithPrevious(allTests, test, r)) : []),
    [test, allTests],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, { r: SoilResult; idx: number }[]>();
    (test?.results ?? []).forEach((r, idx) => {
      const g = groupForKey(r.key);
      map.set(g, [...(map.get(g) ?? []), { r, idx }]);
    });
    return SOIL_GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ group: g, rows: map.get(g)! }));
  }, [test]);

  const startEdit = (idx: number) => {
    const r = test!.results[idx];
    setEditIdx(idx);
    setEditValue(r.value !== null ? String(r.value) : r.text ?? "");
    setEditUnit(r.unit ?? "");
    setEditRating(r.rating);
  };

  const saveEdit = async () => {
    if (!test || editIdx === null) return;
    const old = test.results[editIdx];
    const next = normalizeResult({
      key: old.key, label_on_report: old.reported_label, value: editValue.trim(), unit: editUnit.trim() || null, method: old.method,
      rating: editRating ? SOIL_RATING_LABELS[editRating] : null, confidence: "high",
    });
    if (!next) { Alert.alert("Check the value", "Enter a number (or text such as <0.5). Use Remove to delete this row."); return; }
    next.edited = true;
    const results = test.results.map((r, i) => (i === editIdx ? next : r));
    if (await persist({ results })) setEditIdx(null);
  };

  const removeResult = (idx: number) => {
    Alert.alert("Remove this result?", test!.results[idx].label, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => { if (await persist({ results: test!.results.filter((_, i) => i !== idx) })) setEditIdx(null); } },
    ]);
  };

  const addResult = async () => {
    if (!test) return;
    const def = SOIL_PARAMETERS.find((p) => p.key === addKey);
    const label = addKey === "other" ? addLabel.trim() : def?.label ?? addKey;
    if (!label) { Alert.alert("Name needed", "Type the name of this test as it appears on the report."); return; }
    const next = normalizeResult({ key: addKey, label_on_report: label, value: addValue.trim(), unit: addUnit.trim() || null, confidence: "high" });
    if (!next) { Alert.alert("Check the value", "Enter a number (or text such as <0.5)."); return; }
    next.edited = true;
    if (await persist({ results: [...test.results, next] })) { setAdding(false); setAddValue(""); setAddUnit(""); setAddLabel(""); }
  };

  const addAdvice = async () => {
    if (!test) return;
    const action = advAction.trim();
    if (!action) { Alert.alert("Advice needed", "Describe what to apply, for example “Apply DAP at planting”."); return; }
    const item: RecommendationItem = { crop: advCrop.trim() || null, action, rate: advRate.trim() || null, timing: advTiming.trim() || null, source: "advisor" };
    if (await persist({ recommendation_items: [...test.recommendation_items, item] })) {
      setAddingAdvice(false); setAdvCrop(""); setAdvAction(""); setAdvRate(""); setAdvTiming("");
    }
  };

  const removeAdvice = (index: number) => {
    Alert.alert("Remove this advice?", test!.recommendation_items[index].action, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => { void persist({ recommendation_items: test!.recommendation_items.filter((_, i) => i !== index) }); } },
    ]);
  };

  const flaggedCount = (test?.results ?? []).filter((r) => r.flags.some((f) => f !== "unusual_unit")).length;
  const confirm = () => {
    if (!test) return;
    const go = async () => { setBusy("Confirming…"); try { hydrate(await confirmSoilTest(test.id)); } catch (e: any) { Alert.alert("Could not confirm", e?.message || "Try again."); } finally { setBusy(null); } };
    if (flaggedCount > 0) {
      Alert.alert("Some values are flagged", `${flaggedCount} value${flaggedCount === 1 ? " is" : "s are"} marked as unusual. Confirm only if they match the original report.`, [
        { text: "Keep checking", style: "cancel" }, { text: "Confirm anyway", onPress: go },
      ]);
    } else go();
  };

  const reread = async () => {
    if (!test || !activeFarm?.id) return;
    setBusy("Reading your report…");
    try {
      const out = await soilApi.reparse(activeFarm.id, test.id);
      if (out.read_ok) {
        if (out.saved.length > 1) Alert.alert(`${out.saved.length} samples found`, "The other samples were saved as separate soil tests. Find them in the Soil Tests list.");
        await load();
      } else {
        Alert.alert("Still couldn't read it", out.message || "Please try again later, or enter the values by hand.");
      }
    } catch (e: any) {
      Alert.alert("Could not read the report", e?.message || "Try again.");
    } finally {
      setBusy(null);
    }
  };

  const viewOriginal = async (path: string) => {
    if (!activeFarm?.id) return;
    try { await Linking.openURL(await soilApi.reportUrl(activeFarm.id, path)); }
    catch (e: any) { Alert.alert("Could not open the file", e?.message || "Try again."); }
  };

  const remove = () => {
    if (!test || !activeFarm?.id) return;
    Alert.alert("Delete this soil test?", "The values and the stored report file are removed. This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        setBusy("Deleting…");
        try { await soilApi.remove(activeFarm.id, test.id); router.replace("/soil"); }
        catch (e: any) { setBusy(null); Alert.alert("Could not delete", e?.message || "Try again."); }
      } },
    ]);
  };

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const header = (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="arrow-back" size={24} color={COLORS.text} /></Pressable>
      <Text style={styles.title}>Soil test</Text>
      <Pressable onPress={remove} hitSlop={12} disabled={!test}><Ionicons name="trash-outline" size={22} color={test ? COLORS.red : COLORS.textMuted} /></Pressable>
    </View>
  );

  if (loading || error || !test) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        {header}
        {loading ? <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} /> : <Text style={[styles.error, { margin: 16 }]}>{error}</Text>}
      </View>
    );
  }

  const unread = test.source !== "manual" && test.results.length === 0;
  const banner =
    unread ? { bg: COLORS.redLight, fg: COLORS.red, icon: "alert-circle-outline" as const, text: "The report is saved but its values have not been read yet." } :
    test.status === "confirmed" ? { bg: COLORS.greenLight, fg: COLORS.green, icon: "checkmark-circle-outline" as const, text: "Confirmed. These values are checked." } :
    test.status === "manual" ? { bg: COLORS.borderLight, fg: COLORS.textSecondary, icon: "create-outline" as const, text: "Entered by hand." } :
    test.status === "needs_review" ? { bg: COLORS.amberLight, fg: COLORS.amberDark, icon: "eye-outline" as const, text: "Read from the report. Some values need a check against the original." } :
    { bg: COLORS.blueLight, fg: COLORS.blue, icon: "information-circle-outline" as const, text: "Read automatically. Check against the original, then confirm." };

  const farmWide = test.plot_id === null;
  const adviceByCrop = test.recommendation_items.reduce<Record<string, { it: RecommendationItem; idx: number }[]>>((acc, it, idx) => {
    const k = it.crop || "All crops";
    (acc[k] = acc[k] ?? []).push({ it, idx });
    return acc;
  }, {});
  const adviceCrops = cropsForPlan(test.recommendation_items, test.intended_crops);

  return (
    <KeyboardAvoidingView style={[styles.container, { paddingTop: topPadding }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {header}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 120, gap: 14 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={[styles.banner, { backgroundColor: banner.bg }]}>
          <Ionicons name={banner.icon} size={20} color={banner.fg} />
          <Text style={[styles.bannerText, { color: banner.fg }]}>{banner.text}</Text>
        </View>
        {test.extraction_notes ? <Text style={styles.note}>{test.extraction_notes}</Text> : null}

        {unread && test.report_files.length > 0 ? (
          <Pressable style={styles.primaryBtn} onPress={reread} disabled={!!busy}>
            <Ionicons name="refresh" size={18} color={COLORS.white} /><Text style={styles.primaryBtnText}>Try reading the report again</Text>
          </Pressable>
        ) : null}

        {/* Details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Details</Text>
          <Text style={styles.label}>Applies to</Text>
          <View style={styles.chipWrap}>
            <Pressable onPress={() => setPlotId(null)} style={[styles.chip, plotId === null && styles.chipActive]}><Text style={[styles.chipText, plotId === null && styles.chipTextActive]}>Whole farm</Text></Pressable>
            {plots.filter((p) => !p.is_archived || p.id === plotId).map((p) => (
              <Pressable key={p.id} onPress={() => setPlotId(p.id)} style={[styles.chip, plotId === p.id && styles.chipActive]}><Text style={[styles.chipText, plotId === p.id && styles.chipTextActive]} numberOfLines={1}>{p.name}</Text></Pressable>
            ))}
          </View>
          <Field label="Sample name on report" value={form.sample_label} onChange={(v) => setForm({ ...form, sample_label: v })} placeholder="e.g. SAMPLE 1" />
          <Field label="Date sample was taken" value={form.sample_date} onChange={(v) => setForm({ ...form, sample_date: v })} placeholder="YYYY-MM-DD" />
          {!test.sample_date ? <Text style={styles.hint}>{test.received_date ? "The report only gives the date the lab received it. " : ""}Add the sampling date if you know it so results line up across seasons.</Text> : null}
          <Field label="Laboratory" value={form.lab_name} onChange={(v) => setForm({ ...form, lab_name: v })} placeholder="e.g. KALRO NARL" />
          <Field label="Lab number" value={form.lab_reference} onChange={(v) => setForm({ ...form, lab_reference: v })} placeholder="e.g. 18040" />
          <Field label="Sampling depth" value={form.sample_depth} onChange={(v) => setForm({ ...form, sample_depth: v })} placeholder="e.g. 0-20 cm" />
          <Text style={styles.label}>Sampling method</Text>
          <View style={styles.chipWrap}>
            {(Object.keys(SAMPLING_METHOD_LABELS) as SamplingMethod[]).map((m) => (
              <Pressable key={m} onPress={() => setMethod(m)} style={[styles.chip, method === m && styles.chipActive]}><Text style={[styles.chipText, method === m && styles.chipTextActive]}>{SAMPLING_METHOD_LABELS[m]}</Text></Pressable>
            ))}
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.meta}>Applies to: {farmWide ? "the whole farm (all seasons)" : `${plots.find((p) => p.id === test.plot_id)?.name ?? "a plot"} (all seasons)`}</Text>
            {test.received_date ? <Text style={styles.meta}>Lab received: {formatDate(test.received_date)}</Text> : null}
            {test.report_date ? <Text style={styles.meta}>Reported: {formatDate(test.report_date)}</Text> : null}
            {test.location_on_report ? <Text style={styles.meta}>Location on report: {test.location_on_report}</Text> : null}
            {test.intended_crops.length > 0 ? <Text style={styles.meta}>Crops on report: {test.intended_crops.join(", ")}</Text> : null}
          </View>
          {detailsDirty ? <Pressable style={styles.saveBtn} onPress={saveDetails}><Text style={styles.saveText}>Save details</Text></Pressable> : null}
        </View>

        {/* Results */}
        <View style={styles.cardPlain}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Results</Text>
            <Pressable onPress={() => setAdding((v) => !v)} hitSlop={8}><Text style={styles.link}>{adding ? "Cancel" : "+ Add result"}</Text></Pressable>
          </View>
          <Text style={styles.hint}>Values are shown exactly as the lab printed them, in the lab’s units. Tap a row to correct it. “Since” compares with the previous test on the same {farmWide ? "farm-wide sample" : "plot"}.</Text>

          {adding ? (
            <View style={styles.editPanel}>
              <Text style={styles.label}>Test</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
                {[...SOIL_PARAMETERS.filter((p) => p.key !== "texture_class").map((p) => ({ key: p.key, label: p.label, units: p.units })), { key: "other", label: "Other…", units: [] as string[] }].map((p) => (
                  <Pressable key={p.key} onPress={() => { setAddKey(p.key); setAddUnit(p.units.find((u) => u) ?? ""); }} style={[styles.chip, addKey === p.key && styles.chipActive]}>
                    <Text style={[styles.chipText, addKey === p.key && styles.chipTextActive]}>{p.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              {addKey === "other" ? <Field label="Name as printed on the report" value={addLabel} onChange={setAddLabel} placeholder="e.g. Lime requirement" /> : null}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}><Field label="Value" value={addValue} onChange={setAddValue} placeholder="e.g. 5.2" keyboard="decimal-pad" /></View>
                <View style={{ flex: 1 }}><Field label="Unit as printed" value={addUnit} onChange={setAddUnit} placeholder="e.g. ppm" /></View>
              </View>
              <Pressable style={styles.saveBtn} onPress={addResult}><Text style={styles.saveText}>Add result</Text></Pressable>
            </View>
          ) : null}

          {test.results.length === 0 && !adding ? <Text style={styles.emptyText}>No results yet. {unread ? "Try reading the report again, or add them by hand." : "Add the values from your lab report."}</Text> : null}

          {grouped.map(({ group, rows }) => (
            <View key={group} style={{ gap: 6 }}>
              <Text style={styles.groupTitle}>{SOIL_GROUP_LABELS[group]}</Text>
              {rows.map(({ r, idx }) => {
                const cmp = comparisons[idx];
                const col = ratingColors(r);
                const rating = r.rating_text ?? (r.rating ? SOIL_RATING_LABELS[r.rating] : null);
                const needsCheck = r.flags.some((f) => f !== "unusual_unit");
                return (
                  <View key={`${r.key}-${idx}`}>
                    <Pressable style={[styles.resultRow, needsCheck && styles.resultRowFlag]} onPress={() => (editIdx === idx ? setEditIdx(null) : startEdit(idx))}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultLabel}>{r.label}{r.method ? ` (${r.method})` : ""}</Text>
                        {cmp.previous ? (
                          <Text style={styles.resultSub}>
                            {cmp.change !== null ? `${cmp.change > 0 ? "▲ +" : cmp.change < 0 ? "▼ " : "= "}${Math.round(cmp.change * 1000) / 1000} since ${formatDate(cmp.previous.date)}` : `Previously ${cmp.previous.value} ${cmp.previous.unit ?? ""} (${formatDate(cmp.previous.date)}) – different unit`}
                          </Text>
                        ) : null}
                        {r.flags.map((f) => (
                          <Text key={f} style={[styles.flagText, f === "unusual_unit" && { color: COLORS.textSecondary }]}>{f === "unusual_unit" ? "ⓘ" : "⚠"} {describeFlag(f)}</Text>
                        ))}
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 4 }}>
                        <Text style={styles.resultValue}>{formatResultValue(r)}{r.value === null && r.unit ? ` ${r.unit}` : ""}</Text>
                        {rating ? <View style={[styles.badge, { backgroundColor: col.bg }]}><Text style={[styles.badgeText, { color: col.fg }]}>{rating}</Text></View> : null}
                      </View>
                    </Pressable>
                    {editIdx === idx ? (
                      <View style={styles.editPanel}>
                        <View style={{ flexDirection: "row", gap: 10 }}>
                          <View style={{ flex: 1 }}><Field label="Value" value={editValue} onChange={setEditValue} keyboard="decimal-pad" /></View>
                          <View style={{ flex: 1 }}><Field label="Unit" value={editUnit} onChange={setEditUnit} /></View>
                        </View>
                        <Text style={styles.label}>Lab’s rating</Text>
                        <View style={styles.chipWrap}>
                          <Pressable onPress={() => setEditRating(null)} style={[styles.chip, editRating === null && styles.chipActive]}><Text style={[styles.chipText, editRating === null && styles.chipTextActive]}>None</Text></Pressable>
                          {SOIL_RATINGS.map((x) => (
                            <Pressable key={x} onPress={() => setEditRating(x)} style={[styles.chip, editRating === x && styles.chipActive]}><Text style={[styles.chipText, editRating === x && styles.chipTextActive]}>{SOIL_RATING_LABELS[x]}</Text></Pressable>
                          ))}
                        </View>
                        <View style={{ flexDirection: "row", gap: 10 }}>
                          <Pressable style={[styles.saveBtn, { flex: 1 }]} onPress={saveEdit}><Text style={styles.saveText}>Save</Text></Pressable>
                          <Pressable style={styles.removeBtn} onPress={() => removeResult(idx)}><Text style={styles.removeText}>Remove</Text></Pressable>
                        </View>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {/* Recommendations: the lab's written advice, plus any advice an advisor adds */}
        {test.results.length > 0 || test.recommendation_items.length > 0 || test.recommendations ? (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>Recommendations</Text>
              <Pressable onPress={() => setAddingAdvice((v) => !v)} hitSlop={8}><Text style={styles.link}>{addingAdvice ? "Cancel" : "+ Add advice"}</Text></Pressable>
            </View>
            <Text style={styles.hint}>The lab’s advice is copied from the report by the reader, so check amounts against the original. Advice you add is marked “Added by you”.</Text>

            {addingAdvice ? (
              <View style={styles.editPanel}>
                <Text style={styles.label}>Crop (leave empty for all crops)</Text>
                {adviceCrops.length > 0 ? (
                  <View style={styles.chipWrap}>
                    {adviceCrops.map((c) => (
                      <Pressable key={c} onPress={() => setAdvCrop(c)} style={[styles.chip, advCrop === c && styles.chipActive]}><Text style={[styles.chipText, advCrop === c && styles.chipTextActive]}>{c}</Text></Pressable>
                    ))}
                  </View>
                ) : null}
                <Field label="Crop name" value={advCrop} onChange={setAdvCrop} placeholder="e.g. Potato" />
                <Field label="What to apply" value={advAction} onChange={setAdvAction} placeholder="e.g. Apply DAP at planting" />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}><Field label="Rate" value={advRate} onChange={setAdvRate} placeholder="e.g. 100kg/acre" /></View>
                  <View style={{ flex: 1 }}><Field label="When" value={advTiming} onChange={setAdvTiming} placeholder="e.g. at planting" /></View>
                </View>
                <Text style={styles.hint}>Write the rate with its basis (per acre, per plant…) so it can be scaled to the plot.</Text>
                <Pressable style={styles.saveBtn} onPress={addAdvice}><Text style={styles.saveText}>Add advice</Text></Pressable>
              </View>
            ) : null}

            {Object.entries(adviceByCrop).map(([crop, entries]) => (
              <View key={crop} style={{ gap: 4 }}>
                <Text style={styles.groupTitle}>{crop}</Text>
                {entries.map(({ it, idx }) => (
                  <View key={idx} style={styles.adviceRow}>
                    <Text style={[styles.adviceLine, { flex: 1 }]}>
                      • {it.action}{it.rate ? ` – ${it.rate}` : ""}{it.timing ? ` (${it.timing})` : ""}{it.source === "advisor" ? "  · Added by you" : ""}
                    </Text>
                    {it.source === "advisor" ? (
                      <Pressable onPress={() => removeAdvice(idx)} hitSlop={8}><Ionicons name="close-circle-outline" size={18} color={COLORS.textMuted} /></Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            ))}

            {test.recommendations ? (
              <>
                <Pressable onPress={() => setShowAdvice((v) => !v)}><Text style={styles.link}>{showAdvice ? "Hide" : "Show"} the lab’s full wording</Text></Pressable>
                {showAdvice ? <Text style={styles.adviceFull}>{test.recommendations}</Text> : null}
              </>
            ) : null}

            {test.recommendation_items.length > 0 ? (
              <Pressable style={styles.primaryBtn} onPress={() => router.push({ pathname: "/soil-plan", params: { id: test.id } })}>
                <Ionicons name="leaf-outline" size={18} color={COLORS.white} /><Text style={styles.primaryBtnText}>Open fertilizer plan</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Original */}
        {test.report_files.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Original report</Text>
            {test.report_files.map((f, i) => (
              <Pressable key={f.path} style={styles.fileRow} onPress={() => viewOriginal(f.path)}>
                <Ionicons name={f.media_type === "application/pdf" ? "document-text-outline" : "image-outline"} size={20} color={COLORS.primary} />
                <Text style={styles.fileName} numberOfLines={1}>{f.name || `Page ${i + 1}`}</Text>
                <Ionicons name="open-outline" size={16} color={COLORS.textMuted} />
              </Pressable>
            ))}
          </View>
        ) : null}

        {test.status !== "confirmed" && test.status !== "manual" && test.results.length > 0 ? (
          <Pressable style={styles.confirmBtn} onPress={confirm} disabled={!!busy}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.white} /><Text style={styles.confirmText}>I’ve checked these values – confirm</Text>
          </Pressable>
        ) : null}
        <Text style={styles.footer}>Recorded {formatDate(test.created_at.slice(0, 10))} · counts for {formatDate(testDate(test))} · stays with {farmWide ? "the farm" : "this plot"} across seasons</Text>
      </ScrollView>

      {busy ? <View style={styles.busy}><ActivityIndicator color={COLORS.white} /><Text style={styles.busyText}>{busy}</Text></View> : null}
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChange, placeholder, keyboard }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; keyboard?: "decimal-pad" }) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={COLORS.textMuted} keyboardType={keyboard} autoCapitalize="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontFamily: "Manrope_700Bold", fontSize: 18, color: COLORS.text },
  error: {
    fontFamily: "Manrope_500Medium",
    fontSize: 14,
    color: COLORS.red,
  },
  banner: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, padding: 12 },
  bannerText: {
    flex: 1,
    fontFamily: "Manrope_600SemiBold",
    fontSize: 14,
    lineHeight: 18,
  },
  note: {
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 14,
    gap: 10,
    ...CARD_SHADOW,
  },
  cardPlain: { gap: 10 },
  cardTitle: {
    fontFamily: "Manrope_700Bold",
    fontSize: 17,
    color: COLORS.text,
  },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  link: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 14,
    color: COLORS.primary,
  },
  label: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 13,
    color: COLORS.text,
    marginBottom: 4,
  },
  hint: {
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: "Manrope_400Regular",
    fontSize: 15,
    color: COLORS.text,
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, maxWidth: 200 },
  chipActive: {
    backgroundColor: COLORS.ink,
    borderColor: COLORS.ink,
  },
  chipText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  chipTextActive: { color: COLORS.white },
  metaBlock: { gap: 2 },
  meta: {
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  groupTitle: {
    fontFamily: "Manrope_700Bold",
    fontSize: 13,
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 4,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 12,
    ...CARD_SHADOW,
  },
  resultRowFlag: { borderColor: COLORS.amber, backgroundColor: COLORS.amberLight },
  resultLabel: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 15,
    color: COLORS.text,
  },
  resultSub: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  flagText: {
    fontFamily: "Manrope_500Medium",
    fontSize: 12,
    color: COLORS.amberDark,
    marginTop: 3,
  },
  resultValue: {
    fontFamily: "Manrope_700Bold",
    fontSize: 16,
    color: COLORS.text,
  },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 12,
  },
  editPanel: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 12,
    gap: 10,
    marginTop: 6,
    ...CARD_SHADOW,
  },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 11, alignItems: "center" },
  saveText: {
    fontFamily: "Manrope_700Bold",
    fontSize: 15,
    color: COLORS.white,
  },
  removeBtn: { borderRadius: 10, paddingVertical: 11, paddingHorizontal: 16, borderWidth: 1, borderColor: COLORS.red, alignItems: "center" },
  removeText: {
    fontFamily: "Manrope_700Bold",
    fontSize: 15,
    color: COLORS.red,
  },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 13 },
  primaryBtnText: {
    fontFamily: "Manrope_700Bold",
    fontSize: 15,
    color: COLORS.white,
  },
  emptyText: {
    fontFamily: "Manrope_400Regular",
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  adviceRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  adviceLine: {
    fontFamily: "Manrope_400Regular",
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 19,
  },
  adviceFull: {
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 10,
  },
  fileRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  fileName: {
    flex: 1,
    fontFamily: "Manrope_500Medium",
    fontSize: 14,
    color: COLORS.text,
  },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.green, borderRadius: 14, paddingVertical: 15 },
  confirmText: {
    fontFamily: "Manrope_700Bold",
    fontSize: 16,
    color: COLORS.white,
  },
  footer: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: "center",
  },
  busy: { position: "absolute", left: 0, right: 0, bottom: 0, top: 0, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", gap: 10 },
  busyText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 15,
    color: COLORS.white,
  }});
