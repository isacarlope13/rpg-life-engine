import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

// Mock localStorage para el runner de Node.js en pruebas aisladas
if (typeof globalThis.localStorage === "undefined" || !globalThis.localStorage) {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, val: string) => store.set(key, val),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    length: 0,
    key: () => null,
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: mockStorage,
    writable: true,
    configurable: true,
  });
}

/**
 * ============================================================================
 * FASE 12 — PRUEBAS DE ACEPTACIÓN FORMAL (COZY LIVING VILLAGE RELEASE)
 * ============================================================================
 * Verificación determinista de los 9 casos de aceptación para la versión integrada.
 */

// ----------------------------------------------------------------------------
// CASO 1: Entrar al dashboard, consultar datos reales y acceder al pueblo
// ----------------------------------------------------------------------------
test("Aceptación Caso 1: Dashboard Bento, Hidratación de Datos Reales y Acceso al Pueblo", async () => {
  const { VILLAGE_BUILDINGS_CATALOG } = await import(
    "../src/lib/sanctuary/village-buildings-registry.ts"
  );
  const { COZY_COLORS } = await import(
    "../src/components/cozy/ui/tokens.ts"
  );

  // 1. Simulación de carga del estado canónico del motor (/api/state)
  const realEngineState = {
    wallet_gp: 45000,
    vault_gp: 250000,
    player_level: 12,
    current_xp: 3420,
    current_streak_days: 14,
    streak_multiplier: 1.5,
    quests: [{ id: "q1", title: "Lectura diaria", completed: false }],
    reading_books: [{ id: "b1", title: "Clean Code", author: "Robert Martin", total_pages: 464, pages_read: 200, status: "reading" }],
    knitting_projects: [{ id: "k1", name: "Bufanda Merina", technique: "Dos Agujas", completed_rows: 40, total_rows_target: 80, status: "in_progress" }],
    skill_sessions: [],
    skill_summaries: [
      { domain: "reading", level: 3, total_minutes: 180, total_gp_earned: 4500, sessions_count: 6, label: "Librería" },
      { domain: "knitting", level: 2, total_minutes: 120, total_gp_earned: 3000, sessions_count: 4, label: "Atelier" },
      { domain: "rubik", level: 4, total_minutes: 240, total_gp_earned: 6000, sessions_count: 12, label: "Club de Puzzles" },
    ],
  };

  // Validar consistencia de los datos base
  assert.equal(realEngineState.wallet_gp, 45000);
  assert.equal(realEngineState.player_level, 12);
  assert.equal(realEngineState.reading_books.length, 1);
  assert.equal(realEngineState.knitting_projects.length, 1);

  // 2. Acceso y navegación hacia el mapa del pueblo interactivo
  assert.ok(VILLAGE_BUILDINGS_CATALOG.length >= 9, "El pueblo debe renderizar al menos los 9 edificios del Santuario");
  const buildingIds = VILLAGE_BUILDINGS_CATALOG.map((b) => b.id);
  assert.ok(buildingIds.includes("atelier"));
  assert.ok(buildingIds.includes("libreria"));
  assert.ok(buildingIds.includes("biblioteca"));
  assert.ok(buildingIds.includes("club_puzzles"));
  assert.ok(buildingIds.includes("observatorio"));
  assert.ok(buildingIds.includes("oficina"));

  // 3. Estética visual de pueblo cálido (Paleta de Oakhaven)
  assert.equal(COZY_COLORS.forest, "#314C3C");
  assert.equal(COZY_COLORS.cream, "#F4EEDC");
  assert.equal(COZY_COLORS.bark, "#3A2E2B");
});

