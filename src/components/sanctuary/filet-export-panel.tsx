"use client";

/**
 * ============================================================================
 * OAKHAVEN — FILET CROCHET STUDIO FASE 5 (PANEL DE EXPORTACIONES E IMPRESIÓN)
 * ============================================================================
 * Cargado de forma diferida (`next/dynamic`) para no incrementar el JS inicial
 * de `/cozy`. Utiliza exclusivamente `filet-export-engine.ts` y
 * `filet-project-archive.ts` sobre matrices y versiones inmutables.
 */

import React, { useMemo, useState } from "react";
import {
  Download,
  FileCode2,
  FileImage,
  FileJson,
  FileText,
  Printer,
  Upload,
} from "lucide-react";
import { CozyButton, CozyNotification } from "@/components/cozy/ui";
import type {
  FiletMeshSize,
  FiletRowDirection,
  FiletStudioWorkspace,
} from "@/lib/sanctuary/filet-crochet-engine";
import type { FiletGuidedOrientation } from "@/lib/sanctuary/filet-guided-engine";
import {
  buildPrintableInstructionsDocument,
  buildUniversalExportModel,
  exportPatternToPng,
  exportPatternToSvg,
  exportPatternToVectorPdf,
  exportPrintableInstructionsToMarkdown,
  PAPER_DIMENSIONS_PT,
  type ExportPaginationMode,
  type ExportPaperOrientation,
  type ExportPaperSize,
  type ExportPngDpi,
} from "@/lib/sanctuary/filet-export-engine";
import {
  applyArchiveImportToWorkspace,
  buildFiletProjectArchive,
  detectArchiveImportConflicts,
  serializeFiletProjectArchive,
  validateAndParseProjectArchive,
  type FiletProjectArchiveFile,
} from "@/lib/sanctuary/filet-project-archive";

interface FiletExportPanelProps {
  workspace: FiletStudioWorkspace;
  onPersistWorkspace: (next: FiletStudioWorkspace, silent?: boolean) => void;
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function FiletExportPanel({
  workspace,
  onPersistWorkspace,
}: FiletExportPanelProps) {
  const [selectedPatternId, setSelectedPatternId] = useState<string>(
    () => workspace.patterns[0]?.id || ""
  );

  const selectedPattern = useMemo(
    () =>
      workspace.patterns.find((p) => p.id === selectedPatternId) ||
      workspace.patterns[0],
    [workspace.patterns, selectedPatternId]
  );

  const [selectedVersionNum, setSelectedVersionNum] = useState<number>(
    () => selectedPattern?.currentVersion || 1
  );

  const selectedVersion = useMemo(() => {
    if (!selectedPattern) return null;
    return (
      selectedPattern.versions.find((v) => v.version === selectedVersionNum) ||
      selectedPattern.versions[selectedPattern.versions.length - 1] ||
      null
    );
  }, [selectedPattern, selectedVersionNum]);

  // Configuración común (Bloque 1)
  const [meshSize, setMeshSize] = useState<FiletMeshSize>(3);
  const [orientation, setOrientation] = useState<FiletGuidedOrientation>("bottom_to_top");
  const [firstRowDir, setFirstRowDir] = useState<FiletRowDirection>("rtl");
  const [marginMm, setMarginMm] = useState<number>(12);
  const [showPerimeterNumbers, setShowPerimeterNumbers] = useState<boolean>(true);
  const [showGridLines, setShowGridLines] = useState<boolean>(true);
  const [showLegend, setShowLegend] = useState<boolean>(true);
  const [filledColorHex, setFilledColorHex] = useState<string>("#3A2E2B");
  const [emptyColorHex, setEmptyColorHex] = useState<string>("#FFFDF8");
  const [historicalRefTitle, setHistoricalRefTitle] = useState<string>("");

  // Opciones PDF (Bloque 2)
  const [paperSize, setPaperSize] = useState<ExportPaperSize>("A4");
  const [paperOrientation, setPaperOrientation] = useState<ExportPaperOrientation>("landscape");
  const [paginationMode, setPaginationMode] = useState<ExportPaginationMode>("fit_one_page");
  const [cellSizeMm, setCellSizeMm] = useState<number>(4);
  const [includeInstructionsPages, setIncludeInstructionsPages] = useState<boolean>(true);

  // Opciones PNG/SVG (Bloque 3)
  const [pngDpi, setPngDpi] = useState<ExportPngDpi>(300);
  const [pngCellPx, setPngCellPx] = useState<number>(16);
  const [transparentBg, setTransparentBg] = useState<boolean>(false);

  // Archivo JSON (Bloque 4)
  const [pendingArchive, setPendingArchive] = useState<FiletProjectArchiveFile | null>(null);
  const [conflictTitle, setConflictTitle] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    type: "success" | "error" | "warning";
    message: string;
  } | null>(null);

