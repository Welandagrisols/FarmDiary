// A closed crop cycle is a finished record. Adding, changing or removing its costs, activities,
// observations or harvests would silently change totals that have already been reviewed.

export const CLOSED_SEASON_MESSAGE =
  "This crop cycle is closed. Reopen it in Season Control before adding or changing its records.";

export function isSeasonClosed(seasons: readonly { id: string; status: string }[], seasonId: string | null | undefined): boolean {
  if (!seasonId) return false;
  return seasons.find((s) => s.id === seasonId)?.status === "closed";
}

export function assertSeasonOpen(seasons: readonly { id: string; status: string }[], seasonId: string | null | undefined): void {
  if (isSeasonClosed(seasons, seasonId)) throw new Error(CLOSED_SEASON_MESSAGE);
}
