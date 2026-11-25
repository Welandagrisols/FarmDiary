export interface QueueOwner {
  user_id?: string | null;
}

export function queueItemsForUser<T extends QueueOwner>(
  items: readonly T[],
  userId: string,
): T[] {
  return items.filter((item) => !item.user_id || item.user_id === userId);
}

export function assignUnownedQueueItems<T extends QueueOwner>(
  items: readonly T[],
  userId: string,
): T[] {
  return items.map((item) => item.user_id ? item : { ...item, user_id: userId });
}
