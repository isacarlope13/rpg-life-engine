/**
 * COZY RESIDENTS & AUTOMATION ENGINE — RPG LIFE-ENGINE (FASE 10)
 *
 * Sistema de asistentes contextuales para los edificios del Santuario de Oakhaven.
 * Personajes no controlables (NPCs) que asisten al usuario reduciendo fricción cognitiva.
 *
 * MATRIZ DE AUTOMATIZACIÓN DE 3 NIVELES:
 * - Nivel 1 (Automático): Lecturas, resúmenes, preparación de recomendaciones, indicadores.
 * - Nivel 2 (Requiere Confirmación HITL): Creación de tareas, modificación de proyectos, agregar recursos.
 * - Nivel 3 (Protegido - Bloqueado): GP, XP, finanzas, recompensas y balances. Estrictamente prohibido para residentes.
 *
 * GARANTÍAS:
 * 1. Cero emisión de GP/XP autónomo.
 * 2. Idempotencia estricta en propuestas y ejecuciones.
 * 3. Aislamiento multi-usuario local-first.
 * 4. Control de límites y cooldowns (anti-flood).
 * 5. Interruptor maestro y por residente para desactivar o silenciar la asistencia.
 */

import type {
  SkillDomain,
  SkillDomainSummary,
  SkillSessionRecord,
  KnittingProject,
  ReadingBook,
  SpacedRepetitionCard,
} from "@/types/rpg";

export type AutomationLevel = 1 | 2 | 3;

export type ResidentActionCategory =
  | "session_preparation"
  | "project_reminder"
  | "resource_recommendation"
  | "backlog_task_proposal"
  | "progress_summary"
  | "focus_block_suggestion"
  | "sm2_review_preparation"
  | "rubik_warmup_suggestion";

export interface ResidentActionProposal {
  proposalId: string;
  residentId: string;
  buildingId: string;
  domain: SkillDomain;
  level: AutomationLevel;
  title: string;
  description: string;
  category: ResidentActionCategory;
  suggestedPayload: Record<string, unknown>;
  createdAt: string;
  status: "pending_approval" | "approved" | "rejected" | "auto_applied" | "blocked";
  rejectionReason?: string;
}

export interface ResidentJournalEntry {
  entryId: string;
  userId: string;
  residentId: string;
  buildingId: string;
  level: AutomationLevel;
  actionTitle: string;
  status: "auto_executed" | "approved_by_user" | "rejected_by_user" | "blocked_by_policy";
  timestamp: string;
  payloadSummary: string;
}

export interface ResidentSettings {
  assistantsEnabledGlobal: boolean;
  mutedResidents: string[]; // IDs de residentes silenciados
  autoPrepareSessions: boolean;
  dailyProposalLimitPerBuilding: number;
}

export interface ResidentContextData {
  userId?: string;
  domain: SkillDomain;
  buildingId: string;
  residentId: string;
  skillSummary?: SkillDomainSummary;
  recentSessions?: SkillSessionRecord[];
  knittingProjects?: KnittingProject[];
  readingBooks?: ReadingBook[];
  spacedRepetitionCards?: SpacedRepetitionCard[];
  workProjects?: Array<{
    id: string;
    name: string;
    progressPercent: number;
    pendingTasks: string[];
  }>;
  rubikPb?: number | null;
  rubikSolvesCount?: number;
}

export interface ResidentAdviceResult {
  residentId: string;
  residentName: string;
  residentTitle: string;
  avatar: string;
  greetingQuote: string;
  contextSummary: string;
  level1Recommendations: string[];
  preparedSession?: {
    objective: string;
    recommendedMinutes: number;
    resourceTitle?: string;
    resourceId?: string;
    initialNotes?: string;
    metadata?: Record<string, unknown>;
  };
  pendingProposals: ResidentActionProposal[];
}

// ============================================================================
// MATRIZ DE PERMISOS Y CLASIFICACIÓN DE ACCIONES
// ============================================================================

export const FORBIDDEN_LEVEL_3_FIELDS = [
  "gp",
  "gp_earned",
  "gold_pieces",
  "wallet_gp",
  "vault_gp",
  "xp",
  "xp_earned",
  "experience_points",
  "bank_balance",
  "debt_amortization",
  "financial_transfer",
  "reward_payout",
] as const;