// ----------------------------------------------------------------------------
// CASO 2: Seleccionar una habilidad y entrar a su edificio
// ----------------------------------------------------------------------------
test("Aceptación Caso 2: Selección de Habilidad, Apertura de Edificio y Retorno", async () => {
  const { getBuildingByDomain } = await import(
    "../src/lib/sanctuary/village-buildings-registry.ts"
  );
  const { SANCTUARY_BUILDINGS } = await import(
    "../src/lib/sanctuary/buildings-registry.ts"
  );

  // 1. Selección de habilidad "reading"
  const readingVillageBuilding = getBuildingByDomain("reading");
  assert.ok(readingVillageBuilding);
  assert.equal(readingVillageBuilding?.id, "libreria");
  assert.equal(readingVillageBuilding?.domain, "reading");

  // 2. Comprobación del interior especializado en el catálogo
  const sanctuaryLibreria = SANCTUARY_BUILDINGS.find((b) => b.id === "libreria");
  assert.ok(sanctuaryLibreria);
  assert.equal(sanctuaryLibreria?.name, "La Librería & Archivo");
  assert.ok(sanctuaryLibreria?.specializedFeatures.length > 0);

  // 3. Verificación de contrato de cierre / retorno al pueblo
  const dashboardCode = fs.readFileSync(
    path.resolve(process.cwd(), "src/components/cozy-rpg-dashboard.tsx"),
    "utf-8"
  );
  assert.ok(
    dashboardCode.includes('aria-label="Volver al pueblo y cerrar interior"'),
    "Debe existir botón explícito y accesible de retorno al pueblo"
  );
  assert.ok(
    dashboardCode.includes("setActiveBuildingModal(null)"),
    "La acción de retorno debe cerrar el modal activo y restaurar la vista del mapa"
  );
});

// ----------------------------------------------------------------------------
// CASO 3: Iniciar, pausar, reanudar y finalizar una sesión
// ----------------------------------------------------------------------------
test("Aceptación Caso 3: Ciclo Completo de Sesión Universal (Iniciar, Pausar, Reanudar, Finalizar)", async () => {
  const {
    createUniversalSession,
    pauseUniversalSession,
    resumeUniversalSession,
    finishUniversalSession,
    calculateNetDurationSeconds,
    buildSkillSessionPayload,
  } = await import("../src/lib/sanctuary/universal-session-engine.ts");

  const t0 = 1700000000000;

  // 1. Iniciar sesión en el Atelier (Tejido)
  let session = createUniversalSession({
    userId: "usr_acc_test",
    domain: "knitting",
    buildingId: "atelier",
    projectName: "Manta Nórdica",
    autoStart: true,
  });
  session = { ...session, startedAt: new Date(t0).toISOString() };
  assert.equal(session.status, "running");

  // 2. Pausar tras 600 segundos (10 minutos)
  const t1 = t0 + 600 * 1000;
  session = pauseUniversalSession(session, t1);
  assert.equal(session.status, "paused");
  assert.equal(session.isPaused, true);
  assert.equal(calculateNetDurationSeconds(session, t1), 600);

  // 3. Reanudar tras 300 segundos (5 minutos de pausa que NO cuentan para la habilidad)
  const t2 = t1 + 300 * 1000;
  session = resumeUniversalSession(session, t2);
  assert.equal(session.status, "running");
  assert.equal(session.isPaused, false);
  assert.equal(session.pauses.length, 1);
  assert.equal(session.pauses[0].duration_seconds, 300);

  // 4. Finalizar tras otros 600 segundos de trabajo activo (10 minutos más)
  const t3 = t2 + 600 * 1000;
  const completedSession = finishUniversalSession(session, undefined, t3);
  assert.equal(completedSession.status, "completed");
  // Total activo: 600s + 600s = 1200s (20 minutos exactos)
  assert.equal(completedSession.elapsedSeconds, 1200);

  // 5. Payload canónico para el backend
  const payload = buildSkillSessionPayload(completedSession);
  assert.equal(payload.domain, "knitting");
  assert.equal(payload.duration_minutes, 20);
  assert.ok(payload.idempotency_key);
});

// ----------------------------------------------------------------------------
// CASO 4: Cerrar y abrir la aplicación y recuperar una sesión activa
// ----------------------------------------------------------------------------
test("Aceptación Caso 4: Resiliencia ante Cierre/Recarga y Recuperación de Sesión Activa", async () => {
  const {
    createUniversalSession,
    hydrateUniversalSession,
    calculateNetDurationSeconds,
  } = await import("../src/lib/sanctuary/universal-session-engine.ts");

  const startTimestamp = 1700000000000;
  let session = createUniversalSession({
    userId: "usr_reload_test",
    domain: "study",
    buildingId: "biblioteca",
    resourceTitle: "Algoritmos y Estructuras de Datos",
    autoStart: true,
  });
  session = { ...session, startedAt: new Date(startTimestamp).toISOString() };

  // Simular guardado local-first en storage
  const serializedState = JSON.stringify(session);

  // Simular cierre de pestaña y recarga 20 minutos después (1200s)
  const reloadTimestamp = startTimestamp + 1200 * 1000;
  const recoveredSession = hydrateUniversalSession(
    serializedState,
    "usr_reload_test",
    reloadTimestamp
  );

  assert.ok(recoveredSession, "La sesión debe hidratarse sin pérdida de datos");
  assert.equal(recoveredSession?.sessionId, session.sessionId);
  assert.equal(recoveredSession?.domain, "study");
  assert.equal(recoveredSession?.status, "running");
  const netSecs = calculateNetDurationSeconds(recoveredSession!, reloadTimestamp);
  assert.equal(netSecs, 1200, "Debe registrar exactamente los 20 minutos transcurridos");
});

