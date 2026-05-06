import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Pressable, ScrollView, Platform } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { runMigrationIfNeeded, MigrationResult } from "@/lib/migration";
import COLORS from "@/constants/colors";

type Phase = "running" | "success" | "error";

export default function MigrationScreen() {
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const [phase, setPhase] = useState<Phase>("running");
  const [result, setResult] = useState<MigrationResult | null>(null);

  useEffect(() => {
    runMigrationIfNeeded().then((res) => {
      setResult(res);
      setPhase(res.success ? "success" : "error");
    });
  }, []);

  const proceed = () => router.replace("/farm-picker");

  if (phase === "running") {
    return (
      <View style={[styles.centered, { paddingTop: topPadding }]}>
        <View style={styles.iconCircle}>
          <Ionicons name="cloud-upload-outline" size={40} color={COLORS.primary} />
        </View>
        <Text style={styles.title}>Migrating Your Data</Text>
        <Text style={styles.subtitle}>Moving all your farm records to the cloud.{"\n"}This only happens once.</Text>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 32 }} />
      </View>
    );
  }

  if (phase === "error") {
    return (
      <View style={[styles.centered, { paddingTop: topPadding }]}>
        <View style={[styles.iconCircle, { backgroundColor: COLORS.redLight }]}>
          <Ionicons name="alert-circle-outline" size={40} color={COLORS.red} />
        </View>
        <Text style={styles.title}>Migration Failed</Text>
        <Text style={styles.subtitle}>Could not upload your data to the cloud.</Text>
        {result?.error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{result.error}</Text>
          </View>
        ) : null}
        <Text style={styles.hint}>Please check your internet connection and try restarting the app. Your local data is safe and has not been deleted.</Text>
        <Pressable style={styles.retryBtn} onPress={() => {
          setPhase("running");
          runMigrationIfNeeded().then((res) => {
            setResult(res);
            setPhase(res.success ? "success" : "error");
          });
        }}>
          <Ionicons name="refresh" size={18} color={COLORS.white} />
          <Text style={styles.retryBtnText}>Retry Migration</Text>
        </Pressable>
      </View>
    );
  }

  const counts = result?.counts;
  const rows = [
    { label: "Farms", value: counts?.farms ?? 0, icon: "leaf-outline" },
    { label: "Seasons", value: counts?.seasons ?? 0, icon: "calendar-outline" },
    { label: "Cost Entries", value: counts?.costs ?? 0, icon: "receipt-outline" },
    { label: "Inventory Items", value: counts?.inventory ?? 0, icon: "cube-outline" },
    { label: "Activity Logs", value: counts?.activityLogs ?? 0, icon: "clipboard-outline" },
    { label: "Observations", value: counts?.observations ?? 0, icon: "eye-outline" },
    { label: "Harvest Records", value: counts?.harvestRecords ?? 0, icon: "basket-outline" },
    { label: "Personal Expenses", value: counts?.personalExpenses ?? 0, icon: "wallet-outline" },
  ] as const;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.iconCircle}>
          <Ionicons name="checkmark-circle" size={48} color={COLORS.primary} />
        </View>
        <Text style={styles.title}>All Data Backed Up!</Text>
        <Text style={styles.subtitle}>Your farm records are now safely stored in the cloud. From here on, all new data is saved directly to Supabase.</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>What was migrated</Text>
          {rows.map((row) => (
            <View key={row.label} style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons name={row.icon as any} size={18} color={COLORS.primary} />
                <Text style={styles.rowLabel}>{row.label}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{row.value}</Text>
              </View>
            </View>
          ))}
        </View>

        <Pressable style={styles.proceedBtn} onPress={proceed}>
          <Text style={styles.proceedBtnText}>Go to My Farms</Text>
          <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  scroll: { padding: 24, alignItems: "center", gap: 20, paddingBottom: 60 },
  iconCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: COLORS.primarySurface, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  title: { fontFamily: "DMSans_700Bold", fontSize: 24, color: COLORS.text, textAlign: "center" },
  subtitle: { fontFamily: "DMSans_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center", lineHeight: 22 },
  card: { width: "100%", backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, gap: 12 },
  cardTitle: { fontFamily: "DMSans_600SemiBold", fontSize: 14, color: COLORS.textSecondary, marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowLabel: { fontFamily: "DMSans_500Medium", fontSize: 14, color: COLORS.text },
  badge: { backgroundColor: COLORS.primarySurface, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 3 },
  badgeText: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.primary },
  proceedBtn: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16 },
  proceedBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 16, color: COLORS.white },
  errorBox: { backgroundColor: COLORS.redLight, borderRadius: 10, padding: 14, width: "100%", marginTop: 8 },
  errorText: { fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.red },
  hint: { fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.textSecondary, textAlign: "center", lineHeight: 20, marginTop: 8 },
  retryBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28, marginTop: 8 },
  retryBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 15, color: COLORS.white },
});
