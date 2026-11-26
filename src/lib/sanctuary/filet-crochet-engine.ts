/**
 * ============================================================================
 * OAKHAVEN — FILET CROCHET STUDIO (MOTOR PURO DETERMINISTA)
 * ============================================================================
 * Módulo del Atelier de Clara para diseñar, validar, editar y transformar
 * matrices binarias de Filet Crochet (0 = casilla abierta/calada, 1 = llena).
 *
 * Invariantes:
 * 1. 100 % determinista y sin dependencias de IA externa ni servicios pagos.
 * 2. Inmutabilidad estricta: ninguna operación ni transformación muta matrices
 *    de entrada ni `originalReference.originalMatrix`.
 * 3. Base preparada para Fase 2+: patrones versionados, composición de texto
 *    y generación determinista de instrucciones fila por fila (RTL/LTR).
 */

export type FiletCell = 0 | 1;
export type BinaryMatrix = FiletCell[][];

import type { HistoricalGlyphProvenance } from "./filet-digitizer-engine.ts";

export const FILET_MIN_DIM = 1;
export const FILET_MAX_GLYPH_DIM = 160;
export const FILET_MAX_PATTERN_DIM = 200;
export const FILET_DEFAULT_HISTORY_DEPTH = 50;

export type FiletReferenceSourceType =
  | "manual"
  | "imported_grid"
  | "image_reference"
  | "alphabet_sheet";

export interface FiletOriginalReference {
  sourceType: FiletReferenceSourceType;
  label: string;
  /** Matriz original preservada de forma inmutable (las transformaciones operan sobre copias). */
  originalMatrix: BinaryMatrix;
  /** Opcional: ID de recurso en public.building_resources (edificio atelier). */
  sourceResourceId?: string;
  notes?: string;
  capturedAt: string;
}

export interface FiletGlyph {
  id: string;
  symbol: string;
  label: string;
  /** Opcional (Fase 3): estilo tipográfico o histórico (ej. "Gótico", "Floral", "Clásico"). */
  style?: string;
  /** Opcional (Fase 3): etiqueta de variante para caracteres duplicados (ej. "Variante 2"). */
  variantLabel?: string;
  width: number;
  height: number;
  /** Matriz de trabajo actual (copia editable del glifo). */
  matrix: BinaryMatrix;
  /** Referencia y matriz original intacta. */
  originalReference: FiletOriginalReference;
  /** Opcional (Fase 3): trazabilidad completa de digitalización desde documento histórico. */
  historicalProvenance?: HistoricalGlyphProvenance;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface FiletAlphabetCollection {
  id: string;
  name: string;
  description: string;
  defaultWidth: number;
  defaultHeight: number;
  glyphs: FiletGlyph[];
  createdAt: string;
  updatedAt: string;
}

export type FiletRowDirection = "rtl" | "ltr";

export interface FiletRowRun {
  cell: FiletCell;
  count: number;
}

export interface FiletRowInstruction {
  /** Número de vuelta en crochet (1 = fila inferior del gráfico). */
  rowNumber: number;
  /** Índice 0-based dentro de la matriz (0 = fila superior). */
  matrixRowIndex: number;
  direction: FiletRowDirection;
  runs: FiletRowRun[];
  summary: string;
}

export interface FiletPatternCompositionSpec {
  alphabetCollectionId?: string;
  text: string;
  letterSpacingCols: number;
  lineSpacingRows: number;
  borderPadding: number;
  alignment: "left" | "center" | "right";
}

export interface FiletPatternVersion {
  version: number;
  width: number;
  height: number;
  matrix: BinaryMatrix;
  note: string;
  createdAt: string;
}

export interface FiletVersionedPattern {
  id: string;
  title: string;
  linkedProjectId?: string;
  currentVersion: number;
  versions: FiletPatternVersion[];
  composition?: FiletPatternCompositionSpec;
  /** Opcional (Fase 2): snapshot editable del compositor asociado al patrón. */
  composerSnapshot?: FiletComposerSnapshot;
  createdAt: string;
  updatedAt: string;
}

export interface FiletStudioWorkspace {
  schemaVersion: 1;
  collections: FiletAlphabetCollection[];
  patterns: FiletVersionedPattern[];
  /** Opcional (Fase 2): borradores de trabajo del compositor visual. */
  drafts?: FiletComposerDraft[];
  updatedAt: string;
}

export interface MatrixValidationResult {
  valid: boolean;
  width: number;
  height: number;
  filledCount: number;
  openCount: number;
  errors: string[];
}

export interface MatrixHistoryState {
  past: BinaryMatrix[];
  present: BinaryMatrix;
  future: BinaryMatrix[];
  maxDepth: number;
}

// ============================================================================
// VALIDACIÓN Y CONSTRUCCIÓN DE MATRICES BINARIAS
// ============================================================================

export function cloneBinaryMatrix(matrix: BinaryMatrix): BinaryMatrix {
  return matrix.map((row) => row.slice() as FiletCell[]);
}

export function matricesEqual(a: BinaryMatrix, b: BinaryMatrix): boolean {
  if (a.length !== b.length) return false;
  for (let r = 0; r < a.length; r++) {
    if (a[r].length !== b[r].length) return false;
    for (let c = 0; c < a[r].length; c++) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}

export function validateBinaryMatrix(
  matrix: unknown,
  options?: {
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
  }
): MatrixValidationResult {
  const minW = options?.minWidth ?? FILET_MIN_DIM;
  const maxW = options?.maxWidth ?? FILET_MAX_PATTERN_DIM;
  const minH = options?.minHeight ?? FILET_MIN_DIM;
  const maxH = options?.maxHeight ?? FILET_MAX_PATTERN_DIM;
  const errors: string[] = [];

  if (!Array.isArray(matrix) || matrix.length === 0) {
    return {
      valid: false,
      width: 0,
      height: 0,
      filledCount: 0,
      openCount: 0,
      errors: ["La matriz debe ser un arreglo no vacío de filas."],
    };
  }

  const height = matrix.length;
  if (height < minH || height > maxH) {
    errors.push(`La altura (${height}) debe estar entre ${minH} y ${maxH}.`);
  }

  const firstRow = matrix[0];
  if (!Array.isArray(firstRow) || firstRow.length === 0) {
    return {
      valid: false,
      width: 0,
      height,
      filledCount: 0,
      openCount: 0,
      errors: [...errors, "Cada fila debe ser un arreglo no vacío de celdas binarias."],
    };
  }

  const width = firstRow.length;
  if (width < minW || width > maxW) {
    errors.push(`El ancho (${width}) debe estar entre ${minW} y ${maxW}.`);
  }

  let filledCount = 0;
  let openCount = 0;

  for (let r = 0; r < height; r++) {
    const row = matrix[r];
    if (!Array.isArray(row)) {
      errors.push(`La fila ${r + 1} no es un arreglo válido.`);
      continue;
    }
    if (row.length !== width) {
      errors.push(`La fila ${r + 1} tiene ancho ${row.length}, esperado ${width} (matriz irregular).`);
    }
    for (let c = 0; c < row.length; c++) {
      const val = row[c];
      if (val !== 0 && val !== 1) {
        errors.push(`Valor inválido en fila ${r + 1}, columna ${c + 1}: solo se permite 0 o 1.`);
      } else if (val === 1) {
        filledCount += 1;
      } else {
        openCount += 1;
      }
    }
  }

  return {
    valid: errors.length === 0,
    width,
    height,
    filledCount,
    openCount,
    errors,
  };
}

export function createEmptyMatrix(
  width: number,
  height: number,
  fill: FiletCell = 0,
  maxDim: number = FILET_MAX_GLYPH_DIM
): BinaryMatrix {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < FILET_MIN_DIM ||
    height < FILET_MIN_DIM ||
    width > maxDim ||
    height > maxDim
  ) {
    throw new Error(`Dimensiones inválidas (${width}x${height}). Rango permitido: ${FILET_MIN_DIM}..${maxDim}.`);
  }
  const safeFill: FiletCell = fill === 1 ? 1 : 0;
  return Array.from({ length: height }, () => Array<FiletCell>(width).fill(safeFill));
}

export function matrixFromPatternStrings(rows: string[]): BinaryMatrix {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Se requiere al menos una fila de patrón.");
  }
  const matrix: BinaryMatrix = rows.map((line) =>
    Array.from(line).map((ch) => (ch === "1" || ch === "#" || ch === "X" ? 1 : 0))
  );
  const check = validateBinaryMatrix(matrix);
  if (!check.valid) {
    throw new Error(check.errors.join(" "));
  }
  return matrix;
}

