import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, Pressable,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import COLORS from "@/constants/colors";

type Mode = "signin" | "signup";

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signUpDone, setSignUpDone] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    if (mode === "signin") {
      const err = await signIn(email.trim(), password);
      if (err) {
        setError(err);
        setLoading(false);
      }
    } else {
      const err = await signUp(email.trim(), password);
      if (err) {
        setError(err);
        setLoading(false);
      } else {
        setSignUpDone(true);
        setLoading(false);
      }
    }
  };

  const topPad = Platform.OS === "web" ? 60 : insets.top + 12;

  if (signUpDone) {
    return (
      <View style={[styles.centered, { paddingTop: topPad }]}>
        <View style={styles.iconCircle}>
          <Ionicons name="mail-outline" size={40} color={COLORS.primary} />
        </View>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We sent a confirmation link to{"\n"}<Text style={styles.emailHighlight}>{email}</Text>
          {"\n\n"}Open it to activate your account, then come back and sign in.
        </Text>
        <Pressable style={styles.switchBtn} onPress={() => { setMode("signin"); setSignUpDone(false); }}>
          <Text style={styles.switchBtnText}>Go to Sign In</Text>
        </Pressable>
      </View>
    );
  }

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
          <View style={styles.modeToggle}>
            <Pressable
              style={[styles.modeBtn, mode === "signin" && styles.modeBtnActive]}
              onPress={() => { setMode("signin"); setError(null); }}
            >
              <Text style={[styles.modeBtnText, mode === "signin" && styles.modeBtnTextActive]}>Sign In</Text>
            </Pressable>
            <Pressable
              style={[styles.modeBtn, mode === "signup" && styles.modeBtnActive]}
              onPress={() => { setMode("signup"); setError(null); }}
            >
              <Text style={[styles.modeBtnText, mode === "signup" && styles.modeBtnTextActive]}>Create Account</Text>
            </Pressable>
          </View>

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
                placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
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
              : <Text style={styles.submitBtnText}>{mode === "signin" ? "Sign In" : "Create Account"}</Text>
            }
          </Pressable>
        </View>

        <Text style={styles.footer}>
          {mode === "signin" ? "New here? " : "Already have an account? "}
          <Text
            style={styles.footerLink}
            onPress={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}
          >
            {mode === "signin" ? "Create an account" : "Sign in instead"}
          </Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: 24, paddingBottom: 60, gap: 24 },
  centered: { flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 },
  logoWrap: { alignItems: "center", gap: 10, paddingTop: 12 },
  logoCircle: { width: 76, height: 76, borderRadius: 38, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  appName: { fontFamily: "DMSans_700Bold", fontSize: 28, color: COLORS.text },
  appTagline: { fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.textSecondary },
  card: { backgroundColor: COLORS.cardBg, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: COLORS.border, gap: 16 },
  modeToggle: { flexDirection: "row", backgroundColor: COLORS.borderLight, borderRadius: 12, padding: 3, gap: 3 },
  modeBtn: { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: 10 },
  modeBtnActive: { backgroundColor: COLORS.white, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  modeBtnText: { fontFamily: "DMSans_500Medium", fontSize: 13, color: COLORS.textMuted },
  modeBtnTextActive: { fontFamily: "DMSans_600SemiBold", color: COLORS.text },
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
  footer: { textAlign: "center", fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.textSecondary },
  footerLink: { fontFamily: "DMSans_600SemiBold", color: COLORS.primary },
  iconCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: COLORS.primarySurface, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: "DMSans_700Bold", fontSize: 24, color: COLORS.text, textAlign: "center" },
  subtitle: { fontFamily: "DMSans_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center", lineHeight: 22 },
  emailHighlight: { fontFamily: "DMSans_600SemiBold", color: COLORS.text },
  switchBtn: { backgroundColor: COLORS.primary, borderRadius: 13, paddingVertical: 14, paddingHorizontal: 32 },
  switchBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 15, color: COLORS.white },
});
