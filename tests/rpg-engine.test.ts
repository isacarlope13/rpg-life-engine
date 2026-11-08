import test from "node:test";
import assert from "node:assert/strict";
import {
  RPGEngineMemoryStore,
  calculateWcaTrimmedAverage,
  generateRubikScramble,
} from "../src/lib/demo-store.ts";
import {
  parseExpenseWithGemini,
  parseReceiptWithGeminiVision,
  generateGameMasterBriefing,
  extractCubeSpecsDeterministic,
  extractCubeSpecsWithGemini,
  extractBookSpecsDeterministic,
  extractBookSpecsWithGemini,
  planAgileProjectWithGemini,
} from "../src/lib/gemini.ts";

test("1. WCA Rubik Scramble & Trimmed Average (Ao5 / Ao12) math & edge cases", () => {
  const scramble = generateRubikScramble(20);
  const tokens = scramble.split(" ");
  assert.equal(tokens.length, 20);
  for (let i = 1; i < tokens.length; i++) {
    assert.notEqual(
      tokens[i][0],
      tokens[i - 1][0],
      "No two consecutive moves should be on the same face"
    );
  }

  // Ao5: quita el menor (15.0) y el mayor (25.0), promedia [18.0, 20.0, 22.0] = 20.0
  const ao5 = calculateWcaTrimmedAverage([15.0, 18.0, 20.0, 22.0, 25.0], 5);
  assert.equal(ao5, 20.0);

  // Ao12: 12 tiempos
  const twelveTimes = [
    14.2, 16.0, 17.0, 18.0, 19.0, 20.0, 20.0, 21.0, 22.0, 23.0, 24.0, 30.5,
  ];
  const ao12 = calculateWcaTrimmedAverage(twelveTimes, 12);
  // Suma sin 14.2 y 30.5 = 16+17+18+19+20+20+21+22+23+24 = 200 / 10 = 20.0
  assert.equal(ao12, 20.0);

  // Menos de 5 o 12 tiempos retorna null
  assert.equal(calculateWcaTrimmedAverage([18.0, 19.0, 20.0, 21.0], 5), null);
  assert.equal(calculateWcaTrimmedAverage([18.0, 19.0, 20.0, 21.0, 22.0], 12), null);
});

test("2. Skill Guild: Rubik PB solve, Reading book completion, Knitting rows, Study & Work", () => {
  const store = new RPGEngineMemoryStore();

  // 1. Rubik Solve con nuevo PB (< 17.84s)
  const rubikRes = store.logSkillSession({
    domain: "rubik",
    cube_type: "3x3",
    solve_time_seconds: 16.5,
    algorithm_learned: "OLL 21",
    duration_minutes: 20,
  });

  assert.equal(rubikRes.rubik_stats?.pb_seconds, 16.5);
  assert.equal(rubikRes.rubik_stats?.recent_solves[0].is_pb, true);
  // Racha subió de 2 a 3 -> Multiplicador 1.1x sobre (4000 base + 2000 bono PB = 6000) -> 6600 GP
  assert.equal(rubikRes.reward_impact.transferred_gp, 6600);

  // 2. Sesión de Lectura que completa el libro "La Psicología del Dinero" (165/280 -> +115 págs)
  const readRes = store.logSkillSession({
    domain: "reading",
    book_id: "book-1",
    pages_read: 115,
    duration_minutes: 120,
  });
  const book1 = store.readingBooks.find((b) => b.id === "book-1")!;
  assert.equal(book1.pages_read, 280);
  assert.equal(book1.status, "completed");
  assert.ok(readRes.reward_impact.transferred_gp > 8000);

  // 3. Sesión de Tejido que completa "Amigurumi Dragón" (38/60 -> +22 vueltas)
  const knitRes = store.logSkillSession({
    domain: "knitting",
    project_id: "knit-1",
    rows_completed: 22,
    duration_minutes: 60,
    stitches_notes: "Cierre de pieza y bordado de detalles",
  });
  const knit1 = store.knittingProjects.find((p) => p.id === "knit-1")!;
  assert.equal(knit1.completed_rows, 60);
  assert.equal(knit1.status, "completed");
  assert.ok(knitRes.reward_impact.transferred_gp > 8000);

  // 4. Sesión de Estudio y Trabajo
  store.logSkillSession({
    domain: "study",
    subject: "Sistemas Distribuidos",
    study_method: "Active Recall",
    duration_minutes: 50,
  });
  store.logSkillSession({
    domain: "work",
    deliverable: "API Shortcuts v3",
    impact_level: "milestone",
    duration_minutes: 90,
  });

  // Al llegar a 7 días de racha (2 inicial + 5 sesiones = 7), debe ganar +1 Escudo Aegis y buff 1.25x
  assert.equal(store.current_streak_days, 7);
  assert.equal(store.streak_multiplier, 1.25);
  assert.equal(store.aegis_shields, 2);

  const summaries = store.getSkillDomainSummaries();
  assert.equal(summaries.length, 7);
  assert.ok(summaries.slice(0, 5).every((s) => s.sessions_count >= 1));
});

test("3. Idempotency protection, Streak Multiplier penalty recalculation & Limit Break", () => {
  const store = new RPGEngineMemoryStore();

  // Sube racha de 2 -> 3 días (Multiplicador 1.1x)
  const act1 = store.completeActivity({
    code: "STUDY_BLOCK",
    title: "Estudio",
    requested_gp: 5000,
    earned_xp: 100,
    idempotency_key: "idem-act-1",
  });
  assert.equal(act1.idempotent_replay, false);
  assert.equal(store.current_streak_days, 3);
  assert.equal(store.streak_multiplier, 1.1);
  assert.equal(store.wallet_gp, 5500);

  // Reintento con la misma idempotency_key no debe duplicar GP ni subir racha
  const act1Replay = store.completeActivity({
    code: "STUDY_BLOCK",
    title: "Estudio",
    requested_gp: 5000,
    earned_xp: 100,
    idempotency_key: "idem-act-1",
  });
  assert.equal(act1Replay.idempotent_replay, true);
  assert.equal(store.current_streak_days, 3);
  assert.equal(store.wallet_gp, 5500);

  // Gasto impulsivo sin usar Escudo Aegis: aplica 1.2x, baja racha de 3 -> 2 y recalcula multiplicador a 1.0x
  const tx = store.recordTransaction({
    amount_cop: 10000,
    category: "discretionary_unbudgeted",
    merchant_or_concept: "Antojo Rappi",
    use_aegis_shield: false,
    idempotency_key: "idem-tx-1",
  });
  assert.equal(tx.wallet_gp_deducted, 12000);
  assert.equal(tx.penalty_gp_applied, 2000);
  assert.equal(store.current_streak_days, 2);
  assert.equal(store.streak_multiplier, 1.0);

  // Reintento idempotente del gasto no vuelve a cobrar
  const txReplay = store.recordTransaction({
    amount_cop: 10000,
    category: "discretionary_unbudgeted",
    merchant_or_concept: "Antojo Rappi",
    use_aegis_shield: false,
    idempotency_key: "idem-tx-1",
  });
  assert.equal(txReplay.idempotent_replay, true);
  assert.equal(store.wallet_gp, 5500 - 12000);

  // Limit Break: sacrifica 50,000 GP de la Bóveda para atacar a Nequi
  const prevNequiHp = store.bosses[0].current_hp;
  const lb = store.triggerLimitBreak(50000);
  assert.equal(lb.sacrificed_gp, 50000);
  assert.equal(store.bosses[0].current_hp, prevNequiHp - 50000);
});

