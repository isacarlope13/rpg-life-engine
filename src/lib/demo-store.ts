import type {
  BookComplexity,
  BookFormat,
  BossTTKProjection,
  CurrencyCode,
  DailyScheduleConfig,
  DebtStrategy,
  DebtStrategyComparison,
  ExpenseCategory,
  ExtractedCubeSpecsAI,
  FixedCostItem,
  KnittingProject,
  OnboardingPayload,
  PayFrequency,
  ReadingBook,
  RubikCubeCatalogItem,
  RubikCubeType,
  RubikPenalty,
  RubikSolveEntry,
  SkillDomain,
  SkillDomainSummary,
  SkillSessionRecord,
  SpecComplianceCheckItem,
  TrialCheckpointSnapshot,
  UserSkillConfig,
  AgileMethodology,
  WorkProject,
  WorkProjectTask,
} from "../types/rpg";
import {
  buildBookReadingChecklist,
  buildCubeComplianceChecklist,
  extractBookSpecsDeterministic,
  extractCubeSpecsDeterministic,
} from "./gemini.ts";

export interface DemoBoss {
  id: string;
  name: string;
  max_hp: number;
  current_hp: number;
  interest_rate_ea: number;
  min_monthly_payment_cop: number;
  paid_this_month_cop: number;
  priority_order: number;
  status: "active" | "defeated" | "enraged";
  cutoff_day?: number;
  daily_interest_dot_gp?: number;
  monthly_interest_cop?: number;
  days_until_cutoff?: number;
  enrage_timer_active?: boolean;
  is_purified?: boolean;
  last_purification_date?: string;
}

export interface DemoQuest {
  code: string;
  title: string;
  domain: SkillDomain;
  difficulty: "easy" | "medium" | "hard";
  reward_gp: number;
  reward_xp: number;
}

export interface DemoWishlistItem {
  id: string;
  name: string;
  cost_gp: number;
  priority: number;
  is_redeemed: boolean;
  min_streak_required?: number;
  impulse_tax_pct?: number;
  effective_cost_gp?: number;
  locked_reason?: string | null;
}

export interface DemoLogEntry {
  id: string;
  type:
    | "activity"
    | "expense"
    | "counterattack"
    | "receipt_split"
    | "skill_session"
    | "limit_break";
  domain?: SkillDomain;
  title: string;
  subtitle: string;
  gp_delta: number;
  timestamp: string;
}

export function generateRubikScramble(movesCount = 20): string {
  const faces = ["U", "D", "L", "R", "F", "B"];
  const modifiers = ["", "'", "2"];
  const scramble: string[] = [];
  let lastFace = "";
  let secondLastFace = "";

  const oppositeFace: Record<string, string> = {
    U: "D",
    D: "U",
    L: "R",
    R: "L",
    F: "B",
    B: "F",
  };

  for (let i = 0; i < movesCount; i++) {
    const candidates = faces.filter((f) => {
      if (f === lastFace) return false;
      if (f === secondLastFace && oppositeFace[f] === lastFace) return false;
      return true;
    });
    const face = candidates[Math.floor(Math.random() * candidates.length)];
    const mod = modifiers[Math.floor(Math.random() * modifiers.length)];
    scramble.push(`${face}${mod}`);
    secondLastFace = lastFace;
    lastFace = face;
  }
  return scramble.join(" ");
}

export function calculateWcaTrimmedAverage(
  times: number[],
  windowSize: 5 | 12
): number | null {
  if (times.length < windowSize) return null;
  const slice = times.slice(0, windowSize);
  const sorted = [...slice].sort((a, b) => a - b);
  // Elimina el mejor (índice 0) y el peor (último índice, que puede ser 1 DNF = Infinity)
  const trimmed = sorted.slice(1, sorted.length - 1);
  // Según reglamento WCA 9f9: si hay 2 o más DNF en la ventana, el promedio es DNF (null)
  if (trimmed.some((val) => !Number.isFinite(val) || val <= 0)) {
    return null;
  }
  const sum = trimmed.reduce((acc, val) => acc + val, 0);
  return Number((sum / trimmed.length).toFixed(2));
}

export class RPGEngineMemoryStore {
  billing_period = "2026-11";
  currency: CurrencyCode = "COP";
  timezone = "America/Bogota";
  pay_frequency: PayFrequency = "monthly";
  pay_day = 1;
  savings_goal_monthly = 200000;
  profession = "Ingeniería de Sistemas / Desarrollo de Software";
  main_goal: string | null = "Eliminar deudas de corto plazo y dominar mis hábitos";
  goal_deadline: string | null = "2027-06-30";
  onboarding_completed = true;

  monthly_income_cop = 2300000;
  fixed_costs_budget_cop = 848000;
  fixed_costs_spent_cop = 848000; // Costos fijos del mes comprometidos
  variable_ops_budget_cop = 540000;
  variable_ops_spent_cop = 185000; // Ejecución operativa parcial inicial

  fixedCosts: FixedCostItem[] = [
    { id: "fc-1", name: "Arriendo / Vivienda", amount: 550000, category: "hogar" },
    { id: "fc-2", name: "Servicios Públicos", amount: 180000, category: "servicios" },
    { id: "fc-3", name: "Internet & Plan Móvil", amount: 118000, category: "conectividad" },
  ];

  userSkills: UserSkillConfig[] = [
    { domain: "rubik", label: "Cubos de Rubik", weekly_target_minutes: 120, preferred_session_time: "noche" },
    { domain: "reading", label: "Sesiones de Lectura", weekly_target_minutes: 150, preferred_session_time: "noche" },
    { domain: "knitting", label: "Sesiones de Tejido", weekly_target_minutes: 90, preferred_session_time: "tarde" },
    { domain: "study", label: "Sesiones de Estudio", weekly_target_minutes: 180, preferred_session_time: "manana" },
    { domain: "work", label: "Sesiones de Trabajo", weekly_target_minutes: 240, preferred_session_time: "manana" },
    { domain: "gaming", label: "Videojuegos / eSports", weekly_target_minutes: 120, preferred_session_time: "noche" },
    { domain: "sports", label: "Entrenamiento & Deporte", weekly_target_minutes: 180, preferred_session_time: "noche" },
  ];

  dailySchedule: DailyScheduleConfig = {
    wake_up_time: "06:00",
    sleep_time: "22:30",
    weekend_wake_up_time: "08:00",
    weekend_sleep_time: "23:30",
    work_days_pattern: "lun_vie",
    work_start_hour: "08:00",
    work_end_hour: "17:30",
    commute_and_meals_minutes: 45,
    free_slot_preference: "mixed",
    weekday_free_minutes: 55,
    weekend_free_minutes: 90,
  };

  vault_cap_gp = 400000;
  vault_remaining_gp = 400000;
  wallet_gp = 0;
  total_penalty_gp = 0;

  debt_strategy: DebtStrategy = "snowball";

  player_level = 1;
  current_xp = 0;
  current_streak_days = 2; // Inicia en 2 para que al completar 1 misión suba a 3 días (Buff 1.1x)
  streak_multiplier = 1.0;
  aegis_shields = 1; // 1 Escudo inicial disponible

  processedIdempotencyKeys = new Map<string, unknown>();

  bosses: DemoBoss[] = [
    {
      id: "boss-nequi",
      name: "Nequi",
      max_hp: 165442,
      current_hp: 165442,
      interest_rate_ea: 26.5,
      min_monthly_payment_cop: 45000,
      paid_this_month_cop: 0,
      priority_order: 1,
      cutoff_day: 15,
      status: "active",
    },
    {
      id: "boss-addi",
      name: "ADDI",
      max_hp: 1137647,
      current_hp: 1137647,
      interest_rate_ea: 28.9,
      min_monthly_payment_cop: 120000,
      paid_this_month_cop: 0,
      priority_order: 2,
      cutoff_day: 28,
      status: "active",
    },
    {
      id: "boss-bancolombia",
      name: "Bancolombia",
      max_hp: 3000000,
      current_hp: 3000000,
      interest_rate_ea: 24.0,
      min_monthly_payment_cop: 180000,
      paid_this_month_cop: 0,
      priority_order: 3,
      cutoff_day: 30,
      status: "active",
    },
  ];

  quests: DemoQuest[] = [
    {
      code: "RUBIK_AO12_SESSION",
      title: "Cubo de Rubik: Sesión Ao12 + Práctica CFOP",
      domain: "rubik",
      difficulty: "medium",
      reward_gp: 4500,
      reward_xp: 95,
    },
    {
      code: "READING_SESSION_30M",
      title: "Sesión de Lectura Profunda (20+ páginas)",
      domain: "reading",
      difficulty: "medium",
      reward_gp: 4000,
      reward_xp: 85,
    },
    {
      code: "KNITTING_CRAFT_SESSION",
      title: "Sesión de Tejido: Avance de Filas / Crochet",
      domain: "knitting",
      difficulty: "medium",
      reward_gp: 4500,
      reward_xp: 90,
    },
    {
      code: "STUDY_BLOCK",
      title: "Sesión de Estudio / Active Recall (50m)",
      domain: "study",
      difficulty: "hard",
      reward_gp: 5000,
      reward_xp: 110,
    },
    {
      code: "DEEP_WORK_2H",
      title: "Sesión de Trabajo: Bloque Deep Work (2h)",
      domain: "work",
      difficulty: "hard",
      reward_gp: 6500,
      reward_xp: 130,
    },
    {
      code: "GYM_WORKOUT",
      title: "Entrenamiento de Fuerza / Gym",
      domain: "general",
      difficulty: "hard",
      reward_gp: 5000,
      reward_xp: 100,
    },
  ];

  rubikSolves: RubikSolveEntry[] = [
    {
      id: "solve-12",
      cube_type: "3x3",
      time_seconds: 17.84,
      penalty: "NONE",
      scramble: "R U R' U' R' F R2 U' R' U' R U R' F'",
      is_pb: true,
      ao5_after: 19.42,
      ao12_after: 19.85,
      algorithm_practiced: "PLL T-Perm & Jb-Perm",
      timestamp: "2026-11-05T16:30:00Z",
    },
    {
      id: "solve-11",
      cube_type: "3x3",
      time_seconds: 19.15,
      penalty: "NONE",
      scramble: "F R U' R' U' R U R' F' R U R' U' R' F R F'",
      is_pb: false,
      ao5_after: 19.86,
      ao12_after: null,
      algorithm_practiced: "F2L Lookahead",
      timestamp: "2026-11-05T16:25:00Z",
    },
    {
      id: "solve-10",
      cube_type: "3x3",
      time_seconds: 21.6,
      penalty: "NONE",
      scramble: "U2 L2 D' B2 D R2 D2 F2 U' R' B D2 L' U F'",
      is_pb: false,
      ao5_after: 20.05,
      ao12_after: null,
      timestamp: "2026-11-05T16:20:00Z",
    },
    {
      id: "solve-9",
      cube_type: "3x3",
      time_seconds: 18.92,
      penalty: "NONE",
      scramble: "D2 R2 F2 U B2 U2 L2 D' B2 R' D' F U2 L B'",
      is_pb: false,
      ao5_after: 19.91,
      ao12_after: null,
      timestamp: "2026-11-05T16:15:00Z",
    },
    {
      id: "solve-8",
      cube_type: "3x3",
      time_seconds: 20.19,
      penalty: "NONE",
      scramble: "B2 U' R2 D L2 U' F2 U R2 B' L D' R' U2 F'",
      is_pb: false,
      ao5_after: 20.12,
      ao12_after: null,
      timestamp: "2026-11-05T16:10:00Z",
    },
    {
      id: "solve-7",
      cube_type: "3x3",
      time_seconds: 19.45,
      penalty: "NONE",
      scramble: "L2 U2 F2 D B2 U' R2 U' F' D L' B2 R U'",
      is_pb: false,
      ao5_after: 20.18,
      ao12_after: null,
      algorithm_practiced: "OLL 27 Sune",
      timestamp: "2026-11-05T16:05:00Z",
    },
    {
      id: "solve-6",
      cube_type: "3x3",
      time_seconds: 20.1,
      penalty: "NONE",
      scramble: "R2 D' L2 U F2 D2 B2 U' L' F' D R2 B U2",
      is_pb: false,
      ao5_after: 20.32,
      ao12_after: null,
      timestamp: "2026-11-05T16:00:00Z",
    },
    {
      id: "solve-5",
      cube_type: "3x3",
      time_seconds: 19.8,
      penalty: "NONE",
      scramble: "F2 U R2 D' B2 U2 L2 D F' R U' B2 L D'",
      is_pb: false,
      ao5_after: 20.39,
      ao12_after: null,
      timestamp: "2026-11-05T15:55:00Z",
    },
    {
      id: "solve-4",
      cube_type: "3x3",
      time_seconds: 20.5,
      penalty: "NONE",
      scramble: "U' B2 D L2 D' R2 U2 F2 L' D' B U2 R' F",
      is_pb: false,
      ao5_after: null,
      ao12_after: null,
      timestamp: "2026-11-05T15:50:00Z",
    },
    {
      id: "solve-3",
      cube_type: "3x3",
      time_seconds: 19.3,
      penalty: "NONE",
      scramble: "D R2 U' F2 D2 L2 B2 U R' B' L2 D F' U",
      is_pb: false,
      ao5_after: null,
      ao12_after: null,
      timestamp: "2026-11-05T15:45:00Z",
    },
    {
      id: "solve-2",
      cube_type: "3x3",
      time_seconds: 20.4,
      penalty: "NONE",
      scramble: "B2 L2 D' F2 U R2 D2 U' B L' D R' F2 U'",
      is_pb: false,
      ao5_after: null,
      ao12_after: null,
      timestamp: "2026-11-05T15:40:00Z",
    },
    {
      id: "solve-1",
      cube_type: "3x3",
      time_seconds: 20.69,
      penalty: "NONE",
      scramble: "L2 F2 U' R2 D B2 U2 D' L F' U' R B2 D",
      is_pb: false,
      ao5_after: null,
      ao12_after: null,
      timestamp: "2026-11-05T15:35:00Z",
    },
    {
      id: "solve-2x2-1",
      cube_type: "2x2",
      time_seconds: 5.42,
      penalty: "NONE",
      scramble: "R U2 R' F2 U' F R U'",
      is_pb: true,
      ao5_after: null,
      ao12_after: null,
      algorithm_practiced: "Ortega PBL",
      timestamp: "2026-11-05T15:20:00Z",
    },
    {
      id: "solve-4x4-1",
      cube_type: "4x4",
      time_seconds: 68.4,
      penalty: "NONE",
      scramble: "Rw U2 Rw' F2 Uw' R U2 L' B2 D2",
      is_pb: true,
      ao5_after: null,
      ao12_after: null,
      algorithm_practiced: "Método Yau + OLL Parity",
      timestamp: "2026-11-05T15:10:00Z",
    },
  ];

