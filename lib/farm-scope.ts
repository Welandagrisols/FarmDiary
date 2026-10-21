export function recordsForFarm<T extends { farm_id?: string | null }>(
  records: readonly T[],
  farmId: string | null | undefined,
): T[] {
  if (!farmId) return [];
  return records.filter((record) => record.farm_id === farmId);
}
