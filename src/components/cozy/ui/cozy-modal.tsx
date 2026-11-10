"use client";

import React, { useEffect } from "react";
import { CozyWindow } from "./cozy-window";

export interface CozyModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  headerVariant?: "forest" | "wood" | "clay";
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
  children: React.ReactNode;
}

const MAX_WIDTHS: Record<string, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
};

export function CozyModal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  headerVariant = "wood",
  maxWidth = "lg",
  children,
}: CozyModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3A2E2B]/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className={`w-full ${MAX_WIDTHS[maxWidth]} max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <CozyWindow
          title={title}
          subtitle={subtitle}
          icon={icon}
          onClose={onClose}
          headerVariant={headerVariant}
        >
          {children}
        </CozyWindow>
      </div>
    </div>
  );
}
