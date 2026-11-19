import test from "node:test";
import assert from "node:assert/strict";
import { createAuthLoginHandler, type AuthLoginDependencies } from "../src/lib/auth-login.ts";

const email = "existing@example.invalid";
const existingPassword = "synthetic-original-password";

function provider(options: {
  duplicate?: boolean;
  createError?: string;
  missingCreatedUser?: boolean;
  loginError?: string;
  noSession?: boolean;
  withoutAdmin?: boolean;
  local?: boolean;
  throwOnCreate?: boolean;
} = {}) {
  const calls: string[] = [];
  let password = existingPassword;
  const session = { access_token: "synthetic-access", refresh_token: "synthetic-refresh" };
  const auth = {
    admin: {
      async createUser() {
        calls.push("createUser");
        if (options.throwOnCreate) throw new Error("synthetic internal provider details");
        return {
          data: { user: options.missingCreatedUser || options.duplicate || options.createError ? null : { id: "synthetic-user" } },
          error: options.duplicate ? { message: "User already registered" } : options.createError ? { message: options.createError } : null,
        };
      },
      async listUsers() {
        calls.push("listUsers");
        return { data: { users: [{ id: "synthetic-existing", email, user_metadata: {} }] }, error: null };
      },
      async updateUserById(_id: string, changes: { password?: string }) {
        calls.push("updateUserById");
        if (changes.password) password = changes.password;
        return { data: { user: { id: "synthetic-existing" } }, error: null };
      },
    },
    async signInWithPassword(input: { password: string }) {
      calls.push("signInWithPassword");
      const error = options.loginError ? { message: options.loginError } : options.duplicate && input.password !== password ? { message: "Invalid credentials" } : null;
      return { data: { session: error || options.noSession ? null : session }, error };
    },
    async signUp() {
      calls.push("signUp");
      return { data: { session: options.noSession ? null : session }, error: null };
    },
  };
  const client = { auth } as unknown as NonNullable<AuthLoginDependencies["supabaseAnon"]>;
  const deps: AuthLoginDependencies = {
    isSupabaseConfigured: !options.local,
    supabaseAdmin: options.withoutAdmin ? null : client,
    supabaseAnon: client,
    DEFAULT_DEMO_EMAIL: "pilot@example.invalid",
    DEFAULT_DEMO_PASSWORD: "synthetic-pilot-password",
    DEFAULT_DEMO_PIN: "876543",
    authenticateLocalUser() { calls.push("localLogin"); return { sessionToken: "synthetic-local" }; },
    registerLocalUser() { calls.push("localSignup"); return { sessionToken: "synthetic-local" }; },
    buildAuthSetCookieHeaders() { calls.push("cookies"); return ["synthetic_session=test; HttpOnly; Path=/"]; },
  };
  return { handle: createAuthLoginHandler(deps), calls, password: () => password };
}

function request(action: "signup" | "login", password = "synthetic-supplied-password", accepted = true) {
  return new Request("https://app.example.invalid/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, action, display_name: "Synthetic", data_privacy_accepted: accepted }),
  });
}

test("signup duplicado no cambia contraseña, confirma cuenta ni emite sesión", async () => {
  const p = provider({ duplicate: true });
  const response = await p.handle(request("signup"));
  assert.equal(p.password(), existingPassword);
  assert.equal(response.status, 400);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.deepEqual(p.calls, ["createUser"]);
});

test("signup duplicado con contraseña correcta tampoco renombra ni muta la cuenta", async () => {
  const p = provider({ duplicate: true });
  const response = await p.handle(request("signup", existingPassword));
  assert.equal(response.status, 400);
  assert.deepEqual(p.calls, ["createUser"]);
});

test("login pendiente de confirmación no se auto-confirma con privilegios admin", async () => {
  const p = provider({ loginError: "Email not confirmed" });
  const response = await p.handle(request("login"));
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.deepEqual(p.calls, ["signInWithPassword"]);
});

test("signup nuevo conserva creación y login sin modificar otra identidad", async () => {
  const p = provider();
  const response = await p.handle(request("signup"));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  assert.ok(response.headers.get("set-cookie"));
  assert.deepEqual(p.calls, ["createUser", "signInWithPassword", "cookies"]);
});

test("login válido conserva la sesión del proveedor", async () => {
  const p = provider();
  const response = await p.handle(request("login"));
  assert.equal(response.status, 200);
  assert.deepEqual(p.calls, ["signInWithPassword", "cookies"]);
});

test("credenciales incorrectas no provocan mutaciones ni cookies", async () => {
  const p = provider({ loginError: "Invalid credentials" });
  const response = await p.handle(request("login"));
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.deepEqual(p.calls, ["signInWithPassword"]);
});

test("errores de creación se rechazan sin fallback ni enumeración en respuesta", async () => {
  const duplicate = provider({ duplicate: true });
  const failed = provider({ createError: "Internal provider failure" });
  const a = await duplicate.handle(request("signup"));
  const b = await failed.handle(request("signup"));
  assert.equal(a.status, b.status);
  assert.deepEqual(await a.json(), await b.json());
  assert.deepEqual(failed.calls, ["createUser"]);
});

test("respuesta de creación sin usuario no permite continuar", async () => {
  const p = provider({ missingCreatedUser: true });
  const response = await p.handle(request("signup"));
  assert.equal(response.status, 400);
  assert.deepEqual(p.calls, ["createUser"]);
});

test("consentimiento ausente bloquea signup antes de contactar proveedor", async () => {
  const p = provider();
  const response = await p.handle(request("signup", "synthetic", false));
  assert.equal(response.status, 400);
  assert.deepEqual(p.calls, []);
});

test("signup sin admin y sin sesión pide confirmación, nunca crea identidad local", async () => {
  const p = provider({ withoutAdmin: true, noSession: true });
  const response = await p.handle(request("signup"));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).needs_confirmation, true);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.deepEqual(p.calls, ["signUp"]);
});

test("login sin sesión válida no usa fallback local", async () => {
  const p = provider({ noSession: true });
  const response = await p.handle(request("login"));
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.deepEqual(p.calls, ["signInWithPassword"]);
});

test("fallo de login tras crear cuenta no reintenta signup ni crea usuario local", async () => {
  const p = provider({ loginError: "synthetic failure" });
  const response = await p.handle(request("signup"));
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.deepEqual(p.calls, ["createUser", "signInWithPassword"]);
});

test("signup sin admin con sesión conserva flujo del proveedor", async () => {
  const p = provider({ withoutAdmin: true });
  const response = await p.handle(request("signup"));
  assert.equal(response.status, 200);
  assert.deepEqual(p.calls, ["signUp", "cookies"]);
});

test("credenciales de piloto no aprovisionan cuentas por defecto", async () => {
  const p = provider({ loginError: "Invalid credentials" });
  const response = await p.handle(new Request("https://app.example.invalid/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "pilot@example.invalid", password: "synthetic-pilot-password" }),
  }));
  assert.equal(response.status, 401);
  assert.deepEqual(p.calls, ["signInWithPassword"]);
});

test("errores inesperados no filtran detalles ni crean sesión", async () => {
  const p = provider({ throwOnCreate: true });
  const response = await p.handle(request("signup"));
  assert.equal(response.status, 401);
  assert.doesNotMatch(JSON.stringify(await response.json()), /synthetic internal/);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.deepEqual(p.calls, ["createUser"]);
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
    const response = await p.handle(new Request("https://app.example.invalid/api/auth/login", { method: "POST", body }));
    assert.equal(response.status, 400);
    assert.deepEqual(p.calls, []);
  }
});
