"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ShieldCheck,
  Sparkles,
  Wallet,
  Swords,
  Trophy,
  Target,
  Plus,
  Trash2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Bot,
  Upload,
  Gamepad2,
  Dumbbell,
  Lightbulb,
} from "lucide-react";
import type {
  CurrencyCode,
  DebtStrategy,
  FixedCostItem,
  OnboardingBossInput,
  OnboardingPayload,
  OnboardingQuestInput,
  OnboardingWishlistInput,
  PayFrequency,
  PreferredSessionTime,
  ProfessionClassOption,
  SkillDomain,
  UserSkillConfig,
} from "@/types/rpg";

const INITIAL_CLASSES: ProfessionClassOption[] = [
  {
    name: "Erudito del Pomodoro Arcano",
    badge: "📚 Estudio & Becas",
    desc: "Convierte horas de estudio profundo y lectura académica en GP mientras mantiene gastos estudiantiles bajo control.",
    recommended_skills: ["study", "reading", "rubik", "gaming"],
  },
  {
    name: "Alquimista de Presupuesto Universitario",
    badge: "🧪 Micro-Ahorro & Racha",
    desc: "Multiplica presupuestos ajustados evitando gastos hormiga y desbloqueando recompensas sin endeudarse.",
    recommended_skills: ["study", "sports", "reading"],
  },
  {
    name: "Duelista de Exámenes & Speedcubing",
    badge: "⚡ Agilidad Mental",
    desc: "Entrena memoria activa, concentración bajo presión y deporte para subir de nivel cada semana.",
    recommended_skills: ["study", "rubik", "sports", "gaming"],
  },
];

const QUICK_PROFESSIONS = [
  "Estudiante Universitario",
  "Ingeniero de Software / Programador",
  "Médico / Ciencias de la Salud",
  "Diseñador / Arquitecto / Creativo",
  "Contador / Economista / Finanzas",
  "Emprendedor / Freelancer",
  "Abogado / Docente",
];

const SKILL_CATALOG: Array<{
  domain: SkillDomain;
  label: string;
  desc: string;
  defaultMinutes: number;
  tag?: string;
}> = [
  {
    domain: "rubik",
    label: "Cubos de Rubik",
    desc: "Cronómetro WCA, promedios Ao5/Ao12 y arsenal de cubos.",
    defaultMinutes: 120,
  },
  {
    domain: "reading",
    label: "Sesiones de Lectura",
    desc: "Seguimiento de páginas leídas, libros técnicos y bonos por terminar.",
    defaultMinutes: 150,
  },
  {
    domain: "knitting",
    label: "Sesiones de Tejido & Artesanía",
    desc: "Control de vueltas/filas en proyectos de Crochet, Dos Agujas o Amigurumi.",
    defaultMinutes: 90,
  },
  {
    domain: "study",
    label: "Sesiones de Estudio",
    desc: "Bloques Pomodoro, Deep Study y Active Recall.",
    defaultMinutes: 180,
  },
  {
    domain: "work",
    label: "Sesiones de Trabajo Profundo",
    desc: "Entregables de alto impacto y sprints de productividad profesional.",
    defaultMinutes: 240,
  },
  {
    domain: "gaming",
    label: "Sesiones de Videojuegos / eSports",
    desc: "Juego consciente con límite de tiempo, partidas clasificatorias y retos estratégicos sin tilt.",
    defaultMinutes: 120,
    tag: "🎮 Nuevo",
  },
  {
    domain: "sports",
    label: "Entrenamiento & Competencias Deportivas",
    desc: "Running, gimnasio, fútbol, ciclismo, natación o preparación para torneos.",
    defaultMinutes: 180,
    tag: "🏅 Nuevo",
  },
];

const CURRENCY_LOCALE: Record<CurrencyCode, string> = {
  COP: "es-CO",
  MXN: "es-MX",
  USD: "en-US",
  EUR: "es-ES",
};

