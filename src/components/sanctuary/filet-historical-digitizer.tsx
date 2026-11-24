"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Contrast,
  Crop,
  FileImage,
  FileText,
  Grid3X3,
  Hand,
  Redo2,
  RotateCcw,
  RotateCw,
  Save,
  ScanLine,
  Sliders,
  Undo2,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { CozyButton, CozyNotification } from "@/components/cozy/ui";
import {
  FILET_MAX_GLYPH_DIM,
  FILET_MIN_DIM,
  cloneBinaryMatrix,
  createMatrixHistory,
  pushMatrixHistory,
  redoMatrixHistory,
  toggleMatrixCell,
  undoMatrixHistory,
  type BinaryMatrix,
  type FiletStudioWorkspace,
  type MatrixHistoryState,
} from "@/lib/sanctuary/filet-crochet-engine";
import {
  autoSuggestThresholdOtsu,
  buildConfirmedHistoricalGlyph,
  clampRegionToImage,
  createDefaultGridCalibration,
  createDefaultImageProcessing,
  createManualEmptyDigitization,
  detectDuplicateGlyphInCollection,
  detectGridLinesAssisted,
  digitizeCalibratedGrid,
  extractRegionRGBA,
  rotateRGBAOrthogonal,
  toGrayscaleLuminance,
  validateHistoricalDocumentInput,
  type DigitizationResult,
  type DigitizerRegionRect,
  type GridCalibrationParams,
  type HistoricalDocumentMime,
  type HistoricalDocumentRecord,
  type ImageProcessingParams,
  type RGBAImageData,
} from "@/lib/sanctuary/filet-digitizer-engine";
import {
  readHistoricalDocumentsSafe,
  saveHistoricalDocumentsSafe,
} from "@/lib/sanctuary/filet-crochet-store";
import {
  loadPdfDocumentLocal,
  type LoadedLocalPdfHandle,
} from "@/lib/sanctuary/pdf-local-renderer";

interface FiletHistoricalDigitizerProps {
  sessionOwner?: string;
  workspace: FiletStudioWorkspace;
  onPersistWorkspace: (next: FiletStudioWorkspace, silent?: boolean) => void;
  onJumpToComposer?: () => void;
}

const VIEW_ZOOMS = [25, 50, 75, 100, 125, 150, 200, 250, 300] as const;

async function decodeImageFileToRGBA(
  file: File
): Promise<{ rgba: RGBAImageData; dataUrl: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo de imagen."));
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new window.Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("La imagen está dañada o no es decodificable."));
    el.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Contexto Canvas 2D no disponible.");
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  return {
    rgba: {
      width: canvas.width,
      height: canvas.height,
      data: new Uint8ClampedArray(imageData.data),
    },
    dataUrl,
  };
}

function rgbaToDataUrl(rgba: RGBAImageData): string {
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = rgba.width;
  canvas.height = rgba.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const imgData = new ImageData(new Uint8ClampedArray(rgba.data), rgba.width, rgba.height);
  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL("image/png");
}

