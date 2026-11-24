import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { createStarterUserMemoryStore } from "../src/lib/demo-store.ts";
import { applyPersistedCollectionsToStore, type PersistedCollectionsPayload } from "../src/lib/persistence-sync.ts";
import { prepareAtomicSkillSession, commitAtomicSkillSession, type AtomicSessionPlan } from "../src/lib/atomic-skill-session.ts";

// Explicit in-memory PostgreSQL. Never read connection strings or contact Supabase.
let db: PGlite;
const A = "10000000-0000-4000-8000-000000000001";
const B = "10000000-0000-4000-8000-000000000002";
const treasuryA = "20000000-0000-4000-8000-000000000001";
const treasuryB = "20000000-0000-4000-8000-000000000002";
const bookA = "30000000-0000-4000-8000-000000000001";
const bookB = "30000000-0000-4000-8000-000000000002";
const knitA = "40000000-0000-4000-8000-000000000001";
const sessionId = "50000000-0000-4000-8000-000000000001";
const schema = fs.readFileSync("supabase/schema.sql", "utf8");
const draft = fs.readFileSync("supabase/drafts/20261112_atomic_skill_session.sql", "utf8");
function table(name: string) {
  const match = schema.match(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${name} \\([\\s\\S]*?\\n\\);`));
  assert.ok(match, `Missing actual schema table ${name}`);
  return match[0];
}
const actualTrigger = schema.match(/CREATE OR REPLACE FUNCTION public\.fn_process_activity_reward\(\)[\s\S]*?\n\$\$;/)![0];

before(async () => {
  db = await PGlite.create();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('request.jwt.claim.role',true) $$;
    CREATE TYPE public.skill_domain AS ENUM ('reading','knitting','rubik','study','work','general');
    CREATE TYPE public.debt_strategy_type AS ENUM ('snowball','avalanche');
    CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id), collections_state jsonb, updated_at timestamptz NOT NULL);
    ${table("player_treasury")}
    CREATE TABLE public.quest_catalog(id uuid PRIMARY KEY);
    ${table("activity_logs")}
    ${table("reading_books")}
    ${table("knitting_projects")}
    ${table("rubik_solves")}
    ${actualTrigger}
    CREATE TRIGGER trg_before_insert_activity_log BEFORE INSERT ON public.activity_logs
      FOR EACH ROW EXECUTE FUNCTION public.fn_process_activity_reward();
  `);
  await db.exec(draft);
});
beforeEach(async () => {
  await db.exec(`
    RESET ROLE;
    SELECT set_config('request.jwt.claim.role','service_role',false);
    TRUNCATE public.skill_session_operation_receipts, public.activity_logs, public.reading_books,
      public.knitting_projects, public.rubik_solves, public.player_treasury, public.profiles, auth.users CASCADE;
    INSERT INTO auth.users VALUES ('${A}'),('${B}');
    INSERT INTO public.profiles VALUES ('${A}','{"keep":"original"}','2026-01-01T00:00:00Z'),('${B}','{}','2026-01-01T00:00:00Z');
    INSERT INTO public.player_treasury(id,user_id,billing_period,wallet_gp,vault_remaining_gp,current_xp,current_streak_days,aegis_shields)
      VALUES ('${treasuryA}','${A}','2026-01',0,1000,0,0,0),('${treasuryB}','${B}','2026-01',0,1000,0,0,0);
    INSERT INTO public.reading_books(id,user_id,title,author,total_pages,pages_read,status)
      VALUES ('${bookA}','${A}','Fixture A','Fixture',100,0,'reading'),('${bookB}','${B}','Fixture B','Fixture',100,0,'reading');
    INSERT INTO public.knitting_projects(id,user_id,name,total_rows_target,completed_rows)
      VALUES ('${knitA}','${A}','Fixture knitting',100,0);
  `);
});
after(async () => { await db?.close(); });

