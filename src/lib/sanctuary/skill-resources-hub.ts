/**
 * =====================================================================
 * SKILL RESOURCE HUB & SMART CAPTURE ENGINE — RPG LIFE-ENGINE 3.5.0
 * =====================================================================
 * Módulo de dominio para gestión unificada de recursos (libros, PDFs,
 * videos, enlaces, patrones, fotos de avance, plantillas) y captura
 * contextual inteligente con validación de seguridad y confirmación HITL.
 *
 * Principios:
 * 1. Minimizar entrada manual mediante valores sugeridos deterministas.
 * 2. Validación estricta de seguridad en archivos adjuntos (MIME y < 5 MB).
 * 3. Aislamiento multi-usuario estricto (Local-First & Supabase compatible).
 * 4. Confirmación humana previa (HITL) para metadatos extraídos.
 * 5. Cero interferencia con la economía canónica del juego.
 * =====================================================================
 */

import type { SkillDomain } from "@/types/rpg";

export type SkillResourceType =
  | "book"
  | "pdf"
  | "video"
  | "link"
  | "pattern"
  | "document"
  | "image"
  | "note"
  | "material"
  | "template";

export interface SkillResource {
  id: string;
  userId: string;
  domain: SkillDomain;
  type: SkillResourceType;
  title: string;
  description?: string;
  url?: string;
  attachmentDataUrl?: string; // Base64 data URL para fotos/PDF locales
  fileName?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  sanitizedName?: string;
}

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/markdown",
];

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 Megabytes

/**
 * Valida un archivo antes de cargarlo o procesarlo.
 */
export function validateSkillResourceAttachment(file: {
  name: string;
  size: number;
  type: string;
}): FileValidationResult {
  if (!file) {
    return { valid: false, error: "Archivo no proporcionado." };
  }

  // 1. Límite de tamaño
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `El archivo excede el tamaño máximo de 5 MB (tamaño actual: ${sizeMb} MB).`,
    };
  }

  // 2. Comprobación de tipo MIME
  const isAllowedMime = ALLOWED_MIME_TYPES.includes(file.type.toLowerCase());
  const ext = file.name.split(".").pop()?.toLowerCase();
  const allowedExts = ["jpg", "jpeg", "png", "webp", "gif", "pdf", "txt", "md"];
  const isAllowedExt = ext ? allowedExts.includes(ext) : false;

  if (!isAllowedMime && !isAllowedExt) {
    return {
      valid: false,
      error: `Formato de archivo no permitido (.${ext || "desconocido"}). Usa imágenes (PNG, JPG, WebP), PDF o texto.`,
    };
  }

  // Sanitización de nombre de archivo (evitar caracteres peligrosos)
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

  return { valid: true, sanitizedName };
}

// =====================================================================
// VALORES SUGERIDOS DETERMINISTAS POR HABILIDAD (SMART CAPTURE)
// =====================================================================

export interface SkillResourceContext {
  userId?: string;
  domain: SkillDomain;
  // Contexto de Lectura
  activeBook?: {
    id: string;
    title: string;
    author?: string;
    pages_read?: number;
    total_pages?: number;
  };
  // Contexto de Tejido
  activeKnittingProject?: {
    id: string;
    name: string;
    current_rows?: number;
    total_rows_target?: number;
    pattern_url?: string;
    yarn_name?: string;
  };
  // Contexto de Estudio
  activeStudy?: {
    subject?: string;
    topic?: string;
    spacedCardsDueCount?: number;
  };
  // Contexto de Trabajo
  activeWorkProject?: {
    id: string;
    name: string;
    currentStage?: string;
    nextPendingTask?: string;
  };
  // Contexto de Rubik
  activeRubik?: {
    cube_model?: string;
    pb_seconds?: number;
    lastAo5?: number;
  };
}

export interface SuggestedCaptureValues {
  primaryTitle: string;
  suggestedActionLabel: string;
  suggestedQuantity: number;
  unitLabel: string;
  contextSummary: string;
  progressPercentage?: number;
  quickSnippets: string[];
  suggestedNextStep?: string;
}

/**
 * Deriva de forma determinista los valores y metas sugeridas para la sesión,
 * ahorrándole al usuario tener que recordar o tipear manualmente su último estado.
 */
