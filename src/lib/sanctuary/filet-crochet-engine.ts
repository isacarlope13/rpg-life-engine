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

export const FILET_MIN_DIM = 1;
export const FILET_MAX_GLYPH_DIM = 64;
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
  width: number;
  height: number;
  /** Matriz de trabajo actual (copia editable del glifo). */
  matrix: BinaryMatrix;
  /** Referencia y matriz original intacta. */
  originalReference: FiletOriginalReference;
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
  createdAt: string;
  updatedAt: string;
}

export interface FiletStudioWorkspace {
  schemaVersion: 1;
  collections: FiletAlphabetCollection[];
  patterns: FiletVersionedPattern[];
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
    updatedAt: nowIso,
  };
}