test("typed adapter commits SQL-effective reward once and retries after lost acknowledgement without local effects", async () => {
  const store = createStarterUserMemoryStore({ userId: A });
  store.current_streak_days = 9;
  store.vault_remaining_gp = 1;
  const context = { ownerId: A, treasuryId: treasuryA, profileUpdatedAt: "2026-01-01T00:00:00Z", store };
  const command = { domain: "study" as const, duration_minutes: 5, idempotency_key: "adapter-real-sql" };
  const plan = prepareAtomicSkillSession(context, command);
  const before = structuredClone(store);
  const transport = { async rpc(_name: "record_skill_session_atomic_v1", args: AtomicSessionPlan) {
    const result = await db.query<{ result: unknown }>(
      `SELECT public.record_skill_session_atomic_v1($1::uuid,$2::text,$3::uuid,$4::uuid,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::timestamptz) AS result`,
      [args.p_owner_id,args.p_operation_key,args.p_session_id,args.p_treasury_id,
        JSON.stringify(args.p_request),JSON.stringify(args.p_activity),JSON.stringify(args.p_resource),
        JSON.stringify(args.p_collections_state),args.p_expected_profile_updated_at]);
    return { data: result.rows[0].result, error: null };
  } };
  let committedId = "";
  await assert.rejects(commitAtomicSkillSession({ async rpc(name, args) {
    const result = await transport.rpc(name, args);
    committedId = (result.data as { session_logged: { id: string } }).session_logged.id;
    throw new Error("synthetic lost acknowledgement");
  } }, plan), /lost acknowledgement/);
  // Process restart can rebuild a proposal with a new local UUID; durable SQL
  // receipt, not that proposal, must determine the acknowledged session ID.
  const rebuilt = prepareAtomicSkillSession(context, command);
  assert.notEqual(rebuilt.p_session_id, committedId);
  const replay = await commitAtomicSkillSession(transport, rebuilt);
  assert.equal(replay.session_logged.id, committedId);
  assert.equal(replay.replayed, true);
  assert.equal(replay.reward_impact.transferred_gp, 500);
  assert.equal(replay.treasury_snapshot.wallet_gp, 500);
  assert.deepEqual(structuredClone(store), before);
  const state = await audit();
  assert.deepEqual([state.activities,state.receipts,state.wallet,state.xp], [1,1,500,11]);
});

type Options = { owner?: string; key?: string; session?: string; treasury?: string; request?: object; activity?: object; resource?: object; snapshot?: object | null; revision?: string | null };
async function call(options: Options = {}) {
  const request = options.request ?? { domain: "reading", duration_minutes: 5, book_id: bookA, pages_read: 3 };
  const activity = options.activity ?? { domain: "reading", title: "Fixture activity", duration_minutes: 5, requested_gp: 100, earned_xp: 10, notes: "fixture" };
  const result = await db.query<{ result: { success: boolean; replayed: boolean; session_logged: { id: string; gp_earned: number }; reward_impact: { transferred_gp: number; idempotent_replay: boolean } } }>(
    `SELECT public.record_skill_session_atomic_v1($1::uuid,$2::text,$3::uuid,$4::uuid,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::timestamptz) AS result`,
    [options.owner ?? A, options.key ?? "fixture-operation", options.session ?? sessionId, options.treasury ?? treasuryA,
      JSON.stringify(request), JSON.stringify(activity), JSON.stringify(options.resource ?? { kind: "book", id: bookA, delta: 3 }),
      options.snapshot ? JSON.stringify(options.snapshot) : null, options.revision ?? null]);
  return result.rows[0].result;
}
type AuditRow = { wallet: number; xp: number; streak: number; pages: number; activities: number; receipts: number; snapshot: Partial<PersistedCollectionsPayload> & Record<string, unknown> };
async function audit() {
  return (await db.query<AuditRow>(`SELECT
    (SELECT wallet_gp FROM public.player_treasury WHERE id='${treasuryA}')::int AS wallet,
    (SELECT current_xp FROM public.player_treasury WHERE id='${treasuryA}')::int AS xp,
    (SELECT current_streak_days FROM public.player_treasury WHERE id='${treasuryA}') AS streak,
    (SELECT pages_read FROM public.reading_books WHERE id='${bookA}') AS pages,
    (SELECT count(*)::int FROM public.activity_logs) AS activities,
    (SELECT count(*)::int FROM public.skill_session_operation_receipts) AS receipts,
    (SELECT collections_state FROM public.profiles WHERE id='${A}') AS snapshot`)).rows[0];
}

