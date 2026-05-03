import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFarm } from "@/context/FarmContext";
import COLORS from "@/constants/colors";
import { formatDate } from "@/lib/storage";

export default function FarmPickerScreen() {
  const insets = useSafeAreaInsets();
  const { farms, activeFarm, switchFarm } = useFarm();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const handleOpen = async (farmId: string) => {
    await switchFarm(farmId);
    router.replace("/(tabs)");
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Choose Farm</Text>
        <Text style={styles.subtitle}>Pick the farm you want to work on</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPadding + 80, gap: 12 }} showsVerticalScrollIndicator={false}>
        {farms.map((farm) => {
          const isActive = farm.id === activeFarm?.id;
          return (
            <Pressable key={farm.id} style={[styles.card, isActive && styles.cardActive]} onPress={() => handleOpen(farm.id)}>
              <View style={styles.cardTop}>
                <View style={styles.iconWrap}>
                  <Ionicons name="leaf" size={20} color={isActive ? COLORS.white : COLORS.primary} />
                </View>
                <View style={styles.cardText}>
                  <Text style={styles.farmName}>{farm.name}</Text>
                  <Text style={styles.farmMeta} numberOfLines={1}>{farm.location}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
              </View>
              <View style={styles.cardBottom}>
                <Text style={styles.detail}>{farm.total_acres ? `${farm.total_acres} acres` : "—"}</Text>
                <Text style={styles.detail}>{farm.lease_status}</Text>
                <Text style={styles.detail}>Added {formatDate(farm.created_at)}</Text>
              </View>
              {isActive ? <Text style={styles.activeLabel}>Current farm</Text> : null}
            </Pressable>
          );
        })}

        <Pressable style={styles.newBtn} onPress={() => router.push("/farm-setup")}>
          <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
          <Text style={styles.newBtnText}>Add another farm</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 16, paddingBottom: 14, gap: 4 },
  title: { fontFamily: "DMSans_700Bold", fontSize: 28, color: COLORS.text },
  subtitle: { fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.textSecondary },
  card: { backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: COLORS.border, gap: 10 },
  cardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySurface },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primarySurface },
  cardText: { flex: 1, gap: 2 },
  farmName: { fontFamily: "DMSans_700Bold", fontSize: 16, color: COLORS.text },
  farmMeta: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary },
  cardBottom: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  detail: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textMuted },
  activeLabel: { fontFamily: "DMSans_600SemiBold", fontSize: 11, color: COLORS.primary },
  newBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.primary, backgroundColor: COLORS.cardBg },
  newBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 14, color: COLORS.primary },
});