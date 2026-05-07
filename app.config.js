const appJson = require("./app.json");

// Bridge non-prefixed Replit secrets → EXPO_PUBLIC_ so Metro inlines them at bundle time
if (process.env.SUPABASE_URL && !process.env.EXPO_PUBLIC_SUPABASE_URL) {
  process.env.EXPO_PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL;
}
if (process.env.SUPABASE_ANON_KEY && !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
}

module.exports = {
  ...appJson.expo,
  extra: {
    ...appJson.expo.extra,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || "",
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
    apiDomain: process.env.REPLIT_DEV_DOMAIN || "",
  },
};
