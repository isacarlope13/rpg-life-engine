import test from "node:test";
import assert from "node:assert/strict";
import {
  HumanApprovalGateway,
  SystemAuditLogger,
} from "../src/lib/automation/index.ts";
import {
  SystemGuardian,
  SmartExpenseEngine,
  SkillEvolutionAgent,
  DailyPlannerAgent,
  DynamicQuestGenerator,
} from "../src/lib/agents/index.ts";
import type {
  FinancialMovementRecord,
  ReadingBook,
  RubikSolveEntry,
  UserSkillConfig,
} from "../src/types/rpg.ts";

test("Specialized Agents 1: SmartExpenseEngine detección de fugas hormiga y propuesta HITL", async () => {
  const approvalGateway = new HumanApprovalGateway();
  const auditLogger = new SystemAuditLogger();
  const guardian = new SystemGuardian(approvalGateway, auditLogger);
  const expenseEngine = new SmartExpenseEngine(guardian);

  const mockTransactions: FinancialMovementRecord[] = [
    { id: "1", fecha: "2026-11-01", tipo: "Gasto", categoria: "Alimentación", monto: 12000, descripcion: "Café y pan", metodo_pago: "Efectivo" },
    { id: "2", fecha: "2026-11-02", tipo: "Gasto", categoria: "Alimentación", monto: 9500, descripcion: "Snack tarde", metodo_pago: "Efectivo" },
    { id: "3", fecha: "2026-11-03", tipo: "Gasto", categoria: "Alimentación", monto: 14000, descripcion: "Postre", metodo_pago: "Efectivo" },
    { id: "4", fecha: "2026-11-04", tipo: "Gasto", categoria: "Alimentación", monto: 8000, descripcion: "Bebida", metodo_pago: "Efectivo" },
    { id: "5", fecha: "2026-11-05", tipo: "Gasto", categoria: "Ocio", monto: 11000, descripcion: "Café especial", metodo_pago: "Efectivo" },
    { id: "6", fecha: "2026-11-05", tipo: "Gasto", categoria: "Hogar", monto: 120000, descripcion: "Servicios públicos", metodo_pago: "Transferencia" },
  ];

  // 1. Auditoría de gastos
  const audit = expenseEngine.auditTransactions(mockTransactions);
  assert.equal(audit.totalSpentCop, 174500);
  assert.equal(audit.fixedCostsSpentCop, 120000);
  assert.equal(audit.variableOpsSpentCop, 54500);
  assert.equal(audit.microExpensesCount, 5);
  assert.equal(audit.microExpensesTotalCop, 54500);
  assert.ok(audit.anomalyAlerts.length > 0);
  assert.ok(audit.anomalyAlerts[0].includes("Fuga hormiga"));

  // 2. Propuesta de rebalanceo presupuestal ($25.000 COP >= $20.000 COP)
  let executedLocally = false;
  const outcome = await expenseEngine.proposeRebalance({
    userId: "usr_exp_1",
    amountCop: audit.rebalanceRecommendation!.suggestedAmountCop,
    fromBucket: audit.rebalanceRecommendation!.fromBucket,
    toBucket: audit.rebalanceRecommendation!.toBucket,
    rationale: audit.rebalanceRecommendation!.rationale,
    mutationExecutor: async () => {
      executedLocally = true;
      return { rebalanced: true };
    },
  });

  // Debido al umbral financiero >= $20.000 COP, requiere aprobación humana
  assert.equal(outcome.executed, false);
  assert.equal(outcome.requiresApproval, true);
  assert.equal(executedLocally, false);
  assert.ok(outcome.approvalRequest);
  assert.equal(approvalGateway.getPendingRequests("usr_exp_1").length, 1);
});

