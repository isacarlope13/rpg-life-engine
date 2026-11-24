/**
 * ============================================================================
 * OAKHAVEN — FILET CROCHET STUDIO FASE 3 (MOTOR DETERMINISTA DE DIGITALIZACIÓN)
 * ============================================================================
 * Motor puro de procesamiento digital de píxeles (RGBA) y calibración de
 * cuadrículas para digitalizar alfabetos históricos de Filet Crochet.
 *
 * Invariantes de ingeniería y seguridad:
 * 1. 100 % determinista (Canvas / RGBA puro): cero Gemini, cero OCR externo, cero APIs pagas.
 * 2. Jamás modifica el documento ni el buffer de imagen original (opera sobre copias/vistas).
 * 3. Jamás suaviza, estiliza, completa ni rediseña automáticamente una letra.
 * 4. La detección automática es estrictamente asistida y señala celdas ambiguas para revisión manual.
 * 5. Permite digitalización 100 % manual cuando la imagen tiene baja calidad.
 */

import { sniffFileMagicBytes, sanitizeSafeFilename } from "../ai/building-resources-engine.ts";
import {
  FILET_MAX_GLYPH_DIM,
  FILET_MIN_DIM,
  cloneBinaryMatrix,
  createEmptyMatrix,
  type BinaryMatrix,
  type FiletAlphabetCollection,
  type FiletCell,
  type FiletGlyph,
} from "./filet-crochet-engine.ts";

// Límites seguros de memoria y procesamiento (Bloque 1 — alineado con Atelier /api/resources)
export const HISTORICAL_DOC_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const HISTORICAL_DOC_MAX_DIMENSION_PX = 4096;
export const HISTORICAL_DOC_MAX_PIXELS = 16_000_000;
export const HISTORICAL_DOC_MAX_PDF_PAGES = 60;

export const HISTORICAL_DOC_ALLOWED_MIMES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type HistoricalDocumentMime = (typeof HISTORICAL_DOC_ALLOWED_MIMES)[number];

