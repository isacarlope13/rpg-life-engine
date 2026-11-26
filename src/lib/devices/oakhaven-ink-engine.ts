/**
 * ============================================================================
 * OAKHAVEN INK — MOTOR DETERMINISTA DE CUADERNOS Y TRAZOS PARA S PEN
 * ============================================================================
 * Soporta cuadernos multipágina, plantillas de papel (blank/grid/lined/dots),
 * presión de S Pen, rechazo de palma, borrador, selección de trazos,
 * Undo/Redo, guardado automático offline y enlace a proyectos/tareas.
 */

export type InkPaperTemplate = "blank" | "grid" | "lined" | "dots";

export interface InkPoint {
  x: number;
  y: number;
  pressure: number;
  t: number;
}

export interface InkStroke {
  id: string;
  color: string;
  baseWidth: number;
  pointerType: "pen" | "touch" | "mouse";
  points: InkPoint[];
}

export interface InkPage {
  id: string;
  title: string;
  template: InkPaperTemplate;
  width: number;
  height: number;
  strokes: InkStroke[];
  updatedAt: string;
}

export interface InkNotebook {
  schemaVersion: 1;
  id: string;
  title: string;
  linkedProjectId?: string;
  linkedTaskId?: string;
  pages: InkPage[];
  activePageId: string;
  updatedAt: string;
}

export interface InkDocument {
  schemaVersion: 1;
  id: string;
  title: string;
  template?: InkPaperTemplate;
  width: number;
  height: number;
  strokes: InkStroke[];
  linkedProjectId?: string;
  linkedTaskId?: string;
  updatedAt: string;
}

export const OAKHAVEN_INK_MAX_STROKES = 500;
export const OAKHAVEN_INK_MAX_POINTS_PER_STROKE = 2000;
export const OAKHAVEN_INK_MAX_PAGES = 50;

export function shouldAcceptInkPointer(
  pointerType: string,
  penOnlyPalmRejection: boolean
): boolean {
  if (!penOnlyPalmRejection) return true;
  return pointerType === "pen" || pointerType === "mouse";
}

export function normalizeInkPoint(
  x: number,
  y: number,
  pressure?: number,
  t = Date.now()
): InkPoint {
  const safeP =
    typeof pressure === "number" && Number.isFinite(pressure) && pressure > 0
      ? Math.min(1, Math.max(0.15, pressure))
      : 0.5;
  return {
    x: Number(x.toFixed(1)),
    y: Number(y.toFixed(1)),
    pressure: Number(safeP.toFixed(2)),
    t,
  };
}

export function computeStrokeWidth(baseWidth: number, pressure: number): number {
  const clampedBase = Math.max(1, Math.min(24, baseWidth));
  const clampedP = Math.max(0.15, Math.min(1, pressure));
  return Number((clampedBase * (0.55 + clampedP * 0.75)).toFixed(2));
}

export function createInkPage(
  title = "Página 1",
  template: InkPaperTemplate = "dots",
  width = 640,
  height = 360
): InkPage {
  return {
    id: `page_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title: title.trim().slice(0, 80) || "Página",
    template,
    width: Math.max(100, Math.min(2400, Math.round(width))),
    height: Math.max(100, Math.min(2400, Math.round(height))),
    strokes: [],
    updatedAt: new Date().toISOString(),
  };
}

export function createInkNotebook(
  title = "Cuaderno Personal",
  template: InkPaperTemplate = "dots",
  links?: { linkedProjectId?: string; linkedTaskId?: string }
): InkNotebook {
  const firstPage = createInkPage("Página 1", template);
  return {
    schemaVersion: 1,
    id: `nb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title: title.trim().slice(0, 120) || "Cuaderno Personal",
    linkedProjectId: links?.linkedProjectId,
    linkedTaskId: links?.linkedTaskId,
    pages: [firstPage],
    activePageId: firstPage.id,
    updatedAt: new Date().toISOString(),
  };
}

