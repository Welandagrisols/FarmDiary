import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "node:http";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) { res.status(401).json({ message: "Unauthorized" }); return; }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) { res.status(401).json({ message: "Invalid token" }); return; }

    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") { res.status(403).json({ message: "Admin only" }); return; }

    (req as any).adminUser = user;
    next();
  } catch {
    res.status(500).json({ message: "Auth error" });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {

  // ── Create user ─────────────────────────────────────────────────────
  app.post("/api/admin/create-user", requireAdmin, async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) { res.status(400).json({ message: "Email and password required" }); return; }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
    });

    if (error) { res.status(400).json({ message: error.message }); return; }

    await supabaseAdmin.from("user_profiles").upsert({
      id: data.user.id,
      email: email.trim(),
      role: "farmer",
      created_at: new Date().toISOString(),
    }, { onConflict: "id" });

    res.json({ user: { id: data.user.id, email: data.user.email } });
  });

  // ── Delete user ─────────────────────────────────────────────────────
  app.delete("/api/admin/users/:userId", requireAdmin, async (req: Request, res: Response) => {
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    if (!userId) { res.status(400).json({ message: "User ID required" }); return; }
    await supabaseAdmin.from("user_profiles").delete().eq("id", userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) { res.status(400).json({ message: error.message }); return; }
    res.json({ success: true });
  });

  // ── Update user role ────────────────────────────────────────────────
  app.patch("/api/admin/users/:userId/role", requireAdmin, async (req: Request, res: Response) => {
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    if (!userId) { res.status(400).json({ message: "User ID required" }); return; }
    const { role } = req.body;
    if (!["farmer", "admin"].includes(role)) { res.status(400).json({ message: "Invalid role" }); return; }
    const { error } = await supabaseAdmin.from("user_profiles").update({ role }).eq("id", userId);
    if (error) { res.status(400).json({ message: error.message }); return; }
    res.json({ success: true });
  });

  // ── Assign farm to user ─────────────────────────────────────────────
  app.patch("/api/admin/farms/:farmId/assign", requireAdmin, async (req: Request, res: Response) => {
    const { farmId } = req.params;
    const { userId } = req.body;
    const { error } = await supabaseAdmin
      .from("farms")
      .update({ user_id: userId ?? null })
      .eq("id", farmId);
    if (error) { res.status(400).json({ message: error.message }); return; }
    res.json({ success: true });
  });

  // ── Create farm (admin assigns to any user) ─────────────────────────
  app.post("/api/admin/farms", requireAdmin, async (req: Request, res: Response) => {
    const { name, location, total_acres, lease_status, crop_type, notes, user_id } = req.body;
    if (!name) { res.status(400).json({ message: "Farm name required" }); return; }

    const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    const record = {
      id,
      name,
      location: location || "",
      total_acres: parseFloat(total_acres) || 0,
      lease_status: lease_status || "Owned",
      crop_type: crop_type || "Potato",
      notes: notes || null,
      user_id: user_id || null,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin.from("farms").insert(record).select().single();
    if (error) { res.status(400).json({ message: error.message }); return; }
    res.json({ farm: data });
  });

  // ── One-time local → cloud migration (bypasses RLS via service role) ──
  app.post("/api/migrate", async (req: Request, res: Response) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) { res.status(401).json({ message: "Unauthorized" }); return; }

      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !user) { res.status(401).json({ message: "Invalid token" }); return; }

      const payload = req.body ?? {};
      const collections: { name: string; rows: any[] }[] = [
        { name: "farms", rows: payload.farms ?? [] },
        { name: "seasons", rows: payload.seasons ?? [] },
        { name: "costs", rows: payload.costs ?? [] },
        { name: "inventory", rows: payload.inventory ?? [] },
        { name: "activity_logs", rows: payload.activityLogs ?? [] },
        { name: "observations", rows: payload.observations ?? [] },
        { name: "harvest_records", rows: payload.harvestRecords ?? [] },
        { name: "personal_expenses", rows: payload.personalExpenses ?? [] },
      ];

      for (const collection of collections) {
        if (!Array.isArray(collection.rows)) {
          res.status(400).json({ message: `Invalid ${collection.name} migration data` });
          return;
        }
      }

      const farms = collections.find((collection) => collection.name === "farms")!.rows;
      const importedFarmIds = new Set<string>();
      for (const farm of farms) {
        if (typeof farm.id !== "string" || !farm.id) {
          res.status(400).json({ message: "Every imported farm must have an ID" });
          return;
        }
        importedFarmIds.add(farm.id);
      }

      const relatedCollections = collections.filter((collection) => collection.name !== "farms");
      const referencedFarmIds = new Set(importedFarmIds);
      for (const collection of relatedCollections) {
        for (const row of collection.rows) {
          if (typeof row.farm_id !== "string" || !row.farm_id) {
            res.status(400).json({ message: `Every ${collection.name} record must reference a farm` });
            return;
          }
          referencedFarmIds.add(row.farm_id);
        }
      }

      const referencedIds = [...referencedFarmIds];
      const existingFarms = referencedIds.length
        ? await supabaseAdmin.from("farms").select("id,user_id").in("id", referencedIds)
        : { data: [], error: null };
      if (existingFarms.error) {
        res.status(500).json({ message: existingFarms.error.message });
        return;
      }

      const existingFarmById = new Map(
        (existingFarms.data ?? []).map((farm) => [farm.id, farm.user_id as string | null])
      );
      const conflictingFarm = [...importedFarmIds].find((id) => {
        const ownerId = existingFarmById.get(id);
        return ownerId != null && ownerId !== user.id;
      });
      if (conflictingFarm) {
        res.status(409).json({ message: "An imported farm is already assigned to another account." });
        return;
      }

      const allowedFarmIds = new Set<string>([
        ...[...importedFarmIds],
        ...[...existingFarmById.entries()]
          .filter(([, ownerId]) => ownerId === user.id)
          .map(([id]) => id),
      ]);
      const unrelatedFarmId = [...relatedCollections]
        .flatMap((collection) => collection.rows)
        .find((row) => !allowedFarmIds.has(row.farm_id))?.farm_id;
      if (unrelatedFarmId) {
        res.status(403).json({ message: "Migration contains records for a farm not assigned to this account." });
        return;
      }

      const farmsWithOwner = farms.map((farm) => ({ ...farm, user_id: user.id }));
      collections[0].rows = farmsWithOwner;

      for (const { name, rows } of collections) {
        if (!rows.length) continue;
        const { error } = await supabaseAdmin.from(name).upsert(rows, { onConflict: "id" });
        if (error) { res.status(400).json({ message: `${name}: ${error.message}` }); return; }
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Migration failed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
