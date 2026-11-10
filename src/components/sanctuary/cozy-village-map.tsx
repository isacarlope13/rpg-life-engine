"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import type { SkillDomain, SkillDomainSummary, SkillSessionRecord } from "@/types/rpg";
import {
  calculateBuildingTier,
  COZY_VILLAGE_RESIDENTS,
  type VillageResident,
  type BuildingVisualTier,
} from "@/lib/sanctuary/village-tiers";

interface CozyVillageMapProps {
  skillSummaries?: SkillDomainSummary[];
  recentSessions?: SkillSessionRecord[];
  activeBooksCount?: number;
  activeKnittingProjectsCount?: number;
  rubikSolvesCount?: number;
  onSelectBuilding: (buildingId: string, domain: SkillDomain) => void;
  onSelectResident?: (resident: VillageResident) => void;
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

export function CozyVillageMap({
  skillSummaries = [],
  recentSessions = [],
  activeBooksCount = 0,
  activeKnittingProjectsCount = 0,
  rubikSolvesCount = 0,
  onSelectBuilding,
  onSelectResident,
}: CozyVillageMapProps) {
  const [ambientAnimEnabled, setAmbientAnimEnabled] = useState(true);
  const [selectedDistrict, setSelectedDistrict] = useState<"all" | "artes" | "saber" | "naturaleza">("all");
  const [activeResidentDialogue, setActiveResidentDialogue] = useState<VillageResident | null>(null);

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

        {/* CONTROLES Y FILTROS DE DISTRITO */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border-2 border-[#5C4033] bg-[#EBE5D8] p-1 text-xs font-bold text-[#3A2E2B]">
            <button
              type="button"
              onClick={() => setSelectedDistrict("all")}
              className={`rounded-lg px-2.5 py-1 transition cursor-pointer ${
                selectedDistrict === "all" ? "bg-[#4E6E58] text-[#F7F4EB]" : "hover:text-[#4E6E58]"
              }`}
            >
              Todo el Pueblo
            </button>
            <button
              type="button"
              onClick={() => setSelectedDistrict("saber")}
              className={`rounded-lg px-2.5 py-1 transition cursor-pointer ${
                selectedDistrict === "saber" ? "bg-[#4E6E58] text-[#F7F4EB]" : "hover:text-[#4E6E58]"
              }`}
            >
              Distrito del Saber
            </button>
            <button
              type="button"
              onClick={() => setSelectedDistrict("artes")}
              className={`rounded-lg px-2.5 py-1 transition cursor-pointer ${
                selectedDistrict === "artes" ? "bg-[#4E6E58] text-[#F7F4EB]" : "hover:text-[#4E6E58]"
              }`}
            >
              Artes & Oficios
            </button>
            <button
              type="button"
              onClick={() => setSelectedDistrict("naturaleza")}
              className={`rounded-lg px-2.5 py-1 transition cursor-pointer ${
                selectedDistrict === "naturaleza" ? "bg-[#4E6E58] text-[#F7F4EB]" : "hover:text-[#4E6E58]"
              }`}
            >
              Naturaleza
            </button>
          </div>

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
            {ambientAnimEnabled ? "Brisa Activa" : "Modo Quieto"}
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
            <button
              type="button"
              onClick={() => {
                onSelectBuilding(activeResidentDialogue.buildingId, activeResidentDialogue.domain);
                setActiveResidentDialogue(null);
              }}
              className="rounded-2xl border-2 border-[#5C4033] bg-[#4E6E58] px-4 py-2.5 text-xs font-black text-[#F7F4EB] shadow-md hover:bg-[#3D5645] cursor-pointer"
            >
              Entrar al Edificio de {activeResidentDialogue.name} ➜
            </button>
          </div>
        </div>
      )}

      {/* PLANO DEL PUEBLO (BENTO GRID CON ESTÉTICA DE MAPA COZY) */}
      <div className="relative rounded-3xl border-3 border-[#5C4033] bg-[#EFEAD8] p-5 sm:p-7 shadow-2xl overflow-hidden">
        {/* Decoraciones ambientales de fondo */}
        {ambientAnimEnabled && (
          <div className="pointer-events-none absolute inset-0 opacity-15 overflow-hidden">
            <div className="absolute top-4 left-10 text-4xl animate-bounce duration-1000">🍃</div>
            <div className="absolute top-20 right-20 text-2xl animate-pulse">☁️</div>
            <div className="absolute bottom-10 left-1/3 text-3xl animate-bounce">🍂</div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
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

            return (
              <div
                key={building.id}
                className="group relative flex flex-col justify-between rounded-3xl border-3 border-[#5C4033] bg-[#FFFBF2] p-5 shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-[#3A2E2B]"
              >
                <div>
                  {/* Etiqueta de Distrito y Tier Visual */}
                  <div className="flex items-center justify-between gap-1 border-b-2 border-[#5C4033]/20 pb-2.5 mb-3">
                    <span className="rounded-full bg-[#EBE5D8] px-2 py-0.5 text-[10px] font-extrabold uppercase text-[#5C4033]">
                      {tierInfo.badge}
                    </span>
                    <span className="text-[10px] font-bold text-[#8C7A6B]">
                      Nivel {skillSum?.level || 1} • {skillSum?.sessions_count || buildingSessions.length} sesiones
                    </span>
                  </div>

                  {/* FACHADA VISUAL DEL EDIFICIO */}
                  <div
                    className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-[#5C4033] bg-gradient-to-b ${building.bgGradient} p-4 text-center shadow-inner`}
                  >
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
                          setActiveResidentDialogue(resident);
                        }}
                        className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#5C4033] bg-[#FFFBF2] text-sm shadow-md hover:scale-115 transition cursor-pointer"
                        title={`Hablar con ${resident.name} (${resident.species})`}
                      >
                        {resident.avatar}
                      </button>
                    )}
                  </div>

                  {/* DESCRIPCIÓN EVOLUTIVA */}
                  <div className="mt-3 space-y-1.5 text-left">
                    <p className="text-[11px] font-medium text-[#7A6B62] line-clamp-2">
                      {tierInfo.facadeDescription}
                    </p>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {tierInfo.decorations.slice(0, 2).map((dec, i) => (
                        <span
                          key={i}
                          className="rounded-md bg-[#EBE5D8] px-1.5 py-0.5 text-[9px] font-bold text-[#5C4033]"
                        >
                          ✓ {dec}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* BOTÓN PARA ENTRAR A LA SESIÓN */}
                <div className="pt-4 border-t-2 border-[#5C4033]/20 mt-4 flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-[#4E6E58]">
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
    </div>
  );
}
