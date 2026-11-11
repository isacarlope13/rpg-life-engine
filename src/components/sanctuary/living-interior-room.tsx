"use client";

import React, { useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Sparkles,
  Clock,
  Play,
  Pause,
  Layers,
  ChevronRight,
  Info,
  CheckCircle2,
  AlertCircle,
  Volume2,
} from "lucide-react";
import type { SkillDomain } from "@/types/rpg";
import type { VillageResident } from "@/lib/sanctuary/village-tiers";
import { CozyButton } from "@/components/cozy/ui";
import { triggerHaptic } from "@/lib/offline-sync";

export interface InteriorStationDefinition {
  id: string;
  name: string;
  shortName?: string;
  icon: string | React.ReactNode;
  badge?: string | number;
  badgeVariant?: "info" | "warning" | "success";
  status?: "idle" | "active" | "completed";
  hotkey?: string; // e.g. "1", "2", "3", "4", "5"
  description: string;
  stationType?: "workbench" | "archive" | "desk" | "vault" | "counter" | "companion";
}

export interface LivingInteriorRoomProps {
  buildingId: string;
  buildingName: string;
  domain: SkillDomain;
  districtName: string;
  icon: string;
  tagline: string;
  resident?: VillageResident;
  stations: InteriorStationDefinition[];
  activeStationId: string;
  onSelectStation: (stationId: string) => void;
  onClose?: () => void;
  activeSessionBanner?: {
    isActive: boolean;
    isPaused: boolean;
    formattedTime: string;
    label?: string;
    onViewSession?: () => void;
  };
  metrics?: {
    label: string;
    value: string | number;
    icon?: string;
  }[];
  roomTheme?: {
    wallColor?: string;
    floorPattern?: "wood" | "stone" | "tile" | "carpet";
    ambientWarmth?: "sunny" | "fireplace" | "candlelight" | "night";
  };
  children: React.ReactNode;
}

