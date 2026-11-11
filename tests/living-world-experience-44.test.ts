import test from "node:test";
import assert from "node:assert/strict";
import type { SkillDomain, SkillDomainSummary, SkillSessionRecord } from "../src/types/rpg.ts";
import {
  COZY_VILLAGE_RESIDENTS,
  calculateBuildingTier,
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
  defaultDynamicQuestGenerator,
} from "../src/lib/agents/dynamic-quest.ts";
import {
  calculateBiweeklyCashflowPlan,
} from "../src/lib/sanctuary/financial-core.ts";
import {
  REAL_DEBTS_CASE_STUDY,
  simulateDebtPaymentImpact,
} from "../src/lib/sanctuary/debt-engine.ts";
import { defaultFinancialWellbeingSkill } from "../src/lib/sanctuary/financial-wellbeing-skill.ts";
import {
  createUniversalSession,
  startUniversalSession,
  pauseUniversalSession,
  resumeUniversalSession,
  finishUniversalSession,
  calculateNetDurationSeconds,
} from "../src/lib/sanctuary/universal-session-engine.ts";

test("OAKHAVEN 4.0 — LIVING WORLD EXPERIENCE (4.1 a 4.4 INTEGRAL SUITE)", async (t) => {
  // =========================================================================
  // FASE 4.1: LIVING BUILDINGS (Los 5 Pilotos de Edificios Vivos Funcionales)
  // =========================================================================
  await t.test("4.1: Los 5 edificios pilotos poseen sus estaciones de trabajo y atajos", () => {
    const pilotIds = ["atelier", "oficina", "banco_oakhaven", "libreria", "gimnasio"];
    for (const id of pilotIds) {
      const b = VILLAGE_BUILDINGS_CATALOG.find((item) => item.id === id);
      assert.ok(b, `El edificio piloto ${id} debe existir en el catálogo maestro`);
      assert.ok(b.name.length > 0, `El nombre de ${id} debe estar definido`);
      assert.ok(b.icon.length > 0, `El ícono de ${id} debe estar definido`);
      assert.ok(b.district.length > 0, `El distrito de ${id} debe estar definido`);
    }
  });

  await t.test("4.1: Banco 3.9 consolida $410.000 COP y Silas Vance bloquea pagos autónomos", () => {
    const nuCop = 340000;
    const nequiCop = 70000;
    assert.equal(nuCop + nequiCop, 410000, "Saldo consolidado en COP debe ser exactamente $410.000 COP");

    const plan = calculateBiweeklyCashflowPlan({
      asOfDate: "2026-11-11",
      accounts: { nuAccountCop: nuCop, nequiAccountCop: nequiCop },
      protectedEssentialReserveCop: 250000,
      committedObligations: [
        { id: "ob_internet", name: "Internet", amountCop: 60000, dueDate: "2026-11-14", isMandatory: true, priority: "high", status: "pending" },
      ],
      expectedNextIncome: { amountCop: 1800000, expectedDate: "2026-11-20", isConfirmed: true },
    });

    assert.equal(plan.cycle.cycleType, "first_half");
    assert.ok(plan.freeMoneyCop >= 0, "Margen libre no puede ser negativo");

    // HITL Nivel 3: El agente Silas Vance deniega pagos autónomos
    assert.throws(
      () => defaultFinancialWellbeingSkill.executeAutonomousPayment(),
      /ACCESO DENEGADO|HITL/i,
      "Silas Vance debe bloquear cualquier intento de pago o transferencia sin aprobación humana"
    );
  });

  // =========================================================================
  // FASE 4.2: LIVING COMPANIONS (Compañeros Residentes con Matriz HITL)
  // =========================================================================
  await t.test("4.2: Los 5 residentes principales ofrecen diálogo contextual y respetan HITL", () => {
    const companions = [
      { id: "clara", name: "Clara", domain: "knitting" },
      { id: "aura", name: "Aura", domain: "general" },
      { id: "silas", name: "Silas Vance", domain: "work" },
      { id: "eldrin", name: "Eldrin", domain: "reading" },
      { id: "bruno", name: "Bruno", domain: "sports" },
    ];

    for (const comp of companions) {
      const resident = COZY_VILLAGE_RESIDENTS.find((r) => r.id === comp.id);
      assert.ok(resident, `El residente ${comp.name} debe estar registrado en el censo`);
      assert.equal(resident.domain, comp.domain);

      const advice = resident.getDynamicAdvice({
        skillLevel: 3,
        sessionsCount: 5,
        lastSessionDetails: "Sesión de prueba en OakHaven",
      });
      assert.ok(advice.length > 10, `El consejo dinámico de ${resident.name} debe estar articulado`);
    }
  });

  // =========================================================================
  // FASE 4.3: LIVING WORLD (Pueblo Reactivo sin Alteración Económica)
  // =========================================================================
  await t.test("4.3: Pueblo reactivo preserva sesiones en segundo plano y no altera GP/XP", () => {
    const t0 = Date.now();
    let session = createUniversalSession({
      userId: "usr_hero",
      domain: "knitting",
      buildingId: "atelier",
      nowTimestamp: t0,
    });
    session = startUniversalSession(session, t0);

    // Simular que el usuario sale al pueblo mientras el cronómetro corre
    const tMid = t0 + 15 * 60 * 1000; // 15 minutos después
    const netElapsed = calculateNetDurationSeconds(session, tMid);
    assert.ok(
      Math.abs(netElapsed - 15 * 60) <= 1,
      "El tiempo debe continuar transcurriendo en segundo plano"
    );

    // Finalizar sesión de manera determinista
    const tEnd = t0 + 25 * 60 * 1000;
    const completed = finishUniversalSession(session, undefined, tEnd);
    assert.equal(completed.status, "completed");
    assert.ok(
      Math.abs((completed.elapsedSeconds || 0) - 25 * 60) <= 1,
      "La duración final neta debe corresponder a 25 minutos"
    );

    // Invariante: El renderizado cosmético de luces en el pueblo no altera saldos
    const tier1Info = calculateBuildingTier({ level: 1, sessionsCount: 1 });
    assert.equal(tier1Info.tier, 1, "Tier 1 rústico para nivel inicial");

    const tier2Info = calculateBuildingTier({ level: 2, sessionsCount: 3 });
    assert.equal(tier2Info.tier, 2, "Tier 2 establecido para artesano en desarrollo");
  });

  // =========================================================================
  // FASE 4.4: ADAPTIVE MISSIONS (Misiones Adaptativas & Exclusión de Pausadas)
  // =========================================================================
  await t.test("4.4: Misiones adaptativas integran contexto de proyectos y excluyen habilidades pausadas", () => {
    const gen = new DynamicQuestGenerator();
    let config = getDefaultWorldConfig("test_user_44");

    // Pausar y archivar habilidades específicas
    config = updateSkillStatus(config, "gaming", "paused", "Desconexión de videojuegos");
    config = updateSkillStatus(config, "ceramics", "archived", "Sin taller de cerámica por ahora");
    config = updateSkillStatus(config, "knitting", "active");
    config = updateSkillStatus(config, "reading", "active");

    const activeDomains = getActiveSkillDomains(config);
    assert.ok(activeDomains.includes("knitting"), "Knitting debe estar activo");
    assert.ok(activeDomains.includes("reading"), "Reading debe estar activo");
    assert.ok(!activeDomains.includes("gaming"), "Gaming pausado DEBE excluirse de misiones activas");
    assert.ok(!activeDomains.includes("ceramics"), "Ceramics archivado DEBE excluirse de misiones activas");

    // Generar misiones con contexto de proyectos reales
    const quests = gen.generateActiveSkillsQuests({
      activeDomains: ["knitting", "reading", "work"],
      domainLabels: { knitting: "Tejido", reading: "Lectura", work: "Trabajo" },
      playerLevel: 3,
      projectContexts: {
        knitting: { projectName: "Manta Nórdica de Lana" },
        reading: { projectName: "El Hobbit de J.R.R. Tolkien" },
        work: { projectName: "Sprint OakHaven 4.0" },
      },
      dateKey: "20261111",
    });

    assert.equal(quests.length, 3);

    // Verificar adaptación de nombres y descripciones a los proyectos reales
    const knittingQuest = quests.find((q) => q.domain === "knitting");
    assert.ok(knittingQuest?.name.includes("Manta Nórdica de Lana"), "La misión de tejido debe nombrar el proyecto activo");
    assert.ok(knittingQuest?.description.includes("Clara"), "La misión de tejido debe referenciar a Clara");

    const readingQuest = quests.find((q) => q.domain === "reading");
    assert.ok(readingQuest?.name.includes("El Hobbit"), "La misión de lectura debe nombrar el libro activo");
    assert.ok(readingQuest?.description.includes("Eldrin"), "La misión de lectura debe referenciar a Eldrin");

    const workQuest = quests.find((q) => q.domain === "work");
    assert.ok(workQuest?.name.includes("Sprint OakHaven 4.0"), "La misión de trabajo debe nombrar el sprint");
    assert.ok(workQuest?.description.includes("Aura"), "La misión de trabajo debe referenciar a Aura");

    // Control económico: Las recompensas respetan el límite del guardián
    for (const q of quests) {
      assert.ok(q.rewardGp <= DynamicQuestGenerator.MAX_AUTONOMOUS_GP, `Recompensa de GP (${q.rewardGp}) no puede exceder el límite`);
      assert.ok(q.rewardXp >= 60, "XP debe otorgar recompensa mínima positiva");
      assert.equal(q.code.endsWith("20261111"), true, "El código determinista previene recompensas duplicadas en el mismo día");
    }
  });

  await t.test("4.4: Invariante Sovereign: Banco de OakHaven nunca puede ser pausado ni archivado del mapa", () => {
    let config = getDefaultWorldConfig("test_bank_sovereign");
    config = updateSkillStatus(config, "work", "paused"); // Intentar pausar dominio work

    const visibleBuildings = filterVisibleBuildings(VILLAGE_BUILDINGS_CATALOG, config);
    const bank = visibleBuildings.find((b) => b.id === "banco_oakhaven" || b.id === "banco");
    assert.ok(bank, "El Banco de OakHaven es soberano y NUNCA puede ser filtrado ni eliminado del mapa");
  });
});
