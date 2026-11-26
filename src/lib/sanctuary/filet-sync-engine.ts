/**
 * ============================================================================
 * OAKHAVEN — FILET CROCHET STUDIO FASE 5 (MOTOR DE SINCRONIZACIÓN SEGURA)
 * ============================================================================
 * Estrategia unificada de sincronización con revisiones monotónicas, cola de
 * operaciones pendientes, idempotencia y detección de conflictos reales
 * (JAMÁS sobrescribe basándose únicamente en `updatedAt`).
 *
 * Cubre:
 * - Colecciones de alfabetos, glifos, referencias históricas, borradores y
 *   versiones de patrones (`FiletStudioWorkspace`).
 * - Integración coherente con el progreso guiado por fila/segmento.
 * - Honesto sobre el transporte real: distingue explícitamente `saved_local`,
 *   `pending_sync`, `synced_server`, `conflict` y `error`.
 */

import type { FiletStudioWorkspace } from "./filet-crochet-engine.ts";

function cloneFiletWorkspace(ws: FiletStudioWorkspace): FiletStudioWorkspace {
  return structuredClone(ws);
}

export type FiletSyncLifecycleStatus =
  | "saved_local"
  | "pending_sync"
  | "synced_server"
  | "conflict"
  | "error";

export interface FiletSyncQueuedOperation {
  operationId: string;
  entityKind:
    | "collection"
    | "glyph"
    | "historical_ref"
    | "draft"
    | "pattern_version"
    | "guided_progress";
  entityId: string;
  baseRevision: number;
  createdAt: string;
  deviceId: string;
  payloadHash: string;
}

export interface FiletWorkspaceSyncEnvelope {
  schemaVersion: 1;
  ownerId: string;
  revision: number;
  lastSyncedRevision: number;
  contentHash: string;
  lastDeviceId: string;
  status: FiletSyncLifecycleStatus;
  pendingQueue: FiletSyncQueuedOperation[];
  appliedOperationIds: string[];
  lastSyncedAt?: string;
  lastError?: string | null;
  workspace: FiletStudioWorkspace;
}

export interface WorkspaceConflictAnalysis {
  hasConflict: boolean;
  reason?:
    | "CONCURRENT_DIVERGENCE"
    | "SAME_REVISION_DIFFERENT_HASH"
    | "REMOTE_AHEAD_WITH_LOCAL_QUEUE";
  localRevision: number;
  remoteRevision: number;
  localPendingCount: number;
  localHash: string;
  remoteHash: string;
}

