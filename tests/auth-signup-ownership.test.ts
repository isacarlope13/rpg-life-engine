import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createAuthLoginHandler,
  createInMemoryAuthRateLimiter,
  validateSignupPassword,
  type AuthLoginDependencies,
} from "../src/lib/auth-login.ts";

const email = "existing@example.invalid";
const strongPassword = "OakHaven2026SecurePass";

function provider(options: {
  signupError?: string;
  loginError?: string;
  noSession?: boolean;
  local?: boolean;
  throwOnSignup?: boolean;
  maxAttempts?: number;
} = {}) {
  const calls: string[] = [];
  const session = { access_token: "synthetic-access", refresh_token: "synthetic-refresh" };
  const auth = {
    admin: {
      async createUser() {
        calls.push("admin.createUser");
        return { data: { user: { id: "should-never-be-called" } }, error: null };
      },
    },
    async signInWithPassword() {
      calls.push("signInWithPassword");
      const error = options.loginError ? { message: options.loginError } : null;
      return { data: { session: error || options.noSession ? null : session }, error };
    },
    async signUp() {
      calls.push("signUp");
      if (options.throwOnSignup) throw new Error("synthetic internal provider details");
      const error = options.signupError ? { message: options.signupError } : null;
      return { data: { session: error || options.noSession ? null : session }, error };
    },
    async resetPasswordForEmail() {
      calls.push("resetPasswordForEmail");
      return { data: {}, error: null };
    },
  };
  const client = { auth } as unknown as NonNullable<AuthLoginDependencies["supabaseAnon"]>;
  const deps: AuthLoginDependencies = {
    // These tests intentionally exercise the explicit non-production signup mode.
    singleUserEnv: { NODE_ENV: "test", OAKHAVEN_PUBLIC_SIGNUP_ENABLED: "true" },
    isSupabaseConfigured: !options.local,
    supabaseAdmin: client,
    supabaseAnon: client,
    DEFAULT_DEMO_EMAIL: "pilot@example.invalid",
    DEFAULT_DEMO_PASSWORD: "synthetic-pilot-password-99",
    DEFAULT_DEMO_PIN: "876543",
    authenticateLocalUser() {
      calls.push("localLogin");
      return { sessionToken: "synthetic-local" };
    },
    registerLocalUser() {
      calls.push("localSignup");
      return { sessionToken: "synthetic-local" };
    },
    buildAuthSetCookieHeaders() {
      calls.push("cookies");
      return ["synthetic_session=test; HttpOnly; Path=/"];
    },
    async updatePasswordWithRecoveryToken({ accessToken }) {
      calls.push("updatePasswordWithRecoveryToken");
      return { ok: accessToken === "valid-recovery-token" };
    },
    rateLimiter: createInMemoryAuthRateLimiter({ maxAttempts: options.maxAttempts ?? 8 }),
  };
  return { handle: createAuthLoginHandler(deps), calls };
}

function request(
  action: "signup" | "login" | "recover",
  password = strongPassword,
  accepted = true,
  customEmail = email
) {
  return new Request("https://app.example.invalid/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "198.51.100.10" },
    body: JSON.stringify({
      email: customEmail,
      password: action === "recover" ? undefined : password,
      action,
      display_name: "Synthetic",
      data_privacy_accepted: accepted,
    }),
  });
}

test("HITO 1: registro público NUNCA usa admin.createUser ni email_confirm: true; exige confirmación real", async () => {
  const p = provider({ noSession: true });
  const response = await p.handle(request("signup"));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.needs_confirmation, true);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.deepEqual(p.calls, ["signUp"]);
  assert.ok(!p.calls.includes("admin.createUser"));
});

test("HITO 1: PIN numérico débil (4-8 dígitos) es rechazado en signup antes de contactar Supabase", async () => {
  assert.equal(validateSignupPassword("202611").valid, false);
  assert.equal(validateSignupPassword("1234567890").valid, false);
  assert.equal(validateSignupPassword("short1a").valid, false);
  assert.equal(validateSignupPassword(strongPassword).valid, true);

  const p = provider();
  const response = await p.handle(request("signup", "202611"));
  assert.equal(response.status, 400);
  assert.deepEqual(p.calls, []);
});

test("HITO 1: recuperación de contraseña usa resetPasswordForEmail y responde 200 anti-enumeración", async () => {
  const p = provider();
  const response = await p.handle(request("recover"));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.recovery_sent, true);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.deepEqual(p.calls, ["resetPasswordForEmail"]);
});