test("4. Combo Overflow across bosses, Boss Counter-Attack & Operational Budget Overrun", () => {
  const store = new RPGEngineMemoryStore();

  // Ataque de $200,000 COP a Nequi ($165,442 HP): mata a Nequi y desborda $34,558 de daño a ADDI
  const combo = store.recordTransaction({
    amount_cop: 200000,
    category: "debt_attack",
    merchant_or_concept: "Abono Extra Deuda",
    boss_name: "Nequi",
  });
  assert.equal(store.bosses[0].current_hp, 0);
  assert.equal(store.bosses[0].status, "defeated");
  assert.equal(combo.overflow_damage_cop, 34558);
  assert.equal(store.bosses[1].current_hp, 1137647 - 34558);

  // Sobrecosto en presupuesto variable operativo ($540,000 tope, inicia en $185,000 -> +$400,000 = $585,000 -> $45,000 overrun)
  const opsTx = store.recordTransaction({
    amount_cop: 400000,
    category: "variable_operational",
    merchant_or_concept: "Gasto Médico Extraordinario",
  });
  assert.equal(opsTx.budget_overrun_cop, 45000);

  // Cierre de mes: Boss Counter-Attack regenera intereses en ADDI y Bancolombia
  const ca = store.triggerBossCounterAttack();
  assert.ok(ca.total_interest_healed_cop > 0);
  assert.equal(ca.enraged_bosses_count, 2); // ADDI y Bancolombia no cumplieron pago mínimo completo
  assert.equal(ca.vault_gp_locked_by_enrage, 80000);
});

test("5. Debt Strategy Comparison (Snowball vs Avalanche), Dynamic Receipt Split & GameMaster", async () => {
  const store = new RPGEngineMemoryStore();
  const comp = store.getDebtStrategyComparison();

  assert.equal(comp.monthly_snowball_power_cop, 512000);
  assert.ok(
    comp.interest_saved_with_avalanche_cop > 0,
    "Avalanche (ADDI 28.9% first) must save interest compared to Snowball (Nequi 26.5% first)"
  );

  // Cambiar a Avalanche cambia el orden de prioridad en TTK projections (ADDI primero)
  store.setDebtStrategy("avalanche");
  const projections = store.getBossTTKProjections();
  assert.equal(projections[0].name, "ADDI");

  // Dynamic Receipt Split test con montos personalizados
  const split = await parseReceiptWithGeminiVision({
    receipt_text:
      "CARULLA\n1x Pechuga $30.000\n1x Arroz $10.000\n1x Cerveza Poker $15.000\n1x Chocolatina Jet $5.000\nTOTAL: $60.000",
  });
  assert.equal(split.merchant_name, "CARULLA");
  assert.equal(split.operational_essential_cop, 40000);
  assert.equal(split.discretionary_unbudgeted_cop, 20000);
  assert.equal(split.total_cop, 60000);

  // Fixed mandatory SMS classification
  const fixedSms = await parseExpenseWithGemini(
    "Bancolombia: Pagaste $95.000 en GIMNASIO SMARTFIT con tu T.Debito"
  );
  assert.equal(fixedSms.category, "fixed_mandatory");
  assert.equal(fixedSms.amount_cop, 95000);

  // Briefing incluye PB de Rubik y ahorro de Avalancha
  const briefing = await generateGameMasterBriefing({
    wallet_gp: store.wallet_gp,
    vault_remaining_gp: store.vault_remaining_gp,
    total_penalty_gp: store.total_penalty_gp,
    streak_days: store.current_streak_days,
    aegis_shields: store.aegis_shields,
    bosses: store.bosses,
    rubik_pb: 17.84,
    rubik_ao5: 19.42,
    interest_saved_avalanche: comp.interest_saved_with_avalanche_cop,
  });
  assert.ok(briefing.includes("17.84s"));
  assert.ok(briefing.includes("Avalancha"));
});

test("6. WCA Regulation 9f9: Single DNF vs Double DNF in Ao5/Ao12, +2s penalty & Multi-Cube Stats", () => {
  // 1 DNF (Infinity) in Ao5 counts as worst time and is dropped: [18.0, 20.0, 22.0] avg = 20.0
  assert.equal(
    calculateWcaTrimmedAverage([15.0, 18.0, 20.0, 22.0, Infinity], 5),
    20.0
  );
  // 2 DNFs in Ao5 must return null (DNF average), NEVER NaN
  assert.equal(
    calculateWcaTrimmedAverage([15.0, 18.0, 20.0, Infinity, Infinity], 5),
    null
  );

  const store = new RPGEngineMemoryStore();
  const allStats = store.getAllRubikStats();
  assert.equal(allStats["3x3"].pb_seconds, 17.84);
  assert.equal(allStats["3x3"].ao5_seconds, 19.42);
  assert.ok(allStats["3x3"].ao12_seconds !== null);
  assert.equal(allStats["2x2"].pb_seconds, 5.42);
  assert.equal(allStats["4x4"].pb_seconds, 68.4);

  // Solve con penalización +2s: 16.50s + 2s = 18.50s (No rompe PB de 17.84s, pero sí es Sub-20s)
  const plusTwoRes = store.logSkillSession({
    domain: "rubik",
    cube_type: "3x3",
    solve_time_seconds: 16.5,
    penalty: "+2",
    duration_minutes: 15,
  });
  assert.equal(plusTwoRes.rubik_stats?.recent_solves[0].time_seconds, 18.5);
  assert.equal(plusTwoRes.rubik_stats?.recent_solves[0].is_pb, false);
  assert.equal(plusTwoRes.rubik_stats?.pb_seconds, 17.84);

  // Solve con DNF: no altera PB ni produce NaN en Ao5/Ao12/Mean
  const dnfRes = store.logSkillSession({
    domain: "rubik",
    cube_type: "3x3",
    solve_time_seconds: 14.0,
    penalty: "DNF",
    duration_minutes: 15,
  });
  assert.equal(dnfRes.rubik_stats?.pb_seconds, 17.84);
  assert.equal(dnfRes.rubik_stats?.recent_solves[0].is_pb, false);
  assert.ok(
    dnfRes.rubik_stats?.ao5_seconds !== null &&
      !Number.isNaN(dnfRes.rubik_stats?.ao5_seconds)
  );
});

