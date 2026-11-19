import { RPGEngineMemoryStore } from "./demo-store.ts";
import { serializeStoreCollections } from "./persistence-sync.ts";
import type { SkillSessionRecord } from "../types/rpg.ts";

// Release gate: deliberately cannot be enabled by an environment variable yet.
// Native PostgreSQL concurrency, schema and legacy reconciliation gates remain open.
export const ATOMIC_SKILL_SESSION_ENABLED = false;
type Command = Parameters<RPGEngineMemoryStore["logSkillSession"]>[0];
type Activity = Parameters<RPGEngineMemoryStore["completeActivity"]>[0];
type Resource = { kind: "none" } | { kind: "book" | "knitting"; id: string; delta: number }
  | ({ kind: "rubik" } & Record<string, unknown>);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function requireUuid(value: string) {
  if (!uuid.test(value)) throw new Error("Explicit server-resolved UUID required");
}

export interface AtomicSessionPlan {
  p_owner_id: string;
  p_operation_key: string;
  p_session_id: string;
  p_treasury_id: string;
  p_request: Command;
  p_activity: { domain: Command["domain"]; title: string; duration_minutes: number; requested_gp: number; earned_xp: number; notes: string; metadata: SkillSessionRecord["metadata"] };
  p_resource: Resource;
  p_collections_state: ReturnType<typeof serializeStoreCollections>;
  p_expected_profile_updated_at: string;
}

/** Server staging API. Context must come from verified auth + an owned, revisioned
 * database snapshot; never construct context by spreading a request body. */
export function prepareAtomicSkillSession(context: {
  ownerId: string; treasuryId: string; profileUpdatedAt: string; store: RPGEngineMemoryStore;
}, input: Command): AtomicSessionPlan {
  if (typeof window !== "undefined") throw new Error("Server-only session adapter");
  requireUuid(context.ownerId);
  requireUuid(context.treasuryId);
  if (!Number.isFinite(Date.parse(context.profileUpdatedAt))) throw new Error("Profile revision required");
  const key = input.idempotency_key;
  if (!key || key !== key.trim() || key.length > 200) throw new Error("Stable operation key required");
  if (!Number.isSafeInteger(input.duration_minutes) || input.duration_minutes <= 0) throw new Error("Positive integer duration required");
  // Clone enumerable data, including Maps. Methods remain on the prototype.
  // No callbacks, references or reward effects escape back into the live store.
  const draft = Object.assign(Object.create(RPGEngineMemoryStore.prototype) as RPGEngineMemoryStore,
    structuredClone(context.store));
  draft.processedIdempotencyKeys.clear();
  const allowed = ["domain", "duration_minutes", "title", "notes", "idempotency_key", "cube_type", "cube_id", "cube_model", "solve_time_seconds", "penalty", "scramble", "solves_count", "algorithm_learned", "book_id", "pages_read", "quote_text", "quote_page", "quotes_list", "project_id", "rows_completed", "stitches_notes", "subject", "study_method", "deliverable", "impact_level", "work_mode", "agile_methodology", "agile_stage"];
  const command = structuredClone(Object.fromEntries(Object.entries(input).filter(([key, value]) => allowed.includes(key) && value !== undefined))) as Command;
  let resource: Resource = { kind: "none" };
  if (command.domain === "reading" || command.domain === "knitting") {
    const reading = command.domain === "reading";
    const id = reading ? command.book_id : command.project_id;
    const collection = reading ? draft.readingBooks : draft.knittingProjects;
    if (!id || !collection.some(item => item.id === id)) throw new Error("Explicit owned resource required");
    requireUuid(id);
    const delta = reading ? command.pages_read ?? 15 : command.rows_completed ?? 6;
    if (!Number.isSafeInteger(delta) || delta <= 0) throw new Error("Positive integer resource delta required");
    resource = { kind: reading ? "book" : "knitting", id, delta };
    if (reading) command.pages_read = delta; else command.rows_completed = delta;
  }
  let proposal: Activity | undefined;
  draft.completeActivity = function (activity: Activity) {
    proposal = structuredClone(activity);
    return RPGEngineMemoryStore.prototype.completeActivity.call(this, activity);
  };
  const result = draft.logSkillSession(command);
  if (!proposal) throw new Error("Missing base reward proposal");
  if (command.domain === "rubik" && command.solve_time_seconds) {
    const solve = draft.rubikSolves[0];
    if (!solve) throw new Error("Missing solve proposal");
    resource = { kind: "rubik", cube_type: solve.cube_type, cube_model: solve.cube_model,
      time_seconds: solve.time_seconds, penalty: solve.penalty, scramble: solve.scramble,
      is_pb: solve.is_pb, ao5_after: solve.ao5_after, ao12_after: solve.ao12_after,
      algorithm_practiced: solve.algorithm_practiced };
  }
  const plan: AtomicSessionPlan = {
    p_owner_id: context.ownerId, p_treasury_id: context.treasuryId,
    p_operation_key: key, p_session_id: result.session.id,
    // Only engine-supported fields belong to the fingerprint; owner is separate.
    p_request: command,
    p_activity: { domain: command.domain, title: result.session.title,
      duration_minutes: result.session.duration_minutes, requested_gp: proposal.requested_gp,
      earned_xp: proposal.earned_xp, notes: result.session.details, metadata: result.session.metadata },
    p_resource: resource, p_collections_state: serializeStoreCollections(draft, context.ownerId),
    p_expected_profile_updated_at: context.profileUpdatedAt,
  };
  return structuredClone(plan);
}

