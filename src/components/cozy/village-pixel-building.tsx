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
  isSelected?: boolean;
  onInspect: () => void;
  onEnter: () => void;
  onSelectResident?: (resident: VillageResident) => void;
}

/**
 * EDIFICIOS PIXEL ART DE OAKHAVEN (FASE 4.0 LIVING WORLD & DESATURATION)
 * Arquitectura visual limpia sin solapamientos ni etiquetas permanentes truncadas.
 * Muestra información completa al seleccionar o posar el cursor, respetando movimiento reducido.
 */
export function VillagePixelBuilding({
  building,
  tierInfo,
  pending,
  resident,
  isHovered,
  isSelected = false,
  onInspect,
  onEnter,
  onSelectResident,
}: VillagePixelBuildingProps) {
  const isTier1 = tierInfo.tier === 1;
  const isTier2 = tierInfo.tier === 2;
  const isTier3 = tierInfo.tier >= 3;

  const isGreenhouse = building.id === "invernadero" || building.id === "pabellon_gardening";
  const isAtelier = building.id === "atelier";
  const isBank = building.id === "banco_oakhaven" || building.id === "banco";

  // Colores temáticos por distrito
  const getDistrictRoofGradient = () => {
    if (isBank) {
      return isTier3
        ? "bg-gradient-to-b from-[#D4AF37] to-[#7D6116]"
        : isTier2
        ? "bg-gradient-to-b from-[#E6C653] to-[#997A24]"
        : "bg-gradient-to-b from-[#F3DE8A] to-[#B3923B]";
    }
    if (isGreenhouse) {
      return isTier3
        ? "bg-gradient-to-b from-[#2D5A3E] to-[#1E3B29]"
        : isTier2
        ? "bg-gradient-to-b from-[#4E7D5C] to-[#34583F]"
        : "bg-gradient-to-b from-[#779B80] to-[#55775E]";
    }
    if (isAtelier) {
      return isTier3
        ? "bg-gradient-to-b from-[#4A5D4E] to-[#2E3D31]"
        : isTier2
        ? "bg-gradient-to-b from-[#C88973] to-[#A25842]"
        : "bg-gradient-to-b from-[#D4A373] to-[#B07D4C]";
    }
    // Por distrito
    if (building.district === "saber") {
      return isTier3
        ? "bg-gradient-to-b from-[#2B4162] to-[#172538]"
        : isTier2
        ? "bg-gradient-to-b from-[#385A85] to-[#243D5C]"
        : "bg-gradient-to-b from-[#56759E] to-[#3C5779]";
    }
    if (building.district === "artes") {
      return isTier3
        ? "bg-gradient-to-b from-[#8B4F39] to-[#5C2E1F]"
        : isTier2
        ? "bg-gradient-to-b from-[#C88973] to-[#8C523F]"
        : "bg-gradient-to-b from-[#DDA15E] to-[#996236]";
    }
    // Naturaleza / otros
    return isTier3
      ? "bg-gradient-to-b from-[#314C3C] to-[#1C2C23]"
      : isTier2
      ? "bg-gradient-to-b from-[#4E6E58] to-[#2F4A39]"
      : "bg-gradient-to-b from-[#6B8F76] to-[#43644D]";
  };

  return (
    <div className="relative flex flex-col items-center select-none group">
      {/* 1. INDICADOR SUTIL DE ACTIVIDAD (Sin saturación: aparece al hover o selección) */}
      {pending.hasPending && (
        <span
          className={`absolute -top-7 z-30 flex items-center gap-1 rounded-full border-2 border-[#3A2E2B] bg-[#E7D69C] px-2.5 py-0.5 text-[9px] font-black text-[#3A2E2B] shadow-[0_2px_0_#3A2E2B] transition-all duration-200 whitespace-nowrap ${
            isHovered || isSelected ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
          }`}
        >
          <span>⚡</span> {pending.label || "Actividad disponible"}
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
        className={`relative flex flex-col items-center justify-end w-32 sm:w-36 h-36 rounded-2xl transition-all duration-200 cursor-pointer ${
          isHovered || isSelected ? "-translate-y-2 scale-105" : ""
        } ${isSelected ? "ring-4 ring-[#FDDA24] ring-offset-2 rounded-3xl" : ""}`}
      >
        {/* Luz Cálida / Beacon Sutil de Actividad Pendiente */}
        {pending.hasPending && (
          <span
            className="absolute -top-1 -right-1 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 border border-[#3A2E2B] text-[8px] shadow-sm animate-pulse"
            title={pending.label || "Actividad disponible"}
          >
            ⚡
          </span>
        )}

        {/* Chimenea o Cúpula de Ventilación */}
        {isGreenhouse ? (
          <div className="absolute top-1 left-6 z-0 flex flex-col items-center">
            <span className="text-[10px] opacity-75">🌱</span>
            <div className="w-4 h-4 bg-[#4E6E58] border-2 border-[#3A2E2B] rounded-full shadow-sm" />
          </div>
        ) : (
          <div className="absolute top-1 left-4 z-0 flex flex-col items-center">
            <span className="text-[10px] opacity-75">💭</span>
            <div className="w-3.5 h-6 bg-[#6E4B38] border-2 border-[#3A2E2B] rounded-t-sm shadow-sm" />
          </div>
        )}

        {/* Estandarte de Maestría (Tier 3) */}
        {isTier3 && (
          <div className="absolute -top-3 right-3 z-20 flex items-center gap-1">
            <span className="text-base filter drop-shadow">🚩</span>
          </div>
        )}

        {/* Farol Artesanal Exterior (Tier 2+) */}
        {tierInfo.tier >= 2 && (
          <div
            className="absolute top-12 -left-2 z-20 filter drop-shadow"
            title="Farol encendido de edificio activo"
          >
            <span className="text-sm">🏮</span>
          </div>
        )}

        {/* ESTRUCTURA SVG DEL EDIFICIO: TEJADO Y FACHADA MEDIEVAL COZY */}
        <div className="relative z-10 w-full h-full flex flex-col items-center justify-end">
          {/* Tejado de Vidrio (Invernadero) o Tejas a Dos Aguas */}
          <div
            className={`w-28 sm:w-32 h-14 rounded-t-xl border-3 border-[#3A2E2B] relative flex items-center justify-center shadow-[0_4px_0_#3A2E2B] overflow-hidden ${getDistrictRoofGradient()}`}
          >
            {/* Vidrieras con luz solar en Invernadero */}
            {isGreenhouse ? (
              <div className="absolute inset-0 grid grid-cols-4 gap-1 p-1 opacity-60">
                <div className="bg-[#BCE3C5]/40 border border-[#3A2E2B]/30 rounded-sm" />
                <div className="bg-[#E2F7E7]/50 border border-[#3A2E2B]/30 rounded-sm" />
                <div className="bg-[#BCE3C5]/40 border border-[#3A2E2B]/30 rounded-sm" />
                <div className="bg-[#E2F7E7]/50 border border-[#3A2E2B]/30 rounded-sm" />
              </div>
            ) : (
              /* Líneas de tejas / textura en otros edificios */
              <div className="absolute inset-0 opacity-25 flex flex-col justify-around py-1 pointer-events-none">
                <div className="w-full border-b border-[#3A2E2B]" />
                <div className="w-full border-b border-[#3A2E2B]" />
                <div className="w-full border-b border-[#3A2E2B]" />
              </div>
            )}

            {/* Cartel / Ícono del edificio */}
            <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8] shadow-[0_2px_0_#3A2E2B] group-hover:scale-110 transition-transform">
              <span className="text-lg leading-none select-none">{building.icon}</span>
            </div>
          </div>

          {/* Cuerpo de la casa (Muros entramados estilo half-timber, invernadero acristalado o banco de piedra) */}
          <div
            className={`w-24 sm:w-28 h-20 border-x-3 border-b-3 border-[#3A2E2B] rounded-b-xl relative p-2 shadow-[0_5px_0_#3A2E2B] flex flex-col justify-between ${
              isBank
                ? "bg-[#FFFDF8]" // Piedra noble del Banco
                : isGreenhouse
                ? "bg-[#EAF4EC]" // Tono translúcido de jardín botánico
                : "bg-[#F7F4EB]" // Crema de entramado de madera
            }`}
          >
            {/* Vigas o Columnas Clásicas */}
            <div className="absolute inset-0 pointer-events-none">
              {isBank ? (
                <>
                  <div className="absolute left-1.5 top-0 bottom-0 w-2.5 bg-[#E2DBD0] border-x border-[#3A2E2B]/40" />
                  <div className="absolute right-1.5 top-0 bottom-0 w-2.5 bg-[#E2DBD0] border-x border-[#3A2E2B]/40" />
                  <div className="absolute bottom-0 left-0 right-0 h-2 bg-[#AA820A] border-t border-[#3A2E2B]" />
                </>
              ) : (
                <>
                  <div className="absolute left-2 top-0 bottom-0 w-1 bg-[#3A2E2B]/20" />
                  <div className="absolute right-2 top-0 bottom-0 w-1 bg-[#3A2E2B]/20" />
                  <div className="absolute bottom-0 left-0 right-0 h-2 bg-[#8D6E63] border-t border-[#3A2E2B]" />
                </>
              )}
            </div>

            {/* Ventana iluminada / Cristales de canteros */}
            <div className="flex items-center justify-between px-1 pt-1">
              {isGreenhouse ? (
                <div
                  className="flex h-5 w-6 items-center justify-center rounded-lg border-2 border-[#3A2E2B] bg-[#A7D7B5] shadow-inner text-xs"
                  title="Plantas interiores"
                >
                  <span>🌿</span>
                </div>
              ) : isBank ? (
                <div
                  className="flex h-5 w-6 items-center justify-center rounded-lg border-2 border-[#3A2E2B] bg-[#F9E79F] shadow-inner text-xs"
                  title="Ventanilla del Banco"
                >
                  <span>🪙</span>
                </div>
              ) : (
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-lg border-2 border-[#3A2E2B] shadow-inner ${
                    pending.hasPending ? "bg-[#FFF176]" : "bg-[#FFEAA7]"
                  }`}
                  title="Taller iluminado"
                >
                  <div className="h-full w-0.5 bg-[#3A2E2B]/40" />
                </div>
              )}

              {/* Insignia de Nivel y Tier Limpio */}
              <div className="text-right">
                <span className="inline-block rounded-md bg-[#E7D69C] px-1.5 py-0.5 text-[8px] font-black text-[#3A2E2B] border border-[#3A2E2B]/30">
                  {tierInfo.badge}
                </span>
              </div>
            </div>

            {/* Puerta de entrada y decoraciones exteriores */}
            <div className="flex items-end justify-between px-1 z-10">
              {isBank ? (
                <span className="text-xs filter drop-shadow select-none">⚖️</span>
              ) : isGreenhouse ? (
                <span className="text-xs filter drop-shadow select-none">🌻</span>
              ) : tierInfo.tier >= 2 ? (
                <span className="text-xs filter drop-shadow select-none">🌸</span>
              ) : (
                <span className="text-[10px] text-[#795548] select-none">🪴</span>
              )}

              {/* Puerta de madera con arco o bóveda acorazada */}
              <div
                className={`w-6 h-8 rounded-t-md border-2 border-[#3A2E2B] relative flex items-center justify-end pr-0.5 shadow-inner ${
                  isBank ? "bg-[#D4AF37]" : isGreenhouse ? "bg-[#3D6649]" : "bg-[#8D5B4C]"
                }`}
              >
                <div
                  className={`h-1.5 w-1.5 rounded-full ${
                    isBank ? "bg-[#1A1508] border border-[#AA820A]" : "bg-[#E7D69C] border border-[#3A2E2B]"
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 3. AVATAR DEL RESIDENTE JUNTO A LA PUERTA */}
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

      {/* 4. PLACA DE IDENTIFICACIÓN LIMPIA INFERIOR */}
      <div className="mt-1 flex flex-col items-center">
        <span
          className={`text-[10px] font-black rounded-lg px-2 py-0.5 border text-center transition-all ${
            isSelected
              ? "bg-[#314C3C] text-white border-[#1B2920] shadow-sm"
              : isHovered
              ? "bg-[#FFFDF8] text-[#3A2E2B] border-[#3A2E2B]"
              : "bg-[#FFFDF8]/85 text-[#3A2E2B] border-[#3A2E2B]/20"
          }`}
        >
          {building.name}
        </span>
      </div>

      {/* 5. SOMBRA DE BASE DEL EDIFICIO */}
      <div className="w-24 h-2 bg-[#3A2E2B]/20 rounded-full filter blur-[1px] mt-0.5" />
    </div>
  );
}
