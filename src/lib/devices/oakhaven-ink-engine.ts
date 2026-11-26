/**
 * ============================================================================
 * OAKHAVEN INK — MOTOR DETERMINISTA DE TRAZOS PARA S PEN / GALAXY TAB
 * ============================================================================
 * Soporta entrada táctil, ratón y S Pen (PointerEvents con presión y rechazo
 * de palma opcional). 100 % local/offline y serializable a SVG o JSON.
 */

export interface InkPoint {
  x: number;
  y: number;
  /** Presión normalizada 0.1..1.0 (S Pen / stylus) */
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

export interface InkDocument {
  schemaVersion: 1;
  id: string;
  title: string;
  width: number;
  height: number;
  strokes: InkStroke[];
  updatedAt: string;
}

export const OAKHAVEN_INK_MAX_STROKES = 500;
export const OAKHAVEN_INK_MAX_POINTS_PER_STROKE = 2000;

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

export function createEmptyInkDocument(title = "Nota manuscrita", width = 800, height = 500): InkDocument {
  return {
    schemaVersion: 1,
    id: `ink_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title: title.trim().slice(0, 120) || "Nota manuscrita",
    width: Math.max(100, Math.min(2400, Math.round(width))),
    height: Math.max(100, Math.min(2400, Math.round(height))),
    strokes: [],
    updatedAt: new Date().toISOString(),
  };
}

function escapeXmlAttr(str: string): string {
  return str.replace(/[<>&"']/g, "");
}

/**
 * Exporta un InkDocument a SVG limpio y seguro (sin scripts ni recursos externos).
 */
export function exportInkDocumentToSvg(doc: InkDocument): string {
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

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${doc.width} ${doc.height}" width="${doc.width}" height="${doc.height}"><rect width="100%" height="100%" fill="#FFFDF8" />${paths}</svg>`;
}
