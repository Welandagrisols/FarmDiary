import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import COLORS, { CARD_SHADOW } from "@/constants/colors";
import { useFarm } from "@/context/FarmContext";
import { soilApi, type SoilUploadFile } from "@/lib/api";
import { createManualSoilTest, listPlots } from "@/lib/soil-storage";
import { SAMPLING_METHOD_LABELS, type PlotRecord, type SamplingMethod } from "@/lib/soil";

const MAX_PDF_BYTES = 15 * 1024 * 1024;

function mimeFor(asset: ImagePicker.ImagePickerAsset): string {
  const declared = (asset.mimeType || "").toLowerCase();
  if (declared === "image/jpg") return "image/jpeg";
  if (declared) return declared;
  const uri = asset.uri.toLowerCase();
  if (uri.endsWith(".png")) return "image/png";
  if (uri.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export default function AddSoilTestScreen() {
  const insets = useSafeAreaInsets();
  const { activeFarm } = useFarm();
  const params = useLocalSearchParams<{ plotId?: string }>();
  const [plots, setPlots] = useState<PlotRecord[]>([]);
  const [target, setTarget] = useState<string | null>(params.plotId ?? null); // null = whole farm
  const [method, setMethod] = useState<SamplingMethod>("unknown");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!activeFarm?.id) return;
    listPlots(activeFarm.id).then((p) => setPlots(p.filter((x) => !x.is_archived))).catch(() => setPlots([]));
  }, [activeFarm?.id]);

  const readAndSave = async (files: SoilUploadFile[]) => {
    if (!activeFarm?.id) return;
    setBusy("Reading your report…");
    try {
      const out = await soilApi.parseReport(activeFarm.id, files, { plotId: target, samplingMethod: method });
      setBusy(null);
      if (out.read_ok) {
        if (out.saved.length === 1) {
          router.replace({ pathname: "/soil-result", params: { id: out.saved[0].id } });
        } else {
          Alert.alert(
            `${out.saved.length} samples found`,
            "Each sample was saved as its own soil test. Open each one to check the values and set which plot it belongs to.",
          );
          router.replace("/soil");
        }
      } else {
        Alert.alert(
          "Saved, but not read yet",
          `${out.message || "The report could not be read automatically."}\n\nYour file is safe. Open it to try reading again, or enter the values by hand.`,
        );
        router.replace({ pathname: "/soil-result", params: { id: out.saved[0].id } });
      }
    } catch (e: any) {
      setBusy(null);
      Alert.alert("Could not read the report", e?.message || "Please try again.");
    }
  };

  const assetsToFiles = async (assets: ImagePicker.ImagePickerAsset[]): Promise<SoilUploadFile[]> =>
    Promise.all(assets.map(async (a, i) => ({
      name: a.fileName || `report-page-${i + 1}.jpg`,
      media_type: mimeFor(a),
      data: a.base64 || (await FileSystem.readAsStringAsync(a.uri, { encoding: "base64" })),
    })));

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("Camera access needed", "Allow camera access in your phone settings to photograph the report."); return; }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.5, base64: true });
    if (res.canceled || !res.assets?.length) return;
    await readAndSave(await assetsToFiles(res.assets));
  };

  const choosePhotos = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: 5, quality: 0.5, base64: true });
    if (res.canceled || !res.assets?.length) return;
    await readAndSave(await assetsToFiles(res.assets));
  };

  const choosePdf = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    if (asset.size && asset.size > MAX_PDF_BYTES) { Alert.alert("PDF too large", "Please choose a PDF under 15 MB."); return; }
    try {
      const data = await FileSystem.readAsStringAsync(asset.uri, { encoding: "base64" });
      await readAndSave([{ name: asset.name || "report.pdf", media_type: "application/pdf", data }]);
    } catch {
      Alert.alert("Could not open the PDF", "Try saving it to your phone again and choose it once more.");
    }
  };

  const enterManually = async () => {
    if (!activeFarm?.id) return;
    setBusy("Creating…");
    try {
      const test = await createManualSoilTest(activeFarm.id, target, method);
      setBusy(null);
      router.replace({ pathname: "/soil-result", params: { id: test.id, edit: "1" } });
    } catch (e: any) {
      setBusy(null);
      Alert.alert("Could not create the test", e?.message || "Try again.");
    }
  };

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const Option = ({ icon, title, sub, onPress }: { icon: any; title: string; sub: string; onPress: () => void }) => (
    <Pressable style={styles.option} onPress={onPress} disabled={!!busy}>
      <View style={styles.optionIcon}><Ionicons name={icon} size={22} color={COLORS.primary} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
    </Pressable>
  );

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="close" size={24} color={COLORS.text} /></Pressable>
        <Text style={styles.title}>Add soil test</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 16 }} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={styles.label}>Which part of the farm was sampled?</Text>
          <View style={styles.chipWrap}>
            <Pressable onPress={() => setTarget(null)} style={[styles.chip, target === null && styles.chipActive]}>
              <Text style={[styles.chipText, target === null && styles.chipTextActive]}>Whole farm</Text>
            </Pressable>
            {plots.map((p) => (
              <Pressable key={p.id} onPress={() => setTarget(p.id)} style={[styles.chip, target === p.id && styles.chipActive]}>
                <Text style={[styles.chipText, target === p.id && styles.chipTextActive]} numberOfLines={1}>{p.name}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => router.push("/add-plot")} style={[styles.chip, styles.chipAdd]}>
              <Ionicons name="add" size={14} color={COLORS.primary} />
              <Text style={[styles.chipText, { color: COLORS.primary }]}>New plot</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>If the report has several samples, each is saved separately and you can change its plot afterwards.</Text>
        </View>

        <View>
          <Text style={styles.label}>How was it sampled?</Text>
          <View style={styles.chipWrap}>
            {(Object.keys(SAMPLING_METHOD_LABELS) as SamplingMethod[]).map((m) => (
              <Pressable key={m} onPress={() => setMethod(m)} style={[styles.chip, method === m && styles.chipActive]}>
                <Text style={[styles.chipText, method === m && styles.chipTextActive]}>{SAMPLING_METHOD_LABELS[m]}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={styles.label}>Lab report</Text>
          <Option icon="camera-outline" title="Take a photo" sub="One page, read immediately" onPress={takePhoto} />
          <Option icon="images-outline" title="Choose photos" sub="Up to 5 pages of one report" onPress={choosePhotos} />
          <Option icon="document-text-outline" title="Upload a PDF" sub="Best results – e.g. emailed KALRO report" onPress={choosePdf} />
          <Option icon="create-outline" title="Enter values by hand" sub="No report file" onPress={enterManually} />
        </View>

        <Text style={styles.hint}>
          Reports are read by an AI service, so the photo or PDF is sent to it for reading. The farmer’s name and phone number are not recorded. Always check the values against the original before you confirm.
        </Text>
      </ScrollView>

      <Modal visible={!!busy} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.overlayTitle}>{busy}</Text>
            <Text style={styles.overlaySub}>This can take up to a minute. Please keep the app open.</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontFamily: "Manrope_700Bold", fontSize: 18, color: COLORS.text },
  label: {
    fontFamily: "Manrope_700Bold",
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 8,
  },
  hint: {
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginTop: 8,
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.border, maxWidth: 220 },
  chipActive: {
    backgroundColor: COLORS.ink,
    borderColor: COLORS.ink,
  },
  chipAdd: { borderStyle: "dashed", borderColor: COLORS.primary },
  chipText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  chipTextActive: { color: COLORS.white },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 14,
    ...CARD_SHADOW,
  },
  optionIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: COLORS.primarySurface, alignItems: "center", justifyContent: "center" },
  optionTitle: {
    fontFamily: "Manrope_700Bold",
    fontSize: 16,
    color: COLORS.text,
  },
  optionSub: {
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 24 },
  overlayCard: { backgroundColor: COLORS.white, borderRadius: 18, padding: 24, alignItems: "center", gap: 10, width: "100%", maxWidth: 340 },
  overlayTitle: {
    fontFamily: "Manrope_700Bold",
    fontSize: 17,
    color: COLORS.text,
  },
  overlaySub: {
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
  }});
