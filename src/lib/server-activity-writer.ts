import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "./supabase.ts";
import type { SkillDomain } from "../types/rpg.ts";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MAX_ACTIVITY_REQUESTED_GP = 25000;
export const MAX_ACTIVITY_EARNED_XP = 500;
export const MAX_ACTIVITY_DURATION_MINUTES = 1440;

export function hasClientIdentityOverride(
  body: Record<string, unknown>,
  verifiedUserId: string
): boolean {
  for (const key of ["user_id", "userId", "owner_id", "ownerId"]) {
    const val = body[key];
    if (
      val !== undefined &&
      val !== null &&
      String(val).trim().toLowerCase() !== verifiedUserId.trim().toLowerCase()
    ) {
      return true;
    }
  }
  return false;
}

export function validateActivityRewardBounds(params: {
  requestedGp: number;
  earnedXp: number;
  durationMinutes?: number;
}): { ok: true } | { ok: false; error: string } {
  const { requestedGp, earnedXp, durationMinutes = 0 } = params;
  if (
    typeof requestedGp !== "number" ||
    !Number.isSafeInteger(requestedGp) ||
    requestedGp < 0 ||
    requestedGp > MAX_ACTIVITY_REQUESTED_GP
  ) {
    return { ok: false, error: "Recompensa GP fuera de rango permitido" };
  }
  if (
    typeof earnedXp !== "number" ||
    !Number.isSafeInteger(earnedXp) ||
    earnedXp < 0 ||
    earnedXp > MAX_ACTIVITY_EARNED_XP
  ) {
    return { ok: false, error: "Recompensa XP fuera de rango permitido" };
  }
  if (
    typeof durationMinutes !== "number" ||
    !Number.isSafeInteger(durationMinutes) ||
    durationMinutes < 0 ||
    durationMinutes > MAX_ACTIVITY_DURATION_MINUTES
  ) {
    return { ok: false, error: "Duración de actividad fuera de rango permitido" };
  }
  return { ok: true };
}

export interface ServerActivityInsertInput {
  userId: string;
  treasuryId: string;
  treasuryUserId: string;
  domain: SkillDomain;
  activityName: string;
  durationMinutes?: number;
  requestedGp: number;
  earnedXp: number;
  sessionMetadata?: Record<string, unknown>;
  notes?: string | null;
  idempotencyKey: string;
  source?: string;
}

export type ServerActivityInsertResult =
  | { ok: true; duplicate: false; data: Record<string, unknown> }
  | { ok: true; duplicate: true; data: Record<string, unknown> | null }
  | { ok: false; status: 400 | 403 | 503; error: string };

/**
 * Escritor privilegiado exclusivamente del servidor para `public.activity_logs`.
 * - Fail-closed (503) si falta `SUPABASE_SERVICE_ROLE_KEY` o `supabaseAdmin`.
 * - Valida propiedad de la tesorería, identidad derivada del servidor y límites canónicos.
 * - Permite revocar `INSERT` de `authenticated` en `public.activity_logs` sin romper
 *   sesiones tradicionales ni `habit-log`.
 */
export async function insertServerActivityLog(
  input: ServerActivityInsertInput,
  adminOverride?: SupabaseClient | null
): Promise<ServerActivityInsertResult> {
  if (typeof window !== "undefined") {
    return { ok: false, status: 403, error: "Operación exclusiva del servidor" };
  }
  const hasServerKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  const writer = adminOverride ?? (hasServerKey ? supabaseAdmin : null);
  if (!writer) {
    return {
      ok: false,
      status: 503,
      error: "Escritura segura de actividades no disponible en el servidor",
    };
  }
  if (!UUID_REGEX.test(input.userId) || !UUID_REGEX.test(input.treasuryId)) {
    return { ok: false, status: 400, error: "Identificadores de sesión inválidos" };
  }
  if (input.treasuryUserId.trim().toLowerCase() !== input.userId.trim().toLowerCase()) {
    return { ok: false, status: 403, error: "La tesorería no pertenece al propietario" };
  }
  const bounds = validateActivityRewardBounds({
    requestedGp: input.requestedGp,
    earnedXp: input.earnedXp,
    durationMinutes: input.durationMinutes ?? 0,
  });
  if (!bounds.ok) {
    return { ok: false, status: 400, error: bounds.error };
  }

  const { data, error } = await writer
    .from("activity_logs")
    .insert({
      user_id: input.userId,
      treasury_id: input.treasuryId,
      domain: input.domain,
      activity_name: input.activityName,
      duration_minutes: input.durationMinutes ?? 0,
      requested_gp: input.requestedGp,
      earned_xp: input.earnedXp,
      session_metadata: input.sessionMetadata ?? {},
      notes: input.notes ?? null,
      idempotency_key: input.idempotencyKey,
      ...(input.source ? { source: input.source } : {}),
    })
    .select("*")
    .single();

  if (error) {
    const isDuplicate =
      error.code === "23505" ||
      error.message?.toLowerCase().includes("unique") ||
      error.message?.toLowerCase().includes("duplicate");
    if (isDuplicate) {
      const { data: existing } = await writer
        .from("activity_logs")
        .select("*")
        .eq("user_id", input.userId)
        .eq("idempotency_key", input.idempotencyKey)
        .maybeSingle();
      return { ok: true, duplicate: true, data: existing ?? null };
    }
    return {
      ok: false,
      status: 503,
      error: "No se pudo registrar la actividad en el servidor",
    };
  }

  return { ok: true, duplicate: false, data: (data ?? {}) as Record<string, unknown> };
}
