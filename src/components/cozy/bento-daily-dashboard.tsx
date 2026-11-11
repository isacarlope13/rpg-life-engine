"use client";

import React, { useState, useEffect } from "react";
import {
  Maximize2,
  Compass,
  CheckCircle2,
  Sparkles,
  BookOpen,
  ArrowRight,
  Clock,
  Award,
  Zap,
  Image as ImageIcon,
  Flame,
  ChevronRight,
  TrendingUp,
  LayoutGrid,
  Check,
  Calendar,
  Layers,
  Heart,
} from "lucide-react";
import type {
  ReadingBook,
  KnittingProject,
  RubikCubeCatalogItem,
  SkillSessionRecord,
  Quest,
  SkillDomainSummary,
} from "@/types/rpg";
import {
  COZY_VILLAGE_RESIDENTS,
  type VillageResident,
  calculateBuildingTier,
} from "@/lib/sanctuary/village-tiers";
import {
  CozyButton,
  CozyCard,
  CozyProgress,
  CozyEmptyState,
} from "@/components/cozy/ui";
import { triggerHaptic } from "@/lib/offline-sync";

export type BentoLayoutOrder = "balanced" | "quests_first" | "sanctuary_first";

interface BentoDailyDashboardProps {
  playerLevel: number;
  currentXp: number;
  streakDays: number;
  walletGp: number;
  vaultGp: number;
  recentSessions: SkillSessionRecord[];
  quests: Quest[];
  readingBooks: ReadingBook[];
  knittingProjects: KnittingProject[];
  rubikCubes: RubikCubeCatalogItem[];
  residents?: VillageResident[];
  skillSummaries?: SkillDomainSummary[];
  currentDate?: string;
  quickNote: string;
  notesList: string[];
  onQuickNoteChange: (val: string) => void;
  onAddNote: (e: React.FormEvent) => void;
  onDeleteNote: (idx: number) => void;
  onSwitchToVillageMap: () => void;
  onOpenBuilding: (buildingId: string) => void;
  onSelectResident: (resident: VillageResident) => void;
  onOpenQuestsModal?: () => void;
  onOpenScrapbook?: () => void;
  onOpenQuickCapture?: () => void;
  onSubmitSkillSession?: (payload: Record<string, unknown>) => Promise<boolean>;
}

