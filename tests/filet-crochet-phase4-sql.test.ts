import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

// Pruebas SQL aisladas en PostgreSQL en memoria (PGlite). Jamás contacta Supabase real.
let db: PGlite;
const USER_A = "10000000-0000-4000-8000-000000000011";
const USER_B = "10000000-0000-4000-8000-000000000022";
const PROJ_A = "40000000-0000-4000-8000-000000000011";
const PROJ_LEGACY = "40000000-0000-4000-8000-000000000012";

const schema = fs.readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const draftSql = fs.readFileSync(
  new URL("../supabase/drafts/20261124_filet_guided_progress_atomic.sql", import.meta.url),
  "utf8"
);

function extractTable(name: string): string {
  const match = schema.match(
    new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${name} \\([\\s\\S]*?\\n\\);`)
  );
  assert.ok(match, `Falta la tabla ${name} en supabase/schema.sql`);
  return match[0];
}

before(async () => {
  db = await PGlite.create();
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    ${extractTable("knitting_projects")}
  `);
  await db.exec(draftSql);
});

beforeEach(async () => {
  await db.exec(`
    TRUNCATE public.filet_guided_operation_receipts,
             public.filet_guided_progress,
             public.knitting_projects,
             auth.users CASCADE;
    INSERT INTO auth.users VALUES ('${USER_A}'), ('${USER_B}');
    INSERT INTO public.knitting_projects(
      id, user_id, name, technique, total_rows_target, completed_rows, status,
      linked_pattern_id, linked_pattern_version_id, linked_pattern_snapshot
    )
    VALUES (
      '${PROJ_A}', '${USER_A}', 'Tapete Filet 80', 'Crochet', 3, 0, 'in_progress',
      'pat-80', 'pat-80-v1', '{"version_number":1,"grid_width":80,"total_rows":3}'::jsonb
    ),
    (
      '${PROJ_LEGACY}', '${USER_A}', 'Bufanda Antigua', 'Dos Agujas', 20, 4, 'in_progress',
      NULL, NULL, NULL
    );
  `);
});

after(async () => {
  await db?.close();
});

test("only guided progress can change the linked project counter and version", async () => {
  await assert.rejects(
    db.query("update public.knitting_projects set completed_rows = 1 where id = $1", [PROJ_A]),
    { code: "23514" },
  );
  await assert.rejects(
    db.query("update public.knitting_projects set linked_pattern_version_id = null where id = $1", [PROJ_A]),
    { code: "23514" },
  );
  await db.query("update public.knitting_projects set completed_rows = 5 where id = $1", [PROJ_LEGACY]);
  const { rows } = await db.query<{ completed_rows: number }>(
    "select completed_rows from public.knitting_projects where id = $1", [PROJ_LEGACY],
  );
  assert.equal(rows[0].completed_rows, 5);
});

test("workspace draft authenticates direct reads and serializes revision receipts", async () => {
  const sql = fs.readFileSync(
    new URL("../supabase/drafts/20261124_filet_workspace_sync.sql", import.meta.url),
    "utf8",
  );
  await db.exec("grant usage on schema auth to authenticated");
  await db.exec(sql);
  await db.exec(sql);

  const operation = "50000000-0000-4000-8000-000000000011";
  const otherOperation = "50000000-0000-4000-8000-000000000022";
  async function save(id: string, revision: number, workspace: string) {
    const result = await db.query<{ receipt: { status: string; revision: number } }>(
      "select public.save_filet_workspace_v1($1,$2,$3,$4) as receipt",
      [USER_A, id, revision, workspace],
    );
    return result.rows[0].receipt;
  }

  try {
    await db.exec("set role service_role");
    assert.deepEqual(await save(operation, 0, '{"drafts":[]}'), { status: "applied", revision: 1 });
    assert.deepEqual(await save(otherOperation, 0, '{"drafts":[{}]}'), { status: "conflict", revision: 1 });
    assert.deepEqual(await save(otherOperation, 1, '{"drafts":[{}]}'), { status: "applied", revision: 2 });
    assert.deepEqual(await save(operation, 0, '{"drafts":[]}'), { status: "replayed", revision: 1 });
    await assert.rejects(save(operation, 0, '{"drafts":[{}]}'), { code: "22023" });

    await db.exec("reset role; set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [USER_A]);
    assert.equal((await db.query("select revision from public.filet_workspace_sync")).rows.length, 1);
    await assert.rejects(save(operation, 0, '{"drafts":[]}'), { code: "42501" });
    await assert.rejects(db.query("update public.filet_workspace_sync set revision=9"), { code: "42501" });
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [USER_B]);
    assert.equal((await db.query("select revision from public.filet_workspace_sync")).rows.length, 0);
    await db.exec("reset role; set role anon");
    await assert.rejects(db.query("select revision from public.filet_workspace_sync"), { code: "42501" });
  } finally {
    await db.exec("reset role");
  }
});

