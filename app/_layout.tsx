import { QueryClientProvider } from "@tanstack/react-query";
import { router, Stack, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { FarmProvider } from "@/context/FarmContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { SyncProvider } from "@/context/SyncContext";
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";

SplashScreen.preventAutoHideAsync();

function AuthRedirectGuard() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === "auth";
    if (!user && !inAuthGroup) {
      router.replace("/auth");
    }
  }, [user, isLoading, segments]);

  return null;
}

function RootLayoutNav() {
  return (
    <>
      <AuthRedirectGuard />
      <Stack screenOptions={{ headerBackTitle: "Back" }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="migration" options={{ headerShown: false }} />
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
        <Stack.Screen name="personal-expenses" options={{ headerShown: false }} />
        <Stack.Screen name="add-personal-expense" options={{ headerShown: false, presentation: "modal" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <AuthProvider>
              <SyncProvider>
                <FarmProvider>
                  <RootLayoutNav />
                </FarmProvider>
              </SyncProvider>
            </AuthProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
