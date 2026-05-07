import { supabase } from "./supabase";
import Constants from "expo-constants";

function getApiBase(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;
  const domain = extra.apiDomain || "";
  if (!domain) return "";
  return `https://${domain}`;
}

async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? "";
}

async function adminRequest(path: string, method: string, body?: object): Promise<any> {
  const base = getApiBase();
  if (!base) throw new Error("API domain not configured");
  const token = await getAuthToken();
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

export const adminApi = {
  createUser: (email: string, password: string) =>
    adminRequest("/api/admin/create-user", "POST", { email, password }),

  deleteUser: (userId: string) =>
    adminRequest(`/api/admin/users/${userId}`, "DELETE"),

  updateRole: (userId: string, role: "farmer" | "admin") =>
    adminRequest(`/api/admin/users/${userId}/role`, "PATCH", { role }),

  assignFarm: (farmId: string, userId: string | null) =>
    adminRequest(`/api/admin/farms/${farmId}/assign`, "PATCH", { userId }),

  createFarm: (farm: {
    name: string;
    location: string;
    total_acres: string;
    lease_status: string;
    crop_type: string;
    notes: string;
    user_id: string | null;
  }) => adminRequest("/api/admin/farms", "POST", farm),
};
