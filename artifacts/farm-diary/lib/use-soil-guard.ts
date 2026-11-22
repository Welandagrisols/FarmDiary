import { useEffect, useState } from "react";
import { listPlots, listSoilTests } from "./soil-storage";
import { buildSoilGuard, emptySoilGuard, type SoilGuard } from "./soil-guard";

export function useSoilGuard(farmId: string | null | undefined): SoilGuard {
  const [guard, setGuard] = useState<SoilGuard>(() => emptySoilGuard());
  useEffect(() => {
    let cancelled = false;
    setGuard(emptySoilGuard());
    if (!farmId) return () => { cancelled = true; };
    (async () => {
      try {
        const [tests, plots] = await Promise.all([listSoilTests(farmId), listPlots(farmId)]);
        if (cancelled) return;
        const names: Record<string, string> = {};
        for (const plot of plots) names[plot.id] = plot.name;
        setGuard(buildSoilGuard(tests, names));
      } catch {
        if (!cancelled) setGuard(emptySoilGuard());
      }
    })();
    return () => { cancelled = true; };
  }, [farmId]);
  return guard;
}
