export interface BlockCropLike {
  id?: string;
  template_id?: string | null;
}

export function blockTemplateId(
  seasonTemplateId: string | null | undefined,
  block: BlockCropLike | null | undefined,
): string {
  return block?.template_id || seasonTemplateId || "";
}

export function distinctTemplateIds(
  seasonTemplateId: string | null | undefined,
  blocks: readonly BlockCropLike[],
): string[] {
  const ids: string[] = [];
  for (const block of blocks) {
    const id = blockTemplateId(seasonTemplateId, block);
    if (id && !ids.includes(id)) ids.push(id);
  }
  if (ids.length === 0 && seasonTemplateId) ids.push(seasonTemplateId);
  return ids;
}

export const isMixedSeason = (
  seasonTemplateId: string | null | undefined,
  blocks: readonly BlockCropLike[],
): boolean => distinctTemplateIds(seasonTemplateId, blocks).length > 1;

export function groupRecordsByTemplate<R extends { section_id?: string | null }>(
  records: readonly R[],
  seasonTemplateId: string | null | undefined,
  blocks: readonly BlockCropLike[],
): Map<string, R[]> {
  const byBlock = new Map<string, BlockCropLike>();
  for (const block of blocks) if (block.id) byBlock.set(block.id, block);
  const groups = new Map<string, R[]>();
  for (const record of records) {
    const block = record.section_id ? byBlock.get(record.section_id) : undefined;
    const id = blockTemplateId(seasonTemplateId, block);
    const list = groups.get(id);
    if (list) list.push(record);
    else groups.set(id, [record]);
  }
  return groups;
}

export function unionByKey<T extends { key: string }>(lists: readonly (readonly T[])[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const list of lists) {
    for (const item of list) {
      if (seen.has(item.key)) continue;
      seen.add(item.key);
      out.push(item);
    }
  }
  return out;
}