  rubikCubes: RubikCubeCatalogItem[] = [
    {
      id: "cube-1",
      ...extractCubeSpecsDeterministic("GAN 14 MagLev Pro 3x3 UV"),
      status: "active_main",
      price_paid: 115000,
      purchase_date: "2026-09-07",
      store_or_source: "Tienda Speedcubing",
      created_at: "2026-09-07T10:00:00Z",
    },
    {
      id: "cube-2",
      ...extractCubeSpecsDeterministic("MoYu WeiLong WRM V10 3x3 Ball-Core UV"),
      status: "secondary",
      price_paid: 85000,
      purchase_date: "2026-09-07",
      store_or_source: "Tienda Speedcubing",
      created_at: "2026-09-07T10:00:00Z",
    },
    {
      id: "cube-3",
      ...extractCubeSpecsDeterministic("GAN 251 M Pro 2x2"),
      status: "active_main",
      price_paid: 65000,
      purchase_date: "2026-08-18",
      store_or_source: "SpeedCubeShop",
      created_at: "2026-08-18T10:00:00Z",
    },
    {
      id: "cube-4",
      ...extractCubeSpecsDeterministic("MoYu AoSu V7 4x4 Ball-Core UV"),
      status: "active_main",
      price_paid: 110000,
      purchase_date: "2026-07-24",
      store_or_source: "SpeedCubeShop",
      created_at: "2026-07-24T10:00:00Z",
    },
  ];

  readingBooks: ReadingBook[] = [
    {
      ...extractBookSpecsDeterministic("La Psicología del Dinero"),
      id: "book-1",
      title: "La Psicología del Dinero",
      author: "Morgan Housel",
      total_pages: 280,
      pages_read: 165,
      status: "reading",
      category: "Finanzas & Mentalidad",
      price_paid: 69000,
      purchase_date: "2026-09-15",
      store_or_source: "Panamericana / Buscalibre",
      format: "fisico",
      rating: 5,
      cover_color: "from-emerald-600 via-teal-800 to-slate-950",
      cover_url: "https://covers.openlibrary.org/b/isbn/9780857197689-L.jpg",
      synopsis:
        "18 lecciones atemporales sobre riqueza, codicia y felicidad que demuestran que el éxito financiero depende más de tu comportamiento que de tu inteligencia.",
      personal_review:
        "Ideal para mantener la calma con el presupuesto mensual y proteger el flujo de caja libre.",
      quotes: [
        {
          id: "q-init-1",
          text: "Ahorrar dinero es la brecha entre tu ego y tus ingresos.",
          page: 112,
          created_at: "2026-10-18",
        },
        {
          id: "q-init-2",
          text: "La mayor forma de riqueza es la capacidad de despertar cada mañana y decir: hoy puedo hacer lo que quiera.",
          page: 84,
          created_at: "2026-10-12",
        },
      ],
    },
    {
      ...extractBookSpecsDeterministic("Deep Work (Enfócate)"),
      id: "book-2",
      title: "Deep Work (Enfócate)",
      author: "Cal Newport",
      total_pages: 304,
      pages_read: 210,
      status: "reading",
      category: "Productividad",
      price_paid: 75000,
      purchase_date: "2026-09-15",
      store_or_source: "Panamericana / Buscalibre",
      format: "fisico",
      rating: 5,
      cover_color: "from-indigo-600 via-blue-900 to-slate-950",
      cover_url: "https://covers.openlibrary.org/b/isbn/9781455586691-L.jpg",
      synopsis:
        "Reglas para lograr el éxito enfocado en un mundo distraído mediante bloques de concentración sin interrupciones.",
      personal_review:
        "Base de mis bloques inamovibles de estudio y trabajo profundo.",
      quotes: [
        {
          id: "q-init-3",
          text: "El trabajo profundo es la habilidad de concentrarse sin distracción en una tarea cognitivamente exigente.",
          page: 14,
          created_at: "2026-10-22",
        },
      ],
    },
    {
      ...extractBookSpecsDeterministic("Designing Data-Intensive Applications"),
      id: "book-3",
      title: "Designing Data-Intensive Applications",
      author: "Martin Kleppmann",
      total_pages: 616,
      pages_read: 190,
      status: "reading",
      category: "Ingeniería & Estudio",
      price_paid: 85000,
      purchase_date: "2026-09-15",
      store_or_source: "Buscalibre",
      format: "fisico",
      rating: 5,
      cover_color: "from-amber-600 via-rose-900 to-slate-950",
      cover_url: "https://covers.openlibrary.org/b/isbn/9781449373320-L.jpg",
      synopsis:
        "Arquitectura de sistemas distribuidos, bases de datos, consistencia e idempotencia a gran escala.",
      personal_review:
        "Lectura densa pero indispensable para ingeniería de alto nivel.",
    },
  ];

  knittingProjects: KnittingProject[] = [
    {
      id: "knit-1",
      name: "Amigurumi Dragón Guardián de la Bóveda",
      technique: "Amigurumi",
      total_rows_target: 60,
      completed_rows: 38,
      yarn_details: "Hilaza algodón mercerizado verde esmeralda • Aguja 2.5mm",
      status: "in_progress",
    },
    {
      id: "knit-2",
      name: "Bufanda Texturizada Punto Brioche",
      technique: "Dos Agujas",
      total_rows_target: 120,
      completed_rows: 74,
      yarn_details: "Lana Merino DK azul medianoche • Agujas 4.5mm",
      status: "in_progress",
    },
    {
      id: "knit-3",
      name: "Manta Granny Squares Geométrica",
      technique: "Crochet",
      total_rows_target: 90,
      completed_rows: 45,
      yarn_details: "Acrílico suave multicolor • Aguja 3.5mm",
      status: "in_progress",
    },
  ];

  workProjects: WorkProject[] = [
    {
      id: "proj-1",
      name: "Automatización OPGs & Cargas de Precios",
      description:
        "Eliminación de pasos manuales y automatización del procesamiento de 200 OPGs mayoristas con scripts en Python y Excel.",
      methodology: "lean",
      current_stage: "Optimizar / Automatizar",
      status: "active",
      tasks_count: 5,
      completed_tasks_count: 3,
      total_minutes_invested: 180,
      created_at: "2026-11-04T10:00:00Z",
      tasks: [
        {
          id: "task-1-1",
          project_id: "proj-1",
          title: "Diagnóstico de cuellos de botella en procesamiento de 200 OPGs",
          description: "Mapeo de tiempos muertos en digitación y validación manual.",
          stage: "Identificar Valor",
          priority: "high",
          estimated_minutes: 45,
          reward_gp: 5300,
          reward_xp: 110,
          is_completed: true,
          created_at: "2026-11-04T10:15:00Z",
        },
        {
          id: "task-1-2",
          project_id: "proj-1",
          title: "Mapeo de la cadena de flujo entre ERP y pedidos mayoristas",
          description: "Identificar campos obligatorios y fuentes de inconsistencia.",
          stage: "Mapear Cadena de Flujo",
          priority: "medium",
          estimated_minutes: 60,
          reward_gp: 5700,
          reward_xp: 150,
          is_completed: true,
          created_at: "2026-11-04T11:00:00Z",
        },
        {
          id: "task-1-3",
          project_id: "proj-1",
          title: "Script de validación sintáctica de tarifas y referencias en Python",
          description: "Verificación automática de listas de precios mayoristas.",
          stage: "Optimizar / Automatizar",
          priority: "critical",
          estimated_minutes: 75,
          reward_gp: 9500,
          reward_xp: 190,
          is_completed: true,
          created_at: "2026-11-05T09:30:00Z",
        },
        {
          id: "task-1-4",
          project_id: "proj-1",
          title: "Macro de carga masiva automatizada con control de excepciones",
          description: "Generar carga directa con reporte de filas procesadas con éxito.",
          stage: "Optimizar / Automatizar",
          priority: "high",
          estimated_minutes: 60,
          reward_gp: 7100,
          reward_xp: 150,
          is_completed: false,
          created_at: "2026-11-06T14:00:00Z",
        },
        {
          id: "task-1-5",
          project_id: "proj-1",
          title: "Prueba piloto con canal mayorista y auditoría de horas ahorradas",
          description: "Validar reducción de 4h a 20min por corrida semanal.",
          stage: "Optimizar / Automatizar",
          priority: "medium",
          estimated_minutes: 45,
          reward_gp: 4200,
          reward_xp: 110,
          is_completed: false,
          created_at: "2026-11-07T08:30:00Z",
        },
      ],
    },
    {
      id: "proj-2",
      name: "Dashboard Financiero & RPG Life-Engine",
      description:
        "Gamificación y control financiero personal con Snowball/Avalanche y Santuario de Habilidades.",
      methodology: "scrum",
      current_stage: "Sprint Backlog",
      status: "active",
      tasks_count: 5,
      completed_tasks_count: 3,
      total_minutes_invested: 240,
      created_at: "2026-11-01T15:30:00Z",
      tasks: [
        {
          id: "task-2-1",
          project_id: "proj-2",
          title: "Simulador de Daño DoT y Enrage Timer en Debt Bosses",
          description: "Impacto visual de intereses pasivos si no hay abonos a capital.",
          stage: "Hecho",
          priority: "critical",
          estimated_minutes: 90,
          reward_gp: 11500,
          reward_xp: 220,
          is_completed: true,
          created_at: "2026-11-02T10:00:00Z",
        },
        {
          id: "task-2-2",
          project_id: "proj-2",
          title: "Gating de Racha e Impuesto al Impulso en Wishlist",
          description: "Restringir canjes por días de racha e incremento de 20% si hay sobrecostos.",
          stage: "Hecho",
          priority: "high",
          estimated_minutes: 60,
          reward_gp: 7100,
          reward_xp: 150,
          is_completed: true,
          created_at: "2026-11-03T11:00:00Z",
        },
        {
          id: "task-2-3",
          project_id: "proj-2",
          title: "Amortización Automática de Sobregiro en Billetera GP",
          description: "Maldición levantada al recuperar saldo positivo con sesiones.",
          stage: "Hecho",
          priority: "high",
          estimated_minutes: 45,
          reward_gp: 5300,
          reward_xp: 110,
          is_completed: true,
          created_at: "2026-11-04T12:00:00Z",
        },
        {
          id: "task-2-4",
          project_id: "proj-2",
          title: "Tablero interactivo Trello para gestión ágil de proyectos",
          description: "Columnas dinámicas según Scrum/Kanban/Lean con movimiento de tarjetas.",
          stage: "En Progreso",
          priority: "critical",
          estimated_minutes: 50,
          reward_gp: 6500,
          reward_xp: 130,
          is_completed: false,
          created_at: "2026-11-07T16:00:00Z",
        },
        {
          id: "task-2-5",
          project_id: "proj-2",
          title: "Skill 9 de Gemini para descomposición ágil de proyectos",
          description: "Generador asistido por IA que crea proyectos y tareas en el Trello.",
          stage: "Sprint Backlog",
          priority: "high",
          estimated_minutes: 45,
          reward_gp: 5300,
          reward_xp: 110,
          is_completed: false,
          created_at: "2026-11-07T18:00:00Z",
        },
      ],
    },
  ];

  skillSessions: SkillSessionRecord[] = [
    {
      id: "sess-init-1",
      domain: "rubik",
      title: "Cubo 3x3: Práctica Sub-18 & Algoritmo PLL",
      duration_minutes: 25,
      gp_earned: 4500,
      xp_earned: 95,
      details: "PB de 17.84s alcanzado • Ao5: 19.42s • PLL T-Perm",
      metadata: {
        cube_type: "3x3",
        best_time_seconds: 17.84,
        solves_count: 5,
        algorithm_learned: "PLL T-Perm",
      },
      timestamp: "2026-11-05T16:30:00Z",
    },
    {
      id: "sess-init-2",
      domain: "reading",
      title: "Lectura: La Psicología del Dinero",
      duration_minutes: 35,
      gp_earned: 4000,
      xp_earned: 85,
      details: "+25 páginas leídas (Progreso: 165/280 págs)",
      metadata: {
        book_id: "book-1",
        book_title: "La Psicología del Dinero",
        pages_read: 25,
      },
      timestamp: "2026-11-05T19:00:00Z",
    },
    {
      id: "sess-init-3",
      domain: "knitting",
      title: "Tejido: Amigurumi Dragón Guardián",
      duration_minutes: 40,
      gp_earned: 4500,
      xp_earned: 90,
      details: "+8 vueltas tejidas (Progreso: 38/60 vueltas)",
      metadata: {
        project_id: "knit-1",
        project_name: "Amigurumi Dragón Guardián de la Bóveda",
        rows_completed: 8,
      },
      timestamp: "2026-11-05T20:15:00Z",
    },
  ];