export interface RGBAImageData {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface DigitizerRegionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GridCalibrationParams {
  rows: number;
  cols: number;
  originX: number;
  originY: number;
  cellWidth: number;
  cellHeight: number;
  offsetX: number;
  offsetY: number;
  rotationDeg: number;
  gridOpacity: number;
  /** Fracción del margen interior ignorado en cada borde de celda (0..0.40) para evitar líneas de cuadrícula. */
  innerSampleMarginRatio: number;
}

export interface ImageProcessingParams {
  /** Ajuste de contraste (-100..100, 0 = sin cambio). */
  contrast: number;
  /** Umbral de binarización (0..255; píxeles más oscuros que threshold cuentan como tinta). */
  threshold: number;
  /** Invierte blanco/negro antes de umbralizar (útil para gráficos con fondo oscuro y trazo claro). */
  invert: boolean;
  /** Semiancho alrededor de 0.50 de proporción oscura considerado ambiguo (ej. 0.15 => [0.35, 0.65]). */
  ambiguityBand: number;
}

export interface DigitizedCellAnalysis {
  row: number;
  col: number;
  meanLuminance: number;
  darkRatio: number;
  classified: FiletCell;
  ambiguous: boolean;
  confidence: number;
}

export interface DigitizationResult {
  rows: number;
  cols: number;
  detectedMatrix: BinaryMatrix;
  cells: DigitizedCellAnalysis[];
  ambiguousCells: Array<{ row: number; col: number; darkRatio: number }>;
  filledCount: number;
  openCount: number;
  ambiguousCount: number;
}

export interface AssistedGridDetectionResult {
  detected: boolean;
  suggestedOriginX: number;
  suggestedOriginY: number;
  estimatedCellWidth: number;
  estimatedCellHeight: number;
  estimatedCols: number;
  estimatedRows: number;
  verticalLinesCount: number;
  horizontalLinesCount: number;
  confidence: number;
  note: string;
}

export interface HistoricalGlyphProvenance {
  documentId: string;
  documentTitle: string;
  pageNumber: number;
  region: DigitizerRegionRect;
  calibration: GridCalibrationParams;
  processing: ImageProcessingParams;
  /** Matriz inicialmente detectada (o base manual vacía) preservada para comparar y restaurar. */
  initiallyDetectedMatrix: BinaryMatrix;
  style: string;
  variantLabel?: string;
  digitizedAt: string;
  manualModeUsed: boolean;
}

export interface HistoricalDocumentRecord {
  id: string;
  title: string;
  filename: string;
  mimeType: HistoricalDocumentMime;
  sizeBytes: number;
  pageCount: number;
  widthPx?: number;
  heightPx?: number;
  /** Origen del archivo: recurso privado en /api/resources o cargado localmente en sesión. */
  source: "local_private" | "atelier_resource";
  resourceId?: string;
  /** Data URL opcional para imágenes livianas locales (PDFs se mantienen en memoria o Storage privado). */
  previewDataUrl?: string;
  addedAt: string;
}

export interface HistoricalDocumentValidationInput {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  bytes?: Uint8Array;
  widthPx?: number;
  heightPx?: number;
  pageCount?: number;
}

export interface HistoricalDocumentValidationResult {
  valid: boolean;
  safeFilename?: string;
  normalizedMime?: HistoricalDocumentMime;
  error?: string;
}

// ============================================================================
// BLOQUE 1 — VALIDACIÓN ESTRICTA DE DOCUMENTOS HISTÓRICOS
// ============================================================================

export function validateHistoricalDocumentInput(
  input: HistoricalDocumentValidationInput
): HistoricalDocumentValidationResult {
  const { safeName, hasTraversal } = sanitizeSafeFilename(input.filename || "");
  if (hasTraversal) {
    return { valid: false, error: "Nombre de archivo rechazado por intento de path traversal." };
  }

  const ext = safeName.includes(".") ? safeName.split(".").pop()!.toLowerCase() : "";
  const allowedExtByMime: Record<HistoricalDocumentMime, string[]> = {
    "application/pdf": ["pdf"],
    "image/png": ["png"],
    "image/jpeg": ["jpg", "jpeg"],
    "image/webp": ["webp"],
  };

  const mime = (input.mimeType || "").trim().toLowerCase() as HistoricalDocumentMime;
  if (!HISTORICAL_DOC_ALLOWED_MIMES.includes(mime)) {
    return {
      valid: false,
      error: `Formato "${mime || "desconocido"}" no soportado. Solo se admiten PDF, PNG, JPEG y WEBP.`,
    };
  }
  if (!ext || !allowedExtByMime[mime].includes(ext)) {
    return {
      valid: false,
      error: `La extensión ".${ext || "vacía"}" no coincide con el tipo MIME "${mime}".`,
    };
  }

  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return { valid: false, error: "El archivo está vacío o tiene un tamaño inválido." };
  }
  if (input.sizeBytes > HISTORICAL_DOC_MAX_BYTES) {
    return {
      valid: false,
      error: `El archivo excede el límite seguro de ${Math.round(HISTORICAL_DOC_MAX_BYTES / (1024 * 1024))} MB.`,
    };
  }

  if (input.bytes && input.bytes.length > 0) {
    const sniffed = sniffFileMagicBytes(input.bytes);
    if (sniffed !== mime) {
      return {
        valid: false,
        error: `Los magic bytes reales ("${sniffed}") no coinciden con el formato declarado ("${mime}").`,
      };
    }
  }

  if (typeof input.widthPx === "number" && typeof input.heightPx === "number") {
    if (input.widthPx < 4 || input.heightPx < 4) {
      return { valid: false, error: "Las dimensiones de la imagen son demasiado pequeñas (< 4 px)." };
    }
    if (
      input.widthPx > HISTORICAL_DOC_MAX_DIMENSION_PX ||
      input.heightPx > HISTORICAL_DOC_MAX_DIMENSION_PX ||
      input.widthPx * input.heightPx > HISTORICAL_DOC_MAX_PIXELS
    ) {
      return {
        valid: false,
        error: `La imagen (${input.widthPx}×${input.heightPx}) supera el límite seguro de memoria (${HISTORICAL_DOC_MAX_DIMENSION_PX}px o 16 MP).`,
      };
    }
  }

  if (typeof input.pageCount === "number") {
    if (!Number.isInteger(input.pageCount) || input.pageCount < 1) {
      return { valid: false, error: "El documento PDF no contiene páginas válidas." };
    }
    if (input.pageCount > HISTORICAL_DOC_MAX_PDF_PAGES) {
      return {
        valid: false,
        error: `El PDF tiene ${input.pageCount} páginas; el límite seguro por documento es ${HISTORICAL_DOC_MAX_PDF_PAGES}.`,
      };
    }
  }

