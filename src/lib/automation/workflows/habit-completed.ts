import { computeSha256Hex } from "../../crypto-hash.ts";
import { defaultAuditLogger, SystemAuditLogger } from "../rule-engine.ts";
import type { AutomationEventBus } from "../event-bus.ts";
import type { SystemEvent } from "../types.ts";

export interface HabitCompletedPayload {
  habitId: string;
  habitName: string;
  userId: string;
  date: string; // YYYY-MM-DD
  baseGp?: number;
  baseXp?: number;
  currentStreak: number;
  walletGp: number;
  vaultRemainingGp: number;
  totalXp: number;
  aegisShields?: number;
  activeBossHp?: number;
}

export interface HabitCompletedResult {
  success: boolean;
  isDuplicate: boolean;
  idempotencyKey: string;
  habitId: string;
  habitName: string;
  userId: string;
  date: string;
  newStreakDays: number;
  streakMultiplier: number;
  xpAwarded: number;
  gpAwarded: number;
  aegisShieldAwarded: boolean;
  newWalletGp: number;
  newVaultGp: number;
  newTotalXp: number;
  newAegisShields: number;
  bossDamageDealt: number;
  newBossHp?: number;
  auditLogId: string;
  timestamp: string;
}

/**
 * Genera la clave canónica de idempotencia para un hábito completado en una fecha dada.
 */
export function buildHabitIdempotencyKey(
  userId: string,
  habitId: string,
  date: string
): string {
  const raw = `habit_completed:${userId}:${habitId}:${date}`;
  return computeSha256Hex(raw);
}

/**
 * Calcula el multiplicador de racha determinista.
 */
export function calculateStreakMultiplier(streakDays: number): number {
  if (streakDays >= 30) return 1.5;
  if (streakDays >= 14) return 1.25;
  if (streakDays >= 7) return 1.1;
  return 1.0;
}

/**
 * Cache en memoria de ejecuciones de hábitos para control de idempotencia y prevención de duplicados.
 */
const executedHabitsCache = new Map<string, HabitCompletedResult>();

export function clearHabitWorkflowIdempotencyCache(): void {
  executedHabitsCache.clear();
}

/**
 * Ejecuta el workflow canónico HABIT_COMPLETED garantizando:
 * 1. Validación de entradas.
 * 2. Idempotencia estricta por (usuario, hábito, fecha).
 * 3. Cálculo determinista de recompensas (XP, GP, Escudo Aegis cada 7 días).
 * 4. Principio de conservación monetaria (el GP sale de la Bóveda hacia la Billetera).
 * 5. Registro inmutable de auditoría.
 */
export function executeHabitCompletedWorkflow(
  payload: HabitCompletedPayload,
  auditLogger: SystemAuditLogger = defaultAuditLogger
): HabitCompletedResult {
  // 1. Validación
  if (!payload.userId || !payload.habitId || !payload.date) {
    throw new Error(
      "Payload inválido para HABIT_COMPLETED: userId, habitId y date son obligatorios."
    );
  }

  const idempotencyKey = buildHabitIdempotencyKey(
    payload.userId,
    payload.habitId,
    payload.date
  );

  // 2. Control de idempotencia: Si ya fue procesado para esta fecha, retornar el resultado previo
  const cached = executedHabitsCache.get(idempotencyKey);
  if (cached) {
    return {
      ...cached,
      isDuplicate: true,
    };
  }

  // 3. Cálculo determinista
  const baseGp = Math.max(0, payload.baseGp ?? 100);
  const baseXp = Math.max(0, payload.baseXp ?? 50);
  const currentStreak = Math.max(0, payload.currentStreak ?? 0);
  const newStreakDays = currentStreak + 1;

  const streakMultiplier = calculateStreakMultiplier(newStreakDays);
  const xpAwarded = Math.round(baseXp * streakMultiplier);

  // Regla financiera: GP nunca se crea de la nada; se libera de la Bóveda a la Billetera
  const potentialGp = Math.round(baseGp * streakMultiplier);
  const currentVault = Math.max(0, payload.vaultRemainingGp ?? 0);
  const gpAwarded = Math.min(potentialGp, currentVault);

  const currentWallet = Math.max(0, payload.walletGp ?? 0);
  const newWalletGp = currentWallet + gpAwarded;
  const newVaultGp = currentVault - gpAwarded;
  const newTotalXp = Math.max(0, payload.totalXp ?? 0) + xpAwarded;

  // Hito de racha: cada 7 días otorga +1 Aegis Shield
  const aegisShieldAwarded = newStreakDays > 0 && newStreakDays % 7 === 0;
  const currentShields = Math.max(0, payload.aegisShields ?? 0);
  const newAegisShields = currentShields + (aegisShieldAwarded ? 1 : 0);

  // Daño al Boss activo
  const bossDamageDealt = Math.round(gpAwarded * 0.5 + xpAwarded * 0.25);
  const currentBossHp = payload.activeBossHp;
  const newBossHp =
    currentBossHp !== undefined
      ? Math.max(0, currentBossHp - bossDamageDealt)
      : undefined;

  const timestamp = new Date().toISOString();

  // 4. Registro de Auditoría Criptográfica
  const auditLog = auditLogger.logAction({
    userId: payload.userId,
    actorType: "rule_engine",
    actorId: "workflow:habit_completed",
    actionName: "HABIT_COMPLETED_REWARDS_AWARDED",
    resourceAffected: `habit:${payload.habitId}`,
    newState: {
      habitName: payload.habitName,
      date: payload.date,
      newStreakDays,
      streakMultiplier,
      xpAwarded,
      gpAwarded,
      aegisShieldAwarded,
      newWalletGp,
      newVaultGp,
      idempotencyKey,
    },
  });

  const result: HabitCompletedResult = {
    success: true,
    isDuplicate: false,
    idempotencyKey,
    habitId: payload.habitId,
    habitName: payload.habitName,
    userId: payload.userId,
    date: payload.date,
    newStreakDays,
    streakMultiplier,
    xpAwarded,
    gpAwarded,
    aegisShieldAwarded,
    newWalletGp,
    newVaultGp,
    newTotalXp,
    newAegisShields,
    bossDamageDealt,
    newBossHp,
    auditLogId: auditLog.id,
    timestamp,
  };

  // Guardar en índice de idempotencia
  executedHabitsCache.set(idempotencyKey, result);

  return result;
}

/**
 * Suscribe el workflow canónico de HABIT_COMPLETED al Event Bus central.
 */
export function registerHabitCompletedWorkflow(
  eventBus: AutomationEventBus,
  auditLogger: SystemAuditLogger = defaultAuditLogger
): () => void {
  return eventBus.on<HabitCompletedPayload>(
    "HABIT_COMPLETED",
    async (event: SystemEvent<HabitCompletedPayload>) => {
      executeHabitCompletedWorkflow(event.payload, auditLogger);
    }
  );
}
