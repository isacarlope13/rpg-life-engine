"use client";

import React from "react";
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from "lucide-react";

export type CozyNotificationVariant = "success" | "info" | "warning" | "error";

export interface CozyNotificationProps {
  variant?: CozyNotificationVariant;
  title?: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
  className?: string;
}

const NOTIFICATION_STYLES: Record<
  CozyNotificationVariant,
  { bg: string; border: string; text: string; icon: React.ReactNode }
> = {
  success: {
    bg: "bg-[#EAF3ED]",
    border: "border-[#4E6E58]",
    text: "text-[#2B542C]",
    icon: <CheckCircle2 className="h-4 w-4 text-[#4E6E58] shrink-0" />,
  },
  info: {
    bg: "bg-[#EFF6F9]",
    border: "border-[#A9C7C7]",
    text: "text-[#2C4D56]",
    icon: <Info className="h-4 w-4 text-[#3D707A] shrink-0" />,
  },
  warning: {
    bg: "bg-[#FFF8E7]",
    border: "border-[#E9C46A]",
    text: "text-[#7A5B15]",
    icon: <AlertTriangle className="h-4 w-4 text-[#B88714] shrink-0" />,
  },
  error: {
    bg: "bg-[#FDF0ED]",
    border: "border-[#C88973]",
    text: "text-[#8A3722]",
    icon: <XCircle className="h-4 w-4 text-[#C88973] shrink-0" />,
  },
};

export function CozyNotification({
  variant = "info",
  title,
  message,
  action,
  onDismiss,
  className = "",
}: CozyNotificationProps) {
  const style = NOTIFICATION_STYLES[variant];

  return (
    <div
      role="status"
      className={`rounded-2xl border-[3px] p-4 shadow-[0_3px_0_#3A2E2B] flex items-start justify-between gap-3 ${style.bg} ${style.border} ${className}`}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5">{style.icon}</span>
        <div className="space-y-0.5">
          {title && (
            <h4 className={`text-xs font-black ${style.text}`}>{title}</h4>
          )}
          <p className="text-xs text-[#5C4033] leading-relaxed">{message}</p>

          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="mt-2 inline-flex text-xs font-black text-[#3A2E2B] underline hover:opacity-80 cursor-pointer"
            >
              {action.label} ➜
            </button>
          )}
        </div>
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Cerrar notificación"
          className="text-[#795548] hover:text-[#3A2E2B] p-1 cursor-pointer transition-transform hover:scale-110"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
