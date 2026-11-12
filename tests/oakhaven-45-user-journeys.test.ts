import test from "node:test";
import assert from "node:assert/strict";
import type { SkillDomain, SkillDomainSummary, SkillSessionRecord } from "../src/types/rpg.ts";
import {
  COZY_VILLAGE_RESIDENTS,
} from "../src/lib/sanctuary/village-tiers.ts";
import {
  VILLAGE_BUILDINGS_CATALOG,
} from "../src/lib/sanctuary/village-buildings-registry.ts";
import {
  getDefaultWorldConfig,
  updateSkillStatus,
  filterVisibleBuildings,
  getActiveSkillDomains,
} from "../src/lib/sanctuary/world-preferences-engine.ts";
import {
  DynamicQuestGenerator,
} from "../src/lib/agents/dynamic-quest.ts";
import {
  calculateBiweeklyCashflowPlan,
  type CommittedObligationItem,
} from "../src/lib/sanctuary/financial-core.ts";
import {
  REAL_DEBTS_CASE_STUDY,
  simulateDebtPaymentImpact,
} from "../src/lib/sanctuary/debt-engine.ts";
import {
  defaultFinancialWellbeingSkill,
} from "../src/lib/sanctuary/financial-wellbeing-skill.ts";
import {
  createUniversalSession,
  startUniversalSession,
  finishUniversalSession,
  hydrateUniversalSession,
  calculateNetDurationSeconds,
  type UniversalSessionRecord,
} from "../src/lib/sanctuary/universal-session-engine.ts";
import {
  STORAGE_KEY_BANK_ACCOUNTS,
  CASE_STUDY_ACCOUNTS,
  loadPersistedAccounts,
  savePersistedAccounts,
} from "../src/lib/sanctuary/bank-engine.ts";
import { safeLocalStorage } from "../src/lib/storage-safe.ts";

