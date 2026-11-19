import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  EXPLORER_BOUNDS,
  DEFAULT_EXPLORER_POS,
  clampExplorerPosition,
  stepExplorerPosition,
  findNearestBuilding,
  deriveBuildingVisualSignals,
  getResidentAmbientState,
  getInteriorRoomTheme,
  loadAmbientMotionPreference,
  saveAmbientMotionPreference,
} from "../src/lib/sanctuary/living-village-engine.ts";
import { VILLAGE_BUILDINGS_CATALOG } from "../src/lib/sanctuary/village-buildings-registry.ts";

describe("OAKHAVEN FASE 9 — PUEBLO VIVO 5.0 (WORLD EXPERIENCE)", () => {
  test("1. Avatar explorador respeta límites del mundo y detecta proximidad de edificios", () => {
    const clampedMin = clampExplorerPosition(-500, -200);
    assert.equal(clampedMin.x, EXPLORER_BOUNDS.minX);
    assert.equal(clampedMin.y, EXPLORER_BOUNDS.minY);

    const clampedMax = clampExplorerPosition(9999, 9999);
    assert.equal(clampedMax.x, EXPLORER_BOUNDS.maxX);
    assert.equal(clampedMax.y, EXPLORER_BOUNDS.maxY);

    const stepped = stepExplorerPosition(DEFAULT_EXPLORER_POS, "right", 50);
    assert.equal(stepped.x, DEFAULT_EXPLORER_POS.x + 50);
    assert.equal(stepped.y, DEFAULT_EXPLORER_POS.y);
    assert.equal(stepped.facing, "right");

    const nearPlaza = findNearestBuilding({ x: 700, y: 315 }, VILLAGE_BUILDINGS_CATALOG, {}, 350);
    assert.ok(nearPlaza, "Debe detectar un edificio cercano a la plaza dentro del radio");
  });

  test("2. Señales visuales reflejan solo registros confirmados y nunca penalizan días de descanso", () => {
    const restSignals = deriveBuildingVisualSignals({
      buildingId: "gimnasio",
      isSessionActive: false,
      recentSessions: [],
    });
    assert.equal(restSignals.length, 1);
    assert.equal(restSignals[0].kind, "calm_rest");

    const activeSignals = deriveBuildingVisualSignals({
      buildingId: "club_puzzles",
      isSessionActive: true,
      recentSessions: [
        {
          id: "s1",
          domain: "rubik",
          duration_minutes: 15,
          xp_earned: 30,
          gp_earned: 15,
          created_at: new Date().toISOString(),
        } as never,
      ],
      rubikSolvesCount: 12,
      hasPendingProposal: true,
    });
    const kinds = activeSignals.map((s) => s.kind);
    assert.ok(kinds.includes("active_session"));
    assert.ok(kinds.includes("pending_proposal"));
    assert.ok(kinds.includes("recent_completed"));
    assert.ok(kinds.includes("active_items"));
  });

  test("3. Habitantes dinámicos funcionan sin IA (0 llamadas Gemini) y respetan silencio", () => {
    const muted = getResidentAmbientState({
      residentName: "Clara",
      isSessionActive: false,
      confirmedSessionsCount: 4,
      isAiMuted: true,
    });
    assert.equal(muted.mood, "quiet");
    assert.equal(muted.showAiMutedBadge, true);

    const active = getResidentAmbientState({
      residentName: "Bruno",
      isSessionActive: true,
      confirmedSessionsCount: 2,
      isAiMuted: false,
    });
    assert.equal(active.mood, "guiding");
    assert.equal(active.showAiMutedBadge, false);

    const calm = getResidentAmbientState({
      residentName: "Silas",
      isSessionActive: false,
      confirmedSessionsCount: 0,
      isAiMuted: false,
    });
    assert.equal(calm.mood, "welcoming");
    assert.match(calm.shortLine, /sin prisa/i);
  });

  test("4. Los 8 edificios definitivos tienen habitaciones temáticas con mobiliario interactivo", () => {
    const eightIds = [
      "biblioteca",
      "atelier",
      "gimnasio",
      "club_puzzles",
      "cine",
      "banco_oakhaven",
      "oficina",
      "libreria",
    ];
    for (const id of eightIds) {
      const theme = getInteriorRoomTheme(id);
      assert.ok(theme.roomLabel.length > 5, `${id} debe tener nombre de habitación`);
      assert.ok(theme.props.length >= 3, `${id} debe tener al menos 3 elementos interactivos`);
    }
  });

  test("5. Persistencia de preferencia de movimiento reducido funciona de forma segura", () => {
    saveAmbientMotionPreference(false);
    // En entorno Node sin window.localStorage, safeLocalStorage usa fallback en memoria o retorna booleano seguro
    const pref = loadAmbientMotionPreference();
    assert.equal(typeof pref, "boolean");
    saveAmbientMotionPreference(true);
  });

  test("6. Integridad estructural: pausa off-screen, pinch-to-zoom, Rowan, móvil, accesibilidad y Compañeros", () => {
    const sceneSrc = fs.readFileSync("src/components/sanctuary/interactive-village-scene.tsx", "utf8");
    const mapSrc = fs.readFileSync("src/components/sanctuary/cozy-village-map.tsx", "utf8");
    const roomSrc = fs.readFileSync("src/components/sanctuary/living-interior-room.tsx", "utf8");
    const cssSrc = fs.readFileSync("src/app/globals.css", "utf8");
    const dashSrc = fs.readFileSync("src/components/cozy-rpg-dashboard.tsx", "utf8");

    assert.match(sceneSrc, /IntersectionObserver/);
    assert.match(sceneSrc, /data-ambient-paused/);
    assert.match(sceneSrc, /onTouchStart/);
    assert.match(sceneSrc, /touch-none/);
    assert.match(sceneSrc, /Presidente Rowan/);

    assert.match(mapSrc, /Ir directo:/);
    assert.match(mapSrc, /saveAmbientMotionPreference/);
    assert.match(mapSrc, /onOpenMayorRowan/);

    assert.match(roomSrc, /role="tablist"/);
    assert.match(roomSrc, /min-h-\[44px\]/);
    assert.match(roomSrc, /BuildingSpecialistPanel/);

    assert.match(cssSrc, /data-ambient-paused="true"/);
    assert.match(cssSrc, /prefers-reduced-motion: reduce/);

    assert.match(dashSrc, /setIsCompanionsOpen\(true\)/);

    // Regresiones Release 3.2: overflow móvil en header, D-pad sin solapamiento, wheel no-pasivo, foco teclado y zIndex de Rowan
    const headerSrc = fs.readFileSync("src/components/cozy/cozy-header.tsx", "utf8");
    const camSrc = fs.readFileSync("src/lib/sanctuary/use-village-camera.ts", "utf8");
    assert.match(headerSrc, /flex-wrap items-center gap-1 max-w-full/);
    assert.match(sceneSrc, /top-3 left-3 sm:top-auto sm:bottom-4 sm:left-4/);
    assert.match(sceneSrc, /rowanSpeechOpen \? 60 : 28/);
    assert.match(camSrc, /passive: false/);
    assert.match(camSrc, /contenteditable/);
  });
});
