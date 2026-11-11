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
  Users2,
  FileCheck2,
  History,
} from "lucide-react";
import { useUniversalSession, formatStopwatchTime } from "@/lib/sanctuary/use-universal-session";
import { CozyButton, CozyNotification } from "@/components/cozy/ui";
import { BuildingInteriorShell } from "@/components/sanctuary/building-interior-shell";
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
  deliverable?: string;
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
    deliverable: "Lanzamiento y Auditoría Formal en Producción",
  },
  {
    id: "proj-2",
    name: "Automatización & Tareas Recurrentes",
    category: "innovacion",
    progressPercent: 70,
    completedTasks: 7,
    totalTasks: 10,
    icon: "⚡",
    deliverable: "Motor de cronjobs y scheduler circadiano",
  },
  {
    id: "proj-3",
    name: "Bitácora & Cierre Operativo Semanal",
    category: "operativo",
    progressPercent: 60,
    completedTasks: 3,
    totalTasks: 5,
    icon: "📋",
    deliverable: "Revisión de métricas y conciliación financiera",
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
  const { session, isRunning, isPaused, isActive, formattedTime, startSession, pauseSession, resumeSession, resetSession } =
    useUniversalSession("work", "oficina");

  const [activeTab, setActiveTab] = useState<"timer" | "projects" | "meetings" | "deliverables">("timer");
  const [sessionNotes, setSessionNotes] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("proj-1");
  const [manualDuration, setManualDuration] = useState(25);
  const [meetingNotes, setMeetingNotes] = useState("");
  const [meetingSubject, setMeetingSubject] = useState("");
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "warning";
    message: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeProject = DEFAULT_PROJECTS.find((p) => p.id === selectedProjectId) || DEFAULT_PROJECTS[0];

  const handleStartTimer = (presetMinutes?: number) => {
    triggerHaptic("light");
    startSession({
      domain: "work",
      buildingId: "oficina",
      objective: `Sprint Pomodoro de ${presetMinutes || 25} min: ${activeProject.name}`,
      notes: sessionNotes || "Bloque de trabajo enfocado",
    });
    setNotification({
      type: "success",
      message: `💼 ¡Sprint de trabajo iniciado en "${activeProject.name}"!`,
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
        details: sessionNotes || `Sprint de trabajo: ${activeProject.name} (${finalMinutes} min)`,
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
        message: "No se pudo registrar la sesión de trabajo.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualQuickLog = async () => {
    if (manualDuration < 1 || isSubmitting) return;
    setIsSubmitting(true);
    triggerHaptic("light");

    try {
      await onSubmitDirectSkillSession({
        domain: "work",
        duration_minutes: manualDuration,
        details: sessionNotes || `Bloque de trabajo registrado: ${activeProject.name} (${manualDuration} min)`,
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

  const handleLogMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingSubject.trim()) return;
    setIsSubmitting(true);

    try {
      await onSubmitDirectSkillSession({
        domain: "work",
        duration_minutes: 30,
        details: `Reunión / Sync: ${meetingSubject.trim()}${meetingNotes ? ` — ${meetingNotes.trim()}` : ""}`,
      });

      setNotification({
        type: "success",
        message: `📋 ¡Minuta de reunión "${meetingSubject}" registrada!`,
      });
      setMeetingSubject("");
      setMeetingNotes("");
      await onRefreshState();
    } catch {
      setNotification({
        type: "error",
        message: "Error al registrar la reunión.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BuildingInteriorShell
      buildingId="oficina"
      buildingName="Torre de Gestión & Oficina"
      domain="work"
      districtName="Plaza & Gestión"
      icon="💼"
      tagline="Centro de mando ágil: sprints Pomodoro, backlog de proyectos, reuniones y entregables de alto impacto."
      playerLevel={playerLevel}
      skillLevel={skillLevel}
      totalGpEarned={totalGpEarned}
      specificMetrics={[
        { label: "Proyectos Activos", value: DEFAULT_PROJECTS.length },
        { label: "Entregables", value: "3 en curso" },
      ]}
      lastSessionSummary={
        activeProject
          ? `Continuar sprint en "${activeProject.name}" (${activeProject.progressPercent}% completado)`
          : undefined
      }
      continueActionLabel="Iniciar Sprint Pomodoro"
      onContinueLastSession={() => {
        setActiveTab("timer");
        handleStartTimer(25);
      }}
      activeTab={activeTab}
      tabs={[
        { id: "timer", label: "Sprints & Pomodoro", icon: <Clock className="h-3.5 w-3.5" /> },
        { id: "projects", label: "Proyectos & Tareas", icon: <FolderGit2 className="h-3.5 w-3.5" />, badge: DEFAULT_PROJECTS.length },
        { id: "meetings", label: "Reuniones & Minutas", icon: <Users2 className="h-3.5 w-3.5" /> },
        { id: "deliverables", label: "Entregables & Registro", icon: <FileCheck2 className="h-3.5 w-3.5" /> },
      ]}
      onTabChange={(tabId) => setActiveTab(tabId as typeof activeTab)}
      onClose={onClose}
    >
      {notification && (
        <div className="mb-4">
          <CozyNotification
            variant={notification.type}
            title={notification.type === "success" ? "¡Sesión Registrada!" : "Aviso"}
            message={notification.message}
            onDismiss={() => setNotification(null)}
          />
        </div>
      )}

      {/* =======================================================================
          TAB 1: SPRINTS & POMODORO
         ======================================================================= */}
      {activeTab === "timer" && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-7 rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-6 shadow-[0_6px_0_#3A2E2B] text-center space-y-4">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#795548]">
              {isRunning
                ? "⚡ Sprint en Curso"
                : isPaused
                ? "⏸️ Sprint en Pausa"
                : "⏱️ Listo para Concentrarse"}
            </span>

            <div className="font-mono text-5xl sm:text-6xl font-black text-[#3A2E2B] tracking-tight">
              {session ? formattedTime : "00:00"}
            </div>

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

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {!isActive ? (
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

          <div className="md:col-span-5 rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] space-y-3">
            <h4 className="text-xs font-black uppercase text-[#795548] flex items-center gap-1.5">
              <span>🎯</span> Reglas de Oro del Trabajo Ágil
            </h4>
            <div className="space-y-2 text-xs text-[#5C4033]">
              <div className="rounded-2xl border-2 border-[#3A2E2B]/30 bg-[#F4EEDC] p-3 space-y-1">
                <span className="font-black text-[#3A2E2B] block">
                  1. Una sola tarea a la vez
                </span>
                <p>
                  El cambio constante de contexto consume energía cognitiva. Concéntrate en un objetivo único por sprint.
                </p>
              </div>

              <div className="rounded-2xl border-2 border-[#3A2E2B]/30 bg-[#F4EEDC] p-3 space-y-1">
                <span className="font-black text-[#3A2E2B] block">
                  2. Descanso obligatorio al sonar
                </span>
                <p>
                  Al culminar los 25 minutos, levántate, respira hondo y mira al horizonte antes del próximo bloque.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 2: PROYECTOS & TAREAS
         ======================================================================= */}
      {activeTab === "projects" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {DEFAULT_PROJECTS.map((proj) => (
            <div
              key={proj.id}
              className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] space-y-3"
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
              {proj.deliverable && (
                <div className="rounded-xl border border-[#3A2E2B]/20 bg-[#F4EEDC] p-2 text-[10px] text-[#795548]">
                  <span className="font-bold text-[#3A2E2B] block">Entregable:</span>
                  <span>{proj.deliverable}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* =======================================================================
          TAB 3: REUNIONES & MINUTAS
         ======================================================================= */}
      {activeTab === "meetings" && (
        <div className="max-w-xl mx-auto rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-6 shadow-[0_6px_0_#3A2E2B] space-y-4">
          <h4 className="text-sm font-black text-[#3A2E2B]">
            Registro de Reunión / Sync de Equipo
          </h4>
          <p className="text-xs text-[#795548]">
            Registra los acuerdos y minutas para no perder el hilo de las sincronizaciones con colaboradores.
          </p>

          <form onSubmit={handleLogMeeting} className="space-y-3">
            <input
              type="text"
              required
              value={meetingSubject}
              onChange={(e) => setMeetingSubject(e.target.value)}
              placeholder="Asunto de la reunión o sync *"
              className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-2 text-xs font-bold text-[#3A2E2B] outline-none"
            />
            <textarea
              rows={4}
              value={meetingNotes}
              onChange={(e) => setMeetingNotes(e.target.value)}
              placeholder="Minuta, acuerdos alcanzados y próximos pasos..."
              className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] p-3 text-xs font-medium text-[#3A2E2B] outline-none"
            />
            <CozyButton variant="forest" size="md" type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Registrando..." : "Guardar Minuta de Reunión (30 min)"}
            </CozyButton>
          </form>
        </div>
      )}

      {/* =======================================================================
          TAB 4: ENTREGABLES & REGISTRO MANUAL
         ======================================================================= */}
      {activeTab === "deliverables" && (
        <div className="max-w-xl mx-auto rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-6 shadow-[0_6px_0_#3A2E2B] space-y-4">
          <h4 className="text-sm font-black text-[#3A2E2B]">
            Registro Retrospectivo de Jornada de Trabajo
          </h4>
          <p className="text-xs text-[#795548]">
            Si trabajaste fuera de la aplicación, anota el bloque retrospectivo para forjar XP y mantener racha.
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
              Proyecto vinculado:
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
              Entregable alcanzado / Notas:
            </label>
            <input
              type="text"
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder="Ej. Cierre de sprint e informe semanal..."
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
            {isSubmitting ? "Registrando..." : `Guardar Jornada de ${manualDuration} min`}
          </CozyButton>
        </div>
      )}
    </BuildingInteriorShell>
  );
}
