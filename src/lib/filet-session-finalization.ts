import type { SupabaseClient } from "@supabase/supabase-js";
import type { KnittingProject } from "../types/rpg.ts";
import { AtomicSessionConflict, commitAtomicSkillSession, prepareAtomicSkillSession } from "./atomic-skill-session.ts";
import { createStarterUserMemoryStore } from "./demo-store.ts";
import { applySkillSessionState } from "./skill-session-state.ts";
import { resolvePlayerTreasury, supabaseAdmin } from "./supabase.ts";

export async function finalizeFiletSession(
  db: SupabaseClient,
  ownerId: string,
  project: KnittingProject,
  input: {
    filet_session_id?: string;
    filet_pattern_version_id?: string;
    idempotency_key?: string;
    duration_minutes?: number;
    title?: string;
    notes?: string;
    stitches_notes?: string;
    rows_completed?: number;
  },
) {
  const version = project.linked_filet_pattern?.version_id;
  const { filet_session_id: sessionId, idempotency_key: operationId, duration_minutes: duration } = input;
  if (typeof sessionId !== "string" || !/^ses_[0-9]{1,16}_[a-z0-9]{1,6}$/.test(sessionId) ||
      typeof operationId !== "string" || !operationId || operationId !== operationId.trim() || operationId.length > 200 ||
      typeof duration !== "number" || !Number.isSafeInteger(duration) || duration < 1 ||
      input.rows_completed !== undefined ||
      [input.title, input.notes, input.stitches_notes].some(value => value !== undefined && typeof value !== "string")) {
    return { status: 400, body: { success: false, error: "Comando Filet inválido" } };
  }
  if (!version || input.filet_pattern_version_id !== version) {
    return { status: 409, body: { success: false, error: "Versión Filet incompatible" } };
  }
  try {
    if (!supabaseAdmin || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) throw new Error("Service role unavailable");
    const [profile, treasury] = await Promise.all([
      db.from("profiles").select("id,updated_at,collections_state").eq("id", ownerId).maybeSingle(),
      resolvePlayerTreasury(ownerId, db),
    ]);
    if (profile.error || profile.data?.id !== ownerId || !treasury || treasury.user_id !== ownerId) {
      throw new Error("Owned profile and treasury required");
    }
    const store = createStarterUserMemoryStore({ userId: ownerId });
    store.knittingProjects = [project];
    const cached = profile.data.collections_state?.skillSessionState;
    if (cached != null && !applySkillSessionState(store, cached, ownerId)) throw new Error("Invalid persisted sessions");
    const plan = prepareAtomicSkillSession(
      { ownerId, treasuryId: treasury.id, profileUpdatedAt: profile.data.updated_at, store },
      {
        domain: "knitting", project_id: project.id, duration_minutes: duration,
        idempotency_key: `ses_univ_${ownerId}_${sessionId}`,
        title: input.title, notes: input.notes, stitches_notes: input.stitches_notes,
      },
    );
    Object.assign(plan.p_request, { filet_session_id: sessionId, filet_pattern_version_id: version });
    plan.p_operation_key = operationId;
    plan.p_collections_state = { skillSessionState: plan.p_collections_state.skillSessionState };
    const receipt = await commitAtomicSkillSession(supabaseAdmin, plan);
    return { status: receipt.replayed ? 200 : 201, body: receipt };
  } catch (error) {
    if (error instanceof AtomicSessionConflict) {
      return { status: 409, body: { success: false, error: "La operación no coincide con la sesión confirmada" } };
    }
    return {
      status: 503,
      body: { success: false, code: "FILET_SESSION_PENDING", error: "Finalización Filet pendiente. Reintenta la misma operación." },
    };
  }
}
