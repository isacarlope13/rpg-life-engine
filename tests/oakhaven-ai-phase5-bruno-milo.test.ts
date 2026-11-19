import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { RPGEngineMemoryStore } from "../src/lib/demo-store.ts";
import {
  calculateCubeStatsForType,
  calculateTrainingVolume,
  calculateWcaAverage,
  detectMedicalOrInjuryQuery,
  filterRealGymSets,
  proposeCubePracticeSession,
  proposeNextWorkout,
} from "../src/lib/ai/bruno-milo-tools.ts";
import { askBuildingSpecialist } from "../src/lib/ai/specialist-engine.ts";
import { askMayorRowan } from "../src/lib/ai/mayor-rowan-engine.ts";
import type { GymSetRecord } from "../src/lib/sanctuary/gym-engine.ts";
import type { PrivateBuildingResource } from "../src/lib/ai/building-resources-engine.ts";
import type { MayorToolContext } from "../src/lib/ai/mayor-readonly-tools.ts";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

describe("OAKHAVEN AI FASE 5 — Bruno (Gym) y Milo (Cubos WCA)", () => {
  test("1. Bruno (Gym): excluye series demo, calcula volumen/RPE/peso reales, aplica seguridad médica y propone rutina Nivel 2 idempotente", async () => {
    const mixedSets: GymSetRecord[] = [
      {
        id: "demo-set-1",
        exerciseName: "Sentadilla Goblet",
        setNumber: 1,
        reps: 10,
        weightKg: 99,
        rpe: 9,
        completed: true,
        isDemo: true,
        dataOrigin: "demo_template",
      },
      {
        id: "real-set-1",
        exerciseName: "Press de Banca con Mancuernas",
        setNumber: 1,
        reps: 10,
        weightKg: 20,
        rpe: 7,
        completed: true,
        dataOrigin: "real_local",
      },
      {
        id: "real-set-2",
        exerciseName: "Press de Banca con Mancuernas",
        setNumber: 2,
        reps: 8,
        weightKg: 22.5,
        rpe: 8,
        completed: true,
        dataOrigin: "real_local",
      },
    ];

    const filtered = filterRealGymSets(mixedSets);
    assert.equal(filtered.excludedDemoCount, 1);
    assert.equal(filtered.realSets.length, 2);

    const vol = calculateTrainingVolume(mixedSets);
    assert.equal(vol.completedSetsCount, 2);
    // 10*20 + 8*22.5 = 200 + 180 = 380 kg (demo 99kg excluido)
    assert.equal(vol.totalVolumeKg, 380);
    assert.equal(vol.averageRpe, 7.5);
    assert.equal(vol.byExercise["Press de Banca con Mancuernas"].lastWeightKg, 22.5);
    assert.equal(vol.byExercise["Sentadilla Goblet"], undefined);

    // Seguridad médica: nunca diagnostica lesiones
    assert.ok(detectMedicalOrInjuryQuery("Tengo un dolor agudo en la rodilla, ¿es un esguince?") !== null);
    assert.equal(detectMedicalOrInjuryQuery("¿Cuánto volumen hice hoy?"), null);

    // Propuesta Nivel 2 idempotente
    const p1 = proposeNextWorkout({ focus: "Fuerza tren superior", lastExercise: "Press", lastWeightKg: 22.5, lastReps: 8 });
    const p2 = proposeNextWorkout({ focus: "Fuerza tren superior", lastExercise: "Press", lastWeightKg: 22.5, lastReps: 8 });
    assert.equal(p1.requiresConfirmation, true);
    assert.equal(p1.idempotencyKey, p2.idempotencyKey);

    // Conversación con Bruno + aislamiento de edificios y usuarios + invariante GP/XP
    const store = new RPGEngineMemoryStore();
    const gpBefore = store.wallet_gp;
    const xpBefore = store.current_xp;
    const ctx: MayorToolContext = {
      authenticatedUserId: USER_A,
      db: null,
      store,
      isSupabaseConfigured: false,
      localSnapshot: { gymSets: mixedSets },
    };

    const brunoRes = await askBuildingSpecialist({
      buildingId: "gimnasio",
      question: "¿Cuánto volumen real hice y propón una rutina gradual para mi próximo entrenamiento?",
      ctx,
      allowGemini: false,
    });
    assert.equal(brunoRes.specialist.name, "Bruno");
    assert.ok(brunoRes.answer.includes("380 kg"));
    assert.ok(!brunoRes.answer.includes("Sentadilla Goblet"));
    assert.equal(brunoRes.proposal?.requiresConfirmation, true);

    // Bruno rechaza recurso de Cubos y de USER_B
    const foreignResources: PrivateBuildingResource[] = [
      {
        id: "cube-doc-1",
        owner_id: USER_A,
        building_id: "club_puzzles",
        resource_type: "algorithm_sheet",
        title: "PLL Secreto",
        original_filename: "pll.md",
        mime_type: "text/markdown",
        size_bytes: 100,
        metadata: {},
        tags: [],
        created_at: "2026-11-19T10:00:00Z",
        updated_at: "2026-11-19T10:00:00Z",
        processing_status: "ready",
        extraction_status: "completed",
        extracted_text: "Algoritmo confidencial de cubos",
        is_sensitive_financial: false,
        sync_state: "SINCRONIZADO",
      },
      {
        id: "gym-user-b",
        owner_id: USER_B,
        building_id: "gimnasio",
        resource_type: "workout_plan",
        title: "Plan B",
        original_filename: "b.md",
        mime_type: "text/markdown",
        size_bytes: 100,
        metadata: {},
        tags: [],
        created_at: "2026-11-19T10:00:00Z",
        updated_at: "2026-11-19T10:00:00Z",
        processing_status: "ready",
        extraction_status: "completed",
        extracted_text: "Secreto físico de Usuario B",
        is_sensitive_financial: false,
        sync_state: "SINCRONIZADO",
      },
    ];
    const crossBld = await askBuildingSpecialist({
      buildingId: "gimnasio",
      question: "Lee este plan",
      ctx,
      allowGemini: false,
      selectedResourceId: "cube-doc-1",
      memoryResources: foreignResources,
    });
    assert.ok(!crossBld.answer.includes("Algoritmo confidencial de cubos"));

    const crossUsr = await askBuildingSpecialist({
      buildingId: "gimnasio",
      question: "Lee este plan",
      ctx,
      allowGemini: false,
      selectedResourceId: "gym-user-b",
      memoryResources: foreignResources,
    });
    assert.ok(!crossUsr.answer.includes("Secreto físico de Usuario B"));

    assert.equal(store.wallet_gp, gpBefore);
    assert.equal(store.current_xp, xpBefore);
  });

  test("2. Milo (Cubos WCA): calcula PB, Ao5, Ao12, +2, DNF, insuficientes solves y separa estrictamente por tipo de puzzle", async () => {
    // 5 solves de 3x3: [12.00, 14.00 (+2 => 16.00), 15.00, 13.00, DNF]
    // Ordenados: [12.00, 13.00, 15.00, 16.00, INF] -> trim 12.00 y INF -> promedio(13, 15, 16) = 14.67s
    const fiveWithOneDnfAndPlus2 = [
      { time_seconds: 12.0, penalty: "NONE" as const },
      { time_seconds: 14.0, penalty: "+2" as const },
      { time_seconds: 15.0, penalty: "NONE" as const },
      { time_seconds: 13.0, penalty: "NONE" as const },
      { time_seconds: 11.0, penalty: "DNF" as const },
    ];
    const ao5Valid = calculateWcaAverage(fiveWithOneDnfAndPlus2, 5);
    assert.equal(ao5Valid.status, "valid");
    assert.equal(ao5Valid.averageSeconds, 14.67);

    // 2 DNFs en Ao5 => DNF oficial WCA
    const twoDnfs = [
      { time_seconds: 12.0, penalty: "NONE" as const },
      { time_seconds: 13.0, penalty: "DNF" as const },
      { time_seconds: 14.0, penalty: "NONE" as const },
      { time_seconds: 15.0, penalty: "DNF" as const },
      { time_seconds: 16.0, penalty: "NONE" as const },
    ];
    const ao5Dnf = calculateWcaAverage(twoDnfs, 5);
    assert.equal(ao5Dnf.status, "dnf");
    assert.equal(ao5Dnf.averageSeconds, null);

    // Menos de 5 solves => insufficient_solves
    const tooFew = calculateWcaAverage([{ time_seconds: 15.0, penalty: "NONE" }], 5);
    assert.equal(tooFew.status, "insufficient_solves");

    // 12 solves de 3x3 + 1 solve ultrarrápido de 2x2 (3.10s) -> NUNCA se mezclan
    const mixedSolves = [
      ...Array.from({ length: 12 }, (_, i) => ({
        id: `s3-${i}`,
        cube_type: "3x3" as const,
        time_seconds: 15 + i * 0.5,
        penalty: "NONE" as const,
        scramble: "R U R' U'",
        is_pb: i === 0,
        ao5_after: null,
        ao12_after: null,
        algorithm_practiced: i === 0 ? "PLL T-Perm" : undefined,
        timestamp: new Date(Date.now() - i * 60_000).toISOString(),
      })),
      {
        id: "s2-1",
        cube_type: "2x2" as const,
        time_seconds: 3.1,
        penalty: "NONE" as const,
        scramble: "R U F'",
        is_pb: true,
        ao5_after: null,
        ao12_after: null,
        timestamp: new Date().toISOString(),
      },
    ];

    const stats3x3 = calculateCubeStatsForType(mixedSolves, "3x3");
    assert.equal(stats3x3.totalSolves, 12);
    assert.equal(stats3x3.pbSeconds, 15); // NO 3.10s de 2x2
    assert.equal(stats3x3.ao12.status, "valid");
    assert.equal(stats3x3.lastPracticedAlgorithm, "PLL T-Perm");

    // Plan de práctica para 2x2 NO recomienda F2L/OLL/PLL de 3x3
    const plan2x2 = proposeCubePracticeSession({ cubeType: "2x2", focus: "Ortega", currentAo5: null });
    assert.equal(plan2x2.requiresConfirmation, true);
    assert.ok(String(plan2x2.payload.rawTextContent).includes("Ortega"));
    assert.ok(!String(plan2x2.payload.rawTextContent).includes("F2L lento"));

    const store = new RPGEngineMemoryStore();
    store.rubikSolves = mixedSolves;
    const gpBefore = store.wallet_gp;
    const xpBefore = store.current_xp;
    const ctx: MayorToolContext = {
      authenticatedUserId: USER_A,
      db: null,
      store,
      isSupabaseConfigured: false,
    };

    const miloRes = await askBuildingSpecialist({
      buildingId: "club_puzzles",
      question: "¿Cuál es mi PB, Ao5 y Ao12 de 3x3? Explícame notación WCA y propón una sesión de práctica",
      ctx,
      allowGemini: false,
    });
    assert.equal(miloRes.specialist.name, "Milo");
    assert.ok(miloRes.answer.includes("15s"));
    assert.ok(miloRes.answer.includes("PLL T-Perm"));
    assert.ok(miloRes.answer.includes("Notación oficial WCA"));
    assert.equal(miloRes.proposal?.requiresConfirmation, true);
    assert.equal(store.wallet_gp, gpBefore);
    assert.equal(store.current_xp, xpBefore);
  });

  test("3. Transversal: Rowan consulta Gym y Cubos con peso/algoritmo reales, bloquea Nivel 3 y mantiene GP/XP/COP intactos", async () => {
    const store = new RPGEngineMemoryStore();
    store.rubikSolves = [
      {
        id: "r-1",
        cube_type: "3x3",
        time_seconds: 14.22,
        penalty: "NONE",
        scramble: "R U R' U'",
        is_pb: true,
        ao5_after: null,
        ao12_after: null,
        algorithm_practiced: "OLL Sune",
        timestamp: "2026-11-19T09:00:00.000Z",
      },
    ];
    const gpBefore = store.wallet_gp;
    const xpBefore = store.current_xp;
    const ctx: MayorToolContext = {
      authenticatedUserId: USER_A,
      db: null,
      store,
      isSupabaseConfigured: false,
      localSnapshot: {
        gymSets: [
          {
            id: "real-g1",
            exerciseName: "Peso Muerto Rumano",
            setNumber: 1,
            reps: 10,
            weightKg: 30,
            rpe: 8,
            completed: true,
          },
        ],
      },
    };

    const rowanRes = await askMayorRowan({
      question: "¿Cuándo fue mi último entrenamiento de gym y cuál es mi récord de cubos?",
      ctx,
      allowGemini: false,
    });
    assert.equal(rowanRes.mode, "deterministic_grounded");
    assert.ok(rowanRes.answer.includes("Peso Muerto Rumano"));
    assert.ok(rowanRes.answer.includes("30 kg"));
    assert.ok(rowanRes.answer.includes("14.22s"));
    assert.ok(rowanRes.answer.includes("OLL Sune"));

    const blockedMilo = await askBuildingSpecialist({
      buildingId: "club_puzzles",
      question: "Ejecuta un pago de 20000 COP y dame 500 XP",
      ctx,
      allowGemini: false,
    });
    assert.equal(blockedMilo.mode, "blocked_safety");

    assert.equal(store.wallet_gp, gpBefore);
    assert.equal(store.current_xp, xpBefore);
  });
});
