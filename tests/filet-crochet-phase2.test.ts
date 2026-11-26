import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  alignPlacedGlyphs,
  appendPatternVersion,
  calculateFiletFoundationSpec,
  compileFiletRowRuns,
  compileFiletTechnicalPattern,
  compileFiletTechnicalRow,
  composePhraseOnCanvas,
  createAlphabetCollection,
  createComposerHistory,
  createDefaultCanvasSpec,
  createFiletGlyph,
  createFiletTechnicalConvention,
  createStarterFiletWorkspace,
  createVersionedPattern,
  matricesEqual,
  matrixFromPatternStrings,
  movePlacedGlyph,
  pushComposerHistory,
  redoComposerHistory,
  renderComposedCanvas,
  resolvePlacedGlyphMatrix,
  scaleMatrixDiscrete,
  transformPlacedGlyph,
  undoComposerHistory,
  type FiletAlphabetCollection,
  type FiletCell,
  type FiletGlyph,
} from "../src/lib/sanctuary/filet-crochet-engine.ts";
import {
  buildFiletStudioPrivateResourcePayload,
  detectFiletRestoreConflict,
  readFiletStudioWorkspace,
  restoreFiletWorkspaceFromBackup,
  saveFiletStudioWorkspace,
  validateFiletBackupPreview,
} from "../src/lib/sanctuary/filet-crochet-store.ts";
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
 * Alfabeto sintético exclusivo para pruebas automatizadas (5x7).
 * NO sustituye alfabetos históricos reales de Filet Crochet.
 */
function createSyntheticTestAlphabet(): FiletAlphabetCollection {
  const defs: Record<string, string[]> = {
    B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
    I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  };

  const glyphs = Object.entries(defs).map(([symbol, rows]) =>
    createFiletGlyph({
      id: `syn_${symbol}`,
      symbol,
      label: `Sintético ${symbol}`,
      matrix: matrixFromPatternStrings(rows),
      sourceType: "manual",
      sourceLabel: "Fixture sintético de prueba",
      nowIso: "2026-11-23T00:00:00.000Z",
    })
  );

  return createAlphabetCollection({
    id: "alpha_synthetic_test",
    name: "Alfabeto Sintético QA",
    description: "Solo para pruebas automatizadas; no reemplaza alfabetos históricos reales.",
    defaultWidth: 5,
    defaultHeight: 7,
    glyphs,
    nowIso: "2026-11-23T00:00:00.000Z",
  });
}

