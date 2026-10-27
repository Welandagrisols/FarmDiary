import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import COLORS from "@/constants/colors";
import { useFarm } from "@/context/FarmContext";
import { createPlot, listPlots, updatePlot } from "@/lib/soil-storage";

export default function AddPlotScreen() {
  const insets = useSafeAreaInsets();
  const { activeFarm } = useFarm();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;

  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [description, setDescription] = useState("");
  const [archived, setArchived] = useState(false);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing || !activeFarm?.id) return;
    (async () => {
      try {
        const plot = (await listPlots(activeFarm.id)).find((p) => p.id === id);
        if (!plot) { Alert.alert("Plot not found", "It may have been removed."); router.back(); return; }
        setName(plot.name);
        setArea(plot.area_acres ? String(plot.area_acres) : "");
        setDescription(plot.description ?? "");
        setArchived(plot.is_archived);
      } catch (e: any) {
        Alert.alert("Could not load plot", e?.message || "Try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [editing, id, activeFarm?.id]);

  const save = async () => {
    if (!activeFarm?.id) return;
    const trimmed = name.trim();
    if (!trimmed) { Alert.alert("Name needed", "Give the plot a name, e.g. \"Lower field\"."); return; }
    let acres: number | null = null;
    if (area.trim()) {
      acres = Number(area.replace(",", "."));
      if (!Number.isFinite(acres) || acres <= 0) { Alert.alert("Check the size", "Size must be a number above zero, or leave it empty."); return; }
    }
    setSaving(true);
    try {
      if (editing) await updatePlot(id!, { name: trimmed, area_acres: acres, description: description.trim() || null });
      else await createPlot(activeFarm.id, { name: trimmed, area_acres: acres, description: description.trim() || null });
      router.back();
    } catch (e: any) {
      Alert.alert("Could not save", e?.message || "Try again.");
    } finally {
      setSaving(false);
    }
  };

  const toggleArchive = () => {
    const next = !archived;
    Alert.alert(
      next ? "Archive this plot?" : "Restore this plot?",
      next ? "It will be hidden from the plot lists. Its soil tests are kept and can still be viewed." : "It will appear in the plot lists again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: next ? "Archive" : "Restore",
          onPress: async () => {
            try { await updatePlot(id!, { is_archived: next }); router.back(); }
            catch (e: any) { Alert.alert("Could not update", e?.message || "Try again."); }
          },
        },
      ],
    );
  };

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  return (
    <KeyboardAvoidingView style={[styles.container, { paddingTop: topPadding }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="close" size={24} color={COLORS.text} /></Pressable>
        <Text style={styles.title}>{editing ? "Edit plot" : "New plot"}</Text>
        <View style={{ width: 24 }} />
      </View>
      {loading ? <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 14 }} keyboardShouldPersistTaps="handled">
          <View>
            <Text style={styles.label}>Plot name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Lower field, Block A" placeholderTextColor={COLORS.textMuted} maxLength={60} />
          </View>
          <View>
            <Text style={styles.label}>Size in acres (optional)</Text>
            <TextInput style={styles.input} value={area} onChangeText={setArea} placeholder="e.g. 1.5" placeholderTextColor={COLORS.textMuted} keyboardType="decimal-pad" />
          </View>
          <View>
            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]} value={description} onChangeText={setDescription} placeholder="Slope, previous crop, anything that helps you recognise it" placeholderTextColor={COLORS.textMuted} multiline />
          </View>
          <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveText}>{editing ? "Save changes" : "Add plot"}</Text>}
          </Pressable>
          {editing ? (
            <Pressable style={styles.archiveBtn} onPress={toggleArchive}>
              <Text style={styles.archiveText}>{archived ? "Restore plot" : "Archive plot"}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontFamily: "Manrope_700Bold", fontSize: 18, color: COLORS.text },
  label: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 13,
    color: COLORS.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "Manrope_400Regular",
    fontSize: 16,
    color: COLORS.text,
  },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 6 },
  saveText: {
    fontFamily: "Manrope_700Bold",
    fontSize: 16,
    color: COLORS.white,
  },
  archiveBtn: { alignItems: "center", paddingVertical: 12 },
  archiveText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 15,
    color: COLORS.red,
  }});