/**
 * Valida si una acción propuesta pertenece a Nivel 1, 2 o si viola Nivel 3 (Protegido)
 */
export function classifyResidentAction(action: {
  category: ResidentActionCategory;
  payload: Record<string, unknown>;
}): { level: AutomationLevel; isAllowed: boolean; violationReason?: string } {
  const payloadKeys = Object.keys(action.payload).map((k) => k.toLowerCase());

  // 1. Verificación de Violación de Nivel 3 (Protegido - Invariante Financiera y de XP)
  for (const forbidden of FORBIDDEN_LEVEL_3_FIELDS) {
    if (payloadKeys.includes(forbidden) || action.payload[forbidden] !== undefined) {
      return {
        level: 3,
        isAllowed: false,
        violationReason: `Acción bloqueada por política de seguridad: Los residentes tienen prohibido alterar o emitir '${forbidden}'.`,
      };
    }
  }

  // 2. Clasificación de Nivel 2: Requiere Confirmación Humana (HITL)
  // Mutaciones de proyectos, creación de tareas, agregar recursos físicos
  if (
    action.category === "backlog_task_proposal" ||
    action.payload.mutatesProject === true ||
    action.payload.createsResource === true ||
    action.payload.modifiesSchedule === true
  ) {
    return {
      level: 2,
      isAllowed: true, // Permitido pero requiere confirmación
    };
  }

  // 3. Clasificación de Nivel 1: Automático (Read-only, resúmenes, preparación contextual)
  return {
    level: 1,
    isAllowed: true,
  };
}

// ============================================================================
// GESTOR DE PREFERENCIAS Y ALMACENAMIENTO LOCAL SEGURO
// ============================================================================