test("7. Idempotency in logSkillSession prevents duplicate Rubik solves, double book pages & double knitting rows", () => {
  const store = new RPGEngineMemoryStore();
  const initialSolvesCount = store.rubikSolves.length;

  store.logSkillSession({
    domain: "rubik",
    cube_type: "3x3",
    solve_time_seconds: 18.2,
    duration_minutes: 20,
    idempotency_key: "idem-rubik-solve-1",
  });
  store.logSkillSession({
    domain: "rubik",
    cube_type: "3x3",
    solve_time_seconds: 18.2,
    duration_minutes: 20,
    idempotency_key: "idem-rubik-solve-1",
  });
  assert.equal(store.rubikSolves.length, initialSolvesCount + 1);

  const bookBefore = store.readingBooks.find((b) => b.id === "book-1")!.pages_read;
  store.logSkillSession({
    domain: "reading",
    book_id: "book-1",
    pages_read: 20,
    duration_minutes: 30,
    idempotency_key: "idem-read-sess-1",
  });
  const replayRead = store.logSkillSession({
    domain: "reading",
    book_id: "book-1",
    pages_read: 20,
    duration_minutes: 30,
    idempotency_key: "idem-read-sess-1",
  });
  assert.equal(replayRead.reward_impact.idempotent_replay, true);
  assert.equal(
    store.readingBooks.find((b) => b.id === "book-1")!.pages_read,
    bookBefore + 20
  );

  const knitBefore = store.knittingProjects.find((p) => p.id === "knit-1")!.completed_rows;
  store.logSkillSession({
    domain: "knitting",
    project_id: "knit-1",
    rows_completed: 6,
    duration_minutes: 25,
    idempotency_key: "idem-knit-sess-1",
  });
  const replayKnit = store.logSkillSession({
    domain: "knitting",
    project_id: "knit-1",
    rows_completed: 6,
    duration_minutes: 25,
    idempotency_key: "idem-knit-sess-1",
  });
  assert.equal(replayKnit.reward_impact.idempotent_replay, true);
  assert.equal(
    store.knittingProjects.find((p) => p.id === "knit-1")!.completed_rows,
    knitBefore + 6
  );

  // Creación de nuevo libro y nuevo proyecto de tejido
  const newBook = store.addReadingBook({
    title: "Clean Architecture",
    author: "Robert C. Martin",
    total_pages: 432,
  });
  assert.equal(newBook.pages_read, 0);
  const newProj = store.addKnittingProject({
    name: "Gorrito Tejido Invierno",
    technique: "Dos Agujas",
    total_rows_target: 80,
  });
  assert.equal(newProj.completed_rows, 0);
});

test("8. Currency parser edge cases (leading dates, quantities, *4491 card suffix, 1000ml receipt lines) & Enraged Boss persistence", async () => {
  const smsLeadingDate = await parseExpenseWithGemini(
    "05/11/2026 Bancolombia: Compraste $32.500 en RAPPI con tu T.Debito *4491"
  );
  assert.equal(smsLeadingDate.amount_cop, 32500);

  const voiceQuantity = await parseExpenseWithGemini(
    "Compré 2 cafés por $18.000 en Juan Valdez"
  );
  assert.equal(voiceQuantity.amount_cop, 18000);

  const cardFirst = await parseExpenseWithGemini(
    "Con tu T.Debito *4491 compraste $50.000 en RESTAURANTE"
  );
  assert.equal(cardFirst.amount_cop, 50000);

  const receiptWithMl = await parseReceiptWithGeminiVision({
    receipt_text:
      "EXITO\n1x Leche Deslactosada 1000ml $6.500\n1x Gaseosa Coca-Cola 1500ml $7.500",
  });
  assert.equal(receiptWithMl.operational_essential_cop, 6500);
  assert.equal(receiptWithMl.discretionary_unbudgeted_cop, 7500);
  assert.equal(receiptWithMl.total_cop, 14000);

  // Enraged Boss permanece enraged si el abono es menor a min_monthly_payment_cop ($45,000 para Nequi)
  const store = new RPGEngineMemoryStore();
  store.triggerBossCounterAttack();
  assert.equal(store.bosses[0].status, "enraged");

  store.recordTransaction({
    amount_cop: 10000,
    category: "debt_attack",
    merchant_or_concept: "Abono parcial Nequi",
    boss_name: "Nequi",
  });
  assert.equal(store.bosses[0].status, "enraged");

  // Al completar la cuota mínima ($10,000 + $35,000 = $45,000), sale de estado enraged
  store.recordTransaction({
    amount_cop: 35000,
    category: "debt_attack",
    merchant_or_concept: "Completa cuota mínima Nequi",
    boss_name: "Nequi",
  });
  assert.equal(store.bosses[0].status, "active");
});

