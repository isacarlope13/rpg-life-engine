import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { promisify } from "node:util";
import { prepareFiletBrowserFixture, runFiletBrowser } from "./browser/filet-native-browser.mjs";

// Explicit PostgreSQL loopback and a synthetic Auth/PostgREST shim.
// Invoke from a disposable application copy without environment files.
const dir = process.env.FILET_PG_TEST_ROOT;
assert.ok(dir && process.env.PGPASSWORD, "Temporary fixture directory and password required");
const psql = join(dir, "pgsql/bin/psql.exe");
const exec = promisify(execFile);
const connection = ["-X", "-qAt", "-h", "127.0.0.1", "-p", "54387", "-U", "filet_qa", "-d", "postgres", "-v", "ON_ERROR_STOP=1"];
const run = async (...args) => (await exec(psql, [...connection, ...args], { windowsHide: true })).stdout.trim();
async function sql(statement) {
  // The Windows psql command-line decoder uses the host codepage; use UTF-8 files.
  const path = join(dir, `command-${randomUUID()}.sql`);
  writeFileSync(path, statement, "utf8");
  try {
    return await run("-f", path);
  } finally {
    unlinkSync(path);
  }
}
const fixture = readFileSync("supabase/schema.sql", "utf8");
assert.equal(realpathSync(await run("-c", "show data_directory")), realpathSync(join(dir, "data")));
const table = name => fixture.match(new RegExp("CREATE TABLE IF NOT EXISTS public\\." + name + " \\([\\s\\S]*?\\n\\);"))[0];
const trigger = fixture.match(/CREATE OR REPLACE FUNCTION public\.fn_process_activity_reward\(\)[\s\S]*?\n\$\$;/)[0];
const owner = "10000000-0000-4000-8000-000000000011";
const other = "10000000-0000-4000-8000-000000000022";
const treasury = "20000000-0000-4000-8000-000000000011";
const project = "40000000-0000-4000-8000-000000000011";
const traditional = "40000000-0000-4000-8000-000000000022";
const version = "filet-fixture-v1";
const snapshot = {
  pattern_id: "fixture", pattern_name: "Fixture", version_id: version, version_number: 1,
  matrix: [[0, 1], [1, 0]], mesh_size: 3, first_row_direction: "rtl",
};
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const json = value => quote(JSON.stringify(value)) + "::jsonb";
const setup = join(dir, "filet-http-fixture.sql");
writeFileSync(setup, `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('request.jwt.claim.role', true) $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
CREATE TYPE public.skill_domain AS ENUM ('reading','knitting','rubik','study','work','general');
CREATE TYPE public.debt_strategy_type AS ENUM ('snowball','avalanche');
CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id), collections_state jsonb, updated_at timestamptz NOT NULL);
${table("player_treasury")}
CREATE TABLE public.quest_catalog(id uuid PRIMARY KEY);
${table("activity_logs")}
${table("reading_books")}
${table("knitting_projects")}
${table("rubik_solves")}
${trigger}
CREATE TRIGGER trg_before_insert_activity_log BEFORE INSERT ON public.activity_logs FOR EACH ROW EXECUTE FUNCTION public.fn_process_activity_reward();
INSERT INTO auth.users VALUES ('${owner}'), ('${other}');
INSERT INTO public.profiles VALUES ('${owner}','{}','2026-01-01'), ('${other}','{}','2026-01-01');
INSERT INTO public.player_treasury(id,user_id,billing_period,wallet_gp,vault_remaining_gp,current_xp,current_streak_days)
  VALUES ('${treasury}','${owner}','2026-11',0,20000,0,0);
GRANT USAGE ON SCHEMA auth TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.profiles, public.player_treasury, public.activity_logs, public.reading_books, public.knitting_projects, public.rubik_solves TO service_role;
`);
await run("-f", setup);
await run("-f", "supabase/drafts/20261124_filet_guided_progress_atomic.sql");
await run("-f", "supabase/drafts/20261112_atomic_skill_session.sql");
await run("-f", "supabase/drafts/20261124_filet_workspace_sync.sql");
await sql(`INSERT INTO public.knitting_projects(id,user_id,name,technique,total_rows_target,completed_rows,status,linked_pattern_id,linked_pattern_version_id,linked_pattern_snapshot)
 VALUES ('${project}','${owner}','Fixture Filet','Crochet',2,0,'in_progress','fixture','${version}',${json(snapshot)}),
 ('${traditional}','${owner}','Traditional','Crochet',10,0,'in_progress',null,null,null);
 SET ROLE service_role;
 SELECT public.confirm_filet_row_atomic_v1('${owner}','${project}','${version}',1,'initial-row',0,'fixture',2,2);`);

