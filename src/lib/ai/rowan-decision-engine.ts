import { recommendFreeSlotActivities } from "../planner/adaptive-calendar-engine.ts";

export type RowanDecisionIntent =
  | "what_now"
  | "free_slot"
  | "plan_week"
  | "study_today"
  | "prioritize_project"
  | "afford_purchase"
  | "rest_activity"
  | "pending_tasks";

export interface RowanDecisionContext {
  question: string;
  availableMinutes?: number;
  enabledAreaIds: string[];
  pendingTasks?: Array<{ title: string; priority?: "low" | "medium" | "high" | "critical"; areaId?: string }>;
  activeProjects?: Array<{ name: string; status: string }>;
  /** Solo se consulta si el usuario pregunta explícitamente por una compra (aislamiento financiero) */
  explicitFinancialSummary?: {
    availableRealMoneyCop: number;
    requestedPurchaseCop?: number;
    updatedAt: string;
  };
  dataUpdatedAt?: string;
}

export interface RowanDecisionRecommendation {
  intent: RowanDecisionIntent;
  coordinatedSpecialists: string[];
  proposedAction: string;
  reason: string;
  estimatedMinutes: number;
  dataUsed: string[];
  dataUpdatedAt: string;
  alternative: string;
  controls: {
    canAccept: true;
    canModify: true;
    canReject: true;
    permissionLevel: 1 | 2;
    level3FinancialMutationBlocked: true;
  };
  usedGemini: false;
  accessedFinancialData: boolean;
}

export function classifyRowanDecisionIntent(question: string): {
  intent: RowanDecisionIntent;
  extractedMinutes?: number;
} {
  const q = question.toLowerCase();
  const minMatch = q.match(/(\d{1,3})\s*(min|minutos)/);
  const extractedMinutes = minMatch ? Number(minMatch[1]) : undefined;

  if (/comprar|permitirme|gastar|presupuesto|dinero|cop|precio/.test(q)) {
    return { intent: "afford_purchase", extractedMinutes };
  }
  if (/descans|relaj|cansad|pausa|calma/.test(q)) {
    return { intent: "rest_activity", extractedMinutes };
  }
  if (/estudi|repas|examen|apunte/.test(q)) {
    return { intent: "study_today", extractedMinutes };
  }
  if (/proyecto|prioriz|trabajo|sprint/.test(q)) {
    return { intent: "prioritize_project", extractedMinutes };
  }
  if (/semana|organiz|agenda|plan/.test(q)) {
    return { intent: "plan_week", extractedMinutes };
  }
  if (/pendiente|dej[eé]|sin terminar|atrasad/.test(q)) {
    return { intent: "pending_tasks", extractedMinutes };
  }
  if (extractedMinutes !== undefined || /libre|hueco|espacio/.test(q)) {
    return { intent: "free_slot", extractedMinutes };
  }
  return { intent: "what_now", extractedMinutes };
}

/**
 * HITO 8: Motor determinista de apoyo a decisiones coordinado por Presidente Rowan.
 * - Cero llamadas a Gemini por defecto (`usedGemini: false`).
 * - Aislamiento financiero estricto: NUNCA consulta finanzas salvo intención `afford_purchase`.
 * - Nivel 3: prohibido gastar COP o mutar recompensas automáticamente.
 */
