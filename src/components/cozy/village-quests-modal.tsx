"use client";

import React, { useState, useMemo } from "react";
import { CheckCircle2, Clock, Sparkles, Heart, ArrowRight, BookOpen, Award } from "lucide-react";
import { COZY_VILLAGE_RESIDENTS, type VillageResident } from "@/lib/sanctuary/village-tiers";
import type { SkillSessionRecord, SkillDomainSummary, SkillDomain } from "@/types/rpg";
import { CozyModal, CozyButton, CozyCard, CozyNotification } from "@/components/cozy/ui";
import { triggerHaptic } from "@/lib/offline-sync";
import { loadWorldPreferences } from "@/lib/sanctuary/world-preferences-engine";

interface VillageQuestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenBuilding: (buildingId: string, domain: SkillDomain) => void;
  onSubmitSkillSession: (payload: Record<string, unknown>) => Promise<boolean>;
  skillSummaries?: SkillDomainSummary[];
  recentSessions?: SkillSessionRecord[];
}

function calculateAffinity(sessionsCount: number) {
  if (sessionsCount >= 25) {
    return { level: 5, label: "Mentor", hearts: "❤️❤️❤️❤️❤️" };
  }
  if (sessionsCount >= 12) {
    return { level: 4, label: "Amigo Íntimo", hearts: "❤️❤️❤️❤️🤍" };
  }
  if (sessionsCount >= 5) {
    return { level: 3, label: "Compañero", hearts: "❤️❤️❤️🤍🤍" };
  }
  if (sessionsCount >= 1) {
    return { level: 2, label: "Vecino", hearts: "❤️❤️🤍🤍🤍" };
  }
  return { level: 1, label: "Conociéndose", hearts: "❤️🤍🤍🤍🤍" };
}

