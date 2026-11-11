"use client";

import React, { useState } from "react";
import { Zap, Send, Sparkles, CheckCircle2, AlertCircle, Coffee, BookOpen, Clock, Heart } from "lucide-react";
import { CozyModal, CozyButton, CozyCard, CozyNotification } from "@/components/cozy/ui";
import { triggerHaptic } from "@/lib/offline-sync";

interface CozyQuickCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void | Promise<void>;
}

const QUICK_PRESETS = [
  { label: "Café / Snack", command: "Café merienda 6500", icon: "☕" },
  { label: "Almuerzo", command: "Almuerzo corriente 15000", icon: "🍲" },
  { label: "Lectura (15m)", command: "Leí 10 páginas de mi libro 15 minutos", icon: "📚" },
  { label: "Tejido (15m)", command: "Tejí 3 vueltas de bufanda 15 minutos", icon: "🧶" },
  { label: "Cubo WCA (10m)", command: "Armé cubo de rubik 10 minutos", icon: "🧩" },
  { label: "Caminata (20m)", command: "Caminata consciente 20 minutos", icon: "🥾" },
];

export function CozyQuickCaptureModal({
  isOpen,
  onClose,
  onSuccess,
}: CozyQuickCaptureModalProps) {
  const [commandText, setCommandText] = useState("");
  const [busy, setBusy] = useState(false);
  const [resultMsg, setResultMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (!isOpen) return null;

  const handleExecute = async (textToRun: string) => {
    const trimmed = textToRun.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    setResultMsg(null);
    triggerHaptic("light");

    try {
      const res = await fetch("/api/shortcuts/omni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          use_aegis_shield: true,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setResultMsg({
          type: "success",
          text: data.reply || "¡Acción registrada exitosamente en el Valle de Oakhaven!",
        });
        setCommandText("");
        triggerHaptic("success");
        if (onSuccess) {
          await onSuccess();
        }
      } else {
        setResultMsg({
          type: "error",
          text: data.error || "No se pudo interpretar el comando. Intenta con un formato más simple.",
        });
        triggerHaptic("warning");
      }
    } catch {
      setResultMsg({
        type: "error",
        text: "Error de conexión al procesar el comando omnicanal.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleExecute(commandText);
  };

  return (
    <CozyModal
      isOpen={isOpen}
      onClose={onClose}
      title="Captura Rápida Omnicanal"
      subtitle="Escribe un gasto, hábito o actividad en lenguaje natural (ej. 'Almuerzo 15000' o 'Leí 20 min')"
      icon="⚡"
      headerVariant="wood"
      maxWidth="md"
    >
      <div className="space-y-4 text-[#3A2E2B]">
        {/* MENSAJE DE FEEDBACK */}
        {resultMsg && (
          <CozyNotification
            variant={resultMsg.type === "success" ? "success" : "warning"}
            message={resultMsg.text}
            onDismiss={() => setResultMsg(null)}
          />
        )}

        {/* FORMULARIO DE ENTRADA OMNICANAL */}
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <label className="text-[11px] font-black uppercase tracking-wider text-[#795548] flex items-center justify-between">
            <span>Comando en Lenguaje Natural</span>
            <span className="text-[10px] text-[#4E6E58] font-bold">⚡ IA & Aegis Shield</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={commandText}
              onChange={(e) => setCommandText(e.target.value)}
              placeholder="Ej: Almuerzo 16000  ó  Leí 15 páginas..."
              disabled={busy}
              className="flex-1 rounded-2xl border-3 border-[#3A2E2B] bg-[#FFFDF8] px-4 py-2.5 text-xs font-semibold text-[#3A2E2B] placeholder:text-[#795548]/60 focus:outline-none focus:ring-2 focus:ring-[#77936A] shadow-[0_2px_0_#3A2E2B]"
              autoFocus
            />
            <CozyButton
              type="submit"
              variant="forest"
              size="sm"
              disabled={busy || !commandText.trim()}
              icon={<Send className="h-4 w-4" />}
            >
              {busy ? "..." : "Enviar"}
            </CozyButton>
          </div>
        </form>

        {/* ACCIONES RÁPIDAS DE UN CLIC */}
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-[#795548] block mb-2">
            Atajos Rápidos Más Frecuentes:
          </span>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                disabled={busy}
                onClick={() => handleExecute(p.command)}
                className="flex items-center gap-2 rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] p-2.5 text-left text-xs font-bold text-[#3A2E2B] shadow-[0_2px_0_#3A2E2B] hover:bg-[#FFFDF8] hover:-translate-y-0.5 transition cursor-pointer disabled:opacity-50"
              >
                <span className="text-lg select-none">{p.icon}</span>
                <span className="truncate">{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* PIE */}
        <div className="pt-2 text-right border-t-2 border-[#3A2E2B]/10">
          <CozyButton
            variant="wood"
            size="sm"
            onClick={onClose}
          >
            Cerrar
          </CozyButton>
        </div>
      </div>
    </CozyModal>
  );
}
