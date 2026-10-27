import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "@/constants/colors";
import { useFarm } from "@/context/FarmContext";

/** Small brand line at the top of each main tab: leaf mark + app name, and the farm you are working on. */
export function BrandRow({ showFarm = true }: { showFarm?: boolean }) {
  const { activeFarm } = useFarm();
  return (
    <View style={styles.row}>
      <View style={styles.brand}>
        <View style={styles.mark}>
          <Ionicons name="leaf" size={15} color={COLORS.white} />
        </View>
        <Text style={styles.name}>FarmDiary</Text>
      </View>
      {showFarm && activeFarm?.name ? (
        <View style={styles.farmChip}>
          <Ionicons name="location-outline" size={13} color={COLORS.textSecondary} />
          <Text style={styles.farmText} numberOfLines={1}>{activeFarm.name}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20, minHeight: 32, gap: 12 },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  mark: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  name: { fontFamily: "Manrope_700Bold", fontSize: 15, color: COLORS.text, letterSpacing: -0.2 },
  farmChip: { flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: COLORS.muted, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  farmText: { flexShrink: 1, fontFamily: "Manrope_600SemiBold", fontSize: 13, color: COLORS.textSecondary },
});