export function addPageToNotebook(
  notebook: InkNotebook,
  template?: InkPaperTemplate
): InkNotebook {
  if (notebook.pages.length >= OAKHAVEN_INK_MAX_PAGES) return notebook;
  const current = notebook.pages.find((p) => p.id === notebook.activePageId) || notebook.pages[0];
  const nextPage = createInkPage(
    `Página ${notebook.pages.length + 1}`,
    template ?? current?.template ?? "dots",
    current?.width ?? 640,
    current?.height ?? 360
  );
  return {
    ...notebook,
    pages: [...notebook.pages, nextPage],
    activePageId: nextPage.id,
    updatedAt: new Date().toISOString(),
  };
}

export function findStrokeAtPoint(
  strokes: InkStroke[],
  x: number,
  y: number,
  tolerancePx = 12
): InkStroke | null {
  const tolSq = tolerancePx * tolerancePx;
  for (let i = strokes.length - 1; i >= 0; i--) {
    const s = strokes[i];
    for (const p of s.points) {
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy <= tolSq) return s;
    }
  }
  return null;
}

export function createEmptyInkDocument(
  title = "Nota manuscrita",
  width = 800,
  height = 500,
  template: InkPaperTemplate = "blank"
): InkDocument {
  return {
    schemaVersion: 1,
    id: `ink_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title: title.trim().slice(0, 120) || "Nota manuscrita",
    template,
    width: Math.max(100, Math.min(2400, Math.round(width))),
    height: Math.max(100, Math.min(2400, Math.round(height))),
    strokes: [],
    updatedAt: new Date().toISOString(),
  };
}

function escapeXmlAttr(str: string): string {
  return str.replace(/[<>&"']/g, "");
}

function buildPaperTemplateSvg(template: InkPaperTemplate, width: number, height: number): string {
  if (template === "blank") return "";
  const parts: string[] = [];
  if (template === "grid") {
    for (let x = 24; x < width; x += 24) {
      parts.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="#3A2E2B" stroke-opacity="0.12" stroke-width="1" />`);
    }
    for (let y = 24; y < height; y += 24) {
      parts.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="#3A2E2B" stroke-opacity="0.12" stroke-width="1" />`);
    }
  } else if (template === "lined") {
    for (let y = 28; y < height; y += 28) {
      parts.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="#3A2E2B" stroke-opacity="0.15" stroke-width="1" />`);
    }
  } else if (template === "dots") {
    for (let y = 24; y < height; y += 24) {
      for (let x = 24; x < width; x += 24) {
        parts.push(`<circle cx="${x}" cy="${y}" r="1.1" fill="#3A2E2B" fill-opacity="0.22" />`);
      }
    }
  }
  return parts.join("");
}

/**
 * Exporta un InkDocument o InkPage a SVG limpio y seguro (sin scripts ni recursos externos).
 */
export function exportInkDocumentToSvg(doc: Pick<InkDocument, "width" | "height" | "strokes" | "template">): string {
  const bgTemplate = buildPaperTemplateSvg(doc.template || "blank", doc.width, doc.height);
  const paths = doc.strokes
    .filter((s) => s.points.length > 0)
    .map((s) => {
      const color = escapeXmlAttr(s.color || "#3A2E2B");
      const avgP =
        s.points.reduce((acc, p) => acc + p.pressure, 0) / Math.max(1, s.points.length);
      const sw = computeStrokeWidth(s.baseWidth, avgP);
      if (s.points.length === 1) {
        const p = s.points[0];
        return `<circle cx="${p.x}" cy="${p.y}" r="${(sw / 2).toFixed(2)}" fill="${color}" />`;
      }
      const d = s.points
        .map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`)
        .join(" ");
      return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" />`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${doc.width} ${doc.height}" width="${doc.width}" height="${doc.height}"><rect width="100%" height="100%" fill="#FFFDF8" />${bgTemplate}${paths}</svg>`;
}
