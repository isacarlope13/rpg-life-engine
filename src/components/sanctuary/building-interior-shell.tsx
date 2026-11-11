"use client";

import React from "react";
import {
  ArrowLeft,
  Sparkles,
  Award,
  Clock,
  Play,
  RotateCcw,
  CheckCircle2,
  ChevronRight,
  User,
} from "lucide-react";
import type { SkillDomain } from "@/types/rpg";
import type { VillageResident } from "@/lib/sanctuary/village-tiers";
import { CozyButton, CozyCard } from "@/components/cozy/ui";
import { triggerHaptic } from "@/lib/offline-sync";

export interface BuildingInteriorTab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

export interface BuildingInteriorShellProps {
  buildingId: string;
  buildingName: string;
  domain: SkillDomain;
  districtName: string;
  icon: string;
  tagline: string;
  playerLevel: number;
  skillLevel?: number;
  totalGpEarned?: number;
  resident?: VillageResident;
  sessionsCount?: number;
  specificMetrics?: {
    label: string;
    value: string | number;
    icon?: string;
  }[];
  lastSessionSummary?: string;
  continueActionLabel?: string;
  onContinueLastSession?: () => void;
  activeSessionBanner?: {
    isActive: boolean;
    isPaused: boolean;
    formattedTime: string;
    label?: string;
    onViewSession?: () => void;
  };
  activeTab: string;
  tabs: BuildingInteriorTab[];
  onTabChange: (tabId: string) => void;
  onClose?: () => void;
  children: React.ReactNode;
}

