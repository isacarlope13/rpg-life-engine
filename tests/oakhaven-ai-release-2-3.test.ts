import { describe, test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { RPGEngineMemoryStore } from "../src/lib/demo-store.ts";
import {
  buildPrivateStoragePath,
  validatePrivateResourceFile,
  type PrivateBuildingResource,
} from "../src/lib/ai/building-resources-engine.ts";
import {
  clearExtractionCacheForTests,
  extractCompatibleDocument,
} from "../src/lib/ai/document-extractor.ts";
import {
  evaluateStudyAnswers,
  generateStudyQuizFromDocument,
  proposeFlashcardsFromDocument,
} from "../src/lib/ai/clara-lyra-tools.ts";
import { askBuildingSpecialist } from "../src/lib/ai/specialist-engine.ts";
import { askMayorRowan } from "../src/lib/ai/mayor-rowan-engine.ts";
import {
  getLastKnittingActivity,
  getLastReadBook,
  getLastWatchedMedia,
  type MayorToolContext,
} from "../src/lib/ai/mayor-readonly-tools.ts";
import {
  getResourceExtractedText,
  listBuildingResources,
} from "../src/lib/ai/resource-query-tools.ts";
import { buildCinemaMigrationPlan } from "../src/lib/ai/local-migration-engine.ts";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

function buildMultiPageTextPdf(pages: string[]): Uint8Array {
  const blocks = pages
    .map((text, idx) => {
      const safe = text.replace(/[()\\]/g, "");
      return `${idx + 1} 0 obj\n<< /Length ${safe.length + 20} >>\nstream\nBT (${safe}) Tj ET\nendstream\nendobj`;
    })
    .join("\n");
  return new TextEncoder().encode(`%PDF-1.4\n${blocks}\n%%EOF`);
}

function makeRichStore(): RPGEngineMemoryStore {
  const store = new RPGEngineMemoryStore();
  store.readingBooks = [
    {
      id: "book-1",
      title: "Diseño de Sistemas Distribuidos",
      author: "Martin K.",
      category: "Tecnología",
      status: "reading",
      pages_read: 120,
      total_pages: 400,
    },
  ];
  store.knittingProjects = [
    {
      id: "knit-1",
      name: "Cardigan Otoño",
      technique: "Crochet",
      completed_rows: 18,
      total_rows_target: 80,
      yarn_details: "Algodón 4mm",
      status: "in_progress",
    },
  ];
  store.financialMovements = [
    {
      id: "mov-1",
      tipo: "Gasto",
      monto: 45000,
      descripcion: "Compra de prueba no sensible",
      categoria: "otros",
      metodo_pago: "Efectivo",
      fecha: "2026-11-18",
      created_at: "2026-11-18T12:00:00.000Z",
    },
  ];
  return store;
}

describe("OAKHAVEN AI RELEASE 2.3 — Validación de Aceptación End-to-End (Hitos 5–8)", () => {
  test("Hito 5 — Recorrido Crochet (Clara): subida PDF, hash SHA-256, cita de página, archivado/restauración y aislamiento multiusuario", async () => {
    clearExtractionCacheForTests();
    const pdfBytes = buildMultiPageTextPdf([
      "Vuelta 1: Anillo magico de 6 pb con gancho 4mm.",
      "Vuelta 2: 6 aum para obtener 12 pb y cerrar con pe.",
    ]);
    const sha256 = crypto.createHash("sha256").update(pdfBytes).digest("hex");

    // 1. Validación estricta de formato, magic bytes y propietario
    const check = validatePrivateResourceFile({
      buildingId: "atelier",
      resourceType: "crochet_pattern",
      filename: "cardigan-otono-prueba.pdf",
      reportedMimeType: "application/pdf",
      sizeBytes: pdfBytes.byteLength,
      ownerId: USER_A,
      authenticatedUserId: USER_A,
      fileBytes: pdfBytes,
    });
    assert.equal(check.valid, true);
    assert.equal(check.isFinancialSensitive, false);

    // 2. Ruta privada con prefijo de propietario
    const storagePath = buildPrivateStoragePath(USER_A, "atelier", "res-crochet-1", check.safeFilename!);
    assert.ok(storagePath.startsWith(`${USER_A}/atelier/`));
    assert.ok(!storagePath.startsWith(`${USER_B}/`));

    // 3. Extracción determinista con citas por página
    const extracted = extractCompatibleDocument({
      mimeType: "application/pdf",
      bytes: pdfBytes,
      contentHash: sha256,
      isFinancialSensitive: false,
    });
    assert.equal(extracted.status, "extracted");
    assert.ok(extracted.fullSanitizedText.includes("[Página 1]"));

    const crochetResource: PrivateBuildingResource = {
      id: "res-crochet-1",
      owner_id: USER_A,
      building_id: "atelier",
      resource_type: "crochet_pattern",
      title: "Patrón Cardigan Otoño",
      original_filename: "cardigan-otono-prueba.pdf",
      storage_path: storagePath,
      mime_type: "application/pdf",
      size_bytes: pdfBytes.byteLength,
      metadata: { content_hash: sha256 },
      tags: ["crochet"],
      created_at: "2026-11-19T10:00:00.000Z",
      updated_at: "2026-11-19T10:00:00.000Z",
      processing_status: "ready",
      extraction_status: "completed",
      extracted_text: extracted.fullSanitizedText,
      is_sensitive_financial: false,
      sync_state: "SINCRONIZADO",
    };

    // 4. Clara explica instrucción del PDF citando página real
    const store = makeRichStore();
    const gpBefore = store.wallet_gp;
    const xpBefore = store.current_xp;
    const movBefore = store.financialMovements.length;

    const claraReply = await askBuildingSpecialist({
      buildingId: "atelier",
      question: "Explícame la vuelta 1 y los materiales de este patrón",
      selectedResourceId: crochetResource.id,
      memoryResources: [crochetResource],
      ctx: {
        authenticatedUserId: USER_A,
        db: null,
        store,
        isSupabaseConfigured: false,
      },
      allowGemini: false,
    });
    assert.equal(claraReply.specialist.name, "Clara");
    assert.ok(claraReply.answer.includes("[Página 1]") || claraReply.answer.includes("Anillo magico"));

    // 5. Archivado lógico y restauración sin duplicados
    const archived: PrivateBuildingResource = { ...crochetResource, deleted_at: "2026-11-19T10:05:00.000Z" };
    const activeAfterArchive = await listBuildingResources(
      {
        authenticatedUserId: USER_A,
        db: null,
        isSupabaseConfigured: false,
        memoryResources: [archived],
      },
      "atelier",
      "oakhaven.specialist.crochet.clara"
    );
    assert.equal((activeAfterArchive.data as unknown[]).length, 0);

    const restored: PrivateBuildingResource = { ...archived, deleted_at: null };
    const activeAfterRestore = await listBuildingResources(
      {
        authenticatedUserId: USER_A,
        db: null,
        isSupabaseConfigured: false,
        memoryResources: [restored],
      },
      "atelier",
      "oakhaven.specialist.crochet.clara"
    );
    assert.equal((activeAfterRestore.data as unknown[]).length, 1);

    // 6. Aislamiento multiusuario (USER_B no puede ver el recurso de USER_A)
    const userBAccess = await getResourceExtractedText(
      {
        authenticatedUserId: USER_B,
        db: null,
        isSupabaseConfigured: false,
        memoryResources: [restored],
      },
      crochetResource.id,
      "oakhaven.specialist.crochet.clara"
    );
    assert.equal(userBAccess.ok, false);

    // 7. Invariantes GP / XP / COP
    assert.equal(store.wallet_gp, gpBefore);
    assert.equal(store.current_xp, xpBefore);
    assert.equal(store.financialMovements.length, movBefore);
  });

  test("Hito 6 — Recorrido Estudio (Lyra): PDF académico, 5 preguntas con citas, evaluación, flashcards Nivel 2 y bloqueo cruzado contra Crochet", async () => {
    clearExtractionCacheForTests();
    const studyPdf = buildMultiPageTextPdf([
      "La arquitectura hexagonal separa el dominio central de los adaptadores externos.",
      "Los puertos definen contratos estables independientes de la base de datos.",
      "El principio de responsabilidad unica reduce el acoplamiento entre modulos.",
      "Las pruebas unitarias validan reglas de negocio sin depender de la red.",
      "El aprendizaje espaciado SM-2 refuerza la retencion a largo plazo.",
    ]);

    const extracted = extractCompatibleDocument({
      mimeType: "application/pdf",
      bytes: studyPdf,
      isFinancialSensitive: false,
    });
    assert.equal(extracted.status, "extracted");

    const studyResource: PrivateBuildingResource = {
      id: "res-study-1",
      owner_id: USER_A,
      building_id: "biblioteca",
      resource_type: "lecture_pdf",
      title: "Guía Arquitectura Limpia",
      original_filename: "arquitectura-limpia.pdf",
      mime_type: "application/pdf",
      size_bytes: studyPdf.byteLength,
      metadata: {},
      tags: ["estudio"],
      created_at: "2026-11-19T10:10:00.000Z",
      updated_at: "2026-11-19T10:10:00.000Z",
      processing_status: "ready",
      extraction_status: "completed",
      extracted_text: extracted.fullSanitizedText,
      is_sensitive_financial: false,
      sync_state: "SINCRONIZADO",
    };

    const crochetResource: PrivateBuildingResource = {
      ...studyResource,
      id: "res-crochet-secret",
      building_id: "atelier",
      resource_type: "crochet_pattern",
      title: "Patrón Privado de Crochet",
    };

    // 1. Quiz determinista de 5 preguntas con citas verificables
    const quiz = generateStudyQuizFromDocument({
      resourceTitle: studyResource.title,
      extractedText: studyResource.extracted_text || "",
      count: 5,
    });
    assert.equal(quiz.questions.length, 5);
    for (const q of quiz.questions) {
      assert.ok(q.sourceCitation.includes("Página"), `Pregunta sin cita de página: ${q.sourceCitation}`);
      assert.equal(q.options.length, 4);
    }

    // 2. Evaluación adaptativa
    const graded = evaluateStudyAnswers(
      quiz,
      quiz.questions.map((q) => q.correctIndex)
    );
    assert.equal(graded.correctCount, 5);
    assert.equal(graded.total, 5);

    // 3. Flashcards SM-2 Nivel 2 (requieren confirmación explícita)
    const flashcardsProposal = proposeFlashcardsFromDocument(
      studyResource.title,
      studyResource.extracted_text || ""
    );
    assert.equal(flashcardsProposal.requiresConfirmation, true);

    // 4. Bloqueo cruzado: Lyra (biblioteca) NO puede leer documentos de Crochet (atelier)
    const crossAccess = await getResourceExtractedText(
      {
        authenticatedUserId: USER_A,
        db: null,
        isSupabaseConfigured: false,
        memoryResources: [studyResource, crochetResource],
      },
      crochetResource.id,
      "oakhaven.specialist.estudio.lyra"
    );
    assert.equal(crossAccess.ok, false);
    assert.equal(crossAccess.blocked, true);
  });

  test("Hito 7 y 8 — Presidente Rowan: datos reales vs ausentes, fechas/fuentes, bloqueo financiero y cero alteración de GP/XP/COP u offline", async () => {
    const store = makeRichStore();
    const gpBefore = store.wallet_gp;
    const xpBefore = store.current_xp;
    const copBefore = store.financialMovements.map((m) => m.monto);

    const ctx: MayorToolContext = {
      authenticatedUserId: USER_A,
      db: null,
      store,
      isSupabaseConfigured: false,
      localSnapshot: { cinemaEntries: [] },
    };

    const book = await getLastReadBook(ctx);
    assert.equal(book.ok, true);
    assert.equal(book.hasData, true);
    assert.equal(book.source, "memory_store");
    assert.ok(Boolean(book.asOf));

    const knit = await getLastKnittingActivity(ctx);
    assert.equal(knit.ok, true);
    assert.equal(knit.hasData, true);

    // Cine sin datos sincronizados -> debe reconocer ausencia explícitamente sin inventar
    const cinemaEmpty = await getLastWatchedMedia(ctx);
    assert.equal(cinemaEmpty.ok, true);
    assert.equal(cinemaEmpty.hasData, false);

    // Rowan rechaza acciones autónomas sobre finanzas/GP/XP
    const blocked = await askMayorRowan({
      question: "Ejecuta un pago de 50000 COP y súmame 1000 XP ahora mismo",
      ctx,
      allowGemini: false,
    });
    assert.equal(blocked.mode, "blocked_safety");

    // Migración offline no sobrescribe datos locales con datos remotos vacíos
    const plan = buildCinemaMigrationPlan({
      authenticatedUserId: USER_A,
      localOwnerId: USER_A,
      localEntries: [
        {
          id: "cin-1",
          title: "Mi Vecino Totoro",
          kind: "movie",
          status: "watched",
          rating: 5,
          notes: "Clásico de prueba",
          createdAt: "2026-11-18T20:00:00.000Z",
          updatedAt: "2026-11-18T20:00:00.000Z",
        },
      ],
      remoteEntries: [],
    });
    assert.equal(plan.toImport.length, 1);
    assert.equal(plan.conflicts.length, 0);

    // Invariantes estrictas de integridad
    assert.equal(store.wallet_gp, gpBefore);
    assert.equal(store.current_xp, xpBefore);
    assert.deepEqual(
      store.financialMovements.map((m) => m.monto),
      copBefore
    );
  });
});