test("atomic SQL records one existing-trigger reward, resource change and durable receipt", async () => {
  const first = await call();
  const replay = await call();
  assert.equal(first.success, true);
  assert.equal(replay.replayed, true);
  assert.equal(replay.session_logged.id, first.session_logged.id);
  assert.equal(replay.reward_impact.transferred_gp, first.reward_impact.transferred_gp);
  const state = await audit();
  assert.deepEqual([state.wallet, state.xp, state.streak, state.pages, state.activities, state.receipts], [100,10,1,3,1,1]);
  const expected = "u" + createHash("sha256").update(A + "\u0000fixture-operation").digest("hex").slice(0,48);
  assert.equal((await db.query<{ idempotency_key: string }>(`SELECT idempotency_key FROM public.activity_logs`)).rows[0].idempotency_key, expected);
});

test("queued concurrent invocations share the receipt without re-running the reward trigger", async () => {
  const results = await Promise.all(Array.from({ length: 8 }, () => call()));
  assert.equal(new Set(results.map(result => result.session_logged.id)).size, 1);
  assert.equal(results.filter(result => !result.replayed).length, 1);
  assert.equal((await audit()).streak, 1);
});

test("changed immutable request conflicts without advancing anything", async () => {
  await call();
  const before = await audit();
  await assert.rejects(call({ request: { domain: "reading", duration_minutes: 5, pages_read: 99 } }), /Operation payload changed/);
  assert.deepEqual(await audit(), before);
});

test("Filet aliases share one canonical receipt and bind to one session and version", async () => {
  await db.exec("alter table public.knitting_projects add column if not exists linked_pattern_version_id text");
  await db.query("update public.knitting_projects set linked_pattern_version_id='fixture-v1', completed_rows=1 where id=$1", [knitA]);
  const request = {
    domain: "knitting", duration_minutes: 7, project_id: knitA,
    filet_session_id: "ses_1000000000000_abc", filet_pattern_version_id: "fixture-v1",
  };
  const options = {
    request, resource: { kind: "none" },
    activity: { domain: "knitting", duration_minutes: 7, title: "Filet", requested_gp: 100, earned_xp: 10 },
  };
  const first = await call({ ...options, key: "filet-one" });
  const otherSession = "50000000-0000-4000-8000-000000000020";
  const replay = await call({ ...options, key: "filet-two", session: otherSession });
  assert.equal(replay.replayed, true);
  assert.equal(replay.session_logged.id, first.session_logged.id);
  const distinct = { ...request, filet_session_id: "ses_1000000000000_def" };
  await assert.rejects(call({ ...options, key: "filet-two", request: distinct }), /already belongs/);
  await assert.rejects(call({ ...options, key: "filet-two", request: { ...request, notes: "changed" } }), /payload changed/);
  await assert.rejects(call({ ...options, key: "filet-three", request: { ...request, filet_pattern_version_id: "wrong" } }), /version changed/);
  await call({ ...options, key: "filet-three", request: distinct, session: otherSession });
  const state = await audit();
  assert.deepEqual([state.activities, state.receipts, state.wallet, state.xp], [2, 2, 200, 20]);
  const counters = await db.query<{ completed_rows: number }>("select completed_rows from public.knitting_projects where id=$1", [knitA]);
  assert.equal(counters.rows[0].completed_rows, 1);
});

test("foreign resource failure rolls back the already-run treasury trigger and activity insert", async () => {
  const before = await audit();
  await assert.rejects(call({ resource: { kind: "book", id: bookB, delta: 3 } }), /Owned book required/);
  assert.deepEqual(await audit(), before);
});