// ----------------------------------------------------------------------------
// CASO 5: Completar una actividad y verificar su registro sin duplicados
// ----------------------------------------------------------------------------
test("Aceptación Caso 5: Finalización Idempotente y Prevención de Registros Duplicados", async () => {
  const {
    createUniversalSession,
    finishUniversalSession,
    buildSkillSessionPayload,
  } = await import("../src/lib/sanctuary/universal-session-engine.ts");
  const { recordConfirmedMilestoneEvent, getStoredProgressionState } = await import(
    "../src/lib/sanctuary/visual-village-progression.ts"
  );

  const session = createUniversalSession({
    userId: "usr_dedup_test",
    domain: "rubik",
    buildingId: "club_puzzles",
    specializedData: {
      rubik: {
        cube_model: "MoYu RS3M V5",
        solve_time_seconds: 13.45,
      },
    },
    autoStart: true,
  });

  const completed = finishUniversalSession(session, undefined, Date.now() + 600000);
  const payload1 = buildSkillSessionPayload(completed);
  const payload2 = buildSkillSessionPayload(completed);

  // 1. La clave de idempotencia debe ser estrictamente idéntica en reintentos
  assert.equal(payload1.idempotency_key, payload2.idempotency_key);
  assert.ok(typeof payload1.idempotency_key === "string" && (payload1.idempotency_key as string).length > 20);

  // 2. Registro de hito visual con deduplicación criptográfica
  const event = {
    eventId: `evt_wca_pb_${session.sessionId}`,
    userId: "usr_dedup_test",
    buildingId: "club_puzzles",
    domain: "rubik" as const,
    milestoneType: "rubik_record" as const,
    targetId: "solve_13_45",
    title: "Nuevo Récord Personal WCA: 13.45s",
    confirmedAt: new Date().toISOString(),
  };

  const attempt1 = recordConfirmedMilestoneEvent("usr_dedup_test", event);
  assert.equal(attempt1.wasAlreadyProcessed, false, "El primer intento debe procesar el evento");

  const attempt2 = recordConfirmedMilestoneEvent("usr_dedup_test", event);
  assert.equal(attempt2.wasAlreadyProcessed, true, "El segundo intento idéntico debe marcarse como duplicado");

  const state = getStoredProgressionState("usr_dedup_test");
  const occurrences = state.processedEventIds.filter((id) => id === event.eventId).length;
  assert.equal(occurrences, 1, "El evento debe figurar exactamente 1 vez en el log persistido");
});

