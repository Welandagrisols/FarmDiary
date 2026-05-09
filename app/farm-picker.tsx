import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFarm } from "@/context/FarmContext";
import COLORS from "@/constants/colors";
import { formatDate } from "@/lib/storage";

export default function FarmPickerScreen() {
  const insets = useSafeAreaInsets();
  const { farms, activeFarm, switchFarm, refresh, isLoading } = useFarm();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;
  const [switching, setSwitching] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, []);

  const handleOpen = async (farmId: string) => {
    setSwitching(farmId);
    await switchFarm(farmId);
    router.replace("/(tabs)");
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { paddingTop: topPadding }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading your farms…</Text>
      </View>
    );
  }

  if (!isLoading && farms.length === 0) {
    return (
      <View style={[styles.centered, { paddingTop: topPadding }]}>
        <View style={styles.emptyIcon}>
          <Ionicons name="leaf-outline" size={40} color={COLORS.primary} />
        </View>
        <Text style={styles.emptyTitle}>No Farms Yet</Text>
        <Text style={styles.emptySubtitle}>Set up your first farm to get started. You can add as many farms as you need.</Text>
        <Pressable style={styles.createBtn} onPress={() => router.push("/farm-setup")}>
          <Ionicons name="add-circle-outline" size={20} color={COLORS.white} />
          <Text style={styles.createBtnText}>Create Your First Farm</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Choose Farm</Text>
        <Text style={styles.subtitle}>Pick the farm you want to work on</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPadding + 80, gap: 12 }} showsVerticalScrollIndicator={false}>
        {farms.map((farm) => {
          const isActive = farm.id === activeFarm?.id;
          const isswitching = switching === farm.id;
          return (
            <Pressable
              key={farm.id}
              style={[styles.card, isActive && styles.cardActive]}
              onPress={() => handleOpen(farm.id)}
              disabled={!!switching}
            >
              <View style={styles.cardTop}>
                <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
                  {isswitching
                    ? <ActivityIndicator size="small" color={COLORS.primary} />
                    : <Ionicons name="leaf" size={20} color={isActive ? COLORS.white : COLORS.primary} />
                  }
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
  centered: { flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 },
  loadingText: { fontFamily: "DMSans_400Regular", fontSize: 14, color: COLORS.textSecondary, marginTop: 12 },
  emptyIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: COLORS.primarySurface, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: "DMSans_700Bold", fontSize: 24, color: COLORS.text, textAlign: "center" },
  emptySubtitle: { fontFamily: "DMSans_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center", lineHeight: 22 },
  createBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, marginTop: 8 },
  createBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 15, color: COLORS.white },
  header: { paddingHorizontal: 16, paddingBottom: 14, gap: 4 },
  title: { fontFamily: "DMSans_700Bold", fontSize: 28, color: COLORS.text },
  subtitle: { fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.textSecondary },
  card: { backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: COLORS.border, gap: 10 },
  cardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySurface },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primarySurface },
  iconWrapActive: { backgroundColor: COLORS.primary },
  cardText: { flex: 1, gap: 2 },
  farmName: { fontFamily: "DMSans_700Bold", fontSize: 16, color: COLORS.text },
  farmMeta: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary },
  cardBottom: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  detail: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textMuted },
  activeLabel: { fontFamily: "DMSans_600SemiBold", fontSize: 11, color: COLORS.primary },
  newBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.primary, backgroundColor: COLORS.cardBg },
  newBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 14, color: COLORS.primary },
});
