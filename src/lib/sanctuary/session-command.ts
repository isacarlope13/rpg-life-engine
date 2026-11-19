import { isOfflineOwner, OFFLINE_OWNER_HEADER } from "../offline-owner.ts";
import type { SessionStorage } from "./session-storage.ts";
import { isPositiveSessionDuration } from "../skill-session-validation.ts";
import { shortcutAcknowledgement } from "../shortcut-acknowledgement.ts";

export interface SessionCommand {
  readonly ownerId: string;
  readonly operationId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly capturedAt: string;
  readonly status: "pending" | "confirmed";
  readonly confirmedSessionId?: string;
  readonly context?: unknown;
}
export type SessionCommandResult =
  | { outcome: "confirmed"; sessionId: string; data: Record<string, unknown> }
  | { outcome: "pending" | "rejected"; message: string; httpStatus?: number };

export function sessionCommandKey(ownerId: string, operationId: string): string {
  return `rpg_session_command_v1_${encodeURIComponent(ownerId)}_${encodeURIComponent(operationId)}`;
}

/** Freeze a canonical JSON payload before the first request. Keep it unchanged on every retry. */
export function captureSessionCommand(
  storage: SessionStorage,
  input: Readonly<{ ownerId: string; operationId: string; payload: Record<string, unknown>; context?: unknown }>,
): SessionCommand {
  if (!isOfflineOwner(input.ownerId) || !input.operationId.trim()) throw Error("Falta identidad de la operación");
  const key = sessionCommandKey(input.ownerId, input.operationId);
  const raw = storage.getItem(key);
  if (raw) {
    const existing = JSON.parse(raw) as SessionCommand;
    if (existing.ownerId !== input.ownerId || existing.operationId !== input.operationId ||
      !existing.payload || existing.payload.idempotency_key !== input.operationId ||
      existing.payload.action !== "log_session" || !isPositiveSessionDuration(existing.payload.duration_minutes) ||
      (existing.status !== "pending" && existing.status !== "confirmed")) throw Error("Pendiente local no válido; conservar para recuperación");
    if (existing.status === "confirmed" && !existing.confirmedSessionId) throw Error("Recibo local incompleto; conservar para recuperación");
    return existing;
  }
  const command: SessionCommand = JSON.parse(JSON.stringify({
    ownerId: input.ownerId, operationId: input.operationId,
    payload: { ...input.payload, action: "log_session", idempotency_key: input.operationId },
    capturedAt: new Date().toISOString(), status: "pending", context: input.context,
  }));
  if (!isPositiveSessionDuration(command.payload.duration_minutes)) {
    throw Error("No hay tiempo real registrado para guardar");
  }
  if (storage.setItem(key, JSON.stringify(command)) === false) throw Error("No se pudo asegurar el pendiente local; conserva la sesión y reintenta");
  return command;
}

export function hasCapturedSessionCommand(storage: SessionStorage, owner?: string, operationId?: string): boolean {
  if (!isOfflineOwner(owner) || !operationId) return false;
  try { return storage.getItem(sessionCommandKey(owner, operationId)) !== null; }
  catch { return true; }
}

export async function requestSessionCommand(command: SessionCommand, request: typeof fetch = fetch): Promise<SessionCommandResult> {
  try {
    const response = await request("/api/shortcuts/skill-session", {
      method: "POST",
      headers: { "Content-Type": "application/json", [OFFLINE_OWNER_HEADER]: command.ownerId },
      body: JSON.stringify(command.payload),
    });
    const data: unknown = await response.json().catch(() => null);
    const body = data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : null;
    if (!response.ok) return {
      outcome: response.status === 401 || response.status === 409 ? "rejected" : "pending",
      message: typeof body?.error === "string" ? body.error : "El servidor no confirmó la sesión", httpStatus: response.status,
    };
    const sessionId = shortcutAcknowledgement("/api/shortcuts/skill-session", body);
    if (!sessionId || !body) {
      return { outcome: "pending", message: "Respuesta sin confirmación de sesión; el pendiente se conserva", httpStatus: response.status };
    }
    return { outcome: "confirmed", sessionId, data: body };
  } catch {
    return { outcome: "pending", message: "Sin confirmación de red; la sesión se conserva para reintentar" };
  }
}

const inFlight = new Map<string, Promise<SessionCommandResult>>();
/** In-page deduplication and a local receipt. Server transaction durability remains authoritative. */
export function executeSessionCommand(storage: SessionStorage, command: SessionCommand, request: typeof fetch = fetch): Promise<SessionCommandResult> {
  const key = sessionCommandKey(command.ownerId, command.operationId);
  const current = inFlight.get(key);
  if (current) return current;
  const run = async (): Promise<SessionCommandResult> => {
    const raw = storage.getItem(key);
    const stored = raw ? JSON.parse(raw) as SessionCommand : command;
    if (stored.ownerId !== command.ownerId || stored.operationId !== command.operationId) throw Error("Propietario de pendiente no válido");
    if (stored.status === "confirmed" && stored.confirmedSessionId) return {
      outcome: "confirmed", sessionId: stored.confirmedSessionId,
      data: { success: true, session_logged: { id: stored.confirmedSessionId }, local_receipt: true },
    };
    const result = await requestSessionCommand(stored, request);
    if (result.outcome === "confirmed") {
      storage.setItem(key, JSON.stringify({ ...stored, status: "confirmed", confirmedSessionId: result.sessionId }));
    }
    return result;
  };
  const task = run().finally(() => { inFlight.delete(key); });
  inFlight.set(key, task);
  return task;
}