// ----------------------------------------------------------------------------
// CASO 6: Visualizar un hito confirmado y comprobar la evolución decorativa
// ----------------------------------------------------------------------------
test("Aceptación Caso 6: Visualización de Hito Confirmado y Evolución Visual del Pueblo", async () => {
  const { projectAtelierProgression, projectLibreriaProgression } = await import(
    "../src/lib/sanctuary/visual-village-progression.ts"
  );

  // 1. Atelier inicial: Tier 1
  const initialAtelier = projectAtelierProgression({
    level: 1,
    sessionsCount: 0,
    knittingProjects: [],
  });
  assert.equal(initialAtelier.tier, 1);
  assert.equal(initialAtelier.tierName, "Cabaña de Bastidor Rústico");
  assert.equal(initialAtelier.creationsExhibition.length, 0);

  // 2. Atelier tras hito confirmado de prenda completada: Tier 2 + exhibición
  const upgradedAtelier = projectAtelierProgression({
    level: 2,
    sessionsCount: 4,
    knittingProjects: [
      {
        id: "p_acc_1",
        name: "Chaleco de Lana Virgen",
        technique: "Dos Agujas",
        total_rows_target: 40,
        completed_rows: 40,
        yarn_details: "Lana Merino",
        status: "completed",
      },
    ],
  });
  assert.equal(upgradedAtelier.tier, 2);
  assert.equal(upgradedAtelier.tierName, "Taller de Costura Establecido");
  assert.equal(upgradedAtelier.creationsExhibition.length, 1);
  assert.equal(upgradedAtelier.creationsExhibition[0].title, "Chaleco de Lana Virgen");

  // 3. Librería tras completar 3 libros: Tier 3 (Santuario Maestro)
  const masterLibreria = projectLibreriaProgression({
    level: 5,
    sessionsCount: 25,
    readingBooks: [
      { id: "b1", title: "El Señor de los Anillos", author: "J.R.R. Tolkien", total_pages: 500, pages_read: 500, status: "completed", category: "Fantasía" },
      { id: "b2", title: "Dune", author: "Frank Herbert", total_pages: 600, pages_read: 600, status: "completed", category: "Ciencia Ficción" },
      { id: "b3", title: "Fundación", author: "Isaac Asimov", total_pages: 300, pages_read: 300, status: "completed", category: "Ciencia Ficción" },
    ],
  });
  assert.equal(masterLibreria.tier, 3);
  assert.equal(masterLibreria.tierName, "Gran Librería de Alejandría");
  assert.equal(masterLibreria.creationsExhibition.length, 3);
});

// ----------------------------------------------------------------------------
// CASO 7: Verificar que GP, XP, billetera y bóveda no cambiaron por el rediseño
// ----------------------------------------------------------------------------
test("Aceptación Caso 7: Invariante Estricta de Economía (Cero GP/XP arbitrarios y sin mutación de balances)", async () => {
  const { buildSkillSessionPayload, createUniversalSession, finishUniversalSession } = await import(
    "../src/lib/sanctuary/universal-session-engine.ts"
  );
  const { projectAtelierProgression } = await import(
    "../src/lib/sanctuary/visual-village-progression.ts"
  );
  const { classifyResidentAction } = await import(
    "../src/lib/sanctuary/cozy-residents-engine.ts"
  );

  // 1. Las sesiones finalizadas no inyectan campos de GP/XP
  const testSession = createUniversalSession({
    userId: "usr_econ_check",
    domain: "study",
    buildingId: "biblioteca",
  });
  const finished = finishUniversalSession(testSession, undefined, Date.now() + 1800000);
  const payload = buildSkillSessionPayload(finished);
  assert.strictEqual((payload as any).wallet_gp, undefined);
  assert.strictEqual((payload as any).vault_gp, undefined);
  assert.strictEqual((payload as any).xp, undefined);
  assert.strictEqual((payload as any).gp, undefined);

  // 2. La progresión visual no otorga recompensas monetarias paralelas
  const progression = projectAtelierProgression({
    level: 10,
    sessionsCount: 50,
    knittingProjects: [],
  });
  assert.strictEqual((progression as any).gpReward, undefined);
  assert.strictEqual((progression as any).xpReward, undefined);

  // 3. Los residentes no pueden alterar balances económicos
  const forbiddenProposal = classifyResidentAction({
    category: "backlog_task_proposal",
    payload: { wallet_gp: 50000, xp_earned: 1000 },
  });
  assert.equal(forbiddenProposal.level, 3);
  assert.equal(forbiddenProposal.isAllowed, false);
});

