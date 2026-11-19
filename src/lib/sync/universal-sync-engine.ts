/**
 * ============================================================================
 * OAKHAVEN FASE 8 — MOTOR UNIVERSAL DE SINCRONIZACIÓN OFFLINE-FIRST
 * ============================================================================
 * CONTRATO DETERMINISTA COMPARTIDO (Gym, Trabajo, Cubos):
 * 1. Supabase es la fuente persistente remota; localStorage es respaldo offline.
 * 2. NUNCA sobrescribe registros locales con respuestas remotas vacías.
 * 3. NUNCA mezcla datos de distintos usuarios en el mismo navegador.
 * 4. NUNCA sincroniza registros demostrativos (`isDemo`, `demo_template`, `demo-*`).
 * 5. NUNCA sincroniza secretos, credenciales ni documentos financieros sensibles.
 * 6. Detecta conflictos de versión explícitos (evita "último cambio gana" ciego).
 * 7. Cero llamadas a Gemini; cero efectos sobre GP, XP o COP.
 */

import crypto from "node:crypto";

export type SyncEntityDomain = "gym_sets" | "work_projects" | "work_tasks" | "rubik_cubes";

export type SyncStatusLabel =
  | "SINCRONIZADO"
  | "PENDIENTE_DE_SINCRONIZAR"
  | "SIN_CONEXION"
  | "CONFLICTO_REQUIERE_REVISION"
  | "ERROR_RECUPERABLE";

export interface SyncRecordEnvelope<T extends Record<string, unknown> = Record<string, unknown>> {
  clientId: string;
  remoteId?: string;
  ownerId: string;
  domain: SyncEntityDomain;
  version: number;
  updatedAt: string;
  deletedAt?: string | null;
  isDemo?: boolean;
  dataOrigin?: "demo_template" | "real_local" | "real_synced";
  payload: T;
}

export interface SyncConflict<T extends Record<string, unknown> = Record<string, unknown>> {
  clientId: string;
  domain: SyncEntityDomain;
  localRecord: SyncRecordEnvelope<T>;
  remoteRecord: SyncRecordEnvelope<T>;
  reason: string;
  resolutionOptions: ["keep_local", "keep_remote", "keep_both"];
}

export interface SyncReconciliationResult<T extends Record<string, unknown> = Record<string, unknown>> {
  merged: SyncRecordEnvelope<T>[];
  toPush: SyncRecordEnvelope<T>[];
  toPull: SyncRecordEnvelope<T>[];
  conflicts: SyncConflict<T>[];
  excludedDemoCount: number;
  status: SyncStatusLabel;
}

export interface OfflineSyncQueueItem {
  idempotencyKey: string;
  ownerId: string;
  domain: SyncEntityDomain;
  record: SyncRecordEnvelope;
  attempts: number;
  enqueuedAt: string;
  lastError?: string;
}

export const MAX_SYNC_PAYLOAD_BYTES = 256 * 1024; // 256 KB por solicitud

const FORBIDDEN_SYNC_KEY_REGEX =
  /(token|secret|password|credential|service_role|gemini_api|bank_statement|financial_transaction|extracto|cuenta_bancaria)/i;

export function isForbiddenFinancialOrSecretKey(key: string): boolean {
  return FORBIDDEN_SYNC_KEY_REGEX.test(key || "");
}

export function isDemoSyncRecord(record: Pick<SyncRecordEnvelope, "clientId" | "isDemo" | "dataOrigin">): boolean {
  if (record.isDemo === true) return true;
  if (record.dataOrigin === "demo_template") return true;
  const id = String(record.clientId || "").toLowerCase();
  return id.startsWith("demo-") || id.startsWith("template-") || id.startsWith("seed-");
}

export function computePayloadHash(payload: Record<string, unknown>): string {
  const keys = Object.keys(payload).sort();
  const normalized: Record<string, unknown> = {};
  for (const k of keys) normalized[k] = payload[k];
  return crypto.createHash("sha256").update(JSON.stringify(normalized)).digest("hex").slice(0, 16);
}

export function computeBackoffMs(attempt: number, baseMs = 1000, maxMs = 30000): number {
  const safeAttempt = Math.max(0, Math.min(10, Math.floor(attempt)));
  return Math.min(maxMs, baseMs * 2 ** safeAttempt);
}

/**
 * Reconcilia registros locales y remotos de dos dispositivos sin pérdida de datos:
 * - Bloquea mezcla entre usuarios distintos.
 * - Excluye registros demo.
 * - Si remoto está vacío, conserva todo lo local y lo marca `toPush`.
 * - Si ambos editaron la misma versión (o divergen con contenido distinto), reporta conflicto explícito.
 */
