"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Award,
  ChevronDown,
  ChevronUp,
  Layers,
  CheckCircle2,
  Lock,
  Eye,
  Hammer,
} from "lucide-react";
import type { BuildingVisualProgression } from "@/lib/sanctuary/visual-village-progression";
import { CozyCard, CozyButton, CozyProgress } from "@/components/cozy/ui";
import { triggerHaptic } from "@/lib/offline-sync";

interface VillageProgressionPanelProps {
  progression: BuildingVisualProgression;
  buildingName: string;
}

export function VillageProgressionPanel({
  progression,
  buildingName,
}: VillageProgressionPanelProps) {
  const [activeSection, setActiveSection] = useState<"evolucion" | "exposicion" | "muebles">("evolucion");
  const [isExpanded, setIsExpanded] = useState(true);

  const {
    tier,
    tierName,
    tierBadge,
    facadeDescription,
    exteriorDecorations,
    interiorFurniture,
    trophies,
    creationsExhibition,
    unlockedItemsCount,
    totalItemsCount,
    progressToNextTier,
  } = progression;

  return (
    <CozyCard variant="parchment" shadow="md" className="p-4 sm:p-5 space-y-4">
      {/* =========================================================================
          1. HEADER: TIER VISUAL DEL EDIFICIO & RESUMEN DE PROGRESIÓN
         ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[#3A2E2B] bg-[#E7D69C] text-2xl shadow-[0_2px_0_#3A2E2B] select-none">
            {tier === 3 ? "⭐" : tier === 2 ? "🌿" : "🪵"}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm sm:text-base font-black text-[#3A2E2B]">
                {tierName}
              </h4>
              <span className="rounded-full border border-[#3A2E2B] bg-[#B8CCA0] px-2.5 py-0.5 text-[10px] font-black text-[#3A2E2B]">
                {tierBadge}
              </span>
              {creationsExhibition.length > 0 && (
                <span className="rounded-full border border-[#C88973] bg-[#C88973]/20 px-2.5 py-0.5 text-[10px] font-black text-[#8A3722]">
                  🎨 {creationsExhibition.length} Creaciones Expuestas
                </span>
              )}
            </div>
            <p className="text-xs text-[#795548] font-medium pt-0.5 line-clamp-1">
              {facadeDescription}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <CozyButton
            variant={isExpanded ? "wood" : "sage"}
            size="sm"
            onClick={() => {
              triggerHaptic("light");
              setIsExpanded(!isExpanded);
            }}
            icon={isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            iconPosition="right"
          >
            {isExpanded ? "Ocultar Progresión" : "Ver Progresión Visual"}
          </CozyButton>
        </div>
      </div>

      {/* BARRA DE PROGRESO HACIA EL SIGUIENTE TIER VISUAL */}
      {isExpanded && tier < 3 && (
        <div className="rounded-2xl border-2 border-[#3A2E2B]/20 bg-[#F4EEDC] p-3 space-y-1.5">
          <div className="flex justify-between text-[11px] font-bold text-[#3A2E2B]">
            <span>
              Evolución hacia <strong className="text-[#314C3C]">{progressToNextTier.nextTierName}</strong>
            </span>
            <span>
              {progressToNextTier.current} / {progressToNextTier.target} ({progressToNextTier.percentage}%)
            </span>
          </div>
          <CozyProgress value={progressToNextTier.current} max={progressToNextTier.target} variant="forest" />
          <p className="text-[10px] text-[#795548] italic">
            * Los cambios visuales se desbloquean exclusivamente con hitos reales confirmados sin alterar reglas ni balances de GP/XP.
          </p>
        </div>
      )}

      {/* =========================================================================
          2. SELECTOR DE PESTAÑAS INTERNAS
         ========================================================================= */}
      {isExpanded && (
        <div className="flex flex-wrap items-center gap-2 border-b-2 border-[#3A2E2B]/15 pb-2">
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              setActiveSection("evolucion");
            }}
            className={`rounded-xl border-2 px-3 py-1 text-xs font-black transition cursor-pointer ${
              activeSection === "evolucion"
                ? "border-[#3A2E2B] bg-[#314C3C] text-[#FFFDF8] shadow-[0_2px_0_#1A2B20]"
                : "border-transparent bg-[#F4EEDC] text-[#795548] hover:bg-[#E7D69C]"
            }`}
          >
            🏛️ Fachada & Exteriores ({exteriorDecorations.filter((d) => d.unlocked).length}/{exteriorDecorations.length})
          </button>

          {creationsExhibition.length > 0 && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                setActiveSection("exposicion");
              }}
              className={`rounded-xl border-2 px-3 py-1 text-xs font-black transition cursor-pointer ${
                activeSection === "exposicion"
                  ? "border-[#3A2E2B] bg-[#C88973] text-[#FFFDF8] shadow-[0_2px_0_#8A3722]"
                  : "border-transparent bg-[#F4EEDC] text-[#795548] hover:bg-[#E7D69C]"
              }`}
            >
              🎨 Exposición de Creaciones ({creationsExhibition.length})
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              setActiveSection("muebles");
            }}
            className={`rounded-xl border-2 px-3 py-1 text-xs font-black transition cursor-pointer ${
              activeSection === "muebles"
                ? "border-[#3A2E2B] bg-[#314C3C] text-[#FFFDF8] shadow-[0_2px_0_#1A2B20]"
                : "border-transparent bg-[#F4EEDC] text-[#795548] hover:bg-[#E7D69C]"
            }`}
          >
            🛋️ Mobiliario & Trofeos ({unlockedItemsCount}/{totalItemsCount})
          </button>
        </div>
      )}

      {/* =========================================================================
          3. SECCIÓN: FACHADA & EXTERIORES
         ========================================================================= */}
      {isExpanded && activeSection === "evolucion" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {exteriorDecorations.map((item) => (
            <div
              key={item.id}
              className={`rounded-2xl border-3 border-[#3A2E2B] p-3.5 flex flex-col justify-between transition-all ${
                item.unlocked
                  ? "bg-[#FFFDF8] shadow-[0_3px_0_#3A2E2B]"
                  : "bg-[#F4EEDC]/60 opacity-70 shadow-none border-[#3A2E2B]/40"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl select-none">{item.icon}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-black border ${
                      item.unlocked
                        ? "bg-[#77936A]/20 text-[#314C3C] border-[#77936A]"
                        : "bg-[#3A2E2B]/10 text-[#795548] border-[#3A2E2B]/30"
                    }`}
                  >
                    {item.unlocked ? "✓ Instalado en Fachada" : "🔒 Por Desbloquear"}
                  </span>
                </div>
                <h5 className="text-xs font-black text-[#3A2E2B]">{item.name}</h5>
                <p className="mt-1 text-[11px] text-[#795548] italic">
                  &ldquo;{item.flavorText}&rdquo;
                </p>
              </div>

              <div className="mt-2.5 pt-2 border-t border-[#3A2E2B]/10 text-[10px] font-mono font-bold text-[#314C3C]">
                🎯 {item.requirement}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* =========================================================================
          4. SECCIÓN: EXPOSICIÓN DE CREACIONES (GALERÍA DE HITOS VERIFICADOS)
         ========================================================================= */}
      {isExpanded && activeSection === "exposicion" && (
        <div className="space-y-3">
          <p className="text-xs text-[#795548]">
            Obras maestras concluidas en este edificio que forman parte de la identidad patrimonial de Oakhaven:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {creationsExhibition.map((creation) => (
              <div
                key={creation.id}
                className="rounded-2xl border-3 border-[#3A2E2B] bg-[#FFFDF8] p-4 shadow-[0_3px_0_#3A2E2B] space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#E7D69C] text-xl shadow-[0_2px_0_#3A2E2B]">
                    {creation.icon}
                  </span>
                  <span className="rounded-full bg-[#77936A]/20 border border-[#77936A] px-2 py-0.5 text-[9px] font-black text-[#314C3C]">
                    {creation.badge}
                  </span>
                </div>
                <div>
                  <h5 className="text-xs font-black text-[#3A2E2B]">{creation.title}</h5>
                  <span className="text-[10px] text-[#795548] font-bold block">{creation.subtitle}</span>
                </div>
                <p className="text-[11px] text-[#795548] italic">
                  &ldquo;{creation.detail}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          5. SECCIÓN: MOBILIARIO INTERIOR & TROFEOS
         ========================================================================= */}
      {isExpanded && activeSection === "muebles" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[...interiorFurniture, ...trophies].map((item) => (
            <div
              key={item.id}
              className={`rounded-2xl border-3 border-[#3A2E2B] p-3.5 flex flex-col justify-between transition-all ${
                item.unlocked
                  ? "bg-[#FFFDF8] shadow-[0_3px_0_#3A2E2B]"
                  : "bg-[#F4EEDC]/60 opacity-70 shadow-none border-[#3A2E2B]/40"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl select-none">{item.icon}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-black border ${
                      item.unlocked
                        ? "bg-[#77936A]/20 text-[#314C3C] border-[#77936A]"
                        : "bg-[#3A2E2B]/10 text-[#795548] border-[#3A2E2B]/30"
                    }`}
                  >
                    {item.unlocked ? "✓ Instalado" : "🔒 Por Desbloquear"}
                  </span>
                </div>
                <h5 className="text-xs font-black text-[#3A2E2B]">{item.name}</h5>
                <p className="mt-1 text-[11px] text-[#795548] italic">
                  &ldquo;{item.flavorText}&rdquo;
                </p>
              </div>

              <div className="mt-2.5 pt-2 border-t border-[#3A2E2B]/10 text-[10px] font-mono font-bold text-[#314C3C]">
                🎯 {item.requirement}
              </div>
            </div>
          ))}
        </div>
      )}
    </CozyCard>
  );
}
