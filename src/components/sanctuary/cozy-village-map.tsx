"use client";

import React, { useState, useEffect } from "react";
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
import { cozySoundscape, type SoundscapeTheme } from "@/lib/sanctuary/cozy-soundscape";
import { MayorsLedgerModal } from "@/components/sanctuary/mayors-ledger-modal";
import { VillageQuestsModal } from "@/components/cozy/village-quests-modal";
import { VillagePixelBuilding } from "@/components/cozy/village-pixel-building";
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

  // Filtrado de edificios por distrito
  const filteredBuildings = filterBuildingsByDistrict(selectedDistrict);

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
          4. VISTA 1: MAPA PAISAJÍSTICO INTERACTIVO (TERRENO, RÍO, CAMINOS, ARBOLEDAS)
         ========================================================================= */}
      {viewMode === "landscape" && (
        <div
          className={`relative rounded-3xl border-4 border-[#3A2E2B] shadow-[0_12px_0_#3A2E2B] overflow-hidden transition-colors duration-700 min-h-[580px] sm:min-h-[660px] select-none ${
            weather === "sunny"
              ? "bg-[#C4DC9C]"
              : weather === "rain"
              ? "bg-[#9FB2A8]"
              : weather === "autumn"
              ? "bg-[#D8B48A]"
              : "bg-[#18212D]"
          }`}
        >
          {/* ===================================================================
              CANVAS SVG DEL TERRENO: CAMINOS, AGUA, PUENTE, HUERTOS & VEGETACIÓN
             =================================================================== */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 1000 650"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              {/* Patrón empedrado para los caminos */}
              <pattern id="cobblestone" width="16" height="16" patternUnits="userSpaceOnUse">
                <rect width="16" height="16" fill="#D8B48A" opacity="0.9" />
                <path d="M 0 8 L 16 8 M 8 0 L 8 8 M 0 16 L 16 16 M 16 8 L 16 16" stroke="#8C6239" strokeWidth="1" opacity="0.3" />
              </pattern>

              {/* Filtro de sombra suave pixel */}
              <filter id="pixelDrop" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="4" stdDeviation="0" floodColor="#3A2E2B" floodOpacity="0.8" />
              </filter>
            </defs>

            {/* 1. TERRENO: Colinas del Norte (Observatorio) */}
            <path
              d="M 0 0 L 1000 0 L 1000 200 C 750 240, 500 180, 250 240 L 0 200 Z"
              fill={weather === "night" ? "#121924" : weather === "autumn" ? "#C69C72" : "#9FB882"}
              opacity="0.8"
            />

            {/* 2. RÍO SERPENTEANTE & ESTANQUE */}
            <g>
              {/* Lecho del río */}
              <path
                d="M 920 0 C 880 180, 780 240, 680 340 C 600 420, 560 520, 520 650 L 590 650 C 630 530, 680 440, 750 360 C 840 260, 950 180, 990 0 Z"
                fill={weather === "night" ? "#1B3B4B" : "#7BA7BC"}
                stroke="#3A2E2B"
                strokeWidth="3"
              />
              {/* Ondas en el agua */}
              {ambientAnimEnabled && (
                <>
                  <path d="M 720 280 Q 730 275, 740 280" stroke="#FFFDF8" strokeWidth="2" strokeLinecap="round" opacity="0.7" fill="none" />
                  <path d="M 640 400 Q 650 395, 660 400" stroke="#FFFDF8" strokeWidth="2" strokeLinecap="round" opacity="0.7" fill="none" />
                  <path d="M 560 550 Q 570 545, 580 550" stroke="#FFFDF8" strokeWidth="2" strokeLinecap="round" opacity="0.7" fill="none" />
                </>
              )}
            </g>

            {/* 3. CAMINOS EMPEDRADOS CONECTIVOS (Cobblestone Paths) */}
            <g stroke="#3A2E2B" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" fill="none">
              {/* Eje Vertical Principal: Observatorio -> Plaza -> Cocina */}
              <path d="M 500 120 L 500 520" />
              {/* Eje Horizontal Norte: Librería -> Plaza -> Biblioteca */}
              <path d="M 260 210 Q 380 240, 500 300 Q 620 240, 740 200" />
              {/* Eje Horizontal Centro: Atelier -> Plaza -> Club Puzzles (con puente sobre río) */}
              <path d="M 200 360 L 500 300 L 710 320" />
              <path d="M 750 330 L 800 360" />
              {/* Ramal Sur: Plaza -> Invernadero Botánico */}
              <path d="M 500 360 Q 400 440, 300 510" />
              {/* Ramal Sur-Este (hacia Puesto de Senderismo cruzando el río) */}
              <path d="M 500 400 Q 580 440, 680 460" />
              <path d="M 740 480 L 770 500" />
            </g>

            {/* Capa superior de camino con textura clara */}
            <g stroke="#D8B48A" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" fill="none">
              <path d="M 500 120 L 500 520" />
              <path d="M 260 210 Q 380 240, 500 300 Q 620 240, 740 200" />
              <path d="M 200 360 L 500 300 L 710 320" />
              <path d="M 750 330 L 800 360" />
              <path d="M 500 360 Q 400 440, 300 510" />
              <path d="M 500 400 Q 580 440, 680 460" />
              <path d="M 740 480 L 770 500" />
            </g>

            {/* 4. PUENTES DE MADERA SOBRE EL RÍO */}
            {/* Puente Norte (hacia Club de Puzzles) */}
            <g filter="url(#pixelDrop)">
              <rect x="705" y="315" width="45" height="28" rx="4" fill="#A06A42" stroke="#3A2E2B" strokeWidth="2.5" />
              <line x1="714" y1="315" x2="714" y2="343" stroke="#5C381E" strokeWidth="2" />
              <line x1="727" y1="315" x2="727" y2="343" stroke="#5C381E" strokeWidth="2" />
              <line x1="740" y1="315" x2="740" y2="343" stroke="#5C381E" strokeWidth="2" />
            </g>

            {/* Puente Sur (hacia Refugio de Senderismo) */}
            <g filter="url(#pixelDrop)">
              <rect x="675" y="455" width="55" height="32" rx="4" fill="#A06A42" stroke="#3A2E2B" strokeWidth="2.5" />
              <line x1="685" y1="455" x2="685" y2="487" stroke="#5C381E" strokeWidth="2" />
              <line x1="702" y1="455" x2="702" y2="487" stroke="#5C381E" strokeWidth="2" />
              <line x1="718" y1="455" x2="718" y2="487" stroke="#5C381E" strokeWidth="2" />
            </g>

            {/* 5. PLAZA CENTRAL DEL PUEBLO (Adoquines & Fuente) */}
            <g filter="url(#pixelDrop)">
              <circle cx="500" cy="300" r="45" fill="#E7D69C" stroke="#3A2E2B" strokeWidth="3" />
              {/* Fuente de agua / Pozo de piedra central */}
              <circle cx="500" cy="300" r="22" fill="#7BA7BC" stroke="#3A2E2B" strokeWidth="3" />
              <circle cx="500" cy="300" r="10" fill="#FFFDF8" stroke="#3A2E2B" strokeWidth="1.5" />
            </g>

            {/* 6. ARBOLEDAS DE PINO & ROBLE DECORATIVAS (Bosques) */}
            {/* Arboleda Noroeste */}
            <g fill={weather === "night" ? "#1B2A1E" : "#314C3C"} stroke="#3A2E2B" strokeWidth="2">
              <polygon points="100,100 120,60 140,100" />
              <polygon points="105,80 120,45 135,80" />
              <polygon points="60,140 80,100 100,140" />
              <polygon points="140,150 160,110 180,150" />
            </g>

            {/* Arboleda Noreste */}
            <g fill={weather === "night" ? "#1B2A1E" : "#314C3C"} stroke="#3A2E2B" strokeWidth="2">
              <polygon points="860,120 880,80 900,120" />
              <polygon points="900,160 920,115 940,160" />
              <polygon points="840,170 860,130 880,170" />
            </g>

            {/* Arboleda Suroeste */}
            <g fill={weather === "night" ? "#1B2A1E" : "#43664F"} stroke="#3A2E2B" strokeWidth="2">
              <polygon points="80,520 100,470 120,520" />
              <polygon points="120,550 140,500 160,550" />
              <polygon points="50,570 70,520 90,570" />
            </g>

            {/* 7. FAROLES DE HIERRO CON HALO NOCTURNO */}
            {weather === "night" && (
              <g>
                <circle cx="450" cy="270" r="30" fill="#E7D69C" opacity="0.25" />
                <circle cx="550" cy="270" r="30" fill="#E7D69C" opacity="0.25" />
                <circle cx="450" cy="330" r="30" fill="#E7D69C" opacity="0.25" />
                <circle cx="550" cy="330" r="30" fill="#E7D69C" opacity="0.25" />
              </g>
            )}
          </svg>

          {/* EFECTOS CLIMÁTICOS FLOTANTES */}
          {ambientAnimEnabled && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden select-none">
              {weather === "sunny" && (
                <div className="opacity-25">
                  <div className="absolute top-4 left-10 text-3xl animate-bounce duration-1000">🍃</div>
                  <div className="absolute top-12 right-24 text-3xl animate-pulse">☀️</div>
                  <div className="absolute bottom-16 left-1/4 text-2xl animate-bounce">✨</div>
                </div>
              )}
              {weather === "rain" && (
                <div className="opacity-40">
                  <div className="absolute top-4 left-12 text-2xl animate-pulse">🌧️</div>
                  <div className="absolute top-20 right-32 text-2xl animate-pulse">🌧️</div>
                  <div className="absolute bottom-16 left-1/3 text-xl">💧</div>
                </div>
              )}
              {weather === "autumn" && (
                <div className="opacity-30">
                  <div className="absolute top-6 left-16 text-3xl animate-bounce">🍂</div>
                  <div className="absolute top-14 right-20 text-3xl">🍁</div>
                  <div className="absolute bottom-10 left-1/2 text-2xl animate-bounce">🍂</div>
                </div>
              )}
              {weather === "night" && (
                <div className="opacity-50">
                  <div className="absolute top-4 right-16 text-3xl animate-pulse">🌙</div>
                  <div className="absolute top-10 left-20 text-2xl animate-ping duration-1000">✨</div>
                  <div className="absolute top-24 left-1/3 text-xl">⭐</div>
                  <div className="absolute bottom-16 right-1/4 text-xl">✨</div>
                </div>
              )}
            </div>
          )}

          {/* ===================================================================
              EDIFICIOS INTERACTIVOS POSICIONADOS EN EL PAISAJE (9 EDIFICIOS)
             =================================================================== */}
          <div className="relative z-10 w-full h-[580px] sm:h-[660px]">
            {filteredBuildings.map((building) => {
              const skillSum = skillSummaries.find((s) => s.domain === building.domain);
              const resident = COZY_VILLAGE_RESIDENTS.find((r) => r.id === building.residentId);
              const buildingSessions = recentSessions.filter((s) => s.domain === building.domain);

              // Cálculo de Tier Visual puro
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

              // Detección de actividad pendiente real
              const pending = building.getPendingActivity({
                skillSummary: skillSum,
                buildingSessions,
                activeBooksCount,
                activeKnittingProjectsCount,
                rubikSolvesCount,
              });

              const isHovered = hoveredBuildingId === building.id;

              return (
                <div
                  key={building.id}
                  style={{
                    position: "absolute",
                    left: `${building.mapCoordinates.x}%`,
                    top: `${building.mapCoordinates.y}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                  className="group flex flex-col items-center"
                  onMouseEnter={() => setHoveredBuildingId(building.id)}
                  onMouseLeave={() => setHoveredBuildingId(null)}
                >
                  {/* EDIFICIO PIXEL ART DEL MAPA DE OAKHAVEN */}
                  <VillagePixelBuilding
                    building={building}
                    tierInfo={tierInfo}
                    pending={pending}
                    resident={resident}
                    isHovered={isHovered}
                    onInspect={() => setSelectedBuildingDetail(building)}
                    onEnter={() => onSelectBuilding(building.id, building.domain)}
                    onSelectResident={(res) => {
                      if (onSelectResident) {
                        onSelectResident(res);
                      } else {
                        setActiveResidentDialogue(res);
                      }
                    }}
                  />

                  {/* TOOLTIP RÁPIDO EN HOVER */}
                  {isHovered && (
                    <div className="absolute bottom-full mb-3 z-30 w-52 rounded-2xl border-3 border-[#3A2E2B] bg-[#FFFDF8] p-3 shadow-[0_6px_0_#3A2E2B] animate-in fade-in zoom-in-95 text-left space-y-1.5 pointer-events-none">
                      <div className="flex items-center justify-between border-b border-[#3A2E2B]/20 pb-1">
                        <span className="text-[10px] font-black text-[#314C3C] uppercase">
                          {building.district}
                        </span>
                        <span className="text-[9px] font-bold text-[#795548]">
                          Nivel {skillSum?.level || 1}
                        </span>
                      </div>
                      <h4 className="text-xs font-black text-[#3A2E2B] leading-tight">
                        {building.name}
                      </h4>
                      <p className="text-[10px] text-[#795548] line-clamp-2">
                        {building.tagline}
                      </p>
                      <div className="pt-1 flex items-center justify-between text-[9px] font-black text-[#314C3C]">
                        <span>+{skillSum?.total_gp_earned?.toLocaleString("es-CO") || 0} GP</span>
                        <span className="text-amber-800">Clic para entrar ➜</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
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
    </div>
  );
}