  wishlist: DemoWishlistItem[] = [
    {
      id: "wish-1",
      name: "Cubo Magnético Flagship (GAN / MoYu AoSu)",
      cost_gp: 85000,
      priority: 1,
      min_streak_required: 1,
      is_redeemed: false,
    },
    {
      id: "wish-2",
      name: "Kit Hilazas Merino + Agujas Ergonómicas Tejido",
      cost_gp: 60000,
      priority: 2,
      min_streak_required: 3,
      is_redeemed: false,
    },
    {
      id: "wish-3",
      name: "Cena Especial Fin de Semana / Libro Edición Dura",
      cost_gp: 65000,
      priority: 3,
      min_streak_required: 7,
      is_redeemed: false,
    },
  ];

  logs: DemoLogEntry[] = [];

  trialCheckpoints: TrialCheckpointSnapshot[] = [
    {
      id: "checkpoint-day-1",
      label: "Día 1 — Línea Base del Piloto (Inicio)",
      created_at: new Date().toISOString().slice(0, 10),
      billing_period: "2026-11",
      player_level: 4,
      current_xp: 1420,
      streak_days: 5,
      aegis_shields: 2,
      total_debt_remaining_cop: 4326937,
      vault_unlocked_gp: 120000,
      wallet_gp: 120000,
      total_penalty_gp: 0,
      rubik_3x3_pb: 16.42,
      rubik_3x3_ao12: 18.85,
      total_pages_read: 580,
      total_quotes_captured: 3,
      total_skill_sessions: 7,
      notes:
        "Línea base calibrada con historial financiero real y Santuario de Habilidades.",
    },
  ];

  createTrialCheckpoint(params: {
    label?: string;
    notes?: string;
    reset_month_cycle?: boolean;
  }): TrialCheckpointSnapshot {
    const rubik3x3 = this.getRubikStats("3x3");
    const totalDebt = this.bosses.reduce(
      (acc, b) => acc + Math.max(0, b.current_hp),
      0
    );
    const totalPages = this.readingBooks.reduce(
      (acc, b) => acc + (b.pages_read || 0),
      0
    );
    const totalQuotes = this.readingBooks.reduce(
      (acc, b) => acc + (b.quotes?.length || 0),
      0
    );
    const unlockedGp = Math.max(0, this.vault_cap_gp - this.vault_remaining_gp);

    const checkpoint: TrialCheckpointSnapshot = {
      id: `checkpoint-${Date.now()}`,
      label:
        (params.label || "").trim() ||
        `Corte Día ${this.current_streak_days} (${new Date()
          .toISOString()
          .slice(0, 10)})`,
      created_at: new Date().toISOString().slice(0, 10),
      billing_period: this.billing_period,
      player_level: this.player_level,
      current_xp: this.current_xp,
      streak_days: this.current_streak_days,
      aegis_shields: this.aegis_shields,
      total_debt_remaining_cop: totalDebt,
      vault_unlocked_gp: unlockedGp,
      wallet_gp: this.wallet_gp,
      total_penalty_gp: this.total_penalty_gp,
      rubik_3x3_pb: rubik3x3.pb_seconds,
      rubik_3x3_ao12: rubik3x3.ao12_seconds,
      total_pages_read: totalPages,
      total_quotes_captured: totalQuotes,
      total_skill_sessions: this.skillSessions.length,
      notes: (params.notes || "").trim() || undefined,
    };

    this.trialCheckpoints.unshift(checkpoint);

    if (params.reset_month_cycle) {
      // Corte de Mes: reinicia gastos mensuales y recarga el Tope de Bóveda conservando Nivel, XP, Racha, Deudas y Colecciones
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      this.billing_period = nextMonth.toISOString().slice(0, 7);
      this.fixed_costs_spent_cop = 0;
      this.variable_ops_spent_cop = 0;
      this.vault_remaining_gp = this.vault_cap_gp;
      this.total_penalty_gp = 0;
      this.bosses.forEach((b) => {
        b.paid_this_month_cop = 0;
      });
      this.logs.unshift({
        id: `log-month-reset-${Date.now()}`,
        type: "activity",
        domain: "general",
        title: `🗓️ Corte de Mes (${this.billing_period}) + Bitácora Guardada`,
        subtitle: `Bóveda recargada (${this.vault_cap_gp.toLocaleString(
          "es-CO"
        )} GP) • Progreso de Deudas, Libros y Cubos conservado`,
        gp_delta: 0,
        timestamp: new Date().toISOString(),
      });
    } else {
      this.logs.unshift({
        id: `log-checkpoint-${Date.now()}`,
        type: "activity",
        domain: "general",
        title: `📸 Bitácora del Piloto: ${checkpoint.label}`,
        subtitle: `Deuda: $${totalDebt.toLocaleString(
          "es-CO"
        )} • Págs: ${totalPages} • Frases: ${totalQuotes}`,
        gp_delta: 0,
        timestamp: new Date().toISOString(),
      });
    }

    return checkpoint;
  }

  private recalculateStreakMultiplier() {
    if (this.current_streak_days >= 7) {
      this.streak_multiplier = 1.25;
    } else if (this.current_streak_days >= 3) {
      this.streak_multiplier = 1.1;
    } else {
      this.streak_multiplier = 1.0;
    }
  }

  // 1A. Cálculo de Daño Pasivo por Segundo/Día (DoT) y Enrage Timer de Debt Bosses
  updateBossesDoTAndEnrageStatus(refDate: Date = new Date()): DemoBoss[] {
    const currentDay = refDate.getDate();

    for (const boss of this.bosses) {
      if (boss.current_hp <= 0) {
        boss.status = "defeated";
        boss.daily_interest_dot_gp = 0;
        boss.monthly_interest_cop = 0;
        boss.days_until_cutoff = 0;
        boss.enrage_timer_active = false;
        boss.is_purified = true;
        continue;
      }

      const cutoff = boss.cutoff_day || 20;
      const daysUntil = cutoff - currentDay;
      boss.days_until_cutoff = daysUntil;

      const monthlyRate =
        Math.pow(1 + boss.interest_rate_ea / 100, 1 / 12) - 1;
      const monthlyInterest = Math.round(boss.current_hp * monthlyRate);
      boss.monthly_interest_cop = monthlyInterest;

      const isPurified =
        (boss.paid_this_month_cop || 0) >=
          (boss.min_monthly_payment_cop || 10000) ||
        boss.is_purified === true;

      boss.is_purified = isPurified;

      if (isPurified) {
        // Boss apaciguado: el sangrado DoT se neutraliza para este ciclo
        boss.daily_interest_dot_gp = 0;
        boss.enrage_timer_active = false;
        if (boss.status === "enraged") {
          boss.status = "active";
        }
      } else {
        // Daño pasivo DoT diario en GP
        boss.daily_interest_dot_gp = Math.max(
          1,
          Math.round(monthlyInterest / 30)
        );

        if (daysUntil < 0) {
          // Fecha de corte vencida sin abono: Boss enfurecido
          boss.status = "enraged";
          boss.enrage_timer_active = true;
        } else if (daysUntil <= 3) {
          // A 3 días o menos del corte sin abono: Enrage Timer activado
          boss.enrage_timer_active = true;
        } else {
          boss.enrage_timer_active = false;
          if (boss.status !== "enraged") {
            boss.status = "active";
          }
        }
      }
    }
    return this.bosses;
  }

  // 1B. Poción de Purificación (Abono directo a capital para detener el sangrado DoT)
  applyPurificationPotion(params: {
    boss_id: string;
    amount_cop?: number;
    use_wallet_gp?: boolean;
  }) {
    const boss = this.bosses.find((b) => b.id === params.boss_id);
    if (!boss) {
      throw new Error(`Boss con ID "${params.boss_id}" no encontrado.`);
    }
    if (boss.current_hp <= 0) {
      throw new Error(`El Boss ${boss.name} ya ha sido liquidado.`);
    }

    let paymentAmount = Math.max(0, Math.round(params.amount_cop || 0));

    if (paymentAmount === 0 && params.use_wallet_gp) {
      paymentAmount = Math.min(
        Math.max(0, this.wallet_gp),
        boss.min_monthly_payment_cop - (boss.paid_this_month_cop || 0)
      );
      if (paymentAmount <= 0) {
        paymentAmount = Math.min(Math.max(0, this.wallet_gp), boss.current_hp);
      }
    }

    if (paymentAmount === 0) {
      paymentAmount = Math.min(boss.min_monthly_payment_cop, boss.current_hp);
    }

    if (params.use_wallet_gp) {
      if (this.wallet_gp < paymentAmount) {
        throw new Error(
          `Saldo insuficiente en Billetera GP. Requieres ${paymentAmount.toLocaleString(
            "es-CO"
          )} GP y dispones de ${this.wallet_gp.toLocaleString("es-CO")} GP.`
        );
      }
      this.wallet_gp -= paymentAmount;
    }

    const damageDealt = Math.min(paymentAmount, boss.current_hp);
    boss.current_hp -= damageDealt;
    boss.paid_this_month_cop = (boss.paid_this_month_cop || 0) + damageDealt;
    boss.is_purified = true;
    boss.last_purification_date = new Date().toISOString();
    boss.daily_interest_dot_gp = 0;
    boss.enrage_timer_active = false;

    if (boss.current_hp <= 0) {
      boss.current_hp = 0;
      boss.status = "defeated";
    } else if (boss.status === "enraged") {
      boss.status = "active";
    }

    const previousDot = Math.max(
      1,
      Math.round((boss.monthly_interest_cop || 0) / 30)
    );

    this.logs.unshift({
      id: crypto.randomUUID(),
      type: "counterattack",
      title: `🧪 Poción de Purificación: ${boss.name}`,
      subtitle: `Abono de $${damageDealt.toLocaleString(
        "es-CO"
      )} COP • Sangrado DoT detenido (-${previousDot} GP/día mitigado)${
        boss.current_hp === 0
          ? " • 🏆 ¡BOSS ANIQUILADO!"
          : " • 🕊️ Purificado para este ciclo"
      }`,
      gp_delta: params.use_wallet_gp ? -paymentAmount : 0,
      timestamp: new Date().toISOString(),
    });

    this.updateBossesDoTAndEnrageStatus();

    return {
      boss,
      damage_dealt_cop: damageDealt,
      purified: true,
      dot_soothed_gp: previousDot,
      message: `¡Poción de Purificación aplicada con éxito! Daño DoT neutralizado para ${boss.name}.`,
    };
  }

  // 1C. Decorador dinámico de Wishlist con Racha Mínima e Impuesto al Impulso
  getDecoratedWishlist(): DemoWishlistItem[] {
    const hasImpulseTax =
      this.wallet_gp < 0 ||
      this.variable_ops_spent_cop > this.variable_ops_budget_cop ||
      this.total_penalty_gp > 0;
    const impulseTaxPct = hasImpulseTax ? 0.2 : 0;

    return this.wishlist.map((item) => {
      const minStreak =
        item.min_streak_required ??
        (item.priority === 1 ? 1 : item.priority === 2 ? 3 : 7);
      const effectiveCost = Math.round(item.cost_gp * (1 + impulseTaxPct));

      let lockedReason: string | null = null;
      if (item.is_redeemed) {
        lockedReason = "Ya redimido";
      } else if (this.current_streak_days < minStreak) {
        lockedReason = `Requiere racha mínima de ${minStreak} días (Actual: ${this.current_streak_days}d)`;
      } else if (this.wallet_gp < 0) {
        lockedReason =
          "Billetera en Maldición de Sobregiro (OVERDRAWN_CURSE). Sanea tu saldo registrando hábitos.";
      } else if (this.wallet_gp < effectiveCost) {
        lockedReason = `Faltan ${(
          effectiveCost - this.wallet_gp
        ).toLocaleString("es-CO")} GP para desbloquear`;
      }

      return {
        ...item,
        min_streak_required: minStreak,
        impulse_tax_pct: impulseTaxPct,
        effective_cost_gp: effectiveCost,
        locked_reason: lockedReason,
      };
    });
  }

