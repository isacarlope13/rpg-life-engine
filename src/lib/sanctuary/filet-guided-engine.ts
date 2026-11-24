/**
 * ============================================================================
 * OAKHAVEN — FILET CROCHET STUDIO FASE 4 (MOTOR DETERMINISTA DE PROGRESO GUIADO)
 * ============================================================================
 * Motor puro independiente de la interfaz para sesiones de tejido guiadas
 * vinculadas a versiones inmutables de patrones Filet Crochet.
 *
 * Reglas invariantes garantizadas:
 *  1. Completar un segmento jamás incrementa el contador de vueltas.
 *  2. Confirmar una fila exige completar todos sus segmentos.
 *  3. Cada fila confirmada incrementa exactamente una vez el contador.
 *  4. Repetir una solicitud (mismo operationId o misma fila) es idempotente (delta = 0).
 *  5. Dos dispositivos no pueden confirmar dos veces la misma fila.
 *  6. Pausar o reanudar no altera el contador ni los segmentos completados.
 *  7. Recuperar una sesión no genera recompensas ni deltas duplicados.
 *  8. Finalizar una sesión no vuelve a sumar filas previamente confirmadas.
 *  9. El progreso está estrictamente vinculado a una versión inmutable del patrón.
 * 10. Retroceder respeta las invariantes del contador (nunca negativo, nunca inconsistente).
 */

import type { KnittingProject, LinkedFiletPatternSnapshot } from "../../types/rpg.ts";
import {
  cloneBinaryMatrix,
  compileFiletTechnicalPattern,
  createFiletTechnicalConvention,
  validateBinaryMatrix,
  type BinaryMatrix,
  type FiletCompiledRun,
  type FiletMeshSize,
  type FiletPatternVersion,
  type FiletRowDirection,
  type FiletTechnicalConvention,
  type FiletTechnicalPatternPlan,
  type FiletTechnicalRowPlan,
} from "./filet-crochet-engine.ts";

export type FiletGuidedSyncState =
  | "saved_local"
  | "pending_sync"
  | "synced_server"
  | "conflict"
  | "error";

export type FiletGuidedSessionStatus = "idle" | "running" | "paused" | "completed";

export type FiletGuidedOrientation = "bottom_to_top" | "top_to_bottom";

export interface FiletGuidedOperationRecord {
  operationId: string;
  type: "confirm_row" | "undo_row";
  rowNumber: number;
  patternVersionId: string;
  deviceId: string;
  createdAt: string;
  baseRevision: number;
  appliedRevision: number;
}

export interface FiletGuidedProgressState {
  schemaVersion: 1;
  ownerId: string;
  projectId: string;
  projectName: string;
  patternId: string;
  patternVersionId: string;
  patternVersionNumber: number;
  snapshot: LinkedFiletPatternSnapshot;
  totalRows: number;
  /** Fila activa 1..totalRows en orden de tejido (1 = primera fila a tejer). */
  activeRowNumber: number;
  /** Índice del segmento activo dentro de la fila activa (0..segments.length-1). */
  activeSegmentIndex: number;
  /** Índices de segmentos completados en la fila activa actual (únicos, ordenados). */
  completedSegmentIndices: number[];
  /** Filas confirmadas definitivamente (números 1..totalRows, únicos y ordenados). */
  confirmedRows: number[];
  /** Filas ya confirmadas/acreditadas en servidor para evitar doble conteo al finalizar sesión. */
  syncedConfirmedRows: number[];
  sessionStatus: FiletGuidedSessionStatus;
  /** Registro de claves de operación aplicadas para idempotencia estricta. */
  operationIds: string[];
  operationsLog: FiletGuidedOperationRecord[];
  /** Revisión monotónica para detección de conflictos entre dispositivos. */
  revision: number;
  lastDeviceId: string;
  syncState: FiletGuidedSyncState;
  lastError?: string | null;
  updatedAt: string;
}

export interface GuidedStepMutationResult {
  ok: boolean;
  state: FiletGuidedProgressState;
  idempotentReplay: boolean;
  deltaCompletedRows: number;
  reason?:
    | "INCOMPLETE_SEGMENTS"
    | "INVALID_ROW"
    | "PATTERN_VERSION_MISMATCH"
    | "NOTHING_TO_UNDO"
    | "PROJECT_ALREADY_COMPLETED"
    | "REVISION_CONFLICT";
  conflictDetail?: {
    expectedRevision: number;
    currentRevision: number;
  };
}

