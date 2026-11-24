"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  CloudUpload,
  Crop,
  FlipHorizontal2,
  FlipVertical2,
  Grid3X3,
  History,
  ListOrdered,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Save,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
  Contrast,
} from "lucide-react";
import type { KnittingProject, LinkedFiletPatternSnapshot, SkillSessionRecord } from "@/types/rpg";
import { CozyButton, CozyNotification } from "@/components/cozy/ui";
import {
  FILET_MAX_GLYPH_DIM,
  FILET_MIN_DIM,
  cloneBinaryMatrix,
  createAlphabetCollection,
  createFiletGlyph,
  createMatrixHistory,
  cropMatrixToContent,
  flipMatrixHorizontal,
  flipMatrixVertical,
  generateFiletRowInstructions,
  invertMatrix,
  matricesEqual,
  pushMatrixHistory,
  redoMatrixHistory,
  resizeMatrix,
  restoreGlyphFromOriginal,
  rotateMatrix90CCW,
  rotateMatrix90CW,
  setMatrixCell,
  undoMatrixHistory,
  validateBinaryMatrix,
  type BinaryMatrix,
  type FiletAlphabetCollection,
  type FiletCell,
  type FiletGlyph,
  type FiletStudioWorkspace,
  type MatrixHistoryState,
} from "@/lib/sanctuary/filet-crochet-engine";
import {
  buildFiletStudioPrivateResourcePayload,
  readFiletStudioWorkspaceSafe,
  saveFiletStudioWorkspaceSafe,
} from "@/lib/sanctuary/filet-crochet-store";
import { FiletComposerPanel } from "@/components/sanctuary/filet-composer-panel";
import { FiletRestorePanel } from "@/components/sanctuary/filet-restore-panel";
import {
  FiletGuidedSession,
  type GuidedUniversalSessionBridge,
} from "@/components/sanctuary/filet-guided-session";

// Bloque 9: carga diferida del Digitalizador Histórico y el Panel de Exportaciones
const FiletHistoricalDigitizer = dynamic(
  () =>
    import("@/components/sanctuary/filet-historical-digitizer").then(
      (m) => m.FiletHistoricalDigitizer
    ),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-6 text-center text-xs font-bold text-[#795548]">
        Cargando Digitalizador Histórico (PDF.js local)...
      </div>
    ),
  }
);

const FiletExportPanel = dynamic(
  () =>
    import("@/components/sanctuary/filet-export-panel").then(
      (m) => m.FiletExportPanel
    ),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-6 text-center text-xs font-bold text-[#795548]">
        Cargando Motor de Exportaciones (PDF / SVG / PNG / JSON)...
      </div>
    ),
  }
);

interface FiletCrochetStudioProps {
  sessionOwner?: string;
  activeProject?: KnittingProject;
  projects?: KnittingProject[];
  sessions?: SkillSessionRecord[];
  initialStudioMode?: "alphabet" | "composer" | "backups" | "digitizer" | "guided" | "export";
  onSelectProject?: (projectId: string) => void;
  onCreateProjectFromPattern?: (params: {
    name: string;
    linkedPattern: LinkedFiletPatternSnapshot;
  }) => Promise<void>;
  onSubmitDirectSkillSession?: (payload: Record<string, unknown>) => Promise<unknown>;
  onRefreshState?: () => Promise<void>;
  sessionBridge?: GuidedUniversalSessionBridge;
}

type PaintTool = "toggle" | "fill" | "erase";

const ZOOM_LEVELS = [50, 75, 100, 125, 150, 175, 200] as const;

function MiniMatrixPreview({
  matrix,
  size = 64,
  label,
}: {
  matrix: BinaryMatrix;
  size?: number;
  label: string;
}) {
  const height = matrix.length || 1;
  const width = matrix[0]?.length || 1;
  const cell = Math.max(2, Math.floor(size / Math.max(width, height)));
  const svgW = width * cell;
  const svgH = height * cell;

  return (
    <svg
      width={svgW}
      height={svgH}
      viewBox={`0 0 ${svgW} ${svgH}`}
      role="img"
      aria-label={label}
      className="rounded border border-[#3A2E2B]/40 bg-[#FFFDF8] shrink-0"
    >
      {matrix.map((row, r) =>
        row.map((val, c) =>
          val === 1 ? (
            <rect
              key={`${r}-${c}`}
              x={c * cell}
              y={r * cell}
              width={cell}
              height={cell}
              fill="#3A2E2B"
            />
          ) : null
        )
      )}
    </svg>
  );
}