  // Resumen de Estadísticas por Dominio de Habilidad
  getSkillDomainSummaries(): SkillDomainSummary[] {
    const defaultDomains: Array<{ domain: SkillDomain; label: string }> = [
      { domain: "rubik", label: "Cubos de Rubik" },
      { domain: "reading", label: "Sesiones de Lectura" },
      { domain: "knitting", label: "Sesiones de Tejido" },
      { domain: "study", label: "Sesiones de Estudio" },
      { domain: "work", label: "Sesiones de Trabajo" },
      { domain: "gaming", label: "Videojuegos / eSports" },
      { domain: "sports", label: "Entrenamiento & Deporte" },
    ];
    const domains =
      this.userSkills && this.userSkills.length > 0
        ? this.userSkills.map((u) => ({ domain: u.domain, label: u.label }))
        : defaultDomains;

    return domains.map(({ domain, label }) => {
      const records = this.skillSessions.filter((s) => s.domain === domain);
      const totalXp = records.reduce((acc, r) => acc + r.xp_earned, 0);
      const totalGp = records.reduce((acc, r) => acc + r.gp_earned, 0);
      const totalMinutes = records.reduce(
        (acc, r) => acc + r.duration_minutes,
        0
      );
      const level = Math.max(1, Math.floor(Math.sqrt(totalXp / 80)) + 1);

      return {
        domain,
        label,
        level,
        total_xp: totalXp,
        total_gp_earned: totalGp,
        sessions_count: records.length,
        total_minutes: totalMinutes,
      };
    });
  }

  getRubikStats(cubeType: string = "3x3") {
    const solves = this.rubikSolves.filter((s) => s.cube_type === cubeType);
    const validTimes = solves
      .filter((s) => s.penalty !== "DNF")
      .map((s) => s.time_seconds);
    const wcaWindowTimes = solves.map((s) =>
      s.penalty === "DNF" ? Infinity : s.time_seconds
    );

    const pb = validTimes.length > 0 ? Math.min(...validTimes) : null;
    const ao5 = calculateWcaTrimmedAverage(wcaWindowTimes, 5);
    const ao12 = calculateWcaTrimmedAverage(wcaWindowTimes, 12);
    const mean =
      validTimes.length > 0
        ? Number(
            (validTimes.reduce((a, b) => a + b, 0) / validTimes.length).toFixed(
              2
            )
          )
        : null;

    return {
      cube_type: cubeType,
      total_solves: solves.length,
      pb_seconds: pb,
      ao5_seconds: ao5,
      ao12_seconds: ao12,
      mean_seconds: mean,
      recent_solves: solves.slice(0, 12),
    };
  }

  getAllRubikStats() {
    const cubeTypes: RubikCubeType[] = [
      "3x3",
      "2x2",
      "4x4",
      "Pyraminx",
      "Megaminx",
    ];
    return Object.fromEntries(
      cubeTypes.map((ct) => [ct, this.getRubikStats(ct)])
    ) as Record<RubikCubeType, ReturnType<RPGEngineMemoryStore["getRubikStats"]>>;
  }

  addRubikCube(
    params: Partial<ExtractedCubeSpecsAI> & {
      model_name: string;
      status?: "active_main" | "secondary" | "retired";
    }
  ): RubikCubeCatalogItem {
    const cleanModel = (params.model_name || "").trim();
    if (!cleanModel) {
      throw new Error("El nombre o modelo del cubo de Rubik es obligatorio.");
    }
    const baseSpecs = extractCubeSpecsDeterministic(cleanModel);
    const cubeType = params.cube_type || baseSpecs.cube_type;
    const magneticSystem = params.magnetic_system || baseSpecs.magnetic_system;
    const surfaceFinish = params.surface_finish || baseSpecs.surface_finish;
    const wcaLegal =
      params.wca_legal !== undefined ? params.wca_legal : baseSpecs.wca_legal;
    const targetSub = params.target_sub_seconds || baseSpecs.target_sub_seconds;
    const rewardGp =
      params.reward_gp_per_solve || baseSpecs.reward_gp_per_solve;
    const pbBonus = params.pb_bonus_gp || baseSpecs.pb_bonus_gp;

    const checklist = buildCubeComplianceChecklist({
      cube_type: cubeType,
      magnetic_system: magneticSystem,
      surface_finish: surfaceFinish,
      wca_legal: wcaLegal,
      target_sub_seconds: targetSub,
      reward_gp_per_solve: rewardGp,
      pb_bonus_gp: pbBonus,
    });

    const newCube: RubikCubeCatalogItem = {
      id: `cube-${crypto.randomUUID().slice(0, 8)}`,
      cube_type: cubeType,
      brand: (params.brand || baseSpecs.brand).trim(),
      model_name: cleanModel,
      magnetic_system: magneticSystem,
      surface_finish: surfaceFinish,
      size_mm: Number(params.size_mm || baseSpecs.size_mm),
      weight_grams: Number(params.weight_grams || baseSpecs.weight_grams),
      wca_legal: wcaLegal,
      recommended_setup: params.recommended_setup || baseSpecs.recommended_setup,
      target_sub_seconds: targetSub,
      recommended_alg_set:
        params.recommended_alg_set || baseSpecs.recommended_alg_set,
      reward_gp_per_solve: rewardGp,
      pb_bonus_gp: pbBonus,
      specs_compliance_checklist: checklist,
      status: params.status || "active_main",
      price_paid:
        params.price_paid !== undefined && Number(params.price_paid) >= 0
          ? Math.round(Number(params.price_paid))
          : 75000,
      purchase_date:
        params.purchase_date || new Date().toISOString().slice(0, 10),
      store_or_source: (params.store_or_source || "Tienda de Cubos").trim(),
      created_at: new Date().toISOString(),
    };
    this.rubikCubes.unshift(newCube);
    return newCube;
  }

  addReadingBook(params: {
    title: string;
    author?: string;
    total_pages?: number;
    category?: string;
    isbn?: string;
    language?: string;
    total_chapters?: number;
    complexity?: BookComplexity;
    estimated_hours?: number;
    recommended_daily_pages?: number;
    gp_per_page?: number;
    completion_bonus_gp?: number;
    xp_per_session?: number;
    key_learning_goal?: string;
    reading_specs_checklist?: SpecComplianceCheckItem[];
    price_paid?: number;
    purchase_date?: string;
    store_or_source?: string;
    cover_url?: string;
    cover_color?: string;
    synopsis?: string;
    format?: BookFormat;
    rating?: number;
    personal_review?: string;
    status?: "reading" | "completed" | "wishlist";
  }): ReadingBook {
    const cleanTitle = (params.title || "").trim();
    if (!cleanTitle) {
      throw new Error("El título del libro es obligatorio.");
    }
    const baseSpecs = extractBookSpecsDeterministic(
      params.author ? `${cleanTitle} - ${params.author}` : cleanTitle
    );
    const finalAuthor = (params.author || baseSpecs.author || "Autor").trim();
    const finalPages = Math.max(
      10,
      Math.round(params.total_pages || baseSpecs.total_pages || 200)
    );
    const finalCategory = (
      params.category ||
      baseSpecs.category ||
      "Desarrollo & Finanzas"
    ).trim();
    const finalIsbn = (params.isbn || baseSpecs.isbn).trim();
    const finalLanguage = (params.language || baseSpecs.language).trim();
    const finalComplexity: BookComplexity =
      params.complexity || baseSpecs.complexity;

    const pagesChanged = finalPages !== baseSpecs.total_pages;
    const complexityChanged = finalComplexity !== baseSpecs.complexity;

    const defaultChaptersForPages = Math.max(
      4,
      Math.round(finalPages / (finalComplexity === "denso_tecnico" ? 26 : 18))
    );
    const finalChapters =
      params.total_chapters &&
      (!pagesChanged || params.total_chapters !== baseSpecs.total_chapters)
        ? params.total_chapters
        : pagesChanged
        ? defaultChaptersForPages
        : baseSpecs.total_chapters || defaultChaptersForPages;

    const pagesPerHour =
      finalComplexity === "denso_tecnico"
        ? 18
        : finalComplexity === "intermedio"
        ? 26
        : 34;
    const defaultHours = Number((finalPages / pagesPerHour).toFixed(1));
    const finalHours =
      params.estimated_hours &&
      !pagesChanged &&
      !complexityChanged
        ? params.estimated_hours
        : defaultHours;

    const defaultDailyPages =
      finalComplexity === "denso_tecnico"
        ? 15
        : finalComplexity === "intermedio"
        ? 20
        : 25;
    const finalDailyPages =
      params.recommended_daily_pages &&
      (!complexityChanged ||
        params.recommended_daily_pages !== baseSpecs.recommended_daily_pages)
        ? params.recommended_daily_pages
        : defaultDailyPages;

    const defaultGpPerPage =
      finalComplexity === "denso_tecnico"
        ? 140
        : finalComplexity === "intermedio"
        ? 115
        : 100;
    const finalGpPerPage =
      params.gp_per_page &&
      (!complexityChanged || params.gp_per_page !== baseSpecs.gp_per_page)
        ? params.gp_per_page
        : defaultGpPerPage;

    const defaultCompletionBonus =
      finalComplexity === "denso_tecnico"
        ? 6500
        : finalComplexity === "intermedio"
        ? 5500
        : 5000;
    const finalCompletionBonus =
      params.completion_bonus_gp &&
      (!complexityChanged ||
        params.completion_bonus_gp !== baseSpecs.completion_bonus_gp)
        ? params.completion_bonus_gp
        : defaultCompletionBonus;

    const defaultXp =
      finalComplexity === "denso_tecnico"
        ? 115
        : finalComplexity === "intermedio"
        ? 95
        : 85;
    const finalXp =
      params.xp_per_session &&
      (!complexityChanged || params.xp_per_session !== baseSpecs.xp_per_session)
        ? params.xp_per_session
        : defaultXp;

    const finalGoal = params.key_learning_goal || baseSpecs.key_learning_goal;

    const checklist = buildBookReadingChecklist({
      title: cleanTitle,
      author: finalAuthor,
      isbn: finalIsbn,
      total_pages: finalPages,
      total_chapters: finalChapters,
      complexity: finalComplexity,
      estimated_hours: finalHours,
      recommended_daily_pages: finalDailyPages,
      gp_per_page: finalGpPerPage,
      completion_bonus_gp: finalCompletionBonus,
    });

    const cleanDigitsIsbn = finalIsbn.replace(/[^0-9X]/gi, "");
    const autoCoverUrl =
      params.cover_url?.trim() ||
      (cleanDigitsIsbn.length >= 10
        ? `https://covers.openlibrary.org/b/isbn/${cleanDigitsIsbn}-L.jpg`
        : undefined);

    const coverPalette = [
      "from-emerald-600 via-teal-900 to-slate-950",
      "from-indigo-600 via-blue-900 to-slate-950",
      "from-purple-600 via-fuchsia-900 to-slate-950",
      "from-amber-600 via-orange-900 to-slate-950",
      "from-cyan-600 via-sky-900 to-slate-950",
    ];
    const autoColor =
      params.cover_color ||
      coverPalette[this.readingBooks.length % coverPalette.length];

    const newBook: ReadingBook = {
      id: `book-${crypto.randomUUID().slice(0, 8)}`,
      title: cleanTitle,
      author: finalAuthor,
      total_pages: finalPages,
      pages_read: params.status === "completed" ? finalPages : 0,
      status: params.status || "reading",
      category: finalCategory,
      isbn: finalIsbn,
      language: finalLanguage,
      total_chapters: finalChapters,
      complexity: finalComplexity,
      estimated_hours: finalHours,
      recommended_daily_pages: finalDailyPages,
      gp_per_page: finalGpPerPage,
      completion_bonus_gp: finalCompletionBonus,
      xp_per_session: finalXp,
      key_learning_goal: finalGoal,
      reading_specs_checklist: checklist,
      price_paid:
        params.price_paid !== undefined && Number(params.price_paid) >= 0
          ? Math.round(Number(params.price_paid))
          : 65000,
      purchase_date:
        params.purchase_date || new Date().toISOString().slice(0, 10),
      store_or_source: (params.store_or_source || "Librería / Buscalibre").trim(),
      cover_url: autoCoverUrl,
      cover_color: autoColor,
      synopsis: (params.synopsis || finalGoal || "").trim(),
      format: params.format || "fisico",
      rating: params.rating || 5,
      personal_review: (params.personal_review || "").trim(),
    };
    this.readingBooks.unshift(newBook);
    return newBook;
  }

  updateRubikCubeNotes(params: {
    cube_id: string;
    custom_notes?: string;
    maintenance_needs?: string;
    recommended_setup?: string;
  }): RubikCubeCatalogItem | null {
    const cube = this.rubikCubes.find((c) => c.id === params.cube_id);
    if (!cube) return null;
    if (params.custom_notes !== undefined) {
      cube.custom_notes = params.custom_notes;
    }
    if (params.maintenance_needs !== undefined) {
      cube.maintenance_needs = params.maintenance_needs;
    }
    if (params.recommended_setup !== undefined) {
      cube.recommended_setup = params.recommended_setup;
    }
    return cube;
  }

  updateReadingBookGallery(params: {
    book_id: string;
    rating?: number;
    personal_review?: string;
    synopsis?: string;
    cover_url?: string;
    price_paid?: number;
    purchase_date?: string;
    store_or_source?: string;
    format?: BookFormat;
    status?: "reading" | "completed" | "wishlist";
  }): ReadingBook | null {
    const book = this.readingBooks.find((b) => b.id === params.book_id);
    if (!book) return null;
    if (params.rating !== undefined) {
      book.rating = Math.min(5, Math.max(1, Math.round(params.rating)));
    }
    if (params.personal_review !== undefined) {
      book.personal_review = params.personal_review;
    }
    if (params.synopsis !== undefined) {
      book.synopsis = params.synopsis;
    }
    if (params.cover_url !== undefined) {
      book.cover_url = params.cover_url;
    }
    if (params.price_paid !== undefined) {
      book.price_paid = Math.max(0, Math.round(params.price_paid));
    }
    if (params.purchase_date !== undefined) {
      book.purchase_date = params.purchase_date;
    }
    if (params.store_or_source !== undefined) {
      book.store_or_source = params.store_or_source;
    }
    if (params.format !== undefined) {
      book.format = params.format;
    }
    if (params.status !== undefined) {
      book.status = params.status;
      if (params.status === "completed") {
        book.pages_read = book.total_pages;
      }
    }
    return book;
  }

