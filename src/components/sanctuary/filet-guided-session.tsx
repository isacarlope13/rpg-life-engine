"use client";

/**
 * ============================================================================
 * OAKHAVEN — FILET CROCHET STUDIO FASE 4 (MESA DE TEJIDO GUIADA)
 * ============================================================================
 * Reutiliza el cronómetro y ciclo de sesión existente de `useUniversalSession`
 * recibido desde `AtelierBuilding` (cero cronómetros paralelos).
 *
 * Características:
 * - 3 vistas: 1. Gráfico, 2. Instrucciones, 3. Ambos.
 * - Multidispositivo: teclado en escritorio, Pointer Events + zoom/pan (S Pen /
 *   Galaxy Tab) y controles grandes para una mano en iPhone / Safari.
 * - Persistencia automática aislada por propietario, idempotencia por fila,
 *   estado visible de sincronización y manejo seguro de errores de red.
 * - Consulta determinista de Clara + lectura opcional con SpeechSynthesis.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Cloud,
  CloudOff,
  Columns2,
  Grid3X3,
  ListOrdered,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { KnittingProject, SkillSessionRecord } from "@/types/rpg";
import { CozyButton, CozyNotification } from "@/components/cozy/ui";
import {
  buildGuidedActiveRowView,
  buildGuidedProgressSummary,
  completeActiveSegment,
  confirmActiveRow,
  createInitialGuidedProgressState,
  formatGuidedSegmentSpeech,
  setGuidedSessionStatus,
  stepBackGuidedProgress,
  type FiletGuidedProgressState,
  type FiletGuidedSyncState,
} from "@/lib/sanctuary/filet-guided-engine";
import {
  getOrCreateLocalDeviceId,
  readGuidedProgressSafe,
  saveGuidedProgressSafe,
} from "@/lib/sanctuary/filet-guided-store";
import { getGuidedFiletProjectStatus } from "@/lib/ai/clara-lyra-tools";
import { safeLocalStorage } from "@/lib/storage-safe";

export interface GuidedUniversalSessionBridge {
  isActive: boolean;
  isRunning: boolean;
  isPaused: boolean;
  formattedTime: string;
  elapsedSeconds: number;
  submitting: boolean;
  submissionError: string | null;
  onStartSession: (project: KnittingProject) => void;
  onPauseSession: () => void;
  onResumeSession: () => void;
  onFinishSession: (params: {
    project: KnittingProject;
    notes: string;
  }) => Promise<boolean>;
}

interface FiletGuidedSessionProps {
  sessionOwner?: string;
  projects: KnittingProject[];
  selectedProjectId?: string;
  sessions?: SkillSessionRecord[];
  onSelectProject?: (projectId: string) => void;
  onRefreshState?: () => Promise<void>;
  sessionBridge?: GuidedUniversalSessionBridge;
}

type GuidedViewMode = "both" | "chart" | "instructions";

const GUIDED_ZOOMS = [50, 75, 100, 125, 150, 200] as const;

const SYNC_BADGE: Record<
  FiletGuidedSyncState,
  { label: string; className: string }
> = {
  saved_local: {
    label: "Guardado localmente",
    className: "bg-[#F4EEDC] border-[#3A2E2B]/40 text-[#5C381E]",
  },
  pending_sync: {
    label: "Pendiente de sincronización",
    className: "bg-[#E7D69C]/60 border-[#8C6239] text-[#5C381E]",
  },
  synced_server: {
    label: "Confirmado por el servidor",
    className: "bg-[#314C3C]/15 border-[#314C3C] text-[#314C3C]",
  },
  conflict: {
    label: "Conflicto detectado",
    className: "bg-[#C88973]/25 border-[#8A3722] text-[#8A3722]",
  },
  error: {
    label: "Error de red (local a salvo)",
    className: "bg-[#C88973]/25 border-[#8A3722] text-[#8A3722]",
  },
};

export function FiletGuidedSession({
  sessionOwner,
  projects,
  selectedProjectId,
  sessions = [],
  onSelectProject,
  onRefreshState,
  sessionBridge,
}: FiletGuidedSessionProps) {
  const filetProjects = useMemo(
    () => projects.filter((p) => Boolean(p.linked_filet_pattern)),
    [projects]
  );

  const [localSelectedId, setLocalSelectedId] = useState<string>(
    () => selectedProjectId || filetProjects[0]?.id || ""
  );

  useEffect(() => {
    if (selectedProjectId && filetProjects.some((p) => p.id === selectedProjectId)) {
      setLocalSelectedId(selectedProjectId);
    } else if (!filetProjects.some((p) => p.id === localSelectedId) && filetProjects[0]) {
      setLocalSelectedId(filetProjects[0].id);
    }
  }, [selectedProjectId, filetProjects, localSelectedId]);

  const activeProject = useMemo(
    () => filetProjects.find((p) => p.id === localSelectedId) || filetProjects[0],
    [filetProjects, localSelectedId]
  );

  const [progress, setProgress] = useState<FiletGuidedProgressState | null>(null);
  const [viewMode, setViewMode] = useState<GuidedViewMode>("both");
  const [zoomPct, setZoomPct] = useState<number>(100);
  const [speechEnabled, setSpeechEnabled] = useState<boolean>(false);
  const [showClaraCard, setShowClaraCard] = useState<boolean>(false);
  const [syncingNow, setSyncingNow] = useState<boolean>(false);
  const [notice, setNotice] = useState<{
    type: "success" | "error" | "warning";
    message: string;
  } | null>(null);

  const deviceIdRef = useRef<string>("dev-local");
  useEffect(() => {
    deviceIdRef.current = getOrCreateLocalDeviceId(safeLocalStorage);
  }, []);

  // Cargar o inicializar estado guiado aislado por propietario y proyecto
  useEffect(() => {
    if (!activeProject || !activeProject.linked_filet_pattern) {
      setProgress(null);
      return;
    }
    const existing = readGuidedProgressSafe(sessionOwner, activeProject.id);
    if (
      existing &&
      existing.patternVersionId === activeProject.linked_filet_pattern.version_id
    ) {
      setProgress(existing);
    } else {
      const initial = createInitialGuidedProgressState({
        ownerId: sessionOwner || "local-preview",
        project: activeProject,
        deviceId: deviceIdRef.current,
      });
      setProgress(initial);
      if (sessionOwner) {
        saveGuidedProgressSafe(sessionOwner, initial);
      }
    }
  }, [activeProject, sessionOwner]);

  // Reflejar estado de pausa/ejecución del cronómetro universal sin alterar contadores (Regla 6)
  useEffect(() => {
    if (!progress || !sessionBridge) return;
    if (progress.confirmedRows.length >= progress.totalRows) return;
    const desired = sessionBridge.isRunning
      ? "running"
      : sessionBridge.isPaused
        ? "paused"
        : "idle";
    if (progress.sessionStatus !== desired) {
      const next = setGuidedSessionStatus(progress, desired);
      setProgress(next);
      if (sessionOwner) saveGuidedProgressSafe(sessionOwner, next);
    }
  }, [sessionBridge?.isRunning, sessionBridge?.isPaused]); // eslint-disable-line react-hooks/exhaustive-deps

  const persistProgress = useCallback(
    (next: FiletGuidedProgressState) => {
      setProgress(next);
      if (sessionOwner) {
        saveGuidedProgressSafe(sessionOwner, next);
      }
    },
    [sessionOwner]
  );

  useEffect(() => {
    if (!sessionOwner || !activeProject?.linked_filet_pattern) return;
    const projectId = activeProject.id;
    const controller = new AbortController();
    void fetch(`/api/filet/progress?projectId=${encodeURIComponent(projectId)}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) return;
        const remote = await response.json();
        if (!remote || controller.signal.aborted) return;
        const local = readGuidedProgressSafe(sessionOwner, projectId);
        if (!local || local.pendingServerOperation || remote.pattern_version_id !== local.patternVersionId ||
            !Number.isInteger(remote.revision) || remote.revision <= (local.serverRevision ?? 0) ||
            !Array.isArray(remote.confirmed_rows)) return;
        const rows: number[] = remote.confirmed_rows;
        if (new Set(rows).size !== rows.length ||
            rows.some(row => !Number.isInteger(row) || row < 1 || row > local.totalRows)) return;
        if (local.confirmedRows.some(row => !local.syncedConfirmedRows.includes(row))) {
          persistProgress({ ...local, syncState: "conflict" });
          return;
        }
        const nextRow = Array.from({ length: local.totalRows }, (_, index) => index + 1)
          .find(row => !rows.includes(row)) ?? local.totalRows;
        const keepSegments = nextRow === local.activeRowNumber && !rows.includes(nextRow);
        persistProgress({
          ...local, activeRowNumber: nextRow,
          activeSegmentIndex: keepSegments ? local.activeSegmentIndex : 0,
          completedSegmentIndices: keepSegments ? local.completedSegmentIndices : [],
          confirmedRows: rows, syncedConfirmedRows: [...rows],
          serverRevision: remote.revision, syncState: "synced_server",
        });
      }).catch(() => {});
    return () => controller.abort();
  }, [activeProject?.id, activeProject?.linked_filet_pattern, sessionOwner, persistProgress]);

  const speakText = useCallback(
    (text: string) => {
      if (!speechEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) {
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = "es-ES";
        utter.rate = 0.96;
        window.speechSynthesis.speak(utter);
      } catch {
        // Degradación silenciosa si el navegador bloquea SpeechSynthesis
      }
    },
    [speechEnabled]
  );

  const summary = useMemo(
    () => (progress ? buildGuidedProgressSummary(progress) : null),
    [progress]
  );
  const activeRowView = useMemo(
    () => (progress ? buildGuidedActiveRowView(progress) : null),
    [progress]
  );

  const recordedMinutes = useMemo(() => {
    if (!activeProject) return 0;
    const pastMins = sessions
      .filter((s) => s.domain === "knitting" && s.metadata?.project_id === activeProject.id)
      .reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
    const liveMins = sessionBridge?.isActive
      ? Math.floor((sessionBridge.elapsedSeconds || 0) / 60)
      : 0;
    return pastMins + liveMins;
  }, [activeProject, sessions, sessionBridge?.isActive, sessionBridge?.elapsedSeconds]);

  const claraBriefing = useMemo(() => {
    if (!progress) return null;
    return getGuidedFiletProjectStatus({ progress, recordedMinutes });
  }, [progress, recordedMinutes]);

  const handleCompleteSegment = useCallback(() => {
    if (!progress || progress.pendingServerOperation) return;
    const res = completeActiveSegment(progress, {
      expectedVersionId: progress.patternVersionId,
    });
    if (!res.ok) {
      setNotice({
        type: "warning",
        message:
          res.reason === "PROJECT_ALREADY_COMPLETED"
            ? "Todas las vueltas del patrón ya están confirmadas."
            : "No se pudo avanzar el segmento.",
      });
      return;
    }
    persistProgress(res.state);
    const nextView = buildGuidedActiveRowView(res.state);
    if (nextView && speechEnabled) {
      speakText(formatGuidedSegmentSpeech(nextView));
    }
  }, [progress, persistProgress, speechEnabled, speakText]);

  const syncLock = useRef(false);
  const syncContext = useRef({ owner: sessionOwner, project: activeProject?.id });
  syncContext.current = { owner: sessionOwner, project: activeProject?.id };
  const submitGuidedRow = useCallback(async (action: "confirm" | "undo") => {
    if (!progress || syncLock.current || !sessionOwner) return;
    const pending = progress.pendingServerOperation;
    if (pending && pending.action !== action) return;
    const id = pending?.id ?? crypto.randomUUID();
    const mutation = action === "confirm"
      ? confirmActiveRow(progress, { operationId: id, deviceId: deviceIdRef.current, expectedVersionId: progress.patternVersionId })
      : stepBackGuidedProgress(progress, {
          allowUndoConfirmedRow: true, operationId: id, deviceId: deviceIdRef.current,
          expectedVersionId: progress.patternVersionId,
        });
    if (!mutation.ok) {
      setNotice({ type: "warning", message: "Completa los segmentos antes de confirmar o selecciona una vuelta que puedas deshacer." });
      return;
    }
    if (action === "undo" && mutation.deltaCompletedRows === 0) {
      persistProgress(mutation.state);
      return;
    }
    const row = pending?.row ?? (action === "confirm" ? progress.activeRowNumber : mutation.state.activeRowNumber);
    const revision = pending?.revision ?? progress.serverRevision ?? 0;
    const queued: FiletGuidedProgressState = {
      ...progress,
      syncState: "pending_sync",
      pendingServerOperation: { id, action, row, revision },
    };
    const saved = saveGuidedProgressSafe(sessionOwner, queued);
    if (!saved.ok) {
      setNotice({ type: "warning", message: saved.error || "No se pudo guardar el pendiente." });
      return;
    }
    setProgress(queued);
    syncLock.current = true;
    setSyncingNow(true);
    try {
      const response = await fetch("/api/filet/progress", {
        method: "POST",
        headers: { "content-type": "application/json", "x-oakhaven-filet-write": "1" },
        body: JSON.stringify({
          projectId: progress.projectId, versionId: progress.patternVersionId,
          operationId: id, revision, action, row,
          ...(action === "confirm" ? { segments: progress.completedSegmentIndices } : {}),
        }),
      });
      const receipt = await response.json();
      if (syncContext.current.owner !== sessionOwner || syncContext.current.project !== progress.projectId) return;
      if (!response.ok || receipt.success !== true ||
          receipt.revision !== revision + 1 ||
          receipt.completed_rows !== mutation.state.confirmedRows.length) {
        const conflict = response.status === 409 || response.ok;
        persistProgress({ ...queued, syncState: conflict ? "conflict" : "error" });
        setNotice({
          type: "warning",
          message: conflict
            ? "El servidor tiene otra revisión. El pendiente se conserva para reconciliación."
            : receipt.error || "Progreso remoto no disponible. El pendiente queda guardado.",
        });
        return;
      }
      persistProgress({
        ...mutation.state,
        syncedConfirmedRows: [...mutation.state.confirmedRows],
        serverRevision: receipt.revision,
        pendingServerOperation: undefined,
        syncState: "synced_server",
      });
      const message = action === "confirm" ? "Vuelta confirmada en el servidor." : "Vuelta deshecha en el servidor.";
      setNotice({ type: "success", message });
      if (speechEnabled) speakText(message);
      if (onRefreshState) void onRefreshState().catch(() => {});
    } catch {
      if (syncContext.current.owner !== sessionOwner || syncContext.current.project !== progress.projectId) return;
      persistProgress({ ...queued, syncState: "error" });
      setNotice({ type: "warning", message: "Sin confirmación del servidor. Puedes reintentar la misma operación." });
    } finally {
      syncLock.current = false;
      setSyncingNow(false);
    }
  }, [progress, sessionOwner, persistProgress, onRefreshState, speechEnabled, speakText]);

  const handleStepBack = useCallback((allowUndoConfirmedRow = false) => {
    if (!progress || progress.pendingServerOperation) return;
    if (allowUndoConfirmedRow) {
      void submitGuidedRow("undo");
      return;
    }
    const result = stepBackGuidedProgress(progress, {
      deviceId: deviceIdRef.current,
      expectedVersionId: progress.patternVersionId,
    });
    if (result.ok) persistProgress(result.state);
  }, [progress, persistProgress, submitGuidedRow]);

  const handleConfirmRow = useCallback(() => submitGuidedRow("confirm"), [submitGuidedRow]);

  const handleFinishGuidedSession = useCallback(async () => {
    if (!progress || !activeProject || !sessionBridge) return;
    const ok = await sessionBridge.onFinishSession({
      project: activeProject,
      notes: `Sesión guiada Filet (${progress.snapshot.pattern_name} v${progress.patternVersionNumber}): ${progress.syncedConfirmedRows.length}/${progress.totalRows} vueltas confirmadas.`,
    });
    if (ok) {
      setProgress(current => {
        if (!current || current.projectId !== progress.projectId) return current;
        const next = setGuidedSessionStatus(current, current.confirmedRows.length >= current.totalRows ? "completed" : "idle");
        saveGuidedProgressSafe(sessionOwner, next);
        return next;
      });
      setNotice({ type: "success", message: "Sesión finalizada. Las vueltas se gestionan por separado." });
    }
  }, [progress, activeProject, sessionBridge, sessionOwner]);

  // Navegación por teclado en computador (Bloque 6)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!progress || !activeRowView) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (e.key === " " || e.key === "Enter") {
        if (!activeRowView.allSegmentsCompleted) {
          e.preventDefault();
          handleCompleteSegment();
        }
      } else if (e.key === "Backspace" || e.key === "ArrowLeft") {
        e.preventDefault();
        handleStepBack(false);
      } else if ((e.key === "c" || e.key === "C") && activeRowView.allSegmentsCompleted) {
        e.preventDefault();
        void handleConfirmRow();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [progress, activeRowView, handleCompleteSegment, handleStepBack, handleConfirmRow]);

  // Pan táctil / S Pen con Pointer Events sobre el gráfico (Bloque 6)
  const chartScrollRef = useRef<HTMLDivElement | null>(null);
  const panStateRef = useRef<{ active: boolean; x: number; y: number; left: number; top: number }>({
    active: false,
    x: 0,
    y: 0,
    left: 0,
    top: 0,
  });

  if (filetProjects.length === 0) {
    return (
      <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-6 shadow-[0_6px_0_#3A2E2B] space-y-3 text-center">
        <p className="text-sm font-black text-[#3A2E2B]">
          Aún no tienes proyectos de tejido vinculados a un patrón Filet.
        </p>
        <p className="text-xs text-[#795548] max-w-md mx-auto">
          Guarda una versión inmutable en la pestaña <strong>2. Compositor Visual</strong> y haz clic en{" "}
          <strong>Crear proyecto de tejido</strong> para abrirlo aquí con seguimiento guiado por fila y segmento.
        </p>
      </div>
    );
  }

  if (!activeProject || !progress || !summary || !activeRowView) {
    return null;
  }

  const syncMeta = SYNC_BADGE[progress.syncState];
  const cellPx = Math.max(8, Math.round((16 * zoomPct) / 100));

  // Calcular rango de columnas del segmento activo para resaltarlo en el gráfico
  const activeSegColRange = (() => {
    const seg = activeRowView.activeSegment;
    if (!seg || activeRowView.allSegmentsCompleted) return null;
    const totalCols = progress.snapshot.grid_width;
    let offset = 0;
    for (let i = 0; i < activeRowView.activeSegmentIndex; i++) {
      offset += activeRowView.segments[i]?.count || 0;
    }
    if (activeRowView.direction === "ltr") {
      return { startCol: offset, endCol: offset + seg.count - 1 };
    }
    const endCol = totalCols - 1 - offset;
    const startCol = Math.max(0, endCol - seg.count + 1);
    return { startCol, endCol };
  })();

  return (
    <div className="space-y-4">
      {notice && (
        <CozyNotification
          variant={notice.type}
          title={notice.type === "success" ? "Mesa Guiada" : "Aviso"}
          message={notice.message}
          onDismiss={() => setNotice(null)}
        />
      )}

      {/* Encabezado: selector de proyecto, versión inmutable, cronómetro existente y estado de sync */}
      <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-4 shadow-[0_6px_0_#3A2E2B] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Seleccionar proyecto Filet guiado"
                value={activeProject.id}
                onChange={(e) => {
                  setLocalSelectedId(e.target.value);
                  onSelectProject?.(e.target.value);
                }}
                className="rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-1.5 text-xs font-black text-[#3A2E2B]"
              >
                {filetProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (v{p.linked_filet_pattern?.version_number})
                  </option>
                ))}
              </select>
              <span className="rounded-full border border-[#3A2E2B]/40 bg-[#F4EEDC] px-2.5 py-0.5 text-[10px] font-black text-[#5C381E]">
                v{summary.patternVersionNumber} · {summary.gridWidth}×{summary.gridHeight} · Malla {summary.meshSize}
              </span>
              <span
                data-testid="guided-sync-badge"
                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black inline-flex items-center gap-1 ${syncMeta.className}`}
              >
                {progress.syncState === "synced_server" ? (
                  <Cloud className="h-3 w-3" />
                ) : (
                  <CloudOff className="h-3 w-3" />
                )}
                {syncMeta.label}
              </span>
            </div>
            <p className="text-[11px] text-[#795548]">
              Patrón inmutable: <strong>{summary.patternName}</strong> · Vuelta{" "}
              <strong>
                {summary.activeRowNumber} / {summary.totalRows}
              </strong>{" "}
              · Confirmadas: <strong>{summary.confirmedRowsCount}</strong> ({summary.progressPercent}%)
            </p>
          </div>

          {/* Cronómetro existente (puente a useUniversalSession — sin cronómetro paralelo) */}
          {sessionBridge && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-2">
              <span className="font-mono text-sm font-black text-[#3A2E2B] min-w-[64px] text-center">
                {sessionBridge.formattedTime}
              </span>
              {!sessionBridge.isActive ? (
                <CozyButton
                  size="sm"
                  variant="forest"
                  onClick={() => sessionBridge.onStartSession(activeProject)}
                >
                  <Play className="h-3.5 w-3.5 mr-1 inline" /> Iniciar sesión
                </CozyButton>
              ) : (
                <>
                  {sessionBridge.isRunning ? (
                    <CozyButton size="sm" variant="wood" onClick={sessionBridge.onPauseSession}>
                      <Pause className="h-3.5 w-3.5 mr-1 inline" /> Pausar
                    </CozyButton>
                  ) : (
                    <CozyButton size="sm" variant="forest" onClick={sessionBridge.onResumeSession}>
                      <Play className="h-3.5 w-3.5 mr-1 inline" /> Reanudar
                    </CozyButton>
                  )}
                  <CozyButton
                    size="sm"
                    variant="clay"
                    disabled={sessionBridge.submitting}
                    onClick={handleFinishGuidedSession}
                  >
                    Finalizar sesión
                  </CozyButton>
                </>
              )}
            </div>
          )}
        </div>

        {/* Barra de progreso total */}
        <div className="space-y-1">
          <div className="h-3 w-full rounded-full border-2 border-[#3A2E2B] bg-[#F4EEDC] overflow-hidden">
            <div
              className="h-full bg-[#314C3C] transition-all duration-300"
              style={{ width: `${summary.progressPercent}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-[#5C381E]">
            <span>
              Avance total: {summary.confirmedRowsCount}/{summary.totalRows} vueltas ({summary.progressPercent}%)
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Conmutador de 3 vistas */}
              <button
                type="button"
                onClick={() => setViewMode("chart")}
                className={`rounded-xl border-2 px-2.5 py-1 text-[11px] font-black cursor-pointer inline-flex items-center gap-1 ${
                  viewMode === "chart"
                    ? "border-[#3A2E2B] bg-[#3A2E2B] text-[#FFFDF8]"
                    : "border-[#3A2E2B]/30 bg-[#FFFDF8] text-[#5C381E]"
                }`}
              >
                <Grid3X3 className="h-3 w-3" /> Gráfico
              </button>
              <button
                type="button"
                onClick={() => setViewMode("instructions")}
                className={`rounded-xl border-2 px-2.5 py-1 text-[11px] font-black cursor-pointer inline-flex items-center gap-1 ${
                  viewMode === "instructions"
                    ? "border-[#3A2E2B] bg-[#3A2E2B] text-[#FFFDF8]"
                    : "border-[#3A2E2B]/30 bg-[#FFFDF8] text-[#5C381E]"
                }`}
              >
                <ListOrdered className="h-3 w-3" /> Instrucciones
              </button>
              <button
                type="button"
                onClick={() => setViewMode("both")}
                className={`rounded-xl border-2 px-2.5 py-1 text-[11px] font-black cursor-pointer inline-flex items-center gap-1 ${
                  viewMode === "both"
                    ? "border-[#3A2E2B] bg-[#3A2E2B] text-[#FFFDF8]"
                    : "border-[#3A2E2B]/30 bg-[#FFFDF8] text-[#5C381E]"
                }`}
              >
                <Columns2 className="h-3 w-3" /> Ambos
              </button>
              <button
                type="button"
                onClick={() => setSpeechEnabled((v) => !v)}
                title="Activar o desactivar lectura por voz nativa (SpeechSynthesis)"
                className={`rounded-xl border-2 px-2.5 py-1 text-[11px] font-black cursor-pointer inline-flex items-center gap-1 ${
                  speechEnabled
                    ? "border-[#314C3C] bg-[#314C3C] text-[#FFFDF8]"
                    : "border-[#3A2E2B]/30 bg-[#FFFDF8] text-[#5C381E]"
                }`}
              >
                {speechEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
                Voz
              </button>
              <button
                type="button"
                onClick={() => setShowClaraCard((v) => !v)}
                className="rounded-xl border-2 border-[#C88973] bg-[#FFFDF8] px-2.5 py-1 text-[11px] font-black text-[#8A3722] cursor-pointer inline-flex items-center gap-1"
              >
                <Sparkles className="h-3 w-3" /> Clara
              </button>
              {progress.pendingServerOperation && (
                <button
                  type="button"
                  disabled={syncingNow}
                  onClick={() => void submitGuidedRow(progress.pendingServerOperation!.action)}
                  className="rounded-xl border-2 border-[#314C3C] bg-[#E7D69C] px-2.5 py-1 text-[11px] font-black text-[#3A2E2B] cursor-pointer inline-flex items-center gap-1"
                >
                  <RefreshCw className={`h-3 w-3 ${syncingNow ? "animate-spin" : ""}`} />
                  Reintentar operación
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tarjeta determinista de Clara (Bloque 5) */}
        {showClaraCard && claraBriefing && (
          <div className="rounded-2xl border-2 border-[#C88973] bg-[#F4EEDC] p-3 text-xs text-[#3A2E2B] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-black text-[#8A3722]">
                🧶 Clara — Resumen determinista del patrón
              </span>
              <button
                type="button"
                onClick={() => speakText(claraBriefing.speechSummary)}
                className="text-[11px] font-black text-[#314C3C] underline cursor-pointer"
              >
                Leer en voz alta
              </button>
            </div>
            <p>
              <strong>Patrón:</strong> {claraBriefing.patternName} (v{claraBriefing.patternVersionNumber}, Malla {claraBriefing.meshSize}) ·{" "}
              <strong>Vuelta:</strong> {claraBriefing.activeRowNumber}/{claraBriefing.totalRows} ({claraBriefing.directionLabel})
            </p>
            <p>
              <strong>Segmento actual:</strong> {claraBriefing.activeSegmentText} ·{" "}
              <strong>Siguiente:</strong> {claraBriefing.nextSegmentText}
            </p>
            <p>
              <strong>Cuadros restantes en vuelta:</strong> {claraBriefing.remainingCellsInRow} ·{" "}
              <strong>Progreso total:</strong> {claraBriefing.progressPercent}% ·{" "}
              <strong>Tiempo registrado:</strong> {claraBriefing.recordedMinutes} min
            </p>
          </div>
        )}
      </div>

      {/* Cuerpo principal responsivo: vertical en iPhone, 2 columnas en tablet/computador */}
      <div
        className={`grid gap-4 ${
          viewMode === "both" ? "grid-cols-1 lg:grid-cols-12" : "grid-cols-1"
        }`}
      >
        {/* PANEL GRÁFICO (Pointer Events + Zoom + Resaltado de fila y segmento activos) */}
        {(viewMode === "chart" || viewMode === "both") && (
          <div
            className={`${
              viewMode === "both" ? "lg:col-span-7" : ""
            } rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-4 shadow-[0_6px_0_#3A2E2B] space-y-3`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-black uppercase text-[#3A2E2B]">
                Gráfico completo · Fila {activeRowView.rowNumber} resaltada
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Alejar gráfico"
                  onClick={() =>
                    setZoomPct((z) => {
                      const idx = GUIDED_ZOOMS.indexOf(z as (typeof GUIDED_ZOOMS)[number]);
                      return idx > 0 ? GUIDED_ZOOMS[idx - 1] : GUIDED_ZOOMS[0];
                    })
                  }
                  className="rounded-lg border border-[#3A2E2B] bg-[#F4EEDC] p-1.5 cursor-pointer"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="text-[11px] font-black text-[#3A2E2B] min-w-[42px] text-center">
                  {zoomPct}%
                </span>
                <button
                  type="button"
                  aria-label="Acercar gráfico"
                  onClick={() =>
                    setZoomPct((z) => {
                      const idx = GUIDED_ZOOMS.indexOf(z as (typeof GUIDED_ZOOMS)[number]);
                      return idx >= 0 && idx < GUIDED_ZOOMS.length - 1
                        ? GUIDED_ZOOMS[idx + 1]
                        : GUIDED_ZOOMS[GUIDED_ZOOMS.length - 1];
                    })
                  }
                  className="rounded-lg border border-[#3A2E2B] bg-[#F4EEDC] p-1.5 cursor-pointer"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div
              ref={chartScrollRef}
              onPointerDown={(e) => {
                const el = chartScrollRef.current;
                if (!el) return;
                panStateRef.current = {
                  active: true,
                  x: e.clientX,
                  y: e.clientY,
                  left: el.scrollLeft,
                  top: el.scrollTop,
                };
              }}
              onPointerMove={(e) => {
                if (!panStateRef.current.active || !chartScrollRef.current) return;
                chartScrollRef.current.scrollLeft =
                  panStateRef.current.left - (e.clientX - panStateRef.current.x);
                chartScrollRef.current.scrollTop =
                  panStateRef.current.top - (e.clientY - panStateRef.current.y);
              }}
              onPointerUp={() => {
                panStateRef.current.active = false;
              }}
              onPointerCancel={() => {
                panStateRef.current.active = false;
              }}
              className="max-h-[420px] overflow-auto rounded-2xl border-2 border-[#3A2E2B]/40 bg-[#F4EEDC] p-3 touch-pan-x touch-pan-y select-none"
            >
              <div className="inline-block">
                {progress.snapshot.matrix.map((row, mRowIdx) => {
                  const guidedRowNum =
                    progress.snapshot.orientation === "top_to_bottom"
                      ? mRowIdx + 1
                      : progress.totalRows - mRowIdx;
                  const isActiveRow = mRowIdx === activeRowView.matrixRowIndex;
                  const isConfirmed = progress.confirmedRows.includes(guidedRowNum);
                  return (
                    <div
                      key={mRowIdx}
                      className={`flex items-center ${
                        isActiveRow
                          ? "ring-2 ring-[#C88973] bg-[#E7D69C]/50 rounded-sm"
                          : isConfirmed
                            ? "opacity-55"
                            : ""
                      }`}
                    >
                      <span className="w-7 pr-1 text-right text-[9px] font-black text-[#5C381E] shrink-0">
                        {guidedRowNum}
                      </span>
                      <div className="flex">
                        {row.map((cell, cIdx) => {
                          const inActiveSegment =
                            isActiveRow &&
                            activeSegColRange !== null &&
                            cIdx >= activeSegColRange.startCol &&
                            cIdx <= activeSegColRange.endCol;
                          return (
                            <div
                              key={cIdx}
                              style={{ width: cellPx, height: cellPx }}
                              className={`border border-[#3A2E2B]/25 ${
                                cell === 1 ? "bg-[#3A2E2B]" : "bg-[#FFFDF8]"
                              } ${
                                inActiveSegment
                                  ? "ring-2 ring-inset ring-[#C88973] brightness-110"
                                  : ""
                              }`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* PANEL DE INSTRUCCIONES Y CONTROLES GRANDES (una mano en móvil + atajos de teclado) */}
        {(viewMode === "instructions" || viewMode === "both") && (
          <div
            className={`${
              viewMode === "both" ? "lg:col-span-5" : ""
            } rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-4 shadow-[0_6px_0_#3A2E2B] space-y-4`}
          >
            {/* Dirección y vuelta activa */}
            <div className="flex items-center justify-between rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-2.5">
              <div>
                <span className="text-[10px] font-black uppercase text-[#795548] block">
                  Vuelta activa
                </span>
                <span className="text-lg font-black text-[#3A2E2B]">
                  Vuelta {activeRowView.rowNumber} / {activeRowView.totalRows}
                </span>
              </div>
              <span className="inline-flex items-center gap-1 rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8] px-2.5 py-1 text-xs font-black text-[#3A2E2B]">
                {activeRowView.direction === "rtl" ? (
                  <>
                    <ArrowLeft className="h-3.5 w-3.5 text-[#C88973]" /> Der → Izq
                  </>
                ) : (
                  <>
                    Izq → Der <ArrowRight className="h-3.5 w-3.5 text-[#314C3C]" />
                  </>
                )}
              </span>
            </div>

            {/* Tarjeta gigante del segmento activo */}
            <div
              data-testid="guided-active-segment-card"
              className="rounded-3xl border-4 border-[#3A2E2B] bg-[#E7D69C]/40 p-4 text-center space-y-2"
            >
              {activeRowView.allSegmentsCompleted ? (
                <>
                  <span className="text-xs font-black uppercase text-[#314C3C]">
                    Todos los segmentos completados
                  </span>
                  <p className="text-xl font-black text-[#3A2E2B]">
                    ¡Lista para confirmar Vuelta {activeRowView.rowNumber}!
                  </p>
                </>
              ) : activeRowView.activeSegment ? (
                <>
                  <span className="text-[11px] font-black uppercase text-[#795548]">
                    Segmento {activeRowView.activeSegmentIndex + 1} de{" "}
                    {activeRowView.segments.length}
                  </span>
                  <p className="text-3xl font-black text-[#3A2E2B]">
                    {activeRowView.activeSegment.count}{" "}
                    {activeRowView.activeSegment.kind === "filled"
                      ? activeRowView.activeSegment.count === 1
                        ? "cuadro LLENO"
                        : "cuadros LLENOS"
                      : activeRowView.activeSegment.count === 1
                        ? "cuadro VACÍO"
                        : "cuadros VACÍOS"}
                  </p>
                  <p className="text-xs font-bold text-[#5C381E]">
                    {activeRowView.nextSegment
                      ? `Siguiente: ${activeRowView.nextSegment.count} ${
                          activeRowView.nextSegment.kind === "filled" ? "llenos" : "vacíos"
                        }`
                      : "Último segmento de esta vuelta"}
                    {" · "}Quedan {activeRowView.remainingCellsInRow} cuadros
                  </p>
                </>
              ) : null}
            </div>

            {/* Botón grande accesible con una mano (iPhone / Safari / Tablet) */}
            <div className="space-y-2.5">
              <button
                type="button"
                data-testid="guided-complete-segment-btn"
                disabled={activeRowView.allSegmentsCompleted || summary.confirmedRowsCount >= summary.totalRows}
                onClick={handleCompleteSegment}
                className="w-full min-h-[56px] rounded-2xl border-4 border-[#3A2E2B] bg-[#314C3C] px-4 py-3 text-base font-black text-[#FFFDF8] shadow-[0_4px_0_#3A2E2B] active:translate-y-0.5 disabled:opacity-45 cursor-pointer"
              >
                {activeRowView.allSegmentsCompleted
                  ? "Todos los segmentos completados"
                  : "Completar segmento (Espacio / Enter)"}
              </button>

              <button
                type="button"
                data-testid="guided-confirm-row-btn"
                disabled={syncingNow || !!progress.pendingServerOperation || !activeRowView.allSegmentsCompleted || activeRowView.isRowConfirmed}
                onClick={() => void handleConfirmRow()}
                className="w-full min-h-[52px] rounded-2xl border-4 border-[#3A2E2B] bg-[#C88973] px-4 py-3 text-sm font-black text-[#FFFDF8] shadow-[0_4px_0_#3A2E2B] active:translate-y-0.5 disabled:opacity-40 cursor-pointer inline-flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="h-5 w-5" />
                Confirmar Vuelta {activeRowView.rowNumber} (Tecla C)
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  data-testid="guided-step-back-btn"
                  onClick={() => handleStepBack(false)}
                  className="min-h-[44px] rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-2 text-xs font-black text-[#3A2E2B] cursor-pointer inline-flex items-center justify-center gap-1"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Retroceder segmento
                </button>
                <button
                  type="button"
                  disabled={syncingNow || !!progress.pendingServerOperation || progress.confirmedRows.length === 0}
                  onClick={() => handleStepBack(true)}
                  className="min-h-[44px] rounded-2xl border-2 border-[#3A2E2B]/50 bg-[#FFFDF8] px-3 py-2 text-xs font-black text-[#5C381E] disabled:opacity-40 cursor-pointer"
                >
                  Deshacer última vuelta
                </button>
              </div>
            </div>

            {/* Lista de segmentos de la vuelta activa */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase text-[#795548]">
                Secuencia de la vuelta ({activeRowView.totalCellsInRow} cuadros)
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {activeRowView.segments.map((seg, idx) => {
                  const done = activeRowView.completedSegmentIndices.includes(idx);
                  const current = idx === activeRowView.activeSegmentIndex && !done;
                  return (
                    <span
                      key={idx}
                      className={`rounded-xl border-2 px-2 py-1 text-[11px] font-black ${
                        done
                          ? "border-[#314C3C] bg-[#314C3C]/15 text-[#314C3C] line-through"
                          : current
                            ? "border-[#3A2E2B] bg-[#E7D69C] text-[#3A2E2B]"
                            : "border-[#3A2E2B]/25 bg-[#F4EEDC] text-[#5C381E]"
                      }`}
                    >
                      {seg.count} {seg.kind === "filled" ? "■" : "□"}
                    </span>
                  );
                })}
              </div>
            </div>

            {progress.lastError && (
              <div className="rounded-2xl border-2 border-[#8A3722] bg-[#C88973]/15 p-2.5 text-[11px] font-bold text-[#8A3722] flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{progress.lastError}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
