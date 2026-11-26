/**
 * ============================================================================
 * OAKHAVEN — FILET CROCHET STUDIO (PERSISTENCIA PRIVADA AISLADA POR USUARIO)
 * ============================================================================
 * Reutiliza la infraestructura real de OakHaven:
 * 1. Almacenamiento local aislado por propietario (`isOfflineOwner` + `safeLocalStorage`),
 *    siguiendo exactamente el contrato de `atelier-patterns-store.ts`.
 * 2. Empaquetado seguro para sincronizar respaldos privados en `/api/resources`
 *    (`buildingId: "atelier"`, `resourceType: "filet_crochet_studio"`, JSON validado
 *    bajo RLS de `public.building_resources` y bucket `oakhaven-private-resources`).
 */

import { isOfflineOwner } from "../offline-owner.ts";
import { safeLocalStorage } from "../storage-safe.ts";
import type { SessionStorage } from "./session-storage.ts";
import type { HistoricalDocumentRecord } from "./filet-digitizer-engine.ts";
import {
  cloneBinaryMatrix,
  cloneComposerSnapshot,
  createStarterFiletWorkspace,
  FILET_MAX_GLYPH_DIM,
  FILET_MAX_PATTERN_DIM,
  validateBinaryMatrix,
  type FiletAlphabetCollection,
  type FiletComposerDraft,
  type FiletGlyph,
  type FiletOriginalReference,
  type FiletPatternVersion,
  type FiletStudioWorkspace,
  type FiletVersionedPattern,
} from "./filet-crochet-engine.ts";

const MAX_COLLECTIONS = 24;
const MAX_GLYPHS_PER_COLLECTION = 128;
const MAX_PATTERNS = 64;
const MAX_VERSIONS_PER_PATTERN = 40;
const MAX_SERIALIZED_BYTES = 1_500_000; // ~1.5MB seguro para localStorage y /api/resources

export interface StoredFiletWorkspaceEnvelope {
  ownerId: string;
  workspace: FiletStudioWorkspace;
}

export interface FiletPrivateResourceUploadBody {
  buildingId: "atelier";
  resourceType: "filet_crochet_studio";
  title: string;
  description: string;
  filename: string;
  mimeType: "application/json";
  projectId: string | null;
  tags: string[];
  rawTextContent: string;
}

export function filetStudioStorageKey(owner: string): string {
  return `oakhaven_atelier_filet_studio_v1_${encodeURIComponent(owner)}`;
}

function isValidReference(value: unknown): value is FiletOriginalReference {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  const validSource =
    r.sourceType === "manual" ||
    r.sourceType === "imported_grid" ||
    r.sourceType === "image_reference" ||
    r.sourceType === "alphabet_sheet";
  if (!validSource || typeof r.label !== "string" || typeof r.capturedAt !== "string") {
    return false;
  }
  const matCheck = validateBinaryMatrix(r.originalMatrix, {
    maxWidth: FILET_MAX_GLYPH_DIM,
    maxHeight: FILET_MAX_GLYPH_DIM,
  });
  return matCheck.valid;
}

function isValidGlyph(value: unknown): value is FiletGlyph {
  if (!value || typeof value !== "object") return false;
  const g = value as Record<string, unknown>;
  if (
    typeof g.id !== "string" ||
    typeof g.symbol !== "string" ||
    !g.symbol.trim() ||
    typeof g.label !== "string" ||
    typeof g.notes !== "string" ||
    typeof g.createdAt !== "string" ||
    typeof g.updatedAt !== "string"
  ) {
    return false;
  }
  const matCheck = validateBinaryMatrix(g.matrix, {
    maxWidth: FILET_MAX_GLYPH_DIM,
    maxHeight: FILET_MAX_GLYPH_DIM,
  });
  if (!matCheck.valid || g.width !== matCheck.width || g.height !== matCheck.height) {
    return false;
  }
  return isValidReference(g.originalReference);
}

