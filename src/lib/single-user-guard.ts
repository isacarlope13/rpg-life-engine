const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SingleUserEnv {
  NODE_ENV?: string;
  OAKHAVEN_OWNER_USER_ID?: string;
  OAKHAVEN_PUBLIC_SIGNUP_ENABLED?: string;
  OAKHAVEN_FAIL_CLOSED?: string;
  [key: string]: string | undefined;
}

export interface SingleUserAccessConfig {
  privateMode: boolean;
  failClosed: boolean;
  ownerConfigInvalid: boolean;
  ownerUserId: string | null;
  publicSignupEnabled: boolean;
}

/**
 * Resuelve la configuración de Modo Privado de Propietario Único (Release 3.3 — Fail-Closed).
 * - En producción (NODE_ENV === "production") o cuando OAKHAVEN_FAIL_CLOSED === "true":
 *   1. El registro público está CERRADO por defecto (nunca existe ventana abierta sin configuración).
 *   2. Si OAKHAVEN_OWNER_USER_ID falta, está vacío o no es un UUID válido -> FAIL-CLOSED:
 *      ninguna identidad de Supabase puede autenticarse ni acceder a APIs privadas.
 * - Si OAKHAVEN_OWNER_USER_ID contiene un string no vacío inválido en cualquier entorno -> FAIL-CLOSED.
 * - Nunca expone el UUID ni correos en respuestas públicas.
 */
export function getSingleUserAccessConfig(
  env: SingleUserEnv = process.env
): SingleUserAccessConfig {
  const isProd = env.NODE_ENV === "production";
  const rawOwner = (env.OAKHAVEN_OWNER_USER_ID || "").trim();
  const hasValidOwnerUuid = UUID_REGEX.test(rawOwner);
  const ownerUserId = hasValidOwnerUuid ? rawOwner.toLowerCase() : null;

  const failClosed = isProd || env.OAKHAVEN_FAIL_CLOSED === "true" || rawOwner.length > 0;
  const ownerConfigInvalid =
    (failClosed && !hasValidOwnerUuid) || (rawOwner.length > 0 && !hasValidOwnerUuid);
  const privateMode = failClosed || ownerUserId !== null;

  const rawSignupFlag = (env.OAKHAVEN_PUBLIC_SIGNUP_ENABLED || "").trim().toLowerCase();
  let publicSignupEnabled = false;
  if (!isProd && !failClosed && rawSignupFlag !== "false") {
    publicSignupEnabled = true;
  } else if (!isProd && !ownerConfigInvalid && rawSignupFlag === "true") {
    publicSignupEnabled = true;
  }

  return {
    privateMode,
    failClosed,
    ownerConfigInvalid,
    ownerUserId,
    publicSignupEnabled,
  };
}

export function isPublicSignupAllowed(env: SingleUserEnv = process.env): boolean {
  return getSingleUserAccessConfig(env).publicSignupEnabled;
}

/**
 * Valida que el UUID de Supabase pertenezca estrictamente al propietario autorizado.
 * Comportamiento FAIL-CLOSED: si falta o es inválido en modo producción/privado, devuelve false.
 */
export function isAuthorizedSupabaseUserId(
  userId: string | null | undefined,
  env: SingleUserEnv = process.env
): boolean {
  const cfg = getSingleUserAccessConfig(env);
  if (cfg.ownerConfigInvalid) {
    return false;
  }
  if (!cfg.failClosed) {
    return true;
  }
  if (!cfg.ownerUserId || !userId || typeof userId !== "string") {
    return false;
  }
  return userId.trim().toLowerCase() === cfg.ownerUserId;
}
