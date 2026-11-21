import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  getSingleUserAccessConfig,
  isAuthorizedSupabaseUserId,
  isPublicSignupAllowed,
} from "../src/lib/single-user-guard.ts";
import {
  createAuthLoginHandler,
  createInMemoryAuthRateLimiter,
  type AuthLoginDependencies,
} from "../src/lib/auth-login.ts";
import {
  buildSafeWidgetSummaryPayload,
  PENDING_AUTHENTICATED_WIDGET_NOTICE,
} from "../src/lib/widget-summary.ts";

const OWNER_UUID = "11111111-1111-4111-8111-111111111111";
const INTRUDER_UUID = "22222222-2222-4222-8222-222222222222";

function makePrivateHandler(signedInUserId: string, env: { OAKHAVEN_OWNER_USER_ID?: string; OAKHAVEN_PUBLIC_SIGNUP_ENABLED?: string }) {
  const calls: string[] = [];
  const auth = {
    admin: {
      async createUser() {
        calls.push("admin.createUser");
        return { data: { user: { id: "never" } }, error: null };
      },
    },
    async signInWithPassword() {
      calls.push("signInWithPassword");
      return {
        data: {
          user: { id: signedInUserId },
          session: {
            access_token: "tok-access",
            refresh_token: "tok-refresh",
            user: { id: signedInUserId },
          },
        },
        error: null,
      };
    },
    async signUp() {
      calls.push("signUp");
      return { data: { session: null }, error: null };
    },
  };
  const client = { auth } as unknown as NonNullable<AuthLoginDependencies["supabaseAnon"]>;
  const deps: AuthLoginDependencies = {
    isSupabaseConfigured: true,
    supabaseAdmin: client,
    supabaseAnon: client,
    allowDemoBootstrap: false,
    DEFAULT_DEMO_EMAIL: "pilot@example.invalid",
    DEFAULT_DEMO_PASSWORD: "synthetic-pilot-password-99",
    DEFAULT_DEMO_PIN: "876543",
    authenticateLocalUser() {
      calls.push("localLogin");
      return { sessionToken: "local" };
    },
    registerLocalUser() {
      calls.push("localSignup");
      return { sessionToken: "local" };
    },
    buildAuthSetCookieHeaders() {
      calls.push("cookies");
      return ["sb_session=ok; HttpOnly; Path=/"];
    },
    singleUserEnv: env,
    rateLimiter: createInMemoryAuthRateLimiter({ maxAttempts: 10 }),
  };
  return { handle: createAuthLoginHandler(deps), calls };
}

