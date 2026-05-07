import React from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSync } from "@/context/SyncContext";
import COLORS from "@/constants/colors";

export function SyncBadge() {
  const { pendingCount, status, lastSynced, forceSync } = useSync();

  if (status === "syncing") {
    return (
      <View style={[styles.badge, styles.syncing]}>
        <ActivityIndicator size={11} color={COLORS.primary} />
        <Text style={[styles.label, { color: COLORS.primary }]}>Syncing…</Text>
      </View>
    );
  }

  if (pendingCount > 0) {
    return (
      <Pressable style={[styles.badge, styles.pending]} onPress={forceSync}>
        <Ionicons name="cloud-upload-outline" size={13} color={COLORS.amber} />
        <Text style={[styles.label, { color: COLORS.amberDark }]}>
          {pendingCount} pending — tap to sync
        </Text>
      </Pressable>
    );
  }

  if (status === "error") {
    return (
      <Pressable style={[styles.badge, styles.error]} onPress={forceSync}>
        <Ionicons name="alert-circle-outline" size={13} color={COLORS.red} />
        <Text style={[styles.label, { color: COLORS.red }]}>Sync failed — tap to retry</Text>
      </Pressable>
    );
  }

  if (lastSynced) {
    return (
      <View style={[styles.badge, styles.ok]}>
        <Ionicons name="checkmark-circle-outline" size={13} color={COLORS.primary} />
        <Text style={[styles.label, { color: COLORS.primary }]}>Synced to cloud</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  label: {
    fontFamily: "DMSans_500Medium",
    fontSize: 11,
  },
  syncing: { backgroundColor: COLORS.primarySurface },
  pending: { backgroundColor: COLORS.amberLight },
  error: { backgroundColor: COLORS.redLight },
  ok: { backgroundColor: COLORS.primarySurface },
});
