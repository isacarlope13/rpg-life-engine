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
} from "lucide-react";
import type { SkillDomain, SkillDomainSummary, SkillSessionRecord } from "@/types/rpg";
import {
  calculateBuildingTier,
  COZY_VILLAGE_RESIDENTS,
  type VillageResident,
  type BuildingVisualTier,
} from "@/lib/sanctuary/village-tiers";
import { cozySoundscape, type SoundscapeTheme } from "@/lib/sanctuary/cozy-soundscape";
import { MayorsLedgerModal } from "@/components/sanctuary/mayors-ledger-modal";
import { VillageQuestsModal } from "@/components/cozy/village-quests-modal";

interface CozyVillageMapProps {
  skillSummaries?: SkillDomainSummary[];
  recentSessions?: SkillSessionRecord[];
  activeBooksCount?: number;
  activeKnittingProjectsCount?: number;
  rubikSolvesCount?: number;
  onSelectBuilding: (buildingId: string, domain: SkillDomain) => void;
  onSelectResident?: (resident: VillageResident) => void;
  onSubmitSkillSession?: (payload: Record<string, unknown>) => Promise<boolean>;
}

interface MapBuildingItem {
  id: string;
  name: string;
  domain: SkillDomain;
  district: "artes" | "saber" | "naturaleza" | "plaza";
  icon: string;
  accentColor: string;
  borderColor: string;
  bgGradient: string;
  residentId: string;
}

const MAP_BUILDINGS: MapBuildingItem[] = [
  {
    id: "atelier",
    name: "El Atelier de Hilados",
    domain: "knitting",
    district: "artes",
    icon: "🧶",
    accentColor: "#E76F51",
    borderColor: "#C28448",
    bgGradient: "from-[#3A2E2B] to-[#251E1C]",
    residentId: "clara",
  },
  {
    id: "libreria",
    name: "La Librería & Archivo",
    domain: "reading",
    district: "saber",
    icon: "📚",
    accentColor: "#2A9D8F",
    borderColor: "#3D6652",
    bgGradient: "from-[#222E28] to-[#171F1B]",
    residentId: "eldrin",
  },
  {
    id: "biblioteca",
    name: "La Biblioteca del Erudito",
    domain: "study",
    district: "saber",
    icon: "🏛️",
    accentColor: "#6366F1",
    borderColor: "#4F46E5",
    bgGradient: "from-[#1E2436] to-[#121624]",
    residentId: "lyra",
  },
  {
    id: "club_puzzles",
    name: "Club de Puzzles WCA",
    domain: "rubik",
    district: "saber",
    icon: "🧩",
    accentColor: "#06B6D4",
    borderColor: "#0891B2",
    bgGradient: "from-[#162B34] to-[#0E1D24]",
    residentId: "milo",
  },
  {
    id: "observatorio",
    name: "El Observatorio Cósmico",
    domain: "general",
    district: "saber",
    icon: "🔭",
    accentColor: "#A855F7",
    borderColor: "#7E22CE",
    bgGradient: "from-[#281834] to-[#190F22]",
    residentId: "aura",
  },
  {
    id: "pabellon_gardening",
    name: "Invernadero Botánico",
    domain: "gardening",
    district: "naturaleza",
    icon: "🌿",
    accentColor: "#4E6E58",
    borderColor: "#38523F",
    bgGradient: "from-[#1F2C23] to-[#141E17]",
    residentId: "barnaby",
  },
  {
    id: "pabellon_hiking",
    name: "Puesto de Senderismo",
    domain: "hiking",
    district: "naturaleza",
    icon: "🥾",
    accentColor: "#D4A373",
    borderColor: "#8C5835",
    bgGradient: "from-[#35251C] to-[#201610]",
    residentId: "tara",
  },
  {
    id: "cocina",
    name: "Cocina & Fogones de Oakhaven",
    domain: "cooking",
    district: "artes",
    icon: "🍳",
    accentColor: "#E76F51",
    borderColor: "#C46A36",
    bgGradient: "from-[#35251C] to-[#20150F]",
    residentId: "oliver",
  },
  {
    id: "oficina",
    name: "Núcleo de Gestión & Proyectos",
    domain: "work",
    district: "plaza",
    icon: "💼",
    accentColor: "#4361EE",
    borderColor: "#3046C4",
    bgGradient: "from-[#1C2338] to-[#101524]",
    residentId: "aura",
  },
];

