// Pure helpers for importing a Farm Diary JSON backup into the active farm + season.
// No React Native / Supabase imports so this can be unit-tested with `npm test`.

export type BackupKind = "costs" | "activityLogs" | "inventory" | "harvest" | "observations";

export interface ImportContext {
  farmId: string;
  seasonId: string;
  /** IDs of the blocks that exist in the season being imported into. */
  blockIds: string[];
  /** Records already in the target season, used to skip duplicates. */
  existing: Partial<Record<BackupKind, Record<string, unknown>[]>>;
}

export interface SkipCounts {
  duplicate: number;
  invalid: number;
  unknownBlock: number;
}

export interface KindResult {
  records: Record<string, unknown>[];
  skipped: SkipCounts;
  /** Records kept, but whose block was not found here and so were saved as whole-farm. */
  blockCleared: number;
}

export type PreparedImport = Record<BackupKind, KindResult> & { total: number };

export const MAX_ROWS_PER_COLLECTION = 5000;

const BACKUP_KEYS: Record<BackupKind, string> = {
  costs: "costs",
  activityLogs: "activity_logs",
  inventory: "inventory",
  harvest: "harvest_records",
  observations: "observations",
};

// Fields that must never be taken from a file: identity, scope, authorship and links to other records.
// activity_log_id points at the OLD activity's id; imported activities get new ids, so a kept link would point at nothing.
const STRIPPED_FIELDS = ["id", "created_at", "farm_id", "season_id", "recorded_by", "recorded_by_email", "activity_log_id"];

const isText = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const isMoney = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();
const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));

/** Returns a reason string when the record is unusable, otherwise null. */
function validate(kind: BackupKind, r: Record<string, unknown>): string | null {
  switch (kind) {
    case "costs":
      if (!isText(r.description) || !isText(r.cost_date)) return "missing description or date";
      if (!isMoney(r.amount_kes)) return "amount is not a valid number";
      return null;
    case "inventory":
      if (!isText(r.product_name) || !isText(r.purchase_date)) return "missing product or date";
      if (!isMoney(r.quantity_purchased) || !isMoney(r.unit_price_kes)) return "quantity or price is not a valid number";
      return null;
    case "activityLogs":
      if (!isText(r.activity_name) || !isText(r.actual_date)) return "missing activity name or date";
      if (r.total_cost_kes != null && !isMoney(r.total_cost_kes)) return "cost is not a valid number";
      return null;
    case "harvest":
      if (!isText(r.harvest_date)) return "missing date";
      if (!isMoney(r.bags) || !isMoney(r.total_revenue_kes)) return "quantity or revenue is not a valid number";
      return null;
    case "observations":
      if (!isText(r.description) || !isText(r.observation_date)) return "missing description or date";
      return null;
  }
}

/** Same real-world record => same fingerprint, regardless of id or created_at. */
export function fingerprint(kind: BackupKind, r: Record<string, unknown>): string {
  switch (kind) {
    case "costs":
      return ["c", norm(r.cost_date), norm(r.cost_category), norm(r.description), num(r.amount_kes), norm(r.section_id)].join("|");
    case "inventory":
      return ["i", norm(r.purchase_date), norm(r.product_name), num(r.quantity_purchased), num(r.unit_price_kes)].join("|");
    case "activityLogs":
      return ["a", norm(r.actual_date), norm(r.activity_name), norm(r.section_id), num(r.total_cost_kes)].join("|");
    case "harvest":
      return ["h", norm(r.harvest_date), norm(r.section_id), num(r.bags), norm(r.unit), num(r.total_revenue_kes)].join("|");
    case "observations":
      return ["o", norm(r.observation_date), norm(r.observation_type), norm(r.description), norm(r.section_id)].join("|");
  }
}

function emptyResult(): KindResult {
  return { records: [], skipped: { duplicate: 0, invalid: 0, unknownBlock: 0 }, blockCleared: 0 };
}

