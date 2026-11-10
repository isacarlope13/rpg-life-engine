"use client";

import React from "react";
import { X } from "lucide-react";
import { triggerHaptic } from "@/lib/offline-sync";

export interface CozyWindowProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onClose?: () => void;
  headerVariant?: "forest" | "wood" | "clay";
}

const HEADER_VARIANTS: Record<string, string> = {
  forest: "bg-[#314C3C] text-[#FFFDF8] border-b-4 border-[#241C1A]",
  wood: "bg-[#D8B48A] text-[#3A2E2B] border-b-4 border-[#3A2E2B]",
  clay: "bg-[#C88973] text-[#FFFDF8] border-b-4 border-[#241C1A]",
};

export function CozyWindow({
  title,
  subtitle,
  icon,
  onClose,
  headerVariant = "wood",
  className = "",
  children,
  ...props
}: CozyWindowProps) {
  const handleClose = () => {
    triggerHaptic("light");
    if (onClose) onClose();
  };

  return (
    <div
      className={`rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] shadow-[0_8px_0_#3A2E2B] overflow-hidden ${className}`}
      {...props}
    >
      {/* Barra de Título Retro */}
      <div
        className={`px-4 py-3 flex items-center justify-between gap-3 ${HEADER_VARIANTS[headerVariant]}`}
      >
        <div className="flex items-center gap-2.5 truncate">
          {icon && <span className="text-lg shrink-0">{icon}</span>}
          <div className="truncate">
            <h3 className="text-sm font-black tracking-tight truncate uppercase">
              {title}
            </h3>
            {subtitle && (
              <p className="text-[10px] font-bold opacity-80 truncate leading-tight">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={handleClose}
            aria-label="Cerrar ventana"
            className="rounded-xl border-2 border-[#3A2E2B] bg-[#E8DFCF] p-1.5 text-[#3A2E2B] hover:bg-[#E9C46A] shadow-[0_2px_0_#3A2E2B] cursor-pointer transition-transform hover:scale-105 shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Contenido Interior */}
      <div className="p-5">{children}</div>
    </div>
  );
}
