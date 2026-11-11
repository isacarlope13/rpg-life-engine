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

test("Cozy Village 7: Catálogo de Edificios del Santuario, Identificadores Estables y Coordenadas", async () => {
  const {
    VILLAGE_BUILDINGS_CATALOG,
    getBuildingById,
    getBuildingByDomain,
    filterBuildingsByDistrict,
  } = await import("../src/lib/sanctuary/village-buildings-registry.ts");

  // Todos los edificios propuestos y existentes deben estar registrados
  const requiredBuildingIds = [
    "oficina",
    "libreria",
    "biblioteca",
    "club_puzzles",
    "observatorio",
    "atelier",
    "pabellon_gardening",
    "pabellon_hiking",
    "cocina",
  ];

  for (const id of requiredBuildingIds) {
    const building = getBuildingById(id);
    assert.ok(building, `El edificio con ID estable '${id}' debe estar registrado en el catálogo.`);
    assert.ok(building.name.length > 0, `El edificio '${id}' debe tener un nombre definido.`);
    assert.ok(building.mapCoordinates.x >= 0 && building.mapCoordinates.x <= 100, `Coordenada X de '${id}' debe estar entre 0 y 100%`);
    assert.ok(building.mapCoordinates.y >= 0 && building.mapCoordinates.y <= 100, `Coordenada Y de '${id}' debe estar entre 0 y 100%`);
  }

  // Comprobar búsqueda por dominio
  assert.equal(getBuildingByDomain("work")?.id, "oficina");
  assert.equal(getBuildingByDomain("reading")?.id, "libreria");
  assert.equal(getBuildingByDomain("study")?.id, "biblioteca");
  assert.equal(getBuildingByDomain("knitting")?.id, "atelier");
  assert.equal(getBuildingByDomain("rubik")?.id, "club_puzzles");
  assert.equal(getBuildingByDomain("general")?.id, "observatorio");

  // Comprobar filtros por distrito
  assert.ok(filterBuildingsByDistrict("saber").length >= 3, "El distrito del saber debe tener al menos 3 edificios");
  assert.ok(filterBuildingsByDistrict("artes").length >= 2, "El distrito de artes debe tener al menos 2 edificios");
  assert.ok(filterBuildingsByDistrict("naturaleza").length >= 2, "El distrito de naturaleza debe tener al menos 2 edificios");
  assert.ok(filterBuildingsByDistrict("all").length === VILLAGE_BUILDINGS_CATALOG.length);
});

test("Cozy Village 8: Detección de Actividad Pendiente Determinista", async () => {
  const { getBuildingById } = await import("../src/lib/sanctuary/village-buildings-registry.ts");

  const libreria = getBuildingById("libreria")!;
  const atelier = getBuildingById("atelier")!;

  // Con 2 libros activos, debe reportar actividad pendiente
  const libreriaPending = libreria.getPendingActivity({ activeBooksCount: 2 });
  assert.equal(libreriaPending.hasPending, true);
  assert.equal(libreriaPending.count, 2);

  // Con 0 libros, no debe reportar actividad pendiente
  const libreriaIdle = libreria.getPendingActivity({ activeBooksCount: 0 });
  assert.equal(libreriaIdle.hasPending, false);

  // Atelier con proyectos en telar
  const atelierPending = atelier.getPendingActivity({ activeKnittingProjectsCount: 1 });
  assert.equal(atelierPending.hasPending, true);
  assert.equal(atelierPending.count, 1);
});

test("Cozy Interiors 9: Integridad de Catálogo y Registro de Edificios Especializados", async () => {
  const { VILLAGE_BUILDINGS_CATALOG, getBuildingById, getBuildingByDomain } = await import(
    "../src/lib/sanctuary/village-buildings-registry.ts"
  );

  // Cada edificio debe contar con identificador, distrito, coordenadas y detector de actividad
  for (const building of VILLAGE_BUILDINGS_CATALOG) {
    assert.ok(building.id, "Todo edificio debe tener ID");
    assert.ok(building.domain, "Todo edificio debe tener dominio de habilidad");
    assert.ok(building.tagline, "Todo edificio debe tener tagline");
    assert.ok(typeof building.getPendingActivity === "function", "Debe tener detector getPendingActivity");
  }

  // Comprobar edificios núcleo requeridos en Fase 6
  assert.equal(getBuildingByDomain("reading")?.id, "libreria");
  assert.equal(getBuildingByDomain("study")?.id, "biblioteca");
  assert.equal(getBuildingByDomain("knitting")?.id, "atelier");
  assert.equal(getBuildingByDomain("work")?.id, "oficina");
  assert.equal(getBuildingByDomain("general")?.id, "observatorio");
  assert.equal(getBuildingByDomain("rubik")?.id, "club_puzzles");
});

test("Cozy Interiors 10: Detección Funcional de Actividad para Centro de Acción", async () => {
  const { getBuildingById } = await import(
    "../src/lib/sanctuary/village-buildings-registry.ts"
  );

  const oficina = getBuildingById("oficina")!;
  const biblioteca = getBuildingById("biblioteca")!;

  // Oficina sin sesión hoy reporta sprint disponible
  const oficinaPending = oficina.getPendingActivity({ buildingSessions: [] });
  assert.equal(oficinaPending.hasPending, true);

  // Biblioteca con tarjetas vencidas reporta repaso
  const bibliotecaDue = biblioteca.getPendingActivity({ spacedCardsDueCount: 5 });
  assert.equal(bibliotecaDue.hasPending, true);
  assert.equal(bibliotecaDue.count, 5);
});