test("9. Supabase .env.local setup, seed.sql idempotency & Shortcut API Key verification", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const {
    isSupabaseConfigured,
    resolvePlayerTreasury,
    resolvePlayerUserId,
    verifyShortcutApiKey,
  } = await import("../src/lib/supabase.ts");

  const envLocalPath = path.resolve(process.cwd(), ".env.local");
  assert.ok(fs.existsSync(envLocalPath), ".env.local must exist");
  const envContent = fs.readFileSync(envLocalPath, "utf8");
  assert.ok(envContent.includes("NEXT_PUBLIC_SUPABASE_URL="));
  assert.ok(envContent.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY="));
  assert.ok(envContent.includes("SUPABASE_SERVICE_ROLE_KEY="));
  assert.ok(envContent.includes("DEFAULT_PLAYER_USER_ID="));
  assert.ok(envContent.includes("SHORTCUTS_API_SECRET="));
  assert.ok(envContent.includes("GEMINI_API_KEY="));

  // Con los placeholders por defecto, debe mantenerse en modo local sin romper nada
  assert.equal(isSupabaseConfigured, false);
  assert.equal(await resolvePlayerUserId(), null);
  assert.equal(
    await resolvePlayerTreasury("11111111-1111-4111-8111-111111111111"),
    null
  );

  const schemaSqlPath = path.resolve(process.cwd(), "supabase/schema.sql");
  assert.ok(fs.existsSync(schemaSqlPath), "supabase/schema.sql must exist");
  const schemaSql = fs.readFileSync(schemaSqlPath, "utf8");

  const seedSqlPath = path.resolve(process.cwd(), "supabase/seed.sql");
  assert.ok(fs.existsSync(seedSqlPath), "supabase/seed.sql must exist");
  const seedSql = fs.readFileSync(seedSqlPath, "utf8");

  // Ambos archivos (schema.sql y seed.sql) deben ser 100% auto-reparables sobre una BD Fase 1/2
  for (const [label, sql] of [
    ["schema.sql", schemaSql],
    ["seed.sql", seedSql],
  ] as const) {
    assert.ok(
      sql.includes("WHEN duplicate_object THEN NULL"),
      `${label} must wrap ENUM creation in idempotent DO blocks`
    );
    assert.ok(
      sql.includes("CREATE TABLE IF NOT EXISTS public.player_treasury"),
      `${label} must use CREATE TABLE IF NOT EXISTS for player_treasury`
    );
    assert.ok(
      sql.includes("CREATE TABLE IF NOT EXISTS public.debt_bosses"),
      `${label} must use CREATE TABLE IF NOT EXISTS for debt_bosses`
    );
    assert.ok(
      sql.includes("CREATE TABLE IF NOT EXISTS public.quest_catalog"),
      `${label} must use CREATE TABLE IF NOT EXISTS for quest_catalog`
    );
    assert.ok(
      sql.includes("CREATE TABLE IF NOT EXISTS public.activity_logs"),
      `${label} must use CREATE TABLE IF NOT EXISTS for activity_logs`
    );
    assert.ok(
      sql.includes("CREATE TABLE IF NOT EXISTS public.reading_books"),
      `${label} must use CREATE TABLE IF NOT EXISTS for reading_books`
    );
    assert.ok(
      sql.includes("CREATE TABLE IF NOT EXISTS public.knitting_projects"),
      `${label} must use CREATE TABLE IF NOT EXISTS for knitting_projects`
    );
    assert.ok(
      sql.includes("CREATE TABLE IF NOT EXISTS public.rubik_solves"),
      `${label} must use CREATE TABLE IF NOT EXISTS for rubik_solves`
    );
    assert.ok(
      sql.includes(
        "ALTER TABLE public.player_treasury ADD COLUMN IF NOT EXISTS fixed_costs_spent_cop"
      ),
      `${label} must add fixed_costs_spent_cop if missing`
    );
    assert.ok(
      sql.includes(
        "ALTER TABLE public.player_treasury ADD COLUMN IF NOT EXISTS variable_ops_spent_cop"
      ),
      `${label} must add variable_ops_spent_cop if missing`
    );
    assert.ok(
      sql.includes(
        "ALTER TABLE public.player_treasury ADD COLUMN IF NOT EXISTS debt_strategy"
      ),
      `${label} must add debt_strategy if missing`
    );
    assert.ok(
      sql.includes(
        "ALTER TABLE public.player_treasury ADD COLUMN IF NOT EXISTS current_streak_days"
      ),
      `${label} must add current_streak_days if missing`
    );
    assert.ok(
      sql.includes(
        "ALTER TABLE public.player_treasury ADD COLUMN IF NOT EXISTS streak_multiplier"
      ),
      `${label} must add streak_multiplier if missing`
    );
    assert.ok(
      sql.includes(
        "ALTER TABLE public.player_treasury ADD COLUMN IF NOT EXISTS aegis_shields"
      ),
      `${label} must add aegis_shields if missing`
    );
    assert.ok(
      sql.includes(
        "ALTER TABLE public.player_treasury ADD COLUMN IF NOT EXISTS last_activity_date"
      ),
      `${label} must add last_activity_date if missing`
    );
    assert.ok(
      sql.includes(
        "ALTER TABLE public.debt_bosses ADD COLUMN IF NOT EXISTS interest_rate_ea"
      ),
      `${label} must add interest_rate_ea to debt_bosses if missing`
    );
    assert.ok(
      sql.includes(
        "ALTER TABLE public.quest_catalog ADD COLUMN IF NOT EXISTS domain"
      ),
      `${label} must add domain to quest_catalog if missing`
    );
    assert.ok(
      sql.includes(
        "DROP TRIGGER IF EXISTS trg_before_insert_activity_log ON public.activity_logs"
      ),
      `${label} must drop trigger if exists before recreating`
    );
    assert.ok(
      sql.includes(
        "DROP TRIGGER IF EXISTS trg_before_insert_financial_tx ON public.financial_transactions"
      ),
      `${label} must drop financial trigger if exists before recreating`
    );
    assert.ok(
      sql.includes(
        'DROP POLICY IF EXISTS "Users manage own treasury" ON public.player_treasury'
      ),
      `${label} must drop RLS policies if they exist before recreating`
    );
    assert.ok(
      sql.includes("SET check_function_bodies = off;"),
      `${label} must disable check_function_bodies before CREATE OR REPLACE FUNCTION to avoid PG 55P04 on newly added enum values in the same transaction`
    );
    assert.ok(
      sql.includes(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_player_treasury_user_period"
      ),
      `${label} must ensure unique index on player_treasury(user_id, billing_period)`
    );
    assert.ok(
      sql.includes(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_quest_catalog_user_code"
      ),
      `${label} must ensure unique index on quest_catalog(user_id, code)`
    );
    assert.ok(
      sql.includes(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_logs_idempotency_key"
      ),
      `${label} must ensure unique index on activity_logs(idempotency_key)`
    );
    assert.ok(
      sql.includes(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_tx_idempotency_key"
      ),
      `${label} must ensure unique index on financial_transactions(idempotency_key)`
    );

    const alterAddColumnLines = sql
      .split("\n")
      .filter((line) => line.trim().startsWith("ALTER TABLE ") && line.includes("ADD COLUMN IF NOT EXISTS"));
    for (const line of alterAddColumnLines) {
      assert.ok(
        !line.includes(" UNIQUE") && !line.includes(" REFERENCES "),
        `${label} must not use inline UNIQUE or REFERENCES on ADD COLUMN IF NOT EXISTS: ${line}`
      );
    }
  }

  assert.ok(seedSql.includes("v_user_id UUID := NULL;"));
  assert.ok(
    seedSql.includes("IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id)"),
    "seed.sql must verify auth.users existence even when v_user_id is manually specified"
  );
  assert.ok(seedSql.includes("DELETE FROM public.debt_bosses db"));
  assert.ok(seedSql.includes("INSERT INTO public.player_treasury"));
  assert.ok(seedSql.includes("2300000.00"));
  assert.ok(seedSql.includes("848000.00"));
  assert.ok(seedSql.includes("540000.00"));
  assert.ok(seedSql.includes("165442.00"));
  assert.ok(seedSql.includes("1137647.00"));
  assert.ok(seedSql.includes("3000000.00"));
  assert.ok(seedSql.includes("INSERT INTO public.quest_catalog"));
  assert.ok(seedSql.includes("INSERT INTO public.reading_books"));
  assert.ok(seedSql.includes("INSERT INTO public.knitting_projects"));
  assert.ok(seedSql.includes("INSERT INTO public.rubik_solves"));
  assert.ok(seedSql.includes("INSERT INTO public.wishlist_items"));
  assert.ok(seedSql.includes("ON CONFLICT"));
  assert.ok(seedSql.includes("pt.user_id AS user_id"));
  assert.ok(seedSql.includes("default_player_user_id"));

  // Verificar validación de SHORTCUTS_API_SECRET
  const prevSecret = process.env.SHORTCUTS_API_SECRET;
  process.env.SHORTCUTS_API_SECRET = "test_secret_token_123";
  try {
    const validReq = new Request(
      "http://localhost:3000/api/shortcuts/habit-log",
      {
        method: "POST",
        headers: { "x-api-key": "test_secret_token_123" },
      }
    );
    assert.equal(verifyShortcutApiKey(validReq), true);

    const invalidReq = new Request(
      "http://localhost:3000/api/shortcuts/habit-log",
      {
        method: "POST",
        headers: { "x-api-key": "wrong_token" },
      }
    );
    assert.equal(verifyShortcutApiKey(invalidReq), false);

    const sameOriginDashboardReq = new Request(
      "http://localhost:3000/api/shortcuts/habit-log",
      {
        method: "POST",
        headers: { "sec-fetch-site": "same-origin" },
      }
    );
    assert.equal(verifyShortcutApiKey(sameOriginDashboardReq), true);
  } finally {
    process.env.SHORTCUTS_API_SECRET = prevSecret;
  }
});

