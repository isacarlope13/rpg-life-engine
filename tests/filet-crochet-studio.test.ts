import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  FILET_MAX_GLYPH_DIM,
  appendPatternVersion,
  applyTransformToGlyph,
  composeTextFromAlphabet,
  createAlphabetCollection,
  createEmptyMatrix,
  createFiletGlyph,
  createMatrixHistory,
  createStarterFiletWorkspace,
  createVersionedPattern,
  cropMatrixToContent,
  flipMatrixHorizontal,
  flipMatrixVertical,
  generateFiletRowInstructions,
  invertMatrix,
  matricesEqual,
  matrixFromPatternStrings,
  pushMatrixHistory,
  redoMatrixHistory,
  resizeMatrix,
  restoreGlyphFromOriginal,
  rotateMatrix90CCW,
  rotateMatrix90CW,
  setMatrixCell,
  shiftMatrix,
  toggleMatrixCell,
  undoMatrixHistory,
  validateBinaryMatrix,
  type BinaryMatrix,
} from "../src/lib/sanctuary/filet-crochet-engine.ts";
import {
  buildFiletStudioPrivateResourcePayload,
  filetStudioStorageKey,
  parseFiletStudioFromPrivateResourceText,
  readFiletStudioWorkspace,
  saveFiletStudioWorkspace,
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

describe("OAKHAVEN — FILET CROCHET STUDIO (FASE 1)", () => {
  test("1. Validación estricta de matrices binarias y dimensiones", () => {
    const valid = validateBinaryMatrix([
      [1, 0, 1],
      [0, 1, 0],
    ]);
    assert.equal(valid.valid, true);
    assert.equal(valid.width, 3);
    assert.equal(valid.height, 2);
    assert.equal(valid.filledCount, 3);
    assert.equal(valid.openCount, 3);

    // Vacía
    assert.equal(validateBinaryMatrix([]).valid, false);
    assert.equal(validateBinaryMatrix([[]]).valid, false);

    // Irregular (filas con distinto ancho)
    const ragged = validateBinaryMatrix([
      [1, 0, 1],
      [0, 1],
    ]);
    assert.equal(ragged.valid, false);
    assert.ok(ragged.errors.some((e) => e.includes("irregular")));

    // Valores no binarios
    const badVal = validateBinaryMatrix([
      [1, 2, 0],
      [0, 1, 0],
    ]);
    assert.equal(badVal.valid, false);

    // Límites de dimensión
    assert.throws(() => createEmptyMatrix(0, 5));
    assert.throws(() => createEmptyMatrix(FILET_MAX_GLYPH_DIM + 1, 5));
    assert.equal(
      validateBinaryMatrix(createEmptyMatrix(5, 5), { maxWidth: 4, maxHeight: 4 }).valid,
      false
    );
  });

  test("2. Edición de celdas y redimensionamiento son inmutables y preservan contenido", () => {
    const base = createEmptyMatrix(3, 3, 0);
    const edited = setMatrixCell(base, 1, 1, 1);
    assert.equal(base[1][1], 0, "La matriz base no debe mutarse");
    assert.equal(edited[1][1], 1);

    const toggled = toggleMatrixCell(edited, 1, 1);
    assert.equal(toggled[1][1], 0);
    assert.equal(edited[1][1], 1);

    // Fuera de rango devuelve copia intacta sin lanzar error
    const outOfBounds = setMatrixCell(edited, 99, -1, 1);
    assert.equal(matricesEqual(outOfBounds, edited), true);

    // Resize preserva intersección
    const grown = resizeMatrix(edited, 5, 4, 0);
    assert.equal(grown.length, 4);
    assert.equal(grown[0].length, 5);
    assert.equal(grown[1][1], 1);
    const shrunk = resizeMatrix(grown, 2, 2, 0);
    assert.equal(shrunk.length, 2);
    assert.equal(shrunk[0].length, 2);
    assert.equal(shrunk[1][1], 1);
  });

  test("3. Historial Undo / Redo determinista, profundidad máxima y limpieza de futuro al bifurcar", () => {
    const m0 = createEmptyMatrix(2, 2, 0);
    const m1 = setMatrixCell(m0, 0, 0, 1);
    const m2 = setMatrixCell(m1, 1, 1, 1);
    const m3 = setMatrixCell(m2, 0, 1, 1);

    let h = createMatrixHistory(m0, 2);
    // No-op idéntico no ensucia historial
    h = pushMatrixHistory(h, m0);
    assert.equal(h.past.length, 0);

    h = pushMatrixHistory(h, m1);
    h = pushMatrixHistory(h, m2);
    h = pushMatrixHistory(h, m3);
    // maxDepth = 2 conserva solo los últimos 2 estados previos
    assert.equal(h.past.length, 2);
    assert.equal(matricesEqual(h.present, m3), true);

    h = undoMatrixHistory(h);
    assert.equal(matricesEqual(h.present, m2), true);
    assert.equal(h.future.length, 1);

    h = redoMatrixHistory(h);
    assert.equal(matricesEqual(h.present, m3), true);
    assert.equal(h.future.length, 0);

    // Bifurcar después de undo limpia future
    h = undoMatrixHistory(h);
    const branch = setMatrixCell(m2, 1, 0, 1);
    h = pushMatrixHistory(h, branch);
    assert.equal(h.future.length, 0);
    assert.equal(matricesEqual(h.present, branch), true);
  });

  test("4. Transformaciones puras sobre copias preservan intacta la matriz original del glifo", () => {
    const originalL: BinaryMatrix = matrixFromPatternStrings([
      "100",
      "100",
      "111",
    ]);
    const glyph = createFiletGlyph({
      symbol: "L",
      label: "Letra L",
      matrix: originalL,
      sourceType: "manual",
      sourceLabel: "Diseño manual inicial",
    });

    const inverted = applyTransformToGlyph(glyph, invertMatrix);
    assert.equal(inverted.matrix[0][0], 0);
    assert.equal(inverted.matrix[0][1], 1);
    // Original intacta
    assert.equal(matricesEqual(inverted.originalReference.originalMatrix, originalL), true);
    assert.equal(matricesEqual(glyph.matrix, originalL), true);

    const flippedH = flipMatrixHorizontal(originalL);
    assert.deepEqual(flippedH[0], [0, 0, 1]);
    assert.deepEqual(originalL[0], [1, 0, 0]);

    const flippedV = flipMatrixVertical(originalL);
    assert.deepEqual(flippedV[0], [1, 1, 1]);
    assert.deepEqual(flippedV[2], [1, 0, 0]);

    // 4 rotaciones de 90° CW o CW+CCW vuelven al original
    const cw = rotateMatrix90CW(originalL);
    const back = rotateMatrix90CCW(cw);
    assert.equal(matricesEqual(back, originalL), true);

    // Shift y recorte al contenido
    const padded = resizeMatrix(originalL, 5, 5, 0);
    const shifted = shiftMatrix(padded, 1, 1, false);
    assert.equal(shifted[0][0], 0);
    assert.equal(shifted[1][1], 1);
    const cropped = cropMatrixToContent(shifted, 0);
    assert.equal(matricesEqual(cropped, originalL), true);

    // Restaurar glifo desde referencia original
    const restored = restoreGlyphFromOriginal(inverted);
    assert.equal(matricesEqual(restored.matrix, originalL), true);
    assert.equal(matricesEqual(restored.originalReference.originalMatrix, originalL), true);
  });

  test("5. Base Fase 2: patrones versionados, composición de texto e instrucciones deterministas por vuelta", () => {
    const glyphI = createFiletGlyph({
      symbol: "I",
      matrix: matrixFromPatternStrings(["111", "010", "111"]),
    });
    const glyphO = createFiletGlyph({
      symbol: "O",
      matrix: matrixFromPatternStrings(["111", "101", "111"]),
    });
    const col = createAlphabetCollection({
      name: "Mini Alfabeto",
      defaultWidth: 3,
      defaultHeight: 3,
      glyphs: [glyphI, glyphO],
    });

    const composed = composeTextFromAlphabet(col, {
      alphabetCollectionId: col.id,
      text: "IO?",
      letterSpacingCols: 1,
      lineSpacingRows: 1,
      borderPadding: 1,
      alignment: "left",
    });
    assert.deepEqual(composed.missingSymbols, ["?"]);
    // Ancho = 3(I) + 1(gap) + 3(O) + 2(bordes) = 9; Alto = 3 + 2(bordes) = 5
    assert.equal(composed.matrix.length, 5);
    assert.equal(composed.matrix[0].length, 9);

    // Patrón versionado inmutable
    const v1 = createVersionedPattern({ title: "Tapete IO", matrix: composed.matrix, note: "Inicial" });
    const v2 = appendPatternVersion(v1, invertMatrix(composed.matrix), "Invertido");
    assert.equal(v1.currentVersion, 1);
    assert.equal(v2.currentVersion, 2);
    assert.equal(v2.versions.length, 2);
    assert.equal(matricesEqual(v2.versions[0].matrix, composed.matrix), true);

    // Instrucciones deterministas fila por fila (Vuelta 1 = base inferior, alternando RTL/LTR)
    const rows = generateFiletRowInstructions(
      matrixFromPatternStrings([
        "100",
        "110",
      ]),
      "rtl"
    );
    assert.equal(rows.length, 2);
    assert.equal(rows[0].rowNumber, 1);
    assert.equal(rows[0].direction, "rtl");
    // Fila inferior "110" leída RTL -> [0, 1, 1] => 1 calada, 2 llenas
    assert.deepEqual(rows[0].runs, [
      { cell: 0, count: 1 },
      { cell: 1, count: 2 },
    ]);
    assert.equal(rows[1].rowNumber, 2);
    assert.equal(rows[1].direction, "ltr");
    // Fila superior "100" leída LTR -> [1, 0, 0] => 1 llena, 2 caladas
    assert.deepEqual(rows[1].runs, [
      { cell: 1, count: 1 },
      { cell: 0, count: 2 },
    ]);
  });

  test("6. Persistencia privada y aislamiento estricto entre usuarios + integración /api/resources (atelier)", () => {
    const storage = createMemoryStorage();
    const userA = "11111111-1111-4111-8111-111111111111";
    const userB = "22222222-2222-4222-8222-222222222222";

    const wsA = createStarterFiletWorkspace("2026-11-23T00:00:00.000Z");

    // Rechaza usuarios no autenticados / anónimos
    assert.equal(saveFiletStudioWorkspace(storage, undefined, wsA).ok, false);
    assert.equal(saveFiletStudioWorkspace(storage, "anonymous", wsA).ok, false);
    assert.equal(readFiletStudioWorkspace(storage, undefined), null);

    // Guarda aislado para userA
    const savedA = saveFiletStudioWorkspace(storage, userA, wsA);
    assert.equal(savedA.ok, true);

    const loadedA = readFiletStudioWorkspace(storage, userA);
    assert.ok(loadedA);
    assert.equal(loadedA.collections[0].glyphs[0].symbol, "A");

    // userB no puede leer datos de userA
    assert.equal(readFiletStudioWorkspace(storage, userB), null);

    // Manipulación de ownerId en storage es rechazada
    storage.setItem(
      filetStudioStorageKey(userB),
      JSON.stringify({ ownerId: userA, workspace: wsA })
    );
    assert.equal(readFiletStudioWorkspace(storage, userB), null);

    // Integración con almacenamiento privado de OakHaven (/api/resources -> building_resources atelier)
    const uploadBody = buildFiletStudioPrivateResourcePayload(savedA.workspace, {
      collectionId: savedA.workspace.collections[0].id,
      projectId: "proj-crochet-1",
    });
    const bytes = new TextEncoder().encode(uploadBody.rawTextContent);

    const validInAtelier = validatePrivateResourceFile({
      buildingId: uploadBody.buildingId,
      resourceType: uploadBody.resourceType,
      filename: uploadBody.filename,
      reportedMimeType: uploadBody.mimeType,
      sizeBytes: bytes.byteLength,
      ownerId: userA,
      authenticatedUserId: userA,
      fileBytes: bytes,
    });
    assert.equal(validInAtelier.valid, true);
    assert.equal(validInAtelier.isFinancialSensitive, false);

    // Rechazado si otro usuario intenta subir o si se intenta en otro edificio
    const wrongOwner = validatePrivateResourceFile({
      buildingId: uploadBody.buildingId,
      resourceType: uploadBody.resourceType,
      filename: uploadBody.filename,
      reportedMimeType: uploadBody.mimeType,
      sizeBytes: bytes.byteLength,
      ownerId: userA,
      authenticatedUserId: userB,
      fileBytes: bytes,
    });
    assert.equal(wrongOwner.valid, false);

    const wrongBuilding = validatePrivateResourceFile({
      buildingId: "banco_oakhaven",
      resourceType: uploadBody.resourceType,
      filename: uploadBody.filename,
      reportedMimeType: uploadBody.mimeType,
      sizeBytes: bytes.byteLength,
      ownerId: userA,
      authenticatedUserId: userA,
      fileBytes: bytes,
    });
    assert.equal(wrongBuilding.valid, false);

    // Roundtrip limpio de respaldo JSON
    const parsedBack = parseFiletStudioFromPrivateResourceText(uploadBody.rawTextContent);
    assert.ok(parsedBack);
    assert.equal(parsedBack.collections.length, 1);
    assert.equal(
      matricesEqual(
        parsedBack.collections[0].glyphs[0].originalReference.originalMatrix,
        wsA.collections[0].glyphs[0].originalReference.originalMatrix
      ),
      true
    );
  });

  test("7. Integración no destructiva dentro del Atelier de Clara (sin retirar funciones existentes)", () => {
    const atelierPath = new URL("../src/components/sanctuary/atelier-building.tsx", import.meta.url);
    const atelierSrc = fs.readFileSync(atelierPath, "utf8");
    assert.match(atelierSrc, /FiletCrochetStudio/);
    assert.match(atelierSrc, /id:\s*"filet"/);
    // Conserva las 5 estaciones originales intactas
    for (const stationId of ['"taller"', '"proyectos"', '"patrones"', '"galeria"', '"clara"']) {
      assert.ok(atelierSrc.includes(`id: ${stationId}`), `Atelier debe conservar estación ${stationId}`);
    }
  });
});
