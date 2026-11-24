/**
 * ============================================================================
 * OAKHAVEN — FILET CROCHET STUDIO FASE 5 (ARCHIVO DE PROYECTO REUTILIZABLE)
 * ============================================================================
 * Formato JSON versionado para exportar e importar patrones, versiones
 * seleccionadas, matrices, configuración técnica, glifos utilizados y
 * referencias históricas.
 *
 * Invariantes de seguridad:
 * - Jamás exporta credenciales, ownerId, sesiones, XP, GP ni operationIds.
 * - El progreso de tejido solo se incluye mediante opción explícita (`includeProgress: true`).
 * - Valida esquema, tamaño máximo (5 MB), matrices y compatibilidad de versiones.
 * - Detecta duplicados/conflictos y jamás sobrescribe sin confirmación explícita.
 */

import {
  cloneBinaryMatrix,
  validateBinaryMatrix,
  type BinaryMatrix,
  type FiletGlyph,
  type FiletMeshSize,
  type FiletPatternVersion,
  type FiletRowDirection,
  type FiletStudioWorkspace,
  type FiletVersionedPattern,
} from "./filet-crochet-engine.ts";
import type {
  FiletGuidedOrientation,
  FiletGuidedProgressState,
} from "./filet-guided-engine.ts";

export const FILET_PROJECT_ARCHIVE_FORMAT = "oakhaven.filet-project-archive" as const;
export const FILET_PROJECT_ARCHIVE_SCHEMA_VERSION = 1 as const;
export const FILET_PROJECT_ARCHIVE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export interface FiletProjectArchiveProgressSnapshot {
  patternVersionNumber: number;
  activeRowNumber: number;
  activeSegmentIndex: number;
  completedSegmentIndices: number[];
  confirmedRows: number[];
}

export interface FiletProjectArchiveFile {
  format: typeof FILET_PROJECT_ARCHIVE_FORMAT;
  schemaVersion: typeof FILET_PROJECT_ARCHIVE_SCHEMA_VERSION;
  exportedAt: string;
  pattern: {
    id: string;
    title: string;
    currentVersion: number;
    versions: FiletPatternVersion[];
  };
  technicalConfig: {
    meshSize: FiletMeshSize;
    orientation: FiletGuidedOrientation;
    firstRowDirection: FiletRowDirection;
  };
  glyphsUsed: Array<{
    id: string;
    symbol: string;
    label: string;
    width: number;
    height: number;
    matrix: BinaryMatrix;
    style?: string;
    variantLabel?: string;
    historicalReference?: {
      documentTitle: string;
      pageNumber: number;
      digitizedAt: string;
    };
  }>;
  metadata: {
    gridWidth: number;
    gridHeight: number;
    versionsCount: number;
    includesProgress: boolean;
  };
  /** Solo presente si el usuario activó explícitamente `includeProgress: true`. */
  guidedProgress?: FiletProjectArchiveProgressSnapshot;
}

export interface ArchiveValidationResult {
  valid: boolean;
  archive?: FiletProjectArchiveFile;
  errors: string[];
}

export interface ArchiveImportConflictReport {
  hasConflict: boolean;
  conflictingPatternId?: string;
  conflictingPatternTitle?: string;
  duplicateGlyphSymbols: string[];
}

