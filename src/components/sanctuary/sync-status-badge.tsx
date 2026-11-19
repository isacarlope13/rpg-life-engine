"use client";

import React from "react";
import { Cloud, CloudOff, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { SyncStatusLabel } from "@/lib/sync/universal-sync-engine";

interface SyncStatusBadgeProps {
  status: SyncStatusLabel;
  onReviewConflict?: () => void;
}

const META: Record<SyncStatusLabel, { text: string; cls: string; icon: React.ReactNode }> = {
  SINCRONIZADO: {
    text: "Sincronizado",
    cls: "bg-emerald-100 text-emerald-900 border-emerald-500",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  PENDIENTE_DE_SINCRONIZAR: {
    text: "Pendiente de sincronizar",
    cls: "bg-amber-100 text-amber-900 border-amber-500",
    icon: <RefreshCw className="h-3 w-3" />,
  },
  SIN_CONEXION: {
    text: "Sin conexión (respaldo local activo)",
    cls: "bg-stone-200 text-stone-800 border-stone-500",
    icon: <CloudOff className="h-3 w-3" />,
  },
  CONFLICTO_REQUIERE_REVISION: {
    text: "Conflicto que requiere revisión",
    cls: "bg-purple-100 text-purple-900 border-purple-500",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  ERROR_RECUPERABLE: {
    text: "Error recuperable (datos locales a salvo)",
    cls: "bg-red-100 text-red-900 border-red-400",
    icon: <Cloud className="h-3 w-3" />,
  },
};

export function SyncStatusBadge({ status, onReviewConflict }: SyncStatusBadgeProps) {
  const m = META[status];
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-black ${m.cls}`}
    >
      {m.icon}
      <span>{m.text}</span>
      {status === "CONFLICTO_REQUIERE_REVISION" && onReviewConflict && (
        <button
          type="button"
          onClick={onReviewConflict}
          className="ml-1 underline hover:opacity-80 cursor-pointer"
        >
          Revisar
        </button>
      )}
    </span>
  );
}