export default function OnboardingWizardPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Paso 1: Identidad única + Profesión + Clases con caché / Gemini
  const [displayName, setDisplayName] = useState("Aventurero_" + Math.floor(100 + Math.random() * 900));
  const [nameStatus, setNameStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    reason: string;
  }>({ checking: false, available: true, reason: "" });

  const [profession, setProfession] = useState("Estudiante Universitario");
  const [classOptions, setClassOptions] =
    useState<ProfessionClassOption[]>(INITIAL_CLASSES);
  const [classSource, setClassSource] = useState<
    "catalog_cache" | "gemini_generated" | "fallback"
  >("catalog_cache");
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [characterClass, setCharacterClass] = useState(INITIAL_CLASSES[0].name);
  const [currency, setCurrency] = useState<CurrencyCode>("COP");
  const [timezone, setTimezone] = useState("America/Bogota");

  // Paso 2: Finanzas + Evaluador IA (Pre-calibrado con el historial real Sep-Nov del usuario)
  const [monthlyIncome, setMonthlyIncome] = useState(2415000);
  const [payFrequency, setPayFrequency] = useState<PayFrequency>("biweekly");
  const [payDay, setPayDay] = useState(15);
  const [fixedCosts, setFixedCosts] = useState<FixedCostItem[]>([
    { name: "Internet Hogar (Somos)", amount: 120000, category: "conectividad" },
    { name: "Plan Celular", amount: 100000, category: "conectividad" },
    { name: "Gimnasio Mensual", amount: 120000, category: "salud" },
    { name: "Natillera (Ahorro Fijo)", amount: 100000, category: "ahorro" },
    { name: "Salud & Medicamentos Fijos (Pastillas)", amount: 180000, category: "salud" },
    { name: "Suscripciones (Spotify + Prime)", amount: 56000, category: "conectividad" },
    { name: "Cuidado Personal (Uñas & Peluquería)", amount: 170000, category: "hogar" },
  ]);
  const [variableOpsBudget, setVariableOpsBudget] = useState(610000);
  const [vaultCap, setVaultCap] = useState(400000);
  const [savingsGoalMonthly, setSavingsGoalMonthly] = useState(280000);

  const [financePrompt, setFinancePrompt] = useState("");
  const [analyzingFinances, setAnalyzingFinances] = useState(false);
  const [financeDiagnosis, setFinanceDiagnosis] = useState<string | null>(
    "Historial Real Optimizado (106 movimientos Sep–Nov): Ingreso recurrente de $2,415,000 COP/mes (Sueldo quincenal prom. ×2: $2,065,000 + Clases Juanma: $350,000; excluyendo saldos iniciales y reembolsos). Costos Fijos: $846,000 (35%), Variables Operativos: $610,000 (25%), Bóveda GP: $400,000 (17%) y Flujo Libre / Bola de Nieve: $559,000 COP/mes (23%) para liquidar ADDI y Nequi."
  );
  const [financeAuditLog, setFinanceAuditLog] = useState<string[]>([
    "📅 Historial auditado: 106 movimientos reales (Sep–Nov, 2.05 meses equivalentes).",
    "💰 Ingreso Recurrente Optimizado: $2.415.000 COP/mes (Sueldo quincenal prom. ×2: $2.065.000 + Clases Juanma: $350.000).",
    "🛡️ Excluidos del ingreso fijo: Saldos iniciales ($403.501) y reembolsos/terceros ($1.622.640) para no inflar tu presupuesto.",
    "🏠 Costos Fijos (7 rubros): $846.000 COP/mes (Internet Somos, Celular, Gimnasio, Natillera, Pastillas, Spotify+Prime y Cuidado Personal).",
    "🛒 Variables Operativos: $610.000 COP/mes (Comida diaria ~$410.000, Transporte Uber/Parqueadero ~$130.000, Salud/Uni ~$70.000).",
    "⚔️ Obligaciones Financieras: ADDI (cuota $100.000/mes) y Préstamo Nequi (cuota $56.000/mes).",
    "🎁 Hobbies reales detectados en compras: Cubos ($200.000), Libros ($229.000), Hilos de Tejer ($100.000), LEGO ($20.000) → Convertidos en tu Tienda de Recompensas (Paso 5).",
  ]);
  const [financeMetrics, setFinanceMetrics] = useState<{
    fixed_pct: number;
    variable_pct: number;
    vault_pct: number;
    snowball_power: number;
    snowball_pct: number;
    total_debt: number;
    estimated_debt_free_months: number;
  } | null>({
    fixed_pct: 35,
    variable_pct: 25,
    vault_pct: 17,
    snowball_power: 559000,
    snowball_pct: 23,
    total_debt: 1050000,
    estimated_debt_free_months: 2,
  });

  // Paso 3: Deudas (Bosses) — Pre-cargadas con ADDI y Nequi del CSV
  const [bosses, setBosses] = useState<OnboardingBossInput[]>([
    {
      name: "ADDI",
      total_balance: 600000,
      interest_rate_ea: 29.0,
      min_monthly_payment: 100000,
    },
    {
      name: "Préstamo Nequi",
      total_balance: 450000,
      interest_rate_ea: 24.5,
      min_monthly_payment: 56000,
    },
  ]);
  const [debtStrategy, setDebtStrategy] = useState<DebtStrategy>("avalanche");

  // Paso 4: Todas las habilidades pre-activadas en el mes + Calendario alrededor del Trabajo Inamovible
  const [skills, setSkills] = useState<UserSkillConfig[]>(
    SKILL_CATALOG.map((s) => ({
      domain: s.domain,
      label: s.label,
      weekly_target_minutes: s.defaultMinutes,
      preferred_session_time: s.domain === "work" || s.domain === "study" ? "manana" : "noche",
    }))
  );

  // Configuración del Bloque Inamovible (Trabajo / Universidad = Motor del Sistema)
  const [workDaysPattern, setWorkDaysPattern] = useState<"lun_vie" | "lun_sab">(
    "lun_vie"
  );
  const [workStartHour, setWorkStartHour] = useState("08:00");
  const [workEndHour, setWorkEndHour] = useState("17:30");
  const [freeSlotPreference, setFreeSlotPreference] = useState<
    "after_work" | "before_work" | "mixed"
  >("after_work");
  const [weekdayFreeMinutes, setWeekdayFreeMinutes] = useState(50);
  const [weekendFreeMinutes, setWeekendFreeMinutes] = useState(90);

  const [customSkillName, setCustomSkillName] = useState("");
  const [customSkillIdea, setCustomSkillIdea] = useState("");
  const [customSkillMinutes, setCustomSkillMinutes] = useState(120);

  // Paso 5: Agente IA Planificador de Misiones y Tienda de Recompensas (Basada en los hobbies del CSV)
  const [mainGoal, setMainGoal] = useState(
    "Liquidar ADDI y Nequi mientras mantengo mi racha en Cubos, Lectura, Tejido, Estudio y Gimnasio"
  );
  const [goalDeadline, setGoalDeadline] = useState("2027-06-30");
  const [quests, setQuests] = useState<OnboardingQuestInput[]>([]);
  const [wishlist, setWishlist] = useState<OnboardingWishlistInput[]>([
    {
      name: "Salida Social: Alitas con Saris / Plan con Chicas",
      cost_gp: 65000,
      priority: 1,
    },
    {
      name: "Kit de Hilos para Tejer & Materiales de Crochet",
      cost_gp: 100000,
      priority: 2,
    },
    {
      name: "Nuevo Cubo de Speedcubing / Set LEGO para Colección",
      cost_gp: 180000,
      priority: 3,
    },
    {
      name: "Pack de Libros Nuevos / Edición Especial",
      cost_gp: 220000,
      priority: 4,
    },
  ]);
  const [aiStrategyNote, setAiStrategyNote] = useState<string | null>(null);
  const [planningStep5, setPlanningStep5] = useState(false);
  const [hasAutoPlannedStep5, setHasAutoPlannedStep5] = useState(false);

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) setTimezone(tz);
    } catch {
      // conserva America/Bogota
    }
    fetch("/api/state", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user?.display_name && d.user.display_name !== "Aventurero RPG") {
          setDisplayName(d.user.display_name);
        }
        if (d?.user?.character_class) setCharacterClass(d.user.character_class);
      })
      .catch(() => null);
  }, []);

  // Validación en vivo de que el nombre del aventurero sea único
  useEffect(() => {
    const clean = displayName.trim();
    if (clean.length < 2) {
      setNameStatus({
        checking: false,
        available: false,
        reason: "Mínimo 2 caracteres.",
      });
      return;
    }
    const timer = setTimeout(async () => {
      setNameStatus((prev) => ({ ...prev, checking: true }));
      try {
        const res = await fetch("/api/onboarding/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "check_name", display_name: clean }),
        });
        const data = (await res.json()) as {
          available: boolean;
          reason: string;
        };
        setNameStatus({
          checking: false,
          available: data.available,
          reason: data.reason,
        });
      } catch {
        setNameStatus({ checking: false, available: true, reason: "" });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [displayName]);

  const fetchProfessionClasses = async (profText: string) => {
    if (!profText.trim()) return;
    setLoadingClasses(true);
    try {
      const res = await fetch("/api/onboarding/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "profession_classes",
          profession: profText,
        }),
      });
      const data = (await res.json()) as {
        source: "catalog_cache" | "gemini_generated" | "fallback";
        classes: ProfessionClassOption[];
      };
      if (data.classes && data.classes.length > 0) {
        setClassOptions(data.classes);
        setClassSource(data.source);
        setCharacterClass(data.classes[0].name);
        // Si la primera clase sugiere habilidades, pre-seleccionarlas suavemente
        if (
          data.classes[0].recommended_skills &&
          data.classes[0].recommended_skills.length > 0
        ) {
          const rec = data.classes[0].recommended_skills;
          const mapped = SKILL_CATALOG.filter((c) => rec.includes(c.domain)).map(
            (c) => ({
              domain: c.domain,
              label: c.label,
              weekly_target_minutes: c.defaultMinutes,
              preferred_session_time: "noche" as PreferredSessionTime,
            })
          );
          if (mapped.length > 0) setSkills(mapped);
        }
      }
    } finally {
      setLoadingClasses(false);
    }
  };

  const runFinancialAnalysisWithText = async (rawText: string) => {
    if (!rawText.trim()) return;
    setAnalyzingFinances(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "analyze_finances",
          raw_text: rawText,
          currency,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "No se pudo analizar el texto financiero.");
        return;
      }
      if (data.monthly_income) setMonthlyIncome(data.monthly_income);
      if (Array.isArray(data.fixed_costs) && data.fixed_costs.length > 0) {
        setFixedCosts(data.fixed_costs);
      }
      if (data.variable_ops_budget !== undefined) {
        setVariableOpsBudget(data.variable_ops_budget);
      }
      if (data.vault_cap !== undefined) setVaultCap(data.vault_cap);
      if (data.savings_goal_monthly !== undefined) {
        setSavingsGoalMonthly(data.savings_goal_monthly);
      }
      if (Array.isArray(data.bosses) && data.bosses.length > 0) {
        setBosses(data.bosses);
      }
      if (
        Array.isArray(data.suggested_wishlist) &&
        data.suggested_wishlist.length > 0
      ) {
        setWishlist(data.suggested_wishlist);
        setHasAutoPlannedStep5(true);
      }
      if (data.recommended_debt_strategy) {
        setDebtStrategy(data.recommended_debt_strategy);
      }
      setFinanceDiagnosis(data.diagnosis || null);
      if (data.audit_metrics) {
        setFinanceMetrics(data.audit_metrics);
        setFinanceAuditLog(data.audit_metrics.detected_items_log || []);
      }
    } finally {
      setAnalyzingFinances(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setFinancePrompt(text);
    await runFinancialAnalysisWithText(text);
  };

  const runFinancialAnalysis = async () => {
    await runFinancialAnalysisWithText(financePrompt);
  };

  const runStep5Planner = async (preserveExistingWishlist = false) => {
    setPlanningStep5(true);
    try {
      const effectiveSkills: UserSkillConfig[] = [
        ...skills,
        ...(customSkillName.trim()
          ? [
              {
                domain: "general" as SkillDomain,
                label: customSkillName.trim(),
                weekly_target_minutes: customSkillMinutes,
                custom_description:
                  customSkillIdea.trim() || "Sesión práctica registrada",
              },
            ]
          : []),
      ];

      const res = await fetch("/api/onboarding/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "plan_quests_rewards",
          profession,
          character_class: characterClass,
          currency,
          monthly_income: monthlyIncome,
          vault_cap: vaultCap,
          fixed_costs: fixedCosts,
          bosses,
          skills: effectiveSkills,
        }),
      });
      const data = await res.json();
      if (!preserveExistingWishlist && data.main_goal) {
        setMainGoal(data.main_goal);
      }
      if (Array.isArray(data.quests) && data.quests.length > 0) {
        setQuests(data.quests);
      }
      if (
        !preserveExistingWishlist &&
        Array.isArray(data.wishlist) &&
        data.wishlist.length > 0
      ) {
        setWishlist(data.wishlist);
      }
      if (data.strategy_note) setAiStrategyNote(data.strategy_note);
    } finally {
      setPlanningStep5(false);
    }
  };

  // Al entrar al Paso 5 por primera vez, el Agente IA genera misiones conservando la Wishlist de tus hobbies reales
  useEffect(() => {
    if (step === 5 && !hasAutoPlannedStep5) {
      setHasAutoPlannedStep5(true);
      runStep5Planner(true);
    }
  }, [step, hasAutoPlannedStep5]);

  const fmt = (val: number) =>
    `${currency} ${(Number(val) || 0).toLocaleString(CURRENCY_LOCALE[currency])}`;

  const totalFixedCosts = useMemo(
    () =>
      fixedCosts.reduce(
        (acc, fc) => acc + Math.max(0, Number(fc.amount) || 0),
        0
      ),
    [fixedCosts]
  );

  const freeCashflow = useMemo(
    () => monthlyIncome - totalFixedCosts - variableOpsBudget - vaultCap,
    [monthlyIncome, totalFixedCosts, variableOpsBudget, vaultCap]
  );

  const recommendedStrategy: DebtStrategy = useMemo(() => {
    const valid = bosses.filter((b) => b.total_balance > 0);
    if (valid.length <= 1) return "snowball";
    const maxRate = Math.max(...valid.map((b) => b.interest_rate_ea));
    return maxRate >= 24 ? "avalanche" : "snowball";
  }, [bosses]);

  const toggleSkill = (domain: SkillDomain) => {
    const exists = skills.some((s) => s.domain === domain);
    if (exists) {
      if (skills.length <= 1) return;
      setSkills(skills.filter((s) => s.domain !== domain));
    } else {
      const cat = SKILL_CATALOG.find((c) => c.domain === domain)!;
      setSkills([
        ...skills,
        {
          domain: cat.domain,
          label: cat.label,
          weekly_target_minutes: cat.defaultMinutes,
          preferred_session_time: "noche",
        },
      ]);
    }
  };

  const updateSkillConfig = (
    domain: SkillDomain,
    patch: Partial<UserSkillConfig>
  ) => {
    setSkills(
      skills.map((s) => (s.domain === domain ? { ...s, ...patch } : s))
    );
  };

  const finishOnboarding = async () => {
    setError(null);
    if (nameStatus.available === false) {
      setError(
        "El nombre de aventurero elegido ya está en uso. Por favor cámbialo en el Paso 1."
      );
      setStep(1);
      return;
    }
    if (freeCashflow < 0) {
      setError(
        "Tus presupuestos superan tu ingreso mensual. Ajusta el Paso 2 antes de finalizar."
      );
      setStep(2);
      return;
    }
    setSubmitting(true);
    try {
      const finalSkills: UserSkillConfig[] = [
        ...skills,
        ...(customSkillName.trim()
          ? [
              {
                domain: "general" as SkillDomain,
                label: customSkillName.trim(),
                weekly_target_minutes: customSkillMinutes,
                preferred_session_time: "noche" as PreferredSessionTime,
                custom_description:
                  customSkillIdea.trim() || "Habilidad personalizada",
              },
            ]
          : []),
      ];

      const payload: OnboardingPayload = {
        display_name: displayName.trim(),
        profession: profession.trim() || "Estudiante / Explorador",
        character_class: characterClass,
        currency,
        timezone,
        monthly_income: monthlyIncome,
        pay_frequency: payFrequency,
        pay_day: payDay,
        fixed_costs: fixedCosts.filter((fc) => fc.name.trim().length > 0),
        variable_ops_budget: variableOpsBudget,
        vault_cap: vaultCap,
        savings_goal_monthly: savingsGoalMonthly,
        debt_strategy: debtStrategy,
        bosses: bosses.filter(
          (b) => b.name.trim().length > 0 && Number(b.total_balance) > 0
        ),
        skills: finalSkills,
        custom_skill_suggestion: customSkillName.trim()
          ? {
              skill_name: customSkillName.trim(),
              tracking_idea: customSkillIdea.trim(),
              weekly_target_minutes: customSkillMinutes,
            }
          : null,
        quests: quests.filter(
          (q) => q.title.trim().length > 0 && Number(q.reward_gp) > 0
        ),
        wishlist: wishlist.filter(
          (w) => w.name.trim().length > 0 && Number(w.cost_gp) > 0
        ),
        main_goal: mainGoal.trim() || undefined,
        goal_deadline: goalDeadline || undefined,
      };

      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || json.error) {
        setError(json.error || `Error ${res.status}`);
        return;
      }
      window.location.href = "/";
    } catch {
      setError("No se pudo guardar tu configuración inicial.");
    } finally {
      setSubmitting(false);
    }
  };

  // Generador automático de Calendario Semanal y Mensual alrededor del Trabajo Inamovible
  const calendarPlan = useMemo(() => {
    const dayNames = [
      { key: "Lun", label: "Lunes", isWeekend: false, isWorkDay: true },
      { key: "Mar", label: "Martes", isWeekend: false, isWorkDay: true },
      { key: "Mié", label: "Miércoles", isWeekend: false, isWorkDay: true },
      { key: "Jue", label: "Jueves", isWeekend: false, isWorkDay: true },
      { key: "Vie", label: "Viernes", isWeekend: false, isWorkDay: true },
      {
        key: "Sáb",
        label: "Sábado",
        isWeekend: true,
        isWorkDay: workDaysPattern === "lun_sab",
      },
      { key: "Dom", label: "Domingo", isWeekend: true, isWorkDay: false },
    ];

    const nonWorkSkills = skills.filter((s) => s.domain !== "work");
    const allRotatable: Array<{
      domain: SkillDomain;
      label: string;
    }> = [
      ...(nonWorkSkills.length > 0 ? nonWorkSkills : skills).map((s) => ({
        domain: s.domain,
        label: s.label,
      })),
      ...(customSkillName.trim()
        ? [
            {
              domain: "general" as SkillDomain,
              label: customSkillName.trim(),
            },
          ]
        : []),
    ];

    const weeklyGpTarget = Math.max(100, Math.round(vaultCap / 4));
    const gpPerDay = Math.max(25, Math.round(weeklyGpTarget / 7));

    const weeklyMinutesByDomain: Record<string, number> = {};
    const preferredTimeByDomain: Record<string, PreferredSessionTime> = {};

    // El bloque de Trabajo (motor del sistema) acumula sus minutos en los días laborales
    const workDaysCount = workDaysPattern === "lun_sab" ? 6 : 5;
    weeklyMinutesByDomain["work"] = workDaysCount * 60;
    preferredTimeByDomain["work"] = "manana";

    let cursor = 0;
    const days = dayNames.map((d, idx) => {
      const totalDayMins = d.isWorkDay ? weekdayFreeMinutes : weekendFreeMinutes;
      const slotLabel = d.isWorkDay
        ? freeSlotPreference === "before_work"
          ? `06:15 – 07:15 (Antes de ${workStartHour})`
          : freeSlotPreference === "mixed" && idx % 2 === 0
          ? `06:30 (Mañana) / Después de ${workEndHour}`
          : `${workEndHour} +1h (Noche libre)`
        : "10:00 – 12:00 (Mañana / Tarde Libre)";

      const prefTime: PreferredSessionTime = !d.isWorkDay
        ? "tarde"
        : freeSlotPreference === "before_work"
        ? "manana"
        : "noche";

      const firstSkill =
        allRotatable[cursor % Math.max(1, allRotatable.length)];
      cursor++;
      const secondSkill =
        allRotatable.length > 1
          ? allRotatable[cursor % allRotatable.length]
          : null;
      if (secondSkill && (!d.isWorkDay || totalDayMins >= 45)) {
        cursor++;
      }

      const scheduled =
        secondSkill && (!d.isWorkDay || totalDayMins >= 45)
          ? [
              {
                ...firstSkill,
                minutes: Math.round(totalDayMins * 0.55),
              },
              {
                ...secondSkill,
                minutes: Math.max(15, totalDayMins - Math.round(totalDayMins * 0.55)),
              },
            ]
          : [
              {
                ...firstSkill,
                minutes: totalDayMins,
              },
            ];

      for (const item of scheduled) {
        if (!item) continue;
        weeklyMinutesByDomain[item.domain] =
          (weeklyMinutesByDomain[item.domain] || 0) + item.minutes;
        preferredTimeByDomain[item.domain] = prefTime;
      }

      return {
        ...d,
        immovableBlock: d.isWorkDay
          ? `🔒 ${workStartHour} – ${workEndHour} · Trabajo / Estudio (Inamovible)`
          : "🌿 Día sin bloque laboral fijo",
        freeWindowLabel: slotLabel,
        scheduled,
        totalDayMins,
        gpUnlocked: gpPerDay,
      };
    });

    return {
      days,
      weeklyMinutesByDomain,
      preferredTimeByDomain,
      weeklyGpTarget,
    };
  }, [
    skills,
    customSkillName,
    workDaysPattern,
    workStartHour,
    workEndHour,
    freeSlotPreference,
    weekdayFreeMinutes,
    weekendFreeMinutes,
    vaultCap,
  ]);

  const syncSkillsFromCalendar = () => {
    setSkills((prev) =>
      prev.map((s) => ({
        ...s,
        weekly_target_minutes: Math.max(
          30,
          calendarPlan.weeklyMinutesByDomain[s.domain] || s.weekly_target_minutes
        ),
        preferred_session_time:
          calendarPlan.preferredTimeByDomain[s.domain] ||
          s.preferred_session_time ||
          "noche",
      }))
    );
    if (customSkillName.trim() && calendarPlan.weeklyMinutesByDomain["general"]) {
      setCustomSkillMinutes(calendarPlan.weeklyMinutesByDomain["general"]);
    }
  };

  // Sincroniza automáticamente las metas semanales y horarios con el calendario
  useEffect(() => {
    syncSkillsFromCalendar();
  }, [
    workDaysPattern,
    workStartHour,
    workEndHour,
    freeSlotPreference,
    weekdayFreeMinutes,
    weekendFreeMinutes,
  ]);

  const donutSegments = useMemo(() => {
    const total = Math.max(1, monthlyIncome);
    const segments = [
      {
        label: "Costos Fijos",
        value: Math.max(0, totalFixedCosts),
        color: "#6366f1",
      },
      {
        label: "Variables Operativos",
        value: Math.max(0, variableOpsBudget),
        color: "#10b981",
      },
      {
        label: "Bóveda Mensual (GP)",
        value: Math.max(0, vaultCap),
        color: "#f59e0b",
      },
      {
        label: "Flujo Libre / Bola de Nieve",
        value: Math.max(0, freeCashflow),
        color: "#06b6d4",
      },
    ];
    let cumulativePct = 0;
    return segments.map((s) => {
      const pct = Math.min(100, Math.round((s.value / total) * 100));
      const offset = 100 - cumulativePct;
      cumulativePct += pct;
      return { ...s, pct, offset };
    });
  }, [monthlyIncome, totalFixedCosts, variableOpsBudget, vaultCap, freeCashflow]);

  return (
    <div className="min-h-screen bg-[#090d16] px-4 py-10 text-slate-200">
      <div className="mx-auto max-w-4xl">
        {/* ENCABEZADO Y BARRA DE PROGRESO DE 5 PASOS */}
        <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
                <Sparkles className="h-3.5 w-3.5" /> CREACIÓN DE PERSONAJE &
                TESORERÍA IA
              </span>
              <h1 className="mt-2 text-2xl font-bold text-white">
                Configura tu Motor de Vida RPG
              </h1>
              <p className="text-xs text-slate-400">
                Paso {step} de 5 — Personalización asistida por catálogo +
                Gemini IA.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStep(s as 1 | 2 | 3 | 4 | 5)}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold transition ${
                    step === s
                      ? "bg-emerald-600 text-white ring-2 ring-emerald-400/50"
                      : step > s
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-rose-500/40 bg-rose-950/40 p-4 text-sm text-rose-200">
            <AlertTriangle className="h-5 w-5 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* PASO 1: NOMBRE ÚNICO + PROFESIÓN + CLASES PERSONALIZADAS */}
        {step === 1 && (
          <div className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <div className="flex items-center gap-2 text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
              <h2 className="text-lg font-bold text-white">
                Paso 1 · Nombre Único, Profesión y Clase Personalizada
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Nombre de Aventurero (Único en la base de datos)
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={`mt-1 w-full rounded-xl border bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none ${
                    nameStatus.available === false
                      ? "border-rose-500"
                      : "border-slate-700 focus:border-emerald-500"
                  }`}
                  placeholder="Ej. Isabella_RPG"
                />
                <p
                  className={`mt-1 text-[11px] ${
                    nameStatus.checking
                      ? "text-slate-400"
                      : nameStatus.available
                      ? "text-emerald-400"
                      : "text-rose-400"
                  }`}
                >
                  {nameStatus.checking
                    ? "Verificando disponibilidad en la base de datos..."
                    : nameStatus.available
                    ? `✅ ${nameStatus.reason || "Nombre único disponible"}`
                    : `❌ ${nameStatus.reason}`}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300">
                  Moneda Principal
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                >
                  <option value="COP">COP — Peso Colombiano ($)</option>
                  <option value="USD">USD — Dólar ($)</option>
                  <option value="MXN">MXN — Peso Mexicano ($)</option>
                  <option value="EUR">EUR — Euro (€)</option>
                </select>
              </div>
            </div>

            {/* PROFESIÓN / OCUPACIÓN CON CACHÉ EN BD + FALLBACK A GEMINI */}
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-indigo-300">
                ¿Cuál es tu profesión u ocupación actual? (o indica si eres
                estudiante)
              </label>
              <p className="mt-0.5 text-xs text-slate-400">
                Primero buscamos en nuestra tabla de profesiones; si no existe,
                Gemini genera tus clases RPG a medida y las guarda en la base de
                datos.
              </p>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={profession}
                  onChange={(e) => setProfession(e.target.value)}
                  placeholder="Ej. Estudiante de Arquitectura, Chef, Ingeniero Civil, Médico..."
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white outline-none focus:border-indigo-400"
                />
                <button
                  type="button"
                  disabled={loadingClasses}
                  onClick={() => fetchProfessionClasses(profession)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  <Bot className="h-4 w-4" />
                  {loadingClasses
                    ? "Consultando..."
                    : "Generar Personajes según Profesión"}
                </button>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {QUICK_PROFESSIONS.map((qp) => (
                  <button
                    key={qp}
                    type="button"
                    onClick={() => {
                      setProfession(qp);
                      fetchProfessionClasses(qp);
                    }}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                      profession === qp
                        ? "bg-indigo-500 text-white"
                        : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    {qp}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold text-slate-300">
                  Elige tu Clase de Personaje Personalizada
                </label>
                <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[11px] text-cyan-300">
                  {classSource === "catalog_cache"
                    ? "⚡ Cargado desde Tabla de Búsqueda (sin gastar llamadas API)"
                    : classSource === "gemini_generated"
                    ? "✨ Creado por Gemini IA y guardado en la Tabla de Profesiones"
                    : "🛡️ Arquetipo Adaptado a tu Profesión"}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {classOptions.map((c) => {
                  const active = characterClass === c.name;
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setCharacterClass(c.name)}
                      className={`rounded-xl border p-4 text-left transition ${
                        active
                          ? "border-emerald-500 bg-emerald-950/30 ring-1 ring-emerald-500/40"
                          : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                      }`}
                    >
                      <span className="inline-block rounded-full bg-slate-800 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                        {c.badge}
                      </span>
                      <p className="mt-2 font-bold text-white">{c.name}</p>
                      <p className="mt-1 text-xs text-slate-400">{c.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* PASO 2: FINANZAS MENSUALES + EVALUADOR GEMINI + DONA EN VIVO */}
        {step === 2 && (
          <div className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <div className="flex items-center gap-2 text-emerald-400">
              <Wallet className="h-5 w-5" />
              <h2 className="text-lg font-bold text-white">
                Paso 2 · Ingresos, Costos Fijos y Evaluador Financiero con
                Gemini
              </h2>
            </div>

            {/* MOTOR FINANCIERO DETERMINISTA & GEMINI IA (TEXTO LIBRE O TABLA CSV) */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-950/15 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    Motor Financiero IA — Autocompletar (Texto Libre o Tabla /
                    CSV)
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setFinancePrompt(
                        "Gano 1.600.000 quincenal. Pago 780 mil de arriendo al mes, 165 mil de servicios, 95 mil de internet y celular, y 80 mil de gimnasio. En mercado gasto 480 mil y en transporte 15 mil diarios. Debo 850 mil en tarjeta Nu al 28.5% y 380 mil en Nequi."
                      )
                    }
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:border-amber-500/40 hover:text-amber-200"
                  >
                    📝 Ejemplo Texto Libre
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const sampleRealCsv = [
                        "Fecha,Tipo,Categoría,Monto,Descripción,Método de Pago,Detalle,ID Registro",
                        '2026-09-04,Ingreso,Inversiones,"$233,501.00",Inicial cuenta,Debito,,1',
                        '2026-09-17,Ingreso,Sueldo,"$1,224,561.00",Pago sept 1,Debito,,22',
                        '2026-10-03,Ingreso,Sueldo,"$791,754.00",Pago sept 2,Debito,,43',
                        '2026-10-04,Ingreso,Clases,"$200,000.00",Clases Juanma,Debito,,44',
                        '2026-10-16,Ingreso,Sueldo,"$1,145,359.00",Pago oct 1,Debito,,60',
                        '2026-10-21,Ingreso,Sueldo,"$915,000.00",Pago oct 2,Debito,,68',
                        '2026-10-29,Ingreso,Clases,"$150,000.00",Clases Juanma,Debito,,76',
                        '2026-09-09,Egreso,Pago internet,"$119,900.00",Internet Sep,Debito,,13',
                        '2026-10-09,Egreso,Pago internet,"$120,000.00",Somos,Debito,,54',
                        '2026-09-06,Egreso,Pago Celular,"$100,000.00",Cel Isa y Sandris,Debito,,5',
                        '2026-10-09,Egreso,Pago Celular,"$99,519.00",Cel Isa,Debito,,55',
                        '2026-09-20,Egreso,Otros,"$120,000.00",Gimnasio,Debito,,28',
                        '2026-10-20,Egreso,Otros,"$120,000.00",Gimnasio,Debito,,66',
                        '2026-09-21,Egreso,Otros,"$100,000.00",Natillera,Debito,,30',
                        '2026-10-03,Egreso,Otros,"$100,000.00",Natillera,Debito,,41',
                        '2026-09-06,Egreso,Salud,"$181,400.00",Pastillas,Debito,,6',
                        '2026-10-05,Egreso,Salud,"$178,400.00",Pastillas,Debito,,48',
                        '2026-09-18,Egreso,Suscripciones,"$31,000.00",Spotify,Debito,,23',
                        '2026-09-19,Egreso,Suscripciones,"$25,000.00",Prime,Debito,,26',
                        '2026-09-26,Egreso,Otros,"$115,000.00",Uñas,Debito,,37',
                        '2026-09-26,Egreso,Otros,"$55,000.00",Mona,Efectivo,,38',
                        '2026-09-18,Egreso,Comida,"$410,000.00",Almuerzos y mercado mes 1,Debito,,24',
                        '2026-10-18,Egreso,Comida,"$410,000.00",Almuerzos y mercado mes 2,Debito,,62',
                        '2026-09-12,Egreso,Transporte,"$130,000.00",Uber sede y parqueadero mes 1,Debito,,16',
                        '2026-10-12,Egreso,Transporte,"$130,000.00",Uber sede y parqueadero mes 2,Debito,,58',
                        '2026-09-09,Egreso,Obligaciones financieras,"$101,855.00",Addi,Debito,,11',
                        '2026-10-09,Egreso,Obligaciones financieras,"$98,420.00",Addi,Debito,,56',
                        '2026-09-19,Egreso,Obligaciones financieras,"$56,281.00",Nequi,Debito,,25',
                        '2026-10-29,Egreso,Obligaciones financieras,"$55,213.00",Nequi,Debito,,78',
                        '2026-09-07,Egreso,Otros,"$200,000.00",Cubitos,Debito,,10',
                        '2026-09-15,Egreso,Otros,"$229,000.00",Libros,Debito,,20',
                        '2026-09-14,Egreso,Otros,"$80,000.00",Hilos para tejer,Debito,,19',
                        '2026-09-21,Egreso,Otros,"$20,000.00",LEGO,Debito,,29',
                      ].join("\n");
                      setFinancePrompt(sampleRealCsv);
                      runFinancialAnalysisWithText(sampleRealCsv);
                    }}
                    className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/25"
                  >
                    📂 Cargar y Optimizar Mi Historial Real (CSV)
                  </button>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-500/20">
                    <Upload className="h-3.5 w-3.5" />
                    Adjuntar CSV / TXT
                    <input
                      type="file"
                      accept=".csv,.txt,.tsv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                El Motor Financiero mensualiza sueldos quincenales/semanales o
                gastos diarios, clasifica tus 5 cubetas (Fijos, Variables,
                Bóveda GP, Flujo Libre y Deudas) e infiere tasas E.A. y cuotas
                mínimas.
              </p>
              <textarea
                rows={3}
                value={financePrompt}
                onChange={(e) => setFinancePrompt(e.target.value)}
                placeholder="Escribe tus ingresos (mensual o quincenal), arriendo, servicios, mercado, transporte y deudas, o pega filas de Excel/CSV..."
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-white outline-none focus:border-amber-400"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={analyzingFinances || !financePrompt.trim()}
                  onClick={runFinancialAnalysis}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-500/20 px-4 py-2 text-xs font-bold text-amber-200 ring-1 ring-amber-500/40 hover:bg-amber-500/30 disabled:opacity-40"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {analyzingFinances
                    ? "Ejecutando Motor Financiero..."
                    : "Ejecutar Motor Financiero y Autocompletar"}
                </button>
                {financeDiagnosis && (
                  <span className="text-[11px] font-semibold text-emerald-300">
                    ✅ Auditoría completada y aplicada a los Pasos 2 y 3
                  </span>
                )}
              </div>
              {financeDiagnosis && (
                <div className="mt-3 space-y-2 rounded-xl border border-slate-800 bg-slate-950/90 p-3 text-xs">
                  <p className="text-slate-200">
                    💡 <strong>Dictamen del Motor Financiero:</strong>{" "}
                    {financeDiagnosis}
                  </p>
                  {financeMetrics && (
                    <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-4">
                      <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2">
                        <span className="text-[10px] text-slate-400">
                          Ratio Costos Fijos
                        </span>
                        <p className="font-bold text-indigo-300">
                          {financeMetrics.fixed_pct}% del ingreso
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2">
                        <span className="text-[10px] text-slate-400">
                          Ratio Operativo
                        </span>
                        <p className="font-bold text-emerald-300">
                          {financeMetrics.variable_pct}% del ingreso
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2">
                        <span className="text-[10px] text-slate-400">
                          Bóveda GP (Gustos)
                        </span>
                        <p className="font-bold text-amber-300">
                          {financeMetrics.vault_pct}% ({fmt(vaultCap)})
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2">
                        <span className="text-[10px] text-slate-400">
                          Libertad de Deudas
                        </span>
                        <p className="font-bold text-cyan-300">
                          {financeMetrics.estimated_debt_free_months > 0
                            ? `~${financeMetrics.estimated_debt_free_months} meses (TTK)`
                            : "Libre de deudas"}
                        </p>
                      </div>
                    </div>
                  )}
                  {financeAuditLog.length > 0 && (
                    <div className="mt-2 border-t border-slate-800 pt-2">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Desglose detectado y normalizado por el motor:
                      </p>
                      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                        {financeAuditLog.map((line, i) => (
                          <span
                            key={i}
                            className="rounded bg-slate-900 px-2 py-1 text-[11px] text-slate-300"
                          >
                            {line}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="space-y-4 lg:col-span-7">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300">
                      Ingreso Mensual ({currency})
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={monthlyIncome}
                      onChange={(e) =>
                        setMonthlyIncome(Math.max(0, Number(e.target.value)))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300">
                      Frecuencia de Pago
                    </label>
                    <select
                      value={payFrequency}
                      onChange={(e) =>
                        setPayFrequency(e.target.value as PayFrequency)
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                    >
                      <option value="monthly">Mensual</option>
                      <option value="biweekly">Quincenal</option>
                      <option value="weekly">Semanal</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300">
                      Día de Corte / Pago
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={payDay}
                      onChange={(e) =>
                        setPayDay(
                          Math.min(31, Math.max(1, Number(e.target.value)))
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                    />
                  </div>
                </div>

                {/* DESGLOSE DE COSTOS FIJOS */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                      Desglose de Costos Fijos ({fmt(totalFixedCosts)})
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setFixedCosts([
                          ...fixedCosts,
                          { name: "", amount: 0, category: "otros" },
                        ])
                      }
                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-500/20 px-2.5 py-1 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/30"
                    >
                      <Plus className="h-3.5 w-3.5" /> Añadir rubro
                    </button>
                  </div>

                  <div className="space-y-2">
                    {fixedCosts.map((fc, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Ej. Arriendo, Gimnasio..."
                          value={fc.name}
                          onChange={(e) => {
                            const next = [...fixedCosts];
                            next[idx] = { ...fc, name: e.target.value };
                            setFixedCosts(next);
                          }}
                          className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white"
                        />
                        <input
                          type="number"
                          min={0}
                          value={fc.amount}
                          onChange={(e) => {
                            const next = [...fixedCosts];
                            next[idx] = {
                              ...fc,
                              amount: Math.max(0, Number(e.target.value)),
                            };
                            setFixedCosts(next);
                          }}
                          className="w-32 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white"
                        />
                        {fixedCosts.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setFixedCosts(
                                fixedCosts.filter((_, i) => i !== idx)
                              )
                            }
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300">
                      Variables Operativos (Mercado, Transporte)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={variableOpsBudget}
                      onChange={(e) =>
                        setVariableOpsBudget(
                          Math.max(0, Number(e.target.value))
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300">
                      Tope Bóveda Mensual (Gustos / GP)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={vaultCap}
                      onChange={(e) =>
                        setVaultCap(Math.max(0, Number(e.target.value)))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300">
                      Meta de Ahorro Mensual (Opcional)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={savingsGoalMonthly}
                      onChange={(e) =>
                        setSavingsGoalMonthly(
                          Math.max(0, Number(e.target.value))
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                    />
                  </div>
                </div>
              </div>

              {/* GRÁFICA DE DONA EN VIVO */}
              <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/80 p-5 lg:col-span-5">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                  Distribución de tu Ingreso en Vivo
                </p>
                <div className="relative h-44 w-44">
                  <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                    <circle
                      cx="18"
                      cy="18"
                      r="15.915"
                      fill="transparent"
                      stroke="#1e293b"
                      strokeWidth="3.8"
                    />
                    {donutSegments.map((seg) => (
                      <circle
                        key={seg.label}
                        cx="18"
                        cy="18"
                        r="15.915"
                        fill="transparent"
                        stroke={seg.color}
                        strokeWidth="3.8"
                        strokeDasharray={`${seg.pct} ${100 - seg.pct}`}
                        strokeDashoffset={seg.offset}
                      />
                    ))}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] text-slate-400">
                      Flujo Libre
                    </span>
                    <span
                      className={`text-sm font-extrabold ${
                        freeCashflow < 0 ? "text-rose-400" : "text-cyan-400"
                      }`}
                    >
                      {fmt(freeCashflow)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 w-full space-y-1.5 text-xs">
                  {donutSegments.map((seg) => (
                    <div
                      key={seg.label}
                      className="flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2 text-slate-300">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: seg.color }}
                        />
                        {seg.label}
                      </span>
                      <span className="font-semibold text-white">
                        {seg.pct}% ({fmt(seg.value)})
                      </span>
                    </div>
                  ))}
                </div>

                {freeCashflow < 0 && (
                  <p className="mt-3 rounded-lg bg-rose-500/15 p-2 text-center text-[11px] font-semibold text-rose-300">
                    ⚠️ Tus gastos superan tu ingreso por{" "}
                    {fmt(Math.abs(freeCashflow))}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PASO 3: DEUDAS (BOSSES) — OPCIONAL */}
        {step === 3 && (
          <div className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-rose-400">
                <Swords className="h-5 w-5" />
                <h2 className="text-lg font-bold text-white">
                  Paso 3 · Deudas Actuales (Debt Bosses) — Opcional
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setBosses([]);
                  setStep(4);
                }}
                className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20"
              >
                🎉 No tengo deudas → Activar Modo Ahorro y Saltar
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Cada deuda se convierte en un Jefe con barra de vida (HP). Puedes
              poner cualquier nombre (ej. Tarjeta Nu, Crédito Vehículo, ICETEX,
              Nequi).
            </p>

            <div className="space-y-3">
              {bosses.map((b, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3 sm:grid-cols-12 sm:items-end"
                >
                  <div className="sm:col-span-4">
                    <label className="text-[11px] text-slate-400">
                      Nombre de la Deuda / Entidad
                    </label>
                    <input
                      type="text"
                      value={b.name}
                      onChange={(e) => {
                        const next = [...bosses];
                        next[idx] = { ...b, name: e.target.value };
                        setBosses(next);
                      }}
                      className="mt-0.5 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="text-[11px] text-slate-400">
                      Saldo Total (HP)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={b.total_balance}
                      onChange={(e) => {
                        const next = [...bosses];
                        next[idx] = {
                          ...b,
                          total_balance: Math.max(0, Number(e.target.value)),
                        };
                        setBosses(next);
                      }}
                      className="mt-0.5 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[11px] text-slate-400">
                      Tasa E.A. (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      value={b.interest_rate_ea}
                      onChange={(e) => {
                        const next = [...bosses];
                        next[idx] = {
                          ...b,
                          interest_rate_ea: Math.max(0, Number(e.target.value)),
                        };
                        setBosses(next);
                      }}
                      className="mt-0.5 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[11px] text-slate-400">
                      Cuota Mínima
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={b.min_monthly_payment}
                      onChange={(e) => {
                        const next = [...bosses];
                        next[idx] = {
                          ...b,
                          min_monthly_payment: Math.max(
                            0,
                            Number(e.target.value)
                          ),
                        };
                        setBosses(next);
                      }}
                      className="mt-0.5 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div className="flex justify-end sm:col-span-1">
                    <button
                      type="button"
                      onClick={() =>
                        setBosses(bosses.filter((_, i) => i !== idx))
                      }
                      className="rounded-lg p-2 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() =>
                  setBosses([
                    ...bosses,
                    {
                      name: `Deuda ${bosses.length + 1}`,
                      total_balance: 300000,
                      interest_rate_ea: 24.0,
                      min_monthly_payment: 45000,
                    },
                  ])
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-slate-600"
              >
                <Plus className="h-4 w-4" /> Añadir otra deuda
              </button>
            </div>

            {bosses.length > 0 && (
              <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-4">
                <p className="text-xs font-semibold text-indigo-300">
                  Estrategia de Amortización (Recomendada:{" "}
                  {recommendedStrategy === "avalanche"
                    ? "Avalancha por tasas altas"
                    : "Bola de Nieve por victorias rápidas"}
                  )
                </p>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setDebtStrategy("snowball")}
                    className={`rounded-xl border p-3 text-left text-xs ${
                      debtStrategy === "snowball"
                        ? "border-emerald-500 bg-emerald-950/30 text-white"
                        : "border-slate-800 bg-slate-950/50 text-slate-400"
                    }`}
                  >
                    <span className="font-bold">❄️ Bola de Nieve</span> — Ataca
                    primero la deuda de menor saldo para liberar flujo rápido.
                  </button>
                  <button
                    type="button"
                    onClick={() => setDebtStrategy("avalanche")}
                    className={`rounded-xl border p-3 text-left text-xs ${
                      debtStrategy === "avalanche"
                        ? "border-emerald-500 bg-emerald-950/30 text-white"
                        : "border-slate-800 bg-slate-950/50 text-slate-400"
                    }`}
                  >
                    <span className="font-bold">🏔️ Avalancha</span> — Ataca
                    primero la deuda con mayor tasa E.A. para pagar menos
                    intereses.
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PASO 4: CALENDARIO MENSUAL/SEMANAL CON TRABAJO INAMOVIBLE + TODAS LAS HABILIDADES */}
        {step === 4 && (
          <div className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-emerald-400">
                <Trophy className="h-5 w-5" />
                <h2 className="text-lg font-bold text-white">
                  Paso 4 · Calendario Mensual del Santuario (Trabajo Inamovible
                  + Todas tus Habilidades)
                </h2>
              </div>
              <button
                type="button"
                onClick={() =>
                  setSkills(
                    SKILL_CATALOG.map((s) => ({
                      domain: s.domain,
                      label: s.label,
                      weekly_target_minutes:
                        calendarPlan.weeklyMinutesByDomain[s.domain] ||
                        s.defaultMinutes,
                      preferred_session_time:
                        calendarPlan.preferredTimeByDomain[s.domain] || "noche",
                    }))
                  )
                }
                className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20"
              >
                ✅ Activar Todas las Habilidades en el Mes
              </button>
            </div>

            <p className="text-xs text-slate-400">
              No tienes que adivinar cuántos minutos semanales poner: indica tu{" "}
              <strong>horario inamovible de Trabajo / Estudio</strong> (que es
              el motor base del sistema) y el planificador distribuirá todas tus
              habilidades en un calendario semanal para que las desarrolles
              todas durante las 4 semanas del mes y liberes el 100% de tu
              Bóveda.
            </p>

            {/* 1. CONFIGURADOR DEL BLOQUE INAMOVIBLE (TRABAJO / UNIVERSIDAD) */}
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                  🔒 1. Define tu Bloque Inamovible (Trabajo / Clases = Motor
                  del Sistema)
                </span>
                <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-200">
                  Meta mensual calculada sola
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                <div>
                  <label className="block text-[11px] text-slate-300">
                    Días Inamovibles
                  </label>
                  <select
                    value={workDaysPattern}
                    onChange={(e) =>
                      setWorkDaysPattern(
                        e.target.value as "lun_vie" | "lun_sab"
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="lun_vie">Lunes a Viernes</option>
                    <option value="lun_sab">Lunes a Sábado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-300">
                    Inicio Trabajo/Estudio
                  </label>
                  <input
                    type="time"
                    value={workStartHour}
                    onChange={(e) => setWorkStartHour(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-300">
                    Fin Trabajo/Estudio
                  </label>
                  <input
                    type="time"
                    value={workEndHour}
                    onChange={(e) => setWorkEndHour(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-300">
                    Ventana Libre Preferida
                  </label>
                  <select
                    value={freeSlotPreference}
                    onChange={(e) =>
                      setFreeSlotPreference(
                        e.target.value as
                          | "after_work"
                          | "before_work"
                          | "mixed"
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="after_work">Después del Trabajo (Noche)</option>
                    <option value="before_work">Antes del Trabajo (Mañana)</option>
                    <option value="mixed">Mixto (Mañana + Noche)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-300">
                    Tiempo Libre (Lun-Vie / FinSem)
                  </label>
                  <div className="mt-1 flex items-center gap-1">
                    <input
                      type="number"
                      min={20}
                      max={180}
                      step={5}
                      value={weekdayFreeMinutes}
                      onChange={(e) =>
                        setWeekdayFreeMinutes(
                          Math.max(20, Number(e.target.value))
                        )
                      }
                      className="w-1/2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                      title="Minutos libres por día entre semana"
                    />
                    <input
                      type="number"
                      min={30}
                      max={240}
                      step={15}
                      value={weekendFreeMinutes}
                      onChange={(e) =>
                        setWeekendFreeMinutes(
                          Math.max(30, Number(e.target.value))
                        )
                      }
                      className="w-1/2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                      title="Minutos libres por día en fin de semana"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. CALENDARIO VISUAL SEMANAL Y PROYECCIÓN MENSUAL (4 SEMANAS) */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                    🗓️ 2. Tu Calendario Semanal Tipo (Repetido 4 Semanas = 100%
                    de las Habilidades en el Mes)
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Cada día combina tu bloque inamovible de Trabajo con 1 o 2
                    habilidades rotativas para desbloquear{" "}
                    <span className="font-semibold text-amber-300">
                      {fmt(calendarPlan.weeklyGpTarget)}/semana
                    </span>{" "}
                    ({fmt(vaultCap)} en el mes).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-7">
                {calendarPlan.days.map((d) => (
                  <div
                    key={d.key}
                    className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/75 p-2.5 text-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                        <span className="font-bold text-white">{d.label}</span>
                        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                          {d.totalDayMins}m libres
                        </span>
                      </div>

                      {/* Bloque Inamovible */}
                      <div
                        className={`mt-2 rounded-lg p-1.5 text-[10px] ${
                          d.isWorkDay
                            ? "border border-indigo-500/30 bg-indigo-950/40 text-indigo-200"
                            : "border border-slate-800 bg-slate-950/50 text-slate-400"
                        }`}
                      >
                        {d.immovableBlock}
                      </div>

                      {/* Ventana de Santuario */}
                      <p className="mt-2 text-[10px] font-semibold text-cyan-300">
                        ⚡ {d.freeWindowLabel}
                      </p>

                      <div className="mt-1 space-y-1">
                        {d.scheduled.map((item, i) => (
                          <div
                            key={i}
                            className="rounded-lg border border-emerald-500/30 bg-emerald-950/25 px-2 py-1 text-[11px] text-white"
                          >
                            <p className="font-semibold leading-tight">
                              {item.label}
                            </p>
                            <span className="text-[10px] text-emerald-300">
                              {item.minutes} min
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-2 border-t border-slate-800/80 pt-1.5 text-right text-[10px] font-bold text-amber-300">
                      +{d.gpUnlocked.toLocaleString("es-CO")} GP
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. RESUMEN MENSUAL Y SEMANAL POR HABILIDAD (AUTO-CALCULADO) */}
            <div className="space-y-2.5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-300">
                3. Habilidades Activas en el Mes (Metas Semanales y Mensuales
                Auto-Calculadas por el Calendario)
              </p>
              {SKILL_CATALOG.map((item) => {
                const selected = skills.find((s) => s.domain === item.domain);
                const weeklyMins = selected?.weekly_target_minutes || 0;
                const monthlyMins = weeklyMins * 4;
                return (
                  <div
                    key={item.domain}
                    className={`rounded-xl border p-3.5 transition ${
                      selected
                        ? "border-emerald-500/60 bg-emerald-950/20"
                        : "border-slate-800 bg-slate-950/50 opacity-70"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => toggleSkill(item.domain)}
                        className="flex items-center gap-3 text-left"
                      >
                        <CheckCircle2
                          className={`h-5 w-5 ${
                            selected ? "text-emerald-400" : "text-slate-600"
                          }`}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-white">
                              {item.label}
                            </p>
                            {item.domain === "work" && (
                              <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                                🔒 Motor Inamovible
                              </span>
                            )}
                            {item.tag && (
                              <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                                {item.tag}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400">{item.desc}</p>
                        </div>
                      </button>

                      {selected && (
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-1 text-right">
                            <span className="block text-[10px] text-slate-400">
                              Proyección Mensual (4 sem)
                            </span>
                            <span className="text-xs font-bold text-emerald-300">
                              {monthlyMins} min/mes (
                              {(monthlyMins / 60).toFixed(1)} h)
                            </span>
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400">
                              Semanal (min)
                            </label>
                            <input
                              type="number"
                              min={15}
                              step={15}
                              value={selected.weekly_target_minutes}
                              onChange={(e) =>
                                updateSkillConfig(item.domain, {
                                  weekly_target_minutes: Math.max(
                                    15,
                                    Number(e.target.value)
                                  ),
                                })
                              }
                              className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400">
                              Turno asignado
                            </label>
                            <select
                              value={selected.preferred_session_time || "noche"}
                              onChange={(e) =>
                                updateSkillConfig(item.domain, {
                                  preferred_session_time: e.target
                                    .value as PreferredSessionTime,
                                })
                              }
                              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white"
                            >
                              <option value="manana">Mañana</option>
                              <option value="tarde">Tarde</option>
                              <option value="noche">Noche</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* SECCIÓN ABIERTA PARA EXPRESAR UNA HABILIDAD PERSONALIZADA */}
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/15 p-4">
              <div className="flex items-center gap-2 text-cyan-300">
                <Lightbulb className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Sección Abierta · ¿Qué otra habilidad o hábito entrenas?
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Exprésala aquí: se activará hoy como misión personalizada en tu
                tablero y quedará registrada en nuestra base de datos para crear
                módulos dedicados en las próximas versiones.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-12">
                <div className="sm:col-span-4">
                  <label className="text-[11px] text-slate-300">
                    Nombre de tu Habilidad
                  </label>
                  <input
                    type="text"
                    value={customSkillName}
                    onChange={(e) => setCustomSkillName(e.target.value)}
                    placeholder="Ej. Tocar Piano, Ajedrez, Idiomas..."
                    className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div className="sm:col-span-6">
                  <label className="text-[11px] text-slate-300">
                    ¿Cómo mides tu avance en cada sesión?
                  </label>
                  <input
                    type="text"
                    value={customSkillIdea}
                    onChange={(e) => setCustomSkillIdea(e.target.value)}
                    placeholder="Ej. Partituras practicadas, partidas analizadas, lecciones..."
                    className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] text-slate-300">
                    Min / semana
                  </label>
                  <input
                    type="number"
                    min={15}
                    value={customSkillMinutes}
                    onChange={(e) =>
                      setCustomSkillMinutes(Math.max(15, Number(e.target.value)))
                    }
                    className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PASO 5: AGENTE IA PLANIFICADOR DE MISIONES Y TIENDA DE RECOMPENSAS */}
        {step === 5 && (
          <div className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-amber-400">
                <Target className="h-5 w-5" />
                <h2 className="text-lg font-bold text-white">
                  Paso 5 · Planificador IA de Misiones y Tienda de Recompensas
                </h2>
              </div>
              <button
                type="button"
                disabled={planningStep5}
                onClick={() => runStep5Planner(false)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/20 px-3.5 py-2 text-xs font-bold text-amber-200 ring-1 ring-amber-500/40 hover:bg-amber-500/30 disabled:opacity-50"
              >
                <Bot className="h-4 w-4" />
                {planningStep5
                  ? "Calibrando misiones y tienda..."
                  : "✨ Regenerar Plan con IA según mis Habilidades y Gastos"}
              </button>
            </div>

            {aiStrategyNote && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 text-xs text-emerald-200">
                🤖 <strong>Estrategia del Game Master:</strong> {aiStrategyNote}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Misión Principal (aparecerá en el banner superior)
                </label>
                <input
                  type="text"
                  value={mainGoal}
                  onChange={(e) => setMainGoal(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300">
                  Fecha Meta
                </label>
                <input
                  type="date"
                  value={goalDeadline}
                  onChange={(e) => setGoalDeadline(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white"
                />
              </div>
            </div>

            {/* MISIONES DIARIAS INICIALES (QUESTS) */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                  Misiones Iniciales Sugeridas para tus Habilidades (desbloquean
                  GP de tu Bóveda)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setQuests([
                      ...quests,
                      {
                        code: `QUEST_CUSTOM_${quests.length + 1}`,
                        title: "Nueva Misión Diaria",
                        domain: skills[0]?.domain || "general",
                        difficulty: "medium",
                        reward_gp: Math.max(100, Math.round(vaultCap / 25)),
                        reward_xp: 90,
                      },
                    ])
                  }
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-300"
                >
                  <Plus className="h-3.5 w-3.5" /> Añadir misión
                </button>
              </div>
              <div className="space-y-2">
                {quests.map((q, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-center"
                  >
                    <input
                      type="text"
                      value={q.title}
                      onChange={(e) => {
                        const next = [...quests];
                        next[idx] = { ...q, title: e.target.value };
                        setQuests(next);
                      }}
                      className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white sm:col-span-7"
                    />
                    <select
                      value={q.difficulty}
                      onChange={(e) => {
                        const next = [...quests];
                        next[idx] = {
                          ...q,
                          difficulty: e.target.value as
                            | "easy"
                            | "medium"
                            | "hard",
                        };
                        setQuests(next);
                      }}
                      className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-300 sm:col-span-2"
                    >
                      <option value="easy">Fácil</option>
                      <option value="medium">Media</option>
                      <option value="hard">Difícil</option>
                    </select>
                    <div className="flex items-center gap-1 sm:col-span-2">
                      <input
                        type="number"
                        min={1}
                        value={q.reward_gp}
                        onChange={(e) => {
                          const next = [...quests];
                          next[idx] = {
                            ...q,
                            reward_gp: Math.max(1, Number(e.target.value)),
                          };
                          setQuests(next);
                        }}
                        className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-emerald-300"
                      />
                      <span className="text-[10px] text-slate-400">GP</span>
                    </div>
                    <div className="flex justify-end sm:col-span-1">
                      <button
                        type="button"
                        onClick={() =>
                          setQuests(quests.filter((_, i) => i !== idx))
                        }
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* TIENDA DE RECOMPENSAS (WISHLIST) */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Tienda de Recompensas Inicial (calibrada a tu Bóveda de{" "}
                  {fmt(vaultCap)})
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setWishlist([
                      ...wishlist,
                      {
                        name: "",
                        cost_gp: Math.max(50, Math.round(vaultCap * 0.15)),
                        priority: wishlist.length + 1,
                      },
                    ])
                  }
                  className="inline-flex items-center gap-1 rounded-lg bg-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-300"
                >
                  <Plus className="h-3.5 w-3.5" /> Añadir recompensa
                </button>
              </div>
              <div className="space-y-2">
                {wishlist.map((w, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="rounded bg-slate-800 px-2 py-1 text-[10px] font-bold text-amber-300">
                      P{w.priority}
                    </span>
                    <input
                      type="text"
                      placeholder="Nombre del gusto o recompensa"
                      value={w.name}
                      onChange={(e) => {
                        const next = [...wishlist];
                        next[idx] = { ...w, name: e.target.value };
                        setWishlist(next);
                      }}
                      className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white"
                    />
                    <input
                      type="number"
                      min={1}
                      value={w.cost_gp}
                      onChange={(e) => {
                        const next = [...wishlist];
                        next[idx] = {
                          ...w,
                          cost_gp: Math.max(1, Number(e.target.value)),
                        };
                        setWishlist(next);
                      }}
                      className="w-36 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setWishlist(wishlist.filter((_, i) => i !== idx))
                      }
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* NAVEGACIÓN INFERIOR */}
        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            disabled={step === 1 || submitting}
            onClick={() =>
              setStep((s) => Math.max(1, s - 1) as 1 | 2 | 3 | 4 | 5)
            }
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" /> Anterior
          </button>

          {step < 5 ? (
            <button
              type="button"
              onClick={() =>
                setStep((s) => Math.min(5, s + 1) as 1 | 2 | 3 | 4 | 5)
              }
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-500"
            >
              Siguiente <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={finishOnboarding}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-950 hover:bg-emerald-500 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {submitting
                ? "Construyendo tu mundo RPG..."
                : "Finalizar y Entrar al Dashboard"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