const origin = "http://127.0.0.1:43175";
const browser = process.env.FILET_BROWSER_TEST === "1";
const useProductionBuild = process.env.FILET_TEST_NEXT_START === "1";
if (browser) prepareFiletBrowserFixture();
const serviceToken = "synthetic-filet-service";
let transport = "normal";
let rpcCalls = 0;
let genericWrites = 0;
let genericProjectWrites = 0;
function send(response, value, status = 200) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}
async function body(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks));
}
const adapter = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, "http://127.0.0.1");
    const bearer = request.headers.authorization?.split(" ")[1];
    const sessionOwner = bearer === "owner" ? owner : bearer === "foreign" ? other : null;
    if (path.pathname === "/auth/v1/user") {
      return sessionOwner
        ? send(response, { id: sessionOwner, email: "fixture@example.test", user_metadata: {} })
        : send(response, { message: "Expired fixture session" }, 401);
    }
    if (path.pathname === "/rest/v1/rpc/record_skill_session_atomic_v1") {
      assert.equal(bearer, serviceToken);
      rpcCalls++;
      const state = transport;
      const args = await body(request);
      assert.equal(args.p_owner_id, owner);
      assert.deepEqual(args.p_resource, { kind: "none" });
      assert.notEqual(args.p_activity.requested_gp, 98765);
      assert.notEqual(args.p_activity.earned_xp, 98765);
      if (state === "absent") return send(response, { code: "PGRST202" }, 404);
      const statement = `BEGIN; SET LOCAL ROLE service_role; SET LOCAL request.jwt.claim.role='service_role';
       SELECT public.record_skill_session_atomic_v1(${quote(args.p_owner_id)},${quote(args.p_operation_key)},
       ${quote(args.p_session_id)},${quote(args.p_treasury_id)},${json(args.p_request)},${json(args.p_activity)},
       ${json(args.p_resource)},${json(args.p_collections_state)},${quote(args.p_expected_profile_updated_at)})::text;
       SELECT pg_sleep(0.25); ${state === "rollback" ? "ROLLBACK" : "COMMIT"};`;
      try {
        const result = JSON.parse((await sql(statement)).split(/\r?\n/)[0]);
        if (state === "lost") return response.destroy();
        if (state === "rollback") return send(response, { code: "08006" }, 503);
        return send(response, result);
      } catch (error) {
        const message = String(error.stderr || "");
        const mismatch = /payload changed|another session|Reserved universal|version changed/i.test(message);
        return send(response, { code: mismatch ? "22023" : "40001", message }, mismatch ? 400 : 503);
      }
    }
    const resource = path.pathname.split("/").pop();
    if (request.method === "POST" && path.pathname.endsWith("/rpc/save_filet_workspace_v1")) {
      assert.equal(bearer, serviceToken);
      const args = await body(request);
      assert.equal(args.p_user_id, owner);
      const output = await sql(`SET ROLE service_role; SELECT public.save_filet_workspace_v1(
        ${quote(args.p_user_id)}, ${quote(args.p_operation_id)}, ${quote(args.p_base_revision)}, ${json(args.p_workspace)})`);
      return send(response, JSON.parse(output));
    }
    if (request.method === "POST" && path.pathname.endsWith("/rpc/confirm_filet_row_atomic_v1")) {
      assert.equal(bearer, serviceToken);
      const args = await body(request);
      assert.equal(args.p_owner_id, owner);
      const output = await sql(`SET ROLE service_role; SELECT public.confirm_filet_row_atomic_v1(
        ${quote(args.p_owner_id)}, ${quote(args.p_project_id)}, ${quote(args.p_pattern_version_id)},
        ${quote(args.p_row_number)}, ${quote(args.p_operation_key)}, ${quote(args.p_expected_revision)},
        'browser', ${quote(args.p_completed_segments_count)}, ${quote(args.p_expected_segments_count)})`);
      return send(response, JSON.parse(output));
    }
    if (request.method === "GET" && ["profiles", "player_treasury", "knitting_projects", "filet_workspace_sync", "filet_guided_progress"].includes(resource)) {
      if (!sessionOwner) return send(response, []);
      const key = resource === "profiles" ? "id" : "user_id";
      const idFilter = path.searchParams.get("id");
      const projectFilter = path.searchParams.get("project_id");
      const where = key + "=" + quote(sessionOwner) +
        (resource === "knitting_projects" && idFilter ? " AND id=" + quote(idFilter.slice(3)) : "") +
        (resource === "filet_guided_progress" && projectFilter ? " AND project_id=" + quote(projectFilter.slice(3)) : "");
      const records = await sql(`SELECT coalesce(json_agg(t), '[]') FROM (SELECT * FROM public.${resource} WHERE ${where} LIMIT 2) t`);
      return send(response, JSON.parse(records));
    }
    if (request.method === "POST" && resource === "activity_logs") {
      genericWrites++;
      await body(request);
      return send(response, [], 201);
    }
    if (request.method === "POST" && resource === "knitting_projects") {
      assert.equal(sessionOwner, owner);
      const input = await body(request);
      assert.equal(input.user_id, owner);
      assert.equal(input.linked_pattern_snapshot.grid_width, 80);
      const id = await sql(`INSERT INTO public.knitting_projects
        (user_id,name,technique,total_rows_target,completed_rows,status,linked_pattern_id,linked_pattern_version_id,linked_pattern_snapshot)
        VALUES (${quote(owner)}, ${quote(input.name)}, 'Crochet', ${quote(input.total_rows_target)}, 0, 'in_progress',
        ${quote(input.linked_pattern_id)}, ${quote(input.linked_pattern_version_id)}, ${json(input.linked_pattern_snapshot)}) RETURNING id`);
      return send(response, { id }, 201);
    }
    if (request.method === "PATCH" && resource === "knitting_projects") {
      genericProjectWrites++;
      const input = await body(request);
      assert.equal(path.searchParams.get("id"), "eq." + traditional);
      assert.equal(input.completed_rows, 2);
      return send(response, []);
    }
    if (request.method === "PATCH" && resource === "profiles") {
      assert.equal(path.searchParams.get("id"), "eq." + owner);
      await body(request);
      return send(response, { id: owner });
    }
    return send(response, []);
  } catch (error) {
    console.error(error);
    if (!response.headersSent) send(response, { message: "Fixture adapter error" }, 500);
  }
});
await new Promise(resolve => adapter.listen(43176, "127.0.0.1", resolve));
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", useProductionBuild ? "start" : "dev", "-H", "127.0.0.1", "-p", "43175"], {
  stdio: "ignore", windowsHide: true, env: {
    ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_APP_URL: origin,
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:43176", NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-filet-anon",
    SUPABASE_SERVICE_ROLE_KEY: serviceToken, OAKHAVEN_OWNER_USER_ID: useProductionBuild ? owner : "",
    OAKHAVEN_PUBLIC_SIGNUP_ENABLED: "true",
  },
});
const audit = async () => JSON.parse(await sql(`SELECT json_build_array(
 (SELECT completed_rows FROM public.knitting_projects WHERE id='${project}'),
 (SELECT count(*) FROM public.activity_logs), (SELECT coalesce(sum(duration_minutes),0) FROM public.activity_logs),
 (SELECT current_xp FROM public.player_treasury WHERE id='${treasury}'),
 (SELECT wallet_gp FROM public.player_treasury WHERE id='${treasury}'),
 (SELECT count(*) FROM public.skill_session_operation_receipts),
 (SELECT count(*) FROM public.filet_session_operation_aliases))`));
