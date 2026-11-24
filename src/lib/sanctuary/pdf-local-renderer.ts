"use client";

/**
 * Renderizador local de PDF mediante pdfjs-dist v6.5.x (sin CDN externo, sin scripting, sin eval).
 * Utiliza exclusivamente el worker local servido en `/pdf.worker.min.mjs`.
 */

import {
  HISTORICAL_DOC_MAX_DIMENSION_PX,
  HISTORICAL_DOC_MAX_PDF_PAGES,
  type RGBAImageData,
} from "./filet-digitizer-engine";

export interface LoadedLocalPdfHandle {
  pageCount: number;
  renderPageToRGBA: (
    pageNumber: number,
    scale?: number
  ) => Promise<{ rgba: RGBAImageData; dataUrl: string }>;
  renderThumbnailDataUrl: (pageNumber: number, maxWidth?: number) => Promise<string>;
  destroy: () => Promise<void>;
}

export async function loadPdfDocumentLocal(bytes: Uint8Array): Promise<LoadedLocalPdfHandle> {
  if (typeof window === "undefined") {
    throw new Error("El renderizado de PDF solo se ejecuta en el navegador.");
  }

  const pdfjs = await import("pdfjs-dist");
  if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }

  // Copia defensiva: pdf.js transfiere el ArrayBuffer al worker; así el original permanece intacto
  const bytesCopy = new Uint8Array(bytes.byteLength);
  bytesCopy.set(bytes);

  // pdfjs-dist v6.5+ eliminó eval() por defecto; se desactivan fuentes de sistema y CDN externo.
  const loadingTask = pdfjs.getDocument({
    data: bytesCopy,
    useSystemFonts: false,
  });

  const pdfDoc = await loadingTask.promise;
  const pageCount = pdfDoc.numPages;

  if (pageCount < 1 || pageCount > HISTORICAL_DOC_MAX_PDF_PAGES) {
    await pdfDoc.cleanup();
    await loadingTask.destroy();
    throw new Error(
      `El PDF tiene ${pageCount} página(s); el límite seguro permitido es 1..${HISTORICAL_DOC_MAX_PDF_PAGES}.`
    );
  }

  const renderPageToCanvas = async (pageNumber: number, requestedScale: number) => {
    const safePage = Math.min(pageCount, Math.max(1, Math.floor(pageNumber)));
    const page = await pdfDoc.getPage(safePage);
    const baseViewport = page.getViewport({ scale: 1 });
    const maxAllowedScale = Math.min(
      requestedScale,
      HISTORICAL_DOC_MAX_DIMENSION_PX / Math.max(1, baseViewport.width, baseViewport.height)
    );
    const viewport = page.getViewport({ scale: Math.max(0.25, maxAllowedScale) });

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      throw new Error("No se pudo inicializar el contexto Canvas 2D para renderizar PDF.");
    }

    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    return { canvas, ctx };
  };

  return {
    pageCount,
    async renderPageToRGBA(pageNumber: number, scale = 1.8) {
      const { canvas, ctx } = await renderPageToCanvas(pageNumber, scale);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/png");
      return {
        rgba: {
          width: canvas.width,
          height: canvas.height,
          data: new Uint8ClampedArray(imageData.data),
        },
        dataUrl,
      };
    },
    async renderThumbnailDataUrl(pageNumber: number, maxWidth = 96) {
      const safePage = Math.min(pageCount, Math.max(1, Math.floor(pageNumber)));
      const page = await pdfDoc.getPage(safePage);
      const baseVp = page.getViewport({ scale: 1 });
      const thumbScale = Math.min(0.4, maxWidth / Math.max(1, baseVp.width));
      const { canvas } = await renderPageToCanvas(safePage, Math.max(0.1, thumbScale));
      return canvas.toDataURL("image/jpeg", 0.72);
    },
    async destroy() {
      await pdfDoc.cleanup();
      await loadingTask.destroy();
    },
  };
}
