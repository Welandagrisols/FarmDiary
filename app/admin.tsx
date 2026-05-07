import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, Platform, RefreshControl, Alert,
  Modal, TextInput, KeyboardAvoidingView, TouchableOpacity,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useFarm } from "@/context/FarmContext";
import { getAllFarmsAdmin, getAllUserProfiles, setActiveFarmId, getSeasons } from "@/lib/supabase-storage";
import { adminApi } from "@/lib/api";
import type { FarmRecord, UserProfile, SeasonRecord } from "@/lib/storage";

const LEASE_OPTIONS = ["Owned", "Leased", "Managed"];
const CROP_OPTIONS = ["Potato", "Maize", "Wheat", "Rice", "Beans", "Tomato", "Onion", "Cabbage", "Carrot", "Other"];

interface CreateUserForm { email: string; password: string; }
interface CreateFarmForm {
  name: string; location: string; total_acres: string;
  lease_status: string; crop_type: string; notes: string; user_id: string | null;
}

const EMPTY_FARM_FORM: CreateFarmForm = {
  name: "", location: "", total_acres: "", lease_status: "Owned",
  crop_type: "Potato", notes: "", user_id: null,
};

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { refresh } = useFarm();

  const [farms, setFarms] = useState<FarmRecord[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [seasons, setSeasons] = useState<SeasonRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Modals
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showCreateFarm, setShowCreateFarm] = useState(false);
  const [showAssignFarm, setShowAssignFarm] = useState<FarmRecord | null>(null);
  const [showLeasePicker, setShowLeasePicker] = useState(false);
  const [showCropPicker, setShowCropPicker] = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);

  // Forms
  const [userForm, setUserForm] = useState<CreateUserForm>({ email: "", password: "" });
  const [farmForm, setFarmForm] = useState<CreateFarmForm>(EMPTY_FARM_FORM);

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

  // ── Create User ───────────────────────────────────────────────────
  const handleCreateUser = async () => {
    if (!userForm.email.trim()) { Alert.alert("Missing", "Enter an email address"); return; }
    if (userForm.password.length < 6) { Alert.alert("Weak password", "Password must be at least 6 characters"); return; }
    setSaving(true);
    try {
      await adminApi.createUser(userForm.email.trim(), userForm.password);
      setShowCreateUser(false);
      setUserForm({ email: "", password: "" });
      await load();
      Alert.alert("Done", "User account created successfully.");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to create user");
    } finally {
      setSaving(false);
    }
  };

  // ── Create Farm ───────────────────────────────────────────────────
  const handleCreateFarm = async () => {
    if (!farmForm.name.trim()) { Alert.alert("Missing", "Farm name is required"); return; }
    setSaving(true);
    try {
      await adminApi.createFarm({ ...farmForm, name: farmForm.name.trim() });
      setShowCreateFarm(false);
      setFarmForm(EMPTY_FARM_FORM);
      await load();
      Alert.alert("Done", "Farm created successfully.");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to create farm");
    } finally {
      setSaving(false);
    }
  };

  // ── Change Role ───────────────────────────────────────────────────
  const handleToggleRole = (profile: UserProfile) => {
    const newRole = profile.role === "admin" ? "farmer" : "admin";
    Alert.alert(
      "Change Role",
      `Make ${profile.email} a${newRole === "admin" ? "n admin" : " farmer"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Change", onPress: async () => {
            try {
              await adminApi.updateRole(profile.id, newRole);
              await load();
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to update role");
            }
          }
        },
      ]
    );
  };

  // ── Delete User ───────────────────────────────────────────────────
  const handleDeleteUser = (profile: UserProfile) => {
    Alert.alert(
      "Delete User",
      `Permanently delete ${profile.email}? Their farms will become unassigned but data is kept.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive", onPress: async () => {
            try {
              await adminApi.deleteUser(profile.id);
              await load();
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to delete user");
            }
          }
        },
      ]
    );
  };

  // ── Assign Farm ───────────────────────────────────────────────────
  const handleAssignFarm = async (farm: FarmRecord, userId: string | null) => {
    try {
      await adminApi.assignFarm(farm.id, userId);
      setShowAssignFarm(null);
      await load();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to assign farm");
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────
  const emailForFarm = (farm: FarmRecord): string => {
    if (!farm.user_id) return "Unassigned";
    const p = profiles.find((p) => p.id === farm.user_id);
    return p?.email || farm.user_id.slice(0, 8) + "…";
  };
  const seasonsForFarm = (farmId: string) => seasons.filter((s) => s.farm_id === farmId);
  const userCount = profiles.length;
  const farmerCount = profiles.filter((p) => p.role === "farmer").length;
  const unclaimedCount = farms.filter((f) => !f.user_id).length;
  const selectedUserEmail = farmForm.user_id
    ? profiles.find((p) => p.id === farmForm.user_id)?.email ?? "Unknown"
    : "No assignment";

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: topPad }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading admin data…</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: topPad, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Header */}
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

        {/* Stats */}
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

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <Pressable style={styles.actionBtn} onPress={() => setShowCreateUser(true)}>
            <Ionicons name="person-add-outline" size={18} color={COLORS.white} />
            <Text style={styles.actionBtnText}>New User</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.actionBtnSecondary]} onPress={() => { setFarmForm(EMPTY_FARM_FORM); setShowCreateFarm(true); }}>
            <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
            <Text style={[styles.actionBtnText, { color: COLORS.primary }]}>New Farm</Text>
          </Pressable>
        </View>

        {/* Farms */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Farms ({farms.length})</Text>
          <View style={styles.card}>
            {farms.length === 0 ? (
              <View style={styles.emptyRow}>
                <Text style={styles.emptyText}>No farms yet. Create one above.</Text>
              </View>
            ) : farms.map((farm, i) => {
              const farmSeasons = seasonsForFarm(farm.id);
              const activeSeason = farmSeasons.find((s) => s.status === "active");
              const email = emailForFarm(farm);
              return (
                <View key={farm.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={styles.farmRow}>
                    <View style={styles.farmIconWrap}>
                      <Ionicons name="leaf" size={20} color={COLORS.primary} />
                    </View>
                    <View style={styles.farmInfo}>
                      <Text style={styles.farmName} numberOfLines={1}>{farm.name}</Text>
                      <Text style={styles.farmMeta} numberOfLines={1}>
                        {farm.location || "—"}{farm.total_acres ? ` · ${farm.total_acres} ac` : ""}{farm.crop_type ? ` · ${farm.crop_type}` : ""}
                      </Text>
                      <View style={styles.farmTags}>
                        <View style={[styles.ownerTag, !farm.user_id && { backgroundColor: COLORS.amberLight }]}>
                          <Ionicons name="person-outline" size={10} color={farm.user_id ? COLORS.textMuted : COLORS.amberDark} />
                          <Text style={[styles.ownerTagText, !farm.user_id && { color: COLORS.amberDark }]} numberOfLines={1}>{email}</Text>
                        </View>
                        {activeSeason && (
                          <View style={styles.seasonTag}>
                            <Text style={styles.seasonTagText}>{activeSeason.season_name}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={styles.farmActions}>
                      <Pressable
                        style={styles.iconActionBtn}
                        onPress={() => setShowAssignFarm(farm)}
                      >
                        <Ionicons name="person-circle-outline" size={20} color={COLORS.textSecondary} />
                      </Pressable>
                      <Pressable
                        style={[styles.iconActionBtn, { backgroundColor: COLORS.primarySurface }]}
                        onPress={() => viewFarm(farm)}
                      >
                        <Ionicons name="eye-outline" size={18} color={COLORS.primary} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Users */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Registered Users ({userCount})</Text>
          <View style={styles.card}>
            {profiles.length === 0 ? (
              <View style={styles.emptyRow}>
                <Text style={styles.emptyText}>No users yet. Create one above.</Text>
              </View>
            ) : profiles.map((profile, i) => {
              const ownedFarms = farms.filter((f) => f.user_id === profile.id);
              const isProfileAdmin = profile.role === "admin";
              return (
                <View key={profile.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={styles.userRow}>
                    <View style={[styles.farmIconWrap, { backgroundColor: isProfileAdmin ? COLORS.primarySurface : COLORS.tealLight }]}>
                      <Ionicons
                        name={isProfileAdmin ? "shield-checkmark-outline" : "person-outline"}
                        size={18}
                        color={isProfileAdmin ? COLORS.primary : COLORS.teal}
                      />
                    </View>
                    <View style={styles.farmInfo}>
                      <Text style={styles.farmName} numberOfLines={1}>{profile.email}</Text>
                      <Text style={styles.farmMeta}>
                        {ownedFarms.length} farm{ownedFarms.length !== 1 ? "s" : ""} · {new Date(profile.created_at).toLocaleDateString("en-KE", { month: "short", year: "numeric" })}
                      </Text>
                    </View>
                    <View style={styles.userActions}>
                      <Pressable
                        style={[styles.rolePill, isProfileAdmin && styles.rolePillAdmin]}
                        onPress={() => handleToggleRole(profile)}
                      >
                        <Text style={[styles.rolePillText, isProfileAdmin && styles.rolePillTextAdmin]}>
                          {profile.role}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={styles.deleteBtn}
                        onPress={() => handleDeleteUser(profile)}
                      >
                        <Ionicons name="trash-outline" size={15} color={COLORS.red} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* ── Create User Modal ───────────────────────────────────────────── */}
      <Modal visible={showCreateUser} transparent animationType="slide" onRequestClose={() => setShowCreateUser(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowCreateUser(false)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New User Account</Text>
              <Pressable onPress={() => setShowCreateUser(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.modalSub}>Creates a sign-in account for a farmer. They can log in immediately.</Text>

            <Text style={styles.fieldLabel}>Email Address</Text>
            <TextInput
              style={styles.input}
              value={userForm.email}
              onChangeText={(v) => setUserForm((f) => ({ ...f, email: v }))}
              placeholder="farmer@example.com"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <Text style={styles.fieldLabel}>Temporary Password</Text>
            <TextInput
              style={styles.input}
              value={userForm.password}
              onChangeText={(v) => setUserForm((f) => ({ ...f, password: v }))}
              placeholder="Min. 6 characters"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry
            />

            <Pressable
              style={[styles.primaryBtn, saving && { opacity: 0.6 }]}
              onPress={handleCreateUser}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color={COLORS.white} />
                : <><Ionicons name="person-add-outline" size={18} color={COLORS.white} /><Text style={styles.primaryBtnText}>Create Account</Text></>
              }
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Create Farm Modal ───────────────────────────────────────────── */}
      <Modal visible={showCreateFarm} transparent animationType="slide" onRequestClose={() => setShowCreateFarm(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowCreateFarm(false)} />
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Farm</Text>
                <Pressable onPress={() => setShowCreateFarm(false)} hitSlop={12}>
                  <Ionicons name="close" size={22} color={COLORS.textSecondary} />
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>Farm Name *</Text>
              <TextInput
                style={styles.input}
                value={farmForm.name}
                onChangeText={(v) => setFarmForm((f) => ({ ...f, name: v }))}
                placeholder="e.g. Rift Valley Farm"
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={styles.fieldLabel}>Location</Text>
              <TextInput
                style={styles.input}
                value={farmForm.location}
                onChangeText={(v) => setFarmForm((f) => ({ ...f, location: v }))}
                placeholder="e.g. Nakuru, Kenya"
                placeholderTextColor={COLORS.textMuted}
              />

              <View style={styles.rowFields}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Total Acres</Text>
                  <TextInput
                    style={styles.input}
                    value={farmForm.total_acres}
                    onChangeText={(v) => setFarmForm((f) => ({ ...f, total_acres: v }))}
                    placeholder="0"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Ownership</Text>
                  <Pressable style={styles.pickerBtn} onPress={() => setShowLeasePicker(true)}>
                    <Text style={styles.pickerBtnText}>{farmForm.lease_status}</Text>
                    <Ionicons name="chevron-down" size={14} color={COLORS.textMuted} />
                  </Pressable>
                </View>
              </View>

              <Text style={styles.fieldLabel}>Primary Crop</Text>
              <Pressable style={styles.pickerBtn} onPress={() => setShowCropPicker(true)}>
                <Text style={styles.pickerBtnText}>{farmForm.crop_type}</Text>
                <Ionicons name="chevron-down" size={14} color={COLORS.textMuted} />
              </Pressable>

              <Text style={styles.fieldLabel}>Assign to Farmer</Text>
              <Pressable style={styles.pickerBtn} onPress={() => setShowUserPicker(true)}>
                <Ionicons name="person-outline" size={15} color={farmForm.user_id ? COLORS.primary : COLORS.textMuted} />
                <Text style={[styles.pickerBtnText, farmForm.user_id && { color: COLORS.primary }]}>{selectedUserEmail}</Text>
                <Ionicons name="chevron-down" size={14} color={COLORS.textMuted} />
              </Pressable>

              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                style={[styles.input, { height: 72, textAlignVertical: "top" }]}
                value={farmForm.notes}
                onChangeText={(v) => setFarmForm((f) => ({ ...f, notes: v }))}
                placeholder="Any additional notes…"
                placeholderTextColor={COLORS.textMuted}
                multiline
              />

              <Pressable
                style={[styles.primaryBtn, saving && { opacity: 0.6 }]}
                onPress={handleCreateFarm}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator size="small" color={COLORS.white} />
                  : <><Ionicons name="add-circle-outline" size={18} color={COLORS.white} /><Text style={styles.primaryBtnText}>Create Farm</Text></>
                }
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Assign Farm Modal ───────────────────────────────────────────── */}
      <Modal visible={!!showAssignFarm} transparent animationType="slide" onRequestClose={() => setShowAssignFarm(null)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowAssignFarm(null)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Farm</Text>
              <Pressable onPress={() => setShowAssignFarm(null)} hitSlop={12}>
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </Pressable>
            </View>
            {showAssignFarm && (
              <Text style={styles.modalSub}>Who should own <Text style={{ fontFamily: "DMSans_600SemiBold", color: COLORS.text }}>{showAssignFarm.name}</Text>?</Text>
            )}
            <View style={styles.userPickerList}>
              <Pressable
                style={[styles.userPickerRow, !showAssignFarm?.user_id && styles.userPickerRowActive]}
                onPress={() => showAssignFarm && handleAssignFarm(showAssignFarm, null)}
              >
                <Ionicons name="remove-circle-outline" size={18} color={COLORS.textMuted} />
                <Text style={styles.userPickerEmail}>Unassigned</Text>
                {!showAssignFarm?.user_id && <Ionicons name="checkmark" size={16} color={COLORS.primary} />}
              </Pressable>
              {profiles.map((p) => (
                <Pressable
                  key={p.id}
                  style={[styles.userPickerRow, showAssignFarm?.user_id === p.id && styles.userPickerRowActive]}
                  onPress={() => showAssignFarm && handleAssignFarm(showAssignFarm, p.id)}
                >
                  <Ionicons name="person-circle-outline" size={18} color={COLORS.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userPickerEmail} numberOfLines={1}>{p.email}</Text>
                    <Text style={styles.userPickerRole}>{p.role}</Text>
                  </View>
                  {showAssignFarm?.user_id === p.id && <Ionicons name="checkmark" size={16} color={COLORS.primary} />}
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Lease Picker ────────────────────────────────────────────────── */}
      <Modal visible={showLeasePicker} transparent animationType="fade" onRequestClose={() => setShowLeasePicker(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowLeasePicker(false)} />
          <View style={[styles.modalCard, { paddingBottom: 8 }]}>
            <Text style={styles.modalTitle}>Ownership Type</Text>
            {LEASE_OPTIONS.map((opt) => (
              <Pressable key={opt} style={styles.optionRow} onPress={() => { setFarmForm((f) => ({ ...f, lease_status: opt })); setShowLeasePicker(false); }}>
                <Text style={[styles.optionText, farmForm.lease_status === opt && { color: COLORS.primary, fontFamily: "DMSans_600SemiBold" }]}>{opt}</Text>
                {farmForm.lease_status === opt && <Ionicons name="checkmark" size={16} color={COLORS.primary} />}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      {/* ── Crop Picker ──────────────────────────────────────────────────── */}
      <Modal visible={showCropPicker} transparent animationType="fade" onRequestClose={() => setShowCropPicker(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowCropPicker(false)} />
          <View style={[styles.modalCard, { paddingBottom: 8 }]}>
            <Text style={styles.modalTitle}>Primary Crop</Text>
            {CROP_OPTIONS.map((opt) => (
              <Pressable key={opt} style={styles.optionRow} onPress={() => { setFarmForm((f) => ({ ...f, crop_type: opt })); setShowCropPicker(false); }}>
                <Text style={[styles.optionText, farmForm.crop_type === opt && { color: COLORS.primary, fontFamily: "DMSans_600SemiBold" }]}>{opt}</Text>
                {farmForm.crop_type === opt && <Ionicons name="checkmark" size={16} color={COLORS.primary} />}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      {/* ── User Picker (for farm form) ──────────────────────────────────── */}
      <Modal visible={showUserPicker} transparent animationType="fade" onRequestClose={() => setShowUserPicker(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowUserPicker(false)} />
          <View style={[styles.modalCard, { paddingBottom: 8 }]}>
            <Text style={styles.modalTitle}>Assign to Farmer</Text>
            <Pressable style={styles.optionRow} onPress={() => { setFarmForm((f) => ({ ...f, user_id: null })); setShowUserPicker(false); }}>
              <Text style={[styles.optionText, !farmForm.user_id && { color: COLORS.primary, fontFamily: "DMSans_600SemiBold" }]}>No assignment</Text>
              {!farmForm.user_id && <Ionicons name="checkmark" size={16} color={COLORS.primary} />}
            </Pressable>
            {profiles.map((p) => (
              <Pressable key={p.id} style={styles.optionRow} onPress={() => { setFarmForm((f) => ({ ...f, user_id: p.id })); setShowUserPicker(false); }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionText, farmForm.user_id === p.id && { color: COLORS.primary, fontFamily: "DMSans_600SemiBold" }]} numberOfLines={1}>{p.email}</Text>
                  <Text style={styles.userPickerRole}>{p.role}</Text>
                </View>
                {farmForm.user_id === p.id && <Ionicons name="checkmark" size={16} color={COLORS.primary} />}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </>
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

  statsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: COLORS.primarySurface, borderRadius: 14, padding: 14, gap: 4, alignItems: "center" },
  statCardWarn: { backgroundColor: COLORS.amberLight },
  statValue: { fontFamily: "DMSans_700Bold", fontSize: 22, color: COLORS.primary },
  statLabel: { fontFamily: "DMSans_400Regular", fontSize: 10, color: COLORS.textSecondary, textAlign: "center" },

  actionRow: { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginBottom: 24 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 13 },
  actionBtnSecondary: { backgroundColor: COLORS.primarySurface, borderWidth: 1.5, borderColor: COLORS.primary + "40" },
  actionBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 14, color: COLORS.white },

  section: { paddingHorizontal: 20, marginBottom: 24, gap: 10 },
  sectionTitle: { fontFamily: "DMSans_700Bold", fontSize: 13, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  card: { backgroundColor: COLORS.cardBg, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },

  farmRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  farmIconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: COLORS.primarySurface, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  farmInfo: { flex: 1, gap: 3 },
  farmName: { fontFamily: "DMSans_600SemiBold", fontSize: 14, color: COLORS.text },
  farmMeta: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary },
  farmTags: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 2 },
  ownerTag: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: COLORS.borderLight, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, maxWidth: 180 },
  ownerTagText: { fontFamily: "DMSans_400Regular", fontSize: 10, color: COLORS.textMuted },
  seasonTag: { backgroundColor: COLORS.primarySurface, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  seasonTagText: { fontFamily: "DMSans_500Medium", fontSize: 10, color: COLORS.primary },
  farmActions: { flexDirection: "row", gap: 6 },
  iconActionBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.borderLight, alignItems: "center", justifyContent: "center" },
  userActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  rolePill: { backgroundColor: COLORS.tealLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  rolePillAdmin: { backgroundColor: COLORS.primarySurface },
  rolePillText: { fontFamily: "DMSans_600SemiBold", fontSize: 11, color: COLORS.teal },
  rolePillTextAdmin: { color: COLORS.primary },
  deleteBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: "#FFEBEE", alignItems: "center", justifyContent: "center" },
  divider: { height: 1, backgroundColor: COLORS.borderLight, marginLeft: 66 },
  emptyRow: { padding: 20, alignItems: "center" },
  emptyText: { fontFamily: "DMSans_400Regular", fontSize: 14, color: COLORS.textMuted },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalScrollContent: { justifyContent: "flex-end", flexGrow: 1 },
  modalCard: { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36, gap: 12 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  modalTitle: { fontFamily: "DMSans_700Bold", fontSize: 18, color: COLORS.text },
  modalSub: { fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 4 },

  fieldLabel: { fontFamily: "DMSans_500Medium", fontSize: 13, color: COLORS.textSecondary, marginBottom: -4 },
  input: { backgroundColor: COLORS.background, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 12, fontFamily: "DMSans_400Regular", fontSize: 15, color: COLORS.text },
  rowFields: { flexDirection: "row", gap: 10 },
  pickerBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.background, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 12 },
  pickerBtnText: { flex: 1, fontFamily: "DMSans_400Regular", fontSize: 15, color: COLORS.text },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, marginTop: 6 },
  primaryBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 15, color: COLORS.white },

  // User picker list
  userPickerList: { gap: 2 },
  userPickerRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10 },
  userPickerRowActive: { backgroundColor: COLORS.primarySurface },
  userPickerEmail: { flex: 1, fontFamily: "DMSans_500Medium", fontSize: 14, color: COLORS.text },
  userPickerRole: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textMuted, textTransform: "capitalize" },

  // Option rows (for pickers)
  optionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 13, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  optionText: { fontFamily: "DMSans_400Regular", fontSize: 15, color: COLORS.text },
});