export interface GuidedActiveRowView {
  rowNumber: number;
  totalRows: number;
  matrixRowIndex: number;
  direction: FiletRowDirection;
  segments: FiletCompiledRun[];
  activeSegmentIndex: number;
  activeSegment: FiletCompiledRun | null;
  nextSegment: FiletCompiledRun | null;
  completedSegmentIndices: number[];
  allSegmentsCompleted: boolean;
  remainingSegmentsCount: number;
  remainingCellsInRow: number;
  totalCellsInRow: number;
  rowInstructionText: string;
  isRowConfirmed: boolean;
}

export interface GuidedProgressSummary {
  projectId: string;
  projectName: string;
  patternName: string;
  patternVersionNumber: number;
  gridWidth: number;
  gridHeight: number;
  meshSize: FiletMeshSize;
  activeRowNumber: number;
  totalRows: number;
  confirmedRowsCount: number;
  pendingUnsyncedRowsCount: number;
  progressPercent: number;
  remainingRowsCount: number;
  sessionStatus: FiletGuidedSessionStatus;
  syncState: FiletGuidedSyncState;
  activeRowView: GuidedActiveRowView | null;
}

export interface GuidedConflictReport {
  hasConflict: boolean;
  reason?: "REVISION_DIVERGENCE" | "VERSION_MISMATCH" | "CONFIRMED_ROWS_DIVERGENCE";
  localRevision: number;
  remoteRevision: number;
  localConfirmedCount: number;
  remoteConfirmedCount: number;
}

// ============================================================================
// BLOQUE 1 — CREACIÓN DE SNAPSHOT INMUTABLE PARA PROYECTO DE TEJIDO
// ============================================================================

export function buildLinkedFiletPatternSnapshot(params: {
  patternId: string;
  patternName: string;
  version: FiletPatternVersion;
  convention: FiletTechnicalConvention;
  orientation?: FiletGuidedOrientation;
  createdAt?: string;
}): LinkedFiletPatternSnapshot {
  const validated = validateBinaryMatrix(params.version.matrix);
  if (!validated.valid) {
    throw new Error(`La versión del patrón no contiene una matriz válida: ${validated.errors.join("; ")}`);
  }
  const frozenMatrix = cloneBinaryMatrix(params.version.matrix);
  const gridHeight = frozenMatrix.length;
  const gridWidth = frozenMatrix[0]?.length || 0;

  return {
    pattern_id: params.patternId,
    pattern_name: (params.patternName || "Patrón Filet").trim(),
    version_id: `${params.patternId}-v${params.version.version}`,
    version_number: params.version.version,
    matrix: frozenMatrix,
    grid_width: gridWidth,
    grid_height: gridHeight,
    technique: "Filet Crochet",
    mesh_size: params.convention.meshSize,
    orientation: params.orientation ?? "bottom_to_top",
    first_row_direction: params.convention.firstRowDirection,
    total_rows: gridHeight,
    created_at: params.createdAt || params.version.createdAt || new Date().toISOString(),
  };
}

export function cloneLinkedFiletPatternSnapshot(
  snapshot: LinkedFiletPatternSnapshot
): LinkedFiletPatternSnapshot {
  return {
    ...snapshot,
    matrix: cloneBinaryMatrix(snapshot.matrix as BinaryMatrix),
  };
}

export function validateLinkedFiletPatternSnapshot(
  raw: unknown
): { valid: true; snapshot: LinkedFiletPatternSnapshot } | { valid: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { valid: false, error: "Snapshot de patrón Filet ausente o inválido." };
  }
  const s = raw as Partial<LinkedFiletPatternSnapshot>;
  if (!s.pattern_id || typeof s.pattern_id !== "string") {
    return { valid: false, error: "pattern_id es obligatorio." };
  }
  if (!s.version_id || typeof s.version_id !== "string") {
    return { valid: false, error: "version_id inmutable es obligatorio." };
  }
  if (typeof s.version_number !== "number" || !Number.isInteger(s.version_number) || s.version_number < 1) {
    return { valid: false, error: "version_number debe ser un entero positivo." };
  }
  if (s.mesh_size !== 3 && s.mesh_size !== 4) {
    return { valid: false, error: "mesh_size debe ser 3 o 4." };
  }
  if (s.first_row_direction !== "rtl" && s.first_row_direction !== "ltr") {
    return { valid: false, error: "first_row_direction debe ser 'rtl' o 'ltr'." };
  }
  const orientation: FiletGuidedOrientation =
    s.orientation === "top_to_bottom" ? "top_to_bottom" : "bottom_to_top";
  const check = validateBinaryMatrix(s.matrix as BinaryMatrix);
  if (!check.valid) {
    return { valid: false, error: check.errors.join("; ") || "Matriz binaria inválida." };
  }
  const matrix = cloneBinaryMatrix(s.matrix as BinaryMatrix);
  const gridHeight = matrix.length;
  const gridWidth = matrix[0]?.length || 0;

  return {
    valid: true,
    snapshot: {
      pattern_id: s.pattern_id.trim(),
      pattern_name: (s.pattern_name || "Patrón Filet").trim(),
      version_id: s.version_id.trim(),
      version_number: s.version_number,
      matrix,
      grid_width: gridWidth,
      grid_height: gridHeight,
      technique: "Filet Crochet",
      mesh_size: s.mesh_size,
      orientation,
      first_row_direction: s.first_row_direction,
      total_rows: gridHeight,
      created_at: s.created_at || new Date().toISOString(),
    },
  };
}

