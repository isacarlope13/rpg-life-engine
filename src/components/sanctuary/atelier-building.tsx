"use client";

import React, { useState, useEffect } from "react";
import {
  Scissors,
  Clock,
  Play,
  Pause,
  Square,
  RotateCcw,
  Plus,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  BookOpen,
  Award,
  Layers,
  History,
  Image as ImageIcon,
} from "lucide-react";
import type { KnittingProject, SkillSessionRecord } from "@/types/rpg";
import { useUniversalSession } from "@/lib/sanctuary/use-universal-session";
import { CozyButton, CozyProgress, CozyNotification } from "@/components/cozy/ui";
import { LivingInteriorRoom, type InteriorStationDefinition } from "@/components/sanctuary/living-interior-room";
import { BuildingInteriorShell } from "@/components/sanctuary/building-interior-shell";
import { triggerHaptic } from "@/lib/offline-sync";
import { SmartCaptureWidget } from "@/components/sanctuary/smart-capture-widget";
import { SkillResourceHubPanel } from "@/components/sanctuary/skill-resource-hub-panel";
import { projectAtelierProgression } from "@/lib/sanctuary/visual-village-progression";
import { VillageProgressionPanel } from "@/components/sanctuary/village-progression-panel";
import { ResidentAssistantWidget } from "@/components/sanctuary/resident-assistant-widget";
import { COZY_VILLAGE_RESIDENTS } from "@/lib/sanctuary/village-tiers";

interface AtelierBuildingProps {
  projects: KnittingProject[];
  sessions?: SkillSessionRecord[];
  playerLevel: number;
  skillLevel?: number;
  totalGpEarned?: number;
  isCozyActive?: boolean;
  onRefreshState: () => Promise<void>;
  onSubmitDirectSkillSession: (payload: Record<string, unknown>) => Promise<unknown>;
  onClose?: () => void;
}