  addBookQuote(params: {
    book_id: string;
    text: string;
    page?: number;
  }): ReadingBook | null {
    const cleanText = (params.text || "").trim();
    if (!cleanText) return null;
    const book =
      this.readingBooks.find((b) => b.id === params.book_id) ||
      this.readingBooks[0];
    if (!book) return null;
    if (!book.quotes) book.quotes = [];
    book.quotes.unshift({
      id: `q-${crypto.randomUUID().slice(0, 8)}`,
      text: cleanText,
      page:
        params.page && Number(params.page) > 0
          ? Math.round(Number(params.page))
          : book.pages_read || undefined,
      created_at: new Date().toISOString().slice(0, 10),
    });
    return book;
  }

  addKnittingProject(params: {
    name: string;
    technique?: "Crochet" | "Dos Agujas" | "Amigurumi" | "Telar";
    total_rows_target: number;
    yarn_details?: string;
  }): KnittingProject {
    const cleanName = (params.name || "").trim();
    if (!cleanName) {
      throw new Error("El nombre del proyecto de tejido es obligatorio.");
    }
    const newProj: KnittingProject = {
      id: `knit-${crypto.randomUUID().slice(0, 8)}`,
      name: cleanName,
      technique: params.technique || "Crochet",
      total_rows_target: Math.max(
        5,
        Math.round(params.total_rows_target || 50)
      ),
      completed_rows: 0,
      yarn_details: (
        params.yarn_details || "Hilaza algodón / lana acrílica"
      ).trim(),
      status: "in_progress",
    };
    this.knittingProjects.unshift(newProj);
    return newProj;
  }

  addWorkProject(params: {
    name: string;
    description?: string;
    methodology?: AgileMethodology;
    current_stage?: string;
    tasks?: Array<{
      title: string;
      description?: string;
      stage?: string;
      priority?: "low" | "medium" | "high" | "critical";
      estimated_minutes?: number;
    }>;
  }): WorkProject {
    const cleanName = (params.name || "").trim();
    if (!cleanName) {
      throw new Error("El nombre del proyecto estratégico es obligatorio.");
    }
    const meth = params.methodology || "lean";
    const defaultStage =
      meth === "scrum"
        ? "Sprint Backlog"
        : meth === "kanban"
        ? "En Proceso (WIP)"
        : meth === "lean"
        ? "Optimizar / Automatizar"
        : "En Progreso";

    const projId = `proj-${crypto.randomUUID().slice(0, 8)}`;
    const initialTasks: WorkProjectTask[] = (params.tasks || []).map(
      (t, idx) => {
        const priority = t.priority || (idx === 0 ? "high" : "medium");
        const mins = t.estimated_minutes || 45;
        const mult =
          priority === "critical" ? 1.5 : priority === "high" ? 1.25 : 1.0;
        return {
          id: `task-${crypto.randomUUID().slice(0, 8)}`,
          project_id: projId,
          title: (t.title || `Tarea #${idx + 1}`).trim(),
          description: t.description?.trim(),
          stage:
            t.stage ||
            (meth === "scrum"
              ? "Backlog"
              : meth === "kanban"
              ? "Por Hacer (To-Do)"
              : "Identificar Valor"),
          priority,
          estimated_minutes: mins,
          reward_gp: Math.min(12000, Math.round(mins * 95 * mult)),
          reward_xp: Math.round(mins * 2.4 * mult),
          is_completed: false,
          created_at: new Date().toISOString(),
        };
      }
    );

    const newProj: WorkProject = {
      id: projId,
      name: cleanName,
      description: params.description?.trim(),
      methodology: meth,
      current_stage: params.current_stage || defaultStage,
      status: "active",
      tasks: initialTasks,
      tasks_count: initialTasks.length,
      completed_tasks_count: 0,
      total_minutes_invested: 0,
      created_at: new Date().toISOString(),
    };
    this.workProjects.unshift(newProj);
    return newProj;
  }

  addWorkProjectTask(params: {
    project_id: string;
    title: string;
    description?: string;
    stage?: string;
    priority?: "low" | "medium" | "high" | "critical";
    estimated_minutes?: number;
  }): WorkProjectTask {
    const proj = this.workProjects.find((p) => p.id === params.project_id);
    if (!proj) {
      throw new Error(`Proyecto con ID "${params.project_id}" no encontrado.`);
    }
    const cleanTitle = (params.title || "").trim();
    if (!cleanTitle) {
      throw new Error("El título de la tarea es obligatorio.");
    }
    const priority = params.priority || "medium";
    const mins = Math.max(10, Math.round(params.estimated_minutes || 45));
    const mult =
      priority === "critical" ? 1.5 : priority === "high" ? 1.25 : 1.0;

    const defaultStage =
      params.stage ||
      (proj.methodology === "scrum"
        ? "Backlog"
        : proj.methodology === "kanban"
        ? "Por Hacer (To-Do)"
        : "Identificar Valor");

    const newTask: WorkProjectTask = {
      id: `task-${crypto.randomUUID().slice(0, 8)}`,
      project_id: proj.id,
      title: cleanTitle,
      description: params.description?.trim(),
      stage: defaultStage,
      priority,
      estimated_minutes: mins,
      reward_gp: Math.min(12000, Math.round(mins * 95 * mult)),
      reward_xp: Math.round(mins * 2.4 * mult),
      is_completed: false,
      created_at: new Date().toISOString(),
    };

    if (!Array.isArray(proj.tasks)) {
      proj.tasks = [];
    }
    proj.tasks.push(newTask);
    proj.tasks_count = proj.tasks.length;
    return newTask;
  }

  moveWorkProjectTask(params: {
    project_id: string;
    task_id: string;
    target_stage: string;
  }): WorkProjectTask {
    const proj = this.workProjects.find((p) => p.id === params.project_id);
    if (!proj || !Array.isArray(proj.tasks)) {
      throw new Error(`Proyecto con ID "${params.project_id}" no encontrado.`);
    }
    const task = proj.tasks.find((t) => t.id === params.task_id);
    if (!task) {
      throw new Error(`Tarea con ID "${params.task_id}" no encontrada.`);
    }
    task.stage = params.target_stage;
    return task;
  }

  completeWorkProjectTask(params: {
    project_id: string;
    task_id: string;
  }): {
    task: WorkProjectTask;
    project: WorkProject;
    reward: ReturnType<RPGEngineMemoryStore["completeActivity"]>;
  } {
    const proj = this.workProjects.find((p) => p.id === params.project_id);
    if (!proj || !Array.isArray(proj.tasks)) {
      throw new Error(`Proyecto con ID "${params.project_id}" no encontrado.`);
    }
    const task = proj.tasks.find((t) => t.id === params.task_id);
    if (!task) {
      throw new Error(`Tarea con ID "${params.task_id}" no encontrada.`);
    }
    if (task.is_completed) {
      throw new Error("Esta tarea ya fue completada.");
    }

    task.is_completed = true;
    const doneStage =
      proj.methodology === "scrum"
        ? "Hecho"
        : proj.methodology === "kanban"
        ? "Completado"
        : "Optimizar / Automatizar";
    task.stage = doneStage;

    proj.completed_tasks_count = proj.tasks.filter((t) => t.is_completed).length;
    const duration = task.estimated_minutes || 45;
    proj.total_minutes_invested = (proj.total_minutes_invested || 0) + duration;

    const reward = this.completeActivity({
      code: "WORK_TASK_DONE",
      title: `Tarea Completada: ${task.title}`,
      domain: "work",
      requested_gp: task.reward_gp || 5000,
      earned_xp: task.reward_xp || 110,
    });

    const sessionRecord: SkillSessionRecord = {
      id: crypto.randomUUID(),
      domain: "work",
      title: `Trello Task: ${task.title}`,
      duration_minutes: duration,
      gp_earned: reward.transferred_gp,
      xp_earned: task.reward_xp || 110,
      details: `Completada tarjeta del proyecto ${
        proj.name
      } (${proj.methodology.toUpperCase()}) • Prioridad: ${task.priority.toUpperCase()}`,
      metadata: {
        work_mode: "projects",
        project_id: proj.id,
        project_name: proj.name,
        agile_methodology: proj.methodology,
        agile_stage: doneStage,
        deliverable: task.title,
        impact_level:
          task.priority === "critical" ? "milestone" : "high_impact",
      },
      timestamp: new Date().toISOString(),
    };
    this.skillSessions.unshift(sessionRecord);

    return { task, project: proj, reward };
  }

  updateDailySchedule(
    schedule: Partial<DailyScheduleConfig>
  ): DailyScheduleConfig {
    this.dailySchedule = {
      ...this.dailySchedule,
      ...schedule,
    };
    return this.dailySchedule;
  }

  // 1. Trigger de Hábitos + Multiplicador de Racha (1.1x / 1.25x) + Escudo Aegis cada 7 rachas
  completeActivity(params: {
    code: string;
    title: string;
    domain?: SkillDomain;
    requested_gp: number;
    earned_xp: number;
    idempotency_key?: string;
  }) {
    if (
      params.idempotency_key &&
      this.processedIdempotencyKeys.has(params.idempotency_key)
    ) {
      return this.processedIdempotencyKeys.get(params.idempotency_key) as {
        transferred_gp: number;
        streak_multiplier_applied: number;
        streak_days: number;
        shield_earned: boolean;
        vault_capped: boolean;
        leveled_up: boolean;
        amortized_overdrawn_gp: number;
        curse_lifted: boolean;
        idempotent_replay: boolean;
      };
    }

    const prevLevel = this.player_level;
    this.current_streak_days += 1;
    this.recalculateStreakMultiplier();

    let shieldEarned = false;
    if (this.current_streak_days % 7 === 0) {
      this.aegis_shields += 1;
      shieldEarned = true;
    }

    const boostedGp = Math.round(params.requested_gp * this.streak_multiplier);
    const actualTransfer = Math.min(boostedGp, this.vault_remaining_gp);

    const prevWallet = this.wallet_gp;
    const amortizedToOverdrawn =
      prevWallet < 0 ? Math.min(actualTransfer, Math.abs(prevWallet)) : 0;

    this.vault_remaining_gp -= actualTransfer;
    this.wallet_gp += actualTransfer;
    this.current_xp += params.earned_xp;
    this.player_level = Math.max(
      1,
      Math.floor(Math.sqrt(this.current_xp / 100)) + 1
    );

    const curseLifted = prevWallet < 0 && this.wallet_gp >= 0;

    let logSubtitle = `Racha ${this.current_streak_days}d (Buff ${this.streak_multiplier}x) • +${params.earned_xp} XP`;
    if (shieldEarned) logSubtitle += " • 🛡️ +1 Escudo Aegis!";
    if (amortizedToOverdrawn > 0)
      logSubtitle += ` • ✨ Amortizados ${amortizedToOverdrawn.toLocaleString(
        "es-CO"
      )} GP del sobregiro`;
    if (curseLifted) logSubtitle += " • 🕊️ ¡Maldición de Sobregiro Levantada!";

    const entry: DemoLogEntry = {
      id: crypto.randomUUID(),
      type: "activity",
      domain: params.domain || "general",
      title: params.title,
      subtitle: logSubtitle,
      gp_delta: actualTransfer,
      timestamp: new Date().toISOString(),
    };
    this.logs.unshift(entry);

    const result = {
      transferred_gp: actualTransfer,
      streak_multiplier_applied: this.streak_multiplier,
      streak_days: this.current_streak_days,
      shield_earned: shieldEarned,
      vault_capped: actualTransfer < boostedGp,
      leveled_up: this.player_level > prevLevel,
      amortized_overdrawn_gp: amortizedToOverdrawn,
      curse_lifted: curseLifted,
      idempotent_replay: false,
    };

    if (params.idempotency_key) {
      this.processedIdempotencyKeys.set(params.idempotency_key, {
        ...result,
        idempotent_replay: true,
      });
    }

    return result;
  }