test("confirm_filet_row_atomic_v1 actualiza progreso y completed_rows atómicamente y bloquea replays/duplicados entre 2 dispositivos", async () => {
  // Confirmación 1 desde dispositivo A -> +1 exacto
  const r1 = await db.query<{ res: Record<string, unknown> }>(
    `SELECT public.confirm_filet_row_atomic_v1($1::uuid, $2::uuid, $3::text, $4::int, $5::text, $6::int, $7::text) AS res`,
    [USER_A, PROJ_A, "pat-80-v1", 1, "op-devA-r1", 0, "iphone-a"]
  );
  assert.equal(r1.rows[0].res.applied, true);
  assert.equal(r1.rows[0].res.delta_completed_rows, 1);
  assert.equal(r1.rows[0].res.completed_rows, 1);
  assert.equal(r1.rows[0].res.revision, 1);

  // Replay exacto con mismo operation_key -> idempotente, delta 0
  const replay = await db.query<{ res: Record<string, unknown> }>(
    `SELECT public.confirm_filet_row_atomic_v1($1::uuid, $2::uuid, $3::text, $4::int, $5::text, $6::int, $7::text) AS res`,
    [USER_A, PROJ_A, "pat-80-v1", 1, "op-devA-r1", 0, "iphone-a"]
  );
  assert.equal(replay.rows[0].res.replayed, true);
  assert.equal(replay.rows[0].res.delta_completed_rows, 0);
  assert.equal(replay.rows[0].res.completed_rows, 1);

  // Segundo dispositivo intenta confirmar la MISMA fila 1 con otra clave -> delta 0
  const dev2SameRow = await db.query<{ res: Record<string, unknown> }>(
    `SELECT public.confirm_filet_row_atomic_v1($1::uuid, $2::uuid, $3::text, $4::int, $5::text, $6::int, $7::text) AS res`,
    [USER_A, PROJ_A, "pat-80-v1", 1, "op-devB-r1", 0, "galaxy-tab-b"]
  );
  assert.equal(dev2SameRow.rows[0].res.replayed, true);
  assert.equal(dev2SameRow.rows[0].res.delta_completed_rows, 0);
  assert.equal(dev2SameRow.rows[0].res.completed_rows, 1);

  // Conflicto optimista: dispositivo B envía fila 2 con expected_revision obsoleta (0 en vez de 1)
  const conflict = await db.query<{ res: Record<string, unknown> }>(
    `SELECT public.confirm_filet_row_atomic_v1($1::uuid, $2::uuid, $3::text, $4::int, $5::text, $6::int, $7::text) AS res`,
    [USER_A, PROJ_A, "pat-80-v1", 2, "op-devB-r2-stale", 0, "galaxy-tab-b"]
  );
  assert.equal(conflict.rows[0].res.conflict, true);
  assert.equal(conflict.rows[0].res.server_revision, 1);
  assert.equal(conflict.rows[0].res.completed_rows, 1);

  // Verificar que knitting_projects.completed_rows sigue exactamente en 1
  const projRow = await db.query<{ completed_rows: number; status: string }>(
    `SELECT completed_rows, status FROM public.knitting_projects WHERE id = $1`,
    [PROJ_A]
  );
  assert.equal(projRow.rows[0].completed_rows, 1);
  assert.equal(projRow.rows[0].status, "in_progress");
});

test("aislamiento por propietario, rechazo de versión distinta, retroceso atómico y finalización de proyecto", async () => {
  // Otro usuario no puede confirmar filas del proyecto de USER_A
  await assert.rejects(
    db.query(
      `SELECT public.confirm_filet_row_atomic_v1($1::uuid, $2::uuid, $3::text, $4::int, $5::text, $6::int, $7::text)`,
      [USER_B, PROJ_A, "pat-80-v1", 1, "op-intruder", 0, "evil"]
    ),
    /no encontrado o no pertenece al propietario/i
  );

  // Versión inmutable distinta es rechazada
  await assert.rejects(
    db.query(
      `SELECT public.confirm_filet_row_atomic_v1($1::uuid, $2::uuid, $3::text, $4::int, $5::text, $6::int, $7::text)`,
      [USER_A, PROJ_A, "pat-80-v2", 1, "op-wrong-ver", 0, "iphone-a"]
    ),
    /PATTERN_VERSION_MISMATCH/
  );

  // Confirmar filas 1, 2 y 3 -> proyecto pasa a 'completed'
  await db.query(
    `SELECT public.confirm_filet_row_atomic_v1($1::uuid, $2::uuid, 'pat-80-v1', 1, 'op-1', 0, 'dev')`,
    [USER_A, PROJ_A]
  );
  await db.query(
    `SELECT public.confirm_filet_row_atomic_v1($1::uuid, $2::uuid, 'pat-80-v1', 2, 'op-2', 1, 'dev')`,
    [USER_A, PROJ_A]
  );
  const done = await db.query<{ res: Record<string, unknown> }>(
    `SELECT public.confirm_filet_row_atomic_v1($1::uuid, $2::uuid, 'pat-80-v1', 3, 'op-3', 2, 'dev') AS res`,
    [USER_A, PROJ_A]
  );
  assert.equal(done.rows[0].res.completed_rows, 3);
  assert.equal(done.rows[0].res.status, "completed");

  // Retroceder fila 3 atómicamente -> vuelve a 2 y 'in_progress'
  const undone = await db.query<{ res: Record<string, unknown> }>(
    `SELECT public.undo_filet_row_atomic_v1($1::uuid, $2::uuid, 'pat-80-v1', 3, 'op-undo-3', 'dev') AS res`,
    [USER_A, PROJ_A]
  );
  assert.equal(undone.rows[0].res.applied, true);
  assert.equal(undone.rows[0].res.delta_completed_rows, -1);
  assert.equal(undone.rows[0].res.completed_rows, 2);

  const afterUndo = await db.query<{ completed_rows: number; status: string }>(
    `SELECT completed_rows, status FROM public.knitting_projects WHERE id = $1`,
    [PROJ_A]
  );
  assert.equal(afterUndo.rows[0].completed_rows, 2);
  assert.equal(afterUndo.rows[0].status, "in_progress");

  // Proyecto antiguo sin patrón permanece intacto
  const legacy = await db.query<{ completed_rows: number; linked_pattern_id: string | null }>(
    `SELECT completed_rows, linked_pattern_id FROM public.knitting_projects WHERE id = $1`,
    [PROJ_LEGACY]
  );
  assert.equal(legacy.rows[0].completed_rows, 4);
  assert.equal(legacy.rows[0].linked_pattern_id, null);
});
