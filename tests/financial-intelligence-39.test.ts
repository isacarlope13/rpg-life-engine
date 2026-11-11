import { test } from "node:test";
import assert from "node:assert/strict";
import { INITIAL_FINANCIAL_MOVEMENTS } from "../src/lib/initial-financial-movements.ts";
import {
  auditAndClassifyMovements,
  type ReclassifiedFinancialDataset,
} from "../src/lib/sanctuary/financial-auditor.ts";
import { calculateFinancialSummary } from "../src/lib/sanctuary/bank-engine.ts";
import {
  determineBiweeklyCycle,
  calculateBiweeklyCashflowPlan,
  validateWishlistPurchaseBudget,
  type CommittedObligationItem,
  type BiweeklyPlanningParams,
} from "../src/lib/sanctuary/financial-core.ts";

test("Hito 3.9.1 — 1. Exclusión estricta de saldos iniciales de ingresos y sueldos", () => {
  const result: ReclassifiedFinancialDataset = auditAndClassifyMovements(INITIAL_FINANCIAL_MOVEMENTS);

  // 1. Debe haber identificado exactamente 2 saldos iniciales del 4 de septiembre
  assert.equal(
    result.summary.initialBalancesCount,
    2,
    "Deben identificarse exactamente 2 saldos de apertura de cuenta al 4 de septiembre."
  );

  const initialMovements = result.movements.filter((m) => m.isInitialBalance);
  assert.equal(initialMovements.length, 2);

  const initialAccount = initialMovements.find((m) => m.id === "mts5z6dfjzde")!;
  const initialCash = initialMovements.find((m) => m.id === "mts61q9xcf10")!;

  assert.ok(initialAccount, "Debe existir el registro 'Inicial cuenta' (mts5z6dfjzde)");
  assert.equal(initialAccount.monto, 233501, "Monto de saldo inicial cuenta debe ser 233.501 COP.");
  assert.equal(initialAccount.classification, "saldo_inicial");

  assert.ok(initialCash, "Debe existir el registro 'Inicial efectivo' (mts61q9xcf10)");
  assert.equal(initialCash.monto, 170000, "Monto de saldo inicial efectivo debe ser 170.000 COP.");
  assert.equal(initialCash.classification, "saldo_inicial");

  // 2. El total aislado de saldos iniciales debe ser exactamente 403.501 COP
  assert.equal(
    result.summary.initialBalancesTotalCop,
    403501,
    "La suma de saldos iniciales aislados debe ser exactamente 403.501 COP (233.501 + 170.000)."
  );
});

test("Hito 3.9.1 — 2. Ingesta determinista, trazabilidad y ausencia de duplicados", () => {
  const result = auditAndClassifyMovements(INITIAL_FINANCIAL_MOVEMENTS);

  // 1. Longitud total idéntica
  assert.equal(
    result.movements.length,
    INITIAL_FINANCIAL_MOVEMENTS.length,
    "La auditoría debe conservar exactamente los 116 registros."
  );
  assert.equal(result.summary.totalCount, 116);

  // 2. Verificación de unicidad e inviolabilidad de IDs
  const idSet = new Set<string>();
  for (const m of result.movements) {
    assert.ok(m.id && m.id.length > 0, "Cada movimiento debe tener un ID válido.");
    assert.equal(idSet.has(m.id), false, `ID duplicado detectado: ${m.id}`);
    idSet.add(m.id);

    // Debe conservar fecha, monto y concepto original
    const raw = INITIAL_FINANCIAL_MOVEMENTS.find((r) => r.id === m.id)!;
    assert.equal(m.monto, raw.monto, `El monto de ${m.id} no debe alterarse.`);
    assert.equal(m.fecha, raw.fecha, `La fecha de ${m.id} no debe alterarse.`);
    assert.equal(m.descripcion, raw.descripcion, `La descripción de ${m.id} debe ser idéntica.`);
  }
});