// ============================================================================
// COMPILACIÓN TÉCNICA DE FILAS PARA LA MESA GUIADA
// ============================================================================

export function compileGuidedTechnicalPattern(
  snapshot: LinkedFiletPatternSnapshot
): FiletTechnicalPatternPlan {
  const sourceMatrix =
    snapshot.orientation === "top_to_bottom"
      ? [...snapshot.matrix].reverse()
      : snapshot.matrix;
  const convention = createFiletTechnicalConvention(
    snapshot.mesh_size,
    snapshot.first_row_direction
  );
  return compileFiletTechnicalPattern(sourceMatrix as BinaryMatrix, convention);
}

export function getGuidedRowInstruction(
  snapshot: LinkedFiletPatternSnapshot,
  rowNumber: number
): FiletTechnicalRowPlan | null {
  const technical = compileGuidedTechnicalPattern(snapshot);
  return technical.rows.find((r) => r.rowNumber === rowNumber) || null;
}

export function getMatrixRowIndexForGuidedRow(
  snapshot: LinkedFiletPatternSnapshot,
  rowNumber: number
): number {
  const clamped = Math.max(1, Math.min(snapshot.total_rows, Math.floor(rowNumber)));
  if (snapshot.orientation === "top_to_bottom") {
    return clamped - 1;
  }
  return snapshot.total_rows - clamped;
}

// ============================================================================
// BLOQUE 2 — INICIALIZACIÓN Y MUTACIONES DETERMINISTAS
// ============================================================================

function uniqueSortedNumbers(values: number[], minVal = 0, maxVal = Number.MAX_SAFE_INTEGER): number[] {
  const set = new Set<number>();
  for (const v of values) {
    if (Number.isInteger(v) && v >= minVal && v <= maxVal) {
      set.add(v);
    }
  }
  return Array.from(set).sort((a, b) => a - b);
}

function findNextUnconfirmedRow(totalRows: number, confirmedRows: number[]): number {
  const confirmed = new Set(confirmedRows);
  for (let r = 1; r <= totalRows; r++) {
    if (!confirmed.has(r)) return r;
  }
  return totalRows;
}

export function createInitialGuidedProgressState(params: {
  ownerId: string;
  project: KnittingProject;
  deviceId?: string;
  nowIso?: string;
}): FiletGuidedProgressState {
  if (!params.project.linked_filet_pattern) {
    throw new Error("El proyecto no tiene una versión inmutable de patrón Filet vinculada.");
  }
  const snapshot = cloneLinkedFiletPatternSnapshot(params.project.linked_filet_pattern);
  const totalRows = snapshot.total_rows;
  const initialConfirmedCount = Math.max(0, Math.min(totalRows, Math.floor(params.project.completed_rows || 0)));
  const initialConfirmedRows = Array.from({ length: initialConfirmedCount }, (_, i) => i + 1);
  const isDone = initialConfirmedCount >= totalRows;
  const now = params.nowIso || new Date().toISOString();

  return {
    schemaVersion: 1,
    ownerId: params.ownerId,
    projectId: params.project.id,
    projectName: params.project.name,
    patternId: snapshot.pattern_id,
    patternVersionId: snapshot.version_id,
    patternVersionNumber: snapshot.version_number,
    snapshot,
    totalRows,
    activeRowNumber: findNextUnconfirmedRow(totalRows, initialConfirmedRows),
    activeSegmentIndex: 0,
    completedSegmentIndices: [],
    confirmedRows: initialConfirmedRows,
    syncedConfirmedRows: [...initialConfirmedRows],
    sessionStatus: isDone ? "completed" : "idle",
    operationIds: [],
    operationsLog: [],
    revision: 0,
    lastDeviceId: params.deviceId || "device-local",
    syncState: "saved_local",
    lastError: null,
    updatedAt: now,
  };
}

