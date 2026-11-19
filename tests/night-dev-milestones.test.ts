import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  PERSONAL_VILLAGE_CORE_BUILDINGS,
  getBuildingById,
  resolveCanonicalBuildingId,
  isPersonalCoreBuilding,
  VILLAGE_BUILDINGS_CATALOG,
} from "../src/lib/sanctuary/village-buildings-registry.ts";
import { getBuildingById as getSanctuaryBuildingById } from "../src/lib/sanctuary/buildings-registry.ts";
import {
  getDefaultWorldConfig,
  filterVisibleBuildings,
  updateSkillStatus,
} from "../src/lib/sanctuary/world-preferences-engine.ts";

describe("OAKHAVEN NIGHT DEV — Hitos A, B y C", () => {
  test("Hito A: Los 8 edificios personales tienen resolución canónica y Banco no colisiona con Trabajo", () => {
    assert.equal(PERSONAL_VILLAGE_CORE_BUILDINGS.length, 8);

    // Alias retrocompatibles en ambos registros
    assert.equal(resolveCanonicalBuildingId("dojo"), "gimnasio");
    assert.equal(resolveCanonicalBuildingId("gym"), "gimnasio");
    assert.equal(resolveCanonicalBuildingId("banco"), "banco_oakhaven");
    assert.equal(resolveCanonicalBuildingId("trabajo"), "oficina");
    assert.equal(resolveCanonicalBuildingId("estudio"), "biblioteca");
    assert.equal(resolveCanonicalBuildingId("cubos"), "club_puzzles");
    assert.equal(resolveCanonicalBuildingId("lectura"), "libreria");
    assert.equal(resolveCanonicalBuildingId("crochet"), "atelier");

    assert.equal(getSanctuaryBuildingById("gimnasio")?.id, "dojo");
    assert.equal(getSanctuaryBuildingById("crochet")?.id, "atelier");

    const banco = getBuildingById("banco_oakhaven");
    const oficina = getBuildingById("oficina");
    assert.equal(banco?.domainScope, "finance");
    assert.equal(oficina?.domainScope, "work");
    assert.equal(isPersonalCoreBuilding("atelier"), true);
    assert.equal(isPersonalCoreBuilding("invernadero"), false);

    // Configuración por defecto: core activo, fuera de alcance pausado (preservado)
    const defaultConfig = getDefaultWorldConfig("night_test_user");
    assert.equal(defaultConfig.skills.knitting.status, "active");
    assert.equal(defaultConfig.skills.study.status, "active");
    assert.equal(defaultConfig.skills.rubik.status, "active");
    assert.equal(defaultConfig.skills.gardening.status, "paused");
    assert.equal(defaultConfig.skills.journaling.status, "paused");

    // Pausar 'work' oculta Oficina pero mantiene Banco siempre visible
    const pausedWork = updateSkillStatus(defaultConfig, "work", "paused");
    const visible = filterVisibleBuildings(VILLAGE_BUILDINGS_CATALOG, pausedWork);
    assert.ok(visible.some((b) => b.id === "banco_oakhaven"), "Banco debe permanecer visible");
    assert.ok(!visible.some((b) => b.id === "oficina"), "Oficina debe ocultarse al pausar work");
  });

  test("Hito C: Los 7 edificios core implementados usan LivingInteriorRoom y Cubos protege sus atajos WCA", () => {
    const sanctuaryDir = path.join(process.cwd(), "src", "components", "sanctuary");
    const coreComponents = [
      "bank-building.tsx",
      "biblioteca-building.tsx",
      "office-building.tsx",
      "gym-building.tsx",
      "club-puzzles-building.tsx",
      "libreria-building.tsx",
      "atelier-building.tsx",
    ];

    for (const file of coreComponents) {
      const content = fs.readFileSync(path.join(sanctuaryDir, file), "utf8");
      assert.ok(
        content.includes("<LivingInteriorRoom"),
        `${file} debe renderizar LivingInteriorRoom`
      );
    }

    const cubosContent = fs.readFileSync(
      path.join(sanctuaryDir, "club-puzzles-building.tsx"),
      "utf8"
    );
    assert.ok(
      cubosContent.includes("disableHotkeys={practiceTimerRunning}"),
      "Cubos debe desactivar atajos globales mientras corre el cronómetro WCA"
    );

    const atelierContent = fs.readFileSync(
      path.join(sanctuaryDir, "atelier-building.tsx"),
      "utf8"
    );
    assert.ok(
      atelierContent.includes("handleSaveQuickRowsWithoutTimer"),
      "Atelier debe permitir guardar vueltas sin exigir iniciar cronómetro"
    );
  });
});
