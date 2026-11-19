export const OFFLINE_OWNER_HEADER = "X-RPG-Offline-Owner";

export function isOfflineOwner(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value && value !== "anonymous";
}

/** An assertion about a pending command, never a replacement for authenticated identity. */
export function offlineOwnerMatches(headers: Headers, authenticatedUserId: string): boolean {
  const owner = headers.get(OFFLINE_OWNER_HEADER);
  return owner === null || (isOfflineOwner(owner) && owner === authenticatedUserId);
}
