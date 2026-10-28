export function formatWriteError(
  error: unknown,
  fallback: string,
  closedSeasonMessage: string,
): string {
  const value = error as {
    message?: unknown;
    name?: unknown;
    status?: unknown;
    cause?: { code?: unknown };
  } | null;
  const message = typeof value?.message === "string" ? value.message.trim() : "";

  if (message === closedSeasonMessage) return closedSeasonMessage;

  const searchable = `${String(value?.name ?? "")} ${message} ${String(value?.cause?.code ?? "")}`.toLowerCase();
  const isNetworkFailure =
    value?.status === 0 ||
    searchable.includes("network") ||
    searchable.includes("failed to fetch") ||
    searchable.includes("fetch failed") ||
    searchable.includes("request failed") ||
    searchable.includes("connection timed out");

  if (isNetworkFailure) {
    return `${fallback}\n\nCheck your connection and try again. Your entries are still on this screen.`;
  }

  return message && message !== fallback ? `${fallback}\n\nDetails: ${message}` : fallback;
}
