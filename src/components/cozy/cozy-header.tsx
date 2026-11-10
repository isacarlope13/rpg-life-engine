"use client";

import React from "react";
import { LayoutGrid, Compass, Coins, BookOpen } from "lucide-react";

interface CozyHeaderProps {
  currentDate: string;
  currentTime: string;
  viewMode: "bento" | "village_map";
  onViewModeChange: (mode: "bento" | "village_map") => void;
  onOpenScrapbook: () => void;
  walletGp: number;
  vaultGp: number;
}

export function CozyHeader({
  currentDate,
  currentTime,
  viewMode,
  onViewModeChange,
  onOpenScrapbook,
  walletGp,
  vaultGp,
}: CozyHeaderProps) {
  return (
    <header className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-4 sm:p-5 shadow-[0_6px_0_#3A2E2B] flex flex-wrap items-center justify-between gap-4">
      {/* Izquierda: Fecha & Nombre */}
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border-[3px] border-[#3A2E2B] bg-[#4E6E58] text-[#FFFDF8] shadow-[0_3px_0_#3A2E2B] text-xl">
          📜
        </span>
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#795548]">
            Bitácora de Oakhaven
          </span>
          <h2 className="text-sm sm:text-base font-black text-[#3A2E2B] capitalize">
            {currentDate || "Cargando fecha..."}
          </h2>
        </div>
      </div>

      {/* Centro: Switcher de Vistas (Bento vs Pueblo vs Álbum) */}
      <div className="flex items-center rounded-2xl border-[3px] border-[#3A2E2B] bg-[#F7F4EB] p-1 shadow-[0_3px_0_#3A2E2B]">
        <button
          type="button"
          onClick={() => onViewModeChange("bento")}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition cursor-pointer ${
            viewMode === "bento"
              ? "bg-[#4E6E58] text-[#FFFDF8] shadow-sm"
              : "text-[#3A2E2B] hover:bg-[#E8DFCF]"
          }`}
        >
          <LayoutGrid className="h-3.5 w-3.5" /> Tablero Bento
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange("village_map")}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition cursor-pointer ${
            viewMode === "village_map"
              ? "bg-[#4E6E58] text-[#FFFDF8] shadow-sm"
              : "text-[#3A2E2B] hover:bg-[#E8DFCF]"
          }`}
        >
          <Compass className="h-3.5 w-3.5" /> Pueblo Vivo
        </button>
        <button
          type="button"
          onClick={onOpenScrapbook}
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition cursor-pointer text-[#3A2E2B] hover:bg-[#E8DFCF]"
          title="Abrir álbum de recuerdos y postales"
        >
          📷 Álbum
        </button>
      </div>

      {/* Derecha: Monedas y Reloj en Vivo */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center gap-2 rounded-2xl border-[3px] border-[#3A2E2B] bg-[#E9C46A] px-3.5 py-2 text-[#3A2E2B] shadow-[0_3px_0_#3A2E2B]"
          title={`Billetera: ${walletGp.toLocaleString("es-CO")} GP • Bóveda: ${vaultGp.toLocaleString("es-CO")} GP`}
        >
          <Coins className="h-4 w-4" />
          <span className="font-mono text-xs sm:text-sm font-black">
            {walletGp.toLocaleString("es-CO")} <span className="text-[10px]">GP</span>
          </span>
        </div>

        <div className="flex items-center gap-2 rounded-2xl border-[3px] border-[#3A2E2B] bg-[#3A2E2B] px-3.5 py-2 text-[#F7F4EB] shadow-[0_3px_0_#5C4033]">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-mono text-xs sm:text-sm font-black tracking-wider">
            {currentTime || "--:--:--"}
          </span>
        </div>
      </div>
    </header>
  );
}
