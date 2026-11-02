import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import COLORS from "@/constants/colors";
import BoundaryMap from "@/components/BoundaryMap";
import { useFarm } from "@/context/FarmContext";
import {
  applyPendingBoundaries,
  clearBoundary,
  flushPendingBoundaries,
  getPendingBoundary,
  listBoundaryHistory,
  type BoundaryHistoryRow,
} from "@/lib/boundary-storage";
import {
  M2_PER_ACRE,
  areaM2,
  areaUncertaintyPct,
  formatAcres,
  formatCoord,
  googleMapsUrl,
  isRing,
  toGeoJSON,
  toKML,
} from "@/lib/geo";
import { getFarmRole, type FarmRole } from "@/lib/sales-storage";
import { listPlots } from "@/lib/soil-storage";
import type { PlotRecord } from "@/lib/soil";

function formatDay(value?: string | null): string {
  return value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";
}

export default function PlotBoundaryScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { activeFarm } = useFarm();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [plot, setPlot] = useState<PlotRecord | null>(null);
  const [role, setRole] = useState<FarmRole | null>(null);
  const [history, setHistory] = useState<BoundaryHistoryRow[]>([]);
  const [waiting, setWaiting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!activeFarm?.id || !id) {
      setLoading(false);
      return;
    }
    try {
      await flushPendingBoundaries();
      const [records, farmRole] = await Promise.all([listPlots(activeFarm.id), getFarmRole(activeFarm.id)]);
      const merged = await applyPendingBoundaries(records);
      const current = merged.find((item) => item.id === id) ?? null;
      setPlot(current);
      setRole(farmRole);
      setWaiting(!!(await getPendingBoundary(id)));
      if (current && ["admin", "owner", "manager"].includes(farmRole)) {
        setHistory(await listBoundaryHistory(id));
      } else {
        setHistory([]);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Try again.";
      Alert.alert("Could not load the plot", message);
    } finally {
      setLoading(false);
    }
  }, [activeFarm?.id, id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const canEdit = role ? ["admin", "owner", "manager"].includes(role) : false;
  const ring = plot?.boundary && isRing(plot.boundary) ? plot.boundary : null;
  const mapWidth = Math.max(240, width - 32);
  const area = plot?.boundary_area_m2 ?? (ring ? areaM2(ring) : 0);
  const acres = area / M2_PER_ACRE;
  const uncertainty = ring && plot?.boundary_accuracy_m
    ? areaUncertaintyPct(ring, plot.boundary_accuracy_m)
    : null;
  const enteredArea = plot?.area_acres ?? null;

  const shareGeoJson = async () => {
    if (!plot || !ring) return;
    const feature = toGeoJSON(plot.name, ring, {
      area_acres: Number(acres.toFixed(3)),
      area_m2: area,
      perimeter_m: plot.boundary_perimeter_m,
      gps_accuracy_m: plot.boundary_accuracy_m,
      method: plot.boundary_method,
      captured_at: plot.boundary_captured_at,
    });
    try {
      await Share.share({ title: `${plot.name} boundary`, message: JSON.stringify(feature, null, 2) });
    } catch (error: unknown) {
      Alert.alert("Could not share the outline", error instanceof Error ? error.message : "Try again.");
    }
  };

  const shareKml = async () => {
    if (!plot || !ring) return;
    try {
      await Share.share({ title: `${plot.name} boundary (KML)`, message: toKML(plot.name, ring) });
    } catch (error: unknown) {
      Alert.alert("Could not share the outline", error instanceof Error ? error.message : "Try again.");
    }
  };

  const remove = () => {
    if (!plot) return;
    Alert.alert("Remove this outline?", "The boundary will be removed. Earlier cloud-saved measurements are kept in history.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove outline",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await clearBoundary(plot.id);
            await load();
          } catch (error: unknown) {
            Alert.alert("Could not remove the outline", error instanceof Error ? error.message : "Try again.");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const Header = (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
        <Ionicons name="arrow-back" size={26} color={COLORS.text} />
      </Pressable>
      <Text style={styles.title}>Plot boundary</Text>
      <View style={{ width: 26 }} />
    </View>
  );

  if (loading) {
    return <View style={[styles.container, { paddingTop: topPadding }]}>{Header}<ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} /></View>;
  }
  if (!plot) {
    return <View style={[styles.container, { paddingTop: topPadding }]}>{Header}<Text style={[styles.body, { padding: 16 }]}>This plot could not be found.</Text></View>;
  }

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      {Header}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 36, gap: 14 }}>
        <Text style={styles.plotName}>{plot.name}</Text>
        {waiting ? (
          <View style={styles.notice}>
            <Ionicons name="phone-portrait-outline" size={22} color={COLORS.amberDark} />
            <View style={{ flex: 1 }}>
              <Text style={styles.noticeTitle}>Saved on this phone</Text>
              <Text style={styles.noticeText}>This boundary has not synced to the farm database yet. It will retry when the database is ready and you open Plots with a connection.</Text>
            </View>
            <Pressable onPress={() => { void load(); }} accessibilityRole="button" accessibilityLabel="Retry boundary sync">
              <Ionicons name="refresh" size={24} color={COLORS.primary} />
            </Pressable>
          </View>
        ) : null}

        {!ring ? (
          <View style={styles.empty}>
            <Ionicons name="map-outline" size={42} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>This plot is not mapped yet</Text>
            <Text style={styles.body}>Walk around its edge to capture GPS points and estimate its shape and size.</Text>
            {canEdit ? (
              <Pressable style={styles.primaryButton} onPress={() => router.push({ pathname: "/map-boundary", params: { id: plot.id } })} accessibilityRole="button" testID="map-this-plot">
                <Text style={styles.primaryText}>Map this plot</Text>
              </Pressable>
            ) : <Text style={styles.caption}>Only the farm owner or a manager can map a plot.</Text>}
          </View>
        ) : (
          <>
            <BoundaryMap polygons={[{ id: plot.id, ring, highlight: true }]} width={mapWidth} height={300} showSides />
            <View style={styles.card}>
              <Text style={styles.resultBig}>{formatAcres(acres)} acres</Text>
              <Text style={styles.secondary}>{(area / 10000).toFixed(3)} hectares · {Math.round(area).toLocaleString()} m²</Text>
              {plot.boundary_perimeter_m ? <Text style={styles.secondary}>Edge length: {Math.round(plot.boundary_perimeter_m)} m · {ring.length} points</Text> : null}
              {enteredArea ? (
                <Text style={styles.secondary}>
                  Entered size: {enteredArea} acres
                  {Math.abs(acres - enteredArea) / enteredArea > 0.05
                    ? ` · GPS estimate differs by ${(((acres - enteredArea) / enteredArea) * 100).toFixed(0)}%`
                    : " · close to GPS estimate"}
                </Text>
              ) : null}
            </View>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Measurement details</Text>
              <Text style={styles.secondary}>
                {plot.boundary_method === "walk" ? "Walked around the edge" : "Corners marked"}
                {plot.boundary_captured_at ? ` · ${formatDay(plot.boundary_captured_at)}` : ""}
              </Text>
              {plot.boundary_accuracy_m ? (
                <Text style={styles.secondary}>
                  GPS accuracy about {plot.boundary_accuracy_m.toFixed(0)} m
                  {uncertainty !== null ? ` · typical area uncertainty ±${uncertainty.toFixed(0)}%` : ""}
                </Text>
              ) : null}
              <Text style={styles.caption}>Phone GPS gives an estimate, not a legal survey.</Text>
            </View>
            {plot.boundary_center_lat != null && plot.boundary_center_lng != null ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Location</Text>
                <Text style={styles.secondary}>{formatCoord(plot.boundary_center_lat, plot.boundary_center_lng)}</Text>
                <Pressable
                  style={styles.outlineButton}
                  onPress={() => Linking.openURL(googleMapsUrl(plot.boundary_center_lat!, plot.boundary_center_lng!))}
                  accessibilityRole="button"
                >
                  <Ionicons name="navigate-outline" size={22} color={COLORS.primary} />
                  <Text style={styles.outlineText}>Open in Google Maps</Text>
                </Pressable>
              </View>
            ) : null}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Saved GPS points</Text>
              {ring.slice(0, 12).map(([lng, lat], index) => (
                <Text key={`${lat}-${lng}-${index}`} style={styles.coordinate}>
                  {String.fromCharCode(65 + (index % 26))}  {formatCoord(lat, lng)}
                </Text>
              ))}
              {ring.length > 12 ? <Text style={styles.caption}>The remaining points are included when you share this outline.</Text> : null}
            </View>
            <View style={styles.buttonRow}>
              <Pressable style={[styles.outlineButton, { flex: 1 }]} onPress={shareGeoJson} accessibilityRole="button">
                <Ionicons name="share-outline" size={20} color={COLORS.primary} /><Text style={styles.outlineText}>Share GeoJSON</Text>
              </Pressable>
              <Pressable style={[styles.outlineButton, { flex: 1 }]} onPress={shareKml} accessibilityRole="button">
                <Ionicons name="share-outline" size={20} color={COLORS.primary} /><Text style={styles.outlineText}>Share KML</Text>
              </Pressable>
            </View>
            {canEdit ? (
              <>
                <Pressable style={styles.primaryButton} onPress={() => router.push({ pathname: "/map-boundary", params: { id: plot.id } })} accessibilityRole="button">
                  <Text style={styles.primaryText}>Measure again</Text>
                </Pressable>
                <Pressable onPress={remove} disabled={busy} accessibilityRole="button">
                  <Text style={styles.danger}>{busy ? "Removing…" : "Remove boundary"}</Text>
                </Pressable>
              </>
            ) : null}
            {canEdit && history.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Earlier saved measurements</Text>
                {history.map((item) => (
                  <Text key={item.id} style={styles.secondary}>
                    {formatDay(item.captured_at ?? item.replaced_at)} · {item.area_m2 ? `${formatAcres(item.area_m2 / M2_PER_ACRE)} acres` : "size unavailable"}
                  </Text>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8, minHeight: 58 },
  title: { fontFamily: "Manrope_700Bold", fontSize: 32, color: COLORS.text },
  plotName: { fontFamily: "Manrope_700Bold", fontSize: 22, color: COLORS.text },
  body: { fontFamily: "Manrope_400Regular", fontSize: 15, color: COLORS.textSecondary, lineHeight: 23, textAlign: "center" },
  secondary: { fontFamily: "Manrope_400Regular", fontSize: 14, color: COLORS.textSecondary, lineHeight: 21 },
  caption: { fontFamily: "Manrope_400Regular", fontSize: 13, color: COLORS.textMuted, lineHeight: 19 },
  sectionTitle: { fontFamily: "Manrope_700Bold", fontSize: 17, color: COLORS.text },
  empty: { alignItems: "center", gap: 12, backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 22, borderWidth: 1, borderColor: COLORS.border },
  card: { backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 16, gap: 6, borderWidth: 1, borderColor: COLORS.border },
  resultBig: { fontFamily: "Manrope_700Bold", fontSize: 34, color: COLORS.primary },
  coordinate: { fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }), fontSize: 13, color: COLORS.text },
  primaryButton: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", minHeight: 54, width: "100%" },
  primaryText: { fontFamily: "Manrope_700Bold", fontSize: 16, color: COLORS.white, textAlign: "center" },
  outlineButton: { flexDirection: "row", gap: 8, justifyContent: "center", alignItems: "center", paddingVertical: 13, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.primary, backgroundColor: COLORS.cardBg },
  outlineText: { fontFamily: "Manrope_600SemiBold", fontSize: 13, color: COLORS.primary, textAlign: "center", flexShrink: 1 },
  buttonRow: { flexDirection: "row", gap: 10 },
  danger: { fontFamily: "Manrope_600SemiBold", fontSize: 15, color: COLORS.red, textAlign: "center", padding: 10 },
  notice: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.amberLight, borderRadius: 14, padding: 14 },
  noticeTitle: { fontFamily: "Manrope_700Bold", fontSize: 15, color: COLORS.amberDark },
  noticeText: { fontFamily: "Manrope_400Regular", fontSize: 14, color: COLORS.amberDark, lineHeight: 20 },
});