function isValidCollection(value: unknown): value is FiletAlphabetCollection {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  if (
    typeof c.id !== "string" ||
    typeof c.name !== "string" ||
    !c.name.trim() ||
    typeof c.description !== "string" ||
    typeof c.defaultWidth !== "number" ||
    typeof c.defaultHeight !== "number" ||
    typeof c.createdAt !== "string" ||
    typeof c.updatedAt !== "string" ||
    !Array.isArray(c.glyphs) ||
    c.glyphs.length > MAX_GLYPHS_PER_COLLECTION
  ) {
    return false;
  }
  return c.glyphs.every(isValidGlyph);
}

function isValidPatternVersion(value: unknown): value is FiletPatternVersion {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (
    typeof v.version !== "number" ||
    !Number.isInteger(v.version) ||
    v.version < 1 ||
    typeof v.note !== "string" ||
    typeof v.createdAt !== "string"
  ) {
    return false;
  }
  const matCheck = validateBinaryMatrix(v.matrix, {
    maxWidth: FILET_MAX_PATTERN_DIM,
    maxHeight: FILET_MAX_PATTERN_DIM,
  });
  return matCheck.valid && v.width === matCheck.width && v.height === matCheck.height;
}

function isValidVersionedPattern(value: unknown): value is FiletVersionedPattern {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  if (
    typeof p.id !== "string" ||
    typeof p.title !== "string" ||
    !p.title.trim() ||
    typeof p.currentVersion !== "number" ||
    !Number.isInteger(p.currentVersion) ||
    p.currentVersion < 1 ||
    typeof p.createdAt !== "string" ||
    typeof p.updatedAt !== "string" ||
    !Array.isArray(p.versions) ||
    p.versions.length === 0 ||
    p.versions.length > MAX_VERSIONS_PER_PATTERN
  ) {
    return false;
  }
  return p.versions.every(isValidPatternVersion);
}

function isValidDraft(value: unknown): value is FiletComposerDraft {
  if (!value || typeof value !== "object") return false;
  const d = value as Record<string, unknown>;
  if (
    typeof d.id !== "string" ||
    typeof d.title !== "string" ||
    typeof d.alphabetCollectionId !== "string" ||
    typeof d.phrase !== "string" ||
    typeof d.updatedAt !== "string" ||
    !d.snapshot ||
    typeof d.snapshot !== "object"
  ) {
    return false;
  }
  const snap = d.snapshot as Record<string, unknown>;
  const canvas = snap.canvas as Record<string, unknown> | undefined;
  return Boolean(
    canvas &&
      typeof canvas.width === "number" &&
      canvas.width >= 1 &&
      canvas.width <= FILET_MAX_PATTERN_DIM &&
      typeof canvas.height === "number" &&
      canvas.height >= 1 &&
      canvas.height <= FILET_MAX_PATTERN_DIM &&
      Array.isArray(snap.placements) &&
      snap.cellOverrides &&
      typeof snap.cellOverrides === "object"
  );
}

export function isValidFiletWorkspace(value: unknown): value is FiletStudioWorkspace {
  if (!value || typeof value !== "object") return false;
  const w = value as Record<string, unknown>;
  if (
    w.schemaVersion !== 1 ||
    typeof w.updatedAt !== "string" ||
    !Array.isArray(w.collections) ||
    w.collections.length > MAX_COLLECTIONS ||
    !Array.isArray(w.patterns) ||
    w.patterns.length > MAX_PATTERNS
  ) {
    return false;
  }
  if (w.drafts !== undefined && (!Array.isArray(w.drafts) || !w.drafts.every(isValidDraft))) {
    return false;
  }
  return w.collections.every(isValidCollection) && w.patterns.every(isValidVersionedPattern);
}

function isValidEnvelope(value: unknown, owner: string): value is StoredFiletWorkspaceEnvelope {
  if (!value || typeof value !== "object") return false;
  const env = value as { ownerId?: unknown; workspace?: unknown };
  if (env.ownerId !== owner) return false;
  return isValidFiletWorkspace(env.workspace);
}