test("Universal Session Engine 11: Ciclo de Vida Completo (Preparar, Iniciar, Pausar, Reanudar, Finalizar)", async () => {
  const {
    createUniversalSession,
    startUniversalSession,
    pauseUniversalSession,
    resumeUniversalSession,
    finishUniversalSession,
    calculateNetDurationSeconds,
  } = await import("../src/lib/sanctuary/universal-session-engine.ts");

  const baseTime = 1700000000000; // Marca temporal de prueba fija

  // 1. Preparar
  const prep = createUniversalSession({
    userId: "usr_alex",
    domain: "reading",
    buildingId: "libreria",
    resourceId: "bk_atomic",
    resourceTitle: "Hábitos Atómicos",
    objective: "Leer capítulo 3",
    autoStart: false,
  });
  assert.equal(prep.status, "preparing");
  assert.equal(calculateNetDurationSeconds(prep, baseTime), 0);

  // 2. Iniciar
  const running = startUniversalSession(prep, baseTime);
  assert.equal(running.status, "running");
  assert.equal(running.isPaused, false);

  // Avanzan 600 segundos (10 minutos)
  const tenMinsLater = baseTime + 600 * 1000;
  assert.equal(calculateNetDurationSeconds(running, tenMinsLater), 600);

  // 3. Pausar a los 10 minutos
  const paused = pauseUniversalSession(running, tenMinsLater);
  assert.equal(paused.status, "paused");
  assert.equal(paused.isPaused, true);
  assert.ok(paused.activePauseStartedAt);

  // Avanzan 180 segundos en pausa (3 minutos)
  const thirteenMinsLater = tenMinsLater + 180 * 1000;
  // La duración neta debe mantenerse en 600 segundos
  assert.equal(calculateNetDurationSeconds(paused, thirteenMinsLater), 600);

  // 4. Reanudar
  const resumed = resumeUniversalSession(paused, thirteenMinsLater);
  assert.equal(resumed.status, "running");
  assert.equal(resumed.isPaused, false);
  assert.equal(resumed.pauses.length, 1);
  assert.equal(resumed.pauses[0].duration_seconds, 180);

  // Avanzan 300 segundos adicionales de trabajo activo (5 minutos)
  const eighteenMinsLater = thirteenMinsLater + 300 * 1000;
  assert.equal(calculateNetDurationSeconds(resumed, eighteenMinsLater), 900); // 600s + 300s = 900s (15 min)

  // 5. Finalizar
  const completed = finishUniversalSession(
    resumed,
    {
      notes: "Capítulo 3 terminado con éxito",
      specializedData: {
        reading: {
          book_id: "bk_atomic",
          pages_read: 22,
        },
      },
    },
    eighteenMinsLater
  );
  assert.equal(completed.status, "completed");
  assert.equal(completed.elapsedSeconds, 900);
  assert.equal(completed.notes, "Capítulo 3 terminado con éxito");
});

test("Universal Session Engine 12: Cálculo de Duración Basado en Marcas de Tiempo Reales y Pausas Múltiples", async () => {
  const {
    createUniversalSession,
    pauseUniversalSession,
    resumeUniversalSession,
    calculateNetDurationSeconds,
    formatDuration,
  } = await import("../src/lib/sanctuary/universal-session-engine.ts");

  const t0 = 1700000000000;
  let session = createUniversalSession({
    userId: "usr_hero",
    domain: "study",
    autoStart: true,
  });
  session = { ...session, startedAt: new Date(t0).toISOString() };

  // Pausa 1: minuto 10 al 12 (120s)
  const t1 = t0 + 600 * 1000;
  session = pauseUniversalSession(session, t1);
  const t2 = t1 + 120 * 1000;
  session = resumeUniversalSession(session, t2);

  // Pausa 2: minuto 20 al 25 (300s)
  const t3 = t2 + 480 * 1000;
  session = pauseUniversalSession(session, t3);
  const t4 = t3 + 300 * 1000;
  session = resumeUniversalSession(session, t4);

  // Evaluación a los 35 minutos totales desde t0
  const t5 = t0 + 2100 * 1000;
  // Tiempo bruto: 2100s. Pausas: 120s + 300s = 420s. Tiempo neto: 1680s (28 minutos)
  const netSecs = calculateNetDurationSeconds(session, t5);
  assert.equal(netSecs, 1680);
  assert.equal(formatDuration(netSecs), "28:00");
});

test("Universal Session Engine 13: Hidratación Confiable y Recuperación tras Recarga Simulada", async () => {
  const {
    createUniversalSession,
    hydrateUniversalSession,
    calculateNetDurationSeconds,
  } = await import("../src/lib/sanctuary/universal-session-engine.ts");

  const startTimestamp = 1700000000000;
  const original = createUniversalSession({
    userId: "usr_pilot",
    domain: "work",
    projectName: "Sprint Oakhaven",
    autoStart: true,
  });
  const customOriginal = {
    ...original,
    startedAt: new Date(startTimestamp).toISOString(),
  };

  // Simular guardado en JSON (localStorage)
  const serialized = JSON.stringify(customOriginal);

  // Simular recarga de página 25 minutos después
  const reloadTimestamp = startTimestamp + 1500 * 1000;
  const hydrated = hydrateUniversalSession(serialized, "usr_pilot", reloadTimestamp);

  assert.ok(hydrated, "La sesión debe hidratarse exitosamente");
  assert.equal(hydrated.sessionId, original.sessionId);
  assert.equal(hydrated.domain, "work");
  assert.equal(hydrated.status, "running");
  assert.equal(hydrated.elapsedSeconds, 1500);
});

