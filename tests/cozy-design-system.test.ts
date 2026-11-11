import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COZY_COLORS,
  COZY_SHADOWS,
  COZY_BORDERS,
  COZY_RADII,
} from "../src/components/cozy/ui/tokens.ts";

test("Cozy Design System 1: Paleta Oficial de 8 Colores + Neutros de Contraste", () => {
  // Paleta base requerida
  assert.equal(COZY_COLORS.forest, "#314C3C", "Color Forest debe ser #314C3C");
  assert.equal(COZY_COLORS.sage, "#77936A", "Color Sage debe ser #77936A");
  assert.equal(COZY_COLORS.meadow, "#B8CCA0", "Color Meadow debe ser #B8CCA0");
  assert.equal(COZY_COLORS.cream, "#F4EEDC", "Color Cream debe ser #F4EEDC");
  assert.equal(COZY_COLORS.wood, "#D8B48A", "Color Wood debe ser #D8B48A");
  assert.equal(COZY_COLORS.clay, "#C88973", "Color Clay debe ser #C88973");
  assert.equal(COZY_COLORS.lake, "#A9C7C7", "Color Lake debe ser #A9C7C7");
  assert.equal(COZY_COLORS.sunlight, "#E7D69C", "Color Sunlight debe ser #E7D69C");

  // Neutros de contraste
  assert.equal(COZY_COLORS.bark, "#3A2E2B", "Color Bark debe ser #3A2E2B");
  assert.equal(COZY_COLORS.parchment, "#FFFDF8", "Color Parchment debe ser #FFFDF8");

  // Validación de formato hexadecimal
  const hexRegex = /^#[0-9A-Fa-f]{6}$/;
  for (const [key, val] of Object.entries(COZY_COLORS)) {
    assert.match(val, hexRegex, `El color ${key} (${val}) debe ser un código HEX válido de 6 caracteres.`);
  }
});

test("Cozy Design System 2: Sombras Táctiles y Biseles Pixel-Art", () => {
  assert.ok(COZY_SHADOWS.sm.includes("#3A2E2B"), "Sombra sm debe usar borde bark #3A2E2B");
  assert.ok(COZY_SHADOWS.md.includes("#3A2E2B"), "Sombra md debe usar borde bark #3A2E2B");
  assert.ok(COZY_SHADOWS.lg.includes("#3A2E2B"), "Sombra lg debe usar borde bark #3A2E2B");
  assert.ok(COZY_SHADOWS.modal.includes("#3A2E2B"), "Sombra modal debe usar borde bark #3A2E2B");

  assert.ok(COZY_BORDERS.pixel.includes("#3A2E2B"), "Borde pixel debe ser de 3px #3A2E2B");
  assert.ok(COZY_BORDERS.pixelThick.includes("#3A2E2B"), "Borde pixelThick debe ser de 4px #3A2E2B");
});

test("Cozy Design System 3: Radios de Borde Coherentes con Diseño Bento", () => {
  assert.equal(COZY_RADII.none, "0px");
  assert.equal(COZY_RADII.sm, "0.5rem");
  assert.equal(COZY_RADII.md, "0.75rem");
  assert.equal(COZY_RADII.lg, "1rem");
  assert.equal(COZY_RADII.xl, "1.25rem");
  assert.equal(COZY_RADII["2xl"], "1.5rem");
});

test("Cozy Design System 4: Ambientación Sonora y Presets de Oakhaven", async () => {
  const { SOUNDSCAPE_PRESETS, cozySoundscape } = await import("../src/lib/cozy/cozy-soundscape.ts");
  assert.equal(SOUNDSCAPE_PRESETS.length, 5, "Deben existir 5 presets de paisajes sonoros");
  assert.equal(SOUNDSCAPE_PRESETS[0].id, "off", "El preset inicial debe ser silencio 'off'");
  assert.equal(cozySoundscape.getCurrentPreset(), "off", "El estado por defecto debe ser silencio absoluto");
  
  const presetIds = SOUNDSCAPE_PRESETS.map((p) => p.id);
  assert.deepEqual(presetIds, ["off", "rain", "fireplace", "breeze", "chimes"]);
});

test("Cozy Dashboard 5: Residentes de Oakhaven y Cálculo Progresivo de Tiers", async () => {
  const { COZY_VILLAGE_RESIDENTS, calculateBuildingTier } = await import("../src/lib/sanctuary/village-tiers.ts");
  assert.equal(COZY_VILLAGE_RESIDENTS.length, 8, "Deben existir exactamente 8 residentes del pueblo");
  
  // Test tier thresholds
  assert.equal(calculateBuildingTier({ level: 1, sessionsCount: 0 }).tier, 1, "Nivel 1 con 0 sesiones debe ser Tier 1");
  assert.equal(calculateBuildingTier({ level: 2, sessionsCount: 4 }).tier, 2, "Nivel 2 con 4 sesiones debe ser Tier 2");
  assert.equal(calculateBuildingTier({ level: 5, sessionsCount: 12 }).tier, 3, "Nivel 5 con 12 sesiones debe ser Tier 3");
});

test("Cozy Dashboard 6: Resiliencia Offline y Cola PWA", async () => {
  const { getOfflineQueue, queueOfflineAction } = await import("../src/lib/offline-sync.ts");
  assert.ok(Array.isArray(getOfflineQueue()), "La cola offline debe retornar un arreglo");
});
