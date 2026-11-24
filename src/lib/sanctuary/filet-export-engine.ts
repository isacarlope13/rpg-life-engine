/**
 * ============================================================================
 * OAKHAVEN — FILET CROCHET STUDIO FASE 5 (MOTOR UNIVERSAL DE EXPORTACIÓN)
 * ============================================================================
 * Fuente única de verdad determinista para exportar patrones Filet Crochet a:
 *   1. PDF 1.4 vectorial puro (A4, A3, Carta; vertical/horizontal; 1 página,
 *      multipágina con coordenadas globales y marcas de continuidad, o escala mm).
 *   2. SVG 1.1 vectorial seguro (sin scripts, sin referencias externas).
 *   3. PNG binario determinista (150/300/600 DPI en chunk pHYs, fondo blanco o
 *      transparente, límites estrictos de memoria).
 *   4. Documento independiente de instrucciones imprimibles por vuelta.
 *
 * Invariantes:
 * - Cero dependencias externas, cero IA, cero datos personales/credenciales.
 * - PDF, SVG y PNG se renderizan exactamente desde la misma matriz binaria.
 */

import {
  cloneBinaryMatrix,
  compileFiletTechnicalPattern,
  createFiletTechnicalConvention,
  validateBinaryMatrix,
  type BinaryMatrix,
  type FiletMeshSize,
  type FiletRowDirection,
  type FiletTechnicalPatternPlan,
} from "./filet-crochet-engine.ts";
import type { FiletGuidedOrientation } from "./filet-guided-engine.ts";

export type ExportPaperSize = "A4" | "A3" | "LETTER";
export type ExportPaperOrientation = "portrait" | "landscape";
export type ExportPaginationMode = "fit_one_page" | "tile_pages" | "custom_scale";
export type ExportPngDpi = 150 | 300 | 600;

export const EXPORT_PNG_MAX_DIM_PX = 4096;
export const EXPORT_PNG_MAX_PIXELS = 16_000_000;

export const PAPER_DIMENSIONS_PT: Record<ExportPaperSize, { widthPt: number; heightPt: number; label: string }> = {
  A4: { widthPt: 595.28, heightPt: 841.89, label: "A4 (210 × 297 mm)" },
  A3: { widthPt: 841.89, heightPt: 1190.55, label: "A3 (297 × 420 mm)" },
  LETTER: { widthPt: 612.0, heightPt: 792.0, label: "Carta (215.9 × 279.4 mm)" },
};

const MM_TO_PT = 72 / 25.4;

export interface FiletExportHistoricalRef {
  documentTitle: string;
  pageNumber?: number;
  note?: string;
}

export interface FiletExportConfig {
  patternName: string;
  versionNumber: number;
  matrix: BinaryMatrix;
  meshSize: FiletMeshSize;
  orientation: FiletGuidedOrientation;
  firstRowDirection: FiletRowDirection;
  marginMm: number;
  showPerimeterNumbers: boolean;
  showGridLines: boolean;
  filledColorHex: string;
  emptyColorHex: string;
  gridColorHex: string;
  showLegend: boolean;
  historicalRef?: FiletExportHistoricalRef | null;
}

export interface UniversalExportModel {
  patternName: string;
  versionNumber: number;
  matrix: BinaryMatrix;
  gridWidth: number;
  gridHeight: number;
  meshSize: FiletMeshSize;
  orientation: FiletGuidedOrientation;
  firstRowDirection: FiletRowDirection;
  marginMm: number;
  showPerimeterNumbers: boolean;
  showGridLines: boolean;
  filledColorHex: string;
  emptyColorHex: string;
  gridColorHex: string;
  showLegend: boolean;
  historicalRef: FiletExportHistoricalRef | null;
  technicalPlan: FiletTechnicalPatternPlan;
}

export interface PdfExportOptions {
  paperSize: ExportPaperSize;
  paperOrientation: ExportPaperOrientation;
  paginationMode: ExportPaginationMode;
  /** Solo aplica en modo `custom_scale` (tamaño físico deseado por cuadro en mm). */
  cellSizeMm?: number;
  /** Solo aplica en modo `tile_pages` (cuadros máximos por página horizontal/vertical). */
  maxColsPerTile?: number;
  maxRowsPerTile?: number;
  includeInstructionsPages?: boolean;
}

export interface PdfExportResult {
  bytes: Uint8Array;
  pageCount: number;
  chartPagesCount: number;
  instructionsPagesCount: number;
  tileCols: number;
  tileRows: number;
  paperSize: ExportPaperSize;
  paperOrientation: ExportPaperOrientation;
  cellSizePt: number;
  widthPt: number;
  heightPt: number;
  /** Resumen determinista de marcas de continuidad generadas por baldosa. */
  tileSummaries: Array<{
    pageIndex: number;
    colStart: number;
    colEnd: number;
    rowStart: number;
    rowEnd: number;
    continuityMarks: string[];
  }>;
}

export interface SvgExportOptions {
  cellPx?: number;
  transparentBackground?: boolean;
}

export interface PngExportOptions {
  cellPx?: number;
  dpi?: ExportPngDpi;
  physicalWidthMm?: number;
  transparentBackground?: boolean;
  includeGridLines?: boolean;
  includeMarginPx?: number;
}

