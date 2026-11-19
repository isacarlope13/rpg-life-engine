import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

// PostgreSQL real aislado en memoria (PGlite). NUNCA contacta Supabase de producción.
let db: PGlite;
const USER_A = "10000000-0000-4000-8000-000000000001";
const USER_B = "10000000-0000-4000-8000-000000000002";
const migrationSql = fs.readFileSync(
  "supabase/drafts/20261119_phase8_data_continuity_sync.sql",
  "utf8"
);

before(async () => {
  db = await PGlite.create();
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;

    -- Esquema preexistente relevante de producción (20261109_v3_5_complete_engine_sync.sql)
    CREATE TABLE public.rubik_cubes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      cube_id VARCHAR(50) NOT NULL,
      brand VARCHAR(80) NOT NULL,
      model VARCHAR(100) NOT NULL,
      cube_type VARCHAR(20) NOT NULL DEFAULT '3x3',
      is_magnetic BOOLEAN DEFAULT FALSE,
      is_favorite BOOLEAN DEFAULT FALSE,
      specs_metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, cube_id)
    );
    ALTER TABLE public.rubik_cubes ENABLE ROW LEVEL SECURITY;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rubik_cubes TO authenticated;
    CREATE POLICY "rubik_cubes_own" ON public.rubik_cubes
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    CREATE TABLE public.rubik_solves (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      cube_id VARCHAR(50),
      cube_type VARCHAR(20) NOT NULL DEFAULT '3x3',
      time_seconds NUMERIC(8, 2) NOT NULL,
      scramble TEXT NOT NULL,
      penalty VARCHAR(10) NOT NULL DEFAULT 'none',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE public.financial_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      amount_cop INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    INSERT INTO auth.users VALUES ('${USER_A}'), ('${USER_B}');
    INSERT INTO public.rubik_cubes (user_id, cube_id, brand, model, cube_type)
      VALUES ('${USER_A}', 'gan-14', 'GAN', '14 MagLev', '3x3');
    INSERT INTO public.rubik_solves (user_id, cube_id, cube_type, time_seconds, scramble)
      VALUES ('${USER_A}', 'gan-14', '3x3', 14.52, 'R U R'' U''');
    INSERT INTO public.financial_transactions (user_id, amount_cop)
      VALUES ('${USER_A}', 50000);
  `);
});

after(async () => {
  await db.close();
});

test("1. Ejecución inicial y segunda ejecución (idempotencia) de 20261119_phase8_data_continuity_sync.sql en PostgreSQL real", async () => {
  await db.exec(migrationSql);
  // Segunda ejecución consecutiva debe ser 100% idempotente sin errores
  await db.exec(migrationSql);

  // Confirmar que tablas financieras y rubik_solves permanecen 100% intactas
  const fin = await db.query<{ amount_cop: number }>("SELECT amount_cop FROM public.financial_transactions");
  assert.equal(fin.rows.length, 1);
  assert.equal(fin.rows[0].amount_cop, 50000);

  const solves = await db.query<{ time_seconds: string }>("SELECT time_seconds FROM public.rubik_solves");
  assert.equal(solves.rows.length, 1);
  assert.equal(Number(solves.rows[0].time_seconds), 14.52);
});

test("2. Aislamiento estricto RLS (USER_A vs USER_B vs anon), unicidad (user_id, client_id) y actualización de rubik_cubes", async () => {
  // anon NO tiene acceso a gym_workout_sets
  await db.exec("SET ROLE anon;");
  await assert.rejects(() => db.query("SELECT * FROM public.gym_workout_sets"));
  await db.exec("RESET ROLE;");

  // USER_A escribe series Gym, proyecto Trabajo, tarea Trabajo y actualiza notas de cubo
  await db.exec(`
    SET ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub', '${USER_A}', false);
  `);

  await db.query(
    `INSERT INTO public.gym_workout_sets (user_id, client_id, exercise_name, set_number, reps, weight_kg, rpe, completed, version)
     VALUES ($1, 'set-a-1', 'Press de Banca', 1, 10, 22.5, 8.0, true, 1)`,
    [USER_A]
  );

  // Duplicado exacto (user_id, client_id) rechazado por UNIQUE constraint
  await assert.rejects(() =>
    db.query(
      `INSERT INTO public.gym_workout_sets (user_id, client_id, exercise_name, set_number, reps, weight_kg, rpe, completed, version)
       VALUES ($1, 'set-a-1', 'Press de Banca', 1, 10, 22.5, 8.0, true, 1)`,
      [USER_A]
    )
  );

  const projInsert = await db.query<{ id: string }>(
    `INSERT INTO public.work_projects (user_id, client_id, name, methodology, status, work_scope, version)
     VALUES ($1, 'proj-a-1', 'OakHaven Sync', 'kanban', 'active', 'personal', 1)
     RETURNING id`,
    [USER_A]
  );
  const projectId = projInsert.rows[0].id;

  await db.query(
    `INSERT INTO public.work_project_tasks (user_id, project_id, client_id, title, priority, version)
     VALUES ($1, $2, 'task-a-1', 'Auditar RLS', 'high', 1)`,
    [USER_A, projectId]
  );

  await db.query(
    `UPDATE public.rubik_cubes
     SET tension_notes = 'Ajuste 3', lube_notes = 'Silicone 5', sync_version = 2
     WHERE cube_id = 'gan-14'`
  );

  const cubeCheck = await db.query<{ tension_notes: string; sync_version: number }>(
    "SELECT tension_notes, sync_version FROM public.rubik_cubes WHERE cube_id = 'gan-14'"
  );
  assert.equal(cubeCheck.rows[0].tension_notes, "Ajuste 3");
  assert.equal(cubeCheck.rows[0].sync_version, 2);

  // Mínimo privilegio: authenticated NO tiene DELETE físico (solo archivado lógico vía deleted_at)
  await assert.rejects(() =>
    db.query("DELETE FROM public.gym_workout_sets WHERE client_id = 'set-a-1'")
  );
  await assert.rejects(() =>
    db.query("DELETE FROM public.work_projects WHERE client_id = 'proj-a-1'")
  );

  // Prueba CAS atómica en PostgreSQL real: 2 dispositivos intentan actualizar v1 -> v2
  const cas1 = await db.query<{ version: number }>(
    `UPDATE public.gym_workout_sets
     SET reps = 12, version = version + 1
     WHERE user_id = $1 AND client_id = 'set-a-1' AND version = 1
     RETURNING version`,
    [USER_A]
  );
  assert.equal(cas1.rows.length, 1);
  assert.equal(cas1.rows[0].version, 2);

  const cas2Stale = await db.query<{ version: number }>(
    `UPDATE public.gym_workout_sets
     SET reps = 15, version = version + 1
     WHERE user_id = $1 AND client_id = 'set-a-1' AND version = 1
     RETURNING version`,
    [USER_A]
  );
  assert.equal(cas2Stale.rows.length, 0, "Actualización CAS con versión obsoleta debe afectar 0 filas");

  // Cambiar identidad a USER_B -> debe ver 0 filas de USER_A y ser bloqueado al intentar escribir como USER_A
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${USER_B}', false);`);

  const gymB = await db.query("SELECT * FROM public.gym_workout_sets");
  const projB = await db.query("SELECT * FROM public.work_projects");
  const taskB = await db.query("SELECT * FROM public.work_project_tasks");
  const cubeB = await db.query("SELECT * FROM public.rubik_cubes");
  assert.equal(gymB.rows.length, 0);
  assert.equal(projB.rows.length, 0);
  assert.equal(taskB.rows.length, 0);
  assert.equal(cubeB.rows.length, 0);

  await assert.rejects(() =>
    db.query(
      `INSERT INTO public.gym_workout_sets (user_id, client_id, exercise_name)
       VALUES ($1, 'hijack-1', 'Robo')`,
      [USER_A]
    )
  );

  await db.exec("RESET ROLE;");
});