test("receipt write failure rolls back resource, profile, activity and GP/XP together", async () => {
  await db.exec(`ALTER TABLE public.skill_session_operation_receipts ADD CONSTRAINT qa_reject_receipt CHECK(operation_key <> 'fixture-receipt-failure')`);
  const before = await audit();
  await assert.rejects(call({ key: "fixture-receipt-failure", snapshot: { workProjects: [], wallet_gp: 999999 }, revision: "2026-01-01T00:00:00Z" }));
  assert.deepEqual(await audit(), before);
});

test("profile revision conflicts and foreign snapshots leave zero effects", async () => {
  const before = await audit();
  await assert.rejects(call({ snapshot: { workProjects: [] }, revision: "2025-01-01T00:00:00Z" }), /Profile revision changed/);
  await assert.rejects(call({ snapshot: { skillSessionState: { ownerId: B } }, revision: "2026-01-01T00:00:00Z" }), /Snapshot owner mismatch/);
  assert.deepEqual(await audit(), before);
});

test("snapshot cannot override treasury projections and zero-GP capped receipts replay exactly", async () => {
  await db.exec(`UPDATE public.player_treasury SET vault_remaining_gp=0 WHERE id='${treasuryA}'`);
  const first = await call({ snapshot: { wallet_gp: 999999, workProjects: [] }, revision: "2026-01-01T00:00:00Z" });
  assert.equal(first.reward_impact.transferred_gp, 0);
  assert.equal((await call()).reward_impact.transferred_gp, 0);
  const state = await audit();
  assert.equal((state.snapshot as { wallet_gp: number }).wallet_gp, 0);
  assert.equal((state.snapshot as { keep: string }).keep, "original");
  assert.equal(state.xp, 10);
});

test("service-only execution and private receipts are not granted to browser roles", async () => {
  for (const role of ["anon", "authenticated"]) {
    const permissions = (await db.query<{ execute: boolean; read: boolean }>(`SELECT has_function_privilege($1,'public.record_skill_session_atomic_v1(uuid,text,uuid,uuid,jsonb,jsonb,jsonb,jsonb,timestamptz)','EXECUTE') AS execute, has_table_privilege($1,'public.skill_session_operation_receipts','SELECT') AS read`, [role])).rows[0];
    assert.equal(permissions.execute, false);
    assert.equal(permissions.read, false);
  }
  await db.exec(`SELECT set_config('request.jwt.claim.role','authenticated',false)`);
  await assert.rejects(call(), /Server role required/);
  assert.equal((await audit()).activities, 0);
});

test("knitting and Rubik side effects are each applied only once", async () => {
  await call({ key: "fixture-knit", request: { domain: "knitting", duration_minutes: 5 }, activity: { domain: "knitting", duration_minutes: 5, title: "Fixture knit", requested_gp: 100, earned_xp: 10 }, resource: { kind: "knitting", id: knitA, delta: 4 } });
  await call({ key: "fixture-knit", request: { domain: "knitting", duration_minutes: 5 }, activity: { domain: "knitting", duration_minutes: 5, title: "Fixture knit", requested_gp: 100, earned_xp: 10 }, resource: { kind: "knitting", id: knitA, delta: 4 } });
  assert.equal((await db.query<{ completed_rows: number }>(`SELECT completed_rows FROM public.knitting_projects`)).rows[0].completed_rows, 4);
  const rubik: Options = { key: "fixture-rubik", session: "50000000-0000-4000-8000-000000000002", request: { domain: "rubik", duration_minutes: 5 }, activity: { domain: "rubik", duration_minutes: 5, title: "Fixture solve", requested_gp: 100, earned_xp: 10 }, resource: { kind: "rubik", time_seconds: 20, scramble: "R U" } };
  await call(rubik); await call(rubik);
  assert.equal((await db.query<{ count: number }>(`SELECT count(*)::int AS count FROM public.rubik_solves`)).rows[0].count, 1);
});

