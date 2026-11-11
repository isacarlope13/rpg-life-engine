"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Swords,
  Vault,
  Wallet,
  Sparkles,
  CheckCircle2,
  Flame,
  Smartphone,
  Send,
  ShoppingBag,
  TrendingDown,
  Zap,
  Skull,
  Terminal,
  Receipt,
  Bot,
  CalendarClock,
  AlertTriangle,
  Copy,
  Check,
  Box,
  BookOpen,
  Scissors,
  GraduationCap,
  Briefcase,
  Timer,
  Play,
  Pause,
  Clock,
  Square,
  RotateCcw,
  Trophy,
  ArrowRightLeft,
  BookMarked,
  FileText,
  Settings2,
  Settings,
  LogOut,
  LayoutDashboard,
  Save,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Search,
  Command,
  ExternalLink,
  ChevronRight,
  X,
  Edit3,
  Trash2,
  ArrowUp,
  ArrowDown,
  Plus,
  Minus,
  GripVertical,
} from "lucide-react";
import {
  AgileMethodology,
  AgileProjectGenerationAI,
  BookComplexity,
  BookFormat,
  BossTTKProjection,
  CurrencyCode,
  DebtStrategy,
  DebtStrategyComparison,
  ExtractedBookSpecsAI,
  ExtractedCubeSpecsAI,
  FixedCostItem,
  KnittingProject,
  ReadingBook,
  RubikCubeCatalogItem,
  RubikCubeType,
  RubikPenalty,
  RubikSolveEntry,
  SkillDomain,
  SkillDomainSummary,
  SkillSessionRecord,
  TrialCheckpointSnapshot,
  UserSkillConfig,
  WorkProject,
  WorkProjectTask,
  DailyScheduleConfig,
  SpacedRepetitionCard,
  TalentPerk,
  FinancialMovementRecord,
  FocusProfileMode,
  SessionIntelligenceData,
} from "@/types/rpg";
import {
  formatSessionToNotionMarkdown,
  copySessionToNotionClipboard,
  exportSessionsToNotionCsv,
} from "@/lib/exporter";
import {
  computeBioCalendarPlan,
  parseTimeToMinutes,
  formatMinutesToHHMM,
  ScheduledSkillBlock,
} from "@/lib/calendar-planner";
import {
  AnnualProductivityHeatmap,
  WcaPerformanceCurve,
  AmortizationFreedomChart,
  SpacedRepetitionDuelingWidget,
  RpgTalentTreeSection,
  ExportAndNotionHub,
  AgileMethodologyGuideBox,
  AnalyticsOverviewDashboard,
} from "@/components/rpg-advanced-widgets";
import { LookerStudioFinanceDashboard } from "@/components/looker-studio-finance-dashboard";
import { SpotifyAudioHub } from "@/components/spotify-audio-hub";
import { AICommandCenter } from "@/components/ai-command-center";
import { AtelierBuilding } from "@/components/sanctuary/atelier-building";
import { LibreriaBuilding } from "@/components/sanctuary/libreria-building";
import { BibliotecaBuilding } from "@/components/sanctuary/biblioteca-building";
import { ClubPuzzlesBuilding } from "@/components/sanctuary/club-puzzles-building";
import { ObservatorioBuilding } from "@/components/sanctuary/observatorio-building";
import { INITIAL_FINANCIAL_MOVEMENTS } from "@/lib/initial-financial-movements";
import {
  registerServiceWorker,
  processOfflineQueue,
  triggerHaptic,
  queueOfflineAction,
} from "@/lib/offline-sync";
import { SYSTEM_VERSION } from "@/lib/version";

interface Boss {
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

interface Quest {
  code: string;
  title: string;
  domain: SkillDomain;
  difficulty: "easy" | "medium" | "hard";
  reward_gp: number;
  reward_xp: number;
}

interface WishlistItem {
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

interface LogEntry {
  id: string;
  type: string;
  domain?: SkillDomain;
  title: string;
  subtitle: string;
  gp_delta: number;
  timestamp: string;
}

interface RubikStats {
  cube_type: string;
  total_solves: number;
  pb_seconds: number | null;
  ao5_seconds: number | null;
  ao12_seconds: number | null;
  mean_seconds: number | null;
  recent_solves: RubikSolveEntry[];
}

interface EngineState {
  mode: string;
  onboarding_completed?: boolean;
  currency?: CurrencyCode;
  main_goal?: string | null;
  goal_deadline?: string | null;
  savings_goal_monthly?: number;
  fixed_costs?: FixedCostItem[];
  user_skills?: UserSkillConfig[];
  user?: {
    id?: string;
    email?: string;
    display_name?: string;
    character_class?: string;
    shortcut_api_key?: string;
  };
  billing_period: string;
  monthly_income_cop: number;
  fixed_costs_budget_cop: number;
  fixed_costs_spent_cop: number;
  variable_ops_budget_cop: number;
  variable_ops_spent_cop: number;
  vault_cap_gp: number;
  vault_remaining_gp: number;
  wallet_gp: number;
  total_penalty_gp: number;
  debt_strategy: DebtStrategy;
  debt_strategy_comparison: DebtStrategyComparison;
  player_level: number;
  current_xp: number;
  current_streak_days: number;
  streak_multiplier: number;
  aegis_shields: number;
  bosses: Boss[];
  ttk_projections: BossTTKProjection[];
  quests: Quest[];
  skill_summaries: SkillDomainSummary[];
  rubik_stats: RubikStats;
  rubik_stats_by_cube?: Record<RubikCubeType, RubikStats>;
  rubik_cubes?: RubikCubeCatalogItem[];
  next_rubik_scramble: string;
  reading_books: ReadingBook[];
  knitting_projects: KnittingProject[];
  work_projects?: WorkProject[];
  skill_sessions: SkillSessionRecord[];
  wishlist: WishlistItem[];
  logs: LogEntry[];
  trial_checkpoints?: TrialCheckpointSnapshot[];
  daily_schedule?: DailyScheduleConfig;
  spaced_cards?: SpacedRepetitionCard[];
  unlocked_perks?: string[];
  talent_perks?: TalentPerk[];
  financial_movements?: FinancialMovementRecord[];
}

// Campos numéricos del estado: si el backend no los envía, se usa 0 para evitar
// errores tipo "Cannot read properties of undefined (reading 'toLocaleString')".
const NUMERIC_STATE_KEYS = [
  "monthly_income_cop",
  "fixed_costs_budget_cop",
  "fixed_costs_spent_cop",
  "variable_ops_budget_cop",
  "variable_ops_spent_cop",
  "vault_cap_gp",
  "vault_remaining_gp",
  "wallet_gp",
  "total_penalty_gp",
  "player_level",
  "current_xp",
  "current_streak_days",
  "streak_multiplier",
  "aegis_shields",
] as const;

// Campos de lista: si faltan, se usa [] para que .map / .length nunca fallen.
const ARRAY_STATE_KEYS = [
  "bosses",
  "ttk_projections",
  "quests",
  "skill_summaries",
  "user_skills",
  "reading_books",
  "knitting_projects",
  "skill_sessions",
  "wishlist",
  "logs",
] as const;

const EMPTY_RUBIK_STATS: RubikStats = {
  cube_type: "3x3",
  total_solves: 0,
  pb_seconds: null,
  ao5_seconds: null,
  ao12_seconds: null,
  mean_seconds: null,
  recent_solves: [],
};

/** Normaliza la respuesta de /api/state garantizando valores seguros por defecto. */
function normalizeEngineState(raw: Partial<EngineState>): EngineState {
  const data = { ...raw } as Record<string, unknown>;
  for (const key of NUMERIC_STATE_KEYS) {
    const n = Number(data[key]);
    data[key] = Number.isFinite(n) ? n : 0;
  }
  for (const key of ARRAY_STATE_KEYS) {
    if (!Array.isArray(data[key])) data[key] = [];
  }
  data.rubik_stats = {
    ...EMPTY_RUBIK_STATS,
    ...((data.rubik_stats as Partial<RubikStats>) || {}),
  };
  if (!Array.isArray((data.rubik_stats as RubikStats).recent_solves)) {
    (data.rubik_stats as RubikStats).recent_solves = [];
  }
  data.mode = typeof data.mode === "string" ? data.mode : "local_engine";
  data.billing_period =
    typeof data.billing_period === "string" ? data.billing_period : "";
  data.next_rubik_scramble =
    typeof data.next_rubik_scramble === "string" ? data.next_rubik_scramble : "";
  if (!(Number(data.streak_multiplier) > 0)) data.streak_multiplier = 1;
  return data as unknown as EngineState;
}

/** Porcentaje seguro: evita NaN/Infinity cuando el denominador es 0. */
function safePct(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  const pct = Math.round((numerator / denominator) * 100);
  return Number.isFinite(pct) ? pct : 0;
}

export const ALL_SKILL_DOMAINS_PORTAL: Array<{
  domain: SkillDomain;
  label: string;
  tag: string;
  desc: string;
  badge: string;
}> = [
  {
    domain: "rubik",
    label: "Cubos de Rubik",
    tag: "WCA Speedcubing",
    desc: "Cronómetro WCA oficial, scrambles generados, arsenal físico y extractor de ficha técnica de cubos con IA.",
    badge: "🧊 WCA Rubik",
  },
  {
    domain: "reading",
    label: "Sesiones de Lectura",
    tag: "Biblioteca & Citas",
    desc: "Galería de libros, registro de páginas, citas sin fricción y curador con IA.",
    badge: "📖 Lectura",
  },
  {
    domain: "knitting",
    label: "Tejido & Artesanía",
    tag: "Crochet & Telar",
    desc: "Contador de vueltas interactivo, control de puntadas y proyectos activos.",
    badge: "🧶 Tejido",
  },
  {
    domain: "study",
    label: "Estudio & Pomodoro",
    tag: "Deep Study",
    desc: "Pomodoro 25/5, Deep Study 50/10, Active Recall y preparación para exámenes.",
    badge: "🎓 Estudio",
  },
  {
    domain: "work",
    label: "Trabajo Profundo",
    tag: "Deep Work",
    desc: "Sprints de productividad, entregables de alto impacto y multiplicador de GP.",
    badge: "💼 Trabajo",
  },
  {
    domain: "gaming",
    label: "Videojuegos / eSports",
    tag: "Gaming Consciente",
    desc: "Partidas clasificatorias, reto estratégico, límite de tiempo anti-tilt y notas de juego.",
    badge: "🎮 eSports",
  },
  {
    domain: "sports",
    label: "Deporte & Competencia",
    tag: "Fitness & Torneos",
    desc: "Running, gimnasio, fútbol, ciclismo, natación, seguimiento de intensidad y marcas.",
    badge: "🏅 Deporte",
  },
  {
    domain: "journaling",
    label: "Journaling & Reflexión",
    tag: "Reflexión Libre de Culpa",
    desc: "Portal guiado de balance mental, victorias del tablero, introspección e insights tácticos para mañana.",
    badge: "✍️ Journaling",
  },
  {
    domain: "gardening",
    label: "Jardinería Botánica",
    tag: "Huerto & Esquejes",
    desc: "Cuidado botánico consciente, riego, propagación, poda y conexión restaurativa con la naturaleza.",
    badge: "🌱 Jardinería",
  },
  {
    domain: "drawing",
    label: "Dibujo & Ilustración",
    tag: "Sketchbook & Artes",
    desc: "Bocetos libres, técnica de trazo, anatomía, acuarelas y exploración plástica sin perfeccionismo.",
    badge: "🎨 Dibujo",
  },
  {
    domain: "ceramics",
    label: "Cerámica & Modelado",
    tag: "Taller de Arcilla",
    desc: "Modelado manual táctil, piezas escultóricas, texturizado, secado y trabajo sensorial en arcilla.",
    badge: "🏺 Cerámica",
  },
  {
    domain: "hiking",
    label: "Senderismo Urbano",
    tag: "Caminata Consciente",
    desc: "Exploración de la ciudad, pasos activos, despeje mental, observación urbana y desconexión digital.",
    badge: "🥾 Senderismo",
  },
  {
    domain: "cooking",
    label: "Cocina Experimental",
    tag: "Laboratorio Culinario",
    desc: "Recetas creativas de autor, técnicas gastronómicas, emplatado y nutrición consciente.",
    badge: "🍳 Cocina",
  },
];

export const LATERAL_ACTIVITY_BANK: Array<{
  domain: SkillDomain;
  label: string;
  defaultMinutes: number;
  badge: string;
  tag: string;
}> = [
  { domain: "rubik", label: "Cubos de Rubik", defaultMinutes: 30, badge: "🧊", tag: "WCA Solves" },
  { domain: "reading", label: "Lectura Profunda", defaultMinutes: 30, badge: "📖", tag: "Biblioteca" },
  { domain: "knitting", label: "Tejido & Crochet", defaultMinutes: 45, badge: "🧶", tag: "Artesanía" },
  { domain: "journaling", label: "Journaling & Balance", defaultMinutes: 15, badge: "✍️", tag: "Reflexión" },
  { domain: "gardening", label: "Jardinería Botánica", defaultMinutes: 30, badge: "🌱", tag: "Huerto" },
  { domain: "drawing", label: "Dibujo & Ilustración", defaultMinutes: 45, badge: "🎨", tag: "Bocetos" },
  { domain: "ceramics", label: "Cerámica & Arcilla", defaultMinutes: 60, badge: "🏺", tag: "Modelado" },
  { domain: "hiking", label: "Senderismo Urbano", defaultMinutes: 45, badge: "🥾", tag: "Caminata" },
  { domain: "cooking", label: "Cocina Experimental", defaultMinutes: 45, badge: "🍳", tag: "Laboratorio" },
  { domain: "study", label: "Estudio & Pomodoro", defaultMinutes: 50, badge: "🎓", tag: "Deep Study" },
  { domain: "work", label: "Sprint Laboral", defaultMinutes: 60, badge: "💼", tag: "Deep Work" },
  { domain: "sports", label: "Entrenamiento & Gym", defaultMinutes: 60, badge: "🏅", tag: "Fitness" },
];

export function RPGLifeEngineDashboard({
  dedicatedSkillDomain,
}: {
  dedicatedSkillDomain?: SkillDomain;
} = {}) {
  const [state, setState] = useState<EngineState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Pestaña activa del Dashboard Principal (enfoque en Sistema & Datos)
  const [homeActiveTab, setHomeActiveTab] = useState<
    "hub" | "skills" | "analytics" | "calendar" | "debts" | "lab" | "ai_command_center"
  >("hub");

  // Control secundario/opcional de la Arena de Deudas
  const [showDebtArena, setShowDebtArena] = useState(false);
  const [showAgileProjectGuide, setShowAgileProjectGuide] = useState(false);

  // Tabs del Santuario de Habilidades
  const [activeSkillTab, setActiveSkillTab] = useState<SkillDomain>(
    dedicatedSkillDomain || "rubik"
  );

  useEffect(() => {
    if (dedicatedSkillDomain) {
      setActiveSkillTab(dedicatedSkillDomain);
    }
  }, [dedicatedSkillDomain]);

  // UI/UX Minimalista: Command Center, Palette & Paneles Colapsables
  const [isCommandBarOpen, setIsCommandBarOpen] = useState(false);
  const [commandBarSearch, setCommandBarSearch] = useState("");
  const [isHeatmapExpanded, setIsHeatmapExpanded] = useState(false);
  const [isTalentTreeExpanded, setIsTalentTreeExpanded] = useState(false);
  const [isRecentFeedExpanded, setIsRecentFeedExpanded] = useState(true);

  // Atajo de teclado global: Cmd+K / Ctrl+K abre la barra de comandos
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandBarOpen((prev) => !prev);
      } else if (e.key === "Escape" && isCommandBarOpen) {
        setIsCommandBarOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCommandBarOpen]);

  // Estados para el Calendario Biológico (Hora de Levantarse a Hora de Acostarse)
  const [bioWakeUpTime, setBioWakeUpTime] = useState("06:00");
  const [bioSleepTime, setBioSleepTime] = useState("22:30");
  const [bioWeekendWakeUpTime, setBioWeekendWakeUpTime] = useState("08:00");
  const [bioWeekendSleepTime, setBioWeekendSleepTime] = useState("23:30");
  const [bioWorkPattern, setBioWorkPattern] = useState<
    "lun_vie" | "lun_sab" | "flexible"
  >("lun_vie");
  const [bioWorkStart, setBioWorkStart] = useState("08:00");
  const [bioWorkEnd, setBioWorkEnd] = useState("17:30");
  const [bioCommuteMins, setBioCommuteMins] = useState(45);
  const [bioSlotPref, setBioSlotPref] = useState<
    "after_work" | "before_work" | "mixed"
  >("mixed");
  const [bioWeekdayMins, setBioWeekdayMins] = useState(50);
  const [bioWeekendMins, setBioWeekendMins] = useState(90);

  // Estados de Gaming Consciente & eSports
  const [gamingMode, setGamingMode] = useState<
    "ranked" | "practice" | "story"
  >("ranked");
  const [gamingGameName, setGamingGameName] = useState(
    "Competitivo / Clasificatoria"
  );
  const [gamingAntiTiltMinutes, setGamingAntiTiltMinutes] = useState(60);

  // Estados de Deporte & Entrenamiento
  const [sportsCategory, setSportsCategory] = useState<
    "gym" | "running" | "cycling" | "football" | "swimming"
  >("gym");
  const [sportsIntensity, setSportsIntensity] = useState<
    "recuperacion" | "hipertrofia" | "hiit_pr"
  >("hipertrofia");
  const [sportsMetricNote, setSportsMetricNote] = useState(
    "Press Banca 80kg / 5km en 24min"
  );

  const totalActiveDot = useMemo(() => {
    return (state?.bosses || [])
      .filter((b) => b.current_hp > 0 && !b.is_purified)
      .reduce((acc, b) => acc + (b.daily_interest_dot_gp || 0), 0);
  }, [state?.bosses]);

  const bioCalendarPlan = useMemo(() => {
    return computeBioCalendarPlan({
      config: {
        wake_up_time: bioWakeUpTime,
        sleep_time: bioSleepTime,
        weekend_wake_up_time: bioWeekendWakeUpTime,
        weekend_sleep_time: bioWeekendSleepTime,
        work_days_pattern: bioWorkPattern,
        work_start_hour: bioWorkStart,
        work_end_hour: bioWorkEnd,
        commute_and_meals_minutes: bioCommuteMins,
        free_slot_preference: bioSlotPref,
        weekday_free_minutes: bioWeekdayMins,
        weekend_free_minutes: bioWeekendMins,
      },
      skills:
        ((Array.isArray(state?.user_skills)
          ? state.user_skills
          : state?.skill_summaries?.map((s) => ({
              domain: s.domain,
              label: s.label,
              weekly_target_minutes: s.total_minutes || 60,
            }))) as UserSkillConfig[]) || [],
      vaultCap: state?.vault_cap_gp || 400000,
    });
  }, [
    bioWakeUpTime,
    bioSleepTime,
    bioWeekendWakeUpTime,
    bioWeekendSleepTime,
    bioWorkPattern,
    bioWorkStart,
    bioWorkEnd,
    bioCommuteMins,
    bioSlotPref,
    bioWeekdayMins,
    bioWeekendMins,
    state?.user_skills,
    state?.skill_summaries,
    state?.vault_cap_gp,
  ]);

