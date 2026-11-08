import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  RPGEngineMemoryStore,
  createStarterUserMemoryStore,
  demoStore,
} from "./demo-store.ts";
import { hydrateStoreFromLocalDisk } from "./persistence-sync.ts";
import {
  createSupabaseUserClient,
  isSupabaseConfigured,
  resolvePlayerUserId,
  supabaseAdmin,
  supabaseAnon,
} from "./supabase.ts";
import type { PersonalApiTokenInfo, UserProfile } from "../types/rpg.ts";

export const RPG_ACCESS_TOKEN_COOKIE = "rpg_access_token";
export const RPG_REFRESH_TOKEN_COOKIE = "rpg_refresh_token";
export const RPG_LOCAL_SESSION_COOKIE = "rpg_local_session";

export const DEFAULT_DEMO_USER_ID = "11111111-1111-4111-8111-111111111111";
export const DEFAULT_DEMO_EMAIL = "player1@rpg-life-engine.local";
export const DEFAULT_DEMO_PASSWORD = "RpgLifeEngine2026!";

interface LocalUserRecord {
  profile: UserProfile;
  passwordHash: string;
}

interface StoredApiTokenRecord extends PersonalApiTokenInfo {
  token_hash: string;
}

interface GlobalAuthRegistry {
  localUsersById: Map<string, LocalUserRecord>;
  localUserIdByEmail: Map<string, string>;
  localUserStores: Map<string, RPGEngineMemoryStore>;
  localSessions: Map<string, { userId: string; createdAt: number }>;
  localApiTokensByHash: Map<string, StoredApiTokenRecord>;
}

const globalForAuth = globalThis as unknown as {
  rpgAuthRegistryV3?: GlobalAuthRegistry;
};

function hashPasswordSync(password: string, salt?: string): string {
  const actualSalt = salt || crypto.randomBytes(16).toString("hex");
  const derived = crypto
    .scryptSync(password, actualSalt, 64)
    .toString("hex");
  return `${actualSalt}:${derived}`;
}

export function verifyPasswordSync(
  password: string,
  storedHash: string
): boolean {
  const [salt, keyHex] = storedHash.split(":");
  if (!salt || !keyHex) return false;
  const derivedHex = crypto.scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(keyHex, "hex");
  const b = Buffer.from(derivedHex, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function createInitialAuthRegistry(): GlobalAuthRegistry {
  const localUsersById = new Map<string, LocalUserRecord>();
  const localUserIdByEmail = new Map<string, string>();
  const localUserStores = new Map<string, RPGEngineMemoryStore>();
  const localSessions = new Map<string, { userId: string; createdAt: number }>();
  const localApiTokensByHash = new Map<string, StoredApiTokenRecord>();

  const defaultProfile: UserProfile = {
    id: DEFAULT_DEMO_USER_ID,
    email: DEFAULT_DEMO_EMAIL,
    display_name: "Player One (Demo)",
    character_class: "Paladín Financiero",
    avatar_url: null,
    created_at: "2026-11-01T00:00:00.000Z",
    updated_at: "2026-11-01T00:00:00.000Z",
  };

  localUsersById.set(DEFAULT_DEMO_USER_ID, {
    profile: defaultProfile,
    passwordHash: hashPasswordSync(DEFAULT_DEMO_PASSWORD, "defaultdemosalt01"),
  });
  localUserIdByEmail.set(DEFAULT_DEMO_EMAIL, DEFAULT_DEMO_USER_ID);
  localUserStores.set(DEFAULT_DEMO_USER_ID, demoStore);

  return {
    localUsersById,
    localUserIdByEmail,
    localUserStores,
    localSessions,
    localApiTokensByHash,
  };
}

const authRegistry: GlobalAuthRegistry =
  globalForAuth.rpgAuthRegistryV3 ?? createInitialAuthRegistry();
if (process.env.NODE_ENV !== "production") {
  globalForAuth.rpgAuthRegistryV3 = authRegistry;
}

/**
 * Obtiene el store en memoria aislado correspondiente a un userId específico.
 * El usuario demo original usa demoStore; cada usuario nuevo tiene su propia instancia aislada.
 */
export function getUserStore(userId: string): RPGEngineMemoryStore {
  if (!userId) {
    throw new Error("userId es obligatorio para resolver el store del usuario.");
  }
  if (userId === DEFAULT_DEMO_USER_ID) {
    hydrateStoreFromLocalDisk(userId, demoStore);
    return demoStore;
  }
  let store = authRegistry.localUserStores.get(userId);
  if (!store) {
    store = createStarterUserMemoryStore({ userId });
    hydrateStoreFromLocalDisk(userId, store);
    authRegistry.localUserStores.set(userId, store);
  }
  return store;
}

export function getLocalUserProfile(userId: string): UserProfile | null {
  return authRegistry.localUsersById.get(userId)?.profile || null;
}

export async function isDisplayNameAvailable(
  displayName: string,
  excludeUserId?: string
): Promise<boolean> {
  const clean = (displayName || "").trim().toLowerCase();
  if (!clean || clean.length < 2) return false;

  for (const [uid, rec] of authRegistry.localUsersById.entries()) {
    if (excludeUserId && uid === excludeUserId) continue;
    if (rec.profile.display_name.trim().toLowerCase() === clean) {
      return false;
    }
  }

  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name")
        .ilike("display_name", clean)
        .limit(5);
      if (data && data.length > 0) {
        const conflict = data.some(
          (row) =>
            String(row.display_name || "").trim().toLowerCase() === clean &&
            (!excludeUserId || String(row.id) !== excludeUserId)
        );
        if (conflict) return false;
      }
    } catch {
      // Si la tabla profiles aún no existe, valida con el registro local
    }
  }

  return true;
}

