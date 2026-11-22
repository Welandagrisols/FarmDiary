import { getTemplate } from "../constants/farmData";
import type { CropTemplate } from "../constants/farmData";
import { formatHarvestTotals, getCropMeta } from "../constants/cropTemplates";
import type { CropMeta } from "../constants/cropTemplates";
import { blockTemplateId, distinctTemplateIds, groupRecordsByTemplate, unionByKey } from "./block-crops";
import { getSeasonBlocks } from "./storage";
import type { CropBlock, SeasonRecord } from "./storage";

type SeasonLike = Pick<SeasonRecord, "template_id" | "section_a" | "section_b" | "blocks"> | null | undefined;

export function blockCropTemplate(
  season: SeasonLike,
  block: Pick<CropBlock, "template_id"> | null | undefined,
): CropTemplate {
  return getTemplate(blockTemplateId(season?.template_id, block));
}

export function blockCropMeta(
  season: SeasonLike,
  block: Pick<CropBlock, "template_id"> | null | undefined,
): CropMeta {
  return getCropMeta(blockTemplateId(season?.template_id, block));
}

export function seasonTemplateIds(season: SeasonLike): string[] {
  return distinctTemplateIds(season?.template_id, getSeasonBlocks(season as SeasonRecord | null));
}

export function seasonCropLabel(season: SeasonLike): string {
  const names: string[] = [];
  for (const id of seasonTemplateIds(season)) {
    const name = getTemplate(id).cropType;
    if (!names.includes(name)) names.push(name);
  }
  if (names.length === 0) return getTemplate(season?.template_id).cropType;
  return names.length > 3 ? `${names.slice(0, 3).join(" + ")} +${names.length - 3}` : names.join(" + ");
}

export function getSeasonCropMeta(season: SeasonLike): CropMeta {
  const base = getCropMeta(season?.template_id);
  const ids = seasonTemplateIds(season);
  if (ids.length <= 1) return ids[0] ? getCropMeta(ids[0]) : base;
  return { ...base, harvestUnits: unionByKey(ids.map((id) => getCropMeta(id).harvestUnits)) };
}

export function formatSeasonHarvestSummary(
  season: SeasonLike,
  records: readonly { bags: number; unit?: string | null; section_id?: string | null }[],
): string {
  const ids = seasonTemplateIds(season);
  if (ids.length <= 1) {
    return formatHarvestTotals(records as { bags: number; unit?: string | null }[], getSeasonCropMeta(season));
  }
  const groups = groupRecordsByTemplate(records, season?.template_id, getSeasonBlocks(season as SeasonRecord | null));
  return [...groups].map(([id, list]) =>
    `${getTemplate(id).cropType}: ${formatHarvestTotals(list, getCropMeta(id))}`,
  ).join(" · ") || "0";
}
