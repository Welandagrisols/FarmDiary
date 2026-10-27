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

export async function migrateViaServer(token: string, payload: {
  farms: any[];
  seasons: any[];
  costs: any[];
  inventory: any[];
  activityLogs: any[];
  observations: any[];
  harvestRecords: any[];
  personalExpenses: any[];
}): Promise<void> {
  const base = getApiBase();
  if (!base) throw new Error("API domain not configured");
  const res = await fetch(`${base}/api/migrate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Migration request failed");
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

export const farmTeamApi = {
  list: (farmId: string) =>
    adminRequest(`/api/farms/${encodeURIComponent(farmId)}/team`, "GET"),

  create: (farmId: string, email: string, password: string, role: "manager" | "seller" | "storekeeper") =>
    adminRequest(`/api/farms/${encodeURIComponent(farmId)}/team`, "POST", { email, password, role }),

  remove: (farmId: string, userId: string) =>
    adminRequest(`/api/farms/${encodeURIComponent(farmId)}/team/${encodeURIComponent(userId)}`, "DELETE"),
};

// ───────────────────────── soil reports ─────────────────────────

async function soilRequest(path: string, method: string, body?: object, timeoutMs = 130_000): Promise<any> {
  const base = getApiBase();
  if (!base) throw new Error("API domain not configured");
  const token = await getAuthToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* proxy error pages are not JSON */ }
    if (!res.ok) {
      if (res.status === 413) throw new Error("The file is too large to upload. Try a smaller photo or PDF.");
      throw new Error(data?.message || `Request failed (${res.status})`);
    }
    return data;
  } catch (err: any) {
    if (err?.name === "AbortError") throw new Error("This is taking too long. Check your connection and try again.");
    if (err instanceof TypeError) throw new Error("No internet connection. Reading a report needs a connection.");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export interface SoilUploadFile { name: string; media_type: string; data: string }
export interface SoilParseResponse {
  read_ok: boolean;
  retryable?: boolean;
  message?: string;
  saved: import("./soil").SoilTestRecord[];
}

export const soilApi = {
  /** Uploads the photo/PDF, reads it straight away and saves every sample found. */
  parseReport: (farmId: string, files: SoilUploadFile[], opts: { plotId?: string | null; samplingMethod?: string }): Promise<SoilParseResponse> =>
    soilRequest(`/api/farms/${encodeURIComponent(farmId)}/soil/parse`, "POST", {
      files,
      plot_id: opts.plotId ?? null,
      sampling_method: opts.samplingMethod ?? "unknown",
    }),

  reparse: (farmId: string, testId: string): Promise<SoilParseResponse> =>
    soilRequest(`/api/farms/${encodeURIComponent(farmId)}/soil/${encodeURIComponent(testId)}/reparse`, "POST", {}),

  reportUrl: async (farmId: string, path: string): Promise<string> => {
    const data = await soilRequest(`/api/farms/${encodeURIComponent(farmId)}/soil/report-url?path=${encodeURIComponent(path)}`, "GET", undefined, 30_000);
    return data.url as string;
  },

  remove: (farmId: string, testId: string) =>
    soilRequest(`/api/farms/${encodeURIComponent(farmId)}/soil/${encodeURIComponent(testId)}`, "DELETE", undefined, 30_000),
};