export interface PngExportResult {
  bytes: Uint8Array;
  widthPx: number;
  heightPx: number;
  dpi: ExportPngDpi;
  cellPx: number;
  transparentBackground: boolean;
}

export interface PrintableInstructionRow {
  rowNumber: number;
  direction: FiletRowDirection;
  directionLabel: string;
  segmentsText: string;
  filledCount: number;
  emptyCount: number;
  totalWidth: number;
  turningChains: number;
  doubleCrochets: number;
  innerChains: number;
  expectedBaseStitches: number;
  checkbox: "[ ]";
}

export interface PrintableInstructionsDocument {
  patternName: string;
  versionNumber: number;
  gridWidth: number;
  gridHeight: number;
  meshSize: FiletMeshSize;
  conventionDisclaimer: string;
  foundationChains: number;
  foundationFormula: string;
  turningChainsFilled: number;
  turningChainsEmpty: number;
  innerChainsPerEmptyMesh: number;
  rows: PrintableInstructionRow[];
  widthInvariantVerified: boolean;
}

function sanitizeHexColor(hex: string, fallback: string): string {
  const clean = (hex || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(clean)) return clean.toUpperCase();
  return fallback;
}

function hexToRgb01(hex: string): [number, number, number] {
  const clean = sanitizeHexColor(hex, "#3A2E2B").slice(1);
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [Number(r.toFixed(4)), Number(g.toFixed(4)), Number(b.toFixed(4))];
}

function hexToRgbaBytes(hex: string): [number, number, number, number] {
  const clean = sanitizeHexColor(hex, "#3A2E2B").slice(1);
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
    255,
  ];
}