export type VillageWeather = "sunny" | "rain" | "autumn" | "night";

export function CozyVillageMap({
  skillSummaries = [],
  recentSessions = [],
  activeBooksCount = 0,
  activeKnittingProjectsCount = 0,
  rubikSolvesCount = 0,
  onSelectBuilding,
  onSelectResident,
  onSubmitSkillSession,
}: CozyVillageMapProps) {
  const [ambientAnimEnabled, setAmbientAnimEnabled] = useState(true);
  const [weather, setWeather] = useState<VillageWeather>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("oakhaven_weather_pref") as VillageWeather | null;
      if (saved && ["sunny", "rain", "autumn", "night"].includes(saved)) {
        return saved;
      }
    }
    return "sunny";
  });
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("oakhaven_sound_muted_pref");
      if (saved !== null) {
        return saved === "true";
      }
    }
    return true;
  });
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [isQuestsOpen, setIsQuestsOpen] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState<"all" | "artes" | "saber" | "naturaleza">("all");
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
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("oakhaven_weather_pref", newWeather);
      } catch {}
    }
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
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("oakhaven_sound_muted_pref", String(nextMuted));
      } catch {}
    }
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
  const filteredBuildings = MAP_BUILDINGS.filter(
    (b) => selectedDistrict === "all" || b.district === selectedDistrict
  );

  return (
    <div className="space-y-6">
      {/* CABECERA DEL MAPA & CONTROL DE AMBIENTACIÓN */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border-3 border-[#5C4033] bg-[#F7F4EB] p-4 sm:p-5 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[#5C4033] bg-[#E9C46A]/30 text-2xl shadow-inner">
            🗺️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black tracking-tight text-[#3A2E2B]">
                Pueblo Vivo de Oakhaven
              </h2>
              <span className="rounded-full bg-[#4E6E58]/20 border border-[#4E6E58]/40 px-2.5 py-0.5 text-[10px] font-extrabold text-[#4E6E58]">
                ⭐ 5.0 Estrellas Comunitarias
              </span>
            </div>
            <p className="text-xs text-[#7A6B62]">
              Cada edificio evoluciona visualmente con tus sesiones reales de práctica, lectura y trabajo.
            </p>
          </div>
        </div>

        {/* CONTROLES GLOBALES DEL PUEBLO */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Botón Bitácora del Alcalde */}
          <button
            type="button"
            onClick={() => setIsLedgerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#5C4033] bg-[#E9C46A] px-3 py-1.5 text-xs font-black text-[#3A2E2B] shadow-sm hover:bg-[#F4A261] transition cursor-pointer"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Bitácora del Alcalde
          </button>

          {/* Botón Diario de Misiones Vecinales */}
          <button
            type="button"
            onClick={() => setIsQuestsOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#5C4033] bg-[#88A98E] px-3 py-1.5 text-xs font-black text-[#1E1B18] shadow-sm hover:bg-[#97B89D] transition cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Diario de Misiones
          </button>

          {/* Selector de Clima / Atmósfera */}
          <div className="flex rounded-xl border-2 border-[#5C4033] bg-[#EBE5D8] p-1 text-xs font-bold text-[#3A2E2B]">
            <button
              type="button"
              onClick={() => handleWeatherChange("sunny")}
              title="Día Radiante"
              className={`rounded-lg px-2 py-1 transition cursor-pointer ${
                weather === "sunny" ? "bg-[#E9C46A] text-[#3A2E2B] font-black shadow-sm" : "hover:text-[#4E6E58]"
              }`}
            >
              ☀️ Día
            </button>
            <button
              type="button"
              onClick={() => handleWeatherChange("rain")}
              title="Lluvia Suave"
              className={`rounded-lg px-2 py-1 transition cursor-pointer ${
                weather === "rain" ? "bg-[#5B8296] text-[#F7F4EB] font-black shadow-sm" : "hover:text-[#4E6E58]"
              }`}
            >
              🌧️ Lluvia
            </button>
            <button
              type="button"
              onClick={() => handleWeatherChange("autumn")}
              title="Tarde Otoñal"
              className={`rounded-lg px-2 py-1 transition cursor-pointer ${
                weather === "autumn" ? "bg-[#C46A36] text-[#F7F4EB] font-black shadow-sm" : "hover:text-[#4E6E58]"
              }`}
            >
              🍂 Otoño
            </button>
            <button
              type="button"
              onClick={() => handleWeatherChange("night")}
              title="Noche Estrellada"
              className={`rounded-lg px-2 py-1 transition cursor-pointer ${
                weather === "night" ? "bg-[#252844] text-[#F7F4EB] font-black shadow-sm" : "hover:text-[#4E6E58]"
              }`}
            >
              🌌 Noche
            </button>
          </div>

          {/* Toggle de Audio Paisaje Sonoro */}
          <button
            type="button"
            onClick={toggleSound}
            className={`inline-flex items-center gap-1.5 rounded-xl border-2 border-[#5C4033] px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              !isMuted
                ? "bg-[#4E6E58] text-[#F7F4EB] shadow-inner"
                : "bg-[#EBE5D8] text-[#7A6B62]"
            }`}
            title={isMuted ? "Activar paisaje sonoro relajante" : "Silenciar audio"}
          >
            {!isMuted ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            {!isMuted ? "Audio Cozy" : "Silenciado"}
          </button>

          {/* Toggle de Brisa / Animación */}
          <button
            type="button"
            onClick={() => setAmbientAnimEnabled(!ambientAnimEnabled)}
            className={`inline-flex items-center gap-1.5 rounded-xl border-2 border-[#5C4033] px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              ambientAnimEnabled
                ? "bg-[#88A98E]/30 text-[#2A4331]"
                : "bg-[#EBE5D8] text-[#7A6B62]"
            }`}
            title="Alternar animaciones ambientales y brisa"
          >
            <TreePine className="h-3.5 w-3.5" />
            {ambientAnimEnabled ? "Brisa" : "Quieto"}
          </button>
        </div>
      </div>

      {/* FILTROS DE DISTRITO */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        <span className="text-xs font-black uppercase text-[#5C4033]">Distritos:</span>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedDistrict("all")}
            className={`rounded-xl border-2 border-[#5C4033] px-3 py-1 text-xs font-bold transition cursor-pointer ${
              selectedDistrict === "all" ? "bg-[#4E6E58] text-[#F7F4EB]" : "bg-[#EBE5D8] text-[#3A2E2B] hover:bg-[#DED7C8]"
            }`}
          >
            🏡 Todo el Pueblo
          </button>
          <button
            type="button"
            onClick={() => setSelectedDistrict("saber")}
            className={`rounded-xl border-2 border-[#5C4033] px-3 py-1 text-xs font-bold transition cursor-pointer ${
              selectedDistrict === "saber" ? "bg-[#4E6E58] text-[#F7F4EB]" : "bg-[#EBE5D8] text-[#3A2E2B] hover:bg-[#DED7C8]"
            }`}
          >
            🏛️ Distrito del Saber
          </button>
          <button
            type="button"
            onClick={() => setSelectedDistrict("artes")}
            className={`rounded-xl border-2 border-[#5C4033] px-3 py-1 text-xs font-bold transition cursor-pointer ${
              selectedDistrict === "artes" ? "bg-[#4E6E58] text-[#F7F4EB]" : "bg-[#EBE5D8] text-[#3A2E2B] hover:bg-[#DED7C8]"
            }`}
          >
            🧶 Artes & Oficios
          </button>
          <button
            type="button"
            onClick={() => setSelectedDistrict("naturaleza")}
            className={`rounded-xl border-2 border-[#5C4033] px-3 py-1 text-xs font-bold transition cursor-pointer ${
              selectedDistrict === "naturaleza" ? "bg-[#4E6E58] text-[#F7F4EB]" : "bg-[#EBE5D8] text-[#3A2E2B] hover:bg-[#DED7C8]"
            }`}
          >
            🌿 Naturaleza
          </button>
        </div>
      </div>

      {/* DIÁLOGO FLOTANTE DE RESIDENTE ACTIVO */}
      {activeResidentDialogue && (
        <div className="relative rounded-3xl border-3 border-[#5C4033] bg-[#FFFBF2] p-5 shadow-xl animate-in fade-in slide-in-from-top-2 duration-300">
          <button
            type="button"
            onClick={() => setActiveResidentDialogue(null)}
            className="absolute top-4 right-4 text-xs font-bold text-[#8C7A6B] hover:text-[#3A2E2B] cursor-pointer"
          >
            ✕ Cerrar
          </button>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-[#5C4033] bg-[#E9C46A]/20 text-3xl shadow-md">
              {activeResidentDialogue.avatar}
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="text-base font-black text-[#3A2E2B]">
                  {activeResidentDialogue.name}
                </h4>
                <span className="text-xs font-bold text-[#4E6E58]">
                  • {activeResidentDialogue.title} ({activeResidentDialogue.species})
                </span>
              </div>
              <p className="text-xs italic text-[#5C4033]">
                "{activeResidentDialogue.greetingQuote}"
              </p>
              <p className="text-xs font-medium text-[#2E3D31] pt-1">
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
                <button
                  type="button"
                  onClick={() => {
                    const res = activeResidentDialogue;
                    setActiveResidentDialogue(null);
                    onSelectResident(res);
                  }}
                  className="rounded-2xl border-2 border-[#3A2E2B] bg-[#E9C46A] px-3.5 py-2 text-xs font-black text-[#3A2E2B] shadow-sm hover:bg-[#F4A261] transition cursor-pointer"
                >
                  💬 Charlar a fondo & Micro-Misión
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onSelectBuilding(activeResidentDialogue.buildingId, activeResidentDialogue.domain);
                  setActiveResidentDialogue(null);
                }}
                className="rounded-2xl border-2 border-[#5C4033] bg-[#4E6E58] px-4 py-2 text-xs font-black text-[#F7F4EB] shadow-md hover:bg-[#3D5645] cursor-pointer"
              >
                Entrar al Edificio de {activeResidentDialogue.name} ➜
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PLANO DEL PUEBLO (BENTO GRID CON ESTÉTICA DE MAPA COZY Y CLIMA DINÁMICO) */}
      <div
        className={`relative rounded-3xl border-3 border-[#5C4033] p-5 sm:p-7 shadow-2xl overflow-hidden transition-colors duration-700 ${
          weather === "sunny"
            ? "bg-[#EFEAD8]"
            : weather === "rain"
            ? "bg-[#DDE3E7]"
            : weather === "autumn"
            ? "bg-[#EBDDC8]"
            : "bg-[#181D2D]"
        }`}
      >
        {/* Decoraciones ambientales y climáticas de fondo */}
        {ambientAnimEnabled && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden select-none">
            {weather === "sunny" && (
              <div className="opacity-20">
                <div className="absolute top-4 left-10 text-4xl animate-bounce duration-1000">🍃</div>
                <div className="absolute top-16 right-20 text-3xl animate-pulse">☀️</div>
                <div className="absolute bottom-10 left-1/3 text-3xl animate-bounce">✨</div>
                <div className="absolute bottom-8 right-12 text-2xl">🌿</div>
              </div>
            )}
            {weather === "rain" && (
              <div className="opacity-30">
                <div className="absolute top-2 left-8 text-2xl animate-pulse">🌧️</div>
                <div className="absolute top-12 left-1/4 text-xl">💧</div>
                <div className="absolute top-24 right-16 text-3xl animate-pulse">🌧️</div>
                <div className="absolute top-36 right-1/3 text-xl">💧</div>
                <div className="absolute bottom-12 left-12 text-2xl">🌱</div>
              </div>
            )}
            {weather === "autumn" && (
              <div className="opacity-25">
                <div className="absolute top-6 left-12 text-3xl animate-bounce">🍂</div>
                <div className="absolute top-14 right-24 text-4xl">🍁</div>
                <div className="absolute bottom-12 left-1/2 text-3xl animate-bounce">🍂</div>
                <div className="absolute bottom-6 right-16 text-2xl">🌰</div>
              </div>
            )}
            {weather === "night" && (
              <div className="opacity-40">
                <div className="absolute top-4 right-14 text-3xl animate-pulse">🌙</div>
                <div className="absolute top-10 left-16 text-2xl animate-ping duration-1000">✨</div>
                <div className="absolute top-28 left-1/3 text-xl">⭐</div>
                <div className="absolute bottom-14 right-1/4 text-2xl">✨</div>
                <div className="absolute bottom-8 left-20 text-xl animate-pulse">🌌</div>
              </div>
            )}
          </div>
        )}

        {/* REJILLA DE EDIFICIOS */}
        <div className="relative z-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {filteredBuildings.map((building) => {
            const skillSum = skillSummaries.find((s) => s.domain === building.domain);
            const resident = COZY_VILLAGE_RESIDENTS.find((r) => r.id === building.residentId);
            const buildingSessions = recentSessions.filter((s) => s.domain === building.domain);

            // Cálculo puro del Tier Visual
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

            const isTier3 = tierInfo.tier === 3;
            const isTier2 = tierInfo.tier === 2;

            return (
              <div
                key={building.id}
                className={`group relative flex flex-col justify-between rounded-3xl p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                  isTier3
                    ? "border-4 border-[#E7D69C] shadow-[0_6px_0_#3A2E2B] ring-2 ring-[#E7D69C]/30"
                    : isTier2
                    ? "border-3 border-[#77936A] shadow-[0_5px_0_#3A2E2B]"
                    : "border-3 border-[#5C4033] shadow-[0_3px_0_#3A2E2B]"
                } ${
                  weather === "night"
                    ? "bg-[#252A3E] text-[#F7F4EB] hover:border-[#E9C46A]"
                    : "bg-[#FFFBF2] text-[#3A2E2B] hover:border-[#3A2E2B]"
                }`}
              >
                <div>
                  {/* Etiqueta de Distrito y Tier Visual */}
                  <div
                    className={`flex items-center justify-between gap-1 border-b-2 pb-2.5 mb-3 ${
                      weather === "night" ? "border-amber-500/20" : "border-[#5C4033]/20"
                    }`}
                  >
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                        isTier3
                          ? "bg-[#E7D69C] text-[#3A2E2B] border border-[#3A2E2B] shadow-sm"
                          : isTier2
                          ? "bg-[#77936A]/20 text-[#314C3C] border border-[#77936A]"
                          : "bg-[#D8B48A]/30 text-[#3A2E2B] border border-[#5C4033]/30"
                      }`}
                    >
                      {tierInfo.badge}
                    </span>
                    <span
                      className={`text-[10px] font-bold ${
                        weather === "night" ? "text-amber-200/70" : "text-[#8C7A6B]"
                      }`}
                    >
                      Nivel {skillSum?.level || 1} • {skillSum?.sessions_count || buildingSessions.length} sesiones
                    </span>
                  </div>

                  {/* FACHADA VISUAL DEL EDIFICIO */}
                  <div
                    className={`relative flex flex-col items-center justify-center rounded-2xl border-2 ${
                      isTier3
                        ? "border-[#E7D69C] shadow-lg shadow-[#E7D69C]/10"
                        : weather === "night"
                        ? "border-amber-500/40 shadow-amber-500/10 shadow-lg"
                        : "border-[#5C4033]"
                    } bg-gradient-to-b ${building.bgGradient} p-4 text-center shadow-inner`}
                  >
                    {isTier3 && (
                      <span className="absolute -top-2.5 left-3 rounded-full border border-[#3A2E2B] bg-[#E7D69C] px-2 py-0.2 text-[9px] font-black text-[#3A2E2B] shadow-sm">
                        ⭐ Cúpula de Maestría
                      </span>
                    )}
                    {isTier2 && (
                      <span className="absolute -top-2.5 left-3 rounded-full border border-[#77936A] bg-[#EAF3ED] px-2 py-0.2 text-[9px] font-bold text-[#314C3C]">
                        🌿 Taller Establecido
                      </span>
                    )}

                    <span className="text-4xl filter drop-shadow group-hover:scale-110 transition-transform duration-300">
                      {building.icon}
                    </span>
                    <span className="mt-2 text-xs font-black text-[#F7F4EB]">
                      {building.name}
                    </span>
                    <span className="text-[10px] text-amber-200/90 font-medium">
                      {tierInfo.tierName}
                    </span>

                    {/* Residente Asistente junto a la puerta */}
                    {resident && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectResident) {
                            onSelectResident(resident);
                          } else {
                            setActiveResidentDialogue(resident);
                          }
                        }}
                        className="absolute -bottom-2.5 -right-2.5 flex h-9 w-9 items-center justify-center rounded-full border-3 border-[#3A2E2B] bg-[#FFFBF2] text-base shadow-[0_2px_0_#3A2E2B] hover:scale-115 transition cursor-pointer"
                        title={`Hablar con ${resident.name} (${resident.species})`}
                      >
                        {resident.avatar}
                      </button>
                    )}
                  </div>

                  {/* DESCRIPCIÓN EVOLUTIVA */}
                  <div className="mt-3 space-y-1.5 text-left">
                    <p
                      className={`text-[11px] font-medium line-clamp-2 ${
                        weather === "night" ? "text-gray-300" : "text-[#7A6B62]"
                      }`}
                    >
                      {tierInfo.facadeDescription}
                    </p>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {tierInfo.decorations.slice(0, 2).map((dec, i) => (
                        <span
                          key={i}
                          className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
                            weather === "night"
                              ? "bg-slate-800 text-amber-200/90 border border-slate-700"
                              : "bg-[#EBE5D8] text-[#5C4033]"
                          }`}
                        >
                          ✓ {dec}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* BOTÓN PARA ENTRAR A LA SESIÓN */}
                <div
                  className={`pt-4 border-t-2 mt-4 flex items-center justify-between ${
                    weather === "night" ? "border-amber-500/20" : "border-[#5C4033]/20"
                  }`}
                >
                  <span
                    className={`text-[10px] font-extrabold ${
                      weather === "night" ? "text-emerald-400" : "text-[#4E6E58]"
                    }`}
                  >
                    +{skillSum?.total_gp_earned ? skillSum.total_gp_earned.toLocaleString("es-CO") : "0"} GP
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectBuilding(building.id, building.domain)}
                    className="inline-flex items-center gap-1 rounded-xl border-2 border-[#5C4033] bg-[#E9C46A] px-3 py-1.5 text-xs font-black text-[#3A2E2B] shadow-sm hover:bg-[#F4A261] transition cursor-pointer"
                  >
                    Entrar ➜
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
