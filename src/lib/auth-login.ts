import type { SupabaseClient } from "@supabase/supabase-js";

export interface RateLimitCheckResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export interface AuthRateLimiter {
  check: (key: string) => RateLimitCheckResult;
  recordFailure: (key: string) => void;
  reset: (key: string) => void;
}

export function createInMemoryAuthRateLimiter(options?: {
  maxAttempts?: number;
  windowMs?: number;
}): AuthRateLimiter {
  const maxAttempts = options?.maxAttempts ?? 8;
  const windowMs = options?.windowMs ?? 15 * 60 * 1000;
  const buckets = new Map<string, number[]>();

  const prune = (key: string, now: number): number[] => {
    const existing = buckets.get(key) || [];
    const fresh = existing.filter((ts) => now - ts < windowMs);
    if (fresh.length === 0) buckets.delete(key);
    else buckets.set(key, fresh);
    return fresh;
  };

  return {
    check(key: string): RateLimitCheckResult {
      const now = Date.now();
      const fresh = prune(key, now);
      if (fresh.length >= maxAttempts) {
        const oldest = fresh[0];
        const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
        return { allowed: false, retryAfterSeconds };
      }
      return { allowed: true };
    },
    recordFailure(key: string): void {
      const now = Date.now();
      const fresh = prune(key, now);
      fresh.push(now);
      buckets.set(key, fresh);
    },
    reset(key: string): void {
      buckets.delete(key);
    },
  };
}

export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
}

const WEAK_PASSWORDS = new Set([
  "1234567890",
  "password123",
  "contraseña1",
  "qwerty1234",
  "oakhaven123",
  "admin12345",
]);

/**
 * Política de contraseña robusta para cuentas nuevas (HITO 1).
 * Rechaza PINs numéricos débiles (4-8 dígitos) como credencial principal.
 */