  // 1B. Registro Especializado de Sesiones (Cubos de Rubik, Lectura, Tejido, Estudio, Trabajo)
  logSkillSession(params: {
    domain: SkillDomain;
    duration_minutes: number;
    title?: string;
    notes?: string;
    idempotency_key?: string;
    // Rubik
    cube_type?: RubikCubeType;
    cube_id?: string;
    cube_model?: string;
    solve_time_seconds?: number;
    penalty?: RubikPenalty;
    scramble?: string;
    solves_count?: number;
    algorithm_learned?: string;
    // Reading
    book_id?: string;
    pages_read?: number;
    quote_text?: string;
    quote_page?: number;
    quotes_list?: Array<{ text: string; page?: number }>;
    // Knitting
    project_id?: string;
    rows_completed?: number;
    stitches_notes?: string;
    // Study
    subject?: string;
    study_method?:
      | "Pomodoro 25/5"
      | "Deep Study 50/10"
      | "Active Recall"
      | "Práctica";
    // Work
    deliverable?: string;
    impact_level?: "standard" | "high_impact" | "milestone";
    work_mode?: "activities" | "projects";
    agile_methodology?: AgileMethodology;
    agile_stage?: string;
  }) {
    const skillIdemKey = params.idempotency_key
      ? `skill_session:${params.idempotency_key}`
      : undefined;

    if (skillIdemKey && this.processedIdempotencyKeys.has(skillIdemKey)) {
      return this.processedIdempotencyKeys.get(skillIdemKey) as {
        session: SkillSessionRecord;
        reward_impact: ReturnType<RPGEngineMemoryStore["completeActivity"]>;
        rubik_stats?: ReturnType<RPGEngineMemoryStore["getRubikStats"]>;
      };
    }

    const duration = Math.max(1, params.duration_minutes || 25);
    let baseGp = 3500;
    let baseXp = 75;
    let sessionTitle = params.title || "Sesión de Habilidad";
    let detailsSummary = params.notes || `${duration} min de práctica enfocada`;
    let bonusNote = "";
    let effectiveSolveSeconds = params.solve_time_seconds;

    let resolvedCubeId: string | undefined = params.cube_id;
    let resolvedCubeModel: string | undefined = params.cube_model;
    let resolvedBookTitle: string | undefined;
    let resolvedProjectName: string | undefined;

    if (params.domain === "rubik") {
      const cube = params.cube_type || "3x3";
      const penalty: RubikPenalty = params.penalty || "NONE";
      const matchedCube =
        (params.cube_id
          ? this.rubikCubes.find((c) => c.id === params.cube_id)
          : undefined) ||
        this.rubikCubes.find((c) => c.cube_type === cube);
      resolvedCubeId = params.cube_id || matchedCube?.id;
      resolvedCubeModel = params.cube_model || matchedCube?.model_name;
      const pbBonusGp = matchedCube?.pb_bonus_gp || 2000;
      const targetSubSec = matchedCube?.target_sub_seconds || 20;
      baseGp = 4000;
      baseXp = 90;

      if (params.solve_time_seconds && params.solve_time_seconds > 0) {
        const rawTime = Number(params.solve_time_seconds.toFixed(2));
        const finalTime =
          penalty === "+2" ? Number((rawTime + 2).toFixed(2)) : rawTime;
        effectiveSolveSeconds = finalTime;

        const prevSolves = this.rubikSolves.filter(
          (s) => s.cube_type === cube
        );
        const prevValidTimes = prevSolves
          .filter((s) => s.penalty !== "DNF")
          .map((s) => s.time_seconds);
        const prevPb =
          prevValidTimes.length > 0 ? Math.min(...prevValidTimes) : Infinity;
        const isNewPb = penalty !== "DNF" && finalTime < prevPb;

        if (penalty === "DNF") {
          bonusNote = " • ⚠️ DNF (Sin bono de tiempo, cuenta en ventana WCA)";
        } else if (isNewPb) {
          baseGp += pbBonusGp;
          baseXp += 50;
          bonusNote = ` • 🏆 ¡NUEVO PB (+${pbBonusGp.toLocaleString("es-CO")} GP Bono)!`;
        } else if (finalTime < targetSubSec) {
          baseGp += 1000;
          baseXp += 25;
          bonusNote = ` • ⚡ ¡Solve Sub-${targetSubSec}s (+1.000 GP)!`;
        }

        const updatedTimes = [
          penalty === "DNF" ? Infinity : finalTime,
          ...prevSolves.map((s) =>
            s.penalty === "DNF" ? Infinity : s.time_seconds
          ),
        ];
        const ao5 = calculateWcaTrimmedAverage(updatedTimes, 5);
        const ao12 = calculateWcaTrimmedAverage(updatedTimes, 12);

        const newSolve: RubikSolveEntry = {
          id: crypto.randomUUID(),
          cube_type: cube,
          cube_id: resolvedCubeId,
          cube_model: resolvedCubeModel,
          time_seconds: finalTime,
          penalty,
          scramble: params.scramble || generateRubikScramble(),
          is_pb: isNewPb,
          ao5_after: ao5,
          ao12_after: ao12,
          algorithm_practiced: params.algorithm_learned,
          timestamp: new Date().toISOString(),
        };
        this.rubikSolves.unshift(newSolve);

        const timeLabel =
          penalty === "DNF"
            ? `DNF (${rawTime.toFixed(2)}s)`
            : penalty === "+2"
            ? `${finalTime.toFixed(2)}s (+2)`
            : `${finalTime.toFixed(2)}s`;

        sessionTitle =
          params.title ||
          `Cubo ${cube}: Solve ${timeLabel}${isNewPb ? " (¡PB!)" : ""}`;
        detailsSummary = `Tiempo: ${timeLabel} • Ao5: ${
          ao5 ? `${ao5.toFixed(2)}s` : "DNF/N/A"
        } • Ao12: ${ao12 ? `${ao12.toFixed(2)}s` : "N/A"}${
          params.algorithm_learned ? ` • Alg: ${params.algorithm_learned}` : ""
        }${bonusNote}`;
      } else {
        sessionTitle = params.title || `Práctica Speedcubing (${cube})`;
        detailsSummary = `${
          params.solves_count || 12
        } solves completados • ${
          params.algorithm_learned || "Práctica F2L/OLL/PLL"
        }`;
      }
    } else if (params.domain === "reading") {
      const pages = Math.max(1, params.pages_read || 15);
      const book =
        this.readingBooks.find((b) => b.id === params.book_id) ||
        this.readingBooks[0];
      const gpPerPage = book?.gp_per_page || 100;
      const completionBonusGp = book?.completion_bonus_gp || 5000;
      const sessionBaseXp = book?.xp_per_session || 60;

      baseGp = Math.min(8000, 2500 + pages * gpPerPage);
      baseXp = sessionBaseXp + pages * 2;

      if (book) {
        resolvedBookTitle = book.title;
        const wasCompleted = book.status === "completed";
        book.pages_read = Math.min(book.total_pages, book.pages_read + pages);
        if (book.pages_read >= book.total_pages && !wasCompleted) {
          book.status = "completed";
          baseGp += completionBonusGp;
          baseXp += 150;
          bonusNote = ` • 📚 ¡LIBRO TERMINADO (+${completionBonusGp.toLocaleString("es-CO")} GP Bono)!`;
        }

        // Registrar frases capturadas durante la sesión de lectura sin fricción
        const capturedQuotes: Array<{ text: string; page?: number }> = [
          ...(params.quotes_list || []),
          ...(params.quote_text && params.quote_text.trim()
            ? [{ text: params.quote_text.trim(), page: params.quote_page }]
            : []),
        ];
        if (capturedQuotes.length > 0) {
          if (!book.quotes) book.quotes = [];
          for (const cq of capturedQuotes) {
            const cleanQ = (cq.text || "").trim();
            if (!cleanQ) continue;
            book.quotes.unshift({
              id: `q-${crypto.randomUUID().slice(0, 8)}`,
              text: cleanQ,
              page:
                cq.page && Number(cq.page) > 0
                  ? Math.round(Number(cq.page))
                  : book.pages_read,
              created_at: new Date().toISOString().slice(0, 10),
            });
          }
          const quoteBonusGp = capturedQuotes.length * 250;
          baseGp += quoteBonusGp;
          baseXp += capturedQuotes.length * 15;
          bonusNote += ` • 💬 ${capturedQuotes.length} frase(s) guardada(s) (+${quoteBonusGp} GP)`;
        }

        sessionTitle = params.title || `Lectura: ${book.title}`;
        detailsSummary = `+${pages} págs leídas (${book.pages_read}/${book.total_pages} págs • ${Math.round(
          (book.pages_read / book.total_pages) * 100
        )}%)${bonusNote}`;
      } else {
        sessionTitle = params.title || `Sesión de Lectura (${pages} págs)`;
        detailsSummary = `+${pages} páginas leídas en ${duration} min`;
      }
    } else if (params.domain === "knitting") {
      const rows = Math.max(1, params.rows_completed || 6);
      baseGp = Math.min(8500, 2800 + rows * 200);
      baseXp = 65 + rows * 4;

      const project =
        this.knittingProjects.find((p) => p.id === params.project_id) ||
        this.knittingProjects[0];
      if (project) {
        resolvedProjectName = project.name;
        const wasDone = project.status === "completed";
        project.completed_rows = Math.min(
          project.total_rows_target,
          project.completed_rows + rows
        );
        if (project.completed_rows >= project.total_rows_target && !wasDone) {
          project.status = "completed";
          baseGp += 6000;
          baseXp += 160;
          bonusNote = " • 🧶 ¡PROYECTO TEJIDO COMPLETADO (+6.000 GP Bono)!";
        }
        sessionTitle =
          params.title || `Tejido (${project.technique}): ${project.name}`;
        detailsSummary = `+${rows} filas/vueltas (${project.completed_rows}/${project.total_rows_target} • ${Math.round(
          (project.completed_rows / project.total_rows_target) * 100
        )}%)${
          params.stitches_notes ? ` • ${params.stitches_notes}` : ""
        }${bonusNote}`;
      } else {
        sessionTitle = params.title || `Sesión de Tejido (+${rows} filas)`;
        detailsSummary = `+${rows} filas tejidas en ${duration} min`;
      }
    } else if (params.domain === "study") {
      const subject = params.subject || "Arquitectura de Software & IA";
      const method = params.study_method || "Deep Study 50/10";
      baseGp = Math.min(9000, Math.round(duration * 100));
      baseXp = Math.round(duration * 2.2);
      sessionTitle = params.title || `Estudio (${method}): ${subject}`;
      detailsSummary = `${duration} min de estudio enfocado • Tema: ${subject}`;
    } else if (params.domain === "work") {
      const isProject =
        params.work_mode === "projects" || Boolean(params.project_id);
      const matchedProject = params.project_id
        ? this.workProjects.find((wp) => wp.id === params.project_id)
        : undefined;

      if (matchedProject) {
        resolvedProjectName = matchedProject.name;
        matchedProject.total_minutes_invested =
          (matchedProject.total_minutes_invested || 0) + duration;
        if (params.agile_stage) {
          matchedProject.current_stage = params.agile_stage;
        }
      }

      const deliverable =
        params.deliverable ||
        (matchedProject
          ? `${matchedProject.name} (${matchedProject.current_stage || "En Progreso"})`
          : "Entregable Crítico / Tarea Operativa");
      const impact =
        params.impact_level || (isProject ? "high_impact" : "standard");
      const impactMultiplier =
        impact === "milestone" ? 1.5 : impact === "high_impact" ? 1.25 : 1.0;
      baseGp = Math.min(12000, Math.round(duration * 95 * impactMultiplier));
      baseXp = Math.round(duration * 2.4 * impactMultiplier);

      if (isProject) {
        sessionTitle =
          params.title ||
          `Proyecto Estratégico: ${matchedProject ? matchedProject.name : deliverable}`;
        detailsSummary = `${duration} min en ${
          matchedProject?.methodology?.toUpperCase() ||
          params.agile_methodology?.toUpperCase() ||
          "ÁGIL"
        } • Etapa: ${
          params.agile_stage || matchedProject?.current_stage || "En Progreso"
        } • Impacto: ${impact.toUpperCase()}`;
      } else {
        sessionTitle = params.title || `Actividad Operativa: ${deliverable}`;
        detailsSummary = `${duration} min de ejecución de rutina • ${deliverable}`;
      }
    }

    const rewardResult = this.completeActivity({
      code: `SKILL_${params.domain.toUpperCase()}`,
      title: sessionTitle,
      domain: params.domain,
      requested_gp: baseGp,
      earned_xp: baseXp,
      idempotency_key: params.idempotency_key,
    });

    const record: SkillSessionRecord = {
      id: crypto.randomUUID(),
      domain: params.domain,
      title: sessionTitle,
      duration_minutes: duration,
      gp_earned: rewardResult.transferred_gp,
      xp_earned: baseXp,
      details: detailsSummary,
      metadata: {
        cube_type: params.cube_type,
        cube_id: resolvedCubeId,
        cube_model: resolvedCubeModel,
        best_time_seconds: effectiveSolveSeconds,
        penalty: params.penalty,
        solves_count: params.solves_count,
        algorithm_learned: params.algorithm_learned,
        book_id: params.book_id,
        book_title: resolvedBookTitle,
        pages_read: params.pages_read,
        project_id: params.project_id,
        project_name: resolvedProjectName,
        rows_completed: params.rows_completed,
        stitches_notes: params.stitches_notes,
        subject: params.subject,
        study_method: params.study_method,
        deliverable: params.deliverable,
        impact_level: params.impact_level,
        work_mode: params.work_mode,
        agile_methodology:
          params.agile_methodology ||
          (params.project_id
            ? this.workProjects.find((wp) => wp.id === params.project_id)
                ?.methodology
            : undefined),
        agile_stage: params.agile_stage,
      },
      timestamp: new Date().toISOString(),
    };

    if (!rewardResult.idempotent_replay) {
      this.skillSessions.unshift(record);
    }

    const responsePayload = {
      session: record,
      reward_impact: rewardResult,
      rubik_stats:
        params.domain === "rubik"
          ? this.getRubikStats(params.cube_type || "3x3")
          : undefined,
    };

    if (skillIdemKey) {
      this.processedIdempotencyKeys.set(skillIdemKey, {
        ...responsePayload,
        reward_impact: {
          ...rewardResult,
          idempotent_replay: true,
        },
      });
    }

    return responsePayload;
  }

