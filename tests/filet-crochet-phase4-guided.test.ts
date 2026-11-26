import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createStarterUserMemoryStore } from "../src/lib/demo-store.ts";
import {
  appendPatternVersion,
  composePhraseOnCanvas,
  createAlphabetCollection,
  createDefaultCanvasSpec,
  createFiletGlyph,
  createFiletTechnicalConvention,
  createVersionedPattern,
  matricesEqual,
  type BinaryMatrix,
  type FiletCell,
} from "../src/lib/sanctuary/filet-crochet-engine.ts";
import {
  buildGuidedActiveRowView,
  buildGuidedProgressSummary,
  buildLinkedFiletPatternSnapshot,
  completeActiveSegment,
  computePendingUnsyncedRows,
  confirmActiveRow,
  createInitialGuidedProgressState,
  detectGuidedProgressConflict,
  mergeGuidedProgressWithoutDuplicates,
  setGuidedSessionStatus,
  stepBackGuidedProgress,
} from "../src/lib/sanctuary/filet-guided-engine.ts";
import {
  readGuidedProgressForProject,
  saveGuidedProgressForProject,
  type GuidedStorageLike,
} from "../src/lib/sanctuary/filet-guided-store.ts";
import {
  buildConfirmedHistoricalGlyph,
  createDefaultGridCalibration,
  createDefaultImageProcessing,
  digitizeCalibratedGrid,
  extractRegionRGBA,
  HISTORICAL_DOC_MAX_BYTES,
  validateHistoricalDocumentInput,
  type RGBAImageData,
} from "../src/lib/sanctuary/filet-digitizer-engine.ts";
import { getGuidedFiletProjectStatus } from "../src/lib/ai/clara-lyra-tools.ts";

function createMemoryStorage(): GuidedStorageLike {
  const map = new Map<string, string>();
  return {
    getItem(k: string) {
      return map.has(k) ? map.get(k)! : null;
    },
    setItem(k: string, v: string) {
      map.set(k, v);
    },
    removeItem(k: string) {
      map.delete(k);
    },
  };
}

/**
 * Construye una fila binaria de exactamente 80 cuadros que contiene consecutivamente:
 * 11 vacíos (0), 2 llenos (1), 12 vacíos (0), 2 llenos (1), y 53 vacíos (0) = 80 cuadros.
 */
function buildAcceptanceRow80(): FiletCell[] {
  const row: FiletCell[] = [
    ...Array<FiletCell>(11).fill(0),
    ...Array<FiletCell>(2).fill(1),
    ...Array<FiletCell>(12).fill(0),
    ...Array<FiletCell>(2).fill(1),
    ...Array<FiletCell>(53).fill(0),
  ];
  assert.equal(row.length, 80);
  return row;
}

function buildAcceptancePattern80x3(): BinaryMatrix {
  const row1Bottom = buildAcceptanceRow80();
  const row2Mid: FiletCell[] = [
    ...Array<FiletCell>(10).fill(1),
    ...Array<FiletCell>(60).fill(0),
    ...Array<FiletCell>(10).fill(1),
  ];
  const row3Top: FiletCell[] = [
    ...Array<FiletCell>(20).fill(0),
    ...Array<FiletCell>(40).fill(1),
    ...Array<FiletCell>(20).fill(0),
  ];
  // Fila 0 en matriz = superior (vuelta 3), fila 2 = inferior (vuelta 1)
  return [row3Top, row2Mid, row1Bottom];
}

