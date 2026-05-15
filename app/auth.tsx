import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import COLORS from "@/constants/colors";

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isValid = email.trim().length > 3 && password.length >= 6;

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const { error } = mode === "signin"
        ? await signIn(email, password)
        : await signUp(email, password);

      if (error) {
        setErrorMsg(error);
      } else if (mode === "signup") {
        Alert.alert(
          "Account created",
          "You can now sign in with your email and password.",
          [{ text: "Sign in", onPress: () => setMode("signin") }]
        );
      } else {
        router.replace("/(tabs)");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Ionicons name="leaf" size={36} color={COLORS.white} />
          </View>
          <Text style={styles.appName}>Farm Diary</Text>
          <Text style={styles.tagline}>Your complete farm management tool</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {mode === "signin" ? "Welcome back" : "Create account"}
          </Text>
          <Text style={styles.cardSubtitle}>
            {mode === "signin"
              ? "Sign in to access your farm data"
              : "Set up your account to get started"}
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email address</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={(t) => { setEmail(t); setErrorMsg(null); }}
                placeholder="you@example.com"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={password}
                onChangeText={(t) => { setPassword(t); setErrorMsg(null); }}
                placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                onSubmitEditing={handleSubmit}
                returnKeyType="go"
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={COLORS.textMuted}
                />
              </Pressable>
            </View>
          </View>

          {errorMsg ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={COLORS.red} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.submitBtn, (!isValid || loading) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!isValid || loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <>
                <Ionicons
                  name={mode === "signin" ? "log-in-outline" : "person-add-outline"}
                  size={18}
                  color={COLORS.white}
                />
                <Text style={styles.submitBtnText}>
                  {mode === "signin" ? "Sign In" : "Create Account"}
                </Text>
              </>
            )}
          </Pressable>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>
              {mode === "signin" ? "Don't have an account?" : "Already have an account?"}
            </Text>
            <Pressable onPress={() => { setMode(mode === "signin" ? "signup" : "signin"); setErrorMsg(null); }}>
              <Text style={styles.switchLink}>
                {mode === "signin" ? "Sign up" : "Sign in"}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.offlineNote}>
          <Ionicons name="wifi-outline" size={14} color={COLORS.textMuted} />
          <Text style={styles.offlineNoteText}>
            Once signed in, your data is cached so you can work offline too
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    gap: 24,
  },
  logoWrap: {
    alignItems: "center",
    gap: 8,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  appName: {
    fontFamily: "DMSans_700Bold",
    fontSize: 28,
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  tagline: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 24,
    gap: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  cardTitle: {
    fontFamily: "DMSans_700Bold",
    fontSize: 22,
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: -8,
  },
  fieldGroup: { gap: 6 },
  label: {
    fontFamily: "DMSans_500Medium",
    fontSize: 13,
    color: COLORS.text,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  inputIcon: { flexShrink: 0 },
  input: {
    flex: 1,
    fontFamily: "DMSans_400Regular",
    fontSize: 15,
    color: COLORS.text,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    padding: 12,
  },
  errorText: {
    flex: 1,
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: COLORS.red,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: { opacity: 0.5, shadowOpacity: 0 },
  submitBtnText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 16,
    color: COLORS.white,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  switchLabel: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  switchLink: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 13,
    color: COLORS.primary,
  },
  offlineNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  offlineNoteText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: COLORS.textMuted,
    flex: 1,
    textAlign: "center",
  },
});
