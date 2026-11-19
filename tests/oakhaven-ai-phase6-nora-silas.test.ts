import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { RPGEngineMemoryStore } from "../src/lib/demo-store.ts";
import {
  explainGpVsCop,
  getCinemaCollection,
  getRecordedObligations,
  getVerifiedFinancialMovements,
  isDemoBankAccount,
  isDemoFinancialMovement,
  maskFinancialIdentifiers,
  proposeCinemaReview,
  recommendFromWatchlist,
  simulateBudgetScenario,
  simulateDebtPaymentImpact,
} from "../src/lib/ai/nora-silas-tools.ts";
import { askBuildingSpecialist } from "../src/lib/ai/specialist-engine.ts";
import { askMayorRowan } from "../src/lib/ai/mayor-rowan-engine.ts";
import { getResourceExtractedText } from "../src/lib/ai/resource-query-tools.ts";
import type { CinemaEntry } from "../src/lib/sanctuary/cinema-store.ts";
import type { PrivateBuildingResource } from "../src/lib/ai/building-resources-engine.ts";
import type { MayorToolContext } from "../src/lib/ai/mayor-readonly-tools.ts";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

describe("OAKHAVEN AI FASE 6 — Nora (Cine) y Silas (Guardián Financiero Privado)", () => {
  test("1. Nora (Cine): distingue película/serie/musical, favorita vs vista, watchlist, progreso de serie, recomendaciones y propuesta Nivel 2 idempotente", async () => {
    const entries: CinemaEntry[] = [
      {
        id: "cin-mov-1",
        title: "El Viaje de Chihiro",
        kind: "movie",
        status: "favorite",
        rating: 5,
        favoriteSongOrScene: "El viaje en tren sobre el agua",
        notes: "Obra maestra cozy",
        watchedAt: "2026-11-17T21:00:00.000Z",
        createdAt: "2026-11-10T10:00:00.000Z",
        updatedAt: "2026-11-17T21:30:00.000Z",
      },
      {
        id: "cin-ser-1",
        title: "Frieren",
        kind: "series",
        status: "watching",
        season: 1,
        episode: 14,
        notes: "Ritmo sereno",
        createdAt: "2026-11-12T10:00:00.000Z",
        updatedAt: "2026-11-18T22:00:00.000Z",
      },
      {
        id: "cin-mus-1",
        title: "Hamilton",
        kind: "musical",
        status: "watchlist",
        notes: "Pendiente para fin de semana",
        createdAt: "2026-11-18T15:00:00.000Z",
        updatedAt: "2026-11-18T15:00:00.000Z",
      },
    ];

    const store = new RPGEngineMemoryStore();
    const gpBefore = store.wallet_gp;
    const xpBefore = store.current_xp;
    const ctx: MayorToolContext = {
      authenticatedUserId: USER_A,
      db: null,
      store,
      isSupabaseConfigured: false,
      localSnapshot: { cinemaEntries: entries },
    };

    const col = await getCinemaCollection(ctx);
    assert.equal(col.source, "local_device_snapshot");
    assert.equal(col.movies.length, 1);
    assert.equal(col.series.length, 1);
    assert.equal(col.musicals.length, 1);
    // Obra favorita con watchedAt conserva historial de visionado
    assert.equal(col.lastWatchedMovie?.title, "El Viaje de Chihiro");
    assert.equal(col.favorites.length, 1);
    assert.equal(col.watching[0].season, 1);
    assert.equal(col.watching[0].episode, 14);

    // Recomendación estrictamente basada en watchlist sin afirmar streaming
    const rec = recommendFromWatchlist(col, "musical");
    assert.equal(rec.basis, "watchlist");
    assert.ok(rec.message.includes("Hamilton"));
    assert.ok(rec.message.includes("no afirmo disponibilidad"));

    // Fallback sin historial
    const emptyCol = await getCinemaCollection({ ...ctx, localSnapshot: { cinemaEntries: [] } });
    const emptyRec = recommendFromWatchlist(emptyCol);
    assert.equal(emptyRec.basis, "general_fallback");

    // Propuesta Nivel 2 idempotente
    const p1 = proposeCinemaReview(entries[0]);
    const p2 = proposeCinemaReview(entries[0]);
    assert.equal(p1.requiresConfirmation, true);
    assert.equal(p1.idempotencyKey, p2.idempotencyKey);

    const noraRes = await askBuildingSpecialist({
      buildingId: "cine",
      question: "¿Qué película vi por última vez, qué serie estoy viendo y propón una reseña?",
      ctx,
      allowGemini: false,
    });
    assert.equal(noraRes.specialist.name, "Nora");
    assert.ok(noraRes.answer.includes("El Viaje de Chihiro"));
    assert.ok(noraRes.answer.includes("T1 E14"));
    assert.equal(noraRes.proposal?.requiresConfirmation, true);
    assert.equal(store.wallet_gp, gpBefore);
    assert.equal(store.current_xp, xpBefore);
  });

  test("2. Silas (Banco): excluye INITIAL_FINANCIAL_MOVEMENTS y demos, calcula COP exactos, separa monedas, simula sin escribir y bloquea mutaciones/Gemini", async () => {
    const store = new RPGEngineMemoryStore();
    // Añadir movimientos sintéticos de prueba (no sensibles) + un duplicado + una moneda distinta
    const todayIso = new Date().toISOString();
    store.financialMovements = [
      ...store.financialMovements, // contiene INITIAL_FINANCIAL_MOVEMENTS (deben ser EXCLUIDOS)
      {
        id: "user-inc-1",
        tipo: "Ingreso",
        monto: 1500000,
        descripcion: "Pago quincenal de prueba",
        categoria: "Sueldo",
        metodo_pago: "Transferencia",
        fecha: todayIso.slice(0, 10),
        created_at: todayIso,
      },
      {
        id: "user-exp-1",
        tipo: "Gasto",
        monto: 85000,
        descripcion: "Mercado prueba cuenta 1234567890",
        categoria: "Comida",
        metodo_pago: "Tarjeta",
        fecha: todayIso.slice(0, 10),
        created_at: todayIso,
      },
      {
        id: "user-exp-2-dup",
        tipo: "Gasto",
        monto: 85000,
        descripcion: "Mercado prueba cuenta 1234567890",
        categoria: "Comida",
        metodo_pago: "Tarjeta",
        fecha: todayIso.slice(0, 10),
        created_at: todayIso,
      },
      {
        id: "user-usd-1",
        tipo: "Gasto",
        monto: 20,
        descripcion: "Suscripción USD",
        categoria: "Software",
        metodo_pago: "Tarjeta",
        fecha: todayIso.slice(0, 10),
        created_at: todayIso,
        currency: "USD",
      } as (typeof store.financialMovements)[number],
    ];

    assert.equal(isDemoBankAccount("acc_nu_39"), true);
    assert.equal(isDemoFinancialMovement({ id: "mts5z6dfjzde" }), true);
    assert.equal(maskFinancialIdentifiers("Cuenta 1234567890"), "Cuenta [CUENTA_OCULTA]");

    const gpBefore = store.wallet_gp;
    const xpBefore = store.current_xp;
    const movCountBefore = store.financialMovements.length;

    const ctx: MayorToolContext = {
      authenticatedUserId: USER_A,
      db: null,
      store,
      isSupabaseConfigured: false,
    };

    const fin = await getVerifiedFinancialMovements(ctx, 15);
    assert.ok(fin.excludedDemoCount > 0, "Debe excluir INITIAL_FINANCIAL_MOVEMENTS");
    assert.equal(fin.nonCopCount, 1, "Debe separar USD sin mezclar monedas");
    assert.equal(fin.totalIncomeCop, 1500000);
    assert.equal(fin.totalExpenseCop, 170000); // 85000 + 85000 exactos
    assert.equal(fin.netCashflowCop, 1330000);
    assert.equal(fin.potentialDuplicates.length, 1);
    assert.ok(!fin.potentialDuplicates[0].description.includes("1234567890"));

    // Simulaciones puras sin escritura
    const simSave = simulateBudgetScenario({
      monthlySavingCop: 100000,
      months: 6,
      currentNetCashflowCop: fin.netCashflowCop,
    });
    assert.equal(simSave.persisted, false);
    assert.equal(simSave.projectedSavedCop, 600000);

    const simDebt = simulateDebtPaymentImpact({
      debtName: "Tarjeta prueba",
      currentBalanceCop: 400000,
      extraPaymentCop: 100000,
    });
    assert.equal(simDebt.persisted, false);
    assert.equal(simDebt.projectedBalanceCop, 300000);
    assert.ok(explainGpVsCop().includes("COP"));

    const ob = await getRecordedObligations(ctx);
    assert.ok(ob.totalMonthlyObligationsCop >= 0);

    // Silas responde siempre en modo determinista (nunca envía datos financieros a Gemini por defecto)
    const silasRes = await askBuildingSpecialist({
      buildingId: "banco_oakhaven",
      question: "¿Cuánto gasté esta quincena, simula ahorrar 100000 COP y explica la diferencia entre GP y COP?",
      ctx,
      allowGemini: true, // Incluso con allowGemini: true, Silas fuerza modo determinista privado
    });
    assert.equal(silasRes.specialist.name, "Silas");
    assert.equal(silasRes.mode, "deterministic_grounded");
    assert.ok(silasRes.answer.includes("ESCENARIO HIPOTÉTICO"));
    assert.ok(!silasRes.answer.includes("1234567890"));
    assert.equal(silasRes.proposal, undefined);

    // Silas bloquea cualquier mutación financiera (saldos, pagos, transferencias, obligaciones)
    const silasBlock = await askBuildingSpecialist({
      buildingId: "banco_oakhaven",
      question: "Modifica mi saldo y ejecuta una transferencia de 50000 COP",
      ctx,
      allowGemini: false,
    });
    assert.equal(silasBlock.mode, "blocked_safety");

    // Invariantes estrictas: cero cambios en movimientos, GP o XP
    assert.equal(store.financialMovements.length, movCountBefore);
    assert.equal(store.wallet_gp, gpBefore);
    assert.equal(store.current_xp, xpBefore);
  });

  test("3. Transversal: aislamiento de extractos bancarios ante otros agentes, Rowan sin datos demo y cero regresiones", async () => {
    const bankDoc: PrivateBuildingResource = {
      id: "bank-stmt-1",
      owner_id: USER_A,
      building_id: "banco_oakhaven",
      resource_type: "bank_statement",
      title: "Extracto Prueba",
      original_filename: "extracto.pdf",
      mime_type: "application/pdf",
      size_bytes: 5000,
      metadata: {},
      tags: [],
      created_at: "2026-11-19T10:00:00Z",
      updated_at: "2026-11-19T10:00:00Z",
      processing_status: "ready",
      extraction_status: "blocked_sensitive",
      extracted_text: "Saldo confidencial",
      is_sensitive_financial: true,
      sync_state: "SINCRONIZADO",
    };

    // Nora (Cine) y USER_B jamás pueden leer documentos bancarios
    const noraBlocked = await getResourceExtractedText(
      { authenticatedUserId: USER_A, db: null, isSupabaseConfigured: false, memoryResources: [bankDoc] },
      "bank-stmt-1",
      "oakhaven.specialist.cine.nora"
    );
    assert.equal(noraBlocked.ok, false);
    assert.equal(noraBlocked.blocked, true);

    const userBBlocked = await getResourceExtractedText(
      { authenticatedUserId: USER_B, db: null, isSupabaseConfigured: false, memoryResources: [bankDoc] },
      "bank-stmt-1",
      "oakhaven.specialist.banco.silas"
    );
    assert.equal(userBBlocked.ok, false);

    // Rowan no reporta INITIAL_FINANCIAL_MOVEMENTS como gastos reales del usuario
    const freshStore = new RPGEngineMemoryStore();
    const rowanEmptyExpenses = await askMayorRowan({
      question: "¿Cuánto gasté esta semana?",
      ctx: {
        authenticatedUserId: USER_A,
        db: null,
        store: freshStore,
        isSupabaseConfigured: false,
      },
      allowGemini: false,
    });
    assert.equal(rowanEmptyExpenses.mode, "deterministic_grounded");
    assert.ok(rowanEmptyExpenses.answer.includes("No tienes gastos registrados"));
  });
});
