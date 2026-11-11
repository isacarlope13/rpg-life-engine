"use client";

import React, { useState } from "react";
import {
  Briefcase,
  Clock,
  Play,
  Pause,
  Square,
  Sparkles,
  CheckCircle2,
  FolderGit2,
  Target,
  BarChart3,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
  Award,
} from "lucide-react";
import { useUniversalSession, formatStopwatchTime } from "@/lib/sanctuary/use-universal-session";
import { CozyButton, CozyNotification } from "@/components/cozy/ui";
import { triggerHaptic } from "@/lib/offline-sync";

interface OfficeBuildingProps {
  playerLevel: number;
  skillLevel?: number;
  totalGpEarned?: number;
  isCozyActive?: boolean;
  onRefreshState: () => Promise<void>;
  onSubmitDirectSkillSession: (payload: Record<string, unknown>) => Promise<unknown>;
  onClose?: () => void;
}

interface ProjectTrack {
  id: string;
  name: string;
  category: "estrategico" | "operativo" | "innovacion";
  progressPercent: number;
  completedTasks: number;
  totalTasks: number;
  icon: string;
}

const DEFAULT_PROJECTS: ProjectTrack[] = [
  {
    id: "proj-1",
    name: "RPG Life-Engine v3.5 Arquitectura",
    category: "estrategico",
    progressPercent: 85,
    completedTasks: 17,
    totalTasks: 20,
    icon: "🏰",
  },
  {
    id: "proj-2",
    name: "Automatización & Tareas Recurrentes",
    category: "innovacion",
    progressPercent: 70,
    completedTasks: 7,
    totalTasks: 10,
    icon: "⚡",
  },
  {
    id: "proj-3",
    name: "Bitácora & Cierre Operativo Semanal",
    category: "operativo",
    progressPercent: 60,
    completedTasks: 3,
    totalTasks: 5,
    icon: "📋",
  },
];

