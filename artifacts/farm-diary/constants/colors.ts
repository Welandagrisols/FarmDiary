// FarmDiary design tokens (see docs/improvements/DESIGN.md).
// Soft grey-green screens, white cards with a soft shadow, a brand green, and one near-black "ink" for hero cards.
const COLORS = {
  // brand
  primary: "#187E36",
  primaryLight: "#2E9B4D",
  primaryMid: "#22893E",
  primarySurface: "#D6F5D9",
  primaryText: "#024819",
  // ink: dark hero cards and active filter pills
  ink: "#141D16",
  inkText: "#FFFFFF",
  inkMuted: "rgba(255,255,255,0.68)",
  inkLine: "rgba(255,255,255,0.15)",
  inkSoft: "rgba(255,255,255,0.08)",
  accentOnInk: "#7BD88F",
  dangerOnInk: "#FF8F85",
  // surfaces
  background: "#F2F4F2",
  cardBg: "#FFFFFF",
  muted: "#EBEEEA",
  border: "#DFE2DE",
  borderLight: "#EBEEEA",
  white: "#FFFFFF",
  black: "#000000",
  shadow: "#111812",
  // text
  text: "#111812",
  textSecondary: "#646B65",
  textMuted: "#646B65",
  // status
  amber: "#E58212",
  amberLight: "#FFEECD",
  amberDark: "#8F4D00",
  red: "#D73431",
  redLight: "#FFE7E4",
  green: "#187E36",
  greenLight: "#D6F5D9",
  blue: "#1777B8",
  blueLight: "#DFF1FF",
  purple: "#6B3FA0",
  purpleLight: "#EEE5F8",
  teal: "#0B7A6B",
  tealLight: "#D9F3EE",
  orange: "#D9531E",
  orangeLight: "#FFE9DF",
};

export default COLORS;

/** White card elevation: soft, wide shadow instead of a border. */
export const CARD_SHADOW = {
  shadowColor: "#111812",
  shadowOpacity: 0.06,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
} as const;

/** Soft background + strong text pairs per cost category. */
export const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "Pre-Planting": { bg: "#FFEECD", text: "#8F4D00" },
  "Inputs": { bg: "#D6F5D9", text: "#024819" },
  "Labor": { bg: "#DFF1FF", text: "#0E5A8E" },
  "Facilitation": { bg: "#EEE5F8", text: "#4F2C82" },
  "Logistics": { bg: "#D9F3EE", text: "#075B50" },
  "Equipment": { bg: "#FFE9DF", text: "#9A360F" },
  "Community & Goodwill": { bg: "#FFE4EC", text: "#8A1F45" },
  "Overhead": { bg: "#EBEEEA", text: "#2F362F" },
};
