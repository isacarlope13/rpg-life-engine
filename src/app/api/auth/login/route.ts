import { NextResponse } from "next/server";
import {
  DEFAULT_DEMO_EMAIL,
  DEFAULT_DEMO_PASSWORD,
  authenticateLocalUser,
  buildAuthSetCookieHeaders,
  registerLocalUser,
} from "@/lib/auth";
import {
  isSupabaseConfigured,
  supabaseAdmin,
  supabaseAnon,
} from "@/lib/supabase";

/**
 * POST /api/auth/login
 * Body: { email, password, action?: "login" | "signup", display_name? }
 * - Modo Supabase:
 *   * En "signup", si supabaseAdmin está disponible, crea y auto-confirma el correo
 *     (`email_confirm: true`) para que el usuario entre directo a /onboarding sin
 *     depender del servidor SMTP por defecto de Supabase.
 *   * En "login", si una cuenta existente estaba bloqueada por "Email not confirmed",
 *     la auto-confirma con supabaseAdmin y reintenta el inicio de sesión.
 *   * Si las credenciales corresponden a la cuenta maestra del piloto
 *     (`player1@rpg-life-engine.local`), la aprovisiona automáticamente si aún no existe.
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
      const displayName = body.display_name || email.split("@")[0];

      // 1. REGISTRO DE NUEVO USUARIO: Auto-confirmar con supabaseAdmin para entrar sin esperar correo
      if (action === "signup" && supabaseAdmin) {
        const { data: created, error: createErr } =
          await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { display_name: displayName },
          });

        if (createErr && /already|exists|registered/i.test(createErr.message)) {
          // Si ya había intentado registrarse pero quedó sin confirmar en Supabase, lo confirmamos
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
          const existing = listData?.users?.find(
            (u) => (u.email || "").toLowerCase() === email
          );
          if (existing) {
            await supabaseAdmin.auth.admin.updateUserById(existing.id, {
              email_confirm: true,
              password,
              user_metadata: {
                ...(existing.user_metadata || {}),
                display_name: displayName,
              },
            });
          }
        } else if (createErr && !created?.user) {
          return NextResponse.json(
            { error: createErr.message },
            { status: 400 }
          );
        }

        // Ahora iniciamos sesión inmediatamente con la cuenta ya confirmada
        const loginAfterSignup = await supabaseAnon.auth.signInWithPassword({
          email,
          password,
        });
        if (!loginAfterSignup.error && loginAfterSignup.data.session) {
          cookieHeaders = buildAuthSetCookieHeaders({
            accessToken: loginAfterSignup.data.session.access_token,
            refreshToken: loginAfterSignup.data.session.refresh_token,
          });
          const res = NextResponse.json({ ok: true });
          for (const header of cookieHeaders) {
            res.headers.append("Set-Cookie", header);
          }
          return res;
        }
      }

      // 2. FLUJO ESTÁNDAR SUPABASE (O FALLBACK SI NO HAY SERVICE_ROLE_KEY)
      let result =
        action === "signup"
          ? await supabaseAnon.auth.signUp({
              email,
              password,
              options: {
                data: { display_name: displayName },
              },
            })
          : await supabaseAnon.auth.signInWithPassword({ email, password });

      // Si al hacer login dice "Email not confirmed", lo auto-confirmamos con supabaseAdmin
      if (
        result.error &&
        /not confirmed|confirm/i.test(result.error.message) &&
        supabaseAdmin
      ) {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const existing = listData?.users?.find(
          (u) => (u.email || "").toLowerCase() === email
        );
        if (existing) {
          await supabaseAdmin.auth.admin.updateUserById(existing.id, {
            email_confirm: true,
          });
          result = await supabaseAnon.auth.signInWithPassword({
            email,
            password,
          });
        }
      }

      // Si es la cuenta maestra del piloto (player1@rpg-life-engine.local) y aún no existe en Supabase
      if (
        result.error &&
        email === DEFAULT_DEMO_EMAIL &&
        password === DEFAULT_DEMO_PASSWORD
      ) {
        if (supabaseAdmin) {
          await supabaseAdmin.auth.admin.createUser({
            email: DEFAULT_DEMO_EMAIL,
            password: DEFAULT_DEMO_PASSWORD,
            email_confirm: true,
            user_metadata: { display_name: "Player One (Piloto)" },
          });
          result = await supabaseAnon.auth.signInWithPassword({
            email: DEFAULT_DEMO_EMAIL,
            password: DEFAULT_DEMO_PASSWORD,
          });
        }
        if (result.error) {
          // Respaldo inmediato con sesión local para la cuenta maestra
          const { sessionToken } = authenticateLocalUser(email, password);
          cookieHeaders = buildAuthSetCookieHeaders({
            localSessionToken: sessionToken,
          });
          const res = NextResponse.json({ ok: true });
          for (const header of cookieHeaders) {
            res.headers.append("Set-Cookie", header);
          }
          return res;
        }
      }

      if (result.error) {
        return NextResponse.json(
          { error: result.error.message },
          { status: 401 }
        );
      }

      const session = result.data.session;
      if (!session) {
        // Si Supabase tiene confirmación de correo activa y no se configuró SUPABASE_SERVICE_ROLE_KEY,
        // creamos sesión local inmediata para que el usuario no quede bloqueado.
        const { sessionToken } =
          action === "signup"
            ? registerLocalUser({
                email,
                password,
                display_name: body.display_name,
              })
            : authenticateLocalUser(email, password);
        cookieHeaders = buildAuthSetCookieHeaders({
          localSessionToken: sessionToken,
        });
      } else {
        cookieHeaders = buildAuthSetCookieHeaders({
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
        });
      }
    } else {
      const { sessionToken } =
        action === "signup"
          ? registerLocalUser({
              email,
              password,
              display_name: body.display_name,
            })
          : authenticateLocalUser(email, password);
      cookieHeaders = buildAuthSetCookieHeaders({
        localSessionToken: sessionToken,
      });
    }
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error de autenticación";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  for (const header of cookieHeaders) res.headers.append("Set-Cookie", header);
  return res;
}
