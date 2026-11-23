import React, { useCallback, useState } from "react";
import {
  ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import COLORS, { CARD_SHADOW } from "@/constants/colors";
import { useFarm } from "@/context/FarmContext";
import { getFarmRole, getSales, type FarmRole, type SaleRecord } from "@/lib/sales-storage";
import { createCommitment, deleteCommitment, listCommitments } from "@/lib/commitment-storage";
import {
  commitmentProgress, validateCommitment, type BuyerCommitment, type CommitmentInput,
} from "@/lib/buyer-commitments";
import { getSeasonBlocks } from "@/lib/storage";
import { blockCropTemplate, seasonTemplateIds } from "@/lib/season-crops";
import { getTemplate } from "@/constants/farmData";

const todayKey = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const kg = (value: number) => `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`;
const EMPTY: CommitmentInput = {
  buyer_name: "", product_name: "", weekly_kg: "", agreed_price_kes: "", start_date: "", end_date: "",
};

const STATUS = {
  met: { label: "Met this week", bg: COLORS.primarySurface, color: COLORS.primary },
  booked: { label: "Booked pending review", bg: COLORS.amberLight, color: COLORS.amberDark },
  open: { label: "In progress", bg: COLORS.amberLight, color: COLORS.amber },
  not_started: { label: "Not started", bg: COLORS.background, color: COLORS.textSecondary },
  ended: { label: "Ended", bg: COLORS.background, color: COLORS.textSecondary },
} as const;

export default function BuyerCommitmentsScreen() {
  const insets = useSafeAreaInsets();
  const { activeFarm, activeSeason } = useFarm();
  const [commitments, setCommitments] = useState<BuyerCommitment[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [role, setRole] = useState<FarmRole>("none");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CommitmentInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  const farmId = activeFarm?.id;
  const seasonId = activeSeason?.id;
  const canManage = ["admin", "owner", "manager"].includes(role);
  const topPadding = Platform.OS === "web" ? 58 : insets.top + 8;

  const load = useCallback(async () => {
    if (!farmId) {
      setCommitments([]);
      setSales([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [list, farmRole, seasonSales] = await Promise.all([
        listCommitments(farmId),
        getFarmRole(farmId),
        seasonId ? getSales(farmId, seasonId) : Promise.resolve([] as SaleRecord[]),
      ]);
      setCommitments(list);
      setRole(farmRole);
      setSales(seasonSales);
    } catch (cause) {
      setCommitments([]);
      setSales([]);
      setError(cause instanceof Error ? cause.message : "Could not load buyer commitments.");
    } finally {
      setLoading(false);
    }
  }, [farmId, seasonId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const blocks = getSeasonBlocks(activeSeason);
  const cropOfBlock = (blockId: string) => {
    const block = blocks.find((item) => item.id === blockId);
    return block ? blockCropTemplate(activeSeason, block).cropType : null;
  };
  const cropChoices = [...new Set(seasonTemplateIds(activeSeason).map((id) => getTemplate(id).cropType))];
  const visible = commitments.filter((item) => !item.season_id || item.season_id === seasonId);
  const today = todayKey();
  const update = (field: keyof CommitmentInput, value: string) =>
    setForm((previous) => ({ ...previous, [field]: value }));

  const handleSave = async () => {
    const problem = validateCommitment(form);
    if (problem) { Alert.alert("Check the details", problem); return; }
    if (!farmId) return;
    setSaving(true);
    try {
      const created = await createCommitment({
        farm_id: farmId,
        season_id: seasonId ?? null,
        buyer_name: form.buyer_name,
        product_name: form.product_name,
        weekly_kg: Number(form.weekly_kg.replace(",", ".")),
        agreed_price_kes: form.agreed_price_kes.trim() ? Number(form.agreed_price_kes.replace(",", ".")) : null,
        start_date: form.start_date.trim() || null,
        end_date: form.end_date.trim() || null,
        notes: null,
      });
      setCommitments((previous) => [...previous, created]);
      setForm(EMPTY);
      setShowForm(false);
    } catch (cause) {
      Alert.alert("Could not save", cause instanceof Error ? cause.message : "Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (commitment: BuyerCommitment) => {
    Alert.alert("Remove commitment?", `${commitment.buyer_name} · ${commitment.product_name}. Sales already recorded are not affected.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteCommitment(commitment.id);
            setCommitments((previous) => previous.filter((item) => item.id !== commitment.id));
          } catch (cause) {
            Alert.alert("Could not remove", cause instanceof Error ? cause.message : "Try again.");
          }
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: topPadding, paddingBottom: insets.bottom + 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Buyer commitments</Text>
          <Text style={styles.subtitle}>Agreed weekly volume vs what was sold</Text>
        </View>
      </View>

      {loading ? <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} /> : null}
      {error ? (
        <View style={styles.notice}>
          <Ionicons name="alert-circle-outline" size={16} color={COLORS.red} />
          <Text style={styles.noticeText}>{error}</Text>
        </View>
      ) : null}

      {!loading && !error && visible.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={32} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>No commitments yet</Text>
          <Text style={styles.emptyText}>Record who agreed to buy how much each week before harvest.</Text>
        </View>
      ) : null}

      {visible.map((commitment) => {
        const progress = commitmentProgress(commitment, sales, today, cropOfBlock);
        const chip = STATUS[progress.status];
        const soldPct = progress.expectedKg > 0
          ? Math.min(100, (progress.soldKg / progress.expectedKg) * 100)
          : 0;
        const bookedPct = progress.expectedKg > 0
          ? Math.min(100 - soldPct, (progress.bookedKg / progress.expectedKg) * 100)
          : 0;
        return (
          <View key={commitment.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{commitment.buyer_name}</Text>
                <Text style={styles.cardSub}>
                  {commitment.product_name} · {kg(commitment.weekly_kg)} per week
                  {commitment.agreed_price_kes != null ? ` · KES ${commitment.agreed_price_kes.toLocaleString()}/kg` : ""}
                </Text>
              </View>
              <View style={[styles.chip, { backgroundColor: chip.bg }]}>
                <Text style={[styles.chipText, { color: chip.color }]}>{chip.label}</Text>
              </View>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${soldPct}%` }]} />
              {bookedPct > 0 ? <View style={[styles.bookedFill, { width: `${bookedPct}%` }]} /> : null}
            </View>
            <Text style={styles.progressText}>
              This week: {kg(progress.soldKg)} sold · {kg(progress.bookedKg)} booked
              {progress.remainingKg > 0 ? ` · ${kg(progress.remainingKg)} still open` : progress.extraKg > 0 ? ` · ${kg(progress.extraKg)} over target` : ""}
            </Text>
            <Text style={styles.progressMeta}>
              Last week: {kg(progress.lastWeekSoldKg)} sold · {kg(progress.lastWeekBookedKg)} booked
              {commitment.start_date || commitment.end_date ? ` · ${commitment.start_date ?? "…"} to ${commitment.end_date ?? "open"}` : ""}
            </Text>
            {canManage ? (
              <Pressable
                onPress={() => handleDelete(commitment)}
                style={styles.removeBtn}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${commitment.buyer_name} commitment`}
              >
                <Ionicons name="trash-outline" size={15} color={COLORS.red} />
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}

      {visible.length > 0 ? (
        <Text style={styles.footnote}>Sales awaiting manager review count as booked; approved sales count as sold. Voided sales are excluded. Weeks run Monday to Sunday.</Text>
      ) : null}

      {canManage && !error ? (
        showForm ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>New commitment</Text>
            <Text style={styles.label}>Buyer</Text>
            <TextInput style={styles.input} value={form.buyer_name} onChangeText={(value) => update("buyer_name", value)} placeholder="e.g. Mama Mboga Network" placeholderTextColor={COLORS.textMuted} />
            <Text style={styles.label}>Crop / product</Text>
            {cropChoices.length > 0 ? (
              <View style={styles.chipRow}>
                {cropChoices.map((name) => (
                  <Pressable key={name} style={[styles.pick, form.product_name === name && styles.pickActive]} onPress={() => update("product_name", name)}>
                    <Text style={[styles.pickText, form.product_name === name && styles.pickTextActive]}>{name}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <TextInput style={styles.input} value={form.product_name} onChangeText={(value) => update("product_name", value)} placeholder="Or type another product" placeholderTextColor={COLORS.textMuted} />
            <Text style={styles.label}>Agreed weekly volume (kg)</Text>
            <TextInput style={styles.input} value={form.weekly_kg} onChangeText={(value) => update("weekly_kg", value)} placeholder="e.g. 100" placeholderTextColor={COLORS.textMuted} keyboardType="decimal-pad" />
            <Text style={styles.label}>Agreed price per kg (KES, optional)</Text>
            <TextInput style={styles.input} value={form.agreed_price_kes} onChangeText={(value) => update("agreed_price_kes", value)} placeholder="Optional" placeholderTextColor={COLORS.textMuted} keyboardType="decimal-pad" />
            <View style={styles.dateRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Start (optional)</Text>
                <TextInput style={styles.input} value={form.start_date} onChangeText={(value) => update("start_date", value)} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textMuted} keyboardType="numbers-and-punctuation" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>End (optional)</Text>
                <TextInput style={styles.input} value={form.end_date} onChangeText={(value) => update("end_date", value)} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textMuted} keyboardType="numbers-and-punctuation" />
              </View>
            </View>
            <View style={styles.actions}>
              <Pressable style={styles.cancelBtn} onPress={() => { setShowForm(false); setForm(EMPTY); }} disabled={saving}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={() => void handleSave()} disabled={saving}>
                {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveText}>Save commitment</Text>}
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={styles.addBtn} onPress={() => setShowForm(true)} accessibilityRole="button">
            <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
            <Text style={styles.addText}>Add buyer commitment</Text>
          </Pressable>
        )
      ) : null}
      {!canManage && !loading && !error ? <Text style={styles.footnote}>Only a farm manager can add or remove commitments.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 14 },
  backButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.cardBg },
  title: { fontFamily: "Manrope_700Bold", fontSize: 20, color: COLORS.text },
  subtitle: { fontFamily: "Manrope_400Regular", fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  notice: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginHorizontal: 16, marginBottom: 12, padding: 12, borderRadius: 12, backgroundColor: COLORS.redLight },
  noticeText: { flex: 1, fontFamily: "Manrope_500Medium", fontSize: 13, lineHeight: 18, color: COLORS.red },
  empty: { alignItems: "center", gap: 8, marginHorizontal: 24, marginTop: 30 },
  emptyTitle: { fontFamily: "Manrope_700Bold", fontSize: 16, color: COLORS.text },
  emptyText: { fontFamily: "Manrope_400Regular", fontSize: 13, lineHeight: 19, color: COLORS.textSecondary, textAlign: "center" },
  card: { backgroundColor: COLORS.cardBg, borderRadius: 18, padding: 16, gap: 8, marginHorizontal: 16, marginBottom: 12, ...CARD_SHADOW },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cardTitle: { fontFamily: "Manrope_700Bold", fontSize: 16, color: COLORS.text },
  cardSub: { fontFamily: "Manrope_400Regular", fontSize: 13, lineHeight: 18, color: COLORS.textSecondary, marginTop: 2 },
  chip: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontFamily: "Manrope_600SemiBold", fontSize: 11 },
  track: { height: 8, borderRadius: 4, backgroundColor: COLORS.background, overflow: "hidden", marginTop: 4, flexDirection: "row" },
  fill: { height: 8, backgroundColor: COLORS.primary },
  bookedFill: { height: 8, backgroundColor: COLORS.amber },
  progressText: { fontFamily: "Manrope_600SemiBold", fontSize: 13, color: COLORS.text },
  progressMeta: { fontFamily: "Manrope_400Regular", fontSize: 12, color: COLORS.textSecondary },
  removeBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingVertical: 4 },
  removeText: { fontFamily: "Manrope_600SemiBold", fontSize: 12, color: COLORS.red },
  footnote: { fontFamily: "Manrope_400Regular", fontSize: 12, lineHeight: 17, color: COLORS.textMuted, marginHorizontal: 20, marginBottom: 14 },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginHorizontal: 16, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.primary },
  addText: { fontFamily: "Manrope_600SemiBold", fontSize: 14, color: COLORS.primary },
  label: { fontFamily: "Manrope_600SemiBold", fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  input: { fontFamily: "Manrope_500Medium", fontSize: 15, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.background },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pick: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background },
  pickActive: { backgroundColor: COLORS.primarySurface, borderColor: COLORS.primary },
  pickText: { fontFamily: "Manrope_600SemiBold", fontSize: 13, color: COLORS.textSecondary },
  pickTextActive: { color: COLORS.primary },
  dateRow: { flexDirection: "row", gap: 10 },
  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 12, backgroundColor: COLORS.background },
  cancelText: { fontFamily: "Manrope_600SemiBold", fontSize: 14, color: COLORS.textSecondary },
  saveBtn: { flex: 2, alignItems: "center", paddingVertical: 12, borderRadius: 12, backgroundColor: COLORS.primary },
  saveText: { fontFamily: "Manrope_700Bold", fontSize: 14, color: COLORS.white },
});