test("HITO 1: protección contra fuerza bruta bloquea con HTTP 429 tras exceder intentos", async () => {
  const p = provider({ loginError: "Invalid credentials", maxAttempts: 3 });
  for (let i = 0; i < 3; i++) {
    const r = await p.handle(request("login", "wrong-pass-123"));
    assert.equal(r.status, 401);
  }
  const blocked = await p.handle(request("login", "wrong-pass-123"));
  assert.equal(blocked.status, 429);
  assert.ok(blocked.headers.get("retry-after"));
});

test("login pendiente de confirmación no se auto-confirma con privilegios admin", async () => {
  const p = provider({ loginError: "Email not confirmed" });
  const response = await p.handle(request("login"));
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.deepEqual(p.calls, ["signInWithPassword"]);
});

test("errores de signup se rechazan sin fallback ni enumeración en respuesta", async () => {
  const duplicate = provider({ signupError: "User already registered" });
  const failed = provider({ signupError: "Internal provider failure" });
  const a = await duplicate.handle(request("signup"));
  const b = await failed.handle(request("signup"));
  assert.equal(a.status, b.status);
  assert.deepEqual(await a.json(), await b.json());
});

test("consentimiento ausente bloquea signup antes de contactar proveedor", async () => {
  const p = provider();
  const response = await p.handle(request("signup", strongPassword, false));
  assert.equal(response.status, 400);
  assert.deepEqual(p.calls, []);
});

test("login válido conserva la sesión del proveedor (compatible con cuentas existentes)", async () => {
  const p = provider();
  const response = await p.handle(request("login", "202611"));
  assert.equal(response.status, 200);
  assert.deepEqual(p.calls, ["signInWithPassword", "cookies"]);
});

test("errores inesperados no filtran detalles internos ni crean sesión", async () => {
  const p = provider({ throwOnSignup: true });
  const response = await p.handle(request("signup"));
  assert.equal(response.status, 401);
  assert.doesNotMatch(JSON.stringify(await response.json()), /synthetic internal/);
  assert.equal(response.headers.get("set-cookie"), null);
});

test("modo local explícito conserva registro y acceso aislados", async () => {
  for (const action of ["signup", "login"] as const) {
    const p = provider({ local: true });
    const response = await p.handle(request(action));
    assert.equal(response.status, 200);
    assert.deepEqual(p.calls, [action === "signup" ? "localSignup" : "localLogin", "cookies"]);
  }
});

test("JSON malformado o tipos inválidos se rechazan sin contactar proveedor", async () => {
  for (const body of ["null", "{", JSON.stringify({ email: 42, password: [] })]) {
    const p = provider();
    const response = await p.handle(
      new Request("https://app.example.invalid/api/auth/login", { method: "POST", body })
    );
    assert.equal(response.status, 400);
    assert.deepEqual(p.calls, []);
  }
});

test("RELEASE 3.3: cambio efectivo de contraseña tras recuperación exige token válido y contraseña robusta (sin service_role)", async () => {
  const p = provider();

  // Sin token -> 400
  const missingToken = await p.handle(
    new Request("https://app.example.invalid/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_password", password: strongPassword }),
    })
  );
  assert.equal(missingToken.status, 400);

  // Contraseña débil -> 400
  const weakPwd = await p.handle(
    new Request("https://app.example.invalid/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_password",
        recovery_access_token: "valid-recovery-token",
        password: "202611",
      }),
    })
  );
  assert.equal(weakPwd.status, 400);

  // Token válido + contraseña robusta -> 200 password_updated, sin service_role ni cookies automáticas
  const okRes = await p.handle(
    new Request("https://app.example.invalid/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_password",
        recovery_access_token: "valid-recovery-token",
        password: "NewSecurePassword2026",
      }),
    })
  );
  const okBody = await okRes.json();
  assert.equal(okRes.status, 200);
  assert.equal(okBody.password_updated, true);
  assert.equal(okRes.headers.get("set-cookie"), null);
  assert.deepEqual(p.calls, ["updatePasswordWithRecoveryToken"]);

  // Verificar que /login limpia el hash de la URL y tiene pantalla dedicada de cambio de contraseña
  const loginSrc = fs.readFileSync("src/app/login/page.tsx", "utf8");
  assert.match(loginSrc, /window\.history\.replaceState\(null, "", "\/login\?mode=reset"\)/);
  assert.match(loginSrc, /Guardar Nueva Contraseña/);
});
