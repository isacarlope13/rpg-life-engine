"use client";

import React, { useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  Pause,
  Archive,
  Power,
  Info,
  Shield,
  Layers,
  HeartHandshake,
  HelpCircle,
  X,
} from "lucide-react";
import type { SkillDomain } from "@/types/rpg";
import {
  type VillageWorldConfig,
  type SkillLifeCycleState,
  ALL_SKILL_DOMAINS,
  updateSkillStatus,
  getSkillLifecycleMetrics,
} from "@/lib/sanctuary/world-preferences-engine";
import { getBuildingByDomain } from "@/lib/sanctuary/village-buildings-registry";
import { CozyButton, CozyNotification } from "@/components/cozy/ui";
import { triggerHaptic } from "@/lib/offline-sync";

interface WorldCustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: VillageWorldConfig;
  onConfigChange: (newConfig: VillageWorldConfig) => void;
}

export function WorldCustomizationModal({
  isOpen,
  onClose,
  config,
  onConfigChange,
}: WorldCustomizationModalProps) {
  const [filterState, setFilterState] = useState<"all" | SkillLifeCycleState>("all");
  const [notification, setNotification] = useState<string | null>(null);

  if (!isOpen) return null;

  const metrics = getSkillLifecycleMetrics(config);

  const handleStatusChange = (
    domain: SkillDomain,
    newStatus: SkillLifeCycleState,
    skillName: string
  ) => {
    triggerHaptic("medium");
    const updated = updateSkillStatus(config, domain, newStatus);
    onConfigChange(updated);

    const actionText =
      newStatus === "active"
        ? "activada en el pueblo"
        : newStatus === "paused"
        ? "puesta en pausa (sin misiones que agobien)"
        : "archivada (datos e historial protegidos)";

    setNotification(`¡${skillName} ha sido ${actionText}!`);
    setTimeout(() => setNotification(null), 3500);
  };

  const domainLabels: Record<SkillDomain, { name: string; icon: string; desc: string }> = {
    work: { name: "Oficina & Foco Profesional", icon: "💼", desc: "Sprints ágiles, proyectos y tareas." },
    reading: { name: "Librería & Lectura Serena", icon: "📚", desc: "Tramos de lectura y síntesis de libros." },
    knitting: { name: "Atelier de Tejido & Textil", icon: "🧶", desc: "Lanas, proyectos y tejido artesanal." },
    rubik: { name: "Club de Speedcubing WCA", icon: "🧩", desc: "Resolución de cubos y promedios oficiales." },
    sports: { name: "Gimnasio & Salud Funcional", icon: "🏋️", desc: "Entrenamiento físico y fuerza." },
    journaling: { name: "Cabaña del Diario & Gratitud", icon: "📔", desc: "Reflexión y balance emocional." },
    study: { name: "Gran Biblioteca & Academia", icon: "🏛️", desc: "Repetición espaciada y cátedra." },
    gardening: { name: "Invernadero & Jardín", icon: "🌿", desc: "Plantas, botánica y pausas verdes." },
    drawing: { name: "Estudio de Dibujo & Arte", icon: "🎨", desc: "Ilustración, acuarelas y trazo." },
    ceramics: { name: "Taller de Cerámica", icon: "🏺", desc: "Torno de alfarería y modelado." },
    hiking: { name: "Puesto de Senderismo", icon: "🥾", desc: "Caminatas al aire libre y rutas." },
    cooking: { name: "Cocina Comunitaria", icon: "🍳", desc: "Preparación de alimentos conscientes." },
    gaming: { name: "Ludoteca & Puzzles", icon: "🎮", desc: "Juegos lógicos y estrategia recreativa." },
    general: { name: "Observatorio de Deep Work", icon: "🔭", desc: "Bloques de silencio y concentración." },
  };

  const filteredDomains = ALL_SKILL_DOMAINS.filter((dom) => {
    if (filterState === "all") return true;
    const pref = config.skills[dom];
    const status = pref?.status || "active";
    return status === filterState;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 sm:p-6 shadow-2xl space-y-5 text-[#3A2E2B]">
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/15 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[#3A2E2B] bg-[#E7D69C] text-2xl shadow-inner">
              🏡
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-black text-[#3A2E2B] flex items-center gap-2">
                Mi Mundo: Gestión de Habilidades
              </h3>
              <p className="text-xs text-[#795548]">
                Personaliza qué edificios están activos en tu pueblo sin perder historial, GP ni XP.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] text-[#3A2E2B] hover:bg-[#E8DFCF] transition"
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Notificación Dinámica */}
        {notification && (
          <CozyNotification
            variant="success"
            message={notification}
            onDismiss={() => setNotification(null)}
          />
        )}

        {/* Muro de Garantías: Preservación de Datos */}
        <div className="rounded-2xl border-2 border-[#314C3C]/30 bg-[#EAF3ED] p-3.5 flex items-start gap-3 text-xs text-[#2A4331]">
          <Shield className="h-5 w-5 text-[#314C3C] shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong>Garantía de Soberanía:</strong> Pausar o archivar una habilidad{" "}
            <strong>nunca elimina tus sesiones pasadas, GP acumulados ni proyectos</strong>. Solo despeja tu mapa
            para que te enfoques en lo que realmente importa en esta etapa de tu vida.
          </div>
        </div>

        {/* Métricas y Filtros de Estado */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <button
            type="button"
            onClick={() => setFilterState("active")}
            className={`p-2.5 rounded-2xl border-2 border-[#3A2E2B] font-bold transition cursor-pointer ${
              filterState === "active" ? "bg-[#314C3C] text-white" : "bg-[#F7F4EB] text-[#3A2E2B]"
            }`}
          >
            <span className="block text-sm font-black">{metrics.activeCount}</span>
            <span className="text-[10px] uppercase font-bold">Activas en Pueblo</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterState("paused")}
            className={`p-2.5 rounded-2xl border-2 border-[#3A2E2B] font-bold transition cursor-pointer ${
              filterState === "paused" ? "bg-amber-600 text-white" : "bg-[#F7F4EB] text-[#3A2E2B]"
            }`}
          >
            <span className="block text-sm font-black">{metrics.pausedCount}</span>
            <span className="text-[10px] uppercase font-bold">En Pausa</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterState("archived")}
            className={`p-2.5 rounded-2xl border-2 border-[#3A2E2B] font-bold transition cursor-pointer ${
              filterState === "archived" ? "bg-[#795548] text-white" : "bg-[#F7F4EB] text-[#3A2E2B]"
            }`}
          >
            <span className="block text-sm font-black">{metrics.archivedCount}</span>
            <span className="text-[10px] uppercase font-bold">Archivadas</span>
          </button>
        </div>

        {/* Lista de Habilidades */}
        <div className="space-y-3 pt-1">
          {filteredDomains.map((domain) => {
            const meta = domainLabels[domain];
            const pref = config.skills[domain];
            const status: SkillLifeCycleState = pref?.status || "active";
            const isWork = domain === "work"; // Nuclear

            return (
              <div
                key={domain}
                className="rounded-2xl border-2 border-[#3A2E2B]/20 bg-[#FFFDF8] p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[0_2px_0_#3A2E2B]/10"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#3A2E2B]/30 bg-[#F7F4EB] text-2xl shadow-inner">
                    {meta.icon}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black text-[#3A2E2B]">{meta.name}</h4>
                      {isWork && (
                        <span className="rounded-md bg-[#D4AF37]/20 border border-[#AA820A]/40 px-1.5 py-0.2 text-[8px] font-black text-[#8A6800] uppercase">
                          Sede Nuclear
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#795548]">{meta.desc}</p>
                  </div>
                </div>

                {/* Controles de Estado de Habilidad */}
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => handleStatusChange(domain, "active", meta.name)}
                    className={`rounded-xl px-2.5 py-1 text-[11px] font-black transition cursor-pointer border ${
                      status === "active"
                        ? "bg-[#314C3C] text-white border-[#1E2F25] shadow-sm"
                        : "bg-[#F7F4EB] text-[#795548] border-[#3A2E2B]/20 hover:bg-[#EAE4D2]"
                    }`}
                  >
                    Activa
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStatusChange(domain, "paused", meta.name)}
                    className={`rounded-xl px-2.5 py-1 text-[11px] font-black transition cursor-pointer border ${
                      status === "paused"
                        ? "bg-amber-600 text-white border-amber-800 shadow-sm"
                        : "bg-[#F7F4EB] text-[#795548] border-[#3A2E2B]/20 hover:bg-[#EAE4D2]"
                    }`}
                  >
                    Pausar
                  </button>

                  <button
                    type="button"
                    disabled={isWork}
                    onClick={() => handleStatusChange(domain, "archived", meta.name)}
                    className={`rounded-xl px-2.5 py-1 text-[11px] font-black transition cursor-pointer border ${
                      status === "archived"
                        ? "bg-[#795548] text-white border-[#4E342E] shadow-sm"
                        : isWork
                        ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                        : "bg-[#F7F4EB] text-[#795548] border-[#3A2E2B]/20 hover:bg-[#EAE4D2]"
                    }`}
                  >
                    Archivar
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pie del Modal */}
        <div className="flex items-center justify-between border-t-2 border-[#3A2E2B]/15 pt-4">
          <button
            type="button"
            onClick={() => setFilterState("all")}
            className="text-xs text-[#314C3C] font-black hover:underline cursor-pointer"
          >
            Ver Todas las Habilidades ({ALL_SKILL_DOMAINS.length})
          </button>

          <CozyButton variant="forest" size="sm" onClick={onClose}>
            Listo, Aplicar Cambios
          </CozyButton>
        </div>
      </div>
    </div>
  );
}
