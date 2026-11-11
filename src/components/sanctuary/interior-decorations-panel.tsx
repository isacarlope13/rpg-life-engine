"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { getBuildingTrophies } from "@/lib/sanctuary/village-tiers";
import { CozyCard, CozyButton } from "@/components/cozy/ui";

interface InteriorDecorationsPanelProps {
  buildingId: string;
  buildingName: string;
  stats: {
    level?: number;
    sessionsCount?: number;
    booksRead?: number;
    knittingRows?: number;
    rubikPb?: number | null;
    focusMinutes?: number;
  };
}

export function InteriorDecorationsPanel({
  buildingId,
  buildingName,
  stats,
}: InteriorDecorationsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const items = getBuildingTrophies(buildingId, stats);
  const unlockedCount = items.filter((i) => i.unlocked).length;

  return (
    <CozyCard variant="parchment" shadow="md" className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-[#3A2E2B] bg-[#E7D69C] text-xl shadow-[0_2px_0_#3A2E2B] select-none">
            🛋️
          </span>
          <div>
            <h4 className="text-xs sm:text-sm font-black text-[#3A2E2B] flex flex-wrap items-center gap-2">
              Mobiliario & Vitrina de Logros de {buildingName}
              <span className="rounded-full border border-[#3A2E2B] bg-[#B8CCA0] px-2.5 py-0.5 text-[10px] font-black text-[#3A2E2B]">
                {unlockedCount}/{items.length} Desbloqueados
              </span>
            </h4>
            <p className="text-[11px] text-[#795548] font-medium">
              Muebles y reliquias que se desbloquean con tu progreso real verificable en Oakhaven.
            </p>
          </div>
        </div>

        <CozyButton
          variant={isExpanded ? "wood" : "sage"}
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          icon={isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          iconPosition="right"
        >
          {isExpanded ? "Ocultar Vitrina" : `Ver Mobiliario (${unlockedCount}/${items.length})`}
        </CozyButton>
      </div>

      {isExpanded && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t-2 border-[#3A2E2B]/15 pt-3.5 animate-in fade-in">
          {items.map((item) => (
            <div
              key={item.id}
              className={`rounded-2xl border-3 border-[#3A2E2B] p-3.5 flex flex-col justify-between transition-all ${
                item.unlocked
                  ? "bg-[#FFFDF8] shadow-[0_3px_0_#3A2E2B]"
                  : "bg-[#F4EEDC]/60 opacity-70 shadow-none border-[#3A2E2B]/50"
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