export function AtelierBuilding({
  projects = [],
  sessions = [],
  playerLevel,
  skillLevel = 1,
  totalGpEarned = 0,
  isCozyActive = true,
  onRefreshState,
  onSubmitDirectSkillSession,
  onClose,
}: AtelierBuildingProps) {
  const [activeTab, setActiveTab] = useState<"taller" | "patrones" | "materiales" | "proyectos" | "clara" | "evolucion" | "galeria">("taller");

  // Proyecto seleccionado
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    return projects[0]?.id || "";
  });

  // Contador de vueltas de la sesión actual
  const [sessionRows, setSessionRows] = useState<number>(0);
  const [stitchesNotes, setStitchesNotes] = useState<string>("");
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);
  const [showPatternViewer, setShowPatternViewer] = useState(false);
  const [activePatternName, setActivePatternName] = useState<string>("Patrón Gráfico V-Stitch");
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "warning";
    message: string;
  } | null>(null);

  // Formulario de nuevo proyecto
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectTech, setNewProjectTech] = useState<"Crochet" | "Dos Agujas" | "Amigurumi" | "Telar">("Crochet");
  const [newProjectTargetRows, setNewProjectTargetRows] = useState(60);
  const [newProjectYarn, setNewProjectYarn] = useState("");

  // Motor Universal de Sesiones
  const {
    session,
    isRunning,
    isPaused,
    isActive,
    formattedTime,
    elapsedMinutes,
    startSession,
    pauseSession,
    resumeSession,
    resetSession,
    updateSpecializedData,
    finishSession,
    submitting,
  } = useUniversalSession("knitting", "atelier");

  // Sincronizar vueltas registradas al reingresar si la sesión sigue activa en segundo plano
  useEffect(() => {
    const persistedRows = (session?.specializedData as Record<string, unknown>)?.knitting as { rows_completed?: number } | undefined;
    if (typeof persistedRows?.rows_completed === "number" && persistedRows.rows_completed > 0) {
      setSessionRows(persistedRows.rows_completed);
    }
  }, [session?.sessionId]);

  const activeProject = projects.find((p) => p.id === selectedProjectId) || projects[0];
  const totalCompletedRows = projects.reduce((acc, p) => acc + (p.completed_rows || 0), 0);
  const knittingSessions = sessions.filter((s) => s.domain === "knitting");

  // Proyección Visual Determinista del Atelier (Fase 9)
  const progression = projectAtelierProgression({
    level: skillLevel,
    sessionsCount: knittingSessions.length,
    knittingProjects: projects,
  });

  const handleStartSession = () => {
    triggerHaptic("light");
    startSession({
      domain: "knitting",
      buildingId: "atelier",
      resourceId: activeProject?.id,
      resourceTitle: activeProject?.name || "Sesión de Tejido",
      objective: `Avanzar ${sessionRows > 0 ? sessionRows : 5} vueltas en ${activeProject?.name || "proyecto"}`,
      initialNotes: stitchesNotes,
    });
    setNotification({
      type: "success",
      message: "🧶 ¡Sesión de tejido iniciada en el telar del Atelier!",
    });
  };

  const handleIncrementRows = (delta: number) => {
    triggerHaptic("light");
    setSessionRows((prev) => {
      const nextRows = Math.max(0, prev + delta);
      updateSpecializedData({
        knitting: {
          ...((session?.specializedData as Record<string, unknown>)?.knitting as Record<string, unknown> || {}),
          rows_completed: nextRows,
        },
      });
      return nextRows;
    });
  };

  const handleFinishAndSave = async () => {
    triggerHaptic("medium");
    try {
      const result = await finishSession({
        project_id: activeProject?.id,
        rows_completed: sessionRows > 0 ? sessionRows : 1,
        stitches_notes: stitchesNotes,
        photo_evidence_url: uploadedPhotoUrl || undefined,
      });

      if (result) {
        setNotification({
          type: "success",
          message: `✨ ¡Sesión completada con éxito! Has registrado ${sessionRows > 0 ? sessionRows : 1} vueltas en "${activeProject?.name}".`,
        });
        setSessionRows(0);
        setStitchesNotes("");
        setUploadedPhotoUrl(null);
        await onRefreshState();
      }
    } catch (err) {
      console.error("Error al finalizar sesión en Atelier:", err);
      setNotification({
        type: "error",
        message: "Ocurrió un error al guardar la sesión de tejido.",
      });
    }
  };

  const handleCreateNewProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      await onSubmitDirectSkillSession({
        action: "add_knitting_project",
        knitting_name: newProjectName.trim(),
        knitting_technique: newProjectTech,
        knitting_total_rows: Number(newProjectTargetRows) || 50,
        knitting_yarn_details: newProjectYarn.trim() || "Lana / Hilado estándar",
      });

      setNotification({
        type: "success",
        message: `🧵 ¡Proyecto "${newProjectName}" forjado con éxito!`,
      });
      setIsCreatingProject(false);
      setNewProjectName("");
      setNewProjectYarn("");
      await onRefreshState();
    } catch {
      setNotification({
        type: "error",
        message: "No se pudo crear el proyecto.",
      });
    }
  };

  const stations: InteriorStationDefinition[] = [
    {
      id: "taller",
      name: "Mesa de Tejido & Telar",
      shortName: "Telar Activo",
      icon: "🧶",
      badge: isActive ? (isPaused ? "⏸️" : "⏱️") : undefined,
      badgeVariant: isRunning ? "success" : "info",
      hotkey: "1",
      description: "Mesa de trabajo: cronómetro de bastidor, contador táctil gigante de vueltas y notas.",
    },
    {
      id: "patrones",
      name: "Atril de Patrones & Guías",
      shortName: "Patrones",
      icon: "📜",
      hotkey: "2",
      description: "Diagramas gráficos de puntadas, instrucciones de lazada y paso a paso vuelta a vuelta.",
    },
    {
      id: "materiales",
      name: "Cofre de Madejas & Fibras",
      shortName: "Lanas & Insumos",
      icon: "🗄️",
      hotkey: "3",
      description: "Inventario de lanas nobles, calibres (DK, Fingering, Aran), composición y stock.",
    },
    {
      id: "proyectos",
      name: "Muro de Proyectos & Obras",
      shortName: "Proyectos",
      icon: "🧵",
      badge: projects.length,
      hotkey: "4",
      description: "Catálogo de proyectos activos, montaje de nuevos puntos e historial de piezas terminadas.",
    },
    {
      id: "clara",
      name: "Rincón de Clara",
      shortName: "Consejo Artesanal",
      icon: "🐰",
      hotkey: "5",
      description: "Sabiduría artesanal de Clara la Liebre, calibración de tensión y misiones vecinales.",
    },
  ];

  return (
    <LivingInteriorRoom
      buildingId="atelier"
      buildingName="El Atelier de Hilados & Textil"
      domain="knitting"
      districtName="Artes & Oficios"
      icon="🧶"
      tagline="Cestas de lana noble, telares ritmados y paciencia que forja prendas únicas punto a punto."
      resident={COZY_VILLAGE_RESIDENTS.find((r) => r.id === "clara")}
      stations={stations}
      activeStationId={activeTab}
      onSelectStation={(id) => setActiveTab(id as typeof activeTab)}
      onClose={onClose}
      activeSessionBanner={{
        isActive,
        isPaused,
        formattedTime,
        label: activeProject
          ? `Tejiendo "${activeProject.name}" (+${sessionRows} vueltas)`
          : "Sesión de telar activa",
        onViewSession: () => setActiveTab("taller"),
      }}
      metrics={[
        { label: "Nivel de Edificio", value: progression.tierName },
        { label: "Proyectos en Curso", value: projects.length },
        { label: "Vueltas Tejidas", value: totalCompletedRows.toLocaleString("es-CO") },
        { label: "Creaciones Listas", value: progression.creationsExhibition.length },
      ]}
      roomTheme={{
        wallColor: "#5C381E",
        floorPattern: "wood",
        ambientWarmth: "fireplace",
      }}
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
          TAB 1: TELAR & TEJIDO ACTIVO
         ======================================================================= */}
      {activeTab === "taller" && (
        <div className="space-y-4">
          {/* BANNER DE PROGRESIÓN VISUAL DEL ATELIER */}
          <div className="rounded-2xl border-2 border-[#3A2E2B]/20 bg-[#F4EEDC] p-3 flex flex-wrap items-center justify-between gap-2 shadow-[0_2px_0_#3A2E2B]">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">{progression.tier === 3 ? "⭐" : progression.tier === 2 ? "🌿" : "🪵"}</span>
              <div>
                <span className="text-xs font-black text-[#3A2E2B] block">
                  {progression.tierName} ({progression.tierBadge})
                </span>
                <span className="text-[11px] text-[#795548] font-medium">
                  {progression.facadeDescription}
                </span>
              </div>
            </div>
            <CozyButton
              variant="wood"
              size="sm"
              onClick={() => setActiveTab("evolucion")}
            >
              Ver Fachada & Trofeos ➜
            </CozyButton>
          </div>

          {/* ASISTENTE CONTEXTUAL: CLARA LA LIEBRE ARTESANA (FASE 10) */}
          <ResidentAssistantWidget
            context={{
              residentId: "clara",
              buildingId: "atelier",
              domain: "knitting",
              knittingProjects: projects,
              recentSessions: knittingSessions,
            }}
            onPrepareSession={(prepared) => {
              if (prepared.resourceId) {
                setSelectedProjectId(prepared.resourceId);
              }
              if (prepared.metadata?.targetRows) {
                setSessionRows(Number(prepared.metadata.targetRows));
              }
              if (prepared.initialNotes) {
                setStitchesNotes((prev) => (prev ? `${prev} • ${prepared.initialNotes}` : prepared.initialNotes || ""));
              }
            }}
            onApplyProposal={(prop) => {
              if (prop.suggestedPayload?.suggestedRows) {
                setSessionRows(Number(prop.suggestedPayload.suggestedRows));
              }
            }}
          />

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-7 space-y-4">
            <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-6 shadow-[0_6px_0_#3A2E2B] space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-black uppercase text-[#795548] tracking-wider block">
                    Proyecto Activo en Bastidor
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-[#3A2E2B]">
                    {activeProject?.name || "Sin proyecto seleccionado"}
                  </h3>
                  <span className="text-xs text-[#795548] font-bold">
                    Técnica: {activeProject?.technique || "Crochet"} • {activeProject?.yarn_details || "Lana merino"}
                  </span>
                </div>

                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-1.5 text-xs font-bold text-[#3A2E2B] outline-none"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {activeProject && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-[#795548]">
                    <span>
                      Vuelta {activeProject.completed_rows || 0} de {activeProject.total_rows_target || 60}
                    </span>
                    <span>
                      {Math.round(((activeProject.completed_rows || 0) / (activeProject.total_rows_target || 60)) * 100)}%
                    </span>
                  </div>
                  <CozyProgress
                    value={activeProject.completed_rows || 0}
                    max={activeProject.total_rows_target || 60}
                    variant="clay"
                  />
                </div>
              )}

              {/* Visor de Patrón Activo */}
              <div className="rounded-2xl border-2 border-[#D8B48A] bg-[#FFFBF2] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4 text-[#C88973]" />
                    <span className="text-xs font-bold text-[#3A2E2B]">Patrón Activo:</span>
                    <span className="text-xs font-bold text-[#77936A]">
                      {activePatternName}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPatternViewer(!showPatternViewer)}
                    className="text-[11px] font-bold text-[#77936A] hover:underline cursor-pointer"
                  >
                    {showPatternViewer ? "Ocultar Guía ▲" : "Ver Guía de Puntos ▼"}
                  </button>
                </div>

                {showPatternViewer && (
                  <div className="pt-2 border-t border-[#D8B48A]/40 text-xs text-[#3A2E2B] space-y-2 bg-[#FFFDF8] rounded-xl p-3">
                    <p className="font-bold text-[#795548] text-[11px]">
                      Diagrama de Lazada y Repetición:
                    </p>
                    <div className="font-mono bg-[#F4EEDC] p-2.5 rounded-lg border border-[#D8B48A] text-[11px] text-[#3A2E2B] overflow-x-auto">
                      {"[Fila Base]: 1 cad, saltar 2 pts, (1 pb, 3 cad, 1 pb) en el sig pt."}
                      <br />
                      {"[Fila 2]: 3 cad, girar, 3 pa en cada arco de cadeneta hasta el final."}
                      <br />
                      {"[Repetición]: Alternar vueltas 1 y 2 hasta alcanzar la longitud deseada."}
                    </div>
                    <p className="text-[10px] text-[#795548]">
                      💡 Puedes subir el PDF o imagen de tu patrón en la pestaña <strong>Proyectos & Patrones</strong>.
                    </p>
                  </div>
                )}
              </div>

              {/* Cronómetro Universal */}
              <div className="rounded-2xl border-3 border-[#3A2E2B] bg-[#F4EEDC] p-4 text-center space-y-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#795548] block">
                  {isRunning ? "⏱️ Sesión de Tejido en Curso" : isPaused ? "⏸️ Pausado" : "🧶 Bastidor Preparado"}
                </span>

                <div className="font-mono text-4xl sm:text-5xl font-black text-[#3A2E2B] tracking-tight">
                  {formattedTime}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  {!isActive ? (
                    <CozyButton
                      variant="forest"
                      size="md"
                      onClick={handleStartSession}
                      className="flex items-center gap-2"
                    >
                      <Play className="h-4 w-4" />
                      Iniciar Sesión de Tejido
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
                        disabled={submitting}
                        onClick={handleFinishAndSave}
                        className="flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {submitting ? "Guardando..." : "Finalizar & Guardar"}
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

              {/* Contador de Rondas Táctil */}
              <div className="rounded-2xl border-2 border-[#3A2E2B] bg-[#FFFDF8] p-4 text-center space-y-3">
                <span className="text-xs font-bold text-[#795548] block">
                  Vueltas avanzadas en esta sesión:
                </span>
                <div className="font-mono text-3xl font-black text-[#3A2E2B]">
                  +{sessionRows}
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleIncrementRows(-1)}
                    className="h-10 w-12 rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] text-sm font-black text-[#3A2E2B] hover:bg-[#E7D69C] cursor-pointer"
                  >
                    -1
                  </button>
                  <button
                    type="button"
                    onClick={() => handleIncrementRows(1)}
                    className="h-10 w-16 rounded-xl border-2 border-[#3A2E2B] bg-[#314C3C] text-sm font-black text-[#FFFDF8] hover:bg-[#3E5F4C] shadow-[0_2px_0_#1A2B20] cursor-pointer"
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    onClick={() => handleIncrementRows(5)}
                    className="h-10 w-16 rounded-xl border-2 border-[#3A2E2B] bg-[#E7D69C] text-sm font-black text-[#3A2E2B] hover:bg-[#F2E3B3] shadow-[0_2px_0_#3A2E2B] cursor-pointer"
                  >
                    +5
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-5 space-y-4">
            <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] space-y-3">
              <h4 className="text-xs font-black uppercase text-[#3A2E2B] flex items-center gap-1.5">
                <Scissors className="h-4 w-4 text-[#C88973]" />
                Notas de Puntos & Disminuciones
              </h4>

              <textarea
                value={stitchesNotes}
                onChange={(e) => setStitchesNotes(e.target.value)}
                placeholder="Anota el punto actual, número de disminuciones o recordatorio para la próxima vuelta..."
                rows={5}
                className="w-full rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC] p-3 text-xs font-medium text-[#3A2E2B] placeholder:text-[#795548]/60 outline-none"
              />

              <div className="rounded-xl border border-[#3A2E2B]/20 bg-[#F4EEDC] p-3 text-xs text-[#795548] space-y-1">
                <span className="font-bold text-[#3A2E2B] block">💡 Consejo de Clara:</span>
                <p>
                  "Mantén la tensión pareja respirando con cada lazada. Un punto a la vez forja una trama resistente y cálida."
                </p>
              </div>
            </div>

            {/* Smart Capture & Asistente Contextual */}
            <SmartCaptureWidget
              domain="knitting"
              context={{
                domain: "knitting",
                activeKnittingProject: activeProject
                  ? {
                      id: activeProject.id,
                      name: activeProject.name,
                      current_rows: activeProject.completed_rows,
                      total_rows_target: activeProject.total_rows_target,
                      yarn_name: activeProject.yarn_details,
                    }
                  : undefined,
              }}
              notes={stitchesNotes}
              onNotesChange={setStitchesNotes}
              onApplySuggestedValues={(vals) => {
                setSessionRows(vals.quantity);
                if (vals.notes) {
                  setStitchesNotes((prev) => (prev ? `${prev} • ${vals.notes}` : vals.notes || ""));
                }
              }}
              onPhotoUploaded={(dataUrl) => {
                setUploadedPhotoUrl(dataUrl);
              }}
            />
          </div>
        </div>
        </div>
      )}

      {/* =======================================================================
          TAB 2: PROYECTOS & PATRONES
         ======================================================================= */}
      {activeTab === "proyectos" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-black uppercase text-[#3A2E2B]">
              Catálogo de Proyectos Textiles
            </h4>
            <CozyButton
              variant="forest"
              size="sm"
              onClick={() => setIsCreatingProject(!isCreatingProject)}
              className="flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{isCreatingProject ? "Cerrar" : "Nuevo Proyecto"}</span>
            </CozyButton>
          </div>

          {isCreatingProject && (
            <form onSubmit={handleCreateNewProject} className="rounded-3xl border-3 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_4px_0_#3A2E2B] space-y-3">
              <h4 className="text-xs font-black uppercase text-[#3A2E2B]">
                Montar Nuevo Proyecto en el Atelier
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Nombre de la prenda / proyecto *"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-2 text-xs font-bold text-[#3A2E2B] outline-none"
                />
                <select
                  value={newProjectTech}
                  onChange={(e) => setNewProjectTech(e.target.value as typeof newProjectTech)}
                  className="rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-2 text-xs font-bold text-[#3A2E2B] outline-none"
                >
                  <option value="Crochet">Crochet / Ganchillo</option>
                  <option value="Dos Agujas">Dos Agujas / Tricot</option>
                  <option value="Amigurumi">Amigurumi</option>
                  <option value="Telar">Telar de Bastidor</option>
                </select>
                <input
                  type="number"
                  placeholder="Meta de vueltas / filas *"
                  value={newProjectTargetRows}
                  onChange={(e) => setNewProjectTargetRows(Number(e.target.value))}
                  className="rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-2 text-xs font-bold text-[#3A2E2B] outline-none"
                />
                <input
                  type="text"
                  placeholder="Hilado (ej. Lana Merino 100g, 4mm)"
                  value={newProjectYarn}
                  onChange={(e) => setNewProjectYarn(e.target.value)}
                  className="rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-2 text-xs font-bold text-[#3A2E2B] outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <CozyButton variant="wood" size="sm" type="button" onClick={() => setIsCreatingProject(false)}>
                  Cancelar
                </CozyButton>
                <CozyButton variant="forest" size="sm" type="submit">
                  Montar Puntos ➜
                </CozyButton>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((proj) => {
              const isSelected = proj.id === selectedProjectId;
              const percent = Math.round(((proj.completed_rows || 0) / (proj.total_rows_target || 60)) * 100);

              return (
                <div
                  key={proj.id}
                  onClick={() => setSelectedProjectId(proj.id)}
                  className={`rounded-3xl border-3 p-4 shadow-[0_4px_0_#3A2E2B] transition-all cursor-pointer space-y-3 ${
                    isSelected
                      ? "border-[#3A2E2B] bg-[#F4EEDC] ring-2 ring-[#C88973]"
                      : "border-[#3A2E2B] bg-[#FFFDF8] hover:bg-[#F4EEDC]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#E7D69C] text-lg shadow-[0_2px_0_#3A2E2B]">
                      🧶
                    </span>
                    <span className="rounded-full bg-[#C88973]/20 border border-[#C88973] px-2 py-0.5 text-[9px] font-black text-[#8A3722] uppercase">
                      {proj.technique || "Crochet"}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-black text-[#3A2E2B] line-clamp-1">
                      {proj.name}
                    </h4>
                    <span className="text-[10px] text-[#795548] font-bold">
                      {proj.yarn_details || "Lana estándar"}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-[#795548]">
                      <span>{proj.completed_rows || 0} / {proj.total_rows_target || 60} vueltas</span>
                      <span>{percent}%</span>
                    </div>
                    <CozyProgress value={proj.completed_rows || 0} max={proj.total_rows_target || 60} variant="clay" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* BÓVEDA DE RECURSOS & PATRONES ADJUNTOS */}
          <div className="pt-4 border-t-2 border-[#D8B48A]/40">
            <SkillResourceHubPanel domain="knitting" />
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 3: LANAS & MATERIALES
         ======================================================================= */}
      {activeTab === "materiales" && (
        <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] space-y-3">
          <h4 className="text-xs font-black uppercase text-[#3A2E2B]">
            Inventario de Fibras & Herramientas del Atelier
          </h4>
          <p className="text-xs text-[#795548]">
            Lanas orgánicas, agujas de bambú y madejas guardadas con esmero en cestas de mimbre.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {[
              { name: "Lana Merino Nórdica", fiber: "100% Merino", weight: "DK 100g", icon: "🐑" },
              { name: "Alpaca Suave Andina", fiber: "Alpaca & Seda", weight: "Fingering 50g", icon: "🦙" },
              { name: "Algodón Rústico Botánico", fiber: "Algodón Reciclado", weight: "Aran 100g", icon: "🌱" },
            ].map((mat, i) => (
              <div key={i} className="rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC] p-4 space-y-1 text-center">
                <span className="text-3xl block">{mat.icon}</span>
                <span className="text-xs font-black text-[#3A2E2B] block">{mat.name}</span>
                <span className="text-[10px] text-[#795548] block">{mat.fiber} • {mat.weight}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 4: GALERÍA & HISTORIAL
         ======================================================================= */}
      {activeTab === "galeria" && (
        <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] space-y-3">
          <h4 className="text-xs font-black uppercase text-[#3A2E2B]">
            Historial de Sesiones en el Atelier
          </h4>

          {knittingSessions.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#795548]">
              Aún no has registrado sesiones de tejido. ¡Inicia un bloque en el telar!
            </div>
          ) : (
            <div className="divide-y divide-[#3A2E2B]/15">
              {knittingSessions.map((ses) => (
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

      {/* =======================================================================
          ESTACIÓN 2: ATRIL DE PATRONES & GUÍAS DE PUNTADAS
         ======================================================================= */}
      {activeTab === "patrones" && (
        <div className="space-y-4">
          <div className="rounded-3xl border-3 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_4px_0_#3A2E2B] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-black uppercase text-[#795548]">
                  Atril de Trabajo
                </span>
                <h4 className="text-sm font-black text-[#3A2E2B]">
                  Guía Visual de Lazadas & Puntos
                </h4>
              </div>

              {/* Selector de patrón interactivo */}
              <select
                value={activePatternName}
                onChange={(e) => setActivePatternName(e.target.value)}
                className="rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-1.5 text-xs font-bold text-[#3A2E2B] outline-none"
              >
                <option value="Patrón Gráfico V-Stitch">V-Stitch Textil (Calado)</option>
                <option value="Granny Square Clásico">Granny Square de 4 Vueltas</option>
                <option value="Punto Bobo / Santa Clara">Punto Bobo en Dos Agujas</option>
                <option value="Espiral Amigurumi">Espiral Continua de Punto Bajo</option>
              </select>
            </div>

            {/* Diagrama Visual SVG de Puntadas */}
            <div className="rounded-2xl border-2 border-[#D8B48A] bg-[#FFFBF2] p-4 text-center space-y-3">
              <span className="text-[10px] font-black text-[#795548] uppercase block">
                Diagrama de Repetición Gráfica (Patrón de Bastidor)
              </span>

              <div className="flex items-center justify-center p-3 bg-[#F4EEDC] rounded-xl border border-[#D8B48A]">
                <svg width="280" height="90" viewBox="0 0 280 90" className="overflow-visible">
                  {/* Fila 1: Puntos base */}
                  <g stroke="#8C6239" strokeWidth="2" strokeLinecap="round">
                    <line x1="20" y1="70" x2="260" y2="70" strokeDasharray="6,4" />
                    {[30, 60, 90, 120, 150, 180, 210, 240].map((cx, i) => (
                      <circle key={i} cx={cx} cy="70" r="3" fill="#D8B48A" />
                    ))}
                  </g>
                  {/* Fila 2: Lazadas en V */}
                  <g stroke="#314C3C" strokeWidth="2.5" strokeLinecap="round" fill="none">
                    <path d="M 30 70 L 45 35 L 60 70" />
                    <path d="M 90 70 L 105 35 L 120 70" />
                    <path d="M 150 70 L 165 35 L 180 70" />
                    <path d="M 210 70 L 225 35 L 240 70" />
                  </g>
                  {/* Fila 3: Cadenetas superiores */}
                  <g stroke="#C88973" strokeWidth="2" fill="none">
                    <path d="M 45 35 Q 75 20, 105 35" strokeDasharray="4,3" />
                    <path d="M 105 35 Q 135 20, 165 35" strokeDasharray="4,3" />
                    <path d="M 165 35 Q 195 20, 225 35" strokeDasharray="4,3" />
                  </g>
                  {/* Destacado de vuelta activa */}
                  <text x="140" y="15" textAnchor="middle" fill="#314C3C" fontSize="10" fontWeight="900">
                    ▲ Vuelta de Repetición Activa ▲
                  </text>
                </svg>
              </div>

              <div className="font-mono bg-[#FFFDF8] p-3 rounded-xl border border-[#D8B48A] text-left text-xs text-[#3A2E2B] space-y-1">
                <p className="font-bold text-[#795548] text-[11px]">Instrucción vuelta a vuelta:</p>
                <p>• <strong>Vuelta 1:</strong> Montar número par de cadenetas + 2 de subida.</p>
                <p>• <strong>Vuelta 2 (V-Stitch):</strong> Saltar 1 pt, tejer (1 pa, 1 cad, 1 pa) en el mismo espacio.</p>
                <p>• <strong>Vuelta 3+:</strong> Repetir el motivo dentro de cada arco de cadeneta de la vuelta previa.</p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#D8B48A]/40">
                <span className="text-xs font-bold text-[#795548]">
                  ¿Completaste una vuelta de este patrón?
                </span>
                <CozyButton
                  variant="forest"
                  size="sm"
                  onClick={() => {
                    handleIncrementRows(1);
                    setNotification({
                      type: "success",
                      message: `¡Vuelta registrada en el patrón "${activePatternName}"!`,
                    });
                  }}
                  className="flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Anotar +1 Vuelta al Proyecto Activo</span>
                </CozyButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          ESTACIÓN 5: RINCÓN DE CLARA LA ARTESANA
         ======================================================================= */}
      {activeTab === "clara" && (
        <div className="space-y-4">
          <ResidentAssistantWidget
            context={{
              residentId: "clara",
              buildingId: "atelier",
              domain: "knitting",
              knittingProjects: projects,
              recentSessions: knittingSessions,
            }}
            onPrepareSession={(prepared) => {
              if (prepared.resourceId) {
                setSelectedProjectId(prepared.resourceId);
              }
              if (prepared.metadata?.targetRows) {
                setSessionRows(Number(prepared.metadata.targetRows));
              }
              if (prepared.initialNotes) {
                setStitchesNotes((prev) => (prev ? `${prev} • ${prepared.initialNotes}` : prepared.initialNotes || ""));
              }
              setActiveTab("taller");
            }}
            onApplyProposal={(prop) => {
              if (prop.suggestedPayload?.suggestedRows) {
                setSessionRows(Number(prop.suggestedPayload.suggestedRows));
              }
              setActiveTab("taller");
            }}
          />
        </div>
      )}

      {/* =======================================================================
          TAB 5: EVOLUCIÓN VISUAL & EXPOSICIÓN DE CREACIONES (FASE 9)
         ======================================================================= */}
      {activeTab === "evolucion" && (
        <VillageProgressionPanel
          progression={progression}
          buildingName="El Atelier de Hilados & Textil"
        />
      )}
    </LivingInteriorRoom>
  );
}
