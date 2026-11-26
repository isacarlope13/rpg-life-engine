/**
 * ============================================================================
 * OAKHAVEN AI FASE 2 — MOTOR CENTRAL DE BIBLIOTECAS Y RECURSOS POR EDIFICIO
 * ============================================================================
 * Fuente única de verdad para:
 * - Taxonomía estricta de recursos por edificio (sin mezclar categorías).
 * - Validación real de contenido (magic bytes + extensión + MIME + path traversal).
 * - Protección adicional para documentos financieros sensibles.
 * - Pipeline determinista de extracción y defensa contra prompt injection en documentos.
 */

export type SyncLifecycleState =
  | "GUARDADO_LOCALMENTE"
  | "PENDIENTE_SINCRONIZACION"
  | "SINCRONIZADO"
  | "ERROR"
  | "CONFLICTO";

export type ProcessingStatus = "pending" | "ready" | "failed";
export type ExtractionStatus = "not_applicable" | "pending" | "completed" | "blocked_sensitive" | "failed";

export interface ResourceTypeDefinition {
  id: string;
  label: string;
  allowedExtensions: string[];
  allowedMimeTypes: string[];
  extractableText: boolean;
  isFinancialSensitive?: boolean;
}

export interface BuildingLibraryDefinition {
  buildingId: string;
  libraryTitle: string;
  libraryIcon: string;
  description: string;
  maxSizeBytes: number;
  resourceTypes: ResourceTypeDefinition[];
}

export interface PrivateBuildingResource {
  id: string;
  owner_id: string;
  building_id: string;
  resource_type: string;
  activity_id?: string | null;
  project_id?: string | null;
  title: string;
  description?: string;
  original_filename: string;
  storage_path?: string | null;
  mime_type: string;
  size_bytes: number;
  metadata: Record<string, unknown>;
  tags: string[];
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  processing_status: ProcessingStatus;
  extraction_status: ExtractionStatus;
  extraction_error?: string | null;
  extracted_text?: string | null;
  content_hash?: string | null;
  is_sensitive_financial: boolean;
  sync_state: SyncLifecycleState;
}

