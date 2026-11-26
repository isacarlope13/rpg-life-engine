"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, Battery, BatteryCharging, BatteryLow, Clock, Compass, Sparkles } from "lucide-react";
import type { KnittingProject, Quest, ReadingBook } from "@/types/rpg";
import {
  buildRowanDailyDecisionBrief,
  type RowanEnergyLevel,
} from "@/lib/ai/rowan-decision-engine";
import { CozyButton } from "@/components/cozy/ui";

interface RowanDailyDecisionCardProps {
  quests: Quest[];
  knittingProjects: KnittingProject[];
  readingBooks: ReadingBook[];
  streakDays: number;
  recentSessionsCount: number;
  onOpenBuilding: (buildingId: string) => void;
}

const ENERGY_OPTIONS: Array<{
  id: RowanEnergyLevel;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: "low", label: "Baja", icon: <BatteryLow className="h-3.5 w-3.5" /> },
  { id: "medium", label: "Media", icon: <Battery className="h-3.5 w-3.5" /> },
  { id: "high", label: "Alta", icon: <BatteryCharging className="h-3.5 w-3.5" /> },
];

export function RowanDailyDecisionCard({
  quests,
  knittingProjects,
  readingBooks,
  streakDays,
  recentSessionsCount,
  onOpenBuilding,
}: RowanDailyDecisionCardProps) {
  const [energyLevel, setEnergyLevel] = useState<RowanEnergyLevel>("medium");
  const [expanded, setExpanded] = useState<boolean>(true);

  const brief = useMemo(
    () =>
      buildRowanDailyDecisionBrief({
        energyLevel,
        quests,
        knittingProjects,
        readingBooks,
        streakDays,
        recentSessionsCount,
      }),
    [energyLevel, quests, knittingProjects, readingBooks, streakDays, recentSessionsCount]
  );

  return (
    <section
      aria-label="Tarjeta de Decisión Diaria de Rowan"
      className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#3A2E2B]/10 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#314C3C] text-[#E7D69C] shadow-[0_2px_0_#3A2E2B] shrink-0">
            <Compass className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-black text-[#3A2E2B] uppercase tracking-wide flex items-center gap-1.5">
              Decisión Diaria · Rowan
              <span className="rounded-full bg-[#314C3C]/10 px-2 py-0.5 text-[10px] font-black text-[#314C3C] normal-case">
                Determinista · 0 costo IA
              </span>
            </h3>
            <p className="text-[11px] font-bold text-[#795548]">{brief.summaryReason}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Energía disponible hoy"
            className="inline-flex items-center gap-1 rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC] p-1"
          >
            <span className="px-1.5 text-[10px] font-black text-[#795548]">Energía:</span>
            {ENERGY_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setEnergyLevel(opt.id)}
                className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-black transition-colors cursor-pointer ${
                  energyLevel === opt.id
                    ? "bg-[#314C3C] text-[#FFFDF8]"
                    : "text-[#3A2E2B] hover:bg-[#E7D69C]/60"
                }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="rounded-xl border-2 border-[#3A2E2B]/30 bg-[#F4EEDC] px-2.5 py-1 text-[11px] font-black text-[#3A2E2B] hover:bg-[#E7D69C]/60 cursor-pointer"
          >
            {expanded ? "Ocultar" : "Ver plan"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-3">
          {/* Carga estimada y bloques de concentración */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="rounded-2xl border-2 border-[#3A2E2B]/20 bg-[#F7F4EB] p-3">
              <span className="text-[10px] font-black uppercase text-[#795548] block">
                Carga vs. Capacidad
              </span>
              <p className="mt-0.5 font-mono text-sm font-black text-[#3A2E2B]">
                {brief.plannedMinutes} min / {brief.capacityMinutes} min ({brief.loadRatioPct}%)
              </p>
            </div>
            <div className="rounded-2xl border-2 border-[#3A2E2B]/20 bg-[#F7F4EB] p-3">
              <span className="text-[10px] font-black uppercase text-[#795548] block">
                Ritmo sugerido
              </span>
              <p className="mt-0.5 font-mono text-sm font-black text-[#314C3C] flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {brief.focusBlockMinutes} min foco · {brief.restBreakMinutes} min pausa
              </p>
            </div>
            <div className="rounded-2xl border-2 border-[#3A2E2B]/20 bg-[#EAF3ED] p-3">
              <span className="text-[10px] font-black uppercase text-[#314C3C] block">
                Descanso protegido
              </span>
              <p className="mt-0.5 text-[11px] font-bold text-[#314C3C] leading-snug">
                {brief.restRecommendation}
              </p>
            </div>
          </div>

          {brief.isOverplanned && brief.rescheduleProposal && (
            <div className="rounded-2xl border-2 border-amber-700 bg-amber-50 p-3 flex items-start gap-2 text-xs font-bold text-amber-950">
              <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-black block">Posible sobreplanificación detectada</span>
                <span>{brief.rescheduleProposal}</span>
              </div>
            </div>
          )}

          {/* Prioridades explicables del día */}
          {brief.priorities.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {brief.priorities.map((item, idx) => (
                <div
                  key={item.id}
                  className="rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC]/70 p-3 flex flex-col justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-lg bg-[#E7D69C] border border-[#3A2E2B] px-1.5 py-0.5 text-[10px] font-black text-[#3A2E2B]">
                        #{idx + 1} · {item.estimatedMinutes} min
                      </span>
                      <Sparkles className="h-3.5 w-3.5 text-[#77936A]" />
                    </div>
                    <p className="mt-1.5 text-xs font-black text-[#3A2E2B]">{item.title}</p>
                    <p className="mt-1 text-[11px] text-[#5C381E] leading-snug">{item.reason}</p>
                  </div>
                  <CozyButton
                    size="sm"
                    variant="wood"
                    onClick={() => onOpenBuilding(item.buildingId)}
                    className="w-full"
                  >
                    Abrir edificio
                  </CozyButton>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