export function validateSignupPassword(password: string): PasswordValidationResult {
  if (typeof password !== "string" || password.length < 10) {
    return {
      valid: false,
      error: "La contraseña debe tener al menos 10 caracteres (no se aceptan PINs cortos como credencial principal).",
    };
  }
  if (password.length > 128) {
    return { valid: false, error: "La contraseña excede la longitud máxima permitida (128 caracteres)." };
  }
  if (/^\d+$/.test(password)) {
    return {
      valid: false,
      error: "La contraseña no puede ser únicamente numérica; incluye letras y números.",
    };
  }
  if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(password) || !/\d/.test(password)) {
    return {
      valid: false,
      error: "La contraseña debe combinar al menos una letra y un número.",
    };
  }
  if (WEAK_PASSWORDS.has(password.toLowerCase())) {
    return {
      valid: false,
      error: "Elige una contraseña menos predecible.",
    };
  }
  return { valid: true };
}

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
  updatePasswordWithRecoveryToken?: (params: {
    accessToken: string;
    newPassword: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  rateLimiter?: AuthRateLimiter;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getClientBucketKey(req: Request, email: string): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  return `${forwarded}::${email || "anon"}`;
}

/** The route supplies real dependencies; regressions use a provider with no network. */
export function createAuthLoginHandler(deps: AuthLoginDependencies) {
  const {
    isSupabaseConfigured, supabaseAdmin, supabaseAnon, allowDemoBootstrap = false,
    DEFAULT_DEMO_EMAIL, DEFAULT_DEMO_PASSWORD, DEFAULT_DEMO_PIN,
    authenticateLocalUser, registerLocalUser, buildAuthSetCookieHeaders,
    updatePasswordWithRecoveryToken,
    rateLimiter = createInMemoryAuthRateLimiter(),
  } = deps;

  return async function login(req: Request): Promise<Response> {
    const parsed: unknown = await req.json().catch(() => null);
    const body = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const rawPassword = typeof body.password === "string" ? body.password : "";
    const recoveryAccessToken =
      typeof body.recovery_access_token === "string" ? body.recovery_access_token.trim() : "";
    const displayName = typeof body.display_name === "string" ? body.display_name.trim().slice(0, 60) : undefined;
    const action =
      body.action === "signup"
        ? "signup"
        : body.action === "recover"
        ? "recover"
        : body.action === "update_password"
        ? "update_password"
        : "login";

    // Flujo de cambio efectivo de contraseña tras abrir enlace de recuperación (sin service_role)
    if (action === "update_password") {
      const bucketKey = getClientBucketKey(req, "recovery_reset");
      const rateCheck = rateLimiter.check(bucketKey);
      if (!rateCheck.allowed) {
        return Response.json(
          { error: "Demasiados intentos en poco tiempo. Espera unos minutos antes de volver a intentarlo." },
          { status: 429, headers: { "Retry-After": String(rateCheck.retryAfterSeconds ?? 60) } }
        );
      }
      if (!recoveryAccessToken) {
        return Response.json(
          { error: "El enlace de recuperación es inválido o expiró. Solicita uno nuevo." },
          { status: 400 }
        );
      }
      const pwdCheck = validateSignupPassword(rawPassword);
      if (!pwdCheck.valid) {
        return Response.json({ error: pwdCheck.error }, { status: 400 });
      }
      if (!isSupabaseConfigured || !updatePasswordWithRecoveryToken) {
        return Response.json(
          { error: "El servicio de recuperación de contraseña no está disponible en modo local." },
          { status: 503 }
        );
      }
      try {
        const result = await updatePasswordWithRecoveryToken({
          accessToken: recoveryAccessToken,
          newPassword: rawPassword,
        });
        if (!result.ok) {
          rateLimiter.recordFailure(bucketKey);
          return Response.json(
            { error: "No se pudo actualizar la contraseña. El enlace pudo haber caducado; solicita uno nuevo." },
            { status: 401 }
          );
        }
        rateLimiter.reset(bucketKey);
        return Response.json({
          ok: true,
          password_updated: true,
          message: "Contraseña actualizada correctamente. Ahora inicia sesión con tu nueva contraseña.",
        });
      } catch {
        rateLimiter.recordFailure(bucketKey);
        return Response.json(
          { error: "No se pudo completar el cambio de contraseña. Solicita un nuevo enlace." },
          { status: 401 }
        );
      }
    }

    if (!email || !EMAIL_PATTERN.test(email)) {
      return Response.json({ error: "Ingresa un correo electrónico válido." }, { status: 400 });
    }

    const bucketKey = getClientBucketKey(req, email);
    const rateCheck = rateLimiter.check(bucketKey);
    if (!rateCheck.allowed) {
      return Response.json(
        { error: "Demasiados intentos en poco tiempo. Espera unos minutos antes de volver a intentarlo." },
        {
          status: 429,
          headers: { "Retry-After": String(rateCheck.retryAfterSeconds ?? 60) },
        }
      );
    }

    // Flujo de recuperación de contraseña (anti-enumeración: siempre responde 200 genérico)
    if (action === "recover") {
      rateLimiter.recordFailure(bucketKey);
      try {
        if (isSupabaseConfigured && supabaseAnon && typeof supabaseAnon.auth.resetPasswordForEmail === "function") {
          const origin = req.headers.get("origin") || new URL(req.url).origin;
          await supabaseAnon.auth.resetPasswordForEmail(email, {
            redirectTo: `${origin}/login?mode=reset`,
          });
        }
      } catch {
        // Nunca filtrar si el correo existe o falló el proveedor
      }
      return Response.json({
        ok: true,
        recovery_sent: true,
        message: "Si existe una cuenta asociada a ese correo, recibirás instrucciones para recuperar el acceso.",
      });
    }

    if (!rawPassword) {
      return Response.json({ error: "Correo y contraseña de acceso son obligatorios." }, { status: 400 });
    }

    if (action === "signup") {
      if (body.data_privacy_accepted !== true) {
        return Response.json(
          {
            error: "Debes aceptar expresamente la Política de Tratamiento de Datos Personales para crear tu cuenta.",
          },
          { status: 400 }
        );
      }

      const pwdCheck = validateSignupPassword(rawPassword);
      if (!pwdCheck.valid) {
        return Response.json({ error: pwdCheck.error }, { status: 400 });
      }
    }

    // Pilot credentials and provisioning are restricted strictly to explicit non-production development mode.
    const isMasterAccount =
      allowDemoBootstrap &&
      email === DEFAULT_DEMO_EMAIL &&
      (rawPassword === DEFAULT_DEMO_PASSWORD || rawPassword === DEFAULT_DEMO_PIN);
    const password = isMasterAccount ? DEFAULT_DEMO_PASSWORD : rawPassword;

    function success(params: Parameters<AuthLoginDependencies["buildAuthSetCookieHeaders"]>[0]) {
      rateLimiter.reset(bucketKey);
      const res = Response.json({ ok: true });
      for (const header of buildAuthSetCookieHeaders(params)) res.headers.append("Set-Cookie", header);
      return res;
    }

    try {
      if (isSupabaseConfigured) {
        if (!supabaseAnon) {
          return Response.json({ error: "El servicio de acceso no está disponible." }, { status: 503 });
        }

        // HITO 1 (P0): El registro público NUNCA usa service_role ni email_confirm: true.
        // Siempre usa supabaseAnon.auth.signUp para verificar la propiedad real del correo.
        if (action === "signup") {
          const origin = req.headers.get("origin") || new URL(req.url).origin;
          const signupResult = await supabaseAnon.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${origin}/login?mode=login`,
              data: {
                display_name: displayName || email.split("@")[0],
                data_privacy_accepted: true,
                privacy_accepted_at: new Date().toISOString(),
                privacy_version: "3.4",
              },
            },
          });

          if (signupResult.error) {
            rateLimiter.recordFailure(bucketKey);
            // Anti-enumeración: mismo mensaje neutro para duplicados o errores del proveedor
            return Response.json(
              {
                error:
                  "No se pudo completar el registro. Si ya tienes una cuenta, inicia sesión o usa la recuperación de acceso.",
              },
              { status: 400 }
            );
          }

          if (!signupResult.data.session) {
            // Caso estándar seguro con verificación de correo obligatoria
            return Response.json({
              ok: true,
              needs_confirmation: true,
              message:
                "Revisa tu correo electrónico para confirmar tu cuenta antes de iniciar sesión. Si ya estabas registrado, inicia sesión o recupera tu contraseña.",
            });
          }

          return success({
            accessToken: signupResult.data.session.access_token,
            refreshToken: signupResult.data.session.refresh_token,
          });
        }

        // Inicio de sesión estándar (compatible con cuentas existentes)
        let result = await supabaseAnon.auth.signInWithPassword({ email, password });

        // Development-only pilot bootstrap; never enabled by the production route.
        if (result.error && allowDemoBootstrap && isMasterAccount) {
          if (supabaseAdmin) {
            await supabaseAdmin.auth.admin.createUser({
              email: DEFAULT_DEMO_EMAIL,
              password: DEFAULT_DEMO_PASSWORD,
              email_confirm: true,
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
          rateLimiter.recordFailure(bucketKey);
          return Response.json(
            {
              error: "No se pudo iniciar sesión. Revisa tus credenciales y la confirmación de tu correo.",
            },
            { status: 401 }
          );
        }

        if (!result.data.session) {
          rateLimiter.recordFailure(bucketKey);
          return Response.json(
            { error: "No se pudo verificar la sesión. Intenta iniciar sesión de nuevo." },
            { status: 401 }
          );
        }

        return success({
          accessToken: result.data.session.access_token,
          refreshToken: result.data.session.refresh_token,
        });
      }

      const { sessionToken } =
        action === "signup"
          ? registerLocalUser({ email, password, display_name: displayName })
          : authenticateLocalUser(email, password);
      return success({ localSessionToken: sessionToken });
    } catch {
      rateLimiter.recordFailure(bucketKey);
      return Response.json(
        { error: "No se pudo completar el acceso. Inténtalo de nuevo." },
        { status: 401 }
      );
    }
  };
}
