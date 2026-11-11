"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Compass,
  Play,
  Pause,
  Square,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Eye,
  Flame,
  Target,
  Clock,
  Award,
  ShieldCheck,
  History,
  ShieldAlert,
} from "lucide-react";
import type { SkillSessionRecord } from "@/types/rpg";
import { useUniversalSession } from "@/lib/sanctuary/use-universal-session";
import { CozyButton, CozyNotification } from "@/components/cozy/ui";
import { BuildingInteriorShell } from "@/components/sanctuary/building-interior-shell";
import { triggerHaptic } from "@/lib/offline-sync";

interface ObservatorioBuildingProps {
  sessions?: SkillSessionRecord[];
  playerLevel?: number;
  skillLevel?: number;
  totalGpEarned?: number;
  isCozyActive?: boolean;
  onRefreshState: () => void | Promise<void>;
  onSubmitDirectSkillSession: (payload: Record<string, unknown>) => Promise<unknown>;
  onClose?: () => void;
}

export function ObservatorioBuilding({
  sessions = [],
  playerLevel = 1,
  skillLevel = 1,
  totalGpEarned = 0,
  isCozyActive = true,
  onRefreshState,
  onSubmitDirectSkillSession,
  onClose,
}: ObservatorioBuildingProps) {
  const [activeTab, setActiveTab] = useState<"foco" | "interrupciones" | "historial">("foco");

  // Enfoque / preset
  const [focusMode, setFocusMode] = useState<"pomodoro" | "deep" | "flow">("pomodoro");
  const [targetGoal, setTargetGoal] = useState<string>("Arquitectura & Resolución de Bloqueos");
  const [distractions, setDistractions] = useState<string[]>([]);
  const [distractionInput, setDistractionInput] = useState("");
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "warning";
    message: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Motor Universal de Sesiones
  const {
    session,
    isRunning,
    isPaused,
    isActive,
    elapsedMinutes,
    formattedTime,
    startSession,
    pauseSession,
    resumeSession,
    resetSession,
    finishSession,
  } = useUniversalSession("general", "observatorio");

  const focusPresets = [
    { id: "pomodoro", name: "Pomodoro Clásico", time: "25 min", minutes: 25 },
    { id: "deep", name: "Deep Work Sprint", time: "50 min", minutes: 50 },
    { id: "flow", name: "Flow State Cósmico", time: "90 min", minutes: 90 },
  ];

  const handleStartFocus = (mins: number) => {
    triggerHaptic("light");
    startSession({
      domain: "general",
      buildingId: "observatorio",
      resourceTitle: targetGoal,
      objective: `Bloque de foco de ${mins} min: ${targetGoal}`,
    });
    setNotification({
      type: "success",
      message: "🔭 ¡Cúpula del Observatorio en silencio! Bloque de Deep Work iniciado.",
    });
  };

  const handleAddDistraction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!distractionInput.trim()) return;
    triggerHaptic("light");
    setDistractions((prev) => [...prev, distractionInput.trim()]);
    setDistractionInput("");
  };

  const handleFinishFocusSession = async () => {
    setIsSubmitting(true);
    triggerHaptic("medium");
    try {
      await finishSession({
        domain: "general",
        action_type: "deep_work_focus",
        details: `Enfoque en Observatorio: ${targetGoal}${
          distractions.length > 0 ? ` (Distracciones repelidas: ${distractions.length})` : ""
        }`,
        focus_mode: focusMode,
        target_goal: targetGoal,
        distractions_logged: distractions,
      });

      setNotification({
        type: "success",
        message: "✨ ¡Bloque de Deep Work completado y registrado con éxito!",
      });
      setDistractions([]);
      await onRefreshState();
    } catch {
      setNotification({
        type: "error",
        message: "Error al finalizar la sesión de foco.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const focusSessions = sessions.filter(
    (s) =>
      s.domain === "general" ||
      s.details?.toLowerCase().includes("enfoque") ||
      s.details?.toLowerCase().includes("focus")
  );

  const totalFocusMinutes = focusSessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);

  return (
    <BuildingInteriorShell
      buildingId="observatorio"
      buildingName="El Observatorio Cósmico"
      domain="general"
      districtName="Distrito del Saber"
      icon="🔭"
      tagline="Cúpula de silencio y meditación cósmica. Un santuario blindado de distracciones externas."
      playerLevel={playerLevel}
      skillLevel={skillLevel}
      totalGpEarned={totalGpEarned}
      specificMetrics={[
        { label: "Horas de Foco", value: `${Math.round(totalFocusMinutes / 60)}h ${totalFocusMinutes % 60}m` },
        { label: "Sesiones de Foco", value: focusSessions.length },
      ]}
      lastSessionSummary={
        targetGoal ? `Continuar enfoque en "${targetGoal}" (${focusMode})` : undefined
      }
      continueActionLabel="Iniciar Deep Work"
      onContinueLastSession={() => {
        setActiveTab("foco");
        handleStartFocus(25);
      }}
      activeTab={activeTab}
      tabs={[
        { id: "foco", label: "Deep Work Activo", icon: <Target className="h-3.5 w-3.5" /> },
        { id: "interrupciones", label: "Registro de Distracciones", icon: <ShieldAlert className="h-3.5 w-3.5" />, badge: distractions.length > 0 ? distractions.length : undefined },
        { id: "historial", label: "Historial de Foco", icon: <History className="h-3.5 w-3.5" />, badge: focusSessions.length },
      ]}
      onTabChange={(tabId) => setActiveTab(tabId as typeof activeTab)}
      onClose={onClose}
    >
      {notification && (
        <div className="mb-4">
          <CozyNotification
            variant={notification.type}
            title={notification.type === "success" ? "¡Éxito!" : "Aviso"}
            message={notification.message}
            onDismiss={() => setNotification(null)}
          />
        </div>
      )}

      {/* =======================================================================
          TAB 1: DEEP WORK ACTIVO
         ======================================================================= */}
      {activeTab === "foco" && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-7 space-y-4">
            <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-6 shadow-[0_6px_0_#3A2E2B] space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-[#795548] tracking-wider block">
                  Objetivo de Concentración
                </span>
                <input
                  type="text"
                  value={targetGoal}
                  onChange={(e) => setTargetGoal(e.target.value)}
                  placeholder="¿Cuál es la única cosa que vas a resolver en este bloque?"
                  className="w-full rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3.5 py-2 text-xs font-black text-[#3A2E2B] outline-none"
                />
              </div>

              {/* Presets de Tiempo */}
              <div className="grid grid-cols-3 gap-2">
                {focusPresets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setFocusMode(p.id as typeof focusMode)}
                    className={`rounded-xl border-2 p-2.5 text-center transition cursor-pointer ${
                      focusMode === p.id
                        ? "border-[#3A2E2B] bg-[#314C3C] text-[#FFFDF8] shadow-[0_2px_0_#1A2B20]"
                        : "border-[#3A2E2B] bg-[#F4EEDC] text-[#3A2E2B] hover:bg-[#E7D69C]"
                    }`}
                  >
                    <span className="text-xs font-black block">{p.name}</span>
                    <span className="text-[10px] opacity-80">{p.time}</span>
                  </button>
                ))}
              </div>

              {/* Cronómetro Universal */}
              <div className="rounded-2xl border-3 border-[#3A2E2B] bg-[#F4EEDC] p-4 text-center space-y-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#795548] block">
                  {isRunning ? "🔭 Deep Work en Curso" : isPaused ? "⏸️ En Pausa" : "🌌 Cúpula en Silencio"}
                </span>

                <div className="font-mono text-4xl sm:text-5xl font-black text-[#3A2E2B] tracking-tight">
                  {formattedTime}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  {!isActive ? (
                    <CozyButton
                      variant="forest"
                      size="md"
                      onClick={() => handleStartFocus(focusMode === "pomodoro" ? 25 : focusMode === "deep" ? 50 : 90)}
                      className="flex items-center gap-2"
                    >
                      <Play className="h-4 w-4" />
                      Iniciar Bloque de Foco
                    </CozyButton>
                  ) : (
                    <>
                      {isRunning ? (
                        <CozyButton
                          variant="clay"
                          size="md"
                          onClick={() => {
                            triggerHaptic("light");
                            pauseSession();
                          }}
                          className="flex items-center gap-1.5"
                        >
                          <Pause className="h-4 w-4" />
                          Pausar
                        </CozyButton>
                      ) : (
                        <CozyButton
                          variant="forest"
                          size="md"
                          onClick={() => {
                            triggerHaptic("light");
                            resumeSession();
                          }}
                          className="flex items-center gap-1.5"
                        >
                          <Play className="h-4 w-4" />
                          Reanudar
                        </CozyButton>
                      )}

                      <CozyButton
                        variant="sunlight"
                        size="md"
                        disabled={isSubmitting}
                        onClick={handleFinishFocusSession}
                        className="flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {isSubmitting ? "Registrando..." : "Completar Foco"}
                      </CozyButton>

                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic("warning");
                          resetSession();
                        }}
                        className="text-xs font-bold text-red-700 underline hover:text-red-900 cursor-pointer ml-2"
                      >
                        Descartar
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-5 space-y-4">
            <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] space-y-3">
              <h4 className="text-xs font-black uppercase text-[#3A2E2B]">
                Escudo Contra la Fragmentación
              </h4>
              <p className="text-xs text-[#795548]">
                Si te asalta una idea o impulso externo mientras estás enfocado, anótalo aquí abajo para atenderlo después y no romper el flujo.
              </p>

              <form onSubmit={handleAddDistraction} className="flex gap-2">
                <input
                  type="text"
                  value={distractionInput}
                  onChange={(e) => setDistractionInput(e.target.value)}
                  placeholder="Distracción evitada..."
                  className="flex-1 rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-1.5 text-xs font-bold text-[#3A2E2B] outline-none"
                />
                <CozyButton variant="wood" size="sm" type="submit">
                  Atrapar
                </CozyButton>
              </form>

              {distractions.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-[#3A2E2B]/15">
                  <span className="text-[10px] font-bold text-[#795548] uppercase block">
                    Distracciones Desactivadas ({distractions.length}):
                  </span>
                  {distractions.map((d, i) => (
                    <div key={i} className="rounded-xl border border-[#3A2E2B]/20 bg-[#F4EEDC] p-2 text-xs text-[#3A2E2B]">
                      🛡️ {d}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 2: REGISTRO DE DISTRACCIONES
         ======================================================================= */}
      {activeTab === "interrupciones" && (
        <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] space-y-3">
          <h4 className="text-xs font-black uppercase text-[#3A2E2B]">
            Registro de Impulsos e Interrupciones Desactivadas
          </h4>
          <p className="text-xs text-[#795548]">
            La mente suele buscar distracciones cuando enfrenta fricción creativa. Nombrar la distracción y posponerla reduce su carga dopaminérgica en un 80%.
          </p>

          {distractions.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#795548]">
              Cero distracciones registradas en este bloque. ¡Atención impecable!
            </div>
          ) : (
            <div className="space-y-2 pt-2">
              {distractions.map((d, idx) => (
                <div key={idx} className="rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC] p-3 text-xs flex justify-between items-center">
                  <span>🛡️ {d}</span>
                  <span className="text-[10px] font-bold text-[#77936A]">Neutralizada</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =======================================================================
          TAB 3: HISTORIAL DE FOCO PROFUNDO
         ======================================================================= */}
      {activeTab === "historial" && (
        <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] space-y-3">
          <h4 className="text-xs font-black uppercase text-[#3A2E2B]">
            Historial de Bloques en el Observatorio Cósmico
          </h4>

          {focusSessions.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#795548]">
              Aún no hay bloques de Deep Work registrados. ¡Enciende el foco cósmico!
            </div>
          ) : (
            <div className="divide-y divide-[#3A2E2B]/15">
              {focusSessions.map((ses) => (
                <div key={ses.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-black text-[#3A2E2B] block">
                      {ses.title}
                    </span>
                    <span className="text-[10px] text-[#795548]">
                      {ses.details} • {new Date(ses.timestamp).toLocaleDateString("es-CO")}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-[#314C3C]">
                      +{ses.gp_earned} GP
                    </span>
                    <span className="text-[10px] text-[#795548] block">
                      {ses.duration_minutes} min
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </BuildingInteriorShell>
  );
}