export const BUILDING_LIBRARY_CONFIG: Record<string, BuildingLibraryDefinition> = {
  banco_oakhaven: {
    buildingId: "banco_oakhaven",
    libraryTitle: "Archivo Financiero",
    libraryIcon: "🏦",
    description: "Extractos, comprobantes y presupuestos privados (excluidos del contexto automático de IA).",
    maxSizeBytes: 8 * 1024 * 1024,
    resourceTypes: [
      { id: "receipt", label: "Comprobante de gasto", allowedExtensions: ["pdf", "png", "jpg", "jpeg", "webp"], allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp"], extractableText: false, isFinancialSensitive: true },
      { id: "bank_statement", label: "Extracto bancario", allowedExtensions: ["pdf", "csv"], allowedMimeTypes: ["application/pdf", "text/csv"], extractableText: false, isFinancialSensitive: true },
      { id: "budget", label: "Hoja de presupuesto", allowedExtensions: ["csv", "pdf", "txt", "md"], allowedMimeTypes: ["text/csv", "application/pdf", "text/plain", "text/markdown"], extractableText: false, isFinancialSensitive: true },
      { id: "financial_document", label: "Documento financiero", allowedExtensions: ["pdf"], allowedMimeTypes: ["application/pdf"], extractableText: false, isFinancialSensitive: true },
    ],
  },
  biblioteca: {
    buildingId: "biblioteca",
    libraryTitle: "Estantería Académica",
    libraryIcon: "🏛️",
    description: "Apuntes, guías de estudio, PDFs de clase y fuentes para tarjetas SM-2.",
    maxSizeBytes: 10 * 1024 * 1024,
    resourceTypes: [
      { id: "study_notes", label: "Apuntes de estudio", allowedExtensions: ["md", "txt", "pdf"], allowedMimeTypes: ["text/markdown", "text/plain", "application/pdf"], extractableText: true },
      { id: "lecture_pdf", label: "Guía / PDF de clase", allowedExtensions: ["pdf"], allowedMimeTypes: ["application/pdf"], extractableText: false },
      { id: "assignment", label: "Evaluación / Taller", allowedExtensions: ["pdf", "md", "txt"], allowedMimeTypes: ["application/pdf", "text/markdown", "text/plain"], extractableText: true },
      { id: "course_resource", label: "Recurso de curso", allowedExtensions: ["pdf", "png", "jpg", "jpeg", "webp", "md", "txt"], allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp", "text/markdown", "text/plain"], extractableText: true },
      { id: "flashcards_source", label: "Fuente de tarjetas SM-2", allowedExtensions: ["txt", "md", "csv"], allowedMimeTypes: ["text/plain", "text/markdown", "text/csv"], extractableText: true },
    ],
  },
  oficina: {
    buildingId: "oficina",
    libraryTitle: "Archivo de Proyectos",
    libraryIcon: "💼",
    description: "Especificaciones técnicas, entregables, notas y archivos de código seguros.",
    maxSizeBytes: 10 * 1024 * 1024,
    resourceTypes: [
      { id: "project_document", label: "Documento de proyecto", allowedExtensions: ["pdf", "md", "txt"], allowedMimeTypes: ["application/pdf", "text/markdown", "text/plain"], extractableText: true },
      { id: "technical_spec", label: "Especificación técnica", allowedExtensions: ["md", "txt", "pdf", "json"], allowedMimeTypes: ["text/markdown", "text/plain", "application/pdf", "application/json"], extractableText: true },
      { id: "source_file", label: "Archivo de código / config", allowedExtensions: ["txt", "md", "json"], allowedMimeTypes: ["text/plain", "text/markdown", "application/json"], extractableText: true },
      { id: "task_attachment", label: "Adjunto de tarea", allowedExtensions: ["png", "jpg", "jpeg", "webp", "pdf"], allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "application/pdf"], extractableText: false },
      { id: "deliverable", label: "Entregable", allowedExtensions: ["pdf", "md", "txt", "png", "jpg", "jpeg"], allowedMimeTypes: ["application/pdf", "text/markdown", "text/plain", "image/png", "image/jpeg"], extractableText: true },
    ],
  },
  gimnasio: {
    buildingId: "gimnasio",
    libraryTitle: "Pizarra de Rutinas",
    libraryIcon: "🏋️",
    description: "Planes de entrenamiento, referencias de ejercicios y notas de técnica.",
    maxSizeBytes: 5 * 1024 * 1024,
    resourceTypes: [
      { id: "workout_plan", label: "Plan de rutina", allowedExtensions: ["pdf", "md", "txt"], allowedMimeTypes: ["application/pdf", "text/markdown", "text/plain"], extractableText: true },
      { id: "exercise_reference", label: "Referencia de ejercicio", allowedExtensions: ["png", "jpg", "jpeg", "webp", "pdf"], allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "application/pdf"], extractableText: false },
      { id: "progress_photo", label: "Foto de avance", allowedExtensions: ["png", "jpg", "jpeg", "webp"], allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"], extractableText: false },
      { id: "training_note", label: "Nota de entrenamiento", allowedExtensions: ["txt", "md"], allowedMimeTypes: ["text/plain", "text/markdown"], extractableText: true },
    ],
  },
  club_puzzles: {
    buildingId: "club_puzzles",
    libraryTitle: "Cuaderno de Algoritmos",
    libraryIcon: "🧩",
    description: "Hojas de algoritmos WCA (F2L/OLL/PLL), manuales de cubos y notas de calibración.",
    maxSizeBytes: 5 * 1024 * 1024,
    resourceTypes: [
      { id: "algorithm_sheet", label: "Hoja de algoritmos", allowedExtensions: ["pdf", "png", "jpg", "jpeg", "webp", "md", "txt"], allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp", "text/markdown", "text/plain"], extractableText: true },
      { id: "scramble_reference", label: "Referencia de scrambles", allowedExtensions: ["txt", "md", "csv"], allowedMimeTypes: ["text/plain", "text/markdown", "text/csv"], extractableText: true },
      { id: "cube_manual", label: "Manual de cubo", allowedExtensions: ["pdf", "png", "jpg", "jpeg"], allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg"], extractableText: false },
      { id: "training_note", label: "Nota de práctica", allowedExtensions: ["txt", "md"], allowedMimeTypes: ["text/plain", "text/markdown"], extractableText: true },
    ],
  },
  libreria: {
    buildingId: "libreria",
    libraryTitle: "Estantería Literaria",
    libraryIcon: "📚",
    description: "Portadas, citas memorables, notas de lectura y referencias bibliográficas.",
    maxSizeBytes: 5 * 1024 * 1024,
    resourceTypes: [
      { id: "book_cover", label: "Portada de libro", allowedExtensions: ["png", "jpg", "jpeg", "webp"], allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"], extractableText: false },
      { id: "reading_note", label: "Nota de lectura", allowedExtensions: ["txt", "md"], allowedMimeTypes: ["text/plain", "text/markdown"], extractableText: true },
      { id: "quotation", label: "Cita literaria", allowedExtensions: ["txt", "md"], allowedMimeTypes: ["text/plain", "text/markdown"], extractableText: true },
      { id: "reading_reference", label: "Referencia / Reseña", allowedExtensions: ["pdf", "txt", "md", "png", "jpg", "jpeg"], allowedMimeTypes: ["application/pdf", "text/plain", "text/markdown", "image/png", "image/jpeg"], extractableText: true },
    ],
  },
  cine: {
    buildingId: "cine",
    libraryTitle: "Cartelera Personal",
    libraryIcon: "🎬",
    description: "Carteles, reseñas de películas/series/musicales e importaciones de listas.",
    maxSizeBytes: 5 * 1024 * 1024,
    resourceTypes: [
      { id: "poster", label: "Cartel / Póster", allowedExtensions: ["png", "jpg", "jpeg", "webp"], allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"], extractableText: false },
      { id: "review", label: "Reseña personal", allowedExtensions: ["txt", "md"], allowedMimeTypes: ["text/plain", "text/markdown"], extractableText: true },
      { id: "watchlist_import", label: "Lista cultural (CSV/JSON)", allowedExtensions: ["csv", "json", "txt"], allowedMimeTypes: ["text/csv", "application/json", "text/plain"], extractableText: true },
      { id: "media_reference", label: "Ficha / Referencia cultural", allowedExtensions: ["png", "jpg", "jpeg", "webp", "pdf", "txt", "md"], allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "application/pdf", "text/plain", "text/markdown"], extractableText: true },
    ],
  },
  atelier: {
    buildingId: "atelier",
    libraryTitle: "Carpeta de Patrones",
    libraryIcon: "🧶",
    description: "Patrones de crochet, diagramas de puntos, fotos de avance, documentos históricos e inventario de hilados.",
    maxSizeBytes: 5 * 1024 * 1024,
    resourceTypes: [
      { id: "crochet_pattern", label: "Patrón de crochet", allowedExtensions: ["pdf", "png", "jpg", "jpeg", "webp", "txt", "md"], allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain", "text/markdown"], extractableText: true },
      { id: "stitch_diagram", label: "Diagrama de puntos", allowedExtensions: ["png", "jpg", "jpeg", "webp", "pdf"], allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "application/pdf"], extractableText: false },
      { id: "progress_photo", label: "Foto de avance", allowedExtensions: ["png", "jpg", "jpeg", "webp"], allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"], extractableText: false },
      { id: "yarn_reference", label: "Referencia de lana / ovillo", allowedExtensions: ["png", "jpg", "jpeg", "webp", "txt", "md"], allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "text/plain", "text/markdown"], extractableText: true },
      { id: "material_list", label: "Lista de materiales", allowedExtensions: ["txt", "md", "csv"], allowedMimeTypes: ["text/plain", "text/markdown", "text/csv"], extractableText: true },
      { id: "filet_crochet_studio", label: "Filet Crochet Studio (JSON)", allowedExtensions: ["json"], allowedMimeTypes: ["application/json"], extractableText: true },
      { id: "historical_alphabet_document", label: "Documento Histórico de Alfabeto (PDF/Img)", allowedExtensions: ["pdf", "png", "jpg", "jpeg", "webp"], allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp"], extractableText: false },
    ],
  },
};

export function getBuildingLibraryConfig(buildingId: string): BuildingLibraryDefinition | undefined {
  return BUILDING_LIBRARY_CONFIG[buildingId];
}

/**
 * Sanitiza nombres de archivo y previene path traversal (`../`, rutas absolutas, bytes nulos).
 */
export function sanitizeSafeFilename(rawFilename: string): { safeName: string; hasTraversal: boolean } {
  const hasTraversal =
    rawFilename.includes("..") ||
    rawFilename.includes("/") ||
    rawFilename.includes("\\") ||
    rawFilename.includes("\0");
  const base = rawFilename.split(/[/\\]/).pop() || "recurso";
  const safeName = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 120);
  return { safeName: safeName || "recurso", hasTraversal };
}

export function buildPrivateStoragePath(ownerId: string, buildingId: string, resourceId: string, rawFilename: string): string {
  const { safeName } = sanitizeSafeFilename(rawFilename);
  return `${ownerId}/${buildingId}/${resourceId}_${safeName}`;
}

/**
 * Detecta el formato real inspeccionando magic bytes (no confía ciegamente en el MIME del navegador).
 */
export function sniffFileMagicBytes(bytes: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | "application/pdf" | "text/plain" | "unknown" {
  if (!bytes || bytes.length === 0) return "unknown";
  // PNG: 89 50 4E 47
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  // WEBP: RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  // PDF: %PDF-
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d
  ) {
    return "application/pdf";
  }
  // Ejecutables / binarios prohibidos (MZ, ELF, ZIP/DOCX mal disfrazado, bytes nulos)
  if (bytes.length >= 2 && bytes[0] === 0x4d && bytes[1] === 0x5a) return "unknown"; // PE/EXE
  if (bytes.length >= 4 && bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) return "unknown"; // ELF
  for (let i = 0; i < Math.min(bytes.length, 512); i++) {
    if (bytes[i] === 0x00) return "unknown";
  }
  return "text/plain";
}

export interface PrivateFileValidationInput {
  buildingId: string;
  resourceType: string;
  filename: string;
  reportedMimeType: string;
  sizeBytes: number;
  ownerId: string;
  authenticatedUserId: string;
  fileBytes?: Uint8Array;
}

export function validatePrivateResourceFile(input: PrivateFileValidationInput): {
  valid: boolean;
  error?: string;
  safeFilename?: string;
  isFinancialSensitive?: boolean;
  extractableText?: boolean;
} {
  if (!input.authenticatedUserId || input.ownerId !== input.authenticatedUserId) {
    return { valid: false, error: "Acceso denegado: propietario no coincide con el usuario autenticado." };
  }

  const library = BUILDING_LIBRARY_CONFIG[input.buildingId];
  if (!library) {
    return { valid: false, error: `Edificio "${input.buildingId}" sin biblioteca autorizada.` };
  }

  const typeDef = library.resourceTypes.find((t) => t.id === input.resourceType);
  if (!typeDef) {
    return {
      valid: false,
      error: `El tipo de recurso "${input.resourceType}" no está permitido en ${library.libraryTitle}.`,
    };
  }

  const { safeName, hasTraversal } = sanitizeSafeFilename(input.filename || "");
  if (hasTraversal) {
    return { valid: false, error: "Nombre de archivo rechazado por intento de path traversal." };
  }

  const ext = safeName.includes(".") ? safeName.split(".").pop()!.toLowerCase() : "";
  if (!ext || !typeDef.allowedExtensions.includes(ext)) {
    return {
      valid: false,
      error: `Extensión ".${ext || "desconocida"}" no permitida para "${typeDef.label}" en ${library.libraryTitle}.`,
    };
  }

  const mime = (input.reportedMimeType || "").trim().toLowerCase();
  if (!typeDef.allowedMimeTypes.includes(mime)) {
    return {
      valid: false,
      error: `Tipo MIME "${mime || "desconocido"}" incompatible con "${typeDef.label}".`,
    };
  }

  // Verificar coherencia extensión <-> MIME
  const extToMimeGroup: Record<string, string[]> = {
    png: ["image/png"],
    jpg: ["image/jpeg"],
    jpeg: ["image/jpeg"],
    webp: ["image/webp"],
    pdf: ["application/pdf"],
    txt: ["text/plain"],
    md: ["text/markdown", "text/plain"],
    csv: ["text/csv", "text/plain"],
    json: ["application/json", "text/plain"],
  };
  if (extToMimeGroup[ext] && !extToMimeGroup[ext].includes(mime)) {
    return { valid: false, error: `Inconsistencia detectada: extensión .${ext} no coincide con MIME ${mime}.` };
  }

  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > library.maxSizeBytes) {
    return {
      valid: false,
      error: `Tamaño inválido (máximo ${Math.round(library.maxSizeBytes / (1024 * 1024))} MB en ${library.libraryTitle}).`,
    };
  }

  // Verificación real de contenido (magic bytes) cuando se proveen bytes
  if (input.fileBytes) {
    const sniffed = sniffFileMagicBytes(input.fileBytes);
    if (sniffed === "unknown") {
      return { valid: false, error: "Contenido binario inválido o potencialmente peligroso." };
    }
    const textMimes = ["text/plain", "text/markdown", "text/csv", "application/json"];
    if (textMimes.includes(mime)) {
      if (sniffed !== "text/plain") {
        return { valid: false, error: `El contenido real (${sniffed}) no coincide con archivo de texto (${mime}).` };
      }
      const preview = new TextDecoder("utf-8", { fatal: false }).decode(input.fileBytes.slice(0, 2048));
      if (/<script\b|javascript:/i.test(preview)) {
        return { valid: false, error: "Contenido bloqueado: se detectó código ejecutable embebido." };
      }
    } else if (sniffed !== mime) {
      return { valid: false, error: `Contenido real (${sniffed}) incompatible con el MIME declarado (${mime}).` };
    }
  }

  return {
    valid: true,
    safeFilename: safeName,
    isFinancialSensitive: Boolean(typeDef.isFinancialSensitive || input.buildingId === "banco_oakhaven"),
    extractableText: typeDef.extractableText,
  };
}

/**
 * Pipeline modular de extracción determinista y saneamiento contra prompt injection en documentos.
 * Trata todo texto de documento como DATOS NO CONFIABLES.
 */
export function extractAndSanitizeDocumentText(params: {
  rawText?: string;
  isFinancialSensitive: boolean;
  maxChars?: number;
}): {
  extractionStatus: ExtractionStatus;
  sanitizedText: string | null;
  promptInjectionDetected: boolean;
} {
  if (params.isFinancialSensitive) {
    return {
      extractionStatus: "blocked_sensitive",
      sanitizedText: null,
      promptInjectionDetected: false,
    };
  }
  const raw = (params.rawText || "").trim();
  if (!raw) {
    return {
      extractionStatus: "not_applicable",
      sanitizedText: null,
      promptInjectionDetected: false,
    };
  }

  const injectionRegex =
    /(ignore\s+(all\s+)?previous\s+instructions|ignora\s+(todas\s+las\s+)?instrucciones|system\s*prompt|execute_payment|ejecuta(r)?\s+(un\s+)?pago|grant\s+\d+\s*(gp|xp)|dame\s+\d+\s*(gp|xp)|bypass\s+rls)/gi;
  const promptInjectionDetected = injectionRegex.test(raw);
  const cleaned = raw
    .replace(injectionRegex, "[INSTRUCCIÓN_NO_CONFIABLE_REMOVIDA]")
    .slice(0, params.maxChars || 4000);

  return {
    extractionStatus: "completed",
    sanitizedText: cleaned,
    promptInjectionDetected,
  };
}