export function updateLocalUserProfile(
  userId: string,
  updates: {
    display_name?: string;
    character_class?: string;
    avatar_url?: string | null;
    monthly_income_cop?: number;
    fixed_costs_budget_cop?: number;
    variable_ops_budget_cop?: number;
    vault_cap_gp?: number;
    data_privacy_accepted?: boolean;
    privacy_accepted_at?: string;
    privacy_version?: string;
  }
): UserProfile | null {
  const record = authRegistry.localUsersById.get(userId);
  if (!record) return null;

  if (updates.display_name && updates.display_name.trim()) {
    record.profile.display_name = updates.display_name.trim().slice(0, 120);
  }
  if (updates.character_class && updates.character_class.trim()) {
    record.profile.character_class = updates.character_class.trim().slice(0, 60);
  }
  if (updates.avatar_url !== undefined) {
    record.profile.avatar_url = updates.avatar_url
      ? updates.avatar_url.trim()
      : null;
  }
  if (updates.data_privacy_accepted !== undefined) {
    record.profile.data_privacy_accepted = updates.data_privacy_accepted;
  }
  if (updates.privacy_accepted_at !== undefined) {
    record.profile.privacy_accepted_at = updates.privacy_accepted_at;
  }
  if (updates.privacy_version !== undefined) {
    record.profile.privacy_version = updates.privacy_version;
  }
  record.profile.updated_at = new Date().toISOString();

  const store = getUserStore(userId);
  store.updateFinancialConfig({
    monthly_income_cop: updates.monthly_income_cop,
    fixed_costs_budget_cop: updates.fixed_costs_budget_cop,
    variable_ops_budget_cop: updates.variable_ops_budget_cop,
    vault_cap_gp: updates.vault_cap_gp,
  });

  return record.profile;
}

export function registerLocalUser(params: {
  email: string;
  password: string;
  display_name?: string;
  character_class?: string;
  monthly_income_cop?: number;
  fixed_costs_budget_cop?: number;
  variable_ops_budget_cop?: number;
  vault_cap_gp?: number;
}): { user: UserProfile; sessionToken: string; store: RPGEngineMemoryStore } {
  const cleanEmail = (params.email || "").trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("Debes ingresar un correo electrónico válido.");
  }
  if (!params.password || params.password.length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres.");
  }
  if (authRegistry.localUserIdByEmail.has(cleanEmail)) {
    throw new Error("Ya existe un perfil registrado con ese correo electrónico.");
  }

  const userId = crypto.randomUUID();
  const displayName =
    (params.display_name || "").trim() || cleanEmail.split("@")[0];
  const characterClass =
    (params.character_class || "").trim() || "Paladín Financiero";
  const nowIso = new Date().toISOString();

  const profile: UserProfile = {
    id: userId,
    email: cleanEmail,
    display_name: displayName,
    character_class: characterClass,
    avatar_url: null,
    data_privacy_accepted: true,
    privacy_accepted_at: nowIso,
    privacy_version: "3.4",
    created_at: nowIso,
    updated_at: nowIso,
  };

  const store = createStarterUserMemoryStore({
    userId,
    monthly_income_cop: params.monthly_income_cop,
    fixed_costs_budget_cop: params.fixed_costs_budget_cop,
    variable_ops_budget_cop: params.variable_ops_budget_cop,
    vault_cap_gp: params.vault_cap_gp,
  });

  authRegistry.localUsersById.set(userId, {
    profile,
    passwordHash: hashPasswordSync(params.password),
  });
  authRegistry.localUserIdByEmail.set(cleanEmail, userId);
  authRegistry.localUserStores.set(userId, store);

  const sessionToken = `local_sess_${crypto.randomBytes(24).toString("hex")}`;
  authRegistry.localSessions.set(sessionToken, {
    userId,
    createdAt: Date.now(),
  });

  return { user: profile, sessionToken, store };
}

