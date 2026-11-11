/**
 * VISUAL VILLAGE PROGRESSION ENGINE — RPG LIFE-ENGINE (FASE 9)
 *
 * Transforma hitos reales, verificables y confirmados por el usuario
 * en la evolución visual del pueblo, fachadas, interiores, decoraciones y colecciones.
 *
 * INVARIANTES Y RESTRICCIONES ESTRICTAS:
 * 1. Cero emisión de GP y XP: Esta capa es 100% de proyección visual decorativa.
 * 2. Idempotencia: El reprocesamiento de los mismos hitos o eventos genera idéntica proyección.
 * 3. No degradación por inactividad: Una vez desbloqueado un hito, trofeo o tier, permanece activo para siempre.
 * 4. Aislamiento multi-usuario: El estado visual de un usuario nunca contamina el de otro.
 * 5. Desacoplamiento total: Separa reglas de negocio, eventos, proyección y renderizado.
 */

import type { SkillDomain, SkillDomainSummary, SkillSessionRecord, KnittingProject, ReadingBook } from "@/types/rpg";

export type BuildingVisualTier = 1 | 2 | 3;

export interface MilestoneEvent {
  eventId: string;
  userId: string;
  buildingId: string;
  domain: SkillDomain;
  milestoneType:
    | "project_completed"
    | "book_finished"
    | "rows_milestone"
    | "study_session_milestone"
    | "work_deliverable_completed"
    | "rubik_record"
    | "focus_milestone"
    | "session_milestone";
  targetId?: string;
  title: string;
  confirmedAt: string;
  metadata?: Record<string, unknown>;
}

export interface BuildingDecorationItem {
  id: string;
  name: string;
  category: "exterior" | "furniture" | "trophy" | "relic";
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
  requirement: string;
  flavorText: string;
}

export interface DisplayedCreationItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  badge: string;
  completedAt: string;
  detail: string;
}

export interface BuildingVisualProgression {
  buildingId: string;
  domain: SkillDomain;
  tier: BuildingVisualTier;
  tierName: string;
  tierBadge: string;
  facadeDescription: string;
  exteriorDecorations: BuildingDecorationItem[];
  interiorFurniture: BuildingDecorationItem[];
  trophies: BuildingDecorationItem[];
  creationsExhibition: DisplayedCreationItem[];
  unlockedItemsCount: number;
  totalItemsCount: number;
  progressToNextTier: {
    current: number;
    target: number;
    percentage: number;
    nextTierName?: string;
  };
}

export interface VillageProgressionProjection {
  userId: string;
  timestamp: string;
  buildings: Record<string, BuildingVisualProgression>;
  overallVillageTier: BuildingVisualTier;
  totalMilestonesUnlocked: number;
  gpEmitted: 0; // Invariante estricta: siempre 0 GP
  xpEmitted: 0; // Invariante estricta: siempre 0 XP
}

export interface ConfirmedMilestonesInput {
  userId?: string;
  skillSummaries?: SkillDomainSummary[];
  recentSessions?: SkillSessionRecord[];
  knittingProjects?: KnittingProject[];
  readingBooks?: ReadingBook[];
  workProjectsCompletedCount?: number;
  workDeliverablesCount?: number;
  studyReviewsCount?: number;
  rubikSinglePb?: number | null;
  rubikSolvesCount?: number;
  deepWorkMinutes?: number;
  processedEventIds?: string[];
}

export interface VillageProgressionState {
  userId: string;
  processedEventIds: string[];
  lastProjectionAt: string;
}

