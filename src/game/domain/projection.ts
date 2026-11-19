import type { InventoryView, QuestPresentation, UserId } from "./contracts.ts";

export interface GameProjection {
  readonly ownerId: UserId;
  readonly source: "fixture" | "provided-state";
  readonly status: "ready" | "degraded";
  readonly issues: readonly string[];
  readonly progress: Readonly<{
    level: number | null;
    currentXp: number | null;
    walletGp: number | null;
    vaultRemainingGp: number | null;
  }>;
  readonly skills: readonly Readonly<{
    domain: string; label: string; level: number | null; totalXp: number | null;
  }>[];
  readonly quests: readonly QuestPresentation[];
  readonly inventory: InventoryView;
}

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : null;
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

/** Read-only adapter for an already obtained snapshot. Does not fetch, bootstrap or authenticate.
 * ownerId must be attached by a trusted host, never inferred from snapshot data.
 * Fixture provenance is retained; it must never be represented as a real account.
 */
export function projectRpgReadModel(
  input: Readonly<{ ownerId: UserId; source: GameProjection["source"]; state: unknown }>,
  expectedOwnerId: UserId,
): Readonly<{ ok: true; projection: GameProjection } | { ok: false; reason: "owner-mismatch" }> {
  if (!text(expectedOwnerId) || input.ownerId !== expectedOwnerId) return { ok: false, reason: "owner-mismatch" };
  const issues: string[] = [];
  const state = record(input.state) ?? {};
  if (!record(input.state)) issues.push("state:missing-or-invalid");
  function number(value: unknown, field: string, minimum?: number): number | null {
    if (typeof value === "number" && Number.isFinite(value) && (minimum === undefined || value >= minimum)) return value;
    issues.push(`${field}:missing-or-invalid`);
    return null;
  }
  function rows(field: string): RecordValue[] {
    const value = state[field];
    if (!Array.isArray(value)) { issues.push(`${field}:missing-or-invalid`); return []; }
    return value.flatMap((entry, index) => {
      const row = record(entry);
      if (!row) { issues.push(`${field}[${index}]:invalid`); return []; }
      return [row];
    });
  }
  const progress = {
    level: number(state.player_level, "player_level", 1),
    currentXp: number(state.current_xp, "current_xp", 0),
    walletGp: number(state.wallet_gp, "wallet_gp"), // Negative debt is meaningful; never clamp it.
    vaultRemainingGp: number(state.vault_remaining_gp, "vault_remaining_gp"),
  };
  const seenSkills = new Set<string>();
  const skills = rows("skill_summaries").flatMap(row => {
    if (!text(row.domain) || !text(row.label) || seenSkills.has(row.domain)) {
      issues.push("skill_summaries:invalid-or-duplicate-identity"); return [];
    }
    seenSkills.add(row.domain);
    return [{ domain: row.domain, label: row.label, level: number(row.level, `skill:${row.domain}:level`, 1), totalXp: number(row.total_xp, `skill:${row.domain}:total_xp`, 0) }];
  });
  const seenQuests = new Set<string>();
  const quests: QuestPresentation[] = rows("quests").flatMap(row => {
    const id = text(row.id) ? row.id : text(row.code) ? row.code : null;
    if (!id || !text(row.title) || seenQuests.has(id)) {
      issues.push("quests:invalid-or-duplicate-identity"); return [];
    }
    seenQuests.add(id);
    const status = row.status === "available" || row.status === "active" || row.status === "completed" || row.status === "unavailable" ? row.status : "unavailable";
    if (status === "unavailable" && row.status !== "unavailable") issues.push(`quest:${id}:unknown-status`);
    return [{ sourceQuestId: id, label: row.title, objective: row.title, status,
      progressLabel: status === "completed" ? "Completada" : status === "active" ? "En curso" : status === "available" ? "Opcional" : "Estado no disponible",
      openExistingQuestActionId: `existing-quest:${id}` }];
  });
  const entries: InventoryView["groups"][number]["entries"][number][] = [];
  for (const [field, labelField, kind] of [
    ["reading_books", "title", "book"],
    ["work_projects", "name", "project"],
    ["knitting_projects", "name", "skill-resource"],
  ] as const) {
    const seen = new Set<string>();
    for (const row of rows(field)) {
      if (!text(row.id) || !text(row[labelField]) || seen.has(row.id)) {
        issues.push(`${field}:invalid-or-duplicate-identity`); continue;
      }
      seen.add(row.id);
      entries.push({ viewId: `${field}:${row.id}`, source: { kind, id: row.id }, label: row[labelField] as string });
    }
  }
  const projection: GameProjection = {
    ownerId: input.ownerId, source: input.source,
    status: issues.length ? "degraded" : "ready", issues,
    progress, skills, quests,
    inventory: { ownerId: input.ownerId, groups: [{ kind: "activity-resources", entries }] },
  };
  // All exposed nodes are newly allocated, frozen and detached from the supplied state.
  function freeze(value: object): void {
    Object.values(value).forEach(child => { if (child && typeof child === "object") freeze(child); });
    Object.freeze(value);
  }
  freeze(projection);
  return { ok: true, projection };
}
