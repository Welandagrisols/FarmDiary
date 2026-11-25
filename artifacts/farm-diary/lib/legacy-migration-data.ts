export interface LegacyFarmData {
  farms: Record<string, unknown>[];
  seasons: Record<string, unknown>[];
  costs: Record<string, unknown>[];
  inventory: Record<string, unknown>[];
  activityLogs: Record<string, unknown>[];
  observations: Record<string, unknown>[];
  harvestRecords: Record<string, unknown>[];
  personalExpenses: Record<string, unknown>[];
  activeFarmId: string | null;
  activeSeasonId: string | null;
}

export function emptyLegacyFarmData(): LegacyFarmData {
  return {
    farms: [],
    seasons: [],
    costs: [],
    inventory: [],
    activityLogs: [],
    observations: [],
    harvestRecords: [],
    personalExpenses: [],
    activeFarmId: null,
    activeSeasonId: null,
  };
}

function asRecord(value: unknown): Record<string, any> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, any>
    : null;
}

function asRows(value: unknown): Record<string, any>[] {
  return Array.isArray(value)
    ? value.filter((row): row is Record<string, any> => Boolean(row) && typeof row === "object" && !Array.isArray(row))
    : [];
}

function uniqueRows(
  earlier: Record<string, unknown>[],
  later: Record<string, unknown>[],
): Record<string, unknown>[] {
  const byId = new Map<string, Record<string, unknown>>();
  const withoutId: Record<string, unknown>[] = [];
  for (const row of [...earlier, ...later]) {
    const id = typeof row.id === "string" ? row.id : null;
    if (id) byId.set(id, row);
    else withoutId.push(row);
  }
  return [...byId.values(), ...withoutId];
}

export function legacyCacheToFarmData(value: unknown, userId: string): LegacyFarmData {
  const cache = asRecord(value);
  if (!cache) return emptyLegacyFarmData();

  const cachedFarm = asRecord(cache.farm);
  const allFarms = asRows(cache.allFarms);
  const sourceFarms = allFarms.length ? allFarms : cachedFarm ? [cachedFarm] : [];
  const farms = sourceFarms.filter((farm) =>
    typeof farm.id === "string" && (!farm.user_id || farm.user_id === userId),
  );
  const farmIds = new Set(farms.map((farm) => String(farm.id)));

  const scopedRows = (key: string) => asRows(cache[key]).filter((row) =>
    typeof row.farm_id === "string" && farmIds.has(row.farm_id),
  );
  const seasons = scopedRows("allSeasons");
  const activeSeason = asRecord(cache.active);
  const requestedFarmId = typeof cache.activeFarmId === "string"
    ? cache.activeFarmId
    : cachedFarm?.id;
  const activeFarmId = typeof requestedFarmId === "string" && farmIds.has(requestedFarmId)
    ? requestedFarmId
    : typeof farms[0]?.id === "string" ? farms[0].id : null;
  const requestedSeasonId = typeof cache.activeSeasonId === "string"
    ? cache.activeSeasonId
    : activeSeason?.id;
  const activeSeasonId = typeof requestedSeasonId === "string" &&
      seasons.some((season) => season.id === requestedSeasonId)
    ? requestedSeasonId
    : typeof seasons.find((season) => season.status !== "closed")?.id === "string"
      ? String(seasons.find((season) => season.status !== "closed")?.id)
      : null;

  return {
    farms,
    seasons,
    costs: scopedRows("c"),
    inventory: scopedRows("inv"),
    activityLogs: scopedRows("logs"),
    observations: scopedRows("obs"),
    harvestRecords: scopedRows("harvest"),
    personalExpenses: scopedRows("expenses"),
    activeFarmId,
    activeSeasonId,
  };
}

export function mergeLegacyFarmData(
  primary: LegacyFarmData,
  additional: LegacyFarmData,
): LegacyFarmData {
  return {
    farms: uniqueRows(primary.farms, additional.farms),
    seasons: uniqueRows(primary.seasons, additional.seasons),
    costs: uniqueRows(primary.costs, additional.costs),
    inventory: uniqueRows(primary.inventory, additional.inventory),
    activityLogs: uniqueRows(primary.activityLogs, additional.activityLogs),
    observations: uniqueRows(primary.observations, additional.observations),
    harvestRecords: uniqueRows(primary.harvestRecords, additional.harvestRecords),
    personalExpenses: uniqueRows(primary.personalExpenses, additional.personalExpenses),
    activeFarmId: primary.activeFarmId ?? additional.activeFarmId,
    activeSeasonId: primary.activeSeasonId ?? additional.activeSeasonId,
  };
}

export function hasLegacyFarmRecords(data: LegacyFarmData): boolean {
  return [
    data.farms,
    data.seasons,
    data.costs,
    data.inventory,
    data.activityLogs,
    data.observations,
    data.harvestRecords,
    data.personalExpenses,
  ].some((rows) => rows.length > 0);
}
