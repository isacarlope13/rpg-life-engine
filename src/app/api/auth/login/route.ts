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
});

export async function POST(req: Request) {
  return login(req);
}
