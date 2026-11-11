"use client";

import React from "react";
import { COZY_VILLAGE_RESIDENTS } from "@/lib/sanctuary/village-tiers";
import type { SkillDomainSummary, SkillSessionRecord } from "@/types/rpg";
import { CozyModal, CozyCard, CozyButton } from "@/components/cozy/ui";

interface MayorsLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  skillSummaries?: SkillDomainSummary[];
  recentSessions?: SkillSessionRecord[];
  activeBooksCount?: number;
  activeKnittingProjectsCount?: number;
}

export function MayorsLedgerModal({
  isOpen,
  onClose,
  skillSummaries = [],
  recentSessions = [],
  activeBooksCount = 0,
  activeKnittingProjectsCount = 0,
}: MayorsLedgerModalProps) {
  if (!isOpen) return null;

  // Cálculo determinista de estación según el mes actual
  const month = new Date().getMonth(); // 0 = Ene, 11 = Dic
  const seasonInfo =
    month >= 2 && month <= 4
      ? { name: "Primavera Floreciente", icon: "🌸", climate: "Brisa templada y brotes verdes", bonus: "+10% Expansión Creativa" }
      : month >= 5 && month <= 7
      ? { name: "Verano Cálido", icon: "🌻", climate: "Días largos y sol resplandeciente", bonus: "+10% Energía en Senderismo" }
      : month >= 8 && month <= 10
      ? { name: "Otoño Dorado", icon: "🍂", climate: "Viento fresco y hojas de arce", bonus: "+10% Retención en Lectura" }
      : { name: "Invierno Acogedor", icon: "❄️", climate: "Hogar tibio y descanso reparador", bonus: "+10% Concentración en Tejido" };

  // Estadísticas consolidadas
  const totalSessions = skillSummaries.reduce((acc, s) => acc + (s.sessions_count || 0), 0) || recentSessions.length;
  const totalGp = skillSummaries.reduce((acc, s) => acc + (s.total_gp_earned || 0), 0);
  const totalXp = skillSummaries.reduce((acc, s) => acc + (s.total_xp || 0), 0);

  // Decretos del día según el día de la semana
  const dayOfWeek = new Date().getDay();
  const DECREES = [
    "Decreto del Silencio Dulce: Toda pausa deliberada es una semilla para el enfoque de mañana.",
    "Proclama del Tejedor: Cada fila completada, por pequeña que sea, abriga el espíritu comunitario.",
    "Bando de la Curiosidad: La biblioteca del erudito permanece abierta para cualquier pregunta sincera.",
    "Edicto de la Calma: Queda terminantemente prohibido medir el propio valor únicamente por la velocidad.",
    "Ordenanza del Descanso: Una infusión tibia y tres respiraciones profundas son válidas como tarea prioritaria.",
    "Tratado de la Paciencia: Los árboles más antiguos de Oakhaven crecieron anillo por anillo sin prisa.",
    "Fiesta de la Gratitud: Reconoce hoy un pequeño avance que hiciste esta semana.",
  ];
  const activeDecree = DECREES[dayOfWeek % DECREES.length];

  return (
    <CozyModal
      isOpen={isOpen}
      onClose={onClose}
      title="Bitácora Oficial del Pueblo"
      subtitle="Ayuntamiento Comunitario de Oakhaven"
      icon="🏛️"
      headerVariant="wood"
      maxWidth="2xl"
    >
      <div className="space-y-4 text-[#3A2E2B]">
        {/* ESTACIÓN ACTUAL Y CLIMA */}
        <CozyCard variant="cream" shadow="sm" className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl select-none">{seasonInfo.icon}</span>
              <div>
                <span className="text-[10px] font-black uppercase text-[#795548]">Estación Vigente</span>
                <h4 className="text-sm font-black text-[#3A2E2B]">{seasonInfo.name}</h4>
                <p className="text-xs text-[#5C4033]">{seasonInfo.climate}</p>
              </div>
            </div>
            <div className="rounded-xl border-2 border-[#314C3C]/40 bg-[#77936A]/20 px-3 py-1.5 text-right">
              <span className="text-[10px] font-bold text-[#314C3C]">Armonía Estacional</span>
              <p className="text-xs font-black text-[#314C3C]">{seasonInfo.bonus}</p>
            </div>
          </div>
        </CozyCard>

        {/* DECRETO DEL DÍA */}
        <div className="rounded-2xl border-3 border-[#3A2E2B] bg-[#E7D69C]/40 p-4 text-center shadow-[0_3px_0_#3A2E2B]">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#795548] block">
            📜 Decreto del Alcalde Rowan
          </span>
          <p className="mt-1.5 text-xs font-semibold italic text-[#3A2E2B]">
            &ldquo;{activeDecree}&rdquo;
          </p>
        </div>

        {/* MÉTRICAS COMUNITARIAS */}
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-[#795548] mb-2">
            📊 Balance de Prosperidad
          </h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border-3 border-[#3A2E2B] bg-[#FFFDF8] p-3 text-center shadow-[0_3px_0_#3A2E2B]">
              <span className="text-lg">⭐</span>
              <span className="block text-base font-black text-[#3A2E2B]">5.0 / 5.0</span>
              <span className="text-[10px] font-bold text-[#795548]">Satisfacción Vecinal</span>
            </div>
            <div className="rounded-2xl border-3 border-[#3A2E2B] bg-[#FFFDF8] p-3 text-center shadow-[0_3px_0_#3A2E2B]">
              <span className="text-lg">🌱</span>
              <span className="block text-base font-black text-[#3A2E2B]">{totalSessions}</span>
              <span className="text-[10px] font-bold text-[#795548]">Sesiones de Calma</span>
            </div>
            <div className="col-span-2 sm:col-span-1 rounded-2xl border-3 border-[#3A2E2B] bg-[#FFFDF8] p-3 text-center shadow-[0_3px_0_#3A2E2B]">
              <span className="text-lg">💰</span>
              <span className="block text-base font-black text-[#314C3C]">
                +{totalGp.toLocaleString("es-CO")} GP
              </span>
              <span className="text-[10px] font-bold text-[#795548]">Riqueza Forjada</span>
            </div>
          </div>
        </div>

        {/* CENSO DE RESIDENTES */}
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-[#795548] mb-2">
            👥 Censo Comunitario de Residentes ({COZY_VILLAGE_RESIDENTS.length})
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {COZY_VILLAGE_RESIDENTS.map((res) => (
              <div
                key={res.id}
                className="flex items-center justify-between rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8] p-2.5 px-3 shadow-[0_2px_0_#3A2E2B]"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{res.avatar}</span>
                  <div>
                    <span className="text-xs font-black text-[#3A2E2B]">{res.name}</span>
                    <span className="ml-1.5 text-[10px] font-bold text-[#795548]">
                      ({res.species} • {res.title})
                    </span>
                  </div>
                </div>
                <span className="rounded-full border border-[#77936A] bg-[#77936A]/20 px-2 py-0.5 text-[10px] font-extrabold text-[#314C3C]">
                  En su Puesto ✓
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* BOTÓN DE CIERRE */}
        <div className="pt-2 text-center">
          <CozyButton
            variant="sunlight"
            size="md"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Cerrar Bitácora Municipal
          </CozyButton>
        </div>
      </div>
    </CozyModal>
  );
}
