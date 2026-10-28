import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFarm } from "@/context/FarmContext";
import COLORS from "@/constants/colors";
import * as Haptics from "expo-haptics";

const LEASE_OPTIONS = ["Leased", "Owned", "Managed", "Community"];
const CROP_OPTIONS = ["Potato", "Maize", "Wheat", "Beans", "Vegetables", "Mixed"];

export default function FarmSetupScreen() {
  const insets = useSafeAreaInsets();
  const { activeFarm, createFarm, updateActiveFarm, switchFarm } = useFarm();
  const params = useLocalSearchParams<{ mode?: string }>();
  const isEdit = params.mode === "edit";

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const [name, setName] = useState(isEdit ? (activeFarm?.name || "") : "");
  const [location, setLocation] = useState(isEdit ? (activeFarm?.location || "") : "");
  const [totalAcres, setTotalAcres] = useState(isEdit ? (activeFarm?.total_acres?.toString() || "") : "");
  const [leaseStatus, setLeaseStatus] = useState(isEdit ? (activeFarm?.lease_status || "Leased") : "Leased");
  const [cropType, setCropType] = useState(isEdit ? (activeFarm?.crop_type || "Potato") : "Potato");
  const [notes, setNotes] = useState(isEdit ? (activeFarm?.notes || "") : "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Required", "Please enter a farm name.");
      return;
    }
    if (!location.trim()) {
      Alert.alert("Required", "Please enter a location.");
      return;
    }
    const acres = totalAcres.trim() ? Number(totalAcres.replace(",", ".")) : 0;
    if (!Number.isFinite(acres) || acres < 0) {
      Alert.alert("Check the farm size", "Enter a valid number of acres, or leave it empty.");
      return;
    }

    setSaving(true);
    try {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      if (isEdit) {
        if (!activeFarm) throw new Error("Select a farm before editing its details.");
        await updateActiveFarm({
          name: name.trim(),
          location: location.trim(),
          total_acres: acres,
          lease_status: leaseStatus,
          crop_type: cropType,
          notes: notes.trim() || null,
        });
        Alert.alert("Saved", "Farm details updated.", [{ text: "OK", onPress: () => router.back() }]);
      } else {
        const newFarm = await createFarm({
          name: name.trim(),
          location: location.trim(),
          total_acres: acres,
          lease_status: leaseStatus,
          crop_type: cropType,
          notes: notes.trim() || null,
        });
        Alert.alert(
          "Farm Created",
          `"${newFarm.name}" has been added. Switch to it now?`,
          [
            { text: "Not Now", style: "cancel", onPress: () => router.back() },
            {
              text: "Switch to Farm",
              onPress: async () => {
                try {
                  await switchFarm(newFarm.id, newFarm);
                  router.replace("/(tabs)");
                } catch (error) {
                  Alert.alert(
                    "Farm created, but could not switch",
                    error instanceof Error ? error.message : "Select the farm from the farm list and try again.",
                  );
                }
              },
            },
          ]
        );
      }
    } catch (error) {
      Alert.alert(
        isEdit ? "Could not save farm" : "Could not create farm",
        error instanceof Error ? error.message : "Check your connection and try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.title}>{isEdit ? "Edit Farm" : "New Farm"}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Farm identity</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Farm name <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Rift Valley Potato Farm"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Location <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Nakuru, Kenya"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Total acres</Text>
            <TextInput
              style={styles.input}
              value={totalAcres}
              onChangeText={setTotalAcres}
              placeholder="e.g. 4"
              keyboardType="numeric"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ownership</Text>
          <View style={styles.chipRow}>
            {LEASE_OPTIONS.map((opt) => (
              <Pressable
                key={opt}
                style={[styles.chip, leaseStatus === opt && styles.chipActive]}
                onPress={() => setLeaseStatus(opt)}
              >
                <Text style={[styles.chipText, leaseStatus === opt && styles.chipTextActive]}>{opt}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Primary crop</Text>
          <View style={styles.chipRow}>
            {CROP_OPTIONS.map((opt) => (
              <Pressable
                key={opt}
                style={[styles.chip, cropType === opt && styles.chipActive]}
                onPress={() => setCropType(opt)}
              >
                <Text style={[styles.chipText, cropType === opt && styles.chipTextActive]}>{opt}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any additional notes about this farm..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={3}
          />
        </View>

        <Pressable
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Ionicons name={isEdit ? "checkmark-circle-outline" : "add-circle-outline"} size={20} color={COLORS.white} />
          <Text style={styles.saveBtnText}>{saving ? "Saving..." : isEdit ? "Save Changes" : "Create Farm"}</Text>
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
    borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.cardBg,
  },
  title: { fontFamily: "Manrope_700Bold", fontSize: 18, color: COLORS.text },
  content: { padding: 16, gap: 20, paddingBottom: 60 },
  section: { gap: 12 },
  sectionTitle: {
    fontFamily: "Manrope_700Bold",
    fontSize: 14,
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  field: { gap: 6 },
  label: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 14,
    color: COLORS.text,
  },
  required: { color: COLORS.red },
  input: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: "Manrope_400Regular",
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textarea: { minHeight: 80, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.borderLight, borderWidth: 1, borderColor: COLORS.border },
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
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 6,
  },
  saveBtnText: {
    fontFamily: "Manrope_700Bold",
    fontSize: 16,
    color: COLORS.white,
  }});
