"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Home,
  LayoutGrid,
  Scroll,
  Archive,
  Users,
  Image as ImageIcon,
  Palette,
  FileText,
  Sun,
  CloudSun,
  CloudRain,
  MapPin,
  Sparkles,
  CheckCircle2,
  Fish,
  Bug,
  Compass,
  Hammer,
  Pickaxe,
  Heart,
  Copy,
  Check,
  ChevronRight,
  Maximize2,
  X,
  Volume2,
  TreePine,
  Coffee,
  Coins,
  Shield,
  Apple,
  RotateCcw,
  Play,
  Zap,
  Target,
  ArrowRight,
  SlidersHorizontal,
} from "lucide-react";
import type {
  SkillDomain,
  ReadingBook,
  KnittingProject,
  RubikCubeCatalogItem,
  RubikStats,
  SkillSessionRecord,
  Quest,
  SkillDomainSummary,
} from "@/types/rpg";
import { CozyVillageMap } from "@/components/sanctuary/cozy-village-map";
import { AtelierBuilding } from "@/components/sanctuary/atelier-building";
import { LibreriaBuilding } from "@/components/sanctuary/libreria-building";
import { BibliotecaBuilding } from "@/components/sanctuary/biblioteca-building";
import { ClubPuzzlesBuilding } from "@/components/sanctuary/club-puzzles-building";
import { ObservatorioBuilding } from "@/components/sanctuary/observatorio-building";
import { BotanicalGardenBuilding } from "@/components/sanctuary/botanical-garden-building";
import { InteriorDecorationsPanel } from "@/components/sanctuary/interior-decorations-panel";
import { queueOfflineAction, processOfflineQueue, triggerHaptic } from "@/lib/offline-sync";
import {
  COZY_VILLAGE_RESIDENTS,
  type VillageResident,
} from "@/lib/sanctuary/village-tiers";

export type NavItem =
  | "home"
  | "village"
  | "quests"
  | "collections"
  | "party"
  | "notes";

interface EngineStateData {
  wallet_gp: number;
  vault_gp: number;
  player_level: number;
  current_xp: number;
  current_streak_days: number;
  streak_multiplier: number;
  aegis_shields: number;
  quests: Quest[];
  reading_books: ReadingBook[];
  knitting_projects: KnittingProject[];
  rubik_cubes?: RubikCubeCatalogItem[];
  rubik_stats?: RubikStats;
  rubik_stats_by_cube?: Record<string, RubikStats>;
  next_rubik_scramble?: string;
  skill_sessions: SkillSessionRecord[];
  skill_summaries: SkillDomainSummary[];
  spaced_cards?: any[];
  user?: {
    username?: string;
    display_name?: string;
    shortcut_api_key?: string;
  };
}

