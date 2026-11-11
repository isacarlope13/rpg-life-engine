"use client";

import React, { useState } from "react";
import {
  Dumbbell,
  Clock,
  Play,
  Pause,
  RotateCcw,
  Square,
  Sparkles,
  Droplets,
  HeartPulse,
  Flame,
  Award,
  Plus,
  Minus,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import type { SkillSessionRecord } from "@/types/rpg";
import { useUniversalSession } from "@/lib/sanctuary/use-universal-session";
import { BuildingInteriorShell } from "@/components/sanctuary/building-interior-shell";
import { CozyButton } from "@/components/cozy/ui";
import { triggerHaptic } from "@/lib/offline-sync";

interface GymBuildingProps {
  sessions?: SkillSessionRecord[];
  playerLevel: number;
  skillLevel?: number;
  totalGpEarned?: number;
  isCozyActive?: boolean;
  onRefreshState: () => Promise<void>;
  onSubmitDirectSkillSession: (payload: Record<string, unknown>) => Promise<unknown>;
  onClose?: () => void;
}

export function GymBuilding({
  sessions = [],
  playerLevel,
  skillLevel = 1,
  totalGpEarned = 0,
  isCozyActive = true,
  onRefreshState,
  onSubmitDirectSkillSession,
  onClose,
}: GymBuildingProps) {
  const [activeTab, setActiveTab] = useState("session");
  const [selectedRoutine, setSelectedRoutine] = useState<"fuerza" | "cardio" | "movilidad">("fuerza");
  const [completedSets, setCompletedSets] = useState(3);
  const [waterGlasses, setWaterGlasses] = useState(2);
  const [intensityRating, setIntensityRating] = useState<"suave" | "moderada" | "intensa">("moderada");

  // Motor universal de sesiones con persistencia y RLS
  const {
    session,
    elapsedSeconds,
    formattedTime,
    isActive,
    isPaused,
    prepareSession,
    startSession,
    pauseSession,
    resumeSession,
    cancelSession,
    finishSession,
    history,
  } = useUniversalSession({
    targetDomain: "sports",
    targetBuildingId: "gimnasio",
  });

  const sportsSessions = sessions.filter((s) => s.domain === "sports");
  const totalMinutes = sportsSessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);

  const handleStartWorkout = () => {
    triggerHaptic("medium");
    if (!session) {
      prepareSession({
        objective: `Entrenamiento de ${selectedRoutine === "fuerza" ? "Fuerza" : selectedRoutine === "cardio" ? "Cardio" : "Movilidad"}`,
        specializedData: {
          routine: selectedRoutine,
          sets: completedSets,
          waterGlasses,
          intensity: intensityRating,
        },
      });
    }
    startSession();
  };

  const handleFinishWorkout = async () => {
    triggerHaptic("success");
    await finishSession({
      routine: selectedRoutine,
      sets: completedSets,
      waterGlasses,
      intensity: intensityRating,
    });
    await onSubmitDirectSkillSession({
      action: "log_skill_session",
      domain: "sports",
      duration_minutes: Math.max(1, Math.round(elapsedSeconds / 60)),
      details: `Entrenamiento de ${selectedRoutine} (${completedSets} series)`,
      intensity: intensityRating,
    });
    await onRefreshState();
  };

  return (
    <BuildingInteriorShell
      buildingId="gimnasio"
      buildingName="Gimnasio de Fuerza & Resistencia"
      domain="sports"
      districtName="Naturaleza & Vitalidad"
      icon="🏋️"
      tagline="Entrenamiento Funcional, Movilidad & Fortaleza Corporal"
      playerLevel={playerLevel}
      skillLevel={skillLevel}
      totalGpEarned={totalGpEarned}
      specificMetrics={[
        { label: "Entrenamientos", value: sportsSessions.length, icon: "🏋️" },
        { label: "Tiempo Activo", value: `${totalMinutes} min`, icon: "⏱️" },
        { label: "Hidratación", value: `${waterGlasses} vasos`, icon: "💧" },
      ]}
      activeTab={activeTab}
      tabs={[
        { id: "session", label: "Entrenamiento Activo", icon: <Dumbbell className="h-4 w-4" /> },
        { id: "routines", label: "Rutinas & Series", icon: <HeartPulse className="h-4 w-4" /> },
        { id: "history", label: "Historial de Actividad", icon: <Calendar className="h-4 w-4" />, badge: sportsSessions.length },
      ]}
      onTabChange={setActiveTab}
      onClose={onClose}
    >
      {/* =========================================================================
          TAB 1: ENTRENAMIENTO ACTIVO & CRONÓMETRO UNIVERSAL
         ========================================================================= */}
      {activeTab === "session" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tarjeta de Cronómetro Universal */}
            <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-6 shadow-[0_6px_0_#3A2E2B] flex flex-col items-center justify-center text-center space-y-4">
              <span className="text-xs font-black uppercase tracking-wider text-[#588157]">
                Temporizador de Esfuerzo
              </span>
              <div className="font-mono text-5xl font-black text-[#3A2E2B] tracking-tight bg-[#F7F4EB] px-6 py-3 rounded-2xl border-2 border-[#3A2E2B] shadow-inner">
                {formattedTime}
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-block h-3 w-3 rounded-full ${isActive ? "bg-emerald-500 animate-pulse" : isPaused ? "bg-amber-500" : "bg-slate-300"}`} />
                <span className="text-xs font-bold text-[#795548]">
                  {isActive ? "Entrenando en curso..." : isPaused ? "En pausa (recuperación)" : "Listo para iniciar"}
                </span>
              </div>

              {/* Botones de Control de Sesión */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {!isActive && !isPaused && (
                  <CozyButton variant="forest" size="md" onClick={handleStartWorkout} icon={<Play className="h-4 w-4" />}>
                    Iniciar Rutina
                  </CozyButton>
                )}
                {isActive && (
                  <CozyButton variant="sunlight" size="md" onClick={() => { pauseSession(); triggerHaptic("light"); }} icon={<Pause className="h-4 w-4" />}>
                    Pausar
                  </CozyButton>
                )}
                {isPaused && (
                  <CozyButton variant="forest" size="md" onClick={() => { resumeSession(); triggerHaptic("light"); }} icon={<Play className="h-4 w-4" />}>
                    Reanudar
                  </CozyButton>
                )}
                {(isActive || isPaused) && (
                  <CozyButton variant="clay" size="md" onClick={handleFinishWorkout} icon={<Square className="h-4 w-4" />}>
                    Finalizar Sesión
                  </CozyButton>
                )}
                {(isActive || isPaused) && (
                  <button
                    type="button"
                    onClick={() => { cancelSession(); triggerHaptic("warning"); }}
                    className="text-xs font-bold text-rose-700 hover:text-rose-900 transition underline cursor-pointer"
                  >
                    Descartar
                  </button>
                )}
              </div>
            </div>

            {/* Ajustes de la Rutina & Series */}
            <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-6 shadow-[0_6px_0_#3A2E2B] space-y-4">
              <h3 className="text-sm font-black text-[#3A2E2B] flex items-center gap-2">
                <span>🎯</span> Enfoque del Entrenamiento
              </h3>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "fuerza", label: "Fuerza", icon: "🏋️" },
                  { id: "cardio", label: "Cardio", icon: "🏃" },
                  { id: "movilidad", label: "Movilidad", icon: "🧘" },
                ].map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => { setSelectedRoutine(r.id as any); triggerHaptic("light"); }}
                    className={`rounded-2xl border-2 border-[#3A2E2B] p-2.5 text-center text-xs font-black transition cursor-pointer ${
                      selectedRoutine === r.id
                        ? "bg-[#588157] text-[#FFFDF8] shadow-[0_3px_0_#3A5A40]"
                        : "bg-[#F7F4EB] text-[#3A2E2B] hover:bg-[#E8DFCF]"
                    }`}
                  >
                    <span className="block text-xl mb-1">{r.icon}</span>
                    {r.label}
                  </button>
                ))}
              </div>

              {/* Contador de Series */}
              <div className="flex items-center justify-between border-t border-[#3A2E2B]/10 pt-3">
                <div>
                  <span className="block text-xs font-black text-[#3A2E2B]">Series Completadas</span>
                  <span className="text-[10px] text-[#795548]">Control de volumen de trabajo</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCompletedSets(Math.max(1, completedSets - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] font-bold text-sm hover:bg-[#E8DFCF]"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-8 text-center font-mono text-base font-black text-[#3A2E2B]">{completedSets}</span>
                  <button
                    type="button"
                    onClick={() => setCompletedSets(completedSets + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] font-bold text-sm hover:bg-[#E8DFCF]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Contador de Hidratación */}
              <div className="flex items-center justify-between border-t border-[#3A2E2B]/10 pt-3">
                <div>
                  <span className="block text-xs font-black text-[#3A2E2B]">Hidratación</span>
                  <span className="text-[10px] text-[#795548]">Vasos de agua (250ml)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setWaterGlasses(Math.max(0, waterGlasses - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] font-bold text-sm hover:bg-[#E8DFCF]"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-8 text-center font-mono text-base font-black text-[#3A2E2B]">💧 {waterGlasses}</span>
                  <button
                    type="button"
                    onClick={() => setWaterGlasses(waterGlasses + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] font-bold text-sm hover:bg-[#E8DFCF]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: RUTINAS DE VITALIDAD
         ========================================================================= */}
      {activeTab === "routines" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-3xl border-3 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_4px_0_#3A2E2B] space-y-2">
            <span className="text-2xl select-none">🏋️</span>
            <h4 className="text-sm font-black text-[#3A2E2B]">Fuerza Funcional</h4>
            <p className="text-xs text-[#795548]">
              Sentadillas, flexiones, dominadas y peso corporal. Enfoque en postura y control muscular sin prisa.
            </p>
            <div className="pt-2 text-[10px] font-bold text-[#588157]">3 a 5 series • 8 a 12 repeticiones</div>
          </div>

          <div className="rounded-3xl border-3 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_4px_0_#3A2E2B] space-y-2">
            <span className="text-2xl select-none">🏃</span>
            <h4 className="text-sm font-black text-[#3A2E2B]">Cardio & Resistencia</h4>
            <p className="text-xs text-[#795548]">
              Saltar la cuerda, trote suave o intervalos aeróbicos para activar el sistema circulatorio y la respiración.
            </p>
            <div className="pt-2 text-[10px] font-bold text-[#588157]">15 a 30 minutos continuos</div>
          </div>

          <div className="rounded-3xl border-3 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_4px_0_#3A2E2B] space-y-2">
            <span className="text-2xl select-none">🧘</span>
            <h4 className="text-sm font-black text-[#3A2E2B]">Movilidad & Flexibilidad</h4>
            <p className="text-xs text-[#795548]">
              Descompresión espinal, apertura de caderas y estiramientos conscientes para recuperar ligereza.
            </p>
            <div className="pt-2 text-[10px] font-bold text-[#588157]">10 a 20 minutos de calma</div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: HISTORIAL DE ACTIVIDAD
         ========================================================================= */}
      {activeTab === "history" && (
        <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-6 shadow-[0_6px_0_#3A2E2B] space-y-3">
          <h3 className="text-sm font-black text-[#3A2E2B]">Sesiones Registradas en el Gimnasio</h3>
          {sportsSessions.length === 0 ? (
            <p className="text-xs text-[#795548] italic py-4">Aún no hay entrenamientos registrados. ¡Inicia tu primera sesión hoy!</p>
          ) : (
            <div className="divide-y divide-[#3A2E2B]/10">
              {sportsSessions.map((ses, i) => (
                <div key={ses.id || i} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-[#3A2E2B]">{ses.details || "Entrenamiento general"}</span>
                    <span className="block text-[10px] text-[#795548]">
                      {new Date(ses.timestamp || Date.now()).toLocaleDateString("es-CO", { dateStyle: "medium" })}
                    </span>
                  </div>
                  <span className="rounded-full bg-[#588157]/15 border border-[#588157]/30 px-2 py-0.5 text-[11px] font-black text-[#588157]">
                    +{ses.duration_minutes || 15} min
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </BuildingInteriorShell>
  );
}