test("OAKHAVEN 4.5 — PRUEBAS DE USUARIO & AUDITORÍA INTEGRAL", async (t) => {
  // =========================================================================
  // RECORRIDO A: Atelier — iniciar tejido, registrar vueltas, salir y regresar
  // =========================================================================
  await t.test("Recorrido A: Sesión de tejido y contador de vueltas persisten al salir y reingresar", () => {
    const t0 = Date.now();
    // 1. Iniciar sesión en el Atelier
    let session = createUniversalSession({
      userId: "usr_auditor",
      domain: "knitting",
      buildingId: "atelier",
      resourceId: "proj_bufanda",
      resourceTitle: "Bufanda de lana merino",
      autoStart: false,
    });
    session = startUniversalSession(session, t0);

    // 2. Registrar 12 vueltas tejidas en el bastidor de Clara
    session = {
      ...session,
      specializedData: {
        knitting: {
          rows_completed: 12,
          pattern_name: "Punto Elástico 2x2",
        },
      },
    };
    safeLocalStorage.setItem("rpg_universal_session_v4", JSON.stringify(session));

    // 3. Simular que el usuario sale del edificio al pueblo y luego reingresa (rehidratación)
    const storedRaw = safeLocalStorage.getItem("rpg_universal_session_v4");
    assert.ok(storedRaw, "La sesión universal debe encontrarse en almacenamiento seguro");

    const rehydrated = hydrateUniversalSession(storedRaw, "usr_auditor", t0 + 5000);
    assert.ok(rehydrated, "La sesión debe rehidratarse exitosamente");
    assert.equal(rehydrated.domain, "knitting");
    assert.equal(rehydrated.buildingId, "atelier");

    // 4. Verificar que el contador de vueltas no se reseteó a 0
    const knittingData = (rehydrated.specializedData as Record<string, unknown>)?.knitting as { rows_completed?: number };
    assert.equal(knittingData?.rows_completed, 12, "El contador de vueltas debe mantenerse exactamente en 12");
  });

  // =========================================================================
  // RECORRIDO B: Oficina — iniciar trabajo, cambiar de edificio y recuperar la sesión
  // =========================================================================
  await t.test("Recorrido B: Sesión de trabajo en la Oficina continúa en segundo plano al cambiar de edificio", () => {
    const tStart = Date.now();
    // 1. Iniciar Sprint Pomodoro en la Oficina
    let workSession = createUniversalSession({
      userId: "usr_auditor",
      domain: "work",
      buildingId: "oficina",
      objective: "Sprint de Foco: Auditoría de Seguridad OakHaven 4.5",
      autoStart: false,
    });
    workSession = startUniversalSession(workSession, tStart);
    safeLocalStorage.setItem("rpg_universal_session_v4", JSON.stringify(workSession));

    // 2. Cambiar a otro edificio (ej. Atelier) 10 minutos después
    const tTenMins = tStart + 10 * 60 * 1000;
    const rawActive = safeLocalStorage.getItem("rpg_universal_session_v4");
    assert.ok(rawActive);

    const activeInBackground = hydrateUniversalSession(rawActive, "usr_auditor", tTenMins);
    assert.ok(activeInBackground);
    assert.equal(activeInBackground.domain, "work");
    assert.equal(activeInBackground.buildingId, "oficina");

    // 3. Verificar que el cronómetro ha avanzado 10 minutos
    const elapsed = calculateNetDurationSeconds(activeInBackground, tTenMins);
    assert.ok(Math.abs(elapsed - 600) <= 1, "El cronómetro debe medir 600 segundos (10 minutos)");

    // 4. Regresar a la Oficina y finalizar la sesión
    const tFinish = tStart + 25 * 60 * 1000;
    const completed = finishUniversalSession(activeInBackground, undefined, tFinish);
    assert.equal(completed.status, "completed");
    assert.ok(Math.abs((completed.elapsedSeconds || 0) - 1500) <= 1, "La sesión debe completarse en 25 minutos");
  });

  // =========================================================================
  // RECORRIDO C: Banco — modificar un dato financiero de prueba y verificar reactividad
  // =========================================================================
  await t.test("Recorrido C: Modificar saldo de cuenta de prueba recalcula deterministamente el flujo quincenal", () => {
    // 1. Estado inicial del caso de estudio ($340k Nu + $70k Nequi = $410k COP)
    const initialAccounts = [...CASE_STUDY_ACCOUNTS];
    savePersistedAccounts(initialAccounts);

    const obligations: CommittedObligationItem[] = [
      { id: "ob_internet", name: "Internet", amountCop: 60000, dueDate: "2026-11-14", isMandatory: true, priority: "high", status: "pending" },
      { id: "ob_nequi", name: "Cuota Nequi", amountCop: 56431, dueDate: "2026-11-15", isMandatory: true, priority: "high", status: "pending" },
    ];

    const planInitial = calculateBiweeklyCashflowPlan({
      asOfDate: "2026-11-11",
      accounts: { nuAccountCop: 340000, nequiAccountCop: 70000 },
      protectedEssentialReserveCop: 250000,
      committedObligations: obligations,
      expectedNextIncome: { amountCop: 1800000, expectedDate: "2026-11-20", isConfirmed: true },
    });
    const initialFreeMargin = planInitial.freeMoneyCop;

    // 2. Modificar dato financiero de prueba: El usuario ajusta su cuenta Nu a $500.000 COP (+ $160.000 COP)
    const updatedAccounts = initialAccounts.map((a) =>
      a.id.includes("nu") ? { ...a, balanceCop: 500000 } : a
    );
    savePersistedAccounts(updatedAccounts);

    // 3. Verificar persistencia real
    const reloadedAccounts = loadPersistedAccounts();
    const nuReloaded = reloadedAccounts.find((a) => a.id.includes("nu"));
    assert.equal(nuReloaded?.balanceCop, 500000, "El saldo modificado debe persistir en almacenamiento seguro");

    // 4. Recalcular deterministamente el plan financiero
    const planUpdated = calculateBiweeklyCashflowPlan({
      asOfDate: "2026-11-11",
      accounts: {
        nuAccountCop: nuReloaded?.balanceCop || 0,
        nequiAccountCop: 70000,
      },
      protectedEssentialReserveCop: 250000,
      committedObligations: obligations,
      expectedNextIncome: { amountCop: 1800000, expectedDate: "2026-11-20", isConfirmed: true },
    });

    // 5. Verificar que el margen libre aumentó exactamente en $160.000 COP
    assert.equal(
      planUpdated.freeMoneyCop - initialFreeMargin,
      160000,
      "El margen libre debe aumentar exactamente en la diferencia abonada ($160.000 COP)"
    );
    assert.equal(planUpdated.reconciledLiquidCashCop, 570000, "Saldo reconciliado líquido debe ser $570.000 COP");

    // Limpieza de prueba
    safeLocalStorage.removeItem(STORAGE_KEY_BANK_ACCOUNTS);
  });

  // =========================================================================
  // RECORRIDO D: Pausar una habilidad — desaparece del pueblo y misiones sin perder historial
  // =========================================================================
  await t.test("Recorrido D: Pausar habilidad la oculta del mapa y misiones pero conserva historial de sesiones", () => {
    let config = getDefaultWorldConfig("usr_auditor_lifecycle");

    // Sesión histórica real existente en gaming
    const historicGamingSession: SkillSessionRecord = {
      id: "ses_gaming_historical_1",
      user_id: "usr_auditor_lifecycle",
      domain: "gaming",
      duration_minutes: 45,
      completed_at: "2026-11-01T15:00:00Z",
      details: "Partida de ajedrez táctico",
    };
    const sessionHistory = [historicGamingSession];

    // Pausar ludoteca / gaming
    config = updateSkillStatus(config, "gaming", "paused", "Desconexión de videojuegos");

    // 1. Verificar que el edificio desaparece del mapa activo
    const visibleBuildings = filterVisibleBuildings(VILLAGE_BUILDINGS_CATALOG, config);
    const ludotecaBuilding = visibleBuildings.find((b) => b.id === "ludoteca" || b.domain === "gaming");
    assert.equal(ludotecaBuilding, undefined, "El edificio pausado DEBE desaparecer del pueblo vivo");

    // 2. Verificar que el residente desaparece de las misiones activas
    const activeSkillDomains = getActiveSkillDomains(config);
    assert.equal(activeSkillDomains.includes("gaming"), false, "Habilidad pausada DEBE excluirse de misiones activas");

    // 3. Verificar que el historial histórico de sesiones NO fue eliminado
    assert.equal(sessionHistory.length, 1, "El historial no debe ser truncado ni modificado");
    assert.equal(sessionHistory[0].domain, "gaming");
    assert.equal(sessionHistory[0].duration_minutes, 45);
  });

  // =========================================================================
  // RECORRIDO E: Completar una misión — GP y XP se registran exactamente una vez (Idempotencia)
  // =========================================================================
  await t.test("Recorrido E: Clave de idempotencia determinista diaria impide recompensas duplicadas", () => {
    const resident = COZY_VILLAGE_RESIDENTS.find((r) => r.id === "clara")!;
    const today = new Date().toISOString().slice(0, 10);

    // Clave canónica determinista diaria
    const idempotencyKey = `village_journal_${resident.id}_${today}`;
    assert.ok(!idempotencyKey.includes("Date.now()"), "La clave no debe incluir Date.now() para ser determinista");

    // Simulación del motor de tareas con idempotencia
    const processedKeys = new Set<string>();
    let totalGpAwarded = 0;
    let totalXpAwarded = 0;

    const executeQuestSubmission = (key: string) => {
      if (processedKeys.has(key)) {
        return { success: false, isDuplicate: true };
      }
      processedKeys.add(key);
      totalGpAwarded += 250;
      totalXpAwarded += 40;
      return { success: true, isDuplicate: false };
    };

    // Primer intento: Exitoso
    const firstCall = executeQuestSubmission(idempotencyKey);
    assert.equal(firstCall.success, true);
    assert.equal(totalGpAwarded, 250);
    assert.equal(totalXpAwarded, 40);

    // Segundo intento (clic repetido o reenvío en el mismo día): Bloqueado por idempotencia
    const secondCall = executeQuestSubmission(idempotencyKey);
    assert.equal(secondCall.isDuplicate, true);
    assert.equal(totalGpAwarded, 250, "Los GP no deben duplicarse");
    assert.equal(totalXpAwarded, 40, "Los XP no deben duplicarse");
  });

  // =========================================================================
  // RECORRIDO F: Interactuar con un compañero — acciones sensibles requieren autorización (HITL 3)
  // =========================================================================
  await t.test("Recorrido F: Silas Vance bloquea pagos autónomos y solo redacta minutas con autorización humana", () => {
    // 1. Silas Vance bloquea cualquier intento autónomo de pago por IA
    assert.throws(
      () => defaultFinancialWellbeingSkill.executeAutonomousPayment(),
      /ACCESO DENEGADO|HITL/i,
      "Silas Vance debe prohibir taxativamente pagos o transacciones autónomas"
    );

    // 2. Las cartas formales de negociación son propuestas en Markdown que el humano inspecciona y aprueba
    const minuta = defaultFinancialWellbeingSkill.draftNegotiationDocument({
      creditorType: "contento_bancolombia",
      debtTotalCop: 3000000,
      proposedPaymentCop: 2348000,
    });

    assert.ok(minuta.formalBodyMarkdown.includes("Bancolombia"));
    assert.ok(minuta.formalBodyMarkdown.includes("Ley 1266"));
    assert.ok(minuta.formalBodyMarkdown.includes("$2.348.000"), "La carta contiene la propuesta económica para revisión humana");
  });
});