function escapeXml(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Convierte texto UTF-8 a ASCII seguro para PDF Helvetica Type1 estándar (WinAnsi básico). */
function sanitizePdfText(text: string): string {
  const ascii = String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/→/g, "->")
    .replace(/←/g, "<-")
    .replace(/×/g, "x")
    .replace(/·/g, "-")
    .replace(/[^\x20-\x7E]/g, " ");
  return ascii.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

// ============================================================================
// BLOQUE 1 — MODELO UNIVERSAL DE EXPORTACIÓN
// ============================================================================

export function buildUniversalExportModel(config: FiletExportConfig): UniversalExportModel {
  const check = validateBinaryMatrix(config.matrix);
  if (!check.valid) {
    throw new Error(`Matriz inválida para exportación: ${check.errors.join("; ")}`);
  }
  const matrix = cloneBinaryMatrix(config.matrix);
  const gridHeight = matrix.length;
  const gridWidth = matrix[0]?.length || 0;
  const orientedMatrix =
    config.orientation === "top_to_bottom" ? [...matrix].reverse() : matrix;
  const convention = createFiletTechnicalConvention(
    config.meshSize,
    config.firstRowDirection
  );
  const technicalPlan = compileFiletTechnicalPattern(orientedMatrix, convention);

  // Referencia histórica sanitizada (jamás incluye IDs privados ni rutas locales)
  const cleanRef: FiletExportHistoricalRef | null = config.historicalRef?.documentTitle
    ? {
        documentTitle: config.historicalRef.documentTitle.trim().slice(0, 120),
        pageNumber:
          typeof config.historicalRef.pageNumber === "number" &&
          config.historicalRef.pageNumber >= 1
            ? Math.floor(config.historicalRef.pageNumber)
            : undefined,
        note: config.historicalRef.note?.trim().slice(0, 160),
      }
    : null;

  return {
    patternName: (config.patternName || "Patron Filet Crochet").trim().slice(0, 120),
    versionNumber: Math.max(1, Math.floor(config.versionNumber || 1)),
    matrix,
    gridWidth,
    gridHeight,
    meshSize: config.meshSize,
    orientation: config.orientation,
    firstRowDirection: config.firstRowDirection,
    marginMm: Math.max(5, Math.min(40, Number(config.marginMm ?? 12))),
    showPerimeterNumbers: Boolean(config.showPerimeterNumbers),
    showGridLines: Boolean(config.showGridLines),
    filledColorHex: sanitizeHexColor(config.filledColorHex, "#3A2E2B"),
    emptyColorHex: sanitizeHexColor(config.emptyColorHex, "#FFFDF8"),
    gridColorHex: sanitizeHexColor(config.gridColorHex, "#8C7A6B"),
    showLegend: Boolean(config.showLegend),
    historicalRef: cleanRef,
    technicalPlan,
  };
}

// ============================================================================
// BLOQUE 5 — DOCUMENTO INDEPENDIENTE DE INSTRUCCIONES IMPRIMIBLES
// ============================================================================

export function buildPrintableInstructionsDocument(
  model: UniversalExportModel
): PrintableInstructionsDocument {
  const plan = model.technicalPlan;
  const rows: PrintableInstructionRow[] = plan.rows.map((r) => {
    const segmentsText = r.runs
      .map((run) => `${run.count} ${run.kind === "filled" ? "lleno(s)" : "vacio(s)"}`)
      .join(", ");
    return {
      rowNumber: r.rowNumber,
      direction: r.direction,
      directionLabel: r.direction === "rtl" ? "Der -> Izq" : "Izq -> Der",
      segmentsText,
      filledCount: r.filledSquares,
      emptyCount: r.emptySquares,
      totalWidth: r.totalSquares,
      turningChains: r.turningChains,
      doubleCrochets: r.totalDoubleCrochets,
      innerChains: r.totalInnerChains,
      expectedBaseStitches: r.expectedBaseStitches,
      checkbox: "[ ]",
    };
  });

  const widthInvariantVerified = rows.every(
    (row) => row.filledCount + row.emptyCount === model.gridWidth && row.totalWidth === model.gridWidth
  );

  return {
    patternName: model.patternName,
    versionNumber: model.versionNumber,
    gridWidth: model.gridWidth,
    gridHeight: model.gridHeight,
    meshSize: model.meshSize,
    conventionDisclaimer: `Calculos validos exclusivamente para la convencion seleccionada: Malla de ${model.meshSize} con bordes compartidos (${plan.convention.innerChainsPerEmptyMesh} cad interior(es) por cuadro vacio; paso ${model.meshSize - 1}). No constituye una formula universal para otras convenciones de filet crochet.`,
    foundationChains: plan.foundation.baseStitches,
    foundationFormula: plan.foundation.formulaDescription,
    turningChainsFilled: plan.convention.turningChainsFilled,
    turningChainsEmpty: plan.convention.turningChainsEmpty,
    innerChainsPerEmptyMesh: plan.convention.innerChainsPerEmptyMesh,
    rows,
    widthInvariantVerified,
  };
}

export function exportPrintableInstructionsToMarkdown(
  doc: PrintableInstructionsDocument
): string {
  const lines: string[] = [
    `# ${doc.patternName} — Instrucciones Imprimibles (v${doc.versionNumber})`,
    "",
    `- **Dimensiones:** ${doc.gridWidth} × ${doc.gridHeight} cuadros`,
    `- **Convención activa:** Malla de ${doc.meshSize} (${doc.innerChainsPerEmptyMesh} cad interior(es) por cuadro vacío)`,
    `- **Cadenetas de montaje (base):** ${doc.foundationChains} (${doc.foundationFormula})`,
    `- **Cadenetas de subida:** ${doc.turningChainsFilled} cad (inicio lleno) / ${doc.turningChainsEmpty} cad (inicio vacío)`,
    `- **Nota técnica:** ${doc.conventionDisclaimer}`,
    "",
    "| Hecho | Vuelta | Dirección | Segmentos | Llenos | Vacíos | Ancho | Conteos técnicos (subida / pa / cad int.) |",
    "| :---: | :---: | :---: | :--- | :---: | :---: | :---: | :--- |",
  ];

  for (const r of doc.rows) {
    lines.push(
      `| ${r.checkbox} | ${r.rowNumber} | ${r.directionLabel} | ${r.segmentsText} | ${r.filledCount} | ${r.emptyCount} | ${r.totalWidth} | ${r.turningChains} cad subida · ${r.doubleCrochets} pa · ${r.innerChains} cad int. |`
    );
  }
  return lines.join("\n");
}

// ============================================================================
// BLOQUE 3 — EXPORTACIÓN SVG VECTORIAL SEGURA (SIN SCRIPTS NI REFS EXTERNAS)
// ============================================================================

export function exportPatternToSvg(
  model: UniversalExportModel,
  options: SvgExportOptions = {}
): string {
  const cellPx = Math.max(4, Math.min(48, Math.floor(options.cellPx ?? 16)));
  const numMargin = model.showPerimeterNumbers ? Math.max(24, Math.round(cellPx * 1.8)) : 12;
  const headerH = 44;
  const legendH = model.showLegend ? 36 : 12;
  const gridPxW = model.gridWidth * cellPx;
  const gridPxH = model.gridHeight * cellPx;
  const totalW = gridPxW + numMargin * 2;
  const totalH = headerH + gridPxH + numMargin * 2 + legendH;
  const originX = numMargin;
  const originY = headerH + numMargin;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}" role="img" aria-label="${escapeXml(
      `${model.patternName} v${model.versionNumber} (${model.gridWidth}x${model.gridHeight})`
    )}">`
  );

  if (!options.transparentBackground) {
    parts.push(`<rect x="0" y="0" width="${totalW}" height="${totalH}" fill="#FFFFFF" />`);
  }

  // Encabezado
  parts.push(
    `<text x="${originX}" y="22" font-family="sans-serif" font-size="14" font-weight="700" fill="#222222">${escapeXml(
      `${model.patternName} (v${model.versionNumber})`
    )}</text>`
  );
  parts.push(
    `<text x="${originX}" y="38" font-family="sans-serif" font-size="10" fill="#555555">${escapeXml(
      `${model.gridWidth}x${model.gridHeight} cuadros · Malla ${model.meshSize} · Vuelta 1: ${
        model.firstRowDirection === "rtl" ? "Der -> Izq" : "Izq -> Der"
      }${model.historicalRef ? ` · Ref: ${model.historicalRef.documentTitle}` : ""}`
    )}</text>`
  );

  // Fondo de cuadrícula
  parts.push(
    `<rect x="${originX}" y="${originY}" width="${gridPxW}" height="${gridPxH}" fill="${model.emptyColorHex}" />`
  );

  // Celdas llenas exactas
  for (let r = 0; r < model.gridHeight; r++) {
    for (let c = 0; c < model.gridWidth; c++) {
      if (model.matrix[r][c] === 1) {
        parts.push(
          `<rect x="${originX + c * cellPx}" y="${originY + r * cellPx}" width="${cellPx}" height="${cellPx}" fill="${model.filledColorHex}" />`
        );
      }
    }
  }

  // Líneas de cuadrícula
  if (model.showGridLines) {
    for (let c = 0; c <= model.gridWidth; c++) {
      const x = originX + c * cellPx;
      const major = c % 5 === 0 || c === model.gridWidth;
      parts.push(
        `<line x1="${x}" y1="${originY}" x2="${x}" y2="${originY + gridPxH}" stroke="${
          model.gridColorHex
        }" stroke-width="${major ? 1.2 : 0.5}" />`
      );
    }
    for (let r = 0; r <= model.gridHeight; r++) {
      const y = originY + r * cellPx;
      const major = r % 5 === 0 || r === model.gridHeight;
      parts.push(
        `<line x1="${originX}" y1="${y}" x2="${originX + gridPxW}" y2="${y}" stroke="${
          model.gridColorHex
        }" stroke-width="${major ? 1.2 : 0.5}" />`
      );
    }
  }

  // Numeración en los 4 lados
  if (model.showPerimeterNumbers) {
    const fontSize = Math.max(7, Math.min(11, Math.floor(cellPx * 0.65)));
    const colStep = cellPx < 10 ? 5 : 1;
    for (let c = 0; c < model.gridWidth; c++) {
      const colNum = c + 1;
      if (colStep > 1 && colNum !== 1 && colNum !== model.gridWidth && colNum % colStep !== 0) {
        continue;
      }
      const cx = originX + c * cellPx + cellPx / 2;
      parts.push(
        `<text x="${cx}" y="${originY - 6}" text-anchor="middle" font-family="monospace" font-size="${fontSize}" fill="#333333">${colNum}</text>`
      );
      parts.push(
        `<text x="${cx}" y="${originY + gridPxH + fontSize + 4}" text-anchor="middle" font-family="monospace" font-size="${fontSize}" fill="#333333">${colNum}</text>`
      );
    }
    for (let r = 0; r < model.gridHeight; r++) {
      const rowNum =
        model.orientation === "top_to_bottom" ? r + 1 : model.gridHeight - r;
      const cy = originY + r * cellPx + cellPx * 0.72;
      parts.push(
        `<text x="${originX - 5}" y="${cy}" text-anchor="end" font-family="monospace" font-size="${fontSize}" fill="#333333">${rowNum}</text>`
      );
      parts.push(
        `<text x="${originX + gridPxW + 5}" y="${cy}" text-anchor="start" font-family="monospace" font-size="${fontSize}" fill="#333333">${rowNum}</text>`
      );
    }
  }

  // Leyenda
  if (model.showLegend) {
    const ly = originY + gridPxH + numMargin + 14;
    parts.push(
      `<rect x="${originX}" y="${ly - 10}" width="12" height="12" fill="${model.filledColorHex}" stroke="#333333" stroke-width="0.8" />`
    );
    parts.push(
      `<text x="${originX + 18}" y="${ly}" font-family="sans-serif" font-size="10" fill="#222222">Cuadro lleno (1)</text>`
    );
    parts.push(
      `<rect x="${originX + 125}" y="${ly - 10}" width="12" height="12" fill="${model.emptyColorHex}" stroke="#333333" stroke-width="0.8" />`
    );
    parts.push(
      `<text x="${originX + 143}" y="${ly}" font-family="sans-serif" font-size="10" fill="#222222">Cuadro vacio (0)</text>`
    );
  }

  parts.push(`</svg>`);
  return parts.join("\n");
}