export function BentoDailyDashboard({
  playerLevel,
  currentXp,
  streakDays,
  walletGp,
  vaultGp,
  recentSessions,
  quests,
  readingBooks,
  knittingProjects,
  rubikCubes,
  residents = COZY_VILLAGE_RESIDENTS,
  skillSummaries = [],
  currentDate,
  quickNote,
  notesList,
  onQuickNoteChange,
  onAddNote,
  onDeleteNote,
  onSwitchToVillageMap,
  onOpenBuilding,
  onSelectResident,
  onOpenQuestsModal,
  onOpenScrapbook,
  onOpenQuickCapture,
  onSubmitSkillSession,
}: BentoDailyDashboardProps) {
  // Personalización del orden de tarjetas con persistencia local
  const [layoutOrder, setLayoutOrder] = useState<BentoLayoutOrder>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("oakhaven_bento_layout") as BentoLayoutOrder | null;
      if (saved && ["balanced", "quests_first", "sanctuary_first"].includes(saved)) {
        return saved;
      }
    }
    return "balanced";
  });

  const handleLayoutChange = (order: BentoLayoutOrder) => {
    setLayoutOrder(order);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("oakhaven_bento_layout", order);
      } catch {}
    }
    triggerHaptic("light");
  };

  // Cálculo de micro-misión del día
  const dayIndex = new Date().getDay();
  const featuredResident = residents[dayIndex % (residents.length || 1)] || residents[0];
  const [isFeaturedCompleted, setIsFeaturedCompleted] = useState(false);
  const [isSubmittingFeatured, setIsSubmittingFeatured] = useState(false);

  const handleCompleteFeaturedQuest = async () => {
    if (!featuredResident?.microQuest || !onSubmitSkillSession || isFeaturedCompleted || isSubmittingFeatured) return;
    setIsSubmittingFeatured(true);
    triggerHaptic("light");
    try {
      const today = new Date().toISOString().slice(0, 10);
      const idempotencyKey = `bento_micro_${featuredResident.id}_${today}_${Date.now()}`;
      const success = await onSubmitSkillSession({
        domain: featuredResident.domain,
        duration_minutes: featuredResident.microQuest.estimatedMinutes,
        title: `[Micro-Misión Destacada] ${featuredResident.microQuest.title}`,
        notes: `${featuredResident.microQuest.description} • Guía: ${featuredResident.name} (${featuredResident.species})`,
        idempotency_key: idempotencyKey,
      });
      if (success) {
        setIsFeaturedCompleted(true);
        triggerHaptic("success");
      }
    } catch (err) {
      console.error("[BentoDashboard] Error al completar micro-misión:", err);
    } finally {
      setIsSubmittingFeatured(false);
    }
  };

  // Última actividad reciente para el botón "Continuar actividad"
  const lastSession = recentSessions[0];
  const getDomainBuildingId = (domain?: string): string => {
    switch (domain) {
      case "knitting": return "atelier";
      case "reading": return "libreria";
      case "study": return "biblioteca";
      case "rubik": return "club_puzzles";
      case "general": return "observatorio";
      case "gardening": return "pabellon_gardening";
      case "hiking": return "pabellon_hiking";
      case "cooking": return "cocina";
      default: return "libreria";
    }
  };

  // Resumen de edificios con progreso visual (Tier 2 o Tier 3)
  const tierAdvancements = [
    { id: "atelier", name: "El Atelier", domain: "knitting", icon: "🧶" },
    { id: "libreria", name: "La Librería", domain: "reading", icon: "📚" },
    { id: "biblioteca", name: "La Biblioteca", domain: "study", icon: "🏛️" },
    { id: "club_puzzles", name: "Club WCA", domain: "rubik", icon: "🧩" },
    { id: "observatorio", name: "Observatorio", domain: "general", icon: "🔭" },
  ].map((b) => {
    const sum = skillSummaries.find((s) => s.domain === b.domain);
    const count = sum?.sessions_count || recentSessions.filter((s) => s.domain === b.domain).length;
    const tier = calculateBuildingTier({
      level: sum?.level || 1,
      sessionsCount: count,
      completedProjectsCount: b.domain === "knitting" ? knittingProjects.length : b.domain === "reading" ? readingBooks.length : 0,
    });
    return { ...b, tier, count };
  });

  const totalFinishedQuests = quests.filter((q) => q.status === "completed").length;
  const questsCompletionPct = quests.length > 0 ? Math.round((totalFinishedQuests / quests.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* =========================================================================
          1. HEADER ILUSTRADO PANORÁMICO — PIXEL ART COZY VALLEY & BIENVENIDA
         ========================================================================= */}
      <section className="relative overflow-hidden rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] shadow-[0_6px_0_#3A2E2B]">
        {/* Ilustración de fondo pixel art con colinas y cielo cálido */}
        <div className="relative h-44 sm:h-52 w-full overflow-hidden bg-gradient-to-b from-[#A9C7C7] via-[#E7D69C]/60 to-[#F4EEDC] p-4 sm:p-6 flex flex-col justify-between select-none">
          {/* Silueta de colinas y árboles de Oakhaven en SVG/Pixel Art */}
          <div className="absolute inset-0 pointer-events-none opacity-40">
            <svg
              className="absolute bottom-0 w-full h-28 text-[#77936A]"
              preserveAspectRatio="none"
              viewBox="0 0 1200 120"
              fill="currentColor"
            >
              <path d="M0,40 C150,90 350,10 500,60 C650,110 900,20 1200,50 L1200,120 L0,120 Z" />
            </svg>
            <svg
              className="absolute -bottom-2 w-full h-20 text-[#314C3C]"
              preserveAspectRatio="none"
              viewBox="0 0 1200 120"
              fill="currentColor"
            >
              <path d="M0,60 C200,20 400,80 600,40 C800,90 1000,30 1200,70 L1200,120 L0,120 Z" />
            </svg>
            {/* Elementos pixel decorativos flotantes */}
            <div className="absolute top-4 left-10 text-3xl opacity-75">☀️</div>
            <div className="absolute top-8 left-1/4 text-2xl opacity-60">☁️</div>
            <div className="absolute top-5 right-24 text-3xl opacity-75">☁️</div>
            <div className="absolute bottom-6 left-16 text-2xl">🏡</div>
            <div className="absolute bottom-8 left-1/3 text-2xl">🌲</div>
            <div className="absolute bottom-7 right-1/4 text-2xl">🌲</div>
            <div className="absolute bottom-6 right-16 text-2xl">🏰</div>
          </div>

          {/* Barra superior del Hero */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border-2 border-[#3A2E2B] bg-[#FFFDF8]/90 px-3.5 py-1 text-xs font-black text-[#3A2E2B] shadow-sm backdrop-blur-sm">
              <Calendar className="h-3.5 w-3.5 text-[#314C3C]" />
              <span className="capitalize">{currentDate || "Hoy en Oakhaven"}</span>
            </div>

            {/* Selector de orden del Bento */}
            <div className="flex items-center gap-1 rounded-2xl border-2 border-[#3A2E2B] bg-[#FFFDF8]/90 p-1 text-[11px] font-black text-[#3A2E2B] shadow-sm backdrop-blur-sm">
              <button
                type="button"
                onClick={() => handleLayoutChange("balanced")}
                className={`rounded-xl px-2.5 py-1 transition cursor-pointer ${
                  layoutOrder === "balanced"
                    ? "bg-[#314C3C] text-white shadow-sm"
                    : "hover:bg-[#E8DFCF]"
                }`}
                title="Diseño Equilibrado"
              >
                Equilibrado
              </button>
              <button
                type="button"
                onClick={() => handleLayoutChange("quests_first")}
                className={`rounded-xl px-2.5 py-1 transition cursor-pointer ${
                  layoutOrder === "quests_first"
                    ? "bg-[#314C3C] text-white shadow-sm"
                    : "hover:bg-[#E8DFCF]"
                }`}
                title="Misiones primero"
              >
                Misiones
              </button>
              <button
                type="button"
                onClick={() => handleLayoutChange("sanctuary_first")}
                className={`rounded-xl px-2.5 py-1 transition cursor-pointer ${
                  layoutOrder === "sanctuary_first"
                    ? "bg-[#314C3C] text-white shadow-sm"
                    : "hover:bg-[#E8DFCF]"
                }`}
                title="Santuario primero"
              >
                Santuario
              </button>
            </div>
          </div>

          {/* Saludo y Acceso Prominente a Captura Rápida */}
          <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-xl">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-[#3A2E2B] tracking-tight drop-shadow-sm">
                ¡Bienvenido a Valle de Oakhaven!
              </h2>
              <p className="mt-1 text-xs sm:text-sm font-semibold text-[#5C4033] drop-shadow-sm">
                Tu refugio personal donde cada hábito real nutre y expande un pueblo sereno.
              </p>
            </div>

            {onOpenQuickCapture && (
              <CozyButton
                variant="clay"
                size="md"
                onClick={onOpenQuickCapture}
                icon={<Zap className="h-4 w-4 fill-current text-amber-200" />}
                className="shadow-[0_4px_0_#241C1A]"
              >
                ⚡ Captura Rápida
              </CozyButton>
            )}
          </div>
        </div>
      </section>

      {/* =========================================================================
          2. TARJETA DESTACADA: MICRO-MISIÓN DEL DÍA (12 COLS)
         ========================================================================= */}
      {featuredResident && (
        <section className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] transition-transform hover:-translate-y-0.5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#3A2E2B]/10 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-[#3A2E2B] bg-[#E7D69C] shadow-[0_2px_0_#3A2E2B] text-xl select-none">
                ✨
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-[#3A2E2B] uppercase tracking-wide">
                    Micro-Misión Destacada de Oakhaven
                  </h3>
                  <span className="rounded-full border border-[#77936A] bg-[#77936A]/20 px-2.5 py-0.5 text-[10px] font-black text-[#314C3C]">
                    Paso Guiado de Hoy
                  </span>
                </div>
                <span className="text-[11px] font-bold text-[#795548]">
                  Sugerencia de {featuredResident.name} ({featuredResident.species})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onOpenQuestsModal && (
                <CozyButton
                  variant="wood"
                  size="sm"
                  onClick={onOpenQuestsModal}
                  icon={<BookOpen className="h-3.5 w-3.5" />}
                >
                  Ver Diario Completo ({residents.length})
                </CozyButton>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-col md:flex-row items-center justify-between gap-4 rounded-2xl border-3 border-[#3A2E2B] bg-[#F7F4EB] p-4 shadow-[0_2px_0_#3A2E2B]">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div
                onClick={() => onSelectResident(featuredResident)}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-[#3A2E2B] bg-[#FFFDF8] text-3xl shadow-sm hover:scale-105 transition cursor-pointer select-none"
                title={`Hablar con ${featuredResident.name}`}
              >
                {featuredResident.avatar}
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-[#3A2E2B]">
                    {featuredResident.microQuest.title}
                  </h4>
                  <span className="rounded-md border border-[#3A2E2B]/20 bg-[#FFFDF8] px-2 py-0.5 font-mono text-[10px] font-bold text-[#795548]">
                    ⏱️ ~{featuredResident.microQuest.estimatedMinutes}m
                  </span>
                </div>
                <p className="text-xs text-[#5C4033] line-clamp-2">
                  {featuredResident.microQuest.description}
                </p>
                <p className="text-[11px] italic text-[#795548] pt-0.5">
                  &ldquo;{featuredResident.greetingQuote}&rdquo;
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end shrink-0">
              <CozyButton
                variant="sage"
                size="sm"
                onClick={() => onOpenBuilding(featuredResident.buildingId)}
              >
                Ir al Edificio
              </CozyButton>

              <CozyButton
                variant={isFeaturedCompleted ? "sage" : "forest"}
                size="sm"
                disabled={isFeaturedCompleted || isSubmittingFeatured}
                onClick={handleCompleteFeaturedQuest}
                icon={isFeaturedCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              >
                {isFeaturedCompleted ? "Completada Hoy ✓" : isSubmittingFeatured ? "Guardando..." : "Registrar Avance"}
              </CozyButton>
            </div>
          </div>
        </section>
      )}

      {/* =========================================================================
          GRID BENTO MODULAR ADAPTATIVO
         ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">

        {/* =======================================================================
            SECCIÓN A: RESUMEN DEL REINO (7 COLS)
           ======================================================================= */}
        <div className="lg:col-span-7 rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] flex flex-col justify-between hover:-translate-y-0.5 transition-transform">
          <div>
            <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/10 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#E7D69C] shadow-[0_2px_0_#3A2E2B] text-lg select-none">
                  ⭐
                </span>
                <div>
                  <h3 className="text-sm font-black text-[#3A2E2B] uppercase tracking-wide">
                    Resumen de Progreso y Reino
                  </h3>
                  <span className="text-[11px] font-bold text-[#795548]">
                    Nivel {playerLevel} • {currentXp.toLocaleString("es-CO")} XP acumulados
                  </span>
                </div>
              </div>

              <span className="rounded-full border-2 border-[#4E6E58] bg-[#4E6E58]/15 px-3 py-1 text-xs font-black text-[#4E6E58]">
                🔥 {streakDays} Días Racha
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-2xl border-2 border-[#3A2E2B] bg-[#F7F4EB] p-3.5 shadow-sm">
                <span className="text-[10px] font-bold text-[#795548] uppercase">Billetera Activa</span>
                <p className="mt-1 font-mono text-lg font-black text-[#3A2E2B]">
                  {walletGp.toLocaleString("es-CO")} <span className="text-xs">GP</span>
                </p>
                <span className="text-[10px] text-[#4E6E58] font-semibold">Disponible para canjes</span>
              </div>
              <div className="rounded-2xl border-2 border-[#3A2E2B] bg-[#F7F4EB] p-3.5 shadow-sm">
                <span className="text-[10px] font-bold text-[#795548] uppercase">Bóveda de Reserva</span>
                <p className="mt-1 font-mono text-lg font-black text-[#4E6E58]">
                  {vaultGp.toLocaleString("es-CO")} <span className="text-xs">GP</span>
                </p>
                <span className="text-[10px] text-[#795548] font-semibold">Fondo seguro protegido</span>
              </div>
            </div>

            {/* Métrica de balance de esfuerzo */}
            <div className="mt-3 rounded-2xl border-2 border-[#3A2E2B]/20 bg-[#F4EEDC]/60 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-[#3A2E2B]">
                <TrendingUp className="h-4 w-4 text-[#77936A]" />
                <span>Multiplicador de Gracia Activo</span>
              </div>
              <span className="font-mono text-xs font-black text-[#314C3C]">
                {streakDays >= 7 ? "x1.5 (Maestro)" : "x1.0 (Sereno)"}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t-2 border-[#3A2E2B]/10 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-bold text-[#795548]">
              {recentSessions.length} actividades reales forjadas
            </span>
            <button
              type="button"
              onClick={onSwitchToVillageMap}
              className="text-xs font-black text-[#4E6E58] hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>Explorar Pueblo y Edificios</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* =======================================================================
            SECCIÓN B: PUEBLO VIVO & VISTA PREVIA (5 COLS)
           ======================================================================= */}
        <div className="lg:col-span-5 rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] flex flex-col justify-between hover:-translate-y-0.5 transition-transform">
          <div>
            <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#4E6E58] text-[#FFFDF8] shadow-[0_2px_0_#3A2E2B] text-lg select-none">
                  🗺️
                </span>
                <div>
                  <h3 className="text-sm font-black text-[#3A2E2B] uppercase tracking-wide">
                    Pueblo de Oakhaven
                  </h3>
                  <span className="text-[11px] font-bold text-[#795548]">
                    8 Edificios Especializados
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onSwitchToVillageMap}
                className="rounded-xl border-2 border-[#3A2E2B] bg-[#E8DFCF] p-1.5 text-[#3A2E2B] hover:bg-[#E7D69C] shadow-[0_2px_0_#3A2E2B] transition cursor-pointer"
                title="Abrir mapa del pueblo"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>

            {/* Fachadas recientes & Tiers */}
            <div className="mt-3.5 space-y-2">
              <span className="text-[10px] font-black uppercase text-[#795548] block">
                Evolución de Fachadas & Tiers:
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {tierAdvancements.slice(0, 4).map((b) => (
                  <div
                    key={b.id}
                    onClick={() => onOpenBuilding(b.id)}
                    className="flex items-center justify-between rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] p-2 hover:bg-[#FFFDF8] transition cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5 font-bold text-[#3A2E2B] truncate">
                      <span>{b.icon}</span> {b.name}
                    </span>
                    <span className="rounded-md border border-[#3A2E2B]/30 bg-[#FFFDF8] px-1.5 py-0.5 text-[9px] font-black shrink-0">
                      {b.tier.badge}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t-2 border-[#3A2E2B]/10 flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#795548]">
              Coordenadas: 42°N, 71°O
            </span>
            <CozyButton
              variant="forest"
              size="sm"
              onClick={onSwitchToVillageMap}
              icon={<Compass className="h-3.5 w-3.5" />}
            >
              Entrar al Pueblo
            </CozyButton>
          </div>
        </div>

        {/* =======================================================================
            SECCIÓN C: MISIONES DIARIAS & TAREAS PENDIENTES (7 COLS)
           ======================================================================= */}
        <div
          className={`lg:col-span-7 rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] flex flex-col justify-between hover:-translate-y-0.5 transition-transform ${
            layoutOrder === "quests_first" ? "order-first" : ""
          }`}
        >
          <div>
            <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#E76F51] text-white shadow-[0_2px_0_#3A2E2B] text-lg select-none">
                  📜
                </span>
                <div>
                  <h3 className="text-sm font-black text-[#3A2E2B] uppercase tracking-wide">
                    Misiones & Tareas Diarias
                  </h3>
                  <span className="text-[11px] font-bold text-[#795548]">
                    Hábitos verificados y recompensas canónicas
                  </span>
                </div>
              </div>

              <span className="rounded-full bg-[#E7D69C] border-2 border-[#3A2E2B] px-3 py-0.5 text-xs font-black text-[#3A2E2B]">
                {totalFinishedQuests} / {quests.length} Listas ({questsCompletionPct}%)
              </span>
            </div>

            {/* Barra de progreso de misiones */}
            <div className="mt-3">
              <CozyProgress
                value={questsCompletionPct}
                variant="forest"
                size="sm"
                showPercentage={false}
              />
            </div>

            {/* Lista de tareas */}
            <div className="mt-3.5 space-y-2">
              {quests.length === 0 ? (
                <CozyEmptyState
                  title="¡Día Despejado!"
                  description="No tienes tareas pendientes asignadas para hoy. Puedes forjar una nueva o descansar."
                  icon="🌿"
                />
              ) : (
                quests.slice(0, 4).map((quest) => (
                  <div
                    key={quest.id}
                    className={`rounded-2xl border-3 border-[#3A2E2B] p-3 shadow-[0_2px_0_#3A2E2B] flex items-center justify-between gap-3 ${
                      quest.status === "completed"
                        ? "bg-[#EAF3ED] opacity-80"
                        : "bg-[#F7F4EB]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xl select-none">
                        {quest.status === "completed" ? "✅" : "⚔️"}
                      </span>
                      <div className="min-w-0">
                        <h4
                          className={`text-xs font-black text-[#3A2E2B] truncate ${
                            quest.status === "completed" ? "line-through text-[#795548]" : ""
                          }`}
                        >
                          {quest.title}
                        </h4>
                        <span className="text-[10px] font-bold text-[#795548]">
                          +{quest.reward_gp.toLocaleString("es-CO")} GP • {quest.domain}
                        </span>
                      </div>
                    </div>

                    <span className="rounded-lg bg-[#E8DFCF] px-2.5 py-1 font-mono text-[10px] font-bold text-[#3A2E2B] shrink-0">
                      {quest.status === "completed" ? "Completada ✓" : "En curso"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t-2 border-[#3A2E2B]/10 text-xs font-bold text-[#795548] flex justify-between">
            <span>Recompensas deterministas de la Bóveda</span>
            <span className="text-[#4E6E58]">Buff de Gracia Activo</span>
          </div>
        </div>

        {/* =======================================================================
            SECCIÓN D: SANTUARIO & CONTINUAR ÚLTIMA ACTIVIDAD (5 COLS)
           ======================================================================= */}
        <div
          className={`lg:col-span-5 rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] flex flex-col justify-between hover:-translate-y-0.5 transition-transform ${
            layoutOrder === "sanctuary_first" ? "order-first" : ""
          }`}
        >
          <div>
            <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#77936A] text-white shadow-[0_2px_0_#3A2E2B] text-lg select-none">
                  🏛️
                </span>
                <div>
                  <h3 className="text-sm font-black text-[#3A2E2B] uppercase tracking-wide">
                    Santuario de Habilidades
                  </h3>
                  <span className="text-[11px] font-bold text-[#795548]">
                    Sesiones conscientes y foco profundo
                  </span>
                </div>
              </div>
            </div>

            {/* BOTÓN PROMINENTE: CONTINUAR ÚLTIMA ACTIVIDAD */}
            {lastSession ? (
              <div className="mt-3.5 rounded-2xl border-3 border-[#3A2E2B] bg-[#EAF3ED] p-3.5 shadow-[0_2px_0_#3A2E2B] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-[#314C3C] flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Continuar Última Actividad
                  </span>
                  <span className="rounded-md border border-[#77936A] bg-[#FFFDF8] px-1.5 py-0.5 text-[9px] font-black text-[#314C3C]">
                    {lastSession.domain}
                  </span>
                </div>
                <p className="text-xs font-black text-[#3A2E2B] truncate">
                  {lastSession.details || `Sesión de ${lastSession.domain}`}
                </p>
                <div className="pt-1 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[#795548]">
                    +{lastSession.duration_minutes || 15}m registrados
                  </span>
                  <CozyButton
                    variant="forest"
                    size="sm"
                    onClick={() => onOpenBuilding(getDomainBuildingId(lastSession.domain))}
                    icon={<ArrowRight className="h-3.5 w-3.5" />}
                  >
                    Reanudar
                  </CozyButton>
                </div>
              </div>
            ) : (
              <div className="mt-3.5 rounded-2xl border-2 border-[#3A2E2B]/20 bg-[#F4EEDC]/40 p-3 text-center text-xs text-[#795548]">
                🌱 No hay sesiones recientes hoy. ¡Inicia una actividad serena!
              </div>
            )}

            {/* Accesos rápidos a edificios del Santuario */}
            <div className="mt-3.5 grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => onOpenBuilding("atelier")}
                className="flex items-center gap-2 rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] p-2 font-bold text-[#3A2E2B] hover:bg-[#FFFDF8] transition cursor-pointer"
              >
                <span className="text-base select-none">🧶</span>
                <span className="truncate">Atelier Tejido</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenBuilding("libreria")}
                className="flex items-center gap-2 rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] p-2 font-bold text-[#3A2E2B] hover:bg-[#FFFDF8] transition cursor-pointer"
              >
                <span className="text-base select-none">📚</span>
                <span className="truncate">Librería Archivo</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenBuilding("club_puzzles")}
                className="flex items-center gap-2 rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] p-2 font-bold text-[#3A2E2B] hover:bg-[#FFFDF8] transition cursor-pointer"
              >
                <span className="text-base select-none">🧩</span>
                <span className="truncate">Club Puzzles</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenBuilding("observatorio")}
                className="flex items-center gap-2 rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] p-2 font-bold text-[#3A2E2B] hover:bg-[#FFFDF8] transition cursor-pointer"
              >
                <span className="text-base select-none">🔭</span>
                <span className="truncate">Observatorio</span>
              </button>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t-2 border-[#3A2E2B]/10 text-xs font-bold text-[#795548] flex justify-between">
            <span>Cero culpa • Progreso orgánico</span>
          </div>
        </div>

        {/* =======================================================================
            SECCIÓN E: COLECCIONES REALES DEL SANTUARIO (6 COLS)
           ======================================================================= */}
        <div className="lg:col-span-6 rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] flex flex-col justify-between hover:-translate-y-0.5 transition-transform">
          <div>
            <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#E7D69C] text-[#3A2E2B] shadow-[0_2px_0_#3A2E2B] text-lg select-none">
                  🏺
                </span>
                <div>
                  <h3 className="text-sm font-black text-[#3A2E2B] uppercase tracking-wide">
                    Colecciones del Santuario
                  </h3>
                  <span className="text-[11px] font-bold text-[#795548]">
                    Catálogos de recursos reales y creaciones
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3.5 grid grid-cols-2 gap-3">
              {/* Libros */}
              <div
                onClick={() => onOpenBuilding("libreria")}
                className="rounded-2xl border-3 border-[#3A2E2B] bg-[#F7F4EB] p-3 shadow-[0_2px_0_#3A2E2B] hover:-translate-y-0.5 transition cursor-pointer"
              >
                <span className="text-2xl select-none">📚</span>
                <h4 className="mt-1 text-xs font-black text-[#3A2E2B]">La Librería</h4>
                <span className="font-mono text-xs font-bold text-[#4E6E58]">
                  {readingBooks.length} Libros catalogados
                </span>
              </div>

              {/* Tejido */}
              <div
                onClick={() => onOpenBuilding("atelier")}
                className="rounded-2xl border-3 border-[#3A2E2B] bg-[#F7F4EB] p-3 shadow-[0_2px_0_#3A2E2B] hover:-translate-y-0.5 transition cursor-pointer"
              >
                <span className="text-2xl select-none">🧶</span>
                <h4 className="mt-1 text-xs font-black text-[#3A2E2B]">El Atelier</h4>
                <span className="font-mono text-xs font-bold text-[#E76F51]">
                  {knittingProjects.length} Proyectos en telar
                </span>
              </div>

              {/* Speedcubing */}
              <div
                onClick={() => onOpenBuilding("club_puzzles")}
                className="rounded-2xl border-3 border-[#3A2E2B] bg-[#F7F4EB] p-3 shadow-[0_2px_0_#3A2E2B] hover:-translate-y-0.5 transition cursor-pointer"
              >
                <span className="text-2xl select-none">🧩</span>
                <h4 className="mt-1 text-xs font-black text-[#3A2E2B]">Arsenal WCA</h4>
                <span className="font-mono text-xs font-bold text-[#06B6D4]">
                  {rubikCubes.length || 1} Cubos de velocidad
                </span>
              </div>

              {/* Cocina & Recetario */}
              <div
                onClick={() => onOpenBuilding("cocina")}
                className="rounded-2xl border-3 border-[#3A2E2B] bg-[#F7F4EB] p-3 shadow-[0_2px_0_#3A2E2B] hover:-translate-y-0.5 transition cursor-pointer"
              >
                <span className="text-2xl select-none">🍳</span>
                <h4 className="mt-1 text-xs font-black text-[#3A2E2B]">Cocina & Fogones</h4>
                <span className="font-mono text-xs font-bold text-[#C88973]">
                  Nutrición y elixires
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t-2 border-[#3A2E2B]/10 text-xs font-bold text-[#795548] flex justify-between">
            <span>Haz clic en una colección para inspeccionar su edificio</span>
          </div>
        </div>

        {/* =======================================================================
            SECCIÓN F: ACTIVIDAD RECIENTE, LOGROS & ÁLBUM (6 COLS)
           ======================================================================= */}
        <div className="lg:col-span-6 rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] flex flex-col justify-between hover:-translate-y-0.5 transition-transform">
          <div>
            <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#A9C7C7] text-[#3A2E2B] shadow-[0_2px_0_#3A2E2B] text-lg select-none">
                  📷
                </span>
                <div>
                  <h3 className="text-sm font-black text-[#3A2E2B] uppercase tracking-wide">
                    Actividad Reciente & Recuerdos
                  </h3>
                  <span className="text-[11px] font-bold text-[#795548]">
                    Bitácora histórica y postales de Oakhaven
                  </span>
                </div>
              </div>

              {onOpenScrapbook && (
                <CozyButton
                  variant="lake"
                  size="sm"
                  onClick={onOpenScrapbook}
                  icon={<ImageIcon className="h-3.5 w-3.5" />}
                >
                  Ver Álbum
                </CozyButton>
              )}
            </div>

            {/* Historial cronológico breve */}
            <div className="mt-3.5 space-y-2">
              {recentSessions.length === 0 ? (
                <p className="text-xs text-[#795548] py-4 text-center">
                  Aún no hay registros de actividad hoy. ¡Tus pasos quedarán guardados aquí!
                </p>
              ) : (
                recentSessions.slice(0, 3).map((session, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] p-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-base select-none">
                        {session.domain === "knitting"
                          ? "🧶"
                          : session.domain === "reading"
                          ? "📚"
                          : session.domain === "rubik"
                          ? "🧩"
                          : session.domain === "study"
                          ? "🏛️"
                          : session.domain === "cooking"
                          ? "🍳"
                          : "🌱"}
                      </span>
                      <div className="truncate">
                        <span className="font-black text-[#3A2E2B] block truncate">
                          {session.details || `Sesión en ${session.domain}`}
                        </span>
                        <span className="text-[10px] text-[#795548]">
                          {session.duration_minutes ? `${session.duration_minutes}m foco` : "Registrado"}
                        </span>
                      </div>
                    </div>

                    <span className="rounded-md border border-[#3A2E2B]/20 bg-[#FFFDF8] px-2 py-0.5 font-mono text-[10px] font-black text-[#314C3C] shrink-0">
                      +{session.gp_earned || 25} GP
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t-2 border-[#3A2E2B]/10 text-xs font-bold text-[#795548] flex justify-between">
            <span>Postales y recuerdos inmortalizados en tu álbum</span>
          </div>
        </div>

        {/* =======================================================================
            SECCIÓN G: COMPAÑEROS & CENSO DE RESIDENTES (12 COLS)
           ======================================================================= */}
        <div className="lg:col-span-12 rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] hover:-translate-y-0.5 transition-transform">
          <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/10 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#E7D69C] shadow-[0_2px_0_#3A2E2B] text-lg select-none">
                👥
              </span>
              <div>
                <h3 className="text-sm font-black text-[#3A2E2B] uppercase tracking-wide">
                  Compañeros del Pueblo (Residentes Asistentes)
                </h3>
                <span className="text-[11px] font-bold text-[#795548]">
                  Te recuerdan tu última sesión real y preparan tus herramientas
                </span>
              </div>
            </div>

            <span className="rounded-full border-2 border-[#3A2E2B] bg-[#E8DFCF] px-3 py-1 text-xs font-black text-[#3A2E2B]">
              {residents.length} Asistentes Activos
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {residents.map((resident) => (
              <div
                key={resident.id}
                onClick={() => onSelectResident(resident)}
                className="group rounded-2xl border-3 border-[#3A2E2B] bg-[#F7F4EB] p-3 shadow-[0_2px_0_#3A2E2B] text-center hover:-translate-y-1 hover:shadow-[0_4px_0_#3A2E2B] transition-all cursor-pointer"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#3A2E2B] bg-[#FFFDF8] text-2xl group-hover:scale-110 transition-transform select-none">
                  {resident.avatar}
                </div>
                <h4 className="mt-1.5 text-xs font-black text-[#3A2E2B] truncate">
                  {resident.name}
                </h4>
                <span className="block text-[9px] font-bold text-[#795548] truncate">
                  {resident.title}
                </span>
                <p className="mt-1 text-[9px] italic text-[#5C4033] line-clamp-1">
                  &ldquo;{resident.greetingQuote}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* =======================================================================
            SECCIÓN H: BITÁCORA DE NOTAS RÁPIDAS (12 COLS)
           ======================================================================= */}
        <div className="lg:col-span-12 rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B]">
          <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl select-none">✍️</span>
              <div>
                <h3 className="text-sm font-black text-[#3A2E2B] uppercase tracking-wide">
                  Bitácora & Recordatorios de Oakhaven
                </h3>
                <span className="text-[11px] font-bold text-[#795548]">
                  Anotaciones rápidas guardadas localmente
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={onAddNote} className="mt-3 flex gap-2">
            <input
              type="text"
              value={quickNote}
              onChange={(e) => onQuickNoteChange(e.target.value)}
              placeholder="Anota una idea, pendiente o recordatorio rápido..."
              className="flex-1 rounded-2xl border-2 border-[#3A2E2B] bg-[#F7F4EB] px-4 py-2.5 text-xs text-[#3A2E2B] focus:outline-none focus:border-[#4E6E58] shadow-sm"
            />
            <CozyButton
              type="submit"
              variant="forest"
              size="sm"
            >
              Anotar
            </CozyButton>
          </form>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {notesList.map((note, idx) => (
              <div
                key={idx}
                className="rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] p-2.5 text-xs text-[#3A2E2B] flex items-center justify-between gap-2 shadow-sm"
              >
                <span className="line-clamp-2">📌 {note}</span>
                <button
                  type="button"
                  onClick={() => onDeleteNote(idx)}
                  className="text-[10px] text-[#795548] hover:text-red-700 font-black shrink-0 cursor-pointer"
                  title="Eliminar nota"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