function cloneWorkspace(workspace: FiletStudioWorkspace): FiletStudioWorkspace {
  return {
    schemaVersion: 1,
    updatedAt: workspace.updatedAt,
    collections: workspace.collections.map((c) => ({
      ...c,
      glyphs: c.glyphs.map((g) => ({
        ...g,
        matrix: cloneBinaryMatrix(g.matrix),
        originalReference: {
          ...g.originalReference,
          originalMatrix: cloneBinaryMatrix(g.originalReference.originalMatrix),
        },
        historicalProvenance: g.historicalProvenance
          ? {
              ...g.historicalProvenance,
              region: { ...g.historicalProvenance.region },
              calibration: { ...g.historicalProvenance.calibration },
              processing: { ...g.historicalProvenance.processing },
              initiallyDetectedMatrix: cloneBinaryMatrix(
                g.historicalProvenance.initiallyDetectedMatrix
              ),
            }
          : undefined,
      })),
    })),
    patterns: workspace.patterns.map((p) => ({
      ...p,
      versions: p.versions.map((v) => ({
        ...v,
        matrix: cloneBinaryMatrix(v.matrix),
      })),
      composition: p.composition ? { ...p.composition } : undefined,
      composerSnapshot: p.composerSnapshot
        ? cloneComposerSnapshot(p.composerSnapshot)
        : undefined,
    })),
    drafts: (workspace.drafts || []).map((d) => ({
      ...d,
      snapshot: cloneComposerSnapshot(d.snapshot),
    })),
  };
}

/**
 * Lee el espacio de trabajo privado de Filet Crochet Studio del usuario autenticado.
 * Devuelve null si no hay propietario válido, si no existe aún o si los datos pertenecen a otro usuario.
 */
export function readFiletStudioWorkspace(
  storage: SessionStorage,
  owner?: string
): FiletStudioWorkspace | null {
  if (!isOfflineOwner(owner)) return null;
  try {
    const raw = storage.getItem(filetStudioStorageKey(owner));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidEnvelope(parsed, owner) ? cloneWorkspace(parsed.workspace) : null;
  } catch {
    return null;
  }
}

/**
 * Lee el workspace del propietario o crea una plantilla inicial editable en memoria (sin contaminar a otros usuarios).
 */
export function readOrInitFiletStudioWorkspace(
  storage: SessionStorage,
  owner?: string
): FiletStudioWorkspace {
  const existing = readFiletStudioWorkspace(storage, owner);
  if (existing && existing.collections.length > 0) {
    return existing;
  }
  return createStarterFiletWorkspace();
}

export function saveFiletStudioWorkspace(
  storage: SessionStorage,
  owner: string | undefined,
  workspace: FiletStudioWorkspace
): { ok: boolean; error?: string; workspace: FiletStudioWorkspace } {
  if (!isOfflineOwner(owner)) {
    return {
      ok: false,
      error: "Inicia sesión para guardar colecciones y glifos en tu Filet Crochet Studio.",
      workspace,
    };
  }

  const normalized: FiletStudioWorkspace = {
    ...cloneWorkspace(workspace),
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
  };

  if (!isValidFiletWorkspace(normalized)) {
    return {
      ok: false,
      error: "El espacio de trabajo contiene matrices o glifos con estructura inválida.",
      workspace,
    };
  }

  const serialized = JSON.stringify({
    ownerId: owner,
    workspace: normalized,
  } satisfies StoredFiletWorkspaceEnvelope);

  if (serialized.length > MAX_SERIALIZED_BYTES) {
    return {
      ok: false,
      error: "El tamaño del espacio de trabajo excede el límite seguro local (1.5 MB).",
      workspace,
    };
  }

  try {
    const written = storage.setItem(filetStudioStorageKey(owner), serialized);
    if (written === false) {
      return {
        ok: false,
        error: "Espacio local lleno. Exporta o respalda tu colección antes de agregar más glifos.",
        workspace,
      };
    }
    return { ok: true, workspace: normalized };
  } catch {
    return {
      ok: false,
      error: "No se pudo guardar Filet Crochet Studio en este dispositivo.",
      workspace,
    };
  }
}

