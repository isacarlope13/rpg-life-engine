import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildSafeTreasuryPatch,
  computeIdempotentCollectionDiff,
  persistOnboardingSafely,
  sanitizeSkillDomain,
} from "../src/lib/onboarding/onboarding-persistence.ts";
import {
  EIGHT_LIFE_AREAS,
  buildCharacterSheet,
  computeRealFinanceSummary,
  createEmptyOnboardingDraft,
  loadOnboardingDraft,
  saveOnboardingDraft,
  clearOnboardingDraft,
} from "../src/lib/onboarding/personal-onboarding-engine.ts";
import {
  buildAdaptiveDayPlan,
  recommendFreeSlotActivities,
} from "../src/lib/planner/adaptive-calendar-engine.ts";
import { buildRowanDecisionRecommendation } from "../src/lib/ai/rowan-decision-engine.ts";

describe("OAKHAVEN FASE 10 — IDENTIDAD SEGURA, ONBOARDING PERSONAL Y LIFE OS", () => {
  test("1. Cero datos financieros del piloto ni credenciales hardcodeadas en onboarding y login públicos", () => {
    const onboardingSrc = fs.readFileSync("src/app/onboarding/page.tsx", "utf8");
    const loginSrc = fs.readFileSync("src/app/login/page.tsx", "utf8");

    for (const forbidden of ["Juanma", "2415000", "5163707", "Natillera", "ADDI", "Préstamo Nequi"]) {
      assert.ok(!onboardingSrc.includes(forbidden), `onboarding/page.tsx no debe contener ${forbidden}`);
    }
    for (const forbidden of ["player1@rpg-life-engine.local", "202611", "Cuenta Maestra Pre-Calibrada"]) {
      assert.ok(!loginSrc.includes(forbidden), `login/page.tsx no debe contener ${forbidden}`);
    }

    const empty = createEmptyOnboardingDraft();
    assert.equal(empty.incomeSources.length, 0);
    assert.equal(empty.fixedCosts.length, 0);
    assert.equal(empty.debts.length, 0);
    assert.equal(empty.dataPrivacyAccepted, false);
    assert.equal(empty.financialDataConfirmed, false);
  });

  test("2. Onboarding repetido preserva GP, XP, nivel y rachas, y nunca borra listas sin confirmación destructiva", async () => {
    const initial = buildSafeTreasuryPatch({
      userId: "user-a",
      billingPeriod: "2026-11",
      existingTreasury: null,
      monthlyIncome: 3000000,
      totalFixed: 1000000,
      variableOps: 500000,
      vaultCap: 200000,
      debtStrategy: "snowball",
    });
    assert.equal(initial.mode, "initial");
    assert.equal(initial.patch.player_level, 1);
    assert.equal(initial.patch.wallet_gp, 0);

    const edit = buildSafeTreasuryPatch({
      userId: "user-a",
      billingPeriod: "2026-11",
      existingTreasury: { wallet_gp: 4500, player_level: 7, current_xp: 980 },
      monthlyIncome: 3500000,
      totalFixed: 1100000,
      variableOps: 600000,
      vaultCap: 250000,
      debtStrategy: "avalanche",
    });
    assert.equal(edit.mode, "edit");
    assert.equal("wallet_gp" in edit.patch, false, "Modo edit nunca sobrescribe wallet_gp");
    assert.equal("player_level" in edit.patch, false, "Modo edit nunca reinicia player_level");
    assert.equal("current_xp" in edit.patch, false, "Modo edit nunca reinicia current_xp");

    const diffSafe = computeIdempotentCollectionDiff({
      existing: [
        { id: "fc-1", name: "Arriendo" },
        { id: "fc-2", name: "Internet" },
      ],
      incoming: [
        { name: "Arriendo", amount: 900000 },
        { name: "Arriendo", amount: 900000 }, // duplicado debe deduplicarse
        { name: "Energía", amount: 150000 },
      ],
      getExistingKey: (r) => r.name,
      getIncomingKey: (r) => r.name,
      confirmDestructiveReplace: false,
    });
    assert.equal(diffSafe.toUpdate.length, 1);
    assert.equal(diffSafe.toInsert.length, 1);
    assert.equal(diffSafe.toDeleteIds.length, 0, "Sin confirmación destructiva no borra filas existentes");
  });

  test("3. persistOnboardingSafely aísla user_id incluso bajo service_role y reporta errores parciales", async () => {
    const ops: Array<{ table: string; op: string; userIds: string[] }> = [];
    const makeBuilder = (table: string) => {
      const userIds: string[] = [];
      let op = "select";
      const builder: Record<string, unknown> = {
        select() { return builder; },
        eq(col: string, val: string) {
          if (col === "user_id") userIds.push(val);
          return builder;
        },
        in() { return builder; },
        async maybeSingle() {
          ops.push({ table, op, userIds: [...userIds] });
          if (table === "player_treasury") {
            return { data: { user_id: "USER_A", wallet_gp: 1200, player_level: 4 }, error: null };
          }
          return { data: null, error: null };
        },
        async upsert() {
          op = "upsert";
          ops.push({ table, op, userIds: [...userIds] });
          return { error: null };
        },
        update() {
          op = "update";
          return builder;
        },
        insert() {
          op = "insert";
          if (table === "fixed_costs") {
            return Promise.reject(new Error("simulated partial DB error"));
          }
          ops.push({ table, op, userIds: [...userIds] });
          return Promise.resolve({ error: null });
        },
        delete() {
          op = "delete";
          ops.push({ table, op, userIds: [...userIds] });
          return builder;
        },
        then(resolve: (v: unknown) => void) {
          ops.push({ table, op, userIds: [...userIds] });
          resolve({ data: [], error: null });
        },
      };
      return builder;
    };

    const res = await persistOnboardingSafely({
      db: { from: makeBuilder },
      userId: "USER_A",
      email: "a@example.invalid",
      fallbackCharacterClass: "Arquitecta",
      fallbackAvatarUrl: null,
      body: {
        display_name: "isacarlope",
        profession: "Ingeniería Administrativa",
        character_class: "Arquitecta de Sistemas y Equilibrio",
        currency: "COP",
        timezone: "America/Bogota",
        monthly_income: 3000000,
        pay_frequency: "biweekly",
        pay_day: 15,
        fixed_costs: [{ name: "Internet", amount: 100000, category: "conectividad" }],
        variable_ops_budget: 400000,
        vault_cap: 200000,
        savings_goal_monthly: 500000,
        debt_strategy: "snowball",
        bosses: [],
        skills: [{ domain: "study", label: "Estudio", weekly_target_minutes: 180, preferred_session_time: "noche" }],
        wishlist: [],
        data_privacy_accepted: true,
      },
      cleanName: "isacarlope",
      monthlyIncome: 3000000,
      totalFixed: 100000,
      variableOps: 400000,
      vaultCap: 200000,
    });

    assert.equal(res.onboardingMode, "edit");
    assert.equal(res.preservedProgress, true);
    assert.equal(res.ok, false);
    assert.equal(res.partialErrors.length, 1);
    assert.equal(res.partialErrors[0].section, "fixed_costs");
    assert.equal(ops.some((o) => o.op === "delete"), false, "Nunca debe ejecutar DELETE sin confirmación");
    assert.equal(ops.some((o) => o.userIds.includes("USER_B")), false);
  });

  test("4. Finanzas reales en COP excluyen saldos iniciales/reembolsos y separan COP de GP", () => {
    const draft = createEmptyOnboardingDraft();
    draft.incomeSources = [
      { id: "i1", label: "Quincena 1", amountCop: 1500000, payDay: 15, isVariable: false, kind: "recurring_income" },
      { id: "i2", label: "Quincena 2", amountCop: 1500000, payDay: 30, isVariable: true, kind: "recurring_income" },
      { id: "i3", label: "Saldo inicial banco", amountCop: 800000, payDay: 1, isVariable: false, kind: "initial_balance" },
      { id: "i4", label: "Reembolso amigo", amountCop: 250000, payDay: 10, isVariable: false, kind: "refund" },
    ];
    draft.fixedCosts = [{ id: "f1", name: "Servicios", amountCop: 500000, category: "hogar" }];
    draft.variableBudgetCop = 600000;
    draft.vaultCapGp = 300000;

    const sum = computeRealFinanceSummary(draft);
    assert.equal(sum.totalRecurringIncomeCop, 3000000);
    assert.equal(sum.excludedNonRecurringCop, 1050000);
    assert.equal(sum.committedCop, 1100000);
    assert.equal(sum.availableRealMoneyCop, 1900000);
    assert.equal(sum.allowedGpRewardsCap, 300000);
  });

  test("5. Las 8 áreas de vida son válidas (Cine usa módulo dedicado, Journaling usa dominio válido) y borrador se guarda", () => {
    assert.equal(EIGHT_LIFE_AREAS.length, 8);
    const cinema = EIGHT_LIFE_AREAS.find((a) => a.id === "cinema");
    const journaling = EIGHT_LIFE_AREAS.find((a) => a.id === "journaling");
    assert.equal(cinema?.skillDomain, null);
    assert.equal(cinema?.moduleKey, "cinema");
    assert.equal(journaling?.skillDomain, "journaling");
    assert.equal(sanitizeSkillDomain("cinema"), "general");
    assert.equal(sanitizeSkillDomain("journaling"), "journaling");

    const draft = createEmptyOnboardingDraft();
    draft.displayName = "isacarlope";
    saveOnboardingDraft("test-scope", draft);
    const loaded = loadOnboardingDraft("test-scope");
    assert.equal(loaded?.displayName, "isacarlope");
    clearOnboardingDraft("test-scope");

    const sheet = buildCharacterSheet(draft, 1);
    assert.equal(sheet.level, 1);
    assert.equal(sheet.identity.currency, "COP");
    assert.equal(sheet.identity.timezone, "America/Bogota");
  });

  test("6. Calendario adaptativo (07:00–23:00, trabajo 08:00–17:00) protege descansos y nunca auto-inicia", () => {
    const plan = buildAdaptiveDayPlan(
      { wakeTime: "07:00", sleepTime: "23:00", workStart: "08:00", workEnd: "17:00", timezone: "America/Bogota" },
      { unfinishedTasksCount: 2 }
    );
    assert.ok(plan.totalProtectedRestMinutes >= 150);
    assert.ok(plan.blocks.some((b) => b.kind === "protected_meal"));
    assert.ok(plan.blocks.some((b) => b.kind === "work_mandatory" && b.status === "confirmed"));
    assert.match(plan.availabilityNotice, /no asume tu disponibilidad en tiempo real/i);

    const recs = recommendFreeSlotActivities({
      availableMinutes: 20,
      enabledAreaIds: ["reading", "rubik", "crochet", "study"],
    });
    assert.ok(recs.length >= 2);
    for (const r of recs) {
      assert.equal(r.requiresConfirmation, true);
      assert.equal(r.autoStarted, false);
    }
  });

  test("7. Rowan asistente de decisiones incluye los 7 campos obligatorios, 0 Gemini y aislamiento financiero", () => {
    const freeRec = buildRowanDecisionRecommendation({
      question: "Tengo 20 minutos libres",
      enabledAreaIds: ["study", "reading", "rubik", "crochet"],
    });
    assert.equal(freeRec.usedGemini, false);
    assert.equal(freeRec.accessedFinancialData, false);
    assert.ok(freeRec.proposedAction.length > 5);
    assert.ok(freeRec.reason.length > 5);
    assert.ok(freeRec.estimatedMinutes > 0);
    assert.ok(freeRec.dataUsed.length > 0);
    assert.ok(freeRec.dataUpdatedAt.length > 0);
    assert.ok(freeRec.alternative.length > 5);
    assert.equal(freeRec.controls.level3FinancialMutationBlocked, true);

    const buyRec = buildRowanDecisionRecommendation({
      question: "¿Puedo permitirme una compra de 250000 COP?",
      enabledAreaIds: ["work"],
      explicitFinancialSummary: {
        availableRealMoneyCop: 150000,
        requestedPurchaseCop: 250000,
        updatedAt: "2026-11-20T12:00:00Z",
      },
    });
    assert.equal(buyRec.usedGemini, false);
    assert.equal(buyRec.accessedFinancialData, true);
    assert.match(buyRec.proposedAction, /Posponer|Wishlist/i);
    assert.equal(buyRec.controls.level3FinancialMutationBlocked, true);
  });
});
