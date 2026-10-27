import { Router, type NextFunction, type Request, type Response } from "express";
import { supabaseAdmin } from "../lib/supabase-admin";

type AuthUser = { id: string; email?: string };

function textParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function getBearerToken(req: Request): string {
  const value = req.headers.authorization ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match?.[1]?.trim() ?? "";
}

async function authenticate(req: Request, res: Response): Promise<AuthUser | null> {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ message: "Invalid token" });
    return null;
  }
  return { id: data.user.id, email: data.user.email ?? undefined };
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authenticate(req, res);
    if (!user) return;
    const { data: profile, error } = await supabaseAdmin
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (error) {
      res.status(500).json({ message: "Could not verify admin access." });
      return;
    }
    if (profile?.role !== "admin") {
      res.status(403).json({ message: "Admin only" });
      return;
    }
    res.locals.authUser = user;
    next();
  } catch (error) {
    console.error("[admin] access check failed:", error);
    res.status(500).json({ message: "Could not verify admin access." });
  }
}

export async function requireFarmManager(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = await authenticate(req, res);
    if (!user) return;
    const farmId = textParam(req.params.farmId);
    if (!farmId) {
      res.status(400).json({ message: "Farm ID required" });
      return;
    }

    const [{ data: farm, error: farmError }, { data: profile, error: profileError }] =
      await Promise.all([
        supabaseAdmin.from("farms").select("user_id").eq("id", farmId).maybeSingle(),
        supabaseAdmin.from("user_profiles").select("role").eq("id", user.id).maybeSingle(),
      ]);
    if (farmError || profileError) {
      res.status(500).json({ message: "Could not verify farm access." });
      return;
    }
    if (!farm) {
      res.status(404).json({ message: "Farm not found" });
      return;
    }

    let role =
      profile?.role === "admin"
        ? "admin"
        : farm.user_id === user.id
          ? "owner"
          : "none";
    if (role === "none") {
      const { data: membership, error } = await supabaseAdmin
        .from("farm_memberships")
        .select("role")
        .eq("farm_id", farmId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        res.status(500).json({ message: "Could not verify farm access." });
        return;
      }
      role = membership?.role ?? "none";
    }
    if (!["admin", "owner", "manager"].includes(role)) {
      res.status(403).json({ message: "Farm owner or manager access required" });
      return;
    }
    res.locals.authUser = user;
    res.locals.farmId = farmId;
    res.locals.farmRole = role;
    next();
  } catch (error) {
    console.error("[farm-team] access check failed:", error);
    res.status(500).json({ message: "Could not verify farm access." });
  }
}

function validEmail(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  );
}