export function readFiletStudioWorkspaceSafe(owner?: string): FiletStudioWorkspace {
  return readOrInitFiletStudioWorkspace(safeLocalStorage, owner);
}

export function saveFiletStudioWorkspaceSafe(
  owner: string | undefined,
  workspace: FiletStudioWorkspace
) {
  return saveFiletStudioWorkspace(safeLocalStorage, owner, workspace);
}

// ============================================================================
// INTEGRACIÓN CON ALMACENAMIENTO PRIVADO DE OAKHAVEN (/api/resources -> atelier)
// ============================================================================

export function buildFiletStudioPrivateResourcePayload(
  workspace: FiletStudioWorkspace,
  options?: {
    title?: string;
    projectId?: string | null;
    collectionId?: string;
  }
): FiletPrivateResourceUploadBody {
  const safeWorkspace = cloneWorkspace(workspace);
  const selectedCollection = options?.collectionId
    ? safeWorkspace.collections.find((c) => c.id === options.collectionId)
    : undefined;

  const exportPayload: FiletStudioWorkspace = selectedCollection
    ? {
        schemaVersion: 1,
        collections: [selectedCollection],
        patterns: safeWorkspace.patterns,
        drafts: safeWorkspace.drafts || [],
        updatedAt: safeWorkspace.updatedAt,
      }
    : safeWorkspace;

  const baseTitle =
    options?.title?.trim() ||
    (selectedCollection
      ? `Filet Studio — ${selectedCollection.name}`
      : `Respaldo Filet Crochet Studio (${safeWorkspace.collections.length} col.)`);

  const slug = baseTitle
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  const glyphCount = exportPayload.collections.reduce((acc, c) => acc + c.glyphs.length, 0);

  return {
    buildingId: "atelier",
    resourceType: "filet_crochet_studio",
    title: baseTitle.slice(0, 180),
    description: `Colecciones de alfabeto y matrices binarias Filet Crochet (${exportPayload.collections.length} colección(es), ${glyphCount} glifo(s), ${exportPayload.patterns.length} patrón(es) versionado(s)).`,
    filename: `${slug || "filet-crochet-studio"}.json`,
    mimeType: "application/json",
    projectId: options?.projectId || null,
    tags: ["filet-crochet", "atelier", "alfabeto", "matriz-binaria"],
    rawTextContent: JSON.stringify(exportPayload, null, 2),
  };
}