test("Universal Session Engine 14: Aislamiento Estricto Multi-Usuario y Prevención de Colisiones", async () => {
  const {
    createUniversalSession,
    hydrateUniversalSession,
  } = await import("../src/lib/sanctuary/universal-session-engine.ts");

  const userASession = createUniversalSession({
    userId: "usr_alice",
    domain: "knitting",
    autoStart: true,
  });

  const serialized = JSON.stringify(userASession);

  // Usuario B no puede acceder ni hidratar la sesión del usuario A
  const hydrationAttemptUserB = hydrateUniversalSession(serialized, "usr_bob");
  assert.equal(
    hydrationAttemptUserB,
    null,
    "El usuario B no debe tener acceso a la sesión del usuario A (aislamiento RLS/multi-tenant)"
  );

  // Usuario A sí puede hidratar su propia sesión
  const hydrationAttemptUserA = hydrateUniversalSession(serialized, "usr_alice");
  assert.ok(hydrationAttemptUserA, "El usuario A debe hidratar su sesión");
});

test("Universal Session Engine 15: Mapeo de Datos Especializados y Compatibilidad con Reading Hub", async () => {
  const {
    createUniversalSession,
    finishUniversalSession,
    buildSkillSessionPayload,
  } = await import("../src/lib/sanctuary/universal-session-engine.ts");

  // Sesión de Lectura (Reading Hub)
  const readingSession = createUniversalSession({
    userId: "usr_reader",
    domain: "reading",
    buildingId: "libreria",
    resourceId: "bk_deep_work",
    resourceTitle: "Deep Work - Cal Newport",
    specializedData: {
      reading: {
        book_id: "bk_deep_work",
        pages_read: 35,
        quote_text: "La habilidad de concentrarse profundamente es cada vez más rara.",
        quote_page: 14,
        quotes_list: [
          { text: "La habilidad de concentrarse profundamente es cada vez más rara.", page: 14 },
        ],
      },
    },
  });

  // Finalizar con 1800 segundos (30 min)
  const completedReading = {
    ...readingSession,
    status: "completed" as const,
    elapsedSeconds: 1800,
  };

  const readingPayload = buildSkillSessionPayload(completedReading);
  assert.equal(readingPayload.domain, "reading");
  assert.equal(readingPayload.duration_minutes, 30);
  assert.equal(readingPayload.book_id, "bk_deep_work");
  assert.equal(readingPayload.pages_read, 35);
  assert.equal(readingPayload.quote_page, 14);
  assert.ok(readingPayload.idempotency_key);

  // Sesión de Rubik (Club de Puzzles)
  const rubikSession = createUniversalSession({
    userId: "usr_cuber",
    domain: "rubik",
    buildingId: "club_puzzles",
    specializedData: {
      rubik: {
        cube_model: "GAN 12 MagLev",
        solve_time_seconds: 14.82,
        penalty: "none",
        algorithm_learned: "PLL T-Perm",
      },
    },
  });
  const completedRubik = { ...rubikSession, status: "completed" as const, elapsedSeconds: 900 };
  const rubikPayload = buildSkillSessionPayload(completedRubik);
  assert.equal(rubikPayload.domain, "rubik");
  assert.equal(rubikPayload.cube_model, "GAN 12 MagLev");
  assert.equal(rubikPayload.solve_time_seconds, 14.82);
  assert.equal(rubikPayload.algorithm_learned, "PLL T-Perm");
});

test("Universal Session Engine 16: Idempotencia Criptográfica y Ausencia de Generación Arbitraria de XP/GP", async () => {
  const {
    createUniversalSession,
    finishUniversalSession,
    buildSkillSessionPayload,
  } = await import("../src/lib/sanctuary/universal-session-engine.ts");

  const session = createUniversalSession({
    userId: "usr_tester",
    domain: "knitting",
    autoStart: true,
  });

  // 1. La clave de idempotencia se acuña al nacer la sesión y permanece invariable
  const initialKey = session.idempotencyKey;
  assert.match(initialKey, /^ses_univ_usr_tester_ses_\d+_[a-z0-9]+$/);

  const finished1 = finishUniversalSession(session, undefined, Date.now());
  const payload1 = buildSkillSessionPayload(finished1);

  // En reintentos sucesivos, la clave de idempotencia debe ser idéntica para prevenir doble recompensa
  assert.equal(payload1.idempotency_key, initialKey);

  // 2. Comprobar que el motor de sesión NO genera ni inyecta campos de GP o XP ficticios
  assert.equal(payload1.gp, undefined, "El motor frontend NO debe emitir recompensas de GP directas");
  assert.equal(payload1.xp, undefined, "El motor frontend NO debe emitir recompensas de XP directas");
  assert.equal(payload1.level, undefined, "El motor frontend NO debe modificar niveles arbitrariamente");
});

test("Smart Capture 17: Validación Estricta de Seguridad de Archivos Adjuntos (< 5MB y MIME)", async () => {
  const { validateSkillResourceAttachment, MAX_FILE_SIZE_BYTES } = await import(
    "../src/lib/sanctuary/skill-resources-hub.ts"
  );

  // 1. Archivo válido dentro del límite (< 5 MB) y tipo permitido (PDF / PNG)
  const validPdf = validateSkillResourceAttachment({
    name: "patron-bufanda-cozy.pdf",
    size: 1.5 * 1024 * 1024, // 1.5 MB
    type: "application/pdf",
  });
  assert.equal(validPdf.valid, true);
  assert.equal(validPdf.sanitizedName, "patron-bufanda-cozy.pdf");

  const validImage = validateSkillResourceAttachment({
    name: "avance_telar_24.png",
    size: 2.1 * 1024 * 1024, // 2.1 MB
    type: "image/png",
  });
  assert.equal(validImage.valid, true);

  // 2. Archivo que supera el límite de 5 MB
  const oversizedFile = validateSkillResourceAttachment({
    name: "video_pesado_tutorial.mp4",
    size: 6.2 * 1024 * 1024, // 6.2 MB
    type: "video/mp4",
  });
  assert.equal(oversizedFile.valid, false);
  assert.match(oversizedFile.error!, /excede el tamaño máximo de 5 MB/);

  // 3. Extensión no admitida / peligrosa (.exe / .bat)
  const maliciousFile = validateSkillResourceAttachment({
    name: "script_peligroso.exe",
    size: 100 * 1024,
    type: "application/x-msdownload",
  });
  assert.equal(maliciousFile.valid, false);
  assert.match(maliciousFile.error!, /Formato de archivo no permitido/);

  // 4. Sanitización de nombres con caracteres extraños
  const weirdName = validateSkillResourceAttachment({
    name: "mi patrón #1 ($copia!).pdf",
    size: 500 * 1024,
    type: "application/pdf",
  });
  assert.equal(weirdName.valid, true);
  assert.equal(weirdName.sanitizedName, "mi_patr_n__1___copia__.pdf");
});