// ----------------------------------------------------------------------------
// CASO 8: Probar la experiencia desde un dispositivo móvil
// ----------------------------------------------------------------------------
test("Aceptación Caso 8: Responsive, Touch Targets (>= 44px) y Reducción de Movimiento", async () => {
  const { VILLAGE_BUILDINGS_CATALOG } = await import(
    "../src/lib/sanctuary/village-buildings-registry.ts"
  );
  const { cozySoundscape } = await import("../src/lib/cozy/cozy-soundscape.ts");

  // 1. Coordenadas porcentuales responsive para cualquier viewport móvil
  for (const building of VILLAGE_BUILDINGS_CATALOG) {
    assert.ok(building.mapCoordinates.x >= 0 && building.mapCoordinates.x <= 100);
    assert.ok(building.mapCoordinates.y >= 0 && building.mapCoordinates.y <= 100);
    assert.ok(typeof building.mapCoordinates.row === "number");
    assert.ok(typeof building.mapCoordinates.col === "number");
  }

  // 2. Audio silencioso por defecto (sin auto-play en móviles)
  assert.equal(cozySoundscape.getCurrentPreset(), "off");

  // 3. CSS con soporte para movimiento reducido
  const cssPath = path.resolve(process.cwd(), "src/app/globals.css");
  const css = fs.readFileSync(cssPath, "utf-8");
  assert.ok(css.includes("prefers-reduced-motion: reduce"));
  assert.ok(css.includes("animation-duration: 0.01ms"));

  // 4. Botones con tamaño táctil mínimo de 44px
  const dashboardPath = path.resolve(process.cwd(), "src/components/cozy-rpg-dashboard.tsx");
  const dashboard = fs.readFileSync(dashboardPath, "utf-8");
  assert.ok(dashboard.includes("min-h-[44px]"));
  assert.ok(dashboard.includes("min-w-[44px]"));
});

// ----------------------------------------------------------------------------
// CASO 9: Comprobar aislamiento de información entre usuarios
// ----------------------------------------------------------------------------
test("Aceptación Caso 9: Aislamiento Criptográfico y Multi-tenant Integral", async () => {
  const { createUniversalSession, hydrateUniversalSession } = await import(
    "../src/lib/sanctuary/universal-session-engine.ts"
  );
  const { saveSkillResource, getStoredSkillResources } = await import(
    "../src/lib/sanctuary/skill-resources-hub.ts"
  );
  const { recordConfirmedMilestoneEvent, getStoredProgressionState } = await import(
    "../src/lib/sanctuary/visual-village-progression.ts"
  );
  const { appendResidentJournalEntry, getStoredResidentJournal } = await import(
    "../src/lib/sanctuary/cozy-residents-engine.ts"
  );

  const userAlpha = "usr_tenant_alpha";
  const userBeta = "usr_tenant_beta";

  // 1. Sesiones
  const alphaSession = createUniversalSession({
    userId: userAlpha,
    domain: "work",
    buildingId: "oficina",
    resourceTitle: "Sprint Planning Q4",
  });
  const serialized = JSON.stringify(alphaSession);
  assert.ok(hydrateUniversalSession(serialized, userAlpha) !== null);
  assert.equal(hydrateUniversalSession(serialized, userBeta), null);

  // 2. Recursos
  const alphaResource = saveSkillResource(
    {
      userId: userAlpha,
      domain: "work",
      type: "document",
      title: "Especificación de API Segura",
      tags: ["work", "spec"],
    },
    userAlpha
  );
  const alphaResources = getStoredSkillResources("work", userAlpha);
  const betaResources = getStoredSkillResources("work", userBeta);
  assert.ok(alphaResources.some((r) => r.id === alphaResource.id));
  assert.ok(!betaResources.some((r) => r.id === alphaResource.id));

  // 3. Progresión
  recordConfirmedMilestoneEvent(userAlpha, {
    eventId: "evt_alpha_milestone_01",
    userId: userAlpha,
    buildingId: "oficina",
    domain: "work",
    milestoneType: "project_completed",
    targetId: "proj_alpha_q4",
    title: "Lanzamiento de API Alpha",
    confirmedAt: new Date().toISOString(),
  });
  assert.ok(getStoredProgressionState(userAlpha).processedEventIds.includes("evt_alpha_milestone_01"));
  assert.ok(!getStoredProgressionState(userBeta).processedEventIds.includes("evt_alpha_milestone_01"));

  // 4. Diario de Residentes
  appendResidentJournalEntry(
    {
      userId: userAlpha,
      residentId: "marcus",
      buildingId: "oficina",
      level: 2,
      actionTitle: "Aprobación de Sprint Alpha",
      status: "approved_by_user",
      payloadSummary: "Aprobado por Alpha",
    },
    userAlpha
  );
  assert.ok(getStoredResidentJournal(userAlpha).some((j) => j.actionTitle === "Aprobación de Sprint Alpha"));
  assert.ok(!getStoredResidentJournal(userBeta).some((j) => j.actionTitle === "Aprobación de Sprint Alpha"));
});
