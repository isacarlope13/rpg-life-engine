/**
 * ============================================================================
 * OAKHAVEN — FILET CROCHET STUDIO FASE 4 (PERSISTENCIA Y RECUPERACIÓN GUIADA)
 * ============================================================================
 * Almacenamiento privado aislado por propietario para el progreso de tejido
 * guiado, cola de operaciones idempotentes, detección de conflictos y
 * sincronización segura con `/api/shortcuts/skill-session`.
 *
 * Nunca afirma sincronización multidispositivo en tiempo real si únicamente
 * existe respaldo local o envío manual.
 */

import { isOfflineOwner } from "../offline-owner.ts";
import { safeLocalStorage } from "../storage-safe.ts";
import {
  cloneGuidedProgressState,
  computePendingUnsyncedRows,
  detectGuidedProgressConflict,
  markGuidedRowsSyncedToServer,
  markGuidedSyncError,
  validateLinkedFiletPatternSnapshot,
  type FiletGuidedProgressState,
  type GuidedConflictReport,
} from "./filet-guided-engine.ts";

export interface GuidedStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const FILET_GUIDED_STORAGE_PREFIX = "oakhaven_atelier_filet_guided_v1_";
const FILET_DEVICE_ID_KEY = "oakhaven_atelier_filet_device_id_v1";

export type GuidedProgressStoreMap = Record<string, FiletGuidedProgressState>;

export function getFiletGuidedStorageKey(ownerId?: string): string | null {
  if (!isOfflineOwner(ownerId)) return null;
  return `${FILET_GUIDED_STORAGE_PREFIX}${encodeURIComponent(ownerId)}`;
}

export function getOrCreateLocalDeviceId(storage?: GuidedStorageLike): string {
  const store = storage || safeLocalStorage;
  try {
    const existing = store.getItem(FILET_DEVICE_ID_KEY);
    if (existing && existing.trim().length >= 4) return existing.trim();
    const created = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    store.setItem(FILET_DEVICE_ID_KEY, created);
    return created;
  } catch {
    return "dev-ephemeral";
  }
}

export function isValidGuidedProgressState(
  raw: unknown,
  expectedOwnerId?: string
): raw is FiletGuidedProgressState {
  if (!raw || typeof raw !== "object") return false;
  const s = raw as Partial<FiletGuidedProgressState>;
  if (s.schemaVersion !== 1) return false;
  if (!s.ownerId || typeof s.ownerId !== "string") return false;
  if (expectedOwnerId && s.ownerId !== expectedOwnerId) return false;
  if (!s.projectId || typeof s.projectId !== "string") return false;
  if (!s.patternVersionId || typeof s.patternVersionId !== "string") return false;
  if (!Array.isArray(s.confirmedRows) || !Array.isArray(s.completedSegmentIndices)) return false;
  if (!Array.isArray(s.operationIds) || typeof s.revision !== "number") return false;
  const snap = validateLinkedFiletPatternSnapshot(s.snapshot);
  return snap.valid;
}

export function readAllGuidedProgress(
  storage: GuidedStorageLike,
  ownerId?: string
): GuidedProgressStoreMap {
  const key = getFiletGuidedStorageKey(ownerId);
  if (!key || !ownerId) return {};
  try {
    const raw = storage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    const validMap: GuidedProgressStoreMap = {};
    for (const [projId, val] of Object.entries(parsed)) {
      if (isValidGuidedProgressState(val, ownerId) && val.projectId === projId) {
        validMap[projId] = cloneGuidedProgressState(val);
      }
    }
    return validMap;
  } catch {
    return {};
  }
}

export function readGuidedProgressForProject(
  storage: GuidedStorageLike,
  ownerId: string | undefined,
  projectId: string
): FiletGuidedProgressState | null {
  if (!projectId) return null;
  const all = readAllGuidedProgress(storage, ownerId);
  return all[projectId] ? cloneGuidedProgressState(all[projectId]) : null;
}

export function saveGuidedProgressForProject(
  storage: GuidedStorageLike,
  ownerId: string | undefined,
  state: FiletGuidedProgressState
): { ok: boolean; error?: string } {
  const key = getFiletGuidedStorageKey(ownerId);
  if (!key || !ownerId) {
    return { ok: false, error: "Identidad de usuario requerida para persistir progreso guiado." };
  }
  if (state.ownerId !== ownerId) {
    return { ok: false, error: "Aislamiento de propietario: ownerId no coincide." };
  }
  try {
    const all = readAllGuidedProgress(storage, ownerId);
    all[state.projectId] = cloneGuidedProgressState(state);
    storage.setItem(key, JSON.stringify(all));
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo guardar localmente (cuota o almacenamiento bloqueado)." };
  }
}

