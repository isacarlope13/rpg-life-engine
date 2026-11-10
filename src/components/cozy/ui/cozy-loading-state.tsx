"use client";

import React from "react";
import { Loader2 } from "lucide-react";

export interface CozyLoadingStateProps {
  message?: string;
  variant?: "spinner" | "skeleton";
  className?: string;
}

export function CozyLoadingState({
  message = "Cargando el rincón de Oakhaven...",
  variant = "spinner",
  className = "",
}: CozyLoadingStateProps) {
  if (variant === "skeleton") {
    return (
      <div
        role="status"
        aria-label="Cargando contenido..."
        className={`rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-6 space-y-4 shadow-[0_6px_0_#3A2E2B] animate-pulse ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-[#E8DFCF]" />
          <div className="space-y-1.5 flex-1">
            <div className="h-4 w-1/3 rounded-lg bg-[#E8DFCF]" />
            <div className="h-3 w-1/2 rounded-lg bg-[#E8DFCF]" />
          </div>
        </div>
        <div className="h-20 w-full rounded-2xl bg-[#F7F4EB]" />
        <div className="flex justify-between">
          <div className="h-4 w-1/4 rounded-lg bg-[#E8DFCF]" />
          <div className="h-4 w-1/6 rounded-lg bg-[#E8DFCF]" />
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label="Cargando..."
      className={`rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-8 text-center space-y-3 shadow-[0_6px_0_#3A2E2B] ${className}`}
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-[#3A2E2B] bg-[#E9C46A] shadow-[0_3px_0_#3A2E2B]">
        <Loader2 className="h-7 w-7 text-[#3A2E2B] animate-spin" />
      </div>

      <p className="text-xs font-black text-[#5C4033] tracking-wide">
        {message}
      </p>
    </div>
  );
}
