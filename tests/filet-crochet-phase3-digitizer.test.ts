import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  compileFiletTechnicalPattern,
  composePhraseOnCanvas,
  createAlphabetCollection,
  createDefaultCanvasSpec,
  createFiletTechnicalConvention,
  createMatrixHistory,
  createStarterFiletWorkspace,
  matricesEqual,
  matrixFromPatternStrings,
  pushMatrixHistory,
  toggleMatrixCell,
  undoMatrixHistory,
  type BinaryMatrix,
} from "../src/lib/sanctuary/filet-crochet-engine.ts";
import {
  HISTORICAL_DOC_MAX_BYTES,
  HISTORICAL_DOC_MAX_DIMENSION_PX,
  HISTORICAL_DOC_MAX_PDF_PAGES,
  autoSuggestThresholdOtsu,
  buildConfirmedHistoricalGlyph,
  createDefaultGridCalibration,
  createDefaultImageProcessing,
  createManualEmptyDigitization,
  detectDuplicateGlyphInCollection,
  detectGridLinesAssisted,
  digitizeCalibratedGrid,
  extractRegionRGBA,
  rotateRGBAOrthogonal,
  toGrayscaleLuminance,
  validateHistoricalDocumentInput,
  type HistoricalDocumentRecord,
  type RGBAImageData,
} from "../src/lib/sanctuary/filet-digitizer-engine.ts";
import {
  readFiletStudioWorkspace,
  readHistoricalDocuments,
  saveFiletStudioWorkspace,
  saveHistoricalDocuments,
} from "../src/lib/sanctuary/filet-crochet-store.ts";
import { validatePrivateResourceFile } from "../src/lib/ai/building-resources-engine.ts";
import type { SessionStorage } from "../src/lib/sanctuary/session-storage.ts";

function createMemoryStorage(): SessionStorage {
  const map = new Map<string, string>();
  return {
    getItem(k: string) {
      return map.has(k) ? map.get(k)! : null;
    },
    setItem(k: string, v: string) {
      map.set(k, v);
      return true;
    },
  };
}

/**
 * Generador de imágenes RGBA sintéticas de prueba (cuadrícula + celdas llenas/vacías/ambiguas).
 * No utiliza alfabetos históricos inventados; solo patrones geométricos sintéticos para QA.
 */
function renderSyntheticGridImage(params: {
  matrix: BinaryMatrix;
  cellW: number;
  cellH: number;
  lineThickness?: number;
  bgLum?: number;
  fillLum?: number;
  lineLum?: number;
  ambiguousCell?: { row: number; col: number };
}): RGBAImageData {
  const rows = params.matrix.length;
  const cols = params.matrix[0].length;
  const lineW = params.lineThickness ?? 1;
  const bgLum = params.bgLum ?? 245;
  const fillLum = params.fillLum ?? 25;
  const lineLum = params.lineLum ?? 40;

  const width = cols * params.cellW + lineW;
  const height = rows * params.cellH + lineW;
  const data = new Uint8ClampedArray(width * height * 4);

  const setPx = (x: number, y: number, lum: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const i = (y * width + x) * 4;
    data[i] = lum;
    data[i + 1] = lum;
    data[i + 2] = lum;
    data[i + 3] = 255;
  };

  // Fondo
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) setPx(x, y, bgLum);
  }

  // Relleno de celdas
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = c * params.cellW;
      const y0 = r * params.cellH;
      const isAmb =
        params.ambiguousCell &&
        params.ambiguousCell.row === r &&
        params.ambiguousCell.col === c;
      if (isAmb) {
        // Mitad izquierda oscura, mitad derecha clara => ~50% oscuro (celda ambigua)
        for (let dy = 0; dy < params.cellH; dy++) {
          for (let dx = 0; dx < params.cellW; dx++) {
            setPx(x0 + dx, y0 + dy, dx < params.cellW / 2 ? fillLum : bgLum);
          }
        }
      } else if (params.matrix[r][c] === 1) {
        for (let dy = 0; dy < params.cellH; dy++) {
          for (let dx = 0; dx < params.cellW; dx++) {
            setPx(x0 + dx, y0 + dy, fillLum);
          }
        }
      }
    }
  }

  // Líneas de cuadrícula (delgadas o gruesas)
  for (let c = 0; c <= cols; c++) {
    const gx = c * params.cellW;
    for (let t = 0; t < lineW; t++) {
      for (let y = 0; y < height; y++) setPx(gx + t, y, lineLum);
    }
  }
  for (let r = 0; r <= rows; r++) {
    const gy = r * params.cellH;
    for (let t = 0; t < lineW; t++) {
      for (let x = 0; x < width; x++) setPx(x, gy + t, lineLum);
    }
  }

  return { width, height, data };
}

