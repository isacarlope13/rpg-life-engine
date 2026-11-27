/**
 * ============================================================================
 * OAKHAVEN — INTERNAL REUSABLE EVENT BUS (FASE 6)
 * ============================================================================
 * Conecta módulos sin dependencias circulares y preservando la fuente canónica
 * de cada dominio (jamás duplica recompensas de GP/XP ni muta dinero real COP).
 */

export type OakHavenInternalEventType =
  | "study_session_completed"
  | "crochet_session_completed"
  | "expense_confirmed"
  | "ink_note_promoted"
  | "task_overdue";

export interface OakHavenInternalEvent {
  eventId: string;
  type: OakHavenInternalEventType;
  occurredAt: string;
  sourceModule: string;
  payload: Record<string, unknown>;
}

export interface OakHavenEventDispatchOutcome {
  accepted: boolean;
  duplicate: boolean;
  notifiedModules: string[];
  generatedProposals: string[];
  mutatedGpOrXp: false;
  mutatedRealMoneyCop: false;
}

export class OakHavenInternalEventBus {
  private seenEventIds = new Set<string>();
  private history: OakHavenInternalEvent[] = [];

  dispatch(event: OakHavenInternalEvent): OakHavenEventDispatchOutcome {
    if (this.seenEventIds.has(event.eventId)) {
      return {
        accepted: false,
        duplicate: true,
        notifiedModules: [],
        generatedProposals: [],
        mutatedGpOrXp: false,
        mutatedRealMoneyCop: false,
      };
    }

    this.seenEventIds.add(event.eventId);
    this.history = [event, ...this.history].slice(0, 100);

    const notifiedModules: string[] = [];
    const generatedProposals: string[] = [];

    switch (event.type) {
      case "study_session_completed":
        notifiedModules.push("rowan_daily_decisions", "lyra_study_hall");
        generatedProposals.push("Rowan ajustó tu carga restante tras completar tu sesión de estudio.");
        break;
      case "crochet_session_completed":
        notifiedModules.push("atelier_clara", "rowan_daily_decisions");
        generatedProposals.push("Atelier sincronizó el avance del proyecto sin duplicar recompensas de GP/XP.");
        break;
      case "expense_confirmed":
        notifiedModules.push("silas_bank", "automation_budget_alert");
        generatedProposals.push("Silas recalculó alertas presupuestarias en COP (solo lectura, sin pagos automáticos).");
        break;
      case "ink_note_promoted":
        notifiedModules.push("rowan_daily_decisions", "ai_command_approvals");
        generatedProposals.push("Nota manuscrita convertida en propuesta de tarea pendiente de tu confirmación.");
        break;
      case "task_overdue":
        notifiedModules.push("rowan_daily_decisions", "automation_reorg");
        generatedProposals.push("Rowan preparó una propuesta de reprogramación para la tarea vencida.");
        break;
    }

    return {
      accepted: true,
      duplicate: false,
      notifiedModules,
      generatedProposals,
      mutatedGpOrXp: false,
      mutatedRealMoneyCop: false,
    };
  }

  getRecentEvents(): OakHavenInternalEvent[] {
    return [...this.history];
  }
}
