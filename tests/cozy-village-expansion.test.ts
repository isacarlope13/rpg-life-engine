import { test } from "node:test";
import assert from "node:assert/strict";
import {
  VILLAGE_BUILDINGS_CATALOG,
  getBuildingById,
  getBuildingByDomain,
  filterBuildingsByDistrict,
} from "../src/lib/sanctuary/village-buildings-registry.ts";
import {
  COZY_VILLAGE_RESIDENTS,
  getBuildingTrophies,
  calculateBuildingTier,
} from "../src/lib/sanctuary/village-tiers.ts";
import type { SkillDomain } from "../src/types/rpg.ts";

test("Cozy Village Expansion 1: Cobertura total de habilidades del Santuario", () => {
  const REQUIRED_DOMAINS: SkillDomain[] = [
    "work",
    "reading",
    "study",
    "rubik",
    "general",
    "knitting",
    "gardening",
    "sports",
    "journaling",
    "hiking",
    "cooking",
    "gaming",
    "drawing",
    "ceramics",
  ];

  for (const domain of REQUIRED_DOMAINS) {
    const building = getBuildingByDomain(domain);
    assert.ok(building, `La habilidad canónica "${domain}" debe tener un edificio registrado en el pueblo.`);
    assert.ok(building.id, `El edificio de "${domain}" debe tener un ID estable.`);
    assert.ok(building.name, `El edificio de "${domain}" debe tener un nombre legible.`);
    assert.ok(building.icon, `El edificio de "${domain}" debe tener un sprite o icono visual.`);
  }
});

test("Cozy Village Expansion 2: Resolución de IDs y soporte de alias para Invernadero, Gimnasio y Diario", () => {
  // Invernadero y alias pabellon_gardening
  const inv = getBuildingById("invernadero");
  assert.ok(inv, "Debe resolver 'invernadero'");
  assert.equal(inv.domain, "gardening");

  const invAlias = getBuildingById("pabellon_gardening");
  assert.ok(invAlias, "Debe resolver alias retrocompatible 'pabellon_gardening'");
  assert.equal(invAlias.domain, "gardening");

  // Gimnasio
  const gym = getBuildingById("gimnasio");
  assert.ok(gym, "Debe resolver 'gimnasio'");
  assert.equal(gym.domain, "sports");
  assert.equal(gym.residentId, "bruno");

  // Cabaña del Diario
  const diario = getBuildingById("cabana_diario");
  assert.ok(diario, "Debe resolver 'cabana_diario'");
  assert.equal(diario.domain, "journaling");
  assert.equal(diario.residentId, "sora");
});

test("Cozy Village Expansion 3: Coordenadas del mapa paisajístico sin solapamientos", () => {
  const coords = VILLAGE_BUILDINGS_CATALOG.map((b) => ({
    id: b.id,
    x: b.mapCoordinates.x,
    y: b.mapCoordinates.y,
  }));

  // Validar límites
  for (const c of coords) {
    assert.ok(c.x >= 0 && c.x <= 100, `Coordenada x de ${c.id} fuera de rango [0, 100]: ${c.x}`);
    assert.ok(c.y >= 0 && c.y <= 100, `Coordenada y de ${c.id} fuera de rango [0, 100]: ${c.y}`);
  }

  // Comprobar distancia euclidiana mínima entre cualquier par de edificios (mínimo 7% de separación)
  for (let i = 0; i < coords.length; i++) {
    for (let j = i + 1; j < coords.length; j++) {
      const b1 = coords[i];
      const b2 = coords[j];
      const dist = Math.sqrt(Math.pow(b1.x - b2.x, 2) + Math.pow(b1.y - b2.y, 2));
      assert.ok(
        dist >= 7.0,
        `Los edificios ${b1.id} (${b1.x}, ${b1.y}) y ${b2.id} (${b2.x}, ${b2.y}) están demasiado cerca (distancia: ${dist.toFixed(1)}%). Riesgo de solapamiento.`
      );
    }
  }
});

test("Cozy Village Expansion 4: Censo de Residentes y Compañeros asignados", () => {
  for (const b of VILLAGE_BUILDINGS_CATALOG) {
    const resident = COZY_VILLAGE_RESIDENTS.find((r) => r.id === b.residentId);
    assert.ok(resident, `El edificio ${b.id} requiere un residente válido registrado (esperaba ${b.residentId})`);
    assert.equal(resident.id, b.residentId, `El residente ${b.residentId} debe coincidir con ${b.id}`);

    // Comprobar que genera consejo dinámico sin lanzar excepciones
    const advice = resident.getDynamicAdvice({
      skillLevel: 2,
      sessionsCount: 5,
      lastSessionDetails: "Prueba de consejo",
    });
    assert.ok(advice && advice.length > 5, `El residente ${resident.name} debe generar un consejo dinámico no vacío.`);
  }

  // Residentes específicos Bruno y Sora
  const bruno = COZY_VILLAGE_RESIDENTS.find((r) => r.id === "bruno");
  assert.ok(bruno, "Residente Bruno (Entrenador) debe existir.");
  assert.equal(bruno.domain, "sports");

  const sora = COZY_VILLAGE_RESIDENTS.find((r) => r.id === "sora");
  assert.ok(sora, "Residente Sora (Cronista) debe existir.");
  assert.equal(sora.domain, "journaling");
});

test("Cozy Village Expansion 5: Trofeos de Invernadero, Gimnasio y Cabaña del Diario", () => {
  const gymTrophies = getBuildingTrophies("gimnasio", { level: 2, sessionsCount: 4 });
  assert.ok(gymTrophies.length >= 3, "Gimnasio debe contar con trofeos configurados.");
  assert.equal(gymTrophies[0].id, "gym_mat");
  assert.equal(gymTrophies[0].unlocked, true);

  const diarioTrophies = getBuildingTrophies("cabana_diario", { level: 3, sessionsCount: 6 });
  assert.ok(diarioTrophies.length >= 3, "Cabaña del Diario debe contar con trofeos.");
  assert.equal(diarioTrophies[0].id, "dia_quill");
  assert.equal(diarioTrophies[0].unlocked, true);

  const invTrophies = getBuildingTrophies("invernadero", { level: 2, sessionsCount: 3 });
  assert.ok(invTrophies.length >= 3, "Invernadero debe contar con trofeos.");
  assert.equal(invTrophies[0].id, "inv_pot");
});

test("Cozy Village Expansion 6: Filtrado por Distritos Comunitarios", () => {
  const saber = filterBuildingsByDistrict("saber");
  assert.ok(saber.length >= 4, "Distrito del Saber debe contener al menos 4 edificios.");
  assert.ok(saber.some((b) => b.id === "cabana_diario"), "Diario debe estar en Saber");

  const artes = filterBuildingsByDistrict("artes");
  assert.ok(artes.length >= 4, "Distrito de Artes debe contener al menos 4 edificios.");

  const naturaleza = filterBuildingsByDistrict("naturaleza");
  assert.ok(naturaleza.length >= 3, "Distrito de Naturaleza debe contener al menos 3 edificios.");
  assert.ok(naturaleza.some((b) => b.id === "invernadero"), "Invernadero debe estar en Naturaleza");
  assert.ok(naturaleza.some((b) => b.id === "gimnasio"), "Gimnasio debe estar en Naturaleza");
});
