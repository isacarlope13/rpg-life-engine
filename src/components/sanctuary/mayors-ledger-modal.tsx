"use client";

import React from "react";
import { BookOpen, Award, CheckCircle2, Star, Users, Home, Calendar, Sparkles } from "lucide-react";
import { COZY_VILLAGE_RESIDENTS, calculateBuildingTier } from "@/lib/sanctuary/village-tiers";
import type { SkillDomainSummary, SkillSessionRecord } from "@/types/rpg";

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border-4 border-[#5C4033] bg-[#F7F4EB] p-6 sm:p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: "0 25px 50px -12px rgba(92, 64, 51, 0.4), inset 0 0 100px rgba(235, 229, 216, 0.6)",
        }}
      >
        {/* ENCABEZADO ESTILO PERGAMINO REAL / ARCHIVO DEL AYUNTAMIENTO */}
        <div className="border-b-3 border-[#5C4033]/30 pb-5 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border-2 border-[#5C4033] bg-[#E9C46A]/30 px-3.5 py-1 text-xs font-black text-[#5C4033]">
            🏛️ Ayuntamiento Comunitario de Oakhaven
          </div>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-[#3A2E2B]">
            Bitácora Oficial del Pueblo
          </h2>
          <p className="mt-1 text-xs text-[#7A6B62]">
            Registro de prosperidad comunitaria, obras públicas y censo de residentes.
          </p>
        </div>

        {/* ESTACIÓN ACTUAL Y CLIMA */}
        <div className="mt-6 rounded-2xl border-2 border-[#5C4033] bg-[#FFFBF2] p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{seasonInfo.icon}</span>
            <div>
              <span className="text-[10px] font-black uppercase text-[#8C7A6B]">Estación Vigente</span>
              <h4 className="text-sm font-black text-[#3A2E2B]">{seasonInfo.name}</h4>
              <p className="text-xs text-[#5C4033]">{seasonInfo.climate}</p>
            </div>
          </div>
          <div className="rounded-xl border border-[#4E6E58]/30 bg-[#4E6E58]/10 px-3 py-1.5 text-right">
            <span className="text-[10px] font-bold text-[#4E6E58]">Armonía Estacional</span>
            <p className="text-xs font-black text-[#2E4333]">{seasonInfo.bonus}</p>
          </div>
        </div>

        {/* DECRETO DEL DÍA */}
        <div className="mt-4 rounded-2xl border-2 border-[#8C5835] bg-[#EFE8D6] p-4 text-center">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#8C5835]">
            📜 Decreto del Alcalde Rowan
          </span>
          <p className="mt-1.5 text-xs font-semibold italic text-[#3A2E2B]">
            "{activeDecree}"
          </p>
        </div>

        {/* MÉTRICAS COMUNITARIAS */}
        <div className="mt-6">
          <h4 className="text-xs font-black uppercase tracking-wider text-[#5C4033] mb-3">
            📊 Balance de Prosperidad
          </h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border-2 border-[#5C4033]/30 bg-[#FFFBF2] p-3 text-center">
              <span className="text-lg">⭐</span>
              <span className="block text-base font-black text-[#3A2E2B]">5.0 / 5.0</span>
              <span className="text-[10px] font-bold text-[#7A6B62]">Satisfacción Vecinal</span>
            </div>
            <div className="rounded-2xl border-2 border-[#5C4033]/30 bg-[#FFFBF2] p-3 text-center">
              <span className="text-lg">🌱</span>
              <span className="block text-base font-black text-[#3A2E2B]">{totalSessions}</span>
              <span className="text-[10px] font-bold text-[#7A6B62]">Sesiones de Calma</span>
            </div>
            <div className="col-span-2 sm:col-span-1 rounded-2xl border-2 border-[#5C4033]/30 bg-[#FFFBF2] p-3 text-center">
              <span className="text-lg">💰</span>
              <span className="block text-base font-black text-[#4E6E58]">
                +{totalGp.toLocaleString("es-CO")} GP
              </span>
              <span className="text-[10px] font-bold text-[#7A6B62]">Riqueza Forjada</span>
            </div>
          </div>
        </div>

        {/* CENSO DE RESIDENTES */}
        <div className="mt-6">
          <h4 className="text-xs font-black uppercase tracking-wider text-[#5C4033] mb-3">
            👥 Censo Comunitario de Residentes ({COZY_VILLAGE_RESIDENTS.length})
          </h4>
          <div className="space-y-2">
            {COZY_VILLAGE_RESIDENTS.map((res) => (
              <div
                key={res.id}
                className="flex items-center justify-between rounded-xl border-2 border-[#5C4033]/20 bg-[#FFFBF2] p-2.5 px-3"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{res.avatar}</span>
                  <div>
                    <span className="text-xs font-black text-[#3A2E2B]">{res.name}</span>
                    <span className="ml-1.5 text-[10px] font-bold text-[#7A6B62]">
                      ({res.species} • {res.title})
                    </span>
                  </div>
                </div>
                <span className="rounded-full bg-[#EBE5D8] px-2 py-0.5 text-[10px] font-extrabold text-[#4E6E58]">
                  En su Puesto ✓
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* BOTÓN DE CIERRE */}
        <div className="mt-6 pt-4 border-t-2 border-[#5C4033]/20 text-center">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border-3 border-[#5C4033] bg-[#E9C46A] px-6 py-2.5 text-xs font-black text-[#3A2E2B] shadow-md hover:bg-[#F4A261] transition cursor-pointer"
          >
            Cerrar Bitácora Municipal
          </button>
        </div>
      </div>
    </div>
  );
}
