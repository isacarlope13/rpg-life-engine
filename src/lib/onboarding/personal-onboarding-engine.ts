import type { CurrencyCode, DebtStrategy, SkillDomain } from "@/types/rpg";
import { safeLocalStorage } from "../storage-safe.ts";

export interface LifeAreaDefinition {
  id: string;
  label: string;
  specialist: string;
  buildingId: string;
  /** Dominio válido en SkillDomain (null si usa módulo dedicado como Cine) */
  skillDomain: SkillDomain | null;
  moduleKey?: "cinema";
  suggestedWeeklyMinutes: number;
  icon: string;
  description: string;
}

/**
 * HITO 6: Las 8 áreas de vida reales de OakHaven, compatibles con SkillDomain
 * y con los módulos existentes (Cine usa su módulo dedicado sin romper enums).
 */
export const EIGHT_LIFE_AREAS: readonly LifeAreaDefinition[] = [
  {
    id: "work",
    label: "Trabajo",
    specialist: "Aura",
    buildingId: "oficina",
    skillDomain: "work",
    suggestedWeeklyMinutes: 240,
    icon: "💼",
    description: "Proyectos de ingeniería administrativa, analítica, automatización y entregables.",
  },
  {
    id: "study",
    label: "Estudio",
    specialist: "Lyra",
    buildingId: "biblioteca",
    skillDomain: "study",
    suggestedWeeklyMinutes: 180,
    icon: "📚",
    description: "Bloques de estudio profundo, repaso activo y documentos técnicos.",
  },
  {
    id: "gym",
    label: "Gym",
    specialist: "Bruno",
    buildingId: "gimnasio",
    skillDomain: "sports",
    suggestedWeeklyMinutes: 150,
    icon: "🏋️",
    description: "Entrenamiento de fuerza, constancia y recuperación sin culpa.",
  },
  {
    id: "reading",
    label: "Lectura",
    specialist: "Eldrin",
    buildingId: "libreria",
    skillDomain: "reading",
    suggestedWeeklyMinutes: 120,
    icon: "📖",
    description: "Libros en curso, citas personales y reflexiones breves.",
  },
  {
    id: "crochet",
    label: "Crochet",
    specialist: "Clara",
    buildingId: "atelier",
    skillDomain: "knitting",
    suggestedWeeklyMinutes: 90,
    icon: "🧶",
    description: "Proyectos textiles, vueltas, patrones y calma creativa.",
  },
  {
    id: "rubik",
    label: "Cubos de Rubik",
    specialist: "Milo",
    buildingId: "club_puzzles",
    skillDomain: "rubik",
    suggestedWeeklyMinutes: 90,
    icon: "🧊",
    description: "Práctica WCA, Ao5/Ao12 y algoritmos en pausas cortas.",
  },
  {
    id: "cinema",
    label: "Cine y series",
    specialist: "Nora",
    buildingId: "cine",
    skillDomain: null,
    moduleKey: "cinema",
    suggestedWeeklyMinutes: 120,
    icon: "🎬",
    description: "Películas, series, musicales, watchlist y reseñas culturales.",
  },
  {
    id: "journaling",
    label: "Journaling",
    specialist: "Rowan",
    buildingId: "observatorio",
    skillDomain: "journaling",
    suggestedWeeklyMinutes: 60,
    icon: "✍️",
    description: "Bitácora personal, claridad mental y cierre sereno del día.",
  },
] as const;

export interface IncomeSourceInput {
  id: string;
  label: string;
  amountCop: number;
  payDay: number;
  isVariable: boolean;
  /** Los saldos iniciales o reembolsos NUNCA se contabilizan como ingreso recurrente */
  kind: "recurring_income" | "initial_balance" | "refund";
}

export interface WalletAccountInput {
  id: string;
  name: string;
  initialBalanceCop: number;
}

export interface FixedCostDraft {
  id: string;
  name: string;
  amountCop: number;
  category: string;
  dueDay?: number;
}

export interface DebtDraft {
  id: string;
  name: string;
  totalBalanceCop: number;
  minMonthlyPaymentCop: number;
  interestRateEa: number;
  dueDay?: number;
}

export interface WishlistDraft {
  id: string;
  name: string;
  costGp: number;
  estimatedCop?: number;
  priority: number;
}