test("10. Rubik's Cube & Book Specification Extractors (WCA/Hardware & Reading Specs) + Arsenal & Library Registration", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");

  // 1. Extracción determinista y con Gemini fallback para distintos modelos de Cubos de Rubik
  const gan14 = await extractCubeSpecsWithGemini("GAN 14 MagLev Pro 3x3 UV Coated");
  assert.equal(gan14.cube_type, "3x3");
  assert.equal(gan14.brand, "GAN");
  assert.ok(gan14.magnetic_system.includes("MagLev"));
  assert.equal(gan14.surface_finish, "UV Coated (Recubrimiento Brillante Alto Agarre)");
  assert.equal(gan14.wca_legal, true);
  assert.equal(gan14.reward_gp_per_solve, 4500);
  assert.equal(gan14.pb_bonus_gp, 2000);
  assert.equal(gan14.specs_compliance_checklist.length, 5);
  assert.ok(gan14.specs_compliance_checklist.every((item) => item.fulfilled === true));

  // Cubo 4x4 con dimensiones y peso personalizados en el prompt (sin espacios dobles residuales)
  const mgc4 = extractCubeSpecsDeterministic("YJ MGC 4x4 60mm 114g Frosted");
  assert.equal(mgc4.cube_type, "4x4");
  assert.equal(mgc4.brand, "YJ (YongJun)");
  assert.equal(mgc4.model_name, "YJ MGC 4x4 Frosted");
  assert.equal(mgc4.size_mm, 60.0);
  assert.equal(mgc4.weight_grams, 114);
  assert.equal(mgc4.recommended_alg_set, "Método Yau (3-2-3 Edge Pairing) + OLL/PLL Parity");

  // Cubo con meta Sub-X personalizada en el prompt
  const sub12Cube = extractCubeSpecsDeterministic("GAN 14 MagLev 3x3 Sub-12s");
  assert.equal(sub12Cube.target_sub_seconds, 12);
  assert.equal(sub12Cube.model_name, "GAN 14 MagLev 3x3");

  // Pyraminx y Megaminx
  const pyra = extractCubeSpecsDeterministic("QiYi MS Pyraminx Magnetic");
  assert.equal(pyra.cube_type, "Pyraminx");
  assert.equal(pyra.brand, "QiYi MoFangGe");
  assert.equal(pyra.recommended_alg_set, "Método L4E (Last 4 Edges) + Keyhole Intuitivo");

  const mega = extractCubeSpecsDeterministic("Dayan Megaminx Pro M");
  assert.equal(mega.cube_type, "Megaminx");
  assert.equal(mega.brand, "DaYan");

  // Edge case: Smart Cube con Bluetooth (No legal en torneos oficiales WCA Regla 3a)
  const smartCube = extractCubeSpecsDeterministic("GAN i3 3x3 Bluetooth Smart Cube");
  assert.equal(smartCube.wca_legal, false);
  const wcaCheck = smartCube.specs_compliance_checklist.find((c) => c.code === "WCA_REG_3A_4B");
  assert.ok(wcaCheck);
  assert.equal(wcaCheck.fulfilled, false);

  // 2. Registro de Cubo en el Arsenal del Store, overrides manuales y vinculación con Solve
  const store = new RPGEngineMemoryStore();
  assert.ok(store.rubikCubes.length >= 4, "Store must start with seeded Rubik's cube arsenal");

  const addedCube = store.addRubikCube({
    model_name: "MoYu Super RS3M V2 Ball-Core 3x3 UV",
    target_sub_seconds: 15,
  });
  assert.equal(addedCube.cube_type, "3x3");
  assert.equal(addedCube.brand, "MoYu");
  assert.equal(addedCube.target_sub_seconds, 15);
  assert.equal(addedCube.specs_compliance_checklist.length, 5);
  assert.ok(
    addedCube.specs_compliance_checklist.some((c) => c.requirement.includes("Sub-15s")),
    "Cube checklist must reflect overridden target_sub_seconds"
  );
  assert.equal(store.rubikCubes[0].id, addedCube.id);

  const solveWithCube = store.logSkillSession({
    domain: "rubik",
    cube_type: "3x3",
    cube_id: addedCube.id,
    solve_time_seconds: 17.1,
    algorithm_learned: "PLL T-Perm",
    duration_minutes: 15,
  });
  assert.equal(solveWithCube.rubik_stats?.recent_solves[0].cube_id, addedCube.id);
  assert.equal(solveWithCube.rubik_stats?.recent_solves[0].cube_model, addedCube.model_name);
  assert.equal(solveWithCube.session.metadata?.cube_id, addedCube.id);
  assert.equal(solveWithCube.session.metadata?.cube_model, addedCube.model_name);

  // Solve de 4x4 por debajo de su meta Sub-60s (pero sin romper PB previo si ponemos un PB menor primero)
  store.logSkillSession({
    domain: "rubik",
    cube_type: "4x4",
    solve_time_seconds: 50.0,
    duration_minutes: 15,
  });
  const sub60Solve4x4 = store.logSkillSession({
    domain: "rubik",
    cube_type: "4x4",
    solve_time_seconds: 55.0,
    duration_minutes: 15,
  });
  assert.ok(
    sub60Solve4x4.session.details.includes("Sub-60s"),
    "4x4 solve under 60s must trigger Sub-60s bonus using the 4x4 cube's target_sub_seconds"
  );

  // 3. Extracción de Ficha Técnica y Especificaciones de Lectura para Libros
  const cleanArch = await extractBookSpecsWithGemini("Clean Architecture Robert C. Martin");
  assert.ok(cleanArch.title.includes("Clean Architecture"));
  assert.ok(cleanArch.author.includes("Robert C. Martin"));
  assert.equal(cleanArch.total_pages, 432);
  assert.equal(cleanArch.complexity, "denso_tecnico");
  assert.equal(cleanArch.gp_per_page, 140);
  assert.equal(cleanArch.completion_bonus_gp, 6500);
  assert.equal(cleanArch.xp_per_session, 115);
  assert.equal(cleanArch.reading_specs_checklist.length, 5);
  assert.ok(cleanArch.reading_specs_checklist.every((item) => item.fulfilled === true));

  const frankl = extractBookSpecsDeterministic("El Hombre en Busca de Sentido Viktor Frankl");
  assert.equal(frankl.author, "Viktor E. Frankl");
  assert.equal(frankl.total_pages, 168);
  assert.equal(frankl.complexity, "ligero");
  assert.equal(frankl.gp_per_page, 100);
  assert.equal(frankl.completion_bonus_gp, 5000);

  // Libro personalizado con páginas, capítulos e ISBN explícitos en texto libre (sin dejar "ISBN" colgado en author)
  const customBookSpecs = extractBookSpecsDeterministic(
    "Distributed Rust Engines - Jane Doe 520 paginas 16 capitulos ISBN 978-1449373320"
  );
  assert.equal(customBookSpecs.title, "Distributed Rust Engines");
  assert.equal(customBookSpecs.author, "Jane Doe");
  assert.equal(customBookSpecs.total_pages, 520);
  assert.equal(customBookSpecs.total_chapters, 16);
  assert.equal(customBookSpecs.isbn, "978-1449373320");
  assert.equal(customBookSpecs.complexity, "denso_tecnico");
  assert.ok(customBookSpecs.estimated_hours > 20);

  // 4. Registro de Libro en Store con especificaciones completas y con overrides manuales
  const registeredBook = store.addReadingBook({
    title: cleanArch.title,
    author: cleanArch.author,
    total_pages: cleanArch.total_pages,
    category: cleanArch.category,
    isbn: cleanArch.isbn,
    language: cleanArch.language,
    total_chapters: cleanArch.total_chapters,
    complexity: cleanArch.complexity,
    estimated_hours: cleanArch.estimated_hours,
    recommended_daily_pages: cleanArch.recommended_daily_pages,
    gp_per_page: cleanArch.gp_per_page,
    completion_bonus_gp: cleanArch.completion_bonus_gp,
    xp_per_session: cleanArch.xp_per_session,
    key_learning_goal: cleanArch.key_learning_goal,
    reading_specs_checklist: cleanArch.reading_specs_checklist,
  });
  assert.equal(registeredBook.title, cleanArch.title);
  assert.equal(registeredBook.complexity, "denso_tecnico");
  assert.equal(registeredBook.gp_per_page, 140);
  assert.equal(registeredBook.reading_specs_checklist?.length, 5);

  // Override manual después de extraer (ej. cambiar páginas de 168 a 480 y complejidad de "ligero" a "denso_tecnico")
  const overriddenBook = store.addReadingBook({
    title: frankl.title,
    author: frankl.author,
    total_pages: 480,
    complexity: "denso_tecnico",
    isbn: "978-9999999999",
    reading_specs_checklist: frankl.reading_specs_checklist, // checklist viejo pasado por el cliente
  });
  assert.equal(overriddenBook.total_pages, 480);
  assert.equal(overriddenBook.complexity, "denso_tecnico");
  assert.equal(overriddenBook.gp_per_page, 140);
  assert.equal(overriddenBook.completion_bonus_gp, 6500);
  assert.ok(
    overriddenBook.reading_specs_checklist?.some((c) => c.requirement.includes("480 páginas")),
    "Book checklist must be rebuilt to reflect overridden total_pages"
  );
  assert.ok(
    overriddenBook.reading_specs_checklist?.some((c) => c.requirement.includes("+140 GP")),
    "Book checklist must be rebuilt to reflect overridden complexity GP reward"
  );

  // 5. Verificar que schema.sql y seed.sql incluyan la tabla rubik_cubes, specs_metadata y cube_model en rubik_solves
  const schemaSql = fs.readFileSync(path.resolve(process.cwd(), "supabase/schema.sql"), "utf8");
  const seedSql = fs.readFileSync(path.resolve(process.cwd(), "supabase/seed.sql"), "utf8");
  assert.ok(schemaSql.includes("CREATE TABLE IF NOT EXISTS public.rubik_cubes"));
  assert.ok(schemaSql.includes("ALTER TABLE public.reading_books ADD COLUMN IF NOT EXISTS specs_metadata"));
  assert.ok(schemaSql.includes("ALTER TABLE public.rubik_solves ADD COLUMN IF NOT EXISTS cube_model"));
  assert.ok(seedSql.includes("CREATE TABLE IF NOT EXISTS public.rubik_cubes"));
  assert.ok(seedSql.includes("INSERT INTO public.rubik_cubes"));
  assert.ok(seedSql.includes("ALTER TABLE public.rubik_solves ADD COLUMN IF NOT EXISTS cube_model"));
});