  return { valid: true, safeFilename: safeName, normalizedMime: mime };
}

// ============================================================================
// BLOQUE 2 — CALIBRACIÓN Y RECORTE DERIVADO (SIN ALTERAR ORIGINAL)
// ============================================================================

export function createDefaultGridCalibration(
  regionWidth = 140,
  regionHeight = 180,
  rows = 9,
  cols = 7
): GridCalibrationParams {
  const safeRows = Math.min(FILET_MAX_GLYPH_DIM, Math.max(FILET_MIN_DIM, Math.floor(rows)));
  const safeCols = Math.min(FILET_MAX_GLYPH_DIM, Math.max(FILET_MIN_DIM, Math.floor(cols)));
  return {
    rows: safeRows,
    cols: safeCols,
    originX: 0,
    originY: 0,
    cellWidth: Math.max(2, Number((regionWidth / safeCols).toFixed(2))),
    cellHeight: Math.max(2, Number((regionHeight / safeRows).toFixed(2))),
    offsetX: 0,
    offsetY: 0,
    rotationDeg: 0,
    gridOpacity: 0.75,
    innerSampleMarginRatio: 0.22,
  };
}

export function createDefaultImageProcessing(): ImageProcessingParams {
  return {
    contrast: 15,
    threshold: 145,
    invert: false,
    ambiguityBand: 0.14,
  };
}

export function clampRegionToImage(
  region: DigitizerRegionRect,
  imageWidth: number,
  imageHeight: number
): DigitizerRegionRect {
  const x = Math.max(0, Math.min(imageWidth - 1, Math.floor(region.x)));
  const y = Math.max(0, Math.min(imageHeight - 1, Math.floor(region.y)));
  const maxW = Math.max(1, imageWidth - x);
  const maxH = Math.max(1, imageHeight - y);
  const width = Math.max(1, Math.min(maxW, Math.floor(region.width)));
  const height = Math.max(1, Math.min(maxH, Math.floor(region.height)));
  return { x, y, width, height };
}

/**
 * Extrae una copia RGBA de la región rectangular seleccionada.
 * Jamás muta la imagen original `source`.
 */
export function extractRegionRGBA(
  source: RGBAImageData,
  region: DigitizerRegionRect
): RGBAImageData {
  const clamped = clampRegionToImage(region, source.width, source.height);
  const out = new Uint8ClampedArray(clamped.width * clamped.height * 4);
  for (let r = 0; r < clamped.height; r++) {
    const srcRowStart = ((clamped.y + r) * source.width + clamped.x) * 4;
    const dstRowStart = r * clamped.width * 4;
    out.set(source.data.subarray(srcRowStart, srcRowStart + clamped.width * 4), dstRowStart);
  }
  return {
    width: clamped.width,
    height: clamped.height,
    data: out,
  };
}

/**
 * Rota una copia RGBA en pasos ortogonales (0, 90, 180, 270) sin alterar la imagen fuente.
 */
export function rotateRGBAOrthogonal(
  source: RGBAImageData,
  degrees: 0 | 90 | 180 | 270
): RGBAImageData {
  const norm = (((degrees % 360) + 360) % 360) as 0 | 90 | 180 | 270;
  if (norm === 0) {
    return {
      width: source.width,
      height: source.height,
      data: new Uint8ClampedArray(source.data),
    };
  }
  const outW = norm === 90 || norm === 270 ? source.height : source.width;
  const outH = norm === 90 || norm === 270 ? source.width : source.height;
  const out = new Uint8ClampedArray(outW * outH * 4);

  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      let nx = x;
      let ny = y;
      if (norm === 90) {
        nx = source.height - 1 - y;
        ny = x;
      } else if (norm === 180) {
        nx = source.width - 1 - x;
        ny = source.height - 1 - y;
      } else if (norm === 270) {
        nx = y;
        ny = source.width - 1 - x;
      }
      const srcIdx = (y * source.width + x) * 4;
      const dstIdx = (ny * outW + nx) * 4;
      out[dstIdx] = source.data[srcIdx];
      out[dstIdx + 1] = source.data[srcIdx + 1];
      out[dstIdx + 2] = source.data[srcIdx + 2];
      out[dstIdx + 3] = source.data[srcIdx + 3];
    }
  }
  return { width: outW, height: outH, data: out };
}

