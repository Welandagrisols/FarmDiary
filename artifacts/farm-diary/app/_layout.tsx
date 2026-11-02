import { QueryClientProvider } from "@tanstack/react-query";
import COLORS from "@/constants/colors";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { FarmProvider } from "@/context/FarmContext";
import { AuthProvider } from "@/context/AuthContext";
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from "@expo-google-fonts/manrope";

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Back",
        headerShadowVisible: false,
        headerStyle: { backgroundColor: COLORS.background },
        headerTintColor: COLORS.text,
        headerTitleStyle: { fontFamily: "Manrope_700Bold", fontSize: 17, color: COLORS.text },
      }}
    >
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
      <Stack.Screen name="sales" options={{ title: "Sales" }} />
      <Stack.Screen name="farm-team" options={{ title: "Farm Team" }} />
      <Stack.Screen name="personal-expenses" options={{ title: "Personal Expenses" }} />
      <Stack.Screen name="add-personal-expense" options={{ title: "Add Expense" }} />
      <Stack.Screen name="admin" options={{ title: "Admin" }} />
      <Stack.Screen name="soil" options={{ headerShown: false }} />
      <Stack.Screen name="add-soil-test" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="soil-result" options={{ headerShown: false }} />
      <Stack.Screen name="soil-plan" options={{ headerShown: false }} />
      <Stack.Screen name="plots" options={{ headerShown: false }} />
      <Stack.Screen name="add-plot" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="map-boundary" options={{ headerShown: false }} />
      <Stack.Screen name="plot-boundary" options={{ headerShown: false }} />
      <Stack.Screen name="all-logs" options={{ headerShown: false }} />
      <Stack.Screen name="cost-breakdown" options={{ headerShown: false }} />
      <Stack.Screen name="edit-activity" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="farm-setup" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="farm-switcher" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

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
