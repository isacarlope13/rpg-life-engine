"use client";

import React from "react";

export interface CozyProgressProps {
  value: number;
  max?: number;
  label?: string;
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
  showPercentage = true,
  variant = "sage",
  size = "md",
  className = "",
}: CozyProgressProps) {
  const clampedValue = Math.min(Math.max(0, value), max);
  const percentage = Math.round((clampedValue / max) * 100);

  return (
    <div className={`w-full space-y-1.5 ${className}`}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between text-xs font-black text-[#3A2E2B]">
          {label && <span>{label}</span>}
          {showPercentage && <span className="font-mono text-[11px]">{percentage}%</span>}
        </div>
      )}

      <div
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={max}
        className={`w-full rounded-full border-2 border-[#3A2E2B] bg-[#E8DFCF] p-0.5 overflow-hidden shadow-inner ${HEIGHT_CLASSES[size]}`}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${FILL_COLORS[variant]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