test("Smart Capture 18: Generación Determinista de Valores Sugeridos por Habilidad", async () => {
  const { getSuggestedSkillValues } = await import(
    "../src/lib/sanctuary/skill-resources-hub.ts"
  );

  // Caso 1: Atelier (Knitting)
  const knittingVals = getSuggestedSkillValues({
    domain: "knitting",
    activeKnittingProject: {
      id: "proj_bufanda",
      name: "Bufanda Nube",
      current_rows: 24,
      total_rows_target: 60,
      yarn_name: "Lana Merino",
    },
  });
  assert.equal(knittingVals.primaryTitle, "Bufanda Nube");
  assert.equal(knittingVals.suggestedActionLabel, "Tejer Ronda 25");
  assert.equal(knittingVals.progressPercentage, 40); // 24 / 60 = 40%
  assert.ok(knittingVals.quickSnippets.length >= 3);

  // Caso 2: Librería (Reading)
  const readingVals = getSuggestedSkillValues({
    domain: "reading",
    activeBook: {
      id: "bk_habits",
      title: "Atomic Habits",
      pages_read: 50,
      total_pages: 200,
    },
  });
  assert.equal(readingVals.primaryTitle, "Atomic Habits");
  assert.equal(readingVals.suggestedQuantity, 15); // Ritmo sugerido de 15 páginas
  assert.equal(readingVals.suggestedActionLabel, "Leer 15 páginas (pág. 50 a 65)");
  assert.equal(readingVals.progressPercentage, 25); // 50 / 200 = 25%

  // Caso 3: Biblioteca (Study)
  const studyVals = getSuggestedSkillValues({
    domain: "study",
    activeStudy: {
      subject: "Cálculo Integral",
      topic: "Integración por Partes",
      spacedCardsDueCount: 8,
    },
  });
  assert.equal(studyVals.suggestedActionLabel, "Repasar 8 Flashcards SM-2");
  assert.equal(studyVals.suggestedQuantity, 8);
  assert.equal(studyVals.unitLabel, "tarjetas");

  // Caso 4: Oficina (Work)
  const workVals = getSuggestedSkillValues({
    domain: "work",
    activeWorkProject: {
      id: "proj_cozy",
      name: "Cozy Village",
      currentStage: "Desarrollo",
      nextPendingTask: "Bóveda de Recursos",
    },
  });
  assert.equal(workVals.primaryTitle, "Cozy Village");
  assert.equal(workVals.suggestedActionLabel, "Sprint en tarea: Bóveda de Recursos");
});

test("Smart Capture 19: Extracción Inteligente y Confirmación Humana Previa (HITL)", async () => {
  const { parseSmartCaptureSnippet } = await import(
    "../src/lib/sanctuary/skill-resources-hub.ts"
  );

  // 1. Extracción de lectura
  const readingSnippet = parseSmartCaptureSnippet("Hoy leí 25 páginas del capítulo de hábitos", "reading");
  assert.equal(readingSnippet.candidateNumber, 25);
  assert.equal(readingSnippet.candidateUnit, "páginas");
  assert.equal(readingSnippet.requiresConfirmation, true, "HITL: siempre requiere confirmación del usuario");

  // 2. Extracción de tejido
  const knittingSnippet = parseSmartCaptureSnippet("Completé la vuelta 18 sin errores", "knitting");
  assert.equal(knittingSnippet.candidateNumber, 18);
  assert.equal(knittingSnippet.candidateUnit, "rondas");
  assert.equal(knittingSnippet.requiresConfirmation, true);

  // 3. Extracción de cita entre comillas
  const quoteSnippet = parseSmartCaptureSnippet('El libro dice: "La paciencia es el arte de la esperanza"', "reading");
  assert.equal(quoteSnippet.candidateNotes, "La paciencia es el arte de la esperanza");
  assert.ok(quoteSnippet.candidateTags.includes("cita_destacada"));

  // 4. Extracción de solve de Rubik
  const rubikSnippet = parseSmartCaptureSnippet("Nuevo PB de 13.82s en 3x3", "rubik");
  assert.equal(rubikSnippet.candidateNumber, 13.82);
  assert.equal(rubikSnippet.candidateUnit, "segundos");
});

test("Smart Capture 20: Aislamiento de Usuario y Persistencia Local de Recursos", async () => {
  // Mock global localStorage para Node.js test runner
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

  const {
    saveSkillResource,
    getStoredSkillResources,
    deleteSkillResource,
  } = await import("../src/lib/sanctuary/skill-resources-hub.ts");

  // Usuario A guarda un patrón
  const userAResource = saveSkillResource(
    {
      domain: "knitting",
      userId: "usr_alice",
      type: "pattern",
      title: "Patrón Bufanda Calada",
      tags: ["knitting", "pattern"],
    },
    "usr_alice"
  );

  assert.ok(userAResource.id);
  assert.equal(userAResource.title, "Patrón Bufanda Calada");

  // Usuario B no ve los recursos de Usuario A (aislamiento RLS / multi-tenant)
  const userBResources = getStoredSkillResources("knitting", "usr_bob");
  assert.equal(userBResources.length, 0);

  // Usuario A sí ve su recurso
  const userAResources = getStoredSkillResources("knitting", "usr_alice");
  assert.equal(userAResources.length, 1);
  assert.equal(userAResources[0].id, userAResource.id);

  // Usuario B no puede borrar el recurso de Usuario A
  const deleteByB = deleteSkillResource(userAResource.id, "usr_bob");
  const checkStillThere = getStoredSkillResources("knitting", "usr_alice");
  assert.equal(checkStillThere.length, 1, "El recurso de Alice no debió ser borrado por Bob");

  // Usuario A sí puede borrar su recurso
  const deleteByA = deleteSkillResource(userAResource.id, "usr_alice");
  assert.equal(deleteByA, true);
  assert.equal(getStoredSkillResources("knitting", "usr_alice").length, 0);
});