export function authenticateLocalUser(
  email: string,
  password: string
): { user: UserProfile; sessionToken: string; store: RPGEngineMemoryStore } {
  const cleanEmail = (email || "").trim().toLowerCase();
  const userId = authRegistry.localUserIdByEmail.get(cleanEmail);
  if (!userId) {
    throw new Error("Credenciales inválidas: correo o contraseña incorrectos.");
  }
  const record = authRegistry.localUsersById.get(userId);
  if (!record || !verifyPasswordSync(password, record.passwordHash)) {
    throw new Error("Credenciales inválidas: correo o contraseña incorrectos.");
  }

  const sessionToken = `local_sess_${crypto.randomBytes(24).toString("hex")}`;
  authRegistry.localSessions.set(sessionToken, {
    userId,
    createdAt: Date.now(),
  });

  return {
    user: record.profile,
    sessionToken,
    store: getUserStore(userId),
  };
}

export function createDemoQuickSession(): {
  user: UserProfile;
  sessionToken: string;
  store: RPGEngineMemoryStore;
} {
  const record = authRegistry.localUsersById.get(DEFAULT_DEMO_USER_ID)!;
  const sessionToken = `local_sess_${crypto.randomBytes(24).toString("hex")}`;
  authRegistry.localSessions.set(sessionToken, {
    userId: DEFAULT_DEMO_USER_ID,
    createdAt: Date.now(),
  });
  return {
    user: record.profile,
    sessionToken,
    store: demoStore,
  };
}

export function revokeLocalSession(sessionToken: string): void {
  authRegistry.localSessions.delete(sessionToken);
}

/**
 * Calcula el hash SHA-256 hexadecimal de un token de API personal.
 * Nunca se almacena el token en texto plano en la base de datos.
 */
export function hashApiToken(rawToken: string): string {
  return crypto
    .createHash("sha256")
    .update(rawToken.trim(), "utf8")
    .digest("hex");
}

export function generatePersonalApiToken(): {
  rawToken: string;
  tokenHash: string;
  tokenPrefix: string;
} {
  const randomPart = crypto.randomBytes(24).toString("hex");
  const rawToken = `rpg_usr_${randomPart}`;
  const tokenHash = hashApiToken(rawToken);
  const tokenPrefix = `${rawToken.slice(0, 16)}...`;
  return { rawToken, tokenHash, tokenPrefix };
}

export async function createPersonalTokenForUser(params: {
  userId: string;
  name?: string;
  regenerate?: boolean;
  clientOverride?: SupabaseClient | null;
}): Promise<{ raw_token: string; token: PersonalApiTokenInfo }> {
  const { userId, name = "iOS Shortcuts Token", regenerate = true } = params;
  if (!userId) {
    throw new Error("userId es obligatorio para generar un token personal.");
  }

  const { rawToken, tokenHash, tokenPrefix } = generatePersonalApiToken();
  const nowIso = new Date().toISOString();

  if (isSupabaseConfigured) {
    const db = params.clientOverride || supabaseAdmin;
    if (!db) {
      throw new Error("Cliente Supabase no disponible.");
    }

    if (regenerate) {
      await db
        .from("api_tokens")
        .update({ revoked_at: nowIso })
        .eq("user_id", userId)
        .is("revoked_at", null);
    }

    const { data, error } = await db
      .from("api_tokens")
      .insert({
        user_id: userId,
        name: name.trim() || "iOS Shortcuts Token",
        token_prefix: tokenPrefix,
        token_hash: tokenHash,
      })
      .select(
        "id, user_id, name, token_prefix, last_used_at, revoked_at, created_at"
      )
      .single();

    if (error || !data) {
      throw new Error(
        error?.message ||
          "No se pudo guardar el token en public.api_tokens (verifica supabase/schema.sql)."
      );
    }

    return {
      raw_token: rawToken,
      token: {
        id: String(data.id),
        user_id: String(data.user_id),
        name: String(data.name),
        token_prefix: String(data.token_prefix),
        last_used_at: data.last_used_at ? String(data.last_used_at) : null,
        revoked_at: data.revoked_at ? String(data.revoked_at) : null,
        created_at: String(data.created_at),
      },
    };
  }

  // Modo Local: revocar anteriores del mismo usuario si regenerate = true
  if (regenerate) {
    for (const tok of authRegistry.localApiTokensByHash.values()) {
      if (tok.user_id === userId && tok.revoked_at === null) {
        tok.revoked_at = nowIso;
      }
    }
  }

  const newRecord: StoredApiTokenRecord = {
    id: `tok-${crypto.randomUUID().slice(0, 8)}`,
    user_id: userId,
    name: name.trim() || "iOS Shortcuts Token",
    token_prefix: tokenPrefix,
    token_hash: tokenHash,
    last_used_at: null,
    revoked_at: null,
    created_at: nowIso,
  };
  authRegistry.localApiTokensByHash.set(tokenHash, newRecord);

  const { token_hash: _omitHash, ...publicInfo } = newRecord;
  void _omitHash;
  return {
    raw_token: rawToken,
    token: publicInfo,
  };
}

