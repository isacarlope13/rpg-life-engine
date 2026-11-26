"use client";

import React from "react";

export interface CozyProgressProps {
  value: number;
  max?: number;
  label?: string;
  valueLabel?: string;
  showPercentage?: boolean;
  variant?: "sage" | "forest" | "sunlight" | "clay";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const FILL_COLORS: Record<string, string> = {
  sage: "bg-[#77936A]",
  forest: "bg-[#314C3C]",
  sunlight: "bg-[#E7D69C]",
  clay: "bg-[#C88973]",
};

const HEIGHT_CLASSES: Record<string, string> = {
  sm: "h-2.5",
  md: "h-4",
  lg: "h-6",
};

export function CozyProgress({
  value,
  max = 100,
  label,
  valueLabel,
  showPercentage = true,
  variant = "sage",
  size = "md",
  className = "",
}: CozyProgressProps) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  const safeVal = Number.isFinite(value) ? value : 0;
  const clampedValue = Math.min(Math.max(0, safeVal), safeMax);
  const percentage = Math.round((clampedValue / safeMax) * 100);

  return (
    <div className={`w-full space-y-1.5 ${className}`}>
      {(label || valueLabel || showPercentage) && (
        <div className="flex items-center justify-between gap-2 text-xs font-black text-[#3A2E2B]">
          {label && <span className="truncate">{label}</span>}
          <span className="font-mono text-[11px] shrink-0">
            {valueLabel ? `${valueLabel}${showPercentage ? ` (${percentage}%)` : ""}` : showPercentage ? `${percentage}%` : ""}
          </span>
        </div>
      )}

      <div
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-label={label || "Progreso"}
        className={`w-full rounded-full border-2 border-[#3A2E2B] bg-[#E8DFCF] p-0.5 overflow-hidden shadow-inner ${HEIGHT_CLASSES[size]}`}
      >
        <div
          className={`relative h-full rounded-full overflow-hidden transition-[width] duration-500 ease-out ${
            percentage > 0 ? "cozy-progress-sheen" : ""
          } ${FILL_COLORS[variant]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
