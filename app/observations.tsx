import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Modal,
  Alert,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFarm } from "@/context/FarmContext";
import COLORS from "@/constants/colors";
import { FieldObservation, formatDate } from "@/lib/storage";
import { SEASON_SEED } from "@/constants/farmData";
import * as Haptics from "expo-haptics";

const OBS_TYPES = ["Pest", "Disease", "Growth", "Weather", "General"];
const SEVERITIES = ["Low", "Medium", "High", "Critical"];

function getSeverityColor(severity: string) {
  switch (severity) {
    case "Critical": return { bg: COLORS.redLight, text: COLORS.red };
    case "High": return { bg: "#FFF3CD", text: "#856404" };
    case "Medium": return { bg: COLORS.amberLight, text: COLORS.amber };
    default: return { bg: COLORS.primarySurface, text: COLORS.primary };
  }
}

function ObservationCard({ obs, onDelete }: { obs: FieldObservation; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const sevColor = getSeverityColor(obs.severity);
  const isAlert = obs.severity === "High" || obs.severity === "Critical";

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Delete", "Delete this observation?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: onDelete },
    ]);
  };

  return (
    <Pressable
      onPress={() => setExpanded(!expanded)}
      onLongPress={handleLongPress}
      style={[styles.obsCard, isAlert && styles.obsCardAlert]}
    >
      <View style={styles.obsCardHeader}>
        <View style={styles.obsCardLeft}>
          <View style={styles.obsMetaRow}>
            <Text style={styles.obsDate}>{formatDate(obs.observation_date)}</Text>
            <View style={styles.obsTypePill}>
              <Text style={styles.obsTypeText}>{obs.observation_type}</Text>
            </View>
            {obs.section_id && (
              <View style={styles.obsSectionPill}>
                <Text style={styles.obsSectionText}>
                  {obs.section_id === "section-a" ? "Sec A" : "Sec B"}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.obsDescription} numberOfLines={expanded ? undefined : 2}>{obs.description}</Text>
        </View>
        <View style={[styles.severityBadge, { backgroundColor: sevColor.bg }]}>
          <Text style={[styles.severityText, { color: sevColor.text }]}>{obs.severity}</Text>
        </View>
      </View>

      {expanded && obs.action_taken && (
        <View style={styles.actionTaken}>
          <Ionicons name="checkmark-circle-outline" size={14} color={COLORS.primary} />
          <Text style={styles.actionTakenText}>{obs.action_taken}</Text>
        </View>
      )}
    </Pressable>
  );
}

