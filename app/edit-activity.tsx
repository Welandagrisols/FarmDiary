import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFarm } from "@/context/FarmContext";
import COLORS from "@/constants/colors";
import { formatKES } from "@/lib/storage";
import * as Haptics from "expo-haptics";

const WEATHER_OPTIONS = ["Sunny", "Cloudy", "Light Rain", "Heavy Rain"];

export default function EditActivityScreen() {
  const insets = useSafeAreaInsets();
  const { logId } = useLocalSearchParams<{ logId: string }>();
  const { activityLogs, editActivityLog, removeActivityLog } = useFarm();

  const log = activityLogs.find((l) => l.id === logId);

  const [date, setDate] = useState(log?.actual_date ?? "");
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [weather, setWeather] = useState(log?.weather_conditions ?? "Sunny");
  const [notes, setNotes] = useState(log?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const formatDateFriendly = (dateStr: string): string => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return `${days[d.getDay()]}, ${Number(parts[2])} ${months[d.getMonth()]} ${parts[0]}`;
  };

  const getQuickDates = (): { label: string; value: string }[] => {
    const result: { label: string; value: string }[] = [];
    const today = new Date();
    for (let i = 0; i <= 5; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const val = d.toISOString().split("T")[0];
      let label = i === 0 ? "Today" : i === 1 ? "Yesterday" : `${i} days ago`;
      result.push({ label, value: val });
    }
    return result;
  };

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  if (!log) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </Pressable>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={40} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>Activity not found.</Text>
        </View>
      </View>
    );
  }

  const handleSave = async () => {
    if (!date) { Alert.alert("Error", "Activity date is required."); return; }
    setSaving(true);
    try {
      await editActivityLog(log.id, {
        actual_date: date,
        weather_conditions: weather,
        notes: notes || null,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved", "Activity updated successfully.", [{ text: "OK", onPress: () => router.back() }]);
    } catch {
      Alert.alert("Error", "Could not save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Activity",
      `Delete "${log.activity_name}"? This cannot be undone. Note: any cost records from this activity remain in the costs ledger.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await removeActivityLog(log.id);
            router.back();
          },
        },
      ]
    );
  };

  const sectionLabel =
    log.section_id === "section-a" ? "Section A" :
    log.section_id === "section-b" ? "Section B" : "Both Sections";

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Activity</Text>
        <Pressable onPress={handleDelete} hitSlop={12}>
          <Ionicons name="trash-outline" size={22} color={COLORS.red} />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <View style={styles.summaryCard}>
          <Text style={styles.activityName}>{log.activity_name}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaBadge}>
              <Ionicons name="grid-outline" size={12} color={COLORS.primary} />
              <Text style={styles.metaBadgeText}>{sectionLabel}</Text>
            </View>
            {log.total_cost_kes > 0 && (
              <View style={styles.metaBadge}>
                <Ionicons name="cash-outline" size={12} color={COLORS.amber} />
                <Text style={[styles.metaBadgeText, { color: COLORS.amberDark }]}>{formatKES(log.total_cost_kes)}</Text>
              </View>
            )}
          </View>
          <Text style={styles.noteText}>
            Note: cost records logged with this activity are stored separately in the ledger. To correct cost amounts, use Add Historical Cost.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Activity Date</Text>
        <Text style={styles.hint}>Change this if you logged on the wrong date.</Text>

        <View style={styles.dateDisplayBox}>
          <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
          <Text style={styles.dateDisplayText}>{date ? formatDateFriendly(date) : "No date set"}</Text>
        </View>

        <View style={styles.quickDateRow}>
          {getQuickDates().map(({ label, value }) => (
            <Pressable
              key={value}
              style={[styles.quickDateChip, date === value && styles.quickDateChipActive]}
              onPress={() => { setDate(value); setShowCustomDate(false); Haptics.selectionAsync(); }}
            >
              <Text style={[styles.quickDateChipText, date === value && styles.quickDateChipTextActive]}>{label}</Text>
            </Pressable>
          ))}
          <Pressable
            style={[styles.quickDateChip, showCustomDate && styles.quickDateChipActive]}
            onPress={() => setShowCustomDate(true)}
          >
            <Text style={[styles.quickDateChipText, showCustomDate && styles.quickDateChipTextActive]}>Earlier...</Text>
          </Pressable>
        </View>

        {showCustomDate && (
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="numbers-and-punctuation"
            autoFocus
          />
        )}

        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Weather</Text>
        <View style={styles.weatherRow}>
          {WEATHER_OPTIONS.map((w) => (
            <Pressable
              key={w}
              style={[styles.weatherChip, weather === w && styles.weatherChipActive]}
              onPress={() => setWeather(w)}
            >
              <Ionicons
                name={w === "Sunny" ? "sunny-outline" : w === "Cloudy" ? "cloud-outline" : w === "Light Rain" ? "rainy-outline" : "thunderstorm-outline"}
                size={16} color={weather === w ? COLORS.white : COLORS.textSecondary}
              />
              <Text style={[styles.weatherChipText, weather === w && styles.weatherChipTextActive]}>{w}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Notes / Observations</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Add any corrections or observations..."
          placeholderTextColor={COLORS.textMuted}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <Pressable
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
          <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save Changes"}</Text>
        </Pressable>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontFamily: "DMSans_700Bold", fontSize: 18, color: COLORS.text },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
  summaryCard: {
    backgroundColor: COLORS.primarySurface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLORS.primary + "30", marginBottom: 24, gap: 8,
  },
  activityName: { fontFamily: "DMSans_700Bold", fontSize: 17, color: COLORS.primary },
  metaRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  metaBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    backgroundColor: COLORS.white,
  },
  metaBadgeText: { fontFamily: "DMSans_500Medium", fontSize: 12, color: COLORS.primary },
  noteText: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textMuted, fontStyle: "italic" },
  sectionLabel: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.text, marginBottom: 4 },
  hint: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textMuted, marginBottom: 10 },
  dateDisplayBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: COLORS.primarySurface, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1.5, borderColor: COLORS.primary, marginBottom: 12,
  },
  dateDisplayText: { fontFamily: "DMSans_600SemiBold", fontSize: 15, color: COLORS.primary, flex: 1 },
  quickDateRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  quickDateChip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    backgroundColor: COLORS.borderLight, borderWidth: 1.5, borderColor: COLORS.border,
  },
  quickDateChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  quickDateChipText: { fontFamily: "DMSans_500Medium", fontSize: 13, color: COLORS.textSecondary },
  quickDateChipTextActive: { color: COLORS.white },
  weatherRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  weatherChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10,
    backgroundColor: COLORS.borderLight, borderWidth: 1.5, borderColor: COLORS.border,
  },
  weatherChipActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primaryLight },
  weatherChipText: { fontFamily: "DMSans_500Medium", fontSize: 12, color: COLORS.textSecondary },
  weatherChipTextActive: { color: COLORS.white },
  input: {
    backgroundColor: COLORS.white, borderRadius: 10, borderWidth: 1.5,
    borderColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: "DMSans_400Regular", fontSize: 14, color: COLORS.text, marginBottom: 4,
  },
  notesInput: { height: 100, marginBottom: 4 },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 14,
    paddingVertical: 16, marginTop: 24,
  },
  saveBtnText: { fontFamily: "DMSans_700Bold", fontSize: 16, color: COLORS.white },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  emptyText: { fontFamily: "DMSans_500Medium", fontSize: 15, color: COLORS.textMuted },
});
