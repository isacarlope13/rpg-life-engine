import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
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

  test("5. Defensa en profundidad: auth.ts aplica isAuthorizedSupabaseUserId en sesiones y API tokens, sin puertas traseras", () => {
    const authSrc = fs.readFileSync("src/lib/auth.ts", "utf8");
    const loginPageSrc = fs.readFileSync("src/app/login/page.tsx", "utf8");
    assert.match(authSrc, /isAuthorizedSupabaseUserId\(sbUser\.id\)/);
    assert.match(authSrc, /isAuthorizedSupabaseUserId\(String\(tokenRow\.user_id\)\)/);
    assert.match(authSrc, /isAuthorizedSupabaseUserId\(String\(resolvedUid\)\)/);
    assert.match(loginPageSrc, /Registro público cerrado/);
    assert.ok(!loginPageSrc.includes("player1@rpg-life-engine.local"));
  });
});