export interface PersonalOnboardingDraft {
  version: 2;
  updatedAt: string;
  step: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  // Paso 1: Identidad
  displayName: string;
  characterClass: string;
  profession: string;
  currency: CurrencyCode;
  timezone: string;
  // Paso 2: Rutina y disponibilidad
  wakeTime: string;
  sleepTime: string;
  workStart: string;
  workEnd: string;
  flexibleWindowsNote: string;
  // Paso 3: 8 áreas seleccionadas + minutos semanales editables
  enabledAreaIds: string[];
  areaWeeklyMinutes: Record<string, number>;
  // Paso 4: Finanzas reales privadas (100% vacías por defecto; 0 datos del piloto)
  incomeSources: IncomeSourceInput[];
  accounts: WalletAccountInput[];
  fixedCosts: FixedCostDraft[];
  variableBudgetCop: number;
  debts: DebtDraft[];
  debtStrategy: DebtStrategy;
  monthlySavingsGoalCop: number;
  emergencyFundTargetCop: number;
  vaultCapGp: number;
  financialGoalsNote: string;
  // Paso 5: Objetivos y misiones
  mainGoal: string;
  goalDeadline: string;
  wishlist: WishlistDraft[];
  // Paso 6: Privacidad y consentimiento (NUNCA pre-marcado)
  aiPrivacyStrict: boolean;
  dataPrivacyAccepted: boolean;
  financialDataConfirmed: boolean;
}

/**
 * Crea un borrador de onboarding COMPLETAMENTE VACÍO de datos financieros personales (HITO 2).
 * Ninguna cifra del usuario piloto existe aquí.
 */
export function createEmptyOnboardingDraft(): PersonalOnboardingDraft {
  const defaultMinutes: Record<string, number> = {};
  for (const area of EIGHT_LIFE_AREAS) {
    defaultMinutes[area.id] = area.suggestedWeeklyMinutes;
  }

  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    step: 1,
    displayName: "",
    characterClass: "Arquitecta de Sistemas y Equilibrio",
    profession: "",
    currency: "COP",
    timezone: "America/Bogota",
    wakeTime: "07:00",
    sleepTime: "23:00",
    workStart: "08:00",
    workEnd: "17:00",
    flexibleWindowsNote: "",
    enabledAreaIds: EIGHT_LIFE_AREAS.map((a) => a.id),
    areaWeeklyMinutes: defaultMinutes,
    incomeSources: [],
    accounts: [],
    fixedCosts: [],
    variableBudgetCop: 0,
    debts: [],
    debtStrategy: "snowball",
    monthlySavingsGoalCop: 0,
    emergencyFundTargetCop: 0,
    vaultCapGp: 0,
    financialGoalsNote: "",
    mainGoal: "",
    goalDeadline: "",
    wishlist: [],
    aiPrivacyStrict: true,
    dataPrivacyAccepted: false,
    financialDataConfirmed: false,
  };
}

export interface RealFinanceSummary {
  totalRecurringIncomeCop: number;
  excludedNonRecurringCop: number;
  initialAccountsBalanceCop: number;
  totalFixedCostsCop: number;
  totalVariableBudgetCop: number;
  totalDebtMinPaymentsCop: number;
  committedCop: number;
  availableRealMoneyCop: number;
  savingsCapacityCop: number;
  allowedGpRewardsCap: number;
  preventiveAlerts: string[];
}

/**
 * HITO 7: Cálculo determinista de finanzas reales en COP, separado de GP/XP.
 * - Excluye saldos iniciales y reembolsos del ingreso recurrente mensual.
 * - Protege necesidades esenciales (costos fijos + cuotas mínimas).
 */
export function computeRealFinanceSummary(draft: PersonalOnboardingDraft): RealFinanceSummary {
  let totalRecurringIncomeCop = 0;
  let excludedNonRecurringCop = 0;

  for (const src of draft.incomeSources) {
    const amt = Math.max(0, Math.round(Number(src.amountCop) || 0));
    if (src.kind === "recurring_income") {
      totalRecurringIncomeCop += amt;
    } else {
      excludedNonRecurringCop += amt;
    }
  }

  const initialAccountsBalanceCop = draft.accounts.reduce(
    (sum, acc) => sum + Math.max(0, Math.round(Number(acc.initialBalanceCop) || 0)),
    0
  );
  const totalFixedCostsCop = draft.fixedCosts.reduce(
    (sum, fc) => sum + Math.max(0, Math.round(Number(fc.amountCop) || 0)),
    0
  );
  const totalVariableBudgetCop = Math.max(0, Math.round(Number(draft.variableBudgetCop) || 0));
  const totalDebtMinPaymentsCop = draft.debts.reduce(
    (sum, d) => sum + Math.max(0, Math.round(Number(d.minMonthlyPaymentCop) || 0)),
    0
  );

  const committedCop = totalFixedCostsCop + totalVariableBudgetCop + totalDebtMinPaymentsCop;
  const availableRealMoneyCop = totalRecurringIncomeCop - committedCop;
  const savingsCapacityCop = Math.max(0, availableRealMoneyCop);
  const allowedGpRewardsCap = Math.max(
    0,
    Math.min(Math.round(Number(draft.vaultCapGp) || 0), savingsCapacityCop)
  );

  const preventiveAlerts: string[] = [];
  if (totalRecurringIncomeCop === 0) {
    preventiveAlerts.push("Aún no has registrado ingresos recurrentes en COP; puedes completarlos ahora o más tarde.");
  } else if (availableRealMoneyCop < 0) {
    preventiveAlerts.push(
      `Tus compromisos mensuales superan tus ingresos recurrentes por $${Math.abs(availableRealMoneyCop).toLocaleString("es-CO")} COP. Protege primero necesidades esenciales.`
    );
  } else if (draft.monthlySavingsGoalCop > savingsCapacityCop) {
    preventiveAlerts.push(
      `Tu meta de ahorro mensual ($${draft.monthlySavingsGoalCop.toLocaleString("es-CO")} COP) supera tu capacidad actual ($${savingsCapacityCop.toLocaleString("es-CO")} COP).`
    );
  }
  if (excludedNonRecurringCop > 0) {
    preventiveAlerts.push(
      `Saldos iniciales o reembolsos ($${excludedNonRecurringCop.toLocaleString("es-CO")} COP) excluidos correctamente del ingreso recurrente.`
    );
  }

  return {
    totalRecurringIncomeCop,
    excludedNonRecurringCop,
    initialAccountsBalanceCop,
    totalFixedCostsCop,
    totalVariableBudgetCop,
    totalDebtMinPaymentsCop,
    committedCop,
    availableRealMoneyCop,
    savingsCapacityCop,
    allowedGpRewardsCap,
    preventiveAlerts,
  };
}

