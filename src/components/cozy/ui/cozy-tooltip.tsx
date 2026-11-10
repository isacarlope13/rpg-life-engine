"use client";

import React, { useState } from "react";

export interface CozyTooltipProps {
  content: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  children: React.ReactNode;
  className?: string;
}

const POSITION_CLASSES: Record<string, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

export function CozyTooltip({
  content,
  position = "top",
  children,
  className = "",
}: CozyTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          role="tooltip"
          className={`absolute z-40 px-3 py-1.5 rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8] text-[#3A2E2B] text-[11px] font-black shadow-[0_3px_0_#3A2E2B] whitespace-nowrap pointer-events-none transition-opacity duration-150 ${POSITION_CLASSES[position]}`}
        >
          {content}
        </div>
      )}
    </div>
  );
}