try {
  for (let i = 0; ; i++) {
    try {
      const status = await fetch(origin + "/api/health");
      assert.equal(status.status, 200);
      break;
    } catch (error) {
      if (i === 100) throw error;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  if (browser) {
    await runFiletBrowser({ origin, root: dir, check: async projectId => {
      assert.equal(genericWrites, 0);
      return JSON.parse(await sql(`SELECT json_build_array(
        (SELECT completed_rows FROM public.knitting_projects WHERE id=${quote(projectId)}),
        (SELECT count(*) FROM public.activity_logs),
        (SELECT coalesce(sum(duration_minutes),0) FROM public.activity_logs),
        (SELECT current_xp FROM public.player_treasury WHERE id='${treasury}'),
        (SELECT wallet_gp FROM public.player_treasury WHERE id='${treasury}'))`));
    } });
  } else {
  async function finish(input, bearer = "owner") {
    const response = await fetch(origin + "/api/shortcuts/skill-session", {
      method: "POST", headers: { authorization: "Bearer " + bearer, "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    return { status: response.status, ...(await response.json()) };
  }
  const first = {
    action: "log_session", domain: "knitting", project_id: project, duration_minutes: 7,
    filet_session_id: "ses_1000000000000_first", filet_pattern_version_id: version,
    idempotency_key: "filet-test-first", user_id: other, xp_earned: 98765, requested_gp: 98765,
  };
  const race = await Promise.all([finish(first), finish(first), finish({ ...first, idempotency_key: "filet-alias" })]);
  assert.deepEqual(race.map(result => result.status).sort(), [200, 200, 201], JSON.stringify(race));
  const receipt = race.find(result => result.status === 201);
  assert.equal(new Set(race.map(result => result.session_logged.id)).size, 1);
  assert.equal(receipt.session_logged.xp_earned, 65);
  assert.equal(receipt.session_logged.gp_earned, 2800);
  assert.deepEqual(await audit(), [1, 1, 7, 65, 2800, 1, 2]);
  console.log("same operation and alternate aliases: [rows, activity, minutes, XP, GP, receipts, aliases]", await audit());
  const priorCalls = rpcCalls;
  assert.equal((await finish(first, "expired")).status, 401);
  assert.ok([401, 404].includes((await finish(first, "foreign")).status));
  assert.equal((await finish({ ...first, filet_pattern_version_id: "wrong" })).status, 409);
  assert.equal((await finish({ ...first, rows_completed: 1 })).status, 400);
  assert.equal(rpcCalls, priorCalls);
  assert.equal((await finish({ ...first, duration_minutes: 9 })).status, 409);
  const next = { ...first, filet_session_id: "ses_1000000000000_second", idempotency_key: "filet-test-second" };
  assert.equal((await finish({ ...next, idempotency_key: "filet-alias" })).status, 409);
  transport = "absent";
  assert.equal((await finish(next)).status, 503);
  transport = "rollback";
  assert.equal((await finish(next)).status, 503);
  assert.deepEqual(await audit(), [1, 1, 7, 65, 2800, 1, 2]);
  transport = "lost";
  assert.equal((await finish(next)).status, 503);
  transport = "normal";
  const recovered = await finish(next);
  assert.equal(recovered.status, 200);
  assert.equal(recovered.replayed, true);
  assert.notEqual(recovered.session_logged.id, receipt.session_logged.id);
  assert.deepEqual(await audit(), [1, 2, 14, 130, 5600, 2, 3]);
  assert.equal(genericWrites, 0);
  console.log("rollback, missing RPC and lost response; two legitimate sessions", await audit());
  const legacy = await finish({ action: "log_session", domain: "knitting", project_id: traditional,
    idempotency_key: "legacy-fixture", duration_minutes: 5, rows_completed: 2 });
  assert.equal(legacy.status, 201, JSON.stringify(legacy));
  assert.equal(genericWrites, 1);
  assert.equal(genericProjectWrites, 1);
  console.log("traditional request used generic activity and project transports");
  }
} finally {
  if (child.pid && child.exitCode === null) {
    await exec("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true }).catch(() => {});
  }
  adapter.closeAllConnections();
  adapter.close();
}