  const exportModel = useMemo(() => {
    if (!selectedPattern || !selectedVersion) return null;
    try {
      return buildUniversalExportModel({
        patternName: selectedPattern.title,
        versionNumber: selectedVersion.version,
        matrix: selectedVersion.matrix,
        meshSize,
        orientation,
        firstRowDirection: firstRowDir,
        marginMm,
        showPerimeterNumbers,
        showGridLines,
        filledColorHex,
        emptyColorHex,
        gridColorHex: "#8C7A6B",
        showLegend,
        historicalRef: historicalRefTitle.trim()
          ? { documentTitle: historicalRefTitle.trim() }
          : null,
      });
    } catch {
      return null;
    }
  }, [
    selectedPattern,
    selectedVersion,
    meshSize,
    orientation,
    firstRowDir,
    marginMm,
    showPerimeterNumbers,
    showGridLines,
    filledColorHex,
    emptyColorHex,
    showLegend,
    historicalRefTitle,
  ]);

  const svgPreview = useMemo(() => {
    if (!exportModel) return "";
    return exportPatternToSvg(exportModel, {
      cellPx: Math.max(4, Math.min(14, Math.floor(420 / Math.max(1, exportModel.gridWidth)))),
      transparentBackground: transparentBg,
    });
  }, [exportModel, transparentBg]);

  const printableDoc = useMemo(
    () => (exportModel ? buildPrintableInstructionsDocument(exportModel) : null),
    [exportModel]
  );

