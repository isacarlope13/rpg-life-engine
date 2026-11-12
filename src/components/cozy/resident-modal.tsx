"use client";

import React, { useState } from "react";
import { X, Heart, Sparkles, Check, Coffee, ArrowRight, Loader2 } from "lucide-react";
import type { SkillSessionRecord, SkillDomainSummary } from "@/types/rpg";
import type { VillageResident } from "@/lib/sanctuary/village-tiers";
import { triggerHaptic } from "@/lib/offline-sync";

interface ResidentModalProps {
  resident: VillageResident | null;
  onClose: () => void;
  onOpenBuilding: (buildingId: string) => void;
  onSubmitSkillSession: (payload: Record<string, unknown>) => Promise<boolean>;
  domainSummary?: SkillDomainSummary;
  recentSessions: SkillSessionRecord[];
}

/**
 * Calcula el nivel de afinidad / amistad del jugador con el residente
 * de forma determinista basándose en las sesiones completadas en su dominio.
 * Sin migraciones ni DB paralela.
 */
function calculateAffinity(sessionsCount: number) {
  if (sessionsCount >= 25) {
    return { level: 5, label: "Mentor de Oakhaven", hearts: "❤️❤️❤️❤️❤️", bonusText: "Vínculo Inquebrantable" };
  }
  if (sessionsCount >= 12) {
    return { level: 4, label: "Amigo de Confianza", hearts: "❤️❤️❤️❤️🤍", bonusText: "Confianza Mutua" };
  }
  if (sessionsCount >= 5) {
    return { level: 3, label: "Compañero Cálido", hearts: "❤️❤️❤️🤍🤍", bonusText: "Buena Amistad" };
  }
  if (sessionsCount >= 1) {
    return { level: 2, label: "Vecino Amable", hearts: "❤️❤️🤍🤍🤍", bonusText: "Conociéndose" };
  }
  return { level: 1, label: "Primer Encuentro", hearts: "❤️🤍🤍🤍🤍", bonusText: "Recién Llegado" };
}