test("Hito 3.9.1 — 3. Reclasificación y auditoría de la categoría «Inversiones»", () => {
  const result = auditAndClassifyMovements(INITIAL_FINANCIAL_MOVEMENTS);

  // 1. Debe haber identificado los 11 movimientos etiquetados como Inversiones
  assert.equal(result.summary.investmentsCount, 11, "Deben existir 11 movimientos de Inversiones.");
  assert.equal(result.investmentsAudit.length, 11);

  // 2. Debe identificar la devolución de universidad como reembolso
  const refundItem = result.investmentsAudit.find((i) => i.id === "mts69a4jtsgt")!;
  assert.ok(refundItem, "Debe auditar la Devolución universidad (mts69a4jtsgt).");
  assert.equal(refundItem.suggestedClassification, "reembolso");
  assert.ok(refundItem.auditReason.includes("Reembolso"));

  // 3. Debe identificar préstamos o apoyos familiares (Mamá, Mami, Migue, Emilio)
  const familyItems = result.investmentsAudit.filter(
    (i) => i.suggestedClassification === "prestamo_familiar"
  );
  assert.ok(familyItems.length >= 4, "Debe identificar al menos 4 movimientos de préstamos familiares.");
  assert.ok(familyItems.some((f) => f.descripcion.toLowerCase().includes("mami")));
  assert.ok(familyItems.some((f) => f.descripcion.toLowerCase().includes("mamá")));
  assert.ok(familyItems.some((f) => f.descripcion.toLowerCase().includes("migue")));

  // 4. Debe identificar el ahorro programado de septiembre
  const sepSaving = result.investmentsAudit.find((i) => i.id === "mubeuskpi08f")!;
  assert.ok(sepSaving, "Debe auditar el ahorro de septiembre.");
  assert.equal(sepSaving.suggestedClassification, "inversion_ahorro");
});

test("Hito 3.9.1 — 4. Detección del patrón quincenal de sueldos", () => {
  const result = auditAndClassifyMovements(INITIAL_FINANCIAL_MOVEMENTS);

  // 1. Debe haber detectado exactamente 5 sueldos quincenales (excluyendo los 2 saldos iniciales)
  assert.equal(result.summary.salaryCount, 5, "Deben existir exactamente 5 sueldos quincenales.");

  // 2. Monto acumulado de los 5 sueldos
  // 1.224.561 + 791.754 + 1.145.359 + 915.000 + 1.087.033 = 5.163.707 COP
  assert.equal(result.summary.totalSalaryCop, 5163707);

  // 3. Promedio quincenal estimado
  // 5.163.707 / 5 = 1.032.741 COP
  assert.equal(result.summary.averageBiweeklySalaryCop, 1032741);
  assert.ok(
    result.summary.averageBiweeklySalaryCop >= 950000 &&
    result.summary.averageBiweeklySalaryCop <= 1100000,
    "El promedio quincenal real debe oscilar en torno a $1.000.000 COP, confirmando el caso de estudio."
  );
});

test("Hito 3.9.1 — 5. calculateFinancialSummary en bank-engine no infla ingresos con saldos iniciales", () => {
  // Cuando calculamos el resumen sobre los 116 movimientos crudos:
  const summary = calculateFinancialSummary(INITIAL_FINANCIAL_MOVEMENTS);

  // Total de ingresos crudos brutos: $7.432.208 COP (incluyendo clases particulares, sueldos y saldos iniciales).
  // Al excluir los 403.501 COP de saldos iniciales del 4 de septiembre:
  // 7.432.208 - 403.501 = 7.028.707 COP.
  assert.equal(
    summary.totalIncomeCop,
    7028707,
    "calculateFinancialSummary debe excluir los 403.501 COP de saldos iniciales del ingreso total (7.432.208 - 403.501 = 7.028.707 COP)."
  );
});

// ==============================================================================
// PRUEBAS HITO 3.9.2: FINANCIAL CORE & CALENDARIO QUINCENAL
// ==============================================================================

test("Hito 3.9.2 — 6. Determinación determinista del ciclo quincenal (11 de noviembre de 2026)", () => {
  const cycle = determineBiweeklyCycle("2026-11-11");

  assert.equal(cycle.cycleType, "first_half");
  assert.equal(cycle.startDate, "2026-11-05");
  assert.equal(cycle.endDate, "2026-11-19");
  assert.equal(cycle.nextPaydayDate, "2026-11-20");
  assert.equal(cycle.daysRemainingInCycle, 8, "Del 11 al 19 de noviembre quedan exactamente 8 días en el ciclo.");
  assert.ok(cycle.label.includes("Noviembre 2026"));

  // Prueba de ciclo segundo período (día 20 al 4)
  const cycle2 = determineBiweeklyCycle("2026-11-22");
  assert.equal(cycle2.cycleType, "second_half");
  assert.equal(cycle2.startDate, "2026-11-20");
  assert.equal(cycle2.endDate, "2026-12-04");
  assert.equal(cycle2.nextPaydayDate, "2026-12-05");
});