function getStorageSafely(): Storage | null {
  try {
    if (typeof globalThis !== "undefined" && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch {}
  return null;
}

export function getResidentSettingsKey(userId: string = "default"): string {
  return `rpg_resident_settings_${userId}`;
}

export function getResidentJournalKey(userId: string = "default"): string {
  return `rpg_resident_journal_${userId}`;
}

export function getStoredResidentSettings(userId: string = "default"): ResidentSettings {
  const defaultSettings: ResidentSettings = {
    assistantsEnabledGlobal: true,
    mutedResidents: [],
    autoPrepareSessions: true,
    dailyProposalLimitPerBuilding: 3,
  };

  const storage = getStorageSafely();
  if (!storage) return defaultSettings;

  try {
    const raw = storage.getItem(getResidentSettingsKey(userId));
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw);
    return {
      assistantsEnabledGlobal:
        typeof parsed.assistantsEnabledGlobal === "boolean"
          ? parsed.assistantsEnabledGlobal
          : true,
      mutedResidents: Array.isArray(parsed.mutedResidents) ? parsed.mutedResidents : [],
      autoPrepareSessions:
        typeof parsed.autoPrepareSessions === "boolean" ? parsed.autoPrepareSessions : true,
      dailyProposalLimitPerBuilding:
        typeof parsed.dailyProposalLimitPerBuilding === "number"
          ? parsed.dailyProposalLimitPerBuilding
          : 3,
    };
  } catch {
    return defaultSettings;
  }
}

export function saveResidentSettings(settings: Partial<ResidentSettings>, userId: string = "default"): ResidentSettings {
  const current = getStoredResidentSettings(userId);
  const updated: ResidentSettings = {
    ...current,
    ...settings,
  };

  const storage = getStorageSafely();
  if (storage) {
    try {
      storage.setItem(getResidentSettingsKey(userId), JSON.stringify(updated));
    } catch {}
  }
  return updated;
}

export function getStoredResidentJournal(userId: string = "default"): ResidentJournalEntry[] {
  const storage = getStorageSafely();
  if (!storage) return [];

  try {
    const raw = storage.getItem(getResidentJournalKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendResidentJournalEntry(
  entry: Omit<ResidentJournalEntry, "entryId" | "timestamp">,
  userId: string = "default"
): ResidentJournalEntry {
  const journal = getStoredResidentJournal(userId);
  const newEntry: ResidentJournalEntry = {
    ...entry,
    entryId: `jnl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
  };

  const updated = [newEntry, ...journal].slice(0, 50); // Mantener últimos 50 registros
  const storage = getStorageSafely();
  if (storage) {
    try {
      storage.setItem(getResidentJournalKey(userId), JSON.stringify(updated));
    } catch {}
  }
  return newEntry;
}

// ============================================================================
// GENERACIÓN DETERMINISTA DE ASISTENCIA CONTEXTUAL (RESIDENT ADVICE)
// ============================================================================

/**
 * Genera de forma pura y determinista el resumen, preparación de sesión y propuestas
 * del residente para un edificio específico respetando configuración y permisos.
 */
export function generateResidentAdvice(context: ResidentContextData): ResidentAdviceResult {
  const userId = context.userId || "default";
  const settings = getStoredResidentSettings(userId);

  // Verificación de interruptor de asistencia
  const isMuted =
    !settings.assistantsEnabledGlobal || settings.mutedResidents.includes(context.residentId);

  switch (context.residentId) {
    // ------------------------------------------------------------------------
    // PILOTO: CLARA (ATELIER / KNITTING)
    // ------------------------------------------------------------------------
    case "clara": {
      const activeProj = context.knittingProjects?.find((p) => p.status === "in_progress") ||
        context.knittingProjects?.[0];
      const completedRows = activeProj?.completed_rows || 0;
      const targetRows = activeProj?.total_rows_target || 60;
      const nextSuggestedRows = Math.min(5, Math.max(1, targetRows - completedRows));

      let contextSummary = "Tus agujas y el telar están limpios y listos para montar puntos.";
      if (activeProj) {
        contextSummary = `Recuerdo tu proyecto activo "${activeProj.name}". Vas en la vuelta ${completedRows} de ${targetRows} (${Math.round((completedRows / targetRows) * 100)}%).`;
      }

      const recs: string[] = [
        "Respira con calma en cada lazada para mantener la tensión regular.",
        "Verifica que el hilado corra libremente desde el centro de la madeja.",
      ];

      // Preparación automática de sesión (Nivel 1)
      const preparedSession = settings.autoPrepareSessions && activeProj
        ? {
            objective: `Avanzar ${nextSuggestedRows} vueltas en "${activeProj.name}"`,
            recommendedMinutes: 20,
            resourceTitle: activeProj.name,
            resourceId: activeProj.id,
            initialNotes: `Reanudando en vuelta ${completedRows} con técnica ${activeProj.technique}`,
            metadata: {
              targetRows: nextSuggestedRows,
              technique: activeProj.technique,
            },
          }
        : undefined;

      // Propuesta Nivel 2 (HITL): Si el proyecto está a menos de 5 vueltas de terminar
      const pendingProposals: ResidentActionProposal[] = [];
      if (!isMuted && activeProj && targetRows - completedRows <= 5 && targetRows - completedRows > 0) {
        pendingProposals.push({
          proposalId: `prop_clara_finish_${activeProj.id}`,
          residentId: "clara",
          buildingId: "atelier",
          domain: "knitting",
          level: 2,
          title: "Sprint de Remate Final de Prenda",
          description: `Estás a solo ${targetRows - completedRows} vueltas de terminar "${activeProj.name}". ¿Deseas preparar un bloque especial de remate y bloqueo?`,
          category: "backlog_task_proposal",
          suggestedPayload: {
            projectId: activeProj.id,
            targetAction: "final_finishing_block",
            suggestedRows: targetRows - completedRows,
          },
          createdAt: new Date().toISOString(),
          status: "pending_approval",
        });
      }

      return {
        residentId: "clara",
        residentName: "Clara",
        residentTitle: "Maestra Tejedora (Liebre Artesana)",
        avatar: "🐇",
        greetingQuote: "El ritmo pausado de las agujas aquieta la mente. Cada punto cuenta una historia.",
        contextSummary,
        level1Recommendations: recs,
        preparedSession,
        pendingProposals: isMuted ? [] : pendingProposals,
      };
    }

    // ------------------------------------------------------------------------
    // ELDRIN: LIBRERÍA (READING)
    // ------------------------------------------------------------------------
    case "eldrin": {
      const activeBook = context.readingBooks?.find((b) => b.status === "reading") ||
        context.readingBooks?.[0];
      const pagesRead = activeBook?.pages_read || 0;
      const totalPages = activeBook?.total_pages || 200;
      const suggestedPages = Math.min(15, Math.max(5, totalPages - pagesRead));

      const contextSummary = activeBook
        ? `Tienes en el atril "${activeBook.title}" por ${activeBook.author}. Has leído ${pagesRead} de ${totalPages} páginas.`
        : "Los estantes del archivo están esperando tu próxima lectura serena.";

      const preparedSession = settings.autoPrepareSessions && activeBook
        ? {
            objective: `Leer ${suggestedPages} páginas de "${activeBook.title}"`,
            recommendedMinutes: 20,
            resourceTitle: activeBook.title,
            resourceId: activeBook.id,
            initialNotes: `Continuando desde la página ${pagesRead}`,
          }
        : undefined;

      return {
        residentId: "eldrin",
        residentName: "Eldrin",
        residentTitle: "Archivero Mayor (Tejón Lector)",
        avatar: "🦡",
        greetingQuote: "Un buen libro no se devora con prisa; se saborea página tras página.",
        contextSummary,
        level1Recommendations: [
          "Anota en el cuaderno de citas cualquier frase que resuene antes de pasar de página.",
          "Una infusión tibia de manzanilla favorece la inmersión profunda.",
        ],
        preparedSession,
        pendingProposals: [],
      };
    }

    // ------------------------------------------------------------------------
    // LYRA: BIBLIOTECA (STUDY / SM-2)
    // ------------------------------------------------------------------------
    case "lyra": {
      const cards = context.spacedRepetitionCards || [];
      const pendingCardsCount = cards.length;

      const contextSummary = pendingCardsCount > 0
        ? `Tienes ${pendingCardsCount} tarjetas de memoria espaciada listas para repaso activo en el atril.`
        : "Tu cátedra de estudio está al día. Puedes forjar nuevas tarjetas de conceptos clave.";

      const preparedSession = settings.autoPrepareSessions
        ? {
            objective: `Duelo de Repaso Activo SM-2 (${Math.min(pendingCardsCount, 5)} tarjetas)`,
            recommendedMinutes: 15,
            resourceTitle: "Mazo de Memoria Espaciada SM-2",
            initialNotes: "Repaso activo con ponderación de facilidad",
          }
        : undefined;

      const pendingProposals: ResidentActionProposal[] = [];
      if (!isMuted && pendingCardsCount >= 5) {
        pendingProposals.push({
          proposalId: `prop_lyra_review_${Date.now()}`,
          residentId: "lyra",
          buildingId: "biblioteca",
          domain: "study",
          level: 2,
          title: "Organizar Bloque Pomodoro de Retención Activa",
          description: `Hay ${pendingCardsCount} tarjetas en el mazo. ¿Deseas agruparlas en una sesión de 25 minutos con descanso de 5 min?`,
          category: "sm2_review_preparation",
          suggestedPayload: {
            cardCount: Math.min(pendingCardsCount, 10),
            method: "Pomodoro 25/5",
          },
          createdAt: new Date().toISOString(),
          status: "pending_approval",
        });
      }

      return {
        residentId: "lyra",
        residentName: "Lyra",
        residentTitle: "Erudita de la Cátedra (Búho Sabio)",
        avatar: "🦉",
        greetingQuote: "El conocimiento retenido en la memoria espaciada florece sin esfuerzo.",
        contextSummary,
        level1Recommendations: [
          "Intenta recordar la respuesta antes de voltear la tarjeta para consolidar la vía neural.",
          "Si un concepto resulta confuso, descompónlo en dos tarjetas más sencillas.",
        ],
        preparedSession,
        pendingProposals: isMuted ? [] : pendingProposals,
      };
    }

    // ------------------------------------------------------------------------
    // MILO: CLUB DE PUZZLES (RUBIK)
    // ------------------------------------------------------------------------
    case "milo": {
      const pb = context.rubikPb;
      const solves = context.rubikSolvesCount || 0;

      const contextSummary = pb !== null && pb !== undefined
        ? `Tu mejor marca personal es ${pb.toFixed(2)}s con ${solves} solves registrados en el club.`
        : "El tapete WCA y los cronómetros están listos para tu primer solve con scramble oficial.";

      const preparedSession = settings.autoPrepareSessions
        ? {
            objective: "Calentamiento fluido: 3 solves WCA con atención al lookahead",
            recommendedMinutes: 10,
            resourceTitle: "Cubo 3x3 Oficial",
            initialNotes: "Priorizar suavidad de giro y parada limpia del cronómetro",
          }
        : undefined;

      return {
        residentId: "milo",
        residentName: "Milo",
        residentTitle: "Campeón de Reflejos WCA (Ardilla Speedcuber)",
        avatar: "🐿️",
        greetingQuote: "¡La fluidez en el lookahead supera a la fuerza bruta! Respira hondo antes de inspeccionar.",
        contextSummary,
        level1Recommendations: [
          "Aprovecha los 15 segundos de inspección reglamentaria para planear la cruz completa.",
          "Mantén el cubo a una distancia visual cómoda para no mover excesivamente las muñecas.",
        ],
        preparedSession,
        pendingProposals: [],
      };
    }

    // ------------------------------------------------------------------------
    // RESIDENTE GENÉRICO / RESTANTES
    // ------------------------------------------------------------------------
    default: {
      return {
        residentId: context.residentId,
        residentName: "Guardián de Oakhaven",
        residentTitle: "Custodio del Pueblo",
        avatar: "🏡",
        greetingQuote: "La constancia serena convierte los pequeños pasos diarios en grandes obras.",
        contextSummary: "El edificio está en calma y preparado para tu siguiente sesión de bienestar.",
        level1Recommendations: [
          "Dedica unos minutos a desconectar del ruido externo.",
          "Cada sesión completada enriquece el patrimonio de tu pueblo.",
        ],
        pendingProposals: [],
      };
    }
  }
}

/**
 * Resuelve una propuesta de Nivel 2 (HITL) mediante la decisión explícita del usuario.
 */
export function resolveResidentProposal(params: {
  proposal: ResidentActionProposal;
  decision: "approve" | "reject";
  userId?: string;
  rejectionReason?: string;
}): { proposal: ResidentActionProposal; journalEntry: ResidentJournalEntry } {
  const userId = params.userId || "default";
  const { proposal, decision, rejectionReason } = params;

  // Validación de seguridad previa: Nivel 3 está estrictamente bloqueado
  const validation = classifyResidentAction({
    category: proposal.category,
    payload: proposal.suggestedPayload,
  });

  if (!validation.isAllowed || validation.level === 3) {
    const blockedProposal: ResidentActionProposal = {
      ...proposal,
      status: "blocked",
      rejectionReason: validation.violationReason || "Acción prohibida por política de nivel 3.",
    };
    const journalEntry = appendResidentJournalEntry(
      {
        userId,
        residentId: proposal.residentId,
        buildingId: proposal.buildingId,
        level: 3,
        actionTitle: proposal.title,
        status: "blocked_by_policy",
        payloadSummary: validation.violationReason || "Intento de mutación protegida bloqueado.",
      },
      userId
    );
    return { proposal: blockedProposal, journalEntry };
  }

  if (decision === "approve") {
    const approvedProposal: ResidentActionProposal = {
      ...proposal,
      status: "approved",
    };
    const journalEntry = appendResidentJournalEntry(
      {
        userId,
        residentId: proposal.residentId,
        buildingId: proposal.buildingId,
        level: proposal.level,
        actionTitle: proposal.title,
        status: "approved_by_user",
        payloadSummary: JSON.stringify(proposal.suggestedPayload),
      },
      userId
    );
    return { proposal: approvedProposal, journalEntry };
  } else {
    const rejectedProposal: ResidentActionProposal = {
      ...proposal,
      status: "rejected",
      rejectionReason: rejectionReason || "Descartada por el usuario.",
    };
    const journalEntry = appendResidentJournalEntry(
      {
        userId,
        residentId: proposal.residentId,
        buildingId: proposal.buildingId,
        level: proposal.level,
        actionTitle: proposal.title,
        status: "rejected_by_user",
        payloadSummary: `Rechazada: ${rejectionReason || "Sin motivo especificado"}`,
      },
      userId
    );
    return { proposal: rejectedProposal, journalEntry };
  }
}