// ============================================================================
// EDICIÓN Y REDIMENSIONAMIENTO (INMUTABLES)
// ============================================================================

export function setMatrixCell(
  matrix: BinaryMatrix,
  row: number,
  col: number,
  value: FiletCell
): BinaryMatrix {
  if (row < 0 || row >= matrix.length || col < 0 || col >= (matrix[0]?.length ?? 0)) {
    return cloneBinaryMatrix(matrix);
  }
  const copy = cloneBinaryMatrix(matrix);
  copy[row][col] = value === 1 ? 1 : 0;
  return copy;
}

export function toggleMatrixCell(matrix: BinaryMatrix, row: number, col: number): BinaryMatrix {
  if (row < 0 || row >= matrix.length || col < 0 || col >= (matrix[0]?.length ?? 0)) {
    return cloneBinaryMatrix(matrix);
  }
  const current = matrix[row][col];
  return setMatrixCell(matrix, row, col, current === 1 ? 0 : 1);
}

export function resizeMatrix(
  matrix: BinaryMatrix,
  nextWidth: number,
  nextHeight: number,
  fill: FiletCell = 0,
  maxDim: number = FILET_MAX_GLYPH_DIM
): BinaryMatrix {
  const next = createEmptyMatrix(nextWidth, nextHeight, fill, maxDim);
  const copyH = Math.min(matrix.length, nextHeight);
  const copyW = Math.min(matrix[0]?.length ?? 0, nextWidth);
  for (let r = 0; r < copyH; r++) {
    for (let c = 0; c < copyW; c++) {
      next[r][c] = matrix[r][c] === 1 ? 1 : 0;
    }
  }
  return next;
}

// ============================================================================
// TRANSFORMACIONES PURAS (SIEMPRE SOBRE COPIAS)
// ============================================================================

export function invertMatrix(matrix: BinaryMatrix): BinaryMatrix {
  return matrix.map((row) => row.map((cell) => (cell === 1 ? 0 : 1)));
}

export function flipMatrixHorizontal(matrix: BinaryMatrix): BinaryMatrix {
  return matrix.map((row) => row.slice().reverse() as FiletCell[]);
}

export function flipMatrixVertical(matrix: BinaryMatrix): BinaryMatrix {
  return cloneBinaryMatrix(matrix).reverse();
}

export function rotateMatrix90CW(matrix: BinaryMatrix): BinaryMatrix {
  const height = matrix.length;
  const width = matrix[0]?.length ?? 0;
  if (height === 0 || width === 0) return [];
  const rotated: BinaryMatrix = Array.from({ length: width }, () => Array<FiletCell>(height).fill(0));
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      rotated[c][height - 1 - r] = matrix[r][c];
    }
  }
  return rotated;
}

export function rotateMatrix90CCW(matrix: BinaryMatrix): BinaryMatrix {
  const height = matrix.length;
  const width = matrix[0]?.length ?? 0;
  if (height === 0 || width === 0) return [];
  const rotated: BinaryMatrix = Array.from({ length: width }, () => Array<FiletCell>(height).fill(0));
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      rotated[width - 1 - c][r] = matrix[r][c];
    }
  }
  return rotated;
}

export function shiftMatrix(
  matrix: BinaryMatrix,
  deltaRow: number,
  deltaCol: number,
  wrap = false
): BinaryMatrix {
  const height = matrix.length;
  const width = matrix[0]?.length ?? 0;
  if (height === 0 || width === 0) return [];
  const next: BinaryMatrix = Array.from({ length: height }, () => Array<FiletCell>(width).fill(0));
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const targetR = r + deltaRow;
      const targetC = c + deltaCol;
      if (wrap) {
        const wr = ((targetR % height) + height) % height;
        const wc = ((targetC % width) + width) % width;
        next[wr][wc] = matrix[r][c];
      } else if (targetR >= 0 && targetR < height && targetC >= 0 && targetC < width) {
        next[targetR][targetC] = matrix[r][c];
      }
    }
  }
  return next;
}

export function cropMatrixToContent(matrix: BinaryMatrix, padding = 0): BinaryMatrix {
  const height = matrix.length;
  const width = matrix[0]?.length ?? 0;
  if (height === 0 || width === 0) return [];
  let minR = height;
  let maxR = -1;
  let minC = width;
  let maxC = -1;
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (matrix[r][c] === 1) {
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
    }
  }
  // Si está vacía, devolver copia intacta
  if (maxR < minR || maxC < minC) {
    return cloneBinaryMatrix(matrix);
  }
  const pad = Math.max(0, Math.min(8, Math.floor(padding)));
  const contentH = maxR - minR + 1;
  const contentW = maxC - minC + 1;
  const next = createEmptyMatrix(contentW + pad * 2, contentH + pad * 2, 0, FILET_MAX_PATTERN_DIM);
  for (let r = 0; r < contentH; r++) {
    for (let c = 0; c < contentW; c++) {
      next[r + pad][c + pad] = matrix[minR + r][minC + c];
    }
  }
  return next;
}

// ============================================================================
// HISTORIAL UNDO / REDO DETERMINISTA
// ============================================================================

export function createMatrixHistory(
  initialMatrix: BinaryMatrix,
  maxDepth: number = FILET_DEFAULT_HISTORY_DEPTH
): MatrixHistoryState {
  return {
    past: [],
    present: cloneBinaryMatrix(initialMatrix),
    future: [],
    maxDepth: Math.max(1, Math.floor(maxDepth)),
  };
}

export function pushMatrixHistory(
  history: MatrixHistoryState,
  nextMatrix: BinaryMatrix
): MatrixHistoryState {
  if (matricesEqual(history.present, nextMatrix)) {
    return history;
  }
  const nextPast = [...history.past, cloneBinaryMatrix(history.present)];
  if (nextPast.length > history.maxDepth) {
    nextPast.splice(0, nextPast.length - history.maxDepth);
  }
  return {
    past: nextPast,
    present: cloneBinaryMatrix(nextMatrix),
    future: [],
    maxDepth: history.maxDepth,
  };
}

export function undoMatrixHistory(history: MatrixHistoryState): MatrixHistoryState {
  if (history.past.length === 0) return history;
  const previous = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: cloneBinaryMatrix(previous),
    future: [cloneBinaryMatrix(history.present), ...history.future],
    maxDepth: history.maxDepth,
  };
}

export function redoMatrixHistory(history: MatrixHistoryState): MatrixHistoryState {
  if (history.future.length === 0) return history;
  const next = history.future[0];
  return {
    past: [...history.past, cloneBinaryMatrix(history.present)],
    present: cloneBinaryMatrix(next),
    future: history.future.slice(1),
    maxDepth: history.maxDepth,
  };
}

// ============================================================================
// GLIFOS, REFERENCIAS ORIGINALES INMUTABLES Y COLECCIONES
// ============================================================================