export function CozyRpgDashboard() {
  const [activeTab, setActiveTab] = useState<NavItem>("home");
  const [viewMode, setViewMode] = useState<"bento" | "village_map">("bento");
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [weatherIndex, setWeatherIndex] = useState(0);
  const [copiedSaveCode, setCopiedSaveCode] = useState(false);
  const [selectedResident, setSelectedResident] = useState<VillageResident | null>(null);

  // Edificio activo abierto en el interior (modal cozy)
  const [activeBuildingModal, setActiveBuildingModal] = useState<string | null>(null);

  // Estado del motor
  const [state, setState] = useState<EngineStateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Notas de bitácora
  const [quickNote, setQuickNote] = useState("");
  const [notesList, setNotesList] = useState<string[]>([
    "Recoger lana de alpaca para la bufanda nórdica.",
    "Completar 20 páginas del libro de arquitectura.",
    "Repasar casos de OLL 2-Look en el Club de Puzzles.",
  ]);

  // Carga de estado desde /api/state
  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        setLoadError("No se pudo cargar el estado de Oakhaven.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setState(data);
      setLoadError(null);
    } catch (err) {
      console.error(err);
      setLoadError("Error al sincronizar con el motor.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // Listener para sincronización automática al recuperar conexión a internet
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOnline = () => {
      processOfflineQueue(async () => {
        await fetchState();
      });
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [fetchState]);

  // Manejo de envío directo de sesión con resiliencia offline PWA
  const handleSubmitSkillSession = async (payload: Record<string, unknown>) => {
    if (typeof window !== "undefined" && !navigator.onLine) {
      queueOfflineAction({
        url: "/api/shortcuts/skill-session",
        method: "POST",
        body: payload,
        description: `Sesión offline: ${String(payload.domain || "actividad")} (${payload.duration_minutes || 15} min)`,
      });
      triggerHaptic("warning");
      return true;
    }

    try {
      const res = await fetch("/api/shortcuts/skill-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        triggerHaptic("success");
        await fetchState();
        return true;
      }
    } catch (err) {
      console.warn("Fallo de red, guardando en cola offline:", err);
      queueOfflineAction({
        url: "/api/shortcuts/skill-session",
        method: "POST",
        body: payload,
        description: `Sesión offline por reintento: ${String(payload.domain || "actividad")}`,
      });
      triggerHaptic("warning");
      return true;
    }
    return false;
  };

  // Climas interactivos
  const weathers = [
    { label: "Soleado & Cálido", icon: Sun, temp: "22°C", desc: "Brisa dulce de colina" },
    { label: "Llovizna Mágica", icon: CloudRain, temp: "18°C", desc: "Ideal para leer y tejer" },
    { label: "Parcialmente Nublado", icon: CloudSun, temp: "20°C", desc: "Perfecto para caminar" },
  ];

  // Reloj y fecha en vivo
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
      setCurrentDate(
        now.toLocaleDateString("es-ES", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Agregar nota
  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickNote.trim()) return;
    setNotesList((prev) => [quickNote.trim(), ...prev]);
    setQuickNote("");
  };

  const handleCopyCode = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText("DA-4892-0193-OAK");
      setCopiedSaveCode(true);
      setTimeout(() => setCopiedSaveCode(false), 2500);
    }
  };

  const activeWeather = weathers[weatherIndex];
  const WeatherIcon = activeWeather.icon;

  const walletGp = state?.wallet_gp || 0;
  const vaultGp = state?.vault_gp || 0;
  const playerLevel = state?.player_level || 1;
  const currentXp = state?.current_xp || 0;
  const streakDays = state?.current_streak_days || 0;
  const readingBooks = state?.reading_books || [];
  const knittingProjects = state?.knitting_projects || [];
  const rubikCubes = state?.rubik_cubes || [];
  const quests = state?.quests || [];
  const recentSessions = state?.skill_sessions || [];

  return (
    <div className="min-h-screen bg-[#F7F4EB] text-[#3A2E2B] font-sans antialiased selection:bg-[#E9C46A]/40 pb-16">
      <div className="mx-auto max-w-[1550px] p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          
          {/* =====================================================================
              1. SIDEBAR IZQUIERDO: MARCO DE MADERA & MENÚ INVENTARIO
             ===================================================================== */}
          <aside className="lg:col-span-3 xl:col-span-3 space-y-6">
            {/* Cabecera del Reino */}
            <div className="relative rounded-3xl border-4 border-[#3A2E2B] bg-[#E8DFCF] p-5 shadow-[0_6px_0_#3A2E2B] transition-transform hover:-translate-y-0.5">
              <span className="absolute top-2.5 left-3 text-xs opacity-70">🔩</span>
              <span className="absolute top-2.5 right-3 text-xs opacity-70">🔩</span>
              <span className="absolute bottom-2.5 left-3 text-xs opacity-70">🔩</span>
              <span className="absolute bottom-2.5 right-3 text-xs opacity-70">🔩</span>

              <div className="text-center">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl border-[3px] border-[#3A2E2B] bg-[#E9C46A] shadow-[0_3px_0_#3A2E2B] mb-2 text-2xl">
                  🏰
                </div>
                <span className="block text-[11px] font-extrabold tracking-wider uppercase text-[#4E6E58]">
                  Bienvenido al Reino
                </span>
                <h1 className="text-xl font-black text-[#3A2E2B] tracking-tight">
                  Valle de Oakhaven
                </h1>
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#4E6E58]/15 px-3 py-1 border-2 border-[#4E6E58]/30 text-xs font-black text-[#4E6E58]">
                  <Sparkles className="h-3.5 w-3.5" /> Nivel {playerLevel} • {streakDays} Días Racha
                </div>
              </div>
            </div>

            {/* Menú de Navegación estilo Inventario */}
            <nav className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-3 shadow-[0_6px_0_#3A2E2B]">
              <div className="px-3 py-2 border-b-2 border-[#3A2E2B]/10 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#795548]">
                  Bolsa de Aventura
                </span>
                <span className="text-xs">🎒</span>
              </div>

              <div className="mt-2 space-y-1.5">
                {[
                  { id: "home", label: "Inicio (Hem)", icon: Home, badge: "Bento" },
                  { id: "village", label: "Pueblo Vivo (By)", icon: Compass, badge: "8 Edificios" },
                  { id: "quests", label: "Misiones (Uppgifter)", icon: Scroll, badge: `${quests.length}` },
                  { id: "collections", label: "Colecciones (Samlingar)", icon: Archive, badge: `${readingBooks.length + knittingProjects.length}` },
                  { id: "party", label: "Compañeros (Invånare)", icon: Users, badge: "7" },
                  { id: "notes", label: "Bitácora (Anteckningar)", icon: FileText, badge: `${notesList.length}` },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id as NavItem);
                        if (item.id === "village") setViewMode("village_map");
                        if (item.id === "home") setViewMode("bento");
                      }}
                      className={`w-full group flex items-center justify-between rounded-2xl border-[3px] px-3.5 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? "border-[#3A2E2B] bg-[#4E6E58] text-[#FFFDF8] shadow-[0_4px_0_#3A2E2B] -translate-y-0.5"
                          : "border-transparent bg-transparent text-[#3A2E2B] hover:border-[#3A2E2B]/30 hover:bg-[#F2ECE1] hover:-translate-y-0.5 hover:shadow-[0_2px_0_#3A2E2B]/20"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-xl border-2 transition-transform group-hover:scale-110 ${
                            isActive
                              ? "border-[#FFFDF8] bg-[#3B5443] text-white"
                              : "border-[#3A2E2B] bg-[#E8DFCF] text-[#3A2E2B]"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span>{item.label}</span>
                      </div>

                      {item.badge && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                            isActive
                              ? "bg-[#E9C46A] text-[#3A2E2B]"
                              : "bg-[#E8DFCF] text-[#795548]"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </nav>

            {/* Acceso Rápido al Command Center Clásico */}
            <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-4 shadow-[0_6px_0_#3A2E2B] text-center">
              <span className="text-xs font-bold text-[#795548] block mb-2">
                ¿Prefieres la vista analítica?
              </span>
              <Link
                href="/dashboard"
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-[#3A2E2B] bg-[#3A2E2B] py-2.5 text-xs font-black text-[#F7F4EB] shadow-[0_3px_0_#5C4033] hover:bg-[#4E3834] transition"
              >
                <Zap className="h-3.5 w-3.5 text-amber-300" />
                Ir a Command Center ➜
              </Link>
            </div>
          </aside>

          {/* =====================================================================
              2. ÁREA PRINCIPAL: HEADER DE MADERA + VISTAS (BENTO O PUEBLO VIVO)
             ===================================================================== */}
          <main className="lg:col-span-9 xl:col-span-9 space-y-6">
            
            {/* BARRA SUPERIOR (HEADER) */}
            <header className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-4 sm:p-5 shadow-[0_6px_0_#3A2E2B] flex flex-wrap items-center justify-between gap-4">
              
              {/* Izquierda: Fecha & Nombre */}
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border-[3px] border-[#3A2E2B] bg-[#4E6E58] text-[#FFFDF8] shadow-[0_3px_0_#3A2E2B] text-xl">
                  📜
                </span>
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#795548]">
                    Bitácora de Oakhaven
                  </span>
                  <h2 className="text-sm sm:text-base font-black text-[#3A2E2B] capitalize">
                    {currentDate || "Cargando fecha..."}
                  </h2>
                </div>
              </div>

              {/* Centro: Switcher de Vistas (Bento vs Pueblo) */}
              <div className="flex items-center rounded-2xl border-[3px] border-[#3A2E2B] bg-[#F7F4EB] p-1 shadow-[0_3px_0_#3A2E2B]">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("bento");
                    setActiveTab("home");
                  }}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition cursor-pointer ${
                    viewMode === "bento"
                      ? "bg-[#4E6E58] text-[#FFFDF8] shadow-sm"
                      : "text-[#3A2E2B] hover:bg-[#E8DFCF]"
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" /> Tablero Bento
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("village_map");
                    setActiveTab("village");
                  }}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition cursor-pointer ${
                    viewMode === "village_map"
                      ? "bg-[#4E6E58] text-[#FFFDF8] shadow-sm"
                      : "text-[#3A2E2B] hover:bg-[#E8DFCF]"
                  }`}
                >
                  <Compass className="h-3.5 w-3.5" /> Pueblo Vivo
                </button>
              </div>

              {/* Derecha: Monedas y Reloj en Vivo */}
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center gap-2 rounded-2xl border-[3px] border-[#3A2E2B] bg-[#E9C46A] px-3.5 py-2 text-[#3A2E2B] shadow-[0_3px_0_#3A2E2B]"
                  title={`Billetera: ${walletGp.toLocaleString("es-CO")} GP • Bóveda: ${vaultGp.toLocaleString("es-CO")} GP`}
                >
                  <Coins className="h-4 w-4" />
                  <span className="font-mono text-xs sm:text-sm font-black">
                    {walletGp.toLocaleString("es-CO")} <span className="text-[10px]">GP</span>
                  </span>
                </div>

                <div className="flex items-center gap-2 rounded-2xl border-[3px] border-[#3A2E2B] bg-[#3A2E2B] px-3.5 py-2 text-[#F7F4EB] shadow-[0_3px_0_#5C4033]">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="font-mono text-xs sm:text-sm font-black tracking-wider">
                    {currentTime || "--:--:--"}
                  </span>
                </div>
              </div>
            </header>

            {/* ===================================================================
                VISTA 1: PUEBLO VIVO INTERACTIVO (MAPA DE EDIFICIOS & TIER VISUAL)
               =================================================================== */}
            {viewMode === "village_map" && (
              <CozyVillageMap
                skillSummaries={state?.skill_summaries || []}
                recentSessions={state?.skill_sessions || []}
                activeBooksCount={readingBooks.length}
                activeKnittingProjectsCount={knittingProjects.length}
                rubikSolvesCount={state?.rubik_stats?.total_solves || 0}
                onSelectBuilding={(buildingId) => setActiveBuildingModal(buildingId)}
                onSelectResident={(resident) => setSelectedResident(resident)}
              />
            )}

            {/* ===================================================================
                VISTA 2: BENTO GRID MODULAR (COZY HOMEPAGE)
               =================================================================== */}
            {viewMode === "bento" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">

                {/* TARJETA 1: RESUMEN DE PROGRESO Y REINO — 7 COLS */}
                <div className="lg:col-span-7 rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] flex flex-col justify-between hover:-translate-y-0.5 transition-transform">
                  <div>
                    <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/10 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#E9C46A] shadow-[0_2px_0_#3A2E2B] text-lg">
                          ⭐
                        </span>
                        <div>
                          <h3 className="text-sm font-black text-[#3A2E2B] uppercase tracking-wide">
                            Estado del Reino (Översikt)
                          </h3>
                          <span className="text-[11px] font-bold text-[#795548]">
                            Nivel {playerLevel} • {currentXp.toLocaleString("es-CO")} XP acumulados
                          </span>
                        </div>
                      </div>

                      <span className="rounded-full border-2 border-[#4E6E58] bg-[#4E6E58]/15 px-3 py-1 text-xs font-black text-[#4E6E58]">
                        Racha: {streakDays} Días
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-2xl border-2 border-[#3A2E2B] bg-[#F7F4EB] p-3 shadow-sm">
                        <span className="text-[10px] font-bold text-[#795548] uppercase">Billetera Activa</span>
                        <p className="mt-1 font-mono text-base font-black text-[#3A2E2B]">
                          {walletGp.toLocaleString("es-CO")} GP
                        </p>
                      </div>
                      <div className="rounded-2xl border-2 border-[#3A2E2B] bg-[#F7F4EB] p-3 shadow-sm">
                        <span className="text-[10px] font-bold text-[#795548] uppercase">Bóveda de Reserva</span>
                        <p className="mt-1 font-mono text-base font-black text-[#4E6E58]">
                          {vaultGp.toLocaleString("es-CO")} GP
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t-2 border-[#3A2E2B]/10 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs font-bold text-[#795548]">
                      {recentSessions.length} actividades reales forjadas
                    </span>
                    <button
                      type="button"
                      onClick={() => setViewMode("village_map")}
                      className="text-xs font-black text-[#4E6E58] hover:underline cursor-pointer"
                    >
                      Explorar Pueblo y Edificios ➜
                    </button>
                  </div>
                </div>

                {/* TARJETA 2: MINI PREVIA DEL PUEBLO — 5 COLS */}
                <div className="lg:col-span-5 rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] flex flex-col justify-between hover:-translate-y-0.5 transition-transform">
                  <div>
                    <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/10 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#4E6E58] text-[#FFFDF8] shadow-[0_2px_0_#3A2E2B] text-lg">
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
                        onClick={() => setViewMode("village_map")}
                        className="rounded-xl border-2 border-[#3A2E2B] bg-[#E8DFCF] p-1.5 text-[#3A2E2B] hover:bg-[#E9C46A] shadow-[0_2px_0_#3A2E2B] transition cursor-pointer"
                        title="Abrir mapa del pueblo"
                      >
                        <Maximize2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="relative mt-3 h-36 rounded-2xl border-[3px] border-[#3A2E2B] bg-gradient-to-b from-[#80B992] to-[#609972] p-3 shadow-inner flex flex-col justify-between">
                      <div className="flex justify-between items-center text-xs font-bold text-[#3A2E2B]">
                        <span className="bg-[#FFFDF8] px-2 py-0.5 rounded-lg border border-[#3A2E2B]">🧶 Atelier</span>
                        <span className="bg-[#FFFDF8] px-2 py-0.5 rounded-lg border border-[#3A2E2B]">📚 Librería</span>
                        <span className="bg-[#FFFDF8] px-2 py-0.5 rounded-lg border border-[#3A2E2B]">🧩 Puzzles</span>
                      </div>
                      <div className="flex justify-around items-center text-3xl">
                        <span>🏡</span>
                        <span>🏰</span>
                        <span>🔭</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-bold text-[#3A2E2B]">
                        <span className="bg-[#FFFDF8] px-2 py-0.5 rounded-lg border border-[#3A2E2B]">🌿 Botánico</span>
                        <span className="bg-[#FFFDF8] px-2 py-0.5 rounded-lg border border-[#3A2E2B]">🏛️ Biblioteca</span>
                        <span className="bg-[#FFFDF8] px-2 py-0.5 rounded-lg border border-[#3A2E2B]">💼 Oficina</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs font-bold text-[#795548]">
                      Coordenadas: 42°N, 71°O
                    </span>
                    <button
                      type="button"
                      onClick={() => setViewMode("village_map")}
                      className="flex items-center gap-1.5 rounded-2xl border-2 border-[#3A2E2B] bg-[#4E6E58] px-3.5 py-1.5 text-xs font-black text-[#FFFDF8] shadow-[0_3px_0_#3A2E2B] hover:-translate-y-0.5 cursor-pointer"
                    >
                      <Compass className="h-3.5 w-3.5" /> Entrar al Pueblo
                    </button>
                  </div>
                </div>

                {/* TARJETA 3: REGISTRO DE MISIONES REALES — 7 COLS */}
                <div className="lg:col-span-7 rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] flex flex-col justify-between hover:-translate-y-0.5 transition-transform">
                  <div>
                    <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/10 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#E76F51] text-white shadow-[0_2px_0_#3A2E2B] text-lg">
                          📜
                        </span>
                        <div>
                          <h3 className="text-sm font-black text-[#3A2E2B] uppercase tracking-wide">
                            Registro de Misiones Diarias
                          </h3>
                          <span className="text-[11px] font-bold text-[#795548]">
                            Tareas y hábitos con recompensa verificada
                          </span>
                        </div>
                      </div>

                      <span className="rounded-full bg-[#E9C46A] border-2 border-[#3A2E2B] px-3 py-0.5 text-xs font-black text-[#3A2E2B]">
                        {quests.filter((q) => q.status === "completed").length} / {quests.length} Listas
                      </span>
                    </div>

                    <div className="mt-3.5 space-y-2.5">
                      {quests.length === 0 ? (
                        <p className="text-xs text-[#7A6B62] py-4 text-center">
                          ¡No hay misiones pendientes para hoy! Revisa tu cronograma.
                        </p>
                      ) : (
                        quests.slice(0, 4).map((quest) => (
                          <div
                            key={quest.id}
                            className={`rounded-2xl border-[3px] border-[#3A2E2B] p-3 shadow-[0_2px_0_#3A2E2B] flex items-center justify-between gap-3 ${
                              quest.status === "completed"
                                ? "bg-[#EAF3ED] opacity-75"
                                : "bg-[#F7F4EB]"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="text-xl">
                                {quest.status === "completed" ? "✅" : "⚔️"}
                              </span>
                              <div>
                                <h4 className={`text-xs font-black text-[#3A2E2B] ${quest.status === "completed" ? "line-through" : ""}`}>
                                  {quest.title}
                                </h4>
                                <span className="text-[10px] font-bold text-[#795548]">
                                  +{quest.reward_gp.toLocaleString("es-CO")} GP • {quest.domain}
                                </span>
                              </div>
                            </div>
                            <span className="rounded-lg bg-[#EBE5D8] px-2 py-0.5 font-mono text-[10px] font-bold text-[#3A2E2B]">
                              {quest.status === "completed" ? "Completada" : "En curso"}
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

                {/* TARJETA 4: COLECCIONES REALES (LIBROS, PROYECTOS, CUBOS) — 5 COLS */}
                <div className="lg:col-span-5 rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] flex flex-col justify-between hover:-translate-y-0.5 transition-transform">
                  <div>
                    <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/10 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#E9C46A] text-[#3A2E2B] shadow-[0_2px_0_#3A2E2B] text-lg">
                          🏺
                        </span>
                        <div>
                          <h3 className="text-sm font-black text-[#3A2E2B] uppercase tracking-wide">
                            Colecciones del Santuario
                          </h3>
                          <span className="text-[11px] font-bold text-[#795548]">
                            Catálogos de recursos reales
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3.5 grid grid-cols-2 gap-3">
                      {/* Libros */}
                      <div
                        onClick={() => setActiveBuildingModal("libreria")}
                        className="rounded-2xl border-[3px] border-[#3A2E2B] bg-[#F7F4EB] p-3 shadow-[0_2px_0_#3A2E2B] hover:-translate-y-0.5 transition cursor-pointer"
                      >
                        <span className="text-2xl">📚</span>
                        <h4 className="mt-1 text-xs font-black text-[#3A2E2B]">La Librería</h4>
                        <span className="font-mono text-xs font-bold text-[#4E6E58]">
                          {readingBooks.length} Libros
                        </span>
                      </div>

                      {/* Tejido */}
                      <div
                        onClick={() => setActiveBuildingModal("atelier")}
                        className="rounded-2xl border-[3px] border-[#3A2E2B] bg-[#F7F4EB] p-3 shadow-[0_2px_0_#3A2E2B] hover:-translate-y-0.5 transition cursor-pointer"
                      >
                        <span className="text-2xl">🧶</span>
                        <h4 className="mt-1 text-xs font-black text-[#3A2E2B]">El Atelier</h4>
                        <span className="font-mono text-xs font-bold text-[#E76F51]">
                          {knittingProjects.length} Proyectos
                        </span>
                      </div>

                      {/* Speedcubing */}
                      <div
                        onClick={() => setActiveBuildingModal("club_puzzles")}
                        className="rounded-2xl border-[3px] border-[#3A2E2B] bg-[#F7F4EB] p-3 shadow-[0_2px_0_#3A2E2B] hover:-translate-y-0.5 transition cursor-pointer"
                      >
                        <span className="text-2xl">🧩</span>
                        <h4 className="mt-1 text-xs font-black text-[#3A2E2B]">Arsenal WCA</h4>
                        <span className="font-mono text-xs font-bold text-[#06B6D4]">
                          {rubikCubes.length || 1} Cubos
                        </span>
                      </div>

                      {/* Observatorio */}
                      <div
                        onClick={() => setActiveBuildingModal("observatorio")}
                        className="rounded-2xl border-[3px] border-[#3A2E2B] bg-[#F7F4EB] p-3 shadow-[0_2px_0_#3A2E2B] hover:-translate-y-0.5 transition cursor-pointer"
                      >
                        <span className="text-2xl">🔭</span>
                        <h4 className="mt-1 text-xs font-black text-[#3A2E2B]">Observatorio</h4>
                        <span className="font-mono text-xs font-bold text-[#A855F7]">
                          Deep Work
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t-2 border-[#3A2E2B]/10 text-xs font-bold text-[#795548] flex justify-between">
                    <span>Haz clic en una colección para abrir su edificio</span>
                  </div>
                </div>

                {/* TARJETA 5: COMPAÑEROS & RESIDENTES ASISTENTES — 12 COLS */}
                <div className="lg:col-span-12 rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] hover:-translate-y-0.5 transition-transform">
                  <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/10 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#E9C46A] shadow-[0_2px_0_#3A2E2B] text-lg">
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
                      {COZY_VILLAGE_RESIDENTS.length} Asistentes Activos
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
                    {COZY_VILLAGE_RESIDENTS.map((resident) => (
                      <div
                        key={resident.id}
                        onClick={() => setSelectedResident(resident)}
                        className="group rounded-2xl border-[3px] border-[#3A2E2B] bg-[#F7F4EB] p-3 shadow-[0_2px_0_#3A2E2B] text-center hover:-translate-y-1 hover:shadow-[0_4px_0_#3A2E2B] transition-all cursor-pointer"
                      >
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#3A2E2B] bg-[#FFFDF8] text-2xl group-hover:scale-110 transition-transform">
                          {resident.avatar}
                        </div>
                        <h4 className="mt-1.5 text-xs font-black text-[#3A2E2B]">
                          {resident.name}
                        </h4>
                        <span className="block text-[9px] font-bold text-[#795548]">
                          {resident.title}
                        </span>
                        <p className="mt-1 text-[9px] italic text-[#5C4033] line-clamp-1">
                          "{resident.greetingQuote}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* TARJETA 6: BITÁCORA DE NOTAS RÁPIDAS — 12 COLS */}
                <div className="lg:col-span-12 rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B]">
                  <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/10 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">✍️</span>
                      <h3 className="text-sm font-black text-[#3A2E2B]">
                        Bitácora & Recordatorios de Oakhaven
                      </h3>
                    </div>
                  </div>

                  <form onSubmit={handleAddNote} className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={quickNote}
                      onChange={(e) => setQuickNote(e.target.value)}
                      placeholder="Anota una idea o recordatorio rápido..."
                      className="flex-1 rounded-2xl border-2 border-[#3A2E2B] bg-[#F7F4EB] px-4 py-2 text-xs text-[#3A2E2B] focus:outline-none focus:border-[#4E6E58]"
                    />
                    <button
                      type="submit"
                      className="rounded-2xl border-2 border-[#3A2E2B] bg-[#4E6E58] px-4 py-2 text-xs font-black text-[#FFFDF8] shadow-[0_2px_0_#3A2E2B] hover:bg-[#3D5645] cursor-pointer"
                    >
                      Anotar
                    </button>
                  </form>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {notesList.map((note, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] p-2.5 text-xs text-[#3A2E2B] flex items-center justify-between gap-2"
                      >
                        <span className="line-clamp-2">📌 {note}</span>
                        <button
                          type="button"
                          onClick={() => setNotesList((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-[10px] text-[#795548] hover:text-red-700 font-bold shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </main>
        </div>
      </div>

      {/* =========================================================================
          MODAL CON INTERIOR DEL EDIFICIO ESPECIALIZADO SELECCIONADO
         ========================================================================= */}
      {activeBuildingModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#3A2E2B]/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setActiveBuildingModal(null)}
        >
          <div
            className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl border-4 border-[#3A2E2B] bg-[#1a1715] p-5 sm:p-7 shadow-[0_12px_0_#3A2E2B] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del modal */}
            <div className="flex items-center justify-between border-b-2 border-white/10 pb-3">
              <span className="text-xs font-bold text-amber-200">
                🏰 Interior del Edificio • Santuario Cozy de Oakhaven
              </span>
              <button
                type="button"
                onClick={() => setActiveBuildingModal(null)}
                className="rounded-xl border-2 border-[#5C4033] bg-[#E9C46A] px-3 py-1 text-xs font-black text-[#3A2E2B] hover:bg-[#F4A261] cursor-pointer"
              >
                Volver al Pueblo ✕
              </button>
            </div>

            {/* Vitrina de Mobiliario y Logros del Edificio */}
            {activeBuildingModal && (
              <InteriorDecorationsPanel
                buildingId={activeBuildingModal}
                buildingName={
                  activeBuildingModal === "atelier"
                    ? "El Atelier de Hilados"
                    : activeBuildingModal === "libreria"
                    ? "La Librería & Archivo"
                    : activeBuildingModal === "biblioteca"
                    ? "La Biblioteca del Erudito"
                    : activeBuildingModal === "club_puzzles"
                    ? "Club de Puzzles WCA"
                    : activeBuildingModal === "observatorio"
                    ? "El Observatorio Cósmico"
                    : "Santuario"
                }
                stats={{
                  level: state?.skill_summaries?.find((s) => s.domain === (
                    activeBuildingModal === "atelier" ? "knitting"
                    : activeBuildingModal === "libreria" ? "reading"
                    : activeBuildingModal === "biblioteca" ? "study"
                    : activeBuildingModal === "club_puzzles" ? "rubik"
                    : activeBuildingModal === "observatorio" ? "general"
                    : "general"
                  ))?.level || 1,
                  sessionsCount: state?.skill_summaries?.find((s) => s.domain === (
                    activeBuildingModal === "atelier" ? "knitting"
                    : activeBuildingModal === "libreria" ? "reading"
                    : activeBuildingModal === "biblioteca" ? "study"
                    : activeBuildingModal === "club_puzzles" ? "rubik"
                    : activeBuildingModal === "observatorio" ? "general"
                    : "general"
                  ))?.sessions_count || recentSessions.length,
                  booksRead: readingBooks.length,
                  knittingRows: knittingProjects.reduce((acc, p) => acc + (p.completed_rows || 0), 0),
                  rubikPb: state?.rubik_stats?.pb_seconds ?? null,
                  focusMinutes: recentSessions.filter(s => s.domain === "general").reduce((acc, s) => acc + (s.duration_minutes || 0), 0),
                }}
              />
            )}

            {/* Inyección del Edificio Especializado */}
            <div>
              {activeBuildingModal === "atelier" && (
                <AtelierBuilding
                  projects={knittingProjects}
                  playerLevel={playerLevel}
                  skillLevel={state?.skill_summaries?.find((s) => s.domain === "knitting")?.level || 1}
                  totalGpEarned={state?.skill_summaries?.find((s) => s.domain === "knitting")?.total_gp_earned || 0}
                  isCozyActive={true}
                  onRefreshState={fetchState}
                  onSubmitDirectSkillSession={handleSubmitSkillSession}
                />
              )}

              {activeBuildingModal === "libreria" && (
                <LibreriaBuilding
                  books={readingBooks}
                  playerLevel={playerLevel}
                  skillLevel={state?.skill_summaries?.find((s) => s.domain === "reading")?.level || 1}
                  totalGpEarned={state?.skill_summaries?.find((s) => s.domain === "reading")?.total_gp_earned || 0}
                  isCozyActive={true}
                  onRefreshState={fetchState}
                  onSubmitDirectSkillSession={handleSubmitSkillSession}
                />
              )}

              {activeBuildingModal === "biblioteca" && (
                <BibliotecaBuilding
                  cards={state?.spaced_cards || []}
                  sessions={recentSessions}
                  playerLevel={playerLevel}
                  skillLevel={state?.skill_summaries?.find((s) => s.domain === "study")?.level || 1}
                  totalGpEarned={state?.skill_summaries?.find((s) => s.domain === "study")?.total_gp_earned || 0}
                  isCozyActive={true}
                  onRefreshState={fetchState}
                  onSubmitDirectSkillSession={handleSubmitSkillSession}
                  onReviewCard={async () => {}}
                  onAddCard={async () => {}}
                />
              )}

              {activeBuildingModal === "club_puzzles" && (
                <ClubPuzzlesBuilding
                  cubes={rubikCubes}
                  rubikStats={state?.rubik_stats || { cube_type: "3x3", total_solves: 0, pb_seconds: null, ao5_seconds: null, ao12_seconds: null, mean_seconds: null, recent_solves: [] }}
                  rubikStatsByCube={state?.rubik_stats_by_cube}
                  nextScramble={state?.next_rubik_scramble}
                  playerLevel={playerLevel}
                  skillLevel={state?.skill_summaries?.find((s) => s.domain === "rubik")?.level || 1}
                  totalGpEarned={state?.skill_summaries?.find((s) => s.domain === "rubik")?.total_gp_earned || 0}
                  isCozyActive={true}
                  onRefreshState={fetchState}
                  onSubmitDirectSkillSession={handleSubmitSkillSession}
                />
              )}

              {activeBuildingModal === "observatorio" && (
                <ObservatorioBuilding
                  sessions={recentSessions}
                  playerLevel={playerLevel}
                  skillLevel={state?.skill_summaries?.find((s) => s.domain === "general")?.level || 1}
                  totalGpEarned={state?.skill_summaries?.find((s) => s.domain === "general")?.total_gp_earned || 0}
                  isCozyActive={true}
                  onRefreshState={fetchState}
                  onSubmitDirectSkillSession={handleSubmitSkillSession}
                />
              )}

              {activeBuildingModal === "pabellon_gardening" && (
                <BotanicalGardenBuilding
                  playerLevel={playerLevel}
                  skillLevel={state?.skill_summaries?.find((s) => s.domain === "gardening")?.level || 1}
                  totalGpEarned={state?.skill_summaries?.find((s) => s.domain === "gardening")?.total_gp_earned || 0}
                  isCozyActive={true}
                  quests={quests}
                  onRefreshState={fetchState}
                  onSubmitDirectSkillSession={handleSubmitSkillSession}
                />
              )}

              {activeBuildingModal === "pabellon_hiking" && (
                <div className="p-8 text-center space-y-4">
                  <span className="text-5xl">🥾</span>
                  <h3 className="text-xl font-bold text-white">Puesto de Senderismo</h3>
                  <p className="text-xs text-slate-300 max-w-md mx-auto">
                    Ajusta las correas de tu mochila y sal a despejar la mente con una caminata por los senderos de Oakhaven.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveBuildingModal(null)}
                    className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-500 cursor-pointer"
                  >
                    Cerrar Puesto
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DIÁLOGO MODAL DE RESIDENTE */}
      {selectedResident && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3A2E2B]/70 backdrop-blur-sm animate-in fade-in"
          onClick={() => setSelectedResident(null)}
        >
          <div
            className="w-full max-w-lg rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-6 shadow-[0_8px_0_#3A2E2B] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/10 pb-3">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[#3A2E2B] bg-[#E9C46A] text-2xl shadow-sm">
                  {selectedResident.avatar}
                </span>
                <div>
                  <h3 className="text-base font-black text-[#3A2E2B]">
                    {selectedResident.name}
                  </h3>
                  <span className="text-xs font-bold text-[#4E6E58]">
                    {selectedResident.title} ({selectedResident.species})
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedResident(null)}
                className="rounded-xl border-2 border-[#3A2E2B] bg-[#E8DFCF] p-1.5 text-[#3A2E2B] hover:bg-[#E9C46A] shadow-[0_2px_0_#3A2E2B] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-2xl border-2 border-[#3A2E2B] bg-[#F7F4EB] p-4 space-y-2">
              <p className="text-xs italic font-medium text-[#5C4033]">
                "{selectedResident.greetingQuote}"
              </p>
              <p className="text-xs font-bold text-[#3A2E2B]">
                💬 {selectedResident.getDynamicAdvice({
                  skillLevel: state?.skill_summaries?.find((s) => s.domain === selectedResident.domain)?.level || 1,
                  sessionsCount: state?.skill_summaries?.find((s) => s.domain === selectedResident.domain)?.sessions_count || 0,
                  lastSessionDetails: recentSessions.find((s) => s.domain === selectedResident.domain)?.details,
                })}
              </p>
            </div>

            {/* Micro-Misión de Bienestar del Residente */}
            {selectedResident.microQuest && (
              <div className="rounded-2xl border-2 border-[#4E6E58]/40 bg-[#4E6E58]/10 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-[#4E6E58] tracking-wider">
                    Micro-Misión de Bienestar
                  </span>
                  <span className="rounded-full bg-[#E9C46A] border border-[#3A2E2B] px-2 py-0.5 text-[9px] font-black text-[#3A2E2B]">
                    {selectedResident.microQuest.badge}
                  </span>
                </div>
                <h5 className="text-xs font-black text-[#3A2E2B]">
                  {selectedResident.microQuest.title}
                </h5>
                <p className="text-[11px] text-[#5C4033] font-medium">
                  {selectedResident.microQuest.description}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setActiveBuildingModal(selectedResident.buildingId);
                    setSelectedResident(null);
                  }}
                  className="mt-2 w-full rounded-xl border-2 border-[#3A2E2B] bg-[#E9C46A] py-2 text-xs font-black text-[#3A2E2B] hover:bg-[#F4A261] shadow-[0_2px_0_#3A2E2B] cursor-pointer"
                >
                  Aceptar Micro-Misión e Ir al Edificio ➜
                </button>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-[#795548] pt-1">
              <span>🎁 Regalo preferido: {selectedResident.favoriteGift}</span>
              <button
                type="button"
                onClick={() => {
                  setActiveBuildingModal(selectedResident.buildingId);
                  setSelectedResident(null);
                }}
                className="rounded-xl border-2 border-[#3A2E2B] bg-[#4E6E58] px-3.5 py-1.5 text-xs font-black text-[#FFFDF8] shadow-[0_2px_0_#3A2E2B] hover:bg-[#3B5443] cursor-pointer"
              >
                Ir a su Edificio ➜
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