test("11. Debt Bosses Passive DoT & Enrage Timer, Wishlist Restraints & GP Overdrawn Auto-amortization", () => {
  const store = new RPGEngineMemoryStore();

  // 1. Verificar cálculo de DoT e Enrage Timer en Bosses
  store.updateBossesDoTAndEnrageStatus(new Date("2026-11-05T12:00:00Z"));
  const nequi = store.bosses.find((b) => b.id === "boss-nequi")!;
  assert.ok(nequi.daily_interest_dot_gp! > 0, "Nequi no purificado debe tener sangrado DoT pasivo diario");
  assert.equal(nequi.is_purified, false);

  // Aplicar Poción de Purificación (Abono a Capital)
  const purifyRes = store.applyPurificationPotion({
    boss_id: "boss-nequi",
    amount_cop: 50000,
  });
  assert.equal(purifyRes.purified, true);
  assert.equal(nequi.is_purified, true);
  assert.equal(nequi.daily_interest_dot_gp, 0, "DoT debe neutralizarse tras aplicar la Poción de Purificación");
  assert.equal(nequi.paid_this_month_cop, 50000);

  // Fecha posterior al corte sin pagar ADDI (corte día 28 -> test en día 29)
  store.updateBossesDoTAndEnrageStatus(new Date("2026-11-29T12:00:00Z"));
  const addi = store.bosses.find((b) => b.id === "boss-addi")!;
  assert.equal(addi.status, "enraged", "Boss no pagado después de fecha de corte debe entrar en estado ENRAGED");
  assert.equal(addi.enrage_timer_active, true);

  // 2. Tienda Wishlist: Restricción de Racha e Impuesto al Impulso (+20%)
  const wishlistDecorated = store.getDecoratedWishlist();
  const wishPriority2 = wishlistDecorated.find((w) => w.priority === 2)!;
  assert.equal(wishPriority2.min_streak_required, 3);

  // Con racha = 2 días, intentar redimir ítem de prioridad 2 debe fallar por racha insuficiente
  store.current_streak_days = 2;
  store.wallet_gp = 200000;
  assert.throws(
    () => {
      store.recordTransaction({
        amount_cop: 0,
        category: "discretionary_wishlist",
        merchant_or_concept: "Canje",
        wishlist_item_id: "wish-2",
      });
    },
    /Requiere una racha mínima de 3 días/,
    "Debe bloquear redención si no se cumple la racha mínima"
  );

  // Sube racha a 3 días y genera un sobregiro o desborde operativo para activar Impuesto al Impulso (+20%)
  store.current_streak_days = 3;
  store.variable_ops_spent_cop = store.variable_ops_budget_cop + 10000; // Desborde
  const taxedWishlist = store.getDecoratedWishlist();
  const wish1 = taxedWishlist.find((w) => w.id === "wish-1")!;
  assert.equal(wish1.impulse_tax_pct, 0.2, "Desborde presupuestario debe activar 20% de Impuesto al Impulso");
  assert.equal(wish1.effective_cost_gp, Math.round(85000 * 1.2));

  // 3. Refactorización Motor GP: Auto-amortización de Sobregiro y Levantamiento de Maldición
  store.wallet_gp = -3000; // Maldición de sobregiro
  store.vault_remaining_gp = 100000;
  const rescueActivity = store.completeActivity({
    code: "RESCUE_SESSION",
    title: "Sesión de Rescate y Enfoque",
    requested_gp: 5000,
    earned_xp: 100,
  });
  assert.equal(rescueActivity.amortized_overdrawn_gp, 3000, "Debe amortizar exactamente los 3000 GP del sobregiro");
  assert.equal(rescueActivity.curse_lifted, true, "La maldición de sobregiro debe ser levantada al pasar a saldo positivo");
  assert.ok(store.wallet_gp > 0, "Billetera debe quedar en saldo positivo");
});

