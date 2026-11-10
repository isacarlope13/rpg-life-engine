"use client";

import React from "react";
import { CozyButton } from "./cozy-button";

export interface CozyEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  className?: string;
}

export function CozyEmptyState({
  icon = "🧺",
  title,
  description,
  action,
  className = "",
}: CozyEmptyStateProps) {
  return (
    <div
      className={`rounded-3xl border-3 border-dashed border-[#3A2E2B]/30 bg-[#F7F4EB] p-8 text-center space-y-3 ${className}`}
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-[#3A2E2B] bg-[#FFFDF8] text-3xl shadow-[0_3px_0_#3A2E2B]">
        {icon}
      </div>

      <div className="max-w-xs mx-auto space-y-1">
        <h4 className="text-sm font-black text-[#3A2E2B] tracking-tight">
          {title}
        </h4>
        <p className="text-xs text-[#795548] leading-relaxed">
          {description}
        </p>
      </div>

      {action && (
        <div className="pt-2">
          <CozyButton
            variant="wood"
            size="sm"
            icon={action.icon}
            onClick={action.onClick}
          >
            {action.label}
          </CozyButton>
        </div>
      )}
    </div>
  );
}