export function parseFiletStudioFromPrivateResourceText(rawJson: string): FiletStudioWorkspace | null {
  try {
    const parsed: unknown = JSON.parse(rawJson);
    if (isValidFiletWorkspace(parsed)) {
      return cloneWorkspace(parsed);
    }
    if (parsed && typeof parsed === "object" && "workspace" in parsed) {
      const nested = (parsed as { workspace?: unknown }).workspace;
      if (isValidFiletWorkspace(nested)) {
        return cloneWorkspace(nested);
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// FASE 2 — BLOQUE 2: VISTA PREVIA, VALIDACIÓN DE VERSIÓN Y RESTAURACIÓN SEGURA
// ============================================================================

export const SUPPORTED_FILET_SCHEMA_VERSION = 1;

export interface FiletWorkspaceCounts {
  collections: number;
  glyphs: number;
  patterns: number;
  patternVersions: number;
  drafts: number;
}

export interface FiletBackupPreviewResult {
  valid: boolean;
  schemaVersion: number | null;
  errors: string[];
  workspace: FiletStudioWorkspace | null;
  summary: {
    updatedAt: string;
    counts: FiletWorkspaceCounts;
    collectionNames: string[];
    patternTitles: string[];
  } | null;
}

export interface FiletRestoreConflictReport {
  hasLocalWorkspace: boolean;
  hasConflict: boolean;
  isIdentical: boolean;
  localIsNewer: boolean;
  localUpdatedAt: string | null;
  incomingUpdatedAt: string;
  localCounts: FiletWorkspaceCounts;
  incomingCounts: FiletWorkspaceCounts;
  reason: string;
}

export function countFiletWorkspace(workspace: FiletStudioWorkspace | null): FiletWorkspaceCounts {
  if (!workspace) {
    return { collections: 0, glyphs: 0, patterns: 0, patternVersions: 0, drafts: 0 };
  }
  return {
    collections: workspace.collections.length,
    glyphs: workspace.collections.reduce((acc, c) => acc + c.glyphs.length, 0),
    patterns: workspace.patterns.length,
    patternVersions: workspace.patterns.reduce((acc, p) => acc + p.versions.length, 0),
    drafts: workspace.drafts?.length || 0,
  };
}

/**
 * Valida la sintaxis JSON, versión de esquema y estructura completa de un respaldo privado
 * antes de mostrar su vista previa o permitir la restauración.
 */
export function validateFiletBackupPreview(rawJson: string): FiletBackupPreviewResult {
  if (typeof rawJson !== "string" || !rawJson.trim()) {
    return {
      valid: false,
      schemaVersion: null,
      errors: ["El respaldo está vacío o no contiene texto JSON legible."],
      workspace: null,
      summary: null,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return {
      valid: false,
      schemaVersion: null,
      errors: ["JSON inválido: el archivo de respaldo está corrupto o incompleto."],
      workspace: null,
      summary: null,
    };
  }

  const candidate =
    parsed && typeof parsed === "object" && "workspace" in parsed
      ? (parsed as { workspace?: unknown }).workspace
      : parsed;

  if (!candidate || typeof candidate !== "object") {
    return {
      valid: false,
      schemaVersion: null,
      errors: ["Estructura de respaldo incompatible con Filet Crochet Studio."],
      workspace: null,
      summary: null,
    };
  }

  const rawVersion = (candidate as { schemaVersion?: unknown }).schemaVersion;
  const schemaVersion = typeof rawVersion === "number" ? rawVersion : null;
  if (schemaVersion !== SUPPORTED_FILET_SCHEMA_VERSION) {
    return {
      valid: false,
      schemaVersion,
      errors: [
        `Versión de esquema no soportada (${String(rawVersion ?? "desconocida")}). Versión esperada: ${SUPPORTED_FILET_SCHEMA_VERSION}.`,
      ],
      workspace: null,
      summary: null,
    };
  }

  if (!isValidFiletWorkspace(candidate)) {
    return {
      valid: false,
      schemaVersion,
      errors: [
        "El respaldo contiene colecciones, glifos, matrices binarias o patrones con estructura inválida.",
      ],
      workspace: null,
      summary: null,
    };
  }

  const safe = cloneWorkspace(candidate);
  return {
    valid: true,
    schemaVersion: safe.schemaVersion,
    errors: [],
    workspace: safe,
    summary: {
      updatedAt: safe.updatedAt,
      counts: countFiletWorkspace(safe),
      collectionNames: safe.collections.map((c) => c.name),
      patternTitles: safe.patterns.map((p) => `${p.title} (v${p.currentVersion})`),
    },
  };
}

function fingerprintWorkspaceContent(w: FiletStudioWorkspace): string {
  return JSON.stringify({
    collections: w.collections,
    patterns: w.patterns,
    drafts: w.drafts || [],
  });
}

/**
 * Compara el espacio de trabajo local actual contra el respaldo entrante para detectar
 * conflictos reales y evitar sobrescrituras silenciosas.
 */
export function detectFiletRestoreConflict(
  localWorkspace: FiletStudioWorkspace | null,
  incomingWorkspace: FiletStudioWorkspace
): FiletRestoreConflictReport {
  const localCounts = countFiletWorkspace(localWorkspace);
  const incomingCounts = countFiletWorkspace(incomingWorkspace);

  if (!localWorkspace) {
    return {
      hasLocalWorkspace: false,
      hasConflict: false,
      isIdentical: false,
      localIsNewer: false,
      localUpdatedAt: null,
      incomingUpdatedAt: incomingWorkspace.updatedAt,
      localCounts,
      incomingCounts,
      reason: "No existen cambios locales previos guardados para este usuario.",
    };
  }

  const isIdentical =
    fingerprintWorkspaceContent(localWorkspace) ===
    fingerprintWorkspaceContent(incomingWorkspace);
  const localTs = Date.parse(localWorkspace.updatedAt) || 0;
  const incomingTs = Date.parse(incomingWorkspace.updatedAt) || 0;
  const localIsNewer = localTs > incomingTs;

  if (isIdentical) {
    return {
      hasLocalWorkspace: true,
      hasConflict: false,
      isIdentical: true,
      localIsNewer,
      localUpdatedAt: localWorkspace.updatedAt,
      incomingUpdatedAt: incomingWorkspace.updatedAt,
      localCounts,
      incomingCounts,
      reason: "El respaldo coincide exactamente con tu estado local actual.",
    };
  }

  return {
    hasLocalWorkspace: true,
    hasConflict: true,
    isIdentical: false,
    localIsNewer,
    localUpdatedAt: localWorkspace.updatedAt,
    incomingUpdatedAt: incomingWorkspace.updatedAt,
    localCounts,
    incomingCounts,
    reason: localIsNewer
      ? "Conflicto detectado: tu copia local offline es más reciente que el respaldo seleccionado. Confirmar sobrescribirá tus cambios locales."
      : "Conflicto detectado: tu copia local difiere del respaldo seleccionado. Se requiere confirmación explícita para reemplazarla.",
  };
}

/**
 * Restaura un respaldo validado en el almacenamiento privado del propietario.
 * NUNCA sobrescribe cambios locales en conflicto sin `confirmOverwrite: true`.
 */
export function restoreFiletWorkspaceFromBackup(
  storage: SessionStorage,
  owner: string | undefined,
  rawJson: string,
  options: { confirmOverwrite: boolean }
): {
  ok: boolean;
  requiresConfirmation?: boolean;
  error?: string;
  preview: FiletBackupPreviewResult;
  conflict?: FiletRestoreConflictReport;
  workspace?: FiletStudioWorkspace;
} {
  const preview = validateFiletBackupPreview(rawJson);
  if (!isOfflineOwner(owner)) {
    return {
      ok: false,
      error: "Inicia sesión para restaurar respaldos privados en tu Atelier.",
      preview,
    };
  }
  if (!preview.valid || !preview.workspace) {
    return {
      ok: false,
      error: preview.errors[0] || "El respaldo no superó la validación de integridad.",
      preview,
    };
  }

  const existingLocal = readFiletStudioWorkspace(storage, owner);
  const conflict = detectFiletRestoreConflict(existingLocal, preview.workspace);

  if (conflict.hasConflict && !options.confirmOverwrite) {
    return {
      ok: false,
      requiresConfirmation: true,
      error: conflict.reason,
      preview,
      conflict,
    };
  }

  const saved = saveFiletStudioWorkspace(storage, owner, preview.workspace);
  if (!saved.ok) {
    return {
      ok: false,
      error: saved.error,
      preview,
      conflict,
    };
  }

  return {
    ok: true,
    preview,
    conflict,
    workspace: saved.workspace,
  };
}

export function restoreFiletWorkspaceFromBackupSafe(
  owner: string | undefined,
  rawJson: string,
  options: { confirmOverwrite: boolean }
) {
  return restoreFiletWorkspaceFromBackup(safeLocalStorage, owner, rawJson, options);
}

// ============================================================================
// FASE 3 — PERSISTENCIA LOCAL AISLADA DE BIBLIOTECA DE DOCUMENTOS HISTÓRICOS
// ============================================================================

const MAX_HISTORICAL_DOCS = 32;
const MAX_HISTORICAL_DOCS_BYTES = 1_800_000;

export function historicalDocsStorageKey(owner: string): string {
  return `oakhaven_atelier_historical_docs_v1_${encodeURIComponent(owner)}`;
}

function isValidHistoricalDoc(value: unknown): value is HistoricalDocumentRecord {
  if (!value || typeof value !== "object") return false;
  const d = value as Record<string, unknown>;
  return (
    typeof d.id === "string" &&
    typeof d.title === "string" &&
    typeof d.filename === "string" &&
    (d.mimeType === "application/pdf" ||
      d.mimeType === "image/png" ||
      d.mimeType === "image/jpeg" ||
      d.mimeType === "image/webp") &&
    typeof d.sizeBytes === "number" &&
    d.sizeBytes > 0 &&
    typeof d.pageCount === "number" &&
    d.pageCount >= 1 &&
    (d.source === "local_private" || d.source === "atelier_resource") &&
    typeof d.addedAt === "string"
  );
}

export function readHistoricalDocuments(
  storage: SessionStorage,
  owner?: string
): HistoricalDocumentRecord[] {
  if (!isOfflineOwner(owner)) return [];
  try {
    const raw = storage.getItem(historicalDocsStorageKey(owner));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return [];
    const env = parsed as { ownerId?: unknown; documents?: unknown };
    if (env.ownerId !== owner || !Array.isArray(env.documents)) return [];
    return env.documents.filter(isValidHistoricalDoc);
  } catch {
    return [];
  }
}

export function saveHistoricalDocuments(
  storage: SessionStorage,
  owner: string | undefined,
  documents: HistoricalDocumentRecord[]
): { ok: boolean; error?: string; documents: HistoricalDocumentRecord[] } {
  if (!isOfflineOwner(owner)) {
    return {
      ok: false,
      error: "Inicia sesión para guardar documentos históricos en tu Atelier.",
      documents: [],
    };
  }
  const cleanDocs = documents.slice(0, MAX_HISTORICAL_DOCS).filter(isValidHistoricalDoc);
  const serialized = JSON.stringify({ ownerId: owner, documents: cleanDocs });
  if (serialized.length > MAX_HISTORICAL_DOCS_BYTES) {
    // Recortar previewDataUrl de documentos antiguos si supera cuota, conservando metadatos
    const compact = cleanDocs.map((d, idx) =>
      idx === 0 ? d : { ...d, previewDataUrl: undefined }
    );
    const compactRaw = JSON.stringify({ ownerId: owner, documents: compact });
    if (compactRaw.length > MAX_HISTORICAL_DOCS_BYTES) {
      return {
        ok: false,
        error: "Cuota local excedida para vistas previas de documentos históricos.",
        documents: readHistoricalDocuments(storage, owner),
      };
    }
    const ok = storage.setItem(historicalDocsStorageKey(owner), compactRaw);
    return ok === false
      ? { ok: false, error: "Espacio local lleno.", documents: readHistoricalDocuments(storage, owner) }
      : { ok: true, documents: compact };
  }
  const ok = storage.setItem(historicalDocsStorageKey(owner), serialized);
  return ok === false
    ? { ok: false, error: "Espacio local lleno.", documents: readHistoricalDocuments(storage, owner) }
    : { ok: true, documents: cleanDocs };
}

export function readHistoricalDocumentsSafe(owner?: string): HistoricalDocumentRecord[] {
  return readHistoricalDocuments(safeLocalStorage, owner);
}

export function saveHistoricalDocumentsSafe(
  owner: string | undefined,
  documents: HistoricalDocumentRecord[]
) {
  return saveHistoricalDocuments(safeLocalStorage, owner, documents);
}
