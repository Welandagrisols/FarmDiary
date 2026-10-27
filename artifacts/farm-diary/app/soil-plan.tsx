import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import COLORS, { CARD_SHADOW } from "@/constants/colors";
import { useFarm } from "@/context/FarmContext";
import { getSoilTest, listPlots } from "@/lib/soil-storage";
import {
  ACRES_PER_HECTARE, NUTRIENT_LABELS, NUTRIENTS, SWAP_CANDIDATES, buildPlanLines, buildPlanText, cropsForPlan, elementalK, elementalP,
  flaggedByLab, formatQuantity, planTotals, solveSubstitute, totalKgByProduct, type PlanLine,
} from "@/lib/fertilizer";
import type { PlotRecord, SoilTestRecord } from "@/lib/soil";
import { formatDate, formatKES } from "@/lib/storage";

const num = (v: string): number | null => {
  const n = Number(v.replace(",", ".").trim());
  return v.trim() && Number.isFinite(n) && n > 0 ? n : null;
};
const round1 = (n: number) => Math.round(n * 10) / 10;

export default function SoilPlanScreen() {
  const insets = useSafeAreaInsets();
  const { activeFarm, inventory } = useFarm();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [test, setTest] = useState<SoilTestRecord | null>(null);
  const [plot, setPlot] = useState<PlotRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [crop, setCrop] = useState<string | null>(null);
  const [area, setArea] = useState("");
  const [count, setCount] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [swapIdx, setSwapIdx] = useState<number | null>(null);
  const [swapWith, setSwapWith] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!id || !activeFarm?.id) return;
    try {
      setError(null);
      const [t, plots] = await Promise.all([getSoilTest(id), listPlots(activeFarm.id)]);
      if (!t) { setError("This soil test could not be found."); return; }
      const p = plots.find((x) => x.id === t.plot_id) ?? null;
      setTest(t);
      setPlot(p);
      const acres = p?.area_acres ?? (t.plot_id ? null : activeFarm.total_acres ?? null);
      setArea((prev) => prev || (acres ? String(acres) : ""));
      const crops = cropsForPlan(t.recommendation_items, t.intended_crops);
      setCrop((prev) => prev ?? crops[0] ?? null);
    } catch (e: any) {
      setError(e?.message || "Could not load this soil test.");
    } finally {
      setLoading(false);
    }
  }, [id, activeFarm?.id, activeFarm?.total_acres]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const areaAcres = num(area);
  const plantCount = num(count);
  const crops = useMemo(() => (test ? cropsForPlan(test.recommendation_items, test.intended_crops) : []), [test]);
  const lines = useMemo(
    () => (test && crop ? buildPlanLines(test.recommendation_items, crop, { areaAcres, count: plantCount }) : []),
    [test, crop, areaAcres, plantCount],
  );
  const totals = useMemo(() => planTotals(lines, areaAcres), [lines, areaAcres]);
  const products = useMemo(() => totalKgByProduct(lines), [lines]);
  const flagged = useMemo(() => (test ? flaggedByLab(test.results) : []), [test]);
  const needsCount = lines.some((l) => l.rate && ["plant", "tree", "hole"].includes(l.rate.basis ?? ""));

  const priceFor = (label: string): string => {
    if (prices[label] !== undefined) return prices[label];
    const stock = inventory.find((i) => i.product_name.trim().toLowerCase() === label.toLowerCase() && i.unit.trim().toLowerCase() === "kg" && i.unit_price_kes > 0);
    return stock ? String(stock.unit_price_kes) : "";
  };
  const estimate = products.reduce((sum, p) => sum + p.kg * (num(priceFor(p.label)) ?? 0), 0);
  const anyPrice = products.some((p) => num(priceFor(p.label)) !== null);

  const share = () => {
    if (!test || !crop) return;
    void Share.share({
      message: buildPlanText({
        farmName: activeFarm?.name ?? "Farm",
        plotName: plot?.name ?? "Whole farm",
        crop, areaAcres, count: plantCount,
        lab: test.lab_name, labNumber: test.lab_reference,
        sampleDate: test.sample_date ?? test.received_date ?? test.report_date,
        lines, totals, flagged: flagged.map((f) => ({ label: f.label, word: f.word })),
      }),
    });
  };

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const header = (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="arrow-back" size={24} color={COLORS.text} /></Pressable>
      <Text style={styles.title}>Fertilizer plan</Text>
      <Pressable onPress={share} hitSlop={12} disabled={!crop || lines.length === 0}>
        <Ionicons name="share-outline" size={22} color={crop && lines.length > 0 ? COLORS.primary : COLORS.textMuted} />
      </Pressable>
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

  const renderLine = (l: PlanLine, idx: number) => {
    const supply = l.supply;
    const swapOpen = swapIdx === idx;
    const swap = swapOpen && supply && swapWith.length > 0
      ? solveSubstitute(supply, SWAP_CANDIDATES.filter((c) => swapWith.includes(c.label)))
      : null;
    return (
      <View key={idx} style={styles.lineCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.lineAction}>{l.item.action}</Text>
          {l.item.source === "advisor" ? <View style={styles.badge}><Text style={styles.badgeText}>Added by you</Text></View> : null}
        </View>
        <Text style={styles.lineRate}>
          {l.item.rate ? `As written: ${l.item.rate}` : "No rate written"}{l.item.timing ? ` · ${l.item.timing}` : ""}
        </Text>
        {l.scaled?.ok ? (
          <Text style={styles.lineTotal}>For this {l.scaled.basis === "area" ? "area" : "number of plants"}: about {formatQuantity(l.scaled.amount, l.scaled.unit)}</Text>
        ) : l.scaled ? (
          <Text style={styles.lineNote}>{l.scaled.reason}</Text>
        ) : (
          <Text style={styles.lineNote}>The rate could not be read as an amount. Follow the wording above.</Text>
        )}
        {l.rate?.basisFromAdvice ? <Text style={styles.lineNote}>“Per {l.rate.basis}” was taken from the wording of the advice.</Text> : null}
        {l.product?.grade ? (
          <Text style={styles.lineNote}>
            {l.product.label}: {l.product.grade.n}-{l.product.grade.p2o5}-{l.product.grade.k2o} (N-P₂O₅-K₂O)
            {l.product.gradeSource === "standard" ? " – typical grade, check your bag" : " – grade written in the advice"}
          </Text>
        ) : null}
        {supply ? (
          <Text style={styles.lineSupply}>Supplies {NUTRIENTS.filter((k) => supply[k] > 0).map((k) => `${NUTRIENT_LABELS[k]} ${round1(supply[k])} kg`).join(" · ")}</Text>
        ) : null}
        {supply ? (
          <Pressable onPress={() => { setSwapIdx(swapOpen ? null : idx); setSwapWith([]); }} hitSlop={6}>
            <Text style={styles.link}>{swapOpen ? "Hide substitutes" : "Can't get this? Find a substitute"}</Text>
          </Pressable>
        ) : null}
        {swapOpen && supply ? (
          <View style={styles.swapBox}>
            <Text style={styles.hint}>What do you have? Pick one or two.</Text>
            <View style={styles.chipWrap}>
              {SWAP_CANDIDATES.map((c) => {
                const on = swapWith.includes(c.label);
                return (
                  <Pressable key={c.label} onPress={() => setSwapWith((cur) => (on ? cur.filter((x) => x !== c.label) : cur.length >= 2 ? [cur[1], c.label] : [...cur, c.label]))} style={[styles.chip, on && styles.chipActive]}>
                    <Text style={[styles.chipText, on && styles.chipTextActive]}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {swap ? (
              <View style={{ gap: 4 }}>
                <Text style={styles.lineTotal}>{swap.amounts.map((a) => `${formatQuantity(a.kg, "kg")} ${a.label}`).join(" + ")}</Text>
                <Text style={styles.lineNote}>
                  {swap.exact
                    ? "Delivers the same nutrients as the recommended fertilizer."
                    : `Delivers ${NUTRIENTS.filter((k) => swap.coverage[k] !== undefined).map((k) => `${Math.round((swap.coverage[k] ?? 0) * 100)}% of the ${NUTRIENT_LABELS[k]}`).join(", ")}. It cannot match every nutrient with what you picked.`}
                </Text>
              </View>
            ) : swapWith.length > 0 ? <Text style={styles.lineNote}>None of these supplies the nutrients in this advice.</Text> : null}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { paddingTop: topPadding }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {header}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100, gap: 14 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.amberDark} />
          <Text style={styles.noticeText}>
            These amounts are the lab’s advice (or advice added by an advisor) scaled to your area. The app does not make up its own recommendations. Check rates and products with a local agronomist before applying.
          </Text>
        </View>

        <Text style={styles.meta}>
          Soil test: {test.lab_name ?? "lab report"}{test.lab_reference ? ` no. ${test.lab_reference}` : ""} · {formatDate(test.sample_date ?? test.received_date ?? test.report_date ?? test.created_at.slice(0, 10))} · {plot?.name ?? "Whole farm"}
        </Text>

        {flagged.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Marked by the lab</Text>
            <View style={styles.chipWrap}>
              {flagged.map((f, i) => (
                <View key={i} style={styles.flagChip}><Text style={styles.flagText}>{f.label}: {f.word}</Text></View>
              ))}
            </View>
          </View>
        ) : null}

        {crops.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="leaf-outline" size={34} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>No advice to plan from yet</Text>
            <Text style={styles.emptyText}>This test has no written recommendation. Open the test and tap “Add advice” to enter the recommendation for a crop, then come back here.</Text>
          </View>
        ) : (
          <>
            <View>
              <Text style={styles.label}>Crop</Text>
              <View style={styles.chipWrap}>
                {crops.map((c) => (
                  <Pressable key={c} onPress={() => setCrop(c)} style={[styles.chip, crop === c && styles.chipActive]}>
                    <Text style={[styles.chipText, crop === c && styles.chipTextActive]}>{c}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Area to apply on (acres)</Text>
              <TextInput style={styles.input} value={area} onChangeText={setArea} keyboardType="decimal-pad" placeholder="e.g. 1.5" placeholderTextColor={COLORS.textMuted} />
              {areaAcres ? <Text style={styles.hint}>= {round1(areaAcres / ACRES_PER_HECTARE * 100) / 100} hectares</Text> : <Text style={styles.hint}>Needed to scale rates given per acre.</Text>}
              {needsCount ? (
                <>
                  <Text style={[styles.label, { marginTop: 8 }]}>Number of plants, trees or holes</Text>
                  <TextInput style={styles.input} value={count} onChangeText={setCount} keyboardType="number-pad" placeholder="e.g. 2000" placeholderTextColor={COLORS.textMuted} />
                  <Text style={styles.hint}>Needed to scale rates given per plant, tree or hole.</Text>
                </>
              ) : null}
            </View>

            <Text style={styles.sectionTitle}>What to apply</Text>
            {lines.length === 0 ? <Text style={styles.hint}>No advice in this test applies to {crop}.</Text> : lines.map(renderLine)}

            {lines.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Nutrients this plan supplies</Text>
                {totals.counted === 0 ? (
                  <Text style={styles.hint}>No line has both a known fertilizer grade and a quantity that could be worked out yet.</Text>
                ) : (
                  <>
                    {NUTRIENTS.map((k) => (
                      <View key={k} style={styles.rowBetween}>
                        <Text style={styles.lineRate}>{NUTRIENT_LABELS[k]}{k === "p2o5" ? " (P)" : k === "k2o" ? " (K)" : ""}</Text>
                        <Text style={styles.lineAction}>
                          {round1(totals.plot[k])} kg{totals.perAcre ? ` · ${round1(totals.perAcre[k])} kg/acre` : ""}
                          {k === "p2o5" && totals.plot.p2o5 > 0 ? ` · P ${round1(elementalP(totals.plot.p2o5))} kg` : ""}
                          {k === "k2o" && totals.plot.k2o > 0 ? ` · K ${round1(elementalK(totals.plot.k2o))} kg` : ""}
                        </Text>
                      </View>
                    ))}
                    <Text style={styles.hint}>Counts fertilizer lines only (not lime or manure).{totals.skipped > 0 ? ` ${totals.skipped} fertilizer line${totals.skipped === 1 ? "" : "s"} could not be worked out and ${totals.skipped === 1 ? "is" : "are"} left out.` : ""}</Text>
                  </>
                )}
              </View>
            ) : null}

            {products.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Estimated cost</Text>
                <Text style={styles.hint}>Type today’s price per kg for each product.</Text>
                {products.map((p) => (
                  <View key={p.label} style={styles.priceRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.lineAction}>{p.label}</Text>
                      <Text style={styles.lineRate}>{formatQuantity(p.kg, "kg")}</Text>
                    </View>
                    <TextInput style={[styles.input, { width: 90 }]} value={priceFor(p.label)} onChangeText={(v) => setPrices((cur) => ({ ...cur, [p.label]: v }))} keyboardType="decimal-pad" placeholder="KES/kg" placeholderTextColor={COLORS.textMuted} />
                    <Text style={[styles.lineAction, { width: 90, textAlign: "right" }]}>{num(priceFor(p.label)) ? formatKES(p.kg * (num(priceFor(p.label)) as number)) : "—"}</Text>
                  </View>
                ))}
                {anyPrice ? <View style={styles.rowBetween}><Text style={styles.cardTitle}>Total</Text><Text style={styles.cardTitle}>{formatKES(estimate)}</Text></View> : null}
                <Text style={styles.hint}>Only products measured in weight are costed (not handfuls or litres).</Text>
              </View>
            ) : null}

            <Pressable style={[styles.shareBtn, lines.length === 0 && { opacity: 0.5 }]} onPress={share} disabled={lines.length === 0}>
              <Ionicons name="share-social-outline" size={18} color={COLORS.white} />
              <Text style={styles.shareText}>Share this plan</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
  notice: { flexDirection: "row", gap: 8, backgroundColor: COLORS.amberLight, borderRadius: 12, padding: 12 },
  noticeText: {
    flex: 1,
    fontFamily: "Manrope_500Medium",
    fontSize: 13,
    color: COLORS.amberDark,
    lineHeight: 17,
  },
  meta: {
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 14,
    gap: 8,
    ...CARD_SHADOW,
  },
  cardTitle: {
    fontFamily: "Manrope_700Bold",
    fontSize: 16,
    color: COLORS.text,
  },
  sectionTitle: {
    fontFamily: "Manrope_700Bold",
    fontSize: 17,
    color: COLORS.text,
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
    lineHeight: 17,
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
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.border },
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
  flagChip: { backgroundColor: COLORS.amberLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  flagText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 13,
    color: COLORS.amberDark,
  },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  lineCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 14,
    gap: 5,
    ...CARD_SHADOW,
  },
  lineAction: {
    flexShrink: 1,
    fontFamily: "Manrope_700Bold",
    fontSize: 15,
    color: COLORS.text,
  },
  lineRate: {
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  lineTotal: {
    fontFamily: "Manrope_700Bold",
    fontSize: 15,
    color: COLORS.primary,
  },
  lineNote: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  lineSupply: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 13,
    color: COLORS.text,
  },
  link: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 14,
    color: COLORS.primary,
    marginTop: 2,
  },
  swapBox: { backgroundColor: COLORS.background, borderRadius: 10, padding: 10, gap: 8, marginTop: 4 },
  badge: { backgroundColor: COLORS.primarySurface, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 12,
    color: COLORS.primary,
  },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 8 },
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
  shareBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14 },
  shareText: {
    fontFamily: "Manrope_700Bold",
    fontSize: 16,
    color: COLORS.white,
  }});