  // =========================================================================
  // ESTADOS Y HANDLERS PARA CALENDARIO DINÁMICO & INTERACTIVO
  // (Edición inline, reordenamiento, DND, Now Marker y botón Completar)
  // =========================================================================
  const [dayOverrides, setDayOverrides] = useState<Record<string, ScheduledSkillBlock[]>>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("rpg_calendar_day_overrides");
        if (stored) return JSON.parse(stored);
      } catch (e) {
        console.error("Error reading rpg_calendar_day_overrides:", e);
      }
    }
    return {};
  });

  const [completedCalendarBlocks, setCompletedCalendarBlocks] = useState<Record<string, boolean>>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("rpg_calendar_completed_blocks");
        if (stored) return JSON.parse(stored);
      } catch (e) {
        console.error("Error reading rpg_calendar_completed_blocks:", e);
      }
    }
    return {};
  });

  const [editingBlock, setEditingBlock] = useState<{
    dayKey: string;
    index: number;
    label: string;
    timeRange: string;
    minutes: number;
    domain: SkillDomain;
    isNew?: boolean;
  } | null>(null);

  const [draggedBlock, setDraggedBlock] = useState<{ dayKey: string; index: number } | null>(null);
  const [calendarToastMsg, setCalendarToastMsg] = useState<string | null>(null);

  // Hora actual del sistema (se recalibra cada 15 segundos para el Now Marker)
  const [currentSystemTime, setCurrentSystemTime] = useState<string>(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setCurrentSystemTime(
        `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
      );
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const currentDayKey = useMemo(() => {
    const map = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];
    return map[new Date().getDay()];
  }, []);

  const getBlocksForDay = (d: { key: string; scheduled: ScheduledSkillBlock[] }): ScheduledSkillBlock[] => {
    if (dayOverrides[d.key] && Array.isArray(dayOverrides[d.key])) {
      return dayOverrides[d.key];
    }
    return d.scheduled || [];
  };

  const isBlockNow = (dayKey: string, timeRange: string): boolean => {
    if (dayKey !== currentDayKey || !timeRange) return false;
    const parts = timeRange.split(/[–-]/).map((s) => s.trim());
    if (parts.length < 2) return false;
    const startMin = parseTimeToMinutes(parts[0], -1);
    const endMin = parseTimeToMinutes(parts[1], -1);
    const nowMin = parseTimeToMinutes(currentSystemTime, -1);
    if (startMin < 0 || endMin < 0 || nowMin < 0) return false;
    return nowMin >= startMin && nowMin < endMin;
  };

  const getBlockProgressNow = (timeRange: string): number => {
    const parts = timeRange.split(/[–-]/).map((s) => s.trim());
    if (parts.length < 2) return 0;
    const startMin = parseTimeToMinutes(parts[0], 0);
    const endMin = parseTimeToMinutes(parts[1], 0);
    const nowMin = parseTimeToMinutes(currentSystemTime, 0);
    if (endMin <= startMin) return 0;
    const pct = ((nowMin - startMin) / (endMin - startMin)) * 100;
    return Math.min(100, Math.max(0, Math.round(pct)));
  };

  const handleAdjustDuration = (dayKey: string, index: number, deltaMinutes: number) => {
    const dayPlan = bioCalendarPlan.days.find((p) => p.key === dayKey);
    if (!dayPlan) return;
    const currentList = [...getBlocksForDay(dayPlan)];
    if (!currentList[index]) return;
    const target = { ...currentList[index] };
    const newMins = Math.max(10, Math.min(180, (target.minutes || 30) + deltaMinutes));
    target.minutes = newMins;
    const parts = target.timeRange.split(/[–-]/).map((s) => s.trim());
    const startMin = parseTimeToMinutes(parts[0], 480);
    const newEndMin = startMin + newMins;
    target.timeRange = `${formatMinutesToHHMM(startMin)} – ${formatMinutesToHHMM(newEndMin)}`;
    currentList[index] = target;

    const newOverrides = { ...dayOverrides, [dayKey]: currentList };
    setDayOverrides(newOverrides);
    if (typeof window !== "undefined") {
      localStorage.setItem("rpg_calendar_day_overrides", JSON.stringify(newOverrides));
    }
    setCalendarToastMsg(`⏱️ Duración de ${target.label} ajustada a ${newMins}m`);
    setTimeout(() => setCalendarToastMsg(null), 3000);
  };

  const handleMoveBlock = (dayKey: string, index: number, direction: "up" | "down") => {
    const dayPlan = bioCalendarPlan.days.find((p) => p.key === dayKey);
    if (!dayPlan) return;
    const currentList = [...getBlocksForDay(dayPlan)];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentList.length) return;

    const itemA = { ...currentList[index] };
    const itemB = { ...currentList[targetIndex] };
    const rangeA = itemA.timeRange;
    const rangeB = itemB.timeRange;
    itemA.timeRange = rangeB;
    itemB.timeRange = rangeA;
    currentList[index] = itemB;
    currentList[targetIndex] = itemA;

    const newOverrides = { ...dayOverrides, [dayKey]: currentList };
    setDayOverrides(newOverrides);
    if (typeof window !== "undefined") {
      localStorage.setItem("rpg_calendar_day_overrides", JSON.stringify(newOverrides));
    }
    setCalendarToastMsg(`↕️ "${itemA.label}" desplazada ${direction === "up" ? "hacia arriba" : "hacia abajo"}`);
    setTimeout(() => setCalendarToastMsg(null), 3000);
  };

  const handleDropBlock = (targetDayKey: string, targetIndex: number) => {
    if (!draggedBlock) return;
    const sourceDayKey = draggedBlock.dayKey;
    const sourceIndex = draggedBlock.index;
    setDraggedBlock(null);

    if (sourceDayKey !== targetDayKey) {
      const sourcePlan = bioCalendarPlan.days.find((p) => p.key === sourceDayKey);
      const targetPlan = bioCalendarPlan.days.find((p) => p.key === targetDayKey);
      if (!sourcePlan || !targetPlan) return;
      const sourceList = [...getBlocksForDay(sourcePlan)];
      const targetList = [...getBlocksForDay(targetPlan)];
      const [movedItem] = sourceList.splice(sourceIndex, 1);
      if (!movedItem) return;
      targetList.splice(targetIndex, 0, movedItem);

      const newOverrides = {
        ...dayOverrides,
        [sourceDayKey]: sourceList,
        [targetDayKey]: targetList,
      };
      setDayOverrides(newOverrides);
      if (typeof window !== "undefined") {
        localStorage.setItem("rpg_calendar_day_overrides", JSON.stringify(newOverrides));
      }
      setCalendarToastMsg(`🔄 "${movedItem.label}" transferida a ${targetDayKey.toUpperCase()}`);
      setTimeout(() => setCalendarToastMsg(null), 3000);
      return;
    }

    const dayPlan = bioCalendarPlan.days.find((p) => p.key === sourceDayKey);
    if (!dayPlan) return;
    const currentList = [...getBlocksForDay(dayPlan)];
    const [movedItem] = currentList.splice(sourceIndex, 1);
    if (!movedItem) return;
    currentList.splice(targetIndex, 0, movedItem);

    const newOverrides = { ...dayOverrides, [sourceDayKey]: currentList };
    setDayOverrides(newOverrides);
    if (typeof window !== "undefined") {
      localStorage.setItem("rpg_calendar_day_overrides", JSON.stringify(newOverrides));
    }
    setCalendarToastMsg(`↕️ "${movedItem.label}" reordenada`);
    setTimeout(() => setCalendarToastMsg(null), 3000);
  };

  const handleCompleteCalendarBlock = async (dayKey: string, block: ScheduledSkillBlock, index: number) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const completionKey = `${dayKey}-${index}-${block.label}-${todayStr}`;

    if (completedCalendarBlocks[completionKey]) {
      const updated = { ...completedCalendarBlocks };
      delete updated[completionKey];
      setCompletedCalendarBlocks(updated);
      if (typeof window !== "undefined") {
        localStorage.setItem("rpg_calendar_completed_blocks", JSON.stringify(updated));
      }
      return;
    }

    const updated = { ...completedCalendarBlocks, [completionKey]: true };
    setCompletedCalendarBlocks(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("rpg_calendar_completed_blocks", JSON.stringify(updated));
    }

    triggerHaptic("success");
    const earnedGp = Math.round((block.minutes || 30) * 50 * (state?.streak_multiplier || 1));
    const earnedXp = Math.round((block.minutes || 30) * 2);
    setCalendarToastMsg(`✨ ¡${block.label} completado! +${earnedGp.toLocaleString("es-CO")} GP y +${earnedXp} XP`);
    setTimeout(() => setCalendarToastMsg(null), 4500);

    try {
      await submitSkillSession({
        domain: block.domain || "study",
        minutes: block.minutes || 30,
        title: `Calendario: ${block.label}`,
        notes: `Completado desde el Calendario Circadiano (${block.timeRange})`,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveEditingBlock = () => {
    if (!editingBlock) return;
    const { dayKey, index, label, timeRange, domain, isNew } = editingBlock;
    const dayPlan = bioCalendarPlan.days.find((p) => p.key === dayKey);
    if (!dayPlan) return;
    const currentList = [...getBlocksForDay(dayPlan)];

    const parts = timeRange.split(/[–-]/).map((s) => s.trim());
    const startMin = parseTimeToMinutes(parts[0], 480);
    const endMin = parseTimeToMinutes(parts[1] || parts[0], startMin + 45);
    const computedMins = Math.max(10, endMin > startMin ? endMin - startMin : 45);
    const normalizedRange = `${formatMinutesToHHMM(startMin)} – ${formatMinutesToHHMM(startMin + computedMins)}`;

    const updatedItem: ScheduledSkillBlock = {
      domain,
      label: label.trim() || "Sesión de Habilidad",
      minutes: computedMins,
      timeRange: normalizedRange,
      period: startMin < 720 ? "manana" : startMin < 1080 ? "tarde" : "noche",
    };

    if (isNew) {
      currentList.push(updatedItem);
    } else {
      currentList[index] = updatedItem;
    }

    const newOverrides = { ...dayOverrides, [dayKey]: currentList };
    setDayOverrides(newOverrides);
    if (typeof window !== "undefined") {
      localStorage.setItem("rpg_calendar_day_overrides", JSON.stringify(newOverrides));
    }
    setEditingBlock(null);
    setCalendarToastMsg(`💾 Bloque "${updatedItem.label}" guardado`);
    setTimeout(() => setCalendarToastMsg(null), 3000);
  };

  const handleDeleteBlock = (dayKey: string, index: number) => {
    const dayPlan = bioCalendarPlan.days.find((p) => p.key === dayKey);
    if (!dayPlan) return;
    const currentList = [...getBlocksForDay(dayPlan)];
    currentList.splice(index, 1);
    const newOverrides = { ...dayOverrides, [dayKey]: currentList };
    setDayOverrides(newOverrides);
    if (typeof window !== "undefined") {
      localStorage.setItem("rpg_calendar_day_overrides", JSON.stringify(newOverrides));
    }
    setEditingBlock(null);
    setCalendarToastMsg(`🗑️ Bloque eliminado`);
    setTimeout(() => setCalendarToastMsg(null), 3000);
  };

  const handleResetDayOverrides = (dayKey: string) => {
    const newOverrides = { ...dayOverrides };
    delete newOverrides[dayKey];
    setDayOverrides(newOverrides);
    if (typeof window !== "undefined") {
      localStorage.setItem("rpg_calendar_day_overrides", JSON.stringify(newOverrides));
    }
    setCalendarToastMsg(`🔄 Horario de ${dayKey.toUpperCase()} restablecido al plan biológico`);
    setTimeout(() => setCalendarToastMsg(null), 3000);
  };

  const handleAddNewBlock = (dayKey: string) => {
    const dayPlan = bioCalendarPlan.days.find((p) => p.key === dayKey);
    if (!dayPlan) return;
    const currentList = getBlocksForDay(dayPlan);
    const lastBlock = currentList[currentList.length - 1];
    let defaultStart = "18:00";
    let defaultEnd = "18:45";
    if (lastBlock && lastBlock.timeRange) {
      const parts = lastBlock.timeRange.split(/[–-]/).map((s) => s.trim());
      if (parts[1]) {
        const lastEndMin = parseTimeToMinutes(parts[1], 1080);
        defaultStart = formatMinutesToHHMM(lastEndMin + 15);
        defaultEnd = formatMinutesToHHMM(lastEndMin + 60);
      }
    }
    setEditingBlock({
      dayKey,
      index: currentList.length,
      label: "Nueva Sesión de Práctica",
      timeRange: `${defaultStart} – ${defaultEnd}`,
      minutes: 45,
      domain: "study",
      isNew: true,
    });
  };

  // =========================================================================
  // ESTADOS Y HANDLERS PARA JOURNALING LIBRE DE CULPA & REFLEXIÓN GUIADA
  // =========================================================================
  const [journalMood, setJournalMood] = useState<string>("enfocado");
  const [journalEnergyRating, setJournalEnergyRating] = useState<number>(4);
  const [journalBoardState, setJournalBoardState] = useState<string>("");
  const [journalMentalBalance, setJournalMentalBalance] = useState<string>("");
  const [journalInsights, setJournalInsights] = useState<string>("");
  const [journalActionPlan, setJournalActionPlan] = useState<string>("");
  const [journalToastMsg, setJournalToastMsg] = useState<string | null>(null);
  const [journalHistory, setJournalHistory] = useState<
    Array<{
      id: string;
      timestamp: string;
      mood: string;
      energy: number;
      boardState: string;
      mentalBalance: string;
      insights: string;
      actionPlan: string;
      xpEarned: number;
      gpEarned: number;
    }>
  >(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("rpg_journal_history");
        if (stored) return JSON.parse(stored);
      } catch (e) {
        console.error("Error reading rpg_journal_history:", e);
      }
    }
    return [
      {
        id: "journal-sample-1",
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        mood: "sereno",
        energy: 4,
        boardState: "Avance significativo en proyectos y sesión de lectura fluida.",
        mentalBalance: "Mente en calma, sin presión por tareas pendientes.",
        insights: "Los bloques de 45 minutos me permiten entrar en zona sin agotarme.",
        actionPlan: "1. Terminar revisión de código; 2. Práctica de Rubik sin cronómetro para disfrutar giros.",
        xpEarned: 100,
        gpEarned: 600,
      },
    ];
  });

  const handleSaveJournalReflection = async () => {
    if (
      !journalBoardState.trim() &&
      !journalMentalBalance.trim() &&
      !journalInsights.trim() &&
      !journalActionPlan.trim()
    ) {
      alert("Por favor completa al menos una de las preguntas de reflexión guiada.");
      return;
    }
    const xpBonus = 100;
    const gpBonus = 600;
    const newEntry = {
      id: `journal-${Date.now()}`,
      timestamp: new Date().toISOString(),
      mood: journalMood,
      energy: journalEnergyRating,
      boardState: journalBoardState.trim(),
      mentalBalance: journalMentalBalance.trim(),
      insights: journalInsights.trim(),
      actionPlan: journalActionPlan.trim(),
      xpEarned: xpBonus,
      gpEarned: gpBonus,
    };
    const updatedHistory = [newEntry, ...journalHistory].slice(0, 30);
    setJournalHistory(updatedHistory);
    if (typeof window !== "undefined") {
      localStorage.setItem("rpg_journal_history", JSON.stringify(updatedHistory));
    }

    triggerHaptic("success");
    setJournalToastMsg(
      "🕊️ ¡Reflexión registrada en tu Santuario Libre de Culpa! +100 XP y +600 GP forjados."
    );
    setTimeout(() => setJournalToastMsg(null), 4500);

    try {
      await submitSkillSession({
        domain: "journaling",
        minutes: 20,
        title: `Journaling (${journalMood}): ${
          journalBoardState.slice(0, 35) || "Reflexión Personal"
        }`,
        notes: `Estado: ${journalBoardState} | Balance: ${journalMentalBalance} | Insights: ${journalInsights} | Plan: ${journalActionPlan}`,
      });
      setJournalBoardState("");
      setJournalMentalBalance("");
      setJournalInsights("");
      setJournalActionPlan("");
    } catch (e) {
      console.error(e);
    }
  };

  // 🎛️ FOCUS PROFILE MODE (Modos de Enfoque Adaptativos)
  const [focusProfileMode, setFocusProfileMode] = useState<FocusProfileMode>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("rpg_focus_profile_mode");
        if (stored && ["global", "work", "study", "santuario"].includes(stored)) {
          return stored as FocusProfileMode;
        }
      } catch (e) {
        console.error("Error reading rpg_focus_profile_mode:", e);
      }
    }
    return "global";
  });

  // 🧠 SESSION INTELLIGENCE MODAL STATE
  const [activeSessionModal, setActiveSessionModal] = useState<{
    isOpen: boolean;
    domain: SkillDomain;
    title: string;
    defaultMinutes?: number;
  } | null>(null);

  const [sessionTimerSeconds, setSessionTimerSeconds] = useState(0);
  const [sessionTimerActive, setSessionTimerActive] = useState(false);
  const [sessionTimerPreset, setSessionTimerPreset] = useState<number>(25);
  const sessionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [sessionNotesText, setSessionNotesText] = useState("");
  const [sessionClarityRating, setSessionClarityRating] = useState(8);
  const [sessionChecklistValues, setSessionChecklistValues] = useState<Record<string, string>>({});
  const [sessionNotionToast, setSessionNotionToast] = useState<string | null>(null);

  const [sessionHistory, setSessionHistory] = useState<SessionIntelligenceData[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("rpg_session_intelligence_history");
        if (stored) return JSON.parse(stored);
      } catch (e) {
        console.error("Error reading rpg_session_intelligence_history:", e);
      }
    }
    return [];
  });

  // Lateral Activity Bank state
  // 🌾 ESTADO Y PERSISTENCIA DEL MODO COZY RPG (Descanso Visual & Santuario)
  const [isCozyActive, setIsCozyActive] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("rpg_is_cozy_active");
        if (stored !== null) return stored === "true";
        const currentHour = new Date().getHours();
        return currentHour >= 21 || currentHour < 7;
      } catch (e) {
        console.error("Error reading rpg_is_cozy_active:", e);
      }
    }
    return false;
  });

  const [isStressAccordionOpen, setIsStressAccordionOpen] = useState<boolean>(false);

  const handleToggleCozyMode = () => {
    setIsCozyActive((prev) => {
      const nextVal = !prev;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("rpg_is_cozy_active", String(nextVal));
        } catch (e) {
          console.error("Error saving rpg_is_cozy_active:", e);
        }
      }
      triggerHaptic("medium");
      return nextVal;
    });
  };

  const [calendarTargetDay, setCalendarTargetDay] = useState<string>(() => {
    const todayIndex = new Date().getDay();
    const map = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    return map[todayIndex] || "Lun";
  });
  const [draggedBankItem, setDraggedBankItem] = useState<{
    domain: SkillDomain;
    label: string;
    defaultMinutes: number;
    badge: string;
  } | null>(null);

  // Live timer tick for Session Intelligence
  useEffect(() => {
    if (sessionTimerActive) {
      sessionTimerRef.current = setInterval(() => {
        setSessionTimerSeconds((s) => s + 1);
      }, 1000);
    } else if (sessionTimerRef.current) {
      clearInterval(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
    return () => {
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }
    };
  }, [sessionTimerActive]);

  const [customSessionTitle, setCustomSessionTitle] = useState(
    "Sesión de Entrenamiento / Práctica Consciente"
  );
  const [customSessionMinutes, setCustomSessionMinutes] = useState(45);

  // Estados de Cubo de Rubik (Cronómetro en vivo + Registro + Penalización WCA + Extractor de Especificaciones)
  const [cubeType, setCubeType] = useState<RubikCubeType>("3x3");
  const [selectedCubeId, setSelectedCubeId] = useState<string>("cube-1");
  const [rubikPenalty, setRubikPenalty] = useState<RubikPenalty>("NONE");
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const [manualSolveSec, setManualSolveSec] = useState("18.45");
  const [rubikAlgInput, setRubikAlgInput] = useState(
    "PLL T-Perm / F2L Lookahead"
  );
  const [cubeSpecQuery, setCubeSpecQuery] = useState(
    "MoYu WeiLong WRM V10 3x3 Ball-Core UV"
  );
  const [extractedCubeSpecs, setExtractedCubeSpecs] =
    useState<ExtractedCubeSpecsAI | null>(null);
  const [extractingCube, setExtractingCube] = useState(false);
  const [cubePricePaid, setCubePricePaid] = useState<number>(85000);
  const [cubePurchaseDate, setCubePurchaseDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [cubeStoreSource, setCubeStoreSource] = useState<string>(
    "Tienda Speedcubing"
  );
  const [recordCubeInTreasury, setRecordCubeInTreasury] = useState(false);

  // Modos de Cubos de Rubik: Speedcubing WCA vs. Estudio & Nuevo Cubo vs. Cuaderno de Notas
  const [rubikSubMode, setRubikSubMode] = useState<"practice" | "study" | "notes">("practice");
  const [rubikStudyFocus, setRubikStudyFocus] = useState<string>("F2L & Lookahead Fluido");
  const [rubikStudyNotes, setRubikStudyNotes] = useState<string>("");
  const [rubikStudyMinutes, setRubikStudyMinutes] = useState<number>(30);

  // Cuaderno de Notas del Cubo (Arsenal Hardware & Setup Log)
  const [cubeTensionNotes, setCubeTensionNotes] = useState<string>("");
  const [cubeLubeNotes, setCubeLubeNotes] = useState<string>("");
  const [cubeMaintenanceNeeds, setCubeMaintenanceNeeds] = useState<string>("");
  const [cubeAlgsToMaster, setCubeAlgsToMaster] = useState<string>("");
  const [cubeGeneralNotes, setCubeGeneralNotes] = useState<string>("");
  const [cubeNotesSuccessMsg, setCubeNotesSuccessMsg] = useState<string | null>(null);

  // Cronómetro Universal en Vivo para Sesiones (Lectura, Tejido, Estudio, Trabajo, Gaming, Deportes, Rubik)
  const [liveTimerDomain, setLiveTimerDomain] = useState<SkillDomain | null>(null);
  const [liveTimerSeconds, setLiveTimerSeconds] = useState<number>(0);
  const [liveTimerPaused, setLiveTimerPaused] = useState<boolean>(false);
  const liveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Estados de Sesiones de Lectura + Extractor de Ficha Técnica + Galería de Libros
  const [selectedBookId, setSelectedBookId] = useState("book-1");
  const [pagesReadInput, setPagesReadInput] = useState(20);
  const [readingMinutesInput, setReadingMinutesInput] = useState(35);
  const [bookSpecQuery, setBookSpecQuery] = useState(
    "Clean Architecture - Robert C. Martin"
  );
  const [extractedBookSpecs, setExtractedBookSpecs] =
    useState<ExtractedBookSpecsAI | null>(null);
  const [extractingBook, setExtractingBook] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState("");
  const [newBookAuthor, setNewBookAuthor] = useState("");
  const [newBookPages, setNewBookPages] = useState(250);
  const [newBookCategory, setNewBookCategory] = useState(
    "Ingeniería de Software & Arquitectura"
  );
  const [newBookIsbn, setNewBookIsbn] = useState("");
  const [newBookComplexity, setNewBookComplexity] =
    useState<BookComplexity>("intermedio");
  const [newBookPricePaid, setNewBookPricePaid] = useState<number>(68000);
  const [newBookPurchaseDate, setNewBookPurchaseDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [newBookStoreSource, setNewBookStoreSource] = useState<string>(
    "Panamericana / Buscalibre"
  );
  const [newBookFormat, setNewBookFormat] = useState<BookFormat>("fisico");
  const [newBookStatus, setNewBookStatus] = useState<
    "reading" | "completed" | "wishlist"
  >("reading");
  const [newBookRating, setNewBookRating] = useState<number>(5);
  const [newBookCoverUrl, setNewBookCoverUrl] = useState<string>("");
  const [newBookSynopsis, setNewBookSynopsis] = useState<string>("");
  const [newBookPersonalReview, setNewBookPersonalReview] =
    useState<string>("");
  const [recordBookInTreasury, setRecordBookInTreasury] = useState(false);
  const [bookGalleryFilter, setBookGalleryFilter] = useState<
    "all" | "reading" | "completed" | "wishlist"
  >("all");
  // Captura ultrarrápida de frases durante sesión de lectura (sin fricción)
  const [quoteTextInput, setQuoteTextInput] = useState<string>("");
  const [quotePageInput, setQuotePageInput] = useState<string>("");
  const [sessionQuotes, setSessionQuotes] = useState<
    Array<{ text: string; page?: number }>
  >([]);
  const [dictatingQuote, setDictatingQuote] = useState(false);

  // Estados de la Bitácora del Periodo de Prueba (Piloto 30 Días) & Corte de Mes
  const [checkpointLabelInput, setCheckpointLabelInput] = useState<string>(
    "Semana 1 — Evaluación del Piloto"
  );
  const [checkpointNotesInput, setCheckpointNotesInput] = useState<string>("");
  const [resetMonthOnCheckpoint, setResetMonthOnCheckpoint] =
    useState<boolean>(false);

  // Estados de Sesiones de Tejido + Creación de Proyecto
  const [selectedKnitId, setSelectedKnitId] = useState("knit-1");
  const [rowsCompletedInput, setRowsCompletedInput] = useState(6);
  const [knittingMinutesInput, setKnittingMinutesInput] = useState(40);
  const [stitchesNotesInput, setStitchesNotesInput] = useState(
    "Aumentos invisibles y punto bajo"
  );
  const [newKnitName, setNewKnitName] = useState("");
  const [newKnitTech, setNewKnitTech] = useState<
    "Crochet" | "Dos Agujas" | "Amigurumi" | "Telar"
  >("Crochet");
  const [newKnitRows, setNewKnitRows] = useState(60);

  // Estados de Sesiones de Estudio
  const [studySubject, setStudySubject] = useState(
    "Arquitectura de Sistemas & PostgreSQL Triggers"
  );
  const [studyMethod, setStudyMethod] = useState<
    "Pomodoro 25/5" | "Deep Study 50/10" | "Active Recall" | "Práctica"
  >("Deep Study 50/10");
  const [studyMinutes, setStudyMinutes] = useState(50);

  // Estados de Sesiones de Trabajo
  const [workDeliverable, setWorkDeliverable] = useState(
    "Implementación Motor Financiero RPG v3.0"
  );
  const [workImpact, setWorkImpact] = useState<
    "standard" | "high_impact" | "milestone"
  >("high_impact");
  const [workMinutes, setWorkMinutes] = useState(90);

  // Estados del Módulo de Trabajo: Proyectos vs Actividades
  const [workViewMode, setWorkViewMode] = useState<"activities" | "projects">(
    "activities"
  );
  const [selectedAgileMethodology, setSelectedAgileMethodology] =
    useState<AgileMethodology>("scrum");
  const [newProjectName, setNewProjectName] = useState("");
  const [operationalTaskTitle, setOperationalTaskTitle] = useState(
    "Procesar OPGs canal mayorista"
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedAgileStage, setSelectedAgileStage] =
    useState<string>("Sprint Backlog");

  // Estados de Gemini AI Project Planner (Skill 9) & Tablero Trello
  const [aiProjectPrompt, setAiProjectPrompt] = useState("");
  const [generatingAiProject, setGeneratingAiProject] = useState(false);
  const [generatedAiPlan, setGeneratedAiPlan] =
    useState<AgileProjectGenerationAI | null>(null);
  const [showAiPlannerModal, setShowAiPlannerModal] = useState(false);
  const [addingCardToStage, setAddingCardToStage] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [newCardDesc, setNewCardDesc] = useState("");
  const [newCardPriority, setNewCardPriority] = useState<
    "low" | "medium" | "high" | "critical"
  >("medium");
  const [newCardMinutes, setNewCardMinutes] = useState(45);

  // Estados del Laboratorio iOS Shortcuts
  const [activeLabTab, setActiveLabTab] = useState<
    "sms_siri" | "receipt_vision" | "ios_widget"
  >("sms_siri");
  const [shortcutInput, setShortcutInput] = useState(
    "Bancolombia: Compraste $32.500 en RAPPI RESTAURANTES con tu T.Debito *4491 el 05/11/2026"
  );
  const [useAegisShield, setUseAegisShield] = useState(true);
  const [receiptTextInput, setReceiptTextInput] = useState(
    "SUPERMERCADOS EXITO COLOMBIA\n1x Pechuga Pollo $28.000\n1x Cubeta Huevos AAA $22.000\n1x Arroz y Verduras $18.000\n1x Six-Pack Cerveza Club Colombia $21.000\n1x Papas Pringles $9.000\nTOTAL: $98.000 COP"
  );

  const [gmBriefing, setGmBriefing] = useState<string>("");
  const [widgetCode, setWidgetCode] = useState<string>("");
  const [copiedWidget, setCopiedWidget] = useState(false);

  const [lastShortcutResponse, setLastShortcutResponse] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const fetchState = async () => {
    let res: Response;
    try {
      res = await fetch("/api/state", { cache: "no-store" });
    } catch {
      setLoadError("No se pudo conectar con el servidor.");
      setLoading(false);
      return;
    }

    // Sin sesión: el backend responde 401 con { error }. Nunca usar eso como estado.
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }

    const json = (await res.json().catch(() => null)) as
      | (Partial<EngineState> & { error?: string })
      | null;
    if (!res.ok || !json || json.error) {
      setLoadError(json?.error || `Error ${res.status} al cargar el estado.`);
      setLoading(false);
      return;
    }

    if (json.onboarding_completed === false) {
      window.location.href = "/onboarding";
      return;
    }

    const data = normalizeEngineState(json);
    setLoadError(null);
    setState(data);

    if (data.daily_schedule) {
      if (data.daily_schedule.wake_up_time) setBioWakeUpTime(data.daily_schedule.wake_up_time);
      if (data.daily_schedule.sleep_time) setBioSleepTime(data.daily_schedule.sleep_time);
      if (data.daily_schedule.weekend_wake_up_time) setBioWeekendWakeUpTime(data.daily_schedule.weekend_wake_up_time);
      if (data.daily_schedule.weekend_sleep_time) setBioWeekendSleepTime(data.daily_schedule.weekend_sleep_time);
      if (data.daily_schedule.work_days_pattern) setBioWorkPattern(data.daily_schedule.work_days_pattern);
      if (data.daily_schedule.work_start_hour) setBioWorkStart(data.daily_schedule.work_start_hour);
      if (data.daily_schedule.work_end_hour) setBioWorkEnd(data.daily_schedule.work_end_hour);
      if (data.daily_schedule.commute_and_meals_minutes != null) setBioCommuteMins(data.daily_schedule.commute_and_meals_minutes);
      if (data.daily_schedule.free_slot_preference) setBioSlotPref(data.daily_schedule.free_slot_preference);
      if (data.daily_schedule.weekday_free_minutes != null) setBioWeekdayMins(data.daily_schedule.weekday_free_minutes);
      if (data.daily_schedule.weekend_free_minutes != null) setBioWeekendMins(data.daily_schedule.weekend_free_minutes);
    }

    if (dedicatedSkillDomain) {
      setActiveSkillTab(dedicatedSkillDomain);
    } else if (
      data.skill_summaries &&
      data.skill_summaries.length > 0 &&
      !data.skill_summaries.some((s) => s.domain === activeSkillTab)
    ) {
      setActiveSkillTab(
        data.skill_summaries[0].domain as SkillDomain
      );
    }
    if (
      data.reading_books &&
      data.reading_books.length > 0 &&
      !data.reading_books.some((b) => b.id === selectedBookId)
    ) {
      setSelectedBookId(data.reading_books[0].id);
    }
    if (
      data.knitting_projects &&
      data.knitting_projects.length > 0 &&
      !data.knitting_projects.some((p) => p.id === selectedKnitId)
    ) {
      setSelectedKnitId(data.knitting_projects[0].id);
    }
    setLoading(false);
  };

  useEffect(() => {
    registerServiceWorker();
    const handleOnline = () => {
      processOfflineQueue((synced) => {
        setOfflineSyncMsg(`🔄 ${synced} acción(es) offline sincronizada(s) con éxito.`);
        setTimeout(() => setOfflineSyncMsg(null), 4000);
        fetchState();
      });
    };
    window.addEventListener("online", handleOnline);
    processOfflineQueue();
    fetchState();
    return () => {
      window.removeEventListener("online", handleOnline);
      if (timerRef.current) clearInterval(timerRef.current);
      if (liveTimerRef.current) clearInterval(liveTimerRef.current);
    };
  }, []);

  // Recuperar Cronómetro Universal de localStorage al iniciar (PWA offline / reload)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedTimerStr = localStorage.getItem("rpg_live_timer_state");
      if (savedTimerStr) {
        const saved = JSON.parse(savedTimerStr);
        if (saved && saved.domain) {
          setLiveTimerDomain(saved.domain);
          if (saved.paused) {
            setLiveTimerPaused(true);
            setLiveTimerSeconds(saved.seconds || 0);
          } else {
            const elapsedSinceStart = Math.floor(
              (Date.now() - (saved.lastTimestamp || Date.now())) / 1000
            );
            setLiveTimerSeconds((saved.seconds || 0) + Math.max(0, elapsedSinceStart));
            setLiveTimerPaused(false);
          }
        }
      }
    } catch {
      // Ignorar error de parsing en localStorage
    }
  }, []);

  // Intervalo del Cronómetro Universal en Vivo
  useEffect(() => {
    if (liveTimerDomain && !liveTimerPaused) {
      liveTimerRef.current = setInterval(() => {
        setLiveTimerSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (liveTimerRef.current) clearInterval(liveTimerRef.current);
    }
    return () => {
      if (liveTimerRef.current) clearInterval(liveTimerRef.current);
    };
  }, [liveTimerDomain, liveTimerPaused]);

  // Sincronizar Cronómetro Universal con localStorage para tolerancia a fallos PWA
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (liveTimerDomain) {
      try {
        localStorage.setItem(
          "rpg_live_timer_state",
          JSON.stringify({
            domain: liveTimerDomain,
            seconds: liveTimerSeconds,
            paused: liveTimerPaused,
            lastTimestamp: Date.now(),
          })
        );
      } catch {
        // Ignorar storage full
      }
    } else {
      try {
        localStorage.removeItem("rpg_live_timer_state");
      } catch {
        // Ignorar
      }
    }
  }, [liveTimerDomain, liveTimerSeconds, liveTimerPaused]);

  // Cargar notas del cubo seleccionado al cambiar de cubo o cargar estado
  useEffect(() => {
    if (!selectedCubeId || !state) return;
    const currentCube = state.rubik_cubes?.find((c) => c.id === selectedCubeId);
    let localSaved: Record<string, string> = {};
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(`rpg_cube_notebook_${selectedCubeId}`);
        if (raw) localSaved = JSON.parse(raw);
      } catch {
        // ignore
      }
    }
    setCubeTensionNotes(
      localSaved.tensions ?? currentCube?.recommended_setup ?? ""
    );
    setCubeLubeNotes(
      localSaved.lubes ?? (currentCube?.turning_feel_and_cutting || "")
    );
    setCubeMaintenanceNeeds(
      localSaved.maintenance_needs ?? (currentCube?.maintenance_needs || "")
    );
    setCubeAlgsToMaster(
      localSaved.algs_to_master ?? (currentCube?.recommended_alg_set || "")
    );
    setCubeGeneralNotes(
      localSaved.custom_notes ?? (currentCube?.custom_notes || currentCube?.pro_cuber_notes || "")
    );
  }, [selectedCubeId, state?.rubik_cubes]);

  const formatStopwatch = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, "0")}:${mins
        .toString()
        .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const startLiveTimer = (domain: SkillDomain) => {
    if (liveTimerDomain === domain && liveTimerPaused) {
      setLiveTimerPaused(false);
      return;
    }
    setLiveTimerDomain(domain);
    setLiveTimerSeconds(0);
    setLiveTimerPaused(false);
  };

  const pauseLiveTimer = () => {
    setLiveTimerPaused(true);
  };

  const resumeLiveTimer = () => {
    setLiveTimerPaused(false);
  };

  const resetLiveTimer = () => {
    if (liveTimerRef.current) clearInterval(liveTimerRef.current);
    setLiveTimerDomain(null);
    setLiveTimerSeconds(0);
    setLiveTimerPaused(false);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("rpg_live_timer_state");
      } catch {
        // Ignorar
      }
    }
  };

  const handleSaveCubeNotebook = async () => {
    if (!selectedCubeId) return;
    const combinedNotes = [
      cubeGeneralNotes.trim(),
      cubeAlgsToMaster.trim() ? `[Casos por dominar]: ${cubeAlgsToMaster.trim()}` : "",
      cubeLubeNotes.trim() ? `[Lubricación]: ${cubeLubeNotes.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const payload = {
      tensions: cubeTensionNotes,
      lubes: cubeLubeNotes,
      maintenance_needs: cubeMaintenanceNeeds,
      algs_to_master: cubeAlgsToMaster,
      custom_notes: cubeGeneralNotes,
    };

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          `rpg_cube_notebook_${selectedCubeId}`,
          JSON.stringify(payload)
        );
      } catch {
        // ignore
      }
    }

    try {
      await submitSkillSession({
        action: "update_cube_notes",
        cube_id: selectedCubeId,
        notes: combinedNotes,
        cube_custom_notes: combinedNotes,
        cube_maintenance_needs: cubeMaintenanceNeeds,
        cube_recommended_setup: cubeTensionNotes,
      });
      setCubeNotesSuccessMsg("¡Notas y mantenimiento del cubo guardados correctamente!");
      setTimeout(() => setCubeNotesSuccessMsg(null), 3500);
    } catch {
      setCubeNotesSuccessMsg("Guardado localmente en tu dispositivo.");
      setTimeout(() => setCubeNotesSuccessMsg(null), 3500);
    }
  };

  const stopAndLogLiveTimer = async (domain: SkillDomain) => {
    const elapsedMinutes = Math.max(1, Math.round(liveTimerSeconds / 60));
    resetLiveTimer();

    if (domain === "reading") {
      setReadingMinutesInput(elapsedMinutes);
      const parsedSinglePage = quotePageInput ? Number(quotePageInput) : undefined;
      await submitSkillSession({
        domain: "reading",
        book_id: selectedBookId,
        pages_read: pagesReadInput,
        duration_minutes: elapsedMinutes,
        quote_text: quoteTextInput.trim() || undefined,
        quote_page:
          parsedSinglePage && parsedSinglePage > 0 ? parsedSinglePage : undefined,
        quotes_list: sessionQuotes.length > 0 ? sessionQuotes : undefined,
      });
      setQuoteTextInput("");
      setQuotePageInput("");
      setSessionQuotes([]);
    } else if (domain === "knitting") {
      setKnittingMinutesInput(elapsedMinutes);
      await submitSkillSession({
        domain: "knitting",
        project_id: selectedKnitId,
        rows_completed: rowsCompletedInput,
        duration_minutes: elapsedMinutes,
        stitches_notes: stitchesNotesInput,
      });
    } else if (domain === "study") {
      setStudyMinutes(elapsedMinutes);
      await submitSkillSession({
        domain: "study",
        subject: studySubject,
        study_method: studyMethod,
        duration_minutes: elapsedMinutes,
      });
    } else if (domain === "work") {
      setWorkMinutes(elapsedMinutes);
      const isProject = workViewMode === "projects";
      const matchedProj = state?.work_projects?.find(
        (p) => p.id === selectedProjectId
      );
      await submitSkillSession({
        domain: "work",
        work_mode: workViewMode,
        project_id: isProject && selectedProjectId ? selectedProjectId : undefined,
        deliverable: isProject
          ? matchedProj?.name || workDeliverable
          : operationalTaskTitle || workDeliverable,
        agile_stage: isProject
          ? selectedAgileStage || matchedProj?.current_stage
          : undefined,
        impact_level: isProject ? "high_impact" : workImpact,
        duration_minutes: elapsedMinutes,
      });
    } else if (domain === "gaming") {
      setGamingAntiTiltMinutes(elapsedMinutes);
      await submitSkillSession({
        domain: "gaming",
        deliverable: customSessionTitle || gamingGameName,
        impact_level: "standard",
        duration_minutes: elapsedMinutes,
      });
    } else if (domain === "sports") {
      setCustomSessionMinutes(elapsedMinutes);
      await submitSkillSession({
        domain: "sports",
        deliverable: customSessionTitle || sportsMetricNote,
        impact_level: "high_impact",
        duration_minutes: elapsedMinutes,
      });
    } else if (domain === "rubik") {
      const activeCube =
        state?.rubik_cubes?.find((c) => c.id === selectedCubeId) ||
        state?.rubik_cubes?.[0];
      await submitSkillSession({
        domain: "rubik",
        cube_type: cubeType,
        cube_id: activeCube?.id,
        cube_model: activeCube?.model_name,
        algorithm_learned: `${rubikStudyFocus}: ${rubikStudyNotes || "Estudio de nuevo cubo y algoritmos"}`,
        duration_minutes: elapsedMinutes,
        title: `Estudio de Cubo (${cubeType}) — ${rubikStudyFocus}`,
      });
    }
  };

  // Control del Cronómetro de Cubo de Rubik
  const toggleRubikTimer = () => {
    if (timerRunning) {
      if (timerRef.current) clearInterval(timerRef.current);
      setTimerRunning(false);
      const finalSec = (Date.now() - startTimeRef.current) / 1000;
      setElapsedMs(Math.round(finalSec * 1000));
      setManualSolveSec(finalSec.toFixed(2));
    } else {
      setElapsedMs(0);
      startTimeRef.current = Date.now();
      setTimerRunning(true);
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTimeRef.current);
      }, 30);
    }
  };

  const resetRubikTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerRunning(false);
    setElapsedMs(0);
  };

  // Registrar Sesión o Acción en el Santuario de Habilidades (Rubik, Lectura, Tejido, Estudio, Trabajo)
  const submitSkillSession = async (payload: Record<string, unknown>) => {
    setSubmitting(true);
    const bodyPayload = {
      idempotency_key: `skill-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 6)}`,
      action: "log_session",
      ...payload,
    };

    if (typeof window !== "undefined" && !navigator.onLine) {
      queueOfflineAction({
        url: "/api/shortcuts/skill-session",
        method: "POST",
        body: bodyPayload,
        description: `Sesión de ${String(payload.domain || "habilidad")}`,
      });
      triggerHaptic("warning");
      alert(
        "📱 Modo Offline Activado: Estás sin conexión a internet. Tu sesión fue almacenada en cola local y se sincronizará automáticamente cuando vuelva internet."
      );
      setSubmitting(false);
      return { success: true, offline: true };
    }

    try {
      const res = await fetch("/api/shortcuts/skill-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });
      const json = await res.json();
      setLastShortcutResponse(JSON.stringify(json, null, 2));
      await fetchState();
      if (json.cube) {
        const addedCube = json.cube as RubikCubeCatalogItem;
        setSelectedCubeId(addedCube.id);
        setCubeType(addedCube.cube_type);
        setExtractedCubeSpecs(addedCube);
        setRubikAlgInput(addedCube.recommended_alg_set);
      }
      if (json.book) {
        const addedBook = json.book as ReadingBook;
        setSelectedBookId(addedBook.id);
        setExtractedBookSpecs(null);
        if (addedBook.recommended_daily_pages) {
          setPagesReadInput(addedBook.recommended_daily_pages);
        }
      }
      return json;
    } catch {
      if (typeof window !== "undefined") {
        queueOfflineAction({
          url: "/api/shortcuts/skill-session",
          method: "POST",
          body: bodyPayload,
          description: `Sesión de ${String(payload.domain || "habilidad")}`,
        });
        triggerHaptic("warning");
        alert(
          "📱 Conexión interrumpida: Tu sesión fue asegurada en el almacenamiento local PWA para sincronización automática."
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const submitCreateWorkProject = async () => {
    if (!newProjectName.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/shortcuts/skill-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_work_project",
          work_project_name: newProjectName.trim(),
          agile_methodology: selectedAgileMethodology,
          agile_stage: selectedAgileStage,
        }),
      });
      const json = await res.json();
      await fetchState();
      setNewProjectName("");
      if (json.project) {
        setSelectedProjectId(json.project.id);
      }
      return json;
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateAiProject = async () => {
    const q = aiProjectPrompt.trim();
    if (!q) return;
    setGeneratingAiProject(true);
    try {
      const res = await fetch("/api/shortcuts/skill-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_ai_project",
          raw_query: q,
        }),
      });
      const json = await res.json();
      if (json.ai_plan) {
        setGeneratedAiPlan(json.ai_plan as AgileProjectGenerationAI);
      }
    } finally {
      setGeneratingAiProject(false);
    }
  };

  const handleImportAiProject = async () => {
    if (!generatedAiPlan) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/shortcuts/skill-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_work_project",
          work_project_name: generatedAiPlan.name,
          work_project_description: generatedAiPlan.description,
          agile_methodology: generatedAiPlan.methodology,
          agile_stage: generatedAiPlan.suggested_stages[0],
          project_tasks: generatedAiPlan.tasks,
        }),
      });
      const json = await res.json();
      await fetchState();
      if (json.project) {
        setSelectedProjectId(json.project.id);
        setSelectedAgileMethodology(json.project.methodology);
        setSelectedAgileStage(json.project.current_stage || "");
      }
      setShowAiPlannerModal(false);
      setGeneratedAiPlan(null);
      setAiProjectPrompt("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddTrelloCard = async (stage: string) => {
    if (!newCardTitle.trim() || !selectedProjectId) return;
    setSubmitting(true);
    try {
      await fetch("/api/shortcuts/skill-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_work_project_task",
          project_id: selectedProjectId,
          task_title: newCardTitle.trim(),
          task_description: newCardDesc.trim() || undefined,
          task_stage: stage,
          task_priority: newCardPriority,
          duration_minutes: newCardMinutes,
        }),
      });
      await fetchState();
      setAddingCardToStage(null);
      setNewCardTitle("");
      setNewCardDesc("");
      setNewCardPriority("medium");
      setNewCardMinutes(45);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMoveTrelloCard = async (taskId: string, targetStage: string) => {
    if (!selectedProjectId || !taskId || !targetStage) return;
    try {
      await fetch("/api/shortcuts/skill-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "move_work_project_task",
          project_id: selectedProjectId,
          task_id: taskId,
          target_stage: targetStage,
        }),
      });
      await fetchState();
    } catch {
      // ignore
    }
  };

  const handleCompleteTrelloCard = async (taskId: string) => {
    if (!selectedProjectId || !taskId) return;
    setSubmitting(true);
    try {
      await fetch("/api/shortcuts/skill-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete_work_project_task",
          project_id: selectedProjectId,
          task_id: taskId,
        }),
      });
      await fetchState();
    } finally {
      setSubmitting(false);
    }
  };

  // Añadir chip de frase rápida a la sesión actual con Enter o botón +
  const addQuoteChipToSession = () => {
    const cleanText = quoteTextInput.trim();
    if (!cleanText) return;
    const parsedPage = quotePageInput ? Number(quotePageInput) : undefined;
    setSessionQuotes((prev) => [
      ...prev,
      {
        text: cleanText,
        page: parsedPage && parsedPage > 0 ? parsedPage : undefined,
      },
    ]);
    setQuoteTextInput("");
    setQuotePageInput("");
  };

  // Dictar frase por voz (manos libres mientras sostienes el libro)
  const startQuoteVoiceDictation = () => {
    if (typeof window === "undefined") return;
    const SpeechRec =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert(
        "Tu navegador no soporta dictado por voz directo. Puedes escribir o usar el micrófono del teclado."
      );
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recognition = new (SpeechRec as any)();
      recognition.lang = "es-CO";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      setDictatingQuote(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const transcript = event?.results?.[0]?.[0]?.transcript || "";
        if (transcript) {
          setQuoteTextInput((prev) =>
            prev ? `${prev} ${transcript.trim()}` : transcript.trim()
          );
        }
        setDictatingQuote(false);
      };
      recognition.onerror = () => setDictatingQuote(false);
      recognition.onend = () => setDictatingQuote(false);
      recognition.start();
    } catch {
      setDictatingQuote(false);
    }
  };

  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleSavedToast, setScheduleSavedToast] = useState(false);

  const jumpToRegisterCube = () => {
    setHomeActiveTab("skills");
    setActiveSkillTab("rubik");
    setTimeout(() => {
      document
        .getElementById("register-cube-section")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
  };

  const jumpToRegisterBook = () => {
    setHomeActiveTab("skills");
    setActiveSkillTab("reading");
    setTimeout(() => {
      document
        .getElementById("register-book-section")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
  };

  const jumpToRegisterProject = () => {
    setHomeActiveTab("skills");
    setActiveSkillTab("work");
    setWorkViewMode("projects");
    setShowAiPlannerModal(true);
    setTimeout(() => {
      document
        .getElementById("work-section-container")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  };

  const handleSetFocusProfileMode = (mode: FocusProfileMode) => {
    setFocusProfileMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("rpg_focus_profile_mode", mode);
    }
    if (mode === "work") {
      setHomeActiveTab("skills");
      setActiveSkillTab("work");
    } else if (mode === "study") {
      setHomeActiveTab("skills");
      setActiveSkillTab("study");
    } else if (mode === "santuario") {
      setHomeActiveTab("skills");
      setActiveSkillTab("journaling");
    }
    triggerHaptic("light");
  };

  const handleOpenSessionModal = (domain: SkillDomain, title: string, defaultMinutes = 25) => {
    setActiveSessionModal({
      isOpen: true,
      domain,
      title,
      defaultMinutes,
    });
    setSessionTimerSeconds(0);
    setSessionTimerActive(false);
    setSessionTimerPreset(defaultMinutes);
    if (typeof window !== "undefined") {
      try {
        const savedNotes = localStorage.getItem(`rpg_session_notes_${domain}`);
        setSessionNotesText(savedNotes || "");
      } catch {
        setSessionNotesText("");
      }
    }
    setSessionChecklistValues({});
    setSessionNotionToast(null);
  };

  const handleCloseSessionModal = () => {
    if (sessionTimerRef.current) {
      clearInterval(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
    setActiveSessionModal(null);
    setSessionTimerActive(false);
  };

  const handleSyncToNotion = async (sessionData: SessionIntelligenceData) => {
    const success = await copySessionToNotionClipboard(sessionData);
    if (success) {
      setSessionNotionToast("📋 ¡Bitácora estructurada copiada con éxito en formato Notion!");
      setTimeout(() => setSessionNotionToast(null), 4000);
    } else {
      setSessionNotionToast("⚠️ No se pudo copiar al portapapeles. Permiso denegado.");
      setTimeout(() => setSessionNotionToast(null), 3000);
    }
  };

  const handleCompleteSessionModal = async () => {
    if (!activeSessionModal) return;
    const elapsedMinutes = Math.max(
      1,
      Math.round(sessionTimerSeconds / 60) || activeSessionModal.defaultMinutes || 25
    );
    const isLegendaryFocus = elapsedMinutes >= 25 && sessionTimerSeconds >= 25 * 60;
    const focusMultiplier = isLegendaryFocus ? 1.25 : 1.0;

    const baseDomainXp: Record<string, number> = {
      study: 120,
      work: 130,
      rubik: 95,
      reading: 100,
      knitting: 85,
      journaling: 100,
      gardening: 90,
      drawing: 95,
      ceramics: 100,
      hiking: 85,
      cooking: 90,
      sports: 110,
      gaming: 75,
      general: 80,
    };
    const baseXp = baseDomainXp[activeSessionModal.domain] || 90;
    const xpEarned = Math.round(baseXp * focusMultiplier);
    const gpEarned = Math.round(500 * focusMultiplier);

    const sessionData: SessionIntelligenceData = {
      id: `session-${Date.now()}`,
      domain: activeSessionModal.domain,
      title: activeSessionModal.title,
      durationMinutes: elapsedMinutes,
      xpEarned,
      gpEarned,
      sessionNotes: sessionNotesText.trim(),
      checklistResults: sessionChecklistValues,
      clarityRating: sessionClarityRating,
      focusMultiplier,
      timestamp: new Date().toISOString(),
    };

    const newHistory = [sessionData, ...sessionHistory].slice(0, 50);
    setSessionHistory(newHistory);
    if (typeof window !== "undefined") {
      localStorage.setItem("rpg_session_intelligence_history", JSON.stringify(newHistory));
      localStorage.removeItem(`rpg_session_notes_${activeSessionModal.domain}`);
    }

    try {
      await submitSkillSession({
        domain: activeSessionModal.domain,
        duration_minutes: elapsedMinutes,
        title: activeSessionModal.title,
        notes: sessionNotesText.trim(),
        clarity_rating: sessionClarityRating,
      });
    } catch (e) {
      console.error("Error submitting session intelligence:", e);
    }

    triggerHaptic("success");
    handleCloseSessionModal();
  };

  const handleAssignFromBank = (
    activity: { domain: SkillDomain; label: string; defaultMinutes: number; badge: string },
    windowType: "morning" | "evening",
    targetDayKey?: string
  ) => {
    const dayKey = targetDayKey || calendarTargetDay;
    const dayPlan = bioCalendarPlan.days.find((d) => d.key === dayKey);
    if (!dayPlan) return;

    let timeRange = "06:30 - 07:15";
    if (windowType === "morning") {
      const wakeMins = parseTimeToMinutes(dayPlan.wakeUpTime, 360);
      const startMins = wakeMins + 15;
      const endMins = Math.min(parseTimeToMinutes(bioWorkStart, 480), startMins + activity.defaultMinutes);
      timeRange = `${formatMinutesToHHMM(startMins)} - ${formatMinutesToHHMM(endMins)}`;
    } else {
      const workEndMins = parseTimeToMinutes(bioWorkEnd, 1050);
      const startMins = workEndMins + 45;
      const endMins = Math.min(parseTimeToMinutes(dayPlan.sleepTime, 1350) - 15, startMins + activity.defaultMinutes);
      timeRange = `${formatMinutesToHHMM(startMins)} - ${formatMinutesToHHMM(endMins)}`;
    }

    const currentBlocks = getBlocksForDay(dayPlan);
    const newBlock: ScheduledSkillBlock = {
      label: activity.label,
      timeRange,
      domain: activity.domain,
      minutes: activity.defaultMinutes,
      period: windowType === "morning" ? "manana" : "noche",
    };

    const updated = [...currentBlocks, newBlock];
    const newOverrides = { ...dayOverrides, [dayKey]: updated };
    setDayOverrides(newOverrides);
    if (typeof window !== "undefined") {
      localStorage.setItem("rpg_calendar_day_overrides", JSON.stringify(newOverrides));
    }
    triggerHaptic("light");
    setCalendarToastMsg(
      `🎯 ¡"${activity.label}" añadida a la ventana de ${windowType === "morning" ? "mañana ☀️" : "noche 🌙"} de ${dayPlan.label}!`
    );
    setTimeout(() => setCalendarToastMsg(null), 4000);
  };

  const handleDropFromBank = (
    dayKey: string,
    activity: { domain: SkillDomain; label: string; defaultMinutes: number }
  ) => {
    handleAssignFromBank({ ...activity, badge: "" }, "evening", dayKey);
    setDraggedBankItem(null);
  };

  const parsedNaturalCommand = useMemo(() => {
    const q = commandBarSearch.trim().toLowerCase();
    if (!q) return null;

    // 1. Reading: "+25 min lectura", "leer 20 paginas", "lectura 30m"
    const readMatch =
      q.match(/(?:\+)?(\d+)\s*(?:min|m|p[aá]g(?:inas?)?)?\s*(?:de\s*)?(?:lectura|leer)/) ||
      q.match(/(?:lectura|leer)\s*(?:\+)?(\d+)/);
    if (readMatch) {
      const mins = parseInt(readMatch[1], 10);
      return {
        type: "reading",
        label: `⚡ Registrar ${mins} min de Lectura Profunda (+${mins * 4} XP)`,
        execute: async () => {
          await submitSkillSession({ domain: "reading", duration_minutes: mins, pages_read: Math.round(mins * 0.75) });
          setIsCommandBarOpen(false);
          setCommandBarSearch("");
        },
      };
    }

    // 2. Expense: "gasto almuerzo 15000", "gasto 5000 cafe", "gasto 25000"
    const expenseMatch =
      q.match(/gasto\s+([a-záéíóúñ\s]+)?\s*(\d+[\d\.,]*)/) ||
      q.match(/gasto\s+(\d+[\d\.,]*)\s*([a-záéíóúñ\s]+)?/);
    if (expenseMatch) {
      const numStr = (expenseMatch[2] || expenseMatch[1] || "0").replace(/\./g, "").replace(/,/g, "");
      const amount = parseInt(numStr, 10);
      const concept = (
        expenseMatch[1] && isNaN(Number(expenseMatch[1]))
          ? expenseMatch[1]
          : expenseMatch[2] || "Gasto Rápido"
      ).trim();
      if (amount > 0) {
        return {
          type: "expense",
          label: `💸 Registrar Gasto de $${amount.toLocaleString("es-CO")} COP ("${concept}")`,
          execute: async () => {
            try {
              await fetch("/api/shortcuts/quick-expense", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  amount_cop: amount,
                  category: concept || "Gasto desde ⌘K",
                  description: `Gasto rápido desde ⌘K: ${concept}`,
                  channel: "command_bar",
                }),
              });
              await fetchState();
            } catch (err) {
              console.error(err);
            }
            setIsCommandBarOpen(false);
            setCommandBarSearch("");
          },
        };
      }
    }

    // 3. Cube: "cubo 18.5", "solve 15.2", "cubo"
    const cubeMatch = q.match(/(?:cubo|solve|rubik)\s*(\d+(?:\.\d+)?)?/);
    if (cubeMatch) {
      const timeSec = cubeMatch[1] ? parseFloat(cubeMatch[1]) : 18.5;
      return {
        type: "rubik",
        label: `🧩 Registrar Solve WCA de ${timeSec}s (+95 XP)`,
        execute: async () => {
          await submitSkillSession({ domain: "rubik", duration_minutes: 5, manual_solve_seconds: timeSec });
          setIsCommandBarOpen(false);
          setCommandBarSearch("");
        },
      };
    }

    // 4. Mode profile: "modo santuario", "modo trabajo", "modo universidad", "modo global"
    const modeMatch = q.match(/modo\s+(santuario|zen|trabajo|laboral|universidad|datos|estudio|global)/);
    if (modeMatch) {
      const rawMode = modeMatch[1];
      const targetMode: FocusProfileMode =
        rawMode === "santuario" || rawMode === "zen"
          ? "santuario"
          : rawMode === "trabajo" || rawMode === "laboral"
          ? "work"
          : rawMode === "universidad" || rawMode === "datos" || rawMode === "estudio"
          ? "study"
          : "global";
      return {
        type: "mode",
        label: `🎛️ Cambiar a Modo de Enfoque: ${targetMode.toUpperCase()}`,
        execute: () => {
          handleSetFocusProfileMode(targetMode);
          setIsCommandBarOpen(false);
          setCommandBarSearch("");
        },
      };
    }

    // 5. Note: "nota [texto]"
    const noteMatch = q.match(/^nota\s+(.+)/);
    if (noteMatch) {
      const noteContent = noteMatch[1].trim();
      return {
        type: "note",
        label: `📝 Guardar Nota Rápida: "${noteContent.slice(0, 40)}..."`,
        execute: () => {
          if (typeof window !== "undefined") {
            try {
              const current = localStorage.getItem("rpg_session_notes_general") || "";
              localStorage.setItem("rpg_session_notes_general", `${current}\n• ${noteContent}`.trim());
            } catch {
              // ignore
            }
          }
          triggerHaptic("success");
          alert("📝 ¡Nota rápida guardada en tu bitácora!");
          setIsCommandBarOpen(false);
          setCommandBarSearch("");
        },
      };
    }

    return null;
  }, [commandBarSearch]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error(e);
    }
    window.location.href = "/login";
  };

  const handleSaveDailySchedule = async () => {
    setScheduleSaving(true);
    try {
      const res = await fetch("/api/shortcuts/skill-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_daily_schedule",
          daily_schedule: {
            wake_up_time: bioWakeUpTime,
            sleep_time: bioSleepTime,
            weekend_wake_up_time: bioWeekendWakeUpTime,
            weekend_sleep_time: bioWeekendSleepTime,
            work_start_hour: bioWorkStart,
            work_end_hour: bioWorkEnd,
            free_slot_preference: bioSlotPref,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setScheduleSavedToast(true);
        setTimeout(() => setScheduleSavedToast(false), 4000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setScheduleSaving(false);
    }
  };

  const [offlineSyncMsg, setOfflineSyncMsg] = useState<string | null>(null);
  const [perkSuccessMsg, setPerkSuccessMsg] = useState<string | null>(null);
  const [backupRestoreMsg, setBackupRestoreMsg] = useState<string | null>(null);

  const handleUnlockTalentPerk = async (perkId: string) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/shortcuts/skill-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unlock_talent_perk",
          perk_id: perkId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        triggerHaptic("success");
        setPerkSuccessMsg(data.message);
        setTimeout(() => setPerkSuccessMsg(null), 4000);
        await fetchState();
      } else {
        triggerHaptic("warning");
        alert(data.message || "No se pudo desbloquear el talento.");
      }
    } catch {
      triggerHaptic("error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewSpacedCard = async (
    cardId: string,
    rating: 1 | 2 | 3 | 4
  ) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/shortcuts/skill-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review_spaced_card",
          card_id: cardId,
          spaced_rating: rating,
        }),
      });
      const data = await res.json();
      if (data.success) {
        triggerHaptic(rating >= 3 ? "success" : "medium");
        await fetchState();
      }
    } catch {
      triggerHaptic("error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddSpacedCard = async (
    prompt: string,
    reflection: string,
    sourceTitle: string
  ) => {
    if (!prompt.trim() || !reflection.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/shortcuts/skill-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_spaced_card",
          front_prompt: prompt.trim(),
          back_reflection: reflection.trim(),
          source_title: sourceTitle.trim() || "Tarjeta Personal",
        }),
      });
      const data = await res.json();
      if (data.success) {
        triggerHaptic("success");
        await fetchState();
      }
    } catch {
      triggerHaptic("error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportBackup = async (file: File) => {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      setSubmitting(true);
      const res = await fetch("/api/shortcuts/skill-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import_backup",
          backup_payload: json,
        }),
      });
      const data = await res.json();
      if (data.success) {
        triggerHaptic("success");
        setBackupRestoreMsg("¡Respaldo maestro importado y sincronizado con éxito!");
        setTimeout(() => setBackupRestoreMsg(null), 4000);
        await fetchState();
      } else {
        alert(data.message || "Error al importar el respaldo.");
      }
    } catch {
      alert("Error procesando el archivo JSON de respaldo.");
    } finally {
      setSubmitting(false);
    }
  };

  const extractCubeSpecsFromInput = async (queryOverride?: string) => {
    const query = (queryOverride ?? cubeSpecQuery).trim();
    if (!query) return;
    setExtractingCube(true);
    try {
      const res = await fetch("/api/shortcuts/skill-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "extract_cube_specs",
          raw_query: query,
        }),
      });
      const json = await res.json();
      if (json.cube_specs) {
        const specs = json.cube_specs as ExtractedCubeSpecsAI;
        setExtractedCubeSpecs(specs);
        if (specs.estimated_market_price_cop) {
          setCubePricePaid(specs.estimated_market_price_cop);
        }
        if (specs.recommended_store) {
          setCubeStoreSource(specs.recommended_store);
        }
      }
      setLastShortcutResponse(JSON.stringify(json, null, 2));
    } finally {
      setExtractingCube(false);
    }
  };

  const extractBookSpecsFromInput = async (queryOverride?: string) => {
    const query = (queryOverride ?? bookSpecQuery).trim();
    if (!query) return;
    setExtractingBook(true);
    try {
      const res = await fetch("/api/shortcuts/skill-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "extract_book_specs",
          raw_query: query,
        }),
      });
      const json = await res.json();
      if (json.book_specs) {
        const specs = json.book_specs as ExtractedBookSpecsAI;
        setExtractedBookSpecs(specs);
        setNewBookTitle(specs.title);
        setNewBookAuthor(specs.author);
        setNewBookPages(specs.total_pages);
        setNewBookCategory(specs.category);
        setNewBookIsbn(specs.isbn);
        setNewBookComplexity(specs.complexity);
        if (specs.synopsis || specs.key_learning_goal) {
          setNewBookSynopsis(specs.synopsis || specs.key_learning_goal);
        }
        if (specs.estimated_market_price_cop) {
          setNewBookPricePaid(specs.estimated_market_price_cop);
        }
        if (specs.recommended_store) {
          setNewBookStoreSource(specs.recommended_store);
        }
        if (specs.famous_quote && !newBookPersonalReview.trim()) {
          setNewBookPersonalReview(specs.famous_quote);
        }
        const cleanDigits = (specs.isbn || "").replace(/[^0-9X]/gi, "");
        if (cleanDigits.length >= 10) {
          setNewBookCoverUrl(
            `https://covers.openlibrary.org/b/isbn/${cleanDigits}-L.jpg`
          );
        }
      }
      setLastShortcutResponse(JSON.stringify(json, null, 2));
    } finally {
      setExtractingBook(false);
    }
  };

  const switchDebtStrategy = async (strategy: DebtStrategy) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/shortcuts/skill-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_debt_strategy",
          debt_strategy: strategy,
        }),
      });
      const json = await res.json();
      setLastShortcutResponse(JSON.stringify(json, null, 2));
      await fetchState();
    } finally {
      setSubmitting(false);
    }
  };

  const triggerLimitBreak = async (amountGp: number) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/shortcuts/skill-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "limit_break",
          limit_break_gp: amountGp,
        }),
      });
      const json = await res.json();
      setLastShortcutResponse(JSON.stringify(json, null, 2));
      await fetchState();
    } finally {
      setSubmitting(false);
    }
  };

  const [wellnessSuccessMsg, setWellnessSuccessMsg] = useState<string | null>(null);

  const handleQuickWellnessAction = async (title: string, xpReward: number, gpReward: number) => {
    triggerHaptic("success");
    try {
      await fetch("/api/shortcuts/skill-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: "reading",
          minutes: 15,
          xp_earned: xpReward,
          gp_earned: gpReward,
          notes: `[🌾 Modo Cozy] Micro-Misión de Bienestar: ${title}`,
          idempotency_key: `cozy-well-${Date.now()}`,
        }),
      });
      setWellnessSuccessMsg(`✨ ¡Paz cultivada! Has completado "${title}" (+${xpReward} XP, +${gpReward} GP).`);
      setTimeout(() => setWellnessSuccessMsg(null), 4000);
      await fetchState();
    } catch (e) {
      console.error("Error logging wellness micro-mission:", e);
      setWellnessSuccessMsg(`✨ Micro-misión "${title}" guardada.`);
      setTimeout(() => setWellnessSuccessMsg(null), 3000);
    }
  };

  const triggerHabitShortcut = async (questCode: string) => {
    setSubmitting(true);
    const bodyPayload = {
      idempotency_key: `ios-hab-${Date.now()}`,
      quest_code: questCode,
      timestamp: new Date().toISOString(),
    };

    if (typeof window !== "undefined" && !navigator.onLine) {
      queueOfflineAction({
        url: "/api/shortcuts/habit-log",
        method: "POST",
        body: bodyPayload,
        description: `Misión de hábito (${questCode})`,
      });
      triggerHaptic("success");
      alert(
        "📱 Misión Guardada Offline: No hay conexión ahora mismo, pero tu hábito fue registrado localmente y se enviará tan pronto vuelvas a tener red."
      );
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/shortcuts/habit-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });
      const json = await res.json();
      setLastShortcutResponse(JSON.stringify(json, null, 2));
      await fetchState();
    } catch {
      if (typeof window !== "undefined") {
        queueOfflineAction({
          url: "/api/shortcuts/habit-log",
          method: "POST",
          body: bodyPayload,
          description: `Misión de hábito (${questCode})`,
        });
        triggerHaptic("warning");
        alert(
          "📱 Misión guardada en cola local: La conexión falló pero tu progreso de racha quedó seguro en tu dispositivo."
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const triggerQuickExpenseShortcut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shortcutInput.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/shortcuts/quick-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotency_key: `ios-exp-${Date.now()}`,
          input_mode: "bank_sms",
          raw_text: shortcutInput,
          use_aegis_shield: useAegisShield,
          timestamp: new Date().toISOString(),
        }),
      });
      const json = await res.json();
      setLastShortcutResponse(JSON.stringify(json, null, 2));
      await fetchState();
    } finally {
      setSubmitting(false);
    }
  };

  const triggerReceiptScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/shortcuts/receipt-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotency_key: `ios-rec-${Date.now()}`,
          receipt_text: receiptTextInput,
          use_aegis_shield: false,
        }),
      });
      const json = await res.json();
      setLastShortcutResponse(JSON.stringify(json, null, 2));
      await fetchState();
    } finally {
      setSubmitting(false);
    }
  };

  const attackBoss = async (bossName: string, amount: number) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/shortcuts/quick-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotency_key: `ios-boss-${Date.now()}`,
          input_mode: "manual",
          manual_override: {
            amount_cop: amount,
            category: "debt_attack",
            merchant_or_concept: `Ataque a Boss ${bossName}`,
            boss_name: bossName,
          },
        }),
      });
      const json = await res.json();
      setLastShortcutResponse(JSON.stringify(json, null, 2));
      await fetchState();
    } finally {
      setSubmitting(false);
    }
  };

  const triggerBossCounterAttack = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/shortcuts/boss-counterattack", {
        method: "POST",
      });
      const json = await res.json();
      setLastShortcutResponse(JSON.stringify(json, null, 2));
      await fetchState();
    } finally {
      setSubmitting(false);
    }
  };

  const summonGameMaster = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/gamemaster/briefing", { method: "POST" });
      const json = await res.json();
      setGmBriefing(json.briefing);
    } finally {
      setSubmitting(false);
    }
  };

  const loadWidgetCode = async () => {
    const res = await fetch("/api/shortcuts/widget-summary");
    const json = await res.json();
    setWidgetCode(json.ios_scriptable_widget_code);
    setLastShortcutResponse(JSON.stringify(json, null, 2));
  };

  const [purifyingBossId, setPurifyingBossId] = useState<string | null>(null);
  const [purifyAmountCop, setPurifyAmountCop] = useState<number>(50000);
  const [purifyUseWalletGp, setPurifyUseWalletGp] = useState<boolean>(false);

  const executePurifyBoss = async (
    bossId: string,
    amountCop?: number,
    useGp: boolean = false
  ) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/shortcuts/skill-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "purify_boss",
          boss_id: bossId,
          amount_cop: amountCop,
          use_wallet_gp: useGp,
          idempotency_key: `purify-${bossId}-${Date.now()}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert(data.error || "No se pudo aplicar la Poción de Purificación.");
      } else {
        setPurifyingBossId(null);
        await fetchState();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al purificar boss.";
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const redeemWishlist = async (item: WishlistItem) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/shortcuts/skill-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "redeem_wishlist",
          wishlist_item_id: item.id,
          idempotency_key: `ios-wish-${Date.now()}`,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        alert(json.error || "No se pudo redimir este deseo.");
      } else {
        setLastShortcutResponse(JSON.stringify(json, null, 2));
        await fetchState();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al redimir deseo.";
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError && !state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090d16] p-6 text-slate-300">
        <div className="max-w-md rounded-2xl border border-rose-500/30 bg-slate-900/70 p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-rose-400" />
          <p className="mt-3 font-semibold text-white">No se pudo cargar tu partida</p>
          <p className="mt-1 text-sm text-slate-400">{loadError}</p>
          <div className="mt-4 flex justify-center gap-3">
            <button
              onClick={() => {
                setLoading(true);
                fetchState();
              }}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              Reintentar
            </button>
            <a
              href="/login"
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-800"
            >
              Iniciar sesión
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0F19] text-slate-300">
        <div className="flex items-center gap-3 text-sm font-mono text-slate-100">
          <Sparkles className="h-5 w-5 animate-spin text-emerald-400" />
          Cargando RPG Life-Engine {SYSTEM_VERSION.version}...
        </div>
      </div>
    );
  }

  const freeCashflowCop =
    state.monthly_income_cop -
    state.fixed_costs_budget_cop -
    state.variable_ops_budget_cop -
    state.vault_cap_gp;

  const vaultUnlockedPct = safePct(
    state.vault_cap_gp - state.vault_remaining_gp,
    state.vault_cap_gp
  );

  const variableOpsPct = Math.min(
    100,
    safePct(state.variable_ops_spent_cop, state.variable_ops_budget_cop)
  );

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ease-in-out ${
        isCozyActive
          ? "bg-[#181614] text-[#EAE4D9]"
          : "bg-[#0B0F19] text-[#F1F5F9]"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {dedicatedSkillDomain ? (
        /* =====================================================================
           PÁGINA DEDICADA DE HABILIDAD (SOLO ESTA HABILIDAD A PANTALLA COMPLETA)
           ===================================================================== */
        <div className="mb-6 rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 p-5 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-700 transition"
              >
                ← Volver al Tablero Principal
              </Link>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  Espacio Dedicado •{" "}
                  {ALL_SKILL_DOMAINS_PORTAL.find(
                    (p) => p.domain === dedicatedSkillDomain
                  )?.tag || "Habilidad"}
                </span>
                <h1 className="text-xl font-extrabold text-white">
                  {ALL_SKILL_DOMAINS_PORTAL.find(
                    (p) => p.domain === dedicatedSkillDomain
                  )?.label || dedicatedSkillDomain}
                </h1>
              </div>
            </div>

            {/* BOTONES PARA CAMBIAR ENTRE PÁGINAS DEDICADAS */}
            <div className="flex flex-wrap items-center gap-1.5">
              {ALL_SKILL_DOMAINS_PORTAL.map((dom) => (
                <Link
                  key={dom.domain}
                  href={`/skills/${dom.domain}`}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                    dedicatedSkillDomain === dom.domain
                      ? "bg-emerald-600 text-white shadow-lg ring-1 ring-emerald-300"
                      : "border border-slate-800 bg-slate-950/80 text-slate-400 hover:text-white hover:border-slate-700"
                  }`}
                >
                  {dom.badge}
                </Link>
              ))}
            </div>

            {/* STATS DEL JUGADOR */}
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-300">
                LVL{" "}
                {state.skill_summaries.find(
                  (s) => s.domain === dedicatedSkillDomain
                )?.level || state.player_level}
              </span>
              <span className="rounded-lg bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-300">
                🪙 {state.wallet_gp.toLocaleString("es-CO")} GP
              </span>
              <span className="rounded-lg bg-rose-500/15 px-2.5 py-1 text-xs font-bold text-rose-400">
                🔥 Racha {state.current_streak_days}d
              </span>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {
              ALL_SKILL_DOMAINS_PORTAL.find(
                (p) => p.domain === dedicatedSkillDomain
              )?.desc
            }
          </p>
        </div>
      ) : (
        <>
          {/* MINIMALIST COMMAND CENTER HEADER (Linear / Notion Inspired & Cozy Soft Earth Adaptive) */}
          <header className={`sticky top-2 z-40 mb-5 rounded-2xl p-3 sm:p-4 backdrop-blur-md transition-all duration-300 ${
            isCozyActive
              ? "border border-[#4A3C31]/50 bg-[#221F1C]/85 shadow-md text-[#EAE4D9]"
              : "border border-white/5 bg-[#131B2E]/75 shadow-xl text-slate-100"
          }`}>
            {/* Top Row: Brand, Character Info & Actions */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 rounded-full transition-colors duration-300 ${
                      isCozyActive
                        ? "bg-[#88A98E]"
                        : "bg-emerald-400 animate-pulse"
                    }`}
                  />
                  <span className="font-mono text-xs font-black tracking-wider text-slate-100">
                    RPG LIFE-ENGINE
                  </span>
                  <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-500/30">
                    v{SYSTEM_VERSION.version}
                  </span>
                </div>

                <div className="hidden sm:block h-3.5 w-px bg-white/10" />

                <div className="flex items-center gap-1.5 text-xs text-slate-300">
                  <span className="font-semibold text-white">
                    {state.user?.display_name || "Comandante"}
                  </span>
                  <span className="text-slate-500">•</span>
                  <span className="text-indigo-300 font-medium">
                    {state.user?.character_class || "Estratega"}
                  </span>
                  <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-indigo-400 ring-1 ring-indigo-500/20">
                    NVL {state.player_level}
                  </span>
                </div>

                <div className="hidden md:block h-3.5 w-px bg-white/10" />

                {/* MODOS DE ENFOQUE ADAPTATIVOS (Profiles / Módulos de Contexto) */}
                <div className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-slate-900/90 p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleSetFocusProfileMode("global")}
                    className={`rounded-lg px-2 py-0.5 font-bold transition cursor-pointer ${
                      focusProfileMode === "global"
                        ? "bg-slate-800 text-white shadow-sm ring-1 ring-white/20"
                        : "text-slate-400 hover:text-white"
                    }`}
                    title="Vista global sin filtros de contexto"
                  >
                    🌐 Global
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetFocusProfileMode("work")}
                    className={`rounded-lg px-2 py-0.5 font-bold transition cursor-pointer ${
                      focusProfileMode === "work"
                        ? "bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400"
                        : "text-slate-400 hover:text-white"
                    }`}
                    title="Modo Laboral / HP: Proyectos y Metodologías Ágiles"
                  >
                    💼 Laboral
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetFocusProfileMode("study")}
                    className={`rounded-lg px-2 py-0.5 font-bold transition cursor-pointer ${
                      focusProfileMode === "study"
                        ? "bg-purple-600 text-white shadow-sm ring-1 ring-purple-400"
                        : "text-slate-400 hover:text-white"
                    }`}
                    title="Modo Universidad & Datos: Estudio y Flashcards SM-2"
                  >
                    🎓 Datos
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetFocusProfileMode("santuario")}
                    className={`rounded-lg px-2 py-0.5 font-bold transition cursor-pointer ${
                      focusProfileMode === "santuario"
                        ? "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400"
                        : "text-slate-400 hover:text-white"
                    }`}
                    title="Modo Santuario & Zen: Desconexión, Arte y Bienestar Libre de Culpa"
                  >
                    🌿 Santuario
                  </button>
                </div>
              </div>

              {/* Action Buttons & Command Trigger */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setIsCommandBarOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 font-bold text-emerald-300 hover:bg-emerald-500/25 transition cursor-pointer shadow-sm"
                  title="Abrir Paleta de Comandos (⌘K / Ctrl+K)"
                >
                  <Command className="h-3.5 w-3.5" />
                  <span>Acciones</span>
                  <kbd className="hidden sm:inline-block rounded bg-emerald-950/60 px-1 py-0.2 text-[9px] font-mono text-emerald-400">⌘K</kbd>
                </button>

                <button
                  type="button"
                  onClick={summonGameMaster}
                  disabled={submitting}
                  className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition cursor-pointer disabled:opacity-50"
                  title="Generar Briefing Táctico con IA"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">IA Briefing</span>
                </button>

                <a
                  href="/quick"
                  className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-700 transition"
                  title="Modo Celular 5s & Atajos iOS"
                >
                  <Smartphone className="h-3.5 w-3.5 text-cyan-400" />
                  <span className="hidden md:inline">Móvil 5s</span>
                </a>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleToggleCozyMode}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                      isCozyActive
                        ? "border border-[#88A98E]/60 bg-[#88A98E]/25 text-[#D8E6DA] shadow-sm ring-1 ring-[#88A98E]/40"
                        : "border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                    }`}
                    title={
                      isCozyActive
                        ? "Modo Cozy Activo (Descanso Visual & Tonos Tierra) — Clic para modo estándar"
                        : "Activar Modo Cozy RPG (Descanso Visual, Tonos Tierra & Santuario)"
                    }
                  >
                    <span>🌾</span>
                    <span className="font-bold">
                      {isCozyActive ? "Modo Cozy Activo ✨" : "Modo Cozy RPG"}
                    </span>
                  </button>
                  <a
                    href="/cozy"
                    className={`rounded-lg p-1.5 transition ${
                      isCozyActive
                        ? "text-[#88A98E] hover:text-[#EAE4D9] hover:bg-[#4A3C31]/40"
                        : "text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10"
                    }`}
                    title="Abrir Tablero Cozy Oakhaven dedicado"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>

                <a
                  href="/onboarding"
                  className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-700 transition"
                  title="Configurar Variables y Reglas"
                >
                  <Settings className="h-3.5 w-3.5 text-slate-400" />
                </a>

                <a
                  href="/privacidad"
                  target="_blank"
                  className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-700 transition"
                  title="Política de Tratamiento de Datos Personales"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                </a>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-1 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition cursor-pointer"
                  title="Cerrar sesión"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Bottom Row: Ultra-Compact Scannable HUD */}
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {/* Metric 1: Billetera GP */}
              <div className={`rounded-xl border p-2.5 backdrop-blur-sm shadow-sm transition ${
                state.wallet_gp < 0
                  ? "border-rose-500/30 bg-rose-950/20"
                  : "border-white/5 bg-[#0B0F19]/60 hover:border-white/10"
              }`}>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Billetera GP</span>
                  <Wallet className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className={`font-mono text-lg font-black tracking-tight ${
                    state.wallet_gp < 0 ? "text-rose-400" : "text-slate-100"
                  }`}>
                    {(state.wallet_gp ?? 0).toLocaleString("es-CO")}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">GP</span>
                </div>
                <div className="mt-0.5 text-[10px] text-slate-400">
                  {state.wallet_gp < 0 ? (
                    <span className="text-rose-400 font-bold">⚠️ Overdrawn</span>
                  ) : (
                    <span className="text-emerald-400/90 font-medium">🛡️ {state.aegis_shields} Aegis</span>
                  )}
                </div>
              </div>

              {/* Metric 2: Bóveda Mensual */}
              <div className="rounded-xl border border-white/5 bg-[#0B0F19]/60 p-2.5 backdrop-blur-sm shadow-sm transition hover:border-white/10">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Bóveda Mensual</span>
                  <Vault className="h-3.5 w-3.5 text-indigo-400" />
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="font-mono text-lg font-black tracking-tight text-indigo-200">
                    {(state.vault_remaining_gp ?? 0).toLocaleString("es-CO")}
                  </span>
                  <span className="text-[10px] text-indigo-400 font-bold">GP</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">{vaultUnlockedPct}% lib.</span>
                  <button
                    disabled={submitting}
                    onClick={() => {
                      if (state.vault_remaining_gp < 10000) {
                        alert("Requiere al menos 10,000 GP en tu Bóveda.");
                        return;
                      }
                      triggerLimitBreak(50000);
                    }}
                    className="text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer"
                    title="Limit Break (-50k GP a Deuda)"
                  >
                    ⚡ Limit Break
                  </button>
                </div>
              </div>

              {/* Metric 3: Racha de Hábitos con Buff de Gracia */}
              <div
                className={`rounded-xl border p-2.5 backdrop-blur-sm shadow-sm transition ${
                  isCozyActive
                    ? "border-[#88A98E]/40 bg-[#25201C]/60 text-[#EAE4D9]"
                    : "border-white/5 bg-[#0B0F19]/60 hover:border-white/10"
                }`}
              >
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Racha Hábitos</span>
                  {isCozyActive ? (
                    <span className="text-xs" title="Buff de Gracia Activo: Racha protegida">🛡️</span>
                  ) : (
                    <Flame className="h-3.5 w-3.5 text-amber-400" />
                  )}
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span
                    className={`font-mono text-lg font-black tracking-tight ${
                      isCozyActive ? "text-[#E9C46A]" : "text-amber-300"
                    }`}
                  >
                    {state.current_streak_days}
                  </span>
                  <span className={`text-[10px] font-bold ${isCozyActive ? "text-[#88A98E]" : "text-amber-400"}`}>
                    días
                  </span>
                </div>
                <div className="mt-0.5 text-[10px] font-semibold">
                  {isCozyActive ? (
                    <span className="text-[#88A98E] font-bold">
                      🛡️ Buff de Gracia (1.1x seguro)
                    </span>
                  ) : (
                    <span className="text-amber-400/90">
                      Buff {state.streak_multiplier}x GP
                    </span>
                  )}
                </div>
              </div>

              {/* Metric 4: Flujo Libre Bola de Nieve */}
              <div className="rounded-xl border border-white/5 bg-[#0B0F19]/60 p-2.5 backdrop-blur-sm shadow-sm transition hover:border-white/10">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Poder Nieve</span>
                  <span className="text-cyan-400 text-xs">❄️</span>
                </div>
                <div className="mt-1 flex items-baseline gap-1 truncate">
                  <span className="font-mono text-sm font-black text-cyan-300 truncate">
                    ${freeCashflowCop.toLocaleString("es-CO")}
                  </span>
                </div>
                <div className="mt-0.5 text-[10px] text-slate-400 truncate">
                  Fijos: ${(state.fixed_costs_budget_cop ?? 0).toLocaleString("es-CO")}
                </div>
              </div>

              {/* Metric 5: Variables Operativos */}
              <div className="rounded-xl border border-white/5 bg-[#0B0F19]/60 p-2.5 backdrop-blur-sm shadow-sm transition hover:border-white/10">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Presupuesto Ops</span>
                  <span className="text-slate-400 text-[10px]">{variableOpsPct}%</span>
                </div>
                <div className="mt-1 flex items-baseline gap-1 truncate">
                  <span className="font-mono text-sm font-bold text-slate-100 truncate">
                    ${(state.variable_ops_spent_cop ?? 0).toLocaleString("es-CO")}
                  </span>
                </div>
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full ${
                      state.variable_ops_spent_cop > state.variable_ops_budget_cop
                        ? "bg-rose-500"
                        : "bg-emerald-500"
                    }`}
                    style={{ width: `${variableOpsPct}%` }}
                  />
                </div>
              </div>

              {/* Metric 6: Estado de los Debt Bosses & DoT Pasivo */}
              {isCozyActive ? (
                <div className="rounded-xl border border-[#4A3C31]/50 bg-[#25201C]/70 p-2.5 backdrop-blur-sm shadow-sm transition">
                  <div className="flex items-center justify-between text-[11px] text-[#C9BEAE]">
                    <span>Refugio Financiero</span>
                    <span className="text-xs" title="Modo Cozy: Sin alertas rojas">🕊️</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-xs font-bold text-[#88A98E]">
                      Apaciguado
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsStressAccordionOpen((prev) => !prev)}
                      className="text-[10px] text-[#A69B8D] underline hover:text-[#EAE4D9] cursor-pointer"
                    >
                      {isStressAccordionOpen ? "Ocultar" : "Detalles"}
                    </button>
                  </div>
                  <div className="mt-0.5 text-[10px] text-[#A69B8D] truncate">
                    {isStressAccordionOpen ? (
                      <span className="text-[#E9C46A]">
                        DoT pausado: -{totalActiveDot} GP/d
                      </span>
                    ) : (
                      <span>Presión silenciada</span>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className={`rounded-xl border p-2.5 backdrop-blur-sm shadow-sm transition ${
                    totalActiveDot > 0
                      ? "border-rose-500/30 bg-rose-950/20"
                      : "border-white/5 bg-[#0B0F19]/60 hover:border-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Debt Bosses & DoT</span>
                    <Skull
                      className={`h-3.5 w-3.5 ${
                        totalActiveDot > 0
                          ? "text-rose-400 animate-pulse"
                          : "text-emerald-400"
                      }`}
                    />
                  </div>
                  {totalActiveDot > 0 ? (
                    <>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="font-mono text-base font-black text-rose-400">
                          -{totalActiveDot.toLocaleString("es-CO")}
                        </span>
                        <span className="text-[10px] text-rose-400 font-bold">
                          GP/d
                        </span>
                      </div>
                      <div className="mt-0.5 text-[10px] text-rose-300 font-semibold truncate">
                        {(state.bosses || []).filter(
                          (b) => b.current_hp > 0 && !b.is_purified
                        ).length}{" "}
                        Boss(es) en combate
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="font-mono text-base font-black text-emerald-300">
                          0 DoT
                        </span>
                        <span className="text-[10px] text-emerald-400 font-bold">
                          En Paz
                        </span>
                      </div>
                      <div className="mt-0.5 text-[10px] text-slate-400 font-semibold truncate">
                        {(state.bosses || []).filter(
                          (b) => b.is_purified || b.current_hp <= 0
                        ).length}{" "}
                        Purificados • Sin sangrado
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Acordeón Secundario Colapsable de Deudas & DoT (Solo cuando se expande en Cozy Mode) */}
            {isCozyActive && isStressAccordionOpen && (
              <div className="mt-3 rounded-xl border border-[#4A3C31]/50 bg-[#25201C]/80 p-3 text-xs text-[#C9BEAE] transition-all">
                <div className="flex items-center justify-between font-bold text-[#EAE4D9] mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <span>📜</span>
                    <span>Registro Protegido de Obligaciones (DoT Pasivo: -{totalActiveDot.toLocaleString("es-CO")} GP/d)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsStressAccordionOpen(false)}
                    className="text-[#A69B8D] hover:text-white cursor-pointer text-xs"
                  >
                    ✕ Cerrar
                  </button>
                </div>
                <p className="text-[11px] text-[#A69B8D] leading-relaxed">
                  Las penalizaciones y alertas rojas están pausadas en Modo Cozy. La deuda no interfiere con tus hábitos de bienestar de hoy.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(state.bosses || []).filter((b) => b.current_hp > 0 && !b.is_purified).map((boss) => (
                    <div key={boss.id} className="rounded-lg border border-[#4A3C31]/60 bg-[#1D1917] px-2.5 py-1 text-[11px]">
                      <span className="font-medium text-[#D8E6DA]">{boss.name}</span>:{" "}
                      <span className="font-mono text-[#E9C46A]">${(boss.current_hp || 0).toLocaleString("es-CO")} COP</span>{" "}
                      <span className="text-[#A69B8D]">({boss.daily_interest_dot_gp ?? 0} GP/d DoT)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* GM Briefing Banner (renders if briefing has been generated) */}
            {gmBriefing && (
              <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-slate-200">
                <Bot className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold text-amber-300">Briefing Táctico del Game Master: </span>
                  <span>{gmBriefing}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setGmBriefing("")}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}
          </header>

          {offlineSyncMsg && (
            <div className="mb-4 flex items-center justify-between rounded-xl border border-cyan-500/50 bg-cyan-950/80 p-3 text-xs font-bold text-cyan-200 shadow-lg animate-pulse">
              <span>{offlineSyncMsg}</span>
              <button onClick={() => setOfflineSyncMsg(null)} className="text-cyan-400 hover:text-white cursor-pointer">✕</button>
            </div>
          )}
          {perkSuccessMsg && (
            <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-500/50 bg-amber-950/80 p-3 text-xs font-bold text-amber-200 shadow-lg">
              <span>{perkSuccessMsg}</span>
              <button onClick={() => setPerkSuccessMsg(null)} className="text-amber-400 hover:text-white cursor-pointer">✕</button>
            </div>
          )}
          {backupRestoreMsg && (
            <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-500/50 bg-emerald-950/80 p-3 text-xs font-bold text-emerald-200 shadow-lg">
              <span>{backupRestoreMsg}</span>
              <button onClick={() => setBackupRestoreMsg(null)} className="text-emerald-400 hover:text-white cursor-pointer">✕</button>
            </div>
          )}
        </>
      )}

      {/* =====================================================================
          NAVEGACIÓN EXECUTIVE TABS (DESATURACIÓN DE LA PÁGINA PRINCIPAL)
         ===================================================================== */}
      {!dedicatedSkillDomain && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/5 bg-[#131B2E]/60 p-2 backdrop-blur-md shadow-xl">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setHomeActiveTab("hub")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                homeActiveTab === "hub"
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg ring-1 ring-emerald-400/50"
                  : "text-slate-400 hover:bg-slate-900 hover:text-white"
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Hub Principal
            </button>
            <button
              type="button"
              onClick={() => setHomeActiveTab("skills")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                homeActiveTab === "skills"
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg ring-1 ring-emerald-400/50"
                  : "text-slate-400 hover:bg-slate-900 hover:text-white"
              }`}
            >
              <Trophy className="h-4 w-4" />
              Santuario & Proyectos
            </button>
            <button
              type="button"
              onClick={() => setHomeActiveTab("analytics")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                homeActiveTab === "analytics"
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg ring-1 ring-indigo-400/50"
                  : "text-slate-400 hover:bg-slate-900 hover:text-white"
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              Analítica & Heatmaps
            </button>
            <button
              type="button"
              onClick={() => setHomeActiveTab("calendar")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                homeActiveTab === "calendar"
                  ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg ring-1 ring-cyan-400/50"
                  : "text-slate-400 hover:bg-slate-900 hover:text-white"
              }`}
            >
              <CalendarClock className="h-4 w-4" />
              Calendario Circadiano
            </button>
            <button
              type="button"
              onClick={() => setHomeActiveTab("debts")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                homeActiveTab === "debts"
                  ? "bg-gradient-to-r from-amber-600 to-rose-600 text-white shadow-lg ring-1 ring-amber-400/50"
                  : "text-slate-400 hover:bg-slate-900 hover:text-white"
              }`}
            >
              <Wallet className="h-4 w-4" />
              Finanzas & Wishlist
              {totalActiveDot > 0 && (
                <span className="ml-1 rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-300 animate-pulse">
                  DoT
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setHomeActiveTab("lab")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                homeActiveTab === "lab"
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg ring-1 ring-purple-400/50"
                  : "text-slate-400 hover:bg-slate-900 hover:text-white"
              }`}
            >
              <Smartphone className="h-4 w-4" />
              Laboratorio & Bitácora
            </button>
            <button
              type="button"
              onClick={() => setHomeActiveTab("ai_command_center")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                homeActiveTab === "ai_command_center"
                  ? "bg-gradient-to-r from-purple-600 via-indigo-600 to-emerald-600 text-white shadow-lg ring-1 ring-purple-400/50"
                  : "text-slate-400 hover:bg-slate-900 hover:text-white"
              }`}
            >
              <Bot className="h-4 w-4 text-purple-400" />
              AI Command Center
              <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[9px] font-mono font-bold text-emerald-300">
                11 Agentes
              </span>
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 px-2">
            <span>
              Racha: <strong className="text-amber-300">{state.current_streak_days}d</strong> ({state.streak_multiplier}x)
            </span>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 1: HUB PRINCIPAL (DESATURADO, VISTA EJECUTIVA & PORTALES)
         ===================================================================== */}
      {!dedicatedSkillDomain && homeActiveTab === "hub" && (
        <div className="space-y-8 mb-8">
          {/* BANNER DE NOTIFICACIÓN DE BIENESTAR */}
          {wellnessSuccessMsg && (
            <div className="rounded-xl border border-[#88A98E]/50 bg-[#222B24]/90 p-3 text-xs font-bold text-[#D8E6DA] shadow-md flex items-center justify-between">
              <span>{wellnessSuccessMsg}</span>
              <button
                type="button"
                onClick={() => setWellnessSuccessMsg(null)}
                className="text-[#88A98E] hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* BANNER SANTUARIO DE BIENESTAR & MICRO-MISIONES EN MODO COZY */}
          {isCozyActive && (
            <div className="rounded-2xl border border-[#4A3C31]/50 bg-[#221F1C]/80 p-5 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#4A3C31]/40 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🌿</span>
                  <div>
                    <h3 className="font-bold text-sm text-[#EAE4D9]">
                      Santuario de Bienestar · Micro-Misiones Sin Fricción
                    </h3>
                    <p className="text-xs text-[#A69B8D]">
                      Tareas restaurativas de un solo toque. Gana XP y GP inmediatos sin requerir sprints de trabajo profundo.
                    </p>
                  </div>
                </div>
                <span className="self-start sm:self-auto rounded-full bg-[#88A98E]/20 border border-[#88A98E]/40 px-2.5 py-0.5 text-[10px] font-bold text-[#D8E6DA]">
                  🛡️ Buff de Gracia Activo (1.1x seguro)
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                {[
                  { icon: "🍵", title: "Infusión Plena", desc: "Té o agua consciente", xp: 50, gp: 100 },
                  { icon: "📖", title: "Lectura Serena", desc: "5 págs sin prisa", xp: 100, gp: 250 },
                  { icon: "🥾", title: "Paseo Suave", desc: "5 min de estiramiento", xp: 80, gp: 200 },
                  { icon: "🌱", title: "Pausa Botánica", desc: "Cuidado de plantas", xp: 75, gp: 150 },
                  { icon: "🧶", title: "Momento Creativo", desc: "Tejido o boceto libre", xp: 90, gp: 220 },
                ].map((mission) => (
                  <button
                    key={mission.title}
                    type="button"
                    onClick={() => handleQuickWellnessAction(mission.title, mission.xp, mission.gp)}
                    className="flex flex-col justify-between rounded-xl border border-[#4A3C31]/40 bg-[#1A1815]/80 p-3 text-left transition hover:border-[#88A98E]/60 hover:bg-[#25201C] cursor-pointer"
                  >
                    <div>
                      <div className="text-xl mb-1">{mission.icon}</div>
                      <div className="font-bold text-xs text-[#EAE4D9]">{mission.title}</div>
                      <div className="text-[10px] text-[#A69B8D] mt-0.5">{mission.desc}</div>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono text-[#E9C46A] border-t border-[#4A3C31]/30 pt-1.5">
                      <span>+{mission.xp} XP</span>
                      <span>+{mission.gp} GP</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 1. PORTALES DE HABILIDADES COMPACTOS & MINIMALISTAS (Responsive Grid Glassmorphism) */}
          <div className={`rounded-2xl p-5 backdrop-blur-md transition-all duration-300 ${
            isCozyActive
              ? "border border-[#4A3C31]/50 bg-[#221F1C]/75 shadow-md text-[#EAE4D9]"
              : "border border-white/5 bg-[#131B2E]/60 shadow-xl text-slate-100"
          }`}>
            <div className="mb-3.5 flex items-center justify-between">
              <div>
                <span className={`text-xs font-bold uppercase tracking-wider ${
                  isCozyActive ? "text-[#88A98E]" : "text-emerald-400"
                }`}>
                  {isCozyActive ? "🌾 Portales del Santuario & Habilidades Restaurativas" : "🚀 Portales de Habilidades & Sesiones Activas"}
                </span>
                <p className={`text-xs ${isCozyActive ? "text-[#A69B8D]" : "text-slate-400"}`}>
                  Haz clic en cualquier portal para abrir la Ventana de Sesión Activa con Pomodoro y Notas, o navega a su Santuario dedicado.
                </p>
              </div>
              {isCozyActive && (
                <span className="rounded-lg bg-[#88A98E]/15 border border-[#88A98E]/30 px-2.5 py-1 text-[11px] font-bold text-[#D8E6DA]">
                  Prioridad Restaurativa
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(isCozyActive
                ? [...ALL_SKILL_DOMAINS_PORTAL].sort((a, b) => {
                    const priority = [
                      "knitting",
                      "reading",
                      "hiking",
                      "gardening",
                      "drawing",
                      "journaling",
                      "ceramics",
                      "cooking",
                    ];
                    const aIdx = priority.indexOf(a.domain);
                    const bIdx = priority.indexOf(b.domain);
                    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
                    if (aIdx !== -1) return -1;
                    if (bIdx !== -1) return 1;
                    return 0;
                  })
                : ALL_SKILL_DOMAINS_PORTAL
              ).map((dom) => {
                const summary = state.skill_summaries.find(
                  (s) => s.domain === dom.domain
                );
                const lvl = summary?.level ?? 1;
                const gp = summary?.total_gp_earned ?? 0;
                const sessions = summary?.sessions_count ?? 0;
                const minutes = summary?.total_minutes ?? 0;
                const isRestorative = ["knitting", "reading", "hiking", "gardening", "drawing", "journaling"].includes(dom.domain);

                return (
                  <div
                    key={dom.domain}
                    onClick={() => handleOpenSessionModal(dom.domain, dom.label)}
                    className={`group relative flex flex-col justify-between rounded-xl p-3.5 transition-all shadow-sm cursor-pointer ${
                      isCozyActive
                        ? isRestorative
                          ? "border border-[#88A98E]/40 bg-[#1D1A17] hover:border-[#88A98E]/70 hover:bg-[#25201C]"
                          : "border border-[#4A3C31]/40 bg-[#1A1815]/70 hover:border-[#4A3C31] hover:bg-[#201D1A]"
                        : "border border-white/5 bg-[#0B0F19]/60 hover:border-emerald-500/30 hover:bg-[#0B0F19]/90"
                    }`}
                    title={`Abrir Sesión Activa de ${dom.label}`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{dom.badge}</span>
                          <span className={`font-semibold text-xs transition ${
                            isCozyActive
                              ? "text-[#EAE4D9] group-hover:text-[#88A98E]"
                              : "text-slate-100 group-hover:text-emerald-300"
                          }`}>
                            {dom.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {isCozyActive && isRestorative && (
                            <span className="rounded bg-[#88A98E]/20 px-1 py-0.2 text-[9px] font-bold text-[#D8E6DA]">
                              Cozy
                            </span>
                          )}
                          <span className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                            isCozyActive
                              ? "bg-[#2D2723] text-[#E9C46A]"
                              : "bg-white/5 text-slate-300"
                          }`}>
                            LVL {lvl}
                          </span>
                          <Link
                            href={`/skills/${dom.domain}`}
                            onClick={(e) => e.stopPropagation()}
                            className={`rounded p-1 transition ${
                              isCozyActive
                                ? "text-[#A69B8D] hover:text-[#88A98E] hover:bg-[#332B25]"
                                : "text-slate-400 hover:text-emerald-300 hover:bg-white/5"
                            }`}
                            title="Abrir página completa independiente"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </div>
                      </div>
                      <p className={`mt-1 text-[11px] line-clamp-1 ${
                        isCozyActive ? "text-[#A69B8D]" : "text-slate-400"
                      }`}>
                        {dom.desc}
                      </p>
                    </div>

                    <div className={`mt-2.5 flex items-center justify-between border-t pt-2 text-[10px] font-mono ${
                      isCozyActive
                        ? "border-[#4A3C31]/40 text-[#A69B8D]"
                        : "border-white/5 text-slate-400"
                    }`}>
                      <span>{sessions} ses • {minutes}m</span>
                      <strong className={isCozyActive ? "text-[#E9C46A]" : "text-amber-400"}>
                        +{gp.toLocaleString("es-CO")} GP
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. TRES WIDGETS TÁCTICOS EJECUTIVOS (Glassmorphism Minimalista) */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* WIDGET 1: RENDIMIENTO & CONSTANCIA CUANTITATIVA */}
            <div className="flex flex-col justify-between rounded-2xl border border-white/5 bg-[#131B2E]/60 p-5 shadow-xl backdrop-blur-md">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-indigo-400" />
                    <h3 className="font-bold text-slate-100 text-sm">Rendimiento & Constancia</h3>
                  </div>
                  <span className="rounded-full bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                    NVL {state.player_level}
                  </span>
                </div>
                <div className="mt-3">
                  <span className="text-xs text-slate-400">Racha de Hábitos Activa:</span>
                  <p className="text-xl font-extrabold text-slate-100 font-mono flex items-center gap-2">
                    🔥 {state.current_streak_days} días
                    <span className="text-xs font-semibold text-emerald-400">
                      ({state.streak_multiplier}x GP)
                    </span>
                  </p>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  ⚡ {state.logs?.length || 0} sesiones y eventos de vida sistematizados.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHomeActiveTab("analytics")}
                className="mt-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs font-bold text-indigo-300 cursor-pointer text-center flex items-center justify-center gap-1.5 transition"
              >
                <BarChart3 className="h-3.5 w-3.5" /> Ver Analítica & Heatmap ➔
              </button>
            </div>

            {/* WIDGET MISIONES RÁPIDAS */}
            <div className="flex flex-col justify-between rounded-2xl border border-white/5 bg-[#131B2E]/60 p-5 shadow-xl backdrop-blur-md">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-emerald-400" />
                    <h3 className="font-bold text-slate-100 text-sm">Misiones Diarias Activas</h3>
                  </div>
                  <span className="text-xs text-emerald-400 font-bold">
                    {state.streak_multiplier}x GP Buff
                  </span>
                </div>
                <div className="mt-3 space-y-1.5">
                  {state.quests.slice(0, 2).map((q) => (
                    <div
                      key={q.code}
                      className="flex items-center justify-between rounded-xl bg-[#0B0F19]/60 p-2.5 text-xs border border-white/5"
                    >
                      <span className="text-slate-200 truncate pr-2 font-medium">{q.title}</span>
                      <button
                        type="button"
                        onClick={() => triggerHabitShortcut(q.code)}
                        className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-500 cursor-pointer shrink-0 transition"
                      >
                        +{Math.round(q.reward_gp * state.streak_multiplier).toLocaleString("es-CO")} GP
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHomeActiveTab("skills")}
                className="mt-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs font-bold text-emerald-300 cursor-pointer text-center transition"
              >
                Ir a Santuario de Habilidades ➔
              </button>
            </div>

            {/* WIDGET CALENDARIO HOY */}
            <div className="flex flex-col justify-between rounded-2xl border border-white/5 bg-[#131B2E]/60 p-5 shadow-xl backdrop-blur-md">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-cyan-400" />
                    <h3 className="font-bold text-slate-100 text-sm">Ritmo Circadiano Hoy</h3>
                  </div>
                  <span className="rounded-full bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                    {bioCalendarPlan.sleepHealthStatus.label}
                  </span>
                </div>
                <div className="mt-3 text-xs text-slate-300 space-y-1">
                  <div>
                    <span className="text-slate-400">Horario Biológico:</span>{" "}
                    <strong className="text-slate-100">{bioWakeUpTime} – {bioSleepTime}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Ventana Libre:</span>{" "}
                    <strong className="text-emerald-400">
                      {bioCalendarPlan.morningWindowMinsWeekday + bioCalendarPlan.eveningWindowMinsWeekday} min/día
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Sueño estimado:</span>{" "}
                    <strong className="text-cyan-300">{bioCalendarPlan.sleepHoursWeekday} horas</strong>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHomeActiveTab("calendar")}
                className="mt-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs font-bold text-cyan-300 cursor-pointer text-center transition"
              >
                Planificar Horas y Cronograma ➔
              </button>
            </div>
          </div>

          {/* BANNER FINANCIERO COMPLEMENTARIO (OPCIONAL) */}
          <div className="rounded-2xl border border-white/5 bg-[#131B2E]/60 p-4 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs shadow-xl">
            <div className="flex items-center gap-2.5">
              <span className="text-base">💼</span>
              <div>
                <span className="font-bold text-slate-100">Cámara Financiera & Wishlist:</span>
                <span className="text-slate-400 ml-2">
                  Billetera: <strong className="text-amber-400">{state.wallet_gp.toLocaleString("es-CO")} GP</strong> • 
                  Bóveda: <strong className="text-slate-300">{state.vault_remaining_gp.toLocaleString("es-CO")} GP</strong>
                  {totalActiveDot > 0 && (
                    <span className="text-rose-400 ml-2">
                      (DoT Pasivo: -{totalActiveDot.toLocaleString("es-CO")} GP/d)
                    </span>
                  )}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setHomeActiveTab("debts")}
              className="rounded-xl border border-white/5 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              Abrir Finanzas & Wishlist ➔
            </button>
          </div>

          {/* 3. BITÁCORA RECIENTE (FEED COLAPSABLE) */}
          <div className="rounded-2xl border border-white/[0.08] bg-slate-950/60 overflow-hidden shadow-lg backdrop-blur">
            <button
              type="button"
              onClick={() => setIsRecentFeedExpanded(!isRecentFeedExpanded)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.02] transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-400" />
                <h3 className="text-sm font-bold text-white">
                  Bitácora de Sesiones & Transacciones Recientes
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  ({state.logs?.length || 0} registros)
                </span>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {isRecentFeedExpanded ? "Ocultar ▾" : "Expandir ▸"}
              </span>
            </button>
            {isRecentFeedExpanded && (
              <div className="p-4 pt-0 border-t border-white/[0.05] space-y-2 mt-3">
                {state.logs.slice(0, 5).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-slate-900/60 p-3 text-xs"
                  >
                    <div className="truncate pr-3">
                      <p className="font-semibold text-white truncate">{log.title}</p>
                      <p className="text-[11px] text-slate-400 truncate">{log.subtitle}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`font-mono font-bold ${
                          log.gp_delta > 0
                            ? "text-emerald-400"
                            : log.gp_delta < 0
                            ? "text-rose-400"
                            : "text-slate-400"
                        }`}
                      >
                        {log.gp_delta > 0 ? `+${log.gp_delta.toLocaleString("es-CO")} GP` : log.gp_delta < 0 ? `${log.gp_delta.toLocaleString("es-CO")} GP` : "0 GP"}
                      </span>
                      <p className="text-[10px] text-slate-500">
                        {new Date(log.timestamp).toLocaleTimeString("es-CO", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4. MAPA DE CALOR DE PRODUCTIVIDAD ANUAL DE 365 DÍAS (COLAPSABLE) */}
          <div className="rounded-2xl border border-white/[0.08] bg-slate-950/60 overflow-hidden shadow-lg backdrop-blur">
            <button
              type="button"
              onClick={() => setIsHeatmapExpanded(!isHeatmapExpanded)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.02] transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  Mapa de Constancia Anual (365 días • Estilo GitHub)
                </h3>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                  Racha: {state.current_streak_days}d
                </span>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {isHeatmapExpanded ? "Ocultar ▾" : "Expandir ▸"}
              </span>
            </button>
            {isHeatmapExpanded && (
              <div className="p-4 pt-0 border-t border-white/[0.05] mt-3">
                <AnnualProductivityHeatmap
                  logs={state.logs || []}
                  currentStreak={state.current_streak_days}
                />
              </div>
            )}
          </div>

          {/* 5. ÁRBOL DE TALENTOS PASIVOS (PERKS RPG POR NIVEL - COLAPSABLE) */}
          <div className="rounded-2xl border border-white/[0.08] bg-slate-950/60 overflow-hidden shadow-lg backdrop-blur">
            <button
              type="button"
              onClick={() => setIsTalentTreeExpanded(!isTalentTreeExpanded)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.02] transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">
                  Árbol de Talentos Pasivos RPG (Perks por Nivel)
                </h3>
                <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-400">
                  Nivel {state.player_level}
                </span>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {isTalentTreeExpanded ? "Ocultar ▾" : "Expandir ▸"}
              </span>
            </button>
            {isTalentTreeExpanded && (
              <div className="p-4 pt-0 border-t border-white/[0.05] mt-3">
                <RpgTalentTreeSection
                  playerLevel={state.player_level}
                  talentPerks={state.talent_perks || []}
                  unlockedPerks={state.unlocked_perks || []}
                  onUnlockPerk={handleUnlockTalentPerk}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB: ANALÍTICA DE DATOS PERSONALES, RENDIMIENTO & HEATMAPS
         ===================================================================== */}
      {!dedicatedSkillDomain && homeActiveTab === "analytics" && (
        <div className="mb-8">
          <AnalyticsOverviewDashboard
            logs={state.logs || []}
            currentStreak={state.current_streak_days}
            playerLevel={state.player_level}
            totalXp={state.current_xp || 0}
            rubikStats={state.rubik_stats}
            books={state.reading_books || []}
            quests={state.quests || []}
            bosses={state.bosses || []}
            fixedCosts={state.fixed_costs || []}
            shortcutApiKey={state.user?.shortcut_api_key}
            onRestoreBackup={async (importedJson: unknown) => {
              try {
                const res = await fetch("/api/shortcuts/skill-session", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "restore_backup",
                    backup_data: importedJson,
                  }),
                });
                if (res.ok) {
                  alert("¡Respaldo restaurado con éxito!");
                  await fetchState();
                } else {
                  alert("Error al restaurar respaldo.");
                }
              } catch {
                alert("Error al conectar para restaurar respaldo.");
              }
            }}
          />
        </div>
      )}

      {/* =====================================================================
          TAB 3: CALENDARIO BIOLÓGICO CIRCADIANO DIARIO & SEMANAL
         ===================================================================== */}
      {!dedicatedSkillDomain && homeActiveTab === "calendar" && (
        <section className="mb-8 rounded-2xl border border-amber-500/30 bg-slate-950/90 p-6 shadow-xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  Calendario Biológico Diario & Semanal (De Levantarse a Acostarse)
                </h3>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                Estructura tu día hora por hora según a qué hora te levantas, cuándo duermes y tu bloque laboral.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  bioCalendarPlan.sleepHealthStatus.level === "optimal"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : bioCalendarPlan.sleepHealthStatus.level === "critical"
                    ? "bg-rose-500/20 text-rose-300"
                    : "bg-amber-500/20 text-amber-200"
                }`}
              >
                {bioCalendarPlan.sleepHealthStatus.label}
              </span>
            </div>
          </div>

          {/* CONTROLES DE HORAS */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 mb-4">
            <div>
              <label className="block text-[11px] text-slate-300">
                ☀️ Te levantas (Lun–Vie)
              </label>
              <input
                type="time"
                value={bioWakeUpTime}
                onChange={(e) => setBioWakeUpTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-300">
                🌙 Te acuestas (Lun–Vie)
              </label>
              <input
                type="time"
                value={bioSleepTime}
                onChange={(e) => setBioSleepTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-300">
                ☀️ FinSem / 🌙 FinSem
              </label>
              <div className="mt-1 flex items-center gap-1">
                <input
                  type="time"
                  value={bioWeekendWakeUpTime}
                  onChange={(e) => setBioWeekendWakeUpTime(e.target.value)}
                  className="w-1/2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                  title="Levantarse Fin de Semana"
                />
                <input
                  type="time"
                  value={bioWeekendSleepTime}
                  onChange={(e) => setBioWeekendSleepTime(e.target.value)}
                  className="w-1/2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                  title="Acostarse Fin de Semana"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-slate-300">
                🔒 Trabajo / Estudio
              </label>
              <div className="mt-1 flex items-center gap-1">
                <input
                  type="time"
                  value={bioWorkStart}
                  onChange={(e) => setBioWorkStart(e.target.value)}
                  className="w-1/2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                  title="Inicio trabajo"
                />
                <input
                  type="time"
                  value={bioWorkEnd}
                  onChange={(e) => setBioWorkEnd(e.target.value)}
                  className="w-1/2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                  title="Fin trabajo"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-slate-300">
                Ventana Habilidades:
              </label>
              <select
                value={bioSlotPref}
                onChange={(e) =>
                  setBioSlotPref(
                    e.target.value as "after_work" | "before_work" | "mixed"
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white"
              >
                <option value="mixed">Mixto (Mañana + Noche)</option>
                <option value="after_work">Tarde / Noche (Post-Trabajo)</option>
                <option value="before_work">Mañana (Antes de Trabajar)</option>
              </select>
            </div>
          </div>

          {/* BOTÓN DE GUARDADO DEL HORARIO */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
            <div className="text-xs text-slate-400">
              {scheduleSavedToast ? (
                <span className="font-semibold text-emerald-400">
                  ✅ ¡Horario circadiano guardado en tu perfil con éxito!
                </span>
              ) : (
                <span>Guarda tus horarios despierto/sueño para calibrar tus ventanas de enfoque.</span>
              )}
            </div>
            <button
              type="button"
              onClick={handleSaveDailySchedule}
              disabled={scheduleSaving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-xs font-bold text-white transition disabled:opacity-50 cursor-pointer shadow-lg shadow-cyan-950/30"
            >
              <Save className="h-3.5 w-3.5" />
              {scheduleSaving ? "Guardando..." : "💾 Guardar Horario Circadiano"}
            </button>
          </div>

          {/* DIAGNÓSTICO BIOLÓGICO */}
          <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-xs sm:grid-cols-3 mb-4">
            <div>
              <span className="text-slate-400">Vigilia Activa:</span>{" "}
              <strong className="text-white">
                {bioCalendarPlan.awakeHoursWeekday}h despierto
              </strong>{" "}
              <span className="text-slate-500">
                ({bioCalendarPlan.sleepHoursWeekday}h de sueño)
              </span>
            </div>
            <div>
              <span className="text-slate-400">Ventana Mañana Real:</span>{" "}
              <strong className="text-cyan-300">
                {bioCalendarPlan.morningWindowMinsWeekday} min libres
              </strong>
            </div>
            <div>
              <span className="text-slate-400">Ventana Noche Real:</span>{" "}
              <strong className="text-emerald-300">
                {bioCalendarPlan.eveningWindowMinsWeekday} min libres
              </strong>
            </div>
          </div>

          {/* TOAST DINÁMICO DEL CALENDARIO */}
          {calendarToastMsg && (
            <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-950/90 p-3 text-xs font-bold text-emerald-200 shadow-xl animate-in fade-in slide-in-from-top-2">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                {calendarToastMsg}
              </span>
              <button
                type="button"
                onClick={() => setCalendarToastMsg(null)}
                className="text-emerald-400 hover:text-white cursor-pointer ml-3"
              >
                ✕
              </button>
            </div>
          )}

          {/* CALENDAR ENGINE: BANCO LATERAL DE ACTIVIDADES & CRONOGRAMA */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* PANEL LATERAL: VENTANAS INTELIGENTES & BANCO DE HABILIDADES */}
            <div className="lg:col-span-4 space-y-4">
              {/* CARD 1: VENTANAS CIRCADIANAS DETECTADAS */}
              <div className="rounded-2xl border border-white/[0.08] bg-slate-900/60 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>🧭</span> Ventanas Libres Detectadas
                  </h4>
                  <span className="text-[10px] text-cyan-300 font-mono font-bold">Auto-Calibrado</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-cyan-300 flex items-center gap-1">
                        ☀️ Ventana Mañana
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {bioWakeUpTime} a {bioWorkStart || "08:00"}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-xs text-white">
                      {bioCalendarPlan.morningWindowMinsWeekday}m libres
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-700/50 bg-slate-950/40 p-2.5 flex items-center justify-between opacity-75">
                    <div>
                      <span className="font-bold text-slate-300 flex items-center gap-1">
                        🔒 Bloque Laboral Fijo
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {bioWorkStart || "08:00"} a {bioWorkEnd || "17:30"}
                      </span>
                    </div>
                    <span className="font-mono text-xs text-slate-400 font-semibold">
                      Inamovible
                    </span>
                  </div>

                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-emerald-300 flex items-center gap-1">
                        🌙 Ventana Noche
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {bioWorkEnd || "17:30"} a {bioSleepTime}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-xs text-white">
                      {bioCalendarPlan.eveningWindowMinsWeekday}m libres
                    </span>
                  </div>
                </div>
              </div>

              {/* CARD 2: BANCO DE ACTIVIDADES LATERAL */}
              <div className="rounded-2xl border border-white/[0.08] bg-slate-900/60 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>🎒</span> Banco de Habilidades & Santuario
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      Asigna a tus ventanas libres o arrastra a cualquier día.
                    </p>
                  </div>
                </div>

                {/* SELECTOR DE DÍA DESTINO */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-400">Día destino:</span>
                  <div className="flex flex-wrap gap-1">
                    {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((dKey) => (
                      <button
                        key={dKey}
                        type="button"
                        onClick={() => setCalendarTargetDay(dKey)}
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                          calendarTargetDay === dKey
                            ? "bg-amber-500 text-slate-950 font-black"
                            : "bg-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        {dKey}
                      </button>
                    ))}
                  </div>
                </div>

                {/* LISTA DE ACTIVIDADES EN EL BANCO */}
                <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
                  {LATERAL_ACTIVITY_BANK.map((item) => (
                    <div
                      key={item.domain}
                      draggable
                      onDragStart={() => setDraggedBankItem(item)}
                      className="group flex items-center justify-between rounded-xl border border-white/[0.06] bg-slate-950/70 p-2 hover:border-amber-500/40 hover:bg-slate-900/80 transition cursor-move"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <GripVertical className="h-3.5 w-3.5 text-slate-600 group-hover:text-amber-400 shrink-0" />
                        <span className="text-sm shrink-0">{item.badge}</span>
                        <div className="truncate">
                          <p className="font-semibold text-xs text-white truncate">{item.label}</p>
                          <span className="text-[9px] text-slate-400">{item.defaultMinutes}m • {item.tag}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        <button
                          type="button"
                          onClick={() => handleAssignFromBank(item, "morning")}
                          className="rounded bg-cyan-500/20 hover:bg-cyan-500/30 px-1.5 py-1 text-[9px] font-bold text-cyan-300 border border-cyan-500/30 transition cursor-pointer"
                          title={`Asignar ${item.label} a la ventana de mañana`}
                        >
                          +☀️ Mañana
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAssignFromBank(item, "evening")}
                          className="rounded bg-emerald-500/20 hover:bg-emerald-500/30 px-1.5 py-1 text-[9px] font-bold text-emerald-300 border border-emerald-500/30 transition cursor-pointer"
                          title={`Asignar ${item.label} a la ventana de noche`}
                        >
                          +🌙 Noche
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* CRONOGRAMA 7 DÍAS INTERACTIVO */}
            <div className="lg:col-span-8">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-7">
                {bioCalendarPlan.days.map((d) => {
                  const isToday = d.key === currentDayKey;
                  const blocks = getBlocksForDay(d);
                  const hasOverrides = !!dayOverrides[d.key];

                  return (
                    <div
                      key={d.key}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedBankItem) {
                          handleDropFromBank(d.key, draggedBankItem);
                        } else if (draggedBlock) {
                          handleDropBlock(d.key, getBlocksForDay(d).length);
                        }
                      }}
                      className={`flex flex-col justify-between rounded-2xl border p-2.5 text-xs transition-all ${
                        isToday
                          ? "border-emerald-500/60 bg-slate-900/90 shadow-xl shadow-emerald-500/10 ring-1 ring-emerald-500/30"
                          : "border-white/[0.08] bg-slate-900/50 hover:border-white/20"
                      }`}
                    >
                      <div>
                        {/* Day Header */}
                        <div className="flex items-center justify-between border-b border-white/[0.08] pb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-bold ${isToday ? "text-emerald-300" : "text-white"}`}>
                              {d.label}
                            </span>
                            {isToday && (
                              <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.2 font-mono text-[9px] font-bold text-emerald-300 animate-pulse">
                                HOY
                              </span>
                            )}
                          </div>
                          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-emerald-300">
                            {d.totalDayMins}m
                          </span>
                        </div>

                        {/* Wake / Sleep pill + Day actions */}
                        <div className="mt-1.5 flex items-center justify-between rounded-lg bg-slate-950/80 px-2 py-1 text-[9px] text-amber-200/90 font-mono">
                          <span>☀️ {d.wakeUpTime} – 🌙 {d.sleepTime}</span>
                          <div className="flex items-center gap-1">
                            {hasOverrides && (
                              <button
                                type="button"
                                onClick={() => handleResetDayOverrides(d.key)}
                                className="text-slate-400 hover:text-amber-300 transition"
                                title="Restablecer bloques automáticos"
                              >
                                <RotateCcw className="h-2.5 w-2.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleAddNewBlock(d.key)}
                              className="text-emerald-400 hover:text-white transition font-bold cursor-pointer"
                              title="Añadir nueva actividad"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        {/* Interactive Scheduled Blocks List */}
                        <div className="mt-2 space-y-1.5">
                          {blocks.map((item, i) => {
                            const isNow = isBlockNow(d.key, item.timeRange);
                            const todayStr = new Date().toISOString().slice(0, 10);
                            const completionKey = `${d.key}-${i}-${item.label}-${todayStr}`;
                            const isCompleted = !!completedCalendarBlocks[completionKey];

                            const domainIcon =
                              item.domain === "rubik"
                                ? "🧊"
                                : item.domain === "reading"
                                ? "📖"
                                : item.domain === "knitting"
                                ? "🧶"
                                : item.domain === "study"
                                ? "🎓"
                                : item.domain === "work"
                                ? "💼"
                                : item.domain === "sports"
                                ? "🏃"
                                : item.domain === "gardening"
                                ? "🌱"
                                : item.domain === "drawing"
                                ? "🎨"
                                : item.domain === "ceramics"
                                ? "🏺"
                                : item.domain === "hiking"
                                ? "🥾"
                                : item.domain === "cooking"
                                ? "🍳"
                                : item.domain === "journaling"
                                ? "✍️"
                                : "⚡";

                            return (
                              <div
                                key={i}
                                draggable
                                onDragStart={() => setDraggedBlock({ dayKey: d.key, index: i })}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  handleDropBlock(d.key, i);
                                }}
                                className={`group relative rounded-xl border p-2 transition-all cursor-move ${
                                  isNow
                                    ? "border-emerald-400 bg-emerald-950/40 ring-1 ring-emerald-400/60 shadow-lg shadow-emerald-500/20"
                                    : isCompleted
                                    ? "border-emerald-500/30 bg-emerald-950/15 opacity-80"
                                    : "border-white/[0.08] bg-slate-950/70 hover:border-slate-600 hover:bg-slate-900/90"
                                }`}
                              >
                                {/* Card Top: Time, Domain & Status Badges */}
                                <div className="flex items-center justify-between text-[10px]">
                                  <div className="flex items-center gap-1 font-mono font-bold text-cyan-300 truncate">
                                    <GripVertical className="h-3 w-3 text-slate-500 shrink-0 opacity-40 group-hover:opacity-100" />
                                    <span>{domainIcon}</span>
                                    <span className="truncate">{item.timeRange}</span>
                                  </div>
                                  {isNow ? (
                                    <span className="rounded bg-emerald-500/25 px-1 py-0.2 font-mono text-[8px] font-black text-emerald-300 animate-pulse ring-1 ring-emerald-400/40">
                                      🔴 AHORA
                                    </span>
                                  ) : isCompleted ? (
                                    <span className="rounded bg-emerald-500/20 px-1 py-0.2 font-mono text-[8px] font-bold text-emerald-300">
                                      ✓ HECHO
                                    </span>
                                  ) : null}
                                </div>

                                {/* Card Title (Click to inline edit) */}
                                <div
                                  onClick={() =>
                                    setEditingBlock({
                                      dayKey: d.key,
                                      index: i,
                                      label: item.label,
                                      timeRange: item.timeRange,
                                      minutes: item.minutes || 30,
                                      domain: item.domain || "study",
                                    })
                                  }
                                  className={`mt-1 font-semibold text-slate-200 hover:text-white cursor-pointer truncate ${
                                    isCompleted ? "line-through text-slate-500" : ""
                                  }`}
                                  title="Haz clic para editar franja horaria o nombre"
                                >
                                  {item.label}
                                </div>

                                {/* Progress bar if active now */}
                                {isNow && (
                                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-800">
                                    <div
                                      className="h-full bg-emerald-400 transition-all duration-1000"
                                      style={{ width: `${getBlockProgressNow(item.timeRange)}%` }}
                                    />
                                  </div>
                                )}

                                {/* Quick Action Buttons Row */}
                                <div className="mt-2 flex items-center justify-between border-t border-white/[0.06] pt-1.5 text-[10px]">
                                  {/* Complete & Session Buttons */}
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCompleteCalendarBlock(d.key, item, i);
                                      }}
                                      className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 font-bold transition cursor-pointer ${
                                        isCompleted
                                          ? "bg-emerald-500/30 text-emerald-300 hover:bg-emerald-500/40"
                                          : "bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300"
                                      }`}
                                      title={isCompleted ? "Desmarcar completado" : "Completar sesión y sumar XP/GP"}
                                    >
                                      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                      <span>{isCompleted ? "Listo" : "✓"}</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenSessionModal(
                                          item.domain || "study",
                                          item.label,
                                          item.minutes || 30
                                        );
                                      }}
                                      className="rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 px-1.5 py-0.5 text-[9px] font-bold border border-indigo-500/30 cursor-pointer"
                                      title="Abrir Ventana de Sesión Activa con Pomodoro y Bloc de Notas"
                                    >
                                      ▶ Enfoque
                                    </button>
                                  </div>

                                  {/* Reorder and Adjust Controls */}
                                  <div className="flex items-center gap-0.5 text-slate-400">
                                    <button
                                      type="button"
                                      disabled={i === 0}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMoveBlock(d.key, i, "up");
                                      }}
                                      className="rounded p-0.5 hover:text-white hover:bg-white/10 disabled:opacity-20 cursor-pointer"
                                      title="Subir prioridad"
                                    >
                                      <ArrowUp className="h-2.5 w-2.5" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={i === blocks.length - 1}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMoveBlock(d.key, i, "down");
                                      }}
                                      className="rounded p-0.5 hover:text-white hover:bg-white/10 disabled:opacity-20 cursor-pointer"
                                      title="Bajar prioridad"
                                    >
                                      <ArrowDown className="h-2.5 w-2.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAdjustDuration(d.key, i, 15);
                                      }}
                                      className="rounded px-1 py-0.5 text-[8px] font-mono hover:text-cyan-300 hover:bg-white/10 cursor-pointer"
                                      title="+15 minutos"
                                    >
                                      +15m
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAdjustDuration(d.key, i, -15);
                                      }}
                                      className="rounded px-1 py-0.5 text-[8px] font-mono hover:text-rose-300 hover:bg-white/10 cursor-pointer"
                                      title="-15 minutos"
                                    >
                                      -15m
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingBlock({
                                          dayKey: d.key,
                                          index: i,
                                          label: item.label,
                                          timeRange: item.timeRange,
                                          minutes: item.minutes || 30,
                                          domain: item.domain || "study",
                                        });
                                      }}
                                      className="rounded p-0.5 hover:text-amber-300 hover:bg-white/10 cursor-pointer"
                                      title="Editar actividad"
                                    >
                                      <Edit3 className="h-2.5 w-2.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Immovable / Daily Baseline Timeline Slots */}
                        <div className="mt-2 space-y-0.5 border-t border-white/[0.06] pt-1 text-[9px] text-slate-400">
                          {d.timeline
                            .filter((slot) => slot.kind !== "skill")
                            .map((slot, sIdx) => (
                              <div
                                key={sIdx}
                                className="flex items-center justify-between truncate"
                              >
                                <span className="truncate pr-1 text-slate-400">{slot.title}</span>
                                <span className="font-mono text-slate-500 shrink-0">
                                  {slot.timeRange ? slot.timeRange.split(" – ")[0] : ""}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Day Footer with Projected GP */}
                      <div className="mt-2.5 border-t border-white/[0.08] pt-1.5 flex items-center justify-between text-[10px] font-mono">
                        <span className="text-slate-400">Potencial:</span>
                        <strong className="text-amber-300 font-bold">
                          +{d.gpUnlocked.toLocaleString("es-CO")} GP
                        </strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* =====================================================================
              MODAL FLOTANTE DE EDICIÓN RÁPIDA DE BLOQUE DE HORARIO (POPOVER)
             ===================================================================== */}
          {editingBlock && (
            <div
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in"
              onClick={() => setEditingBlock(null)}
            >
              <div
                className="w-full max-w-md rounded-2xl border border-white/15 bg-slate-950 p-5 shadow-2xl space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <Edit3 className="h-4 w-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">
                      {editingBlock.isNew ? "Añadir Nueva Actividad" : "Editar Bloque de Horario"} (
                      {editingBlock.dayKey.toUpperCase()})
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingBlock(null)}
                    className="rounded p-1 text-slate-400 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      Nombre de la Actividad / Misión
                    </label>
                    <input
                      type="text"
                      value={editingBlock.label}
                      onChange={(e) =>
                        setEditingBlock({ ...editingBlock, label: e.target.value })
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white text-xs focus:border-emerald-500 focus:outline-none"
                      placeholder="Ej. Speedcubing F2L, Lectura Limpia, Sprint Trabajo..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">
                        Disciplina / Dominio
                      </label>
                      <select
                        value={editingBlock.domain}
                        onChange={(e) =>
                          setEditingBlock({
                            ...editingBlock,
                            domain: e.target.value as SkillDomain,
                          })
                        }
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-white text-xs focus:border-emerald-500 focus:outline-none"
                      >
                        <option value="rubik">🧩 Cubos de Rubik</option>
                        <option value="reading">📚 Lectura</option>
                        <option value="knitting">🧶 Tejido / Crochet</option>
                        <option value="study">🎓 Estudio / SM-2</option>
                        <option value="work">💼 Trabajo Ágil</option>
                        <option value="sports">🏃 Deporte / Fitness</option>
                        <option value="gaming">🎮 Gaming Consciente</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">
                        Franja Horaria (Inicio – Fin)
                      </label>
                      <input
                        type="text"
                        value={editingBlock.timeRange}
                        onChange={(e) =>
                          setEditingBlock({ ...editingBlock, timeRange: e.target.value })
                        }
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white text-xs font-mono focus:border-emerald-500 focus:outline-none"
                        placeholder="Ej. 18:00 – 18:45"
                      />
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-900/60 p-2.5 border border-white/[0.05] text-[11px] text-slate-400">
                    💡 <strong className="text-slate-300">Tip de Productividad:</strong> Ajustar la franja recalcula la duración y la forja de XP y GP proporcional a tu racha activa.
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-white/10 pt-3">
                  {!editingBlock.isNew ? (
                    <button
                      type="button"
                      onClick={() =>
                        handleDeleteBlock(editingBlock.dayKey, editingBlock.index)
                      }
                      className="flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Eliminar</span>
                    </button>
                  ) : <div />}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingBlock(null)}
                      className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEditingBlock}
                      className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-1.5 text-xs font-bold text-white shadow-lg cursor-pointer transition"
                    >
                      <Save className="h-3.5 w-3.5" />
                      <span>Guardar</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* =====================================================================
          TAB 2: SANTUARIO DE HABILIDADES & SESIONES DE PRODUCTIVIDAD
         ===================================================================== */}
      {(dedicatedSkillDomain || homeActiveTab === "skills") && (
      <section className="mb-8 rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-slate-900/90 to-slate-950/90 p-6 shadow-xl">
        <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white">
                Santuario de Habilidades & Journaling (Refugio Libre de Culpa)
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              Espacio de desarrollo y balance personal. Cubos de Rubik, Lectura, Tejido y Journaling son 100% libres de culpa: forjan XP y GP al practicarse, sin penalizar ni restar racha si decides pausar.
            </p>
          </div>

          {/* TABS SELECTOR DE DISCIPLINAS ELEGIDAS POR EL USUARIO */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-800 bg-slate-950 p-1.5 overflow-x-auto max-w-full">
              {[
                { domain: "journaling" as SkillDomain, label: "✍️ Journaling" },
                { domain: "rubik" as SkillDomain, label: "🧊 Cubos WCA" },
                { domain: "reading" as SkillDomain, label: "📖 Lectura" },
                { domain: "knitting" as SkillDomain, label: "🧶 Tejido" },
                { domain: "gardening" as SkillDomain, label: "🌱 Jardinería" },
                { domain: "drawing" as SkillDomain, label: "🎨 Dibujo" },
                { domain: "ceramics" as SkillDomain, label: "🏺 Cerámica" },
                { domain: "hiking" as SkillDomain, label: "🥾 Senderismo" },
                { domain: "cooking" as SkillDomain, label: "🍳 Cocina" },
                { domain: "study" as SkillDomain, label: "🎓 Estudio" },
                { domain: "work" as SkillDomain, label: "💼 Trabajo" },
                { domain: "gaming" as SkillDomain, label: "🎮 eSports" },
                { domain: "sports" as SkillDomain, label: "🏅 Deporte" },
              ].map((item) => (
                <button
                  key={item.domain}
                  type="button"
                  onClick={() => setActiveSkillTab(item.domain)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                    activeSkillTab === item.domain
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/40 ring-1 ring-emerald-400/50"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          {!dedicatedSkillDomain && (
            <Link
              href={`/skills/${activeSkillTab}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/15 px-3 py-2 text-xs font-bold text-indigo-300 hover:bg-indigo-500/25 transition cursor-pointer shadow-sm"
              title="Abrir esta disciplina en una página dedicada a pantalla completa"
            >
              <span>↗</span> Pantalla Completa Dedicada
            </Link>
          )}
        </div>

      {/* BANNER SANTUARIO LIBRE DE CULPA */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 text-xs text-emerald-200 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🕊️</span>
          <div>
            <span className="font-bold text-white">Santuario Libre de Culpa:</span>{" "}
            <span>
              El <strong>Journaling</strong>, el <strong>Tejido/Crochet</strong>, los <strong>Cubos de Rubik</strong>, la <strong>Lectura Profunda</strong>, la <strong>Jardinería</strong>, el <strong>Dibujo</strong>, la <strong>Cerámica</strong>, el <strong>Senderismo Urbano</strong> y la <strong>Cocina Experimental</strong> funcionan como bonificación voluntaria y desconexión sin culpa. Practicarlos forja bonificaciones de XP y GP, pero <strong>NUNCA restan racha ni activan castigos ni DoT</strong> si descansas días sin practicarlos.
            </span>
          </div>
        </div>
        <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[10px] font-mono font-bold text-emerald-300 ring-1 ring-emerald-500/40 shrink-0">
          0% Culpa • 100% Bonificación
        </span>
      </div>

      {/* AUDIO HUB (SPOTIFY INTEGRATION - AUDIOLIBROS & PODCASTS CERO CULPA) */}
      <SpotifyAudioHub
        onOpenSessionNotes={(title, artist) => {
          handleOpenSessionModal("reading", `Audio Hub: ${title} (${artist})`, 30);
        }}
        onLogAudioSession={async (title, minutes) => {
          await submitSkillSession({
            domain: "reading",
            duration_minutes: minutes,
            title: `Spotify Audio Hub: ${title}`,
            notes: `Escucha y aprendizaje activo: ${title}`,
          });
        }}
      />

      {/* TARJETAS RESUMEN DE NIVEL POR HABILIDAD */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {state.skill_summaries.map((s) => (
            <div
              key={s.domain}
              onClick={() => setActiveSkillTab(s.domain)}
              className={`cursor-pointer rounded-xl border p-3 transition ${
                activeSkillTab === s.domain
                  ? "border-emerald-500/60 bg-emerald-950/20 ring-1 ring-emerald-500/30"
                  : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-200">{s.label}</span>
                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono font-bold text-emerald-400">
                  LVL {s.level}
                </span>
              </div>
              <p className="mt-1.5 text-xs font-bold text-amber-300">
                +{s.total_gp_earned.toLocaleString("es-CO")} GP
              </p>
              <p className="text-[11px] text-slate-400">
                {s.sessions_count} sesiones • {s.total_minutes} min
              </p>
            </div>
          ))}
        </div>

        {/* MAPA DE CALOR DE CONSTANCIA & HÁBITOS (SANTUARIO) */}
        <div className="mb-6">
          <AnnualProductivityHeatmap
            logs={state.logs || []}
            currentStreak={state.current_streak_days}
            showDomainFilter={true}
            filterDomain={activeSkillTab}
            title="Mapa de Calor de Constancia en Habilidades & Hábitos (365 Días)"
          />
        </div>

        {/* BANNER FLOTANTE DE SESIÓN EN VIVO ACTIVA (SI CORRE EN SEGUNDO PLANO O EN OTRA PESTAÑA) */}
        {liveTimerDomain && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/50 bg-gradient-to-r from-amber-950/80 via-slate-900/90 to-amber-950/80 p-4 shadow-lg shadow-amber-950/30">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3.5 w-3.5">
                <span
                  className={`absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 ${
                    liveTimerPaused ? "" : "animate-ping"
                  }`}
                />
                <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-amber-500" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-300" />
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    {liveTimerPaused ? "Sesión en Pausa" : "Sesión en Vivo en Curso"} •{" "}
                    {liveTimerDomain === "reading"
                      ? "Lectura"
                      : liveTimerDomain === "rubik"
                      ? "Cubo de Rubik"
                      : liveTimerDomain === "knitting"
                      ? "Tejido"
                      : liveTimerDomain === "study"
                      ? "Estudio"
                      : liveTimerDomain === "work"
                      ? "Trabajo"
                      : liveTimerDomain === "gaming"
                      ? "Gaming"
                      : "Deportes"}
                  </span>
                </div>
                <div className="font-mono text-2xl font-black tracking-tight text-white">
                  {formatStopwatch(liveTimerSeconds)}
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    ({Math.max(1, Math.round(liveTimerSeconds / 60))} min acumulados)
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {liveTimerPaused ? (
                <button
                  type="button"
                  onClick={resumeLiveTimer}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer"
                >
                  <Play className="h-3.5 w-3.5" /> Reanudar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={pauseLiveTimer}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-500 cursor-pointer"
                >
                  <Pause className="h-3.5 w-3.5" /> Pausar
                </button>
              )}

              <button
                type="button"
                disabled={submitting}
                onClick={() => stopAndLogLiveTimer(liveTimerDomain)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-1.5 text-xs font-extrabold text-white shadow hover:brightness-110 disabled:opacity-50 cursor-pointer"
              >
                <Square className="h-3.5 w-3.5" /> Finalizar y Registrar (
                {Math.max(1, Math.round(liveTimerSeconds / 60))} min)
              </button>

              <button
                type="button"
                onClick={resetLiveTimer}
                className="inline-flex items-center gap-1 rounded-xl bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-rose-300 hover:bg-slate-700 cursor-pointer"
                title="Descartar cronómetro sin registrar"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Descartar
              </button>

              {activeSkillTab !== liveTimerDomain && (
                <button
                  type="button"
                  onClick={() => setActiveSkillTab(liveTimerDomain)}
                  className="rounded-xl border border-amber-500/40 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-950/40 cursor-pointer"
                >
                  Ir a Sala ➜
                </button>
              )}
            </div>
          </div>
        )}

        {/* 1. EDIFICIO ESPECIALIZADO: CLUB DE PUZZLES & SPEEDCUBING WCA */}
        {activeSkillTab === "rubik" && (
          <ClubPuzzlesBuilding
            cubes={state.rubik_cubes || []}
            rubikStats={state.rubik_stats}
            rubikStatsByCube={state.rubik_stats_by_cube}
            nextScramble={state.next_rubik_scramble}
            playerLevel={state.player_level}
            skillLevel={
              state.skill_summaries?.find((s) => s.domain === "rubik")?.level || 1
            }
            totalGpEarned={
              state.skill_summaries?.find((s) => s.domain === "rubik")?.total_gp_earned || 0
            }
            isCozyActive={isCozyActive}
            onRefreshState={fetchState}
            onSubmitDirectSkillSession={submitSkillSession}
          />
        )}

        {/* 2. EDIFICIO ESPECIALIZADO: LA LIBRERÍA & ARCHIVO */}
        {activeSkillTab === "reading" && (
          <LibreriaBuilding
            books={state.reading_books || []}
            playerLevel={state.player_level}
            skillLevel={
              state.skill_summaries?.find((s) => s.domain === "reading")?.level || 1
            }
            totalGpEarned={
              state.skill_summaries?.find((s) => s.domain === "reading")?.total_gp_earned || 0
            }
            currency={state.currency || "COP"}
            isCozyActive={isCozyActive}
            onRefreshState={fetchState}
            onSubmitDirectSkillSession={submitSkillSession}
          />
        )}

        {/* 3. EDIFICIO ESPECIALIZADO: EL ATELIER DE TEJIDO & ARTESANÍA */}
        {activeSkillTab === "knitting" && (
          <AtelierBuilding
            projects={state.knitting_projects || []}
            playerLevel={state.player_level}
            skillLevel={
              state.skill_summaries?.find((s) => s.domain === "knitting")?.level || 1
            }
            totalGpEarned={
              state.skill_summaries?.find((s) => s.domain === "knitting")?.total_gp_earned || 0
            }
            isCozyActive={isCozyActive}
            onRefreshState={fetchState}
            onSubmitDirectSkillSession={submitSkillSession}
          />
        )}

        {/* 4. EDIFICIO ESPECIALIZADO: LA BIBLIOTECA DEL ERUDITO */}
        {activeSkillTab === "study" && (
          <BibliotecaBuilding
            cards={state.spaced_cards || []}
            sessions={state.skill_sessions || []}
            playerLevel={state.player_level}
            skillLevel={
              state.skill_summaries?.find((s) => s.domain === "study")?.level || 1
            }
            totalGpEarned={
              state.skill_summaries?.find((s) => s.domain === "study")?.total_gp_earned || 0
            }
            isCozyActive={isCozyActive}
            onRefreshState={fetchState}
            onSubmitDirectSkillSession={submitSkillSession}
            onReviewCard={handleReviewSpacedCard}
            onAddCard={handleAddSpacedCard}
          />
        )}

        {/* 5. APARTADO: MÓDULO DE TRABAJO: PROYECTOS VS ACTIVIDADES */}
        {activeSkillTab === "work" && (
          <div className="space-y-6">
            <div id="work-section-container" className="work-management-engine rounded-2xl border border-indigo-500/30 bg-slate-900/90 p-6 shadow-xl shadow-indigo-950/20 text-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <h3 className="text-xl font-bold flex items-center gap-2 text-indigo-400">
                  <span>💼</span> Núcleo de Gestión: Proyectos & Actividades Diarias
                </h3>
                <span className="rounded-full bg-indigo-500/10 border border-indigo-500/30 px-3 py-1 text-xs font-semibold text-indigo-300">
                  {workViewMode === "activities"
                    ? "⚡ Rutina & Cargas Operativas"
                    : "🚀 Metodología Ágil & Estrategia"}
                </span>
              </div>

              {/* Selector principal de modo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <button
                  type="button"
                  onClick={() => setWorkViewMode("activities")}
                  id="btn-mode-activities"
                  className={`py-3 px-4 rounded-xl font-semibold border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    workViewMode === "activities"
                      ? "border-indigo-500 bg-indigo-600/25 text-indigo-200 shadow-lg shadow-indigo-500/20"
                      : "border-slate-700 bg-slate-800 text-slate-300 hover:border-indigo-500/50 hover:bg-slate-800/80"
                  }`}
                >
                  <span className="text-base">⚡</span> Actividades Diarias (Rutina / OPGs)
                </button>
                <button
                  type="button"
                  onClick={() => setWorkViewMode("projects")}
                  id="btn-mode-projects"
                  className={`py-3 px-4 rounded-xl font-semibold border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    workViewMode === "projects"
                      ? "border-indigo-500 bg-indigo-600/25 text-indigo-200 shadow-lg shadow-indigo-500/20"
                      : "border-slate-700 bg-slate-800 text-slate-300 hover:border-indigo-500/50 hover:bg-slate-800/80"
                  }`}
                >
                  <span className="text-base">🚀</span> Proyectos de Alto Impacto (Estratégicos)
                </button>
              </div>

              {/* CRONÓMETRO UNIVERSAL EN VIVO PARA TRABAJO */}
              <div className="mb-6 rounded-xl border border-indigo-500/40 bg-gradient-to-b from-indigo-950/40 to-slate-900/90 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Clock className="h-5 w-5 text-indigo-400" />
                    <div>
                      <span className="text-xs font-bold text-indigo-300 block">
                        {liveTimerDomain === "work" && !liveTimerPaused
                          ? `● Deep Work activo: ${
                              workViewMode === "activities"
                                ? "Actividad Operativa"
                                : "Proyecto Estratégico"
                            }...`
                          : liveTimerDomain === "work" && liveTimerPaused
                          ? "⏸ Deep Work en Pausa"
                          : "Cronómetro de Enfoque en Vivo (Deep Work)"}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {workViewMode === "activities"
                          ? `Tarea: ${operationalTaskTitle || "Rutina Operativa"}`
                          : `Proyecto: ${
                              state.work_projects?.find(
                                (p) => p.id === selectedProjectId
                              )?.name || "Estratégico"
                            }`}
                      </span>
                    </div>
                  </div>
                  <span className="font-mono text-2xl font-black tracking-tight text-white">
                    {liveTimerDomain === "work"
                      ? formatStopwatch(liveTimerSeconds)
                      : "00:00"}
                  </span>
                </div>

                <div className="mt-3.5 flex flex-wrap gap-2">
                  {liveTimerDomain !== "work" ? (
                    <button
                      type="button"
                      onClick={() => startLiveTimer("work")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-indigo-500 cursor-pointer"
                    >
                      <Play className="h-4 w-4" /> ▶ Iniciar Bloque de Trabajo
                    </button>
                  ) : (
                    <>
                      {liveTimerPaused ? (
                        <button
                          type="button"
                          onClick={resumeLiveTimer}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-500 cursor-pointer"
                        >
                          <Play className="h-3.5 w-3.5" /> Reanudar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={pauseLiveTimer}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-amber-500 cursor-pointer"
                        >
                          <Pause className="h-3.5 w-3.5" /> Pausar
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => stopAndLogLiveTimer("work")}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-teal-500 px-4 py-2 text-xs font-extrabold text-white shadow hover:brightness-110 disabled:opacity-50 cursor-pointer"
                      >
                        <Square className="h-3.5 w-3.5" /> ⏹ Finalizar y Forjar GP (
                        {Math.max(1, Math.round(liveTimerSeconds / 60))} min)
                      </button>
                      <button
                        type="button"
                        onClick={resetLiveTimer}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-2 text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Reset
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* VISTA 1: ACTIVIDADES DIARIAS */}
              {workViewMode === "activities" && (
                <div id="view-activities" className="work-view space-y-5">
                  <div className="p-5 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-slate-200 flex items-center gap-2">
                        <span>📌</span> Registro de Tareas Operativas & Rutina
                      </h4>
                      <span className="text-xs text-indigo-400 font-mono">1.0x GP</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Controla tus cargas recurrentes de alto volumen (ej. procesamiento de OPGs, cargas de precios, validación de plantillas, auditoría).
                    </p>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Descripción de la Tarea Operativa
                      </label>
                      <input
                        type="text"
                        value={operationalTaskTitle}
                        onChange={(e) => setOperationalTaskTitle(e.target.value)}
                        placeholder="Ej: Procesar OPGs canal mayorista..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Atajos de tareas operativas frecuentes */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] text-slate-400 block font-medium">
                        Plantillas rápidas de tareas:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {[
                          "Procesamiento masivo de OPGs mayoristas",
                          "Carga y actualización de precios en ERP",
                          "Validación y cuadre de plantillas",
                          "Auditoría y conciliación de pedidos",
                        ].map((task) => (
                          <button
                            key={task}
                            type="button"
                            onClick={() => setOperationalTaskTitle(task)}
                            className="rounded-lg border border-slate-700 bg-slate-900/60 px-2.5 py-1 text-[11px] text-slate-300 hover:border-indigo-500 hover:text-white transition-all cursor-pointer"
                          >
                            + {task}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Minutos Invertidos
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="5"
                            value={workMinutes}
                            onChange={(e) =>
                              setWorkMinutes(Math.max(1, Number(e.target.value)))
                            }
                            className="w-24 bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200"
                          />
                          <div className="flex gap-1.5">
                            {[25, 45, 60].map((mins) => (
                              <button
                                key={mins}
                                type="button"
                                onClick={() => setWorkMinutes(mins)}
                                className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer ${
                                  workMinutes === mins
                                    ? "bg-indigo-600 text-white"
                                    : "bg-slate-900 text-slate-400 hover:bg-slate-750"
                                }`}
                              >
                                {mins}m
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-end">
                        <button
                          type="button"
                          disabled={submitting || !operationalTaskTitle.trim()}
                          onClick={() =>
                            submitSkillSession({
                              domain: "work",
                              work_mode: "activities",
                              deliverable: operationalTaskTitle,
                              impact_level: "standard",
                              duration_minutes: workMinutes,
                            })
                          }
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2.5 rounded-lg text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
                        >
                          <Zap className="h-4 w-4" /> Registrar Avance Operativo (+GP)
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* VISTA 2: PROYECTOS & METODOLOGÍA ÁGIL */}
              {workViewMode === "projects" && (() => {
                const projects = state.work_projects || [];
                const activeProject =
                  projects.find((p) => p.id === selectedProjectId) ||
                  projects[0];
                const activeMethodology: AgileMethodology =
                  activeProject?.methodology || selectedAgileMethodology || "scrum";

                const trelloStages: string[] =
                  activeMethodology === "scrum"
                    ? ["Backlog", "Sprint Backlog", "En Progreso", "Hecho"]
                    : activeMethodology === "kanban"
                    ? [
                        "Por Hacer (To-Do)",
                        "En Proceso (WIP)",
                        "Bloqueado",
                        "Completado",
                      ]
                    : [
                        "Identificar Valor",
                        "Mapear Cadena de Flujo",
                        "Optimizar / Automatizar",
                      ];

                const projectTasks = activeProject?.tasks || [];
                const completedTasks = projectTasks.filter((t) => t.is_completed);
                const progressPct =
                  projectTasks.length > 0
                    ? Math.round((completedTasks.length / projectTasks.length) * 100)
                    : 0;

                return (
                  <div id="view-projects" className="work-view space-y-6">
                    {/* Barra Superior: Proyectos Activos & Botones de Creación */}
                    <div className="p-5 bg-slate-800/50 rounded-xl border border-slate-700/60 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h4 className="font-semibold text-indigo-300 flex items-center gap-2">
                            <span>📁</span> Proyectos Estratégicos & Tableros Trello
                          </h4>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Selecciona un proyecto para abrir su tablero interactivo o genera uno nuevo con la IA.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowAiPlannerModal((v) => !v)}
                            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer"
                          >
                            <Sparkles className="h-4 w-4 text-amber-300" />
                            {showAiPlannerModal
                              ? "Cerrar Asistente IA"
                              : "✨ Diseñar Proyecto con Gemini IA"}
                          </button>
                        </div>
                      </div>

                      {/* Tarjetas selectoras de proyectos */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {projects.map((proj) => {
                          const isSelected = activeProject?.id === proj.id;
                          const pTasks = proj.tasks || [];
                          const pCompleted = pTasks.filter((t) => t.is_completed).length;
                          const pPct =
                            pTasks.length > 0
                              ? Math.round((pCompleted / pTasks.length) * 100)
                              : 0;

                          return (
                            <div
                              key={proj.id}
                              onClick={() => {
                                setSelectedProjectId(proj.id);
                                if (proj.methodology && proj.methodology !== "none") {
                                  setSelectedAgileMethodology(proj.methodology);
                                }
                                if (proj.current_stage) {
                                  setSelectedAgileStage(proj.current_stage);
                                }
                              }}
                              className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                                isSelected
                                  ? "border-indigo-500 bg-indigo-950/40 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/50"
                                  : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-bold text-xs text-white truncate pr-2">
                                  {proj.name}
                                </span>
                                <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-300 uppercase shrink-0">
                                  {proj.methodology}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 line-clamp-1 mb-2.5">
                                {proj.description || "Proyecto estratégico ágil"}
                              </p>
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-[10px] text-slate-400">
                                  <span>
                                    {pCompleted}/{pTasks.length} tarjetas ({pPct}%)
                                  </span>
                                  <span>⏱ {proj.total_minutes_invested || 0}m Deep Work</span>
                                </div>
                                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="bg-indigo-500 h-full rounded-full transition-all"
                                    style={{ width: `${pPct}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* MÓDULO DE PLANIFICACIÓN ASISTIDA POR GEMINI IA (SKILL 9) */}
                    {showAiPlannerModal && (
                      <div className="p-5 bg-gradient-to-br from-indigo-950/70 via-slate-900/90 to-purple-950/60 rounded-2xl border border-indigo-500/40 shadow-xl space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-indigo-300 flex items-center gap-2 text-sm">
                            <Bot className="h-5 w-5 text-indigo-400" />
                            <span>Skill 9: Arquitecto Ágil con Gemini IA</span>
                          </h4>
                          <span className="text-[11px] text-indigo-300/80 font-mono">
                            gemini-2.5-flash • Auto-Backlog & Trello
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          Describe tu meta de trabajo o proyecto. Gemini seleccionará la metodología óptima (Scrum, Kanban o Lean), redactará los criterios de aceptación y construirá las tarjetas listas para tu tablero Trello.
                        </p>

                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                            ¿Qué proyecto, proceso o meta quieres estructurar?
                          </label>
                          <textarea
                            rows={2}
                            value={aiProjectPrompt}
                            onChange={(e) => setAiProjectPrompt(e.target.value)}
                            placeholder="Ej: Automatizar validación y cruce de 200 OPGs mayoristas con scripts en Python y plantillas Excel..."
                            className="w-full bg-slate-950/90 border border-indigo-500/30 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-400"
                          />
                        </div>

                        {/* Atajos de proyectos rápidos */}
                        <div className="flex flex-wrap gap-2 items-center text-[11px]">
                          <span className="text-slate-400 font-medium">Ideas rápidas:</span>
                          {[
                            "Automatización OPGs & Cargas de Precios",
                            "Dashboard Financiero & RPG Life-Engine",
                            "E-commerce de Prendas de Tejido Artesanal",
                          ].map((idea) => (
                            <button
                              key={idea}
                              type="button"
                              onClick={() => setAiProjectPrompt(idea)}
                              className="rounded-lg border border-indigo-500/20 bg-indigo-950/40 px-2.5 py-1 text-[11px] text-indigo-200 hover:border-indigo-400 transition-all cursor-pointer"
                            >
                              + {idea}
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] text-slate-400">
                            Cero fricción: genera tareas con minutos estimados y recompensas GP.
                          </span>
                          <button
                            type="button"
                            disabled={generatingAiProject || !aiProjectPrompt.trim()}
                            onClick={handleGenerateAiProject}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/30 disabled:opacity-50 cursor-pointer"
                          >
                            <Sparkles className="h-4 w-4" />
                            {generatingAiProject
                              ? "Estructurando con Gemini..."
                              : "🤖 Descomponer Proyecto con Gemini"}
                          </button>
                        </div>

                        {/* Vista previa del plan generado por la IA */}
                        {generatedAiPlan && (
                          <div className="mt-4 p-4 rounded-xl border border-indigo-500/40 bg-slate-950/80 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                              <div>
                                <span className="text-xs font-bold text-white block">
                                  {generatedAiPlan.name}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  {generatedAiPlan.description}
                                </span>
                              </div>
                              <span className="rounded bg-indigo-500/20 px-2.5 py-1 text-xs font-bold text-indigo-300 uppercase">
                                Metodología: {generatedAiPlan.methodology}
                              </span>
                            </div>

                            <p className="text-xs text-indigo-200 italic bg-indigo-950/30 p-2.5 rounded-lg border border-indigo-500/20">
                              💡 <strong>Diagnóstico Ágil:</strong> {generatedAiPlan.executive_summary}
                            </p>

                            <div className="space-y-1.5">
                              <span className="text-xs font-semibold text-slate-300 block">
                                Tarjetas Trello generadas ({generatedAiPlan.tasks.length}):
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {generatedAiPlan.tasks.map((t, idx) => (
                                  <div
                                    key={idx}
                                    className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/60 text-xs space-y-1"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-white text-[11px]">
                                        {t.title}
                                      </span>
                                      <span className="rounded bg-slate-800 px-1.5 py-0.2 text-[9px] text-indigo-300 uppercase">
                                        {t.priority}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 line-clamp-1">
                                      {t.description}
                                    </p>
                                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                                      <span>Columna: {t.stage}</span>
                                      <span>⏱ {t.estimated_minutes}m</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="flex justify-end pt-2">
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={handleImportAiProject}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                🚀 Crear Tablero Trello con este Plan
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Creación Manual de Proyecto */}
                    <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/60 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                          <Settings2 className="h-4 w-4" /> Configuración de Proyecto Manual
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <input
                            type="text"
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            placeholder="Nombre del nuevo proyecto..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200"
                          />
                        </div>
                        <div>
                          <select
                            value={selectedAgileMethodology}
                            onChange={(e) =>
                              setSelectedAgileMethodology(e.target.value as AgileMethodology)
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200"
                          >
                            <option value="scrum">Scrum (Sprints & Incrementos)</option>
                            <option value="kanban">Kanban (Flujo Continuo & WIP Limits)</option>
                            <option value="lean">Lean / Kaizen (Eliminación de Desperdicio)</option>
                          </select>
                        </div>
                      </div>

                      {/* GUÍA INTERACTIVA DE METODOLOGÍA & MAPEO VISUAL */}
                      <AgileMethodologyGuideBox methodology={selectedAgileMethodology} />

                      <div className="flex justify-end">
                        <button
                          type="button"
                          disabled={submitting || !newProjectName.trim()}
                          onClick={submitCreateWorkProject}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-3.5 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Guardar Proyecto
                        </button>
                      </div>
                    </div>

                    {/* ============================================================ */}
                    {/* TABLERO TRELLO INTERACTIVO DEL PROYECTO SELECCIONADO        */}
                    {/* ============================================================ */}
                    {activeProject && (
                      <div className="space-y-4">
                        {/* Cabecera del Tablero */}
                        <div className="p-5 bg-slate-950/80 rounded-2xl border border-indigo-500/30 flex flex-wrap items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-base">📋</span>
                              <h4 className="text-base font-bold text-white">
                                {activeProject.name}
                              </h4>
                              <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-300 uppercase">
                                {activeMethodology}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400">
                              {activeProject.description ||
                                "Gestión ágil con tarjetas y flujo de trabajo continuo."}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-4">
                            <button
                              type="button"
                              onClick={() => setShowAgileProjectGuide((v) => !v)}
                              className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-300 hover:bg-indigo-500/20 cursor-pointer transition flex items-center gap-1.5"
                            >
                              <span>📖</span> {showAgileProjectGuide ? "Ocultar Guía Ágil" : "Guía Ágil & Mapeo"}
                            </button>
                            <div className="text-right">
                              <span className="text-xs font-bold text-white block">
                                {completedTasks.length} de {projectTasks.length} tareas completadas
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {progressPct}% de avance • ⏱ {activeProject.total_minutes_invested || 0}m Deep Work
                              </span>
                            </div>
                            <div className="w-24 bg-slate-800 rounded-full h-2.5 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full rounded-full transition-all"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Despliegue interactivo de la Guía Ágil en el Tablero Activo */}
                        {showAgileProjectGuide && (
                          <AgileMethodologyGuideBox methodology={activeMethodology} compact={false} />
                        )}

                        {/* Columnas del Tablero Trello */}
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-start">
                          {trelloStages.map((stageName, stageIdx) => {
                            const cardsInStage = projectTasks.filter(
                              (t) =>
                                t.stage === stageName ||
                                (!t.stage && stageIdx === 0)
                            );

                            return (
                              <div
                                key={stageName}
                                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 space-y-3 min-h-[260px] flex flex-col justify-between"
                              >
                                <div>
                                  {/* Encabezado de Columna */}
                                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-bold text-slate-200">
                                        {stageName}
                                      </span>
                                    </div>
                                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                                      {cardsInStage.length}
                                    </span>
                                  </div>

                                  {/* Lista de Tarjetas en la Columna */}
                                  <div className="space-y-2.5">
                                    {cardsInStage.map((card) => {
                                      const priorityColor =
                                        card.priority === "critical"
                                          ? "border-rose-500/40 bg-rose-950/20 text-rose-300"
                                          : card.priority === "high"
                                          ? "border-amber-500/40 bg-amber-950/20 text-amber-300"
                                          : card.priority === "medium"
                                          ? "border-indigo-500/40 bg-indigo-950/20 text-indigo-300"
                                          : "border-slate-700 bg-slate-800/40 text-slate-400";

                                      return (
                                        <div
                                          key={card.id}
                                          className={`p-3 rounded-xl border transition-all text-xs space-y-2 shadow-sm ${
                                            card.is_completed
                                              ? "border-emerald-500/30 bg-emerald-950/15 opacity-80"
                                              : "border-slate-800 bg-slate-950/90 hover:border-slate-700"
                                          }`}
                                        >
                                          {/* Prioridad y Recompensa */}
                                          <div className="flex items-center justify-between gap-1">
                                            <span
                                              className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase border ${priorityColor}`}
                                            >
                                              {card.priority}
                                            </span>
                                            <span className="font-mono text-[10px] font-bold text-emerald-400">
                                              +{card.reward_gp?.toLocaleString("es-CO") || 5000} GP
                                            </span>
                                          </div>

                                          {/* Título y Descripción */}
                                          <div>
                                            <h5
                                              className={`font-semibold text-xs leading-snug ${
                                                card.is_completed
                                                  ? "line-through text-slate-400"
                                                  : "text-white"
                                              }`}
                                            >
                                              {card.title}
                                            </h5>
                                            {card.description && (
                                              <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
                                                {card.description}
                                              </p>
                                            )}
                                          </div>

                                          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-850">
                                            <span>⏱ {card.estimated_minutes || 45}m</span>
                                            {card.is_completed ? (
                                              <span className="text-emerald-400 font-bold flex items-center gap-1">
                                                <Check className="h-3 w-3" /> Hecho
                                              </span>
                                            ) : (
                                              <div className="flex items-center gap-1">
                                                {/* Mover a columna anterior */}
                                                {stageIdx > 0 && (
                                                  <button
                                                    type="button"
                                                    title={`Mover a ${trelloStages[stageIdx - 1]}`}
                                                    onClick={() =>
                                                      handleMoveTrelloCard(
                                                        card.id,
                                                        trelloStages[stageIdx - 1]
                                                      )
                                                    }
                                                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                                                  >
                                                    ←
                                                  </button>
                                                )}
                                                {/* Mover a columna siguiente */}
                                                {stageIdx < trelloStages.length - 1 && (
                                                  <button
                                                    type="button"
                                                    title={`Mover a ${trelloStages[stageIdx + 1]}`}
                                                    onClick={() =>
                                                      handleMoveTrelloCard(
                                                        card.id,
                                                        trelloStages[stageIdx + 1]
                                                      )
                                                    }
                                                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                                                  >
                                                    →
                                                  </button>
                                                )}
                                                {/* Completar tarjeta */}
                                                <button
                                                  type="button"
                                                  disabled={submitting}
                                                  onClick={() => handleCompleteTrelloCard(card.id)}
                                                  className="bg-emerald-600/80 hover:bg-emerald-600 text-white font-bold px-2 py-0.5 rounded text-[10px] transition-all cursor-pointer flex items-center gap-0.5 ml-1"
                                                >
                                                  <Check className="h-3 w-3" /> Listo
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Formulario para agregar tarjeta en esta columna */}
                                <div className="pt-2">
                                  {addingCardToStage === stageName ? (
                                    <div className="p-2.5 rounded-xl border border-indigo-500/40 bg-slate-950 space-y-2">
                                      <input
                                        type="text"
                                        value={newCardTitle}
                                        onChange={(e) => setNewCardTitle(e.target.value)}
                                        placeholder="Título de la tarjeta..."
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-white"
                                      />
                                      <textarea
                                        rows={2}
                                        value={newCardDesc}
                                        onChange={(e) => setNewCardDesc(e.target.value)}
                                        placeholder="Descripción o criterios de aceptación..."
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-white"
                                      />
                                      <div className="grid grid-cols-2 gap-2">
                                        <select
                                          value={newCardPriority}
                                          onChange={(e) =>
                                            setNewCardPriority(
                                              e.target.value as "low" | "medium" | "high" | "critical"
                                            )
                                          }
                                          className="bg-slate-900 border border-slate-700 rounded p-1 text-[11px] text-white"
                                        >
                                          <option value="medium">Media</option>
                                          <option value="high">Alta</option>
                                          <option value="critical">Crítica</option>
                                          <option value="low">Baja</option>
                                        </select>
                                        <input
                                          type="number"
                                          min="10"
                                          value={newCardMinutes}
                                          onChange={(e) =>
                                            setNewCardMinutes(Math.max(10, Number(e.target.value)))
                                          }
                                          className="bg-slate-900 border border-slate-700 rounded p-1 text-[11px] text-white"
                                        />
                                      </div>
                                      <div className="flex items-center justify-between pt-1">
                                        <button
                                          type="button"
                                          onClick={() => setAddingCardToStage(null)}
                                          className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
                                        >
                                          Cancelar
                                        </button>
                                        <button
                                          type="button"
                                          disabled={submitting || !newCardTitle.trim()}
                                          onClick={() => handleAddTrelloCard(stageName)}
                                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-2.5 py-1 rounded text-[11px] cursor-pointer"
                                        >
                                          Agregar Tarjeta
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAddingCardToStage(stageName);
                                        setNewCardTitle("");
                                        setNewCardDesc("");
                                      }}
                                      className="w-full py-1.5 rounded-lg border border-dashed border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-all"
                                    >
                                      <span>+</span> Añadir tarjeta
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Guía y Reglas de Implementación Ágil */}
                    <div id="agile-guide-container" className="p-4 bg-indigo-950/30 border border-indigo-500/20 rounded-xl text-xs space-y-2 text-indigo-200">
                      <h5 className="font-bold flex items-center gap-1.5 text-indigo-300">
                        <span>💡</span> Principios de Ejecución Ágil ({activeMethodology.toUpperCase()}):
                      </h5>
                      {activeMethodology === "scrum" ? (
                        <p className="leading-relaxed">
                          <strong>Reglas de Sprint & Backlog:</strong> Divide tus grandes entregables en iteraciones de 1 a 2 semanas. Cada tarjeta completada en el Trello libera GP automáticamente a tu Billetera y alimenta tu progreso de nivel.
                        </p>
                      ) : activeMethodology === "kanban" ? (
                        <p className="leading-relaxed">
                          <strong>Límites WIP Estrictos:</strong> No inicies una nueva tarjeta si ya tienes 2 tareas en estado &ldquo;En Proceso (WIP)&rdquo;. Termina lo que empezaste para reducir los tiempos de ciclo y destrabar cuellos de botella.
                        </p>
                      ) : (
                        <p className="leading-relaxed">
                          <strong>Filosofía Kaizen & Lean:</strong> Identifica pasos manuales repetitivos (ej. copiar y pegar datos de OPGs, conciliación manual de Excel) y construye scripts o macros en la etapa &ldquo;Optimizar / Automatizar&rdquo;.
                        </p>
                      )}
                    </div>

                    {/* Registro de Sesión Deep Work vinculada al Proyecto */}
                    <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/60 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <span className="text-xs font-semibold text-slate-300 block">
                          Registrar Bloque de Deep Work en Proyecto Seleccionado
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {activeProject?.name || "Selecciona un proyecto"} • Etapa: {selectedAgileStage || activeProject?.current_stage || "En Progreso"} (1.25x GP)
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min="15"
                          value={workMinutes}
                          onChange={(e) => setWorkMinutes(Math.max(1, Number(e.target.value)))}
                          className="w-20 bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200"
                        />
                        <button
                          type="button"
                          disabled={submitting || !activeProject}
                          onClick={() => {
                            submitSkillSession({
                              domain: "work",
                              work_mode: "projects",
                              project_id: activeProject?.id,
                              deliverable: activeProject ? activeProject.name : "Proyecto Estratégico",
                              agile_stage: selectedAgileStage || activeProject?.current_stage,
                              impact_level: "high_impact",
                              duration_minutes: workMinutes,
                            });
                          }}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2.5 rounded-lg text-xs transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
                        >
                          <Zap className="h-4 w-4" /> Registrar Avance en Proyecto (+GP / +XP)
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Historial de Entregables & Sesiones Recientes */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-5 space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center justify-between">
                <span>Historial de Sesiones de Trabajo Recientes</span>
                <span className="text-xs text-slate-400">
                  {state.skill_sessions.filter((s) => s.domain === "work").length} sesión(es) registradas
                </span>
              </h4>
              <div className="max-h-48 space-y-2 overflow-auto pr-1">
                {state.skill_sessions
                  .filter((s) => s.domain === "work")
                  .map((sess) => (
                    <div
                      key={sess.id}
                      className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs"
                    >
                      <div>
                        <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-indigo-300">
                          {sess.metadata?.work_mode === "projects" ? "PROYECTO" : "OPERATIVO"}
                        </span>{" "}
                        <span className="font-semibold text-white">
                          {sess.title}
                        </span>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {sess.details}
                        </p>
                      </div>
                      <span className="font-mono font-bold text-indigo-400">
                        +{sess.gp_earned.toLocaleString("es-CO")} GP
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* EDIFICIO ESPECIALIZADO: EL OBSERVATORIO CÓSMICO (DEEP WORK) */}
        {activeSkillTab === "general" && (
          <ObservatorioBuilding
            sessions={state.skill_sessions || []}
            playerLevel={state.player_level}
            skillLevel={
              state.skill_summaries?.find((s) => s.domain === "general")?.level || 1
            }
            totalGpEarned={
              state.skill_summaries?.find((s) => s.domain === "general")?.total_gp_earned || 0
            }
            isCozyActive={isCozyActive}
            onRefreshState={fetchState}
            onSubmitDirectSkillSession={submitSkillSession}
          />
        )}

        {(activeSkillTab === "gaming" ||
          activeSkillTab === "sports") && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/80 p-5 lg:col-span-6">
              <h3 className="text-sm font-bold text-white">
                {activeSkillTab === "gaming"
                  ? "🎮 Registrar Sesión de Videojuegos / eSports Consciente"
                  : activeSkillTab === "sports"
                  ? "🏅 Registrar Entrenamiento o Competencia Deportiva"
                  : `💡 Registrar Sesión: ${
                      state.skill_summaries.find((s) => s.domain === "general")
                        ?.label || "Habilidad Personalizada"
                    }`}
              </h3>

              {/* CRONÓMETRO EN VIVO DE GAMING / DEPORTES */}
              <div className="rounded-xl border border-slate-700 bg-gradient-to-b from-slate-900/90 to-slate-950 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs font-bold text-slate-200">
                      {liveTimerDomain === activeSkillTab && !liveTimerPaused
                        ? "● Sesión activa en vivo..."
                        : liveTimerDomain === activeSkillTab && liveTimerPaused
                        ? "⏸ Sesión pausada"
                        : "Cronómetro de Sesión en Vivo"}
                    </span>
                  </div>
                  <span className="font-mono text-xl font-black tracking-tight text-white">
                    {liveTimerDomain === activeSkillTab
                      ? formatStopwatch(liveTimerSeconds)
                      : "00:00"}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {liveTimerDomain !== activeSkillTab ? (
                    <button
                      type="button"
                      onClick={() => startLiveTimer(activeSkillTab)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-500 cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5" /> ▶ Iniciar Cronómetro en Vivo
                    </button>
                  ) : (
                    <>
                      {liveTimerPaused ? (
                        <button
                          type="button"
                          onClick={resumeLiveTimer}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer"
                        >
                          <Play className="h-3.5 w-3.5" /> Reanudar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={pauseLiveTimer}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-500 cursor-pointer"
                        >
                          <Pause className="h-3.5 w-3.5" /> Pausar
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => stopAndLogLiveTimer(activeSkillTab)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-3.5 py-1.5 text-xs font-extrabold text-white shadow hover:brightness-110 disabled:opacity-50 cursor-pointer"
                      >
                        <Square className="h-3.5 w-3.5" /> ⏹ Finalizar y Registrar ({Math.max(1, Math.round(liveTimerSeconds / 60))} min)
                      </button>
                      <button
                        type="button"
                        onClick={resetLiveTimer}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2 py-1.5 text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                      >
                        <RotateCcw className="h-3 w-3" /> Reset
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400">
                  Logro, Partida, Entrenamiento o Avance de la Sesión:
                </label>
                <input
                  type="text"
                  value={customSessionTitle}
                  onChange={(e) => setCustomSessionTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">
                  Duración (minutos):
                </label>
                <input
                  type="number"
                  min={15}
                  value={customSessionMinutes}
                  onChange={(e) =>
                    setCustomSessionMinutes(Math.max(15, Number(e.target.value)))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() =>
                  submitSkillSession({
                    domain: activeSkillTab,
                    deliverable: customSessionTitle,
                    impact_level: "high_impact",
                    duration_minutes: customSessionMinutes,
                  })
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                Registrar Sesión ({customSessionMinutes}m) y Reclamar GP + XP
              </button>
            </div>
            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/80 p-5 lg:col-span-6">
              <h4 className="text-sm font-bold text-white">
                Historial de Sesiones Recientes
              </h4>
              <div className="max-h-44 space-y-2 overflow-auto pr-1">
                {state.skill_sessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs"
                  >
                    <div>
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-300">
                        {sess.domain}
                      </span>{" "}
                      <span className="font-semibold text-white">
                        {sess.title}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-emerald-400">
                      +{sess.gp_earned.toLocaleString("es-CO")} GP
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            DISCIPLINA: JOURNALING & REFLEXIÓN GUIADA (SANTUARIO LIBRE DE CULPA)
           ===================================================================== */}
        {activeSkillTab === "journaling" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* PORTAL DE REFLEXIÓN INTERACTIVO GUIADO */}
            <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/80 p-6 shadow-xl lg:col-span-7">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">✍️</span>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Portal de Reflexión Guiada (Santuario Libre de Culpa)
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Preguntas para ordenar tu mente y cosechar victorias. Es voluntario y 100% libre de culpa.
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-500/30">
                  +100 XP • +600 GP
                </span>
              </div>

              {journalToastMsg && (
                <div className="flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-950/80 p-3 text-xs font-bold text-emerald-200 animate-in fade-in">
                  <span>{journalToastMsg}</span>
                  <button onClick={() => setJournalToastMsg(null)} className="text-emerald-400 hover:text-white cursor-pointer">✕</button>
                </div>
              )}

              {/* Selector de Ánimo & Nivel de Energía */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-xl border border-white/[0.06] bg-slate-900/40 p-3">
                <div>
                  <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                    Estado de Ánimo / Mood:
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { id: "enfocado", label: "⚡ Enfocado" },
                      { id: "sereno", label: "🧘 Sereno" },
                      { id: "motivado", label: "🔥 Motivado" },
                      { id: "descanso", label: "🔋 En Pausa" },
                      { id: "reflexivo", label: "🧠 Reflexivo" },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setJournalMood(m.id)}
                        className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition cursor-pointer ${
                          journalMood === m.id
                            ? "bg-emerald-600 text-white shadow"
                            : "bg-slate-950/70 text-slate-400 hover:text-white hover:bg-slate-800"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                    Nivel de Energía Cognitiva:
                  </label>
                  <div className="flex items-center gap-1.5 mt-1">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setJournalEnergyRating(lvl)}
                        className={`h-7 w-7 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center ${
                          journalEnergyRating >= lvl
                            ? "bg-amber-500/25 text-amber-300 border border-amber-500/40"
                            : "bg-slate-950/60 text-slate-500 border border-slate-800"
                        }`}
                      >
                        ⚡
                      </button>
                    ))}
                    <span className="text-[11px] font-mono text-slate-400 ml-1.5">
                      {journalEnergyRating}/5 ({journalEnergyRating >= 4 ? "Óptimo" : journalEnergyRating >= 3 ? "Moderado" : "Batería Baja"})
                    </span>
                  </div>
                </div>
              </div>

              {/* Preguntas Guiadas */}
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
                    <span className="text-emerald-400 font-bold">1.</span> Estado del Tablero & Victorias de Hoy:
                  </label>
                  <textarea
                    rows={2}
                    value={journalBoardState}
                    onChange={(e) => setJournalBoardState(e.target.value)}
                    placeholder="¿Qué metas, tareas o micro-victorias conquistaste hoy en tus proyectos o habilidades?"
                    className="w-full rounded-xl border border-white/10 bg-slate-900/60 p-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
                    <span className="text-cyan-400 font-bold">2.</span> Balance Mental & Claridad Emocional:
                  </label>
                  <textarea
                    rows={2}
                    value={journalMentalBalance}
                    onChange={(e) => setJournalMentalBalance(e.target.value)}
                    placeholder="¿Cómo estuvo tu diálogo interno y tu enfoque? ¿Hubo ruido, prisa o calma?"
                    className="w-full rounded-xl border border-white/10 bg-slate-900/60 p-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
                    <span className="text-amber-400 font-bold">3.</span> Insights & Aprendizajes:
                  </label>
                  <textarea
                    rows={2}
                    value={journalInsights}
                    onChange={(e) => setJournalInsights(e.target.value)}
                    placeholder="¿Qué lección te dejó el día? ¿Qué ajuste o eureka descubriste sobre tu ritmo?"
                    className="w-full rounded-xl border border-white/10 bg-slate-900/60 p-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
                    <span className="text-indigo-400 font-bold">4.</span> Plan Táctico para Mañana:
                  </label>
                  <textarea
                    rows={2}
                    value={journalActionPlan}
                    onChange={(e) => setJournalActionPlan(e.target.value)}
                    placeholder="¿Cuáles son tus 1 a 3 prioridades clave para mañana al levantarte?"
                    className="w-full rounded-xl border border-white/10 bg-slate-900/60 p-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Botón de Guardado */}
              <button
                type="button"
                disabled={submitting}
                onClick={handleSaveJournalReflection}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 p-3 text-xs font-bold text-white shadow-xl hover:brightness-110 active:scale-98 transition disabled:opacity-50 cursor-pointer"
              >
                <Save className="h-4 w-4" />
                <span>Registrar Reflexión en Santuario (+100 XP • +600 GP)</span>
              </button>
            </div>

            {/* HISTORIAL & BITÁCORA PRIVADA */}
            <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/80 p-6 shadow-xl lg:col-span-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">
                      Bitácora de Reflexiones
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    {journalHistory.length} entrada(s)
                  </span>
                </div>

                <div className="my-3 rounded-xl border border-white/[0.06] bg-slate-900/50 p-3 text-xs italic text-slate-300">
                  &ldquo;El progreso no es una línea rígida; es un santuario al que vuelves voluntariamente para calibrar tu mente.&rdquo;
                </div>

                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {journalHistory.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      Aún no has registrado reflexiones en esta partida.
                    </div>
                  ) : (
                    journalHistory.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-white/[0.06] bg-slate-900/50 p-3 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 uppercase">
                            {item.mood}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500">
                            {new Date(item.timestamp).toLocaleDateString("es-CO", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        {item.boardState && (
                          <p className="text-slate-200">
                            <strong className="text-emerald-400">Victorias:</strong> {item.boardState}
                          </p>
                        )}
                        {item.mentalBalance && (
                          <p className="text-slate-300">
                            <strong className="text-cyan-400">Balance:</strong> {item.mentalBalance}
                          </p>
                        )}
                        {item.insights && (
                          <p className="text-slate-300">
                            <strong className="text-amber-400">Insight:</strong> {item.insights}
                          </p>
                        )}
                        {item.actionPlan && (
                          <p className="text-slate-300">
                            <strong className="text-indigo-400">Plan:</strong> {item.actionPlan}
                          </p>
                        )}

                        <div className="pt-1 border-t border-white/[0.05] flex items-center justify-between text-[10px] font-mono text-slate-400">
                          <span>Energía: {item.energy}/5</span>
                          <span className="font-bold text-emerald-400">+{item.gpEarned} GP • +{item.xpEarned} XP</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            DISCIPLINAS DEL SANTUARIO DE ARTE, BIENESTAR & DESCONEXIÓN CERO CULPA
            (Jardinería, Dibujo, Cerámica, Senderismo, Cocina)
           ===================================================================== */}
        {(activeSkillTab === "gardening" ||
          activeSkillTab === "drawing" ||
          activeSkillTab === "ceramics" ||
          activeSkillTab === "hiking" ||
          activeSkillTab === "cooking") && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/80 p-6 shadow-xl lg:col-span-7">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">
                    {ALL_SKILL_DOMAINS_PORTAL.find((p) => p.domain === activeSkillTab)?.badge || "🌿"}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {ALL_SKILL_DOMAINS_PORTAL.find((p) => p.domain === activeSkillTab)?.label} (Refugio Libre de Culpa)
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {ALL_SKILL_DOMAINS_PORTAL.find((p) => p.domain === activeSkillTab)?.desc}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-500/30">
                  +95 XP • +500 GP
                </span>
              </div>

              {/* SESIÓN RÁPIDA & NOTAS */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Edit3 className="h-3.5 w-3.5 text-emerald-400" />
                    Bloc de Notas por Sesión (Técnicas, Materiales, Recetas, Apuntes)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleOpenSessionModal(
                        activeSkillTab,
                        ALL_SKILL_DOMAINS_PORTAL.find((p) => p.domain === activeSkillTab)?.label || "Sesión Creativa",
                        30
                      )
                    }
                    className="flex items-center gap-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 px-2.5 py-1 text-[11px] font-bold text-indigo-200 transition cursor-pointer"
                  >
                    <Timer className="h-3 w-3" />
                    <span>Lanzar Modo Pomodoro Activo</span>
                  </button>
                </div>

                <textarea
                  rows={4}
                  value={sessionNotesText}
                  onChange={(e) => {
                    setSessionNotesText(e.target.value);
                    if (typeof window !== "undefined") {
                      try {
                        localStorage.setItem(`rpg_session_notes_${activeSkillTab}`, e.target.value);
                      } catch {}
                    }
                  }}
                  placeholder={`Escribe apuntes, materiales usados o reflexiones para tu sesión de ${activeSkillTab}...`}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const tempSession: SessionIntelligenceData = {
                        id: `santuario-${Date.now()}`,
                        domain: activeSkillTab,
                        title: ALL_SKILL_DOMAINS_PORTAL.find((p) => p.domain === activeSkillTab)?.label || "Santuario",
                        durationMinutes: 30,
                        xpEarned: 95,
                        gpEarned: 500,
                        sessionNotes: sessionNotesText,
                        timestamp: new Date().toISOString(),
                      };
                      handleSyncToNotion(tempSession);
                    }}
                    className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 transition cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copiar Bitácora para Notion</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      await submitSkillSession({
                        domain: activeSkillTab,
                        duration_minutes: 30,
                        title: `Sesión de ${ALL_SKILL_DOMAINS_PORTAL.find((p) => p.domain === activeSkillTab)?.label}`,
                        notes: sessionNotesText.trim(),
                      });
                      triggerHaptic("success");
                      setJournalToastMsg(`✨ ¡Sesión de ${activeSkillTab} registrada sin culpa! +95 XP y +500 GP.`);
                      setTimeout(() => setJournalToastMsg(null), 4000);
                      setSessionNotesText("");
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-extrabold text-white shadow-lg cursor-pointer transition"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Registrar Sesión Libre de Culpa</span>
                  </button>
                </div>
              </div>
            </div>

            {/* LATERAL: FILOSOFÍA DE CERO CULPA & RESUMEN */}
            <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/80 p-6 shadow-xl lg:col-span-5 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🕊️</span>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Filosofía del Santuario Cero Culpa
                  </h4>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Esta disciplina existe exclusivamente para tu disfrute, calma y balance mental. No hay cuotas mínimas obligatorias, no hay penalizaciones por descanso y no interrumpe tu racha de hábitos.
                </p>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3 space-y-1 text-xs">
                  <span className="font-bold text-emerald-300 block">✨ Beneficios Automáticos:</span>
                  <ul className="text-slate-400 space-y-0.5 text-[11px] list-disc list-inside">
                    <li>Suma de XP y avance en el nivel de habilidad personal.</li>
                    <li>Generación de GP para tu billetera de bienestar.</li>
                    <li>Registro persistente en el mapa de calor de analítica.</li>
                  </ul>
                </div>
              </div>

              <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-400">
                <span>Estado de Culpa:</span>
                <span className="font-bold text-emerald-400">0% Culpa • 100% Gozo</span>
              </div>
            </div>
          </div>
        )}
      </section>
      )}

      {/* =====================================================================
          TAB 5: ECONOMÍA DE RESTRICCIÓN (WISHLIST) & CÁMARA DE PASIVOS
         ===================================================================== */}
      {!dedicatedSkillDomain && homeActiveTab === "debts" && (
        <div className="space-y-8 mb-8">
          <LookerStudioFinanceDashboard
            initialMovements={state.financial_movements || INITIAL_FINANCIAL_MOVEMENTS}
            currency={state.currency || "COP"}
            monthlyFreeCashflow={freeCashflowCop}
            onMovementAdded={(mov) => {
              setState((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  ...(mov.tipo === "Gasto"
                    ? { variable_ops_spent_cop: (prev.variable_ops_spent_cop || 0) + mov.monto }
                    : { monthly_income_cop: (prev.monthly_income_cop || 0) + mov.monto }),
                  financial_movements: [mov, ...(prev.financial_movements || INITIAL_FINANCIAL_MOVEMENTS)],
                };
              });
            }}
            wishlistSlot={
              /* 1. CATÁLOGO WISHLIST (ECONOMÍA DE RESTRICCIÓN) */
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-amber-400" />
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Tienda Wishlist (Economía de Restricción)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Redime recompensas y gustos personales forjados con tus hábitos diarios.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {((state.variable_ops_spent_cop > state.variable_ops_budget_cop) ||
                  state.wallet_gp < 0 ||
                  state.total_penalty_gp > 0) ? (
                  <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-300 ring-1 ring-amber-500/40 animate-pulse">
                    ⚡ Impuesto al Impulso (+20%) Activo
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-300">
                    ✓ Precios Regulares
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {state.wishlist.map((item) => {
                const effectiveCost =
                  item.effective_cost_gp ?? item.cost_gp;
                const minStreak =
                  item.min_streak_required ??
                  (item.priority === 1 ? 1 : item.priority === 2 ? 3 : 7);
                const streakPassed =
                  state.current_streak_days >= minStreak;
                const canAfford = state.wallet_gp >= effectiveCost;
                const isOverdrawn = state.wallet_gp < 0;
                const isLocked =
                  item.is_redeemed ||
                  !streakPassed ||
                  isOverdrawn ||
                  !canAfford;

                return (
                  <div
                    key={item.id}
                    className={`flex flex-col justify-between rounded-xl border p-4 transition ${
                      item.is_redeemed
                        ? "border-slate-800 bg-slate-950/40 opacity-50"
                        : isLocked
                        ? "border-slate-800 bg-slate-950/70"
                        : "border-amber-500/30 bg-slate-950/90 ring-1 ring-amber-500/20"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-amber-400">
                          Prioridad #{item.priority}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            streakPassed
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-rose-500/20 text-rose-300"
                          }`}
                        >
                          Racha: {minStreak}d mín
                        </span>
                      </div>
                      <h3 className="mt-1 text-sm font-semibold text-white">
                        {item.name}
                      </h3>
                      <div className="mt-1.5 flex items-baseline gap-2">
                        <p className="text-base font-bold text-amber-300">
                          {effectiveCost.toLocaleString("es-CO")} GP
                        </p>
                        {(item.impulse_tax_pct || 0) > 0 && (
                          <span className="text-[10px] text-amber-400/80 font-mono">
                            (+20% multa)
                          </span>
                        )}
                      </div>
                      {item.locked_reason && !item.is_redeemed && (
                        <p className="mt-2 text-[11px] leading-tight text-rose-400 bg-rose-950/30 p-1.5 rounded border border-rose-500/20">
                          🔒 {item.locked_reason}
                        </p>
                      )}
                    </div>
                    <button
                      disabled={submitting}
                      onClick={() => {
                        if (item.is_redeemed) {
                          alert("Este ítem ya ha sido redimido con éxito anteriormente.");
                          return;
                        }
                        if (isLocked) {
                          alert(
                            "🔒 Ítem Bloqueado:\n" +
                              (item.locked_reason ||
                                (!streakPassed
                                  ? `Requiere una racha activa de al menos ${minStreak} días para poder canjearlo.`
                                  : isOverdrawn
                                  ? "Tu Billetera está en sobregiro (Maldición Activa). Realiza sesiones de estudio o trabajo para purificarla antes de canjear."
                                  : "No dispones de suficientes GP en tu Billetera para este ítem."))
                          );
                          return;
                        }
                        redeemWishlist(item);
                      }}
                      className={`mt-3 w-full rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer transition ${
                        item.is_redeemed
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : isLocked
                          ? "border-slate-700 bg-slate-800/60 text-slate-400 hover:border-amber-500/50 hover:text-amber-200"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                      }`}
                    >
                      {item.is_redeemed
                        ? "Redimido ✓"
                        : !streakPassed
                        ? `Requiere Racha ${minStreak}d 🔒`
                        : isOverdrawn
                        ? "Sobregiro Activo ⚠️"
                        : canAfford
                        ? "Canjear con GP"
                        : "Faltan GP 🔒"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        }
        debtBossesSlot={
          /* 2. CÁMARA DE PASIVOS & DEBT BOSSES (OPCIONAL / COLAPSABLE) */
          <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Swords className="h-5 w-5 text-rose-400" />
                <div>
                  <h3 className="font-bold text-white text-base">
                    Cámara de Pasivos & Debt Bosses (Opcional)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Cálculo de intereses DoT, simulación Bola de Nieve vs Avalancha y pociones de purificación.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDebtArena((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 cursor-pointer transition shadow"
              >
                {showDebtArena ? (
                  <>
                    <ChevronUp className="h-4 w-4" /> Ocultar Arena de Pasivos
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" /> Desplegar Arena de Pasivos ({state.bosses.length} Bosses)
                  </>
                )}
              </button>
            </div>

            {showDebtArena && (
              <div className="space-y-6 pt-2">
                {/* GRÁFICA DE AMORTIZACIÓN & DÍA DE LIBERTAD FINANCIERA */}
                <AmortizationFreedomChart
                  bosses={state.bosses || []}
                  monthlyFreeCashflow={freeCashflowCop}
                />

                {/* DEBT BOSSES ARENA + SNOWBALL VS AVALANCHE + COMBO OVERFLOW + COUNTER-ATTACK */}
                <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="mb-5 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Swords className="h-5 w-5 text-rose-400" />
              <h2 className="text-lg font-bold text-white">
                Arena de Debt Bosses (Estrategia:{" "}
                {state.debt_strategy === "avalanche"
                  ? "Avalancha — Mayor Tasa E.A."
                  : "Bola de Nieve — Menor Saldo HP"}
                )
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              Interés total proyectado (Bola de Nieve): $
              {state.debt_strategy_comparison.snowball_total_interest_cop.toLocaleString(
                "es-CO"
              )}{" "}
              vs (Avalancha): $
              {state.debt_strategy_comparison.avalanche_total_interest_cop.toLocaleString(
                "es-CO"
              )}{" "}
              •{" "}
              <span className="font-semibold text-emerald-400">
                Ahorro con Avalancha: $
                {state.debt_strategy_comparison.interest_saved_with_avalanche_cop.toLocaleString(
                  "es-CO"
                )}{" "}
                COP
              </span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              disabled={submitting}
              onClick={() =>
                switchDebtStrategy(
                  state.debt_strategy === "snowball" ? "avalanche" : "snowball"
                )
              }
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-500/15 px-3.5 py-2 text-xs font-semibold text-indigo-300 ring-1 ring-indigo-500/30 hover:bg-indigo-500/25 cursor-pointer"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Cambiar a{" "}
              {state.debt_strategy === "snowball"
                ? "Modo Avalancha (Mayor Tasa 1°)"
                : "Modo Bola de Nieve (Menor Saldo 1°)"}
            </button>
            {state.bosses.length > 0 && (
              <button
                disabled={submitting}
                onClick={() => attackBoss(state.bosses[0].name, 200000)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500/15 px-3.5 py-2 text-xs font-semibold text-cyan-300 ring-1 ring-cyan-500/30 hover:bg-cyan-500/25 cursor-pointer"
              >
                <Zap className="h-3.5 w-3.5" />
                Combo Overflow ($200k a {state.bosses[0].name} ➔ Cascada)
              </button>
            )}
            <button
              disabled={submitting || state.bosses.length === 0}
              onClick={triggerBossCounterAttack}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/15 px-3.5 py-2 text-xs font-semibold text-rose-300 ring-1 ring-rose-500/30 hover:bg-rose-500/25 cursor-pointer disabled:opacity-40"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Simular Cierre de Mes (Counter-Attack)
            </button>
          </div>
        </div>

        {state.bosses.length === 0 ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-6 text-center">
            <p className="text-sm font-bold text-emerald-300">
              🛡️ Modo Ahorro Activo — No tienes deudas registradas
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Tu flujo libre mensual (${freeCashflowCop.toLocaleString("es-CO")}{" "}
              {state.currency || "COP"}) va directo a tus metas de ahorro e
              inversión.
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {state.bosses.map((boss) => {
            const hpPct = Math.round((boss.current_hp / boss.max_hp) * 100);
            const isDefeated = boss.current_hp <= 0;
            const ttk = state.ttk_projections.find((t) => t.name === boss.name);

            return (
              <div
                key={boss.id}
                className={`rounded-xl border p-5 transition ${
                  isDefeated
                    ? "border-emerald-500/30 bg-emerald-950/10 opacity-75"
                    : boss.status === "enraged"
                    ? "border-amber-500/60 bg-amber-950/20 ring-1 ring-amber-500/40"
                    : boss.priority_order === 1
                    ? "border-rose-500/40 bg-slate-950/90 ring-1 ring-rose-500/20"
                    : "border-slate-800 bg-slate-950/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skull
                      className={`h-4 w-4 ${
                        isDefeated
                          ? "text-emerald-400"
                          : boss.status === "enraged"
                          ? "text-amber-400 animate-pulse"
                          : "text-rose-400"
                      }`}
                    />
                    <h3 className="font-bold text-white">{boss.name}</h3>
                    {boss.status === "enraged" && (
                      <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                        ENRAGED 🔥
                      </span>
                    )}
                  </div>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-300">
                    {boss.interest_rate_ea}% E.A.
                  </span>
                </div>

                <div className="mt-3 flex items-baseline justify-between text-xs">
                  <span className="text-slate-400">HP Actual:</span>
                  <span className="text-sm font-mono font-bold text-rose-300">
                    ${boss.current_hp.toLocaleString("es-CO")} / $
                    {boss.max_hp.toLocaleString("es-CO")}
                  </span>
                </div>

                <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full transition-all duration-500 ${
                      isDefeated
                        ? "bg-emerald-500"
                        : boss.status === "enraged"
                        ? "bg-gradient-to-r from-amber-500 to-rose-600"
                        : "bg-gradient-to-r from-rose-600 to-amber-500"
                    }`}
                    style={{ width: `${Math.min(100, hpPct)}%` }}
                  />
                </div>

                {/* TTK PROJECTION & MIN PAYMENT */}
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="inline-flex items-center gap-1 text-cyan-300">
                    <CalendarClock className="h-3.5 w-3.5" />
                    TTK:{" "}
                    {isDefeated
                      ? "Derrotado"
                      : `${ttk?.months_to_kill}m (${ttk?.estimated_kill_date})`}
                  </span>
                  <span>
                    Abonado: ${boss.paid_this_month_cop.toLocaleString("es-CO")}
                  </span>
                </div>

                {/* DoT Pasivo & Enrage Countdown */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-1.5 rounded-lg bg-slate-900/80 px-2.5 py-1.5 text-[11px]">
                  {boss.is_purified ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
                      🕊️ Purificado (DoT 0 GP/día)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-semibold text-rose-400 animate-pulse">
                      <Flame className="h-3 w-3 text-rose-400" />
                      DoT Pasivo: -{(boss.daily_interest_dot_gp || 0).toLocaleString("es-CO")} GP/d
                    </span>
                  )}
                  {boss.days_until_cutoff != null && !isDefeated && (
                    <span
                      className={`font-semibold ${
                        boss.enrage_timer_active
                          ? "text-amber-300"
                          : "text-slate-400"
                      }`}
                    >
                      {boss.days_until_cutoff < 0
                        ? "⚠️ Corte Vencido"
                        : `Corte: día ${boss.cutoff_day || 20} (${boss.days_until_cutoff}d)`}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    disabled={submitting}
                    onClick={() => {
                      if (isDefeated) {
                        alert(`¡${boss.name} ya está totalmente derrotado y liquidado al 100%!`);
                        return;
                      }
                      attackBoss(boss.name, 50000);
                    }}
                    className="flex-1 rounded-lg bg-rose-500/15 px-2.5 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/25 disabled:opacity-40 cursor-pointer"
                  >
                    {isDefeated ? "Derrotado ✓" : "Atacar -$50k HP"}
                  </button>
                  <button
                    disabled={submitting}
                    onClick={() => {
                      if (isDefeated) {
                        alert(`¡${boss.name} ya ha sido liquidado! No requiere pociones de purificación.`);
                        return;
                      }
                      setPurifyingBossId(boss.id);
                      setPurifyAmountCop(
                        Math.min(
                          Math.max(
                            10000,
                            boss.min_monthly_payment_cop -
                              (boss.paid_this_month_cop || 0)
                          ),
                          boss.current_hp
                        )
                      );
                    }}
                    className="flex-1 rounded-lg border border-teal-500/40 bg-teal-500/15 px-2.5 py-1.5 text-xs font-semibold text-teal-300 hover:bg-teal-500/25 disabled:opacity-40 cursor-pointer"
                  >
                    {isDefeated ? "Purificado ✓" : "🧪 Poción Purificar"}
                  </button>
                </div>

                {purifyingBossId === boss.id && (
                  <div className="mt-3 rounded-xl border border-teal-500/40 bg-slate-900 p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between text-teal-300 font-bold">
                      <span>🧪 Poción de Purificación</span>
                      <button
                        onClick={() => setPurifyingBossId(null)}
                        className="text-slate-400 hover:text-white"
                      >
                        ✕
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Abona a capital para apaciguar al boss y detener el
                      sangrado DoT pasivo diario.
                    </p>
                    <div>
                      <label className="block text-[10px] text-slate-400">
                        Monto Abono (COP)
                      </label>
                      <input
                        type="number"
                        value={purifyAmountCop}
                        onChange={(e) =>
                          setPurifyAmountCop(Number(e.target.value))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white"
                      />
                    </div>
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={purifyUseWalletGp}
                        onChange={(e) =>
                          setPurifyUseWalletGp(e.target.checked)
                        }
                        className="rounded border-slate-700 text-teal-500"
                      />
                      Usar saldo Billetera GP (
                      {state.wallet_gp.toLocaleString("es-CO")} GP)
                    </label>
                    <div className="flex gap-2 pt-1">
                      <button
                        disabled={submitting}
                        onClick={() =>
                          executePurifyBoss(
                            boss.id,
                            purifyAmountCop,
                            purifyUseWalletGp
                          )
                        }
                        className="flex-1 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-500 disabled:opacity-40 cursor-pointer"
                      >
                        Confirmar Poción
                      </button>
                      <button
                        onClick={() => setPurifyingBossId(null)}
                        className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </section>
              </div>
            )}
          </div>
        }
      />
    </div>
  )}

  {/* =====================================================================
      TAB 5: LABORATORIO IOS SHORTCUTS, HÁBITOS & BITÁCORA DE PRUEBAS
     ===================================================================== */}
  {!dedicatedSkillDomain && homeActiveTab === "lab" && (
    <div className="space-y-8 mb-8">
      {/* CENTRO DE EXPORTACIÓN & CONEXIÓN NOTION / CSV / IOS */}
      <ExportAndNotionHub
        books={state.reading_books || []}
        bosses={state.bosses || []}
        fixedCosts={state.fixed_costs || []}
        solves={state.rubik_stats?.recent_solves || []}
        fullState={state}
        apiKey={state.user?.shortcut_api_key || ""}
        onImportBackup={handleImportBackup}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* COLUMNA IZQUIERDA: HÁBITOS RÁPIDOS (5 COLS) */}
        <div className="space-y-6 lg:col-span-5">
          {/* TABLERO DE HÁBITOS CON RACHA */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">
                  Misiones Diarias Rápidas (Buff Racha:{" "}
                  {state.streak_multiplier}x GP)
                </h2>
              </div>
              <span className="text-xs text-slate-400">
                Cada 7 rachas = +1 Escudo Aegis 🛡️
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {state.quests.map((q) => {
                const boostedReward = Math.round(
                  q.reward_gp * state.streak_multiplier
                );
                return (
                  <div
                    key={q.code}
                    className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/70 p-4"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-slate-400">
                          {q.code}
                        </span>
                        <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-400">
                          +{boostedReward.toLocaleString("es-CO")} GP
                        </span>
                      </div>
                      <p className="mt-1.5 font-semibold text-slate-100">
                        {q.title}
                      </p>
                    </div>
                    <button
                      disabled={submitting}
                      onClick={() => triggerHabitShortcut(q.code)}
                      className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Completar (+{q.reward_xp} XP)
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: LABORATORIO MULTIMODAL DE IOS SHORTCUTS (7 COLS) */}
        <div className="space-y-6 lg:col-span-7">
          <div className="rounded-2xl border border-indigo-500/30 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-400">
                <Smartphone className="h-5 w-5" />
                <h2 className="text-base font-bold text-white">
                  Laboratorio iOS Shortcuts + Gemini
                </h2>
              </div>
            </div>

            {/* TABS SELECTOR */}
            <div className="mt-4 grid grid-cols-3 gap-1.5 rounded-xl bg-slate-950 p-1">
              <button
                type="button"
                onClick={() => setActiveLabTab("sms_siri")}
                className={`rounded-lg py-1.5 text-xs font-semibold transition cursor-pointer ${
                  activeLabTab === "sms_siri"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                SMS Banco / Siri
              </button>
              <button
                type="button"
                onClick={() => setActiveLabTab("receipt_vision")}
                className={`rounded-lg py-1.5 text-xs font-semibold transition cursor-pointer ${
                  activeLabTab === "receipt_vision"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Factura Split IA
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveLabTab("ios_widget");
                  loadWidgetCode();
                }}
                className={`rounded-lg py-1.5 text-xs font-semibold transition cursor-pointer ${
                  activeLabTab === "ios_widget"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Widget iPhone
              </button>
            </div>

            {/* TAB 1: SMS BANCARIO AUTOMÁTICO / SIRI */}
            {activeLabTab === "sms_siri" && (
              <form
                onSubmit={triggerQuickExpenseShortcut}
                className="mt-4 space-y-3"
              >
                <p className="text-xs text-slate-400">
                  Simula una automatización de iOS cuando llega un SMS de{" "}
                  <strong className="text-slate-200">
                    Bancolombia / Nequi
                  </strong>{" "}
                  o dictado por voz:
                </p>
                <textarea
                  rows={3}
                  value={shortcutInput}
                  onChange={(e) => setShortcutInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setShortcutInput(
                        "Bancolombia: Compraste $32.500 en RAPPI RESTAURANTES con tu T.Debito *4491 el 05/11/2026"
                      )
                    }
                    className="rounded-md bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700 cursor-pointer"
                  >
                    SMS Bancolombia Rappi ($32.5k)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setShortcutInput(
                        "Nequi: Pagaste $18.000 en UBER TRIP desde tu disponible"
                      )
                    }
                    className="rounded-md bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700 cursor-pointer"
                  >
                    SMS Nequi Uber ($18k Operativo)
                  </button>
                </div>

                <label className="flex items-center gap-2 text-xs text-cyan-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useAegisShield}
                    onChange={(e) => setUseAegisShield(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950"
                  />
                  Usar Escudo Aegis automáticamente si hay disponible (
                  {state.aegis_shields} disponibles)
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 cursor-pointer"
                >
                  <Send className="h-4 w-4" />
                  Procesar SMS / Dictado en Motor RPG
                </button>
              </form>
            )}

            {/* TAB 2: ESCÁNER DE FACTURAS MULTIMODAL (SPLIT DINÁMICO) */}
            {activeLabTab === "receipt_vision" && (
              <form onSubmit={triggerReceiptScan} className="mt-4 space-y-3">
                <p className="text-xs text-slate-400">
                  Divide dinámicamente cada línea de una factura de
                  supermercado en{" "}
                  <span className="text-emerald-300">
                    Mercado Operativo (1.0x)
                  </span>{" "}
                  vs{" "}
                  <span className="text-rose-300">
                    Antojos Infiltrados (Castigo 1.2x)
                  </span>
                  :
                </p>
                <textarea
                  rows={5}
                  value={receiptTextInput}
                  onChange={(e) => setReceiptTextInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-[11px] text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
                >
                  <Receipt className="h-4 w-4" />
                  Escanear y Dividir Factura con Gemini
                </button>
              </form>
            )}

            {/* TAB 3: WIDGET SCRIPTABLE PARA PANTALLA DE BLOQUEO */}
            {activeLabTab === "ios_widget" && (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-slate-400">
                  Vista previa del Widget nativo en tu iPhone consumiendo{" "}
                  <code className="text-indigo-300">
                    GET /api/shortcuts/widget-summary
                  </code>
                  :
                </p>
                <div className="rounded-2xl border border-slate-700 bg-[#090d16] p-4 shadow-inner">
                  <p className="text-[11px] font-bold text-emerald-400">
                    ⚔️ RPG LIFE-ENGINE • LVL {state.player_level}
                  </p>
                  <p className="mt-1 text-base font-extrabold text-white">
                    Billetera: {state.wallet_gp.toLocaleString("es-CO")} GP
                  </p>
                  <p className="text-[11px] text-slate-400">
                    🔥 Racha {state.current_streak_days}d (
                    {state.streak_multiplier}x) • 🛡️ {state.aegis_shields}{" "}
                    Escudo(s)
                  </p>
                  <p className="mt-1.5 text-[11px] font-bold text-rose-400">
                    {state.bosses[0]
                      ? `Boss ${state.bosses[0].name}: $${state.bosses[0].current_hp.toLocaleString("es-CO")} HP`
                      : "🛡️ Sin Deudas Activas"}
                  </p>
                </div>

                {widgetCode && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(widgetCode);
                      setCopiedWidget(true);
                      setTimeout(() => setCopiedWidget(false), 2000);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
                  >
                    {copiedWidget ? (
                      <>
                        <Check className="h-4 w-4 text-emerald-400" /> ¡Código
                        Scriptable Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" /> Copiar Script para App
                        Scriptable (iOS)
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {lastShortcutResponse && (
              <div className="mt-4">
                <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-400">
                  <Terminal className="h-3.5 w-3.5" />
                  <span>Respuesta JSON del Endpoint:</span>
                </div>
                <pre className="max-h-52 overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-3 text-[11px] text-emerald-300">
                  {lastShortcutResponse}
                </pre>
              </div>
            )}
          </div>

          {/* HISTORIAL DE EVENTOS */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">
                Bitácora del Motor v3.0 (Triggers en Vivo)
              </h3>
              <TrendingDown className="h-4 w-4 text-slate-400" />
            </div>
            {state.logs.length === 0 ? (
              <p className="text-xs text-slate-500">
                Aún no hay eventos. Registra un solve de Cubo de Rubik, sesión
                de lectura/tejido/estudio/trabajo, o simula un SMS bancario.
              </p>
            ) : (
              <div className="max-h-60 space-y-2.5 overflow-auto pr-1">
                {state.logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/60 px-3.5 py-2.5 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-200">
                        {log.title}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {log.subtitle}
                      </p>
                    </div>
                    <span
                      className={`ml-2 whitespace-nowrap font-mono font-bold ${
                        log.gp_delta > 0
                          ? "text-emerald-400"
                          : log.gp_delta < 0
                          ? "text-rose-400"
                          : "text-cyan-400"
                      }`}
                    >
                      {log.gp_delta > 0
                        ? `+${log.gp_delta.toLocaleString("es-CO")} GP`
                        : log.gp_delta < 0
                        ? `${log.gp_delta.toLocaleString("es-CO")} GP`
                        : "COMBO"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =====================================================================
          AVANCE D: BITÁCORA DEL PERIODO DE PRUEBA (PILOTO 30 DÍAS) & CORTE DE MES
         ===================================================================== */}
      <section className="mt-8 rounded-2xl border border-emerald-500/30 bg-slate-900/60 p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white">
                Bitácora del Periodo de Prueba (Piloto 30 Días) & Corte de Mes
              </h2>
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-500/30">
                Persistencia Activa (Supabase + Disco Local + PWA)
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Guarda fotos históricas en el Día 7, Día 15 y Día 30 para medir
              cuánto bajaron tus deudas, cuántas páginas/frases leíste y cómo
              evolucionó tu Ao12 en Rubik. También puedes ejecutar el{" "}
              <strong className="text-slate-200">Corte de Mes</strong> para
              recargar la Bóveda sin perder tu progreso.
            </p>
          </div>
          <a
            href="/api/health"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-semibold text-cyan-300 hover:border-cyan-500/50"
          >
            🩺 Ver Estado de las 8 AI Skills & Producción (/api/health)
          </a>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* FORMULARIO PARA TOMAR FOTO DE BITÁCORA O CORTE DE MES */}
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/80 p-4 lg:col-span-5">
            <h3 className="text-sm font-bold text-white">
              📸 Registrar Foto de Control / Corte de Ciclo
            </h3>
            <div>
              <label className="text-xs text-slate-400">
                Etiqueta del Hito (Día 7, Semana 2, Fin de Mes):
              </label>
              <input
                type="text"
                value={checkpointLabelInput}
                onChange={(e) => setCheckpointLabelInput(e.target.value)}
                placeholder="Ej: Día 7 — Primera Semana del Piloto"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">
                Notas o reflexión de cómo funcionó el sistema esta semana:
              </label>
              <textarea
                rows={2}
                value={checkpointNotesInput}
                onChange={(e) => setCheckpointNotesInput(e.target.value)}
                placeholder="Ej: El modo 5s evitó 2 gastos hormiga y leí 95 páginas con 4 frases nuevas..."
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
              />
            </div>
            <label className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-950/15 p-2.5 text-xs text-amber-200 cursor-pointer">
              <input
                type="checkbox"
                checked={resetMonthOnCheckpoint}
                onChange={(e) => setResetMonthOnCheckpoint(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900"
              />
              <span>
                🗓️ <strong>Ejecutar Corte de Mes:</strong> Reiniciar gastos
                variables del mes y recargar el Tope de Bóveda (conservando
                Nivel, Racha, Deudas, Libros y Cubos).
              </span>
            </label>
            <button
              type="button"
              disabled={submitting}
              onClick={async () => {
                await submitSkillSession({
                  action: "create_trial_checkpoint",
                  checkpoint_label: checkpointLabelInput,
                  checkpoint_notes: checkpointNotesInput,
                  reset_month_cycle: resetMonthOnCheckpoint,
                });
                setCheckpointNotesInput("");
                setResetMonthOnCheckpoint(false);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4" />
              {resetMonthOnCheckpoint
                ? "Guardar Foto de Bitácora + Ejecutar Corte de Mes"
                : "Guardar Foto de Bitácora en Historial"}
            </button>
          </div>

          {/* LÍNEA DE TIEMPO COMPARATIVA DEL PERIODO DE PRUEBA */}
          <div className="space-y-3 lg:col-span-7">
            <h3 className="text-sm font-bold text-white">
              📊 Evolución en el Tiempo (Comparativa de Hitos)
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(state.trial_checkpoints || []).map((cp, idx, arr) => {
                const baseline = arr[arr.length - 1];
                const debtDelta = baseline
                  ? cp.total_debt_remaining_cop -
                    baseline.total_debt_remaining_cop
                  : 0;
                const pagesDelta = baseline
                  ? cp.total_pages_read - baseline.total_pages_read
                  : 0;
                return (
                  <div
                    key={cp.id}
                    className={`rounded-xl border p-4 ${
                      idx === 0
                        ? "border-emerald-500/40 bg-emerald-950/15"
                        : "border-slate-800 bg-slate-950/70"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white">
                        {cp.label}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        📅 {cp.created_at} ({cp.billing_period})
                      </span>
                    </div>
                    <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px]">
                      <div className="rounded-lg border border-slate-800/80 bg-slate-900/70 p-2">
                        <span className="text-[10px] text-slate-400">
                          Deuda Total Restante
                        </span>
                        <p className="font-mono font-bold text-rose-300">
                          ${cp.total_debt_remaining_cop.toLocaleString("es-CO")}
                        </p>
                        {debtDelta !== 0 && (
                          <span
                            className={`text-[10px] font-bold ${
                              debtDelta < 0
                                ? "text-emerald-400"
                                : "text-rose-400"
                            }`}
                          >
                            {debtDelta < 0
                              ? `▼ -$${Math.abs(debtDelta).toLocaleString("es-CO")} vs Día 1`
                              : `▲ +$${debtDelta.toLocaleString("es-CO")}`}
                          </span>
                        )}
                      </div>
                      <div className="rounded-lg border border-slate-800/80 bg-slate-900/70 p-2">
                        <span className="text-[10px] text-slate-400">
                          Nivel & Racha
                        </span>
                        <p className="font-mono font-bold text-amber-300">
                          LVL {cp.player_level} • 🔥 {cp.streak_days}d
                        </p>
                        <span className="text-[10px] text-cyan-300">
                          🛡️ {cp.aegis_shields} Aegis • Multas:{" "}
                          {cp.total_penalty_gp.toLocaleString("es-CO")} GP
                        </span>
                      </div>
                      <div className="rounded-lg border border-slate-800/80 bg-slate-900/70 p-2">
                        <span className="text-[10px] text-slate-400">
                          Lectura & Frases
                        </span>
                        <p className="font-mono font-bold text-emerald-300">
                          📖 {cp.total_pages_read} págs • 💬{" "}
                          {cp.total_quotes_captured} frases
                        </p>
                        {pagesDelta > 0 && (
                          <span className="text-[10px] text-emerald-400">
                            +{pagesDelta} págs desde Día 1
                          </span>
                        )}
                      </div>
                      <div className="rounded-lg border border-slate-800/80 bg-slate-900/70 p-2">
                        <span className="text-[10px] text-slate-400">
                          Speedcubing 3x3
                        </span>
                        <p className="font-mono font-bold text-indigo-300">
                          PB: {cp.rubik_3x3_pb ? `${cp.rubik_3x3_pb}s` : "N/A"}{" "}
                          • Ao12:{" "}
                          {cp.rubik_3x3_ao12 ? `${cp.rubik_3x3_ao12}s` : "N/A"}
                        </p>
                        <span className="text-[10px] text-slate-400">
                          ⚡ {cp.total_skill_sessions} sesiones totales
                        </span>
                      </div>
                    </div>
                    {cp.notes && (
                      <p className="mt-2 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 text-[10px] italic text-slate-300">
                        &ldquo;{cp.notes}&rdquo;
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  )}

      {/* =====================================================================
          TAB 6: AI COMMAND CENTER (SISTEMA AUTÓNOMO MULTIAGENTE & HITL)
         ===================================================================== */}
      {!dedicatedSkillDomain && homeActiveTab === "ai_command_center" && (
        <section className="mb-8">
          <AICommandCenter
            userId={state.user?.id || "usr_pilot_master"}
            currentStreak={state.current_streak_days}
            wakeUpTime={state.daily_schedule?.wake_up_time || "06:00"}
            sleepTime={state.daily_schedule?.sleep_time || "22:30"}
            workStartHour={state.daily_schedule?.work_start_hour || "08:00"}
            workEndHour={state.daily_schedule?.work_end_hour || "17:30"}
          />
        </section>
      )}

      {/* =====================================================================
          FLOATING ACTION BAR (ACCIONES RÁPIDAS 5s & ⌘K)
         ===================================================================== */}
      <div className="fixed bottom-5 right-5 z-40 flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/90 p-1.5 shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
        {/* Quick Shortcut 1: Cubo 5s */}
        <button
          type="button"
          onClick={() => {
            const secStr = prompt("⏱️ Ingresa tiempo del solve de Rubik en segundos (ej. 17.85):", "18.50");
            if (!secStr) return;
            const sec = parseFloat(secStr);
            if (isNaN(sec) || sec <= 0) return;
            submitSkillSession({
              domain: "rubik",
              seconds: sec,
              solve_status: "OK",
              title: `Solve Rápido 3x3: ${sec}s`,
            });
          }}
          className="flex items-center gap-1 rounded-full bg-slate-900/90 hover:bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-cyan-300 border border-cyan-500/30 transition cursor-pointer"
          title="Registrar solve de Cubo Rubik en 5 segundos"
        >
          <span>🧩</span>
          <span className="hidden sm:inline">Cubo 5s</span>
        </button>

        {/* Quick Shortcut 2: Lectura +10 Páginas 5s */}
        <button
          type="button"
          onClick={() => {
            const pStr = prompt("📖 ¿Cuántas páginas leíste hoy? (Default: 10):", "10");
            if (!pStr) return;
            const p = parseInt(pStr, 10);
            if (isNaN(p) || p <= 0) return;
            submitSkillSession({
              domain: "reading",
              pages_read: p,
              minutes: Math.max(10, Math.round(p * 1.5)),
              title: `Lectura Rápida: +${p} págs`,
            });
          }}
          className="flex items-center gap-1 rounded-full bg-slate-900/90 hover:bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-amber-300 border border-amber-500/30 transition cursor-pointer"
          title="Registrar páginas leídas en 5 segundos"
        >
          <span>📚</span>
          <span className="hidden sm:inline">+10 Págs</span>
        </button>

        {/* Quick Shortcut 3: Gasto Hormiga 5s */}
        <button
          type="button"
          onClick={async () => {
            const amountStr = prompt("☕ Monto del Gasto Hormiga en COP (ej. 6500):", "5000");
            if (!amountStr) return;
            const amt = parseInt(amountStr.replace(/\D/g, ""), 10);
            if (isNaN(amt) || amt <= 0) return;
            const cat = prompt("Categoría o descripción del gasto:", "Café / Snack") || "Gasto Hormiga";
            try {
              const res = await fetch("/api/shortcuts/quick-expense", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  amount_cop: amt,
                  category: cat,
                  description: `Gasto rápido desde FAB: ${cat}`,
                  channel: "web_floating_bar",
                }),
              });
              const data = await res.json();
              if (data.success) {
                alert(`💸 Gasto de $${amt.toLocaleString("es-CO")} registrado.`);
                await fetchState();
              }
            } catch {
              alert("Error al registrar gasto.");
            }
          }}
          className="flex items-center gap-1 rounded-full bg-slate-900/90 hover:bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-rose-300 border border-rose-500/30 transition cursor-pointer"
          title="Registrar gasto hormiga en 5 segundos"
        >
          <span>💸</span>
          <span className="hidden sm:inline">Gasto</span>
        </button>

        {/* Main Command Bar Trigger */}
        <button
          type="button"
          onClick={() => setIsCommandBarOpen(true)}
          className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 px-3.5 py-1.5 text-xs font-bold text-emerald-300 border border-emerald-500/50 transition cursor-pointer"
          title="Abrir Paleta de Comandos Rápidos (⌘K / Ctrl+K)"
        >
          <Command className="h-3.5 w-3.5 text-emerald-400" />
          <span>Acciones</span>
          <kbd className="hidden sm:inline-block rounded bg-emerald-950/60 px-1 py-0.2 text-[9px] font-mono text-emerald-400">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* =====================================================================
          COMMAND PALETTE DIALOG MODAL (⌘K / CTRL+K)
         ===================================================================== */}
      {isCommandBarOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setIsCommandBarOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-950 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input Header */}
            <div className="flex items-center border-b border-white/10 px-4 py-3 bg-slate-900/70">
              <Search className="h-4 w-4 text-emerald-400 mr-2.5 shrink-0" />
              <input
                type="text"
                value={commandBarSearch}
                onChange={(e) => setCommandBarSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && parsedNaturalCommand) {
                    e.preventDefault();
                    parsedNaturalCommand.execute();
                  }
                }}
                placeholder="Escribe comando natural (ej. '+25 min lectura', 'gasto 15000 almuerzo', 'cubo 18.2', 'modo santuario')..."
                autoFocus
                className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none font-medium"
              />
              {commandBarSearch && (
                <button
                  type="button"
                  onClick={() => setCommandBarSearch("")}
                  className="p-1 text-slate-400 hover:text-white mr-1 text-xs"
                >
                  Limpiar
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsCommandBarOpen(false)}
                className="rounded p-1 text-slate-400 hover:text-white hover:bg-white/5 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Smart Natural Language Command Chip */}
            {parsedNaturalCommand && (
              <div className="mx-3 my-2 rounded-xl border border-emerald-500/50 bg-emerald-950/70 p-2.5 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 font-bold shrink-0">⚡</span>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Atajo Natural Detectado</span>
                    <p className="text-xs font-bold text-white">{parsedNaturalCommand.label}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => parsedNaturalCommand.execute()}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-3 py-1.5 text-xs transition cursor-pointer shadow-md shrink-0 ml-2"
                >
                  <span>Ejecutar</span>
                  <kbd className="rounded bg-emerald-700/60 text-white px-1 py-0.2 text-[9px] font-mono">↵ Enter</kbd>
                </button>
              </div>
            )}

            {/* Filtered Actions List */}
            <div className="overflow-y-auto p-3 space-y-1 text-xs divide-y divide-white/[0.04]">
              {/* ACCIONES DE HABILIDADES */}
              <div className="pt-1 pb-1">
                <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Habilidades & Práctica
                </span>
                <div className="mt-1 space-y-0.5">
                  {[
                    {
                      label: "Registrar Solves de Cubo Rubik + IA Specs",
                      icon: "🧩",
                      tags: "cubo rubik speedcubing wca solve cronometro tiempo",
                      action: () => {
                        jumpToRegisterCube();
                        setIsCommandBarOpen(false);
                      },
                    },
                    {
                      label: "Registrar Lectura de Libro + Galería IA",
                      icon: "📚",
                      tags: "libro lectura paginas quotes citas galeria isbn",
                      action: () => {
                        jumpToRegisterBook();
                        setIsCommandBarOpen(false);
                      },
                    },
                    {
                      label: "Registrar Proyecto de Trabajo + Metodología Ágil",
                      icon: "💼",
                      tags: "proyecto trabajo scrum kanban lean sprints backlog",
                      action: () => {
                        jumpToRegisterProject();
                        setIsCommandBarOpen(false);
                      },
                    },
                    {
                      label: "Santuario de Habilidades (Tejido, Estudio, Deporte, Gaming)",
                      icon: "⚡",
                      tags: "santuario tejido crochet estudio pomodoro cronometro",
                      action: () => {
                        setHomeActiveTab("skills");
                        setIsCommandBarOpen(false);
                      },
                    },
                    {
                      label: "Journaling Libre de Culpa: Reflexión Guiada",
                      icon: "✍️",
                      tags: "journaling diario reflexion balance mental introspeccion libre de culpa",
                      action: () => {
                        setHomeActiveTab("skills");
                        setActiveSkillTab("journaling");
                        setIsCommandBarOpen(false);
                      },
                    },
                  ]
                    .filter(
                      (item) =>
                        !commandBarSearch.trim() ||
                        item.label.toLowerCase().includes(commandBarSearch.toLowerCase()) ||
                        item.tags.toLowerCase().includes(commandBarSearch.toLowerCase())
                    )
                    .map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={item.action}
                        className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-emerald-500/10 hover:border-emerald-500/30 border border-transparent transition cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-base">{item.icon}</span>
                          <span className="font-medium text-slate-200 group-hover:text-emerald-300">
                            {item.label}
                          </span>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                      </button>
                    ))}
                </div>
              </div>

              {/* ACCIONES DE FINANZAS & ECONOMÍA */}
              <div className="pt-2 pb-1">
                <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Finanzas & Wishlist
                </span>
                <div className="mt-1 space-y-0.5">
                  {[
                    {
                      label: "Limit Break: Reducir Deuda (-50,000 GP de Bóveda)",
                      icon: "⚡",
                      tags: "limit break deuda boveda sacrificio reducir interes boss",
                      action: () => {
                        if (state.vault_remaining_gp < 10000) {
                          alert("Requiere al menos 10,000 GP en tu Bóveda Mensual.");
                          return;
                        }
                        triggerLimitBreak(50000);
                        setIsCommandBarOpen(false);
                      },
                    },
                    {
                      label: "Ver Cámara Financiera & Wishlist con Restricción",
                      icon: "🏦",
                      tags: "finanzas deudas wishlist tienda recompensas compras",
                      action: () => {
                        setHomeActiveTab("debts");
                        setIsCommandBarOpen(false);
                      },
                    },
                    {
                      label: "Simulador Avalancha vs Bola de Nieve",
                      icon: "❄️",
                      tags: "simulador bola de nieve avalancha intereses ahorro",
                      action: () => {
                        setHomeActiveTab("debts");
                        setIsCommandBarOpen(false);
                      },
                    },
                  ]
                    .filter(
                      (item) =>
                        !commandBarSearch.trim() ||
                        item.label.toLowerCase().includes(commandBarSearch.toLowerCase()) ||
                        item.tags.toLowerCase().includes(commandBarSearch.toLowerCase())
                    )
                    .map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={item.action}
                        className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-indigo-500/10 hover:border-indigo-500/30 border border-transparent transition cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-base">{item.icon}</span>
                          <span className="font-medium text-slate-200 group-hover:text-indigo-300">
                            {item.label}
                          </span>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
                      </button>
                    ))}
                </div>
              </div>

              {/* INTELIGENCIA & NAVEGACIÓN */}
              <div className="pt-2 pb-1">
                <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Inteligencia & Utilidades
                </span>
                <div className="mt-1 space-y-0.5">
                  {[
                    {
                      label: "Invocar Briefing Táctico del Game Master (Gemini IA)",
                      icon: "🤖",
                      tags: "game master briefing gemini ia oraculo consejo",
                      action: () => {
                        summonGameMaster();
                        setIsCommandBarOpen(false);
                      },
                    },
                    {
                      label: "Analítica Personal & Heatmaps de 365 Días",
                      icon: "📊",
                      tags: "analitica metricas graficos mapa de calor constancia",
                      action: () => {
                        setHomeActiveTab("analytics");
                        setIsCommandBarOpen(false);
                      },
                    },
                    {
                      label: "AI Command Center • Sistema Autónomo Multiagente (11 Agentes)",
                      icon: "🤖",
                      tags: "ai command center agentes hitl aprobaciones automatizacion firewall orquestador",
                      action: () => {
                        setHomeActiveTab("ai_command_center");
                        setIsCommandBarOpen(false);
                      },
                    },
                    {
                      label: "Ritmo Circadiano & Cronograma Biológico",
                      icon: "📅",
                      tags: "calendario ritmo circadiano cronograma sueno horas",
                      action: () => {
                        setHomeActiveTab("calendar");
                        setIsCommandBarOpen(false);
                      },
                    },
                    {
                      label: "Modo Celular 5 Segundos & Atajos de iOS",
                      icon: "📲",
                      tags: "movil celular atajos ios quick 5 segundos",
                      action: () => {
                        window.location.href = "/quick";
                      },
                    },
                    {
                      label: "Personalizar Variables & Presupuestos",
                      icon: "⚙️",
                      tags: "configuracion variables onboarding reglas presupuesto",
                      action: () => {
                        window.location.href = "/onboarding";
                      },
                    },
                    {
                      label: "Política de Privacidad & Habeas Data",
                      icon: "🛡️",
                      tags: "privacidad habeas data datos legales seguridad",
                      action: () => {
                        window.open("/privacidad", "_blank");
                      },
                    },
                  ]
                    .filter(
                      (item) =>
                        !commandBarSearch.trim() ||
                        item.label.toLowerCase().includes(commandBarSearch.toLowerCase()) ||
                        item.tags.toLowerCase().includes(commandBarSearch.toLowerCase())
                    )
                    .map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={item.action}
                        className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-amber-500/10 hover:border-amber-500/30 border border-transparent transition cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-base">{item.icon}</span>
                          <span className="font-medium text-slate-200 group-hover:text-amber-300">
                            {item.label}
                          </span>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                      </button>
                    ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-white/[0.06] bg-slate-900/60 px-4 py-2 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                Presiona <kbd className="rounded bg-slate-800 px-1 py-0.5 text-[9px] text-slate-300">Esc</kbd> para salir
              </span>
              <span>RPG Life-Engine v3.0</span>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          VENTANA DE SESIÓN ACTIVA (SESSION INTELLIGENCE & NOTION SYNC MODAL)
         ===================================================================== */}
      {activeSessionModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0B0F19]/80 backdrop-blur-md animate-in fade-in"
          onClick={handleCloseSessionModal}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-white/5 bg-[#131B2E]/95 p-5 sm:p-6 shadow-2xl backdrop-blur-xl overflow-y-auto max-h-[92vh] space-y-4 text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-3.5">
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {ALL_SKILL_DOMAINS_PORTAL.find((p) => p.domain === activeSessionModal.domain)?.badge || "🎯"}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-slate-100">
                      Ventana de Sesión Activa: {activeSessionModal.title}
                    </h3>
                    <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                      Session Intelligence
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Cronometra tu bloque de enfoque, toma notas al vuelo y consolida tus resultados clave.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseSessionModal}
                className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
                title="Cerrar ventana"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* NOTION TOAST */}
            {sessionNotionToast && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/60 p-3 text-xs font-semibold text-emerald-200 flex items-center justify-between animate-in fade-in">
                <span>{sessionNotionToast}</span>
                <button onClick={() => setSessionNotionToast(null)} className="text-emerald-400 hover:text-emerald-200">✕</button>
              </div>
            )}

            {/* SECTION 1: TEMPORIZADOR DE ENFOQUE / POMODORO */}
            <div className="rounded-xl border border-white/5 bg-[#0B0F19]/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-cyan-400" />
                  <span className="font-semibold text-xs text-slate-200">Temporizador de Enfoque Pomodoro</span>
                </div>
                {sessionTimerSeconds >= 25 * 60 && (
                  <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-300 animate-pulse">
                    ⚡ Enfoque Legendario (1.25x XP)
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="font-mono text-3xl font-extrabold text-slate-100 tracking-tight">
                  {formatMinutesToHHMM(Math.floor(sessionTimerSeconds / 60))}:
                  {String(sessionTimerSeconds % 60).padStart(2, "0")}
                </div>

                <div className="flex items-center gap-1.5">
                  {[15, 25, 45, 50].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setSessionTimerPreset(preset);
                        setSessionTimerSeconds(0);
                      }}
                      className={`rounded-lg px-2.5 py-1 text-xs font-mono font-bold transition cursor-pointer ${
                        sessionTimerPreset === preset
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10"
                      }`}
                    >
                      {preset}m
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  {!sessionTimerActive ? (
                    <button
                      type="button"
                      onClick={() => setSessionTimerActive(true)}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>Iniciar Enfoque</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSessionTimerActive(false)}
                      className="flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition cursor-pointer"
                    >
                      <Pause className="h-3.5 w-3.5" />
                      <span>Pausar</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSessionTimerActive(false);
                      setSessionTimerSeconds(0);
                    }}
                    className="rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                    title="Reiniciar temporizador"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* SECTION 2: BLOC DE NOTAS POR SESIÓN (Quick Session Notes) */}
            <div className="rounded-xl border border-white/5 bg-[#0B0F19]/60 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Edit3 className="h-3.5 w-3.5 text-indigo-400" />
                  Bloc de Notas por Sesión (Fórmulas, Citas, Bocetos, Insights al Vuelo)
                </label>
                <span className="text-[10px] text-slate-400 font-mono">Autoguardado persistente</span>
              </div>
              <textarea
                rows={3}
                value={sessionNotesText}
                onChange={(e) => {
                  setSessionNotesText(e.target.value);
                  if (typeof window !== "undefined") {
                    try {
                      localStorage.setItem(`rpg_session_notes_${activeSessionModal.domain}`, e.target.value);
                    } catch {}
                  }
                }}
                placeholder="Escribe notas rápidas, fragmentos, fórmulas, reflexiones o ideas durante tu sesión..."
                className="w-full rounded-xl border border-white/5 bg-[#0B0F19] p-3 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500/50 focus:outline-none transition leading-relaxed"
              />
            </div>

            {/* SECTION 3: MINI-CHECKLIST DE RESULTADOS & CLARIDAD */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/5 bg-[#0B0F19]/60 p-4 space-y-2">
                <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <span>🧠</span> Claridad Mental / Rendimiento (1 a 10)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={sessionClarityRating}
                    onChange={(e) => setSessionClarityRating(Number(e.target.value))}
                    className="w-full accent-emerald-400"
                  />
                  <span className="font-mono font-bold text-sm text-emerald-400 w-8 text-right">
                    {sessionClarityRating}/10
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-white/5 bg-[#0B0F19]/60 p-4 space-y-2">
                <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <span>✅</span> Mini-Checklist & Resultado Clave
                </label>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(sessionChecklistValues["focus_held"])}
                      onChange={(e) =>
                        setSessionChecklistValues((prev) => ({
                          ...prev,
                          focus_held: e.target.checked ? "true" : "",
                        }))
                      }
                      className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0"
                    />
                    <span>Bloque de enfoque libre de distracciones</span>
                  </label>
                  <input
                    type="text"
                    value={sessionChecklistValues["Resultado"] || ""}
                    onChange={(e) => setSessionChecklistValues((prev) => ({ ...prev, Resultado: e.target.value }))}
                    placeholder="Métrica clave (ej. 15 págs, 5 solves, 2 commits)..."
                    className="w-full rounded-lg border border-white/5 bg-[#0B0F19] px-2.5 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-3.5">
              <button
                type="button"
                onClick={() => {
                  const tempSession: SessionIntelligenceData = {
                    id: `preview-${Date.now()}`,
                    domain: activeSessionModal.domain,
                    title: activeSessionModal.title,
                    durationMinutes: Math.max(1, Math.round(sessionTimerSeconds / 60) || activeSessionModal.defaultMinutes || 25),
                    xpEarned: 100,
                    gpEarned: 500,
                    sessionNotes: sessionNotesText,
                    checklistResults: sessionChecklistValues,
                    clarityRating: sessionClarityRating,
                    focusMultiplier: sessionTimerSeconds >= 25 * 60 ? 1.25 : 1.0,
                    timestamp: new Date().toISOString(),
                  };
                  handleSyncToNotion(tempSession);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 px-3.5 py-2 text-xs font-semibold text-indigo-300 transition cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Sincronizar a Notion</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCloseSessionModal}
                  className="rounded-xl border border-white/5 px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCompleteSessionModal}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-2 text-xs font-bold text-white shadow-lg transition cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Completar Sesión (+XP & +GP)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
  );
}

