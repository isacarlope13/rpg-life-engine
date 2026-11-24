"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Scissors,
  Play,
  Pause,
  Plus,
  CheckCircle2,
  BookOpen,
  Undo2,
  Upload,
  Trash2,
  ExternalLink,
  Image as ImageIcon,
  Sparkles,
  X,
} from "lucide-react";
import type {
  KnittingProject,
  KnittingProjectStatus,
  LinkedFiletPatternSnapshot,
  SkillSessionRecord,
} from "@/types/rpg";
import { useUniversalSession } from "@/lib/sanctuary/use-universal-session";
import { useSessionIdentity } from "@/lib/sanctuary/session-identity";
import {
  readAtelierPatternsSafe,
  saveAtelierPatternSafe,
  getDefaultAtelierPattern,
  type AtelierProjectPattern,
  type AtelierPatternImage,
} from "@/lib/sanctuary/atelier-patterns-store";
import { CozyButton, CozyProgress, CozyNotification } from "@/components/cozy/ui";
import { LivingInteriorRoom, type InteriorStationDefinition } from "@/components/sanctuary/living-interior-room";
import { triggerHaptic } from "@/lib/offline-sync";
import { SmartCaptureWidget } from "@/components/sanctuary/smart-capture-widget";
import { SkillResourceHubPanel } from "@/components/sanctuary/skill-resource-hub-panel";
import { projectAtelierProgression } from "@/lib/sanctuary/visual-village-progression";
import { VillageProgressionPanel } from "@/components/sanctuary/village-progression-panel";
import { ResidentAssistantWidget } from "@/components/sanctuary/resident-assistant-widget";
import { COZY_VILLAGE_RESIDENTS } from "@/lib/sanctuary/village-tiers";
import { FiletCrochetStudio } from "@/components/sanctuary/filet-crochet-studio";

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

const STATUS_META: Record<
  KnittingProjectStatus,
  { label: string; badgeClass: string; icon: string }
> = {
  in_progress: {
    label: "En curso",
    badgeClass: "bg-[#314C3C]/15 border-[#314C3C] text-[#314C3C]",
    icon: "🧶",
  },
  paused: {
    label: "Pausado sin culpa",
    badgeClass: "bg-[#E7D69C]/40 border-[#8C6239] text-[#5C381E]",
    icon: "☕",
  },
  completed: {
    label: "Terminado",
    badgeClass: "bg-[#C88973]/20 border-[#C88973] text-[#8A3722]",
    icon: "✨",
  },
  archived: {
    label: "Archivado",
    badgeClass: "bg-[#3A2E2B]/10 border-[#3A2E2B]/40 text-[#795548]",
    icon: "📦",
  },
};

