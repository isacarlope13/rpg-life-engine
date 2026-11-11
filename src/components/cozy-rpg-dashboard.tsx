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
import { HikingOutpostBuilding } from "@/components/sanctuary/hiking-outpost-building";
import { KitchenBuilding } from "@/components/sanctuary/kitchen-building";
import { OfficeBuilding } from "@/components/sanctuary/office-building";
import { VillageScrapbookModal } from "@/components/sanctuary/village-scrapbook-modal";
import { InteriorDecorationsPanel } from "@/components/sanctuary/interior-decorations-panel";
import { CozySkeletonLoader } from "@/components/cozy/cozy-skeleton-loader";
import { CozySidebar } from "@/components/cozy/cozy-sidebar";
import { CozyHeader } from "@/components/cozy/cozy-header";
import { BentoDailyDashboard } from "@/components/cozy/bento-daily-dashboard";
import { ResidentModal } from "@/components/cozy/resident-modal";
import { CozySoundscapeModal } from "@/components/cozy/cozy-soundscape-modal";
import { VillageQuestsModal } from "@/components/cozy/village-quests-modal";
import { CozyQuickCaptureModal } from "@/components/cozy/cozy-quick-capture-modal";
import {
  queueOfflineAction,
  processOfflineQueue,
  triggerHaptic,
  getOfflineQueue,
  registerServiceWorker,
} from "@/lib/offline-sync";
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

  // Resiliencia PWA Offline
  const [isOffline, setIsOffline] = useState(false);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  // Notas de bitácora
  const [quickNote, setQuickNote] = useState("");
  const [isScrapbookOpen, setIsScrapbookOpen] = useState(false);
  const [isSoundscapeOpen, setIsSoundscapeOpen] = useState(false);
  const [isVillageQuestsOpen, setIsVillageQuestsOpen] = useState(false);
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
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

  // Inicialización de Service Worker y persistencia de notas
  useEffect(() => {
    registerServiceWorker();
    if (typeof window !== "undefined") {
      setIsOffline(!navigator.onLine);
      setOfflineQueueCount(getOfflineQueue().length);
      try {
        const savedNotes = localStorage.getItem("cozy_oakhaven_notes_v1");
        if (savedNotes) {
          const parsed = JSON.parse(savedNotes);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setNotesList(parsed);
          }
        }
      } catch (e) {
        console.warn("Error cargando notas de Oakhaven:", e);
      }
    }
  }, []);

  // Listener para sincronización automática y detección de conexión PWA
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = async () => {
      setIsOffline(false);
      const synced = await processOfflineQueue(async () => {
        await fetchState();
      });
      setOfflineQueueCount(getOfflineQueue().length);
      if (synced > 0) {
        triggerHaptic("success");
      }
    };

    const handleOffline = () => {
      setIsOffline(true);
      setOfflineQueueCount(getOfflineQueue().length);
      triggerHaptic("warning");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [fetchState]);

  // Sincronización manual bajo demanda
  const handleManualSync = async () => {
    if (typeof window === "undefined" || !navigator.onLine) return;
    const synced = await processOfflineQueue(async () => {
      await fetchState();
    });
    setOfflineQueueCount(getOfflineQueue().length);
    if (synced > 0) {
      triggerHaptic("success");
    }
  };

  // Manejo de envío directo de sesión con resiliencia offline PWA
  const handleSubmitSkillSession = async (payload: Record<string, unknown>) => {
    if (typeof window !== "undefined" && !navigator.onLine) {
      queueOfflineAction({
        url: "/api/shortcuts/skill-session",
        method: "POST",
        body: payload,
        description: `Sesión offline: ${String(payload.domain || "actividad")} (${payload.duration_minutes || 15} min)`,
      });
      setOfflineQueueCount(getOfflineQueue().length);
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
      setOfflineQueueCount(getOfflineQueue().length);
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

  // Accesibilidad de teclado: tecla Escape para cerrar modales activos
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (activeBuildingModal) {
          setActiveBuildingModal(null);
        } else if (selectedResident) {
          setSelectedResident(null);
        } else if (isQuickCaptureOpen) {
          setIsQuickCaptureOpen(false);
        } else if (isVillageQuestsOpen) {
          setIsVillageQuestsOpen(false);
        } else if (isSoundscapeOpen) {
          setIsSoundscapeOpen(false);
        } else if (isScrapbookOpen) {
          setIsScrapbookOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeBuildingModal,
    selectedResident,
    isQuickCaptureOpen,
    isVillageQuestsOpen,
    isSoundscapeOpen,
    isScrapbookOpen,
  ]);

  // Agregar nota con persistencia
  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickNote.trim()) return;
    const updated = [quickNote.trim(), ...notesList];
    setNotesList(updated);
    setQuickNote("");
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("cozy_oakhaven_notes_v1", JSON.stringify(updated));
      } catch (err) {
        console.warn("Error guardando notas de Oakhaven:", err);
      }
    }
  };

  // Eliminar nota con persistencia
  const handleDeleteNote = (idx: number) => {
    const updated = notesList.filter((_, i) => i !== idx);
    setNotesList(updated);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("cozy_oakhaven_notes_v1", JSON.stringify(updated));
      } catch (err) {
        console.warn("Error guardando notas de Oakhaven:", err);
      }
    }
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

  if (loading && !state) {
    return <CozySkeletonLoader />;
  }

  return (
    <div className="min-h-screen bg-[#F7F4EB] text-[#3A2E2B] font-sans antialiased selection:bg-[#E9C46A]/40 pb-16">
      <div className="mx-auto max-w-[1550px] p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          
          {/* =====================================================================
              1. SIDEBAR IZQUIERDO: MARCO DE MADERA & MENÚ INVENTARIO (MODULAR)
             ===================================================================== */}
          <CozySidebar
            playerLevel={playerLevel}
            streakDays={streakDays}
            activeTab={activeTab}
            onTabChange={(tab) => {
              setActiveTab(tab);
              if (tab === "village") setViewMode("village_map");
              if (tab === "home") setViewMode("bento");
            }}
            questsCount={quests.length}
            collectionsCount={readingBooks.length + knittingProjects.length}
            residentsCount={COZY_VILLAGE_RESIDENTS.length}
            notesCount={notesList.length}
          />

          {/* =====================================================================
              2. ÁREA PRINCIPAL: HEADER DE MADERA + VISTAS (BENTO O PUEBLO VIVO)
             ===================================================================== */}
          <main className="lg:col-span-9 xl:col-span-9 space-y-6">
            
            {/* BARRA SUPERIOR (HEADER MODULAR) */}
            <CozyHeader
              currentDate={currentDate}
              currentTime={currentTime}
              viewMode={viewMode}
              onViewModeChange={(mode) => {
                setViewMode(mode);
                if (mode === "bento") setActiveTab("home");
                if (mode === "village_map") setActiveTab("village");
              }}
              onOpenScrapbook={() => setIsScrapbookOpen(true)}
              onOpenSoundscape={() => setIsSoundscapeOpen(true)}
              onOpenQuickCapture={() => setIsQuickCaptureOpen(true)}
              walletGp={walletGp}
              vaultGp={vaultGp}
              isOffline={isOffline}
              offlineQueueCount={offlineQueueCount}
              onSyncNow={handleManualSync}
            />

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
                onSubmitSkillSession={handleSubmitSkillSession}
              />
            )}

            {/* ===================================================================
                VISTA 2: BENTO GRID MODULAR (COZY HOMEPAGE)
               =================================================================== */}
            {viewMode === "bento" && (
              <BentoDailyDashboard
                playerLevel={playerLevel}
                currentXp={currentXp}
                streakDays={streakDays}
                walletGp={walletGp}
                vaultGp={vaultGp}
                recentSessions={recentSessions}
                quests={quests}
                readingBooks={readingBooks}
                knittingProjects={knittingProjects}
                rubikCubes={rubikCubes}
                residents={COZY_VILLAGE_RESIDENTS}
                skillSummaries={state?.skill_summaries || []}
                currentDate={currentDate}
                quickNote={quickNote}
                notesList={notesList}
                onQuickNoteChange={setQuickNote}
                onAddNote={handleAddNote}
                onDeleteNote={handleDeleteNote}
                onSwitchToVillageMap={() => setViewMode("village_map")}
                onOpenBuilding={(buildingId) => setActiveBuildingModal(buildingId)}
                onSelectResident={(resident) => setSelectedResident(resident)}
                onOpenQuestsModal={() => setIsVillageQuestsOpen(true)}
                onOpenScrapbook={() => setIsScrapbookOpen(true)}
                onOpenQuickCapture={() => setIsQuickCaptureOpen(true)}
                onSubmitSkillSession={handleSubmitSkillSession}
              />
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
                aria-label="Volver al pueblo y cerrar interior"
                className="rounded-xl border-2 border-[#5C4033] bg-[#E9C46A] px-4 py-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-xs font-black text-[#3A2E2B] hover:bg-[#F4A261] cursor-pointer transition-colors"
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
                    : activeBuildingModal === "oficina"
                    ? "Torre de Gestión & Oficina"
                    : "Santuario"
                }
                stats={{
                  level: state?.skill_summaries?.find((s) => s.domain === (
                    activeBuildingModal === "atelier" ? "knitting"
                    : activeBuildingModal === "libreria" ? "reading"
                    : activeBuildingModal === "biblioteca" ? "study"
                    : activeBuildingModal === "club_puzzles" ? "rubik"
                    : activeBuildingModal === "observatorio" ? "general"
                    : activeBuildingModal === "oficina" ? "work"
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
                  sessions={recentSessions}
                  playerLevel={playerLevel}
                  skillLevel={state?.skill_summaries?.find((s) => s.domain === "knitting")?.level || 1}
                  totalGpEarned={state?.skill_summaries?.find((s) => s.domain === "knitting")?.total_gp_earned || 0}
                  isCozyActive={true}
                  onRefreshState={fetchState}
                  onSubmitDirectSkillSession={handleSubmitSkillSession}
                  onClose={() => setActiveBuildingModal(null)}
                />
              )}

              {activeBuildingModal === "libreria" && (
                <LibreriaBuilding
                  books={readingBooks}
                  sessions={recentSessions}
                  playerLevel={playerLevel}
                  skillLevel={state?.skill_summaries?.find((s) => s.domain === "reading")?.level || 1}
                  totalGpEarned={state?.skill_summaries?.find((s) => s.domain === "reading")?.total_gp_earned || 0}
                  isCozyActive={true}
                  onRefreshState={fetchState}
                  onSubmitDirectSkillSession={handleSubmitSkillSession}
                  onClose={() => setActiveBuildingModal(null)}
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
                  onClose={() => setActiveBuildingModal(null)}
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
                  onClose={() => setActiveBuildingModal(null)}
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
                  onClose={() => setActiveBuildingModal(null)}
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
                  onClose={() => setActiveBuildingModal(null)}
                />
              )}

              {activeBuildingModal === "pabellon_hiking" && (
                <HikingOutpostBuilding
                  playerLevel={playerLevel}
                  skillLevel={state?.skill_summaries?.find((s) => s.domain === "hiking")?.level || 1}
                  totalGpEarned={state?.skill_summaries?.find((s) => s.domain === "hiking")?.total_gp_earned || 0}
                  isCozyActive={true}
                  onRefreshState={fetchState}
                  onSubmitDirectSkillSession={handleSubmitSkillSession}
                  onClose={() => setActiveBuildingModal(null)}
                />
              )}

              {activeBuildingModal === "cocina" && (
                <KitchenBuilding
                  playerLevel={playerLevel}
                  skillLevel={state?.skill_summaries?.find((s) => s.domain === "cooking")?.level || 1}
                  totalGpEarned={state?.skill_summaries?.find((s) => s.domain === "cooking")?.total_gp_earned || 0}
                  isCozyActive={true}
                  onRefreshState={fetchState}
                  onSubmitDirectSkillSession={handleSubmitSkillSession}
                  onClose={() => setActiveBuildingModal(null)}
                />
              )}

              {activeBuildingModal === "oficina" && (
                <OfficeBuilding
                  playerLevel={playerLevel}
                  skillLevel={state?.skill_summaries?.find((s) => s.domain === "work")?.level || 1}
                  totalGpEarned={state?.skill_summaries?.find((s) => s.domain === "work")?.total_gp_earned || 0}
                  isCozyActive={true}
                  onRefreshState={fetchState}
                  onSubmitDirectSkillSession={handleSubmitSkillSession}
                  onClose={() => setActiveBuildingModal(null)}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* DIÁLOGO MODAL DE RESIDENTE (MODULAR CON MICRO-MISIÓN REAL) */}
      <ResidentModal
        resident={selectedResident}
        onClose={() => setSelectedResident(null)}
        onOpenBuilding={(buildingId) => setActiveBuildingModal(buildingId)}
        onSubmitSkillSession={handleSubmitSkillSession}
        domainSummary={
          selectedResident
            ? state?.skill_summaries?.find((s) => s.domain === selectedResident.domain)
            : undefined
        }
        recentSessions={recentSessions}
      />

      {/* ÁLBUM DE RECUERDOS Y POSTALES */}
      <VillageScrapbookModal
        isOpen={isScrapbookOpen}
        onClose={() => setIsScrapbookOpen(false)}
        playerLevel={playerLevel}
        booksCount={readingBooks.length}
        knittingProjectsCount={knittingProjects.length}
        rubikSolvesCount={state?.rubik_stats?.total_solves || 0}
        sessionsCount={recentSessions.length}
        streakDays={streakDays}
        walletGp={walletGp}
        vaultGp={vaultGp}
        rubikPb={state?.rubik_stats?.pb_seconds ?? null}
      />

      {/* AMBIENTACIÓN SONORA PROCEDURAL */}
      <CozySoundscapeModal
        isOpen={isSoundscapeOpen}
        onClose={() => setIsSoundscapeOpen(false)}
      />

      {/* DIARIO DE MISIONES VECINALES (ACCESIBLE DESDE BENTO Y MAPA) */}
      <VillageQuestsModal
        isOpen={isVillageQuestsOpen}
        onClose={() => setIsVillageQuestsOpen(false)}
        onOpenBuilding={(buildingId) => setActiveBuildingModal(buildingId)}
        onSubmitSkillSession={handleSubmitSkillSession}
        skillSummaries={state?.skill_summaries || []}
        recentSessions={recentSessions}
      />

      {/* CAPTURA RÁPIDA OMNI INTELIGENTE */}
      <CozyQuickCaptureModal
        isOpen={isQuickCaptureOpen}
        onClose={() => setIsQuickCaptureOpen(false)}
        onSuccess={fetchState}
      />
    </div>
  );
}
