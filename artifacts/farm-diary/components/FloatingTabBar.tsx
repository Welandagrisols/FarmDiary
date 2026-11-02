import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ComponentProps } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import COLORS from "@/constants/colors";

type ExpoTabBarProps = Parameters<
  NonNullable<ComponentProps<typeof import("expo-router").Tabs>["tabBar"]>
>[0];

/**
 * Floating pill tab bar: white bar lifted off the screen edge, the current tab is a green pill.
 * Same five tabs and the same navigation as before; only the look changed.
 */
export function FloatingTabBar({ state, descriptors, navigation }: ExpoTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 0) + 14 }]}>
      <View style={styles.bar}>
        {state.routes.map((route: ExpoTabBarProps["state"]["routes"][number], index: number) => {
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;
          const focused = state.index === index;
          const color = focused ? COLORS.white : COLORS.textSecondary;
          const onPress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              Haptics.selectionAsync().catch(() => undefined);
              navigation.navigate(route.name, route.params);
            }
          };
          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
              style={styles.slot}
            >
              <View style={[styles.item, focused && styles.itemActive]}>
                {options.tabBarIcon ? options.tabBarIcon({ focused, color, size: 21 }) : null}
                <Text style={[styles.label, { color }]} numberOfLines={1}>{label}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16 },
  bar: {
    flexDirection: "row",
    backgroundColor: COLORS.cardBg,
    borderRadius: 30,
    padding: 8,
    gap: 4,
    shadowColor: "#111812",
    shadowOpacity: 0.14,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  slot: { flex: 1 },
  item: { alignItems: "center", justifyContent: "center", paddingVertical: 9, borderRadius: 22, gap: 3 },
  itemActive: { backgroundColor: COLORS.primary },
  label: { fontFamily: "Manrope_700Bold", fontSize: 12 },
});