export function OfficeBuilding({
  playerLevel,
  skillLevel = 1,
  totalGpEarned = 0,
  isCozyActive = true,
  onRefreshState,
  onSubmitDirectSkillSession,
  onClose,
}: OfficeBuildingProps) {
  const { session, startSession, pauseSession, resumeSession, resetSession } =
    useUniversalSession("work", "oficina");

  const [activeTab, setActiveTab] = useState<"timer" | "projects" | "log">("timer");
  const [sessionNotes, setSessionNotes] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("proj-1");
  const [manualDuration, setManualDuration] = useState(25);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "warning";
    message: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStartTimer = (presetMinutes?: number) => {
    triggerHaptic("light");
    startSession({
      domain: "work",
      buildingId: "oficina",
      objective: `Sprint Pomodoro de ${presetMinutes || 25} min`,
      notes: sessionNotes || "Bloque de trabajo enfocado",
    });
  };

  const handleCompleteTimerSession = async () => {
    if (!session) return;
    setIsSubmitting(true);
    triggerHaptic("medium");

    const finalMinutes = Math.max(1, Math.round(session.elapsedSeconds / 60));
    try {
      await onSubmitDirectSkillSession({
        domain: "work",
        duration_minutes: finalMinutes,
        details: sessionNotes || `Sprint de trabajo: ${DEFAULT_PROJECTS.find((p) => p.id === selectedProjectId)?.name || "Gestión de proyectos"} (${finalMinutes} min)`,
      });

      resetSession();
      setSessionNotes("");
      setNotification({
        type: "success",
        message: `¡Sprint completado con éxito! +${finalMinutes * 2} XP asignados a Trabajo Estratégico.`,
      });
      await onRefreshState();
    } catch (e) {
      console.error(e);
      setNotification({
        type: "error",
        message: "No se pudo registrar la sesión de trabajo. Intenta de nuevo.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualQuickLog = async () => {
    if (manualDuration < 1 || isSubmitting) return;
    setIsSubmitting(true);
    triggerHaptic("light");

    const projectName = DEFAULT_PROJECTS.find((p) => p.id === selectedProjectId)?.name || "Actividad general";

    try {
      await onSubmitDirectSkillSession({
        domain: "work",
        duration_minutes: manualDuration,
        details: sessionNotes || `Bloque de trabajo registrado: ${projectName} (${manualDuration} min)`,
      });

      setSessionNotes("");
      setNotification({
        type: "success",
        message: `¡Registro de ${manualDuration} min guardado exitosamente!`,
      });
      await onRefreshState();
    } catch (e) {
      console.error(e);
      setNotification({
        type: "error",
        message: "Error al registrar la sesión de trabajo.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 text-[#3A2E2B]">
      {/* CABECERA TEMÁTICA DE LA OFICINA */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border-3 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_4px_0_#3A2E2B]">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[#3A2E2B] bg-[#4361EE]/10 text-2xl shadow-inner">
            💼
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-[#3A2E2B]">
                Torre de Gestión & Oficina de Proyectos
              </h3>
              <span className="rounded-full bg-[#4361EE]/15 border border-[#4361EE]/40 px-2.5 py-0.5 text-[10px] font-black text-[#3046C4]">
                Dominio: Trabajo Estratégico
              </span>
            </div>
            <p className="text-xs text-[#795548]">
              Organiza sprints de concentración, gestiona proyectos y forja disciplina profesional sin fatiga.
            </p>
          </div>
        </div>

        {/* MÉTRICAS CANÓNICAS DE TRABAJO */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3.5 py-1.5 text-center shadow-[0_2px_0_#3A2E2B]">
            <span className="text-[10px] font-bold text-[#795548] uppercase block">
              Nivel de Carrera
            </span>
            <span className="text-sm font-black text-[#3A2E2B]">
              Grado {skillLevel}
            </span>
          </div>

          <div className="rounded-2xl border-2 border-[#3A2E2B] bg-[#E7D69C]/30 px-3.5 py-1.5 text-center shadow-[0_2px_0_#3A2E2B]">
            <span className="text-[10px] font-bold text-[#795548] uppercase block">
              GP Generados
            </span>
            <span className="text-sm font-black text-[#3A2E2B]">
              +{totalGpEarned.toLocaleString("es-CO")} GP
            </span>
          </div>
        </div>
      </div>

      {/* NOTIFICACIONES TEMPORALES */}
      {notification && (
        <CozyNotification
          variant={notification.type}
          title={notification.type === "success" ? "¡Sesión Registrada!" : "Aviso"}
          message={notification.message}
          onDismiss={() => setNotification(null)}
        />
      )}

      {/* TABS DE NAVEGACIÓN INTERIOR */}
      <div className="flex items-center gap-2 border-b-2 border-[#3A2E2B]/20 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("timer")}
          className={`flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-xs font-black transition cursor-pointer ${
            activeTab === "timer"
              ? "border-[#3A2E2B] bg-[#4361EE] text-[#FFFDF8] shadow-[0_3px_0_#1E2C80]"
              : "border-transparent bg-[#FFFDF8] text-[#795548] hover:bg-[#F4EEDC]"
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          Temporizador Pomodoro
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("projects")}
          className={`flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-xs font-black transition cursor-pointer ${
            activeTab === "projects"
              ? "border-[#3A2E2B] bg-[#4361EE] text-[#FFFDF8] shadow-[0_3px_0_#1E2C80]"
              : "border-transparent bg-[#FFFDF8] text-[#795548] hover:bg-[#F4EEDC]"
          }`}
        >
          <FolderGit2 className="h-3.5 w-3.5" />
          Proyectos Activos
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("log")}
          className={`flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-xs font-black transition cursor-pointer ${
            activeTab === "log"
              ? "border-[#3A2E2B] bg-[#4361EE] text-[#FFFDF8] shadow-[0_3px_0_#1E2C80]"
              : "border-transparent bg-[#FFFDF8] text-[#795548] hover:bg-[#F4EEDC]"
          }`}
        >
          <Briefcase className="h-3.5 w-3.5" />
          Registro Rápido
        </button>
      </div>

      {/* CONTENIDO SEGÚN TAB */}
      {activeTab === "timer" && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Cronómetro Central */}
          <div className="md:col-span-7 rounded-3xl border-3 border-[#3A2E2B] bg-[#FFFDF8] p-6 shadow-[0_4px_0_#3A2E2B] text-center space-y-4">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#795548]">
              {session?.status === "running"
                ? "⚡ Sprint en Curso"
                : session?.status === "paused"
                ? "⏸️ Sprint en Pausa"
                : "⏱️ Listo para Concentrarse"}
            </span>

            <div className="font-mono text-5xl sm:text-6xl font-black text-[#3A2E2B] tracking-tight">
              {session ? formatStopwatchTime(session.elapsedSeconds) : "00:00"}
            </div>

            {/* Selector de Proyecto para el Timer */}
            <div className="text-left space-y-1">
              <label className="text-xs font-bold text-[#795548]">
                Vincular a Proyecto:
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-2 text-xs font-bold text-[#3A2E2B] outline-none"
              >
                {DEFAULT_PROJECTS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.icon} {p.name} ({p.progressPercent}% completado)
                  </option>
                ))}
              </select>
            </div>

            {/* Notas del Sprint */}
            <div className="text-left space-y-1">
              <label className="text-xs font-bold text-[#795548]">
                Objetivo del bloque:
              </label>
              <input
                type="text"
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder="Ej. Rediseñar endpoint de sincronización..."
                className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-2 text-xs font-medium text-[#3A2E2B] placeholder:text-[#795548]/60 outline-none"
              />
            </div>

            {/* Controles del Cronómetro */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {!session || session.status === "idle" ? (
                <>
                  <CozyButton
                    variant="forest"
                    size="md"
                    onClick={() => handleStartTimer(25)}
                    className="flex items-center gap-1.5"
                  >
                    <Play className="h-4 w-4" />
                    Iniciar Pomodoro (25m)
                  </CozyButton>

                  <CozyButton
                    variant="wood"
                    size="md"
                    onClick={() => handleStartTimer(50)}
                    className="flex items-center gap-1.5"
                  >
                    <Sparkles className="h-4 w-4" />
                    Bloque Profundo (50m)
                  </CozyButton>
                </>
              ) : (
                <>
                  {session.status === "running" ? (
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
                    onClick={handleCompleteTimerSession}
                    className="flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {isSubmitting ? "Guardando..." : "Finalizar & Registrar"}
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

          {/* Panel Lateral: Consejos de Productividad */}
          <div className="md:col-span-5 rounded-3xl border-3 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_4px_0_#3A2E2B] space-y-3">
            <h4 className="text-xs font-black uppercase text-[#795548] flex items-center gap-1.5">
              <span>🎯</span> Reglas de Oro del Trabajo Ágil
            </h4>
            <div className="space-y-2 text-xs text-[#5C4033]">
              <div className="rounded-2xl border-2 border-[#3A2E2B]/30 bg-[#F4EEDC] p-3 space-y-1">
                <span className="font-black text-[#3A2E2B] block">
                  1. Una sola tarea a la vez
                </span>
                <p>
                  El cambio constante de contexto consume hasta el 40% de tu energía cognitiva. Concéntrate en un objetivo único por sprint.
                </p>
              </div>

              <div className="rounded-2xl border-2 border-[#3A2E2B]/30 bg-[#F4EEDC] p-3 space-y-1">
                <span className="font-black text-[#3A2E2B] block">
                  2. Descanso obligatorio al sonar
                </span>
                <p>
                  Al culminar los 25 minutos, levántate, estira las piernas y mira al horizonte antes del próximo bloque.
                </p>
              </div>

              <div className="rounded-2xl border-2 border-[#3A2E2B]/30 bg-[#F4EEDC] p-3 space-y-1">
                <span className="font-black text-[#3A2E2B] block">
                  3. Idempotencia y Recompensa Justa
                </span>
                <p>
                  Cada minuto registrado forja experiencia profesional en tu perfil canónico y aporta a la economía del reino.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "projects" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {DEFAULT_PROJECTS.map((proj) => (
              <div
                key={proj.id}
                className="rounded-3xl border-3 border-[#3A2E2B] bg-[#FFFDF8] p-4 shadow-[0_4px_0_#3A2E2B] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{proj.icon}</span>
                  <span className="rounded-full bg-[#314C3C]/10 border border-[#314C3C]/30 px-2 py-0.5 text-[9px] font-black text-[#314C3C] uppercase">
                    {proj.category}
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-black text-[#3A2E2B]">
                    {proj.name}
                  </h4>
                  <span className="text-[10px] text-[#795548] font-bold">
                    {proj.completedTasks} de {proj.totalTasks} tareas completadas
                  </span>
                </div>
                {/* Barra de progreso */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-[#795548]">
                    <span>Avance</span>
                    <span>{proj.progressPercent}%</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full border-2 border-[#3A2E2B] bg-[#F4EEDC] overflow-hidden">
                    <div
                      className="h-full bg-[#4361EE] transition-all duration-500"
                      style={{ width: `${proj.progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "log" && (
        <div className="max-w-xl mx-auto rounded-3xl border-3 border-[#3A2E2B] bg-[#FFFDF8] p-6 shadow-[0_4px_0_#3A2E2B] space-y-4">
          <h4 className="text-sm font-black text-[#3A2E2B]">
            Registro Manual de Trabajo Completado
          </h4>
          <p className="text-xs text-[#795548]">
            Si trabajaste fuera de la aplicación, registra el bloque retrospectivo para no perder racha ni XP.
          </p>

          <div className="space-y-2">
            <label className="text-xs font-bold text-[#795548]">
              Duración en minutos:
            </label>
            <div className="flex gap-2">
              {[15, 25, 45, 60, 90].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setManualDuration(mins)}
                  className={`flex-1 rounded-xl border-2 py-1.5 text-xs font-bold transition cursor-pointer ${
                    manualDuration === mins
                      ? "border-[#3A2E2B] bg-[#4361EE] text-[#FFFDF8] shadow-[0_2px_0_#1E2C80]"
                      : "border-[#3A2E2B] bg-[#F4EEDC] text-[#3A2E2B] hover:bg-[#E7D69C]"
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-[#795548]">
              Proyecto o Tarea:
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-2 text-xs font-bold text-[#3A2E2B] outline-none"
            >
              {DEFAULT_PROJECTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.icon} {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-[#795548]">
              Notas de la actividad:
            </label>
            <input
              type="text"
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder="Ej. Análisis de métricas y planificación de sprint..."
              className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-2 text-xs font-medium text-[#3A2E2B] outline-none"
            />
          </div>

          <CozyButton
            variant="forest"
            size="md"
            disabled={isSubmitting}
            onClick={handleManualQuickLog}
            className="w-full flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isSubmitting ? "Registrando..." : `Guardar Sesión de ${manualDuration} min`}
          </CozyButton>
        </div>
      )}
    </div>
  );
}
