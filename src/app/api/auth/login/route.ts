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
    const res = await fetch(`${url}/auth/v1/user`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ password: newPassword }),
    });
    return { ok: res.ok };
  },
});

export async function POST(req: Request) {
  return login(req);
}
