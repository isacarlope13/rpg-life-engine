"use client";

import React from "react";

export interface CozyCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "parchment" | "cream" | "wood" | "sage";
  bolts?: boolean;
  shadow?: "sm" | "md" | "lg" | "none";
  interactive?: boolean;
}

const VARIANT_BG: Record<string, string> = {
  parchment: "bg-[#FFFDF8] text-[#3A2E2B]",
  cream: "bg-[#F4EEDC] text-[#3A2E2B]",
  wood: "bg-[#E8DFCF] text-[#3A2E2B]",
  sage: "bg-[#EAF3ED] text-[#314C3C]",
};

const SHADOW_MAP: Record<string, string> = {
  none: "shadow-none",
  sm: "shadow-[0_3px_0_#3A2E2B]",
  md: "shadow-[0_6px_0_#3A2E2B]",
  lg: "shadow-[0_8px_0_#3A2E2B]",
};

export function CozyCard({
  variant = "parchment",
  bolts = false,
  shadow = "md",
  interactive = false,
  className = "",
  children,
  ...props
}: CozyCardProps) {
  return (
    <div
      className={`relative rounded-3xl border-4 border-[#3A2E2B] p-5 transition-transform ${
        VARIANT_BG[variant]
      } ${SHADOW_MAP[shadow]} ${
        interactive ? "hover:-translate-y-1 cursor-pointer" : ""
      } ${className}`}
      {...props}
    >
      {bolts && (
        <>
          <span className="absolute top-2.5 left-3 text-xs opacity-60 select-none pointer-events-none">🔩</span>
          <span className="absolute top-2.5 right-3 text-xs opacity-60 select-none pointer-events-none">🔩</span>
          <span className="absolute bottom-2.5 left-3 text-xs opacity-60 select-none pointer-events-none">🔩</span>
          <span className="absolute bottom-2.5 right-3 text-xs opacity-60 select-none pointer-events-none">🔩</span>
        </>
      )}
      {children}
    </div>
  );
}

export function CozyCardHeader({
  icon,
  title,
  subtitle,
  badge,
  actions,
  className = "",
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between border-b-2 border-[#3A2E2B]/10 pb-3 mb-3 ${className}`}>
      <div className="flex items-center gap-2.5">
        {icon && (
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#E9C46A] shadow-[0_2px_0_#3A2E2B] text-lg shrink-0">
            {icon}
          </span>
        )}
        <div>
          <h3 className="text-sm font-black text-[#3A2E2B] uppercase tracking-wide">
            {title}
          </h3>
          {subtitle && (
            <p className="text-[11px] font-bold text-[#795548] leading-tight">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {badge}
        {actions}
      </div>
    </div>
  );
}