export function reconcileSyncRecords<T extends Record<string, unknown>>(params: {
  authenticatedUserId: string;
  localOwnerId: string;
  localRecords: SyncRecordEnvelope<T>[];
  remoteRecords: SyncRecordEnvelope<T>[];
  isOnline?: boolean;
}): SyncReconciliationResult<T> {
  if (!params.authenticatedUserId || params.localOwnerId !== params.authenticatedUserId) {
    throw new Error("Aislamiento violado: los registros locales pertenecen a otra cuenta y no pueden sincronizarse.");
  }

  let excludedDemoCount = 0;
  const localByClient = new Map<string, SyncRecordEnvelope<T>>();
  for (const rec of params.localRecords) {
    if (rec.ownerId && rec.ownerId !== params.authenticatedUserId) continue;
    if (isDemoSyncRecord(rec)) {
      excludedDemoCount += 1;
      continue;
    }
    localByClient.set(rec.clientId, rec);
  }

  const remoteByClient = new Map<string, SyncRecordEnvelope<T>>();
  for (const rec of params.remoteRecords) {
    if (rec.ownerId && rec.ownerId !== params.authenticatedUserId) continue;
    if (isDemoSyncRecord(rec)) continue;
    remoteByClient.set(rec.clientId, rec);
  }

  const merged: SyncRecordEnvelope<T>[] = [];
  const toPush: SyncRecordEnvelope<T>[] = [];
  const toPull: SyncRecordEnvelope<T>[] = [];
  const conflicts: SyncConflict<T>[] = [];

  const allKeys = new Set<string>([...localByClient.keys(), ...remoteByClient.keys()]);

  for (const key of allKeys) {
    const local = localByClient.get(key);
    const remote = remoteByClient.get(key);

    if (local && !remote) {
      toPush.push(local);
      merged.push(local);
      continue;
    }

    if (!local && remote) {
      toPull.push(remote);
      merged.push(remote);
      continue;
    }

    if (local && remote) {
      const localHash = computePayloadHash(local.payload);
      const remoteHash = computePayloadHash(remote.payload);
      const sameDeletion = Boolean(local.deletedAt) === Boolean(remote.deletedAt);

      if (localHash === remoteHash && sameDeletion) {
        // Contenido idéntico: converger a la versión más alta sin duplicar
        merged.push(remote.version >= local.version ? remote : local);
        continue;
      }

      if (local.version > remote.version) {
        toPush.push(local);
        merged.push(local);
        continue;
      }

      if (remote.version > local.version && local.dataOrigin === "real_synced") {
        // El remoto avanzó y el local no tenía ediciones pendientes
        toPull.push(remote);
        merged.push(remote);
        continue;
      }

      // Edición concurrente / versiones divergentes con contenido diferente -> conflicto explícito
      conflicts.push({
        clientId: key,
        domain: local.domain,
        localRecord: local,
        remoteRecord: remote,
        reason: `Edición concurrente detectada (local v${local.version} vs remoto v${remote.version}). Requiere revisión guiada.`,
        resolutionOptions: ["keep_local", "keep_remote", "keep_both"],
      });
      merged.push(local);
    }
  }

  let status: SyncStatusLabel = "SINCRONIZADO";
  if (params.isOnline === false) {
    status = "SIN_CONEXION";
  } else if (conflicts.length > 0) {
    status = "CONFLICTO_REQUIERE_REVISION";
  } else if (toPush.length > 0) {
    status = "PENDIENTE_DE_SINCRONIZAR";
  }

  return {
    merged,
    toPush,
    toPull,
    conflicts,
    excludedDemoCount,
    status,
  };
}

export function resolveSyncConflict<T extends Record<string, unknown>>(
  conflict: SyncConflict<T>,
  strategy: "keep_local" | "keep_remote" | "keep_both"
): SyncRecordEnvelope<T>[] {
  const nextVersion = Math.max(conflict.localRecord.version, conflict.remoteRecord.version) + 1;
  const nowIso = new Date().toISOString();

  if (strategy === "keep_remote") {
    return [{ ...conflict.remoteRecord, dataOrigin: "real_synced" }];
  }

  if (strategy === "keep_local") {
    return [
      {
        ...conflict.localRecord,
        version: nextVersion,
        updatedAt: nowIso,
        dataOrigin: "real_local",
      },
    ];
  }

  // keep_both: preserva el remoto y crea copia local con nuevo clientId estable sin sobrescribir
  const copyClientId = `${conflict.localRecord.clientId}-copy-${Date.now().toString(36)}`;
  return [
    { ...conflict.remoteRecord, dataOrigin: "real_synced" },
    {
      ...conflict.localRecord,
      clientId: copyClientId,
      remoteId: undefined,
      version: 1,
      updatedAt: nowIso,
      dataOrigin: "real_local",
    },
  ];
}

export function getOfflineSyncQueueStorageKey(ownerId: string): string {
  return `oakhaven_sync_queue_v1_${encodeURIComponent(ownerId)}`;
}

export function safeParseOfflineQueue(raw: string | null, expectedOwnerId: string): OfflineSyncQueueItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is OfflineSyncQueueItem =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof item.idempotencyKey === "string" &&
        item.ownerId === expectedOwnerId &&
        Boolean(item.record) &&
        !isDemoSyncRecord(item.record)
    );
  } catch {
    // Manejo seguro de datos corruptos: no rompe la aplicación
    return [];
  }
}

export function enqueueOfflineSyncItem(
  queue: OfflineSyncQueueItem[],
  item: Omit<OfflineSyncQueueItem, "idempotencyKey" | "attempts" | "enqueuedAt">
): OfflineSyncQueueItem[] {
  if (isDemoSyncRecord(item.record)) return queue;
  const key = crypto
    .createHash("sha256")
    .update(`${item.ownerId}:${item.domain}:${item.record.clientId}:v${item.record.version}`)
    .digest("hex")
    .slice(0, 20);
  if (queue.some((q) => q.idempotencyKey === key)) {
    return queue; // Idempotencia: evita doble envío
  }
  return [
    ...queue,
    {
      ...item,
      idempotencyKey: key,
      attempts: 0,
      enqueuedAt: new Date().toISOString(),
    },
  ];
}