export function FiletCrochetStudio({
  sessionOwner,
  activeProject,
  projects = [],
  sessions = [],
  initialStudioMode = "alphabet",
  onSelectProject,
  onCreateProjectFromPattern,
  onSubmitDirectSkillSession,
  onRefreshState,
  sessionBridge,
}: FiletCrochetStudioProps) {
  const [studioMode, setStudioMode] = useState<
    "alphabet" | "composer" | "backups" | "digitizer" | "guided" | "export"
  >(initialStudioMode);

  useEffect(() => {
    setStudioMode(initialStudioMode);
  }, [initialStudioMode]);
  const [workspace, setWorkspace] = useState<FiletStudioWorkspace>(() =>
    readFiletStudioWorkspaceSafe(sessionOwner)
  );
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(
    () => workspace.collections[0]?.id || ""
  );
  const [selectedGlyphId, setSelectedGlyphId] = useState<string>(
    () => workspace.collections[0]?.glyphs[0]?.id || ""
  );

  // Recargar workspace aislado cuando cambia el propietario autenticado
  useEffect(() => {
    const loaded = readFiletStudioWorkspaceSafe(sessionOwner);
    setWorkspace(loaded);
    const firstCol = loaded.collections[0];
    setSelectedCollectionId(firstCol?.id || "");
    setSelectedGlyphId(firstCol?.glyphs[0]?.id || "");
  }, [sessionOwner]);

  const activeCollection = useMemo<FiletAlphabetCollection | undefined>(
    () =>
      workspace.collections.find((c) => c.id === selectedCollectionId) ||
      workspace.collections[0],
    [workspace.collections, selectedCollectionId]
  );

  const activeGlyph = useMemo<FiletGlyph | undefined>(
    () =>
      activeCollection?.glyphs.find((g) => g.id === selectedGlyphId) ||
      activeCollection?.glyphs[0],
    [activeCollection, selectedGlyphId]
  );

  // Historial Undo / Redo por glifo activo
  const [history, setHistory] = useState<MatrixHistoryState>(() =>
    createMatrixHistory(
      activeGlyph?.matrix || [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
    )
  );

  useEffect(() => {
    if (activeGlyph) {
      setHistory(createMatrixHistory(activeGlyph.matrix));
      setWidthInput(activeGlyph.width);
      setHeightInput(activeGlyph.height);
      setGlyphNotesDraft(activeGlyph.notes);
    }
  }, [activeGlyph?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Controles del editor
  const [zoomPct, setZoomPct] = useState<number>(100);
  const [paintTool, setPaintTool] = useState<PaintTool>("toggle");
  const [isPointerPainting, setIsPointerPainting] = useState(false);
  const [activeStrokeValue, setActiveStrokeValue] = useState<FiletCell>(1);
  const [widthInput, setWidthInput] = useState<number>(activeGlyph?.width || 7);
  const [heightInput, setHeightInput] = useState<number>(activeGlyph?.height || 9);
  const [glyphNotesDraft, setGlyphNotesDraft] = useState<string>(activeGlyph?.notes || "");
  const [showRowInstructions, setShowRowInstructions] = useState(false);

  // Formularios de nueva colección / nueva letra
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionDesc, setNewCollectionDesc] = useState("");
  const [newCollectionW, setNewCollectionW] = useState(7);
  const [newCollectionH, setNewCollectionH] = useState(9);

  const [isCreatingGlyph, setIsCreatingGlyph] = useState(false);
  const [newGlyphSymbol, setNewGlyphSymbol] = useState("");
  const [newGlyphLabel, setNewGlyphLabel] = useState("");
  const [newGlyphW, setNewGlyphW] = useState(activeCollection?.defaultWidth || 7);
  const [newGlyphH, setNewGlyphH] = useState(activeCollection?.defaultHeight || 9);
  const [newGlyphNotes, setNewGlyphNotes] = useState("");

  const [backingUpPrivate, setBackingUpPrivate] = useState(false);
  const [notice, setNotice] = useState<{
    type: "success" | "error" | "warning";
    message: string;
  } | null>(null);

  // Finalizar trazo de pintura al soltar puntero en cualquier lugar
  useEffect(() => {
    const stopPainting = () => setIsPointerPainting(false);
    window.addEventListener("pointerup", stopPainting);
    window.addEventListener("pointercancel", stopPainting);
    return () => {
      window.removeEventListener("pointerup", stopPainting);
      window.removeEventListener("pointercancel", stopPainting);
    };
  }, []);

  const persistWorkspace = useCallback(
    (nextWorkspace: FiletStudioWorkspace, silent = false) => {
      setWorkspace(nextWorkspace);
      const saved = saveFiletStudioWorkspaceSafe(sessionOwner, nextWorkspace);
      if (saved.ok) {
        setWorkspace(saved.workspace);
        if (!silent) {
          setNotice({
            type: "success",
            message: "Guardado de forma privada en tu Atelier.",
          });
        }
      } else if (!silent) {
        setNotice({
          type: "warning",
          message: saved.error || "Cambio mantenido en memoria (inicia sesión para persistir).",
        });
      }
      return saved;
    },
    [sessionOwner]
  );

  // Sincroniza una matriz editada al glifo activo sin tocar jamás `originalReference.originalMatrix`
  const syncMatrixIntoWorkspace = useCallback(
    (nextMatrix: BinaryMatrix, autoSave = true) => {
      if (!activeCollection || !activeGlyph) return;
      const nowIso = new Date().toISOString();
      const nextHeight = nextMatrix.length;
      const nextWidth = nextMatrix[0]?.length ?? activeGlyph.width;

      const nextWorkspace: FiletStudioWorkspace = {
        ...workspace,
        updatedAt: nowIso,
        collections: workspace.collections.map((col) => {
          if (col.id !== activeCollection.id) return col;
          return {
            ...col,
            updatedAt: nowIso,
            glyphs: col.glyphs.map((g) => {
              if (g.id !== activeGlyph.id) return g;
              return {
                ...g,
                width: nextWidth,
                height: nextHeight,
                matrix: cloneBinaryMatrix(nextMatrix),
                notes: glyphNotesDraft,
                originalReference: {
                  ...g.originalReference,
                  originalMatrix: cloneBinaryMatrix(g.originalReference.originalMatrix),
                },
                updatedAt: nowIso,
              };
            }),
          };
        }),
      };

      setWidthInput(nextWidth);
      setHeightInput(nextHeight);
      if (autoSave) {
        persistWorkspace(nextWorkspace, true);
      } else {
        setWorkspace(nextWorkspace);
      }
    },
    [activeCollection, activeGlyph, glyphNotesDraft, persistWorkspace, workspace]
  );

  const commitMatrixChange = useCallback(
    (nextMatrix: BinaryMatrix) => {
      setHistory((prev) => pushMatrixHistory(prev, nextMatrix));
      syncMatrixIntoWorkspace(nextMatrix, true);
    },
    [syncMatrixIntoWorkspace]
  );

  const handleUndo = useCallback(() => {
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;
      const undone = undoMatrixHistory(prev);
      syncMatrixIntoWorkspace(undone.present, true);
      return undone;
    });
  }, [syncMatrixIntoWorkspace]);

  const handleRedo = useCallback(() => {
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;
      const redone = redoMatrixHistory(prev);
      syncMatrixIntoWorkspace(redone.present, true);
      return redone;
    });
  }, [syncMatrixIntoWorkspace]);

  // Atajos de teclado Ctrl+Z / Ctrl+Y dentro del editor
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleUndo, handleRedo]);

  const handleCellPointerDown = (row: number, col: number) => {
    const currentVal = history.present[row]?.[col] ?? 0;
    const nextVal: FiletCell =
      paintTool === "fill" ? 1 : paintTool === "erase" ? 0 : currentVal === 1 ? 0 : 1;
    setActiveStrokeValue(nextVal);
    setIsPointerPainting(true);
    const updated = setMatrixCell(history.present, row, col, nextVal);
    commitMatrixChange(updated);
  };

  const handleCellPointerEnter = (row: number, col: number) => {
    if (!isPointerPainting) return;
    if (history.present[row]?.[col] === activeStrokeValue) return;
    const updated = setMatrixCell(history.present, row, col, activeStrokeValue);
    commitMatrixChange(updated);
  };

  const applyTransform = (label: string, fn: (m: BinaryMatrix) => BinaryMatrix) => {
    try {
      const next = fn(cloneBinaryMatrix(history.present));
      const check = validateBinaryMatrix(next, {
        maxWidth: FILET_MAX_GLYPH_DIM,
        maxHeight: FILET_MAX_GLYPH_DIM,
      });
      if (!check.valid) {
        setNotice({ type: "error", message: check.errors[0] || "Transformación inválida." });
        return;
      }
      commitMatrixChange(next);
      setNotice({
        type: "success",
        message: `${label} aplicada sobre copia de trabajo (matriz original intacta).`,
      });
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "No se pudo transformar la matriz.",
      });
    }
  };

  const handleApplyResize = (e: React.FormEvent) => {
    e.preventDefault();
    const w = Math.min(FILET_MAX_GLYPH_DIM, Math.max(FILET_MIN_DIM, Math.floor(widthInput)));
    const h = Math.min(FILET_MAX_GLYPH_DIM, Math.max(FILET_MIN_DIM, Math.floor(heightInput)));
    applyTransform(`Dimensión ${w}×${h}`, (m) => resizeMatrix(m, w, h, 0));
  };

  const handleRestoreOriginal = () => {
    if (!activeGlyph) return;
    const restoredGlyph = restoreGlyphFromOriginal(activeGlyph);
    commitMatrixChange(restoredGlyph.matrix);
    setNotice({
      type: "success",
      message: `Matriz original de "${activeGlyph.symbol}" restaurada desde su referencia.`,
    });
  };

  const handleCreateCollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;
    try {
      const w = Math.min(FILET_MAX_GLYPH_DIM, Math.max(FILET_MIN_DIM, Math.floor(newCollectionW)));
      const h = Math.min(FILET_MAX_GLYPH_DIM, Math.max(FILET_MIN_DIM, Math.floor(newCollectionH)));
      const initialGlyph = createFiletGlyph({
        symbol: "A",
        label: "Letra A",
        width: w,
        height: h,
        sourceType: "manual",
        sourceLabel: `Creada manualmente en ${newCollectionName.trim()}`,
      });
      const col = createAlphabetCollection({
        name: newCollectionName.trim(),
        description: newCollectionDesc.trim(),
        defaultWidth: w,
        defaultHeight: h,
        glyphs: [initialGlyph],
      });
      const nextWorkspace: FiletStudioWorkspace = {
        ...workspace,
        collections: [col, ...workspace.collections],
        updatedAt: new Date().toISOString(),
      };
      persistWorkspace(nextWorkspace, false);
      setSelectedCollectionId(col.id);
      setSelectedGlyphId(initialGlyph.id);
      setNewCollectionName("");
      setNewCollectionDesc("");
      setIsCreatingCollection(false);
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "No se pudo crear la colección.",
      });
    }
  };

  const handleCreateGlyph = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCollection || !newGlyphSymbol.trim()) return;
    try {
      const w = Math.min(FILET_MAX_GLYPH_DIM, Math.max(FILET_MIN_DIM, Math.floor(newGlyphW)));
      const h = Math.min(FILET_MAX_GLYPH_DIM, Math.max(FILET_MIN_DIM, Math.floor(newGlyphH)));
      const glyph = createFiletGlyph({
        symbol: newGlyphSymbol.trim().toUpperCase(),
        label: newGlyphLabel.trim() || `Letra ${newGlyphSymbol.trim().toUpperCase()}`,
        width: w,
        height: h,
        sourceType: "manual",
        sourceLabel: `Edición manual (${w}×${h})`,
        notes: newGlyphNotes.trim(),
      });
      const nowIso = new Date().toISOString();
      const nextWorkspace: FiletStudioWorkspace = {
        ...workspace,
        updatedAt: nowIso,
        collections: workspace.collections.map((col) =>
          col.id === activeCollection.id
            ? { ...col, glyphs: [...col.glyphs, glyph], updatedAt: nowIso }
            : col
        ),
      };
      persistWorkspace(nextWorkspace, false);
      setSelectedGlyphId(glyph.id);
      setNewGlyphSymbol("");
      setNewGlyphLabel("");
      setNewGlyphNotes("");
      setIsCreatingGlyph(false);
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "No se pudo crear la letra.",
      });
    }
  };

  const handleDeleteGlyph = (glyphId: string) => {
    if (!activeCollection || activeCollection.glyphs.length <= 1) {
      setNotice({
        type: "warning",
        message: "Conserva al menos un glifo en la colección.",
      });
      return;
    }
    const nowIso = new Date().toISOString();
    const remaining = activeCollection.glyphs.filter((g) => g.id !== glyphId);
    const nextWorkspace: FiletStudioWorkspace = {
      ...workspace,
      updatedAt: nowIso,
      collections: workspace.collections.map((col) =>
        col.id === activeCollection.id
          ? { ...col, glyphs: remaining, updatedAt: nowIso }
          : col
      ),
    };
    persistWorkspace(nextWorkspace, false);
    if (selectedGlyphId === glyphId && remaining[0]) {
      setSelectedGlyphId(remaining[0].id);
    }
  };

  const handleSaveNotesAndWorkspace = () => {
    syncMatrixIntoWorkspace(history.present, false);
    const nowIso = new Date().toISOString();
    if (!activeCollection || !activeGlyph) return;
    const nextWorkspace: FiletStudioWorkspace = {
      ...workspace,
      updatedAt: nowIso,
      collections: workspace.collections.map((col) =>
        col.id === activeCollection.id
          ? {
              ...col,
              updatedAt: nowIso,
              glyphs: col.glyphs.map((g) =>
                g.id === activeGlyph.id
                  ? {
                      ...g,
                      matrix: cloneBinaryMatrix(history.present),
                      width: history.present[0]?.length ?? g.width,
                      height: history.present.length,
                      notes: glyphNotesDraft,
                      updatedAt: nowIso,
                    }
                  : g
              ),
            }
          : col
      ),
    };
    persistWorkspace(nextWorkspace, false);
  };

  const handleBackupToPrivateAtelier = async () => {
    if (backingUpPrivate) return;
    setBackingUpPrivate(true);
    try {
      const payload = buildFiletStudioPrivateResourcePayload(workspace, {
        collectionId: activeCollection?.id,
        projectId: activeProject?.id || null,
      });
      const res = await fetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        duplicate?: boolean;
        sync_state?: string;
        error?: string;
      };
      if (res.status === 409 && json.duplicate) {
        setNotice({
          type: "warning",
          message: "Esta versión exacta ya está respaldada en tu Carpeta Privada del Atelier.",
        });
      } else if (!res.ok || !json.success) {
        setNotice({
          type: "error",
          message: json.error || `No se pudo respaldar (HTTP ${res.status}).`,
        });
      } else {
        setNotice({
          type: "success",
          message:
            json.sync_state === "SINCRONIZADO"
              ? "Colección respaldada en tu almacenamiento privado de Supabase (Atelier)."
              : "Colección guardada en el registro privado local del Atelier.",
        });
      }
    } catch {
      setNotice({
        type: "error",
        message: "Error de red al respaldar en la Carpeta Privada del Atelier.",
      });
    } finally {
      setBackingUpPrivate(false);
    }
  };

  const matrixStats = useMemo(
    () => validateBinaryMatrix(history.present, { maxWidth: FILET_MAX_GLYPH_DIM, maxHeight: FILET_MAX_GLYPH_DIM }),
    [history.present]
  );

  const isModifiedFromOriginal = useMemo(() => {
    if (!activeGlyph) return false;
    return !matricesEqual(history.present, activeGlyph.originalReference.originalMatrix);
  }, [activeGlyph, history.present]);

  const rowInstructions = useMemo(() => {
    if (!showRowInstructions || !matrixStats.valid) return [];
    return generateFiletRowInstructions(history.present, "rtl");
  }, [showRowInstructions, matrixStats.valid, history.present]);

  const cellPx = Math.max(14, Math.round((28 * zoomPct) / 100));
  const zoomIndex = ZOOM_LEVELS.indexOf(zoomPct as (typeof ZOOM_LEVELS)[number]);

  return (
    <div className="space-y-4">
      {/* Cabecera del Studio */}
      <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-[#795548] block">
              Módulo del Atelier de Clara · Cálculo 100% Determinista
            </span>
            <h3 className="text-base sm:text-lg font-black text-[#3A2E2B] flex items-center gap-2">
              <Grid3X3 className="h-5 w-5 text-[#314C3C]" />
              Filet Crochet Studio — Editor de Matrices y Alfabetos
            </h3>
            <p className="text-xs text-[#795548]">
              Crea letras manuales en cuadrícula binaria (0 = calada, 1 = llena), transforma copias sin alterar la matriz original y guarda de forma privada.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CozyButton
              type="button"
              variant="wood"
              size="sm"
              onClick={handleSaveNotesAndWorkspace}
              className="flex items-center gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              Guardar Local
            </CozyButton>
            <CozyButton
              type="button"
              variant="forest"
              size="sm"
              disabled={backingUpPrivate}
              onClick={handleBackupToPrivateAtelier}
              className="flex items-center gap-1.5"
            >
              <CloudUpload className="h-3.5 w-3.5" />
              {backingUpPrivate ? "Respaldando..." : "Respaldo Manual en Atelier"}
            </CozyButton>
          </div>
        </div>

        {/* Sub-navegación del Filet Crochet Studio */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {(
            [
              { id: "alphabet", label: "1. Editor de Alfabetos y Letras" },
              { id: "composer", label: "2. Compositor Visual y Motor Técnico" },
              { id: "backups", label: "3. Respaldos Privados y Restauración" },
              { id: "digitizer", label: "4. Digitalizador Histórico (PDF/Img)" },
              { id: "guided", label: "5. Mesa de Tejido Guiada" },
              { id: "export", label: "6. Exportaciones e Impresión" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStudioMode(tab.id)}
              className={`rounded-xl border-2 px-3 py-1.5 text-xs font-black cursor-pointer transition-colors ${
                studioMode === tab.id
                  ? "border-[#3A2E2B] bg-[#314C3C] text-[#FFFDF8] shadow-[0_2px_0_#1A2B20]"
                  : "border-[#3A2E2B]/35 bg-[#F4EEDC] text-[#3A2E2B] hover:bg-[#E7D69C]/60"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {studioMode === "alphabet" && (
          <>
        {/* Selector de Colección de Alfabetos */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#3A2E2B]/15">
          <label className="text-[11px] font-black text-[#3A2E2B]" htmlFor="filet-collection-select">
            Colección:
          </label>
          <select
            id="filet-collection-select"
            value={activeCollection?.id || ""}
            onChange={(e) => {
              const col = workspace.collections.find((c) => c.id === e.target.value);
              setSelectedCollectionId(e.target.value);
              setSelectedGlyphId(col?.glyphs[0]?.id || "");
            }}
            className="rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-1.5 text-xs font-bold text-[#3A2E2B] outline-none"
          >
            {workspace.collections.map((col) => (
              <option key={col.id} value={col.id}>
                {col.name} ({col.glyphs.length} glifo{col.glyphs.length === 1 ? "" : "s"})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setIsCreatingCollection((v) => !v)}
            className="inline-flex items-center gap-1 rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8] px-2.5 py-1.5 text-[11px] font-black text-[#3A2E2B] hover:bg-[#F4EEDC] cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Nueva Colección
          </button>

          <button
            type="button"
            onClick={() => {
              setNewGlyphW(activeCollection?.defaultWidth || 7);
              setNewGlyphH(activeCollection?.defaultHeight || 9);
              setIsCreatingGlyph((v) => !v);
            }}
            className="inline-flex items-center gap-1 rounded-xl border-2 border-[#3A2E2B] bg-[#E7D69C] px-2.5 py-1.5 text-[11px] font-black text-[#3A2E2B] hover:bg-[#F2E3B3] cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Nueva Letra Manual
          </button>
        </div>

        {isCreatingCollection && (
          <form
            onSubmit={handleCreateCollection}
            className="rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC] p-3 grid grid-cols-1 sm:grid-cols-4 gap-2"
          >
            <input
              type="text"
              required
              placeholder="Nombre colección (ej. Alfabeto Vintage) *"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              className="sm:col-span-2 rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8] px-3 py-1.5 text-xs font-bold text-[#3A2E2B] outline-none"
            />
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={FILET_MIN_DIM}
                max={FILET_MAX_GLYPH_DIM}
                value={newCollectionW}
                onChange={(e) => setNewCollectionW(Number(e.target.value))}
                aria-label="Ancho por defecto"
                className="w-16 rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8] px-2 py-1.5 text-xs font-bold text-[#3A2E2B]"
              />
              <span className="text-xs font-black text-[#795548]">×</span>
              <input
                type="number"
                min={FILET_MIN_DIM}
                max={FILET_MAX_GLYPH_DIM}
                value={newCollectionH}
                onChange={(e) => setNewCollectionH(Number(e.target.value))}
                aria-label="Alto por defecto"
                className="w-16 rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8] px-2 py-1.5 text-xs font-bold text-[#3A2E2B]"
              />
            </div>
            <div className="flex justify-end gap-1.5">
              <CozyButton type="submit" variant="forest" size="sm">
                Crear
              </CozyButton>
            </div>
            <input
              type="text"
              placeholder="Descripción breve (opcional)"
              value={newCollectionDesc}
              onChange={(e) => setNewCollectionDesc(e.target.value)}
              className="sm:col-span-4 rounded-xl border-2 border-[#3A2E2B]/50 bg-[#FFFDF8] px-3 py-1.5 text-xs text-[#3A2E2B] outline-none"
            />
          </form>
        )}

        {isCreatingGlyph && (
          <form
            onSubmit={handleCreateGlyph}
            className="rounded-2xl border-2 border-[#3A2E2B] bg-[#FFFBF2] p-3 grid grid-cols-1 sm:grid-cols-6 gap-2"
          >
            <input
              type="text"
              required
              maxLength={8}
              placeholder="Letra / Símbolo *"
              value={newGlyphSymbol}
              onChange={(e) => setNewGlyphSymbol(e.target.value)}
              className="rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8] px-3 py-1.5 text-xs font-black text-[#3A2E2B] outline-none"
            />
            <input
              type="text"
              placeholder="Etiqueta (ej. Letra M gótica)"
              value={newGlyphLabel}
              onChange={(e) => setNewGlyphLabel(e.target.value)}
              className="sm:col-span-2 rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8] px-3 py-1.5 text-xs font-bold text-[#3A2E2B] outline-none"
            />
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={FILET_MIN_DIM}
                max={FILET_MAX_GLYPH_DIM}
                value={newGlyphW}
                onChange={(e) => setNewGlyphW(Number(e.target.value))}
                aria-label="Columnas nueva letra"
                className="w-14 rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8] px-2 py-1.5 text-xs font-bold text-[#3A2E2B]"
              />
              <span className="text-xs font-black text-[#795548]">×</span>
              <input
                type="number"
                min={FILET_MIN_DIM}
                max={FILET_MAX_GLYPH_DIM}
                value={newGlyphH}
                onChange={(e) => setNewGlyphH(Number(e.target.value))}
                aria-label="Filas nueva letra"
                className="w-14 rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8] px-2 py-1.5 text-xs font-bold text-[#3A2E2B]"
              />
            </div>
            <input
              type="text"
              placeholder="Nota opcional"
              value={newGlyphNotes}
              onChange={(e) => setNewGlyphNotes(e.target.value)}
              className="rounded-xl border-2 border-[#3A2E2B]/50 bg-[#FFFDF8] px-2.5 py-1.5 text-xs text-[#3A2E2B]"
            />
            <div className="flex justify-end">
              <CozyButton type="submit" variant="forest" size="sm">
                Añadir Letra
              </CozyButton>
            </div>
          </form>
        )}
          </>
        )}
      </div>

      {notice && (
        <CozyNotification
          variant={notice.type}
          title={notice.type === "success" ? "Filet Studio" : "Aviso"}
          message={notice.message}
          onDismiss={() => setNotice(null)}
        />
      )}

      {studioMode === "composer" && (
        <FiletComposerPanel
          workspace={workspace}
          activeProject={activeProject}
          onPersistWorkspace={persistWorkspace}
          onJumpToAlphabetEditor={() => setStudioMode("alphabet")}
          onCreateProjectFromPattern={
            onCreateProjectFromPattern
              ? async (params) => {
                  await onCreateProjectFromPattern(params);
                  setStudioMode("guided");
                }
              : undefined
          }
        />
      )}

      {studioMode === "backups" && (
        <FiletRestorePanel
          sessionOwner={sessionOwner}
          workspace={workspace}
          activeProject={activeProject}
          onWorkspaceRestored={(restored) => {
            setWorkspace(restored);
            const firstCol = restored.collections[0];
            setSelectedCollectionId(firstCol?.id || "");
            setSelectedGlyphId(firstCol?.glyphs[0]?.id || "");
            if (firstCol?.glyphs[0]) {
              setHistory(createMatrixHistory(firstCol.glyphs[0].matrix));
            }
          }}
        />
      )}

      {studioMode === "digitizer" && (
        <FiletHistoricalDigitizer
          sessionOwner={sessionOwner}
          workspace={workspace}
          onPersistWorkspace={persistWorkspace}
          onJumpToComposer={() => setStudioMode("composer")}
        />
      )}

      {studioMode === "guided" && (
        <FiletGuidedSession
          sessionOwner={sessionOwner}
          projects={projects}
          selectedProjectId={activeProject?.id}
          sessions={sessions}
          onSelectProject={onSelectProject}
          onSubmitDirectSkillSession={onSubmitDirectSkillSession}
          onRefreshState={onRefreshState}
          sessionBridge={sessionBridge}
        />
      )}

      {studioMode === "export" && (
        <FiletExportPanel
          workspace={workspace}
          onPersistWorkspace={persistWorkspace}
        />
      )}

      {studioMode === "alphabet" && (
      /* Cuerpo principal: Lista de glifos + Editor de cuadrícula numerada */
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Columna izquierda: Glifos de la colección + Referencia original */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-4 shadow-[0_6px_0_#3A2E2B] space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase text-[#3A2E2B]">
                Glifos / Letras ({activeCollection?.glyphs.length || 0})
              </h4>
              <span className="text-[10px] font-bold text-[#795548]">
                Base {activeCollection?.defaultWidth}×{activeCollection?.defaultHeight}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
              {(activeCollection?.glyphs || []).map((g) => {
                const selected = g.id === activeGlyph?.id;
                return (
                  <div
                    key={g.id}
                    className={`rounded-2xl border-2 p-2 flex items-center justify-between gap-2 transition-colors ${
                      selected
                        ? "border-[#3A2E2B] bg-[#F4EEDC] ring-2 ring-[#314C3C]"
                        : "border-[#3A2E2B]/30 bg-[#FFFDF8] hover:bg-[#F4EEDC]/50"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedGlyphId(g.id)}
                      className="flex items-center gap-2 text-left min-w-0 flex-1 cursor-pointer"
                    >
                      <MiniMatrixPreview matrix={g.matrix} size={34} label={`Vista previa ${g.symbol}`} />
                      <div className="min-w-0">
                        <span className="text-sm font-black text-[#3A2E2B] block leading-tight truncate">
                          {g.symbol}
                        </span>
                        <span className="text-[10px] font-bold text-[#795548] block">
                          {g.width}×{g.height}
                        </span>
                      </div>
                    </button>
                    {(activeCollection?.glyphs.length || 0) > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteGlyph(g.id)}
                        aria-label={`Eliminar glifo ${g.symbol}`}
                        className="text-red-700 hover:text-red-900 p-1 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Panel de Referencia Original Inmutable */}
          {activeGlyph && (
            <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-4 shadow-[0_6px_0_#3A2E2B] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-black uppercase text-[#3A2E2B] flex items-center gap-1.5">
                  <History className="h-4 w-4 text-[#C88973]" />
                  Referencia Original Intacta
                </h4>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                    isModifiedFromOriginal
                      ? "bg-[#E7D69C] text-[#3A2E2B]"
                      : "bg-[#314C3C]/15 text-[#314C3C]"
                  }`}
                >
                  {isModifiedFromOriginal ? "Copia modificada" : "Idéntica al original"}
                </span>
              </div>

              <div className="flex items-start gap-3">
                <MiniMatrixPreview
                  matrix={activeGlyph.originalReference.originalMatrix}
                  size={68}
                  label={`Matriz original de ${activeGlyph.symbol}`}
                />
                <div className="text-[11px] text-[#5C381E] space-y-1 min-w-0">
                  <p className="font-black text-[#3A2E2B] truncate">
                    {activeGlyph.originalReference.label}
                  </p>
                  <p>
                    Origen: <strong>{activeGlyph.originalReference.sourceType}</strong> ·{" "}
                    {activeGlyph.originalReference.originalMatrix[0]?.length || 0}×
                    {activeGlyph.originalReference.originalMatrix.length}
                  </p>
                  <p className="text-[10px] text-[#795548]">
                    Las ediciones y transformaciones operan siempre sobre una copia de trabajo.
                  </p>
                </div>
              </div>

              {isModifiedFromOriginal && (
                <CozyButton
                  type="button"
                  variant="wood"
                  size="sm"
                  onClick={handleRestoreOriginal}
                  className="w-full"
                >
                  Restaurar desde Matriz Original
                </CozyButton>
              )}

              <div className="space-y-1 pt-2 border-t border-[#3A2E2B]/15">
                <label className="text-[11px] font-black text-[#3A2E2B] block" htmlFor="filet-glyph-notes">
                  Notas del glifo
                </label>
                <textarea
                  id="filet-glyph-notes"
                  rows={2}
                  value={glyphNotesDraft}
                  onChange={(e) => setGlyphNotesDraft(e.target.value)}
                  placeholder="Ej. Espaciado sugerido: 2 casillas caladas entre letras..."
                  className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] p-2 text-xs text-[#3A2E2B] outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Columna derecha: Editor interactivo de cuadrícula numerada */}
        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-4 sm:p-5 shadow-[0_6px_0_#3A2E2B] space-y-4">
            {/* Barra de herramientas: Pintura, Undo/Redo, Zoom, Dimensiones */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#3A2E2B]/15">
              {/* Modo de pincel */}
              <div className="flex items-center gap-1 rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] p-1">
                {(
                  [
                    { id: "toggle", label: "Alternar" },
                    { id: "fill", label: "■ Llena (1)" },
                    { id: "erase", label: "□ Calada (0)" },
                  ] as const
                ).map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => setPaintTool(tool.id)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-black cursor-pointer ${
                      paintTool === tool.id
                        ? "bg-[#314C3C] text-[#FFFDF8]"
                        : "text-[#3A2E2B] hover:bg-[#FFFDF8]"
                    }`}
                  >
                    {tool.label}
                  </button>
                ))}
              </div>

              {/* Undo / Redo */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={history.past.length === 0}
                  aria-label="Deshacer"
                  title="Deshacer (Ctrl+Z)"
                  className="inline-flex items-center gap-1 rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-2.5 py-1.5 text-[11px] font-black text-[#3A2E2B] disabled:opacity-40 cursor-pointer"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  Deshacer ({history.past.length})
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={history.future.length === 0}
                  aria-label="Rehacer"
                  title="Rehacer (Ctrl+Y)"
                  className="inline-flex items-center gap-1 rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-2.5 py-1.5 text-[11px] font-black text-[#3A2E2B] disabled:opacity-40 cursor-pointer"
                >
                  <Redo2 className="h-3.5 w-3.5" />
                  Rehacer ({history.future.length})
                </button>
              </div>

              {/* Zoom */}
              <div className="flex items-center gap-1 rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-2 py-1">
                <button
                  type="button"
                  aria-label="Alejar cuadrícula"
                  disabled={zoomIndex <= 0}
                  onClick={() => setZoomPct(ZOOM_LEVELS[Math.max(0, zoomIndex - 1)])}
                  className="p-1 text-[#3A2E2B] disabled:opacity-40 cursor-pointer"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="font-mono text-[11px] font-black text-[#3A2E2B] min-w-[40px] text-center">
                  {zoomPct}%
                </span>
                <button
                  type="button"
                  aria-label="Acercar cuadrícula"
                  disabled={zoomIndex >= ZOOM_LEVELS.length - 1}
                  onClick={() =>
                    setZoomPct(ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, zoomIndex + 1)])
                  }
                  className="p-1 text-[#3A2E2B] disabled:opacity-40 cursor-pointer"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Transformaciones puras + Redimensionamiento */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => applyTransform("Inversión", invertMatrix)}
                  className="inline-flex items-center gap-1 rounded-xl border border-[#3A2E2B]/50 bg-[#FFFBF2] px-2.5 py-1 text-[11px] font-bold text-[#3A2E2B] hover:bg-[#E7D69C]/40 cursor-pointer"
                >
                  <Contrast className="h-3.5 w-3.5" />
                  Invertir
                </button>
                <button
                  type="button"
                  onClick={() => applyTransform("Espejo horizontal", flipMatrixHorizontal)}
                  className="inline-flex items-center gap-1 rounded-xl border border-[#3A2E2B]/50 bg-[#FFFBF2] px-2.5 py-1 text-[11px] font-bold text-[#3A2E2B] hover:bg-[#E7D69C]/40 cursor-pointer"
                >
                  <FlipHorizontal2 className="h-3.5 w-3.5" />
                  Espejo H
                </button>
                <button
                  type="button"
                  onClick={() => applyTransform("Espejo vertical", flipMatrixVertical)}
                  className="inline-flex items-center gap-1 rounded-xl border border-[#3A2E2B]/50 bg-[#FFFBF2] px-2.5 py-1 text-[11px] font-bold text-[#3A2E2B] hover:bg-[#E7D69C]/40 cursor-pointer"
                >
                  <FlipVertical2 className="h-3.5 w-3.5" />
                  Espejo V
                </button>
                <button
                  type="button"
                  onClick={() => applyTransform("Rotación 90° horario", rotateMatrix90CW)}
                  className="inline-flex items-center gap-1 rounded-xl border border-[#3A2E2B]/50 bg-[#FFFBF2] px-2.5 py-1 text-[11px] font-bold text-[#3A2E2B] hover:bg-[#E7D69C]/40 cursor-pointer"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  90° CW
                </button>
                <button
                  type="button"
                  onClick={() => applyTransform("Rotación 90° antihorario", rotateMatrix90CCW)}
                  className="inline-flex items-center gap-1 rounded-xl border border-[#3A2E2B]/50 bg-[#FFFBF2] px-2.5 py-1 text-[11px] font-bold text-[#3A2E2B] hover:bg-[#E7D69C]/40 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  90° CCW
                </button>
                <button
                  type="button"
                  onClick={() => applyTransform("Recorte al contenido", (m) => cropMatrixToContent(m, 0))}
                  className="inline-flex items-center gap-1 rounded-xl border border-[#3A2E2B]/50 bg-[#FFFBF2] px-2.5 py-1 text-[11px] font-bold text-[#3A2E2B] hover:bg-[#E7D69C]/40 cursor-pointer"
                >
                  <Crop className="h-3.5 w-3.5" />
                  Recortar
                </button>
              </div>

              <form onSubmit={handleApplyResize} className="flex items-center gap-1.5 text-[11px]">
                <span className="font-black text-[#795548]">Cols×Filas:</span>
                <input
                  type="number"
                  min={FILET_MIN_DIM}
                  max={FILET_MAX_GLYPH_DIM}
                  value={widthInput}
                  onChange={(e) => setWidthInput(Number(e.target.value))}
                  aria-label="Ancho de cuadrícula"
                  className="w-12 rounded-lg border border-[#3A2E2B] bg-[#F4EEDC] px-1.5 py-1 font-mono font-bold text-[#3A2E2B]"
                />
                <span className="font-black text-[#795548]">×</span>
                <input
                  type="number"
                  min={FILET_MIN_DIM}
                  max={FILET_MAX_GLYPH_DIM}
                  value={heightInput}
                  onChange={(e) => setHeightInput(Number(e.target.value))}
                  aria-label="Alto de cuadrícula"
                  className="w-12 rounded-lg border border-[#3A2E2B] bg-[#F4EEDC] px-1.5 py-1 font-mono font-bold text-[#3A2E2B]"
                />
                <button
                  type="submit"
                  className="rounded-lg border border-[#3A2E2B] bg-[#314C3C] px-2 py-1 font-black text-[#FFFDF8] cursor-pointer"
                >
                  Aplicar
                </button>
              </form>
            </div>

            {/* Cuadrícula numerada interactiva (filas numeradas 1..H de abajo hacia arriba en orden Filet) */}
            <div className="overflow-auto rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC]/70 p-4 select-none touch-none">
              <div className="inline-block">
                {/* Encabezado de columnas numeradas 1..W */}
                <div className="flex items-center mb-1">
                  <div className="w-9 shrink-0 text-[10px] font-black text-[#795548] text-right pr-1.5">
                    V\C
                  </div>
                  {(history.present[0] || []).map((_, colIdx) => (
                    <div
                      key={`col-hdr-${colIdx}`}
                      style={{ width: cellPx }}
                      className="text-center font-mono text-[10px] font-bold text-[#795548] shrink-0"
                    >
                      {colIdx + 1}
                    </div>
                  ))}
                </div>

                {/* Filas de la matriz binaria */}
                {history.present.map((row, rowIdx) => {
                  const crochetRowNum = history.present.length - rowIdx;
                  return (
                    <div key={`row-${rowIdx}`} className="flex items-center">
                      <div
                        title={`Vuelta de tejido ${crochetRowNum} (fila matriz ${rowIdx + 1})`}
                        className="w-9 shrink-0 pr-1.5 text-right font-mono text-[10px] font-black text-[#5C381E]"
                      >
                        {crochetRowNum}
                      </div>
                      {row.map((cell, colIdx) => (
                        <button
                          key={`cell-${rowIdx}-${colIdx}`}
                          type="button"
                          onPointerDown={() => handleCellPointerDown(rowIdx, colIdx)}
                          onPointerEnter={() => handleCellPointerEnter(rowIdx, colIdx)}
                          aria-label={`Vuelta ${crochetRowNum}, columna ${colIdx + 1}: ${
                            cell === 1 ? "llena" : "calada"
                          }`}
                          aria-pressed={cell === 1}
                          style={{ width: cellPx, height: cellPx }}
                          className={`border border-[#3A2E2B]/35 transition-colors cursor-crosshair shrink-0 ${
                            cell === 1
                              ? "bg-[#3A2E2B] hover:bg-[#5C381E]"
                              : "bg-[#FFFDF8] hover:bg-[#E7D69C]/60"
                          }`}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Métricas deterministas + Vista previa de instrucciones por fila */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold text-[#5C381E]">
                <span>
                  Glifo: <strong className="text-[#3A2E2B]">{activeGlyph?.symbol || "—"}</strong>
                </span>
                <span>
                  Matriz: <strong>{matrixStats.width}×{matrixStats.height}</strong>
                </span>
                <span>
                  Llenas (1): <strong>{matrixStats.filledCount}</strong>
                </span>
                <span>
                  Caladas (0): <strong>{matrixStats.openCount}</strong>
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowRowInstructions((v) => !v)}
                className="inline-flex items-center gap-1.5 text-[11px] font-black text-[#314C3C] hover:underline cursor-pointer"
              >
                <ListOrdered className="h-3.5 w-3.5" />
                {showRowInstructions
                  ? "Ocultar instrucciones por vuelta"
                  : "Ver instrucciones deterministas por vuelta"}
              </button>
            </div>

            {showRowInstructions && rowInstructions.length > 0 && (
              <div className="rounded-2xl border-2 border-[#D8B48A] bg-[#FFFBF2] p-3 space-y-1.5 max-h-48 overflow-y-auto">
                <p className="text-[10px] font-black uppercase text-[#795548]">
                  Lectura alternada Filet Crochet (Vuelta 1 = base inferior, sin IA externa)
                </p>
                {rowInstructions.map((ins) => (
                  <p key={ins.rowNumber} className="font-mono text-[11px] text-[#3A2E2B]">
                    {ins.summary}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
