import { AutomationEventBus, defaultEventBus } from "../automation/event-bus.ts";
import type { SystemEvent, SystemEventType } from "../automation/types.ts";

export interface LifeCaptureInput {
  userId: string;
  rawText: string;
  source?: "siri" | "ios_shortcut" | "command_bar" | "voice_note" | "manual";
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export interface NormalizedLifeEvent {
  eventType: SystemEventType;
  domain?: string;
  intent: "skill_session" | "expense" | "reflection" | "habit" | "general_note";
  title: string;
  data: Record<string, unknown>;
  confidence: number;
}

/**
 * LifeCaptureAgent: Agente de percepción del sistema.
 * Ingiere lenguaje natural de cualquier canal (voz, atajos, texto libre)
 * y lo normaliza en eventos fuertemente tipados para el EventBus.
 */
export class LifeCaptureAgent {
  private eventBus: AutomationEventBus;

  constructor(bus: AutomationEventBus = defaultEventBus) {
    this.eventBus = bus;
  }

  /**
   * Procesa la entrada cruda del usuario, normaliza entidades y emite el evento al EventBus.
   */
  public async ingestAndDispatch(
    input: LifeCaptureInput
  ): Promise<{ normalized: NormalizedLifeEvent; emittedEvent: SystemEvent }> {
    const normalized = this.parseNaturalInput(input.rawText);
    const nowIso = input.timestamp || new Date().toISOString();

    const systemEvent: SystemEvent = {
      id: `evt_cap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: normalized.eventType,
      userId: input.userId,
      timestamp: nowIso,
      source: "agent",
      payload: {
        rawInput: input.rawText,
        sourceChannel: input.source || "manual",
        intent: normalized.intent,
        domain: normalized.domain,
        title: normalized.title,
        confidence: normalized.confidence,
        ...normalized.data,
        ...input.metadata,
      },
    };

    await this.eventBus.emit(systemEvent);

    return {
      normalized,
      emittedEvent: systemEvent,
    };
  }

  /**
   * Parser híbrido determinista de alta velocidad (0 ms) con extracción de entidades.
   */
  public parseNaturalInput(text: string): NormalizedLifeEvent {
    const raw = text.trim();
    const lower = raw.toLowerCase();

    // 1. Detección de Gastos / Finanzas: "gasté 15000 en almuerzo", "$25.000 cena", "pagué 80000"
    const expenseRegex = /(?:gast[eé]|compr[eé]|pagu[eé])\s*(?:\$|cop)?\s*([\d.,]+)\s*(?:en|de)?\s*(.*)/i;
    const expenseMatch = raw.match(expenseRegex);
    if (expenseMatch) {
      const rawAmount = expenseMatch[1].replace(/[.,]/g, "");
      const amount = Number(rawAmount) || 0;
      const concept = expenseMatch[2]?.trim() || "Gasto sin categoría";

      return {
        eventType: "EXPENSE_RECORDED",
        intent: "expense",
        title: `Gasto: ${concept}`,
        confidence: 0.95,
        data: {
          amountCop: amount,
          concept,
          category: this.inferExpenseCategory(concept),
        },
      };
    }

    // 2. Detección de Habilidades WCA / Cubo de Rubik: "cubo 3x3 en 14.5s", "hice solve de 12.8s"
    const rubikRegex = /(?:cubo|solve|rubik)\s*(?:3x3|4x4|2x2)?\s*(?:en|de)?\s*([\d.,]+)\s*s?/i;
    const rubikMatch = raw.match(rubikRegex);
    if (rubikMatch) {
      const seconds = parseFloat(rubikMatch[1].replace(",", "."));
      return {
        eventType: "SKILL_SESSION_COMPLETED",
        domain: "rubik",
        intent: "skill_session",
        title: `Cubo de Rubik: Solve ${seconds}s`,
        confidence: 0.95,
        data: {
          domain: "rubik",
          durationMinutes: 5,
          seconds,
          cubeType: "3x3",
        },
      };
    }

    // 3. Detección de Lectura: "leí 25 páginas de Atomic Habits", "30 minutos de lectura"
    const readingPagesRegex = /(?:le[ií]|leyendo)\s*(\d+)\s*(?:p[aá]ginas?|p[aá]gs?)\s*(?:de)?\s*(.*)/i;
    const readingMatch = raw.match(readingPagesRegex);
    if (readingMatch) {
      const pages = parseInt(readingMatch[1], 10);
      const book = readingMatch[2]?.trim() || "Lectura actual";
      return {
        eventType: "SKILL_SESSION_COMPLETED",
        domain: "reading",
        intent: "skill_session",
        title: `Lectura: ${pages} págs de ${book}`,
        confidence: 0.95,
        data: {
          domain: "reading",
          pagesRead: pages,
          durationMinutes: Math.round(pages * 1.5),
          bookTitle: book,
        },
      };
    }

    // 4. Detección de Habilidades del Santuario: Jardinería, Tejido, Dibujo, Cocina, Senderismo
    if (lower.includes("jardineria") || lower.includes("jardinería") || lower.includes("plantas") || lower.includes("podar")) {
      return {
        eventType: "SKILL_SESSION_COMPLETED",
        domain: "gardening",
        intent: "skill_session",
        title: `Jardinería Botánica: ${raw}`,
        confidence: 0.9,
        data: { domain: "gardening", durationMinutes: 30 },
      };
    }

    if (lower.includes("tejer") || lower.includes("tejido") || lower.includes("crochet") || lower.includes("filas")) {
      return {
        eventType: "SKILL_SESSION_COMPLETED",
        domain: "crochet",
        intent: "skill_session",
        title: `Crochet / Tejido: ${raw}`,
        confidence: 0.9,
        data: { domain: "crochet", durationMinutes: 30 },
      };
    }

    if (lower.includes("dibujo") || lower.includes("dibujar") || lower.includes("boceto")) {
      return {
        eventType: "SKILL_SESSION_COMPLETED",
        domain: "drawing",
        intent: "skill_session",
        title: `Dibujo & Bocetos: ${raw}`,
        confidence: 0.9,
        data: { domain: "drawing", durationMinutes: 30 },
      };
    }

    if (lower.includes("caminar") || lower.includes("senderismo") || lower.includes("hiking") || lower.includes("km")) {
      return {
        eventType: "SKILL_SESSION_COMPLETED",
        domain: "hiking",
        intent: "skill_session",
        title: `Senderismo Urbano: ${raw}`,
        confidence: 0.9,
        data: { domain: "hiking", durationMinutes: 45 },
      };
    }

    if (lower.includes("cocinar") || lower.includes("cocina") || lower.includes("receta")) {
      return {
        eventType: "SKILL_SESSION_COMPLETED",
        domain: "cooking",
        intent: "skill_session",
        title: `Cocina Experimental: ${raw}`,
        confidence: 0.9,
        data: { domain: "cooking", durationMinutes: 40 },
      };
    }

    // 5. Reflexiones y Diario / Journaling
    if (
      lower.startsWith("reflexion:") ||
      lower.startsWith("reflexión:") ||
      lower.includes("reflexi") ||
      lower.startsWith("insight:") ||
      lower.includes("diario") ||
      lower.includes("journal")
    ) {
      return {
        eventType: "LIFE_EVENT_CAPTURED",
        domain: "journaling",
        intent: "reflection",
        title: "Entrada de Journaling",
        confidence: 0.9,
        data: { text: raw, domain: "journaling" },
      };
    }

    // 6. Fallback General estructurado
    return {
      eventType: "LIFE_EVENT_CAPTURED",
      intent: "general_note",
      title: raw.length > 40 ? `${raw.slice(0, 37)}...` : raw,
      confidence: 0.75,
      data: { text: raw },
    };
  }

  private inferExpenseCategory(concept: string): string {
    const c = concept.toLowerCase();
    if (c.includes("almuerzo") || c.includes("cena") || c.includes("comida") || c.includes("restaurante") || c.includes("cafe") || c.includes("café")) {
      return "alimentacion";
    }
    if (c.includes("uber") || c.includes("taxi") || c.includes("gasolina") || c.includes("bus") || c.includes("metro")) {
      return "transporte";
    }
    if (c.includes("suscripcion") || c.includes("netflix") || c.includes("spotify") || c.includes("cine")) {
      return "ocio";
    }
    return "variable_ops";
  }
}

export const defaultLifeCaptureAgent = new LifeCaptureAgent();