function AddObservationModal({ onClose, onSubmit, seasonId }: {
  onClose: () => void;
  onSubmit: (obs: Omit<FieldObservation, "id" | "created_at">) => void;
  seasonId: string;
}) {
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [type, setType] = useState("Disease");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("Medium");
  const [actionTaken, setActionTaken] = useState("");
  const insets = useSafeAreaInsets();

  const handleSubmit = () => {
    if (!description.trim()) {
      Alert.alert("Error", "Please enter a description.");
      return;
    }
    onSubmit({
      farm_id: farmId,
      season_id: seasonId,
      section_id: sectionId,
      observation_date: date,
      observation_type: type,
      description: description.trim(),
      severity,
      action_taken: actionTaken || null,
      is_historical: false,
    });
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { paddingTop: 20 }]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>New Observation</Text>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
            <Ionicons name="close" size={22} color={COLORS.textSecondary} />
          </Pressable>
        </View>

        <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Section</Text>
          <View style={styles.row}>
            {([null, "section-a", "section-b"] as (string | null)[]).map((opt) => (
              <Pressable
                key={opt ?? "farm"}
                style={[styles.chip, sectionId === opt && styles.chipActive]}
                onPress={() => setSectionId(opt)}
              >
                <Text style={[styles.chipText, sectionId === opt && styles.chipTextActive]}>
                  {opt === null ? "Farm" : opt === "section-a" ? "Sec A" : "Sec B"}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Date</Text>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="numbers-and-punctuation"
          />

          <Text style={styles.fieldLabel}>Type</Text>
          <View style={styles.row}>
            {OBS_TYPES.map((t) => (
              <Pressable
                key={t}
                style={[styles.chip, type === t && styles.chipActive]}
                onPress={() => setType(t)}
              >
                <Text style={[styles.chipText, type === t && styles.chipTextActive]}>{t}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="What did you observe? Be specific — symptoms, affected area, estimated coverage."
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={4}
          />

          <Text style={styles.fieldLabel}>Severity</Text>
          <View style={styles.row}>
            {SEVERITIES.map((s) => {
              const sevColor = getSeverityColor(s);
              return (
                <Pressable
                  key={s}
                  style={[styles.severityOption, severity === s && { backgroundColor: sevColor.bg, borderColor: sevColor.text }]}
                  onPress={() => setSeverity(s)}
                >
                  <Text style={[styles.severityOptionText, severity === s && { color: sevColor.text }]}>{s}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>Action Taken (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={actionTaken}
            onChangeText={setActionTaken}
            placeholder="What action was taken? e.g. Spot spray applied, removed infected leaves."
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={3}
          />
        </ScrollView>

        <View style={[styles.modalFooter, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable style={styles.submitBtn} onPress={handleSubmit}>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />
            <Text style={styles.submitBtnText}>Save Observation</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function ObservationsScreen() {
  const insets = useSafeAreaInsets();
  const { observations, addFieldObservation, removeObservation, activeSeason, farmId } = useFarm();
  const seasonId = activeSeason?.id || SEASON_SEED.id;
  const [showAdd, setShowAdd] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const sorted = [...observations].sort(
    (a, b) => new Date(b.observation_date).getTime() - new Date(a.observation_date).getTime()
  );

  const criticalCount = observations.filter((o) => o.severity === "Critical" || o.severity === "High").length;

  const handleAdd = async (obs: Omit<FieldObservation, "id" | "created_at">) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await addFieldObservation(obs);
    setShowAdd(false);
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="close" size={22} color={COLORS.text} />
        </Pressable>
        <Text style={styles.title}>Observations</Text>
        <Pressable style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Ionicons name="add" size={20} color={COLORS.white} />
        </Pressable>
      </View>

      {criticalCount > 0 && (
        <View style={styles.alertBanner}>
          <Ionicons name="warning" size={16} color={COLORS.red} />
          <Text style={styles.alertBannerText}>{criticalCount} high-severity observation{criticalCount > 1 ? "s" : ""} require attention</Text>
        </View>
      )}

      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ObservationCard obs={item} onDelete={() => removeObservation(item.id)} />
        )}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="eye-outline" size={40} color={COLORS.border} />
            <Text style={styles.emptyTitle}>No observations yet</Text>
            <Text style={styles.emptySubtitle}>Record daily scouting notes here</Text>
            <Pressable style={styles.emptyAddBtn} onPress={() => setShowAdd(true)}>
              <Text style={styles.emptyAddBtnText}>Add Observation</Text>
            </Pressable>
          </View>
        }
      />

      {showAdd && <AddObservationModal onClose={() => setShowAdd(false)} onSubmit={handleAdd} seasonId={seasonId} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.borderLight,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontFamily: "DMSans_700Bold", fontSize: 22, color: COLORS.text },
  addBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center",
  },
  alertBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: COLORS.redLight, borderRadius: 10, padding: 12,
  },
  alertBannerText: { fontFamily: "DMSans_600SemiBold", fontSize: 12, color: COLORS.red, flex: 1 },
  listContent: { paddingHorizontal: 16, gap: 10, paddingTop: 4 },
  obsCard: {
    backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 14, gap: 8,
    shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  obsCardAlert: { borderLeftWidth: 3, borderLeftColor: COLORS.red },
  obsCardHeader: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  obsCardLeft: { flex: 1, gap: 6 },
  obsMetaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  obsDate: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textMuted },
  obsTypePill: { backgroundColor: COLORS.blueLight, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  obsTypeText: { fontFamily: "DMSans_600SemiBold", fontSize: 10, color: COLORS.blue },
  obsSectionPill: { backgroundColor: COLORS.primarySurface, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  obsSectionText: { fontFamily: "DMSans_600SemiBold", fontSize: 10, color: COLORS.primary },
  obsDescription: { fontFamily: "DMSans_500Medium", fontSize: 13, color: COLORS.text, lineHeight: 19 },
  severityBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: "flex-start" },
  severityText: { fontFamily: "DMSans_700Bold", fontSize: 10, letterSpacing: 0.3 },
  actionTaken: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    backgroundColor: COLORS.primarySurface, borderRadius: 8, padding: 10,
  },
  actionTakenText: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.primary, flex: 1 },
  emptyState: { alignItems: "center", gap: 8, paddingVertical: 48 },
  emptyTitle: { fontFamily: "DMSans_600SemiBold", fontSize: 16, color: COLORS.textSecondary },
  emptySubtitle: { fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.textMuted },
  emptyAddBtn: { marginTop: 6, backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  emptyAddBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 14, color: COLORS.white },
  // Modal
  modalContainer: { flex: 1, backgroundColor: COLORS.cardBg },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  modalTitle: { fontFamily: "DMSans_700Bold", fontSize: 18, color: COLORS.text },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.borderLight,
    alignItems: "center", justifyContent: "center",
  },
  modalScroll: { flex: 1 },
  modalBody: { padding: 16, gap: 12 },
  modalFooter: { padding: 16, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  fieldLabel: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.text },
  input: {
    backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: "DMSans_400Regular", fontSize: 14, color: COLORS.text,
  },
  textArea: { minHeight: 90, textAlignVertical: "top", paddingTop: 12 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.borderLight, borderWidth: 1.5, borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontFamily: "DMSans_500Medium", fontSize: 12, color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.white },
  severityOption: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.borderLight, borderWidth: 1.5, borderColor: COLORS.border,
  },
  severityOptionText: { fontFamily: "DMSans_600SemiBold", fontSize: 12, color: COLORS.textSecondary },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16,
  },
  submitBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 16, color: COLORS.white },
});
