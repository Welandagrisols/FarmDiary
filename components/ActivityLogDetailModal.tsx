import React from "react";
import {
  View, Text, StyleSheet, Modal, ScrollView, Pressable,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "@/constants/colors";
import { ActivityLog, formatDate, formatKES } from "@/lib/storage";
import { PLANNED_SCHEDULE } from "@/constants/farmData";

interface Props {
  log: ActivityLog;
  onClose: () => void;
  onDelete?: () => void;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function ActivityLogDetailModal({ log, onClose, onDelete }: Props) {
  const sectionLabel =
    log.section_id === "section-a" ? "Section A" :
    log.section_id === "section-b" ? "Section B" : "Both Sections";

  const sectionColor =
    log.section_id === "section-a" ? COLORS.primary :
    log.section_id === "section-b" ? COLORS.teal : COLORS.amber;

  const plannedActivity = log.schedule_activity_id
    ? PLANNED_SCHEDULE.find((a) => a.id === log.schedule_activity_id)
    : null;

  const isQuickComplete =
    log.total_cost_kes === 0 &&
    (log.products_used ?? []).length === 0 &&
    log.labor_cost_kes === 0;

  const hasDeviations = (log.products_used ?? []).some((p) => p.is_deviation);

  const weatherIcon = (w: string | null) => {
    if (!w) return "help-circle-outline";
    if (w.includes("Sunny")) return "sunny-outline";
    if (w.includes("Cloudy")) return "cloud-outline";
    if (w.includes("Light Rain")) return "rainy-outline";
    return "thunderstorm-outline";
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={[styles.sectionBadge, { backgroundColor: sectionColor + "20" }]}>
            <Text style={[styles.sectionBadgeText, { color: sectionColor }]}>{sectionLabel}</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
            <Ionicons name="close" size={22} color={COLORS.textSecondary} />
          </Pressable>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>{log.activity_name}</Text>

          {hasDeviations && (
            <View style={styles.deviationBanner}>
              <Ionicons name="swap-horizontal" size={15} color={COLORS.amber} />
              <Text style={styles.deviationBannerText}>Some products were substituted — see details below</Text>
            </View>
          )}

          <View style={styles.dateRow}>
            <View style={styles.dateCard}>
              <Text style={styles.dateCardLabel}>Actual Date</Text>
              <Text style={styles.dateCardValue}>{formatDate(log.actual_date)}</Text>
            </View>
            {plannedActivity && (
              <View style={[styles.dateCard, styles.dateCardPlanned]}>
                <Text style={styles.dateCardLabel}>Planned</Text>
                <Text style={[styles.dateCardValue, { color: COLORS.textSecondary, fontSize: 13 }]}>
                  {formatDate(plannedActivity.plannedDateA)}
                </Text>
              </View>
            )}
          </View>

          {log.weather_conditions && (
            <View style={styles.weatherRow}>
              <Ionicons name={weatherIcon(log.weather_conditions)} size={18} color={COLORS.primary} />
              <Text style={styles.weatherText}>{log.weather_conditions}</Text>
            </View>
          )}

          {isQuickComplete ? (
            <View style={styles.quickCompleteBox}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
              <Text style={styles.quickCompleteText}>Marked as done — no costs were recorded</Text>
            </View>
          ) : (
            <>
              {log.labor_cost_kes > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Labour</Text>
                  <View style={styles.detailCard}>
                    <InfoRow
                      label="Workers"
                      value={log.num_workers > 0 ? `${log.num_workers} ${log.num_workers === 1 ? "worker" : "workers"}` : "—"}
                    />
                    <InfoRow label="Labour Cost" value={formatKES(log.labor_cost_kes)} />
                  </View>
                </View>
              )}

              {(log.products_used ?? []).length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Products Used</Text>
                  {(log.products_used ?? []).map((p, i) => (
                    <View key={i} style={[styles.productCard, p.is_deviation && styles.productCardDeviation]}>
                      <View style={styles.productTop}>
                        <View style={styles.productLeft}>
                          {p.is_deviation ? (
                            <>
                              <View style={styles.deviationRow}>
                                <Ionicons name="swap-horizontal" size={12} color={COLORS.amber} />
                                <Text style={styles.deviationTag}>Substituted</Text>
                              </View>
                              <Text style={styles.productName}>{p.actual_product || p.name}</Text>
                              <Text style={styles.plannedProductText}>
                                Planned: {p.name}
                              </Text>
                              {p.deviation_reason ? (
                                <Text style={styles.deviationReasonText}>Reason: {p.deviation_reason}</Text>
                              ) : null}
                            </>
                          ) : (
                            <Text style={styles.productName}>{p.name}</Text>
                          )}
                        </View>
                        <Text style={styles.productCost}>{formatKES(p.total ?? 0)}</Text>
                      </View>
                      <View style={styles.productBottom}>
                        <Text style={styles.productQty}>{p.qty} {p.unit}</Text>
                        {(p.unit_price ?? 0) > 0 && (
                          <Text style={styles.productUnit}>@ {formatKES(p.unit_price ?? 0)} / {p.unit}</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          {log.total_cost_kes > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Cost</Text>
              <Text style={styles.totalValue}>{formatKES(log.total_cost_kes)}</Text>
            </View>
          )}

          {log.notes && log.notes !== "Quick-completed (no costs logged)" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notes</Text>
              <View style={styles.notesBox}>
                <Text style={styles.notesText}>{log.notes}</Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {onDelete && (
            <Pressable style={styles.deleteBtn} onPress={onDelete}>
              <Ionicons name="trash-outline" size={18} color={COLORS.red} />
            </Pressable>
          )}
          <Pressable
            style={styles.editBtn}
            onPress={() => {
              onClose();
              router.push({ pathname: "/edit-activity", params: { logId: log.id } });
            }}
          >
            <Ionicons name="pencil-outline" size={16} color={COLORS.primary} />
            <Text style={styles.editBtnText}>Edit Record</Text>
          </Pressable>
          <Pressable
            style={styles.logAgainBtn}
            onPress={() => {
              onClose();
              router.push({
                pathname: "/log-activity",
                params: log.schedule_activity_id ? { activityId: log.schedule_activity_id } : {},
              });
            }}
          >
            <Ionicons name="add" size={16} color={COLORS.white} />
            <Text style={styles.logAgainBtnText}>Log Again</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cardBg },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 16, paddingTop: 20,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  sectionBadge: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
  },
  sectionBadgeText: { fontFamily: "DMSans_700Bold", fontSize: 12 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.borderLight,
    alignItems: "center", justifyContent: "center",
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 8 },
  title: {
    fontFamily: "DMSans_700Bold", fontSize: 22, color: COLORS.text, letterSpacing: -0.3,
  },
  deviationBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: COLORS.amberLight, borderRadius: 10, padding: 12,
    borderLeftWidth: 3, borderLeftColor: COLORS.amber,
  },
  deviationBannerText: {
    fontFamily: "DMSans_500Medium", fontSize: 13, color: COLORS.amberDark, flex: 1,
  },
  dateRow: { flexDirection: "row", gap: 10 },
  dateCard: {
    flex: 1, backgroundColor: COLORS.primarySurface, borderRadius: 12, padding: 12, gap: 4,
    borderWidth: 1, borderColor: COLORS.primary + "30",
  },
  dateCardPlanned: {
    backgroundColor: COLORS.borderLight, borderColor: COLORS.border,
  },
  dateCardLabel: {
    fontFamily: "DMSans_600SemiBold", fontSize: 10, color: COLORS.textMuted,
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  dateCardValue: { fontFamily: "DMSans_700Bold", fontSize: 15, color: COLORS.primary },
  weatherRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: COLORS.borderLight, borderRadius: 10, padding: 12,
  },
  weatherText: { fontFamily: "DMSans_500Medium", fontSize: 14, color: COLORS.text },
  quickCompleteBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: COLORS.primarySurface, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: COLORS.primary + "30",
  },
  quickCompleteText: {
    fontFamily: "DMSans_500Medium", fontSize: 14, color: COLORS.primary, flex: 1,
  },
  section: { gap: 8 },
  sectionTitle: {
    fontFamily: "DMSans_700Bold", fontSize: 12, color: COLORS.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  detailCard: {
    backgroundColor: COLORS.background, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border, overflow: "hidden",
  },
  infoRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  infoLabel: { fontFamily: "DMSans_400Regular", fontSize: 13, color: COLORS.textSecondary },
  infoValue: { fontFamily: "DMSans_600SemiBold", fontSize: 13, color: COLORS.text },
  productCard: {
    backgroundColor: COLORS.background, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border, padding: 12, gap: 6,
  },
  productCardDeviation: {
    borderColor: COLORS.amber, backgroundColor: "#FFFDE7",
  },
  productTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  productLeft: { flex: 1, gap: 2, marginRight: 8 },
  deviationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 },
  deviationTag: { fontFamily: "DMSans_600SemiBold", fontSize: 10, color: COLORS.amber },
  productName: { fontFamily: "DMSans_700Bold", fontSize: 14, color: COLORS.text },
  plannedProductText: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textSecondary },
  deviationReasonText: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.amberDark, fontStyle: "italic" },
  productCost: { fontFamily: "DMSans_700Bold", fontSize: 14, color: COLORS.primary },
  productBottom: { flexDirection: "row", alignItems: "center", gap: 8 },
  productQty: { fontFamily: "DMSans_500Medium", fontSize: 12, color: COLORS.textSecondary },
  productUnit: { fontFamily: "DMSans_400Regular", fontSize: 11, color: COLORS.textMuted },
  totalRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: COLORS.primarySurface, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: COLORS.primary + "40",
  },
  totalLabel: { fontFamily: "DMSans_700Bold", fontSize: 15, color: COLORS.primary },
  totalValue: { fontFamily: "DMSans_700Bold", fontSize: 20, color: COLORS.primary },
  notesBox: {
    backgroundColor: COLORS.background, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border, padding: 14,
  },
  notesText: { fontFamily: "DMSans_400Regular", fontSize: 14, color: COLORS.text, lineHeight: 21 },
  footer: {
    flexDirection: "row", gap: 10, padding: 16, paddingBottom: 34,
    borderTopWidth: 1, borderTopColor: COLORS.borderLight,
    backgroundColor: COLORS.cardBg,
  },
  deleteBtn: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: COLORS.redLight, alignItems: "center", justifyContent: "center",
  },
  editBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, backgroundColor: COLORS.primarySurface, borderRadius: 12, paddingVertical: 13,
    borderWidth: 1.5, borderColor: COLORS.primary + "50",
  },
  editBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 14, color: COLORS.primary },
  logAgainBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 13,
  },
  logAgainBtnText: { fontFamily: "DMSans_600SemiBold", fontSize: 14, color: COLORS.white },
});
