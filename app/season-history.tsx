import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFarm } from "@/context/FarmContext";
import COLORS from "@/constants/colors";
import { formatDate, formatKES } from "@/lib/storage";

export default function SeasonHistoryScreen() {
  const insets = useSafeAreaInsets();
  const { seasons, costs, harvestRecords } = useFarm();

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const closedSeasons = [...seasons].filter((season) => season.status === "closed").sort((a, b) => b.season_number - a.season_number);

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.title}>Season History</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPadding + 90, gap: 12 }} showsVerticalScrollIndicator={false}>
        {closedSeasons.length > 0 ? (
          closedSeasons.map((season) => {
            const seasonCosts = costs.filter((c) => c.season_id === season.id);
            const seasonHarvests = harvestRecords.filter((r) => r.season_id === season.id);
            const spent = seasonCosts.reduce((sum, cost) => sum + cost.amount_kes, 0);
            const revenue = seasonHarvests.reduce((sum, record) => sum + record.total_revenue_kes, 0);
            const net = revenue - spent;
            const yieldKg = seasonHarvests.reduce((sum, record) => sum + record.total_kg, 0);

            return (
              <View key={season.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.cardTitle}>{season.season_name}</Text>
                    <Text style={styles.cardSub}>{season.season_type} · Closed {season.closed_at ? formatDate(season.closed_at) : formatDate(season.created_at)}</Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Closed</Text>
                  </View>
                </View>

                <View style={styles.grid}>
                  <View style={styles.stat}><Text style={styles.value}>{formatKES(revenue)}</Text><Text style={styles.label}>Revenue</Text></View>
                  <View style={styles.stat}><Text style={styles.value}>{formatKES(spent)}</Text><Text style={styles.label}>Costs</Text></View>
                  <View style={styles.stat}><Text style={[styles.value, net >= 0 ? styles.good : styles.bad]}>{formatKES(net)}</Text><Text style={styles.label}>Net</Text></View>
                  <View style={styles.stat}><Text style={styles.value}>{yieldKg.toLocaleString()}</Text><Text style={styles.label}>Yield kg</Text></View>
                </View>

                <Pressable style={styles.button} onPress={() => router.push("/season-report")}>
                  <Ionicons name="receipt-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.buttonText}>View report</Text>
                </Pressable>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="archive-outline" size={28} color={COLORS.primary} />
            <Text style={styles.emptyTitle}>No closed seasons yet</Text>
            <Text style={styles.emptySub}>Closed seasons will appear here for quick review.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.cardBg },
  title: { fontFamily: "DMSans_700Bold", fontSize: 18, color: COLORS.text },
  card: { backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 14, gap: 12, borderWidth: 1, borderColor: COLORS.border },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  cardTitle: { fontFamily: "DMSans_700Bold", fontSize: 16, color: COLORS.text },
  cardSub: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  badge: { backgroundColor: COLORS.borderLight, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontFamily: "DMSans_600SemiBold", fontSize: 11, color: COLORS.textSecondary },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stat: { flexBasis: "48%", flexGrow: 1, backgroundColor: COLORS.background, borderRadius: 12, padding: 10, gap: 3 },
  value: { fontFamily: "DMSans_700Bold", fontSize: 14, color: COLORS.text },
  label: { fontFamily: "DMSans_400Regular", fontSize: 10, color: COLORS.textSecondary },
  good: { color: COLORS.primary },
  bad: { color: COLORS.red },
  button: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: COLORS.primarySurface, borderRadius: 12, paddingVertical: 11 },
  buttonText: { fontFamily: "DMSans_700Bold", fontSize: 13, color: COLORS.primary },
  emptyCard: { backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 18, alignItems: "center", gap: 6, borderWidth: 1, borderColor: COLORS.border },
  emptyTitle: { fontFamily: "DMSans_700Bold", fontSize: 15, color: COLORS.text },
  emptySub: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary, textAlign: "center" },
});