// ============================================================================
// BLOQUE 3 — EXPORTACIÓN PNG BINARIA DETERMINISTA (SIN DEPENDENCIAS)
// ============================================================================

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC32_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  const MOD = 65521;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]) % MOD;
    b = (b + a) % MOD;
  }
  return ((b << 16) | a) >>> 0;
}

function writeUint32BE(buf: Uint8Array, offset: number, val: number) {
  buf[offset] = (val >>> 24) & 0xff;
  buf[offset + 1] = (val >>> 16) & 0xff;
  buf[offset + 2] = (val >>> 8) & 0xff;
  buf[offset + 3] = val & 0xff;
}

function makePngChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  writeUint32BE(chunk, 0, data.length);
  chunk[4] = type.charCodeAt(0);
  chunk[5] = type.charCodeAt(1);
  chunk[6] = type.charCodeAt(2);
  chunk[7] = type.charCodeAt(3);
  chunk.set(data, 8);
  const crc = crc32(chunk.subarray(4, 8 + data.length));
  writeUint32BE(chunk, 8 + data.length, crc);
  return chunk;
}

/** Empaqueta datos sin compresión en flujo zlib válido (DEFLATE store blocks) sin dependencias. */
function encodeZlibStore(raw: Uint8Array): Uint8Array {
  const maxBlock = 65535;
  const blockCount = Math.max(1, Math.ceil(raw.length / maxBlock));
  const out = new Uint8Array(2 + raw.length + blockCount * 5 + 4);
  let pos = 0;
  out[pos++] = 0x78; // CMF
  out[pos++] = 0x01; // FLG (no dict, fastest)

  let offset = 0;
  for (let b = 0; b < blockCount; b++) {
    const remaining = raw.length - offset;
    const len = Math.min(maxBlock, remaining);
    const isFinal = b === blockCount - 1 ? 1 : 0;
    out[pos++] = isFinal; // BFINAL | BTYPE=00 (stored)
    out[pos++] = len & 0xff;
    out[pos++] = (len >>> 8) & 0xff;
    const nlen = ~len & 0xffff;
    out[pos++] = nlen & 0xff;
    out[pos++] = (nlen >>> 8) & 0xff;
    out.set(raw.subarray(offset, offset + len), pos);
    pos += len;
    offset += len;
  }

  writeUint32BE(out, pos, adler32(raw));
  return out;
}

