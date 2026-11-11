"use client";

import React, { useState } from "react";
import { Users, Sparkles, MessageSquare, ArrowRight, X, Heart, Shield, Award } from "lucide-react";
import {
  COZY_VILLAGE_RESIDENTS,
  type VillageResident,
} from "@/lib/sanctuary/village-tiers";
import type { SkillDomainSummary, SkillSessionRecord } from "@/types/rpg";
import { CozyModal, CozyButton } from "@/components/cozy/ui";
import { triggerHaptic } from "@/lib/offline-sync";

interface CompanionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectResident: (resident: VillageResident) => void;
  onOpenBuilding: (buildingId: string) => void;
  skillSummaries?: SkillDomainSummary[];
  recentSessions?: SkillSessionRecord[];
}

export function CompanionsModal({
  isOpen,
  onClose,
  onSelectResident,
  onOpenBuilding,
  skillSummaries = [],
  recentSessions = [],
}: CompanionsModalProps) {
  const [filterDomain, setFilterDomain] = useState<string>("all");

  const residents = COZY_VILLAGE_RESIDENTS;

  const filtered = filterDomain === "all"
    ? residents
    : residents.filter((r) => {
        if (filterDomain === "saber") return ["reading", "study", "rubik", "general", "journaling"].includes(r.domain);
        if (filterDomain === "artes") return ["knitting", "cooking", "gaming", "drawing", "ceramics"].includes(r.domain);
        if (filterDomain === "naturaleza") return ["gardening", "hiking", "sports"].includes(r.domain);
        return true;
      });

  return (
    <CozyModal
      isOpen={isOpen}
      onClose={onClose}
      title="Casa de Compañeros • Censo de Oakhaven"
      subtitle="Conoce a los residentes del pueblo, consulta sus consejos y acompáñalos en sus oficios"
      icon="👥"
      maxWidth="2xl"
    >
      <div className="space-y-5">
        {/* Filtros de Distritos / Vocación */}
        <div className="flex flex-wrap items-center gap-2 border-b-2 border-[#3A2E2B]/10 pb-3">
          <span className="text-xs font-black text-[#795548] mr-2">Filtrar:</span>
          {[
            { id: "all", label: "🌟 Todos los Residentes" },
            { id: "saber", label: "📚 Saber & Foco" },
            { id: "artes", label: "🧶 Artes & Oficios" },
            { id: "naturaleza", label: "🌿 Naturaleza & Vitalidad" },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setFilterDomain(f.id);
                triggerHaptic("light");
              }}
              className={`rounded-2xl border-2 border-[#3A2E2B] px-3 py-1 text-xs font-bold transition cursor-pointer ${
                filterDomain === f.id
                  ? "bg-[#314C3C] text-[#FFFDF8] shadow-[0_2px_0_#1E2E23]"
                  : "bg-[#F7F4EB] text-[#3A2E2B] hover:bg-[#E8DFCF]"
              }`}
            >
              {f.label}
            </button>
          ))}
          <span className="text-xs font-bold text-[#795548] ml-auto">
            {filtered.length} residentes
          </span>
        </div>

        {/* Cuadrícula de Residentes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[62vh] overflow-y-auto pr-1">
          {filtered.map((res) => {
            const skillSum = skillSummaries.find((s) => s.domain === res.domain);
            const domainSessions = recentSessions.filter((s) => s.domain === res.domain);
            const dynamicAdvice = res.getDynamicAdvice({
              skillLevel: skillSum?.level || 1,
              sessionsCount: skillSum?.sessions_count || domainSessions.length,
              lastSessionDetails: domainSessions[0]?.details,
            });

            return (
              <div
                key={res.id}
                className="rounded-3xl border-3 border-[#3A2E2B] bg-[#FFFDF8] p-4 shadow-[0_4px_0_#3A2E2B] flex flex-col justify-between space-y-3 hover:-translate-y-0.5 transition"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[#3A2E2B] bg-[#E7D69C] text-2xl shadow-[0_2px_0_#3A2E2B]">
                      {res.avatar}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-black text-[#3A2E2B] truncate">{res.name}</h4>
                        <span className="text-[11px] font-bold text-[#4E6E58]">
                          • {res.species}
                        </span>
                      </div>
                      <span className="block text-[10px] font-extrabold uppercase tracking-wide text-[#795548]">
                        {res.title}
                      </span>
                    </div>
                  </div>

                  <p className="mt-2.5 text-xs italic text-[#795548] bg-[#F7F4EB] p-2 rounded-xl border border-[#3A2E2B]/10">
                    "{res.greetingQuote}"
                  </p>

                  <p className="mt-2 text-xs font-bold text-[#314C3C] line-clamp-2">
                    💬 {dynamicAdvice}
                  </p>
                </div>

                {/* Botones de Acción */}
                <div className="flex items-center gap-2 pt-2 border-t border-[#3A2E2B]/10">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("medium");
                      onClose();
                      onSelectResident(res);
                    }}
                    className="flex-1 rounded-xl border-2 border-[#3A2E2B] bg-[#E7D69C] hover:bg-[#F4EEDC] py-1.5 px-3 text-xs font-black text-[#3A2E2B] shadow-[0_2px_0_#3A2E2B] transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <MessageSquare className="h-3.5 w-3.5" /> Charlar a fondo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("medium");
                      onClose();
                      onOpenBuilding(res.buildingId);
                    }}
                    className="rounded-xl border-2 border-[#3A2E2B] bg-[#4E6E58] hover:bg-[#3B5A45] py-1.5 px-3 text-xs font-black text-[#FFFDF8] shadow-[0_2px_0_#2B3D31] transition cursor-pointer flex items-center justify-center gap-1"
                    title={`Entrar al edificio de ${res.name}`}
                  >
                    <span>Entrar</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </CozyModal>
  );
}