describe("OAKHAVEN — FILET CROCHET STUDIO FASE 3 (DIGITALIZADOR HISTÓRICO)", () => {
  test("1. Cuadrículas de distintos tamaños + líneas delgadas (1px) y gruesas (4px) + detección asistida", () => {
    const smallMat = matrixFromPatternStrings([
      "10101",
      "01010",
      "11111",
      "00100",
    ]);
    const largerMat = matrixFromPatternStrings([
      "11111111",
      "10000001",
      "10111101",
      "10100101",
      "10111101",
      "10000001",
      "11111111",
    ]);

    // Líneas delgadas (1px)
    const thinImg = renderSyntheticGridImage({
      matrix: smallMat,
      cellW: 20,
      cellH: 20,
      lineThickness: 1,
    });
    const thinCal = {
      ...createDefaultGridCalibration(thinImg.width, thinImg.height, 4, 5),
      cellWidth: 20,
      cellHeight: 20,
      innerSampleMarginRatio: 0.25,
    };
    const thinRes = digitizeCalibratedGrid(thinImg, thinCal, createDefaultImageProcessing());
    assert.equal(matricesEqual(thinRes.detectedMatrix, smallMat), true);
    assert.equal(thinRes.ambiguousCount, 0);

    // Líneas gruesas (4px) en cuadrícula más grande (7x8)
    const thickImg = renderSyntheticGridImage({
      matrix: largerMat,
      cellW: 24,
      cellH: 24,
      lineThickness: 4,
    });
    const thickCal = {
      ...createDefaultGridCalibration(thickImg.width, thickImg.height, 7, 8),
      cellWidth: 24,
      cellHeight: 24,
      innerSampleMarginRatio: 0.28,
    };
    const thickRes = digitizeCalibratedGrid(thickImg, thickCal, createDefaultImageProcessing());
    assert.equal(matricesEqual(thickRes.detectedMatrix, largerMat), true);

    // Detección asistida de líneas
    const gray = toGrayscaleLuminance(thickImg, { contrast: 0, invert: false });
    const assisted = detectGridLinesAssisted(gray, thickImg.width, thickImg.height, 128);
    assert.equal(assisted.detected, true);
    assert.equal(assisted.estimatedCols, 8);
    assert.equal(assisted.estimatedRows, 7);
  });

  test("2. Contraste bajo (Otsu), imágenes invertidas y detección de celdas ambiguas", () => {
    const pattern = matrixFromPatternStrings([
      "110",
      "010",
      "011",
    ]);

    // Contraste bajo (fondo 185, tinta 140)
    const lowContrastImg = renderSyntheticGridImage({
      matrix: pattern,
      cellW: 20,
      cellH: 20,
      lineThickness: 1,
      bgLum: 185,
      fillLum: 140,
      lineLum: 150,
    });
    const grayLow = toGrayscaleLuminance(lowContrastImg, { contrast: 45, invert: false });
    const otsuLow = autoSuggestThresholdOtsu(grayLow);
    const lowRes = digitizeCalibratedGrid(
      lowContrastImg,
      {
        ...createDefaultGridCalibration(lowContrastImg.width, lowContrastImg.height, 3, 3),
        cellWidth: 20,
        cellHeight: 20,
      },
      { contrast: 45, threshold: otsuLow, invert: false, ambiguityBand: 0.14 }
    );
    assert.equal(matricesEqual(lowRes.detectedMatrix, pattern), true);

    // Imagen invertida (fondo negro 20, celdas llenas blancas 235)
    const invertedImg = renderSyntheticGridImage({
      matrix: pattern,
      cellW: 20,
      cellH: 20,
      lineThickness: 1,
      bgLum: 20,
      fillLum: 235,
      lineLum: 60,
    });
    const invRes = digitizeCalibratedGrid(
      invertedImg,
      {
        ...createDefaultGridCalibration(invertedImg.width, invertedImg.height, 3, 3),
        cellWidth: 20,
        cellHeight: 20,
      },
      { contrast: 20, threshold: 128, invert: true, ambiguityBand: 0.14 }
    );
    assert.equal(matricesEqual(invRes.detectedMatrix, pattern), true);

    // Celda ambigua en (1, 0)
    const ambImg = renderSyntheticGridImage({
      matrix: pattern,
      cellW: 24,
      cellH: 24,
      lineThickness: 1,
      ambiguousCell: { row: 1, col: 0 },
    });
    const ambRes = digitizeCalibratedGrid(
      ambImg,
      {
        ...createDefaultGridCalibration(ambImg.width, ambImg.height, 3, 3),
        cellWidth: 24,
        cellHeight: 24,
      },
      createDefaultImageProcessing()
    );
    assert.ok(ambRes.ambiguousCount >= 1);
    assert.ok(ambRes.ambiguousCells.some((c) => c.row === 1 && c.col === 0));
  });

  test("3. Selección rectangular, recorte, rotación sin alterar original y corrección manual", () => {
    const sheetMat = matrixFromPatternStrings([
      "000000",
      "011000",
      "010000",
      "000000",
    ]);
    const originalSheet = renderSyntheticGridImage({
      matrix: sheetMat,
      cellW: 20,
      cellH: 20,
      lineThickness: 1,
    });
    const originalSnapshot = new Uint8ClampedArray(originalSheet.data);

    // Recortar solo la subregión 2x2 de la esquina superior-interior (col 1..2, row 1..2)
    const cropped = extractRegionRGBA(originalSheet, { x: 20, y: 20, width: 41, height: 41 });
    assert.equal(cropped.width, 41);
    assert.equal(cropped.height, 41);

    // Rotar copia 90° y verificar que el buffer original permanece idéntico byte a byte
    const rotated = rotateRGBAOrthogonal(originalSheet, 90);
    assert.equal(rotated.width, originalSheet.height);
    assert.deepEqual(originalSheet.data, originalSnapshot);

    const detected = digitizeCalibratedGrid(
      cropped,
      { ...createDefaultGridCalibration(41, 41, 2, 2), cellWidth: 20, cellHeight: 20 },
      createDefaultImageProcessing()
    );
    assert.deepEqual(detected.detectedMatrix, [
      [1, 1],
      [1, 0],
    ]);

    // Corrección manual + Undo/Redo + modo 100 % manual
    let hist = createMatrixHistory(detected.detectedMatrix);
    hist = pushMatrixHistory(hist, toggleMatrixCell(hist.present, 1, 1));
    assert.equal(hist.present[1][1], 1);
    hist = undoMatrixHistory(hist);
    assert.equal(hist.present[1][1], 0);

    const manualEmpty = createManualEmptyDigitization(5, 4);
    assert.equal(manualEmpty.filledCount, 0);
    assert.equal(manualEmpty.openCount, 20);
  });

  test("4. Importaciones inválidas rechazadas (magic bytes falsos, path traversal, exceso de tamaño/dimensiones/páginas)", () => {
    const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    const EXE_MAGIC = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);

    assert.equal(
      validateHistoricalDocumentInput({
        filename: "alfabeto.png",
        mimeType: "image/png",
        sizeBytes: 50_000,
        bytes: PNG_MAGIC,
        widthPx: 800,
        heightPx: 600,
      }).valid,
      true
    );

    assert.equal(
      validateHistoricalDocumentInput({
        filename: "manual_1920.pdf",
        mimeType: "application/pdf",
        sizeBytes: 250_000,
        bytes: PDF_MAGIC,
        pageCount: 12,
      }).valid,
      true
    );

    // EXE disfrazado de PNG
    assert.equal(
      validateHistoricalDocumentInput({
        filename: "falso.png",
        mimeType: "image/png",
        sizeBytes: 2048,
        bytes: EXE_MAGIC,
      }).valid,
      false
    );

    // Path traversal
    assert.equal(
      validateHistoricalDocumentInput({
        filename: "../../etc/passwd.png",
        mimeType: "image/png",
        sizeBytes: 1024,
        bytes: PNG_MAGIC,
      }).valid,
      false
    );

    // Exceso de tamaño, dimensiones y páginas
    assert.equal(
      validateHistoricalDocumentInput({
        filename: "grande.pdf",
        mimeType: "application/pdf",
        sizeBytes: HISTORICAL_DOC_MAX_BYTES + 1,
      }).valid,
      false
    );
    assert.equal(
      validateHistoricalDocumentInput({
        filename: "gigante.png",
        mimeType: "image/png",
        sizeBytes: 100_000,
        widthPx: HISTORICAL_DOC_MAX_DIMENSION_PX + 100,
        heightPx: 1000,
      }).valid,
      false
    );
    assert.equal(
      validateHistoricalDocumentInput({
        filename: "muchas.pdf",
        mimeType: "application/pdf",
        sizeBytes: 100_000,
        pageCount: HISTORICAL_DOC_MAX_PDF_PAGES + 1,
      }).valid,
      false
    );

    // Validación en biblioteca privada del Atelier (rechaza otros edificios)
    const userA = "11111111-1111-4111-8111-111111111111";
    assert.equal(
      validatePrivateResourceFile({
        buildingId: "atelier",
        resourceType: "historical_alphabet_document",
        filename: "lamina.pdf",
        reportedMimeType: "application/pdf",
        sizeBytes: 200_000,
        ownerId: userA,
        authenticatedUserId: userA,
        fileBytes: PDF_MAGIC,
      }).valid,
      true
    );
    assert.equal(
      validatePrivateResourceFile({
        buildingId: "banco_oakhaven",
        resourceType: "historical_alphabet_document",
        filename: "lamina.pdf",
        reportedMimeType: "application/pdf",
        sizeBytes: 200_000,
        ownerId: userA,
        authenticatedUserId: userA,
        fileBytes: PDF_MAGIC,
      }).valid,
      false
    );
  });

  test("5. Persistencia, recuperación tras recarga, duplicados/variantes, aislamiento entre usuarios e integración con compositor", () => {
    const storage = createMemoryStorage();
    const userA = "11111111-1111-4111-8111-111111111111";
    const userB = "22222222-2222-4222-8222-222222222222";

    const docRecord: HistoricalDocumentRecord = {
      id: "hdoc_test_1",
      title: "Lámina de Prueba Sintética",
      filename: "lamina.png",
      mimeType: "image/png",
      sizeBytes: 32_000,
      pageCount: 2,
      widthPx: 400,
      heightPx: 300,
      source: "local_private",
      addedAt: "2026-11-23T00:00:00.000Z",
    };

    assert.equal(saveHistoricalDocuments(storage, userA, [docRecord]).ok, true);
    assert.equal(readHistoricalDocuments(storage, userA).length, 1);
    assert.equal(readHistoricalDocuments(storage, userB).length, 0);

    const detectedM1 = matrixFromPatternStrings(["111", "101", "111"]);
    const confirmedM1 = toggleMatrixCell(detectedM1, 1, 1); // Corrección manual
    const detectedM2 = matrixFromPatternStrings(["101", "010", "101"]);

    const glyph1 = buildConfirmedHistoricalGlyph({
      symbol: "M",
      name: "Motivo M",
      style: "Sintético QA",
      confirmedMatrix: confirmedM1,
      initiallyDetectedMatrix: detectedM1,
      documentId: docRecord.id,
      documentTitle: docRecord.title,
      pageNumber: 1,
      region: { x: 10, y: 10, width: 60, height: 60 },
      calibration: createDefaultGridCalibration(60, 60, 3, 3),
      processing: createDefaultImageProcessing(),
      manualModeUsed: false,
    });

    let col = createAlphabetCollection({
      id: "col_hist_qa",
      name: "Colección Digitalizada QA",
      defaultWidth: 3,
      defaultHeight: 3,
      glyphs: [glyph1],
    });

    // Duplicado detectado -> guardar variante
    const dup = detectDuplicateGlyphInCollection(col, "M");
    assert.equal(dup.hasDuplicate, true);
    assert.equal(dup.suggestedVariantLabel, "Variante 2");

    const glyph1Variant = buildConfirmedHistoricalGlyph({
      symbol: "M",
      name: "Motivo M (Var 2)",
      style: "Sintético QA",
      variantLabel: dup.suggestedVariantLabel,
      confirmedMatrix: detectedM1,
      initiallyDetectedMatrix: detectedM1,
      documentId: docRecord.id,
      documentTitle: docRecord.title,
      pageNumber: 1,
      region: { x: 80, y: 10, width: 60, height: 60 },
      calibration: createDefaultGridCalibration(60, 60, 3, 3),
      processing: createDefaultImageProcessing(),
      manualModeUsed: false,
    });

    const glyph2 = buildConfirmedHistoricalGlyph({
      symbol: "X",
      name: "Motivo X",
      style: "Sintético QA",
      confirmedMatrix: detectedM2,
      initiallyDetectedMatrix: detectedM2,
      documentId: docRecord.id,
      documentTitle: docRecord.title,
      pageNumber: 1,
      region: { x: 150, y: 10, width: 60, height: 60 },
      calibration: createDefaultGridCalibration(60, 60, 3, 3),
      processing: createDefaultImageProcessing(),
      manualModeUsed: false,
    });

    col = { ...col, glyphs: [glyph1, glyph1Variant, glyph2] };

    const ws = {
      ...createStarterFiletWorkspace(),
      collections: [col],
    };
    assert.equal(saveFiletStudioWorkspace(storage, userA, ws).ok, true);

    // Simular recarga completa de aplicación para userA y aislamiento para userB
    const reloadedA = readFiletStudioWorkspace(storage, userA);
    assert.ok(reloadedA);
    assert.equal(readFiletStudioWorkspace(storage, userB), null);
    assert.equal(reloadedA.collections[0].glyphs.length, 3);
    assert.equal(reloadedA.collections[0].glyphs[0].historicalProvenance?.documentId, docRecord.id);
    assert.equal(reloadedA.collections[0].glyphs[0].historicalProvenance?.pageNumber, 1);
    assert.equal(
      matricesEqual(
        reloadedA.collections[0].glyphs[0].historicalProvenance!.initiallyDetectedMatrix,
        detectedM1
      ),
      true
    );
    assert.equal(reloadedA.collections[0].glyphs[1].variantLabel, "Variante 2");

    // Integración inmediata con el Compositor Visual + Motor Técnico
    const composed = composePhraseOnCanvas({
      collection: reloadedA.collections[0],
      phrase: "MX",
      canvas: createDefaultCanvasSpec(20, 10),
      letterSpacingCols: 1,
    });
    assert.equal(composed.missingCharacters.length, 0);
    assert.equal(composed.placements.length, 2);
    const tech = compileFiletTechnicalPattern(
      composed.matrix,
      createFiletTechnicalConvention(3, "rtl")
    );
    assert.equal(tech.gridWidth, 20);
    assert.equal(tech.rows.length, 10);
  });

  test("6. Rendimiento (32×32 sobre región 640×640) y seguridad PDF.js local (sin CDN ni IA externa)", () => {
    const bigMat = matrixFromPatternStrings(
      Array.from({ length: 32 }, (_, r) =>
        Array.from({ length: 32 }, (_, c) => ((r + c) % 2 === 0 ? "1" : "0")).join("")
      )
    );
    const bigImg = renderSyntheticGridImage({
      matrix: bigMat,
      cellW: 20,
      cellH: 20,
      lineThickness: 2,
    });

    const start = performance.now();
    const res = digitizeCalibratedGrid(
      bigImg,
      {
        ...createDefaultGridCalibration(bigImg.width, bigImg.height, 32, 32),
        cellWidth: 20,
        cellHeight: 20,
      },
      createDefaultImageProcessing()
    );
    const elapsedMs = performance.now() - start;

    assert.equal(matricesEqual(res.detectedMatrix, bigMat), true);
    assert.ok(elapsedMs < 300, `Digitalización 32x32 en 640x640px debe ser rápida (${elapsedMs.toFixed(1)}ms)`);

    // Verificar seguridad de pdf-local-renderer.ts y filet-historical-digitizer.tsx
    const pdfSrc = fs.readFileSync(
      new URL("../src/lib/sanctuary/pdf-local-renderer.ts", import.meta.url),
      "utf8"
    );
    const uiSrc = fs.readFileSync(
      new URL("../src/components/sanctuary/filet-historical-digitizer.tsx", import.meta.url),
      "utf8"
    );
    assert.match(pdfSrc, /\/pdf\.worker\.min\.mjs/);
    assert.match(pdfSrc, /useSystemFonts:\s*false/);
    assert.match(pdfSrc, /loadingTask\.destroy\(\)/);
    assert.ok(!pdfSrc.includes("unpkg.com") && !pdfSrc.includes("cdnjs.cloudflare.com"));
    assert.ok(!uiSrc.includes("@google/genai") && !uiSrc.includes("gemini"));
    assert.match(uiSrc, /explicitReviewConfirmed/);
    assert.match(uiSrc, /lg:col-span-3/);
    assert.match(uiSrc, /lg:col-span-5/);
    assert.match(uiSrc, /lg:col-span-4/);
  });
});
