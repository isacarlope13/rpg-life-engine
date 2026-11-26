"use client";

import React, { forwardRef } from "react";
import { triggerHaptic } from "@/lib/offline-sync";

export type CozyButtonVariant =
  | "forest"
  | "wood"
  | "clay"
  | "sunlight"
  | "sage"
  | "lake"
  | "cream"
  | "ghost";

export type CozyButtonSize = "sm" | "md" | "lg";

export interface CozyButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: CozyButtonVariant;
  size?: CozyButtonSize;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  disableHaptic?: boolean;
  loading?: boolean;
}

const VARIANT_CLASSES: Record<CozyButtonVariant, string> = {
  forest:
    "bg-[#314C3C] text-[#FFFDF8] border-[#3A2E2B] shadow-[0_3px_0_#241C1A] hover:bg-[#3E5F4C]",
  wood:
    "bg-[#D8B48A] text-[#3A2E2B] border-[#3A2E2B] shadow-[0_3px_0_#3A2E2B] hover:bg-[#E5C7A2]",
  clay:
    "bg-[#C88973] text-[#FFFDF8] border-[#3A2E2B] shadow-[0_3px_0_#241C1A] hover:bg-[#D59A85]",
  sunlight:
    "bg-[#E7D69C] text-[#3A2E2B] border-[#3A2E2B] shadow-[0_3px_0_#3A2E2B] hover:bg-[#EFE2B3]",
  sage:
    "bg-[#77936A] text-[#FFFDF8] border-[#3A2E2B] shadow-[0_3px_0_#241C1A] hover:bg-[#88A67B]",
  lake:
    "bg-[#A9C7C7] text-[#2C4D56] border-[#3A2E2B] shadow-[0_3px_0_#3A2E2B] hover:bg-[#BBD7D7]",
  cream:
    "bg-[#F4EEDC] text-[#3A2E2B] border-[#3A2E2B] shadow-[0_3px_0_#3A2E2B] hover:bg-[#FAF6EC]",
  ghost:
    "bg-transparent text-[#3A2E2B] border-transparent shadow-none hover:bg-[#3A2E2B]/10 hover:border-[#3A2E2B]/20",
};

const SIZE_CLASSES: Record<CozyButtonSize, string> = {
  sm: "px-2.5 py-1 text-[11px] rounded-xl gap-1.5",
  md: "px-4 py-2 text-xs rounded-2xl gap-2",
  lg: "px-5 py-3 text-sm rounded-2xl gap-2.5",
};

export const CozyButton = forwardRef<HTMLButtonElement, CozyButtonProps>(
  (
    {
      variant = "forest",
      size = "md",
      icon,
      iconPosition = "left",
      disableHaptic = false,
      loading = false,
      onClick,
      disabled,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = Boolean(disabled || loading);
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isDisabled) return;
      if (!disableHaptic) {
        triggerHaptic("light");
      }
      if (onClick) {
        onClick(e);
      }
    };

    return (
      <button
        ref={ref}
        type="button"
        disabled={isDisabled}
        aria-busy={loading || undefined}
        onClick={handleClick}
        className={`inline-flex items-center justify-center font-black transition-all duration-150 ease-out cursor-pointer select-none border-[3px] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E7D69C]/90 focus-visible:ring-offset-1 active:translate-y-[2px] active:shadow-[0_1px_0_#241C1A] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
          VARIANT_CLASSES[variant]
        } ${SIZE_CLASSES[size]} ${
          isDisabled ? "" : "hover:-translate-y-0.5"
        } ${className}`}
        {...props}
      >
        {loading && (
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0"
          />
        )}
        {!loading && icon && iconPosition === "left" && <span className="shrink-0">{icon}</span>}
        {children && <span>{children}</span>}
        {!loading && icon && iconPosition === "right" && <span className="shrink-0">{icon}</span>}
      </button>
    );
  }
);

CozyButton.displayName = "CozyButton";