export function VillageQuestsModal({
  isOpen,
  onClose,
  onOpenBuilding,
  onSubmitSkillSession,
  skillSummaries = [],
  recentSessions = [],
}: VillageQuestsModalProps) {
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Filtrado de vecinos activos según preferencias de Mi Mundo (OakHaven 4.0)
  const activeResidents = useMemo(() => {
    const worldConfig = loadWorldPreferences();
    return COZY_VILLAGE_RESIDENTS.filter((res) => {
      if (res.domain === "work" || res.id === "silas") return true;
      const pref = worldConfig.skills[res.domain];
      return !pref || pref.status === "active";
    });
  }, []);

  if (!isOpen) return null;

  const handleCompleteQuest = async (resident: VillageResident) => {
    if (completedIds.includes(resident.id) || submittingId) return;

    setSubmittingId(resident.id);
    triggerHaptic("light");

    try {
      const today = new Date().toISOString().slice(0, 10);
      const idempotencyKey = `village_journal_${resident.id}_${today}_${Date.now()}`;

      const success = await onSubmitSkillSession({
        domain: resident.domain,
        duration_minutes: resident.microQuest.estimatedMinutes,
        title: `[Diario Comunitario] ${resident.microQuest.title}`,
        notes: `${resident.microQuest.description} • Guía: ${resident.name} (${resident.species})`,
        idempotency_key: idempotencyKey,
      });

      if (success) {
        setCompletedIds((prev) => [...prev, resident.id]);
        triggerHaptic("success");
        setFeedbackMsg(`¡Completaste la tarea con ${resident.name}! +${resident.microQuest.estimatedMinutes}m de progreso registrado.`);
        setTimeout(() => setFeedbackMsg(null), 4000);
      }
    } catch (err) {
      console.error("[VillageQuestsModal] Error al registrar micro-misión:", err);
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <CozyModal
      isOpen={isOpen}
      onClose={onClose}
      title="Diario de Misiones Comunitarias"
      subtitle="Pequeños pasos guiados por los vecinos de Oakhaven para nutrir tus hábitos"
      icon="📜"
      headerVariant="wood"
      maxWidth="2xl"
    >
      <div className="space-y-4 text-[#3A2E2B]">
        {/* BANNER DE ÉXITO */}
        {feedbackMsg && (
          <CozyNotification
            variant="success"
            message={feedbackMsg}
            onDismiss={() => setFeedbackMsg(null)}
          />
        )}

        {/* RESUMEN DEL DÍA */}
        <CozyCard variant="cream" shadow="sm" className="p-3.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl select-none">🏡</span>
            <div>
              <span className="text-[10px] font-black uppercase text-[#795548]">
                Tablón de Tareas del Pueblo
              </span>
              <p className="text-xs font-black text-[#3A2E2B]">
                {completedIds.length} de {activeResidents.length} Micro-Misiones Realizadas Hoy
              </p>
            </div>
          </div>
          <span className="rounded-full border border-[#77936A] bg-[#77936A]/20 px-3 py-1 text-xs font-black text-[#314C3C]">
            Cero Presión • Ritmo Propio
          </span>
        </CozyCard>

        {/* LISTADO DE RESIDENTES Y SUS MICRO-MISIONES */}
        <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
          {activeResidents.map((res) => {
            const sum = skillSummaries.find((s) => s.domain === res.domain);
            const count = sum?.sessions_count || recentSessions.filter((s) => s.domain === res.domain).length;
            const affinity = calculateAffinity(count);
            const isDone = completedIds.includes(res.id);
            const isBusy = submittingId === res.id;

            return (
              <div
                key={res.id}
                className={`rounded-2xl border-3 border-[#3A2E2B] p-4 transition-all ${
                  isDone
                    ? "bg-[#EAF3ED] shadow-[0_2px_0_#3A2E2B] opacity-90"
                    : "bg-[#FFFDF8] shadow-[0_4px_0_#3A2E2B]"
                }`}
              >
                {/* CABECERA DEL RESIDENTE */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#3A2E2B]/10 pb-2.5 mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#E7D69C] text-xl shadow-inner select-none">
                      {res.avatar}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-black text-[#3A2E2B]">{res.name}</h4>
                        <span className="text-[10px] text-[#795548] font-medium">
                          • {res.title} ({res.species})
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px]">
                        <span className="select-none">{affinity.hearts}</span>
                        <span className="font-bold text-[#314C3C]">({affinity.label})</span>
                      </div>
                    </div>
                  </div>

                  <span className="rounded-full border border-[#3A2E2B]/30 bg-[#F4EEDC] px-2 py-0.5 text-[10px] font-bold text-[#795548]">
                    {res.microQuest.badge}
                  </span>
                </div>

                {/* CONTENIDO DE LA MISIÓN */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-black text-[#3A2E2B] flex items-center gap-1.5">
                      {isDone && <CheckCircle2 className="h-3.5 w-3.5 text-[#314C3C]" />}
                      {res.microQuest.title}
                    </h5>
                    <span className="text-[10px] font-mono text-[#795548] flex items-center gap-1">
                      <Clock className="h-3 w-3" /> ~{res.microQuest.estimatedMinutes}m
                    </span>
                  </div>
                  <p className="text-[11px] text-[#5C4033] leading-relaxed">
                    {res.microQuest.description}
                  </p>
                </div>

                {/* BOTONES DE ACCIÓN */}
                <div className="mt-3 pt-2.5 border-t border-[#3A2E2B]/10 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenBuilding(res.buildingId, res.domain);
                      onClose();
                    }}
                    className="text-[11px] font-bold text-[#314C3C] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>Ir al Edificio</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>

                  <CozyButton
                    variant={isDone ? "sage" : "forest"}
                    size="sm"
                    disabled={isDone || isBusy}
                    onClick={() => handleCompleteQuest(res)}
                    icon={isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                  >
                    {isDone ? "Completada Hoy ✓" : isBusy ? "Registrando..." : "Registrar Avance"}
                  </CozyButton>
                </div>
              </div>
            );
          })}
        </div>

        {/* PIE */}
        <div className="pt-2 text-center border-t-2 border-[#3A2E2B]/15">
          <CozyButton
            variant="sunlight"
            size="sm"
            onClick={onClose}
          >
            Cerrar Diario
          </CozyButton>
        </div>
      </div>
    </CozyModal>
  );
}