export function cloneGuidedProgressState(
  state: FiletGuidedProgressState
): FiletGuidedProgressState {
  return {
    ...state,
    snapshot: cloneLinkedFiletPatternSnapshot(state.snapshot),
    completedSegmentIndices: [...state.completedSegmentIndices],
    confirmedRows: [...state.confirmedRows],
    syncedConfirmedRows: [...state.syncedConfirmedRows],
    operationIds: [...state.operationIds],
    operationsLog: state.operationsLog.map((op) => ({ ...op })),
  };
}

/**
 * Regla 1: Completar un segmento NO incrementa el contador de vueltas.
 */
export function completeActiveSegment(
  state: FiletGuidedProgressState,
  options?: { segmentIndex?: number; expectedVersionId?: string; nowIso?: string }
): GuidedStepMutationResult {
  if (options?.expectedVersionId && options.expectedVersionId !== state.patternVersionId) {
    return {
      ok: false,
      state,
      idempotentReplay: false,
      deltaCompletedRows: 0,
      reason: "PATTERN_VERSION_MISMATCH",
    };
  }
  if (state.confirmedRows.length >= state.totalRows) {
    return {
      ok: false,
      state,
      idempotentReplay: false,
      deltaCompletedRows: 0,
      reason: "PROJECT_ALREADY_COMPLETED",
    };
  }
  const rowInst = getGuidedRowInstruction(state.snapshot, state.activeRowNumber);
  if (!rowInst || rowInst.runs.length === 0) {
    return {
      ok: false,
      state,
      idempotentReplay: false,
      deltaCompletedRows: 0,
      reason: "INVALID_ROW",
    };
  }

  const targetIdx =
    typeof options?.segmentIndex === "number"
      ? Math.max(0, Math.min(rowInst.runs.length - 1, Math.floor(options.segmentIndex)))
      : state.activeSegmentIndex;

  if (state.completedSegmentIndices.includes(targetIdx)) {
    return {
      ok: true,
      state,
      idempotentReplay: true,
      deltaCompletedRows: 0,
    };
  }

  const nextCompleted = uniqueSortedNumbers(
    [...state.completedSegmentIndices, targetIdx],
    0,
    rowInst.runs.length - 1
  );

  // Buscar el siguiente segmento pendiente
  let nextActiveIdx = targetIdx;
  for (let i = targetIdx + 1; i < rowInst.runs.length; i++) {
    if (!nextCompleted.includes(i)) {
      nextActiveIdx = i;
      break;
    }
  }
  if (nextCompleted.includes(nextActiveIdx)) {
    const firstUnfinished = rowInst.runs.findIndex((_, i) => !nextCompleted.includes(i));
    nextActiveIdx = firstUnfinished >= 0 ? firstUnfinished : rowInst.runs.length - 1;
  }

  const next: FiletGuidedProgressState = {
    ...cloneGuidedProgressState(state),
    completedSegmentIndices: nextCompleted,
    activeSegmentIndex: nextActiveIdx,
    syncState: state.syncState === "synced_server" ? "saved_local" : state.syncState,
    updatedAt: options?.nowIso || new Date().toISOString(),
  };

  return {
    ok: true,
    state: next,
    idempotentReplay: false,
    deltaCompletedRows: 0, // Invariante #1: jamás incrementa vueltas
  };
}

/**
 * Reglas 2, 3, 4, 5 y 9:
 * Confirmar la fila activa exige todos sus segmentos completados, incrementa
 * exactamente una vez el contador y es idempotente por operationId y por rowNumber.
 */