export function FiletHistoricalDigitizer({
  sessionOwner,
  workspace,
  onPersistWorkspace,
  onJumpToComposer,
}: FiletHistoricalDigitizerProps) {
  // Biblioteca de documentos históricos aislada por propietario
  const [documents, setDocuments] = useState<HistoricalDocumentRecord[]>(() =>
    readHistoricalDocumentsSafe(sessionOwner)
  );
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [uploadToPrivateAtelier, setUploadToPrivateAtelier] = useState<boolean>(true);
  const [importing, setImporting] = useState<boolean>(false);

  // Estado de página / imagen original (NUNCA se muta el buffer original)
  const pdfHandleRef = useRef<LoadedLocalPdfHandle | null>(null);
  const originalImageByDocRef = useRef<Map<string, RGBAImageData>>(new Map());
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [thumbnails, setThumbnails] = useState<Array<{ page: number; dataUrl: string }>>([]);
  const [pageOriginalRGBA, setPageOriginalRGBA] = useState<RGBAImageData | null>(null);
  const [workRotationDeg, setWorkRotationDeg] = useState<0 | 90 | 180 | 270>(0);
  const [viewZoomPct, setViewZoomPct] = useState<number>(100);

  // Selección de región rectangular sobre la imagen de trabajo
  const [region, setRegion] = useState<DigitizerRegionRect>({ x: 0, y: 0, width: 120, height: 150 });
  const dragRectRef = useRef<{ startX: number; startY: number } | null>(null);

  // Calibración y procesamiento (Bloques 2 y 3)
  const [calibration, setCalibration] = useState<GridCalibrationParams>(() =>
    createDefaultGridCalibration(120, 150, 9, 7)
  );
  const [processing, setProcessing] = useState<ImageProcessingParams>(() =>
    createDefaultImageProcessing()
  );
  const [manualOnlyMode, setManualOnlyMode] = useState<boolean>(false);

  // Revisión y corrección (Bloque 4)
  const [detectionResult, setDetectionResult] = useState<DigitizationResult | null>(null);
  const [editHistory, setEditHistory] = useState<MatrixHistoryState>(() =>
    createMatrixHistory(createManualEmptyDigitization(9, 7).detectedMatrix)
  );
  const [matrixZoomPx, setMatrixZoomPx] = useState<number>(22);

  // Guardado en Biblioteca Histórica (Bloque 5)
  const [targetCollectionId, setTargetCollectionId] = useState<string>(
    () => workspace.collections[0]?.id || ""
  );
  const [glyphSymbol, setGlyphSymbol] = useState<string>("");
  const [glyphName, setGlyphName] = useState<string>("");
  const [glyphStyle, setGlyphStyle] = useState<string>("Histórico clásico");
  const [glyphNotes, setGlyphNotes] = useState<string>("");
  const [duplicateStrategy, setDuplicateStrategy] = useState<"variant" | "replace">("variant");
  const [variantLabel, setVariantLabel] = useState<string>("");
  const [explicitReviewConfirmed, setExplicitReviewConfirmed] = useState<boolean>(false);
  const [savedCountInSession, setSavedCountInSession] = useState<number>(0);

  // Panel móvil (Bloque 6)
  const [mobilePanel, setMobilePanel] = useState<"docs" | "canvas" | "review">("canvas");
  const [notice, setNotice] = useState<{
    type: "success" | "warning" | "error";
    message: string;
  } | null>(null);

  // Recargar documentos aislados al cambiar de usuario
  useEffect(() => {
    const loaded = readHistoricalDocumentsSafe(sessionOwner);
    setDocuments(loaded);
    setSelectedDocId(loaded[0]?.id || "");
  }, [sessionOwner]);

  // Limpiar PDF handle al desmontar
  useEffect(() => {
    return () => {
      if (pdfHandleRef.current) {
        pdfHandleRef.current.destroy().catch(() => {});
      }
    };
  }, []);

  const selectedDoc = useMemo(
    () => documents.find((d) => d.id === selectedDocId) || null,
    [documents, selectedDocId]
  );

  const targetCollection = useMemo(
    () =>
      workspace.collections.find((c) => c.id === targetCollectionId) ||
      workspace.collections[0],
    [workspace.collections, targetCollectionId]
  );

  // Imagen de trabajo derivada (rotación ortogonal sobre copia; original intacto)
  const workingPageRGBA = useMemo(() => {
    if (!pageOriginalRGBA) return null;
    return rotateRGBAOrthogonal(pageOriginalRGBA, workRotationDeg);
  }, [pageOriginalRGBA, workRotationDeg]);

  const workingPageDataUrl = useMemo(() => {
    if (!workingPageRGBA) return "";
    return rgbaToDataUrl(workingPageRGBA);
  }, [workingPageRGBA]);

  // Región recortada derivada (copia limpia)
  const croppedRegionRGBA = useMemo(() => {
    if (!workingPageRGBA) return null;
    return extractRegionRGBA(workingPageRGBA, region);
  }, [workingPageRGBA, region]);

  const croppedRegionDataUrl = useMemo(() => {
    if (!croppedRegionRGBA) return "";
    return rgbaToDataUrl(croppedRegionRGBA);
  }, [croppedRegionRGBA]);

  // Ejecutar digitalización determinista cada vez que cambian región, calibración o procesamiento
  useEffect(() => {
    if (manualOnlyMode) {
      const manual = createManualEmptyDigitization(calibration.rows, calibration.cols);
      setDetectionResult(manual);
      setEditHistory(createMatrixHistory(manual.detectedMatrix));
      setExplicitReviewConfirmed(false);
      return;
    }
    if (!croppedRegionRGBA) return;
    const result = digitizeCalibratedGrid(croppedRegionRGBA, calibration, processing);
    setDetectionResult(result);
    setEditHistory(createMatrixHistory(result.detectedMatrix));
    setExplicitReviewConfirmed(false);
  }, [croppedRegionRGBA, calibration, processing, manualOnlyMode]);

  // Detectar duplicados en la colección objetivo
  const duplicateCheck = useMemo(() => {
    if (!targetCollection || !glyphSymbol.trim()) {
      return { hasDuplicate: false, existingGlyphs: [], suggestedVariantLabel: "" };
    }
    return detectDuplicateGlyphInCollection(targetCollection, glyphSymbol);
  }, [targetCollection, glyphSymbol]);

  useEffect(() => {
    if (duplicateCheck.hasDuplicate && !variantLabel) {
      setVariantLabel(duplicateCheck.suggestedVariantLabel);
    }
  }, [duplicateCheck.hasDuplicate, duplicateCheck.suggestedVariantLabel, variantLabel]);

  // Cargar página específica de PDF activo
  const loadPdfPage = useCallback(async (handle: LoadedLocalPdfHandle, pageNum: number) => {
    const rendered = await handle.renderPageToRGBA(pageNum, 1.8);
    setCurrentPage(pageNum);
    setPageOriginalRGBA(rendered.rgba);
    setWorkRotationDeg(0);
    const initReg = clampRegionToImage(
      {
        x: Math.floor(rendered.rgba.width * 0.1),
        y: Math.floor(rendered.rgba.height * 0.1),
        width: Math.min(260, Math.floor(rendered.rgba.width * 0.5)),
        height: Math.min(260, Math.floor(rendered.rgba.height * 0.5)),
      },
      rendered.rgba.width,
      rendered.rgba.height
    );
    setRegion(initReg);
    setCalibration((prev) =>
      createDefaultGridCalibration(initReg.width, initReg.height, prev.rows, prev.cols)
    );
  }, []);

  // Importar documento histórico (PDF, PNG, JPEG, WEBP) con validación estricta
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const baseValidation = validateHistoricalDocumentInput({
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        bytes,
      });

      if (!baseValidation.valid || !baseValidation.normalizedMime) {
        setNotice({
          type: "error",
          message: baseValidation.error || "Archivo rechazado por validación de seguridad.",
        });
        return;
      }

      let pageCount = 1;
      let widthPx: number | undefined;
      let heightPx: number | undefined;
      let previewDataUrl: string | undefined;

      if (baseValidation.normalizedMime === "application/pdf") {
        if (pdfHandleRef.current) {
          await pdfHandleRef.current.destroy().catch(() => {});
        }
        const handle = await loadPdfDocumentLocal(bytes);
        const pageValidation = validateHistoricalDocumentInput({
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          pageCount: handle.pageCount,
        });
        if (!pageValidation.valid) {
          await handle.destroy();
          setNotice({ type: "error", message: pageValidation.error || "PDF excede límites." });
          return;
        }
        pdfHandleRef.current = handle;
        pageCount = handle.pageCount;
        setTotalPages(pageCount);
        await loadPdfPage(handle, 1);

        // Generar miniaturas de las primeras 12 páginas de forma liviana
        const thumbs: Array<{ page: number; dataUrl: string }> = [];
        for (let p = 1; p <= Math.min(pageCount, 12); p++) {
          thumbs.push({ page: p, dataUrl: await handle.renderThumbnailDataUrl(p, 84) });
        }
        setThumbnails(thumbs);
      } else {
        if (pdfHandleRef.current) {
          await pdfHandleRef.current.destroy().catch(() => {});
          pdfHandleRef.current = null;
        }
        const decoded = await decodeImageFileToRGBA(file);
        const dimValidation = validateHistoricalDocumentInput({
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          widthPx: decoded.rgba.width,
          heightPx: decoded.rgba.height,
        });
        if (!dimValidation.valid) {
          setNotice({
            type: "error",
            message: dimValidation.error || "Dimensiones de imagen fuera de límites.",
          });
          return;
        }
        widthPx = decoded.rgba.width;
        heightPx = decoded.rgba.height;
        previewDataUrl = decoded.dataUrl.length <= 450_000 ? decoded.dataUrl : undefined;
        setTotalPages(1);
        setCurrentPage(1);
        setThumbnails([{ page: 1, dataUrl: decoded.dataUrl }]);
        setPageOriginalRGBA(decoded.rgba);
        setWorkRotationDeg(0);
        const initReg: DigitizerRegionRect = {
          x: 0,
          y: 0,
          width: decoded.rgba.width,
          height: decoded.rgba.height,
        };
        setRegion(initReg);
        setCalibration((prev) =>
          createDefaultGridCalibration(initReg.width, initReg.height, prev.rows, prev.cols)
        );
      }

      // Opcional: guardar copia del documento original intacto en /api/resources (atelier)
      let resourceId: string | undefined;
      let source: HistoricalDocumentRecord["source"] = "local_private";
      if (uploadToPrivateAtelier) {
        try {
          const form = new FormData();
          form.append("buildingId", "atelier");
          form.append("resourceType", "historical_alphabet_document");
          form.append("title", file.name.replace(/\.[^.]+$/, ""));
          form.append("description", "Documento histórico original para Filet Crochet Studio");
          form.append("tags", "filet-crochet,alfabeto-historico,original");
          form.append("file", file);
          const upRes = await fetch("/api/resources", { method: "POST", body: form });
          if (upRes.ok) {
            const upJson = (await upRes.json()) as { resource?: { id?: string } };
            resourceId = upJson.resource?.id;
            source = "atelier_resource";
          }
        } catch {
          // Conserva el documento en sesión local si está offline
        }
      }

      const newDoc: HistoricalDocumentRecord = {
        id: `hdoc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: file.name.replace(/\.[^.]+$/, "").slice(0, 120),
        filename: baseValidation.safeFilename || file.name,
        mimeType: baseValidation.normalizedMime as HistoricalDocumentMime,
        sizeBytes: file.size,
        pageCount,
        widthPx,
        heightPx,
        source,
        resourceId,
        previewDataUrl,
        addedAt: new Date().toISOString(),
      };

      if (pageOriginalRGBA && baseValidation.normalizedMime !== "application/pdf") {
        originalImageByDocRef.current.set(newDoc.id, pageOriginalRGBA);
      }

      const nextDocs = [newDoc, ...documents.filter((d) => d.id !== newDoc.id)];
      setDocuments(nextDocs);
      setSelectedDocId(newDoc.id);
      saveHistoricalDocumentsSafe(sessionOwner, nextDocs);

      setNotice({
        type: "success",
        message: `Documento "${newDoc.title}" importado (${pageCount} pág.) conservando el original sin modificar.`,
      });
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Error al importar el documento histórico.",
      });
    } finally {
      setImporting(false);
    }
  };

  // Detección asistida de líneas + umbral Otsu sobre la región actual
  const handleAssistedDetection = () => {
    if (!croppedRegionRGBA) return;
    const gray = toGrayscaleLuminance(croppedRegionRGBA, {
      contrast: processing.contrast,
      invert: processing.invert,
    });
    const otsu = autoSuggestThresholdOtsu(gray);
    const assisted = detectGridLinesAssisted(
      gray,
      croppedRegionRGBA.width,
      croppedRegionRGBA.height,
      otsu
    );
    setProcessing((prev) => ({ ...prev, threshold: otsu }));
    if (assisted.detected) {
      setCalibration((prev) => ({
        ...prev,
        rows: assisted.estimatedRows,
        cols: assisted.estimatedCols,
        originX: assisted.suggestedOriginX,
        originY: assisted.suggestedOriginY,
        cellWidth: assisted.estimatedCellWidth,
        cellHeight: assisted.estimatedCellHeight,
        offsetX: 0,
        offsetY: 0,
      }));
    }
    setNotice({
      type: assisted.detected ? "success" : "warning",
      message: `${assisted.note} (Umbral sugerido Otsu: ${otsu}).`,
    });
  };

  const handleApplyOtsu = () => {
    if (!croppedRegionRGBA) return;
    const gray = toGrayscaleLuminance(croppedRegionRGBA, {
      contrast: processing.contrast,
      invert: processing.invert,
    });
    const otsu = autoSuggestThresholdOtsu(gray);
    setProcessing((prev) => ({ ...prev, threshold: otsu }));
  };

  const handleToggleCell = (r: number, c: number) => {
    setEditHistory((prev) => pushMatrixHistory(prev, toggleMatrixCell(prev.present, r, c)));
  };

  const handleRestoreInitialDetection = () => {
    if (!detectionResult) return;
    setEditHistory((prev) =>
      pushMatrixHistory(prev, cloneBinaryMatrix(detectionResult.detectedMatrix))
    );
  };

  // Guardar glifo confirmado en Biblioteca Histórica (Bloque 5)
  const handleConfirmAndSaveGlyph = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCollection || !glyphSymbol.trim()) {
      setNotice({ type: "error", message: "Indica el carácter y la colección destino." });
      return;
    }
    if (!explicitReviewConfirmed) {
      setNotice({
        type: "warning",
        message: "Debes marcar la confirmación explícita antes de guardar el glifo digitalizado.",
      });
      return;
    }
    if (!detectionResult) return;

    const newGlyph = buildConfirmedHistoricalGlyph({
      symbol: glyphSymbol.trim(),
      name: glyphName.trim() || `Letra ${glyphSymbol.trim()}`,
      style: glyphStyle.trim() || "Histórico",
      variantLabel:
        duplicateCheck.hasDuplicate && duplicateStrategy === "variant"
          ? variantLabel.trim() || duplicateCheck.suggestedVariantLabel
          : undefined,
      confirmedMatrix: editHistory.present,
      initiallyDetectedMatrix: detectionResult.detectedMatrix,
      documentId: selectedDoc?.id || "manual_local",
      documentTitle: selectedDoc?.title || "Digitalización manual",
      pageNumber: currentPage,
      region,
      calibration,
      processing,
      sourceResourceId: selectedDoc?.resourceId,
      manualModeUsed: manualOnlyMode,
      notes: glyphNotes.trim(),
    });

    const nowIso = new Date().toISOString();
    const nextWorkspace: FiletStudioWorkspace = {
      ...workspace,
      updatedAt: nowIso,
      collections: workspace.collections.map((col) => {
        if (col.id !== targetCollection.id) return col;
        let nextGlyphs = col.glyphs;
        if (duplicateCheck.hasDuplicate && duplicateStrategy === "replace") {
          const targetId = duplicateCheck.existingGlyphs[0]?.id;
          nextGlyphs = col.glyphs.map((g) => (g.id === targetId ? newGlyph : g));
        } else {
          nextGlyphs = [...col.glyphs, newGlyph];
        }
        return { ...col, glyphs: nextGlyphs, updatedAt: nowIso };
      }),
    };

    onPersistWorkspace(nextWorkspace, false);
    setSavedCountInSession((n) => n + 1);
    setGlyphSymbol("");
    setGlyphName("");
    setVariantLabel("");
    setGlyphNotes("");
    setExplicitReviewConfirmed(false);
    setNotice({
      type: "success",
      message: `Glifo "${newGlyph.symbol}" guardado en "${targetCollection.name}" y disponible ya en el Compositor. Puedes seleccionar otra letra en esta misma página.`,
    });
  };

  // Arrastre rectangular en el panel central para definir la región de recorte
  const handleImagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!workingPageRGBA) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = viewZoomPct / 100;
    const x = Math.max(0, Math.min(workingPageRGBA.width - 1, Math.round((e.clientX - rect.left) / scale)));
    const y = Math.max(0, Math.min(workingPageRGBA.height - 1, Math.round((e.clientY - rect.top) / scale)));
    dragRectRef.current = { startX: x, startY: y };
  };

  const handleImagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRectRef.current || !workingPageRGBA) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = viewZoomPct / 100;
    const curX = Math.max(0, Math.min(workingPageRGBA.width, Math.round((e.clientX - rect.left) / scale)));
    const curY = Math.max(0, Math.min(workingPageRGBA.height, Math.round((e.clientY - rect.top) / scale)));
    const x = Math.min(dragRectRef.current.startX, curX);
    const y = Math.min(dragRectRef.current.startY, curY);
    const width = Math.max(8, Math.abs(curX - dragRectRef.current.startX));
    const height = Math.max(8, Math.abs(curY - dragRectRef.current.startY));
    const nextReg = clampRegionToImage({ x, y, width, height }, workingPageRGBA.width, workingPageRGBA.height);
    setRegion(nextReg);
    setCalibration((prev) => ({
      ...prev,
      originX: 0,
      originY: 0,
      cellWidth: Math.max(2, Number((nextReg.width / prev.cols).toFixed(2))),
      cellHeight: Math.max(2, Number((nextReg.height / prev.rows).toFixed(2))),
    }));
  };

  const handleImagePointerUp = () => {
    dragRectRef.current = null;
  };

  const ambiguousSet = useMemo(() => {
    const s = new Set<string>();
    for (const a of detectionResult?.ambiguousCells || []) {
      s.add(`${a.row},${a.col}`);
    }
    return s;
  }, [detectionResult]);

  const zoomIdx = VIEW_ZOOMS.indexOf(viewZoomPct as (typeof VIEW_ZOOMS)[number]);

  return (
    <div className="space-y-4">
      {notice && (
        <CozyNotification
          variant={notice.type}
          title="Digitalizador Histórico"
          message={notice.message}
          onDismiss={() => setNotice(null)}
        />
      )}

      {/* Barra móvil para alternar entre los 3 paneles (Bloque 6: prioriza consulta y corrección en celular) */}
      <div className="flex lg:hidden gap-1.5">
        {(
          [
            { id: "docs", label: "1. Documentos" },
            { id: "canvas", label: "2. Imagen / Región" },
            { id: "review", label: "3. Matriz y Guardar" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMobilePanel(tab.id)}
            className={`flex-1 rounded-xl border-2 px-2 py-1.5 text-[11px] font-black cursor-pointer ${
              mobilePanel === tab.id
                ? "border-[#3A2E2B] bg-[#314C3C] text-[#FFFDF8]"
                : "border-[#3A2E2B]/35 bg-[#F4EEDC] text-[#3A2E2B]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Interfaz profesional de 3 paneles (Izquierda: documentos · Centro: imagen+cuadrícula · Derecha: calibración+matriz) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* PANEL IZQUIERDO: Biblioteca de Documentos Históricos y Páginas */}
        <div
          className={`lg:col-span-3 space-y-3 ${
            mobilePanel === "docs" ? "block" : "hidden lg:block"
          }`}
        >
          <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-4 shadow-[0_6px_0_#3A2E2B] space-y-3">
            <div>
              <span className="text-[10px] font-black uppercase text-[#795548] block">
                Panel 1 · Biblioteca Histórica
              </span>
              <h4 className="text-xs font-black text-[#3A2E2B]">
                Documentos (PDF, PNG, JPEG, WEBP)
              </h4>
            </div>

            <label className="flex items-center justify-center gap-1.5 rounded-2xl border-2 border-[#3A2E2B] bg-[#314C3C] px-3 py-2 text-xs font-black text-[#FFFDF8] hover:bg-[#3E5F4C] cursor-pointer">
              <Upload className="h-3.5 w-3.5" />
              <span>{importing ? "Validando..." : "Importar Documento"}</span>
              <input
                type="file"
                accept=".pdf,image/png,image/jpeg,image/webp"
                disabled={importing}
                onChange={handleImportFile}
                className="hidden"
              />
            </label>

            <label className="flex items-start gap-2 text-[10px] font-bold text-[#5C381E] cursor-pointer">
              <input
                type="checkbox"
                checked={uploadToPrivateAtelier}
                onChange={(e) => setUploadToPrivateAtelier(e.target.checked)}
                className="mt-0.5"
              />
              <span>Guardar original sin modificar en Carpeta Privada del Atelier (/api/resources)</span>
            </label>

            <p className="text-[10px] text-[#795548]">
              Límites seguros: máx. 5 MB, 4096px / 16 MP, 60 páginas PDF. Procesamiento 100 % local sin IA externa ni OCR.
            </p>

            {/* Lista de documentos */}
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {documents.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#3A2E2B]/30 bg-[#F4EEDC]/60 p-2.5 text-[11px] text-[#795548]">
                  Importa una lámina o PDF histórico de Filet Crochet para empezar.
                </p>
              ) : (
                documents.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setSelectedDocId(doc.id)}
                    className={`w-full rounded-xl border-2 p-2 text-left text-[11px] cursor-pointer ${
                      doc.id === selectedDocId
                        ? "border-[#3A2E2B] bg-[#F4EEDC] font-black text-[#3A2E2B]"
                        : "border-[#3A2E2B]/25 bg-[#FFFDF8] text-[#5C381E]"
                    }`}
                  >
                    <span className="flex items-center gap-1 truncate">
                      {doc.mimeType === "application/pdf" ? (
                        <FileText className="h-3.5 w-3.5 shrink-0 text-[#C88973]" />
                      ) : (
                        <FileImage className="h-3.5 w-3.5 shrink-0 text-[#314C3C]" />
                      )}
                      <span className="truncate">{doc.title}</span>
                    </span>
                    <span className="text-[10px] text-[#795548] block">
                      {doc.pageCount} pág. · {Math.max(1, Math.round(doc.sizeBytes / 1024))} KB
                    </span>
                  </button>
                ))
              )}
            </div>

            {/* Navegación y miniaturas de páginas */}
            {totalPages > 0 && thumbnails.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-[#3A2E2B]/15">
                <div className="flex items-center justify-between text-[11px] font-black text-[#3A2E2B]">
                  <button
                    type="button"
                    disabled={currentPage <= 1 || !pdfHandleRef.current}
                    onClick={() => pdfHandleRef.current && loadPdfPage(pdfHandleRef.current, currentPage - 1)}
                    aria-label="Página anterior"
                    className="rounded-lg border border-[#3A2E2B] bg-[#F4EEDC] p-1 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span>
                    Pág. {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages || !pdfHandleRef.current}
                    onClick={() => pdfHandleRef.current && loadPdfPage(pdfHandleRef.current, currentPage + 1)}
                    aria-label="Página siguiente"
                    className="rounded-lg border border-[#3A2E2B] bg-[#F4EEDC] p-1 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
                  {thumbnails.map((t) => (
                    <button
                      key={t.page}
                      type="button"
                      onClick={() => pdfHandleRef.current && loadPdfPage(pdfHandleRef.current, t.page)}
                      className={`rounded-lg border-2 overflow-hidden p-0.5 cursor-pointer ${
                        t.page === currentPage
                          ? "border-[#314C3C] bg-[#314C3C]/10"
                          : "border-[#3A2E2B]/25 bg-[#FFFDF8]"
                      }`}
                    >
                      <img
                        src={t.dataUrl}
                        alt={`Miniatura página ${t.page}`}
                        className="w-full h-14 object-contain bg-white"
                      />
                      <span className="block text-center text-[9px] font-black text-[#3A2E2B]">
                        P.{t.page}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {savedCountInSession > 0 && (
              <div className="rounded-xl border border-[#314C3C]/40 bg-[#314C3C]/10 p-2 text-[11px] font-bold text-[#314C3C] flex items-center justify-between gap-2">
                <span>{savedCountInSession} letra(s) guardada(s) en esta sesión.</span>
                {onJumpToComposer && (
                  <button
                    type="button"
                    onClick={onJumpToComposer}
                    className="underline font-black cursor-pointer"
                  >
                    Ir al Compositor ➜
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* PANEL CENTRAL: Imagen original con selección de región y cuadrícula calibrada superpuesta */}
        <div
          className={`lg:col-span-5 space-y-3 ${
            mobilePanel === "canvas" ? "block" : "hidden lg:block"
          }`}
        >
          <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-4 shadow-[0_6px_0_#3A2E2B] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-black uppercase text-[#795548] block">
                  Panel 2 · Visor Original (Copia de Trabajo)
                </span>
                <h4 className="text-xs font-black text-[#3A2E2B]">
                  Arrastra para seleccionar región · Cuadrícula superpuesta
                </h4>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="Rotar imagen de trabajo 90° antihorario"
                  onClick={() =>
                    setWorkRotationDeg((prev) => (((prev + 270) % 360) as 0 | 90 | 180 | 270))
                  }
                  className="rounded-lg border border-[#3A2E2B] bg-[#F4EEDC] p-1 text-[#3A2E2B] cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Rotar imagen de trabajo 90° horario"
                  onClick={() =>
                    setWorkRotationDeg((prev) => (((prev + 90) % 360) as 0 | 90 | 180 | 270))
                  }
                  className="rounded-lg border border-[#3A2E2B] bg-[#F4EEDC] p-1 text-[#3A2E2B] cursor-pointer"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Alejar página"
                  disabled={zoomIdx <= 0}
                  onClick={() => setViewZoomPct(VIEW_ZOOMS[Math.max(0, zoomIdx - 1)])}
                  className="rounded-lg border border-[#3A2E2B] bg-[#F4EEDC] p-1 text-[#3A2E2B] disabled:opacity-40 cursor-pointer"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="font-mono text-[10px] font-black text-[#3A2E2B] min-w-[36px] text-center">
                  {viewZoomPct}%
                </span>
                <button
                  type="button"
                  aria-label="Acercar página"
                  disabled={zoomIdx >= VIEW_ZOOMS.length - 1}
                  onClick={() =>
                    setViewZoomPct(VIEW_ZOOMS[Math.min(VIEW_ZOOMS.length - 1, zoomIdx + 1)])
                  }
                  className="rounded-lg border border-[#3A2E2B] bg-[#F4EEDC] p-1 text-[#3A2E2B] disabled:opacity-40 cursor-pointer"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {!workingPageRGBA || !workingPageDataUrl ? (
              <div className="rounded-2xl border-2 border-dashed border-[#3A2E2B]/30 bg-[#F4EEDC]/60 p-8 text-center space-y-2 text-xs text-[#795548]">
                <Crop className="h-7 w-7 mx-auto text-[#C88973]" />
                <p className="font-bold text-[#3A2E2B]">
                  Sin documento cargado en el visor todavía.
                </p>
                <p className="text-[11px]">
                  Importa un PDF o imagen histórica en el Panel 1, o activa el <strong>Modo 100 % Manual</strong> en el Panel 3.
                </p>
              </div>
            ) : (
              <div className="overflow-auto max-h-[500px] rounded-2xl border-2 border-[#3A2E2B] bg-[#2B2220]/10 p-2 select-none">
                <div
                  onPointerDown={handleImagePointerDown}
                  onPointerMove={handleImagePointerMove}
                  onPointerUp={handleImagePointerUp}
                  style={{
                    width: Math.round((workingPageRGBA.width * viewZoomPct) / 100),
                    height: Math.round((workingPageRGBA.height * viewZoomPct) / 100),
                  }}
                  className="relative cursor-crosshair inline-block"
                >
                  <img
                    src={workingPageDataUrl}
                    alt="Página histórica de trabajo"
                    draggable={false}
                    className="w-full h-full block"
                  />

                  {/* Rectángulo de región seleccionada + cuadrícula calibrada superpuesta */}
                  <div
                    style={{
                      left: `${(region.x / workingPageRGBA.width) * 100}%`,
                      top: `${(region.y / workingPageRGBA.height) * 100}%`,
                      width: `${(region.width / workingPageRGBA.width) * 100}%`,
                      height: `${(region.height / workingPageRGBA.height) * 100}%`,
                    }}
                    className="absolute border-2 border-[#314C3C] bg-[#314C3C]/5 pointer-events-none"
                  >
                    <svg
                      viewBox={`0 0 ${region.width} ${region.height}`}
                      className="w-full h-full"
                      style={{ opacity: calibration.gridOpacity }}
                    >
                      <g
                        transform={`rotate(${calibration.rotationDeg} ${region.width / 2} ${region.height / 2})`}
                      >
                        {Array.from({ length: calibration.cols + 1 }, (_, c) => {
                          const x = calibration.originX + calibration.offsetX + c * calibration.cellWidth;
                          return (
                            <line
                              key={`gv-${c}`}
                              x1={x}
                              y1={calibration.originY + calibration.offsetY}
                              x2={x}
                              y2={
                                calibration.originY +
                                calibration.offsetY +
                                calibration.rows * calibration.cellHeight
                              }
                              stroke="#E11D48"
                              strokeWidth={1}
                            />
                          );
                        })}
                        {Array.from({ length: calibration.rows + 1 }, (_, r) => {
                          const y = calibration.originY + calibration.offsetY + r * calibration.cellHeight;
                          return (
                            <line
                              key={`gh-${r}`}
                              x1={calibration.originX + calibration.offsetX}
                              y1={y}
                              x2={
                                calibration.originX +
                                calibration.offsetX +
                                calibration.cols * calibration.cellWidth
                              }
                              y2={y}
                              stroke="#E11D48"
                              strokeWidth={1}
                            />
                          );
                        })}
                      </g>
                    </svg>
                  </div>
                </div>
              </div>
            )}

            {/* Ajuste manual preciso de bordes de la región */}
            <div className="grid grid-cols-4 gap-1.5 text-[10px] font-bold text-[#5C381E]">
              {(
                [
                  { key: "x", label: "Región X" },
                  { key: "y", label: "Región Y" },
                  { key: "width", label: "Ancho px" },
                  { key: "height", label: "Alto px" },
                ] as const
              ).map((f) => (
                <label key={f.key} className="space-y-0.5">
                  <span>{f.label}</span>
                  <input
                    type="number"
                    value={region[f.key]}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      const next = { ...region, [f.key]: val };
                      setRegion(
                        workingPageRGBA
                          ? clampRegionToImage(next, workingPageRGBA.width, workingPageRGBA.height)
                          : next
                      );
                    }}
                    className="w-full rounded-lg border border-[#3A2E2B] bg-[#F4EEDC] px-1.5 py-1 font-mono font-bold text-[#3A2E2B]"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* PANEL DERECHO: Calibración, Procesamiento, Revisión 4-en-1 y Guardado */}
        <div
          className={`lg:col-span-4 space-y-3 ${
            mobilePanel === "review" ? "block" : "hidden lg:block"
          }`}
        >
          {/* Bloque 2 & 3: Calibración y Procesamiento Determinista */}
          <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-4 shadow-[0_6px_0_#3A2E2B] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-black uppercase text-[#3A2E2B] flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-[#314C3C]" />
                Panel 3 · Calibración y Detección
              </h4>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={!croppedRegionRGBA || manualOnlyMode}
                  onClick={handleAssistedDetection}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#3A2E2B] bg-[#E7D69C] px-2 py-1 text-[10px] font-black text-[#3A2E2B] disabled:opacity-40 cursor-pointer"
                >
                  <ScanLine className="h-3 w-3" />
                  Detección asistida
                </button>
                <button
                  type="button"
                  onClick={() => setManualOnlyMode((v) => !v)}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-black cursor-pointer ${
                    manualOnlyMode
                      ? "border-[#3A2E2B] bg-[#314C3C] text-[#FFFDF8]"
                      : "border-[#3A2E2B]/50 bg-[#F4EEDC] text-[#3A2E2B]"
                  }`}
                >
                  <Hand className="h-3 w-3" />
                  {manualOnlyMode ? "Manual activo" : "Modo manual"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-[10px] font-bold text-[#5C381E]">
              <label>
                Filas
                <input
                  type="number"
                  min={FILET_MIN_DIM}
                  max={FILET_MAX_GLYPH_DIM}
                  value={calibration.rows}
                  onChange={(e) => {
                    const rows = Math.min(FILET_MAX_GLYPH_DIM, Math.max(FILET_MIN_DIM, Number(e.target.value) || 1));
                    setCalibration((p) => ({
                      ...p,
                      rows,
                      cellHeight: Number((region.height / rows).toFixed(2)),
                    }));
                  }}
                  className="w-full rounded-lg border border-[#3A2E2B] bg-[#F4EEDC] px-1.5 py-1 font-mono text-[#3A2E2B]"
                />
              </label>
              <label>
                Columnas
                <input
                  type="number"
                  min={FILET_MIN_DIM}
                  max={FILET_MAX_GLYPH_DIM}
                  value={calibration.cols}
                  onChange={(e) => {
                    const cols = Math.min(FILET_MAX_GLYPH_DIM, Math.max(FILET_MIN_DIM, Number(e.target.value) || 1));
                    setCalibration((p) => ({
                      ...p,
                      cols,
                      cellWidth: Number((region.width / cols).toFixed(2)),
                    }));
                  }}
                  className="w-full rounded-lg border border-[#3A2E2B] bg-[#F4EEDC] px-1.5 py-1 font-mono text-[#3A2E2B]"
                />
              </label>
              <label>
                Rotación (°)
                <input
                  type="number"
                  step={0.5}
                  min={-15}
                  max={15}
                  value={calibration.rotationDeg}
                  onChange={(e) =>
                    setCalibration((p) => ({ ...p, rotationDeg: Number(e.target.value) || 0 }))
                  }
                  className="w-full rounded-lg border border-[#3A2E2B] bg-[#F4EEDC] px-1.5 py-1 font-mono text-[#3A2E2B]"
                />
              </label>
              <label>
                Desp. X
                <input
                  type="number"
                  step={1}
                  value={calibration.offsetX}
                  onChange={(e) =>
                    setCalibration((p) => ({ ...p, offsetX: Number(e.target.value) || 0 }))
                  }
                  className="w-full rounded-lg border border-[#3A2E2B] bg-[#F4EEDC] px-1.5 py-1 font-mono text-[#3A2E2B]"
                />
              </label>
              <label>
                Desp. Y
                <input
                  type="number"
                  step={1}
                  value={calibration.offsetY}
                  onChange={(e) =>
                    setCalibration((p) => ({ ...p, offsetY: Number(e.target.value) || 0 }))
                  }
                  className="w-full rounded-lg border border-[#3A2E2B] bg-[#F4EEDC] px-1.5 py-1 font-mono text-[#3A2E2B]"
                />
              </label>
              <label>
                Opacidad ({Math.round(calibration.gridOpacity * 100)}%)
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={calibration.gridOpacity}
                  onChange={(e) =>
                    setCalibration((p) => ({ ...p, gridOpacity: Number(e.target.value) }))
                  }
                  className="w-full"
                />
              </label>
            </div>

            {!manualOnlyMode && (
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#3A2E2B]/15 text-[10px] font-bold text-[#5C381E]">
                <label>
                  Contraste ({processing.contrast})
                  <input
                    type="range"
                    min={-80}
                    max={80}
                    value={processing.contrast}
                    onChange={(e) =>
                      setProcessing((p) => ({ ...p, contrast: Number(e.target.value) }))
                    }
                    className="w-full"
                  />
                </label>
                <label>
                  <span className="flex justify-between">
                    <span>Umbral ({processing.threshold})</span>
                    <button
                      type="button"
                      onClick={handleApplyOtsu}
                      className="text-[#314C3C] underline cursor-pointer"
                    >
                      Otsu
                    </button>
                  </span>
                  <input
                    type="range"
                    min={10}
                    max={245}
                    value={processing.threshold}
                    onChange={(e) =>
                      setProcessing((p) => ({ ...p, threshold: Number(e.target.value) }))
                    }
                    className="w-full"
                  />
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={processing.invert}
                    onChange={(e) =>
                      setProcessing((p) => ({ ...p, invert: e.target.checked }))
                    }
                  />
                  <Contrast className="h-3 w-3" /> Invertir B/N
                </label>
                <label>
                  Margen interior ({Math.round(calibration.innerSampleMarginRatio * 100)}%)
                  <input
                    type="range"
                    min={0.05}
                    max={0.38}
                    step={0.02}
                    value={calibration.innerSampleMarginRatio}
                    onChange={(e) =>
                      setCalibration((p) => ({
                        ...p,
                        innerSampleMarginRatio: Number(e.target.value),
                      }))
                    }
                    className="w-full"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Bloque 4: Revisión simultánea (Región original + Cuadrícula + Matriz editable + Ambiguas) */}
          <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-4 shadow-[0_6px_0_#3A2E2B] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <h4 className="text-xs font-black uppercase text-[#3A2E2B] flex items-center gap-1">
                <Grid3X3 className="h-3.5 w-3.5 text-[#C88973]" />
                Revisión y Corrección Manual
              </h4>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={editHistory.past.length === 0}
                  onClick={() => setEditHistory((h) => undoMatrixHistory(h))}
                  aria-label="Deshacer edición de celda"
                  className="rounded-lg border border-[#3A2E2B] bg-[#F4EEDC] p-1 text-[#3A2E2B] disabled:opacity-40 cursor-pointer"
                >
                  <Undo2 className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  disabled={editHistory.future.length === 0}
                  onClick={() => setEditHistory((h) => redoMatrixHistory(h))}
                  aria-label="Rehacer edición de celda"
                  className="rounded-lg border border-[#3A2E2B] bg-[#F4EEDC] p-1 text-[#3A2E2B] disabled:opacity-40 cursor-pointer"
                >
                  <Redo2 className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setMatrixZoomPx((z) => Math.max(14, z - 4))}
                  aria-label="Reducir celdas matriz"
                  className="rounded-lg border border-[#3A2E2B] bg-[#F4EEDC] p-1 text-[#3A2E2B] cursor-pointer"
                >
                  <ZoomOut className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setMatrixZoomPx((z) => Math.min(34, z + 4))}
                  aria-label="Ampliar celdas matriz"
                  className="rounded-lg border border-[#3A2E2B] bg-[#F4EEDC] p-1 text-[#3A2E2B] cursor-pointer"
                >
                  <ZoomIn className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={handleRestoreInitialDetection}
                  className="rounded-lg border border-[#3A2E2B]/50 bg-[#FFFBF2] px-2 py-0.5 text-[10px] font-black text-[#3A2E2B] cursor-pointer"
                >
                  Restaurar detección
                </button>
              </div>
            </div>

            {detectionResult && detectionResult.ambiguousCount > 0 && (
              <p className="rounded-xl border border-amber-700 bg-amber-50 px-2.5 py-1.5 text-[10px] font-bold text-amber-950 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                {detectionResult.ambiguousCount} celda(s) ambigua(s) marcada(s) en ámbar (?); revísalas manualmente.
              </p>
            )}

            {/* Comparativa simultánea: Recorte original + Matriz binaria editable */}
            <div className="flex flex-wrap items-start gap-3">
              {croppedRegionDataUrl && (
                <div className="space-y-1">
                  <span className="text-[9px] font-black uppercase text-[#795548] block">
                    Región original
                  </span>
                  <img
                    src={croppedRegionDataUrl}
                    alt="Región recortada original"
                    className="w-24 h-24 object-contain rounded-xl border-2 border-[#3A2E2B] bg-white"
                  />
                </div>
              )}

              <div className="overflow-auto max-h-60 rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC]/70 p-2 flex-1">
                <div className="inline-block">
                  {editHistory.present.map((row, r) => (
                    <div key={`m-r-${r}`} className="flex">
                      {row.map((val, c) => {
                        const isAmb = ambiguousSet.has(`${r},${c}`);
                        return (
                          <button
                            key={`m-c-${r}-${c}`}
                            type="button"
                            onClick={() => handleToggleCell(r, c)}
                            aria-label={`Celda fila ${r + 1}, col ${c + 1}: ${
                              val === 1 ? "llena" : "vacía"
                            }${isAmb ? " (ambigua)" : ""}`}
                            style={{ width: matrixZoomPx, height: matrixZoomPx }}
                            className={`border text-[9px] font-black flex items-center justify-center cursor-pointer ${
                              isAmb
                                ? val === 1
                                  ? "border-amber-600 bg-[#3A2E2B] text-amber-300 ring-1 ring-amber-500"
                                  : "border-amber-600 bg-amber-100 text-amber-900"
                                : val === 1
                                ? "border-[#3A2E2B]/40 bg-[#3A2E2B] text-white"
                                : "border-[#3A2E2B]/30 bg-[#FFFDF8] text-transparent"
                            }`}
                          >
                            {isAmb ? "?" : ""}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bloque 5: Formulario de confirmación y guardado en Biblioteca Histórica */}
            <form
              onSubmit={handleConfirmAndSaveGlyph}
              className="space-y-2 pt-2 border-t border-[#3A2E2B]/15 text-[11px]"
            >
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="text"
                  required
                  maxLength={8}
                  placeholder="Carácter (ej. A) *"
                  value={glyphSymbol}
                  onChange={(e) => setGlyphSymbol(e.target.value)}
                  className="rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-2.5 py-1.5 font-black text-[#3A2E2B]"
                />
                <input
                  type="text"
                  placeholder="Nombre (ej. A gótica)"
                  value={glyphName}
                  onChange={(e) => setGlyphName(e.target.value)}
                  className="rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-2.5 py-1.5 font-bold text-[#3A2E2B]"
                />
                <select
                  aria-label="Colección destino"
                  value={targetCollection?.id || ""}
                  onChange={(e) => setTargetCollectionId(e.target.value)}
                  className="rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-2 py-1.5 font-bold text-[#3A2E2B]"
                >
                  {workspace.collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Estilo (ej. Vintage)"
                  value={glyphStyle}
                  onChange={(e) => setGlyphStyle(e.target.value)}
                  className="rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-2.5 py-1.5 font-bold text-[#3A2E2B]"
                />
              </div>

              {duplicateCheck.hasDuplicate && (
                <div className="rounded-xl border border-amber-700 bg-amber-50 p-2 space-y-1.5 text-[10px] text-amber-950">
                  <p className="font-black">
                    El carácter &ldquo;{glyphSymbol}&rdquo; ya existe en &ldquo;{targetCollection?.name}&rdquo; ({duplicateCheck.existingGlyphs.length} registro(s)).
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1 font-bold cursor-pointer">
                      <input
                        type="radio"
                        name="dup-strategy"
                        checked={duplicateStrategy === "variant"}
                        onChange={() => setDuplicateStrategy("variant")}
                      />
                      Guardar variante:
                    </label>
                    {duplicateStrategy === "variant" && (
                      <input
                        type="text"
                        value={variantLabel}
                        onChange={(e) => setVariantLabel(e.target.value)}
                        className="w-24 rounded border border-amber-700 bg-white px-1.5 py-0.5 font-bold"
                      />
                    )}
                    <label className="flex items-center gap-1 font-bold cursor-pointer">
                      <input
                        type="radio"
                        name="dup-strategy"
                        checked={duplicateStrategy === "replace"}
                        onChange={() => setDuplicateStrategy("replace")}
                      />
                      Reemplazar existente
                    </label>
                  </div>
                </div>
              )}

              <input
                type="text"
                placeholder="Notas de procedencia / observaciones (opcional)"
                value={glyphNotes}
                onChange={(e) => setGlyphNotes(e.target.value)}
                className="w-full rounded-xl border border-[#3A2E2B]/50 bg-[#FFFDF8] px-2.5 py-1.5 text-[#3A2E2B]"
              />

              <label className="flex items-start gap-2 rounded-xl border border-[#314C3C]/40 bg-[#314C3C]/10 p-2 text-[10px] font-bold text-[#1A2B20] cursor-pointer">
                <input
                  type="checkbox"
                  checked={explicitReviewConfirmed}
                  onChange={(e) => setExplicitReviewConfirmed(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Confirmo que revisé visualmente la matriz detectada y deseo guardar este glifo en mi biblioteca histórica (sin suavizado ni rediseño automático).
                </span>
              </label>

              <CozyButton
                type="submit"
                variant="forest"
                size="sm"
                disabled={!explicitReviewConfirmed || !glyphSymbol.trim()}
                className="w-full flex items-center justify-center gap-1.5"
              >
                {explicitReviewConfirmed ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Guardar Glifo y Seguir en Esta Página
              </CozyButton>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
