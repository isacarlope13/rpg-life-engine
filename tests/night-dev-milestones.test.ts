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
import {
  createCinemaEntry,
  incrementSeriesEpisode,
  readCinemaEntries,
  saveCinemaEntries,
  updateCinemaEntryStatus,
} from "../src/lib/sanctuary/cinema-store.ts";
import type { SessionStorage } from "../src/lib/sanctuary/session-storage.ts";

function createMemoryStorage(): SessionStorage {
  const map = new Map<string, string>();
  return {
    getItem(k: string) {
      return map.has(k) ? map.get(k)! : null;
    },
    setItem(k: string, v: string) {
      map.set(k, v);
      return true;
    },
  };
}

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

  test("Hito C: Los 8 edificios definitivos usan LivingInteriorRoom, Cine persiste por usuario y Cubos protege atajos WCA", () => {
    const sanctuaryDir = path.join(process.cwd(), "src", "components", "sanctuary");
    const coreComponents = [
      "bank-building.tsx",
      "biblioteca-building.tsx",
      "office-building.tsx",
      "gym-building.tsx",
      "club-puzzles-building.tsx",
      "libreria-building.tsx",
      "cinema-building.tsx",
      "atelier-building.tsx",
    ];

    for (const file of coreComponents) {
      const content = fs.readFileSync(path.join(sanctuaryDir, file), "utf8");
      assert.ok(
        content.includes("<LivingInteriorRoom"),
        `${file} debe renderizar LivingInteriorRoom`
      );
      assert.ok(
        !content.includes("<BuildingInteriorShell"),
        `${file} no debe usar BuildingInteriorShell legacy`
      );
    }

    // Verificar persistencia aislada de Cine (películas, series y musicales)
    const storage = createMemoryStorage();
    const userA = "11111111-1111-4111-8111-111111111111";
    const userB = "22222222-2222-4222-8222-222222222222";
    const series = createCinemaEntry({
      title: "Anne with an E",
      kind: "series",
      status: "watching",
      season: 1,
      episode: 2,
    });
    const musical = createCinemaEntry({
      title: "Hamilton",
      kind: "musical",
      status: "favorite",
      rating: 5,
      favoriteSongOrScene: "Wait For It",
    });
    const saved = saveCinemaEntries(storage, userA, [series, musical]);
    assert.equal(saved.ok, true);
    assert.equal(readCinemaEntries(storage, userA).length, 2);
    assert.deepEqual(readCinemaEntries(storage, userB), []);

    const bumped = incrementSeriesEpisode(saved.entries, series.id);
    assert.equal(bumped.find((e) => e.id === series.id)?.episode, 3);
    const markedWatched = updateCinemaEntryStatus(bumped, series.id, "watched");
    assert.equal(markedWatched.find((e) => e.id === series.id)?.status, "watched");

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