  // 2. Trigger de Gastos + Escudo Aegis + Control de Presupuestos + Combo Overflow en Cascada
  recordTransaction(params: {
    amount_cop: number;
    category: ExpenseCategory;
    merchant_or_concept: string;
    boss_name?: string | null;
    wishlist_item_id?: string | null;
    use_aegis_shield?: boolean;
    idempotency_key?: string;
  }) {
    if (
      params.idempotency_key &&
      this.processedIdempotencyKeys.has(params.idempotency_key)
    ) {
      return this.processedIdempotencyKeys.get(params.idempotency_key) as {
        wallet_gp_deducted: number;
        penalty_gp_applied: number;
        aegis_shield_used: boolean;
        boss_damage_dealt: number;
        overflow_damage_cop: number;
        combo_summary: string;
        budget_overrun_cop: number;
        idempotent_replay: boolean;
      };
    }

    const baseGp = Math.round(params.amount_cop);
    let walletDeducted = 0;
    let penaltyApplied = 0;
    let shieldUsed = false;
    let bossDamage = 0;
    let overflowDamage = 0;
    let budgetOverrunCop = 0;
    const hitLog: string[] = [];

    if (params.category === "discretionary_unbudgeted") {
      if (this.aegis_shields > 0 && params.use_aegis_shield !== false) {
        // Escudo Aegis absorbe el castigo 0.2x
        walletDeducted = baseGp;
        penaltyApplied = 0;
        shieldUsed = true;
        this.aegis_shields -= 1;
        this.wallet_gp -= walletDeducted;
      } else {
        // Castigo 1.2x implacable + recálculo de streak_multiplier
        walletDeducted = Math.round(params.amount_cop * 1.2);
        penaltyApplied = walletDeducted - baseGp;
        this.wallet_gp -= walletDeducted;
        this.vault_remaining_gp = Math.max(
          0,
          this.vault_remaining_gp - penaltyApplied
        );
        this.total_penalty_gp += penaltyApplied;
        this.current_streak_days = Math.max(0, this.current_streak_days - 1);
        this.recalculateStreakMultiplier();
      }
    } else if (params.category === "discretionary_wishlist") {
      const item = params.wishlist_item_id
        ? this.wishlist.find((w) => w.id === params.wishlist_item_id)
        : undefined;

      const minStreak =
        item?.min_streak_required ??
        (item?.priority === 1 ? 1 : item?.priority === 2 ? 3 : 7);

      if (this.current_streak_days < minStreak) {
        throw new Error(
          `Bloqueo de Tienda: Requiere una racha mínima de ${minStreak} días de hábitos (tu racha actual es de ${this.current_streak_days}d).`
        );
      }

      if (this.wallet_gp < 0) {
        throw new Error(
          "Bloqueo por Maldición OVERDRAWN_CURSE: No puedes redimir deseos mientras tu Billetera esté en saldo negativo. Completa hábitos para sanearla."
        );
      }

      const hasImpulseTax =
        this.wallet_gp < 0 ||
        this.variable_ops_spent_cop > this.variable_ops_budget_cop ||
        this.total_penalty_gp > 0;
      const impulseTaxPct = hasImpulseTax ? 0.2 : 0;
      const baseCost = item ? item.cost_gp : baseGp;
      const effectiveGp = Math.round(baseCost * (1 + impulseTaxPct));

      if (this.wallet_gp < effectiveGp) {
        throw new Error(
          `Saldo insuficiente en Billetera GP. Costo con Impuesto al Impulso (${
            impulseTaxPct * 100
          }%): ${effectiveGp.toLocaleString(
            "es-CO"
          )} GP. Saldo disponible: ${this.wallet_gp.toLocaleString("es-CO")} GP.`
        );
      }

      walletDeducted = effectiveGp;
      this.wallet_gp -= walletDeducted;

      if (item) item.is_redeemed = true;
    } else if (params.category === "fixed_mandatory") {
      this.fixed_costs_spent_cop += baseGp;
      if (this.fixed_costs_spent_cop > this.fixed_costs_budget_cop) {
        budgetOverrunCop =
          this.fixed_costs_spent_cop - this.fixed_costs_budget_cop;
      }
    } else if (params.category === "variable_operational") {
      this.variable_ops_spent_cop += baseGp;
      if (this.variable_ops_spent_cop > this.variable_ops_budget_cop) {
        budgetOverrunCop =
          this.variable_ops_spent_cop - this.variable_ops_budget_cop;
      }
    } else if (params.category === "debt_attack") {
      // COMBO OVERFLOW: Ordena primero el Boss objetivo y luego según la estrategia activa (Snowball vs Avalanche)
      let remainingDamage = params.amount_cop;
      const orderedBosses = [...this.bosses]
        .filter((b) => b.current_hp > 0)
        .sort((a, b) => {
          if (
            params.boss_name &&
            a.name.toLowerCase() === params.boss_name.toLowerCase()
          )
            return -1;
          if (
            params.boss_name &&
            b.name.toLowerCase() === params.boss_name.toLowerCase()
          )
            return 1;
          if (this.debt_strategy === "avalanche") {
            return b.interest_rate_ea - a.interest_rate_ea;
          }
          return a.priority_order - b.priority_order;
        });

      orderedBosses.forEach((boss, idx) => {
        if (remainingDamage <= 0) return;
        const dmg = Math.min(boss.current_hp, remainingDamage);
        boss.current_hp -= dmg;
        boss.paid_this_month_cop += dmg;
        remainingDamage -= dmg;
        bossDamage += dmg;
        if (idx > 0) overflowDamage += dmg;
        if (boss.current_hp <= 0) {
          boss.status = "defeated";
          hitLog.push(
            `${boss.name} DERROTADO (-$${dmg.toLocaleString("es-CO")})`
          );
        } else if (
          boss.status === "enraged" &&
          boss.paid_this_month_cop < boss.min_monthly_payment_cop
        ) {
          boss.status = "enraged";
          hitLog.push(`${boss.name} (-$${dmg.toLocaleString("es-CO")} HP • Sigue Enraged)`);
        } else {
          boss.status = "active";
          hitLog.push(`${boss.name} (-$${dmg.toLocaleString("es-CO")} HP)`);
        }
      });
    }

    const entry: DemoLogEntry = {
      id: crypto.randomUUID(),
      type: "expense",
      title: params.merchant_or_concept,
      subtitle:
        params.category === "discretionary_unbudgeted"
          ? shieldUsed
            ? `🛡️ Escudo Aegis activado: Multa 0.2x bloqueada (Pagaste 1.0x: ${baseGp.toLocaleString("es-CO")} GP)`
            : `🔥 Castigo 1.2x (Base: $${baseGp.toLocaleString("es-CO")} + Multa: ${penaltyApplied.toLocaleString("es-CO")} GP)`
          : params.category === "debt_attack"
          ? `⚔️ Ataque Combo (${this.debt_strategy.toUpperCase()}): ${hitLog.join(" ➔ ")}`
          : `Categoría: ${params.category} ($${baseGp.toLocaleString("es-CO")})${
              budgetOverrunCop > 0
                ? ` • ⚠️ Sobrecosto presupuesto: $${budgetOverrunCop.toLocaleString("es-CO")}`
                : ""
            }`,
      gp_delta: walletDeducted > 0 ? -walletDeducted : 0,
      timestamp: new Date().toISOString(),
    };
    this.logs.unshift(entry);

    const result = {
      wallet_gp_deducted: walletDeducted,
      penalty_gp_applied: penaltyApplied,
      aegis_shield_used: shieldUsed,
      boss_damage_dealt: bossDamage,
      overflow_damage_cop: overflowDamage,
      combo_summary: hitLog.join(" -> "),
      budget_overrun_cop: budgetOverrunCop,
      idempotent_replay: false,
    };

    if (params.idempotency_key) {
      this.processedIdempotencyKeys.set(params.idempotency_key, {
        ...result,
        idempotent_replay: true,
      });
    }

    return result;
  }

  // 2B. Mecánica "Limit Break": Sacrifica GP de la Bóveda/Billetera para atacar directamente a Debt Bosses + Bono XP
  triggerLimitBreak(amountGp: number, idempotency_key?: string) {
    const lbKey = idempotency_key ? `limit_break:${idempotency_key}` : undefined;
    if (lbKey && this.processedIdempotencyKeys.has(lbKey)) {
      return this.processedIdempotencyKeys.get(lbKey) as {
        sacrificed_gp: number;
        from_vault_gp: number;
        from_wallet_gp: number;
        bonus_xp: number;
        boss_impact: ReturnType<RPGEngineMemoryStore["recordTransaction"]>;
        idempotent_replay: boolean;
      };
    }

    const totalAvailable =
      this.vault_remaining_gp + Math.max(0, this.wallet_gp);
    const cleanAmount = Math.min(
      Math.max(10000, Math.round(amountGp)),
      totalAvailable
    );
    if (cleanAmount <= 0) {
      throw new Error(
        "No tienes suficiente GP en Bóveda o Billetera para activar Limit Break."
      );
    }

    // Descuenta primero de la Bóveda disponible y luego de la Billetera
    const fromVault = Math.min(this.vault_remaining_gp, cleanAmount);
    const fromWallet = cleanAmount - fromVault;
    this.vault_remaining_gp -= fromVault;
    this.wallet_gp -= fromWallet;

    const bonusXp = Math.round(cleanAmount / 200);
    this.current_xp += bonusXp;
    this.player_level = Math.max(
      1,
      Math.floor(Math.sqrt(this.current_xp / 100)) + 1
    );

    const txImpact = this.recordTransaction({
      amount_cop: cleanAmount,
      category: "debt_attack",
      merchant_or_concept: `⚡ LIMIT BREAK: Sacrificio de Bóveda contra Deuda (+${bonusXp} XP)`,
    });

    const result = {
      sacrificed_gp: cleanAmount,
      from_vault_gp: fromVault,
      from_wallet_gp: fromWallet,
      bonus_xp: bonusXp,
      boss_impact: txImpact,
      idempotent_replay: false,
    };

    if (lbKey) {
      this.processedIdempotencyKeys.set(lbKey, {
        ...result,
        idempotent_replay: true,
      });
    }

    return result;
  }

  setDebtStrategy(strategy: DebtStrategy) {
    this.debt_strategy = strategy;
    return this.getDebtStrategyComparison();
  }

  // 3. Mecánica Boss Counter-Attack (Interés Mensual + Estado Enraged)
  triggerBossCounterAttack() {
    let totalHealed = 0;
    let enragedCount = 0;

    for (const boss of this.bosses) {
      if (boss.current_hp <= 0) continue;

      const monthlyRate = Math.pow(1 + boss.interest_rate_ea / 100, 1 / 12) - 1;
      const healAmount = Math.round(boss.current_hp * monthlyRate);
      boss.current_hp += healAmount;
      boss.max_hp = Math.max(boss.max_hp, boss.current_hp);
      totalHealed += healAmount;

      if (boss.paid_this_month_cop < boss.min_monthly_payment_cop) {
        boss.status = "enraged";
        enragedCount += 1;
      }
      boss.paid_this_month_cop = 0;
    }

    const vaultLocked = enragedCount * 40000;
    this.vault_remaining_gp = Math.max(0, this.vault_remaining_gp - vaultLocked);

    this.logs.unshift({
      id: crypto.randomUUID(),
      type: "counterattack",
      title: "⚠️ Contraataque Mensual de Bosses (Cierre de Ciclo)",
      subtitle: `Intereses regenerados: +$${totalHealed.toLocaleString("es-CO")} HP • ${enragedCount} Boss(es) Enraged (-${vaultLocked.toLocaleString("es-CO")} GP Bóveda)`,
      gp_delta: -vaultLocked,
      timestamp: new Date().toISOString(),
    });

    return {
      total_interest_healed_cop: totalHealed,
      enraged_bosses_count: enragedCount,
      vault_gp_locked_by_enrage: vaultLocked,
    };
  }

  // Simulador matemático de amortización mensual con interés compuesto (Snowball vs Avalanche)
  private simulateAmortization(strategy: DebtStrategy) {
    const monthlySnowballPower =
      this.monthly_income_cop -
      this.fixed_costs_budget_cop -
      this.variable_ops_budget_cop -
      this.vault_cap_gp; // $512,000 COP base por mes

    const simBosses = this.bosses.map((b) => ({
      name: b.name,
      hp: b.current_hp,
      rate_ea: b.interest_rate_ea,
      min_pay: b.min_monthly_payment_cop,
      priority: b.priority_order,
      status: b.status,
      months_to_kill: 0,
      interest_accrued: 0,
    }));

    const orderFn = (
      a: (typeof simBosses)[number],
      b: (typeof simBosses)[number]
    ) => {
      if (strategy === "avalanche") {
        return b.rate_ea - a.rate_ea;
      }
      return a.priority - b.priority;
    };

    let month = 0;
    const maxMonths = 120;

    while (simBosses.some((b) => b.hp > 0) && month < maxMonths) {
      month += 1;
      let availableBudget = monthlySnowballPower;

      // 1. Capitalizar interés mensual en Bosses vivos
      for (const b of simBosses) {
        if (b.hp <= 0) continue;
        const monthlyRate = Math.pow(1 + b.rate_ea / 100, 1 / 12) - 1;
        const interest = Math.round(b.hp * monthlyRate);
        b.hp += interest;
        b.interest_accrued += interest;
      }

      // 2. Pagar cuota mínima en todos los Bosses vivos
      for (const b of simBosses) {
        if (b.hp <= 0 || availableBudget <= 0) continue;
        const payment = Math.min(b.hp, b.min_pay, availableBudget);
        b.hp -= payment;
        availableBudget -= payment;
        if (b.hp <= 0 && b.months_to_kill === 0) {
          b.months_to_kill = month;
        }
      }

      // 3. Dirigir el excedente (Bola de Nieve / Avalancha) en cascada
      const ordered = [...simBosses].filter((b) => b.hp > 0).sort(orderFn);
      for (const b of ordered) {
        if (availableBudget <= 0) break;
        const extra = Math.min(b.hp, availableBudget);
        b.hp -= extra;
        availableBudget -= extra;
        if (b.hp <= 0 && b.months_to_kill === 0) {
          b.months_to_kill = month;
        }
      }
    }

    // Si algún Boss sigue vivo tras maxMonths, asigna maxMonths en lugar de 0
    for (const b of simBosses) {
      if (b.hp > 0 && b.months_to_kill === 0) {
        b.months_to_kill = maxMonths;
      }
    }

    const totalInterest = simBosses.reduce(
      (acc, b) => acc + b.interest_accrued,
      0
    );

    return {
      bossResults: simBosses,
      totalMonths: month,
      totalInterestCop: totalInterest,
      monthlyPowerCop: monthlySnowballPower,
    };
  }

