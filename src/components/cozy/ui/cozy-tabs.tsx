"use client";

import React from "react";
import { triggerHaptic } from "@/lib/offline-sync";

export interface CozyTabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

export interface CozyTabsProps {
  tabs: CozyTabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: "pills" | "wooden";
  className?: string;
}

export function CozyTabs({
  tabs,
  activeTab,
  onChange,
  variant = "wooden",
  className = "",
}: CozyTabsProps) {
  const handleTabClick = (id: string) => {
    triggerHaptic("light");
    onChange(id);
  };

  return (
    <div
      role="tablist"
      className={`flex flex-wrap items-center gap-2 ${
        variant === "wooden"
          ? "rounded-2xl border-[3px] border-[#3A2E2B] bg-[#F7F4EB] p-1.5 shadow-[0_2px_0_#3A2E2B]"
          : "gap-1.5"
      } ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => handleTabClick(tab.id)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition-all cursor-pointer ${
              isActive
                ? "border-2 border-[#3A2E2B] bg-[#4E6E58] text-[#FFFDF8] shadow-[0_2px_0_#3A2E2B] -translate-y-0.5"
                : "border-2 border-transparent bg-transparent text-[#3A2E2B] hover:bg-[#E8DFCF] hover:border-[#3A2E2B]/20"
            }`}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge && (
              <span className="shrink-0 rounded-full bg-[#E9C46A] px-1.5 py-0.2 text-[9px] font-black text-[#3A2E2B]">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
