export async function savePendingRecords<T>(
  records: readonly T[],
  completedIndexes: Set<number>,
  save: (record: T, index: number) => Promise<unknown>,
): Promise<void> {
  for (let index = 0; index < records.length; index += 1) {
    if (completedIndexes.has(index)) continue;
    await save(records[index], index);
    completedIndexes.add(index);
  }
}