describe("OAKHAVEN RELEASE 3.3 — PRIVATE SINGLE-USER MODE", () => {
  test("1. Configuración single-user cierra registro público automáticamente cuando OAKHAVEN_OWNER_USER_ID está definido", () => {
    const cfg = getSingleUserAccessConfig({ OAKHAVEN_OWNER_USER_ID: OWNER_UUID });
    assert.equal(cfg.privateMode, true);
    assert.equal(cfg.ownerUserId, OWNER_UUID);
    assert.equal(cfg.publicSignupEnabled, false);
    assert.equal(isPublicSignupAllowed({ OAKHAVEN_OWNER_USER_ID: OWNER_UUID }), false);
    assert.equal(isAuthorizedSupabaseUserId(OWNER_UUID, { OAKHAVEN_OWNER_USER_ID: OWNER_UUID }), true);
    assert.equal(isAuthorizedSupabaseUserId(INTRUDER_UUID, { OAKHAVEN_OWNER_USER_ID: OWNER_UUID }), false);
    assert.equal(isAuthorizedSupabaseUserId(null, { OAKHAVEN_OWNER_USER_ID: OWNER_UUID }), false);
  });

  test("2. Única cuenta propietaria autorizada puede iniciar sesión y recibir cookies", async () => {
    const { handle, calls } = makePrivateHandler(OWNER_UUID, {
      OAKHAVEN_OWNER_USER_ID: OWNER_UUID,
      OAKHAVEN_PUBLIC_SIGNUP_ENABLED: "false",
    });

    const res = await handle(
      new Request("https://app.example.invalid/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          email: "owner@example.invalid",
          password: "OwnerStrongPassword2026",
        }),
      })
    );
    assert.equal(res.status, 200);
    assert.ok(res.headers.get("set-cookie"));
    assert.deepEqual(calls, ["signInWithPassword", "cookies"]);
  });

  test("3. Cualquier segunda identidad recibe HTTP 403 OWNER_ONLY_ACCESS y cero cookies", async () => {
    const { handle, calls } = makePrivateHandler(INTRUDER_UUID, {
      OAKHAVEN_OWNER_USER_ID: OWNER_UUID,
      OAKHAVEN_PUBLIC_SIGNUP_ENABLED: "false",
    });

    const res = await handle(
      new Request("https://app.example.invalid/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          email: "other@example.invalid",
          password: "OtherStrongPassword2026",
        }),
      })
    );
    const body = await res.json();
    assert.equal(res.status, 403);
    assert.equal(body.code, "OWNER_ONLY_ACCESS");
    assert.equal(res.headers.get("set-cookie"), null);
    assert.deepEqual(calls, ["signInWithPassword"]);
  });

  test("4. Registro público devuelve HTTP 403 PUBLIC_SIGNUP_DISABLED cuando está cerrado (sin contactar Supabase)", async () => {
    const { handle, calls } = makePrivateHandler(INTRUDER_UUID, {
      OAKHAVEN_OWNER_USER_ID: OWNER_UUID,
      OAKHAVEN_PUBLIC_SIGNUP_ENABLED: "false",
    });

    const res = await handle(
      new Request("https://app.example.invalid/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "signup",
          email: "newuser@example.invalid",
          password: "NewStrongPassword2026",
          data_privacy_accepted: true,
        }),
      })
    );
    const body = await res.json();
    assert.equal(res.status, 403);
    assert.equal(body.code, "PUBLIC_SIGNUP_DISABLED");
    assert.deepEqual(calls, []);
  });

  test("5. Defensa en profundidad: auth.ts aplica isAuthorizedSupabaseUserId en sesiones, API tokens y legacy secret; sin fallback a demoStore", () => {
    const authSrc = fs.readFileSync("src/lib/auth.ts", "utf8");
    const loginPageSrc = fs.readFileSync("src/app/login/page.tsx", "utf8");
    const rootPageSrc = fs.readFileSync("src/app/page.tsx", "utf8");
    const widgetSummarySrc = fs.readFileSync("src/app/api/shortcuts/widget-summary/route.ts", "utf8");

    const resolveAuthFn = authSrc.slice(authSrc.indexOf("export async function resolveAuthenticatedUser"));
    assert.match(resolveAuthFn, /isAuthorizedSupabaseUserId\(sbUser\.id\)/);
    assert.ok(
      resolveAuthFn.indexOf("isAuthorizedSupabaseUserId(sbUser.id)") <
        resolveAuthFn.indexOf('.from("profiles")'),
      "isAuthorizedSupabaseUserId debe evaluarse ANTES de consultar public.profiles"
    );
    assert.match(authSrc, /isAuthorizedSupabaseUserId\(String\(tokenRow\.user_id\)\)/);
    assert.match(authSrc, /isAuthorizedSupabaseUserId\(String\(resolvedUid\)\)/);
    assert.match(authSrc, /isAuthorizedSupabaseUserId\(String\(legacyOwnerId\)\)/);
    assert.match(loginPageSrc, /useState\(false\)/);
    assert.match(loginPageSrc, /Registro público cerrado/);
    assert.match(loginPageSrc, /hashType === "invite"/);
    assert.match(rootPageSrc, /type=invite/);
    assert.ok(!loginPageSrc.includes("player1@rpg-life-engine.local"));
    assert.ok(!widgetSummarySrc.includes("demoStore"), "widget-summary no debe hacer fallback a demoStore");
    assert.match(widgetSummarySrc, /if \(!authCtx\.ok\)\s*\{\s*return authCtx\.response;/);
  });

  test("6. FAIL-CLOSED: en producción sin OAKHAVEN_OWNER_USER_ID (o UUID inválido), bloquea login, update_password, APIs y registro público", async () => {
    for (const badEnv of [
      { NODE_ENV: "production" },
      { NODE_ENV: "production", OAKHAVEN_OWNER_USER_ID: "" },
      { NODE_ENV: "production", OAKHAVEN_OWNER_USER_ID: "not-a-valid-uuid" },
      { OAKHAVEN_OWNER_USER_ID: "invalid-uuid-in-dev" },
    ]) {
      const cfg = getSingleUserAccessConfig(badEnv);
      assert.equal(cfg.ownerConfigInvalid, true);
      assert.equal(cfg.publicSignupEnabled, false);
      assert.equal(isAuthorizedSupabaseUserId(OWNER_UUID, badEnv), false);
      assert.equal(isPublicSignupAllowed(badEnv), false);

      const { handle, calls } = makePrivateHandler(OWNER_UUID, badEnv);
      const loginRes = await handle(
        new Request("https://app.example.invalid/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "login",
            email: "owner@example.invalid",
            password: "OwnerStrongPassword2026",
          }),
        })
      );
      const loginBody = await loginRes.json();
      assert.equal(loginRes.status, 503);
      assert.equal(loginBody.code, "OWNER_NOT_CONFIGURED");
      assert.equal(loginRes.headers.get("set-cookie"), null);

      const resetRes = await handle(
        new Request("https://app.example.invalid/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_password",
            recovery_access_token: "invite-token-demo",
            password: "OwnerStrongPassword2026",
          }),
        })
      );
      const resetBody = await resetRes.json();
      assert.equal(resetRes.status, 503);
      assert.equal(resetBody.code, "OWNER_NOT_CONFIGURED");
      assert.equal(resetRes.headers.get("set-cookie"), null);
      assert.deepEqual(calls, []);
    }
  });

  test("7. Token de invitación o recuperación perteneciente a otro usuario recibe HTTP 403 OWNER_ONLY_ACCESS y cero cookies", async () => {
    const client = {
      auth: {
        admin: { async createUser() { return { data: { user: null }, error: null }; } },
        async signInWithPassword() { return { data: { session: null }, error: null }; },
        async signUp() { return { data: { session: null }, error: null }; },
      },
    } as unknown as NonNullable<AuthLoginDependencies["supabaseAnon"]>;

    const handle = createAuthLoginHandler({
      isSupabaseConfigured: true,
      supabaseAdmin: client,
      supabaseAnon: client,
      allowDemoBootstrap: false,
      DEFAULT_DEMO_EMAIL: "pilot@example.invalid",
      DEFAULT_DEMO_PASSWORD: "synthetic-pilot-password-99",
      DEFAULT_DEMO_PIN: "876543",
      authenticateLocalUser: () => ({ sessionToken: "local" }),
      registerLocalUser: () => ({ sessionToken: "local" }),
      buildAuthSetCookieHeaders: () => ["sb_session=ok; HttpOnly; Path=/"],
      singleUserEnv: {
        NODE_ENV: "production",
        OAKHAVEN_OWNER_USER_ID: OWNER_UUID,
        OAKHAVEN_PUBLIC_SIGNUP_ENABLED: "false",
      },
      rateLimiter: createInMemoryAuthRateLimiter({ maxAttempts: 10 }),
      async updatePasswordWithRecoveryToken() {
        return { ok: false, status: 403, error: "owner_only_access" };
      },
    });

    const res = await handle(
      new Request("https://app.example.invalid/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_password",
          recovery_access_token: "intruder-recovery-token",
          password: "IntruderStrongPassword2026",
        }),
      })
    );
    const body = await res.json();
    assert.equal(res.status, 403);
    assert.equal(body.code, "OWNER_ONLY_ACCESS");
    assert.equal(res.headers.get("set-cookie"), null);
  });

  test("8. Widget iOS (Hallazgo B): exige autenticación (401/403), sin snippet anónimo ejecutable ni exposición financiera o secretos", () => {
    const widgetRouteSrc = fs.readFileSync("src/app/api/shortcuts/widget-summary/route.ts", "utf8");
    assert.match(widgetRouteSrc, /requireShortcutUser\(req\)/);
    assert.match(widgetRouteSrc, /if \(!authCtx\.ok\)\s*\{\s*return authCtx\.response;/);
    assert.match(widgetRouteSrc, /Cache-Control":\s*"no-store"/);
    assert.ok(!widgetRouteSrc.includes("demoStore"));
    assert.ok(!widgetRouteSrc.includes("new Request("));
    assert.ok(!widgetRouteSrc.includes("loadJSON("));

    const payload = buildSafeWidgetSummaryPayload({
      player_level: 7,
      current_streak_days: 12,
      streak_multiplier: 1.5,
      aegis_shields: 2,
      readingBooks: [{ id: "b1" }],
      knittingProjects: [],
      skillSessions: [{ id: "s1" }, { id: "s2" }],
    });

    assert.equal(payload.widget_integration.status, "pending_authenticated_integration");
    assert.equal(payload.widget_integration.auth_required, true);
    assert.equal(payload.widget_integration.financial_data_exposed, false);
    assert.equal(payload.ios_scriptable_widget_code, PENDING_AUTHENTICATED_WIDGET_NOTICE);

    // No debe exponer campos financieros ni secretos/UUIDs ni llamadas anónimas ejecutables
    const serialized = JSON.stringify(payload);
    assert.ok(!("wallet_gp" in payload));
    assert.ok(!("vault_remaining_gp" in payload));
    assert.ok(!("active_boss" in payload));
    for (const forbidden of ["new Request(", "loadJSON(", "TU-DOMINIO", "wallet_gp", "vault_remaining", "active_boss", "rpg_usr_1", OWNER_UUID]) {
      assert.ok(!serialized.includes(forbidden), `widget-summary no debe contener ${forbidden}`);
    }
    // Solo comentarios explicativos (ninguna sentencia JS ejecutable fuera de comentarios)
    const nonCommentLines = payload.ios_scriptable_widget_code
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("//"));
    assert.deepEqual(nonCommentLines, []);
  });

  test("9. Ninguna ruta en src/app/api/** reintroduce fallback a demoStore", () => {
    const apiRoot = path.join("src", "app", "api");
    const routeFiles: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) routeFiles.push(full);
      }
    };
    walk(apiRoot);
    assert.ok(routeFiles.length > 10, "Debe auditar todas las rutas de src/app/api");
    for (const file of routeFiles) {
      const content = fs.readFileSync(file, "utf8");
      assert.ok(!content.includes("demoStore"), `${file} no debe importar ni hacer fallback a demoStore`);
    }
  });
});