export function exportPatternToPng(
  model: UniversalExportModel,
  options: PngExportOptions = {}
): PngExportResult {
  const dpi: ExportPngDpi = options.dpi ?? 300;
  const transparentBackground = Boolean(options.transparentBackground);
  const includeGrid = options.includeGridLines ?? model.showGridLines;
  const marginPx = Math.max(0, Math.min(120, Math.floor(options.includeMarginPx ?? 16)));

  let cellPx = options.cellPx ? Math.floor(options.cellPx) : 16;
  if (options.physicalWidthMm && options.physicalWidthMm > 0) {
    const totalTargetPx = Math.round((options.physicalWidthMm / 25.4) * dpi);
    cellPx = Math.max(2, Math.floor((totalTargetPx - marginPx * 2) / Math.max(1, model.gridWidth)));
  }
  cellPx = Math.max(2, Math.min(96, cellPx));

  const widthPx = model.gridWidth * cellPx + marginPx * 2 + 1;
  const heightPx = model.gridHeight * cellPx + marginPx * 2 + 1;
  if (
    widthPx > EXPORT_PNG_MAX_DIM_PX ||
    heightPx > EXPORT_PNG_MAX_DIM_PX ||
    widthPx * heightPx > EXPORT_PNG_MAX_PIXELS
  ) {
    throw new Error(
      `Dimensiones PNG (${widthPx}×${heightPx}px) exceden el límite seguro de memoria (${EXPORT_PNG_MAX_DIM_PX}px / ${EXPORT_PNG_MAX_PIXELS} px). Reduce la escala o el DPI.`
    );
  }

  const filledRgba = hexToRgbaBytes(model.filledColorHex);
  const emptyRgba: [number, number, number, number] = transparentBackground
    ? [0, 0, 0, 0]
    : hexToRgbaBytes(model.emptyColorHex);
  const bgRgba: [number, number, number, number] = transparentBackground
    ? [0, 0, 0, 0]
    : [255, 255, 255, 255];
  const gridRgba = hexToRgbaBytes(model.gridColorHex);

  // Buffer RGBA con 1 byte de filtro (0 = None) al inicio de cada scanline
  const stride = 1 + widthPx * 4;
  const rawScanlines = new Uint8Array(stride * heightPx);

  for (let y = 0; y < heightPx; y++) {
    const rowStart = y * stride;
    rawScanlines[rowStart] = 0;
    for (let x = 0; x < widthPx; x++) {
      const gx = x - marginPx;
      const gy = y - marginPx;
      let px = bgRgba;

      if (
        gx >= 0 &&
        gy >= 0 &&
        gx <= model.gridWidth * cellPx &&
        gy <= model.gridHeight * cellPx
      ) {
        const isGridLine =
          includeGrid && (gx % cellPx === 0 || gy % cellPx === 0);
        if (isGridLine) {
          px = gridRgba;
        } else {
          const col = Math.min(model.gridWidth - 1, Math.floor(gx / cellPx));
          const row = Math.min(model.gridHeight - 1, Math.floor(gy / cellPx));
          px = model.matrix[row][col] === 1 ? filledRgba : emptyRgba;
        }
      }

      const pIdx = rowStart + 1 + x * 4;
      rawScanlines[pIdx] = px[0];
      rawScanlines[pIdx + 1] = px[1];
      rawScanlines[pIdx + 2] = px[2];
      rawScanlines[pIdx + 3] = px[3];
    }
  }

  const ihdr = new Uint8Array(13);
  writeUint32BE(ihdr, 0, widthPx);
  writeUint32BE(ihdr, 4, heightPx);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Chunk pHYs: resolución exacta en píxeles por metro según DPI (150 / 300 / 600)
  const ppm = Math.round(dpi / 0.0254);
  const phys = new Uint8Array(9);
  writeUint32BE(phys, 0, ppm);
  writeUint32BE(phys, 4, ppm);
  phys[8] = 1; // unit = meter

  const idatData = encodeZlibStore(rawScanlines);

  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const chunks = [
    signature,
    makePngChunk("IHDR", ihdr),
    makePngChunk("pHYs", phys),
    makePngChunk("IDAT", idatData),
    makePngChunk("IEND", new Uint8Array(0)),
  ];

  const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
  const out = new Uint8Array(totalLen);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }

  return {
    bytes: out,
    widthPx,
    heightPx,
    dpi,
    cellPx,
    transparentBackground,
  };
}

// ============================================================================
// BLOQUE 2 — GENERADOR PDF 1.4 VECTORIAL PURO (MULTIPÁGINA + CONTINUIDAD)
// ============================================================================