describe("OAKHAVEN — FILET CROCHET STUDIO FASE 4 (PROYECTOS Y SESIONES GUIADAS)", () => {
  test("generic knitting completion records guided time without incrementing rows", () => {
    const store = createStarterUserMemoryStore({ userId: "10000000-0000-4000-8000-000000000001" });
    const pattern = createVersionedPattern({ title: "Sintético", matrix: [[1], [0]], note: "v1" });
    const snapshot = buildLinkedFiletPatternSnapshot({
      patternId: pattern.id, patternName: pattern.title, version: pattern.versions[0],
      convention: createFiletTechnicalConvention(3, "ltr"), orientation: "bottom_to_top",
    });
    const project = store.addKnittingProject({
      name: "Guiado", technique: "Crochet", total_rows_target: 2, linked_filet_pattern: snapshot,
    });
    const command = {
      domain: "knitting" as const, project_id: project.id, rows_completed: 2,
      duration_minutes: 7, idempotency_key: "synthetic-guided-finish",
    };
    const first = store.logSkillSession(command);
    const replay = store.logSkillSession(command);
    assert.equal(project.completed_rows, 0);
    assert.equal(project.status, "in_progress");
    assert.equal(first.session.duration_minutes, 7);
    assert.equal(first.session.metadata?.rows_completed, undefined);
    assert.equal(replay.reward_impact.idempotent_replay, true);
    assert.equal(replay.session.id, first.session.id);
  });

  test("1. Prueba de aceptación principal (80 cuadros): crear proyecto, completar segmentos, confirmar fila, cerrar/reabrir y bloquear confirmación repetida", () => {
    const userId = "10000000-0000-4000-8000-000000000001";
    const storage = createMemoryStorage();
    const store = createStarterUserMemoryStore({ userId });

    const matrix80 = buildAcceptancePattern80x3();
    const versioned = createVersionedPattern({
      title: "Tapete Sintético 80",
      matrix: matrix80,
      note: "v1 inicial",
    });
    const convention = createFiletTechnicalConvention(3, "ltr");
    const snapshot = buildLinkedFiletPatternSnapshot({
      patternId: versioned.id,
      patternName: versioned.title,
      version: versioned.versions[0],
      convention,
      orientation: "bottom_to_top",
    });

    const project = store.addKnittingProject({
      name: "Tapete 80 Cuadros",
      technique: "Crochet",
      total_rows_target: snapshot.total_rows,
      yarn_details: "Algodón #10",
      linked_filet_pattern: snapshot,
    });

    assert.equal(project.total_rows_target, 3);
    assert.equal(project.linked_filet_pattern?.grid_width, 80);
    assert.equal(project.linked_filet_pattern?.version_number, 1);

    // Iniciar progreso guiado
    let state = createInitialGuidedProgressState({
      ownerId: userId,
      project,
      deviceId: "iphone-1",
    });
    state = setGuidedSessionStatus(state, "running");

    // Verificar segmentos exactos de la vuelta 1 (80 cuadros: 11 vacíos, 2 llenos, 12 vacíos, 2 llenos, 53 vacíos)
    const view1 = buildGuidedActiveRowView(state)!;
    assert.equal(view1.rowNumber, 1);
    assert.equal(view1.direction, "ltr");
    assert.equal(view1.totalCellsInRow, 80);
    assert.deepEqual(
      view1.segments.map((s) => `${s.count}${s.kind === "filled" ? "L" : "V"}`),
      ["11V", "2L", "12V", "2L", "53V"]
    );

    // Regla 2: No puede confirmar la vuelta si faltan segmentos
    const premature = confirmActiveRow(state, {
      operationId: "op-r1-premature",
      deviceId: "iphone-1",
    });
    assert.equal(premature.ok, false);
    assert.equal(premature.reason, "INCOMPLETE_SEGMENTS");
    assert.equal(premature.deltaCompletedRows, 0);

    // Regla 1: Completar cada segmento NO incrementa el contador de vueltas
    for (let i = 0; i < view1.segments.length; i++) {
      const segRes = completeActiveSegment(state);
      assert.equal(segRes.ok, true);
      assert.equal(segRes.deltaCompletedRows, 0);
      state = segRes.state;
      assert.equal(state.confirmedRows.length, 0);
    }

    // Confirmar vuelta 1 (+1 exacto)
    const confirm1 = confirmActiveRow(state, {
      operationId: "op-r1-confirm",
      deviceId: "iphone-1",
    });
    assert.equal(confirm1.ok, true);
    assert.equal(confirm1.deltaCompletedRows, 1);
    assert.equal(confirm1.idempotentReplay, false);
    state = confirm1.state;
    assert.deepEqual(state.confirmedRows, [1]);
    assert.equal(state.activeRowNumber, 2);

    // Guardar y simular cierre completo de la aplicación + reapertura
    assert.equal(saveGuidedProgressForProject(storage, userId, state).ok, true);
    const reopened = readGuidedProgressForProject(storage, userId, project.id);
    assert.ok(reopened);
    assert.equal(reopened.activeRowNumber, 2);
    assert.deepEqual(reopened.confirmedRows, [1]);

    // Lectura alternada en vuelta 2 (si vuelta 1 fue ltr, vuelta 2 es rtl)
    const view2 = buildGuidedActiveRowView(reopened)!;
    assert.equal(view2.rowNumber, 2);
    assert.equal(view2.direction, "rtl");

    // Repetir la confirmación anterior (misma operationId) -> NO aumenta dos veces
    const repeatConfirm = confirmActiveRow(reopened, {
      operationId: "op-r1-confirm",
      deviceId: "iphone-1",
    });
    assert.equal(repeatConfirm.ok, true);
    assert.equal(repeatConfirm.idempotentReplay, true);
    assert.equal(repeatConfirm.deltaCompletedRows, 0);
    assert.deepEqual(repeatConfirm.state.confirmedRows, [1]);
  });

  test("2. Inmutabilidad de versión vinculada, compatibilidad con proyectos antiguos y pausa/reanudación sin alterar contador", () => {
    const userId = "10000000-0000-4000-8000-000000000002";
    const store = createStarterUserMemoryStore({ userId });

    // Proyecto antiguo sin patrón vinculado sigue funcionando normalmente
    const legacy = store.addKnittingProject({
      name: "Bufanda Clásica Sin Patrón",
      technique: "Dos Agujas",
      total_rows_target: 40,
      yarn_details: "Lana Merino",
    });
    assert.equal(legacy.linked_filet_pattern, undefined);
    const legacyLog = store.logSkillSession({
      domain: "knitting",
      duration_minutes: 15,
      project_id: legacy.id,
      rows_completed: 5,
      idempotency_key: "legacy-k-1",
    });
    assert.equal(legacyLog.session.domain, "knitting");
    assert.equal(store.knittingProjects.find((p) => p.id === legacy.id)?.completed_rows, 5);

    // Crear patrón v1 y proyecto vinculado; luego crear v2 y mutar matriz externa
    const matV1: BinaryMatrix = [
      [1, 0, 1],
      [0, 1, 0],
    ];
    let versioned = createVersionedPattern({ title: "Borde Estrella", matrix: matV1 });
    const snapV1 = buildLinkedFiletPatternSnapshot({
      patternId: versioned.id,
      patternName: versioned.title,
      version: versioned.versions[0],
      convention: createFiletTechnicalConvention(4, "rtl"),
    });
    const proj = store.addKnittingProject({
      name: "Borde Estrella v1",
      technique: "Crochet",
      total_rows_target: 2,
      linked_filet_pattern: snapV1,
    });

    // Modificar patrón posterior a v2 y mutar matV1 en memoria
    matV1[0][0] = 0;
    versioned = appendPatternVersion(versioned, [[0, 0, 0], [0, 0, 0]], "v2 modificada");
    assert.equal(versioned.currentVersion, 2);
    // El proyecto activo permanece 100 % inmutable con v1
    assert.equal(proj.linked_filet_pattern?.version_number, 1);
    assert.equal(proj.linked_filet_pattern?.matrix[0][0], 1);

    let state = createInitialGuidedProgressState({ ownerId: userId, project: proj });
    // Rechazar operación contra otra versión
    const wrongVer = completeActiveSegment(state, { expectedVersionId: `${versioned.id}-v2` });
    assert.equal(wrongVer.ok, false);
    assert.equal(wrongVer.reason, "PATTERN_VERSION_MISMATCH");

    // Regla 6: Pausar y reanudar no altera contador ni segmentos
    state = completeActiveSegment(state).state;
    const beforePauseSegs = [...state.completedSegmentIndices];
    const paused = setGuidedSessionStatus(state, "paused");
    const resumed = setGuidedSessionStatus(paused, "running");
    assert.deepEqual(resumed.completedSegmentIndices, beforePauseSegs);
    assert.deepEqual(resumed.confirmedRows, []);
  });

  test("3. Concurrencia entre 2 dispositivos, conflictos, fallos de red, retroceso seguro, aislamiento por usuario y cero duplicación XP/GP/vueltas", async () => {
    const userA = "10000000-0000-4000-8000-00000000000a";
    const userB = "10000000-0000-4000-8000-00000000000b";
    const storage = createMemoryStorage();
    const storeA = createStarterUserMemoryStore({ userId: userA });

    const mat: BinaryMatrix = [
      [1, 1, 1],
      [0, 0, 0],
    ];
    const vp = createVersionedPattern({ title: "Mini 3x2", matrix: mat });
    const snap = buildLinkedFiletPatternSnapshot({
      patternId: vp.id,
      patternName: vp.title,
      version: vp.versions[0],
      convention: createFiletTechnicalConvention(3, "rtl"),
    });
    const proj = storeA.addKnittingProject({
      name: "Mini Proyecto",
      technique: "Crochet",
      total_rows_target: 2,
      linked_filet_pattern: snap,
    });

    // Dispositivo 1 y Dispositivo 2 arrancan en el mismo estado (revisión 0)
    const base = createInitialGuidedProgressState({ ownerId: userA, project: proj, deviceId: "tab-s9" });
    let dev1 = completeActiveSegment(base).state;
    let dev2 = completeActiveSegment(base).state;

    // Dispositivo 1 confirma vuelta 1
    const c1 = confirmActiveRow(dev1, { operationId: "dev1-r1", deviceId: "tab-s9" });
    assert.equal(c1.deltaCompletedRows, 1);
    dev1 = c1.state;

    // Dispositivo 2 intenta confirmar vuelta 1 sobre el estado ya confirmado por dev1 -> idempotente, delta 0
    const dupRow = confirmActiveRow(dev1, { operationId: "dev2-r1-different-op", deviceId: "iphone-15" });
    // Como dev1 ya avanzó a vuelta 2, confirmActiveRow sobre dev1 exige segmentos de vuelta 2;
    // y si dev2 confirmó vuelta 1 offline en paralelo, detectamos conflicto y fusionamos sin duplicar:
    dev2 = confirmActiveRow(dev2, { operationId: "dev2-r1-offline", deviceId: "iphone-15" }).state;
    const conflict = detectGuidedProgressConflict(dev2, { ...dev1, revision: dev1.revision + 1 });
    assert.equal(conflict.hasConflict, true);
    const merged = mergeGuidedProgressWithoutDuplicates(dev2, dev1);
    assert.deepEqual(merged.confirmedRows, [1]); // Nunca [1, 1]
    assert.equal(dupRow.deltaCompletedRows, 0);

    // A failed guided operation stays in the owner-scoped queue across reload.
    const queued = {
      ...merged,
      syncState: "error" as const,
      pendingServerOperation: { id: "50000000-0000-4000-8000-000000000011", action: "confirm" as const, row: 1, revision: 0 },
    };
    assert.equal(saveGuidedProgressForProject(storage, userA, queued).ok, true);
    const recovered = readGuidedProgressForProject(storage, userA, proj.id);
    assert.deepEqual(recovered?.pendingServerOperation, queued.pendingServerOperation);
    assert.deepEqual(computePendingUnsyncedRows(queued), [1]);
    assert.equal(proj.completed_rows, 0);

    // Aislamiento entre usuarios
    assert.equal(readGuidedProgressForProject(storage, userB, proj.id), null);

    // Regla 10: Retroceder vuelta confirmada respeta invariantes (no negativo)
    const back1 = stepBackGuidedProgress(merged, {
      allowUndoConfirmedRow: true,
      operationId: "undo-r1",
    });
    assert.equal(back1.ok, true);
    assert.equal(back1.deltaCompletedRows, -1);
    assert.deepEqual(back1.state.confirmedRows, []);
    const backAgain = stepBackGuidedProgress(back1.state, {
      allowUndoConfirmedRow: true,
      operationId: "undo-r0",
    });
    assert.equal(backAgain.ok, false);
    assert.equal(backAgain.reason, "NOTHING_TO_UNDO");

    // Completar proyecto completo (2/2 vueltas)
    let finishing = completeActiveSegment(back1.state).state;
    finishing = confirmActiveRow(finishing, { operationId: "final-r1" }).state;
    finishing = completeActiveSegment(finishing).state;
    finishing = confirmActiveRow(finishing, { operationId: "final-r2" }).state;
    assert.equal(finishing.sessionStatus, "completed");
    assert.equal(buildGuidedProgressSummary(finishing).progressPercent, 100);
  });

  test("4. Integración con Clara (lectura determinista sin inventar) + Bloque 8 regresión PDF local y evaluación > 5 MB", () => {
    const userId = "10000000-0000-4000-8000-000000000004";
    const store = createStarterUserMemoryStore({ userId });
    const mat = buildAcceptancePattern80x3();
    const vp = createVersionedPattern({ title: "Cortina 80", matrix: mat });
    const snap = buildLinkedFiletPatternSnapshot({
      patternId: vp.id,
      patternName: vp.title,
      version: vp.versions[0],
      convention: createFiletTechnicalConvention(3, "ltr"),
    });
    const proj = store.addKnittingProject({
      name: "Cortina Sala",
      technique: "Crochet",
      total_rows_target: 3,
      linked_filet_pattern: snap,
    });
    const state = createInitialGuidedProgressState({ ownerId: userId, project: proj });
    const clara = getGuidedFiletProjectStatus({ progress: state, recordedMinutes: 25 });

    assert.equal(clara.patternName, "Cortina 80");
    assert.equal(clara.activeRowNumber, 1);
    assert.equal(clara.totalRows, 3);
    assert.equal(clara.remainingCellsInRow, 80);
    assert.equal(clara.recordedMinutes, 25);
    assert.match(clara.activeSegmentText, /11 cuadro\(s\) vacío\(s\)/);
    assert.match(clara.nextSegmentText, /2 lleno\(s\)/);

    // Bloque 8: Regresión del digitalizador (PDF real mínimo, worker local, recorte, calibración, guardado y compositor)
    const minimalPdf = new TextEncoder().encode(
      "%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >> endobj\n%%EOF"
    );
    const pdfVal = validateHistoricalDocumentInput({
      filename: "alfabeto_historico_prueba.pdf",
      mimeType: "application/pdf",
      sizeBytes: minimalPdf.byteLength,
      bytes: minimalPdf,
      pageCount: 1,
    });
    assert.equal(pdfVal.valid, true);

    // Verificar existencia real del worker local PDF.js
    const workerPath = new URL("../public/pdf.worker.min.mjs", import.meta.url);
    assert.equal(fs.existsSync(workerPath), true);

    // Verificar que los límites de seguridad del servidor (> 5 MB) siguen vigentes
    const oversizePdf = validateHistoricalDocumentInput({
      filename: "libro_completo_1912.pdf",
      mimeType: "application/pdf",
      sizeBytes: HISTORICAL_DOC_MAX_BYTES + 1024,
      bytes: minimalPdf,
      pageCount: 20,
    });
    assert.equal(oversizePdf.valid, false);

    // Recorte + calibración + guardado de glifo + uso en compositor sin mutar original
    const width = 40;
    const height = 40;
    const rawData = new Uint8ClampedArray(width * height * 4);
    rawData.fill(255);
    // Dibujar bloque oscuro en celda (0,0) dentro de región (10,10,20,20) con cuadrícula 2x2
    for (let y = 11; y < 19; y++) {
      for (let x = 11; x < 19; x++) {
        const i = (y * width + x) * 4;
        rawData[i] = 20;
        rawData[i + 1] = 20;
        rawData[i + 2] = 20;
      }
    }
    const originalCopy = new Uint8ClampedArray(rawData);
    const originalImg: RGBAImageData = { width, height, data: rawData };
    const region = { x: 10, y: 10, width: 20, height: 20 };
    const cropped = extractRegionRGBA(originalImg, region);
    const cal = createDefaultGridCalibration(20, 20, 2, 2);
    const dig = digitizeCalibratedGrid(cropped, cal, createDefaultImageProcessing());
    assert.equal(dig.detectedMatrix[0][0], 1);
    assert.equal(dig.detectedMatrix[1][1], 0);
    // Original intacto
    assert.deepEqual(originalImg.data, originalCopy);

    const glyph = buildConfirmedHistoricalGlyph({
      symbol: "H",
      name: "H Histórica",
      style: "PDF Histórico",
      confirmedMatrix: dig.detectedMatrix,
      initiallyDetectedMatrix: dig.detectedMatrix,
      documentId: "doc-pdf-1",
      documentTitle: "alfabeto_historico_prueba",
      pageNumber: 1,
      region,
      calibration: cal,
      processing: createDefaultImageProcessing(),
      manualModeUsed: false,
    });

    const col = createAlphabetCollection({ name: "PDF Histórico", defaultWidth: 2, defaultHeight: 2 });
    col.glyphs = [glyph, createFiletGlyph({ symbol: "I", label: "I", matrix: [[1, 0], [1, 0]] })];
    const composed = composePhraseOnCanvas({
      collection: col,
      phrase: "HI",
      canvas: createDefaultCanvasSpec(10, 6),
    });
    assert.equal(composed.missingCharacters.length, 0);
    assert.equal(matricesEqual(glyph.matrix, dig.detectedMatrix), true);
  });
});