export function BuildingInteriorShell({
  buildingId,
  buildingName,
  domain,
  districtName,
  icon,
  tagline,
  playerLevel,
  skillLevel = 1,
  totalGpEarned = 0,
  resident,
  sessionsCount,
  specificMetrics = [],
  lastSessionSummary,
  continueActionLabel = "Continuar última sesión",
  onContinueLastSession,
  activeSessionBanner,
  activeTab,
  tabs,
  onTabChange,
  onClose,
  children,
}: BuildingInteriorShellProps) {
  return (
    <div className="space-y-6 text-[#3A2E2B] font-sans antialiased">
      {/* =========================================================================
          1. HEADER UNIFICADO DEL EDIFICIO: TÍTULO, MÉTRICAS & REGRESO AL PUEBLO
         ========================================================================= */}
      <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 sm:p-6 shadow-[0_6px_0_#3A2E2B] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border-3 border-[#3A2E2B] bg-[#E7D69C] text-3xl shadow-[0_3px_0_#3A2E2B]">
              {icon}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-[#3A2E2B] tracking-tight">
                  {buildingName}
                </h2>
                <span className="rounded-full bg-[#314C3C]/10 border border-[#314C3C]/30 px-2.5 py-0.5 text-[10px] font-black text-[#314C3C] uppercase">
                  {districtName}
                </span>
              </div>
              <p className="text-xs text-[#795548] font-medium pt-0.5">
                {tagline}
              </p>
            </div>
          </div>

          {/* BOTÓN REGRESAR AL PUEBLO */}
          {onClose && (
            <CozyButton
              variant="wood"
              size="sm"
              onClick={() => {
                triggerHaptic("light");
                onClose();
              }}
              className="flex items-center gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Volver al Pueblo</span>
            </CozyButton>
          )}
        </div>

        {/* MÉTRICAS CLAVE DEL EDIFICIO */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t-2 border-[#3A2E2B]/15">
          <div className="rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC] p-2.5 text-center shadow-[0_2px_0_#3A2E2B]">
            <span className="text-[10px] font-bold text-[#795548] uppercase block">
              Nivel de Habilidad
            </span>
            <span className="text-sm sm:text-base font-black text-[#3A2E2B]">
              Grado {skillLevel}
            </span>
          </div>

          <div className="rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC] p-2.5 text-center shadow-[0_2px_0_#3A2E2B]">
            <span className="text-[10px] font-bold text-[#795548] uppercase block">
              GP Generados
            </span>
            <span className="text-sm sm:text-base font-black text-[#314C3C]">
              +{totalGpEarned.toLocaleString("es-CO")} GP
            </span>
          </div>

          {specificMetrics.map((met, idx) => (
            <div
              key={idx}
              className="rounded-2xl border-2 border-[#3A2E2B] bg-[#E7D69C]/30 p-2.5 text-center shadow-[0_2px_0_#3A2E2B]"
            >
              <span className="text-[10px] font-bold text-[#795548] uppercase block">
                {met.label}
              </span>
              <span className="text-sm sm:text-base font-black text-[#3A2E2B]">
                {met.value}
              </span>
            </div>
          ))}
        </div>

        {/* =========================================================================
            RESIDENTE ASOCIADO (VECINO GUÍA DEL EDIFICIO)
           ========================================================================= */}
        {resident && (
          <div className="rounded-2xl border-2 border-[#3A2E2B] bg-[#E7D69C]/25 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[0_2px_0_#3A2E2B]">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8] text-2xl shadow-[0_2px_0_#3A2E2B]">
                {resident.avatar}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-black text-[#3A2E2B]">{resident.name}</span>
                  <span className="text-[10px] font-bold text-[#795548] bg-[#F4EEDC] px-2 py-0.5 rounded-full border border-[#3A2E2B]/15">
                    {resident.species} • {resident.title}
                  </span>
                </div>
                <p className="text-xs italic text-[#5D4037] pt-0.5">
                  &ldquo;
                  {resident.getDynamicAdvice
                    ? resident.getDynamicAdvice({
                        skillLevel,
                        sessionsCount: sessionsCount ?? (specificMetrics.length > 0 ? Number(specificMetrics[0].value) || 0 : 0),
                      })
                    : resident.greetingQuote}
                  &rdquo;
                </p>
              </div>
            </div>
            {resident.microQuest && (
              <div className="shrink-0 text-left sm:text-right w-full sm:w-auto border-t sm:border-t-0 border-[#3A2E2B]/10 pt-2 sm:pt-0">
                <span className="text-[9px] font-black uppercase text-[#314C3C] block">
                  Misión Activa
                </span>
                <span className="text-xs font-bold text-[#3A2E2B]">
                  {resident.microQuest.title}
                </span>
                <span className="block text-[10px] text-[#795548]">
                  {resident.microQuest.badge}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* =========================================================================
          BANNER GLOBAL DE SESIÓN EN CURSO
         ========================================================================= */}
      {activeSessionBanner && (activeSessionBanner.isActive || activeSessionBanner.isPaused) && (
        <div className="rounded-3xl border-3 border-[#3A2E2B] bg-[#314C3C] text-[#FFFDF8] p-4 shadow-[0_4px_0_#1A2B20] flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFFDF8] text-xl text-[#314C3C] shadow-inner font-bold">
              {activeSessionBanner.isPaused ? "⏸️" : "⏱️"}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-[#E7D69C]">
                  {activeSessionBanner.isPaused ? "Sesión en Pausa" : "Sesión en Curso"}
                </span>
                <span className="font-mono text-sm font-black bg-[#1A2B20] px-2.5 py-0.5 rounded-lg border border-[#FFFDF8]/20 text-emerald-300">
                  {activeSessionBanner.formattedTime}
                </span>
              </div>
              <p className="text-xs text-[#EAF3ED]">
                {activeSessionBanner.label || "Actividad activa registrada en este edificio"}
              </p>
            </div>
          </div>
          {activeSessionBanner.onViewSession && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                activeSessionBanner.onViewSession!();
              }}
              className="rounded-2xl border-2 border-[#FFFDF8] bg-[#E7D69C] px-3.5 py-2 text-xs font-black text-[#3A2E2B] shadow-[0_2px_0_#FFFDF8] hover:bg-[#F4EEDC] transition cursor-pointer"
            >
              Ver Panel de Esfuerzo
            </button>
          )}
        </div>
      )}

      {/* =========================================================================
          2. TARJETA DESTACADA: CONTINUAR ÚLTIMA SESIÓN (SI EXISTE)
         ========================================================================= */}
      {lastSessionSummary && onContinueLastSession && (
        <div className="rounded-3xl border-3 border-[#3A2E2B] bg-[#EAF3ED] p-4 shadow-[0_4px_0_#3A2E2B] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#314C3C] text-[#FFFDF8] text-lg shadow-[0_2px_0_#1A2B20]">
              ⚡
            </span>
            <div>
              <span className="text-[10px] font-black uppercase text-[#314C3C] tracking-wider block">
                Reanudar Actividad Reciente
              </span>
              <p className="text-xs font-bold text-[#2A4331] line-clamp-1">
                {lastSessionSummary}
              </p>
            </div>
          </div>

          <CozyButton
            variant="forest"
            size="sm"
            onClick={() => {
              triggerHaptic("medium");
              onContinueLastSession();
            }}
            className="flex items-center gap-1.5"
          >
            <Play className="h-3.5 w-3.5" />
            <span>{continueActionLabel}</span>
          </CozyButton>
        </div>
      )}

      {/* =========================================================================
          3. NAVEGACIÓN POR PESTAÑAS DEL INTERIOR
         ========================================================================= */}
      <div className="flex flex-wrap items-center gap-2 border-b-2 border-[#3A2E2B]/20 pb-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onTabChange(tab.id);
              }}
              className={`flex items-center gap-2 rounded-2xl border-2 px-3.5 py-2 text-xs font-black transition cursor-pointer ${
                isActive
                  ? "border-[#3A2E2B] bg-[#314C3C] text-[#FFFDF8] shadow-[0_3px_0_#1A2B20] -translate-y-0.5"
                  : "border-transparent bg-[#FFFDF8] text-[#795548] hover:bg-[#F4EEDC] hover:border-[#3A2E2B]/30"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`rounded-full px-2 py-0.2 text-[10px] font-black ${
                    isActive
                      ? "bg-[#E7D69C] text-[#3A2E2B]"
                      : "bg-[#F4EEDC] text-[#795548] border border-[#3A2E2B]/20"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          4. CONTENIDO PRINCIPAL ESPECÍFICO DEL EDIFICIO
         ========================================================================= */}
      <div>{children}</div>
    </div>
  );
}