export function createFiletGlyph(params: {
  id?: string;
  symbol: string;
  label?: string;
  width?: number;
  height?: number;
  matrix?: BinaryMatrix;
  sourceType?: FiletReferenceSourceType;
  sourceLabel?: string;
  sourceResourceId?: string;
  notes?: string;
  nowIso?: string;
}): FiletGlyph {
  const cleanSymbol = params.symbol.trim().slice(0, 8);
  if (!cleanSymbol) {
    throw new Error("El símbolo de la letra o motivo es obligatorio.");
  }

  const baseMatrix = params.matrix
    ? cloneBinaryMatrix(params.matrix)
    : createEmptyMatrix(params.width ?? 7, params.height ?? 9, 0, FILET_MAX_GLYPH_DIM);

  const check = validateBinaryMatrix(baseMatrix, {
    maxWidth: FILET_MAX_GLYPH_DIM,
    maxHeight: FILET_MAX_GLYPH_DIM,
  });
  if (!check.valid) {
    throw new Error(check.errors.join(" "));
  }

  const now = params.nowIso ?? new Date().toISOString();
  const id = params.id?.trim() || `glyph_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  return {
    id,
    symbol: cleanSymbol,
    label: (params.label || `Letra ${cleanSymbol}`).trim().slice(0, 80),
    width: check.width,
    height: check.height,
    matrix: cloneBinaryMatrix(baseMatrix),
    originalReference: {
      sourceType: params.sourceType ?? "manual",
      label: (params.sourceLabel || `Referencia original ${cleanSymbol}`).trim().slice(0, 120),
      originalMatrix: cloneBinaryMatrix(baseMatrix),
      sourceResourceId: params.sourceResourceId,
      notes: params.notes?.trim() || undefined,
      capturedAt: now,
    },
    notes: (params.notes || "").trim().slice(0, 500),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Aplica una transformación sobre una COPIA de la matriz de trabajo del glifo.
 * La matriz en `originalReference.originalMatrix` permanece estrictamente intacta.
 */
export function applyTransformToGlyph(
  glyph: FiletGlyph,
  transform: (matrix: BinaryMatrix) => BinaryMatrix,
  nowIso: string = new Date().toISOString()
): FiletGlyph {
  const transformed = transform(cloneBinaryMatrix(glyph.matrix));
  const check = validateBinaryMatrix(transformed, {
    maxWidth: FILET_MAX_GLYPH_DIM,
    maxHeight: FILET_MAX_GLYPH_DIM,
  });
  if (!check.valid) {
    throw new Error(check.errors.join(" "));
  }
  return {
    ...glyph,
    width: check.width,
    height: check.height,
    matrix: cloneBinaryMatrix(transformed),
    originalReference: {
      ...glyph.originalReference,
      originalMatrix: cloneBinaryMatrix(glyph.originalReference.originalMatrix),
    },
    updatedAt: nowIso,
  };
}

/**
 * Restaura la matriz de trabajo del glifo desde una copia limpia de su referencia original.
 */
export function restoreGlyphFromOriginal(
  glyph: FiletGlyph,
  nowIso: string = new Date().toISOString()
): FiletGlyph {
  const restored = cloneBinaryMatrix(glyph.originalReference.originalMatrix);
  return {
    ...glyph,
    width: restored[0]?.length ?? glyph.width,
    height: restored.length,
    matrix: restored,
    originalReference: {
      ...glyph.originalReference,
      originalMatrix: cloneBinaryMatrix(glyph.originalReference.originalMatrix),
    },
    updatedAt: nowIso,
  };
}

export function createAlphabetCollection(params: {
  id?: string;
  name: string;
  description?: string;
  defaultWidth?: number;
  defaultHeight?: number;
  glyphs?: FiletGlyph[];
  nowIso?: string;
}): FiletAlphabetCollection {
  const name = params.name.trim().slice(0, 100);
  if (!name) {
    throw new Error("El nombre de la colección de alfabeto es obligatorio.");
  }
  const defaultWidth = Math.min(FILET_MAX_GLYPH_DIM, Math.max(FILET_MIN_DIM, Math.floor(params.defaultWidth ?? 7)));
  const defaultHeight = Math.min(FILET_MAX_GLYPH_DIM, Math.max(FILET_MIN_DIM, Math.floor(params.defaultHeight ?? 9)));
  const now = params.nowIso ?? new Date().toISOString();

  return {
    id: params.id?.trim() || `alpha_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    description: (params.description || "").trim().slice(0, 300),
    defaultWidth,
    defaultHeight,
    glyphs: (params.glyphs || []).map((g) => ({
      ...g,
      matrix: cloneBinaryMatrix(g.matrix),
      originalReference: {
        ...g.originalReference,
        originalMatrix: cloneBinaryMatrix(g.originalReference.originalMatrix),
      },
    })),
    createdAt: now,
    updatedAt: now,
  };
}

// ============================================================================
// BASE PREPARADA PARA FASE 2+: VERSIONADO, COMPOSICIÓN E INSTRUCCIONES POR FILA
// ============================================================================

/**
 * Genera instrucciones deterministas fila por fila para Filet Crochet:
 * - Fila 1 corresponde a la base inferior del gráfico (orden real de tejido).
 * - Dirección alternada por vuelta (vueltas impares RTL, pares LTR por defecto).
 */
export function generateFiletRowInstructions(
  matrix: BinaryMatrix,
  firstRowDirection: FiletRowDirection = "rtl"
): FiletRowInstruction[] {
  const check = validateBinaryMatrix(matrix);
  if (!check.valid) {
    throw new Error(check.errors.join(" "));
  }

  const instructions: FiletRowInstruction[] = [];
  const height = matrix.length;

  for (let rowNum = 1; rowNum <= height; rowNum++) {
    const matrixRowIndex = height - rowNum;
    const isOdd = rowNum % 2 === 1;
    const direction: FiletRowDirection = isOdd
      ? firstRowDirection
      : firstRowDirection === "rtl"
      ? "ltr"
      : "rtl";

    const rowCells =
      direction === "rtl" ? matrix[matrixRowIndex].slice().reverse() : matrix[matrixRowIndex].slice();

    const runs: FiletRowRun[] = [];
    for (const cell of rowCells) {
      const last = runs[runs.length - 1];
      if (last && last.cell === cell) {
        last.count += 1;
      } else {
        runs.push({ cell, count: 1 });
      }
    }

    const dirLabel = direction === "rtl" ? "Der→Izq" : "Izq→Der";
    const segments = runs.map((run) => `${run.count} ${run.cell === 1 ? "llena" : "calada"}${run.count === 1 ? "" : "s"}`);
    instructions.push({
      rowNumber: rowNum,
      matrixRowIndex,
      direction,
      runs,
      summary: `V${rowNum} (${dirLabel}): ${segments.join(", ")}`,
    });
  }

  return instructions;
}

/**
 * Compone deterministamente una palabra o frase a partir de los glifos de una colección.
 * Base lista para Fase 2 (composición multilínea, bordes y patrones versionados).
 */
export function composeTextFromAlphabet(
  collection: FiletAlphabetCollection,
  spec: FiletPatternCompositionSpec
): { matrix: BinaryMatrix; missingSymbols: string[] } {
  const lookup = new Map<string, FiletGlyph>();
  for (const glyph of collection.glyphs) {
    lookup.set(glyph.symbol.toUpperCase(), glyph);
  }

  const lines = (spec.text || "").split(/\r?\n/);
  const missingSymbols: string[] = [];
  const letterGap = Math.max(0, Math.min(10, Math.floor(spec.letterSpacingCols)));
  const lineGap = Math.max(0, Math.min(10, Math.floor(spec.lineSpacingRows)));
  const border = Math.max(0, Math.min(10, Math.floor(spec.borderPadding)));

  const renderedLines: BinaryMatrix[] = [];

  for (const rawLine of lines) {
    const chars = Array.from(rawLine);
    const lineGlyphs: BinaryMatrix[] = [];
    let lineHeight = collection.defaultHeight;

    for (const ch of chars) {
      if (ch === " ") {
        lineGlyphs.push(createEmptyMatrix(Math.max(2, Math.floor(collection.defaultWidth / 2)), lineHeight, 0));
        continue;
      }
      const found = lookup.get(ch.toUpperCase());
      if (!found) {
        if (!missingSymbols.includes(ch)) missingSymbols.push(ch);
        continue;
      }
      lineHeight = Math.max(lineHeight, found.height);
      lineGlyphs.push(cloneBinaryMatrix(found.matrix));
    }

    if (lineGlyphs.length === 0) {
      renderedLines.push(createEmptyMatrix(1, collection.defaultHeight, 0));
      continue;
    }

    const totalW =
      lineGlyphs.reduce((acc, g) => acc + (g[0]?.length ?? 0), 0) +
      Math.max(0, lineGlyphs.length - 1) * letterGap;
    const lineMat = createEmptyMatrix(totalW, lineHeight, 0, FILET_MAX_PATTERN_DIM);
    let cursorX = 0;

    for (const g of lineGlyphs) {
      const gh = g.length;
      const gw = g[0]?.length ?? 0;
      const offsetY = lineHeight - gh; // Alinear a la línea base inferior
      for (let r = 0; r < gh; r++) {
        for (let c = 0; c < gw; c++) {
          lineMat[offsetY + r][cursorX + c] = g[r][c];
        }
      }
      cursorX += gw + letterGap;
    }

    renderedLines.push(lineMat);
  }

  const maxLineW = Math.max(1, ...renderedLines.map((l) => l[0]?.length ?? 1));
  const totalContentH =
    renderedLines.reduce((acc, l) => acc + l.length, 0) +
    Math.max(0, renderedLines.length - 1) * lineGap;

  const finalMatrix = createEmptyMatrix(
    maxLineW + border * 2,
    totalContentH + border * 2,
    0,
    FILET_MAX_PATTERN_DIM
  );

  let cursorY = border;
  for (const l of renderedLines) {
    const lh = l.length;
    const lw = l[0]?.length ?? 0;
    const offsetX =
      spec.alignment === "center"
        ? border + Math.floor((maxLineW - lw) / 2)
        : spec.alignment === "right"
        ? border + (maxLineW - lw)
        : border;

    for (let r = 0; r < lh; r++) {
      for (let c = 0; c < lw; c++) {
        finalMatrix[cursorY + r][offsetX + c] = l[r][c];
      }
    }
    cursorY += lh + lineGap;
  }

  return { matrix: finalMatrix, missingSymbols };
}

