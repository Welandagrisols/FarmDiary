// Bridge non-prefixed Replit secrets → EXPO_PUBLIC_ so Metro inlines them at bundle time
if (process.env.SUPABASE_URL && !process.env.EXPO_PUBLIC_SUPABASE_URL) {
  process.env.EXPO_PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL;
}
if (process.env.SUPABASE_ANON_KEY && !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
}

module.exports = {
  name: "Agrisols Farm Diary",
  slug: "agrisols-farm-diary",
  version: "1.0.1",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "farmdiary",
  userInterfaceStyle: "light",
  newArchEnabled: false,
  splash: {
    image: "./assets/images/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#1B5E20",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.farmdiary",
  },
  android: {
    package: "com.farmdiary",
    versionCode: 2,
    adaptiveIcon: {
      backgroundColor: "#1B5E20",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
  },
  web: {
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    ["expo-router", { origin: "https://replit.com/" }],
    "expo-font",
    "expo-web-browser",
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: "eda7ceee-0d43-4a6e-945e-37f315d2278c",
    },
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || "",
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
    apiDomain: process.env.EXPO_PUBLIC_API_DOMAIN || process.env.REPLIT_DEV_DOMAIN || "",
  },
  owner: "kaititburgei",
};