  const safeSlug = (selectedPattern?.title || "patron-filet")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);

  const handleExportPdf = () => {
    if (!exportModel) return;
    try {
      const pdf = exportPatternToVectorPdf(exportModel, {
        paperSize,
        paperOrientation,
        paginationMode,
        cellSizeMm,
        includeInstructionsPages,
      });
      triggerBrowserDownload(
        new Blob([pdf.bytes.buffer as ArrayBuffer], { type: "application/pdf" }),
        `${safeSlug}-v${exportModel.versionNumber}.pdf`
      );
      setNotice({
        type: "success",
        message: `PDF vectorial generado (${pdf.pageCount} pág.: ${pdf.chartPagesCount} de gráfico ${pdf.tileRows}×${pdf.tileCols} + ${pdf.instructionsPagesCount} de instrucciones).`,
      });
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Error al generar PDF.",
      });
    }
  };

  const handleExportSvg = () => {
    if (!exportModel) return;
    const svg = exportPatternToSvg(exportModel, {
      cellPx: pngCellPx,
      transparentBackground: transparentBg,
    });
    triggerBrowserDownload(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      `${safeSlug}-v${exportModel.versionNumber}.svg`
    );
    setNotice({ type: "success", message: "SVG vectorial exportado sin scripts ni referencias externas." });
  };

  const handleExportPng = () => {
    if (!exportModel) return;
    try {
      const png = exportPatternToPng(exportModel, {
        cellPx: pngCellPx,
        dpi: pngDpi,
        transparentBackground: transparentBg,
        includeGridLines: showGridLines,
      });
      triggerBrowserDownload(
        new Blob([png.bytes.buffer as ArrayBuffer], { type: "image/png" }),
        `${safeSlug}-v${exportModel.versionNumber}-${png.dpi}dpi.png`
      );
      setNotice({
        type: "success",
        message: `PNG exportado (${png.widthPx}×${png.heightPx}px a ${png.dpi} DPI${
          png.transparentBackground ? ", fondo transparente" : ""
        }).`,
      });
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Error al exportar PNG.",
      });
    }
  };

  const handleExportInstructionsMd = () => {
    if (!printableDoc) return;
    const md = exportPrintableInstructionsToMarkdown(printableDoc);
    triggerBrowserDownload(
      new Blob([md], { type: "text/markdown;charset=utf-8" }),
      `${safeSlug}-v${printableDoc.versionNumber}-instrucciones.md`
    );
    setNotice({
      type: "success",
      message: `Documento imprimible de instrucciones exportado (${printableDoc.rows.length} vueltas verificadas).`,
    });
  };

  const handleExportJsonArchive = () => {
    if (!selectedPattern || !selectedVersion) return;
    try {
      const archive = buildFiletProjectArchive({
        pattern: selectedPattern,
        selectedVersionNumbers: [selectedVersion.version],
        meshSize,
        orientation,
        firstRowDirection: firstRowDir,
        includeProgress: false,
      });
      const json = serializeFiletProjectArchive(archive);
      triggerBrowserDownload(
        new Blob([json], { type: "application/json;charset=utf-8" }),
        `${safeSlug}-v${selectedVersion.version}.oakhaven-filet.json`
      );
      setNotice({
        type: "success",
        message: "Archivo JSON reutilizable exportado (sin datos personales, sesiones ni XP/GP).",
      });
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Error al exportar archivo JSON.",
      });
    }
  };

  const handleImportJsonArchive = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const validated = validateAndParseProjectArchive(text);
      if (!validated.valid || !validated.archive) {
        setNotice({
          type: "error",
          message: `Archivo rechazado: ${validated.errors.join(" ")}`,
        });
        return;
      }
      const conflict = detectArchiveImportConflicts(workspace, validated.archive);
      if (conflict.hasConflict) {
        setPendingArchive(validated.archive);
        setConflictTitle(conflict.conflictingPatternTitle || validated.archive.pattern.title);
        setNotice({
          type: "warning",
          message: `Conflicto detectado: "${conflict.conflictingPatternTitle}" ya existe. Elige conservar copia o sobrescribir explícitamente.`,
        });
        return;
      }
      const applied = applyArchiveImportToWorkspace({
        workspace,
        archive: validated.archive,
        strategy: "abort_on_conflict",
      });
      if (applied.ok) {
        onPersistWorkspace(applied.workspace, false);
        if (applied.importedPatternId) setSelectedPatternId(applied.importedPatternId);
        setNotice({
          type: "success",
          message: `Patrón "${validated.archive.pattern.title}" importado con matrices verificadas.`,
        });
      }
    } catch {
      setNotice({ type: "error", message: "No se pudo leer el archivo JSON seleccionado." });
    }
  };

  const handleResolveArchiveConflict = (strategy: "keep_both" | "overwrite_confirmed") => {
    if (!pendingArchive) return;
    const applied = applyArchiveImportToWorkspace({
      workspace,
      archive: pendingArchive,
      strategy,
    });
    if (applied.ok) {
      onPersistWorkspace(applied.workspace, false);
      if (applied.importedPatternId) setSelectedPatternId(applied.importedPatternId);
      setPendingArchive(null);
      setConflictTitle(null);
      setNotice({
        type: "success",
        message:
          strategy === "keep_both"
            ? "Patrón importado como copia independiente."
            : "Patrón existente actualizado tras confirmación explícita.",
      });
    }
  };

  return (
    <div className="space-y-4">
      {notice && (
        <CozyNotification
          variant={notice.type}
          title={notice.type === "success" ? "Exportación Filet" : "Aviso"}
          message={notice.message}
          onDismiss={() => setNotice(null)}
        />
      )}

      {/* Selector de patrón y versión + Importación JSON */}
      <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-4 shadow-[0_6px_0_#3A2E2B] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-[#795548] block">
              Bloques 1–5 · Motor Universal Determinista (PDF Vectorial · SVG · PNG · JSON)
            </span>
            <h4 className="text-sm font-black text-[#3A2E2B]">
              Exportaciones Profesionales e Instrucciones Imprimibles
            </h4>
          </div>

          <label className="rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-1.5 text-xs font-black text-[#3A2E2B] cursor-pointer inline-flex items-center gap-1.5">
            <Upload className="h-3.5 w-3.5" />
            Importar JSON de Proyecto
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleImportJsonArchive}
              className="hidden"
            />
          </label>
        </div>

        {pendingArchive && conflictTitle && (
          <div className="rounded-2xl border-2 border-[#8A3722] bg-[#C88973]/15 p-3 text-xs space-y-2">
            <p className="font-black text-[#8A3722]">
              Conflicto de importación: ya existe &ldquo;{conflictTitle}&rdquo;. ¿Cómo deseas proceder?
            </p>
            <div className="flex flex-wrap gap-2">
              <CozyButton size="sm" variant="forest" onClick={() => handleResolveArchiveConflict("keep_both")}>
                Importar como copia
              </CozyButton>
              <CozyButton size="sm" variant="clay" onClick={() => handleResolveArchiveConflict("overwrite_confirmed")}>
                Sobrescribir versión existente
              </CozyButton>
              <CozyButton
                size="sm"
                variant="wood"
                onClick={() => {
                  setPendingArchive(null);
                  setConflictTitle(null);
                }}
              >
                Cancelar
              </CozyButton>
            </div>
          </div>
        )}

        {workspace.patterns.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#3A2E2B]/30 bg-[#F4EEDC]/60 p-4 text-xs text-[#795548]">
            Guarda primero una versión inmutable en <strong>2. Compositor Visual</strong> (o importa un archivo JSON de proyecto arriba) para habilitar exportaciones PDF, SVG, PNG e instrucciones imprimibles.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <label className="space-y-1">
              <span className="font-black text-[#3A2E2B] block">Patrón</span>
              <select
                aria-label="Patrón a exportar"
                value={selectedPattern?.id || ""}
                onChange={(e) => {
                  setSelectedPatternId(e.target.value);
                  const found = workspace.patterns.find((p) => p.id === e.target.value);
                  if (found) setSelectedVersionNum(found.currentVersion);
                }}
                className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-2.5 py-1.5 font-bold text-[#3A2E2B]"
              >
                {workspace.patterns.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="font-black text-[#3A2E2B] block">Versión inmutable</span>
              <select
                aria-label="Versión inmutable a exportar"
                value={selectedVersion?.version || 1}
                onChange={(e) => setSelectedVersionNum(Number(e.target.value))}
                className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-2.5 py-1.5 font-bold text-[#3A2E2B]"
              >
                {(selectedPattern?.versions || []).map((v) => (
                  <option key={v.version} value={v.version}>
                    v{v.version} ({v.width}×{v.height})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="font-black text-[#3A2E2B] block">Referencia histórica (opcional)</span>
              <input
                type="text"
                value={historicalRefTitle}
                onChange={(e) => setHistoricalRefTitle(e.target.value)}
                placeholder="Ej. Álbum Filet 1924, pág. 12"
                className="w-full rounded-xl border-2 border-[#3A2E2B]/50 bg-[#FFFDF8] px-2.5 py-1.5 text-[#3A2E2B]"
              />
            </label>
          </div>
        )}
      </div>

      {exportModel && printableDoc && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Columna izquierda: Configuración de PDF, SVG, PNG y JSON */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-4 shadow-[0_6px_0_#3A2E2B] space-y-3 text-xs">
              <h5 className="font-black uppercase text-[#3A2E2B]">Configuración de salida</h5>

              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="font-bold text-[#5C381E] block">Convención de malla</span>
                  <select
                    value={meshSize}
                    onChange={(e) => setMeshSize(Number(e.target.value) as FiletMeshSize)}
                    className="w-full rounded-xl border border-[#3A2E2B] bg-[#F4EEDC] px-2 py-1 font-bold"
                  >
                    <option value={3}>Malla de 3 (1 cad int.)</option>
                    <option value={4}>Malla de 4 (2 cad int.)</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="font-bold text-[#5C381E] block">Dirección vuelta 1</span>
                  <select
                    value={firstRowDir}
                    onChange={(e) => setFirstRowDir(e.target.value as FiletRowDirection)}
                    className="w-full rounded-xl border border-[#3A2E2B] bg-[#F4EEDC] px-2 py-1 font-bold"
                  >
                    <option value="rtl">Der → Izq (invertida)</option>
                    <option value="ltr">Izq → Der (normal)</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="font-bold text-[#5C381E] block">Papel PDF</span>
                  <select
                    value={paperSize}
                    onChange={(e) => setPaperSize(e.target.value as ExportPaperSize)}
                    className="w-full rounded-xl border border-[#3A2E2B] bg-[#F4EEDC] px-2 py-1 font-bold"
                  >
                    {(Object.keys(PAPER_DIMENSIONS_PT) as ExportPaperSize[]).map((k) => (
                      <option key={k} value={k}>
                        {PAPER_DIMENSIONS_PT[k].label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="font-bold text-[#5C381E] block">Orientación PDF</span>
                  <select
                    value={paperOrientation}
                    onChange={(e) => setPaperOrientation(e.target.value as ExportPaperOrientation)}
                    className="w-full rounded-xl border border-[#3A2E2B] bg-[#F4EEDC] px-2 py-1 font-bold"
                  >
                    <option value="landscape">Horizontal</option>
                    <option value="portrait">Vertical</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="font-bold text-[#5C381E] block">Paginación PDF</span>
                  <select
                    value={paginationMode}
                    onChange={(e) => setPaginationMode(e.target.value as ExportPaginationMode)}
                    className="w-full rounded-xl border border-[#3A2E2B] bg-[#F4EEDC] px-2 py-1 font-bold"
                  >
                    <option value="fit_one_page">1. Ajustar a 1 página</option>
                    <option value="tile_pages">2. Dividir en páginas (continuidad)</option>
                    <option value="custom_scale">3. Escala física (mm/cuadro)</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="font-bold text-[#5C381E] block">DPI PNG</span>
                  <select
                    value={pngDpi}
                    onChange={(e) => setPngDpi(Number(e.target.value) as ExportPngDpi)}
                    className="w-full rounded-xl border border-[#3A2E2B] bg-[#F4EEDC] px-2 py-1 font-bold"
                  >
                    <option value={150}>150 DPI</option>
                    <option value={300}>300 DPI (impresión)</option>
                    <option value={600}>600 DPI (alta precisión)</option>
                  </select>
                </label>
              </div>

              {paginationMode === "custom_scale" && (
                <label className="block space-y-1">
                  <span className="font-bold text-[#5C381E]">Tamaño de cuadro ({cellSizeMm} mm)</span>
                  <input
                    type="range"
                    min={2}
                    max={10}
                    step={0.5}
                    value={cellSizeMm}
                    onChange={(e) => setCellSizeMm(Number(e.target.value))}
                    className="w-full"
                  />
                </label>
              )}

              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-1.5 font-bold text-[#5C381E]">
                  <input
                    type="checkbox"
                    checked={showPerimeterNumbers}
                    onChange={(e) => setShowPerimeterNumbers(e.target.checked)}
                  />
                  Numeración 4 lados
                </label>
                <label className="flex items-center gap-1.5 font-bold text-[#5C381E]">
                  <input
                    type="checkbox"
                    checked={showGridLines}
                    onChange={(e) => setShowGridLines(e.target.checked)}
                  />
                  Líneas de cuadrícula
                </label>
                <label className="flex items-center gap-1.5 font-bold text-[#5C381E]">
                  <input
                    type="checkbox"
                    checked={showLegend}
                    onChange={(e) => setShowLegend(e.target.checked)}
                  />
                  Leyenda
                </label>
                <label className="flex items-center gap-1.5 font-bold text-[#5C381E]">
                  <input
                    type="checkbox"
                    checked={transparentBg}
                    onChange={(e) => setTransparentBg(e.target.checked)}
                  />
                  Fondo transparente (PNG/SVG)
                </label>
                <label className="flex items-center gap-1.5 font-bold text-[#5C381E] col-span-2">
                  <input
                    type="checkbox"
                    checked={includeInstructionsPages}
                    onChange={(e) => setIncludeInstructionsPages(e.target.checked)}
                  />
                  Incluir páginas de instrucciones imprimibles en el PDF
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <label className="flex items-center gap-1 font-bold text-[#5C381E]">
                  Lleno:
                  <input
                    type="color"
                    value={filledColorHex}
                    onChange={(e) => setFilledColorHex(e.target.value)}
                  />
                </label>
                <label className="flex items-center gap-1 font-bold text-[#5C381E]">
                  Vacío:
                  <input
                    type="color"
                    value={emptyColorHex}
                    onChange={(e) => setEmptyColorHex(e.target.value)}
                  />
                </label>
                <label className="flex items-center gap-1 font-bold text-[#5C381E]">
                  Márgen:
                  <input
                    type="number"
                    min={5}
                    max={30}
                    value={marginMm}
                    onChange={(e) => setMarginMm(Number(e.target.value))}
                    className="w-14 rounded border border-[#3A2E2B] px-1 py-0.5"
                  />
                  mm
                </label>
                <label className="flex items-center gap-1 font-bold text-[#5C381E]">
                  Celda:
                  <input
                    type="number"
                    min={4}
                    max={48}
                    value={pngCellPx}
                    onChange={(e) => setPngCellPx(Number(e.target.value))}
                    className="w-14 rounded border border-[#3A2E2B] px-1 py-0.5"
                  />
                  px
                </label>
              </div>

              {/* Botones de descarga */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                <CozyButton
                  size="sm"
                  variant="forest"
                  data-testid="export-pdf-btn"
                  onClick={handleExportPdf}
                  className="inline-flex items-center justify-center gap-1.5"
                >
                  <FileText className="h-3.5 w-3.5" /> Exportar PDF Vectorial
                </CozyButton>
                <CozyButton
                  size="sm"
                  variant="clay"
                  data-testid="export-svg-btn"
                  onClick={handleExportSvg}
                  className="inline-flex items-center justify-center gap-1.5"
                >
                  <FileCode2 className="h-3.5 w-3.5" /> Exportar SVG
                </CozyButton>
                <CozyButton
                  size="sm"
                  variant="wood"
                  data-testid="export-png-btn"
                  onClick={handleExportPng}
                  className="inline-flex items-center justify-center gap-1.5"
                >
                  <FileImage className="h-3.5 w-3.5" /> Exportar PNG ({pngDpi} DPI)
                </CozyButton>
                <CozyButton
                  size="sm"
                  variant="wood"
                  data-testid="export-json-btn"
                  onClick={handleExportJsonArchive}
                  className="inline-flex items-center justify-center gap-1.5"
                >
                  <FileJson className="h-3.5 w-3.5" /> Exportar Proyecto JSON
                </CozyButton>
                <CozyButton
                  size="sm"
                  variant="forest"
                  data-testid="export-instructions-btn"
                  onClick={handleExportInstructionsMd}
                  className="sm:col-span-2 inline-flex items-center justify-center gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" /> Descargar Instrucciones Imprimibles (.md)
                </CozyButton>
              </div>
            </div>
          </div>

          {/* Columna derecha: Vista previa vectorial + Hoja de instrucciones */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-4 shadow-[0_6px_0_#3A2E2B] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-black uppercase text-[#3A2E2B] inline-flex items-center gap-1.5">
                  <Download className="h-3.5 w-3.5 text-[#314C3C]" />
                  Vista previa vectorial exacta ({exportModel.gridWidth}×{exportModel.gridHeight})
                </span>
                <span className="text-[11px] font-bold text-[#795548]">
                  v{exportModel.versionNumber} · Malla {exportModel.meshSize}
                </span>
              </div>
              <div
                data-testid="export-svg-preview"
                className="max-h-72 overflow-auto rounded-2xl border-2 border-[#3A2E2B]/30 bg-[#F4EEDC] p-2"
                dangerouslySetInnerHTML={{ __html: svgPreview }}
              />
            </div>

            <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-4 shadow-[0_6px_0_#3A2E2B] space-y-2">
              <h5 className="text-xs font-black uppercase text-[#3A2E2B]">
                Instrucciones imprimibles verificadas ({printableDoc.rows.length} vueltas)
              </h5>
              <p className="text-[11px] text-[#5C381E]">
                <strong>Montaje (base):</strong> {printableDoc.foundationChains} cad ({printableDoc.foundationFormula}).{" "}
                <strong>Subida:</strong> {printableDoc.turningChainsFilled} cad lleno / {printableDoc.turningChainsEmpty} cad vacío.
              </p>
              <p className="text-[10px] text-[#795548] italic">
                {printableDoc.conventionDisclaimer}
              </p>
              <div className="max-h-44 overflow-y-auto rounded-2xl border border-[#3A2E2B]/25 bg-[#F4EEDC]/50 p-2.5 font-mono text-[11px] space-y-1">
                {printableDoc.rows.slice(0, 24).map((r) => (
                  <p key={r.rowNumber}>
                    {r.checkbox} V{r.rowNumber} ({r.directionLabel}) [{r.filledCount}L/{r.emptyCount}V={r.totalWidth}]:{" "}
                    {r.segmentsText}
                  </p>
                ))}
                {printableDoc.rows.length > 24 && (
                  <p className="text-[#795548]">
                    ... (+{printableDoc.rows.length - 24} vueltas adicionales incluidas en el PDF / archivo descargable)
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