// ============================================================================
// HELPER SEGURO DE ALMACENAMIENTO (COMPATIBLE CON SSR Y NODE.JS TEST RUNNER)
// ============================================================================
function getStorageSafely(): Storage | null {
  try {
    if (typeof globalThis !== "undefined" && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch {}
  return null;
}

export function getVillageProgressionStorageKey(userId: string = "default"): string {
  return `rpg_village_progression_${userId}`;
}

export function getStoredProgressionState(userId: string = "default"): VillageProgressionState {
  const storage = getStorageSafely();
  if (!storage) {
    return {
      userId,
      processedEventIds: [],
      lastProjectionAt: new Date().toISOString(),
    };
  }
  try {
    const raw = storage.getItem(getVillageProgressionStorageKey(userId));
    if (!raw) {
      return {
        userId,
        processedEventIds: [],
        lastProjectionAt: new Date().toISOString(),
      };
    }
    const parsed = JSON.parse(raw);
    return {
      userId,
      processedEventIds: Array.isArray(parsed.processedEventIds) ? parsed.processedEventIds : [],
      lastProjectionAt: parsed.lastProjectionAt || new Date().toISOString(),
    };
  } catch {
    return {
      userId,
      processedEventIds: [],
      lastProjectionAt: new Date().toISOString(),
    };
  }
}

/**
 * Registra un evento de hito de manera determinista e idempotente.
 * Si el evento ya fue procesado para este usuario, la llamada es no-op y no duplica desbloqueos.
 */
export function recordConfirmedMilestoneEvent(
  userId: string,
  event: MilestoneEvent
): { state: VillageProgressionState; wasAlreadyProcessed: boolean } {
  const currentState = getStoredProgressionState(userId);
  const eventKey = event.eventId || `${event.buildingId}_${event.milestoneType}_${event.targetId || "default"}`;

  if (currentState.processedEventIds.includes(eventKey)) {
    return { state: currentState, wasAlreadyProcessed: true };
  }

  const updatedState: VillageProgressionState = {
    userId,
    processedEventIds: [...currentState.processedEventIds, eventKey],
    lastProjectionAt: new Date().toISOString(),
  };

  const storage = getStorageSafely();
  if (storage) {
    try {
      storage.setItem(getVillageProgressionStorageKey(userId), JSON.stringify(updatedState));
    } catch {}
  }

  return { state: updatedState, wasAlreadyProcessed: false };
}

// ============================================================================
// PROYECCIÓN DE EDIFICIOS INDIVIDUALES (PURA, DETERMINISTA, SIN EFECTOS SECUNDARIOS)
// ============================================================================

/**
 * Proyecta la evolución visual del Atelier (Tejido / Artesanía)
 */
export function projectAtelierProgression(params: {
  level: number;
  sessionsCount: number;
  knittingProjects: KnittingProject[];
}): BuildingVisualProgression {
  const { level, sessionsCount, knittingProjects } = params;

  // Hitos reales confirmados
  const completedProjects = knittingProjects.filter(
    (p) => (p.completed_rows || 0) >= (p.total_rows_target || 60)
  );
  const totalRows = knittingProjects.reduce((acc, p) => acc + (p.completed_rows || 0), 0);

  // Determinación de Tier (1, 2 o 3)
  // Tier 3: 3+ proyectos terminados O 80+ filas O nivel 5+ O 10+ sesiones
  // Tier 2: 1+ proyecto terminado O 25+ filas O nivel 2+ O 3+ sesiones
  let tier: BuildingVisualTier = 1;
  let tierName = "Cabaña de Bastidor Rústico";
  let tierBadge = "🪵 Tier 1";
  let facadeDescription = "Cabaña acogedora de madera clara con ovillos en el alféizar y chimenea rústica.";

  if (completedProjects.length >= 2 || totalRows >= 80 || level >= 5 || sessionsCount >= 10) {
    tier = 3;
    tierName = "Atelier Maestro Textil";
    tierBadge = "⭐ Tier 3";
    facadeDescription = "Atelier señorial de piedra con vidrieras policromadas, toldo bordado de lino y tapiz heráldico exterior.";
  } else if (completedProjects.length >= 1 || totalRows >= 25 || level >= 2 || sessionsCount >= 3) {
    tier = 2;
    tierName = "Taller de Costura Establecido";
    tierBadge = "🌿 Tier 2";
    facadeDescription = "Taller de madera noble con porche techado, farol de bienvenida y vitrina de hilados naturales.";
  }

  // Decoraciones exteriores
  const exteriorDecorations: BuildingDecorationItem[] = [
    {
      id: "at_ext_lantern",
      name: "Farol Cálido de Porche",
      category: "exterior",
      icon: "🏮",
      unlocked: sessionsCount >= 1 || totalRows >= 1,
      requirement: "1+ sesión o fila de tejido",
      flavorText: "Ilumina la entrada del Atelier en las tardes brumosas de Oakhaven.",
    },
    {
      id: "at_ext_awning",
      name: "Toldo de Lino Bordado a Mano",
      category: "exterior",
      icon: "🎪",
      unlocked: tier >= 2,
      requirement: "Alcanzar Tier 2 en el Atelier",
      flavorText: "Lona resistente bordada con motivos de hojas que protege el umbral del taller.",
    },
    {
      id: "at_ext_garden",
      name: "Jardín de Plantas Tintóreas",
      category: "exterior",
      icon: "🌺",
      unlocked: tier >= 3,
      requirement: "Alcanzar Tier 3 (Maestro Textil)",
      flavorText: "Cultivo de índigo, rubia y manzanilla para teñir lanas de forma botánica.",
    },
  ];

  // Mobiliario interior y herramientas decorativas
  const interiorFurniture: BuildingDecorationItem[] = [
    {
      id: "at_furn_loom",
      name: "Telar Rústico de Roble",
      category: "furniture",
      icon: "🪵",
      unlocked: sessionsCount >= 1 || totalRows >= 1,
      requirement: "1+ sesión de tejido",
      flavorText: "Telar tradicional tallado a mano con pedales de madera suave.",
    },
    {
      id: "at_furn_basket",
      name: "Cesta de Mimbre con Ovillos Merino",
      category: "furniture",
      icon: "🧺",
      unlocked: totalRows >= 20 || sessionsCount >= 2,
      requirement: "20+ filas tejidas o 2+ sesiones",
      flavorText: "Cesta artesanal repleta de hebras suaves teñidas con extractos naturales.",
    },
    {
      id: "at_furn_scissors",
      name: "Tijeras Doradas de Sastre",
      category: "furniture",
      icon: "✂️",
      unlocked: totalRows >= 50 || completedProjects.length >= 1,
      requirement: "50+ filas o 1+ proyecto completado",
      flavorText: "Hoja de acero templado pulida para cortes limpios y precisos.",
    },
    {
      id: "at_furn_winder",
      name: "Devanadora Giratoria de Haya",
      category: "furniture",
      icon: "⚙️",
      unlocked: tier >= 2,
      requirement: "Taller Establecido (Tier 2)",
      flavorText: "Facilita ovillar madejas en suaves pasteles de lana listos para tejer.",
    },
  ];

  // Trofeos y reliquias de maestría
  const trophies: BuildingDecorationItem[] = [
    {
      id: "at_trophy_tapestry",
      name: "Tapiz del Gran Artesano",
      category: "trophy",
      icon: "🏆",
      unlocked: totalRows >= 80 || completedProjects.length >= 2 || level >= 3,
      requirement: "80+ filas, 2+ proyectos completados o Nivel 3+",
      flavorText: "Obra maestra tejida con paciencia infinita que adorna la pared de honor.",
    },
    {
      id: "at_relic_golden_needle",
      name: "Aguja Legendaria de Marfil & Oro",
      category: "relic",
      icon: "✨",
      unlocked: tier >= 3,
      requirement: "Atelier Maestro (Tier 3)",
      flavorText: "Distinción otorgada a tejedores cuya constancia ha embellecido todo el pueblo.",
    },
  ];

  // Exposición de creaciones (prendas completadas)
  const creationsExhibition: DisplayedCreationItem[] = completedProjects.map((p) => ({
    id: p.id,
    title: p.name,
    subtitle: `${p.technique || "Tejido"} • ${p.yarn_details || "Lana pura"}`,
    icon: "🧶",
    badge: "✓ Prenda Terminada",
    completedAt: new Date().toISOString(),
    detail: `${p.completed_rows}/${p.total_rows_target} vueltas completadas con dedicación.`,
  }));

  // Progreso al siguiente tier
  const progressTarget = tier === 1 ? 25 : tier === 2 ? 80 : 80;
  const progressCurrent = Math.min(totalRows, progressTarget);
  const progressPercent = tier === 3 ? 100 : Math.round((progressCurrent / progressTarget) * 100);

  const allItems = [...exteriorDecorations, ...interiorFurniture, ...trophies];
  const unlockedCount = allItems.filter((i) => i.unlocked).length;

  return {
    buildingId: "atelier",
    domain: "knitting",
    tier,
    tierName,
    tierBadge,
    facadeDescription,
    exteriorDecorations,
    interiorFurniture,
    trophies,
    creationsExhibition,
    unlockedItemsCount: unlockedCount,
    totalItemsCount: allItems.length,
    progressToNextTier: {
      current: progressCurrent,
      target: progressTarget,
      percentage: progressPercent,
      nextTierName: tier === 1 ? "Taller Establecido" : tier === 2 ? "Atelier Maestro Textil" : undefined,
    },
  };
}

/**
 * Proyecta la evolución visual de la Librería (Lectura / Libros)
 */
export function projectLibreriaProgression(params: {
  level: number;
  sessionsCount: number;
  readingBooks: ReadingBook[];
}): BuildingVisualProgression {
  const { level, sessionsCount, readingBooks } = params;

  const finishedBooks = readingBooks.filter(
    (b) => b.status === "completed" || (b.pages_read > 0 && b.pages_read >= b.total_pages)
  );
  const totalPagesRead = readingBooks.reduce((acc, b) => acc + (b.pages_read || 0), 0);

  let tier: BuildingVisualTier = 1;
  let tierName = "Puesto de Libros del Paseo";
  let tierBadge = "🪵 Tier 1";
  let facadeDescription = "Puesto de madera con techumbre a dos aguas y cajas de libros selectos.";

  if (finishedBooks.length >= 3 || totalPagesRead >= 600 || level >= 5 || sessionsCount >= 10) {
    tier = 3;
    tierName = "Gran Librería de Alejandría";
    tierBadge = "⭐ Tier 3";
    facadeDescription = "Edificio de cantería y vidrieras altas, chimenea de ladrillo visto y estantes de doble altura.";
  } else if (finishedBooks.length >= 1 || totalPagesRead >= 100 || level >= 2 || sessionsCount >= 3) {
    tier = 2;
    tierName = "Librería de Viejo & Manuscritos";
    tierBadge = "🌿 Tier 2";
    facadeDescription = "Acogedora tienda con estanterías de cedro, porche de lectura y farol ámbar.";
  }

  const exteriorDecorations: BuildingDecorationItem[] = [
    {
      id: "lib_ext_sign",
      name: "Letrero de Libro Abierto",
      category: "exterior",
      icon: "📖",
      unlocked: true,
      requirement: "Disponible de inicio",
      flavorText: "Letrero tallado en madera noble que invita a los curiosos a curiosear.",
    },
    {
      id: "lib_ext_bench",
      name: "Banco de Lectura Bajo el Alero",
      category: "exterior",
      icon: "🪑",
      unlocked: tier >= 2,
      requirement: "Librería Tier 2",
      flavorText: "Perfecto para disfrutar de las primeras páginas al sol de la tarde.",
    },
    {
      id: "lib_ext_vault",
      name: "Vitrina de Incunables Sellados",
      category: "exterior",
      icon: "🏛️",
      unlocked: tier >= 3,
      requirement: "Librería Tier 3",
      flavorText: "Expositor acristalado donde descansan tomos raros e iluminados a mano.",
    },
  ];

  const interiorFurniture: BuildingDecorationItem[] = [
    {
      id: "lib_furn_lectern",
      name: "Atril de Roble para Lectura Serena",
      category: "furniture",
      icon: "📖",
      unlocked: sessionsCount >= 1 || readingBooks.length >= 1,
      requirement: "1+ libro en catálogo o 1+ sesión",
      flavorText: "Soporte ergonómico con sujeción para hojas de lino.",
    },
    {
      id: "lib_furn_lamp",
      name: "Farol de Forja de Medianoche",
      category: "furniture",
      icon: "🏮",
      unlocked: sessionsCount >= 3 || totalPagesRead >= 50,
      requirement: "3+ sesiones de lectura o 50+ páginas",
      flavorText: "Luz ámbar suave que no fatiga la mirada en horas tardías.",
    },
    {
      id: "lib_furn_armchair",
      name: "Sillón Orejero de Terciopelo Verde",
      category: "furniture",
      icon: "🛋️",
      unlocked: tier >= 2,
      requirement: "Librería Tier 2",
      flavorText: "Asiento envolvente con reposapiés para sesiones de inmersión total.",
    },
  ];

  const trophies: BuildingDecorationItem[] = [
    {
      id: "lib_trophy_seal",
      name: "Sello Dorado del Archivero",
      category: "trophy",
      icon: "📜",
      unlocked: finishedBooks.length >= 1 || level >= 3,
      requirement: "1+ libro terminado o Nivel 3+",
      flavorText: "Emblema de lacre dorado que certifica obras leídas de portada a contraportada.",
    },
    {
      id: "lib_relic_chronicles",
      name: "Crónicas Eternas de Oakhaven",
      category: "relic",
      icon: "👑",
      unlocked: tier >= 3 && finishedBooks.length >= 3,
      requirement: "Tier 3 y 3+ libros terminados",
      flavorText: "Tomo encuadernado en terciopelo que compila la sabiduría del lector maestro.",
    },
  ];

  const creationsExhibition: DisplayedCreationItem[] = finishedBooks.map((b) => ({
    id: b.id,
    title: b.title,
    subtitle: `${b.author || "Autor anónimo"} • ${b.total_pages} págs.`,
    icon: "📚",
    badge: "✓ Libro Leído",
    completedAt: b.purchase_date || new Date().toISOString(),
    detail: "Tomo concluido y resguardado en la estantería de honor.",
  }));

  const allItems = [...exteriorDecorations, ...interiorFurniture, ...trophies];
  const unlockedCount = allItems.filter((i) => i.unlocked).length;

  return {
    buildingId: "libreria",
    domain: "reading",
    tier,
    tierName,
    tierBadge,
    facadeDescription,
    exteriorDecorations,
    interiorFurniture,
    trophies,
    creationsExhibition,
    unlockedItemsCount: unlockedCount,
    totalItemsCount: allItems.length,
    progressToNextTier: {
      current: Math.min(finishedBooks.length, tier === 1 ? 1 : 2),
      target: tier === 1 ? 1 : 2,
      percentage: tier === 3 ? 100 : Math.round((Math.min(finishedBooks.length, tier === 1 ? 1 : 2) / (tier === 1 ? 1 : 2)) * 100),
      nextTierName: tier === 1 ? "Librería de Viejo" : tier === 2 ? "Gran Librería de Alejandría" : undefined,
    },
  };
}

/**
 * Proyecta la evolución visual de la Biblioteca (Estudio / Memoria SM-2)
 */
export function projectBibliotecaProgression(params: {
  level: number;
  sessionsCount: number;
  studyReviewsCount: number;
}): BuildingVisualProgression {
  const { level, sessionsCount, studyReviewsCount } = params;

  let tier: BuildingVisualTier = 1;
  let tierName = "Sala de Lectura Elemental";
  let tierBadge = "🪵 Tier 1";
  let facadeDescription = "Pequeño atrio de estudio con bancos de madera y pizarra con tizas.";

  if (studyReviewsCount >= 20 || level >= 5 || sessionsCount >= 10) {
    tier = 3;
    tierName = "Cátedra Magna del Saber";
    tierBadge = "⭐ Tier 3";
    facadeDescription = "Palacete de cantería con columnas dóricas, cúpula astronómica y amplios ventanales.";
  } else if (studyReviewsCount >= 6 || level >= 2 || sessionsCount >= 3) {
    tier = 2;
    tierName = "Aula de Estudio Avanzado";
    tierBadge = "🌿 Tier 2";
    facadeDescription = "Casona de vigas vistas con estanterías encuadernadas y reloj solar en la entrada.";
  }

  const exteriorDecorations: BuildingDecorationItem[] = [
    {
      id: "bib_ext_bell",
      name: "Campana de Sesión Académica",
      category: "exterior",
      icon: "🔔",
      unlocked: true,
      requirement: "Disponible de inicio",
      flavorText: "Marca el inicio solemne de bloques de repaso activo.",
    },
    {
      id: "bib_ext_sundial",
      name: "Reloj Solar de Cantería",
      category: "exterior",
      icon: "☀️",
      unlocked: tier >= 2,
      requirement: "Biblioteca Tier 2",
      flavorText: "Mide el paso de las horas guiado por la luz del valle.",
    },
    {
      id: "bib_ext_dome",
      name: "Cúpula de Vidrio Iluminada",
      category: "exterior",
      icon: "🏛️",
      unlocked: tier >= 3,
      requirement: "Biblioteca Tier 3",
      flavorText: "Baña las salas de estudio en luz cenital perpetua.",
    },
  ];

  const interiorFurniture: BuildingDecorationItem[] = [
    {
      id: "bib_furn_desk",
      name: "Pupitre de Roble con Tintero Índigo",
      category: "furniture",
      icon: "🖋️",
      unlocked: sessionsCount >= 1 || studyReviewsCount >= 1,
      requirement: "1+ sesión o repaso SM-2",
      flavorText: "Mesa espaciosa con tintero y secante para apuntes rigurosos.",
    },
    {
      id: "bib_furn_hourglass",
      name: "Reloj de Arena Pomodoro de Cuarzo",
      category: "furniture",
      icon: "⏳",
      unlocked: sessionsCount >= 3 || studyReviewsCount >= 5,
      requirement: "3+ sesiones de estudio",
      flavorText: "Marca intervalos de concentración de 25 minutos sin ruidos.",
    },
    {
      id: "bib_furn_shelves",
      name: "Estanterías de Pergaminos Clasificados",
      category: "furniture",
      icon: "🗄️",
      unlocked: tier >= 2,
      requirement: "Biblioteca Tier 2",
      flavorText: "Módulos de archivo etiquetados según el algoritmo de repaso espaciado.",
    },
  ];

  const trophies: BuildingDecorationItem[] = [
    {
      id: "bib_trophy_diploma",
      name: "Diploma de Constancia Intelectual",
      category: "trophy",
      icon: "📜",
      unlocked: studyReviewsCount >= 10 || level >= 3,
      requirement: "10+ tarjetas SM-2 repasadas o Nivel 3+",
      flavorText: "Pergamino enmarcado en nogal que atestigua hábitos de estudio sólidos.",
    },
    {
      id: "bib_trophy_codex",
      name: "Códice de la Sabiduría de Oakhaven",
      category: "trophy",
      icon: "🏛️",
      unlocked: tier >= 3 || studyReviewsCount >= 25,
      requirement: "Tier 3 o 25+ repasos SM-2",
      flavorText: "Compendio de conceptos asimilados e integrados en la memoria profunda.",
    },
  ];

  // Diplomas / temas completados
  const creationsExhibition: DisplayedCreationItem[] = studyReviewsCount > 0 ? [
    {
      id: "sm2_mastery",
      title: "Mazo de Memoria Espaciada Activa",
      subtitle: `${studyReviewsCount} tarjetas repasadas exitosamente`,
      icon: "🧠",
      badge: "✓ Mazo al Día",
      completedAt: new Date().toISOString(),
      detail: "Intervalos SM-2 optimizados para retención de largo plazo.",
    },
  ] : [];

  const allItems = [...exteriorDecorations, ...interiorFurniture, ...trophies];
  const unlockedCount = allItems.filter((i) => i.unlocked).length;

  return {
    buildingId: "biblioteca",
    domain: "study",
    tier,
    tierName,
    tierBadge,
    facadeDescription,
    exteriorDecorations,
    interiorFurniture,
    trophies,
    creationsExhibition,
    unlockedItemsCount: unlockedCount,
    totalItemsCount: allItems.length,
    progressToNextTier: {
      current: Math.min(studyReviewsCount, tier === 1 ? 6 : 20),
      target: tier === 1 ? 6 : 20,
      percentage: tier === 3 ? 100 : Math.round((Math.min(studyReviewsCount, tier === 1 ? 6 : 20) / (tier === 1 ? 6 : 20)) * 100),
      nextTierName: tier === 1 ? "Aula de Estudio Avanzado" : tier === 2 ? "Cátedra Magna del Saber" : undefined,
    },
  };
}

/**
 * Proyecta la evolución visual de la Oficina (Trabajo / Proyectos / Sprints)
 */
export function projectOficinaProgression(params: {
  level: number;
  sessionsCount: number;
  workProjectsCompletedCount: number;
  workDeliverablesCount: number;
}): BuildingVisualProgression {
  const { level, sessionsCount, workProjectsCompletedCount, workDeliverablesCount } = params;

  let tier: BuildingVisualTier = 1;
  let tierName = "Despacho Rústico de Trabajo";
  let tierBadge = "🪵 Tier 1";
  let facadeDescription = "Cabaña de madera maciza con mesa de plano y estantes sencillos.";

  if (workProjectsCompletedCount >= 2 || workDeliverablesCount >= 5 || level >= 5 || sessionsCount >= 10) {
    tier = 3;
    tierName = "Sede de Alta Dirección & Estrategia";
    tierBadge = "⭐ Tier 3";
    facadeDescription = "Complejo de piedra y cristal con sala de conferencias, terraza de visión y placa conmemorativa.";
  } else if (workProjectsCompletedCount >= 1 || workDeliverablesCount >= 2 || level >= 2 || sessionsCount >= 3) {
    tier = 2;
    tierName = "Estudio Profesional de Proyectos";
    tierBadge = "🌿 Tier 2";
    facadeDescription = "Estudio funcional con pizarra kanban de roble, ventanales luminosos y porche de descanso.";
  }

  const exteriorDecorations: BuildingDecorationItem[] = [
    {
      id: "of_ext_board",
      name: "Pizarra de Sprint Exterior",
      category: "exterior",
      icon: "📋",
      unlocked: true,
      requirement: "Disponible de inicio",
      flavorText: "Tablero para alinear prioridades del día a la vista del pueblo.",
    },
    {
      id: "of_ext_awning",
      name: "Toldo Estilizado de Canvas",
      category: "exterior",
      icon: "🎪",
      unlocked: tier >= 2,
      requirement: "Oficina Tier 2",
      flavorText: "Da sombra al ventanal principal y mantiene fresca la sala de foco.",
    },
    {
      id: "of_ext_flag",
      name: "Estandarte del Hito Corporativo",
      category: "exterior",
      icon: "🚩",
      unlocked: tier >= 3,
      requirement: "Oficina Tier 3",
      flavorText: "Flamea en lo alto celebrando proyectos entregados en tiempo y forma.",
    },
  ];

  const interiorFurniture: BuildingDecorationItem[] = [
    {
      id: "of_furn_desk",
      name: "Escritorio Ergonómico de Fresno",
      category: "furniture",
      icon: "🖥️",
      unlocked: sessionsCount >= 1,
      requirement: "1+ jornada o sprint de trabajo",
      flavorText: "Superficie despejada con canaleta de cables y bandeja de tareas activas.",
    },
    {
      id: "of_furn_coffee",
      name: "Cafetera Espresso de Barista",
      category: "furniture",
      icon: "☕",
      unlocked: sessionsCount >= 3 || workDeliverablesCount >= 1,
      requirement: "3+ sesiones o 1+ entregable",
      flavorText: "Prepara café intenso con crema dorada para desbloquear energía en sprints clave.",
    },
    {
      id: "of_furn_kanban",
      name: "Muro Kanban Magnético de Roble",
      category: "furniture",
      icon: "📌",
      unlocked: tier >= 2,
      requirement: "Oficina Tier 2",
      flavorText: "Columnas claras (Backlog, En Curso, Hecho) para gobernar la carga laboral.",
    },
  ];

  const trophies: BuildingDecorationItem[] = [
    {
      id: "of_trophy_plaque",
      name: "Placa Conmemorativa de Lanzamiento",
      category: "trophy",
      icon: "🏆",
      unlocked: workProjectsCompletedCount >= 1 || workDeliverablesCount >= 3,
      requirement: "1+ proyecto terminado o 3+ entregables",
      flavorText: "Placa de bronce pulido que conmemora el despliegue exitoso a producción.",
    },
    {
      id: "of_relic_shield",
      name: "Escudo del Estratega Implacable",
      category: "relic",
      icon: "🛡️",
      unlocked: tier >= 3,
      requirement: "Oficina Tier 3",
      flavorText: "Distingue el liderazgo sereno frente a plazos ajustados y prioridades cambiantes.",
    },
  ];

  const creationsExhibition: DisplayedCreationItem[] = workProjectsCompletedCount > 0 ? [
    {
      id: "proj_completed_p",
      title: "Proyectos Estratégicos Concluidos",
      subtitle: `${workProjectsCompletedCount} proyectos llevados a término con éxito`,
      icon: "💼",
      badge: "✓ Lanzamiento Confirmado",
      completedAt: new Date().toISOString(),
      detail: "Proyectos ejecutados sin deuda técnica ni sobrecostos.",
    },
  ] : [];

  const allItems = [...exteriorDecorations, ...interiorFurniture, ...trophies];
  const unlockedCount = allItems.filter((i) => i.unlocked).length;

  return {
    buildingId: "oficina",
    domain: "work",
    tier,
    tierName,
    tierBadge,
    facadeDescription,
    exteriorDecorations,
    interiorFurniture,
    trophies,
    creationsExhibition,
    unlockedItemsCount: unlockedCount,
    totalItemsCount: allItems.length,
    progressToNextTier: {
      current: Math.min(workDeliverablesCount, tier === 1 ? 2 : 5),
      target: tier === 1 ? 2 : 5,
      percentage: tier === 3 ? 100 : Math.round((Math.min(workDeliverablesCount, tier === 1 ? 2 : 5) / (tier === 1 ? 2 : 5)) * 100),
      nextTierName: tier === 1 ? "Estudio Profesional" : tier === 2 ? "Sede de Alta Dirección" : undefined,
    },
  };
}

/**
 * Proyecta la evolución visual del Club de Puzzles (Rubik / Speedcubing WCA)
 */
export function projectRubikProgression(params: {
  level: number;
  sessionsCount: number;
  rubikSinglePb: number | null;
  rubikSolvesCount: number;
}): BuildingVisualProgression {
  const { level, sessionsCount, rubikSinglePb, rubikSolvesCount } = params;

  let tier: BuildingVisualTier = 1;
  let tierName = "Rincón del Cubista Principiante";
  let tierBadge = "🪵 Tier 1";
  let facadeDescription = "Cabaña de madera con tapete de mesa y cubo 3x3 tradicional de exposición.";

  if ((rubikSinglePb !== null && rubikSinglePb <= 15) || rubikSolvesCount >= 50 || level >= 5 || sessionsCount >= 10) {
    tier = 3;
    tierName = "Arena Magistral WCA";
    tierBadge = "⭐ Tier 3";
    facadeDescription = "Estadio con vitrinas de cristal templado, cronómetro gigante de dígitos y podio oficial.";
  } else if (rubikSinglePb !== null || rubikSolvesCount >= 5 || level >= 2 || sessionsCount >= 3) {
    tier = 2;
    tierName = "Club Oficial de Speedcubing";
    tierBadge = "🌿 Tier 2";
    facadeDescription = "Club acogedor con tapetes profesionales WCA, estación de lubricación y display de marcas.";
  }

  const exteriorDecorations: BuildingDecorationItem[] = [
    {
      id: "pz_ext_cube",
      name: "Escultura de Cubo Mágico Gigante",
      category: "exterior",
      icon: "🧊",
      unlocked: true,
      requirement: "Disponible de inicio",
      flavorText: "Escultura en la entrada que atrae a entusiastas de la agilidad mental.",
    },
    {
      id: "pz_ext_timer",
      name: "Marcador Exterior de Tiempos",
      category: "exterior",
      icon: "⏱️",
      unlocked: tier >= 2,
      requirement: "Club Tier 2",
      flavorText: "Pantalla LED de bajo consumo que proyecta los mejores solves del club.",
    },
    {
      id: "pz_ext_podium",
      name: "Podio de Campeones de Oakhaven",
      category: "exterior",
      icon: "🥇",
      unlocked: tier >= 3,
      requirement: "Club Tier 3",
      flavorText: "Tarima de tres niveles para celebrar marcas extraordinarias.",
    },
  ];

  const interiorFurniture: BuildingDecorationItem[] = [
    {
      id: "pz_furn_mat",
      name: "Tapete de Speedcubing WCA",
      category: "furniture",
      icon: "🟩",
      unlocked: sessionsCount >= 1 || rubikSolvesCount >= 1,
      requirement: "1+ solve registrado",
      flavorText: "Superficie de neopreno con fijaciones magnéticas para cronómetro.",
    },
    {
      id: "pz_furn_display",
      name: "Cronómetro Digital de Precisión",
      category: "furniture",
      icon: "⏱️",
      unlocked: rubikSinglePb !== null,
      requirement: "Primer Single PB registrado",
      flavorText: "Sensor táctil bipodal con precisión de milisegundos sin rebote.",
    },
    {
      id: "pz_furn_lube",
      name: "Estación de Mantenimiento & Lubricación",
      category: "furniture",
      icon: "🧴",
      unlocked: tier >= 2,
      requirement: "Club Tier 2",
      flavorText: "Herramientas de ajuste de tensiones y lubricantes de viscosidad graduada.",
    },
  ];

  const trophies: BuildingDecorationItem[] = [
    {
      id: "pz_trophy_cup",
      name: "Copa Dorada de Torneo",
      category: "trophy",
      icon: "🏆",
      unlocked: (rubikSinglePb !== null && rubikSinglePb < 25) || level >= 3,
      requirement: "Single PB < 25s o Nivel 3+",
      flavorText: "Trofeo que premia la anticipación del lookahead y la serenidad bajo presión.",
    },
    {
      id: "pz_relic_crystal_cube",
      name: "Cubo Prismático de Cristal",
      category: "relic",
      icon: "💎",
      unlocked: tier >= 3,
      requirement: "Club Tier 3",
      flavorText: "Pieza única de colección facetada en cuarzo translúcido.",
    },
  ];

  const creationsExhibition: DisplayedCreationItem[] = rubikSinglePb !== null ? [
    {
      id: "rubik_pb_record",
      title: "Récord Personal (Single PB)",
      subtitle: `${rubikSinglePb.toFixed(2)}s en Cubo 3x3 Oficial`,
      icon: "⚡",
      badge: "✓ Marca Confirmada",
      completedAt: new Date().toISOString(),
      detail: `Total de ${rubikSolvesCount} solves verificados con scrambles WCA.`,
    },
  ] : [];

  const allItems = [...exteriorDecorations, ...interiorFurniture, ...trophies];
  const unlockedCount = allItems.filter((i) => i.unlocked).length;

  return {
    buildingId: "club_puzzles",
    domain: "rubik",
    tier,
    tierName,
    tierBadge,
    facadeDescription,
    exteriorDecorations,
    interiorFurniture,
    trophies,
    creationsExhibition,
    unlockedItemsCount: unlockedCount,
    totalItemsCount: allItems.length,
    progressToNextTier: {
      current: Math.min(rubikSolvesCount, tier === 1 ? 5 : 25),
      target: tier === 1 ? 5 : 25,
      percentage: tier === 3 ? 100 : Math.round((Math.min(rubikSolvesCount, tier === 1 ? 5 : 25) / (tier === 1 ? 5 : 25)) * 100),
      nextTierName: tier === 1 ? "Club Oficial" : tier === 2 ? "Arena Magistral WCA" : undefined,
    },
  };
}

/**
 * Proyección genérica para otros edificios del pueblo (Observatorio, Huerto, Senderismo, Cocina)
 */
export function projectGenericBuildingProgression(params: {
  buildingId: string;
  domain: SkillDomain;
  level: number;
  sessionsCount: number;
  minutesOrUnits?: number;
}): BuildingVisualProgression {
  const { buildingId, domain, level, sessionsCount, minutesOrUnits = 0 } = params;

  let tier: BuildingVisualTier = 1;
  let tierName = "Pabellón Rústico";
  let tierBadge = "🪵 Tier 1";
  let facadeDescription = "Edificación tradicional de madera con detalles rústicos.";

  if (level >= 5 || sessionsCount >= 10 || minutesOrUnits >= 120) {
    tier = 3;
    tierName = "Santuario Maestro";
    tierBadge = "⭐ Tier 3";
    facadeDescription = "Estructura monumental de cantería y madera noble con ornamentos dorados.";
  } else if (level >= 2 || sessionsCount >= 3 || minutesOrUnits >= 30) {
    tier = 2;
    tierName = "Pabellón Establecido";
    tierBadge = "🌿 Tier 2";
    facadeDescription = "Pabellón con porche decorado, faroles cálidos y estantes de suministros.";
  }

  const exteriorDecorations: BuildingDecorationItem[] = [
    {
      id: `${buildingId}_ext_lantern`,
      name: "Farol Cálido de Bienvenida",
      category: "exterior",
      icon: "🏮",
      unlocked: true,
      requirement: "Disponible de inicio",
      flavorText: "Señal luminosa que da la bienvenida a los caminantes de Oakhaven.",
    },
    {
      id: `${buildingId}_ext_awning`,
      name: "Toldo de Lona Artesanal",
      category: "exterior",
      icon: "🎪",
      unlocked: tier >= 2,
      requirement: "Pabellón Tier 2",
      flavorText: "Ofrece resguardo ante la llovizna o el sol directo de mediodía.",
    },
  ];

  const interiorFurniture: BuildingDecorationItem[] = [
    {
      id: `${buildingId}_furn_bench`,
      name: "Banco de Madera Tallada",
      category: "furniture",
      icon: "🪑",
      unlocked: sessionsCount >= 1,
      requirement: "1+ sesión registrada",
      flavorText: "Lugar de descanso y presencia plena.",
    },
  ];

  const trophies: BuildingDecorationItem[] = [
    {
      id: `${buildingId}_trophy_emblem`,
      name: "Emblema del Guardián de Habilidad",
      category: "trophy",
      icon: "🏆",
      unlocked: tier >= 2 || level >= 3,
      requirement: "Tier 2 o Nivel 3+",
      flavorText: "Reconoce la disciplina diaria en esta rama del bienestar.",
    },
  ];

  const allItems = [...exteriorDecorations, ...interiorFurniture, ...trophies];
  const unlockedCount = allItems.filter((i) => i.unlocked).length;

  return {
    buildingId,
    domain,
    tier,
    tierName,
    tierBadge,
    facadeDescription,
    exteriorDecorations,
    interiorFurniture,
    trophies,
    creationsExhibition: [],
    unlockedItemsCount: unlockedCount,
    totalItemsCount: allItems.length,
    progressToNextTier: {
      current: Math.min(sessionsCount, tier === 1 ? 3 : 10),
      target: tier === 1 ? 3 : 10,
      percentage: tier === 3 ? 100 : Math.round((Math.min(sessionsCount, tier === 1 ? 3 : 10) / (tier === 1 ? 3 : 10)) * 100),
      nextTierName: tier === 1 ? "Pabellón Establecido" : tier === 2 ? "Santuario Maestro" : undefined,
    },
  };
}

// ============================================================================
// PROYECCIÓN GLOBAL DEL PUEBLO (PURA, DETERMINISTA, AISLAMIENTO MULTI-USUARIO)
// ============================================================================

export function projectVillageProgression(input: ConfirmedMilestonesInput): VillageProgressionProjection {
  const userId = input.userId || "default";
  const skillSummaries = input.skillSummaries || [];
  const recentSessions = input.recentSessions || [];
  const knittingProjects = input.knittingProjects || [];
  const readingBooks = input.readingBooks || [];

  const getDomainLevel = (domain: SkillDomain) =>
    skillSummaries.find((s) => s.domain === domain)?.level || 1;
  const getDomainSessions = (domain: SkillDomain) =>
    skillSummaries.find((s) => s.domain === domain)?.sessions_count ||
    recentSessions.filter((s) => s.domain === domain).length;

  // 1. Edificio Piloto: Atelier
  const atelierProgression = projectAtelierProgression({
    level: getDomainLevel("knitting"),
    sessionsCount: getDomainSessions("knitting"),
    knittingProjects,
  });

  // 2. Librería
  const libreriaProgression = projectLibreriaProgression({
    level: getDomainLevel("reading"),
    sessionsCount: getDomainSessions("reading"),
    readingBooks,
  });

  // 3. Biblioteca
  const bibliotecaProgression = projectBibliotecaProgression({
    level: getDomainLevel("study"),
    sessionsCount: getDomainSessions("study"),
    studyReviewsCount: input.studyReviewsCount || 0,
  });

  // 4. Oficina
  const oficinaProgression = projectOficinaProgression({
    level: getDomainLevel("work"),
    sessionsCount: getDomainSessions("work"),
    workProjectsCompletedCount: input.workProjectsCompletedCount || 0,
    workDeliverablesCount: input.workDeliverablesCount || 0,
  });

  // 5. Club de Puzzles
  const rubikProgression = projectRubikProgression({
    level: getDomainLevel("rubik"),
    sessionsCount: getDomainSessions("rubik"),
    rubikSinglePb: input.rubikSinglePb ?? null,
    rubikSolvesCount: input.rubikSolvesCount || 0,
  });

  // 6. Observatorio (Deep Work / General)
  const observatorioProgression = projectGenericBuildingProgression({
    buildingId: "observatorio",
    domain: "general",
    level: getDomainLevel("general"),
    sessionsCount: getDomainSessions("general"),
    minutesOrUnits: input.deepWorkMinutes || 0,
  });

  // 7. Huerto / Jardinería
  const gardeningProgression = projectGenericBuildingProgression({
    buildingId: "pabellon_gardening",
    domain: "gardening",
    level: getDomainLevel("gardening"),
    sessionsCount: getDomainSessions("gardening"),
  });

  // 8. Senderismo
  const hikingProgression = projectGenericBuildingProgression({
    buildingId: "pabellon_hiking",
    domain: "hiking",
    level: getDomainLevel("hiking"),
    sessionsCount: getDomainSessions("hiking"),
  });

  // 9. Cocina
  const cocinaProgression = projectGenericBuildingProgression({
    buildingId: "cocina",
    domain: "cooking",
    level: getDomainLevel("cooking"),
    sessionsCount: getDomainSessions("cooking"),
  });

  const buildings: Record<string, BuildingVisualProgression> = {
    atelier: atelierProgression,
    libreria: libreriaProgression,
    biblioteca: bibliotecaProgression,
    oficina: oficinaProgression,
    club_puzzles: rubikProgression,
    observatorio: observatorioProgression,
    pabellon_gardening: gardeningProgression,
    pabellon_hiking: hikingProgression,
    cocina: cocinaProgression,
  };

  // Cálculo del nivel global del pueblo
  const tiers = Object.values(buildings).map((b) => b.tier);
  const avgTier = tiers.reduce((a, b) => a + b, 0) / tiers.length;
  const tier3Count = tiers.filter((t) => t === 3).length;
  const overallVillageTier: BuildingVisualTier =
    (avgTier >= 2.2 || tier3Count >= 4) ? 3 : (avgTier >= 1.4 || tier3Count >= 1) ? 2 : 1;

  const totalMilestonesUnlocked = Object.values(buildings).reduce(
    (acc, b) => acc + b.unlockedItemsCount + b.creationsExhibition.length,
    0
  );

  return {
    userId,
    timestamp: new Date().toISOString(),
    buildings,
    overallVillageTier,
    totalMilestonesUnlocked,
    gpEmitted: 0,
    xpEmitted: 0,
  };
}