test("Visual Progression 21: Un hito real desbloquea un estado visual determinista (Tier 1 -> Tier 2 -> Tier 3)", async () => {
  const {
    projectAtelierProgression,
    projectLibreriaProgression,
    projectBibliotecaProgression,
    projectOficinaProgression,
    projectRubikProgression,
  } = await import("../src/lib/sanctuary/visual-village-progression.ts");

  // 1. Piloto: Atelier en estado inicial (Tier 1)
  const atelierInitial = projectAtelierProgression({
    level: 1,
    sessionsCount: 0,
    knittingProjects: [
      {
        id: "p1",
        name: "Bufanda Cálida",
        technique: "Crochet",
        total_rows_target: 60,
        completed_rows: 5,
        yarn_details: "Lana Merino",
        status: "in_progress",
      },
    ],
  });
  assert.equal(atelierInitial.tier, 1);
  assert.equal(atelierInitial.tierName, "Cabaña de Bastidor Rústico");
  assert.equal(atelierInitial.creationsExhibition.length, 0, "No hay prendas terminadas aún");

  // 2. Piloto: Atelier con 1 proyecto terminado (Tier 2)
  const atelierTier2 = projectAtelierProgression({
    level: 2,
    sessionsCount: 3,
    knittingProjects: [
      {
        id: "p1",
        name: "Bufanda Cálida",
        technique: "Crochet",
        total_rows_target: 60,
        completed_rows: 60,
        yarn_details: "Lana Merino",
        status: "completed",
      },
    ],
  });
  assert.equal(atelierTier2.tier, 2);
  assert.equal(atelierTier2.tierName, "Taller de Costura Establecido");
  assert.equal(atelierTier2.creationsExhibition.length, 1);
  assert.equal(atelierTier2.creationsExhibition[0].title, "Bufanda Cálida");
  assert.ok(atelierTier2.exteriorDecorations.find((d) => d.id === "at_ext_awning")?.unlocked);

  // 3. Piloto: Atelier con 2 proyectos y 85 filas (Tier 3: Maestro Textil)
  const atelierTier3 = projectAtelierProgression({
    level: 4,
    sessionsCount: 8,
    knittingProjects: [
      {
        id: "p1",
        name: "Bufanda Cálida",
        technique: "Crochet",
        total_rows_target: 60,
        completed_rows: 60,
        yarn_details: "Lana Merino",
        status: "completed",
      },
      {
        id: "p2",
        name: "Gorro de Invierno",
        technique: "Dos Agujas",
        total_rows_target: 25,
        completed_rows: 25,
        yarn_details: "Alpaca",
        status: "completed",
      },
    ],
  });
  assert.equal(atelierTier3.tier, 3);
  assert.equal(atelierTier3.tierName, "Atelier Maestro Textil");
  assert.equal(atelierTier3.creationsExhibition.length, 2);
  assert.ok(atelierTier3.trophies.find((t) => t.id === "at_trophy_tapestry")?.unlocked);
  assert.ok(atelierTier3.exteriorDecorations.find((d) => d.id === "at_ext_garden")?.unlocked);

  // 4. Librería: libro terminado desbloquea colección y Tier 2
  const libTier2 = projectLibreriaProgression({
    level: 2,
    sessionsCount: 4,
    readingBooks: [
      {
        id: "b1",
        title: "El Principito",
        author: "Antoine de Saint-Exupéry",
        total_pages: 96,
        pages_read: 96,
        status: "completed",
        category: "Clásicos",
      },
    ],
  });
  assert.equal(libTier2.tier, 2);
  assert.equal(libTier2.creationsExhibition.length, 1);
  assert.ok(libTier2.trophies.find((t) => t.id === "lib_trophy_seal")?.unlocked);

  // 5. Rubik: PB registrado desbloquea cronómetro y Tier 2
  const rubikTier2 = projectRubikProgression({
    level: 2,
    sessionsCount: 6,
    rubikSinglePb: 18.42,
    rubikSolvesCount: 15,
  });
  assert.equal(rubikTier2.tier, 2);
  assert.ok(rubikTier2.interiorFurniture.find((f) => f.id === "pz_furn_display")?.unlocked);
  assert.ok(rubikTier2.trophies.find((t) => t.id === "pz_trophy_cup")?.unlocked);
});

test("Visual Progression 22: Reprocesamiento seguro e idempotencia de eventos de hito", async () => {
  const { recordConfirmedMilestoneEvent, getStoredProgressionState } = await import(
    "../src/lib/sanctuary/visual-village-progression.ts"
  );

  const eventPayload = {
    eventId: "evt_milestone_knitting_finish_p1",
    userId: "usr_alice",
    buildingId: "atelier",
    domain: "knitting" as const,
    milestoneType: "project_completed" as const,
    targetId: "p1",
    title: "Bufanda Terminada",
    confirmedAt: new Date().toISOString(),
  };

  // Primera invocación: debe registrar el evento
  const firstResult = recordConfirmedMilestoneEvent("usr_alice", eventPayload);
  assert.equal(firstResult.wasAlreadyProcessed, false);
  assert.ok(firstResult.state.processedEventIds.includes("evt_milestone_knitting_finish_p1"));

  // Segunda invocación (duplicada): no debe duplicar el evento
  const secondResult = recordConfirmedMilestoneEvent("usr_alice", eventPayload);
  assert.equal(secondResult.wasAlreadyProcessed, true, "Evento repetido debe marcar wasAlreadyProcessed=true");

  const stored = getStoredProgressionState("usr_alice");
  const occurrences = stored.processedEventIds.filter((id) => id === "evt_milestone_knitting_finish_p1").length;
  assert.equal(occurrences, 1, "No debe duplicarse la entrada en el estado persistido");
});

