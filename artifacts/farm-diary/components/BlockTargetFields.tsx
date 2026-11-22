import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import COLORS from "@/constants/colors";

interface Props {
  yieldText: string;
  priceText: string;
  onChangeYield: (value: string) => void;
  onChangePrice: (value: string) => void;
  testIdPrefix?: string;
}

export default function BlockTargetFields({
  yieldText,
  priceText,
  onChangeYield,
  onChangePrice,
  testIdPrefix = "target",
}: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Targets (optional)</Text>
      <View style={styles.row}>
        <View style={styles.cell}>
          <Text style={styles.label}>Target yield (kg)</Text>
          <TextInput
            style={styles.input}
            value={yieldText}
            onChangeText={onChangeYield}
            placeholder="e.g. 2500"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="decimal-pad"
            testID={`${testIdPrefix}-yield`}
            accessibilityLabel="Target yield in kg"
          />
        </View>
        <View style={styles.cell}>
          <Text style={styles.label}>Expected price (KES/kg)</Text>
          <TextInput
            style={styles.input}
            value={priceText}
            onChangeText={onChangePrice}
            placeholder="e.g. 60"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="decimal-pad"
            testID={`${testIdPrefix}-price`}
            accessibilityLabel="Expected price per kg"
          />
        </View>
      </View>
      <Text style={styles.hint}>Used to compare the harvest and sales with your plan.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  title: { fontFamily: "Manrope_700Bold", fontSize: 13, color: COLORS.text },
  row: { flexDirection: "row", gap: 10 },
  cell: { flex: 1, gap: 4 },
  label: { fontFamily: "Manrope_600SemiBold", fontSize: 12, color: COLORS.textSecondary },
  input: {
    fontFamily: "Manrope_500Medium", fontSize: 15, color: COLORS.text, borderWidth: 1,
    borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: COLORS.background,
  },
  hint: { fontFamily: "Manrope_400Regular", fontSize: 12, lineHeight: 17, color: COLORS.textMuted },
});
