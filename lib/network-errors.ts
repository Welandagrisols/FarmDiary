export function isNetworkError(error: unknown): boolean {
  const err = error as { message?: unknown; name?: unknown; status?: unknown; cause?: { code?: unknown } };
  const message = `${String(err?.name ?? "")} ${String(err?.message ?? error ?? "")}`.toLowerCase();
  const code = String(err?.cause?.code ?? "").toLowerCase();
  return err?.status === 0 ||
    code.includes("network") ||
    message.includes("network") ||
    message.includes("failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("request failed") ||
    message.includes("connection timed out");
}