export interface AtomicSessionResponse {
  success: true;
  replayed: boolean;
  session_logged: SkillSessionRecord;
  reward_impact: ReturnType<RPGEngineMemoryStore["completeActivity"]>;
  treasury_snapshot: { wallet_gp: number; vault_remaining_gp: number; current_xp: number; player_level: number };
}
export interface AtomicSessionTransport {
  rpc(name: "record_skill_session_atomic_v1", args: AtomicSessionPlan): PromiseLike<{ data: unknown; error: unknown }>;
}

/** Staging transport only. No legacy fallback and no application-store mutation.
 * A timeout is ambiguous: caller must retain the same command/key for retry. */
export async function commitAtomicSkillSession(db: AtomicSessionTransport, plan: AtomicSessionPlan): Promise<AtomicSessionResponse> {
  if (typeof window !== "undefined") throw new Error("Server-only session adapter");
  const { data, error } = await db.rpc("record_skill_session_atomic_v1", structuredClone(plan));
  if (error) throw new Error("Atomic session pending; retry the same operation");
  const value = data as Partial<AtomicSessionResponse> | null;
  if (!value || value.success !== true || typeof value.replayed !== "boolean"
    || !value.session_logged || !uuid.test(value.session_logged.id)
    || (!value.replayed && value.session_logged.id !== plan.p_session_id)
    || value.session_logged.domain !== plan.p_request.domain
    || value.session_logged.duration_minutes !== plan.p_request.duration_minutes
    || !value.reward_impact || !value.treasury_snapshot
    || !Number.isSafeInteger(value.reward_impact.transferred_gp)
    || value.reward_impact.transferred_gp < 0
    || value.session_logged.gp_earned !== value.reward_impact.transferred_gp
    || !Number.isSafeInteger(value.session_logged.xp_earned) || value.session_logged.xp_earned < 0
    || typeof value.reward_impact.idempotent_replay !== "boolean"
    || value.reward_impact.idempotent_replay !== value.replayed
    || ![value.treasury_snapshot.wallet_gp, value.treasury_snapshot.vault_remaining_gp,
      value.treasury_snapshot.current_xp, value.treasury_snapshot.player_level]
      .every(v => typeof v === "number" && Number.isSafeInteger(v))) {
    throw new Error("Invalid atomic acknowledgement; retain the pending operation");
  }
  return structuredClone(value as AtomicSessionResponse);
}