test("Hito 3.9.2 — 7. Conciliación de liquidez real y protección de la Reserva Esencial de 250.000 COP", () => {
  const params: BiweeklyPlanningParams = {
    asOfDate: "2026-11-11",
    accounts: {
      nuAccountCop: 340000,
      nequiAccountCop: 70000,
      cashCop: 0,
    },
    protectedEssentialReserveCop: 250000,
    expectedNextIncome: {
      amountCop: 1000000,
      expectedDate: "2026-11-20",
      isConfirmed: false,
    },
    committedObligations: [],
  };

  const plan = calculateBiweeklyCashflowPlan(params);

  // 1. Total liquid cash in hand
  assert.equal(
    plan.reconciledLiquidCashCop,
    410000,
    "La liquidez total en mano debe ser exactamente 410.000 COP (Nu 340k + Nequi 70k)."
  );

  // 2. Reserva esencial intocable
  assert.equal(
    plan.protectedReserveCop,
    250000,
    "La reserva esencial debe estar protegida al 100% (250.000 COP)."
  );

  // 3. Margen máximo antes de deudas: MAX(0, 410.000 - 250.000) = 160.000 COP
  assert.equal(
    plan.maxMarginBeforeDebtsCop,
    160000,
    "El margen máximo disponible antes de compromisos de deuda debe ser exactamente 160.000 COP."
  );

  // 4. Si no hay deudas comprometidas en el ciclo, Dinero Libre = 160.000 COP
  assert.equal(plan.freeMoneyCop, 160000);
});

test("Hito 3.9.2 — 8. Prohibición estricta de computar ingresos esperados como dinero disponible hoy", () => {
  const params: BiweeklyPlanningParams = {
    asOfDate: "2026-11-11",
    accounts: {
      nuAccountCop: 340000,
      nequiAccountCop: 70000,
    },
    protectedEssentialReserveCop: 250000,
    expectedNextIncome: {
      amountCop: 1000000,
      expectedDate: "2026-11-20",
      isConfirmed: false,
    },
    committedObligations: [],
  };

  const plan = calculateBiweeklyCashflowPlan(params);

  // REGLA FUNDAMENTAL: isAvailableNow debe ser estrictamente false
  assert.equal(
    plan.expectedNextIncome.isAvailableNow,
    false,
    "Los ingresos esperados del 20 de noviembre NUNCA deben marcarse como disponibles en mano hoy."
  );

  // El saldo conciliado hoy NO debe sumar los 1.000.000 COP
  assert.equal(plan.reconciledLiquidCashCop, 410000);
  assert.notEqual(plan.reconciledLiquidCashCop, 1410000);
});

test("Hito 3.9.2 — 9. Cobertura del pago de Nequi el 15 de noviembre preservando la reserva", () => {
  const nequiObligation: CommittedObligationItem = {
    id: "nequi_loan_install_21",
    name: "Crédito Nequi (Cuota 21 de 24)",
    amountCop: 56431,
    dueDate: "2026-11-15",
    isMandatory: true,
    priority: "critical",
    status: "pending",
  };

  const params: BiweeklyPlanningParams = {
    asOfDate: "2026-11-11",
    accounts: {
      nuAccountCop: 340000,
      nequiAccountCop: 70000,
    },
    protectedEssentialReserveCop: 250000,
    expectedNextIncome: {
      amountCop: 1000000,
      expectedDate: "2026-11-20",
      isConfirmed: false,
    },
    committedObligations: [nequiObligation],
  };

  const plan = calculateBiweeklyCashflowPlan(params);

  // 1. Obligaciones del ciclo = 56.431 COP
  assert.equal(plan.totalCommittedObligationsCop, 56431);

  // 2. Dinero Libre = 160.000 - 56.431 = 103.569 COP
  assert.equal(
    plan.freeMoneyCop,
    103569,
    "El dinero libre tras pagar la cuota de Nequi debe ser exactamente 103.569 COP."
  );

  // 3. La reserva de 250.000 COP permanece 100% blindada
  assert.equal(plan.protectedReserveCop, 250000);
  assert.equal(
    plan.reconciledLiquidCashCop - plan.totalCommittedObligationsCop,
    353569,
    "Tras pagar Nequi, la liquidez remanente es 353.569 COP, cubriendo con creces la reserva de 250.000 COP."
  );
});

