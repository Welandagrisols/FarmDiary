import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "@/constants/colors";
import type { FarmWorker } from "@/lib/storage";

interface WorkerPickerProps {
  workers: FarmWorker[];
  selectedIds: string[];
  onToggle: (workerId: string) => void;
  loading?: boolean;
}

export default function WorkerPicker({
  workers,
  selectedIds,
  onToggle,
  loading = false,
}: WorkerPickerProps) {
  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text style={styles.label}>Named workers</Text>
        <Text style={styles.count}>{selectedIds.length} selected</Text>
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={COLORS.primary} />
      ) : workers.length ? (
        <View style={styles.options}>
          {workers.map((worker) => {
            const selected = selectedIds.includes(worker.id);
            return (
              <Pressable
                key={worker.id}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => onToggle(worker.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={worker.name}
                testID={`worker-choice-${worker.id}`}
              >
                <Ionicons
                  name={selected ? "checkmark-circle" : "ellipse-outline"}
                  size={18}
                  color={selected ? COLORS.primary : COLORS.textMuted}
                />
                <Text numberOfLines={1} style={[styles.optionText, selected && styles.optionTextSelected]}>
                  {worker.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Text style={styles.emptyText}>No names yet. A farm manager can add workers in Farm Team.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontFamily: "Manrope_600SemiBold", fontSize: 13, color: COLORS.textSecondary },
  count: { fontFamily: "Manrope_500Medium", fontSize: 12, color: COLORS.textMuted },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: {
    minHeight: 42,
    flexGrow: 1,
    flexBasis: "46%",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.cardBg,
  },
  optionSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySurface },
  optionText: { flex: 1, fontFamily: "Manrope_600SemiBold", fontSize: 13, color: COLORS.text },
  optionTextSelected: { color: COLORS.primary },
  emptyText: { fontFamily: "Manrope_400Regular", fontSize: 12, lineHeight: 17, color: COLORS.textMuted },
});
