"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Play,
  CheckCircle2,
  XCircle,
  Volume2,
  VolumeX,
  Settings,
  ChevronDown,
  ChevronUp,
  Info,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import type { SkillDomain } from "@/types/rpg";
import {
  generateResidentAdvice,
  resolveResidentProposal,
  getStoredResidentSettings,
  saveResidentSettings,
  type ResidentContextData,
  type ResidentActionProposal,
} from "@/lib/sanctuary/cozy-residents-engine";
import { CozyCard, CozyButton, CozyNotification } from "@/components/cozy/ui";
import { triggerHaptic } from "@/lib/offline-sync";

interface ResidentAssistantWidgetProps {
  context: ResidentContextData;
  onPrepareSession?: (prepared: {
    objective: string;
    recommendedMinutes: number;
    resourceTitle?: string;
    resourceId?: string;
    initialNotes?: string;
    metadata?: Record<string, unknown>;
  }) => void;
  onApplyProposal?: (proposal: ResidentActionProposal) => void;
  className?: string;
}

export function ResidentAssistantWidget({
  context,
  onPrepareSession,
  onApplyProposal,
  className = "",
}: ResidentAssistantWidgetProps) {
  const userId = context.userId || "default";
  const [settings, setSettings] = useState(() => getStoredResidentSettings(userId));
  const [isExpanded, setIsExpanded] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "warning" | "error";
    message: string;
  } | null>(null);

  const advice = generateResidentAdvice(context);
  const isMuted =
    !settings.assistantsEnabledGlobal || settings.mutedResidents.includes(context.residentId);

  const handleToggleGlobal = () => {
    triggerHaptic("medium");
    const updated = saveResidentSettings(
      { assistantsEnabledGlobal: !settings.assistantsEnabledGlobal },
      userId
    );
    setSettings(updated);
    setNotification({
      type: "success",
      message: updated.assistantsEnabledGlobal
        ? "✨ Asistentes de Oakhaven activados globalmente."
        : "🔇 Asistentes desactivados. Ahora operas en modo totalmente manual.",
    });
  };

  const handleToggleMuteResident = () => {
    triggerHaptic("light");
    const isCurrentlyMuted = settings.mutedResidents.includes(context.residentId);
    const updatedMuted = isCurrentlyMuted
      ? settings.mutedResidents.filter((id) => id !== context.residentId)
      : [...settings.mutedResidents, context.residentId];

    const updated = saveResidentSettings({ mutedResidents: updatedMuted }, userId);
    setSettings(updated);
    setNotification({
      type: "success",
      message: isCurrentlyMuted
        ? `🔔 ${advice.residentName} reanudará sus consejos contextuales.`
        : `🔇 ${advice.residentName} ha sido silenciado para este edificio.`,
    });
  };

  const handlePrepareClick = () => {
    if (!advice.preparedSession || !onPrepareSession) return;
    triggerHaptic("medium");
    onPrepareSession(advice.preparedSession);
    setNotification({
      type: "success",
      message: `📋 ${advice.residentName} ha configurado tu sesión: "${advice.preparedSession.objective}" (${advice.preparedSession.recommendedMinutes} min).`,
    });
  };

  const handleResolveProposal = (proposal: ResidentActionProposal, decision: "approve" | "reject") => {
    triggerHaptic(decision === "approve" ? "success" : "light");
    const result = resolveResidentProposal({ proposal, decision, userId });

    if (decision === "approve") {
      setNotification({
        type: "success",
        message: `✓ Propuesta aceptada: "${proposal.title}".`,
      });
      if (onApplyProposal) {
        onApplyProposal(result.proposal);
      }
    } else {
      setNotification({
        type: "warning",
        message: `Descartada: "${proposal.title}".`,
      });
    }
  };

  if (!settings.assistantsEnabledGlobal) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-[#3A2E2B]/30 bg-[#F4EEDC]/40 p-3 flex items-center justify-between text-xs text-[#795548]">
        <div className="flex items-center gap-2">
          <span>🔇</span>
          <span>Asistentes de Oakhaven desactivados globalmente.</span>
        </div>
        <button
          type="button"
          onClick={handleToggleGlobal}
          className="font-bold text-[#314C3C] hover:underline cursor-pointer"
        >
          Reactivar
        </button>
      </div>
    );
  }

  return (
    <CozyCard variant="parchment" shadow="md" className={`p-4 sm:p-5 space-y-3 ${className}`}>
      {notification && (
        <div className="mb-2">
          <CozyNotification
            variant={notification.type}
            title={notification.type === "success" ? "¡Listo!" : "Aviso"}
            message={notification.message}
            onDismiss={() => setNotification(null)}
          />
        </div>
      )}

      {/* =========================================================================
          1. HEADER: AVATAR DEL RESIDENTE, NOMBRE, FRASE & BOTÓN DE AJUSTES
         ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[#3A2E2B] bg-[#E7D69C] text-2xl shadow-[0_2px_0_#3A2E2B] select-none">
            {advice.avatar}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-xs sm:text-sm font-black text-[#3A2E2B]">
                {advice.residentName}
              </h4>
              <span className="rounded-full border border-[#3A2E2B] bg-[#B8CCA0] px-2 py-0.2 text-[9px] font-black text-[#3A2E2B]">
                {advice.residentTitle}
              </span>
              <span className="rounded-full bg-[#314C3C]/10 border border-[#314C3C]/20 px-2 py-0.2 text-[9px] font-bold text-[#314C3C]">
                🤖 Asistente Nivel 1 & 2
              </span>
            </div>
            <p className="text-[11px] text-[#795548] italic line-clamp-1 pt-0.5">
              &ldquo;{advice.greetingQuote}&rdquo;
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#3A2E2B]/20 bg-[#F4EEDC] text-[#3A2E2B] hover:bg-[#E7D69C] transition cursor-pointer"
            title="Ajustes de privacidad y silencio del asistente"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>

          <CozyButton
            variant="wood"
            size="sm"
            onClick={() => {
              triggerHaptic("light");
              setIsExpanded(!isExpanded);
            }}
            icon={isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            iconPosition="right"
          >
            {isExpanded ? "Ocultar" : "Ver Asistente"}
          </CozyButton>
        </div>
      </div>

      {/* PANEL DESPLEGABLE DE AJUSTES */}
      {isSettingsOpen && (
        <div className="rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC] p-3 text-xs space-y-2 animate-in fade-in">
          <div className="flex justify-between items-center font-bold text-[#3A2E2B]">
            <span>⚙️ Configuración del Asistente ({advice.residentName})</span>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              className="text-[#795548] hover:text-[#3A2E2B] cursor-pointer"
            >
              ✕
            </button>
          </div>
          <div className="space-y-1.5 pt-1 text-[11px] text-[#795548]">
            <p className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-[#314C3C]" />
              <strong>Seguridad Garantizada:</strong> Los residentes jamás emiten GP, XP ni alteran balances financieros (Nivel 3 protegido).
            </p>
          </div>
          <div className="flex flex-wrap gap-2 pt-1 border-t border-[#3A2E2B]/15">
            <button
              type="button"
              onClick={handleToggleMuteResident}
              className="rounded-xl border border-[#3A2E2B] bg-[#FFFDF8] px-2.5 py-1 text-[10px] font-black text-[#3A2E2B] hover:bg-[#F4EEDC] cursor-pointer flex items-center gap-1"
            >
              {isMuted ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
              <span>{isMuted ? "Reactivar a este asistente" : "Silenciar a este asistente"}</span>
            </button>
            <button
              type="button"
              onClick={handleToggleGlobal}
              className="rounded-xl border border-[#C88973] bg-[#C88973]/15 px-2.5 py-1 text-[10px] font-black text-[#8A3722] hover:bg-[#C88973]/30 cursor-pointer"
            >
              Desactivar Asistentes Globalmente
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          2. CUERPO DEL ASISTENTE: RESUMEN CONTEXTUAL & PREPARACIÓN DE SESIÓN
         ========================================================================= */}
      {isExpanded && !isMuted && (
        <div className="space-y-3 pt-1 border-t border-[#3A2E2B]/15">
          <div className="rounded-2xl border-2 border-[#3A2E2B]/15 bg-[#F4EEDC]/60 p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-black text-[#314C3C]">
              <span>💡</span>
              <span>Memoria & Resumen de Actividad Reciente:</span>
            </div>
            <p className="text-xs text-[#3A2E2B] font-medium leading-relaxed">
              {advice.contextSummary}
            </p>
            {advice.level1Recommendations.length > 0 && (
              <ul className="text-[11px] text-[#795548] list-disc list-inside space-y-0.5 pt-1">
                {advice.level1Recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            )}
          </div>

          {/* BOTÓN PREPARAR SESIÓN AUTOMÁTICAMENTE (NIVEL 1) */}
          {advice.preparedSession && onPrepareSession && (
            <div className="rounded-2xl border-2 border-[#77936A] bg-[#EAF3ED] p-3 flex flex-wrap items-center justify-between gap-3 shadow-[0_2px_0_#3A2E2B]">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#3A2E2B] bg-[#77936A] text-[#FFFDF8] text-base">
                  ⚡
                </span>
                <div>
                  <span className="text-[10px] font-black uppercase text-[#314C3C] tracking-wide block">
                    Sesión Sugerida Lista para Cargar
                  </span>
                  <p className="text-xs font-bold text-[#2A4331]">
                    {advice.preparedSession.objective} ({advice.preparedSession.recommendedMinutes} min)
                  </p>
                </div>
              </div>

              <CozyButton
                variant="forest"
                size="sm"
                onClick={handlePrepareClick}
                className="flex items-center gap-1.5"
              >
                <Play className="h-3.5 w-3.5" />
                <span>Cargar en el Temporizador ➜</span>
              </CozyButton>
            </div>
          )}

          {/* =====================================================================
              3. PROPUESTAS DE AUTOMATIZACIÓN NIVEL 2 (HITL — REQUIERE CONFIRMACIÓN)
             ===================================================================== */}
          {advice.pendingProposals.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase text-[#8A3722] tracking-wider block">
                🔔 Propuestas que Requieren tu Confirmación (Nivel 2 HITL):
              </span>
              {advice.pendingProposals.map((prop) => (
                <div
                  key={prop.proposalId}
                  className="rounded-2xl border-3 border-[#C88973] bg-[#FFFDF8] p-3.5 shadow-[0_3px_0_#8A3722] space-y-2 animate-in fade-in"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">📜</span>
                      <h5 className="text-xs font-black text-[#3A2E2B]">{prop.title}</h5>
                    </div>
                    <span className="rounded-full bg-[#C88973]/20 border border-[#C88973] px-2 py-0.5 text-[9px] font-black text-[#8A3722]">
                      HITL Nivel 2
                    </span>
                  </div>

                  <p className="text-xs text-[#795548] leading-relaxed">
                    {prop.description}
                  </p>

                  <div className="flex justify-end gap-2 pt-1 border-t border-[#3A2E2B]/10">
                    <button
                      type="button"
                      onClick={() => handleResolveProposal(prop, "reject")}
                      className="rounded-xl border border-[#3A2E2B]/30 bg-[#F4EEDC] px-3 py-1 text-xs font-bold text-[#795548] hover:bg-[#E7D69C] cursor-pointer flex items-center gap-1"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      <span>Descartar</span>
                    </button>
                    <CozyButton
                      variant="forest"
                      size="sm"
                      onClick={() => handleResolveProposal(prop, "approve")}
                      className="flex items-center gap-1"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Aceptar y Aplicar</span>
                    </CozyButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </CozyCard>
  );
}
