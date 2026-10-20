import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { hasLegacyFarmData } from "@/lib/migration";
import { hasMigrated, markMigrated } from "@/lib/supabase-storage";
import COLORS from "@/constants/colors";

export default function Index() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    let cancelled = false;

    if (!user) {
      router.replace("/auth");
      return () => {
        cancelled = true;
      };
    }

    const redirectAfterMigrationCheck = async () => {
      try {
        if (await hasMigrated()) {
          if (!cancelled) router.replace("/farm-picker");
          return;
        }

        if (await hasLegacyFarmData()) {
          if (!cancelled) router.replace("/migration");
          return;
        }

        await markMigrated();
        if (!cancelled) router.replace("/farm-picker");
      } catch (error) {
        console.warn("[index] Could not check existing farm data:", error);
        if (!cancelled) router.replace("/migration");
      }
    };

    void redirectAfterMigrationCheck();
    return () => {
      cancelled = true;
    };
  }, [user, isLoading]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },
});