export function readGuidedProgressSafe(
  ownerId: string | undefined,
  projectId: string
): FiletGuidedProgressState | null {
  return readGuidedProgressForProject(safeLocalStorage, ownerId, projectId);
}

export function saveGuidedProgressSafe(
  ownerId: string | undefined,
  state: FiletGuidedProgressState
): { ok: boolean; error?: string } {
  return saveGuidedProgressForProject(safeLocalStorage, ownerId, state);
}

export function readAllGuidedProgressSafe(ownerId?: string): GuidedProgressStoreMap {
  return readAllGuidedProgress(safeLocalStorage, ownerId);
}

/**
 * Construye el payload canónico idempotente para sincronizar vueltas confirmadas
 * pendientes hacia `/api/shortcuts/skill-session` sin duplicar recompensas ni vueltas.
 */
export function buildGuidedRowsSyncPayload(params: {
  state: FiletGuidedProgressState;
  durationMinutes?: number;
  notes?: string;
}): {
  hasPendingRows: boolean;
  pendingRows: number[];
  idempotencyKey: string;
  payload: Record<string, unknown> | null;
} {
  const pendingRows = computePendingUnsyncedRows(params.state);
  if (pendingRows.length === 0) {
    return {
      hasPendingRows: false,
      pendingRows: [],
      idempotencyKey: "",
      payload: null,
    };
  }

  // Clave idempotente determinista basada en proyecto + versión + filas exactas
  const rowsSig = pendingRows.join("-");
  const idempotencyKey = `filet-guided-${params.state.projectId}-${params.state.patternVersionId}-rows-${rowsSig}`;

  return {
    hasPendingRows: true,
    pendingRows,
    idempotencyKey,
    payload: {
      domain: "knitting",
      project_id: params.state.projectId,
      title: `Tejido guiado (${params.state.snapshot.pattern_name} v${params.state.patternVersionNumber})`,
      duration_minutes: Math.max(1, Math.round(params.durationMinutes ?? pendingRows.length)),
      rows_completed: pendingRows.length,
      stitches_notes:
        params.notes?.trim() ||
        `Vueltas confirmadas (${pendingRows.join(", ")}) en patrón Filet v${params.state.patternVersionNumber}`,
      idempotency_key: idempotencyKey,
    },
  };
}

/**
 * Ejecuta la sincronización de vueltas pendientes usando un transporte inyectable
 * (compatible con fetch en navegador y dobles de prueba de red/fallo).
 */
export async function syncPendingGuidedRows(params: {
  state: FiletGuidedProgressState;
  storage: GuidedStorageLike;
  ownerId?: string;
  durationMinutes?: number;
  notes?: string;
  submitter: (payload: Record<string, unknown>) => Promise<unknown>;
  nowIso?: string;
}): Promise<{
  ok: boolean;
  state: FiletGuidedProgressState;
  syncedRowsCount: number;
  error?: string;
}> {
  const built = buildGuidedRowsSyncPayload({
    state: params.state,
    durationMinutes: params.durationMinutes,
    notes: params.notes,
  });

  if (!built.hasPendingRows || !built.payload) {
    return {
      ok: true,
      state: params.state,
      syncedRowsCount: 0,
    };
  }

  try {
    await params.submitter(built.payload);
    const syncedState = markGuidedRowsSyncedToServer(
      params.state,
      built.pendingRows,
      params.nowIso
    );
    saveGuidedProgressForProject(params.storage, params.ownerId, syncedState);
    return {
      ok: true,
      state: syncedState,
      syncedRowsCount: built.pendingRows.length,
    };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Error de red al sincronizar; el progreso local permanece intacto.";
    const errorState = markGuidedSyncError(params.state, message, params.nowIso);
    saveGuidedProgressForProject(params.storage, params.ownerId, errorState);
    return {
      ok: false,
      state: errorState,
      syncedRowsCount: 0,
      error: message,
    };
  }
}

export function evaluateGuidedSyncConflict(
  localState: FiletGuidedProgressState,
  remoteState: FiletGuidedProgressState
): GuidedConflictReport {
  return detectGuidedProgressConflict(localState, remoteState);
}
