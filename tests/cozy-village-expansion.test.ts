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
import {
  GYM_ROUTINES_CATALOG,
  calculateWorkoutMetrics,
  RPE_DESCRIPTIONS,
  type GymSetRecord,
} from "../src/lib/sanctuary/gym-engine.ts";
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

test("Cozy Village Expansion 7: Consistencia de contadores dinámicos y ausencia de valores quemados", () => {
  assert.equal(VILLAGE_BUILDINGS_CATALOG.length, 14, "El catálogo del pueblo debe tener exactamente 14 edificios.");
  assert.equal(COZY_VILLAGE_RESIDENTS.length, 13, "El censo de Oakhaven debe tener exactamente 13 residentes.");

  // El edificio piloto 'atelier' debe existir y pertenecer al dominio knitting
  const atelier = getBuildingById("atelier");
  assert.ok(atelier, "El edificio piloto 'atelier' debe existir.");
  assert.equal(atelier.domain, "knitting");
  assert.equal(atelier.residentId, "clara");
});

test("Cozy Village Expansion 8: Progresión visual de Tiers del Edificio Piloto (Atelier)", () => {
  const tier1 = calculateBuildingTier({ level: 1, sessionsCount: 0 });
  assert.equal(tier1.tier, 1);
  assert.ok(tier1.badge.includes("Tier 1") || tier1.badge.includes("T1"));

  const tier2 = calculateBuildingTier({ level: 3, sessionsCount: 5, completedProjectsCount: 1 });
  assert.equal(tier2.tier, 2);
  assert.ok(tier2.badge.includes("Tier 2") || tier2.badge.includes("T2"));

  const tier3 = calculateBuildingTier({ level: 5, sessionsCount: 15, completedProjectsCount: 3 });
  assert.equal(tier3.tier, 3);
  assert.ok(tier3.badge.includes("Tier 3") || tier3.badge.includes("T3"));
});

test("Cozy Village Expansion 9: OakHaven 3.7 — Motor de Gimnasio, cálculo de tonelaje y escala RPE", () => {
  // 1. Verificación del Catálogo de Rutinas
  const ROUTINE_KEYS = ["fuerza", "cardio", "movilidad", "hipertrofia"] as const;
  for (const key of ROUTINE_KEYS) {
    const routine = GYM_ROUTINES_CATALOG[key];
    assert.ok(routine, `La rutina '${key}' debe existir en el catálogo.`);
    assert.ok(routine.name, `La rutina '${key}' debe tener nombre descriptivo.`);
    assert.ok(routine.exercises.length > 0, `La rutina '${key}' debe contener al menos un ejercicio.`);
    assert.ok(routine.defaultRestSecs >= 30, `El descanso de '${key}' debe ser de al menos 30 segundos.`);
  }

  // 2. Verificación de la Escala RPE (1 a 10)
  for (let r = 1; r <= 10; r++) {
    assert.ok(RPE_DESCRIPTIONS[r], `La escala RPE debe tener descripción para el nivel ${r}`);
  }

  // 3. Verificación de Cálculo Matemático de Volumen y RPE (Tonelaje)
  const sampleSets: GymSetRecord[] = [
    {
      id: "s1",
      exerciseName: "Sentadilla Goblet",
      setNumber: 1,
      reps: 10,
      weightKg: 20, // 200 kg
      rpe: 7,
      completed: true,
    },
    {
      id: "s2",
      exerciseName: "Sentadilla Goblet",
      setNumber: 2,
      reps: 8,
      weightKg: 25, // 200 kg
      rpe: 8,
      completed: true,
    },
    {
      id: "s3",
      exerciseName: "Sentadilla Goblet",
      setNumber: 3,
      reps: 6,
      weightKg: 30, // 180 kg (no completada, no debe sumar)
      rpe: 9,
      completed: false,
    },
  ];

  const metrics = calculateWorkoutMetrics(sampleSets);
  assert.equal(metrics.totalCount, 3, "Total de series debe ser 3.");
  assert.equal(metrics.completedCount, 2, "Series completadas deben ser 2.");
  assert.equal(metrics.totalVolumeKg, 400, "El tonelaje acumulado debe ser 400 kg (200 + 200).");
  assert.equal(metrics.avgRpe, 7.5, "El RPE promedio debe ser exactamente 7.5.");
});

test("Cozy Village Expansion 10: OakHaven 3.7 — Residente Bruno, Micro-Misión y Guía de Vitalidad", () => {
  const bruno = COZY_VILLAGE_RESIDENTS.find((r) => r.id === "bruno");
  assert.ok(bruno, "El residente 'bruno' debe estar presente en el censo.");
  assert.equal(bruno.buildingId, "gimnasio", "Bruno debe ser el residente asignado al Gimnasio.");
  assert.equal(bruno.domain, "sports", "Bruno debe pertenecer al dominio 'sports'.");
  assert.ok(bruno.greetingQuote.length > 10, "Bruno debe tener un saludo inspirador.");

  // Micro-misión de Vitalidad
  assert.ok(bruno.microQuest, "Bruno debe tener una micro-misión.");
  assert.equal(bruno.microQuest.targetAction, "sports_session", "La micro-misión debe apuntar a sports_session.");

  // Consejos dinámicos de Bruno
  const adviceNewbie = bruno.getDynamicAdvice({ skillLevel: 1, sessionsCount: 0 });
  assert.ok(
    adviceNewbie.includes("barras") || adviceNewbie.includes("rutina") || adviceNewbie.includes("hidratación"),
    "Consejo inicial debe alentar al nuevo héroe."
  );

  const adviceVeteran = bruno.getDynamicAdvice({ skillLevel: 3, sessionsCount: 12 });
  assert.ok(
    adviceVeteran.includes("12") || adviceVeteran.includes("sesiones") || adviceVeteran.includes("disciplina"),
    "Consejo avanzado debe reconocer las 12 sesiones."
  );
});

