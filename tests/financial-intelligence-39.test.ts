import { test } from "node:test";
import assert from "node:assert/strict";
import { INITIAL_FINANCIAL_MOVEMENTS } from "../src/lib/initial-financial-movements.ts";
import {
  auditAndClassifyMovements,
  type ReclassifiedFinancialDataset,
} from "../src/lib/sanctuary/financial-auditor.ts";
import { calculateFinancialSummary } from "../src/lib/sanctuary/bank-engine.ts";

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