// ============================================================================
// BLOQUE 3 — PROCESAMIENTO DETERMINISTA DE PÍXELES Y CLASIFICACIÓN
// ============================================================================

/**
 * Convierte RGBA a luminancia en escala de grises (0..255) aplicando contraste e inversión.
 */
export function toGrayscaleLuminance(
  image: RGBAImageData,
  params: Pick<ImageProcessingParams, "contrast" | "invert">
): Uint8ClampedArray {
  const pixelCount = image.width * image.height;
  const gray = new Uint8ClampedArray(pixelCount);
  const clampedContrast = Math.max(-100, Math.min(100, params.contrast));
  const cVal = (clampedContrast / 100) * 128;
  const factor = (259 * (cVal + 255)) / (255 * (259 - cVal));

  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;
    const r = image.data[idx];
    const g = image.data[idx + 1];
    const b = image.data[idx + 2];
    let lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (params.invert) {
      lum = 255 - lum;
    }
    if (clampedContrast !== 0) {
      lum = factor * (lum - 128) + 128;
    }
    gray[i] = Math.max(0, Math.min(255, Math.round(lum)));
  }

  return gray;
}

/**
 * Calcula un umbral determinista óptimo (método de Otsu) para imágenes de contraste bajo o variable.
 */
export function autoSuggestThresholdOtsu(gray: Uint8ClampedArray): number {
  if (gray.length === 0) return 128;
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) {
    hist[gray[i]] += 1;
  }

  const total = gray.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];

  let sumB = 0;
  let wB = 0;
  let maxVar = -1;
  let bestT = 128;

  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const betweenVar = wB * wF * (mB - mF) * (mB - mF);
    if (betweenVar > maxVar) {
      maxVar = betweenVar;
      bestT = t;
    }
  }
  return bestT;
}

function findPeriodicLinePositions(
  profile: Float64Array,
  thresholdRatio: number,
  maxLineWidth = 6
): number[] {
  const n = profile.length;
  if (n < 6) return [];
  const positions: number[] = [];
  let inPeak = false;
  let peakStart = 0;

  for (let i = 0; i < n; i++) {
    if (profile[i] >= thresholdRatio) {
      if (!inPeak) {
        inPeak = true;
        peakStart = i;
      }
    } else if (inPeak) {
      const peakWidth = i - peakStart;
      if (peakWidth <= maxLineWidth) {
        positions.push((peakStart + i - 1) / 2);
      }
      inPeak = false;
    }
  }
  if (inPeak) {
    const peakWidth = n - peakStart;
    if (peakWidth <= maxLineWidth) {
      positions.push((peakStart + n - 1) / 2);
    }
  }
  return positions;
}

