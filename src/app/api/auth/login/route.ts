import { NextResponse } from "next/server";
import {
  authenticateLocalUser,
  buildAuthSetCookieHeaders,
  registerLocalUser,
} from "@/lib/auth";
import { isSupabaseConfigured, supabaseAnon } from "@/lib/supabase";

/**
 * POST /api/auth/login
 * Body: { email, password, action?: "login" | "signup", display_name? }
 * - Modo Supabase: usa Supabase Auth y guarda access/refresh token en cookies HttpOnly.
 * - Modo Local: usa el registro en memoria y guarda la cookie rpg_local_session.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    action?: "login" | "signup";
    display_name?: string;
  };
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  const action = body.action === "signup" ? "signup" : "login";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Correo y contraseña son obligatorios." },
      { status: 400 }
    );
  }

  let cookieHeaders: string[] = [];

  try {
    if (isSupabaseConfigured && supabaseAnon) {
      const result =
        action === "signup"
          ? await supabaseAnon.auth.signUp({
              email,
              password,
              options: {
                data: { display_name: body.display_name || email.split("@")[0] },
              },
            })
          : await supabaseAnon.auth.signInWithPassword({ email, password });

      if (result.error) {
        return NextResponse.json({ error: result.error.message }, { status: 401 });
      }
      const session = result.data.session;
      if (!session) {
        // Signup con confirmación de correo activada en Supabase
        return NextResponse.json({
          ok: true,
          needs_confirmation: true,
          message:
            "Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.",
        });
      }
      cookieHeaders = buildAuthSetCookieHeaders({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
      });
    } else {
      const { sessionToken } =
        action === "signup"
          ? registerLocalUser({ email, password, display_name: body.display_name })
          : authenticateLocalUser(email, password);
      cookieHeaders = buildAuthSetCookieHeaders({ localSessionToken: sessionToken });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error de autenticación";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  for (const header of cookieHeaders) res.headers.append("Set-Cookie", header);
  return res;
}
