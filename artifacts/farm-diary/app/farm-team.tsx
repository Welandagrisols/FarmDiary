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
import COLORS, { CARD_SHADOW } from "@/constants/colors";
import { useFarm } from "@/context/FarmContext";
import { farmTeamApi } from "@/lib/api";
import { addFarmWorker, getFarmWorkers, setFarmWorkerActive } from "@/lib/supabase-storage";
import type { FarmWorker } from "@/lib/storage";

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
  const [workers, setWorkers] = useState<FarmWorker[]>([]);
  const [currentRole, setCurrentRole] = useState("none");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workerName, setWorkerName] = useState("");
  const [role, setRole] = useState<TeamRole>("seller");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingWorker, setSavingWorker] = useState(false);
  const [showArchivedWorkers, setShowArchivedWorkers] = useState(false);

  const topPadding = Platform.OS === "web" ? 60 : insets.top + 8;
  const canAddManager = currentRole === "owner" || currentRole === "admin";
  const activeWorkers = workers.filter((worker) => worker.is_active);
  const archivedWorkers = workers.filter((worker) => !worker.is_active);

  const loadTeam = useCallback(async () => {
    if (!activeFarm?.id) {
      setMembers([]);
      setWorkers([]);
      setLoading(false);
      return;
    }
    try {
      const [response, roster] = await Promise.all([
        farmTeamApi.list(activeFarm.id),
        getFarmWorkers(activeFarm.id, true),
      ]);
      setMembers(response.members || []);
      setWorkers(roster);
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

  const handleAddWorker = async () => {
    if (!activeFarm?.id) return;
    const name = workerName.trim();
    if (!name) {
      Alert.alert("Name required", "Enter the worker’s name.");
      return;
    }
    if (activeWorkers.some((worker) => worker.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      Alert.alert("Name already added", "Choose this worker from the existing list instead.");
      return;
    }
    setSavingWorker(true);
    try {
      const worker = await addFarmWorker(activeFarm.id, name);
      setWorkers((current) => [...current, worker].sort((a, b) => a.name.localeCompare(b.name)));
      setWorkerName("");
    } catch (error: any) {
      Alert.alert("Could not add worker name", error?.message || "Try again.");
    } finally {
      setSavingWorker(false);
    }
  };

  const handleToggleWorker = (worker: FarmWorker) => {
    const activate = !worker.is_active;
    Alert.alert(
      activate ? "Restore worker name?" : "Archive worker name?",
      activate
        ? `${worker.name} will be available for new activity records.`
        : `${worker.name} will be hidden from new activity records. Existing records will keep the name.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: activate ? "Restore" : "Archive",
          style: activate ? "default" : "destructive",
          onPress: async () => {
            setSavingWorker(true);
            try {
              const updated = await setFarmWorkerActive(worker, activate);
              setWorkers((current) => current.map((item) => item.id === updated.id ? updated : item));
            } catch (error: any) {
              Alert.alert("Could not update worker name", error?.message || "Try again.");
            } finally {
              setSavingWorker(false);
            }
          },
        },
      ],
    );
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

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Worker names</Text>
        <Text style={styles.helperTextLeft}>
          Add names for activity tracking. These workers do not need app accounts.
        </Text>
        <View style={styles.workerInputRow}>
          <TextInput
            style={[styles.input, styles.workerInput]}
            value={workerName}
            onChangeText={setWorkerName}
            placeholder="Worker name"
            placeholderTextColor={COLORS.textMuted}
            returnKeyType="done"
            onSubmitEditing={handleAddWorker}
            accessibilityLabel="Worker name"
          />
          <Pressable
            style={[styles.addWorkerButton, savingWorker && styles.buttonDisabled]}
            onPress={handleAddWorker}
            disabled={savingWorker}
            accessibilityLabel="Add worker name"
            testID="add-farm-worker"
          >
            {savingWorker
              ? <ActivityIndicator color={COLORS.white} size="small" />
              : <Ionicons name="add" size={22} color={COLORS.white} />}
          </Pressable>
        </View>
        {activeWorkers.length ? activeWorkers.map((worker) => (
          <View key={worker.id} style={styles.workerRosterRow}>
            <View style={styles.memberIcon}>
              <Ionicons name="person-outline" size={17} color={COLORS.primary} />
            </View>
            <Text style={styles.workerRosterName}>{worker.name}</Text>
            <Pressable
              style={styles.workerRosterAction}
              onPress={() => handleToggleWorker(worker)}
              accessibilityLabel={`Archive ${worker.name}`}
            >
              <Ionicons name="archive-outline" size={18} color={COLORS.textSecondary} />
            </Pressable>
          </View>
        )) : (
          <View style={styles.emptyRoster}>
            <Text style={styles.helperText}>No worker names yet. Add the people who do farm work.</Text>
          </View>
        )}
        {archivedWorkers.length ? (
          <>
            <Pressable
              style={styles.archivedToggle}
              onPress={() => setShowArchivedWorkers((visible) => !visible)}
              accessibilityRole="button"
              accessibilityState={{ expanded: showArchivedWorkers }}
            >
              <Text style={styles.archivedToggleText}>
                {showArchivedWorkers ? "Hide archived" : `Archived names (${archivedWorkers.length})`}
              </Text>
              <Ionicons name={showArchivedWorkers ? "chevron-up" : "chevron-down"} size={16} color={COLORS.textSecondary} />
            </Pressable>
            {showArchivedWorkers ? archivedWorkers.map((worker) => (
              <View key={worker.id} style={[styles.workerRosterRow, styles.archivedWorkerRow]}>
                <View style={styles.memberIcon}>
                  <Ionicons name="person-outline" size={17} color={COLORS.textMuted} />
                </View>
                <Text style={[styles.workerRosterName, styles.archivedWorkerName]}>{worker.name}</Text>
                <Pressable
                  style={styles.workerRosterAction}
                  onPress={() => handleToggleWorker(worker)}
                  accessibilityLabel={`Restore ${worker.name}`}
                >
                  <Ionicons name="refresh" size={18} color={COLORS.primary} />
                </Pressable>
              </View>
            )) : null}
          </>
        ) : null}
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
  title: { fontFamily: "Manrope_700Bold", fontSize: 22, color: COLORS.text },
  subtitle: {
    fontFamily: "Manrope_400Regular",
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 16,
    gap: 10,
    ...CARD_SHADOW,
  },
  cardTitle: {
    fontFamily: "Manrope_700Bold",
    fontSize: 17,
    color: COLORS.text,
  },
  helperText: {
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    textAlign: "center",
  },
  fieldLabel: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 13,
    color: COLORS.text,
    marginTop: 2,
  },
  helperTextLeft: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
    textAlign: "left",
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontFamily: "Manrope_400Regular",
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  roleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roleChip: { paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18 },
  roleChipActive: { backgroundColor: COLORS.primarySurface, borderColor: COLORS.primary },
  roleChipText: {
    fontFamily: "Manrope_500Medium",
    fontSize: 13,
    color: COLORS.textSecondary,
    textTransform: "capitalize",
  },
  roleChipTextActive: { color: COLORS.primary },
  primaryButton: { minHeight: 46, borderRadius: 11, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center", marginTop: 4 },
  primaryButtonText: {
    fontFamily: "Manrope_700Bold",
    fontSize: 15,
    color: COLORS.white,
  },
  buttonDisabled: { opacity: 0.65 },
  workerInputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  workerInput: { flex: 1 },
  addWorkerButton: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  workerRosterRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  workerRosterName: { flex: 1, fontFamily: "Manrope_600SemiBold", fontSize: 14, color: COLORS.text },
  workerRosterAction: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  emptyRoster: { paddingVertical: 8 },
  archivedToggle: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  archivedToggleText: { fontFamily: "Manrope_600SemiBold", fontSize: 13, color: COLORS.textSecondary },
  archivedWorkerRow: { opacity: 0.72 },
  archivedWorkerName: { color: COLORS.textSecondary },
  secondaryButton: { marginTop: 8, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.primarySurface },
  secondaryButtonText: {
    fontFamily: "Manrope_600SemiBold",
    color: COLORS.primary,
    fontSize: 14,
  },
  listHeader: { marginHorizontal: 18, marginBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  memberRow: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    ...CARD_SHADOW,
  },
  memberIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.primarySurface, alignItems: "center", justifyContent: "center" },
  memberEmail: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 14,
    color: COLORS.text,
  },
  memberRole: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 3,
    textTransform: "capitalize",
  },
  removeButton: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.redLight },
  emptyCard: {
    marginHorizontal: 16,
    padding: 20,
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    alignItems: "center",
    gap: 8,
    ...CARD_SHADOW,
  }});