test("Specialized Agents 2: SkillEvolutionAgent métricas WCA Ao5/Ao12 y detección de estancamiento", () => {
  const evolutionAgent = new SkillEvolutionAgent();

  const mockSolves: RubikSolveEntry[] = [
    { id: "s1", cube_type: "3x3", time_seconds: 14.2, scramble: "R U R'", penalty: "NONE", is_pb: false, ao5_after: null, ao12_after: null, timestamp: "2026-11-01" },
    { id: "s2", cube_type: "3x3", time_seconds: 12.8, scramble: "U R U'", penalty: "NONE", is_pb: true, ao5_after: null, ao12_after: null, timestamp: "2026-11-02" },
    { id: "s3", cube_type: "3x3", time_seconds: 15.5, scramble: "F R U", penalty: "NONE", is_pb: false, ao5_after: null, ao12_after: null, timestamp: "2026-11-03" },
    { id: "s4", cube_type: "3x3", time_seconds: 13.9, scramble: "R2 U", penalty: "NONE", is_pb: false, ao5_after: null, ao12_after: null, timestamp: "2026-11-04" },
    { id: "s5", cube_type: "3x3", time_seconds: 13.1, scramble: "L U L'", penalty: "NONE", is_pb: false, ao5_after: 13.73, ao12_after: null, timestamp: "2026-11-05" },
  ];

  const rubikMastery = evolutionAgent.computeRubikMastery(mockSolves);
  assert.equal(rubikMastery.totalSolves, 5);
  assert.equal(rubikMastery.personalBestSeconds, 12.8);
  // Ao5 trimmed: elimina 12.8 (min) y 15.5 (max), promedia [13.1, 13.9, 14.2] = 41.2 / 3 = 13.73
  assert.equal(rubikMastery.currentAo5, 13.73);
  assert.equal(rubikMastery.speedcubingMilestone, "Sub-15");

  const mockSkills: UserSkillConfig[] = [
    { domain: "rubik", label: "Cubo de Rubik", weekly_target_minutes: 120, preferred_session_time: "noche" },
    { domain: "gardening", label: "Jardinería Botánica", weekly_target_minutes: 60, preferred_session_time: "manana" },
    { domain: "reading", label: "Lectura Profunda", weekly_target_minutes: 140, preferred_session_time: "noche" },
  ];

  // Simulación: Jardinería lleva 6 días inactiva
  const audit = evolutionAgent.analyzeMastery({
    userSkills: mockSkills,
    rubikSolves: mockSolves,
    recentActivityDaysByDomain: {
      rubik: 0,
      reading: 1,
      gardening: 6,
    } as any,
  });

  assert.equal(audit.stagnantDomains.length, 1);
  assert.equal(audit.stagnantDomains[0].domain, "gardening");
  assert.equal(audit.stagnantDomains[0].daysInactive, 6);
  assert.ok(audit.overallMasteryIndex > 0);
});

test("Specialized Agents 3: DailyPlannerAgent rebalanceo en ventana nocturna respetando descanso", async () => {
  const approvalGateway = new HumanApprovalGateway();
  const auditLogger = new SystemAuditLogger();
  const guardian = new SystemGuardian(approvalGateway, auditLogger);
  const planner = new DailyPlannerAgent(guardian);

  const proposal = planner.proposeRebalanceIntoEveningWindow({
    dayKey: "lun",
    currentBlocks: [
      { domain: "work", label: "Trabajo Principal", minutes: 480, timeRange: "08:00 - 17:30", period: "tarde" },
    ],
    delayedBlock: {
      domain: "reading",
      label: "Lectura Profunda",
      minutes: 40,
      timeRange: "06:45 - 07:25",
      period: "manana",
    },
    workEndHour: "17:30",
    sleepTime: "22:30",
  });

  assert.equal(proposal.recoveredMinutes, 40);
  assert.ok(proposal.rebalancedBlocks.some((b) => b.label === "Lectura Profunda" && b.period === "noche"));

  // Ejecución canalizada por el Guardian
  let applied = false;
  const outcome = await planner.executeScheduleShift({
    userId: "usr_plan_1",
    dayKey: "lun",
    proposal,
    mutationExecutor: async () => {
      applied = true;
      return { shifted: true };
    },
  });

  assert.equal(outcome.executed, true);
  assert.equal(outcome.requiresApproval, false);
  assert.equal(applied, true);
});

test("Specialized Agents 4: DynamicQuestGenerator forja de misiones y calibración RewardOptimizer", async () => {
  const approvalGateway = new HumanApprovalGateway();
  const auditLogger = new SystemAuditLogger();
  const guardian = new SystemGuardian(approvalGateway, auditLogger);
  const questGenerator = new DynamicQuestGenerator(guardian);

  const quest = questGenerator.generateAdaptiveQuest({
    domain: "gardening",
    domainLabel: "Jardinería Botánica",
    daysInactive: 6,
    playerLevel: 4,
  });

  assert.ok(quest.code.startsWith("DYN_GARDENING_"));
  assert.equal(quest.domain, "gardening");
  assert.ok(quest.rewardGp <= 4000, "RewardOptimizer debe acotar la recompensa a <= 4000 GP");
  assert.equal(quest.dailyLimit, 1);

  // Proponer despliegue seguro a través del Guardian
  let deployed = false;
  const outcome = await questGenerator.proposeQuestDeployment({
    userId: "usr_quest_1",
    quest,
    mutationExecutor: async () => {
      deployed = true;
      return { questId: quest.code };
    },
  });

  assert.equal(outcome.executed, true);
  assert.equal(outcome.requiresApproval, false);
  assert.equal(deployed, true);
});
