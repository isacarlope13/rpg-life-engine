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
import { LivingInteriorRoom, type InteriorStationDefinition } from "@/components/sanctuary/living-interior-room";
import { BuildingInteriorShell } from "@/components/sanctuary/building-interior-shell";
import { triggerHaptic } from "@/lib/offline-sync";
import { SmartCaptureWidget } from "@/components/sanctuary/smart-capture-widget";
import { SkillResourceHubPanel } from "@/components/sanctuary/skill-resource-hub-panel";
import { projectOficinaProgression } from "@/lib/sanctuary/visual-village-progression";
import { VillageProgressionPanel } from "@/components/sanctuary/village-progression-panel";
import { ResidentAssistantWidget } from "@/components/sanctuary/resident-assistant-widget";
import { COZY_VILLAGE_RESIDENTS } from "@/lib/sanctuary/village-tiers";

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

  const [activeTab, setActiveTab] = useState<"timer" | "projects" | "deliverables" | "metrics" | "aura" | "meetings" | "evolucion">("timer");
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

  // Proyección Visual Determinista de la Oficina (Fase 9)
  const progression = projectOficinaProgression({
    level: skillLevel,
    sessionsCount: 3,
    workProjectsCompletedCount: DEFAULT_PROJECTS.filter((p) => p.progressPercent >= 100).length,
    workDeliverablesCount: DEFAULT_PROJECTS.filter((p) => p.completedTasks > 0).length,
  });

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

  const stations: InteriorStationDefinition[] = [
    {
      id: "timer",
      name: "Escritorio de Foco & Pomodoro",
      shortName: "Sprint Foco",
      icon: "💻",
      badge: isActive ? (isPaused ? "⏸️" : "⏱️") : undefined,
      badgeVariant: isRunning ? "success" : "info",
      hotkey: "1",
      description: "Terminal de concentración: cronómetro Pomodoro (25/45/60 min), notas y entregables.",
    },
    {
      id: "projects",
      name: "Tablero Kanban de Proyectos",
      shortName: "Proyectos",
      icon: "📊",
      badge: DEFAULT_PROJECTS.length,
      hotkey: "2",
      description: "Backlog ágil: proyectos estratégicos vs tareas operativas y barras de avance.",
    },
    {
      id: "deliverables",
      name: "Archivador de Entregables & Minutas",
      shortName: "Entregables",
      icon: "📁",
      hotkey: "3",
      description: "Registro formal de entregas, minutas de sincronización y bitácoras de avance.",
    },
    {
      id: "metrics",
      name: "Monitor de Productividad & Foco",
      shortName: "Productividad",
      icon: "📈",
      hotkey: "4",
      description: "Horas de foco semanal, consistencia y panel informativo de relación con ingresos.",
    },
    {
      id: "aura",
      name: "Rincón de Aura la Ágil",
      shortName: "Estrategia",
      icon: "🦊",
      hotkey: "5",
      description: "Priorización ágil de Eisenhower, mitigación de fatiga mental y foco sin sobrecarga.",
    },
  ];

  return (
    <LivingInteriorRoom
      buildingId="oficina"
      buildingName="Torre de Gestión & Oficina"
      domain="work"
      districtName="Plaza & Gestión"
      icon="💼"
      tagline="Centro de mando ágil: sprints Pomodoro, backlog de proyectos, reuniones y entregables de alto impacto."
      resident={COZY_VILLAGE_RESIDENTS.find((r) => r.id === "aura")}
      stations={stations}
      activeStationId={activeTab}
      onSelectStation={(id) => setActiveTab(id as typeof activeTab)}
      onClose={onClose}
      activeSessionBanner={{
        isActive,
        isPaused,
        formattedTime,
        label: activeProject
          ? `Sprint activo en "${activeProject.name}"`
          : "Sesión de oficina activa",
        onViewSession: () => setActiveTab("timer"),
      }}
      metrics={[
        { label: "Nivel de Edificio", value: progression.tierName },
        { label: "Proyectos Activos", value: DEFAULT_PROJECTS.length },
        { label: "Entregables", value: `${progression.creationsExhibition.length} concluidos` },
      ]}
      roomTheme={{
        wallColor: "#2A364F",
        floorPattern: "wood",
        ambientWarmth: "sunny",
      }}
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
        <div className="space-y-4">
          {/* ASISTENTE CONTEXTUAL: MARCUS EL FACILITADOR ÁGIL (FASE 10) */}
          <ResidentAssistantWidget
            context={{
              residentId: "marcus_lead",
              buildingId: "oficina",
              domain: "work",
              workProjects: DEFAULT_PROJECTS.map((p) => ({
                id: p.id,
                name: p.name,
                progressPercent: p.progressPercent,
                pendingTasks: [p.deliverable || "Sprint de trabajo enfocado"],
              })),
            }}
            onPrepareSession={(prepared) => {
              if (prepared.objective) {
                setSessionNotes((prev) => (prev ? `${prev} • ${prepared.objective}` : prepared.objective));
              }
            }}
          />

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

            {/* Smart Capture para Trabajo */}
            <SmartCaptureWidget
              domain="work"
              context={{
                domain: "work",
                activeWorkProject: {
                  id: activeProject.id,
                  name: activeProject.name,
                  currentStage: "Sprint Activo",
                  nextPendingTask: activeProject.deliverable || "Revisión de entregables",
                },
              }}
              notes={sessionNotes}
              onNotesChange={setSessionNotes}
              onApplySuggestedValues={(vals) => {
                if (vals.notes) {
                  setSessionNotes((prev) => (prev ? `${prev} • ${vals.notes}` : vals.notes || ""));
                }
              }}
            />
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

          {/* BÓVEDA DE RECURSOS, ESPECIFICACIONES & REPOSITORIOS */}
          <div className="sm:col-span-3 pt-4 border-t-2 border-[#D8B48A]/40">
            <SkillResourceHubPanel domain="work" />
          </div>
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

      {/* =======================================================================
          ESTACIÓN 4: MONITOR DE PRODUCTIVIDAD & RELACIÓN INFORMATIVA CON INGRESOS
         ======================================================================= */}
      {activeTab === "metrics" && (
        <div className="space-y-4">
          <div className="rounded-3xl border-3 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_4px_0_#3A2E2B] space-y-4">
            <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/10 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-[#795548]">
                  Métricas de Desempeño
                </span>
                <h4 className="text-sm font-black text-[#3A2E2B]">
                  Foco Estratégico & Consistencia Profesional
                </h4>
              </div>
              <span className="text-xs font-black text-[#314C3C] bg-[#C4DC9C] px-3 py-1 rounded-xl border border-[#314C3C]">
                Nivel {skillLevel} de Gestión
              </span>
            </div>

            {/* Cuadrícula de KPIs de foco */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC] p-4 text-center space-y-1">
                <span className="text-[10px] font-bold text-[#795548] uppercase block">
                  Horas de Foco Estimadas
                </span>
                <span className="text-xl font-black text-[#3A2E2B] font-mono">
                  8.5 hrs
                </span>
                <span className="text-[10px] text-[#314C3C] font-bold block">
                  ↗ +1.5h vs semana previa
                </span>
              </div>

              <div className="rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC] p-4 text-center space-y-1">
                <span className="text-[10px] font-bold text-[#795548] uppercase block">
                  Sprints Pomodoro
                </span>
                <span className="text-xl font-black text-[#3A2E2B] font-mono">
                  17 bloques
                </span>
                <span className="text-[10px] text-[#795548] font-bold block">
                  Promedio de 25 min/bloque
                </span>
              </div>

              <div className="rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC] p-4 text-center space-y-1">
                <span className="text-[10px] font-bold text-[#795548] uppercase block">
                  GP Forjados en Oficina
                </span>
                <span className="text-xl font-black text-[#314C3C] font-mono">
                  +{totalGpEarned.toLocaleString("es-CO")} GP
                </span>
                <span className="text-[10px] text-[#795548] font-bold block">
                  Recompensas por disciplina
                </span>
              </div>
            </div>

            {/* BANNER ÉTICO DE OAKHAVEN: RELACIÓN INFORMATIVA CON INGRESOS */}
            <div className="rounded-2xl border-2 border-[#D4AF37] bg-[#FFF8E7] p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚖️</span>
                <h5 className="text-xs font-black text-[#5C4033] uppercase tracking-wide">
                  Relación Informativa con Ingresos Reales
                </h5>
              </div>
              <p className="text-xs text-[#5C4033] leading-relaxed">
                El trabajo en tus proyectos estratégicos incrementa tu capital profesional, habilidad y enfoque.
              </p>
              <div className="rounded-xl border border-[#D4AF37]/50 bg-[#FFFDF8] p-3 text-xs text-[#795548] space-y-1">
                <span className="font-black text-[#3A2E2B] block">
                  🛡️ Invariante Ética de RPG Life-Engine:
                </span>
                <p>
                  Las sesiones de trabajo asalariadas forjan <strong>XP y GP del juego</strong> para el desarrollo de tu personaje, pero <strong>NO crean dinero fiat ni generan depósitos mágicos en tus cuentas en COP</strong>. Los ingresos de tu economía real se administran y auditan exclusivamente mediante transacciones reales verificadas en el <strong>Banco de OakHaven</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          ESTACIÓN 5: RINCÓN DE AURA LA ÁGIL
         ======================================================================= */}
      {activeTab === "aura" && (
        <div className="space-y-4">
          <ResidentAssistantWidget
            context={{
              residentId: "marcus_lead",
              buildingId: "oficina",
              domain: "work",
              workProjects: DEFAULT_PROJECTS.map((p) => ({
                id: p.id,
                name: p.name,
                progressPercent: p.progressPercent,
                pendingTasks: [p.deliverable || "Sprint de trabajo enfocado"],
              })),
            }}
            onPrepareSession={(prepared) => {
              if (prepared.objective) {
                setSessionNotes((prev) => (prev ? `${prev} • ${prepared.objective}` : prepared.objective));
              }
              setActiveTab("timer");
            }}
          />
        </div>
      )}

      {/* =======================================================================
          TAB 5: EVOLUCIÓN VISUAL & HITOS ESTRATÉGICOS (FASE 9)
         ======================================================================= */}
      {activeTab === "evolucion" && (
        <VillageProgressionPanel
          progression={progression}
          buildingName="Torre de Gestión & Oficina"
        />
      )}
    </LivingInteriorRoom>
  );
}
