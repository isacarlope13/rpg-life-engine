"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Download, Eraser, MousePointer, PenTool, Plus, Redo2, Trash2, Undo2 } from "lucide-react";
import {
  OAKHAVEN_INK_MAX_POINTS_PER_STROKE,
  OAKHAVEN_INK_MAX_STROKES,
  addPageToNotebook,
  computeStrokeWidth,
  createInkNotebook,
  exportInkDocumentToSvg,
  findStrokeAtPoint,
  normalizeInkPoint,
  shouldAcceptInkPointer,
  type InkNotebook,
  type InkPaperTemplate,
  type InkStroke,
} from "@/lib/devices/oakhaven-ink-engine";
import { CozyButton } from "@/components/cozy/ui";
import { safeLocalStorage } from "@/lib/storage-safe";

const INK_COLORS = [
  { id: "bark", hex: "#3A2E2B", label: "Tinta oscura" },
  { id: "forest", hex: "#314C3C", label: "Verde bosque" },
  { id: "clay", hex: "#C88973", label: "Terracota" },
  { id: "navy", hex: "#2C4D56", label: "Azul lago" },
] as const;

const STROKE_WIDTHS = [2, 3, 5, 8] as const;
const TEMPLATES: Array<{ id: InkPaperTemplate; label: string }> = [
  { id: "dots", label: "Puntos" },
  { id: "grid", label: "Cuadrícula" },
  { id: "lined", label: "Rayado" },
  { id: "blank", label: "Blanco" },
];

type InkTool = "pen" | "eraser" | "select";

interface OakHavenInkPadProps {
  storageKey?: string;
  initialTitle?: string;
  linkedProjectId?: string;
  linkedTaskId?: string;
  onSaveNotebook?: (notebook: InkNotebook) => void;
}

