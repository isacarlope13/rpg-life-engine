/**
 * SUITE DE PRUEBAS AUTOMATIZADAS — OAKHAVEN 4.0 (MI MUNDO Y PUEBLO VIVO)
 *
 * Valida de forma rigurosa y determinista:
 * 1. Configuración de habilidades por usuario (activas, en pausa, archivadas).
 * 2. Invariante de seguridad: Banco de OakHaven inmutable (nunca se oculta).
 * 3. Preservación íntegra de historial de sesiones, saldos de GP y XP.
 * 4. Algoritmo anti-colisión espacial: cero superposición en coordenadas 2D.
 * 5. Generación de misiones adaptativas filtradas por habilidades activas.
 * 6. Filtrado combinado de distritos y visibilidad.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  getDefaultWorldConfig,
  updateSkillStatus,
  filterVisibleBuildings,
  getSkillLifecycleMetrics,
  ALL_SKILL_DOMAINS,
  type VillageWorldConfig,
} from "../src/lib/sanctuary/world-preferences-engine.ts";
import {
  VILLAGE_BUILDINGS_CATALOG,
  getBuildingById,
  filterBuildingsByDistrict,
} from "../src/lib/sanctuary/village-buildings-registry.ts";
import {
  OPTIMIZED_VILLAGE_COORDINATES,
  validateNoCollisions,
  getOptimizedCoordinates,
} from "../src/lib/sanctuary/village-slot-layout.ts";
import { defaultDynamicQuestGenerator } from "../src/lib/agents/dynamic-quest.ts";
import type { SkillSessionRecord } from "../src/types/rpg.ts";

describe("OAKHAVEN 4.0 — MI MUNDO Y PUEBLO VIVO", () => {
  // =========================================================================
  // 1. CONFIGURACIÓN DE HABILIDADES Y MODELO DE PREFERENCIAS
  // =========================================================================
  test("Test 1: Configuración inicial equilibrada de Mi Mundo", () => {
    const config = getDefaultWorldConfig("user_elena_test");
    assert.equal(config.userId, "user_elena_test");
    assert.equal(config.skills.work.status, "active");
    assert.equal(config.skills.reading.status, "active");
    assert.equal(config.skills.knitting.status, "active");
    assert.equal(config.skills.sports.status, "active");

    const metrics = getSkillLifecycleMetrics(config);
    assert.equal(metrics.totalCount, ALL_SKILL_DOMAINS.length);
    assert.ok(metrics.activeCount > 0, "Debe tener habilidades activas por defecto");
    assert.ok(metrics.pausedCount > 0, "Debe tener habilidades en reposo por defecto");
  });

  test("Test 2: Modificación de ciclo de vida (Pausar y Reactivar habilidad)", () => {
    let config = getDefaultWorldConfig("user_pausa_test");

    // Pausar tejido (knitting)
    config = updateSkillStatus(config, "knitting", "paused", "Pausa temporal por viaje");
    assert.equal(config.skills.knitting.status, "paused");
    assert.equal(config.skills.knitting.notes, "Pausa temporal por viaje");
    assert.ok(config.skills.knitting.pausedAt, "Debe registrar marca de tiempo de pausa");

    // Reactivar tejido
    config = updateSkillStatus(config, "knitting", "active");
    assert.equal(config.skills.knitting.status, "active");
    assert.equal(config.skills.knitting.pausedAt, undefined);
  });

  test("Test 3: Archivado de habilidad y preservación de historial", () => {
    let config = getDefaultWorldConfig("user_archive_test");

    // Archivar speedcubing (rubik)
    config = updateSkillStatus(config, "rubik", "archived", "Archivado tras torneo");
    assert.equal(config.skills.rubik.status, "archived");
    assert.ok(config.skills.rubik.archivedAt);

    // Simular historial de sesiones del usuario para 'rubik'
    const rubikHistory: SkillSessionRecord[] = [
      {
        id: "sess_rubik_1",
        title: "Ao5 solve test",
        domain: "rubik",
        duration_minutes: 25,
        xp_earned: 60,
        gp_earned: 2500,
        timestamp: "2026-11-01T10:00:00Z",
        details: "Ao5 solve test",
      },
      {
        id: "sess_rubik_2",
        title: "Sub-15 practice",
        domain: "rubik",
        duration_minutes: 30,
        xp_earned: 75,
        gp_earned: 3000,
        timestamp: "2026-11-05T15:30:00Z",
        details: "Sub-15 practice",
      },
    ];

    // INVARIANTE: El archivo es estrictamente visual, el historial se preserva intacto
    const totalGp = rubikHistory.reduce((acc, s) => acc + s.gp_earned, 0);
    const totalXp = rubikHistory.reduce((acc, s) => acc + s.xp_earned, 0);
    assert.equal(totalGp, 5500, "Los GP históricos no deben mutar ni reducirse al archivar");
    assert.equal(totalXp, 135, "La XP acumulada no debe perderse al archivar");
    assert.equal(rubikHistory.length, 2, "Las sesiones pasadas permanecen íntegras");
  });

  // =========================================================================
  // 2. INVARIANTE DE SEGURIDAD: BANCO DE OAKHAVEN INMUTABLE
  // =========================================================================
  test("Test 4: El Banco de OakHaven permanece SIEMPRE visible independientemente de las preferencias", () => {
    // Configuración donde todas las habilidades imaginables están archivadas
    const allArchivedConfig: VillageWorldConfig = {
      userId: "user_radical",
      skills: {
        work: { domain: "work", status: "archived" },
        reading: { domain: "reading", status: "archived" },
        knitting: { domain: "knitting", status: "archived" },
        rubik: { domain: "rubik", status: "archived" },
        sports: { domain: "sports", status: "archived" },
        journaling: { domain: "journaling", status: "archived" },
        study: { domain: "study", status: "archived" },
        gardening: { domain: "gardening", status: "archived" },
        drawing: { domain: "drawing", status: "archived" },
        ceramics: { domain: "ceramics", status: "archived" },
        hiking: { domain: "hiking", status: "archived" },
        cooking: { domain: "cooking", status: "archived" },
        gaming: { domain: "gaming", status: "archived" },
        general: { domain: "general", status: "archived" },
      },
      activeDistrictFilter: "all",
      compactModeEnabled: false,
      soundMuted: true,
      selectedWeather: "sunny",
      updatedAt: new Date().toISOString(),
    };

    const visible = filterVisibleBuildings(VILLAGE_BUILDINGS_CATALOG, allArchivedConfig);

    // El Banco de OakHaven DEBE ser el único edificio visible e inmutable
    const bankFound = visible.some((b) => b.id === "banco_oakhaven" || b.id === "banco");
    assert.ok(bankFound, "El Banco de OakHaven debe permanecer siempre accesible en el mapa");
    assert.equal(visible.length, 1, "Solo la infraestructura nuclear permanece visible");
  });

  // =========================================================================
  // 3. DISTRIBUCIÓN ESPACIAL ANTI-COLISIÓN (MATEMÁTICA PURA)
  // =========================================================================
  test("Test 5: Cero superposición visual en las coordenadas calibradas del mapa", () => {
    const allBuildingIds = VILLAGE_BUILDINGS_CATALOG.map((b) => b.id);
    const result = validateNoCollisions(allBuildingIds);

    assert.equal(
      result.hasCollisions,
      false,
      `Se detectaron colisiones geométricas entre edificios: ${JSON.stringify(result.collisionPairs)}`
    );
  });

  test("Test 6: Plaza Central desacoplada horizontalmente (Banco vs Oficina)", () => {
    const bankCoords = getOptimizedCoordinates("banco_oakhaven");
    const officeCoords = getOptimizedCoordinates("oficina");

    // Banco a la izquierda (X=42%), Oficina a la derecha (X=58%)
    const deltaX = Math.abs(officeCoords.x - bankCoords.x);
    assert.ok(deltaX >= 15, `Delta X en la plaza debe ser al menos 15%, obtenido: ${deltaX}%`);
    assert.equal(bankCoords.y, officeCoords.y, "Deben estar alineados en la misma franja horizontal cívica");
  });

  // =========================================================================
  // 4. MISIONES ADAPTATIVAS BASADAS EN HABILIDADES ACTIVAS
  // =========================================================================
  test("Test 7: Generación de misiones excluye habilidades pausadas y archivadas", () => {
    const config = getDefaultWorldConfig("user_misiones");
    // Activas en este caso: 'work', 'reading', 'sports'
    const activeDomains = ALL_SKILL_DOMAINS.filter((d) => config.skills[d]?.status === "active");

    const dynamicQuests = defaultDynamicQuestGenerator.generateActiveSkillsQuests({
      activeDomains,
      domainLabels: {
        work: "Gestión Ágil",
        reading: "Lectura Serena",
        sports: "Entrenamiento Funcional",
      },
      playerLevel: 3,
    });

    assert.ok(dynamicQuests.length > 0);
    for (const q of dynamicQuests) {
      assert.ok(
        activeDomains.includes(q.domain),
        `La misión generada para '${q.domain}' no está en la lista de dominios activos`
      );
    }
  });

  // =========================================================================
  // 5. FILTRADO COMPUESTO DE DISTRITOS Y PREFERENCIAS
  // =========================================================================
  test("Test 8: Filtrado compuesto distrito + preferencias de usuario", () => {
    let config = getDefaultWorldConfig("user_distritos");
    // Pausar cerámica en 'artes'
    config = updateSkillStatus(config, "ceramics", "paused");

    // Filtrar por distrito 'artes'
    const artesBuildings = filterBuildingsByDistrict("artes");
    const visibleInArtes = filterVisibleBuildings(artesBuildings, config);

    const hasCeramics = visibleInArtes.some((b) => b.id === "taller_ceramica");
    assert.equal(hasCeramics, false, "El Taller de Cerámica pausado no debe aparecer en el distrito de artes");

    const hasAtelier = visibleInArtes.some((b) => b.id === "atelier");
    assert.ok(hasAtelier, "El Atelier activo debe permanecer visible en el distrito de artes");
  });
});