  // 4. Calculadora Time-To-Kill (TTK) de Deudas con Interés Compuesto Real
  getBossTTKProjections(): BossTTKProjection[] {
    const sim = this.simulateAmortization(this.debt_strategy);
    const baseDate = new Date("2026-11-05T12:00:00Z");

    return [...this.bosses]
      .sort((a, b) =>
        this.debt_strategy === "avalanche"
          ? b.interest_rate_ea - a.interest_rate_ea
          : a.priority_order - b.priority_order
      )
      .map((boss) => {
        if (boss.current_hp <= 0) {
          return {
            name: boss.name,
            current_hp: 0,
            months_to_kill: 0,
            estimated_kill_date: "DERROTADO",
            projected_interest_cop: 0,
            status: boss.status,
          };
        }
        const simBoss = sim.bossResults.find((s) => s.name === boss.name)!;
        const killDate = new Date(baseDate);
        killDate.setMonth(killDate.getMonth() + simBoss.months_to_kill);

        return {
          name: boss.name,
          current_hp: boss.current_hp,
          months_to_kill: simBoss.months_to_kill,
          estimated_kill_date: killDate.toLocaleDateString("es-CO", {
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
          projected_interest_cop: simBoss.interest_accrued,
          status: boss.status,
          cutoff_day: boss.cutoff_day,
          daily_interest_dot_gp: boss.daily_interest_dot_gp,
          days_until_cutoff: boss.days_until_cutoff,
          enrage_timer_active: boss.enrage_timer_active,
          is_purified: boss.is_purified,
        };
      });
  }

  getDebtStrategyComparison(): DebtStrategyComparison {
    const snowballSim = this.simulateAmortization("snowball");
    const avalancheSim = this.simulateAmortization("avalanche");

    return {
      active_strategy: this.debt_strategy,
      monthly_snowball_power_cop: snowballSim.monthlyPowerCop,
      snowball_total_interest_cop: snowballSim.totalInterestCop,
      avalanche_total_interest_cop: avalancheSim.totalInterestCop,
      interest_saved_with_avalanche_cop: Math.max(
        0,
        snowballSim.totalInterestCop - avalancheSim.totalInterestCop
      ),
      snowball_months_total: snowballSim.totalMonths,
      avalanche_months_total: avalancheSim.totalMonths,
    };
  }

  updateFinancialConfig(params: {
    monthly_income_cop?: number;
    fixed_costs_budget_cop?: number;
    variable_ops_budget_cop?: number;
    vault_cap_gp?: number;
  }) {
    if (
      params.monthly_income_cop !== undefined &&
      params.monthly_income_cop >= 100000
    ) {
      this.monthly_income_cop = Math.round(params.monthly_income_cop);
    }
    if (
      params.fixed_costs_budget_cop !== undefined &&
      params.fixed_costs_budget_cop >= 0
    ) {
      this.fixed_costs_budget_cop = Math.round(params.fixed_costs_budget_cop);
    }
    if (
      params.variable_ops_budget_cop !== undefined &&
      params.variable_ops_budget_cop >= 0
    ) {
      this.variable_ops_budget_cop = Math.round(params.variable_ops_budget_cop);
    }
    if (params.vault_cap_gp !== undefined && params.vault_cap_gp >= 10000) {
      const unlockedSoFar = Math.max(
        0,
        this.vault_cap_gp - this.vault_remaining_gp
      );
      this.vault_cap_gp = Math.round(params.vault_cap_gp);
      this.vault_remaining_gp = Math.max(0, this.vault_cap_gp - unlockedSoFar);
    }
  }

  applyOnboarding(payload: OnboardingPayload) {
    if (payload.profession?.trim()) {
      this.profession = payload.profession.trim();
    }
    this.currency = payload.currency || "COP";
    this.timezone = payload.timezone || "America/Bogota";
    this.pay_frequency = payload.pay_frequency || "monthly";
    this.pay_day = Math.min(31, Math.max(1, Math.round(payload.pay_day || 1)));
    this.savings_goal_monthly = Math.max(0, Math.round(payload.savings_goal_monthly || 0));
    this.main_goal = payload.main_goal?.trim() || null;
    this.goal_deadline = payload.goal_deadline?.trim() || null;

    this.fixedCosts = (payload.fixed_costs || []).map((fc, idx) => ({
      id: fc.id || `fc-${idx + 1}`,
      name: fc.name.trim() || `Gasto Fijo ${idx + 1}`,
      amount: Math.max(0, Math.round(Number(fc.amount) || 0)),
      category: fc.category || "hogar",
    }));

    const totalFixed = this.fixedCosts.reduce((acc, fc) => acc + fc.amount, 0);
    this.monthly_income_cop = Math.max(0, Math.round(Number(payload.monthly_income) || 0));
    this.fixed_costs_budget_cop = totalFixed;
    this.fixed_costs_spent_cop = 0;
    this.variable_ops_budget_cop = Math.max(0, Math.round(Number(payload.variable_ops_budget) || 0));
    this.variable_ops_spent_cop = 0;
    this.vault_cap_gp = Math.max(0, Math.round(Number(payload.vault_cap) || 0));
    this.vault_remaining_gp = this.vault_cap_gp;
    this.wallet_gp = 0;
    this.total_penalty_gp = 0;
    this.debt_strategy = payload.debt_strategy === "avalanche" ? "avalanche" : "snowball";

    this.bosses = (payload.bosses || [])
      .filter((b) => b.name && Number(b.total_balance) > 0)
      .map((b, idx) => {
        const bal = Math.round(Number(b.total_balance));
        return {
          id: `boss-${idx + 1}-${Date.now()}`,
          name: b.name.trim(),
          max_hp: bal,
          current_hp: bal,
          interest_rate_ea: Math.max(0, Number(b.interest_rate_ea) || 0),
          min_monthly_payment_cop: Math.max(0, Math.round(Number(b.min_monthly_payment) || 0)),
          paid_this_month_cop: 0,
          priority_order: idx + 1,
          status: "active" as const,
        };
      });

    if (Array.isArray(payload.skills) && payload.skills.length > 0) {
      this.userSkills = payload.skills.map((s) => ({
        domain: s.domain,
        label: s.label,
        weekly_target_minutes: Math.max(15, Math.round(Number(s.weekly_target_minutes) || 120)),
        preferred_session_time: s.preferred_session_time || "noche",
        custom_description: s.custom_description,
      }));
    }

    if (payload.daily_schedule) {
      this.dailySchedule = {
        ...this.dailySchedule,
        ...payload.daily_schedule,
      };
    }

    if (Array.isArray(payload.quests) && payload.quests.length > 0) {
      this.quests = payload.quests
        .filter((q) => q.title && Number(q.reward_gp) > 0)
        .map((q, idx) => ({
          code: q.code || `QUEST_CUSTOM_${idx + 1}`,
          title: q.title.trim(),
          domain: q.domain || "general",
          difficulty: q.difficulty || "medium",
          reward_gp: Math.max(1, Math.round(Number(q.reward_gp))),
          reward_xp: Math.max(10, Math.round(Number(q.reward_xp) || 85)),
        }));
    } else if (Array.isArray(payload.skills) && payload.skills.length > 0) {
      const chosenSet = new Set(this.userSkills.map((s) => s.domain));
      this.quests = this.quests.filter((q) => chosenSet.has(q.domain) || q.domain === "general");
    }

    if (Array.isArray(payload.wishlist) && payload.wishlist.length > 0) {
      this.wishlist = payload.wishlist
        .filter((w) => w.name && Number(w.cost_gp) > 0)
        .map((w, idx) => ({
          id: `wish-${idx + 1}-${Date.now()}`,
          name: w.name.trim(),
          cost_gp: Math.max(1, Math.round(Number(w.cost_gp))),
          priority: Math.min(5, Math.max(1, Math.round(Number(w.priority) || idx + 1))),
          is_redeemed: false,
        }));
    }

    this.onboarding_completed = true;
  }
}

export function createStarterUserMemoryStore(params?: {
  userId?: string;
  monthly_income_cop?: number;
  fixed_costs_budget_cop?: number;
  variable_ops_budget_cop?: number;
  vault_cap_gp?: number;
  onboarding_completed?: boolean;
}): RPGEngineMemoryStore {
  const store = new RPGEngineMemoryStore();
  const uidPrefix = (params?.userId || crypto.randomUUID()).slice(0, 8);
  store.onboarding_completed = params?.onboarding_completed ?? false;
  store.billing_period = new Date().toISOString().slice(0, 7);
  store.monthly_income_cop = Math.max(
    100000,
    Math.round(params?.monthly_income_cop ?? 2000000)
  );
  store.fixed_costs_budget_cop = Math.max(
    0,
    Math.round(params?.fixed_costs_budget_cop ?? 800000)
  );
  store.fixed_costs_spent_cop = 0;
  store.variable_ops_budget_cop = Math.max(
    0,
    Math.round(params?.variable_ops_budget_cop ?? 500000)
  );
  store.variable_ops_spent_cop = 0;
  store.vault_cap_gp = Math.max(
    10000,
    Math.round(params?.vault_cap_gp ?? 350000)
  );
  store.vault_remaining_gp = store.vault_cap_gp;
  store.wallet_gp = 0;
  store.total_penalty_gp = 0;
  store.debt_strategy = "snowball";
  store.player_level = 1;
  store.current_xp = 0;
  store.current_streak_days = 0;
  store.streak_multiplier = 1.0;
  store.aegis_shields = 1;

  store.bosses = [
    {
      id: `boss-${uidPrefix}-nequi`,
      name: "Nequi",
      max_hp: 150000,
      current_hp: 150000,
      interest_rate_ea: 25.0,
      min_monthly_payment_cop: 40000,
      paid_this_month_cop: 0,
      priority_order: 1,
      status: "active",
    },
    {
      id: `boss-${uidPrefix}-addi`,
      name: "ADDI",
      max_hp: 500000,
      current_hp: 500000,
      interest_rate_ea: 28.5,
      min_monthly_payment_cop: 85000,
      paid_this_month_cop: 0,
      priority_order: 2,
      status: "active",
    },
    {
      id: `boss-${uidPrefix}-bancolombia`,
      name: "Bancolombia",
      max_hp: 1200000,
      current_hp: 1200000,
      interest_rate_ea: 24.0,
      min_monthly_payment_cop: 120000,
      paid_this_month_cop: 0,
      priority_order: 3,
      status: "active",
    },
  ];

  store.rubikSolves = [];
  store.rubikCubes = [
    {
      id: `cube-${uidPrefix}-1`,
      ...extractCubeSpecsDeterministic("GAN 356 MagLev 3x3 UV"),
      status: "active_main",
      created_at: new Date().toISOString(),
    },
  ];

  store.readingBooks = [
    {
      ...extractBookSpecsDeterministic("Hábitos Atómicos - James Clear"),
      id: `book-${uidPrefix}-1`,
      title: "Hábitos Atómicos",
      author: "James Clear",
      total_pages: 320,
      pages_read: 0,
      status: "reading",
      category: "Productividad & Hábitos",
    },
  ];

  store.knittingProjects = [
    {
      id: `knit-${uidPrefix}-1`,
      name: "Proyecto Inicial de Tejido & Crochet",
      technique: "Crochet",
      total_rows_target: 50,
      completed_rows: 0,
      yarn_details: "Hilaza algodón • Aguja 3.0mm",
      status: "in_progress",
    },
  ];

  store.skillSessions = [];
  store.wishlist = [
    {
      id: `wish-${uidPrefix}-1`,
      name: "Recompensa Personal Nivel 1",
      cost_gp: 50000,
      priority: 1,
      is_redeemed: false,
    },
    {
      id: `wish-${uidPrefix}-2`,
      name: "Meta de Ahorro / Loot Épico",
      cost_gp: 100000,
      priority: 2,
      is_redeemed: false,
    },
  ];
  store.logs = [];

  return store;
}

const globalForRpg = globalThis as unknown as {
  rpgStoreV3?: RPGEngineMemoryStore;
};
export const demoStore = globalForRpg.rpgStoreV3 ?? new RPGEngineMemoryStore();
if (process.env.NODE_ENV !== "production") globalForRpg.rpgStoreV3 = demoStore;

