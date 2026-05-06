import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const tables = [
  {
    name: "farms",
    sql: `
      CREATE TABLE IF NOT EXISTS farms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        location TEXT NOT NULL DEFAULT '',
        total_acres NUMERIC NOT NULL DEFAULT 0,
        lease_status TEXT NOT NULL DEFAULT '',
        crop_type TEXT NOT NULL DEFAULT '',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `,
  },
  {
    name: "seasons",
    sql: `
      CREATE TABLE IF NOT EXISTS seasons (
        id TEXT PRIMARY KEY,
        farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
        season_number INTEGER NOT NULL DEFAULT 1,
        season_name TEXT NOT NULL,
        season_type TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active',
        template_id TEXT NOT NULL DEFAULT '',
        section_a JSONB NOT NULL DEFAULT '{}',
        section_b JSONB NOT NULL DEFAULT '{}',
        pre_planting_start_date TEXT,
        budget_kes NUMERIC,
        total_revenue_kes NUMERIC,
        total_cost_kes NUMERIC,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        closed_at TIMESTAMPTZ
      );
    `,
  },
  {
    name: "costs",
    sql: `
      CREATE TABLE IF NOT EXISTS costs (
        id TEXT PRIMARY KEY,
        farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
        season_id TEXT NOT NULL,
        section_id TEXT,
        cost_category TEXT NOT NULL DEFAULT '',
        cost_subcategory TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        cost_date TEXT NOT NULL DEFAULT '',
        is_pre_planting BOOLEAN NOT NULL DEFAULT false,
        is_historical BOOLEAN NOT NULL DEFAULT false,
        amount_kes NUMERIC NOT NULL DEFAULT 0,
        quantity NUMERIC,
        unit TEXT,
        unit_price_kes NUMERIC,
        product_name TEXT,
        supplier TEXT,
        receipt_reference TEXT,
        num_workers INTEGER,
        days_worked NUMERIC,
        rate_per_worker_per_day NUMERIC,
        facilitator_name TEXT,
        trip_from TEXT,
        trip_to TEXT,
        is_deviation BOOLEAN NOT NULL DEFAULT false,
        planned_product TEXT,
        deviation_reason TEXT,
        notes TEXT,
        weather_conditions TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `,
  },
  {
    name: "inventory",
    sql: `
      CREATE TABLE IF NOT EXISTS inventory (
        id TEXT PRIMARY KEY,
        farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
        season_id TEXT NOT NULL,
        product_name TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT '',
        quantity_purchased NUMERIC NOT NULL DEFAULT 0,
        unit TEXT NOT NULL DEFAULT '',
        unit_price_kes NUMERIC NOT NULL DEFAULT 0,
        quantity_used NUMERIC NOT NULL DEFAULT 0,
        purchase_date TEXT NOT NULL DEFAULT '',
        supplier TEXT,
        low_stock_threshold NUMERIC,
        is_historical BOOLEAN NOT NULL DEFAULT false,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `,
  },
  {
    name: "activity_logs",
    sql: `
      CREATE TABLE IF NOT EXISTS activity_logs (
        id TEXT PRIMARY KEY,
        farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
        season_id TEXT NOT NULL,
        section_id TEXT,
        schedule_activity_id TEXT,
        activity_name TEXT NOT NULL DEFAULT '',
        planned_date TEXT,
        actual_date TEXT NOT NULL DEFAULT '',
        products_used JSONB NOT NULL DEFAULT '[]',
        is_deviation BOOLEAN NOT NULL DEFAULT false,
        deviation_reason TEXT,
        num_workers INTEGER NOT NULL DEFAULT 0,
        labor_cost_kes NUMERIC NOT NULL DEFAULT 0,
        total_cost_kes NUMERIC NOT NULL DEFAULT 0,
        weather_conditions TEXT,
        is_historical BOOLEAN NOT NULL DEFAULT false,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `,
  },
  {
    name: "observations",
    sql: `
      CREATE TABLE IF NOT EXISTS observations (
        id TEXT PRIMARY KEY,
        farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
        season_id TEXT NOT NULL,
        section_id TEXT,
        observation_date TEXT NOT NULL DEFAULT '',
        observation_type TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        severity TEXT NOT NULL DEFAULT '',
        action_taken TEXT,
        is_historical BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `,
  },
  {
    name: "harvest_records",
    sql: `
      CREATE TABLE IF NOT EXISTS harvest_records (
        id TEXT PRIMARY KEY,
        farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
        season_id TEXT NOT NULL,
        section_id TEXT NOT NULL DEFAULT '',
        harvest_date TEXT NOT NULL DEFAULT '',
        bags NUMERIC NOT NULL DEFAULT 0,
        kg_per_bag NUMERIC NOT NULL DEFAULT 0,
        total_kg NUMERIC NOT NULL DEFAULT 0,
        price_per_bag_kes NUMERIC NOT NULL DEFAULT 0,
        total_revenue_kes NUMERIC NOT NULL DEFAULT 0,
        buyer TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `,
  },
  {
    name: "personal_expenses",
    sql: `
      CREATE TABLE IF NOT EXISTS personal_expenses (
        id TEXT PRIMARY KEY,
        farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
        season_id TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT '',
        subcategory TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        expense_date TEXT NOT NULL DEFAULT '',
        amount_kes NUMERIC NOT NULL DEFAULT 0,
        visitor_name TEXT,
        visitor_role TEXT,
        trip_from TEXT,
        trip_to TEXT,
        receipt_reference TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `,
  },
];

async function run() {
  console.log("Creating Supabase tables...\n");
  for (const table of tables) {
    try {
      const { error } = await supabase.rpc("exec_sql", { sql: table.sql });
      if (error) {
        console.log(`  [WARN] ${table.name}: RPC not available — trying direct insert check`);
      } else {
        console.log(`  [OK] ${table.name}`);
      }
    } catch (e: any) {
      console.log(`  [WARN] ${table.name}: ${e.message}`);
    }
  }

  // Try a direct REST call to the Supabase SQL endpoint (service role only)
  console.log("\nAttempting direct SQL via REST API...");
  const allSql = tables.map((t) => t.sql).join("\n");
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": serviceRoleKey,
      "Authorization": `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ sql: allSql }),
  });
  console.log("REST response:", res.status, await res.text());

  // Also try via the management API
  console.log("\nAttempting via Supabase management API...");
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  console.log("Project ref:", projectRef);
  
  for (const table of tables) {
    const mgmtRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ query: table.sql }),
    });
    const text = await mgmtRes.text();
    console.log(`  ${table.name}: ${mgmtRes.status} ${text.slice(0, 100)}`);
  }
}

run().catch(console.error);