test("a new PostgreSQL WASM instance reuses its persisted receipt without another payment", async () => {
  const original = await call();
  const archive = await db.dumpDataDir();
  await db.close();
  db = await PGlite.create({ loadDataDir: archive });
  await db.exec(`SELECT set_config('request.jwt.claim.role','service_role',false)`);
  const replay = await call();
  assert.equal(replay.session_logged.id, original.session_logged.id);
  assert.equal(replay.replayed, true);
  assert.equal((await audit()).wallet, 100);
});

test("the same operation key in two accounts remains isolated and uses separate activity keys", async () => {
  await call();
  await call({ owner: B, treasury: treasuryB, session: "50000000-0000-4000-8000-000000000003",
    request: { domain: "reading", duration_minutes: 5, book_id: bookB, pages_read: 2 },
    resource: { kind: "book", id: bookB, delta: 2 } });
  assert.equal((await audit()).pages, 3);
  assert.equal((await db.query<{ pages_read: number }>(`SELECT pages_read FROM public.reading_books WHERE id='${bookB}'`)).rows[0].pages_read, 2);
  assert.equal((await db.query<{ count: number }>(`SELECT count(DISTINCT idempotency_key)::int AS count FROM public.activity_logs`)).rows[0].count, 2);
});

test("resource snapshot progress is projected from its committed row rather than stale proposal values", async () => {
  await call({ snapshot: { readingBooks: [{ id: bookA, title: "fixture", pages_read: 99, status: "completed" }] }, revision: "2026-01-01T00:00:00Z" });
  const snapshot = (await audit()).snapshot as { readingBooks: { pages_read: number; status: string }[] };
  assert.equal(snapshot.readingBooks[0].pages_read, 3);
  assert.equal(snapshot.readingBooks[0].status, "reading");
});

test("zero time and legacy unreceipted operations fail without manufacturing another reward", async () => {
  await assert.rejects(call({ request: { domain: "reading", duration_minutes: 0 }, activity: { domain: "reading", duration_minutes: 0, requested_gp: 100, earned_xp: 10 } }), /Invalid activity proposal/);
  assert.equal((await audit()).activities, 0);
  const oldKey = "u" + createHash("sha256").update(A + "\u0000legacy-op").digest("hex").slice(0,48);
  await db.query(`INSERT INTO public.activity_logs(user_id,treasury_id,domain,activity_name,duration_minutes,requested_gp,earned_xp,idempotency_key) VALUES($1,$2,'reading','legacy',5,100,10,$3)`, [A, treasuryA, oldKey]);
  const before = await audit();
  await assert.rejects(call({ key: "legacy-op" }), /Legacy operation requires reconciliation/);
  assert.deepEqual(await audit(), before);
});

test("the persisted application receipt uses SQL-capped GP and survives store recovery", async () => {
  await db.exec(`UPDATE public.player_treasury SET vault_remaining_gp=50 WHERE id='${treasuryA}'`);
  const proposed = { id: sessionId, domain: "reading", title: "fixture", duration_minutes: 5, gp_earned: 999, xp_earned: 999, details: "fixture", timestamp: "2026-01-01T00:00:00Z" };
  await call({ snapshot: { skillSessionState: { version: 1, ownerId: A, sessions: [proposed], receipts: [["skill_session:fixture-operation", { session: proposed, reward_impact: {} }]] } }, revision: "2026-01-01T00:00:00Z" });
  const snapshot = (await audit()).snapshot;
  const recovered = createStarterUserMemoryStore({ userId: A });
  applyPersistedCollectionsToStore(recovered, snapshot, A);
  const before = [recovered.wallet_gp, recovered.current_xp, recovered.skillSessions.length];
  const replay = recovered.logSkillSession({ domain: "reading", duration_minutes: 5, idempotency_key: "fixture-operation" });
  assert.equal(replay.session.id, sessionId);
  assert.equal(replay.session.gp_earned, 50);
  assert.equal(replay.reward_impact.transferred_gp, 50);
  assert.equal(replay.reward_impact.idempotent_replay, true);
  assert.deepEqual([recovered.wallet_gp, recovered.current_xp, recovered.skillSessions.length], before);
});
