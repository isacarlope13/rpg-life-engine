import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {
  createStarterFiletWorkspace,
  createVersionedPattern,
  matricesEqual,
  type BinaryMatrix,
  type FiletCell,
} from "../src/lib/sanctuary/filet-crochet-engine.ts";
import {
  buildPrintableInstructionsDocument,
  buildUniversalExportModel,
  exportPatternToPng,
  exportPatternToSvg,
  exportPatternToVectorPdf,
  exportPrintableInstructionsToMarkdown,
} from "../src/lib/sanctuary/filet-export-engine.ts";
import {
  applyArchiveImportToWorkspace,
  buildFiletProjectArchive,
  detectArchiveImportConflicts,
  serializeFiletProjectArchive,
  validateAndParseProjectArchive,
} from "../src/lib/sanctuary/filet-project-archive.ts";
import {
  createSyncEnvelope,
  detectWorkspaceSyncConflict,
  enqueueWorkspaceSyncOperation,
  resolveWorkspaceConflictManually,
} from "../src/lib/sanctuary/filet-sync-engine.ts";
import { validatePrivateResourceFile } from "../src/lib/ai/building-resources-engine.ts";

/**
 * Construye un patrón sintético de exactamente 80 × 24 cuadros (Bloque 10).
 */
function buildSyntheticPattern80x24(): BinaryMatrix {
  return Array.from({ length: 24 }, (_, r) =>
    Array.from({ length: 80 }, (_, c): FiletCell => {
      if (r === 0 || r === 23 || c === 0 || c === 79) return 1;
      if ((r + c) % 7 === 0) return 1;
      return 0;
    })
  );
}

