import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "node:http";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws } }
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
    const { userId } = req.params;
    await supabaseAdmin.from("user_profiles").delete().eq("id", userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) { res.status(400).json({ message: error.message }); return; }
    res.json({ success: true });
  });

  // ── Update user role ────────────────────────────────────────────────
  app.patch("/api/admin/users/:userId/role", requireAdmin, async (req: Request, res: Response) => {
    const { userId } = req.params;
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

  const httpServer = createServer(app);
  return httpServer;
}
