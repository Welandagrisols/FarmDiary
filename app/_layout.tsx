import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { FarmProvider } from "@/context/FarmContext";
import { AuthProvider } from "@/context/AuthContext";
import { migrateFromAsyncStorage } from "@/lib/migration";
import { seedIfNeeded } from "@/lib/storage";
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="farm-picker" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="inventory" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="observations" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="add-cost" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="log-activity" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="season-control" options={{ headerShown: false }} />
      <Stack.Screen name="season-report" options={{ headerShown: false }} />
      <Stack.Screen name="season-history" options={{ headerShown: false }} />
      <Stack.Screen name="season-setup" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="harvest" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="add-harvest" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="export" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="all-logs" options={{ headerShown: false }} />
      <Stack.Screen name="cost-breakdown" options={{ headerShown: false }} />
      <Stack.Screen name="edit-activity" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="farm-setup" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="farm-switcher" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });
  const [migrationDone, setMigrationDone] = useState(false);

  useEffect(() => {
    migrateFromAsyncStorage()
      .then(() => seedIfNeeded())
      .catch((err) => console.warn("[layout] seed error:", err))
      .finally(() => setMigrationDone(true));
  }, []);

  useEffect(() => {
    if (fontsLoaded && migrationDone) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, migrationDone]);

  if (!fontsLoaded || !migrationDone) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <AuthProvider>
              <FarmProvider>
                <RootLayoutNav />
              </FarmProvider>
            </AuthProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