export function confirmActiveRow(
  state: FiletGuidedProgressState,
  params: {
    operationId: string;
    deviceId?: string;
    expectedVersionId?: string;
    expectedRevision?: number;
    nowIso?: string;
  }
): GuidedStepMutationResult {
  const opId = (params.operationId || "").trim();
  if (!opId) {
    throw new Error("operationId estable es obligatorio para confirmar una fila.");
  }

  if (params.expectedVersionId && params.expectedVersionId !== state.patternVersionId) {
    return {
      ok: false,
      state,
      idempotentReplay: false,
      deltaCompletedRows: 0,
      reason: "PATTERN_VERSION_MISMATCH",
    };
  }

  // Regla 4: Replay por mismo operationId => idempotente, delta 0
  if (state.operationIds.includes(opId)) {
    return {
      ok: true,
      state,
      idempotentReplay: true,
      deltaCompletedRows: 0,
    };
  }

  // Regla 5: Dos dispositivos no pueden confirmar dos veces la misma fila
  if (state.confirmedRows.includes(state.activeRowNumber)) {
    return {
      ok: true,
      state,
      idempotentReplay: true,
      deltaCompletedRows: 0,
    };
  }

  if (
    typeof params.expectedRevision === "number" &&
    params.expectedRevision !== state.revision
  ) {
    return {
      ok: false,
      state,
      idempotentReplay: false,
      deltaCompletedRows: 0,
      reason: "REVISION_CONFLICT",
      conflictDetail: {
        expectedRevision: params.expectedRevision,
        currentRevision: state.revision,
      },
    };
  }

  const rowInst = getGuidedRowInstruction(state.snapshot, state.activeRowNumber);
  if (!rowInst) {
    return {
      ok: false,
      state,
      idempotentReplay: false,
      deltaCompletedRows: 0,
      reason: "INVALID_ROW",
    };
  }

  // Regla 2: Exige completar TODOS los segmentos de la fila activa
  const allCompleted = rowInst.runs.every((_, idx) =>
    state.completedSegmentIndices.includes(idx)
  );
  if (!allCompleted) {
    return {
      ok: false,
      state,
      idempotentReplay: false,
      deltaCompletedRows: 0,
      reason: "INCOMPLETE_SEGMENTS",
    };
  }

  const now = params.nowIso || new Date().toISOString();
  const nextConfirmed = uniqueSortedNumbers(
    [...state.confirmedRows, state.activeRowNumber],
    1,
    state.totalRows
  );
  const nextRevision = state.revision + 1;
  const projectCompleted = nextConfirmed.length >= state.totalRows;
  const nextRowNumber = projectCompleted
    ? state.totalRows
    : findNextUnconfirmedRow(state.totalRows, nextConfirmed);

  const opRecord: FiletGuidedOperationRecord = {
    operationId: opId,
    type: "confirm_row",
    rowNumber: state.activeRowNumber,
    patternVersionId: state.patternVersionId,
    deviceId: params.deviceId || state.lastDeviceId || "device-local",
    createdAt: now,
    baseRevision: state.revision,
    appliedRevision: nextRevision,
  };

  const next: FiletGuidedProgressState = {
    ...cloneGuidedProgressState(state),
    confirmedRows: nextConfirmed,
    activeRowNumber: nextRowNumber,
    activeSegmentIndex: 0,
    completedSegmentIndices: [],
    sessionStatus: projectCompleted ? "completed" : state.sessionStatus,
    operationIds: [...state.operationIds, opId],
    operationsLog: [...state.operationsLog.slice(-199), opRecord],
    revision: nextRevision,
    lastDeviceId: opRecord.deviceId,
    syncState: "pending_sync",
    lastError: null,
    updatedAt: now,
  };

  return {
    ok: true,
    state: next,
    idempotentReplay: false,
    deltaCompletedRows: 1, // Invariante #3: exactamente +1
  };
}

/**
 * Regla 10: Retroceder segmento o desconfirmar la última fila respetando invariantes del contador.
 */