export function buildRowanDecisionRecommendation(
  ctx: RowanDecisionContext
): RowanDecisionRecommendation {
  const { intent, extractedMinutes } = classifyRowanDecisionIntent(ctx.question);
  const updatedAt = ctx.dataUpdatedAt || new Date().toISOString();
  const minutes = ctx.availableMinutes ?? extractedMinutes ?? 25;

  const baseControls = {
    canAccept: true as const,
    canModify: true as const,
    canReject: true as const,
    permissionLevel: 1 as const,
    level3FinancialMutationBlocked: true as const,
  };

  if (intent === "afford_purchase") {
    const fin = ctx.explicitFinancialSummary;
    if (!fin) {
      return {
        intent,
        coordinatedSpecialists: ["Silas"],
        proposedAction: "Revisar tu saldo disponible real en el Banco de OakHaven con Silas antes de comprar.",
        reason: "No hay datos financieros confirmados en esta consulta; Rowan nunca inventa cifras ni aprueba gastos sin tu presupuesto real.",
        estimatedMinutes: 5,
        dataUsed: ["Consulta explícita de compra (sin datos financieros cargados)"],
        dataUpdatedAt: updatedAt,
        alternative: "Guardar el artículo en tu Wishlist para evaluarlo tras tu próximo corte de presupuesto.",
        controls: baseControls,
        usedGemini: false,
        accessedFinancialData: false,
      };
    }

    const reqAmt = fin.requestedPurchaseCop ?? 0;
    const canAfford = reqAmt > 0 ? fin.availableRealMoneyCop >= reqAmt : fin.availableRealMoneyCop > 0;
    return {
      intent,
      coordinatedSpecialists: ["Silas"],
      proposedAction: canAfford
        ? "La compra cabe dentro de tu dinero disponible real tras proteger costos fijos y cuotas; decide manualmente si deseas realizarla."
        : "Posponer la compra o registrarla en tu Wishlist para proteger tus compromisos esenciales en COP.",
      reason: canAfford
        ? `Tu disponible real confirmado ($${fin.availableRealMoneyCop.toLocaleString("es-CO")} COP) cubre el monto evaluado sin afectar necesidades esenciales.`
        : `Tu disponible real confirmado ($${fin.availableRealMoneyCop.toLocaleString("es-CO")} COP) es insuficiente para cubrirla sin comprometer gastos fijos o ahorro.`,
      estimatedMinutes: 5,
      dataUsed: ["Presupuesto disponible real COP (motor local determinista de Silas, 0 envío a Gemini)"],
      dataUpdatedAt: fin.updatedAt || updatedAt,
      alternative: "Ajustar tu meta en la Wishlist y esperar al siguiente pago quincenal/mensual.",
      controls: baseControls,
      usedGemini: false,
      accessedFinancialData: true,
    };
  }

  if (intent === "free_slot") {
    const recs = recommendFreeSlotActivities({
      availableMinutes: minutes,
      enabledAreaIds: ctx.enabledAreaIds,
    });
    const primary = recs[0];
    const alt = recs[1];
    return {
      intent,
      coordinatedSpecialists: primary ? [primary.specialist] : ["Rowan"],
      proposedAction: primary ? primary.title : `Pausa breve de ${minutes} minutos`,
      reason: primary
        ? primary.reason
        : "Aprovecha el espacio libre de forma ligera sin sobrecargar tu jornada.",
      estimatedMinutes: primary ? primary.estimatedMinutes : minutes,
      dataUsed: ["Áreas habilitadas del usuario", `Duración libre declarada (${minutes} min)`],
      dataUpdatedAt: updatedAt,
      alternative: alt ? alt.title : "Tomar 10 minutos de descanso real sin pantallas.",
      controls: { ...baseControls, permissionLevel: 2 },
      usedGemini: false,
      accessedFinancialData: false,
    };
  }

  if (intent === "rest_activity") {
    const prefersCrochet = ctx.enabledAreaIds.includes("crochet");
    return {
      intent,
      coordinatedSpecialists: prefersCrochet ? ["Clara", "Nora"] : ["Eldrin", "Nora"],
      proposedAction: prefersCrochet
        ? "Hacer 20 minutos de Crochet tranquilo o ver un episodio breve de tu watchlist."
        : "Leer 15–20 minutos en tu rincón de lectura o disfrutar una película/serie sin prisa.",
      reason: "Son actividades restauradoras de baja fricción que respetan tu descanso sin penalizaciones.",
      estimatedMinutes: 20,
      dataUsed: ["Preferencias de áreas activas", "Política de descanso sin penalizaciones"],
      dataUpdatedAt: updatedAt,
      alternative: "Escribir 5 minutos de Journaling para soltar pendientes mentales y cerrar el día.",
      controls: baseControls,
      usedGemini: false,
      accessedFinancialData: false,
    };
  }

  if (intent === "study_today") {
    return {
      intent,
      coordinatedSpecialists: ["Lyra"],
      proposedAction: "Abrir la Biblioteca de Lyra y completar 1 bloque Pomodoro de 25 min con repaso activo.",
      reason: "Un bloque acotado sostiene el hábito de estudio incluso en días con jornada laboral completa.",
      estimatedMinutes: 25,
      dataUsed: ["Área Estudio activa", "Rutina flexible declarada"],
      dataUpdatedAt: updatedAt,
      alternative: "Hacer un repaso ligero de 10 minutos con flashcards o notas existentes.",
      controls: { ...baseControls, permissionLevel: 2 },
      usedGemini: false,
      accessedFinancialData: false,
    };
  }

  if (intent === "prioritize_project") {
    const activeProj = ctx.activeProjects?.find((p) => p.status === "active");
    return {
      intent,
      coordinatedSpecialists: ["Aura"],
      proposedAction: activeProj
        ? `Priorizar el proyecto "${activeProj.name}" con 1 entregable concreto en la Oficina de Aura.`
        : "Elegir 1 único proyecto prioritario en la Oficina de Aura y definir su siguiente paso de 25 min.",
      reason: "Limitar el foco a un solo proyecto activo evita dispersión y sobrecarga.",
      estimatedMinutes: 25,
      dataUsed: activeProj ? [`Proyecto activo confirmado: ${activeProj.name}`] : ["Estado de proyectos de Trabajo"],
      dataUpdatedAt: updatedAt,
      alternative: "Cerrar primero una micro-tarea pendiente de menos de 15 minutos.",
      controls: { ...baseControls, permissionLevel: 2 },
      usedGemini: false,
      accessedFinancialData: false,
    };
  }

  if (intent === "pending_tasks") {
    const pending = ctx.pendingTasks || [];
    const top = pending[0];
    return {
      intent,
      coordinatedSpecialists: ["Aura", "Rowan"],
      proposedAction: top
        ? `Retomar la tarea pendiente "${top.title}" o reprogramarla para un bloque flexible.`
        : "No tienes tareas pendientes registradas en este contexto; puedes revisar tu Oficina o descansar.",
      reason: top
        ? `Tienes ${pending.length} ${pending.length === 1 ? "tarea pendiente registrada" : "tareas pendientes registradas"}.`
        : "Solo se muestran registros confirmados, sin inventar pendientes.",
      estimatedMinutes: top ? 20 : 5,
      dataUsed: [`Lista confirmada de pendientes (${pending.length})`],
      dataUpdatedAt: updatedAt,
      alternative: "Reprogramar tareas no urgentes para mañana protegiendo tu horario de descanso.",
      controls: baseControls,
      usedGemini: false,
      accessedFinancialData: false,
    };
  }

  if (intent === "plan_week") {
    return {
      intent,
      coordinatedSpecialists: ["Rowan", "Aura", "Lyra", "Bruno"],
      proposedAction: "Distribuir tus metas semanales en 3 bloques principales (Trabajo/Estudio/Gym) y micro-pausas flexibles (Lectura/Crochet/Cubos).",
      reason: "Combina estructura laboral (08:00–17:00) con flexibilidad real y descanso protegido.",
      estimatedMinutes: 15,
      dataUsed: [`Áreas activas (${ctx.enabledAreaIds.length})`, "Rutina semanal declarada"],
      dataUpdatedAt: updatedAt,
      alternative: "Planificar únicamente las 2 prioridades más importantes de los próximos 2 días.",
      controls: baseControls,
      usedGemini: false,
      accessedFinancialData: false,
    };
  }

  // Default: what_now
  const firstPending = ctx.pendingTasks?.[0];
  return {
    intent: "what_now",
    coordinatedSpecialists: firstPending ? ["Aura", "Rowan"] : ["Rowan", "Eldrin"],
    proposedAction: firstPending
      ? `Avanzar 20 minutos en "${firstPending.title}".`
      : "Elegir una actividad breve de 15–20 min en tu edificio favorito (Lectura, Estudio, Cubos o Crochet).",
    reason: firstPending
      ? "Es tu pendiente registrado de mayor prioridad en este momento."
      : "No hay bloqueos urgentes registrados; un paso corto mantiene tu ritmo sin presión.",
    estimatedMinutes: 20,
    dataUsed: ["Áreas activas", "Pendientes confirmados"],
    dataUpdatedAt: updatedAt,
    alternative: "Tomar una pausa consciente o escribir una nota breve de Journaling.",
    controls: baseControls,
    usedGemini: false,
    accessedFinancialData: false,
  };
}

