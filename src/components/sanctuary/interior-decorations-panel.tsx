"use client";

import React, { useState } from "react";
import { Sparkles, Trophy, Armchair, ChevronDown, ChevronUp, Lock, Check } from "lucide-react";
import { getBuildingTrophies, type BuildingTrophyItem } from "@/lib/sanctuary/village-tiers";

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
    <div className="rounded-2xl border-2 border-white/10 bg-slate-900/60 p-4 shadow-md transition-all">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-lg">
            🛋️
          </span>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
              Mobiliario & Vitrina de Logros de {buildingName}
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-300">
                {unlockedCount}/{items.length} Desbloqueados
              </span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Muebles y reliquias que se desbloquean con tu progreso real verificable.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white cursor-pointer"
        >
          {isExpanded ? (
            <>
              Ocultar Vitrina <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              Ver Mobiliario ({unlockedCount}/{items.length}) <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-800 pt-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border p-3 flex flex-col justify-between transition-all ${
                item.unlocked
                  ? "border-amber-500/30 bg-amber-950/20 shadow-sm"
                  : "border-slate-800 bg-slate-950/40 opacity-60"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{item.icon}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                      item.unlocked
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {item.unlocked ? "✓ Instalado" : "🔒 Por Desbloquear"}
                  </span>
                </div>
                <h5 className="text-xs font-bold text-white">{item.name}</h5>
                <p className="mt-1 text-[10px] text-slate-400 italic">
                  "{item.flavorText}"
                </p>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[10px] font-mono text-amber-200/90">
                🎯 {item.requirement}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