export function stepBackGuidedProgress(
  state: FiletGuidedProgressState,
  options?: {
    allowUndoConfirmedRow?: boolean;
    operationId?: string;
    deviceId?: string;
    expectedVersionId?: string;
    nowIso?: string;
  }
): GuidedStepMutationResult {
  if (options?.expectedVersionId && options.expectedVersionId !== state.patternVersionId) {
    return {
      ok: false,
      state,
      idempotentReplay: false,
      deltaCompletedRows: 0,
      reason: "PATTERN_VERSION_MISMATCH",
    };
  }

  const now = options?.nowIso || new Date().toISOString();

  // Caso A: hay segmentos completados en la fila activa -> retrocede solo el último segmento (delta 0)
  if (state.completedSegmentIndices.length > 0) {
    const nextCompleted = state.completedSegmentIndices.slice(0, -1);
    const removedIdx = state.completedSegmentIndices[state.completedSegmentIndices.length - 1];
    const next: FiletGuidedProgressState = {
      ...cloneGuidedProgressState(state),
      completedSegmentIndices: nextCompleted,
      activeSegmentIndex: removedIdx,
      updatedAt: now,
    };
    return {
      ok: true,
      state: next,
      idempotentReplay: false,
      deltaCompletedRows: 0,
    };
  }

  // Caso B: retroceder a la última fila confirmada si está habilitado
  if (!options?.allowUndoConfirmedRow || state.confirmedRows.length === 0) {
    return {
      ok: false,
      state,
      idempotentReplay: false,
      deltaCompletedRows: 0,
      reason: "NOTHING_TO_UNDO",
    };
  }

  const opId = (options.operationId || `undo-row-${state.confirmedRows[state.confirmedRows.length - 1]}-r${state.revision}`).trim();
  if (state.operationIds.includes(opId)) {
    return {
      ok: true,
      state,
      idempotentReplay: true,
      deltaCompletedRows: 0,
    };
  }

  const lastConfirmedRow = state.confirmedRows[state.confirmedRows.length - 1];
  const nextConfirmed = state.confirmedRows.slice(0, -1);
  const nextSynced = state.syncedConfirmedRows.filter((r) => r !== lastConfirmedRow);
  const prevRowInst = getGuidedRowInstruction(state.snapshot, lastConfirmedRow);
  const lastSegIdx = prevRowInst ? Math.max(0, prevRowInst.runs.length - 1) : 0;
  const completedSegsExceptLast = prevRowInst
    ? prevRowInst.runs.map((_, i) => i).slice(0, Math.max(0, prevRowInst.runs.length - 1))
    : [];
  const nextRevision = state.revision + 1;

  const opRecord: FiletGuidedOperationRecord = {
    operationId: opId,
    type: "undo_row",
    rowNumber: lastConfirmedRow,
    patternVersionId: state.patternVersionId,
    deviceId: options.deviceId || state.lastDeviceId || "device-local",
    createdAt: now,
    baseRevision: state.revision,
    appliedRevision: nextRevision,
  };

  const next: FiletGuidedProgressState = {
    ...cloneGuidedProgressState(state),
    confirmedRows: nextConfirmed,
    syncedConfirmedRows: nextSynced,
    activeRowNumber: lastConfirmedRow,
    activeSegmentIndex: lastSegIdx,
    completedSegmentIndices: completedSegsExceptLast,
    sessionStatus: state.sessionStatus === "completed" ? "paused" : state.sessionStatus,
    operationIds: [...state.operationIds, opId],
    operationsLog: [...state.operationsLog.slice(-199), opRecord],
    revision: nextRevision,
    lastDeviceId: opRecord.deviceId,
    syncState: "pending_sync",
    updatedAt: now,
  };

  return {
    ok: true,
    state: next,
    idempotentReplay: false,
    deltaCompletedRows: -1,
  };
}

/**
 * Regla 6: Pausar o reanudar NO altera el contador de vueltas ni los segmentos.
 */
export function setGuidedSessionStatus(
  state: FiletGuidedProgressState,
  nextStatus: FiletGuidedSessionStatus,
  nowIso?: string
): FiletGuidedProgressState {
  if (state.sessionStatus === nextStatus) return state;
  return {
    ...cloneGuidedProgressState(state),
    sessionStatus: nextStatus,
    updatedAt: nowIso || new Date().toISOString(),
  };
}

/**
 * Regla 8: Calcula cuántas filas confirmadas faltan por acreditar al servidor al finalizar sesión.
 * Jamás vuelve a contar filas ya presentes en `syncedConfirmedRows`.
 */
export function computePendingUnsyncedRows(state: FiletGuidedProgressState): number[] {
  const syncedSet = new Set(state.syncedConfirmedRows);
  return state.confirmedRows.filter((row) => !syncedSet.has(row));
}

export function markGuidedRowsSyncedToServer(
  state: FiletGuidedProgressState,
  syncedRows: number[],
  nowIso?: string
): FiletGuidedProgressState {
  const mergedSynced = uniqueSortedNumbers(
    [...state.syncedConfirmedRows, ...syncedRows],
    1,
    state.totalRows
  );
  const remainingPending = state.confirmedRows.filter((r) => !mergedSynced.includes(r));
  return {
    ...cloneGuidedProgressState(state),
    syncedConfirmedRows: mergedSynced,
    syncState: remainingPending.length === 0 ? "synced_server" : "pending_sync",
    lastError: null,
    updatedAt: nowIso || new Date().toISOString(),
  };
}

