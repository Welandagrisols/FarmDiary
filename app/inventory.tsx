import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Modal,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFarm } from "@/context/FarmContext";
import COLORS from "@/constants/colors";
import { InventoryItem, formatKES, formatDate } from "@/lib/storage";
import { FARM_SEED, SEASON_SEED } from "@/constants/farmData";
import * as Haptics from "expo-haptics";

function StockBar({ item }: { item: InventoryItem }) {
  const remaining = item.quantity_purchased - (item.quantity_used || 0);
  const percent = Math.max(0, Math.min(1, remaining / item.quantity_purchased));
  const isLow = percent < 0.2;
  const isEmpty = remaining <= 0;

  return (
    <View style={styles.stockBar}>
      <View
        style={[
          styles.stockFill,
          {
            width: `${percent * 100}%`,
            backgroundColor: isEmpty ? COLORS.red : isLow ? COLORS.amber : COLORS.primary,
          },
        ]}
      />
    </View>
  );
}

function InventoryCard({ item, onPress, onDelete }: { item: InventoryItem; onPress: () => void; onDelete: () => void }) {
  const remaining = item.quantity_purchased - (item.quantity_used || 0);
  const percent = remaining / item.quantity_purchased;
  const isLow = percent < 0.2;
  const isEmpty = remaining <= 0;

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Delete Item", `Delete "${item.product_name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: onDelete },
    ]);
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={handleLongPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.productName} numberOfLines={1}>{item.product_name}</Text>
          <View style={styles.categoryPill}>
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
        </View>
        <View style={styles.remainingBox}>
          <Text
            style={[
              styles.remainingValue,
              { color: isEmpty ? COLORS.red : isLow ? COLORS.amber : COLORS.primary },
            ]}
          >
            {Math.max(0, remaining).toFixed(1)}
          </Text>
          <Text style={styles.remainingUnit}>{item.unit}</Text>
        </View>
      </View>

      <StockBar item={item} />

      <View style={styles.cardFooter}>
        <Text style={styles.footerStat}>Bought: {item.quantity_purchased} {item.unit}</Text>
        <Text style={styles.footerStat}>Used: {item.quantity_used || 0} {item.unit}</Text>
        {isLow && !isEmpty && (
          <View style={styles.lowBadge}>
            <Text style={styles.lowBadgeText}>Low Stock</Text>
          </View>
        )}
        {isEmpty && (
          <View style={[styles.lowBadge, { backgroundColor: COLORS.redLight }]}>
            <Text style={[styles.lowBadgeText, { color: COLORS.red }]}>Out of Stock</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function AddStockModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (item: Omit<InventoryItem, "id" | "created_at">) => void }) {
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("Fungicide");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("L");
  const [unitPrice, setUnitPrice] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [supplier, setSupplier] = useState("");
  const insets = useSafeAreaInsets();

  const handleSubmit = () => {
    if (!productName.trim() || !qty || !unitPrice) {
      Alert.alert("Error", "Please fill in product name, quantity, and price.");
      return;
    }
    onSubmit({
      farm_id: FARM_SEED.id,
      season_id: SEASON_SEED.id,
      product_name: productName.trim(),
      category,
      quantity_purchased: parseFloat(qty) || 0,
      unit,
      unit_price_kes: parseFloat(unitPrice) || 0,
      quantity_used: 0,
      purchase_date: date,
      supplier: supplier || null,
      low_stock_threshold: null,
      is_historical: false,
      notes: null,
    });
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { paddingTop: 20 }]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Add Stock Purchase</Text>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
            <Ionicons name="close" size={22} color={COLORS.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.modalBody}>
          <Text style={styles.fieldLabel}>Product Name</Text>
          <TextInput style={styles.input} value={productName} onChangeText={setProductName} placeholder="e.g. Metameta" placeholderTextColor={COLORS.textMuted} />

          <Text style={styles.fieldLabel}>Category</Text>
          <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholder="Fungicide" placeholderTextColor={COLORS.textMuted} />

          <View style={styles.rowFields}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Quantity</Text>
              <TextInput style={styles.input} value={qty} onChangeText={setQty} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Unit</Text>
              <TextInput style={styles.input} value={unit} onChangeText={setUnit} placeholder="L / kg" placeholderTextColor={COLORS.textMuted} />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Price per Unit (KES)</Text>
          <TextInput style={styles.input} value={unitPrice} onChangeText={setUnitPrice} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.textMuted} />

          <Text style={styles.fieldLabel}>Purchase Date</Text>
          <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textMuted} keyboardType="numbers-and-punctuation" />

          <Text style={styles.fieldLabel}>Supplier (optional)</Text>
          <TextInput style={styles.input} value={supplier} onChangeText={setSupplier} placeholder="Supplier name" placeholderTextColor={COLORS.textMuted} />
        </View>

        <View style={[styles.modalFooter, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable style={styles.submitBtn} onPress={handleSubmit}>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />
            <Text style={styles.submitBtnText}>Add to Inventory</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function InventoryScreen() {
  const insets = useSafeAreaInsets();
  const { inventory, addInventory, removeInventory } = useFarm();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const lowCount = inventory.filter((i) => {
    const rem = i.quantity_purchased - (i.quantity_used || 0);
    return rem < i.quantity_purchased * 0.2;
  }).length;

  const handleAdd = async (item: Omit<InventoryItem, "id" | "created_at">) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await addInventory(item);
    setShowAdd(false);
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="close" size={22} color={COLORS.text} />
        </Pressable>
        <Text style={styles.title}>Inventory</Text>
        <Pressable style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Ionicons name="add" size={20} color={COLORS.white} />
        </Pressable>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{inventory.length}</Text>
          <Text style={styles.summaryLabel}>Products</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, lowCount > 0 ? { color: COLORS.amber } : {}]}>{lowCount}</Text>
          <Text style={styles.summaryLabel}>Low/Empty</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {formatKES(inventory.reduce((sum, i) => sum + i.quantity_purchased * i.unit_price_kes, 0))}
          </Text>
          <Text style={styles.summaryLabel}>Total Value</Text>
        </View>
      </View>

      <FlatList
        data={inventory}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <InventoryCard
            item={item}
            onPress={() => setSelectedItem(item)}
            onDelete={() => removeInventory(item.id)}
          />
        )}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="flask-outline" size={40} color={COLORS.border} />
            <Text style={styles.emptyText}>No inventory items</Text>
            <Pressable style={styles.emptyAddBtn} onPress={() => setShowAdd(true)}>
              <Text style={styles.emptyAddBtnText}>Add First Item</Text>
            </Pressable>
          </View>
        }
      />

      {showAdd && <AddStockModal onClose={() => setShowAdd(false)} onSubmit={handleAdd} />}

      {selectedItem && (
        <Modal visible animationType="slide" presentationStyle="formSheet" onRequestClose={() => setSelectedItem(null)}>
          <View style={[styles.modalContainer, { paddingTop: 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedItem.product_name}</Text>
              <Pressable onPress={() => setSelectedItem(null)} style={styles.closeBtn} hitSlop={12}>
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </Pressable>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Category</Text>
                <Text style={styles.detailValue}>{selectedItem.category}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Purchased</Text>
                <Text style={styles.detailValue}>{selectedItem.quantity_purchased} {selectedItem.unit}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Used</Text>
                <Text style={styles.detailValue}>{selectedItem.quantity_used || 0} {selectedItem.unit}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Remaining</Text>
                <Text style={[styles.detailValue, { color: COLORS.primary, fontFamily: "DMSans_700Bold" }]}>
                  {Math.max(0, selectedItem.quantity_purchased - (selectedItem.quantity_used || 0)).toFixed(1)} {selectedItem.unit}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Unit Price</Text>
                <Text style={styles.detailValue}>{formatKES(selectedItem.unit_price_kes)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Purchase Date</Text>
                <Text style={styles.detailValue}>{formatDate(selectedItem.purchase_date)}</Text>
              </View>
              {selectedItem.supplier && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Supplier</Text>
                  <Text style={styles.detailValue}>{selectedItem.supplier}</Text>
                </View>
              )}
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.borderLight,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontFamily: "DMSans_700Bold", fontSize: 22, color: COLORS.text },
  addBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center",
  },
  summaryRow: {
    flexDirection: "row", paddingHorizontal: 16, gap: 10, marginBottom: 12,
  },
  summaryItem: {
    flex: 1, backgroundColor: COLORS.cardBg, borderRadius: 12, padding: 12, alignItems: "center", gap: 2,
    shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  summaryValue: { fontFamily: "DMSans_700Bold", fontSize: 16, color: COLORS.primary },
  summaryLabel: { fontFamily: "DMSans_400Regular", fontSize: 10, color: COLORS.textMuted, textAlign: "center" },
  listContent: { paddingHorizontal: 16, gap: 10, paddingTop: 4 },
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 14, gap: 10,
    shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardHeaderLeft: { flex: 1, gap: 4 },
  productName: { fontFamily: "DMSans_600SemiBold", fontSize: 15, color: COLORS.text },
  categoryPill: { alignSelf: "flex-start", backgroundColor: COLORS.primarySurface, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  categoryText: { fontFamily: "DMSans_500Medium", fontSize: 10, color: COLORS.primary },
  remainingBox: { alignItems: "flex-end", gap: 0 },
  remainingValue: { fontFamily: "DMSans_700Bold", fontSize: 24 },
  remainingUnit: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textMuted },
  stockBar: { height: 6, backgroundColor: COLORS.borderLight, borderRadius: 3, overflow: "hidden" },
  stockFill: { height: "100%", borderRadius: 3 },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: 12 },
  footerStat: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textMuted },
  lowBadge: { backgroundColor: COLORS.amberLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginLeft: "auto" as any },
  lowBadgeText: { fontFamily: "DMSans_600SemiBold", fontSize: 10, color: COLORS.amber },
  emptyState: { alignItems: "center", gap: 10, paddingVertical: 48 },
  emptyText: { fontFamily: "DMSans_400Regular", fontSize: 14, color: COLORS.textMuted },
  emptyAddBtn: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  emptyAddBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 14, color: COLORS.white },
  // Modal
  modalContainer: { flex: 1, backgroundColor: COLORS.cardBg },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  modalTitle: { fontFamily: "DMSans_700Bold", fontSize: 18, color: COLORS.text },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.borderLight,
    alignItems: "center", justifyContent: "center",
  },
  modalBody: { padding: 16, gap: 12 },
  modalFooter: { padding: 16, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  fieldLabel: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.text },
  input: {
    backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: "DMSans_400Regular", fontSize: 14, color: COLORS.text,
  },
  rowFields: { flexDirection: "row", gap: 8 },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16,
  },
  submitBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 16, color: COLORS.white },
  detailRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  detailLabel: { fontFamily: "DMSans_400Regular", fontSize: 14, color: COLORS.textSecondary },
  detailValue: { fontFamily: "DMSans_600SemiBold", fontSize: 14, color: COLORS.text },
});
