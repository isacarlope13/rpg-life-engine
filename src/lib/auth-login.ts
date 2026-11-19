import type { SupabaseClient } from "@supabase/supabase-js";

export interface AuthLoginDependencies {
  isSupabaseConfigured: boolean;
  supabaseAdmin: Pick<SupabaseClient, "auth"> | null;
  supabaseAnon: Pick<SupabaseClient, "auth"> | null;
  allowDemoBootstrap?: boolean;
  DEFAULT_DEMO_EMAIL: string;
  DEFAULT_DEMO_PASSWORD: string;
  DEFAULT_DEMO_PIN: string;
  authenticateLocalUser: (email: string, password: string) => { sessionToken: string };
  registerLocalUser: (params: { email: string; password: string; display_name?: string }) => { sessionToken: string };
  buildAuthSetCookieHeaders: (params: {
    accessToken?: string;
    refreshToken?: string;
    localSessionToken?: string;
  }) => string[];
}

/** The route supplies real dependencies; regressions use a provider with no network. */
export function createAuthLoginHandler(deps: AuthLoginDependencies) {
  const {
    isSupabaseConfigured, supabaseAdmin, supabaseAnon, allowDemoBootstrap = false,
    DEFAULT_DEMO_EMAIL, DEFAULT_DEMO_PASSWORD, DEFAULT_DEMO_PIN,
    authenticateLocalUser, registerLocalUser, buildAuthSetCookieHeaders,
  } = deps;

  return async function login(req: Request): Promise<Response> {
    const parsed: unknown = await req.json().catch(() => null);
    const body = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const rawPassword = typeof body.password === "string" ? body.password : "";
    const displayName = typeof body.display_name === "string" ? body.display_name : undefined;
    const action = body.action === "signup" ? "signup" : "login";

    if (!email || !rawPassword) {
      return Response.json({ error: "Correo y PIN de acceso son obligatorios." }, { status: 400 });
    }
    if (action === "signup" && body.data_privacy_accepted !== true) {
      return Response.json({
        error: "Debes aceptar expresamente la Política de Tratamiento de Datos Personales para crear tu cuenta.",
      }, { status: 400 });
    }

    // Pilot credentials and provisioning are restricted to explicit development mode.
    const isMasterAccount = allowDemoBootstrap && email === DEFAULT_DEMO_EMAIL &&
      (rawPassword === DEFAULT_DEMO_PASSWORD || rawPassword === DEFAULT_DEMO_PIN || rawPassword === "123456");
    const password = isMasterAccount ? DEFAULT_DEMO_PASSWORD : rawPassword;

    function success(params: Parameters<AuthLoginDependencies["buildAuthSetCookieHeaders"]>[0]) {
      const res = Response.json({ ok: true });
      for (const header of buildAuthSetCookieHeaders(params)) res.headers.append("Set-Cookie", header);
      return res;
    }

    try {
      if (isSupabaseConfigured) {
        if (!supabaseAnon) {
          return Response.json({ error: "El servicio de acceso no está disponible." }, { status: 503 });
        }

        const adminSignup = action === "signup" && supabaseAdmin !== null;
        if (action === "signup" && supabaseAdmin) {
          // Preserve immediate access for NEW users; never repair or update an existing identity here.
          const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
              display_name: displayName || email.split("@")[0],
              data_privacy_accepted: true,
              privacy_accepted_at: new Date().toISOString(),
              privacy_version: "3.4",
            },
          });
          if (error || !data?.user) {
            return Response.json({
              error: "No se pudo crear la cuenta. Si ya tienes una cuenta, inicia sesión o usa la recuperación de acceso.",
            }, { status: 400 });
          }
        }

        // New admin-created accounts sign in once. Existing accounts use password verification only.
        let result = action === "signup" && !adminSignup
          ? await supabaseAnon.auth.signUp({
              email, password, options: { data: { display_name: displayName || email.split("@")[0] } },
            })
          : await supabaseAnon.auth.signInWithPassword({ email, password });

        // Development-only pilot bootstrap; never enabled by the production route.
        if (result.error && allowDemoBootstrap && action === "login" && isMasterAccount) {
          if (supabaseAdmin) {
            await supabaseAdmin.auth.admin.createUser({
              email: DEFAULT_DEMO_EMAIL, password: DEFAULT_DEMO_PASSWORD, email_confirm: true,
              user_metadata: { display_name: "Player One (Piloto)" },
            });
            result = await supabaseAnon.auth.signInWithPassword({ email, password });
          }
          if (result.error) {
            const { sessionToken } = authenticateLocalUser(email, password);
            return success({ localSessionToken: sessionToken });
          }
        }

        if (result.error) {
          // Do not enumerate users or auto-confirm an existing account from an unauthenticated request.
          return Response.json({
            error: "No se pudo iniciar sesión. Revisa tus credenciales y la confirmación de tu correo.",
          }, { status: 401 });
        }
        if (!result.data.session) {
          if (action === "signup" && !adminSignup) {
            return Response.json({
              ok: true, needs_confirmation: true,
              message: "Revisa tu correo para confirmar el registro. Si ya tienes cuenta, inicia sesión o usa la recuperación de acceso.",
            });
          }
          // A missing remote session must not create a second local identity.
          return Response.json({ error: "No se pudo verificar la sesión. Intenta iniciar sesión de nuevo." }, { status: 401 });
        }
        return success({
          accessToken: result.data.session.access_token,
          refreshToken: result.data.session.refresh_token,
        });
      }

      const { sessionToken } = action === "signup"
        ? registerLocalUser({ email, password, display_name: displayName })
        : authenticateLocalUser(email, password);
      return success({ localSessionToken: sessionToken });
    } catch {
      return Response.json({ error: "No se pudo completar el acceso. Inténtalo de nuevo." }, { status: 401 });
    }
  };
}
