"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Compass,
  Sparkles,
  TreePine,
  Sun,
  CloudSun,
  Flame,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  ChevronRight,
  Award,
  BookOpen,
  Layers,
  Clock,
  Eye,
  CloudRain,
  Moon,
  Wind,
  LayoutGrid,
  Map as MapIcon,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Info,
  SlidersHorizontal,
} from "lucide-react";
import type { SkillDomain, SkillDomainSummary, SkillSessionRecord } from "@/types/rpg";
import {
  calculateBuildingTier,
  COZY_VILLAGE_RESIDENTS,
  type VillageResident,
} from "@/lib/sanctuary/village-tiers";
import {
  VILLAGE_BUILDINGS_CATALOG,
  filterBuildingsByDistrict,
  type VillageBuildingDefinition,
  type BuildingDistrict,
} from "@/lib/sanctuary/village-buildings-registry";
import {
  loadWorldPreferences,
  filterVisibleBuildings,
  type VillageWorldConfig,
} from "@/lib/sanctuary/world-preferences-engine";
import { WorldCustomizationModal } from "@/components/sanctuary/world-customization-modal";
import { cozySoundscape, type SoundscapeTheme } from "@/lib/sanctuary/cozy-soundscape";
import { MayorsLedgerModal } from "@/components/sanctuary/mayors-ledger-modal";
import { VillageQuestsModal } from "@/components/cozy/village-quests-modal";
import { VillagePixelBuilding } from "@/components/cozy/village-pixel-building";
import { InteractiveVillageScene } from "@/components/sanctuary/interactive-village-scene";
import { CozyButton, CozyCard } from "@/components/cozy/ui";
import { triggerHaptic } from "@/lib/offline-sync";
import { safeLocalStorage } from "@/lib/storage-safe";

export type VillageWeather = "sunny" | "rain" | "autumn" | "night";
export type MapViewMode = "landscape" | "grid";

interface CozyVillageMapProps {
  skillSummaries?: SkillDomainSummary[];
  recentSessions?: SkillSessionRecord[];
  activeBooksCount?: number;
  activeKnittingProjectsCount?: number;
  rubikSolvesCount?: number;
  onSelectBuilding: (buildingId: string, domain: SkillDomain) => void;
  onSelectResident?: (resident: VillageResident) => void;
  onOpenCompanions?: () => void;
  onSubmitSkillSession?: (payload: Record<string, unknown>) => Promise<boolean>;
}