export function LivingInteriorRoom({
  buildingId,
  buildingName,
  domain,
  districtName,
  icon,
  tagline,
  resident,
  stations,
  activeStationId,
  onSelectStation,
  onClose,
  activeSessionBanner,
  metrics = [],
  roomTheme = {
    wallColor: "#5C4033",
    floorPattern: "wood",
    ambientWarmth: "fireplace",
  },
  children,
}: LivingInteriorRoomProps) {
  // Manejo de atajos de teclado (1-5 para seleccionar estaciones, Escape para volver al pueblo)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignorar si el usuario está escribiendo en un input o textarea
      const target = e.target as HTMLElement;
      if (target.matches("input, textarea, select, [contenteditable='true']")) {
        return;
      }

      if (e.key === "Escape" && onClose) {
        e.preventDefault();
        triggerHaptic("light");
        onClose();
        return;
      }

      // Atajos numéricos 1 al 9
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= stations.length) {
        e.preventDefault();
        const targetStation = stations[num - 1];
        if (targetStation && targetStation.id !== activeStationId) {
          triggerHaptic("light");
          onSelectStation(targetStation.id);
        }
      }
    },
    [stations, activeStationId, onSelectStation, onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const activeStation = stations.find((s) => s.id === activeStationId) || stations[0];

  return (
    <div className="space-y-5 text-[#3A2E2B] font-sans antialiased">
      {/* =========================================================================
          1. CABECERA CONTEXTUAL DEL EDIFICIO VIVO & REGRESO AL PUEBLO
         ========================================================================= */}
      <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-4 sm:p-6 shadow-[0_6px_0_#3A2E2B] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl border-3 border-[#3A2E2B] bg-[#E7D69C] text-2xl sm:text-3xl shadow-[0_3px_0_#3A2E2B]">
              {icon}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-[#3A2E2B] tracking-tight">
                  {buildingName}
                </h2>
                <span className="rounded-full bg-[#314C3C]/10 border border-[#314C3C]/30 px-2 py-0.5 text-[9px] font-black text-[#314C3C] uppercase">
                  {districtName}
                </span>
              </div>
              <p className="text-xs text-[#795548] font-medium line-clamp-1">
                {tagline}
              </p>
            </div>
          </div>

          {onClose && (
            <CozyButton
              variant="wood"
              size="sm"
              onClick={() => {
                triggerHaptic("light");
                onClose();
              }}
              className="flex items-center gap-1.5"
              title="Volver al Pueblo Vivo (Esc)"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Volver al Pueblo</span>
              <kbd className="ml-1 hidden sm:inline-block rounded bg-[#3A2E2B]/20 px-1 py-0.2 text-[9px] font-mono">
                Esc
              </kbd>
            </CozyButton>
          )}
        </div>

        {/* BANNER DE SESIÓN ACTIVA PERSISTENTE (SI ESTÁ EN CURSO) */}
        {activeSessionBanner && activeSessionBanner.isActive && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-[#314C3C] bg-[#C4DC9C] px-3.5 py-2 shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2 text-xs font-black text-[#1A2B20]">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-600 animate-ping" />
              <span>
                {activeSessionBanner.isPaused ? "⏸️ Sesión Pausada" : "⏱️ Sesión en Curso"}:
              </span>
              <span className="font-mono text-sm tracking-wide bg-[#FFFDF8] px-2 py-0.5 rounded-lg border border-[#314C3C]">
                {activeSessionBanner.formattedTime}
              </span>
              {activeSessionBanner.label && (
                <span className="text-xs font-medium text-[#314C3C]">
                  • {activeSessionBanner.label}
                </span>
              )}
            </div>
            {activeSessionBanner.onViewSession && (
              <button
                type="button"
                onClick={activeSessionBanner.onViewSession}
                className="text-xs font-black text-[#1A2B20] underline hover:text-[#314C3C] cursor-pointer"
              >
                Ver estación ➜
              </button>
            )}
          </div>
        )}

        {/* MÉTRICAS CLAVE EN TARJETAS COZY */}
        {metrics.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t-2 border-[#3A2E2B]/10">
            {metrics.map((met, idx) => (
              <div
                key={idx}
                className="rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC] p-2 text-center shadow-[0_2px_0_#3A2E2B]"
              >
                <span className="text-[9px] font-bold text-[#795548] uppercase block">
                  {met.label}
                </span>
                <span className="text-xs sm:text-sm font-black text-[#3A2E2B]">
                  {met.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* =========================================================================
          2. ESCENARIO 2D COZY: MOBILIARIO Y ESTACIONES INTERACTIVAS (HOTSPOTS)
         ========================================================================= */}
      <div className="relative rounded-3xl border-4 border-[#3A2E2B] bg-[#2C241E] p-4 sm:p-5 shadow-[0_8px_0_#3A2E2B] overflow-hidden select-none">
        {/* Fondo del interior: paredes de madera y piso entarimado SVG */}
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="living_floor_pattern" width="32" height="32" patternUnits="userSpaceOnUse">
                <rect width="32" height="32" fill="#5C381E" />
                <path d="M 0 16 L 32 16 M 16 0 L 16 32" stroke="#3A2E2B" strokeWidth="1.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#living_floor_pattern)" />
          </svg>
        </div>

        {/* Halo de luz cálida de lámparas o chimenea */}
        <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-96 h-32 bg-amber-400/20 blur-2xl rounded-full" />

        {/* Barra superior del escenario con indicador de estación y atajos */}
        <div className="relative z-10 flex items-center justify-between pb-3 text-xs font-black text-amber-200">
          <div className="flex items-center gap-1.5">
            <span>🛋️</span>
            <span>Estaciones de Trabajo de la Habitación:</span>
          </div>
          <span className="text-[10px] text-amber-200/70 hidden sm:inline">
            Usa las teclas [1-{stations.length}] para alternar rápidamente
          </span>
        </div>

        {/* GRID DE ESTACIONES DE TRABAJO (HOTSPOTS INTERACTIVOS) */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 sm:gap-3">
          {stations.map((st, idx) => {
            const isSelected = st.id === activeStationId;
            const hotkeyNum = idx + 1;

            return (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  triggerHaptic("medium");
                  onSelectStation(st.id);
                }}
                className={`group relative flex flex-col items-center justify-between rounded-2xl border-3 p-3 text-center transition-all cursor-pointer min-h-[96px] ${
                  isSelected
                    ? "border-[#FDDA24] bg-[#FFFDF8] text-[#3A2E2B] shadow-[0_5px_0_#3A2E2B] -translate-y-1 scale-102 ring-3 ring-amber-300/40"
                    : "border-[#3A2E2B] bg-[#F4EEDC]/90 text-[#3A2E2B] hover:bg-[#FFFDF8] hover:-translate-y-0.5 shadow-[0_2px_0_#3A2E2B]"
                }`}
                aria-pressed={isSelected}
              >
                {/* Atajo de teclado en la esquina */}
                <span className="absolute top-1.5 left-1.5 rounded-md border border-[#3A2E2B]/40 bg-[#3A2E2B]/10 px-1 text-[8px] font-black text-[#795548]">
                  {hotkeyNum}
                </span>

                {/* Badge de alerta si aplica */}
                {st.badge !== undefined && (
                  <span
                    className={`absolute top-1.5 right-1.5 rounded-full px-1.5 py-0.2 text-[9px] font-black border ${
                      st.badgeVariant === "warning"
                        ? "bg-amber-100 text-amber-900 border-amber-600"
                        : st.badgeVariant === "success"
                        ? "bg-emerald-100 text-emerald-900 border-emerald-600"
                        : "bg-[#FDDA24] text-[#3A2E2B] border-[#3A2E2B]"
                    }`}
                  >
                    {st.badge}
                  </span>
                )}

                {/* Icono de la estación */}
                <div className="pt-2 text-2xl group-hover:scale-110 transition-transform">
                  {st.icon}
                </div>

                {/* Nombre de la estación */}
                <div className="pt-1.5">
                  <h4 className="text-[11px] font-black leading-tight">
                    {st.name}
                  </h4>
                  <p className="text-[9px] text-[#795548] line-clamp-1">
                    {st.shortName || st.description}
                  </p>
                </div>

                {/* Indicador de selección activo */}
                {isSelected && (
                  <div className="absolute -bottom-1 w-8 h-1 rounded-full bg-[#FDDA24]" />
                )}
              </button>
            );
          })}
        </div>

        {/* MINI PORCHE CON EL RESIDENTE COMPAÑERO */}
        {resident && (
          <div className="relative z-10 mt-3 pt-3 border-t border-amber-200/20 flex items-center justify-between gap-3 text-xs text-amber-100">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-300/40 bg-amber-900/50 text-base shadow-xs">
                {resident.avatar}
              </span>
              <div>
                <span className="font-black text-amber-200">{resident.name}</span>
                <span className="text-[10px] text-amber-200/70 ml-1.5">
                  ({resident.title})
                </span>
              </div>
            </div>
            <p className="text-[11px] italic text-amber-200/80 hidden sm:inline">
              "{resident.greetingQuote}"
            </p>
          </div>
        )}
      </div>

      {/* =========================================================================
          3. ÁREA DE TRABAJO DE LA ESTACIÓN ACTIVA (WIDGET INYECTADO)
         ========================================================================= */}
      <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-4 sm:p-6 shadow-[0_6px_0_#3A2E2B]">
        <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/15 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">{activeStation.icon}</span>
            <div>
              <h3 className="text-sm sm:text-base font-black text-[#3A2E2B]">
                {activeStation.name}
              </h3>
              <p className="text-[10px] text-[#795548]">
                {activeStation.description}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-[#314C3C] bg-[#C4DC9C] px-2.5 py-1 rounded-xl border border-[#314C3C]">
            Estación Activa
          </span>
        </div>

        {/* Contenido interactivo de la estación seleccionada */}
        <div>{children}</div>
      </div>
    </div>
  );
}