function medianPositiveGap(positions: number[]): number {
  if (positions.length < 2) return 0;
  const gaps: number[] = [];
  for (let i = 1; i < positions.length; i++) {
    const g = positions[i] - positions[i - 1];
    if (g >= 4) gaps.push(g);
  }
  if (gaps.length === 0) return 0;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

/**
 * Detección asistida (no definitiva) de líneas horizontales y verticales de cuadrícula
 * mediante perfiles de proyección de píxeles oscuros.
 */
export function detectGridLinesAssisted(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  threshold?: number
): AssistedGridDetectionResult {
  const thresh = threshold ?? autoSuggestThresholdOtsu(gray);
  const colDarkRatio = new Float64Array(width);
  const rowDarkRatio = new Float64Array(height);

  for (let y = 0; y < height; y++) {
    let rowDark = 0;
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      if (gray[rowOffset + x] < thresh) {
        rowDark += 1;
        colDarkRatio[x] += 1;
      }
    }
    rowDarkRatio[y] = rowDark / Math.max(1, width);
  }
  for (let x = 0; x < width; x++) {
    colDarkRatio[x] = colDarkRatio[x] / Math.max(1, height);
  }

  // Una línea de cuadrícula atraviesa prácticamente todo el ancho/alto de la región (>= 82 %)
  const lineThreshold = 0.82;
  const vLines = findPeriodicLinePositions(colDarkRatio, lineThreshold);
  const hLines = findPeriodicLinePositions(rowDarkRatio, lineThreshold);

  const estCellW = medianPositiveGap(vLines);
  const estCellH = medianPositiveGap(hLines);

  if (estCellW < 4 || estCellH < 4 || vLines.length < 2 || hLines.length < 2) {
    return {
      detected: false,
      suggestedOriginX: 0,
      suggestedOriginY: 0,
      estimatedCellWidth: Number((width / 7).toFixed(2)),
      estimatedCellHeight: Number((height / 9).toFixed(2)),
      estimatedCols: 7,
      estimatedRows: 9,
      verticalLinesCount: vLines.length,
      horizontalLinesCount: hLines.length,
      confidence: 0,
      note: "No se detectó una cuadrícula regular clara; ajusta filas/columnas manualmente o usa modo manual.",
    };
  }

  let originX = vLines[0];
  let endX = vLines[vLines.length - 1];
  while (originX - estCellW >= 0) {
    const checkStart = Math.max(0, Math.floor(originX - estCellW));
    const checkEnd = Math.min(width - 1, Math.floor(originX));
    let hasDarkBorder = false;
    for (let x = checkStart; x < checkEnd; x++) {
      if (colDarkRatio[x] >= lineThreshold) {
        hasDarkBorder = true;
        break;
      }
    }
    if (!hasDarkBorder) break;
    originX -= estCellW;
  }
  while (endX + estCellW <= width) {
    const checkStart = Math.max(0, Math.floor(endX));
    const checkEnd = Math.min(width, Math.ceil(endX + estCellW));
    let hasDarkBorder = false;
    for (let x = checkStart; x < checkEnd; x++) {
      if (colDarkRatio[x] >= lineThreshold) {
        hasDarkBorder = true;
        break;
      }
    }
    if (!hasDarkBorder) break;
    endX += estCellW;
  }

  let originY = hLines[0];
  let endY = hLines[hLines.length - 1];
  while (originY - estCellH >= 0) {
    const checkStart = Math.max(0, Math.floor(originY - estCellH));
    const checkEnd = Math.min(height - 1, Math.floor(originY));
    let hasDarkBorder = false;
    for (let y = checkStart; y < checkEnd; y++) {
      if (rowDarkRatio[y] >= lineThreshold) {
        hasDarkBorder = true;
        break;
      }
    }
    if (!hasDarkBorder) break;
    originY -= estCellH;
  }
  while (endY + estCellH <= height) {
    const checkStart = Math.max(0, Math.floor(endY));
    const checkEnd = Math.min(height, Math.ceil(endY + estCellH));
    let hasDarkBorder = false;
    for (let y = checkStart; y < checkEnd; y++) {
      if (rowDarkRatio[y] >= lineThreshold) {
        hasDarkBorder = true;
        break;
      }
    }
    if (!hasDarkBorder) break;
    endY += estCellH;
  }

  const spanW = endX - originX;
  const spanH = endY - originY;
  const estCols = Math.min(FILET_MAX_GLYPH_DIM, Math.max(1, Math.round(spanW / estCellW)));
  const estRows = Math.min(FILET_MAX_GLYPH_DIM, Math.max(1, Math.round(spanH / estCellH)));
  const confidence = Number(
    Math.min(1, ((vLines.length + hLines.length) / (estCols + estRows + 2))).toFixed(2)
  );

  return {
    detected: true,
    suggestedOriginX: Number(originX.toFixed(1)),
    suggestedOriginY: Number(originY.toFixed(1)),
    estimatedCellWidth: Number((spanW / estCols).toFixed(2)),
    estimatedCellHeight: Number((spanH / estRows).toFixed(2)),
    estimatedCols: estCols,
    estimatedRows: estRows,
    verticalLinesCount: vLines.length,
    horizontalLinesCount: hLines.length,
    confidence,
    note: `Detección asistida: ${estCols}×${estRows} celdas sugeridas (revisa y ajusta antes de confirmar).`,
  };
}

/**
 * Digitaliza una región RGBA usando los parámetros de calibración y procesamiento.
 * Muestrea el interior de cada celda (excluyendo `innerSampleMarginRatio`) para evitar
 * líneas de cuadrícula delgadas o gruesas, identifica celdas ambiguas y NUNCA suaviza
 * ni rediseña automáticamente la letra.
 */