// ============================================================================
// TARJETA DE DECISIÓN DIARIA DETERMINISTA DE ROWAN (ENERGÍA, CARGA Y DESCANSO)
// ============================================================================

export type RowanEnergyLevel = "low" | "medium" | "high";

export interface RowanDailyPriorityItem {
  id: string;
  title: string;
  domain: string;
  buildingId: string;
  estimatedMinutes: number;
  urgency: "high" | "normal" | "gentle";
  reason: string;
}

export interface RowanDailyDecisionInput {
  energyLevel: RowanEnergyLevel;
  quests: Array<{ code: string; title: string; domain?: string; estimated_minutes?: number }>;
  knittingProjects: Array<{ id: string; name: string; status?: string; completed_rows?: number; total_rows_target?: number }>;
  readingBooks: Array<{ id: string; title: string; status?: string; current_page?: number; total_pages?: number }>;
  recentSessionsCount?: number;
  streakDays?: number;
}

export interface RowanDailyDecisionBrief {
  energyLevel: RowanEnergyLevel;
  capacityMinutes: number;
  plannedMinutes: number;
  loadRatioPct: number;
  isOverplanned: boolean;
  focusBlockMinutes: number;
  restBreakMinutes: number;
  priorities: RowanDailyPriorityItem[];
  restRecommendation: string;
  rescheduleProposal: string | null;
  summaryReason: string;
  usedGemini: false;
  accessedFinancialData: false;
}

const DOMAIN_TO_BUILDING: Record<string, string> = {
  knitting: "atelier",
  crochet: "atelier",
  reading: "library",
  study: "study_hall",
  work: "office",
  rubik: "workshop",
  gym: "gym",
  general: "town_hall",
};

