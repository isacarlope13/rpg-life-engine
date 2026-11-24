"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignHorizontalDistributeCenter,
  AlignLeft,
  AlignRight,
  FlipHorizontal2,
  FlipVertical2,
  GitBranch,
  Layers,
  ListOrdered,
  Move,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Save,
  Trash2,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { KnittingProject } from "@/types/rpg";
import { CozyButton, CozyNotification } from "@/components/cozy/ui";
import {
  FILET_MAX_PATTERN_DIM,
  FILET_MIN_DIM,
  alignPlacedGlyphs,
  appendPatternVersion,
  cloneComposerSnapshot,
  compileFiletTechnicalPattern,
  composePhraseOnCanvas,
  createComposerHistory,
  createDefaultCanvasSpec,
  createFiletTechnicalConvention,
  createVersionedPattern,
  movePlacedGlyph,
  pushComposerHistory,
  redoComposerHistory,
  renderComposedCanvas,
  resolvePlacedGlyphMatrix,
  transformPlacedGlyph,
  undoComposerHistory,
  type ComposerHistoryState,
  type FiletBorderStyle,
  type FiletCell,
  type FiletComposerDraft,
  type FiletComposerSnapshot,
  type FiletGlyph,
  type FiletHorizontalAlignment,
  type FiletMeshSize,
  type FiletMissingCharacter,
  type FiletPlacedGlyph,
  type FiletRowDirection,
  type FiletStudioWorkspace,
  type FiletVerticalAlignment,
} from "@/lib/sanctuary/filet-crochet-engine";

interface FiletComposerPanelProps {
  workspace: FiletStudioWorkspace;
  activeProject?: KnittingProject;
  onPersistWorkspace: (next: FiletStudioWorkspace, silent?: boolean) => void;
  onJumpToAlphabetEditor?: () => void;
}

const COMPOSER_ZOOM_LEVELS = [25, 40, 55, 75, 100, 125, 150, 200] as const;