test("Visual Progression 23: Invariante estricta — Cero degradación por inactividad", async () => {
  const { projectAtelierProgression } = await import(
    "../src/lib/sanctuary/visual-village-progression.ts"
  );

  // Usuario con Tier 3 alcanzado
  const activeProgression = projectAtelierProgression({
    level: 5,
    sessionsCount: 15,
    knittingProjects: [
      {
        id: "p1",
        name: "Manta Nórdica",
        technique: "Crochet",
        total_rows_target: 100,
        completed_rows: 100,
        yarn_details: "Merino",
        status: "completed",
      },
      {
        id: "p2",
        name: "Chaqueta Artesanal",
        technique: "Dos Agujas",
        total_rows_target: 80,
        completed_rows: 80,
        yarn_details: "Lana",
        status: "completed",
      },
    ],
  });
  assert.equal(activeProgression.tier, 3);
  assert.equal(activeProgression.unlockedItemsCount >= 5, true);

  // Simulación: Han pasado 180 días sin sesiones recientes
  // La progresión se vuelve a proyectar: NO DEBE DEGRADARSE
  const simulatedAfterMonths = projectAtelierProgression({
    level: 5,
    sessionsCount: 15, // Las sesiones históricas confirmadas se conservan
    knittingProjects: [
      {
        id: "p1",
        name: "Manta Nórdica",
        technique: "Crochet",
        total_rows_target: 100,
        completed_rows: 100,
        yarn_details: "Merino",
        status: "completed",
      },
      {
        id: "p2",
        name: "Chaqueta Artesanal",
        technique: "Dos Agujas",
        total_rows_target: 80,
        completed_rows: 80,
        yarn_details: "Lana",
        status: "completed",
      },
    ],
  });

  assert.equal(simulatedAfterMonths.tier, 3, "El edificio no debe degradarse a Tier 2 ni Tier 1");
  assert.equal(simulatedAfterMonths.tierName, "Atelier Maestro Textil");
  assert.equal(simulatedAfterMonths.creationsExhibition.length, 2, "Las prendas expuestas nunca desaparecen");
});

test("Visual Progression 24: Aislamiento multi-usuario estricto", async () => {
  const { projectVillageProgression, recordConfirmedMilestoneEvent, getStoredProgressionState } = await import(
    "../src/lib/sanctuary/visual-village-progression.ts"
  );

  // Alice registra un hito en su pueblo
  recordConfirmedMilestoneEvent("usr_alice_villager", {
    eventId: "evt_alice_book_1",
    userId: "usr_alice_villager",
    buildingId: "libreria",
    domain: "reading",
    milestoneType: "book_finished",
    title: "Libro Terminado de Alice",
    confirmedAt: new Date().toISOString(),
  });

  // Bob no tiene hitos registrados
  const bobState = getStoredProgressionState("usr_bob_villager");
  assert.equal(bobState.processedEventIds.length, 0, "Bob no debe tener eventos de Alice");

  // Proyecciones de aldea independientes
  const aliceVillage = projectVillageProgression({
    userId: "usr_alice_villager",
    readingBooks: [
      {
        id: "b1",
        title: "Clean Code",
        author: "Robert C. Martin",
        total_pages: 450,
        pages_read: 450,
        status: "completed",
        category: "Software",
      },
    ],
  });

  const bobVillage = projectVillageProgression({
    userId: "usr_bob_villager",
    readingBooks: [],
  });

  assert.equal(aliceVillage.buildings.libreria.tier, 2, "La librería de Alice debe ser Tier 2");
  assert.equal(bobVillage.buildings.libreria.tier, 1, "La librería de Bob debe ser Tier 1 (Cabaña)");
  assert.equal(aliceVillage.buildings.libreria.creationsExhibition.length, 1);
  assert.equal(bobVillage.buildings.libreria.creationsExhibition.length, 0);
});

test("Visual Progression 25: Invariante económica — Cero GP y Cero XP emitidos en la proyección visual", async () => {
  const { projectVillageProgression } = await import(
    "../src/lib/sanctuary/visual-village-progression.ts"
  );

  // Aldea altamente avanzada con múltiples hitos confirmados
  const advancedVillage = projectVillageProgression({
    userId: "usr_veteran",
    skillSummaries: [
      { domain: "knitting", label: "Tejido", total_xp: 1000, total_minutes: 500, level: 5, sessions_count: 20, total_gp_earned: 5000 },
      { domain: "reading", label: "Lectura", total_xp: 1200, total_minutes: 600, level: 5, sessions_count: 25, total_gp_earned: 6200 },
      { domain: "study", label: "Estudio", total_xp: 900, total_minutes: 450, level: 5, sessions_count: 18, total_gp_earned: 4500 },
      { domain: "work", label: "Trabajo", total_xp: 1500, total_minutes: 800, level: 5, sessions_count: 30, total_gp_earned: 9000 },
      { domain: "rubik", label: "Rubik", total_xp: 2000, total_minutes: 1000, level: 5, sessions_count: 50, total_gp_earned: 15000 },
    ],
    knittingProjects: [
      { id: "k1", name: "P1", technique: "Crochet", total_rows_target: 60, completed_rows: 60, yarn_details: "Y1", status: "completed" },
      { id: "k2", name: "P2", technique: "Dos Agujas", total_rows_target: 80, completed_rows: 80, yarn_details: "Y2", status: "completed" },
    ],
    readingBooks: [
      { id: "r1", title: "B1", author: "A1", total_pages: 300, pages_read: 300, status: "completed", category: "C1" },
      { id: "r2", title: "B2", author: "A2", total_pages: 200, pages_read: 200, status: "completed", category: "C2" },
    ],
    workProjectsCompletedCount: 3,
    workDeliverablesCount: 8,
    studyReviewsCount: 35,
    rubikSinglePb: 14.25,
    rubikSolvesCount: 120,
    deepWorkMinutes: 300,
  });

  // Verificación estricta de invariantes económicas
  assert.equal(advancedVillage.gpEmitted, 0, "Invariante: la proyección visual emite estrictamente 0 GP");
  assert.equal(advancedVillage.xpEmitted, 0, "Invariante: la proyección visual emite estrictamente 0 XP");
  assert.ok(advancedVillage.totalMilestonesUnlocked > 15, "Deben haberse proyectado múltiples hitos");
  assert.equal(advancedVillage.overallVillageTier, 3, "El pueblo entero debe alcanzar Tier 3");
});