export function ResidentModal({
  resident,
  onClose,
  onOpenBuilding,
  onSubmitSkillSession,
  domainSummary,
  recentSessions,
}: ResidentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedMicroQuest, setCompletedMicroQuest] = useState(false);
  const [sharedTea, setSharedTea] = useState(false);

  if (!resident) return null;

  const skillLevel = domainSummary?.level || 1;
  const sessionsCount = domainSummary?.sessions_count || recentSessions.filter((s) => s.domain === resident.domain).length;
  const lastSessionDetails = recentSessions.find((s) => s.domain === resident.domain)?.details;
  const affinity = calculateAffinity(sessionsCount);

  // Ejecución de la micro-misión canónica en el motor
  const handleCompleteMicroQuest = async () => {
    if (!resident.microQuest || isSubmitting || completedMicroQuest) return;

    setIsSubmitting(true);
    triggerHaptic("light");

    try {
      const today = new Date().toISOString().slice(0, 10);
      // Clave de idempotencia determinista diaria: evita recompensas espurias o duplicadas
      const idempotencyKey = `resident_micro_${resident.id}_${today}`;

      const success = await onSubmitSkillSession({
        domain: resident.domain,
        duration_minutes: resident.microQuest.estimatedMinutes,
        title: `[Micro-Misión con ${resident.name}] ${resident.microQuest.title}`,
        notes: `${resident.microQuest.description} • Guía: ${resident.name} (${resident.species})`,
        idempotency_key: idempotencyKey,
      });

      if (success) {
        setCompletedMicroQuest(true);
        triggerHaptic("success");
      }
    } catch (err) {
      console.error("Error al completar micro-misión:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShareTea = () => {
    setSharedTea(true);
    triggerHaptic("light");
    setTimeout(() => setSharedTea(false), 4000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Diálogo con ${resident.name}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3A2E2B]/75 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-6 shadow-[0_8px_0_#3A2E2B] space-y-4 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Residente */}
        <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/10 pb-3.5">
          <div className="flex items-center gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border-[3px] border-[#3A2E2B] bg-[#E9C46A] text-3xl shadow-[0_3px_0_#3A2E2B] transition-transform hover:scale-105">
              {resident.avatar}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-[#3A2E2B] tracking-tight">
                  {resident.name}
                </h3>
                <span className="rounded-full bg-[#E8DFCF] px-2 py-0.5 text-[10px] font-bold text-[#795548] border border-[#3A2E2B]/20">
                  {resident.species}
                </span>
              </div>
              <span className="text-xs font-bold text-[#4E6E58] block">
                {resident.title}
              </span>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] font-black text-[#E76F51]">
                <Heart className="h-3 w-3 fill-[#E76F51]" />
                <span>{affinity.hearts}</span>
                <span className="text-[#795548] font-medium text-[10px]">
                  ({affinity.label} • {sessionsCount} sesiones)
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar diálogo"
            className="rounded-xl border-2 border-[#3A2E2B] bg-[#E8DFCF] p-2 text-[#3A2E2B] hover:bg-[#E9C46A] shadow-[0_2px_0_#3A2E2B] cursor-pointer transition-transform hover:scale-105"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cita & Consejo Dinámico */}
        <div className="rounded-2xl border-2 border-[#3A2E2B] bg-[#F7F4EB] p-4 space-y-2.5 shadow-inner">
          <p className="text-xs italic font-medium text-[#5C4033] leading-relaxed">
            "{resident.greetingQuote}"
          </p>
          <div className="pt-2 border-t border-[#3A2E2B]/10 flex items-start gap-2">
            <span className="text-sm">💬</span>
            <p className="text-xs font-bold text-[#3A2E2B] leading-relaxed">
              {resident.getDynamicAdvice({
                skillLevel,
                sessionsCount,
                lastSessionDetails,
              })}
            </p>
          </div>
        </div>

        {/* Micro-Misión de Bienestar */}
        {resident.microQuest && (
          <div className="rounded-2xl border-2 border-[#4E6E58]/40 bg-[#4E6E58]/10 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-[#4E6E58] tracking-wider flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Micro-Misión de Autocuidado
              </span>
              <span className="rounded-full bg-[#E9C46A] border-2 border-[#3A2E2B] px-2.5 py-0.5 text-[10px] font-black text-[#3A2E2B]">
                {resident.microQuest.badge}
              </span>
            </div>

            <h4 className="text-xs font-black text-[#3A2E2B]">
              {resident.microQuest.title}
            </h4>

            <p className="text-[11px] text-[#5C4033] font-medium leading-relaxed">
              {resident.microQuest.description}
            </p>

            {completedMicroQuest ? (
              <div className="rounded-xl border-2 border-emerald-600 bg-emerald-100 p-2.5 text-center text-xs font-black text-emerald-800 flex items-center justify-center gap-2">
                <Check className="h-4 w-4 text-emerald-700" />
                ¡Micro-misión completada! Bienestar y GP liberados en la Bóveda.
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleCompleteMicroQuest}
                  className="flex-1 rounded-xl border-2 border-[#3A2E2B] bg-[#E9C46A] py-2 px-3 text-xs font-black text-[#3A2E2B] hover:bg-[#F4A261] shadow-[0_2px_0_#3A2E2B] cursor-pointer flex items-center justify-center gap-1.5 transition-transform active:translate-y-0.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Registrando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" /> Completar Ahora (+{resident.microQuest.estimatedMinutes} min)
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onOpenBuilding(resident.buildingId);
                    onClose();
                  }}
                  className="rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8] py-2 px-3 text-xs font-black text-[#3A2E2B] hover:bg-[#E8DFCF] shadow-[0_2px_0_#3A2E2B] cursor-pointer flex items-center justify-center gap-1 transition-transform active:translate-y-0.5"
                >
                  Ir al Edificio <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Saludo y Vínculo Cozy */}
        <div className="pt-2 border-t-2 border-[#3A2E2B]/10 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="text-[#795548] text-[11px] font-medium flex items-center gap-1.5">
            <span>🎁 Regalo preferido:</span>
            <span className="font-bold text-[#3A2E2B]">{resident.favoriteGift}</span>
          </div>

          <button
            type="button"
            onClick={handleShareTea}
            className="rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8] px-3 py-1.5 text-[11px] font-black text-[#3A2E2B] hover:bg-[#E9C46A] shadow-[0_2px_0_#3A2E2B] cursor-pointer flex items-center gap-1 transition-colors"
          >
            <Coffee className="h-3.5 w-3.5 text-[#E76F51]" />
            Compartir Momento Cozy
          </button>
        </div>

        {sharedTea && (
          <div className="rounded-xl border-2 border-[#E9C46A] bg-[#FFF8E7] p-2.5 text-center text-[11px] font-bold text-[#795548] animate-in fade-in">
            🍵 Has compartido un té caliente con {resident.name}. Su sonrisa ilumina la tarde en Oakhaven.
          </div>
        )}
      </div>
    </div>
  );
}
