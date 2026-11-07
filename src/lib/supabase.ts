import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
export const supabaseAnonKey = (
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
).trim();
const supabaseServiceKey = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  ""
).trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes("tu-proyecto.supabase.co") &&
    !supabaseAnonKey.startsWith("tu-")
);

export const supabaseAnon = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

export const supabaseAdmin =
  isSupabaseConfigured &&
  supabaseServiceKey &&
  !supabaseServiceKey.startsWith("tu-")
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

/**
 * Crea un cliente Supabase autenticado con el JWT del usuario para que
 * PostgreSQL Row Level Security (RLS: auth.uid() = user_id) se aplique en cada consulta.
 */
export function createSupabaseUserClient(
  accessToken: string
): SupabaseClient | null {
  if (!isSupabaseConfigured || !accessToken) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

/**
 * Resuelve únicamente el DEFAULT_PLAYER_USER_ID explícito para compatibilidad
 * legacy de iOS Shortcuts de un solo propietario. Nunca consulta player_treasury
 * globalmente para evitar fugas de datos entre usuarios.
 */
export async function resolvePlayerUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const envUserId = (process.env.DEFAULT_PLAYER_USER_ID || "").trim();
  if (
    envUserId &&
    envUserId !== "00000000-0000-0000-0000-000000000000" &&
    !envUserId.startsWith("tu-")
  ) {
    return envUserId;
  }
  return null;
}

export async function resolvePlayerTreasury(
  userId: string,
  clientOverride?: SupabaseClient | null
) {
  const db = clientOverride || supabaseAdmin;
  if (!isSupabaseConfigured || !db || !userId) return null;

  const currentBillingPeriod = new Date().toISOString().slice(0, 7);

  const { data: currentTreasury, error: currentErr } = await db
    .from("player_treasury")
    .select("*")
    .eq("user_id", userId)
    .eq("billing_period", currentBillingPeriod)
    .maybeSingle();

  if (currentErr) {
    throw new Error(currentErr.message);
  }

  if (currentTreasury) {
    return currentTreasury;
  }

  const { data: latestTreasury, error: latestErr } = await db
    .from("player_treasury")
    .select("*")
    .eq("user_id", userId)
    .order("billing_period", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestErr) {
    throw new Error(latestErr.message);
  }

  return latestTreasury || null;
}

export function verifyShortcutApiKey(req: Request): boolean {
  const configuredSecret = (process.env.SHORTCUTS_API_SECRET || "").trim();
  if (!configuredSecret) return true;

  const headerKey =
    req.headers.get("x-api-key") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (headerKey) {
    return headerKey === configuredSecret;
  }

  // Permitir peticiones interactivas desde el propio Dashboard Web (same-origin)
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite === "same-origin") {
    return true;
  }

  try {
    const reqOrigin = new URL(req.url).origin;
    const originHeader = req.headers.get("origin");
    const refererHeader = req.headers.get("referer");
    if (
      (originHeader && originHeader === reqOrigin) ||
      (refererHeader && refererHeader.startsWith(reqOrigin))
    ) {
      return true;
    }
  } catch {
    // Ignore URL parse error
  }

  // En modo local (con placeholders de Supabase) permitir pruebas locales sin cabecera
  if (!isSupabaseConfigured) {
    return true;
  }

  return false;
}

