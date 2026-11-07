import crypto from "node:crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserStore, resolveShortcutRequestUser } from "./auth.ts";
import type { RPGEngineMemoryStore } from "./demo-store.ts";

export type ShortcutUserContext =
  | {
      ok: true;
      userId: string;
      mode: "supabase" | "local_engine";
      authMethod: "personal_token" | "session" | "legacy_secret";
      /** Store en memoria AISLADO del usuario autenticado (nunca compartido entre usuarios). */
      store: RPGEngineMemoryStore;
      /** Cliente Supabase (RLS con el JWT del usuario, o service role si entró con token personal). */
      db: SupabaseClient | null;
    }
  | { ok: false; response: NextResponse };

/**
 * Resuelve la identidad del llamador de un endpoint (/api/shortcuts/*, /api/gamemaster/*):
 * sesión del navegador (cookies) o token personal `rpg_usr_...`. El `user_id` SIEMPRE sale
 * de esa identidad verificada, jamás del cuerpo de la petición ni de variables de entorno
 * compartidas.
 */
export async function requireShortcutUser(
  req: Request
): Promise<ShortcutUserContext> {
  const auth = await resolveShortcutRequestUser(req);
  if (!auth.authorized) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      ),
    };
  }

  return {
    ok: true,
    userId: auth.userId,
    mode: auth.mode,
    authMethod: auth.authMethod,
    store: getUserStore(auth.userId),
    db: auth.mode === "supabase" ? auth.userClient ?? null : null,
  };
}

/**
 * Las llaves de idempotencia son UNIQUE globales en la base de datos. Se acotan al usuario
 * (hash SHA-256 de `userId + clave`) para que la clave de un usuario nunca colisione con la
 * de otro ni revele que existe.
 */
export function scopeIdempotencyKey(
  userId: string,
  key?: string | null
): string {
  const clean = (key || "").trim();
  if (!clean) return crypto.randomUUID();
  const digest = crypto
    .createHash("sha256")
    .update(`${userId}\u0000${clean}`, "utf8")
    .digest("hex");
  return `u${digest.slice(0, 48)}`;
}