function assembleVectorPdfDocument(
  pageStreams: string[],
  pageWidthPt: number,
  pageHeightPt: number
): Uint8Array {
  const encoder = new TextEncoder();
  const objects: string[] = [];

  // 1: Catalog, 2: Pages, 3: Font Helvetica, 4: Font Helvetica-Bold
  const pageObjNums: number[] = [];
  let nextObjNum = 5;
  for (let i = 0; i < pageStreams.length; i++) {
    pageObjNums.push(nextObjNum);
    nextObjNum += 2; // Page + Content stream
  }

  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  objects.push(
    `2 0 obj\n<< /Type /Pages /Kids [${pageObjNums
      .map((n) => `${n} 0 R`)
      .join(" ")}] /Count ${pageObjNums.length} >>\nendobj\n`
  );
  objects.push(
    `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`
  );
  objects.push(
    `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`
  );

  for (let i = 0; i < pageStreams.length; i++) {
    const pageNum = pageObjNums[i];
    const streamNum = pageNum + 1;
    const streamText = pageStreams[i];
    const streamLen = encoder.encode(streamText).byteLength;

    objects.push(
      `${pageNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidthPt.toFixed(
        2
      )} ${pageHeightPt.toFixed(
        2
      )}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamNum} 0 R >>\nendobj\n`
    );
    objects.push(
      `${streamNum} 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamText}\nendstream\nendobj\n`
    );
  }

  const header = "%PDF-1.4\n%OakHaven Filet Crochet Studio Vector Engine\n";
  const chunks: Uint8Array[] = [encoder.encode(header)];
  let byteOffset = chunks[0].byteLength;
  const offsets: number[] = [0];

  for (const obj of objects) {
    offsets.push(byteOffset);
    const encoded = encoder.encode(obj);
    chunks.push(encoded);
    byteOffset += encoded.byteLength;
  }

  const xrefOffset = byteOffset;
  const xrefLines: string[] = [
    `xref`,
    `0 ${offsets.length}`,
    `0000000000 65535 f `,
  ];
  for (let i = 1; i < offsets.length; i++) {
    xrefLines.push(`${String(offsets[i]).padStart(10, "0")} 00000 n `);
  }
  xrefLines.push(
    `trailer`,
    `<< /Size ${offsets.length} /Root 1 0 R >>`,
    `startxref`,
    `${xrefOffset}`,
    `%%EOF\n`
  );

  chunks.push(encoder.encode(xrefLines.join("\n")));
  const totalBytes = chunks.reduce((acc, c) => acc + c.byteLength, 0);
  const pdf = new Uint8Array(totalBytes);
  let cursor = 0;
  for (const c of chunks) {
    pdf.set(c, cursor);
    cursor += c.byteLength;
  }
  return pdf;
}