export function buildFiletProjectArchive(params: {
  pattern: FiletVersionedPattern;
  selectedVersionNumbers?: number[];
  meshSize: FiletMeshSize;
  orientation?: FiletGuidedOrientation;
  firstRowDirection: FiletRowDirection;
  glyphsUsed?: FiletGlyph[];
  includeProgress?: boolean;
  guidedProgress?: FiletGuidedProgressState | null;
  nowIso?: string;
}): FiletProjectArchiveFile {
  const selectedSet = params.selectedVersionNumbers?.length
    ? new Set(params.selectedVersionNumbers)
    : null;
  const chosenVersions = (
    selectedSet
      ? params.pattern.versions.filter((v) => selectedSet.has(v.version))
      : params.pattern.versions
  ).map((v) => ({
    ...v,
    matrix: cloneBinaryMatrix(v.matrix),
  }));

  if (chosenVersions.length === 0) {
    throw new Error("Debe seleccionar al menos una versión válida del patrón para exportar.");
  }

  const latest = chosenVersions[chosenVersions.length - 1];
  const cleanGlyphs = (params.glyphsUsed || []).map((g) => ({
    id: g.id,
    symbol: g.symbol,
    label: g.label,
    width: g.width,
    height: g.height,
    matrix: cloneBinaryMatrix(g.matrix),
    ...(g.style ? { style: g.style } : {}),
    ...(g.variantLabel ? { variantLabel: g.variantLabel } : {}),
    ...(g.historicalProvenance
      ? {
          historicalReference: {
            documentTitle: g.historicalProvenance.documentTitle,
            pageNumber: g.historicalProvenance.pageNumber,
            digitizedAt: g.historicalProvenance.digitizedAt,
          },
        }
      : {}),
  }));

  const includeProgress = Boolean(params.includeProgress && params.guidedProgress);
  const progressPayload: FiletProjectArchiveProgressSnapshot | undefined =
    includeProgress && params.guidedProgress
      ? {
          patternVersionNumber: params.guidedProgress.patternVersionNumber,
          activeRowNumber: params.guidedProgress.activeRowNumber,
          activeSegmentIndex: params.guidedProgress.activeSegmentIndex,
          completedSegmentIndices: [...params.guidedProgress.completedSegmentIndices],
          confirmedRows: [...params.guidedProgress.confirmedRows],
        }
      : undefined;

  return {
    format: FILET_PROJECT_ARCHIVE_FORMAT,
    schemaVersion: FILET_PROJECT_ARCHIVE_SCHEMA_VERSION,
    exportedAt: params.nowIso || new Date().toISOString(),
    pattern: {
      id: params.pattern.id,
      title: params.pattern.title,
      currentVersion: latest.version,
      versions: chosenVersions,
    },
    technicalConfig: {
      meshSize: params.meshSize,
      orientation: params.orientation ?? "bottom_to_top",
      firstRowDirection: params.firstRowDirection,
    },
    glyphsUsed: cleanGlyphs,
    metadata: {
      gridWidth: latest.width,
      gridHeight: latest.height,
      versionsCount: chosenVersions.length,
      includesProgress: includeProgress,
    },
    ...(progressPayload ? { guidedProgress: progressPayload } : {}),
  };
}

export function serializeFiletProjectArchive(archive: FiletProjectArchiveFile): string {
  const json = JSON.stringify(archive, null, 2);
  const bytes = new TextEncoder().encode(json).byteLength;
  if (bytes > FILET_PROJECT_ARCHIVE_MAX_BYTES) {
    throw new Error("El archivo de proyecto excede el límite seguro de 5 MB.");
  }
  return json;
}