async function compressImageFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.onload = () => {
      const rawUrl = typeof reader.result === "string" ? reader.result : "";
      if (!rawUrl.startsWith("data:image/")) {
        reject(new Error("El archivo debe ser una imagen válida."));
        return;
      }
      const img = new window.Image();
      img.onerror = () => resolve(rawUrl);
      img.onload = () => {
        const maxSide = 1200;
        const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
        const width = Math.max(1, Math.round((img.width || 1) * scale));
        const height = Math.max(1, Math.round((img.height || 1) * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(rawUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/jpeg", 0.78);
        resolve(compressed.length < rawUrl.length ? compressed : rawUrl);
      };
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
  });
}

export function AtelierBuilding({
  projects = [],
  sessions = [],
  skillLevel = 1,
  onRefreshState,
  onSubmitDirectSkillSession,
  onClose,
}: AtelierBuildingProps) {
  const sessionOwner = useSessionIdentity();
  const [activeTab, setActiveTab] = useState<
    "taller" | "proyectos" | "patrones" | "filet" | "galeria" | "clara"
  >("taller");
  const [filetInitialMode, setFiletInitialMode] = useState<
    "alphabet" | "composer" | "backups" | "digitizer" | "guided"
  >("alphabet");

  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    const firstActive = projects.find((p) => p.status === "in_progress") || projects[0];
    return firstActive?.id || "";
  });

  // Contador de vueltas (requiere cronómetro activo por decisión del usuario)
  const [sessionRows, setSessionRows] = useState<number>(0);
  const [rowUndoStack, setRowUndoStack] = useState<number[]>([]);
  const [stitchesNotes, setStitchesNotes] = useState<string>("");
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);
  const [showPatternViewer, setShowPatternViewer] = useState<boolean>(true);
  const [lightboxImage, setLightboxImage] = useState<AtelierPatternImage | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | KnittingProjectStatus>("all");
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const [notification, setNotification] = useState<{
    type: "success" | "error" | "warning";
    message: string;
  } | null>(null);

  // Formulario de nuevo proyecto
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectTech, setNewProjectTech] = useState<
    "Crochet" | "Dos Agujas" | "Amigurumi" | "Telar"
  >("Crochet");
  const [newProjectTargetRows, setNewProjectTargetRows] = useState(60);
  const [newProjectYarn, setNewProjectYarn] = useState("");

  // Patrones persistidos por usuario y proyecto
  const [patternsByProject, setPatternsByProject] = useState<Record<string, AtelierProjectPattern>>(
    {}
  );
  const [patternTitleDraft, setPatternTitleDraft] = useState("");
  const [patternStepsDraft, setPatternStepsDraft] = useState("");
  const [patternNotesDraft, setPatternNotesDraft] = useState("");
  const [patternUrlDraft, setPatternUrlDraft] = useState("");
  const [patternImagesDraft, setPatternImagesDraft] = useState<AtelierPatternImage[]>([]);
  const [uploadingPatternImg, setUploadingPatternImg] = useState(false);

  // Motor Universal de Sesiones
  const {
    session,
    isRunning,
    isPaused,
    isActive,
    formattedTime,
    startSession,
    pauseSession,
    resumeSession,
    resetSession,
    updateSpecializedData,
    finishSession,
    submitting,
    submissionError,
  } = useUniversalSession("knitting", "atelier");

  const activeProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || projects[0],
    [projects, selectedProjectId]
  );

  // Mantener selección válida si cambia la lista de proyectos
  useEffect(() => {
    if (!selectedProjectId && projects[0]?.id) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // Cargar patrones del propietario actual
  useEffect(() => {
    setPatternsByProject(readAtelierPatternsSafe(sessionOwner));
  }, [sessionOwner]);

  // Sincronizar editor de patrón al cambiar de proyecto activo
  const activePattern = useMemo<AtelierProjectPattern>(() => {
    if (!activeProject) return getDefaultAtelierPattern("default", "Proyecto");
    return (
      patternsByProject[activeProject.id] ||
      getDefaultAtelierPattern(activeProject.id, activeProject.name)
    );
  }, [activeProject, patternsByProject]);

  useEffect(() => {
    setPatternTitleDraft(activePattern.title);
    setPatternStepsDraft(activePattern.steps.join("\n"));
    setPatternNotesDraft(activePattern.notes);
    setPatternUrlDraft(activePattern.externalUrl || "");
    setPatternImagesDraft(activePattern.images);
  }, [activePattern]);

  // Sincronizar vueltas registradas al reingresar si la sesión sigue activa en segundo plano
  useEffect(() => {
    const persistedRows = (session?.specializedData as Record<string, unknown>)?.knitting as
      | { rows_completed?: number }
      | undefined;
    if (typeof persistedRows?.rows_completed === "number" && persistedRows.rows_completed > 0) {
      setSessionRows(persistedRows.rows_completed);
    }
  }, [session?.sessionId]);

  const totalCompletedRows = projects.reduce((acc, p) => acc + (p.completed_rows || 0), 0);
  const knittingSessions = sessions.filter((s) => s.domain === "knitting");
  const currentWorkingRow = (activeProject?.completed_rows || 0) + sessionRows + 1;

  const filteredProjects = useMemo(() => {
    if (statusFilter === "all") return projects;
    return projects.filter((p) => p.status === statusFilter);
  }, [projects, statusFilter]);

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
      objective: `Avanzar vueltas en ${activeProject?.name || "proyecto"}`,
      initialNotes: stitchesNotes,
    });
    setNotification({
      type: "success",
      message: "🧶 Cronómetro iniciado. ¡Ya puedes registrar tus vueltas!",
    });
  };

  const [savingQuickRows, setSavingQuickRows] = useState(false);

  const rowDraftKey =
    sessionOwner && activeProject?.id
      ? `oakhaven_atelier_row_draft_v1_${encodeURIComponent(sessionOwner)}_${activeProject.id}`
      : null;

  // Recuperar borrador local de vueltas si no hay sesión con cronómetro activa
  useEffect(() => {
    if (!rowDraftKey || isActive) return;
    try {
      const raw = window.localStorage.getItem(rowDraftKey);
      const parsed = raw ? Number(raw) : 0;
      if (Number.isSafeInteger(parsed) && parsed > 0) {
        setSessionRows(parsed);
      }
    } catch {
      // Silencioso en entornos sin localStorage
    }
  }, [rowDraftKey, isActive]);

  const persistRowDraft = (rows: number) => {
    if (!rowDraftKey) return;
    try {
      if (rows > 0) {
        window.localStorage.setItem(rowDraftKey, String(rows));
      } else {
        window.localStorage.removeItem(rowDraftKey);
      }
    } catch {
      // Ignorar errores de cuota local
    }
  };

  const applyRowChange = (nextRows: number, pushUndo = true) => {
    setSessionRows((prev) => {
      if (pushUndo && prev !== nextRows) {
        setRowUndoStack((stack) => [...stack.slice(-9), prev]);
      }
      persistRowDraft(nextRows);
      if (isActive) {
        updateSpecializedData({
          knitting: {
            ...(((session?.specializedData as Record<string, unknown>)?.knitting as Record<
              string,
              unknown
            >) || {}),
            rows_completed: nextRows,
          },
        });
      }
      return nextRows;
    });
  };

  const handleIncrementRows = (delta: number) => {
    triggerHaptic("light");
    const nextRows = Math.max(0, sessionRows + delta);
    applyRowChange(nextRows, true);
  };

  const handleUndoRow = () => {
    if (rowUndoStack.length === 0) return;
    triggerHaptic("light");
    const previous = rowUndoStack[rowUndoStack.length - 1];
    setRowUndoStack((stack) => stack.slice(0, -1));
    applyRowChange(previous, false);
  };

  const handleSaveQuickRowsWithoutTimer = async () => {
    if (sessionRows <= 0 || savingQuickRows) return;
    // Bloque 7: proteger proyectos guiados Filet contra desincronización por contadores manuales
    if (activeProject?.linked_filet_pattern) {
      setNotification({
        type: "warning",
        message:
          "Este proyecto está vinculado a un patrón Filet guiado. Confirma tus vueltas en Filet Studio → 5. Mesa de Tejido Guiada para conservar la trazabilidad exacta.",
      });
      return;
    }
    setSavingQuickRows(true);
    triggerHaptic("medium");
    try {
      const rowsToSave = sessionRows;
      const opKey = `atelier-rows-${activeProject?.id || "general"}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      await onSubmitDirectSkillSession({
        domain: "knitting",
        title: activeProject ? `Avance en ${activeProject.name}` : "Avance de Crochet",
        duration_minutes: Math.max(1, Math.min(30, rowsToSave)),
        project_id: activeProject?.id,
        rows_completed: rowsToSave,
        stitches_notes: stitchesNotes.trim() || `Registro rápido de +${rowsToSave} vueltas`,
        idempotency_key: opKey,
      });
      setSessionRows(0);
      setRowUndoStack([]);
      persistRowDraft(0);
      setStitchesNotes("");
      setNotification({
        type: "success",
        message: `✨ ¡+${rowsToSave} vuelta${rowsToSave === 1 ? "" : "s"} guardada${
          rowsToSave === 1 ? "" : "s"
        } en "${activeProject?.name || "tu proyecto"}" sin necesidad de cronómetro!`,
      });
      await onRefreshState();
    } catch {
      setNotification({
        type: "error",
        message: "No se pudieron guardar las vueltas ahora. Tu conteo local sigue a salvo.",
      });
    } finally {
      setSavingQuickRows(false);
    }
  };

  const handleFinishAndSave = async () => {
    triggerHaptic("medium");
    try {
      const result = await finishSession({
        project_id: activeProject?.id,
        rows_completed: sessionRows,
        stitches_notes: stitchesNotes,
        photo_evidence_url: uploadedPhotoUrl || undefined,
      });

      if (result) {
        setNotification({
          type: "success",
          message: `✨ ¡Sesión guardada! Registraste ${sessionRows} vuelta${
            sessionRows === 1 ? "" : "s"
          } en "${activeProject?.name || "tu proyecto"}".`,
        });
        setSessionRows(0);
        setRowUndoStack([]);
        persistRowDraft(0);
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
        title: newProjectName.trim(),
        knitting_name: newProjectName.trim(),
        knitting_technique: newProjectTech,
        knitting_total_rows: Number(newProjectTargetRows) || 50,
        yarn_details: newProjectYarn.trim() || "Lana / Hilado estándar",
        knitting_yarn_details: newProjectYarn.trim() || "Lana / Hilado estándar",
      });

      setNotification({
        type: "success",
        message: `🧵 ¡Proyecto "${newProjectName.trim()}" montado en tu Atelier!`,
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

  const handleChangeProjectStatus = async (
    project: KnittingProject,
    nextStatus: KnittingProjectStatus
  ) => {
    if (project.status === nextStatus) return;
    setUpdatingStatusId(project.id);
    try {
      await onSubmitDirectSkillSession({
        action: "update_knitting_project_status",
        project_id: project.id,
        knitting_status: nextStatus,
      });
      setNotification({
        type: "success",
        message: `${STATUS_META[nextStatus].icon} "${project.name}" pasó a estado: ${STATUS_META[nextStatus].label}.`,
      });
      await onRefreshState();
    } catch {
      setNotification({
        type: "error",
        message: "No se pudo actualizar el estado del proyecto.",
      });
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handlePatternImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploadingPatternImg(true);
    try {
      const nextImages: AtelierPatternImage[] = [...patternImagesDraft];
      for (const file of files) {
        if (nextImages.length >= 6) break;
        const dataUrl = await compressImageFileToDataUrl(file);
        nextImages.push({
          id: `pat-img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          dataUrl,
          addedAt: new Date().toISOString(),
        });
      }
      setPatternImagesDraft(nextImages);
      if (activeProject) {
        const res = saveAtelierPatternSafe(sessionOwner, {
          projectId: activeProject.id,
          title: patternTitleDraft,
          steps: patternStepsDraft.split("\n"),
          notes: patternNotesDraft,
          externalUrl: patternUrlDraft,
          images: nextImages,
          updatedAt: new Date().toISOString(),
        });
        if (res.ok) {
          setPatternsByProject(res.patterns);
          setNotification({
            type: "success",
            message: "🖼️ Imagen de patrón guardada en tu Atelier.",
          });
        } else {
          setNotification({ type: "error", message: res.error || "No se pudo guardar la imagen." });
        }
      }
    } catch (err) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Error al cargar la imagen.",
      });
    } finally {
      setUploadingPatternImg(false);
      e.target.value = "";
    }
  };

  const handleSavePattern = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeProject) return;
    const res = saveAtelierPatternSafe(sessionOwner, {
      projectId: activeProject.id,
      title: patternTitleDraft,
      steps: patternStepsDraft.split("\n"),
      notes: patternNotesDraft,
      externalUrl: patternUrlDraft,
      images: patternImagesDraft,
      updatedAt: new Date().toISOString(),
    });
    if (res.ok) {
      setPatternsByProject(res.patterns);
      setNotification({
        type: "success",
        message: `📜 Patrón guardado para "${activeProject.name}".`,
      });
    } else {
      setNotification({
        type: "error",
        message: res.error || "No se pudo guardar el patrón.",
      });
    }
  };

  const handleRemovePatternImage = (imageId: string) => {
    const remaining = patternImagesDraft.filter((img) => img.id !== imageId);
    setPatternImagesDraft(remaining);
    if (activeProject) {
      const res = saveAtelierPatternSafe(sessionOwner, {
        projectId: activeProject.id,
        title: patternTitleDraft,
        steps: patternStepsDraft.split("\n"),
        notes: patternNotesDraft,
        externalUrl: patternUrlDraft,
        images: remaining,
        updatedAt: new Date().toISOString(),
      });
      if (res.ok) setPatternsByProject(res.patterns);
    }
  };

  const stations: InteriorStationDefinition[] = [
    {
      id: "taller",
      name: "Mesa de Tejido",
      shortName: "Mesa Activa",
      icon: "🧶",
      badge: isActive ? (isPaused ? "⏸️" : "⏱️") : undefined,
      badgeVariant: isRunning ? "success" : "info",
      hotkey: "1",
      description: "Cronómetro de sesión, contador táctil grande de vueltas y visor de patrón acoplado.",
    },
    {
      id: "proyectos",
      name: "Estantería de Proyectos",
      shortName: "Proyectos",
      icon: "🧵",
      badge: projects.length,
      hotkey: "2",
      description: "Proyectos en curso, pausados sin culpa, terminados y archivados.",
    },
    {
      id: "patrones",
      name: "Carpeta de Patrones",
      shortName: "Patrones",
      icon: "📜",
      badge: activePattern.images.length > 0 ? activePattern.images.length : undefined,
      hotkey: "3",
      description: "Instrucciones vuelta a vuelta, notas personales y subida directa de imágenes.",
    },
    {
      id: "filet",
      name: "Filet Crochet Studio",
      shortName: "Filet Studio",
      icon: "▦",
      hotkey: "4",
      description: "Editor de cuadrícula binaria, colecciones de alfabetos y matrices filet.",
    },
    {
      id: "galeria",
      name: "Vitrina & Historial",
      shortName: "Vitrina",
      icon: "🏆",
      badge: knittingSessions.length > 0 ? knittingSessions.length : undefined,
      hotkey: "5",
      description: "Piezas terminadas, evolución del Atelier e historial real de sesiones.",
    },
    {
      id: "clara",
      name: "Rincón de Clara",
      shortName: "Clara",
      icon: "🐇",
      hotkey: "6",
      description: "Consejos serenos de Clara la Liebre y propuestas opcionales bajo tu aprobación.",
    },
  ];

  const sceneHotspots: Array<{
    id: typeof activeTab;
    icon: string;
    label: string;
    hint: string;
  }> = [
    {
      id: "taller",
      icon: "🧶",
      label: "Mesa Principal",
      hint: isActive ? `En curso (${formattedTime})` : activeProject?.name || "Listo para tejer",
    },
    {
      id: "proyectos",
      icon: "🧵",
      label: "Estantería",
      hint: `${projects.length} proyecto${projects.length === 1 ? "" : "s"}`,
    },
    {
      id: "patrones",
      icon: "📜",
      label: "Carpeta Patrones",
      hint:
        activePattern.images.length > 0
          ? `${activePattern.images.length} img • ${activePattern.steps.length} pasos`
          : activePattern.steps.length > 0
          ? `${activePattern.steps.length} pasos`
          : "Añadir guía o fotos",
    },
    {
      id: "filet",
      icon: "▦",
      label: "Filet Studio",
      hint: "Cuadrícula y alfabetos",
    },
    {
      id: "galeria",
      icon: "🏆",
      label: "Vitrina",
      hint: `${knittingSessions.length} sesiones`,
    },
    {
      id: "clara",
      icon: "🐇",
      label: "Rincón de Clara",
      hint: "Compañera del Atelier",
    },
  ];

  return (
    <LivingInteriorRoom
      submissionError={submissionError}
      buildingId="atelier"
      buildingName="El Atelier de Crochet & Tejido"
      domain="knitting"
      districtName="Artes & Oficios"
      icon="🧶"
      tagline="Madera cálida, ovillos ordenados y ritmo tranquilo punto a punto."
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
          : "Sesión de crochet activa",
        onViewSession: () => setActiveTab("taller"),
      }}
      metrics={[
        { label: "Nivel Atelier", value: progression.tierName },
        { label: "Proyectos", value: projects.length },
        { label: "Vueltas Totales", value: totalCompletedRows.toLocaleString("es-CO") },
        { label: "Sesiones", value: knittingSessions.length },
      ]}
      roomTheme={{
        wallColor: "#5C381E",
        floorPattern: "wood",
        ambientWarmth: "fireplace",
      }}
    >
      {/* ESCENA HÍBRIDA ILUSTRADA DEL ATELIER (ALTERNATIVA B) */}
      <div className="rounded-3xl border-3 border-[#3A2E2B] bg-gradient-to-br from-[#F4EEDC] via-[#EFE5CE] to-[#E7D69C]/45 p-4 shadow-[0_4px_0_#3A2E2B] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏡</span>
            <div>
              <p className="text-xs font-black text-[#3A2E2B]">
                Habitación del Atelier — Toca un objeto para interactuar
              </p>
              <p className="text-[11px] text-[#795548] font-medium">
                {progression.facadeDescription}
              </p>
            </div>
          </div>
          {activeProject && (
            <span className="rounded-full border border-[#3A2E2B]/30 bg-[#FFFDF8] px-3 py-1 text-[11px] font-bold text-[#3A2E2B]">
              En bastidor: {activeProject.name}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {sceneHotspots.map((spot) => {
            const selected = activeTab === spot.id;
            return (
              <button
                key={spot.id}
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setActiveTab(spot.id);
                }}
                className={`rounded-2xl border-2 p-2.5 text-left transition-colors cursor-pointer ${
                  selected
                    ? "border-[#3A2E2B] bg-[#314C3C] text-[#FFFDF8] shadow-[0_3px_0_#1A2B20]"
                    : "border-[#3A2E2B]/40 bg-[#FFFDF8]/90 text-[#3A2E2B] hover:bg-[#FFFDF8]"
                }`}
              >
                <span className="text-xl block leading-none mb-1">{spot.icon}</span>
                <span className="text-xs font-black block leading-tight">{spot.label}</span>
                <span
                  className={`text-[10px] font-medium block truncate mt-0.5 ${
                    selected ? "text-[#E7D69C]" : "text-[#795548]"
                  }`}
                >
                  {spot.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {notification && (
        <div className="my-2">
          <CozyNotification
            variant={notification.type}
            title={notification.type === "success" ? "¡Listo!" : "Aviso"}
            message={notification.message}
            onDismiss={() => setNotification(null)}
          />
        </div>
      )}

      {/* =======================================================================
          ESTACIÓN 1: MESA PRINCIPAL DE TEJIDO (CRONÓMETRO + CONTADOR + PATRÓN)
         ======================================================================= */}
      {activeTab === "taller" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Columna Principal: Proyecto, Cronómetro y Contador Táctil */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] space-y-4">
              {/* Proyecto Activo */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-black uppercase text-[#795548] tracking-wider block">
                    Proyecto Activo en Mesa
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-[#3A2E2B]">
                    {activeProject?.name || "Crea tu primer proyecto en la Estantería"}
                  </h3>
                  {activeProject && (
                    <span className="text-xs text-[#795548] font-bold">
                      {activeProject.technique} • {activeProject.yarn_details || "Hilado libre"} •{" "}
                      {STATUS_META[activeProject.status]?.label || "En curso"}
                    </span>
                  )}
                </div>

                {projects.length > 0 && (
                  <select
                    aria-label="Seleccionar proyecto activo"
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-2 text-xs font-bold text-[#3A2E2B] outline-none"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {STATUS_META[p.status]?.icon || "🧶"} {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {activeProject && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-[#795548]">
                    <span>
                      Vuelta {activeProject.completed_rows || 0} de{" "}
                      {activeProject.total_rows_target || 60}
                      {sessionRows > 0 ? ` (+${sessionRows} en sesión)` : ""}
                    </span>
                    <span>
                      {Math.min(
                        100,
                        Math.round(
                          (((activeProject.completed_rows || 0) + sessionRows) /
                            (activeProject.total_rows_target || 60)) *
                            100
                        )
                      )}
                      %
                    </span>
                  </div>
                  <CozyProgress
                    value={(activeProject.completed_rows || 0) + sessionRows}
                    max={activeProject.total_rows_target || 60}
                    variant="clay"
                  />
                </div>
              )}

              {/* Cronómetro Universal (Requisito para ingresar vueltas) */}
              <div className="rounded-2xl border-3 border-[#3A2E2B] bg-[#F4EEDC] p-4 text-center space-y-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#795548] block">
                  {isRunning
                    ? "⏱️ Sesión de Tejido en Curso"
                    : isPaused
                    ? "⏸️ Sesión Pausada"
                    : "🧶 Bastidor Preparado"}
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
                      className="flex items-center gap-2 min-h-[48px] px-5"
                    >
                      <Play className="h-4 w-4" />
                      Iniciar Cronómetro (Opcional)
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
                          className="flex items-center gap-1.5 min-h-[44px]"
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
                          className="flex items-center gap-1.5 min-h-[44px]"
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
                        className="flex items-center gap-1.5 min-h-[44px]"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {submitting ? "Guardando..." : "Finalizar & Guardar"}
                      </CozyButton>

                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic("warning");
                          resetSession();
                          setSessionRows(0);
                          setRowUndoStack([]);
                        }}
                        className="text-xs font-bold text-red-700 underline hover:text-red-900 cursor-pointer ml-2"
                      >
                        Descartar
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Contador Táctil Grande de Vueltas (Funciona con o sin cronómetro) */}
              <div className="rounded-2xl border-2 border-[#3A2E2B] bg-[#FFFDF8] p-4 text-center space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-[#795548]">
                  <span>
                    Vueltas por guardar {isActive ? "(con cronómetro)" : "(modo libre)"}
                  </span>
                  {rowUndoStack.length > 0 && (
                    <button
                      type="button"
                      onClick={handleUndoRow}
                      className="inline-flex items-center gap-1 text-[11px] font-black text-[#3A2E2B] hover:underline cursor-pointer"
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                      Deshacer
                    </button>
                  )}
                </div>

                <div className="font-mono text-4xl font-black text-[#3A2E2B]">+{sessionRows}</div>

                <div className="grid grid-cols-4 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleIncrementRows(-1)}
                    aria-label="Restar 1 vuelta"
                    className="min-h-[56px] rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC] text-base font-black text-[#3A2E2B] hover:bg-[#E7D69C] active:translate-y-0.5 cursor-pointer"
                  >
                    -1
                  </button>
                  <button
                    type="button"
                    onClick={() => handleIncrementRows(1)}
                    aria-label="Sumar 1 vuelta"
                    className="col-span-2 min-h-[56px] rounded-2xl border-2 border-[#3A2E2B] bg-[#314C3C] text-lg font-black text-[#FFFDF8] hover:bg-[#3E5F4C] shadow-[0_3px_0_#1A2B20] active:translate-y-0.5 cursor-pointer"
                  >
                    +1 Vuelta
                  </button>
                  <button
                    type="button"
                    onClick={() => handleIncrementRows(5)}
                    aria-label="Sumar 5 vueltas"
                    className="min-h-[56px] rounded-2xl border-2 border-[#3A2E2B] bg-[#E7D69C] text-base font-black text-[#3A2E2B] hover:bg-[#F2E3B3] shadow-[0_3px_0_#3A2E2B] active:translate-y-0.5 cursor-pointer"
                  >
                    +5
                  </button>
                </div>

                {!isActive && sessionRows > 0 && (
                  <div className="pt-2">
                    <CozyButton
                      variant="sunlight"
                      size="md"
                      disabled={savingQuickRows}
                      onClick={handleSaveQuickRowsWithoutTimer}
                      className="w-full min-h-[48px] flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {savingQuickRows
                        ? "Guardando avance..."
                        : `Guardar +${sessionRows} vuelta${sessionRows === 1 ? "" : "s"} sin cronómetro`}
                    </CozyButton>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Columna Lateral: Visor de Patrón Acoplado + Notas + Captura */}
          <div className="lg:col-span-5 space-y-4">
            {/* Visor de Patrón Acoplado junto al Contador */}
            <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4 text-[#C88973]" />
                  <h4 className="text-xs font-black uppercase text-[#3A2E2B]">
                    Patrón Acoplado
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("patrones")}
                    className="text-[11px] font-bold text-[#314C3C] hover:underline cursor-pointer"
                  >
                    Editar / Subir fotos
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPatternViewer(!showPatternViewer)}
                    className="text-[11px] font-bold text-[#795548] hover:underline cursor-pointer"
                  >
                    {showPatternViewer ? "Ocultar ▲" : "Mostrar ▼"}
                  </button>
                </div>
              </div>

              {showPatternViewer && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-[#3A2E2B]">{activePattern.title}</span>
                    {activePattern.externalUrl && (
                      <a
                        href={activePattern.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#314C3C] hover:underline"
                      >
                        Abrir enlace <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>

                  {/* Imágenes del patrón subidas */}
                  {activePattern.images.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {activePattern.images.map((img) => (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() => setLightboxImage(img)}
                          className="group relative overflow-hidden rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] aspect-square cursor-pointer"
                          title={`Ampliar ${img.name}`}
                        >
                          <img
                            src={img.dataUrl}
                            alt={img.name}
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Pasos vuelta a vuelta */}
                  {activePattern.steps.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {activePattern.steps.map((step, idx) => {
                        const rowNum = idx + 1;
                        const isCurrent = rowNum === currentWorkingRow;
                        return (
                          <div
                            key={idx}
                            className={`rounded-xl border px-3 py-2 text-xs ${
                              isCurrent
                                ? "border-[#314C3C] bg-[#314C3C]/10 font-bold text-[#3A2E2B]"
                                : "border-[#D8B48A]/60 bg-[#F4EEDC]/60 text-[#5C381E]"
                            }`}
                          >
                            <span className="font-black mr-1.5">
                              {isCurrent ? "▶ " : ""}V{rowNum}:
                            </span>
                            {step}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-[#8C6239]/50 bg-[#F4EEDC]/50 p-3 text-xs text-[#795548] space-y-2">
                      <p>
                        Aún no has cargado instrucciones ni fotos de patrón para este proyecto.
                      </p>
                      <CozyButton
                        variant="wood"
                        size="sm"
                        onClick={() => setActiveTab("patrones")}
                      >
                        📜 Agregar Patrón o Subir Imágenes
                      </CozyButton>
                    </div>
                  )}

                  {activePattern.notes && (
                    <p className="rounded-xl bg-[#FFFBF2] border border-[#D8B48A] p-2.5 text-[11px] text-[#5C381E]">
                      <strong>Nota del patrón:</strong> {activePattern.notes}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Notas de la sesión */}
            <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] space-y-3">
              <h4 className="text-xs font-black uppercase text-[#3A2E2B] flex items-center gap-1.5">
                <Scissors className="h-4 w-4 text-[#C88973]" />
                Notas de Puntos & Recordatorios
              </h4>
              <textarea
                value={stitchesNotes}
                onChange={(e) => setStitchesNotes(e.target.value)}
                placeholder="Ej. Quedé en el aumento 4 de la manga, aguja 4mm..."
                rows={3}
                className="w-full rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC] p-3 text-xs font-medium text-[#3A2E2B] placeholder:text-[#795548]/60 outline-none"
              />
            </div>

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
                applyRowChange(Math.max(0, vals.quantity), true);
                if (vals.notes) {
                  setStitchesNotes((prev) =>
                    prev ? `${prev} • ${vals.notes}` : vals.notes || ""
                  );
                }
              }}
              onPhotoUploaded={(dataUrl) => {
                setUploadedPhotoUrl(dataUrl);
              }}
            />
          </div>
        </div>
      )}

      {/* =======================================================================
          ESTACIÓN 2: ESTANTERÍA DE PROYECTOS (4 ESTADOS SIN CULPA)
         ======================================================================= */}
      {activeTab === "proyectos" && (
        <div className="space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div>
              <h4 className="text-xs font-black uppercase text-[#3A2E2B]">
                Estantería de Proyectos Textiles
              </h4>
              <p className="text-[11px] text-[#795548]">
                Pausa o retoma cualquier prenda a tu ritmo, sin penalizaciones.
              </p>
            </div>
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

          {/* Filtro por los 4 estados */}
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: "all", label: `Todos (${projects.length})` },
                { id: "in_progress", label: "🧶 En curso" },
                { id: "paused", label: "☕ Pausados" },
                { id: "completed", label: "✨ Terminados" },
                { id: "archived", label: "📦 Archivados" },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`rounded-full border-2 px-3 py-1 text-[11px] font-bold cursor-pointer ${
                  statusFilter === f.id
                    ? "border-[#3A2E2B] bg-[#314C3C] text-[#FFFDF8]"
                    : "border-[#3A2E2B]/30 bg-[#FFFDF8] text-[#3A2E2B] hover:bg-[#F4EEDC]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {isCreatingProject && (
            <form
              onSubmit={handleCreateNewProject}
              className="rounded-3xl border-3 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_4px_0_#3A2E2B] space-y-3"
            >
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
                  <option value="Amigurumi">Amigurumi</option>
                  <option value="Dos Agujas">Dos Agujas / Tricot</option>
                  <option value="Telar">Telar de Bastidor</option>
                </select>
                <input
                  type="number"
                  min={5}
                  placeholder="Meta de vueltas / filas *"
                  value={newProjectTargetRows}
                  onChange={(e) => setNewProjectTargetRows(Number(e.target.value))}
                  className="rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-2 text-xs font-bold text-[#3A2E2B] outline-none"
                />
                <input
                  type="text"
                  placeholder="Hilado y aguja (ej. Algodón 4mm)"
                  value={newProjectYarn}
                  onChange={(e) => setNewProjectYarn(e.target.value)}
                  className="rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-2 text-xs font-bold text-[#3A2E2B] outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <CozyButton
                  variant="wood"
                  size="sm"
                  type="button"
                  onClick={() => setIsCreatingProject(false)}
                >
                  Cancelar
                </CozyButton>
                <CozyButton variant="forest" size="sm" type="submit">
                  Montar Puntos ➜
                </CozyButton>
              </div>
            </form>
          )}

          {filteredProjects.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-[#3A2E2B]/30 bg-[#FFFDF8] p-8 text-center text-xs text-[#795548]">
              No hay proyectos en este estado todavía.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map((proj) => {
                const isSelected = proj.id === activeProject?.id;
                const percent = Math.min(
                  100,
                  Math.round(((proj.completed_rows || 0) / (proj.total_rows_target || 60)) * 100)
                );
                const statusInfo = STATUS_META[proj.status] || STATUS_META.in_progress;

                return (
                  <div
                    key={proj.id}
                    className={`rounded-3xl border-3 p-4 shadow-[0_4px_0_#3A2E2B] space-y-3 ${
                      isSelected
                        ? "border-[#3A2E2B] bg-[#F4EEDC] ring-2 ring-[#C88973]"
                        : "border-[#3A2E2B] bg-[#FFFDF8]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProjectId(proj.id);
                          setActiveTab("taller");
                        }}
                        className="text-left cursor-pointer"
                      >
                        <h4 className="text-xs font-black text-[#3A2E2B] hover:underline">
                          {statusInfo.icon} {proj.name}
                        </h4>
                        <span className="text-[10px] text-[#795548] font-bold block">
                          {proj.technique} • {proj.yarn_details || "Hilado libre"}
                        </span>
                        {proj.linked_filet_pattern && (
                          <span className="mt-1 inline-block rounded-full border border-[#314C3C]/50 bg-[#314C3C]/10 px-2 py-0.5 text-[9px] font-black text-[#314C3C]">
                            📐 Filet v{proj.linked_filet_pattern.version_number} ({proj.linked_filet_pattern.grid_width}×{proj.linked_filet_pattern.grid_height})
                          </span>
                        )}
                      </button>

                      <span
                        className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase whitespace-nowrap ${statusInfo.badgeClass}`}
                      >
                        {statusInfo.label}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold text-[#795548]">
                        <span>
                          {proj.completed_rows || 0} / {proj.total_rows_target || 60} vueltas
                        </span>
                        <span>{percent}%</span>
                      </div>
                      <CozyProgress
                        value={proj.completed_rows || 0}
                        max={proj.total_rows_target || 60}
                        variant="clay"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#3A2E2B]/15">
                      <select
                        aria-label={`Estado de ${proj.name}`}
                        disabled={updatingStatusId === proj.id}
                        value={proj.status}
                        onChange={(e) =>
                          handleChangeProjectStatus(proj, e.target.value as KnittingProjectStatus)
                        }
                        className="rounded-lg border border-[#3A2E2B]/40 bg-[#FFFDF8] px-2 py-1 text-[10px] font-bold text-[#3A2E2B] outline-none"
                      >
                        <option value="in_progress">🧶 En curso</option>
                        <option value="paused">☕ Pausado sin culpa</option>
                        <option value="completed">✨ Terminado</option>
                        <option value="archived">📦 Archivado</option>
                      </select>

                      {proj.linked_filet_pattern && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProjectId(proj.id);
                            setFiletInitialMode("guided");
                            setActiveTab("filet");
                          }}
                          className="rounded-lg border border-[#3A2E2B] bg-[#314C3C] px-2 py-1 text-[10px] font-black text-[#FFFDF8] cursor-pointer"
                        >
                          Tejer guiado ➜
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProjectId(proj.id);
                          setActiveTab("taller");
                        }}
                        className="text-[11px] font-black text-[#314C3C] hover:underline cursor-pointer"
                      >
                        Tejer ➜
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-4 border-t-2 border-[#D8B48A]/40">
            <SkillResourceHubPanel domain="knitting" />
          </div>
        </div>
      )}

      {/* =======================================================================
          ESTACIÓN 3: CARPETA DE PATRONES (TEXTO + SUBIDA DIRECTA DE IMÁGENES)
         ======================================================================= */}
      {activeTab === "patrones" && (
        <form
          onSubmit={handleSavePattern}
          className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-black uppercase text-[#795548] block">
                Carpeta de Patrones del Proyecto
              </span>
              <h4 className="text-sm font-black text-[#3A2E2B]">
                {activeProject ? activeProject.name : "Selecciona un proyecto primero"}
              </h4>
            </div>

            {projects.length > 0 && (
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
            )}
          </div>

          {/* Subida Directa de Imágenes de Patrón */}
          <div className="rounded-2xl border-2 border-[#D8B48A] bg-[#FFFBF2] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-[#C88973]" />
                <span className="text-xs font-black text-[#3A2E2B]">
                  Imágenes y Gráficos del Patrón ({patternImagesDraft.length}/6)
                </span>
              </div>

              <label className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#3A2E2B] bg-[#314C3C] px-3 py-1.5 text-xs font-black text-[#FFFDF8] hover:bg-[#3E5F4C] cursor-pointer">
                <Upload className="h-3.5 w-3.5" />
                <span>{uploadingPatternImg ? "Cargando..." : "Subir Imágenes"}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={uploadingPatternImg || patternImagesDraft.length >= 6}
                  onChange={handlePatternImageUpload}
                  className="hidden"
                />
              </label>
            </div>

            {patternImagesDraft.length === 0 ? (
              <p className="text-xs text-[#795548]">
                Sube fotos de diagramas, gráficos de puntos o referencias visuales directamente desde tu celular o PC.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {patternImagesDraft.map((img) => (
                  <div
                    key={img.id}
                    className="relative rounded-2xl border-2 border-[#3A2E2B] bg-[#FFFDF8] overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setLightboxImage(img)}
                      className="block w-full aspect-[4/3] cursor-pointer"
                    >
                      <img
                        src={img.dataUrl}
                        alt={img.name}
                        className="h-full w-full object-cover"
                      />
                    </button>
                    <div className="flex items-center justify-between px-2 py-1.5 bg-[#F4EEDC] text-[10px]">
                      <span className="font-bold text-[#3A2E2B] truncate pr-1">{img.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemovePatternImage(img.id)}
                        aria-label={`Eliminar ${img.name}`}
                        className="text-red-700 hover:text-red-900 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-black text-[#3A2E2B] block">
                Nombre del Patrón
              </label>
              <input
                type="text"
                value={patternTitleDraft}
                onChange={(e) => setPatternTitleDraft(e.target.value)}
                placeholder="Ej. Granny Square Primavera"
                className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-2 text-xs font-bold text-[#3A2E2B] outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-black text-[#3A2E2B] block">
                Enlace externo opcional (PDF / Web / Video)
              </label>
              <input
                type="url"
                value={patternUrlDraft}
                onChange={(e) => setPatternUrlDraft(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-2 text-xs font-bold text-[#3A2E2B] outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-black text-[#3A2E2B] block">
              Instrucciones vuelta a vuelta (una vuelta por línea)
            </label>
            <textarea
              rows={5}
              value={patternStepsDraft}
              onChange={(e) => setPatternStepsDraft(e.target.value)}
              placeholder={"Anillo mágico de 6 pb\n6 aumentos (12 pb)\n(1 pb, 1 aum) x6 (18 pb)"}
              className="w-full rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC] p-3 font-mono text-xs text-[#3A2E2B] outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-black text-[#3A2E2B] block">
              Notas personales del patrón (ganchillo, tensión, abreviaturas)
            </label>
            <textarea
              rows={2}
              value={patternNotesDraft}
              onChange={(e) => setPatternNotesDraft(e.target.value)}
              placeholder="Ej. Usar ganchillo 3.5mm para que quede firme..."
              className="w-full rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC] p-3 text-xs text-[#3A2E2B] outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <CozyButton
              type="button"
              variant="wood"
              size="sm"
              onClick={() => {
                handleSavePattern();
                setShowPatternViewer(true);
                setActiveTab("taller");
              }}
            >
              Guardar y Fijar en Mesa ➜
            </CozyButton>
            <CozyButton type="submit" variant="forest" size="sm">
              Guardar Patrón
            </CozyButton>
          </div>
        </form>
      )}

      {/* =======================================================================
          ESTACIÓN 3B: FILET CROCHET STUDIO (MÓDULO DEL ATELIER DE CLARA)
         ======================================================================= */}
      {activeTab === "filet" && (
        <FiletCrochetStudio
          sessionOwner={sessionOwner}
          activeProject={activeProject}
          projects={projects}
          sessions={knittingSessions}
          initialStudioMode={filetInitialMode}
          onSelectProject={(projectId) => setSelectedProjectId(projectId)}
          onCreateProjectFromPattern={async ({ name, linkedPattern }) => {
            const res = await fetch("/api/shortcuts/skill-session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "add_knitting_project",
                title: name,
                knitting_technique: "Crochet",
                knitting_total_rows: linkedPattern.total_rows,
                yarn_details: `Filet Crochet · Malla ${linkedPattern.mesh_size} · ${linkedPattern.grid_width}×${linkedPattern.grid_height}`,
                linked_filet_pattern: linkedPattern,
              }),
            });
            const data = (await res.json().catch(() => ({}))) as {
              project?: KnittingProject;
              error?: string;
            };
            if (!res.ok || !data.project) {
              setNotification({
                type: "error",
                message: data.error || "No se pudo crear el proyecto de tejido desde el patrón.",
              });
              return;
            }
            setSelectedProjectId(data.project.id);
            setFiletInitialMode("guided");
            await onRefreshState();
            setNotification({
              type: "success",
              message: `🧶 Proyecto "${data.project.name}" creado desde versión inmutable v${linkedPattern.version_number} y listo en la Mesa Guiada.`,
            });
          }}
          onSubmitDirectSkillSession={onSubmitDirectSkillSession}
          onRefreshState={onRefreshState}
          sessionBridge={{
            isActive,
            isRunning,
            isPaused,
            formattedTime,
            elapsedSeconds: session?.elapsedSeconds || 0,
            submitting,
            submissionError,
            onStartSession: (proj) => {
              setSelectedProjectId(proj.id);
              triggerHaptic("light");
              startSession({
                domain: "knitting",
                buildingId: "atelier",
                resourceId: proj.id,
                resourceTitle: proj.name,
                objective: `Sesión guiada Filet: ${proj.name}`,
              });
            },
            onPauseSession: () => pauseSession(),
            onResumeSession: () => resumeSession(),
            onFinishSession: async ({ project, pendingRowsToCredit, notes }) => {
              const result = await finishSession({
                project_id: project.id,
                rows_completed: pendingRowsToCredit,
                stitches_notes: notes,
              });
              if (result) {
                await onRefreshState();
                return true;
              }
              return false;
            },
          }}
        />
      )}

      {/* =======================================================================
          ESTACIÓN 4: VITRINA DE CREACIONES & HISTORIAL REAL
         ======================================================================= */}
      {activeTab === "galeria" && (
        <div className="space-y-4">
          <VillageProgressionPanel
            progression={progression}
            buildingName="El Atelier de Crochet & Tejido"
          />

          <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] space-y-3">
            <h4 className="text-xs font-black uppercase text-[#3A2E2B] flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-[#C88973]" />
              Historial de Sesiones en el Atelier
            </h4>

            {knittingSessions.length === 0 ? (
              <div className="text-center py-6 text-xs text-[#795548]">
                Aún no has registrado sesiones de tejido. ¡Inicia el cronómetro en la Mesa cuando quieras!
              </div>
            ) : (
              <div className="divide-y divide-[#3A2E2B]/15">
                {knittingSessions.map((ses) => (
                  <div key={ses.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-black text-[#3A2E2B] block">{ses.title}</span>
                      <span className="text-[10px] text-[#795548]">
                        {ses.details} • {new Date(ses.timestamp).toLocaleDateString("es-CO")}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-[#314C3C]">+{ses.gp_earned} GP</span>
                      <span className="text-[10px] text-[#795548] block">
                        {ses.duration_minutes} min
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =======================================================================
          ESTACIÓN 5: RINCÓN DE CLARA (SIN DUPLICACIÓN EN LA MESA)
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
              if (prepared.initialNotes) {
                setStitchesNotes((prev) =>
                  prev ? `${prev} • ${prepared.initialNotes}` : prepared.initialNotes || ""
                );
              }
              setActiveTab("taller");
            }}
            onApplyProposal={(prop) => {
              if (prop.suggestedPayload?.projectId) {
                setSelectedProjectId(String(prop.suggestedPayload.projectId));
              }
              setActiveTab("taller");
            }}
          />
        </div>
      )}

      {/* Lightbox para ver imágenes de patrones ampliadas */}
      {lightboxImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={lightboxImage.name}
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-3xl w-full rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-3 space-y-2"
          >
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-black text-[#3A2E2B] truncate">
                {lightboxImage.name}
              </span>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="rounded-lg border border-[#3A2E2B] bg-[#F4EEDC] p-1 text-[#3A2E2B] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <img
              src={lightboxImage.dataUrl}
              alt={lightboxImage.name}
              className="max-h-[75vh] w-full object-contain rounded-2xl bg-[#F4EEDC]"
            />
          </div>
        </div>
      )}
    </LivingInteriorRoom>
  );
}
