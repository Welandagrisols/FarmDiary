import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFarm } from "@/context/FarmContext";
import COLORS from "@/constants/colors";
import { PERSONAL_EXPENSE_CATEGORIES } from "@/lib/storage";
import * as Haptics from "expo-haptics";

const CATEGORIES = Object.keys(PERSONAL_EXPENSE_CATEGORIES);

const VISITOR_ROLES = ["Investor", "Business Partner", "Agronomist", "Extension Officer", "Supplier", "Friend", "Other"];

export default function AddPersonalExpenseScreen() {
  const insets = useSafeAreaInsets();
  const { addPersonalExpenseEntry, seasonId, farmId } = useFarm();

  const [category, setCategory] = useState(CATEGORIES[0]);
  const [subcategory, setSubcategory] = useState(PERSONAL_EXPENSE_CATEGORIES[CATEGORIES[0]][0]);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState("");
  const [visitorName, setVisitorName] = useState("");
  const [visitorRole, setVisitorRole] = useState(VISITOR_ROLES[0]);
  const [tripFrom, setTripFrom] = useState("");
  const [tripTo, setTripTo] = useState("");
  const [receipt, setReceipt] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const subcategories = PERSONAL_EXPENSE_CATEGORIES[category] || [];
  const isTransport = category === "Farm Transport";
  const isVisit = category === "Stakeholder Visits";

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    setSubcategory(PERSONAL_EXPENSE_CATEGORIES[cat][0]);
  };

  const computedAmount = parseFloat(amount) || 0;

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert("Missing Info", "Please enter a description.");
      return;
    }
    if (computedAmount <= 0) {
      Alert.alert("Missing Info", "Please enter a valid amount.");
      return;
    }

    setSubmitting(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await addPersonalExpenseEntry({
        farm_id: farmId,
        season_id: seasonId,
        category,
        subcategory,
        description: description.trim(),
        expense_date: date,
        amount_kes: computedAmount,
        visitor_name: isVisit ? (visitorName || null) : null,
        visitor_role: isVisit ? visitorRole : null,
        trip_from: isTransport ? (tripFrom || null) : null,
        trip_to: isTransport ? (tripTo || null) : null,
        receipt_reference: receipt || null,
        notes: notes || null,
      });
      router.back();
    } catch {
      Alert.alert("Error", "Failed to save expense. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn} hitSlop={12}>
          <Ionicons name="close" size={22} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Record Personal Expense</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                style={[styles.chip, category === cat && styles.chipActive]}
                onPress={() => handleCategoryChange(cat)}
              >
                <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                  {cat === "Health & Medication" ? "Health" : cat === "Stakeholder Visits" ? "Visitors" : cat === "Household Setup" ? "Household" : cat === "Protective Gear" ? "Gear" : cat === "Farm Transport" ? "Transport" : cat === "Meals & Food" ? "Meals" : cat === "Personal Care" ? "Personal" : cat}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Subcategory</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {subcategories.map((sub) => (
              <Pressable
                key={sub}
                style={[styles.chip, subcategory === sub && styles.chipActive]}
                onPress={() => setSubcategory(sub)}
              >
                <Text style={[styles.chipText, subcategory === sub && styles.chipTextActive]}>{sub}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Description *</Text>
          <TextInput
            style={styles.input}
            value={description}
            onChangeText={setDescription}
            placeholder={
              isTransport ? "e.g. Matatu from Nakuru to Molo"
              : isVisit ? "e.g. Site visit with investor"
              : category === "Meals & Food" ? "e.g. Lunch at farm"
              : category === "Protective Gear" ? "e.g. Gumboots for field work"
              : "Brief description"
            }
            placeholderTextColor={COLORS.textMuted}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.fieldLabel}>Date *</Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.fieldLabel}>Amount (KES) *</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numeric"
            />
          </View>
        </View>

        {isTransport && (
          <>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>From</Text>
              <TextInput
                style={styles.input}
                value={tripFrom}
                onChangeText={setTripFrom}
                placeholder="e.g. Home (Nakuru)"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>To</Text>
              <TextInput
                style={styles.input}
                value={tripTo}
                onChangeText={setTripTo}
                placeholder="e.g. Farm (Molo)"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
          </>
        )}

        {isVisit && (
          <>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Visitor Name</Text>
              <TextInput
                style={styles.input}
                value={visitorName}
                onChangeText={setVisitorName}
                placeholder="Full name"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Visitor Role</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {VISITOR_ROLES.map((role) => (
                  <Pressable
                    key={role}
                    style={[styles.chip, visitorRole === role && styles.chipActive]}
                    onPress={() => setVisitorRole(role)}
                  >
                    <Text style={[styles.chipText, visitorRole === role && styles.chipTextActive]}>{role}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </>
        )}

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Receipt / Reference</Text>
          <TextInput
            style={styles.input}
            value={receipt}
            onChangeText={setReceipt}
            placeholder="Optional receipt number"
            placeholderTextColor={COLORS.textMuted}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any additional details..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={3}
          />
        </View>

        {computedAmount > 0 && (
          <View style={styles.previewCard}>
            <Text style={styles.previewLabel}>Amount to record</Text>
            <Text style={styles.previewAmount}>{`KES ${computedAmount.toLocaleString("en-KE")}`}</Text>
            <Text style={styles.previewCategory}>{category} · {subcategory}</Text>
          </View>
        )}

        <Pressable
          style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.white} />
          <Text style={styles.submitBtnText}>{submitting ? "Saving..." : "Save Expense"}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cardBg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.borderLight, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: "DMSans_700Bold", fontSize: 17, color: COLORS.text },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 0, paddingBottom: 40 },
  field: { marginBottom: 16, gap: 6 },
  fieldLabel: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.text },
  row: { flexDirection: "row", gap: 12 },
  input: { backgroundColor: COLORS.borderLight, borderRadius: 10, padding: 12, fontFamily: "DMSans_400Regular", fontSize: 14, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  textArea: { height: 80, textAlignVertical: "top" },
  chipRow: { gap: 8, paddingVertical: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.borderLight, borderWidth: 1.5, borderColor: COLORS.border },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontFamily: "DMSans_500Medium", fontSize: 12, color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.white },
  previewCard: { backgroundColor: COLORS.primarySurface, borderRadius: 14, padding: 16, gap: 4, marginBottom: 16, alignItems: "center" },
  previewLabel: { fontFamily: "DMSans_500Medium", fontSize: 12, color: COLORS.textSecondary },
  previewAmount: { fontFamily: "DMSans_700Bold", fontSize: 28, color: COLORS.primary, letterSpacing: -0.5 },
  previewCategory: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, marginTop: 8 },
  submitBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 16, color: COLORS.white },
});