export function validateAndParseProjectArchive(rawJson: string): ArchiveValidationResult {
  const errors: string[] = [];
  if (!rawJson || typeof rawJson !== "string") {
    return { valid: false, errors: ["El contenido JSON está vacío."] };
  }
  if (new TextEncoder().encode(rawJson).byteLength > FILET_PROJECT_ARCHIVE_MAX_BYTES) {
    return { valid: false, errors: ["El archivo excede el límite máximo de 5 MB."] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { valid: false, errors: ["JSON inválido o corrupto."] };
  }

  if (!parsed || typeof parsed !== "object") {
    return { valid: false, errors: ["Estructura raíz inválida."] };
  }

  const obj = parsed as Record<string, unknown>;
  if (obj.format !== FILET_PROJECT_ARCHIVE_FORMAT) {
    errors.push(`Formato no reconocido (esperado: ${FILET_PROJECT_ARCHIVE_FORMAT}).`);
  }
  if (obj.schemaVersion !== FILET_PROJECT_ARCHIVE_SCHEMA_VERSION) {
    errors.push(`Versión de esquema incompatible (${String(obj.schemaVersion)}).`);
  }

  // Bloquear explícitamente campos prohibidos (sesiones, XP, GP, operationIds)
  if ("sessions" in obj || "xp_earned" in obj || "gp_earned" in obj || "operationIds" in obj) {
    errors.push("El archivo contiene campos de recompensas/sesiones no permitidos para importación.");
  }

  const pat = obj.pattern as Record<string, unknown> | undefined;
  if (!pat || typeof pat.id !== "string" || typeof pat.title !== "string" || !Array.isArray(pat.versions) || pat.versions.length === 0) {
    errors.push("El bloque `pattern` o sus versiones son inválidos.");
  } else {
    for (const v of pat.versions as FiletPatternVersion[]) {
      const check = validateBinaryMatrix(v.matrix);
      if (!check.valid) {
        errors.push(`Matriz inválida en versión ${v.version}: ${check.errors.join("; ")}`);
      }
    }
  }

  const tech = obj.technicalConfig as Record<string, unknown> | undefined;
  if (!tech || (tech.meshSize !== 3 && tech.meshSize !== 4)) {
    errors.push("`technicalConfig.meshSize` debe ser 3 o 4.");
  }
  if (!tech || (tech.firstRowDirection !== "rtl" && tech.firstRowDirection !== "ltr")) {
    errors.push("`technicalConfig.firstRowDirection` debe ser 'rtl' o 'ltr'.");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    archive: parsed as FiletProjectArchiveFile,
    errors: [],
  };
}

export function detectArchiveImportConflicts(
  workspace: FiletStudioWorkspace,
  archive: FiletProjectArchiveFile
): ArchiveImportConflictReport {
  const match = workspace.patterns.find(
    (p) =>
      p.id === archive.pattern.id ||
      p.title.trim().toLowerCase() === archive.pattern.title.trim().toLowerCase()
  );

  const existingSymbols = new Set<string>();
  for (const col of workspace.collections) {
    for (const g of col.glyphs) {
      existingSymbols.add(g.symbol);
    }
  }
  const duplicateGlyphSymbols = archive.glyphsUsed
    .map((g) => g.symbol)
    .filter((sym) => existingSymbols.has(sym));

  return {
    hasConflict: Boolean(match),
    conflictingPatternId: match?.id,
    conflictingPatternTitle: match?.title,
    duplicateGlyphSymbols: Array.from(new Set(duplicateGlyphSymbols)),
  };
}

export function applyArchiveImportToWorkspace(params: {
  workspace: FiletStudioWorkspace;
  archive: FiletProjectArchiveFile;
  strategy: "abort_on_conflict" | "keep_both" | "overwrite_confirmed";
  nowIso?: string;
}): {
  ok: boolean;
  workspace: FiletStudioWorkspace;
  importedPatternId?: string;
  conflict?: ArchiveImportConflictReport;
  error?: string;
} {
  const conflict = detectArchiveImportConflicts(params.workspace, params.archive);
  if (conflict.hasConflict && params.strategy === "abort_on_conflict") {
    return {
      ok: false,
      workspace: params.workspace,
      conflict,
      error: `Ya existe un patrón con el mismo nombre o ID ("${conflict.conflictingPatternTitle}"). Confirma sobrescribir o importar como copia.`,
    };
  }

  const now = params.nowIso || new Date().toISOString();
  const clonedVersions = params.archive.pattern.versions.map((v) => ({
    ...v,
    matrix: cloneBinaryMatrix(v.matrix),
  }));

  let nextPatterns: FiletVersionedPattern[];
  let importedId = params.archive.pattern.id;

  if (conflict.hasConflict && params.strategy === "overwrite_confirmed") {
    nextPatterns = params.workspace.patterns.map((p) =>
      p.id === conflict.conflictingPatternId
        ? {
            ...p,
            title: params.archive.pattern.title,
            currentVersion: params.archive.pattern.currentVersion,
            versions: clonedVersions,
            updatedAt: now,
          }
        : p
    );
    importedId = conflict.conflictingPatternId || params.archive.pattern.id;
  } else {
    if (conflict.hasConflict) {
      importedId = `${params.archive.pattern.id}-copy-${Date.now().toString(36)}`;
    }
    const newPattern: FiletVersionedPattern = {
      id: importedId,
      title: conflict.hasConflict
        ? `${params.archive.pattern.title} (Importado)`
        : params.archive.pattern.title,
      currentVersion: params.archive.pattern.currentVersion,
      versions: clonedVersions,
      createdAt: now,
      updatedAt: now,
    };
    nextPatterns = [newPattern, ...params.workspace.patterns];
  }

  return {
    ok: true,
    workspace: {
      ...params.workspace,
      patterns: nextPatterns,
      updatedAt: now,
    },
    importedPatternId: importedId,
    conflict,
  };
}
