/**
 * ============================================================================
 * OAKHAVEN WRIST & iOS SHORTCUTS — CONTRATO DE CAPTURA RÁPIDA Y TOKENS SCOPED
 * ============================================================================
 * Distingue explícitamente:
 *  1) Integración vía Atajos de iOS (HTTP autenticado con token personal revocable,
 *     disponible hoy en iPhone y Apple Watch mediante Siri/Shortcuts).
 *  2) Futura app nativa de Apple Watch (WatchKit/SwiftUI con cola offline local).
 *
 * Nunca genera tokens productivos automáticamente ni permite mutar GP/XP/COP
 * directamente desde el cliente.
 */

export type QuickDeviceSource = "apple_watch" | "ios_shortcut" | "galaxy_tab" | "windows_web";

export type DeviceIntegrationChannel =
  | "ios_shortcuts_http"
  | "apple_watch_native_companion";

export type PersonalTokenScope =
  | "read:summary"
  | "write:quick_capture"
  | "write:timer";

export interface DeviceChannelCapability {
  channel: DeviceIntegrationChannel;
  label: string;
  requiresNativeApp: boolean;
  supportedActions: QuickCaptureActionType[];
  offlineQueueSupported: boolean;
  notes: string;
}

export const DEVICE_CHANNEL_CAPABILITIES: Record<DeviceIntegrationChannel, DeviceChannelCapability> = {
  ios_shortcuts_http: {
    channel: "ios_shortcuts_http",
    label: "Atajos de iOS (iPhone + Apple Watch vía Siri/Shortcuts)",
    requiresNativeApp: false,
    supportedActions: [
      "quick_habit",
      "quick_timer_start",
      "quick_timer_stop",
      "quick_note",
      "quick_crochet_row",
    ],
    offlineQueueSupported: false,
    notes: "Opera hoy sobre endpoints HTTPS con token personal revocable de alcance limitado.",
  },
  apple_watch_native_companion: {
    channel: "apple_watch_native_companion",
    label: "App Nativa Apple Watch (WatchOS Companion — futuro)",
    requiresNativeApp: true,
    supportedActions: [
      "quick_habit",
      "quick_timer_start",
      "quick_timer_stop",
      "quick_crochet_row",
    ],
    offlineQueueSupported: true,
    notes: "Requiere proyecto SwiftUI/WatchConnectivity independiente; comparte el mismo contrato idempotente.",
  },
};

export interface PersonalDeviceTokenMetadata {
  id: string;
  label: string;
  channel: DeviceIntegrationChannel;
  scopes: PersonalTokenScope[];
  createdAt: string;
  expiresAt?: string;
  revokedAt?: string | null;
}

export function isScopedDeviceTokenAuthorized(
  token: PersonalDeviceTokenMetadata,
  requiredScope: PersonalTokenScope,
  nowIso = new Date().toISOString()
): { allowed: boolean; reason?: string } {
  if (token.revokedAt) {
    return { allowed: false, reason: "Token revocado por el propietario." };
  }
  if (token.expiresAt && new Date(token.expiresAt).getTime() <= new Date(nowIso).getTime()) {
    return { allowed: false, reason: "Token expirado." };
  }
  if (!token.scopes.includes(requiredScope)) {
    return { allowed: false, reason: `Alcance insuficiente: requiere "${requiredScope}".` };
  }
  return { allowed: true };
}

export type QuickCaptureActionType =
  | "quick_habit"
  | "quick_timer_start"
  | "quick_timer_stop"
  | "quick_note"
  | "quick_crochet_row";

export interface QuickCaptureEvent {
  schemaVersion: 1;
  idempotencyKey: string;
  deviceSource: QuickDeviceSource;
  actionType: QuickCaptureActionType;
  label: string;
  durationMinutes?: number;
  projectId?: string;
  capturedAt: string;
}

export interface WristReadOnlySummary {
  walletGp: number;
  currentXp: number;
  playerLevel: number;
  streakDays: number;
  pendingQuestsCount: number;
  activeTimerLabel: string | null;
  generatedAt: string;
}

const FORBIDDEN_CLIENT_FIELDS = [
  "user_id",
  "userId",
  "wallet_gp",
  "current_xp",
  "earned_xp",
  "transferred_gp",
  "amount_cop",
  "balance_cop",
];

export function buildDeterministicQuickCaptureKey(params: {
  deviceSource: QuickDeviceSource;
  actionType: QuickCaptureActionType;
  label: string;
  bucketMinuteIso: string;
}): string {
  const cleanLabel = params.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32);
  const bucket = params.bucketMinuteIso.slice(0, 16);
  return `qc:${params.deviceSource}:${params.actionType}:${cleanLabel || "item"}:${bucket}`;
}

export function validateQuickCapturePayload(
  raw: Record<string, unknown>
): { valid: true; event: QuickCaptureEvent } | { valid: false; error: string } {
  for (const forbidden of FORBIDDEN_CLIENT_FIELDS) {
    if (forbidden in raw && raw[forbidden] !== undefined) {
      return {
        valid: false,
        error: `Campo no permitido desde dispositivo cliente: "${forbidden}".`,
      };
    }
  }

  const label = typeof raw.label === "string" ? raw.label.trim() : "";
  if (!label || label.length > 140) {
    return { valid: false, error: "La etiqueta debe tener entre 1 y 140 caracteres." };
  }

  const allowedSources: QuickDeviceSource[] = [
    "apple_watch",
    "ios_shortcut",
    "galaxy_tab",
    "windows_web",
  ];
  const deviceSource = raw.deviceSource as QuickDeviceSource;
  if (!allowedSources.includes(deviceSource)) {
    return { valid: false, error: "Origen de dispositivo no soportado." };
  }

  const allowedActions: QuickCaptureActionType[] = [
    "quick_habit",
    "quick_timer_start",
    "quick_timer_stop",
    "quick_note",
    "quick_crochet_row",
  ];
  const actionType = raw.actionType as QuickCaptureActionType;
  if (!allowedActions.includes(actionType)) {
    return { valid: false, error: "Tipo de acción rápida inválido." };
  }

  const idempotencyKey =
    typeof raw.idempotencyKey === "string" && raw.idempotencyKey.trim().length >= 8
      ? raw.idempotencyKey.trim().slice(0, 128)
      : "";
  if (!idempotencyKey) {
    return { valid: false, error: "Se requiere una clave de idempotencia válida." };
  }

  let durationMinutes: number | undefined;
  if (raw.durationMinutes !== undefined) {
    const n = Number(raw.durationMinutes);
    if (!Number.isFinite(n) || n < 1 || n > 480) {
      return { valid: false, error: "La duración debe estar entre 1 y 480 minutos." };
    }
    durationMinutes = Math.round(n);
  }

  return {
    valid: true,
    event: {
      schemaVersion: 1,
      idempotencyKey,
      deviceSource,
      actionType,
      label,
      durationMinutes,
      projectId: typeof raw.projectId === "string" ? raw.projectId.trim().slice(0, 64) : undefined,
      capturedAt:
        typeof raw.capturedAt === "string" && raw.capturedAt.trim()
          ? raw.capturedAt
          : new Date().toISOString(),
    },
  };
}
