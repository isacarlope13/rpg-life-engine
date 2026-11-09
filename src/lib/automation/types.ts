/**
 * RPG LIFE-ENGINE — AUTOMATION CORE TYPES & CONTRACTS (v3.5)
 * Define las interfaces del motor de eventos, cola de tareas,
 * máquina de reglas, auditoría y aprobaciones humanas (HITL).
 */

export type SystemEventType =
  | "LIFE_EVENT_CAPTURED"
  | "SKILL_SESSION_COMPLETED"
  | "EXPENSE_RECORDED"
  | "CIRCADIAN_PHASE_CHANGED"
  | "STREAK_AT_RISK"
  | "BOSS_ENRAGE_WARNING"
  | "SCHEDULE_REBALANCE_PROPOSED"
  | "QUEST_GENERATED"
  | "APPROVAL_REQUESTED"
  | "APPROVAL_RESOLVED"
  | "ACTION_EXECUTED";

export type EventSource = "user" | "agent" | "scheduler" | "shortcut" | "rule_engine";

export interface SystemEvent<T = Record<string, unknown>> {
  id: string;
  type: SystemEventType;
  userId: string;
  timestamp: string;
  source: EventSource;
  payload: T;
  correlationId?: string;
}

export type TaskStatus =
  | "pending"
  | "processing"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "dead_letter";

export interface AutomationTask {
  id: string;
  userId: string;
  idempotencyKey: string;
  eventType: SystemEventType;
  event: SystemEvent;
  targetAgent: string;
  status: TaskStatus;
  retries: number;
  maxRetries: number;
  backoffMs: number;
  result?: Record<string, unknown>;
  error?: string;
  createdAt: string;
  updatedAt: string;
  executedAt?: string;
}

export type ActionCategory =
  | "financial_rebalance"
  | "schedule_shift"
  | "quest_override"
  | "debt_amortization";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

export interface ApprovalRequest {
  id: string;
  userId: string;
  agentSource: string;
  actionCategory: ActionCategory;
  title: string;
  summaryRationale: string;
  diffPayload: {
    current: Record<string, unknown>;
    proposed: Record<string, unknown>;
  };
  status: ApprovalStatus;
  createdAt: string;
  expiresAt: string;
  resolvedAt?: string;
  resolvedBy?: "user" | "system_guardian" | "timeout";
}

export interface SystemAuditLogEntry {
  id: string;
  userId: string;
  actorType: "agent" | "user" | "rule_engine" | "scheduler";
  actorId: string;
  actionName: string;
  resourceAffected: string;
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  securityHash: string;
  createdAt: string;
}

export interface InvariantValidationResult {
  isValid: boolean;
  requiresApproval: boolean;
  reason?: string;
  violationCode?: string;
}

export const AUTOMATION_CORE_VERSION = "3.5.0";

export type EventHandler<T = Record<string, unknown>> = (
  event: SystemEvent<T>
) => Promise<void | Record<string, unknown>>;
