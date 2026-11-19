/** Explicit duration must not fall through `0 || 25` and produce a fabricated activity. */
export function isPositiveSessionDuration(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