test("Resident Assistant 26: Asistente Piloto (Clara en Atelier) recuerda proyecto, vuelta y prepara sesión determinista (Nivel 1 Automático)", async () => {
  const { generateResidentAdvice } = await import(
    "../src/lib/sanctuary/cozy-residents-engine.ts"
  );

  const context = {
    residentId: "clara",
    buildingId: "atelier",
    domain: "knitting" as const,
    knittingProjects: [
      {
        id: "proj_bufanda",
        name: "Bufanda Nórdica",
        technique: "Crochet" as const,
        total_rows_target: 60,
        completed_rows: 40,
        yarn_details: "Lana Merino 100g",
        status: "in_progress" as const,
      },
    ],
  };

  const advice = generateResidentAdvice(context);

  // 1. Identidad del residente no controlable
  assert.equal(advice.residentId, "clara");
  assert.equal(advice.residentName, "Clara");
  assert.equal(advice.avatar, "🐇");

  // 2. Resumen contextual con memoria de proyecto y vuelta
  assert.ok(advice.contextSummary.includes("Bufanda Nórdica"));
  assert.ok(advice.contextSummary.includes("40 de 60"));

  // 3. Preparación automática de sesión (Nivel 1)
  assert.ok(advice.preparedSession);
  assert.equal(advice.preparedSession.resourceTitle, "Bufanda Nórdica");
  assert.equal(advice.preparedSession.resourceId, "proj_bufanda");
  assert.equal(advice.preparedSession.recommendedMinutes, 20);
  assert.ok(advice.preparedSession.objective.includes("5 vueltas"));
});

test("Resident Assistant 27: Propuesta Nivel 2 (HITL) requiere confirmación humana explícita antes de aplicar", async () => {
  const {
    generateResidentAdvice,
    resolveResidentProposal,
    classifyResidentAction,
    getStoredResidentJournal,
  } = await import("../src/lib/sanctuary/cozy-residents-engine.ts");

  // Proyecto a punto de terminar (58 de 60 vueltas -> resta 2 vueltas)
  const context = {
    userId: "usr_clara_test",
    residentId: "clara",
    buildingId: "atelier",
    domain: "knitting" as const,
    knittingProjects: [
      {
        id: "proj_finishing",
        name: "Gorro Invernal",
        technique: "Dos Agujas" as const,
        total_rows_target: 60,
        completed_rows: 58,
        yarn_details: "Alpaca",
        status: "in_progress" as const,
      },
    ],
  };

  const advice = generateResidentAdvice(context);

  // Debe haber generado una propuesta Nivel 2 (HITL)
  assert.equal(advice.pendingProposals.length, 1);
  const proposal = advice.pendingProposals[0];
  assert.equal(proposal.level, 2, "La propuesta debe ser estrictamente Nivel 2 (HITL)");
  assert.equal(proposal.status, "pending_approval");
  assert.ok(proposal.title.includes("Remate Final"));

  // Clasificación de seguridad previa
  const classification = classifyResidentAction({
    category: proposal.category,
    payload: proposal.suggestedPayload,
  });
  assert.equal(classification.level, 2);
  assert.equal(classification.isAllowed, true);

  // 1. Decisión de rechazo del usuario
  const rejectResult = resolveResidentProposal({
    proposal,
    decision: "reject",
    userId: "usr_clara_test",
    rejectionReason: "Prefiero terminar en otro momento",
  });
  assert.equal(rejectResult.proposal.status, "rejected");
  assert.equal(rejectResult.journalEntry.status, "rejected_by_user");

  // 2. Decisión de aprobación del usuario
  const approveResult = resolveResidentProposal({
    proposal,
    decision: "approve",
    userId: "usr_clara_test",
  });
  assert.equal(approveResult.proposal.status, "approved");
  assert.equal(approveResult.journalEntry.status, "approved_by_user");

  // Verificación en el diario de auditoría (Journal)
  const journal = getStoredResidentJournal("usr_clara_test");
  assert.ok(journal.length >= 2, "Debe haber registrado ambas decisiones en el diario");
});

