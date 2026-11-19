/** Match existing endpoint response shapes; HTTP 200 alone is not an acknowledgement. */
export function shortcutAcknowledgement(url: string, value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (data.success !== true || data.offline === true) return null;
  let id: unknown;
  if (url === "/api/shortcuts/skill-session") {
    const session = data.session_logged;
    id = session && typeof session === "object" ? (session as Record<string, unknown>).id : undefined;
  } else if (url === "/api/shortcuts/habit-log") id = data.activity_log_id;
  else if (url === "/api/shortcuts/quick-expense") id = data.transaction_id;
  return typeof id === "string" && id.trim() ? id : null;
}