export function digitizeCalibratedGrid(
  regionImage: RGBAImageData,
  calibration: GridCalibrationParams,
  processing: ImageProcessingParams
): DigitizationResult {
  const rows = Math.min(FILET_MAX_GLYPH_DIM, Math.max(FILET_MIN_DIM, Math.floor(calibration.rows)));
  const cols = Math.min(FILET_MAX_GLYPH_DIM, Math.max(FILET_MIN_DIM, Math.floor(calibration.cols)));
  const cellW = Math.max(1, calibration.cellWidth);
  const cellH = Math.max(1, calibration.cellHeight);
  const marginRatio = Math.max(0, Math.min(0.4, calibration.innerSampleMarginRatio));
  const ambiguityBand = Math.max(0.02, Math.min(0.45, processing.ambiguityBand));
  const threshold = Math.max(0, Math.min(255, processing.threshold));

  const gray = toGrayscaleLuminance(regionImage, {
    contrast: processing.contrast,
    invert: processing.invert,
  });

  const rad = (calibration.rotationDeg * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);
  const centerX = regionImage.width / 2;
  const centerY = regionImage.height / 2;

  const detectedMatrix: BinaryMatrix = createEmptyMatrix(cols, rows, 0, FILET_MAX_GLYPH_DIM);
  const cells: DigitizedCellAnalysis[] = [];
  const ambiguousCells: Array<{ row: number; col: number; darkRatio: number }> = [];
  let filledCount = 0;
  let openCount = 0;

  const baseX = calibration.originX + calibration.offsetX;
  const baseY = calibration.originY + calibration.offsetY;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = baseX + c * cellW + cellW * marginRatio;
      const x1 = baseX + (c + 1) * cellW - cellW * marginRatio;
      const y0 = baseY + r * cellH + cellH * marginRatio;
      const y1 = baseY + (r + 1) * cellH - cellH * marginRatio;

      const startX = Math.floor(Math.min(x0, x1));
      const endX = Math.max(startX, Math.ceil(Math.max(x0, x1)) - 1);
      const startY = Math.floor(Math.min(y0, y1));
      const endY = Math.max(startY, Math.ceil(Math.max(y0, y1)) - 1);

      let sampledCount = 0;
      let darkCount = 0;
      let lumSum = 0;

      for (let py = startY; py <= endY; py++) {
        for (let px = startX; px <= endX; px++) {
          let sx = px;
          let sy = py;
          if (calibration.rotationDeg !== 0) {
            const dx = px - centerX;
            const dy = py - centerY;
            sx = Math.round(centerX + dx * cosA + dy * sinA);
            sy = Math.round(centerY - dx * sinA + dy * cosA);
          }
          if (sx < 0 || sx >= regionImage.width || sy < 0 || sy >= regionImage.height) {
            continue;
          }
          const lum = gray[sy * regionImage.width + sx];
          lumSum += lum;
          if (lum < threshold) darkCount += 1;
          sampledCount += 1;
        }
      }

      const darkRatio = sampledCount > 0 ? darkCount / sampledCount : 0;
      const meanLuminance = sampledCount > 0 ? lumSum / sampledCount : 255;
      const classified: FiletCell = darkRatio >= 0.5 ? 1 : 0;
      const distanceFromBoundary = Math.abs(darkRatio - 0.5);
      const ambiguous = sampledCount === 0 || distanceFromBoundary <= ambiguityBand;
      const confidence = Number(Math.min(1, distanceFromBoundary * 2).toFixed(2));

      detectedMatrix[r][c] = classified;
      if (classified === 1) filledCount += 1;
      else openCount += 1;
      if (ambiguous) {
        ambiguousCells.push({ row: r, col: c, darkRatio: Number(darkRatio.toFixed(3)) });
      }
      cells.push({
        row: r,
        col: c,
        meanLuminance: Number(meanLuminance.toFixed(1)),
        darkRatio: Number(darkRatio.toFixed(3)),
        classified,
        ambiguous,
        confidence,
      });
    }
  }

  return {
    rows,
    cols,
    detectedMatrix,
    cells,
    ambiguousCells,
    filledCount,
    openCount,
    ambiguousCount: ambiguousCells.length,
  };
}

/**
 * Alternativa 100 % manual para imágenes deterioradas o de baja calidad.
 */
