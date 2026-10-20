import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import COLORS from "@/constants/colors";
import { useFarm } from "@/context/FarmContext";
import { formatKES } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import {
  approveSaleDiscount,
  approveSaleVoid,
  approveStockIssue,
  checkSale,
  confirmStockCount,
  confirmStockIssue,
  createSale,
  FarmRole,
  getFarmRole,
  getSales,
  getStockCounts,
  getStockIssues,
  getStockLosses,
  markStockIssueIssued,
  recordStockCount,
  recordStockLoss,
  requestSaleVoid,
  requestStockIssue,
  SaleRecord,
  StockCountRecord,
  StockIssueRecord,
  StockLossRecord,
} from "@/lib/sales-storage";

type PaymentMethod = "mpesa" | "cash" | "bank";
type ReviewAction = "check" | "discount" | "voidRequest" | "voidApproval";
interface ReviewRequest {
  action: ReviewAction;
  sale: SaleRecord;
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "mpesa", label: "M-Pesa / Till" },
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
];

const todayKey = () => new Intl.DateTimeFormat("en-CA").format(new Date());

function roleLabel(role: FarmRole) {
  return role === "none" ? "No access" : role === "admin" ? "Admin" : role[0].toUpperCase() + role.slice(1);
}

function statusLabel(status: SaleRecord["status"]) {
  switch (status) {
    case "pending_check": return "Awaiting checker";
    case "discount_pending": return "Discount approval needed";
    case "recorded": return "Recorded";
    case "void_requested": return "Void awaiting owner";
    case "voided": return "Voided";
  }
}

