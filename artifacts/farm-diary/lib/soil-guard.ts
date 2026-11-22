import type { SoilResult, SoilTestRecord } from "./soil";

export type SoilFlag = "alkaline" | "acidic" | "highP" | "highCa" | "highNa" | "lowOC";

export interface SoilGuard {
  hasData: boolean;
  plots: Record<SoilFlag, string[]>;
  phPlots: number;
  testedPlots: number;
}

type TestLike = Pick<SoilTestRecord, "plot_id" | "status" | "results" | "sample_date" | "report_date" | "created_at"> & {
  received_date?: string | null;
};

const emptyPlots = (): Record<SoilFlag, string[]> => ({
  alkaline: [], acidic: [], highP: [], highCa: [], highNa: [], lowOC: [],
});

export const emptySoilGuard = (): SoilGuard => ({
  hasData: false, plots: emptyPlots(), phPlots: 0, testedPlots: 0,
});

const find = (results: readonly SoilResult[], key: string): SoilResult | undefined =>
  results.find((result) => result.key === key);

const isHigh = (result: SoilResult | undefined): boolean =>
  !!result && (result.rating === "high" || result.rating === "very_high"
    || !!result.rating_text && /\b(high|excess|excessive|surplus)\b/i.test(result.rating_text));

const isLow = (result: SoilResult | undefined): boolean =>
  !!result && (result.rating === "low" || result.rating === "very_low"
    || !!result.rating_text && /\b(low|deficient|poor)\b/i.test(result.rating_text));

function phClass(results: readonly SoilResult[]): "alkaline" | "acidic" | "other" | null {
  const result = find(results, "ph_water") ?? find(results, "ph_cacl2");
  if (!result) return null;
  const text = result.rating_text ?? "";
  if (/alkal/i.test(text)) return "alkaline";
  if (/acid/i.test(text)) return "acidic";
  if (result.value != null && Number.isFinite(result.value)) return result.value > 7 ? "alkaline" : "other";
  return null;
}

const dateOf = (test: TestLike): string =>
  test.sample_date || test.received_date || test.report_date || test.created_at || "";

export function latestUsableTestPerPlot<T extends TestLike>(tests: readonly T[]): T[] {
  const best = new Map<string, T>();
  for (const test of tests) {
    if (!test || !["confirmed", "manual"].includes(test.status) || !Array.isArray(test.results) || test.results.length === 0) continue;
    const key = test.plot_id ?? "__farm__";
    const current = best.get(key);
    if (!current || dateOf(test) > dateOf(current)) best.set(key, test);
  }
  return [...best.values()];
}

export function buildSoilGuard(tests: readonly TestLike[], plotNames: Record<string, string> = {}): SoilGuard {
  const usable = latestUsableTestPerPlot(tests);
  if (usable.length === 0) return emptySoilGuard();
  const plots = emptyPlots();
  let phPlots = 0;
  for (const test of usable) {
    const name = test.plot_id ? plotNames[test.plot_id] || "A plot" : "Whole farm";
    const ph = phClass(test.results);
    if (ph) phPlots += 1;
    if (ph === "alkaline") plots.alkaline.push(name);
    if (ph === "acidic") plots.acidic.push(name);
    if (isHigh(find(test.results, "phosphorus"))) plots.highP.push(name);
    if (isHigh(find(test.results, "calcium"))) plots.highCa.push(name);
    if (isHigh(find(test.results, "sodium"))) plots.highNa.push(name);
    if (isLow(find(test.results, "organic_carbon"))) plots.lowOC.push(name);
  }
  return { hasData: true, plots, phPlots, testedPlots: usable.length };
}

const list = (names: string[]): string => {
  const unique = [...new Set(names)];
  return unique.length > 3 ? `${unique.slice(0, 3).join(", ")} +${unique.length - 3} more` : unique.join(", ");
};

export function soilBannerLines(guard: SoilGuard): string[] {
  if (!guard.hasData) return [];
  const lines: string[] = [];
  if (guard.plots.alkaline.length) lines.push(`Alkaline soil (${list(guard.plots.alkaline)})`);
  if (guard.plots.acidic.length) lines.push(`Acidic soil (${list(guard.plots.acidic)})`);
  if (guard.plots.highP.length) lines.push(`High phosphorus (${list(guard.plots.highP)})`);
  if (guard.plots.highCa.length) lines.push(`High calcium (${list(guard.plots.highCa)})`);
  if (guard.plots.highNa.length) lines.push(`High sodium (${list(guard.plots.highNa)})`);
  if (guard.plots.lowOC.length) lines.push(`Low organic carbon (${list(guard.plots.lowOC)})`);
  return lines;
}

export function limeNotNeeded(guard: SoilGuard): boolean {
  return guard.hasData && guard.testedPlots > 0 && guard.phPlots === guard.testedPlots
    && guard.plots.alkaline.length === guard.testedPlots && guard.plots.acidic.length === 0;
}

export interface GuardableRow {
  subcategory: string;
  enabled: boolean;
  warning?: string | null;
}

const LIME_ROW = /lime/i;
const PHOSPHATE_ROW = /\b(dap|npsb?|npk|map|tsp)\b|phosph/i;

export function applySoilGuardToRows<T extends GuardableRow>(rows: readonly T[], guard: SoilGuard): T[] {
  if (!guard.hasData) return rows.map((row) => ({ ...row }));
  return rows.map((row) => {
    if (limeNotNeeded(guard) && LIME_ROW.test(row.subcategory)) {
      return {
        ...row,
        enabled: false,
        warning: `Left unticked: the lab rated the soil alkaline (${list(guard.plots.alkaline)}), so lime would push pH higher.`,
      };
    }
    if (guard.plots.highP.length && PHOSPHATE_ROW.test(row.subcategory)) {
      return {
        ...row,
        warning: `Lab rated phosphorus high (${list(guard.plots.highP)}). Check with your agronomist before adding more phosphorus.`,
      };
    }
    return { ...row };
  });
}

export function soilNoticesForProducts(guard: SoilGuard, productNames: readonly string[]): string[] {
  if (!guard.hasData) return [];
  const names = productNames.join(" | ");
  const lines: string[] = [];
  if (guard.plots.highP.length && PHOSPHATE_ROW.test(names)) {
    lines.push(`Phosphorus was rated high (${list(guard.plots.highP)}). Check this product is needed.`);
  }
  if (guard.plots.highCa.length && /calcium|carbosink/i.test(names)) {
    lines.push(`Calcium was rated high (${list(guard.plots.highCa)}). Avoid over-applying calcium products.`);
  }
  if (limeNotNeeded(guard) && /\blime\b|dolomite/i.test(names)) {
    lines.push(`Soil is alkaline (${list(guard.plots.alkaline)}). Lime would raise pH further.`);
  }
  return lines;
}
