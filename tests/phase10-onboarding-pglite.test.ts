import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {
  createEmptyOnboardingDraft,
  saveOnboardingDraft,
  loadOnboardingDraft,
  clearAllOnboardingDrafts,
} from "../src/lib/onboarding/personal-onboarding-engine.ts";

// PostgreSQL real aislado en memoria (PGlite). NUNCA contacta Supabase de producción.
let db: PGlite;
const USER_A = "20000000-0000-4000-8000-000000000001";
const USER_B = "20000000-0000-4000-8000-000000000002";
const rpcSql = fs.readFileSync(
  "supabase/drafts/20261120_phase10_secure_onboarding_rpc.sql",
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
    GRANT USAGE ON SCHEMA auth TO authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

    CREATE TABLE public.player_treasury (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      billing_period text NOT NULL,
      monthly_income_cop integer NOT NULL DEFAULT 0,
      fixed_costs_budget_cop integer NOT NULL DEFAULT 0,
      fixed_costs_spent_cop integer NOT NULL DEFAULT 0,
      variable_ops_budget_cop integer NOT NULL DEFAULT 0,
      variable_ops_spent_cop integer NOT NULL DEFAULT 0,
      vault_cap_gp integer NOT NULL DEFAULT 0,
      vault_remaining_gp integer NOT NULL DEFAULT 0,
      wallet_gp integer NOT NULL DEFAULT 0,
      total_penalty_gp integer NOT NULL DEFAULT 0,
      debt_strategy text NOT NULL DEFAULT 'snowball',
      player_level integer NOT NULL DEFAULT 1,
      current_xp integer NOT NULL DEFAULT 0,
      current_streak_days integer NOT NULL DEFAULT 0,
      streak_multiplier numeric(4,2) NOT NULL DEFAULT 1.0,
      aegis_shields integer NOT NULL DEFAULT 1,
      UNIQUE (user_id, billing_period)
    );
    ALTER TABLE public.player_treasury ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public.player_treasury FROM PUBLIC, anon;
    GRANT SELECT, INSERT, UPDATE ON TABLE public.player_treasury TO authenticated;
    CREATE POLICY "treasury_own" ON public.player_treasury
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    INSERT INTO auth.users VALUES ('${USER_A}'), ('${USER_B}');
  `);

  // Ejecutar borrador RPC 2 veces (idempotencia)
  await db.exec(rpcSql);
  await db.exec(rpcSql);
});

after(async () => {
  await db.close();
});

test("1. GATE 3 (PGlite): primer onboarding crea nivel 1/GP 0; edición posterior preserva GP, XP, nivel, racha y spent_cop", async () => {
  await db.exec(`
    SET ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub', '${USER_A}', false);
  `);

  const first = await db.query<{ mode: string; wallet_gp: number; player_level: number; current_xp: number }>(
    `SELECT * FROM public.fn_phase10_upsert_onboarding_treasury('2026-11', 3000000, 1000000, 500000, 250000, 'snowball')`
  );
  assert.equal(first.rows[0].mode, "initial");
  assert.equal(first.rows[0].player_level, 1);
  assert.equal(first.rows[0].wallet_gp, 0);

  // Simular progreso real ganado por el usuario después del onboarding
  await db.query(
    `UPDATE public.player_treasury
     SET wallet_gp = 5400, player_level = 6, current_xp = 890, current_streak_days = 12, fixed_costs_spent_cop = 320000
     WHERE user_id = $1 AND billing_period = '2026-11'`,
    [USER_A]
  );

  // Re-ejecutar onboarding (edición de presupuesto)
  const second = await db.query<{ mode: string; wallet_gp: number; player_level: number; current_xp: number }>(
    `SELECT * FROM public.fn_phase10_upsert_onboarding_treasury('2026-11', 3600000, 1200000, 600000, 300000, 'avalanche')`
  );
  assert.equal(second.rows[0].mode, "edit");
  assert.equal(second.rows[0].wallet_gp, 5400, "wallet_gp debe preservarse intacto");
  assert.equal(second.rows[0].player_level, 6, "player_level debe preservarse intacto");
  assert.equal(second.rows[0].current_xp, 890, "current_xp debe preservarse intacto");

  const full = await db.query<{
    monthly_income_cop: number;
    fixed_costs_spent_cop: number;
    current_streak_days: number;
    debt_strategy: string;
  }>("SELECT monthly_income_cop, fixed_costs_spent_cop, current_streak_days, debt_strategy FROM public.player_treasury");
  assert.equal(full.rows.length, 1, "Sin duplicados en player_treasury");
  assert.equal(full.rows[0].monthly_income_cop, 3600000);
  assert.equal(full.rows[0].fixed_costs_spent_cop, 320000);
  assert.equal(full.rows[0].current_streak_days, 12);
  assert.equal(full.rows[0].debt_strategy, "avalanche");

  await db.exec("RESET ROLE;");
});

test("2. GATE 3 (PGlite): dos guardados simultáneos y reenvío idempotente no duplican ni pierden progreso", async () => {
  await db.exec(`
    SET ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub', '${USER_B}', false);
  `);

  const [r1, r2] = await Promise.all([
    db.query(`SELECT * FROM public.fn_phase10_upsert_onboarding_treasury('2026-11', 2000000, 700000, 300000, 150000, 'snowball')`),
    db.query(`SELECT * FROM public.fn_phase10_upsert_onboarding_treasury('2026-11', 2000000, 700000, 300000, 150000, 'snowball')`),
  ]);
  assert.equal(r1.rows.length, 1);
  assert.equal(r2.rows.length, 1);

  const countB = await db.query<{ c: string }>("SELECT count(*)::text AS c FROM public.player_treasury");
  assert.equal(Number(countB.rows[0].c), 1, "USER_B solo ve 1 registro propio y 0 de USER_A");

  // anon rechazado en la RPC
  await db.exec("RESET ROLE; SET ROLE anon;");
  await assert.rejects(() =>
    db.query(`SELECT * FROM public.fn_phase10_upsert_onboarding_treasury('2026-11', 1000, 0, 0, 0, 'snowball')`)
  );
  await db.exec("RESET ROLE;");
});

test("3. GATE 2: borradores rechazan claves compartidas ('active'/'anon') y separan finanzas de localStorage", () => {
  const draft = createEmptyOnboardingDraft();
  draft.displayName = "isacarlope";
  draft.incomeSources = [
    { id: "i1", label: "Ingreso", amountCop: 2500000, payDay: 15, isVariable: false, kind: "recurring_income" },
  ];

  // Claves compartidas rechazadas
  saveOnboardingDraft("active", draft);
  assert.equal(loadOnboardingDraft("active"), null);
  saveOnboardingDraft("anon", draft);
  assert.equal(loadOnboardingDraft("anon"), null);

  // Usuario válido: guarda perfil sin exponer cifras financieras en localStorage (en Node sin sessionStorage, incomeSources vuelve vacío)
  saveOnboardingDraft(USER_A, draft);
  const loadedA = loadOnboardingDraft(USER_A);
  assert.equal(loadedA?.displayName, "isacarlope");
  assert.equal(loadedA?.incomeSources.length, 0, "Cifras financieras nunca se persisten en localStorage");
  assert.equal(loadOnboardingDraft(USER_B), null, "USER_B nunca lee borrador de USER_A");

  clearAllOnboardingDrafts();
});

test("4. GATE 4: initial-financial-movements.ts no expone nombres personales reales (Saris/Juanma/Somos)", () => {
  const src = fs.readFileSync("src/lib/initial-financial-movements.ts", "utf8");
  for (const personal of ["Juanma", "Saris", "Somos"]) {
    assert.ok(!src.includes(personal), `initial-financial-movements.ts no debe contener nombre personal: ${personal}`);
  }
});
