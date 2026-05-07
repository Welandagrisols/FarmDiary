import { defineConfig } from "drizzle-kit";

const dbUrl =
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error(
    "No database URL found. Set SUPABASE_DB_URL (Supabase direct connection string) or DATABASE_URL."
  );
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
});
