const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SingleUserEnv {
  OAKHAVEN_OWNER_USER_ID?: string;
  OAKHAVEN_PUBLIC_SIGNUP_ENABLED?: string;
  [key: string]: string | undefined;
}

export interface SingleUserAccessConfig {
  privateMode: boolean;
  ownerUserId: string | null;
  publicSignupEnabled: boolean;
}

/**
 * Resuelve la configuración de Modo Privado de Propietario Único (Release 3.3).
 * - Si OAKHAVEN_OWNER_USER_ID contiene un UUID válido, SOLO ese usuario de Supabase
 *   puede autenticarse y consumir APIs de producción.
 * - El registro público se cierra automáticamente si OAKHAVEN_PUBLIC_SIGNUP_ENABLED === "false"
 *   o si OAKHAVEN_OWNER_USER_ID está configurado (salvo apertura explícita temporal).
 * - Nunca expone el UUID ni correos en respuestas públicas.
 */
export function getSingleUserAccessConfig(
  env: SingleUserEnv = process.env
): SingleUserAccessConfig {
  const rawOwner = (env.OAKHAVEN_OWNER_USER_ID || "").trim();
  const ownerUserId = UUID_REGEX.test(rawOwner) ? rawOwner.toLowerCase() : null;
  const privateMode = ownerUserId !== null;

  const rawSignupFlag = (env.OAKHAVEN_PUBLIC_SIGNUP_ENABLED || "").trim().toLowerCase();
  let publicSignupEnabled = true;
  if (rawSignupFlag === "false") {
    publicSignupEnabled = false;
  } else if (privateMode && rawSignupFlag !== "true") {
    publicSignupEnabled = false;
  }

  return {
    privateMode,
    ownerUserId,
    publicSignupEnabled,
  };
}

export function isPublicSignupAllowed(env: SingleUserEnv = process.env): boolean {
  return getSingleUserAccessConfig(env).publicSignupEnabled;
}

/**
 * Valida que el UUID de Supabase pertenezca estrictamente al propietario autorizado
 * cuando el modo privado está activo.
 */
export function isAuthorizedSupabaseUserId(
  userId: string | null | undefined,
  env: SingleUserEnv = process.env
): boolean {
  const cfg = getSingleUserAccessConfig(env);
  if (!cfg.ownerUserId) {
    return true;
  }
  if (!userId || typeof userId !== "string") {
    return false;
  }
  return userId.trim().toLowerCase() === cfg.ownerUserId;
}