export function createManualEmptyDigitization(rows: number, cols: number): DigitizationResult {
  const safeRows = Math.min(FILET_MAX_GLYPH_DIM, Math.max(FILET_MIN_DIM, Math.floor(rows)));
  const safeCols = Math.min(FILET_MAX_GLYPH_DIM, Math.max(FILET_MIN_DIM, Math.floor(cols)));
  const detectedMatrix = createEmptyMatrix(safeCols, safeRows, 0, FILET_MAX_GLYPH_DIM);
  const cells: DigitizedCellAnalysis[] = [];
  for (let r = 0; r < safeRows; r++) {
    for (let c = 0; c < safeCols; c++) {
      cells.push({
        row: r,
        col: c,
        meanLuminance: 255,
        darkRatio: 0,
        classified: 0,
        ambiguous: false,
        confidence: 1,
      });
    }
  }
  return {
    rows: safeRows,
    cols: safeCols,
    detectedMatrix,
    cells,
    ambiguousCells: [],
    filledCount: 0,
    openCount: safeRows * safeCols,
    ambiguousCount: 0,
  };
}

// ============================================================================
// BLOQUE 5 — DETECCIÓN DE DUPLICADOS Y VARIANTES EN BIBLIOTECA HISTÓRICA
// ============================================================================

export function detectDuplicateGlyphInCollection(
  collection: FiletAlphabetCollection,
  symbol: string
): {
  hasDuplicate: boolean;
  existingGlyphs: FiletGlyph[];
  suggestedVariantLabel: string;
} {
  const clean = symbol.trim().toUpperCase();
  const existingGlyphs = collection.glyphs.filter(
    (g) => g.symbol.trim().toUpperCase() === clean
  );
  return {
    hasDuplicate: existingGlyphs.length > 0,
    existingGlyphs,
    suggestedVariantLabel: `Variante ${existingGlyphs.length + 1}`,
  };
}

export function buildConfirmedHistoricalGlyph(params: {
  symbol: string;
  name: string;
  style: string;
  variantLabel?: string;
  confirmedMatrix: BinaryMatrix;
  initiallyDetectedMatrix: BinaryMatrix;
  documentId: string;
  documentTitle: string;
  pageNumber: number;
  region: DigitizerRegionRect;
  calibration: GridCalibrationParams;
  processing: ImageProcessingParams;
  sourceResourceId?: string;
  manualModeUsed: boolean;
  notes?: string;
  nowIso?: string;
}): FiletGlyph {
  const now = params.nowIso ?? new Date().toISOString();
  const cleanSymbol = params.symbol.trim().slice(0, 8);
  if (!cleanSymbol) {
    throw new Error("El carácter del glifo histórico es obligatorio.");
  }
  const confirmed = cloneBinaryMatrix(params.confirmedMatrix);
  const detected = cloneBinaryMatrix(params.initiallyDetectedMatrix);
  const height = confirmed.length;
  const width = confirmed[0]?.length ?? 0;

  return {
    id: `hglyph_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    symbol: cleanSymbol,
    label: (params.name || `Letra ${cleanSymbol}`).trim().slice(0, 80),
    style: (params.style || "Histórico").trim().slice(0, 60),
    variantLabel: params.variantLabel?.trim().slice(0, 40) || undefined,
    width,
    height,
    matrix: cloneBinaryMatrix(confirmed),
    originalReference: {
      sourceType: "alphabet_sheet",
      label: `${params.documentTitle} · Pág. ${params.pageNumber}`.slice(0, 120),
      originalMatrix: cloneBinaryMatrix(confirmed),
      sourceResourceId: params.sourceResourceId,
      notes: params.notes?.trim() || undefined,
      capturedAt: now,
    },
    historicalProvenance: {
      documentId: params.documentId,
      documentTitle: params.documentTitle,
      pageNumber: Math.max(1, Math.floor(params.pageNumber)),
      region: { ...params.region },
      calibration: { ...params.calibration },
      processing: { ...params.processing },
      initiallyDetectedMatrix: detected,
      style: (params.style || "Histórico").trim().slice(0, 60),
      variantLabel: params.variantLabel?.trim().slice(0, 40) || undefined,
      digitizedAt: now,
      manualModeUsed: params.manualModeUsed,
    },
    notes: (params.notes || "").trim().slice(0, 500),
    createdAt: now,
    updatedAt: now,
  };
}
