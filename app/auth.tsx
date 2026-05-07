import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, Pressable,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import COLORS from "@/constants/colors";

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    const err = await signIn(email.trim(), password);
    if (err) {
      setError(err);
      setLoading(false);
    }
  };

  const topPad = Platform.OS === "web" ? 60 : insets.top + 12;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scroll, { paddingTop: topPad }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Ionicons name="leaf" size={36} color={COLORS.white} />
          </View>
          <Text style={styles.appName}>Farm Diary</Text>
          <Text style={styles.appTagline}>Your farm, your data — always safe.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign In</Text>
          <Text style={styles.cardSubtitle}>Enter the credentials provided by your farm manager.</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Your password"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry={!showPass}
                autoCapitalize="none"
              />
              <Pressable onPress={() => setShowPass((v) => !v)} style={styles.showBtn}>
                <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={18} color={COLORS.textMuted} />
              </Pressable>
            </View>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={COLORS.red} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.submitBtn, loading && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator size="small" color={COLORS.white} />
              : <Text style={styles.submitBtnText}>Sign In</Text>
            }
          </Pressable>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.textMuted} />
          <Text style={styles.infoText}>
            Accounts are created by your farm manager. Contact them if you need access.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: 24, paddingBottom: 60, gap: 24 },
  logoWrap: { alignItems: "center", gap: 10, paddingTop: 12 },
  logoCircle: { width: 76, height: 76, borderRadius: 38, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  appName: { fontFamily: "DMSans_700Bold", fontSize: 28, color: COLORS.text },
  appTagline: { fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.textSecondary },
  card: { backgroundColor: COLORS.cardBg, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: COLORS.border, gap: 16 },
  cardTitle: { fontFamily: "DMSans_700Bold", fontSize: 20, color: COLORS.text },
  cardSubtitle: { fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.textSecondary, lineHeight: 18, marginTop: -6 },
  field: { gap: 6 },
  label: { fontFamily: "DMSans_500Medium", fontSize: 13, color: COLORS.textSecondary },
  inputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, backgroundColor: COLORS.background, paddingHorizontal: 12, height: 48 },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontFamily: "DMSans_400Regular", fontSize: 15, color: COLORS.text },
  showBtn: { padding: 4 },
  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: COLORS.redLight, borderRadius: 10, padding: 12 },
  errorText: { flex: 1, fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.red, lineHeight: 18 },
  submitBtn: { backgroundColor: COLORS.primary, borderRadius: 13, paddingVertical: 15, alignItems: "center", justifyContent: "center" },
  submitBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 16, color: COLORS.white },
  infoBox: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: COLORS.borderLight, borderRadius: 12, padding: 14 },
  infoText: { flex: 1, fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textMuted, lineHeight: 18 },
});