export function registerFarmWorkflowRoutes(router: Router) {
  router.post("/admin/create-user", requireAdmin, async (req, res) => {
    const email = validEmail(req.body?.email) ? req.body.email.trim().toLowerCase() : "";
    const password = req.body?.password;
    if (!email || typeof password !== "string" || password.length < 8) {
      res.status(400).json({ message: "A valid email and password of at least 8 characters are required." });
      return;
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) {
      res.status(400).json({ message: error?.message ?? "Unable to create account." });
      return;
    }

    const { error: profileError } = await supabaseAdmin.from("user_profiles").upsert(
      { id: data.user.id, email, role: "farmer", created_at: new Date().toISOString() },
      { onConflict: "id" },
    );
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(data.user.id);
      res.status(400).json({ message: "The account was created but its profile could not be saved." });
      return;
    }
    res.json({ user: { id: data.user.id, email: data.user.email } });
  });

  router.get("/farms/:farmId/team", requireFarmManager, async (_req, res) => {
    const farmId = res.locals.farmId as string;
    const { data: memberships, error } = await supabaseAdmin
      .from("farm_memberships")
      .select("user_id, role, created_at")
      .eq("farm_id", farmId)
      .order("created_at");
    if (error) {
      res.status(400).json({ message: error.message });
      return;
    }

    const userIds = (memberships ?? []).map((member) => member.user_id);
    const { data: profiles, error: profileError } = userIds.length
      ? await supabaseAdmin.from("user_profiles").select("id, email").in("id", userIds)
      : { data: [], error: null };
    if (profileError) {
      res.status(400).json({ message: profileError.message });
      return;
    }
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    res.json({
      currentRole: res.locals.farmRole,
      members: (memberships ?? []).map((member) => ({
        ...member,
        email: profileById.get(member.user_id)?.email ?? "",
      })),
    });
  });

  router.post("/farms/:farmId/team", requireFarmManager, async (req, res) => {
    const farmId = res.locals.farmId as string;
    const currentRole = res.locals.farmRole as string;
    const email = validEmail(req.body?.email) ? req.body.email.trim().toLowerCase() : "";
    const password = req.body?.password;
    const role = req.body?.role;
    if (!email) {
      res.status(400).json({ message: "A valid email address is required." });
      return;
    }
    if (typeof password !== "string" || password.length < 8) {
      res.status(400).json({ message: "Password must be at least 8 characters." });
      return;
    }
    if (!["manager", "seller", "storekeeper"].includes(role)) {
      res.status(400).json({ message: "Invalid farm role." });
      return;
    }
    if (role === "manager" && !["admin", "owner"].includes(currentRole)) {
      res.status(403).json({ message: "Only the farm owner can add a manager." });
      return;
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) {
      res.status(400).json({ message: error?.message ?? "Unable to create account." });
      return;
    }
    const { error: profileError } = await supabaseAdmin.from("user_profiles").upsert(
      { id: data.user.id, email, role: "farmer", created_at: new Date().toISOString() },
      { onConflict: "id" },
    );
    const { error: membershipError } = profileError
      ? { error: profileError }
      : await supabaseAdmin.from("farm_memberships").insert({
          id: crypto.randomUUID(),
          farm_id: farmId,
          user_id: data.user.id,
          role,
        });
    if (membershipError) {
      await supabaseAdmin.auth.admin.deleteUser(data.user.id);
      res.status(400).json({ message: membershipError.message });
      return;
    }
    res.json({ member: { user_id: data.user.id, email, role } });
  });

  router.delete("/farms/:farmId/team/:userId", requireFarmManager, async (req, res) => {
    const farmId = res.locals.farmId as string;
    const currentRole = res.locals.farmRole as string;
    const userId = textParam(req.params.userId);
    if (!userId) {
      res.status(400).json({ message: "User ID required" });
      return;
    }
    if (userId === (res.locals.authUser as AuthUser).id) {
      res.status(400).json({ message: "You cannot remove your own farm access." });
      return;
    }
    const { data: member, error: lookupError } = await supabaseAdmin
      .from("farm_memberships")
      .select("role")
      .eq("farm_id", farmId)
      .eq("user_id", userId)
      .maybeSingle();
    if (lookupError || !member) {
      res.status(404).json({ message: "Team member not found." });
      return;
    }
    if (member.role === "manager" && !["admin", "owner"].includes(currentRole)) {
      res.status(403).json({ message: "Only the farm owner can remove a manager." });
      return;
    }
    const { error } = await supabaseAdmin.from("farm_memberships")
      .delete().eq("farm_id", farmId).eq("user_id", userId);
    if (error) {
      res.status(400).json({ message: error.message });
      return;
    }
    res.json({ success: true });
  });

  router.delete("/admin/users/:userId", requireAdmin, async (req, res) => {
    const userId = textParam(req.params.userId);
    if (!userId) {
      res.status(400).json({ message: "User ID required" });
      return;
    }
    if (userId === (res.locals.authUser as AuthUser).id) {
      res.status(400).json({ message: "You cannot delete your own admin account." });
      return;
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) {
      res.status(400).json({ message: error.message });
      return;
    }
    await supabaseAdmin.from("user_profiles").delete().eq("id", userId);
    res.json({ success: true });
  });

  router.patch("/admin/users/:userId/role", requireAdmin, async (req, res) => {
    const userId = textParam(req.params.userId);
    const role = req.body?.role;
    if (!userId || !["farmer", "admin"].includes(role)) {
      res.status(400).json({ message: "Invalid user ID or role." });
      return;
    }
    if (userId === (res.locals.authUser as AuthUser).id && role !== "admin") {
      res.status(400).json({ message: "You cannot remove your own admin access." });
      return;
    }
    const { error } = await supabaseAdmin.from("user_profiles").update({ role }).eq("id", userId);
    if (error) {
      res.status(400).json({ message: error.message });
      return;
    }
    res.json({ success: true });
  });

  router.patch("/admin/farms/:farmId/assign", requireAdmin, async (req, res) => {
    const farmId = textParam(req.params.farmId);
    const userId = req.body?.userId ?? null;
    if (!farmId || (userId !== null && typeof userId !== "string")) {
      res.status(400).json({ message: "A valid farm and user ID are required." });
      return;
    }
    if (userId) {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (error || !data.user) {
        res.status(404).json({ message: "User not found." });
        return;
      }
    }
    const { error } = await supabaseAdmin.from("farms")
      .update({ user_id: userId }).eq("id", farmId);
    if (error) {
      res.status(400).json({ message: error.message });
      return;
    }
    res.json({ success: true });
  });

  router.post("/admin/farms", requireAdmin, async (req, res) => {
    const body = req.body ?? {};
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      res.status(400).json({ message: "Farm name required." });
      return;
    }
    const acres = Number(body.total_acres);
    const record = {
      id: crypto.randomUUID(),
      name,
      location: typeof body.location === "string" ? body.location.trim() : "",
      total_acres: Number.isFinite(acres) && acres >= 0 ? acres : 0,
      lease_status: typeof body.lease_status === "string" ? body.lease_status : "Owned",
      crop_type: typeof body.crop_type === "string" ? body.crop_type : "Potato",
      notes: typeof body.notes === "string" ? body.notes : null,
      user_id: typeof body.user_id === "string" && body.user_id ? body.user_id : null,
      created_at: new Date().toISOString(),
    };
    if (record.user_id) {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(record.user_id);
      if (error || !data.user) {
        res.status(404).json({ message: "Assigned user not found." });
        return;
      }
    }
    const { data, error } = await supabaseAdmin.from("farms").insert(record).select().single();
    if (error) {
      res.status(400).json({ message: error.message });
      return;
    }
    res.json({ farm: data });
  });

  router.post("/migrate", async (req, res) => {
    try {
      if (process.env.DISABLE_MIGRATE === "true") {
        res.status(403).json({ message: "Migration is disabled on this server." });
        return;
      }
      const user = await authenticate(req, res);
      if (!user) return;

      const payload = req.body ?? {};
      const collections: { name: string; rows: Record<string, any>[] }[] = [
        { name: "farms", rows: payload.farms ?? [] },
        { name: "seasons", rows: payload.seasons ?? [] },
        { name: "costs", rows: payload.costs ?? [] },
        { name: "inventory", rows: payload.inventory ?? [] },
        { name: "activity_logs", rows: payload.activityLogs ?? [] },
        { name: "observations", rows: payload.observations ?? [] },
        { name: "harvest_records", rows: payload.harvestRecords ?? [] },
        { name: "personal_expenses", rows: payload.personalExpenses ?? [] },
      ];
      for (const { name, rows } of collections) {
        if (!Array.isArray(rows) || rows.length > 5000 ||
            rows.some((row) => !row || typeof row !== "object" || typeof row.id !== "string" || !row.id)) {
          res.status(400).json({ message: `Invalid ${name} migration data.` });
          return;
        }
      }

      const farms = collections[0].rows;
      const importedFarmIds = new Set(farms.map((farm) => farm.id));
      const related = collections.slice(1);
      for (const { name, rows } of related) {
        if (rows.some((row) => typeof row.farm_id !== "string" || !row.farm_id)) {
          res.status(400).json({ message: `Every ${name} record must reference a farm.` });
          return;
        }
      }
      const farmIds = [...new Set([
        ...importedFarmIds,
        ...related.flatMap(({ rows }) => rows.map((row) => row.farm_id as string)),
      ])];
      const { data: existingFarms, error: farmLookupError } = farmIds.length
        ? await supabaseAdmin.from("farms").select("id,user_id").in("id", farmIds)
        : { data: [], error: null };
      if (farmLookupError) {
        res.status(500).json({ message: "Could not validate the imported farms." });
        return;
      }
      const existingById = new Map((existingFarms ?? []).map((farm) => [farm.id, farm.user_id]));
      const unownedIds = [...importedFarmIds].filter((id) => existingById.has(id) && !existingById.get(id));
      let memberOfUnowned = new Set<string>();
      if (unownedIds.length) {
        const { data, error } = await supabaseAdmin.from("farm_memberships")
          .select("farm_id").eq("user_id", user.id).in("farm_id", unownedIds);
        if (error) {
          res.status(500).json({ message: "Could not validate farm membership." });
          return;
        }
        memberOfUnowned = new Set((data ?? []).map((item) => item.farm_id));
      }
      const conflict = [...importedFarmIds].some((id) => {
        if (!existingById.has(id)) return false;
        const owner = existingById.get(id);
        return owner ? owner !== user.id : !memberOfUnowned.has(id);
      });
      if (conflict) {
        res.status(409).json({ message: "An imported farm is already assigned to another account." });
        return;
      }
      const allowedFarmIds = new Set([
        ...importedFarmIds,
        ...[...existingById.entries()].filter(([, owner]) => owner === user.id).map(([id]) => id),
      ]);
      if (related.some(({ rows }) => rows.some((row) => !allowedFarmIds.has(row.farm_id)))) {
        res.status(403).json({ message: "Migration contains records for a farm not assigned to this account." });
        return;
      }

      for (const { name, rows } of related) {
        for (let i = 0; i < rows.length; i += 500) {
          const ids = rows.slice(i, i + 500).map((row) => row.id);
          if (!ids.length) continue;
          const { data, error } = await supabaseAdmin.from(name).select("id,farm_id").in("id", ids);
          if (error) {
            res.status(500).json({ message: `Could not validate ${name} records.` });
            return;
          }
          if ((data ?? []).some((row) => !allowedFarmIds.has(row.farm_id))) {
            res.status(403).json({ message: `${name}: a record ID already belongs to another farm.` });
            return;
          }
        }
      }

      collections[0].rows = farms.map((farm) => ({ ...farm, user_id: user.id }));
      const recorderTables = new Set(["activity_logs", "observations", "harvest_records"]);
      for (const collection of collections) {
        if (recorderTables.has(collection.name)) {
          collection.rows = collection.rows.map((row) => ({
            ...row,
            recorded_by: user.id,
            recorded_by_email: user.email ?? null,
          }));
        }
      }
      for (const { name, rows } of collections) {
        if (!rows.length) continue;
        const { error } = await supabaseAdmin.from(name).upsert(rows, { onConflict: "id" });
        if (error) {
          res.status(400).json({ message: `${name}: ${error.message}` });
          return;
        }
      }
      res.json({ success: true });
    } catch (error) {
      console.error("[migration] request failed:", error);
      res.status(500).json({ message: "Migration failed." });
    }
  });
}