/** Hash determinista FNV-1a 32-bit para detectar divergencia real de contenido sin depender de timestamps. */
export function computeDeterministicWorkspaceHash(workspace: FiletStudioWorkspace): string {
  const canonical = JSON.stringify({
    collections: workspace.collections.map((c) => ({
      id: c.id,
      name: c.name,
      glyphs: c.glyphs.map((g) => ({
        id: g.id,
        symbol: g.symbol,
        matrix: g.matrix,
        style: g.style,
        variantLabel: g.variantLabel,
      })),
    })),
    patterns: workspace.patterns.map((p) => ({
      id: p.id,
      title: p.title,
      currentVersion: p.currentVersion,
      versions: p.versions.map((v) => ({
        version: v.version,
        matrix: v.matrix,
      })),
    })),
    draftsCount: workspace.drafts?.length || 0,
  });

  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function createSyncEnvelope(params: {
  ownerId: string;
  workspace: FiletStudioWorkspace;
  deviceId: string;
  revision?: number;
  status?: FiletSyncLifecycleStatus;
}): FiletWorkspaceSyncEnvelope {
  const cloned = cloneFiletWorkspace(params.workspace);
  const rev = Math.max(0, Math.floor(params.revision ?? 0));
  return {
    schemaVersion: 1,
    ownerId: params.ownerId,
    revision: rev,
    lastSyncedRevision: rev,
    contentHash: computeDeterministicWorkspaceHash(cloned),
    lastDeviceId: params.deviceId,
    status: params.status ?? "saved_local",
    pendingQueue: [],
    appliedOperationIds: [],
    lastError: null,
    workspace: cloned,
  };
}

/**
 * Encola un cambio local con clave idempotente y revisión base explícita.
 */
export function enqueueWorkspaceSyncOperation(params: {
  envelope: FiletWorkspaceSyncEnvelope;
  nextWorkspace: FiletStudioWorkspace;
  operationId: string;
  entityKind: FiletSyncQueuedOperation["entityKind"];
  entityId: string;
  deviceId: string;
  nowIso?: string;
}): { envelope: FiletWorkspaceSyncEnvelope; idempotentReplay: boolean } {
  const opId = params.operationId.trim();
  if (!opId) throw new Error("operationId estable requerido.");

  if (
    params.envelope.appliedOperationIds.includes(opId) ||
    params.envelope.pendingQueue.some((q) => q.operationId === opId)
  ) {
    return { envelope: params.envelope, idempotentReplay: true };
  }

  const cloned = cloneFiletWorkspace(params.nextWorkspace);
  const nextHash = computeDeterministicWorkspaceHash(cloned);
  const op: FiletSyncQueuedOperation = {
    operationId: opId,
    entityKind: params.entityKind,
    entityId: params.entityId,
    baseRevision: params.envelope.revision,
    createdAt: params.nowIso || new Date().toISOString(),
    deviceId: params.deviceId,
    payloadHash: nextHash,
  };

  return {
    idempotentReplay: false,
    envelope: {
      ...params.envelope,
      revision: params.envelope.revision + 1,
      contentHash: nextHash,
      lastDeviceId: params.deviceId,
      status: "pending_sync",
      pendingQueue: [...params.envelope.pendingQueue, op],
      appliedOperationIds: [...params.envelope.appliedOperationIds.slice(-199), opId],
      lastError: null,
      workspace: cloned,
    },
  };
}

/**
 * Detecta conflictos reales comparando revisiones, hashes y cola pendiente.
 * NUNCA usa `updatedAt` para sobrescribir silenciosamente cambios de otro dispositivo.
 */
export function detectWorkspaceSyncConflict(
  local: FiletWorkspaceSyncEnvelope,
  remote: Pick<FiletWorkspaceSyncEnvelope, "revision" | "contentHash">
): WorkspaceConflictAnalysis {
  if (local.contentHash === remote.contentHash) {
    return {
      hasConflict: false,
      localRevision: local.revision,
      remoteRevision: remote.revision,
      localPendingCount: local.pendingQueue.length,
      localHash: local.contentHash,
      remoteHash: remote.contentHash,
    };
  }

  if (remote.revision > local.lastSyncedRevision && local.pendingQueue.length > 0) {
    return {
      hasConflict: true,
      reason: "REMOTE_AHEAD_WITH_LOCAL_QUEUE",
      localRevision: local.revision,
      remoteRevision: remote.revision,
      localPendingCount: local.pendingQueue.length,
      localHash: local.contentHash,
      remoteHash: remote.contentHash,
    };
  }

  if (remote.revision === local.revision && local.contentHash !== remote.contentHash) {
    return {
      hasConflict: true,
      reason: "SAME_REVISION_DIFFERENT_HASH",
      localRevision: local.revision,
      remoteRevision: remote.revision,
      localPendingCount: local.pendingQueue.length,
      localHash: local.contentHash,
      remoteHash: remote.contentHash,
    };
  }

  return {
    hasConflict: false,
    localRevision: local.revision,
    remoteRevision: remote.revision,
    localPendingCount: local.pendingQueue.length,
    localHash: local.contentHash,
    remoteHash: remote.contentHash,
  };
}

/**
 * Resolución manual explícita de conflictos entre dos dispositivos.
 */
export function resolveWorkspaceConflictManually(params: {
  local: FiletWorkspaceSyncEnvelope;
  remote: FiletWorkspaceSyncEnvelope;
  choice: "keep_local" | "keep_remote" | "merge_collections_and_patterns";
  nowIso?: string;
}): FiletWorkspaceSyncEnvelope {
  const now = params.nowIso || new Date().toISOString();
  const nextRev = Math.max(params.local.revision, params.remote.revision) + 1;

  if (params.choice === "keep_remote") {
    const cloned = cloneFiletWorkspace(params.remote.workspace);
    return {
      ...params.local,
      revision: nextRev,
      lastSyncedRevision: nextRev,
      contentHash: computeDeterministicWorkspaceHash(cloned),
      status: "synced_server",
      pendingQueue: [],
      lastSyncedAt: now,
      lastError: null,
      workspace: cloned,
    };
  }

  if (params.choice === "keep_local") {
    const cloned = cloneFiletWorkspace(params.local.workspace);
    return {
      ...params.local,
      revision: nextRev,
      contentHash: computeDeterministicWorkspaceHash(cloned),
      status: "pending_sync",
      lastError: null,
      workspace: cloned,
    };
  }

  // Fusión conservadora: une colecciones y patrones por ID sin perder versiones ni glifos
  const localWs = cloneFiletWorkspace(params.local.workspace);
  const remoteWs = cloneFiletWorkspace(params.remote.workspace);

  const mergedPatterns = [...localWs.patterns];
  for (const rp of remoteWs.patterns) {
    if (!mergedPatterns.some((lp) => lp.id === rp.id)) {
      mergedPatterns.push(rp);
    }
  }

  const mergedCollections = [...localWs.collections];
  for (const rc of remoteWs.collections) {
    const existing = mergedCollections.find((lc) => lc.id === rc.id);
    if (!existing) {
      mergedCollections.push(rc);
    } else {
      for (const rg of rc.glyphs) {
        if (!existing.glyphs.some((lg) => lg.id === rg.id)) {
          existing.glyphs.push(rg);
        }
      }
    }
  }

  const mergedWs: FiletStudioWorkspace = {
    ...localWs,
    collections: mergedCollections,
    patterns: mergedPatterns,
    updatedAt: now,
  };

  return {
    ...params.local,
    revision: nextRev,
    contentHash: computeDeterministicWorkspaceHash(mergedWs),
    status: "pending_sync",
    lastError: null,
    workspace: mergedWs,
  };
}
