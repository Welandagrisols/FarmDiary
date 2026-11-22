import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "@/constants/colors";
import { IRRIGATION_METHODS, type IrrigationInput } from "@/lib/irrigation";

interface Props {
  value: IrrigationInput;
  onChange: (next: IrrigationInput) => void;
}

export default function IrrigationFields({ value, onChange }: Props) {
  const set = <K extends keyof IrrigationInput>(key: K, nextValue: IrrigationInput[K]) =>
    onChange({ ...value, [key]: nextValue });
  return (
    <View style={styles.box} testID="irrigation-fields">
      <Text style={styles.title}>Watering details (optional)</Text>
      <Text style={styles.label}>Method</Text>
      <View style={styles.chipRow}>
        {IRRIGATION_METHODS.map((method) => (
          <Pressable
            key={method}
            style={[styles.chip, value.method === method && styles.chipActive]}
            onPress={() => set("method", value.method === method ? "" : method)}
            accessibilityRole="button"
            accessibilityState={{ selected: value.method === method }}
          >
            <Text style={[styles.chipText, value.method === method && styles.chipTextActive]}>{method}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.row}>
        <View style={styles.cell}>
          <Text style={styles.label}>Duration (minutes)</Text>
          <TextInput
            style={styles.input}
            value={value.durationMinutes}
            onChangeText={(next) => set("durationMinutes", next)}
            placeholder="e.g. 45"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="decimal-pad"
            accessibilityLabel="Irrigation duration in minutes"
          />
        </View>
        <View style={styles.cell}>
          <Text style={styles.label}>Water EC (dS/m)</Text>
          <TextInput
            style={styles.input}
            value={value.ecText}
            onChangeText={(next) => set("ecText", next)}
            placeholder="e.g. 1.8"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="decimal-pad"
            accessibilityLabel="Water electrical conductivity"
          />
        </View>
      </View>
      <Text style={styles.label}>Water source</Text>
      <TextInput
        style={styles.input}
        value={value.waterSource}
        onChangeText={(next) => set("waterSource", next)}
        placeholder="e.g. Borehole, river, tank"
        placeholderTextColor={COLORS.textMuted}
        maxLength={60}
        accessibilityLabel="Water source"
      />
      <Pressable
        style={styles.flushRow}
        onPress={() => set("leachingFlush", !value.leachingFlush)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: value.leachingFlush }}
      >
        <Ionicons
          name={value.leachingFlush ? "checkbox" : "square-outline"}
          size={22}
          color={value.leachingFlush ? COLORS.primary : COLORS.textMuted}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.flushTitle}>Sodium leaching flush</Text>
          <Text style={styles.flushHint}>Use only for a deliberate deep flush to move salts below the roots.</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8, backgroundColor: COLORS.cardBg, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 14, marginTop: 10 },
  title: { fontFamily: "Manrope_700Bold", fontSize: 14, color: COLORS.text },
  label: { fontFamily: "Manrope_600SemiBold", fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background },
  chipActive: { backgroundColor: COLORS.primarySurface, borderColor: COLORS.primary },
  chipText: { fontFamily: "Manrope_600SemiBold", fontSize: 13, color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.primary },
  row: { flexDirection: "row", gap: 10 },
  cell: { flex: 1, gap: 4 },
  input: { fontFamily: "Manrope_500Medium", fontSize: 15, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.background },
  flushRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 4 },
  flushTitle: { fontFamily: "Manrope_600SemiBold", fontSize: 14, color: COLORS.text },
  flushHint: { fontFamily: "Manrope_400Regular", fontSize: 12, lineHeight: 17, color: COLORS.textMuted, marginTop: 1 },
});