test("Resident Assistant 28: Bloqueo estricto de Nivel 3 (Protegido) — Prohibición absoluta de alterar GP, XP o finanzas", async () => {
  const { classifyResidentAction, resolveResidentProposal } = await import(
    "../src/lib/sanctuary/cozy-residents-engine.ts"
  );

  // Intento de inyectar GP o XP en una propuesta
  const maliciousProposal = {
    proposalId: "prop_hack_gp",
    residentId: "clara",
    buildingId: "atelier",
    domain: "knitting" as const,
    level: 2 as const,
    title: "Bono falso de oro",
    description: "Intento de agregar GP por fuera del motor canónico",
    category: "backlog_task_proposal" as const,
    suggestedPayload: {
      gp_earned: 5000,
      xp_earned: 2000,
      bank_balance: 999999,
    },
    createdAt: new Date().toISOString(),
    status: "pending_approval" as const,
  };

  // 1. Clasificación debe interceptar como Nivel 3 Protegido y denegar
  const classification = classifyResidentAction({
    category: maliciousProposal.category,
    payload: maliciousProposal.suggestedPayload,
  });
  assert.equal(classification.level, 3, "Debe clasificar como Nivel 3 Protegido");
  assert.equal(classification.isAllowed, false, "Debe prohibir la ejecución");
  assert.ok(classification.violationReason?.includes("gp_earned") || classification.violationReason?.includes("bloqueada"));

  // 2. Intento de forzar aprobación debe ser bloqueado por la política de seguridad
  const blockedResult = resolveResidentProposal({
    proposal: maliciousProposal,
    decision: "approve",
    userId: "usr_attacker",
  });
  assert.equal(blockedResult.proposal.status, "blocked");
  assert.equal(blockedResult.journalEntry.status, "blocked_by_policy");
});

test("Resident Assistant 29: Asistentes contextuales en múltiples edificios (Lyra en Biblioteca, Eldrin en Librería, Milo en Rubik)", async () => {
  const { generateResidentAdvice } = await import(
    "../src/lib/sanctuary/cozy-residents-engine.ts"
  );

  // 1. Lyra (Biblioteca / SM-2)
  const lyraAdvice = generateResidentAdvice({
    residentId: "lyra",
    buildingId: "biblioteca",
    domain: "study",
    spacedRepetitionCards: [
      { id: "c1", prompt: "P1", reflection: "R1", ease_factor: 2.5, interval_days: 1, repetitions: 1, next_review: new Date().toISOString() },
      { id: "c2", prompt: "P2", reflection: "R2", ease_factor: 2.5, interval_days: 1, repetitions: 1, next_review: new Date().toISOString() },
    ],
  });
  assert.equal(lyraAdvice.residentId, "lyra");
  assert.equal(lyraAdvice.avatar, "🦉");
  assert.ok(lyraAdvice.contextSummary.includes("2 tarjetas"));
  assert.ok(lyraAdvice.preparedSession?.objective.includes("Duelo de Repaso Activo SM-2"));

  // 2. Eldrin (Librería / Lectura)
  const eldrinAdvice = generateResidentAdvice({
    residentId: "eldrin",
    buildingId: "libreria",
    domain: "reading",
    readingBooks: [
      { id: "b1", title: "Hábitos Atómicos", author: "James Clear", total_pages: 320, pages_read: 150, status: "reading", category: "Autoayuda" },
    ],
  });
  assert.equal(eldrinAdvice.residentId, "eldrin");
  assert.equal(eldrinAdvice.avatar, "🦡");
  assert.ok(eldrinAdvice.contextSummary.includes("Hábitos Atómicos"));
  assert.ok(eldrinAdvice.contextSummary.includes("150 de 320"));

  // 3. Milo (Club de Puzzles / Rubik)
  const miloAdvice = generateResidentAdvice({
    residentId: "milo",
    buildingId: "club_puzzles",
    domain: "rubik",
    rubikPb: 16.85,
    rubikSolvesCount: 42,
  });
  assert.equal(miloAdvice.residentId, "milo");
  assert.equal(miloAdvice.avatar, "🐿️");
  assert.ok(miloAdvice.contextSummary.includes("16.85s"));
  assert.ok(miloAdvice.contextSummary.includes("42 solves"));
});

test("Resident Assistant 30: Gobernanza, Registro de Auditoría (Journal) y Desactivación de Asistentes", async () => {
  const {
    saveResidentSettings,
    getStoredResidentSettings,
    generateResidentAdvice,
  } = await import("../src/lib/sanctuary/cozy-residents-engine.ts");

  const userId = "usr_governance_test";

  // 1. Silenciar a Clara individualmente
  saveResidentSettings({ mutedResidents: ["clara"] }, userId);
  const settings1 = getStoredResidentSettings(userId);
  assert.ok(settings1.mutedResidents.includes("clara"));

  const claraAdviceMuted = generateResidentAdvice({
    userId,
    residentId: "clara",
    buildingId: "atelier",
    domain: "knitting",
    knittingProjects: [
      { id: "p1", name: "P1", technique: "Crochet", total_rows_target: 60, completed_rows: 58, yarn_details: "Y", status: "in_progress" },
    ],
  });
  assert.equal(claraAdviceMuted.pendingProposals.length, 0, "Clara silenciada no debe generar propuestas");

  // Lyra sigue activa y no está silenciada
  const lyraAdviceActive = generateResidentAdvice({
    userId,
    residentId: "lyra",
    buildingId: "biblioteca",
    domain: "study",
    spacedRepetitionCards: [
      { id: "c1", prompt: "P1", reflection: "R1", ease_factor: 2.5, interval_days: 1, repetitions: 1, next_review: new Date().toISOString() },
    ],
  });
  assert.equal(lyraAdviceActive.residentName, "Lyra");

  // 2. Desactivación Global de Asistentes
  saveResidentSettings({ assistantsEnabledGlobal: false }, userId);
  const settingsGlobal = getStoredResidentSettings(userId);
  assert.equal(settingsGlobal.assistantsEnabledGlobal, false);

  const lyraAdviceGlobalOff = generateResidentAdvice({
    userId,
    residentId: "lyra",
    buildingId: "biblioteca",
    domain: "study",
  });
  assert.equal(lyraAdviceGlobalOff.pendingProposals.length, 0, "Con asistentes desactivados globalmente no hay propuestas");
});