export function OakHavenInkPad({
  storageKey = "oakhaven_ink_notebook_v1",
  initialTitle = "Cuaderno OakHaven Ink",
  linkedProjectId,
  linkedTaskId,
  onSaveNotebook,
}: OakHavenInkPadProps) {
  const [notebook, setNotebook] = useState<InkNotebook>(() => {
    try {
      const raw = safeLocalStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as InkNotebook;
        if (parsed && parsed.schemaVersion === 1 && Array.isArray(parsed.pages) && parsed.pages.length > 0) {
          return parsed;
        }
      }
    } catch {
      // fallback limpio
    }
    return createInkNotebook(initialTitle, "dots", { linkedProjectId, linkedTaskId });
  });

  const [tool, setTool] = useState<InkTool>("pen");
  const [activeColor, setActiveColor] = useState<string>("#3A2E2B");
  const [strokeWidth, setStrokeWidth] = useState<number>(3);
  const [penOnlyMode, setPenOnlyMode] = useState<boolean>(false);
  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null);
  const [redoByPage, setRedoByPage] = useState<Record<string, InkStroke[]>>({});
  const activeStrokeIdRef = useRef<string | null>(null);

  const activePage = useMemo(
    () => notebook.pages.find((p) => p.id === notebook.activePageId) || notebook.pages[0],
    [notebook]
  );

  // Guardado automático offline en almacenamiento local seguro
  useEffect(() => {
    try {
      safeLocalStorage.setItem(storageKey, JSON.stringify(notebook));
    } catch {
      // ignorar si storage está lleno
    }
  }, [notebook, storageKey]);

  const updateActivePage = (updater: (page: typeof activePage) => typeof activePage) => {
    setNotebook((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => (p.id === activePage.id ? updater(p) : p)),
      updatedAt: new Date().toISOString(),
    }));
  };

  const getSvgCoords = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * activePage.width;
    const y = ((e.clientY - rect.top) / Math.max(1, rect.height)) * activePage.height;
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!shouldAcceptInkPointer(e.pointerType, penOnlyMode)) return;
    const { x, y } = getSvgCoords(e);

    if (tool === "select") {
      const hit = findStrokeAtPoint(activePage.strokes, x, y, 14);
      setSelectedStrokeId(hit?.id || null);
      return;
    }

    if (tool === "eraser") {
      const hit = findStrokeAtPoint(activePage.strokes, x, y, 14);
      if (hit) {
        updateActivePage((p) => ({
          ...p,
          strokes: p.strokes.filter((s) => s.id !== hit.id),
          updatedAt: new Date().toISOString(),
        }));
        if (selectedStrokeId === hit.id) setSelectedStrokeId(null);
      }
      return;
    }

    if (activePage.strokes.length >= OAKHAVEN_INK_MAX_STROKES) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const strokeId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    activeStrokeIdRef.current = strokeId;
    setSelectedStrokeId(null);
    setRedoByPage((prev) => ({ ...prev, [activePage.id]: [] }));

    const newStroke: InkStroke = {
      id: strokeId,
      color: activeColor,
      baseWidth: strokeWidth,
      pointerType: e.pointerType === "pen" ? "pen" : e.pointerType === "touch" ? "touch" : "mouse",
      points: [normalizeInkPoint(x, y, e.pressure)],
    };
    updateActivePage((p) => ({
      ...p,
      strokes: [...p.strokes, newStroke],
      updatedAt: new Date().toISOString(),
    }));
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (tool === "eraser" && e.buttons > 0) {
      const { x, y } = getSvgCoords(e);
      const hit = findStrokeAtPoint(activePage.strokes, x, y, 14);
      if (hit) {
        updateActivePage((p) => ({
          ...p,
          strokes: p.strokes.filter((s) => s.id !== hit.id),
          updatedAt: new Date().toISOString(),
        }));
      }
      return;
    }
    const strokeId = activeStrokeIdRef.current;
    if (!strokeId) return;
    const { x, y } = getSvgCoords(e);
    const pt = normalizeInkPoint(x, y, e.pressure);
    updateActivePage((p) => ({
      ...p,
      strokes: p.strokes.map((s) =>
        s.id === strokeId && s.points.length < OAKHAVEN_INK_MAX_POINTS_PER_STROKE
          ? { ...s, points: [...s.points, pt] }
          : s
      ),
    }));
  };

  const handlePointerUp = () => {
    activeStrokeIdRef.current = null;
  };

  const handleUndo = () => {
    if (activePage.strokes.length === 0) return;
    const removed = activePage.strokes[activePage.strokes.length - 1];
    setRedoByPage((prev) => ({
      ...prev,
      [activePage.id]: [...(prev[activePage.id] || []), removed],
    }));
    updateActivePage((p) => ({
      ...p,
      strokes: p.strokes.slice(0, -1),
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleRedo = () => {
    const stack = redoByPage[activePage.id] || [];
    if (stack.length === 0) return;
    const restored = stack[stack.length - 1];
    setRedoByPage((prev) => ({
      ...prev,
      [activePage.id]: stack.slice(0, -1),
    }));
    updateActivePage((p) => ({
      ...p,
      strokes: [...p.strokes, restored],
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleExportSvg = () => {
    const svg = exportInkDocumentToSvg(activePage);
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${notebook.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${activePage.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const redoCount = (redoByPage[activePage.id] || []).length;

  return (
    <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-4 shadow-[0_6px_0_#3A2E2B] space-y-3">
      {/* Cabecera y selector de páginas del cuaderno */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#3A2E2B]/10 pb-2">
        <div className="flex items-center gap-2">
          <PenTool className="h-4 w-4 text-[#314C3C]" />
          <span className="text-xs font-black uppercase text-[#3A2E2B]">
            OakHaven Ink · {notebook.title}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {notebook.pages.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setNotebook((prev) => ({ ...prev, activePageId: p.id }));
                setSelectedStrokeId(null);
              }}
              className={`rounded-xl border-2 px-2 py-0.5 text-[10px] font-black cursor-pointer ${
                p.id === activePage.id
                  ? "border-[#3A2E2B] bg-[#314C3C] text-[#FFFDF8]"
                  : "border-[#3A2E2B]/30 bg-[#F4EEDC] text-[#3A2E2B]"
              }`}
            >
              {p.title}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setNotebook((prev) => addPageToNotebook(prev))}
            className="inline-flex items-center gap-0.5 rounded-xl border-2 border-[#3A2E2B] bg-[#E7D69C] px-2 py-0.5 text-[10px] font-black text-[#3A2E2B] cursor-pointer"
          >
            <Plus className="h-3 w-3" /> Página
          </button>
        </div>
      </div>

      {/* Herramientas: lápiz, borrador, selección, colores, grosor, plantilla y rechazo de palma */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex flex-wrap items-center gap-1">
          {(
            [
              { id: "pen", label: "Lápiz", icon: <PenTool className="h-3 w-3" /> },
              { id: "eraser", label: "Borrador", icon: <Eraser className="h-3 w-3" /> },
              { id: "select", label: "Seleccionar", icon: <MousePointer className="h-3 w-3" /> },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTool(t.id)}
              className={`inline-flex items-center gap-1 rounded-xl border-2 px-2 py-1 font-black cursor-pointer ${
                tool === t.id
                  ? "border-[#3A2E2B] bg-[#314C3C] text-[#FFFDF8]"
                  : "border-[#3A2E2B]/30 bg-[#F4EEDC] text-[#3A2E2B]"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}

          {INK_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-label={c.label}
              onClick={() => {
                setActiveColor(c.hex);
                setTool("pen");
              }}
              style={{ backgroundColor: c.hex }}
              className={`h-6 w-6 rounded-full border-2 cursor-pointer ${
                activeColor === c.hex ? "border-[#E7D69C] ring-2 ring-[#3A2E2B]" : "border-[#3A2E2B]/40"
              }`}
            />
          ))}

          <select
            aria-label="Grosor de trazo"
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            className="rounded-xl border-2 border-[#3A2E2B]/40 bg-[#F4EEDC] px-1.5 py-1 text-[10px] font-black text-[#3A2E2B]"
          >
            {STROKE_WIDTHS.map((w) => (
              <option key={w} value={w}>
                {w}px
              </option>
            ))}
          </select>

          <select
            aria-label="Plantilla de papel"
            value={activePage.template}
            onChange={(e) =>
              updateActivePage((p) => ({ ...p, template: e.target.value as InkPaperTemplate }))
            }
            className="rounded-xl border-2 border-[#3A2E2B]/40 bg-[#F4EEDC] px-1.5 py-1 text-[10px] font-black text-[#3A2E2B]"
          >
            {TEMPLATES.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                Papel: {tpl.label}
              </option>
            ))}
          </select>
        </div>

        <label className="inline-flex items-center gap-1 text-[11px] font-bold text-[#5C381E] cursor-pointer">
          <input
            type="checkbox"
            checked={penOnlyMode}
            onChange={(e) => setPenOnlyMode(e.target.checked)}
          />
          Solo S Pen (rechazo de palma)
        </label>
      </div>

      {/* Lienzo SVG interactivo */}
      <svg
        viewBox={`0 0 ${activePage.width} ${activePage.height}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="w-full h-64 rounded-2xl border-2 border-[#3A2E2B] bg-[#FFFDF8] touch-none cursor-crosshair"
      >
        {activePage.template === "grid" && (
          <defs>
            <pattern id="ink-grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#3A2E2B" strokeOpacity="0.12" strokeWidth="1" />
            </pattern>
          </defs>
        )}
        {activePage.template === "lined" && (
          <defs>
            <pattern id="ink-lined" width="28" height="28" patternUnits="userSpaceOnUse">
              <line x1="0" y1="28" x2="28" y2="28" stroke="#3A2E2B" strokeOpacity="0.16" strokeWidth="1" />
            </pattern>
          </defs>
        )}
        {activePage.template === "dots" && (
          <defs>
            <pattern id="ink-dots" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="12" cy="12" r="1.2" fill="#3A2E2B" fillOpacity="0.22" />
            </pattern>
          </defs>
        )}
        {activePage.template !== "blank" && (
          <rect width="100%" height="100%" fill={`url(#ink-${activePage.template})`} />
        )}

        {activePage.strokes.map((s) => {
          const avgP =
            s.points.reduce((acc, p) => acc + p.pressure, 0) / Math.max(1, s.points.length);
          const sw = computeStrokeWidth(s.baseWidth, avgP);
          const d = s.points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
          const isSelected = s.id === selectedStrokeId;
          return (
            <path
              key={s.id}
              d={d}
              fill="none"
              stroke={isSelected ? "#E11D48" : s.color}
              strokeWidth={isSelected ? sw + 2 : sw}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
      </svg>

      {/* Pie de acciones */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-[#795548]">
          {activePage.strokes.length} trazo(s) · Guardado automático offline
          {notebook.linkedProjectId ? ` · Proyecto vinculado` : ""}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {selectedStrokeId && (
            <CozyButton
              size="sm"
              variant="clay"
              onClick={() => {
                updateActivePage((p) => ({
                  ...p,
                  strokes: p.strokes.filter((s) => s.id !== selectedStrokeId),
                }));
                setSelectedStrokeId(null);
              }}
              icon={<Trash2 className="h-3.5 w-3.5" />}
            >
              Borrar selección
            </CozyButton>
          )}
          <CozyButton
            size="sm"
            variant="cream"
            disabled={activePage.strokes.length === 0}
            onClick={handleUndo}
            icon={<Undo2 className="h-3.5 w-3.5" />}
          >
            Deshacer
          </CozyButton>
          <CozyButton
            size="sm"
            variant="cream"
            disabled={redoCount === 0}
            onClick={handleRedo}
            icon={<Redo2 className="h-3.5 w-3.5" />}
          >
            Rehacer
          </CozyButton>
          <CozyButton
            size="sm"
            variant="wood"
            disabled={activePage.strokes.length === 0}
            onClick={handleExportSvg}
            icon={<Download className="h-3.5 w-3.5" />}
          >
            Exportar SVG
          </CozyButton>
          {onSaveNotebook && (
            <CozyButton size="sm" variant="forest" onClick={() => onSaveNotebook(notebook)}>
              Guardar cuaderno
            </CozyButton>
          )}
        </div>
      </div>
    </div>
  );
}