test("12. Módulo de Trabajo: Proyectos Estratégicos vs Actividades Operativas (Scrum, Kanban, Lean)", () => {
  const store = new RPGEngineMemoryStore();

  // 1. Creación de Proyecto Estratégico Ágil
  const project = store.addWorkProject({
    name: "Automatización OPGs & Cargas Mayoristas",
    methodology: "lean",
    current_stage: "Mapear Cadena de Valor",
  });

  assert.ok(project.id.startsWith("proj-"));
  assert.equal(project.name, "Automatización OPGs & Cargas Mayoristas");
  assert.equal(project.methodology, "lean");
  assert.equal(project.current_stage, "Mapear Cadena de Valor");
  assert.equal(project.total_minutes_invested, 0);

  // 2. Registro de Sesión Deep Work vinculada al Proyecto
  const sessionResult = store.logSkillSession({
    domain: "work",
    duration_minutes: 60,
    work_mode: "projects",
    project_id: project.id,
    deliverable: "Automatización de Macros y Carga de Plantillas",
    agile_stage: "Optimizar / Automatizar",
    impact_level: "high_impact",
  });

  assert.equal(project.total_minutes_invested, 60);
  assert.equal(project.current_stage, "Optimizar / Automatizar");
  assert.equal(sessionResult.session.metadata?.work_mode, "projects");
  assert.equal(sessionResult.session.metadata?.agile_methodology, "lean");
  assert.equal(sessionResult.session.metadata?.agile_stage, "Optimizar / Automatizar");
  assert.ok(sessionResult.session.gp_earned > 0);
  assert.ok(sessionResult.session.xp_earned > 0);

  // 3. Registro de Actividad Operativa Diaria (Rutina / OPGs)
  const opSession = store.logSkillSession({
    domain: "work",
    duration_minutes: 35,
    work_mode: "activities",
    deliverable: "Procesamiento manual de 40 OPGs mayoristas",
  });

  assert.equal(opSession.session.metadata?.work_mode, "activities");
  assert.ok(opSession.session.title.includes("Actividad Operativa"));
  assert.ok(opSession.session.gp_earned > 0);
});