/**
 * Genera una Tarjeta de Decisión Diaria 100% determinista y explicable.
 * - Ajusta bloques de concentración y capacidad según energía disponible (low / medium / high).
 * - Detecta sobreplanificación y propone reprogramación sin mutar agendas externas.
 * - Cero llamadas a modelos pagos (`usedGemini: false`) y cero mezcla con COP.
 */
export function buildRowanDailyDecisionBrief(
  input: RowanDailyDecisionInput
): RowanDailyDecisionBrief {
  const energy = input.energyLevel;
  const capacityMinutes = energy === "low" ? 60 : energy === "medium" ? 150 : 240;
  const focusBlockMinutes = energy === "low" ? 15 : energy === "medium" ? 25 : 45;
  const restBreakMinutes = energy === "low" ? 10 : energy === "medium" ? 5 : 10;

  const candidates: RowanDailyPriorityItem[] = [];

  // 1. Misiones activas (máx. 3 candidatas reales)
  for (const q of input.quests.slice(0, 4)) {
    const dom = (q.domain || "general").toLowerCase();
    const est = Math.max(10, Math.min(60, Number(q.estimated_minutes) || focusBlockMinutes));
    candidates.push({
      id: `quest:${q.code}`,
      title: q.title,
      domain: dom,
      buildingId: DOMAIN_TO_BUILDING[dom] || "town_hall",
      estimatedMinutes: est,
      urgency: "high",
      reason: "Compromiso activo en tu tablero de hoy.",
    });
  }

  // 2. Proyecto activo de tejido / Atelier (si existe en curso)
  const activeKnit = input.knittingProjects.find((p) => p.status === "in_progress");
  if (activeKnit) {
    const done = Number(activeKnit.completed_rows || 0);
    const total = Number(activeKnit.total_rows_target || 50);
    candidates.push({
      id: `knit:${activeKnit.id}`,
      title: `Avanzar "${activeKnit.name}"`,
      domain: "knitting",
      buildingId: "atelier",
      estimatedMinutes: energy === "low" ? 15 : 25,
      urgency: energy === "low" ? "gentle" : "normal",
      reason: `Proyecto en curso (${done}/${total} vueltas); excelente bloque creativo sin presión.`,
    });
  }

  // 3. Libro en lectura (si existe)
  const activeBook = input.readingBooks.find(
    (b) => b.status === "reading" || b.status === "in_progress"
  );
  if (activeBook) {
    candidates.push({
      id: `book:${activeBook.id}`,
      title: `Leer "${activeBook.title}"`,
      domain: "reading",
      buildingId: "library",
      estimatedMinutes: 15,
      urgency: "gentle",
      reason: "Lectura ligera ideal para cerrar el día o recuperar foco.",
    });
  }

  const totalPlanned = candidates.reduce((acc, item) => acc + item.estimatedMinutes, 0);
  const maxVisible = energy === "low" ? 2 : 3;
  const priorities = candidates.slice(0, maxVisible);
  const loadRatioPct = Math.min(200, Math.round((totalPlanned / Math.max(1, capacityMinutes)) * 100));
  const isOverplanned = totalPlanned > capacityMinutes;

  const rescheduleProposal = isOverplanned
    ? `Detecté ${totalPlanned} min de compromisos frente a tu capacidad estimada de ${capacityMinutes} min (${loadRatioPct}%). Te sugiero conservar solo las primeras ${maxVisible} prioridades hoy y mover ${Math.max(1, candidates.length - maxVisible)} pendiente(s) a mañana.`
    : null;

  const restRecommendation =
    energy === "low"
      ? `Energía baja: prioriza bloques suaves de ${focusBlockMinutes} min con pausas reales de ${restBreakMinutes} min sin pantallas.`
      : energy === "medium"
      ? `Energía estable: alterna bloques de ${focusBlockMinutes} min de foco con ${restBreakMinutes} min de descanso activo.`
      : `Energía alta: aprovecha bloques profundos de ${focusBlockMinutes} min al inicio y protege pausas de ${restBreakMinutes} min para no agotarte.`;

  const summaryReason =
    priorities.length === 0
      ? "No hay pendientes sobrecargados hoy; elige un bloque breve de descanso o creatividad en el edificio que prefieras."
      : `Priorización determinista basada en tus ${candidates.length} compromiso(s) reales y tu nivel de energía actual (${energy}).`;

  return {
    energyLevel: energy,
    capacityMinutes,
    plannedMinutes: totalPlanned,
    loadRatioPct,
    isOverplanned,
    focusBlockMinutes,
    restBreakMinutes,
    priorities,
    restRecommendation,
    rescheduleProposal,
    summaryReason,
    usedGemini: false,
    accessedFinancialData: false,
  };
}
