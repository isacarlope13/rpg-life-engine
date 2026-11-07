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
} from "lucide-react";
import {
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
  DailyScheduleConfig,
} from "@/types/rpg";
import { computeBioCalendarPlan } from "@/lib/calendar-planner";

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
  skill_sessions: SkillSessionRecord[];
  wishlist: WishlistItem[];
  logs: LogEntry[];
  trial_checkpoints?: TrialCheckpointSnapshot[];
  daily_schedule?: DailyScheduleConfig;
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
];

export function RPGLifeEngineDashboard({
  dedicatedSkillDomain,
}: {
  dedicatedSkillDomain?: SkillDomain;
} = {}) {
  const [state, setState] = useState<EngineState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Tabs del Santuario de Habilidades
  const [activeSkillTab, setActiveSkillTab] = useState<SkillDomain>(
    dedicatedSkillDomain || "rubik"
  );

  useEffect(() => {
    if (dedicatedSkillDomain) {
      setActiveSkillTab(dedicatedSkillDomain);
    }
  }, [dedicatedSkillDomain]);

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
    fetchState();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (liveTimerRef.current) clearInterval(liveTimerRef.current);
    };
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
      await submitSkillSession({
        domain: "work",
        deliverable: workDeliverable,
        impact_level: workImpact,
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
    try {
      const res = await fetch("/api/shortcuts/skill-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotency_key: `skill-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 6)}`,
          action: "log_session",
          ...payload,
        }),
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

  const jumpToRegisterCube = () => {
    setActiveSkillTab("rubik");
    setTimeout(() => {
      document
        .getElementById("register-cube-section")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  };

  const jumpToRegisterBook = () => {
    setActiveSkillTab("reading");
    setTimeout(() => {
      document
        .getElementById("register-book-section")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
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

  const triggerHabitShortcut = async (questCode: string) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/shortcuts/habit-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotency_key: `ios-hab-${Date.now()}`,
          quest_code: questCode,
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

  const redeemWishlist = async (item: WishlistItem) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/shortcuts/quick-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotency_key: `ios-wish-${Date.now()}`,
          input_mode: "manual",
          manual_override: {
            amount_cop: item.cost_gp,
            category: "discretionary_wishlist",
            merchant_or_concept: `Wishlist: ${item.name}`,
            wishlist_item_id: item.id,
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
      <div className="flex min-h-screen items-center justify-center bg-[#090d16] text-slate-300">
        <div className="flex items-center gap-3 text-lg">
          <Sparkles className="h-6 w-6 animate-spin text-emerald-400" />
          Cargando RPG Financial & Skill Life-Engine v3.0...
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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {dedicatedSkillDomain ? (
        /* =====================================================================
           PÁGINA DEDICADA DE HABILIDAD (SOLO ESTA HABILIDAD A PANTALLA COMPLETA)
           ===================================================================== */
        <div className="mb-6 rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 p-5 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/"
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
          {/* HEADER BAR + BUFFS (STREAK & AEGIS SHIELDS) */}
          <header className="mb-8 flex flex-col justify-between gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur lg:flex-row lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
              <Zap className="h-3.5 w-3.5" /> NIVEL {state.player_level} •{" "}
              {state.current_xp} XP
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300 ring-1 ring-amber-500/30">
              <Flame className="h-3.5 w-3.5 text-amber-400" /> RACHA:{" "}
              {state.current_streak_days} DÍAS (BUFF {state.streak_multiplier}x
              GP)
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300 ring-1 ring-cyan-500/30">
              <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" /> ESCUDOS
              AEGIS: {state.aegis_shields}
            </span>
            {state.user?.character_class && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300 ring-1 ring-indigo-500/30">
                ⚔️ {state.user.display_name || "Aventurero"} •{" "}
                {state.user.character_class}
              </span>
            )}
            <a
              href="/onboarding"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-300 hover:border-emerald-500/50 hover:text-emerald-300"
            >
              ⚙️ Personalizar Variables
            </a>
            <a
              href="/quick"
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25"
            >
              📲 Modo Celular 5s & Atajos iOS
            </a>
            <button
              type="button"
              onClick={jumpToRegisterCube}
              className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-500/15 px-3 py-1 text-xs font-bold text-cyan-200 hover:bg-cyan-500/25 cursor-pointer"
            >
              ➕🧩 Registrar Cubo + IA
            </button>
            <button
              type="button"
              onClick={jumpToRegisterBook}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-200 hover:bg-amber-500/25 cursor-pointer"
            >
              ➕📚 Registrar Libro + Galería IA
            </button>
          </div>
          <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            RPG Productivity & Personal Finance Life-Engine{" "}
            <span className="text-sm font-semibold text-emerald-400">v3.0</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {state.main_goal
              ? `🎯 Misión Principal: ${state.main_goal}${
                  state.goal_deadline ? ` (Meta: ${state.goal_deadline})` : ""
                }`
              : "Santuario de Habilidades • Simulador Avalancha vs Bola de Nieve • iOS Shortcuts."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:flex">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-2.5">
            <span className="text-xs text-slate-400">
              Variables Operativos ({state.currency || "COP"})
            </span>
            <p className="text-sm font-bold text-slate-100">
              {`$${(state.variable_ops_spent_cop ?? 0).toLocaleString("es-CO")} / $${(state.variable_ops_budget_cop ?? 0).toLocaleString("es-CO")}`}
            </p>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
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
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-2.5">
            <span className="text-xs text-slate-400">Poder Bola de Nieve</span>
            <p className="text-base font-bold text-cyan-400">
              ${freeCashflowCop.toLocaleString("es-CO")}/mes
            </p>
            <span className="text-[10px] text-slate-400">
              Fijos: ${(state.fixed_costs_budget_cop ?? 0).toLocaleString("es-CO")}{" "}
              {state.currency || "COP"}
            </span>
          </div>
        </div>
      </header>

      {/* CORE ECONOMY CARDS: VAULT VS WALLET VS GAME MASTER */}
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* BÓVEDA MENSUAL */}
        <div className="relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
              Bóveda Mensual (Bloqueada)
            </span>
            <Vault className="h-5 w-5 text-indigo-400" />
          </div>
          <p className="mt-3 text-3xl font-extrabold text-white">
            {(state.vault_remaining_gp ?? 0).toLocaleString("es-CO")}{" "}
            <span className="text-base font-medium text-indigo-300">GP</span>
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Tope mensual: {state.vault_cap_gp.toLocaleString("es-CO")} GP (
            {state.currency || "COP"})
          </p>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${Math.max(0, 100 - vaultUnlockedPct)}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-indigo-300">
              Liberado: {vaultUnlockedPct}% ({state.streak_multiplier}x)
            </p>
            <button
              disabled={submitting || state.vault_remaining_gp < 10000}
              onClick={() => triggerLimitBreak(50000)}
              className="rounded-lg bg-indigo-500/20 px-2.5 py-1 text-[11px] font-semibold text-indigo-200 ring-1 ring-indigo-500/40 hover:bg-indigo-500/30 disabled:opacity-40 cursor-pointer"
              title="Sacrifica 50,000 GP de tu Bóveda para atacar directamente a un Debt Boss y ganar +250 XP"
            >
              ⚡ Limit Break (-50k GP a Deuda)
            </button>
          </div>
        </div>

        {/* BILLETERA ACTIVA */}
        <div
          className={`relative overflow-hidden rounded-2xl border p-6 ${
            state.wallet_gp < 0
              ? "border-rose-500/50 bg-gradient-to-br from-rose-950/50 via-slate-900 to-slate-900"
              : "border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900"
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-semibold uppercase tracking-wider ${
                state.wallet_gp < 0 ? "text-rose-300" : "text-emerald-300"
              }`}
            >
              Billetera Disponible (Liberada)
            </span>
            <Wallet
              className={`h-5 w-5 ${
                state.wallet_gp < 0 ? "text-rose-400" : "text-emerald-400"
              }`}
            />
          </div>
          <p className="mt-3 text-3xl font-extrabold text-white">
            {state.wallet_gp.toLocaleString("es-CO")}{" "}
            <span
              className={`text-base font-medium ${
                state.wallet_gp < 0 ? "text-rose-300" : "text-emerald-300"
              }`}
            >
              GP
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {state.wallet_gp < 0
              ? "⚠️ ESTADO: OVERDRAWN_CURSE (Completa sesiones para recuperar)"
              : `Tienes ${state.aegis_shields} Escudo(s) Aegis para bloquear multas 0.2x`}
          </p>
          <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs">
            <span className="text-slate-400">Castigos 1.2x acumulados:</span>
            <span className="font-semibold text-rose-400">
              -{state.total_penalty_gp.toLocaleString("es-CO")} GP
            </span>
          </div>
        </div>

        {/* ORÁCULO GAME MASTER & RADAR TTK */}
        <div className="flex flex-col justify-between rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-900 p-6">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                Game Master IA (Briefing Táctico)
              </span>
              <Bot className="h-5 w-5 text-amber-400" />
            </div>
            <p className="mt-2.5 text-xs leading-relaxed text-slate-300">
              {gmBriefing ||
                "Invoca al Game Master para analizar tus sesiones (Rubik PB/Ao5, Lectura, Tejido, Estudio, Trabajo) y el ahorro en intereses de tus deudas."}
            </p>
          </div>
          <button
            onClick={summonGameMaster}
            disabled={submitting}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500/20 px-3 py-2 text-xs font-semibold text-amber-300 ring-1 ring-amber-500/40 hover:bg-amber-500/30 cursor-pointer"
          >
            <Sparkles className="h-4 w-4" />
            Generar Briefing Táctico con Gemini
          </button>
        </div>
      </div>
        </>
      )}

      {/* =====================================================================
          SANTUARIO DE HABILIDADES & SESIONES DE PRODUCTIVIDAD (5 APARTADOS)
          1. Cubos de Rubik • 2. Lectura • 3. Tejido • 4. Estudio • 5. Trabajo
         ===================================================================== */}
      <section className="mb-8 rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-slate-900/90 to-slate-950/90 p-6 shadow-xl">
        {!dedicatedSkillDomain && (
          <>
            {/* 1. PORTALES A PÁGINAS DEDICADAS */}
            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  🚀 Portales de Habilidades (Cada habilidad abre en su propia página completa)
                </span>
                <span className="text-xs text-slate-400">
                  Espacio exclusivo sin distracciones
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {ALL_SKILL_DOMAINS_PORTAL.map((dom) => {
                  const summary = state.skill_summaries.find(
                    (s) => s.domain === dom.domain
                  );
                  const lvl = summary?.level ?? 1;
                  const gp = summary?.total_gp_earned ?? 0;
                  const sessions = summary?.sessions_count ?? 0;
                  const minutes = summary?.total_minutes ?? 0;

                  return (
                    <div
                      key={dom.domain}
                      className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 transition hover:border-emerald-500/50 hover:bg-slate-900/60 shadow-lg"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
                            {dom.badge}
                          </span>
                          <span className="font-mono text-xs font-bold text-slate-300">
                            LVL {lvl}
                          </span>
                        </div>
                        <h3 className="mt-2 text-sm font-bold text-white">
                          {dom.label}
                        </h3>
                        <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                          {dom.desc}
                        </p>
                        <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
                          <span>
                            {sessions} sesiones ({minutes}m)
                          </span>
                          <strong className="text-amber-300">
                            +{gp.toLocaleString("es-CO")} GP
                          </strong>
                        </div>
                      </div>

                      <Link
                        href={`/skills/${dom.domain}`}
                        className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 px-3 py-2 text-xs font-bold text-white transition shadow"
                      >
                        Abrir Página Dedicada ➔
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. CALENDARIO BIOLÓGICO */}
            <div className="mb-6 rounded-2xl border border-amber-500/30 bg-slate-950/90 p-5 shadow-xl">
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

              {/* CRONOGRAMA 7 DÍAS */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-7">
                {bioCalendarPlan.days.map((d) => (
                  <div
                    key={d.key}
                    className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/70 p-2.5 text-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                        <span className="font-bold text-white">{d.label}</span>
                        <span className="rounded bg-emerald-500/15 px-1 py-0.5 text-[9px] font-semibold text-emerald-300">
                          {d.totalDayMins}m skills
                        </span>
                      </div>

                      <div className="mt-1 flex items-center justify-between rounded bg-slate-950 px-1.5 py-0.5 text-[9px] text-amber-200">
                        <span>☀️ {d.wakeUpTime}</span>
                        <span>🌙 {d.sleepTime}</span>
                      </div>

                      <div className="mt-2 space-y-1">
                        {d.scheduled.map((item, i) => (
                          <div
                            key={i}
                            className="rounded border border-emerald-500/30 bg-emerald-950/20 px-1.5 py-1 text-[10px] text-white"
                          >
                            <div className="text-[9px] font-semibold text-cyan-300">
                              {item.timeRange}
                            </div>
                            <p className="font-semibold truncate">{item.label}</p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-2 space-y-0.5 border-t border-slate-800/80 pt-1 text-[9px] text-slate-400">
                        {d.timeline
                          .filter((slot) => slot.kind !== "skill")
                          .map((slot, sIdx) => (
                            <div
                              key={sIdx}
                              className="flex items-center justify-between truncate"
                            >
                              <span className="truncate pr-1">{slot.title}</span>
                              <span className="font-mono text-slate-500 shrink-0">
                                {slot.timeRange ? slot.timeRange.split(" – ")[0] : ""}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>

                    <div className="mt-2 border-t border-slate-800 pt-1 text-right text-[10px] font-bold text-amber-300">
                      +{d.gpUnlocked.toLocaleString("es-CO")} GP
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-4 flex items-center justify-between border-t border-slate-800 pt-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                ⚡ Práctica Rápida Integrada (o usa los botones de arriba para pantalla completa)
              </span>
            </div>
          </>
        )}
        <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white">
                Santuario de Habilidades & Sesiones (Generador de GP / XP)
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              Cada sesión registrada en Cubos de Rubik, Lectura, Tejido, Estudio
              o Trabajo incrementa tu racha y desbloquea GP de la Bóveda a tu
              Billetera.
            </p>
          </div>

          {/* TABS SELECTOR DE DISCIPLINAS ELEGIDAS POR EL USUARIO */}
          <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-800 bg-slate-950 p-1.5">
            {state.skill_summaries.some((s) => s.domain === "rubik") && (
              <button
                type="button"
                onClick={() => setActiveSkillTab("rubik")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  activeSkillTab === "rubik"
                    ? "bg-emerald-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Box className="h-3.5 w-3.5" />
                Cubos de Rubik
              </button>
            )}
            {state.skill_summaries.some((s) => s.domain === "reading") && (
              <button
                type="button"
                onClick={() => setActiveSkillTab("reading")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  activeSkillTab === "reading"
                    ? "bg-emerald-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <BookOpen className="h-3.5 w-3.5" />
                Lectura
              </button>
            )}
            {state.skill_summaries.some((s) => s.domain === "knitting") && (
              <button
                type="button"
                onClick={() => setActiveSkillTab("knitting")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  activeSkillTab === "knitting"
                    ? "bg-emerald-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Scissors className="h-3.5 w-3.5" />
                Tejido
              </button>
            )}
            {state.skill_summaries.some((s) => s.domain === "study") && (
              <button
                type="button"
                onClick={() => setActiveSkillTab("study")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  activeSkillTab === "study"
                    ? "bg-emerald-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <GraduationCap className="h-3.5 w-3.5" />
                Estudio
              </button>
            )}
            {state.skill_summaries.some((s) => s.domain === "work") && (
              <button
                type="button"
                onClick={() => setActiveSkillTab("work")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  activeSkillTab === "work"
                    ? "bg-emerald-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Briefcase className="h-3.5 w-3.5" />
                Trabajo
              </button>
            )}
            {state.skill_summaries.some((s) => s.domain === "gaming") && (
              <button
                type="button"
                onClick={() => setActiveSkillTab("gaming")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  activeSkillTab === "gaming"
                    ? "bg-emerald-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                🎮 Videojuegos / eSports
              </button>
            )}
            {state.skill_summaries.some((s) => s.domain === "sports") && (
              <button
                type="button"
                onClick={() => setActiveSkillTab("sports")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  activeSkillTab === "sports"
                    ? "bg-emerald-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                🏅 Deporte & Competencia
              </button>
            )}
            {state.skill_summaries.some((s) => s.domain === "general") && (
              <button
                type="button"
                onClick={() => setActiveSkillTab("general")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  activeSkillTab === "general"
                    ? "bg-emerald-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                💡{" "}
                {state.skill_summaries.find((s) => s.domain === "general")
                  ?.label || "Habilidad Personalizada"}
              </button>
            )}
          </div>
        </div>

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

        {/* 1. APARTADO: CUBOS DE RUBIK (WCA SCRAMBLE + CRONÓMETRO + EXTRACTOR DE ESPECIFICACIONES + ARSENAL WCA) */}
        {activeSkillTab === "rubik" && (() => {
          const activeRubikStats =
            state.rubik_stats_by_cube?.[cubeType] || state.rubik_stats;
          const cubesCatalog = state.rubik_cubes || [];
          const activeHardwareCube =
            cubesCatalog.find((c) => c.id === selectedCubeId) ||
            cubesCatalog.find((c) => c.cube_type === cubeType) ||
            cubesCatalog[0];
          const previewCubeSpecs = extractedCubeSpecs || activeHardwareCube;

          return (
            <div className="space-y-6">
              {/* SELECTOR DE SUB-MODOS: PRÁCTICA WCA VS. ESTUDIO & NUEVO CUBO VS. CUADERNO DE NOTAS */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-500/30 bg-slate-950 p-2.5 shadow-lg">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setRubikSubMode("practice")}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                      rubikSubMode === "practice"
                        ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/30"
                        : "border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-white"
                    }`}
                  >
                    <Zap className="h-4 w-4" />
                    ⚡ Modo 1: Práctica WCA (Speedcubing)
                  </button>

                  <button
                    type="button"
                    onClick={() => setRubikSubMode("study")}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                      rubikSubMode === "study"
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                        : "border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-white"
                    }`}
                  >
                    <GraduationCap className="h-4 w-4" />
                    🎓 Modo 2: Estudio & Nuevo Cubo
                  </button>

                  <button
                    type="button"
                    onClick={() => setRubikSubMode("notes")}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                      rubikSubMode === "notes"
                        ? "bg-amber-600 text-white shadow-lg shadow-amber-600/30"
                        : "border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-white"
                    }`}
                  >
                    <BookMarked className="h-4 w-4" />
                    📓 Cuaderno de Notas & Mantenimiento
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-slate-400">
                    Cubo activo:{" "}
                    <strong className="text-cyan-300">
                      {activeHardwareCube?.model_name || "3x3"}
                    </strong>
                  </span>
                </div>
              </div>

              {rubikSubMode === "practice" && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/80 p-5 lg:col-span-7">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Box className="h-5 w-5 text-cyan-400" />
                      <h3 className="text-base font-bold text-white">
                        Speedcubing Timer & Registro WCA
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {cubesCatalog.length > 0 && (
                        <select
                          value={activeHardwareCube?.id || ""}
                          onChange={(e) => {
                            const chosen = cubesCatalog.find(
                              (c) => c.id === e.target.value
                            );
                            if (chosen) {
                              setSelectedCubeId(chosen.id);
                              setCubeType(chosen.cube_type);
                              setRubikAlgInput(chosen.recommended_alg_set);
                            }
                          }}
                          className="rounded-lg border border-cyan-500/40 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-emerald-300"
                          title="Selecciona el cubo de tu Arsenal"
                        >
                          {cubesCatalog.map((c) => (
                            <option key={c.id} value={c.id}>
                              🧊 {c.model_name} ({c.cube_type})
                            </option>
                          ))}
                        </select>
                      )}
                      <select
                        value={cubeType}
                        onChange={(e) =>
                          setCubeType(e.target.value as RubikCubeType)
                        }
                        className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-cyan-300"
                      >
                        <option value="3x3">Cubo 3x3x3 WCA</option>
                        <option value="2x2">Cubo 2x2x2</option>
                        <option value="4x4">Cubo 4x4x4</option>
                        <option value="Pyraminx">Pyraminx</option>
                        <option value="Megaminx">Megaminx</option>
                      </select>
                    </div>
                  </div>

                  {/* SCRAMBLE OFICIAL */}
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-3">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300">
                        Scramble Oficial Generado ({cubeType}):
                      </span>
                      <p className="mt-1 font-mono text-sm font-bold tracking-wide text-white">
                        {state.next_rubik_scramble}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={fetchState}
                      className="rounded-lg bg-indigo-500/20 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-200 hover:bg-indigo-500/30 cursor-pointer"
                    >
                      Nuevo Scramble
                    </button>
                  </div>

                  {/* CRONÓMETRO EN VIVO */}
                  <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-[#070a12] py-5">
                    <span className="font-mono text-4xl font-extrabold text-emerald-400 sm:text-5xl">
                      {(elapsedMs / 1000).toFixed(2)}s
                    </span>
                    <div className="mt-4 flex gap-3">
                      <button
                        type="button"
                        onClick={toggleRubikTimer}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-bold text-white cursor-pointer ${
                          timerRunning
                            ? "bg-rose-600 hover:bg-rose-500"
                            : "bg-emerald-600 hover:bg-emerald-500"
                        }`}
                      >
                        {timerRunning ? (
                          <>
                            <Square className="h-4 w-4" /> Detener Solve
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4" /> Iniciar Cronómetro
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={resetRubikTimer}
                        className="inline-flex items-center gap-1 rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Reset
                      </button>
                    </div>
                  </div>

                  {/* FORMULARIO PARA GUARDAR SOLVE + PENALIZACIÓN WCA + RECOMPENSA GP */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="text-xs text-slate-400">
                        Tiempo del Solve (s):
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.5"
                        value={manualSolveSec}
                        onChange={(e) => setManualSolveSec(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">
                        Penalización WCA:
                      </label>
                      <select
                        value={rubikPenalty}
                        onChange={(e) =>
                          setRubikPenalty(e.target.value as RubikPenalty)
                        }
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                      >
                        <option value="NONE">OK (Limpio)</option>
                        <option value="+2">+2s Penalización</option>
                        <option value="DNF">DNF (Did Not Finish)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">
                        Algoritmo / Método:
                      </label>
                      <input
                        type="text"
                        value={rubikAlgInput}
                        onChange={(e) => setRubikAlgInput(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() =>
                      submitSkillSession({
                        domain: "rubik",
                        cube_type: cubeType,
                        cube_id: activeHardwareCube?.id,
                        cube_model: activeHardwareCube?.model_name,
                        solve_time_seconds: Number(manualSolveSec) || 18.5,
                        penalty: rubikPenalty,
                        scramble: state.next_rubik_scramble,
                        algorithm_learned: rubikAlgInput,
                        duration_minutes: 20,
                      })
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-cyan-500 disabled:opacity-50 cursor-pointer"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Registrar Solve {cubeType} ({manualSolveSec}s
                    {rubikPenalty !== "NONE" ? ` • ${rubikPenalty}` : ""}) y
                    Reclamar GP + XP
                  </button>
                </div>

                {/* ESTADÍSTICAS WCA DINÁMICAS POR CUBO (PB, AO5, AO12, MEDIA E HISTORIAL) */}
                <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/80 p-5 lg:col-span-5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white">
                      Métricas Oficiales WCA ({cubeType})
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      {activeRubikStats.total_solves} solves registrados
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-2.5 text-center">
                      <span className="text-[10px] uppercase text-emerald-300">
                        Single PB 🏆
                      </span>
                      <p className="mt-1 font-mono text-base font-extrabold text-white">
                        {activeRubikStats.pb_seconds
                          ? `${activeRubikStats.pb_seconds.toFixed(2)}s`
                          : "--"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-2.5 text-center">
                      <span className="text-[10px] uppercase text-cyan-300">
                        Ao5 Actual
                      </span>
                      <p className="mt-1 font-mono text-base font-extrabold text-white">
                        {activeRubikStats.ao5_seconds
                          ? `${activeRubikStats.ao5_seconds.toFixed(2)}s`
                          : "--"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-2.5 text-center">
                      <span className="text-[10px] uppercase text-amber-300">
                        Ao12 Oficial
                      </span>
                      <p className="mt-1 font-mono text-base font-extrabold text-white">
                        {activeRubikStats.ao12_seconds
                          ? `${activeRubikStats.ao12_seconds.toFixed(2)}s`
                          : "--"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-2.5 text-center">
                      <span className="text-[10px] uppercase text-indigo-300">
                        Media
                      </span>
                      <p className="mt-1 font-mono text-base font-extrabold text-white">
                        {activeRubikStats.mean_seconds
                          ? `${activeRubikStats.mean_seconds.toFixed(2)}s`
                          : "--"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-slate-300">
                      Historial Reciente de Solves ({cubeType}):
                    </span>
                    <div className="mt-2 max-h-56 space-y-2 overflow-auto pr-1">
                      {activeRubikStats.recent_solves.length === 0 ? (
                        <p className="text-xs text-slate-500">
                          Sin solves aún para {cubeType}. ¡Registra el primero!
                        </p>
                      ) : (
                        activeRubikStats.recent_solves.map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs"
                          >
                            <div>
                              <span
                                className={`font-mono font-bold ${
                                  s.penalty === "DNF"
                                    ? "text-rose-400"
                                    : "text-emerald-400"
                                }`}
                              >
                                {s.penalty === "DNF"
                                  ? `DNF (${s.time_seconds.toFixed(2)}s)`
                                  : `${s.time_seconds.toFixed(2)}s`}
                              </span>{" "}
                              {s.penalty === "+2" && (
                                <span className="ml-1 rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
                                  +2s
                                </span>
                              )}
                              {s.is_pb && (
                                <span className="ml-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                                  PB 🏆
                                </span>
                              )}
                              {s.cube_model && (
                                <span className="ml-1 text-[10px] text-slate-400">
                                  • {s.cube_model}
                                </span>
                              )}
                              <p className="text-[10px] font-mono text-slate-400">
                                {s.scramble}
                              </p>
                            </div>
                            {s.algorithm_practiced && (
                              <span className="text-[10px] text-cyan-300">
                                {s.algorithm_practiced}
                              </span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
              )}

              {/* =================================================================
                  MODO 2: ESTUDIO & APRENDIZAJE DE NUEVO CUBO / ALGORITMOS
                 ================================================================= */}
              {rubikSubMode === "study" && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                  <div className="space-y-4 rounded-xl border border-indigo-500/40 bg-slate-950/80 p-5 lg:col-span-7">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="h-5 w-5 text-indigo-400" />
                        <div>
                          <h4 className="text-base font-bold text-white">
                            Estudio & Dominio de Nuevo Cubo / Algoritmos
                          </h4>
                          <p className="text-xs text-slate-400">
                            Aprende algoritmos, paridades o reconocimiento sin la presión de un solve cronometrado WCA.
                          </p>
                        </div>
                      </div>
                      <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 font-mono text-[11px] font-bold text-indigo-300">
                        +120 XP • +3.500 GP/bloque
                      </span>
                    </div>

                    {/* CRONÓMETRO EN VIVO PARA ESTUDIO */}
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/30 to-slate-950 p-6 text-center">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">
                        {liveTimerDomain === "rubik" && !liveTimerPaused
                          ? "● Grabando sesión de estudio en vivo"
                          : liveTimerDomain === "rubik" && liveTimerPaused
                          ? "⏸ Sesión en Pausa"
                          : "Cronómetro de Estudio en Vivo"}
                      </span>
                      <span className="mt-2 font-mono text-5xl font-black tracking-tight text-indigo-400 sm:text-6xl">
                        {liveTimerDomain === "rubik"
                          ? formatStopwatch(liveTimerSeconds)
                          : "00:00"}
                      </span>
                      <p className="mt-1 text-xs text-slate-400">
                        {liveTimerDomain === "rubik"
                          ? `${Math.max(1, Math.round(liveTimerSeconds / 60))} minutos acumulados para reclamar`
                          : "Presiona iniciar al comenzar a estudiar y finalizar al terminar."}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2.5 justify-center">
                        {liveTimerDomain !== "rubik" ? (
                          <button
                            type="button"
                            onClick={() => startLiveTimer("rubik")}
                            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 cursor-pointer"
                          >
                            <Play className="h-4 w-4" /> Iniciar Sesión de Estudio
                          </button>
                        ) : (
                          <>
                            {liveTimerPaused ? (
                              <button
                                type="button"
                                onClick={resumeLiveTimer}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer"
                              >
                                <Play className="h-4 w-4" /> Reanudar
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={pauseLiveTimer}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-500 cursor-pointer"
                              >
                                <Pause className="h-4 w-4" /> Pausar
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => stopAndLogLiveTimer("rubik")}
                              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2 text-xs font-extrabold text-white shadow hover:brightness-110 disabled:opacity-50 cursor-pointer"
                            >
                              <Square className="h-4 w-4" /> Finalizar y Reclamar GP
                            </button>

                            <button
                              type="button"
                              onClick={resetLiveTimer}
                              className="inline-flex items-center gap-1 rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                            >
                              <RotateCcw className="h-3.5 w-3.5" /> Reset
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* SELECTORES DE ESTUDIO */}
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-slate-400">
                          Enfoque del Estudio:
                        </label>
                        <select
                          value={rubikStudyFocus}
                          onChange={(e) => setRubikStudyFocus(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                        >
                          <option value="F2L & Lookahead Fluido">F2L & Lookahead Fluido (Sin pausas)</option>
                          <option value="Algoritmos OLL">Algoritmos OLL (Orientación Última Capa)</option>
                          <option value="Algoritmos PLL">Algoritmos PLL (Permutación Última Capa)</option>
                          <option value="Paridades 4x4 / 5x5">Paridades de Cubos Grandes (OLL/PLL parity)</option>
                          <option value="Fingertricks & Ergonomía">Fingertricks & Ergonomía de Giro</option>
                          <option value="Memorización Blindfolded (3x3 BLD)">Memorización Blindfolded (3x3 BLD)</option>
                          <option value="Nuevo Cubo (Reconocimiento de Colores)">Nuevo Cubo (Reconocimiento de Esquemas)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs text-slate-400">
                          Algoritmo, Notas o Caso Practicado:
                        </label>
                        <input
                          type="text"
                          value={rubikStudyNotes}
                          onChange={(e) => setRubikStudyNotes(e.target.value)}
                          placeholder="Ej: Reconocimiento de G-perms en 2 lados, paridad de aristas 4x4..."
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-400">
                          Duración manual (si no usaste el cronómetro en vivo):
                        </label>
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            type="number"
                            min="5"
                            value={rubikStudyMinutes}
                            onChange={(e) => setRubikStudyMinutes(Math.max(5, Number(e.target.value)))}
                            className="w-28 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                          />
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() =>
                              submitSkillSession({
                                domain: "rubik",
                                cube_type: cubeType,
                                cube_id: activeHardwareCube?.id,
                                cube_model: activeHardwareCube?.model_name,
                                algorithm_learned: `${rubikStudyFocus}: ${rubikStudyNotes || "Estudio de nuevo cubo y algoritmos"}`,
                                duration_minutes: rubikStudyMinutes,
                                title: `Estudio de Cubo (${cubeType}) — ${rubikStudyFocus}`,
                              })
                            }
                            className="flex-1 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50 cursor-pointer"
                          >
                            Registrar {rubikStudyMinutes} min de Estudio Manualmente
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/80 p-5 lg:col-span-5">
                    <h4 className="text-sm font-bold text-white">
                      Guía Rápida de Estudio por Categoría ({cubeType})
                    </h4>
                    <div className="space-y-2.5 text-xs text-slate-300">
                      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                        <strong className="text-indigo-300">💡 3x3x3 WCA:</strong>
                        <p className="mt-1 text-slate-400">
                          Prioriza Cross en blanco/amarillo, F2L sin rotaciones de cubo (aprender inserciones traseras) y 2-Look OLL/PLL antes de aprender los 57 OLLs completos.
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                        <strong className="text-cyan-300">🧊 4x4x4 (Yau Method):</strong>
                        <p className="mt-1 text-slate-400">
                          Centros blanco y amarillo, 3 aristas de la cruz, centros restantes y emparejamiento 3-2-3. Memoriza el algoritmo de paridad OLL: <code>Rw U2 x Rw U2 Rw U2 Rw&apos; U2 Lw U2 Rw&apos; U2 Rw U2 Rw&apos; U2 Rw&apos;</code>.
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                        <strong className="text-amber-300">✨ Megaminx & Pyraminx:</strong>
                        <p className="mt-1 text-slate-400">
                          Megaminx: Método Balint o S2L. Pyraminx: V-First o L4E (Last 4 Edges) con reconocimiento de bloques.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* =================================================================
                  MODO 3: CUADERNO DE NOTAS DEL CUBO (ARSENAL HARDWARE & SETUP LOG)
                 ================================================================= */}
              {rubikSubMode === "notes" && (
                <div className="space-y-5 rounded-2xl border border-amber-500/40 bg-slate-950/90 p-5 shadow-xl">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <BookMarked className="h-5 w-5 text-amber-400" />
                        <h4 className="text-base font-bold text-white">
                          Cuaderno de Notas del Cubo: Setup, Mantenimiento & Necesidades
                        </h4>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">
                        Anota las tensiones exactas, lubricantes utilizados, necesidades de limpieza o repuestos y los casos que te cuestan dominar con este cubo específico.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Seleccionar Cubo:</span>
                      <select
                        value={activeHardwareCube?.id || ""}
                        onChange={(e) => {
                          const chosen = cubesCatalog.find((c) => c.id === e.target.value);
                          if (chosen) {
                            setSelectedCubeId(chosen.id);
                            setCubeType(chosen.cube_type);
                          }
                        }}
                        className="rounded-lg border border-amber-500/40 bg-slate-900 px-3 py-1.5 text-xs font-bold text-amber-300"
                      >
                        {cubesCatalog.map((c) => (
                          <option key={c.id} value={c.id}>
                            🧊 {c.model_name} ({c.cube_type})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {cubeNotesSuccessMsg && (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-500/50 bg-emerald-950/30 p-3 text-xs font-bold text-emerald-300">
                      <Check className="h-4 w-4" />
                      {cubeNotesSuccessMsg}
                    </div>
                  )}

                  {/* FICHA RESUMEN DEL CUBO SELECCIONADO */}
                  {activeHardwareCube && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400">Modelo & Marca:</span>
                        <p className="font-bold text-white">{activeHardwareCube.model_name}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400">Sistema Magnético:</span>
                        <p className="font-semibold text-cyan-300">{activeHardwareCube.magnetic_system || "MagLev / Imanes"}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400">Acabado Exterior:</span>
                        <p className="font-semibold text-emerald-300">{activeHardwareCube.surface_finish || "UV Coated"}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400">Peso & Medida:</span>
                        <p className="font-mono text-amber-300">{activeHardwareCube.weight_grams || 71}g • {activeHardwareCube.size_mm || 55}mm</p>
                      </div>
                    </div>
                  )}

                  {/* FORMULARIO EDITABLE DE NOTAS DEL CUBO */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Settings2 className="h-3.5 w-3.5 text-cyan-400" />
                        ⚙️ Tensiones, Compresión de Resortes & Imanes
                      </label>
                      <input
                        type="text"
                        value={cubeTensionNotes}
                        onChange={(e) => setCubeTensionNotes(e.target.value)}
                        placeholder="Ej: Nivel 3 de compresión, distancia de centro 2, imanes en fuerza media..."
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-blue-400" />
                        💧 Lubricación Actual & Historial de Lubes
                      </label>
                      <input
                        type="text"
                        value={cubeLubeNotes}
                        onChange={(e) => setCubeLubeNotes(e.target.value)}
                        placeholder="Ej: Pistas con Lubest Pro / Núcleo con Weight 5 para frenado suave..."
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                        🛠️ Necesidades, Mantenimiento & Pendientes del Cubo
                      </label>
                      <textarea
                        rows={3}
                        value={cubeMaintenanceNeeds}
                        onChange={(e) => setCubeMaintenanceNeeds(e.target.value)}
                        placeholder="Ej: Realizar limpieza profunda de pistas con cepillo; comprar lubricante rápido; cambiar imán de esquina flojo; comprar funda protectora..."
                        className="w-full rounded-lg border border-rose-500/30 bg-slate-900 px-3 py-2 text-xs text-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                        <Trophy className="h-3.5 w-3.5 text-amber-400" />
                        🎯 Algoritmos y Casos por Dominar con este Cubo
                      </label>
                      <textarea
                        rows={3}
                        value={cubeAlgsToMaster}
                        onChange={(e) => setCubeAlgsToMaster(e.target.value)}
                        placeholder="Ej: G-perm d tarda 2.6s (mejorar agarre), Ja-perm sin regrip, Paridad OLL 4x4..."
                        className="w-full rounded-lg border border-amber-500/30 bg-slate-900 px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-emerald-400" />
                      📝 Bitácora Libre, Sensaciones de Giro & Rendimiento
                    </label>
                    <textarea
                      rows={3}
                      value={cubeGeneralNotes}
                      onChange={(e) => setCubeGeneralNotes(e.target.value)}
                      placeholder="Ej: Sensación súper mantecosa tras el break-in de 200 solves. Muy estable en manos frías. Corte de esquinas a 55 grados sin bloqueo..."
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <span className="text-xs text-slate-400">
                      Las notas se sincronizan automáticamente en tu navegador y en la base de datos de tu perfil.
                    </span>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleSaveCubeNotebook}
                      className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-extrabold text-white shadow hover:bg-amber-500 disabled:opacity-50 cursor-pointer"
                    >
                      <Check className="h-4 w-4" />
                      💾 Guardar en el Cuaderno de Notas del Cubo
                    </button>
                  </div>
                </div>
              )}

              {/* =================================================================
                  EXTRACTOR DE ESPECIFICACIONES DEL CUBO (IA) & ARSENAL HARDWARE WCA
                 ================================================================= */}
              <div
                id="register-cube-section"
                className="grid grid-cols-1 gap-6 rounded-xl border border-cyan-500/30 bg-slate-950/90 p-5 lg:grid-cols-12"
              >
                <div className="space-y-4 lg:col-span-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-cyan-400" />
                      <h4 className="text-sm font-bold text-white">
                        Extractor de Especificaciones & Registro de Cubo (IA)
                      </h4>
                    </div>
                    <span className="rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-[10px] font-bold text-cyan-300">
                      Ficha WCA Completa
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Escribe el modelo o descripción de tu cubo para extraer
                    automáticamente su ficha técnica de hardware, sistema
                    magnético, acabado, configuración recomendada y checklist
                    de cumplimiento WCA.
                  </p>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      value={cubeSpecQuery}
                      onChange={(e) => setCubeSpecQuery(e.target.value)}
                      placeholder="Ej: GAN 14 MagLev Pro 3x3 UV, YJ MGC 4x4, QiYi MS Pyraminx..."
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                    />
                    <button
                      type="button"
                      disabled={extractingCube || !cubeSpecQuery.trim()}
                      onClick={() => extractCubeSpecsFromInput()}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-cyan-500/20 px-3.5 py-2 text-xs font-bold text-cyan-200 ring-1 ring-cyan-500/40 hover:bg-cyan-500/30 disabled:opacity-40 cursor-pointer"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {extractingCube
                        ? "Extrayendo..."
                        : "Extraer Especificaciones (IA)"}
                    </button>
                  </div>

                  {/* Presets rápidos de prueba */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "GAN 14 MagLev Pro 3x3 UV",
                      "MoYu WeiLong WRM V10 3x3 Ball-Core UV",
                      "YJ MGC 4x4",
                      "QiYi X-Man Bell V2 Pyraminx",
                      "DaYan Megaminx Pro M",
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setCubeSpecQuery(preset);
                          extractCubeSpecsFromInput(preset);
                        }}
                        className="rounded-md border border-slate-800 bg-slate-900/90 px-2 py-1 text-[10px] text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300 cursor-pointer"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  {/* Vista previa / Ficha Técnica Extraída */}
                  {previewCubeSpecs && (
                    <div className="space-y-3 rounded-xl border border-cyan-500/25 bg-slate-900/80 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                            {previewCubeSpecs.brand} • Categoría{" "}
                            {previewCubeSpecs.cube_type}
                          </span>
                          <h5 className="text-sm font-bold text-white">
                            {previewCubeSpecs.model_name}
                          </h5>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            previewCubeSpecs.wca_legal
                              ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
                              : "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40"
                          }`}
                        >
                          {previewCubeSpecs.wca_legal
                            ? "✓ WCA Legal Torneo"
                            : "⚠ Smart / Entrenamiento"}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 text-xs sm:grid-cols-3">
                        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2">
                          <span className="text-[10px] text-slate-400">
                            Sistema Magnético:
                          </span>
                          <p className="mt-0.5 font-semibold text-cyan-200">
                            {previewCubeSpecs.magnetic_system}
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2">
                          <span className="text-[10px] text-slate-400">
                            Acabado Superficial:
                          </span>
                          <p className="mt-0.5 font-semibold text-slate-200">
                            {previewCubeSpecs.surface_finish}
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2">
                          <span className="text-[10px] text-slate-400">
                            Dimensiones & Peso:
                          </span>
                          <p className="mt-0.5 font-mono font-semibold text-white">
                            {previewCubeSpecs.size_mm} mm •{" "}
                            {previewCubeSpecs.weight_grams} g
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2 sm:col-span-2">
                          <span className="text-[10px] text-slate-400">
                            Set de Algoritmos & Configuración Recomendada:
                          </span>
                          <p className="mt-0.5 font-semibold text-emerald-300">
                            {previewCubeSpecs.recommended_alg_set}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {previewCubeSpecs.recommended_setup}
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2">
                          <span className="text-[10px] text-slate-400">
                            Meta & Recompensa:
                          </span>
                          <p className="mt-0.5 font-mono font-bold text-amber-300">
                            Sub-{previewCubeSpecs.target_sub_seconds}s • +
                            {previewCubeSpecs.reward_gp_per_solve} GP
                          </p>
                        </div>
                      </div>

                      {/* ✨ INFORMACIÓN ADICIONAL DE LA IA (SENSACIÓN DE GIRO, NOTAS PRO Y MANTENIMIENTO) */}
                      {(previewCubeSpecs.turning_feel_and_cutting ||
                        previewCubeSpecs.pro_cuber_notes ||
                        previewCubeSpecs.maintenance_guide) && (
                        <div className="rounded-xl border border-cyan-500/25 bg-cyan-950/15 p-3 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-cyan-300">
                              ✨ Asesor IA de Speedcubing (
                              {previewCubeSpecs.release_tier ||
                                "Análisis Técnico"}
                              )
                            </span>
                            {previewCubeSpecs.estimated_market_price_cop && (
                              <span className="font-mono text-[10px] text-emerald-300">
                                💡 Precio ref. Colombia: ~$
                                {previewCubeSpecs.estimated_market_price_cop.toLocaleString(
                                  "es-CO"
                                )}{" "}
                                COP
                              </span>
                            )}
                          </div>
                          {previewCubeSpecs.turning_feel_and_cutting && (
                            <p className="mt-1.5 text-[11px] text-slate-200">
                              <strong className="text-cyan-300">
                                Sensación & Corte:
                              </strong>{" "}
                              {previewCubeSpecs.turning_feel_and_cutting}
                            </p>
                          )}
                          {previewCubeSpecs.pro_cuber_notes && (
                            <p className="mt-1 text-[11px] text-slate-300">
                              <strong className="text-emerald-300">
                                Nota Pro:
                              </strong>{" "}
                              {previewCubeSpecs.pro_cuber_notes}
                            </p>
                          )}
                          {previewCubeSpecs.maintenance_guide && (
                            <p className="mt-1 text-[10px] text-slate-400">
                              🛠️ <strong>Mantenimiento:</strong>{" "}
                              {previewCubeSpecs.maintenance_guide}
                            </p>
                          )}
                        </div>
                      )}

                      {/* DATOS DE COMPRA DEL CUBO (CUÁNTO COSTÓ, FECHA HOY U OTRO DÍA, TIENDA) */}
                      <div className="rounded-xl border border-amber-500/30 bg-amber-950/15 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                            💰 Registro de Compra del Cubo
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setCubePurchaseDate(
                                  new Date().toISOString().slice(0, 10)
                                )
                              }
                              className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 hover:bg-slate-700"
                            >
                              📅 Hoy
                            </button>
                            <button
                              type="button"
                              onClick={() => setCubePurchaseDate("2026-09-07")}
                              className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-cyan-300 hover:bg-slate-700"
                            >
                              📅 07 Sep (CSV)
                            </button>
                          </div>
                        </div>

                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <div>
                            <label className="text-[10px] text-slate-300">
                              ¿Cuánto te costó? ({state.currency || "COP"})
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={cubePricePaid}
                              onChange={(e) =>
                                setCubePricePaid(
                                  Math.max(0, Number(e.target.value))
                                )
                              }
                              className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-300">
                              Fecha de compra (Hoy u otro día)
                            </label>
                            <input
                              type="date"
                              value={cubePurchaseDate}
                              onChange={(e) =>
                                setCubePurchaseDate(e.target.value)
                              }
                              className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-300">
                              Tienda / Origen
                            </label>
                            <input
                              type="text"
                              value={cubeStoreSource}
                              onChange={(e) =>
                                setCubeStoreSource(e.target.value)
                              }
                              placeholder="Ej: SpeedCubeShop, Regalo..."
                              className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                            />
                          </div>
                        </div>

                        <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11px] text-slate-300">
                          <input
                            type="checkbox"
                            checked={recordCubeInTreasury}
                            onChange={(e) =>
                              setRecordCubeInTreasury(e.target.checked)
                            }
                            className="rounded border-slate-700 bg-slate-900"
                          />
                          Descontar también estos $
                          {cubePricePaid.toLocaleString("es-CO")} de mi Billetera
                          GP como compra nueva hoy
                        </label>
                      </div>

                      <button
                        type="button"
                        disabled={submitting}
                        onClick={async () => {
                          const typedQuery = cubeSpecQuery.trim();
                          const useExtracted =
                            extractedCubeSpecs &&
                            (!typedQuery ||
                              extractedCubeSpecs.model_name
                                .toLowerCase()
                                .includes(typedQuery.toLowerCase()) ||
                              typedQuery
                                .toLowerCase()
                                .includes(
                                  extractedCubeSpecs.model_name.toLowerCase()
                                ));

                          if (useExtracted && extractedCubeSpecs) {
                            await submitSkillSession({
                              action: "add_cube",
                              cube_model: extractedCubeSpecs.model_name,
                              cube_type: extractedCubeSpecs.cube_type,
                              cube_brand: extractedCubeSpecs.brand,
                              cube_magnetic_system:
                                extractedCubeSpecs.magnetic_system,
                              cube_surface_finish:
                                extractedCubeSpecs.surface_finish,
                              cube_size_mm: extractedCubeSpecs.size_mm,
                              cube_weight_grams:
                                extractedCubeSpecs.weight_grams,
                              cube_wca_legal: extractedCubeSpecs.wca_legal,
                              cube_recommended_setup:
                                extractedCubeSpecs.recommended_setup,
                              cube_target_sub_seconds:
                                extractedCubeSpecs.target_sub_seconds,
                              cube_recommended_alg_set:
                                extractedCubeSpecs.recommended_alg_set,
                              cube_reward_gp_per_solve:
                                extractedCubeSpecs.reward_gp_per_solve,
                              cube_pb_bonus_gp: extractedCubeSpecs.pb_bonus_gp,
                              specs_compliance_checklist:
                                extractedCubeSpecs.specs_compliance_checklist,
                              cube_price_paid: cubePricePaid,
                              cube_purchase_date: cubePurchaseDate,
                              cube_store_or_source: cubeStoreSource,
                              record_purchase_in_treasury: recordCubeInTreasury,
                            });
                          } else {
                            await submitSkillSession({
                              action: "add_cube",
                              cube_model:
                                typedQuery || previewCubeSpecs.model_name,
                              cube_price_paid: cubePricePaid,
                              cube_purchase_date: cubePurchaseDate,
                              cube_store_or_source: cubeStoreSource,
                              record_purchase_in_treasury: recordCubeInTreasury,
                            });
                          }
                        }}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Registrar Cubo &quot;
                        {extractedCubeSpecs
                          ? extractedCubeSpecs.model_name
                          : cubeSpecQuery.trim() || previewCubeSpecs.model_name}
                        &quot; (${cubePricePaid.toLocaleString("es-CO")} •{" "}
                        {cubePurchaseDate})
                      </button>
                    </div>
                  )}
                </div>

                {/* CHECKLIST DE CUMPLIMIENTO WCA & ARSENAL REGISTRADO CON PRECIO Y FECHA */}
                <div className="space-y-4 lg:col-span-6">
                  {previewCubeSpecs && (
                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                        Checklist de Especificaciones & Cumplimiento WCA (
                        {previewCubeSpecs.model_name})
                      </h5>
                      <div className="mt-2.5 space-y-2">
                        {previewCubeSpecs.specs_compliance_checklist.map(
                          (item) => (
                            <div
                              key={item.code}
                              className="flex items-start gap-2.5 rounded-lg border border-slate-800/90 bg-slate-950/70 p-2.5 text-xs"
                            >
                              <span
                                className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                                  item.fulfilled
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : "bg-amber-500/20 text-amber-400"
                                }`}
                              >
                                {item.fulfilled ? "✓" : "!"}
                              </span>
                              <div>
                                <p className="font-semibold text-white">
                                  {item.label}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  {item.requirement}
                                </p>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* ARSENAL DE CUBOS GUARDADOS CON COSTO Y FECHA DE COMPRA */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                          Arsenal de Cubos Registrados ({cubesCatalog.length})
                        </h5>
                        <p className="text-[10px] text-slate-400">
                          Inversión total en colección:{" "}
                          <strong className="text-amber-300">
                            $
                            {cubesCatalog
                              .reduce((a, c) => a + (Number(c.price_paid) || 0), 0)
                              .toLocaleString("es-CO")}{" "}
                            {state.currency || "COP"}
                          </strong>
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        Haz clic para seleccionarlo
                      </span>
                    </div>
                    <div className="mt-2.5 max-h-56 space-y-2 overflow-auto pr-1">
                      {cubesCatalog.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedCubeId(c.id);
                            setCubeType(c.cube_type);
                            setExtractedCubeSpecs(c);
                            setCubeSpecQuery(c.model_name);
                            setRubikAlgInput(c.recommended_alg_set);
                            if (c.price_paid !== undefined) {
                              setCubePricePaid(c.price_paid);
                            }
                            if (c.purchase_date) {
                              setCubePurchaseDate(c.purchase_date);
                            }
                            if (c.store_or_source) {
                              setCubeStoreSource(c.store_or_source);
                            }
                          }}
                          className={`cursor-pointer rounded-lg border p-2.5 text-xs transition ${
                            selectedCubeId === c.id
                              ? "border-cyan-500/50 bg-cyan-950/20"
                              : "border-slate-800 bg-slate-950/70 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <span className="font-bold text-white">
                              {c.model_name}{" "}
                              <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300">
                                {c.cube_type}
                              </span>
                            </span>
                            <span className="font-mono text-[11px] font-bold text-amber-300">
                              💰 ${(c.price_paid ?? 0).toLocaleString("es-CO")}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
                            <span>
                              {c.magnetic_system} • {c.surface_finish} (
                              {c.weight_grams}g)
                            </span>
                            <span className="text-emerald-300">
                              📅 Compra: {c.purchase_date || "2026-09-07"}{" "}
                              {c.store_or_source ? `• ${c.store_or_source}` : ""}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 2. APARTADO: SESIONES DE LECTURA + GALERÍA VISUAL DE LIBROS + REGISTRO CON COMPRA (IA) */}
        {activeSkillTab === "reading" && (() => {
          const activeBook =
            state.reading_books.find((b) => b.id === selectedBookId) ||
            state.reading_books[0];
          const previewBookSpecs = extractedBookSpecs || activeBook;
          const totalBooksInvested = state.reading_books.reduce(
            (acc, b) => acc + (Number(b.price_paid) || 0),
            0
          );
          const filteredBooks = state.reading_books.filter((b) =>
            bookGalleryFilter === "all" ? true : b.status === bookGalleryFilter
          );

          return (
            <div className="space-y-6">
              {/* =================================================================
                  GALERÍA VISUAL DE LIBROS (ESTANTERÍA INTERACTIVA EN LA APP)
                 ================================================================= */}
              <div className="rounded-2xl border border-emerald-500/30 bg-slate-950/90 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-emerald-400" />
                      <h3 className="text-base font-bold text-white">
                        Galería de Libros & Colección Personal (
                        {state.reading_books.length})
                      </h3>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Inversión acumulada en tu biblioteca:{" "}
                      <strong className="text-amber-300">
                        ${totalBooksInvested.toLocaleString("es-CO")}{" "}
                        {state.currency || "COP"}
                      </strong>{" "}
                      • Toca cualquier libro para seleccionarlo o calificarlo.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { id: "all", label: "📚 Todos" },
                        { id: "reading", label: "📖 Leyendo" },
                        { id: "completed", label: "🏆 Terminados" },
                        { id: "wishlist", label: "✨ Por Leer" },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setBookGalleryFilter(f.id)}
                        className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                          bookGalleryFilter === f.id
                            ? "bg-emerald-600 text-white"
                            : "border border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ESTANTERÍA DE LIBROS CON PORTADA 3D, COSTO, FECHA DE COMPRA Y SINOPSIS */}
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filteredBooks.map((book) => {
                    const pct = Math.min(
                      100,
                      Math.round(
                        (book.pages_read / Math.max(1, book.total_pages)) * 100
                      )
                    );
                    const isSelected = selectedBookId === book.id;
                    const formatLabel =
                      book.format === "kindle_digital"
                        ? "📱 Kindle / Digital"
                        : book.format === "audiolibro"
                        ? "🎧 Audiolibro"
                        : "📘 Físico";
                    const gradientClass =
                      book.cover_color ||
                      "from-emerald-600 via-teal-900 to-slate-950";

                    return (
                      <div
                        key={book.id}
                        onClick={() => {
                          setSelectedBookId(book.id);
                          setExtractedBookSpecs(null);
                          if (book.recommended_daily_pages) {
                            setPagesReadInput(book.recommended_daily_pages);
                          }
                        }}
                        className={`group flex cursor-pointer flex-col justify-between rounded-2xl border p-4 transition ${
                          isSelected
                            ? "border-emerald-500 bg-emerald-950/20 ring-1 ring-emerald-500/40"
                            : "border-slate-800 bg-slate-900/70 hover:border-slate-700"
                        }`}
                      >
                        <div>
                          <div className="flex gap-3.5">
                            {/* PORTADA DEL LIBRO ESTILO 3D CON LOMO */}
                            <div
                              className={`relative flex h-36 w-24 shrink-0 flex-col justify-between overflow-hidden rounded-r-lg rounded-l-sm border border-white/15 bg-gradient-to-br ${gradientClass} p-2 shadow-lg`}
                            >
                              <div className="absolute inset-y-0 left-0 w-1.5 bg-black/35" />
                              {book.cover_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={book.cover_url}
                                  alt={book.title}
                                  className="absolute inset-0 h-full w-full object-cover opacity-90 transition group-hover:scale-105"
                                  onError={(e) => {
                                    (
                                      e.currentTarget as HTMLImageElement
                                    ).style.display = "none";
                                  }}
                                />
                              ) : null}
                              <span className="relative z-10 line-clamp-1 rounded bg-black/50 px-1 py-0.5 text-[8px] font-bold uppercase text-emerald-200 backdrop-blur-xs">
                                {book.category}
                              </span>
                              <div className="relative z-10 rounded bg-black/65 p-1 backdrop-blur-xs">
                                <p className="line-clamp-2 text-[10px] font-extrabold leading-tight text-white">
                                  {book.title}
                                </p>
                                <p className="mt-0.5 line-clamp-1 text-[8px] text-slate-300">
                                  {book.author}
                                </p>
                              </div>
                            </div>

                            {/* METADATOS DE LA GALERÍA Y COMPRA */}
                            <div className="flex flex-1 flex-col justify-between">
                              <div>
                                <div className="flex flex-wrap items-center justify-between gap-1">
                                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
                                    {formatLabel}
                                  </span>
                                  <span className="font-mono text-xs font-extrabold text-amber-300">
                                    💰 $
                                    {(book.price_paid ?? 0).toLocaleString(
                                      "es-CO"
                                    )}
                                  </span>
                                </div>
                                <h4 className="mt-1 line-clamp-2 text-sm font-bold text-white">
                                  {book.title}
                                </h4>
                                <p className="text-xs text-slate-400">
                                  {book.author}
                                </p>

                                {/* ESTRELLAS INTERACTIVAS */}
                                <div className="mt-1.5 flex items-center gap-1">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                      key={star}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        submitSkillSession({
                                          action: "update_book_gallery",
                                          book_id: book.id,
                                          book_rating: star,
                                        });
                                      }}
                                      className={`text-xs transition ${
                                        (book.rating || 5) >= star
                                          ? "text-amber-400 scale-105"
                                          : "text-slate-600 hover:text-amber-300"
                                      }`}
                                      title={`Calificar ${star} estrellas`}
                                    >
                                      ★
                                    </button>
                                  ))}
                                  <span className="ml-1 text-[10px] text-slate-400">
                                    ({book.rating || 5}/5)
                                  </span>
                                </div>
                              </div>

                              <div className="mt-2 space-y-0.5 text-[10px] text-slate-400">
                                <p className="text-emerald-300">
                                  📅 Compra: {book.purchase_date || "2026-09-15"}
                                </p>
                                {book.store_or_source && (
                                  <p className="truncate">
                                    🏪 {book.store_or_source}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* SINOPSIS Y RESEÑA PERSONAL */}
                          {(book.synopsis || book.key_learning_goal) && (
                            <p className="mt-3 line-clamp-2 text-[11px] text-slate-300">
                              {book.synopsis || book.key_learning_goal}
                            </p>
                          )}
                          {book.personal_review && (
                            <p className="mt-1.5 rounded-lg border border-slate-800 bg-slate-950/70 px-2.5 py-1.5 text-[10px] italic text-cyan-200">
                              &ldquo;{book.personal_review}&rdquo;
                            </p>
                          )}

                          {/* FRASES DESTACADAS GUARDADAS EN LA GALERÍA */}
                          {book.quotes && book.quotes.length > 0 && (
                            <div className="mt-2 rounded-lg border border-amber-500/25 bg-amber-950/15 p-2">
                              <div className="flex items-center justify-between text-[10px] font-bold text-amber-300">
                                <span>
                                  💬 {book.quotes.length} frase
                                  {book.quotes.length === 1 ? "" : "s"} guardada
                                  {book.quotes.length === 1 ? "" : "s"}
                                </span>
                                {book.quotes[0]?.page && (
                                  <span className="font-mono text-[9px] text-amber-400/80">
                                    Pág. {book.quotes[0].page}
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 line-clamp-2 text-[10px] italic text-amber-100/90">
                                &ldquo;{book.quotes[0].text}&rdquo;
                              </p>
                            </div>
                          )}
                        </div>

                        {/* BARRA DE PROGRESO Y RECOMPENSAS */}
                        <div className="mt-3 border-t border-slate-800/80 pt-2.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-mono font-bold text-emerald-300">
                              {book.pages_read} / {book.total_pages} págs ({pct}
                              %)
                            </span>
                            <span className="text-[10px] text-amber-300">
                              🏆 +
                              {(book.completion_bonus_gp || 5000).toLocaleString(
                                "es-CO"
                              )}{" "}
                              GP al terminar
                            </span>
                          </div>
                          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                            <div
                              className="h-full bg-emerald-500 transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="space-y-3 lg:col-span-7">
                  <h3 className="text-sm font-bold text-white">
                    Resumen Rápido de Lectura & Metas Diarias
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    {state.reading_books.map((book) => {
                      const pct = Math.min(
                        100,
                        Math.round((book.pages_read / book.total_pages) * 100)
                      );
                      return (
                        <div
                          key={book.id}
                          onClick={() => {
                            setSelectedBookId(book.id);
                            setExtractedBookSpecs(null);
                            if (book.recommended_daily_pages) {
                              setPagesReadInput(book.recommended_daily_pages);
                            }
                          }}
                          className={`cursor-pointer rounded-xl border p-4 transition ${
                            selectedBookId === book.id
                              ? "border-emerald-500/50 bg-emerald-950/15"
                              : "border-slate-800 bg-slate-950/70"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] font-semibold uppercase text-emerald-400">
                                  {book.category}
                                </span>
                                {book.complexity && (
                                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300">
                                    Densidad: {book.complexity}
                                  </span>
                                )}
                                <span className="font-mono text-[10px] text-amber-300">
                                  💰 ${(book.price_paid ?? 0).toLocaleString("es-CO")} • 📅 {book.purchase_date || "2026-09-15"}
                                </span>
                              </div>
                              <h4 className="mt-0.5 text-sm font-bold text-white">
                                {book.title}{" "}
                                <span className="font-normal text-slate-400">
                                  — {book.author}
                                </span>
                              </h4>
                            </div>
                            <span className="font-mono text-xs font-bold text-emerald-300">
                              {book.pages_read} / {book.total_pages} págs ({pct}
                              %)
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-400">
                            {book.total_chapters && (
                              <span>📖 ~{book.total_chapters} caps</span>
                            )}
                            {book.estimated_hours && (
                              <span>⏱️ ~{book.estimated_hours}h totales</span>
                            )}
                            {book.recommended_daily_pages && (
                              <span className="text-emerald-300">
                                🎯 Meta: {book.recommended_daily_pages} págs/día
                              </span>
                            )}
                            {book.gp_per_page && (
                              <span className="text-cyan-300">
                                ⚡ +{book.gp_per_page} GP/pág
                              </span>
                            )}
                            {book.completion_bonus_gp && (
                              <span className="text-amber-300">
                                🏆 Bono Fin: +
                                {book.completion_bonus_gp.toLocaleString(
                                  "es-CO"
                                )}{" "}
                                GP
                              </span>
                            )}
                          </div>
                          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                            <div
                              className="h-full bg-emerald-500 transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/80 p-5 lg:col-span-5">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-emerald-400" />
                    <h3 className="text-base font-bold text-white">
                      Registrar Sesión de Lectura
                    </h3>
                  </div>

                  {/* CRONÓMETRO EN VIVO DE LECTURA (INICIAR / PAUSAR / FINALIZAR) */}
                  <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-b from-emerald-950/40 to-slate-900/90 p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-emerald-400" />
                        <span className="text-xs font-bold text-emerald-300">
                          {liveTimerDomain === "reading" && !liveTimerPaused
                            ? "● Leyendo en vivo..."
                            : liveTimerDomain === "reading" && liveTimerPaused
                            ? "⏸ Lectura pausada"
                            : "Lectura con Cronómetro en Vivo"}
                        </span>
                      </div>
                      <span className="font-mono text-xl font-black tracking-tight text-white">
                        {liveTimerDomain === "reading"
                          ? formatStopwatch(liveTimerSeconds)
                          : "00:00"}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {liveTimerDomain !== "reading" ? (
                        <button
                          type="button"
                          onClick={() => startLiveTimer("reading")}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-500 cursor-pointer"
                        >
                          <Play className="h-3.5 w-3.5" /> ▶ Iniciar Lectura
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
                            onClick={() => stopAndLogLiveTimer("reading")}
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
                      Libro activo:
                    </label>
                    <select
                      value={selectedBookId}
                      onChange={(e) => {
                        setSelectedBookId(e.target.value);
                        setExtractedBookSpecs(null);
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                    >
                      {state.reading_books.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.title} ({b.pages_read}/{b.total_pages}p)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400">
                        Páginas leídas hoy:
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={pagesReadInput}
                        onChange={(e) =>
                          setPagesReadInput(Number(e.target.value))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">
                        Duración (minutos):
                      </label>
                      <input
                        type="number"
                        min="5"
                        value={readingMinutesInput}
                        onChange={(e) =>
                          setReadingMinutesInput(Number(e.target.value))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  {/* ==========================================================
                      CAPTURA RÁPIDA DE FRASES SIN FRICCIÓN (ENTER / VOZ / 1-CLIC)
                     ========================================================== */}
                  <div className="rounded-xl border border-amber-500/30 bg-amber-950/10 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <label className="text-xs font-bold text-amber-300">
                        💬 Captura Rápida de Frase (Opcional • +250 GP c/u)
                      </label>
                      <span className="text-[10px] text-slate-400">
                        Enter = añadir otra • Dictado por voz 🎤
                      </span>
                    </div>

                    <div className="mt-2 flex gap-1.5">
                      <input
                        type="text"
                        value={quoteTextInput}
                        onChange={(e) => setQuoteTextInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addQuoteChipToSession();
                          }
                        }}
                        placeholder="Escribe o dicta una frase que te gustó y presiona Enter..."
                        className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                      />
                      <input
                        type="number"
                        min="1"
                        value={quotePageInput}
                        onChange={(e) => setQuotePageInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addQuoteChipToSession();
                          }
                        }}
                        placeholder="Pág."
                        title="Página de la frase (opcional)"
                        className="w-16 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={startQuoteVoiceDictation}
                        title="Dictar frase con micrófono (manos libres)"
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                          dictatingQuote
                            ? "animate-pulse border-rose-500 bg-rose-500/20 text-rose-300"
                            : "border-slate-700 bg-slate-900 text-amber-300 hover:border-amber-500/50"
                        }`}
                      >
                        🎤
                      </button>
                      <button
                        type="button"
                        onClick={addQuoteChipToSession}
                        disabled={!quoteTextInput.trim()}
                        title="Añadir a la lista de esta sesión"
                        className="rounded-lg border border-amber-500/40 bg-amber-500/20 px-2.5 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/30 disabled:opacity-40 cursor-pointer"
                      >
                        +
                      </button>
                    </div>

                    {/* Botón instantáneo si solo quieres guardar la frase sin cerrar sesión de páginas */}
                    {(quoteTextInput.trim().length > 0 ||
                      sessionQuotes.length > 0) && (
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[10px] text-amber-200/90">
                          Se guardará automáticamente al guardar tu lectura o
                          ahora mismo:
                        </span>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={async () => {
                            const pendingQuotes = [...sessionQuotes];
                            if (quoteTextInput.trim()) {
                              const p = quotePageInput
                                ? Number(quotePageInput)
                                : undefined;
                              pendingQuotes.push({
                                text: quoteTextInput.trim(),
                                page: p && p > 0 ? p : undefined,
                              });
                            }
                            for (const q of pendingQuotes) {
                              await submitSkillSession({
                                action: "add_book_quote",
                                book_id: selectedBookId,
                                quote_text: q.text,
                                quote_page: q.page,
                              });
                            }
                            setQuoteTextInput("");
                            setQuotePageInput("");
                            setSessionQuotes([]);
                          }}
                          className="rounded-lg border border-amber-400/50 bg-amber-500/20 px-2.5 py-1 text-[10px] font-bold text-amber-200 hover:bg-amber-500/30 cursor-pointer"
                        >
                          ⚡ Guardar solo frase(s) ahora (+
                          {(sessionQuotes.length +
                            (quoteTextInput.trim() ? 1 : 0)) *
                            250}{" "}
                          GP)
                        </button>
                      </div>
                    )}

                    {/* Chips de frases listas para guardarse en la sesión */}
                    {sessionQuotes.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {sessionQuotes.map((q, idx) => (
                          <div
                            key={`${idx}-${q.text.slice(0, 12)}`}
                            className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/25 bg-slate-900/90 px-2.5 py-1 text-[11px] text-amber-100"
                          >
                            <span className="truncate italic">
                              &ldquo;{q.text}&rdquo;{" "}
                              {q.page ? (
                                <span className="font-mono text-[10px] not-italic text-amber-400">
                                  (Pág. {q.page})
                                </span>
                              ) : null}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setSessionQuotes((prev) =>
                                  prev.filter((_, i) => i !== idx)
                                )
                              }
                              className="text-[10px] text-slate-400 hover:text-rose-400 cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={async () => {
                      const parsedSinglePage = quotePageInput
                        ? Number(quotePageInput)
                        : undefined;
                      await submitSkillSession({
                        domain: "reading",
                        book_id: selectedBookId,
                        pages_read: pagesReadInput,
                        duration_minutes: readingMinutesInput,
                        quote_text: quoteTextInput.trim() || undefined,
                        quote_page:
                          parsedSinglePage && parsedSinglePage > 0
                            ? parsedSinglePage
                            : undefined,
                        quotes_list:
                          sessionQuotes.length > 0 ? sessionQuotes : undefined,
                      });
                      setQuoteTextInput("");
                      setQuotePageInput("");
                      setSessionQuotes([]);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Guardar Lectura (+{pagesReadInput} págs
                    {sessionQuotes.length + (quoteTextInput.trim() ? 1 : 0) > 0
                      ? ` + ${
                          sessionQuotes.length + (quoteTextInput.trim() ? 1 : 0)
                        } frase(s)`
                      : ""}
                    ) y Liberar GP
                  </button>

                  {/* Historial de frases del libro activo */}
                  {activeBook &&
                    activeBook.quotes &&
                    activeBook.quotes.length > 0 && (
                      <div className="rounded-xl border border-amber-500/20 bg-slate-900/70 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase text-amber-300">
                            💬 Frases de {activeBook.title} (
                            {activeBook.quotes.length})
                          </span>
                          <span className="text-[10px] text-slate-400">
                            +250 GP c/u
                          </span>
                        </div>
                        <div className="mt-2 max-h-36 space-y-1.5 overflow-y-auto pr-1">
                          {activeBook.quotes.map((q) => (
                            <div
                              key={q.id}
                              className="rounded-lg border border-slate-800 bg-slate-950/80 px-2.5 py-1.5 text-[11px]"
                            >
                              <p className="italic text-amber-100">
                                &ldquo;{q.text}&rdquo;
                              </p>
                              <div className="mt-0.5 flex items-center justify-between text-[9px] text-slate-400">
                                <span>
                                  {q.page ? `📖 Pág. ${q.page}` : "📖 Nota libre"}
                                </span>
                                <span>📅 {q.created_at}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {activeBook && activeBook.key_learning_goal && (
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/15 p-3 text-xs">
                      <span className="text-[10px] font-bold uppercase text-emerald-400">
                        Objetivo de Aprendizaje ({activeBook.title}):
                      </span>
                      <p className="mt-1 text-slate-300">
                        {activeBook.key_learning_goal}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* =================================================================
                  EXTRACTOR DE FICHA TÉCNICA DEL LIBRO (IA) + COMPRA Y DATOS DE GALERÍA
                 ================================================================= */}
              <div
                id="register-book-section"
                className="grid grid-cols-1 gap-6 rounded-xl border border-emerald-500/30 bg-slate-950/90 p-5 lg:grid-cols-12"
              >
                <div className="space-y-4 lg:col-span-7">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-emerald-400" />
                      <h4 className="text-sm font-bold text-white">
                        Registrar Nuevo Libro (Costo, Fecha de Compra y Ficha de
                        Galería)
                      </h4>
                    </div>
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                      Galería + IA
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Escribe el título o ISBN para autocompletar sus páginas,
                    portada oficial y sinopsis con IA, e ingresa cuánto te costó
                    y la fecha de compra (hoy u otro día).
                  </p>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      value={bookSpecQuery}
                      onChange={(e) => setBookSpecQuery(e.target.value)}
                      placeholder="Ej: Clean Architecture Robert C. Martin, Hábitos Atómicos, El Hombre en Busca de Sentido..."
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                    />
                    <button
                      type="button"
                      disabled={extractingBook || !bookSpecQuery.trim()}
                      onClick={() => extractBookSpecsFromInput()}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500/20 px-3.5 py-2 text-xs font-bold text-emerald-200 ring-1 ring-emerald-500/40 hover:bg-emerald-500/30 disabled:opacity-40 cursor-pointer"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {extractingBook
                        ? "Extrayendo..."
                        : "Autocompletar Libro (IA)"}
                    </button>
                  </div>

                  {/* Presets de Libros */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "Clean Architecture - Robert C. Martin",
                      "Hábitos Atómicos - James Clear",
                      "El Hombre en Busca de Sentido - Viktor Frankl",
                      "The Pragmatic Programmer",
                      "Meditaciones - Marco Aurelio",
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setBookSpecQuery(preset);
                          extractBookSpecsFromInput(preset);
                        }}
                        className="rounded-md border border-slate-800 bg-slate-900/90 px-2 py-1 text-[10px] text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300 cursor-pointer"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  {/* Formulario Editable de Ficha Técnica del Libro */}
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    <div>
                      <label className="text-[11px] text-slate-400">
                        Título Oficial:
                      </label>
                      <input
                        type="text"
                        placeholder="Título del libro"
                        value={newBookTitle}
                        onChange={(e) => setNewBookTitle(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400">
                        Autor:
                      </label>
                      <input
                        type="text"
                        placeholder="Autor"
                        value={newBookAuthor}
                        onChange={(e) => setNewBookAuthor(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400">
                        Páginas Totales:
                      </label>
                      <input
                        type="number"
                        min="20"
                        value={newBookPages}
                        onChange={(e) =>
                          setNewBookPages(Number(e.target.value))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400">
                        Categoría / Género:
                      </label>
                      <input
                        type="text"
                        value={newBookCategory}
                        onChange={(e) => setNewBookCategory(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400">
                        ISBN (Genera Portada Automática):
                      </label>
                      <input
                        type="text"
                        placeholder="978-..."
                        value={newBookIsbn}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewBookIsbn(val);
                          const cleanDigits = val.replace(/[^0-9X]/gi, "");
                          if (cleanDigits.length >= 10) {
                            setNewBookCoverUrl(
                              `https://covers.openlibrary.org/b/isbn/${cleanDigits}-L.jpg`
                            );
                          }
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400">
                        Complejidad Cognitiva:
                      </label>
                      <select
                        value={newBookComplexity}
                        onChange={(e) =>
                          setNewBookComplexity(e.target.value as BookComplexity)
                        }
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                      >
                        <option value="ligero">Ligero / Fluido</option>
                        <option value="intermedio">
                          Intermedio / Analítico
                        </option>
                        <option value="denso_tecnico">
                          Denso / Técnico (Ingeniería)
                        </option>
                      </select>
                    </div>
                  </div>

                  {/* SECCIÓN DE COMPRA (CUÁNTO COSTÓ, FECHA HOY U OTRO DÍA, LIBRERÍA) Y GALERÍA */}
                  <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-950/15 p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                        💰 Datos de Compra & Ficha para la Galería de Libros
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setNewBookPurchaseDate(
                              new Date().toISOString().slice(0, 10)
                            )
                          }
                          className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 hover:bg-slate-700"
                        >
                          📅 Hoy
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewBookPurchaseDate("2026-09-15")}
                          className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-cyan-300 hover:bg-slate-700"
                        >
                          📅 15 Sep (CSV)
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      <div>
                        <label className="text-[10px] text-slate-300">
                          ¿Cuánto te costó? ({state.currency || "COP"})
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={newBookPricePaid}
                          onChange={(e) =>
                            setNewBookPricePaid(
                              Math.max(0, Number(e.target.value))
                            )
                          }
                          className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-300">
                          Fecha de compra (Hoy u otro día)
                        </label>
                        <input
                          type="date"
                          value={newBookPurchaseDate}
                          onChange={(e) =>
                            setNewBookPurchaseDate(e.target.value)
                          }
                          className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-300">
                          Librería / Tienda
                        </label>
                        <input
                          type="text"
                          value={newBookStoreSource}
                          onChange={(e) =>
                            setNewBookStoreSource(e.target.value)
                          }
                          placeholder="Ej: Buscalibre, Panamericana..."
                          className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-300">
                          Formato del Libro
                        </label>
                        <select
                          value={newBookFormat}
                          onChange={(e) =>
                            setNewBookFormat(e.target.value as BookFormat)
                          }
                          className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                        >
                          <option value="fisico">📘 Físico (Papel / Tapa dura)</option>
                          <option value="kindle_digital">📱 Kindle / eBook</option>
                          <option value="audiolibro">🎧 Audiolibro</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-300">
                          Estado en Galería
                        </label>
                        <select
                          value={newBookStatus}
                          onChange={(e) =>
                            setNewBookStatus(
                              e.target.value as
                                | "reading"
                                | "completed"
                                | "wishlist"
                            )
                          }
                          className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                        >
                          <option value="reading">📖 Leyendo actualmente</option>
                          <option value="completed">🏆 Ya terminado</option>
                          <option value="wishlist">✨ Por leer / En estantería</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-300">
                          Calificación Inicial ({newBookRating} ★)
                        </label>
                        <select
                          value={newBookRating}
                          onChange={(e) =>
                            setNewBookRating(Number(e.target.value))
                          }
                          className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-amber-300"
                        >
                          <option value={5}>★★★★★ (5/5 Obra Maestra)</option>
                          <option value={4}>★★★★☆ (4/5 Muy Bueno)</option>
                          <option value={3}>★★★☆☆ (3/5 Interesante)</option>
                          <option value={2}>★★☆☆☆ (2/5 Regular)</option>
                          <option value={1}>★☆☆☆☆ (1/5 Flojo)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <div>
                        <label className="text-[10px] text-slate-300">
                          URL de Portada (opcional, se genera por ISBN):
                        </label>
                        <input
                          type="text"
                          value={newBookCoverUrl}
                          onChange={(e) => setNewBookCoverUrl(e.target.value)}
                          placeholder="https://covers.openlibrary.org/..."
                          className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-300">
                          Nota Personal / Reseña Corta para la Galería:
                        </label>
                        <input
                          type="text"
                          value={newBookPersonalReview}
                          onChange={(e) =>
                            setNewBookPersonalReview(e.target.value)
                          }
                          placeholder="Ej: Mi cita favorita o por qué lo compré..."
                          className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-300">
                        Sinopsis / De qué trata el libro:
                      </label>
                      <textarea
                        rows={2}
                        value={newBookSynopsis}
                        onChange={(e) => setNewBookSynopsis(e.target.value)}
                        placeholder="Breve resumen o aprendizaje clave del libro para mostrar en tu Galería..."
                        className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs text-white"
                      />
                    </div>

                    <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-300">
                      <input
                        type="checkbox"
                        checked={recordBookInTreasury}
                        onChange={(e) =>
                          setRecordBookInTreasury(e.target.checked)
                        }
                        className="rounded border-slate-700 bg-slate-900"
                      />
                      Descontar también estos $
                      {newBookPricePaid.toLocaleString("es-CO")} de mi Billetera
                      GP como compra nueva hoy
                    </label>
                  </div>

                  <button
                    type="button"
                    disabled={
                      submitting ||
                      (!newBookTitle.trim() && !bookSpecQuery.trim())
                    }
                    onClick={async () => {
                      const targetTitle =
                        newBookTitle.trim() || bookSpecQuery.trim();
                      const matchesExtracted =
                        extractedBookSpecs &&
                        extractedBookSpecs.title.toLowerCase() ===
                          targetTitle.toLowerCase();

                      await submitSkillSession({
                        action: "add_book",
                        title: targetTitle,
                        book_author:
                          newBookAuthor.trim() ||
                          (matchesExtracted
                            ? extractedBookSpecs?.author
                            : undefined),
                        book_total_pages:
                          newBookPages ||
                          (matchesExtracted
                            ? extractedBookSpecs?.total_pages
                            : undefined),
                        book_category:
                          newBookCategory.trim() ||
                          (matchesExtracted
                            ? extractedBookSpecs?.category
                            : undefined),
                        book_isbn:
                          newBookIsbn.trim() ||
                          (matchesExtracted
                            ? extractedBookSpecs?.isbn
                            : undefined),
                        book_language: matchesExtracted
                          ? extractedBookSpecs?.language
                          : undefined,
                        book_complexity: newBookComplexity,
                        book_key_learning_goal: matchesExtracted
                          ? extractedBookSpecs?.key_learning_goal
                          : undefined,
                        book_price_paid: newBookPricePaid,
                        book_purchase_date: newBookPurchaseDate,
                        book_store_or_source: newBookStoreSource,
                        book_format: newBookFormat,
                        book_status: newBookStatus,
                        book_rating: newBookRating,
                        book_cover_url: newBookCoverUrl,
                        book_synopsis: newBookSynopsis,
                        book_personal_review: newBookPersonalReview,
                        record_purchase_in_treasury: recordBookInTreasury,
                      });
                      setNewBookTitle("");
                      setNewBookAuthor("");
                      setNewBookIsbn("");
                      setNewBookCoverUrl("");
                      setNewBookSynopsis("");
                      setNewBookPersonalReview("");
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-40 cursor-pointer"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Añadir Libro a mi Galería ($
                    {newBookPricePaid.toLocaleString("es-CO")} •{" "}
                    {newBookPurchaseDate})
                  </button>
                </div>

                {/* CHECKLIST DE ESPECIFICACIONES DE LECTURA */}
                <div className="space-y-3 lg:col-span-5">
                  {previewBookSpecs && (
                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                          Ficha Técnica & Checklist ({previewBookSpecs.title})
                        </h5>
                        <span className="font-mono text-[10px] text-slate-400">
                          {previewBookSpecs.language || "Español"}
                        </span>
                      </div>

                      <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2">
                          <span className="text-[10px] text-slate-400">
                            Extensión & Capítulos:
                          </span>
                          <p className="font-mono font-bold text-white">
                            {previewBookSpecs.total_pages} págs • ~
                            {previewBookSpecs.total_chapters || 12} caps
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2">
                          <span className="text-[10px] text-slate-400">
                            Tiempo & Meta Diaria:
                          </span>
                          <p className="font-mono font-bold text-emerald-300">
                            ~{previewBookSpecs.estimated_hours || 10}h •{" "}
                            {previewBookSpecs.recommended_daily_pages || 20}{" "}
                            págs/día
                          </p>
                        </div>
                      </div>

                      {/* ✨ INFORMACIÓN ADICIONAL DE LA IA PARA EL LIBRO (SINOPSIS, BIO, FRASE CÉLEBRE Y TAKEAWAYS) */}
                      {(previewBookSpecs.author_bio_short ||
                        previewBookSpecs.famous_quote ||
                        (previewBookSpecs.practical_takeaways &&
                          previewBookSpecs.practical_takeaways.length > 0)) && (
                        <div className="mt-3 space-y-2 rounded-xl border border-emerald-500/25 bg-emerald-950/15 p-3 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-emerald-300">
                              ✨ Curaduría Literaria IA
                            </span>
                            {previewBookSpecs.estimated_market_price_cop && (
                              <span className="font-mono text-[10px] text-amber-300">
                                💡 Precio ref. Colombia: ~$
                                {previewBookSpecs.estimated_market_price_cop.toLocaleString(
                                  "es-CO"
                                )}{" "}
                                COP
                              </span>
                            )}
                          </div>
                          {previewBookSpecs.author_bio_short && (
                            <p className="text-[11px] text-slate-300">
                              <strong className="text-emerald-300">
                                Sobre el Autor:
                              </strong>{" "}
                              {previewBookSpecs.author_bio_short}
                            </p>
                          )}
                          {previewBookSpecs.famous_quote && (
                            <div className="rounded-lg border border-amber-500/30 bg-slate-950/80 p-2">
                              <p className="text-[11px] italic text-amber-200">
                                &ldquo;{previewBookSpecs.famous_quote}&rdquo;
                              </p>
                              <button
                                type="button"
                                onClick={() =>
                                  setNewBookPersonalReview(
                                    previewBookSpecs.famous_quote || ""
                                  )
                                }
                                className="mt-1 text-[10px] font-bold text-amber-300 underline hover:text-amber-200 cursor-pointer"
                              >
                                📌 Usar como cita destacada en mi Galería
                              </button>
                            </div>
                          )}
                          {previewBookSpecs.practical_takeaways &&
                            previewBookSpecs.practical_takeaways.length > 0 && (
                              <div className="space-y-1 pt-1">
                                <span className="text-[10px] font-bold uppercase text-cyan-300">
                                  🎯 3 Ideas Accionables del Libro:
                                </span>
                                <ul className="list-inside list-disc space-y-0.5 text-[11px] text-slate-300">
                                  {previewBookSpecs.practical_takeaways.map(
                                    (t, i) => (
                                      <li key={i}>{t}</li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}
                        </div>
                      )}

                      <div className="mt-3 space-y-2">
                        {(previewBookSpecs.reading_specs_checklist || []).map(
                          (item) => (
                            <div
                              key={item.code}
                              className="flex items-start gap-2.5 rounded-lg border border-slate-800/90 bg-slate-950/70 p-2.5 text-xs"
                            >
                              <span
                                className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                                  item.fulfilled
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : "bg-amber-500/20 text-amber-400"
                                }`}
                              >
                                {item.fulfilled ? "✓" : "!"}
                              </span>
                              <div>
                                <p className="font-semibold text-white">
                                  {item.label}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  {item.requirement}
                                </p>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* 3. APARTADO: SESIONES DE TEJIDO (PROYECTOS + CONTADOR DE FILAS/VUELTAS + NUEVO PROYECTO) */}
        {activeSkillTab === "knitting" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-3 lg:col-span-7">
              <h3 className="text-sm font-bold text-white">
                Taller de Tejido & Crochet (Bono +6.000 GP al Completar
                Proyecto)
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {state.knitting_projects.map((proj) => {
                  const pct = Math.min(
                    100,
                    Math.round(
                      (proj.completed_rows / proj.total_rows_target) * 100
                    )
                  );
                  return (
                    <div
                      key={proj.id}
                      onClick={() => setSelectedKnitId(proj.id)}
                      className={`cursor-pointer rounded-xl border p-4 transition ${
                        selectedKnitId === proj.id
                          ? "border-amber-500/50 bg-amber-950/15"
                          : "border-slate-800 bg-slate-950/70"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                            {proj.technique}
                          </span>
                          <h4 className="mt-1 text-sm font-bold text-white">
                            {proj.name}
                          </h4>
                          <p className="text-[11px] text-slate-400">
                            {proj.yarn_details}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-xs font-bold text-amber-300">
                            {proj.completed_rows} / {proj.total_rows_target}{" "}
                            vueltas ({pct}%)
                          </span>
                          <div className="mt-2 flex gap-1.5 justify-end">
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={(e) => {
                                e.stopPropagation();
                                submitSkillSession({
                                  domain: "knitting",
                                  project_id: proj.id,
                                  rows_completed: 5,
                                  duration_minutes: 25,
                                  stitches_notes: "Avance rápido +5 vueltas",
                                });
                              }}
                              className="rounded bg-amber-500/20 px-2 py-1 text-[10px] font-semibold text-amber-200 hover:bg-amber-500/30 cursor-pointer"
                            >
                              +5 Vueltas
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full bg-amber-500 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/80 p-5 lg:col-span-5">
              <div className="flex items-center gap-2">
                <Scissors className="h-5 w-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  Registrar Sesión de Tejido
                </h3>
              </div>

              {/* CRONÓMETRO EN VIVO DE TEJIDO */}
              <div className="rounded-xl border border-amber-500/40 bg-gradient-to-b from-amber-950/40 to-slate-900/90 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-400" />
                    <span className="text-xs font-bold text-amber-300">
                      {liveTimerDomain === "knitting" && !liveTimerPaused
                        ? "● Tejiendo en vivo..."
                        : liveTimerDomain === "knitting" && liveTimerPaused
                        ? "⏸ Tejido en Pausa"
                        : "Tejido con Cronómetro en Vivo"}
                    </span>
                  </div>
                  <span className="font-mono text-xl font-black tracking-tight text-white">
                    {liveTimerDomain === "knitting"
                      ? formatStopwatch(liveTimerSeconds)
                      : "00:00"}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {liveTimerDomain !== "knitting" ? (
                    <button
                      type="button"
                      onClick={() => startLiveTimer("knitting")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white shadow hover:bg-amber-500 cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5" /> ▶ Iniciar Tejido
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
                        onClick={() => stopAndLogLiveTimer("knitting")}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-600 px-3.5 py-1.5 text-xs font-extrabold text-white shadow hover:brightness-110 disabled:opacity-50 cursor-pointer"
                      >
                        <Square className="h-3.5 w-3.5" /> ⏹ Finalizar ({Math.max(1, Math.round(liveTimerSeconds / 60))} min)
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
                  Proyecto de Tejido:
                </label>
                <select
                  value={selectedKnitId}
                  onChange={(e) => setSelectedKnitId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                >
                  {state.knitting_projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.completed_rows}/{p.total_rows_target} filas)
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">
                    Filas / Vueltas tejidas:
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={rowsCompletedInput}
                    onChange={(e) =>
                      setRowsCompletedInput(Number(e.target.value))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">
                    Duración (minutos):
                  </label>
                  <input
                    type="number"
                    min="5"
                    value={knittingMinutesInput}
                    onChange={(e) =>
                      setKnittingMinutesInput(Number(e.target.value))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400">
                  Notas de patrón / puntada:
                </label>
                <input
                  type="text"
                  value={stitchesNotesInput}
                  onChange={(e) => setStitchesNotesInput(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() =>
                  submitSkillSession({
                    domain: "knitting",
                    project_id: selectedKnitId,
                    rows_completed: rowsCompletedInput,
                    duration_minutes: knittingMinutesInput,
                    stitches_notes: stitchesNotesInput,
                  })
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-500 disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                Registrar Tejido (+{rowsCompletedInput} vueltas) y Reclamar GP
              </button>

              {/* CREAR NUEVO PROYECTO DE TEJIDO */}
              <div className="border-t border-slate-800 pt-3">
                <span className="text-xs font-semibold text-slate-300">
                  + Nuevo Proyecto de Tejido / Crochet:
                </span>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <input
                    type="text"
                    placeholder="Nombre proyecto"
                    value={newKnitName}
                    onChange={(e) => setNewKnitName(e.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                  />
                  <select
                    value={newKnitTech}
                    onChange={(e) =>
                      setNewKnitTech(
                        e.target.value as
                          | "Crochet"
                          | "Dos Agujas"
                          | "Amigurumi"
                          | "Telar"
                      )
                    }
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white"
                  >
                    <option value="Crochet">Crochet</option>
                    <option value="Amigurumi">Amigurumi</option>
                    <option value="Dos Agujas">Dos Agujas</option>
                    <option value="Telar">Telar</option>
                  </select>
                  <input
                    type="number"
                    min="10"
                    placeholder="Meta filas"
                    value={newKnitRows}
                    onChange={(e) => setNewKnitRows(Number(e.target.value))}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <button
                  type="button"
                  disabled={submitting || !newKnitName.trim()}
                  onClick={async () => {
                    await submitSkillSession({
                      action: "add_knitting_project",
                      title: newKnitName,
                      knitting_technique: newKnitTech,
                      knitting_total_rows: newKnitRows,
                    });
                    setNewKnitName("");
                  }}
                  className="mt-2 w-full rounded-lg border border-amber-500/30 bg-amber-500/10 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 disabled:opacity-40 cursor-pointer"
                >
                  Crear Proyecto en Taller
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. APARTADO: SESIONES DE ESTUDIO (ACADEMIA & POMODORO) */}
        {activeSkillTab === "study" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/80 p-5 lg:col-span-6">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">
                  Registrar Sesión de Estudio
                </h3>
              </div>

              {/* CRONÓMETRO EN VIVO DE ESTUDIO */}
              <div className="rounded-xl border border-indigo-500/40 bg-gradient-to-b from-indigo-950/40 to-slate-900/90 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-indigo-400" />
                    <span className="text-xs font-bold text-indigo-300">
                      {liveTimerDomain === "study" && !liveTimerPaused
                        ? "● Estudiando en vivo..."
                        : liveTimerDomain === "study" && liveTimerPaused
                        ? "⏸ Estudio en Pausa"
                        : "Estudio con Cronómetro en Vivo"}
                    </span>
                  </div>
                  <span className="font-mono text-xl font-black tracking-tight text-white">
                    {liveTimerDomain === "study"
                      ? formatStopwatch(liveTimerSeconds)
                      : "00:00"}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {liveTimerDomain !== "study" ? (
                    <button
                      type="button"
                      onClick={() => startLiveTimer("study")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow hover:bg-indigo-500 cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5" /> ▶ Iniciar Estudio
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
                        onClick={() => stopAndLogLiveTimer("study")}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 px-3.5 py-1.5 text-xs font-extrabold text-white shadow hover:brightness-110 disabled:opacity-50 cursor-pointer"
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
                  Materia / Tema de Estudio:
                </label>
                <input
                  type="text"
                  value={studySubject}
                  onChange={(e) => setStudySubject(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Método:</label>
                  <select
                    value={studyMethod}
                    onChange={(e) =>
                      setStudyMethod(
                        e.target.value as
                          | "Pomodoro 25/5"
                          | "Deep Study 50/10"
                          | "Active Recall"
                          | "Práctica"
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                  >
                    <option value="Deep Study 50/10">Deep Study 50/10</option>
                    <option value="Pomodoro 25/5">Pomodoro 25/5</option>
                    <option value="Active Recall">Active Recall</option>
                    <option value="Práctica">Resolución de Problemas</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400">
                    Duración (minutos):
                  </label>
                  <input
                    type="number"
                    min="10"
                    value={studyMinutes}
                    onChange={(e) => setStudyMinutes(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[25, 50, 75, 100].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setStudyMinutes(mins)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
                      studyMinutes === mins
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {mins} min
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() =>
                  submitSkillSession({
                    domain: "study",
                    subject: studySubject,
                    study_method: studyMethod,
                    duration_minutes: studyMinutes,
                  })
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50 cursor-pointer"
              >
                <Timer className="h-4 w-4" />
                Completar Bloque de Estudio ({studyMinutes}m) y Liberar GP
              </button>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/80 p-5 lg:col-span-6">
              <h4 className="text-sm font-bold text-white">
                Bitácora Reciente de Sesiones (Todas las Habilidades)
              </h4>
              <div className="max-h-60 space-y-2 overflow-auto pr-1">
                {state.skill_sessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs"
                  >
                    <div>
                      <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-indigo-300">
                        {sess.domain}
                      </span>{" "}
                      <span className="font-semibold text-white">
                        {sess.title}
                      </span>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {sess.details}
                      </p>
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

        {/* 5. APARTADO: SESIONES DE TRABAJO (DEEP WORK & ENTREGABLES) */}
        {activeSkillTab === "work" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/80 p-5 lg:col-span-6">
              <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">
                  Registrar Sesión de Trabajo (Deep Work)
                </h3>
              </div>

              {/* CRONÓMETRO EN VIVO DE TRABAJO */}
              <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-b from-emerald-950/40 to-slate-900/90 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-300">
                      {liveTimerDomain === "work" && !liveTimerPaused
                        ? "● Trabajando en Deep Work en vivo..."
                        : liveTimerDomain === "work" && liveTimerPaused
                        ? "⏸ Trabajo en Pausa"
                        : "Deep Work con Cronómetro en Vivo"}
                    </span>
                  </div>
                  <span className="font-mono text-xl font-black tracking-tight text-white">
                    {liveTimerDomain === "work"
                      ? formatStopwatch(liveTimerSeconds)
                      : "00:00"}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {liveTimerDomain !== "work" ? (
                    <button
                      type="button"
                      onClick={() => startLiveTimer("work")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-500 cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5" /> ▶ Iniciar Bloque de Trabajo
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
                        onClick={() => stopAndLogLiveTimer("work")}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-3.5 py-1.5 text-xs font-extrabold text-white shadow hover:brightness-110 disabled:opacity-50 cursor-pointer"
                      >
                        <Square className="h-3.5 w-3.5" /> ⏹ Finalizar y Forjar GP ({Math.max(1, Math.round(liveTimerSeconds / 60))} min)
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
                  Entregable / Proyecto de Trabajo:
                </label>
                <input
                  type="text"
                  value={workDeliverable}
                  onChange={(e) => setWorkDeliverable(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">
                    Nivel de Impacto:
                  </label>
                  <select
                    value={workImpact}
                    onChange={(e) =>
                      setWorkImpact(
                        e.target.value as
                          | "standard"
                          | "high_impact"
                          | "milestone"
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                  >
                    <option value="standard">Estándar (1.0x)</option>
                    <option value="high_impact">Alto Impacto (1.25x)</option>
                    <option value="milestone">Hito / Milestone (1.5x)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400">
                    Duración Bloque (minutos):
                  </label>
                  <input
                    type="number"
                    min="15"
                    value={workMinutes}
                    onChange={(e) => setWorkMinutes(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[45, 60, 90, 120].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setWorkMinutes(mins)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
                      workMinutes === mins
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {mins} min Focus
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() =>
                  submitSkillSession({
                    domain: "work",
                    deliverable: workDeliverable,
                    impact_level: workImpact,
                    duration_minutes: workMinutes,
                  })
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                Registrar Bloque de Trabajo ({workMinutes}m) y Reclamar GP + XP
              </button>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/80 p-5 lg:col-span-6">
              <h4 className="text-sm font-bold text-white">
                Historial de Entregables & Sesiones Recientes
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
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {sess.details}
                      </p>
                    </div>
                    <span className="font-mono font-bold text-emerald-400">
                      +{sess.gp_earned.toLocaleString("es-CO")} GP
                    </span>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/15 p-3 text-xs text-emerald-300">
                💡 Tip para iOS Shortcuts: Puedes enviar un POST a{" "}
                <code className="font-mono text-white">
                  /api/shortcuts/skill-session
                </code>{" "}
                al terminar el modo &ldquo;No Molestar&rdquo; en tu iPhone para
                acreditar tus minutos de trabajo o estudio automáticamente.
              </div>
            </div>
          </div>
        )}

        {(activeSkillTab === "gaming" ||
          activeSkillTab === "sports" ||
          activeSkillTab === "general") && (
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
      </section>

      {!dedicatedSkillDomain && (
        <>
          {/* DEBT BOSSES ARENA + SNOWBALL VS AVALANCHE + COMBO OVERFLOW + COUNTER-ATTACK */}
          <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
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

                <div className="mt-4 flex gap-2">
                  <button
                    disabled={submitting || isDefeated}
                    onClick={() => attackBoss(boss.name, 50000)}
                    className="flex-1 rounded-lg bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/25 disabled:opacity-40 cursor-pointer"
                  >
                    Atacar -$50k HP
                  </button>
                  <button
                    disabled={submitting || isDefeated}
                    onClick={() => attackBoss(boss.name, boss.current_hp)}
                    className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                  >
                    Finiquitar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* QUESTS + WISHLIST + MULTI-TAB IOS AUTOMATION LAB */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* COLUMNA IZQUIERDA: HÁBITOS RÁPIDOS Y WISHLIST (7 COLS) */}
        <div className="space-y-6 lg:col-span-7">
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

          {/* CATÁLOGO WISHLIST */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-amber-400" />
                <h2 className="text-lg font-bold text-white">
                  Tienda Wishlist (Redención 1.0x sin multa)
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {state.wishlist.map((item) => {
                const canAfford = state.wallet_gp >= item.cost_gp;
                return (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/70 p-4"
                  >
                    <div>
                      <span className="text-xs text-amber-400">
                        Prioridad #{item.priority}
                      </span>
                      <h3 className="mt-1 text-sm font-semibold text-white">
                        {item.name}
                      </h3>
                      <p className="mt-1 text-base font-bold text-amber-300">
                        {item.cost_gp.toLocaleString("es-CO")} GP
                      </p>
                    </div>
                    <button
                      disabled={submitting || item.is_redeemed || !canAfford}
                      onClick={() => redeemWishlist(item)}
                      className="mt-3 w-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 disabled:opacity-40 cursor-pointer"
                    >
                      {item.is_redeemed
                        ? "Redimido ✓"
                        : canAfford
                        ? "Canjear con GP"
                        : "Faltan GP"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: LABORATORIO MULTIMODAL DE IOS SHORTCUTS (5 COLS) */}
        <div className="space-y-6 lg:col-span-5">
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
        </>
      )}
    </div>
  );
}