export interface CharacterSheet {
  identity: {
    adventurerName: string;
    characterClass: string;
    profession: string;
    currency: CurrencyCode;
    timezone: string;
    style: string;
  };
  level: number;
  activeGoals: string[];
  areas: Array<{
    id: string;
    label: string;
    specialist: string;
    weeklyMinutes: number;
    skillDomain: SkillDomain | null;
    moduleKey?: "cinema";
  }>;
  routine: {
    wakeTime: string;
    sleepTime: string;
    workStart: string;
    workEnd: string;
    timezone: string;
  };
  privacyConfig: {
    aiFinancialIsolation: true;
    strictPrivacyMode: boolean;
    explicitConsentGiven: boolean;
  };
}

export function buildCharacterSheet(
  draft: PersonalOnboardingDraft,
  existingLevel?: number
): CharacterSheet {
  const safeLevel = existingLevel && existingLevel > 1 ? existingLevel : 1;
  const activeAreas = EIGHT_LIFE_AREAS.filter((a) => draft.enabledAreaIds.includes(a.id)).map(
    (a) => ({
      id: a.id,
      label: a.label,
      specialist: a.specialist,
      weeklyMinutes: Math.max(15, Math.round(draft.areaWeeklyMinutes[a.id] ?? a.suggestedWeeklyMinutes)),
      skillDomain: a.skillDomain,
      moduleKey: a.moduleKey,
    })
  );

  return {
    identity: {
      adventurerName: draft.displayName.trim() || "Sin definir",
      characterClass: draft.characterClass.trim() || "Arquitecta de Sistemas y Equilibrio",
      profession: draft.profession.trim() || "Por definir",
      currency: draft.currency,
      timezone: draft.timezone || "America/Bogota",
      style: "Cozy estratégico · Equilibrio sin penalizaciones por descanso",
    },
    level: safeLevel,
    activeGoals: [draft.mainGoal.trim(), draft.financialGoalsNote.trim()].filter(Boolean),
    areas: activeAreas,
    routine: {
      wakeTime: draft.wakeTime,
      sleepTime: draft.sleepTime,
      workStart: draft.workStart,
      workEnd: draft.workEnd,
      timezone: draft.timezone || "America/Bogota",
    },
    privacyConfig: {
      aiFinancialIsolation: true,
      strictPrivacyMode: draft.aiPrivacyStrict,
      explicitConsentGiven: draft.dataPrivacyAccepted,
    },
  };
}

const DRAFT_PREFIX = "oakhaven_phase10_onboarding_draft_";

export function saveOnboardingDraft(userScope: string, draft: PersonalOnboardingDraft): void {
  try {
    safeLocalStorage.setItem(
      `${DRAFT_PREFIX}${userScope || "anon"}`,
      JSON.stringify({ ...draft, updatedAt: new Date().toISOString() })
    );
  } catch {
    // Silencioso en entornos sin storage
  }
}

export function loadOnboardingDraft(userScope: string): PersonalOnboardingDraft | null {
  try {
    const raw = safeLocalStorage.getItem(`${DRAFT_PREFIX}${userScope || "anon"}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersonalOnboardingDraft>;
    if (parsed && parsed.version === 2) {
      return { ...createEmptyOnboardingDraft(), ...parsed };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearOnboardingDraft(userScope: string): void {
  try {
    safeLocalStorage.removeItem(`${DRAFT_PREFIX}${userScope || "anon"}`);
  } catch {
    // Silencioso
  }
}
