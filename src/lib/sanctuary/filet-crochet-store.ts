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
import {
  cloneBinaryMatrix,
  createStarterFiletWorkspace,
  FILET_MAX_GLYPH_DIM,
  FILET_MAX_PATTERN_DIM,
  validateBinaryMatrix,
  type FiletAlphabetCollection,
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
      })),
    })),
    patterns: workspace.patterns.map((p) => ({
      ...p,
      versions: p.versions.map((v) => ({
        ...v,
        matrix: cloneBinaryMatrix(v.matrix),
      })),
      composition: p.composition ? { ...p.composition } : undefined,
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