export function markGuidedSyncError(
  state: FiletGuidedProgressState,
  errorMessage: string,
  nowIso?: string
): FiletGuidedProgressState {
  return {
    ...cloneGuidedProgressState(state),
    syncState: "error",
    lastError: errorMessage,
    updatedAt: nowIso || new Date().toISOString(),
  };
}

// ============================================================================
// DETECCIÓN Y RESOLUCIÓN DE CONFLICTOS ENTRE DISPOSITIVOS
// ============================================================================

export function detectGuidedProgressConflict(
  localState: FiletGuidedProgressState,
  remoteState: FiletGuidedProgressState
): GuidedConflictReport {
  if (localState.patternVersionId !== remoteState.patternVersionId) {
    return {
      hasConflict: true,
      reason: "VERSION_MISMATCH",
      localRevision: localState.revision,
      remoteRevision: remoteState.revision,
      localConfirmedCount: localState.confirmedRows.length,
      remoteConfirmedCount: remoteState.confirmedRows.length,
    };
  }

  const localPending = computePendingUnsyncedRows(localState);
  if (remoteState.revision > localState.revision && localPending.length > 0) {
    return {
      hasConflict: true,
      reason: "REVISION_DIVERGENCE",
      localRevision: localState.revision,
      remoteRevision: remoteState.revision,
      localConfirmedCount: localState.confirmedRows.length,
      remoteConfirmedCount: remoteState.confirmedRows.length,
    };
  }

  const localSet = new Set(localState.confirmedRows);
  const remoteSet = new Set(remoteState.confirmedRows);
  const localHasExtra = localState.confirmedRows.some((r) => !remoteSet.has(r));
  const remoteHasExtra = remoteState.confirmedRows.some((r) => !localSet.has(r));
  if (localHasExtra && remoteHasExtra) {
    return {
      hasConflict: true,
      reason: "CONFIRMED_ROWS_DIVERGENCE",
      localRevision: localState.revision,
      remoteRevision: remoteState.revision,
      localConfirmedCount: localState.confirmedRows.length,
      remoteConfirmedCount: remoteState.confirmedRows.length,
    };
  }

  return {
    hasConflict: false,
    localRevision: localState.revision,
    remoteRevision: remoteState.revision,
    localConfirmedCount: localState.confirmedRows.length,
    remoteConfirmedCount: remoteState.confirmedRows.length,
  };
}

/**
 * Fusiona dos estados de dispositivos distintos de forma determinista y segura:
 * une `confirmedRows` y `operationIds` sin duplicar jamás ninguna vuelta.
 */
export function mergeGuidedProgressWithoutDuplicates(
  localState: FiletGuidedProgressState,
  remoteState: FiletGuidedProgressState,
  nowIso?: string
): FiletGuidedProgressState {
  if (localState.patternVersionId !== remoteState.patternVersionId) {
    throw new Error("No se pueden fusionar progresos de versiones distintas del patrón.");
  }
  const mergedConfirmed = uniqueSortedNumbers(
    [...localState.confirmedRows, ...remoteState.confirmedRows],
    1,
    localState.totalRows
  );
  const mergedSynced = uniqueSortedNumbers(
    [...localState.syncedConfirmedRows, ...remoteState.syncedConfirmedRows],
    1,
    localState.totalRows
  );
  const mergedOps = Array.from(
    new Set([...localState.operationIds, ...remoteState.operationIds])
  );
  const projectDone = mergedConfirmed.length >= localState.totalRows;
  const nextActiveRow = projectDone
    ? localState.totalRows
    : findNextUnconfirmedRow(localState.totalRows, mergedConfirmed);

  // Conservar segmentos de la fila activa si sigue siendo la misma que tenía trabajo local
  const keepLocalSegments =
    !projectDone &&
    nextActiveRow === localState.activeRowNumber &&
    !mergedConfirmed.includes(nextActiveRow);

  const pendingAfterMerge = mergedConfirmed.filter((r) => !mergedSynced.includes(r));

  return {
    ...cloneGuidedProgressState(localState),
    confirmedRows: mergedConfirmed,
    syncedConfirmedRows: mergedSynced,
    activeRowNumber: nextActiveRow,
    completedSegmentIndices: keepLocalSegments ? [...localState.completedSegmentIndices] : [],
    activeSegmentIndex: keepLocalSegments ? localState.activeSegmentIndex : 0,
    sessionStatus: projectDone ? "completed" : localState.sessionStatus,
    operationIds: mergedOps,
    revision: Math.max(localState.revision, remoteState.revision) + 1,
    syncState: pendingAfterMerge.length === 0 ? "synced_server" : "pending_sync",
    lastError: null,
    updatedAt: nowIso || new Date().toISOString(),
  };
}