test("13. Tablero Trello para Proyectos y Skill de Gemini IA (planAgileProjectWithGemini)", async () => {
  const store = new RPGEngineMemoryStore();

  // 1. Skill de Gemini: Planificación de Proyecto Ágil con Backlog / Trello
  const aiPlan = await planAgileProjectWithGemini(
    "Automatización de procesamiento y validación de 200 OPGs mayoristas"
  );
  assert.ok(aiPlan.name.length > 0);
  assert.equal(aiPlan.methodology, "lean");
  assert.ok(aiPlan.tasks.length >= 3);
  assert.ok(aiPlan.suggested_stages.includes("Optimizar / Automatizar"));

  // 2. Creación de Proyecto a partir del plan generado por la IA
  const project = store.addWorkProject({
    name: aiPlan.name,
    description: aiPlan.description,
    methodology: aiPlan.methodology,
    tasks: aiPlan.tasks,
  });

  assert.equal(project.tasks?.length, aiPlan.tasks.length);
  assert.equal(project.tasks_count, aiPlan.tasks.length);
  assert.equal(project.completed_tasks_count, 0);

  // 3. Añadir una nueva tarjeta al Trello del proyecto
  const newTask = store.addWorkProjectTask({
    project_id: project.id,
    title: "Creación de Dashboard de Métricas de Tiempo Ahorrado",
    description: "Visualizar horas recuperadas al automatizar el proceso.",
    stage: "Mapear Cadena de Flujo",
    priority: "high",
    estimated_minutes: 50,
  });
  assert.equal(newTask.project_id, project.id);
  assert.equal(newTask.stage, "Mapear Cadena de Flujo");
  assert.equal(newTask.is_completed, false);
  assert.equal(project.tasks?.length, aiPlan.tasks.length + 1);

  // 4. Mover tarjeta entre columnas del Trello (drag & drop / cambio de etapa)
  const movedTask = store.moveWorkProjectTask({
    project_id: project.id,
    task_id: newTask.id,
    target_stage: "Optimizar / Automatizar",
  });
  assert.equal(movedTask.stage, "Optimizar / Automatizar");

  // 5. Completar tarjeta del Trello: marca como hecha, acumula minutos y forja GP/XP
  const initialWallet = store.wallet_gp;
  const initialMinutes = project.total_minutes_invested || 0;
  const comp = store.completeWorkProjectTask({
    project_id: project.id,
    task_id: newTask.id,
  });

  assert.equal(comp.task.is_completed, true);
  assert.equal(comp.task.stage, "Optimizar / Automatizar");
  assert.equal(project.completed_tasks_count, 1);
  assert.equal(project.total_minutes_invested, initialMinutes + 50);
  assert.ok(store.wallet_gp > initialWallet, "Completar la tarjeta del Trello debe liberar GP a la Billetera");
});

test("14. Cronograma Biológico Circadiano: persistencia de horas de vigilia, sueño y ventanas", () => {
  const store = new RPGEngineMemoryStore();
  const initial = store.dailySchedule;
  assert.ok(initial);

  const updated = store.updateDailySchedule({
    wake_up_time: "05:30",
    sleep_time: "21:45",
    weekend_wake_up_time: "07:00",
    weekend_sleep_time: "22:30",
    work_start_hour: "08:30",
    work_end_hour: "17:30",
    free_slot_preference: "before_work",
  });

  assert.equal(updated.wake_up_time, "05:30");
  assert.equal(updated.sleep_time, "21:45");
  assert.equal(updated.weekend_wake_up_time, "07:00");
  assert.equal(updated.weekend_sleep_time, "22:30");
  assert.equal(updated.work_start_hour, "08:30");
  assert.equal(updated.work_end_hour, "17:30");
  assert.equal(updated.free_slot_preference, "before_work");

  // Verificar que la propiedad en memoria se actualizó
  assert.equal(store.dailySchedule.wake_up_time, "05:30");
  assert.equal(store.dailySchedule.free_slot_preference, "before_work");
});

test("15. Spaced Repetition SM-2: cálculo de intervalos, factores de facilidad y forja de XP", () => {
  const store = new RPGEngineMemoryStore();
  assert.ok(store.spacedCards.length >= 3, "Debe iniciar con tarjetas precargadas");

  const card = store.spacedCards[0];
  const initialXp = store.current_xp;

  // Repaso 1: calificación "Fácil" (4)
  const res1 = store.reviewSpacedCard({ card_id: card.id, rating: 4 });
  assert.equal(res1.card.repetition, 1);
  assert.ok(res1.card.interval_days >= 2);
  assert.ok(store.current_xp > initialXp, "Debe otorgar XP");
  assert.ok(res1.card.ease_factor > 2.5, "Ease factor debe aumentar con calificación 4");

  // Repaso 2: calificación "Bien" (3)
  const res2 = store.reviewSpacedCard({ card_id: card.id, rating: 3 });
  assert.equal(res2.card.repetition, 2);
  assert.ok(res2.card.interval_days >= 4);

  // Repaso 3: calificación "Olvidado" (1) -> resetea repetición e intervalo a 1
  const res3 = store.reviewSpacedCard({ card_id: card.id, rating: 1 });
  assert.equal(res3.card.repetition, 0);
  assert.equal(res3.card.interval_days, 1);
});

test("16. Árbol de Talentos Pasivos: desbloqueo de perks por nivel y mitigación de DoT/Impuestos", () => {
  const store = new RPGEngineMemoryStore();
  // Al nivel 1, puntos disponibles = max(0, 1 - 1) = 0
  const failUnlock = store.unlockTalentPerk("mente_absorbente");
  assert.equal(failUnlock.success, false, "Nivel 1 no tiene puntos para desbloquear");

  // Subir nivel a 5 otorgando XP
  store.current_xp = 4200;
  store.player_level = 5;

  // Desbloquear 'escudo_austeridad' (-10% DoT de deudas)
  const unlockRes = store.unlockTalentPerk("escudo_austeridad");
  assert.equal(unlockRes.success, true);
  assert.ok(store.unlockedPerks.includes("escudo_austeridad"));

  // Verificar que el talento está activo en el listado
  const perks = store.getTalentPerks();
  const austerity = perks.find((p) => p.id === "escudo_austeridad");
  assert.equal(austerity?.is_unlocked, true);
});

test("17. Política de Tratamiento de Datos: Aceptación obligatoria, Habeas Data y registro de consentimiento", () => {
  const store = new RPGEngineMemoryStore();

  assert.equal(store.data_privacy_accepted, true);
  assert.ok(store.privacy_accepted_at);
  assert.equal(store.privacy_version, "3.4");

  store.applyOnboarding({
    display_name: "GuerreroPrivacidad",
    character_class: "Paladín de Datos",
    currency: "COP",
    timezone: "America/Bogota",
    monthly_income: 3500000,
    pay_frequency: "monthly",
    pay_day: 15,
    fixed_costs: [{ name: "Arriendo", amount: 1200000, category: "hogar" }],
    variable_ops_budget: 800000,
    vault_cap: 1000000,
    debt_strategy: "avalanche",
    bosses: [],
    skills: [{ domain: "study", label: "Estudio Profundo", weekly_target_minutes: 180 }],
    wishlist: [{ name: "Libro Físico", cost_gp: 50000, priority: 1 }],
    data_privacy_accepted: true,
    privacy_accepted_at: new Date().toISOString(),
    privacy_version: "3.4",
  });

  assert.equal(store.data_privacy_accepted, true);
  assert.ok(store.privacy_accepted_at);
  assert.equal(store.privacy_version, "3.4");
});






