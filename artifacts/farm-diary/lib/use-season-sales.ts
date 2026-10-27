import { useCallback, useEffect, useState } from "react";
import { FarmRole, getFarmRole, getSales, SaleRecord } from "./sales-storage";

/** Sales for one crop cycle plus the signed-in person's role on the farm. Reloads when the farm or cycle changes. */
export function useSeasonSales(farmId: string | null | undefined, seasonId: string | null | undefined) {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [role, setRole] = useState<FarmRole>("none");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [token, setToken] = useState(0);

  useEffect(() => {
    let current = true;
    if (!farmId || !seasonId) { setSales([]); setLoading(false); return; }
    setLoading(true);
    setError("");
    (async () => {
      try {
        const nextRole = await getFarmRole(farmId);
        const rows = await getSales(farmId, seasonId);
        if (!current) return;
        setRole(nextRole);
        setSales(rows);
      } catch (e: any) {
        if (!current) return;
        setSales([]);
        setError(e?.message || "Sales could not be loaded.");
      } finally {
        if (current) setLoading(false);
      }
    })();
    return () => { current = false; };
  }, [farmId, seasonId, token]);

  const reload = useCallback(() => setToken((t) => t + 1), []);
  const canViewFinancials = ["admin", "owner", "manager"].includes(role);
  return { sales, role, canViewFinancials, loading, error, reload };
}