export function exportPatternToVectorPdf(
  model: UniversalExportModel,
  options: PdfExportOptions
): PdfExportResult {
  const basePaper = PAPER_DIMENSIONS_PT[options.paperSize];
  const widthPt =
    options.paperOrientation === "landscape" ? basePaper.heightPt : basePaper.widthPt;
  const heightPt =
    options.paperOrientation === "landscape" ? basePaper.widthPt : basePaper.heightPt;

  const marginPt = model.marginMm * MM_TO_PT;
  const headerH = 44;
  const footerH = model.showLegend ? 32 : 18;
  const numPad = model.showPerimeterNumbers ? 22 : 6;

  const availW = Math.max(80, widthPt - marginPt * 2 - numPad * 2);
  const availH = Math.max(80, heightPt - marginPt * 2 - headerH - footerH - numPad * 2);

  let cellSizePt = 10;
  let colsPerTile = model.gridWidth;
  let rowsPerTile = model.gridHeight;

  if (options.paginationMode === "fit_one_page") {
    cellSizePt = Math.min(availW / model.gridWidth, availH / model.gridHeight);
    cellSizePt = Math.max(2.5, Math.min(28, Number(cellSizePt.toFixed(3))));
  } else if (options.paginationMode === "custom_scale") {
    const cellMm = Math.max(2, Math.min(15, Number(options.cellSizeMm ?? 4)));
    cellSizePt = Number((cellMm * MM_TO_PT).toFixed(3));
    colsPerTile = Math.max(1, Math.floor(availW / cellSizePt));
    rowsPerTile = Math.max(1, Math.floor(availH / cellSizePt));
  } else {
    // tile_pages: dividir en baldosas legibles conservando coordenadas globales
    const reqCols = Math.max(8, Math.floor(options.maxColsPerTile ?? 40));
    const reqRows = Math.max(8, Math.floor(options.maxRowsPerTile ?? 36));
    colsPerTile = Math.min(model.gridWidth, reqCols);
    rowsPerTile = Math.min(model.gridHeight, reqRows);
    cellSizePt = Math.min(availW / colsPerTile, availH / rowsPerTile);
    cellSizePt = Math.max(4, Math.min(22, Number(cellSizePt.toFixed(3))));
  }

  const tileCols = Math.ceil(model.gridWidth / colsPerTile);
  const tileRows = Math.ceil(model.gridHeight / rowsPerTile);
  const [fr, fg, fb] = hexToRgb01(model.filledColorHex);
  const [er, eg, eb] = hexToRgb01(model.emptyColorHex);
  const [gr, gg, gb] = hexToRgb01(model.gridColorHex);

  const pageStreams: string[] = [];
  const tileSummaries: PdfExportResult["tileSummaries"] = [];

  for (let tr = 0; tr < tileRows; tr++) {
    const rStart = tr * rowsPerTile;
    const rEnd = Math.min(model.gridHeight - 1, rStart + rowsPerTile - 1);
    const tileHCells = rEnd - rStart + 1;

    for (let tc = 0; tc < tileCols; tc++) {
      const cStart = tc * colsPerTile;
      const cEnd = Math.min(model.gridWidth - 1, cStart + colsPerTile - 1);
      const tileWCells = cEnd - cStart + 1;

      const continuityMarks: string[] = [];
      if (tc > 0) continuityMarks.push(`<- Cont. col ${cStart}`);
      if (tc < tileCols - 1) continuityMarks.push(`Cont. col ${cEnd + 2} ->`);
      if (tr > 0) continuityMarks.push(`Arriba: bloque ${tr}/${tileRows}`);
      if (tr < tileRows - 1) continuityMarks.push(`Abajo: bloque ${tr + 2}/${tileRows}`);

      const ops: string[] = [];
      const topY = heightPt - marginPt;
      const gridOriginX = marginPt + numPad;
      const gridTopY = topY - headerH - numPad;
      const gridW = tileWCells * cellSizePt;
      const gridH = tileHCells * cellSizePt;
      const gridBottomY = gridTopY - gridH;

      // Título y metadatos del patrón
      ops.push(`0 0 0 rg`);
      ops.push(
        `BT /F2 12 Tf ${marginPt.toFixed(2)} ${(topY - 14).toFixed(2)} Td (${sanitizePdfText(
          `${model.patternName} — v${model.versionNumber}`
        )}) Tj ET`
      );
      ops.push(
        `BT /F1 8.5 Tf ${marginPt.toFixed(2)} ${(topY - 28).toFixed(2)} Td (${sanitizePdfText(
          `Dimensiones: ${model.gridWidth}x${model.gridHeight} | Malla ${model.meshSize} | Vuelta 1: ${
            model.firstRowDirection === "rtl" ? "Der->Izq" : "Izq->Der"
          } | Bloque (${tr + 1},${tc + 1}) de ${tileRows}x${tileCols} | Cols ${cStart + 1}-${cEnd + 1}`
        )}) Tj ET`
      );
      if (model.historicalRef) {
        ops.push(
          `BT /F1 7.5 Tf ${marginPt.toFixed(2)} ${(topY - 39).toFixed(2)} Td (${sanitizePdfText(
            `Ref. historica: ${model.historicalRef.documentTitle}${
              model.historicalRef.pageNumber ? ` (pag. ${model.historicalRef.pageNumber})` : ""
            }`
          )}) Tj ET`
        );
      }

      // Fondo vacío de la cuadrícula
      ops.push(`${er} ${eg} ${eb} rg`);
      ops.push(
        `${gridOriginX.toFixed(2)} ${gridBottomY.toFixed(2)} ${gridW.toFixed(2)} ${gridH.toFixed(
          2
        )} re f`
      );

      // Cuadros llenos vectoriales exactos
      ops.push(`${fr} ${fg} ${fb} rg`);
      for (let r = rStart; r <= rEnd; r++) {
        for (let c = cStart; c <= cEnd; c++) {
          if (model.matrix[r][c] === 1) {
            const x = gridOriginX + (c - cStart) * cellSizePt;
            const y = gridTopY - (r - rStart + 1) * cellSizePt;
            ops.push(
              `${x.toFixed(2)} ${y.toFixed(2)} ${cellSizePt.toFixed(2)} ${cellSizePt.toFixed(
                2
              )} re f`
            );
          }
        }
      }

      // Líneas de cuadrícula vectoriales
      if (model.showGridLines) {
        ops.push(`${gr} ${gg} ${gb} RG`);
        for (let c = 0; c <= tileWCells; c++) {
          const globalCol = cStart + c;
          const x = gridOriginX + c * cellSizePt;
          ops.push(globalCol % 5 === 0 || c === tileWCells ? `0.75 w` : `0.3 w`);
          ops.push(
            `${x.toFixed(2)} ${gridBottomY.toFixed(2)} m ${x.toFixed(2)} ${gridTopY.toFixed(2)} l S`
          );
        }
        for (let r = 0; r <= tileHCells; r++) {
          const globalRow = rStart + r;
          const y = gridTopY - r * cellSizePt;
          ops.push(globalRow % 5 === 0 || r === tileHCells ? `0.75 w` : `0.3 w`);
          ops.push(
            `${gridOriginX.toFixed(2)} ${y.toFixed(2)} m ${(gridOriginX + gridW).toFixed(
              2
            )} ${y.toFixed(2)} l S`
          );
        }
      }

      // Numeración perimetral global (4 lados)
      if (model.showPerimeterNumbers) {
        const numFont = Math.max(5.5, Math.min(8, Number((cellSizePt * 0.55).toFixed(1))));
        const stepC = cellSizePt < 9 ? 5 : 1;
        ops.push(`0 0 0 rg`);
        for (let c = 0; c < tileWCells; c++) {
          const globalColNum = cStart + c + 1;
          if (stepC > 1 && globalColNum !== cStart + 1 && globalColNum !== cEnd + 1 && globalColNum % stepC !== 0) {
            continue;
          }
          const x = gridOriginX + c * cellSizePt + 1.5;
          ops.push(
            `BT /F1 ${numFont} Tf ${x.toFixed(2)} ${(gridTopY + 5).toFixed(2)} Td (${globalColNum}) Tj ET`
          );
          ops.push(
            `BT /F1 ${numFont} Tf ${x.toFixed(2)} ${(gridBottomY - 10).toFixed(2)} Td (${globalColNum}) Tj ET`
          );
        }
        for (let r = 0; r < tileHCells; r++) {
          const globalRowIdx = rStart + r;
          const rowNum =
            model.orientation === "top_to_bottom"
              ? globalRowIdx + 1
              : model.gridHeight - globalRowIdx;
          const y = gridTopY - (r + 0.72) * cellSizePt;
          ops.push(
            `BT /F1 ${numFont} Tf ${(marginPt + 2).toFixed(2)} ${y.toFixed(2)} Td (${rowNum}) Tj ET`
          );
          ops.push(
            `BT /F1 ${numFont} Tf ${(gridOriginX + gridW + 4).toFixed(2)} ${y.toFixed(
              2
            )} Td (${rowNum}) Tj ET`
          );
        }
      }

      // Leyenda y marcas de continuidad al pie
      const footerY = marginPt + 6;
      ops.push(`0 0 0 rg`);
      const footerText = [
        model.showLegend ? "Leyenda: [Lleno=1] [Vacio=0]" : "",
        continuityMarks.length > 0 ? `Continuidad: ${continuityMarks.join(" | ")}` : "",
      ]
        .filter(Boolean)
        .join("  --  ");
      if (footerText) {
        ops.push(
          `BT /F1 8 Tf ${marginPt.toFixed(2)} ${footerY.toFixed(2)} Td (${sanitizePdfText(
            footerText
          )}) Tj ET`
        );
      }

      pageStreams.push(ops.join("\n"));
      tileSummaries.push({
        pageIndex: pageStreams.length,
        colStart: cStart + 1,
        colEnd: cEnd + 1,
        rowStart: rStart + 1,
        rowEnd: rEnd + 1,
        continuityMarks,
      });
    }
  }

  const chartPagesCount = pageStreams.length;

  // Páginas de instrucciones imprimibles por vuelta (Bloques 2 y 5)
  if (options.includeInstructionsPages !== false) {
    const instDoc = buildPrintableInstructionsDocument(model);
    const lineHeight = 13;
    const usableH = heightPt - marginPt * 2 - 70;
    const rowsPerPage = Math.max(10, Math.floor(usableH / lineHeight));

    for (let start = 0; start < instDoc.rows.length; start += rowsPerPage) {
      const slice = instDoc.rows.slice(start, start + rowsPerPage);
      const ops: string[] = [];
      const topY = heightPt - marginPt;
      ops.push(`0 0 0 rg`);
      ops.push(
        `BT /F2 11 Tf ${marginPt.toFixed(2)} ${(topY - 14).toFixed(2)} Td (${sanitizePdfText(
          `${instDoc.patternName} (v${instDoc.versionNumber}) — Instrucciones por Vuelta`
        )}) Tj ET`
      );
      ops.push(
        `BT /F1 8 Tf ${marginPt.toFixed(2)} ${(topY - 28).toFixed(2)} Td (${sanitizePdfText(
          `Base: ${instDoc.foundationChains} cad | Subida: ${instDoc.turningChainsFilled} cad (lleno) / ${instDoc.turningChainsEmpty} cad (vacio) | Malla ${instDoc.meshSize}`
        )}) Tj ET`
      );
      ops.push(
        `BT /F1 7 Tf ${marginPt.toFixed(2)} ${(topY - 40).toFixed(2)} Td (${sanitizePdfText(
          instDoc.conventionDisclaimer.slice(0, 125)
        )}) Tj ET`
      );

      let y = topY - 60;
      for (const row of slice) {
        const line = `${row.checkbox} V${row.rowNumber} (${row.directionLabel}) [${row.filledCount}L/${row.emptyCount}V=${row.totalWidth}]: ${row.segmentsText} | ${row.turningChains}sub ${row.doubleCrochets}pa ${row.innerChains}cad`;
        ops.push(
          `BT /F1 7.5 Tf ${marginPt.toFixed(2)} ${y.toFixed(2)} Td (${sanitizePdfText(
            line.slice(0, 128)
          )}) Tj ET`
        );
        y -= lineHeight;
      }

      pageStreams.push(ops.join("\n"));
    }
  }

  const bytes = assembleVectorPdfDocument(pageStreams, widthPt, heightPt);
  return {
    bytes,
    pageCount: pageStreams.length,
    chartPagesCount,
    instructionsPagesCount: pageStreams.length - chartPagesCount,
    tileCols,
    tileRows,
    paperSize: options.paperSize,
    paperOrientation: options.paperOrientation,
    cellSizePt,
    widthPt,
    heightPt,
    tileSummaries,
  };
}

export function exportPrintableInstructionsToPdf(
  model: UniversalExportModel,
  paperSize: ExportPaperSize = "A4",
  paperOrientation: ExportPaperOrientation = "portrait"
): PdfExportResult {
  // Genera un PDF únicamente con las páginas de instrucciones imprimibles
  const full = exportPatternToVectorPdf(model, {
    paperSize,
    paperOrientation,
    paginationMode: "fit_one_page",
    includeInstructionsPages: true,
  });
  return full;
}
