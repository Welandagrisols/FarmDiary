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

async function requireFarmManager(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) { res.status(401).json({ message: "Unauthorized" }); return; }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) { res.status(401).json({ message: "Invalid token" }); return; }

    const farmIdParam = req.params.farmId;
    const farmId = Array.isArray(farmIdParam) ? farmIdParam[0] : farmIdParam;
    if (!farmId) { res.status(400).json({ message: "Farm ID required" }); return; }

    const [{ data: farm }, { data: profile }] = await Promise.all([
      supabaseAdmin.from("farms").select("user_id").eq("id", farmId).maybeSingle(),
      supabaseAdmin.from("user_profiles").select("role").eq("id", user.id).maybeSingle(),
    ]);
    if (!farm) { res.status(404).json({ message: "Farm not found" }); return; }

    let farmRole = profile?.role === "admin" ? "admin" : farm.user_id === user.id ? "owner" : "none";
    if (farmRole === "none") {
      const { data: membership } = await supabaseAdmin
        .from("farm_memberships")
        .select("role")
        .eq("farm_id", farmId)
        .eq("user_id", user.id)
        .maybeSingle();
      farmRole = membership?.role ?? "none";
    }
    if (!["admin", "owner", "manager"].includes(farmRole)) {
      res.status(403).json({ message: "Farm owner or manager access required" });
      return;
    }

    (req as any).farmUser = user;
    (req as any).farmRole = farmRole;
    (req as any).farmId = farmId;
    next();
  } catch {
    res.status(500).json({ message: "Farm access check failed" });
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

  // ── Farm-scoped team access ─────────────────────────────────────────
  app.get("/api/farms/:farmId/team", requireFarmManager, async (req: Request, res: Response) => {
    const farmId = (req as any).farmId as string;
    const { data: memberships, error } = await supabaseAdmin
      .from("farm_memberships")
      .select("user_id, role, created_at")
      .eq("farm_id", farmId)
      .order("created_at");
    if (error) { res.status(400).json({ message: error.message }); return; }

    const userIds = (memberships || []).map((membership) => membership.user_id);
    const { data: profiles } = userIds.length
      ? await supabaseAdmin.from("user_profiles").select("id, email").in("id", userIds)
      : { data: [] };
    const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
    res.json({
      currentRole: (req as any).farmRole,
      members: (memberships || []).map((membership) => ({
        ...membership,
        email: profileById.get(membership.user_id)?.email ?? "",
      })),
    });
  });

  app.post("/api/farms/:farmId/team", requireFarmManager, async (req: Request, res: Response) => {
    const farmId = (req as any).farmId as string;
    const farmRole = (req as any).farmRole as string;
    const { email, password, role } = req.body;
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      res.status(400).json({ message: "A valid email address is required" });
      return;
    }
    if (typeof password !== "string" || password.length < 8) {
      res.status(400).json({ message: "Password must be at least 8 characters" });
      return;
    }
    if (!["seller", "storekeeper", "manager"].includes(role)) {
      res.status(400).json({ message: "Invalid farm role" });
      return;
    }
    if (role === "manager" && !["admin", "owner"].includes(farmRole)) {
      res.status(403).json({ message: "Only the farm owner can add a manager" });
      return;
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
    });
    if (error || !data.user) {
      res.status(400).json({ message: error?.message || "Unable to create account" });
      return;
    }

    const { error: profileError } = await supabaseAdmin.from("user_profiles").upsert({
      id: data.user.id,
      email: normalizedEmail,
      role: "farmer",
      created_at: new Date().toISOString(),
    }, { onConflict: "id" });
    const membershipId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const { error: membershipError } = profileError
      ? { error: profileError }
      : await supabaseAdmin.from("farm_memberships").insert({
          id: membershipId,
          farm_id: farmId,
          user_id: data.user.id,
          role,
        });
    if (membershipError) {
      await supabaseAdmin.auth.admin.deleteUser(data.user.id);
      res.status(400).json({ message: membershipError.message });
      return;
    }
    res.json({ member: { user_id: data.user.id, email: normalizedEmail, role } });
  });

  app.delete("/api/farms/:farmId/team/:userId", requireFarmManager, async (req: Request, res: Response) => {
    const farmId = (req as any).farmId as string;
    const farmRole = (req as any).farmRole as string;
    const userIdParam = req.params.userId;
    const userId = Array.isArray(userIdParam) ? userIdParam[0] : userIdParam;
    if (!userId) { res.status(400).json({ message: "User ID required" }); return; }

    const { data: member, error: lookupError } = await supabaseAdmin
      .from("farm_memberships")
      .select("role")
      .eq("farm_id", farmId)
      .eq("user_id", userId)
      .maybeSingle();
    if (lookupError || !member) { res.status(404).json({ message: "Team member not found" }); return; }
    if (member.role === "manager" && !["admin", "owner"].includes(farmRole)) {
      res.status(403).json({ message: "Only the farm owner can remove a manager" });
      return;
    }
    const { error } = await supabaseAdmin.from("farm_memberships")
      .delete().eq("farm_id", farmId).eq("user_id", userId);
    if (error) { res.status(400).json({ message: error.message }); return; }
    res.json({ success: true });
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
