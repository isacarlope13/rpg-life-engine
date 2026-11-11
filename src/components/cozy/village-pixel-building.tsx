"use client";

import React from "react";
import type { VillageBuildingDefinition } from "@/lib/sanctuary/village-buildings-registry";
import type { VillageResident, BuildingTierInfo } from "@/lib/sanctuary/village-tiers";
import { triggerHaptic } from "@/lib/offline-sync";

interface VillagePixelBuildingProps {
  building: VillageBuildingDefinition;
  tierInfo: BuildingTierInfo;
  pending: { hasPending: boolean; label?: string };
  resident?: VillageResident;
  isHovered: boolean;
  onInspect: () => void;
  onEnter: () => void;
  onSelectResident?: (resident: VillageResident) => void;
}

/**
 * EDIFICIO PILOTO PIXEL ART — EL ATELIER TEXTIL
 * Sustituye la tarjeta oscura por una fachada arquitectónica ilustrada
 * con entramado de madera, tejado artesanal, ventana iluminada y
 * evolución visual por Tiers (Fase 9).
 */
export function VillagePixelBuilding({
  building,
  tierInfo,
  pending,
  resident,
  isHovered,
  onInspect,
  onEnter,
  onSelectResident,
}: VillagePixelBuildingProps) {
  const isTier1 = tierInfo.tier === 1;
  const isTier2 = tierInfo.tier === 2;
  const isTier3 = tierInfo.tier >= 3;

  return (
    <div className="relative flex flex-col items-center select-none group">
      {/* 1. BADGE FLOTANTE DE ACTIVIDAD PENDIENTE */}
      {pending.hasPending && (
        <span className="absolute -top-7 z-30 flex items-center gap-1 rounded-full border-2 border-[#3A2E2B] bg-[#E7D69C] px-2.5 py-0.5 text-[9px] font-black text-[#3A2E2B] shadow-[0_2px_0_#3A2E2B] animate-bounce whitespace-nowrap">
          <span>⚡</span> {pending.label || "Ronda en curso"}
        </span>
      )}

      {/* 2. FACHADA ARQUITECTÓNICA PIXEL ART INTERACTIVA */}
      <button
        type="button"
        onClick={() => {
          triggerHaptic("medium");
          onInspect();
        }}
        onDoubleClick={onEnter}
        aria-label={`Edificio: ${building.name}. Tier ${tierInfo.tier}. Clic para inspeccionar, doble clic para entrar.`}
        className={`relative flex flex-col items-center justify-end w-32 sm:w-36 h-36 rounded-2xl transition-all duration-300 cursor-pointer ${
          isHovered ? "-translate-y-2 scale-105" : ""
        }`}
      >
        {/* Chimenea con humo sutil */}
        <div className="absolute top-1 left-4 z-0 flex flex-col items-center">
          <span className="text-[10px] animate-pulse opacity-75">💭</span>
          <div className="w-3.5 h-6 bg-[#6E4B38] border-2 border-[#3A2E2B] rounded-t-sm shadow-sm" />
        </div>

        {/* Estandarte de Maestría (Tier 3) */}
        {isTier3 && (
          <div className="absolute -top-3 right-3 z-20 flex items-center gap-1 animate-bounce duration-1000">
            <span className="text-base filter drop-shadow">🚩</span>
          </div>
        )}

        {/* Farol Artesanal Exterior (Tier 2+) */}
        {tierInfo.tier >= 2 && (
          <div className="absolute top-12 -left-2 z-20 filter drop-shadow animate-pulse" title="Farol encendido de taller activo">
            <span className="text-sm">🏮</span>
          </div>
        )}

        {/* ESTRUCTURA SVG DEL EDIFICIO: TEJADO Y FACHADA MEDIEVAL COZY */}
        <div className="relative z-10 w-full h-full flex flex-col items-center justify-end">
          {/* Tejado a dos aguas */}
          <div
            className={`w-28 sm:w-32 h-14 rounded-t-xl border-3 border-[#3A2E2B] relative flex items-center justify-center shadow-[0_4px_0_#3A2E2B] overflow-hidden ${
              isTier3
                ? "bg-gradient-to-b from-[#4A5D4E] to-[#2E3D31]" // Tejas de pizarra nórdica
                : isTier2
                ? "bg-gradient-to-b from-[#C88973] to-[#A25842]" // Tejas de terracota
                : "bg-gradient-to-b from-[#D4A373] to-[#B07D4C]" // Paja y madera rústica
            }`}
          >
            {/* Líneas de tejas / textura */}
            <div className="absolute inset-0 opacity-25 flex flex-col justify-around py-1 pointer-events-none">
              <div className="w-full border-b border-[#3A2E2B]" />
              <div className="w-full border-b border-[#3A2E2B]" />
              <div className="w-full border-b border-[#3A2E2B]" />
            </div>

            {/* Cartel / Ícono del oficio (Madeja de Lana) */}
            <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8] shadow-[0_2px_0_#3A2E2B] group-hover:scale-110 transition-transform">
              <span className="text-lg leading-none select-none">🧶</span>
            </div>
          </div>

          {/* Cuerpo de la casa (Muros entramados estilo half-timber) */}
          <div className="w-24 sm:w-28 h-20 bg-[#F7F4EB] border-x-3 border-b-3 border-[#3A2E2B] rounded-b-xl relative p-2 shadow-[0_5px_0_#3A2E2B] flex flex-col justify-between">
            {/* Vigas de madera decorativas */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute left-2 top-0 bottom-0 w-1 bg-[#3A2E2B]/20" />
              <div className="absolute right-2 top-0 bottom-0 w-1 bg-[#3A2E2B]/20" />
              <div className="absolute bottom-0 left-0 right-0 h-2 bg-[#8D6E63] border-t border-[#3A2E2B]" />
            </div>

            {/* Ventana iluminada con luz cálida ámbar */}
            <div className="flex items-center justify-between px-1 pt-1">
              <div className="flex h-5 w-5 items-center justify-center rounded-lg border-2 border-[#3A2E2B] bg-[#FFEAA7] shadow-inner" title="Taller iluminado">
                <div className="h-full w-0.5 bg-[#3A2E2B]/40" />
              </div>

              {/* Placa de Nombre & Tier */}
              <div className="text-right">
                <span className="block text-[9px] font-black text-[#3A2E2B] leading-none">
                  El Atelier
                </span>
                <span className="inline-block mt-0.5 rounded-md bg-[#E7D69C] px-1 py-0.2 text-[7px] font-black text-[#3A2E2B] border border-[#3A2E2B]/30">
                  {tierInfo.badge}
                </span>
              </div>
            </div>

            {/* Puerta de entrada y jardinera */}
            <div className="flex items-end justify-between px-1 z-10">
              {/* Jardinera floral (Tier 2 y 3) */}
              {tierInfo.tier >= 2 ? (
                <span className="text-xs filter drop-shadow select-none">🌸</span>
              ) : (
                <span className="text-[10px] text-[#795548] select-none">🪴</span>
              )}

              {/* Puerta de madera con arco */}
              <div className="w-6 h-8 rounded-t-md border-2 border-[#3A2E2B] bg-[#8D5B4C] relative flex items-center justify-end pr-0.5 shadow-inner">
                <div className="h-1.5 w-1.5 rounded-full bg-[#E7D69C] border border-[#3A2E2B]" />
              </div>
            </div>
          </div>
        </div>

        {/* 3. AVATAR DEL RESIDENTE JUNTO A LA PUERTA (CLARA) */}
        {resident && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              triggerHaptic("light");
              if (onSelectResident) {
                onSelectResident(resident);
              }
            }}
            className="absolute -bottom-1 -right-2 z-30 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#3A2E2B] bg-[#FFFDF8] text-sm shadow-[0_2px_0_#3A2E2B] hover:scale-125 transition-transform"
            title={`Hablar con ${resident.name} (${resident.species})`}
          >
            {resident.avatar}
          </span>
        )}
      </button>

      {/* 4. SOMBRA DE BASE DEL EDIFICIO */}
      <div className="w-24 h-2 bg-[#3A2E2B]/25 rounded-full filter blur-[1px] mt-0.5" />
    </div>
  );
}