export function getSuggestedSkillValues(context: SkillResourceContext): SuggestedCaptureValues {
  switch (context.domain) {
    case "knitting": {
      const proj = context.activeKnittingProject;
      const currentRows = proj?.current_rows || 0;
      const targetRows = proj?.total_rows_target || 100;
      const progress = targetRows > 0 ? Math.min(100, Math.round((currentRows / targetRows) * 100)) : 0;
      const nextSuggestedRow = currentRows + 1;

      return {
        primaryTitle: proj?.name || "Proyecto en Telar",
        suggestedActionLabel: `Tejer Ronda ${nextSuggestedRow}`,
        suggestedQuantity: 1,
        unitLabel: "rondas",
        contextSummary: `Última ronda completada: ${currentRows} / ${targetRows} (${progress}% completado).`,
        progressPercentage: progress,
        suggestedNextStep: `Avanzar a ronda ${nextSuggestedRow} en hilo ${proj?.yarn_name || "principal"}`,
        quickSnippets: [
          "Punto bobo parejo y tensión constante",
          "Cambio de ovillo sin nudos visibles",
          "Avance de 5 rondas completadas",
          "Medición de tensión de muestra",
        ],
      };
    }

    case "reading": {
      const book = context.activeBook;
      const readPages = book?.pages_read || 0;
      const totalPages = book?.total_pages || 250;
      const remainingPages = Math.max(0, totalPages - readPages);
      const suggestedPace = Math.min(15, remainingPages > 0 ? remainingPages : 10);
      const progress = totalPages > 0 ? Math.min(100, Math.round((readPages / totalPages) * 100)) : 0;

      return {
        primaryTitle: book?.title || "Libro en Curso",
        suggestedActionLabel: `Leer ${suggestedPace} páginas (pág. ${readPages} a ${readPages + suggestedPace})`,
        suggestedQuantity: suggestedPace,
        unitLabel: "páginas",
        contextSummary: `Página actual: ${readPages} de ${totalPages} (${progress}% del libro).`,
        progressPercentage: progress,
        suggestedNextStep: `Continuar desde página ${readPages + 1}`,
        quickSnippets: [
          "Capítulo completado con notas reflexivas",
          "Cita memorable capturada por voz",
          "Lectura fluida y comprensiva",
          "Revisión de conceptos clave",
        ],
      };
    }

    case "study": {
      const study = context.activeStudy;
      const cardsDue = study?.spacedCardsDueCount || 0;
      const subject = study?.subject || "Materia Principal";
      const topic = study?.topic || "Temario General";

      return {
        primaryTitle: `${subject} — ${topic}`,
        suggestedActionLabel: cardsDue > 0 ? `Repasar ${cardsDue} Flashcards SM-2` : "Sesión Pomodoro 25 min",
        suggestedQuantity: cardsDue > 0 ? cardsDue : 25,
        unitLabel: cardsDue > 0 ? "tarjetas" : "minutos",
        contextSummary: cardsDue > 0 ? `${cardsDue} tarjetas requieren repaso espaciado hoy.` : "Sin tarjetas atrasadas; sesión de profundización recomendada.",
        progressPercentage: 100,
        suggestedNextStep: `Foco en ${topic}`,
        quickSnippets: [
          "Autoevaluación de comprensión 5/5",
          "Resolución de ejercicios prácticos",
          "Síntesis en mapa conceptual",
          "Repaso espaciado completado sin errores",
        ],
      };
    }

    case "work": {
      const work = context.activeWorkProject;
      const task = work?.nextPendingTask || "Tarea de Sprint Activa";
      const project = work?.name || "Proyecto Ágil";

      return {
        primaryTitle: project,
        suggestedActionLabel: `Sprint en tarea: ${task}`,
        suggestedQuantity: 25,
        unitLabel: "minutos",
        contextSummary: `Etapa actual: ${work?.currentStage || "En Progreso"} — Próxima tarea: ${task}`,
        progressPercentage: 50,
        suggestedNextStep: `Completar entregable para ${task}`,
        quickSnippets: [
          "Entregable terminado y verificado",
          "Sprint de código completado",
          "Minuta de reunión documentada",
          "Bloqueo técnico resuelto",
        ],
      };
    }

    default: {
      return {
        primaryTitle: "Sesión del Santuario",
        suggestedActionLabel: "Iniciar sesión de 25 min",
        suggestedQuantity: 25,
        unitLabel: "minutos",
        contextSummary: "Sesión libre de calma y foco.",
        progressPercentage: 0,
        quickSnippets: [
          "Foco profundo sin distracciones",
          "Objetivo cumplido satisfactoriamente",
          "Pausa activa consciente",
        ],
      };
    }
  }
}

// =====================================================================
// EXTRACCIÓN INTELIGENTE DE TEXTO / OCR LIGERO (HITL CONFIRMATION)
// =====================================================================

export interface ExtractedSmartSnippet {
  domain: SkillDomain;
  candidateTitle?: string;
  candidateNumber?: number;
  candidateUnit?: string;
  candidateNotes?: string;
  candidateTags: string[];
  confidence: "high" | "medium" | "low";
  requiresConfirmation: boolean;
}

/**
 * Analiza un fragmento de texto o notas pegadas/dictadas y extrae
 * datos estructurados con confirmación humana (HITL) previa.
 */