describe("OAKHAVEN — FILET CROCHET STUDIO FASE 2 (COMPOSITOR, PERSISTENCIA Y MOTOR TÉCNICO)", () => {
  test("1. Bloque 3 (OBLIGATORIA): fila de 27 cuadros [11 vacíos, 2 llenos, 12 vacíos, 2 llenos] en lectura normal e invertida, malla 3 y malla 4", () => {
    const row27: FiletCell[] = [
      ...Array<FiletCell>(11).fill(0),
      ...Array<FiletCell>(2).fill(1),
      ...Array<FiletCell>(12).fill(0),
      ...Array<FiletCell>(2).fill(1),
    ];
    assert.equal(row27.length, 27);

    const mesh3 = createFiletTechnicalConvention(3, "rtl");
    const mesh4 = createFiletTechnicalConvention(4, "rtl");

    // Lectura normal (ltr: Izq -> Der)
    const normal = compileFiletRowRuns(row27, "ltr", mesh3);
    assert.equal(normal.totalSquares, 27);
    assert.equal(normal.emptySquares, 23);
    assert.equal(normal.filledSquares, 4);
    assert.deepEqual(
      normal.runs.map((r) => [r.kind, r.count]),
      [
        ["empty", 11],
        ["filled", 2],
        ["empty", 12],
        ["filled", 2],
      ]
    );

    // Lectura invertida (rtl: Der -> Izq)
    const inverted = compileFiletRowRuns(row27, "rtl", mesh3);
    assert.equal(inverted.totalSquares, 27);
    assert.equal(inverted.emptySquares, 23);
    assert.equal(inverted.filledSquares, 4);
    assert.deepEqual(
      inverted.runs.map((r) => [r.kind, r.count]),
      [
        ["filled", 2],
        ["empty", 12],
        ["filled", 2],
        ["empty", 11],
      ]
    );

    // Convenciones exactas de malla de 3 y malla de 4 con bordes compartidos
    const techRow3Normal = compileFiletTechnicalRow(row27, 1, 0, "ltr", mesh3);
    const techRow3Inv = compileFiletTechnicalRow(row27, 1, 0, "rtl", mesh3);
    assert.equal(techRow3Normal.expectedBaseStitches, 27 * 2 + 1); // 55
    assert.equal(techRow3Normal.turningChains, 4); // inicio vacío malla 3 = 3 + 1
    assert.equal(techRow3Inv.turningChains, 3); // inicio lleno = 3
    assert.equal(
      techRow3Normal.totalDoubleCrochets + techRow3Normal.totalInnerChains,
      techRow3Normal.expectedBaseStitches
    );
    assert.equal(
      techRow3Inv.totalDoubleCrochets + techRow3Inv.totalInnerChains,
      techRow3Inv.expectedBaseStitches
    );

    const techRow4Normal = compileFiletTechnicalRow(row27, 1, 0, "ltr", mesh4);
    const techRow4Inv = compileFiletTechnicalRow(row27, 1, 0, "rtl", mesh4);
    assert.equal(techRow4Normal.expectedBaseStitches, 27 * 3 + 1); // 82
    assert.equal(techRow4Normal.turningChains, 5); // inicio vacío malla 4 = 3 + 2
    assert.equal(techRow4Inv.turningChains, 3);
    assert.equal(
      techRow4Normal.totalDoubleCrochets + techRow4Normal.totalInnerChains,
      techRow4Normal.expectedBaseStitches
    );
    assert.equal(
      techRow4Inv.totalDoubleCrochets + techRow4Inv.totalInnerChains,
      techRow4Inv.expectedBaseStitches
    );

    // Cadenetas base verificadas
    const found3 = calculateFiletFoundationSpec(27, 0, mesh3);
    assert.equal(found3.baseStitches, 55);
    assert.equal(found3.totalFoundationChains, 59);
    const found4 = calculateFiletFoundationSpec(27, 0, mesh4);
    assert.equal(found4.baseStitches, 82);
    assert.equal(found4.totalFoundationChains, 87);
  });

  test("2. Bloque 4 (ACEPTACIÓN): componer 'Baby Lucio' en lienzo de 80 cuadros, conservar originales y verificar separación", () => {
    const alphabet = createSyntheticTestAlphabet();
    const originalSnapshots = new Map(
      alphabet.glyphs.map((g) => [g.id, JSON.stringify(g.originalReference.originalMatrix)])
    );

    const canvas80 = createDefaultCanvasSpec(80, 20);
    const composed = composePhraseOnCanvas({
      collection: alphabet,
      phrase: "Baby Lucio",
      canvas: canvas80,
      letterSpacingCols: 1,
      wordSpacingCols: 5,
      alignment: "center",
      verticalAlignment: "center",
    });

    assert.equal(composed.missingCharacters.length, 0);
    assert.equal(composed.overflow.hasOverflow, false);
    assert.equal(composed.placements.length, 9); // B A B Y + L U C I O
    assert.equal(composed.matrix.length, 20);
    assert.equal(composed.matrix[0].length, 80);

    // Verificar separación exacta entre letras consecutivas (1 col) y entre palabras (5 cols)
    const [pB1, pA, pB2, pY, pL, pU] = composed.placements;
    assert.equal(pA.x - (pB1.x + 5), 1, "Separación entre B y a debe ser 1 cuadro");
    assert.equal(pB2.x - (pA.x + 5), 1, "Separación entre a y b debe ser 1 cuadro");
    assert.equal(pY.x - (pB2.x + 5), 1, "Separación entre b y y debe ser 1 cuadro");
    assert.equal(pL.x - (pY.x + 5), 5, "Separación entre 'Baby' y 'Lucio' debe ser 5 cuadros");
    assert.equal(pU.x - (pL.x + 5), 1, "Separación entre L y u debe ser 1 cuadro");

    // Aplicar rotaciones, reflejos, escalado discreto 2x y arrastre sobre copias
    const glyphById = new Map<string, FiletGlyph>(alphabet.glyphs.map((g) => [g.id, g]));
    let placements = movePlacedGlyph(composed.placements, pB1.instanceId, pB1.x - 1.4, pB1.y + 0.6);
    assert.equal(placements[0].x, Math.round(pB1.x - 1.4), "Arrastre debe ajustar exactamente a entero");
    placements = transformPlacedGlyph(placements, pB1.instanceId, { type: "rotate_cw" });
    placements = transformPlacedGlyph(placements, pB1.instanceId, { type: "flip_h" });
    placements = transformPlacedGlyph(placements, pB1.instanceId, { type: "scale", scaleX: 2 });

    const resolvedB = resolvePlacedGlyphMatrix(placements[0], glyphById.get(pB1.glyphId)!);
    // Original 5x7 -> escala 2x = 10x14 -> rotación 90° = 14x10
    assert.equal(resolvedB.length, 10);
    assert.equal(resolvedB[0].length, 14);

    // Todas las matrices originales permanecen 100 % intactas
    for (const g of alphabet.glyphs) {
      assert.equal(
        JSON.stringify(g.originalReference.originalMatrix),
        originalSnapshots.get(g.id),
        `La matriz original de ${g.symbol} nunca debe mutarse`
      );
    }

    // Separación visual vs técnica en malla 3 y malla 4 sobre el lienzo compuesto de 80 cuadros
    const visualCopy = JSON.stringify(composed.matrix);
    const plan3 = compileFiletTechnicalPattern(composed.matrix, createFiletTechnicalConvention(3, "rtl"));
    const plan4 = compileFiletTechnicalPattern(composed.matrix, createFiletTechnicalConvention(4, "rtl"));
    assert.equal(plan3.foundation.baseStitches, 80 * 2 + 1);
    assert.equal(plan4.foundation.baseStitches, 80 * 3 + 1);
    assert.equal(JSON.stringify(composed.matrix), visualCopy, "El motor técnico no muta la matriz visual");
  });

  test("3. Escalado discreto estricto, desbordamiento y caracteres faltantes sin sustitución silenciosa", () => {
    const alphabet = createSyntheticTestAlphabet();

    // Escalado discreto rechaza decimales o factores < 1 (cero interpolación)
    const sample = alphabet.glyphs[0].matrix;
    assert.throws(() => scaleMatrixDiscrete(sample, 1.5, 1.5));
    assert.throws(() => scaleMatrixDiscrete(sample, 0, 2));
    const scaled2x = scaleMatrixDiscrete(sample, 2, 2);
    assert.equal(scaled2x.length, sample.length * 2);
    assert.equal(scaled2x[0].length, sample[0].length * 2);

    // Desbordamiento en lienzo demasiado angosto (30 cuadros para 'Baby Lucio')
    const narrowCanvas = createDefaultCanvasSpec(30, 12);
    const overflowRes = composePhraseOnCanvas({
      collection: alphabet,
      phrase: "Baby Lucio",
      canvas: narrowCanvas,
      letterSpacingCols: 1,
      wordSpacingCols: 4,
      alignment: "left",
    });
    assert.equal(overflowRes.overflow.hasOverflow, true);
    assert.ok(overflowRes.overflow.overflowRight > 0);
    assert.ok(overflowRes.overflow.overflowItems.length > 0);

    // Carácter faltante ('Ñ' y '!') NUNCA se sustituye silenciosamente
    const missingRes = composePhraseOnCanvas({
      collection: alphabet,
      phrase: "Baby Ñ!",
      canvas: createDefaultCanvasSpec(80, 20),
    });
    assert.deepEqual(
      missingRes.missingCharacters.map((m) => m.char),
      ["Ñ", "!"]
    );
    assert.equal(missingRes.placements.length, 4); // Solo B, a, b, y

    // Con alternativa explícita elegida por la usuaria ('Ñ' -> 'N'), sí coloca N
    const withExplicitAlt = composePhraseOnCanvas({
      collection: alphabet,
      phrase: "Baby Ñ",
      canvas: createDefaultCanvasSpec(80, 20),
      explicitSubstitutions: { Ñ: "N" },
    });
    assert.equal(withExplicitAlt.missingCharacters.length, 0);
    assert.equal(withExplicitAlt.placements.length, 5);
    assert.equal(withExplicitAlt.placements[4].symbol, "N");
  });

  test("4. Alineación, distribución, Undo/Redo del compositor y versionado inmutable", () => {
    const alphabet = createSyntheticTestAlphabet();
    const glyphById = new Map<string, FiletGlyph>(alphabet.glyphs.map((g) => [g.id, g]));
    const canvas = createDefaultCanvasSpec(60, 16);

    const initial = composePhraseOnCanvas({
      collection: alphabet,
      phrase: "BIO",
      canvas,
      alignment: "left",
    });

    let hist = createComposerHistory({
      canvas,
      placements: initial.placements,
      cellOverrides: {},
    });

    const distributed = alignPlacedGlyphs(
      hist.present.placements,
      glyphById,
      canvas,
      "distribute_x"
    );
    hist = pushComposerHistory(hist, {
      ...hist.present,
      placements: distributed,
    });
    assert.ok(hist.present.placements[2].x > initial.placements[2].x);

    // Edición manual de celda + Undo / Redo
    hist = pushComposerHistory(hist, {
      ...hist.present,
      cellOverrides: { "0,0": 1 },
    });
    const renderedEdit = renderComposedCanvas(
      hist.present.canvas,
      hist.present.placements,
      glyphById,
      hist.present.cellOverrides
    );
    assert.equal(renderedEdit.matrix[0][0], 1);

    hist = undoComposerHistory(hist);
    assert.equal(hist.present.cellOverrides["0,0"], undefined);
    hist = redoComposerHistory(hist);
    assert.equal(hist.present.cellOverrides["0,0"], 1);

    // Versionado inmutable: v2 no altera v1
    const v1 = createVersionedPattern({
      title: "Manta Baby Lucio",
      matrix: initial.matrix,
      note: "v1 inicial",
    });
    const v2 = appendPatternVersion(v1, renderedEdit.matrix, "v2 con ajuste manual");
    assert.equal(v2.currentVersion, 2);
    assert.equal(matricesEqual(v2.versions[0].matrix, initial.matrix), true);
    assert.equal(matricesEqual(v2.versions[1].matrix, renderedEdit.matrix), true);
  });

  test("5. Bloque 2: vista previa validada, detección de conflictos, confirmación obligatoria y aislamiento por usuario", () => {
    const storage = createMemoryStorage();
    const userA = "11111111-1111-4111-8111-111111111111";
    const userB = "22222222-2222-4222-8222-222222222222";

    const wsOld = createStarterFiletWorkspace("2026-11-23T10:00:00.000Z");
    const wsNewerLocal = {
      ...createStarterFiletWorkspace("2026-11-23T12:00:00.000Z"),
      collections: [createSyntheticTestAlphabet()],
    };

    saveFiletStudioWorkspace(storage, userA, wsNewerLocal);

    // Validar respaldo corrupto y versión no soportada
    assert.equal(validateFiletBackupPreview("{bad json").valid, false);
    assert.equal(
      validateFiletBackupPreview(JSON.stringify({ schemaVersion: 99, collections: [], patterns: [], updatedAt: "2026-11-23T00:00:00.000Z" })).valid,
      false
    );

    // Respaldo válido anterior genera conflicto detectado y NO sobrescribe sin confirmOverwrite: true
    const backupPayload = buildFiletStudioPrivateResourcePayload(wsOld);
    const preview = validateFiletBackupPreview(backupPayload.rawTextContent);
    assert.equal(preview.valid, true);
    assert.equal(preview.schemaVersion, 1);
    assert.equal(preview.summary?.counts.collections, 1);

    const conflict = detectFiletRestoreConflict(wsNewerLocal, preview.workspace!);
    assert.equal(conflict.hasConflict, true);
    assert.equal(conflict.localIsNewer, true);

    const blockedRestore = restoreFiletWorkspaceFromBackup(
      storage,
      userA,
      backupPayload.rawTextContent,
      { confirmOverwrite: false }
    );
    assert.equal(blockedRestore.ok, false);
    assert.equal(blockedRestore.requiresConfirmation, true);
    // La copia local más reciente sigue intacta
    assert.equal(readFiletStudioWorkspace(storage, userA)?.collections[0].id, "alpha_synthetic_test");

    // Con confirmación explícita sí restaura para userA, sin afectar a userB
    const confirmedRestore = restoreFiletWorkspaceFromBackup(
      storage,
      userA,
      backupPayload.rawTextContent,
      { confirmOverwrite: true }
    );
    assert.equal(confirmedRestore.ok, true);
    assert.equal(readFiletStudioWorkspace(storage, userA)?.collections[0].id, "alpha_base_filet");
    assert.equal(readFiletStudioWorkspace(storage, userB), null);

    // Rechaza anónimo
    assert.equal(
      restoreFiletWorkspaceFromBackup(storage, undefined, backupPayload.rawTextContent, {
        confirmOverwrite: true,
      }).ok,
      false
    );
  });

  test("6. Rendimiento con patrón grande (160×80 = 12.800 cuadros) y verificación de controles teclado/puntero/Atelier", () => {
    const alphabet = createSyntheticTestAlphabet();
    const bigCanvas = createDefaultCanvasSpec(160, 80);

    const startMs = performance.now();
    const composed = composePhraseOnCanvas({
      collection: alphabet,
      phrase: "BABY LUCIO\nBABY LUCIO\nBABY LUCIO",
      canvas: bigCanvas,
      letterSpacingCols: 2,
      wordSpacingCols: 6,
      lineSpacingRows: 4,
      alignment: "center",
    });
    const plan = compileFiletTechnicalPattern(
      composed.matrix,
      createFiletTechnicalConvention(4, "rtl")
    );
    const elapsedMs = performance.now() - startMs;

    assert.equal(plan.gridWidth, 160);
    assert.equal(plan.gridHeight, 80);
    assert.equal(plan.totalSquares, 12800);
    assert.equal(plan.rows.length, 80);
    assert.ok(elapsedMs < 500, `El procesamiento de 12.800 cuadros debe ser rápido (tomó ${elapsedMs.toFixed(1)}ms)`);

    // Verificación estructural de teclado, puntero, perímetro numerado, API segura y compatibilidad del Atelier
    const composerSrc = fs.readFileSync(
      new URL("../src/components/sanctuary/filet-composer-panel.tsx", import.meta.url),
      "utf8"
    );
    const restoreSrc = fs.readFileSync(
      new URL("../src/components/sanctuary/filet-restore-panel.tsx", import.meta.url),
      "utf8"
    );
    const resourcesApiSrc = fs.readFileSync(
      new URL("../src/app/api/resources/route.ts", import.meta.url),
      "utf8"
    );
    const atelierSrc = fs.readFileSync(
      new URL("../src/components/sanctuary/atelier-building.tsx", import.meta.url),
      "utf8"
    );

    assert.match(composerSrc, /onKeyDown=\{handleCanvasKeyDown\}/);
    assert.match(composerSrc, /ArrowUp/);
    assert.match(composerSrc, /onPointerDown/);
    assert.match(composerSrc, /top-col-/);
    assert.match(composerSrc, /bot-col-/);
    assert.match(composerSrc, /left-row-/);
    assert.match(composerSrc, /right-row-/);
    assert.match(restoreSrc, /NO sync auto/);
    assert.match(restoreSrc, /confirmOverwriteChecked/);
    assert.match(resourcesApiSrc, /includeContent/);
    assert.match(resourcesApiSrc, /filet_crochet_studio/);
    for (const stationId of ['"taller"', '"proyectos"', '"patrones"', '"filet"', '"galeria"', '"clara"']) {
      assert.ok(atelierSrc.includes(`id: ${stationId}`), `Atelier debe conservar estación ${stationId}`);
    }
  });
});