export async function listPersonalTokensForUser(
  userId: string,
  clientOverride?: SupabaseClient | null
): Promise<PersonalApiTokenInfo[]> {
  if (!userId) return [];

  if (isSupabaseConfigured) {
    const db = clientOverride || supabaseAdmin;
    if (!db) return [];
    try {
      const { data, error } = await db
        .from("api_tokens")
        .select(
          "id, user_id, name, token_prefix, last_used_at, revoked_at, created_at"
        )
        .eq("user_id", userId)
        .is("revoked_at", null)
        .order("created_at", { ascending: false });

      if (error || !data) return [];
      return data.map((row) => ({
        id: String(row.id),
        user_id: String(row.user_id),
        name: String(row.name),
        token_prefix: String(row.token_prefix),
        last_used_at: row.last_used_at ? String(row.last_used_at) : null,
        revoked_at: row.revoked_at ? String(row.revoked_at) : null,
        created_at: String(row.created_at),
      }));
    } catch {
      return [];
    }
  }

  const results: PersonalApiTokenInfo[] = [];
  for (const tok of authRegistry.localApiTokensByHash.values()) {
    if (tok.user_id === userId && tok.revoked_at === null) {
      const { token_hash: _omitHash, ...publicInfo } = tok;
      void _omitHash;
      results.push(publicInfo);
    }
  }
  return results.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function revokePersonalTokenForUser(
  userId: string,
  tokenId: string,
  clientOverride?: SupabaseClient | null
): Promise<boolean> {
  if (!userId || !tokenId) return false;
  const nowIso = new Date().toISOString();

  if (isSupabaseConfigured) {
    const db = clientOverride || supabaseAdmin;
    if (!db) return false;
    const { data, error } = await db
      .from("api_tokens")
      .update({ revoked_at: nowIso })
      .eq("id", tokenId)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();

    return !error && Boolean(data?.id);
  }

  for (const tok of authRegistry.localApiTokensByHash.values()) {
    if (
      tok.id === tokenId &&
      tok.user_id === userId &&
      tok.revoked_at === null
    ) {
      tok.revoked_at = nowIso;
      return true;
    }
  }
  return false;
}

export function parseCookies(
  cookieHeader: string | null
): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

export function buildAuthSetCookieHeaders(params: {
  accessToken?: string;
  refreshToken?: string;
  localSessionToken?: string;
}): string[] {
  const maxAge = 60 * 60 * 24 * 30; // 30 días
  const secureFlag =
    process.env.NODE_ENV === "production" ? "; Secure" : "";
  const headers: string[] = [];

  if (params.accessToken) {
    headers.push(
      `${RPG_ACCESS_TOKEN_COOKIE}=${encodeURIComponent(
        params.accessToken
      )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureFlag}`
    );
  }
  if (params.refreshToken) {
    headers.push(
      `${RPG_REFRESH_TOKEN_COOKIE}=${encodeURIComponent(
        params.refreshToken
      )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureFlag}`
    );
  }
  if (params.localSessionToken) {
    headers.push(
      `${RPG_LOCAL_SESSION_COOKIE}=${encodeURIComponent(
        params.localSessionToken
      )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureFlag}`
    );
  }
  return headers;
}

export function buildClearAuthCookieHeaders(): string[] {
  return [
    `${RPG_ACCESS_TOKEN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    `${RPG_REFRESH_TOKEN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    `${RPG_LOCAL_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  ];
}

export interface AuthenticatedUserContext {
  userId: string;
  email: string;
  displayName: string;
  characterClass: string;
  avatarUrl: string | null;
  mode: "supabase" | "local_engine";
  accessToken?: string;
  refreshedTokens?: { accessToken: string; refreshToken: string };
  userClient?: SupabaseClient | null;
}

/**
 * Resuelve el usuario autenticado a partir de las cookies de sesión o el JWT Bearer.
 * NUNCA usa DEFAULT_PLAYER_USER_ID ni confía en user_id enviado por el cliente.
 */
export async function resolveAuthenticatedUser(
  req: Request
): Promise<AuthenticatedUserContext | null> {
  const cookies = parseCookies(req.headers.get("cookie"));
  const bearerHeader = req.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();

  // Modo demo (SOLO desarrollo): si hay cookie de sesión local y no hay tokens de
  // Supabase, se permite usar el motor local aunque Supabase esté configurado.
  const devLocalDemo =
    process.env.NODE_ENV !== "production" &&
    Boolean(cookies[RPG_LOCAL_SESSION_COOKIE]) &&
    !cookies[RPG_ACCESS_TOKEN_COOKIE] &&
    !cookies[RPG_REFRESH_TOKEN_COOKIE];

  if (isSupabaseConfigured && supabaseAnon && !devLocalDemo) {
    const accessToken =
      cookies[RPG_ACCESS_TOKEN_COOKIE] ||
      (bearerHeader && !bearerHeader.startsWith("rpg_usr_")
        ? bearerHeader
        : "");
    const refreshToken = cookies[RPG_REFRESH_TOKEN_COOKIE] || "";

    if (!accessToken && !refreshToken) {
      return null;
    }

    let validAccessToken = accessToken;
    let refreshedTokens:
      | { accessToken: string; refreshToken: string }
      | undefined;
    let sbUser = null;

    if (validAccessToken) {
      const { data, error } = await supabaseAnon.auth.getUser(validAccessToken);
      if (!error && data?.user) {
        sbUser = data.user;
      }
    }

    if (!sbUser && refreshToken) {
      const { data: refreshData, error: refreshErr } =
        await supabaseAnon.auth.refreshSession({
          refresh_token: refreshToken,
        });
      if (!refreshErr && refreshData?.session && refreshData?.user) {
        sbUser = refreshData.user;
        validAccessToken = refreshData.session.access_token;
        refreshedTokens = {
          accessToken: refreshData.session.access_token,
          refreshToken: refreshData.session.refresh_token,
        };
      }
    }

    if (!sbUser || !validAccessToken) {
      return null;
    }

    const userClient = createSupabaseUserClient(validAccessToken);
    const meta = (sbUser.user_metadata || {}) as Record<string, unknown>;
    let displayName = String(
      meta.display_name ||
        meta.full_name ||
        sbUser.email?.split("@")[0] ||
        "Aventurero RPG"
    );
    let characterClass = String(meta.character_class || "Paladín Financiero");
    let avatarUrl: string | null = meta.avatar_url
      ? String(meta.avatar_url)
      : null;

    // Intentar leer de la tabla public.profiles (con RLS)
    const db = userClient || supabaseAdmin;
    if (db) {
      try {
        const { data: profileRow } = await db
          .from("profiles")
          .select("display_name, character_class, avatar_url")
          .eq("id", sbUser.id)
          .maybeSingle();

        if (profileRow) {
          if (profileRow.display_name) {
            displayName = String(profileRow.display_name);
          }
          if (profileRow.character_class) {
            characterClass = String(profileRow.character_class);
          }
          if (profileRow.avatar_url !== undefined) {
            avatarUrl = profileRow.avatar_url
              ? String(profileRow.avatar_url)
              : null;
          }
        }
      } catch {
        // Si la tabla profiles aún no existe, usa user_metadata
      }
    }

    return {
      userId: sbUser.id,
      email: sbUser.email || "",
      displayName,
      characterClass,
      avatarUrl,
      mode: "supabase",
      accessToken: validAccessToken,
      refreshedTokens,
      userClient,
    };
  }

  // Modo Local: resolver sesión desde cookie rpg_local_session o header Bearer local_sess_...
  const localToken =
    cookies[RPG_LOCAL_SESSION_COOKIE] ||
    (bearerHeader && bearerHeader.startsWith("local_sess_")
      ? bearerHeader
      : "");

  if (!localToken) {
    return null;
  }

  const sess = authRegistry.localSessions.get(localToken);
  if (!sess) {
    return null;
  }

  const userRec = authRegistry.localUsersById.get(sess.userId);
  if (!userRec) {
    return null;
  }

  return {
    userId: userRec.profile.id,
    email: userRec.profile.email,
    displayName: userRec.profile.display_name,
    characterClass: userRec.profile.character_class,
    avatarUrl: userRec.profile.avatar_url || null,
    mode: "local_engine",
  };
}

export type ShortcutAuthResult =
  | {
      authorized: true;
      userId: string;
      authMethod: "personal_token" | "session" | "legacy_secret";
      mode: "supabase" | "local_engine";
      userClient?: SupabaseClient | null;
    }
  | {
      authorized: false;
      status: number;
      error: string;
    };

/**
 * Resuelve la identidad del usuario en endpoints de iOS Shortcuts (/api/shortcuts/*).
 * Orden de prioridad:
 * 1. Token personal por usuario (`rpg_usr_...`) -> busca su hash SHA-256 en `api_tokens` y resuelve a SU `user_id`.
 * 2. Sesión autenticada de navegador (cookies HttpOnly / JWT de usuario) -> resuelve a SU `user_id`.
 * 3. `SHORTCUTS_API_SECRET` legacy -> solo si coincide exactamente y existe `DEFAULT_PLAYER_USER_ID` explícito.
 */
export async function resolveShortcutRequestUser(
  req: Request
): Promise<ShortcutAuthResult> {
  const headerKey = (
    req.headers.get("x-api-key") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    ""
  ).trim();

  // 1. Token Personal por Usuario (Prefijo rpg_usr_)
  if (headerKey.startsWith("rpg_usr_")) {
    const tokenHash = hashApiToken(headerKey);

    if (isSupabaseConfigured) {
      // Consultar en public.api_tokens por hash (usando supabaseAdmin o RPC SECURITY DEFINER)
      if (supabaseAdmin) {
        const { data: tokenRow, error } = await supabaseAdmin
          .from("api_tokens")
          .select("id, user_id, revoked_at")
          .eq("token_hash", tokenHash)
          .is("revoked_at", null)
          .maybeSingle();

        if (error || !tokenRow || tokenRow.revoked_at) {
          return {
            authorized: false,
            status: 401,
            error: "Unauthorized: Token personal de iOS Shortcuts inválido o revocado.",
          };
        }

        await supabaseAdmin
          .from("api_tokens")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", tokenRow.id);

        return {
          authorized: true,
          userId: String(tokenRow.user_id),
          authMethod: "personal_token",
          mode: "supabase",
          userClient: supabaseAdmin,
        };
      }

      if (supabaseAnon) {
        const { data: resolvedUid, error: rpcErr } = await supabaseAnon.rpc(
          "fn_resolve_api_token",
          { p_token_hash: tokenHash }
        );
        if (!rpcErr && resolvedUid) {
          return {
            authorized: true,
            userId: String(resolvedUid),
            authMethod: "personal_token",
            mode: "supabase",
            userClient: supabaseAdmin,
          };
        }
      }

      return {
        authorized: false,
        status: 401,
        error: "Unauthorized: Token personal de iOS Shortcuts inválido o revocado.",
      };
    }

    // Modo Local: verificar hash en memoria
    const localTok = authRegistry.localApiTokensByHash.get(tokenHash);
    if (!localTok || localTok.revoked_at !== null) {
      return {
        authorized: false,
        status: 401,
        error: "Unauthorized: Token personal de iOS Shortcuts inválido o revocado.",
      };
    }
    localTok.last_used_at = new Date().toISOString();
    return {
      authorized: true,
      userId: localTok.user_id,
      authMethod: "personal_token",
      mode: "local_engine",
    };
  }

  // 2. Sesión autenticada del usuario (Dashboard web con cookies / JWT)
  const sessionUser = await resolveAuthenticatedUser(req);
  if (sessionUser) {
    return {
      authorized: true,
      userId: sessionUser.userId,
      authMethod: "session",
      mode: sessionUser.mode,
      userClient: sessionUser.userClient || supabaseAdmin,
    };
  }

  // 3. Compatibilidad acotada con SHORTCUTS_API_SECRET legacy (solo para el dueño original si DEFAULT_PLAYER_USER_ID está definido)
  const configuredSecret = (process.env.SHORTCUTS_API_SECRET || "").trim();
  if (headerKey && configuredSecret && headerKey === configuredSecret) {
    if (isSupabaseConfigured) {
      const legacyOwnerId = await resolvePlayerUserId();
      if (!legacyOwnerId) {
        return {
          authorized: false,
          status: 401,
          error:
            "SHORTCUTS_API_SECRET requiere DEFAULT_PLAYER_USER_ID explícito o usar un token personal (rpg_usr_...) generado desde tu perfil.",
        };
      }
      return {
        authorized: true,
        userId: legacyOwnerId,
        authMethod: "legacy_secret",
        mode: "supabase",
        userClient: supabaseAdmin,
      };
    }

    return {
      authorized: true,
      userId: DEFAULT_DEMO_USER_ID,
      authMethod: "legacy_secret",
      mode: "local_engine",
    };
  }

  return {
    authorized: false,
    status: 401,
    error:
      "Unauthorized: Inicia sesión en tu perfil o envía tu token personal en el header x-api-key (rpg_usr_...).",
  };
}

/**
 * Aprovisiona de manera 100% idempotente los datos iniciales de un usuario en Supabase
 * (perfil, tesorería del mes actual, bosses iniciales, misiones, cubos, libros, tejido y wishlist)
 * con valores por defecto razonables y editables, sin tocar ni copiar los datos de ningún otro usuario.
 */
export async function ensureSupabaseUserProvisioned(params: {
  userId: string;
  email?: string;
  displayName?: string;
  characterClass?: string;
  monthly_income_cop?: number;
  fixed_costs_budget_cop?: number;
  variable_ops_budget_cop?: number;
  vault_cap_gp?: number;
  clientOverride?: SupabaseClient | null;
}): Promise<void> {
  const db = params.clientOverride || supabaseAdmin;
  if (!isSupabaseConfigured || !db || !params.userId) return;

  const userId = params.userId;
  const email = params.email || "";
  const displayName =
    (params.displayName || "").trim() ||
    email.split("@")[0] ||
    "Aventurero RPG";
  const characterClass =
    (params.characterClass || "").trim() || "Paladín Financiero";
  const currentBillingPeriod = new Date().toISOString().slice(0, 7);

  // 1. Perfil en public.profiles
  try {
    const { data: existingProfile } = await db
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (!existingProfile) {
      await db.from("profiles").insert({
        id: userId,
        email,
        display_name: displayName,
        character_class: characterClass,
      });
    }
  } catch {
    // Continuar si public.profiles aún no se ha migrado
  }

  // 2. Tesorería inicial del periodo actual en public.player_treasury
  const { data: existingTreasury } = await db
    .from("player_treasury")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (!existingTreasury) {
    const incomeCop = Math.max(
      100000,
      Math.round(params.monthly_income_cop ?? 2000000)
    );
    const fixedCop = Math.max(
      0,
      Math.round(params.fixed_costs_budget_cop ?? 800000)
    );
    const variableCop = Math.max(
      0,
      Math.round(params.variable_ops_budget_cop ?? 500000)
    );
    const vaultGp = Math.max(10000, Math.round(params.vault_cap_gp ?? 350000));

    await db.from("player_treasury").insert({
      user_id: userId,
      billing_period: currentBillingPeriod,
      monthly_income_cop: incomeCop,
      fixed_costs_budget_cop: fixedCop,
      fixed_costs_spent_cop: 0,
      variable_ops_budget_cop: variableCop,
      variable_ops_spent_cop: 0,
      vault_cap_gp: vaultGp,
      vault_remaining_gp: vaultGp,
      wallet_gp: 0,
      total_penalty_gp: 0,
      debt_strategy: "snowball",
      player_level: 1,
      current_xp: 0,
      current_streak_days: 0,
      streak_multiplier: 1.0,
      aegis_shields: 1,
    });
  }

  // 3. Debt Bosses iniciales (solo si el usuario no tiene ninguno aún)
  const { data: existingBosses } = await db
    .from("debt_bosses")
    .select("id")
    .eq("user_id", userId)
    .limit(1);

  if (!existingBosses || existingBosses.length === 0) {
    const { data: insertedBosses } = await db
      .from("debt_bosses")
      .insert([
        {
          user_id: userId,
          name: "Nequi",
          max_hp: 150000,
          current_hp: 150000,
          interest_rate_ea: 25.0,
          min_monthly_payment_cop: 40000,
          paid_this_month_cop: 0,
          priority_order: 1,
          status: "active",
        },
        {
          user_id: userId,
          name: "ADDI",
          max_hp: 500000,
          current_hp: 500000,
          interest_rate_ea: 28.5,
          min_monthly_payment_cop: 85000,
          paid_this_month_cop: 0,
          priority_order: 2,
          status: "active",
        },
        {
          user_id: userId,
          name: "Bancolombia",
          max_hp: 1200000,
          current_hp: 1200000,
          interest_rate_ea: 24.0,
          min_monthly_payment_cop: 120000,
          paid_this_month_cop: 0,
          priority_order: 3,
          status: "active",
        },
      ])
      .select("*");

    if (insertedBosses && insertedBosses.length > 0) {
      try {
        const store = getUserStore(userId);
        store.bosses = insertedBosses.map((b) => ({
          id: String(b.id),
          name: String(b.name),
          max_hp: Number(b.max_hp),
          current_hp: Number(b.current_hp),
          interest_rate_ea: Number(b.interest_rate_ea),
          min_monthly_payment_cop: Number(b.min_monthly_payment_cop),
          paid_this_month_cop: Number(b.paid_this_month_cop),
          priority_order: Number(b.priority_order),
          status: b.status,
        }));
      } catch {
        // Ignorar si store no está inicializado
      }
    }
  }

  // 4. Catálogo de misiones iniciales (solo si no tiene misiones)
  const { data: existingQuests } = await db
    .from("quest_catalog")
    .select("id")
    .eq("user_id", userId)
    .limit(1);

  if (!existingQuests || existingQuests.length === 0) {
    await db.from("quest_catalog").insert([
      {
        user_id: userId,
        code: "RUBIK_AO12_SESSION",
        title: "Cubo de Rubik: Sesión Ao12 + Práctica CFOP",
        domain: "rubik",
        difficulty: "medium",
        reward_gp: 4500,
        reward_xp: 95,
        daily_limit: 3,
        is_active: true,
      },
      {
        user_id: userId,
        code: "READING_SESSION_30M",
        title: "Sesión de Lectura Profunda (20+ páginas)",
        domain: "reading",
        difficulty: "medium",
        reward_gp: 4000,
        reward_xp: 85,
        daily_limit: 3,
        is_active: true,
      },
      {
        user_id: userId,
        code: "KNITTING_CRAFT_SESSION",
        title: "Sesión de Tejido: Avance de Filas / Crochet",
        domain: "knitting",
        difficulty: "medium",
        reward_gp: 4500,
        reward_xp: 90,
        daily_limit: 3,
        is_active: true,
      },
      {
        user_id: userId,
        code: "STUDY_BLOCK",
        title: "Sesión de Estudio / Active Recall (50m)",
        domain: "study",
        difficulty: "hard",
        reward_gp: 5000,
        reward_xp: 110,
        daily_limit: 3,
        is_active: true,
      },
      {
        user_id: userId,
        code: "DEEP_WORK_2H",
        title: "Sesión de Trabajo: Bloque Deep Work (2h)",
        domain: "work",
        difficulty: "hard",
        reward_gp: 6500,
        reward_xp: 130,
        daily_limit: 2,
        is_active: true,
      },
      {
        user_id: userId,
        code: "GYM_WORKOUT",
        title: "Entrenamiento de Fuerza / Gym",
        domain: "general",
        difficulty: "hard",
        reward_gp: 5000,
        reward_xp: 100,
        daily_limit: 1,
        is_active: true,
      },
    ]);
  }

  // 5. Libro inicial, proyecto de tejido inicial, cubo 3x3 inicial y wishlist inicial
  try {
    const { data: existingBooks } = await db
      .from("reading_books")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    if (!existingBooks || existingBooks.length === 0) {
      await db.from("reading_books").insert({
        user_id: userId,
        title: "Hábitos Atómicos",
        author: "James Clear",
        total_pages: 320,
        pages_read: 0,
        category: "Productividad & Hábitos",
        status: "reading",
      });
    }
  } catch {
    // Ignorar si la tabla aún no existe
  }

  try {
    const { data: existingKnits } = await db
      .from("knitting_projects")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    if (!existingKnits || existingKnits.length === 0) {
      await db.from("knitting_projects").insert({
        user_id: userId,
        name: "Proyecto Inicial de Tejido & Crochet",
        technique: "Crochet",
        total_rows_target: 50,
        completed_rows: 0,
        yarn_details: "Hilaza algodón • Aguja 3.0mm",
        status: "in_progress",
      });
    }
  } catch {
    // Ignorar
  }

  try {
    const { data: existingCubes } = await db
      .from("rubik_cubes")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    if (!existingCubes || existingCubes.length === 0) {
      await db.from("rubik_cubes").insert({
        user_id: userId,
        cube_type: "3x3",
        brand: "GAN",
        model_name: "GAN 356 MagLev 3x3 UV",
        magnetic_system: "Ball-Core + MagLev",
        surface_finish: "UV Coated",
        size_mm: 56.0,
        weight_grams: 71.0,
        wca_legal: true,
        recommended_setup: "Tensión Nivel 3/6 • Lube Rápido",
        target_sub_seconds: 20.0,
        recommended_alg_set: "CFOP Full OLL/PLL",
        reward_gp_per_solve: 4500,
        pb_bonus_gp: 2000,
        status: "active_main",
      });
    }
  } catch {
    // Ignorar
  }

  try {
    const { data: existingWish } = await db
      .from("wishlist_items")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    if (!existingWish || existingWish.length === 0) {
      await db.from("wishlist_items").insert([
        {
          user_id: userId,
          name: "Recompensa Personal Nivel 1",
          cost_gp: 50000,
          priority: 1,
          is_redeemed: false,
        },
        {
          user_id: userId,
          name: "Meta de Ahorro / Loot Épico",
          cost_gp: 100000,
          priority: 2,
          is_redeemed: false,
        },
      ]);
    }
  } catch {
    // Ignorar
  }
}