export function FiletComposerPanel({
  workspace,
  activeProject,
  onPersistWorkspace,
  onJumpToAlphabetEditor,
}: FiletComposerPanelProps) {
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(
    () => workspace.collections[0]?.id || ""
  );
  const activeCollection = useMemo(
    () =>
      workspace.collections.find((c) => c.id === selectedCollectionId) ||
      workspace.collections[0],
    [workspace.collections, selectedCollectionId]
  );

  const glyphById = useMemo(() => {
    const map = new Map<string, FiletGlyph>();
    for (const col of workspace.collections) {
      for (const g of col.glyphs) {
        map.set(g.id, g);
      }
    }
    return map;
  }, [workspace.collections]);

  // Estado del compositor con Undo / Redo completo
  const [history, setHistory] = useState<ComposerHistoryState>(() =>
    createComposerHistory({
      canvas: createDefaultCanvasSpec(80, 24),
      placements: [],
      cellOverrides: {},
    })
  );

  const snapshot = history.present;
  const [phrase, setPhrase] = useState<string>("");
  const [letterSpacingCols, setLetterSpacingCols] = useState<number>(1);
  const [wordSpacingCols, setWordSpacingCols] = useState<number>(4);
  const [lineSpacingRows, setLineSpacingRows] = useState<number>(2);
  const [alignment, setAlignment] = useState<FiletHorizontalAlignment>("center");
  const [verticalAlignment, setVerticalAlignment] = useState<FiletVerticalAlignment>("center");
  const [missingChars, setMissingChars] = useState<FiletMissingCharacter[]>([]);
  const [explicitSubstitutions, setExplicitSubstitutions] = useState<Record<string, string>>({});

  // Modo de interacción: arrastrar glifos o pintar celdas
  const [mode, setMode] = useState<"glyph" | "paint">("glyph");
  const [paintValue, setPaintValue] = useState<"toggle" | 1 | 0>("toggle");
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [focusedCell, setFocusedCell] = useState<{ row: number; col: number }>({ row: 0, col: 0 });
  const [zoomPct, setZoomPct] = useState<number>(55);

  // Arrastre con ajuste exacto a cuadrícula
  const dragRef = useRef<{
    instanceId: string;
    startClientX: number;
    startClientY: number;
    originX: number;
    originY: number;
    lastSnappedX: number;
    lastSnappedY: number;
  } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Borradores y versiones inmutables
  const [patternTitle, setPatternTitle] = useState<string>(
    () => activeProject?.name ? `Filet — ${activeProject.name}` : "Patrón Filet Personal"
  );
  const [versionNote, setVersionNote] = useState<string>("");
  const [selectedPatternId, setSelectedPatternId] = useState<string>(
    () => workspace.patterns[0]?.id || ""
  );

  // Motor técnico (Bloque 3)
  const [meshSize, setMeshSize] = useState<FiletMeshSize>(3);
  const [firstRowDirection, setFirstRowDirection] = useState<FiletRowDirection>("rtl");
  const [showTechnicalPanel, setShowTechnicalPanel] = useState<boolean>(true);
  const [notice, setNotice] = useState<{ type: "success" | "warning" | "error"; message: string } | null>(
    null
  );

  const commitSnapshot = useCallback((next: FiletComposerSnapshot) => {
    setHistory((prev) => pushComposerHistory(prev, next));
  }, []);

  const handleUndo = useCallback(() => {
    setHistory((prev) => undoComposerHistory(prev));
  }, []);

  const handleRedo = useCallback(() => {
    setHistory((prev) => redoComposerHistory(prev));
  }, []);

  // Render determinista del lienzo compuesto
  const rendered = useMemo(
    () =>
      renderComposedCanvas(
        snapshot.canvas,
        snapshot.placements,
        glyphById,
        snapshot.cellOverrides
      ),
    [snapshot.canvas, snapshot.placements, glyphById, snapshot.cellOverrides]
  );

  const technicalPlan = useMemo(() => {
    if (!showTechnicalPanel) return null;
    try {
      const convention = createFiletTechnicalConvention(meshSize, firstRowDirection);
      return compileFiletTechnicalPattern(rendered.matrix, convention);
    } catch {
      return null;
    }
  }, [showTechnicalPanel, rendered.matrix, meshSize, firstRowDirection]);

  const selectedPlacement = useMemo(
    () => snapshot.placements.find((p) => p.instanceId === selectedInstanceId) || null,
    [snapshot.placements, selectedInstanceId]
  );

  const cellPx = Math.max(8, Math.round((24 * zoomPct) / 100));
  const zoomIndex = COMPOSER_ZOOM_LEVELS.indexOf(
    zoomPct as (typeof COMPOSER_ZOOM_LEVELS)[number]
  );

  // Ejecutar composición de frase/nombre sin sustitución silenciosa
  const runPhraseComposition = (subsOverride?: Record<string, string>) => {
    if (!activeCollection) return;
    const subs = subsOverride ?? explicitSubstitutions;
    const result = composePhraseOnCanvas({
      collection: activeCollection,
      phrase,
      canvas: snapshot.canvas,
      letterSpacingCols,
      wordSpacingCols,
      lineSpacingRows,
      alignment,
      verticalAlignment,
      explicitSubstitutions: subs,
    });

    setMissingChars(result.missingCharacters);
    commitSnapshot({
      canvas: { ...snapshot.canvas },
      placements: result.placements,
      cellOverrides: {},
    });
    setSelectedInstanceId(result.placements[0]?.instanceId || null);

    if (result.missingCharacters.length > 0) {
      const uniqueMissing = Array.from(new Set(result.missingCharacters.map((m) => m.char)));
      setNotice({
        type: "warning",
        message: `Faltan ${uniqueMissing.length} carácter(es) en "${activeCollection.name}": ${uniqueMissing.join(", ")}. Ninguno fue sustituido silenciosamente; elige una alternativa explícita o créalo manualmente.`,
      });
    } else if (result.overflow.hasOverflow) {
      setNotice({
        type: "warning",
        message: `Desbordamiento detectado: se requieren al menos ${result.overflow.requiredWidth}×${result.overflow.requiredHeight} cuadros.`,
      });
    } else {
      setNotice({
        type: "success",
        message: `Composición aplicada (${result.placements.length} glifo(s)) sobre lienzo ${snapshot.canvas.width}×${snapshot.canvas.height}.`,
      });
    }
  };

  // Insertar un glifo individual desde el alfabeto
  const handleAddSingleGlyph = (glyph: FiletGlyph) => {
    const borderPad = snapshot.canvas.borderStyle === "none" ? 0 : snapshot.canvas.borderThickness;
    const newItem: FiletPlacedGlyph = {
      instanceId: `placed_manual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      glyphId: glyph.id,
      symbol: glyph.symbol,
      x: Math.max(0, snapshot.canvas.marginLeft + borderPad),
      y: Math.max(0, snapshot.canvas.marginTop + borderPad),
      rotation: 0,
      flipH: false,
      flipV: false,
      scaleX: 1,
      scaleY: 1,
    };
    commitSnapshot({
      ...cloneComposerSnapshot(snapshot),
      placements: [...snapshot.placements, newItem],
    });
    setSelectedInstanceId(newItem.instanceId);
    setMode("glyph");
  };

  // Arrastre de glifos con ajuste exacto a cuadrícula
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dxCells = Math.round((e.clientX - drag.startClientX) / cellPx);
      const dyCells = Math.round((e.clientY - drag.startClientY) / cellPx);
      const nextX = drag.originX + dxCells;
      const nextY = drag.originY + dyCells;
      if (nextX === drag.lastSnappedX && nextY === drag.lastSnappedY) return;
      drag.lastSnappedX = nextX;
      drag.lastSnappedY = nextY;
      setHistory((prev) => ({
        ...prev,
        present: {
          ...prev.present,
          placements: movePlacedGlyph(prev.present.placements, drag.instanceId, nextX, nextY),
        },
      }));
    };

    const onPointerUp = () => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      setDraggingId(null);
      if (drag.lastSnappedX !== drag.originX || drag.lastSnappedY !== drag.originY) {
        // Registrar el estado previo al arrastre en el historial Undo
        setHistory((prev) => {
          const beforeDrag: FiletComposerSnapshot = {
            ...cloneComposerSnapshot(prev.present),
            placements: movePlacedGlyph(
              prev.present.placements,
              drag.instanceId,
              drag.originX,
              drag.originY
            ),
          };
          const nextPast = [...prev.past, beforeDrag];
          if (nextPast.length > prev.maxDepth) {
            nextPast.splice(0, nextPast.length - prev.maxDepth);
          }
          return { ...prev, past: nextPast, future: [] };
        });
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [cellPx]);

  // Edición de celdas manuales sobre el lienzo compuesto
  const toggleComposedCell = useCallback(
    (row: number, col: number) => {
      const current = rendered.matrix[row]?.[col] ?? 0;
      const nextVal: FiletCell =
        paintValue === "toggle" ? (current === 1 ? 0 : 1) : paintValue;
      const nextOverrides: Record<string, FiletCell> = {
        ...snapshot.cellOverrides,
        [`${row},${col}`]: nextVal,
      };
      commitSnapshot({
        ...cloneComposerSnapshot(snapshot),
        cellOverrides: nextOverrides,
      });
    },
    [rendered.matrix, paintValue, snapshot, commitSnapshot]
  );

  // Teclado sobre el lienzo: flechas mueven glifo o cursor de celda; Espacio/Enter alterna celda; Ctrl+Z/Y undo/redo
  const handleCanvasKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) handleRedo();
      else handleUndo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
      e.preventDefault();
      handleRedo();
      return;
    }

    const deltas: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    };
    const delta = deltas[e.key];
    if (delta) {
      e.preventDefault();
      if (mode === "glyph" && selectedPlacement) {
        commitSnapshot({
          ...cloneComposerSnapshot(snapshot),
          placements: movePlacedGlyph(
            snapshot.placements,
            selectedPlacement.instanceId,
            selectedPlacement.x + delta[0],
            selectedPlacement.y + delta[1]
          ),
        });
      } else {
        setFocusedCell((prev) => ({
          row: Math.min(snapshot.canvas.height - 1, Math.max(0, prev.row + delta[1])),
          col: Math.min(snapshot.canvas.width - 1, Math.max(0, prev.col + delta[0])),
        }));
      }
      return;
    }

    if (mode === "paint" && (e.key === " " || e.key === "Enter")) {
      e.preventDefault();
      toggleComposedCell(focusedCell.row, focusedCell.col);
    }
  };

  // Transformaciones sobre copia del glifo seleccionado
  const handleGlyphTransform = (
    op:
      | { type: "rotate_cw" }
      | { type: "rotate_ccw" }
      | { type: "flip_h" }
      | { type: "flip_v" }
      | { type: "scale"; scaleX: number; scaleY?: number }
  ) => {
    if (!selectedInstanceId) return;
    try {
      commitSnapshot({
        ...cloneComposerSnapshot(snapshot),
        placements: transformPlacedGlyph(snapshot.placements, selectedInstanceId, op),
      });
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "No se pudo transformar el glifo.",
      });
    }
  };

  const handleAlign = (
    alignMode: "left" | "center_x" | "right" | "top" | "center_y" | "bottom" | "distribute_x"
  ) => {
    const targetIds =
      alignMode === "distribute_x"
        ? undefined
        : selectedInstanceId
        ? [selectedInstanceId]
        : undefined;
    commitSnapshot({
      ...cloneComposerSnapshot(snapshot),
      placements: alignPlacedGlyphs(
        snapshot.placements,
        glyphById,
        snapshot.canvas,
        alignMode,
        targetIds
      ),
    });
  };

  const handleDeleteSelectedPlacement = () => {
    if (!selectedInstanceId) return;
    commitSnapshot({
      ...cloneComposerSnapshot(snapshot),
      placements: snapshot.placements.filter((p) => p.instanceId !== selectedInstanceId),
    });
    setSelectedInstanceId(null);
  };

  // Guardar borrador editable
  const handleSaveDraft = () => {
    const nowIso = new Date().toISOString();
    const draft: FiletComposerDraft = {
      id: `draft_${Date.now()}`,
      title: patternTitle.trim() || "Borrador Filet",
      alphabetCollectionId: activeCollection?.id || "",
      phrase,
      letterSpacingCols,
      wordSpacingCols,
      lineSpacingRows,
      alignment,
      verticalAlignment,
      snapshot: cloneComposerSnapshot(snapshot),
      updatedAt: nowIso,
    };
    const nextWorkspace: FiletStudioWorkspace = {
      ...workspace,
      drafts: [draft, ...(workspace.drafts || []).slice(0, 19)],
      updatedAt: nowIso,
    };
    onPersistWorkspace(nextWorkspace, false);
    setNotice({ type: "success", message: `Borrador "${draft.title}" guardado en local.` });
  };

  // Guardar versión inmutable (v1, v2, ...)
  const handleSaveImmutableVersion = () => {
    const nowIso = new Date().toISOString();
    const existing = workspace.patterns.find((p) => p.id === selectedPatternId);
    let nextPatterns = workspace.patterns;
    let savedVersionNum = 1;

    if (existing) {
      const updated = {
        ...appendPatternVersion(
          existing,
          rendered.matrix,
          versionNote.trim() || `Versión ${existing.currentVersion + 1}`,
          nowIso
        ),
        composerSnapshot: cloneComposerSnapshot(snapshot),
      };
      savedVersionNum = updated.currentVersion;
      nextPatterns = workspace.patterns.map((p) => (p.id === existing.id ? updated : p));
    } else {
      const created = {
        ...createVersionedPattern({
          title: patternTitle.trim() || "Patrón Filet",
          matrix: rendered.matrix,
          linkedProjectId: activeProject?.id,
          note: versionNote.trim() || "Versión inicial v1",
          composition: {
            alphabetCollectionId: activeCollection?.id,
            text: phrase,
            letterSpacingCols,
            lineSpacingRows,
            borderPadding: snapshot.canvas.marginLeft,
            alignment: alignment === "distribute" ? "center" : alignment,
          },
          nowIso,
        }),
        composerSnapshot: cloneComposerSnapshot(snapshot),
      };
      setSelectedPatternId(created.id);
      nextPatterns = [created, ...workspace.patterns];
    }

    onPersistWorkspace(
      {
        ...workspace,
        patterns: nextPatterns,
        updatedAt: nowIso,
      },
      false
    );
    setVersionNote("");
    setNotice({
      type: "success",
      message: `Versión inmutable v${savedVersionNum} guardada (${rendered.matrix[0]?.length}×${rendered.matrix.length} cuadros).`,
    });
  };

  const handleLoadDraft = (draft: FiletComposerDraft) => {
    if (draft.alphabetCollectionId) setSelectedCollectionId(draft.alphabetCollectionId);
    setPhrase(draft.phrase);
    setLetterSpacingCols(draft.letterSpacingCols);
    setWordSpacingCols(draft.wordSpacingCols);
    setLineSpacingRows(draft.lineSpacingRows);
    setAlignment(draft.alignment);
    setVerticalAlignment(draft.verticalAlignment);
    setPatternTitle(draft.title);
    setHistory(createComposerHistory(draft.snapshot));
    setSelectedInstanceId(draft.snapshot.placements[0]?.instanceId || null);
    setNotice({ type: "success", message: `Borrador "${draft.title}" cargado en el lienzo.` });
  };

  const uniqueMissingChars = useMemo(
    () => Array.from(new Set(missingChars.map((m) => m.char))),
    [missingChars]
  );

  const selectedPattern = useMemo(
    () => workspace.patterns.find((p) => p.id === selectedPatternId) || null,
    [workspace.patterns, selectedPatternId]
  );

  // Coordenadas para pintar el recuadro de cada glifo colocado
  const placedBoxes = useMemo(() => {
    return snapshot.placements.map((p) => {
      const g = glyphById.get(p.glyphId);
      const m = g ? resolvePlacedGlyphMatrix(p, g) : [[0 as FiletCell]];
      return {
        placement: p,
        width: m[0]?.length ?? 1,
        height: m.length || 1,
      };
    });
  }, [snapshot.placements, glyphById]);

  const updateCanvasField = <K extends keyof FiletComposerSnapshot["canvas"]>(
    key: K,
    val: FiletComposerSnapshot["canvas"][K]
  ) => {
    commitSnapshot({
      ...cloneComposerSnapshot(snapshot),
      canvas: {
        ...snapshot.canvas,
        [key]: val,
      },
    });
  };

  return (
    <div className="space-y-4">
      {notice && (
        <CozyNotification
          variant={notice.type}
          title="Compositor Filet"
          message={notice.message}
          onDismiss={() => setNotice(null)}
        />
      )}

      {/* Panel 1: Configuración de Lienzo y Composición Automática */}
      <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-4 sm:p-5 shadow-[0_6px_0_#3A2E2B] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-[#795548] block">
              Bloque 1 · Compositor Visual Determinista
            </span>
            <h4 className="text-sm sm:text-base font-black text-[#3A2E2B] flex items-center gap-2">
              <Type className="h-4 w-4 text-[#314C3C]" />
              Lienzo, Nombres/Frases y Versionado Inmutable
            </h4>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <select
              aria-label="Seleccionar colección de alfabeto para componer"
              value={activeCollection?.id || ""}
              onChange={(e) => setSelectedCollectionId(e.target.value)}
              className="rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-2.5 py-1.5 text-xs font-bold text-[#3A2E2B]"
            >
              {workspace.collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.glyphs.length})
                </option>
              ))}
            </select>

            <CozyButton type="button" variant="wood" size="sm" onClick={handleSaveDraft}>
              <Save className="h-3.5 w-3.5 mr-1 inline" />
              Guardar Borrador
            </CozyButton>
            <CozyButton type="button" variant="forest" size="sm" onClick={handleSaveImmutableVersion}>
              <GitBranch className="h-3.5 w-3.5 mr-1 inline" />
              Guardar Versión Inmutable
            </CozyButton>
          </div>
        </div>

        {/* Composición automática de frases / nombres */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 rounded-2xl border-2 border-[#D8B48A] bg-[#FFFBF2] p-3">
          <div className="lg:col-span-5 space-y-1">
            <label htmlFor="filet-phrase-input" className="text-[11px] font-black text-[#3A2E2B] block">
              Nombre o frase a componer (multilínea soportada)
            </label>
            <textarea
              id="filet-phrase-input"
              rows={2}
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder="Ej. Baby Lucio"
              className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8] px-3 py-1.5 text-xs font-bold text-[#3A2E2B] outline-none"
            />
          </div>

          <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <label className="space-y-0.5 font-bold text-[#5C381E]">
              <span>Sep. letras</span>
              <input
                type="number"
                min={0}
                max={12}
                value={letterSpacingCols}
                onChange={(e) => setLetterSpacingCols(Number(e.target.value))}
                className="w-full rounded-lg border border-[#3A2E2B] bg-[#FFFDF8] px-2 py-1 font-mono font-bold text-[#3A2E2B]"
              />
            </label>
            <label className="space-y-0.5 font-bold text-[#5C381E]">
              <span>Sep. palabras</span>
              <input
                type="number"
                min={1}
                max={24}
                value={wordSpacingCols}
                onChange={(e) => setWordSpacingCols(Number(e.target.value))}
                className="w-full rounded-lg border border-[#3A2E2B] bg-[#FFFDF8] px-2 py-1 font-mono font-bold text-[#3A2E2B]"
              />
            </label>
            <label className="space-y-0.5 font-bold text-[#5C381E]">
              <span>Alineación H</span>
              <select
                value={alignment}
                onChange={(e) => setAlignment(e.target.value as FiletHorizontalAlignment)}
                className="w-full rounded-lg border border-[#3A2E2B] bg-[#FFFDF8] px-1.5 py-1 font-bold text-[#3A2E2B]"
              >
                <option value="left">Izquierda</option>
                <option value="center">Centro</option>
                <option value="right">Derecha</option>
                <option value="distribute">Distribuir</option>
              </select>
            </label>
            <label className="space-y-0.5 font-bold text-[#5C381E]">
              <span>Alineación V</span>
              <select
                value={verticalAlignment}
                onChange={(e) => setVerticalAlignment(e.target.value as FiletVerticalAlignment)}
                className="w-full rounded-lg border border-[#3A2E2B] bg-[#FFFDF8] px-1.5 py-1 font-bold text-[#3A2E2B]"
              >
                <option value="top">Arriba</option>
                <option value="center">Centro</option>
                <option value="bottom">Abajo</option>
              </select>
            </label>
          </div>

          <div className="lg:col-span-2 flex items-end">
            <CozyButton
              type="button"
              variant="forest"
              size="sm"
              onClick={() => runPhraseComposition()}
              className="w-full"
            >
              Componer ➜
            </CozyButton>
          </div>
        </div>

        {/* Alerta explícita de caracteres faltantes (NUNCA sustitución silenciosa) */}
        {uniqueMissingChars.length > 0 && (
          <div
            role="alert"
            className="rounded-2xl border-2 border-amber-700 bg-amber-50 p-3 space-y-2 text-xs text-amber-950"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-black flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
                Caracteres faltantes en &ldquo;{activeCollection?.name}&rdquo; (sin sustitución automática):
              </p>
              {onJumpToAlphabetEditor && (
                <button
                  type="button"
                  onClick={onJumpToAlphabetEditor}
                  className="text-[11px] font-black text-[#314C3C] underline cursor-pointer shrink-0"
                >
                  Crear letra manual ➜
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {uniqueMissingChars.map((ch) => (
                <div
                  key={ch}
                  className="flex items-center gap-1.5 rounded-xl border border-amber-700/40 bg-white px-2.5 py-1"
                >
                  <span className="font-mono font-black text-amber-900">&ldquo;{ch}&rdquo;</span>
                  <span className="text-[10px] text-amber-800">Alternativa:</span>
                  <select
                    aria-label={`Alternativa para ${ch}`}
                    value={explicitSubstitutions[ch] || ""}
                    onChange={(e) => {
                      const nextSubs = { ...explicitSubstitutions };
                      if (e.target.value) nextSubs[ch] = e.target.value;
                      else delete nextSubs[ch];
                      setExplicitSubstitutions(nextSubs);
                    }}
                    className="rounded border border-amber-700/50 bg-amber-50 px-1.5 py-0.5 text-[11px] font-bold"
                  >
                    <option value="">Omitir</option>
                    {(activeCollection?.glyphs || []).map((g) => (
                      <option key={g.id} value={g.symbol}>
                        {g.symbol} ({g.width}×{g.height})
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              <button
                type="button"
                onClick={() => runPhraseComposition(explicitSubstitutions)}
                className="rounded-xl border-2 border-[#3A2E2B] bg-[#E7D69C] px-3 py-1 text-[11px] font-black text-[#3A2E2B] cursor-pointer"
              >
                Re-componer con alternativas elegidas
              </button>
            </div>
          </div>
        )}

        {/* Alerta explícita de desbordamiento */}
        {rendered.overflow.hasOverflow && (
          <div
            role="alert"
            className="rounded-2xl border-2 border-rose-700 bg-rose-50 p-3 text-xs font-bold text-rose-900 flex flex-wrap items-center justify-between gap-2"
          >
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-rose-700 shrink-0" />
              Desbordamiento de lienzo: {rendered.overflow.overflowItems.length} glifo(s) exceden {snapshot.canvas.width}×{snapshot.canvas.height} (se sugieren al menos {rendered.overflow.requiredWidth}×{rendered.overflow.requiredHeight} cuadros).
            </span>
            <button
              type="button"
              onClick={() =>
                commitSnapshot({
                  ...cloneComposerSnapshot(snapshot),
                  canvas: {
                    ...snapshot.canvas,
                    width: Math.min(FILET_MAX_PATTERN_DIM, rendered.overflow.requiredWidth + snapshot.canvas.marginRight),
                    height: Math.min(FILET_MAX_PATTERN_DIM, rendered.overflow.requiredHeight + snapshot.canvas.marginBottom),
                  },
                })
              }
              className="rounded-xl border border-rose-800 bg-white px-2.5 py-1 text-[11px] font-black text-rose-900 cursor-pointer"
            >
              Ajustar lienzo al contenido
            </button>
          </div>
        )}

        {/* Controles de lienzo (ancho, alto, márgenes, borde) + caracteres rápidos */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-[11px] font-bold text-[#5C381E]">
          <label className="space-y-0.5">
            <span>Ancho (cuadros)</span>
            <input
              type="number"
              min={FILET_MIN_DIM}
              max={FILET_MAX_PATTERN_DIM}
              value={snapshot.canvas.width}
              onChange={(e) =>
                updateCanvasField(
                  "width",
                  Math.min(FILET_MAX_PATTERN_DIM, Math.max(FILET_MIN_DIM, Number(e.target.value) || 1))
                )
              }
              className="w-full rounded-lg border border-[#3A2E2B] bg-[#F4EEDC] px-2 py-1 font-mono font-bold text-[#3A2E2B]"
            />
          </label>
          <label className="space-y-0.5">
            <span>Alto (cuadros)</span>
            <input
              type="number"
              min={FILET_MIN_DIM}
              max={FILET_MAX_PATTERN_DIM}
              value={snapshot.canvas.height}
              onChange={(e) =>
                updateCanvasField(
                  "height",
                  Math.min(FILET_MAX_PATTERN_DIM, Math.max(FILET_MIN_DIM, Number(e.target.value) || 1))
                )
              }
              className="w-full rounded-lg border border-[#3A2E2B] bg-[#F4EEDC] px-2 py-1 font-mono font-bold text-[#3A2E2B]"
            />
          </label>
          <label className="space-y-0.5">
            <span>Margen H</span>
            <input
              type="number"
              min={0}
              max={20}
              value={snapshot.canvas.marginLeft}
              onChange={(e) => {
                const m = Math.max(0, Math.min(20, Number(e.target.value) || 0));
                commitSnapshot({
                  ...cloneComposerSnapshot(snapshot),
                  canvas: { ...snapshot.canvas, marginLeft: m, marginRight: m },
                });
              }}
              className="w-full rounded-lg border border-[#3A2E2B] bg-[#F4EEDC] px-2 py-1 font-mono font-bold text-[#3A2E2B]"
            />
          </label>
          <label className="space-y-0.5">
            <span>Margen V</span>
            <input
              type="number"
              min={0}
              max={20}
              value={snapshot.canvas.marginTop}
              onChange={(e) => {
                const m = Math.max(0, Math.min(20, Number(e.target.value) || 0));
                commitSnapshot({
                  ...cloneComposerSnapshot(snapshot),
                  canvas: { ...snapshot.canvas, marginTop: m, marginBottom: m },
                });
              }}
              className="w-full rounded-lg border border-[#3A2E2B] bg-[#F4EEDC] px-2 py-1 font-mono font-bold text-[#3A2E2B]"
            />
          </label>
          <label className="space-y-0.5 col-span-2">
            <span>Borde perimetral</span>
            <select
              value={snapshot.canvas.borderStyle}
              onChange={(e) => updateCanvasField("borderStyle", e.target.value as FiletBorderStyle)}
              className="w-full rounded-lg border border-[#3A2E2B] bg-[#F4EEDC] px-2 py-1 font-bold text-[#3A2E2B]"
            >
              <option value="none">Sin borde</option>
              <option value="open_frame">Marco calado (reserva)</option>
              <option value="solid_frame">Marco sólido (lleno)</option>
            </select>
          </label>
          <label className="space-y-0.5 col-span-2">
            <span>Nombre del patrón / versión</span>
            <input
              type="text"
              value={patternTitle}
              onChange={(e) => setPatternTitle(e.target.value)}
              placeholder="Ej. Manta Baby Lucio"
              className="w-full rounded-lg border border-[#3A2E2B] bg-[#F4EEDC] px-2 py-1 font-bold text-[#3A2E2B]"
            />
          </label>
        </div>

        {/* Selector de caracteres individuales para añadir al lienzo */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-black text-[#795548] mr-1">Insertar glifo:</span>
          {(activeCollection?.glyphs || []).map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => handleAddSingleGlyph(g)}
              className="inline-flex items-center gap-1 rounded-lg border border-[#3A2E2B] bg-[#F4EEDC] px-2 py-0.5 text-[11px] font-black text-[#3A2E2B] hover:bg-[#E7D69C] cursor-pointer"
            >
              <Plus className="h-3 w-3" />
              {g.symbol}
            </button>
          ))}
        </div>
      </div>

      {/* Panel 2: Barra de herramientas del lienzo + Lienzo con perímetro numerado completo */}
      <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-4 sm:p-5 shadow-[0_6px_0_#3A2E2B] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#3A2E2B]/15">
          {/* Modo de edición */}
          <div className="flex items-center gap-1 rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] p-1">
            <button
              type="button"
              onClick={() => setMode("glyph")}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-black cursor-pointer ${
                mode === "glyph" ? "bg-[#314C3C] text-[#FFFDF8]" : "text-[#3A2E2B]"
              }`}
            >
              <Move className="h-3.5 w-3.5" />
              Glifos / Arrastre
            </button>
            <button
              type="button"
              onClick={() => setMode("paint")}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-black cursor-pointer ${
                mode === "paint" ? "bg-[#314C3C] text-[#FFFDF8]" : "text-[#3A2E2B]"
              }`}
            >
              <Pencil className="h-3.5 w-3.5" />
              Pintar celdas
            </button>
          </div>

          {mode === "paint" && (
            <div className="flex items-center gap-1 text-[11px]">
              {(
                [
                  { id: "toggle", label: "Alternar" },
                  { id: 1, label: "■ Llena" },
                  { id: 0, label: "□ Vacía" },
                ] as const
              ).map((opt) => (
                <button
                  key={String(opt.id)}
                  type="button"
                  onClick={() => setPaintValue(opt.id)}
                  className={`rounded-lg border px-2 py-1 font-black cursor-pointer ${
                    paintValue === opt.id
                      ? "border-[#3A2E2B] bg-[#E7D69C] text-[#3A2E2B]"
                      : "border-[#3A2E2B]/30 bg-[#FFFDF8] text-[#795548]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Undo / Redo + Zoom */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={history.past.length === 0}
              onClick={handleUndo}
              className="inline-flex items-center gap-1 rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-2.5 py-1 text-[11px] font-black text-[#3A2E2B] disabled:opacity-40 cursor-pointer"
            >
              <Undo2 className="h-3.5 w-3.5" />
              ({history.past.length})
            </button>
            <button
              type="button"
              disabled={history.future.length === 0}
              onClick={handleRedo}
              className="inline-flex items-center gap-1 rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-2.5 py-1 text-[11px] font-black text-[#3A2E2B] disabled:opacity-40 cursor-pointer"
            >
              <Redo2 className="h-3.5 w-3.5" />
              ({history.future.length})
            </button>

            <div className="flex items-center gap-1 rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-2 py-1">
              <button
                type="button"
                aria-label="Alejar lienzo"
                disabled={zoomIndex <= 0}
                onClick={() => setZoomPct(COMPOSER_ZOOM_LEVELS[Math.max(0, zoomIndex - 1)])}
                className="p-0.5 text-[#3A2E2B] disabled:opacity-40 cursor-pointer"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="font-mono text-[11px] font-black text-[#3A2E2B] min-w-[38px] text-center">
                {zoomPct}%
              </span>
              <button
                type="button"
                aria-label="Acercar lienzo"
                disabled={zoomIndex >= COMPOSER_ZOOM_LEVELS.length - 1}
                onClick={() =>
                  setZoomPct(
                    COMPOSER_ZOOM_LEVELS[Math.min(COMPOSER_ZOOM_LEVELS.length - 1, zoomIndex + 1)]
                  )
                }
                className="p-0.5 text-[#3A2E2B] disabled:opacity-40 cursor-pointer"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Acciones de glifo seleccionado + Alineación / Distribución */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex flex-wrap items-center gap-1">
            <span className="font-black text-[#795548] mr-1">
              {selectedPlacement
                ? `Glifo "${selectedPlacement.symbol}" (${selectedPlacement.x},${selectedPlacement.y}):`
                : "Selecciona un glifo:"}
            </span>
            <button
              type="button"
              disabled={!selectedPlacement}
              onClick={() => handleGlyphTransform({ type: "rotate_cw" })}
              className="inline-flex items-center gap-1 rounded-lg border border-[#3A2E2B]/50 bg-[#FFFBF2] px-2 py-1 font-bold text-[#3A2E2B] disabled:opacity-40 cursor-pointer"
            >
              <RotateCw className="h-3 w-3" /> 90°
            </button>
            <button
              type="button"
              disabled={!selectedPlacement}
              onClick={() => handleGlyphTransform({ type: "rotate_ccw" })}
              className="inline-flex items-center gap-1 rounded-lg border border-[#3A2E2B]/50 bg-[#FFFBF2] px-2 py-1 font-bold text-[#3A2E2B] disabled:opacity-40 cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" /> -90°
            </button>
            <button
              type="button"
              disabled={!selectedPlacement}
              onClick={() => handleGlyphTransform({ type: "flip_h" })}
              className="inline-flex items-center gap-1 rounded-lg border border-[#3A2E2B]/50 bg-[#FFFBF2] px-2 py-1 font-bold text-[#3A2E2B] disabled:opacity-40 cursor-pointer"
            >
              <FlipHorizontal2 className="h-3 w-3" /> Espejo H
            </button>
            <button
              type="button"
              disabled={!selectedPlacement}
              onClick={() => handleGlyphTransform({ type: "flip_v" })}
              className="inline-flex items-center gap-1 rounded-lg border border-[#3A2E2B]/50 bg-[#FFFBF2] px-2 py-1 font-bold text-[#3A2E2B] disabled:opacity-40 cursor-pointer"
            >
              <FlipVertical2 className="h-3 w-3" /> Espejo V
            </button>
            <select
              aria-label="Escalado discreto entero del glifo"
              disabled={!selectedPlacement}
              value={selectedPlacement?.scaleX || 1}
              onChange={(e) =>
                handleGlyphTransform({ type: "scale", scaleX: Number(e.target.value) })
              }
              className="rounded-lg border border-[#3A2E2B]/50 bg-[#FFFBF2] px-1.5 py-1 font-mono font-bold text-[#3A2E2B] disabled:opacity-40"
            >
              <option value={1}>Escala 1× (exacta)</option>
              <option value={2}>Escala 2× (discreta)</option>
              <option value={3}>Escala 3× (discreta)</option>
            </select>
            <button
              type="button"
              disabled={!selectedPlacement}
              onClick={handleDeleteSelectedPlacement}
              aria-label="Quitar glifo del lienzo"
              className="inline-flex items-center gap-1 rounded-lg border border-red-700/50 bg-red-50 px-2 py-1 font-bold text-red-800 disabled:opacity-40 cursor-pointer"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              title="Alinear a la izquierda"
              onClick={() => handleAlign("left")}
              className="rounded-lg border border-[#3A2E2B]/40 bg-[#F4EEDC] p-1 text-[#3A2E2B] cursor-pointer"
            >
              <AlignLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Centrar horizontalmente"
              onClick={() => handleAlign("center_x")}
              className="rounded-lg border border-[#3A2E2B]/40 bg-[#F4EEDC] p-1 text-[#3A2E2B] cursor-pointer"
            >
              <AlignCenterHorizontal className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Alinear a la derecha"
              onClick={() => handleAlign("right")}
              className="rounded-lg border border-[#3A2E2B]/40 bg-[#F4EEDC] p-1 text-[#3A2E2B] cursor-pointer"
            >
              <AlignRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Centrar verticalmente"
              onClick={() => handleAlign("center_y")}
              className="rounded-lg border border-[#3A2E2B]/40 bg-[#F4EEDC] p-1 text-[#3A2E2B] cursor-pointer"
            >
              <AlignCenterVertical className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Distribuir horizontalmente"
              onClick={() => handleAlign("distribute_x")}
              className="rounded-lg border border-[#3A2E2B]/40 bg-[#F4EEDC] p-1 text-[#3A2E2B] cursor-pointer"
            >
              <AlignHorizontalDistributeCenter className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Lienzo interactivo con numeración del perímetro completo (arriba, abajo, izq, der) y desplazamiento */}
        <div
          tabIndex={0}
          role="application"
          aria-label="Lienzo compositor de Filet Crochet. Usa flechas para mover el glifo seleccionado o el cursor de celda, Espacio para alternar celda."
          onKeyDown={handleCanvasKeyDown}
          className="overflow-auto max-h-[520px] rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC]/80 p-3 outline-none focus:ring-2 focus:ring-[#314C3C] select-none"
        >
          <div className="inline-block">
            {/* Numeración superior de columnas 1..W */}
            <div className="flex items-center mb-0.5">
              <div className="w-8 shrink-0 text-right pr-1 font-mono text-[9px] font-black text-[#795548]">
                V\C
              </div>
              {Array.from({ length: snapshot.canvas.width }, (_, c) => (
                <div
                  key={`top-col-${c}`}
                  style={{ width: cellPx }}
                  className="text-center font-mono text-[8px] font-bold text-[#795548] shrink-0"
                >
                  {cellPx >= 14 || (c + 1) % 5 === 0 || c === 0 ? c + 1 : ""}
                </div>
              ))}
              <div className="w-8 shrink-0" />
            </div>

            <div className="flex items-stretch">
              {/* Numeración izquierda de vueltas (1..H de abajo hacia arriba) */}
              <div className="flex flex-col w-8 shrink-0 pr-1">
                {Array.from({ length: snapshot.canvas.height }, (_, r) => {
                  const rowNum = snapshot.canvas.height - r;
                  return (
                    <div
                      key={`left-row-${r}`}
                      style={{ height: cellPx }}
                      className="flex items-center justify-end font-mono text-[9px] font-black text-[#5C381E]"
                    >
                      {rowNum}
                    </div>
                  );
                })}
              </div>

              {/* SVG de alta eficiencia para patrones grandes (hasta 200x200) + capas de glifos arrastrables */}
              <div
                className="relative border border-[#3A2E2B] bg-[#FFFDF8]"
                style={{
                  width: snapshot.canvas.width * cellPx,
                  height: snapshot.canvas.height * cellPx,
                }}
              >
                <svg
                  width={snapshot.canvas.width * cellPx}
                  height={snapshot.canvas.height * cellPx}
                  className={mode === "paint" ? "cursor-crosshair block" : "block"}
                  onPointerDown={(e) => {
                    if (mode !== "paint") return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const col = Math.floor((e.clientX - rect.left) / cellPx);
                    const row = Math.floor((e.clientY - rect.top) / cellPx);
                    if (row >= 0 && row < snapshot.canvas.height && col >= 0 && col < snapshot.canvas.width) {
                      setFocusedCell({ row, col });
                      toggleComposedCell(row, col);
                    }
                  }}
                >
                  {/* Celdas llenas */}
                  {rendered.matrix.map((row, r) =>
                    row.map((val, c) =>
                      val === 1 ? (
                        <rect
                          key={`px-${r}-${c}`}
                          x={c * cellPx}
                          y={r * cellPx}
                          width={cellPx}
                          height={cellPx}
                          fill="#3A2E2B"
                        />
                      ) : null
                    )
                  )}

                  {/* Cuadrícula y líneas guía cada 5 cuadros */}
                  {Array.from({ length: snapshot.canvas.width + 1 }, (_, c) => (
                    <line
                      key={`vl-${c}`}
                      x1={c * cellPx}
                      y1={0}
                      x2={c * cellPx}
                      y2={snapshot.canvas.height * cellPx}
                      stroke={c % 5 === 0 ? "#8C6239" : "#3A2E2B"}
                      strokeOpacity={c % 5 === 0 ? 0.45 : 0.18}
                      strokeWidth={c % 5 === 0 ? 1 : 0.5}
                    />
                  ))}
                  {Array.from({ length: snapshot.canvas.height + 1 }, (_, r) => (
                    <line
                      key={`hl-${r}`}
                      x1={0}
                      y1={r * cellPx}
                      x2={snapshot.canvas.width * cellPx}
                      y2={r * cellPx}
                      stroke={r % 5 === 0 ? "#8C6239" : "#3A2E2B"}
                      strokeOpacity={r % 5 === 0 ? 0.45 : 0.18}
                      strokeWidth={r % 5 === 0 ? 1 : 0.5}
                    />
                  ))}

                  {/* Cursor de teclado en modo pintura */}
                  {mode === "paint" && (
                    <rect
                      x={focusedCell.col * cellPx}
                      y={focusedCell.row * cellPx}
                      width={cellPx}
                      height={cellPx}
                      fill="none"
                      stroke="#314C3C"
                      strokeWidth={2}
                    />
                  )}
                </svg>

                {/* Capa interactiva de selección y arrastre de glifos (ajuste exacto a cuadrícula) */}
                {mode === "glyph" &&
                  placedBoxes.map(({ placement, width, height }) => {
                    const isSelected = placement.instanceId === selectedInstanceId;
                    return (
                      <div
                        key={placement.instanceId}
                        role="button"
                        tabIndex={0}
                        aria-label={`Glifo ${placement.symbol} en columna ${placement.x + 1}, fila ${placement.y + 1}`}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          setSelectedInstanceId(placement.instanceId);
                          setDraggingId(placement.instanceId);
                          dragRef.current = {
                            instanceId: placement.instanceId,
                            startClientX: e.clientX,
                            startClientY: e.clientY,
                            originX: placement.x,
                            originY: placement.y,
                            lastSnappedX: placement.x,
                            lastSnappedY: placement.y,
                          };
                        }}
                        onClick={() => setSelectedInstanceId(placement.instanceId)}
                        style={{
                          left: placement.x * cellPx,
                          top: placement.y * cellPx,
                          width: width * cellPx,
                          height: height * cellPx,
                        }}
                        className={`absolute border-2 transition-colors ${
                          isSelected
                            ? "border-[#314C3C] bg-[#314C3C]/10 z-20"
                            : "border-transparent hover:border-[#C88973]/80 z-10"
                        } ${draggingId === placement.instanceId ? "cursor-grabbing" : "cursor-grab"}`}
                      />
                    );
                  })}
              </div>

              {/* Numeración derecha de vueltas (1..H de abajo hacia arriba) */}
              <div className="flex flex-col w-8 shrink-0 pl-1">
                {Array.from({ length: snapshot.canvas.height }, (_, r) => {
                  const rowNum = snapshot.canvas.height - r;
                  return (
                    <div
                      key={`right-row-${r}`}
                      style={{ height: cellPx }}
                      className="flex items-center justify-start font-mono text-[9px] font-black text-[#5C381E]"
                    >
                      {rowNum}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Numeración inferior de columnas 1..W */}
            <div className="flex items-center mt-0.5">
              <div className="w-8 shrink-0" />
              {Array.from({ length: snapshot.canvas.width }, (_, c) => (
                <div
                  key={`bot-col-${c}`}
                  style={{ width: cellPx }}
                  className="text-center font-mono text-[8px] font-bold text-[#795548] shrink-0"
                >
                  {cellPx >= 14 || (c + 1) % 5 === 0 || c === 0 ? c + 1 : ""}
                </div>
              ))}
              <div className="w-8 shrink-0" />
            </div>
          </div>
        </div>

        {/* Borradores y versiones inmutables */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-[#3A2E2B]/15 text-xs">
          <div className="space-y-1.5">
            <span className="text-[11px] font-black text-[#3A2E2B] flex items-center gap-1">
              <Layers className="h-3.5 w-3.5 text-[#C88973]" />
              Borradores guardados ({workspace.drafts?.length || 0})
            </span>
            {(workspace.drafts || []).length === 0 ? (
              <p className="text-[11px] text-[#795548]">Sin borradores locales todavía.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {(workspace.drafts || []).slice(0, 6).map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => handleLoadDraft(d)}
                    className="rounded-xl border border-[#3A2E2B]/40 bg-[#F4EEDC] px-2.5 py-1 text-[11px] font-bold text-[#3A2E2B] hover:bg-[#E7D69C] cursor-pointer"
                  >
                    {d.title} ({d.snapshot.canvas.width}×{d.snapshot.canvas.height})
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-black text-[#3A2E2B] flex items-center gap-1">
              <GitBranch className="h-3.5 w-3.5 text-[#314C3C]" />
              Patrones Versionados Inmutables ({workspace.patterns.length})
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <select
                aria-label="Seleccionar patrón versionado"
                value={selectedPatternId}
                onChange={(e) => setSelectedPatternId(e.target.value)}
                className="rounded-lg border border-[#3A2E2B] bg-[#F4EEDC] px-2 py-1 text-[11px] font-bold text-[#3A2E2B]"
              >
                <option value="">+ Crear nuevo patrón versionado</option>
                {workspace.patterns.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} (v{p.currentVersion})
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={versionNote}
                onChange={(e) => setVersionNote(e.target.value)}
                placeholder="Nota de versión..."
                className="rounded-lg border border-[#3A2E2B]/50 bg-[#FFFDF8] px-2 py-1 text-[11px] text-[#3A2E2B]"
              />
            </div>
            {selectedPattern && (
              <p className="text-[10px] text-[#795548]">
                Versiones inmutables en &ldquo;{selectedPattern.title}&rdquo;:{" "}
                {selectedPattern.versions.map((v) => `v${v.version} (${v.width}×${v.height})`).join(" · ")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Panel 3: Bloque 3 — Motor Técnico de Ejecución (Separado de la matriz visual) */}
      <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-4 sm:p-5 shadow-[0_6px_0_#3A2E2B] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-[#795548] block">
              Bloque 3 · Motor Técnico de Ejecución (Separado de la Matriz Visual)
            </span>
            <h4 className="text-sm font-black text-[#3A2E2B] flex items-center gap-1.5">
              <ListOrdered className="h-4 w-4 text-[#314C3C]" />
              Convención de Malla, Cadenetas de Base e Instrucciones por Fila
            </h4>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              aria-label="Convención de malla Filet Crochet"
              value={meshSize}
              onChange={(e) => setMeshSize(Number(e.target.value) as FiletMeshSize)}
              className="rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-2.5 py-1 text-xs font-bold text-[#3A2E2B]"
            >
              <option value={3}>Malla de 3 (1 cad interior · paso 2 · bordes compartidos)</option>
              <option value={4}>Malla de 4 (2 cad interiores · paso 3 · bordes compartidos)</option>
            </select>

            <select
              aria-label="Dirección de la vuelta 1"
              value={firstRowDirection}
              onChange={(e) => setFirstRowDirection(e.target.value as FiletRowDirection)}
              className="rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-2.5 py-1 text-xs font-bold text-[#3A2E2B]"
            >
              <option value="rtl">Vuelta 1: Der→Izq (invertida)</option>
              <option value="ltr">Vuelta 1: Izq→Der (normal)</option>
            </select>

            <button
              type="button"
              onClick={() => setShowTechnicalPanel((v) => !v)}
              className="text-xs font-black text-[#314C3C] underline cursor-pointer"
            >
              {showTechnicalPanel ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </div>

        {showTechnicalPanel && technicalPlan && (
          <div className="space-y-3">
            <div className="rounded-2xl border-2 border-[#D8B48A] bg-[#FFFBF2] p-3 text-xs text-[#3A2E2B] space-y-1">
              <p className="font-black">{technicalPlan.foundation.formulaDescription}</p>
              <p className="text-[11px] text-[#5C381E]">
                Convención activa: malla de <strong>{technicalPlan.convention.meshSize}</strong> posiciones ·{" "}
                <strong>{technicalPlan.convention.innerChainsPerEmptyMesh}</strong> cadena(s) interior(es) por cuadro vacío ·{" "}
                subida lleno = <strong>{technicalPlan.convention.turningChainsFilled} cad</strong>, subida vacío ={" "}
                <strong>{technicalPlan.convention.turningChainsEmpty} cad</strong> · Total gráfico:{" "}
                <strong>{technicalPlan.totalSquares}</strong> cuadros ({technicalPlan.totalFilledSquares} llenos,{" "}
                {technicalPlan.totalEmptySquares} vacíos).
              </p>
            </div>

            <div className="max-h-60 overflow-y-auto rounded-2xl border border-[#3A2E2B]/25 bg-[#F4EEDC]/50 p-3 space-y-1.5">
              {technicalPlan.rows.map((r) => (
                <p key={r.rowNumber} className="font-mono text-[11px] text-[#3A2E2B]">
                  {r.instructionText}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
