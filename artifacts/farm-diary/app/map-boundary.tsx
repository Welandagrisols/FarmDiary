import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import COLORS from "@/constants/colors";
import BoundaryMap from "@/components/BoundaryMap";
import { useFarm } from "@/context/FarmContext";
import { saveBoundary, type BoundaryMethod } from "@/lib/boundary-storage";
import {
  GPS,
  M2_PER_ACRE,
  accuracyBand,
  areaM2,
  averageFixes,
  formatAcres,
  haversineM,
  measure,
  perimeterM,
  simplifyRing,
  validateRing,
  type GpsFix,
  type LngLat,
  type Measurement,
} from "@/lib/geo";
import { getFarmRole, type FarmRole } from "@/lib/sales-storage";
import { listPlots } from "@/lib/soil-storage";
import type { PlotRecord } from "@/lib/soil";

type Stage = "intro" | "capture" | "review";

const BAND_COLOR = {
  good: COLORS.green,
  ok: COLORS.amber,
  poor: COLORS.orange,
  unusable: COLORS.red,
} as const;
const BAND_TEXT = {
  good: "Good GPS signal",
  ok: "Fair GPS signal",
  poor: "Weak GPS signal",
  unusable: "Waiting for a usable signal",
} as const;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
}

export default function MapBoundaryScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { activeFarm } = useFarm();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [permission, requestPermission] = Location.useForegroundPermissions();

  const [plot, setPlot] = useState<PlotRecord | null>(null);
  const [role, setRole] = useState<FarmRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<Stage>("intro");
  const [mode, setMode] = useState<BoundaryMethod>("walk");
  const [fix, setFix] = useState<GpsFix | null>(null);
  const [points, setPoints] = useState<LngLat[]>([]);
  const [accuracies, setAccuracies] = useState<number[]>([]);
  const [walking, setWalking] = useState(false);
  const [marking, setMarking] = useState(false);
  const [markPercent, setMarkPercent] = useState(0);
  const [measurement, setMeasurement] = useState<Measurement | null>(null);
  const [useMeasuredArea, setUseMeasuredArea] = useState(true);
  const [saving, setSaving] = useState(false);

  const subscription = useRef<Location.LocationSubscription | null>(null);
  const recentFixes = useRef<GpsFix[]>([]);
  const pointsRef = useRef<LngLat[]>([]);
  const walkingRef = useRef(false);
  const lastAcceptedFix = useRef<GpsFix | null>(null);
  const markTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markTicker = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!activeFarm?.id || !id) return;
        const [plots, farmRole] = await Promise.all([
          listPlots(activeFarm.id),
          getFarmRole(activeFarm.id),
        ]);
        if (active) {
          setPlot(plots.find((item) => item.id === id) ?? null);
          setRole(farmRole);
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Try again.";
        Alert.alert("Could not load the plot", message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [activeFarm?.id, id]);

  const stopGps = useCallback(() => {
    subscription.current?.remove();
    subscription.current = null;
  }, []);

  useEffect(() => {
    return () => {
      stopGps();
      if (markTimer.current) clearTimeout(markTimer.current);
      if (markTicker.current) clearInterval(markTicker.current);
    };
  }, [stopGps]);

  const onFix = useCallback((location: Location.LocationObject) => {
    const nextFix: GpsFix = {
      lng: location.coords.longitude,
      lat: location.coords.latitude,
      accuracy: location.coords.accuracy ?? 999,
      t: location.timestamp || Date.now(),
    };
    setFix(nextFix);
    recentFixes.current = [...recentFixes.current.filter((item) => nextFix.t - item.t < 30000), nextFix];
    if (!walkingRef.current || nextFix.accuracy > GPS.WALK_MAX_ACCURACY_M) return;

    const previous = lastAcceptedFix.current;
    if (previous) {
      const elapsedSeconds = Math.max(0.5, (nextFix.t - previous.t) / 1000);
      if (haversineM([previous.lng, previous.lat], [nextFix.lng, nextFix.lat]) / elapsedSeconds > GPS.MAX_SPEED_MS) return;
    }
    lastAcceptedFix.current = nextFix;

    const lastPoint = pointsRef.current[pointsRef.current.length - 1];
    if (lastPoint && haversineM(lastPoint, [nextFix.lng, nextFix.lat]) < GPS.WALK_MIN_STEP_M) return;
    if (pointsRef.current.length >= GPS.MAX_POINTS) {
      walkingRef.current = false;
      setWalking(false);
      Alert.alert("Point limit reached", "This walk has reached the maximum of 500 points. Finish the outline before continuing.");
      return;
    }
    const nextPoints = [...pointsRef.current, [nextFix.lng, nextFix.lat] as LngLat];
    pointsRef.current = nextPoints;
    setPoints(nextPoints);
    setAccuracies((current) => [...current, nextFix.accuracy]);
  }, []);

  const startGps = useCallback(async () => {
    if (Platform.OS === "web") {
      Alert.alert("Use the Android app", "Plot mapping needs the phone's GPS and is available in the Android app.");
      return false;
    }
    try {
      const result = permission?.granted ? permission : await requestPermission();
      if (!result?.granted) return false;
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        Alert.alert("Turn on location", "Enable location services on the device, then try again.");
        return false;
      }
      stopGps();
      subscription.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
        onFix,
      );
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Turn on location services and try again.";
      Alert.alert("Location is not available", message);
      return false;
    }
  }, [onFix, permission, requestPermission, stopGps]);

  const begin = async () => {
    recentFixes.current = [];
    lastAcceptedFix.current = null;
    pointsRef.current = [];
    setPoints([]);
    setAccuracies([]);
    setWalking(false);
    walkingRef.current = false;
    setFix(null);
    if (await startGps()) setStage("capture");
  };

  const markCorner = () => {
    if (marking) return;
    const startedAt = Date.now();
    setMarking(true);
    setMarkPercent(0);
    markTicker.current = setInterval(() => setMarkPercent(Math.min(1, (Date.now() - startedAt) / 4000)), 150);
    markTimer.current = setTimeout(() => {
      if (markTicker.current) clearInterval(markTicker.current);
      markTicker.current = null;
      markTimer.current = null;
      setMarking(false);
      setMarkPercent(0);
      const availableFixes = recentFixes.current.filter((item) => item.t >= startedAt - 800);
      const averaged = averageFixes(availableFixes.length ? availableFixes : recentFixes.current.slice(-1));
      if (!averaged || averaged.accuracy > GPS.MAX_ACCEPT_M) {
        Alert.alert("GPS signal is too weak", "Move to open ground, wait a few seconds, then mark this corner again.");
        return;
      }
      const last = pointsRef.current[pointsRef.current.length - 1];
      if (last && haversineM(last, [averaged.lng, averaged.lat]) < GPS.MIN_CORNER_GAP_M) {
        Alert.alert("Same spot", "Walk at least 3 metres to the next corner before marking it.");
        return;
      }
      const nextPoints = [...pointsRef.current, [averaged.lng, averaged.lat] as LngLat];
      pointsRef.current = nextPoints;
      setPoints(nextPoints);
      setAccuracies((current) => [...current, averaged.accuracy]);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 4000);
  };

  const undo = () => {
    const nextPoints = pointsRef.current.slice(0, -1);
    pointsRef.current = nextPoints;
    setPoints(nextPoints);
    setAccuracies((current) => current.slice(0, -1));
  };

  const clearAll = () => {
    if (!pointsRef.current.length) return;
    Alert.alert("Start this outline again?", "All points marked so far will be removed.", [
      { text: "Keep points", style: "cancel" },
      {
        text: "Clear points",
        style: "destructive",
        onPress: () => {
          pointsRef.current = [];
          setPoints([]);
          setAccuracies([]);
          walkingRef.current = false;
          setWalking(false);
          lastAcceptedFix.current = null;
        },
      },
    ]);
  };

  const finish = () => {
    walkingRef.current = false;
    setWalking(false);
    const ring = mode === "walk" ? simplifyRing(pointsRef.current) : pointsRef.current;
    const check = validateRing(ring);
    if (!check.ok) {
      Alert.alert("Outline needs attention", check.problems.join("\n"));
      return;
    }
    setMeasurement(measure(ring, median(accuracies)));
    setUseMeasuredArea(!plot?.area_acres);
    stopGps();
    setStage("review");
  };

  const goBack = () => {
    if (stage === "capture" && pointsRef.current.length > 0) {
      Alert.alert("Leave without saving?", "The points you marked will be lost.", [
        { text: "Stay here", style: "cancel" },
        { text: "Leave", style: "destructive", onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  };

  const save = async () => {
    if (!measurement || !plot) return;
    setSaving(true);
    try {
      const result = await saveBoundary({
        plotId: plot.id,
        measurement,
        method: mode,
        useMeasuredArea,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (result.queued) {
        const message = result.reason === "database_setup"
          ? "The outline is saved on this phone. It will appear in the farm database after the boundary setup is applied."
          : "The outline is saved on this phone and will upload when the connection returns.";
        Alert.alert("Saved on this phone", message, [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        router.replace({ pathname: "/plot-boundary", params: { id: plot.id } });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Try again.";
      Alert.alert("Could not save the boundary", message);
    } finally {
      setSaving(false);
    }
  };

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const mapWidth = Math.max(240, width - 32);
  const band = accuracyBand(fix?.accuracy);
  const live = useMemo(() => ({
    perimeter: perimeterM(points, points.length >= 3),
    acres: points.length >= 3 ? areaM2(points) / M2_PER_ACRE : 0,
  }), [points]);
  const canMap = role ? ["admin", "owner", "manager"].includes(role) : false;
  const statedArea = plot?.area_acres ?? null;
  const differencePercent = measurement && statedArea
    ? ((measurement.acres - statedArea) / statedArea) * 100
    : null;

  const Header = (
    <View style={styles.header}>
      <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
        <Ionicons name="arrow-back" size={26} color={COLORS.text} />
      </Pressable>
      <Text style={styles.title}>Map boundary</Text>
      <View style={{ width: 26 }} />
    </View>
  );

  if (loading) {
    return <View style={[styles.container, { paddingTop: topPadding }]}>{Header}<ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} /></View>;
  }
  if (!plot) {
    return <View style={[styles.container, { paddingTop: topPadding }]}>{Header}<Text style={[styles.body, { padding: 16 }]}>This plot could not be found. It may have been archived or removed.</Text></View>;
  }
  if (!canMap) {
    return <View style={[styles.container, { paddingTop: topPadding }]}>{Header}<Text style={[styles.body, { padding: 16 }]}>Only the farm owner or a manager can map a plot boundary.</Text></View>;
  }

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      {Header}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 36, gap: 14 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.plotName}>{plot.name}</Text>

        {stage === "intro" ? (
          <>
            <Text style={styles.body}>Walk around the plot with your phone. Farm Diary records GPS points, draws the outline, and estimates its area and edge length.</Text>
            <Pressable style={[styles.modeCard, mode === "walk" && styles.modeActive]} onPress={() => setMode("walk")} accessibilityRole="button" testID="boundary-mode-walk">
              <Ionicons name="walk-outline" size={26} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Walk the edge</Text>
                <Text style={styles.secondary}>GPS points are added as you move. Best for curved or uneven edges. Keep the screen on.</Text>
              </View>
            </Pressable>
            <Pressable style={[styles.modeCard, mode === "corners" && styles.modeActive]} onPress={() => setMode("corners")} accessibilityRole="button" testID="boundary-mode-corners">
              <Ionicons name="location-outline" size={26} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Mark the corners</Text>
                <Text style={styles.secondary}>Stand still at each corner and tap. Useful for straight-sided plots.</Text>
              </View>
            </Pressable>
            <View style={styles.tips}>
              <Text style={styles.sectionTitle}>For a better measurement</Text>
              <Text style={styles.tip}>• Measure outdoors, away from tall trees and buildings.</Text>
              <Text style={styles.tip}>• Wait for a good or fair signal before walking.</Text>
              <Text style={styles.tip}>• Walk the edge in order without crossing your path.</Text>
              <Text style={styles.tip}>• Keep the screen on and hold the phone steadily.</Text>
              <Text style={styles.tip}>• GPS area is an estimate, not a legal survey.</Text>
            </View>
            {Platform.OS === "web" ? <Text style={styles.warning}>Open the Android app to record real GPS points.</Text> : null}
            {permission?.granted === false ? (
              <Text style={styles.warning}>Location permission is needed to record real plot points.</Text>
            ) : null}
            {permission?.status === "denied" && !permission.canAskAgain && Platform.OS !== "web" ? (
              <Pressable
                style={styles.outlineButton}
                onPress={() => { void Linking.openSettings().catch(() => Alert.alert("Could not open settings", "Allow location access for Farm Diary in your device settings.")); }}
                accessibilityRole="button"
              >
                <Text style={styles.outlineText}>Open location settings</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.primaryButton} onPress={begin} accessibilityRole="button" testID="start-boundary-measurement">
              <Text style={styles.primaryText}>Start measuring</Text>
            </Pressable>
          </>
        ) : null}

        {stage === "capture" ? (
          <>
            <View style={[styles.gpsBar, { borderColor: BAND_COLOR[band] }]}>
              <View style={[styles.gpsDot, { backgroundColor: BAND_COLOR[band] }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.gpsTitle}>{fix ? BAND_TEXT[band] : "Waiting for GPS…"}</Text>
                <Text style={styles.secondary}>{fix ? `Reported accuracy: about ${fix.accuracy.toFixed(0)} m` : "Stay in an open area for a few seconds."}</Text>
              </View>
            </View>
            <BoundaryMap polygons={[]} path={points} position={fix ? [fix.lng, fix.lat] : null} width={mapWidth} height={270} />
            <View style={styles.statsRow}>
              <View style={styles.stat}><Text style={styles.statNumber}>{points.length}</Text><Text style={styles.caption}>Points</Text></View>
              <View style={styles.stat}><Text style={styles.statNumber}>{live.perimeter.toFixed(0)} m</Text><Text style={styles.caption}>Edge traced</Text></View>
              <View style={styles.stat}><Text style={styles.statNumber}>{points.length >= 3 ? formatAcres(live.acres) : "—"}</Text><Text style={styles.caption}>Acres so far</Text></View>
            </View>
            {mode === "corners" ? (
              <Pressable
                style={[styles.primaryButton, (marking || !fix || band === "unusable") && styles.disabled]}
                onPress={markCorner}
                disabled={marking || !fix || band === "unusable"}
                accessibilityRole="button"
                testID="mark-boundary-corner"
              >
                <Text style={styles.primaryText}>{marking ? `Hold still… ${Math.round(markPercent * 100)}%` : `Mark corner ${String.fromCharCode(65 + (points.length % 26))}`}</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.primaryButton, walking && styles.pauseButton]}
                onPress={() => {
                  const next = !walkingRef.current;
                  walkingRef.current = next;
                  lastAcceptedFix.current = null;
                  setWalking(next);
                }}
                accessibilityRole="button"
                testID="toggle-walking"
              >
                <Text style={styles.primaryText}>{walking ? "Pause walking" : points.length ? "Continue walking" : "Start walking the edge"}</Text>
              </Pressable>
            )}
            <View style={styles.buttonRow}>
              <Pressable style={[styles.secondaryButton, !points.length && styles.disabled]} onPress={undo} disabled={!points.length} accessibilityRole="button">
                <Text style={styles.buttonLabel}>Undo last point</Text>
              </Pressable>
              <Pressable style={[styles.secondaryButton, !points.length && styles.disabled]} onPress={clearAll} disabled={!points.length} accessibilityRole="button">
                <Text style={styles.buttonLabel}>Start again</Text>
              </Pressable>
            </View>
            <Pressable style={[styles.finishButton, points.length < 3 && styles.disabled]} onPress={finish} disabled={points.length < 3} accessibilityRole="button" testID="finish-boundary">
              <Ionicons name="checkmark-circle-outline" size={22} color={COLORS.primary} />
              <Text style={styles.finishText}>Review shape and size</Text>
            </Pressable>
            <Text style={styles.captionCenter}>
              {mode === "corners"
                ? "Mark each corner in order around the plot. The outline closes back to the first."
                : "Walk all the way around, return near your starting point, then review."}
            </Text>
          </>
        ) : null}

        {stage === "review" && measurement ? (
          <>
            <BoundaryMap polygons={[{ id: "plot", ring: measurement.ring, highlight: true }]} width={mapWidth} height={290} showSides />
            <View style={styles.resultCard}>
              <Text style={styles.resultBig}>{formatAcres(measurement.acres)} acres</Text>
              <Text style={styles.secondary}>{measurement.hectares.toFixed(3)} hectares · {Math.round(measurement.areaM2).toLocaleString()} m²</Text>
              <Text style={styles.secondary}>Edge length: {Math.round(measurement.perimeterM)} m · {measurement.ring.length} points</Text>
              <Text style={styles.secondary}>Reported GPS accuracy: about {measurement.accuracyM.toFixed(0)} m</Text>
              <Text style={styles.secondary}>Estimated area uncertainty: ±{measurement.uncertaintyPct.toFixed(0)}%</Text>
            </View>
            {measurement.accuracyM > GPS.OK_M ? (
              <Text style={styles.warning}>The GPS signal was weak. The outline and area may be less accurate; try again in open ground if needed.</Text>
            ) : null}
            {differencePercent !== null && statedArea !== null ? (
              <View style={styles.compareCard}>
                <Text style={styles.secondary}>The entered size is {statedArea} acres. This GPS estimate is {formatAcres(measurement.acres)} acres ({differencePercent >= 0 ? "+" : ""}{differencePercent.toFixed(0)}%).</Text>
                <View style={styles.buttonRow}>
                  <Pressable style={[styles.choiceButton, useMeasuredArea && styles.choiceActive]} onPress={() => setUseMeasuredArea(true)}>
                    <Text style={[styles.buttonLabel, useMeasuredArea && styles.choiceTextActive]}>Use GPS size</Text>
                  </Pressable>
                  <Pressable style={[styles.choiceButton, !useMeasuredArea && styles.choiceActive]} onPress={() => setUseMeasuredArea(false)}>
                    <Text style={[styles.buttonLabel, !useMeasuredArea && styles.choiceTextActive]}>Keep entered size</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
            <Pressable style={[styles.primaryButton, saving && styles.disabled]} onPress={save} disabled={saving} accessibilityRole="button" testID="save-boundary">
              {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryText}>Save outline</Text>}
            </Pressable>
            <Pressable style={styles.textButton} onPress={() => { setMeasurement(null); setStage("intro"); }}>
              <Text style={styles.linkText}>Measure again</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8, minHeight: 58 },
  title: { fontFamily: "Manrope_700Bold", fontSize: 32, color: COLORS.text },
  plotName: { fontFamily: "Manrope_700Bold", fontSize: 22, color: COLORS.text },
  body: { fontFamily: "Manrope_400Regular", fontSize: 15, color: COLORS.textSecondary, lineHeight: 23 },
  secondary: { fontFamily: "Manrope_400Regular", fontSize: 14, color: COLORS.textSecondary, lineHeight: 21 },
  sectionTitle: { fontFamily: "Manrope_700Bold", fontSize: 17, color: COLORS.text },
  caption: { fontFamily: "Manrope_400Regular", fontSize: 13, color: COLORS.textSecondary, textAlign: "center" },
  modeCard: { flexDirection: "row", gap: 14, alignItems: "center", backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: COLORS.border },
  modeActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySurface },
  tips: { backgroundColor: COLORS.amberLight, borderRadius: 14, padding: 14, gap: 6 },
  tip: { fontFamily: "Manrope_400Regular", fontSize: 14, color: COLORS.text, lineHeight: 21 },
  warning: { fontFamily: "Manrope_500Medium", fontSize: 14, color: COLORS.amberDark, backgroundColor: COLORS.amberLight, borderRadius: 12, padding: 12, lineHeight: 21 },
  primaryButton: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", minHeight: 54 },
  primaryText: { fontFamily: "Manrope_700Bold", fontSize: 16, color: COLORS.white, textAlign: "center" },
  outlineButton: { borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 12, padding: 14, alignItems: "center" },
  outlineText: { fontFamily: "Manrope_700Bold", fontSize: 15, color: COLORS.primary },
  secondaryButton: { flex: 1, backgroundColor: COLORS.cardBg, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 10, alignItems: "center", borderWidth: 1, borderColor: COLORS.border },
  buttonLabel: { fontFamily: "Manrope_600SemiBold", fontSize: 14, color: COLORS.text, textAlign: "center" },
  finishButton: { flexDirection: "row", gap: 8, justifyContent: "center", alignItems: "center", paddingVertical: 15, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.primary, backgroundColor: COLORS.cardBg },
  finishText: { fontFamily: "Manrope_700Bold", fontSize: 15, color: COLORS.primary },
  buttonRow: { flexDirection: "row", gap: 10 },
  disabled: { opacity: 0.5 },
  pauseButton: { backgroundColor: COLORS.amberDark },
  gpsBar: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 14, borderWidth: 1.5 },
  gpsDot: { width: 16, height: 16, borderRadius: 8 },
  gpsTitle: { fontFamily: "Manrope_700Bold", fontSize: 15, color: COLORS.text },
  statsRow: { flexDirection: "row", backgroundColor: COLORS.cardBg, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 12 },
  stat: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 2 },
  statNumber: { fontFamily: "Manrope_700Bold", fontSize: 22, color: COLORS.primary, textAlign: "center" },
  resultCard: { backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, gap: 6 },
  resultBig: { fontFamily: "Manrope_700Bold", fontSize: 34, color: COLORS.primary },
  compareCard: { backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 14, gap: 12, borderWidth: 1, borderColor: COLORS.border },
  choiceButton: { flex: 1, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10, alignItems: "center", backgroundColor: COLORS.borderLight, borderWidth: 1, borderColor: COLORS.border },
  choiceActive: { backgroundColor: COLORS.primarySurface, borderColor: COLORS.primary },
  choiceTextActive: { color: COLORS.primary, fontFamily: "Manrope_700Bold" },
  textButton: { alignItems: "center", paddingVertical: 10 },
  linkText: { fontFamily: "Manrope_600SemiBold", fontSize: 15, color: COLORS.primary },
  captionCenter: { fontFamily: "Manrope_400Regular", fontSize: 13, color: COLORS.textMuted, lineHeight: 19, textAlign: "center" },
});
