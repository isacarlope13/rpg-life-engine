import {
  DEFAULT_DEMO_EMAIL,
  DEFAULT_DEMO_PASSWORD,
  DEFAULT_DEMO_PIN,
  authenticateLocalUser,
  buildAuthSetCookieHeaders,
  registerLocalUser,
} from "@/lib/auth";
import {
  isSupabaseConfigured,
  supabaseAdmin,
  supabaseAnon,
} from "@/lib/supabase";

import { createAuthLoginHandler } from "@/lib/auth-login";
import {
  getSingleUserAccessConfig,
  isAuthorizedSupabaseUserId,
} from "@/lib/single-user-guard";

export async function GET() {
  const cfg = getSingleUserAccessConfig();
  return Response.json({
    privateMode: cfg.privateMode,
    publicSignupEnabled: cfg.publicSignupEnabled,
    ownerConfigured: !cfg.ownerConfigInvalid,
  });
}

const login = createAuthLoginHandler({
  isSupabaseConfigured,
  supabaseAdmin,
  supabaseAnon,
  allowDemoBootstrap: process.env.NODE_ENV !== "production",
  DEFAULT_DEMO_EMAIL,
  DEFAULT_DEMO_PASSWORD,
  DEFAULT_DEMO_PIN,
  authenticateLocalUser,
  registerLocalUser,
  buildAuthSetCookieHeaders,
  async updatePasswordWithRecoveryToken({ accessToken, newPassword }) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      return { ok: false, error: "missing_supabase_config" };
    }
    // 1. Verificar identidad dueña del token ANTES de actualizar la contraseña (fail-closed)
    const whoRes = await fetch(`${url}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!whoRes.ok) {
      return { ok: false, status: 401, error: "invalid_recovery_token" };
    }
    const whoJson = (await whoRes.json().catch(() => null)) as { id?: string } | null;
    if (!isAuthorizedSupabaseUserId(whoJson?.id)) {
      return { ok: false, status: 403, error: "owner_only_access" };
    }
    // 2. Actualizar contraseña usando únicamente el token del usuario invitado/recuperado
    const res = await fetch(`${url}/auth/v1/user`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ password: newPassword }),
    });
    return { ok: res.ok, status: res.status };
  },
});

export async function POST(req: Request) {
  return login(req);
}
