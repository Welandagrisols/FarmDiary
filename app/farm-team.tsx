import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import COLORS from "@/constants/colors";
import { useFarm } from "@/context/FarmContext";
import { farmTeamApi } from "@/lib/api";

type TeamRole = "manager" | "seller" | "storekeeper";
interface TeamMember {
  user_id: string;
  email: string;
  role: TeamRole;
  created_at: string;
}

const ROLE_OPTIONS: { value: TeamRole; label: string }[] = [
  { value: "seller", label: "Seller" },
  { value: "storekeeper", label: "Storekeeper" },
  { value: "manager", label: "Manager" },
];

export default function FarmTeamScreen() {
  const insets = useSafeAreaInsets();
  const { activeFarm } = useFarm();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [currentRole, setCurrentRole] = useState("none");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<TeamRole>("seller");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const topPadding = Platform.OS === "web" ? 60 : insets.top + 8;
  const canAddManager = currentRole === "owner" || currentRole === "admin";

  const loadTeam = useCallback(async () => {
    if (!activeFarm?.id) {
      setMembers([]);
      setLoading(false);
      return;
    }
    try {
      const response = await farmTeamApi.list(activeFarm.id);
      setMembers(response.members || []);
      setCurrentRole(response.currentRole || "none");
    } catch (error: any) {
      Alert.alert("Unable to load team", error?.message || "Try again.");
    } finally {
      setLoading(false);
    }
  }, [activeFarm?.id]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  const handleCreate = async () => {
    if (!activeFarm?.id) return;
    if (!email.trim() || !email.includes("@")) {
      Alert.alert("Email required", "Enter the worker’s personal email address.");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Password too short", "Use at least 8 characters for the initial password.");
      return;
    }
    setSaving(true);
    try {
      await farmTeamApi.create(activeFarm.id, email.trim(), password, role);
      setEmail("");
      setPassword("");
      setRole("seller");
      await loadTeam();
      Alert.alert("Account created", "The worker can now sign in with their own account.");
    } catch (error: any) {
      Alert.alert("Could not create account", error?.message || "Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = (member: TeamMember) => {
    if (!activeFarm?.id) return;
    Alert.alert("Remove farm access", `Remove ${member.email} from ${activeFarm.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await farmTeamApi.remove(activeFarm.id, member.user_id);
            await loadTeam();
          } catch (error: any) {
            Alert.alert("Could not remove access", error?.message || "Try again.");
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: topPadding }]}>
        <ActivityIndicator color={COLORS.primary} />
        <Text style={styles.helperText}>Loading farm team…</Text>
      </View>
    );
  }

  if (!activeFarm) {
    return (
      <View style={[styles.centered, { paddingTop: topPadding }]}>
        <Text style={styles.title}>No farm selected</Text>
        <Text style={styles.helperText}>Select a farm before managing its team.</Text>
        <Pressable style={styles.secondaryButton} onPress={() => router.push("/farm-switcher")}>
          <Text style={styles.secondaryButtonText}>Choose a farm</Text>
        </Pressable>
      </View>
    );
  }

  if (!["owner", "manager", "admin"].includes(currentRole)) {
    return (
      <View style={[styles.centered, { paddingTop: topPadding }]}>
        <Text style={styles.title}>Farm team</Text>
        <Text style={styles.helperText}>Only the farm owner or manager can manage team accounts.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: topPadding, paddingBottom: insets.bottom + 32 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Farm team</Text>
          <Text style={styles.subtitle}>{activeFarm.name}</Text>
        </View>
        <Pressable onPress={loadTeam} style={styles.refreshButton} accessibilityLabel="Refresh team">
          <Ionicons name="refresh" size={18} color={COLORS.primary} />
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Create a worker account</Text>
        <Text style={styles.helperText}>
          Give each worker their own login. Do not share accounts or passwords.
        </Text>
        <Text style={styles.fieldLabel}>Personal email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="worker@example.com"
          placeholderTextColor={COLORS.textMuted}
        />
        <Text style={styles.fieldLabel}>Initial password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          placeholder="At least 8 characters"
          placeholderTextColor={COLORS.textMuted}
        />
        <Text style={styles.fieldLabel}>Farm role</Text>
        <View style={styles.roleRow}>
          {ROLE_OPTIONS.filter((option) => option.value !== "manager" || canAddManager).map((option) => (
            <Pressable
              key={option.value}
              style={[styles.roleChip, role === option.value && styles.roleChipActive]}
              onPress={() => setRole(option.value)}
            >
              <Text style={[styles.roleChipText, role === option.value && styles.roleChipTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          style={[styles.primaryButton, saving && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryButtonText}>Create account</Text>}
        </Pressable>
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.cardTitle}>Current team</Text>
        <Text style={styles.helperText}>{members.length} member{members.length === 1 ? "" : "s"}</Text>
      </View>
      {members.length ? members.map((member) => (
        <View key={member.user_id} style={styles.memberRow}>
          <View style={styles.memberIcon}>
            <Ionicons name="person-outline" size={17} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.memberEmail}>{member.email || member.user_id.slice(0, 8)}</Text>
            <Text style={styles.memberRole}>{member.role}</Text>
          </View>
          {(member.role !== "manager" || canAddManager) && (
            <Pressable
              style={styles.removeButton}
              onPress={() => handleRemove(member)}
              accessibilityLabel={`Remove ${member.email}`}
            >
              <Ionicons name="person-remove-outline" size={17} color={COLORS.red} />
            </Pressable>
          )}
        </View>
      )) : (
        <View style={styles.emptyCard}>
          <Ionicons name="people-outline" size={22} color={COLORS.textMuted} />
          <Text style={styles.helperText}>No workers have been added to this farm yet.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 10, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18, paddingBottom: 18 },
  backButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  refreshButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primarySurface, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: "DMSans_700Bold", fontSize: 22, color: COLORS.text },
  subtitle: { fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  card: { marginHorizontal: 16, marginBottom: 20, backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 16, gap: 10 },
  cardTitle: { fontFamily: "DMSans_700Bold", fontSize: 16, color: COLORS.text },
  helperText: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary, lineHeight: 18, textAlign: "center" },
  fieldLabel: { fontFamily: "DMSans_600SemiBold", fontSize: 12, color: COLORS.text, marginTop: 2 },
  input: { minHeight: 46, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, fontFamily: "DMSans_400Regular", fontSize: 14, color: COLORS.text, backgroundColor: COLORS.background },
  roleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roleChip: { paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18 },
  roleChipActive: { backgroundColor: COLORS.primarySurface, borderColor: COLORS.primary },
  roleChipText: { fontFamily: "DMSans_500Medium", fontSize: 12, color: COLORS.textSecondary, textTransform: "capitalize" },
  roleChipTextActive: { color: COLORS.primary },
  primaryButton: { minHeight: 46, borderRadius: 11, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center", marginTop: 4 },
  primaryButtonText: { fontFamily: "DMSans_700Bold", fontSize: 14, color: COLORS.white },
  buttonDisabled: { opacity: 0.65 },
  secondaryButton: { marginTop: 8, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.primarySurface },
  secondaryButtonText: { fontFamily: "DMSans_600SemiBold", color: COLORS.primary, fontSize: 13 },
  listHeader: { marginHorizontal: 18, marginBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  memberRow: { marginHorizontal: 16, marginBottom: 8, padding: 12, backgroundColor: COLORS.cardBg, borderRadius: 13, flexDirection: "row", alignItems: "center", gap: 10 },
  memberIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.primarySurface, alignItems: "center", justifyContent: "center" },
  memberEmail: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.text },
  memberRole: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textSecondary, marginTop: 3, textTransform: "capitalize" },
  removeButton: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.redLight },
  emptyCard: { marginHorizontal: 16, padding: 20, backgroundColor: COLORS.cardBg, borderRadius: 13, alignItems: "center", gap: 8 },
});