export function createVersionedPattern(params: {
  id?: string;
  title: string;
  matrix: BinaryMatrix;
  linkedProjectId?: string;
  note?: string;
  composition?: FiletPatternCompositionSpec;
  nowIso?: string;
}): FiletVersionedPattern {
  const title = params.title.trim().slice(0, 120);
  if (!title) throw new Error("El título del patrón versionado es obligatorio.");
  const check = validateBinaryMatrix(params.matrix, {
    maxWidth: FILET_MAX_PATTERN_DIM,
    maxHeight: FILET_MAX_PATTERN_DIM,
  });
  if (!check.valid) throw new Error(check.errors.join(" "));
  const now = params.nowIso ?? new Date().toISOString();
  return {
    id: params.id?.trim() || `fpat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title,
    linkedProjectId: params.linkedProjectId,
    currentVersion: 1,
    versions: [
      {
        version: 1,
        width: check.width,
        height: check.height,
        matrix: cloneBinaryMatrix(params.matrix),
        note: (params.note || "Versión inicial").trim().slice(0, 200),
        createdAt: now,
      },
    ],
    composition: params.composition,
    createdAt: now,
    updatedAt: now,
  };
}

export function appendPatternVersion(
  pattern: FiletVersionedPattern,
  nextMatrix: BinaryMatrix,
  note = "",
  nowIso: string = new Date().toISOString()
): FiletVersionedPattern {
  const check = validateBinaryMatrix(nextMatrix, {
    maxWidth: FILET_MAX_PATTERN_DIM,
    maxHeight: FILET_MAX_PATTERN_DIM,
  });
  if (!check.valid) throw new Error(check.errors.join(" "));
  const nextVersion = pattern.currentVersion + 1;
  return {
    ...pattern,
    currentVersion: nextVersion,
    versions: [
      ...pattern.versions.map((v) => ({ ...v, matrix: cloneBinaryMatrix(v.matrix) })),
      {
        version: nextVersion,
        width: check.width,
        height: check.height,
        matrix: cloneBinaryMatrix(nextMatrix),
        note: (note || `Versión ${nextVersion}`).trim().slice(0, 200),
        createdAt: nowIso,
      },
    ],
    updatedAt: nowIso,
  };
}

// ============================================================================
// PLANTILLA INICIAL MÍNIMA (SIN DATOS PERSONALES NI SEMILLAS DE OTROS USUARIOS)
// ============================================================================

export function createStarterFiletWorkspace(nowIso: string = new Date().toISOString()): FiletStudioWorkspace {
  const letterA = matrixFromPatternStrings([
    "0011100",
    "0100010",
    "1000001",
    "1000001",
    "1111111",
    "1000001",
    "1000001",
    "1000001",
    "1000001",
  ]);

  const starterGlyph = createFiletGlyph({
    id: "glyph_starter_A",
    symbol: "A",
    label: "Letra A (Base 7×9)",
    matrix: letterA,
    sourceType: "manual",
    sourceLabel: "Plantilla inicial editable",
    notes: "Ejemplo inicial modificable; su matriz original se conserva intacta al transformar.",
    nowIso,
  });

  const starterCollection = createAlphabetCollection({
    id: "alpha_base_filet",
    name: "Alfabeto Filet Personal",
    description: "Colección inicial de glifos en cuadrícula binaria para proyectos del Atelier.",
    defaultWidth: 7,
    defaultHeight: 9,
    glyphs: [starterGlyph],
    nowIso,
  });

  return {
    schemaVersion: 1,
    collections: [starterCollection],
    patterns: [],
    drafts: [],
    updatedAt: nowIso,
  };
}

// ============================================================================
// FASE 2 — BLOQUE 1: COMPOSITOR VISUAL DETERMINISTA (LIENZO, GLIFOS, ESCALADO)
// ============================================================================

export type FiletBorderStyle = "none" | "open_frame" | "solid_frame";
export type FiletRotationDegrees = 0 | 90 | 180 | 270;
export type FiletHorizontalAlignment = "left" | "center" | "right" | "distribute";
export type FiletVerticalAlignment = "top" | "center" | "bottom";

export interface FiletCanvasSpec {
  width: number;
  height: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  borderStyle: FiletBorderStyle;
  borderThickness: number;
}

export interface FiletPlacedGlyph {
  instanceId: string;
  glyphId: string;
  symbol: string;
  /** Coordenada entera X (columna 0-based en el lienzo). */
  x: number;
  /** Coordenada entera Y (fila 0-based en el lienzo, 0 = superior). */
  y: number;
  rotation: FiletRotationDegrees;
  flipH: boolean;
  flipV: boolean;
  /** Escalado discreto entero (>= 1). Nunca interpola ni deforma silenciosamente. */
  scaleX: number;
  scaleY: number;
}

export interface FiletMissingCharacter {
  char: string;
  normalizedChar: string;
  lineIndex: number;
  charIndex: number;
}

export interface FiletOverflowItem {
  instanceId: string;
  symbol: string;
  x: number;
  y: number;
  width: number;
  height: number;
  overflowLeft: number;
  overflowTop: number;
  overflowRight: number;
  overflowBottom: number;
}

export interface FiletCanvasOverflowReport {
  hasOverflow: boolean;
  requiredWidth: number;
  requiredHeight: number;
  overflowRight: number;
  overflowBottom: number;
  overflowItems: FiletOverflowItem[];
}

export interface FiletComposerSnapshot {
  canvas: FiletCanvasSpec;
  placements: FiletPlacedGlyph[];
  /** Ediciones manuales de celda sobre la composición final ("row,col" -> 0 | 1). */
  cellOverrides: Record<string, FiletCell>;
}

export interface FiletComposerDraft {
  id: string;
  title: string;
  alphabetCollectionId: string;
  phrase: string;
  letterSpacingCols: number;
  wordSpacingCols: number;
  lineSpacingRows: number;
  alignment: FiletHorizontalAlignment;
  verticalAlignment: FiletVerticalAlignment;
  snapshot: FiletComposerSnapshot;
  updatedAt: string;
}

export interface ComposerHistoryState {
  past: FiletComposerSnapshot[];
  present: FiletComposerSnapshot;
  future: FiletComposerSnapshot[];
  maxDepth: number;
}

export function cloneComposerSnapshot(snapshot: FiletComposerSnapshot): FiletComposerSnapshot {
  return {
    canvas: { ...snapshot.canvas },
    placements: snapshot.placements.map((p) => ({ ...p })),
    cellOverrides: { ...snapshot.cellOverrides },
  };
}

export function composerSnapshotsEqual(
  a: FiletComposerSnapshot,
  b: FiletComposerSnapshot
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function createComposerHistory(
  initial: FiletComposerSnapshot,
  maxDepth: number = FILET_DEFAULT_HISTORY_DEPTH
): ComposerHistoryState {
  return {
    past: [],
    present: cloneComposerSnapshot(initial),
    future: [],
    maxDepth: Math.max(1, Math.floor(maxDepth)),
  };
}

export function pushComposerHistory(
  history: ComposerHistoryState,
  next: FiletComposerSnapshot
): ComposerHistoryState {
  if (composerSnapshotsEqual(history.present, next)) return history;
  const nextPast = [...history.past, cloneComposerSnapshot(history.present)];
  if (nextPast.length > history.maxDepth) {
    nextPast.splice(0, nextPast.length - history.maxDepth);
  }
  return {
    past: nextPast,
    present: cloneComposerSnapshot(next),
    future: [],
    maxDepth: history.maxDepth,
  };
}

export function undoComposerHistory(history: ComposerHistoryState): ComposerHistoryState {
  if (history.past.length === 0) return history;
  const prev = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: cloneComposerSnapshot(prev),
    future: [cloneComposerSnapshot(history.present), ...history.future],
    maxDepth: history.maxDepth,
  };
}

export function redoComposerHistory(history: ComposerHistoryState): ComposerHistoryState {
  if (history.future.length === 0) return history;
  const next = history.future[0];
  return {
    past: [...history.past, cloneComposerSnapshot(history.present)],
    present: cloneComposerSnapshot(next),
    future: history.future.slice(1),
    maxDepth: history.maxDepth,
  };
}

/**
 * Escalado discreto estrictamente entero (Kronecker) sobre una COPIA de la matriz.
 * Rechaza factores no enteros, menores a 1 o que excedan FILET_MAX_PATTERN_DIM
 * para impedir interpolación o deformación silenciosa.
 */
export function scaleMatrixDiscrete(
  matrix: BinaryMatrix,
  scaleX: number,
  scaleY: number = scaleX
): BinaryMatrix {
  if (
    !Number.isInteger(scaleX) ||
    !Number.isInteger(scaleY) ||
    scaleX < 1 ||
    scaleY < 1
  ) {
    throw new Error(
      `Escalado discreto inválido (${scaleX}x${scaleY}): solo se permiten enteros positivos >= 1 sin interpolación.`
    );
  }
  const check = validateBinaryMatrix(matrix, {
    maxWidth: FILET_MAX_PATTERN_DIM,
    maxHeight: FILET_MAX_PATTERN_DIM,
  });
  if (!check.valid) {
    throw new Error(check.errors.join(" "));
  }
  const outW = check.width * scaleX;
  const outH = check.height * scaleY;
  if (outW > FILET_MAX_PATTERN_DIM || outH > FILET_MAX_PATTERN_DIM) {
    throw new Error(
      `El escalado discreto (${outW}×${outH}) excede el máximo permitido (${FILET_MAX_PATTERN_DIM}×${FILET_MAX_PATTERN_DIM}).`
    );
  }

  const out: BinaryMatrix = Array.from({ length: outH }, () =>
    Array<FiletCell>(outW).fill(0)
  );
  for (let r = 0; r < check.height; r++) {
    for (let c = 0; c < check.width; c++) {
      const val = matrix[r][c];
      for (let dy = 0; dy < scaleY; dy++) {
        for (let dx = 0; dx < scaleX; dx++) {
          out[r * scaleY + dy][c * scaleX + dx] = val;
        }
      }
    }
  }
  return out;
}

/**
 * Resuelve la matriz transformada de un glifo colocado operando SIEMPRE sobre una copia
 * de `glyph.matrix` (nunca muta `glyph.matrix` ni `glyph.originalReference.originalMatrix`).
 */
export function resolvePlacedGlyphMatrix(
  placement: FiletPlacedGlyph,
  glyph: FiletGlyph
): BinaryMatrix {
  let working = cloneBinaryMatrix(glyph.matrix);
  if (placement.scaleX > 1 || placement.scaleY > 1) {
    working = scaleMatrixDiscrete(working, placement.scaleX, placement.scaleY);
  }
  if (placement.flipH) {
    working = flipMatrixHorizontal(working);
  }
  if (placement.flipV) {
    working = flipMatrixVertical(working);
  }
  const turns = ((placement.rotation / 90) % 4 + 4) % 4;
  for (let i = 0; i < turns; i++) {
    working = rotateMatrix90CW(working);
  }
  return working;
}

export function movePlacedGlyph(
  placements: FiletPlacedGlyph[],
  instanceId: string,
  nextX: number,
  nextY: number
): FiletPlacedGlyph[] {
  const snappedX = Math.round(nextX);
  const snappedY = Math.round(nextY);
  return placements.map((p) =>
    p.instanceId === instanceId ? { ...p, x: snappedX, y: snappedY } : { ...p }
  );
}

export function transformPlacedGlyph(
  placements: FiletPlacedGlyph[],
  instanceId: string,
  operation:
    | { type: "rotate_cw" }
    | { type: "rotate_ccw" }
    | { type: "flip_h" }
    | { type: "flip_v" }
    | { type: "scale"; scaleX: number; scaleY?: number }
): FiletPlacedGlyph[] {
  return placements.map((p) => {
    if (p.instanceId !== instanceId) return { ...p };
    switch (operation.type) {
      case "rotate_cw":
        return {
          ...p,
          rotation: (((p.rotation + 90) % 360) as FiletRotationDegrees),
        };
      case "rotate_ccw":
        return {
          ...p,
          rotation: (((p.rotation + 270) % 360) as FiletRotationDegrees),
        };
      case "flip_h":
        return { ...p, flipH: !p.flipH };
      case "flip_v":
        return { ...p, flipV: !p.flipV };
      case "scale": {
        const sx = operation.scaleX;
        const sy = operation.scaleY ?? sx;
        if (!Number.isInteger(sx) || !Number.isInteger(sy) || sx < 1 || sy < 1 || sx > 6 || sy > 6) {
          throw new Error("El escalado discreto de glifo debe ser un entero entre 1 y 6.");
        }
        return { ...p, scaleX: sx, scaleY: sy };
      }
    }
  });
}

export function createDefaultCanvasSpec(
  width = 80,
  height = 24
): FiletCanvasSpec {
  return {
    width: Math.min(FILET_MAX_PATTERN_DIM, Math.max(FILET_MIN_DIM, Math.floor(width))),
    height: Math.min(FILET_MAX_PATTERN_DIM, Math.max(FILET_MIN_DIM, Math.floor(height))),
    marginTop: 2,
    marginRight: 2,
    marginBottom: 2,
    marginLeft: 2,
    borderStyle: "open_frame",
    borderThickness: 1,
  };
}

/**
 * Alinea o distribuye glifos colocados dentro del área interior del lienzo (respetando márgenes y borde).
 */
export function alignPlacedGlyphs(
  placements: FiletPlacedGlyph[],
  glyphById: Map<string, FiletGlyph>,
  canvas: FiletCanvasSpec,
  mode: "left" | "center_x" | "right" | "top" | "center_y" | "bottom" | "distribute_x",
  targetIds?: string[]
): FiletPlacedGlyph[] {
  if (placements.length === 0) return [];
  const targetSet = targetIds && targetIds.length > 0 ? new Set(targetIds) : null;
  const borderPad = canvas.borderStyle === "none" ? 0 : Math.max(0, canvas.borderThickness);
  const innerLeft = Math.max(0, canvas.marginLeft + borderPad);
  const innerRight = Math.max(innerLeft + 1, canvas.width - canvas.marginRight - borderPad);
  const innerTop = Math.max(0, canvas.marginTop + borderPad);
  const innerBottom = Math.max(innerTop + 1, canvas.height - canvas.marginBottom - borderPad);
  const innerW = innerRight - innerLeft;
  const innerH = innerBottom - innerTop;

  const measured = placements.map((p) => {
    const g = glyphById.get(p.glyphId);
    const mat = g ? resolvePlacedGlyphMatrix(p, g) : [[0 as FiletCell]];
    return {
      placement: { ...p },
      w: mat[0]?.length ?? 1,
      h: mat.length || 1,
      selected: !targetSet || targetSet.has(p.instanceId),
    };
  });

  const active = measured.filter((m) => m.selected);
  if (active.length === 0) return measured.map((m) => m.placement);

  if (mode === "distribute_x" && active.length >= 2) {
    const sorted = [...active].sort((a, b) => a.placement.x - b.placement.x);
    const sumW = sorted.reduce((acc, item) => acc + item.w, 0);
    const availableGap = Math.max(0, innerW - sumW);
    const stepGap = Math.floor(availableGap / (sorted.length - 1));
    let cursorX = innerLeft;
    for (const item of sorted) {
      item.placement.x = cursorX;
      cursorX += item.w + stepGap;
    }
    return measured.map((m) => m.placement);
  }

  const minX = Math.min(...active.map((m) => m.placement.x));
  const maxX = Math.max(...active.map((m) => m.placement.x + m.w));
  const minY = Math.min(...active.map((m) => m.placement.y));
  const maxY = Math.max(...active.map((m) => m.placement.y + m.h));
  const groupW = maxX - minX;
  const groupH = maxY - minY;

  let dx = 0;
  let dy = 0;
  if (mode === "left") dx = innerLeft - minX;
  else if (mode === "center_x") dx = innerLeft + Math.floor((innerW - groupW) / 2) - minX;
  else if (mode === "right") dx = innerRight - groupW - minX;
  else if (mode === "top") dy = innerTop - minY;
  else if (mode === "center_y") dy = innerTop + Math.floor((innerH - groupH) / 2) - minY;
  else if (mode === "bottom") dy = innerBottom - groupH - minY;

  return measured.map((m) =>
    m.selected
      ? { ...m.placement, x: m.placement.x + dx, y: m.placement.y + dy }
      : m.placement
  );
}

/**
 * Renderiza el lienzo compuesto (borde + glifos colocados + ediciones manuales de celda)
 * y calcula el reporte exacto de desbordamiento.
 */
export function renderComposedCanvas(
  canvas: FiletCanvasSpec,
  placements: FiletPlacedGlyph[],
  glyphById: Map<string, FiletGlyph>,
  cellOverrides: Record<string, FiletCell> = {}
): { matrix: BinaryMatrix; overflow: FiletCanvasOverflowReport } {
  const safeW = Math.min(FILET_MAX_PATTERN_DIM, Math.max(FILET_MIN_DIM, Math.floor(canvas.width)));
  const safeH = Math.min(FILET_MAX_PATTERN_DIM, Math.max(FILET_MIN_DIM, Math.floor(canvas.height)));
  const matrix = createEmptyMatrix(safeW, safeH, 0, FILET_MAX_PATTERN_DIM);

  // 1. Borde perimetral configurable (dentro del lienzo)
  const borderThick = Math.max(0, Math.min(6, Math.floor(canvas.borderThickness)));
  if (canvas.borderStyle === "solid_frame" && borderThick > 0) {
    for (let r = 0; r < safeH; r++) {
      for (let c = 0; c < safeW; c++) {
        if (
          r < borderThick ||
          r >= safeH - borderThick ||
          c < borderThick ||
          c >= safeW - borderThick
        ) {
          matrix[r][c] = 1;
        }
      }
    }
  }

  // 2. Componer cada glifo colocado y detectar desbordamientos exactos
  const overflowItems: FiletOverflowItem[] = [];
  let maxRight = safeW;
  let maxBottom = safeH;

  for (const placement of placements) {
    const glyph = glyphById.get(placement.glyphId);
    if (!glyph) continue;
    const gMat = resolvePlacedGlyphMatrix(placement, glyph);
    const gh = gMat.length;
    const gw = gMat[0]?.length ?? 0;

    const overflowLeft = Math.max(0, -placement.x);
    const overflowTop = Math.max(0, -placement.y);
    const overflowRight = Math.max(0, placement.x + gw - safeW);
    const overflowBottom = Math.max(0, placement.y + gh - safeH);

    if (placement.x + gw > maxRight) maxRight = placement.x + gw;
    if (placement.y + gh > maxBottom) maxBottom = placement.y + gh;

    if (overflowLeft > 0 || overflowTop > 0 || overflowRight > 0 || overflowBottom > 0) {
      overflowItems.push({
        instanceId: placement.instanceId,
        symbol: placement.symbol,
        x: placement.x,
        y: placement.y,
        width: gw,
        height: gh,
        overflowLeft,
        overflowTop,
        overflowRight,
        overflowBottom,
      });
    }

    for (let r = 0; r < gh; r++) {
      const targetR = placement.y + r;
      if (targetR < 0 || targetR >= safeH) continue;
      for (let c = 0; c < gw; c++) {
        const targetC = placement.x + c;
        if (targetC < 0 || targetC >= safeW) continue;
        if (gMat[r][c] === 1) {
          matrix[targetR][targetC] = 1;
        }
      }
    }
  }

  // 3. Aplicar ediciones manuales de celda encima de la composición
  for (const [key, val] of Object.entries(cellOverrides)) {
    const [rawR, rawC] = key.split(",");
    const r = Number(rawR);
    const c = Number(rawC);
    if (Number.isInteger(r) && Number.isInteger(c) && r >= 0 && r < safeH && c >= 0 && c < safeW) {
      matrix[r][c] = val === 1 ? 1 : 0;
    }
  }

  return {
    matrix,
    overflow: {
      hasOverflow: overflowItems.length > 0,
      requiredWidth: maxRight,
      requiredHeight: maxBottom,
      overflowRight: Math.max(0, maxRight - safeW),
      overflowBottom: Math.max(0, maxBottom - safeH),
      overflowItems,
    },
  };
}

/**
 * Compone automáticamente nombres o frases sobre un lienzo configurable.
 * REGLA ESTRICTA: cuando falta un carácter en el alfabeto, lo informa en `missingCharacters`
 * y NUNCA lo sustituye silenciosamente (solo aplica `explicitSubstitutions` si la usuaria
 * proporcionó una alternativa explícita).
 */
export function composePhraseOnCanvas(params: {
  collection: FiletAlphabetCollection;
  phrase: string;
  canvas: FiletCanvasSpec;
  letterSpacingCols?: number;
  wordSpacingCols?: number;
  lineSpacingRows?: number;
  alignment?: FiletHorizontalAlignment;
  verticalAlignment?: FiletVerticalAlignment;
  explicitSubstitutions?: Record<string, string>;
}): {
  placements: FiletPlacedGlyph[];
  matrix: BinaryMatrix;
  missingCharacters: FiletMissingCharacter[];
  overflow: FiletCanvasOverflowReport;
} {
  const { collection, phrase, canvas } = params;
  const letterGap = Math.max(0, Math.min(20, Math.floor(params.letterSpacingCols ?? 1)));
  const wordGap = Math.max(1, Math.min(30, Math.floor(params.wordSpacingCols ?? 4)));
  const lineGap = Math.max(0, Math.min(20, Math.floor(params.lineSpacingRows ?? 2)));
  const alignment = params.alignment ?? "center";
  const verticalAlignment = params.verticalAlignment ?? "center";
  const subs = params.explicitSubstitutions || {};

  // Buscar coincidencia exacta primero (para distinguir mayúsculas/minúsculas si el alfabeto las define)
  // y fallback por coincidencia case-insensitive del MISMO carácter si el alfabeto solo tiene un caso.
  const exactLookup = new Map<string, FiletGlyph>();
  const upperLookup = new Map<string, FiletGlyph>();
  const glyphById = new Map<string, FiletGlyph>();
  for (const g of collection.glyphs) {
    exactLookup.set(g.symbol, g);
    if (!upperLookup.has(g.symbol.toUpperCase())) {
      upperLookup.set(g.symbol.toUpperCase(), g);
    }
    glyphById.set(g.id, g);
  }

  const borderPad = canvas.borderStyle === "none" ? 0 : Math.max(0, Math.floor(canvas.borderThickness));
  const innerLeft = Math.max(0, Math.floor(canvas.marginLeft) + borderPad);
  const innerRight = Math.max(innerLeft + 1, Math.floor(canvas.width) - Math.floor(canvas.marginRight) - borderPad);
  const innerTop = Math.max(0, Math.floor(canvas.marginTop) + borderPad);
  const innerBottom = Math.max(innerTop + 1, Math.floor(canvas.height) - Math.floor(canvas.marginBottom) - borderPad);
  const innerW = innerRight - innerLeft;
  const innerH = innerBottom - innerTop;

  const missingCharacters: FiletMissingCharacter[] = [];
  const rawLines = (phrase || "").split(/\r?\n/);

  interface LineEntry {
    items: Array<{ type: "glyph"; glyph: FiletGlyph; instanceId: string } | { type: "space" }>;
    contentWidth: number;
    lineHeight: number;
  }

  const parsedLines: LineEntry[] = [];
  let seq = 0;

  rawLines.forEach((rawLine, lineIndex) => {
    const chars = Array.from(rawLine);
    const items: LineEntry["items"] = [];
    let lineHeight = collection.defaultHeight;

    chars.forEach((ch, charIndex) => {
      if (ch === " ") {
        items.push({ type: "space" });
        return;
      }

      let glyph = exactLookup.get(ch) || upperLookup.get(ch.toUpperCase());
      if (!glyph) {
        const explicitAlt = subs[ch] ?? subs[ch.toUpperCase()];
        if (explicitAlt) {
          glyph = exactLookup.get(explicitAlt) || upperLookup.get(explicitAlt.toUpperCase());
        }
      }

      if (!glyph) {
        missingCharacters.push({
          char: ch,
          normalizedChar: ch.toUpperCase(),
          lineIndex,
          charIndex,
        });
        return;
      }

      seq += 1;
      lineHeight = Math.max(lineHeight, glyph.height);
      items.push({
        type: "glyph",
        glyph,
        instanceId: `placed_${lineIndex}_${charIndex}_${seq}`,
      });
    });

    // Calcular ancho real de la línea con separación exacta entre letras y palabras
    let contentWidth = 0;
    for (let i = 0; i < items.length; i++) {
      const curr = items[i];
      const prev = i > 0 ? items[i - 1] : null;
      if (curr.type === "space") {
        contentWidth += wordGap;
      } else {
        if (prev && prev.type === "glyph") {
          contentWidth += letterGap;
        }
        contentWidth += curr.glyph.width;
      }
    }

    parsedLines.push({ items, contentWidth, lineHeight });
  });

  const totalLinesHeight =
    parsedLines.reduce((acc, l) => acc + l.lineHeight, 0) +
    Math.max(0, parsedLines.length - 1) * lineGap;

  let cursorY =
    verticalAlignment === "center"
      ? innerTop + Math.floor((innerH - totalLinesHeight) / 2)
      : verticalAlignment === "bottom"
      ? innerBottom - totalLinesHeight
      : innerTop;

  const placements: FiletPlacedGlyph[] = [];

  for (const line of parsedLines) {
    const glyphItems = line.items.filter(
      (i): i is { type: "glyph"; glyph: FiletGlyph; instanceId: string } => i.type === "glyph"
    );

    if (alignment === "distribute" && glyphItems.length >= 2) {
      const sumW = glyphItems.reduce((acc, g) => acc + g.glyph.width, 0);
      const extraGap = Math.max(letterGap, Math.floor((innerW - sumW) / (glyphItems.length - 1)));
      let cursorX = innerLeft;
      for (const item of glyphItems) {
        placements.push({
          instanceId: item.instanceId,
          glyphId: item.glyph.id,
          symbol: item.glyph.symbol,
          x: cursorX,
          y: cursorY + (line.lineHeight - item.glyph.height),
          rotation: 0,
          flipH: false,
          flipV: false,
          scaleX: 1,
          scaleY: 1,
        });
        cursorX += item.glyph.width + extraGap;
      }
    } else {
      let cursorX =
        alignment === "center"
          ? innerLeft + Math.floor((innerW - line.contentWidth) / 2)
          : alignment === "right"
          ? innerRight - line.contentWidth
          : innerLeft;

      for (let i = 0; i < line.items.length; i++) {
        const curr = line.items[i];
        const prev = i > 0 ? line.items[i - 1] : null;
        if (curr.type === "space") {
          cursorX += wordGap;
        } else {
          if (prev && prev.type === "glyph") {
            cursorX += letterGap;
          }
          placements.push({
            instanceId: curr.instanceId,
            glyphId: curr.glyph.id,
            symbol: curr.glyph.symbol,
            x: cursorX,
            y: cursorY + (line.lineHeight - curr.glyph.height),
            rotation: 0,
            flipH: false,
            flipV: false,
            scaleX: 1,
            scaleY: 1,
          });
          cursorX += curr.glyph.width;
        }
      }
    }

    cursorY += line.lineHeight + lineGap;
  }

  const rendered = renderComposedCanvas(canvas, placements, glyphById, {});
  return {
    placements,
    matrix: rendered.matrix,
    missingCharacters,
    overflow: rendered.overflow,
  };
}

// ============================================================================
// FASE 2 — BLOQUE 3: MOTOR TÉCNICO DE FILET CROCHET (SEPARADO DE MATRIZ VISUAL)
// ============================================================================

export type FiletMeshSize = 3 | 4;

export interface FiletTechnicalConvention {
  /** 3 posiciones = 1 pa + 1 cad + 1 pa (paso 2); 4 posiciones = 1 pa + 2 cad + 1 pa (paso 3). */
  meshSize: FiletMeshSize;
  /** Los postes verticales entre cuadros contiguos son compartidos. */
  sharedEdges: true;
  /** Cadenas interiores en cada cuadro vacío (1 en malla de 3; 2 en malla de 4). */
  innerChainsPerEmptyMesh: 1 | 2;
  /** Puntos altos interiores en cada cuadro lleno (1 en malla de 3; 2 en malla de 4). */
  innerDcPerFilledMesh: 1 | 2;
  /** Avance en puntos base por cada cuadro adicional compartiendo el borde izquierdo/derecho. */
  stepStitchesPerMesh: 2 | 3;
  /** Cadenetas de subida si la vuelta inicia en cuadro lleno (reemplaza 1er pa). */
  turningChainsFilled: 3;
  /** Cadenetas de subida si la vuelta inicia en cuadro vacío (3 cad de altura + cadenas interiores). */
  turningChainsEmpty: 4 | 5;
  /** Dirección de lectura de la vuelta 1 (base inferior). */
  firstRowDirection: FiletRowDirection;
}

export interface FiletFoundationSpec {
  gridWidth: number;
  baseStitches: number;
  startingCell: FiletCell;
  turningChains: number;
  totalFoundationChains: number;
  formulaDescription: string;
}

export interface FiletCompiledRun {
  cell: FiletCell;
  kind: "filled" | "empty";
  count: number;
  /** Puntos altos (pa) adicionales consumidos en esta secuencia (sin contar el borde inicial de vuelta). */
  additionalDcCount: number;
  /** Cadenetas interiores totales en esta secuencia. */
  innerChainsCount: number;
}

export interface FiletRowRunSequence {
  direction: FiletRowDirection;
  totalSquares: number;
  filledSquares: number;
  emptySquares: number;
  runs: FiletCompiledRun[];
  shortNotation: string;
}

export interface FiletTechnicalRowPlan {
  rowNumber: number;
  matrixRowIndex: number;
  direction: FiletRowDirection;
  startingCell: FiletCell;
  turningChains: number;
  expectedBaseStitches: number;
  totalSquares: number;
  filledSquares: number;
  emptySquares: number;
  totalDoubleCrochets: number;
  totalInnerChains: number;
  runs: FiletCompiledRun[];
  instructionText: string;
}

export interface FiletTechnicalPatternPlan {
  convention: FiletTechnicalConvention;
  gridWidth: number;
  gridHeight: number;
  foundation: FiletFoundationSpec;
  totalSquares: number;
  totalFilledSquares: number;
  totalEmptySquares: number;
  rows: FiletTechnicalRowPlan[];
}

export function createFiletTechnicalConvention(
  meshSize: FiletMeshSize = 3,
  firstRowDirection: FiletRowDirection = "rtl"
): FiletTechnicalConvention {
  if (meshSize === 4) {
    return {
      meshSize: 4,
      sharedEdges: true,
      innerChainsPerEmptyMesh: 2,
      innerDcPerFilledMesh: 2,
      stepStitchesPerMesh: 3,
      turningChainsFilled: 3,
      turningChainsEmpty: 5,
      firstRowDirection,
    };
  }
  return {
    meshSize: 3,
    sharedEdges: true,
    innerChainsPerEmptyMesh: 1,
    innerDcPerFilledMesh: 1,
    stepStitchesPerMesh: 2,
    turningChainsFilled: 3,
    turningChainsEmpty: 4,
    firstRowDirection,
  };
}

export function calculateFiletFoundationSpec(
  gridWidth: number,
  startingCell: FiletCell,
  convention: FiletTechnicalConvention
): FiletFoundationSpec {
  if (!Number.isInteger(gridWidth) || gridWidth < 1) {
    throw new Error("El ancho en cuadros debe ser un entero positivo.");
  }
  const baseStitches = gridWidth * convention.stepStitchesPerMesh + 1;
  const turningChains =
    startingCell === 1 ? convention.turningChainsFilled : convention.turningChainsEmpty;
  const totalFoundationChains = baseStitches + turningChains;
  const formulaDescription = `Malla de ${convention.meshSize} con bordes compartidos: (${gridWidth} × ${convention.stepStitchesPerMesh}) + 1 = ${baseStitches} puntos base + ${turningChains} cad de subida = ${totalFoundationChains} cadenetas iniciales.`;

  return {
    gridWidth,
    baseStitches,
    startingCell,
    turningChains,
    totalFoundationChains,
    formulaDescription,
  };
}

/**
 * Compila una fila binaria en secuencias consecutivas de cuadros llenos y vacíos
 * en lectura normal (`ltr`: izquierda→derecha) o invertida (`rtl`: derecha→izquierda).
 */
export function compileFiletRowRuns(
  row: FiletCell[],
  direction: FiletRowDirection,
  convention: FiletTechnicalConvention = createFiletTechnicalConvention(3)
): FiletRowRunSequence {
  if (!Array.isArray(row) || row.length === 0) {
    throw new Error("La fila debe contener al menos un cuadro binario.");
  }
  const ordered = direction === "rtl" ? row.slice().reverse() : row.slice();
  const runs: FiletCompiledRun[] = [];
  let filledSquares = 0;
  let emptySquares = 0;

  for (const cell of ordered) {
    if (cell !== 0 && cell !== 1) {
      throw new Error("Cada cuadro de la fila debe ser 0 (vacío) o 1 (lleno).");
    }
    if (cell === 1) filledSquares += 1;
    else emptySquares += 1;

    const last = runs[runs.length - 1];
    if (last && last.cell === cell) {
      last.count += 1;
    } else {
      runs.push({
        cell,
        kind: cell === 1 ? "filled" : "empty",
        count: 1,
        additionalDcCount: 0,
        innerChainsCount: 0,
      });
    }
  }

  // Calcular puntos técnicos exactos con bordes compartidos por secuencia
  for (const run of runs) {
    if (run.cell === 1) {
      // Cada cuadro lleno aporta (innerDcPerFilledMesh) interiores + 1 poste de cierre compartido
      run.additionalDcCount = run.count * convention.stepStitchesPerMesh;
      run.innerChainsCount = 0;
    } else {
      // Cada cuadro vacío aporta (innerChainsPerEmptyMesh) cadenas interiores + 1 poste de cierre compartido
      run.additionalDcCount = run.count;
      run.innerChainsCount = run.count * convention.innerChainsPerEmptyMesh;
    }
  }

  const shortNotation = runs
    .map((r) => `${r.count} ${r.kind === "filled" ? (r.count === 1 ? "lleno" : "llenos") : r.count === 1 ? "vacío" : "vacíos"}`)
    .join(", ");

  return {
    direction,
    totalSquares: ordered.length,
    filledSquares,
    emptySquares,
    runs,
    shortNotation,
  };
}

export function compileFiletTechnicalRow(
  row: FiletCell[],
  rowNumber: number,
  matrixRowIndex: number,
  direction: FiletRowDirection,
  convention: FiletTechnicalConvention
): FiletTechnicalRowPlan {
  const compiled = compileFiletRowRuns(row, direction, convention);
  const startingCell: FiletCell = compiled.runs[0].cell;
  const turningChains =
    startingCell === 1 ? convention.turningChainsFilled : convention.turningChainsEmpty;

  // Primer poste vertical lo aporta las 3 cadenetas de subida; el resto son los additionalDcCount
  const totalDoubleCrochets =
    1 + compiled.runs.reduce((acc, r) => acc + r.additionalDcCount, 0);
  const totalInnerChains = compiled.runs.reduce((acc, r) => acc + r.innerChainsCount, 0);
  const expectedBaseStitches = compiled.totalSquares * convention.stepStitchesPerMesh + 1;
  const dirLabel = direction === "rtl" ? "Der→Izq (invertida)" : "Izq→Der (normal)";

  const instructionText = `V${rowNumber} [${dirLabel}] · Subir ${turningChains} cad (${
    startingCell === 1 ? "inicio lleno" : `inicio vacío, ${convention.innerChainsPerEmptyMesh} cad int.`
  }) → ${compiled.shortNotation} · Total: ${compiled.totalSquares} cuadros (${totalDoubleCrochets} pa incl. subida, ${totalInnerChains} cad int.).`;

  return {
    rowNumber,
    matrixRowIndex,
    direction,
    startingCell,
    turningChains,
    expectedBaseStitches,
    totalSquares: compiled.totalSquares,
    filledSquares: compiled.filledSquares,
    emptySquares: compiled.emptySquares,
    totalDoubleCrochets,
    totalInnerChains,
    runs: compiled.runs,
    instructionText,
  };
}

/**
 * Compila una matriz visual completa en un plan técnico de ejecución de Filet Crochet,
 * separando completamente la matriz binaria de la convención de malla (3 o 4 posiciones).
 */
export function compileFiletTechnicalPattern(
  matrix: BinaryMatrix,
  convention: FiletTechnicalConvention = createFiletTechnicalConvention(3, "rtl")
): FiletTechnicalPatternPlan {
  const check = validateBinaryMatrix(matrix, {
    maxWidth: FILET_MAX_PATTERN_DIM,
    maxHeight: FILET_MAX_PATTERN_DIM,
  });
  if (!check.valid) {
    throw new Error(check.errors.join(" "));
  }

  const rows: FiletTechnicalRowPlan[] = [];
  for (let rowNumber = 1; rowNumber <= check.height; rowNumber++) {
    const matrixRowIndex = check.height - rowNumber;
    const isOdd = rowNumber % 2 === 1;
    const direction: FiletRowDirection = isOdd
      ? convention.firstRowDirection
      : convention.firstRowDirection === "rtl"
      ? "ltr"
      : "rtl";

    rows.push(
      compileFiletTechnicalRow(
        matrix[matrixRowIndex],
        rowNumber,
        matrixRowIndex,
        direction,
        convention
      )
    );
  }

  const foundation = calculateFiletFoundationSpec(
    check.width,
    rows[0].startingCell,
    convention
  );

  return {
    convention,
    gridWidth: check.width,
    gridHeight: check.height,
    foundation,
    totalSquares: check.width * check.height,
    totalFilledSquares: check.filledCount,
    totalEmptySquares: check.openCount,
    rows,
  };
}