test("Hito 3.9.2 — 10. Detección de déficit para ADDI si se pretende pagar cuota antes de quincena", () => {
  // Caso: Usuario intenta programar la cuota recomendada de ADDI ($336.085 COP) para el 17 de noviembre
  const addiObligation: CommittedObligationItem = {
    id: "addi_recommended_payment",
    name: "ADDI Cuota Atraso + Vencimiento",
    amountCop: 336085,
    dueDate: "2026-11-17",
    isMandatory: true,
    priority: "high",
    status: "overdue",
  };

  const nequiObligation: CommittedObligationItem = {
    id: "nequi_loan_install_21",
    name: "Crédito Nequi (Cuota 21)",
    amountCop: 56431,
    dueDate: "2026-11-15",
    isMandatory: true,
    priority: "critical",
    status: "pending",
  };

  const params: BiweeklyPlanningParams = {
    asOfDate: "2026-11-11",
    accounts: {
      nuAccountCop: 340000,
      nequiAccountCop: 70000,
    },
    protectedEssentialReserveCop: 250000,
    expectedNextIncome: {
      amountCop: 1000000,
      expectedDate: "2026-11-20",
      isConfirmed: false,
    },
    committedObligations: [nequiObligation, addiObligation],
  };

  const plan = calculateBiweeklyCashflowPlan(params);

  // 1. Total compromisos = 56.431 + 336.085 = 392.516 COP
  assert.equal(plan.totalCommittedObligationsCop, 392516);

  // 2. Margen antes de deudas = 160.000 COP
  // Déficit = 392.516 - 160.000 = 232.516 COP de déficit
  assert.equal(plan.freeMoneyCop, 0, "Dinero libre debe ser 0 al haber déficit.");

  // 3. El sistema debe emitir la advertencia de liquidez expresa
  assert.ok(
    plan.dataSufficiency.advisories.some((adv) => adv.includes("ALERTA DE LIQUIDEZ")),
    "Debe emitir alerta de liquidez cuando las obligaciones superan el margen antes de quincena."
  );
  assert.ok(
    plan.dataSufficiency.advisories.some((adv) => adv.includes("250.000")),
    "La alerta debe recordar expresamente la prohibición de tocar la reserva esencial de 250.000 COP."
  );
});

test("Hito 3.9.2 — 11. Generación de los 3 escenarios de proyección (Conservador, Base, Favorable)", () => {
  const nequiObligation: CommittedObligationItem = {
    id: "nequi_loan_install_21",
    name: "Crédito Nequi",
    amountCop: 56431,
    dueDate: "2026-11-15",
    isMandatory: true,
    priority: "critical",
    status: "pending",
  };

  const params: BiweeklyPlanningParams = {
    asOfDate: "2026-11-11",
    accounts: {
      nuAccountCop: 340000,
      nequiAccountCop: 70000,
    },
    protectedEssentialReserveCop: 250000,
    expectedNextIncome: {
      amountCop: 1000000,
      expectedDate: "2026-11-20",
      isConfirmed: false,
    },
    committedObligations: [nequiObligation],
  };

  const plan = calculateBiweeklyCashflowPlan(params);
  const { conservative, base, favorable } = plan.scenarios;

  // Escenario Conservador
  assert.equal(conservative.scenarioName, "conservative");
  assert.equal(conservative.essentialReserveProtectedCop, 250000);
  assert.equal(conservative.obligationsPayableCop, 56431);
  assert.equal(conservative.freeMoneyRemainingCop, 103569);

  // Escenario Base
  assert.equal(base.scenarioName, "base");
  assert.equal(base.obligationsPayableCop, 56431);
  assert.equal(base.liquidityDeficitRisk, false);

  // Escenario Favorable
  assert.equal(favorable.scenarioName, "favorable");
  assert.ok(favorable.notes.some((n) => n.includes("quincena del 20 de noviembre")));
});

test("Hito 3.9.2 — 12. Regla de Doble Candado para compras de Wishlist y ocio", () => {
  const nequiObligation: CommittedObligationItem = {
    id: "nequi_loan_install_21",
    name: "Crédito Nequi",
    amountCop: 56431,
    dueDate: "2026-11-15",
    isMandatory: true,
    priority: "critical",
    status: "pending",
  };

  const params: BiweeklyPlanningParams = {
    asOfDate: "2026-11-11",
    accounts: {
      nuAccountCop: 340000,
      nequiAccountCop: 70000,
    },
    protectedEssentialReserveCop: 250000,
    expectedNextIncome: {
      amountCop: 1000000,
      expectedDate: "2026-11-20",
      isConfirmed: false,
    },
    committedObligations: [nequiObligation], // Dinero libre disponible = 103.569 COP
  };

  const plan = calculateBiweeklyCashflowPlan(params);

  // 1. Compra de artículo menor al Dinero Libre (ej. libro de 45.000 COP) -> APROBADO
  const checkBook = validateWishlistPurchaseBudget(45000, plan);
  assert.equal(checkBook.isAllowed, true);
  assert.ok(checkBook.reason.includes("Aprobado"));

  // 2. Compra de artículo mayor al Dinero Libre (ej. cubo de 120.000 COP cuando solo hay 103.569) -> BLOQUEADO
  const checkCube = validateWishlistPurchaseBudget(120000, plan);
  assert.equal(checkCube.isAllowed, false);
  assert.ok(checkCube.reason.includes("Presupuesto insuficiente"));

  // 3. Si no hay Dinero Libre (0 COP), cualquier compra debe ser bloqueada por prudencia
  const planZeroFree: typeof plan = { ...plan, freeMoneyCop: 0 };
  const checkZero = validateWishlistPurchaseBudget(15000, planZeroFree);
  assert.equal(checkZero.isAllowed, false);
  assert.ok(checkZero.reason.includes("Bloqueo por Prudencia Financiera"));
});