/** Harvest records require a block in the database, so they cannot be saved without one. */
const BLOCK_REQUIRED: Record<BackupKind, boolean> = {
  costs: false,
  activityLogs: false,
  inventory: false,
  harvest: true,
  observations: false,
};

/**
 * Older backups held every crop cycle's records in one file with no way to tell which cycle was meant to
 * receive them. Importing those into one cycle would pile several cycles' costs and harvests together,
 * so they are refused. Backups made by the current app carry format_version 2 and hold a single cycle.
 */
export function backupBlocker(data: Record<string, unknown>): string | null {
  if (typeof data.format_version === "number" && data.format_version >= 2) return null;
  const cycles = new Set<string>();
  for (const key of Object.values(BACKUP_KEYS)) {
    const rows = data[key];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const id = row && typeof row === "object" ? (row as Record<string, unknown>).season_id : null;
      if (typeof id === "string" && id) cycles.add(id);
    }
  }
  if (cycles.size > 1) {
    return `This older backup mixes records from ${cycles.size} crop cycles, so it cannot be imported into one cycle without mixing them together. Export a fresh backup from the updated app (one cycle per file) and import that instead.`;
  }
  return null;
}

export function looksLikeBackup(data: unknown): data is Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const d = data as Record<string, unknown>;
  return Object.values(BACKUP_KEYS).some((key) => Array.isArray(d[key]));
}

export function prepareBackupImport(data: Record<string, unknown>, ctx: ImportContext): PreparedImport {
  const blockIds = new Set(ctx.blockIds);
  const out = {} as PreparedImport;
  let total = 0;

  for (const kind of Object.keys(BACKUP_KEYS) as BackupKind[]) {
    const result = emptyResult();
    const raw = data[BACKUP_KEYS[kind]];
    const rows: unknown[] = Array.isArray(raw) ? raw.slice(0, MAX_ROWS_PER_COLLECTION) : [];
    // Count matches rather than just noting them: two genuine identical entries in the file
    // (e.g. two equal wage payments on one day) are both kept unless that many are already saved.
    const already = new Map<string, number>();
    for (const r of ctx.existing[kind] ?? []) {
      const k = fingerprint(kind, r);
      already.set(k, (already.get(k) ?? 0) + 1);
    }

    for (const row of rows) {
      if (!row || typeof row !== "object" || Array.isArray(row)) { result.skipped.invalid++; continue; }
      const source = row as Record<string, unknown>;
      if (validate(kind, source) !== null) { result.skipped.invalid++; continue; }

      const record: Record<string, unknown> = { ...source };
      for (const field of STRIPPED_FIELDS) delete record[field];

      // Keep the block only when it exists in this season; never invent one.
      const blockId = isText(source.section_id) ? source.section_id : null;
      if (blockId && !blockIds.has(blockId)) {
        if (BLOCK_REQUIRED[kind]) { result.skipped.unknownBlock++; continue; }
        record.section_id = null;
        result.blockCleared++;
      } else if (BLOCK_REQUIRED[kind] && !blockId) {
        result.skipped.unknownBlock++;
        continue;
      }

      const key = fingerprint(kind, record);
      const remaining = already.get(key) ?? 0;
      if (remaining > 0) { already.set(key, remaining - 1); result.skipped.duplicate++; continue; }

      record.farm_id = ctx.farmId;
      record.season_id = ctx.seasonId;
      result.records.push(record);
    }
    total += result.records.length;
    out[kind] = result;
  }
  out.total = total;
  return out;
}

export function sumSkipped(prepared: PreparedImport): SkipCounts {
  const kinds: BackupKind[] = ["costs", "activityLogs", "inventory", "harvest", "observations"];
  return kinds.reduce<SkipCounts>(
    (acc, k) => ({
      duplicate: acc.duplicate + prepared[k].skipped.duplicate,
      invalid: acc.invalid + prepared[k].skipped.invalid,
      unknownBlock: acc.unknownBlock + prepared[k].skipped.unknownBlock,
    }),
    { duplicate: 0, invalid: 0, unknownBlock: 0 },
  );
}