describe("OAKHAVEN — FILET CROCHET STUDIO FASE 5 (EXPORTACIONES, SYNC Y PRODUCCIÓN)", () => {
  test("1. Patrón sintético 80×24: PDF vectorial (1 pág. y multipágina con continuidad), PNG (150/300/600 DPI + transparente), SVG seguro e instrucciones imprimibles", () => {
    const matrix80x24 = buildSyntheticPattern80x24();
    const model = buildUniversalExportModel({
      patternName: "Cenefa OakHaven 80x24",
      versionNumber: 2,
      matrix: matrix80x24,
      meshSize: 3,
      orientation: "bottom_to_top",
      firstRowDirection: "rtl",
      marginMm: 12,
      showPerimeterNumbers: true,
      showGridLines: true,
      filledColorHex: "#3A2E2B",
      emptyColorHex: "#FFFDF8",
      gridColorHex: "#8C7A6B",
      showLegend: true,
      historicalRef: { documentTitle: "Album Filet 1924", pageNumber: 12 },
    });

    // 1A. PDF Ajustar a 1 página + instrucciones
    const pdfFit = exportPatternToVectorPdf(model, {
      paperSize: "A4",
      paperOrientation: "landscape",
      paginationMode: "fit_one_page",
      includeInstructionsPages: true,
    });
    const pdfFitHeader = new TextDecoder().decode(pdfFit.bytes.subarray(0, 8));
    assert.equal(pdfFitHeader, "%PDF-1.4");
    assert.equal(pdfFit.chartPagesCount, 1);
    assert.ok(pdfFit.instructionsPagesCount >= 1);
    assert.equal(pdfFit.pageCount, pdfFit.chartPagesCount + pdfFit.instructionsPagesCount);

    // 1B. PDF Multipágina (dividir 80×24 en baldosas de máx. 40 cols) con coordenadas globales y marcas de continuidad
    const pdfTiled = exportPatternToVectorPdf(model, {
      paperSize: "A4",
      paperOrientation: "portrait",
      paginationMode: "tile_pages",
      maxColsPerTile: 40,
      maxRowsPerTile: 24,
      includeInstructionsPages: true,
    });
    assert.equal(pdfTiled.tileCols, 2);
    assert.equal(pdfTiled.tileRows, 1);
    assert.equal(pdfTiled.chartPagesCount, 2);
    assert.equal(pdfTiled.tileSummaries[0].colStart, 1);
    assert.equal(pdfTiled.tileSummaries[0].colEnd, 40);
    assert.equal(pdfTiled.tileSummaries[1].colStart, 41);
    assert.equal(pdfTiled.tileSummaries[1].colEnd, 80);
    assert.ok(pdfTiled.tileSummaries[0].continuityMarks.some((m) => m.includes("Cont. col 41")));
    assert.ok(pdfTiled.tileSummaries[1].continuityMarks.some((m) => m.includes("Cont. col 40")));

    // 1C. SVG vectorial seguro (sin scripts, sin refs externas, numeración perimetral presente)
    const svg = exportPatternToSvg(model, { cellPx: 12, transparentBackground: false });
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.ok(!svg.includes("<script") && !svg.includes("onload=") && !svg.includes("http://evil"));
    assert.ok(svg.includes(">80</text>") && svg.includes(">24</text>"));

    // 1D. PNG binario determinista (firma PNG + chunk pHYs con 300 DPI + fondo transparente)
    const png300 = exportPatternToPng(model, {
      cellPx: 10,
      dpi: 300,
      transparentBackground: true,
    });
    assert.deepEqual(Array.from(png300.bytes.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(png300.dpi, 300);
    assert.equal(png300.transparentBackground, true);
    const pngText = new TextDecoder("latin1").decode(png300.bytes);
    assert.ok(pngText.includes("IHDR") && pngText.includes("pHYs") && pngText.includes("IDAT") && pngText.includes("IEND"));

    // 1E. Instrucciones imprimibles independientes: cada fila suma exactamente 80 cuadros
    const inst = buildPrintableInstructionsDocument(model);
    assert.equal(inst.widthInvariantVerified, true);
    assert.equal(inst.rows.length, 24);
    assert.ok(inst.rows.every((r) => r.totalWidth === 80 && r.checkbox === "[ ]"));
    assert.match(inst.conventionDisclaimer, /No constituye una formula universal/i);
    const md = exportPrintableInstructionsToMarkdown(inst);
    assert.match(md, /Cadenetas de montaje \(base\)/);
    assert.match(md, /Cadenetas de subida/);
  });

  test("2. Archivo de proyecto JSON reutilizable: exportar, importar, igualdad de matrices, conflictos y rechazo de campos XP/GP/sesiones", () => {
    const ws = createStarterFiletWorkspace();
    const matrix80x24 = buildSyntheticPattern80x24();
    const pattern = createVersionedPattern({
      title: "Tapete 80x24 Exportable",
      matrix: matrix80x24,
      note: "v1 final",
    });
    ws.patterns = [pattern];

    const archive = buildFiletProjectArchive({
      pattern,
      selectedVersionNumbers: [1],
      meshSize: 4,
      orientation: "bottom_to_top",
      firstRowDirection: "ltr",
      includeProgress: false,
    });
    const rawJson = serializeFiletProjectArchive(archive);

    // No exporta datos personales ni recompensas
    assert.ok(!rawJson.includes("ownerId") && !rawJson.includes("xp_earned") && !rawJson.includes("gp_earned"));

    const parsed = validateAndParseProjectArchive(rawJson);
    assert.equal(parsed.valid, true);
    assert.ok(parsed.archive);
    assert.equal(matricesEqual(parsed.archive.pattern.versions[0].matrix, matrix80x24), true);

    // Rechaza archivos con sesiones/XP/GP inyectados
    const poisoned = JSON.stringify({ ...parsed.archive, xp_earned: 9999 });
    assert.equal(validateAndParseProjectArchive(poisoned).valid, false);

    // Detección de conflictos y protección contra sobrescritura silenciosa
    const conflict = detectArchiveImportConflicts(ws, parsed.archive);
    assert.equal(conflict.hasConflict, true);

    const aborted = applyArchiveImportToWorkspace({
      workspace: ws,
      archive: parsed.archive,
      strategy: "abort_on_conflict",
    });
    assert.equal(aborted.ok, false);

    const copied = applyArchiveImportToWorkspace({
      workspace: ws,
      archive: parsed.archive,
      strategy: "keep_both",
    });
    assert.equal(copied.ok, true);
    assert.equal(copied.workspace.patterns.length, 2);
  });

  test("3. Sincronización segura (revisiones + hash + cola offline + conflictos sin sobrescribir por fecha) y rendimiento 200×200", () => {
    const owner = "10000000-0000-4000-8000-0000000000aa";
    const baseWs = createStarterFiletWorkspace();
    const envA = createSyncEnvelope({ ownerId: owner, workspace: baseWs, deviceId: "pc-1", revision: 1 });
    const envB = createSyncEnvelope({ ownerId: owner, workspace: baseWs, deviceId: "tab-1", revision: 1 });

    // Dispositivo A añade un patrón offline
    const wsA = {
      ...baseWs,
      patterns: [createVersionedPattern({ title: "Patron A", matrix: [[1, 0], [0, 1]] })],
    };
    const queuedA = enqueueWorkspaceSyncOperation({
      envelope: envA,
      nextWorkspace: wsA,
      operationId: "sync-op-a1",
      entityKind: "pattern_version",
      entityId: wsA.patterns[0].id,
      deviceId: "pc-1",
    });
    assert.equal(queuedA.idempotentReplay, false);
    assert.equal(queuedA.envelope.revision, 2);
    assert.equal(queuedA.envelope.status, "pending_sync");

    // Replay idempotente de la misma operación
    const replayA = enqueueWorkspaceSyncOperation({
      envelope: queuedA.envelope,
      nextWorkspace: wsA,
      operationId: "sync-op-a1",
      entityKind: "pattern_version",
      entityId: wsA.patterns[0].id,
      deviceId: "pc-1",
    });
    assert.equal(replayA.idempotentReplay, true);

    // Dispositivo B añade un patrón distinto en paralelo -> misma revisión 2 pero distinto hash -> conflicto real
    const wsB = {
      ...baseWs,
      patterns: [createVersionedPattern({ title: "Patron B", matrix: [[0, 1], [1, 0]] })],
    };
    const queuedB = enqueueWorkspaceSyncOperation({
      envelope: envB,
      nextWorkspace: wsB,
      operationId: "sync-op-b1",
      entityKind: "pattern_version",
      entityId: wsB.patterns[0].id,
      deviceId: "tab-1",
    });

    const conflict = detectWorkspaceSyncConflict(queuedA.envelope, queuedB.envelope);
    assert.equal(conflict.hasConflict, true);
    assert.equal(conflict.reason, "REMOTE_AHEAD_WITH_LOCAL_QUEUE");

    // Resolución manual fusionando sin perder ninguno de los dos patrones
    const merged = resolveWorkspaceConflictManually({
      local: queuedA.envelope,
      remote: queuedB.envelope,
      choice: "merge_collections_and_patterns",
    });
    assert.equal(merged.workspace.patterns.length, 2);
    assert.equal(merged.revision, 3);

    // Rendimiento en patrón grande 200×200 (Bloque 9)
    const mat200: BinaryMatrix = Array.from({ length: 200 }, (_, r) =>
      Array.from({ length: 200 }, (_, c): FiletCell => ((r + c) % 3 === 0 ? 1 : 0))
    );
    const t0 = performance.now();
    const model200 = buildUniversalExportModel({
      patternName: "Manta 200x200",
      versionNumber: 1,
      matrix: mat200,
      meshSize: 3,
      orientation: "bottom_to_top",
      firstRowDirection: "rtl",
      marginMm: 10,
      showPerimeterNumbers: true,
      showGridLines: true,
      filledColorHex: "#3A2E2B",
      emptyColorHex: "#FFFDF8",
      gridColorHex: "#8C7A6B",
      showLegend: true,
    });
    const pdf200 = exportPatternToVectorPdf(model200, {
      paperSize: "A3",
      paperOrientation: "landscape",
      paginationMode: "tile_pages",
      maxColsPerTile: 50,
      maxRowsPerTile: 50,
      includeInstructionsPages: false,
    });
    const elapsedMs = performance.now() - t0;
    assert.equal(pdf200.chartPagesCount, 16); // 4 × 4 baldosas de 50×50
    assert.ok(elapsedMs < 3500, `Exportación vectorial 200×200 debe ser rápida (${elapsedMs.toFixed(1)}ms)`);
  });

  test("4. Auditoría SQL PGlite (permisos REVOKE/GRANT service_role + INCOMPLETE_SEGMENTS) y seguridad propietario/anónimo/ajeno", async () => {
    const ownerId = "10000000-0000-4000-8000-000000000055";
    const intruderId = "10000000-0000-4000-8000-000000000099";
    const projId = "40000000-0000-4000-8000-000000000055";

    // Seguridad de recursos: propietario aprobado, usuario ajeno y anónimo rechazados
    const pdfMagic = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    assert.equal(
      validatePrivateResourceFile({
        buildingId: "atelier",
        resourceType: "historical_alphabet_document",
        filename: "hoja.pdf",
        reportedMimeType: "application/pdf",
        sizeBytes: 1024,
        ownerId,
        authenticatedUserId: ownerId,
        fileBytes: pdfMagic,
      }).valid,
      true
    );
    assert.equal(
      validatePrivateResourceFile({
        buildingId: "atelier",
        resourceType: "historical_alphabet_document",
        filename: "hoja.pdf",
        reportedMimeType: "application/pdf",
        sizeBytes: 1024,
        ownerId,
        authenticatedUserId: intruderId,
        fileBytes: pdfMagic,
      }).valid,
      false
    );
    assert.equal(
      validatePrivateResourceFile({
        buildingId: "atelier",
        resourceType: "historical_alphabet_document",
        filename: "hoja.pdf",
        reportedMimeType: "application/pdf",
        sizeBytes: 1024,
        ownerId,
        authenticatedUserId: "",
        fileBytes: pdfMagic,
      }).valid,
      false
    );

    // PGlite: verificar permisos de RPC y rechazo INCOMPLETE_SEGMENTS en servidor
    const schema = fs.readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
    const draftSql = fs.readFileSync(
      new URL("../supabase/drafts/20261124_filet_guided_progress_atomic.sql", import.meta.url),
      "utf8"
    );
    const knitTable = schema.match(
      /CREATE TABLE IF NOT EXISTS public\.knitting_projects \([\s\S]*?\n\);/
    )![0];

    const db = await PGlite.create();
    try {
      await db.exec(`
        CREATE ROLE anon;
        CREATE ROLE authenticated;
        CREATE ROLE service_role BYPASSRLS;
        CREATE SCHEMA auth;
        CREATE TABLE auth.users(id uuid PRIMARY KEY);
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
          SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
        $$;
        ${knitTable}
      `);
      await db.exec(draftSql);

      // Verificar permisos: anon/authenticated NO pueden ejecutar; service_role SÍ
      const privs = await db.query<{ anon_exec: boolean; auth_exec: boolean; svc_exec: boolean }>(`
        SELECT
          has_function_privilege('anon', 'public.confirm_filet_row_atomic_v1(uuid,uuid,text,int,text,int,text,int,int)', 'EXECUTE') AS anon_exec,
          has_function_privilege('authenticated', 'public.confirm_filet_row_atomic_v1(uuid,uuid,text,int,text,int,text,int,int)', 'EXECUTE') AS auth_exec,
          has_function_privilege('service_role', 'public.confirm_filet_row_atomic_v1(uuid,uuid,text,int,text,int,text,int,int)', 'EXECUTE') AS svc_exec
      `);
      assert.equal(privs.rows[0].anon_exec, false);
      assert.equal(privs.rows[0].auth_exec, false);
      assert.equal(privs.rows[0].svc_exec, true);

      // Verificar rechazo INCOMPLETE_SEGMENTS en PostgreSQL
      await db.exec(`
        INSERT INTO auth.users VALUES ('${ownerId}');
        INSERT INTO public.knitting_projects(id, user_id, name, total_rows_target, completed_rows, linked_pattern_version_id)
        VALUES ('${projId}', '${ownerId}', 'Auditoria 5', 10, 0, 'pat-5-v1');
      `);
      await assert.rejects(
        db.query(
          `SELECT public.confirm_filet_row_atomic_v1($1::uuid, $2::uuid, 'pat-5-v1', 1, 'op-inc', 0, 'dev', 2, 5)`,
          [ownerId, projId]
        ),
        /INCOMPLETE_SEGMENTS/
      );
    } finally {
      await db.close();
    }
  });
});