// ============================================================================
// PROYECCIONES DE SOLO LECTURA (UI + CLARA)
// ============================================================================

export function buildGuidedActiveRowView(
  state: FiletGuidedProgressState
): GuidedActiveRowView | null {
  const rowInst = getGuidedRowInstruction(state.snapshot, state.activeRowNumber);
  if (!rowInst) return null;

  const segs = rowInst.runs;
  const activeIdx = Math.max(0, Math.min(segs.length - 1, state.activeSegmentIndex));
  const completedSet = new Set(state.completedSegmentIndices);
  const allSegmentsCompleted = segs.length > 0 && segs.every((_, i) => completedSet.has(i));
  const remainingSegs = segs.filter((_, i) => !completedSet.has(i));
  const remainingCellsInRow = remainingSegs.reduce((sum, s) => sum + s.count, 0);
  const totalCellsInRow = segs.reduce((sum, s) => sum + s.count, 0);

  let nextSegment: FiletCompiledRun | null = null;
  for (let i = activeIdx + 1; i < segs.length; i++) {
    if (!completedSet.has(i)) {
      nextSegment = segs[i];
      break;
    }
  }

  return {
    rowNumber: rowInst.rowNumber,
    totalRows: state.totalRows,
    matrixRowIndex: getMatrixRowIndexForGuidedRow(state.snapshot, rowInst.rowNumber),
    direction: rowInst.direction,
    segments: segs,
    activeSegmentIndex: activeIdx,
    activeSegment: segs[activeIdx] || null,
    nextSegment,
    completedSegmentIndices: [...state.completedSegmentIndices],
    allSegmentsCompleted,
    remainingSegmentsCount: remainingSegs.length,
    remainingCellsInRow,
    totalCellsInRow,
    rowInstructionText: rowInst.instructionText,
    isRowConfirmed: state.confirmedRows.includes(rowInst.rowNumber),
  };
}

export function buildGuidedProgressSummary(
  state: FiletGuidedProgressState
): GuidedProgressSummary {
  const confirmedRowsCount = state.confirmedRows.length;
  const progressPercent =
    state.totalRows > 0
      ? Math.min(100, Math.round((confirmedRowsCount / state.totalRows) * 100))
      : 0;

  return {
    projectId: state.projectId,
    projectName: state.projectName,
    patternName: state.snapshot.pattern_name,
    patternVersionNumber: state.patternVersionNumber,
    gridWidth: state.snapshot.grid_width,
    gridHeight: state.snapshot.grid_height,
    meshSize: state.snapshot.mesh_size,
    activeRowNumber: state.activeRowNumber,
    totalRows: state.totalRows,
    confirmedRowsCount,
    pendingUnsyncedRowsCount: computePendingUnsyncedRows(state).length,
    progressPercent,
    remainingRowsCount: Math.max(0, state.totalRows - confirmedRowsCount),
    sessionStatus: state.sessionStatus,
    syncState: state.syncState,
    activeRowView: buildGuidedActiveRowView(state),
  };
}

/**
 * Formatea una instrucción verbal determinista para SpeechSynthesis / Clara
 * a partir exclusivamente del segmento calculado por el motor.
 */
export function formatGuidedSegmentSpeech(view: GuidedActiveRowView): string {
  const dirLabel =
    view.direction === "rtl" ? "de derecha a izquierda" : "de izquierda a derecha";
  if (view.allSegmentsCompleted) {
    return `Vuelta ${view.rowNumber} de ${view.totalRows} lista para confirmar. Todos los segmentos están completos.`;
  }
  const seg = view.activeSegment;
  if (!seg) {
    return `Vuelta ${view.rowNumber} de ${view.totalRows}.`;
  }
  const kindLabel =
    seg.kind === "filled"
      ? seg.count === 1
        ? "cuadro lleno"
        : "cuadros llenos"
      : seg.count === 1
        ? "cuadro vacío"
        : "cuadros vacíos";
  const nextText = view.nextSegment
    ? ` Siguiente: ${view.nextSegment.count} ${
        view.nextSegment.kind === "filled" ? "llenos" : "vacíos"
      }.`
    : " Último segmento de la vuelta.";
  return `Vuelta ${view.rowNumber}, ${dirLabel}: ${seg.count} ${kindLabel}.${nextText}`;
}