export function parseSmartCaptureSnippet(
  rawText: string,
  domain: SkillDomain
): ExtractedSmartSnippet {
  const text = rawText.trim();
  const lower = text.toLowerCase();

  const result: ExtractedSmartSnippet = {
    domain,
    candidateNotes: text,
    candidateTags: [],
    confidence: "medium",
    requiresConfirmation: true, // Invariante HITL: el usuario siempre confirma
  };

  // 1. Extracción de patrones numéricos
  // Ej: "página 45", "45 págs", "ronda 12", "15 minutos", "tiempo 14.5s"
  const pageMatch = lower.match(/(?:p[áa]g(?:ina)?s?|le[íi])\s*(\d+)/i) || lower.match(/(\d+)\s*(?:p[áa]g(?:ina)?s?)/i);
  const roundMatch = lower.match(/(?:ronda|vuelta|fila)s?\s*(\d+)/i) || lower.match(/(\d+)\s*(?:rondas?|vueltas?|filas?)/i);
  const timeMatch = lower.match(/(\d+)\s*(?:min(?:utos?)?|m\b)/i);
  const solveTimeMatch = lower.match(/(\d+[.,]\d{1,2})\s*(?:seg(?:undos?)?|s\b)/i);

  if (domain === "reading" && pageMatch) {
    result.candidateNumber = parseInt(pageMatch[1], 10);
    result.candidateUnit = "páginas";
    result.candidateTags.push("lectura_automatica");
    result.confidence = "high";
  } else if (domain === "knitting" && roundMatch) {
    result.candidateNumber = parseInt(roundMatch[1], 10);
    result.candidateUnit = "rondas";
    result.candidateTags.push("tejido_automatico");
    result.confidence = "high";
  } else if (domain === "rubik" && solveTimeMatch) {
    result.candidateNumber = parseFloat(solveTimeMatch[1].replace(",", "."));
    result.candidateUnit = "segundos";
    result.candidateTags.push("solve_wca");
    result.confidence = "high";
  } else if (timeMatch) {
    result.candidateNumber = parseInt(timeMatch[1], 10);
    result.candidateUnit = "minutos";
  }

  // 2. Extracción de citas (entre comillas)
  const quoteMatch = text.match(/["“](.+?)["”]/);
  if (quoteMatch) {
    result.candidateNotes = quoteMatch[1];
    result.candidateTags.push("cita_destacada");
  }

  return result;
}

// =====================================================================
// GESTOR DE ALMACENAMIENTO LOCAL-FIRST AISLADO POR USUARIO
// =====================================================================

const RESOURCES_KEY_PREFIX = "rpg_skill_resources_v4_";

function getLocalStorageSafely(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== "undefined" && (globalThis as unknown as { localStorage?: Storage }).localStorage) {
      return (globalThis as unknown as { localStorage: Storage }).localStorage;
    }
  } catch {
    // Ignorar si storage está deshabilitado
  }
  return null;
}

/**
 * Obtiene los recursos asociados a un dominio y usuario.
 */
export function getStoredSkillResources(
  domain: SkillDomain,
  userId: string = "usr_cozy_hero"
): SkillResource[] {
  const storage = getLocalStorageSafely();
  if (!storage) return [];

  try {
    const raw = storage.getItem(`${RESOURCES_KEY_PREFIX}${userId}`);
    if (!raw) return [];
    const all = JSON.parse(raw) as SkillResource[];
    if (!Array.isArray(all)) return [];
    return all.filter((r) => r.domain === domain && r.userId === userId);
  } catch {
    return [];
  }
}

/**
 * Guarda o actualiza un recurso de habilidad.
 */
export function saveSkillResource(
  resource: Omit<SkillResource, "id" | "createdAt" | "updatedAt"> & { id?: string },
  userId: string = "usr_cozy_hero"
): SkillResource {
  const now = new Date().toISOString();
  const id = resource.id || `res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const finalResource: SkillResource = {
    ...resource,
    id,
    userId,
    createdAt: resource.id ? (resource as SkillResource).createdAt || now : now,
    updatedAt: now,
    tags: resource.tags || [],
  };

  const storage = getLocalStorageSafely();
  if (storage) {
    try {
      const raw = storage.getItem(`${RESOURCES_KEY_PREFIX}${userId}`);
      const list: SkillResource[] = raw ? JSON.parse(raw) : [];
      const index = list.findIndex((r) => r.id === id);
      if (index >= 0) {
        list[index] = finalResource;
      } else {
        list.unshift(finalResource);
      }
      storage.setItem(`${RESOURCES_KEY_PREFIX}${userId}`, JSON.stringify(list));
    } catch (err) {
      console.error("[SkillResourcesHub] Error al guardar recurso:", err);
    }
  }

  return finalResource;
}

/**
 * Elimina un recurso garantizando aislamiento de usuario.
 */
export function deleteSkillResource(
  resourceId: string,
  userId: string = "usr_cozy_hero"
): boolean {
  const storage = getLocalStorageSafely();
  if (!storage) return false;

  try {
    const raw = storage.getItem(`${RESOURCES_KEY_PREFIX}${userId}`);
    if (!raw) return false;
    const list: SkillResource[] = JSON.parse(raw);
    const filtered = list.filter((r) => !(r.id === resourceId && r.userId === userId));
    storage.setItem(`${RESOURCES_KEY_PREFIX}${userId}`, JSON.stringify(filtered));
    return true;
  } catch {
    return false;
  }
}