export function CozyVillageMap({
  skillSummaries = [],
  recentSessions = [],
  activeBooksCount = 0,
  activeKnittingProjectsCount = 0,
  rubikSolvesCount = 0,
  onSelectBuilding,
  onSelectResident,
  onOpenCompanions,
  onSubmitSkillSession,
}: CozyVillageMapProps) {
  const [ambientAnimEnabled, setAmbientAnimEnabled] = useState(true);
  const [viewMode, setViewMode] = useState<MapViewMode>("landscape");
  const [hoveredBuildingId, setHoveredBuildingId] = useState<string | null>(null);
  const [selectedBuildingDetail, setSelectedBuildingDetail] = useState<VillageBuildingDefinition | null>(null);

  const [weather, setWeather] = useState<VillageWeather>(() => {
    try {
      const saved = safeLocalStorage.getItem("oakhaven_weather_pref") as VillageWeather | null;
      if (saved && ["sunny", "rain", "autumn", "night"].includes(saved)) {
        return saved;
      }
    } catch {
      // Fallback seguro
    }
    return "sunny";
  });

  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try {
      const saved = safeLocalStorage.getItem("oakhaven_sound_muted_pref");
      if (saved !== null) {
        return saved === "true";
      }
    } catch {
      // Fallback seguro
    }
    return true;
  });

  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [isQuestsOpen, setIsQuestsOpen] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState<BuildingDistrict | "all">("all");
  const [activeResidentDialogue, setActiveResidentDialogue] = useState<VillageResident | null>(null);

  // Configuración de Habilidades y Mundo Adaptable (OakHaven 4.0)
  const [worldConfig, setWorldConfig] = useState<VillageWorldConfig>(() => loadWorldPreferences());
  const [isWorldCustomizationOpen, setIsWorldCustomizationOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Detener audio al desmontar
  useEffect(() => {
    return () => {
      cozySoundscape.stopAll();
    };
  }, []);

  // Manejo de cambio de clima sincronizado con audio
  const handleWeatherChange = (newWeather: VillageWeather) => {
    setWeather(newWeather);
    triggerHaptic("light");
    try {
      safeLocalStorage.setItem("oakhaven_weather_pref", newWeather);
    } catch {}
    if (!isMuted) {
      const themeMap: Record<VillageWeather, SoundscapeTheme> = {
        sunny: "sunny_breeze",
        rain: "gentle_rain",
        autumn: "autumn_wind",
        night: "night_crickets",
      };
      cozySoundscape.playTheme(themeMap[newWeather]);
    }
  };

  // Alternar sonido ambiental
  const toggleSound = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    triggerHaptic("medium");
    try {
      safeLocalStorage.setItem("oakhaven_sound_muted_pref", String(nextMuted));
    } catch {}
    cozySoundscape.setMuted(nextMuted);
    if (!nextMuted) {
      const themeMap: Record<VillageWeather, SoundscapeTheme> = {
        sunny: "sunny_breeze",
        rain: "gentle_rain",
        autumn: "autumn_wind",
        night: "night_crickets",
      };
      cozySoundscape.playTheme(themeMap[weather]);
    } else {
      cozySoundscape.stopAll();
    }
  };

  // Filtrado de edificios por distrito y preferencias activas de Mi Mundo (4.0)
  const filteredBuildings = useMemo(() => {
    const districtFiltered = filterBuildingsByDistrict(selectedDistrict);
    return filterVisibleBuildings(districtFiltered, worldConfig);
  }, [selectedDistrict, worldConfig]);

  return (
    <div className="space-y-6 text-[#3A2E2B]" role="region" aria-label="Mapa Interactivo del Pueblo Oakhaven">
      {/* =========================================================================
          1. BARRA SUPERIOR DE CONTROL: AMBIENTE, VISTA & EXPEDICIONES
         ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-4 sm:p-5 shadow-[0_6px_0_#3A2E2B]">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[#3A2E2B] bg-[#E7D69C] text-2xl shadow-[0_2px_0_#3A2E2B]">
            🗺️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black tracking-tight text-[#3A2E2B]">
                Pueblo Vivo de Oakhaven
              </h2>
              <span className="rounded-full bg-[#314C3C]/10 border border-[#314C3C]/30 px-2.5 py-0.5 text-[10px] font-black text-[#314C3C]">
                ⭐ Santuario Interactivo
              </span>
            </div>
            <p className="text-xs text-[#795548]">
              Explora los {VILLAGE_BUILDINGS_CATALOG.length} edificios reales de tus habilidades: caminos, río, huertos y residentes.
            </p>
          </div>
        </div>

        {/* CONTROLES GLOBALES DEL PUEBLO */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Alternar Vista Paisajística / Lista Accesible */}
          <div className="flex rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC] p-1 text-xs font-bold shadow-[0_2px_0_#3A2E2B]">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                setViewMode("landscape");
              }}
              className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 transition cursor-pointer ${
                viewMode === "landscape"
                  ? "bg-[#314C3C] text-[#FFFDF8] shadow-[0_2px_0_#1A2B20]"
                  : "text-[#795548] hover:text-[#3A2E2B]"
              }`}
              title="Vista Paisajística Interactiva (Mapa con caminos, árboles y río)"
            >
              <MapIcon className="h-3.5 w-3.5" />
              <span>Mapa</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                setViewMode("grid");
              }}
              className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 transition cursor-pointer ${
                viewMode === "grid"
                  ? "bg-[#314C3C] text-[#FFFDF8] shadow-[0_2px_0_#1A2B20]"
                  : "text-[#795548] hover:text-[#3A2E2B]"
              }`}
              title="Vista de Cuadrícula Accesible para lectura rápida"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Fichas</span>
            </button>
          </div>

          {/* Botón Mi Mundo / Configurar Habilidades (OakHaven 4.0) */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              setIsWorldCustomizationOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-2xl border-2 border-[#3A2E2B] bg-[#FDDA24] px-3 py-1.5 text-xs font-black text-[#3A2E2B] shadow-[0_2px_0_#3A2E2B] hover:bg-[#FDE24F] transition cursor-pointer"
            title="Personalizar qué habilidades están activas, en pausa o archivadas en tu pueblo"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-[#3A2E2B]" />
            Mi Mundo
          </button>

          {/* Botón Bitácora del Alcalde */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              setIsLedgerOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-2xl border-2 border-[#3A2E2B] bg-[#E7D69C] px-3 py-1.5 text-xs font-black text-[#3A2E2B] shadow-[0_2px_0_#3A2E2B] hover:bg-[#F2E3B3] transition cursor-pointer"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Bitácora
          </button>

          {/* Botón Diario de Misiones Vecinales */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              setIsQuestsOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-2xl border-2 border-[#3A2E2B] bg-[#77936A] px-3 py-1.5 text-xs font-black text-[#FFFDF8] shadow-[0_2px_0_#3A2E2B] hover:bg-[#68835B] transition cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Misiones
          </button>

          {/* Botón Censo de Vecinos / Compañeros */}
          {onOpenCompanions && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onOpenCompanions();
              }}
              className="inline-flex items-center gap-1.5 rounded-2xl border-2 border-[#3A2E2B] bg-[#E7D69C] px-3 py-1.5 text-xs font-black text-[#3A2E2B] shadow-[0_2px_0_#3A2E2B] hover:bg-[#F2E3B3] transition cursor-pointer"
              title="Abrir censo de residentes y compañeros de Oakhaven"
            >
              <span>👥</span>
              Vecinos ({COZY_VILLAGE_RESIDENTS.length})
            </button>
          )}

          {/* Selector de Clima / Atmósfera */}
          <div className="flex rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC] p-1 text-xs font-bold text-[#3A2E2B] shadow-[0_2px_0_#3A2E2B]">
            <button
              type="button"
              onClick={() => handleWeatherChange("sunny")}
              className={`rounded-xl px-2 py-1 transition cursor-pointer ${
                weather === "sunny" ? "bg-[#FFFDF8] shadow-sm text-amber-700 font-black" : "text-[#795548]"
              }`}
              title="Clima Soleado y Cálido"
            >
              ☀️ Sol
            </button>
            <button
              type="button"
              onClick={() => handleWeatherChange("rain")}
              className={`rounded-xl px-2 py-1 transition cursor-pointer ${
                weather === "rain" ? "bg-[#FFFDF8] shadow-sm text-cyan-800 font-black" : "text-[#795548]"
              }`}
              title="Lluvia Suave y Reconfortante"
            >
              🌧️ Lluvia
            </button>
            <button
              type="button"
              onClick={() => handleWeatherChange("autumn")}
              className={`rounded-xl px-2 py-1 transition cursor-pointer ${
                weather === "autumn" ? "bg-[#FFFDF8] shadow-sm text-amber-800 font-black" : "text-[#795548]"
              }`}
              title="Brisa de Otoño y Hojas Secas"
            >
              🍂 Otoño
            </button>
            <button
              type="button"
              onClick={() => handleWeatherChange("night")}
              className={`rounded-xl px-2 py-1 transition cursor-pointer ${
                weather === "night" ? "bg-[#181D2D] shadow-sm text-amber-200 font-black" : "text-[#795548]"
              }`}
              title="Noche Serena y Faroles Encendidos"
            >
              🌙 Noche
            </button>
          </div>

          {/* Toggle de Audio Cozy */}
          <button
            type="button"
            onClick={toggleSound}
            className={`inline-flex items-center gap-1.5 rounded-2xl border-2 border-[#3A2E2B] px-3 py-1.5 text-xs font-black shadow-[0_2px_0_#3A2E2B] transition cursor-pointer ${
              !isMuted
                ? "bg-[#314C3C] text-[#FFFDF8]"
                : "bg-[#F4EEDC] text-[#795548] hover:text-[#3A2E2B]"
            }`}
            title="Alternar paisajes sonoros generados con Web Audio API"
          >
            {!isMuted ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            <span>{!isMuted ? "Sonido Activo" : "Silencio"}</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          2. FILTROS DE DISTRITO
         ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-black uppercase text-[#795548] mr-1">
            Distritos:
          </span>
          {[
            { id: "all", label: "🏡 Todo el Pueblo" },
            { id: "plaza", label: "🏛️ Plaza & Gestión" },
            { id: "saber", label: "📚 Distrito del Saber" },
            { id: "artes", label: "🧶 Artes & Oficios" },
            { id: "naturaleza", label: "🌿 Naturaleza & Senderos" },
          ].map((dist) => (
            <button
              key={dist.id}
              type="button"
              onClick={() => {
                triggerHaptic("light");
                setSelectedDistrict(dist.id as BuildingDistrict | "all");
              }}
              className={`rounded-2xl border-2 border-[#3A2E2B] px-3 py-1 text-xs font-bold transition cursor-pointer ${
                selectedDistrict === dist.id
                  ? "bg-[#314C3C] text-[#FFFDF8] shadow-[0_2px_0_#1A2B20]"
                  : "bg-[#FFFDF8] text-[#3A2E2B] hover:bg-[#F4EEDC]"
              }`}
            >
              {dist.label}
            </button>
          ))}
        </div>

        <span className="text-xs font-bold text-[#795548]">
          Mostrando {filteredBuildings.length} de {VILLAGE_BUILDINGS_CATALOG.length} edificios
        </span>
      </div>

      {/* =========================================================================
          3. MODAL / DIÁLOGO DE RESIDENTE ACTIVO
         ========================================================================= */}
      {activeResidentDialogue && (
        <div className="relative rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_8px_0_#3A2E2B] animate-in fade-in slide-in-from-top-2 duration-300">
          <button
            type="button"
            onClick={() => setActiveResidentDialogue(null)}
            className="absolute top-4 right-4 text-xs font-black text-[#795548] hover:text-[#3A2E2B] cursor-pointer"
          >
            ✕ Cerrar
          </button>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-3 border-[#3A2E2B] bg-[#E7D69C] text-3xl shadow-[0_3px_0_#3A2E2B]">
              {activeResidentDialogue.avatar}
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="text-base font-black text-[#3A2E2B]">
                  {activeResidentDialogue.name}
                </h4>
                <span className="text-xs font-bold text-[#314C3C]">
                  • {activeResidentDialogue.title} ({activeResidentDialogue.species})
                </span>
              </div>
              <p className="text-xs italic text-[#795548]">
                "{activeResidentDialogue.greetingQuote}"
              </p>
              <p className="text-xs font-bold text-[#314C3C] pt-1">
                💬{" "}
                {activeResidentDialogue.getDynamicAdvice({
                  skillLevel:
                    skillSummaries.find((s) => s.domain === activeResidentDialogue.domain)?.level || 1,
                  sessionsCount:
                    skillSummaries.find((s) => s.domain === activeResidentDialogue.domain)?.sessions_count || 0,
                  lastSessionDetails: recentSessions.find((s) => s.domain === activeResidentDialogue.domain)?.details,
                })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onSelectResident && (
                <CozyButton
                  variant="sunlight"
                  size="sm"
                  onClick={() => {
                    const res = activeResidentDialogue;
                    setActiveResidentDialogue(null);
                    onSelectResident(res);
                  }}
                >
                  💬 Charlar a fondo
                </CozyButton>
              )}
              <CozyButton
                variant="forest"
                size="sm"
                onClick={() => {
                  onSelectBuilding(activeResidentDialogue.buildingId, activeResidentDialogue.domain);
                  setActiveResidentDialogue(null);
                }}
              >
                Entrar al Edificio ➜
              </CozyButton>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          4. VISTA 1: ESCENA PAISAJÍSTICA 2D INTERACTIVA (CÁMARA, ZOOM, ARRASTRE Y EDICIÓN)
         ========================================================================= */}
      {viewMode === "landscape" && (
        <InteractiveVillageScene
          buildings={filteredBuildings}
          skillSummaries={skillSummaries}
          recentSessions={recentSessions}
          activeBooksCount={activeBooksCount}
          activeKnittingProjectsCount={activeKnittingProjectsCount}
          rubikSolvesCount={rubikSolvesCount}
          weather={weather}
          ambientAnimEnabled={ambientAnimEnabled}
          hoveredBuildingId={hoveredBuildingId}
          setHoveredBuildingId={setHoveredBuildingId}
          selectedBuildingDetail={selectedBuildingDetail}
          onSelectBuildingDetail={setSelectedBuildingDetail}
          onEnterBuilding={onSelectBuilding}
          onSelectResident={(res) => {
            if (onSelectResident) {
              onSelectResident(res);
            } else {
              setActiveResidentDialogue(res);
            }
          }}
          isEditMode={isEditMode}
          setIsEditMode={setIsEditMode}
        />
      )}

      {/* =========================================================================
          5. VISTA 2: CUADRÍCULA ACCESIBLE / FICHAS DE EDIFICIOS (ACCESSIBLE GRID)
         ========================================================================= */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredBuildings.map((building) => {
            const skillSum = skillSummaries.find((s) => s.domain === building.domain);
            const resident = COZY_VILLAGE_RESIDENTS.find((r) => r.id === building.residentId);
            const buildingSessions = recentSessions.filter((s) => s.domain === building.domain);

            const tierInfo = calculateBuildingTier({
              level: skillSum?.level || 1,
              sessionsCount: skillSum?.sessions_count || buildingSessions.length,
              completedProjectsCount:
                building.domain === "knitting"
                  ? activeKnittingProjectsCount
                  : building.domain === "reading"
                  ? activeBooksCount
                  : 0,
            });

            const pending = building.getPendingActivity({
              skillSummary: skillSum,
              buildingSessions,
              activeBooksCount,
              activeKnittingProjectsCount,
              rubikSolvesCount,
            });

            return (
              <div
                key={building.id}
                className="flex flex-col justify-between rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] space-y-4 hover:-translate-y-1 transition duration-200"
              >
                <div>
                  <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/15 pb-2">
                    <span className="rounded-full bg-[#E7D69C] px-2 py-0.5 text-[9px] font-black text-[#3A2E2B] border border-[#3A2E2B]">
                      {tierInfo.badge}
                    </span>
                    <span className="text-[10px] font-bold text-[#795548]">
                      Nivel {skillSum?.level || 1} • {skillSum?.sessions_count || buildingSessions.length} sesiones
                    </span>
                  </div>

                  <div className="flex items-center gap-3 pt-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-3 border-[#3A2E2B] bg-[#F4EEDC] text-3xl shadow-[0_2px_0_#3A2E2B]">
                      {building.icon}
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-[#3A2E2B] leading-tight">
                        {building.name}
                      </h3>
                      <span className="text-[10px] font-bold text-[#314C3C]">
                        {building.tagline}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-[#795548] pt-2 line-clamp-2">
                    {building.description}
                  </p>

                  {pending.hasPending && (
                    <div className="mt-2 rounded-xl border border-[#E7D69C] bg-[#E7D69C]/25 px-2.5 py-1 text-[10px] font-black text-[#3A2E2B] flex items-center gap-1.5">
                      <span>⚡</span> {pending.label}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between border-t-2 border-[#3A2E2B]/15 pt-3">
                  <span className="text-xs font-black text-[#314C3C]">
                    +{skillSum?.total_gp_earned?.toLocaleString("es-CO") || 0} GP
                  </span>

                  <CozyButton
                    variant="forest"
                    size="sm"
                    onClick={() => onSelectBuilding(building.id, building.domain)}
                  >
                    Entrar al Edificio ➜
                  </CozyButton>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          6. MODAL DE INSPECCIÓN DE EDIFICIO SELECCIONADO (CON REGRESO AL PUEBLO)
         ========================================================================= */}
      {selectedBuildingDetail && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3A2E2B]/75 backdrop-blur-xs animate-in fade-in"
          onClick={() => setSelectedBuildingDetail(null)}
        >
          <div
            className="w-full max-w-lg rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-6 shadow-[0_12px_0_#3A2E2B] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/20 pb-2">
              <span className="text-xs font-black uppercase text-[#795548]">
                Inspección del Edificio
              </span>
              <button
                type="button"
                onClick={() => setSelectedBuildingDetail(null)}
                className="text-xs font-black text-[#795548] hover:text-[#3A2E2B] cursor-pointer"
              >
                ✕ Cerrar
              </button>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-3 border-[#3A2E2B] bg-[#E7D69C] text-4xl shadow-[0_3px_0_#3A2E2B]">
                {selectedBuildingDetail.icon}
              </div>
              <div>
                <h3 className="text-base font-black text-[#3A2E2B]">
                  {selectedBuildingDetail.name}
                </h3>
                <span className="text-xs font-bold text-[#314C3C]">
                  {selectedBuildingDetail.tagline}
                </span>
              </div>
            </div>

            <p className="text-xs text-[#5C4033] leading-relaxed">
              {selectedBuildingDetail.description}
            </p>

            <div className="rounded-2xl border-2 border-[#3A2E2B]/20 bg-[#F4EEDC] p-3 space-y-1 text-xs">
              <div className="flex justify-between font-bold text-[#795548]">
                <span>Distrito Comunitario:</span>
                <span className="capitalize font-black text-[#3A2E2B]">{selectedBuildingDetail.district}</span>
              </div>
              <div className="flex justify-between font-bold text-[#795548]">
                <span>Identificador Estable:</span>
                <span className="font-mono text-[#3A2E2B]">{selectedBuildingDetail.id}</span>
              </div>
              <div className="flex justify-between font-bold text-[#795548]">
                <span>Dominio Canónico:</span>
                <span className="font-mono text-[#314C3C]">{selectedBuildingDetail.domain}</span>
              </div>
            </div>

            {/* EVOLUCIÓN VISUAL ACTUAL DEL EDIFICIO (FASE 9) */}
            {(() => {
              const bTier = calculateBuildingTier({
                level: skillSummaries.find((s) => s.domain === selectedBuildingDetail.domain)?.level || 1,
                sessionsCount: skillSummaries.find((s) => s.domain === selectedBuildingDetail.domain)?.sessions_count || 0,
                completedProjectsCount:
                  selectedBuildingDetail.domain === "knitting"
                    ? activeKnittingProjectsCount
                    : selectedBuildingDetail.domain === "reading"
                    ? activeBooksCount
                    : 0,
              });
              return (
                <div className="rounded-2xl border-2 border-[#3A2E2B]/20 bg-[#EAF3ED] p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-[#314C3C] font-black uppercase text-[10px]">
                      Estado Visual Actual:
                    </span>
                    <span className="rounded-full bg-[#E7D69C] px-2 py-0.5 text-[9px] font-black text-[#3A2E2B] border border-[#3A2E2B]">
                      {bTier.badge} • {bTier.tierName}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#795548] italic">
                    {bTier.facadeDescription}
                  </p>
                  <div className="pt-1 flex flex-wrap gap-1">
                    {bTier.decorations.map((d, i) => (
                      <span key={i} className="rounded-md bg-[#FFFDF8] border border-[#3A2E2B]/20 px-1.5 py-0.5 text-[9px] font-medium text-[#314C3C]">
                        ✨ {d}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t-2 border-[#3A2E2B]/20">
              <CozyButton
                variant="wood"
                size="md"
                onClick={() => setSelectedBuildingDetail(null)}
              >
                ← Regresar al Mapa
              </CozyButton>

              <CozyButton
                variant="forest"
                size="md"
                onClick={() => {
                  const b = selectedBuildingDetail;
                  setSelectedBuildingDetail(null);
                  onSelectBuilding(b.id, b.domain);
                }}
              >
                Entrar al Taller ➜
              </CozyButton>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BITÁCORA DEL ALCALDE */}
      <MayorsLedgerModal
        isOpen={isLedgerOpen}
        onClose={() => setIsLedgerOpen(false)}
        skillSummaries={skillSummaries}
        recentSessions={recentSessions}
        activeBooksCount={activeBooksCount}
        activeKnittingProjectsCount={activeKnittingProjectsCount}
      />

      {/* MODAL DIARIO DE MISIONES VECINALES */}
      <VillageQuestsModal
        isOpen={isQuestsOpen}
        onClose={() => setIsQuestsOpen(false)}
        onOpenBuilding={onSelectBuilding}
        onSubmitSkillSession={onSubmitSkillSession || (async () => false)}
        skillSummaries={skillSummaries}
        recentSessions={recentSessions}
      />

      {/* MODAL MI MUNDO: GESTIÓN DE HABILIDADES (FASE 4.0) */}
      <WorldCustomizationModal
        isOpen={isWorldCustomizationOpen}
        onClose={() => setIsWorldCustomizationOpen(false)}
        config={worldConfig}
        onConfigChange={(newCfg) => setWorldConfig(newCfg)}
      />
    </div>
  );
}
