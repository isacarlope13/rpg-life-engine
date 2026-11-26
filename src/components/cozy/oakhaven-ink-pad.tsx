"use client";

import React, { useRef, useState } from "react";
import { Download, Eraser, PenTool, Undo2 } from "lucide-react";
import {
  OAKHAVEN_INK_MAX_POINTS_PER_STROKE,
  OAKHAVEN_INK_MAX_STROKES,
  computeStrokeWidth,
  createEmptyInkDocument,
  exportInkDocumentToSvg,
  normalizeInkPoint,
  shouldAcceptInkPointer,
  type InkDocument,
  type InkStroke,
} from "@/lib/devices/oakhaven-ink-engine";
import { CozyButton } from "@/components/cozy/ui";

const INK_COLORS = [
  { id: "bark", hex: "#3A2E2B", label: "Tinta oscura" },
  { id: "forest", hex: "#314C3C", label: "Verde bosque" },
  { id: "clay", hex: "#C88973", label: "Terracota" },
] as const;

interface OakHavenInkPadProps {
  initialTitle?: string;
  onSaveDocument?: (doc: InkDocument) => void;
}

export function OakHavenInkPad({
  initialTitle = "Nota rápida con S Pen",
  onSaveDocument,
}: OakHavenInkPadProps) {
  const [doc, setDoc] = useState<InkDocument>(() => createEmptyInkDocument(initialTitle, 640, 360));
  const [activeColor, setActiveColor] = useState<string>("#3A2E2B");
  const [penOnlyMode, setPenOnlyMode] = useState<boolean>(false);
  const activeStrokeIdRef = useRef<string | null>(null);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!shouldAcceptInkPointer(e.pointerType, penOnlyMode)) return;
    if (doc.strokes.length >= OAKHAVEN_INK_MAX_STROKES) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * doc.width;
    const y = ((e.clientY - rect.top) / Math.max(1, rect.height)) * doc.height;
    const strokeId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    activeStrokeIdRef.current = strokeId;
    const newStroke: InkStroke = {
      id: strokeId,
      color: activeColor,
      baseWidth: 3,
      pointerType: e.pointerType === "pen" ? "pen" : e.pointerType === "touch" ? "touch" : "mouse",
      points: [normalizeInkPoint(x, y, e.pressure)],
    };
    setDoc((prev) => ({
      ...prev,
      strokes: [...prev.strokes, newStroke],
      updatedAt: new Date().toISOString(),
    }));
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const strokeId = activeStrokeIdRef.current;
    if (!strokeId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * doc.width;
    const y = ((e.clientY - rect.top) / Math.max(1, rect.height)) * doc.height;
    const pt = normalizeInkPoint(x, y, e.pressure);
    setDoc((prev) => ({
      ...prev,
      strokes: prev.strokes.map((s) =>
        s.id === strokeId && s.points.length < OAKHAVEN_INK_MAX_POINTS_PER_STROKE
          ? { ...s, points: [...s.points, pt] }
          : s
      ),
    }));
  };

  const handlePointerUp = () => {
    activeStrokeIdRef.current = null;
  };

  const handleExportSvg = () => {
    const svg = exportInkDocumentToSvg(doc);
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "oakhaven-ink"}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-4 shadow-[0_6px_0_#3A2E2B] space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <PenTool className="h-4 w-4 text-[#314C3C]" />
          <span className="text-xs font-black uppercase text-[#3A2E2B]">
            OakHaven Ink · S Pen &amp; Notas Manuscritas
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {INK_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-label={c.label}
              onClick={() => setActiveColor(c.hex)}
              style={{ backgroundColor: c.hex }}
              className={`h-6 w-6 rounded-full border-2 cursor-pointer ${
                activeColor === c.hex ? "border-[#E7D69C] ring-2 ring-[#3A2E2B]" : "border-[#3A2E2B]/40"
              }`}
            />
          ))}
          <label className="ml-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#5C381E] cursor-pointer">
            <input
              type="checkbox"
              checked={penOnlyMode}
              onChange={(e) => setPenOnlyMode(e.target.checked)}
            />
            Solo S Pen (rechazo de palma)
          </label>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${doc.width} ${doc.height}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="w-full h-64 rounded-2xl border-2 border-[#3A2E2B] bg-[#FFFDF8] touch-none cursor-crosshair"
      >
        {doc.strokes.map((s) => {
          const avgP =
            s.points.reduce((acc, p) => acc + p.pressure, 0) / Math.max(1, s.points.length);
          const sw = computeStrokeWidth(s.baseWidth, avgP);
          const d = s.points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
          return (
            <path
              key={s.id}
              d={d}
              fill="none"
              stroke={s.color}
              strokeWidth={sw}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
      </svg>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-[#795548]">
          {doc.strokes.length} trazo(s) · Funciona 100% offline
        </span>
        <div className="flex items-center gap-1.5">
          <CozyButton
            size="sm"
            variant="cream"
            disabled={doc.strokes.length === 0}
            onClick={() =>
              setDoc((prev) => ({
                ...prev,
                strokes: prev.strokes.slice(0, -1),
                updatedAt: new Date().toISOString(),
              }))
            }
            icon={<Undo2 className="h-3.5 w-3.5" />}
          >
            Deshacer
          </CozyButton>
          <CozyButton
            size="sm"
            variant="clay"
            disabled={doc.strokes.length === 0}
            onClick={() => setDoc(createEmptyInkDocument(doc.title, doc.width, doc.height))}
            icon={<Eraser className="h-3.5 w-3.5" />}
          >
            Limpiar
          </CozyButton>
          <CozyButton
            size="sm"
            variant="wood"
            disabled={doc.strokes.length === 0}
            onClick={handleExportSvg}
            icon={<Download className="h-3.5 w-3.5" />}
          >
            Exportar SVG
          </CozyButton>
          {onSaveDocument && (
            <CozyButton size="sm" variant="forest" onClick={() => onSaveDocument(doc)}>
              Guardar nota
            </CozyButton>
          )}
        </div>
      </div>
    </div>
  );
}