export default function SalesScreen() {
  const insets = useSafeAreaInsets();
  const { activeFarm, activeSeason, harvestRecords } = useFarm();
  const [role, setRole] = useState<FarmRole>("none");
  const [currentUserId, setCurrentUserId] = useState("");
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [losses, setLosses] = useState<StockLossRecord[]>([]);
  const [counts, setCounts] = useState<StockCountRecord[]>([]);
  const [issues, setIssues] = useState<StockIssueRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"sales" | "stock">("sales");
  const [review, setReview] = useState<ReviewRequest | null>(null);
  const [reason, setReason] = useState("");

  const [buyerName, setBuyerName] = useState("");
  const [quantityKg, setQuantityKg] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [discount, setDiscount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("mpesa");
  const [paymentReference, setPaymentReference] = useState("");

  const [lossQuantity, setLossQuantity] = useState("");
  const [lossReason, setLossReason] = useState("");
  const [countQuantity, setCountQuantity] = useState("");
  const [issueQuantity, setIssueQuantity] = useState("");
  const [issuePurpose, setIssuePurpose] = useState("");

  const topPadding = Platform.OS === "web" ? 58 : insets.top + 8;
  const seasonId = activeSeason?.id;
  const productName = activeFarm?.crop_type || "Farm produce";
  const canViewStock = ["admin", "owner", "manager", "storekeeper"].includes(role);
  const canReviewSales = ["admin", "owner", "manager"].includes(role);
  const canApproveVoids = role === "admin" || role === "owner";

  const load = useCallback(async () => {
    if (!activeFarm?.id || !seasonId) {
      setLoading(false);
      return;
    }
    try {
      const [{ data: { user } }, farmRole] = await Promise.all([
        supabase.auth.getUser(),
        getFarmRole(activeFarm.id),
      ]);
      setCurrentUserId(user?.id || "");
      setRole(farmRole);
      const salesData = await getSales(activeFarm.id, seasonId);
      setSales(salesData);
      if (["admin", "owner", "manager", "storekeeper"].includes(farmRole)) {
        const [lossData, countData, issueData] = await Promise.all([
          getStockLosses(activeFarm.id, seasonId),
          getStockCounts(activeFarm.id, seasonId),
          getStockIssues(activeFarm.id, seasonId),
        ]);
        setLosses(lossData);
        setCounts(countData);
        setIssues(issueData);
      } else {
        setLosses([]);
        setCounts([]);
        setIssues([]);
      }
    } catch (error: any) {
      Alert.alert("Could not load sales control", error?.message || "Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [activeFarm?.id, seasonId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const subtotal = (Number(quantityKg) || 0) * (Number(unitPrice) || 0);
  const discountValue = Number(discount) || 0;
  const total = subtotal - discountValue;

  const todaySales = useMemo(
    () => sales.filter((sale) => sale.created_at.slice(0, 10) === todayKey()),
    [sales],
  );
  const seasonHarvestKg = useMemo(
    () => harvestRecords
      .filter((record) => record.farm_id === activeFarm?.id && record.season_id === seasonId)
      .reduce((sum, record) => sum + (Number(record.total_kg) || 0), 0),
    [harvestRecords, activeFarm?.id, seasonId],
  );
  const soldKg = useMemo(
    () => sales.filter((sale) => sale.status !== "voided")
      .reduce((sum, sale) => sum + (Number(sale.quantity_kg) || 0), 0),
    [sales],
  );
  const lostKg = useMemo(
    () => losses.reduce((sum, loss) => sum + (Number(loss.quantity_kg) || 0), 0),
    [losses],
  );
  const issuedKg = useMemo(
    () => issues.filter((issue) => issue.status === "confirmed")
      .reduce((sum, issue) => sum + (Number(issue.quantity_kg) || 0), 0),
    [issues],
  );
  const expectedStockKg = seasonHarvestKg - soldKg - lostKg - issuedKg;
  const latestConfirmedCount = counts.find((count) => count.status === "confirmed" && count.product_name === productName);
  const stockVariance = latestConfirmedCount ? expectedStockKg - Number(latestConfirmedCount.quantity_kg) : null;
  const todayRevenue = todaySales.filter((sale) => sale.status !== "voided")
    .reduce((sum, sale) => sum + (Number(sale.total_kes) || 0), 0);

  const handleCreateSale = async () => {
    if (!activeFarm?.id || !seasonId) return;
    const qty = Number(quantityKg);
    const price = Number(unitPrice);
    const discountAmount = Number(discount) || 0;
    if (!buyerName.trim()) { Alert.alert("Buyer required", "Enter the buyer’s name."); return; }
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0) {
      Alert.alert("Check sale amount", "Enter a positive quantity and a valid price per kg.");
      return;
    }
    if (!Number.isFinite(discountAmount) || discountAmount < 0 || discountAmount > qty * price) {
      Alert.alert("Check discount", "Discount must be between zero and the sale subtotal.");
      return;
    }
    if (paymentMethod !== "cash" && !paymentReference.trim()) {
      Alert.alert("Payment reference required", "Enter the M-Pesa or bank transaction reference.");
      return;
    }
    setSaving(true);
    try {
      const sale = await createSale({
        farmId: activeFarm.id,
        seasonId,
        productName,
        buyerName,
        quantityKg: qty,
        unitPriceKes: price,
        discountKes: discountAmount,
        paymentMethod,
        paymentReference,
      });
      setBuyerName("");
      setQuantityKg("");
      setUnitPrice("");
      setDiscount("0");
      setPaymentReference("");
      await load();
      Alert.alert(
        "Sale captured",
        `${sale.receipt_number} · ${statusLabel(sale.status)}. Keep the payment reference with the receipt.`,
      );
    } catch (error: any) {
      Alert.alert("Could not record sale", error?.message || "Try again.");
    } finally {
      setSaving(false);
    }
  };

  const submitReview = async () => {
    if (!review || !reason.trim()) {
      Alert.alert("Reason required", "Add a note so the review is auditable.");
      return;
    }
    setSaving(true);
    try {
      if (review.action === "check") await checkSale(review.sale.id, reason);
      if (review.action === "discount") await approveSaleDiscount(review.sale.id, reason);
      if (review.action === "voidRequest") await requestSaleVoid(review.sale.id, reason);
      if (review.action === "voidApproval") await approveSaleVoid(review.sale.id, reason);
      setReview(null);
      setReason("");
      await load();
    } catch (error: any) {
      Alert.alert("Review was not saved", error?.message || "Try again.");
    } finally {
      setSaving(false);
    }
  };

  const runStockAction = async (action: () => Promise<void>, successMessage: string) => {
    setSaving(true);
    try {
      await action();
      await load();
      Alert.alert("Saved", successMessage);
    } catch (error: any) {
      Alert.alert("Could not save stock record", error?.message || "Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleRecordLoss = async () => {
    if (!activeFarm?.id || !seasonId) return;
    const qty = Number(lossQuantity);
    if (!qty || qty <= 0 || !lossReason.trim()) {
      Alert.alert("Complete loss details", "Enter a positive quantity and explain the loss.");
      return;
    }
    await runStockAction(() => recordStockLoss({
      farmId: activeFarm.id!, seasonId, productName, quantityKg: qty, reason: lossReason,
    }), "Loss added to the stock ledger.");
    setLossQuantity("");
    setLossReason("");
  };

  const handleRecordCount = async () => {
    if (!activeFarm?.id || !seasonId) return;
    const qty = Number(countQuantity);
    if (countQuantity === "" || !Number.isFinite(qty) || qty < 0) {
      Alert.alert("Check stock count", "Enter the physical quantity in kg.");
      return;
    }
    await runStockAction(() => recordStockCount({
      farmId: activeFarm.id!, seasonId, productName, quantityKg: qty,
    }), "Count saved. A different team member must confirm it.");
    setCountQuantity("");
  };

  const handleRequestIssue = async () => {
    if (!activeFarm?.id || !seasonId) return;
    const qty = Number(issueQuantity);
    if (!qty || qty <= 0 || !issuePurpose.trim()) {
      Alert.alert("Complete issue details", "Enter a positive quantity and the reason for issuing stock.");
      return;
    }
    await runStockAction(() => requestStockIssue({
      farmId: activeFarm.id!, seasonId, productName, quantityKg: qty, purpose: issuePurpose,
    }), "Issue request sent for manager approval.");
    setIssueQuantity("");
    setIssuePurpose("");
  };

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: topPadding }]}>
        <ActivityIndicator color={COLORS.primary} />
        <Text style={styles.helperText}>Loading sales ledger…</Text>
      </View>
    );
  }

  if (!activeFarm || !activeSeason) {
    return (
      <View style={[styles.centered, { paddingTop: topPadding }]}>
        <Text style={styles.title}>Sales control</Text>
        <Text style={styles.helperText}>Select a farm and active season before recording sales.</Text>
      </View>
    );
  }

  if (role === "none") {
    return (
      <View style={[styles.centered, { paddingTop: topPadding }]}>
        <Text style={styles.title}>Sales control</Text>
        <Text style={styles.helperText}>This account does not have a role on the selected farm.</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: topPadding, paddingBottom: insets.bottom + 34 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Sales control</Text>
            <Text style={styles.subtitle}>{activeFarm.name} · {activeSeason.season_name}</Text>
          </View>
          <View style={styles.roleBadge}><Text style={styles.roleBadgeText}>{roleLabel(role)}</Text></View>
        </View>

        {canViewStock ? (
          <View style={styles.tabs}>
            <Pressable style={[styles.tab, tab === "sales" && styles.tabActive]} onPress={() => setTab("sales")}>
              <Text style={[styles.tabText, tab === "sales" && styles.tabTextActive]}>Sales ledger</Text>
            </Pressable>
            <Pressable style={[styles.tab, tab === "stock" && styles.tabActive]} onPress={() => setTab("stock")}>
              <Text style={[styles.tabText, tab === "stock" && styles.tabTextActive]}>Stock control</Text>
            </Pressable>
          </View>
        ) : null}

        {tab === "sales" && role !== "storekeeper" ? (
          <>
            <View style={styles.todayCard}>
              <View style={styles.todayIcon}><Ionicons name="receipt-outline" size={19} color={COLORS.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.todayLabel}>Today’s recorded sales</Text>
                <Text style={styles.todayValue}>{formatKES(todayRevenue)}</Text>
              </View>
              <Text style={styles.todayCount}>{todaySales.length} sale{todaySales.length === 1 ? "" : "s"}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Record sale</Text>
              <Text style={styles.helperTextLeft}>
                Each entry is linked to the signed-in seller. Discounts wait for manager approval; every sale needs a separate checker.
              </Text>
              <Text style={styles.fieldLabel}>Buyer</Text>
              <TextInput style={styles.input} value={buyerName} onChangeText={setBuyerName} placeholder="Buyer name" placeholderTextColor={COLORS.textMuted} />
              <View style={styles.row}>
                <View style={styles.flexField}>
                  <Text style={styles.fieldLabel}>Quantity (kg)</Text>
                  <TextInput style={styles.input} value={quantityKg} onChangeText={setQuantityKg} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={COLORS.textMuted} />
                </View>
                <View style={styles.flexField}>
                  <Text style={styles.fieldLabel}>Price per kg (KES)</Text>
                  <TextInput style={styles.input} value={unitPrice} onChangeText={setUnitPrice} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={COLORS.textMuted} />
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.flexField}>
                  <Text style={styles.fieldLabel}>Discount (KES)</Text>
                  <TextInput style={styles.input} value={discount} onChangeText={setDiscount} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={COLORS.textMuted} />
                </View>
                <View style={[styles.flexField, styles.totalPreview]}>
                  <Text style={styles.totalPreviewLabel}>Total</Text>
                  <Text style={styles.totalPreviewValue}>{formatKES(Math.max(0, total))}</Text>
                </View>
              </View>
              <Text style={styles.fieldLabel}>Payment received</Text>
              <View style={styles.chipRow}>
                {PAYMENT_METHODS.map((method) => (
                  <Pressable
                    key={method.value}
                    style={[styles.chip, paymentMethod === method.value && styles.chipActive]}
                    onPress={() => setPaymentMethod(method.value)}
                  >
                    <Text style={[styles.chipText, paymentMethod === method.value && styles.chipTextActive]}>{method.label}</Text>
                  </Pressable>
                ))}
              </View>
              {paymentMethod !== "cash" ? (
                <>
                  <Text style={styles.fieldLabel}>Payment reference</Text>
                  <TextInput style={styles.input} value={paymentReference} onChangeText={setPaymentReference} autoCapitalize="characters" placeholder="M-Pesa / bank transaction code" placeholderTextColor={COLORS.textMuted} />
                </>
              ) : null}
              <Pressable style={[styles.primaryButton, saving && styles.buttonDisabled]} onPress={handleCreateSale} disabled={saving}>
                {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryButtonText}>Record sale</Text>}
              </Pressable>
              <Text style={styles.smallNote}>Record payment to the farm till/paybill or farm account. Do not use a worker’s personal payment number.</Text>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.cardTitle}>Sales ledger</Text>
              <Text style={styles.helperText}>{sales.length} entr{sales.length === 1 ? "y" : "ies"}</Text>
            </View>
            {sales.length ? sales.map((sale) => {
              const isOwnSale = sale.seller_id === currentUserId;
              const hasDiscountApproval = Boolean((sale as any).discount_approved_at);
              const checkedAt = sale.checked_at;
              return (
                <View key={sale.id} style={styles.saleCard}>
                  <View style={styles.saleTopRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.saleBuyer}>{sale.buyer_name}</Text>
                      <Text style={styles.saleMeta}>{sale.receipt_number} · {new Date(sale.created_at).toLocaleString()}</Text>
                    </View>
                    <View style={[styles.statusPill, sale.status === "recorded" ? styles.statusGood : sale.status === "voided" ? styles.statusMuted : styles.statusPending]}>
                      <Text style={styles.statusText}>{statusLabel(sale.status)}</Text>
                    </View>
                  </View>
                  <View style={styles.saleDetails}>
                    <Text style={styles.saleDetailText}>{sale.quantity_kg} kg × {formatKES(sale.unit_price_kes)}/kg</Text>
                    <Text style={styles.saleTotal}>{formatKES(sale.total_kes)}</Text>
                  </View>
                  <Text style={styles.saleMeta}>
                    Seller: {sale.seller_email || sale.seller_id.slice(0, 8)}
                    {sale.payment_reference ? ` · Ref: ${sale.payment_reference}` : ` · ${sale.payment_method.toUpperCase()}`}
                  </Text>
                  {checkedAt ? <Text style={styles.saleMeta}>Checked by {sale.checked_by_email || "another team member"} · {new Date(checkedAt).toLocaleString()}</Text> : null}
                  {sale.discount_approved_by_email ? <Text style={styles.saleMeta}>Discount approved by {sale.discount_approved_by_email}</Text> : null}
                  {sale.voided_by_email ? <Text style={styles.saleMeta}>Void approved by {sale.voided_by_email}</Text> : null}
                  {sale.void_reason ? <Text style={styles.saleReason}>Note: {sale.void_reason}</Text> : null}
                  <View style={styles.actionRow}>
                    {canReviewSales && !checkedAt && sale.status !== "voided" && sale.status !== "void_requested" && sale.seller_id !== currentUserId ? (
                      <Pressable style={styles.outlineAction} onPress={() => { setReason(""); setReview({ action: "check", sale }); }}>
                        <Text style={styles.outlineActionText}>Check sale</Text>
                      </Pressable>
                    ) : null}
                    {canReviewSales && sale.discount_kes > 0 && !hasDiscountApproval && sale.status !== "voided" ? (
                      <Pressable style={styles.outlineAction} onPress={() => { setReason(""); setReview({ action: "discount", sale }); }}>
                        <Text style={styles.outlineActionText}>Approve discount</Text>
                      </Pressable>
                    ) : null}
                    {isOwnSale && sale.status === "recorded" ? (
                      <Pressable style={styles.dangerAction} onPress={() => { setReason(""); setReview({ action: "voidRequest", sale }); }}>
                        <Text style={styles.dangerActionText}>Request void</Text>
                      </Pressable>
                    ) : null}
                    {canApproveVoids && sale.status === "void_requested" ? (
                      <Pressable style={styles.dangerAction} onPress={() => { setReason(""); setReview({ action: "voidApproval", sale }); }}>
                        <Text style={styles.dangerActionText}>Approve void</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            }) : (
              <View style={styles.emptyCard}>
                <Ionicons name="receipt-outline" size={22} color={COLORS.textMuted} />
                <Text style={styles.helperText}>Sales entered for this season will appear here.</Text>
              </View>
            )}
          </>
        ) : null}

        {tab === "stock" && canViewStock ? (
          <>
            <View style={styles.reconcileCard}>
              <View style={styles.reconcileHeader}>
                <Text style={styles.cardTitle}>Season-to-date stock reconciliation</Text>
                <Ionicons name="scale-outline" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.helperTextLeft}>
                {productName}: harvested − sales − recorded loss − confirmed issues − counted stock should equal 0 kg.
              </Text>
              <MetricRow label="Harvested" value={`${seasonHarvestKg.toFixed(1)} kg`} />
              <MetricRow label="Sales recorded / awaiting review" value={`${soldKg.toFixed(1)} kg`} />
              <MetricRow label="Recorded losses" value={`${lostKg.toFixed(1)} kg`} />
              <MetricRow label="Confirmed issues out of store" value={`${issuedKg.toFixed(1)} kg`} />
              <MetricRow label="Expected stock" value={`${expectedStockKg.toFixed(1)} kg`} strong />
              <MetricRow
                label="Latest confirmed physical count"
                value={latestConfirmedCount ? `${Number(latestConfirmedCount.quantity_kg).toFixed(1)} kg` : "Not counted"}
              />
              <View style={[styles.varianceRow, stockVariance !== null && Math.abs(stockVariance) > 0.01 ? styles.varianceAlert : null]}>
                <Text style={styles.varianceLabel}>Unreconciled difference</Text>
                <Text style={styles.varianceValue}>{stockVariance === null ? "Count required" : `${stockVariance.toFixed(1)} kg`}</Text>
              </View>
              <Text style={styles.smallNote}>
                Today: {todaySales.length} sale{todaySales.length === 1 ? "" : "s"} · {formatKES(todayRevenue)}
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Daily stock control</Text>
              <Text style={styles.fieldLabel}>Record physical count (kg)</Text>
              <View style={styles.row}>
                <TextInput style={[styles.input, styles.flexField]} value={countQuantity} onChangeText={setCountQuantity} keyboardType="decimal-pad" placeholder="Quantity in store" placeholderTextColor={COLORS.textMuted} />
                <Pressable style={styles.smallButton} onPress={handleRecordCount} disabled={saving}>
                  <Text style={styles.smallButtonText}>Submit count</Text>
                </Pressable>
              </View>
              <Text style={styles.smallNote}>Another team member must confirm each stock count.</Text>
              {counts.filter((count) => count.status === "pending_confirmation").map((count) => (
                <View key={count.id} style={styles.pendingRow}>
                  <Text style={styles.pendingText}>{count.quantity_kg} kg counted · awaiting confirmation</Text>
                  {count.counted_by !== currentUserId ? (
                    <Pressable style={styles.smallButton} onPress={() => runStockAction(() => confirmStockCount(count.id), "Stock count confirmed by a second person.")}>
                      <Text style={styles.smallButtonText}>Confirm</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}

              <View style={styles.divider} />
              <Text style={styles.fieldLabel}>Record a loss</Text>
              <View style={styles.row}>
                <TextInput style={[styles.input, styles.flexField]} value={lossQuantity} onChangeText={setLossQuantity} keyboardType="decimal-pad" placeholder="Quantity (kg)" placeholderTextColor={COLORS.textMuted} />
              </View>
              <TextInput style={styles.input} value={lossReason} onChangeText={setLossReason} placeholder="Reason for loss" placeholderTextColor={COLORS.textMuted} />
              <Pressable style={styles.secondaryButton} onPress={handleRecordLoss} disabled={saving}>
                <Text style={styles.secondaryButtonText}>Save loss record</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Stock issue control</Text>
              <Text style={styles.helperTextLeft}>A manager approves. A different person issues the stock, and another person confirms receipt.</Text>
              <View style={styles.row}>
                <TextInput style={[styles.input, styles.flexField]} value={issueQuantity} onChangeText={setIssueQuantity} keyboardType="decimal-pad" placeholder="Quantity (kg)" placeholderTextColor={COLORS.textMuted} />
              </View>
              <TextInput style={styles.input} value={issuePurpose} onChangeText={setIssuePurpose} placeholder="Purpose / recipient" placeholderTextColor={COLORS.textMuted} />
              <Pressable style={styles.secondaryButton} onPress={handleRequestIssue} disabled={saving}>
                <Text style={styles.secondaryButtonText}>Request stock issue</Text>
              </Pressable>
              {issues.map((issue) => (
                <View key={issue.id} style={styles.issueCard}>
                  <Text style={styles.issueTitle}>{issue.quantity_kg} kg · {issue.purpose}</Text>
                  <Text style={styles.saleMeta}>{issue.status.replace(/_/g, " ")}</Text>
                  <View style={styles.actionRow}>
                    {["admin", "owner", "manager"].includes(role) && issue.status === "pending_approval" ? (
                      <Pressable style={styles.outlineAction} onPress={() => runStockAction(() => approveStockIssue(issue.id), "Stock issue approved.")}>
                        <Text style={styles.outlineActionText}>Approve</Text>
                      </Pressable>
                    ) : null}
                    {["admin", "owner", "manager", "storekeeper"].includes(role) && issue.status === "approved" && issue.approved_by !== currentUserId ? (
                      <Pressable style={styles.outlineAction} onPress={() => runStockAction(() => markStockIssueIssued(issue.id), "Stock issue marked as issued.")}>
                        <Text style={styles.outlineActionText}>Mark issued</Text>
                      </Pressable>
                    ) : null}
                    {issue.status === "issued" && issue.issued_by !== currentUserId ? (
                      <Pressable style={styles.outlineAction} onPress={() => runStockAction(() => confirmStockIssue(issue.id), "Receipt confirmed by a second person.")}>
                        <Text style={styles.outlineActionText}>Confirm receipt</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {tab === "sales" && role === "storekeeper" ? (
          <View style={styles.emptyCard}>
            <Text style={styles.helperText}>Storekeepers use Stock Control to count and issue stock. Sales are recorded by the seller’s own account.</Text>
          </View>
        ) : null}
      </ScrollView>

      <Modal transparent visible={Boolean(review)} animationType="fade" onRequestClose={() => setReview(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.cardTitle}>
              {review?.action === "check" ? "Check this sale"
                : review?.action === "discount" ? "Approve discount"
                : review?.action === "voidRequest" ? "Request sale void"
                : "Approve sale void"}
            </Text>
            <Text style={styles.helperTextLeft}>
              {review?.sale.receipt_number} · {review?.sale.buyer_name} · {formatKES(review?.sale.total_kes || 0)}
            </Text>
            <TextInput
              style={[styles.input, styles.reasonInput]}
              value={reason}
              onChangeText={setReason}
              placeholder="Required review reason or note"
              placeholderTextColor={COLORS.textMuted}
              multiline
              textAlignVertical="top"
            />
            <View style={styles.actionRow}>
              <Pressable style={styles.cancelButton} onPress={() => { setReview(null); setReason(""); }}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.primaryButton, styles.modalSubmit, saving && styles.buttonDisabled]} onPress={submitReview} disabled={saving}>
                {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryButtonText}>Save review</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function MetricRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.metricRow}>
      <Text style={[styles.metricLabel, strong && styles.metricStrong]}>{label}</Text>
      <Text style={[styles.metricValue, strong && styles.metricStrong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 10, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 14 },
  backButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: "DMSans_700Bold", fontSize: 21, color: COLORS.text },
  subtitle: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textSecondary, marginTop: 3 },
  roleBadge: { backgroundColor: COLORS.primarySurface, borderRadius: 18, paddingVertical: 6, paddingHorizontal: 10 },
  roleBadgeText: { fontFamily: "DMSans_700Bold", fontSize: 10, color: COLORS.primary },
  tabs: { flexDirection: "row", marginHorizontal: 16, marginBottom: 12, backgroundColor: COLORS.cardBg, borderRadius: 11, padding: 4 },
  tab: { flex: 1, minHeight: 38, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontFamily: "DMSans_600SemiBold", fontSize: 12, color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.white },
  todayCard: { marginHorizontal: 16, marginBottom: 12, borderRadius: 14, backgroundColor: COLORS.primarySurface, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  todayIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.cardBg, alignItems: "center", justifyContent: "center" },
  todayLabel: { fontFamily: "DMSans_500Medium", fontSize: 11, color: COLORS.textSecondary },
  todayValue: { fontFamily: "DMSans_700Bold", fontSize: 19, color: COLORS.primary, marginTop: 2 },
  todayCount: { fontFamily: "DMSans_600SemiBold", fontSize: 10, color: COLORS.primary },
  card: { marginHorizontal: 16, marginBottom: 14, backgroundColor: COLORS.cardBg, borderRadius: 15, padding: 14, gap: 10 },
  cardTitle: { fontFamily: "DMSans_700Bold", fontSize: 15, color: COLORS.text },
  helperText: { fontFamily: "DMSans_400Regular", fontSize: 12, color: COLORS.textSecondary, lineHeight: 18, textAlign: "center" },
  helperTextLeft: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textSecondary, lineHeight: 17 },
  fieldLabel: { fontFamily: "DMSans_600SemiBold", fontSize: 11, color: COLORS.text, marginTop: 2 },
  input: { minHeight: 44, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 11, fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.text, backgroundColor: COLORS.background },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  flexField: { flex: 1 },
  totalPreview: { minHeight: 44, backgroundColor: COLORS.primarySurface, borderRadius: 10, paddingHorizontal: 11, justifyContent: "center" },
  totalPreviewLabel: { fontFamily: "DMSans_500Medium", fontSize: 10, color: COLORS.textSecondary },
  totalPreviewValue: { fontFamily: "DMSans_700Bold", fontSize: 14, color: COLORS.primary, marginTop: 2 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, paddingVertical: 7, paddingHorizontal: 10 },
  chipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySurface },
  chipText: { fontFamily: "DMSans_500Medium", fontSize: 10, color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.primary },
  primaryButton: { minHeight: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primary, paddingHorizontal: 16 },
  primaryButtonText: { fontFamily: "DMSans_700Bold", fontSize: 13, color: COLORS.white },
  buttonDisabled: { opacity: 0.65 },
  smallNote: { fontFamily: "DMSans_400Regular", fontSize: 10, color: COLORS.textMuted, lineHeight: 15 },
  sectionHeader: { marginHorizontal: 18, marginTop: 4, marginBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  saleCard: { marginHorizontal: 16, marginBottom: 9, padding: 13, backgroundColor: COLORS.cardBg, borderRadius: 13, gap: 8 },
  saleTopRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  saleBuyer: { fontFamily: "DMSans_700Bold", fontSize: 14, color: COLORS.text },
  saleMeta: { fontFamily: "DMSans_400Regular", fontSize: 10, color: COLORS.textSecondary, marginTop: 3, lineHeight: 14 },
  statusPill: { borderRadius: 14, paddingVertical: 5, paddingHorizontal: 8, maxWidth: 140 },
  statusGood: { backgroundColor: COLORS.primarySurface },
  statusMuted: { backgroundColor: COLORS.background },
  statusPending: { backgroundColor: COLORS.amberLight },
  statusText: { fontFamily: "DMSans_700Bold", fontSize: 9, color: COLORS.textSecondary, textAlign: "center" },
  saleDetails: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  saleDetailText: { fontFamily: "DMSans_500Medium", fontSize: 11, color: COLORS.textSecondary },
  saleTotal: { fontFamily: "DMSans_700Bold", fontSize: 14, color: COLORS.text },
  saleReason: { fontFamily: "DMSans_500Medium", fontSize: 10, color: COLORS.red },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  outlineAction: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7 },
  outlineActionText: { fontFamily: "DMSans_600SemiBold", fontSize: 10, color: COLORS.primary },
  dangerAction: { borderWidth: 1, borderColor: COLORS.red, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7 },
  dangerActionText: { fontFamily: "DMSans_600SemiBold", fontSize: 10, color: COLORS.red },
  emptyCard: { marginHorizontal: 16, marginBottom: 14, padding: 20, alignItems: "center", gap: 8, backgroundColor: COLORS.cardBg, borderRadius: 14 },
  reconcileCard: { marginHorizontal: 16, marginBottom: 14, padding: 14, gap: 9, backgroundColor: COLORS.cardBg, borderRadius: 15 },
  reconcileHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  metricRow: { flexDirection: "row", justifyContent: "space-between", gap: 10, borderTopWidth: 1, borderTopColor: COLORS.borderLight, paddingTop: 8 },
  metricLabel: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textSecondary, flex: 1 },
  metricValue: { fontFamily: "DMSans_600SemiBold", fontSize: 11, color: COLORS.text, textAlign: "right" },
  metricStrong: { fontFamily: "DMSans_700Bold", color: COLORS.text },
  varianceRow: { flexDirection: "row", justifyContent: "space-between", padding: 10, borderRadius: 9, backgroundColor: COLORS.primarySurface },
  varianceAlert: { backgroundColor: COLORS.redLight },
  varianceLabel: { fontFamily: "DMSans_600SemiBold", fontSize: 11, color: COLORS.text },
  varianceValue: { fontFamily: "DMSans_700Bold", fontSize: 11, color: COLORS.primary },
  divider: { height: 1, backgroundColor: COLORS.borderLight, marginVertical: 4 },
  smallButton: { borderRadius: 9, backgroundColor: COLORS.primary, minHeight: 38, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  smallButtonText: { fontFamily: "DMSans_700Bold", fontSize: 10, color: COLORS.white },
  secondaryButton: { minHeight: 42, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primarySurface, paddingHorizontal: 12 },
  secondaryButtonText: { fontFamily: "DMSans_700Bold", fontSize: 12, color: COLORS.primary },
  pendingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, borderTopWidth: 1, borderTopColor: COLORS.borderLight, paddingTop: 8 },
  pendingText: { flex: 1, fontFamily: "DMSans_400Regular", fontSize: 10, color: COLORS.textSecondary },
  issueCard: { padding: 10, borderRadius: 10, backgroundColor: COLORS.background, gap: 3 },
  issueTitle: { fontFamily: "DMSans_600SemiBold", fontSize: 11, color: COLORS.text },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(20,30,25,0.45)", alignItems: "center", justifyContent: "center", padding: 20 },
  modalCard: { width: "100%", maxWidth: 420, backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 16, gap: 12 },
  reasonInput: { minHeight: 90, paddingTop: 10 },
  cancelButton: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: COLORS.background },
  cancelButtonText: { fontFamily: "DMSans_600SemiBold", fontSize: 12, color: COLORS.textSecondary },
  modalSubmit: { flex: 1 },
});
