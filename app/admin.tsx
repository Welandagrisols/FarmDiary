import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, Platform, RefreshControl, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useFarm } from "@/context/FarmContext";
import { getAllFarmsAdmin, getAllUserProfiles, setActiveFarmId, getSeasons } from "@/lib/supabase-storage";
import type { FarmRecord, UserProfile, SeasonRecord } from "@/lib/storage";

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { refresh } = useFarm();
  const [farms, setFarms] = useState<FarmRecord[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [seasons, setSeasons] = useState<SeasonRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const topPad = Platform.OS === "web" ? 60 : insets.top + 8;

  const load = useCallback(async () => {
    try {
      const [f, p, s] = await Promise.all([getAllFarmsAdmin(), getAllUserProfiles(), getSeasons()]);
      setFarms(f);
      setProfiles(p);
      setSeasons(s);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to load admin data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const viewFarm = async (farm: FarmRecord) => {
    await setActiveFarmId(farm.id);
    await refresh();
    router.replace("/(tabs)");
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Sign out of admin?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOut },
    ]);
  };

  const emailForFarm = (farm: FarmRecord): string => {
    if (!farm.user_id) return "Unassigned";
    const p = profiles.find((p) => p.id === farm.user_id);
    return p?.email || farm.user_id.slice(0, 8) + "…";
  };

  const seasonsForFarm = (farmId: string) =>
    seasons.filter((s) => s.farm_id === farmId);

  const userCount = profiles.length;
  const farmerCount = profiles.filter((p) => p.role === "farmer").length;
  const unclaimedCount = farms.filter((f) => !f.user_id).length;

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: topPad }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading admin data…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={14} color={COLORS.white} />
              <Text style={styles.adminBadgeText}>ADMIN</Text>
            </View>
            <Text style={styles.title}>Dashboard</Text>
          </View>
          <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={18} color={COLORS.textSecondary} />
          </Pressable>
        </View>
        <Text style={styles.subtitle} numberOfLines={1}>{user?.email}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="leaf-outline" size={22} color={COLORS.primary} />
          <Text style={styles.statValue}>{farms.length}</Text>
          <Text style={styles.statLabel}>Total Farms</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="people-outline" size={22} color={COLORS.teal} />
          <Text style={styles.statValue}>{farmerCount}</Text>
          <Text style={styles.statLabel}>Farmers</Text>
        </View>
        <View style={[styles.statCard, unclaimedCount > 0 && styles.statCardWarn]}>
          <Ionicons name="help-circle-outline" size={22} color={unclaimedCount > 0 ? COLORS.amber : COLORS.primary} />
          <Text style={[styles.statValue, unclaimedCount > 0 && { color: COLORS.amber }]}>{unclaimedCount}</Text>
          <Text style={styles.statLabel}>Unassigned</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>All Farms ({farms.length})</Text>
        <View style={styles.farmList}>
          {farms.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>No farms yet.</Text>
            </View>
          ) : (
            farms.map((farm, i) => {
              const farmSeasons = seasonsForFarm(farm.id);
              const activeSeason = farmSeasons.find((s) => s.status === "active");
              const email = emailForFarm(farm);
              return (
                <View key={farm.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <Pressable
                    style={({ pressed }) => [styles.farmRow, pressed && { backgroundColor: COLORS.borderLight }]}
                    onPress={() => viewFarm(farm)}
                  >
                    <View style={styles.farmIconWrap}>
                      <Ionicons name="leaf" size={20} color={COLORS.primary} />
                    </View>
                    <View style={styles.farmInfo}>
                      <Text style={styles.farmName} numberOfLines={1}>{farm.name}</Text>
                      <Text style={styles.farmMeta} numberOfLines={1}>
                        {farm.location || "—"}{farm.total_acres ? ` · ${farm.total_acres} ac` : ""}
                        {farm.crop_type ? ` · ${farm.crop_type}` : ""}
                      </Text>
                      <View style={styles.farmTags}>
                        <View style={styles.ownerTag}>
                          <Ionicons name="person-outline" size={10} color={COLORS.textMuted} />
                          <Text style={styles.ownerTagText} numberOfLines={1}>{email}</Text>
                        </View>
                        {activeSeason ? (
                          <View style={styles.seasonTag}>
                            <Text style={styles.seasonTagText}>{activeSeason.season_name}</Text>
                          </View>
                        ) : farmSeasons.length > 0 ? (
                          <View style={[styles.seasonTag, { backgroundColor: COLORS.borderLight }]}>
                            <Text style={[styles.seasonTagText, { color: COLORS.textMuted }]}>{farmSeasons.length} season{farmSeasons.length !== 1 ? "s" : ""}</Text>
                          </View>
                        ) : null}
                        {!farm.user_id && (
                          <View style={[styles.seasonTag, { backgroundColor: COLORS.amberLight }]}>
                            <Text style={[styles.seasonTagText, { color: COLORS.amberDark }]}>Unassigned</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
                  </Pressable>
                </View>
              );
            })
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Registered Users ({userCount})</Text>
        <View style={styles.farmList}>
          {profiles.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>No user profiles yet.</Text>
            </View>
          ) : (
            profiles.map((profile, i) => {
              const ownedFarms = farms.filter((f) => f.user_id === profile.id);
              return (
                <View key={profile.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={styles.userRow}>
                    <View style={[styles.farmIconWrap, { backgroundColor: profile.role === "admin" ? "#1B5E2020" : COLORS.tealLight }]}>
                      <Ionicons
                        name={profile.role === "admin" ? "shield-checkmark-outline" : "person-outline"}
                        size={18}
                        color={profile.role === "admin" ? COLORS.primary : COLORS.teal}
                      />
                    </View>
                    <View style={styles.farmInfo}>
                      <Text style={styles.farmName} numberOfLines={1}>{profile.email}</Text>
                      <Text style={styles.farmMeta}>
                        {ownedFarms.length} farm{ownedFarms.length !== 1 ? "s" : ""} · Joined {new Date(profile.created_at).toLocaleDateString("en-KE", { month: "short", year: "numeric" })}
                      </Text>
                    </View>
                    <View style={[styles.rolePill, profile.role === "admin" && styles.rolePillAdmin]}>
                      <Text style={[styles.rolePillText, profile.role === "admin" && styles.rolePillTextAdmin]}>
                        {profile.role}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center", gap: 16 },
  loadingText: { fontFamily: "DMSans_400Regular", fontSize: 14, color: COLORS.textSecondary },
  header: { paddingHorizontal: 20, paddingBottom: 16, gap: 4 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  headerLeft: { gap: 6 },
  adminBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  adminBadgeText: { fontFamily: "DMSans_700Bold", fontSize: 10, color: COLORS.white, letterSpacing: 1 },
  title: { fontFamily: "DMSans_700Bold", fontSize: 28, color: COLORS.text, letterSpacing: -0.5 },
  subtitle: { fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.textSecondary },
  signOutBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.borderLight, alignItems: "center", justifyContent: "center", marginTop: 4 },
  statsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: COLORS.primarySurface, borderRadius: 14, padding: 14, gap: 4, alignItems: "center" },
  statCardWarn: { backgroundColor: COLORS.amberLight },
  statValue: { fontFamily: "DMSans_700Bold", fontSize: 22, color: COLORS.primary },
  statLabel: { fontFamily: "DMSans_400Regular", fontSize: 10, color: COLORS.textSecondary, textAlign: "center" },
  section: { paddingHorizontal: 20, marginBottom: 24, gap: 10 },
  sectionTitle: { fontFamily: "DMSans_700Bold", fontSize: 13, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  farmList: { backgroundColor: COLORS.cardBg, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
  farmRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  farmIconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: COLORS.primarySurface, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  farmInfo: { flex: 1, gap: 3 },
  farmName: { fontFamily: "DMSans_600SemiBold", fontSize: 14, color: COLORS.text },
  farmMeta: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary },
  farmTags: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 2 },
  ownerTag: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: COLORS.borderLight, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, maxWidth: 160 },
  ownerTagText: { fontFamily: "DMSans_400Regular", fontSize: 10, color: COLORS.textMuted },
  seasonTag: { backgroundColor: COLORS.primarySurface, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  seasonTagText: { fontFamily: "DMSans_500Medium", fontSize: 10, color: COLORS.primary },
  rolePill: { backgroundColor: COLORS.tealLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  rolePillAdmin: { backgroundColor: COLORS.primarySurface },
  rolePillText: { fontFamily: "DMSans_600SemiBold", fontSize: 11, color: COLORS.teal },
  rolePillTextAdmin: { color: COLORS.primary },
  divider: { height: 1, backgroundColor: COLORS.borderLight, marginLeft: 66 },
  emptyRow: { padding: 20, alignItems: "center" },
  emptyText: { fontFamily: "DMSans_400Regular", fontSize: 14, color: COLORS.textMuted },
});
